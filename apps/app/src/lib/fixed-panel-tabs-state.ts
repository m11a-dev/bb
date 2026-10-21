import { nanoid } from "nanoid";
import {
  buildFixedPanelTabId,
  isFixedPanelTabsStateStorageKey,
  shouldPruneStoredFixedPanelTabsState,
  type BrowserFixedPanelTab,
} from "@bb/client-core";
import { getLocalStorage } from "./browser-storage";
import {
  isWindowScopedEmptyValue,
  stripWindowScopedSlotSuffix,
} from "./window-scoped-storage";

export {
  FIXED_PANEL_TABS_STATE_STORAGE_VERSION,
  FIXED_PANEL_TABS_IDLE_EXPIRY_MS,
  buildFixedPanelTabId,
  createThreadInfoFixedPanelTab,
  createGitDiffFixedPanelTab,
  createPluginPageFixedPanelTab,
  createPluginPanelFixedPanelTab,
  createWorkspaceFilePreviewFixedPanelTab,
  createAttachmentFilePreviewFixedPanelTab,
  createHostFilePreviewFixedPanelTab,
  createThreadStorageFilePreviewFixedPanelTab,
  createNewTabFixedPanelTab,
  ensureOpenFixedPanelHasActiveTab,
  createTerminalFixedPanelTab,
  createEmptyFixedPanelTabsState,
  EMPTY_FIXED_PANEL_TABS_STATE,
  getFixedPanelTabsStateStorageKey,
  isFixedPanelTabsStateStorageKey,
  parseFixedPanelTabsState,
  serializeFixedPanelTabsState,
  areFixedPanelTabsEquivalent,
} from "@bb/client-core";
export type {
  PluginPageFixedPanelTab,
  FixedPanelViewTab,
  PluginPanelFixedPanelTab,
  WorkspaceFilePreviewFixedPanelTab,
  AttachmentFilePreviewFixedPanelTab,
  HostFilePreviewFixedPanelTab,
  ThreadStorageFilePreviewFixedPanelTab,
  BrowserFixedPanelTab,
  NewTabFixedPanelTab,
  TerminalFixedPanelTab,
  SecondaryFixedPanelTab,
  SecondaryFileFixedPanelTab,
  FixedPanelTab,
  FixedPanelTabsState,
} from "@bb/client-core";

interface CreateBrowserFixedPanelTabArgs {
  environmentId: string | null;
  url: string;
}

interface PruneFixedPanelTabsStorageArgs {
  now: number;
}

export function createBrowserFixedPanelTab({
  environmentId,
  url,
}: CreateBrowserFixedPanelTabArgs): BrowserFixedPanelTab {
  const browserInstanceId = nanoid();
  return {
    environmentId,
    id: buildFixedPanelTabId({
      environmentId,
      kind: "browser",
      path: browserInstanceId,
    }),
    kind: "browser",
    title: null,
    url,
  };
}

export function pruneFixedPanelTabsStorage({
  now,
}: PruneFixedPanelTabsStorageArgs): void {
  const localStorage = getLocalStorage();
  if (!localStorage) {
    return;
  }

  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && isFixedPanelTabsStateStorageKey(key)) {
      keys.push(key);
    }
  }

  for (const key of keys) {
    const storedValue = localStorage.getItem(key);
    const baseKey = stripWindowScopedSlotSuffix(key);
    const sharedValue = baseKey === key ? null : localStorage.getItem(baseKey);
    const isSlotExpired =
      isWindowScopedEmptyValue(storedValue) ||
      shouldPruneStoredFixedPanelTabsState(storedValue, now);
    const isThreadLive =
      sharedValue !== null &&
      !shouldPruneStoredFixedPanelTabsState(sharedValue, now);
    if (isSlotExpired && !isThreadLive) {
      localStorage.removeItem(key);
    }
  }
}
