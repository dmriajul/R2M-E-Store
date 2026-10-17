/** Test-only Prisma contract double. NEVER imported by application code; NOT live-database proof. */
import { randomUUID } from "node:crypto";
import type { PrismaDelegate, PrismaLikeClient } from "../../lib/prisma";

type Row = Record<string, unknown>;
type Args = { where?: Row; data?: Row; create?: Row; update?: Row; select?: Row; include?: Row; take?: number; skip?: number; orderBy?: Row };
const tables = ["user", "verificationToken", "roleChange", "product", "order", "orderItem", "returnRequest", "productVariant", "coupon", "category", "review", "wishlistItem", "address", "siteSettings"] as const;
type Table = typeof tables[number];

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([field, expected]) => {
    if (field === "OR") return (expected as Row[]).some((entry) => matches(row, entry));
    if (field === "AND") return (Array.isArray(expected) ? expected : [expected]).every((entry) => matches(row, entry as Row));
    const value = row[field];
    if (expected && typeof expected === "object" && !(expected instanceof Date) && !Array.isArray(expected)) {
      const filter = expected as Row;
      return Object.entries(filter).every(([operator, operand]) => {
        const left = value instanceof Date ? value.getTime() : value;
        const right = operand instanceof Date ? operand.getTime() : operand;
        switch (operator) {
          case "mode": return true;
          case "equals": return filter.mode === "insensitive" ? String(value).toLowerCase() === String(operand).toLowerCase() : value === operand;
          case "in": return (operand as unknown[]).includes(value);
          case "notIn": return !(operand as unknown[]).includes(value);
          case "not": return !matches(row, { [field]: operand });
          case "gte": return (left as number) >= (right as number);
          case "gt": return (left as number) > (right as number);
          case "lte": return (left as number) <= (right as number);
          case "lt": return (left as number) < (right as number);
          case "contains": return String(value).toLowerCase().includes(String(operand).toLowerCase());
          default: throw new Error(`Unsupported test filter: ${operator}`);
        }
      });
    }
    return value === expected;
  });
}
function apply(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) row[key] = Number(row[key]) + Number(value.increment);
    else if (value && typeof value === "object" && "decrement" in value) row[key] = Number(row[key]) - Number(value.decrement);
    else row[key] = value;
  }
}
export function createTestDatabase(seed: Partial<Record<Table, Row[]>> = {}) {
  let rows = Object.fromEntries(tables.map((name) => [name, structuredClone(seed[name] ?? [])])) as Record<Table, Row[]>;
  function project(table: Table, row: Row, args: Args): Row {
    let result = { ...row };
    if (args.include?.variants && table === "product") result.variants = rows.productVariant.filter((entry) => entry.productId === row.id);
    if (args.include?.items && table === "order") result.items = rows.orderItem.filter((entry) => entry.orderId === row.id);
    if (args.include?.user && table === "order") result.user = rows.user.find((entry) => entry.id === row.userId);
    if (args.select) result = Object.fromEntries(Object.keys(args.select).filter((key) => args.select![key]).map((key) => [key, result[key]]));
    return structuredClone(result);
  }
  function create(table: Table, data: Row): Row {
    const unique = table === "user" ? ["email"] : table === "verificationToken" ? ["identifier", "token"] : table === "order" ? ["orderNumber"] : [];
    if (rows[table].some((row) => unique.some((key) => data[key] !== undefined && row[key] === data[key]))) throw { code: "P2002" };
    const row: Row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
    if (table === "user") Object.assign(row, { deletedAt: null, emailVerified: null, avatar: null, ...data });
    if (table === "order" && data.items && typeof data.items === "object" && "create" in data.items) {
      for (const line of data.items.create as Row[]) create("orderItem", { ...line, orderId: row.id });
      delete row.items;
    }
    rows[table].push(row);
    return row;
  }
  const delegates = Object.fromEntries(tables.map((table): [Table, PrismaDelegate] => {
    const args = (value?: unknown) => (value ?? {}) as Args;
    const find = (value?: unknown) => rows[table].find((row) => matches(row, args(value).where));
    return [table, {
      findFirst: async (value) => { const row = find(value); return row ? project(table, row, args(value)) : null; },
      findUnique: async (value) => { const row = find(value); return row ? project(table, row, args(value)) : null; },
      findMany: async (value) => rows[table].filter((row) => matches(row, args(value).where)).slice(args(value).skip ?? 0, args(value).take ? (args(value).skip ?? 0) + args(value).take! : undefined).map((row) => project(table, row, args(value))),
      count: async (value) => rows[table].filter((row) => matches(row, args(value).where)).length,
      create: async (value) => project(table, create(table, args(value).data ?? {}), args(value)),
      upsert: async (value) => { let row = find(value); if (row) apply(row, args(value).update ?? {}); else row = create(table, args(value).create ?? {}); return project(table, row, args(value)); },
      update: async (value) => { const row = find(value); if (!row) throw { code: "P2025" }; apply(row, args(value).data ?? {}); return project(table, row, args(value)); },
      updateMany: async (value) => { const found = rows[table].filter((row) => matches(row, args(value).where)); for (const row of found) apply(row, args(value).data ?? {}); return { count: found.length }; },
      delete: async (value) => { const row = find(value); if (!row) throw { code: "P2025" }; rows[table] = rows[table].filter((entry) => entry !== row); return project(table, row, args(value)); },
      deleteMany: async (value) => { const found = rows[table].filter((row) => matches(row, args(value).where)); rows[table] = rows[table].filter((row) => !found.includes(row)); return { count: found.length }; },
    }];
  })) as Record<Table, PrismaDelegate>;
  let queue = Promise.resolve();
  const db: PrismaLikeClient = { ...delegates, $transaction: async (operation) => {
    const transaction = queue.then(async () => {
      const snapshot = structuredClone(rows);
      try { return await operation(db); } catch (error) { rows = snapshot; throw error; }
    });
    queue = transaction.then(() => {}, () => {});
    return transaction;
  } };
  return { db, rows: (table: Table) => structuredClone(rows[table]) };
}
export function installTestDatabase(seed: Partial<Record<Table, Row[]>> = {}) {
  const fixture = createTestDatabase(seed);
  process.env.DATABASE_URL = "postgresql://isolated.invalid/mukra-test";
  const scope = globalThis as typeof globalThis & { prisma?: PrismaLikeClient; prismaUnavailable?: boolean };
  scope.prisma = fixture.db;
  delete scope.prismaUnavailable;
  return fixture;
}
