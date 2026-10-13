# ShowWindow

A Las Vegas card-show visit planner by [agammann](https://github.com/agammann). Enter the hours you have, the people coming with you, your collecting interests and an admission budget. ShowWindow compares the published visitor sessions and produces a pocket plan when the destination, hours and party admission can be established.

[Source repository](https://github.com/agammann/showwindow-vegas) · [Planned public demo](https://agammann.github.io/showwindow-vegas/) — deployment verification pending.

## What it does

- Separates general admission, early-entry tickets and evening trade sessions.
- Calculates usable visit time and group admission, including verified child cutoffs and ticket service fees.
- Shows source conflicts, unpublished admission terms and unannounced venues. Those uncertainties block a confirmed saved plan.
- Downloads a self-contained HTML pocket plan and an `.ics` calendar event for a confirmed visit.
- Links every modeled event to organizer, official ticketing or venue sources.

The snapshot was reviewed **October 12, 2026**. It contains **11 listings and 33 supported sessions** for October 13–December 31: ten shows with published physical destinations across six distinct venues, plus one announced show with a venue TBA. It is curated regional research, not a complete or live calendar. The [source notes](docs/event-sources.md) describe the omissions and conflicts.

## Try these visits

| Inputs | Expected behavior |
|---|---|
| October 24, 10:30–12:00; two adults and a 10-year-old; Pokémon; browse; advance admission; $21.58 | Front Row GA starts at 11:00, leaving one usable hour. Two $10 tickets with $0.79 fees total $21.58; the child enters free with an adult. Changing the child to 11 makes the published GA total $32.37. |
| November 22, 16:15–16:45; Pokémon; browse | Next Level’s ticket page closes Sunday at 16:00; its organizer page says 17:00. No confirmed time remains in that window, although 30 minutes may be possible under the later claim. Saving is blocked. |
| December 5, 18:00–20:00; other/mixed cards; trade; $0 | Genesis’s Saturday 18:00–22:00 trade session is explicitly free to the public. The same date’s separate Trading Card Fest listing cannot yield an arrival plan because its venue is TBA. |

Admission budgets exclude parking, travel and card purchases. A pocket plan is research, not a ticket or reservation. Published card categories do not establish individual inventory, and grading submissions do not imply on-site card grading.

## Open model workflow

The source compiler uses **Qwen3.5-4B**, running locally through Ollama as `qwen3.5:4b-q4_K_M`, to propose structured event facts from supplied organizer text. The [official model card](https://huggingface.co/Qwen/Qwen3.5-4B) identifies the weights as Apache-2.0. Weights are not bundled.

The compiler validates structure, times, amounts and evidence references. A curator then checks which proposed facts are supported by the intended event edition. The reviewed subset used in the snapshot is documented in [event sources](docs/event-sources.md); the actual execution receipt is in [model-evidence.json](artifacts/model-evidence.json). The final four-source check passed one complete configured case, while three proposals passed evidence validation. Useful individual fields from Front Row and Next Level were reviewed and incorporated; the refined failures and earlier attempts remain in the receipt. The Sunday closing disagreement was detected. These results are not a general accuracy benchmark.

The public planner runs deterministic time and admission calculations. It does not call Ollama, send visitor form inputs to an inference service, or ask a model to decide whether a budget fits. The compiler does not automatically overwrite the event dataset. See [the pipeline instructions](docs/open-model-pipeline.md) for private source inputs, validation and local reproduction.

## Run locally

Use Node.js 24 or later and pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. The curated planner works without a model server. To prepare source proposals, install Ollama and the selected model, then follow the pipeline instructions.

```powershell
pnpm test
pnpm build
```

Local verification passed 50 tests and the production build. Browser checks covered a 1440px desktop and 390px phone layout, real HTML/calendar downloads, VIP timing, the age-10/11 boundary, budget and TBA blocking, input errors, search and selected-show flows, and clearing stale export state. [Desktop](docs/images/desktop.jpg) and [mobile](docs/images/mobile.jpg) screenshots record the rendered app. GitHub Actions and Pages workflows are configured; remote run and public demo verification remain pending. [STATUS.md](STATUS.md) records the delivery state.

## Scope and validation

This build is for collectors choosing a visit in the Las Vegas area. There is no checkout, paid tier, live event monitor, card scanner, inventory matching or vendor booking. Willingness to pay and use by a first collector have not been established. A possible $5 weekend research pack is an untested product hypothesis; the current app is free.

The implementation was started for [HF26 Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12). The local dataset checks verify fee arithmetic, the inclusive child cutoff, disputed hours, public-free sessions, venue TBA blocking and unknown admission. Local test, build and browser evidence is recorded in the status file; remote delivery remains pending. The source snapshot should be refreshed and reviewed before expanding coverage.

Application code is MIT licensed. Event facts retain links to their original sources; no organizer flyer artwork is distributed.
