---
description: Spring WebFlux(리액티브 스택) 규칙 — Reactor 타입 경계, 트랜잭션, 블로킹 금지 규율, 테스트 (Layered/Hexagonal 공통)
paths:
  - "**/*Controller.java"
  - "**/*Service.java"
  - "**/*Finder.java"
  - "**/*Repository*.java"
  - "**/*UseCase.java"
  - "**/*Adapter.java"
  - "**/*Test.java"
  - "**/domain/**"
---

# Spring WebFlux 규칙 (리액티브 스택)

Spring MVC(서블릿) 대신 WebFlux(리액티브)를 채택한 프로젝트의 웹 계층·트랜잭션·블로킹 규율·테스트 규칙이다. Layered/Hexagonal 아키텍처 스타일과 무관하게 공통 적용되며, CQRS-lite 흐름·Finder/Service 분리·계층 의존 방향(`shared/architecture.md`)과 REST 설계 규약(`shared/rest-api.md`), API spec-first 원칙(`api-dto.md`)은 그대로 전제한다. 영속성 규칙은 `repository-r2dbc.md`가, 리액티브 MongoDB 병용 시의 추가 규칙은 `repository-reactive-mongo.md`가 담당한다.

이 프로젝트가 Spring MVC(서블릿 스택)를 채택했다면 이 파일은 적용 대상이 아니다. MVC와 WebFlux를 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 웹 스택의 규칙 파일은 프로젝트에서 제외한다 (`repository-r2dbc.md`·`repository-reactive-mongo.md`도 함께 제외한다). 마찬가지로 이 프로젝트가 Kotlin을 채택했다면 이 파일은 적용 대상이 아니다 — WebFlux 규칙은 현재 Java 전용으로 제공된다.

## 1. 핵심 원칙

- 웹 스택은 WebFlux + Reactor(`Mono`/`Flux`)로 통일한다. `spring-boot-starter-web`(서블릿)과 `spring-boot-starter-webflux`를 한 프로젝트에서 혼용하지 않는다.
- 영속성은 리액티브 스택(R2DBC, 선택 시 리액티브 MongoDB)으로 통일한다. JPA/JDBC 등 블로킹 영속성과 혼용하지 않는다 (`repository-r2dbc.md`, 병용 시 `repository-reactive-mongo.md` 참조).
- 리액티브는 웹·영속성 계층의 실행 모델일 뿐, 아키텍처 규칙을 바꾸지 않는다: Write/Read 분리, Command/Query 객체, Finder/Service 분리, 계층 의존 방향, 다중 진입점 방어는 MVC와 동일하게 적용한다.

## 2. Controller (웹 계층)

- 애노테이션 기반 Controller(`@RestController`)를 기본으로 한다. 함수형 라우팅(`RouterFunction`)은 생성된 Controller 인터페이스 구현 방식(`api-dto.md`)과 맞지 않으므로 사용하지 않는다.
- 반환 타입은 단건 `Mono<T>`, 복수 건 `Flux<T>`(또는 페이지네이션 응답 객체의 `Mono`)를 사용한다. Controller에서 `block()`으로 값을 꺼내 동기 반환하지 않는다.
- 201 Created의 `Location` 헤더 조립은 MVC와 동일하다: Service(UseCase)가 반환한 ID를 받아 Controller가 조립하되, 리액티브 체인 안에서 `map`으로 `ResponseEntity`를 구성한다.
- 외부 HTTP 호출은 `WebClient`를 사용한다. `RestTemplate`/`RestClient` 등 블로킹 클라이언트를 사용하지 않는다.

## 3. 트랜잭션

- `ReactiveTransactionManager`(R2DBC는 `R2dbcTransactionManager`)를 전제로, 선언적 `@Transactional`이 리액티브 반환 타입(`Mono`/`Flux`)에 그대로 동작한다. 기존 트랜잭션 규칙(`service-layer.md`)을 그대로 따른다: **클래스 단위** 선언, Finder는 `@Transactional(readOnly = true)`, Service는 `@Transactional`.
- `readOnly` 힌트의 실제 동작은 R2DBC 드라이버에 따라 다를 수 있으나, 읽기 전용 의도를 코드로 드러내는 규약으로서 동일하게 유지한다.
- 트랜잭션 경계 안의 모든 연산은 하나의 리액티브 체인으로 연결한다. 체인에서 분리된(구독되지 않거나 별도로 구독되는) Publisher는 트랜잭션에 참여하지 않는다.
- 하나의 메서드 안에서 일부 구간만 트랜잭션으로 묶어야 하는 예외적인 경우에만 `TransactionalOperator`를 보조로 사용한다. 기본은 클래스 단위 `@Transactional`이다.

## 4. 블로킹 금지 규율 (이벤트 루프 보호)

- 리액티브 체인과 Controller/Service/Repository 코드에서 블로킹 호출을 하지 않는다: `block()`/`blockFirst()`/`blockLast()`/`toIterable()`/`toStream()`, JDBC 등 블로킹 드라이버, `RestTemplate`, `Thread.sleep`, 대용량 동기 파일 I/O. 이벤트 루프 스레드가 멈추면 해당 요청뿐 아니라 서버 전체 처리량이 무너진다.
- I/O 스택을 리액티브로 통일한다: DB는 R2DBC(`repository-r2dbc.md`), HTTP 클라이언트는 `WebClient`, 대기는 `Mono.delay`/`Flux.interval`.
- 리액티브 대안이 없는 동기 전용 라이브러리를 써야 하면 `Mono.fromCallable(...).subscribeOn(Schedulers.boundedElastic())`로 감싸 이벤트 루프 밖으로 격리한다. 격리 없이 리액티브 체인 안에서 동기 호출을 섞는 것이 최악의 조합이다.
- 블로킹 호출 유입은 테스트에서 BlockHound로 감시한다 (8번 참조).

## 5. Domain과 리액티브 경계

- **Domain은 동기·순수 객체로 유지한다.** Domain 클래스가 `reactor.core.*` 등 Reactor 타입을 import 하거나 `Mono`/`Flux`를 파라미터·반환 타입으로 사용하지 않는다. 비즈니스 로직 자체는 CPU 연산이므로 리액티브일 이유가 없다.
- 리액티브 타입은 Service(Layered) 또는 Port/Adapter(Hexagonal)부터 바깥 계층에만 존재한다. Service가 Repository/Port에서 `Mono<Order>`를 받아 `map`/`flatMap` 안에서 Domain 메서드를 동기 호출하고, 결과를 다시 리액티브 체인으로 넘긴다.
- **Hexagonal**: `port/in`(UseCase)·`port/out`(Port) 인터페이스 시그니처에 `Mono`/`Flux` 사용을 허용한다. Reactor는 특정 저장소/웹 프레임워크가 아닌 리액티브 스트림 표준 구현이므로, `ports-and-adapters.md`의 "Port 시그니처에 프레임워크 타입 노출 금지"의 예외로 이 조항이 우선한다. 단 R2DBC·Spring Web 타입은 여전히 노출하지 않는다.

## 6. API 스펙 (spec-first 유지)

- `api-dto.md`의 spec-first 원칙(openapi.yaml 우선 작성 → 코드 생성)을 그대로 따른다. `spring` 제너레이터에 `reactive=true`를 설정해 Controller 인터페이스가 `Mono`/`Flux` 시그니처로 생성되도록 한다.
- 제너레이터가 배열 응답을 `Mono<Flux<T>>`처럼 이중 래핑하는 알려진 결함이 있다. 컬렉션을 반환하는 엔드포인트를 스펙에 추가하면 생성된 인터페이스 시그니처를 확인하고, 문제가 있으면 스펙 구조(페이지네이션 응답 객체 사용 등)나 제너레이터 설정으로 우회한다. 생성 코드를 수동 편집하지 않는다.

## 7. 에러 응답 (RFC 9457)

- 에러 응답 규약은 `shared/rest-api.md` 4번의 Problem Details 형식을 그대로 따른다. WebFlux에서도 `@RestControllerAdvice` 전역 핸들러가 동일하게 동작한다.
- 검증 실패는 400(WebFlux의 바인딩 예외는 `WebExchangeBindException`), 비즈니스 규칙 위반(도메인 예외)은 422로 매핑한다 — MVC와 동일한 400/422 구분.
- Service/Domain 계층에서 `ResponseStatusException` 등 웹 계층 예외를 직접 던지지 않는다 (안쪽 계층의 역방향 의존, `shared/architecture.md` 3번).

## 8. 테스트

- Controller/Web 테스트는 MockMvc 대신 **`WebTestClient`**를 사용한다. base class 규칙(`test.md`)은 유지하되, 표의 `Jpa*`/`Jdbc*` 접두사 base class는 `R2dbc*` 접두사로, MockMvc 로드 범위는 WebTestClient로 대체해 읽는다 (예: `JpaWebIntegrationTestBase` → `R2dbcWebIntegrationTestBase`).
- `Mono`/`Flux`를 반환하는 Service/Finder/Repository 로직은 **`StepVerifier`**로 검증한다: 방출 값·순서·종료 시그널(`expectComplete`/`expectError`)을 명시적으로 어서션한다. 테스트에서 `block()`으로 값을 꺼내 어서션하지 않는다 (블로킹 자체를 검증하는 테스트만 예외).
- 시간 의존 스트림(`delay`, `interval`, 타임아웃)은 `StepVerifier.withVirtualTime()`으로 가상 시간을 사용한다. `Thread.sleep` 금지는 MVC와 동일하다.
- 통합 테스트에 **BlockHound**를 적용해 이벤트 루프에서의 블로킹 호출을 감지한다. BlockHound는 테스트/개발 전용이며 프로덕션에서 활성화하지 않는다. Spring Security 활성화 구성에서는 감지가 누락되는 알려진 이슈가 있으므로, 블로킹 감시 테스트는 Security 없이 구성한다.
- Domain 단위 테스트는 리액티브와 무관하다: Domain이 동기·순수이므로(5번) 순수 JUnit으로 테스트한다.

## 9. 금지 패턴

- `spring-boot-starter-web`(서블릿)과 JPA/JDBC 등 블로킹 스택 의존성을 추가하지 않는다.
- Controller/Service/Repository 코드에서 `block()`/`blockFirst()`/`toIterable()`/`toStream()`을 호출하지 않는다 (테스트의 명시적 블로킹 검증만 예외).
- 리액티브 체인 안에서 격리(`boundedElastic`) 없이 동기 블로킹 I/O를 호출하지 않는다.
- Domain 클래스가 Reactor 타입(`Mono`/`Flux`)을 import 하거나 시그니처에 사용하지 않는다.
- 호출만 하고 구독되지 않는(반환 체인에 연결되지 않고 버려지는) `Mono`/`Flux`를 만들지 않는다 — 리액티브에서 실행되지 않는 죽은 코드다.
- Service/Domain 계층에서 `ResponseStatusException` 등 웹 계층 예외를 직접 던지지 않는다.
- 테스트에서 `block()`으로 결과를 꺼내 어서션하지 않는다. `StepVerifier`/`WebTestClient`를 사용한다.
