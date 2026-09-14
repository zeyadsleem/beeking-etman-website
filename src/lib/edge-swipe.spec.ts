import { describe, expect, it } from "vite-plus/test";
import { edgeForDir, isEdgeSwipe, type EdgeSwipeConfig } from "./edge-swipe";

const VIEWPORT = 390;

function config(edge: "left" | "right"): EdgeSwipeConfig {
  return { edge, viewportWidth: VIEWPORT };
}

describe("edgeForDir", () => {
  it("maps rtl to the left edge and ltr to the right edge", () => {
    expect(edgeForDir("rtl")).toBe("left");
    expect(edgeForDir("ltr")).toBe("right");
  });
});

describe("isEdgeSwipe", () => {
  it("accepts a left-edge swipe toward the centre", () => {
    expect(isEdgeSwipe({ x: 10, y: 300 }, { x: 90, y: 310 }, config("left"))).toBe(true);
  });

  it("accepts a right-edge swipe toward the centre", () => {
    expect(isEdgeSwipe({ x: 380, y: 300 }, { x: 300, y: 305 }, config("right"))).toBe(true);
  });

  it("rejects a swipe that starts away from the edge", () => {
    expect(isEdgeSwipe({ x: 120, y: 300 }, { x: 240, y: 300 }, config("left"))).toBe(false);
  });

  it("rejects a swipe that is too short", () => {
    expect(isEdgeSwipe({ x: 10, y: 300 }, { x: 40, y: 300 }, config("left"))).toBe(false);
  });

  it("rejects a swipe away from the centre", () => {
    expect(isEdgeSwipe({ x: 10, y: 300 }, { x: 4, y: 300 }, config("left"))).toBe(false);
  });

  it("rejects a mostly vertical drag", () => {
    expect(isEdgeSwipe({ x: 10, y: 200 }, { x: 90, y: 320 }, config("left"))).toBe(false);
  });
});
