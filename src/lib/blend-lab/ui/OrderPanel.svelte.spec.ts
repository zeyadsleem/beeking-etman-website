import { page } from "vite-plus/test/browser";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { BlendsGame } from "$lib/blend-lab/game-state.svelte";
import { formatEGP } from "$lib/currency";
import { jarLabel, type AdditiveKey, type BaseHoneyOption, type JarSize } from "$lib/blends";
import { t } from "$lib/i18n/messages";
import type { CatalogEntry } from "./catalog";
import OrderPanelHost from "./OrderPanel.host.svelte";

type AdditiveEntry = CatalogEntry & { key: AdditiveKey; label: string };

const { addBlendMock, openDrawerMock } = vi.hoisted(() => ({
  addBlendMock: vi.fn(),
  openDrawerMock: vi.fn(),
}));

vi.mock("$lib/cart-store.svelte", () => ({
  addBlend: addBlendMock,
  openDrawer: openDrawerMock,
}));

// toHaveTextContent collapses whitespace (incl. U+00A0 from Intl EGP output)
// on the actual side only, so expectations must be normalized the same way.
function norm(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const BASE_ENTRY: CatalogEntry = {
  productId: "prod-sidr",
  variantId: "var-sidr-full",
  name: "عسل سدر",
  image: "/img/sidr.webp",
  price: 450_00,
  stock: 7,
};

function additive(key: AdditiveKey, label: string, price: number, stock: number): AdditiveEntry {
  return {
    key,
    label,
    productId: `prod-${key}`,
    variantId: `var-${key}`,
    name: label,
    image: `/img/${key}.webp`,
    price,
    stock,
  };
}

interface Fixture {
  baseHoneys: Map<BaseHoneyOption["id"], Record<JarSize, CatalogEntry>>;
  additives: Map<AdditiveKey, AdditiveEntry>;
}

function makeFixture(baseStock = BASE_ENTRY.stock): Fixture {
  const entries = [
    additive("royalJelly", "غذاء ملكات", 120_00, 5),
    additive("ginseng", "جينسنج", 90_00, 10),
    additive("palmPollen", "طلع النخل", 75_00, 8),
  ];
  return {
    baseHoneys: new Map<BaseHoneyOption["id"], Record<JarSize, CatalogEntry>>([
      [
        "sidr",
        {
          half: { ...BASE_ENTRY, variantId: "var-sidr-half", stock: baseStock },
          full: { ...BASE_ENTRY, stock: baseStock },
        },
      ],
    ]),
    additives: new Map(entries.map((e) => [e.key, e])),
  };
}

function orderGame(): BlendsGame {
  const game = new BlendsGame();
  game.selectGoal("vitality");
  game.selectHoney("sidr");
  game.startStir();
  game.forceFinishStir();
  game.completePour();
  return game;
}

// vitality preset doses on a full jar
const DOSED_KEYS: AdditiveKey[] = ["royalJelly", "ginseng", "palmPollen"];
const DEFAULT_FIXTURE = makeFixture();
const UNIT_PRICE =
  BASE_ENTRY.price +
  DOSED_KEYS.reduce((sum, k) => sum + (DEFAULT_FIXTURE.additives.get(k)?.price ?? 0) * 2, 0);

const LANG = "ar" as const;
const BLEND_IMAGE = "/img/blends/sidr-mix.webp";

async function renderPanel(game: BlendsGame, fixture: Fixture = DEFAULT_FIXTURE) {
  render(OrderPanelHost, {
    props: { game, lang: LANG, ...fixture, blendImage: BLEND_IMAGE },
  });
}

describe("OrderPanel", () => {
  beforeEach(() => {
    addBlendMock.mockClear();
    openDrawerMock.mockClear();
  });

  it("lists the base honey, dosed additives, unit price and total", async () => {
    await renderPanel(orderGame());

    const panel = page.getByTestId("blends-order-panel");
    const baseLine = `${BASE_ENTRY.name} · ${jarLabel(LANG, "full")} — ${formatEGP(BASE_ENTRY.price, LANG)}`;
    await expect.element(panel).toHaveTextContent(norm(baseLine));

    await expect
      .element(panel)
      .toHaveTextContent(norm(`+ غذاء ملكات ×2 — ${formatEGP(120_00 * 2, LANG)}`));
    await expect
      .element(panel)
      .toHaveTextContent(norm(`+ جينسنج ×2 — ${formatEGP(90_00 * 2, LANG)}`));
    await expect
      .element(panel)
      .toHaveTextContent(norm(`+ طلع النخل ×2 — ${formatEGP(75_00 * 2, LANG)}`));
    await expect
      .element(panel)
      .toHaveTextContent(
        norm(`${t(LANG, "blends.game.order.unitPrice")}: ${formatEGP(UNIT_PRICE, LANG)}`),
      );

    await expect
      .element(page.getByTestId("order-total"))
      .toHaveTextContent(
        norm(`${t(LANG, "blends.game.order.total")}: ${formatEGP(UNIT_PRICE, LANG)}`),
      );
  });

  it("caps the picker at the composite stock floor and updates the total", async () => {
    const game = orderGame();
    await renderPanel(game);

    // stocks: base 7, royalJelly 5/2=2, ginseng 10/2=5, palmPollen 8/2=4 → max 2;
    // the picker disables + once value reaches max.
    const increase = page.getByRole("button", { name: t(LANG, "qty.increase") });
    await increase.click();

    expect(game.quantity).toBe(2);
    await expect.element(increase).toBeDisabled();
    await expect
      .element(page.getByTestId("order-total"))
      .toHaveTextContent(norm(formatEGP(UNIT_PRICE * 2, LANG)));
  });

  it("adds one cart line per ordered jar with a schema-exact payload, then opens the drawer", async () => {
    const game = orderGame();
    await renderPanel(game);

    const add = page.getByTestId("add-to-cart-btn");
    await add.click();
    expect(addBlendMock).toHaveBeenCalledTimes(1);
    expect(addBlendMock).toHaveBeenCalledWith({
      baseVariantId: BASE_ENTRY.variantId,
      productId: BASE_ENTRY.productId,
      name: BASE_ENTRY.name,
      variantName: jarLabel(LANG, "full"),
      image: BLEND_IMAGE,
      jarSize: "full",
      basePrice: BASE_ENTRY.price,
      stock: BASE_ENTRY.stock,
      quantity: 1,
      additives: [
        {
          key: "royalJelly",
          variantId: "var-royalJelly",
          productId: "prod-royalJelly",
          name: "غذاء ملكات",
          image: "/img/royalJelly.webp",
          qty: 2,
          price: 120_00,
          stock: 5,
        },
        {
          key: "ginseng",
          variantId: "var-ginseng",
          productId: "prod-ginseng",
          name: "جينسنج",
          image: "/img/ginseng.webp",
          qty: 2,
          price: 90_00,
          stock: 10,
        },
        {
          key: "palmPollen",
          variantId: "var-palmPollen",
          productId: "prod-palmPollen",
          name: "طلع النخل",
          image: "/img/palmPollen.webp",
          qty: 2,
          price: 75_00,
          stock: 8,
        },
      ],
    });
    expect(openDrawerMock).toHaveBeenCalledTimes(1);
  });

  it("adds one line per jar when several jars are ordered", async () => {
    const game = orderGame();
    await renderPanel(game);

    await page.getByRole("button", { name: t(LANG, "qty.increase") }).click();

    await page.getByTestId("add-to-cart-btn").click();
    expect(addBlendMock).toHaveBeenCalledTimes(2);
    for (const call of addBlendMock.mock.calls) {
      expect(call[0]).toMatchObject({ quantity: 1, baseVariantId: BASE_ENTRY.variantId });
    }
    expect(openDrawerMock).toHaveBeenCalledTimes(1);
  });

  it("disables ordering and shows the out-of-stock label when the base is out of stock", async () => {
    const game = orderGame();
    await renderPanel(game, makeFixture(0));

    const add = page.getByTestId("add-to-cart-btn");
    await expect.element(add).toBeDisabled();
    await expect.element(add).toHaveTextContent(t(LANG, "blends.game.order.outOfStock"));
  });

  it("disables ordering when the selected base honey is missing from the catalog", async () => {
    const game = orderGame();
    const fixture = makeFixture();
    fixture.baseHoneys.delete("sidr");
    await renderPanel(game, fixture);

    await expect.element(page.getByTestId("add-to-cart-btn")).toBeDisabled();
    expect(addBlendMock).not.toHaveBeenCalled();
  });

  it("restarts the game from the panel", async () => {
    const game = orderGame();
    await renderPanel(game);

    await page.getByRole("button", { name: t(LANG, "blends.game.restart") }).click();
    expect(game.step).toBe("goal");
    expect(game.quantity).toBe(1);
    expect(game.jarFill).toBe(0);
  });
});
