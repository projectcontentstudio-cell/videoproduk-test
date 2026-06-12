"use client";

const usageKey = "videoproduk_usage_v1";
const betaVideoCreditsKey = "videoproduk_beta_video_credits";

export type UsageSnapshot = {
  imageCount: number;
  videoCount: number;
  videoCredits: number;
};

function readNumber(key: string, fallback = 0) {
  const value = Number(localStorage.getItem(key) || fallback);

  return Number.isFinite(value) ? value : fallback;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readUsageRecord() {
  const today = getTodayKey();
  const stored = localStorage.getItem(usageKey);

  if (!stored) {
    return { day: today, imageCount: 0, videoCount: 0 };
  }

  try {
    const parsed = JSON.parse(stored) as {
      day?: string;
      imageCount?: number;
      videoCount?: number;
    };

    if (parsed.day !== today) {
      return { day: today, imageCount: 0, videoCount: 0 };
    }

    return {
      day: today,
      imageCount: Number(parsed.imageCount || 0),
      videoCount: Number(parsed.videoCount || 0)
    };
  } catch {
    return { day: today, imageCount: 0, videoCount: 0 };
  }
}

function writeUsageRecord(record: {
  day: string;
  imageCount: number;
  videoCount: number;
}) {
  localStorage.setItem(usageKey, JSON.stringify(record));
}

export function ensureBetaVideoCredits() {
  if (localStorage.getItem(betaVideoCreditsKey) === null) {
    localStorage.setItem(betaVideoCreditsKey, "3");
  }
}

export function getUsageSnapshot(): UsageSnapshot {
  ensureBetaVideoCredits();
  const usage = readUsageRecord();

  return {
    imageCount: usage.imageCount,
    videoCount: usage.videoCount,
    videoCredits: readNumber(betaVideoCreditsKey, 0)
  };
}

export function trackImageGeneration() {
  const usage = readUsageRecord();
  const next = {
    ...usage,
    imageCount: usage.imageCount + 1
  };

  writeUsageRecord(next);

  return getUsageSnapshot();
}

export function canStartVideoGeneration() {
  return getUsageSnapshot().videoCredits > 0;
}

export function trackSuccessfulVideoGeneration() {
  ensureBetaVideoCredits();
  const usage = readUsageRecord();
  const credits = Math.max(0, readNumber(betaVideoCreditsKey, 0) - 1);

  localStorage.setItem(betaVideoCreditsKey, String(credits));
  writeUsageRecord({
    ...usage,
    videoCount: usage.videoCount + 1
  });

  return getUsageSnapshot();
}

