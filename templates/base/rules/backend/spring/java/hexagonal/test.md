---
description: 테스트 유형별(Domain/Application/Adapter) base class 및 결정적 테스트 작성 규칙 (Hexagonal)
globs: "**/src/test/**"
---

# 테스트 작성 규칙 (Hexagonal)

계층별로 검증 대상과 필요한 인프라가 다르다. base class 표(3번)는 Layered와 동일하지만, 어떤 계층에 어떤 테스트 방식을 적용할지가 Port/Adapter 경계를 기준으로 나뉜다는 점이 다르다.

이 프로젝트가 Layered를 채택했다면 이 파일은 적용 대상이 아니다 (`layered/test.md` 참조). 마찬가지로 이 프로젝트가 Kotlin을 채택했다면 이 파일은 적용 대상이 아니다. Java와 Kotlin 규칙 파일을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 언어의 규칙 파일도 프로젝트에서 제외한다 (`kotlin/hexagonal/test.md` 참조).

## 1. 핵심 원칙

- 테스트에 필요한 **최소한의 ApplicationContext**만 로드한다.
- 테스트 설정(`@SpringBootTest`, `@ActiveProfiles` 등)을 개별 테스트 클래스에 직접 선언하지 않는다. `support` 패키지의 base class를 상속한다.
- `Thread.sleep` 등 시간 기반 동기화를 사용하지 않는다. Fixture를 통해 결정적 테스트 데이터를 생성한다.

## 2. 계층별 테스트 전략

### 2.1. Domain 단위 테스트 (base class 불필요, Spring 컨텍스트 없음)

- `domain/` 패키지의 클래스는 프레임워크 의존이 전혀 없으므로(`domain.md` 2번), 순수 JUnit(+ AssertJ)만으로 테스트한다. Mockito조차 필요 없는 경우가 대부분이다.
- Aggregate의 불변 조건 검증, 상태 전이 메서드(`approve()`, `cancel()` 등), 도메인 예외 발생 조건을 이 레벨에서 검증한다.
- Spring 컨텍스트가 전혀 필요하지 않다는 것 자체가 Domain이 올바르게 격리되어 있다는 신호다. 이 테스트에 `@SpringBootTest`나 base class가 필요해졌다면 Domain에 프레임워크 의존이 새어 들어갔다는 뜻이다.

### 2.2. Application Service/Finder 단위 테스트 (base class 불필요, Port를 Mock)

- `@ExtendWith(MockitoExtension.class)`를 사용한다. Spring 컨텍스트를 로드하지 않는다.
- `{Domain}Service`, `{Domain}Finder`가 의존하는 `port/out` 인터페이스(`{Domain}CommandPort`, `{Domain}QueryPort`)를 Mockito로 Mock 처리한다.
- 검증 대상은 UseCase 구현체의 오케스트레이션 로직(Port 호출 순서, Domain 메서드 호출, 트랜잭션 경계 내 흐름)이지 실제 영속성 동작이 아니다.
- Port 인터페이스를 Mock으로 대체할 수 있다는 것이 Ports & Adapters 구조의 핵심 이점이다 — 실제 DB 없이 Application 로직을 검증한다.

### 2.3. Persistence Adapter 통합 테스트 (JPA-only)

- `{Domain}PersistenceAdapter`, `{Domain}JpaRepository` 테스트는 `JpaIntegrationTestBase`를 상속한다.
- 검증 대상은 `{Domain}JpaEntity` 매핑, `{Domain}PersistenceMapper`의 Domain ↔ JpaEntity 변환 정확성, Specification/QueryDSL 조건 조립 결과다.
- H2 데이터베이스를 로드한다.

### 2.4. Web Adapter 테스트 (Controller)

- `{Domain}Controller` 테스트는 `JpaWebIntegrationTestBase`를 상속한다.
- `port/in`의 UseCase를 `@MockitoBean`(또는 동등 수단)으로 대체해 Application Service 실행 없이 Web 계층(요청 바인딩, 검증, 상태 코드, 직렬화)만 검증할 수도 있다. 전체 흐름을 검증하려면 Mock 없이 실제 UseCase 구현체를 통과시킨다 — 어느 쪽을 쓸지는 팀 컨벤션으로 고정한다.

## 3. base class 구조

| base class | 용도 | 로드 범위 |
|---|---|---|
| `JpaIntegrationTestBase` | Persistence Adapter 통합 테스트 | H2 |
| `JpaWebIntegrationTestBase` | Web Adapter 테스트 | H2 + MockMvc |

## 4. 테스트 데이터 생성

- 타임스탬프 기반 정렬이 필요한 테스트에서 `Thread.sleep`을 사용하지 않는다.
- Domain 테스트는 Domain의 정적 팩토리/생성자로 직접 Fixture를 만든다. Persistence Adapter 테스트는 `{Domain}JpaEntity` 전용 Fixture(예: `OrderJpaEntityFixture`)를 별도로 둔다 — Domain Fixture와 JpaEntity Fixture를 같은 클래스로 겸용하지 않는다(둘이 다른 클래스이므로).

## 5. N+1 쿼리 카운트 검증

- Persistence Adapter 통합 테스트에서 Hibernate Statistics 또는 DataSource 프록시로 쿼리 카운트를 어서션한다(Layered와 동일한 원칙). 상위 도구(QueryDSL 등)를 도입한 프로젝트라면 `repository-tools.md` 3번의 N+1 검증 지침도 함께 참조한다.

## 6. 금지 패턴

- 테스트 클래스에 `@SpringBootTest`, `@ActiveProfiles`, `@AutoConfigureMockMvc`를 직접 선언하지 않는다.
- Domain 단위 테스트에 Spring 컨텍스트나 base class를 끌어들이지 않는다(Domain이 프레임워크로부터 격리되어 있다는 전제가 깨진다).
- Application Service/Finder 테스트에서 실제 Persistence Adapter(DB 접근)를 사용하지 않는다. Port를 Mock으로 대체한다.
- 테스트에서 `Thread.sleep`으로 실행 순서나 타임스탬프 차이를 보장하지 않는다.
