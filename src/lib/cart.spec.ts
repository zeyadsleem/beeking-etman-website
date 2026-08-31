import { describe, expect, it } from "vite-plus/test";
import {
  addBlendItem,
  addItem,
  adjustBlendQuantity,
  adjustQuantity,
  blendItemSignature,
  blendTotal,
  computeTotals,
  FREE_SHIPPING_THRESHOLD,
  isBlendItem,
  itemId,
  lineTotal,
  removeById,
  removeItem,
  SHIPPING_COST,
} from "./cart";
import type { BlendCartItem, CartItem } from "./cart";

const product = {
  variantId: "v1",
  productId: "p1",
  name: "عسل سدر مصري",
  variantName: "500 جرام",
  slug: "sidr-egyptian",
  categorySlug: "sidr",
  department: "honey",
  image: "https://example.com/honey.jpg",
  price: 380_00,
  stock: 3,
};

function item(p = product, quantity = 1): CartItem {
  return { ...p, quantity };
}

describe("addItem", () => {
  it("adds a new line", () => {
    expect(addItem([], product, 2)).toEqual([{ ...product, quantity: 2 }]);
  });
  it("merges into the same variant line", () => {
    expect(addItem([item(product, 1)], product, 2)[0].quantity).toBe(3);
  });
  it("does not merge different variants of the same product", () => {
    const other = { ...product, variantId: "v2", variantName: "1 ك", price: 700_00 };
    expect(addItem([item(product, 1)], other, 1)).toHaveLength(2);
  });
  it("clamps to stock", () => {
    expect(addItem([item(product, 2)], product, 5)[0].quantity).toBe(3);
  });
  it("never adds a zero-stock variant", () => {
    expect(addItem([], { ...product, stock: 0 }, 1)).toEqual([]);
  });
});

describe("adjustQuantity", () => {
  it("increments by variant", () => {
    expect(adjustQuantity([item(product, 1)], "v1", 1)[0].quantity).toBe(2);
  });
  it("removes the line when it hits zero", () => {
    expect(adjustQuantity([item(product, 1)], "v1", -1)).toEqual([]);
  });
  it("clamps to stock", () => {
    expect(adjustQuantity([item(product, 3)], "v1", 1)[0].quantity).toBe(3);
  });
});

describe("removeItem", () => {
  it("removes only the matching variant", () => {
    const other = { ...product, variantId: "v2" };
    expect(
      removeItem([item(product), item(other)], "v1").map((i) =>
        isBlendItem(i) ? "" : i.variantId,
      ),
    ).toEqual(["v2"]);
  });
});

describe("computeTotals", () => {
  it("returns a zero cart", () => {
    expect(computeTotals([])).toEqual({ itemCount: 0, subtotal: 0, shipping: 0, total: 0 });
  });
  it("applies shipping below the threshold", () => {
    const totals = computeTotals([item({ ...product, price: 300_00 }, 1)]);
    expect(totals.shipping).toBe(SHIPPING_COST);
    expect(totals.total).toBe(300_00 + SHIPPING_COST);
  });
  it("free shipping at and above the threshold", () => {
    expect(computeTotals([item({ ...product, price: FREE_SHIPPING_THRESHOLD }, 1)]).shipping).toBe(
      0,
    );
  });
});

const blend = (overrides: Partial<BlendCartItem> = {}): BlendCartItem => ({
  kind: "blend",
  id: "blend-1",
  baseVariantId: "base-1",
  productId: "p-base",
  name: "عسل سدر مصري",
  variantName: "نص كيلو",
  image: "https://example.com/honey.jpg",
  jarSize: "half",
  basePrice: 380_00,
  stock: 5,
  quantity: 1,
  additives: [
    {
      key: "royalJelly",
      variantId: "rj-1",
      productId: "p-rj",
      name: "غذاء ملكات",
      image: "https://example.com/rj.jpg",
      qty: 1,
      price: 85_00,
      stock: 3,
    },
    {
      key: "propolis",
      variantId: "pr-1",
      productId: "p-pr",
      name: "بروبليس",
      image: "https://example.com/pr.jpg",
      qty: 2,
      price: 160_00,
      stock: 4,
    },
  ],
  ...overrides,
});

describe("blend items", () => {
  it("isBlendItem and itemId resolve a blend by id", () => {
    expect(isBlendItem(blend())).toBe(true);
    expect(itemId(blend())).toBe("blend-1");
    expect(itemId(item(product))).toBe("v1");
  });
  it("blendTotal sums base and additive doses", () => {
    expect(blendTotal(blend())).toBe(380_00 + 85_00 + 2 * 160_00);
  });
  it("lineTotal equals blendTotal for blends and price×qty otherwise", () => {
    expect(lineTotal(blend())).toBe(blendTotal(blend()));
    expect(lineTotal(blend({ quantity: 5 }))).toBe(blendTotal(blend()) * 5);
    expect(lineTotal(item(product, 2))).toBe(2 * 380_00);
  });
  it("addBlendItem appends with a generated id", () => {
    const { id: _id, kind: _kind, ...rest } = blend();
    const added = addBlendItem([], rest)[0];
    expect(isBlendItem(added)).toBe(true);
    if (isBlendItem(added)) {
      expect(added.id).toMatch(/^blend-/);
      expect(added).toMatchObject(rest);
    }
  });
  it("removeById removes only the matching line", () => {
    const regular = item(product);
    const lines: CartItem[] = [regular, blend()];
    expect(removeById(lines, "blend-1")).toEqual([regular]);
    expect(removeById(lines, "v1")).toEqual([blend()]);
  });
  it("computeTotals includes additive doses and counts quantity", () => {
    const totals = computeTotals([blend()]);
    expect(totals.itemCount).toBe(1);
    expect(totals.subtotal).toBe(380_00 + 85_00 + 2 * 160_00);

    const multi = computeTotals([blend({ quantity: 3 })]);
    expect(multi.itemCount).toBe(3);
    expect(multi.subtotal).toBe((380_00 + 85_00 + 2 * 160_00) * 3);
  });
  it("adjustQuantity and removeItem never touch blends", () => {
    const lines: CartItem[] = [blend()];
    expect(adjustQuantity(lines, "rj-1", -1)).toEqual(lines);
    expect(removeItem(lines, "rj-1")).toEqual(lines);
  });
  it("adjustBlendQuantity increments by id and removes at zero", () => {
    const lines: CartItem[] = [blend()];
    const up = adjustBlendQuantity(lines, "blend-1", 2);
    expect(isBlendItem(up[0])).toBe(true);
    if (isBlendItem(up[0])) expect(up[0].quantity).toBe(3);
    expect(adjustBlendQuantity(lines, "blend-1", -1)).toHaveLength(0);
  });
  it("adjustBlendQuantity clamps to the blend stock cap", () => {
    const lines: CartItem[] = [blend({ stock: 4 })];
    const out = adjustBlendQuantity(lines, "blend-1", 3);
    expect(isBlendItem(out[0])).toBe(true);
    if (isBlendItem(out[0])) expect(out[0].quantity).toBe(4);
  });
});

describe("blendItemSignature", () => {
  it("produces a deterministic key from composition", () => {
    const b = blend();
    const sig = blendItemSignature(b.baseVariantId, b.jarSize, b.additives);
    expect(sig).toBe("base-1:half:pr-1:2,rj-1:1");
  });
  it("is order-independent for additives", () => {
    const b = blend();
    const shuffled = [...b.additives].reverse();
    const sig1 = blendItemSignature(b.baseVariantId, b.jarSize, b.additives);
    const sig2 = blendItemSignature(b.baseVariantId, b.jarSize, shuffled);
    expect(sig1).toBe(sig2);
  });
  it("differs when base variant differs", () => {
    const b = blend();
    const sig1 = blendItemSignature(b.baseVariantId, b.jarSize, b.additives);
    const sig2 = blendItemSignature("base-2", b.jarSize, b.additives);
    expect(sig1).not.toBe(sig2);
  });
  it("differs when jar size differs", () => {
    const b = blend();
    const sig1 = blendItemSignature(b.baseVariantId, "half", b.additives);
    const sig2 = blendItemSignature(b.baseVariantId, "full", b.additives);
    expect(sig1).not.toBe(sig2);
  });
  it("differs when additives differ", () => {
    const b = blend();
    const sig1 = blendItemSignature(b.baseVariantId, b.jarSize, b.additives);
    const sig2 = blendItemSignature(
      b.baseVariantId,
      b.jarSize,
      b.additives.filter((a) => a.key !== "propolis"),
    );
    expect(sig1).not.toBe(sig2);
  });
});

describe("addBlendItem merging", () => {
  it("merges identical blends into one line with incremented quantity", () => {
    const b = blend();
    const { id: _id, kind: _kind, ...rest } = b;
    const cart = addBlendItem([], rest);
    const merged = addBlendItem(cart, rest);
    expect(merged).toHaveLength(1);
    expect(isBlendItem(merged[0])).toBe(true);
    if (isBlendItem(merged[0])) {
      expect(merged[0].quantity).toBe(2);
    }
  });
  it("keeps different blends as separate lines", () => {
    const b1 = blend();
    const b2 = blend({ baseVariantId: "base-2" });
    const { id: _1, kind: _k1, ...r1 } = b1;
    const { id: _2, kind: _k2, ...r2 } = b2;
    const cart = addBlendItem([], r1);
    const result = addBlendItem(cart, r2);
    expect(result).toHaveLength(2);
  });
  it("merges three identical blends into quantity 3", () => {
    const { id: _id, kind: _kind, ...rest } = blend();
    let cart: CartItem[] = [];
    cart = addBlendItem(cart, rest);
    cart = addBlendItem(cart, rest);
    cart = addBlendItem(cart, rest);
    expect(cart).toHaveLength(1);
    if (isBlendItem(cart[0])) {
      expect(cart[0].quantity).toBe(3);
    }
  });
  it("merges by summing the incoming quantity, capped at stock", () => {
    const { id: _id, kind: _kind, ...rest } = blend({ quantity: 2, stock: 5 });
    let cart = addBlendItem([], rest);
    cart = addBlendItem(cart, rest);
    expect(cart).toHaveLength(1);
    if (isBlendItem(cart[0])) expect(cart[0].quantity).toBe(4);

    const capped = addBlendItem(cart, { ...rest, quantity: 2 });
    expect(capped).toHaveLength(1);
    if (isBlendItem(capped[0])) expect(capped[0].quantity).toBe(5);
  });
  it("does not merge blends with different additives", () => {
    const b1 = blend();
    const b2 = blend({ additives: [{ ...b1.additives[0], qty: 3 }] });
    const { id: _1, kind: _k1, ...r1 } = b1;
    const { id: _2, kind: _k2, ...r2 } = b2;
    const cart = addBlendItem([], r1);
    const result = addBlendItem(cart, r2);
    expect(result).toHaveLength(2);
  });
});
