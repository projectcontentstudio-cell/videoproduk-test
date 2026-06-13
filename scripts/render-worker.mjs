import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { Worker } from "bullmq";
import IORedis from "ioredis";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

async function loadLocalEnv() {
  const envPath = join(rootDir, ".env.local");

  try {
    const envFile = await readFile(envPath, "utf8");

    for (const line of envFile.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
      const value = trimmed.slice(trimmed.indexOf("=") + 1).trim();

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

await loadLocalEnv();

const queueName = "video-render";
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL belum ditetapkan.");
}

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null
});

const outputDir = join(rootDir, ".rendered");
let cachedGoogleToken = null;

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseServiceAccount() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (rawJson?.trim()) {
    const normalized = rawJson.trim();
    const json = normalized.startsWith("{")
      ? normalized
      : Buffer.from(normalized, "base64").toString("utf8");
    const account = JSON.parse(json);

    return validateServiceAccount(account);
  }

  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account-key.json";

  try {
    const account = JSON.parse(
      readFileSync(join(rootDir, credentialsPath), "utf8")
    );

    return validateServiceAccount(account);
  } catch {
    return null;
  }
}

function normalizePrivateKey(privateKey) {
  let key = privateKey.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");

  if (!key.includes("-----BEGIN") && /^[A-Za-z0-9+/=\r\n]+$/.test(key)) {
    const decoded = Buffer.from(key, "base64").toString("utf8").trim();

    if (decoded.includes("-----BEGIN")) {
      key = decoded;
    }
  }

  return key;
}

function validateServiceAccount(account) {
  if (!account?.client_email || !account?.private_key) {
    return null;
  }

  account.private_key = normalizePrivateKey(account.private_key);

  if (
    !account.private_key.includes("-----BEGIN PRIVATE KEY-----") ||
    !account.private_key.includes("-----END PRIVATE KEY-----")
  ) {
    return null;
  }

  return account;
}

async function requestServiceAccountToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: account.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  );
  const unsignedJwt = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");

  signer.update(unsignedJwt);
  signer.end();

  let signature;

  try {
    signature = base64Url(signer.sign(account.private_key));
  } catch {
    throw new Error(
      "Service account private_key tidak boleh dibaca. Paste semula GOOGLE_SERVICE_ACCOUNT_JSON penuh dari Google Cloud."
    );
  }

  const assertion = `${unsignedJwt}.${signature}`;
  const response = await fetch(
    account.token_uri || "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Service account token gagal. Status ${response.status}. ${text.slice(0, 300)}`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Service account tidak pulangkan access token.");
  }

  cachedGoogleToken = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in || 3600) - 120) * 1000
  };

  return data.access_token;
}

async function getAccessToken() {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now()) {
    return cachedGoogleToken.token;
  }

  const authMethod = process.env.GOOGLE_AUTH_METHOD?.trim().toLowerCase();
  const serviceAccount = parseServiceAccount();

  if (
    authMethod !== "access-token" &&
    serviceAccount?.client_email &&
    serviceAccount.private_key
  ) {
    return requestServiceAccountToken(serviceAccount);
  }

  let token = process.env.GOOGLE_VERTEX_ACCESS_TOKEN;

  try {
    const envFile = readFileSync(join(rootDir, ".env.local"), "utf8");
    const tokenLine = envFile
      .split(/\r?\n/)
      .find((line) => line.startsWith("GOOGLE_VERTEX_ACCESS_TOKEN="));

    if (tokenLine) {
      token = tokenLine.slice(tokenLine.indexOf("=") + 1).trim();
      process.env.GOOGLE_VERTEX_ACCESS_TOKEN = token;
    }
  } catch {
    // Keep process.env fallback.
  }

  if (!token) {
    if (serviceAccount?.client_email && serviceAccount.private_key) {
      return requestServiceAccountToken(serviceAccount);
    }

    throw new Error(
      "Google auth belum ditetapkan. Guna GOOGLE_SERVICE_ACCOUNT_JSON atau GOOGLE_VERTEX_ACCESS_TOKEN."
    );
  }

  return token;
}

function getVeoModelUrl(action) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region = process.env.VEO_REGION ?? "us-central1";
  const model = process.env.VEO_MODEL ?? "veo-3.1-generate-001";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:${action}`;
}

async function readGoogleError(response) {
  const text = await response.text();
  const compact = text.replace(/\s+/g, " ").trim();

  return compact ? ` ${compact.slice(0, 700)}` : "";
}

function dataUrlToImage(dataUrl) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    bytesBase64Encoded: match[2],
    mimeType: match[1] === "image/jpg" ? "image/jpeg" : match[1]
  };
}

function makeVeoPromptSafetySafe(prompt) {
  const replacements = [
    [/\bchildren\b/gi, "young adults"],
    [/\bchild\b/gi, "adult"],
    [/\bbabies\b/gi, "adult family props"],
    [/\bbaby\b/gi, "family product context"],
    [/\btoddlers\b/gi, "adults"],
    [/\btoddler\b/gi, "adult"],
    [/\bminors\b/gi, "adults"],
    [/\bminor\b/gi, "adult"],
    [/\bkids\b/gi, "adult users"],
    [/\bkid\b/gi, "adult user"],
    [/\bprofusely\b/gi, "lightly"],
    [/\bvigorously\b/gi, "gently"],
    [/\bdesperately\b/gi, "carefully"],
    [/\bdistress(ed)?\b/gi, "mildly concerned"],
    [/\bpanic(ked|king)?\b/gi, "concerned"],
    [/\bscared\b/gi, "concerned"],
    [/\bterrified\b/gi, "concerned"],
    [/\bcrying\b/gi, "looking concerned"],
    [/\bsick\b/gi, "uncomfortable"],
    [/\bpain\b/gi, "discomfort"],
    [/\bmedical\b/gi, "wellness"],
    [/\bcure(s|d)?\b/gi, "helps"],
    [/\btreat(s|ed|ment)?\b/gi, "supports"],
    [/\bheal(s|ed|ing)?\b/gi, "helps"],
    [/\bdisease(s)?\b/gi, "issue"]
  ];

  let safePrompt = prompt.trim();

  for (const [pattern, replacement] of replacements) {
    safePrompt = safePrompt.replace(pattern, replacement);
  }

  return [
    safePrompt,
    "Safety constraints: all visible people are adults aged 25 or older.",
    "Do not show babies, children, toddlers, minors, child faces, school uniforms, or child-like bodies.",
    "Keep emotions mild and commercial-friendly: relatable discomfort, then calm relief.",
    "Avoid intense distress, panic, crying, injury, medical claims, dangerous actions, or unsafe product use.",
    "Use natural small motion only, with clear product interaction and visible lip movement if dialogue is included.",
    "No subtitles, no on-screen text, no logo, no watermark."
  ].join(" ");
}

async function referenceUrlToImage(referenceUrl) {
  const dataUrlImage = dataUrlToImage(referenceUrl);

  if (dataUrlImage) {
    return dataUrlImage;
  }

  if (!referenceUrl.startsWith("http://") && !referenceUrl.startsWith("https://")) {
    return null;
  }

  const response = await fetch(referenceUrl);

  if (!response.ok) {
    throw new Error(`Reference image gagal dibaca. Status ${response.status}.`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0];

  if (mimeType !== "image/png" && mimeType !== "image/jpeg") {
    throw new Error("Reference image bukan PNG atau JPEG.");
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    bytesBase64Encoded: Buffer.from(arrayBuffer).toString("base64"),
    mimeType
  };
}

async function startVeoOperation(job) {
  const image = await referenceUrlToImage(job.data.referenceSceneUrl);
  const sceneKind = job.data.sceneKind ?? "solution";
  const dialogueLine =
    job.data.dialogueLine ||
    (sceneKind === "problem"
      ? "Aduh, macam mana nak settle cepat ni?"
      : job.data.cta);
  const problemPrompt = [
    "Create one vertical 9:16 TikTok Shop Malaysia problem-story video.",
    `Use the supplied reference image as the first-frame visual style and character reference.`,
    `Scene situation: ${job.data.sceneDescription || job.data.subtitle}.`,
    `The main character must speak this Malay dialogue naturally with visible lip movement: "${dialogueLine}".`,
    "One 8 second clip. Keep the same 3D cartoon character, outfit, hijab, room, props, and emotional problem mood from the reference image.",
    "Small natural motion only: worried face, looking around, hand gesture, slight camera push-in, child or props may move subtly if present.",
    "Do not introduce the product or solution yet. No product demo. No text overlays, no subtitles, no logo, no fake UI."
  ].join(" ");
  const solutionPrompt = [
    `Create one vertical 9:16 TikTok Shop Malaysia product solution video for ${job.data.productName}.`,
    `Price: ${job.data.productPrice}.`,
    `Use the supplied reference image as the first-frame visual style and character reference.`,
    `Scene situation: ${job.data.sceneDescription || job.data.subtitle}.`,
    `The main character must speak this Malay dialogue naturally with visible lip movement: "${dialogueLine}".`,
    `Hook: ${job.data.hook}.`,
    `CTA: ${job.data.cta}.`,
    "One 8 second clip, product focused, clean commercial lighting, natural Malay creator energy.",
    "No on-screen fake UI, no subtitles, no extra text overlays, no logo."
  ].join(" ");
  const prompt = makeVeoPromptSafetySafe(
    job.data.manualVideoPrompt ||
      (sceneKind === "problem" ? problemPrompt : solutionPrompt)
  );
  const instance = image ? { prompt, image } : { prompt };
  const response = await fetch(getVeoModelUrl("predictLongRunning"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        aspectRatio: "9:16",
        durationSeconds: 8,
        sampleCount: 1
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Veo gagal mula. Status ${response.status}.${await readGoogleError(
        response
      )}`
    );
  }

  const data = await response.json();
  const operationName = data?.name || data?.operationName;

  if (!operationName) {
    throw new Error("Veo tidak pulangkan operation name.");
  }

  return operationName;
}

async function pollVeoOperation(operationName, job) {
  const maxPolls = Number(process.env.VEO_MAX_POLLS ?? 60);

  for (let poll = 1; poll <= maxPolls; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await job.updateProgress(Math.min(25 + poll, 55));

    const response = await fetch(getVeoModelUrl("fetchPredictOperation"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        operationName
      })
    });

    if (!response.ok) {
      throw new Error(
        `Veo status gagal. Status ${response.status}.${await readGoogleError(
          response
        )}`
      );
    }

    const data = await response.json();

    if (!data.done) {
      continue;
    }

    if (data.error) {
      throw new Error(`Veo gagal: ${JSON.stringify(data.error).slice(0, 700)}`);
    }

    const video =
      data?.response?.videos?.[0] ||
      data?.response?.predictions?.[0] ||
      data?.predictions?.[0];
    const bytes =
      video?.bytesBase64Encoded ||
      video?.video?.bytesBase64Encoded ||
      video?.gcsUri ||
      video?.video?.gcsUri;

    if (!bytes) {
      throw new Error(
        `Veo siap tetapi video output tidak dikenali: ${JSON.stringify(data).slice(
          0,
          700
        )}`
      );
    }

    return bytes;
  }

  throw new Error("Veo belum siap selepas had polling local.");
}

function assertPayload(data) {
  const required = [
    "generationId",
    "userId",
    "tier",
    "productImageUrl",
    "referenceSceneUrl",
    "productName",
    "productPrice",
    "hook",
    "subtitle",
    "cta",
    "caption",
    "hashtags"
  ];

  for (const field of required) {
    if (!data[field]) {
      throw new Error(`Medan ${field} diperlukan.`);
    }
  }
}

async function generateVeoClip(job) {
  await job.updateProgress(25);

  if (process.env.VIDEO_RENDER_MOCK === "true") {
    const mockClipPath = join(outputDir, `${job.id}-veo-placeholder.txt`);
    await writeFile(
      mockClipPath,
      `Mock Veo clip for ${job.data.productName}\nModel: ${
        process.env.VEO_MODEL ?? "veo-3.1-generate-001"
      }\n`
    );
    return mockClipPath;
  }

  const operationName = await startVeoOperation(job);
  const output = await pollVeoOperation(operationName, job);
  const veoClipPath = join(outputDir, `${job.id}-veo.mp4`);

  if (typeof output === "string" && output.startsWith("gs://")) {
    throw new Error(
      `Veo pulangkan GCS URI (${output}). Worker belum ada storage download untuk gs://.`
    );
  }

  if (typeof output === "string" && output.startsWith("http")) {
    const response = await fetch(output);

    if (!response.ok) {
      throw new Error(`Download video Veo gagal. Status ${response.status}.`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await writeFile(veoClipPath, Buffer.from(arrayBuffer));
    return veoClipPath;
  }

  await writeFile(veoClipPath, Buffer.from(output, "base64"));
  return veoClipPath;
}

async function runFfmpeg(job, inputPath) {
  await job.updateProgress(65);

  if (process.env.VIDEO_RENDER_MOCK === "true") {
    const mockVideoPath = join(outputDir, `${job.id}-final.mp4.txt`);
    const watermarked = job.data.tier === "free";
    await writeFile(
      mockVideoPath,
      [
        `Input: ${inputPath}`,
        `Hook: ${job.data.hook}`,
        `Subtitle: ${job.data.subtitle}`,
        `CTA: ${job.data.cta}`,
        `Watermark: ${watermarked ? "on" : "off"}`,
        "Encode: MP4 H.264 1080x1920 30fps"
      ].join("\n")
    );
    return mockVideoPath;
  }

  const outputPath = join(outputDir, `${job.id}-final.mp4`);
  const watermarkFilter =
    job.data.tier === "free"
      ? ",drawtext=text='VideoProduk.my':x=w-tw-36:y=h-th-36:fontsize=28:fontcolor=white@0.8:box=1:boxcolor=black@0.35"
      : "";
  const vf = `scale=1080:1920,drawtext=text='${job.data.hook}':x=(w-text_w)/2:y=120:fontsize=60:fontcolor=white:shadowcolor=black:shadowx=3:shadowy=3,drawtext=text='${job.data.subtitle}':x=(w-text_w)/2:y=h-220:fontsize=44:fontcolor=white:shadowcolor=black:shadowx=3:shadowy=3${watermarkFilter}`;

  try {
    await new Promise((resolve, reject) => {
    const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
    const child = spawn(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      outputPath
    ]);

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg gagal dengan kod ${code}.`));
      }
    });
  });
  } catch (error) {
    if (error?.code === "ENOENT" && job.data.tier === "paid") {
      await copyFile(inputPath, outputPath);
      return outputPath;
    }

    throw error;
  }

  return outputPath;
}

const worker = new Worker(
  queueName,
  async (job) => {
    assertPayload(job.data);
    await mkdir(outputDir, { recursive: true });
    await job.updateProgress(10);

    const veoClipPath = await generateVeoClip(job);
    const finalVideoPath = await runFfmpeg(job, veoClipPath);

    await job.updateProgress(100);

    return {
      videoUrl: finalVideoPath,
      watermarked: job.data.tier === "free",
      downloadable: true
    };
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Render siap: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Render gagal: ${job?.id ?? "unknown"}`, error);
});
