import { NextRequest, NextResponse } from "next/server";
import { generateStorySuggestions } from "@/lib/story-gemini";
import { getStoryType } from "@/lib/story-types";
import type { StoryTypeId } from "@/lib/story-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      storyType?: StoryTypeId;
      currentTopic?: string;
    };
    const storyType = getStoryType(body.storyType).id;
    const suggestions = await generateStorySuggestions({
      storyType,
      currentTopic: String(body.currentTopic || "").trim().slice(0, 100)
    });

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json(
      { error: "Cadangan cerita gagal dijana." },
      { status: 500 }
    );
  }
}
