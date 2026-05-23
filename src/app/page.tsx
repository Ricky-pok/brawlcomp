import { getPlayerRankings } from "@/lib/brawlstars";

export default async function Home() {
  const { items: players } = await getPlayerRankings("global", 10);

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-yellow-400 tracking-tight">
            Brawl Stars
          </h1>
          <p className="text-gray-400 mt-1 text-lg">Global Top 10 Players</p>
        </div>

        <div className="space-y-3">
          {players.map((player) => {
            const color = player.nameColor?.replace("0xff", "#") ?? "#ffffff";
            const medal =
              player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : null;

            return (
              <div
                key={player.tag}
                className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 hover:border-yellow-500/50 transition-colors"
              >
                <span className="text-2xl font-black text-gray-500 w-8 text-center">
                  {medal ?? `#${player.rank}`}
                </span>

                <div className="flex-1 min-w-0">
                  <p
                    className="font-bold text-lg leading-tight truncate"
                    style={{ color }}
                  >
                    {player.name}
                  </p>
                  <p className="text-gray-500 text-sm truncate">
                    {player.club?.name ?? "No Club"} · {player.tag}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-yellow-400 font-black text-lg">
                    {player.trophies.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs">trophies</p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-gray-600 text-xs mt-8">
          Data from Brawl Stars Official API · Updates every 5 min
        </p>
      </div>
    </main>
  );
}
