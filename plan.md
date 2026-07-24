# 기능 개요

`claude-code-base`는 현재 Claude Code 전용 템플릿(`.claude/` 하위의 rules/agents/commands)이다. 이를 **어느 코딩 에이전트에서도 쓸 수 있는 스캐폴딩 CLI**로 재구성한다.

`npx <tool>` 실행 → `/rw:init`과 동일한 스택 질문 → 추가로 "타깃 에이전트(claude/gemini/codex) + output 디렉토리" 질문 → 선택한 스택에 맞게 선별된 규칙/에이전트/커맨드를 **타깃 에이전트 포맷으로** output 디렉토리에 생성한다. 사용자는 그 결과물을 원하는 코딩 에이전트에서 그대로 사용한다.

핵심 통찰: `/rw:init`은 Claude Code 세션 안에서 LLM이 실행하는 슬래시 커맨드지만, 그 3단계 선별 규칙은 **결정론적 매핑**(스택 답변 → keep/delete/rename 파일 목록)이므로 그대로 JS/TS 코드로 이식 가능하다.

## 확정된 설계 결정

- **규칙(rules) 배치 (Gemini/Codex)**: 참조형 — 규칙은 별도 파일로 두고 `GEMINI.md`/`AGENTS.md`에서 목차·import로 참조한다. (두 도구 모두 글롭 기반 조건부 로딩 미지원)
- **입력 방식**: 순수 대화형 질문만. 기존 프로젝트 스캔 자동 감지는 넣지 않는다. (`/rw:init`의 1단계 자동 감지 로직은 이식하지 않음)
- **변환 범위**: rules + agents + commands 전부를 타깃 포맷으로 변환한다.

# 구현 목표

- `claude-code-base/.claude/`의 콘텐츠를 에이전트-중립 템플릿(`templates/base/`)으로 추출한다.
- `/rw:init` 2단계 질문 트리를 대화형 CLI로 이식하고, 마지막에 타깃 에이전트·output 디렉토리 2질문을 추가한다.
- `/rw:init` 3단계 keep/delete/rename 선별 규칙 전체를 결정론적 순수 함수로 이식한다.
- claude / gemini / codex 3개 타깃 포맷 출력기를 구현한다.
- `/rw:init` 결과 보고(스택 요약·삭제/rename 목록·주의문)를 이식한다.
- `npx`로 실행 가능한 형태로 배포 설정을 완성한다.

# 설계

## 패키지 구조

```
.                                # 프로젝트 루트 (단일 패키지)
├── templates/base/              # 에이전트-중립 원본 (claude-code-base에서 추출)
│   ├── agents/  commands/rw/  rules/
│   ├── context.md               # 현재 CLAUDE.md (방법론 본문)
│   └── settings.json
├── src/
│   ├── questionnaire.ts         # 2단계 질문 트리 + 추가 2질문
│   ├── prune.ts                 # 3단계 선별: 답변 → 생존 파일셋 + rename 맵
│   ├── report.ts                # 결과 보고 (RDB/에이전트 주의문 포함)
│   ├── transform/               # 공통 변환기
│   │   ├── frontmatter.ts       # md+frontmatter ↔ 파싱
│   │   ├── toml.ts              # md → TOML 커맨드 변환
│   │   └── toc.ts              # 참조 목차 생성
│   └── emit/{claude,gemini,codex}.ts   # 포맷별 출력기
└── bin/index.ts                 # CLI 엔트리
```

## 타깃 포맷 매핑

| | 컨텍스트 파일 | 커맨드 | 에이전트 | 규칙 |
|---|---|---|---|---|
| claude | `.claude/CLAUDE.md` | `.claude/commands/rw/*.md` | `.claude/agents/*.md` | `.claude/rules/**/*.md` (globs) |
| gemini | `GEMINI.md` | `.gemini/commands/*.toml` | (Phase 0 확인) | `.gemini/rules/` + GEMINI.md 참조 |
| codex | `AGENTS.md` | `.codex/prompts/*.md` | (Phase 0 확인) | `.codex/rules/` + AGENTS.md 참조 |

## 데이터 흐름

`대화형 질문(answers)` → `prune(answers)` → `{생존 파일셋, rename 맵, 주의사항}` → `emit[타깃](파일셋, outputDir)` → `report(요약, 주의사항)`

## 기술 스택

- Node + TypeScript, `npx` 배포용 `bin` 엔트리
- 프롬프트: `@clack/prompts` 또는 `prompts` (분기형 질문)
- TOML: `@iarna/toml`, frontmatter: `gray-matter`

# 작업 계획

## Phase 0: 타깃 포맷 리서치

- [x] Gemini CLI의 컨텍스트 파일(`GEMINI.md`)·커맨드(`.gemini/commands/*.toml`) 스펙을 문서로 확정한다
- [x] Gemini CLI의 서브에이전트 지원 여부와 포맷을 확인한다 (미지원 시 폴백 전략 결정)
- [x] Codex CLI의 컨텍스트 파일(`AGENTS.md`)·프롬프트(`.codex/prompts/*.md`) 경로·frontmatter를 확정한다
- [x] Codex CLI의 에이전트 개념 유무와 폴백 전략을 확인한다
- [x] 3개 타깃의 포맷 매핑 표를 완성해 리서치 문서로 남긴다

## Phase 1: 템플릿 추출

- [x] `claude-code-base/.claude/`의 agents/commands/rules/CLAUDE.md/settings.json을 `templates/base/`로 카피하는 스크립트가 전체 파일을 누락 없이 복사하는지 검증한다
- [x] `.claude/` 종속 경로·이름 변환은 base를 정본으로 두고 emit 계층에서 타깃별로 처리(설계 결정 — base 원문 훼손 방지)
- [x] 추출된 템플릿의 파일 개수·디렉토리 구조가 원본과 일치하는지 검증한다

## Phase 2: 질문 엔진

- [x] "영역"(백엔드만/프론트만/풀스택) 질문이 올바른 선택지를 제시하는지 검증한다
- [x] 백엔드 스택 선택(Spring/NestJS/FastAPI)에 따라 후속 질문이 분기되는지 검증한다
- [x] Spring 선택 시 언어·아키텍처·웹스택·영속성·MongoDB·QueryDSL·RDB 질문이 조건에 맞게 순차 노출되는지 검증한다
- [x] Hexagonal+JPA+MVC일 때만 헥사고날 flavor(Clean/Toby) 질문이 나오는지 검증한다
- [x] NestJS 선택 시 영속성·검증 도구 질문이, FastAPI 선택 시 ORM·RDB 질문이 나오는지 검증한다
- [x] 프론트엔드 선택 시 프레임워크(Next.js/Vite/Vue)·Vite 라우팅 질문이 나오는지 검증한다
- [x] 마지막에 타깃 에이전트(claude/gemini/codex) 질문이 나오는지 검증한다
- [x] output 디렉토리 질문에서 미입력 시 현재 디렉토리(cwd)로 기본 설정되는지 검증한다

## Phase 3: 선별 엔진 (prune)

- [x] 백엔드 미포함 시 backend rules 전체와 백엔드 에이전트가 제외되는지 검증한다
- [x] Spring 선택 시 nestjs/fastapi rules·에이전트가 제외되는지 검증한다
- [x] 언어 Java 선택 시 `spring/kotlin/`이, Kotlin 선택 시 `spring/java/`가 제외되는지 검증한다
- [x] Layered 선택 시 `hexagonal/`·`api-code-first.md`·hexagonal 에이전트가 제외되는지 검증한다
- [x] Hexagonal 선택 시 `layered/`·Layered 전제 에이전트가 제외되는지 검증한다
- [x] Hexagonal+JPA+MVC+Clean 선택 시 Toby 변형 파일이 제외되는지 검증한다
- [x] Hexagonal+JPA+MVC+Toby 선택 시 Clean 정규 파일이 제외되고 Toby 변형이 정규 이름으로 rename되는지 검증한다
- [x] WebFlux 선택 시 repository 관련 파일 제외·domain-pure rename이 정확한지 검증한다
- [x] JPA/SQL-first 선택에 따라 repository-sql/repository-tools·domain rename이 정확한지 검증한다
- [x] JPA-only(MongoDB 미사용) 선택 시 `test-mongodb.md`가 제외되는지 검증한다
- [x] Specification까지만 선택 시 `repository-tools.md`가 제외되는지 검증한다
- [x] NestJS 영속성/검증 도구 선택에 따라 해당 rules만 남는지 검증한다
- [x] FastAPI ORM/SQL-first 선택에 따라 해당 persistence rule만 남는지 검증한다
- [x] 프론트엔드 프레임워크 선택에 따라 vite/vue/nextjs rules·에이전트가 정확히 제외되는지 검증한다
- [x] Vite 라우팅 라이브러리 선택에 따라 해당 라우팅 rule만 남는지 검증한다
- [x] prune 결과가 파일 편집 없이 keep/delete/rename 목록만 산출하는지 검증한다

## Phase 4: 포맷 출력기

- [x] claude 출력기가 선별 결과를 `<out>/.claude/`에 1:1 복사하는지 검증한다
- [x] gemini 출력기가 context.md를 `GEMINI.md`로 변환하는지 검증한다
- [x] gemini 출력기가 커맨드 md를 `.gemini/commands/*.toml`로 변환하는지 검증한다
- [x] gemini 출력기가 규칙을 별도 파일로 두고 `GEMINI.md`에 참조 목차를 삽입하는지 검증한다
- [x] codex 출력기가 context.md를 `AGENTS.md`로 변환하는지 검증한다
- [x] codex 출력기가 커맨드를 `.codex/prompts/*.md`로 변환하는지 검증한다
- [x] codex 출력기가 규칙을 별도 파일로 두고 `AGENTS.md`에 참조 목차를 삽입하는지 검증한다
- [x] 참조 목차에 "언제 이 규칙을 읽어야 하는가"(글롭 대체 설명)가 포함되는지 검증한다
- [x] 각 타깃의 에이전트 변환이 Phase 0에서 확정한 매핑/폴백대로 동작하는지 검증한다

## Phase 5: 보고 & 마감

- [x] 결과 보고가 선택 스택 조합 요약을 출력하는지 검증한다
- [x] 결과 보고가 삭제/rename된 파일 목록을 출력하는지 검증한다
- [x] NestJS+Zod·JPA-only·Specification까지만 선택 시 에이전트 미수정 주의문이 출력되는지 검증한다
- [x] 비-PostgreSQL RDB 선택 시 드라이버/jOOQ 방언 교체 안내가 출력되는지 검증한다
- [x] `--dry-run` 옵션이 파일을 쓰지 않고 계획만 출력하는지 검증한다
- [x] `npx <tool>`로 실행되는 bin 엔트리가 정상 동작하는지 검증한다
- [x] README에 설치·사용법·타깃별 결과물 설명이 포함되었는지 검증한다

# 리스크 & 검증 포인트

1. **선별 로직 정합성** — Phase 3가 가장 버그나기 쉽다. `/rw:init` 3단계 각 조합에 대한 스냅샷 테스트(스택 조합 → 예상 파일셋)를 필수로 둔다.
2. **Gemini/Codex 에이전트 매핑** — 두 도구의 서브에이전트 지원이 Claude와 다르면 "에이전트를 참조 문서로 폴딩"하는 폴백이 필요하다(Phase 0에서 확정).
3. **참조형 규칙의 실효성** — 조건부 로딩이 안 되므로, 참조 목차에 "언제 이 규칙을 읽어야 하는가"를 명시해 에이전트가 필요 시 열도록 유도한다.
