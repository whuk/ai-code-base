---
description: JPA + MongoDB 병용 프로젝트의 MongoDB 통합 테스트 base class 규칙 (Kotlin, test.md 추가분)
paths:
  - "**/src/test/**"
---

# 테스트 작성 규칙 — MongoDB 추가분

`test.md`의 base class 선택 규칙을 전제로, JPA와 MongoDB를 **함께 사용하는** 프로젝트에서 MongoDB를 사용하는 도메인의 통합 테스트에만 추가로 적용되는 규칙이다.

이 프로젝트가 MongoDB를 사용하지 않는다면(JPA만 사용) 이 파일은 적용 대상이 아니다. MongoDB 사용 여부는 프로젝트 시작 시점에 고정하므로, 사용하지 않는 프로젝트는 이 파일을 프로젝트에서 제외한다. Hexagonal을 채택했다면 `hexagonal/test-mongodb.md`, Java를 채택했다면 `java/layered/test-mongodb.md`를 참조한다(실제로 채택하지 않은 아키텍처/언어의 규칙 파일은 프로젝트에서 제외한다).

## 1. MongoDB 통합 테스트 (전체 컨텍스트)

- **Repository 테스트**: `IntegrationTestBase`를 상속한다.
- **Controller/Web 테스트**: `WebIntegrationTestBase`를 상속한다.
- H2 + Embedded MongoDB를 모두 로드한다.
- Message, Conversation 등 MongoDB를 사용하는 도메인의 테스트에 해당한다.

## 2. base class 구조 (MongoDB)

`test.md` 3번의 JPA 전용 base class에 더해, MongoDB 포함 테스트에는 다음 base class를 사용한다.

| base class | 용도 | 로드 범위 |
|---|---|---|
| `IntegrationTestBase` | MongoDB 포함 통합 테스트 | 전체 컨텍스트 (H2 + MongoDB) |
| `WebIntegrationTestBase` | MongoDB 포함 Web 테스트 | 전체 컨텍스트 + MockMvc |

## 3. 금지 패턴

- JPA 엔티티만 사용하는(MongoDB를 쓰지 않는) 도메인의 테스트에서 `IntegrationTestBase` 또는 `WebIntegrationTestBase`를 상속하지 않는다 (불필요한 MongoDB 로드). 이 경우 `test.md`의 `Jpa*` base class를 사용한다.
