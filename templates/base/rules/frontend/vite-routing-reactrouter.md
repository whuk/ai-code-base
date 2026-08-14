---
description: Vite + React 라우팅 규칙 — React Router (vite.md 전제)
paths:
  - "**/vite.config.*"
  - "**/vite-env.d.ts"
  - "**/src/routes/**"
  - "**/src/features/**"
---

# Vite + React 라우팅 규칙 — React Router

`vite.md`의 Vite + React 공통 규칙을 전제로, React Router를 라우팅 라이브러리로 채택한 프로젝트의 규칙만 다룬다.

이 프로젝트가 TanStack Router를 채택했다면 이 파일은 적용 대상이 아니다. 라우팅 라이브러리는 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 라이브러리의 규칙 파일은 프로젝트에서 제외한다 (`vite-routing-tanstack.md` 참조).

## 1. 선택 근거

- 낮은 러닝커브나 SSR/풀스택 전환 가능성이 더 중요하면 React Router를 채택한다.

## 2. 적용

- 라우트와 feature는 React Router의 라우트 설정 파일에서 연결하고, 페이지/라우트 컴포넌트는 feature 내부 컴포넌트를 조합하는 역할만 하도록 얇게 유지한다(`vite.md` 1번).
- 라우트 단위 코드 스플리팅은 `vite.md` 4번을 따른다.
