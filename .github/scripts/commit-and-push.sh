#!/usr/bin/env bash
# 워크플로가 만든 변경 사항을 기본 브랜치에 커밋하고 푸시한다.
# 여러 워크플로가 동시에 밀어 넣을 수 있어 rebase 후 재시도한다.
#
#   commit-and-push.sh <브랜치> <커밋 메시지> <경로...>
set -uo pipefail

branch="$1"
message="$2"
shift 2

if [ -z "$(git status --porcelain -- "$@")" ]; then
  echo "변경 사항 없음 — 커밋을 건너뜁니다."
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -- "$@"
git commit -m "$message"

for attempt in 1 2 3 4; do
  if git pull --rebase origin "$branch"; then
    if git push origin "HEAD:$branch"; then
      echo "푸시 완료 (${attempt}번째 시도)"
      exit 0
    fi
  fi
  delay=$((2 ** attempt))
  echo "푸시 실패 — ${delay}초 후 재시도합니다."
  sleep "$delay"
done

echo "푸시에 4번 실패했습니다." >&2
exit 1
