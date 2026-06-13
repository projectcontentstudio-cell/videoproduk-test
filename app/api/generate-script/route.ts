import { NextResponse } from "next/server";
import { generateScriptWithGemini } from "@/lib/gemini";
import type { GenerateScriptInput } from "@/lib/gemini";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";

export const runtime = "nodejs";

function parseBody(body: Partial<GenerateScriptInput>): GenerateScriptInput {
  if (!body.productName?.trim()) {
    throw new Error("Nama produk wajib diisi.");
  }

  if (!body.productImageBase64) {
    throw new Error("Gambar produk diperlukan.");
  }

  if (body.productImageBase64.length < 1000) {
    throw new Error("Gambar produk tidak valid. Upload semula gambar produk.");
  }

  if (
    body.productImageMimeType !== "image/jpeg" &&
    body.productImageMimeType !== "image/png"
  ) {
    throw new Error("Gambar mesti dalam format JPG atau PNG.");
  }

  return {
    productName: body.productName.trim(),
    productPrice: body.productPrice?.trim() || "RM0",
    style:
      body.style === "realistic-ugc" ? "realistic-ugc" : "3d-character",
    characterGender:
      body.characterGender === "male" || body.characterGender === "female"
        ? body.characterGender
        : "auto",
    productImageBase64: body.productImageBase64,
    productImageMimeType: body.productImageMimeType,
    productAnalysis:
      typeof body.productAnalysis === "string"
        ? body.productAnalysis.trim().slice(0, 2500)
        : ""
  };
}

export async function POST(request: Request) {
  try {
    const input = parseBody(await request.json());
    const script = await generateScriptWithGemini(input);

    return NextResponse.json({
      script,
      creditBurned: false,
      message: "Skrip berjaya dijana. Kredit belum digunakan."
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error";

    console.error("[generate-script]", message.slice(0, 1000));

    return NextResponse.json(
      {
        error: getFriendlyErrorMessage(
          error,
          "Skrip gagal dijana. Cuba sekali lagi."
        )
      },
      { status: 400 }
    );
  }
}
