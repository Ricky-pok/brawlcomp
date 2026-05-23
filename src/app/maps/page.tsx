import { getMaps } from "@/lib/brawlify";
import MapSearch from "./MapSearch";

export default async function MapsPage() {
  const { list: maps } = await getMaps();
  const active = maps.filter((m) => !m.disabled);

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-yellow-400 tracking-tight">
            Map Explorer
          </h1>
          <p className="text-gray-400 mt-1 text-lg">
            Search any Brawl Stars map by name or game mode
          </p>
        </div>

        <MapSearch maps={active} />
      </div>
    </main>
  );
}
