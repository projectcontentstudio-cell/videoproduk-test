"use client";

import { useEffect, useState } from "react";
import type { GeneratedScript } from "@/lib/gemini";
import type { RenderJobResult } from "@/lib/render-types";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
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
        'Create one 8-second vertical 9:16 image-to-video clip from this solution image. The main adult character says in Malay with visible lip movement: "Ha, guna ni terus nampak senang." Show natural small motion, product demo action if relevant, and relieved expression. No subtitles, no on-screen text, no logo.',
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
      "Make the mouth visibly move while speaking. Do not make the clip silent.",
      "No subtitles, no on-screen text, no logo, no watermark."
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
      "The speaking should fit the situation in the scene. Use natural small motion: facial expression, mouth movement, gentle hand gesture, slight camera push-in.",
      "Do not make the clip silent. No subtitles, no on-screen text, no logo, no watermark."
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
      "Render video 8 saat akan guna 1 kredit. Teruskan?"
    );

    if (!confirmed) {
      return;
    }

    const script = getStoredScript();
    const videoPrompt = enforceEightSecondSpeechPrompt(
      scene.manualVideoPrompt || buildFallbackVideoPrompt(scene, script),
      scene,
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

      const result = {
        videoUrl: data.videoUrl,
        watermarked: true,
        downloadable: false
      };
      localStorage.setItem("videoproduk_render_result", JSON.stringify(result));
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
              Sedang jana video 8 saat.
            </p>
          </div>
        </div>
      ) : null}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-black text-white">Reference final</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {selectedScene
            ? selectedScene.sceneKind === "problem"
              ? "Problem image akan digunakan sebagai reference frame untuk 1 clip Veo 8 saat dengan prompt Gemini."
              : "Solution image akan digunakan sebagai reference frame untuk 1 clip Veo 8 saat dengan prompt Gemini."
            : "Belum ada preview image. Kembali ke preview dan jana visual dulu."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-black text-white">Final render</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Preview render guna direct Veo endpoint supaya token dibaca fresh dari
          server. Output free tier masih preview dan bukan download final.
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
