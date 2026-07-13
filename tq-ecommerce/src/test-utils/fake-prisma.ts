/**
 * Fake in-memory Prisma client for testing /api/integration/* and
 * /api/admin/compras/* route handlers end-to-end (route → src/lib/inventory.ts)
 * without a live Postgres instance. Covers only the query shapes these
 * routes use. See fake-tx.ts for the equivalent used to unit-test
 * inventory.ts alone.
 */
export interface FakeVariant {
  id: string;
  sku: string;
  stock: number;
  price?: number;
  costPrice?: number | null;
  stockAlert?: number;
  productId?: string;
  size?: string | null;
}

export interface FakeProduct {
  id: string;
  sku: string;
  name: string;
  slug: string;
  supplierCode?: string | null;
  categoryId?: string;
}

export interface FakeCategory {
  id: string;
  name: string;
  slug: string;
}

export interface FakeSupplier {
  id: string;
  name: string;
}

export interface FakePurchaseOrderItem {
  id: string;
  variantSku: string;
  quantity: number;
  unitCost: number | null;
}

export interface FakePurchaseOrder {
  id: string;
  supplierId: string;
  status: string;
  total: number | null;
  items: FakePurchaseOrderItem[];
  createdAt?: Date;
}

export interface FakePrismaSeed {
  variants?: FakeVariant[];
  products?: FakeProduct[];
  categories?: FakeCategory[];
  suppliers?: FakeSupplier[];
  purchaseOrders?: FakePurchaseOrder[];
}

function applyStockData(v: FakeVariant, data: any) {
  if (typeof data.stock === "number") v.stock = data.stock;
  else if (data.stock?.increment !== undefined) v.stock += data.stock.increment;
  else if (data.stock?.decrement !== undefined) v.stock -= data.stock.decrement;
  if (data.costPrice !== undefined) v.costPrice = data.costPrice;
}

function project<T extends object>(v: T, select: any): any {
  if (!select) return { ...v };
  const out: any = {};
  for (const key of Object.keys(select)) if (select[key]) out[key] = (v as any)[key];
  return out;
}

let idSeq = 0;
function nextId(prefix: string) {
  return `${prefix}-${++idSeq}`;
}

export function createFakePrisma(input: FakeVariant[] | FakePrismaSeed = []) {
  const seed: FakePrismaSeed = Array.isArray(input) ? { variants: input } : input;

  const variants = new Map<string, FakeVariant>((seed.variants ?? []).map((v) => [v.id, { ...v }]));
  const products = new Map<string, FakeProduct>((seed.products ?? []).map((p) => [p.id, { ...p }]));
  const categories = new Map<string, FakeCategory>((seed.categories ?? []).map((c) => [c.id, { ...c }]));
  const suppliers = new Map<string, FakeSupplier>((seed.suppliers ?? []).map((s) => [s.id, { ...s }]));
  const purchaseOrders = new Map<string, FakePurchaseOrder>(
    (seed.purchaseOrders ?? []).map((o) => [
      o.id,
      { ...o, createdAt: o.createdAt ?? new Date(0), items: o.items.map((i) => ({ ...i })) },
    ])
  );
  const movements: any[] = [];
  let movementSeq = 0;

  function findVariantBy(where: any): FakeVariant | undefined {
    if (where.id) return variants.get(where.id);
    if (where.sku) return [...variants.values()].find((v) => v.sku === where.sku);
    return undefined;
  }

  const productVariant = {
    async findMany({ where, select }: any = {}) {
      let list = [...variants.values()];
      if (where?.sku?.in) list = list.filter((v) => where.sku.in.includes(v.sku));
      if (where?.productId) list = list.filter((v) => v.productId === where.productId);
      return list.map((v) => project(v, select));
    },
    async findFirst({ where, select }: any = {}) {
      let list = [...variants.values()];
      if (where?.productId) list = list.filter((v) => v.productId === where.productId);
      return list.length ? project(list[0], select) : null;
    },
    async findUnique({ where, select }: any) {
      const v = findVariantBy(where);
      return v ? project(v, select) : null;
    },
    async updateMany({ where, data }: any) {
      const v = where.id ? variants.get(where.id) : findVariantBy(where);
      if (!v) return { count: 0 };
      if (where.stock?.gte !== undefined && v.stock < where.stock.gte) return { count: 0 };
      applyStockData(v, data);
      return { count: 1 };
    },
    async update({ where, data }: any) {
      const v = findVariantBy(where);
      if (!v) throw new Error("record not found");
      applyStockData(v, data);
      return { ...v };
    },
    async create({ data }: any) {
      const v: FakeVariant = {
        id: nextId("var"),
        sku: data.sku,
        stock: data.stock ?? 0,
        price: data.price !== undefined ? Number(data.price) : undefined,
        size: data.size ?? null,
        productId: data.productId,
      };
      variants.set(v.id, v);
      return { ...v };
    },
  };

  const category = {
    async findFirst({ where }: any) {
      return [...categories.values()].find((c) => !where?.name || c.name === where.name) ?? null;
    },
    async findUnique({ where }: any) {
      return [...categories.values()].find((c) => c.slug === where.slug) ?? null;
    },
    async create({ data }: any) {
      const c: FakeCategory = { id: nextId("cat"), name: data.name, slug: data.slug };
      categories.set(c.id, c);
      return { ...c };
    },
  };

  const product = {
    async findMany({ where, select }: any = {}) {
      let list = [...products.values()];
      if (where?.supplierCode?.in) list = list.filter((p) => p.supplierCode && where.supplierCode.in.includes(p.supplierCode));
      return list.map((p) => {
        const base = project(p, select);
        if (select?.variants) {
          base.variants = [...variants.values()]
            .filter((v) => v.productId === p.id)
            .map((v) => project(v, select.variants.select));
        }
        return base;
      });
    },
    async create({ data }: any) {
      const p: FakeProduct = {
        id: nextId("prod"),
        sku: data.sku,
        name: data.name,
        slug: data.slug,
        supplierCode: data.supplierCode ?? null,
        categoryId: data.categoryId,
      };
      products.set(p.id, p);
      return { ...p };
    },
  };

  const supplier = {
    async findFirst({ where }: any) {
      return [...suppliers.values()].find((s) => !where?.name || s.name === where.name) ?? null;
    },
    async create({ data }: any) {
      const s: FakeSupplier = { id: nextId("sup"), name: data.name };
      suppliers.set(s.id, s);
      return { ...s };
    },
  };

  const purchaseOrder = {
    async findMany({ orderBy, take, include }: any = {}) {
      let list = [...purchaseOrders.values()];
      if (orderBy?.createdAt === "desc") list = list.slice().reverse();
      if (take) list = list.slice(0, take);
      return list.map((o) => ({
        ...o,
        supplier: include?.supplier ? project(suppliers.get(o.supplierId)!, include.supplier.select) : undefined,
      }));
    },
    async findUnique({ where, include }: any) {
      const o = purchaseOrders.get(where.id);
      if (!o) return null;
      return { ...o, items: include?.items ? o.items.map((i) => ({ ...i })) : undefined };
    },
    async create({ data }: any) {
      const items: FakePurchaseOrderItem[] = (data.items?.create ?? []).map((i: any) => ({
        id: nextId("poi"),
        variantSku: i.variantSku,
        quantity: i.quantity,
        unitCost: i.unitCost ?? null,
      }));
      const o: FakePurchaseOrder = {
        id: nextId("po"),
        supplierId: data.supplierId,
        status: data.status ?? "PENDIENTE",
        total: data.total ?? null,
        items,
        createdAt: new Date(0),
      };
      purchaseOrders.set(o.id, o);
      return { ...o };
    },
    async update({ where, data }: any) {
      const o = purchaseOrders.get(where.id);
      if (!o) throw new Error("purchase order not found");
      Object.assign(o, data);
      return { ...o };
    },
  };

  const stockMovement = {
    async findFirst({ where }: any) {
      return (
        movements.find(
          (m) => (!where.type || m.type === where.type) && (!where.reference || m.reference === where.reference)
        ) ?? null
      );
    },
    async create({ data }: any) {
      const movement = { id: `mv-${++movementSeq}`, ...data };
      movements.push(movement);
      return movement;
    },
  };

  const client: any = {
    productVariant,
    stockMovement,
    category,
    product,
    supplier,
    purchaseOrder,
    async $transaction(fn: any) {
      if (typeof fn !== "function") return Promise.all(fn);
      return fn(client);
    },
  };

  return { prisma: client, variants, products, categories, suppliers, purchaseOrders, movements };
}
