import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { createMockGithub, issueContext, makeCore } from './mock-github.mjs';
import { run as registerRun } from './register-problem.mjs';

const OWNER = 'owner';
const REPO = 'repo';

let workspace;
let github;
let originalCwd;

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'algo-register-test-'));
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

test('주차 0(온보딩)도 유효하다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제] week-00' });
  const b = body(0, 'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A | | |');
  const core = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core });
  assert.equal(core._outputs.__failed, undefined);
  assert.equal(fs.existsSync(path.join(workspace, 'solutions/week-00/pgs-111')), true);
});

test('주차를 비워두면(빈 문자열이 0으로 잘못 파싱되지 않고) 여전히 실패한다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const b = body('', 'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A | | |');
  const core = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core });
  assert.ok(core._outputs.__failed);
  assert.match(core._outputs.__failed, /주차/);
});

test('문제 2개를 등록하면 자식 이슈 2개가 생기고 부모에 sub-issue로 연결된다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제] week-01' });
  const b = body(
    1,
    [
      'https://school.programmers.co.kr/learn/courses/30/lessons/111 | 문제A | | Lv.2 |',
      'https://swexpertacademy.com/x?contestProbId=222 | 문제B | 222 | D3 |',
    ].join('\n'),
  );

  const core = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core });

  assert.equal(core._outputs.__failed, undefined);

  const metaA = readMeta('solutions/week-01/pgs-111');
  const metaB = readMeta('solutions/week-01/swea-222');
  assert.equal(metaA.parentIssue, parent.number);
  assert.equal(metaB.parentIssue, parent.number);
  assert.notEqual(metaA.issue, metaB.issue);

  const children = github._state.subIssues.get(parent.number) ?? [];
  assert.deepEqual(children.sort(), [metaA.issue, metaB.issue].sort());

  const childIssueA = github._state.issues.get(metaA.issue);
  assert.equal(childIssueA.labels.includes('problem'), false, '자식 이슈는 problem 라벨을 달지 않는다');
  assert.ok(childIssueA.labels.includes('sub-problem'));

  const parentIssue = github._state.issues.get(parent.number);
  assert.ok(parentIssue.labels.includes('problem'));
});

test('문제 폴더 README.md의 이슈 참조는 클릭 가능한 마크다운 링크여야 한다 (README 같은 일반 파일에서는 "#N"이 자동 링크되지 않는다)', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const b = body(1, 'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A | | |');
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core: makeCore() });

  const meta = readMeta('solutions/week-01/pgs-111');
  const readme = fs.readFileSync(path.join(workspace, 'solutions/week-01/pgs-111', 'README.md'), 'utf8');
  assert.match(readme, new RegExp(`\\[#${meta.issue}\\]\\(https://github\\.com/${OWNER}/${REPO}/issues/${meta.issue}\\)`));
  assert.match(readme, new RegExp(`\\[#${parent.number}\\]\\(https://github\\.com/${OWNER}/${REPO}/issues/${parent.number}\\)`));
});

test('프로그래머스 링크만 있고 제목이 없으면 페이지에서 제목을 가져온다 (파이프도 필요 없다)', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const b = body(1, 'https://school.programmers.co.kr/learn/courses/30/lessons/12937');
  const fetchCalls = [];
  const fetchImpl = async (url) => {
    fetchCalls.push(url);
    return { ok: true, text: async () => '<title>코딩테스트 연습 - 짝수와 홀수 | 프로그래머스 스쿨</title>' };
  };
  const core = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core, fetchImpl });

  assert.equal(core._outputs.__failed, undefined);
  assert.equal(fetchCalls.length, 1);
  const meta = readMeta('solutions/week-01/pgs-12937');
  assert.equal(meta.title, '짝수와 홀수');
});

test('프로그래머스 제목 자동 추출이 실패하면 직접 입력하라는 에러로 떨어진다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const b = body(1, 'https://school.programmers.co.kr/learn/courses/30/lessons/12937');
  const fetchImpl = async () => ({ ok: false });
  const core = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core, fetchImpl });
  assert.ok(core._outputs.__failed);
  assert.match(core._outputs.__failed, /제목을 자동으로 가져오지 못했습니다/);
});

test('SWEA는 제목이 없으면 자동 추출을 시도하지 않고 바로 실패한다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const b = body(1, 'https://swexpertacademy.com/x?contestProbId=1 | | 1 | |');
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    return { ok: true, text: async () => '' };
  };
  const core = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core, fetchImpl });
  assert.ok(core._outputs.__failed);
  assert.equal(fetchCalled, false);
});

test('이미 등록된 프로그래머스 문제를 제목 없이 재등록하면 네트워크 대신 기존 제목을 재사용한다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const withTitle = body(1, 'https://school.programmers.co.kr/learn/courses/30/lessons/12937 | 짝수와 홀수 | | |');
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, withTitle), core: makeCore() });

  const withoutTitle = body(1, 'https://school.programmers.co.kr/learn/courses/30/lessons/12937');
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    return { ok: true, text: async () => '<title>코딩테스트 연습 - 다른제목 | 프로그래머스 스쿨</title>' };
  };
  const core = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, withoutTitle), core, fetchImpl });

  assert.equal(core._outputs.__failed, undefined);
  assert.equal(fetchCalled, false, '이미 아는 문제는 다시 네트워크를 타면 안 된다');
  const meta = readMeta('solutions/week-01/pgs-12937');
  assert.equal(meta.title, '짝수와 홀수');
});

test('지원하지 않는 플랫폼 링크는 등록이 실패한다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const bad = body(1, 'https://leetcode.com/problems/two-sum | 지원안함 | 1 | | ');
  const core = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, bad), core });
  assert.ok(core._outputs.__failed);
  assert.match(core._outputs.__failed, /SWEA 또는 프로그래머스/);
});

test('SWEA 링크인데 번호를 안 적으면 실패한다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const b = body(1, 'https://swexpertacademy.com/x?contestProbId=1 | 번호없음 | | |');
  const core = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core });
  assert.ok(core._outputs.__failed);
  assert.match(core._outputs.__failed, /번호를 입력해 주세요/);
});

test('같은 이슈 안에서 같은 문제를 두 번 적으면 실패한다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const b = body(
    1,
    [
      'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A | | |',
      'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A-중복 | | |',
    ].join('\n'),
  );
  const core = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core });
  assert.ok(core._outputs.__failed);
  assert.match(core._outputs.__failed, /같은 문제/);
});

test('다른 부모 이슈가 이미 등록한 문제는 등록이 거부된다', async () => {
  const { data: parent1 } = await github.rest.issues.create({ title: '[문제] 1' });
  const b1 = body(1, 'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A | | |');
  await registerRun({ github, context: issueContext(OWNER, REPO, parent1.number, b1), core: makeCore() });

  const { data: parent2 } = await github.rest.issues.create({ title: '[문제] 2' });
  const b2 = body(1, 'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A-다른이슈 | | |');
  const core2 = makeCore();
  await registerRun({ github, context: issueContext(OWNER, REPO, parent2.number, b2), core: core2 });
  assert.ok(core2._outputs.__failed);
  assert.match(core2._outputs.__failed, /이미 이슈/);
});

test('같은 부모 이슈가 같은 줄로 재실행하면 자식 이슈를 재사용한다 (idempotent)', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const b = body(1, 'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A | | |');

  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core: makeCore() });
  const meta1 = readMeta('solutions/week-01/pgs-111');

  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, b), core: makeCore() });
  const meta2 = readMeta('solutions/week-01/pgs-111');

  assert.equal(meta1.issue, meta2.issue);
  const children = github._state.subIssues.get(parent.number) ?? [];
  assert.equal(children.length, 1, '재실행해도 sub-issue가 중복으로 늘어나면 안 된다');
});

test('목록에서 줄을 빼면: 제출물이 없으면 폴더 삭제 + 자식 이슈를 not_planned로 닫는다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const bV1 = body(
    1,
    [
      'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A | | |',
      'https://school.programmers.co.kr/learn/courses/30/lessons/222 | B | | |',
    ].join('\n'),
  );
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, bV1), core: makeCore() });
  const metaB = readMeta('solutions/week-01/pgs-222');

  const bV2 = body(1, 'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A | | |');
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, bV2), core: makeCore() });

  assert.equal(fs.existsSync(path.join(workspace, 'solutions/week-01/pgs-222')), false);
  const closedChild = github._state.issues.get(metaB.issue);
  assert.equal(closedChild.state, 'closed');
  assert.equal(closedChild.state_reason, 'not_planned');
});

test('목록에서 줄을 빼도 제출물이 있으면 폴더를 지우지 않는다', async () => {
  const { data: parent } = await github.rest.issues.create({ title: '[문제]' });
  const bV1 = body(
    1,
    [
      'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A | | |',
      'https://school.programmers.co.kr/learn/courses/30/lessons/222 | B | | |',
    ].join('\n'),
  );
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, bV1), core: makeCore() });

  // B 폴더에 제출물이 있다고 가정
  const dirB = path.join(workspace, 'solutions/week-01/pgs-222', 'alice');
  fs.mkdirSync(dirB, { recursive: true });
  fs.writeFileSync(path.join(dirB, 'Solution.java'), 'class Solution {}');

  const bV2 = body(1, 'https://school.programmers.co.kr/learn/courses/30/lessons/111 | A | | |');
  await registerRun({ github, context: issueContext(OWNER, REPO, parent.number, bV2), core: makeCore() });

  assert.equal(fs.existsSync(path.join(workspace, 'solutions/week-01/pgs-222')), true);
});
