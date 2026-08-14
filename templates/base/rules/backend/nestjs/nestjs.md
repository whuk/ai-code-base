---
description: NestJS 백엔드 고유 컨벤션 (backend/shared/architecture.md 전제)
paths:
  - "**/*.controller.ts"
  - "**/*.service.ts"
  - "**/*.module.ts"
  - "**/*.entity.ts"
  - "**/*.repository.ts"
  - "**/*.spec.ts"
  - "**/*.e2e-spec.ts"
---

# NestJS 규칙

`shared/architecture.md`의 공통 원칙과 `shared/rest-api.md`의 REST 설계 규약(URI, 상태 코드, 페이지네이션, 에러 형식)을 전제로, NestJS 고유 구현 방법만 다룬다. NestJS는 애초에 Angular/Spring 스타일 구조(데코레이터, DI, 모듈)에서 설계됐기 때문에, Java/Spring 규칙(`spring/`)과 사상을 거의 그대로 공유한다.

이 프로젝트가 Spring Boot나 FastAPI를 채택했다면 이 파일은 적용 대상이 아니다. 백엔드 스택(Spring/NestJS/FastAPI)은 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 스택의 규칙 파일은 프로젝트에서 제외한다 (`spring/`, `fastapi.md` 참조).

## 1. 모듈/계층 구조

- 기능 단위로 `Module`을 나눈다. 하나의 `Module`이 관련된 `Controller`, `Service`(Finder/Write), `Repository` 프로바이더를 묶는다.
- 계층 순서(`shared/architecture.md` 3번): `Controller` → `Service` → `Repository` → `Domain`. `Controller`가 `Repository`나 `Domain`을 직접 참조하지 않는다.
- `Domain`(순수 비즈니스 로직 클래스)은 `@Injectable()`, `@Entity()` 외의 프레임워크 데코레이터에 의존하지 않는다.

## 2. Finder/Service 분리

- 조회 전용 `{Domain}Finder`(`@Injectable()`)와 상태 변경 전용 `{Domain}Service`(`@Injectable()`)를 별도 프로바이더로 분리한다.
- Service가 조회가 필요하면 같은 모듈의 Finder를 생성자 주입받아 사용할 수 있다.

## 3. Command/Query와 검증

- Controller의 입력 DTO와 Service의 Command/Query는 별도 클래스로 분리한다(Web DTO를 Service로 그대로 넘기지 않는다, `shared/architecture.md` 1-2번).
- 검증 도구는 프로젝트 시작 시점에 하나로 고정한다. 검증 데코레이터/스키마 작성과 다중 진입점 방어의 구체 트리거 방식은 채택한 검증 파일(`nestjs-validation-*.md`)을 따른다.
- **다중 진입점 방어**(`shared/architecture.md` 5번): Command/Query 클래스에도 Controller DTO와 동일한 검증 규칙을 적용해, HTTP 경로를 거치지 않는 호출(메시지 컨슈머, 배치, 다른 서비스의 직접 호출)도 방어한다. Web 계층 검증만으로는 이런 진입점이 방어되지 않는다.
- 연관 파라미터 4개 이상은 Value Object(별도 클래스 또는 중첩 DTO)로 그룹화한다(`shared/architecture.md` 4번).

## 4. 영속성 (도구별 Domain 매핑)

- ORM 또는 SQL-first(ORM 미사용) 중 하나를 프로젝트 시작 시점에 고정한다. 도구별 Domain 매핑·Repository 도구·트랜잭션 상세는 채택한 영속성 파일(`nestjs-persistence-*.md`)을 따른다.
- 도구와 무관하게 Domain 클래스는 영속성 타입을 직접 참조하지 않는다. Domain ↔ 저장소 모델 간 변환 책임은 Repository 구현체(또는 코드-외부 매핑 정의)가 전담한다.
- 연관 파라미터 4개 이상을 묶은 Value Object의 매핑도 위 원칙을 따른다(구체 방식은 영속성 파일 참조).

## 5. Repository 도구 선택 (Escalation Ladder 적용)

- `shared/architecture.md` 8번의 에스컬레이션 순서(단순 조회 → 동적 조건 조합 → 복잡한 조인/N+1 방지 → 대량 벌크/집계/네이티브 SQL)를 따른다. 항상 최하위 충분한 단계에서 시작하고, 측정된 근거 없이 선제적으로 상위 도구를 쓰지 않는다.
- 동적 검색 조건 조합 로직은 라우터/서비스가 아닌 도메인 전용 Repository 모듈에 그룹화한다(Spring의 Specification 패턴과 동일한 사상).
- 페이지네이션과 fetch join(관계 포함 로딩)을 동시에 쓰지 않는다(인메모리 페이지네이션 경고).
- 각 단계의 구체적 도구/API와 원시 쿼리 허용 범위는 채택한 영속성 파일(`nestjs-persistence-*.md`)을 따른다.

## 6. 트랜잭션

- Service의 쓰기 메서드는 트랜잭션 경계로 감싼다. Finder(조회 전용)는 트랜잭션 경계를 명시적으로 열지 않는다. 도구별 트랜잭션 API는 채택한 영속성 파일(`nestjs-persistence-*.md`)을 따른다.
- 클래스 전체에 선언적으로 트랜잭션을 적용하는 Spring 방식과 달리 NestJS는 메서드 단위로 트랜잭션을 명시해야 하므로, 트랜잭션이 필요한 메서드를 주석이 아니라 헬퍼 함수/데코레이터로 일관되게 표시한다.

## 7. API 스펙

- 가능하면 `openapi.yaml`을 먼저 정의하고 코드/DTO를 생성하는 spec-first를 유지한다(`shared/architecture.md`의 단일 소스 원칙과 `spring/api-dto.md`의 사상을 그대로 따른다). 스펙 작성 규약(스키마 명명, `$ref`, `operationId`, 제약조건 명시)은 `shared/rest-api.md` 8번을 따른다.
- 이 codegen 경로(예: openapi-generator의 TypeScript/NestJS 대상 템플릿)가 팀 환경에서 검증되지 않았다면, `@nestjs/swagger` 데코레이터 기반 code-first로 시작하는 것을 예외적으로 허용한다. 이 경우 CI에서 생성된 OpenAPI 문서를 아티팩트로 남겨 프론트엔드와의 계약이 암묵적으로 깨지지 않는지 추적한다.

## 8. 테스트

- 단위 테스트: Jest. `@nestjs/testing`의 `Test.createTestingModule()`로 필요한 프로바이더만 로드한다(전체 애플리케이션 컨텍스트를 올리지 않는다).
- Service/Finder 단위 테스트에서 Repository 등 하위 의존성은 custom provider(`{ provide: OrderRepository, useValue: mock }`)로 대체한다. 실제 DB 접근 없이 오케스트레이션 로직만 검증하고, 실제 영속성 동작(매핑, 쿼리 조합)은 통합 테스트에서 검증한다.
- 통합/E2E 테스트: Supertest로 HTTP 요청을 검증한다.
- `Thread.sleep` 상당의 시간 기반 동기화(임의 `setTimeout` 대기)를 사용하지 않는다. 결정적 데이터는 Fixture/Factory로 생성한다.
- Factory는 Fishery(`Factory.define`)로 도메인/DTO별로 정의하고, 고유값이 필요한 필드는 `sequence`로 만든다. 랜덤 값이 필요한 필드는 `@faker-js/faker`를 병용하되 테스트 셋업에서 `faker.seed(...)`를 고정해 실패를 재현할 수 있게 한다.
- 어서션 대상 필드와 비즈니스 규칙에 관여하는 필드는 랜덤에 맡기지 않고 `factory.build({...})` 오버라이드로 명시적으로 고정한다. 어서션이 랜덤 값에 의존하면 안 된다.
- 경계값(최소/최대, 경계 ±1, 빈 값, 임계점)은 랜덤으로 뽑지 않고 명시적으로 고정한다. 같은 로직을 여러 입력으로 검증할 때는 `it.each`/`test.each`로 케이스를 나열하고, 검증 규칙(길이, 범위, 패턴)이 있는 입력은 유효 경계와 무효 경계 양쪽 케이스를 모두 포함한다.

## 9. 에러 응답 (RFC 9457)

- 에러 응답은 `shared/rest-api.md` 4번의 Problem Details 형식을 따른다. 전역 Exception Filter(`APP_FILTER`로 등록)에서 매핑하고, Controller에서 에러 응답 객체를 직접 조립하지 않는다.
- `ValidationPipe` 검증 실패(`BadRequestException`)는 400 + Problem Details로 변환하고, 필드별 오류를 `errors` 배열로 포함한다. Service 진입점 검증(3번 다중 진입점 방어)에서 발생한 검증 예외도 같은 필터에서 400으로 매핑한다.
- 도메인 예외(비즈니스 규칙 위반)는 공통 도메인 예외 클래스를 기준으로 같은 필터에서 422 Problem Details로 매핑한다. Domain/Service 계층에서 `HttpException` 계열(NestJS 웹 계층 타입)을 직접 던지지 않는다 — 안쪽 계층이 바깥 계층 타입을 참조하는 역방향 의존이다(`shared/architecture.md` 3번).

## 10. 금지 패턴

- Controller DTO를 Service 메서드 파라미터로 그대로 사용하지 않는다.
- Domain 클래스가 영속성 타입(ORM 매핑 타입, 쿼리 빌더 스키마 타입 등)을 직접 참조하지 않는다(4번, 변환은 Repository 전담. 도구별 상세는 `nestjs-persistence-*.md`).
- Finder 프로바이더에 상태 변경 메서드를 포함하지 않는다.
- 동적 검색 조건을 도메인 전용 Repository 모듈 밖(라우터/서비스)에 나열하지 않는다(5번 기준 도구 사용).
- SQL을 문자열 연결로 조립하지 않는다. 항상 파라미터 바인딩을 사용한다(5번).
- Domain/Service 계층에서 `HttpException` 계열을 직접 던지지 않는다(9번).
