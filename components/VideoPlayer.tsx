"use client";

type VideoPlayerProps = {
  videoUrl?: string;
  watermarked?: boolean;
};

export function VideoPlayer({ videoUrl, watermarked }: VideoPlayerProps) {
  const isPlayable = Boolean(
    videoUrl?.startsWith("http") ||
      videoUrl?.startsWith("/") ||
      videoUrl?.startsWith("data:video")
  );

  if (!isPlayable) {
    return (
      <div className="mx-auto flex aspect-[9/16] w-full max-w-[22rem] items-center justify-center rounded-2xl border border-border bg-surface p-5 text-center">
        <div>
          <p className="text-lg font-black text-white">Preview video final</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Video MP4 sebenar akan muncul di sini selepas render siap.
          </p>
          {watermarked ? (
            <p className="mt-4 text-sm font-bold text-primary">
              Free tier: watermark aktif.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[22rem] overflow-hidden rounded-2xl border border-border bg-black">
      <video
        src={videoUrl}
        controls
        playsInline
        className="aspect-[9/16] max-h-[72vh] w-full bg-black object-contain"
      />
    </div>
  );
}
