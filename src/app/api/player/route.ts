import { NextResponse } from "next/server";
import { getPlayer } from "@/lib/brawlstars";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag");

  if (!tag) {
    return NextResponse.json({ error: "Missing ?tag= parameter" }, { status: 400 });
  }

  try {
    const data = await getPlayer(tag);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
