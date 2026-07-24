// Shared domain model: the answers produced by the questionnaire (Phase 2)
// and consumed by the prune engine (Phase 3). Mirrors /rw:init step 2 questions.

export type Area = "backend" | "frontend" | "fullstack";
export type BackendStack = "spring" | "nestjs" | "fastapi";
export type FrontendFramework = "nextjs" | "vite" | "vue";

export type SpringLanguage = "java" | "kotlin";
export type SpringArchitecture = "layered" | "hexagonal";
export type SpringWebStack = "mvc" | "webflux";
export type SpringPersistence = "jpa" | "sqlfirst" | "r2dbc";
export type HexagonalFlavor = "clean" | "toby";

export type NestPersistence = "typeorm" | "prisma" | "sqlfirst";
export type NestValidation = "classvalidator" | "zod";

export type ViteRouting = "tanstack" | "reactrouter";

export type TargetAgent = "claude" | "gemini" | "codex";

export interface SpringAnswers {
  language: SpringLanguage;
  architecture: SpringArchitecture;
  webStack: SpringWebStack;
  /** For WebFlux this is fixed to "r2dbc". For MVC it is "jpa" | "sqlfirst". */
  persistence: SpringPersistence;
  /** Only meaningful when architecture=hexagonal && persistence=jpa && webStack=mvc. */
  hexagonalFlavor?: HexagonalFlavor;
  /** JPA only: whether MongoDB is also used. */
  mongodb: boolean;
  /** JPA only: whether QueryDSL/jOOQ tier is planned. */
  queryTools: boolean;
  /** WebFlux only: whether reactive MongoDB is also used. */
  reactiveMongo: boolean;
  /** Primary RDB. Report-only; never drives file edits. */
  rdb: string;
}

export interface NestAnswers {
  persistence: NestPersistence;
  validation: NestValidation;
  /** Fullstack only: frontend source root (report-only glob hint). */
  frontendRoot?: string;
}

export interface FastapiAnswers {
  /** true = SQLAlchemy ORM, false = SQL-first. */
  orm: boolean;
  /** Primary RDB. Report-only. */
  rdb: string;
}

export interface ViteAnswers {
  routing: ViteRouting;
}

export interface StackAnswers {
  area: Area;
  backend?: BackendStack;
  spring?: SpringAnswers;
  nestjs?: NestAnswers;
  fastapi?: FastapiAnswers;
  frontend?: FrontendFramework;
  vite?: ViteAnswers;
}

export interface OutputAnswers {
  target: TargetAgent;
  /** Absolute or relative path; defaults to process.cwd(). */
  outputDir: string;
}

export type Answers = StackAnswers & OutputAnswers;

/** Result of the prune engine (Phase 3): pure computation, no file I/O. */
export interface PruneResult {
  /** Template-relative paths (posix) that survive selection. */
  keep: string[];
  /** Template-relative paths that are removed. */
  remove: string[];
  /** from -> to, template-relative (posix). Applied after `keep` is computed. */
  renames: Array<{ from: string; to: string }>;
  /** Report-only notices to surface to the user (Phase 5). */
  notices: string[];
}
