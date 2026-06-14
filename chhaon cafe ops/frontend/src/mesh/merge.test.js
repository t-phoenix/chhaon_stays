import {
  canAdvanceItemStatus,
  deriveOrderStatus,
  mergeOrderLWW,
  pickItemStatus,
  replayOps,
  sortOps,
} from "./merge";

describe("merge engine", () => {
  test("status machine allows forward transitions only", () => {
    expect(canAdvanceItemStatus("new", "preparing")).toBe(true);
    expect(canAdvanceItemStatus("preparing", "ready")).toBe(true);
    expect(canAdvanceItemStatus("ready", "new")).toBe(false);
    expect(canAdvanceItemStatus("ready", "ready")).toBe(true);
  });

  test("admin override allows backward status", () => {
    expect(canAdvanceItemStatus("ready", "new", true)).toBe(true);
    expect(pickItemStatus("ready", "new", { adminOverride: true })).toBe("new");
  });

  test("same transition higher lamport wins", () => {
    expect(pickItemStatus("new", "preparing", { lamportCurrent: 1, lamportIncoming: 5 })).toBe("preparing");
    expect(pickItemStatus("preparing", "new", { lamportCurrent: 5, lamportIncoming: 1 })).toBe("preparing");
  });

  test("LWW order merge by lamport", () => {
    const local = { id: "1", guest_name: "A", updated_at: "2020-01-01T00:00:00Z", items: [] };
    const remote = { id: "1", guest_name: "B", updated_at: "2020-01-02T00:00:00Z", items: [] };
    const { order, winner } = mergeOrderLWW(local, remote, { lamportLocal: 2, lamportRemote: 5 });
    expect(winner).toBe("remote");
    expect(order.guest_name).toBe("B");
  });

  test("replay ops applies item status in lamport order", () => {
    const order = {
      id: "o1",
      items: [{ line_id: "l1", status: "new", name: "Chai", quantity: 1 }],
      guest_name: "Guest",
    };
    const ops = sortOps([
      {
        opId: "a",
        lamport: 2,
        entityId: "o1",
        action: "item_status",
        payload: { line_id: "l1", status: "preparing" },
        ts: "2020-01-01T00:00:01Z",
      },
      {
        opId: "b",
        lamport: 3,
        entityId: "o1",
        action: "item_status",
        payload: { line_id: "l1", status: "ready" },
        ts: "2020-01-01T00:00:02Z",
      },
    ]);
    const result = replayOps({ o1: order }, ops);
    expect(result.o1.items[0].status).toBe("ready");
    expect(deriveOrderStatus(result.o1.items)).toBe("ready");
  });

  test("backward item status ignored without admin override", () => {
    const order = {
      id: "o1",
      items: [{ line_id: "l1", status: "ready", name: "Chai", quantity: 1 }],
    };
    const ops = [
      {
        opId: "x",
        lamport: 10,
        entityId: "o1",
        action: "item_status",
        payload: { line_id: "l1", status: "new" },
        ts: "2020-01-01T00:00:03Z",
      },
    ];
    const result = replayOps({ o1: order }, ops);
    expect(result.o1.items[0].status).toBe("ready");
  });

  test("delete op removes order", () => {
    const order = { id: "o1", items: [], guest_name: "X" };
    const ops = [{ opId: "d", lamport: 1, entityId: "o1", action: "delete", payload: {} }];
    const result = replayOps({ o1: order }, ops);
    expect(result.o1).toBeUndefined();
  });
});
