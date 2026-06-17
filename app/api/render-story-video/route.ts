import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/google-auth";
import { storeGeneratedVideo } from "@/lib/generated-videos";
import { downloadGcsObject } from "@/lib/gcs";
import { storySceneLimit } from "@/lib/story-types";
import type { StoryScript } from "@/lib/story-types";

export const runtime = "nodejs";
export const maxDuration = 300;

function shouldMockStory() {
  return process.env.STORY_MOCK?.trim().toLowerCase() === "true";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVeoModelUrl(action: "predictLongRunning" | "fetchPredictOperation") {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region = process.env.VEO_REGION ?? "us-central1";
  const model = process.env.VEO_MODEL ?? "veo-3.1-lite-generate-001";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:${action}`;
}

async function readGoogleError(response: Response) {
  const text = await response.text();
  const compact = text.replace(/\s+/g, " ").trim();

  return compact ? ` ${compact.slice(0, 900)}` : "";
}

function isVeoFaceSafetyError(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("person/face generation") ||
    lower.includes("current safety settings") ||
    lower.includes("input image contains content") ||
    message.includes("17301594")
  );
}

function dataUrlToImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    bytesBase64Encoded: match[2],
    mimeType: match[1] === "image/jpg" ? "image/jpeg" : match[1]
  };
}

async function referenceUrlToImage(referenceUrl: string) {
  const dataUrlImage = dataUrlToImage(referenceUrl);

  if (dataUrlImage) {
    return dataUrlImage;
  }

  if (!referenceUrl.startsWith("http://") && !referenceUrl.startsWith("https://")) {
    throw new Error("Reference image mesti data URL, http, atau https.");
  }

  const response = await fetch(referenceUrl);

  if (!response.ok) {
    throw new Error(`Reference image gagal dibaca. Status ${response.status}.`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0];

  if (mimeType !== "image/png" && mimeType !== "image/jpeg") {
    throw new Error("Reference image bukan PNG atau JPEG.");
  }

  return {
    bytesBase64Encoded: Buffer.from(await response.arrayBuffer()).toString("base64"),
    mimeType
  };
}

async function startVeoOperation(referenceSceneUrl: string, prompt: string) {
  const image = await referenceUrlToImage(referenceSceneUrl);
  const response = await fetch(getVeoModelUrl("predictLongRunning"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      instances: [
        {
          prompt,
          image
        }
      ],
      parameters: {
        aspectRatio: "9:16",
        durationSeconds: 8,
        sampleCount: 1
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Veo gagal mula. Status ${response.status}.${await readGoogleError(response)}`
    );
  }

  const data = await response.json();
  const operationName = data?.name || data?.operationName;

  if (!operationName) {
    throw new Error("Veo tidak pulangkan operation name.");
  }

  return operationName as string;
}

async function pollVeoOperation(operationName: string) {
  const maxPolls = Number(process.env.VEO_MAX_POLLS ?? 60);

  for (let poll = 1; poll <= maxPolls; poll += 1) {
    await sleep(10_000);

    const response = await fetch(getVeoModelUrl("fetchPredictOperation"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getGoogleAccessToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ operationName })
    });

    if (!response.ok) {
      throw new Error(
        `Veo status gagal. Status ${response.status}.${await readGoogleError(response)}`
      );
    }

    const data = await response.json();

    if (!data.done) {
      continue;
    }

    if (data.error) {
      throw new Error(`Veo gagal: ${JSON.stringify(data.error).slice(0, 900)}`);
    }

    const video =
      data?.response?.videos?.[0] ||
      data?.response?.predictions?.[0] ||
      data?.predictions?.[0];
    const output =
      video?.bytesBase64Encoded ||
      video?.video?.bytesBase64Encoded ||
      video?.gcsUri ||
      video?.video?.gcsUri;

    if (!output) {
      throw new Error(
        `Veo siap tetapi video output tidak dikenali: ${JSON.stringify(data).slice(
          0,
          900
        )}`
      );
    }

    return output as string;
  }

  throw new Error("Veo belum siap selepas had polling local.");
}

async function saveVideoOutput(output: string) {
  let buffer: Buffer;

  if (output.startsWith("http://") || output.startsWith("https://")) {
    const response = await fetch(output);

    if (!response.ok) {
      throw new Error(`Download video Veo gagal. Status ${response.status}.`);
    }

    buffer = Buffer.from(await response.arrayBuffer());
  } else if (output.startsWith("gs://")) {
    buffer = await downloadGcsObject(output);
  } else {
    buffer = Buffer.from(output, "base64");
  }

  if (process.env.VERCEL) {
    return `data:video/mp4;base64,${buffer.toString("base64")}`;
  }

  const stored = await storeGeneratedVideo(buffer);

  return `/api/generated-videos/${stored.id}`;
}

function makeLongDialogue(
  script: StoryScript,
  scene: StoryScript["scenes"][number] | undefined
) {
  const rawDialogue = String(scene?.narration || "").trim();
  const words = rawDialogue.split(/\s+/).filter(Boolean);

  if (words.length >= 18) {
    return rawDialogue;
  }

  const subtitle = String(scene?.subtitle || "").trim();
  const extraContext = subtitle
    ? `${subtitle}. Aku nak korang tengok betul-betul, sebab bahagian ni yang buat cerita ni makin pelik dan susah nak lupa.`
    : `Aku nak korang tengok betul-betul, sebab cerita ${script.title} ni makin lama makin pelik dan susah nak lupa.`;

  return [rawDialogue, extraContext]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeStoryVideoPrompt(script: StoryScript, sceneNumber = 1) {
  const scene =
    script.scenes.find((item) => item.scene_number === sceneNumber) ||
    script.scenes[0];
  const dialogue =
    makeLongDialogue(script, scene) ||
    "Cerita ni memang buat aku tertanya-tanya, sebab makin banyak petunjuk muncul, makin susah nak faham apa sebenarnya berlaku.";

  return [
    "Create one 8-second vertical 9:16 cinematic story video using the image as the first frame.",
    script.character_profile
      ? `Keep the exact same main character: ${script.character_profile}.`
      : "Keep the exact same main character from the first frame.",
    `Story title: ${script.title}.`,
    `Scene ${scene?.scene_number || sceneNumber}: ${scene?.image_prompt || "cinematic Malaysian TikTok story scene"}.`,
    `The main adult character speaks this natural Malay narration with visible lip movement and mouth movement for most of the 8 seconds: "${dialogue}"`,
    "Do not make the dialogue too short. The character should speak naturally for around 6 to 8 seconds, with small pauses and clear mouth movement.",
    "Use subtle cinematic motion, gentle camera push-in, expressive face, natural hand movement, and dramatic story pacing.",
    "No subtitles, no on-screen text, no logo, no watermark."
  ].join(" ");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      script?: StoryScript;
      images?: Array<{ scene_number: number; imageUrl: string }>;
      referenceImageUrl?: string;
      sceneNumber?: number;
      voice?: { id?: string; label?: string };
    };

    if (!body.script) {
      return NextResponse.json(
        { error: "Skrip cerita perlu lengkap sebelum render." },
        { status: 400 }
      );
    }

    if (!body.referenceImageUrl && (!Array.isArray(body.images) || body.images.length < storySceneLimit)) {
      return NextResponse.json(
        { error: `Skrip dan ${storySceneLimit} gambar perlu lengkap sebelum render.` },
        { status: 400 }
      );
    }

    if (shouldMockStory()) {
      return NextResponse.json({
        jobId: `story-mock-${Date.now()}`,
        status: "completed",
        result: {
          videoUrl: "",
          caption: body.script.caption,
          hashtags: body.script.hashtags,
          mock: true
        }
      });
    }

    const sceneNumber = body.sceneNumber || 1;
    const firstImage =
      body.referenceImageUrl ||
      body.images?.find((image) => image.scene_number === sceneNumber)?.imageUrl ||
      body.images?.find((image) => image.scene_number === 1)?.imageUrl ||
      body.images?.[0]?.imageUrl;

    if (!firstImage) {
      return NextResponse.json(
        { error: "Image scene tidak dijumpai untuk animate." },
        { status: 400 }
      );
    }

    const operationName = await startVeoOperation(
      firstImage,
      makeStoryVideoPrompt(body.script, sceneNumber)
    );
    const output = await pollVeoOperation(operationName);
    const videoUrl = await saveVideoOutput(output);

    return NextResponse.json({
      jobId: operationName,
      status: "completed",
      result: {
        videoUrl,
        caption: body.script.caption,
        hashtags: body.script.hashtags,
        sceneNumber,
        mock: false
      }
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Render cerita gagal.";

    if (isVeoFaceSafetyError(message)) {
      return NextResponse.json(
        {
          error:
            "Veo block image ini kerana wajah/person safety. Jana versi selamat Veo yang kurang close-up muka, kemudian animate semula.",
          safetyBlock: true,
          safetyReason: "person_face_generation"
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}
