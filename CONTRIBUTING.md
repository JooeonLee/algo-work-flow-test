# 스터디 규칙

## 브랜치

```
solve/{주차}-{플랫폼}-{문제번호}-{내아이디}
예) solve/week-01-swea-1859-JooeonLee
```

## 커밋 메시지

```
solve: SWEA 1859 백만 장자 프로젝트
fix: SWEA 1859 오버플로 수정
docs: 스터디 규칙 정리
```

## 제출 경로

```
solutions/week-{2자리}/{플랫폼}-{문제번호}/{내 GitHub 아이디}/*.java
```

| 플랫폼 | 접두사 | 예시 |
| --- | --- | --- |
| SWEA | `swea` | `solutions/week-01/swea-1859/JooeonLee/Solution.java` |
| 프로그래머스 | `pgs` | `solutions/week-01/pgs-12945/JooeonLee/Solution.java` |

여러 파일로 나눠도 됩니다. 본인 폴더 안이기만 하면 됩니다.

```
solutions/week-02/pgs-42586/JooeonLee/
├── Solution.java
├── Truck.java
└── NOTE.md        ← 풀이 메모도 환영
```

## 자동 검사에서 막히는 경우

| 메시지 | 원인 | 해결 |
| --- | --- | --- |
| 경로 규칙에 맞지 않습니다 | 폴더 depth가 다름 | `solutions/week-01/swea-1859/{아이디}/파일.java` 형태로 맞추세요 |
| 본인 폴더가 아닙니다 | 폴더명 오타, 대소문자 | GitHub 아이디와 정확히 같게 (검사는 대소문자 무시) |
| 컴파일 실패 | javac 오류 | PR 댓글의 `javac 출력`을 확인하세요 (Java 17) |
| 제출된 `.java` 파일이 없습니다 | 경고일 뿐 | 문서 PR이면 무시해도 됩니다 |

## 리뷰

- 리뷰어 1명 이상 승인 후 머지합니다.
- 정답 여부보다 **읽기 쉬운 코드 / 복잡도 / 다른 접근**에 집중해서 리뷰합니다.
- 리뷰 코멘트는 질문형으로: "여기 왜 `long`을 쓰셨나요?" > "`long` 쓰세요"

## 한 이슈에 문제 여러 개 등록하기 (주차 이슈 + 하위 이슈)

이슈 폼의 `문제 목록`에 한 줄에 문제 하나씩, `|`로 구분해서 여러 줄을 입력하면 한 번에 여러 문제를 등록합니다.

```
링크 | 제목 | 번호(선택) | 난이도(선택) | 마감일(선택)
```

- 이 이슈가 **주차 이슈(부모)**가 되고, 문제마다 **하위 이슈(자식)**를 새로 만들어
  [Sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) API로 연결합니다.
  실제 풀이 폴더/README/제출 체크리스트는 전부 하위 이슈 쪽에 달립니다.
- 플랫폼은 링크 도메인(`swexpertacademy.com` / `programmers.co.kr`)으로 자동 판별합니다. 다른 도메인이거나 선택한 플랫폼과 다르면 등록이 실패합니다.
- 번호는 SWEA만 직접 입력하면 됩니다. 프로그래머스는 링크에서 자동 추출됩니다.
- 하위 이슈는 전원이 제출하면 자동으로 닫히고, 주차 이슈에 연결된 하위 이슈가 모두 닫히면 주차 이슈도 자동으로 닫힙니다.
- 같은 주차·플랫폼·번호 조합을 다른 주차 이슈에서 이미 등록했다면 등록이 거부됩니다.
- 하위 이슈에는 `problem` 라벨을 붙이지 않습니다 (`sub-problem` 라벨을 대신 씁니다). 등록 워크플로가 `problem` 라벨이나
  `### 문제 목록` 문구로 "처리해야 할 주차 이슈"를 가려내는데, 하위 이슈까지 걸리면 자기 자신을 잘못 재등록하려 들기 때문입니다.

## 이슈 본문을 고쳤는데 반영이 안 될 때

문제 등록 워크플로는 이슈 `edited` 이벤트에도 다시 실행됩니다.
Actions 탭 → `문제 등록` 워크플로에서 실패 로그를 확인하세요.
같은 줄을 그대로 두면 기존 하위 이슈를 재사용합니다(새로 만들지 않음).
줄을 지우면 그 문제의 폴더가 비어 있을 때만 자동으로 지우고 하위 이슈도 닫습니다(사유: 계획 취소).
이미 제출된 풀이가 있으면 폴더는 그대로 두고 댓글로 알려 드립니다.

## 잘못 만든 이슈는 삭제하지 말고 편집으로 취소하세요

워크플로는 이슈 `opened`/`edited`/`reopened`에만 반응하고 **`deleted`(이슈 삭제)는 처리하지 않습니다.**
그래서 이슈를 삭제하면:

- 주차 이슈(부모)를 삭제 → 그 이슈가 만든 하위 이슈들은 부모 링크만 끊긴 채 그대로 남고, 폴더도 지워지지 않습니다.
- 문제 이슈(자식)를 삭제 → 그 문제 폴더가 더 이상 존재하지 않는 이슈 번호를 참조한 채 그대로 남습니다.

즉 삭제로는 아무것도 자동 정리되지 않습니다. 잘못 등록한 문제를 취소하려면 **주차 이슈를 삭제하지 말고, 본문의 `문제 목록`에서 해당 줄을 지우고 저장**하세요.
바로 위에서 설명한 자동 정리(제출물 없으면 폴더 삭제 + 하위 이슈 자동 닫힘)가 그 경로로만 동작합니다.

## 워크플로를 손볼 때

| 파일 | 역할 |
| --- | --- |
| `.github/workflows/problem-register.yml` | 이슈 → 문제 폴더 생성, 체크리스트 댓글 |
| `.github/workflows/submission-check.yml` | PR → 경로 규칙 + 컴파일 검사 |
| `.github/workflows/submission-merged.yml` | 머지 → 체크리스트 체크, 현황판 갱신 |
| `.github/scripts/lib.mjs` | 경로 파싱, 이슈 폼 파싱, 댓글 upsert 등 공통 로직 |
| `.github/scripts/build-leaderboard.mjs` | `solutions/`를 훑어 README 현황판 생성 |
| `.github/scripts/mock-github.mjs` | 테스트용 GitHub API 모킹 (실제 서비스 코드 아님) |
| `.github/scripts/*.test.mjs` | `lib.mjs`/`register-problem.mjs`/`on-merged.mjs` 단위 테스트 |

스크립트는 의존성 없이 `actions/github-script`가 주입하는 `github` / `context` / `core`만 사용합니다.
`npm install` 없이 그대로 돌아갑니다. 테스트도 Node 내장 `node:test`만 써서 별도 설치가 필요 없습니다 (Node 20+).

로컬에서 현황판만 다시 만들어 보려면:

```bash
node .github/scripts/build-leaderboard.mjs
```

`register-problem.mjs`/`on-merged.mjs`를 고쳤다면 테스트부터 돌려보세요 (특히 `register-problem.mjs`는
실제 GitHub 이슈를 만들고 닫고 폴더를 지우는 로직이라, 모킹된 테스트로 회귀를 잡는 게 중요합니다):

```bash
node --test .github/scripts/*.test.mjs
```
