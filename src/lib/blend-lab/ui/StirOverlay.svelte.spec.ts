import { page } from "vite-plus/test/browser";
import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { BlendsGame } from "$lib/blend-lab/game-state.svelte";
import StirOverlayHost from "./StirOverlay.host.svelte";

const HINT_AR = "لفّ الماوس أو صبعتك حوالين الزبادية ٣ لفات";
const DONE_AR = "تمام! الخلطة بقت متجانسة";
const TITLE_AR = "حرّك الخلطة بإيدك!";
const SKIP_AR = "تخطي";

const stirGame = (): BlendsGame => {
  const game = new BlendsGame();
  game.selectGoal("vitality");
  game.selectHoney("sidr");
  game.startStir();
  return game;
};

describe("StirOverlay", () => {
  it("renders nothing outside the stir step", async () => {
    const game = new BlendsGame();
    render(StirOverlayHost, { props: { game, lang: "ar" } });
    await expect.element(page.getByTestId("stir-progress-ring")).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: SKIP_AR })).not.toBeInTheDocument();
  });

  it("shows ring, hint and skip during stir; skip advances to pour and unmounts", async () => {
    const game = stirGame();
    render(StirOverlayHost, { props: { game, lang: "ar" } });

    const ring = page.getByTestId("stir-progress-ring");
    await expect.element(ring).toBeInTheDocument();
    await expect.element(page.getByRole("img", { name: TITLE_AR })).toBeInTheDocument();
    await expect.element(page.getByText(HINT_AR)).toBeInTheDocument();

    const skip = page.getByRole("button", { name: SKIP_AR });
    await skip.click();
    expect(game.step).toBe("pour");
    await expect.element(ring).not.toBeInTheDocument();
    await expect.element(skip).not.toBeInTheDocument();
  });

  it("mirrors mix progress in the ring offset, then shows done and auto-advances", async () => {
    const game = stirGame();
    render(StirOverlayHost, { props: { game, lang: "ar" } });

    const CIRC = 2 * Math.PI * 64;
    for (let i = 0; i < 12; i++) game.recordStir(Math.PI / 4);
    await expect
      .element(page.getByTestId("stir-progress-ring"))
      .toHaveAttribute("stroke-dashoffset", String(CIRC * (1 - game.mixProgress)));

    for (let i = 12; i < 24; i++) game.recordStir(Math.PI / 4);
    await expect.element(page.getByText(DONE_AR)).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: SKIP_AR })).not.toBeInTheDocument();

    await vi.waitFor(
      () => {
        expect(game.step).toBe("pour");
      },
      { timeout: 3000 },
    );
  });

  it("clears the pending completion timer when leaving stir mid-window and re-arms on return", async () => {
    const game = stirGame();
    render(StirOverlayHost, { props: { game, lang: "ar" } });

    for (let i = 0; i < 24; i++) game.recordStir(Math.PI / 4);
    game.goBack();
    expect(game.step).toBe("prep");

    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(game.step).toBe("prep");

    game.startStir();
    await vi.waitFor(
      () => {
        expect(game.step).toBe("pour");
      },
      { timeout: 3000 },
    );
  });

  it("auto-advances even when stirring continues past full progress", async () => {
    const game = stirGame();
    render(StirOverlayHost, { props: { game, lang: "ar" } });

    // Exactly full: 24 * π/4 = 6π = FULL_STIR_RADIANS
    for (let i = 0; i < 24; i++) game.recordStir(Math.PI / 4);
    // Flush effects so the completion timer is armed before any post-completion churn
    await expect.element(page.getByText(DONE_AR)).toBeInTheDocument();

    // Pointer still down mid-motion: unclamped writes keep landing past the full mark
    for (let i = 0; i < 12; i++) game.recordStir(Math.PI / 5);

    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(game.step).toBe("pour");
  });
});
