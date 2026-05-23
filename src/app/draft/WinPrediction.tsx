"use client";

import type { BfBrawler, BfMap } from "@/lib/brawlify";
import type { StatsData } from "@/lib/statsCollector";
import { predictWinProbability } from "@/lib/recommendations";

const C = {
  bg:    "#0C1422",
  panel: "#111E32",
  card:  "#162840",
  gold:  "#FFD13A",
  blue:  "#2463EA",
  red:   "#E83A2D",
  green: "#4CC44C",
  text:  "#E8F0FF",
  muted: "#527090",
};

interface Props {
  bluePicks: BfBrawler[];
  redPicks: BfBrawler[];
  selectedMap: BfMap | null;
  stats: StatsData | null;
}

export default function WinPrediction({ bluePicks, redPicks, selectedMap, stats }: Props) {
  const pred = predictWinProbability(bluePicks, redPicks, selectedMap?.name ?? "", stats);
  const p = pred.probability;

  const barColor =
    p >= 60 ? C.green :
    p >= 50 ? C.gold  :
    p >= 40 ? "#FF8A30" : C.red;

  const label =
    p >= 65 ? "Strong Advantage" :
    p >= 55 ? "Slight Advantage" :
    p >= 45 ? "Even Match"       :
    p >= 35 ? "Slight Disadvantage" : "Strong Disadvantage";

  const emoji = p >= 60 ? "🏆" : p >= 50 ? "⚔️" : p >= 40 ? "⚠️" : "💀";

  return (
    <div className="mx-4 my-3 rounded-2xl p-4" style={{ background: C.panel, border: `1px solid ${C.gold}30` }}>
      <p
        className="text-xs uppercase tracking-widest font-bold text-center mb-3"
        style={{ color: C.muted }}
      >
        Win Prediction
      </p>

      {/* Probability bar */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-bold w-8 text-right" style={{ color: "#90B8FF" }}>{p}%</span>
        <div className="flex-1 h-4 rounded-full overflow-hidden relative" style={{ background: "#0A1828" }}>
          <div
            className="absolute left-0 top-0 h-full rounded-l-full transition-all duration-700"
            style={{ width: `${p}%`, background: barColor }}
          />
          <div
            className="absolute right-0 top-0 h-full rounded-r-full transition-all duration-700"
            style={{ width: `${100 - p}%`, background: "rgba(232,58,45,0.5)" }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px" style={{ background: C.muted }} />
        </div>
        <span className="text-xs font-bold w-8" style={{ color: "#FF9090" }}>{100 - p}%</span>
      </div>

      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-xl">{emoji}</span>
        <span className="font-black text-sm" style={{ color: barColor }}>{label}</span>
      </div>

      {/* Breakdown */}
      {stats && pred.sampleSize > 0 ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Map WR", main: Math.round(pred.blueAvgMapWR * 100), sub: Math.round(pred.redAvgMapWR * 100), subLabel: "vs" },
            { label: "Counter", main: Math.round(pred.blueCounterEdge * 100), sub: null, subLabel: "h2h edge" },
            { label: "Synergy", main: Math.round(pred.blueSynergyScore * 100), sub: null, subLabel: "teamwork" },
          ].map(({ label, main, sub, subLabel }) => (
            <div key={label} className="rounded-lg p-2" style={{ background: C.card }}>
              <p className="text-[10px] mb-0.5" style={{ color: C.muted }}>{label}</p>
              <p className="text-xs font-bold text-white">{main}%</p>
              <p className="text-[9px]" style={{ color: "#3A5070" }}>{sub !== null ? `vs ${sub}%` : subLabel}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-center" style={{ color: C.muted }}>
          Collect stats for accurate prediction
        </p>
      )}

      {pred.confidence !== "high" && pred.sampleSize > 0 && (
        <p className="text-[10px] text-center mt-2" style={{ color: "#C48A00" }}>
          {pred.confidence === "medium" ? "⚠️ Medium confidence" : "⚠️ Low confidence — limited data"}
        </p>
      )}
    </div>
  );
}
