// Phase 2 — interactive questionnaire. Mirrors /rw:init step 2 branching and
// appends the two extra questions (target agent, output directory).

import path from "node:path";
import { select, text, isCancel, cancel } from "@clack/prompts";
import type {
  Answers,
  Area,
  SpringAnswers,
  SpringLanguage,
  SpringArchitecture,
  NestAnswers,
  NestPersistence,
  NestValidation,
  FastapiAnswers,
  ViteRouting,
  VersionAnswers,
  VueMajor,
} from "./types.js";

async function ask<T>(v: Promise<unknown>): Promise<T> {
  const r = await v;
  if (isCancel(r)) {
    cancel("취소되었습니다.");
    process.exit(0);
  }
  return r as T;
}

export async function runQuestionnaire(): Promise<Answers> {
  const area = await ask<Area>(
    select({
      message: "이 프로젝트는 어떤 영역을 사용합니까?",
      options: [
        { value: "backend", label: "백엔드만" },
        { value: "frontend", label: "프론트엔드만" },
        { value: "fullstack", label: "풀스택 (백엔드 + 프론트엔드)" },
      ],
    }),
  );

  const answers: Partial<Answers> = { area };
  const hasBackend = area === "backend" || area === "fullstack";
  const hasFrontend = area === "frontend" || area === "fullstack";

  if (hasBackend) {
    answers.backend = await ask(
      select({
        message: "백엔드 스택은 무엇입니까?",
        options: [
          { value: "spring", label: "Spring Boot (Java 또는 Kotlin)" },
          { value: "nestjs", label: "NestJS (TypeScript)" },
          { value: "fastapi", label: "FastAPI (Python)" },
        ],
      }),
    );
    if (answers.backend === "spring") answers.spring = await askSpring();
    if (answers.backend === "nestjs") answers.nestjs = await askNest(area);
    if (answers.backend === "fastapi") answers.fastapi = await askFastapi();
  }

  if (hasFrontend) {
    answers.frontend = await ask(
      select({
        message: "프론트엔드 프레임워크는?",
        options: [
          { value: "nextjs", label: "Next.js" },
          { value: "vite", label: "Vite (React)" },
          { value: "vue", label: "Vue.js" },
        ],
      }),
    );
    if (answers.frontend === "vite") {
      const routing = await ask<ViteRouting>(
        select({
          message: "라우팅 라이브러리는 무엇을 사용합니까?",
          options: [
            { value: "tanstack", label: "TanStack Router (기본 검토 대상)" },
            { value: "reactrouter", label: "React Router" },
          ],
        }),
      );
      answers.vite = { routing };
    }
  }

  answers.versions = await askVersions(answers);

  answers.target = await ask(
    select({
      message: "어느 코딩 에이전트용으로 생성합니까?",
      options: [
        { value: "claude", label: "Claude Code" },
        { value: "gemini", label: "Gemini CLI" },
        { value: "codex", label: "Codex CLI" },
      ],
    }),
  );

  const defaultOutputDir = path.join(process.cwd(), "output");
  const outputDir = await ask<string>(
    text({
      message: "출력 디렉토리 (비우면 ./output)",
      placeholder: defaultOutputDir,
      defaultValue: defaultOutputDir,
    }),
  );
  answers.outputDir = outputDir.trim() || defaultOutputDir;

  return answers as Answers;
}

/** Shown on every version option: these answers never change the selection. */
const VERSION_HINT = "파일 선별을 바꾸지 않고, 최소 버전 충족 여부 확인에만 쓰입니다";

/**
 * Round 4 — language/framework versions. Only asks what the chosen stack needs, and only
 * where the rules actually carry a minimum premise (NestJS/Next.js/Vite/React have none,
 * so their library versions are not asked).
 */
async function askVersions(a: Partial<Answers>): Promise<VersionAnswers> {
  const v: VersionAnswers = {};
  const hasFrontend = a.area === "frontend" || a.area === "fullstack";

  if (a.spring) {
    v.jdk = await askChoiceOrOther(
      "JDK 버전은 무엇입니까?",
      [
        { value: "21", label: "21 (LTS, 기본)" },
        { value: "17", label: "17 (LTS, 규칙이 요구하는 최소)" },
        { value: "25", label: "25 (LTS)" },
      ],
      "JDK 버전을 입력하세요 (예: 11)",
    );

    if (a.spring.language === "kotlin") {
      v.kotlin = await askChoiceOrOther(
        "Kotlin 버전대는 무엇입니까?",
        [
          { value: "2.x", label: "2.x (기본)" },
          { value: "1.9.x", label: "1.9.x" },
        ],
        "Kotlin 버전을 입력하세요 (예: 1.8.22)",
      );
    }

    v.springBoot = await askChoiceOrOther(
      "Spring Boot 버전대는 무엇입니까?",
      [
        { value: "3.2plus", label: "3.2 이상 (기본)", hint: "JdbcClient를 쓸 수 있는 기준선" },
        { value: "3.0to3.1", label: "3.0~3.1", hint: "Jakarta EE는 맞지만 JdbcClient가 없음" },
        { value: "2x", label: "2.x", hint: "javax.persistence 시대 — Jakarta 전제가 깨짐" },
      ],
      "Spring Boot 버전을 입력하세요 (예: 3.1.5)",
    );
  }

  if (a.fastapi) {
    v.python = await askChoiceOrOther(
      "Python 버전은 무엇입니까?",
      [
        { value: "3.13", label: "3.13 (기본)" },
        { value: "3.12", label: "3.12" },
        { value: "3.11", label: "3.11" },
      ],
      "Python 버전을 입력하세요 (예: 3.8) — 규칙이 요구하는 최소는 3.9입니다",
    );
    v.pydantic = await askChoiceOrOther(
      "FastAPI·Pydantic 버전대는 무엇입니까?",
      [
        {
          value: "v2",
          label: "FastAPI 0.100 이상 + Pydantic v2 (기본)",
          hint: "다중 진입점 방어가 전제하는 조합",
        },
        {
          value: "v1",
          label: "FastAPI 0.99 이하 + Pydantic v1",
          hint: "FastAPI의 Pydantic v2 지원은 0.100부터",
        },
      ],
      "FastAPI·Pydantic 버전을 입력하세요",
    );
  }

  if (a.backend === "nestjs" || hasFrontend) {
    v.node = await askChoiceOrOther(
      "Node.js 버전대는 무엇입니까?",
      [
        { value: "22", label: "22 LTS (기본)" },
        { value: "20", label: "20 LTS" },
        { value: "24", label: "24 LTS" },
      ],
      "Node 버전을 입력하세요 (백엔드·프론트엔드가 다르면 함께 적어주세요)",
    );
  }

  if (a.frontend === "vue") {
    v.vue = await ask<VueMajor>(
      select({
        message: "Vue 버전은 무엇입니까?",
        options: [
          { value: "3", label: "3.x (기본)", hint: VERSION_HINT },
          {
            value: "2",
            label: "2.x",
            hint: "vue.md는 Vue 3 + Composition API(<script setup>) 전제",
          },
        ],
      }),
    );
  }

  return v;
}

interface VersionOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * select() with a "그 외 (직접 입력)" escape hatch. Returns the canonical value or free text;
 * an empty free-text answer falls back to the first (default) option.
 */
async function askChoiceOrOther(
  message: string,
  options: [VersionOption, ...VersionOption[]],
  otherPrompt: string,
): Promise<string> {
  const choice = await ask<string>(
    select({
      message,
      options: [
        ...options.map((o) => ({ ...o, hint: o.hint ?? VERSION_HINT })),
        { value: "__other__", label: "그 외 (직접 입력)", hint: VERSION_HINT },
      ],
    }),
  );
  if (choice !== "__other__") return choice;
  const custom = await ask<string>(text({ message: otherPrompt, defaultValue: "" }));
  return custom.trim() || options[0].value;
}

async function askSpring(): Promise<SpringAnswers> {
  const language = await ask<SpringLanguage>(
    select({
      message: "언어는 무엇입니까?",
      options: [
        { value: "java", label: "Java (기본)" },
        { value: "kotlin", label: "Kotlin" },
      ],
    }),
  );

  // WebFlux is Java-only; Kotlin is always MVC.
  let webStack: "mvc" | "webflux" = "mvc";
  if (language === "java") {
    webStack = await ask(
      select({
        message: "웹 스택은 무엇입니까?",
        options: [
          { value: "mvc", label: "Spring MVC (서블릿, 기본)" },
          { value: "webflux", label: "WebFlux (리액티브)" },
        ],
      }),
    );
  }

  const architecture = await ask<SpringArchitecture>(
    select({
      message: "아키텍처 스타일은 무엇입니까?",
      options: [
        { value: "layered", label: "Layered (기본)" },
        { value: "hexagonal", label: "Hexagonal (Ports & Adapters)" },
      ],
    }),
  );

  // WebFlux fixes persistence to R2DBC; MVC asks JPA vs SQL-first.
  let persistence: "jpa" | "sqlfirst" | "r2dbc" = "r2dbc";
  if (webStack === "mvc") {
    persistence = await ask(
      select({
        message: "영속성 도구는 무엇입니까?",
        options: [
          { value: "jpa", label: "JPA (ORM, 기본)" },
          { value: "sqlfirst", label: "SQL-first (JdbcClient + jOOQ, ORM 미사용)" },
        ],
      }),
    );
  }

  const spring: SpringAnswers = {
    language,
    architecture,
    webStack,
    persistence,
    mongodb: false,
    queryTools: false,
    reactiveMongo: false,
    rdb: "PostgreSQL",
  };

  // Hexagonal flavor only for Hexagonal + JPA + MVC.
  if (architecture === "hexagonal" && persistence === "jpa" && webStack === "mvc") {
    spring.hexagonalFlavor = await ask(
      select({
        message: "헥사고날 flavor는 무엇입니까?",
        options: [
          { value: "clean", label: "Clean (엄격, 기본)" },
          { value: "pragmatic", label: "Pragmatic (실용)" },
        ],
      }),
    );
  }

  if (persistence === "jpa") {
    spring.mongodb = await ask(
      select({
        message: "MongoDB도 함께 사용합니까?",
        options: [
          { value: false, label: "JPA만 사용 (기본)" },
          { value: true, label: "JPA + MongoDB 함께 사용" },
        ],
      }),
    );
    spring.queryTools = await ask(
      select({
        message: "Repository 조회 도구로 QueryDSL/jOOQ까지 쓸 계획이 있습니까?",
        options: [
          { value: false, label: "Specification까지만 사용 (기본)" },
          { value: true, label: "QueryDSL/jOOQ까지 쓸 계획 있음" },
        ],
      }),
    );
  }

  if (webStack === "webflux") {
    spring.reactiveMongo = await ask(
      select({
        message: "리액티브 MongoDB도 함께 사용합니까?",
        options: [
          { value: false, label: "R2DBC만 사용 (기본)" },
          { value: true, label: "R2DBC + 리액티브 MongoDB 함께 사용" },
        ],
      }),
    );
  }

  spring.rdb = await askRdb();
  return spring;
}

async function askNest(area: Area): Promise<NestAnswers> {
  const persistence = await ask<NestPersistence>(
    select({
      message: "영속성 도구는 무엇을 사용합니까?",
      options: [
        { value: "typeorm", label: "TypeORM" },
        { value: "prisma", label: "Prisma" },
        { value: "sqlfirst", label: "사용 안 함 (SQL-first, Kysely)" },
      ],
    }),
  );
  const validation = await ask<NestValidation>(
    select({
      message: "입력 검증 도구는 무엇을 사용합니까?",
      options: [
        { value: "classvalidator", label: "class-validator (기본)" },
        { value: "zod", label: "Zod (nestjs-zod)" },
      ],
    }),
  );
  const nest: NestAnswers = { persistence, validation };
  if (area === "fullstack") {
    const root = await ask<string>(
      text({
        message: "프론트엔드 소스 루트 경로는? (예: apps/web, frontend — 비우면 생략)",
        placeholder: "apps/web",
        defaultValue: "",
      }),
    );
    if (root.trim()) nest.frontendRoot = root.trim();
  }
  return nest;
}

async function askFastapi(): Promise<FastapiAnswers> {
  const orm = await ask<boolean>(
    select({
      message: "SQLAlchemy ORM을 사용합니까?",
      options: [
        { value: true, label: "ORM 사용 (기본)" },
        { value: false, label: "SQL-first (Core/async 드라이버만)" },
      ],
    }),
  );
  const rdb = await askRdb();
  return { orm, rdb };
}

async function askRdb(): Promise<string> {
  const choice = await ask<string>(
    select({
      message: "주 관계형 데이터베이스(RDB)는 무엇입니까?",
      options: [
        { value: "PostgreSQL", label: "PostgreSQL (기본, 가장 흔함)" },
        { value: "MySQL", label: "MySQL (흔함)" },
        { value: "MariaDB", label: "MariaDB" },
        { value: "__other__", label: "그 외 (직접 입력)" },
      ],
    }),
  );
  if (choice === "__other__") {
    const custom = await ask<string>(
      text({ message: "DB 이름을 입력하세요 (예: Oracle, SQL Server, SQLite)", defaultValue: "" }),
    );
    return custom.trim() || "PostgreSQL";
  }
  return choice;
}
