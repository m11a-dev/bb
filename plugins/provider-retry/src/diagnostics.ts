import {
  defineRpcContract,
  type PluginTurnFailedEvent,
  type BbPluginApi,
} from "@get-bb/plugin-sdk";
import { z } from "zod";
import { retryAvailabilitySchema } from "./retry-contract.js";

import { isRateLimitFailure } from "./retry-policy.js";

type RateLimitKind = NonNullable<PluginTurnFailedEvent["rateLimits"]>["kind"];
const rateLimitKindSchema = z.enum({
  "subscription-window": "subscription-window",
  credits: "credits",
  "spend-control": "spend-control",
  unknown: "unknown",
} satisfies { [Kind in RateLimitKind]: Kind });

export function diagnosticRateLimitKind(
  failure: PluginTurnFailedEvent,
): RateLimitKind | null {
  if (!isRateLimitFailure(failure)) return null;
  const kind = rateLimitKindSchema.safeParse(failure.rateLimits?.kind);
  return kind.success ? kind.data : "unknown";
}

export const retryDiagnosticSchema = z.object({
  requestId: z.string(),
  observedAt: z.number(),
  rateLimitKind: rateLimitKindSchema.nullable().optional(),
  availability: retryAvailabilitySchema,
  decision: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("decline"), reason: z.string() }),
    z.object({
      kind: z.literal("retry"),
      reason: z.string(),
      sendAt: z.number(),
    }),
  ]),
});
export type RetryDiagnostic = z.infer<typeof retryDiagnosticSchema>;
export const retryDiagnosticContract = defineRpcContract({
  "decision.get": {
    input: z.object({ threadId: z.string().min(1) }),
    output: retryDiagnosticSchema.nullable(),
  },
});
export async function readRetryDiagnostic(
  bb: BbPluginApi,
  threadId: string,
): Promise<RetryDiagnostic | null> {
  return retryDiagnosticSchema
    .nullable()
    .parse((await bb.storage.kv.get(`decision:${threadId}`)) ?? null);
}
