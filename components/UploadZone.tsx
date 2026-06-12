"use client";

import { useCallback, useRef, useState } from "react";
import { QualityGate, type QualityCheck } from "./QualityGate";
import type { ProductAnalysis } from "@/lib/product-analysis";

type AnalysisResult = {
  checks: QualityCheck[];
  previewUrl: string;
  dataUrl: string;
  passed: boolean;
  productAnalysis?: ProductAnalysis;
  productAnalysisError?: string;
};

const blurThreshold = 90;
const maxCanvasSide = 420;

function clearGeneratedFlow() {
  localStorage.removeItem("videoproduk_scene_images");
  localStorage.removeItem("videoproduk_selected_scene");
  localStorage.removeItem("videoproduk_render_result");
  localStorage.removeItem("videoproduk_script_cache_key");
  localStorage.removeItem("videoproduk_shop_watermark_enabled");
  localStorage.removeItem("videoproduk_shop_watermark_name");
  localStorage.removeItem("videoproduk_product_analysis");
}

function getImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak boleh dibaca. Cuba fail lain."));
    };
    image.src = url;
  });
}

function getOptimizedDataUrlFromImage(image: HTMLImageElement) {
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, 1280 / longestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Browser tidak sokong proses gambar.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.88);
}

function getCanvasImageData(image: HTMLImageElement) {
  const scale = Math.min(1, maxCanvasSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Browser tidak sokong semakan gambar.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return {
    width,
    height,
    data: context.getImageData(0, 0, width, height).data
  };
}

function estimateBlurVariance(data: Uint8ClampedArray, width: number, height: number) {
  const values: number[] = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      const top = ((y - 1) * width + x) * 4;
      const bottom = ((y + 1) * width + x) * 4;
      const left = (y * width + x - 1) * 4;
      const right = (y * width + x + 1) * 4;
      const gray =
        data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      const laplacian =
        -4 * gray +
        (data[top] * 0.299 + data[top + 1] * 0.587 + data[top + 2] * 0.114) +
        (data[bottom] * 0.299 +
          data[bottom + 1] * 0.587 +
          data[bottom + 2] * 0.114) +
        (data[left] * 0.299 +
          data[left + 1] * 0.587 +
          data[left + 2] * 0.114) +
        (data[right] * 0.299 +
          data[right + 1] * 0.587 +
          data[right + 2] * 0.114);

      values.push(laplacian);
    }
  }

  const mean = values.reduce((total, value) => total + value, 0) / values.length;

  return (
    values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) /
    values.length
  );
}

function buildForegroundMask(data: Uint8ClampedArray, width: number, height: number) {
  const samplePoints = [
    0,
    width - 1,
    (height - 1) * width,
    height * width - 1
  ];
  const background = samplePoints.reduce(
    (sum, point) => {
      const index = point * 4;

      return {
        r: sum.r + data[index],
        g: sum.g + data[index + 1],
        b: sum.b + data[index + 2]
      };
    },
    { r: 0, g: 0, b: 0 }
  );
  const bg = {
    r: background.r / samplePoints.length,
    g: background.g / samplePoints.length,
    b: background.b / samplePoints.length
  };

  return Array.from({ length: width * height }, (_, pixel) => {
    const index = pixel * 4;
    const distance = Math.sqrt(
      Math.pow(data[index] - bg.r, 2) +
        Math.pow(data[index + 1] - bg.g, 2) +
        Math.pow(data[index + 2] - bg.b, 2)
    );

    return distance > 42;
  });
}

function analyzeForeground(mask: boolean[], width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const components: number[] = [];
  let foregroundPixels = 0;

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index]) {
      foregroundPixels += 1;
    }

    if (!mask[index] || visited[index]) {
      continue;
    }

    const stack = [index];
    let count = 0;
    visited[index] = 1;

    while (stack.length > 0) {
      const current = stack.pop() as number;
      const x = current % width;
      const y = Math.floor(current / width);
      count += 1;

      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < width - 1 ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y < height - 1 ? current + width : -1
      ];

      for (const neighbor of neighbors) {
        if (neighbor >= 0 && mask[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }

    if (count > width * height * 0.012) {
      components.push(count);
    }
  }

  const coverage = foregroundPixels / mask.length;
  const majorComponents = components.filter((count) => count > mask.length * 0.04);

  return {
    coverage,
    majorComponents: majorComponents.length || (components.length > 0 ? 1 : 0)
  };
}

async function analyzeFile(file: File): Promise<AnalysisResult> {
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    throw new Error("Upload gambar JPG atau PNG sahaja.");
  }

  const image = await getImageFromFile(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const { width, height, data } = getCanvasImageData(image);
  const blurVariance = estimateBlurVariance(data, width, height);
  const foreground = analyzeForeground(buildForegroundMask(data, width, height), width, height);
  const previewUrl = image.src;
  const dataUrl = getOptimizedDataUrlFromImage(image);
  const checks: QualityCheck[] = [
    {
      label: "Resolusi gambar",
      passed: longestSide >= 800,
      detail:
        longestSide >= 800
          ? `Lulus. Sisi paling panjang ${longestSide}px.`
          : `Amaran. Sisi paling panjang ${longestSide}px. AI masih boleh cuba improve.`
    },
    {
      label: "Produk cukup besar",
      passed: foreground.coverage >= 0.35,
      detail:
        foreground.coverage >= 0.35
          ? `Lulus. Anggaran produk memenuhi ${Math.round(
              foreground.coverage * 100
            )}% frame.`
          : `Amaran. Produk agak kecil, lebih kurang ${Math.round(
              foreground.coverage * 100
            )}% frame. AI akan cuba besarkan fokus produk.`
    },
    {
      label: "Gambar tidak blur",
      passed: blurVariance >= blurThreshold,
      detail:
        blurVariance >= blurThreshold
          ? `Lulus. Skor sharpness ${Math.round(blurVariance)}.`
          : "Amaran. Gambar nampak blur. AI akan cuba guna sebagai rujukan produk."
    },
    {
      label: "Satu produk utama",
      passed: foreground.majorComponents <= 1,
      detail:
        foreground.majorComponents <= 1
          ? "Lulus. Hanya satu produk utama dikesan."
          : "Amaran. Nampak lebih daripada satu objek. AI akan cuba pilih produk utama."
    }
  ];

  return {
    checks,
    previewUrl,
    dataUrl,
    passed: true
  };
}

function getStoredImagePayload(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  const mimeType = header?.includes("image/jpeg") ? "image/jpeg" : "image/png";

  if (!header?.startsWith("data:image/") || !data || data.length < 1000) {
    throw new Error("Gambar produk tidak lengkap. Sila upload semula.");
  }

  return {
    productImageBase64: data,
    productImageMimeType: mimeType
  };
}

async function analyzeProduct(dataUrl: string) {
  const response = await fetch("/api/analyze-product", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(getStoredImagePayload(dataUrl))
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Semakan produk tidak lengkap.");
  }

  return data.analysis as ProductAnalysis;
}

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleFile = useCallback(async (file?: File) => {
    if (!file) {
      return;
    }

    setError("");
    setResult(null);
    setIsChecking(true);

    try {
      const analysis = await analyzeFile(file);
      setResult(analysis);

      clearGeneratedFlow();
      localStorage.removeItem("videoproduk_script");
      localStorage.setItem("videoproduk_product_image", analysis.dataUrl);

      try {
        const productAnalysis = await analyzeProduct(analysis.dataUrl);
        localStorage.setItem(
          "videoproduk_product_analysis",
          JSON.stringify(productAnalysis)
        );
        setResult({ ...analysis, productAnalysis });
      } catch (productError) {
        localStorage.removeItem("videoproduk_product_analysis");
        setResult({
          ...analysis,
          productAnalysisError:
            productError instanceof Error
              ? productError.message
              : "Semakan produk tidak lengkap."
        });
      }
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Gambar gagal disemak. Cuba upload semula."
      );
    } finally {
      setIsChecking(false);
    }
  }, []);

  const warningChecks = result?.checks.filter((check) => !check.passed) ?? [];

  return (
    <div className="relative space-y-5">
      {isChecking ? (
        <div className="fixed inset-0 z-50 bg-black/70 text-center backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/40 bg-slate-950 px-4 py-3 shadow-glow">
            <p className="text-sm font-black text-white">Sila tunggu</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Sedang semak gambar dan produk.
            </p>
          </div>
        </div>
      ) : null}
      <div className="grid gap-5">
        <div className="space-y-4">
          <button
            type="button"
            disabled={isChecking}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              if (isChecking) {
                return;
              }
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              if (isChecking) {
                return;
              }
              setIsDragging(false);
              void handleFile(event.dataTransfer.files[0]);
            }}
            className={`flex min-h-[18rem] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed p-6 text-center transition ${
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border bg-surface hover:border-primary/70"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {result?.previewUrl ? (
              <div className="w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.previewUrl}
                  alt="Gambar produk yang diupload"
                  className="mx-auto max-h-[32rem] w-full rounded-xl object-contain"
                />
                <span className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-xs font-bold text-slate-200">
                  Tukar gambar
                </span>
              </div>
            ) : (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-black text-slate-950">
                  +
                </span>
                <span className="mt-5 text-lg font-black text-white">
                  Upload gambar produk
                </span>
                <span className="mt-2 max-w-sm text-sm leading-6 text-slate-300">
                  Drag & drop atau tekan sini. Sistem akan semak gambar dan cuba
                  improve untuk skrip serta preview.
                </span>
                <span className="mt-5 rounded-full border border-border px-4 py-2 text-xs font-bold text-slate-200">
                  Pilih gambar
                </span>
              </>
            )}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/png,image/jpeg"
            capture="environment"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={isChecking}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Upload Product
            </button>
            <button
              type="button"
              disabled={isChecking}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ambil Gambar
            </button>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-semibold text-red-100">
              {error}
            </div>
          ) : null}

          {warningChecks.length > 0 ? (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
              <p className="text-sm font-bold text-amber-100">
                Gambar diterima. Ini cuma cadangan improvement.
              </p>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-100/85">
                {warningChecks.map((check) => (
                  <li key={check.label}>{check.detail}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result?.productAnalysis ? (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
              <p className="text-sm font-black text-white">
                Fakta produk dikesan
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {result.productAnalysis.summary ||
                  `${result.productAnalysis.productType} dikesan daripada gambar.`}
              </p>
              <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-300">
                <p>
                  <span className="font-bold text-white">Jenis:</span>{" "}
                  {result.productAnalysis.productType}
                </p>
                {result.productAnalysis.colors.length ? (
                  <p>
                    <span className="font-bold text-white">Warna:</span>{" "}
                    {result.productAnalysis.colors.join(", ")}
                  </p>
                ) : null}
                {result.productAnalysis.keyFeatures.length ? (
                  <p>
                    <span className="font-bold text-white">Ciri:</span>{" "}
                    {result.productAnalysis.keyFeatures.slice(0, 4).join(", ")}
                  </p>
                ) : null}
                {result.productAnalysis.usageFacts.length ? (
                  <p>
                    <span className="font-bold text-white">Fakta guna:</span>{" "}
                    {result.productAnalysis.usageFacts.slice(0, 4).join(", ")}
                  </p>
                ) : null}
                {result.productAnalysis.avoidMistakes.length ? (
                  <p>
                    <span className="font-bold text-white">Elak salah:</span>{" "}
                    {result.productAnalysis.avoidMistakes.slice(0, 4).join(", ")}
                  </p>
                ) : null}
              </div>
              <p className="mt-3 text-xs font-semibold text-primary">
                {result.productAnalysis.searchMatched
                  ? "Detail dipadankan dengan carian."
                  : "Berdasarkan gambar sahaja."}
              </p>
            </div>
          ) : null}

          {result?.productAnalysisError ? (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
              Semakan detail produk tidak lengkap, tapi gambar diterima. Sistem
              masih akan guna gambar upload sebagai rujukan utama.
            </div>
          ) : null}

          {result?.passed ? (
            <div className="rounded-2xl border border-primary/50 bg-primary/10 p-4">
              <p className="text-sm font-bold text-white">
                Gambar diterima. Terus isi detail produk untuk jana skrip dan
                preview.
              </p>
              <a
                href="/details"
                className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950"
              >
                Teruskan
              </a>
            </div>
          ) : null}
        </div>

        <QualityGate checks={result?.checks ?? []} isChecking={isChecking} />
      </div>
    </div>
  );
}
