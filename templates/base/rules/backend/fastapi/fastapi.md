---
description: FastAPI 백엔드 고유 컨벤션 (backend/shared/architecture.md 전제, DDD 강제 수준은 완화)
paths:
  - "**/router.py"
  - "**/schemas.py"
  - "**/service.py"
  - "**/repository.py"
  - "**/models.py"
  - "**/test_*.py"
  - "**/conftest.py"
---

# FastAPI 규칙

`shared/architecture.md`의 공통 원칙과 `shared/rest-api.md`의 REST 설계 규약(URI, 상태 코드, 페이지네이션, 에러 형식)을 전제로 하되, Python/FastAPI 생태계 관례에 맞게 무게를 덜어낸다. FastAPI는 가볍고 명시적인 스타일을 지향하므로, Aggregate Root·Specification 패턴 같은 Java 스타일 DDD 장치를 강제하지 않는다. **Rich Domain 원칙(`shared/architecture.md` 6번)은 권장이지 필수가 아니다** — 도메인 로직이 단순하면 트랜잭션 스크립트 스타일(라우터 → 서비스 함수 → ORM)도 허용한다.

이 프로젝트가 Spring Boot나 NestJS를 채택했다면 이 파일은 적용 대상이 아니다. 백엔드 스택(Spring/NestJS/FastAPI)은 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 스택의 규칙 파일은 프로젝트에서 제외한다 (`spring/`, `nestjs.md` 참조).

## 1. 프로젝트 구조

- 기능(도메인) 단위로 패키지를 나눈다: `{feature}/router.py`, `{feature}/schemas.py`, `{feature}/service.py`, `{feature}/repository.py`. 영속성 도구가 ORM 모델을 두는 경우 `{feature}/models.py`가 추가된다(3번, 채택한 `fastapi-persistence-*.md` 참조).
- 클래스 기반 Finder/Service 분리가 과할 정도로 단순한 기능이면, 모듈 레벨 함수로 조회/변경을 나눠도 된다. 다만 한 함수가 조회와 변경을 동시에 하지는 않는다(`shared/architecture.md` 7번).

## 2. Command/Query와 Pydantic

- Pydantic 모델이 Command/Query 객체이자 검증 계층을 겸한다. Java의 Bean Validation처럼 별도 애노테이션을 붙일 필요 없이, Pydantic 필드 타입과 `Field(...)` 제약(`min_length`, `pattern`, `gt` 등)이 곧 검증 규칙이다.
- **다중 진입점 방어가 사실상 기본 제공된다**: Pydantic 모델은 인스턴스화 시점에 항상 검증되므로(Pydantic v2 기준), Command 객체를 어느 경로(HTTP 라우터, 백그라운드 태스크, 메시지 컨슈머)로 생성하든 동일하게 검증된다. Java/NestJS처럼 별도 검증 트리거를 신경 쓸 필요가 없다.
- Router 입력 스키마(`schemas.py`)와 Service Command는 원칙적으로 분리하되, 단순 CRUD처럼 둘이 완전히 동일한 형태면 하나로 합쳐도 된다(`shared/architecture.md` 4번의 "연관 파라미터 그룹화" 취지를 해치지 않는 선에서 실용적으로 판단).

## 3. Domain과 영속성 매핑

- ORM 또는 SQL-first(ORM 미사용) 중 하나를 프로젝트 시작 시점에 고정한다. 도구별 매핑·Repository 도구·트랜잭션 상세는 채택한 영속성 파일(`fastapi-persistence-*.md`)을 따른다.
- 도메인 로직이 단순하면 Pydantic 모델(또는 `dataclass`)에 메서드를 붙여 그대로 Domain으로 쓴다. 복잡한 불변 조건이 있는 경우에만 저장소 모델과 분리된 순수 Domain 클래스를 둔다. 분리한 경우 변환 책임은 Repository가 전담하고, Domain은 영속성 타입을 직접 참조하지 않는다.
- Value Object는 Pydantic `BaseModel`(`frozen=True`)이나 `dataclass(frozen=True)`로 표현한다.

## 4. Repository 도구 선택 (Escalation Ladder 적용)

- `shared/architecture.md` 8번의 에스컬레이션 순서(단순 조회 → 동적 조건 조합 → 복잡한 조인/N+1 방지 → 대량 벌크/집계/네이티브 SQL)를 따른다. 항상 최하위 충분한 단계에서 시작하고, 측정된 근거 없이 선제적으로 상위 도구를 쓰지 않는다.
- 동적 검색 조건 조합 로직은 라우터/서비스가 아닌 Repository 모듈에 둔다.
- 각 단계의 구체적 도구/API(관계 로딩, 벌크 등)와 원시 SQL 허용 범위는 채택한 영속성 파일(`fastapi-persistence-*.md`)을 따른다.

## 5. 트랜잭션

- 요청 단위 세션/커넥션은 FastAPI 의존성 주입(`Depends`)을 통해 공급한다. Service 함수가 직접 생성하지 않는다. 구체 세션/커넥션 타입은 채택한 영속성 파일(`fastapi-persistence-*.md`)을 따른다.
- 쓰기 흐름은 세션/트랜잭션 컨텍스트 안에서 커밋하고, 조회 전용 흐름은 커밋을 호출하지 않는다(읽기 전용 의도를 코드로 드러낸다).

## 6. API 스펙: code-first가 원칙이다

- FastAPI는 spec-first가 아니라 **code-first가 프레임워크의 정체성 자체**다. Pydantic 모델과 라우터 타입 힌트에서 OpenAPI 스펙(`/openapi.json`)이 자동 생성되는 것이 FastAPI를 쓰는 핵심 이유이므로, `spring/api-dto.md`처럼 yaml을 먼저 작성하고 코드를 생성하는 절차를 강제하지 않는다.
- 단일 소스 원칙(`shared/architecture.md`의 근본 취지: 프론트-백엔드 스펙 불일치 방지)은 방향을 바꿔서 달성한다: FastAPI가 자동 생성한 `/openapi.json`을 신뢰 가능한 단일 소스로 취급하고, 프론트엔드 타입 생성(`openapi-typescript` 등)이 이 산출물을 소비한다.
- Pydantic 모델에 `Field(description=...)`, `examples=...`를 채워서 생성된 스펙만으로 API 동작을 이해할 수 있게 한다(`shared/rest-api.md` 8번의 예시 포함 원칙과 동일한 목표를 코드 쪽에서 달성).

## 7. 테스트

- `pytest` + `httpx.AsyncClient`(또는 `TestClient`)로 라우터를 테스트한다.
- 라우터 테스트에서 DB 세션 등 의존성 대체는 `app.dependency_overrides`를 사용한다(FastAPI의 공식 테스트 대체 메커니즘). 서비스 내부를 몽키패칭하지 않고 `Depends` 경계에서 대체하며, fixture 종료 시 `dependency_overrides.clear()`로 원복한다.
- 순수 도메인/서비스 로직은 FastAPI 앱을 띄우지 않고 함수/클래스 단위로 직접 테스트한다.
- `time.sleep`으로 순서를 보장하지 않는다. `pytest` fixture로 결정적 테스트 데이터를 만든다.
- 랜덤/대량 테스트 데이터가 필요하면 Polyfactory의 factory(Pydantic 모델은 `ModelFactory`, `dataclass`는 `DataclassFactory`)로 생성한다. `pytest` fixture를 대체하는 도구가 아니라, 검증과 무관한 필드를 채우는 보완 도구로 사용한다.
- 어서션 대상 필드와 비즈니스 규칙에 관여하는 필드는 랜덤에 맡기지 않고 `build(field=value)` 오버라이드나 fixture로 명시적으로 고정한다. 어서션이 랜덤 값에 의존하면 안 된다. 실패 재현을 위해 factory 클래스에 `__random_seed__`를 고정한다.
- 경계값(최소/최대, 경계 ±1, 빈 값, 임계점)은 랜덤으로 뽑지 않고 명시적으로 고정한다. 같은 로직을 여러 입력으로 검증할 때는 `pytest.mark.parametrize`로 케이스를 나열하고, 검증 규칙(길이, 범위, 패턴)이 있는 입력은 유효 경계와 무효 경계 양쪽 케이스를 모두 포함한다.
- DB가 필요한 테스트는 트랜잭션을 테스트마다 롤백하거나 격리된 스키마를 사용해 테스트 간 상태가 새지 않게 한다.

## 8. 에러 응답 (RFC 9457)

- 에러 응답은 `shared/rest-api.md` 4번의 Problem Details 형식을 따른다. 전역 예외 핸들러(`app.exception_handler`)에서 매핑하고, 라우터/서비스에서 에러 응답 JSON을 직접 조립하지 않는다.
- **FastAPI 기본값 주의**: FastAPI는 요청 검증 실패(`RequestValidationError`) 시 기본으로 422를 반환하지만, 이 프로젝트 규약(`shared/rest-api.md` 3번)은 형식/구문 오류를 400으로 구분한다. `RequestValidationError` 전역 핸들러를 등록해 400 + Problem Details(`errors` 배열 포함)로 재매핑한다.
- 도메인 예외(비즈니스 규칙 위반)는 공통 도메인 예외 타입 기준의 전역 핸들러에서 422 Problem Details로 매핑한다. Service/Domain 계층에서 `HTTPException`을 직접 던지지 않는다 — 안쪽 계층이 웹 계층 타입을 참조하는 역방향 의존이다(`shared/architecture.md` 3번).

## 9. async 규율 (이벤트 루프 보호)

- `async def` 라우터/서비스에서 동기 블로킹 호출을 하지 않는다: 동기 DB 드라이버(psycopg2 등), `requests`, `time.sleep`, 대용량 동기 파일 I/O. 이벤트 루프가 멈춰 해당 요청뿐 아니라 서버 전체 처리량이 무너진다.
- I/O 스택을 async로 통일한다: DB는 async 세션/커넥션 + async 드라이버(asyncpg, aiosqlite 등 — 5번 트랜잭션 규칙과 동일 전제), HTTP 클라이언트는 `httpx.AsyncClient`, 대기는 `asyncio.sleep`.
- async 버전이 없는 동기 전용 라이브러리를 써야 하면 해당 엔드포인트를 `def`로 선언해 FastAPI의 스레드풀 실행에 맡기거나, `run_in_threadpool`로 감싼다. `async def` 안에서 동기 블로킹 호출을 섞는 것이 최악의 조합이다.

## 10. 금지 패턴

- Router 스키마를 검증 없이 그대로 저장소 모델에 매핑해 저장하지 않는다(Repository/Service를 거치지 않고 직접 커밋).
- 세션/커넥션을 Service 함수 내부에서 직접 생성하지 않는다(`Depends`로 주입).
- SQL을 문자열 연결/포매팅으로 조립하지 않는다. 항상 바인드 파라미터를 사용한다(4번).
- 비즈니스 규칙 검증(형식이 아닌 규칙 위반)을 Pydantic validator에 넣지 않는다 — 형식 검증은 Pydantic, 비즈니스 검증은 Domain의 몫이다(`shared/architecture.md` 5번).
- Service/Domain 계층에서 `HTTPException`을 직접 던지지 않는다(8번).
- `async def` 라우터/서비스에서 동기 블로킹 I/O(동기 DB 드라이버, `requests`, `time.sleep`)를 호출하지 않는다(9번).
