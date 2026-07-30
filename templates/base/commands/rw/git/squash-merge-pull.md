---
description: "GitHub PR을 squash merge하고 로컬 main 브랜치를 최신 상태로 동기화한다."
argument-hint: "squash merge할 PR 번호 (예: #123 또는 123, 선택)"
user-invocable: true
---

# /rw:git:squash-merge-pull — PR squash merge 및 main 동기화

GitHub PR을 squash merge하고 로컬 main 브랜치를 최신 상태로 동기화합니다.

## 1단계: 대상 PR 결정

- `$ARGUMENTS`가 PR 번호(예: `#123`, `123`)이면 해당 PR을 대상으로 합니다
- `$ARGUMENTS`가 없으면 현재 저장소의 가장 최근 열린 PR을 대상으로 합니다

## 2단계: PR 상태 확인

- `gh pr view <PR번호> --json title,state,mergeable,headRefName,baseRefName`으로 PR 정보를 조회합니다
- PR이 이미 머지되었거나 닫혀 있으면 사용자에게 알리고 중단합니다
- merge 가능 여부(mergeable)를 확인하고, 충돌이 있으면 사용자에게 알리고 중단합니다

## 3단계: 머지 전 사용자 확인

- PR 제목, 번호, 소스 브랜치 → 타겟 브랜치 정보를 표시합니다
- 위 정보를 보여주고 머지 진행 여부를 확인받습니다. 확인 없이 4단계로 진행하지 않습니다

## 4단계: squash merge 수행

- `gh pr merge <PR번호> --squash --delete-branch`를 실행합니다

## 5단계: 로컬 main 브랜치 동기화

- `git status --short`로 커밋되지 않은 변경사항이 있는지 확인합니다. 있으면 사용자에게 알리고 stash 후 진행할지 중단할지 확인받습니다
- `git checkout main && git pull origin main`을 실행합니다 (기본 브랜치가 `main`이 아니면 `git remote show origin`으로 확인한 HEAD 브랜치를 사용합니다)

## 6단계: 정리 작업

- 삭제된 리모트 브랜치에 대응하는 로컬 브랜치가 있으면 `git branch -d`로 정리합니다
- `git fetch --prune`으로 리모트 추적 브랜치를 정리합니다

## 결과 보고

- 머지된 PR 정보 (번호, 제목)
- 현재 브랜치와 최신 커밋 정보

## 하지 말아야 할 것

- 사용자 확인 없이 머지를 실행하기
- merge 불가능한 PR을 강제로 머지하기
- main 브랜치가 아닌 다른 브랜치에서 pull 수행하기
- 로컬에 커밋되지 않은 변경사항이 있을 때 checkout하기 (stash 또는 중단 안내)
