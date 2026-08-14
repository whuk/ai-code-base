---
description: Application Service(Finder/Service) 클래스 분리, UseCase 구현, 트랜잭션 규칙 (Hexagonal, Kotlin)
paths:
  - "**/*Service.kt"
  - "**/*Finder.kt"
  - "**/*UseCase.kt"
---

# Application Service 클래스 분리 및 트랜잭션 규칙

`application/service` 패키지의 클래스 작성 규칙이다. Finder/Service 분리와 클래스 단위 트랜잭션 선언 원칙은 Layered와 동일하되, 각 클래스가 `port/in`의 UseCase 인터페이스를 구현한다는 점이 다르다.

이 프로젝트가 Layered를 채택했다면 이 파일은 적용 대상이 아니다 (`layered/service-layer.md` 참조). 마찬가지로 이 프로젝트가 Java를 채택했다면 이 파일은 적용 대상이 아니다. Java와 Kotlin 규칙 파일을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 언어의 규칙 파일도 프로젝트에서 제외한다 (`java/hexagonal/service-layer.md` 참조).

## 1. 핵심 원칙

- 하나의 Aggregate에 대해 **Finder 클래스**와 **Service 클래스**를 분리하여 작성한다(Layered와 동일한 원칙).
- **Finder**: `{Domain}QueryUseCase`를 구현하며, 조회(Read) 전용 로직을 담당한다.
- **Service**: `{Domain}CommandUseCase`를 구현하며, 생성/수정/삭제 등 상태 변경(Write) 로직을 담당한다.
- Finder/Service는 영속성 접근이 필요할 때 `port/out`의 `{Domain}QueryPort`/`{Domain}CommandPort`만 주입받는다. Adapter 구현체를 직접 알지 못한다(`ports-and-adapters.md` 5번).

## 2. 트랜잭션 선언 규칙

- 트랜잭션 어노테이션은 **클래스 단위**로 선언한다. 메서드마다 개별 선언하지 않는다(Layered와 동일한 원칙).
- **Finder 클래스**: `@Transactional(readOnly = true)`를 클래스에 선언한다.
- **Service 클래스**: `@Transactional`을 클래스에 선언한다.
- 트랜잭션 경계는 Application Service에 있다. Persistence Adapter나 Domain에 트랜잭션 애노테이션을 두지 않는다 — Adapter는 Port 계약을 이행할 뿐 트랜잭션 시작/종료를 책임지지 않는다.
- Kotlin 클래스는 기본이 `final`이므로 Spring 프록시가 동작하도록 `kotlin-spring`(all-open) 컴파일러 플러그인 적용을 전제로 한다. 클래스에 `open`을 수동으로 붙이지 않는다.

## 3. 클래스 구조 예시

### 3.1. Finder (조회 전용)

```kotlin
@Transactional(readOnly = true)
class OrderFinder(
    private val orderQueryPort: OrderQueryPort
) : OrderQueryUseCase {

    override fun getOrder(query: OrderQuery.GetById): OrderReadDto =
        orderQueryPort.findById(query.orderId)
            ?: throw OrderNotFoundException(query.orderId)
}
```

- 클래스명: `{Domain}Finder` (예: `OrderFinder`, `UserFinder`)
- 구현 인터페이스: `{Domain}QueryUseCase`
- 의존: `{Domain}QueryPort`만 주입받는다.

### 3.2. Service (상태 변경)

```kotlin
@Transactional
class OrderService(
    private val orderCommandPort: OrderCommandPort
) : OrderCommandUseCase {

    override fun cancel(command: OrderCommand.Cancel) {
        val order = orderCommandPort.findDomainById(command.orderId)
            ?: throw OrderNotFoundException(command.orderId)
        order.cancel()
        orderCommandPort.save(order)
    }
}
```

- 클래스명: `{Domain}Service` (예: `OrderService`, `UserService`)
- 구현 인터페이스: `{Domain}CommandUseCase`
- 의존: `{Domain}CommandPort`만 주입받는다. 상태 변경을 위해 기존 Domain 객체 조회가 필요하면 `{Domain}CommandPort`에 함께 선언된 `findDomainById` 등의 조회 메서드를 사용한다(`ports-and-adapters.md` 4번). `{Domain}QueryPort`는 Read DTO만 반환하므로 이 목적에 사용하지 않는다.
- Port가 nullable 타입을 반환하므로 부재 처리는 엘비스 연산자(`?: throw`)로 표현한다.

## 4. 금지 패턴

- Finder 클래스에 상태 변경 로직을 포함하지 않는다.
- 메서드 단위로 `@Transactional` 또는 `@Transactional(readOnly = true)`를 개별 선언하지 않는다.
- Service/Finder가 `port/in`의 UseCase 인터페이스 없이 다른 Application Service를 직접 호출하지 않는다(UseCase 간 호출이 필요하면 호출하는 쪽도 해당 UseCase 인터페이스 타입으로 의존한다).
- Service/Finder가 `adapter/out/persistence`의 구현 클래스를 직접 타입으로 주입받지 않는다(`ports-and-adapters.md` 7번).
