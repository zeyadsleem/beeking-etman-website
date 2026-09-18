import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { formatEGP } from "$lib/currency";
import { formatDate, t } from "$lib/i18n/messages";
import type {
  AdminOrderItemRow,
  AdminOrderRow,
  AdminOrderSettlement,
  OrderStatus,
} from "$lib/server/admin/orders";
import type { ActionData } from "./$types";
import OrderDetailPage from "./+page.svelte";

// Intl currency formatting embeds non-breaking spaces; vitest-browser
// normalizes those in element text, so expectations get the same collapse.
function normalized(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

interface DetailEvent {
  id: string;
  type: string;
  actor: string;
  actorUserId: string | null;
  reference: string | null;
  note: string | null;
  createdAt: number;
}

interface SettlementFlags {
  canVerify: boolean;
  canReject: boolean;
  canRefund: boolean;
  canExtendHold: boolean;
}

type DetailOrder = AdminOrderRow & { shippingCost: number } & AdminOrderSettlement;

const order: DetailOrder = {
  id: "order-1",
  number: "HNY-000001",
  email: "a@example.com",
  name: "أحمد",
  phone: "01012345678",
  address: "شارع 9",
  city: "القاهرة",
  total: 100_00,
  shippingCost: 0,
  status: "pending_confirmation",
  paymentStatus: "simulated",
  paymentMethod: "instapay",
  paymentReference: null,
  paymentClaimedAt: null,
  paymentReviewedAt: null,
  paymentReviewedBy: null,
  holdExpiresAt: null,
  paidAt: null,
  createdAt: Date.parse("2026-08-23T10:00:00Z"),
};

const items: AdminOrderItemRow[] = [
  {
    id: "item-1",
    productId: "product-1",
    productName: "عسل سدر مصري",
    variantName: "كيلو",
    quantity: 2,
    unitPrice: 50_00,
  },
];

interface DetailOverrides {
  order?: Partial<DetailOrder>;
  events?: DetailEvent[];
  settlement?: SettlementFlags;
  reviewerLabel?: string | null;
}

function detailData(
  transitions: readonly OrderStatus[],
  customerWhatsappUrl: string | null = "https://wa.me/201000000000?text=order",
  overrides: DetailOverrides = {},
): {
  data: {
    order: DetailOrder;
    items: AdminOrderItemRow[];
    events: DetailEvent[];
    settlement: SettlementFlags;
    reviewerLabel: string | null;
    transitions: readonly OrderStatus[];
    customerWhatsappUrl: string | null;
    lang: "ar";
  };
  form: ActionData;
} {
  // ActionData is `… | null`: the page renders identically with no action result.
  return {
    data: {
      order: { ...order, ...overrides.order },
      items,
      events: overrides.events ?? [],
      settlement: overrides.settlement ?? {
        canVerify: false,
        canReject: false,
        canRefund: false,
        canExtendHold: true,
      },
      reviewerLabel: overrides.reviewerLabel ?? null,
      transitions,
      customerWhatsappUrl,
      lang: "ar",
    },
    form: null,
  };
}

describe("admin order detail transitions", () => {
  it("keeps non-destructive transitions as direct form submits", async () => {
    render(OrderDetailPage, detailData(["shipped", "delivered"]));

    const shipped = page.getByRole("button", { name: t("ar", "admin.order.markShipped") });
    await expect.element(shipped).toHaveAttribute("type", "submit");
    const delivered = page.getByRole("button", { name: t("ar", "admin.order.markDelivered") });
    await expect.element(delivered).toHaveAttribute("type", "submit");
    // No destructive action offered here, so no dialog ever mounts.
    await expect.element(page.getByTestId("cancel-confirm-dialog")).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog instead of submitting on cancel", async () => {
    render(OrderDetailPage, detailData(["shipped", "cancelled"]));

    const trigger = page.getByRole("button", { name: t("ar", "admin.order.cancel") });
    // The trigger must not be a submit button: one click can never fire the
    // irreversible restocking transition directly.
    await expect.element(trigger).toHaveAttribute("type", "button");
    await trigger.click();

    const dialog = page.getByTestId("cancel-confirm-dialog");
    await expect.element(dialog).toBeInTheDocument();
    await expect.element(dialog).toHaveTextContent(t("ar", "admin.order.confirmCancel"));
  });

  it("closes the dialog without cancelling when dismissed", async () => {
    render(OrderDetailPage, detailData(["cancelled"]));

    await page.getByRole("button", { name: t("ar", "admin.order.cancel") }).click();
    const dialog = page.getByTestId("cancel-confirm-dialog");
    await expect.element(dialog).toBeInTheDocument();

    // Scoped + exact: the Arabic dismiss label ("إلغاء") is a prefix of the
    // trigger label ("إلغاء الطلب"), which would otherwise match both.
    await dialog.getByRole("button", { name: t("ar", "addresses.cancel"), exact: true }).click();
    await expect.element(dialog).not.toBeInTheDocument();
  });
});

describe("admin order WhatsApp CTA", () => {
  it("links to the customer phone with a prefilled message", async () => {
    render(
      OrderDetailPage,
      detailData(["confirmed"], "https://wa.me/201000000000?text=%D8%B7%D9%84%D8%A8"),
    );
    await expect
      .element(page.getByTestId("customer-whatsapp"))
      .toHaveAttribute("href", "https://wa.me/201000000000?text=%D8%B7%D9%84%D8%A8");
  });

  it("renders no CTA when the phone cannot be normalized", async () => {
    render(OrderDetailPage, detailData(["confirmed"], null));
    await expect.element(page.getByTestId("customer-whatsapp")).not.toBeInTheDocument();
  });
});

describe("admin order settlement panel", () => {
  it("renders the payment summary, timeline, and review actions for a claim", async () => {
    render(
      OrderDetailPage,
      detailData(["confirmed", "cancelled"], null, {
        order: {
          paymentStatus: "pending_review",
          paymentMethod: "wallet",
          paymentReference: "TRX-3",
          holdExpiresAt: Date.parse("2026-08-24T10:00:00Z"),
        },
        events: [
          {
            id: "event-1",
            type: "claim",
            actor: "customer",
            actorUserId: null,
            reference: "TRX-3",
            note: null,
            createdAt: Date.parse("2026-08-23T11:00:00Z"),
          },
        ],
        settlement: { canVerify: true, canReject: true, canRefund: false, canExtendHold: true },
      }),
    );

    const panel = page.getByTestId("settlement-panel");
    await expect.element(panel).toBeInTheDocument();
    await expect.element(panel).toHaveTextContent(t("ar", "admin.order.settlement.title"));
    await expect.element(panel).toHaveTextContent(t("ar", "checkout.method.wallet"));
    await expect.element(panel).toHaveTextContent(t("ar", "admin.orders.payment.pending_review"));
    await expect.element(panel).toHaveTextContent(t("ar", "admin.order.settlement.reference"));
    await expect.element(panel).toHaveTextContent(t("ar", "admin.order.settlement.holdDeadline"));
    await expect.element(panel).toHaveTextContent(normalized(formatEGP(order.total, "ar")));
    await expect
      .element(panel)
      .toHaveTextContent(formatDate("ar", Date.parse("2026-08-24T10:00:00Z")));
    await expect.element(panel).toHaveTextContent(t("ar", "admin.order.settlement.timeline"));
    await expect.element(panel).toHaveTextContent(t("ar", "admin.order.settlement.event.claim"));

    await expect
      .element(page.getByRole("button", { name: t("ar", "admin.order.verify") }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: t("ar", "admin.order.rejectClaim") }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: t("ar", "admin.order.refund") }))
      .not.toBeInTheDocument();
  });

  it("renders the paid summary with the paid-at, reviewer, and the refund action", async () => {
    render(
      OrderDetailPage,
      detailData(["shipped", "delivered"], null, {
        order: {
          paymentStatus: "paid",
          paymentMethod: "instapay",
          paymentReference: "TRX-8",
          paidAt: Date.parse("2026-08-23T12:00:00Z"),
        },
        reviewerLabel: "منى",
        settlement: { canVerify: false, canReject: false, canRefund: true, canExtendHold: true },
      }),
    );

    const panel = page.getByTestId("settlement-panel");
    await expect.element(panel).toHaveTextContent(t("ar", "admin.orders.payment.paid"));
    await expect.element(panel).toHaveTextContent(t("ar", "admin.order.settlement.paidAt"));
    await expect
      .element(panel)
      .toHaveTextContent(formatDate("ar", Date.parse("2026-08-23T12:00:00Z")));
    await expect.element(panel).toHaveTextContent(t("ar", "admin.order.settlement.reviewedBy"));
    await expect.element(panel).toHaveTextContent("منى");
    await expect
      .element(page.getByRole("button", { name: t("ar", "admin.order.refund") }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: t("ar", "admin.order.verify") }))
      .not.toBeInTheDocument();
  });

  it("offers no settlement actions for a legacy simulated order", async () => {
    render(OrderDetailPage, detailData(["confirmed", "cancelled"]));

    const panel = page.getByTestId("settlement-panel");
    await expect.element(panel).toHaveTextContent(t("ar", "admin.orders.payment.simulated"));
    await expect
      .element(page.getByRole("button", { name: t("ar", "admin.order.verify") }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: t("ar", "admin.order.refund") }))
      .not.toBeInTheDocument();
  });
});
