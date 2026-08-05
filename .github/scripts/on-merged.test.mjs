import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { createMockGithub, issueContext, makeCore, prContext } from './mock-github.mjs';
import { run as registerRun } from './register-problem.mjs';
import { run as mergedRun } from './on-merged.mjs';

const OWNER = 'owner';
const REPO = 'repo';

let workspace;
let github;
let originalCwd;

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'algo-merged-test-'));
  fs.mkdirSync(path.join(workspace, '.github'), { recursive: true });
  fs.writeFileSync(path.join(workspace, '.github', 'study-members.yml'), 'members:\n  - alice\n  - bob\n');
  github = createMockGithub();
  originalCwd = process.cwd();
  process.chdir(workspace);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(workspace, { recursive: true, force: true });
});

function body(week, problemsBlock) {
  return ['### 주차', '', String(week), '', '### 문제 목록', '', problemsBlock].join('\n');
}

function readMeta(dir) {
  return JSON.parse(fs.readFileSync(path.join(workspace, dir, '.problem.json'), 'utf8'));
}

function writeSolution(rel) {
  fs.mkdirSync(path.join(workspace, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(workspace, rel), 'class Solution {}');
}

async function registerTwoProblems() {
  const { data: parent } = await github.rest.issues.create({ title: '[문제] week-01' });
  const b = body(
    1,
    [
      'https://school.programmers.co.kr/learn/courses/30/lessons/111 | 문제A | | |',
      'https://swexpertacademy.com/x?contestProbId=222 | 문제B | 222 | |',
    ].join('\n'),
  );
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core: makeCore() });
  return {
    parent,
    dirA: 'solutions/week-01/pgs-111',
    dirB: 'solutions/week-01/swea-222',
    metaA: readMeta('solutions/week-01/pgs-111'),
    metaB: readMeta('solutions/week-01/swea-222'),
  };
}

test('풀이 파일이 없는 PR은 체크리스트를 건드리지 않는다', async () => {
  const { metaA } = await registerTwoProblems();
  github._state.prFiles = [{ filename: 'README.md', status: 'modified' }];
  await mergedRun({ github, context: prContext(OWNER, REPO, 1, 'alice'), core: makeCore() });
  const childA = github._state.issues.get(metaA.issue);
  assert.equal(childA.state, 'open');
});

test('한 명만 제출하면 그 문제 이슈는 열려있는다', async () => {
  const { dirA, metaA } = await registerTwoProblems();
  writeSolution(`${dirA}/alice/Solution.java`);
  github._state.prFiles = [{ filename: `${dirA}/alice/Solution.java`, status: 'added' }];
  await mergedRun({ github, context: prContext(OWNER, REPO, 1, 'alice'), core: makeCore() });

  const childA = github._state.issues.get(metaA.issue);
  assert.equal(childA.state, 'open');
});

test('전원 제출하면 그 문제 이슈가 닫히지만, 다른 문제가 남아있으면 부모는 열려있는다', async () => {
  const { dirA, metaA, parent } = await registerTwoProblems();

  writeSolution(`${dirA}/alice/Solution.java`);
  github._state.prFiles = [{ filename: `${dirA}/alice/Solution.java`, status: 'added' }];
  await mergedRun({ github, context: prContext(OWNER, REPO, 1, 'alice'), core: makeCore() });

  writeSolution(`${dirA}/bob/Solution.java`);
  github._state.prFiles = [{ filename: `${dirA}/bob/Solution.java`, status: 'added' }];
  await mergedRun({ github, context: prContext(OWNER, REPO, 2, 'bob'), core: makeCore() });

  const childA = github._state.issues.get(metaA.issue);
  assert.equal(childA.state, 'closed');
  assert.equal(childA.state_reason, 'completed');

  const parentIssue = github._state.issues.get(parent.number);
  assert.equal(parentIssue.state, 'open', '다른 문제가 아직 안 끝났으면 부모는 열려있어야 한다');
});

test('모든 문제가 완료되면 부모 이슈도 자동으로 닫힌다', async () => {
  const { dirA, dirB, parent } = await registerTwoProblems();

  for (const [dir, author, prNumber] of [
    [dirA, 'alice', 1],
    [dirA, 'bob', 2],
    [dirB, 'alice', 3],
    [dirB, 'bob', 4],
  ]) {
    writeSolution(`${dir}/${author}/Solution.java`);
    github._state.prFiles = [{ filename: `${dir}/${author}/Solution.java`, status: 'added' }];
    await mergedRun({ github, context: prContext(OWNER, REPO, prNumber, author), core: makeCore() });
  }

  const parentIssue = github._state.issues.get(parent.number);
  assert.equal(parentIssue.state, 'closed');
  assert.equal(parentIssue.state_reason, 'completed');
});

test('체크리스트에 없던 사람이 제출해도 기록은 남는다', async () => {
  const { dirA, metaA } = await registerTwoProblems();
  writeSolution(`${dirA}/carol/Solution.java`);
  github._state.prFiles = [{ filename: `${dirA}/carol/Solution.java`, status: 'added' }];
  await mergedRun({ github, context: prContext(OWNER, REPO, 1, 'carol'), core: makeCore() });

  const comments = github._state.comments.filter((c) => c.issue_number === metaA.issue);
  const checklist = comments.find((c) => c.body.includes('제출 현황'));
  assert.match(checklist.body, /@carol/);
});
