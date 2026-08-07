import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prune } from "../src/prune.js";
import { listTemplateFiles } from "../src/io.js";
import type { Answers } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(here, "..", "templates", "base");

let manifest: string[];
beforeAll(() => {
  manifest = listTemplateFiles(BASE);
});

const out = { target: "claude", outputDir: "." } as const;

/** Final output set = kept files + rename targets. */
function outputs(a: Answers): Set<string> {
  const r = prune(a, manifest);
  return new Set([...r.keep, ...r.renames.map((x) => x.to)]);
}

describe("manifest sanity", () => {
  it("extracted the full base template", () => {
    expect(manifest.filter((f) => f.startsWith("agents/")).length).toBe(42);
    expect(manifest.filter((f) => f.startsWith("commands/")).length).toBe(11);
    expect(manifest.filter((f) => f.startsWith("rules/")).length).toBe(65);
    expect(manifest).toContain("context.md");
    expect(manifest).toContain("settings.json");
  });
});

describe("common files always survive", () => {
  const a: Answers = {
    area: "backend",
    backend: "spring",
    spring: {
      language: "java",
      architecture: "layered",
      webStack: "mvc",
      persistence: "jpa",
      mongodb: false,
      queryTools: false,
      reactiveMongo: false,
      rdb: "PostgreSQL",
    },
    ...out,
  };
  it("keeps context, settings and all commands", () => {
    const o = outputs(a);
    expect(o).toContain("context.md");
    expect(o).toContain("settings.json");
    expect([...o].filter((f) => f.startsWith("commands/")).length).toBe(11);
    expect(o).toContain("commands/rw/git/pr-review.md");
    expect(o).toContain("commands/rw/plan/plan_clean.md");
  });
});

describe("Claude-only commands are dropped for other targets", () => {
  const answersFor = (target: Answers["target"]): Answers => ({
    area: "backend",
    backend: "fastapi",
    fastapi: { orm: true, rdb: "PostgreSQL" },
    target,
    outputDir: ".",
  });

  it("keeps plan_clean for claude", () => {
    const o = outputs(answersFor("claude"));
    expect(o).toContain("commands/rw/plan/plan_clean.md");
    expect([...o].filter((f) => f.startsWith("commands/")).length).toBe(11);
  });

  it.each(["gemini", "codex"] as const)("drops plan_clean for %s", (target) => {
    const o = outputs(answersFor(target));
    expect(o).not.toContain("commands/rw/plan/plan_clean.md");
    expect([...o].filter((f) => f.startsWith("commands/")).length).toBe(10);
  });

  it("explains the removal in a notice", () => {
    const r = prune(answersFor("gemini"), manifest);
    expect(r.remove).toContain("commands/rw/plan/plan_clean.md");
    expect(r.notices.join("\n")).toMatch(/plan_clean/);
  });
});

describe("stack-agnostic review files survive every stack", () => {
  const cases: Array<[string, Answers]> = [
    [
      "spring",
      {
        area: "backend",
        backend: "spring",
        spring: {
          language: "java",
          architecture: "layered",
          webStack: "mvc",
          persistence: "jpa",
          mongodb: false,
          queryTools: false,
          reactiveMongo: false,
          rdb: "PostgreSQL",
        },
        ...out,
      },
    ],
    ["nestjs", { area: "backend", backend: "nestjs", nestjs: { persistence: "prisma", validation: "zod" }, ...out }],
    ["fastapi", { area: "backend", backend: "fastapi", fastapi: { orm: true, rdb: "PostgreSQL" }, ...out }],
    ["vue frontend", { area: "frontend", frontend: "vue", ...out }],
  ];

  it.each(cases)("keeps code-review.md and code-reviewer.md for %s", (_name, a) => {
    const o = outputs(a);
    expect(o).toContain("rules/code-review.md");
    expect(o).toContain("agents/code-reviewer.md");
  });
});

describe("Spring Java Layered JPA MVC (mongo off, spec-only, postgres)", () => {
  const a: Answers = {
    area: "backend",
    backend: "spring",
    spring: {
      language: "java",
      architecture: "layered",
      webStack: "mvc",
      persistence: "jpa",
      mongodb: false,
      queryTools: false,
      reactiveMongo: false,
      rdb: "PostgreSQL",
    },
    ...out,
  };
  it("drops kotlin, hexagonal, other backends, webflux, sqlfirst, mongo, tools", () => {
    const o = outputs(a);
    // language split
    expect([...o].some((f) => f.includes("spring/kotlin/"))).toBe(false);
    // architecture
    expect([...o].some((f) => f.includes("spring/java/hexagonal/"))).toBe(false);
    expect(o).not.toContain("rules/backend/spring/api-code-first.md");
    // other backends
    expect([...o].some((f) => f.includes("nestjs") || f.includes("fastapi"))).toBe(false);
    // webflux gone under MVC
    expect(o).not.toContain("rules/backend/spring/java/webflux.md");
    expect(o).not.toContain("rules/backend/spring/java/repository-r2dbc.md");
    // JPA keeps domain.md, drops domain-pure + sqlfirst
    expect(o).toContain("rules/backend/spring/java/layered/domain.md");
    expect(o).not.toContain("rules/backend/spring/java/layered/domain-pure.md");
    expect(o).not.toContain("rules/backend/spring/java/repository-sql.md");
    // mongo off + spec-only
    expect(o).not.toContain("rules/backend/spring/java/layered/test-mongodb.md");
    expect(o).not.toContain("rules/backend/spring/java/repository-tools.md");
    // kept common spring
    expect(o).toContain("rules/backend/spring/api-dto.md");
    expect(o).toContain("rules/backend/spring/java/archunit.md");
    expect(o).toContain("rules/backend/shared/architecture.md");
    // agents: layered spring kept, hexagonal removed
    expect(o).toContain("agents/spring-tdd-implementer.md");
    expect(o).toContain("agents/spring-style-checker.md");
    expect(o).toContain("agents/spring-openapi-spec-author.md");
    expect([...o].some((f) => f.startsWith("agents/spring-hexagonal-"))).toBe(false);
    expect([...o].some((f) => f.startsWith("agents/frontend-"))).toBe(false);
  });
});

describe("Spring Kotlin Hexagonal JPA MVC Pragmatic (mongo on)", () => {
  const a: Answers = {
    area: "backend",
    backend: "spring",
    spring: {
      language: "kotlin",
      architecture: "hexagonal",
      webStack: "mvc",
      persistence: "jpa",
      hexagonalFlavor: "pragmatic",
      mongodb: true,
      queryTools: false,
      reactiveMongo: false,
      rdb: "PostgreSQL",
    },
    ...out,
  };
  it("renames pragmatic variants to canonical, drops clean + api-dto, keeps api-code-first", () => {
    const r = prune(a, manifest);
    const o = new Set([...r.keep, ...r.renames.map((x) => x.to)]);
    const hex = "rules/backend/spring/kotlin/hexagonal";
    // pragmatic renames present
    const renamed = Object.fromEntries(r.renames.map((x) => [x.to, x.from]));
    expect(renamed[`${hex}/domain.md`]).toBe(`${hex}/domain-entity.md`);
    expect(renamed[`${hex}/repository.md`]).toBe(`${hex}/repository-pragmatic.md`);
    expect(renamed[`${hex}/test.md`]).toBe(`${hex}/test-pragmatic.md`);
    // clean originals + pragmatic leftovers not in output as separate files
    expect(o).not.toContain(`${hex}/domain-entity.md`);
    expect(o).not.toContain(`${hex}/ports-and-adapters-pragmatic.md`);
    // web: spec-first removed, code-first kept
    expect(o).not.toContain("rules/backend/spring/api-dto.md");
    expect(o).toContain("rules/backend/spring/api-code-first.md");
    // java dir gone
    expect([...o].some((f) => f.includes("spring/java/"))).toBe(false);
    // mongo on: test-mongodb kept + notice
    expect(o).toContain(`${hex}/test-mongodb.md`);
    expect(r.notices.some((n) => n.includes("Pragmatic") && n.includes("MongoDB"))).toBe(true);
    // hexagonal agents kept, layered removed
    expect(o).toContain("agents/spring-hexagonal-tdd-implementer.md");
    expect(o).not.toContain("agents/spring-tdd-implementer.md");
  });
});

describe("Spring Java Hexagonal SQL-first MVC (clean fixed)", () => {
  const a: Answers = {
    area: "backend",
    backend: "spring",
    spring: {
      language: "java",
      architecture: "hexagonal",
      webStack: "mvc",
      persistence: "sqlfirst",
      mongodb: false,
      queryTools: false,
      reactiveMongo: false,
      rdb: "PostgreSQL",
    },
    ...out,
  };
  it("keeps repository-sql, drops repository.md + tools + pragmatic variants + api-code-first", () => {
    const o = outputs(a);
    const hex = "rules/backend/spring/java/hexagonal";
    expect(o).toContain("rules/backend/spring/java/repository-sql.md");
    expect(o).not.toContain(`${hex}/repository.md`);
    expect(o).not.toContain("rules/backend/spring/java/repository-tools.md");
    // clean fixed: pragmatic variants gone, code-first gone, api-dto kept
    expect(o).not.toContain(`${hex}/repository-pragmatic.md`);
    expect(o).not.toContain("rules/backend/spring/api-code-first.md");
    expect(o).toContain("rules/backend/spring/api-dto.md");
    // clean regulars kept
    expect(o).toContain(`${hex}/domain.md`);
    expect(o).toContain(`${hex}/ports-and-adapters.md`);
  });
});

describe("Spring Java Layered WebFlux (reactive mongo off)", () => {
  const a: Answers = {
    area: "backend",
    backend: "spring",
    spring: {
      language: "java",
      architecture: "layered",
      webStack: "webflux",
      persistence: "r2dbc",
      mongodb: false,
      queryTools: false,
      reactiveMongo: false,
      rdb: "PostgreSQL",
    },
    ...out,
  };
  it("keeps webflux+r2dbc, renames domain-pure, drops repository rules and reactive-mongo", () => {
    const r = prune(a, manifest);
    const o = new Set([...r.keep, ...r.renames.map((x) => x.to)]);
    expect(o).toContain("rules/backend/spring/java/webflux.md");
    expect(o).toContain("rules/backend/spring/java/repository-r2dbc.md");
    // repository rules replaced
    expect(o).not.toContain("rules/backend/spring/java/layered/repository.md");
    expect(o).not.toContain("rules/backend/spring/java/repository-tools.md");
    expect(o).not.toContain("rules/backend/spring/java/repository-sql.md");
    // domain-pure -> domain
    const renamed = Object.fromEntries(r.renames.map((x) => [x.to, x.from]));
    expect(renamed["rules/backend/spring/java/layered/domain.md"]).toBe(
      "rules/backend/spring/java/layered/domain-pure.md",
    );
    // reactive mongo off
    expect(o).not.toContain("rules/backend/spring/java/repository-reactive-mongo.md");
    expect(o).not.toContain("rules/backend/spring/java/layered/test-mongodb.md");
  });
});

describe("NestJS Prisma + Zod (backend only)", () => {
  const a: Answers = {
    area: "backend",
    backend: "nestjs",
    nestjs: { persistence: "prisma", validation: "zod" },
    ...out,
  };
  it("keeps only prisma + zod rules, drops spring/fastapi, warns about zod agents", () => {
    const r = prune(a, manifest);
    const o = new Set([...r.keep, ...r.renames.map((x) => x.to)]);
    expect(o).toContain("rules/backend/nestjs/nestjs.md");
    expect(o).toContain("rules/backend/nestjs/nestjs-persistence-prisma.md");
    expect(o).not.toContain("rules/backend/nestjs/nestjs-persistence-typeorm.md");
    expect(o).not.toContain("rules/backend/nestjs/nestjs-persistence-sqlfirst.md");
    expect(o).toContain("rules/backend/nestjs/nestjs-validation-zod.md");
    expect(o).not.toContain("rules/backend/nestjs/nestjs-validation-classvalidator.md");
    expect([...o].some((f) => f.includes("spring") || f.includes("fastapi"))).toBe(false);
    expect([...o].some((f) => f.startsWith("agents/nestjs-"))).toBe(true);
    expect(r.notices.some((n) => n.includes("class-validator"))).toBe(true);
  });
});

describe("FastAPI SQL-first + MySQL (backend only)", () => {
  const a: Answers = {
    area: "backend",
    backend: "fastapi",
    fastapi: { orm: false, rdb: "MySQL" },
    ...out,
  };
  it("keeps sqlfirst persistence, drops orm, warns about driver", () => {
    const r = prune(a, manifest);
    const o = new Set([...r.keep, ...r.renames.map((x) => x.to)]);
    expect(o).toContain("rules/backend/fastapi/fastapi.md");
    expect(o).toContain("rules/backend/fastapi/fastapi-persistence-sqlfirst.md");
    expect(o).not.toContain("rules/backend/fastapi/fastapi-persistence-orm.md");
    expect(r.notices.some((n) => n.includes("asyncpg"))).toBe(true);
  });
});

describe("Frontend Vite (tanstack) only", () => {
  const a: Answers = { area: "frontend", frontend: "vite", vite: { routing: "tanstack" }, ...out };
  it("keeps vite + tanstack, drops nextjs/vue/reactrouter and all backend", () => {
    const o = outputs(a);
    expect(o).toContain("rules/frontend/vite.md");
    expect(o).toContain("rules/frontend/typescript.md");
    expect(o).toContain("rules/frontend/vite-routing-tanstack.md");
    expect(o).not.toContain("rules/frontend/vite-routing-reactrouter.md");
    expect(o).not.toContain("rules/frontend/nextjs.md");
    expect(o).not.toContain("rules/frontend/vue.md");
    expect([...o].some((f) => f.startsWith("rules/backend/"))).toBe(false);
    // react-family agents kept, vue removed
    expect(o).toContain("agents/frontend-architect.md");
    expect([...o].some((f) => f.startsWith("agents/frontend-vue-"))).toBe(false);
  });
});

describe("Frontend Vue only", () => {
  const a: Answers = { area: "frontend", frontend: "vue", ...out };
  it("keeps vue + vue agents, drops react agents, nextjs/vite/routing", () => {
    const o = outputs(a);
    expect(o).toContain("rules/frontend/vue.md");
    expect(o).not.toContain("rules/frontend/nextjs.md");
    expect(o).not.toContain("rules/frontend/vite.md");
    // spec-gap fix: routing rules gone for vue
    expect(o).not.toContain("rules/frontend/vite-routing-tanstack.md");
    expect(o).not.toContain("rules/frontend/vite-routing-reactrouter.md");
    expect(o).toContain("agents/frontend-vue-tdd-implementer.md");
    expect(o).toContain("agents/frontend-style-checker.md");
    expect(o).not.toContain("agents/frontend-architect.md");
  });
});

describe("Frontend Next.js only (spec-gap fix)", () => {
  const a: Answers = { area: "frontend", frontend: "nextjs", ...out };
  it("drops vite routing rules that the literal spec left behind", () => {
    const o = outputs(a);
    expect(o).toContain("rules/frontend/nextjs.md");
    expect(o).not.toContain("rules/frontend/vite.md");
    expect(o).not.toContain("rules/frontend/vue.md");
    expect(o).not.toContain("rules/frontend/vite-routing-tanstack.md");
    expect(o).not.toContain("rules/frontend/vite-routing-reactrouter.md");
  });
});

describe("Fullstack Spring + Next.js", () => {
  const a: Answers = {
    area: "fullstack",
    backend: "spring",
    spring: {
      language: "java",
      architecture: "layered",
      webStack: "mvc",
      persistence: "jpa",
      mongodb: false,
      queryTools: false,
      reactiveMongo: false,
      rdb: "PostgreSQL",
    },
    frontend: "nextjs",
    ...out,
  };
  it("keeps both backend spring and frontend nextjs", () => {
    const o = outputs(a);
    expect(o).toContain("rules/backend/spring/java/layered/domain.md");
    expect(o).toContain("rules/frontend/nextjs.md");
    expect([...o].some((f) => f.startsWith("agents/spring-"))).toBe(true);
    expect([...o].some((f) => f.startsWith("agents/frontend-"))).toBe(true);
  });
});
