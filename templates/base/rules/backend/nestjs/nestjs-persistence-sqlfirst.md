---
description: NestJS 영속성 규칙 — SQL-first(Kysely 기본, Drizzle 대안) (ORM 미사용, Repository가 매핑 전담, nestjs.md 전제)
paths:
  - "**/*.controller.ts"
  - "**/*.service.ts"
  - "**/*.finder.ts"
  - "**/*.module.ts"
  - "**/*.entity.ts"
  - "**/*.repository.ts"
  - "**/db/**/*.ts"
---

# NestJS 영속성 규칙 — SQL-first (Kysely)

`nestjs.md`의 모듈/계층 구조·Finder/Service 분리·트랜잭션 원칙과 `shared/architecture.md` 8번의 Escalation Ladder를 전제로, ORM 없이 타입 안전 쿼리 빌더를 영속성 도구로 채택한 프로젝트의 Domain 매핑·Repository 도구·트랜잭션 규칙만 다룬다. 기본 도구는 Kysely 0.29이며, Drizzle을 택한 프로젝트는 6번의 대응표로 읽는다.

이 프로젝트가 TypeORM이나 Prisma를 채택했다면 이 파일은 적용 대상이 아니다. NestJS 영속성 도구(TypeORM/Prisma/SQL-first)는 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 도구의 규칙 파일은 프로젝트에서 제외한다 (`nestjs-persistence-typeorm.md`, `nestjs-persistence-prisma.md` 참조).

## 1. 버전과 설정

- `kysely`는 `^0.29`로 핀한다(1.0 미출시, 마이너마다 breaking이 있다). 0.29 변경점: 마이그레이션 API는 `kysely/migration` 서브패스에서 import(루트 import는 컴파일 오류), `sql.value`/`sql.literal`은 `sql.val`/`sql.lit`로 이름 변경. TS 5.4+, `strict: true`가 요구된다.
- NestJS 연동은 유지되는 커뮤니티 모듈인 `nestjs-kysely`(`KyselyModule.forRootAsync()`, `@InjectKysely()`)를 쓰거나, factory provider로 `Kysely` 인스턴스를 만들고 `OnModuleDestroy`에서 `db.destroy()`하는 수동 패턴을 쓴다. `@anchan828/nest-kysely`는 2026년 5월 아카이브됐으므로 쓰지 않는다.
- `CamelCasePlugin`을 기본 적용해 snake_case 컬럼을 camelCase 프로퍼티로 다룬다. `$if`로 조인을 추가하는 쿼리가 있으면 `DeduplicateJoinsPlugin`을 함께 켠다.

## 2. Domain 매핑

- Repository 구현체가 SQL 실행과 Row ↔ Domain 객체 변환을 전담하고, Domain 클래스는 어떤 영속성 타입도 참조하지 않는다.
- DB 스키마 타입(Kysely `Database` 인터페이스)은 손으로 쓰지 않고 `kysely-codegen`(DB 내성) 또는 `prisma-kysely`(schema.prisma 기반)로 생성해 `db/` 등 별도 모듈에 둔다. 생성 파일은 마이그레이션과 함께 갱신한다.
- Value Object는 Repository의 변환 로직에서 처리한다.

## 3. Repository 도구 선택 (Escalation Ladder 적용)

- 단순 조회(정적 조건 1-2개): Kysely 기본 표현식(`selectFrom().where().executeTakeFirst()`).
- 동적 검색 조건 조합: `where((eb) => eb.and([...]))`로 조건 배열을 조립하거나, 빌더가 불변이므로 `query = query.where(...)`로 재할당한다. 조건별 빌더 함수를 도메인 전용 모듈에 그룹화한다(Spring의 Specification 패턴과 동일한 사상). `$if`는 조건에 따라 select/join이 바뀌어 **결과 타입이 달라질 때만** 쓴다(그 안의 선택 컬럼은 optional이 된다). `eb.and([])`는 `true`, `eb.or([])`는 `false`로 평가되므로 빈 조건 배열을 그대로 넘기면 전체 조회가 된다는 점을 확인한다.
- 복잡한 조인/N+1 방지: 명시적 조인 쿼리, 또는 `kysely/helpers/{postgres|mysql|sqlite}`의 `jsonArrayFrom`/`jsonObjectFrom`으로 자식 컬렉션을 한 쿼리에 JSON으로 실어 온다. 지연 로딩 자체가 없으므로 쿼리 수는 조인 설계로 통제한다.
- 대량 벌크/집계/네이티브 SQL: `sql` 태그드 템플릿은 빌더로 표현 불가한 경우에만 예외적으로 허용한다. `${value}` 치환은 항상 파라미터로 바인딩되지만, `sql.raw()`·`sql.lit()`·`sql.id()`·`sql.table()`은 문자열을 그대로 삽입하므로 사용자 입력을 넣지 않는다. 식별자 참조는 타입 검사되는 `sql.ref()`를 쓴다.

## 4. 트랜잭션

- Service의 쓰기 메서드는 `@nestjs-cls/transactional`의 `@Transactional()`로 감싼다(`nestjs.md` 6번). 어댑터는 `@nestjs-cls/transactional-adapter-kysely`이다. Repository는 `TransactionHost.tx`(트랜잭션 안에서는 `Transaction`, 밖에서는 `Kysely`)를 통해 쿼리를 실행한다.
- 데코레이터로 표현할 수 없는 구간에만 `db.transaction().setIsolationLevel(...).execute(async (trx) => {...})`(throw 시 자동 롤백)나 세이브포인트가 필요한 경우 controlled transaction(`db.startTransaction().execute()` → `savepoint`/`rollbackToSavepoint`/`commit`)을 보조로 쓴다.
- Finder(조회 전용)는 트랜잭션 경계를 명시적으로 열지 않는다.

## 5. 마이그레이션

- 마이그레이션은 `kysely-ctl`(ESM 전용)로 관리하고, 파일은 `kysely/migration`의 `Migrator`가 읽는 형태로 작성한다. 스키마 변경 후 2번의 타입 생성을 다시 실행한다.

## 6. Drizzle을 채택한 경우

- Drizzle ORM은 다운로드 기준 가장 널리 쓰이는 TypeScript 쿼리 빌더이지만 NestJS 공식 모듈이 없고 1.0이 RC 단계다. 채택하면 `drizzle-orm`을 마이너 버전까지 핀하고 factory provider로 `drizzle(pool)` 인스턴스를 제공한다.
- 이 파일의 규칙은 다음 대응으로 읽는다: `Database` 인터페이스 → `schema.ts`의 테이블 정의(`pgTable` 등, 코드가 스키마의 단일 소스), 타입 생성 도구 → 불필요(스키마에서 타입 추론), `eb.and([])` → `and(...conditions)`(빈 조건은 `undefined`로 무시됨), `jsonArrayFrom` → relational query(`db.query.orders.findMany({ with })`), `sql` 태그드 템플릿 → `sql` 태그드 템플릿(동일, `sql.raw()` 금지 동일), 트랜잭션 어댑터 → `@nestjs-cls/transactional-adapter-drizzle-orm`, 마이그레이션 → `drizzle-kit`.
- Domain 클래스가 `schema.ts`의 추론 타입(`typeof orders.$inferSelect`)을 참조하지 않는 원칙은 동일하다.

## 7. 금지 패턴

- Domain 클래스가 Kysely `Database` 스키마 타입(또는 Drizzle 추론 타입) 등 영속성 타입을 직접 참조하지 않는다(변환은 Repository 전담).
- `Database` 인터페이스를 손으로 작성·수정하지 않는다. 생성 도구로 만든다(2번).
- 동적 검색 조건을 원시 SQL 문자열로 나열하지 않는다(3번 기준 도구 사용).
- SQL을 문자열 연결로 조립하지 않는다. `sql.raw()`·`sql.lit()`·`sql.id()`에 사용자 입력을 넣지 않는다(3번).
- 결과 타입이 바뀌지 않는 단순 조건 분기에 `$if`를 쓰지 않는다(3번).
- 쓰기 경로에서 주입받은 `Kysely` 인스턴스를 직접 쓰지 않는다. `TransactionHost.tx`를 통해 실행한다(4번).
- 아카이브된 `@anchan828/nest-kysely`나 `kysely` 루트에서 마이그레이션 API를 import 하지 않는다(1번).
