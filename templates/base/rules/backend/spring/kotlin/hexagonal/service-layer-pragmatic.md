---
description: Application Service 분리, 역할 포트 구현, stereotype·트랜잭션 규칙 (Hexagonal — Pragmatic flavor, Kotlin)
globs: "**/provided/**,**/*Service.kt,**/*Finder.kt"
---

# Application Service 클래스 분리 및 트랜잭션 규칙 (Hexagonal — Pragmatic flavor, Kotlin)

`application/{aggregate}` 슬라이스 루트의 서비스 구현 클래스 작성 규칙이다. 이 파일은 Pragmatic(실용) flavor의 Kotlin 버전으로, 역할 기반 `provided` 포트를 구현하는 `{Aggregate}{책임}Service`와 커스텀 stereotype 관용구를 다룬다.

이 프로젝트가 Clean(엄격) flavor를 채택했다면 이 파일은 적용 대상이 아니다. Clean flavor는 `{Domain}Service`/`{Domain}Finder`가 `{Domain}CommandUseCase`/`{Domain}QueryUseCase`를 구현하는 버전(`service-layer.md`, 원래 이름)이 대신 적용되며, `/rw:init`이 선택한 flavor에 맞는 한 버전만 정규 이름(`service-layer.md`)으로 남긴다.

이 프로젝트가 Java를 채택했다면 적용 대상이 아니다(`java/hexagonal/service-layer-pragmatic.md`). Layered/SQL-first/WebFlux를 채택했다면 적용 대상이 아니다.

## 1. 핵심 원칙

- 하나의 애그리거트에 대해 조회(Read) 전용과 상태 변경(Write) 로직을 개념적으로 분리한다(`shared/architecture.md` 7번).
- **조회 서비스** `{Aggregate}QueryService`: 조회 전용 `provided` 포트(`{Domain}Finder` 등)를 구현한다.
- **변경 서비스** `{Aggregate}ModifyService`: 변경 `provided` 포트(`{Domain}Register`, `Enroller` 등)를 구현한다.
- 하나의 서비스가 **여러 역할 포트를 함께 구현**할 수 있다. 조회와 변경을 한 클래스에서 겸하지는 않는다.
- 서비스가 조회가 필요하면 같은 애그리거트의 조회 `provided` 포트를 주입받아 사용한다(다른 서비스의 구현 클래스 직접 참조 금지).

## 2. Stereotype 애노테이션과 트랜잭션

- 표준 stereotype 메타 애노테이션을 `support/stereotype`에 정의해 사용한다:
  - `@ApplicationService` = `@Service` + `@Transactional`.
  - `@ValidatedApplicationService` = `@ApplicationService` + `@Validated`.
  - `@WebApiAdapter` = `@Adapter`(마커) + `@RestController`.
- 트랜잭션은 **클래스 단위**로 선언한다. 조회 전용 서비스에는 `@Transactional(readOnly = true)`를 권장한다(팀 컨벤션으로 고정).
- Kotlin 클래스는 기본이 `final`이므로 Spring 프록시(트랜잭션 등)가 동작하도록 `kotlin-spring`(all-open) 컴파일러 플러그인 적용을 전제한다. 클래스에 `open`을 수동으로 붙이지 않는다.
- 트랜잭션 경계는 Application Service에만 둔다. Domain·리포지토리에 트랜잭션 애노테이션을 두지 않는다.
- 의존성은 주 생성자 파라미터(`private val`)로 주입받는다(Java의 `@RequiredArgsConstructor`에 대응).

## 3. 책임 배분

- 도메인 규칙(불변식, 상태 전이)은 Domain에, 조율·중복 검사·트랜잭션 경계·외부 연동 호출은 서비스에 둔다.
- 서비스는 Domain 조회 → Domain 메서드 호출 → 저장 위임 순으로 흐른다. 변경된 Domain 객체 반환을 허용한다(`ports-and-adapters.md` 0번).

## 4. 클래스 구조 예시

```kotlin
@ValidatedApplicationService
class MemberModifyService(
    private val memberFinder: MemberFinder,        // 같은 애그리거트 조회 포트
    private val memberRepository: MemberRepository, // required 드리븐 포트
    private val emailSender: EmailSender,
    private val passwordEncoder: PasswordEncoder,
) : MemberRegister {

    override fun register(@Valid request: MemberRegisterRequest): Member {
        checkDuplicateEmail(request)
        val member = Member.register(request.toInfo(), passwordEncoder)
        memberRepository.save(member)
        return member
    }
}
```

## 5. 금지 패턴

- 조회 서비스에 상태 변경 로직을 포함하지 않는다.
- 메서드 단위로 `@Transactional`을 개별 선언하지 않는다(클래스 단위).
- 서비스가 다른 서비스의 구현 클래스를 직접 주입/참조하지 않는다(`provided` 포트로만).
- 서비스가 `adapter` 계층의 구현 클래스를 직접 참조하지 않는다.
- 클래스에 `open`을 수동으로 붙이지 않는다(`kotlin-spring` all-open 플러그인 전제).
