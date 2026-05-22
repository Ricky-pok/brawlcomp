import { NextResponse } from "next/server";
import { getBrawlers } from "@/lib/brawlify";

export async function GET() {
  try {
    const data = await getBrawlers();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
