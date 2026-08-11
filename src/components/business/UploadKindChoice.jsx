import { FilePlus2, Wrench } from "lucide-react";

/**
 * UploadKindChoice — "is this a new batch, or corrections to an earlier upload?"
 *
 * Asked at Review & Confirm, before dispatch. That is the last moment at which
 * the answer can still change the outcome: afterwards a policy would describe a
 * run that already happened.
 *
 * WHY IT IS DECLARED RATHER THAN INFERRED. Nothing in a file distinguishes "I
 * fixed the six bad rows" from "this is next week's run of the same route". The
 * template has no date column, so a weekly repeat is byte-identical to a
 * corrections re-upload. The customer knows which it is, so they are asked.
 *
 * WHY IT IS SHOWN ON EVERY UPLOAD, unlike DuplicateChoice. This is a statement
 * of intent, not a reaction to a detection. Waiting for matching rows to appear
 * would mean the question only shows up when the system already half-knows the
 * answer, and never for the customer whose corrections file happens to contain
 * no rows we can match.
 *
 * WHY "A NEW BATCH" IS PRESELECTED, when the skip/book-again question deliberately
 * has no default. Because it cannot cause a silent double-booking: if the file
 * really does contain rows that are already booked, DuplicateChoice still fires
 * and still refuses to guess. This default only saves a click on the uploads that
 * need no decision. A default on THAT question would have decided real money.
 *
 * Choosing corrections forces duplicate_policy=skip server-side, so the customer
 * can paste the whole original file back in and only the fixed rows book.
 */
export function UploadKindChoice({ kind, correctsUpload, correctable = [], onChange }) {
  const hasCorrectable = correctable.length > 0;

  return (
    <fieldset className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">
        What is this upload?
      </legend>

      <label className="mt-1 flex items-start gap-3 cursor-pointer">
        <input
          type="radio"
          name="upload-kind"
          value="new"
          checked={kind === "new"}
          onChange={() => onChange({ kind: "new", correctsUpload: "" })}
          className="mt-1"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
            <FilePlus2 className="h-4 w-4" /> A new batch
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            Books every row in this file.
          </span>
        </span>
      </label>

      <label className="mt-3 flex items-start gap-3 cursor-pointer">
        <input
          type="radio"
          name="upload-kind"
          value="corrections"
          checked={kind === "corrections"}
          onChange={() => onChange({ kind: "corrections", correctsUpload })}
          className="mt-1"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
            <Wrench className="h-4 w-4" /> Corrections to an earlier upload
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            Skips anything you have already booked, so nothing is booked or
            charged twice. You can paste the whole original file back in.
          </span>
        </span>
      </label>

      {kind === "corrections" &&
        (hasCorrectable ? (
          <label className="mt-3 block text-sm">
            <span className="block text-gray-700 dark:text-gray-300">
              Which batch are you correcting?
            </span>
            <select
              value={correctsUpload}
              onChange={(e) => onChange({ kind: "corrections", correctsUpload: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-gray-900 dark:text-white"
            >
              <option value="">Choose a batch</option>
              {correctable.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          // Says why rather than presenting an empty dropdown. The list is
          // narrowed to finished batches with failures inside the dedupe
          // window, so "empty" is a real answer, not a loading state.
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            No earlier uploads of yours have failed rows to correct.
          </p>
        ))}
    </fieldset>
  );
}

export default UploadKindChoice;
