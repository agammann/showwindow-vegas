export type SessionKind = 'general' | 'vip' | 'trade';
export type Goal = 'browse' | 'trade' | 'grading';
export type Category = 'pokemon' | 'sports' | 'magic' | 'one-piece' | 'yugioh' | 'lorcana' | 'general';
export interface EventSource {
  id: string;
  label: string;
  url: string;
  kind: 'organizer' | 'ticketing' | 'venue';
  checkedAt: string;
  summary: string;
}
export interface ShowSession {
  id: string;
  date: string;
  kind: SessionKind;
  start: string;
  end: string;
  alternativeEnd?: string;
  sourceIds: string[];
  status: 'confirmed' | 'conflict';
  access: 'ticket' | 'public-free' | 'attendees-only' | 'unpublished';
  note?: string;
}
export interface TicketRule {
  id: string;
  label: string;
  sessionKinds: SessionKind[];
  adultCents: number | null;
  serviceFeeCents: number | null;
  feeStatus: 'known' | 'unknown' | 'none';
  childrenFreeThrough: number | null;
  childPolicyKnown: boolean;
  purchaseMode: 'advance' | 'door' | 'either';
  salesEndDate?: string;
  coverage: 'day' | 'weekend' | 'session';
  sourceIds: string[];
  note?: string;
}
export interface ShowConflict {
  id: string;
  field: 'hours' | 'venue' | 'admission' | 'services';
  summary: string;
  claims: { sourceId: string; text: string }[];
  severity: 'blocking' | 'notice';
}
export interface CardShow {
  id: string;
  name: string;
  organizer: string;
  dateStart: string;
  dateEnd: string;
  categories: Category[];
  goals: Goal[];
  venue: {
    name: string;
    address: string;
    city: string;
    status: 'confirmed' | 'tba' | 'conflict';
    indoorDirections?: string;
    sourceIds: string[];
  };
  parking: { status: 'free' | 'paid' | 'unknown'; note: string; sourceIds: string[] };
  sessions: ShowSession[];
  tickets: TicketRule[];
  sources: EventSource[];
  conflicts: ShowConflict[];
  services: { label: string; detail: string; sourceIds: string[] }[];
  notes: string[];
}
export interface VisitRequest {
  date: string;
  from: string;
  until: string;
  adults: number;
  childAges: number[];
  budgetCents: number;
  goal: Goal;
  categories: Category[];
  purchaseMode: 'advance' | 'door';
}
export interface VisitCost {
  minimumCents: number | null;
  totalCents: number | null;
  paidPeople: number | null;
  freeChildren: number;
  feeCents: number | null;
  rule: TicketRule | null;
  notes: string[];
}
export interface VisitCandidate {
  id: string;
  show: CardShow;
  session: ShowSession;
  usableMinutes: number;
  possibleMinutes: number;
  visitStart: string;
  visitEnd: string;
  cost: VisitCost;
  status: 'fits' | 'needs-confirmation' | 'over-budget';
  reasons: string[];
  issues: string[];
  canSave: boolean;
}
export interface PlanResult {
  candidates: VisitCandidate[];
  errors: string[];
  skipped: { showId: string; reason: string }[];
}
