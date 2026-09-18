import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { formatEGP } from "$lib/currency";
import { t } from "$lib/i18n/messages";
import type { DashboardStats } from "$lib/server/admin/stats";
import type { Lang } from "$lib/i18n/messages";
import DashboardPage from "./+page.svelte";

// Intl currency formatting embeds non-breaking spaces; vitest-browser
// normalizes those in element text, so expectations get the same collapse.
function normalized(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

const stats: DashboardStats = {
  kpis: {
    revenue: 123_456,
    orders: 42,
    customers: 17,
    byStatus: {
      pending_confirmation: 10,
      confirmed: 0,
      processing: 0,
      shipped: 8,
      delivered: 20,
      cancelled: 4,
    },
  },
  dailySeries: [
    { day: "2026-08-23", revenue: 50_00, orders: 1 },
    { day: "2026-08-24", revenue: 123_456, orders: 3 },
  ],
  topProducts: [{ name: "sidr", quantity: 12, revenue: 300_00 }],
  lowStock: [{ productId: "p-1", productName: "عسل سدر", variantName: "كيلو", stock: 2 }],
};

async function expectDashboardIn(lang: Lang): Promise<void> {
  // Every user-facing string must come from the catalog via t(); the expected
  // values below are derived from the same keys, so a hardcoded literal or a
  // missing catalog entry fails here in either language.
  await expect
    .element(page.getByTestId("admin-stats-title"))
    .toHaveTextContent(t(lang, "admin.stats.title"));
  await expect
    .element(page.getByTestId("stat-revenue"))
    .toHaveTextContent(normalized(formatEGP(stats.kpis.revenue, lang)));
  await expect
    .element(page.getByTestId("stat-orders"))
    .toHaveTextContent(String(stats.kpis.orders));
  await expect
    .element(page.getByTestId("stat-customers"))
    .toHaveTextContent(String(stats.kpis.customers));
  await expect
    .element(page.getByTestId("status-breakdown"))
    .toHaveTextContent(t(lang, "admin.stats.byStatus"));
  await expect
    .element(page.getByTestId("status-chip-pending_confirmation"))
    .toHaveTextContent(t(lang, "admin.orders.pending_confirmation"));
  await expect
    .element(page.getByTestId("status-chip-cancelled"))
    .toHaveTextContent(t(lang, "admin.orders.cancelled"));
  await expect
    .element(page.getByTestId("series-heading"))
    .toHaveTextContent(t(lang, "admin.stats.last30Days"));
  await expect
    .element(page.getByTestId("series-table"))
    .toHaveTextContent(t(lang, "admin.stats.day"));
  await expect
    .element(page.getByTestId("top-products-table"))
    .toHaveTextContent(normalized(formatEGP(stats.topProducts[0]!.revenue, lang)));
  const lowStockLink = page.getByTestId("low-stock-link");
  await expect.element(lowStockLink).toHaveAttribute("href", "/admin/products/p-1");
  await expect.element(lowStockLink).toHaveTextContent("عسل سدر");
}

describe("admin dashboard page", () => {
  it("renders every section through the Arabic catalog", async () => {
    render(DashboardPage, { data: { stats, lang: "ar" } });

    await expectDashboardIn("ar");
    await expect.element(page.getByText(t("ar", "admin.stats.noLowStock"))).not.toBeInTheDocument();
  });

  it("renders every section through the English catalog", async () => {
    render(DashboardPage, { data: { stats, lang: "en" } });

    await expectDashboardIn("en");
    // The Task 3 placeholder hardcoded Arabic section names; none of them may
    // leak back into the English render.
    await expect.element(page.getByText("لوحة الأدمن")).not.toBeInTheDocument();
  });

  it("shows the healthy-stock message instead of links when nothing is low", async () => {
    render(DashboardPage, { data: { stats: { ...stats, lowStock: [] }, lang: "en" } });

    await expect.element(page.getByText(t("en", "admin.stats.noLowStock"))).toBeInTheDocument();
    await expect.element(page.getByTestId("low-stock-link")).not.toBeInTheDocument();
  });
});
