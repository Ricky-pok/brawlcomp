import { NextResponse } from "next/server";
import { getMaps } from "@/lib/brawlify";

export async function GET() {
  try {
    const data = await getMaps();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
