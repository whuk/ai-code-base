---
description: Outbound Persistence Adapter 작성 시 동적 검색 조건 처리 방식과 쿼리 작성 규칙 (Hexagonal)
globs: "**/*PersistenceAdapter.java,**/*JpaEntity.java,**/*JpaRepository.java,**/*Specifications.java"
---

# Outbound Persistence Adapter 규칙

`ports-and-adapters.md` 6.2절의 Outbound Persistence Adapter 구현 방법을 다룬다. 검색 조건은 JPA Specification(Level 0~1)으로 조합한다. Level 1로 표현하기 어려운 복잡 쿼리를 위한 상위 도구(QueryDSL, JdbcClient + jOOQ)를 도입한 프로젝트는 그 사용 상세 규칙을 별도 도구 문서에서 다룬다(도입하지 않은 프로젝트에는 해당 문서가 없다). 적용 대상은 Domain 클래스가 아니라 `{Domain}JpaEntity`다.

이 프로젝트가 Layered를 채택했다면 이 파일은 적용 대상이 아니다 (`layered/repository.md` 참조). 마찬가지로 이 프로젝트가 Kotlin을 채택했다면 이 파일은 적용 대상이 아니다. Java와 Kotlin 규칙 파일을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 언어의 규칙 파일도 프로젝트에서 제외한다 (`kotlin/hexagonal/repository.md` 참조). 또한 이 프로젝트가 SQL-first(ORM 미사용)를 채택했다면 이 파일은 적용 대상이 아니다. ORM과 SQL-first 영속성 규칙을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 영속성 도구의 규칙 파일도 프로젝트에서 제외한다 (`repository-sql.md` 참조). WebFlux(리액티브 스택)를 채택한 프로젝트도 이 파일의 적용 대상이 아니다. 블로킹 영속성(JPA)과 리액티브 영속성(R2DBC)을 한 프로젝트에서 동시에 쓰지 않으므로, WebFlux 프로젝트는 `repository-r2dbc.md`를 대신 적용한다.

## 1. 핵심 원칙

- `{Domain}JpaEntity`는 Domain과 분리된 순수 영속성 클래스다. Domain 클래스와 달리 표준 JPA 애노테이션(`@Entity`, `@Table`, `@Id`, `@Column`, `@OneToMany` 등)을 직접 사용한다 — Layered와 달리 `orm.xml` 분리가 필요 없다. JpaEntity는 어차피 Domain에 노출되지 않으므로 애노테이션 유무가 Domain 순수성에 영향을 주지 않는다.
- 검색(조회) 조건이 동적으로 조합되는 경우, `@Query` 대신 **JPA Specification**을 사용한다. `{Domain}JpaRepository`가 `JpaSpecificationExecutor<{Domain}JpaEntity>`를 상속한다.
- Specification 메서드는 `{Domain}JpaEntity` 기준 조건 조립만 담당하며, 도메인별 전용 클래스에 `static` 메서드로 그룹화한다 (예: `OrderJpaEntitySpecifications`).

## 2. 도구 선택 계층 (Escalation Ladder)

항상 최하위 충분한 단계에서 시작한다. 적용 대상은 `{Domain}JpaEntity`다 (`shared/architecture.md` 8번).

| Level | 도구 | 사용 조건 |
|-------|------|-----------|
| 0 | Query Derivation | 정적 조건 2개 이하의 단순 조회 |
| 1 | JPA Specification | 동적 검색 조건 조합 (기본값) |

- Level 1(Specification)로 표현하기 어려운 경우(N+1 fetch join + 페이지네이션, 3개 이상 엔티티 조인, 타입 안전 DTO 프로젝션, 복잡한 서브쿼리, 대량 벌크/집계, 측정된 JPA 성능 병목)에는 상위 도구(Level 2 QueryDSL, Level 3 JdbcClient + jOOQ)로 에스컬레이션한다. 상위 도구의 도입 여부와 사용 상세 규칙은 프로젝트 시작 시점에 결정하며, 도입한 프로젝트만 별도 도구 문서를 둔다.
- 상위 도구를 측정된 근거 없이 선제적으로 사용하지 않는다.

## 3. PersistenceAdapter 구조

```java
public interface OrderCommandPort {
    Optional<Order> findDomainById(OrderId id);
    Long save(Order order);
    void delete(OrderId id);
}

public interface OrderQueryPort {
    Optional<OrderReadDto> findById(OrderId id);
    List<OrderReadDto> search(OrderSearchQuery query);
}

@Component
public class OrderPersistenceAdapter implements OrderCommandPort, OrderQueryPort {

    private final OrderJpaRepository jpaRepository;

    public OrderPersistenceAdapter(OrderJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Optional<Order> findDomainById(OrderId id) {
        return jpaRepository.findById(id.value())
            .map(OrderPersistenceMapper::toDomain);
    }

    @Override
    public Long save(Order order) {
        OrderJpaEntity entity = OrderPersistenceMapper.toEntity(order);
        return jpaRepository.save(entity).getId();
    }

    @Override
    public Optional<OrderReadDto> findById(OrderId id) {
        return jpaRepository.findById(id.value())
            .map(OrderPersistenceMapper::toReadDto);
    }
}
```

- Command 메서드는 Domain 객체를 받아 `{Domain}JpaEntity`로 변환 후 저장한다. 반환 타입은 `shared/architecture.md` 2번과 동일하게 생성은 ID, 수정/삭제는 `void`. 기존 Aggregate 조회가 필요하면 `findDomainById`로 Domain 객체를 직접 반환한다(`ports-and-adapters.md` 4번).
- Query 메서드는 Domain 객체를 경유하지 않고 Read DTO(`record`)로 직접 매핑해 반환한다(`shared/architecture.md` 1번의 Read 흐름과 동일한 CQRS 원칙).
- 변환 로직은 Adapter 내부 private 메서드 또는 `{Domain}PersistenceMapper`(정적 유틸 클래스)에 위치시킨다. Domain, Port 인터페이스에는 절대 두지 않는다.

## 4. N+1 방지 도구

`@EntityGraph`와 `@BatchSize`/`hibernate.default_batch_fetch_size`로 N+1을 방지한다. 상위 도구를 도입한 경우 QueryDSL `fetchJoin()`·DTO Projection도 우선순위(`@EntityGraph` → `fetchJoin()` → `@BatchSize` → DTO Projection)에 따라 사용할 수 있다(도구 문서 참조). 모두 `{Domain}JpaEntity`/`{Domain}JpaRepository` 내부에서만 적용하며, Adapter 경계 밖으로 로딩 전략이 새어나가지 않게 한다.

## 5. Finder/Service 계층과의 통합

```
{Domain}Service / {Domain}Finder (application/service)
    |  (port/out 인터페이스에만 의존)
    +---> {Domain}CommandPort / {Domain}QueryPort
              |
              +---> {Domain}PersistenceAdapter (adapter/out/persistence)
                        |
                        +---> {Domain}JpaRepository — JPA (Specification)
```

- Application Service/Finder는 Port 인터페이스 타입으로만 의존을 선언한다. 어떤 Adapter 구현체가 주입되는지 알 필요가 없다(Spring이 DI로 연결).

## 6. 테스트

- Persistence Adapter 테스트는 `test.md`의 base class(`JpaIntegrationTestBase` 등)를 상속한다. 차이는 검증 대상이 Domain이 아니라 `{Domain}JpaEntity`/`OrderPersistenceMapper` 변환 결과라는 점이다.
- Port 인터페이스 자체는 테스트 대상이 아니다(인터페이스이므로). Adapter 구현체와 매퍼 로직을 테스트한다.

## 7. 금지 패턴

- `{Domain}JpaEntity`를 Port 인터페이스나 Application Service 반환 타입으로 노출하지 않는다.
- Domain 클래스에 `{Domain}JpaEntity` 변환 메서드를 두지 않는다(`domain.md` 2번, 변환은 Adapter/Mapper 전담).
- 동적 검색 조건을 `@Query` 문자열로 나열하지 않는다.
- Application Service/Finder에서 `{Domain}PersistenceAdapter`, `{Domain}JpaRepository`를 직접 타입으로 주입받지 않는다. 반드시 `port/out` 인터페이스로만 주입받는다.
