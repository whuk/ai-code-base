// Build the "rules reference" section injected into GEMINI.md / AGENTS.md.
// Since neither tool supports path-conditional loading, we surface each rule's
// path + description + the `paths` patterns that tell the agent *when* to read it.

import { parse } from "../transform/frontmatter.js";
import { read } from "./fsutil.js";
import type { ResolvedFile } from "./resolve.js";

export interface RuleEntry {
  path: string; // target-relative rule path
  description: string;
  paths: string[];
}

export function collectRuleEntries(
  baseDir: string,
  files: ResolvedFile[],
  toTargetPath: (destRel: string) => string,
): RuleEntry[] {
  return files
    .filter((f) => f.category === "rule")
    .map((f) => {
      const { data } = parse(read(baseDir, f.srcRel));
      return {
        path: toTargetPath(f.destRel),
        description: String(data.description ?? "").trim(),
        paths: Array.isArray(data.paths) ? data.paths.map((p) => String(p).trim()) : [],
      };
    });
}

export function renderRulesSection(entries: RuleEntry[], title: string): string {
  const lines: string[] = [
    "",
    `## ${title}`,
    "",
    "이 프로젝트의 상세 규칙은 아래 파일에 있습니다. **매칭되는 파일을 작업할 때 해당 규칙 파일을 먼저 읽으세요.** (이 에이전트는 글롭 기반 자동 로딩을 지원하지 않으므로 수동 참조가 필요합니다.)",
    "",
  ];
  for (const e of entries) {
    const when = e.paths.length ? ` — 적용 대상: \`${e.paths.join(", ")}\`` : "";
    const desc = e.description ? `: ${e.description}` : "";
    lines.push(`- \`${e.path}\`${desc}${when}`);
  }
  lines.push("");
  return lines.join("\n");
}
