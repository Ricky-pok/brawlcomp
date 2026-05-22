import { NextResponse } from "next/server";
import { getEvents } from "@/lib/brawlify";

export async function GET() {
  try {
    const data = await getEvents();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
