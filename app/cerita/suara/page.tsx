import { StoryPageShell } from "@/components/StoryPageShell";
import { StoryVoiceSelector } from "@/components/StoryVoiceSelector";

export default function CeritaSuaraPage() {
  return (
    <StoryPageShell
      eyebrow="Suara narator"
      title="Pilih suara."
      description="Pilih suara yang sesuai dengan mood cerita sebelum render video akhir."
    >
      <StoryVoiceSelector />
    </StoryPageShell>
  );
}
