"use client";

const dbName = "videoproduk_video_store";
const storeName = "videos";

function openVideoDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeVideoDataUrl(dataUrl: string) {
  const db = await openVideoDb();
  const key = `video-${Date.now()}-${crypto.randomUUID()}`;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(dataUrl, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  return key;
}

export async function readVideoDataUrl(key: string) {
  const db = await openVideoDb();
  const value = await new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);

    request.onsuccess = () =>
      resolve(typeof request.result === "string" ? request.result : undefined);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return value;
}
