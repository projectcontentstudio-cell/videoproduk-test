import { StoryImageGrid } from "@/components/StoryImageGrid";
import { StoryPageShell } from "@/components/StoryPageShell";

export default function CeritaGambarPage() {
  return (
    <StoryPageShell
      eyebrow="Gambar cerita"
      title="Jana 8 image scene."
      description="Gambar dijana berdasarkan prompt setiap scene. 8 image ini akan jadi asas video zoom 40 saat."
    >
      <StoryImageGrid />
    </StoryPageShell>
  );
}
