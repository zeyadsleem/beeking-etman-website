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
  productId: "p1",
  name: "عسل سدر",
  slug: "sidr-natural",
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
  it("merges into an existing line", () => {
    expect(addItem([item(product, 1)], product, 2)[0].quantity).toBe(3);
  });
  it("clamps to stock", () => {
    expect(addItem([item(product, 2)], product, 5)[0].quantity).toBe(3);
  });
  it("never adds a zero-stock product", () => {
    expect(addItem([], { ...product, stock: 0 }, 1)).toEqual([]);
  });
});

describe("adjustQuantity", () => {
  it("increments", () => {
    expect(adjustQuantity([item(product, 1)], product.productId, 1)[0].quantity).toBe(2);
  });
  it("removes the line when it hits zero", () => {
    expect(adjustQuantity([item(product, 1)], product.productId, -1)).toEqual([]);
  });
  it("clamps to stock", () => {
    expect(adjustQuantity([item(product, 3)], product.productId, 1)[0].quantity).toBe(3);
  });
});

describe("removeItem", () => {
  it("removes only the matching product", () => {
    const other = { ...product, productId: "p2" };
    expect(
      removeItem([item(product), item(other)], product.productId).map((i) => i.productId),
    ).toEqual(["p2"]);
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
    expect(
      computeTotals([item({ ...product, price: FREE_SHIPPING_THRESHOLD + 1 }, 1)]).shipping,
    ).toBe(0);
  });
  it("multiplies quantity into subtotal", () => {
    expect(computeTotals([item({ ...product, price: 100_00 }, 3)]).subtotal).toBe(300_00);
  });
});

describe("linesToItems", () => {
  it("maps and clamps quantity to stock", () => {
    expect(linesToItems([{ productId: "p1", quantity: 9 }], [product])).toEqual([
      { ...product, quantity: 3 },
    ]);
  });
  it("drops unknown products", () => {
    expect(linesToItems([{ productId: "nope", quantity: 1 }], [product])).toEqual([]);
  });
});
