---
description: Vue.js 고유 컨벤션
globs: "**/*.vue,**/vite.config.*"
---

# Vue.js 규칙

`typescript.md`의 공통 규칙을 전제로, Vue.js 고유 규칙만 다룬다.

이 프로젝트가 실제로 Next.js나 Vite+React를 채택했다면 이 파일은 적용 대상이 아니다. Vue.js는 React 계열(Next.js/Vite) 프레임워크와 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 프레임워크의 규칙 파일은 프로젝트에서 제외한다 (`nextjs.md`, `vite.md` 참조).

## 1. 프로젝트 구조

- 빌드 도구는 Vite를 사용한다(Vue 3 + Vite가 사실상 표준 조합).
- `src/features/{feature}/` 아래에 `typescript.md` 3번의 feature 구조를 그대로 적용하되, React의 `hooks/`에 대응하는 폴더명은 `composables/`를 사용한다.
- 컴포넌트는 Single File Component(`.vue`)로 작성한다.
- 라우트와 feature는 Vue Router의 라우트 설정 파일(`src/router/`)에서 연결한다. 라우트 컴포넌트가 feature 내부 컴포넌트를 조합하는 역할만 하도록 얇게 유지한다(Vite+React의 페이지 컴포넌트 원칙과 동일).

## 2. Composition API

- Options API 대신 Composition API(`<script setup lang="ts">`)를 기본으로 사용한다. 신규 컴포넌트에 Options API를 사용하지 않는다.
- 재사용 가능한 상태/로직은 `composables/use{Name}.ts`로 추출한다. React 훅과 동일한 역할이며 `use` 접두사 명명 규칙도 동일하게 따른다.
- `ref`/`reactive` 선택 기준: 원시값이나 통째로 교체될 수 있는 객체는 `ref`, 내부 속성만 변경되는 객체는 `reactive`를 사용한다. 팀 내에서 기준을 일관되게 적용한다.
- `<script setup>`의 최상위 코드는 컴포넌트 인스턴스가 생성될 때마다 실행된다. CVA variant 정의, 정규식 컴파일 등 재사용 가능한 상수/객체는 `<script setup>` 블록이 아닌 모듈 스코프(별도 파일 또는 블록 바깥)에 선언한다(`typescript.md` 5번과 동일한 원칙).

## 3. 환경변수

- `import.meta.env`로 접근한다. 커스텀 환경변수를 추가하면 `env.d.ts`에서 `ImportMetaEnv` 인터페이스를 확장해 타입을 선언한다.
- 브라우저에 노출돼야 하는 값만 `VITE_` 프리픽스를 붙인다.

## 4. 라우팅

- Vue Router를 사용한다. 라우트 정의는 `src/router/index.ts`에 모으고, 라우트 단위로 동적 `import()`를 사용해 코드 스플리팅한다.
- 라우트 파라미터/쿼리의 타입 안전성이 필요하면 `unplugin-vue-router` 같은 typed-route 도구 도입을 검토한다. 팀 규모가 작으면 수동 타입 선언으로 시작해도 된다.

## 5. 상태관리

- 서버 상태는 `@tanstack/vue-query`(TanStack Query의 Vue 바인딩)로 관리한다. `typescript.md` 4번의 서버/클라이언트 상태 분리 원칙을 그대로 따른다.
- 클라이언트 상태는 Pinia를 사용한다(Vue 생태계에서 Zustand에 대응하는 선택). Vuex는 신규 프로젝트의 기본값이 아니다 — 기존 Vuex 프로젝트를 유지보수하는 경우에만 예외로 허용한다(`typescript.md` 4번의 Redux 예외와 동일한 사상).

## 6. 스타일링

- Tailwind CSS, CVA, `cn()` 유틸 등 `typescript.md` 5번의 원칙을 그대로 따른다.
- 재사용 UI 컴포넌트는 shadcn-vue(shadcn/ui의 Vue 포트)를 우선 검토한다. React 전용 shadcn/ui 컴포넌트를 변환 없이 그대로 가져오지 않는다.

## 7. 테스트

- Unit/Integration 테스트는 Vitest + Vue Testing Library(`@testing-library/vue`)를 사용하고, `typescript.md` 6번과 동일하게 테스트 대상 소스와 같은 디렉토리에 colocate한다.
- 접근성 role/label/텍스트 기반으로 쿼리한다(`typescript.md` 6번과 동일한 원칙). Vue Test Utils의 `wrapper.vm`으로 컴포넌트 내부 상태/메서드를 직접 조작하는 방식은 다른 방법이 마땅치 않을 때만 사용한다.

## 8. 금지 패턴

- 신규 컴포넌트에 Options API를 사용하지 않는다.
- Vuex를 신규 프로젝트의 상태관리 도구로 채택하지 않는다(기존 프로젝트 유지보수 예외 제외).
- React 전용 라이브러리(React Testing Library, react-hook-form 등)를 변환 없이 Vue 프로젝트에 그대로 가져오지 않는다.
- `<script setup>` 블록 내부에서 CVA variant 객체를 매 컴포넌트 인스턴스 생성마다 새로 선언하지 않는다(모듈 스코프 사용).
