import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("http://localhost:9100/health", {
      next: { revalidate: 5 }, // cache for 5s
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Worker API error: ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 502 });
  }
}
