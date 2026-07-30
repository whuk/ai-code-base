#!/usr/bin/env node
// rw-base CLI entry.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { intro, outro } from "@clack/prompts";
import { runQuestionnaire } from "../questionnaire.js";
import { listTemplateFiles } from "../io.js";
import { prune } from "../prune.js";
import { emit } from "../emit/index.js";
import { renderReport } from "../report.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from both src/bin (tsx) and dist/bin (built): package-root/templates/base.
const BASE_DIR = path.resolve(here, "..", "..", "templates", "base");

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  intro("rw-base — TDD/Tidy-First 코딩 에이전트 규칙 스캐폴더");

  const answers = await runQuestionnaire();
  const manifest = listTemplateFiles(BASE_DIR);
  const result = prune(answers, manifest);

  let extraNotices: string[] = [];
  if (!dryRun) {
    extraNotices = emit(answers.target, BASE_DIR, answers.outputDir, result);
  }

  process.stdout.write(renderReport(answers, result, extraNotices, dryRun) + "\n");

  outro(dryRun ? "미리보기 완료 — 실제 생성은 --dry-run 없이 실행하세요." : "완료되었습니다.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
