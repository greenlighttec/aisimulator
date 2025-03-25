const KEY = "scene_backgrounds";

function getStorage() {
  if (typeof window === "undefined") return null;
  return sessionStorage;
}

export function getBackgroundMap(): Record<string, string> {
  const storage = getStorage();
  if (!storage) return {};
  const raw = storage.getItem(KEY);
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setBackgroundUrl(sceneId: string, url: string) {
  const storage = getStorage();
  if (!storage) return;
  const map = getBackgroundMap();
  map[sceneId] = url;
  storage.setItem(KEY, JSON.stringify(map));
}

export function getBackgroundUrl(sceneId: string): string | null {
  const map = getBackgroundMap();
  return map[sceneId] || null;
}
