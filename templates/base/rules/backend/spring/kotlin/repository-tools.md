---
description: QueryDSL·JdbcClient·jOOQ 사용 상세 규칙 (Escalation Ladder Level 2~3, Layered/Hexagonal 공통, Kotlin)
paths:
  - "**/*Repository*.kt"
  - "**/*PersistenceAdapter.kt"
  - "**/*JpaEntity.kt"
  - "**/*Specifications.kt"
  - "**/*SqlBuilder.kt"
---

# QueryDSL·JdbcClient·jOOQ 사용 규칙

Escalation Ladder(`shared/architecture.md` 8번)의 상위 티어에 해당하는 Level 2(QueryDSL)와 Level 3(JdbcClient + jOOQ) 도구의 사용 상세 규칙이다. Level 0~1(Query Derivation, JPA Specification)은 `layered/repository.md` 또는 `hexagonal/repository.md`가 다루며, 이 파일은 그 상위 도구를 도입하기로 한 프로젝트에만 존재한다(도입하지 않으면 `/rw:init`이 제외한다). Layered/Hexagonal 아키텍처 스타일과 무관하게 공통 적용된다 — Layered는 Domain 클래스, Hexagonal은 `{Domain}JpaEntity`가 쿼리 대상이라는 점만 다르다.

이 프로젝트가 Java를 채택했다면 이 파일은 적용 대상이 아니다. Java와 Kotlin 규칙 파일을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 언어의 규칙 파일은 프로젝트에서 제외한다 (`java/repository-tools.md` 참조). 또한 이 프로젝트가 SQL-first(ORM 미사용)를 채택했다면 이 파일은 적용 대상이 아니다. ORM과 SQL-first 영속성 규칙을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 영속성 도구의 규칙 파일도 프로젝트에서 제외한다 (`repository-sql.md` 참조).

## 1. QueryDSL 사용 규칙

### 1.1. 의존성

- `io.github.openfeign.querydsl` 6.x를 사용한다 (Jakarta EE / Spring Boot 3+ 네이티브 지원).
- 원본 `com.querydsl` 5.1.0은 사실상 관리 중단 상태이므로 신규 프로젝트에서 사용하지 않는다.
- Q-class는 빌드 시 자동 생성한다. 버전 관리(VCS)에 포함하지 않는다.
- Q-class 생성 대상은 아키텍처 스타일에 따라 다르다 (Kotlin은 Java APT 대신 kapt를 경유한다):
  - **Layered**: Domain 클래스. `layered/domain.md` 2번/9번 규칙에 따라 소스에는 `@Entity` 마커만 남고 나머지 매핑은 `orm.xml`에 있지만, `@Entity`가 소스에 남아있으므로 kapt에 `JPAAnnotationProcessor`를 등록하면 애노테이션 스캔 기반 Q-class 생성이 그대로 동작한다.
  - **Hexagonal**: `{Domain}JpaEntity`. 표준 JPA 애노테이션을 그대로 사용하므로 kapt 등록 외 별도 설정 없이 동작한다 (`hexagonal/repository.md` 2번).

### 1.2. 클래스 구조

Spring Data의 Custom Repository Fragment 패턴을 사용한다.

- `{Domain}RepositoryCustom` — 커스텀 메서드를 선언하는 인터페이스
- `{Domain}RepositoryImpl` — QueryDSL로 구현하는 클래스
- `{Domain}Repository`가 `JpaRepository`, `JpaSpecificationExecutor`, `{Domain}RepositoryCustom`을 모두 상속한다.
- 세 클래스 모두 같은 패키지에 배치한다.
- Hexagonal에서는 `{Domain}JpaRepository`에 동일한 Fragment 패턴을 적용하되, Custom 구현의 반환 타입이 Adapter 경계 밖으로 JPA 타입을 노출하지 않게 한다 (`hexagonal/repository.md` 3번).

```kotlin
interface OrderRepositoryCustom {
    fun findOrdersWithItems(query: OrderSearchQuery): List<OrderReadDto>
}

class OrderRepositoryImpl(
    private val queryFactory: JPAQueryFactory
) : OrderRepositoryCustom {
    // QueryDSL 구현
}

interface OrderRepository :
    JpaRepository<Order, Long>,
    JpaSpecificationExecutor<Order>,
    OrderRepositoryCustom
```

- `JPAQueryFactory`는 `@Configuration` 클래스에서 단일 빈으로 등록한다.

### 1.3. DTO 프로젝션

- `Projections.constructor()` 또는 `@QueryProjection`으로 Read DTO(`data class`)에 직접 매핑한다.
- `shared/architecture.md` 1번의 Read 흐름과 일관되게, 단순 조회 시 Rich Domain 객체를 거치지 않는다.

### 1.4. N+1 방지 도구

우선순위 순서대로 적용한다.

1. **`@EntityGraph`**: 단순 단일 depth 즉시 로딩에 사용한다. Repository 메서드에 `@EntityGraph(attributePaths = [...])`를 선언한다.
2. **QueryDSL `fetchJoin()`**: 다중 depth 또는 조건부 조인이 필요한 경우 사용한다.
3. **`@BatchSize` / `hibernate.default_batch_fetch_size`**: 컬렉션 로딩의 글로벌 폴백으로 설정한다.
4. **DTO Projection**: 엔티티 그래프 자체를 우회한다. Read 전용 Query 흐름에 가장 적합하다.

## 2. JdbcClient 사용 규칙

### 2.1. 전제 조건

- Spring Boot 3.2+ / Spring Framework 6.1+ 환경에서 사용한다.
- `spring-boot-starter-jdbc` 또는 `spring-boot-starter-data-jdbc` 의존성이 필요하다.

### 2.2. 클래스 구조

- `{Domain}JdbcRepository` — `@Repository` 애노테이션을 붙인 독립 클래스. JPA Repository의 확장이 아니다.
- JPA Repository와 같은 패키지에 배치한다.
- `JdbcClient`를 주입받아 사용한다. `JdbcTemplate`이나 `NamedParameterJdbcTemplate`을 직접 주입하지 않는다.

```kotlin
@Repository
class OrderJdbcRepository(
    private val jdbcClient: JdbcClient
)
```

### 2.3. SQL 관리

- 5줄 이하의 단순 쿼리: 인라인 문자열을 허용한다.
- 5줄 초과의 쿼리: `resources/sql/{domain}/{operation}.sql` 파일로 외부화한다 (예: `resources/sql/order/monthly-summary.sql`).

### 2.4. Row 매핑

- `RowMapper<T>` 구현체 또는 람다를 사용하여 Read DTO(`data class`)에 직접 매핑한다.
- `shared/architecture.md` 1번의 Read 흐름과 일관되게, 도메인 객체를 경유하지 않는다.

### 2.5. jOOQ를 SQL 빌더로 사용 (DB 벤더 독립성)

jOOQ를 **SQL 생성 전용**으로 사용하여 데이터베이스 벤더 종속성을 제거한다. jOOQ는 쿼리를 실행하지 않는다.

**클래스 구조**:
- `{Domain}SqlBuilder` — `@Component` 클래스에 SQL 생성 로직을 배치한다.

**실행 패턴**:
```kotlin
@Component
class OrderSqlBuilder(
    private val dsl: DSLContext
) {

    fun monthlySummary(month: YearMonth): SqlWithParams {
        val query = dsl.select(...)
            .from(table("orders"))
            .where(field("created_at").greaterOrEqual(month.atDay(1)))
            .groupBy(field("status"))

        return SqlWithParams(
            query.getSQL(ParamType.NAMED),
            query.bindValues
        )
    }
}
```

**DSLContext 설정**:
- `DataSource` 없이 빌더 전용으로 구성한다: `DSL.using(SQLDialect.POSTGRES)`.
- `@Configuration` 클래스에서 단일 빈으로 등록한다.

```kotlin
@Configuration
class JooqConfig {

    @Bean
    fun dslContext(): DSLContext = DSL.using(SQLDialect.POSTGRES)
}
```

**사용 범위**:
- 다중 DB 벤더를 지원하거나 복잡한 쿼리에서 문자열 조합이 오류를 유발할 수 있는 경우 jOOQ SqlBuilder를 사용한다.
- 단일 DB 프로젝트의 단순 쿼리는 plain SQL 문자열을 허용한다.
- jOOQ 코드 생성(테이블 메타데이터 클래스)은 선택사항이다. SQL 빌더 전용 사용 시 문자열 테이블/컬럼명으로 충분하다. 코드 생성을 사용하는 경우, 생성된 클래스는 빌드 출력 디렉토리에 배치하고 버전 관리에 포함하지 않는다.

## 3. 테스트

- **QueryDSL RepositoryImpl 테스트**: `JpaIntegrationTestBase`를 상속한다 (기존 JPA Repository/Persistence Adapter 테스트와 동일 — base class 표는 Layered는 `layered/test.md`, Hexagonal은 `hexagonal/test.md` 참조).
- **JdbcClient Repository 테스트**: `JpaIntegrationTestBase`를 상속한다. 동일한 DataSource(H2)를 사용한다.
- **jOOQ SqlBuilder 테스트**: 순수 단위 테스트로 작성한다. Spring 컨텍스트를 로드하지 않는다. `DSL.using(SQLDialect.H2)`로 테스트용 SQL을 생성하고, 프로덕션 방언과의 차이는 방언별 SQL 문자열 검증으로 확인한다.
- **N+1 검증**: QueryDSL/JPA 통합 테스트에서 Hibernate Statistics 또는 DataSource 프록시(`datasource-proxy` 등)를 사용하여 쿼리 카운트를 어서션한다.

## 4. 금지 패턴

- Specification으로 충분한 단순 동적 필터에 QueryDSL을 사용하지 않는다.
- Service/Finder 클래스에 QueryDSL 쿼리 로직을 배치하지 않는다. `RepositoryImpl`에만 위치시킨다.
- Finder에서 `JPAQueryFactory`를 직접 주입하지 않는다. Repository 인터페이스를 통해서만 접근한다.
- `fetchJoin()`과 `offset/limit` 페이지네이션을 조합하지 않는다 (인메모리 페이지네이션 경고 발생). DTO 프로젝션 또는 서브쿼리 기반 페이지네이션을 사용한다.
- JPA로 충분한 표준 CRUD에 JdbcClient를 사용하지 않는다.
- jOOQ에서 `query.fetch()` 등으로 쿼리를 직접 실행하지 않는다. 실행은 JdbcClient만 담당한다.
- `DSLContext`에 `DataSource`를 주입하지 않는다. 빌더 전용 인스턴스만 사용한다.
- Finder/Service 클래스에 SQL 생성 로직을 배치하지 않는다. `{Domain}SqlBuilder` 또는 `{Domain}JdbcRepository`에만 위치시킨다.
- 쓰기(Command) 흐름에서 도메인 검증을 우회하기 위해 JdbcClient를 사용하지 않는다. 벌크 작업은 예외이며, 도메인 검증 우회 사유를 명시적으로 문서화한다.
