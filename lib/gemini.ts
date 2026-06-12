import { getGoogleAccessToken } from "./google-auth";

export type GeneratedScript = {
  visual_method?: "problem_solution" | "showcase" | "demo" | "before_after" | "lifestyle_use";
  visual_method_reason?: string;
  hook: string;
  scene1_description: string;
  scene1_subtitle: string;
  scene1_video_script: string;
  scene1_video_prompt: string;
  scene2_description: string;
  scene2_subtitle: string;
  scene2_video_script: string;
  scene2_video_prompt: string;
  cta: string;
  caption: string;
  hashtags: string[];
};

export type GenerateScriptInput = {
  productName: string;
  productPrice?: string;
  style?: string;
  productImageBase64: string;
  productImageMimeType: "image/jpeg" | "image/png";
};

const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export const geminiSystemPrompt = `Kamu adalah AI Creative Director untuk TikTok Shop Malaysia.
Tugas kamu: hasilkan skrip video UGC dalam Bahasa Melayu informal
(guna: korang, aku, ni, tu, memang, kan).
Jangan formal. Jangan Indonesia. Bahasa Malaysia pasar yang sebenar.
Analisa gambar produk yang dihantar dan nama produk.
Hasilkan skrip yang spesifik untuk produk ini - bukan generic.
Flow sekarang hanya guna satu image. Jangan reka dua storyboard berasingan.
Gemini mesti pilih visual_method yang paling sesuai untuk produk, jangan paksa semua produk jadi problem-solution.
Pilihan method:
- problem_solution: untuk produk yang jelas selesaikan pain point, contoh kipas, cleaner, storage, alat dapur.
- showcase: untuk produk fesyen/aksesori/status, contoh baju, jam, beg cantik, kasut.
- demo: untuk produk perlu tunjuk cara guna, contoh gadget, blender, spray, tool.
- before_after: untuk produk yang ada transformasi jelas, contoh cleaner, skincare non-medical, organizer.
- lifestyle_use: untuk produk harian yang lebih sesuai tunjuk situasi guna natural.
Scene utama mesti ikut visual_method. Produk sebenar mesti ada dalam frame dan jelas.
Video akan bermula dari image itu dan character akan berinteraksi dengan produk ikut method yang dipilih.
Format output JSON sahaja - tiada teks lain.

JSON format:
{
  visual_method: "problem_solution" | "showcase" | "demo" | "before_after" | "lifestyle_use",
  visual_method_reason: string (short BM reason why this method suits the product),
  hook: string (max 10 words, grab attention, ada masalah relatable),
  scene1_description: string (describe the single image scene for image AI based on visual_method; product must be visible and clear in frame),
  scene1_subtitle: string (max 8 words shown on screen),
  scene1_video_script: string (natural Malay spoken dialogue for video scene 1, minimum 25 characters, max 18 words, based on visual_method),
  scene1_video_prompt: string (English Veo image-to-video prompt for the single image, must include the Malay spoken dialogue, visible lip movement, natural motion, 8 seconds, timing/action based on visual_method, no subtitles/text/logo),
  scene2_description: string (describe solution scene with product),
  scene2_subtitle: string (max 8 words shown on screen),
  scene2_video_script: string (natural Malay spoken dialogue for video scene 2, minimum 25 characters, max 18 words, based on the solution/product),
  scene2_video_prompt: string (English Veo image-to-video prompt for scene 2, must include the Malay spoken dialogue, visible lip movement, natural motion, 8 seconds, no subtitles/text/logo),
  cta: string (max 8 words, urgency),
  caption: string (2-3 sentences natural BM for TikTok post),
  hashtags: array of 5 strings
}`;

function getVertexGenerateContentUrl() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region = process.env.GOOGLE_CLOUD_REGION ?? "asia-southeast1";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${geminiModel}:generateContent`;
}

function isEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function parseJsonText(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned) as Partial<GeneratedScript>;
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

async function readVertexError(response: Response) {
  const text = await response.text();
  const compact = text.replace(/\s+/g, " ").trim();

  return compact ? ` ${compact.slice(0, 500)}` : "";
}

export function validateGeneratedScript(script: Partial<GeneratedScript>) {
  const allowedMethods = [
    "problem_solution",
    "showcase",
    "demo",
    "before_after",
    "lifestyle_use"
  ];

  if (
    !script.visual_method ||
    !allowedMethods.includes(script.visual_method)
  ) {
    script.visual_method = "problem_solution";
  }

  if (!script.visual_method_reason) {
    script.visual_method_reason = "Method ini dipilih berdasarkan jenis produk.";
  }

  if (!script.scene1_video_script && script.scene1_subtitle) {
    script.scene1_video_script = script.scene1_subtitle;
  }

  if (!script.scene2_video_script && script.scene2_subtitle) {
    script.scene2_video_script = script.scene2_subtitle;
  }

  if (!script.scene1_video_prompt && script.scene1_video_script) {
    script.scene1_video_prompt = `Create one 8-second vertical 9:16 image-to-video clip from this problem image. The main adult character says in Malay with visible lip movement: "${script.scene1_video_script}". Show natural small motion and matching frustrated expression. No subtitles, no on-screen text, no logo.`;
  }

  if (!script.scene2_video_prompt && script.scene2_video_script) {
    script.scene2_video_prompt = `Create one 8-second vertical 9:16 image-to-video clip from this solution image. The main adult character says in Malay with visible lip movement: "${script.scene2_video_script}". Show natural small motion, product demo action if relevant, and relieved expression. No subtitles, no on-screen text, no logo.`;
  }

  const requiredFields: Array<keyof GeneratedScript> = [
    "hook",
    "scene1_description",
    "scene1_subtitle",
    "scene1_video_script",
    "scene1_video_prompt",
    "scene2_description",
    "scene2_subtitle",
    "scene2_video_script",
    "scene2_video_prompt",
    "cta",
    "caption",
    "hashtags"
  ];

  for (const field of requiredFields) {
    if (!script[field]) {
      throw new Error(`Gemini tidak pulangkan field ${field}.`);
    }
  }

  if (!Array.isArray(script.hashtags) || script.hashtags.length !== 5) {
    throw new Error("Gemini mesti pulangkan 5 hashtags.");
  }

  if (countWords(script.hook as string) > 10) {
    throw new Error("Hook mesti maksimum 10 perkataan.");
  }

  if (countWords(script.scene1_subtitle as string) > 8) {
    throw new Error("Subtitle scene 1 mesti maksimum 8 perkataan.");
  }

  if (countWords(script.scene2_subtitle as string) > 8) {
    throw new Error("Subtitle scene 2 mesti maksimum 8 perkataan.");
  }

  if ((script.scene1_video_script as string).trim().length < 25) {
    throw new Error("Video script scene 1 mesti minimum 25 aksara.");
  }

  if ((script.scene2_video_script as string).trim().length < 25) {
    throw new Error("Video script scene 2 mesti minimum 25 aksara.");
  }

  if (countWords(script.scene1_video_script as string) > 18) {
    throw new Error("Video script scene 1 mesti maksimum 18 perkataan.");
  }

  if (countWords(script.scene2_video_script as string) > 18) {
    throw new Error("Video script scene 2 mesti maksimum 18 perkataan.");
  }

  if (countWords(script.cta as string) > 8) {
    throw new Error("CTA mesti maksimum 8 perkataan.");
  }

  return script as GeneratedScript;
}

export async function generateScriptWithGemini(input: GenerateScriptInput) {
  if (isEnabled(process.env.GEMINI_MOCK)) {
    return {
      hook: "Barang dapur korang selalu makan masa?",
      visual_method: "problem_solution",
      visual_method_reason: "Alat dapur sesuai tunjuk masalah kerja lambat lalu produk membantu.",
      scene1_description:
        "Close-up situasi dapur sibuk, tangan cuba potong bahan dengan pisau biasa, nampak lambat dan bersepah.",
      scene1_subtitle: "Potong bahan pun boleh lambat",
      scene1_video_script: "Aduh, lambatnya nak siap kalau buat macam ni.",
      scene1_video_prompt:
        'Create one 8-second vertical 9:16 image-to-video clip from this problem image. The adult character says in Malay with visible lip movement: "Aduh, lambatnya nak siap kalau buat macam ni." Show frustrated expression, small hand movement, and slight camera push-in. No subtitles, no on-screen text, no logo.',
      scene2_description: `Produk ${input.productName} di atas meja dapur, bahan masuk dan hasil potongan nampak kemas cepat.`,
      scene2_subtitle: "Ni terus siap cepat",
      scene2_video_script: "Ha, guna ni kerja terus jadi senang.",
      scene2_video_prompt:
        'Create one 8-second vertical 9:16 image-to-video clip from this solution image. The adult character says in Malay with visible lip movement: "Ha, guna ni kerja terus jadi senang." Show relieved happy expression, product demo motion, and slight camera push-in. No subtitles, no on-screen text, no logo.',
      cta: "Klik beg kuning sekarang!",
      caption: `${input.productName} ni memang sesuai kalau korang nak kerja dapur jadi cepat. Boleh check dekat beg kuning sekarang.`,
      hashtags: ["#TikTokShopMY", "#BarangDapur", "#RacunTikTok", "#ShopeeFindsMY", "#VideoProduk"]
    };
  }

  const response = await fetch(getVertexGenerateContentUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: geminiSystemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Nama produk: ${input.productName}\nStyle visual: ${
                input.style === "3d-character" ? "3D Cartoon" : "3D Cartoon"
              }\nHasilkan JSON skrip TikTok Shop Malaysia berdasarkan gambar produk ini. Scene dan video prompt mesti sesuai dengan style visual tersebut. Jangan masukkan harga dalam skrip, caption, image prompt, atau video prompt.`
            },
            {
              inlineData: {
                mimeType: input.productImageMimeType,
                data: input.productImageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.85,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Gemini gagal jana skrip. Status ${response.status}.${await readVertexError(
        response
      )}`
    );
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text || typeof text !== "string") {
    throw new Error("Gemini tidak pulangkan teks skrip.");
  }

  return validateGeneratedScript(parseJsonText(text));
}
