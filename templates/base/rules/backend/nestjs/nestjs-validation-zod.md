---
description: NestJS 검증 규칙 — Zod 4 (NestJS 12 Standard Schema 기본, 11 이하는 nestjs-zod, nestjs.md 전제)
paths:
  - "**/*.controller.ts"
  - "**/*.service.ts"
  - "**/*.finder.ts"
  - "**/*.module.ts"
  - "**/*.dto.ts"
  - "**/*.command.ts"
  - "**/*.query.ts"
  - "**/*.schema.ts"
  - "**/*.entity.ts"
  - "**/*.repository.ts"
---

# NestJS 검증 규칙 — Zod

`nestjs.md` 3번의 Command/Query 분리와 다중 진입점 방어 원칙을 전제로, Zod 스키마 기반 검증을 검증 도구로 채택한 프로젝트의 구체 구현만 다룬다. 기준 버전은 Zod 4이며, NestJS 12는 내장 Standard Schema 경로를, NestJS 11 이하는 `nestjs-zod` 5를 쓴다.

이 프로젝트가 `class-validator`를 채택했다면 이 파일은 적용 대상이 아니다. 검증 도구는 한 프로젝트에서 하나로 통일하므로, 실제로 채택하지 않은 도구의 규칙 파일은 프로젝트에서 제외한다 (`nestjs-validation-classvalidator.md` 참조).

## 1. 버전과 연결 방식

- `zod`는 `^4`로 핀하고 `import { z } from "zod"`로 쓴다(4.0부터 루트 export가 Zod 4). Zod 3은 사실상 EOL이며 `zod/v3` 서브패스는 마이그레이션 기간에만 허용한다. Zod 4 API를 쓴다: `z.email()`/`z.uuid()`/`z.iso.datetime()`(`.email()` 체인은 deprecated), 오류 메시지는 단일 `error` 파라미터, 오류 정리는 `z.treeifyError()`/`z.flattenError()`, 엄격 객체는 `z.strictObject()`.
- **NestJS 12**: 프레임워크 내장 Standard Schema 경로를 기본으로 한다. `APP_PIPE`로 `StandardSchemaValidationPipe`를 등록하고, 핸들러에서 `@Body({ schema: CreateOrderSchema })`처럼 스키마를 지정한다. 응답 직렬화는 `StandardSchemaSerializerInterceptor`. `@nestjs/swagger`는 Zod 4.2+의 `~standard.jsonSchema`를 자동으로 OpenAPI로 변환하므로 별도 설정이 없다. `@nestjs/config`의 `validationSchema`에도 같은 Zod 스키마를 넘긴다(`nestjs.md` 8번).
- **NestJS 10/11**: `nestjs-zod@^5`(Zod 4 지원)를 쓴다. `createZodDto(schema)`로 DTO 클래스를 만들고 `ZodValidationPipe`를 `APP_PIPE`로 등록하며, Swagger 문서는 `cleanupOpenApiDoc(document)`로 후처리한다(5.0에서 `patchNestJsSwagger` 제거). 응답은 `@ZodSerializerDto()` + `ZodSerializerInterceptor`. `@anatine/zod-nestjs`는 Zod 3 전용이라 쓰지 않는다. `nestjs-zod`는 아직 NestJS 12 peer를 지원하지 않으므로 12로 올릴 때 Standard Schema 경로로 옮긴다.
- DTO 타입은 스키마에서 파생한다. 입력 스키마에 `transform`/`default`가 있으면 `z.input<>`(와이어 형태)와 `z.infer<>`(파싱 후 형태)가 달라지므로 Controller 파라미터 타입은 `z.infer<>`를 쓴다.

## 2. 검증 스키마

- Controller 입력과 Command/Query의 형식 규칙은 Zod 스키마(`.schema.ts`)로 정의한다. 입력 객체는 `z.strictObject()`로 선언해 알 수 없는 키를 400으로 거부한다(class-validator의 `forbidNonWhitelisted`와 같은 효과).
- 연관 파라미터 4개 이상을 묶은 Value Object는 중첩 Zod 스키마로 표현해 계층 검증이 되도록 한다(`shared/architecture.md` 4번). 식별자 타입은 `.brand<"OrderId">()`로 구분한다.
- Web DTO 스키마와 Command 스키마는 이름이 같아도 별도로 정의한다(`shared/architecture.md` 4번의 계층별 타입 분리). 공통 조각(예: `AddressSchema`)은 `.extend()`로 재사용하되 `.merge()`는 쓰지 않는다(Zod 4.4부터 refine된 스키마에서 throw).

## 3. 다중 진입점 방어

- Command/Query에도 Controller 입력과 동일한 Zod 스키마 검증을 적용한다(`nestjs.md` 3번, `shared/architecture.md` 5번). 제약 값은 DTO 스키마와 동일하게 유지한다.
- Command/Query는 자기 검증 구조로 만든다: 정적 팩토리에서 해당 스키마의 `parse()`(또는 `safeParse()` 후 공통 검증 예외로 변환)를 호출해, HTTP 경로를 거치지 않는 호출(메시지 컨슈머, 배치, 다른 서비스의 직접 호출)도 방어한다.
- `@MessagePattern` 핸들러는 `exceptionFactory`로 `RpcException`을 던지는 파이프 인스턴스를 `@UsePipes()`로 붙인다(`nestjs.md` 3번).

## 4. 에러 형태

- 검증 실패 예외의 원본 형태가 경로마다 다르다: `StandardSchemaValidationPipe`는 `BadRequestException`에 `message: string[]`(`"path: message"`), `nestjs-zod`의 `ZodValidationException`은 `errors: ZodIssue[]`, 자기 검증의 `parse()`는 `ZodError`. Problem Details 필터(`nestjs.md` 11번)는 세 경우를 모두 잡아 `errors: [{ field, message }]` 배열로 정규화한다. `nestjs-zod`는 `createZodValidationPipe({ createValidationException })`로, Standard Schema 파이프는 `exceptionFactory(issues)`로 처음부터 공통 예외를 던지게 만들면 필터 분기가 줄어든다.

## 5. 금지 패턴

- Zod 3 API(`.email()` 체인, `message`/`invalid_type_error` 옵션, `.format()`, `.strict()`/`.passthrough()`)를 새 코드에 쓰지 않는다(1번).
- NestJS 12에서 `nestjs-zod`를 새로 도입하거나, 어떤 버전에서든 `@anatine/zod-nestjs`를 쓰지 않는다(1번).
- 입력 스키마를 `z.object()`로 열어 두지 않는다. `z.strictObject()`를 쓴다(2번).
- Command/Query 생성 경로에 Zod 스키마 검증을 누락하지 않는다(HTTP 경로 외 진입점이 무방비가 된다).
- Web DTO 스키마를 Command 스키마로 그대로 재사용하지 않는다(2번).
- 비즈니스 규칙 검증(잔액 부족, 중복 가입 등)을 Zod `refine`에 넣지 않는다 — 형식 검증은 Zod, 비즈니스 검증은 Domain의 몫이다(`shared/architecture.md` 5번).
