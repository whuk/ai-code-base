# DDD Rich Domain 클래스 작성 규칙 (Hexagonal — Toby flavor: 도메인=엔티티)

도메인 패키지 내 클래스를 작성하거나 수정할 때 다음 원칙을 따른다. 이 파일은 Hexagonal 패키징을 쓰되 **Domain 클래스가 JPA 엔티티를 겸하는**(`@Entity` 마커 + `orm.xml`) Toby(splearn식) flavor의 Kotlin 버전이다. 별도의 `{Domain}JpaEntity`를 두지 않고, Domain이 곧 영속성 대상이다.

이 프로젝트가 Clean(엄격) flavor를 채택했다면 이 파일은 적용 대상이 아니다. Clean flavor는 Domain을 순수 POKO로 두고 `{Domain}JpaEntity`를 완전히 분리하는 버전(`domain.md`, 원래 이름)이 대신 적용되며, `/rw:init`이 선택한 flavor에 맞는 한 버전만 정규 이름(`domain.md`)으로 남긴다.

이 프로젝트가 Java를 채택했다면 이 파일은 적용 대상이 아니다(`java/hexagonal/domain-entity.md` 참조). Layered를 채택했다면 적용 대상이 아니다. 또한 SQL-first(ORM 미사용)나 WebFlux(R2DBC)를 채택했다면 적용 대상이 아니다 — 이 flavor는 블로킹 JPA를 전제한다(WebFlux 규칙은 Java 전용).

## 1. Rich Domain Model

- 비즈니스 로직을 도메인 객체 내부에 배치한다. Anemic Domain Model(getter/setter만 있는 빈약한 모델)을 금지한다.
- 도메인 객체가 스스로 자신의 상태를 관리하고, 비즈니스 규칙을 실행한다.

## 2. 인프라 비종속 (애노테이션 최소화, 도메인=엔티티)

- Domain 클래스가 JPA 엔티티 역할을 겸한다. 별도 `{Domain}JpaEntity`를 만들지 않는다(Clean flavor와의 핵심 차이).
- 클래스에는 `@Entity` 마커를 남긴다. 공통 식별자/`equals`/`hashCode`는 `AbstractEntity`(`@MappedSuperclass`, `abstract class`) 상속으로 제공한다.
- `@Column`/`@Table`/연관관계 등 매핑 세부는 원칙적으로 `orm.xml`에 작성한다(9번). `@OneToOne`/`@ManyToOne`·`@NaturalId`처럼 소스에 두는 편이 명확한 표식은 최소한으로 부착하는 것을 허용한다.
- Kotlin 클래스는 기본이 `final`이라 JPA 프록시/지연 로딩이 동작하지 않으므로, `kotlin-jpa`(no-arg) 컴파일러 플러그인으로 JPA 하이드레이션용 기본 생성자를 생성하고 `kotlin-allopen`(또는 `kotlin-spring`이 포함)이 `@Entity`를 `open`으로 열도록 구성한다. 소스에 기본 생성자나 `open`을 수동으로 작성하지 않는다.
- Spring 애노테이션(웹/서비스/트랜잭션)은 Domain에 포함하지 않는다.

## 3. Entity vs Value Object 구분

- **Entity**: 고유 식별자(ID)를 가지며 상태가 변할 수 있는 객체. 동일성은 ID로 판단하며 `AbstractEntity`가 공통 제공한다.
- **Value Object**: 식별자 없이 속성 조합으로 동일성을 판단하는 불변 객체. `data class`로 선언하고 `init` 블록에서 검증한다(예: `Email`). 속성 기반 `equals`/`hashCode`가 자동 제공된다.
- 가능한 한 Value Object를 우선한다.

## 4. 불변성 우선

- 상태는 생성자 또는 `companion object` 팩터리 함수(`Member.register(...)`)로 초기화한다.
- 상태 변경은 의미 있는 이름의 도메인 메서드로만 수행한다(`activate()`, `deactivate()`, `updateInfo(...)`).
- 프로퍼티는 가능한 한 `val`, 변경이 필요하면 `var ... private set`으로 외부 노출을 차단한다. setter를 노출하지 않는다.

## 5. 자기 검증 (Self-validating)

- 객체 생성 시점에 불변 조건을 검증한다(`init` 블록 또는 팩터리 함수). 유효하지 않은 상태의 객체는 존재할 수 없어야 한다.
- 상태 변경 메서드 진입 시 사전 조건을 `check(...)`/`require(...)`로 검증한다(splearn Java의 `Assert.state`/`Assert.isTrue`에 대응). null 방지는 Kotlin 타입 시스템(비-null 타입)으로 표현하고 경계 값만 명시 검증한다.
- 검증 실패 시 명확한 도메인 예외(`<상황>Exception`)를 던진다.
- JPA 하이드레이션 경로(no-arg 생성자 + 필드 주입)는 이미 검증된 상태의 재구성이므로 불변 조건 재검증 대상에서 제외한다.

## 6. Aggregate Root 와 애그리거트 간 참조

- Aggregate Root를 식별하고, 외부에서는 Aggregate Root를 통해서만 내부 객체에 접근한다.
- **애그리거트 간 참조는 다른 Aggregate Root를 객체로 직접 참조하는 것을 허용한다**(예: `Course`가 `Instructor`를 `@ManyToOne`으로 참조). 이는 `shared/architecture.md` 6번의 "ID로만 참조" 조항을 이 flavor에서 **완화·대체**한다.
- 단, 다른 애그리거트에 대해서는 **조회 메서드(getter/`ensure*` 계열)만 호출**하고, 상태를 변경하는 메서드는 호출하지 않는다. 이 규율은 `archunit.md`의 슬라이스 규칙으로 강제한다.
- 도메인/애플리케이션 슬라이스 간 순환 의존을 금지하고 단방향 의존만 허용한다.

## 7. 도메인 이벤트

- 중요한 상태 변화에 도메인 이벤트를 정의한다(필요한 경우에만). 이벤트는 불변 `data class`로 작성한다.
- 이벤트 발행은 Application Service가 담당한다. Domain이 `ApplicationEventPublisher` 등 Spring 타입을 직접 참조하지 않는다(2번).

## 8. 내부 Enum 및 중첩 타입 배치

- 특정 도메인 클래스 내부에서만 쓰는 enum은 중첩 타입으로 선언한다(예: `Member.Status`). 여러 도메인 클래스가 공유하는 enum은 도메인 패키지 내 별도 파일로 둔다.

## 9. JPA 영속성 매핑 (orm.xml)

- Domain 클래스와 JPA Entity를 분리하지 않는다. 하나의 클래스가 Rich Domain이자 영속성 대상이다.
- 매핑 세부는 `orm.xml`(`src/main/resources/META-INF/`)에 작성한다. 규모가 커지면 애그리거트 단위로 분리한다.
- access type은 `FIELD`로 지정한다. Value Object는 `<embeddable>`로, 공통 식별자는 `<mapped-superclass>`(`AbstractEntity`)로 매핑한다. 별도 영속성 DTO/변환 계층을 두지 않는다.

## 10. 작성 원칙

- **언어**: 한글 설명, 영문 식별자. **톤**: 기술 문서, 이모지 금지. **기존 패턴 준수**, **최소 충분**(미래 대비 추측 금지), **테스트 용이성**(순수 JUnit으로 단위 테스트 가능하게, `test.md` 참조).

## 11. 금지 패턴

- Anemic Domain Model 금지.
- 매핑 세부(`@Column`/`@Table` 등)를 소스 애노테이션으로 흩뿌리지 않는다(`orm.xml`로 분리, 9번).
- 상태 변경용 setter(`var`의 public set)를 노출하지 않는다.
- 다른 애그리거트의 상태를 **변경**하는 메서드를 호출하지 않는다(읽기 전용 참조만 허용, 6번).
- Domain 클래스에 웹/서비스/트랜잭션 등 Spring 애노테이션을 부착하지 않는다.
- 소스에 `open`이나 no-arg 기본 생성자를 수동 작성하지 않는다(컴파일러 플러그인이 처리, 2번).
