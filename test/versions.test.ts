import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prune } from "../src/prune.js";
import { listTemplateFiles } from "../src/io.js";
import { versionNotices, versionSummary } from "../src/versions.js";
import type { Answers, SpringAnswers, VersionAnswers } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(here, "..", "templates", "base");

let manifest: string[];
beforeAll(() => {
  manifest = listTemplateFiles(BASE);
});

const out = { target: "claude", outputDir: "." } as const;

const SPRING_JPA: SpringAnswers = {
  language: "java",
  architecture: "layered",
  webStack: "mvc",
  persistence: "jpa",
  mongodb: false,
  queryTools: false,
  reactiveMongo: false,
  rdb: "PostgreSQL",
};

function spring(overrides: Partial<SpringAnswers>, versions?: VersionAnswers): Answers {
  return {
    area: "backend",
    backend: "spring",
    spring: { ...SPRING_JPA, ...overrides },
    versions,
    ...out,
  };
}

/** Run the premise check against the real prune result, as the CLI does. */
function notices(a: Answers): string[] {
  return versionNotices(a, prune(a, manifest));
}

describe("no answers, no noise", () => {
  it("returns nothing when versions were not collected", () => {
    expect(notices(spring({}))).toEqual([]);
  });

  it("returns nothing when every premise is met", () => {
    const a = spring({}, { jdk: "21", springBoot: "3.2plus" });
    expect(notices(a)).toEqual([]);
  });
});

describe("JDK 17+ premise (record / sealed interface)", () => {
  it("warns below 17", () => {
    const n = notices(spring({}, { jdk: "11", springBoot: "3.2plus" }));
    expect(n).toHaveLength(1);
    expect(n[0]).toContain("JDK");
    expect(n[0]).toContain("record");
  });

  it("accepts 17 and newer", () => {
    expect(notices(spring({}, { jdk: "17", springBoot: "3.2plus" }))).toEqual([]);
    expect(notices(spring({}, { jdk: "25", springBoot: "3.2plus" }))).toEqual([]);
  });

  it("stays silent on free text it cannot parse", () => {
    expect(notices(spring({}, { jdk: "temurin-lts", springBoot: "3.2plus" }))).toEqual([]);
  });
});

describe("Spring Boot premises", () => {
  it("warns about Jakarta EE on Boot 2.x regardless of surviving rules", () => {
    const n = notices(spring({}, { jdk: "21", springBoot: "2x" }));
    expect(n.some((x) => x.includes("javax.persistence"))).toBe(true);
  });

  it("warns about JdbcClient when repository-tools.md survives (JPA + QueryDSL/jOOQ)", () => {
    const n = notices(spring({ queryTools: true }, { jdk: "21", springBoot: "3.0to3.1" }));
    expect(n.some((x) => x.includes("JdbcClient"))).toBe(true);
  });

  it("stays silent about JdbcClient when the depending rule was pruned away", () => {
    // Specification-only JPA: repository-tools.md and repository-sql.md are both gone.
    const n = notices(spring({ queryTools: false }, { jdk: "21", springBoot: "3.0to3.1" }));
    expect(n.some((x) => x.includes("JdbcClient"))).toBe(false);
  });

  it("warns about JdbcClient for SQL-first, where it is the whole foundation", () => {
    const n = notices(spring({ persistence: "sqlfirst" }, { jdk: "21", springBoot: "3.0to3.1" }));
    expect(n.some((x) => x.includes("JdbcClient") && x.includes("SQL-first"))).toBe(true);
  });

  it("stays silent on free text it cannot classify", () => {
    expect(notices(spring({ queryTools: true }, { jdk: "21", springBoot: "곧 정할 예정" }))).toEqual(
      [],
    );
  });

  it("classifies free-text versions that do parse", () => {
    const n = notices(spring({ queryTools: true }, { jdk: "21", springBoot: "3.1.5" }));
    expect(n.some((x) => x.includes("JdbcClient"))).toBe(true);
    expect(notices(spring({ queryTools: true }, { jdk: "21", springBoot: "3.4.1" }))).toEqual([]);
  });
});

describe("FastAPI premises", () => {
  const fastapi = (versions: VersionAnswers): Answers => ({
    area: "backend",
    backend: "fastapi",
    fastapi: { orm: true, rdb: "PostgreSQL" },
    versions,
    ...out,
  });

  it("warns on Pydantic v1 (multi-entry-point defense loses its basis)", () => {
    const n = notices(fastapi({ python: "3.13", pydantic: "v1" }));
    expect(n.some((x) => x.includes("Pydantic v1"))).toBe(true);
  });

  it("warns below Python 3.9", () => {
    const n = notices(fastapi({ python: "3.8", pydantic: "v2" }));
    expect(n.some((x) => x.includes("Python"))).toBe(true);
  });

  it("accepts Python 3.9+ with Pydantic v2", () => {
    expect(notices(fastapi({ python: "3.13", pydantic: "v2" }))).toEqual([]);
    expect(notices(fastapi({ python: "3.9", pydantic: "v2" }))).toEqual([]);
  });
});

describe("Vue 3 premise", () => {
  const vue = (v: VersionAnswers): Answers => ({
    area: "frontend",
    frontend: "vue",
    versions: v,
    ...out,
  });

  it("warns on Vue 2", () => {
    const n = notices(vue({ vue: "2", node: "22" }));
    expect(n).toHaveLength(1);
    expect(n[0]).toContain("Composition API");
  });

  it("accepts Vue 3", () => {
    expect(notices(vue({ vue: "3", node: "22" }))).toEqual([]);
  });
});

describe("premise-free versions", () => {
  it("never warns about Kotlin or Node", () => {
    const a = spring(
      { language: "kotlin" },
      { jdk: "21", kotlin: "1.9.x", springBoot: "3.2plus", node: "18" },
    );
    expect(notices(a)).toEqual([]);
  });
});

describe("versionSummary", () => {
  it("is empty when nothing was collected", () => {
    expect(versionSummary(undefined)).toBe("");
    expect(versionSummary({})).toBe("");
  });

  it("renders canonical tiers in human-readable form", () => {
    const s = versionSummary({
      jdk: "21",
      kotlin: "2.x",
      springBoot: "3.2plus",
      python: "3.13",
      pydantic: "v2",
      node: "22",
      vue: "3",
    });
    expect(s).toContain("JDK=21");
    expect(s).toContain("Spring Boot=3.2+");
    expect(s).toContain("Pydantic=v2 (FastAPI 0.100+)");
    expect(s).toContain("Vue=3.x");
    expect(s).not.toContain("3.2plus");
  });
});
