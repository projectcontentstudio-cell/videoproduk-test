import { NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/google-auth";

export const runtime = "nodejs";

type GeminiChatBody = {
  message?: string;
  productName?: string;
  productPrice?: string;
  productImageBase64?: string;
  productImageMimeType?: "image/jpeg" | "image/png";
};

function getProjectId() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return projectId;
}

function getGeminiUrl(model: string) {
  const region = process.env.GOOGLE_CLOUD_REGION ?? "asia-southeast1";

  return `https://${region}-aiplatform.googleapis.com/v1/projects/${getProjectId()}/locations/${region}/publishers/google/models/${model}:generateContent`;
}

async function readGoogleError(response: Response) {
  const text = await response.text();
  const compact = text.replace(/\s+/g, " ").trim();

  return compact ? ` ${compact.slice(0, 700)}` : "";
}

function extractText(data: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n")
      .trim() ?? ""
  );
}

async function askGemini(body: GeminiChatBody, model: string) {
  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: "image/jpeg" | "image/png"; data: string } }
  > = [
    {
      text: `Seller wants to chat about product image prompt/testing.

Product name: ${body.productName || "Manual Test Product"}
Product price: ${body.productPrice || "RM39"}

User message:
${body.message}

If an image is attached, inspect it as product/reference image. Answer in clear Malay/English mix like a practical creative director. If the user asks for a prompt, give a direct usable prompt. If the scene is a problem/before image, explain whether the product should appear or not.`
    }
  ];

  if (body.productImageBase64 && body.productImageMimeType) {
    parts.push({
      inlineData: {
        mimeType: body.productImageMimeType,
        data: body.productImageBase64
      }
    });
  }

  const response = await fetch(getGeminiUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts
        }
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 1400
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Gemini chat gagal (${model}). Status ${
        response.status
      }.${await readGoogleError(response)}`
    );
  }

  const reply = extractText(await response.json());

  if (!reply) {
    throw new Error("Gemini tidak pulangkan reply.");
  }

  return reply;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeminiChatBody;
    const message = body.message?.trim();

    if (!message || message.length < 2) {
      throw new Error("Message wajib diisi.");
    }

    const primaryModel = process.env.GEMINI_PROMPT_MODEL ?? "gemini-2.5-pro";
    const fallbackModel =
      process.env.GEMINI_PROMPT_FALLBACK_MODEL ?? process.env.GEMINI_MODEL;

    try {
      return NextResponse.json({
        reply: await askGemini(body, primaryModel),
        model: primaryModel
      });
    } catch (firstError) {
      if (fallbackModel && fallbackModel !== primaryModel) {
        return NextResponse.json({
          reply: await askGemini(body, fallbackModel),
          model: fallbackModel
        });
      }

      throw firstError;
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gemini chat gagal. Cuba lagi."
      },
      { status: 400 }
    );
  }
}
