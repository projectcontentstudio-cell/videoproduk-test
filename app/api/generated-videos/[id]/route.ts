import { NextResponse } from "next/server";
import { readGeneratedVideo } from "@/lib/generated-videos";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bytes = await readGeneratedVideo(params.id);

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "private, max-age=86400"
      }
    });
  } catch {
    return NextResponse.json({ error: "Video tidak dijumpai." }, { status: 404 });
  }
}
