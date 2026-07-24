---
description: NestJS 영속성 규칙 — SQL-first(Kysely) (ORM 미사용, Repository가 매핑 전담, nestjs.md 전제)
globs: "**/*.controller.ts,**/*.service.ts,**/*.module.ts,**/*.entity.ts,**/*.repository.ts"
---

# NestJS 영속성 규칙 — SQL-first (Kysely)

`nestjs.md`의 모듈/계층 구조·Finder/Service 분리와 `shared/architecture.md` 8번의 Escalation Ladder를 전제로, ORM 없이 Kysely(타입 안전 쿼리 빌더)를 영속성 도구로 채택한 프로젝트의 Domain 매핑·Repository 도구·트랜잭션 규칙만 다룬다.

이 프로젝트가 TypeORM이나 Prisma를 채택했다면 이 파일은 적용 대상이 아니다. NestJS 영속성 도구(TypeORM/Prisma/SQL-first)는 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 도구의 규칙 파일은 프로젝트에서 제외한다 (`nestjs-persistence-typeorm.md`, `nestjs-persistence-prisma.md` 참조).

## 1. Domain 매핑

- Kysely(타입 안전 쿼리 빌더)를 기본으로 사용한다(대안: DB 드라이버 직접 + 수동 매핑). Repository 구현체가 SQL 실행과 Row ↔ Domain 객체 변환을 전담하고, Domain 클래스는 어떤 영속성 타입도 참조하지 않는다.
- ORM이 없으므로 `EntitySchema`는 사용하지 않는다. DB 스키마 타입은 Kysely `Database` 인터페이스로 별도 모듈에 정의한다.
- Value Object는 Repository의 변환 로직에서 처리한다.

## 2. Repository 도구 선택 (Escalation Ladder 적용)

- 단순 조회(정적 조건 1-2개): Kysely 기본 표현식.
- 동적 검색 조건 조합: Kysely 표현식 빌더(`eb`) 조합. 조건별 빌더 함수를 도메인 전용 모듈에 그룹화한다(Spring의 Specification 패턴과 동일한 사상).
- 복잡한 조인/N+1 방지: 명시적 조인 쿼리. 지연 로딩 자체가 없으므로 쿼리 수는 조인 설계로 통제한다.
- 대량 벌크/집계/네이티브 SQL: `sql` 태그드 템플릿은 빌더로 표현 불가한 경우에만 예외적으로 허용한다. 항상 파라미터 바인딩을 사용하고 문자열 연결로 SQL을 조립하지 않는다.

## 3. 트랜잭션

- Service의 쓰기 메서드는 트랜잭션 경계로 감싼다. `transaction().execute()`를 사용한다.
- Finder(조회 전용)는 트랜잭션 경계를 명시적으로 열지 않는다.

## 4. 금지 패턴

- Domain 클래스가 Kysely `Database` 스키마 타입 등 영속성 타입을 직접 참조하지 않는다(변환은 Repository 전담).
- 동적 검색 조건을 원시 SQL 문자열로 나열하지 않는다(2번 기준 도구 사용).
- SQL을 문자열 연결로 조립하지 않는다. 항상 파라미터 바인딩을 사용한다(2번).
