import { handleCallback } from "@vercel/queue";
import { z } from "zod";
import { cloudIndexStep, enqueueRevision } from "@/server/cloud-index";
export const runtime = "nodejs";
export const maxDuration = 300;
export const POST = handleCallback(
  async (message) => {
    const { revisionId } = z
      .object({ revisionId: z.string().uuid() })
      .parse(message);
    if (await cloudIndexStep(revisionId)) await enqueueRevision(revisionId);
  },
  {
    visibilityTimeoutSeconds: 300,
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(300, 15 * metadata.deliveryCount),
    }),
  },
);
