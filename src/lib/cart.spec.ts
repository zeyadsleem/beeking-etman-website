import { describe, expect, it } from "vite-plus/test";
import {
  addItem,
  adjustQuantity,
  computeTotals,
  FREE_SHIPPING_THRESHOLD,
  linesToItems,
  removeItem,
  SHIPPING_COST,
} from "./cart";
import type { CartItem } from "./cart";

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
    expect(removeItem([item(product), item(other)], "v1").map((i) => i.variantId)).toEqual(["v2"]);
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

describe("linesToItems", () => {
  it("maps and clamps quantity to stock", () => {
    expect(linesToItems([{ variantId: "v1", quantity: 9 }], [product])).toEqual([
      { ...product, quantity: 3 },
    ]);
  });
  it("drops unknown variants", () => {
    expect(linesToItems([{ variantId: "nope", quantity: 1 }], [product])).toEqual([]);
  });
});
