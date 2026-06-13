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
  productAnalysis?: string;
  characterGender?: "auto" | "male" | "female";
};

const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export const geminiSystemPrompt = `Kamu adalah AI Creative Director untuk TikTok Shop Malaysia.
Tugas kamu: hasilkan skrip video UGC dalam Bahasa Melayu informal
(guna: korang, aku, ni, tu, memang, kan).
Jangan formal. Jangan Indonesia. Bahasa Malaysia pasar yang sebenar.
Analisa gambar produk yang dihantar dan nama produk.
Jika ada "Fakta produk daripada semakan upload", jadikan fakta itu sebagai constraint keras. Jangan tambah ciri yang bercanggah. Contoh: jika fakta kata portable/rechargeable/no visible cable, jangan tambah kabel, plug, wall power, atau versi wired dalam scene, image prompt, atau video prompt.
Hasilkan skrip yang spesifik untuk produk ini - bukan generic.
Flow sekarang hanya guna satu image. Jangan reka dua storyboard berasingan.
Style visual dipilih oleh user:
- 3D Cartoon: scene dan video prompt mesti guna polished 3D cartoon/ad style.
- Realistic UGC: scene dan video prompt mesti guna realistic Malaysian UGC/social commerce style, natural phone-camera look, adult human creator/seller, bukan 3D, bukan cartoon.
Flow, rules, dialog, CTA dan struktur output kekal sama untuk semua style.
Jika user pilih watak lelaki/perempuan, semua scene, image prompt, video prompt, dialog, dan sambungan video mesti kekalkan gender itu. Jangan tukar gender antara base dan sambungan. Jika Auto, pilih watak dewasa yang paling sesuai dengan produk.
Gemini mesti pilih visual_method yang paling sesuai untuk produk, jangan paksa semua produk jadi problem-solution.
Pilihan method:
- problem_solution: untuk produk yang jelas selesaikan pain point, contoh kipas, cleaner, storage, alat dapur.
- showcase: untuk produk fesyen/aksesori/status, contoh baju, jam, beg cantik, kasut.
- demo: untuk produk perlu tunjuk cara guna, contoh gadget, blender, spray, tool.
- before_after: untuk produk yang ada transformasi jelas, contoh cleaner, skincare non-medical, organizer.
- lifestyle_use: untuk produk harian yang lebih sesuai tunjuk situasi guna natural.
Scene utama mesti ikut visual_method. Produk sebenar mesti ada dalam frame dan jelas.
Video final sekarang sekitar 16 saat: sistem jana base 8 saat dari image, kemudian sambung video dengan Veo extend. Scene1 video prompt ialah arahan base 8 saat. Scene2 video prompt mesti ditulis sebagai continuation prompt dari final frame scene1, bukan image baru.
Scene2 tidak boleh ulang scene1. Scene1 = setup/intro/pain/notice product. Scene2 = sambungan aksi produk/benefit/result/close-up. Jika scene2 sama maksud dengan scene1, output dianggap gagal.
Video akan bermula dari image itu dan character akan berinteraksi dengan produk ikut method yang dipilih.
Veo safety rule: jangan masukkan baby, kanak-kanak, toddler, minor, atau muka child dalam image/video prompt. Untuk produk baby/kids, guna adult caregiver sahaja, prop seperti bowl/beg/mainan boleh ada, tapi tiada child face/body sebagai watak utama.
Dialog wajib: Gemini mesti cipta dialog Bahasa Melayu yang natural dan cukup untuk video 8 saat setiap clip. Jangan buat video silent. Dialog base dan dialog sambungan mesti berbeza. Setiap scene*_video_prompt mesti mengandungi exact dialogue line, perkataan speak/says, visible lip movement, mouth movement, dan arahan action yang sesuai dengan visual_method.
Video prompt wajib lengkap seperti prompt production, bukan ayat pendek. Wajib nyatakan: watak utama, lokasi, emosi, aksi tangan/badan, produk jelas dalam frame, apa character buat terhadap produk, timing/motion 8 saat untuk scene1, dan no subtitles/no text/no logo. Contoh style: "A 3D cartoon female character is sitting at a desk in a brightly lit room, fanning herself vigorously with her hand, sweating visibly..., a dark blue portable mini fan matching the product image is clearly visible on the desk..., she looks at the fan with hope. The character speaks/says, \"...\" Visible lip movement, mouth movement, natural motion for 8 seconds. No subtitles, no text, no logo."
Format output JSON sahaja - tiada teks lain.

JSON format:
{
  visual_method: "problem_solution" | "showcase" | "demo" | "before_after" | "lifestyle_use",
  visual_method_reason: string (short BM reason why this method suits the product),
  hook: string (max 10 words, grab attention, ada masalah relatable),
  scene1_description: string (describe the single image scene for image AI based on visual_method; product must be visible and clear in frame),
  scene1_subtitle: string (max 8 words shown on screen),
  scene1_video_script: string (natural Malay spoken dialogue for base video, minimum 35 characters, max 28 words, based on visual_method),
  scene1_video_prompt: string (long English Veo image-to-video production prompt for the single image, must include character, location, emotion, product clearly visible, product-specific action, the Malay spoken dialogue, visible lip movement, mouth movement, natural motion for 8 seconds, no subtitles/text/logo),
  scene2_description: string (describe continuation/product-result scene; must not repeat scene1_description),
  scene2_subtitle: string (max 8 words shown on screen),
  scene2_video_script: string (natural Malay spoken dialogue for continuation video, minimum 35 characters, max 28 words, different from scene1_video_script, based on the product result/benefit),
  scene2_video_prompt: string (long English Veo extend-video continuation prompt from the final frame of base video, must continue same character/product/location/style, include product-specific demo/benefit action, say exactly what changes in the continuation, include the Malay spoken dialogue, visible lip movement, mouth movement, natural motion, no subtitles/text/logo),
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

function hasSpeechInstruction(prompt: string, dialogueLine: string) {
  const source = prompt.toLowerCase();
  const dialogue = dialogueLine.trim().toLowerCase();

  return (
    dialogue.length >= 25 &&
    source.includes(dialogue) &&
    /\b(speak|speaks|says|say|dialogue|spoken)\b/i.test(prompt) &&
    /lip movement|mouth movement|mouth visibly move/i.test(prompt)
  );
}

function normalizeForCompare(value?: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTooSimilar(first?: string, second?: string) {
  const a = normalizeForCompare(first);
  const b = normalizeForCompare(second);

  if (!a || !b) {
    return false;
  }

  return a === b || a.includes(b) || b.includes(a);
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

  if (!script.scene1_video_prompt && script.scene1_video_script) {
    script.scene1_video_prompt = `Create one 8-second vertical 9:16 image-to-video clip from this problem image. The main adult character says in Malay with visible lip movement: "${script.scene1_video_script}". Show natural small motion and matching frustrated expression. No subtitles, no on-screen text, no logo.`;
  }

  if (!script.scene2_video_prompt && script.scene2_video_script) {
    script.scene2_video_prompt = `Continue this exact vertical 9:16 product video from the final frame into the solution or product demo moment. Keep the same adult character, same product, same location, same lighting, and same camera style. The main adult character says in Malay with visible lip movement: "${script.scene2_video_script}". Show natural product interaction, clear benefit, relieved expression, and slight camera push-in. No subtitles, no on-screen text, no logo.`;
  }

  if (
    script.scene1_video_prompt &&
    script.scene1_video_script &&
    !hasSpeechInstruction(script.scene1_video_prompt, script.scene1_video_script)
  ) {
    script.scene1_video_prompt = `${script.scene1_video_prompt} The main adult character must clearly speak this exact Malay dialogue line with visible lip movement and mouth movement: "${script.scene1_video_script}". Do not make the video silent.`;
  }

  if (
    script.scene2_video_prompt &&
    script.scene2_video_script &&
    !hasSpeechInstruction(script.scene2_video_prompt, script.scene2_video_script)
  ) {
    script.scene2_video_prompt = `${script.scene2_video_prompt} The main adult character must clearly speak this exact Malay dialogue line with visible lip movement and mouth movement: "${script.scene2_video_script}". Do not make the video silent.`;
  }

  if (isTooSimilar(script.scene1_description, script.scene2_description)) {
    script.scene2_description = `Continuation from the first scene: the same adult character now actively uses, holds, wears, demonstrates, or points to the product clearly, then shows the benefit/result with a more confident expression.`;
  }

  if (isTooSimilar(script.scene1_video_script, script.scene2_video_script)) {
    script.scene2_video_script =
      "Lepas cuba produk ni, barulah rasa perubahan dia jelas dan mudah untuk guna hari-hari.";
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
    throw new Error("Subtitle base mesti maksimum 8 perkataan.");
  }

  if (countWords(script.scene2_subtitle as string) > 8) {
    throw new Error("Subtitle sambungan mesti maksimum 8 perkataan.");
  }

  if ((script.scene1_video_script as string).trim().length < 35) {
    throw new Error("Dialog base video mesti minimum 35 aksara.");
  }

  if ((script.scene2_video_script as string).trim().length < 35) {
    throw new Error("Dialog sambungan video mesti minimum 35 aksara.");
  }

  if (countWords(script.scene1_video_script as string) > 28) {
    throw new Error("Dialog base video mesti maksimum 28 perkataan.");
  }

  if (countWords(script.scene2_video_script as string) > 28) {
    throw new Error("Dialog sambungan video mesti maksimum 28 perkataan.");
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
        'Continue this exact vertical 9:16 product video from the final frame into the solution/product demo moment. Keep the same adult character, product, kitchen, lighting, and camera style. The adult character says in Malay with visible lip movement: "Ha, guna ni kerja terus jadi senang." Show relieved happy expression, clear product demo motion, and slight camera push-in. No subtitles, no on-screen text, no logo.',
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
                input.style === "realistic-ugc" ? "Realistic UGC" : "3D Cartoon"
              }\nPilihan watak: ${
                input.characterGender === "male"
                  ? "lelaki dewasa"
                  : input.characterGender === "female"
                    ? "perempuan dewasa"
                    : "auto, pilih watak dewasa paling sesuai"
              }\nFakta produk daripada semakan upload:\n${
                input.productAnalysis?.trim() || "Tiada semakan tambahan."
              }\n\nHasilkan JSON skrip TikTok Shop Malaysia berdasarkan gambar produk ini. Scene dan video prompt mesti sesuai dengan style visual tersebut. Jangan masukkan harga dalam skrip, caption, image prompt, atau video prompt. Jangan bercanggah dengan fakta produk daripada semakan upload. Ikut pilihan watak dengan konsisten.`
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
