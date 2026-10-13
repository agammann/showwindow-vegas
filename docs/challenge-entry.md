---
title: "ShowWindow: a card-show visit that fits your actual afternoon"
published: true
tags: devchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12).*

## What I Built

ShowWindow helps a collector choose a Las Vegas card-show visit around the hours, people and admission budget they actually have.

Finding an event is only part of that decision. Can you enter at 10am on a general-admission ticket, or is that VIP time? Does your 10-year-old need a ticket? Is an evening trade session open to the public? Can you still spend time at the show if two official pages disagree about when it closes?

The planner takes a date, an available time window, adult count, child ages, interests, a collecting goal and an admission budget. It compares the published sessions, explains the usable time and party cost, then downloads a source-linked pocket plan when the important details are established.

I kept this first version regional: 11 reviewed listings and 33 supported sessions for visits from October 13 through December 31, 2026. Ten shows have physical destinations across six distinct venues. One announced event has a venue TBA. The source snapshot was checked October 12; it is not a live or complete calendar.

The possible paying customer is a collector who wants a maintained weekend visit guide with the research already checked for their party. A $5 weekend research pack is a hypothesis I would test, not a validated price or an offer in this app. The current app is free, has no checkout, and has no confirmed first user or revenue.

## Demo

[Try ShowWindow](https://agammann.github.io/showwindow-vegas/). The public demo runs without an account or a model download.

![ShowWindow Las Vegas visit planner on desktop](https://raw.githubusercontent.com/agammann/showwindow-vegas/main/docs/images/desktop.jpg)

Three concrete visits show the difference:

1. **Front Row, October 24, 10:30am–noon.** Two adults and a 10-year-old get one usable hour under general admission, which starts at 11am. The two advance tickets cost $21.58 including the published $0.79 fee per ticket. Change the child’s age to 11 and the total becomes $32.37. Earlier access requires the VIP ticket.
2. **Next Level, November 22, 4:15–4:45pm.** Its official ticket page closes Sunday at 4pm; its organizer page says 5pm. ShowWindow retains the discrepancy: no confirmed time in that window, up to 30 minutes under the later claim, and no saved arrival plan.
3. **Genesis, December 5, 6–8pm.** Choose trading and other/mixed cards. The organizer explicitly publishes a 6–10pm Saturday trade night free to the public. The separate Trading Card Fest on that date remains unsuitable for an arrival plan while its location is TBA.

For a confirmed visit, the HTML download keeps the party, session, cost, address, parking note and source links together. The calendar download uses Las Vegas local time. Neither is a ticket or a reservation.

## Code

[agammann/showwindow-vegas on GitHub](https://github.com/agammann/showwindow-vegas)

The repository includes the React/TypeScript planner, deterministic calculation and export code, reviewed event data, a local source compiler, tests, source notes and the actual model execution receipt. The source is published under MIT. [CI](https://github.com/agammann/showwindow-vegas/actions/runs/38340115857) and [GitHub Pages deployment](https://github.com/agammann/showwindow-vegas/actions/runs/38340115811) passed.

## How I Built It

The data preparation workflow uses **Qwen3.5-4B** through Ollama on a local machine. The installed model is `qwen3.5:4b-q4_K_M`; its official [model card](https://huggingface.co/Qwen/Qwen3.5-4B) identifies the weights as Apache-2.0.

Organizer pages often put several access rules in one paragraph. The source compiler asks the model for structured per-day sessions, ticket tiers, child cutoffs, venue and address. Each proposed fact needs evidence from the supplied source text. Validation checks the schema, calendar dates, time order, integer-cent prices and evidence references. A curator then checks the meaning before a field enters the published snapshot.

That review matters. Early runs mixed general-admission and VIP opening times, repeated sessions and treated a free-child rule as an adult admission tier. The final run still passed only **one of four complete configured source cases**; three proposals passed the separate evidence-validation checks. In the Front Row ticket proposal, the model copied online prices into door tiers and supplied a VIP end time not stated in that source excerpt. The Next Level event proposal produced extra admission tiers. Those incorrect fields were rejected.

I reviewed useful individual fields against the official pages before incorporating them: Front Row’s GA sessions, VIP starts, Saturday trade hours, child cutoff and advance prices/fees; and Next Level’s GA/VIP source-hour claims, child cutoff and base amounts. The two Next Level sources produced the expected Sunday 5pm/4pm disagreement. The [field receipt](https://github.com/agammann/showwindow-vegas/blob/main/docs/event-sources.md) identifies the exact subset and manual additions. The full dataset was not model-extracted.

The [execution receipt](https://github.com/agammann/showwindow-vegas/blob/main/artifacts/model-evidence.json) preserves the final failures, three prior runs and the weaker check set that would have overstated success. All 12 compiler boundary checks passed. These are a small local source check and validation checks, not general model accuracy. The model cannot publish the dataset or decide that a visitor’s budget fits.

The planner then uses ordinary code for time intersections, inclusive age cutoffs and admission arithmetic. Unknown child prices and fees remain unknown. Conflicting closing times keep conservative and possible visit durations separate. A TBA destination cannot turn into an address. The public app runs on the curated snapshot and does not contact the local model from a visitor’s browser.

The assembled app passed 50 local tests and the production build. I checked desktop and phone layouts, downloaded real HTML and calendar files, tested VIP timing and the age-10/11 price boundary, and verified that budget errors, TBA destinations and invalid hours block the relevant actions. The [remote CI run](https://github.com/agammann/showwindow-vegas/actions/runs/38340115857) also passed. I checked the public site and downloaded both exports there as well.

I also kept two similar-looking trade sessions distinct. Front Row describes free entry for show attendees, so the planner retains the show-admission requirement. Genesis explicitly says its Saturday trade night is free to the public. Treating both as a generic free event would produce the wrong budget advice.

## Why Does Open Innovation Matter?

The open model lets the source-preparation workflow run under the maintainer’s control, with inspectable prompts, validation rules and model settings. It can be replaced or adjusted without rewriting the visitor planner around a provider’s proprietary response format. Supplied source text stays in the local inference workflow; there is no per-request paid inference API in this build.

The useful result is a reviewed set of rules that the app can explain and calculate from. Hosting the planner does not require serving the model to every visitor. A collector’s time, party ages and budget are processed in the browser.

I have not demonstrated a cost or accuracy advantage over a closed model, and this small source check does not establish complete Vegas coverage. What I can make inspectable is the actual local run, its rejected outputs, the accepted reviewed fields and the calculations that turn them into a visit.

## Prize Categories

**Week 2: Side Hustle, overall challenge.** The project targets a specific hobby-community planning task and tests a possible paid research product. Willingness to pay is still unverified.

**Best Use of GitHub Copilot — GitHub Actions automation route:** CI and GitHub Pages workflows are configured in the repository. The category explicitly permits GitHub Actions automation. The [CI workflow](https://github.com/agammann/showwindow-vegas/actions/runs/38340115857) checks the project and the [Pages workflow](https://github.com/agammann/showwindow-vegas/actions/runs/38340115811) builds and deploys the public app.
