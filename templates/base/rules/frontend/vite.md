---
description: Vite + React 고유 컨벤션
paths:
  - "**/vite.config.*"
  - "**/vite-env.d.ts"
  - "**/src/routes/**"
  - "**/src/features/**"
---

# Vite + React 규칙

`typescript.md`의 공통 규칙을 전제로, Vite + React 고유 규칙만 다룬다.

이 프로젝트가 실제로 Next.js나 Vue.js를 채택했다면 이 파일은 적용 대상이 아니다. Next.js, Vite, Vue.js를 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 프레임워크의 규칙 파일은 프로젝트에서 제외한다 (`nextjs.md`, `vue.md` 참조).

## 1. 프로젝트 구조

- `src/features/{feature}/` 아래에 `typescript.md` 3번의 feature 구조를 그대로 적용한다.
- 라우트와 feature는 라우팅 라이브러리의 라우트 설정 파일(`src/routes/` 등)에서 연결한다. 페이지 컴포넌트가 feature 내부 컴포넌트를 조합하는 역할만 하도록 얇게 유지한다.

## 2. 환경변수

- `import.meta.env`로 접근한다. 커스텀 환경변수를 추가하면 `vite-env.d.ts`에서 `ImportMetaEnv` 인터페이스를 확장해 타입을 선언한다.
- 브라우저에 노출돼야 하는 값만 `VITE_` 프리픽스를 붙인다.

## 3. 라우팅

- 라우팅 라이브러리를 프로젝트 시작 시점에 하나로 고정한다. 선택 기준과 라이브러리별 적용은 채택한 라우팅 파일(`vite-routing-*.md`)을 따른다.

## 4. Alias와 코드 스플리팅

- `@/` 등 절대경로 alias는 `vite.config.ts`의 `resolve.alias`에 정의하고, `tsconfig.json`의 `paths`와 값을 일치시킨다.
- 라우트 단위로 동적 `import()`를 사용해 코드 스플리팅한다. 여러 모듈을 한 번에 lazy-import해야 하면 `import.meta.glob`을 사용한다.

## 5. 금지 패턴

- `resolve.alias`와 `tsconfig.json`의 `paths` 값이 어긋나지 않게 한다.
- 라우팅 라이브러리를 프로젝트 중간에 이유 없이 교체하지 않는다.
