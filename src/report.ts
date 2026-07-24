// Phase 5 — human-facing summary of the generation.

import type { Answers, PruneResult, TargetAgent } from "./types.js";

const TARGET_LABEL: Record<TargetAgent, string> = {
  claude: "Claude Code (.claude/)",
  gemini: "Gemini CLI (GEMINI.md + .gemini/)",
  codex: "Codex CLI (AGENTS.md + .codex/)",
};

export function stackSummary(a: Answers): string {
  const parts: string[] = [];
  parts.push(`영역: ${a.area}`);
  if (a.spring) {
    const s = a.spring;
    const bits = [`Spring Boot`, s.language, s.architecture, s.webStack, s.persistence];
    if (s.hexagonalFlavor) bits.push(`flavor=${s.hexagonalFlavor}`);
    if (s.persistence === "jpa") {
      bits.push(s.mongodb ? "MongoDB 병용" : "MongoDB 미사용");
      bits.push(s.queryTools ? "QueryDSL/jOOQ 계획" : "Specification까지만");
    }
    if (s.webStack === "webflux") bits.push(s.reactiveMongo ? "리액티브MongoDB 병용" : "R2DBC만");
    bits.push(`RDB=${s.rdb}`);
    parts.push(bits.join(" / "));
  }
  if (a.nestjs) {
    const bits = [`NestJS`, a.nestjs.persistence, a.nestjs.validation];
    if (a.nestjs.frontendRoot) bits.push(`frontendRoot=${a.nestjs.frontendRoot}`);
    parts.push(bits.join(" / "));
  }
  if (a.fastapi) parts.push(`FastAPI / ${a.fastapi.orm ? "ORM" : "SQL-first"} / RDB=${a.fastapi.rdb}`);
  if (a.frontend) {
    const bits = [frontendLabel(a.frontend)];
    if (a.vite) bits.push(a.vite.routing);
    parts.push(bits.join(" / "));
  }
  return parts.join("\n  ");
}

function frontendLabel(f: string): string {
  return f === "nextjs" ? "Next.js" : f === "vite" ? "Vite(React)" : "Vue.js";
}

export function renderReport(
  a: Answers,
  result: PruneResult,
  extraNotices: string[],
  dryRun: boolean,
): string {
  const outFiles = result.keep.length + result.renames.length;
  const lines: string[] = [];
  lines.push("");
  lines.push(dryRun ? "── DRY RUN (파일을 쓰지 않았습니다) ──" : "── 생성 완료 ──");
  lines.push("");
  lines.push(`타깃 에이전트: ${TARGET_LABEL[a.target]}`);
  lines.push(`출력 디렉토리: ${a.outputDir}`);
  lines.push("");
  lines.push("선택한 스택:");
  lines.push(`  ${stackSummary(a)}`);
  lines.push("");
  lines.push(`생성 파일: ${outFiles}개 (rules/agents/commands + 컨텍스트/설정)`);
  lines.push(`제외 파일: ${result.remove.length}개`);
  if (result.renames.length) {
    lines.push("");
    lines.push("정규 이름으로 rename된 파일:");
    for (const r of result.renames) lines.push(`  ${r.from}  →  ${r.to}`);
  }

  const notices = [...result.notices, ...extraNotices];
  if (notices.length) {
    lines.push("");
    lines.push("⚠️  주의사항:");
    for (const n of notices) lines.push(`  • ${n}`);
  }

  lines.push("");
  lines.push("규칙 파일 본문은 편집하지 않았습니다 (순수 선별 + 포맷 변환).");
  return lines.join("\n");
}
