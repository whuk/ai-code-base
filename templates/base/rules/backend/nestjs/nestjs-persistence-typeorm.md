---
description: NestJS 영속성 규칙 — TypeORM (EntitySchema 매핑, nestjs.md 전제)
globs: "**/*.controller.ts,**/*.service.ts,**/*.module.ts,**/*.entity.ts,**/*.repository.ts"
---

# NestJS 영속성 규칙 — TypeORM

`nestjs.md`의 모듈/계층 구조·Finder/Service 분리와 `shared/architecture.md` 8번의 Escalation Ladder를 전제로, TypeORM을 영속성 도구로 채택한 프로젝트의 Domain 매핑·Repository 도구·트랜잭션 규칙만 다룬다.

이 프로젝트가 Prisma나 SQL-first(Kysely)를 채택했다면 이 파일은 적용 대상이 아니다. NestJS 영속성 도구(TypeORM/Prisma/SQL-first)는 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 도구의 규칙 파일은 프로젝트에서 제외한다 (`nestjs-persistence-prisma.md`, `nestjs-persistence-sqlfirst.md` 참조).

## 1. Domain 매핑

- Domain 클래스가 엔티티 역할을 겸한다. 데코레이터 대신 `EntitySchema`(TypeORM의 코드-외부 매핑 정의)를 사용해 컬럼/관계 매핑을 Domain 클래스 밖으로 분리한다. 이는 Spring 규칙의 `orm.xml`(`spring/java/layered/domain.md` 9번)과 동일한 철학이다.
- Value Object는 `EntitySchema`의 embedded 매핑으로 처리한다.

## 2. Repository 도구 선택 (Escalation Ladder 적용)

- 단순 조회(정적 조건 1-2개): `Repository.find()`.
- 동적 검색 조건 조합: `QueryBuilder`. 조건별 빌더 함수를 도메인 전용 모듈에 그룹화한다(Spring의 Specification 패턴과 동일한 사상).
- 복잡한 조인/N+1 방지: `relations`/`leftJoinAndSelect`. 페이지네이션과 fetch join(관계 포함 로딩)을 동시에 쓰지 않는다(인메모리 페이지네이션 경고).
- 대량 벌크/집계/네이티브 SQL: 원시 쿼리(`query()`)는 측정된 성능 문제가 있거나 빌더로 표현 불가한 경우에만 예외적으로 허용한다. 항상 파라미터 바인딩을 사용하고 문자열 연결로 SQL을 조립하지 않는다.

## 3. 트랜잭션

- Service의 쓰기 메서드는 트랜잭션 경계로 감싼다. `DataSource.transaction()` 또는 `QueryRunner`를 사용한다.
- Finder(조회 전용)는 트랜잭션 경계를 명시적으로 열지 않는다.

## 4. 금지 패턴

- Domain 클래스에 TypeORM 컬럼 데코레이터(`@Column`, `@OneToMany` 등)를 직접 붙이지 않는다(`EntitySchema` 사용).
- 동적 검색 조건을 원시 SQL/`QueryBuilder` 문자열로 나열하지 않는다(2번 기준 도구 사용).
- SQL을 문자열 연결로 조립하지 않는다. 항상 파라미터 바인딩을 사용한다(2번).
