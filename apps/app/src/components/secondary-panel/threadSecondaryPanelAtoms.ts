import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { atomFamily } from "jotai-family";
import { hasThreadId } from "@/lib/thread-id";
import { createWindowScopedStorage } from "@/lib/window-scoped-storage";

export const threadSecondaryPanelResizingAtom = atom(false);

type ResolvedThreadSecondaryPanelThreadId = string;
type ThreadSecondaryPanelThreadId =
  | ResolvedThreadSecondaryPanelThreadId
  | null
  | undefined;

const DEFAULT_SECONDARY_PANEL_WIDTH_PERCENT = 50;
const secondaryPanelWidthStorage = createWindowScopedStorage<number>({
  parse: (storedValue, initialValue) => {
    if (storedValue === null) return initialValue;
    const parsed = Number.parseFloat(storedValue);
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 100
      ? parsed
      : initialValue;
  },
  serialize: (value) => String(value),
});
export const secondaryPanelWidthPercentAtom = atomWithStorage<number>(
  "bb.thread.secondaryPanel.widthPercent",
  DEFAULT_SECONDARY_PANEL_WIDTH_PERCENT,
  secondaryPanelWidthStorage,
  { getOnInit: true },
);

const THREAD_CONVERSATION_COLLAPSED_STORAGE_PREFIX =
  "bb.thread.conversation.collapsed";

const threadConversationCollapsedStorage = createWindowScopedStorage<boolean>(
  {
    parse: (storedValue, initialValue) => {
      if (storedValue === "true") return true;
      if (storedValue === "false") return false;
      return initialValue;
    },
    serialize: (value) => String(value),
  },
  { seedsNewWindows: false },
);

const threadConversationCollapsedAtomFamily = atomFamily(
  (threadId: ResolvedThreadSecondaryPanelThreadId) =>
    atomWithStorage<boolean>(
      `${THREAD_CONVERSATION_COLLAPSED_STORAGE_PREFIX}-${encodeURIComponent(threadId)}`,
      false,
      threadConversationCollapsedStorage,
      { getOnInit: true },
    ),
);

const disabledThreadConversationCollapsedAtom = atom(false);

export function getThreadConversationCollapsedAtom(
  threadId: ThreadSecondaryPanelThreadId,
) {
  return hasThreadId(threadId)
    ? threadConversationCollapsedAtomFamily(threadId)
    : disabledThreadConversationCollapsedAtom;
}
