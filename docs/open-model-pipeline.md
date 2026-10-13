# Organizer text to reviewed event facts

ShowWindow uses an open-weight model to turn organizer text into structured event proposals. The model extracts the per-day public, early-entry and trade-night sessions, admission tiers, child admission cutoff, venue and address that the planner needs. A curator reviews those proposed facts before incorporating them into the public event snapshot. The model is part of the data preparation workflow; the public planner does not contact Ollama from a visitor's browser.

The local default is `qwen3.5:4b-q4_K_M` served by Ollama. The official [Qwen3.5-4B model card](https://huggingface.co/Qwen/Qwen3.5-4B) identifies the weights as Apache-2.0. The installed quantization's model digest, actual run timestamp and Ollama version are recorded in [the execution receipt](../artifacts/model-evidence.json). Model weights are not included in this repository.

## Run a private extraction

Install Node.js 20 or later and Ollama, then make the selected model available locally:

```powershell
ollama pull qwen3.5:4b-q4_K_M
```

Save the source bundle in the gitignored `artifacts/private-inputs/` folder. Each source has a stable `id`, an `eventId` identifying the event edition, its official `url`, and the supplied plain `text`. The source URL is a provenance link; the script does not fetch it. Sources sharing an event ID are extracted separately and compared afterward. Keep line breaks and spelling intact for evidence checks.

The input shape is `{ "sources": [{ "id": "organizer-event", "eventId": "show-edition", "url": "https://organizer.example/event", "text": "supplied organizer text" }] }`. An array of sources is also accepted by the compiler. A bundle may contain 1–40 sources of up to 50,000 characters each.

```powershell
node scripts/compile-sources.mjs --input artifacts/private-inputs/sources.json --output artifacts/private-inputs/proposals.json
```

Optional flags are `--model`, `--endpoint` and `--timeout-ms`. The default origin is `http://127.0.0.1:11434`, with a 180-second timeout per source. The endpoint must use a literal loopback address: `127.0.0.1` or `[::1]`. Remote origins, URL credentials, paths and redirects are rejected. The source text grants the model no tools, shell execution or network access.

The compiler prints source IDs, outcomes and elapsed times. The proposal JSON is private review material: it contains short source quotations, extracted fields and source hashes. Public/source directories are blocked as compiler output destinations. Keep any other output location private as well. The compiler never writes the public event dataset.

## What is checked

Ollama receives `POST /api/chat` with `think: false`, `stream: false`, a JSON schema, temperature zero and a fixed seed. The implementation follows the documented [chat endpoint](https://docs.ollama.com/api/chat) and [structured output interface](https://docs.ollama.com/capabilities/structured-outputs). The model fills fixed weekday/session and ticket-tier slots rather than repeating an unconstrained list. It copies dollar amounts as decimal strings; ordinary code converts those strings into integer cents. A separate validator checks the returned JSON, required fields, allowed values, calendar dates, weekday agreement, same-day time order, duplicate sessions and amounts. Surrounding Markdown, extra fields and incomplete responses are rejected.

Every proposed fact needs evidence. An exact quotation must occur in the supplied text, and any accompanying line IDs must match its source lines. If the model cannot quote exactly, it may cite existing nonempty source line IDs instead. A non-exact quotation is discarded when that fallback is used. Missing quotations and invalid lines fail validation. The receipt counts line-based fallbacks separately.

Evidence existence is a provenance check, not proof that the model interpreted the evidence correctly. A valid quotation can still support the wrong extracted field. Selected smoke expectations check important actual values, and curator review remains mandatory for all facts used publicly.

Unpublished values stay unknown. For example, a source that supplies only a VIP opening time produces a null VIP closing time; it does not inherit the public closing time. A named weekday without an explicitly published event year can have a null full date. Copyright years do not establish event years. General public hours and trade-night hours are separate sessions. Base admission and explicitly published service fees are separate amounts.

## Cross-source comparison and review

The deterministic comparison groups proposals by the supplied event ID, then compares venue, address, child cutoff, day/session start and end times, and matching ticket-tier amounts. It ignores cosmetic case and whitespace changes. Venue aliases and address abbreviations can still be flagged alongside substantive differences, so a conflict is a review item rather than an automatic correction.

The November Next Level show supplies a useful real conflict: its [official event page](https://nextlevelcardshows.com/card-shows/santa-fe-station-november-2026/) publishes public hours to 5pm, while its [linked ticket page](https://www.strideevents.com/events/next-level-card-show/2026/tickets) publishes Sunday closing at 4pm. The pipeline should preserve both observations. It does not decide which source is right or present a disputed period as confirmed available.

Review source URLs and the private evidence lines, check that all values refer to the intended event edition, decide which facts are accepted, and record that acceptance alongside the curated event fields. The data-source documentation identifies the reviewed subset actually incorporated into the public snapshot. An extraction receipt marked `unreviewed` records model execution; it does not authorize publication.

## Reproduce the focused live check

The smoke runner needs a private bundle with `sources`, an `expectations` object keyed by source ID, and optional `expectedConflicts`. Each expectation may specify scalar facts, required session objects, required ticket objects and exact session/admission counts. It checks those supplied values against the actual model output; it does not use them as model input.

```powershell
node scripts/model-smoke.mjs --input artifacts/private-inputs/smoke-sources.json --output artifacts/model-evidence.json
```

The committed receipt records four selected sources: Front Row's event and ticket pages, and Next Level's event and ticket pages. It retains normalized actual proposed fields, validated line IDs, required-field check results, runtime details and unresolved comparisons. `previousRuns` preserves earlier failed or incomplete attempts when the runner updates an existing receipt. Full source text and quotation bodies remain private. The smoke runner also checks malformed evidence, duplicate IDs, non-JSON boundaries, repeated identical quotes on different lines and remote endpoint rejection without calling a remote service.

The final recorded invocation began at `2026-10-13T02:53:04.483Z` and took 120,658 milliseconds across four sources. Three proposals passed the structural/evidence checks. After tightening the selected field expectations to catch invented VIP closing times and extra ticket tiers, **one of four cases passed all selected field checks**. The same stored output was rechecked without invoking the model again; its source hashes were required to match the private input. The expected Next Level Sunday 5pm versus 4pm conflict was detected. Venue-name and address-format differences were also flagged for review and are not additional proven venue errors.

The Front Row main-text proposal was rejected for date/weekday disagreement. The ticket proposal contained useful general hours, Saturday trade-night hours, venue/address, child cutoff and advance fees, but also inferred VIP closing times and duplicated online prices into door tiers. The Next Level event proposal contained the published day hours and base prices, but added an extra ticket classification. The Next Level ticket proposal passed its selected general-hours, unpublished-child-policy and no-published-admission checks. These results establish a need for individual field review rather than automatic acceptance of an entire event.

To tighten or correct expectations against the same recorded output without another model invocation, use:

```powershell
node scripts/model-smoke.mjs --input artifacts/private-inputs/smoke-sources.json --recheck artifacts/model-evidence.json --output artifacts/model-evidence.json
```

`previousCheckRevisions` preserves the earlier check outcomes for that invocation. A nonzero compiler or smoke exit code means at least one proposal/check failed; the report still records the failures for review.

This small local run establishes what happened on these supplied excerpts. It does not measure general extraction accuracy, completeness across Las Vegas, continuous source freshness, cancellation coverage, model portability to every computer, or willingness to pay. Current public event facts still require verification against their organizer sources.
