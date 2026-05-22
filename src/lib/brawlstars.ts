const BASE_URL = "https://api.brawlstars.com/v1";

const headers = {
  Authorization: `Bearer ${process.env.BRAWLSTARS_API_KEY}`,
  "Content-Type": "application/json",
};

async function bsGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Brawl Stars API error: ${res.status} ${path}`);
  return res.json();
}

// Player profile by tag (encode # as %23)
export function getPlayer(tag: string) {
  return bsGet<BsPlayer>(`/players/%23${tag.replace("#", "")}`);
}

// All brawlers
export function getBrawlers() {
  return bsGet<{ items: BsBrawler[] }>("/brawlers");
}

// Current event rotation
export function getEvents() {
  return bsGet<{ active: BsEvent[] }>("/events/rotation");
}

// --- Types ---
export interface BsPlayer {
  tag: string;
  name: string;
  trophies: number;
  highestTrophies: number;
  brawlers: { id: number; name: string; trophies: number; rank: number }[];
}

export interface BsBrawler {
  id: number;
  name: string;
  starPowers: { id: number; name: string }[];
  gadgets: { id: number; name: string }[];
}

export interface BsEvent {
  startTime: string;
  endTime: string;
  slotId: number;
  event: {
    id: number;
    mode: string;
    map: string;
  };
}
