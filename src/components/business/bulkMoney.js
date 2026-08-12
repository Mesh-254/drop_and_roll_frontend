/**
 * bulkMoney — what a batch's money line says, as one pure function.
 *
 * WHY THIS IS NOT INLINE JSX. The dashboard rendered `£{computed_total}` and
 * nothing else, which states what the batch COST and says nothing about whether
 * any of it has been paid: a settled batch and an unpaid one showed the
 * identical figure in the identical colour. The question "has this been paid"
 * has one correct answer per input, so it is decided here and asserted in tests
 * rather than re-derived in a component that cannot be run without a DOM.
 *
 * WHY NOT JUST READ `outstanding`. £0.00 outstanding is ambiguous on its own:
 * it is true of a fully paid invoice AND of a batch that has no invoice at all.
 * The status is what separates them, so both are required.
 *
 * WHY THE LABEL COMES FROM THE SERVER. `receivable_document_status` is produced
 * by payments/invoice_documents.document_status_label — the same function that
 * stamps the PDF and feeds the Billing badge. Re-deriving the wording here is
 * how the dashboard chip, the Billing chip and the document itself end up
 * disagreeing about one invoice.
 */

/** Format a decimal-string or number as £X.YZ. Returns null for absent input. */
export function money(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(n)) return null;
  return `£${n.toFixed(2)}`;
}

/**
 * The money line for one upload row.
 *
 * Returns { primary, secondary, tone } where:
 *   primary   — the headline figure, always present when any amount is known
 *   secondary — the balance detail, or null when there is nothing to add
 *   tone      — "paid" | "owed" | "neutral" | "void", for the caller to colour
 *
 * Returns null when the batch has no money attached at all, so the caller can
 * render nothing rather than "£0.00", which reads as a real price of zero.
 */
export function bulkMoneyLine(upload = {}) {
  const total =
    upload.receivable_amount ?? upload.computed_total ?? upload.effective_total ?? null;
  const primary = money(total);
  if (primary === null) return null;

  const status = upload.receivable_status || null;

  // No invoice yet: the batch has a price but nobody has been asked for it.
  // Saying "due" here would be a demand we have not actually made.
  if (!status) {
    return { primary, secondary: null, tone: "neutral" };
  }

  const paid = money(upload.receivable_paid_amount);
  const outstanding = money(upload.outstanding);

  if (status === "cancelled") {
    // Named, not hidden. A cancelled request that silently disappears is how a
    // finance team pays an invoice that was withdrawn.
    return { primary, secondary: "Cancelled", tone: "void" };
  }

  if (status === "paid") {
    return { primary: `${primary} paid`, secondary: null, tone: "paid" };
  }

  if (status === "partial") {
    return {
      primary,
      secondary: `${paid ?? "£0.00"} paid · ${outstanding ?? primary} outstanding`,
      tone: "owed",
    };
  }

  // issued / draft / overdue — money asked for and not yet received.
  return {
    primary: `${primary} due`,
    secondary: status === "overdue" ? "Overdue" : null,
    tone: "owed",
  };
}

/** Tailwind classes per tone, kept beside the rule that produces the tone. */
export const MONEY_TONE_CLASS = {
  paid: "text-green-400",
  owed: "text-amber-400",
  neutral: "text-slate-300",
  void: "text-slate-500 line-through",
};
