import { NextResponse } from "next/server";
import { getRenderQueue, renderFinalVideoJobName } from "@/lib/render-queue";
import type { RenderJobPayload } from "@/lib/render-types";

export const runtime = "nodejs";

const requiredFields: Array<keyof RenderJobPayload> = [
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

function parsePayload(body: Partial<RenderJobPayload>): RenderJobPayload {
  for (const field of requiredFields) {
    if (!body[field]) {
      throw new Error(`Medan ${field} diperlukan.`);
    }
  }

  if (body.tier !== "free" && body.tier !== "paid") {
    throw new Error("Tier mesti free atau paid.");
  }

  if (!Array.isArray(body.hashtags)) {
    throw new Error("Hashtags mesti dalam format senarai.");
  }

  return body as RenderJobPayload;
}

export async function POST(request: Request) {
  try {
    const payload = parsePayload(await request.json());
    const renderQueue = getRenderQueue();
    const job = await renderQueue.add(renderFinalVideoJobName, payload);

    return NextResponse.json(
      {
        jobId: job.id,
        status: "pending",
        message: "Job render video sudah masuk queue.",
        pollEveryMs: 3000
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Render video gagal dimulakan."
      },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId diperlukan untuk semak status render." },
        { status: 400 }
      );
    }

    const renderQueue = getRenderQueue();
    const job = await renderQueue.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: "Job render tidak dijumpai." },
        { status: 404 }
      );
    }

    const state = await job.getState();

    return NextResponse.json({
      jobId,
      status: state,
      progress: job.progress,
      result: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Status render gagal disemak."
      },
      { status: 400 }
    );
  }
}
