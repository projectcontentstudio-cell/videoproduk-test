import { StoryPageShell } from "@/components/StoryPageShell";
import { StoryRenderPanel } from "@/components/StoryRenderPanel";

export default function CeritaRenderPage() {
  return (
    <StoryPageShell
      eyebrow="Render"
      title="Gabungkan gambar dan suara."
      description="Render final guna method zoom/Ken Burns daripada gambar yang sudah dijana, tanpa panggil Veo."
    >
      <div className="max-w-2xl">
        <StoryRenderPanel />
      </div>
    </StoryPageShell>
  );
}
