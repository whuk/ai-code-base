---
description: FastAPI 영속성 규칙 — SQL-first(ORM 미사용, SQLAlchemy Core/async 드라이버) (fastapi.md 전제)
paths:
  - "**/router.py"
  - "**/schemas.py"
  - "**/service.py"
  - "**/repository.py"
---

# FastAPI 영속성 규칙 — SQL-first (ORM 미사용)

`fastapi.md`의 프로젝트 구조·Pydantic 활용과 `shared/architecture.md` 8번의 Escalation Ladder를 전제로, ORM 없이 SQLAlchemy Core(또는 async 드라이버 직접)로 영속성을 구성하는 프로젝트의 Domain 매핑·Repository 도구·트랜잭션 규칙만 다룬다.

이 프로젝트가 SQLAlchemy ORM을 채택했다면 이 파일은 적용 대상이 아니다. FastAPI 영속성 방식(ORM/SQL-first)은 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 방식의 규칙 파일은 프로젝트에서 제외한다 (`fastapi-persistence-orm.md` 참조).

## 1. Domain 매핑

- SQLAlchemy **Core**(`select()`/`text()`, ORM 매핑 없음)를 기본으로 하고, 필요하면 asyncpg 등 async 드라이버를 직접 사용한다. `models.py`(ORM 모델)를 만들지 않고, `repository.py`가 SQL 실행과 Row → Pydantic 모델/`dataclass` 매핑을 전담한다.
- 테이블 메타데이터가 필요하면 Core `Table` 정의를 `repository.py`(또는 전용 모듈)에 둔다.
- 도메인 로직이 단순하면 Pydantic 모델/`dataclass`에 메서드를 붙여 그대로 Domain으로 써도 된다(`fastapi.md` 3번의 설계 무게 완화 원칙).

## 2. Repository 도구 선택 (Escalation Ladder 적용)

- 단순 조회: Core `select(table).where(...)`.
- 동적 검색 조건 조합: 조건별 함수를 조합해 `select` 문에 `.where()`를 체이닝한다. 조건 조합 로직을 라우터/서비스가 아닌 Repository 모듈에 둔다.
- 복잡한 조인/N+1 방지: 명시적 조인 쿼리로 해결한다 — 지연 로딩 자체가 없으므로 쿼리 수는 조인 설계로 통제한다.
- 대량 벌크/집계/네이티브 SQL: `text()`·`insert().values(...)` 벌크는 Core 표현식으로 표현이 어려운 경우에만 사용한다. 항상 바인드 파라미터를 사용하고 문자열 연결로 SQL을 조립하지 않는다.

## 3. 트랜잭션

- 커넥션(`AsyncConnection`)은 요청 단위로 FastAPI 의존성 주입(`Depends`)을 통해 공급한다. Service 함수가 커넥션을 직접 생성하지 않는다.
- 쓰기 흐름은 트랜잭션 컨텍스트 안에서 커밋하고, 조회 전용 흐름은 커밋을 호출하지 않는다.

## 4. 금지 패턴

- SQL을 문자열 연결/포매팅으로 조립하지 않는다. 항상 바인드 파라미터를 사용한다(2번).
- Row → Pydantic/`dataclass` 매핑을 라우터/서비스에 흩뿌리지 않는다. `repository.py`가 전담한다(1번).
