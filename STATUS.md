# ShowWindow status

Updated for the project’s client date: **2026-10-12**.

## Implemented

- React/TypeScript collector planner with visit hours, party ages, interest filters, collecting goal and admission budget.
- Deterministic session overlap and published group admission calculations.
- Source-linked conflicts and unknown terms, with saved-plan blocking for unresolved details.
- HTML pocket-plan and local-time calendar exports for confirmed visits.
- Reviewed event snapshot: 11 listings, 33 supported sessions, ten shows with physical destinations across six distinct venues, and one TBA location.
- Local Qwen3.5-4B source compiler, evidence validation and actual execution receipts. Individually reviewed Front Row and Next Level fields are incorporated and listed in the event-source receipt.
- CI and GitHub Pages workflow definitions.

## Verified locally

The dataset was checked with the production planner. Front Row’s published online fee and age-10 free-child boundary yield the expected party totals. Next Level’s conflicting Sunday closing time preserves conservative and possible overlap and blocks saving. Genesis’s public-free Saturday trade session and Total Eclipse’s free entry permit a zero-admission plan. Venue TBA and unpublished Sin City admission prevent a confirmed export. Referenced source IDs resolve within each event.

The final local run passed **50 tests** and the production build. Browser QA passed at 1440px desktop and 390px phone widths, including actual HTML and ICS downloads, VIP session timing, the child age-10/11 boundary, budget blocking, stale export reset, directory search and selected-show planning, TBA save/directions blocking, and invalid-hour handling. Screenshots: [desktop](docs/images/desktop.jpg), [mobile](docs/images/mobile.jpg). Remote CI and public deployment have not yet been verified.

The final four-source model check passed **1/4 complete configured cases**; **3/4 proposals passed evidence validation**. The required Next Level Sunday 17:00/16:00 disagreement was detected. **12/12 compiler boundary checks** passed. This does not mean three complete proposals were factually correct. Only the source notes’ reviewed subset was incorporated; complete failed proposals were not promoted.

## External delivery

- Repository: [agammann/showwindow-vegas](https://github.com/agammann/showwindow-vegas), created publicly; final code publication verification pending.
- Planned demo: [agammann.github.io/showwindow-vegas](https://agammann.github.io/showwindow-vegas/), deployment and live verification pending.
- DEV submission: draft at [docs/challenge-entry.md](docs/challenge-entry.md); not published or submitted.
- First collector trial, willingness to pay and revenue: not established.

## Release checks still required

1. Repeat the final assembled-code checks if subsequent changes require it.
2. Publish the final code, verify CI and Pages deployment, and recheck the public app and downloads.
3. Replace pending public-deployment language in the draft with only verified outcomes.
4. Review challenge eligibility and the rendered DEV draft before any submission action.

## Limits

This is a fixed October 12 source snapshot covering visits through December 2026. It does not establish complete regional coverage, live cancellations, ticket availability, card inventory or attendance. Prices concern admission only. Unknown child rules and fees remain unknown. The app has no checkout or paid subscription.
