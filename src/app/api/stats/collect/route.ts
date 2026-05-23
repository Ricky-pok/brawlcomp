import { NextResponse } from "next/server";
import { collectStats } from "@/lib/statsCollector";
import type { StatsData } from "@/lib/statsCollector";
import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";

const STATS_PATH = join(process.cwd(), "public", "stats.json");

async function loadExisting(): Promise<StatsData | null> {
  try {
    const raw = await readFile(STATS_PATH, "utf-8");
    return JSON.parse(raw) as StatsData;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const reset = body?.reset === true;

    if (reset) {
      try { await unlink(STATS_PATH); } catch { /* ok */ }
    }

    const existing = reset ? null : await loadExisting();

    const start = Date.now();
    const { stats, newBattles, skipped, players, discovered } = await collectStats(existing);
    await writeFile(STATS_PATH, JSON.stringify(stats));

    return NextResponse.json({
      ok: true,
      newBattles,
      skipped,
      discovered,
      queueSize: stats.discoveryQueue.length,
      totalBattles: stats.totalBattles,
      players,
      maps: Object.keys(stats.mapWinrates).length,
      duration: `${((Date.now() - start) / 1000).toFixed(1)}s`,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
