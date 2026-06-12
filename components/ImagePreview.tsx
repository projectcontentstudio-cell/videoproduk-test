"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GeneratedScript } from "@/lib/gemini";
import { freePreviewPolicy } from "@/lib/preview-policy";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";

type ImageResult = {
  problemImageUrl: string;
  solutionImageUrl?: string;
  problemPromptUsed?: string;
  solutionPromptUsed?: string;
  problemVideoPrompt?: string;
  solutionVideoPrompt?: string;
  size: 512 | 1024;
  creditBurned: false;
};

type ImagePreviewState =
  | { status: "idle" | "loading-problem" | "loading-solution"; images: ImageResult | null; error: "" }
  | { status: "success"; images: ImageResult; error: "" }
  | { status: "error"; images: ImageResult | null; error: string };

function getStoredImagePayload() {
  const image = localStorage.getItem("videoproduk_product_image");

  if (!image || image.startsWith("blob:")) {
    throw new Error(
      "Gambar produk belum valid. Sila upload semula gambar produk dulu."
    );
  }

  const [header, data] = image.split(",");
  const mimeType = header?.includes("image/jpeg") ? "image/jpeg" : "image/png";

  if (!header?.startsWith("data:image/") || !data || data.length < 1000) {
    throw new Error(
      "Gambar produk tidak lengkap. Sila upload semula gambar produk."
    );
  }

  return {
    productImageBase64: data,
    productImageMimeType: mimeType
  };
}

function getStoredScript(): Pick<
  GeneratedScript,
  | "visual_method"
  | "visual_method_reason"
  | "scene1_description"
  | "scene1_video_script"
  | "scene2_description"
> {
  const stored = localStorage.getItem("videoproduk_script");

  if (!stored) {
    return {
      visual_method: "problem_solution",
      visual_method_reason: "Fallback bila skrip belum tersedia.",
      scene1_description: "Dapur sibuk dan bahan belum dipotong.",
      scene1_video_script: "Aduh, kerja ni memang makan masa betul.",
      scene2_description: "Produk digunakan sebagai solusi yang cepat."
    };
  }

  const script = JSON.parse(stored) as GeneratedScript;

  return {
    visual_method: script.visual_method,
    visual_method_reason: script.visual_method_reason,
    scene1_description: script.scene1_description,
    scene1_video_script: script.scene1_video_script,
    scene2_description: script.scene2_description
  };
}

function PreviewCard({
  title,
  label,
  imageUrl,
  children
}: {
  title: string;
  label: string;
  imageUrl: string;
  children?: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-primary bg-surface shadow-glow">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${title} preview`}
          className="aspect-[9/16] w-full object-cover"
        />
        <div className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-black text-slate-950">
          {label}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-[-18deg] border-y border-white/20 bg-black/50 py-3 text-center text-xl font-black uppercase tracking-[0.2em] text-white/80">
          Preview
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4">
          <p className="text-sm font-black text-white">{title}</p>
        </div>
      </div>
      {children ? <div className="border-t border-border p-3">{children}</div> : null}
    </article>
  );
}

function getPreviewTitle(script: GeneratedScript | null) {
  switch (script?.visual_method) {
    case "showcase":
      return "Showcase product";
    case "demo":
      return "Demo product";
    case "before_after":
      return "Before-after scene";
    case "lifestyle_use":
      return "Lifestyle product scene";
    default:
      return "Problem scene + product";
  }
}

export function ImagePreview() {
  const activeRequestId = useRef(0);
  const [state, setState] = useState<ImagePreviewState>({
    status: "idle",
    images: null,
    error: ""
  });
  const [timeoutCountdown, setTimeoutCountdown] = useState<number | null>(null);

  function getStoredImages() {
    const stored = localStorage.getItem("videoproduk_scene_images");

    if (!stored) {
      return null;
    }

    try {
      const images = JSON.parse(stored) as ImageResult;

      return images.problemImageUrl ? images : null;
    } catch {
      return null;
    }
  }

  function getRequestBody() {
    const productName =
      localStorage.getItem("videoproduk_product_name") || "Mini Chopper Pro";
    const productPrice =
      localStorage.getItem("videoproduk_product_price") || "RM0";

    return {
      productName,
      productPrice,
      ...getStoredImagePayload(),
      script: getStoredScript(),
      quality: "preview",
      style: localStorage.getItem("videoproduk_image_style") || "3d-character"
    };
  }

  async function generateProblemImage() {
    const requestId = activeRequestId.current + 1;
    activeRequestId.current = requestId;
    setTimeoutCountdown(null);
    setState({ status: "loading-problem", images: null, error: "" });

    try {
      const response = await fetch("/api/generate-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...getRequestBody(),
          mode: "problem"
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Preview image gagal dijana.");
      }

      if (activeRequestId.current !== requestId) {
        return;
      }

      localStorage.removeItem("videoproduk_scene_images");
      localStorage.removeItem("videoproduk_selected_scene");
      localStorage.setItem(
        "videoproduk_scene_images",
        JSON.stringify(data.images)
      );
      setState({ status: "success", images: data.images, error: "" });
    } catch (error) {
      if (activeRequestId.current !== requestId) {
        return;
      }

      setState({
        status: "error",
        images: null,
        error: getFriendlyErrorMessage(
          error,
          "Preview image gagal dijana. Cuba lagi."
        )
      });
    }
  }

  async function generateSolutionImage(problemImageUrl: string) {
    if (state.status === "loading-solution") {
      return;
    }

    const requestId = activeRequestId.current + 1;
    activeRequestId.current = requestId;
    setTimeoutCountdown(null);
    const lockedProblemImageUrl =
      state.images?.problemImageUrl || problemImageUrl;

    setState((current) => ({
      status: "loading-solution",
      images: current.images
        ? {
            ...current.images,
            problemImageUrl: current.images.problemImageUrl || lockedProblemImageUrl
          }
        : null,
      error: ""
    }));

    try {
      const response = await fetch("/api/generate-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...getRequestBody(),
          mode: "solution",
          problemImageUrl: lockedProblemImageUrl
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Solution image gagal dijana.");
      }

      if (activeRequestId.current !== requestId) {
        return;
      }

      setState((current) => {
        const previousImages = current.images || state.images;
        const images = {
          problemImageUrl:
            previousImages?.problemImageUrl || lockedProblemImageUrl,
          solutionImageUrl: data.images.solutionImageUrl,
          problemPromptUsed: previousImages?.problemPromptUsed,
          solutionPromptUsed: data.images.solutionPromptUsed,
          problemVideoPrompt: previousImages?.problemVideoPrompt,
          solutionVideoPrompt: data.images.solutionVideoPrompt,
          size: data.images.size,
          creditBurned: false as const
        };

        localStorage.setItem("videoproduk_scene_images", JSON.stringify(images));

        return { status: "success", images, error: "" };
      });
    } catch (error) {
      if (activeRequestId.current !== requestId) {
        return;
      }

      setState((current) => ({
        status: "error",
        images: current.images,
        error: getFriendlyErrorMessage(
          error,
          "Solution image gagal dijana. Cuba lagi."
        )
      }));
    }
  }

  function selectSceneForVideo(
    imageUrl: string,
    sceneKind: "problem" | "solution"
  ) {
    const stored = localStorage.getItem("videoproduk_script");
    const script = stored ? (JSON.parse(stored) as GeneratedScript) : null;
    const currentImages = state.images || getStoredImages();
    const useProductAction =
      script?.visual_method && script.visual_method !== "problem_solution";
    const effectiveSceneKind = useProductAction ? "solution" : sceneKind;

    localStorage.setItem(
      "videoproduk_selected_scene",
      JSON.stringify({
        imageUrl,
        sceneKind: effectiveSceneKind,
        sceneDescription:
          effectiveSceneKind === "problem"
            ? currentImages?.problemPromptUsed ||
              script?.scene1_description ||
              "Problem scene produk."
            : currentImages?.problemPromptUsed ||
              currentImages?.solutionPromptUsed ||
              script?.scene2_description ||
              "Solution scene produk.",
        manualVideoPrompt:
          effectiveSceneKind === "problem"
            ? currentImages?.problemVideoPrompt || script?.scene1_video_prompt
            : script?.scene2_video_prompt ||
              currentImages?.solutionVideoPrompt ||
              currentImages?.problemVideoPrompt,
        dialogueLine:
          effectiveSceneKind === "problem"
            ? script?.scene1_video_script ||
              script?.scene1_subtitle ||
              "Aduh, macam mana nak settle ni?"
            : script?.scene2_video_script ||
              script?.scene2_subtitle ||
              script?.cta ||
              "Ini solusi cepat."
      })
    );
    window.location.href = "/render";
  }

  useEffect(() => {
    const shouldRestore = localStorage.getItem("videoproduk_restore_preview");
    localStorage.removeItem("videoproduk_restore_preview");
    const storedImages = shouldRestore === "true" ? getStoredImages() : null;

    if (storedImages) {
      setState({ status: "success", images: storedImages, error: "" });
      return;
    }

    localStorage.removeItem("videoproduk_scene_images");
    localStorage.removeItem("videoproduk_selected_scene");
    void generateProblemImage();
  }, []);

  useEffect(() => {
    if (
      state.status !== "loading-problem" &&
      state.status !== "loading-solution"
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setTimeoutCountdown(10);
    }, 300_000);

    return () => window.clearTimeout(timeout);
  }, [state.status]);

  useEffect(() => {
    if (timeoutCountdown === null) {
      return;
    }

    if (timeoutCountdown <= 0) {
      activeRequestId.current += 1;
      window.location.href = "/";
      return;
    }

    const timer = window.setTimeout(() => {
      setTimeoutCountdown((current) =>
        current === null ? null : Math.max(0, current - 1)
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [timeoutCountdown]);

  if (
    (state.status === "loading-problem" || state.status === "idle") &&
    !state.images?.problemImageUrl
  ) {
    return (
      <>
        {timeoutCountdown !== null ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 px-4 py-6">
            <div className="w-full max-w-[19rem] rounded-2xl border border-amber-400/40 bg-slate-950 p-4 text-center shadow-glow">
              <p className="text-lg font-black text-white">
                Server cloud sedang busy
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Please try again 5 minute later. Sistem akan kembali ke main
                page dalam {timeoutCountdown} saat.
              </p>
              <a
                href="/"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-black text-slate-950"
              >
                Pergi Main Page
              </a>
            </div>
          </div>
        ) : null}
        {timeoutCountdown === null ? (
          <div className="fixed inset-0 z-50 bg-black/70 text-center backdrop-blur-sm">
            <div className="fixed left-1/2 top-1/2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/40 bg-slate-950 px-4 py-3 shadow-glow">
              <p className="text-sm font-black text-white">Sila tunggu</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Sedang jana image.
              </p>
            </div>
          </div>
        ) : null}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-bold text-white">Sila tunggu</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Sistem sedang jana image preview. Jangan tutup halaman ini.
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      </>
    );
  }

  if (state.status === "error") {
    if (state.images?.problemImageUrl) {
      const images = state.images;
      const storedScript = localStorage.getItem("videoproduk_script");
      const script = storedScript ? (JSON.parse(storedScript) as GeneratedScript) : null;

      return (
        <div className="space-y-5">
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
            <p className="text-sm font-black text-red-100">Gagal jana image.</p>
            <p className="mt-2 text-sm leading-6 text-red-100/90">{state.error}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Image yang sudah berjaya masih disimpan. Retry akan sambung dari
              preview sedia ada.
            </p>
          </div>

          <div className="max-w-xl">
            <PreviewCard
              title={getPreviewTitle(script)}
              label="Image"
              imageUrl={images.problemImageUrl}
            >
              <button
                type="button"
                onClick={() => selectSceneForVideo(images.problemImageUrl, "problem")}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-primary px-4 text-sm font-black text-primary"
              >
                Jana Video 8s
              </button>
            </PreviewCard>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void generateProblemImage()}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-black text-white"
            >
              Jana Image Lagi
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
        <p className="text-sm font-black text-red-100">Gagal jana image.</p>
        <p className="text-sm leading-6 text-red-100/90">{state.error}</p>
        <button
          type="button"
          onClick={() => void generateProblemImage()}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-slate-950"
        >
          Cuba Lagi
        </button>
        <a
          href="/upload"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-black text-white"
        >
          Upload Semula
        </a>
      </div>
    );
  }

  if (!state.images) {
    return null;
  }

  const images = state.images;
  const storedScript = localStorage.getItem("videoproduk_script");
  const script = storedScript ? (JSON.parse(storedScript) as GeneratedScript) : null;

  return (
    <div className="space-y-5">
      {timeoutCountdown !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 px-4 py-6">
          <div className="w-full max-w-[19rem] rounded-2xl border border-amber-400/40 bg-slate-950 p-4 text-center shadow-glow">
            <p className="text-lg font-black text-white">
              Server cloud sedang busy
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Please try again 5 minute later. Sistem akan kembali ke main page
              dalam {timeoutCountdown} saat.
            </p>
            <a
              href="/"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-black text-slate-950"
            >
              Pergi Main Page
            </a>
          </div>
        </div>
      ) : null}
      <div className="max-w-xl">
        <PreviewCard
          title={getPreviewTitle(script)}
          label="Image"
          imageUrl={images.problemImageUrl}
        >
          <button
            type="button"
            onClick={() => selectSceneForVideo(images.problemImageUrl, "problem")}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-primary px-4 text-sm font-black text-primary"
          >
            Jana Video 8s
          </button>
        </PreviewCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-black text-white">
            Prompt image
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">
            {images.problemPromptUsed || "Prompt image belum disimpan."}
          </p>
        </details>
        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-black text-white">
            Prompt video
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">
            {images.problemVideoPrompt || "Prompt video belum disimpan."}
          </p>
        </details>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-white">
          {freePreviewPolicy.message}
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          Sistem sekarang jana satu image sahaja: problem scene dengan produk
          dalam frame. Video guna image ini sebagai first frame dan prompt
          akan arahkan character ambil/guna produk dalam 8 saat.
        </p>
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs font-semibold leading-5 text-amber-100">
          Disclaimer: Imej AI mungkin tidak sama 100% dengan produk sebenar.
          Semak rupa produk dulu sebelum guna untuk iklan.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void generateProblemImage()}
          disabled={state.status === "loading-problem"}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.status === "loading-problem" ? "Sila tunggu..." : "Jana Image Lagi"}
        </button>
        <button
          type="button"
          disabled={state.status === "loading-problem" || state.status === "loading-solution"}
          onClick={() => {
            const confirmed = window.confirm(
              "Buat Video 8 saat akan guna 1 kredit. Teruskan?"
            );

            if (confirmed) {
              selectSceneForVideo(images.problemImageUrl, "problem");
            }
          }}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
        >
          Buat Video 8s
        </button>
      </div>
    </div>
  );
}
