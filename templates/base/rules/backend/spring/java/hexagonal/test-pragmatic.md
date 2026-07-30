# 테스트 작성 규칙 (Hexagonal — Pragmatic flavor)

계층별 검증 대상과 필요한 인프라를 정의한다. 이 파일은 Pragmatic(실용) flavor 버전으로, 애플리케이션 서비스를 **실제 빈 통합 방식**으로 검증하고, stereotype 기반 테스트 애노테이션·픽스처·Instancio·ArchUnit을 사용한다.

이 프로젝트가 Clean(엄격) flavor를 채택했다면 이 파일은 적용 대상이 아니다. Clean flavor는 애플리케이션 서비스를 Port Mock으로 단위 테스트하는 버전(`test.md`, 원래 이름)이 대신 적용되며, `/rw:init`이 선택한 flavor에 맞는 한 버전만 정규 이름(`test.md`)으로 남긴다.

이 프로젝트가 Layered/Kotlin/SQL-first/WebFlux를 채택했다면 적용 대상이 아니다.

## 1. 핵심 원칙

- 테스트 설정(`@SpringBootTest`, `@Transactional`, `@AutoConfigureMockMvc` 등)을 개별 테스트 클래스에 직접 선언하지 않는다. `support/stereotype`의 커스텀 애노테이션과 `support/test`의 base class를 상속/부착해 사용한다.
- `Thread.sleep` 등 시간 기반 동기화를 사용하지 않는다. 픽스처로 결정적 테스트 데이터를 생성한다.

## 2. 계층별 테스트 전략

### 2.1. Domain 단위 테스트 (Spring 컨텍스트 없음)

- `domain/` 클래스는 프레임워크 의존이 최소이므로 순수 JUnit(+ AssertJ)로 테스트한다. 불변 조건, 상태 전이 메서드(`activate()`/`deactivate()`), 도메인 예외 발생 조건을 검증한다.
- 도메인 픽스처는 `{Domain}Fixture`의 정적 메서드로 만든다(예: `MemberFixture`).

### 2.2. Application Service 통합 테스트 (실제 빈, 트랜잭션 롤백)

- Clean flavor와 달리 **Port를 Mock하지 않고 실제 빈으로 통합 테스트**한다. `@ApplicationServiceTest` stereotype(= `@SpringBootTest` + `@Transactional` + `@Import(테스트 구성)`)을 사용한다.
- 공용 준비 로직은 `BaseApplicationServiceTest`에 `prepare*`(예: `prepareActiveMember()`, `preparePublishedCourse()`) 헬퍼로 두고, 실제 `provided` 포트를 `@Autowired`로 주입해 조합한다.
- `@Transactional`로 테스트마다 롤백되어 테스트 간 상태가 새지 않게 한다.
- 검증 대상은 서비스 오케스트레이션 + 실제 영속성 동작(저장/조회/매핑)의 결합이다.

### 2.3. Repository 테스트

- 리포지토리(`required` Spring Data 포트) 테스트는 `support/test`의 리포지토리 base class(예: `BaseRepositoryTest`, JPA 슬라이스 또는 H2 통합)를 상속한다. 파생 쿼리/`@Query`/`@EntityGraph`의 실제 동작과 연관 로딩을 검증한다.

### 2.4. Web Adapter 테스트

- 컨트롤러 슬라이스만 검증하려면 `@WebMvcTest` + `provided` 포트를 `@MockitoBean`으로 대체한다(요청 바인딩, 검증, 상태 코드, 직렬화).
- 전체 흐름을 검증하려면 `@WebApiAdapterTest` stereotype(= `@SpringBootTest` + `@AutoConfigureMockMvc` + `@Transactional`)으로 실제 빈을 통과시킨다. 어느 쪽을 쓸지는 시나리오별로 선택한다.

### 2.5. 아키텍처 테스트

- 계층 의존 방향과 슬라이스 순환/참조 규율은 `HexagonalArchitectureTest`(ArchUnit)로 검증한다. 상세는 `archunit.md`를 따른다. 위반 시 빌드가 실패해야 한다.

## 3. 테스트 데이터 생성

- 정렬/타임스탬프가 필요한 테스트에서 `Thread.sleep`을 쓰지 않고 픽스처에 명시적 값을 지정한다.
- 랜덤/대량 데이터가 필요하면 Instancio(`Instancio.create(...)` 등)로 생성한다. 도메인 규칙을 위반하는 무효 객체가 생성되지 않도록 필요한 필드는 픽스처/커스터마이저로 고정한다.

## 4. 금지 패턴

- 테스트 클래스에 `@SpringBootTest`/`@AutoConfigureMockMvc`/`@Transactional`을 직접 선언하지 않는다(stereotype/base class 사용).
- Application Service 테스트에서 실제 동작 검증을 회피하려고 모든 Port를 Mock으로 대체하지 않는다(이 flavor는 통합 검증이 기본이다 — 2.2).
- `Thread.sleep`으로 실행 순서나 타임스탬프 차이를 보장하지 않는다.
