---
description: WebFlux 리액티브 MongoDB 병용 규칙 — ReactiveMongoRepository/ReactiveMongoTemplate과 Document 매핑 (Layered/Hexagonal 공통, R2DBC 병용 전제)
globs: "**/*Document.java,**/*MongoRepository.java"
---

# 리액티브 MongoDB 영속성 규칙 (WebFlux 전용, R2DBC 병용)

WebFlux 프로젝트에서 문서형 데이터가 필요한 도메인에 리액티브 MongoDB를 병용할 때의 규칙이다 — MVC의 JPA + MongoDB 병용 구도의 리액티브 대응이다. Layered/Hexagonal 아키텍처 스타일과 무관하게 공통 적용되며, CQRS-lite 흐름·Finder/Service 분리(`shared/architecture.md`, `service-layer.md`)와 트랜잭션·블로킹 규율(`webflux.md` 3번·4번), R2DBC 기본 영속성 규칙(`repository-r2dbc.md`)은 그대로 전제한다.

이 프로젝트가 리액티브 MongoDB를 병용하지 않는다면(R2DBC만 사용) 이 파일은 적용 대상이 아니다. 병용 여부는 프로젝트 시작 시점에 고정하므로, 병용하지 않는 프로젝트는 이 파일을 프로젝트에서 제외한다 (`repository-r2dbc.md` 참조). 마찬가지로 이 프로젝트가 Spring MVC(서블릿 스택)를 채택했다면 이 파일은 적용 대상이 아니다. MVC와 WebFlux를 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 웹 스택의 규칙 파일은 프로젝트에서 제외한다 (`webflux.md` 참조). Kotlin을 채택한 프로젝트도 적용 대상이 아니다 — WebFlux 규칙은 현재 Java 전용으로 제공된다.

## 1. 핵심 원칙

- 문서형 데이터가 필요한 도메인에만 리액티브 MongoDB(`ReactiveMongoRepository`/`ReactiveMongoTemplate`)를 사용한다. 블로킹 MongoDB 스택(`MongoTemplate`, 동기 `MongoRepository`)은 사용하지 않는다 (`webflux.md` 4번의 블로킹 금지 규율).
- 하나의 도메인(Aggregate)은 R2DBC 또는 MongoDB 중 하나의 저장소만 사용한다. 같은 Aggregate를 두 저장소에 걸쳐 저장하지 않는다.
- 저장소 선택과 무관하게 Domain 매핑 원칙(`repository-r2dbc.md` 2번)과 Read/Command 흐름 분리(`shared/architecture.md` 1번)는 동일하게 적용한다.

## 2. Document 매핑

- **Domain은 완전히 순수하다**(`webflux.md` 5번): `@Document`/`@Id`/`@Field` 등 MongoDB 매핑 애노테이션을 Domain 클래스에 붙이지 않는다.
- 매핑 대상은 영속성 계층 전용 클래스인 `{Domain}Document`다. R2DBC의 `{Domain}Row`와 동일한 위상이며, 컬렉션 구조를 반영할 뿐 비즈니스 로직을 갖지 않는다.
- `{Domain}Document` ↔ Domain/Read DTO 변환은 Repository(Layered) 또는 Persistence Adapter(Hexagonal)가 전담한다. Read는 Read DTO에 직접 매핑하고, Command 흐름의 조회는 Domain의 정적 팩토리/생성자로 재구성해 불변 조건 검증을 통과시킨다.
- (Hexagonal) Port 시그니처에 `{Domain}Document`·Spring Data MongoDB 타입을 노출하지 않는다 — `repository-r2dbc.md` 2번의 Port 규칙과 동일하다.

## 3. 도구 선택

- 기본은 `ReactiveMongoRepository`(Query Derivation)로 시작한다.
- 동적 조건 조합, 집계 파이프라인(`Aggregation`) 등 파생 쿼리로 표현이 어려운 경우에만 `ReactiveMongoTemplate`(`Query`/`Criteria`)로 올라간다 — Escalation Ladder 원칙(`shared/architecture.md` 8번)과 동일하다.
- 쿼리 조립 로직은 Finder/Service가 아닌 Repository 클래스에 둔다.

## 4. 테스트

- 리액티브 MongoDB 병용 도메인의 통합 테스트는 `test-mongodb.md`의 MongoDB 포함 base class(`IntegrationTestBase`/`WebIntegrationTestBase`)를 리액티브 구성으로 대체해 읽는다 (`webflux.md` 8번의 접두사 대체 규정과 동일한 방식).
- 검증은 `StepVerifier`로 한다: 방출 값과 종료 시그널을 어서션하고, `block()`으로 결과를 꺼내지 않는다 (`repository-r2dbc.md` 7번과 동일).

## 5. 금지 패턴

- 블로킹 MongoDB 스택(`MongoTemplate`, 동기 `MongoRepository`)을 사용하지 않는다.
- Domain 클래스에 `@Document` 등 MongoDB 매핑 애노테이션을 붙이지 않는다. 매핑은 `{Domain}Document`에만.
- 하나의 Aggregate를 R2DBC와 MongoDB 두 저장소에 걸쳐 저장하지 않는다.
- Port 인터페이스/Service 반환 타입에 `{Domain}Document`·Spring Data MongoDB 타입을 노출하지 않는다.
- Repository에서 `block()`으로 결과를 꺼내 동기 반환하지 않는다.
