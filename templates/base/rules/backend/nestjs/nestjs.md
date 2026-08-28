---
description: NestJS 백엔드 고유 컨벤션 (backend/shared/architecture.md 전제)
paths:
  - "**/*.controller.ts"
  - "**/*.service.ts"
  - "**/*.finder.ts"
  - "**/*.module.ts"
  - "**/*.entity.ts"
  - "**/*.repository.ts"
  - "**/*.dto.ts"
  - "**/*.command.ts"
  - "**/*.query.ts"
  - "**/*.mapper.ts"
  - "**/*.filter.ts"
  - "**/*.pipe.ts"
  - "**/*.guard.ts"
  - "**/*.interceptor.ts"
  - "**/*.spec.ts"
  - "**/*.e2e-spec.ts"
  - "**/main.ts"
---

# NestJS 규칙

`shared/architecture.md`의 공통 원칙과 `shared/rest-api.md`의 REST 설계 규약(URI, 상태 코드, 페이지네이션, 에러 형식)을 전제로, NestJS 고유 구현 방법만 다룬다. NestJS는 애초에 Angular/Spring 스타일 구조(데코레이터, DI, 모듈)에서 설계됐기 때문에, Java/Spring 규칙(`spring/`)과 사상을 거의 그대로 공유한다. 기준 버전은 NestJS 12(Node 20.19+/22.12+)이며, NestJS 11 프로젝트에도 12 전용으로 표시한 조항을 제외하면 그대로 적용된다.

이 프로젝트가 Spring Boot나 FastAPI를 채택했다면 이 파일은 적용 대상이 아니다. 백엔드 스택(Spring/NestJS/FastAPI)은 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 스택의 규칙 파일은 프로젝트에서 제외한다 (`spring/`, `fastapi.md` 참조).

## 1. 모듈/계층 구조

- 기능 단위로 `Module`을 나눈다(기술 계층별 폴더가 아니라 feature 폴더). 하나의 `Module`이 관련된 `Controller`, `Service`(Finder/Write), `Repository` 프로바이더를 묶는다. 전역 필터/인터셉터/파이프 같은 횡단 요소는 `SharedModule`에 모으고, `@Global()`은 설정·로깅처럼 정말 전역인 모듈에만 쓴다.
- 계층 순서(`shared/architecture.md` 3번): `Controller` → `Service` → `Repository` → `Domain`. `Controller`가 `Repository`나 `Domain`을 직접 참조하지 않는다.
- `Domain`(순수 비즈니스 로직 클래스)은 프레임워크 데코레이터를 붙이지 않는다. NestJS 공식 문서는 Domain 객체의 `@Injectable()` 사용에 대한 입장이 없지만, 이 프로젝트는 Domain을 DI 컨테이너 밖의 순수 클래스로 유지한다. 영속성 매핑은 채택한 영속성 파일(`nestjs-persistence-*.md`)의 방식(코드-외부 매핑 또는 Repository 변환)을 따르므로 Domain에 ORM 데코레이터도 붙지 않는다.
- 파일 접미사는 NestJS CLI 관례를 따른다: `.module.ts`, `.controller.ts`, `.service.ts`, `.finder.ts`, `.repository.ts`, `.dto.ts`, `.command.ts`, `.query.ts`, `.mapper.ts`, `.filter.ts`, `.pipe.ts`, `.guard.ts`, `.interceptor.ts`, `.spec.ts`, `.e2e-spec.ts`. `.entity.ts`는 커뮤니티에서 "ORM 엔티티"와 "도메인 엔티티" 양쪽으로 쓰여 모호하므로, 이 프로젝트에서는 **Domain 클래스**를 뜻한다(4번의 매핑 정의 파일은 `.schema.ts` 등 별도 접미사를 쓴다).

## 2. Finder/Service 분리

- 조회 전용 `{Domain}Finder`(`@Injectable()`)와 상태 변경 전용 `{Domain}Service`(`@Injectable()`)를 별도 프로바이더로 분리한다.
- Service가 조회가 필요하면 같은 모듈의 Finder를 생성자 주입받아 사용할 수 있다.
- "Finder"는 Spring 유래 명칭으로, NestJS 커뮤니티 용어로는 CQRS의 Query-side(`@nestjs/cqrs`의 `QueryHandler`)에 해당한다. `@nestjs/cqrs`의 `CommandBus`/`QueryBus`는 도입하지 않는 것을 기본으로 하되, 핸들러가 비대해지거나 HTTP·메시지·CLI가 같은 로직을 공유하는 모듈에 한해 도입할 수 있다. 도입하면 공식 명명(`XxxCommand` → `XxxHandler`, `XxxQuery` → `XxxHandler`)을 따르고, Finder/Service가 각각 QueryHandler/CommandHandler로 대응된다.

## 3. Command/Query와 검증

- Controller의 입력 DTO와 Service의 Command/Query는 별도 클래스로 분리한다(Web DTO를 Service로 그대로 넘기지 않는다, `shared/architecture.md` 1-2번). Web DTO → Command 변환은 Controller 내부, DTO의 `toCommand()`, 전용 Mapper(`.mapper.ts`) 중 한 곳에 둔다.
- 검증 도구는 프로젝트 시작 시점에 하나로 고정한다. 검증 데코레이터/스키마 작성과 다중 진입점 방어의 구체 트리거 방식은 채택한 검증 파일(`nestjs-validation-*.md`)을 따른다.
- 전역 검증 파이프는 `main.ts`의 `app.useGlobalPipes()`가 아니라 **`APP_PIPE` 프로바이더**로 등록한다. `useGlobalPipes()`는 DI가 안 되고, 게이트웨이·하이브리드(마이크로서비스) 앱의 핸들러에는 적용되지 않는다. `APP_FILTER`/`APP_GUARD`/`APP_INTERCEPTOR`도 같은 이유로 프로바이더 등록을 기본으로 한다.
- **다중 진입점 방어**(`shared/architecture.md` 5번): Command/Query 클래스에도 Controller DTO와 동일한 검증 규칙을 적용해, HTTP 경로를 거치지 않는 호출(메시지 컨슈머, 배치, 다른 서비스의 직접 호출)도 방어한다. Web 계층 검증만으로는 이런 진입점이 방어되지 않는다. `@MessagePattern`/`@EventPattern` 핸들러는 검증 실패 시 `HttpException`이 아니라 `RpcException`을 던지도록 `exceptionFactory`를 지정한 파이프를 쓴다.
- 연관 파라미터 4개 이상은 Value Object(별도 클래스 또는 중첩 DTO)로 그룹화한다(`shared/architecture.md` 4번).

## 4. 영속성 (도구별 Domain 매핑)

- ORM 또는 SQL-first(ORM 미사용) 중 하나를 프로젝트 시작 시점에 고정한다. 도구별 Domain 매핑·Repository 도구·트랜잭션 상세는 채택한 영속성 파일(`nestjs-persistence-*.md`)을 따른다.
- 도구와 무관하게 Domain 클래스는 영속성 타입을 직접 참조하지 않는다. Domain ↔ 저장소 모델 간 변환 책임은 Repository 구현체(또는 코드-외부 매핑 정의)가 전담한다.
- Repository는 추상 클래스를 DI 토큰으로 두고 구현체를 바인딩한다: `{ provide: OrderRepository, useClass: TypeOrmOrderRepository }`. 추상 클래스는 계약과 런타임 토큰을 겸하므로 `@Inject()`가 필요 없다. 인터페이스를 써야 하는 경우에만 `Symbol` 토큰을 쓰고, 문자열 토큰은 쓰지 않는다.
- 연관 파라미터 4개 이상을 묶은 Value Object의 매핑도 위 원칙을 따른다(구체 방식은 영속성 파일 참조).

## 5. Repository 도구 선택 (Escalation Ladder 적용)

- `shared/architecture.md` 8번의 에스컬레이션 순서(단순 조회 → 동적 조건 조합 → 복잡한 조인/N+1 방지 → 대량 벌크/집계/네이티브 SQL)를 따른다. 항상 최하위 충분한 단계에서 시작하고, 측정된 근거 없이 선제적으로 상위 도구를 쓰지 않는다.
- 동적 검색 조건 조합 로직은 라우터/서비스가 아닌 도메인 전용 Repository 모듈에 그룹화한다(Spring의 Specification 패턴과 동일한 사상).
- 페이지네이션과 fetch join(관계 포함 로딩)을 동시에 쓰지 않는다(인메모리 페이지네이션 경고).
- 각 단계의 구체적 도구/API와 원시 쿼리 허용 범위는 채택한 영속성 파일(`nestjs-persistence-*.md`)을 따른다.

## 6. 트랜잭션

- Service의 쓰기 메서드는 트랜잭션 경계로 감싼다. Finder(조회 전용)는 트랜잭션 경계를 명시적으로 열지 않는다.
- 선언적 트랜잭션은 **`nestjs-cls` + `@nestjs-cls/transactional`**의 `@Transactional()` 데코레이터로 통일한다. 채택한 영속성 도구의 어댑터(`@nestjs-cls/transactional-adapter-{typeorm|prisma|kysely|drizzle}`)를 등록하고, Repository는 `TransactionHost.tx`를 통해 트랜잭션에 참여하는 클라이언트를 얻는다. 전파 옵션(`Propagation.Required` 기본, `RequiresNew` 등)은 Spring과 같은 의미다.
- `DataSource.transaction()`·`$transaction()`·`transaction().execute()` 같은 도구별 명시적 API는 `@Transactional()`로 표현할 수 없는 예외 구간(부분 롤백, 세이브포인트)에만 보조로 쓴다. 도구별 제약(예: TypeORM 어댑터는 `TransactionHost.tx`의 EntityManager 경로로만 전파된다)은 채택한 영속성 파일(`nestjs-persistence-*.md`)을 따른다.
- `typeorm-transactional`(2023년 이후 릴리스 없음, DataSource 몽키패치)은 사용하지 않는다.

## 7. API 스펙

- 가능하면 `openapi.yaml`을 먼저 정의하고 코드/DTO를 생성하는 spec-first를 유지한다(`shared/architecture.md`의 단일 소스 원칙과 `spring/api-dto.md`의 사상을 그대로 따른다). 스펙 작성 규약(스키마 명명, `$ref`, `operationId`, 제약조건 명시)은 `shared/rest-api.md` 8번을 따른다.
- NestJS 공식은 code-first(`@nestjs/swagger`)만 지원하고 spec-first 코드 생성 경로를 제공하지 않는다. 이 codegen 경로(예: openapi-generator의 TypeScript/NestJS 대상 템플릿)가 팀 환경에서 검증되지 않았다면, `@nestjs/swagger` 데코레이터 기반 code-first로 시작하는 것을 예외적으로 허용한다. 이 경우 CI에서 생성된 OpenAPI 문서(`/{path}-yaml`)를 아티팩트로 남겨 프론트엔드와의 계약이 암묵적으로 깨지지 않는지 추적한다.
- code-first를 택하면 `nest-cli.json`의 `@nestjs/swagger` CLI plugin(`introspectComments: true`)으로 `@ApiProperty()` 수동 나열을 줄이고, 파생 DTO는 `@nestjs/swagger`의 `PartialType`/`PickType`/`OmitType`으로 만든다(`@nestjs/mapped-types`가 아니라 swagger 쪽을 써야 스키마가 함께 생성된다).
- Controller는 Domain 객체나 ORM 엔티티를 직접 반환하지 않는다. 응답 전용 Response DTO(`.dto.ts`)로 매핑해 반환한다. `ClassSerializerInterceptor` + `@Exclude()`로 엔티티를 그대로 직렬화하는 방식은 쓰지 않는다 — 엔티티가 곧 와이어 포맷이 되어 계층 경계가 무너진다.

## 8. 애플리케이션 부트스트랩

- `main.ts`에서 `app.enableShutdownHooks()`를 호출한다. 호출하지 않으면 SIGTERM 시 `onModuleDestroy`/`onApplicationShutdown`이 실행되지 않아 DB 커넥션 등이 정리되지 않는다.
- API 버전은 `app.enableVersioning({ type: VersioningType.URI })`로 URI path 방식을 쓴다(`shared/rest-api.md` 6번).
- 설정은 `@nestjs/config`를 쓰고, 환경 변수는 부팅 시점에 스키마로 검증해 누락·형식 오류를 즉시 실패시킨다(NestJS 12는 `validationSchema`에 Standard Schema — Zod 등 — 를 받는다. 11 이하는 `validate` 함수로 같은 효과를 낸다).
- `helmet`과 `@nestjs/throttler`를 기본 적용한다(다중 인스턴스면 Throttler 스토리지를 Redis로).
- 로깅은 구조화 JSON으로 통일한다: `nestjs-pino`(요청 ID를 `x-request-id`에서 재사용)를 기본으로 하고, 요청 컨텍스트 전파는 6번과 같은 `nestjs-cls`를 재사용한다.

## 9. 이벤트 루프 보호

- 요청 처리 경로에서 동기 블로킹 호출을 하지 않는다: `fs.*Sync`, `child_process.execSync`, 동기 압축/암호화(`zlib.*Sync`, `crypto.pbkdf2Sync`), 대량 JSON 직렬화, 긴 동기 루프. 하나의 요청이 이벤트 루프를 잡으면 서버 전체 처리량이 무너진다.
- CPU 바운드 작업은 `worker_threads` 또는 별도 워커(큐 컨슈머)로 격리한다.
- 호출만 하고 `await`하지 않는 Promise를 만들지 않는다(unhandled rejection과 트랜잭션 이탈의 원인). 의도적 fire-and-forget은 큐로 넘긴다.

## 10. 테스트

- 테스트 러너는 프로젝트 모듈 형식에 따른다: NestJS 12부터 `nest new`가 **ESM 프로젝트는 Vitest, CommonJS 프로젝트는 Jest**를 기본 생성한다. 기존 CJS 프로젝트는 Jest를 유지해도 되고, Vitest로 옮기면 데코레이터 메타데이터를 위해 `unplugin-swc`를 함께 쓴다(esbuild는 `emitDecoratorMetadata`를 지원하지 않는다). 한 프로젝트에서 두 러너를 혼용하지 않는다.
- 단위 테스트: `@nestjs/testing`의 `Test.createTestingModule()`로 필요한 프로바이더만 로드한다(전체 애플리케이션 컨텍스트를 올리지 않는다). Service/Finder 단위 테스트에서 Repository 등 하위 의존성은 custom provider(`{ provide: OrderRepository, useValue: mock }`)로 대체하거나 `.useMocker(createMock)`(`@golevelup/ts-jest`/`ts-vitest`)로 자동 mock한다. 실제 DB 접근 없이 오케스트레이션 로직만 검증하고, 실제 영속성 동작(매핑, 쿼리 조합)은 통합 테스트에서 검증한다.
- Domain 단위 테스트는 프레임워크 없이 순수 클래스로 테스트한다(`Test.createTestingModule()` 불필요).
- 통합/E2E 테스트: `moduleRef.createNestApplication()` → `app.init()` 후 Supertest(`request(app.getHttpServer())`)로 HTTP 요청을 검증하고, `afterAll`에서 `app.close()`한다. 전역 파이프/필터가 `APP_*` 프로바이더로 등록돼 있으면(3번) E2E에서도 자동 적용된다. Fastify 어댑터면 `app.inject()`를 쓴다.
- 통합 테스트의 DB는 인메모리 대체품이 아니라 **Testcontainers**(`@testcontainers/postgresql` 등)로 실제 엔진을 띄운다. 벤더별 SQL·제약 조건 동작이 인메모리 DB와 다르다.
- `Thread.sleep` 상당의 시간 기반 동기화(임의 `setTimeout` 대기)를 사용하지 않는다. 결정적 데이터는 Fixture/Factory로 생성한다.
- Factory는 Fishery(`Factory.define`)로 도메인/DTO별로 정의하고, 고유값이 필요한 필드는 `sequence`로 만든다. 랜덤 값이 필요한 필드는 `@faker-js/faker`를 병용하되 테스트 셋업에서 `faker.seed(...)`를 고정해 실패를 재현할 수 있게 한다.
- 어서션 대상 필드와 비즈니스 규칙에 관여하는 필드는 랜덤에 맡기지 않고 `factory.build({...})` 오버라이드로 명시적으로 고정한다. 어서션이 랜덤 값에 의존하면 안 된다.
- 경계값(최소/최대, 경계 ±1, 빈 값, 임계점)은 랜덤으로 뽑지 않고 명시적으로 고정한다. 같은 로직을 여러 입력으로 검증할 때는 `it.each`/`test.each`로 케이스를 나열하고, 검증 규칙(길이, 범위, 패턴)이 있는 입력은 유효 경계와 무효 경계 양쪽 케이스를 모두 포함한다.

## 11. 에러 응답 (RFC 9457)

- 에러 응답은 `shared/rest-api.md` 4번의 Problem Details 형식을 따른다. 전역 Exception Filter(`APP_FILTER`로 등록)에서 매핑하고, Controller에서 에러 응답 객체를 직접 조립하지 않는다. 필터는 `HttpAdapterHost`를 통해 응답을 써서 Express/Fastify에 종속되지 않게 한다.
- 검증 실패(`ValidationPipe`의 `BadRequestException`, `StandardSchemaValidationPipe`/`nestjs-zod`의 검증 예외)는 400 + Problem Details로 변환하고, 필드별 오류를 `errors` 배열로 포함한다. 검증 도구마다 예외의 원본 형태가 다르므로(채택한 `nestjs-validation-*.md` 참조) 필터에서 `errors` 배열 형태로 정규화한다. Service 진입점 검증(3번 다중 진입점 방어)에서 발생한 검증 예외도 같은 필터에서 400으로 매핑한다.
- 도메인 예외(비즈니스 규칙 위반)는 공통 도메인 예외 클래스를 기준으로 같은 필터에서 매핑한다: 존재하지 않는 리소스 404, 고유성·버전 충돌 409, 그 외 비즈니스 규칙 위반 422. 도메인 예외 클래스는 안정적인 문자열 `code`를 가지며 Problem Details의 `type`으로 노출된다. Domain/Service 계층에서 `HttpException` 계열(NestJS 웹 계층 타입)을 직접 던지지 않는다 — 안쪽 계층이 바깥 계층 타입을 참조하는 역방향 의존이다(`shared/architecture.md` 3번).
- 마이크로서비스 핸들러의 필터는 `BaseRpcExceptionFilter`를 상속하고 `RpcException`으로 매핑한다(3번).

## 12. 컴파일·도구 설정

- `tsconfig`는 `strict: true`를 기본으로 하되, 데코레이터 기반 DI를 위해 `experimentalDecorators`와 `emitDecoratorMetadata`를 켠다(NestJS는 TC39 표준 데코레이터가 아니라 레거시 TS 데코레이터를 쓴다). class-transformer로 채워지는 DTO 때문에 `strictPropertyInitialization: false`를 허용한다.
- 빌드 속도가 문제면 `nest-cli.json`의 `compilerOptions.builder: "swc"`를 쓴다. SWC 설정에 `legacyDecorator: true`, `decoratorMetadata: true`가 필요하다.
- 린트는 ESLint flat config + `@darraghor/eslint-plugin-nestjs-typed`를 기본으로 한다. NestJS 12 ESM 템플릿의 oxlint를 쓰는 경우 NestJS 전용 규칙이 없다는 점을 알고 선택한다. Biome을 쓰면 포매팅만 맡기고 NestJS 전용 린트 규칙은 별도로 확보한다.
- 의존성은 메이저 버전을 핀한다. 특히 `prisma`는 npm `latest` 태그가 API가 전혀 다른 8 RC를 가리키므로 `nestjs-persistence-prisma.md`의 버전 지침을 따른다.

## 13. 금지 패턴

- Controller DTO를 Service 메서드 파라미터로 그대로 사용하지 않는다.
- Controller에서 Domain 객체나 ORM 엔티티를 직접 반환하지 않는다. Response DTO로 매핑한다(7번).
- Domain 클래스에 프레임워크·ORM 데코레이터를 붙이지 않고, 영속성 타입(ORM 매핑 타입, 쿼리 빌더 스키마 타입 등)을 직접 참조하지 않는다(1번, 4번. 변환은 Repository 전담. 도구별 상세는 `nestjs-persistence-*.md`).
- Repository를 문자열 토큰으로 주입하지 않는다. 추상 클래스(또는 `Symbol`) 토큰을 쓴다(4번).
- Finder 프로바이더에 상태 변경 메서드를 포함하지 않는다.
- 전역 파이프/필터/가드/인터셉터를 `app.useGlobal*()`로 등록하지 않는다. `APP_*` 프로바이더로 등록한다(3번).
- `typeorm-transactional`이나 도구별 트랜잭션 API를 트랜잭션의 기본 수단으로 쓰지 않는다. `@nestjs-cls/transactional`의 `@Transactional()`을 쓴다(6번).
- 동적 검색 조건을 도메인 전용 Repository 모듈 밖(라우터/서비스)에 나열하지 않는다(5번 기준 도구 사용).
- SQL을 문자열 연결로 조립하지 않는다. 항상 파라미터 바인딩을 사용한다(5번).
- 요청 처리 경로에서 동기 블로킹 API(`*Sync`)를 호출하거나 `await` 없이 Promise를 버리지 않는다(9번).
- 한 프로젝트에서 Jest와 Vitest를 혼용하지 않는다(10번).
- Domain/Service 계층에서 `HttpException` 계열을 직접 던지지 않는다(11번).
- `main.ts`에서 `enableShutdownHooks()`를 생략하지 않는다(8번).
