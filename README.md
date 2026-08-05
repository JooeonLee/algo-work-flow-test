# 알고리즘 스터디

문제 링크를 이슈로 등록하면(여러 개 한 번에 가능), 문제마다 하위 이슈가 자동으로 만들어지고
풀이 폴더 생성부터 제출 검사·현황 집계까지 GitHub Actions가 처리합니다.

- 플랫폼: SWEA, 프로그래머스
- 언어: Java
- 구조: 주차별 폴더

## 어떻게 돌아가나요

```
① 문제 등록 (Issue)              ② 풀이 제출 (PR)              ③ 머지
──────────────────────          ─────────────────────────    ──────────────────────
주차 이슈에 링크 입력       →    solutions/week-01/           →  그 문제의 하위 이슈 체크리스트 체크
(한 줄에 하나, 여러 개 가능)       swea-1859/{내아이디}/           전원 제출 시 하위 이슈 자동 닫힘
   ↓ 자동                             ↓ 자동                        ↓ 자동
문제마다 하위 이슈 생성           경로 규칙 검사                 README 현황판 갱신
(Sub-issues로 주차 이슈에 연결)    javac 컴파일 검사              하위 이슈 전부 닫히면
문제별 폴더 + README 생성        주차/플랫폼 라벨 부여            주차 이슈도 자동 닫힘
문제별 제출 체크리스트 댓글
```

## 참여 방법

### 1. 문제 등록 (누구나)

[Issues → New issue → 📌 알고리즘 문제 등록](../../issues/new?template=problem.yml)에서
`주차`와 `문제 목록`을 입력하고 등록합니다. `문제 목록`은 한 줄에 문제 하나, `|`로 구분해서 여러 개를 한 번에 등록할 수 있습니다.

```
링크 | 제목 | 번호(선택) | 난이도(선택) | 마감일(선택)
```

> 플랫폼은 링크 도메인으로 자동 판별합니다.
> SWEA는 링크에 문제 번호가 없어서 `번호`를 직접 입력해야 합니다.
> 프로그래머스는 비워 두면 링크에서 자동으로 추출합니다.

이 이슈가 **주차 이슈(부모)**가 되고, 문제마다 **하위 이슈(자식)**가 하나씩 만들어져
[Sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues)로 연결됩니다.
잠시 뒤 각 하위 이슈에 문제 폴더 경로와 참여 방법이 댓글로 달립니다.

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

리뷰어 승인 후 머지하면 해당 문제의 하위 이슈 체크리스트에 자동으로 체크되고,
전원이 제출하면 그 하위 이슈가 닫힙니다. 주차 이슈에 연결된 하위 이슈가 모두 닫히면
주차 이슈도 자동으로 닫힙니다.

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

> 마지막 갱신: 2026-08-05 · 등록된 문제 2개

### 🏆 제출 순위

| 순위 | 스터디원 | 푼 문제 | 진행률 |
| --- | --- | --- | --- |
| 🥇 | [@JooeonLee](https://github.com/JooeonLee) | 2 / 2 | 100% |

### 📚 주차별 문제

<details open>
<summary><b>week-00</b> (2문제)</summary>

| 문제 | 이슈 | 제출 | 제출자 |
| --- | --- | --- | --- |
| [프로그래머스 12912 · 두 정수 사이의 합](https://school.programmers.co.kr/learn/courses/30/lessons/12912) | [#18](https://github.com/JooeonLee/algo-work-flow-test/issues/18) | 1 | [@JooeonLee](https://github.com/JooeonLee) |
| [프로그래머스 12937 · 짝수와 홀수](https://school.programmers.co.kr/learn/courses/30/lessons/12937) | [#17](https://github.com/JooeonLee/algo-work-flow-test/issues/17) | 1 | [@JooeonLee](https://github.com/JooeonLee) |

</details>

<!-- algo-study:board:end -->
