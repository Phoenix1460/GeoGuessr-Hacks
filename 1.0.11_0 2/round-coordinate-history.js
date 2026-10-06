const STORAGE_PREFIX = "servedCoordinate:";

export function servedCoordinateStorageKey(tabId) {
  return `${STORAGE_PREFIX}${tabId}`;
}

export async function getServedCoordinateKey(storage, tab) {
  const storageKey = servedCoordinateStorageKey(tab.id);
  const stored = await storage.get(storageKey);
  const entry = stored[storageKey];
  if (!entry || entry.hostname !== coordinateHostname(tab.url)) return "";
  return String(entry.coordinateKey || "");
}

export async function markServedCoordinate(storage, tab, nextCoordinateKey) {
  const storageKey = servedCoordinateStorageKey(tab.id);
  await storage.set({
    [storageKey]: {
      coordinateKey: nextCoordinateKey,
      hostname: coordinateHostname(tab.url),
      servedAt: Date.now(),
    },
  });
}

export function coordinateKey(coordinates) {
  return `${Number(coordinates.lat).toFixed(7)},${Number(coordinates.lng).toFixed(7)}`;
}

export function isNewCoordinate(previousCoordinateKey, coordinates) {
  return !previousCoordinateKey || coordinateKey(coordinates) !== previousCoordinateKey;
}

function coordinateHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}
