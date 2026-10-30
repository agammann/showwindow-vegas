# ShowWindow status

Updated for the project’s client date: **2026-10-12**.

## Implemented

- React/TypeScript collector planner with visit hours, party ages, interest filters, collecting goal and admission budget.
- Deterministic session overlap and published group admission calculations.
- Source-linked conflicts and unknown terms, with saved-plan blocking for unresolved details.
- HTML pocket-plan and tentative local-time calendar exports for visits with established source facts.
- Reviewed event snapshot: 11 listings, 33 supported sessions, ten shows with physical destinations across six distinct venues, and one TBA location.
- Local Qwen3.5-4B source compiler, evidence validation and actual execution receipts. Individually reviewed Front Row and Next Level fields are incorporated and listed in the event-source receipt.
- CI and GitHub Pages workflow definitions.

## Verified locally

The dataset was checked with the production planner. Front Row’s published online fee and age-10 free-child boundary yield the expected party totals. Next Level’s conflicting Sunday closing time preserves conservative and possible overlap and blocks saving. Genesis’s public-free Saturday trade session and Total Eclipse’s free entry permit a zero-admission plan. Venue TBA and unpublished Sin City admission prevent a confirmed export. Referenced source IDs resolve within each event.

The final local run passed **50 tests** and the production build. Browser QA passed at 1440px desktop and 390px phone widths, including actual HTML and ICS downloads, VIP session timing, the child age-10/11 boundary, budget blocking, stale export reset, directory search and selected-show planning, TBA save/directions blocking, and invalid-hour handling. Screenshots: [desktop](docs/images/desktop.jpg), [mobile](docs/images/mobile.jpg). The [remote CI run](https://github.com/agammann/showwindow-vegas/actions/runs/38340115857) and [Pages deployment](https://github.com/agammann/showwindow-vegas/actions/runs/38340115811) passed against implementation commit `dc84fc7417ad886ba511a2e0e9182db8c1f773b6`. The first Pages attempt preceded Pages configuration; the second attempt succeeded after configuration.

The final four-source model check passed **1/4 complete configured cases**; **3/4 proposals passed evidence validation**. The required Next Level Sunday 17:00/16:00 disagreement was detected. **12/12 compiler boundary checks** passed. This does not mean three complete proposals were factually correct. Only the source notes’ reviewed subset was incorporated; complete failed proposals were not promoted.

## External delivery

- Public source: [agammann/showwindow-vegas](https://github.com/agammann/showwindow-vegas).
- Public demo: [ShowWindow](https://agammann.github.io/showwindow-vegas/). The actual public-site check confirmed the default plan, VIP timing and real HTML/calendar downloads without console errors.
- Owner-private preview: [ShowWindow on Sites](https://showwindow-vegas.alx21.chatgpt.site), published successfully as a separate private preview.
- DEV submission: [published Week 2 entry](https://dev.to/agammann/showwindow-a-card-show-visit-that-fits-your-actual-afternoon-49i7) at 2026-10-13 03:24:09 UTC (October 12, 8:24pm PDT). DEV displays the Side Hustle submission banner. The public API confirms author agammann, required tags, and an exact normalized body match to the reviewed draft.
- First collector trial, willingness to pay and revenue: not established.

## Submission complete

The user confirmed age/eligibility and acceptance of the contest rules immediately before publication. The entry, source repository and live demo are published and verified. No required delivery work remains. Contest judging and any later source refresh are separate from this completed submission.

## Limits

This is a fixed October 12 source snapshot covering visits through December 2026. It does not establish complete regional coverage, live cancellations, ticket availability, card inventory or attendance. Prices concern admission only. Unknown child rules and fees remain unknown. The app has no checkout or paid subscription.
