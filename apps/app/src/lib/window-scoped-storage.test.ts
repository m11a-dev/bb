// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  createEmptyFixedPanelTabsState,
  getFixedPanelTabsStateStorageKey,
  pruneFixedPanelTabsStorage,
  serializeFixedPanelTabsState,
} from "./fixed-panel-tabs-state";
import {
  readWindowScopedItem,
  stripWindowScopedSlotSuffix,
  windowScopedSlotKey,
  writeWindowScopedItem,
  type WindowScopedStorageBackends,
} from "./window-scoped-storage";

function desktopWindow(windowKey: string): WindowScopedStorageBackends {
  return {
    local: window.localStorage,
    session: window.sessionStorage,
    windowKey,
  };
}

describe("window-scoped storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("seeds a new window from the last write, then keeps the windows apart", () => {
    writeWindowScopedItem("key", "first", desktopWindow("main"));
    expect(readWindowScopedItem("key", desktopWindow("window-2"))).toBe(
      "first",
    );
    writeWindowScopedItem("key", "second", desktopWindow("window-2"));

    expect(readWindowScopedItem("key", desktopWindow("main"))).toBe("first");
    expect(readWindowScopedItem("key", desktopWindow("window-3"))).toBe(
      "second",
    );
  });

  it("keeps a cleared window cleared instead of adopting another window's value", () => {
    writeWindowScopedItem("key", null, desktopWindow("main"));
    writeWindowScopedItem("key", "other", desktopWindow("window-2"));

    expect(readWindowScopedItem("key", desktopWindow("main"))).toBeNull();
  });

  it("strips the window suffix from a slot key, including encoded keys", () => {
    const slot = windowScopedSlotKey("bb.key.thr_1", "window#=/2");
    expect(slot).not.toBe("bb.key.thr_1");
    expect(stripWindowScopedSlotSuffix(slot)).toBe("bb.key.thr_1");
    expect(stripWindowScopedSlotSuffix("bb.key.thr_1")).toBe("bb.key.thr_1");
  });

  it("prunes an idle thread's window slots with its shared state, and keeps live ones", () => {
    const now = Date.now();
    const liveKey = getFixedPanelTabsStateStorageKey({ threadId: "thr_live" });
    const idleKey = getFixedPanelTabsStateStorageKey({ threadId: "thr_idle" });
    const live = serializeFixedPanelTabsState({
      state: createEmptyFixedPanelTabsState({ lastUsedAt: now }),
    });
    const idle = serializeFixedPanelTabsState({
      state: createEmptyFixedPanelTabsState({ lastUsedAt: 0 }),
    });
    writeWindowScopedItem(liveKey, null, desktopWindow("window-2"));
    writeWindowScopedItem(liveKey, live, desktopWindow("main"));
    writeWindowScopedItem(idleKey, idle, desktopWindow("main"));
    writeWindowScopedItem(idleKey, null, desktopWindow("window-2"));
    window.localStorage.setItem(idleKey, idle);

    pruneFixedPanelTabsStorage({ now });

    expect(window.localStorage.getItem(liveKey)).toBe(live);
    expect(
      window.localStorage.getItem(windowScopedSlotKey(liveKey, "main")),
    ).toBe(live);
    expect(
      window.localStorage.getItem(windowScopedSlotKey(liveKey, "window-2")),
    ).not.toBeNull();
    expect(window.localStorage.getItem(idleKey)).toBeNull();
    expect(
      window.localStorage.getItem(windowScopedSlotKey(idleKey, "main")),
    ).toBeNull();
    expect(
      window.localStorage.getItem(windowScopedSlotKey(idleKey, "window-2")),
    ).toBeNull();
  });
});
