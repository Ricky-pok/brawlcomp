import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const path = join(process.cwd(), "public", "stats.json");
    const raw = await readFile(path, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "No stats yet. Run POST /api/stats/collect first." }, { status: 404 });
  }
}
