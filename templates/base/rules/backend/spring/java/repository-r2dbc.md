---
description: WebFlux 리액티브 영속성 규칙 — Spring Data R2DBC 기본 + jOOQ 동적 조건 조립 + DatabaseClient (Layered/Hexagonal 공통)
globs: "**/*Repository*.java,**/*PersistenceAdapter.java,**/*Row.java,**/*SqlBuilder.java"
---

# R2DBC 영속성 규칙 (WebFlux 전용)

WebFlux 프로젝트에서 R2DBC 기반으로 영속성 계층을 구성할 때의 규칙이다. Layered/Hexagonal 아키텍처 스타일과 무관하게 공통 적용되며, CQRS-lite 흐름·Finder/Service 분리(`shared/architecture.md`, `service-layer.md`)와 트랜잭션·블로킹 규율(`webflux.md` 3번·4번)은 그대로 전제한다. 문서형 데이터가 필요한 도메인의 리액티브 MongoDB 병용 규칙은 `repository-reactive-mongo.md`가 담당한다(병용하지 않는 프로젝트는 해당 파일을 제외한다).

이 프로젝트가 Spring MVC(서블릿 스택)를 채택했다면 이 파일은 적용 대상이 아니다. MVC와 WebFlux를 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 웹 스택의 영속성 규칙 파일은 프로젝트에서 제외한다 (MVC의 영속성 규칙은 `layered/repository.md`·`hexagonal/repository.md`·`repository-tools.md` 또는 `repository-sql.md` 참조). 마찬가지로 이 프로젝트가 Kotlin을 채택했다면 이 파일은 적용 대상이 아니다 — WebFlux 규칙은 현재 Java 전용으로 제공된다.

## 1. 핵심 원칙

- 모든 영속성 접근은 리액티브 스택으로 실행한다: Spring Data R2DBC(Repository/`R2dbcEntityTemplate`)와 `DatabaseClient`. JPA/Hibernate/JDBC 등 블로킹 영속성 의존성을 추가하지 않는다.
- Spring Data R2DBC는 ORM이 아니다: 연관관계 매핑·지연 로딩·Embeddable이 없다. 조인은 항상 명시적 SQL/쿼리로 해결하고, 쿼리 수는 조인 설계로 통제한다 (N+1을 만드는 지연 로딩 자체가 없다).
- SQL은 항상 바인드 파라미터로 바인딩한다. 문자열 연결로 SQL을 조립하지 않는다.
- 동적 검색 조건 조합은 `R2dbcEntityTemplate`의 `Criteria`를 기본으로 하고, 복잡한 쿼리는 **jOOQ를 SQL 빌더 전용**으로 사용해 `Condition` 조합으로 해결한다 (JPA Specification의 대응물). jOOQ는 쿼리를 실행하지 않는다.
- Read 흐름은 Read DTO(`record`)로 직접 매핑하고, Command 흐름의 조회는 Domain 재구성 팩토리를 경유한다 (`shared/architecture.md` 1번).

## 2. 클래스 구조와 Domain 매핑

- **Domain은 완전히 순수하다**: 영속성 애노테이션(`@Table`, `@Id`, `@Column` 포함)과 Reactor 타입을 모두 갖지 않는다 (`webflux.md` 5번). `orm.xml`·JpaEntity에 해당하는 장치는 존재하지 않는다.
- R2DBC 매핑 대상은 영속성 계층 전용의 얇은 row record인 `{Domain}Row`다. `@Table`/`@Id`/`@Column` 등 Spring Data Relational 애노테이션은 이 record에만 붙인다. `{Domain}Row`는 테이블 구조를 1:1로 반영하는 플랫 record이며 비즈니스 로직을 갖지 않는다.
- `{Domain}Row` ↔ Domain/Read DTO 변환은 Repository(Layered) 또는 Persistence Adapter(Hexagonal)가 전담한다. Read는 Read DTO에 직접 매핑하고, Command 흐름의 조회는 Domain의 정적 팩토리/생성자로 재구성해 불변 조건 검증을 통과시킨다.
- **Layered**: Finder/Service가 `{Domain}R2dbcRepository`(Spring Data R2DBC 인터페이스) 또는 `{Domain}QueryRepository`(Template/DatabaseClient 기반 클래스)를 직접 사용한다. 반환 타입은 `Mono`/`Flux`.
- **Hexagonal**: `{Domain}PersistenceAdapter`가 Port 구현체로서 위 Repository들을 내부에서 사용한다. `ports-and-adapters.md` 패키지 구조의 `{Domain}JpaEntity`/`{Domain}JpaRepository`는 WebFlux에서는 존재하지 않고 `{Domain}Row`/`{Domain}R2dbcRepository`로 대체된다 (이 조항이 우선한다). Port 시그니처는 `Mono<Order>`/`Flux<OrderReadDto>` 등 Reactor 타입을 허용하되(`webflux.md` 5번), `{Domain}Row`·`io.r2dbc.*`·Spring Data 타입은 노출하지 않는다.

## 3. 도구 선택 계층 (Escalation Ladder)

항상 최하위 충분한 단계에서 시작한다. 상위 단계로 올라가려면 구체적 근거가 필요하다 (`shared/architecture.md` 8번).

| Level | 도구 | 사용 조건 |
|-------|------|-----------|
| 0 | Spring Data R2DBC Repository (Query Derivation) | 정적 조건 2개 이하의 단순 조회, 기본 CRUD |
| 1 | `R2dbcEntityTemplate` + `Criteria` | 동적 검색 조건 조합 (기본값) |
| 2 | jOOQ(SQL 빌더) + `DatabaseClient` | 복잡한 조인/집계/서브쿼리, 다중 테이블 프로젝션, 대량 벌크, Criteria로 표현 불가한 SQL |

- Level 1의 조건 조립 로직은 Finder/Service가 아닌 Repository 클래스에 둔다.
- Level 2는 단일 테이블 조회로 충분한 경우 선제적으로 사용하지 않는다. R2DBC에는 연관관계가 없으므로 다중 테이블 조회는 자연스럽게 Level 2로 간다 — 이 경우는 정당한 사용이다.

## 4. 동적 조건 조합 (jOOQ Condition)

- `DSLContext`는 `DataSource`/`ConnectionFactory` 없이 빌더 전용으로 구성하고(`DSL.using(SQLDialect.POSTGRES)`), `@Configuration` 클래스에서 단일 빈으로 등록한다.
- 검색 조건별 조립 로직은 도메인별 전용 클래스(`{Domain}SqlBuilder`)에 그룹화한다. null이거나 빈 값인 조건은 무시해 조건 유무에 따라 동적으로 쿼리가 구성되도록 한다 — MVC의 `repository-sql.md` 3번과 동일한 사상.
- 조립된 쿼리는 `getSQL(ParamType.NAMED)`와 bind values로 꺼내 `DatabaseClient`로만 실행한다. jOOQ의 R2DBC 직접 실행(`Publisher` 반환)은 사용하지 않는다 — 실행 경로를 `DatabaseClient` 하나로 고정해 빌더/실행 책임 분리를 유지한다.

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

- 실행은 Repository에서 `DatabaseClient.sql(...)`에 바인드 파라미터를 적용하고, `.map((row, meta) -> ...)`로 Read DTO에 직접 매핑한다.

## 5. SQL 관리

- 5줄 이하의 단순 쿼리: 인라인 문자열을 허용한다.
- 5줄 초과의 쿼리: `resources/sql/{domain}/{operation}.sql` 파일로 외부화한다 (예: `resources/sql/order/monthly-summary.sql`).
- 다중 DB 벤더 지원이나 복잡한 동적 쿼리는 jOOQ SqlBuilder를 사용하고, 단일 벤더의 정적 쿼리는 plain SQL을 허용한다.

## 6. 트랜잭션

- `webflux.md` 3번을 따른다: `R2dbcTransactionManager` 전제의 클래스 단위 `@Transactional` 선언(Finder는 `readOnly = true`), 트랜잭션 경계 안 연산의 단일 리액티브 체인 연결, 예외적 부분 경계만 `TransactionalOperator`.

## 7. 테스트

- Repository/Persistence Adapter 통합 테스트는 `R2dbcIntegrationTestBase`(R2DBC 지원 인메모리 DB(H2 r2dbc) 또는 Testcontainers, JPA 자동 구성 없음)를 상속한다. `test.md`의 base class 표에서 `Jpa*`/`Jdbc*` 접두사 base class는 `R2dbc*` 접두사로 대체해 읽는다 (`webflux.md` 8번).
- 검증은 `StepVerifier`로 한다: 방출 값과 종료 시그널을 어서션하고, `block()`으로 결과를 꺼내지 않는다.
- jOOQ SqlBuilder는 순수 단위 테스트로 작성한다. Spring 컨텍스트를 로드하지 않고, `DSL.using(SQLDialect.H2)`로 테스트용 SQL을 생성하며, 프로덕션 방언과의 차이는 방언별 SQL 문자열 검증으로 확인한다 — MVC의 SqlBuilder 테스트 규칙과 동일하다.

## 8. 금지 패턴

- JPA/Hibernate/Spring Data JPA/JDBC 등 블로킹 영속성 의존성을 추가하지 않는다.
- Domain 클래스에 R2DBC/Spring Data 애노테이션(`@Table`, `@Id`, `@Column`)을 붙이지 않는다. 매핑은 `{Domain}Row`에만.
- Port 인터페이스/Service 반환 타입에 `{Domain}Row`, `io.r2dbc.*`, Spring Data 타입을 노출하지 않는다.
- SQL을 문자열 연결로 조립하지 않는다. 바인드 파라미터를 사용한다.
- jOOQ로 쿼리를 직접 실행하지 않는다(R2DBC 연동 실행 포함). 실행은 `DatabaseClient`(또는 Level 0~1 도구)만 담당한다.
- `DSLContext`에 `DataSource`/`ConnectionFactory`를 주입하지 않는다. 빌더 전용 인스턴스만 사용한다.
- Finder/Service 클래스에 SQL 문자열이나 쿼리 조립 로직을 배치하지 않는다. `{Domain}R2dbcRepository`/`{Domain}QueryRepository`/`{Domain}SqlBuilder`에만 위치시킨다.
- Repository에서 `block()`으로 결과를 꺼내 동기 반환하지 않는다.
- 쓰기(Command) 흐름에서 도메인 검증을 우회하지 않는다. 벌크 작업은 예외이며, 우회 사유를 명시적으로 문서화한다.
