"use client";

export const videoLibraryKey = "videoproduk_video_library_v1";

export type VideoLibraryItem = {
  id: string;
  title: string;
  type: "story" | "product";
  videoUrl: string;
  videoMimeType: string;
  videoSize?: number;
  caption?: string;
  hashtags?: string[];
  storage?: "gcs" | "local" | "browser";
  gcsUri?: string;
  createdAt: number;
};

function readLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(videoLibraryKey) || "[]");

    return Array.isArray(parsed) ? (parsed as VideoLibraryItem[]) : [];
  } catch {
    return [];
  }
}

export function getVideoLibrary() {
  return readLibrary().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveVideoLibraryItem(item: Omit<VideoLibraryItem, "id" | "createdAt">) {
  const current = readLibrary();
  const next: VideoLibraryItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now()
  };
  const deduped = current.filter((video) => video.videoUrl !== item.videoUrl);

  localStorage.setItem(
    videoLibraryKey,
    JSON.stringify([next, ...deduped].slice(0, 50))
  );

  return next;
}

export function removeVideoLibraryItem(id: string) {
  const next = readLibrary().filter((item) => item.id !== id);

  localStorage.setItem(videoLibraryKey, JSON.stringify(next));
  return next;
}
