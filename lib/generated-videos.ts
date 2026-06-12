import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const videoDir = process.env.VERCEL
  ? join(tmpdir(), "videoproduk-generated-videos")
  : join(process.cwd(), ".generated-videos");

type StoredVideo = {
  id: string;
  path: string;
};

export async function storeGeneratedVideo(bytes: Buffer): Promise<StoredVideo> {
  const id = `${randomUUID()}.mp4`;
  const path = join(videoDir, id);

  await mkdir(videoDir, { recursive: true });
  await writeFile(path, bytes);

  return { id, path };
}

export async function readGeneratedVideo(id: string) {
  if (!/^[a-f0-9-]+\.mp4$/.test(id)) {
    throw new Error("Video id tidak valid.");
  }

  return readFile(join(videoDir, id));
}
