/**
 * bulkMoney — gate tests.
 *
 * The bug these exist to prevent: the dashboard showing the same figure, in the
 * same colour, for a batch that has been paid and one that has not.
 */

import { bulkMoneyLine, money, MONEY_TONE_CLASS } from "./bulkMoney";

describe("money", () => {
  it("formats decimal strings to two places", () => {
    expect(money("392.9")).toBe("£392.90");
    expect(money("392.90")).toBe("£392.90");
    expect(money(392.9)).toBe("£392.90");
  });

  it("returns null for absent or unparseable input rather than £NaN", () => {
    expect(money(null)).toBeNull();
    expect(money(undefined)).toBeNull();
    expect(money("")).toBeNull();
    expect(money("not a number")).toBeNull();
  });

  it("formats zero as a real figure, not null", () => {
    // £0.00 is a valid amount on a fully-refunded invoice. Only ABSENCE is null.
    expect(money("0")).toBe("£0.00");
  });
});

describe("bulkMoneyLine", () => {
  it("returns null when the batch has no money at all", () => {
    // Rendering "£0.00" for a draft with no price reads as a price of zero.
    expect(bulkMoneyLine({})).toBeNull();
    expect(bulkMoneyLine({ computed_total: null })).toBeNull();
  });

  it("shows a bare total with no verdict when there is no invoice yet", () => {
    const line = bulkMoneyLine({ computed_total: "392.90" });
    expect(line).toEqual({ primary: "£392.90", secondary: null, tone: "neutral" });
  });

  it("says PAID for a settled invoice", () => {
    const line = bulkMoneyLine({
      receivable_amount: "392.90",
      receivable_paid_amount: "392.90",
      outstanding: "0.00",
      receivable_status: "paid",
    });
    expect(line.primary).toBe("£392.90 paid");
    expect(line.tone).toBe("paid");
    expect(line.secondary).toBeNull();
  });

  it("says DUE for an issued invoice nobody has paid", () => {
    const line = bulkMoneyLine({
      receivable_amount: "392.90",
      receivable_paid_amount: "0.00",
      outstanding: "392.90",
      receivable_status: "issued",
    });
    expect(line.primary).toBe("£392.90 due");
    expect(line.tone).toBe("owed");
  });

  it("splits paid from outstanding on a partial payment", () => {
    const line = bulkMoneyLine({
      receivable_amount: "392.90",
      receivable_paid_amount: "200.00",
      outstanding: "192.90",
      receivable_status: "partial",
    });
    expect(line.primary).toBe("£392.90");
    expect(line.secondary).toBe("£200.00 paid · £192.90 outstanding");
    expect(line.tone).toBe("owed");
  });

  it("flags an overdue invoice as owed AND overdue", () => {
    const line = bulkMoneyLine({
      receivable_amount: "392.90",
      outstanding: "392.90",
      receivable_status: "overdue",
    });
    expect(line.primary).toBe("£392.90 due");
    expect(line.secondary).toBe("Overdue");
    expect(line.tone).toBe("owed");
  });

  it("names a cancelled request instead of hiding it", () => {
    // A withdrawn demand that silently disappears is how a finance team pays an
    // invoice we already cancelled.
    const line = bulkMoneyLine({
      receivable_amount: "392.90",
      receivable_status: "cancelled",
    });
    expect(line.secondary).toBe("Cancelled");
    expect(line.tone).toBe("void");
  });

  it("distinguishes a paid batch from an uninvoiced one, both £0.00 outstanding", () => {
    // The regression this whole module exists for: `outstanding` alone cannot
    // tell these apart, and the old dashboard rendered them identically.
    const paid = bulkMoneyLine({
      receivable_amount: "392.90",
      receivable_paid_amount: "392.90",
      outstanding: "0.00",
      receivable_status: "paid",
    });
    const uninvoiced = bulkMoneyLine({ computed_total: "392.90" });

    expect(paid.primary).not.toBe(uninvoiced.primary);
    expect(paid.tone).not.toBe(uninvoiced.tone);
  });

  it("prefers the invoiced amount over the computed total when they disagree", () => {
    // The invoice is what the customer was actually asked for. A drifted
    // computed_total must never be the figure shown next to a payment status.
    const line = bulkMoneyLine({
      computed_total: "999.99",
      receivable_amount: "392.90",
      receivable_paid_amount: "392.90",
      receivable_status: "paid",
    });
    expect(line.primary).toBe("£392.90 paid");
  });

  it("has a tone class for every tone it can produce", () => {
    const tones = ["paid", "owed", "neutral", "void"];
    tones.forEach((t) => expect(MONEY_TONE_CLASS[t]).toBeTruthy());
  });
});
