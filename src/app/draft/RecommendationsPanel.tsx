"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type { BfBrawler, BfMap } from "@/lib/brawlify";
import type { StatsData } from "@/lib/statsCollector";
import { getRecommendations, MODE_NAMES } from "@/lib/recommendations";

const C = {
  bg:        "#0C1422",
  panel:     "#111E32",
  card:      "#162840",
  cardHover: "#1C3252",
  input:     "#0A1828",
  border:    "#1E3A60",
  gold:      "#FFD13A",
  blue:      "#2463EA",
  red:       "#E83A2D",
  text:      "#E8F0FF",
  muted:     "#527090",
  green:     "#4CC44C",
};

interface Props {
  allBrawlers: BfBrawler[];
  usedIds: Set<number>;
  redTeamPicks: BfBrawler[];
  blueTeamPicks: BfBrawler[];
  selectedMap: BfMap | null;
  onPick: (b: BfBrawler) => void;
  stats: StatsData | null;
  onStatsUpdate: (s: StatsData) => void;
}

export default function RecommendationsPanel({
  allBrawlers, usedIds, redTeamPicks, blueTeamPicks, selectedMap, onPick, stats, onStatsUpdate,
}: Props) {
  const [statsStatus, setStatsStatus] = useState<"loading" | "ready" | "empty" | "collecting">("loading");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) { setStatsStatus("empty"); return; }
      const data: StatsData = await res.json();
      onStatsUpdate(data);
      setLastUpdated(new Date(data.lastUpdated).toLocaleDateString());
      setStatsStatus("ready");
    } catch {
      setStatsStatus("empty");
    }
  }, [onStatsUpdate]);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function triggerCollect(reset = false) {
    setStatsStatus("collecting");
    try {
      await fetch("/api/stats/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset }),
      });
      await loadStats();
    } catch {
      setStatsStatus("empty");
    }
  }

  const gameMode = selectedMap?.gameMode?.hash?.toLowerCase() ?? "";
  const mapName  = selectedMap?.name ?? "";

  const recs = selectedMap
    ? getRecommendations(allBrawlers, usedIds, redTeamPicks, blueTeamPicks, mapName, stats)
    : [];

  return (
    <div
      className="flex flex-col h-full overflow-hidden border-l"
      style={{ background: C.panel, borderColor: C.border }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b" style={{ borderColor: C.border }}>
        <p className="text-xs font-black tracking-widest uppercase text-center" style={{ color: C.blue }}>
          🔵 Blue Picks
        </p>
        {selectedMap && (
          <p className="text-[10px] text-center mt-0.5" style={{ color: C.muted }}>
            {MODE_NAMES[gameMode] ?? selectedMap.gameMode.name}
          </p>
        )}

        {/* Stats status */}
        <div className="flex items-center justify-between mt-1.5">
          {statsStatus === "ready" && (
            <span className="text-[9px]" style={{ color: C.green }}>
              ✓ {(stats?.totalBattles ?? stats?.sampleSize ?? 0).toLocaleString()} battles · {lastUpdated}
            </span>
          )}
          {statsStatus === "empty" && (
            <span className="text-[9px]" style={{ color: "#C48A00" }}>No stats data</span>
          )}
          {statsStatus === "loading" && (
            <span className="text-[9px]" style={{ color: C.muted }}>Loading stats…</span>
          )}
          {statsStatus === "collecting" && (
            <span className="text-[9px] animate-pulse" style={{ color: C.gold }}>Collecting 10 regions… (~2min)</span>
          )}
          <div className="flex items-center gap-1.5 ml-1">
            <button
              onClick={() => triggerCollect(false)}
              disabled={statsStatus === "collecting"}
              className="text-[9px] transition-colors disabled:opacity-40 hover:text-white"
              style={{ color: C.gold }}
              title="Add new battles from top 200 × 10 regions"
            >
              {statsStatus === "collecting" ? "…" : "↻"}
            </button>
            {statsStatus === "ready" && (
              <button
                onClick={() => {
                  if (confirm("Reset all stats? Use at the start of a new season.")) triggerCollect(true);
                }}
                className="text-[9px] transition-colors hover:text-red-400"
                style={{ color: "#4A1A1A" }}
                title="Reset for new season"
              >
                ⊘
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!selectedMap ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-2 py-8">
            <p className="text-3xl mb-2">🗺️</p>
            <p className="text-xs" style={{ color: C.muted }}>Select a map to see recommendations</p>
          </div>
        ) : statsStatus === "empty" ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-2 py-6 gap-3">
            <p className="text-xs" style={{ color: C.muted }}>No stats yet. Collect data from top 200 players × 10 regions.</p>
            <button
              onClick={() => triggerCollect(false)}
              className="text-xs font-black px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: C.gold, color: C.bg }}
            >
              Collect Stats
            </button>
          </div>
        ) : recs.length === 0 ? (
          <p className="text-xs text-center mt-4" style={{ color: C.muted }}>No recommendations</p>
        ) : (
          <div className="space-y-1.5">
            {recs.map(({ brawler, score, winRateMap, winRateCounter, mapGames, difficulty, reason }) => (
              <button
                key={brawler.id}
                onClick={() => onPick(brawler)}
                className="w-full flex items-center gap-2 p-2 rounded-xl border transition-all group"
                style={{ background: C.card, borderColor: C.border }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = C.cardHover;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.gold;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = C.card;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
                }}
              >
                <div className="relative w-9 h-9 shrink-0 rounded-lg overflow-hidden">
                  <Image src={brawler.imageUrl} alt={brawler.name} fill className="object-cover" sizes="36px" />
                </div>
                <div className="min-w-0 text-left flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-white text-xs font-bold truncate group-hover:text-yellow-300 transition-colors">
                      {brawler.name}
                    </p>
                    <span
                      className="text-xs font-black ml-1 shrink-0"
                      style={{ color: score >= 65 ? C.green : score >= 50 ? C.gold : C.muted }}
                    >
                      {score}
                    </span>
                  </div>
                  <p className="text-[10px] truncate" style={{ color: C.muted }}>{reason}</p>
                  {statsStatus === "ready" && (
                    <div className="flex gap-1 mt-1 items-center">
                      <div className="w-8 h-1 rounded-full overflow-hidden" style={{ background: "#0A1828" }}>
                        <div className="h-full rounded-full" style={{ width: `${winRateMap * 100}%`, background: C.blue }} />
                      </div>
                      <div className="w-8 h-1 rounded-full overflow-hidden" style={{ background: "#0A1828" }}>
                        <div className="h-full rounded-full" style={{ width: `${winRateCounter * 100}%`, background: C.red }} />
                      </div>
                      <span className="text-[8px] ml-0.5" style={{ color: "#2A4060" }}>
                        {difficulty === 1 ? "E" : difficulty === 2 ? "M" : "H"}
                      </span>
                      {/* Confidence badge */}
                      <span
                        className="text-[8px] font-bold ml-auto px-1 rounded"
                        style={{
                          background: mapGames >= 100 ? "rgba(76,196,76,0.15)"
                                    : mapGames >= 30  ? "rgba(255,209,58,0.15)"
                                    : "rgba(232,58,45,0.15)",
                          color:      mapGames >= 100 ? C.green
                                    : mapGames >= 30  ? C.gold
                                    : "#E83A2D",
                        }}
                        title={`${mapGames} partidas — ${mapGames >= 100 ? "alta" : mapGames >= 30 ? "media" : "baja"} confianza`}
                      >
                        {mapGames >= 100 ? `${mapGames}` : mapGames >= 30 ? `${mapGames}` : mapGames > 0 ? `${mapGames}⚠` : "—"}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
            {statsStatus === "ready" && (
              <p className="text-[9px] text-center pt-1" style={{ color: "#2A4060" }}>
                🔵 map WR · 🔴 counter WR · E/M/H difficulty
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
