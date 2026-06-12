import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function readEnvAccessToken() {
  let token = process.env.GOOGLE_VERTEX_ACCESS_TOKEN;

  try {
    const envFile = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    const tokenLine = envFile
      .split(/\r?\n/)
      .find((line) => line.startsWith("GOOGLE_VERTEX_ACCESS_TOKEN="));

    if (tokenLine) {
      token = tokenLine.slice(tokenLine.indexOf("=") + 1).trim();
      process.env.GOOGLE_VERTEX_ACCESS_TOKEN = token;
    }
  } catch {
    // Hosted environments usually provide process.env directly.
  }

  return token;
}

function parseServiceAccount() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (rawJson?.trim()) {
    const normalized = rawJson.trim();
    const json = normalized.startsWith("{")
      ? normalized
      : Buffer.from(normalized, "base64").toString("utf8");

    return JSON.parse(json) as ServiceAccount;
  }

  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account-key.json";

  try {
    return JSON.parse(
      readFileSync(join(process.cwd(), credentialsPath), "utf8")
    ) as ServiceAccount;
  } catch {
    return null;
  }
}

async function requestServiceAccountToken(account: ServiceAccount) {
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

  const signature = base64Url(signer.sign(account.private_key));
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

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("Service account tidak pulangkan access token.");
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in || 3600) - 120) * 1000
  };

  return data.access_token;
}

export async function getGoogleAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const token = readEnvAccessToken();

  if (token) {
    return token;
  }

  const serviceAccount = parseServiceAccount();

  if (serviceAccount?.client_email && serviceAccount.private_key) {
    return requestServiceAccountToken(serviceAccount);
  }

  throw new Error(
    "Google auth belum ditetapkan. Guna GOOGLE_VERTEX_ACCESS_TOKEN untuk token 1 jam, atau GOOGLE_SERVICE_ACCOUNT_JSON untuk service account."
  );
}
