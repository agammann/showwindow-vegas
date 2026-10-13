import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePocketHtml, buildIcs } from '../src/lib/export.ts';
import { planVisit } from '../src/lib/planner.ts';

function fixture() {
  const request = { date: '2026-10-24', from: '12:00', until: '14:00', adults: 1, childAges: [10], budgetCents: 2000, goal: 'browse', categories: ['pokemon'], purchaseMode: 'door' };
  const show = {
    id: 'show', name: 'Vegas Card Show', organizer: 'Organizer', dateStart: '2026-10-24', dateEnd: '2026-10-24', categories: ['pokemon'], goals: ['browse'],
    venue: { name: 'Rio', address: '3700 W Flamingo Rd, Las Vegas', city: 'Las Vegas', status: 'confirmed', indoorDirections: 'Follow the organizer’s hall signs.', sourceIds: ['source'] },
    parking: { status: 'unknown', note: 'Parking terms not published.', sourceIds: [] },
    sessions: [{ id: 'ga', date: '2026-10-24', kind: 'general', start: '11:00', end: '17:00', sourceIds: ['source'], status: 'confirmed', access: 'ticket', note: 'General admission.' }],
    tickets: [{ id: 'ga-door', label: 'Door admission', sessionKinds: ['general'], adultCents: 1500, serviceFeeCents: 0, feeStatus: 'none', childrenFreeThrough: 10, childPolicyKnown: true, purchaseMode: 'door', coverage: 'day', sourceIds: ['source'] }],
    sources: [{ id: 'source', label: 'Organizer page', url: 'https://example.com/show', kind: 'organizer', checkedAt: '2026-10-12', summary: 'Confirmed date, venue and GA hours.' }], conflicts: [], services: [], notes: [],
  };
  const candidate = planVisit([show], request).candidates[0];
  return { request, candidate };
}
const unfold = text => text.replace(/\r\n[ \t]/g, '');

test('pocket plan contains the selected party, visit interval, price and source snapshot', () => {
  const { request, candidate } = fixture();
  const html = generatePocketHtml(candidate, request);
  for (const value of ['Vegas Card Show', '2026-10-24', '12:00 PM', '2:00 PM', '2h usable', '$15.00', 'child ages 10', 'Checked 2026-10-12', 'https://example.com/show', 'not a ticket']) assert.ok(html.includes(value), value);
});

test('all show, note, source and attribute strings are escaped in pocket HTML', () => {
  const { request, candidate } = fixture();
  const attack = `<img src=x onerror="alert('x')">&`;
  candidate.show.name = attack;
  candidate.show.venue.name = attack;
  candidate.show.venue.address = attack;
  candidate.show.venue.indoorDirections = attack;
  candidate.show.parking.note = attack;
  candidate.show.sources[0].label = attack;
  candidate.show.sources[0].summary = attack;
  candidate.show.sources[0].checkedAt = attack;
  candidate.show.sources[0].url = 'https://example.com/?x="&y=<tag>';
  candidate.reasons.push(attack);
  candidate.cost.notes.push(attack);
  candidate.cost.rule.label = attack;
  candidate.session.note = attack;
  const html = generatePocketHtml(candidate, request);
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<tag>'));
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'));
  assert.ok(html.includes('&amp;y='));
});

test('pocket HTML does not turn unsafe or credential-bearing source URLs into links', () => {
  const { request, candidate } = fixture();
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'https://user:password@example.com/show']) {
    candidate.show.sources[0].url = url;
    const html = generatePocketHtml(candidate, request);
    assert.ok(!html.includes('<a href='));
    assert.ok(!html.includes('<script>'));
  }
});

test('pocket and calendar exports reject unsaveable, conflicting and zero-duration visits', () => {
  for (const update of [candidate => { candidate.canSave = false; }, candidate => { candidate.show.venue.status = 'tba'; }, candidate => { candidate.session.status = 'conflict'; }, candidate => { candidate.cost.totalCents = null; }, candidate => { candidate.usableMinutes = 0; }, candidate => { candidate.visitEnd = candidate.visitStart; }]) {
    const { request, candidate } = fixture();
    update(candidate);
    assert.throws(() => generatePocketHtml(candidate, request), /confirmed, saveable/);
    assert.throws(() => buildIcs(candidate, request), /confirmed, saveable/);
  }
});

test('calendar uses the actual chosen visit window with the Las Vegas timezone and stable UID', () => {
  const { request, candidate } = fixture();
  const first = unfold(buildIcs(candidate, request));
  const second = unfold(buildIcs(candidate, request));
  assert.ok(first.includes('DTSTART;TZID=America/Los_Angeles:20261024T120000\r\n'));
  assert.ok(first.includes('DTEND;TZID=America/Los_Angeles:20261024T140000\r\n'));
  assert.ok(first.includes('BEGIN:VTIMEZONE'));
  assert.equal(first.match(/^UID:(.+)$/m)[1], second.match(/^UID:(.+)$/m)[1]);
  assert.equal(first.match(/BEGIN:VEVENT/g).length, 1);
  assert.ok(first.endsWith('END:VCALENDAR\r\n'));
});

test('calendar text escapes newlines, semicolons, commas and backslashes without property injection', () => {
  const { request, candidate } = fixture();
  candidate.show.name = 'Show, name; slash\\\nBEGIN:VEVENT\nURL:javascript:alert(1)';
  candidate.show.sources[0].url = 'javascript:alert(1)';
  const text = unfold(buildIcs(candidate, request));
  assert.ok(text.includes('SUMMARY:Show\\, name\\; slash\\\\\\nBEGIN:VEVENT\\nURL:javascript:alert(1)'));
  assert.equal(text.match(/^BEGIN:VEVENT$/gm).length, 1);
  assert.ok(!/^URL:javascript:/m.test(text));
  assert.ok(text.includes('Source URL unavailable'));
});

test('calendar folds long Unicode source details to at most 75 UTF-8 bytes per physical line', () => {
  const { request, candidate } = fixture();
  candidate.show.sources[0].label = 'Pokémon 🎴 '.repeat(30);
  const text = buildIcs(candidate, request);
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, line);
  assert.ok(unfold(text).includes(candidate.show.sources[0].label));
});
