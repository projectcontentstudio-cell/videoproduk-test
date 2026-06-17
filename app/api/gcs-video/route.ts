import { NextRequest, NextResponse } from "next/server";
import { downloadGcsObject } from "@/lib/gcs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const uri = request.nextUrl.searchParams.get("uri") || "";

    if (!uri.startsWith("gs://")) {
      return NextResponse.json(
        { error: "GCS video URI tidak valid." },
        { status: 400 }
      );
    }

    const bytes = await downloadGcsObject(uri);

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": 'inline; filename="video-cerita.mp4"'
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Video GCS tidak dapat dibaca."
      },
      { status: 500 }
    );
  }
}
