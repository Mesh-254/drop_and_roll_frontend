import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, FilePlus2, Wrench } from "lucide-react";
import { resolveKind } from "./confirmChoice";

/**
 * ConfirmUploadChoice — "is this a new batch, or corrections to an earlier upload?"
 *
 * ONE question. This screen used to ask two: "a new batch vs corrections to an
 * earlier upload", and immediately below it "skip the rows you already booked vs
 * book them again". The second restates the first one's answer in different
 * words, and answering them inconsistently was possible.
 *
 * Asked at Review & Confirm, before dispatch — the last moment at which the
 * answer can still change the outcome. Afterwards a policy would describe a run
 * that already happened.
 *
 * WHAT THE WARNING IS FOR. When the file contains rows this customer already
 * booked, the panel above the radios says so, names the batch, and lists the
 * rows behind a disclosure. "You booked these before" is not checkable by
 * someone who never typed a reference unless we say WHICH rows and WHERE.
 *
 * Nothing is preselected in that case. See resolveKind for why, and why the
 * clean-file case is different.
 */
export function ConfirmUploadChoice({
  kind,
  correctsUpload,
  correctable = [],
  duplicateCount = 0,
  duplicateRows = [],
  matchedUpload = null,
  onChange,
  idPrefix = "confirm",
}) {
  const [showRows, setShowRows] = useState(false);
  const resolved = resolveKind(kind, duplicateCount);
  const hasCorrectable = correctable.length > 0;

  // Preselect the batch the duplicate detector already identified: it is the
  // one the customer is correcting in almost every case, and it is only a
  // default for a field they can still change.
  const suggestedParent = useMemo(() => {
    if (!matchedUpload) return "";
    return correctable.some((b) => b.id === matchedUpload.id) ? matchedUpload.id : "";
  }, [matchedUpload, correctable]);

  const choose = (nextKind) =>
    onChange({
      kind: nextKind,
      correctsUpload: nextKind === "corrections" ? correctsUpload || suggestedParent : "",
    });

  return (
    <fieldset className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">
        What is this upload?
      </legend>

      {duplicateCount > 0 && (
        <DuplicateWarning
          count={duplicateCount}
          rows={duplicateRows}
          matchedUpload={matchedUpload}
          expanded={showRows}
          onToggle={() => setShowRows((v) => !v)}
          idPrefix={idPrefix}
        />
      )}

      <label className="mt-3 flex items-start gap-3 cursor-pointer">
        <input
          type="radio"
          name={`${idPrefix}-upload-kind`}
          value="new"
          checked={resolved === "new"}
          onChange={() => choose("new")}
          className="mt-1"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
            <FilePlus2 className="h-4 w-4" /> A new batch
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {duplicateCount > 0
              ? `Books every row, including the ${duplicateCount} already booked. You are charged for all of them.`
              : "Books every row in this file."}
          </span>
        </span>
      </label>

      <label className="mt-3 flex items-start gap-3 cursor-pointer">
        <input
          type="radio"
          name={`${idPrefix}-upload-kind`}
          value="corrections"
          checked={resolved === "corrections"}
          onChange={() => choose("corrections")}
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

      {resolved === "corrections" &&
        (hasCorrectable ? (
          <label className="mt-3 block text-sm">
            <span className="block text-gray-700 dark:text-gray-300">
              Which batch are you correcting?
            </span>
            <select
              value={correctsUpload || ""}
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
          // narrowed to finished batches inside the dedupe window, so "empty" is
          // a real answer, not a loading state.
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            You have no earlier uploads to correct.
          </p>
        ))}

      {resolved === null && (
        <p className="mt-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
          Choose one to continue.
        </p>
      )}
    </fieldset>
  );
}

/**
 * The evidence, collapsed. A count on its own is an assertion; the rows are what
 * make it checkable. Collapsed because a 200-row repeat would otherwise bury the
 * question it exists to support.
 */
function DuplicateWarning({ count, rows, matchedUpload, expanded, onToggle, idPrefix }) {
  const panelId = `${idPrefix}-duplicate-rows`;
  const batch = matchedUpload?.batch_name;

  return (
    <div className="mt-1 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-3">
      <div className="flex gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            {count} row{count === 1 ? "" : "s"} already booked
            {batch ? (
              <>
                {" "}
                in <span className="font-normal">{batch}</span>
              </>
            ) : null}
          </p>
          {rows.length > 0 && (
            <>
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                {expanded ? "Hide rows" : "Show rows"}
              </button>
              {expanded && (
                <ul id={panelId} className="mt-2 space-y-1">
                  {rows.map((r) => (
                    <li
                      key={r.row_number}
                      className="text-xs font-mono text-amber-700 dark:text-amber-300/90"
                    >
                      {/* Each row identifies itself the way it was actually
                          matched: a blank reference column is matched on content,
                          and calling that a "duplicate reference" would read as a
                          system error. */}
                      {r.matched_by === "reference" && r.reference
                        ? r.reference
                        : `Row ${r.row_number} (matched by contents)`}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400/70">
            A row repeated inside this one file is always skipped, whichever you
            pick.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConfirmUploadChoice;
