// Phase 3 — Prune engine.
// Pure, deterministic translation of /rw:init step 3 (keep/delete/rename rules).
// Input: the answers + the full template file manifest (posix, template-relative).
// Output: which files survive, which are removed, which are renamed, plus notices.
//
// No file I/O here so the whole thing is snapshot-testable against the real manifest.

import type { Answers, PruneResult, SpringLanguage, SpringArchitecture } from "./types.js";

const R = "rules/backend";
const SPRING = `${R}/spring`;

/** Layered-premise Spring agents (removed when Hexagonal is chosen). */
const SPRING_LAYERED_AGENTS = [
  "agents/spring-domain-designer.md",
  "agents/spring-tdd-implementer.md",
  "agents/spring-refactorer.md",
  "agents/spring-test-author.md",
  "agents/spring-code-reviewer.md",
  "agents/spring-debugger.md",
];

/** Hexagonal-dedicated Spring agents (removed when Layered is chosen). */
const SPRING_HEXAGONAL_AGENTS = [
  "agents/spring-hexagonal-domain-designer.md",
  "agents/spring-hexagonal-tdd-implementer.md",
  "agents/spring-hexagonal-refactorer.md",
  "agents/spring-hexagonal-test-author.md",
  "agents/spring-hexagonal-code-reviewer.md",
  "agents/spring-hexagonal-debugger.md",
];

/** React-premise frontend agents (removed when Vue is chosen). */
const FRONTEND_REACT_AGENTS = [
  "agents/frontend-architect.md",
  "agents/frontend-tdd-implementer.md",
  "agents/frontend-refactorer.md",
  "agents/frontend-test-author.md",
  "agents/frontend-code-reviewer.md",
  "agents/frontend-debugger.md",
];

/** Vue-dedicated frontend agents (removed when React-family is chosen). */
const FRONTEND_VUE_AGENTS = [
  "agents/frontend-vue-architect.md",
  "agents/frontend-vue-tdd-implementer.md",
  "agents/frontend-vue-refactorer.md",
  "agents/frontend-vue-test-author.md",
  "agents/frontend-vue-code-reviewer.md",
  "agents/frontend-vue-debugger.md",
];

class Selector {
  private removed = new Set<string>();
  private renames: Array<{ from: string; to: string }> = [];
  readonly notices: string[] = [];

  constructor(private readonly all: string[]) {}

  /** Remove every file whose path starts with `prefix` (a dir prefix incl. trailing slash). */
  removePrefix(prefix: string): void {
    for (const f of this.all) if (f.startsWith(prefix)) this.removed.add(f);
  }

  removeFile(path: string): void {
    if (this.all.includes(path)) this.removed.add(path);
  }

  removeFiles(paths: string[]): void {
    for (const p of paths) this.removeFile(p);
  }

  /** Remove agents matching a glob-ish `agents/<prefix>*` pattern. */
  removeAgentsStarting(prefix: string): void {
    this.removePrefix(`agents/${prefix}`);
  }

  rename(from: string, to: string): void {
    this.renames.push({ from, to });
  }

  notice(msg: string): void {
    this.notices.push(msg);
  }

  build(): PruneResult {
    const renameFroms = new Set(this.renames.map((r) => r.from));
    const renameTos = new Set(this.renames.map((r) => r.to));

    const keep = this.all.filter(
      (f) => !this.removed.has(f) && !renameFroms.has(f) && !renameTos.has(f),
    );

    // True deletions = base files that appear nowhere in the output and are not rename sources.
    const finalOutputs = new Set<string>([...keep, ...renameTos]);
    const remove = this.all.filter(
      (f) => !finalOutputs.has(f) && !renameFroms.has(f),
    );

    return {
      keep: keep.sort(),
      remove: remove.sort(),
      renames: [...this.renames].sort((a, b) => a.from.localeCompare(b.from)),
      notices: this.notices,
    };
  }
}

export function prune(answers: Answers, allFiles: string[]): PruneResult {
  const s = new Selector(allFiles);
  const hasBackend = answers.area === "backend" || answers.area === "fullstack";
  const hasFrontend = answers.area === "frontend" || answers.area === "fullstack";

  if (!hasBackend) pruneNoBackend(s);
  else pruneBackend(s, answers);

  if (!hasFrontend) pruneNoFrontend(s);
  else pruneFrontend(s, answers);

  return s.build();
}

function pruneNoBackend(s: Selector): void {
  s.removePrefix(`${R}/`);
  s.removeAgentsStarting("spring-");
  s.removeAgentsStarting("nestjs-");
  s.removeAgentsStarting("fastapi-");
}

function pruneBackend(s: Selector, a: Answers): void {
  switch (a.backend) {
    case "spring":
      pruneSpring(s, a);
      break;
    case "nestjs":
      pruneNest(s, a);
      break;
    case "fastapi":
      pruneFastapi(s, a);
      break;
  }
}

function pruneSpring(s: Selector, a: Answers): void {
  const sp = a.spring;
  if (!sp) return;

  // Other backend stacks gone.
  s.removePrefix(`${R}/nestjs/`);
  s.removePrefix(`${R}/fastapi/`);
  s.removeAgentsStarting("nestjs-");
  s.removeAgentsStarting("fastapi-");

  const L: SpringLanguage = sp.language;
  const other = L === "java" ? "kotlin" : "java";
  // Language split.
  s.removePrefix(`${SPRING}/${other}/`);

  const arch: SpringArchitecture = sp.architecture;
  const langDir = `${SPRING}/${L}`;
  const archDir = `${langDir}/${arch}`;

  if (arch === "layered") {
    s.removePrefix(`${langDir}/hexagonal/`);
    s.removeFile(`${SPRING}/api-code-first.md`); // code-first web is Toby(Hexagonal)-only
    s.removeFiles(SPRING_HEXAGONAL_AGENTS);
  } else {
    s.removePrefix(`${langDir}/layered/`);
    s.removeFiles(SPRING_LAYERED_AGENTS);
  }

  // Web stack (Java only). Kotlin is always MVC.
  const webflux = sp.webStack === "webflux";

  if (!webflux && L === "java") {
    // MVC + Java: drop WebFlux-only rules.
    s.removeFile(`${SPRING}/java/webflux.md`);
    s.removeFile(`${SPRING}/java/repository-r2dbc.md`);
    s.removeFile(`${SPRING}/java/repository-reactive-mongo.md`);
  }

  if (webflux) {
    pruneSpringWebflux(s, a, langDir, arch);
  } else {
    pruneSpringPersistence(s, a, langDir, archDir, arch);
    // Hexagonal flavor handling applies to MVC hexagonal (JPA -> flavor asked; SQL-first -> Clean fixed).
    if (arch === "hexagonal") pruneHexagonalFlavor(s, a, langDir);
  }

  // RDB: report-only.
  if (sp.rdb && sp.rdb.toLowerCase() !== "postgresql") {
    s.notice(
      `주 RDB로 ${sp.rdb}를 선택했습니다. 규칙의 예시는 PostgreSQL 기준입니다. jOOQ 방언 상수(SQLDialect.*)와 JDBC/R2DBC 드라이버를 선택한 DB에 맞게 직접 교체하세요. (Oracle·SQL Server는 jOOQ 상용 에디션 방언이 필요합니다.)`,
    );
  }
}

function pruneSpringWebflux(
  s: Selector,
  a: Answers,
  langDir: string,
  arch: SpringArchitecture,
): void {
  const sp = a.spring!;
  // Persistence (jpa/sqlfirst) undetermined under WebFlux -> R2DBC replaces repository rules.
  s.removeFile(`${langDir}/${arch}/repository.md`);
  s.removeFile(`${SPRING}/java/repository-tools.md`);
  s.removeFile(`${SPRING}/java/repository-sql.md`);

  if (arch === "layered") {
    // JPA-oriented domain replaced by pure-domain variant.
    s.removeFile(`${langDir}/layered/domain.md`);
    s.rename(`${langDir}/layered/domain-pure.md`, `${langDir}/layered/domain.md`);
  }

  if (!sp.reactiveMongo) {
    s.removeFile(`${SPRING}/java/repository-reactive-mongo.md`);
    s.removeFile(`${langDir}/${arch}/test-mongodb.md`);
  }
}

function pruneSpringPersistence(
  s: Selector,
  a: Answers,
  langDir: string,
  archDir: string,
  arch: SpringArchitecture,
): void {
  const sp = a.spring!;
  if (sp.persistence === "jpa") {
    // SQL-first-only rule gone.
    s.removeFile(`${langDir}/repository-sql.md`);
    if (arch === "layered") {
      // Keep JPA layered/domain.md; drop the pure-domain variant.
      s.removeFile(`${langDir}/layered/domain-pure.md`);
    }

    // MongoDB toggle (JPA only).
    if (!sp.mongodb) {
      s.removeFile(`${archDir}/test-mongodb.md`);
    } else {
      s.notice(
        "MongoDB를 함께 사용합니다. spring-test-author 계열 에이전트의 base class 표에 MongoDB 행이 그대로 남아 있습니다.",
      );
    }

    // QueryDSL/jOOQ tier (JPA only).
    if (!sp.queryTools) {
      s.removeFile(`${langDir}/repository-tools.md`);
    } else {
      s.notice(
        "QueryDSL/jOOQ 티어를 유지합니다. 일부 spring 에이전트가 이 티어를 언급하는 전제 그대로입니다.",
      );
    }
  } else if (sp.persistence === "sqlfirst") {
    // repository.md + repository-tools.md replaced by repository-sql.md.
    s.removeFile(`${archDir}/repository.md`);
    s.removeFile(`${langDir}/repository-tools.md`);
    if (arch === "layered") {
      s.removeFile(`${langDir}/layered/domain.md`);
      s.rename(`${langDir}/layered/domain-pure.md`, `${langDir}/layered/domain.md`);
    }
  }
}

function pruneHexagonalFlavor(s: Selector, a: Answers, langDir: string): void {
  const sp = a.spring!;
  const hexDir = `${langDir}/hexagonal`;
  // Toby is only possible for JPA + MVC; every other hexagonal combo is Clean-fixed.
  const toby = sp.persistence === "jpa" && sp.webStack === "mvc" && sp.hexagonalFlavor === "toby";

  if (!toby) {
    // Clean: drop Toby variants and code-first web spec.
    s.removeFile(`${hexDir}/domain-entity.md`);
    s.removeFile(`${hexDir}/ports-and-adapters-toby.md`);
    s.removeFile(`${hexDir}/repository-toby.md`);
    s.removeFile(`${hexDir}/service-layer-toby.md`);
    s.removeFile(`${hexDir}/test-toby.md`);
    s.removeFile(`${SPRING}/api-code-first.md`);
  } else {
    // Toby: drop Clean regulars, rename Toby variants into canonical names.
    s.removeFile(`${hexDir}/domain.md`);
    s.rename(`${hexDir}/domain-entity.md`, `${hexDir}/domain.md`);
    s.removeFile(`${hexDir}/ports-and-adapters.md`);
    s.rename(`${hexDir}/ports-and-adapters-toby.md`, `${hexDir}/ports-and-adapters.md`);
    s.removeFile(`${hexDir}/repository.md`);
    s.rename(`${hexDir}/repository-toby.md`, `${hexDir}/repository.md`);
    s.removeFile(`${hexDir}/service-layer.md`);
    s.rename(`${hexDir}/service-layer-toby.md`, `${hexDir}/service-layer.md`);
    s.removeFile(`${hexDir}/test.md`);
    s.rename(`${hexDir}/test-toby.md`, `${hexDir}/test.md`);
    // Web: spec-first api-dto removed, code-first kept.
    s.removeFile(`${SPRING}/api-dto.md`);
    if (sp.mongodb) {
      s.notice(
        "Toby flavor + MongoDB: test-mongodb.md의 통합 base class 표는 Clean 기준 서술입니다. Toby의 통합 테스트 관례(test.md 2.2)와 함께 읽으세요.",
      );
    }
  }
}

function pruneNest(s: Selector, a: Answers): void {
  const n = a.nestjs;
  if (!n) return;

  s.removePrefix(`${SPRING}/`);
  s.removeFile(`${SPRING}/api-dto.md`);
  s.removeFile(`${SPRING}/api-code-first.md`);
  s.removePrefix(`${R}/fastapi/`);
  s.removeAgentsStarting("spring-");
  s.removeAgentsStarting("fastapi-");

  // Persistence: keep exactly one.
  const persist = {
    typeorm: `${R}/nestjs/nestjs-persistence-typeorm.md`,
    prisma: `${R}/nestjs/nestjs-persistence-prisma.md`,
    sqlfirst: `${R}/nestjs/nestjs-persistence-sqlfirst.md`,
  } as const;
  for (const [k, path] of Object.entries(persist)) {
    if (k !== n.persistence) s.removeFile(path);
  }

  // Validation: keep exactly one.
  if (n.validation === "classvalidator") {
    s.removeFile(`${R}/nestjs/nestjs-validation-zod.md`);
  } else {
    s.removeFile(`${R}/nestjs/nestjs-validation-classvalidator.md`);
    s.notice(
      "nestjs 에이전트들은 class-validator 전제로 작성돼 있습니다. Zod 기준으로 활용하려면 에이전트를 별도로 조정해야 합니다.",
    );
  }

  // Fullstack NestJS: frontend globs may match backend TS.
  if (a.area === "fullstack") {
    const root = n.frontendRoot?.trim();
    const hint = root ? ` (예: \`**/*.ts\` → \`${root}/**/*.ts\`)` : "";
    s.notice(
      `백엔드·프론트엔드가 모두 TypeScript이므로 frontend/*.md의 globs가 백엔드 소스에도 매칭될 수 있습니다. 필요하면 프론트엔드 소스 루트로 직접 좁히세요${hint}.`,
    );
  }
}

function pruneFastapi(s: Selector, a: Answers): void {
  const f = a.fastapi;
  if (!f) return;

  s.removePrefix(`${SPRING}/`);
  s.removeFile(`${SPRING}/api-dto.md`);
  s.removeFile(`${SPRING}/api-code-first.md`);
  s.removePrefix(`${R}/nestjs/`);
  s.removeAgentsStarting("spring-");
  s.removeAgentsStarting("nestjs-");

  if (f.orm) {
    s.removeFile(`${R}/fastapi/fastapi-persistence-sqlfirst.md`);
  } else {
    s.removeFile(`${R}/fastapi/fastapi-persistence-orm.md`);
  }

  if (f.rdb && f.rdb.toLowerCase() !== "postgresql") {
    s.notice(
      `주 RDB로 ${f.rdb}를 선택했습니다. fastapi.md의 드라이버 예시는 asyncpg(PostgreSQL) 기준입니다. 선택한 DB에 맞는 드라이버로 직접 교체하세요 (MySQL/MariaDB: asyncmy·aiomysql·PyMySQL, SQLite: aiosqlite·sqlite3).`,
    );
  }
}

function pruneNoFrontend(s: Selector): void {
  s.removePrefix("rules/frontend/");
  s.removeAgentsStarting("frontend-");
}

function pruneFrontend(s: Selector, a: Answers): void {
  const F = "rules/frontend";
  switch (a.frontend) {
    case "nextjs":
      s.removeFile(`${F}/vite.md`);
      s.removeFile(`${F}/vue.md`);
      // Spec gap fix: Vite-only routing rules are dead weight for Next.js.
      s.removeFile(`${F}/vite-routing-tanstack.md`);
      s.removeFile(`${F}/vite-routing-reactrouter.md`);
      s.removeFiles(FRONTEND_VUE_AGENTS);
      break;
    case "vite":
      s.removeFile(`${F}/nextjs.md`);
      s.removeFile(`${F}/vue.md`);
      s.removeFiles(FRONTEND_VUE_AGENTS);
      // Routing library: keep exactly one.
      if (a.vite?.routing === "tanstack") {
        s.removeFile(`${F}/vite-routing-reactrouter.md`);
      } else {
        s.removeFile(`${F}/vite-routing-tanstack.md`);
      }
      break;
    case "vue":
      s.removeFile(`${F}/nextjs.md`);
      s.removeFile(`${F}/vite.md`);
      // Spec gap fix: Vite-only routing rules are dead weight for Vue.
      s.removeFile(`${F}/vite-routing-tanstack.md`);
      s.removeFile(`${F}/vite-routing-reactrouter.md`);
      s.removeFiles(FRONTEND_REACT_AGENTS);
      break;
  }
}
