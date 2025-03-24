const KEY = "scene_backgrounds";

export function getBackgroundMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(KEY);
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setBackgroundUrl(sceneId: string, url: string) {
  const map = getBackgroundMap();
  map[sceneId] = url;
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getBackgroundUrl(sceneId: string): string | null {
  const map = getBackgroundMap();
  return map[sceneId] || null;
}
