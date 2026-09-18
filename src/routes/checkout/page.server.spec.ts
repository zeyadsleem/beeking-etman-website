import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Cookies } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { actions, load } from "./+page.server";
import { createOrder } from "$lib/server/orders";
import { createAddress } from "$lib/server/addresses";
import { sendOrderConfirmation } from "$lib/server/email";
import { readOrderAccessCookie } from "$lib/server/order-access";
import { getCartSecret, readCartCookie, setCartCookie } from "$lib/server/cart-cookie";
import { t } from "$lib/i18n/messages";

vi.mock("$env/dynamic/private", () => ({
  env: { ORDER_ACCESS_SECRET: "secret", BETTER_AUTH_SECRET: "cart-secret" },
}));

// The signing key is derived from the auth secret (T12), so the spec signs
// and reads through the same resolver the app uses instead of a literal.
const CART_SECRET = getCartSecret(env);
vi.mock("$lib/server/db", () => ({ db: {} }));
vi.mock("$lib/server/orders", () => ({ createOrder: vi.fn() }));
vi.mock("$lib/server/addresses", () => ({
  createAddress: vi.fn(),
  listAddressSummaries: vi.fn().mockResolvedValue([]),
}));
vi.mock("$lib/server/email", () => ({ sendOrderConfirmation: vi.fn() }));
vi.mock("$lib/server/rate-limit", () => ({
  clientAddressKey: () => "test",
  createDbRateLimiter: () => ({ allow: async () => true }),
}));
vi.mock("$lib/server/store", () => ({
  resolveCartItems: async () => ({ items: [{ price: 100, quantity: 1 }], missing: [] }),
}));

function cookieJar(): Cookies {
  const values = new Map<string, string>();
  return {
    get: (name) => values.get(name),
    getAll: () => [...values].map(([name, value]) => ({ name, value })),
    set: vi.fn((name, value) => {
      values.set(name, value);
    }),
    delete: vi.fn((name) => {
      values.delete(name);
    }),
    serialize: () => "",
  };
}

function event(cookies: Cookies, nonce: string = crypto.randomUUID(), method = "cod") {
  return {
    cookies,
    locals: {},
    request: new Request("https://example.com/checkout?/submit", {
      method: "POST",
      body: new URLSearchParams({
        nonce,
        email: "guest@example.com",
        name: "Guest User",
        phone: "01012345678",
        address: "Street 123",
        city: "Cairo",
        governorate: "cairo",
        paymentMethod: method,
        saveAddress: "on",
      }),
    }),
    setHeaders: vi.fn(),
  } as unknown as Parameters<NonNullable<typeof actions.submit>>[0];
}

async function checkout(cookies: Cookies): Promise<string> {
  setCartCookie(cookies, CART_SECRET, [{ variantId: "variant", quantity: 1 }]);
  const data = await load(event(cookies) as unknown as Parameters<typeof load>[0]);
  return (data as { nonce: string }).nonce;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createOrder).mockResolvedValue({
    ok: true,
    outcome: "created",
    orderId: "order-id",
    orderNumber: "HNY-123456",
    total: 100,
  });
  vi.mocked(createAddress).mockResolvedValue({ ok: true } as Awaited<
    ReturnType<typeof createAddress>
  >);
});

describe("checkout nonce ownership", () => {
  it("rejects a copied guest nonce before calling the order service", async () => {
    const nonce = await checkout(cookieJar());
    const stranger = cookieJar();
    await checkout(stranger);
    const result = await actions.submit(event(stranger, nonce));
    expect(result).toMatchObject({ status: 403 });
    expect(createOrder).not.toHaveBeenCalled();
    expect(await readOrderAccessCookie(stranger, "order-id", "secret")).toBe(false);
  });

  it("accepts both tabs and retains proof for retries", async () => {
    const cookies = cookieJar();
    const first = await checkout(cookies);
    const second = await checkout(cookies);
    expect(first).not.toBe(second);
    for (const nonce of [first, second, first]) {
      await expect(actions.submit(event(cookies, nonce))).rejects.toMatchObject({ status: 303 });
    }
    expect(createOrder).toHaveBeenCalledTimes(3);
    expect(await readOrderAccessCookie(cookies, "order-id", "secret")).toBe(true);
  });

  it("preserves a new cart and skips address and email on replay", async () => {
    const cookies = cookieJar();
    const nonce = await checkout(cookies);
    vi.mocked(createOrder).mockResolvedValue({
      ok: true,
      outcome: "replayed",
      orderId: "order-id",
      orderNumber: "HNY-123456",
      total: 100,
    });
    const newCart = [{ variantId: "new-variant", quantity: 2 }];
    setCartCookie(cookies, CART_SECRET, newCart);
    const submission = event(cookies, nonce);
    submission.locals.user = { id: "user-id" } as App.Locals["user"];
    await expect(actions.submit(submission)).rejects.toMatchObject({
      status: 303,
      location: "/checkout/success/order-id?replayed=1",
    });
    expect(readCartCookie(cookies, CART_SECRET)).toEqual(newCart);
    expect(createAddress).not.toHaveBeenCalled();
    expect(sendOrderConfirmation).not.toHaveBeenCalled();
    expect(await readOrderAccessCookie(cookies, "order-id", "secret")).toBe(true);
  });

  it("rejects a method that is not configured", async () => {
    const cookies = cookieJar();
    const nonce = await checkout(cookies);
    // The test env configures no transfer accounts, so instapay is unavailable.
    const result = await actions.submit(event(cookies, nonce, "instapay"));
    expect(result).toMatchObject({ status: 400 });
    expect((result as { data: { errors: Record<string, string> } }).data.errors.paymentMethod).toBe(
      t("ar", "checkout.methodUnavailable"),
    );
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("clears the cart and runs post-order work for a created order", async () => {
    const cookies = cookieJar();
    const nonce = await checkout(cookies);
    const submission = event(cookies, nonce);
    submission.locals.user = { id: "user-id" } as App.Locals["user"];
    await expect(actions.submit(submission)).rejects.toMatchObject({
      status: 303,
      location: "/checkout/success/order-id",
    });
    expect(readCartCookie(cookies, CART_SECRET)).toEqual([]);
    expect(createAddress).toHaveBeenCalledTimes(1);
    expect(sendOrderConfirmation).toHaveBeenCalledTimes(1);
  });
});
