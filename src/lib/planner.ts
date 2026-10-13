import type { CardShow, PlanResult, ShowSession, TicketRule, VisitCandidate, VisitCost, VisitRequest } from './types.ts';

export const DEFAULT_PURCHASE_DATE = '2026-10-12';
const categories = new Set(['pokemon', 'sports', 'magic', 'one-piece', 'yugioh', 'lorcana', 'general']);
const goals = new Set(['browse', 'trade', 'grading']);
const isCents = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function minutes(value: unknown): number | null {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

function clock(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function validateRequest(request: VisitRequest): string[] {
  if (!request || typeof request !== 'object') return ['Enter a visit request.'];
  const errors: string[] = [];
  if (!validDate(request.date)) errors.push('Choose a valid visit date.');
  const from = minutes(request.from);
  const until = minutes(request.until);
  if (from === null || until === null) errors.push('Enter times in HH:mm format.');
  else if (until <= from) errors.push('Your visit must end after it starts, on the same day.');
  if (!Number.isSafeInteger(request.adults) || request.adults < 1) errors.push('At least one adult is required; use a whole number.');
  if (!Array.isArray(request.childAges) || [...request.childAges].some(age => !Number.isSafeInteger(age) || age < 0 || age > 17)) {
    errors.push('Child ages must be whole numbers from 0 to 17.');
  }
  if (!isCents(request.budgetCents)) errors.push('Admission budget must be a nonnegative whole number of cents.');
  if (!goals.has(request.goal)) errors.push('Choose a supported collecting goal.');
  if (!Array.isArray(request.categories) || request.categories.length === 0 || [...request.categories].some(category => !categories.has(category))) {
    errors.push('Choose at least one supported card category.');
  }
  if (!['advance', 'door'].includes(request.purchaseMode)) errors.push('Choose advance or door admission.');
  return errors;
}

export function formatMoney(cents: number | null | undefined): string {
  return isCents(cents) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100) : 'Not published';
}

export function formatTime(value: string): string {
  const amount = minutes(value);
  if (amount === null) return 'Time not published';
  const hour = Math.floor(amount / 60);
  return `${hour % 12 || 12}:${String(amount % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export function formatDuration(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) return 'Duration unknown';
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`;
}

function unknownCost(notes: string[] = []): VisitCost {
  return { minimumCents: null, totalCents: null, paidPeople: null, freeChildren: 0, feeCents: null, rule: null, notes };
}

function costForRule(rule: TicketRule, request: VisitRequest): VisitCost {
  if (!isCents(rule.adultCents)) return { ...unknownCost(['Admission price is not published.']), rule };
  const hasChildren = request.childAges.length > 0;
  const cutoffValid = rule.childrenFreeThrough === null || (Number.isSafeInteger(rule.childrenFreeThrough) && rule.childrenFreeThrough >= 0 && rule.childrenFreeThrough <= 17);
  const childrenKnown = !hasChildren || (rule.childPolicyKnown && cutoffValid);
  const freeChildren = childrenKnown && rule.childrenFreeThrough !== null
    ? request.childAges.filter(age => age <= rule.childrenFreeThrough!).length : 0;
  const paidPeople = childrenKnown ? request.adults + request.childAges.length - freeChildren : null;
  const minimumPeople = paidPeople ?? request.adults;
  const baseCents = minimumPeople * rule.adultCents;
  const feeKnown = rule.feeStatus === 'none' || (rule.feeStatus === 'known' && isCents(rule.serviceFeeCents));
  const perTicketFee = rule.feeStatus === 'none' ? 0 : (rule.serviceFeeCents ?? 0);
  const feeCents = feeKnown ? minimumPeople * perTicketFee : null;
  const minimumCents = baseCents + (feeCents ?? 0);
  if (!isCents(minimumCents)) return { ...unknownCost(['The party total cannot be calculated safely.']), rule };
  const notes: string[] = ['Admission only; parking, travel and purchases are excluded.'];
  if (!childrenKnown) notes.push('Child admission is not published; the minimum includes adults only.');
  if (!feeKnown) notes.push('Ticket fees are not published; this is a minimum, not a confirmed total.');
  if (freeChildren) notes.push(`${freeChildren} ${freeChildren === 1 ? 'child is' : 'children are'} free under the published age rule, with an adult.`);
  if (rule.note) notes.push(rule.note);
  return { minimumCents, totalCents: childrenKnown && feeKnown ? minimumCents : null, paidPeople, freeChildren, feeCents, rule, notes };
}

function visitCost(show: CardShow, session: ShowSession, request: VisitRequest, today: string): VisitCost {
  if (session.access === 'public-free') {
    return { minimumCents: 0, totalCents: 0, paidPeople: 0, freeChildren: request.childAges.length, feeCents: 0, rule: null,
      notes: ['The organizer explicitly advertises this session as free to the public.'] };
  }
  const eligibleKind = session.access === 'attendees-only' ? 'general' : session.kind;
  const modeRules = show.tickets.filter(rule => rule.sessionKinds.includes(eligibleKind) && (rule.purchaseMode === request.purchaseMode || rule.purchaseMode === 'either'));
  const rules = modeRules.filter(rule => !rule.salesEndDate || (validDate(rule.salesEndDate) && today <= rule.salesEndDate));
  if (!rules.length) {
    return unknownCost([modeRules.length ? 'The published sales window has ended or cannot be verified. Choose another purchase mode.' : 'No published admission rule matches this session and purchase mode.']);
  }
  const costs = rules.map(rule => costForRule(rule, request));
  costs.sort((a, b) => Number(a.totalCents === null) - Number(b.totalCents === null)
    || (a.minimumCents ?? Number.MAX_SAFE_INTEGER) - (b.minimumCents ?? Number.MAX_SAFE_INTEGER)
    || a.rule!.id.localeCompare(b.rule!.id));
  return costs[0];
}

function goalAllows(session: ShowSession, goal: VisitRequest['goal']): boolean {
  return goal === 'trade' ? session.kind === 'trade' || session.kind === 'general' : session.kind === 'general' || session.kind === 'vip';
}

export function planVisit(shows: CardShow[], request: VisitRequest, today: string = DEFAULT_PURCHASE_DATE): PlanResult {
  const errors = validateRequest(request);
  if (!validDate(today)) errors.push('Purchase date must be a valid YYYY-MM-DD date.');
  const result: PlanResult = { candidates: [], errors, skipped: [] };
  if (errors.length) return result;
  const from = minutes(request.from)!;
  const until = minutes(request.until)!;
  for (const show of shows) {
    if (!validDate(show.dateStart) || !validDate(show.dateEnd) || show.dateEnd < show.dateStart) {
      result.skipped.push({ showId: show.id, reason: 'The announced date range needs confirmation.' });
      continue;
    }
    if (request.date < show.dateStart || request.date > show.dateEnd) {
      result.skipped.push({ showId: show.id, reason: 'Outside your visit date.' });
      continue;
    }
    if (!show.categories.some(category => request.categories.includes(category))) {
      result.skipped.push({ showId: show.id, reason: 'No published category matches your selection.' });
      continue;
    }
    if (!show.goals.includes(request.goal)) {
      result.skipped.push({ showId: show.id, reason: `The organizer has not advertised your ${request.goal === 'grading' ? 'grading' : request.goal === 'trade' ? 'trading' : 'browsing'} goal.` });
      continue;
    }
    const beforeCount = result.candidates.length;
    for (const session of show.sessions) {
      if (session.date !== request.date || !goalAllows(session, request.goal)) continue;
      const start = minutes(session.start);
      const end = minutes(session.end);
      const alternativeEnd = session.alternativeEnd ? minutes(session.alternativeEnd) : end;
      if (start === null || end === null || alternativeEnd === null || end <= start || alternativeEnd <= start) continue;
      const conflict = session.status === 'conflict' || (session.alternativeEnd !== undefined && alternativeEnd !== end);
      const conservativeEnd = Math.min(end, alternativeEnd);
      const possibleEnd = Math.max(end, alternativeEnd);
      const visitStart = Math.max(from, start);
      const visitEnd = Math.max(visitStart, Math.min(until, conservativeEnd));
      const usableMinutes = Math.max(0, Math.min(until, conservativeEnd) - visitStart);
      const possibleMinutes = Math.max(0, Math.min(until, possibleEnd) - visitStart);
      if (!possibleMinutes) continue;
      const cost = visitCost(show, session, request, today);
      const reasons = [`${formatDuration(usableMinutes)} overlaps the published ${session.kind === 'vip' ? 'VIP' : session.kind === 'trade' ? 'trade' : 'general admission'} session.`];
      if (session.kind === 'vip') reasons.push('This option requires the published early-entry ticket.');
      reasons.push(request.goal === 'grading' ? 'Grading submissions are advertised; acceptance deadlines and service terms still apply.'
        : request.goal === 'trade' ? 'Trading is advertised; specific cards and trading partners are not guaranteed.'
        : 'A published category matches your interest; specific inventory is not guaranteed.');
      if (cost.totalCents !== null) reasons.push(`${formatMoney(cost.totalCents)} admission for your party under ${cost.rule?.label ?? 'the public-free session rule'}.`);
      const issues: string[] = [];
      if (conflict) issues.push(`Published closing times conflict. ${formatDuration(usableMinutes)} is conservative; up to ${formatDuration(possibleMinutes)} may be possible.`);
      if (show.venue.status === 'tba') issues.push('Venue is TBA. An arrival plan cannot be confirmed.');
      if (show.venue.status === 'conflict') issues.push('Venue sources conflict. Confirm the destination before travelling.');
      if (session.access === 'attendees-only') issues.push('This session is for show attendees. A show ticket or proof of prior admission may be required; it is not confirmed free to the public.');
      if (session.access === 'unpublished') issues.push('Session access rules are not published.');
      if (cost.totalCents === null) issues.push(...cost.notes.filter(note => !note.startsWith('Admission only;')));
      issues.push(...show.conflicts.map(item => item.summary));
      const uncertain = conflict || show.venue.status !== 'confirmed' || session.access === 'attendees-only'
        || session.access === 'unpublished' || cost.totalCents === null || show.conflicts.some(item => item.severity === 'blocking');
      const status: VisitCandidate['status'] = cost.minimumCents !== null && cost.minimumCents > request.budgetCents
        ? 'over-budget' : uncertain ? 'needs-confirmation' : 'fits';
      if (status === 'over-budget') issues.push(`The published minimum of ${formatMoney(cost.minimumCents)} exceeds your ${formatMoney(request.budgetCents)} admission budget.`);
      result.candidates.push({ id: `${show.id}:${session.id}`, show, session, usableMinutes, possibleMinutes,
        visitStart: clock(visitStart), visitEnd: clock(visitEnd), cost, status, reasons, issues: [...new Set(issues)],
        canSave: status === 'fits' && usableMinutes > 0 });
    }
    if (result.candidates.length === beforeCount) result.skipped.push({ showId: show.id, reason: 'No published session for your goal overlaps these hours.' });
  }
  const order = { fits: 0, 'needs-confirmation': 1, 'over-budget': 2 };
  result.candidates.sort((a, b) => order[a.status] - order[b.status] || b.usableMinutes - a.usableMinutes
    || (a.cost.minimumCents ?? Number.MAX_SAFE_INTEGER) - (b.cost.minimumCents ?? Number.MAX_SAFE_INTEGER)
    || a.id.localeCompare(b.id));
  return result;
}
