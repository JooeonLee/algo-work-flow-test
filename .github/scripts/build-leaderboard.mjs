#!/usr/bin/env node
/**
 * solutions/ 폴더를 훑어서 README.md의 현황판을 다시 그린다.
 * 워크플로에서 `node .github/scripts/build-leaderboard.mjs` 로 실행한다.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const SOLUTIONS = path.join(ROOT, 'solutions');
const README = path.join(ROOT, 'README.md');
const START = '<!-- algo-study:board:start -->';
const END = '<!-- algo-study:board:end -->';
// README.md 같은 일반 파일 안의 "#123"은 GitHub이 자동으로 링크로 바꿔주지 않는다
// (이슈/PR 댓글·본문에서만 자동 링크된다). 그래서 이슈 번호는 직접 마크다운 링크로 만든다.
const REPO_SLUG = process.env.GITHUB_REPOSITORY || null;

function issueLink(number) {
  if (!number) return '-';
  return REPO_SLUG ? `[#${number}](https://github.com/${REPO_SLUG}/issues/${number})` : `#${number}`;
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

const problems = [];
const solvedBy = new Map();

for (const week of listDirs(SOLUTIONS)) {
  if (!/^week-\d{2}$/.test(week)) continue;
  for (const problem of listDirs(path.join(SOLUTIONS, week))) {
    const problemDir = path.join(SOLUTIONS, week, problem);
    let meta = null;
    const metaFile = path.join(problemDir, '.problem.json');
    if (fs.existsSync(metaFile)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      } catch {
        meta = null;
      }
    }

    const authors = listDirs(problemDir).filter((author) =>
      fs
        .readdirSync(path.join(problemDir, author))
        .some((f) => f.endsWith('.java')),
    );

    for (const author of authors) {
      if (!solvedBy.has(author)) solvedBy.set(author, []);
      solvedBy.get(author).push(`${week}/${problem}`);
    }

    problems.push({ week, problem, meta, authors });
  }
}

const totalProblems = problems.length;

const ranking = [...solvedBy.entries()]
  .map(([author, solved]) => ({ author, count: solved.length }))
  .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));

const rankingTable = ranking.length
  ? [
      '| 순위 | 스터디원 | 푼 문제 | 진행률 |',
      '| --- | --- | --- | --- |',
      ...ranking.map((r, i) => {
        const pct = totalProblems ? Math.round((r.count / totalProblems) * 100) : 0;
        const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}`;
        return `| ${medal} | [@${r.author}](https://github.com/${r.author}) | ${r.count} / ${totalProblems} | ${pct}% |`;
      }),
    ].join('\n')
  : '_아직 제출된 풀이가 없습니다._';

const byWeek = new Map();
for (const p of problems) {
  if (!byWeek.has(p.week)) byWeek.set(p.week, []);
  byWeek.get(p.week).push(p);
}

const problemList = byWeek.size
  ? [...byWeek.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([week, list]) => {
        const rows = list.map((p) => {
          const title = p.meta
            ? `[${p.meta.platformLabel} ${p.meta.number} · ${p.meta.title}](${p.meta.url})`
            : `\`${p.problem}\``;
          const issue = issueLink(p.meta?.issue);
          const who = p.authors.length
            ? p.authors.map((a) => `[@${a}](https://github.com/${a})`).join(', ')
            : '-';
          return `| ${title} | ${issue} | ${p.authors.length} | ${who} |`;
        });
        return [
          `<details${week === [...byWeek.keys()].sort().at(-1) ? ' open' : ''}>`,
          `<summary><b>${week}</b> (${list.length}문제)</summary>`,
          '',
          '| 문제 | 이슈 | 제출 | 제출자 |',
          '| --- | --- | --- | --- |',
          ...rows,
          '',
          '</details>',
        ].join('\n');
      })
      .join('\n\n')
  : '_아직 등록된 문제가 없습니다._';

const board = [
  START,
  '',
  `> 마지막 갱신: ${new Date().toISOString().slice(0, 10)} · 등록된 문제 ${totalProblems}개`,
  '',
  '### 🏆 제출 순위',
  '',
  rankingTable,
  '',
  '### 📚 주차별 문제',
  '',
  problemList,
  '',
  END,
].join('\n');

let readme = fs.existsSync(README) ? fs.readFileSync(README, 'utf8') : '';
if (readme.includes(START) && readme.includes(END)) {
  readme = readme.replace(new RegExp(`${START}[\\s\\S]*?${END}`), board);
} else {
  readme = `${readme.trimEnd()}\n\n## 📊 스터디 현황\n\n${board}\n`;
}
fs.writeFileSync(README, readme);
console.log(`현황판 갱신 완료: 문제 ${totalProblems}개, 참여자 ${ranking.length}명`);
