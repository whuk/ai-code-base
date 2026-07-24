import type { Answers, PruneResult, TargetAgent } from "../types.js";
import { emitClaude } from "./claude.js";
import { emitGemini } from "./gemini.js";
import { emitCodex } from "./codex.js";

/** Dispatch to the target emitter. Returns extra target-specific notices. */
export function emit(
  target: TargetAgent,
  baseDir: string,
  outDir: string,
  result: PruneResult,
): string[] {
  switch (target) {
    case "claude":
      emitClaude(baseDir, outDir, result);
      return [];
    case "gemini":
      emitGemini(baseDir, outDir, result);
      return [];
    case "codex":
      return emitCodex(baseDir, outDir, result);
  }
}

export type { Answers };
