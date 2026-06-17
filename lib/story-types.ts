export type StoryTypeId =
  | "fakta"
  | "seram"
  | "motivasi"
  | "stoic-dialog"
  | "islamic"
  | "kisah-benar";

export type StoryScene = {
  scene_number: number;
  image_prompt: string;
  narration: string;
  subtitle: string;
  duration: number;
  imageUrl?: string;
};

export type StoryScript = {
  title: string;
  character_profile?: string;
  scenes: StoryScene[];
  caption: string;
  hashtags: string[];
};

export const storySceneLimit = 8;
export const storySceneDurationSeconds = 5;

export type StoryStyleId =
  | "realistik"
  | "sinematik-3d"
  | "gelap-misteri"
  | "ilustrasi";

export type StoryVoiceId = "wanita" | "lelaki" | "neutral";

export const storyTypes: Array<{
  id: StoryTypeId;
  label: string;
  icon: string;
  example: string;
  placeholder: string;
}> = [
  {
    id: "fakta",
    label: "Fakta & Sejarah",
    icon: "Book",
    example: "Misteri kehilangan MH370",
    placeholder: "cth: Misteri kehilangan MH370"
  },
  {
    id: "seram",
    label: "Seram & Misteri",
    icon: "Ghost",
    example: "Hantu paling ditakuti Malaysia",
    placeholder: "cth: Hantu paling ditakuti Malaysia"
  },
  {
    id: "motivasi",
    label: "Motivasi",
    icon: "Flame",
    example: "Kisah Elon Musk dari miskin",
    placeholder: "cth: Kisah Elon Musk dari miskin"
  },
  {
    id: "stoic-dialog",
    label: "Stoic Dialog",
    icon: "Dialog",
    example: "Bila hati terlalu berharap pada orang",
    placeholder: "cth: Bila hati terlalu berharap pada orang"
  },
  {
    id: "islamic",
    label: "Islamic",
    icon: "Moon",
    example: "Kisah Nabi Musa AS",
    placeholder: "cth: Kisah Nabi Musa AS"
  },
  {
    id: "kisah-benar",
    label: "Kisah Benar",
    icon: "Story",
    example: "Mangsa penipuan online RM50k",
    placeholder: "cth: Mangsa penipuan online RM50k"
  }
];

export const storyStyles: Array<{
  id: StoryStyleId;
  label: string;
  sample: string;
  style_prompt: string;
}> = [
  {
    id: "realistik",
    label: "Realistik",
    sample: "Natural cinematic photo",
    style_prompt:
      "photorealistic, cinematic photography, natural lighting, high detail, 8K quality, sharp focus, professional camera"
  },
  {
    id: "sinematik-3d",
    label: "Sinematik 3D",
    sample: "Warm 3D cinematic render",
    style_prompt:
      "3D render, cinematic, warm color grading, Pixar style quality, volumetric lighting, smooth textures, dramatic composition"
  },
  {
    id: "gelap-misteri",
    label: "Gelap & Misteri",
    sample: "Dark moody mystery",
    style_prompt:
      "dark moody atmosphere, dramatic shadows, horror aesthetic, deep contrast, fog effect, ominous lighting, eerie atmosphere"
  },
  {
    id: "ilustrasi",
    label: "Ilustrasi",
    sample: "Painterly concept art",
    style_prompt:
      "digital illustration, artistic painterly style, detailed brushwork, vibrant colors, concept art quality, stylized"
  }
];

export const storyVoices: Array<{
  id: StoryVoiceId;
  label: string;
  detail: string;
  voiceName: "Aoede" | "Charon" | "Kore";
}> = [
  {
    id: "wanita",
    label: "Wanita Melayu",
    detail: "Warm, friendly tone",
    voiceName: "Aoede"
  },
  {
    id: "lelaki",
    label: "Lelaki Melayu",
    detail: "Deep, authoritative tone",
    voiceName: "Charon"
  },
  {
    id: "neutral",
    label: "Neutral",
    detail: "Clean, clear narration",
    voiceName: "Kore"
  }
];

export const storyStorageKeys = {
  type: "videoproduk_story_type",
  topic: "videoproduk_story_topic",
  script: "videoproduk_story_script",
  style: "videoproduk_story_style",
  stylePrompt: "videoproduk_story_style_prompt",
  images: "videoproduk_story_images",
  voice: "videoproduk_story_voice",
  render: "videoproduk_story_render"
} as const;

export const storyGeneratedStorageKeys = [
  storyStorageKeys.topic,
  storyStorageKeys.script,
  storyStorageKeys.style,
  storyStorageKeys.stylePrompt,
  storyStorageKeys.images,
  storyStorageKeys.voice,
  storyStorageKeys.render
] as const;

export function getStoryType(id?: string | null) {
  return storyTypes.find((type) => type.id === id) || storyTypes[0];
}

export function getStoryStyle(id?: string | null) {
  return storyStyles.find((style) => style.id === id) || storyStyles[0];
}

export function getStoryVoice(id?: string | null) {
  return storyVoices.find((voice) => voice.id === id) || storyVoices[0];
}

export function makeMockStoryScript(type: StoryTypeId, topic: string): StoryScript {
  const cleanTopic = topic.trim() || getStoryType(type).example;
  const scenes = Array.from({ length: storySceneLimit }, (_, index) => {
    const number = index + 1;
    const phase =
      number <= 2
        ? "shocking hook"
        : number <= 5
          ? "background setup"
          : number <= 10
            ? "rising tension"
            : number <= 15
              ? "story climax"
              : number <= 19
                ? "reveal and twist"
                : number <= 22
                  ? "resolution"
                  : "closing follow prompt";

    return {
      scene_number: number,
      image_prompt: `Vertical 9:16 cinematic story scene about ${cleanTopic}, scene ${number}, ${phase}, Malaysian TikTok documentary style, detailed environment, expressive adult subject, cinematic composition, dramatic lighting`,
      narration:
        number === storySceneLimit
          ? "Kalau korang nak lagi cerita macam ni, follow dulu."
          : `Scene ${number}, kisah ${cleanTopic} ni makin pelik sebenarnya.`,
      subtitle:
        number === storySceneLimit
          ? "Follow untuk cerita lagi"
          : number <= 2
            ? "Apa sebenarnya berlaku?"
            : "Cerita makin pelik",
      duration: storySceneDurationSeconds
    };
  });

  return {
    title: cleanTopic,
    character_profile:
      "Same main character across all scenes: adult Malaysian narrator, warm expressive face, consistent hairstyle, outfit, body shape, and color palette.",
    scenes,
    caption: `${cleanTopic} ni memang buat orang tertanya-tanya. Simpan video ni kalau nak ulang tengok.`,
    hashtags: ["#CeritaMalaysia", "#FaktaMenarik", "#VideoCerita", "#TikTokMalaysia", "#KisahViral"]
  };
}
