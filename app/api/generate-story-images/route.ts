import { NextRequest, NextResponse } from "next/server";
import { generateStoryImageWithGeminiReference } from "@/lib/story-gemini";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import { storeGeneratedImage } from "@/lib/generated-assets";
import { storySceneLimit } from "@/lib/story-types";
import type { StoryScene } from "@/lib/story-types";

export const runtime = "nodejs";
export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableImageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  return (
    message.includes("429") ||
    lower.includes("resource exhausted") ||
    lower.includes("high load") ||
    lower.includes("busy")
  );
}

async function storeImageUrl(dataUrl: string, request: NextRequest) {
  if (!dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }

  if (process.env.VERCEL) {
    return dataUrl;
  }

  const stored = await storeGeneratedImage(dataUrl);
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;
  const protocol = forwardedProto ?? requestUrl.protocol.replace(":", "");

  return `${protocol}://${host}/api/generated-assets/${stored.id}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      scenes?: StoryScene[];
      stylePrompt?: string;
      sceneNumber?: number;
      masterCharacterImageUrl?: string;
    };
    const scenes = Array.isArray(body.scenes)
      ? body.scenes.slice(0, storySceneLimit)
      : [];

    if (!scenes.length) {
      return NextResponse.json(
        { error: "Scene belum tersedia." },
        { status: 400 }
      );
    }

    const images = [];

    for (const scene of scenes) {
      let image = "";
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          image = await generateStoryImageWithGeminiReference(
            [
              body.masterCharacterImageUrl && scene.scene_number > 1
                ? "This is a follow-up scene. Use the supplied Scene 1 image as the master character reference. Keep the exact same character. Only change action, pose, scene, and background."
                : "This is Scene 1. Create the master character identity for all following scenes.",
              "Critical continuity rule: all generated story images must feature the exact same main character identity, same face, same age, same outfit, same hairstyle or hijab, same body shape, and same visual style. Do not redesign the character.",
              scene.image_prompt,
              body.stylePrompt || ""
            ].join(" "),
            scene.scene_number > 1 ? body.masterCharacterImageUrl : undefined
          );
          break;
        } catch (error) {
          lastError = error;

          if (attempt >= 3 || !isRetryableImageError(error)) {
            throw error;
          }

          await sleep(20_000);
        }
      }

      if (!image) {
        throw lastError || new Error("Image cerita gagal dijana.");
      }

      images.push({
        scene_number: scene.scene_number,
        imageUrl: await storeImageUrl(image, request)
      });
    }

    return NextResponse.json({
      images,
      mock: process.env.STORY_MOCK?.trim().toLowerCase() === "true"
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getFriendlyErrorMessage(error, "Image cerita gagal dijana. Cuba sekali lagi.")
      },
      { status: 500 }
    );
  }
}
