import { getGoogleAccessToken } from "@/lib/google-auth";

type GcsUriParts = {
  bucket: string;
  objectName: string;
};

export function getConfiguredBucketName() {
  return process.env.GCS_BUCKET_NAME?.trim() || "";
}

export function parseGcsUri(uri: string): GcsUriParts {
  if (!uri.startsWith("gs://")) {
    throw new Error("GCS URI mesti bermula dengan gs://.");
  }

  const withoutScheme = uri.slice("gs://".length);
  const slashIndex = withoutScheme.indexOf("/");

  if (slashIndex <= 0 || slashIndex === withoutScheme.length - 1) {
    throw new Error("Format GCS URI tidak valid.");
  }

  return {
    bucket: withoutScheme.slice(0, slashIndex),
    objectName: withoutScheme.slice(slashIndex + 1)
  };
}

function getObjectUrl(bucket: string, objectName: string) {
  return `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(
    bucket
  )}/o/${encodeURIComponent(objectName)}`;
}

export async function downloadGcsObject(uri: string) {
  const { bucket, objectName } = parseGcsUri(uri);
  const response = await fetch(`${getObjectUrl(bucket, objectName)}?alt=media`, {
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Download GCS video gagal. Status ${response.status}. ${text.slice(0, 300)}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function uploadGcsObject(params: {
  bucket?: string;
  objectName: string;
  contentType: string;
  body: Buffer;
}) {
  const bucket = params.bucket || getConfiguredBucketName();

  if (!bucket) {
    throw new Error("GCS_BUCKET_NAME belum ditetapkan.");
  }

  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
      bucket
    )}/o?uploadType=media&name=${encodeURIComponent(params.objectName)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getGoogleAccessToken()}`,
        "Content-Type": params.contentType
      },
      body: params.body as unknown as BodyInit
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Upload GCS gagal. Status ${response.status}. ${text.slice(0, 300)}`
    );
  }

  return `gs://${bucket}/${params.objectName}`;
}
