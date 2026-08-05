/**
 * 테스트에서 쓰는 최소한의 GitHub API 모킹.
 * 실제 API 응답 모양(특히 sub_issues, issues.create의 number/id 구분)은
 * 개발 중 진짜 저장소에 대고 확인한 결과를 그대로 반영했다.
 */
export function createMockGithub() {
  const state = {
    nextNumber: 1,
    nextId: 100000,
    issues: new Map(), // number -> issue
    comments: [], // { id, issue_number, body }
    repoLabels: new Set(),
    subIssues: new Map(), // parentNumber -> [childNumber, ...]
    prFiles: [], // 테스트에서 직접 채워 넣는 가짜 PR 파일 목록
  };

  function findIssue(number) {
    const issue = state.issues.get(number);
    if (!issue) throw Object.assign(new Error(`issue #${number} not found`), { status: 404 });
    return issue;
  }

  const github = {
    _state: state,
    rest: {
      issues: {
        create: async ({ title, body }) => {
          const number = state.nextNumber++;
          const id = state.nextId++;
          const issue = { number, id, title, body, state: 'open', state_reason: null, labels: [] };
          state.issues.set(number, issue);
          return { data: { ...issue } };
        },
        update: async ({ issue_number, title, body, state: newState, state_reason }) => {
          const issue = findIssue(issue_number);
          if (title !== undefined) issue.title = title;
          if (body !== undefined) issue.body = body;
          if (newState !== undefined) issue.state = newState;
          if (state_reason !== undefined) issue.state_reason = state_reason;
          return { data: { ...issue } };
        },
        get: async ({ issue_number }) => ({ data: { ...findIssue(issue_number) } }),
        addLabels: async ({ issue_number, labels }) => {
          const issue = findIssue(issue_number);
          for (const l of labels) if (!issue.labels.includes(l)) issue.labels.push(l);
        },
        getLabel: async ({ name }) => {
          if (!state.repoLabels.has(name)) throw Object.assign(new Error('not found'), { status: 404 });
          return { data: { name } };
        },
        createLabel: async ({ name }) => {
          state.repoLabels.add(name);
        },
        createComment: async ({ issue_number, body }) => {
          const comment = { id: state.comments.length + 1, issue_number, body };
          state.comments.push(comment);
          return { data: { ...comment } };
        },
        updateComment: async ({ comment_id, body }) => {
          const c = state.comments.find((x) => x.id === comment_id);
          if (!c) throw Object.assign(new Error('not found'), { status: 404 });
          c.body = body;
          return { data: { ...c } };
        },
        listComments: async ({ issue_number }) => ({
          data: state.comments.filter((c) => c.issue_number === issue_number),
        }),
      },
      pulls: {
        listFiles: async () => ({ data: state.prFiles }),
      },
      repos: {
        listCollaborators: async () => ({ data: [] }),
      },
    },
    paginate: async (fn, params) => {
      const { data } = await fn(params);
      return data;
    },
    request: async (route, params) => {
      const [method, url] = route.split(' ');
      const isSubIssuesRoute = url === '/repos/{owner}/{repo}/issues/{issue_number}/sub_issues';
      if (isSubIssuesRoute && method === 'POST') {
        const parentNumber = params.issue_number;
        const child = [...state.issues.values()].find((i) => i.id === params.sub_issue_id);
        if (!child) throw Object.assign(new Error('sub_issue_id not found'), { status: 404 });
        if (!state.subIssues.has(parentNumber)) state.subIssues.set(parentNumber, []);
        const list = state.subIssues.get(parentNumber);
        if (!list.includes(child.number)) list.push(child.number);
        return { data: { ...findIssue(parentNumber) } };
      }
      if (isSubIssuesRoute && method === 'GET') {
        const children = (state.subIssues.get(params.issue_number) || []).map((n) => ({ ...findIssue(n) }));
        return { data: children };
      }
      throw new Error(`mock github.request: 지원하지 않는 라우트 - ${route}`);
    },
  };

  return github;
}

export function issueContext(owner, repo, issueNumber, body) {
  return { repo: { owner, repo }, payload: { issue: { number: issueNumber, body } } };
}

export function prContext(owner, repo, prNumber, author) {
  return {
    repo: { owner, repo },
    payload: {
      pull_request: { number: prNumber, user: { login: author }, html_url: `https://github.com/${owner}/${repo}/pull/${prNumber}` },
    },
  };
}

export function makeCore() {
  const outputs = {};
  const warnings = [];
  return {
    setOutput: (k, v) => (outputs[k] = v),
    setFailed: (m) => (outputs.__failed = m),
    info: () => {},
    warning: (m) => warnings.push(m),
    _outputs: outputs,
    _warnings: warnings,
  };
}
