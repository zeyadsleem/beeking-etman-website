import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { BlendsGame } from "$lib/blend-lab/game-state.svelte";
import StepBarHost from "./StepBar.host.svelte";

const AR_STEPS = ["الهدف", "العسل", "المكونات", "التحريك", "التعبئة", "الطلب"];

const renderBar = (game: BlendsGame, lang: "ar" | "en" = "ar"): void => {
  render(StepBarHost, { props: { game, lang } });
};

describe("StepBar", () => {
  it("renders all six steps in order and highlights the current one", async () => {
    const game = new BlendsGame();
    renderBar(game);
    const bar = page.getByTestId("blends-stepbar");
    await expect.element(bar).toBeInTheDocument();
    const labels = bar.element().textContent ?? "";
    expect(labels.replace(/\s+/g, "")).toBe(AR_STEPS.join(""));
    await expect.element(page.getByText("الهدف")).toHaveClass("bg-honey-500");
    await expect.element(page.getByText("العسل")).not.toHaveClass("bg-honey-500");
  });

  it("localizes step labels for english", async () => {
    const game = new BlendsGame();
    renderBar(game, "en");
    await expect.element(page.getByText("Goal")).toHaveClass("bg-honey-500");
    await expect.element(page.getByText("Honey")).toBeInTheDocument();
    await expect.element(page.getByText("Ingredients")).toBeInTheDocument();
    await expect.element(page.getByText("Stirring")).toBeInTheDocument();
    await expect.element(page.getByText("Pouring")).toBeInTheDocument();
    await expect.element(page.getByText("Order")).toBeInTheDocument();
  });

  it("shows the back button off goal, and going back returns to goal", async () => {
    const game = new BlendsGame();
    renderBar(game);
    await expect.element(page.getByRole("button", { name: "رجوع" })).not.toBeInTheDocument();

    game.selectGoal("immunity");
    const back = page.getByRole("button", { name: "رجوع" });
    await expect.element(back).toBeInTheDocument();
    await expect.element(page.getByText("العسل")).toHaveClass("bg-honey-500");

    await back.click();
    expect(game.step).toBe("goal");
    await expect.element(back).not.toBeInTheDocument();
    await expect.element(page.getByText("الهدف")).toHaveClass("bg-honey-500");
  });

  it("hides the back button on terminal steps", async () => {
    const game = new BlendsGame();
    renderBar(game);
    game.selectGoal("vitality");
    game.selectHoney("clover");
    game.startStir();
    game.forceFinishStir();
    expect(game.step).toBe("pour");
    await expect.element(page.getByRole("button", { name: "رجوع" })).not.toBeInTheDocument();

    game.completePour();
    expect(game.step).toBe("order");
    await expect.element(page.getByRole("button", { name: "رجوع" })).not.toBeInTheDocument();
  });
});
