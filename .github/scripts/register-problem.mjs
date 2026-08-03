import fs from 'node:fs';
import path from 'node:path';
import {
  CHECKLIST_MARKER,
  REGISTER_MARKER,
  ensureLabels,
  getMembers,
  parseIssueForm,
  platformKey,
  platformLabel,
  problemNumberFromUrl,
  problemPath,
  upsertComment,
  weekDir,
} from './lib.mjs';

/**
 * `problem` 라벨이 붙은 이슈를 읽어서
 *  1) solutions/week-XX/{platform}-{번호}/ 스캐폴딩을 만들고
 *  2) 이슈에 참여 안내 + 제출 체크리스트 댓글을 남긴다.
 * 여러 번 실행되어도 결과가 같도록(idempotent) 작성했다.
 */
export async function run({ github, context, core }) {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const issue = context.payload.issue;
  const { owner, repo } = context.repo;

  const fields = parseIssueForm(issue.body || '');
  const errors = [];

  const week = Number((fields['주차'] || '').replace(/[^0-9]/g, ''));
  if (!week || week < 1 || week > 99) errors.push('`주차`는 1~99 사이 숫자여야 합니다.');

  const pKey = platformKey(fields['플랫폼']);
  if (!pKey) errors.push('`플랫폼`은 SWEA 또는 프로그래머스여야 합니다.');

  const url = (fields['문제 링크'] || '').trim();
  if (!/^https?:\/\//.test(url)) errors.push('`문제 링크`가 올바른 URL이 아닙니다.');

  let number = (fields['문제 번호'] || '').trim();
  if (!number) number = problemNumberFromUrl(url) || '';
  if (!/^[A-Za-z0-9_]+$/.test(number)) {
    errors.push('`문제 번호`를 입력해 주세요. (프로그래머스는 링크에서 자동 추출됩니다)');
  }

  const title = (fields['문제 제목'] || '').trim();
  if (!title) errors.push('`문제 제목`을 입력해 주세요.');

  const difficulty = (fields['난이도'] || '').trim();
  const deadline = (fields['마감일'] || '').trim();

  if (errors.length) {
    await upsertComment({
      github,
      context,
      issue_number: issue.number,
      marker: REGISTER_MARKER,
      body: [
        '## ⚠️ 문제 등록에 실패했습니다',
        '',
        '아래 항목을 고치고 이슈 본문을 수정하면 자동으로 다시 시도합니다.',
        '',
        ...errors.map((e) => `- ${e}`),
      ].join('\n'),
    });
    core.setFailed(`이슈 폼 검증 실패:\n${errors.join('\n')}`);
    return;
  }

  const dir = problemPath(week, pKey, number);
  const absDir = path.join(workspace, dir);
  fs.mkdirSync(absDir, { recursive: true });

  const meta = {
    issue: issue.number,
    week,
    platform: pKey,
    platformLabel: platformLabel(pKey),
    number,
    title,
    url,
    difficulty: difficulty || null,
    deadline: deadline || null,
  };
  fs.writeFileSync(path.join(absDir, '.problem.json'), `${JSON.stringify(meta, null, 2)}\n`);

  const members = await getMembers({ github, context, workspace });

  const readme = [
    `# ${platformLabel(pKey)} ${number} · ${title}`,
    '',
    `- 문제 링크: ${url}`,
    `- 주차: ${weekDir(week)}`,
    difficulty ? `- 난이도: ${difficulty}` : null,
    deadline ? `- 마감일: ${deadline}` : null,
    `- 논의 이슈: #${issue.number}`,
    '',
    '## 제출 방법',
    '',
    '```bash',
    `git switch -c solve/${weekDir(week)}-${pKey}-${number}-$(git config user.name)`,
    `mkdir -p ${dir}/<본인-github-아이디>`,
    `# ${dir}/<본인-github-아이디>/Solution.java 에 풀이 작성`,
    '```',
    '',
    '- 폴더 이름은 **본인 GitHub 아이디**와 정확히 같아야 합니다.',
    '- 파일은 `.java`만 올립니다. 클래스명 충돌을 막기 위해 사람마다 폴더를 분리합니다.',
    '- 다른 사람 폴더는 건드리지 않습니다. (PR 검사에서 막힙니다)',
    '',
    '## 제출 현황',
    '',
    ...members.map((m) => `- [ ] @${m}`),
  ]
    .filter((line) => line !== null)
    .join('\n');
  fs.writeFileSync(path.join(absDir, 'README.md'), `${readme}\n`);

  // 사람마다 빈 폴더는 만들지 않는다. git이 빈 디렉터리를 추적하지 못하기도 하고,
  // PR에서 폴더가 새로 생기는 편이 diff가 읽기 좋다.

  await ensureLabels({
    github,
    context,
    labels: [
      { name: 'problem', color: '1d76db', description: '알고리즘 문제 등록 이슈' },
      { name: weekDir(week), color: '5319e7', description: '스터디 주차' },
      { name: platformLabel(pKey), color: 'c2e0c6', description: '문제 출처' },
    ],
  });
  await github.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issue.number,
    labels: ['problem', weekDir(week), platformLabel(pKey)],
  });

  await upsertComment({
    github,
    context,
    issue_number: issue.number,
    marker: REGISTER_MARKER,
    body: [
      `## 📌 ${platformLabel(pKey)} ${number} · ${title}`,
      '',
      `문제 폴더를 만들었습니다 → [\`${dir}\`](https://github.com/${owner}/${repo}/tree/${context.payload.repository.default_branch}/${dir})`,
      '',
      '### 참여 방법',
      '',
      '```bash',
      'git pull origin ' + context.payload.repository.default_branch,
      `git switch -c solve/${weekDir(week)}-${pKey}-${number}-<본인-아이디>`,
      `mkdir -p ${dir}/<본인-아이디>`,
      `# ${dir}/<본인-아이디>/Solution.java 작성 후`,
      'git add . && git commit -m "solve: ' + platformLabel(pKey) + ' ' + number + '" && git push -u origin HEAD',
      '```',
      '',
      `PR을 열면 경로 규칙과 컴파일을 자동으로 검사하고, 머지되면 아래 체크리스트가 갱신됩니다.`,
      deadline ? `\n⏰ 마감일: **${deadline}**` : '',
    ].join('\n'),
  });

  await upsertComment({
    github,
    context,
    issue_number: issue.number,
    marker: CHECKLIST_MARKER,
    body: [
      '## ✅ 제출 현황',
      '',
      ...members.map((m) => `- [ ] @${m}`),
      '',
      '> PR이 머지되면 자동으로 체크됩니다. 전원 제출이 끝나면 이슈가 자동으로 닫힙니다.',
    ].join('\n'),
  });

  core.setOutput('problem_dir', dir);
  core.setOutput('title', `${platformLabel(pKey)} ${number} ${title}`);
}
