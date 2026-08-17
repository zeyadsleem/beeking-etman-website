import { describe, expect, it } from "vite-plus/test";
import {
  addBlendItem,
  addItem,
  adjustQuantity,
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
  it("computeTotals includes additive doses and counts quantity as 1", () => {
    const totals = computeTotals([blend()]);
    expect(totals.itemCount).toBe(1);
    expect(totals.subtotal).toBe(380_00 + 85_00 + 2 * 160_00);
  });
  it("adjustQuantity and removeItem never touch blends", () => {
    const lines: CartItem[] = [blend()];
    expect(adjustQuantity(lines, "rj-1", -1)).toEqual(lines);
    expect(removeItem(lines, "rj-1")).toEqual(lines);
  });
});
