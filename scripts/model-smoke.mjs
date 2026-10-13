import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { compileSources, DEFAULT_MODEL, extractSource, localEndpoint, parseArgs, readInput, validateEvidence, validateProposal, validateSources } from './compile-sources.mjs';

function boundaryChecks() {
  const checks = [];
  const check = (name, run) => { run(); checks.push({ name, status: 'passed' }); };
  check('remote model endpoints rejected', () => assert.throws(() => localEndpoint('https://example.com')));
  check('noncanonical numeric loopback spellings rejected', () => {
    for (const endpoint of ['http://127.1:11434', 'http://2130706433:11434', 'http://0x7f000001:11434']) assert.throws(() => localEndpoint(endpoint));
  });
  check('model endpoint credentials and paths rejected', () => {
    assert.throws(() => localEndpoint('http://user:password@127.0.0.1:11434'));
    assert.throws(() => localEndpoint('http://127.0.0.1:11434/api/chat'));
  });
  check('missing evidence rejected', () => assert.equal(validateEvidence({ quote: 'invented', lineIds: [] }, 'Actual line').ok, false));
  check('missing source lines rejected', () => assert.equal(validateEvidence({ quote: '', lineIds: ['L9'] }, 'Actual line').ok, false));
  check('exact source quote accepted', () => assert.equal(validateEvidence({ quote: 'Actual line', lineIds: ['L1'] }, 'Actual line').method, 'exact_quote'));
  check('repeated exact quotation matched to its later source line', () => assert.deepEqual(validateEvidence({ quote: 'Same hours', lineIds: ['L3'] }, 'Same hours\nSunday\nSame hours').lineIds, ['L3']));
  check('non-exact quotation discarded with valid line fallback', () => {
    const result = validateEvidence({ quote: 'Rewritten line', lineIds: ['L1'] }, 'Actual line');
    assert.equal(result.method, 'line_ids'); assert.equal(result.quote, '');
  });
  check('quotation and line mismatch rejected', () => assert.equal(validateEvidence({ quote: 'Actual', lineIds: ['L2'] }, 'Actual\nOther').ok, false));
  check('duplicate source IDs rejected', () => assert.throws(() => validateSources([{ id: 'a', url: 'https://example.com', text: 'x' }, { id: 'a', url: 'https://example.com', text: 'y' }])));
  check('numeric source IDs rejected', () => assert.throws(() => validateSources([{ id: 123, url: 'https://example.com', text: 'x' }])));
  check('unknown model fields rejected', () => assert.equal(validateProposal({ eventName: null, venue: null, address: null, sessions: [], admission: [], childInclusiveCutoff: null, publish: true }, { text: 'x' }).ok, false));
  return checks;
}

export function checkFields(proposal, expected) {
  const checks = [];
  const check = (name, pass) => checks.push({ name, status: pass ? 'passed' : 'failed' });
  if (!proposal) return [{ name: 'accepted proposal available', status: 'failed' }];
  for (const field of ['eventName', 'venue', 'address', 'childInclusiveCutoff']) if (Object.hasOwn(expected, field)) {
    check(field, (proposal[field]?.value ?? null) === expected[field]);
  }
  for (const [index, session] of (expected.sessions ?? []).entries()) {
    check(`required session ${index + 1}: ${session.day}/${session.kind}`, proposal.sessions.some((item) => Object.entries(session).every(([key, value]) => item[key] === value)));
  }
  for (const [index, ticket] of (expected.admission ?? []).entries()) {
    check(`required ticket ${index + 1}: ${ticket.kind}/${ticket.scope}/${ticket.purchase}`, proposal.admission.some((item) => Object.entries(ticket).every(([key, value]) => item[key] === value)));
  }
  if (Object.hasOwn(expected, 'sessionCount')) check('session count', proposal.sessions.length === expected.sessionCount);
  if (Object.hasOwn(expected, 'admissionCount')) check('admission count', proposal.admission.length === expected.admissionCount);
  return checks;
}

// Public evidence includes normalized model facts and source line IDs, never private source prose or quotation bodies.
export function publicProposal(proposal) {
  if (!proposal) return null;
  const evidence = ({ lineIds, method }) => ({ lineIds, method });
  const scalar = (fact) => fact ? { value: fact.value, evidence: evidence(fact.evidence) } : null;
  return {
    eventName: scalar(proposal.eventName), venue: scalar(proposal.venue), address: scalar(proposal.address),
    sessions: proposal.sessions.map((fact) => ({ ...fact, evidence: evidence(fact.evidence) })),
    admission: proposal.admission.map((fact) => ({ ...fact, evidence: evidence(fact.evidence) })),
    childInclusiveCutoff: scalar(proposal.childInclusiveCutoff),
  };
}

async function modelMetadata(endpoint, model) {
  const metadata = { ollamaVersion: null, digest: null, sizeBytes: null, modifiedAt: null };
  try {
    const response = await fetch(`${endpoint}/api/version`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (response.ok) metadata.ollamaVersion = (await response.json()).version ?? null;
    const tags = await fetch(`${endpoint}/api/tags`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (tags.ok) {
      const entry = (await tags.json()).models?.find((item) => item.name === model || item.model === model);
      if (entry) Object.assign(metadata, { digest: entry.digest ?? null, sizeBytes: entry.size ?? null, modifiedAt: entry.modified_at ?? null });
    }
  } catch { /* Missing metadata is explicit; extraction still records actual invocation outcomes. */ }
  return metadata;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ['input', 'output', 'model', 'endpoint', 'timeout-ms', 'recheck']);
  if (!args.input) throw new Error('--input is required; keep source excerpts and expectations private.');
  const input = await readInput(args.input);
  const sources = validateSources(input);
  const expectations = input.expectations;
  if (!expectations || typeof expectations !== 'object' || Array.isArray(expectations) || sources.some((source) => !Object.hasOwn(expectations, source.id))) throw new Error('Every smoke source needs a private expectations[sourceId] object.');
  if (args.recheck) {
    const receipt = JSON.parse(await readFile(args.recheck, 'utf8'));
    const previousChecks = { checkedAt: receipt.fieldChecksUpdatedAt ?? receipt.runAt, summary: receipt.summary, cases: receipt.cases.map(({ id, status, fieldChecks }) => ({ id, status, fieldChecks })) };
    for (const source of sources) {
      const entry = receipt.cases.find((item) => item.id === source.id);
      if (!entry || entry.inputTextSha256 !== createHash('sha256').update(source.text).digest('hex')) throw new Error('Recheck requires identical private source text and existing source IDs.');
      entry.fieldChecks = checkFields(entry.acceptedProposal, expectations[source.id]);
      entry.status = entry.acceptedProposal && !entry.errors.length && entry.fieldChecks.every((check) => check.status === 'passed') ? 'passed' : 'failed';
    }
    receipt.previousCheckRevisions = [...(receipt.previousCheckRevisions ?? []), previousChecks];
    receipt.fieldChecksUpdatedAt = new Date().toISOString();
    receipt.boundaryChecks = boundaryChecks();
    receipt.summary.passed = receipt.cases.filter((item) => item.status === 'passed').length;
    receipt.summary.failed = receipt.cases.length - receipt.summary.passed;
    receipt.summary.evidenceValidated = receipt.cases.filter((item) => item.acceptedProposal !== null).length;
    receipt.summary.recheckInvokedModel = false;
    const destination = resolve(args.output ?? args.recheck);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    process.stdout.write(`${receipt.summary.passed}/${receipt.cases.length} recorded source cases passed tightened field checks; no model was invoked.\n`);
    if (receipt.summary.failed) process.exitCode = 1;
    return;
  }
  const model = args.model ?? DEFAULT_MODEL;
  const endpoint = localEndpoint(args.endpoint);
  const runAt = new Date().toISOString();
  const checks = boundaryChecks();
  const fencedResponse = await extractSource(sources[0], { endpoint, model, fetchImpl: async () => new Response(JSON.stringify({ done: true, message: { content: '```json\n{}\n```' } }), { status: 200 }) });
  assert.equal(fencedResponse.ok, false);
  checks.push({ name: 'non-JSON model boundaries rejected', status: 'passed' });
  const metadata = await modelMetadata(endpoint, model);
  const report = await compileSources(input, { model, endpoint, timeoutMs: args['timeout-ms'] ? Number(args['timeout-ms']) : undefined, onResult: (result) => process.stdout.write(`${result.source.id}: ${result.status} (${result.elapsedMs}ms)\n`) });
  const cases = report.results.map((result) => {
    const fieldChecks = checkFields(result.acceptedProposal, expectations[result.source.id]);
    const passed = result.ok && fieldChecks.every((check) => check.status === 'passed');
    return {
      id: result.source.id, eventId: result.source.eventId, url: result.source.url,
      status: passed ? 'passed' : 'failed', extractionStatus: result.status, reviewStatus: 'unreviewed',
      elapsedMs: result.elapsedMs, model: result.model, modelTiming: result.modelTiming ?? null,
      inputTextSha256: result.source.textSha256, sourceLineCount: result.source.lineCount,
      fieldChecks, errors: result.errors,
      evidenceChecks: result.evidence.map(({ path, ok, method, lineIds, warning, reason }) => ({ path, ok, ...(method ? { method, lineIds } : {}), ...(warning ? { warning } : {}), ...(reason ? { reason } : {}) })),
      acceptedProposal: publicProposal(result.acceptedProposal),
    };
  });
  const conflictChecks = (input.expectedConflicts ?? []).map((expected) => {
    const conflict = report.conflicts.find((item) => item.eventId === expected.eventId && item.field === expected.field);
    return { ...expected, status: conflict && expected.values.every((value) => conflict.observations.some((item) => item.value === value)) ? 'passed' : 'failed' };
  });
  const receipt = {
    pipelineVersion: report.pipelineVersion, model, runAt, ...metadata,
    localEndpoint: endpoint, settings: { think: false, temperature: 0, seed: 24, schemaConstrained: true },
    license: { name: 'Apache-2.0', modelCard: 'https://huggingface.co/Qwen/Qwen3.5-4B', checkedAt: '2026-10-13' },
    elapsedMs: report.elapsedMs, cases, conflicts: report.conflicts, boundaryChecks: checks, conflictChecks,
    summary: { sources: cases.length, passed: cases.filter((item) => item.status === 'passed').length, failed: cases.filter((item) => item.status === 'failed').length, sourceConflicts: report.conflicts.length, lineIdFallbackFacts: cases.reduce((count, item) => count + item.evidenceChecks.filter((fact) => fact.method === 'line_ids').length, 0) },
    limitations: [
      'This is one local run on short selected organizer excerpts, not a representative accuracy benchmark.',
      'Schema and exact evidence checks do not prove factual interpretation or completeness; curator review is required.',
      'The public receipt retains normalized proposed facts and validated line IDs; private source excerpts are not redistributed.',
      'Conflicting sources remain unresolved. No live monitoring, cancellation guarantee or consumer demand was tested.',
    ],
  };
  const output = resolve(args.output ?? 'artifacts/model-evidence.json');
  try {
    const prior = JSON.parse(await readFile(output, 'utf8'));
    if (prior.model && Array.isArray(prior.cases) && prior.runAt) {
      const { previousRuns = [], ...priorRun } = prior;
      receipt.previousRuns = [...previousRuns, priorRun];
    }
  } catch { /* A first run has no prior receipt. */ }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  process.stdout.write(`${receipt.summary.passed}/${cases.length} source cases passed required field/evidence checks; ${conflictChecks.filter((check) => check.status === 'passed').length}/${conflictChecks.length} expected conflicts detected.\n`);
  if (receipt.summary.failed || conflictChecks.some((check) => check.status === 'failed')) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
