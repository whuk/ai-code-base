---
description: NestJS 검증 규칙 — Zod(nestjs-zod) (스키마 기반 검증, nestjs.md 전제)
globs: "**/*.controller.ts,**/*.service.ts,**/*.module.ts,**/*.entity.ts,**/*.repository.ts"
---

# NestJS 검증 규칙 — Zod (nestjs-zod)

`nestjs.md` 3번의 Command/Query 분리와 다중 진입점 방어 원칙을 전제로, Zod 스키마 기반 검증(`nestjs-zod`)을 검증 도구로 채택한 프로젝트의 구체 구현만 다룬다.

이 프로젝트가 `class-validator`를 채택했다면 이 파일은 적용 대상이 아니다. 검증 도구는 한 프로젝트에서 하나로 통일하므로, 실제로 채택하지 않은 도구의 규칙 파일은 프로젝트에서 제외한다 (`nestjs-validation-classvalidator.md` 참조).

## 1. 검증 스키마

- Controller 입력과 Command/Query의 형식 규칙은 Zod 스키마로 정의하고, `nestjs-zod`로 파이프/DTO에 연결한다.
- 연관 파라미터 4개 이상을 묶은 Value Object는 중첩 Zod 스키마로 표현해 계층 검증이 되도록 한다(`shared/architecture.md` 4번).

## 2. 다중 진입점 방어

- Command/Query에도 Controller 입력과 동일한 Zod 스키마 검증을 적용한다(`nestjs.md` 3번, `shared/architecture.md` 5번).
- HTTP 파이프뿐 아니라 Command 생성 시점에 해당 Zod 스키마의 `parse()`를 직접 호출해, HTTP 경로를 거치지 않는 호출(메시지 컨슈머, 배치, 다른 서비스의 직접 호출)도 방어한다.

## 3. 금지 패턴

- Command/Query 생성 경로에 Zod 스키마 검증을 누락하지 않는다(HTTP 경로 외 진입점이 무방비가 된다).
- 비즈니스 규칙 검증(잔액 부족, 중복 가입 등)을 Zod 스키마에 넣지 않는다 — 형식 검증은 Zod, 비즈니스 검증은 Domain의 몫이다(`shared/architecture.md` 5번).
