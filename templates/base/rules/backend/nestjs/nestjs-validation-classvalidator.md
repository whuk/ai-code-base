---
description: NestJS 검증 규칙 — class-validator (Command/Query 데코레이터 검증, nestjs.md 전제)
globs: "**/*.controller.ts,**/*.service.ts,**/*.module.ts,**/*.entity.ts,**/*.repository.ts"
---

# NestJS 검증 규칙 — class-validator

`nestjs.md` 3번의 Command/Query 분리와 다중 진입점 방어 원칙을 전제로, `class-validator`를 검증 도구로 채택한 프로젝트의 구체 구현만 다룬다.

이 프로젝트가 Zod(`nestjs-zod`)를 채택했다면 이 파일은 적용 대상이 아니다. 검증 도구는 한 프로젝트에서 하나로 통일하므로, 실제로 채택하지 않은 도구의 규칙 파일은 프로젝트에서 제외한다 (`nestjs-validation-zod.md` 참조).

## 1. 검증 데코레이터

- Controller 입력 DTO와 Command/Query 클래스의 필드에 `class-validator` 데코레이터(`@IsString()`, `@IsEmail()`, `@ValidateNested()` 등)를 붙인다.
- 연관 파라미터 4개 이상을 묶은 Value Object(중첩 DTO)에는 `@ValidateNested()`와 `@Type()`을 붙여 계층 검증(cascading validation)이 되도록 한다(`shared/architecture.md` 4번).

## 2. 다중 진입점 방어

- Command/Query 클래스에도 Controller DTO와 동일한 검증 데코레이터를 붙인다(`nestjs.md` 3번, `shared/architecture.md` 5번).
- Service 메서드 진입점에서 `ValidationPipe`를 명시적으로 적용하거나, Command 생성 시점에 `class-validator`의 `validateOrReject()`를 직접 호출해 HTTP 경로를 거치지 않는 호출(메시지 컨슈머, 배치, 다른 서비스의 직접 호출)도 방어한다.

## 3. 금지 패턴

- Command/Query 클래스에 검증 데코레이터를 누락하지 않는다(HTTP 경로 외 진입점이 무방비가 된다).
- 비즈니스 규칙 검증(잔액 부족, 중복 가입 등)을 검증 데코레이터에 넣지 않는다 — 형식 검증은 `class-validator`, 비즈니스 검증은 Domain의 몫이다(`shared/architecture.md` 5번).
