import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prune } from "../src/prune.js";
import { listTemplateFiles } from "../src/io.js";
import { emit } from "../src/emit/index.js";
import type { Answers } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(here, "..", "templates", "base");

const springAnswers = (target: Answers["target"], outputDir: string): Answers => ({
  area: "backend",
  backend: "spring",
  spring: {
    language: "kotlin",
    architecture: "hexagonal",
    webStack: "mvc",
    persistence: "jpa",
    hexagonalFlavor: "pragmatic",
    mongodb: false,
    queryTools: false,
    reactiveMongo: false,
    rdb: "PostgreSQL",
  },
  target,
  outputDir,
});

function walk(root: string, dir: string = root): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(root, abs));
    else out.push(path.relative(root, abs).split(path.sep).join("/"));
  }
  return out.sort();
}

let manifest: string[];
beforeAll(() => {
  manifest = listTemplateFiles(BASE);
});

describe("claude emit", () => {
  it("writes a .claude/ tree with CLAUDE.md, agents, commands, rules", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "rw-claude-"));
    const a = springAnswers("claude", dir);
    emit("claude", BASE, dir, prune(a, manifest));
    const files = walk(dir);
    expect(files).toContain(".claude/CLAUDE.md");
    expect(files).toContain(".claude/settings.json");
    expect(files.some((f) => f.startsWith(".claude/agents/spring-hexagonal-"))).toBe(true);
    expect(files.some((f) => f.startsWith(".claude/commands/rw/"))).toBe(true);
    // pragmatic rename landed at canonical name
    expect(files).toContain(".claude/rules/backend/spring/kotlin/hexagonal/domain.md");
    // and its content is the pragmatic variant (domain-entity source)
    const domain = readFileSync(path.join(dir, ".claude/rules/backend/spring/kotlin/hexagonal/domain.md"), "utf8");
    const pragmaticSrc = readFileSync(path.join(BASE, "rules/backend/spring/kotlin/hexagonal/domain-entity.md"), "utf8");
    expect(domain).toBe(pragmaticSrc);
  });
});

describe("gemini emit", () => {
  it("writes GEMINI.md with rules section, TOML commands, md agents", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "rw-gemini-"));
    const a = springAnswers("gemini", dir);
    emit("gemini", BASE, dir, prune(a, manifest));
    const files = walk(dir);
    expect(files).toContain("GEMINI.md");
    expect(files.some((f) => f.startsWith(".gemini/commands/rw/") && f.endsWith(".toml"))).toBe(true);
    expect(files.some((f) => f.startsWith(".gemini/agents/") && f.endsWith(".md"))).toBe(true);
    expect(files.some((f) => f.startsWith(".gemini/rules/backend/"))).toBe(true);
    expect(files).toContain(".gemini/settings.json");
    // GEMINI.md carries the rules reference section
    const gm = readFileSync(path.join(dir, "GEMINI.md"), "utf8");
    expect(gm).toContain("프로젝트 규칙 참조");
    expect(gm).toContain(".gemini/rules/backend/");
    // rule entries surface their frontmatter `paths` as the applicability hint
    expect(gm).toContain("적용 대상:");
    expect(gm).toContain("**/*.kt");
    // a command TOML has prompt + description keys
    const cmd = files.find((f) => f.startsWith(".gemini/commands/rw/") && f.endsWith(".toml"))!;
    const toml = readFileSync(path.join(dir, cmd), "utf8");
    expect(toml).toMatch(/prompt\s*=/);
    // settings pins context filename
    const settings = JSON.parse(readFileSync(path.join(dir, ".gemini/settings.json"), "utf8"));
    expect(settings.context.fileName).toBe("GEMINI.md");
    // statusLine is a Claude Code feature: no statusline files leak into .gemini/
    expect(files.some((f) => f.includes("statusline"))).toBe(false);
  });
});

describe("codex emit", () => {
  it("writes AGENTS.md, flat prompts, TOML agents, config.toml", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "rw-codex-"));
    const a = springAnswers("codex", dir);
    const notes = emit("codex", BASE, dir, prune(a, manifest));
    const files = walk(dir);
    expect(files).toContain("AGENTS.md");
    expect(files).toContain(".codex/config.toml");
    // flattened prompts (rw-*.md), no nested command dirs
    expect(files.some((f) => f.startsWith(".codex/prompts/rw-") && f.endsWith(".md"))).toBe(true);
    // TOML agents with developer_instructions
    const agentFile = files.find((f) => f.startsWith(".codex/agents/") && f.endsWith(".toml"))!;
    const agentToml = readFileSync(path.join(dir, agentFile), "utf8");
    expect(agentToml).toMatch(/developer_instructions\s*=/);
    expect(agentToml).toMatch(/name\s*=/);
    // AGENTS.md has rules section referencing .codex/rules
    const am = readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    expect(am).toContain(".codex/rules/backend/");
    // rule entries surface their frontmatter `paths` as the applicability hint
    expect(am).toContain("적용 대상:");
    expect(am).toContain("**/*.kt");
    // emitter returns the home-dir prompts caveat
    expect(notes.some((n) => n.includes("~/.codex/prompts/"))).toBe(true);
    // statusLine is a Claude Code feature: no statusline files leak into .codex/
    expect(files.some((f) => f.includes("statusline"))).toBe(false);
  });
});

describe("stack-agnostic review files", () => {
  it.each([
    ["claude", [".claude/guides/code-review.md", ".claude/agents/code-reviewer.md", ".claude/commands/rw/git/pr-review.md"]],
    ["gemini", [".gemini/guides/code-review.md", ".gemini/agents/code-reviewer.md", ".gemini/commands/rw/git/pr-review.toml"]],
    ["codex", [".codex/guides/code-review.md", ".codex/agents/code-reviewer.toml", ".codex/prompts/rw-git-pr-review.md"]],
  ] as const)("lands in the %s layout", (target, expected) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), `rw-${target}-review-`));
    emit(target, BASE, dir, prune(springAnswers(target, dir), manifest));
    const files = walk(dir);
    for (const f of expected) expect(files).toContain(f);
  });
});

describe("no accidental empty files", () => {
  it("every emitted file is non-empty across targets", () => {
    for (const target of ["claude", "gemini", "codex"] as const) {
      const dir = mkdtempSync(path.join(os.tmpdir(), `rw-${target}-ne-`));
      emit(target, BASE, dir, prune(springAnswers(target, dir), manifest));
      for (const f of walk(dir)) {
        expect(statSync(path.join(dir, f)).size, `${target}:${f}`).toBeGreaterThan(0);
      }
    }
    expect(existsSync(BASE)).toBe(true);
  });
});
