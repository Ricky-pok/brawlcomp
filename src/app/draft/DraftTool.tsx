"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import type { BfMap, BfBrawler } from "@/lib/brawlify";
import type { StatsData } from "@/lib/statsCollector";
import RecommendationsPanel from "./RecommendationsPanel";
import WinPrediction from "./WinPrediction";

const POWER_LEVELS = ["All", "9+", "10+", "11+"];
const MAX_BANS = 6;

const ORDER_BLUE_FIRST: ("blue" | "red")[] = ["blue", "red", "red", "blue", "blue", "red"];
const ORDER_RED_FIRST:  ("blue" | "red")[] = ["red", "blue", "blue", "red", "red", "blue"];

type Team = "blue" | "red";

interface Pick { brawler: BfBrawler; team: Team; }
interface PlayerBrawler { id: number; power: number; }
interface PlayerData { tag: string; name: string; brawlers: PlayerBrawler[]; }

// ── BS color tokens ────────────────────────────────────────────────────────
const C = {
  bg:        "#0C1422",
  panel:     "#111E32",
  card:      "#162840",
  cardHover: "#1C3252",
  input:     "#0A1828",
  border:    "#1E3A60",
  gold:      "#FFD13A",
  goldDim:   "#C48A00",
  blue:      "#2463EA",
  blueDark:  "#07132A",
  red:       "#E83A2D",
  redDark:   "#280808",
  text:      "#E8F0FF",
  muted:     "#527090",
};

export default function DraftTool({ maps, brawlers }: { maps: BfMap[]; brawlers: BfBrawler[] }) {
  const [selectedMap, setSelectedMap] = useState<BfMap | null>(null);
  const [powerFilter, setPowerFilter] = useState("All");
  const [brawlerSearch, setBrawlerSearch] = useState("");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [bans, setBans] = useState<BfBrawler[]>([]);
  const [firstPick, setFirstPick] = useState<Team>("blue");
  const [stats, setStats] = useState<StatsData | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* no stats yet */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const [tagInput, setTagInput] = useState("");
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState("");

  const PICK_ORDER = firstPick === "blue" ? ORDER_BLUE_FIRST : ORDER_RED_FIRST;
  const pickIndex = picks.length;
  const currentTeam: Team = pickIndex < PICK_ORDER.length ? PICK_ORDER[pickIndex] : "blue";
  const draftComplete = pickIndex >= PICK_ORDER.length;

  const usedIds = useMemo(
    () => new Set([...picks.map((p) => p.brawler.id), ...bans.map((b) => b.id)]),
    [picks, bans]
  );

  const bluePicks = picks.filter((p) => p.team === "blue").map((p) => p.brawler);
  const redPicks  = picks.filter((p) => p.team === "red").map((p) => p.brawler);

  const playerBrawlerMap = useMemo(() => {
    if (!playerData) return null;
    return new Map(playerData.brawlers.map((b) => [b.id, b.power]));
  }, [playerData]);

  const minPower = powerFilter === "9+" ? 9 : powerFilter === "10+" ? 10 : powerFilter === "11+" ? 11 : 0;

  const filteredBrawlers = useMemo(() => {
    let list = brawlers;
    if (playerBrawlerMap) {
      list = list.filter((b) => {
        const power = playerBrawlerMap.get(b.id);
        return power !== undefined && power >= minPower;
      });
    }
    const q = brawlerSearch.toLowerCase().trim();
    if (q) list = list.filter((b) => b.name.toLowerCase().includes(q));
    return list;
  }, [brawlers, playerBrawlerMap, minPower, brawlerSearch]);

  async function fetchPlayer() {
    const tag = tagInput.trim().replace("#", "").toUpperCase();
    if (!tag) return;
    setTagLoading(true);
    setTagError("");
    setPlayerData(null);
    try {
      const res = await fetch(`/api/player?tag=${tag}`);
      if (!res.ok) throw new Error("not found");
      setPlayerData(await res.json());
    } catch {
      setTagError("Player not found");
    } finally {
      setTagLoading(false);
    }
  }

  function handlePick(b: BfBrawler) {
    if (!selectedMap || usedIds.has(b.id) || draftComplete) return;
    setPicks((prev) => [...prev, { brawler: b, team: currentTeam }]);
  }

  function handleBan(e: React.MouseEvent, b: BfBrawler) {
    e.preventDefault();
    if (!selectedMap || usedIds.has(b.id) || bans.length >= MAX_BANS) return;
    setBans((prev) => [...prev, b]);
  }

  function removePick(id: number) { setPicks((prev) => prev.filter((p) => p.brawler.id !== id)); }
  function removeBan(id: number)  { setBans((prev) => prev.filter((b) => b.id !== id)); }

  function reset() {
    setSelectedMap(null);
    setPicks([]);
    setBans([]);
    setBrawlerSearch("");
  }

  function toggleFirstPick() {
    setFirstPick((p) => (p === "blue" ? "red" : "blue"));
    setPicks([]);
    setBans([]);
  }

  const [mapQuery, setMapQuery] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const mapInputRef = useRef<HTMLInputElement>(null);
  const mapDropdownRef = useRef<HTMLDivElement>(null);

  const filteredMaps = useMemo(() => {
    const q = mapQuery.toLowerCase().trim();
    return q ? maps.filter((m) => m.name.toLowerCase().includes(q) || m.gameMode.name.toLowerCase().includes(q)) : maps;
  }, [mapQuery, maps]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        mapDropdownRef.current && !mapDropdownRef.current.contains(e.target as Node) &&
        !mapInputRef.current?.contains(e.target as Node)
      ) setMapOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectMap(map: BfMap) {
    setSelectedMap(map);
    setMapQuery(map.name);
    setMapOpen(false);
  }

  // Dynamic background tints for current team turn
  const mainBg     = draftComplete ? C.bg        : currentTeam === "blue" ? "#080F1C" : "#150608";
  const topBarBg   = draftComplete ? C.panel     : currentTeam === "blue" ? "#060D1A" : "#120506";
  const topBorder  = draftComplete ? C.border    : currentTeam === "blue" ? "#1A3A80" : "#7A1008";
  const bansBg     = draftComplete ? C.panel     : currentTeam === "blue" ? "#060D1A" : "#120506";
  const controlsBg = draftComplete ? "#0C1A2C"   : currentTeam === "blue" ? "#070E1C" : "#130608";
  const centerBg   = draftComplete ? "#0A1220"   : currentTeam === "blue" ? "#060E1C" : "#140608";
  const pickerBg   = draftComplete ? "#0C1A2C"   : currentTeam === "blue" ? "#070E1C" : "#130608";

  return (
    <div
      className="min-h-screen text-white flex flex-col select-none transition-colors duration-500"
      style={{ background: mainBg }}
    >
      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b relative transition-colors duration-500"
        style={{ background: topBarBg, borderColor: topBorder }}
      >
        {/* Player tag */}
        <form onSubmit={(e) => { e.preventDefault(); fetchPlayer(); }} className="flex items-center gap-1">
          <div
            className="flex items-center gap-1 border rounded-lg px-2 py-1 text-sm transition-colors"
            style={{
              background: tagError ? "rgba(232,58,45,0.12)" : playerData ? "rgba(76,196,76,0.12)" : C.input,
              borderColor: tagError ? "#E83A2D" : playerData ? "#4CC44C" : C.border,
            }}
          >
            <span className="text-xs" style={{ color: C.muted }}>#</span>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => { setTagInput(e.target.value.toUpperCase().replace("#", "")); setTagError(""); }}
              placeholder="PLAYER TAG"
              className="bg-transparent text-white text-xs w-24 focus:outline-none font-mono"
              style={{ caretColor: C.gold }}
            />
            {playerData && (
              <button type="button" onClick={() => { setPlayerData(null); setTagInput(""); }} className="text-xs ml-1 hover:text-white transition-colors" style={{ color: C.muted }}>✕</button>
            )}
          </div>
          <button
            type="submit"
            disabled={tagLoading || !tagInput.trim()}
            className="text-xs font-black px-2 py-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{ background: C.gold, color: C.bg }}
          >
            {tagLoading ? "..." : "GO"}
          </button>
          {playerData && <span className="text-xs font-bold truncate max-w-[80px]" style={{ color: "#4CC44C" }}>{playerData.name}</span>}
          {tagError && <span className="text-xs" style={{ color: C.red }}>{tagError}</span>}
        </form>

        <div className="absolute left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest uppercase" style={{ color: C.gold }}>
          Power Level Filter
        </div>

        <div className="flex items-center gap-1">
          {POWER_LEVELS.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setPowerFilter(lvl)}
              disabled={!playerData && lvl !== "All"}
              className="px-3 py-1 rounded text-xs font-bold transition-all disabled:opacity-30"
              style={{
                background: powerFilter === lvl ? C.gold : "transparent",
                color: powerFilter === lvl ? C.bg : C.muted,
              }}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-1 gap-0">

        {/* Blue team */}
        <div
          className="w-[160px] shrink-0 flex flex-col gap-2 p-3 border-r"
          style={{ background: C.blueDark, borderColor: "#1A3A80" }}
        >
          <p className="text-xs font-black tracking-widest uppercase text-center mb-1" style={{ color: C.blue }}>
            Blue Team
          </p>
          {Array.from({ length: 3 }).map((_, i) => {
            const pick = bluePicks[i];
            return (
              <div
                key={i}
                onClick={() => pick && removePick(pick.id)}
                className="relative w-full aspect-square rounded-xl overflow-hidden border-2 transition-all"
                style={{
                  borderColor: pick ? C.blue : "#1A3A80",
                  background: pick ? "transparent" : "#0A1528",
                  cursor: pick ? "pointer" : "default",
                }}
              >
                {pick ? (
                  <>
                    <Image src={pick.imageUrl} alt={pick.name} fill className="object-cover hover:opacity-70 transition-opacity" sizes="140px" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-xs py-0.5 font-semibold truncate px-1" style={{ color: "#A0C8FF" }}>
                      {pick.name}
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-3xl font-black" style={{ color: "#1A3A80" }}>
                    {i + 1}
                  </div>
                )}
              </div>
            );
          })}
          {!draftComplete && currentTeam === "blue" && (
            <p className="text-xs text-center mt-1 animate-pulse" style={{ color: C.blue }}>← Picking</p>
          )}
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col overflow-hidden">

          <div className="flex flex-1 overflow-hidden transition-colors duration-500" style={{ background: centerBg }}>
            {selectedMap ? (
              <>
                {/* Map image */}
                <div className="flex items-start justify-center p-3 shrink-0">
                  <div className="relative w-[200px]">
                    <Image
                      src={selectedMap.imageUrl}
                      alt={selectedMap.name}
                      width={200}
                      height={200}
                      className="object-contain rounded-xl"
                      style={{ width: "200px", height: "auto" }}
                    />
                    <div className="mt-1 text-center">
                      <p className="text-white text-xs font-bold">{selectedMap.name}</p>
                      <p className="text-xs" style={{ color: selectedMap.gameMode.color }}>{selectedMap.gameMode.name}</p>
                    </div>
                  </div>
                </div>

                {/* Recommendations / Win Prediction */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  {draftComplete ? (
                    <div className="flex-1 overflow-y-auto">
                      <WinPrediction bluePicks={bluePicks} redPicks={redPicks} selectedMap={selectedMap} stats={stats} />
                    </div>
                  ) : (
                    <RecommendationsPanel
                      allBrawlers={brawlers}
                      usedIds={usedIds}
                      redTeamPicks={redPicks}
                      blueTeamPicks={bluePicks}
                      selectedMap={selectedMap}
                      onPick={handlePick}
                      stats={stats}
                      onStatsUpdate={setStats}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-5xl">🗺️</p>
                <p className="text-sm font-semibold" style={{ color: C.muted }}>Select a map first</p>
                <p className="text-xs" style={{ color: "#3A5070" }}>You must choose a map before picking brawlers</p>
              </div>
            )}
          </div>

          {/* Bans row */}
          <div
            className="border-t px-4 py-2 transition-colors duration-500"
            style={{ background: bansBg, borderColor: topBorder }}
          >
            <p className="text-xs uppercase tracking-widest mb-1.5 font-bold" style={{ color: C.muted }}>
              Banned · {bans.length}/{MAX_BANS}
            </p>
            <div className="flex gap-2 flex-wrap min-h-[44px]">
              {bans.map((b) => (
                <button
                  key={b.id}
                  onClick={() => removeBan(b.id)}
                  className="relative w-10 h-10 rounded-lg overflow-hidden border-2 grayscale opacity-60 hover:opacity-40 transition-opacity"
                  style={{ borderColor: "#7A1008" }}
                  title={`Remove ban: ${b.name}`}
                >
                  <Image src={b.imageUrl} alt={b.name} fill className="object-cover" sizes="40px" />
                  <div className="absolute inset-0 flex items-center justify-center font-black text-sm bg-black/30" style={{ color: C.red }}>✕</div>
                </button>
              ))}
              {bans.length === 0 && (
                <p className="text-xs self-center" style={{ color: "#2A4060" }}>Right-click a brawler to ban</p>
              )}
            </div>
          </div>

          {/* Map controls */}
          <div
            className="flex items-center gap-2 px-3 py-2 border-t transition-colors duration-500"
            style={{ background: controlsBg, borderColor: topBorder }}
          >
            <div className="relative flex-1">
              <input
                ref={mapInputRef}
                type="text"
                value={mapQuery}
                onChange={(e) => {
                  setMapQuery(e.target.value);
                  setMapOpen(true);
                  if (!e.target.value) { setSelectedMap(null); setPicks([]); setBans([]); }
                }}
                onFocus={() => setMapOpen(true)}
                placeholder="Search ranked map..."
                className="w-full rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#3A5070] focus:outline-none transition-colors"
                style={{ background: C.input, border: `1px solid ${C.border}` }}
              />
              {mapOpen && filteredMaps.length > 0 && (
                <div
                  ref={mapDropdownRef}
                  className="absolute bottom-full mb-1 left-0 right-0 rounded-xl overflow-hidden shadow-2xl z-50 max-h-56 overflow-y-auto"
                  style={{ background: C.panel, border: `1px solid ${C.border}` }}
                >
                  {filteredMaps.map((m) => (
                    <button
                      key={m.id}
                      onMouseDown={() => selectMap(m)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="relative w-8 h-8 shrink-0 rounded overflow-hidden bg-black/30">
                        <Image src={m.imageUrl} alt={m.name} fill className="object-contain" sizes="32px" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{m.name}</p>
                        <p className="text-xs truncate" style={{ color: m.gameMode.color }}>{m.gameMode.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* First pick toggle */}
            <button
              onClick={toggleFirstPick}
              className="font-bold px-3 py-1.5 rounded-lg text-xs transition-all border shrink-0"
              style={firstPick === "blue"
                ? { background: "rgba(36,99,234,0.2)", borderColor: "rgba(36,99,234,0.6)", color: "#90B8FF" }
                : { background: "rgba(232,58,45,0.2)", borderColor: "rgba(232,58,45,0.6)", color: "#FF9090" }
              }
            >
              {firstPick === "blue" ? "🔵 First" : "🔴 First"}
            </button>

            {/* UNDO */}
            <button
              onClick={() => setPicks((prev) => prev.slice(0, -1))}
              disabled={picks.length === 0}
              className="font-black px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 disabled:opacity-40"
              style={{ background: C.gold, color: C.bg }}
            >
              UNDO
            </button>

            {/* RESET */}
            <button
              onClick={reset}
              className="font-bold px-3 py-1.5 rounded-lg text-xs transition-colors border shrink-0"
              style={{ background: C.input, color: C.muted, borderColor: C.border }}
            >
              RESET
            </button>
          </div>
        </div>

        {/* Red team */}
        <div
          className="w-[160px] shrink-0 flex flex-col gap-2 p-3 border-l"
          style={{ background: C.redDark, borderColor: "#7A1008" }}
        >
          <p className="text-xs font-black tracking-widest uppercase text-center mb-1" style={{ color: C.red }}>
            Red Team
          </p>
          {Array.from({ length: 3 }).map((_, i) => {
            const pick = redPicks[i];
            return (
              <div
                key={i}
                onClick={() => pick && removePick(pick.id)}
                className="relative w-full aspect-square rounded-xl overflow-hidden border-2 transition-all"
                style={{
                  borderColor: pick ? C.red : "#7A1008",
                  background: pick ? "transparent" : "#200808",
                  cursor: pick ? "pointer" : "default",
                }}
              >
                {pick ? (
                  <>
                    <Image src={pick.imageUrl} alt={pick.name} fill className="object-cover hover:opacity-70 transition-opacity" sizes="140px" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-xs py-0.5 font-semibold truncate px-1" style={{ color: "#FFA0A0" }}>
                      {pick.name}
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-3xl font-black" style={{ color: "#7A1008" }}>
                    {i + 1}
                  </div>
                )}
              </div>
            );
          })}
          {!draftComplete && currentTeam === "red" && (
            <p className="text-xs text-center mt-1 animate-pulse" style={{ color: C.red }}>Picking →</p>
          )}
        </div>

      </div>

      {/* ── Brawler picker ── */}
      <div
        className="border-t px-4 pt-3 pb-4 transition-colors duration-500"
        style={{ background: pickerBg, borderColor: topBorder }}
      >
        <div className="flex items-center gap-3 mb-3">
          <input
            type="text"
            value={brawlerSearch}
            onChange={(e) => setBrawlerSearch(e.target.value)}
            placeholder="Search Brawlers"
            className="flex-1 rounded-lg px-4 py-2 text-sm text-white placeholder-[#3A5070] focus:outline-none transition-colors"
            style={{ background: C.input, border: `1px solid ${C.border}` }}
          />
          <span
            className="text-xs font-black px-3 py-1.5 rounded-lg whitespace-nowrap"
            style={
              draftComplete
                ? { background: C.gold, color: C.bg }
                : currentTeam === "blue"
                ? { background: C.blue, color: "#fff" }
                : { background: C.red, color: "#fff" }
            }
          >
            {draftComplete ? "✅ Draft done" : currentTeam === "blue" ? `🔵 Blue · pick ${pickIndex + 1}` : `🔴 Red · pick ${pickIndex + 1}`}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {filteredBrawlers.map((b) => {
            const isUsed = usedIds.has(b.id);
            const power = playerBrawlerMap?.get(b.id);
            return (
              <button
                key={b.id}
                onClick={() => handlePick(b)}
                onContextMenu={(e) => handleBan(e, b)}
                title={`${b.name}${power ? ` · Power ${power}` : ""} — click to pick, right-click to ban`}
                disabled={isUsed}
                className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all duration-150"
                style={{
                  borderColor: isUsed ? "#1A2A3A" : C.border,
                  opacity: isUsed ? 0.25 : 1,
                  filter: isUsed ? "grayscale(1)" : "none",
                  cursor: isUsed ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isUsed) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = currentTeam === "blue" ? C.blue : C.red;
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = isUsed ? "#1A2A3A" : C.border;
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                }}
              >
                <Image src={b.imageUrl} alt={b.name} fill className="object-cover" sizes="56px" />
                {power !== undefined && (
                  <span
                    className="absolute bottom-0 right-0 text-[9px] font-black px-0.5 rounded-tl"
                    style={{
                      background: power === 11 ? C.gold : power >= 9 ? C.blue : "#2A3A4A",
                      color: power === 11 ? C.bg : "#fff",
                    }}
                  >
                    {power}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
