"use client";

import { useEffect, useState } from "react";
import type { GeneratedScript } from "@/lib/gemini";
import type { RenderJobResult } from "@/lib/render-types";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import {
  canStartVideoGeneration,
  getUsageSnapshot,
  type UsageSnapshot
} from "@/lib/client-usage-store";
import {
  continuePersistentVideoJob,
  createPersistentVideoJob,
  getPersistentVideoJob,
  onVideoJobUpdate
} from "@/lib/persistent-video-job";
import { ProgressBar } from "./ProgressBar";

type SelectedScene = {
  imageUrl: string;
  sceneKind?: "problem" | "solution";
  sceneDescription?: string;
  dialogueLine?: string;
  manualVideoPrompt?: string;
  productAnalysis?: string;
  characterGender?: "auto" | "male" | "female";
};

type RenderState =
  | { status: "ready"; jobId: ""; progress: 0; result: null; error: "" }
  | { status: "queueing" | "processing"; jobId: string; progress: number; result: null; error: "" }
  | { status: "done"; jobId: string; progress: 100; result: RenderJobResult; error: "" }
  | { status: "error"; jobId: string; progress: number; result: null; error: string };

const shopWatermarkEnabledKey = "videoproduk_shop_watermark_enabled";
const shopWatermarkNameKey = "videoproduk_shop_watermark_name";

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

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

function getProductAnalysisInstruction(scene?: SelectedScene | null) {
  const facts =
    scene?.productAnalysis ||
    localStorage.getItem("videoproduk_product_analysis") ||
    "";

  if (!facts.trim()) {
    return "Use the uploaded product/reference image as source of truth. Do not invent unsupported product features.";
  }

  return [
    "Hard product facts from upload analysis:",
    facts.trim(),
    "Do not contradict these facts. If the facts say portable, rechargeable, battery powered, no visible cable, or compact travel design, do not add cable, power cord, wall plug, wired version, wrong color, wrong shape, or unrelated accessories. Do not switch to a random hero object such as tissue, cloth, bottle, box, food, tool, bag, watch, or cosmetic unless it is the uploaded product. The character must interact with the uploaded product only."
  ].join(" ");
}

function getCharacterInstruction(scene?: SelectedScene | null) {
  const gender =
    scene?.characterGender ||
    localStorage.getItem("videoproduk_character_gender") ||
    "auto";

  if (gender === "male") {
    return "Use the same adult male character from the first frame. Do not change to a female character.";
  }

  if (gender === "female") {
    return "Use the same adult female character from the first frame. Do not change to a male character.";
  }

  return "Keep the same adult character from the first frame throughout the video.";
}

function getStoredScript(): GeneratedScript {
  const stored = localStorage.getItem("videoproduk_script");

  if (!stored) {
    return {
      hook: "Produk ni memang jimat masa!",
      scene1_description: "Problem angle produk.",
      scene1_subtitle: "Masalah biasa korang",
      scene1_video_script:
        "Aduh, masalah ni memang susah nak settle, kerja jadi lambat dan rasa serabut setiap kali buat.",
      scene1_video_prompt:
        'Create one 8-second vertical 9:16 image-to-video clip from this problem image. The main adult character says in Malay with visible lip movement: "Aduh, masalah ni memang susah nak settle, kerja jadi lambat dan rasa serabut setiap kali buat." Show natural small motion and mild frustrated expression. No subtitles, no on-screen text, no logo.',
      scene2_description: "Product angle produk.",
      scene2_subtitle: "Ni solusi cepat",
      scene2_video_script:
        "Ha, lepas cuba produk ni, kerja terus nampak lebih mudah, kemas, dan sesuai guna hari-hari.",
      scene2_video_prompt:
        'Continue this exact vertical 9:16 product video from the final frame into the solution/product demo moment. The main adult character says in Malay with visible lip movement: "Ha, lepas cuba produk ni, kerja terus nampak lebih mudah, kemas, dan sesuai guna hari-hari." Show natural product interaction, relieved expression, and clear product benefit. No subtitles, no on-screen text, no logo.',
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
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [progressTimerId, setProgressTimerId] = useState<number | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  function getProductName() {
    return localStorage.getItem("videoproduk_product_name") || "produk ni";
  }

  function getEightSecondFallbackDialogue(scene: SelectedScene) {
    const productName = getProductName();

    if (scene.sceneKind === "problem") {
      return `Aduh, cara lama ni buat kerja jadi lambat, nasib baik ${productName} nampak boleh bantu hari ni.`;
    }

    return `Ha, lepas cuba ${productName}, kerja jadi lebih mudah, nampak kemas, dan sesuai guna setiap hari.`;
  }

  function getDialogueLine(scene: SelectedScene, script: GeneratedScript) {
    const candidate =
      scene.dialogueLine ||
      (scene.sceneKind === "problem"
        ? script.scene1_video_script || script.scene1_subtitle
        : script.scene2_video_script || script.scene2_subtitle);

    if (!candidate || candidate.trim().length < 65 || countWords(candidate) < 10) {
      return getEightSecondFallbackDialogue(scene);
    }

    return candidate;
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
      getProductAnalysisInstruction(scene),
      getCharacterInstruction(scene),
      `The main adult character must speak this Malay line naturally with visible lip movement and matching expression: "${dialogueLine}".`,
      "Use adult-only scenes with mature adult proportions, adult wardrobe, and adult home or workplace context.",
      "Use medium shot framing and avoid close-up face changes. Make the mouth subtly move while speaking. Do not make the clip silent.",
      "Keep emotions mild and commercial-friendly. No panic, crying, sickness, injury, fight, fear, or distress.",
      getShopWatermarkInstruction()
    ].join(" ");
  }

  function buildExtendVideoPrompt(scene: SelectedScene, script: GeneratedScript) {
    const solutionDialogue = getDialogueLine(
      { ...scene, sceneKind: "solution", dialogueLine: script.scene2_video_script },
      script
    );
    const selectedMethod = script.visual_method || "problem_solution";
    const continuationGoal =
      extractExtendPrompt(scene.manualVideoPrompt || "") ||
      script.scene2_video_prompt ||
      script.scene2_description ||
      "Move into the product use, visible benefit, satisfying result, and confident ending.";
    const baseContext =
      script.scene1_description ||
      scene.sceneDescription ||
      "The first 8 seconds introduced the setup or problem.";

    return [
      "Continue this exact vertical 9:16 product video from the final frame.",
      "The output should feel like one complete 16-second TikTok Shop product video, continuing the same scene without a hard reset.",
      "Keep the same adult character, same product, same room/location, same lighting, same camera style, and same visual identity.",
      `Selected visual method: ${selectedMethod}.`,
      getProductAnalysisInstruction(scene),
      getCharacterInstruction(scene),
      `Base clip context, do not repeat this as the main action: ${baseContext}`,
      `Continuation goal for this second 8 seconds: ${continuationGoal}`,
      "Strict object continuity: continue from the exact final frame only. Do not reset the scene. Do not resurrect, duplicate, or reintroduce any small prop that was moved away, placed aside, removed, hidden, or left behind in the base clip.",
      "No new random props may appear during the extension. If an unrelated tissue, cloth, bottle, box, food, tool, bag, watch, or cosmetic is not the uploaded product, it must not become visible again or become part of the action.",
      "Do not repeat the base clip setup, pose, problem action, or first dialogue. This second clip must show a new action: product use, result, benefit, demo, or showcase ending.",
      "Show the adult character naturally touching, holding, opening, wearing, using, or pointing to the product when relevant.",
      "Do not switch the hero action to an unrelated object. Use the uploaded product only.",
      `The main adult character must speak this Malay line naturally with visible lip movement and matching expression: "${solutionDialogue}".`,
      "Use medium shot framing and avoid close-up face changes. Make the mouth subtly move while speaking. Do not make the clip silent.",
      "Use adult-only scenes with mature adult proportions, adult wardrobe, and adult home or workplace context.",
      "Keep emotions mild and commercial-friendly. No panic, crying, sickness, injury, fight, fear, or distress.",
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
      getProductAnalysisInstruction(scene),
      getCharacterInstruction(scene),
      sceneDescription,
      `The main adult character must speak this Malay line naturally with visible lip movement and matching expression: "${dialogueLine}".`,
      "Use adult-only scenes with mature adult proportions, adult wardrobe, and adult home or workplace context.",
      "The speaking should fit the situation in the scene. Use medium shot framing, subtle mouth movement, gentle hand gesture, and slight camera push-in.",
      "Keep emotions mild and ad-safe: everyday inconvenience, mild concern, then calm relief. No panic, crying, sickness, injury, fight, fear, or distress.",
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
    setUsage(getUsageSnapshot());

    const activeJob = getPersistentVideoJob();

    if (activeJob?.status === "active") {
      setState({
        status: "processing",
        jobId: activeJob.baseOperationName || activeJob.extendOperationName || "",
        progress: activeJob.phase === "poll-extend" ? 64 : 22,
        result: null,
        error: ""
      });
      startLocalProgress();
      void continuePersistentVideoJob();
    }

    return onVideoJobUpdate(() => {
      const job = getPersistentVideoJob();

      if (!job) {
        return;
      }

      if (job.status === "active") {
        setState((current) => ({
          status: "processing",
          jobId: job.baseOperationName || job.extendOperationName || current.jobId,
          progress:
            job.phase === "poll-extend"
              ? Math.max(current.progress, 64)
              : Math.max(current.progress, 18),
          result: null,
          error: ""
        }));
        return;
      }

      if (job.status === "done" && job.videoUrl) {
        setUsage(getUsageSnapshot());
        setState({
          status: "done",
          jobId: job.extendOperationName || job.baseOperationName || "",
          progress: 100,
          result: {
            videoUrl: job.videoUrl,
            baseVideoGcsUri: job.baseVideoGcsUri,
            extendedVideoGcsUri: job.extendedVideoGcsUri,
            watermarked: true,
            downloadable: false
          },
          error: ""
        });
        setRedirectCountdown(3);
        stopLocalProgress();
        return;
      }

      if (job.status === "error") {
        setState({
          status: "error",
          jobId: job.baseOperationName || job.extendOperationName || "",
          progress: 0,
          result: null,
          error: job.error || "Video gagal dijana."
        });
        stopLocalProgress();
      }
    });
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

    if (!canStartVideoGeneration()) {
      setUsage(getUsageSnapshot());
      setState({
        status: "error",
        jobId: "",
        progress: 0,
        result: null,
        error:
          "Beta video credit sudah habis. Untuk jualan sebenar, sambungkan payment/credit system dulu."
      });
      return;
    }

    const confirmed = window.confirm(
      "Render video 16 saat akan jana base 8s dan sambung video. Credit hanya ditolak jika video berjaya. Teruskan?"
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
      createPersistentVideoJob({
        title: localStorage.getItem("videoproduk_product_name") || "Video Produk",
        referenceSceneUrl: scene.imageUrl,
        basePrompt: videoPrompt,
        extendPrompt: buildExtendVideoPrompt(normalizedScene, script),
        caption: script.caption,
        hashtags: script.hashtags
      });
      await continuePersistentVideoJob();
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
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Credit & cost guard
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            Baki beta video credit: {usage?.videoCredits ?? 0}. Anggaran kasar:
            16s Veo Lite dengan audio sekitar USD0.80 sebelum tax/exchange.
            Credit hanya ditolak bila video berjaya disimpan.
          </p>
        </div>
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
