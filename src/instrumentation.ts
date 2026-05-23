// Auto-collection cron — runs server-side every 2 hours
// Next.js 15+ loads this file automatically on server startup.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
  const INITIAL_DELAY_MS = 60 * 1000;      // wait 1 min after startup before first run

  async function runCollection() {
    try {
      const { readFile, writeFile, unlink } = await import("fs/promises");
      const { join } = await import("path");
      const { collectStats } = await import("./lib/statsCollector");

      const statsPath = join(process.cwd(), "public", "stats.json");
      let existing = null;
      try {
        existing = JSON.parse(await readFile(statsPath, "utf-8"));
      } catch { /* first run */ }

      const { stats, newBattles, players } = await collectStats(existing);
      await writeFile(statsPath, JSON.stringify(stats));

      console.log(
        `[AutoCollect] +${newBattles} battles | ${players} players | total: ${stats.totalBattles.toLocaleString()}`
      );
    } catch (err) {
      console.error("[AutoCollect] Error:", err);
    }
  }

  // Start after initial delay, then repeat every 2 hours
  setTimeout(() => {
    runCollection();
    setInterval(runCollection, INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  console.log("[AutoCollect] Scheduled — runs every 2 hours");
}
