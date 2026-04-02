const KEY = "character_images";

type MoodMap = Record<string, string>; // mood -> url
type CharacterMap = Record<string, MoodMap>; // character name -> moods

function getStorage() {
  if (typeof window === "undefined") return null;
  return sessionStorage;
}

export function getCharacterMap(): CharacterMap {
  const storage = getStorage();
  if (!storage) return {};
  const raw = storage.getItem(KEY);
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCharacterMap(map: CharacterMap) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(KEY, JSON.stringify(map));
}

export function getCharacterMoodUrl(character: string, mood: string): string | null {
  const map = getCharacterMap();
  return map[character]?.[mood] || null;
}

export function hasCharacter(character: string): boolean {
  const map = getCharacterMap();
  return !!map[character] && Object.keys(map[character]).length > 0;
}

export function setCharacterMoods(character: string, moods: MoodMap) {
  const map = getCharacterMap();
  map[character] = moods;
  saveCharacterMap(map);
}
