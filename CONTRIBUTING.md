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

## 이슈 본문을 고쳤는데 반영이 안 될 때

문제 등록 워크플로는 이슈 `edited` 이벤트에도 다시 실행됩니다.
Actions 탭 → `문제 등록` 워크플로에서 실패 로그를 확인하세요.
주차나 문제 번호를 바꾸면 **새 폴더가 추가로 생깁니다**. 이전 폴더는 직접 지워 주세요.

## 워크플로를 손볼 때

| 파일 | 역할 |
| --- | --- |
| `.github/workflows/problem-register.yml` | 이슈 → 문제 폴더 생성, 체크리스트 댓글 |
| `.github/workflows/submission-check.yml` | PR → 경로 규칙 + 컴파일 검사 |
| `.github/workflows/submission-merged.yml` | 머지 → 체크리스트 체크, 현황판 갱신 |
| `.github/scripts/lib.mjs` | 경로 파싱, 이슈 폼 파싱, 댓글 upsert 등 공통 로직 |
| `.github/scripts/build-leaderboard.mjs` | `solutions/`를 훑어 README 현황판 생성 |

스크립트는 의존성 없이 `actions/github-script`가 주입하는 `github` / `context` / `core`만 사용합니다.
`npm install` 없이 그대로 돌아갑니다.

로컬에서 현황판만 다시 만들어 보려면:

```bash
node .github/scripts/build-leaderboard.mjs
```
