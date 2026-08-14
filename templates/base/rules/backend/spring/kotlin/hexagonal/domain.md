---
description: 도메인 클래스 작성 시 적용되는 DDD Rich Domain Model 규칙 (Hexagonal — 영속성 완전 분리, Kotlin)
paths:
  - "**/domain/**"
---

# DDD Rich Domain 클래스 작성 규칙 (Hexagonal)

도메인 패키지 내 클래스를 작성하거나 수정할 때 다음 원칙을 따른다. Rich Domain 원칙(1, 3~8번)은 Layered와 동일하지만, 2번(인프라 비종속)과 영속성 매핑 처리 방식이 근본적으로 다르다.

이 프로젝트가 Layered를 채택했다면 이 파일은 적용 대상이 아니다. Layered와 Hexagonal을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 아키텍처 스타일의 규칙 파일은 프로젝트에서 제외한다 (`layered/domain.md` 참조). 마찬가지로 이 프로젝트가 Java를 채택했다면 이 파일은 적용 대상이 아니다. Java와 Kotlin 규칙 파일을 한 프로젝트에서 동시에 쓰지 않으므로, 실제로 채택하지 않은 언어의 규칙 파일도 프로젝트에서 제외한다 (`java/hexagonal/domain.md` 참조).

## 1. Rich Domain Model

- 비즈니스 로직을 도메인 객체 내부에 배치한다. Anemic Domain Model(getter/setter만 있는 빈약한 모델)을 금지한다.
- 도메인 객체가 스스로 자신의 상태를 관리하고, 비즈니스 규칙을 실행한다.

## 2. 완전한 인프라 비종속 (Zero Framework Dependency)

- Domain 클래스는 JPA, Spring 등 어떤 프레임워크 애노테이션도 갖지 않는다. `@Entity`, `@Column`, `@Id` 등 마커 애노테이션조차 허용하지 않는다.
- Domain은 순수 Kotlin 객체(POKO)로 작성한다. import 구문에 `jakarta.persistence.*`, `org.springframework.*` 패키지가 등장해서는 안 된다.
- 영속성 매핑 대상은 Domain과 별도로 존재하는 `{Domain}JpaEntity`이며, 이는 `adapter/out/persistence` 패키지에 위치한다 (`ports-and-adapters.md`, `repository.md` 참조). Domain 클래스는 자신이 영속화되는지, 어떤 저장소를 쓰는지 알지 못한다.
- Domain ↔ JpaEntity 간 변환 책임은 Persistence Adapter가 전담한다. Domain 클래스에 `toEntity()`/`fromEntity()` 같은 변환 메서드를 두지 않는다 (Domain이 영속성 타입을 참조하게 되므로 의존 방향 위반).

## 3. Entity vs Value Object 구분

- **Entity**: 고유 식별자(ID)를 가지며, 생명주기 동안 상태가 변할 수 있는 객체. 동일성은 ID로 판단한다.
- **Value Object**: 식별자 없이 속성 값의 조합으로 동일성을 판단하는 불변 객체. `data class`로 선언하면 속성 기반 `equals`/`hashCode`가 자동 제공된다.
- 가능한 한 Value Object를 우선 사용하고, 식별자가 반드시 필요한 경우에만 Entity로 설계한다.

## 4. 불변성 우선

- 상태는 생성자 또는 `companion object` 팩토리 함수를 통해 초기화한다.
- 상태 변경이 필요한 경우, 의미 있는 이름의 명시적 메서드를 통해서만 수행한다 (예: `approve()`, `cancel()`, `changePrice(newPrice)`).
- 프로퍼티는 가능한 한 `val`로 선언하고, 변경이 필요한 프로퍼티는 `private set`으로 외부 노출을 차단한다. setter를 노출하지 않는다.

## 5. 자기 검증 (Self-validating)

- 객체 생성 시점에 불변 조건(invariant)을 검증한다 (`init` 블록 또는 팩토리 함수). 유효하지 않은 상태의 객체는 존재할 수 없어야 한다.
- 상태 변경 메서드에서도 사전 조건(precondition)과 사후 조건(postcondition)을 검증한다.
- 검증 실패 시 명확한 도메인 예외를 던진다.
- Layered와 달리 "JPA 하이드레이션 경로 예외"가 존재하지 않는다. Domain은 항상 Persistence Adapter가 만들어주는 정적 팩토리/생성자를 통해서만 재구성되며, 이 경로도 동일한 불변 조건 검증을 통과해야 한다 (프레임워크가 필드에 직접 값을 주입하는 경로 자체가 없기 때문). 같은 이유로 Domain 클래스에는 `kotlin-jpa`(no-arg) 플러그인 적용도 필요 없다.

## 6. Aggregate Root

- 관련된 Entity와 Value Object의 클러스터에서 Aggregate Root를 식별한다.
- 외부에서는 Aggregate Root를 통해서만 내부 객체에 접근한다.
- Aggregate 경계를 넘는 참조는 ID로만 수행한다 (객체 직접 참조 금지).

## 7. 도메인 이벤트

- 중요한 상태 변화가 발생할 때 도메인 이벤트를 정의한다 (필요한 경우에만).
- 이벤트는 불변 Value Object(`data class`)로 작성하며, 발생 시점의 정보를 포함한다.
- 이벤트 발행은 Application Service가 담당한다. Domain 클래스가 `ApplicationEventPublisher` 등 Spring 타입을 직접 참조하지 않는다 (2번 원칙).

## 8. 내부 Enum 및 중첩 타입 배치

- 특정 도메인 클래스 내부에서만 사용하는 enum은 별도 파일로 분리하지 않고, 해당 도메인 클래스의 **중첩 타입(nested type)**으로 선언한다 (예: `Order.Status`, `Payment.Method`).
- 여러 도메인 클래스에서 공통으로 사용하는 enum은 도메인 패키지 내 별도 파일로 분리한다.

## 9. 작성 원칙

- **언어**: 한글로 설명을 작성한다. 코드의 클래스명, 메서드명 등은 영문을 사용한다.
- **톤**: 기술 문서 톤을 유지한다. 이모지를 사용하지 않는다.
- **기존 패턴 준수**: 코드베이스에 이미 존재하는 패키지 구조, 네이밍 컨벤션, 코딩 스타일을 따른다.
- **최소 충분**: 현재 작업에 필요한 도메인 클래스만 작성한다. 미래에 필요할 수도 있는 클래스를 미리 만들지 않는다.
- **테스트 용이성**: 외부 의존성 없이 단위 테스트가 가능한 구조로 작성한다. Hexagonal에서는 이 원칙이 강제된다 — Domain 테스트는 Spring 컨텍스트나 DB 없이 순수 JUnit만으로 작성 가능해야 한다 (`test.md` 참조).

## 10. 금지 패턴

- Domain 클래스에 `jakarta.persistence.*` 애노테이션을 붙이지 않는다 (`@Entity` 포함, layered와의 핵심 차이).
- Domain 클래스가 `{Domain}JpaEntity` 또는 다른 어떤 영속성 타입도 import 하지 않는다.
- Domain 클래스 내부에 영속성 변환 메서드(`toEntity()`, `fromEntity()`)를 두지 않는다.
