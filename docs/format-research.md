# Phase 0 — 타깃 포맷 리서치 결과

3개 타깃 코딩 에이전트의 설정 포맷 확정. Phase 4 출력기 설계 근거.

## 매핑 표

| 관심사 | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| 컨텍스트/지침 | `.claude/CLAUDE.md` | `GEMINI.md` (`@import` 지원, 계층 로딩) | `AGENTS.md` (계층 concat, **import 미지원**) |
| 슬래시 커맨드 | `.claude/commands/**/*.md` | `.gemini/commands/**/*.toml` (`prompt` 필수, `description` 선택) | `~/.codex/prompts/*.md` (홈 전용·**deprecated**) |
| 서브에이전트 | `.claude/agents/*.md` (md+frontmatter) | `.gemini/agents/*.md` (md+YAML frontmatter, `name`+`description` 필수) | `.codex/agents/*.toml` (TOML: `name`·`description`·`developer_instructions`) |
| 글롭 조건부 규칙 | rules `globs` frontmatter | **미지원** | **미지원** |
| 설정 | `.claude/settings.json` | `.gemini/settings.json` | `.codex/config.toml` |

## 타깃별 상세

### Gemini CLI — 이식 난이도 낮음
- **커맨드 네임스페이싱 정확 일치**: `.gemini/commands/rw/init.toml` → `/rw:init`. 경로 구분자 → 콜론.
- **커맨드 TOML**: `prompt`(필수), `description`(선택). 인자 `{{args}}`, 셸 주입 `!{...}`, 파일 주입 `@{...}`.
- **서브에이전트**: md+YAML frontmatter. `name`/`description` 필수. `tools`(배열, 와일드카드 가능), `model`, `temperature`, `max_turns` 등. **Claude 에이전트와 거의 동일** → frontmatter 소폭 조정만.
- **GEMINI.md `@import`**: `@./path.md`, `@/abs.md` 지원 → **참조형 규칙에 이상적**. 규칙 파일을 `@import`로 링크 가능.
- **settings.json**: `context.fileName`으로 컨텍스트 파일명 변경 가능(AGENTS.md 호환도 이걸로).

### Codex CLI — 이식 난이도 중간
- **컨텍스트 `AGENTS.md`**: 계층 concat, **import/include 미지원**(issue #17401 open). → 참조형 규칙은 "인덱스(파일 경로 + 언제 읽을지) + 별도 파일" 방식으로. 에이전트가 필요 시 파일을 직접 읽음.
- **커맨드**: `~/.codex/prompts/*.md`, 홈 전용·프로젝트 스코프 없음·deprecated. frontmatter `description`/`argument-hint`, 인자 `$1`~`$9`/`$ARGUMENTS`. → **출력 결정 필요**(아래).
- **서브에이전트**: `.codex/agents/*.toml`(프로젝트 스코프 O). `name`·`description`·`developer_instructions`(문자열=시스템 프롬프트) 필수. `model`·`model_reasoning_effort`·`sandbox_mode` 등 선택. → md 본문을 `developer_instructions` 문자열로.
- **config.toml**: `model`, `approval_policy`, `sandbox_mode`, `[mcp_servers.<name>]` 등.

## 참조형 규칙(rules) 배치 결정

글롭 조건부 로딩이 Claude 전용이므로:
- **claude**: rules를 `.claude/rules/`에 원본 frontmatter(`globs`) 그대로 → 네이티브 조건부 로딩 유지.
- **gemini**: rules를 `.gemini/rules/`에 두고, `GEMINI.md`에 참조 섹션(각 규칙: 파일 경로 + `globs` → "언제 읽어야 하는가" 설명) 생성. `@import`는 무조건 로딩이라 토큰 절약을 위해 목차+수동 참조를 기본으로, 핵심 규칙만 선택적 `@import`.
- **codex**: rules를 `.codex/rules/`(또는 프로젝트 하위)에 두고, `AGENTS.md`에 동일한 참조 섹션(import 불가하므로 파일 경로 나열 + 언제 읽을지). 에이전트가 필요 시 직접 read.

## Phase 4에서 확정할 미결 사항
1. **Codex 커맨드 출력 위치**: 홈 전용(`~/.codex/prompts/`)이므로 output 디렉토리엔 `.codex/prompts/`로 내보내되, "이 디렉토리를 `~/.codex/prompts/`로 복사/심링크하라"고 안내. (skills 대안은 후속.)
2. **에이전트 frontmatter 매핑**: Claude `tools: '*'`/`model: inherit` → Gemini(`tools` 생략 시 전체, `model` 생략 시 세션 모델) / Codex(`developer_instructions`로 본문 이동, 모델 필드 선택).
3. **모델 ID 하드코딩 금지**: 각 도구의 모델명은 변동성 크므로 비워두고 사용자 조정 유도.
