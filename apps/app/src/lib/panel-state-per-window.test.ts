// @vitest-environment jsdom

import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmptyFixedPanelTabsState,
  createTerminalFixedPanelTab,
  createThreadInfoFixedPanelTab,
  type FixedPanelTabsState,
} from "./fixed-panel-tabs-state";

const THREAD_ID = "thr_two_windows";
const FILES_TAB = createThreadInfoFixedPanelTab();
const TERMINAL_TAB = createTerminalFixedPanelTab({ terminalId: "term-1" });

type WindowMode = "desktop" | "browser";

interface SimulatedWindow {
  collapsed(): boolean;
  panel(): FixedPanelTabsState;
  receiveStorageEventsFromOtherWindows(): void;
  setCollapsed(value: boolean): void;
  setPanel(state: FixedPanelTabsState): void;
  setWidth(value: number): void;
  width(): number;
}

const sessionSnapshots = new Map<string, Record<string, string>>();
let activeWindowName: string | null = null;

function saveActiveSession(): void {
  if (activeWindowName === null) return;
  const snapshot: Record<string, string> = {};
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key !== null) snapshot[key] = window.sessionStorage.getItem(key) ?? "";
  }
  sessionSnapshots.set(activeWindowName, snapshot);
}

function activateSession(name: string): void {
  saveActiveSession();
  window.sessionStorage.clear();
  for (const [key, value] of Object.entries(sessionSnapshots.get(name) ?? {})) {
    window.sessionStorage.setItem(key, value);
  }
  activeWindowName = name;
}

async function openWindow(
  name: string,
  mode: WindowMode,
): Promise<SimulatedWindow> {
  activateSession(name);
  Reflect.set(
    window,
    "bbDesktop",
    mode === "desktop" ? { windowKey: name } : undefined,
  );
  vi.resetModules();
  const atoms =
    await import("@/components/secondary-panel/threadSecondaryPanelAtoms");
  const fixedPanelTabs = await import("./fixed-panel-tabs");
  const store = createStore();
  const collapsedAtom = atoms.getThreadConversationCollapsedAtom(THREAD_ID);
  const panelAtom = fixedPanelTabs.getFixedPanelTabsStateAtom(THREAD_ID);
  const widthAtom = atoms.secondaryPanelWidthPercentAtom;
  return {
    collapsed: () => store.get(collapsedAtom),
    panel: () => store.get(panelAtom),
    receiveStorageEventsFromOtherWindows() {
      store.sub(collapsedAtom, () => {});
      store.sub(panelAtom, () => {});
      store.sub(widthAtom, () => {});
    },
    setCollapsed: (value) => store.set(collapsedAtom, value),
    setPanel: (state) => store.set(panelAtom, state),
    setWidth: (value) => store.set(widthAtom, value),
    width: () => store.get(widthAtom),
  };
}

function panelShowing(activeTabId: string, isOpen = true): FixedPanelTabsState {
  return createEmptyFixedPanelTabsState({
    lastUsedAt: Date.now(),
    secondary: {
      tabs: [FILES_TAB, TERMINAL_TAB],
      activeTabId,
      isOpen,
    },
  });
}

function broadcastLocalStorageChanges(): void {
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key === null) continue;
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: window.localStorage.getItem(key),
        storageArea: window.localStorage,
      }),
    );
  }
}

describe.each<WindowMode>(["desktop", "browser"])(
  "secondary panel state with one thread in two windows (%s)",
  (mode) => {
    beforeEach(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      sessionSnapshots.clear();
      activeWindowName = null;
    });

    afterEach(() => {
      Reflect.deleteProperty(window, "bbDesktop");
    });

    it("keeps monitor A's full-screen files view and monitor B's chat with a terminal sidebar apart", async () => {
      const monitorA = await openWindow("main", mode);
      monitorA.setPanel(panelShowing(FILES_TAB.id));
      monitorA.setCollapsed(true);
      monitorA.setWidth(70);
      monitorA.receiveStorageEventsFromOtherWindows();

      const monitorB = await openWindow("window-2", mode);
      expect(monitorB.collapsed()).toBe(true);
      expect(monitorB.panel().secondary.activeTabId).toBe(FILES_TAB.id);
      expect(monitorB.width()).toBe(70);

      monitorB.setCollapsed(false);
      monitorB.setPanel(panelShowing(TERMINAL_TAB.id));
      monitorB.setWidth(35);

      broadcastLocalStorageChanges();
      expect(monitorA.collapsed()).toBe(true);
      expect(monitorA.panel().secondary.activeTabId).toBe(FILES_TAB.id);
      expect(monitorA.width()).toBe(70);

      const reloadedB = await openWindow("window-2", mode);
      expect(reloadedB.collapsed()).toBe(false);
      expect(reloadedB.panel().secondary.activeTabId).toBe(TERMINAL_TAB.id);
      expect(reloadedB.width()).toBe(35);

      (await openWindow("main", mode)).setCollapsed(false);
      expect((await openWindow("window-2", mode)).collapsed()).toBe(false);
      (await openWindow("main", mode)).setCollapsed(true);
      (await openWindow("window-2", mode)).setCollapsed(true);
      (await openWindow("window-2", mode)).setCollapsed(false);
      expect((await openWindow("main", mode)).collapsed()).toBe(true);
      expect((await openWindow("window-2", mode)).collapsed()).toBe(false);
    });

    it("keeps a window on the layout it adopted after another window changes the seed", async () => {
      const first = await openWindow("main", mode);
      first.setPanel(panelShowing(FILES_TAB.id));
      first.setCollapsed(true);

      const adopter = await openWindow("window-2", mode);
      expect(adopter.collapsed()).toBe(true);

      const third = await openWindow("window-3", mode);
      third.setCollapsed(false);
      third.setPanel(panelShowing(TERMINAL_TAB.id, false));

      const reloadedAdopter = await openWindow("window-2", mode);
      expect(reloadedAdopter.collapsed()).toBe(true);
      expect(reloadedAdopter.panel().secondary).toMatchObject({
        activeTabId: FILES_TAB.id,
        isOpen: true,
      });
    });
  },
);

describe("secondary panel state across an app restart", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    sessionSnapshots.clear();
    activeWindowName = null;
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "bbDesktop");
  });

  it("restores each desktop window by its window key", async () => {
    (await openWindow("main", "desktop")).setCollapsed(true);
    (await openWindow("window-2", "desktop")).setCollapsed(false);

    sessionSnapshots.clear();
    activeWindowName = null;

    expect((await openWindow("main", "desktop")).collapsed()).toBe(true);
    expect((await openWindow("window-2", "desktop")).collapsed()).toBe(false);
  });

  it("falls back to the last-used layout in a browser tab", async () => {
    (await openWindow("tab-1", "browser")).setCollapsed(true);
    (await openWindow("tab-2", "browser")).setCollapsed(false);

    sessionSnapshots.clear();
    activeWindowName = null;

    expect((await openWindow("tab-1", "browser")).collapsed()).toBe(false);
  });
});
