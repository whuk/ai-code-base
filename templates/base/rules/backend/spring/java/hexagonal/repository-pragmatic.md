---
description: Spring Data 리포지토리를 드리븐 포트로 쓰는 영속성 규칙과 쿼리 도구 선택 (Hexagonal — Pragmatic flavor)
paths:
  - "**/required/**"
  - "**/*Repository.java"
---

# Repository 규칙 (Hexagonal — Pragmatic flavor)

드리븐 포트로서의 영속성 리포지토리 작성 규칙을 다룬다. 이 파일은 Pragmatic(실용) flavor 버전으로, **Spring Data `Repository<Domain, Id>`를 곧 `required` 드리븐 포트로** 사용한다. 적용 대상은 Domain 클래스 자체다(도메인=엔티티, `domain.md`).

이 프로젝트가 Clean(엄격) flavor를 채택했다면 이 파일은 적용 대상이 아니다. Clean flavor는 `{Domain}JpaEntity` + `{Domain}PersistenceAdapter` + `{Domain}JpaRepository`로 분리하는 버전(`repository.md`, 원래 이름)이 대신 적용되며, `/rw:init`이 선택한 flavor에 맞는 한 버전만 정규 이름(`repository.md`)으로 남긴다.

이 프로젝트가 Layered/Kotlin/SQL-first/WebFlux를 채택했다면 적용 대상이 아니다.

## 1. 핵심 원칙

- 영속성 드리븐 포트는 `application/{aggregate}/required` 패키지에 Spring Data `org.springframework.data.repository.Repository<Domain, Long>`를 상속한 인터페이스로 선언한다. 필요한 메서드만 노출한다(`save`, `findById`, 도메인 특화 조회 등).
- 리포지토리는 Domain 객체를 그대로 저장/반환한다. 별도 `{Domain}JpaEntity`·`{Domain}PersistenceMapper`·`{Domain}PersistenceAdapter`를 두지 않는다.
- 구현은 Spring Data가 런타임에 제공한다. 대부분의 경우 구현 클래스를 직접 작성하지 않는다.

## 2. 도구 선택 계층 (Escalation Ladder)

항상 최하위 충분한 단계에서 시작한다(`shared/architecture.md` 8번). 적용 대상은 Domain 클래스다.

| Level | 도구 | 사용 조건 |
|-------|------|-----------|
| 0 | Query Derivation | 정적 조건 2개 이하의 단순 조회 (`findByEmail`, `findByCourseId`) |
| 1 | `@Query`(JPQL) / `@EntityGraph` | 파생 쿼리로 표현이 어려운 정적 조인·연관 로딩, 임베디드 값 기반 조회 |

- Level 1로 표현하기 어려운 경우(동적 다조건 조합, 3개 이상 엔티티 조인, 타입 안전 DTO 프로젝션, 복잡한 서브쿼리, 대량 벌크/집계, 측정된 JPA 성능 병목)에는 상위 도구(QueryDSL 등)로 에스컬레이션한다. 상위 도구의 도입 여부와 사용 상세는 프로젝트 시작 시점에 결정하며, 도입한 프로젝트만 `repository-tools.md`를 둔다.
- 상위 도구를 측정된 근거 없이 선제적으로 사용하지 않는다.

## 3. 동적/특수 쿼리

- 동적 검색 조건 조합이 필요하면 `@Query` 문자열을 여러 개 나열하지 말고 상위 도구(QueryDSL)로 에스컬레이션한다(`repository-tools.md`).
- N+1 방지는 `@EntityGraph`(단일 depth 즉시 로딩)를 우선 사용하고, 컬렉션 로딩은 `@BatchSize`/`hibernate.default_batch_fetch_size`를 글로벌 폴백으로 둔다.
- 페이지네이션과 fetch join(연관 포함 로딩)을 동시에 쓰지 않는다(인메모리 페이지네이션 경고).

## 4. Finder/Service 계층과의 통합

```
{Aggregate}{책임}Service (application/{aggregate})
    |  (required 포트 인터페이스에만 의존)
    +---> {Domain}Repository (application/{aggregate}/required, Spring Data Repository<Domain,Long>)
```

- 조회 전용 서비스(`{Aggregate}QueryService`)와 변경 서비스(`{Aggregate}ModifyService`)는 `required` 리포지토리 포트를 주입받아 사용한다(`service-layer.md`).
- 리포지토리가 반환한 `Optional<Domain>`의 부재 처리는 서비스에서 `orElseThrow(...)`로 도메인/애플리케이션 예외를 던진다.

## 5. 금지 패턴

- Domain과 분리된 `{Domain}JpaEntity`나 변환 매퍼를 만들지 않는다(도메인=엔티티, `domain.md`).
- 동적 검색 조건을 위해 여러 개의 `@Query` 메서드를 나열하지 않는다(상위 도구로 에스컬레이션).
- 측정된 근거 없이 선제적으로 상위 단계 도구(QueryDSL 등)로 에스컬레이션하지 않는다.
- 리포지토리 조립/조회 로직을 서비스 클래스에 흩뿌리지 않는다(`required` 포트에 선언).
