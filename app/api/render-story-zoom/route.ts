import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { storeGeneratedVideo } from "@/lib/generated-videos";
import { storySceneDurationSeconds, storySceneLimit } from "@/lib/story-types";
import type { StoryScript } from "@/lib/story-types";

export const runtime = "nodejs";
export const maxDuration = 300;

type StoryImage = {
  scene_number: number;
  imageUrl: string;
};

const bundledFfmpegPath =
  "C:\\Users\\admin\\Documents\\Codex\\2026-06-08\\cik-eva-face-7-main-image\\work\\ffmpeg\\ffmpeg-8.1.1-essentials_build\\bin\\ffmpeg.exe";
const bundledFfprobePath =
  "C:\\Users\\admin\\Documents\\Codex\\2026-06-08\\cik-eva-face-7-main-image\\work\\ffmpeg\\ffmpeg-8.1.1-essentials_build\\bin\\ffprobe.exe";

function getFfmpegPath() {
  return process.env.FFMPEG_PATH?.trim() || bundledFfmpegPath;
}

function getFfprobePath() {
  return process.env.FFPROBE_PATH?.trim() || bundledFfprobePath;
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  const mimeType = match[1];
  const ext =
    mimeType === "image/jpeg" || mimeType === "image/jpg"
      ? ".jpg"
      : mimeType === "image/webp"
        ? ".webp"
        : ".png";

  return {
    bytes: Buffer.from(match[2], "base64"),
    ext
  };
}

function audioDataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match || !match[1].startsWith("audio/")) {
    return null;
  }

  const mimeType = match[1];
  const ext = mimeType.includes("mpeg") || mimeType.includes("mp3") ? ".mp3" : ".wav";

  return {
    bytes: Buffer.from(match[2], "base64"),
    ext
  };
}

async function imageUrlToBuffer(imageUrl: string) {
  const fromDataUrl = dataUrlToBuffer(imageUrl);

  if (fromDataUrl) {
    return fromDataUrl;
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Gambar scene gagal dimuat. Status ${response.status}.`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0] || "";
  const ext =
    mimeType === "image/jpeg" || mimeType === "image/jpg"
      ? ".jpg"
      : mimeType === "image/webp"
        ? ".webp"
        : extname(new URL(imageUrl).pathname) || ".png";

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    ext: ext === ".jpeg" ? ".jpg" : ext
  };
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(getFfmpegPath(), args, {
      windowsHide: true
    });
    let stderr = "";

    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Render MP4 gagal. ${
            stderr.trim().split(/\r?\n/).slice(-4).join(" ") || `Exit ${code}`
          }`
        )
      );
    });
  });
}

function readMediaDuration(path: string) {
  return new Promise<number>((resolve) => {
    const ffprobe = spawn(
      getFfprobePath(),
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        path
      ],
      { windowsHide: true }
    );
    let stdout = "";

    ffprobe.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    ffprobe.on("error", () => resolve(0));
    ffprobe.on("close", () => {
      const duration = Number(stdout.trim());

      resolve(Number.isFinite(duration) ? duration : 0);
    });
  });
}

function normalizeImages(images: StoryImage[]) {
  const sorted = images
    .filter((image) => image.imageUrl)
    .sort((a, b) => a.scene_number - b.scene_number);

  if (sorted.length === 0) {
    throw new Error("Tiada gambar cerita untuk render.");
  }

  while (sorted.length < storySceneLimit) {
    const last = sorted[sorted.length - 1];
    sorted.push({
      scene_number: sorted.length + 1,
      imageUrl: last.imageUrl
    });
  }

  return sorted.slice(0, storySceneLimit);
}

function clampSceneDuration(value: unknown) {
  const duration = Number(value);

  if (!Number.isFinite(duration)) {
    return storySceneDurationSeconds;
  }

  return Math.min(6, Math.max(3, Math.round(duration)));
}

function fitSceneDurationToSpeech(scriptDuration: number, audioDuration = 0) {
  const speechSafeDuration = audioDuration > 0 ? Math.ceil(audioDuration + 0.25) : 0;

  return Math.min(10, Math.max(3, scriptDuration, speechSafeDuration));
}

function makeAtempoFilter(factor: number) {
  if (!Number.isFinite(factor) || factor <= 1.02) {
    return "";
  }

  const filters: string[] = [];
  let remaining = Math.min(4, factor);

  while (remaining > 2) {
    filters.push("atempo=2");
    remaining /= 2;
  }

  filters.push(`atempo=${remaining.toFixed(3)}`);

  return `${filters.join(",")},`;
}

function inferSceneMotion(scene: StoryScript["scenes"][number] | undefined, index: number) {
  const text = [
    scene?.narration || "",
    scene?.subtitle || "",
    scene?.image_prompt || ""
  ]
    .join(" ")
    .toLowerCase();

  if (
    text.includes("sedih") ||
    text.includes("sakit") ||
    text.includes("takut") ||
    text.includes("anxious") ||
    text.includes("menangis") ||
    text.includes("berharap")
  ) {
    return "emotional_hold";
  }

  if (
    text.includes("pergi") ||
    text.includes("hilang") ||
    text.includes("kehilangan") ||
    text.includes("kosong") ||
    text.includes("ditinggal")
  ) {
    return "slow_pull_back";
  }

  if (
    text.includes("pilih diri") ||
    text.includes("maruah") ||
    text.includes("lesson") ||
    text.includes("kuat") ||
    text.includes("ending") ||
    text.includes("akhir")
  ) {
    return "lesson_push";
  }

  if (
    text.includes("kenapa") ||
    text.includes("jadi") ||
    text.includes("tanya") ||
    text.includes("?")
  ) {
    return "question_push";
  }

  return index % 3 === 0
    ? "slow_push"
    : index % 3 === 1
      ? "emotional_hold"
      : "slow_pull_back";
}

function makeStableCutFilter(index: number, duration: number, motion: string) {
  const fadeDuration = motion === "emotional_hold" ? 0.18 : 0.12;
  const fadeOutStart = Math.max(0, duration - fadeDuration);

  return `[${index}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30,fade=t=in:st=0:d=${fadeDuration.toFixed(2)},fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration.toFixed(2)}[v${index}]`;
}

export async function POST(request: NextRequest) {
  const workDir = join(tmpdir(), `videoproduk-story-${randomUUID()}`);

  try {
    const body = (await request.json()) as {
      script?: StoryScript;
      images?: StoryImage[];
      audioUrl?: string;
      sceneAudioUrls?: string[];
    };

    if (!body.script) {
      return NextResponse.json(
        { error: "Skrip cerita belum lengkap." },
        { status: 400 }
      );
    }

    const images = normalizeImages(Array.isArray(body.images) ? body.images : []);
    let sceneDurations = Array.from({ length: images.length }, (_item, index) =>
      clampSceneDuration(body.script?.scenes?.[index]?.duration)
    );

    await mkdir(workDir, { recursive: true });

    const imagePaths: string[] = [];

    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const file = await imageUrlToBuffer(image.imageUrl);
      const imagePath = join(workDir, `scene-${String(index + 1).padStart(2, "0")}${file.ext}`);

      await writeFile(imagePath, file.bytes);
      imagePaths.push(imagePath);
    }

    let audioPath = "";
    const sceneAudioPaths: string[] = [];
    let sceneAudioTempoFactors = sceneDurations.map(() => 1);

    if (Array.isArray(body.sceneAudioUrls) && body.sceneAudioUrls.length) {
      for (let index = 0; index < Math.min(body.sceneAudioUrls.length, imagePaths.length); index += 1) {
        const audio = audioDataUrlToBuffer(body.sceneAudioUrls[index]);

        if (!audio) {
          throw new Error(`Audio scene ${index + 1} tidak valid untuk digabung.`);
        }

        const sceneAudioPath = join(workDir, `voice-${String(index + 1).padStart(2, "0")}${audio.ext}`);

        await writeFile(sceneAudioPath, audio.bytes);
        sceneAudioPaths.push(sceneAudioPath);
      }

      const audioDurations = await Promise.all(
        sceneAudioPaths.map((sceneAudioPath) => readMediaDuration(sceneAudioPath))
      );
      sceneAudioTempoFactors = sceneDurations.map((duration, index) =>
        audioDurations[index] && audioDurations[index] > duration
          ? audioDurations[index] / duration
          : 1
      );
    } else if (body.audioUrl) {
      const audio = audioDataUrlToBuffer(body.audioUrl);

      if (!audio) {
        throw new Error("Audio cerita tidak valid untuk digabung.");
      }

      audioPath = join(workDir, `voice${audio.ext}`);
      await writeFile(audioPath, audio.bytes);

      const audioDuration = await readMediaDuration(audioPath);
      if (audioDuration > 0) {
        const targetDuration = sceneDurations.reduce((sum, duration) => sum + duration, 0);
        const factor = audioDuration > targetDuration ? audioDuration / targetDuration : 1;

        sceneAudioTempoFactors = sceneDurations.map(() => factor);
      }
    }

    const outputPath = join(workDir, "story.mp4");
    const totalDurationSeconds = sceneDurations.reduce((sum, duration) => sum + duration, 0);
    const inputArgs = imagePaths.flatMap((imagePath, index) => [
      "-loop",
      "1",
      "-t",
      String(sceneDurations[index] || storySceneDurationSeconds),
      "-i",
      imagePath
    ]);
    const audioInputArgs = sceneAudioPaths.length
      ? sceneAudioPaths.flatMap((sceneAudioPath) => ["-i", sceneAudioPath])
      : audioPath
        ? ["-i", audioPath]
        : [];
    const filterInputs = imagePaths
      .map(
        (_imagePath, index) => {
          const duration = sceneDurations[index] || storySceneDurationSeconds;
          const motion = inferSceneMotion(body.script?.scenes?.[index], index);

          return makeStableCutFilter(index, duration, motion);
        }
      )
      .join(";");
    const concatInputs = imagePaths.map((_imagePath, index) => `[v${index}]`).join("");
    const videoFilter = `${filterInputs};${concatInputs}concat=n=${imagePaths.length}:v=1:a=0,format=yuv420p[v]`;
    const audioFilter = sceneAudioPaths.length
      ? [
          ...sceneAudioPaths.map((_sceneAudioPath, index) => {
            const inputIndex = imagePaths.length + index;
            const duration = sceneDurations[index] || storySceneDurationSeconds;
            const atempo = makeAtempoFilter(sceneAudioTempoFactors[index] || 1);

            return `[${inputIndex}:a]aformat=sample_fmts=fltp:sample_rates=24000:channel_layouts=mono,${atempo}apad,atrim=0:${duration},asetpts=PTS-STARTPTS[a${index}]`;
          }),
          `${sceneAudioPaths.map((_sceneAudioPath, index) => `[a${index}]`).join("")}concat=n=${sceneAudioPaths.length}:v=0:a=1[aout]`
        ].join(";")
      : audioPath
        ? `[${imagePaths.length}:a]aformat=sample_fmts=fltp:sample_rates=24000:channel_layouts=mono,${makeAtempoFilter(sceneAudioTempoFactors[0] || 1)}apad,atrim=0:${totalDurationSeconds},asetpts=PTS-STARTPTS[aout]`
        : "";
    const filterGraph = audioFilter ? `${videoFilter};${audioFilter}` : videoFilter;

    await runFfmpeg([
      "-y",
      ...inputArgs,
      ...audioInputArgs,
      "-filter_complex",
      filterGraph,
      "-map",
      "[v]",
      ...(audioPath || sceneAudioPaths.length ? ["-map", "[aout]", "-c:a", "aac", "-b:a", "128k"] : []),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      outputPath
    ]);

    const bytes = await readFile(outputPath);

    if (bytes.length < 1024) {
      throw new Error("Video MP4 kosong. Cuba render semula.");
    }

    const stored = await storeGeneratedVideo(bytes);

    return NextResponse.json({
      status: "completed",
      result: {
        videoUrl: `/api/generated-videos/${stored.id}`,
        videoMimeType: "video/mp4",
        videoSize: bytes.length,
        caption: body.script.caption,
        hashtags: body.script.hashtags,
        sceneCount: images.length,
        durationSeconds: totalDurationSeconds,
        hasAudio: Boolean(audioPath || sceneAudioPaths.length)
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Render video cerita gagal."
      },
      { status: 500 }
    );
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
