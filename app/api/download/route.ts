import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL video diperlukan untuk download." },
      { status: 400 }
    );
  }

  if (!url.startsWith("http") && !url.startsWith("data:video")) {
    return NextResponse.json(
      { error: "URL video belum tersedia untuk download." },
      { status: 400 }
    );
  }

  return NextResponse.redirect(url);
}
