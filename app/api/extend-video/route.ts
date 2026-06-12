import { NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/google-auth";
import { storeGeneratedVideo } from "@/lib/generated-videos";
import {
  downloadGcsObject,
  getConfiguredBucketName,
  uploadGcsObject
} from "@/lib/gcs";

export const runtime = "nodejs";
export const maxDuration = 300;

type ExtendVideoPayload = {
  baseVideoGcsUri?: string;
  prompt?: string;
};

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

function isHighLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('"code":8') ||
    message.toLowerCase().includes("high load") ||
    message.toLowerCase().includes("resource exhausted")
  );
}

function toFriendlyVideoError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (isHighLoadError(error)) {
    return "Server cloud untuk sambung video sedang busy. Cuba lagi sebentar lagi.";
  }

  if (message.includes("401") || message.includes("UNAUTHENTICATED")) {
    return "Token video sudah tamat atau tidak valid. Update token dan cuba lagi.";
  }

  if (
    message.toLowerCase().includes("sensitive") ||
    message.toLowerCase().includes("responsible ai") ||
    message.toLowerCase().includes("safety")
  ) {
    return "Sambung video kena block safety. Cuba reference dewasa tanpa muka kanak-kanak.";
  }

  return "Sambung video gagal dijana. Cuba lagi.";
}

async function startExtendOperation(baseVideoGcsUri: string, prompt: string) {
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
          video: {
            gcsUri: baseVideoGcsUri,
            mimeType: "video/mp4"
          }
        }
      ],
      parameters: {
        aspectRatio: "9:16",
        sampleCount: 1
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Veo sambung gagal mula. Status ${response.status}.${await readGoogleError(
        response
      )}`
    );
  }

  const data = await response.json();
  const operationName = data?.name || data?.operationName;

  if (!operationName) {
    throw new Error("Veo sambung tidak pulangkan operation name.");
  }

  return operationName;
}

async function pollVeoOperation(operationName: string) {
  const maxPolls = Number(process.env.VEO_MAX_POLLS ?? 60);

  for (let poll = 1; poll <= maxPolls; poll += 1) {
    await sleep(10000);

    const response = await fetch(getVeoModelUrl("fetchPredictOperation"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getGoogleAccessToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        operationName
      })
    });

    if (!response.ok) {
      throw new Error(
        `Veo sambung status gagal. Status ${
          response.status
        }.${await readGoogleError(response)}`
      );
    }

    const data = await response.json();

    if (!data.done) {
      continue;
    }

    if (data.error) {
      throw new Error(
        `Veo sambung gagal: ${JSON.stringify(data.error).slice(0, 900)}`
      );
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
        `Veo sambung siap tetapi output tidak dikenali: ${JSON.stringify(
          data
        ).slice(0, 900)}`
      );
    }

    return output as string;
  }

  throw new Error("Veo sambung belum siap selepas had polling local.");
}

function getVideoObjectName() {
  const id =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `videos/${id}/extended.mp4`;
}

async function saveVideoBuffer(buffer: Buffer) {
  if (process.env.VERCEL) {
    return `data:video/mp4;base64,${buffer.toString("base64")}`;
  }

  const stored = await storeGeneratedVideo(buffer);
  return `/api/generated-videos/${stored.id}`;
}

async function saveExtendedOutput(output: string) {
  if (output.startsWith("gs://")) {
    const buffer = await downloadGcsObject(output);

    return {
      videoUrl: await saveVideoBuffer(buffer),
      gcsUri: output
    };
  }

  const buffer = Buffer.from(output, "base64");
  let gcsUri: string | undefined;

  if (getConfiguredBucketName()) {
    gcsUri = await uploadGcsObject({
      objectName: getVideoObjectName(),
      contentType: "video/mp4",
      body: buffer
    });
  }

  return {
    videoUrl: await saveVideoBuffer(buffer),
    gcsUri
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ExtendVideoPayload;
    const baseVideoGcsUri =
      typeof payload.baseVideoGcsUri === "string"
        ? payload.baseVideoGcsUri.trim()
        : "";
    const prompt =
      typeof payload.prompt === "string" ? payload.prompt.trim() : "";

    if (!baseVideoGcsUri.startsWith("gs://")) {
      return NextResponse.json(
        { error: "Base video GCS URI diperlukan untuk sambung video." },
        { status: 400 }
      );
    }

    if (!prompt || prompt.length < 20) {
      return NextResponse.json(
        { error: "Prompt sambung video terlalu pendek." },
        { status: 400 }
      );
    }

    let operationName = "";
    let output = "";
    let attempt = 0;

    while (attempt < 6) {
      attempt += 1;

      try {
        operationName = await startExtendOperation(baseVideoGcsUri, prompt);
        output = await pollVeoOperation(operationName);
        break;
      } catch (error) {
        if (attempt >= 6 || !isHighLoadError(error)) {
          throw error;
        }

        await sleep(30000);
      }
    }

    const savedVideo = await saveExtendedOutput(output);

    return NextResponse.json({
      videoUrl: savedVideo.videoUrl,
      extendedVideoGcsUri: savedVideo.gcsUri,
      operationName,
      attempts: attempt
    });
  } catch (error) {
    console.error(
      "[extend-video]",
      error instanceof Error ? error.message : String(error)
    );

    return NextResponse.json(
      {
        error: toFriendlyVideoError(error)
      },
      { status: 500 }
    );
  }
}
