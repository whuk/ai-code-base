---
description: 테스트 유형별(Domain/Application/Adapter) base class 및 결정적 테스트 작성 규칙 (Hexagonal)
paths:
  - "**/src/test/**"
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
- 랜덤/대량 데이터가 필요하면 Instancio(`Instancio.create(...)`, `Instancio.of(...)` 등)로 생성한다. Fixture를 대체하는 도구가 아니라, 검증과 무관한 필드를 채우는 보완 도구로 사용한다. Instancio를 쓰는 경우에도 Domain과 `{Domain}JpaEntity`의 생성 헬퍼는 겸용하지 않는다(위의 Fixture 분리 원칙과 동일).
- 어서션 대상 필드와 도메인 불변 조건에 관여하는 필드는 랜덤에 맡기지 않고 Fixture 또는 커스터마이저(`set`/`supply`)로 명시적으로 고정한다. 어서션이 랜덤 값에 의존하면 안 된다.
- 랜덤 생성 테스트는 실패를 재현할 수 있어야 한다. 테스트 클래스에 `@ExtendWith(InstancioExtension.class)`를 부착하면 실패 시 seed가 리포트되며, `@Seed` 또는 `Instancio.of(...).withSeed(...)`로 해당 seed를 고정해 재현한다.

## 5. 경계값·파라미터라이즈드 테스트

- 경계값(최소/최대, 경계 ±1, 빈 값, 임계점)은 랜덤으로 뽑지 않고 명시적으로 고정한다. 랜덤 데이터는 경계값 커버리지를 보장하지 않는다.
- 같은 로직을 여러 입력으로 검증할 때는 테스트 메서드를 복사하지 않고 `@ParameterizedTest`(`@ValueSource`/`@CsvSource`/`@MethodSource`)로 케이스를 나열한다. Domain 불변 조건의 경계 검증(2.1)에 특히 유용하다.
- 검증 규칙(길이, 범위, 패턴)이 있는 입력은 유효 경계와 무효 경계 양쪽 케이스를 모두 포함한다 (예: 길이 제한이 100이면 100은 성공, 101은 실패).

## 6. N+1 쿼리 카운트 검증

- Persistence Adapter 통합 테스트에서 Hibernate Statistics 또는 DataSource 프록시로 쿼리 카운트를 어서션한다(Layered와 동일한 원칙). 상위 도구(QueryDSL 등)를 도입한 프로젝트라면 `repository-tools.md` 3번의 N+1 검증 지침도 함께 참조한다.

## 7. 금지 패턴

- 테스트 클래스에 `@SpringBootTest`, `@ActiveProfiles`, `@AutoConfigureMockMvc`를 직접 선언하지 않는다.
- Domain 단위 테스트에 Spring 컨텍스트나 base class를 끌어들이지 않는다(Domain이 프레임워크로부터 격리되어 있다는 전제가 깨진다).
- Application Service/Finder 테스트에서 실제 Persistence Adapter(DB 접근)를 사용하지 않는다. Port를 Mock으로 대체한다.
- 테스트에서 `Thread.sleep`으로 실행 순서나 타임스탬프 차이를 보장하지 않는다.
- 어서션 대상 필드나 경계값을 랜덤으로 생성하지 않는다. seed 재현 수단 없이 랜덤 데이터를 사용하지 않는다.
