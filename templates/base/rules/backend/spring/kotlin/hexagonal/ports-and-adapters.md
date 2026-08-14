---
description: Hexagonal(Ports & Adapters) 패키지 구조, 의존 방향, Port/Adapter 작성 규칙 (Kotlin)
paths:
  - "**/port/**"
  - "**/adapter/**"
  - "**/*UseCase.kt"
  - "**/*Port.kt"
  - "**/*Adapter.kt"
  - "**/*Controller.kt"
---

# Ports & Adapters 구조 규칙

Controller, Application Service, Domain, Persistence 간의 의존 방향과 데이터 전달 규칙을 정의한다. `shared/architecture.md` 1번의 CQRS-lite 흐름과 동일한 사상을 공유하되, Port 인터페이스를 경계로 명시적인 의존성 역전을 강제한다는 점이 다르다.

이 프로젝트가 Layered를 채택했다면 이 파일은 적용 대상이 아니다 (`layered/layer-communication-rules.md` 참조). 마찬가지로 이 프로젝트가 Java를 채택했다면 이 파일은 적용 대상이 아니다. Java와 Kotlin 규칙 파일을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 언어의 규칙 파일도 프로젝트에서 제외한다 (`java/hexagonal/ports-and-adapters.md` 참조).

## 1. 패키지 구조

```
domain/
    {Aggregate}.kt                   Rich Domain 객체 (domain.md)
application/
  port/
    in/
      {Domain}CommandUseCase.kt      인바운드 포트 — Command 흐름 진입점
      {Domain}QueryUseCase.kt        인바운드 포트 — Query 흐름 진입점
    out/
      {Domain}CommandPort.kt         아웃바운드 포트 — 저장/삭제
      {Domain}QueryPort.kt           아웃바운드 포트 — 조회(Projection)
  service/
    {Domain}Service.kt               {Domain}CommandUseCase 구현체
    {Domain}Finder.kt                {Domain}QueryUseCase 구현체
adapter/
  in/
    web/
      {Domain}Controller.kt          생성된 Controller 인터페이스 구현, UseCase 호출
  out/
    persistence/
      {Domain}JpaEntity.kt           JPA 매핑 전용 클래스 (domain.md 2번 참조)
      {Domain}JpaRepository.kt       Spring Data JPA 인터페이스
      {Domain}PersistenceAdapter.kt  {Domain}CommandPort/{Domain}QueryPort 구현체
```

- 하나의 Aggregate가 이 다섯 계층(domain / port-in / port-out / service / adapter)을 모두 가질 필요는 없다. 조회 전용 Aggregate는 QueryUseCase/QueryPort만 가질 수 있다.
- 여러 Aggregate에서 공통으로 쓰는 Port나 어댑터는 없다. Port는 항상 특정 Aggregate(또는 그 하위 개념) 전용으로 정의한다.
- Kotlin에서 `in`은 예약어이므로 `port.in` 패키지 참조 시 백틱(`` package application.port.`in` ``)이 필요하다. 이를 피하려면 팀 컨벤션으로 `port/inbound`·`port/outbound` 같은 대체 패키지명을 정해도 된다 — 프로젝트 시작 시점에 하나로 고정한다.

## 2. 의존 방향

- 계층 순서(바깥 → 안쪽): **Adapter(in/out) → Application(Port + Service) → Domain**.
- 의존의 실제 화살표는 인터페이스(Port)를 향한다: `adapter/in/web`은 `application/port/in`에, `adapter/out/persistence`는 `application/port/out`에 의존한다. `application/service`가 두 Port를 모두 구현/사용하며 Domain을 조작한다.
- Domain은 계층 구조의 최중심(core)이며 Port를 포함해 어떤 바깥 계층에도 의존하지 않는다. Port 인터페이스가 Domain 타입을 파라미터/반환 타입으로 사용하는 것은 허용된다(안쪽에서 바깥쪽으로의 의존이 아니라, Port 자체가 application 계층에 속하기 때문).
- 안쪽 계층이 자신보다 바깥쪽 계층을 참조하는 것은 몇 단계이든 금지한다: Domain → Port/Adapter 금지, Application Service → Adapter 구현체 직접 참조 금지(반드시 Port 인터페이스를 통해서만 호출).

## 3. 인바운드 포트 (port/in) — UseCase

- Web Adapter(Controller)가 호출하는 진입점이다. Command/Query 흐름별로 분리한다(`shared/architecture.md` 1번의 CQRS 원칙과 동일).
- `{Domain}CommandUseCase`: 생성/수정/삭제 메서드를 선언한다. 파라미터는 Command 객체(4번 참조), 반환값은 생성 시 ID, 수정/삭제 시 `Unit`(반환 타입 생략).
- `{Domain}QueryUseCase`: 조회 메서드를 선언한다. 파라미터는 Query 객체, 반환값은 Read 전용 객체(`data class`).
- Controller는 UseCase 인터페이스에만 의존한다. `{Domain}Service`/`{Domain}Finder` 구현체를 직접 타입으로 참조하지 않는다(생성자 주입 시에도 인터페이스 타입으로 선언).

## 4. 아웃바운드 포트 (port/out)

- Application Service/Finder가 영속성에 접근하기 위해 호출하는 인터페이스다. Persistence Adapter가 이를 구현한다.
- `{Domain}CommandPort`: 저장(`save`)/삭제(`delete`) 메서드를 선언한다. 상태 변경을 위해 기존 Aggregate를 먼저 조회해야 하는 경우, Domain 객체를 반환하는 조회 메서드(`findDomainById` 등, `{Domain}QueryPort`의 Read DTO 반환 메서드와 이름이 겹치지 않게 한다)도 함께 선언할 수 있다 — Command 흐름 내부(Application Service)에서만 사용하고 Controller/Finder에는 노출하지 않는다. 반환 타입은 Domain 객체(없을 수 있으면 nullable 타입 `{Domain}?`) 또는 식별자로 제한하고, JPA 관련 타입(`{Domain}JpaEntity`, `Page`, `Specification` 등)을 시그니처에 노출하지 않는다.
- `{Domain}QueryPort`: 조회 메서드를 선언한다. 반환 타입은 Read 전용 객체(`data class`, 없을 수 있으면 nullable)로 제한한다.
- Port 인터페이스는 `application/port/out` 패키지에 위치하며, `jakarta.persistence.*`, `org.springframework.data.jpa.*` 등 영속성 프레임워크 타입을 import 하지 않는다.

## 5. Application Service (Finder/Service)

- `service-layer.md`의 Finder/Service 분리, 트랜잭션 선언 규칙을 그대로 따른다. 다만 클래스가 각각 대응하는 UseCase 인터페이스를 구현한다.
- `{Domain}Service : {Domain}CommandUseCase`: 아웃바운드 `{Domain}CommandPort`를 생성자로 주입받아 사용한다.
- `{Domain}Finder : {Domain}QueryUseCase`: 아웃바운드 `{Domain}QueryPort`를 생성자로 주입받아 사용한다.
- Application Service는 Domain 객체를 조회(Port 호출)하고, Domain 메서드를 호출해 상태를 변경한 뒤, 다시 Port를 통해 저장을 위임한다. Service 자신은 영속성 구현 방식(JPA/JDBC 등)을 알지 못한다.

## 6. Adapter 구현 규칙

### 6.1. Inbound Web Adapter

- `api-dto.md`에서 생성된 Controller 인터페이스를 구현한다 (아키텍처와 무관하게 동일).
- Web DTO → Command/Query 변환 후 대응하는 UseCase를 호출한다. 변환 로직은 Controller 내부, Web DTO의 `toCommand()` 메서드, 전용 Mapper 클래스(MapStruct 등) 중 한 곳에 위치시킨다.

### 6.2. Outbound Persistence Adapter

- `{Domain}PersistenceAdapter`는 `{Domain}CommandPort`와 `{Domain}QueryPort`를 구현한다(필요 시 두 인터페이스를 하나의 Adapter가 함께 구현해도 되고, Command/Query 전용 Adapter로 나눠도 된다 — 팀 컨벤션으로 하나를 고정한다).
- 내부적으로 `{Domain}JpaRepository`(Spring Data JPA)를 사용하며, `{Domain}JpaEntity` ↔ Domain 객체 간 변환을 전담한다. 변환 로직은 Adapter 내부 private 메서드 또는 전용 Mapper 클래스(`{Domain}PersistenceMapper`)에 위치시킨다.
- Repository 도구 선택(Specification/QueryDSL/JdbcClient 에스컬레이션)은 `repository.md`를 따른다. 어떤 티어를 쓰든 Adapter 경계 밖으로 JPA 타입이 나가지 않는다.

## 7. 금지 패턴

- Domain 패키지가 `application`, `adapter` 패키지의 어떤 클래스도 import 하지 않는다.
- Application Service/Finder가 `adapter/out/persistence`의 구현 클래스(`{Domain}PersistenceAdapter`, `{Domain}JpaEntity`, `{Domain}JpaRepository`)를 직접 타입으로 참조하지 않는다. 반드시 `port/out` 인터페이스를 통해서만 접근한다.
- Controller가 `application/service`의 구현 클래스를 직접 참조하지 않는다. 반드시 `port/in` UseCase 인터페이스를 통해서만 접근한다.
- Port 인터페이스(`port/in`, `port/out`) 시그니처에 JPA, Spring Web, Servlet 등 프레임워크 타입을 노출하지 않는다.
- 하나의 Adapter 클래스가 여러 Aggregate의 영속성 로직을 담당하지 않는다(Aggregate 단위로 Adapter를 분리한다).
