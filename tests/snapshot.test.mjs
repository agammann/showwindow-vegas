import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planVisit } from '../src/lib/planner.ts';
import { generatePocketHtml, buildIcs } from '../src/lib/export.ts';

const shows = JSON.parse(fs.readFileSync(new URL('../src/data/events.json', import.meta.url), 'utf8'));
const base = { date: '2026-10-24', from: '10:00', until: '12:00', adults: 1, childAges: [10], budgetCents: 3000, goal: 'browse', categories: ['pokemon'], purchaseMode: 'advance' };
const plan = changes => planVisit(shows, { ...base, ...changes }, '2026-10-12');
const named = (result, showId, kind) => result.candidates.find(candidate => candidate.show.id === showId && candidate.session.kind === kind);

test('shipped default Front Row plan keeps GA/VIP hours and ticket fees separate', () => {
  const result = plan();
  assert.deepEqual(result.errors, []);
  const ga = named(result, 'front-row-october', 'general');
  const vip = named(result, 'front-row-october', 'vip');
  assert.ok(ga && vip);
  assert.equal(ga.usableMinutes, 60);
  assert.equal(ga.visitStart, '11:00');
  assert.equal(ga.cost.totalCents, 1079);
  assert.equal(ga.cost.feeCents, 79);
  assert.equal(vip.usableMinutes, 120);
  assert.equal(vip.visitStart, '10:00');
  assert.equal(vip.cost.totalCents, 2079);
  assert.equal(vip.cost.feeCents, 79);
  assert.equal(ga.canSave, true);
  assert.equal(vip.canSave, true);
});

test('shipped Front Row child cutoff changes the paid party and per-ticket fees at age 11', () => {
  const age10 = named(plan({ adults: 2, childAges: [10], budgetCents: 5000 }), 'front-row-october', 'general');
  const age11 = named(plan({ adults: 2, childAges: [11], budgetCents: 5000 }), 'front-row-october', 'general');
  assert.equal(age10.cost.paidPeople, 2);
  assert.equal(age10.cost.freeChildren, 1);
  assert.equal(age10.cost.totalCents, 2158);
  assert.equal(age10.cost.feeCents, 158);
  assert.equal(age11.cost.paidPeople, 3);
  assert.equal(age11.cost.freeChildren, 0);
  assert.equal(age11.cost.totalCents, 3237);
  assert.equal(age11.cost.feeCents, 237);
});

test('Genesis Saturday public trade is independently free and saveable with a zero budget', () => {
  const request = { ...base, date: '2026-12-05', from: '18:00', until: '20:00', adults: 2, goal: 'trade', categories: ['general'], budgetCents: 0 };
  const candidate = named(planVisit(shows, request, '2026-10-12'), 'genesis-december', 'trade');
  assert.ok(candidate);
  assert.equal(candidate.session.access, 'public-free');
  assert.equal(candidate.cost.totalCents, 0);
  assert.equal(candidate.usableMinutes, 120);
  assert.equal(candidate.status, 'fits');
  assert.equal(candidate.canSave, true);
  assert.ok(generatePocketHtml(candidate, request).includes('World Market Center'));
  assert.ok(buildIcs(candidate, request).includes('20261205T180000'));
});

test('Trading Card Fest remains visible but a TBA venue blocks every arrival export', () => {
  const request = { ...base, date: '2026-12-04', from: '16:00', until: '18:00', categories: ['general'], budgetCents: 10000 };
  const candidates = planVisit(shows, request, '2026-10-12').candidates.filter(candidate => candidate.show.id === 'trading-card-fest-december');
  assert.equal(candidates.length, 2);
  assert.equal(candidates.find(candidate => candidate.session.kind === 'general').usableMinutes, 90);
  assert.equal(candidates.find(candidate => candidate.session.kind === 'vip').usableMinutes, 120);
  for (const candidate of candidates) {
    assert.equal(candidate.show.venue.status, 'tba');
    assert.equal(candidate.status, 'needs-confirmation');
    assert.equal(candidate.canSave, false);
    assert.throws(() => generatePocketHtml(candidate, request), /confirmed, saveable/);
    assert.throws(() => buildIcs(candidate, request), /confirmed, saveable/);
  }
});

test('Next Level Sunday arrival after 16:00 guarantees zero minutes, with only 30 possible', () => {
  const request = { ...base, date: '2026-11-22', from: '16:15', until: '16:45', childAges: [], budgetCents: 10000 };
  const candidates = planVisit(shows, request, '2026-10-12').candidates.filter(candidate => candidate.show.id === 'next-level-november');
  assert.equal(candidates.length, 2);
  for (const candidate of candidates) {
    assert.equal(candidate.session.status, 'conflict');
    assert.equal(candidate.usableMinutes, 0);
    assert.equal(candidate.possibleMinutes, 30);
    assert.equal(candidate.status, 'needs-confirmation');
    assert.equal(candidate.canSave, false);
    assert.ok(candidate.issues.some(issue => issue.includes('closing times conflict')));
    assert.throws(() => buildIcs(candidate, request), /confirmed, saveable/);
  }
});

test('every shipped source reference resolves to a unique source for its show', () => {
  const showIds = new Set();
  for (const show of shows) {
    assert.ok(!showIds.has(show.id), `Duplicate show id ${show.id}`);
    showIds.add(show.id);
    const sourceIds = new Set(show.sources.map(source => source.id));
    assert.equal(sourceIds.size, show.sources.length, `Duplicate source in ${show.id}`);
    const references = [
      ...show.venue.sourceIds, ...show.parking.sourceIds,
      ...show.sessions.flatMap(session => session.sourceIds),
      ...show.tickets.flatMap(ticket => ticket.sourceIds),
      ...show.services.flatMap(service => service.sourceIds),
      ...show.conflicts.flatMap(conflict => conflict.claims.map(claim => claim.sourceId)),
    ];
    for (const id of references) assert.ok(sourceIds.has(id), `${show.id} has unresolved source ${id}`);
    for (const source of show.sources) {
      assert.ok(['https:', 'http:'].includes(new URL(source.url).protocol), `${show.id} has an unsafe source URL`);
      assert.ok(source.label.trim() && source.summary.trim(), `${show.id} source ${source.id} needs a label and summary`);
    }
    for (const session of show.sessions) assert.ok(session.sourceIds.length > 0, `${show.id} session ${session.id} has no source`);
  }
});

test('snapshot show dates, source dates and same-day session boundaries are internally valid', () => {
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  for (const show of shows) {
    assert.ok(validDate(show.dateStart) && validDate(show.dateEnd), `${show.id} date range is invalid`);
    assert.ok(show.dateStart <= show.dateEnd, `${show.id} ends before it starts`);
    assert.ok(show.dateStart >= '2026-10-13' && show.dateEnd <= '2026-12-31', `${show.id} is outside the curated window`);
    for (const source of show.sources) assert.ok(validDate(source.checkedAt), `${show.id} source check date is invalid`);
    const sessionIds = new Set();
    for (const session of show.sessions) {
      assert.ok(!sessionIds.has(session.id), `${show.id} has duplicate session ${session.id}`);
      sessionIds.add(session.id);
      assert.ok(validDate(session.date) && session.date >= show.dateStart && session.date <= show.dateEnd, `${show.id} session ${session.id} is outside its date range`);
      assert.ok(validTime(session.start) && validTime(session.end) && session.start < session.end, `${show.id} session ${session.id} has invalid hours`);
      if (session.alternativeEnd !== undefined) {
        assert.ok(validTime(session.alternativeEnd) && session.start < session.alternativeEnd, `${show.id} session ${session.id} has invalid disputed hours`);
        assert.equal(session.status, 'conflict', `${show.id} disputed session should be marked as a conflict`);
      }
    }
    for (const ticket of show.tickets) if (ticket.salesEndDate) assert.ok(validDate(ticket.salesEndDate), `${show.id} ticket ${ticket.id} has an invalid deadline`);
  }
});
