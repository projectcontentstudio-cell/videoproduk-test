"use client";

import { useState } from "react";

type ImagePayload = {
  dataUrl: string;
  base64: string;
  mimeType: "image/jpeg" | "image/png";
  name: string;
};

function readImageFile(file: File) {
  return new Promise<ImagePayload>((resolve, reject) => {
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      reject(new Error("Image mesti JPG atau PNG."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("Gagal baca image."));
        return;
      }

      const [header, base64] = result.split(",");

      if (!header?.startsWith("data:image/") || !base64) {
        reject(new Error("Image tidak valid."));
        return;
      }

      resolve({
        dataUrl: result,
        base64,
        mimeType: header.includes("image/jpeg") ? "image/jpeg" : "image/png",
        name: file.name
      });
    };
    reader.onerror = () => reject(new Error("Gagal baca image."));
    reader.readAsDataURL(file);
  });
}

function UploadInput({
  label,
  onImage
}: {
  label: string;
  onImage: (image: ImagePayload | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg"
        onChange={async (event) => {
          const file = event.target.files?.[0];

          if (!file) {
            onImage(null);
            return;
          }

          onImage(await readImageFile(file));
        }}
        className="mt-2 block w-full rounded-xl border border-border bg-slate-950 p-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-black file:text-slate-950"
      />
    </label>
  );
}

export function ManualLab() {
  const [productName, setProductName] = useState("Manual Test Product");
  const [productPrice, setProductPrice] = useState("RM39");
  const [productImage, setProductImage] = useState<ImagePayload | null>(null);
  const [videoImage, setVideoImage] = useState<ImagePayload | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  async function generateImage() {
    if (!productImage) {
      setError("Upload product/reference image dulu.");
      return;
    }

    setLoadingImage(true);
    setError("");
    setStatus("Gemini image model sedang generate dari prompt + reference...");

    try {
      const response = await fetch("/api/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "reference-prompt",
          productName,
          productPrice,
          productImageBase64: productImage.base64,
          productImageMimeType: productImage.mimeType,
          script: {
            scene1_description: imagePrompt,
            scene2_description: imagePrompt
          },
          quality: "preview",
          style: "manual-qa",
          prompt: imagePrompt
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Image gagal dijana.");
      }

      setGeneratedImageUrl(data.images.imageUrl);
      setStatus("Image siap. Semak dulu sebelum generate video.");
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Image gagal dijana."
      );
      setStatus("");
    } finally {
      setLoadingImage(false);
    }
  }

  async function askGemini() {
    setLoadingChat(true);
    setError("");

    try {
      const response = await fetch("/api/gemini-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: chatMessage,
          productName,
          productPrice,
          productImageBase64: productImage?.base64,
          productImageMimeType: productImage?.mimeType
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gemini chat gagal.");
      }

      setChatReply(`[${data.model}]\n${data.reply}`);
    } catch (chatError) {
      setError(
        chatError instanceof Error ? chatError.message : "Gemini chat gagal."
      );
    } finally {
      setLoadingChat(false);
    }
  }

  async function generateVideo(referenceOverride?: string) {
    const referenceSceneUrl = referenceOverride || videoImage?.dataUrl || generatedImageUrl;

    if (!referenceSceneUrl) {
      setError("Upload video reference image atau generate image dulu.");
      return;
    }

    setLoadingVideo(true);
    setError("");
    setGeneratedVideoUrl("");
    setVideoProgress(5);
    setStatus("Manual Veo sedang generate direct dari image...");
    const progressTimer = window.setInterval(() => {
      setVideoProgress((current) => {
        if (current < 35) {
          return current + 5;
        }

        if (current < 70) {
          return current + 3;
        }

        if (current < 92) {
          return current + 1;
        }

        return current;
      });
    }, 4000);

    try {
      const response = await fetch("/api/manual-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceSceneUrl,
          prompt: videoPrompt
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Video gagal dimulakan.");
      }

      setGeneratedVideoUrl(data.videoUrl || "");
      setVideoProgress(100);
      setStatus(
        data.attempts && data.attempts > 1
          ? `Video siap selepas ${data.attempts} attempts.`
          : "Video siap."
      );
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Video gagal dijana."
      );
      setVideoProgress(0);
    } finally {
      window.clearInterval(progressTimer);
      setLoadingVideo(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <p className="text-sm font-black text-white">Manual QA Lab</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Test direct: upload reference image, paste prompt, generate image
            guna Gemini image model. Prompt tidak dipaksa realistic/3D. Gemini
            chat disediakan untuk bantu tulis prompt sahaja.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Product name
            </span>
            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-slate-950 px-4 text-sm text-white outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Price
            </span>
            <input
              value={productPrice}
              onChange={(event) => setProductPrice(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-slate-950 px-4 text-sm text-white outline-none focus:border-primary"
            />
          </label>
        </div>

        <UploadInput label="Upload product/reference image" onImage={setProductImage} />
        {productImage ? (
          <p className="text-xs font-semibold text-primary">
            Active reference: {productImage.name}
          </p>
        ) : null}

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Image prompt
          </span>
          <textarea
            value={imagePrompt}
            onChange={(event) => setImagePrompt(event.target.value)}
            rows={6}
            placeholder="Seorang pelajar perempuan nampak sedih, struggling dengan beg sekolah lama yang dah lusuh, zip rosak, atau nampak tak stylo langsung. Dia mengeluh."
            className="mt-2 w-full resize-y rounded-xl border border-border bg-slate-950 p-4 text-sm leading-6 text-white outline-none focus:border-primary"
          />
        </label>

        <button
          type="button"
          onClick={() => void generateImage()}
          disabled={loadingImage || !productImage || imagePrompt.trim().length < 20}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingImage ? "Generating Image..." : "Generate Image From Prompt"}
        </button>

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-black text-white">Chat With Gemini</p>
          <textarea
            value={chatMessage}
            onChange={(event) => setChatMessage(event.target.value)}
            rows={5}
            placeholder="Tanya Gemini: based on uploaded product, prompt problem scene yang sesuai apa?"
            className="w-full resize-y rounded-xl border border-border bg-slate-950 p-4 text-sm leading-6 text-white outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => void askGemini()}
            disabled={loadingChat || chatMessage.trim().length < 2}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/20 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingChat ? "Asking Gemini..." : "Ask Gemini"}
          </button>
          {chatReply ? (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-slate-950 p-4 text-sm leading-6 text-slate-200">
              {chatReply}
            </pre>
          ) : null}
        </div>

        <div className="border-t border-border pt-4">
          <UploadInput label="Upload video reference image optional" onImage={setVideoImage} />
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Optional. Kalau kosong, button bawah image preview akan guna image
            yang baru dijana.
          </p>
        </div>

        {status ? <p className="text-sm font-semibold text-slate-300">{status}</p> : null}
        {error ? <p className="text-sm font-bold text-red-200">{error}</p> : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-black text-white">Image Preview</p>
          {generatedImageUrl ? (
            <div className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImageUrl}
                alt="Generated manual preview"
                className="aspect-[9/16] w-full rounded-xl object-cover"
              />
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Video prompt for this image
                </span>
                <textarea
                  value={videoPrompt}
                  onChange={(event) => setVideoPrompt(event.target.value)}
                  rows={5}
                  placeholder="Create an 8-second vertical video using this image as the first frame. The character says one short Malay line with visible lip movement, shows the problem, notices the product, uses it, and looks relieved. No text, no logo."
                  className="mt-2 w-full resize-y rounded-xl border border-border bg-slate-950 p-4 text-sm leading-6 text-white outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                onClick={() => void generateVideo(generatedImageUrl)}
                disabled={loadingVideo || videoPrompt.trim().length < 20}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-primary bg-primary px-6 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingVideo
                  ? "Generating Video..."
                  : "Generate Video From This Image"}
              </button>
              {loadingVideo || videoProgress > 0 ? (
                <div className="rounded-xl border border-border bg-slate-950 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    <span>Veo progress</span>
                    <span>{videoProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    Anggaran sahaja. Jika server video busy, sistem akan retry
                    setiap 30 saat sampai 5 kali.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex aspect-[9/16] items-center justify-center rounded-xl border border-dashed border-border text-center text-sm font-semibold text-slate-500">
              Image result akan muncul di sini
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-black text-white">Video Preview</p>
          {generatedVideoUrl ? (
            <video
              src={generatedVideoUrl}
              controls
              className="aspect-[9/16] w-full rounded-xl bg-black object-cover"
            />
          ) : (
            <div className="flex aspect-[9/16] items-center justify-center rounded-xl border border-dashed border-border text-center text-sm font-semibold text-slate-500">
              Video result akan muncul di sini
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
