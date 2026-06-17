import { NextRequest, NextResponse } from "next/server";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import { getGoogleAccessToken } from "@/lib/google-auth";

export const runtime = "nodejs";

function makeWavDataUrl(pcmBytes: Buffer, sampleRate = 24000) {
  const dataSize = pcmBytes.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBytes.copy(buffer, 44);

  return `data:audio/wav;base64,${buffer.toString("base64")}`;
}

function makeSilentWavDataUrl() {
  const sampleRate = 8000;
  const seconds = 0.35;
  const sampleCount = Math.floor(sampleRate * seconds);

  return makeWavDataUrl(Buffer.alloc(sampleCount * 2), sampleRate);
}

function shouldMockStory() {
  return process.env.STORY_MOCK?.trim().toLowerCase() === "true";
}

function getTtsUrl() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region =
    process.env.GEMINI_TTS_REGION ||
    process.env.GEMINI_PROMPT_REGION ||
    process.env.GOOGLE_CLOUD_REGION ||
    "us-central1";
  const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
}

async function readGoogleError(response: Response) {
  const text = await response.text();
  const compact = text.replace(/\s+/g, " ").trim();

  return compact ? ` ${compact.slice(0, 900)}` : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      voiceName?: string;
      preview?: boolean;
    };
    const text = String(body.text || "").trim();

    if (!text) {
      return NextResponse.json(
        { error: "Teks suara belum tersedia." },
        { status: 400 }
      );
    }

    if (shouldMockStory()) {
      return NextResponse.json({
        audioUrl: makeSilentWavDataUrl(),
        voiceName: body.voiceName || "Aoede",
        mock: true
      });
    }

    const response = await fetch(getTtsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getGoogleAccessToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text }]
          }
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: body.voiceName || "Aoede"
              }
            }
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(
        `Gemini TTS gagal. Status ${response.status}.${await readGoogleError(response)}`
      );
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find(
      (part: { inlineData?: { data?: string; mimeType?: string } }) =>
        part.inlineData?.data && part.inlineData?.mimeType?.startsWith("audio/")
    );

    if (!audioPart?.inlineData?.data) {
      throw new Error("Gemini TTS tidak pulangkan audio.");
    }

    const mimeType = String(audioPart.inlineData.mimeType || "");
    const bytes = Buffer.from(audioPart.inlineData.data, "base64");
    const audioUrl =
      mimeType.includes("wav") || mimeType.includes("mpeg")
        ? `data:${mimeType};base64,${bytes.toString("base64")}`
        : makeWavDataUrl(bytes, 24000);

    return NextResponse.json({
      audioUrl,
      voiceName: body.voiceName || "Aoede",
      mock: false
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getFriendlyErrorMessage(error, "Suara cerita gagal dijana. Cuba sekali lagi.")
      },
      { status: 500 }
    );
  }
}
