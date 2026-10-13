# Vegas event sources

This snapshot was checked on **2026-10-12**, the project’s client date. It covers **2026-10-13 through 2026-12-31** and contains **10 canonical shows with published physical venues**, plus **one announced event whose location remains TBA**. All session clocks use local Las Vegas time in `HH:mm`; they are not UTC timestamps. Multi-day shows have one event record with separate visit sessions.

The data is a reviewed regional snapshot, not an exhaustive calendar or a live availability feed. It uses organizer, organizer-linked ticketing and official venue pages. No flyer images, vendor inventory, crowd estimates, attendance figures or individual card availability are included.

## Source inventory

| Event records | Primary sources | What was established |
|---|---|---|
| Sin City: October 17–18, November 4–5, November 21–22, December 19–20 | [Official schedule](https://sincitycardshow.com/), [Rio address](https://www.riolasvegas.com/rio-revealed/faq/what-is-the-address-of-rio-hotel-and-casino), [Silverton venue](https://silvertoncasino.com/) | Dates, venues and visitor hours; Silverton free parking. Admission and child discounts are unknown. The complete schedule was verified in the live rendered page because text-only extraction omits its event list. |
| Front Row: October 24–25 | [Official event](https://frontrowcardshow.com/collections/las-vegas), [Leap tickets](https://events.leapevents.com/event/front-row-card-show-las-vegas-2026-october-24-25), [Organizer parking information](https://frontrowcardshow.com/pages/parking-and-transportation-information) | Per-day GA/VIP hours, Saturday attendee trade night, advance/door prices, $0.79 online ticket fee, child cutoff, named submission services and free parking. |
| PokeKon: November 6–7 | [Official event](https://pokekonlv.com/) | Tuscany address, per-day GA/VIP hours and advertised online ticket fees. Paid child admission and door prices remain unknown. A separate 21+ game show restriction is not applied to the main card show. |
| Total Eclipse: November 14–15 and December 12 | [Official calendar](https://www.totaleclipsecardshow.com/eventcalendar) | Boulevard Mall address, 14:00–20:00 sessions, free entry and parking. The two November entries are one event. December’s explicit date is one day despite generic copy mentioning two days. |
| Next Level: November 21–22 | [Official event detail](https://nextlevelcardshows.com/card-shows/santa-fe-station-november-2026/), [Homepage/FAQ](https://nextlevelcardshows.com/), [Stride tickets](https://www.strideevents.com/events/next-level-card-show/2026/tickets), [Santa Fe official address](https://santafestation.com/contact/) | Weekend prices, child cutoff, early-entry distinction, parking and indoor directions. Sunday end time conflicts; the address contradiction is retained as a notice. |
| Genesis: December 5–6 | [Official event and tickets](https://www.genesiscardshow.com/event-details-registration/las-vegas-december-5th-6th-550-tables-at-the-world-market-center) | Organizer’s World Market Center address, GA/VIP entry times, exact online fees, Sunday endpoint and Saturday public-free trade night. Saturday daytime closing and child discounts are unknown. |
| Las Vegas Trading Card Fest: December 4–6 | [Organizer’s Eventzilla attendee listing](https://www.eventzilla.net/e/las-vegas-trading-card-fest-attendee-registration-kids-12-and-under-are-free-2138672681) | Announced dates, per-day GA/VIP hours and child cutoff. Physical location explicitly TBA. The $25 VIP offer covers three days; the advertised $15 adult offer’s coverage and fees are unresolved. |

Source IDs in `src/data/events.json` are local to each event’s `sources` array. Every modeled venue, session, ticket, parking term, service and conflict references its supporting source IDs. `checkedAt` records when the snapshot was reviewed, not the organizer’s publication date.

## Reviewed model fields incorporated

The final local execution receipt is [model-evidence.json](../artifacts/model-evidence.json), pipeline version 4, run at `2026-10-13T02:53:04.483Z` (October 12 in Las Vegas). **One of four source cases passed the complete configured field checks; three proposals passed evidence validation.** These are different checks. The deterministic comparison found the expected Sunday 17:00 versus 16:00 disagreement, and all 12 compiler boundary checks passed. Three earlier runs and the weaker pre-refinement check results remain in the receipt.

`acceptedProposal` in that receipt means a structurally/evidence-validated proposal available for review. It does not mean that all facts are correct or approved for publication. This section records the subsequent field-by-field factual review. No complete failed proposal was promoted. Individually supported values below were copied from the actual normalized output into the event snapshot after checking the official pages; unrelated or incorrect proposed fields were rejected.

| Receipt source ID | Reviewed fields used | Evidence line IDs in that source excerpt |
|---|---|---|
| `front-row-tickets` | Rio venue/address and inclusive child cutoff 10 | Venue `L2`; address `L3`; child cutoff `L9` |
| `front-row-tickets` | Saturday and Sunday GA dates, 11:00 starts and 17:00 ends; VIP **starts only** at 10:00; Saturday trade 17:00–21:00 | Saturday GA/VIP start `L5`; Sunday GA/VIP start `L8`; Saturday trade `L6` |
| `front-row-tickets` | Advance GA base 1000 cents + 79-cent fee; advance VIP day base 2000 + 79; advance VIP two-day base 2500 + 79 | Advance GA `admission[0]`, `L10`; VIP day `admission[2]`, `L11`; VIP two-day `admission[4]`, `L12` |
| `next-level-tickets` | Santa Fe venue and street address; Saturday GA November 21 10:00–17:00; Sunday GA November 22 10:00–16:00 | Venue `L2`; street address `L3`; Saturday `L5`; Sunday `L6` |
| `next-level-event` | Full address, inclusive child cutoff 10, named GA/VIP dates and hours; Sunday 17:00 is retained as the alternative source claim | Address `L2`; child cutoff `L7`; GA `L4`; VIP `L5` |
| `next-level-event` | Base admission amounts only: GA 1000 cents; early access 2000 cents. Weekend coverage and purchase-mode interpretation were checked directly against the official offer | GA amount `L4`; VIP amount `L5` |

The Front Row ticket proposal failed the refined checks: it inferred a VIP closing time from a start-only mention and copied online ticket prices into extra door tiers. Those VIP-end and door-tier fields were not accepted. The published VIP closing time is a curator’s assembly using the event’s overall show hours; door prices come from the organizer page and their fees remain unknown. The Next Level event proposal also failed because it emitted extra/misclassified admission tiers. Its one-day VIP scope and door-only classifications were not copied. The completely rejected Front Row main-page proposal contributed no fields.

Display typography, venue entrance detail, address enrichment and fields outside the table remain curated. In particular, Front Row attendee-only trade access, Next Level’s conservative Sunday VIP endpoint, all other organizers’ event facts, missing facts and the final blocking decisions were reviewed separately. The snapshot’s 11 listings were **not all extracted by the model**, and this small run does not establish general model accuracy or automatic source freshness.

## Admission boundaries

- Exact online fees are used only where an official page states them: Front Row $0.79; PokeKon’s advertised offer-specific fees; Genesis $0.13/$0.20 GA and $0.38/$0.50 VIP. Door fees are unknown unless explicitly established.
- A free session has a zero admission price and zero fee. Total Eclipse’s public entry and Genesis’s Saturday trade night are explicitly free.
- Front Row’s trade night is described as free for show attendees. It is modeled as `attendees-only`, with the paid show admission rule retained; it is not treated as a standalone free public event.
- A child discount requires a published age cutoff and adult accompaniment rule. Front Row and Next Level use age 10 inclusive; Fest uses age 12 inclusive. PokeKon and Genesis paid-ticket child rules remain unknown. An all-ages or family-friendly description does not establish a discount.
- Front Row advance sales end at midnight Friday, October 23. `salesEndDate` is a purchase-date boundary, not a reason to reject an October 24–25 visit booked before the deadline.
- `weekend` coverage means the complete multi-day ticket offer; Fest’s VIP offer explicitly covers all three days. It does not mean that a one-day admission price can be multiplied or promoted into a multi-day pass.

## Conflicts and omitted facts

Next Level’s official ticket page gives Sunday GA 10:00–16:00 and early entry at 09:00. Its homepage FAQ gives Sunday 09:00–17:00. Sunday sessions retain `status: conflict`, conservative `end: 16:00`, and `alternativeEnd: 17:00`, with a blocking hours conflict. The homepage footer supplies 5155 Blue Diamond Road, while its FAQ and ticket page agree on Santa Fe Station at 4949 N Rancho Drive. Santa Fe’s own contact page independently confirms 4949 N Rancho Drive, Las Vegas, NV 89130. That venue address is used and the footer contradiction remains visible as a notice.

Genesis’s overall timestamp starts Saturday at 10:00 and ends Sunday at 17:00; its ticket descriptions separately establish GA entry at 11:00 and VIP at 10:00. That range does not establish Saturday’s daytime close. Saturday GA/VIP sessions are therefore omitted. Its fully published Saturday 18:00–22:00 public trade night and Sunday daytime sessions remain available.

Fest cannot produce a confirmed arrival plan while its venue is TBA. The organizer index also labels its listing virtual; ticket-operation status is not established by extracted generic checkout/error text. Its Saturday VIP/vendor trade night has a published 18:30 start but no verified end, so it is not modeled as a visit session.

Sin City, Genesis and Fest are tagged `general` where the checked primary text did not establish specific card categories. Category matching does not promise inventory. A grading-submission announcement does not promise on-site card grading or turnaround time.

## Scope exclusions

[Las Vegas Card Show](https://lasvegascardshow.com/) published October 3–4, before the snapshot’s visit range, and January 16–17, 2027, after it. [Vegas TCG Exchange](https://www.vegastcgexchange.com/) published September 5–6. [Vegas ToyCon](https://vegastoycon.com/) is an adjacent mixed toy/pop-culture convention and is excluded from the dedicated card-show count. Weekly leagues and tournaments are excluded. No cancellation was established, and no Henderson or North Las Vegas show was verified; neither finding proves the absence of other events.
