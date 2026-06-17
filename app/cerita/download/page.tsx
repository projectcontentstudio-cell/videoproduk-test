import { StoryDownloadPanel } from "@/components/StoryDownloadPanel";
import { StoryPageShell } from "@/components/StoryPageShell";

export default function CeritaDownloadPage() {
  return (
    <StoryPageShell
      eyebrow="Download"
      title="Video cerita siap."
      description="Semak preview, download video jika sudah tersedia, dan salin caption atau hashtag."
    >
      <StoryDownloadPanel />
    </StoryPageShell>
  );
}
