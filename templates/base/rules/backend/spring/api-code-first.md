---
description: 코드-first 웹 계층(Controller·요청/응답 DTO 수기 작성) 규칙 (Pragmatic flavor)
paths:
  - "**/adapter/webapi/**"
  - "**/*Controller.java"
  - "**/*Controller.kt"
  - "**/*Api.java"
  - "**/*Api.kt"
---

# 코드-first 웹 계층 규칙 (Pragmatic flavor)

웹 계층의 Controller와 Request/Response DTO를 **코드로 직접 작성**하는 규칙이다. 이 파일은 Pragmatic(실용) flavor에 적용된다. `shared/rest-api.md`의 REST 설계 규약(URI, 상태 코드, 페이지네이션, 에러 형식)은 그대로 전제한다.

이 프로젝트가 Clean(엄격) flavor(spec-first)를 채택했다면 이 파일은 적용 대상이 아니다. spec-first는 `openapi.yaml`을 먼저 정의하고 Controller 인터페이스·DTO를 자동 생성하는 방식(`api-dto.md`)이며, `/rw:init`이 선택한 flavor에 맞는 한 파일만 남긴다(Pragmatic 선택 시 `api-dto.md`를 제거하고 이 파일을 유지한다).

이 프로젝트가 NestJS/FastAPI를 채택했다면 적용 대상이 아니다.

## 1. 핵심 원칙

- Controller와 Request/Response DTO를 개발자가 직접 작성한다(코드-first). `openapi.yaml`을 단일 소스로 두지 않는다.
- 프론트엔드와의 계약이 필요하면, 코드에서 생성된 OpenAPI 문서(`springdoc-openapi` 등)를 CI 아티팩트로 남겨 추적할 수 있다(선택). 단, 소스에 문서화 목적의 Swagger 어노테이션을 과도하게 붙여 코드를 오염시키지 않는다.

## 2. Controller

- `@RestController`(또는 stereotype `@WebApiAdapter`)로 작성하고 `provided` 포트 인터페이스를 생성자 주입받는다(Java는 `@RequiredArgsConstructor`, Kotlin은 주 생성자). `ports-and-adapters.md` 참조.
- 매핑 애노테이션(`@PostMapping` 등)과 `@RequestBody @Valid`를 직접 선언한다.
- 201 Created가 필요한 생성 API는 서비스가 반환한 식별자로 Controller가 `Location` 헤더를 조립한다(`shared/rest-api.md` 3번). Pragmatic flavor에서 서비스가 Domain 객체를 반환하면 Controller가 그 식별자를 사용한다.

## 3. DTO

- 요청/응답 DTO는 불변 데이터 홀더로 작성한다: Java는 `record`, Kotlin은 `data class`.
- **요청 DTO는 `provided` 포트의 요청 객체(Java `record`/Kotlin `data class`)를 그대로 재사용할 수 있다**(`ports-and-adapters.md` 6.1). 요청 객체에는 Bean Validation 제약(`@Email`, `@Size` 등, Kotlin은 `@field:` use-site target)을 부착하고, `toInfo()` 등으로 도메인 입력 객체로 변환한다.
- 응답 DTO는 `of(...)` 팩터리(Java 정적 메서드 / Kotlin `companion object`)로 Domain에서 변환한다. Domain 객체를 직렬화해 그대로 노출하지 않는다.
- 필드명은 camelCase, 날짜/시간은 ISO 8601, null 필드는 응답에서 생략한다(`shared/rest-api.md` 4번).

## 4. 에러 응답 (RFC 9457)

- 에러 응답은 `@ControllerAdvice`(예: `ApiControllerAdvice extends ResponseEntityExceptionHandler`)에서 `ProblemDetail`로 통일한다. Controller/서비스에서 에러 응답 객체를 직접 조립하지 않는다.
- 검증 실패(형식/구문)는 400, 비즈니스 규칙 위반(도메인 예외)은 422로 매핑한다(`shared/rest-api.md` 3번). 도메인/서비스 계층에서 `ResponseStatusException` 등 웹 계층 예외를 직접 던지지 않는다(역방향 의존, `shared/architecture.md` 3번).

## 5. 금지 패턴

- 웹 DTO/Controller를 `openapi.yaml`에서 생성하려 하지 않는다(이 flavor는 코드-first다 — spec-first는 `api-dto.md`).
- 응답으로 Domain 객체를 직접 반환/직렬화하지 않는다. 응답 `record`로 변환한다.
- 에러 응답을 Controller에서 직접 조립하지 않는다(`@ControllerAdvice`의 `ProblemDetail`).
- Bean Validation 없이 요청 record를 그대로 도메인/서비스로 넘기지 않는다.
