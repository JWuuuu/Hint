import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const enabled = process.env.HINT_ISOLATED_DB === "1";
let database: typeof import("@workspace/db");
describe.skipIf(!enabled)("isolated receipt first-open consistency", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== "postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality") throw new Error("Refusing a non-isolated test database");
    database = await import("@workspace/db");
  });
  afterAll(async () => { await database?.pool.end(); });
  it.each(["animal-tarot", "sky-deck", "energy-score", "collection-rare-reward"] as const)("keeps the first committed %s opening when another read is stale", async featureType => {
    const { getOrCreateDailyReceipt, openDailyReceipt } = await import("../modules/hint/dailyReceipts");
    const anonymousDeviceId = `open-race-${crypto.randomUUID()}`;
    const args = { anonymousDeviceId, featureType, dailyKey: "2026-11-10" };
    const assigned = await getOrCreateDailyReceipt(args);
    let release!: () => void; let reached!: () => void;
    const barrier = new Promise<void>(resolve => { reached = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    const update = database.db.update.bind(database.db);
    // Pause only after the real database returned the first request's unopened
    // receipt. Let the competing request commit before this stale read continues.
    const spy = vi.spyOn(database.db, "update").mockImplementationOnce((...params) => {
      const builder = update(...params);
      const set = builder.set.bind(builder);
      builder.set = ((values: any) => {
        const query = set(values);
        const returning = query.returning.bind(query);
        query.returning = ((...columns: any[]) => Promise.resolve((returning as any)(...columns)).then(async rows => { reached(); await resume; return rows; })) as any;
        return query;
      }) as typeof builder.set;
      return builder;
    });
    const delayed = openDailyReceipt({ ...args, now: new Date("2026-11-10T10:00:00Z") });
    try {
      await barrier;
      const first = await openDailyReceipt({ ...args, now: new Date("2026-11-10T10:00:01Z") });
      release();
      const second = await delayed;
      expect(second.openedAt).toEqual(first.openedAt);
      expect(second.assignedCardId).toBe(assigned.assignedCardId);
      const stored = await getOrCreateDailyReceipt(args);
      expect(stored.openedAt).toEqual(first.openedAt);
    } finally { release(); await delayed; spy.mockRestore(); }
  });
});
