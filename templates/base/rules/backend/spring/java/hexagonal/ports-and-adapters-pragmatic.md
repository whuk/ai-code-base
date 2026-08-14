---
description: Hexagonal 패키지 구조, 의존 방향, provided/required 포트 작성 규칙 (Pragmatic flavor)
paths:
  - "**/domain/**"
  - "**/application/**"
  - "**/adapter/**"
---

# Ports & Adapters 구조 규칙 (Pragmatic flavor)

Controller, Application Service, Domain, Persistence 간의 의존 방향과 데이터 전달 규칙을 정의한다. 이 파일은 Pragmatic(실용) flavor 버전으로, `provided`/`required` 포트 관용구와 역할 기반 세분 포트, Spring Data 리포지토리를 곧 드리븐 포트로 쓰는 실용 헥사고날을 다룬다.

이 프로젝트가 Clean(엄격) flavor를 채택했다면 이 파일은 적용 대상이 아니다. Clean flavor는 `port/in`·`port/out` + `{Domain}CommandUseCase`/`{Domain}QueryUseCase` + 별도 `{Domain}PersistenceAdapter`를 쓰는 버전(`ports-and-adapters.md`, 원래 이름)이 대신 적용되며, `/rw:init`이 선택한 flavor에 맞는 한 버전만 정규 이름(`ports-and-adapters.md`)으로 남긴다.

이 프로젝트가 Layered/Kotlin/SQL-first/WebFlux를 채택했다면 적용 대상이 아니다(Pragmatic flavor는 Java + Hexagonal + JPA + Spring MVC 전용).

## 0. shared/architecture.md 조항 완화 선언

이 flavor는 `shared/architecture.md`의 다음 조항을 **국소적으로 완화·대체**한다(이 파일이 우선한다):

- **1번(Read 흐름 Read DTO 매핑)·10번(Query에서 Domain 반환 금지)**: Pragmatic은 조회 흐름에서 Domain 객체를 그대로 반환할 수 있다(4번 참조).
- **2번(Command 반환 = 생성 ID / 수정·삭제 void)**: Pragmatic은 서비스가 변경된 Domain 객체를 반환하는 것을 허용한다(5번 참조).
- **6번(애그리거트 경계 참조는 ID로만)**: Pragmatic은 애그리거트 간 객체 직접 참조(읽기 전용)를 허용한다(`domain.md` 6번).

그 외 `shared/architecture.md` 원칙(계층 의존 방향, Command/Query 입력 객체, Finder/Service 분리, 다중 진입점 방어, Rich Domain)은 그대로 적용한다.

## 1. 패키지 구조

```
{app}
├── domain
│   └── {aggregate}                 Rich Domain 객체 = JPA 엔티티 (domain.md)
│   └── shared                      공유 Value Object (Email 등)
├── application
│   └── {aggregate}
│       ├── provided                드라이빙 포트 (어댑터가 호출하는 서비스 인터페이스)
│       ├── required                드리븐 포트 (서비스가 필요로 하는 인터페이스)
│       └── {Aggregate}{책임}Service  provided 포트 구현체 (슬라이스 루트에 위치)
└── adapter
    ├── webapi                      REST 컨트롤러 (+ dto)
    ├── persistence                 required 포트의 JPA 구현 (필요 시)
    ├── integration                 외부 시스템 연동 (메일 등)
    └── security                    인증/암호화 (도메인 SPI 구현)
```

- `domain/{aggregate}`와 `application/{aggregate}`를 묶어 하나의 **애플리케이션 컴포넌트(슬라이스)**로 본다. 슬라이스 간 순환 의존을 금지한다(`archunit.md`로 강제).
- 여러 애그리거트가 공통으로 쓰는 포트는 두지 않는다. 포트는 항상 특정 애그리거트 전용이다.

## 2. 의존 방향

- 계층 순서(바깥 → 안쪽): **adapter → application → domain**. 안쪽이 바깥을 참조하지 않는다.
- Controller(`adapter/webapi`)는 `provided` 포트 인터페이스에만 의존한다. 서비스 구현 클래스를 직접 타입으로 참조하지 않는다.
- 서비스는 `required` 포트 인터페이스에만 의존한다. adapter 구현체를 직접 알지 못한다.
- 이 의존 방향은 `HexagonalArchitectureTest`(ArchUnit)로 빌드 시 강제한다(`archunit.md`).

## 3. 드라이빙 포트 (provided) — 역할 기반 세분 포트

- Controller가 호출하는 진입점이다. `{Domain}CommandUseCase`/`{Domain}QueryUseCase` 같은 굵은 2분할 대신, **동작 주체를 나타내는 역할 명사**로 세분한다: `MemberRegister`, `MemberFinder`, `MemberAuthenticator`, `Enroller`, `CourseCreator`, `CoursePublisher`, `CurriculumFinder` 등.
- 조회 전용 포트와 변경 포트를 개념적으로 분리한다(`MemberFinder` vs `MemberRegister`) — `shared/architecture.md` 7번의 Read/Write 분리.
- 포트 파라미터는 Command/Query 역할의 전용 객체(record)를 받는다. 원시 타입을 나열하지 않는다. 입력 검증은 파라미터에 `@Valid`를 부착한다(다중 진입점 방어, `shared/architecture.md` 5번).
- 다른 애플리케이션 서비스의 기능이 필요하면 그 서비스의 `provided` 포트 인터페이스(와 DTO)에만 의존한다. 구현 클래스를 직접 참조하지 않는다.

## 4. 드리븐 포트 (required) — Spring Data 리포지토리를 포트로

- 서비스가 의존하는 영속성/외부연동 인터페이스다. **영속성 드리븐 포트는 Spring Data `Repository<Domain, Id>`를 직접 상속**해 정의하고, 필요한 메서드만 선언한다. 별도 `{Domain}PersistenceAdapter`·`{Domain}JpaEntity`·`{Domain}PersistenceMapper`를 두지 않는다(Clean flavor와의 핵심 차이) — Spring Data가 런타임에 구현을 제공한다.
- 리포지토리는 Domain 객체를 그대로 저장/반환한다(도메인=엔티티, `domain.md`). Read DTO 프로젝션을 강제하지 않는다.
- 외부 연동 드리븐 포트(`EmailSender` 등)와 도메인 SPI(`PasswordEncoder`)는 인터페이스만 두고 구현을 adapter(`integration`/`security`)가 담당한다. 도메인이 필요로 하는 기술 추상화(`PasswordEncoder`)는 인터페이스를 도메인에 둔다.
- 리포지토리 도구 선택(파생 쿼리/`@EntityGraph`/`@Query`/QueryDSL)은 `repository.md`(Pragmatic)를 따른다.

## 5. Application Service (구현체)

- `service-layer.md`(Pragmatic)의 분리·트랜잭션·stereotype 규칙을 따른다. 구현체는 슬라이스 루트(`application/{aggregate}`)에 두고 `{Aggregate}{책임}Service`로 명명한다(`MemberModifyService`, `MemberQueryService`). 하나의 서비스가 여러 역할 포트를 구현할 수 있다.
- 서비스는 Domain 객체를 조회(리포지토리 호출)하고 Domain 메서드로 상태를 변경한 뒤 다시 리포지토리로 저장을 위임한다. 조율·중복검사·트랜잭션 경계는 서비스, 비즈니스 규칙은 Domain이 담당한다.
- 서비스/컨트롤러는 필요 시 Domain 객체를 반환할 수 있다(0번 완화 선언).

## 6. Adapter 구현 규칙

### 6.1. Inbound Web Adapter

- `api-code-first.md`를 따른다: 수기 `@RestController`(또는 stereotype `@WebApiAdapter`) + `record` DTO. `provided` 포트에 주입 의존한다.
- **웹 요청 DTO는 `provided` 포트의 요청 record를 그대로 재사용할 수 있다**(예: `MemberApi`가 `provided.MemberRegisterRequest`를 직접 받음). 계층마다 별도 타입을 강제하지 않는다 — 다만 요청 record는 `toInfo()` 등으로 도메인 입력 객체(`MemberRegisterInfo`)로 변환해 도메인에 전달하고, Domain이 웹 DTO를 직접 받지 않게 한다.
- 응답 DTO(`record`)는 `of(...)` 정적 팩터리로 Domain에서 변환한다.

### 6.2. Outbound Persistence Adapter

- 대부분의 경우 별도 어댑터 클래스가 필요 없다 — `required`의 Spring Data 리포지토리 인터페이스를 Spring Data가 구현한다. 파생 쿼리/`@Query`/`@EntityGraph`로 표현이 어려운 커스텀 구현이 필요할 때만 `adapter/persistence`에 fragment/구현 클래스를 둔다.

## 7. 금지 패턴

- Controller가 서비스 구현 클래스를 직접 참조하지 않는다(반드시 `provided` 포트 인터페이스로).
- 서비스가 다른 애플리케이션 서비스의 **구현 클래스**를 직접 참조하지 않는다(`provided` 포트로만).
- 안쪽 계층(domain/application)이 바깥 계층(adapter)을 참조하지 않는다.
- Domain 클래스에 웹/영속성 애노테이션(매핑 세부)을 흩뿌리지 않는다(`domain.md`).
- 슬라이스 간 순환 의존을 만들지 않는다.
