import { NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/google-auth";
import { storeGeneratedVideo } from "@/lib/generated-videos";
import {
  downloadGcsObject,
  getConfiguredBucketName,
  uploadGcsObject
} from "@/lib/gcs";
import {
  makeUltraSafeVeoPrompt,
  makeVeoPromptSafetySafe
} from "@/lib/video-prompt-safety";

export const runtime = "nodejs";
export const maxDuration = 300;

type VideoJobPayload = {
  action?: "start-base" | "poll-base" | "start-extend" | "poll-extend";
  referenceSceneUrl?: string;
  prompt?: string;
  operationName?: string;
  baseVideoGcsUri?: string;
};

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

function dataUrlToImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/);

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

  const arrayBuffer = await response.arrayBuffer();

  return {
    bytesBase64Encoded: Buffer.from(arrayBuffer).toString("base64"),
    mimeType
  };
}

async function startBaseOperation(referenceSceneUrl: string, prompt: string) {
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
          prompt: makeVeoPromptSafetySafe(prompt),
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
          prompt: makeVeoPromptSafetySafe(prompt),
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

  return operationName as string;
}

async function fetchOperation(operationName: string) {
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
    return { done: false };
  }

  if (data.error) {
    const errorText = JSON.stringify(data.error);

    if (errorText.toLowerCase().includes("safety")) {
      throw new Error(
        `Veo gagal: ${JSON.stringify({
          code: data.error.code,
          message: "Prompt video kena block safety. Cuba guna scene dewasa dan elak muka kanak-kanak."
        })}`
      );
    }

    throw new Error(`Veo gagal: ${errorText.slice(0, 900)}`);
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

  return { done: true, output: output as string };
}

function getVideoObjectName(kind: "base" | "extended") {
  const id =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `videos/${id}/${kind}.mp4`;
}

async function saveVideoBuffer(buffer: Buffer, kind: "base" | "extended") {
  let gcsUri: string | undefined;

  if (getConfiguredBucketName()) {
    gcsUri = await uploadGcsObject({
      objectName: getVideoObjectName(kind),
      contentType: "video/mp4",
      body: buffer
    });
  }

  if (gcsUri) {
    return {
      videoUrl: `/api/gcs-video?uri=${encodeURIComponent(gcsUri)}`,
      gcsUri,
      videoSize: buffer.length
    };
  }

  if (process.env.VERCEL) {
    return {
      videoUrl: `data:video/mp4;base64,${buffer.toString("base64")}`,
      gcsUri,
      videoSize: buffer.length
    };
  }

  const stored = await storeGeneratedVideo(buffer);

  return {
    videoUrl: `/api/generated-videos/${stored.id}`,
    gcsUri,
    videoSize: buffer.length
  };
}

async function saveVideoOutput(output: string, kind: "base" | "extended") {
  if (output.startsWith("gs://")) {
    const buffer = await downloadGcsObject(output);

    return {
      videoUrl: `/api/gcs-video?uri=${encodeURIComponent(output)}`,
      gcsUri: output,
      videoSize: buffer.length
    };
  }

  if (output.startsWith("http://") || output.startsWith("https://")) {
    const response = await fetch(output);

    if (!response.ok) {
      throw new Error(`Download video Veo gagal. Status ${response.status}.`);
    }

    return saveVideoBuffer(Buffer.from(await response.arrayBuffer()), kind);
  }

  return saveVideoBuffer(Buffer.from(output, "base64"), kind);
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (message.includes("401") || message.includes("UNAUTHENTICATED")) {
    return "Token video sudah tamat atau tidak valid. Update token dan cuba lagi.";
  }

  if (
    message.includes('"code":8') ||
    lower.includes("high load") ||
    lower.includes("resource exhausted")
  ) {
    return "Server cloud untuk video sedang busy. Sistem akan cuba lagi bila dibuka semula.";
  }

  if (
    lower.includes("sensitive") ||
    lower.includes("responsible ai") ||
    lower.includes("safety") ||
    message.includes('"code":3')
  ) {
    return "Prompt video kena block safety. Cuba guna scene dewasa dan elak muka kanak-kanak.";
  }

  return message || "Video gagal dijana. Cuba lagi.";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as VideoJobPayload;

    if (payload.action === "start-base") {
      const referenceSceneUrl = payload.referenceSceneUrl?.trim() || "";
      const prompt = payload.prompt?.trim() || "";

      if (!referenceSceneUrl || prompt.length < 20) {
        return NextResponse.json(
          { error: "Reference image dan prompt video diperlukan." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        operationName: await startBaseOperation(referenceSceneUrl, prompt)
      });
    }

    if (payload.action === "start-extend") {
      const baseVideoGcsUri = payload.baseVideoGcsUri?.trim() || "";
      const prompt = payload.prompt?.trim() || "";

      if (!baseVideoGcsUri.startsWith("gs://") || prompt.length < 20) {
        return NextResponse.json(
          { error: "Base video GCS URI dan prompt sambung diperlukan." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        operationName: await startExtendOperation(baseVideoGcsUri, prompt)
      });
    }

    if (payload.action === "poll-base" || payload.action === "poll-extend") {
      const operationName = payload.operationName?.trim() || "";

      if (!operationName) {
        return NextResponse.json(
          { error: "Operation name diperlukan." },
          { status: 400 }
        );
      }

      const operation = await fetchOperation(operationName);

      if (!operation.done) {
        return NextResponse.json({ done: false });
      }

      if (!operation.output) {
        throw new Error("Veo siap tetapi output video kosong.");
      }

      return NextResponse.json({
        done: true,
        ...(await saveVideoOutput(
          operation.output,
          payload.action === "poll-base" ? "base" : "extended"
        ))
      });
    }

    return NextResponse.json({ error: "Action video job tidak valid." }, { status: 400 });
  } catch (error) {
    console.error(
      "[video-job]",
      error instanceof Error ? error.message : String(error)
    );

    return NextResponse.json(
      { error: friendlyError(error) },
      { status: 500 }
    );
  }
}
