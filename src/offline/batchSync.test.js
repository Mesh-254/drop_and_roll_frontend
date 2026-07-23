// offline/batchSync.test.js
//
// Unit tests for the pure batch-sync helpers (no IndexedDB / network needed):
//   * buildStatusEvents assigns per-booking sequence numbers from queue order
//   * reconcileBatch classifies applied / duplicate_ignored / conflict / unknown

import { buildStatusEvents, reconcileBatch } from "./batchSync";

describe("buildStatusEvents", () => {
  test("assigns per-booking sequence numbers in queue order", () => {
    const actions = [
      { localId: 1, clientActionId: "a", bookingId: "B1", payload: { status: "picked_up" } },
      { localId: 2, clientActionId: "b", bookingId: "B1", payload: { status: "at_hub" } },
      { localId: 3, clientActionId: "c", bookingId: "B2", payload: { status: "picked_up" } },
    ];

    const { events, byClientActionId } = buildStatusEvents(actions);

    expect(events).toHaveLength(3);
    // B1's two events get sequence 1 then 2 (order the driver performed them).
    expect(events[0]).toMatchObject({ booking_id: "B1", target_status: "picked_up", sequence: 1 });
    expect(events[1]).toMatchObject({ booking_id: "B1", target_status: "at_hub", sequence: 2 });
    // B2 restarts at 1 — sequence is scoped to the booking.
    expect(events[2]).toMatchObject({ booking_id: "B2", target_status: "picked_up", sequence: 1 });
    // Lookup maps every client_action_id back to its action.
    expect(byClientActionId.get("b").localId).toBe(2);
  });

  test("every event carries a client_timestamp", () => {
    const { events } = buildStatusEvents([
      { clientActionId: "a", bookingId: "B1", payload: { status: "picked_up" }, createdAt: 1_700_000_000_000 },
    ]);
    expect(typeof events[0].client_timestamp).toBe("string");
  });
});

describe("reconcileBatch", () => {
  const actions = [
    { localId: 1, clientActionId: "a", bookingId: "B1" },
    { localId: 2, clientActionId: "b", bookingId: "B1" },
    { localId: 3, clientActionId: "c", bookingId: "B2" },
  ];
  const byId = new Map(actions.map((a) => [a.clientActionId, a]));

  test("splits results into resolved, conflicts and unknown", () => {
    const results = [
      { client_action_id: "a", result: "applied" },
      { client_action_id: "b", result: "duplicate_ignored" },
      { client_action_id: "c", result: "conflict", reason: "not_route_owner", detail: "no longer yours" },
      { client_action_id: "zzz", result: "applied" }, // not in local queue
    ];

    const { resolved, conflicts, unknown } = reconcileBatch(results, byId);

    expect(resolved.map((r) => r.action.localId).sort()).toEqual([1, 2]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].action.localId).toBe(3);
    expect(conflicts[0].result.reason).toBe("not_route_owner");
    expect(unknown).toHaveLength(1);
  });

  test("tolerates a null results array", () => {
    const { resolved, conflicts, unknown } = reconcileBatch(null, byId);
    expect(resolved).toHaveLength(0);
    expect(conflicts).toHaveLength(0);
    expect(unknown).toHaveLength(0);
  });
});
