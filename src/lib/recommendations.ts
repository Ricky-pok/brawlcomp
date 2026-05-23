import type { BfBrawler } from "./brawlify";
import type { StatsData, BrawlerStat } from "./statsCollector";
import { winRate } from "./statsCollector";
import { getBrawlerDifficulty } from "@/data/difficulty";

export interface Recommendation {
  brawler: BfBrawler;
  score: number;
  winRateMap: number;
  winRateCounter: number;
  winRateSynergy: number;
  mapGames: number;
  sortScore: number;
  difficulty: number;
  reason: string;
}

export const MODE_NAMES: Record<string, string> = {
  gemGrab:   "Gem Grab",
  brawlBall: "Brawl Ball",
  heist:     "Heist",
  knockout:  "Knockout",
  bounty:    "Bounty",
  hotZone:   "Hot Zone",
  duels:     "Duels",
};

// ── Confidence helpers ────────────────────────────────────────────────────────

// Map WR sort: winRate × games/(games+30). Needs more games to trust.
function confidenceScore(wins: number, games: number): number {
  if (games < 1) return 0;
  return (wins / games) * (games / (games + 30));
}

// H2H / synergy: shrink toward 0.5 based on sample size (K=10 — pairs are sparse).
// 0 games → 0.5 (neutral), 10 games → 0.5 + delta×0.5, 50 games → 0.5 + delta×0.83
function shrinkToward50(stat: BrawlerStat | undefined, K = 10): number {
  if (!stat || stat.games < 1) return 0.5;
  const wr = stat.wins / stat.games;
  const conf = stat.games / (stat.games + K);
  return 0.5 + (wr - 0.5) * conf;
}

// ── Recommendations ───────────────────────────────────────────────────────────

export function getRecommendations(
  allBrawlers: BfBrawler[],
  usedIds: Set<number>,
  redTeamPicks: BfBrawler[],
  blueTeamPicks: BfBrawler[],
  mapName: string,
  stats: StatsData | null,
  maxResults = 5
): Recommendation[] {
  const available = allBrawlers.filter((b) => !usedIds.has(b.id));
  const firstPick = blueTeamPicks.length === 0 && redTeamPicks.length === 0;
  const hasEnemies = redTeamPicks.length > 0;

  return available
    .map((b) => {
      const cls = b.class?.name ?? "Unknown";
      const difficulty = getBrawlerDifficulty(b.name, cls);

      // Rule 1: Map winrate
      const mapStat = stats?.mapWinrates[mapName]?.[b.id];
      const r1 = winRate(mapStat, 0.5);

      // Rule 2: Counter-pick — confidence-shrunk toward 0.5 (not a binary threshold)
      // More h2h games = more meaningful counter signal
      let r2 = 0.5;
      if (stats && hasEnemies) {
        const rates = redTeamPicks.map((enemy) =>
          shrinkToward50(stats.headToHead[b.id]?.[enemy.id], 10)
        );
        r2 = rates.reduce((a, c) => a + c, 0) / rates.length;
      }

      // Rule 3: Synergy — confidence-shrunk toward 0.5
      let r3 = 0.5;
      if (stats && blueTeamPicks.length > 0) {
        const rates = blueTeamPicks.map((ally) =>
          shrinkToward50(stats.synergy[b.id]?.[ally.id], 15)
        );
        r3 = rates.reduce((a, c) => a + c, 0) / rates.length;
      }

      // Rule 4: Ease of play
      const r4 = (4 - difficulty) / 3;

      // Meta = WR + pick rate
      const totalMapGames = mapStat
        ? Object.values(stats?.mapWinrates[mapName] ?? {}).reduce((s, x) => s + x.games, 0)
        : 0;
      const usageRate = (mapStat && totalMapGames > 0) ? mapStat.games / totalMapGames : 0;
      const maxUsage = stats
        ? Math.max(...Object.values(stats.mapWinrates[mapName] ?? { _: { games: 1, wins: 0 } }).map(x => x.games))
        : 1;
      const usageNorm = maxUsage > 0 ? (mapStat?.games ?? 0) / maxUsage : 0;
      const metaScore = stats && mapStat && mapStat.games >= 5
        ? r1 * 0.6 + usageNorm * 0.4
        : 0.5;

      // Weights: when enemies present, counter matters more
      const weights = firstPick
        ? [0.70, 0.00, 0.00, 0.10, 0.20]  // first pick: pure meta
        : hasEnemies
        ? [0.40, 0.20, 0.30, 0.05, 0.05]  // with enemies: counter is king
        : [0.55, 0.25, 0.00, 0.15, 0.05]; // blue allies only: meta + synergy

      const score = Math.round(
        (metaScore * weights[0] + r1 * weights[1] + r2 * weights[2] + r3 * weights[3] + r4 * weights[4]) * 100
      );

      // Reason string
      let reason = "";
      if (!stats || !mapStat || mapStat.games < 5) {
        reason = `${cls} · ${difficulty === 1 ? "Easy" : difficulty === 2 ? "Medium" : "Hard"}`;
      } else {
        const wr = Math.round(r1 * 100);
        const usage = Math.round(usageRate * 100);
        reason = `${wr}% WR · ${usage}% pick · ${mapStat.games} games`;
        if (hasEnemies && r2 > 0.54) reason += ` · counters`;
        else if (hasEnemies && r2 < 0.46) reason += ` · weak vs enemy`;
      }

      const mapGames = mapStat?.games ?? 0;
      const sort = confidenceScore(mapStat?.wins ?? 0, mapGames);

      return { brawler: b, score, winRateMap: r1, winRateCounter: r2, winRateSynergy: r3, mapGames, sortScore: sort, difficulty, reason };
    })
    .sort((a, b) => b.sortScore - a.sortScore || b.score - a.score || a.brawler.name.localeCompare(b.brawler.name))
    .slice(0, maxResults);
}

// ── Win Prediction ────────────────────────────────────────────────────────────

export interface WinPrediction {
  probability: number;
  confidence: "low" | "medium" | "high";
  blueAvgMapWR: number;
  redAvgMapWR: number;
  blueCounterEdge: number;
  blueSynergyScore: number;
  sampleSize: number;
}

export function predictWinProbability(
  bluePicks: BfBrawler[],
  redPicks: BfBrawler[],
  mapName: string,
  stats: StatsData | null
): WinPrediction {
  if (!stats || bluePicks.length === 0 || redPicks.length === 0) {
    return { probability: 50, confidence: "low", blueAvgMapWR: 0.5, redAvgMapWR: 0.5, blueCounterEdge: 0.5, blueSynergyScore: 0.5, sampleSize: 0 };
  }

  const mapData = stats.mapWinrates[mapName] ?? {};

  // Map WRs — use raw confidence score (not raw WR) to penalize sparse data
  function mapConfidence(id: number): number {
    const s = mapData[id];
    if (!s || s.games < 1) return 0.5;
    const conf = s.games / (s.games + 20);
    return 0.5 + (s.wins / s.games - 0.5) * conf;
  }

  const blueMapWRs = bluePicks.map((b) => mapConfidence(b.id));
  const redMapWRs  = redPicks.map((b) => mapConfidence(b.id));
  const blueAvgMapWR = blueMapWRs.reduce((s, v) => s + v, 0) / blueMapWRs.length;
  const redAvgMapWR  = redMapWRs.reduce((s, v) => s + v, 0) / redMapWRs.length;

  // H2H — confidence-shrunk
  const h2hRates: number[] = [];
  for (const b of bluePicks)
    for (const r of redPicks)
      h2hRates.push(shrinkToward50(stats.headToHead[b.id]?.[r.id], 10));
  const blueCounterEdge = h2hRates.length
    ? h2hRates.reduce((s, v) => s + v, 0) / h2hRates.length
    : 0.5;

  // Synergy — confidence-shrunk
  const synRates: number[] = [];
  for (let i = 0; i < bluePicks.length; i++)
    for (let j = i + 1; j < bluePicks.length; j++)
      synRates.push(shrinkToward50(stats.synergy[bluePicks[i].id]?.[bluePicks[j].id], 15));
  const blueSynergyScore = synRates.length
    ? synRates.reduce((s, v) => s + v, 0) / synRates.length
    : 0.5;

  // ── Differential approach — honest ──
  // Compare blue advantage RELATIVE to red, not absolute values.
  // If both teams pick equally good brawlers → 50%. Not "both are good → 60%".
  const mapDiff     = (blueAvgMapWR - 0.5) - (redAvgMapWR - 0.5); // blue vs red relative strength
  const counterDiff = blueCounterEdge - 0.5;                        // h2h blue edge
  const synergyDiff = blueSynergyScore - 0.5;                       // synergy edge

  const rawAdvantage = mapDiff * 0.50 + counterDiff * 0.30 + synergyDiff * 0.20;

  // Shrink toward 50% when data is sparse
  const totalSamples = [...bluePicks, ...redPicks]
    .map((b) => mapData[b.id]?.games ?? 0)
    .reduce((s, v) => s + v, 0);
  const avgGamesPerBrawler = totalSamples / (bluePicks.length + redPicks.length);
  const dataConfidence = Math.min(1, avgGamesPerBrawler / 25);

  const adjustedAdvantage = rawAdvantage * dataConfidence;
  const probability = Math.round((0.5 + adjustedAdvantage) * 100);

  const confidence: WinPrediction["confidence"] =
    totalSamples > 150 ? "high" : totalSamples > 50 ? "medium" : "low";

  return {
    probability: Math.min(82, Math.max(18, probability)), // realistic cap: no draft is unwinnable or guaranteed
    confidence,
    blueAvgMapWR,
    redAvgMapWR,
    blueCounterEdge,
    blueSynergyScore,
    sampleSize: totalSamples,
  };
}
