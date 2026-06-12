import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const assetDir = process.env.VERCEL
  ? join(tmpdir(), "videoproduk-generated-assets")
  : join(rootDir, ".generated-assets");

type StoredAsset = {
  id: string;
  mimeType: "image/png" | "image/jpeg";
  path: string;
};

export async function storeGeneratedImage(dataUrl: string): Promise<StoredAsset> {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);

  if (!match) {
    throw new Error("Generated image tidak valid.");
  }

  const mimeType = match[1] as "image/png" | "image/jpeg";
  const extension = mimeType === "image/png" ? "png" : "jpg";
  const id = `${randomUUID()}.${extension}`;
  const path = join(assetDir, id);

  await mkdir(assetDir, { recursive: true });
  await writeFile(path, Buffer.from(match[2], "base64"));

  return {
    id,
    mimeType,
    path
  };
}

export async function readGeneratedImage(id: string) {
  if (!/^[a-f0-9-]+\.(png|jpg)$/.test(id)) {
    throw new Error("Asset id tidak valid.");
  }

  const mimeType = id.endsWith(".png") ? "image/png" : "image/jpeg";
  const bytes = await readFile(join(assetDir, id));

  return {
    bytes,
    mimeType
  };
}
