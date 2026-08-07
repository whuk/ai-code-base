# ai-code-base

**질문 몇 개에 답하면, 내 프로젝트에 맞는 AI 코딩 에이전트 설정이 완성됩니다.**

Kent Beck의 TDD·Tidy First 원칙을 담은 코딩 규칙 · 서브에이전트 · 커맨드 세트를 만들어 주는 CLI입니다. Claude Code, Gemini CLI, Codex CLI 중 쓰는 도구를 고르면 그 도구의 포맷에 맞춰 파일을 생성합니다.

- **고를 필요 없이 걸러 줍니다** — Spring Boot · NestJS · FastAPI · Next.js · Vite · Vue 규칙이 모두 들어 있지만, 답변한 스택에 해당하는 파일만 남습니다.
- **바로 쓸 수 있습니다** — 생성된 폴더를 프로젝트 루트에 옮기면 에이전트가 그대로 읽습니다. 추가 설정이 없습니다.
- **먼저 확인할 수 있습니다** — `--dry-run`으로 무엇이 남고 무엇이 빠지는지 미리 볼 수 있습니다.

## 빠른 시작

Node.js 18 이상만 있으면 됩니다.

```bash
git clone https://github.com/whuk/ai-code-base.git
cd ai-code-base
npm install

npm start                  # 대화형 스캐폴딩 실행
npm start -- --dry-run     # 파일을 쓰지 않고 결과만 미리보기
```

## 무엇을 물어보나요

모든 질문에 기본값이 있어서, 잘 모르겠으면 Enter만 눌러도 됩니다.

| | 질문 | 예시 |
|---|---|---|
| 1 | **어떤 스택인가요** | 백엔드/프론트엔드/풀스택 → 프레임워크 → 세부 선택 |
| 2 | **어떤 코딩 에이전트를 쓰나요** | Claude Code / Gemini CLI / Codex CLI |
| 3 | **어디에 만들까요** | 비우면 `./output` |
| 4 | **버전은 어떻게 되나요** | JDK · Kotlin · Spring Boot · Python · FastAPI · Node · Vue |

세부 선택은 고른 스택에 필요한 것만 물어봅니다. Spring이면 언어·아키텍처 스타일·웹 스택·영속성 도구를, NestJS면 ORM·검증 도구를, Vite면 라우팅 라이브러리를 묻는 식입니다.

버전 질문은 파일 선별에 영향을 주지 않습니다. 생성된 규칙이 전제하는 최소 버전에 못 미칠 때만 마지막 보고에서 알려 주는 용도입니다.

## 무엇이 만들어지나요

고른 에이전트에 맞는 위치와 형식으로 나옵니다.

| | 컨텍스트 | 커맨드 | 에이전트 | 규칙 |
|---|---|---|---|---|
| **Claude Code** | `.claude/CLAUDE.md` | `.claude/commands/**/*.md` | `.claude/agents/*.md` | `.claude/rules/**/*.md` |
| **Gemini CLI** | `GEMINI.md` | `.gemini/commands/**/*.toml` | `.gemini/agents/*.md` | `.gemini/rules/**/*.md` |
| **Codex CLI** | `AGENTS.md` | `.codex/prompts/*.md` | `.codex/agents/*.toml` | `.codex/rules/**/*.md` |

## 바로 쓸 수 있는 PR 리뷰 흐름

스택과 무관하게 코드 리뷰 세트가 항상 함께 만들어집니다. 생성 직후부터 아래 흐름을 쓸 수 있습니다.

1. **`/rw:git:commit-and-push`** — 변경사항을 커밋하고 push 합니다. (PR 생성은 `gh pr create`)
2. **`/rw:git:pr-review [PR번호]`** — 열린 PR을 리뷰하고 심각도(Blocker/Major/Minor/Nit)가 붙은 결과를 PR 코멘트로 남깁니다.
3. **결과를 확인합니다.** Blocker/Major가 있으면 고친 뒤 2번을 다시 실행합니다.
4. **`/rw:git:squash-merge-pull [PR번호]`** — PR을 squash merge 하고 로컬 기본 브랜치를 동기화합니다.

리뷰 커맨드는 코멘트만 남깁니다. 승인·변경요청이나 코드 직접 수정은 하지 않으니, 머지 판단은 사람이 하면 됩니다.

## 그 외 커맨드

리뷰 흐름 말고도 명세·계획·기획 커맨드가 함께 만들어집니다.

| 커맨드 | 역할 |
|---|---|
| `/rw:prd:prd1 [프로젝트 설명]` | 코드베이스를 탐색해 러프 기획 문서 `PRD1.md` 생성 |
| `/rw:prd:prd2 [추가 요구사항]` | `PRD1.md` 위에 상세 설계를 얹어 `PRD2.md` 생성 |
| `/rw:spec:spec <러프한 기능 설명>` | 되묻는 질문 라운드로 구체화해 `spec.md` 생성 (목표·범위·비목표·시나리오·엣지 케이스·실패 시나리오·완료의 정의) |
| `/rw:plan:plan [spec/PRD 경로 또는 기능 설명]` | 작업 계획을 세워 프로젝트 루트에 `plan.md` 생성 |
| `/rw:git:branch` | 작업에 맞는 브랜치 생성 — `plan.md`가 있으면 다음 미완료 테스트에서, 없으면 현재 변경사항에서 이름을 뽑습니다 |
| `/rw:tdd:go` | `plan.md`의 다음 미완료 테스트를 Red-Green 사이클로 구현 |
| `/rw:spec:spec_move` | 끝난 `spec.md`를 요약 키워드가 담긴 이름으로 `specs/`에 아카이빙 |
| `/rw:plan:plan_move` | 끝난 `plan.md`를 요약 키워드가 담긴 이름으로 `plans/`에 아카이빙 |
| `/rw:plan:plan_clean [일수]` | `~/.claude/plans`에 쌓인 플랜 모드 산출물을 목록 확인 후 삭제 (Claude Code 전용) |

기능 하나를 붙이는 흐름은 `spec` → `plan` → `tdd:go` 입니다. `spec.md`는 **무엇을 왜 만들고 어떻게 동작해야 하는가**만 다루고, 클래스·계층·라이브러리 같은 구현 방법은 `plan.md`의 몫입니다. `/rw:spec:spec`은 러프한 설명을 그대로 받아쓰지 않고 최대 4라운드까지 되물으며, 답을 미룬 항목은 추측으로 채우지 않고 "미해결 질문"에 남깁니다.

루트에 `spec.md`가 있으면 `/rw:plan:plan`을 **인자 없이** 실행할 수 있고, 그러면 그 `spec.md`를 입력으로 계획을 세웁니다.

PRD와 `spec.md`는 층위가 다릅니다. **PRD는 제품 전체 기획**, **`spec.md`는 그 안의 개별 기능 명세**입니다. 제품을 처음부터 세운다면 `prd1` → `prd2` 뒤에 기능 하나씩 `/rw:spec:spec`으로 넘기고, 돌아가는 프로젝트에 기능을 붙인다면 PRD 없이 `/rw:spec:spec`부터 시작하면 됩니다. `/rw:plan:plan PRD2.md`로 PRD2 전체를 한 번에 계획으로 옮기는 것도 그대로 동작합니다.

`spec.md`나 `plan.md`가 이미 루트에 있으면 해당 생성 커맨드는 실행되지 않고, 먼저 `spec_move`/`plan_move`로 아카이빙하라고 안내합니다.

`plan_clean`이 다루는 대상은 프로젝트의 `plan.md`가 아니라, **플랜 모드가 `~/.claude/plans`에 남기는 파일**입니다. 전역 디렉토리라 다른 프로젝트의 플랜도 함께 보이므로 목록에 생성 프로젝트를 표시하며, 삭제 전 항상 승인을 받습니다.

이 커맨드는 Claude Code를 고른 경우에만 만들어집니다. Gemini는 플랜을 `~/.gemini/tmp/<project>/<session>/plans/`에 두고 30일이 지나면 알아서 지우며, Codex는 저장 경로가 공개돼 있지 않습니다.

생성물에는 `/rw:init`도 들어 있지만, 이 CLI로 만든 결과는 이미 스택에 맞게 선별된 상태라 다시 실행할 필요가 없습니다.

## 알아두면 좋은 것

**Codex를 쓴다면** 커스텀 프롬프트가 홈 디렉토리에서만 로드됩니다. 생성된 `.codex/prompts/`를 `~/.codex/prompts/`로 복사하거나 심링크하세요. 커맨드 이름도 파일명 기반입니다 (`/rw:git:pr-review` → `rw-git-pr-review.md`).

**Gemini·Codex의 규칙 로딩 방식** — 두 도구는 Claude Code처럼 glob으로 규칙을 조건부 로딩하지 못합니다. 그래서 규칙을 별도 파일로 두고, 컨텍스트 파일(`GEMINI.md` / `AGENTS.md`)에 "언제 어떤 규칙을 읽어야 하는지" 안내 섹션을 함께 생성합니다.

## 직접 고쳐 쓰려면

규칙 내용을 프로젝트에 맞게 바꾸거나 기능을 손보고 싶을 때 참고하세요.

```bash
npm install
npm test          # prune 스냅샷 + emit e2e 테스트
npm run build     # dist/ 컴파일 (bin: rw-base)
```

### 프로젝트 구조

```
templates/base/     # 에이전트-중립 정본 템플릿 — 규칙 원문은 여기서 고칩니다
src/
  questionnaire.ts  # 대화형 질문
  prune.ts          # 스택별 파일 선별 엔진 (keep/delete/rename, 순수 함수)
  versions.ts       # 버전 전제 검증 (보고 전용, 순수 함수)
  emit/             # claude/gemini/codex 포맷 출력기
  report.ts         # 결과 보고
```
