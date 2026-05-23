const BASE_URL = "https://api.brawlstars.com/v1";

// Support multiple API keys rotated round-robin for higher throughput
const API_KEYS: string[] = (
  process.env.BRAWLSTARS_API_KEYS ?? process.env.BRAWLSTARS_API_KEY ?? ""
)
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

let _keyIndex = 0;
function nextKey(): string {
  const key = API_KEYS[_keyIndex % API_KEYS.length];
  _keyIndex++;
  return key;
}

function makeHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function bsGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: makeHeaders(nextKey()),
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Brawl Stars API error: ${res.status} ${path}`);
  return res.json();
}

export function getPlayer(tag: string) {
  return bsGet<BsPlayer>(`/players/%23${tag.replace("#", "")}`);
}

export function getBrawlers() {
  return bsGet<{ items: BsBrawler[] }>("/brawlers");
}

export function getEvents() {
  return bsGet<BsEvent[]>("/events/rotation");
}

const RANKED_MODES = new Set([
  "gemGrab", "brawlBall", "heist", "bounty", "hotZone", "knockout", "duels",
]);

export async function getRankedEventMapIds(): Promise<number[]> {
  const events = await getEvents();
  return events
    .filter((e) => RANKED_MODES.has(e.event.mode))
    .map((e) => e.event.id);
}

export function getPlayerRankings(countryCode = "global", limit = 200) {
  return bsGet<{ items: BsRankedPlayer[] }>(
    `/rankings/${countryCode}/players?limit=${limit}`
  );
}

export function getClubRankings(countryCode = "global", limit = 50) {
  return bsGet<{ items: BsRankedClub[] }>(
    `/rankings/${countryCode}/clubs?limit=${limit}`
  );
}

// Top players for a specific brawler — specialists with deep data on that brawler
export function getBrawlerRankings(brawlerId: number, countryCode = "global", limit = 200) {
  return bsGet<{ items: BsRankedPlayer[] }>(
    `/rankings/${countryCode}/brawlers/${brawlerId}?limit=${limit}`
  );
}

export async function getClubMembers(clubTag: string): Promise<BsClubMember[]> {
  try {
    const clean = clubTag.replace("#", "");
    const data = await bsGet<{ items: BsClubMember[] }>(`/clubs/%23${clean}/members`);
    return data.items ?? [];
  } catch {
    return [];
  }
}

export async function getPlayerBattleLog(tag: string): Promise<BsBattle[]> {
  const clean = tag.replace("#", "");
  const res = await fetch(`${BASE_URL}/players/%23${clean}/battlelog`, {
    headers: makeHeaders(nextKey()),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

// --- Types ---
export interface BsPlayer {
  tag: string;
  name: string;
  trophies: number;
  highestTrophies: number;
  brawlers: { id: number; name: string; power: number; trophies: number; rank: number }[];
}

export interface BsBrawler {
  id: number;
  name: string;
  starPowers: { id: number; name: string }[];
  gadgets: { id: number; name: string }[];
}

export interface BsRankedPlayer {
  tag: string;
  name: string;
  nameColor: string;
  icon: { id: number };
  trophies: number;
  rank: number;
  club?: { name: string };
}

export interface BsRankedClub {
  tag: string;
  name: string;
  trophies: number;
  rank: number;
}

export interface BsClubMember {
  tag: string;
  name: string;
  trophies: number;
  role: string;
}

export interface BsBattlePlayer {
  tag: string;
  brawler: { id: number; name: string; power: number };
}

export interface BsBattle {
  battleTime: string; // "20250523T123456.000Z" — newest first
  event: { id: number; mode: string; map: string };
  battle: {
    result?: "victory" | "defeat" | "draw";
    teams?: BsBattlePlayer[][];
    players?: BsBattlePlayer[];
  };
}

export interface BsEvent {
  startTime: string;
  endTime: string;
  slotId: number;
  event: { id: number; mode: string; map: string };
}
