---
description: NestJS 검증 규칙 — class-validator (Command/Query 데코레이터 검증, nestjs.md 전제)
paths:
  - "**/*.controller.ts"
  - "**/*.service.ts"
  - "**/*.finder.ts"
  - "**/*.module.ts"
  - "**/*.dto.ts"
  - "**/*.command.ts"
  - "**/*.query.ts"
  - "**/*.entity.ts"
  - "**/*.repository.ts"
---

# NestJS 검증 규칙 — class-validator

`nestjs.md` 3번의 Command/Query 분리와 다중 진입점 방어 원칙을 전제로, `class-validator`를 검증 도구로 채택한 프로젝트의 구체 구현만 다룬다. 기준 버전은 `class-validator` 0.15, `class-transformer` 0.5이다.

이 프로젝트가 Zod(Standard Schema 또는 `nestjs-zod`)를 채택했다면 이 파일은 적용 대상이 아니다. 검증 도구는 한 프로젝트에서 하나로 통일하므로, 실제로 채택하지 않은 도구의 규칙 파일은 프로젝트에서 제외한다 (`nestjs-validation-zod.md` 참조).

## 1. ValidationPipe 설정

- `APP_PIPE`로 등록하는 전역 `ValidationPipe`는 다음 옵션을 고정한다: `whitelist: true`(데코레이터 없는 프로퍼티 제거), `forbidNonWhitelisted: true`(제거 대신 400), `transform: true`(DTO 인스턴스로 변환, 경로/쿼리 원시값 변환), `forbidUnknownValues: true`.
- `forbidUnknownValues`는 `class-validator` 0.14부터 라이브러리 기본값이 `true`(CVE-2019-18413 우회 방지)지만, NestJS `ValidationPipe`가 내부에서 `false`로 덮어쓴다. 따라서 파이프 옵션에 명시적으로 `true`를 적어야 알 수 없는 객체가 통과하지 않는다.
- 쿼리 파라미터 원시값 변환이 필요하면 `transformOptions: { enableImplicitConversion: true }`를 켜되, boolean 문자열(`"false"` → `true`) 같은 함정이 있으므로 DTO에 `@Type(() => Boolean)` 대신 `@Transform()`으로 명시 변환한다.
- `class-transformer`는 2021년 이후 릴리스가 없는 정체 상태다. 알려진 결함(유니온 `@Type` 판별 실패, 모노레포 중복 메타데이터)을 우회하는 코드를 만들기보다 DTO 구조를 단순하게 유지한다.

## 2. 검증 데코레이터

- Controller 입력 DTO와 Command/Query 클래스의 필드에 `class-validator` 데코레이터(`@IsString()`, `@IsEmail()`, `@Length()` 등)를 붙인다. 모든 필드에 최소 하나의 데코레이터가 있어야 `whitelist`에 걸려 제거되지 않는다.
- 연관 파라미터 4개 이상을 묶은 Value Object(중첩 DTO)에는 **`@ValidateNested({ each: true })`와 `@Type(() => Address)`를 반드시 함께** 붙여 계층 검증(cascading validation)이 되도록 한다(`shared/architecture.md` 4번). `@Type()`이 빠지면 중첩 객체가 plain object로 남아 검증이 조용히 건너뛰어진다. 중첩 오류는 `ValidationError.children`에 담기므로 Problem Details 필터(`nestjs.md` 11번)에서 재귀적으로 펼친다.
- 파생 DTO(수정용 부분 입력 등)는 `@nestjs/swagger`의 `PartialType`/`PickType`으로 만들어 검증 데코레이터와 스키마를 함께 상속받는다(`nestjs.md` 7번).

## 3. 다중 진입점 방어

- Command/Query 클래스에도 Controller DTO와 동일한 검증 데코레이터를 붙인다(`nestjs.md` 3번, `shared/architecture.md` 5번). 제약 값(길이·패턴·범위)은 DTO와 동일하게 유지하고, 스펙이 바뀌면 수동으로 동기화한다. 이 중복은 의도된 것이다.
- Command/Query는 자기 검증 구조로 만든다: 생성자(또는 정적 팩토리)에서 `validateSync(this, { forbidUnknownValues: true, whitelist: true })`를 호출하고 오류가 있으면 공통 검증 예외를 던진다. `validate()`/`validateOrReject()`는 **클래스 인스턴스**에만 동작하므로 plain object literal을 넘기지 않는다(0.14+ 기본값에서는 "unknown value" 오류로 실패한다). 비동기 커스텀 검증기가 있으면 `validateOrReject()`를 쓴다.
- HTTP 경로를 거치지 않는 호출(메시지 컨슈머, 배치, 다른 서비스의 직접 호출)은 이 자기 검증으로 방어된다. `@MessagePattern` 핸들러에는 추가로 `@UsePipes(new ValidationPipe({ exceptionFactory: (errors) => new RpcException(errors) }))`를 붙인다(`nestjs.md` 3번).

## 4. 금지 패턴

- `ValidationPipe`에 `whitelist`/`forbidNonWhitelisted`/`transform`/`forbidUnknownValues`를 생략하지 않는다(1번). 특히 `forbidUnknownValues`는 명시하지 않으면 NestJS가 `false`로 덮어쓴다.
- Command/Query 클래스에 검증 데코레이터를 누락하지 않는다(HTTP 경로 외 진입점이 무방비가 된다).
- 중첩 DTO에 `@ValidateNested()`만 붙이고 `@Type()`을 빠뜨리지 않는다(2번).
- `validate()`/`validateSync()`에 plain object를 넘기지 않는다. 클래스 인스턴스를 만들어 검증한다(3번).
- 비즈니스 규칙 검증(잔액 부족, 중복 가입 등)을 검증 데코레이터에 넣지 않는다 — 형식 검증은 `class-validator`, 비즈니스 검증은 Domain의 몫이다(`shared/architecture.md` 5번).
