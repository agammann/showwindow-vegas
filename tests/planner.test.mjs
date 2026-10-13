import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, planVisit, formatMoney, formatTime, formatDuration } from '../src/lib/planner.ts';

const request = changes => ({ date: '2026-10-24', from: '10:00', until: '12:00', adults: 2, childAges: [10], budgetCents: 5000, goal: 'browse', categories: ['pokemon'], purchaseMode: 'advance', ...changes });
const show = changes => ({
  id: 'front-row', name: 'Front Row', organizer: 'Front Row', dateStart: '2026-10-24', dateEnd: '2026-10-25', categories: ['pokemon', 'sports'], goals: ['browse', 'trade', 'grading'],
  venue: { name: 'Rio', address: '3700 W Flamingo Rd', city: 'Las Vegas', status: 'confirmed', sourceIds: ['official'] },
  parking: { status: 'unknown', note: 'Parking terms not published.', sourceIds: [] },
  sessions: [
    { id: 'ga', date: '2026-10-24', kind: 'general', start: '11:00', end: '17:00', sourceIds: ['official'], status: 'confirmed', access: 'ticket' },
    { id: 'vip', date: '2026-10-24', kind: 'vip', start: '10:00', end: '17:00', sourceIds: ['official'], status: 'confirmed', access: 'ticket' },
    { id: 'trade', date: '2026-10-24', kind: 'trade', start: '17:00', end: '21:00', sourceIds: ['official'], status: 'confirmed', access: 'attendees-only' },
  ],
  tickets: [
    { id: 'advance-ga', label: 'Advance GA', sessionKinds: ['general'], adultCents: 1000, serviceFeeCents: null, feeStatus: 'none', childrenFreeThrough: 10, childPolicyKnown: true, purchaseMode: 'advance', salesEndDate: '2026-10-23', coverage: 'day', sourceIds: ['official'] },
    { id: 'door-ga', label: 'Door GA', sessionKinds: ['general'], adultCents: 1500, serviceFeeCents: null, feeStatus: 'none', childrenFreeThrough: 10, childPolicyKnown: true, purchaseMode: 'door', coverage: 'day', sourceIds: ['official'] },
    { id: 'vip', label: 'Advance VIP', sessionKinds: ['vip'], adultCents: 2000, serviceFeeCents: null, feeStatus: 'none', childrenFreeThrough: 10, childPolicyKnown: true, purchaseMode: 'advance', coverage: 'day', sourceIds: ['official'] },
  ],
  sources: [{ id: 'official', label: 'Organizer', url: 'https://example.com/show', kind: 'organizer', checkedAt: '2026-10-12', summary: 'Published hours and admission.' }], conflicts: [], services: [{ label: 'Grading', detail: 'Submissions accepted', sourceIds: ['official'] }], notes: [], ...changes,
});
const ga = (result) => result.candidates.find(item => item.session.kind === 'general');
const clone = value => structuredClone(value);

test('request validation checks calendar dates, including leap years', () => {
  assert.deepEqual(validateRequest(request({ date: '2028-02-29' })), []);
  for (const date of ['2026-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '2026-1-01', '2026-10-24T00:00:00Z']) assert.ok(validateRequest(request({ date })).length);
});

test('request validation rejects malformed, zero-length and overnight windows', () => {
  for (const changes of [{ from: '9:00' }, { until: '24:00' }, { from: '12:00', until: '12:00' }, { from: '23:00', until: '01:00' }]) {
    assert.ok(validateRequest(request(changes)).length);
  }
});

test('request validation rejects signed, fractional and unsafe party or budget inputs', () => {
  for (const changes of [{ adults: 0 }, { adults: -1 }, { adults: 1.5 }, { adults: NaN }, { budgetCents: -1 }, { budgetCents: 1.2 }, { budgetCents: Infinity }, { budgetCents: Number.MAX_SAFE_INTEGER + 1 }]) assert.ok(validateRequest(request(changes)).length);
  assert.deepEqual(validateRequest(request({ budgetCents: 0 })), []);
});

test('request validation checks every child age and supported goal/category/mode', () => {
  for (const changes of [{ childAges: [-1] }, { childAges: [18] }, { childAges: [2.5] }, { childAges: ['10'] }, { childAges: Array(1) }, { categories: [] }, { categories: ['invented'] }, { goal: 'sell' }, { purchaseMode: 'free' }]) assert.ok(validateRequest(request(changes)).length);
  assert.deepEqual(validateRequest(request({ childAges: [0, 17] })), []);
  assert.ok(validateRequest(null).length);
});

test('invalid input produces errors without candidates', () => {
  const result = planVisit([show()], request({ until: '09:00' }));
  assert.ok(result.errors.length);
  assert.deepEqual(result.candidates, []);
  assert.ok(planVisit([show()], request(), '2026-02-30').errors.length);
});

test('inclusive child age cutoff changes the single-day party admission', () => {
  const age10 = ga(planVisit([show()], request()));
  const age11 = ga(planVisit([show()], request({ childAges: [11] })));
  assert.equal(age10.cost.totalCents, 2000);
  assert.equal(age10.cost.paidPeople, 2);
  assert.equal(age10.cost.freeChildren, 1);
  assert.equal(age11.cost.totalCents, 3000);
  assert.equal(age11.cost.paidPeople, 3);
  assert.equal(age11.cost.freeChildren, 0);
});

test('known fees apply per paid ticket, including paid children', () => {
  const fixture = show();
  fixture.tickets[0] = { ...fixture.tickets[0], feeStatus: 'known', serviceFeeCents: 13 };
  const candidate = ga(planVisit([fixture], request({ childAges: [10, 11] })));
  assert.equal(candidate.cost.totalCents, 3039);
  assert.equal(candidate.cost.feeCents, 39);
  assert.equal(candidate.cost.paidPeople, 3);
  assert.equal(candidate.status, 'fits');
});

test('GA and VIP have separate usable hours and ticket costs', () => {
  const result = planVisit([show()], request());
  assert.equal(ga(result).usableMinutes, 60);
  assert.equal(ga(result).visitStart, '11:00');
  const vip = result.candidates.find(item => item.session.kind === 'vip');
  assert.equal(vip.usableMinutes, 120);
  assert.equal(vip.visitStart, '10:00');
  assert.equal(vip.cost.totalCents, 4000);
  assert.ok(vip.reasons.some(reason => reason.includes('early-entry ticket')));
});

test('expired advance sales are not silently replaced by door admission', () => {
  const before = ga(planVisit([show()], request(), '2026-10-23'));
  const after = ga(planVisit([show()], request(), '2026-10-24'));
  assert.equal(before.cost.totalCents, 2000);
  assert.equal(after.cost.totalCents, null);
  assert.equal(after.status, 'needs-confirmation');
  assert.equal(after.canSave, false);
  const door = ga(planVisit([show()], request({ purchaseMode: 'door' }), '2026-10-24'));
  assert.equal(door.cost.totalCents, 3000);
  assert.equal(door.status, 'fits');
});

test('advance viability uses the provided purchase date, not the future visit date', () => {
  assert.equal(ga(planVisit([show()], request(), '2026-10-12')).cost.totalCents, 2000);
  assert.equal(ga(planVisit([show()], request())).cost.totalCents, 2000);
});

test('either purchase-mode rule works for a door request', () => {
  const fixture = show();
  fixture.tickets = [{ ...fixture.tickets[0], purchaseMode: 'either', salesEndDate: undefined }];
  assert.equal(ga(planVisit([fixture], request({ purchaseMode: 'door' }))).cost.totalCents, 2000);
});

test('unknown fees retain a minimum without claiming a budget fit or export', () => {
  const fixture = show();
  fixture.tickets[0].feeStatus = 'unknown';
  const candidate = ga(planVisit([fixture], request()));
  assert.equal(candidate.cost.minimumCents, 2000);
  assert.equal(candidate.cost.totalCents, null);
  assert.equal(candidate.cost.feeCents, null);
  assert.equal(candidate.status, 'needs-confirmation');
  assert.equal(candidate.canSave, false);
});

test('unknown child policy preserves the adult minimum and unknown paid count', () => {
  const fixture = show();
  fixture.tickets[0].childPolicyKnown = false;
  const candidate = ga(planVisit([fixture], request()));
  assert.equal(candidate.cost.minimumCents, 2000);
  assert.equal(candidate.cost.totalCents, null);
  assert.equal(candidate.cost.paidPeople, null);
  assert.equal(candidate.cost.freeChildren, 0);
  assert.equal(candidate.status, 'needs-confirmation');
  const adultsOnly = ga(planVisit([fixture], request({ childAges: [] })));
  assert.equal(adultsOnly.cost.totalCents, 2000);
});

test('unpublished or invalid admission prices remain unknown', () => {
  for (const adultCents of [null, -500, 2.3]) {
    const fixture = show();
    fixture.tickets[0].adultCents = adultCents;
    const candidate = ga(planVisit([fixture], request()));
    assert.equal(candidate.cost.minimumCents, null);
    assert.equal(candidate.status, 'needs-confirmation');
    assert.equal(candidate.canSave, false);
  }
});

test('minimum above budget is over-budget even when fees remain unknown', () => {
  const fixture = show();
  fixture.tickets[0].feeStatus = 'unknown';
  const candidate = ga(planVisit([fixture], request({ budgetCents: 1999 })));
  assert.equal(candidate.status, 'over-budget');
  assert.equal(candidate.canSave, false);
  assert.ok(candidate.issues.some(issue => issue.includes('exceeds')));
});

test('only an explicitly public-free session can claim free public admission', () => {
  const fixture = show();
  fixture.sessions[2].access = 'public-free';
  const candidate = planVisit([fixture], request({ from: '18:00', until: '20:00', goal: 'trade', budgetCents: 0 })).candidates[0];
  assert.equal(candidate.cost.totalCents, 0);
  assert.equal(candidate.status, 'fits');
  assert.equal(candidate.canSave, true);
});

test('attendee-only trade requires confirmation of prior admission and is not public-free', () => {
  const candidate = planVisit([show()], request({ from: '18:00', until: '20:00', goal: 'trade' })).candidates[0];
  assert.equal(candidate.cost.minimumCents, 2000);
  assert.equal(candidate.status, 'needs-confirmation');
  assert.equal(candidate.canSave, false);
  assert.ok(candidate.issues.some(issue => issue.includes('not confirmed free')));
});

test('goal matching permits general trading but excludes unadvertised grading and browse-only trade sessions', () => {
  const fixture = show({ goals: ['browse', 'trade'] });
  assert.deepEqual(planVisit([fixture], request({ goal: 'grading' })).candidates, []);
  const trade = planVisit([fixture], request({ goal: 'trade' }));
  assert.deepEqual(trade.candidates.map(item => item.session.kind), ['general']);
  assert.deepEqual(planVisit([fixture], request({ from: '18:00', until: '20:00' })).candidates, []);
});

test('conflicting closing times use the earliest end, including late arrival with zero conservative time', () => {
  const fixture = show();
  fixture.sessions = [{ ...fixture.sessions[0], end: '17:00', alternativeEnd: '22:00', status: 'conflict' }];
  const early = planVisit([fixture], request({ from: '16:00', until: '20:00' })).candidates[0];
  assert.equal(early.usableMinutes, 60);
  assert.equal(early.possibleMinutes, 240);
  assert.equal(early.visitEnd, '17:00');
  const late = planVisit([fixture], request({ from: '20:00', until: '21:00' })).candidates[0];
  assert.equal(late.usableMinutes, 0);
  assert.equal(late.possibleMinutes, 60);
  assert.equal(late.visitStart, late.visitEnd);
  assert.equal(late.status, 'needs-confirmation');
  assert.equal(late.canSave, false);
});

test('TBA and conflicted venues retain announced matching candidates without export', () => {
  for (const status of ['tba', 'conflict']) {
    const fixture = show();
    fixture.venue.status = status;
    const candidate = ga(planVisit([fixture], request()));
    assert.ok(candidate);
    assert.equal(candidate.status, 'needs-confirmation');
    assert.equal(candidate.canSave, false);
  }
});

test('date, categories, goal and nonoverlapping windows produce explicit no-fit reasons', () => {
  for (const changes of [{ date: '2026-10-26' }, { categories: ['magic'] }, { from: '08:00', until: '09:00' }]) {
    const result = planVisit([show()], request(changes));
    assert.deepEqual(result.candidates, []);
    assert.equal(result.skipped.length, 1);
  }
  assert.deepEqual(planVisit([show({ categories: ['general'] })], request()).candidates, []);
});

test('blocking conflicts prevent saving; notice conflicts remain visible', () => {
  const conflict = { id: 'venue-note', field: 'venue', summary: 'Another directory has an older venue.', claims: [], severity: 'notice' };
  const notice = ga(planVisit([show({ conflicts: [conflict] })], request()));
  assert.equal(notice.canSave, true);
  assert.ok(notice.issues.includes(conflict.summary));
  const blocking = ga(planVisit([show({ conflicts: [{ ...conflict, severity: 'blocking' }] })], request()));
  assert.equal(blocking.canSave, false);
});

test('planner does not mutate inputs, and known-fit options sort ahead of uncertain options', () => {
  const fixture = show();
  fixture.tickets[2].feeStatus = 'unknown';
  const original = clone(fixture);
  const input = request();
  const originalRequest = clone(input);
  const result = planVisit([fixture], input);
  assert.equal(result.candidates[0].session.kind, 'general');
  assert.deepEqual(fixture, original);
  assert.deepEqual(input, originalRequest);
});

test('formatters handle money, wall time and duration without inventing missing values', () => {
  assert.equal(formatMoney(3039), '$30.39');
  assert.equal(formatMoney(null), 'Not published');
  assert.equal(formatTime('00:05'), '12:05 AM');
  assert.equal(formatTime('12:00'), '12:00 PM');
  assert.equal(formatTime('24:00'), 'Time not published');
  assert.equal(formatDuration(125), '2h 5m');
  assert.equal(formatDuration(60), '1h');
  assert.equal(formatDuration(0), '0m');
});
