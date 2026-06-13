import { NextResponse } from "next/server";
import { analyzeProductWithGemini } from "@/lib/product-analysis";
import type { AnalyzeProductInput } from "@/lib/product-analysis";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";

export const runtime = "nodejs";

function parseBody(body: {
  productImageBase64?: string;
  productImageMimeType?: string;
}): AnalyzeProductInput {
  if (!body.productImageBase64 || body.productImageBase64.length < 1000) {
    throw new Error("Gambar produk tidak valid. Upload semula gambar produk.");
  }

  if (
    body.productImageMimeType !== "image/jpeg" &&
    body.productImageMimeType !== "image/png"
  ) {
    throw new Error("Gambar mesti dalam format JPG atau PNG.");
  }

  return {
    productImageBase64: body.productImageBase64,
    productImageMimeType: body.productImageMimeType
  };
}

export async function POST(request: Request) {
  try {
    const input = parseBody(await request.json());
    const analysis = await analyzeProductWithGemini(input);

    return NextResponse.json({ analysis });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error";

    console.error("[analyze-product]", message.slice(0, 1000));

    return NextResponse.json(
      {
        error: getFriendlyErrorMessage(
          error,
          "Semakan produk tidak lengkap. Upload masih boleh diteruskan."
        )
      },
      { status: 400 }
    );
  }
}
