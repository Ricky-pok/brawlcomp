import { getMaps, getBrawlers } from "@/lib/brawlify";
import DraftTool from "./DraftTool";

const RANKED_MAPS = new Set([
  "Belles Rock",
  "Bridge Too Far",
  "Center Stage",
  "Double Swoosh",
  "Dry Season",
  "Dueling Beetles",
  "Flaring Phoenix",
  "Gem Fort",
  "Hard Rock Mine",
  "Hideout",
  "Hot Potato",
  "In The Liminal",
  "Kaboom Canyon",
  "New Horizons",
  "Open Business",
  "Out In The Open",
  "Parallel Plays",
  "Pinball Dreams",
  "Quick Travel",
  "Ring Of Fire",
  "Safe Zone",
  "Shooting Star",
  "Sneaky Fields",
  "Triple Dribble",
  "Undermine",
  "Goldarm Gulch",
  "Flowing Springs",
]);

export default async function DraftPage() {
  const [{ list: maps }, { list: brawlers }] = await Promise.all([
    getMaps(),
    getBrawlers(),
  ]);

  // Keep all ranked maps (ignore disabled flag — Brawlify may lag behind), dedupe by name
  const seen = new Set<string>();
  const rankedMaps = maps
    .filter((m) => RANKED_MAPS.has(m.name))
    .filter((m) => (seen.has(m.name) ? false : (seen.add(m.name), true)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const EXCLUDED_BRAWLERS = new Set(["Bolt", "Buzz Lightyear", "Starr Nova"]);

  const sortedBrawlers = [...brawlers]
    .filter((b) => !EXCLUDED_BRAWLERS.has(b.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  return <DraftTool maps={rankedMaps} brawlers={sortedBrawlers} />;
}
