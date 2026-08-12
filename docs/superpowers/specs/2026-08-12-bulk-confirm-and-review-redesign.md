# Bulk upload: merged confirm question, review-page accordions, draft resume

Date: 2026-08-12
Status: approved, implementing

Lives in the frontend repo because most of the work is frontend and the backend
repo's `.gitignore:29` ignores `docs*` on purpose (see the
`project_migrations_gitignored_blocker` note — do not "fix" that).

## Why

Three separate complaints, one flow.

1. **Review & Confirm asks two questions about the same thing.** `UploadKindChoice`
   ("a new batch" vs "corrections to an earlier upload") sits directly above
   `DuplicateChoice` ("skip them — I'm re-uploading to fix errors" vs "book them
   again — this is a new batch"). Those are the same question phrased twice, and
   the second one restates the first one's answer in different words.

2. **The review page dumps every row on the screen.** Three tabs, all rows of the
   selected tab rendered unconditionally, plus a "Start a corrections upload"
   button that competes with the only two actions that matter (pay/confirm, and
   download the failures).

3. **A draft cannot be resumed.** Close the tab mid-setup, come back via
   "Continue setup", press "Submit for Processing", and you get *"Could not
   submit this upload. Please try again."* forever.

### Root cause of (3), stated exactly

`useBulkUploadDetail.js:327` calls `BulkUploadApi.create(uploadId)` with no
options. The file contains rows this customer has already booked, so
`api_views_bulk.py:741` refuses:

```json
{"duplicate_policy": ["This file contains rows you have already booked. Choose skip or book_again explicitly."]}
```

That is 111 bytes, which is exactly the `PATCH ... 400 111` in the reported log.
The refusal is correct — the backend must not guess whether to re-book and
re-charge 14 parcels. Two things around it are wrong:

* The hook reads only `err.response.data.detail`, and a DRF field error has no
  `detail` key, so the real message is discarded and replaced with a generic
  retry prompt. The user is told to retry an action that cannot succeed.
* Every rejected submit still spends a slot in the `bulk_upload` throttle bucket
  (`30/hour`, `settings.py:428`), even though no Celery task was dispatched. Hence
  the `429` that followed in the same log.

The `401` earlier in that log is ordinary access-token expiry followed by a
refresh-and-retry; not part of this work.

## Scope

Frontend `drop_and_roll_frontend` (branch `develop`) and backend
`drop_and_roll_backend` (branch `main_repo_sync`). No migrations — the backend
repo cannot ship them (`migrations/` is gitignored, deliberately), and none are
needed here.

## 1. One question: `ConfirmUploadChoice`

New component `src/components/business/ConfirmUploadChoice.jsx`. Deletes
`src/components/business/UploadKindChoice.jsx` and the `DuplicateChoice` export
in `BulkUploadFlow.jsx:937`.

```
What is this upload?

⚠ 14 rows already booked in bulk_upload_test_new        [show rows ▾]

( ) A new batch
    Books all 43 rows — including the 14 already booked. You are charged
    for all of them.

( ) Corrections to an earlier upload
    [ bulk_upload_test_new · 30 failed · 11 Aug 2026  ▼ ]
    Skips the 14 already booked. Nothing is booked or charged twice.
    You can paste the whole original file back in.

Choose one to continue.
```

### Props

```js
ConfirmUploadChoice({
  kind,             // "new" | "corrections" | null
  correctsUpload,   // uuid string | ""
  correctable,      // [{ id, batch_name, failed, created_at, label }]
  duplicateCount,   // number
  duplicateRows,    // [{ row_number, reference, matched_by }]  (capped at 20 by the API)
  matchedUpload,    // { id, batch_name, created_at } | null
  onChange,         // ({ kind, correctsUpload }) => void
})
```

### Rules

| Condition | Behaviour |
|---|---|
| `duplicateCount === 0` | `kind` defaults to `"new"`. No warning panel. One click to submit. |
| `duplicateCount > 0` | `kind` starts `null`. Warning panel above the radios. Submit disabled until a radio is picked. |
| `kind === "corrections"` | Picker shown. Submit disabled until a batch is chosen. `matchedUpload.id` is preselected when it appears in `correctable`. |
| `correctable` is empty | Picker replaced by prose saying there are no earlier batches to correct, so an empty `<select>` never appears. |

**Why nothing is preselected when duplicates exist.** This is the property the
old `DuplicateChoice` docstring was protecting and it survives the merge intact.
Both wrong answers cost money and only one is visible: a needless booking shows
up on an invoice, a needless skip is a parcel that never ships and nobody
notices. When `duplicateCount === 0` there is no money question, so defaulting
to "new batch" cannot decide anything and saves a click.

### Three pure functions, not two copies of the rules

The wizard and the draft banner both need identical gating and identical
payloads. Duplicating that logic in two components is how they eventually
disagree about whether a submit is legal. Same input, same output — so it is
deterministic work and lives in functions, exported alongside the component:

```js
resolveKind(kind, duplicateCount)          // null → "new" only when nothing is at stake
isConfirmIncomplete({ kind, correctsUpload, duplicateCount })  // drives `disabled`
confirmPayload({ kind, correctsUpload, duplicateCount })       // the PATCH body extras
```

Each is unit-tested directly; the components are tested for rendering and
wiring, not for re-deriving the rules.

### Wire mapping

`confirmPayload` returns:

| `kind` | `duplicateCount` | PATCH body (beyond `status: "submitted"`) |
|---|---|---|
| `new` | `> 0` | `duplicate_policy: "book_again"` |
| `new` | `0` | *(nothing — backend default matches nothing anyway)* |
| `corrections` | any | `corrects_upload: "<uuid>"` |

`corrects_upload` and `duplicate_policy` are never sent together; the backend
already rejects that combination (`api_views_bulk.py:718`) and
`BulkUploadApi.create` already enforces the exclusivity.

**One combination is deliberately dropped:** "new batch, but skip the rows I
already booked". A file whose already-booked rows should not re-book *is* a
corrections upload, and the widened picker in §5 makes that reachable in every
case where it used to be the only option.

### Backend is unchanged and still independent

`api_views_bulk.py:741` still 400s a submit that has duplicates and no explicit
answer. A disabled button is not a rule; the browser is one client.

## 2. Draft resume

### New endpoint

`GET /api/booking/bulk-uploads/{id}/confirm-context/`

```json
{
  "row_count": 43,
  "duplicate_count": 14,
  "duplicate_rows": [{"row_number": 7, "reference": "VALID-STD-02", "matched_by": "reference"}],
  "duplicate_matched_upload": {"id": "…", "batch_name": "bulk_upload_test_new", "created_at": "…"},
  "correctable": [{"id": "…", "batch_name": "…", "failed": 30, "created_at": "…", "label": "…"}]
}
```

Everything the merged question needs, in one round-trip. It parses the stored
file (via the existing `_duplicate_preview`, which never raises and degrades to
"no warning"), so it must not run on the 2-second poll — hence a separate
endpoint rather than more fields on `retrieve()`. Ownership is enforced by
`_get_owned_or_404`; another customer's id is a 404, not a 403.

`row_count` exists because the draft's `total_rows` is `0` until processing
creates rows, so today's banner reads "TOTAL ROWS 0" over a 43-row file. The
parse for the duplicate preview already produced the rows; counting them is free.

### Frontend

* `useBulkUploadDetail` fetches confirm-context once when `isDraft`, and exposes
  `confirmContext` plus `isLoadingConfirmContext`.
* `submitDraft(choice)` takes `{ kind, correctsUpload }` and forwards the mapped
  payload to `BulkUploadApi.create`.
* `BulkUploadDetail.jsx`'s "Not Submitted Yet" banner renders
  `ConfirmUploadChoice` between the explanation and the buttons. "Submit for
  Processing" is disabled by the same rules as the wizard's Continue.

### `extractApiError`

New `src/api/extractApiError.js`:

```
detail  →  first field-error array's first string  →  fallback message
```

Used by `submitDraft`, `discardDraft` and the wizard. This is why the user saw a
generic retry prompt instead of a message naming the actual problem, and it is a
class of bug rather than one instance.

### Throttle refund

`partial_update` refunds the `bulk_upload` throttle slot on every path that
returns 4xx **without** dispatching Celery. `get_throttles()` keeps the
instances it built for this request, and the refund undoes what
`SimpleRateThrottle.allow_request` wrote — it inserts `now` at the head of
`history` and re-caches:

```python
def _refund_throttle(self):
    for throttle in getattr(self, "_active_throttles", []):
        history = getattr(throttle, "history", None)
        key = getattr(throttle, "key", None)
        if not key or not history:
            continue
        history.pop(0)                      # newest-first; this request's entry
        cache.set(key, history, throttle.duration)
```

A rejected submit then costs nothing, which is the correct accounting: the
bucket exists to limit Celery dispatches, and a rejection dispatches none. The
guard covers the case where the throttle short-circuited without setting `key`
or `history` (no rate configured).

## 3. Review page

`BulkUploadReviewPage.jsx`, both mounts (`/bulk-upload/:id/review` and the
wizard's fifth step, `embedded`).

### Accordions

Three collapsed sections replacing the tablist. All closed on load:

```
▸ ⚠ Failed (30)
▸ ✓ Booked (12)
▸ ↷ Skipped (1)
```

Buttons carry `aria-expanded` and `aria-controls`; each panel is a `region`
labelled by its button. Row bodies are unchanged — same `FailedRows`,
`SuccessfulRows`, `SkippedRows` renderers, same Skipped-tab evidence line, which
stays because a correct skip and a bug look identical without it.

**Rows load on first expand, not on mount.** Today `load()` fires
`getErrors` + `getSuccessful` + `getSkipped` in parallel on every mount (six
requests under StrictMode, visible in the reported log) to populate tabs the
user may never open. Each section fetches once, caches, and shows a spinner
while in flight.

### Actions

Removed: the whole "Fix the N failed rows" section, including the
`Start a corrections upload` button. That flow still exists — New Upload, then
pick "Corrections to an earlier upload" at Review & Confirm — and the widened
picker in §5 means the batch being corrected is always in the list.

Footer:

* `⬇ Download error report` when `failed > 0`
* `Continue to payment — £X` (prepaid) or `Confirm and invoice — £X` (NET)

Zero booked: no payment button (there is nothing to pay for), a sentence saying
so, the download, and `← Back to uploads`.

Header is unchanged: counts, total, "Nothing has been charged yet", and the NET
auto-effect countdown.

## 4. Error export

New `?as=rows` variant of `GET /{id}/error-report/`, **one line per failed row**:

```
row_number,reference,column_name,error_code,error_message,suggested_fix,<original data columns…>
7,VALID-STD-02,pickup_postcode,POSTCODE_NOT_FOUND,"This postcode does not exist…","Check it against Royal Mail…",MK9 2AA,…
9,VALID-STD-05,"weight_kg; num_parcels",VALIDATION_ERROR,"Weight must be a number; Parcels must be at least 1","…",OX1 1AA,…
```

* A row with several errors joins them with `"; "` in each of the four
  diagnostic fields, de-duplicated in first-seen order (three errors on the same
  column must not print that column three times).
* `error_code` collapses to the single code when every error shares one.
* Original data columns follow, so the file is fixable and re-uploadable as-is:
  `validate_file` only rejects *missing* required columns, extra ones are ignored.

**Why not just reuse the existing enhanced report.** It emits one line *per
error*, so a row with three problems appears three times; re-uploading it would
book that parcel three times. It also emits `reference` twice, because
`reference` is both a diagnostic field and an entry in `OPTIONAL_COLUMNS`
(`serializers_bulk.py:78`) — a duplicate CSV header. Both are fixed: `rows`
suppresses data columns that collide with a diagnostic field name, and the same
suppression is applied to `enhanced`.

`as=rows` becomes the endpoint default. `as=enhanced` keeps the per-error shape
for ops; `as=template` is unchanged. Review page and detail page both download
`rows`, so the two screens stop disagreeing about what "the error report" is.

## 5. Corrections picker

`correctable` drops the `failed__gt=0` filter. It keeps the dedupe window (from
`dedupe_window_days()`, the same function the skip itself uses — two numbers here
would eventually disagree silently) and keeps excluding PENDING/PROCESSING
batches, whose failures are not known yet.

The old exclusion reasoned that a batch with no failures would skip every row and
book nothing. That is only true when the corrections file is a subset of the
parent. A corrections upload may carry brand-new rows alongside the ones being
skipped, and after the merge in §1 a customer whose duplicates matched a clean
batch has no other way to say "do not re-book these". Label reads
`… · no failures · 9 Aug 2026` for those.

## Testing

Gate lane only, both sides. This change has no latent-space component — no
prompt, no model call, nothing to score — so there is no eval suite to add. Said
explicitly rather than silently omitted.

### Frontend (jest)

`confirmChoice.test.js` — the three pure functions, every branch of the table
above, including the "corrections with no batch chosen" gate and the clean-file
path that sends no policy key at all.

`ConfirmUploadChoice.test.jsx`
* nothing preselected when `duplicateCount > 0`
* `new` preselected when `duplicateCount === 0`, and no warning panel rendered
* choosing corrections with no batch keeps the caller's gate true
* `matchedUpload.id` preselected when present in `correctable`
* evidence list collapsed by default, expands on click
* `onChange` payload for each transition

`BulkUploadFlow.steps.test.jsx` (updated)
* Submit disabled until a choice exists when duplicates are present
* PATCH body is `book_again` for new-with-duplicates, `corrects_upload` for
  corrections, and neither key when the file is clean

`BulkUploadReviewPage.test.jsx` (updated)
* all three sections collapsed on mount
* zero row-list requests until a section is expanded; exactly one per section
  thereafter
* no "Start a corrections upload" control anywhere
* download calls the API with `as: "rows"`
* zero-booked renders download + back, and no payment button

`BulkUploadDetail.test.jsx` (updated)
* draft banner renders the merged question from confirm-context
* submit forwards the mapped payload
* a 400 whose body is `{"duplicate_policy": [...]}` shows that message, not
  "Please try again"

### Backend (pytest, both `sqlite` and `DNR_TEST_DB=postgres`)

* `as=rows`: one line per failed row; the five required fields present; multi-error
  join; no duplicate header; the output re-passes `validate_file`
* `as=enhanced` still one line per error, and no longer emits a duplicate
  `reference` header
* `correctable` includes a finished zero-failure batch inside the window,
  excludes one outside it and one still PROCESSING
* `confirm-context` returns the preview and the list; 404 for another customer's
  upload; safe on a file that no longer parses
* throttle refund: repeated rejected submits do not exhaust the bucket; a
  dispatching submit does consume one

## Files

Backend
* `bookings/api_views_bulk.py` — `confirm_context` action, `correctable` filter,
  `_stream_row_error_csv`, header-collision fix, throttle refund
* `bookings/tests/tests_bulk*.py` — the cases above

Frontend
* `src/components/business/ConfirmUploadChoice.jsx` (new) + test
* `src/components/business/UploadKindChoice.jsx` (deleted, and its test)
* `src/components/business/BulkUploadFlow.jsx` — step 2 render, `DuplicateChoice`
  removed
* `src/components/business/BulkUploadReviewPage.jsx` — accordions, footer
* `src/components/business/BulkUploadDetail.jsx` — draft banner
* `src/hooks/useBulkUploadDetail.js` — confirm-context, `submitDraft(choice)`
* `src/api/BulkUploadApi.js` — `getConfirmContext`, `as: "rows"`
* `src/api/extractApiError.js` (new)

## Outcome this moves

* A resumed draft with already-booked rows can be submitted at all. Today it
  cannot: 100% of that path 400s, then 429s.
* Review page issues 0 row requests on load instead of 3 (6 under StrictMode),
  and renders 0 rows instead of up to 200.
* The review page's error download carries `column_name` / `error_code` /
  `error_message`, which it does not today, and stays re-uploadable, which the
  detail page's version is not.
* One question at Review & Confirm instead of two.
