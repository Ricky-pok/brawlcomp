const BASE_URL = process.env.BRAWLIFY_BASE_URL ?? "https://api.brawlify.com/v1";

async function bfGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Brawlify API error: ${res.status} ${path}`);
  return res.json();
}

// All brawlers with images, rarity, class, etc.
export function getBrawlers() {
  return bfGet<{ list: BfBrawler[] }>("/brawlers");
}

// All maps with images and game modes
export function getMaps() {
  return bfGet<{ list: BfMap[] }>("/maps");
}

// Single map by id
export function getMap(id: number) {
  return bfGet<BfMap>(`/maps/${id}`);
}

// All game modes
export function getGameModes() {
  return bfGet<{ list: BfGameMode[] }>("/gamemodes");
}

// Current active events
export function getEvents() {
  return bfGet<{ active: BfEvent[] }>("/events");
}

// --- Types ---
export interface BfBrawler {
  id: number;
  name: string;
  hash: string;
  imageUrl: string;
  imageUrl2: string;
  imageUrl3: string;
  rarity: { id: number; name: string; color: string };
  class: { id: number; name: string };
  description: string;
  starPowers: { id: number; name: string; description: string; imageUrl: string }[];
  gadgets: { id: number; name: string; description: string; imageUrl: string }[];
}

export interface BfMap {
  id: number;
  name: string;
  hash: string;
  imageUrl: string;
  credit: string;
  gameMode: { id: number; name: string; hash: string; imageUrl: string; color: string };
  lastActive: number;
  disabled: boolean;
}

export interface BfGameMode {
  id: number;
  name: string;
  hash: string;
  imageUrl: string;
  color: string;
  title: string;
  tutorial: string;
  description: string;
}

export interface BfEvent {
  startTime: string;
  endTime: string;
  slotId: number;
  predicted: boolean;
  map: BfMap;
}
