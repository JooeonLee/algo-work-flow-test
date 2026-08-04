# 알고리즘 스터디

문제 링크 하나만 이슈로 등록하면, 풀이 폴더 생성부터 제출 검사·현황 집계까지 GitHub Actions가 처리합니다.

- 플랫폼: SWEA, 프로그래머스
- 언어: Java
- 구조: 주차별 폴더

## 어떻게 돌아가나요

```
① 문제 등록 (Issue)          ② 풀이 제출 (PR)              ③ 머지
──────────────────────      ─────────────────────────    ──────────────────────
이슈 템플릿에 링크 입력  →   solutions/week-01/           →  체크리스트 자동 체크
                             swea-1859/{내아이디}/           전원 완료 시 이슈 닫힘
   ↓ 자동                        ↓ 자동                        ↓ 자동
문제 폴더 + README 생성      경로 규칙 검사                 README 현황판 갱신
제출 체크리스트 댓글         javac 컴파일 검사
주차/플랫폼 라벨 부여        주차/플랫폼 라벨 부여
```

## 참여 방법

### 1. 문제 등록 (누구나)

[Issues → New issue → 📌 알고리즘 문제 등록](../../issues/new?template=problem.yml)에서
주차 · 플랫폼 · 문제 링크 · 제목을 입력하고 등록합니다.

> SWEA는 링크에 문제 번호가 없어서 `문제 번호`를 직접 입력해야 합니다.
> 프로그래머스는 비워 두면 링크에서 자동으로 추출합니다.

잠시 뒤 이슈에 문제 폴더 경로와 참여 방법이 댓글로 달립니다.

### 2. 풀이 제출

```bash
git switch main && git pull
git switch -c solve/week-01-swea-1859-내아이디

mkdir -p solutions/week-01/swea-1859/내아이디
# solutions/week-01/swea-1859/내아이디/Solution.java 작성

git add . && git commit -m "solve: SWEA 1859 백만 장자 프로젝트"
git push -u origin HEAD
```

PR을 열면 봇이 경로 규칙과 컴파일을 검사하고 결과를 댓글로 남깁니다.

### 3. 리뷰 & 머지

리뷰어 승인 후 머지하면 이슈의 제출 체크리스트에 자동으로 체크되고,
전원이 제출을 마치면 이슈가 닫힙니다.

## 디렉터리 규칙

```
solutions/
└── week-01/
    └── swea-1859/                ← {플랫폼}-{문제번호}
        ├── .problem.json         ← 워크플로가 생성 (건드리지 마세요)
        ├── README.md             ← 워크플로가 생성
        ├── JooeonLee/
        │   └── Solution.java
        └── another-member/
            └── Solution.java
```

- 플랫폼 접두사: SWEA → `swea`, 프로그래머스 → `pgs`
- 사람마다 폴더를 나눕니다. SWEA·프로그래머스 Java 풀이는 클래스명이 대부분 `Solution`이라
  한 폴더에 모으면 컴파일이 깨집니다.
- 폴더 이름은 **본인 GitHub 아이디**와 정확히 같아야 합니다. 다르면 PR 검사에서 막힙니다.

자세한 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

## 스터디원 관리

[`.github/study-members.yml`](.github/study-members.yml)에 GitHub 아이디를 추가하면
다음 문제부터 체크리스트에 포함됩니다. 파일을 지우면 레포 콜라보레이터 목록을 대신 사용합니다.

## 📊 스터디 현황

<!-- algo-study:board:start -->

> 마지막 갱신: 2026-08-04 · 등록된 문제 2개

### 🏆 제출 순위

_아직 제출된 풀이가 없습니다._

### 📚 주차별 문제

<details open>
<summary><b>week-01</b> (2문제)</summary>

| 문제 | 이슈 | 제출 | 제출자 |
| --- | --- | --- | --- |
| [프로그래머스 42627 · 디스크 컨트롤러](https://school.programmers.co.kr/learn/courses/30/lessons/42627) | #1 | 0 | - |
| [프로그래머스 42892 · 길 찾기 게임](https://school.programmers.co.kr/learn/courses/30/lessons/42892) | #2 | 0 | - |

</details>

<!-- algo-study:board:end -->
