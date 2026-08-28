---
description: NestJS 영속성 규칙 — TypeORM 1.x (EntitySchema 매핑, nestjs.md 전제)
paths:
  - "**/*.controller.ts"
  - "**/*.service.ts"
  - "**/*.finder.ts"
  - "**/*.module.ts"
  - "**/*.entity.ts"
  - "**/*.schema.ts"
  - "**/*.repository.ts"
---

# NestJS 영속성 규칙 — TypeORM

`nestjs.md`의 모듈/계층 구조·Finder/Service 분리·트랜잭션 원칙과 `shared/architecture.md` 8번의 Escalation Ladder를 전제로, TypeORM을 영속성 도구로 채택한 프로젝트의 Domain 매핑·Repository 도구·트랜잭션 규칙만 다룬다. 기준 버전은 TypeORM 1.x(`@nestjs/typeorm` 12)이며, 0.3.x에 머무는 프로젝트는 1.x 전용으로 표시한 조항을 제외하고 적용한다.

이 프로젝트가 Prisma나 SQL-first(Kysely/Drizzle)를 채택했다면 이 파일은 적용 대상이 아니다. NestJS 영속성 도구(TypeORM/Prisma/SQL-first)는 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 도구의 규칙 파일은 프로젝트에서 제외한다 (`nestjs-persistence-prisma.md`, `nestjs-persistence-sqlfirst.md` 참조).

## 1. 버전과 설정

- `typeorm`은 `^1.1.0`으로 핀한다. 0.3.x에서 올릴 때는 `npx @typeorm/codemod v1 src/`를 먼저 돌리고, 아래 1.x 변경점을 확인한다: 문자열 배열 형태 `relations`/`select` 제거(객체 형태만), find 옵션 `join` 제거, `findByIds`/`@EntityRepository` 제거, non-nullable `ManyToOne`이 INNER JOIN으로 바뀜.
- **1.x**: find 계열의 `where`에 `null`/`undefined`가 들어가면 기본 동작(`invalidWhereValuesBehavior: "throw"`)으로 예외가 난다. 0.3.x처럼 `undefined` 조건이 조용히 사라져 전체 조회가 되는 일은 없지만, 동적 조건은 값이 있을 때만 `where`에 넣도록 조립한다(2번).
- `TypeOrmModule.forRootAsync()`로 `@nestjs/config`에서 접속 정보를 읽고, `autoLoadEntities: true`와 각 모듈의 `TypeOrmModule.forFeature([OrderSchema])`로 EntitySchema를 등록한다. `synchronize: true`는 로컬 개발 외에는 금지하고 마이그레이션을 쓴다.

## 2. Domain 매핑

- Domain 클래스가 엔티티 역할을 겸한다. 데코레이터 대신 `EntitySchema`(TypeORM의 코드-외부 매핑 정의, `new EntitySchema<Order>({ name, target: Order, columns, relations })`)를 사용해 컬럼/관계 매핑을 Domain 클래스 밖의 `{domain}.schema.ts`로 분리한다. 이는 Spring 규칙의 `orm.xml`(`spring/java/layered/domain.md` 9번)과 동일한 철학이다. Repository 주입은 `@InjectRepository(Order)`처럼 `target` 클래스로 한다.
- Value Object는 `EntitySchema`의 `embeddeds: { address: { schema: AddressSchema, prefix: "address_" } }`로 매핑한다. 중첩 embedded도 허용된다.
- TypeORM은 조회 시 생성자를 거치지 않고 인스턴스를 채운다(hydration). 따라서 Domain 생성자/팩토리의 불변 조건 검증은 **생성 시점에만** 실행되고 조회된 객체에는 재실행되지 않는다. 조회 후에도 지켜져야 하는 불변 조건은 DB 제약(NOT NULL, CHECK, UNIQUE)으로도 이중 방어한다.

## 3. Repository 도구 선택 (Escalation Ladder 적용)

- 단순 조회(정적 조건 1-2개): `Repository.find()`/`findOne()`과 `where` 객체(`In`, `Like`, `Between` 등 연산자 포함).
- 동적 검색 조건 조합: `QueryBuilder`. 조건별 빌더 함수를 도메인 전용 모듈에 그룹화한다(Spring의 Specification 패턴과 동일한 사상). 값이 없는 조건은 `andWhere`를 호출하지 않는 방식으로 건너뛴다.
- 복잡한 조인/N+1 방지: find 옵션의 `relations`(객체 형태) 또는 `QueryBuilder.leftJoinAndSelect()`. 필요하면 `relationLoadStrategy: "query"`로 조인 대신 별도 쿼리 로딩을 선택한다.
- 페이지네이션과 fetch join(관계 포함 로딩)을 동시에 쓰지 않는다. 조인이 있는 쿼리에서 페이지네이션은 `take`/`skip`을 쓰고 `limit`/`offset`을 쓰지 않는다 — 공식 문서가 "조인·서브쿼리가 있으면 `limit`/`offset`은 기대와 다르게 동작한다"고 경고한다.
- 대량 벌크/집계/네이티브 SQL: **1.x**는 `` dataSource.sql`SELECT ... WHERE id = ${id}` `` 태그드 템플릿을 쓴다(드라이버별 플레이스홀더를 자동 바인딩). 0.3.x는 `query(sql, params)`의 파라미터 배열을 쓴다. 두 경우 모두 측정된 성능 문제가 있거나 빌더로 표현 불가한 경우에만 예외적으로 허용하고, 문자열 연결로 SQL을 조립하지 않는다.

## 4. 트랜잭션

- Service의 쓰기 메서드는 `@nestjs-cls/transactional`의 `@Transactional()`로 감싼다(`nestjs.md` 6번). 어댑터는 `@nestjs-cls/transactional-adapter-typeorm`이다.
- 이 어댑터는 몽키패치를 하지 않으므로 **`TransactionHost.tx`(EntityManager)를 통해 얻은 Repository만** 트랜잭션에 참여한다. Repository 구현체는 `@InjectRepository()`로 주입받은 Repository를 쓰기 경로에 쓰지 않고, `this.txHost.tx.getRepository(Order)`로 매번 얻는다. `@InjectRepository()` Repository를 쓰기에 쓰면 트랜잭션 밖에서 실행되지만 오류는 나지 않는다.
- 세이브포인트·부분 롤백처럼 데코레이터로 표현할 수 없는 구간에만 `DataSource.transaction()` 또는 `QueryRunner`(1.x는 `await using queryRunner`)를 보조로 쓴다.
- Finder(조회 전용)는 트랜잭션 경계를 명시적으로 열지 않는다.

## 5. 금지 패턴

- Domain 클래스에 TypeORM 컬럼 데코레이터(`@Entity`, `@Column`, `@OneToMany` 등)를 직접 붙이지 않는다(`EntitySchema` 사용).
- **1.x**: `relations`/`select`를 문자열 배열로 쓰지 않고, 제거된 `join` 옵션·`findByIds`·`@EntityRepository`를 쓰지 않는다(1번).
- `where`에 `undefined`가 들어갈 수 있는 동적 조건을 그대로 넘기지 않는다(1번, 3번).
- 조인이 있는 쿼리에서 `limit`/`offset`으로 페이지네이션하지 않는다. `take`/`skip`을 쓴다(3번).
- 동적 검색 조건을 원시 SQL/`QueryBuilder` 문자열로 나열하지 않는다(3번 기준 도구 사용).
- SQL을 문자열 연결로 조립하지 않는다. 항상 파라미터 바인딩(`` sql`...` `` 또는 파라미터 배열)을 사용한다(3번).
- 쓰기 경로에서 `@InjectRepository()`로 주입받은 Repository를 직접 쓰지 않는다. `TransactionHost.tx`를 통해 얻는다(4번).
- `typeorm-transactional`을 사용하지 않는다(`nestjs.md` 6번).
- 로컬 개발 외 환경에서 `synchronize: true`를 켜지 않는다(1번).
