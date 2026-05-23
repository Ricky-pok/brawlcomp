import { getPlayerRankings, getPlayerBattleLog, getClubRankings, getClubMembers, getBrawlerRankings, getBrawlers } from "./brawlstars";

export interface BrawlerStat { wins: number; games: number; }

export interface StatsData {
  lastUpdated: number;
  sampleSize: number;
  totalBattles: number;
  lastBattleTime: Record<string, string>;  // tag → newest processed battleTime (dedup)
  discoveryQueue: string[];                // tags discovered from battles, processed next run
  mapWinrates: Record<string, Record<number, BrawlerStat>>;
  headToHead:  Record<number, Record<number, BrawlerStat>>;
  synergy:     Record<number, Record<number, BrawlerStat>>;
}

const RANKED_MODES = new Set([
  "gemGrab", "brawlBall", "heist", "bounty", "hotZone", "knockout", "duels",
]);

const PLAYER_REGIONS = [
  "global", "US", "BR", "MX", "KR", "DE", "GB", "AR", "CA", "FR",
  "JP", "TR", "PH", "TH", "SA", "IN", "RU", "AU", "CO", "PL",
];
const CLUB_REGIONS   = ["global", "US", "BR", "KR", "MX", "DE", "JP"];
const CLUBS_PER_REGION = 30;
const DISCOVERY_BATCH  = 10000; // discovered players to process per run
const DISCOVERY_CAP    = 40000; // max queue size to store

async function concurrentMap<T>(
  items: string[],
  fn: (item: string) => Promise<T>,
  concurrency = 8,
  delayMs = 300
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map(fn));
    for (const r of settled) {
      if (r.status === "fulfilled") out.push(r.value);
    }
    if (i + concurrency < items.length) await new Promise((r) => setTimeout(r, delayMs));
  }
  return out;
}

export async function collectStats(existing: StatsData | null): Promise<{
  stats: StatsData;
  newBattles: number;
  skipped: number;
  players: number;
  discovered: number;
}> {
  const stats: StatsData = existing
    ? { ...existing, lastBattleTime: existing.lastBattleTime ?? {}, discoveryQueue: existing.discoveryQueue ?? [] }
    : {
        lastUpdated: Date.now(),
        sampleSize: 0,
        totalBattles: 0,
        lastBattleTime: {},
        discoveryQueue: [],
        mapWinrates: {},
        headToHead: {},
        synergy: {},
      };

  function inc(obj: Record<number, Record<number, BrawlerStat>>, a: number, b: number, win: boolean) {
    if (!obj[a]) obj[a] = {};
    if (!obj[a][b]) obj[a][b] = { wins: 0, games: 0 };
    obj[a][b].games++;
    if (win) obj[a][b].wins++;
  }

  function incMap(map: string, id: number, win: boolean) {
    if (!stats.mapWinrates[map]) stats.mapWinrates[map] = {};
    if (!stats.mapWinrates[map][id]) stats.mapWinrates[map][id] = { wins: 0, games: 0 };
    stats.mapWinrates[map][id].games++;
    if (win) stats.mapWinrates[map][id].wins++;
  }

  // ── 1. Seed tags: rankings + club members ─────────────────────────────────
  const tagSet = new Set<string>();

  const [playerResults, clubRankResults] = await Promise.all([
    Promise.allSettled(PLAYER_REGIONS.map((r) => getPlayerRankings(r, 200))),
    Promise.allSettled(CLUB_REGIONS.map((r) => getClubRankings(r, CLUBS_PER_REGION))),
  ]);

  for (const r of playerResults) {
    if (r.status === "fulfilled") for (const p of r.value.items) tagSet.add(p.tag);
  }

  const clubTags = new Set<string>();
  for (const r of clubRankResults) {
    if (r.status === "fulfilled") for (const c of r.value.items) clubTags.add(c.tag);
  }
  const memberLists = await concurrentMap([...clubTags], (tag) => getClubMembers(tag), 16, 300);
  for (const members of memberLists) {
    for (const m of members) tagSet.add(m.tag);
  }

  // ── 2. Brawler-specific leaderboards — specialist players per brawler ────
  // Each brawler's top 200 players have deep, high-quality data for that brawler.
  try {
    const { items: brawlerList } = await getBrawlers();
    const brawlerIds = brawlerList.map((b) => b.id);
    const brawlerRankResults = await concurrentMap(
      brawlerIds.map(String),
      async (idStr) => {
        try {
          const data = await getBrawlerRankings(Number(idStr), "global", 200);
          return data.items.map((p) => p.tag);
        } catch { return [] as string[]; }
      },
      16, 300
    );
    for (const tags of brawlerRankResults) for (const tag of tags) tagSet.add(tag);
  } catch { /* skip if brawler list fails */ }

  // ── 3. Add previously discovered players (DISCOVERY_BATCH per run) ────────
  const queueBatch = (existing?.discoveryQueue ?? []).slice(0, DISCOVERY_BATCH);
  for (const tag of queueBatch) tagSet.add(tag);

  const allTags = [...tagSet];

  // ── 3. Fetch battle logs ──────────────────────────────────────────────────
  const keyCount = (process.env.BRAWLSTARS_API_KEYS ?? "").split(",").filter(Boolean).length || 1;
  const concurrency = keyCount * 8;

  const taggedLogs = await concurrentMap(
    allTags,
    async (tag) => ({ tag, battles: await getPlayerBattleLog(tag) }),
    concurrency,
    300
  );

  // ── 4. Process new battles + discover new player tags ─────────────────────
  let newBattles = 0;
  let skipped = 0;
  const freshDiscovered = new Set<string>();

  for (const { tag, battles } of taggedLogs) {
    if (!battles.length) continue;

    const cutoff = stats.lastBattleTime[tag] ?? "";
    stats.lastBattleTime[tag] = battles[0].battleTime ?? cutoff;

    for (const battle of battles) {
      if (battle.battleTime && battle.battleTime <= cutoff) {
        skipped++;
        break; // battles sorted newest-first — everything after is already processed
      }

      // Discover player tags from ALL battle participants regardless of mode
      const allTeams = battle.battle?.teams ?? [];
      for (const team of allTeams)
        for (const player of team)
          if (player.tag && !tagSet.has(player.tag))
            freshDiscovered.add(player.tag);

      if (!RANKED_MODES.has(battle.event?.mode)) continue;
      const mapName = battle.event?.map;
      if (!mapName) continue;
      const teams = battle.battle?.teams;
      if (!teams || teams.length < 2) continue;
      const result = battle.battle.result;
      if (!result || result === "draw") continue;

      const winners = result === "victory" ? teams[0] : teams[1];
      const losers  = result === "victory" ? teams[1] : teams[0];
      const winIds  = winners.map((p) => p.brawler.id);
      const loseIds = losers.map((p) => p.brawler.id);

      newBattles++;
      stats.sampleSize++;

      for (const id of winIds)  incMap(mapName, id, true);
      for (const id of loseIds) incMap(mapName, id, false);

      for (const wId of winIds)
        for (const lId of loseIds)
          inc(stats.headToHead, wId, lId, true);

      for (let i = 0; i < winIds.length; i++)
        for (let j = i + 1; j < winIds.length; j++) {
          inc(stats.synergy, winIds[i], winIds[j], true);
          inc(stats.synergy, winIds[j], winIds[i], true);
        }
      for (let i = 0; i < loseIds.length; i++)
        for (let j = i + 1; j < loseIds.length; j++) {
          inc(stats.synergy, loseIds[i], loseIds[j], false);
          inc(stats.synergy, loseIds[j], loseIds[i], false);
        }
    }
  }

  // ── 5. Rebuild discovery queue ────────────────────────────────────────────
  // Carry over unprocessed remainder from previous queue + fresh discoveries
  const queueRemainder = (existing?.discoveryQueue ?? []).slice(DISCOVERY_BATCH);
  const newDiscovered  = [...freshDiscovered];
  stats.discoveryQueue = [...newDiscovered, ...queueRemainder].slice(0, DISCOVERY_CAP);

  stats.lastUpdated = Date.now();
  stats.totalBattles = (existing?.totalBattles ?? 0) + newBattles;

  return { stats, newBattles, skipped, players: allTags.length, discovered: freshDiscovered.size };
}

export function winRate(stat: BrawlerStat | undefined, fallback = 0.5): number {
  if (!stat || stat.games < 5) return fallback;
  return stat.wins / stat.games;
}
