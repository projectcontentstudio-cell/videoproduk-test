import { NextRequest, NextResponse } from "next/server";
import { generateStoryScript } from "@/lib/story-gemini";
import { getStoryType } from "@/lib/story-types";
import type { StoryTypeId } from "@/lib/story-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      storyType?: StoryTypeId;
      topic?: string;
    };
    const storyType = getStoryType(body.storyType).id;
    const topic = String(body.topic || "").trim().slice(0, 100);

    if (!topic) {
      return NextResponse.json(
        { error: "Masukkan topik cerita dulu." },
        { status: 400 }
      );
    }

    const script = await generateStoryScript({ storyType, topic });
    return NextResponse.json({ script });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Skrip cerita gagal dijana."
      },
      { status: 500 }
    );
  }
}
