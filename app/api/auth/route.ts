import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expectedPassword = process.env.APP_PASSWORD;

  if (!expectedPassword) {
    return NextResponse.json(
      { error: "APP_PASSWORD belum ditetapkan." },
      { status: 500 }
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;

  if (payload?.password?.trim() !== expectedPassword.trim()) {
    return NextResponse.json({ error: "Password salah." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
