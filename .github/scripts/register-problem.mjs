import fs from 'node:fs';
import path from 'node:path';
import {
  REGISTER_MARKER,
  checklistMarker,
  ensureLabels,
  findProblemDirsByParentIssue,
  getMembers,
  parseIssueForm,
  parseProblemLine,
  parseProgrammersTitle,
  platformLabel,
  problemNumberFromUrl,
  problemPath,
  readProblemMeta,
  upsertComment,
  urlPlatformKey,
  weekDir,
} from './lib.mjs';

/**
 * 프로그래머스는 로그인 없이도 <title>에 문제 제목이 그대로 내려오길래,
 * 제목을 안 적으면 페이지에서 긁어온다. 실패하면(느림/구조 변경/네트워크 오류) null —
 * 호출 쪽에서 "제목을 입력해 주세요" 에러로 안전하게 떨어진다.
 */
async function fetchProgrammersTitle(url, fetchImpl) {
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; algo-study-bot)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return parseProgrammersTitle(await res.text());
  } catch {
    return null;
  }
}

function childBody({ pKey, number, title, url, week, difficulty, deadline, parentIssueNumber }) {
  return [
    `# ${platformLabel(pKey)} ${number} · ${title}`,
    '',
    `- 문제 링크: ${url}`,
    `- 주차: ${weekDir(week)}`,
    difficulty ? `- 난이도: ${difficulty}` : null,
    deadline ? `- 마감일: ${deadline}` : null,
    `- 상위 이슈: #${parentIssueNumber}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/**
 * `problem` 라벨이 붙은 이슈(=주차 이슈)를 읽어서, "문제 목록"의 줄마다
 *  1) 문제 전용 자식 이슈를 만들고 (Sub-issues API로 주차 이슈에 연결)
 *  2) solutions/week-XX/{platform}-{번호}/ 스캐폴딩 + 제출 체크리스트 댓글(자식 이슈에)을 만든다.
 * 여러 번 실행되어도 결과가 같도록(idempotent) 작성했다 — 같은 줄을 다시 등록하면
 * 새 자식 이슈를 또 만들지 않고 기존 자식 이슈를 갱신한다.
 */
export async function run({ github, context, core, fetchImpl = fetch }) {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const parentIssue = context.payload.issue;
  const { owner, repo } = context.repo;

  const fields = parseIssueForm(parentIssue.body || '');
  const errors = [];

  const weekRaw = (fields['주차'] || '').trim();
  const weekValid = /^\d+$/.test(weekRaw) && Number(weekRaw) <= 99;
  const week = weekValid ? Number(weekRaw) : NaN;
  if (!weekValid) errors.push('`주차`는 0~99 사이 숫자여야 합니다. (0은 온보딩/오리엔테이션 주차로 씁니다)');

  const lines = (fields['문제 목록'] || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) {
    errors.push('`문제 목록`에 최소 한 줄 이상 입력해 주세요. (형식: 링크 | 제목 | 번호(선택) | 난이도(선택) | 마감일(선택))');
  }

  // 1) 줄마다 개별 검증
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const { url, title: rawTitle, number: rawNumber, difficulty, deadline } = parseProblemLine(line);
    const lineErrors = [];

    if (!/^https?:\/\//.test(url)) lineErrors.push('링크가 올바른 URL이 아닙니다');

    const pKey = urlPlatformKey(url);
    if (!pKey) lineErrors.push('SWEA 또는 프로그래머스 링크만 지원합니다');

    let number = rawNumber;
    if (!number) number = problemNumberFromUrl(url) || '';
    if (!/^[A-Za-z0-9_]+$/.test(number)) {
      lineErrors.push('번호를 입력해 주세요 (SWEA는 필수, 프로그래머스는 링크에서 자동 추출됩니다)');
    }

    let title = rawTitle;
    if (!title && weekValid && pKey && /^[A-Za-z0-9_]+$/.test(number)) {
      // 같은 부모 이슈가 이미 등록해 둔 문제라면, 네트워크를 또 타지 않고 기존 제목을 그대로 쓴다.
      const existing = readProblemMeta(workspace, problemPath(week, pKey, number));
      if (existing?.parentIssue === parentIssue.number) title = existing.title;
    }
    if (!title && pKey === 'pgs') {
      title = (await fetchProgrammersTitle(url, fetchImpl)) || '';
    }
    if (!title) {
      lineErrors.push(
        pKey === 'pgs'
          ? '제목을 자동으로 가져오지 못했습니다. 직접 입력해 주세요.'
          : '제목을 입력해 주세요',
      );
    }

    if (lineErrors.length) {
      errors.push(`${i + 1}번째 줄 (\`${line}\`): ${lineErrors.join(' / ')}`);
      continue;
    }

    items.push({ line: i + 1, pKey, number, url, title, difficulty, deadline });
  }

  // 2) 같은 이슈 안에서 문제가 중복되지 않는지 검사
  if (weekValid) {
    const seen = new Map();
    for (const item of items) {
      const key = `${item.pKey}-${item.number}`;
      if (seen.has(key)) {
        errors.push(
          `${seen.get(key)}번째 줄과 ${item.line}번째 줄이 같은 문제(${platformLabel(item.pKey)} ${item.number})를 가리킵니다.`,
        );
      } else {
        seen.set(key, item.line);
      }
    }
  }

  // 3) 이미 존재하는 문제인지 확인한다.
  //    같은 부모 이슈가 등록한 문제면 재실행(idempotent)으로 보고 기존 자식 이슈를 재사용하고,
  //    다른 이슈가 등록한 문제면 중복으로 보고 거부한다.
  const dirsByItem = new Map();
  const existingByItem = new Map();
  if (weekValid) {
    for (const item of items) {
      const dir = problemPath(week, item.pKey, item.number);
      dirsByItem.set(item, dir);
      const existingMeta = readProblemMeta(workspace, dir);
      if (existingMeta) {
        if (existingMeta.parentIssue !== parentIssue.number) {
          errors.push(
            `${item.line}번째 줄: 이미 이슈 #${existingMeta.parentIssue ?? existingMeta.issue}에서 같은 문제(${weekDir(week)}, ${platformLabel(item.pKey)} ${item.number})를 등록했습니다.`,
          );
        } else {
          existingByItem.set(item, existingMeta);
        }
      }
    }
  }

  if (errors.length) {
    await upsertComment({
      github,
      context,
      issue_number: parentIssue.number,
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

  // 4) 이 부모 이슈가 예전에 만든 문제 중, 이번 목록에서 빠진 것을 정리한다.
  //    제출된 풀이가 없으면 폴더를 지우고 자식 이슈도 닫는다. 풀이가 있으면 건드리지 않고 안내만 한다.
  const newDirs = new Set([...dirsByItem.values()]);
  const removedDirs = [];
  const keptDirs = [];
  for (const oldDir of findProblemDirsByParentIssue(workspace, parentIssue.number)) {
    if (newDirs.has(oldDir)) continue;
    const oldMeta = readProblemMeta(workspace, oldDir);
    const absOld = path.join(workspace, oldDir);
    const hasSubmissions = fs
      .readdirSync(absOld, { withFileTypes: true })
      .some((e) => e.isDirectory() && !e.name.startsWith('.'));

    if (hasSubmissions) {
      keptDirs.push(oldDir);
      continue;
    }

    fs.rmSync(absOld, { recursive: true, force: true });
    removedDirs.push(oldDir);
    if (oldMeta?.issue) {
      try {
        await github.rest.issues.createComment({
          owner,
          repo,
          issue_number: oldMeta.issue,
          body: '상위 이슈의 문제 목록에서 빠져 이 이슈를 자동으로 닫습니다.',
        });
        await github.rest.issues.update({
          owner,
          repo,
          issue_number: oldMeta.issue,
          state: 'closed',
          state_reason: 'not_planned',
        });
      } catch (err) {
        core.warning(`이슈 #${oldMeta.issue}를 정리하지 못했습니다: ${err.message}`);
      }
    }
  }

  const members = await getMembers({ github, context, workspace });
  const parentLabels = new Set(['problem', weekDir(week)]);
  const created = [];

  // 5) 문제별 자식 이슈 + 스캐폴딩 생성/갱신
  for (const item of items) {
    const { pKey, number, url, title, difficulty, deadline } = item;
    const dir = dirsByItem.get(item);
    const existingMeta = existingByItem.get(item);
    parentLabels.add(platformLabel(pKey));

    const title_ = `[문제] ${platformLabel(pKey)} ${number} · ${title}`;
    const body_ = childBody({ pKey, number, title, url, week, difficulty, deadline, parentIssueNumber: parentIssue.number });

    let childNumber;
    let isNew = false;

    if (existingMeta) {
      // 같은 부모 이슈가 다시 등록한 것 — 기존 자식 이슈 내용만 갱신한다.
      childNumber = existingMeta.issue;
      await github.rest.issues.update({ owner, repo, issue_number: childNumber, title: title_, body: body_ });
    } else {
      isNew = true;
      const { data: child } = await github.rest.issues.create({ owner, repo, title: title_, body: body_ });
      childNumber = child.number;

      // Sub-issues API: 부모 이슈에 방금 만든 자식 이슈를 연결한다. (sub_issue_id는 이슈 번호가 아니라 내부 id)
      await github.request('POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues', {
        owner,
        repo,
        issue_number: parentIssue.number,
        sub_issue_id: child.id,
      });
    }

    await ensureLabels({
      github,
      context,
      labels: [
        { name: 'sub-problem', color: '0e8a16', description: '부모(주차) 이슈에 속한 개별 문제' },
        { name: weekDir(week), color: '5319e7', description: '스터디 주차' },
        { name: platformLabel(pKey), color: 'c2e0c6', description: '문제 출처' },
      ],
    });
    await github.rest.issues.addLabels({
      owner,
      repo,
      issue_number: childNumber,
      labels: ['sub-problem', weekDir(week), platformLabel(pKey)],
    });

    const absDir = path.join(workspace, dir);
    fs.mkdirSync(absDir, { recursive: true });

    const meta = {
      issue: childNumber,
      parentIssue: parentIssue.number,
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

    const readme = [
      `# ${platformLabel(pKey)} ${number} · ${title}`,
      '',
      `- 문제 링크: ${url}`,
      `- 주차: ${weekDir(week)}`,
      difficulty ? `- 난이도: ${difficulty}` : null,
      deadline ? `- 마감일: ${deadline}` : null,
      `- 논의 이슈: [#${childNumber}](https://github.com/${owner}/${repo}/issues/${childNumber}) (상위 이슈: [#${parentIssue.number}](https://github.com/${owner}/${repo}/issues/${parentIssue.number}))`,
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

    await upsertComment({
      github,
      context,
      issue_number: childNumber,
      marker: checklistMarker(dir),
      body: [
        `## ✅ ${platformLabel(pKey)} ${number} · ${title} 제출 현황`,
        '',
        ...members.map((m) => `- [ ] @${m}`),
        '',
        '> PR이 머지되면 자동으로 체크됩니다. 전원 제출이 끝나면 이 이슈가 자동으로 닫힙니다.',
      ].join('\n'),
    });

    created.push({ ...item, dir, childNumber, isNew });
  }

  await ensureLabels({
    github,
    context,
    labels: [...parentLabels].map((name) => ({
      name,
      color: name === 'problem' ? '1d76db' : name.startsWith('week-') ? '5319e7' : 'c2e0c6',
      description: name === 'problem' ? '알고리즘 문제 등록 이슈' : name.startsWith('week-') ? '스터디 주차' : '문제 출처',
    })),
  });
  await github.rest.issues.addLabels({ owner, repo, issue_number: parentIssue.number, labels: [...parentLabels] });

  // 6) 부모 이슈에 등록 요약 댓글
  const table = created
    .map((c) => `| ${c.isNew ? '🆕 ' : ''}#${c.childNumber} ${platformLabel(c.pKey)} ${c.number} · ${c.title} | ${c.deadline || '-'} |`)
    .join('\n');

  await upsertComment({
    github,
    context,
    issue_number: parentIssue.number,
    marker: REGISTER_MARKER,
    body: [
      `## 📌 ${weekDir(week)} 문제 ${created.length}개 등록 완료`,
      '',
      '| 문제 (하위 이슈) | 마감일 |',
      '| --- | --- |',
      table,
      '',
      '### 참여 방법',
      '',
      '각 문제 이슈에 폴더 경로와 참여 방법이 안내돼 있습니다. PR을 열면 경로 규칙과 컴파일을 자동으로 검사하고,',
      '머지되면 해당 문제 이슈의 체크리스트가 갱신됩니다. 문제 하나를 전원이 제출하면 그 문제 이슈가 닫히고,',
      '이 이슈에 연결된 모든 문제가 닫히면 이 이슈도 자동으로 닫힙니다.',
      removedDirs.length
        ? `\n🧹 목록에서 빠진 문제 정리: ${removedDirs.map((d) => `\`${d}\``).join(', ')} (제출된 풀이가 없어 폴더 삭제 + 하위 이슈를 닫았습니다)`
        : '',
      keptDirs.length
        ? `\n⚠️ 이전 폴더 ${keptDirs.map((d) => `\`${d}\``).join(', ')}에 제출된 풀이가 있어 자동으로 지우지 않았습니다. 필요하면 PR로 직접 정리해 주세요.`
        : '',
    ].join('\n'),
  });

  core.setOutput('problem_dir', created.map((c) => c.dir).join(' '));
  core.setOutput(
    'title',
    created.length === 1
      ? `${platformLabel(created[0].pKey)} ${created[0].number} ${created[0].title}`
      : `${weekDir(week)} 문제 ${created.length}개`,
  );
}
