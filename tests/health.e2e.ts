import { expect, test } from "@playwright/test";

test("production build starts with isolated bindings and a working database", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});
