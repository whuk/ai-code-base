---
description: NestJS 영속성 규칙 — Prisma 7 (driver adapter, 생성 타입 ↔ Domain 변환은 Repository 전담, nestjs.md 전제)
paths:
  - "**/*.controller.ts"
  - "**/*.service.ts"
  - "**/*.finder.ts"
  - "**/*.module.ts"
  - "**/*.entity.ts"
  - "**/*.repository.ts"
  - "**/prisma.config.ts"
  - "**/schema.prisma"
---

# NestJS 영속성 규칙 — Prisma

`nestjs.md`의 모듈/계층 구조·Finder/Service 분리·트랜잭션 원칙과 `shared/architecture.md` 8번의 Escalation Ladder를 전제로, Prisma를 영속성 도구로 채택한 프로젝트의 Domain 매핑·Repository 도구·트랜잭션 규칙만 다룬다. 기준 버전은 Prisma 7이다.

이 프로젝트가 TypeORM이나 SQL-first(Kysely/Drizzle)를 채택했다면 이 파일은 적용 대상이 아니다. NestJS 영속성 도구(TypeORM/Prisma/SQL-first)는 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 도구의 규칙 파일은 프로젝트에서 제외한다 (`nestjs-persistence-typeorm.md`, `nestjs-persistence-sqlfirst.md` 참조).

## 1. 버전과 설정

- `prisma`와 `@prisma/client`는 **`^7`로 핀한다**. npm의 `latest` 태그는 생성 클라이언트가 없는 전혀 다른 API의 Prisma 8 RC를 가리키므로, `npm i prisma`처럼 태그 없이 설치하지 않는다. 문서도 `/docs/orm/v7/` 경로를 참조한다(경로에 `v7`이 없는 가이드는 8 기준이다).
- `schema.prisma`의 generator는 `prisma-client-js`(deprecated)가 아니라 `prisma-client`를 쓰고, `output`(예: `../src/generated/prisma`)을 반드시 지정한다. NestJS가 CommonJS면 `moduleFormat = "cjs"`를 지정한다 — 없으면 런타임에 `ReferenceError: exports is not defined`가 난다. 생성 디렉토리는 커밋하지 않고 CI에서 `prisma generate`를 명시적으로 실행한다(7부터 자동 generate·자동 seed가 없다).
- 접속 정보는 `schema.prisma`가 아니라 `prisma.config.ts`의 `defineConfig({ datasource: { url }, migrations: { path, seed } })`에 둔다. `.env`는 자동 로드되지 않으므로 `@nestjs/config`가 읽은 값을 쓴다.
- Driver adapter가 필수다. `PrismaService`는 `PrismaClient`를 상속하고 생성자에서 `super({ adapter: new PrismaPg({ connectionString }) })`처럼 어댑터를 주입한다. `onModuleInit`의 `$connect()`는 필요 없고(첫 쿼리에서 지연 연결), 종료 정리는 `OnModuleDestroy`의 `$disconnect()` + `app.enableShutdownHooks()`(`nestjs.md` 8번)로 한다. Prisma 5에서 제거된 `enableShutdownHooks()`를 호출하지 않는다.
- 7에서 제거된 `$use` 미들웨어 대신 `$extends`를 쓴다. `$extends`는 새 객체를 반환하므로 `class PrismaService extends PrismaClient` 안에서 호출해도 주입되는 타입이 바뀌지 않는다 — 확장이 필요하면 factory provider로 확장된 클라이언트를 별도 토큰으로 제공한다.

## 2. Domain 매핑

- Prisma는 Domain 클래스를 직접 엔티티로 매핑할 수 없다(`schema.prisma`에서 타입이 생성되는 구조). Prisma가 생성한 타입과 Domain 객체 간 변환은 Repository 구현체(또는 같은 모듈의 `.mapper.ts`)가 전담한다. Domain 클래스가 `src/generated/prisma`의 타입을 import 하지 않는다.
- Value Object는 Repository의 변환 로직에서 처리한다(스키마에서는 접두사 컬럼 또는 JSON 컬럼으로 저장).

## 3. Repository 도구 선택 (Escalation Ladder 적용)

- 단순 조회(정적 조건 1-2개): `findUnique()`/`findFirst()`/`findMany()`.
- 동적 검색 조건 조합: `Prisma.OrderWhereInput` 타입의 동적 `where` 객체 조합. 조건별 빌더 함수를 도메인 전용 모듈에 그룹화한다(Spring의 Specification 패턴과 동일한 사상). 값이 없는 조건은 키를 넣지 않는다(`undefined`는 조건 없음으로 해석된다).
- 복잡한 조인/N+1 방지: `include`/`select`. Prisma의 `include`는 관계별 배치 쿼리로 실행되므로 그 자체는 N+1이 아니다. N+1은 루프 안에서 `findUnique()`를 반복 호출할 때 생기므로 `in` 조건 한 번으로 바꾼다. 단일 쿼리 JOIN이 필요하면 `relationJoins` preview(`relationLoadStrategy: "join"`)를 측정 근거와 함께 켠다.
- 페이지네이션과 fetch join(관계 포함 로딩)을 동시에 쓰지 않는다(인메모리 페이지네이션 경고). 커서 페이지네이션은 `cursor`/`take`/`skip: 1`을 쓴다.
- 대량 벌크/집계/네이티브 SQL: `createMany()`/`updateMany()`/`aggregate()`/`groupBy()`를 먼저 쓰고, 원시 쿼리는 `$queryRaw`/`$executeRaw` **태그드 템플릿**만 허용한다(자동 파라미터 바인딩, 동적 조각은 `Prisma.sql`/`Prisma.join`). `$queryRawUnsafe`/`$executeRawUnsafe`는 쓰지 않는다. TypedSQL(`previewFeatures = ["typedSql"]`)은 preview이며 generate에 라이브 DB가 필요하므로, 복잡한 읽기 쿼리가 반복될 때만 팀 합의 후 도입한다.

## 4. 트랜잭션

- Service의 쓰기 메서드는 `@nestjs-cls/transactional`의 `@Transactional()`로 감싼다(`nestjs.md` 6번). 어댑터는 `@nestjs-cls/transactional-adapter-prisma`이다.
- Prisma에는 ambient 트랜잭션이 없으므로 Repository는 `this.prisma`를 직접 쓰지 않고 **`TransactionHost.tx`(`Prisma.TransactionClient`)**를 통해 쿼리를 실행한다. 트랜잭션 밖에서 호출되면 `tx`가 일반 클라이언트로 폴백되므로 Finder도 같은 경로를 써도 된다.
- 데코레이터로 표현할 수 없는 구간에만 인터랙티브 `$transaction(async (tx) => {...}, { maxWait, timeout, isolationLevel })`을 보조로 쓴다. 배열 형태 `$transaction([...])`은 서로 독립인 쓰기의 묶음에만 쓴다.
- Finder(조회 전용)는 트랜잭션 경계를 명시적으로 열지 않는다.

## 5. 금지 패턴

- `prisma`/`@prisma/client`를 태그 없이 설치하거나 `^7` 외 범위로 두지 않는다(1번).
- `prisma-client-js` generator, `schema.prisma` 안의 `url`, `package.json#prisma`, `$use` 미들웨어, `PrismaService.enableShutdownHooks()`를 쓰지 않는다(1번).
- Domain 클래스가 Prisma가 생성한 타입(`src/generated/prisma`)을 직접 참조하지 않는다(변환은 Repository 전담).
- 동적 검색 조건을 원시 SQL 문자열로 나열하지 않는다(3번 기준 도구 사용).
- `$queryRawUnsafe`/`$executeRawUnsafe`를 쓰지 않는다. 원시 SQL은 태그드 템플릿과 `Prisma.sql`로만 조립한다(3번).
- 루프 안에서 `findUnique()`를 반복 호출하지 않는다(3번).
- 쓰기 경로에서 `PrismaService`를 직접 쓰지 않는다. `TransactionHost.tx`를 통해 실행한다(4번).
- 측정 근거 없이 `relationJoins`·TypedSQL 같은 preview 기능을 선제적으로 켜지 않는다(3번).
