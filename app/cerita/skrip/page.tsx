import { StoryPageShell } from "@/components/StoryPageShell";
import { StoryScriptEditor } from "@/components/StoryScriptEditor";

export default function CeritaSkripPage() {
  return (
    <StoryPageShell
      eyebrow="Skrip cerita"
      title="Semak 8 scene."
      description="Skrip boleh dijana semula percuma. Semak narration, subtitle dan prompt visual sebelum teruskan."
    >
      <StoryScriptEditor />
    </StoryPageShell>
  );
}
