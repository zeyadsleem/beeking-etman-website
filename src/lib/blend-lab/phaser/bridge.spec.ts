import { describe, expect, it, vi } from "vite-plus/test";
import { BlendsBridge, type GameSnapshot } from "./bridge";

const SNAPSHOT: GameSnapshot = {
  step: "goal",
  honeyId: null,
  jarSize: "full",
  doses: { royalJelly: 0, propolis: 0, ginseng: 0, palmPollen: 0, beePollen: 0 },
  jarFill: 0,
  mixProgress: 0,
};

describe("BlendsBridge", () => {
  it("exposes the latest snapshot", () => {
    const bridge = new BlendsBridge(SNAPSHOT);
    expect(bridge.snapshot).toEqual(SNAPSHOT);
  });

  it("stores and emits a new snapshot", () => {
    const bridge = new BlendsBridge(SNAPSHOT);
    const listener = vi.fn();
    bridge.on(listener);
    const next: GameSnapshot = { ...SNAPSHOT, step: "honey" };
    bridge.setSnapshot(next);
    expect(bridge.snapshot).toEqual(next);
    expect(listener).toHaveBeenCalledExactlyOnceWith({ type: "snapshot", snapshot: next });
  });

  it("forwards game-to-ui events to subscribers", () => {
    const bridge = new BlendsBridge(SNAPSHOT);
    const listener = vi.fn();
    bridge.on(listener);
    bridge.emit({ type: "inspectHoney", id: "clover" });
    bridge.emit({ type: "inspectAdditive", key: "ginseng" });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, { type: "inspectHoney", id: "clover" });
    expect(listener).toHaveBeenNthCalledWith(2, { type: "inspectAdditive", key: "ginseng" });
  });

  it("stops delivering after unsubscribe", () => {
    const bridge = new BlendsBridge(SNAPSHOT);
    const listener = vi.fn();
    const off = bridge.on(listener);
    off();
    bridge.emit({ type: "inspectHoney", id: "sidr" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("clear removes every listener", () => {
    const bridge = new BlendsBridge(SNAPSHOT);
    const listener = vi.fn();
    bridge.on(listener);
    bridge.clear();
    bridge.emit({ type: "inspectHoney", id: "citrus" });
    expect(listener).not.toHaveBeenCalled();
  });
});
