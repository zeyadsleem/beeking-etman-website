import { page } from "vite-plus/test/browser";
import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import InfoCard from "./InfoCard.svelte";

describe("InfoCard", () => {
  it("renders title, price and body", async () => {
    render(InfoCard, {
      props: {
        title: "سدر · كيلو",
        body: "عسل السدر الفاخر",
        priceLabel: "٢٦٠ ج.م.",
      },
    });
    await expect.element(page.getByRole("heading", { name: "سدر · كيلو" })).toBeInTheDocument();
    await expect.element(page.getByText("٢٦٠ ج.م.")).toBeInTheDocument();
    await expect.element(page.getByText("عسل السدر الفاخر")).toBeInTheDocument();
    await expect.element(page.getByRole("button")).not.toBeInTheDocument();
  });

  it("shows the action button and fires onaction on click", async () => {
    const onaction = vi.fn();
    render(InfoCard, {
      props: { title: "T", body: "B", actionLabel: "شوف الفوائد", onaction },
    });
    const button = page.getByRole("button", { name: "شوف الفوائد" });
    await expect.element(button).toBeInTheDocument();
    await button.click();
    expect(onaction).toHaveBeenCalledOnce();
  });

  it("renders the product image when provided and omits it otherwise", async () => {
    const { unmount } = render(InfoCard, {
      props: { title: "T", body: "B", image: "/img/sidr.webp" },
    });
    const article = page.getByRole("article");
    expect(article.element().querySelector("img")?.getAttribute("src")).toBe("/img/sidr.webp");
    unmount();

    render(InfoCard, { props: { title: "T", body: "B" } });
    await expect.element(page.getByRole("img")).not.toBeInTheDocument();
  });
});
