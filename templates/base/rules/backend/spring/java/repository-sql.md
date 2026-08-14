---
description: SQL-first(ORM 미사용) 영속성 규칙 — JdbcClient 기본 + jOOQ 동적 조건 조립 (Layered/Hexagonal 공통)
paths:
  - "**/*Repository*.java"
  - "**/*PersistenceAdapter.java"
  - "**/*RowMapper.java"
  - "**/*SqlBuilder.java"
  - "**/*Conditions.java"
---

# SQL-first 영속성 규칙 (ORM 미사용)

JPA/ORM 없이 JdbcClient와 jOOQ(SQL 빌더)만으로 영속성 계층을 구성할 때의 규칙이다. Layered/Hexagonal 아키텍처 스타일과 무관하게 공통 적용되며, CQRS-lite 흐름·Finder/Service 분리·트랜잭션 규칙(`shared/architecture.md`, `service-layer.md`)은 그대로 전제한다.

이 프로젝트가 JPA(ORM)를 채택했다면 이 파일은 적용 대상이 아니다. ORM과 SQL-first 영속성 규칙을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 영속성 도구의 규칙 파일은 프로젝트에서 제외한다 (`layered/repository.md`·`hexagonal/repository.md`·`repository-tools.md` 참조). 마찬가지로 이 프로젝트가 Kotlin을 채택했다면 이 파일은 적용 대상이 아니다. Java와 Kotlin 규칙 파일을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 언어의 규칙 파일도 프로젝트에서 제외한다 (`kotlin/repository-sql.md` 참조). 또한 이 프로젝트가 WebFlux(리액티브 스택)를 채택했다면 이 파일은 적용 대상이 아니다. JdbcClient는 블로킹 실행기이므로 WebFlux와 함께 쓰지 않으며, WebFlux 프로젝트는 `repository-r2dbc.md`를 대신 적용한다.

## 1. 핵심 원칙

- 모든 영속성 접근은 **JdbcClient**로 실행한다. JPA/Hibernate/Spring Data JPA 의존성을 추가하지 않는다.
- SQL은 항상 named parameter로 바인딩한다. 문자열 연결로 SQL을 조립하지 않는다.
- 동적 검색 조건 조합은 **jOOQ를 SQL 빌더 전용**으로 사용해 `Condition` 조합으로 해결한다 (JPA Specification의 대응물). jOOQ는 쿼리를 실행하지 않는다.
- Read 흐름은 Read DTO(`record`)로 직접 매핑하고, Command 흐름의 조회는 Domain 재구성 팩토리를 경유한다 (`shared/architecture.md` 1번).

## 2. 클래스 구조와 Domain 매핑

- `{Domain}JdbcRepository` — `@Repository` 클래스. `JdbcClient`를 주입받는다. `JdbcTemplate`이나 `NamedParameterJdbcTemplate`을 직접 주입하지 않는다.
- Row 매핑은 `RowMapper<T>` 구현체 또는 람다로 한다. Read는 Read DTO에 직접 매핑하고, Command 흐름의 조회는 Domain의 정적 팩토리/생성자로 재구성한다.
- **Domain은 완전히 순수하다**: 영속성 애노테이션(`@Entity` 포함)·`orm.xml`·별도 JpaEntity가 모두 존재하지 않는다. Layered에서도 `domain.md`의 JPA 매핑 조항(마커 애노테이션, orm.xml, 하이드레이션 예외)은 적용하지 않으며, DB 재구성은 항상 명시적 팩토리를 경유해 불변 조건 검증을 통과한다.
- **Layered**: Finder/Service가 `{Domain}JdbcRepository`를 직접 사용한다.
- **Hexagonal**: `{Domain}PersistenceAdapter`가 Port 구현체로서 JdbcClient를 직접 사용하거나 내부 `{Domain}JdbcRepository`에 위임한다. `ports-and-adapters.md` 패키지 구조의 `{Domain}JpaEntity`/`{Domain}JpaRepository`는 SQL-first에서는 존재하지 않고 `{Domain}RowMapper`/`{Domain}JdbcRepository`로 대체된다 (이 조항이 우선한다). Port 시그니처에 JDBC 타입을 노출하지 않는 원칙은 동일하다.

## 3. 동적 조건 조합 (jOOQ Condition)

- `DSLContext`는 `DataSource` 없이 빌더 전용으로 구성하고(`DSL.using(SQLDialect.POSTGRES)`), `@Configuration` 클래스에서 단일 빈으로 등록한다.
- 검색 조건별 조립 로직은 도메인별 전용 클래스(`{Domain}SqlBuilder`)에 그룹화한다. null이거나 빈 값인 조건은 무시해 조건 유무에 따라 동적으로 쿼리가 구성되도록 한다 — JPA Specification 규칙과 동일한 사상.
- 조립된 쿼리는 `getSQL(ParamType.NAMED)`와 bind values로 꺼내 JdbcClient로만 실행한다.

```java
@Component
public class OrderSqlBuilder {
    private final DSLContext dsl;

    public OrderSqlBuilder(DSLContext dsl) {
        this.dsl = dsl;
    }

    public SqlWithParams search(OrderSearchQuery query) {
        List<Condition> conditions = new ArrayList<>();
        if (query.status() != null) {
            conditions.add(field("status").eq(query.status().name()));
        }
        if (query.minCreatedAt() != null) {
            conditions.add(field("created_at").greaterOrEqual(query.minCreatedAt()));
        }

        var q = dsl.select().from(table("orders")).where(conditions);
        return new SqlWithParams(q.getSQL(ParamType.NAMED), q.getBindValues());
    }
}
```

## 4. SQL 관리

- 5줄 이하의 단순 쿼리: 인라인 문자열을 허용한다.
- 5줄 초과의 쿼리: `resources/sql/{domain}/{operation}.sql` 파일로 외부화한다 (예: `resources/sql/order/monthly-summary.sql`).
- 다중 DB 벤더 지원이나 복잡한 동적 쿼리는 jOOQ SqlBuilder를 사용하고, 단일 벤더의 정적 쿼리는 plain SQL을 허용한다.

## 5. 트랜잭션

- `service-layer.md` 규칙을 그대로 따른다: 클래스 단위 선언, Finder는 `@Transactional(readOnly = true)`, Service는 `@Transactional`. JdbcClient는 Spring 트랜잭션에 자동 참여하므로 추가 설정이 필요 없다.

## 6. 테스트

- Repository/Persistence Adapter 통합 테스트는 `JdbcIntegrationTestBase`(H2 + JdbcClient, JPA 자동 구성 없음)를 상속한다. `test.md`의 base class 표에서 `Jpa*` 접두사 base class는 SQL-first에서는 `Jdbc*` 접두사로 대체해 읽는다.
- jOOQ SqlBuilder는 순수 단위 테스트로 작성한다. Spring 컨텍스트를 로드하지 않고, `DSL.using(SQLDialect.H2)`로 테스트용 SQL을 생성하며, 프로덕션 방언과의 차이는 방언별 SQL 문자열 검증으로 확인한다.
- 쿼리 수는 조인 설계로 통제한다. 필요 시 DataSource 프록시(`datasource-proxy` 등)로 쿼리 카운트를 어서션한다 (ORM의 N+1 감시와 동일한 목적).

## 7. 금지 패턴

- JPA/Hibernate/Spring Data JPA 의존성을 추가하지 않는다. Domain 클래스에 영속성 애노테이션을 붙이지 않는다.
- SQL을 문자열 연결로 조립하지 않는다. named parameter 바인딩을 사용한다.
- jOOQ에서 `query.fetch()` 등으로 쿼리를 직접 실행하지 않는다. 실행은 JdbcClient만 담당한다.
- `DSLContext`에 `DataSource`를 주입하지 않는다. 빌더 전용 인스턴스만 사용한다.
- Finder/Service 클래스에 SQL 문자열이나 쿼리 조립 로직을 배치하지 않는다. `{Domain}JdbcRepository`/`{Domain}SqlBuilder`에만 위치시킨다.
- 쓰기(Command) 흐름에서 도메인 검증을 우회하지 않는다. 벌크 작업은 예외이며, 우회 사유를 명시적으로 문서화한다.
