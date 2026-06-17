import { makeMockStoryScript } from "./story-types";
import type { StoryScript, StoryTypeId } from "./story-types";
import { storySceneDurationSeconds, storySceneLimit } from "./story-types";
import { getGoogleAccessToken } from "./google-auth";

function shouldMockStory() {
  return process.env.STORY_MOCK?.trim().toLowerCase() === "true";
}

function getVertexGenerateContentUrl(model: string, region?: string) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const activeRegion =
    region ||
    process.env.GEMINI_PROMPT_REGION ||
    process.env.GEMINI_IMAGE_REGION ||
    process.env.GOOGLE_CLOUD_REGION ||
    "us-central1";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return `https://${activeRegion}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${activeRegion}/publishers/google/models/${model}:generateContent`;
}

async function readGoogleError(response: Response) {
  const text = await response.text();
  const compact = text.replace(/\s+/g, " ").trim();

  return compact ? ` ${compact.slice(0, 900)}` : "";
}

function parseJsonText(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const jsonBlock = cleaned.slice(
    Math.max(0, cleaned.indexOf("{")),
    cleaned.lastIndexOf("}") + 1 || cleaned.length
  );
  const repaired = jsonBlock
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u0000-\u001f]+/g, " ");

  try {
    return JSON.parse(repaired) as StoryScript;
  } catch {
    throw new Error(
      "Gemini pulangkan JSON cerita yang tidak lengkap. Cuba jana semula."
    );
  }
}

function clampSceneDuration(value: unknown) {
  const duration = Number(value);

  if (!Number.isFinite(duration)) {
    return storySceneDurationSeconds;
  }

  return Math.min(6, Math.max(3, Math.round(duration)));
}

function clampNarrationForScene(value: unknown) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= 22) {
    return text;
  }

  return `${words.slice(0, 22).join(" ").replace(/[,.!?;:]$/, "")}.`;
}

function validateStoryScript(value: StoryScript): StoryScript {
  if (!value.title || !Array.isArray(value.scenes) || value.scenes.length < storySceneLimit) {
    throw new Error(`Gemini tidak pulangkan ${storySceneLimit} scene lengkap.`);
  }

  return {
    title: value.title,
    character_profile:
      String(
        value.character_profile ||
          "Same adult Malaysian main character, consistent face, hairstyle, outfit, body shape, and mood across all scenes."
      )
        .trim()
        .slice(0, 500),
    scenes: value.scenes.slice(0, storySceneLimit).map((scene, index) => {
      const narration = clampNarrationForScene(scene.narration);

      return {
        scene_number: index + 1,
        image_prompt: [
        "Maintain exact same character identity across all scenes. If there are two characters, keep both characters consistent.",
        `Visual direction must match this exact spoken dialogue for this scene: "${narration}"`,
        "Show the character emotion, pose, eye direction, hand gesture, and scene action that directly fits the dialogue. Do not create a generic unrelated scene.",
        String(
          value.character_profile ||
            "Adult Malaysian main character, consistent face, hairstyle, outfit, body shape, and color palette."
        ).trim(),
        String(scene.image_prompt || "").trim()
      ].join(" "),
        narration,
        subtitle: String(scene.subtitle || "").trim().slice(0, 80),
        duration: clampSceneDuration(scene.duration)
      };
    }),
    caption: String(value.caption || "").trim(),
    hashtags: Array.isArray(value.hashtags)
      ? value.hashtags.map(String).slice(0, 5)
      : ["#VideoCerita"]
  };
}

const storyResponseSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    character_profile: { type: "STRING" },
    scenes: {
      type: "ARRAY",
      minItems: storySceneLimit,
      maxItems: storySceneLimit,
      items: {
        type: "OBJECT",
        properties: {
          scene_number: { type: "NUMBER" },
          image_prompt: { type: "STRING" },
          narration: { type: "STRING" },
          subtitle: { type: "STRING" },
          duration: { type: "NUMBER" }
        },
        required: ["scene_number", "image_prompt", "narration", "subtitle", "duration"]
      }
    },
    caption: { type: "STRING" },
    hashtags: {
      type: "ARRAY",
      items: { type: "STRING" }
    }
  },
  required: ["title", "character_profile", "scenes", "caption", "hashtags"]
};

const storySuggestionsResponseSchema = {
  type: "OBJECT",
  properties: {
    suggestions: {
      type: "ARRAY",
      minItems: 5,
      maxItems: 8,
      items: { type: "STRING" }
    }
  },
  required: ["suggestions"]
};

function makeStorySystemPrompt(retry = false) {
  const base = `Kamu penulis skrip video TikTok Malaysia.
Tulis Bahasa Melayu informal Malaysia (korang, aku, ni, tu, memang, kan), bukan Indonesia.
Buat tepat ${storySceneLimit} scene. Setiap scene duration antara 3 hingga 6 saat sahaja.
Setiap scene perlu ada image_prompt English, narration BM 10-18 patah perkataan, subtitle max 6 patah perkataan.
Narration/dialog mesti boleh disebut dalam 3-6 saat, ideal 4-5 saat. Jangan terlalu panjang dan jangan terlalu pendek.
PENTING: image_prompt mesti jadi visual direction untuk dialog scene itu. Apa yang watak cakap dalam narration mesti nampak jelas dalam aksi, pose, emosi, ekspresi muka, eye direction, dan props dalam image_prompt.
Jangan tulis image_prompt generic. Setiap image_prompt mesti sebut tindakan spesifik yang matching dengan narration/dialog scene tersebut.
Struktur 8 scene: hook kuat, problem emosi, deeper context, first lesson, tension, turning point, stoic lesson, closing/shareable ending.

Watak konsisten:
1. Semak topik dahulu.
2. Jika topik ialah public figure/tokoh terkenal dewasa seperti Elon Musk, Steve Jobs, Bill Gates, selebriti, ahli politik, atau founder syarikat, character_profile mesti jadi recognizable stylized 3D cartoon version of that exact public figure. Guna ciri wajah, usia, rambut, pakaian, dan vibe yang orang mudah kenal. Jangan photorealistic deepfake.
3. Untuk public figure, setiap image_prompt mesti jadikan tokoh itu character utama. Jangan guna narrator/witness random.
4. Jika topik bukan manusia terkenal, cipta satu narrator/witness dewasa yang konsisten.
5. Setiap image_prompt mesti ulang exact same character_profile dan jangan tukar muka, baju, umur, gender, hairstyle/hijab, atau style.

Visual mesti sangat relate dengan topik user. Jangan scene generic. Untuk MH370 contoh visual: airport departure hall, airplane silhouette, radar control room, ocean search, map/search area, family waiting, newsroom investigation wall. Untuk seram/misteri guna lokasi dan petunjuk spesifik. Untuk motivasi guna journey jelas.`;

  const stoicDialog = `

Arahan khas jika Story type ialah stoic-dialog:
- Ini mesti jadi video dialog stoic 60s style dengan dua watak dewasa konsisten, sesuai untuk TikTok/Reels motivational storytelling.
- Jangan copy exact style, script, slogan, atau identity mana-mana creator/channel. Ambil hanya prinsip genre: emotional question, calm stoic answer, cinematic tension, short powerful lesson, reflective ending.
- Visual style wajib: 2D animated relationship-advice cartoon, clean bold black outlines, flat colors, simple shaded comic look, expressive faces, YouTube story animation thumbnail vibe, not 3D, not photorealistic, not anime realism.
- Mood: serious relationship advice, emotional tension, slow reflective pacing, focus pada pain, self-control, silence, discipline, detachment, dignity, boundaries, and self-respect.
- Watak lelaki: male stoic mentor, calm, composed, emotionally controlled, wise eyes, simple dark outfit, confident but gentle.
- Watak perempuan: female emotional seeker, expressive, anxious/sad/overthinking, soft outfit, vulnerable but strong.
- character_profile mesti describe kedua-dua watak secara spesifik dan minta kedua-duanya kekal sama dalam semua scene.
- Setiap image_prompt mesti ada kedua-dua watak dalam scene yang sama kecuali sangat perlu.
- Setiap image_prompt stoic-dialog mesti ulang visual style 2D animated relationship-advice cartoon dengan bold outline dan flat color.
- Narration mesti format dialog dua suara pendek, contohnya "Perempuan: ... Lelaki: ..."
- Total dialog satu scene mesti 10-18 patah perkataan sahaja dan boleh disebut dalam 3-6 saat.
- Setiap scene cuma satu short exchange. Jangan buat dialog panjang.
- Kedua-dua watak perlu bercakap ringkas dalam setiap scene atau bergilir dengan jelas, tetapi jangan melebihi 6 saat.
- Lelaki beri jawapan stoic yang tenang. Perempuan buka dengan emosi/soalan/sakit hati.
- Dialog lelaki mesti pendek tapi deep, tidak cringe. Dialog perempuan mesti emotional dan relatable.
- image_prompt stoic-dialog mesti tunjuk siapa sedang bercakap, siapa mendengar, dan emosi yang tepat mengikut dialog scene itu.
- Ending mesti terasa seperti quote stoic yang boleh buat penonton save/share.
- Jangan guna public figure. Jangan guna tokoh terkenal. Jangan jadikan satu narrator sahaja.
- Topik perlu jadi konflik emosi harian: berharap pada orang, patah hati, dihina, anxiety, gagal, cemburu, kehilangan, rasa tak cukup baik.`;

  if (!retry) {
    return `${base}${stoicDialog}

Pulangkan JSON sahaja ikut schema. Jangan markdown. Jangan tambah explanation.`;
  }

  return `${base}${stoicDialog}

Ini retry kerana JSON sebelum ini rosak. Pulangkan JSON compact sahaja. Jangan ayat luar JSON. Pastikan scenes tepat ${storySceneLimit} item dan semua string ditutup dengan betul.`;
}

export async function generateStorySuggestions(params: {
  storyType: StoryTypeId;
  currentTopic?: string;
}) {
  const fallback: Record<StoryTypeId, string[]> = {
    fakta: [
      "Misteri kehilangan MH370",
      "Kenapa Titanic tenggelam walaupun dikatakan mustahil",
      "Rahsia Piramid Mesir yang masih jadi tanda tanya",
      "Kisah benar letupan Chernobyl",
      "Bagaimana telefon pintar mengubah dunia"
    ],
    seram: [
      "Rumah lama yang lampunya menyala sendiri",
      "Lif kosong yang berhenti di tingkat terlarang",
      "Suara misteri dari bilik sebelah",
      "Kampung sunyi selepas tengah malam",
      "Rakaman CCTV yang tidak patut wujud"
    ],
    motivasi: [
      "Pelajar biasa yang ubah hidup dengan disiplin kecil",
      "Peniaga kecil yang mula semula selepas rugi besar",
      "Kenapa gagal sekali bukan bermaksud tamat",
      "Cara bangkit bila semua orang tidak percaya",
      "Kisah orang biasa yang menang sebab konsisten"
    ],
    "stoic-dialog": [
      "Bila hati terlalu berharap pada orang",
      "Bila dia pergi tanpa penjelasan",
      "Bila orang hina kita tapi kita pilih diam",
      "Bila rasa tak cukup baik untuk sesiapa",
      "Bila anxiety buat kita takut mula semula"
    ],
    islamic: [
      "Kisah Nabi Musa AS berdepan Firaun",
      "Pengajaran dari kisah Ashabul Kahfi",
      "Kisah Nabi Yunus AS dalam perut ikan",
      "Kenapa sabar itu kekuatan besar",
      "Kisah taubat yang memberi harapan"
    ],
    "kisah-benar": [
      "Mangsa scam online hilang RM50k",
      "Pekerja biasa jumpa rahsia besar syarikat",
      "Kisah pemandu e-hailing bantu penumpang cemas",
      "Ibu tunggal bina hidup semula dari kosong",
      "Kisah benar orang hilang yang akhirnya ditemui"
    ]
  };

  if (shouldMockStory()) {
    return fallback[params.storyType] || fallback.fakta;
  }

  const model = process.env.GEMINI_PROMPT_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(getVertexGenerateContentUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: `Kamu strategist content TikTok Malaysia. Cadangkan topik video cerita yang senang viral dan jelas untuk dijadikan 8 scene / 40 saat.
Bahasa Melayu informal Malaysia. Pulangkan JSON sahaja.
Jika storyType ialah stoic-dialog, cadangan mesti tentang konflik emosi harian yang sesuai untuk dua watak: male stoic mentor dan female emotional seeker. Vibe genre stoic motivational dialogue, bukan copy exact creator/channel.`
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
      text: `storyType: ${params.storyType}\nCurrent typed topic: ${params.currentTopic || "-"}\nGive 6 concise topic suggestions for an 8-scene 40-second story, max 70 characters each.`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
        responseSchema: storySuggestionsResponseSchema
      }
    })
  });

  if (!response.ok) {
    return fallback[params.storyType] || fallback.fakta;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return fallback[params.storyType] || fallback.fakta;
  }

  try {
    const parsed = JSON.parse(text) as { suggestions?: string[] };
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];

    return suggestions.length ? suggestions : fallback[params.storyType] || fallback.fakta;
  } catch {
    return fallback[params.storyType] || fallback.fakta;
  }
}

export async function generateStoryScript(params: {
  storyType: StoryTypeId;
  topic: string;
}): Promise<StoryScript> {
  if (shouldMockStory()) {
    return makeMockStoryScript(params.storyType, params.topic);
  }

  const model = process.env.GEMINI_PROMPT_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";

  async function requestStory(retry = false) {
    const response = await fetch(getVertexGenerateContentUrl(model), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getGoogleAccessToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: makeStorySystemPrompt(retry) }]
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Story type: ${params.storyType}\nTopic: ${params.topic}\nReturn exactly ${storySceneLimit} scenes. If story type is stoic-dialog, use two consistent speaking characters: male stoic and female emotional.`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: retry ? 0.35 : 0.65,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: storyResponseSchema
        }
      })
    });

    if (!response.ok) {
      throw new Error(
        `Gemini gagal jana cerita. Status ${response.status}.${await readGoogleError(response)}`
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini tidak pulangkan skrip cerita.");
    }

    return validateStoryScript(parseJsonText(text));
  }

  try {
    return await requestStory(false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (
      message.includes("JSON cerita") ||
      message.includes("scene lengkap") ||
      message.includes("tidak pulangkan skrip")
    ) {
      return requestStory(true);
    }

    throw error;
  }
}

export async function generateStoryImageWithGemini(prompt: string) {
  return generateStoryImageWithGeminiReference(prompt);
}

async function imageUrlToInlineData(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);

    if (!match) {
      throw new Error("Reference image tidak valid.");
    }

    return {
      mimeType: match[1] === "image/jpg" ? "image/jpeg" : match[1],
      data: match[2]
    };
  }

  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
    throw new Error("Reference image mesti data URL, http, atau https.");
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Reference image gagal dibaca. Status ${response.status}.`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0];

  if (mimeType !== "image/png" && mimeType !== "image/jpeg" && mimeType !== "image/webp") {
    throw new Error("Reference image bukan PNG, JPEG, atau WEBP.");
  }

  return {
    mimeType,
    data: Buffer.from(await response.arrayBuffer()).toString("base64")
  };
}

export async function generateStoryImageWithGeminiReference(
  prompt: string,
  masterCharacterImageUrl?: string
) {
  if (shouldMockStory()) {
    return makeStoryImageDataUrl("Story mock", prompt);
  }

  const primaryModel =
    process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const fallbackModel =
    process.env.GEMINI_IMAGE_FALLBACK_MODEL && process.env.GEMINI_IMAGE_FALLBACK_MODEL !== primaryModel
      ? process.env.GEMINI_IMAGE_FALLBACK_MODEL
      : "";

  async function call(model: string) {
    const masterImage = masterCharacterImageUrl
      ? await imageUrlToInlineData(masterCharacterImageUrl)
      : null;
    const response = await fetch(
      getVertexGenerateContentUrl(
        model,
        process.env.GEMINI_IMAGE_REGION || process.env.GOOGLE_CLOUD_REGION || "us-central1"
      ),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getGoogleAccessToken()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: [
                    masterImage
                      ? "Use the attached reference image as the master character identity. Preserve the exact same face, age, gender, hairstyle or hijab, outfit, body shape, color palette, and visual style. Only change the scene action, pose, camera angle, and background required by the prompt."
                      : "Create the master character image for this story.",
                    prompt,
                    "If the story topic is about a famous adult public figure, the main character must be a recognizable stylized 3D cartoon version of that public figure, not a random narrator. Keep it clearly cartoon and non-photorealistic.",
                    "Create one vertical 9:16 image. No text, no subtitles, no logo, no watermark."
                  ].join("\n\n")
                },
                ...(masterImage
                  ? [
                      {
                        inlineData: masterImage
                      }
                    ]
                  : [])
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            temperature: 0.55,
            imageConfig: {
              aspectRatio: "9:16"
            }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gemini image gagal. Status ${response.status} (${model}).${await readGoogleError(response)}`
      );
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (part: { inlineData?: { data?: string; mimeType?: string } }) =>
        part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
      throw new Error("Gemini image tidak pulangkan image.");
    }

    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
  }

  try {
    return await call(primaryModel);
  } catch (error) {
    if (fallbackModel) {
      return call(fallbackModel);
    }

    throw error;
  }
}

export function makeStoryImageDataUrl(label: string, prompt: string) {
  const safeLabel = label.replace(/[<>&]/g, "");
  const safePrompt = prompt.replace(/[<>&]/g, "").slice(0, 140);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071016"/><stop offset="0.55" stop-color="#10213a"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs>
<rect width="720" height="1280" fill="url(#g)"/>
<circle cx="560" cy="230" r="130" fill="#2dd4bf" opacity="0.16"/>
<circle cx="120" cy="1020" r="190" fill="#38bdf8" opacity="0.12"/>
<rect x="58" y="86" width="604" height="1108" rx="36" fill="#020617" opacity="0.44" stroke="#2dd4bf" stroke-width="3"/>
<text x="92" y="160" fill="#2dd4bf" font-family="Arial" font-size="30" font-weight="700">${safeLabel}</text>
<text x="92" y="250" fill="#ffffff" font-family="Arial" font-size="42" font-weight="800">Video Cerita</text>
<foreignObject x="92" y="320" width="540" height="460"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial;color:white;font-size:30px;line-height:1.35;font-weight:700;">${safePrompt}</div></foreignObject>
<text x="92" y="1120" fill="#cbd5e1" font-family="Arial" font-size="24">Preview mock tanpa guna credit</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
