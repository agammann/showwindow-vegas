# Verification record

## Local behavior

The assembled application was tested in the Codex in-app browser on October 12, 2026. Desktop layout was checked at 1440 × 1050 and phone layout at 390 × 844. Phone content had no horizontal overflow. Screenshots are saved in [desktop.jpg](images/desktop.jpg) and [mobile.jpg](images/mobile.jpg).

Observed interactions:

- Default Front Row visit: one adult and a 10-year-old, October 24, 10am–noon. General admission yielded 60 usable minutes and $10.79; selecting VIP yielded 120 minutes and $20.79.
- Two adults and an 11-year-old yielded $32.37 GA and disabled saving against a $30 budget.
- The HTML pocket plan and Las Vegas-time `.ics` event actually downloaded through the browser.
- Changing the budget after a download cleared the saved-plan notice and prevented an invalid calendar action.
- An end time before the start time produced a validation message.
- Directory search for Santa Fe showed the Next Level listing. Selecting Sin City November retained the clicked show rather than choosing its same-day competitor.
- Trading Card Fest's unannounced venue disabled saving and exposed no directions link.
- Conflicting Sunday hours are available with conservative and possible durations; the sources view retains both primary claims.
- The source view and organizer links are usable on phone and desktop. No application console warnings or errors were observed during these checks.

The offline suite covers planner arithmetic, admission cutoffs, unpublished terms, conflict handling, snapshot source integrity, escaped HTML/calendar output, and compiler evidence/input boundaries. The local model receipt is separate from these offline tests; it retains unsuccessful extraction attempts and the exact accepted review subset.

## Design fidelity

The complete primary screen follows the selected visual reference:

| Reference anchor | Implementation |
| --- | --- |
| White page, navy text, cobalt actions | Same palette and restrained hairline dividers |
| ShowWindow wordmark and three navigation choices | Matching header with the current Las Vegas region |
| “Make time for the right show.” headline and subtitle | Matching visible copy |
| Light-gray visit form at left, results at right | Same desktop composition; stacked form and results on phone |
| General/VIP choices, large duration and admission metrics | Functional session controls and calculated totals |
| Muted-to-blue time bar | Real visit overlap drives the highlighted portion |
| Open comparison row and arrival-plan action | Functional alternative selection and actual download |
| Venue, parking, trade session and provenance footer | Verified source information and source navigation |

The concept and latest rendered desktop screenshot were visually inspected together. Intentional additions are the child-age input help, advance/door purchase choice, unknown-term states, directions link, and advertised-services disclosure. Above-fold copy matches the headline, subtitle, Your visit, General admission, VIP entry, and Save arrival plan. The rendered venue includes its Convention Center suffix, and the comparison row uses a computed duration instead of fixed promotional wording.

## Verification limits

These checks do not establish willingness to pay, attendance, inventory, live cancellations, complete regional coverage or general model accuracy. The app uses a fixed source snapshot and requires organizer rechecking before travel. The repository's delivery status records remote CI, deployment and DEV publication separately from local results.
