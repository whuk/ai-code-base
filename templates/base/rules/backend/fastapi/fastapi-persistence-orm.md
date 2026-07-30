---
description: FastAPI 영속성 규칙 — SQLAlchemy ORM (fastapi.md 전제)
globs: "**/router.py,**/schemas.py,**/service.py,**/repository.py,**/models.py"
---

# FastAPI 영속성 규칙 — SQLAlchemy ORM

`fastapi.md`의 프로젝트 구조·Pydantic 활용과 `shared/architecture.md` 8번의 Escalation Ladder를 전제로, SQLAlchemy ORM을 영속성 도구로 채택한 프로젝트의 Domain 매핑·Repository 도구·트랜잭션 규칙만 다룬다.

이 프로젝트가 SQL-first(ORM 미사용)를 채택했다면 이 파일은 적용 대상이 아니다. FastAPI 영속성 방식(ORM/SQL-first)은 한 프로젝트에서 하나만 사용하므로, 실제로 채택하지 않은 방식의 규칙 파일은 프로젝트에서 제외한다 (`fastapi-persistence-sqlfirst.md` 참조).

## 1. Domain 매핑

- ORM 모델(`models.py`)과 Domain을 분리했다면, 변환 책임은 Repository가 전담한다. Domain이 SQLAlchemy `Mapped`/`Column`을 직접 참조하지 않는다.
- 도메인 로직이 단순하면 저장소 모델과 Domain을 분리하지 않고 하나로 써도 된다(`fastapi.md` 3번의 설계 무게 완화 원칙).

## 2. Repository 도구 선택 (Escalation Ladder 적용)

- 단순 조회: 기본 쿼리(`select(Model).where(...)`).
- 동적 검색 조건 조합: 조건별 함수를 조합해 `select` 문에 `.where()`를 체이닝한다. 조건 조합 로직을 라우터/서비스가 아닌 Repository 모듈에 둔다.
- 복잡한 조인/N+1 방지: `selectinload`/`joinedload`를 명시적으로 사용한다. 관계 로딩과 페이지네이션을 동시에 쓸 때는 N+1이나 중복 로우에 주의한다.
- 대량 벌크/집계/네이티브 SQL: `text()`·`insert().values(...)` 벌크는 측정된 성능 문제가 있을 때만 사용한다. 항상 바인드 파라미터를 사용하고 문자열 연결로 SQL을 조립하지 않는다.

## 3. 트랜잭션

- 세션(`AsyncSession`)은 요청 단위로 FastAPI 의존성 주입(`Depends`)을 통해 공급한다. Service 함수가 세션을 직접 생성하지 않는다.
- 쓰기 흐름은 세션/트랜잭션 컨텍스트 안에서 커밋하고, 조회 전용 흐름은 커밋을 호출하지 않는다.

## 4. 금지 패턴

- Domain이 SQLAlchemy `Mapped`/`Column`을 직접 참조하지 않는다(1번, 변환은 Repository 전담).
- SQL을 문자열 연결/포매팅으로 조립하지 않는다. 항상 바인드 파라미터를 사용한다(2번).
