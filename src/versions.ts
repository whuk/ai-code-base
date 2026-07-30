// Report-only version premise checks — /rw:init step 3 "언어·프레임워크 버전 — 보고만".
//
// Versions never change the selection: the surviving file set is identical whatever
// version is answered, and rule bodies are never edited. The only effect is a warning
// when a *surviving* rule's minimum premise is unmet. Pure functions, no file I/O.
//
// A warning fires only when the shortfall is established. Free text we cannot classify
// stays silent (it appears in the summary instead) — guessing would produce false alarms.

import type { Answers, PruneResult, VersionAnswers } from "./types.js";

/** Leading integer of a version string: "21" -> 21, "1.8.0_402" -> 1. */
function major(v: string | undefined): number | undefined {
  const m = v?.match(/\d+/);
  return m ? Number(m[0]) : undefined;
}

/** "3.13" -> [3, 13]. Requires both parts, so a bare "3" stays unclassified. */
function majorMinor(v: string | undefined): [number, number] | undefined {
  const m = v?.match(/(\d+)\s*\.\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : undefined;
}

type BootTier = "3.2plus" | "3.0to3.1" | "2x";

/** Canonical tier, or one derived from free text like "3.1.5". Undefined = unclassifiable. */
function bootTier(raw: string | undefined): BootTier | undefined {
  if (!raw) return undefined;
  if (raw === "3.2plus" || raw === "3.0to3.1" || raw === "2x") return raw;

  const mm = majorMinor(raw);
  if (mm) {
    const [maj, min] = mm;
    if (maj >= 4) return "3.2plus";
    if (maj === 3) return min >= 2 ? "3.2plus" : "3.0to3.1";
    return "2x";
  }
  // Major only ("3", "2"): 3.x is ambiguous for the JdbcClient premise, 2.x is not.
  const maj = major(raw);
  if (maj !== undefined && maj <= 2) return "2x";
  return undefined;
}

/** Final output set: kept files plus rename targets. */
function survivors(result: PruneResult): Set<string> {
  return new Set([...result.keep, ...result.renames.map((r) => r.to)]);
}

function has(files: Set<string>, suffix: string): boolean {
  for (const f of files) if (f.endsWith(suffix)) return true;
  return false;
}

export function versionNotices(a: Answers, result: PruneResult): string[] {
  const v = a.versions;
  if (!v) return [];

  const out: string[] = [];
  const kept = survivors(result);

  if (a.spring) {
    const jdk = major(v.jdk);
    if (jdk !== undefined && jdk < 17) {
      out.push(
        `JDK ${v.jdk}: Java rules 전반이 record·sealed interface를 Command/Query·Read DTO·Value Object의 기본 표현 수단으로 씁니다(JDK 17+ 전제). 규칙 대부분이 문법적으로 성립하지 않으므로 JDK 상향 또는 rules 수정이 필요합니다.`,
      );
    }

    const boot = bootTier(v.springBoot);

    // Spring Boot 3.2+ / Framework 6.1+ — JdbcClient. Only if a rule that depends on it survived.
    if (boot === "3.0to3.1" || boot === "2x") {
      const sqlFirst = has(kept, "/repository-sql.md");
      const queryTools = has(kept, "/repository-tools.md");
      if (sqlFirst) {
        out.push(
          `Spring Boot ${bootLabel(boot)}: JdbcClient(Boot 3.2+ / Framework 6.1+)가 없습니다. SQL-first는 모든 영속성 접근을 JdbcClient로 실행하는 것이 전제(repository-sql.md)라 영속성 규칙의 기반 자체가 없습니다. Boot 상향이 사실상 필수입니다.`,
        );
      } else if (queryTools) {
        out.push(
          `Spring Boot ${bootLabel(boot)}: JdbcClient(Boot 3.2+ / Framework 6.1+)가 없습니다. repository-tools.md의 Level 3 티어(JdbcClient + jOOQ)를 쓸 수 없으므로, Boot를 올리거나 Level 2(QueryDSL)까지만 사용하세요.`,
        );
      }
    }

    // Spring Boot 3+ (Jakarta EE) — the whole Spring rule set assumes jakarta.*.
    if (boot === "2x") {
      out.push(
        `Spring Boot 2.x: Spring rules 전반이 jakarta.persistence.* (Jakarta EE)를 전제하고, QueryDSL도 Jakarta 대응 아티팩트(io.github.openfeign.querydsl 6.x)를 지정합니다. Boot 2.x는 javax.persistence 시대라 패키지 전제와 아티팩트 선택이 모두 어긋납니다. Boot 상향 또는 rules 전반 재검토가 필요합니다.`,
      );
    }
  }

  if (a.fastapi) {
    const py = majorMinor(v.python);
    if (py && (py[0] < 3 || (py[0] === 3 && py[1] < 9))) {
      out.push(
        `Python ${v.python}: fastapi.md는 Pydantic v2·최신 FastAPI를 전제하며 이는 Python 3.9+를 요구합니다. Python 상향이 필요합니다.`,
      );
    }
    if (v.pydantic === "v1") {
      out.push(
        `Pydantic v1 (FastAPI 0.99 이하): fastapi.md 2번의 다중 진입점 방어는 Pydantic v2의 인스턴스화 시점 검증을 근거로 삼습니다. v1에서는 이 논리가 성립하지 않으므로 v2 마이그레이션(FastAPI도 0.100+로 함께 상향) 또는 검증 트리거 재설계가 필요합니다.`,
      );
    }
  }

  if (a.frontend === "vue" && v.vue === "2") {
    out.push(
      `Vue 2: vue.md는 Vue 3 + Vite(1번)와 Composition API·<script setup>(2번)을 전제합니다. Vue 2에서는 핵심 규칙 대부분이 적용 불가하므로 Vue 3 마이그레이션 또는 rules 재작성이 필요합니다.`,
    );
  }

  // Kotlin·Node have no minimum premise in the rules — recorded in the summary only.
  return out;
}

function bootLabel(tier: BootTier): string {
  return tier === "3.2plus" ? "3.2+" : tier === "3.0to3.1" ? "3.0~3.1" : "2.x";
}

/** One-line summary of the collected versions. Empty string when nothing was collected. */
export function versionSummary(v: VersionAnswers | undefined): string {
  if (!v) return "";
  const bits: string[] = [];
  if (v.jdk) bits.push(`JDK=${v.jdk}`);
  if (v.kotlin) bits.push(`Kotlin=${v.kotlin}`);
  if (v.springBoot) bits.push(`Spring Boot=${springBootLabel(v.springBoot)}`);
  if (v.python) bits.push(`Python=${v.python}`);
  if (v.pydantic) bits.push(`Pydantic=${pydanticLabel(v.pydantic)}`);
  if (v.node) bits.push(`Node=${v.node}`);
  if (v.vue) bits.push(`Vue=${v.vue}.x`);
  return bits.join(" / ");
}

function springBootLabel(raw: string): string {
  return raw === "3.2plus" ? "3.2+" : raw === "3.0to3.1" ? "3.0~3.1" : raw === "2x" ? "2.x" : raw;
}

function pydanticLabel(raw: string): string {
  if (raw === "v2") return "v2 (FastAPI 0.100+)";
  if (raw === "v1") return "v1 (FastAPI 0.99 이하)";
  return raw;
}
