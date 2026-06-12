"use client";

import { useEffect, useState } from "react";
import type { GeneratedScript } from "@/lib/gemini";
import type { RenderJobResult } from "@/lib/render-types";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import { storeVideoDataUrl } from "@/lib/client-video-store";
import { ProgressBar } from "./ProgressBar";

type SelectedScene = {
  imageUrl: string;
  sceneKind?: "problem" | "solution";
  sceneDescription?: string;
  dialogueLine?: string;
  manualVideoPrompt?: string;
};

type RenderState =
  | { status: "ready"; jobId: ""; progress: 0; result: null; error: "" }
  | { status: "queueing" | "processing"; jobId: string; progress: number; result: null; error: "" }
  | { status: "done"; jobId: string; progress: 100; result: RenderJobResult; error: "" }
  | { status: "error"; jobId: string; progress: number; result: null; error: string };

const shopWatermarkEnabledKey = "videoproduk_shop_watermark_enabled";
const shopWatermarkNameKey = "videoproduk_shop_watermark_name";

function sanitizeShopWatermark(value: string) {
  return value
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
}

function getShopWatermarkInstruction() {
  const isEnabled = localStorage.getItem(shopWatermarkEnabledKey) === "true";
  const shopName = sanitizeShopWatermark(
    localStorage.getItem(shopWatermarkNameKey) || ""
  );

  if (!isEnabled || !shopName) {
    return "No subtitles, no on-screen text, no logo, no watermark.";
  }

  return `Preserve the subtle shop-name watermark "${shopName}" in the upper-center area if it appears in the first frame. Keep it away from the top border. Do not add any other subtitles, on-screen text, logo, caption, or typography.`;
}

function getStoredScript(): GeneratedScript {
  const stored = localStorage.getItem("videoproduk_script");

  if (!stored) {
    return {
      hook: "Produk ni memang jimat masa!",
      scene1_description: "Problem angle produk.",
      scene1_subtitle: "Masalah biasa korang",
      scene1_video_script: "Aduh, masalah ni memang susah nak settle.",
      scene1_video_prompt:
        'Create one 8-second vertical 9:16 image-to-video clip from this problem image. The main adult character says in Malay with visible lip movement: "Aduh, masalah ni memang susah nak settle." Show natural small motion and frustrated expression. No subtitles, no on-screen text, no logo.',
      scene2_description: "Product angle produk.",
      scene2_subtitle: "Ni solusi cepat",
      scene2_video_script: "Ha, guna ni terus nampak senang.",
      scene2_video_prompt:
        'Continue this exact vertical 9:16 product video from the final frame into the solution/product demo moment. The main adult character says in Malay with visible lip movement: "Ha, guna ni terus nampak senang." Show natural product interaction, relieved expression, and clear product benefit. No subtitles, no on-screen text, no logo.',
      cta: "Klik beg kuning sekarang!",
      caption: "Produk ni sesuai untuk content TikTok Shop. Check beg kuning sekarang.",
      hashtags: ["#TikTokShopMY", "#RacunTikTok", "#BarangBest", "#VideoProduk", "#Malaysia"]
    };
  }

  return JSON.parse(stored) as GeneratedScript;
}

function getSelectedScene(): SelectedScene | null {
  const stored = localStorage.getItem("videoproduk_selected_scene");

  if (!stored) {
    return null;
  }

  return JSON.parse(stored) as SelectedScene;
}

function shouldUseProductAction(script: GeneratedScript) {
  return Boolean(
    script.visual_method && script.visual_method !== "problem_solution"
  );
}

function extractBasePrompt(prompt: string) {
  const extendMarker = "EXTEND / CONTINUATION PROMPT FOR FINAL 16s:";
  const baseMarker = "BASE 8s PROMPT:";
  const withoutExtend = prompt.includes(extendMarker)
    ? prompt.slice(0, prompt.indexOf(extendMarker))
    : prompt;

  return withoutExtend.replace(baseMarker, "").trim();
}

function extractExtendPrompt(prompt: string) {
  const extendMarker = "EXTEND / CONTINUATION PROMPT FOR FINAL 16s:";

  if (!prompt.includes(extendMarker)) {
    return "";
  }

  return prompt.slice(prompt.indexOf(extendMarker) + extendMarker.length).trim();
}

function normalizeSceneForVideo(
  scene: SelectedScene,
  script: GeneratedScript
): SelectedScene {
  if (!shouldUseProductAction(script)) {
    return scene;
  }

  return {
    ...scene,
    sceneKind: "solution",
    sceneDescription:
      script.scene2_description ||
      scene.sceneDescription ||
      "Product showcase scene.",
    dialogueLine:
      script.scene2_video_script ||
      script.scene2_subtitle ||
      script.cta ||
      scene.dialogueLine ||
      "Produk ni memang nampak kemas dan mudah digunakan.",
    manualVideoPrompt:
      script.scene2_video_prompt ||
      scene.manualVideoPrompt ||
      "Create one 8-second vertical 9:16 product showcase image-to-video clip."
  };
}

export function RenderProgress() {
  const [selectedScene, setSelectedScene] = useState<SelectedScene | null>(null);
  const [state, setState] = useState<RenderState>({
    status: "ready",
    jobId: "",
    progress: 0,
    result: null,
    error: ""
  });
  const [progressTimerId, setProgressTimerId] = useState<number | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  function getDialogueLine(scene: SelectedScene, script: GeneratedScript) {
    return (
      scene.dialogueLine ||
      (scene.sceneKind === "problem"
        ? script.scene1_video_script || script.scene1_subtitle
        : script.scene2_video_script || script.scene2_subtitle)
    );
  }

  function enforceEightSecondSpeechPrompt(
    basePrompt: string,
    scene: SelectedScene,
    script: GeneratedScript
  ) {
    const dialogueLine = getDialogueLine(scene, script);

    return [
      basePrompt.replace(/\b6-second\b/gi, "8-second").replace(/\b6 seconds\b/gi, "8 seconds"),
      "Duration must be exactly 8 seconds.",
      `The main adult character must speak this Malay line naturally with visible lip movement and matching expression: "${dialogueLine}".`,
      "Use adult characters only. Do not show children, babies, toddlers, minors, or child faces.",
      "Make the mouth visibly move while speaking. Do not make the clip silent.",
      getShopWatermarkInstruction()
    ].join(" ");
  }

  function buildExtendVideoPrompt(scene: SelectedScene, script: GeneratedScript) {
    const solutionDialogue =
      script.scene2_video_script ||
      script.scene2_subtitle ||
      script.cta ||
      "Ha, ini baru senang, cepat terus boleh guna.";
    const selectedMethod = script.visual_method || "problem_solution";

    return [
      "Continue this exact vertical 9:16 product video from the final frame.",
      "The output should feel like one complete 16-second TikTok Shop product video, continuing the same scene without a hard reset.",
      "Keep the same adult character, same product, same room/location, same lighting, same camera style, and same visual identity.",
      `Selected visual method: ${selectedMethod}.`,
      scene.sceneDescription || script.scene1_description,
      extractExtendPrompt(scene.manualVideoPrompt || "") ||
        script.scene2_video_prompt ||
        script.scene2_description,
      "For the continuation, move from the first clip situation into the product benefit, demo, or showcase moment.",
      "Show the adult character naturally touching, holding, opening, wearing, using, or pointing to the product when relevant.",
      `The main adult character must speak this Malay line naturally with visible lip movement and matching expression: "${solutionDialogue}".`,
      "Make the mouth visibly move while speaking. Do not make the clip silent.",
      "Use adult characters only. Do not show children, babies, toddlers, minors, or child faces.",
      getShopWatermarkInstruction()
    ].join(" ");
  }

  function buildFallbackVideoPrompt(scene: SelectedScene, script: GeneratedScript) {
    const sceneDescription =
      scene.sceneDescription ||
      (scene.sceneKind === "problem"
        ? script.scene1_description
        : script.scene2_description);
    const dialogueLine = getDialogueLine(scene, script);

    return [
      "Create one 8-second vertical 9:16 image-to-video clip using the supplied image as the first frame.",
      sceneDescription,
      `The main adult character must speak this Malay line naturally with visible lip movement and matching expression: "${dialogueLine}".`,
      "Use adult characters only. Do not show children, babies, toddlers, minors, or child faces.",
      "The speaking should fit the situation in the scene. Use natural small motion: facial expression, mouth movement, gentle hand gesture, slight camera push-in.",
      "Do not make the clip silent.",
      getShopWatermarkInstruction()
    ].join(" ");
  }

  function startLocalProgress() {
    if (progressTimerId) {
      window.clearInterval(progressTimerId);
    }

    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.status !== "processing" && current.status !== "queueing") {
          return current;
        }

        const nextProgress =
          current.progress < 35
            ? current.progress + 5
            : current.progress < 70
              ? current.progress + 3
              : current.progress < 92
                ? current.progress + 1
                : current.progress;

        return {
          ...current,
          progress: Math.min(nextProgress, 92)
        };
      });
    }, 4000);

    setProgressTimerId(timer);
  }

  function stopLocalProgress() {
    if (progressTimerId) {
      window.clearInterval(progressTimerId);
      setProgressTimerId(null);
    }
  }

  useEffect(() => {
    localStorage.setItem("videoproduk_restore_preview", "true");
    setSelectedScene(getSelectedScene());
  }, []);

  async function startRender() {
    const scene = getSelectedScene();

    if (!scene) {
      setState({
        status: "error",
        jobId: "",
        progress: 0,
        result: null,
        error: "Pilih satu visual di halaman preview dulu."
      });
      return;
    }

    const confirmed = window.confirm(
      "Render video 16 saat akan jana base 8s dan sambung video. Teruskan?"
    );

    if (!confirmed) {
      return;
    }

    const script = getStoredScript();
    const normalizedScene = normalizeSceneForVideo(scene, script);
    const videoPrompt = enforceEightSecondSpeechPrompt(
      extractBasePrompt(normalizedScene.manualVideoPrompt || "") ||
        buildFallbackVideoPrompt(normalizedScene, script),
      normalizedScene,
      script
    );
    setState({
      status: "processing",
      jobId: "",
      progress: 5,
      result: null,
      error: ""
    });
    startLocalProgress();

    try {
      const response = await fetch("/api/manual-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          referenceSceneUrl: scene.imageUrl,
          prompt: videoPrompt
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Render gagal dimulakan.");
      }

      setState((current) =>
        current.status === "processing"
          ? {
              ...current,
              progress: Math.max(current.progress, 58)
            }
          : current
      );

      let videoUrl = String(data.videoUrl || "");
      let extendedVideoGcsUri: string | undefined;
      const baseVideoGcsUri =
        typeof data.baseVideoGcsUri === "string"
          ? data.baseVideoGcsUri
          : undefined;

      if (!baseVideoGcsUri) {
        throw new Error(
          "Video 16 saat perlukan GCS_BUCKET_NAME supaya base video boleh disambung."
        );
      }

      const extendResponse = await fetch("/api/extend-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          baseVideoGcsUri,
          prompt: buildExtendVideoPrompt(normalizedScene, script)
        })
      });
      const extendData = await extendResponse.json();

      if (!extendResponse.ok) {
        throw new Error(extendData.error || "Sambung video gagal.");
      }

      videoUrl = String(extendData.videoUrl || "");
      extendedVideoGcsUri =
        typeof extendData.extendedVideoGcsUri === "string"
          ? extendData.extendedVideoGcsUri
          : undefined;

      const result: RenderJobResult = {
        videoUrl,
        baseVideoGcsUri,
        extendedVideoGcsUri,
        watermarked: true,
        downloadable: false
      };

      const storedResult =
        videoUrl.startsWith("data:video")
          ? {
              ...result,
              videoUrl: "",
              videoStoreKey: await storeVideoDataUrl(videoUrl)
            }
          : result;

      localStorage.setItem(
        "videoproduk_render_result",
        JSON.stringify(storedResult)
      );
      setState({
        status: "done",
        jobId: data.operationName || "",
        progress: 100,
        result,
        error: ""
      });
      setRedirectCountdown(3);
    } catch (error) {
      setState({
        status: "error",
        jobId: "",
        progress: 0,
        result: null,
        error: getFriendlyErrorMessage(error, "Render gagal dimulakan.")
      });
    } finally {
      stopLocalProgress();
    }
  }

  useEffect(() => () => stopLocalProgress(), [progressTimerId]);

  useEffect(() => {
    if (redirectCountdown === null) {
      return;
    }

    if (redirectCountdown <= 0) {
      window.location.href = "/download";
      return;
    }

    const timer = window.setTimeout(() => {
      setRedirectCountdown((current) =>
        current === null ? null : Math.max(0, current - 1)
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [redirectCountdown]);

  const isLoading = state.status === "queueing" || state.status === "processing";

  return (
    <div className="relative space-y-5">
      {isLoading ? (
        <div className="fixed inset-0 z-50 bg-black/70 text-center backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/40 bg-slate-950 px-4 py-3 shadow-glow">
            <p className="text-sm font-black text-white">Sila tunggu</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Sedang jana video 16 saat.
            </p>
          </div>
        </div>
      ) : null}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-black text-white">Reference final</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {selectedScene
            ? selectedScene.sceneKind === "problem"
              ? "Problem image akan digunakan sebagai reference frame untuk video Veo 16 saat dengan prompt Gemini."
              : "Solution image akan digunakan sebagai reference frame untuk video Veo 16 saat dengan prompt Gemini."
            : "Belum ada preview image. Kembali ke preview dan jana visual dulu."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-black text-white">Final render</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Sistem akan jana base 8 saat, kemudian sambung video supaya final
          jadi sekitar 16 saat. Output free tier masih preview.
        </p>
        <div className="mt-5">
          <ProgressBar value={state.progress} />
        </div>
      </div>

      {state.status === "error" ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm font-black text-red-100">Gagal jana video.</p>
          <p className="mt-2 text-sm leading-6 text-red-100/90">{state.error}</p>
        </div>
      ) : null}

      {state.status === "done" ? (
        <div className="rounded-2xl border border-primary/50 bg-primary/10 p-5">
          <p className="text-sm font-black text-white">Render siap.</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Sistem akan buka preview video dalam {redirectCountdown ?? 3} saat.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void startRender()}
          disabled={isLoading}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading
            ? "Sila tunggu..."
            : "Mulakan Render - Guna 1 Kredit"}
        </button>
      )}
    </div>
  );
}
