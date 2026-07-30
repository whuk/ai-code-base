// Turn a PruneResult into a flat list of output files with their logical
// destination path (template-relative) and category, so each emitter only has
// to decide the target-specific path + content transform.

import type { PruneResult } from "../types.js";

export type Category = "agent" | "command" | "rule" | "context" | "settings" | "misc";

export interface ResolvedFile {
  /** Template-relative path to read from. */
  srcRel: string;
  /** Template-relative logical destination (differs from src only for renames). */
  destRel: string;
  category: Category;
}

function categorize(rel: string): Category {
  if (rel.startsWith("agents/")) return "agent";
  if (rel.startsWith("commands/")) return "command";
  if (rel.startsWith("rules/")) return "rule";
  if (rel === "context.md") return "context";
  if (rel === "settings.json") return "settings";
  return "misc";
}

export function resolveFiles(result: PruneResult): ResolvedFile[] {
  const files: ResolvedFile[] = result.keep.map((rel) => ({
    srcRel: rel,
    destRel: rel,
    category: categorize(rel),
  }));
  for (const r of result.renames) {
    files.push({ srcRel: r.from, destRel: r.to, category: categorize(r.to) });
  }
  return files.sort((a, b) => a.destRel.localeCompare(b.destRel));
}
