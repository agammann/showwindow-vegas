import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import events from './data/events';
import { planVisit, formatMoney, formatTime, formatDuration } from './lib/planner';
import { generatePocketHtml, buildIcs } from './lib/export';
import type { CardShow, Category, VisitCandidate, VisitRequest } from './lib/types';

const labels: Record<Category, string> = { pokemon: 'Pokémon', sports: 'Sports', magic: 'Magic', 'one-piece': 'One Piece', yugioh: 'Yu-Gi-Oh!', lorcana: 'Lorcana', general: 'Other / mixed cards' };
const allCategories = Object.keys(labels) as Category[];
const initial: VisitRequest = { date: '2026-10-24', from: '10:00', until: '12:00', adults: 1, childAges: [10], budgetCents: 3000, goal: 'browse', categories: ['pokemon'], purchaseMode: 'advance' };
const shortDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const longDate = (date: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const purchaseDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const kindLabel = (kind: string) => kind === 'vip' ? 'VIP entry' : kind === 'trade' ? 'Trade session' : 'General admission';
const durationWords = (n: number) => n === 60 ? '1 usable hour' : n > 0 && n % 60 === 0 ? `${n / 60} usable hours` : `${formatDuration(n)} usable`;

function Icon({ name }: { name: 'pin' | 'car' | 'clock' | 'file' | 'arrow' | 'external' }) {
  const paths = { pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>, car: <><path d="m4 10 2-6h12l2 6M3 10h18v8H3zM6 18v3m12-3v3" /><path d="M6 13h2m8 0h2" /></>, clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>, file: <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6" /></>, arrow: <path d="m9 5 7 7-7 7" />, external: <><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" /></> };
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function External({ href, children }: { href: string; children: ReactNode }) { return <a href={href} target="_blank" rel="noopener noreferrer">{children} <Icon name="external" /></a>; }

function download(content: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function Timeline({ candidate, request }: { candidate: VisitCandidate; request: VisitRequest }) {
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const total = minutes(request.until) - minutes(request.from);
  const left = Math.max(0, (minutes(candidate.visitStart) - minutes(request.from)) / total * 100);
  const width = Math.max(0, candidate.usableMinutes / total * 100);
  return <div className="timeline" aria-label={`${durationWords(candidate.usableMinutes)} between ${formatTime(candidate.visitStart)} and ${formatTime(candidate.visitEnd)}`}>
    <div className="time-labels"><span>{formatTime(request.from)}</span><span>{formatTime(request.until)}</span></div>
    <div className="time-track"><div className="time-fill" style={{ left: `${left}%`, width: `${width}%` }} /></div>
    <div className="time-key"><span>{left > 0 ? `Doors open ${formatTime(candidate.session.start)}` : 'Published session'}</span><span>{candidate.usableMinutes > 0 ? 'Your visit' : 'Hours need confirmation'}</span></div>
  </div>;
}

function TicketDetails({ candidate }: { candidate: VisitCandidate }) {
  const { cost, show } = candidate;
  return <details className="ticket-details"><summary>See the ticket rules</summary>
    <div className="detail-content"><strong>{cost.rule?.label ?? (candidate.session.access === 'public-free' ? 'Free public session' : 'Admission needs confirmation')}</strong>
      {cost.rule && <p>Adult ticket {formatMoney(cost.rule.adultCents)} · {cost.rule.feeStatus === 'unknown' ? 'Fees not published' : `${formatMoney(cost.rule.serviceFeeCents ?? 0)} fee per paid ticket`}. {cost.rule.childPolicyKnown && cost.rule.childrenFreeThrough !== null ? `Children ${cost.rule.childrenFreeThrough} and under enter free with an adult.` : 'No child discount is assumed.'}</p>}
      {cost.rule?.salesEndDate && <p>Advance sales end {shortDate(cost.rule.salesEndDate)}. This plan uses today’s purchase date: {purchaseDate}.</p>}
      <ul>{cost.notes.map(note => <li key={note}>{note}</li>)}</ul>
      <div className="source-links">{show.sources.filter(s => cost.rule?.sourceIds.includes(s.id) || candidate.session.sourceIds.includes(s.id)).map(s => <External key={s.id} href={s.url}>{s.label}</External>)}</div>
    </div>
  </details>;
}

function VisitResult({ candidate, alternatives, request, choose, openSources }: { candidate: VisitCandidate; alternatives: VisitCandidate[]; request: VisitRequest; choose: (id: string) => void; openSources: () => void }) {
  const [saved, setSaved] = useState(false);
  const { show, session, cost } = candidate;
  const sameShow = alternatives.filter(c => c.show.id === show.id);
  const tradeSession = show.sessions.find(s => s.date === request.date && s.kind === 'trade');
  const party = `${request.adults} ${request.adults === 1 ? 'adult' : 'adults'}${request.childAges.length ? ` + ${request.childAges.length === 1 ? `${[8, 11].includes(request.childAges[0]) ? 'an' : 'a'} ${request.childAges[0]}-year-old` : `children aged ${request.childAges.join(', ')}`}` : ''}`;
  const save = () => { download(generatePocketHtml(candidate, request), `showwindow-${request.date}-${show.id}.html`, 'text/html;charset=utf-8'); setSaved(true); };
  return <article className="visit-result" aria-labelledby="result-title">
    <h2 id="result-title">Your window at {show.organizer === 'Front Row Card Show' ? 'Front Row' : show.organizer}</h2>
    <p className="result-location">{show.venue.name} · {shortDate(request.date)}</p>
    {sameShow.length > 1 && <div className="session-tabs" role="group" aria-label="Session options">{[...sameShow].sort((a, b) => ['general', 'vip', 'trade'].indexOf(a.session.kind) - ['general', 'vip', 'trade'].indexOf(b.session.kind)).map(c => <button key={c.id} aria-pressed={c.id === candidate.id} onClick={() => choose(c.id)}>{kindLabel(c.session.kind)}</button>)}</div>}
    <div className={`window-panel ${candidate.status !== 'fits' ? 'uncertain' : ''}`}>
      <div className="window-metrics"><div><strong>{durationWords(candidate.usableMinutes)}</strong><span>{candidate.usableMinutes ? `${formatTime(candidate.visitStart)} – ${formatTime(candidate.visitEnd)}` : `Up to ${formatDuration(candidate.possibleMinutes)} may be possible`}</span></div><div className="price"><strong>{cost.totalCents !== null ? formatMoney(cost.totalCents) : cost.minimumCents !== null ? `${formatMoney(cost.minimumCents)}+` : 'Unknown'}</strong><span>{cost.totalCents !== null ? 'Party admission total' : 'Admission needs confirmation'}</span>{cost.rule && <small className="price-rule">{cost.rule.label}</small>}</div></div>
      <Timeline candidate={candidate} request={request} />
      <p className="door-note">{session.kind === 'vip' ? 'VIP doors' : session.kind === 'trade' ? 'Trade session' : 'General doors'} {session.kind === 'trade' ? 'starts' : 'open'} at {formatTime(session.start)}.</p>
      <div className="result-actions"><div><p className="party-note">{party}{cost.freeChildren ? ` · ${cost.freeChildren === 1 ? 'Child admission free' : `${cost.freeChildren} children free`}` : ''}</p><TicketDetails candidate={candidate} /></div><button className="primary" onClick={save} disabled={!candidate.canSave}>Save arrival plan</button></div>
      {candidate.status !== 'fits' && <div className="confirmation-note"><strong>{candidate.status === 'over-budget' ? 'Over your admission budget' : 'Confirm before you travel'}</strong><ul>{candidate.issues.map(issue => <li key={issue}>{issue}</li>)}</ul><p>Saving is available when the session, destination and party admission total are confirmed.</p></div>}
      {saved && candidate.canSave && <div className="saved-message" role="status">Your pocket plan was downloaded. Open the HTML file on your phone or print it. <button className="text-button" onClick={() => download(buildIcs(candidate, request), `showwindow-${request.date}.ics`, 'text/calendar;charset=utf-8')}>Download calendar event</button></div>}
    </div>
    {sameShow.filter(c => c.id !== candidate.id).map(c => <button className="comparison-row" key={c.id} onClick={() => choose(c.id)}><span><strong>{c.session.kind === 'vip' && c.usableMinutes > candidate.usableMinutes ? `VIP gives you ${formatDuration(c.usableMinutes - candidate.usableMinutes)} more` : `${kindLabel(c.session.kind)} · ${durationWords(c.usableMinutes)}`}</strong><small>{formatTime(c.visitStart)} – {formatTime(c.visitEnd)} · {c.cost.totalCents !== null ? formatMoney(c.cost.totalCents) : 'Total unconfirmed'}</small></span><Icon name="arrow" /></button>)}
    <section className="before-you-go"><h3>Know before you go</h3><div className="logistics"><div><Icon name="pin" /><p><strong>{show.venue.name}</strong><span>{show.venue.address || 'Venue TBA'}</span>{show.venue.indoorDirections && <span>{show.venue.indoorDirections}</span>}{show.venue.status === 'confirmed' && <External href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${show.venue.name} ${show.venue.address}`)}`}>Open directions</External>}</p></div><div><Icon name="car" /><p><strong>{show.parking.status === 'free' ? 'Free parking' : show.parking.status === 'paid' ? 'Paid parking' : 'Parking unconfirmed'}</strong><span>{show.parking.note}</span></p></div><div><Icon name="clock" /><p><strong>{tradeSession ? 'Trade session' : kindLabel(session.kind)}</strong><span>{tradeSession ? `${formatTime(tradeSession.start)} – ${formatTime(tradeSession.end)}` : `${formatTime(session.start)} – ${formatTime(session.end)}`}</span>{tradeSession?.access === 'attendees-only' && <span>For show attendees; confirm access.</span>}</p></div></div>
      {show.services.length > 0 && <details className="service-details"><summary>Advertised services & collecting goal</summary><ul>{show.services.map(service => <li key={service.label}><strong>{service.label}</strong> — {service.detail}</li>)}</ul></details>}
    </section>
    <button className="provenance" onClick={openSources}><Icon name="file" /><span>Reviewed organizer information · <em>Sources and limitations</em></span></button>
  </article>;
}

function VisitForm({ value, submit }: { value: VisitRequest; submit: (request: VisitRequest) => void }) {
  const [draft, setDraft] = useState(value);
  const [ages, setAges] = useState(value.childAges.join(', '));
  const [budget, setBudget] = useState((value.budgetCents / 100).toString());
  const [errors, setErrors] = useState<string[]>([]);
  const field = <K extends keyof VisitRequest>(key: K, next: VisitRequest[K]) => setDraft(d => ({ ...d, [key]: next }));
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const localErrors: string[] = [];
    if (ages.trim() && !/^\d{1,2}(\s*,\s*\d{1,2})*$/.test(ages.trim())) localErrors.push('Separate child ages with commas, for example 7, 10.');
    if (!/^\d+(\.\d{1,2})?$/.test(budget)) localErrors.push('Enter an admission budget with no more than two decimal places.');
    const request = { ...draft, childAges: ages.trim() ? ages.split(',').map(n => Number(n.trim())) : [], budgetCents: Math.round(Number(budget) * 100) };
    const validated = planVisit(events, request, purchaseDate).errors;
    setErrors([...localErrors, ...validated]);
    if (!localErrors.length && !validated.length) submit(request);
  }
  return <form className="visit-form" onSubmit={onSubmit} noValidate><h2>Your visit</h2>
    <label>Date<input type="date" value={draft.date} onChange={e => field('date', e.target.value)} required /></label>
    <div className="form-pair"><label>From<input type="time" value={draft.from} onChange={e => field('from', e.target.value)} required /></label><label>Until<input type="time" value={draft.until} onChange={e => field('until', e.target.value)} required /></label></div>
    <div className="form-pair"><label>Adults<input type="number" value={draft.adults} min="1" step="1" onChange={e => field('adults', Number(e.target.value))} required /></label><label>Child ages<input type="text" inputMode="numeric" value={ages} onChange={e => setAges(e.target.value)} placeholder="None" aria-describedby="ages-help" /></label></div>
    <p className="field-help" id="ages-help">Ages 0–17, separated by commas. Leave empty for adults only.</p>
    <label>Admission budget<div className="money-input"><span>$</span><input aria-label="Admission budget" type="text" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} required /></div></label>
    <label>Goal<select value={draft.goal} onChange={e => field('goal', e.target.value as VisitRequest['goal'])}><option value="browse">Browse</option><option value="trade">Trade</option><option value="grading">Grading submissions</option></select></label>
    <fieldset><legend>What are you most interested in?</legend><div className="interest-options">{(['pokemon', 'sports', 'magic', 'one-piece'] as Category[]).map(category => <button type="button" key={category} aria-pressed={draft.categories.includes(category)} onClick={() => field('categories', draft.categories.includes(category) ? draft.categories.filter(c => c !== category) : [...draft.categories, category])}>{labels[category]}</button>)}</div><details className="more-interests"><summary>More interests</summary><div className="interest-options">{(['yugioh', 'lorcana', 'general'] as Category[]).map(category => <button type="button" key={category} aria-pressed={draft.categories.includes(category)} onClick={() => field('categories', draft.categories.includes(category) ? draft.categories.filter(c => c !== category) : [...draft.categories, category])}>{labels[category]}</button>)}</div></details></fieldset>
    <label className="purchase-label">Ticket purchase<select value={draft.purchaseMode} onChange={e => field('purchaseMode', e.target.value as VisitRequest['purchaseMode'])}><option value="advance">Advance · buying today</option><option value="door">At the door</option></select></label>
    {errors.length > 0 && <div className="form-errors" role="alert"><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <button className="primary find-button" type="submit">Find my window</button>
  </form>;
}

function AllShows({ selectShow }: { selectShow: (show: CardShow) => void }) {
  const [query, setQuery] = useState('');
  const shown = events.filter(show => `${show.name} ${show.venue.name} ${show.venue.city}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="page-intro"><h1>Find your next card day.</h1><p>Las Vegas metro · October–December 2026</p></div><div className="directory-toolbar"><p>{events.length} reviewed show listings · Updated October 12, 2026</p><label>Search shows or venues<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try Rio or Santa Fe" /></label></div>
    <div className="show-directory">{shown.map(show => <article className="show-row" key={show.id}><div className="date-block"><strong>{new Date(`${show.dateStart}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</strong><span>{show.dateStart.slice(-2)}{show.dateEnd !== show.dateStart ? `–${show.dateEnd.slice(-2)}` : ''}</span></div><div className="show-description"><h2>{show.name}</h2><p>{show.venue.name} · {show.venue.city}</p><p className="muted">{show.categories.map(c => labels[c]).join(' · ')}</p><span className={show.conflicts.length || show.venue.status !== 'confirmed' || show.tickets.every(t => t.adultCents === null) ? 'status-note' : 'status-note clear'}>{show.venue.status === 'tba' ? 'Venue TBA' : show.conflicts.length ? 'Sources need attention' : show.tickets.every(t => t.adultCents === null) ? 'Admission not published' : 'Reviewed organizer sources'}</span></div><button className="outline" onClick={() => selectShow(show)}>Plan a visit <Icon name="arrow" /></button></article>)}{!shown.length && <p className="empty-state">No reviewed listing matches that search.</p>}</div><p className="directory-limit">This is a curated research snapshot, not a complete or live event feed. Dates and ticket terms can change. Each plan links to the organizer so you can check before leaving.</p></>;
}

function Sources({ selected, setSelected }: { selected: string; setSelected: (id: string) => void }) {
  const shown = selected === 'all' ? events : events.filter(show => show.id === selected);
  return <><div className="page-intro"><h1>A useful plan has receipts.</h1><p>Every hour, price and destination should be something you can check.</p></div><section className="source-method"><div><h2>From organizer text to a reviewed plan</h2><p>Qwen3.5-4B, an open model running locally, proposes structured facts from individual organizer and ticket pages. A curator checks the proposal against each source. Code then calculates your time overlap and party admission; the model never decides whether a visit fits your budget.</p><p>The demo uses a reviewed snapshot: accepted model fields and facts checked directly against organizers. The model execution receipt records partial extractions and rejected proposals.</p><p>When sources disagree, ShowWindow keeps the disagreement visible. Unknown fees, uncertain hours and TBA venues block a saved arrival plan.</p><External href="https://github.com/agammann/showwindow-vegas/blob/main/docs/open-model-pipeline.md">Read the model pipeline & actual run evidence</External></div><aside><strong>Snapshot limits</strong><ul><li>Reviewed October 12, 2026.</li><li>Las Vegas metro, through December 2026.</li><li>No live availability or guaranteed inventory.</li><li>Admission budget excludes parking, travel and card purchases.</li><li>Plans are research, not tickets or reservations.</li></ul></aside></section>
    <label className="source-filter">Show sources<select value={selected} onChange={e => setSelected(e.target.value)}><option value="all">All reviewed shows</option>{events.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}</select></label>
    {shown.map(show => <section key={show.id} className="show-sources"><h2>{show.name}</h2>{show.conflicts.map(conflict => <div className="source-conflict" key={conflict.id}><strong>{conflict.summary}</strong><ul>{conflict.claims.map((claim, index) => <li key={index}>{show.sources.find(s => s.id === claim.sourceId)?.label}: {claim.text}</li>)}</ul></div>)}<div className="source-table">{show.sources.map(source => <article key={source.id}><div><span className="source-kind">{source.kind} · Checked {source.checkedAt}</span><h3><External href={source.url}>{source.label}</External></h3><p>{source.summary}</p></div></article>)}</div>{show.notes.length > 0 && <details className="source-notes"><summary>Review notes & missing information</summary><ul>{show.notes.map(note => <li key={note}>{note}</li>)}</ul></details>}</section>)}
  </>;
}

export default function App() {
  const [page, setPage] = useState<'plan' | 'shows' | 'sources'>('plan');
  const [request, setRequest] = useState(initial);
  const [formKey, setFormKey] = useState(0);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [sourceShow, setSourceShow] = useState('all');
  const result = useMemo(() => planVisit(events, request, purchaseDate), [request]);
  const candidate = result.candidates.find(c => c.id === chosenId) ?? result.candidates.find(c => c.session.kind === 'general') ?? result.candidates[0];
  const go = (next: typeof page) => { setPage(next); window.scrollTo({ top: 0 }); };
  const submit = (next: VisitRequest) => { setRequest(next); setChosenId(null); };
  const selectShow = (show: CardShow) => { const session = show.sessions.find(s => s.kind === 'general') ?? show.sessions[0]; const next = { ...initial, date: session?.date ?? show.dateStart, from: session?.start ?? '10:00', until: session?.end ?? '18:00', childAges: [], categories: allCategories, goal: session?.kind === 'trade' ? 'trade' as const : 'browse' as const }; setRequest(next); setChosenId(session ? `${show.id}:${session.id}` : null); setFormKey(k => k + 1); go('plan'); };
  return <><a className="skip-link" href="#main">Skip to planner</a><header className="site-header"><button className="wordmark" onClick={() => go('plan')}>ShowWindow</button><nav aria-label="Main navigation"><button aria-current={page === 'plan' ? 'page' : undefined} onClick={() => go('plan')}>Plan a visit</button><button aria-current={page === 'shows' ? 'page' : undefined} onClick={() => go('shows')}>All shows</button><button aria-current={page === 'sources' ? 'page' : undefined} onClick={() => go('sources')}>Sources</button></nav><span className="region"><Icon name="pin" />Las Vegas, NV</span></header>
    <main id="main">{page === 'plan' ? <><div className="page-intro"><h1>Make time for the right show.</h1><p>A Las Vegas card-show plan that fits your hours, your people, and your budget.</p></div><div className="planner-layout"><VisitForm key={formKey} value={request} submit={submit} /><section className="results" aria-label="Visit results" aria-live="polite">{candidate ? <><VisitResult key={`${candidate.id}:${JSON.stringify(request)}`} candidate={candidate} alternatives={result.candidates} request={request} choose={setChosenId} openSources={() => { setSourceShow(candidate.show.id); go('sources'); }} />{result.candidates.some(c => c.show.id !== candidate.show.id) && <section className="other-shows"><h3>Other shows in your window</h3>{result.candidates.filter((c, index, arr) => c.show.id !== candidate.show.id && arr.findIndex(x => x.show.id === c.show.id) === index).map(c => <button className="comparison-row" key={c.id} onClick={() => setChosenId(c.id)}><span><strong>{c.show.name}</strong><small>{durationWords(c.usableMinutes)} · {c.status === 'fits' ? formatMoney(c.cost.totalCents) : 'Needs confirmation'}</small></span><Icon name="arrow" /></button>)}</section>}</> : <div className="empty-state"><Icon name="clock" /><h2>No published session fits these filters.</h2><p>Try another date, different hours or “Other / mixed cards” under More interests. A missing match does not mean a show has no cards you like; it means the checked sources do not establish that fit.</p><button className="outline" onClick={() => go('shows')}>Browse reviewed shows</button></div>}</section></div></> : page === 'shows' ? <AllShows selectShow={selectShow} /> : <Sources selected={sourceShow} setSelected={setSourceShow} />}</main>
    <footer className="site-footer"><span>ShowWindow · Las Vegas collector visits</span><div><button onClick={() => { setSourceShow('all'); go('sources'); }}>Sources & limitations</button><External href="https://github.com/agammann/showwindow-vegas">Open source</External></div><p>Organizer information reviewed October 12, 2026. Check the latest source before leaving.</p></footer>
  </>;
}
