# rw-base

Kent Beck의 TDD·Tidy First 원칙 기반 코딩 규칙/서브에이전트/커맨드를 **Claude Code · Gemini CLI · Codex CLI** 중 원하는 도구 포맷으로 스캐폴딩하는 CLI입니다.

`claude-code-base` 템플릿(Spring Boot / NestJS / FastAPI 백엔드와 TypeScript / Next.js / Vite / Vue 프론트엔드)을 실제 스택에 맞게 **선별**하고, 대상 에이전트 포맷으로 **변환**해 출력합니다.

## 사용법

```bash
npx rw-base
```

대화형으로 스택을 묻고(`/rw:init`과 동일한 질문), 마지막에 **대상 코딩 에이전트**와 **출력 디렉토리**(비우면 현재 디렉토리)를 묻습니다. 선택한 스택에 맞는 파일만 대상 포맷으로 생성됩니다.

```bash
npx rw-base --dry-run   # 파일을 쓰지 않고 선별/제외 결과만 미리보기
```

## 대상별 출력 포맷

| | 컨텍스트 | 커맨드 | 에이전트 | 규칙 |
|---|---|---|---|---|
| **claude** | `.claude/CLAUDE.md` | `.claude/commands/**/*.md` | `.claude/agents/*.md` | `.claude/rules/**/*.md` (globs 조건부 로딩 유지) |
| **gemini** | `GEMINI.md` (+규칙 참조 섹션) | `.gemini/commands/**/*.toml` | `.gemini/agents/*.md` | `.gemini/rules/**/*.md` |
| **codex** | `AGENTS.md` (+규칙 참조 섹션) | `.codex/prompts/*.md` | `.codex/agents/*.toml` | `.codex/rules/**/*.md` |

Gemini/Codex는 글롭 기반 조건부 규칙 로딩을 네이티브로 지원하지 않으므로, 규칙은 별도 파일로 두고 컨텍스트 파일(`GEMINI.md`/`AGENTS.md`)에 "언제 어떤 규칙을 읽어야 하는지" 참조 섹션을 생성합니다.

### Codex 주의
- Codex 커스텀 프롬프트는 홈 디렉토리(`~/.codex/prompts/`)에서만 로드됩니다. 생성된 `.codex/prompts/`를 그리로 복사/심링크하세요.
- Codex `AGENTS.md`는 import를 지원하지 않아 규칙은 참조 목차로만 링크되며, 에이전트가 필요 시 직접 읽습니다.

## 개발

```bash
npm install
npm test          # prune 스냅샷 + emit e2e 테스트
npm run build     # dist/ 컴파일
npm run dev       # tsx로 CLI 실행
```

## 구조

```
templates/base/     # 에이전트-중립 정본 템플릿 (claude-code-base에서 추출)
src/
  questionnaire.ts  # 대화형 질문 (rw:init 2단계 + 대상/출력 2질문)
  prune.ts          # 선별 엔진 (rw:init 3단계 keep/delete/rename, 순수 함수)
  emit/             # claude/gemini/codex 포맷 출력기
  report.ts         # 결과 보고
docs/format-research.md  # 3개 타깃 포맷 리서치 근거
```

## 원본 명세 대비 개선

- `rw:init` 3단계는 프론트엔드로 Next.js/Vue를 고를 때 `vite-routing-*.md`(Vite 전용 라우팅 규칙)를 삭제 목록에서 누락합니다. `rw-base`는 이를 죽은 규칙으로 보고 삭제합니다.
