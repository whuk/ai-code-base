// Gemini CLI emitter.
// - context.md      -> GEMINI.md (+ rules reference section)
// - rules/**        -> .gemini/rules/** (verbatim; globs frontmatter kept for humans)
// - commands/**.md  -> .gemini/commands/**.toml (prompt/description)
// - agents/*.md     -> .gemini/agents/*.md (frontmatter normalized)
// - settings.json   -> .gemini/settings.json (context.fileName pinned)

import TOML from "@iarna/toml";
import type { PruneResult } from "../types.js";
import { resolveFiles } from "./resolve.js";
import { collectRuleEntries, renderRulesSection } from "./toc.js";
import { read, write, copy } from "./fsutil.js";
import { parse, stringify } from "../transform/frontmatter.js";

const rulePath = (destRel: string): string => `.gemini/${destRel.replace(/^rules\//, "rules/")}`;
// -> .gemini/rules/backend/...
const geminiRuleTarget = (destRel: string): string => `.gemini/${destRel}`;

export function emitGemini(baseDir: string, outDir: string, result: PruneResult): void {
  const files = resolveFiles(result);

  for (const f of files) {
    switch (f.category) {
      case "context": {
        const ctx = read(baseDir, f.srcRel);
        const entries = collectRuleEntries(baseDir, files, geminiRuleTarget);
        const section = renderRulesSection(entries, "프로젝트 규칙 참조");
        write(outDir, "GEMINI.md", `${ctx.trimEnd()}\n${section}`);
        break;
      }
      case "rule":
        copy(baseDir, f.srcRel, outDir, geminiRuleTarget(f.destRel));
        break;
      case "command":
        write(outDir, geminiCommandPath(f.destRel), toGeminiCommand(read(baseDir, f.srcRel)));
        break;
      case "agent":
        write(outDir, `.gemini/agents/${basename(f.destRel)}`, toGeminiAgent(read(baseDir, f.srcRel)));
        break;
      case "settings":
        write(outDir, ".gemini/settings.json", geminiSettings(read(baseDir, f.srcRel)));
        break;
      case "misc":
        copy(baseDir, f.srcRel, outDir, `.gemini/${f.destRel}`);
        break;
    }
  }
  void rulePath;
}

function basename(rel: string): string {
  return rel.split("/").pop()!;
}

// commands/rw/plan/plan.md -> .gemini/commands/rw/plan/plan.toml
function geminiCommandPath(destRel: string): string {
  const withoutPrefix = destRel.replace(/^commands\//, "");
  return `.gemini/commands/${withoutPrefix.replace(/\.md$/, ".toml")}`;
}

function toGeminiCommand(raw: string): string {
  const { data, body } = parse(raw);
  const prompt = body.replace(/\$ARGUMENTS/g, "{{args}}");
  const obj: Record<string, unknown> = {};
  if (data.description) obj.description = String(data.description);
  obj.prompt = prompt;
  return TOML.stringify(obj as TOML.JsonMap);
}

function toGeminiAgent(raw: string): string {
  const { data, body } = parse(raw);
  const fm: Record<string, unknown> = { name: data.name, description: data.description };
  // '*' tools == default (all), 'inherit' model == session default: omit both.
  if (data.tools && data.tools !== "*") fm.tools = data.tools;
  if (data.model && data.model !== "inherit") fm.model = data.model;
  return stringify(fm, body);
}

function geminiSettings(raw: string): string {
  // Start from the base (permissions/language) but pin the context filename.
  let base: Record<string, unknown> = {};
  try {
    base = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    base = {};
  }
  const settings = { ...base, context: { fileName: "GEMINI.md" } };
  return `${JSON.stringify(settings, null, 2)}\n`;
}
