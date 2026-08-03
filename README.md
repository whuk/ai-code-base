# rw-base

Kent Beck의 TDD·Tidy First 원칙에 기반한 **코딩 규칙 / 서브에이전트 / 커맨드 세트**를 프로젝트에 스캐폴딩하는 CLI입니다.

내장된 템플릿에는 Spring Boot(Java·Kotlin) · NestJS · FastAPI 백엔드와 Next.js · Vite(React) · Vue 프론트엔드 규칙이 모두 들어 있습니다. 대화형 질문으로 **실제 사용하는 스택만 선별**한 뒤, **Claude Code · Gemini CLI · Codex CLI** 중 선택한 도구의 포맷으로 변환해 출력합니다.

## 설치 및 실행

```bash
npx rw-base
```

```bash
npx rw-base --dry-run   # 파일을 쓰지 않고 선별/제외 결과만 미리보기
```

Node.js 18 이상이 필요합니다.

## 사용 방법

실행하면 순서대로 다음을 묻습니다.

1. **스택** — 백엔드/프론트엔드/풀스택 → 프레임워크 → 세부 선택(Spring이면 언어·아키텍처 스타일·웹 스택·영속성 도구, NestJS면 ORM·검증 도구, Vite면 라우팅 라이브러리 등).
2. **대상 코딩 에이전트** — Claude Code / Gemini CLI / Codex CLI.
3. **출력 디렉토리** — 비우면 `./output`.
4. **언어·프레임워크 버전** — JDK / Kotlin / Spring Boot / Python / FastAPI·Pydantic / Node / Vue.

버전 답변은 파일 선별을 바꾸지 않습니다. 생성된 규칙이 전제하는 최소 버전(JDK 17+의 `record`·`sealed interface`, `JdbcClient`의 Spring Boot 3.2+, Jakarta EE의 Boot 3+, Pydantic v2, Vue 3)에 **미달할 때만** 결과 보고에 경고를 띄우며, 해당 전제를 쓰는 규칙 파일이 실제로 남아 있을 때만 나옵니다.

선택이 끝나면 스택에 맞는 규칙·에이전트·커맨드만 대상 포맷으로 생성됩니다. 결과물을 프로젝트 루트에 두면 해당 코딩 에이전트가 곧바로 읽습니다.

## 대상별 출력 포맷

| | 컨텍스트 | 커맨드 | 에이전트 | 규칙 |
|---|---|---|---|---|
| **claude** | `.claude/CLAUDE.md` | `.claude/commands/**/*.md` | `.claude/agents/*.md` | `.claude/rules/**/*.md` (glob 조건부 로딩 유지) |
| **gemini** | `GEMINI.md` (+규칙 참조 섹션) | `.gemini/commands/**/*.toml` | `.gemini/agents/*.md` | `.gemini/rules/**/*.md` |
| **codex** | `AGENTS.md` (+규칙 참조 섹션) | `.codex/prompts/*.md` | `.codex/agents/*.toml` | `.codex/rules/**/*.md` |

Gemini/Codex는 glob 기반 조건부 규칙 로딩을 지원하지 않으므로, 규칙은 별도 파일로 두고 컨텍스트 파일(`GEMINI.md`/`AGENTS.md`)에 "언제 어떤 규칙을 읽어야 하는지" 참조 섹션을 생성합니다.

**Codex 사용 시**: 커스텀 프롬프트는 홈 디렉토리(`~/.codex/prompts/`)에서만 로드되므로, 생성된 `.codex/prompts/`를 그리로 복사하거나 심링크하세요.

## 생성되는 커맨드 (PR 리뷰 흐름)

스택 선택과 무관하게 코드 리뷰 세트(`rules/code-review.md`, `agents/code-reviewer.md`, `commands/rw/git/pr-review.md`)가 항상 포함됩니다.

1. **`/rw:git:commit-and-push`** — 변경사항을 커밋하고 push 합니다. PR 생성은 `gh pr create`로 합니다.
2. **`/rw:git:pr-review [PR번호]`** — 열린 PR을 `code-reviewer`(+ 남아 있는 스택 전담 리뷰어)로 리뷰하고, 심각도(Blocker/Major/Minor/Nit)가 붙은 결과를 PR 코멘트로 남깁니다. 승인·변경요청·직접 수정은 하지 않습니다.
3. **사람이 결과를 확인합니다.** Blocker/Major가 있으면 수정 후 2번을 다시 실행합니다.
4. **`/rw:git:squash-merge-pull [PR번호]`** — PR을 squash merge 하고 로컬 기본 브랜치를 동기화합니다.

Codex는 커맨드 이름이 파일명 기반입니다(`/rw:git:pr-review` → `.codex/prompts/rw-git-pr-review.md`).

## 개발

```bash
npm install
npm test          # prune 스냅샷 + emit e2e 테스트
npm run build     # dist/ 컴파일
npm run dev       # tsx로 CLI 실행
```

### 구조

```
templates/base/     # 에이전트-중립 정본 템플릿
src/
  questionnaire.ts  # 대화형 질문
  prune.ts          # 스택별 파일 선별 엔진 (keep/delete/rename, 순수 함수)
  versions.ts       # 버전 전제 검증 (보고 전용, 순수 함수)
  emit/             # claude/gemini/codex 포맷 출력기
  report.ts         # 결과 보고
```
