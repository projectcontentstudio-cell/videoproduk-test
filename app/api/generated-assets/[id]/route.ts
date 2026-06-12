import { NextResponse } from "next/server";
import { readGeneratedImage } from "@/lib/generated-assets";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const asset = await readGeneratedImage(params.id);

    return new NextResponse(asset.bytes, {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=86400"
      }
    });
  } catch {
    return NextResponse.json({ error: "Asset tidak dijumpai." }, { status: 404 });
  }
}
