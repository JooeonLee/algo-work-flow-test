import { CHECKLIST_MARKER, parseSolutionPath, readProblemMeta } from './lib.mjs';

/**
 * 풀이 PR이 머지되면 해당 문제 이슈의 체크리스트에서 작성자를 체크한다.
 * 전원이 제출을 마치면 이슈를 자동으로 닫는다.
 */
export async function run({ github, context, core }) {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const { owner, repo } = context.repo;
  const pr = context.payload.pull_request;
  const author = pr.user.login;

  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pr.number,
    per_page: 100,
  });

  const problemDirs = new Set();
  for (const file of files) {
    if (file.status === 'removed') continue;
    const parsed = parseSolutionPath(file.filename);
    if (parsed && parsed.author.toLowerCase() === author.toLowerCase()) {
      problemDirs.add(parsed.problemDir);
    }
  }

  if (!problemDirs.size) {
    core.info('풀이 파일이 없는 PR입니다. 체크리스트를 건드리지 않습니다.');
    return;
  }

  for (const dir of problemDirs) {
    const meta = readProblemMeta(workspace, dir);
    if (!meta?.issue) {
      core.warning(`${dir}에 .problem.json이 없어 이슈를 찾지 못했습니다.`);
      continue;
    }

    const comments = await github.paginate(github.rest.issues.listComments, {
      owner,
      repo,
      issue_number: meta.issue,
      per_page: 100,
    });
    const checklist = comments.find((c) => (c.body || '').includes(CHECKLIST_MARKER));
    if (!checklist) {
      core.warning(`이슈 #${meta.issue}에 체크리스트 댓글이 없습니다.`);
      continue;
    }

    const prLink = `[#${pr.number}](${pr.html_url})`;
    const lineRe = new RegExp(`^- \\[( |x)\\] @${author}\\b.*$`, 'im');
    let body = checklist.body;

    if (lineRe.test(body)) {
      body = body.replace(lineRe, `- [x] @${author} — ${prLink}`);
    } else {
      // 체크리스트에 없던 사람이 제출한 경우(중간 합류 등)에도 기록은 남긴다.
      body = body.replace(
        /(\n\n> PR이 머지되면)/,
        `\n- [x] @${author} — ${prLink}$1`,
      );
    }

    if (body !== checklist.body) {
      await github.rest.issues.updateComment({ owner, repo, comment_id: checklist.id, body });
    }

    const boxes = [...body.matchAll(/^- \[( |x)\] @/gim)].map((m) => m[1]);
    const done = boxes.filter((b) => b === 'x').length;
    const total = boxes.length;
    core.info(`이슈 #${meta.issue}: ${done}/${total} 제출 완료`);

    if (total > 0 && done === total) {
      const issue = await github.rest.issues.get({ owner, repo, issue_number: meta.issue });
      if (issue.data.state === 'open') {
        await github.rest.issues.createComment({
          owner,
          repo,
          issue_number: meta.issue,
          body: `🎉 전원(${total}명) 제출 완료! 이슈를 닫습니다.\n\n풀이 모아보기 → \`${dir}\``,
        });
        await github.rest.issues.update({
          owner,
          repo,
          issue_number: meta.issue,
          state: 'closed',
          state_reason: 'completed',
        });
      }
    }
  }
}
