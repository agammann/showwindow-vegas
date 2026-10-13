import type { VisitCandidate, VisitRequest } from './types.ts';
import { formatDuration, formatMoney, formatTime, validateRequest } from './planner.ts';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function assertSaveable(candidate: VisitCandidate, request: VisitRequest): void {
  if (validateRequest(request).length || !candidate.canSave || candidate.status !== 'fits'
    || candidate.show.venue.status !== 'confirmed' || candidate.session.status !== 'confirmed'
    || candidate.cost.totalCents === null || candidate.usableMinutes <= 0 || candidate.session.date !== request.date
    || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(candidate.visitStart)
    || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(candidate.visitEnd) || candidate.visitEnd <= candidate.visitStart) {
    throw new Error('Only a confirmed, saveable visit can be exported.');
  }
}

function party(request: VisitRequest): string {
  return `${request.adults} ${request.adults === 1 ? 'adult' : 'adults'}${request.childAges.length ? `; child ages ${request.childAges.join(', ')}` : ''}`;
}

export function generatePocketHtml(candidate: VisitCandidate, request: VisitRequest): string {
  assertSaveable(candidate, request);
  const { show, session, cost } = candidate;
  const sourceRows = show.sources.map(source => {
    const url = safeUrl(source.url);
    return `<li><strong>${escapeHtml(source.label)}</strong> · ${escapeHtml(source.kind)}<br>${url ? `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(source.url)}</a>` : escapeHtml(source.url)}<br>Checked ${escapeHtml(source.checkedAt)}<br>${escapeHtml(source.summary)}</li>`;
  }).join('');
  const notes = [...candidate.reasons, ...candidate.issues, ...cost.notes, ...(session.note ? [session.note] : [])];
  const sessionLabel = session.kind === 'vip' ? 'VIP early entry' : session.kind === 'trade' ? 'Trade session' : 'General admission';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(show.name)} · Pocket plan</title>
<style>body{font:16px/1.55 system-ui,sans-serif;color:#18243c;background:#f0f7ff;margin:0;padding:28px}main{max-width:700px;margin:auto;background:white;border:1px solid #dce5f2;border-radius:8px;padding:30px}h1{font-size:30px;line-height:1.15;margin:8px 0 20px}h2{font-size:18px;margin-top:28px}p{margin:8px 0}dl{display:grid;grid-template-columns:130px 1fr;gap:8px 20px}dt{color:#596780}dd{margin:0;font-weight:600}a{color:#2455ef;overflow-wrap:anywhere}li{margin-bottom:14px}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#2455ef}.notice{background:#f0f7ff;padding:14px;border-radius:8px}footer{font-size:13px;color:#596780;margin-top:28px}@media(max-width:500px){body{padding:12px}main{padding:20px}dl{grid-template-columns:1fr;gap:2px}dd{margin-bottom:10px}}@media print{body{padding:0;background:white}main{border:0;padding:8px}a{color:inherit}li{break-inside:avoid}}</style></head><body><main>
<div class="eyebrow">ShowWindow · Las Vegas pocket plan</div><h1>${escapeHtml(show.name)}</h1>
<p class="notice">${escapeHtml(request.date)} · ${escapeHtml(formatTime(candidate.visitStart))}–${escapeHtml(formatTime(candidate.visitEnd))} · ${escapeHtml(formatDuration(candidate.usableMinutes))} usable</p>
<dl><dt>Session</dt><dd>${escapeHtml(sessionLabel)}</dd><dt>Party</dt><dd>${escapeHtml(party(request))}</dd><dt>Admission</dt><dd>${escapeHtml(formatMoney(cost.totalCents))} · ${escapeHtml(cost.rule?.label ?? 'Public-free session')}</dd><dt>Purchase mode</dt><dd>${escapeHtml(request.purchaseMode)}</dd><dt>Venue</dt><dd>${escapeHtml(show.venue.name)}</dd><dt>Address</dt><dd>${escapeHtml(show.venue.address)}</dd><dt>Parking</dt><dd>${escapeHtml(show.parking.note)}</dd></dl>
${show.venue.indoorDirections ? `<p>${escapeHtml(show.venue.indoorDirections)}</p>` : ''}
<h2>What this plan is based on</h2><ul>${notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
<h2>Check the organizer before leaving</h2><ul>${sourceRows}</ul>
<footer>Admission budget excludes travel, parking and card purchases. This plan is a saved research snapshot, not a ticket, reservation or guarantee of inventory. Changes announced after the sources were checked may affect your visit.</footer>
</main></body></html>`;
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let length = 0;
  let output = '';
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (length + bytes > 75) { output += '\r\n '; length = 1; }
    output += character;
    length += bytes;
  }
  return output;
}

function uid(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `${(hash >>> 0).toString(16)}@showwindow.local`;
}

export function buildIcs(candidate: VisitCandidate, request: VisitRequest): string {
  assertSaveable(candidate, request);
  const localTime = (value: string) => `${request.date.replace(/-/g, '')}T${value.replace(':', '')}00`;
  const source = candidate.show.sources.find(item => item.kind === 'organizer' && safeUrl(item.url))
    ?? candidate.show.sources.find(item => safeUrl(item.url));
  const description = [
    `${party(request)}. Admission: ${formatMoney(candidate.cost.totalCents)} (${candidate.cost.rule?.label ?? 'public-free session'}).`,
    ...candidate.reasons, ...candidate.issues, ...candidate.cost.notes,
    candidate.session.note ?? '',
    `Parking: ${candidate.show.parking.note}`,
    ...candidate.show.sources.map(item => `${item.label}; checked ${item.checkedAt}: ${safeUrl(item.url) ?? 'Source URL unavailable'}`),
    'Saved source snapshot. Confirm the organizer before leaving. This is not a ticket or an inventory guarantee.',
  ].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ShowWindow//Las Vegas Visit Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:America/Los_Angeles', 'X-LIC-LOCATION:America/Los_Angeles',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0800', 'TZOFFSETTO:-0700', 'TZNAME:PDT', 'DTSTART:20070311T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0800', 'TZNAME:PST', 'DTSTART:20071104T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VEVENT', `UID:${uid(`${candidate.id}|${request.date}|${candidate.visitStart}|${candidate.visitEnd}|${party(request)}`)}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `DTSTART;TZID=America/Los_Angeles:${localTime(candidate.visitStart)}`,
    `DTEND;TZID=America/Los_Angeles:${localTime(candidate.visitEnd)}`,
    `SUMMARY:${escapeIcs(`${candidate.show.name} · ${candidate.session.kind === 'vip' ? 'VIP' : candidate.session.kind === 'trade' ? 'Trade' : 'General admission'}`)}`,
    `LOCATION:${escapeIcs(`${candidate.show.venue.name}, ${candidate.show.venue.address}`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    ...(source ? [`URL:${safeUrl(source.url)}`] : []),
    'STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
