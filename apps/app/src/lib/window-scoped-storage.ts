import type { SyncStorage } from "./browser-storage";

const WINDOW_SCOPED_KEY_SEPARATOR = "#window=";
const WINDOW_SCOPED_EMPTY_VALUE = "\u0000bb-window-empty";

interface StoredValueCodec<T> {
  parse: (storedValue: string | null, initialValue: T) => T;
  serialize: (value: T) => string;
}

export interface WindowScopedStorageBackends {
  local: Storage | null;
  session: Storage | null;
  windowKey: string | null;
}

export function isWindowScopedEmptyValue(value: string | null): boolean {
  return value === WINDOW_SCOPED_EMPTY_VALUE;
}

function readBrowserStorage(
  name: "localStorage" | "sessionStorage",
): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window[name];
  } catch {
    return null;
  }
}

function readDesktopWindowKey(): string | null {
  if (typeof window === "undefined") return null;
  const windowKey = window.bbDesktop?.windowKey;
  return typeof windowKey === "string" && windowKey.length > 0
    ? windowKey
    : null;
}

export function resolveWindowScopedStorageBackends(): WindowScopedStorageBackends {
  return {
    local: readBrowserStorage("localStorage"),
    session: readBrowserStorage("sessionStorage"),
    windowKey: readDesktopWindowKey(),
  };
}

export function windowScopedSlotKey(key: string, windowKey: string): string {
  return `${key}${WINDOW_SCOPED_KEY_SEPARATOR}${encodeURIComponent(windowKey)}`;
}

export function stripWindowScopedSlotSuffix(key: string): string {
  const separatorIndex = key.lastIndexOf(WINDOW_SCOPED_KEY_SEPARATOR);
  return separatorIndex === -1 ? key : key.slice(0, separatorIndex);
}

function slotLocation(
  key: string,
  backends: WindowScopedStorageBackends,
): { key: string; storage: Storage | null } {
  return backends.windowKey === null
    ? { key, storage: backends.session }
    : {
        key: windowScopedSlotKey(key, backends.windowKey),
        storage: backends.local,
      };
}

function safeGet(storage: Storage | null, key: string): string | null {
  if (storage === null) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

interface WindowScopedReadOptions {
  seedsNewWindows?: boolean;
}

export function readWindowScopedItem(
  key: string,
  backends: WindowScopedStorageBackends = resolveWindowScopedStorageBackends(),
  { seedsNewWindows = true }: WindowScopedReadOptions = {},
): string | null {
  const slot = slotLocation(key, backends);
  const own = safeGet(slot.storage, slot.key);
  if (own === WINDOW_SCOPED_EMPTY_VALUE) return null;
  if (own !== null || !seedsNewWindows) return own;
  const seed = safeGet(backends.local, key);
  if (seed === null) return null;
  try {
    slot.storage?.setItem(slot.key, seed);
  } catch {}
  return seed;
}

export function writeWindowScopedItem(
  key: string,
  value: string | null,
  backends: WindowScopedStorageBackends = resolveWindowScopedStorageBackends(),
): void {
  const slot = slotLocation(key, backends);
  slot.storage?.setItem(slot.key, value ?? WINDOW_SCOPED_EMPTY_VALUE);
  if (value === null) {
    backends.local?.removeItem(key);
  } else {
    backends.local?.setItem(key, value);
  }
}

export function createWindowScopedStorage<T>(
  codec: StoredValueCodec<T>,
  options: WindowScopedReadOptions = {},
): SyncStorage<T> {
  return {
    getItem: (key, initialValue) =>
      codec.parse(
        readWindowScopedItem(
          key,
          resolveWindowScopedStorageBackends(),
          options,
        ),
        initialValue,
      ),
    setItem: (key, value) => {
      try {
        writeWindowScopedItem(key, codec.serialize(value));
      } catch {}
    },
    removeItem: (key) => {
      try {
        writeWindowScopedItem(key, null);
      } catch {}
    },
  };
}
