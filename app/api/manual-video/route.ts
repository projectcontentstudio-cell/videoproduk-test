import { NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/google-auth";
import { storeGeneratedVideo } from "@/lib/generated-videos";

export const runtime = "nodejs";
export const maxDuration = 300;

type ManualVideoPayload = {
  referenceSceneUrl?: string;
  prompt?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVeoModelUrl(action: "predictLongRunning" | "fetchPredictOperation") {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region = process.env.VEO_REGION ?? "us-central1";
  const model = process.env.VEO_MODEL ?? "veo-3.1-generate-001";

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
    return "Server cloud untuk video sedang busy. Cuba lagi sebentar lagi.";
  }

  if (message.includes("401") || message.includes("UNAUTHENTICATED")) {
    return "Token video sudah tamat atau tidak valid. Update token dan cuba lagi.";
  }

  if (
    message.toLowerCase().includes("sensitive") ||
    message.toLowerCase().includes("responsible ai") ||
    message.toLowerCase().includes("safety")
  ) {
    return "Prompt video kena block safety. Cuba guna scene dewasa dan elak muka kanak-kanak.";
  }

  return "Video gagal dijana. Cuba lagi.";
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

  return operationName;
}

async function pollVeoOperation(operationName: string) {
  const maxPolls = Number(process.env.VEO_MAX_POLLS ?? 60);

  for (let poll = 1; poll <= maxPolls; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10000));

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
  if (output.startsWith("http://") || output.startsWith("https://")) {
    const response = await fetch(output);

    if (!response.ok) {
      throw new Error(`Download video Veo gagal. Status ${response.status}.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (process.env.VERCEL) {
      return `data:video/mp4;base64,${buffer.toString("base64")}`;
    }

    const stored = await storeGeneratedVideo(buffer);
    return `/api/generated-videos/${stored.id}`;
  }

  if (output.startsWith("gs://")) {
    throw new Error(
      `Veo pulangkan GCS URI (${output}). Manual lab belum ada storage download untuk gs://.`
    );
  }

  if (process.env.VERCEL) {
    return `data:video/mp4;base64,${output}`;
  }

  const stored = await storeGeneratedVideo(Buffer.from(output, "base64"));

  return `/api/generated-videos/${stored.id}`;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ManualVideoPayload;
    const prompt = payload.prompt?.trim();
    const referenceSceneUrl = payload.referenceSceneUrl?.trim();

    if (!referenceSceneUrl) {
      return NextResponse.json(
        { error: "Reference image diperlukan untuk manual video." },
        { status: 400 }
      );
    }

    if (!prompt || prompt.length < 20) {
      return NextResponse.json(
        { error: "Prompt video terlalu pendek." },
        { status: 400 }
      );
    }

    let operationName = "";
    let output = "";
    let attempt = 0;

    while (attempt < 6) {
      attempt += 1;

      try {
        operationName = await startVeoOperation(referenceSceneUrl, prompt);
        output = await pollVeoOperation(operationName);
        break;
      } catch (error) {
        if (attempt >= 6 || !isHighLoadError(error)) {
          throw error;
        }

        await sleep(30000);
      }
    }

    const videoUrl = await saveVideoOutput(output);

    return NextResponse.json({
      videoUrl,
      operationName,
      attempts: attempt
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: toFriendlyVideoError(error)
      },
      { status: 500 }
    );
  }
}
