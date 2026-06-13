import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;
let serviceAccountParseError = "";

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

function normalizePrivateKey(privateKey: string) {
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

function validateServiceAccount(account: ServiceAccount) {
  if (!account.client_email || !account.private_key) {
    serviceAccountParseError =
      "GOOGLE_SERVICE_ACCOUNT_JSON mesti ada client_email dan private_key.";
    return null;
  }

  account.private_key = normalizePrivateKey(account.private_key);

  if (
    !account.private_key.includes("-----BEGIN PRIVATE KEY-----") ||
    !account.private_key.includes("-----END PRIVATE KEY-----")
  ) {
    serviceAccountParseError =
      "private_key dalam GOOGLE_SERVICE_ACCOUNT_JSON tidak lengkap. Copy JSON key asal dari Google Cloud, jangan tukar format private_key.";
    return null;
  }

  return account;
}

function parseServiceAccount() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  serviceAccountParseError = "";

  if (rawJson?.trim()) {
    try {
      const normalized = rawJson.trim();

      if (normalized === "{test}") {
        serviceAccountParseError =
          "GOOGLE_SERVICE_ACCOUNT_JSON masih placeholder {test}.";
        return null;
      }

      const json = normalized.startsWith("{")
        ? normalized
        : Buffer.from(normalized, "base64").toString("utf8");

      const account = JSON.parse(json) as ServiceAccount;

      return validateServiceAccount(account);
    } catch {
      serviceAccountParseError =
        "GOOGLE_SERVICE_ACCOUNT_JSON bukan JSON service account yang valid.";
      return null;
    }
  }

  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account-key.json";

  try {
    const account = JSON.parse(
      readFileSync(join(process.cwd(), credentialsPath), "utf8")
    ) as ServiceAccount;

    return validateServiceAccount(account);
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

  let signature: string;

  try {
    signature = base64Url(signer.sign(account.private_key));
  } catch {
    throw new Error(
      "Service account private_key tidak boleh dibaca. Sila paste semula GOOGLE_SERVICE_ACCOUNT_JSON penuh dari file key Google Cloud, termasuk private_key dengan BEGIN PRIVATE KEY."
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

  const authMethod = process.env.GOOGLE_AUTH_METHOD?.trim().toLowerCase();
  const serviceAccount = parseServiceAccount();

  if (
    authMethod !== "access-token" &&
    serviceAccount?.client_email &&
    serviceAccount.private_key
  ) {
    return requestServiceAccountToken(serviceAccount);
  }

  const token = readEnvAccessToken();

  if (token) {
    return token;
  }

  if (serviceAccount?.client_email && serviceAccount.private_key) {
    return requestServiceAccountToken(serviceAccount);
  }

  if (serviceAccountParseError) {
    throw new Error(
      `${serviceAccountParseError} Paste JSON penuh service account, atau set GOOGLE_AUTH_METHOD=access-token untuk guna token 1 jam.`
    );
  }

  throw new Error(
    "Google auth belum ditetapkan. Guna GOOGLE_SERVICE_ACCOUNT_JSON untuk service account, atau GOOGLE_VERTEX_ACCESS_TOKEN untuk token 1 jam."
  );
}
