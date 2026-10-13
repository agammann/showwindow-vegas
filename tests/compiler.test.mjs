import test from 'node:test';
import assert from 'node:assert/strict';
import { localEndpoint, validateSources, validateEvidence, extractSource } from '../scripts/compile-sources.mjs';

const source = changes => ({ id: 'official-page', eventId: 'vegas-show', url: 'https://example.com/show', text: 'Published show hours.', ...changes });

test('compiler accepts canonical literal loopback HTTP(S) origins only', () => {
  assert.equal(localEndpoint(), 'http://127.0.0.1:11434');
  assert.equal(localEndpoint('http://127.0.0.1:11434/'), 'http://127.0.0.1:11434');
  assert.equal(localEndpoint('https://[::1]:11434/'), 'https://[::1]:11434');
  for (const endpoint of ['https://example.com', 'http://localhost:11434', 'http://127.0.0.1.example.com:11434', 'ftp://127.0.0.1:11434']) {
    assert.throws(() => localEndpoint(endpoint), undefined, endpoint);
  }
});

test('compiler model endpoint rejects credentials, paths, queries and fragments', () => {
  for (const endpoint of ['http://user:password@127.0.0.1:11434', 'http://127.0.0.1:11434/api/chat', 'http://127.0.0.1:11434/?token=private', 'http://127.0.0.1:11434/#fragment']) {
    assert.throws(() => localEndpoint(endpoint), undefined, endpoint);
  }
});

test('noncanonical numeric loopback aliases do not satisfy the literal-host contract', () => {
  for (const endpoint of ['http://127.1:11434', 'http://2130706433:11434', 'http://0x7f000001:11434']) {
    assert.throws(() => localEndpoint(endpoint), undefined, endpoint);
  }
});

test('source input must contain a bounded nonempty collection', () => {
  for (const input of [undefined, {}, [], { sources: [] }, 'source', Array.from({ length: 41 }, (_, index) => source({ id: `source-${index}` }))]) {
    assert.throws(() => validateSources(input));
  }
});

test('source IDs must be unique strings with stable supported characters', () => {
  assert.throws(() => validateSources([source(), source({ url: 'https://example.com/other' })]), /Duplicate source id/);
  for (const id of ['', '../source', 'source name', '<source>', 'x'.repeat(101), 123, null]) {
    assert.throws(() => validateSources([source({ id })]), undefined, String(id));
  }
  assert.throws(() => validateSources([source({ eventId: '../event' })]), /eventId/);
});

test('source validation rejects unusable URLs and absent or oversized source text', () => {
  for (const changes of [{ url: 'javascript:alert(1)' }, { url: 'https://user:password@example.com/show' }, { url: 'not a URL' }, { text: '' }, { text: '  \n ' }, { text: 123 }, { text: 'x'.repeat(50001) }]) {
    assert.throws(() => validateSources([source(changes)]));
  }
});

test('validated source input normalizes newlines and preserves source/event identity', () => {
  const result = validateSources({ sources: [source({ text: 'Saturday\r\nSunday\rMonday' })] });
  assert.deepEqual(result, [{ id: 'official-page', eventId: 'vegas-show', url: 'https://example.com/show', text: 'Saturday\nSunday\nMonday' }]);
  assert.equal(validateSources([{ id: 'same-event', url: 'https://example.com', text: 'Hours' }])[0].eventId, 'same-event');
});

test('repeated exact quote can match a later source line rather than only its first occurrence', () => {
  const result = validateEvidence({ quote: 'Same hours', lineIds: ['L3'] }, 'Same hours\nSunday\nSame hours');
  assert.equal(result.ok, true);
  assert.equal(result.method, 'exact_quote');
  assert.deepEqual(result.lineIds, ['L3']);
  assert.equal(result.quote, 'Same hours');
});

test('an exact quote paired with another valid line is rejected', () => {
  const result = validateEvidence({ quote: 'Actual hours', lineIds: ['L2'] }, 'Actual hours\nOther detail');
  assert.equal(result.ok, false);
  assert.match(result.reason, /do not match/);
});

test('valid source-line fallback discards a nonexact quotation and retains review warning', () => {
  const result = validateEvidence({ quote: 'Reworded hours', lineIds: ['L1'] }, 'Actual published hours');
  assert.equal(result.ok, true);
  assert.equal(result.method, 'line_ids');
  assert.equal(result.quote, '');
  assert.deepEqual(result.lineIds, ['L1']);
  assert.match(result.warning, /discarded.*review/);
  for (const lineIds of [['L9'], ['L2']]) {
    assert.equal(validateEvidence({ quote: '', lineIds }, 'Actual published hours\n').ok, false);
  }
});

test('non-JSON server response is rejected using only mocked local fetch', async () => {
  let calls = 0;
  const result = await extractSource(source(), {
    endpoint: 'http://127.0.0.1:11434',
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, 'http://127.0.0.1:11434/api/chat');
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      return new Response('invalid server response', { status: 200 });
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'rejected');
  assert.equal(result.ok, false);
  assert.equal(result.acceptedProposal, null);
  assert.deepEqual(result.evidence, []);
  assert.ok(result.errors.some(error => error.includes('not JSON')));
  assert.ok(!JSON.stringify(result).includes('invalid server response'));
});

test('non-JSON model content is rejected without schema-dependent fixtures', async () => {
  const result = await extractSource(source(), {
    fetchImpl: async () => new Response(JSON.stringify({ done: true, message: { content: 'Here is the answer: no JSON object.' } }), { status: 200 }),
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.acceptedProposal, null);
  assert.ok(result.errors.some(error => error.includes('JSON object')));
  assert.ok(!JSON.stringify(result).includes('Here is the answer'));
});
