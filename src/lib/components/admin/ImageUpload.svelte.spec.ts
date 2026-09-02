import { page } from "vite-plus/test/browser";
import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import ImageUpload from "./ImageUpload.svelte";

function makePng(name = "honey.png"): File {
  const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

function props(overrides: Partial<Record<string, unknown>> = {}) {
  return { lang: "ar" as const, name: "image", ...overrides };
}

function previewSrc(): string | null {
  return page.getByTestId("image-preview").element().getAttribute("src");
}

describe("ImageUpload", () => {
  it("shows the initial image when editing an existing record", () => {
    render(ImageUpload, {
      props: props({ initialUrl: "https://example.com/g.jpg" }),
    });

    expect(page.getByTestId("image-preview").elements()).toHaveLength(1);
    expect(page.getByTestId("image-preview")).toHaveAttribute("src", "https://example.com/g.jpg");
  });

  it("swaps the preview to a blob url when a file is chosen", async () => {
    render(ImageUpload, {
      props: props({ initialUrl: "https://example.com/g.jpg" }),
    });

    await page.getByTestId("image-input").upload(makePng());

    await vi.waitFor(() => {
      expect(previewSrc()).toMatch(/^blob:/);
    });
  });

  it("shows an inline error for an oversized file and keeps the previous preview", async () => {
    render(ImageUpload, { props: props({ initialUrl: "https://example.com/g.jpg" }) });

    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    await page.getByTestId("image-input").upload(big);

    await expect.element(page.getByRole("alert")).toHaveTextContent("كبير جدًا");
    await expect
      .element(page.getByTestId("image-preview"))
      .toHaveAttribute("src", "https://example.com/g.jpg");
  });

  it("shows an inline error for an unsupported file type", async () => {
    render(ImageUpload, { props: props() });

    const gif = new File([new Uint8Array([0x47, 0x49, 0x46])], "h.gif", { type: "image/gif" });
    await page.getByTestId("image-input").upload(gif);

    await expect.element(page.getByRole("alert")).toHaveTextContent("غير مدعومة");
  });

  it("enters dragover and applies a drop on drop", async () => {
    render(ImageUpload, { props: props() });

    const zone = page.getByRole("button", { name: /اسحب صورة/i });
    const el = zone.element();

    el.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(el.classList.contains("border-honey-500")).toBe(true);
    });

    const transfer = new DataTransfer();
    transfer.items.add(makePng());
    el.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );

    await vi.waitFor(() => {
      expect(previewSrc()).toMatch(/^blob:/);
    });
    await vi.waitFor(() => {
      expect(el.classList.contains("border-honey-500")).toBe(false);
    });
  });
});
