import fs from 'node:fs';
import path from 'node:path';

export const SOLUTIONS_ROOT = 'solutions';
export const CHECKLIST_MARKER = '<!-- algo-study:checklist -->';
export const REGISTER_MARKER = '<!-- algo-study:registered -->';
export const REVIEW_MARKER = '<!-- algo-study:submission-check -->';

/**
 * GitHub 이슈 폼(issue form)이 만들어내는 마크다운 본문을 { 라벨: 값 } 으로 변환한다.
 * 본문은 "### 필드명\n\n값" 블록이 반복되는 형태다.
 */
export function parseIssueForm(body = '') {
  const fields = {};
  const blocks = body.replace(/\r\n/g, '\n').split(/^###[ \t]+/m).slice(1);
  for (const block of blocks) {
    const nl = block.indexOf('\n');
    if (nl === -1) continue;
    const key = block.slice(0, nl).trim();
    const value = block.slice(nl + 1).trim();
    fields[key] = value === '_No response_' ? '' : value;
  }
  return fields;
}

export function platformKey(raw = '') {
  const v = raw.trim().toLowerCase();
  if (v.includes('swea') || v.includes('sw expert')) return 'swea';
  if (v.includes('프로그래머스') || v.includes('programmers')) return 'pgs';
  return null;
}

export function platformLabel(key) {
  return key === 'swea' ? 'SWEA' : key === 'pgs' ? '프로그래머스' : key;
}

/** 프로그래머스 링크에서는 문제 번호를 뽑아낼 수 있다. SWEA 링크는 해시라 불가능. */
export function problemNumberFromUrl(url = '') {
  const pgs = url.match(/lessons\/(\d+)/);
  if (pgs) return pgs[1];
  return null;
}

export function weekDir(week) {
  return `week-${String(week).padStart(2, '0')}`;
}

export function problemDir(pKey, number) {
  return `${pKey}-${number}`;
}

/** solutions/week-01/swea-1859 */
export function problemPath(week, pKey, number) {
  return path.posix.join(SOLUTIONS_ROOT, weekDir(week), problemDir(pKey, number));
}

/**
 * solutions/week-01/swea-1859/JooeonLee/Solution.java 형태의 경로를 해석한다.
 * 규칙에 맞지 않으면 null.
 */
export function parseSolutionPath(filePath) {
  const m = filePath
    .replace(/\\/g, '/')
    .match(/^solutions\/week-(\d{2})\/([a-z]+)-([A-Za-z0-9_]+)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const [, week, pKey, number, author, rest] = m;
  return {
    week: Number(week),
    weekDir: `week-${week}`,
    platform: pKey,
    number,
    author,
    file: rest,
    dir: `solutions/week-${week}/${pKey}-${number}/${author}`,
    problemDir: `solutions/week-${week}/${pKey}-${number}`,
  };
}

/** .github/study-members.yml 의 members 목록. 없으면 레포 콜라보레이터로 대체. */
export async function getMembers({ github, context, workspace = process.cwd() }) {
  const file = path.join(workspace, '.github', 'study-members.yml');
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8');
    const members = raw
      .split('\n')
      .map((line) => line.match(/^\s*-\s*([A-Za-z0-9][A-Za-z0-9-]*)\s*(?:#.*)?$/))
      .filter(Boolean)
      .map((m) => m[1]);
    if (members.length) return members;
  }
  const { owner, repo } = context.repo;
  const collaborators = await github.paginate(github.rest.repos.listCollaborators, {
    owner,
    repo,
    per_page: 100,
  });
  return collaborators.map((c) => c.login).filter((login) => !login.endsWith('[bot]'));
}

/** 마커가 들어간 댓글이 이미 있으면 수정하고, 없으면 새로 만든다. */
export async function upsertComment({ github, context, issue_number, marker, body }) {
  const { owner, repo } = context.repo;
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number,
    per_page: 100,
  });
  const existing = comments.find((c) => (c.body || '').includes(marker));
  const full = `${marker}\n${body}`;
  if (existing) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body: full });
    return { ...existing, body: full, updated: true };
  }
  const { data } = await github.rest.issues.createComment({ owner, repo, issue_number, body: full });
  return { ...data, updated: false };
}

/** 라벨이 없으면 만들고 붙인다. addLabels 만 쓰면 색이 임의로 정해져서 미리 만든다. */
export async function ensureLabels({ github, context, labels }) {
  const { owner, repo } = context.repo;
  for (const { name, color, description } of labels) {
    try {
      await github.rest.issues.getLabel({ owner, repo, name });
    } catch (err) {
      if (err.status !== 404) throw err;
      await github.rest.issues.createLabel({ owner, repo, name, color, description });
    }
  }
}

export function readProblemMeta(workspace, problemDirPath) {
  const file = path.join(workspace, problemDirPath, '.problem.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}
