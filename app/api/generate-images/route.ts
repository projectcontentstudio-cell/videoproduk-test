import { NextResponse } from "next/server";
import {
  generateImagesWithImagen,
  generateManualImageWithImagen,
  generateProblemImageWithImagen,
  generateReferencePromptImageWithImagen,
  generateRealisticSceneImageWithImagen,
  generateSolutionImageWithImagen
} from "@/lib/vertex-ai";
import type { GenerateImagesInput } from "@/lib/vertex-ai";
import { storeGeneratedImage } from "@/lib/generated-assets";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";

export const runtime = "nodejs";

function parseBody(body: Partial<GenerateImagesInput>): GenerateImagesInput {
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

  if (!body.script?.scene1_description || !body.script.scene2_description) {
    throw new Error("Deskripsi base dan sambungan video diperlukan.");
  }

  return {
    productName: body.productName.trim(),
    productPrice: body.productPrice?.trim() || "RM0",
    productImageBase64: body.productImageBase64,
    productImageMimeType: body.productImageMimeType,
    script: body.script,
    quality: body.quality === "final" ? "final" : "preview",
    style: body.style || "3d-character"
  };
}

async function storeImageUrl(dataUrl: string, request: Request) {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = parseBody(body);

    if (body.mode === "manual") {
      if (!body.prompt || typeof body.prompt !== "string") {
        throw new Error("Prompt manual wajib diisi.");
      }

      const image = await generateManualImageWithImagen(input, body.prompt);
      const imageUrl = await storeImageUrl(image.imageUrl, request);

      return NextResponse.json({
        images: {
          ...image,
          imageUrl
        },
        message: "Manual image berjaya dijana."
      });
    }

    if (body.mode === "realistic-scene") {
      if (!body.prompt || typeof body.prompt !== "string") {
        throw new Error("Prompt scene wajib diisi.");
      }

      const image = await generateRealisticSceneImageWithImagen(
        input,
        body.prompt
      );
      const imageUrl = await storeImageUrl(image.imageUrl, request);

      return NextResponse.json({
        images: {
          ...image,
          imageUrl
        },
        message: "Realistic scene image berjaya dijana."
      });
    }

    if (body.mode === "reference-prompt") {
      if (!body.prompt || typeof body.prompt !== "string") {
        throw new Error("Prompt image wajib diisi.");
      }

      const image = await generateReferencePromptImageWithImagen(
        input,
        body.prompt
      );
      const imageUrl = await storeImageUrl(image.imageUrl, request);

      return NextResponse.json({
        images: {
          ...image,
          imageUrl
        },
        message: "Reference prompt image berjaya dijana."
      });
    }

    if (body.mode === "problem") {
      const image = await generateProblemImageWithImagen(input);
      const problemImageUrl = await storeImageUrl(
        image.problemImageUrl,
        request
      );

      return NextResponse.json({
        images: {
          ...image,
          problemImageUrl
        },
        message: "Image berjaya dijana. Semak dulu sebelum jana video."
      });
    }

    if (body.mode === "solution") {
      if (!body.problemImageUrl || typeof body.problemImageUrl !== "string") {
        throw new Error("Problem image diperlukan sebelum jana Solution.");
      }

      const image = await generateSolutionImageWithImagen(
        input,
        body.problemImageUrl
      );
      const solutionImageUrl = await storeImageUrl(
        image.solutionImageUrl,
        request
      );

      return NextResponse.json({
        images: {
          ...image,
          solutionImageUrl
        },
        message: "Solution image berjaya dijana."
      });
    }

    const images = await generateImagesWithImagen(input);
    const problemImageUrl = await storeImageUrl(
      images.problemImageUrl,
      request
    );
    const solutionImageUrl = await storeImageUrl(
      images.solutionImageUrl,
      request
    );

    return NextResponse.json({
      images: {
        ...images,
        problemImageUrl,
        solutionImageUrl
      },
      message: "Preview image berjaya dijana. Kredit belum digunakan."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getFriendlyErrorMessage(
          error,
          "Preview image gagal dijana. Cuba sekali lagi."
        )
      },
      { status: 400 }
    );
  }
}
