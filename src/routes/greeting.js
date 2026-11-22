'use strict';

const team = require('../data/team');
const { VERSION } = require('../constants');

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const accessLabel = (access) =>
  access === 'public' ? 'Public (no token)' : access.length === 3 ? 'Any signed-in user' : access.join(', ');

const MOCK_USERS = [
  ['Student A', 'student', 'user-a-token'],
  ['Student B', 'student', 'user-b-token'],
  ['Maintenance staff', 'staff', 'staff-token'],
  ['Administrator', 'admin', 'admin-token'],
];

function renderGreeting({ routes, startedAt }) {
  const uptime = Math.round((Date.now() - startedAt) / 1000);

  const endpointRows = routes
    .map(
      (r) => `
        <tr>
          <td data-label="Method"><span class="method ${r.method.toLowerCase()}">${escapeHtml(r.method)}</span></td>
          <td data-label="Path"><code>${escapeHtml(r.path)}</code></td>
          <td data-label="Access">${escapeHtml(accessLabel(r.access))}</td>
          <td data-label="Description">${escapeHtml(r.summary)}</td>
        </tr>`
    )
    .join('');

  const memberCards = team.members
    .map(
      (m) => `
        <li class="card">
          <h3>${escapeHtml(m.name)}</h3>
          <p class="muted">Student ID: ${escapeHtml(m.studentId)}</p>
          <p>${escapeHtml(m.contribution)}</p>
        </li>`
    )
    .join('');

  const tokenRows = MOCK_USERS.map(
    ([name, role, token]) => `
        <tr>
          <td data-label="User">${escapeHtml(name)}</td>
          <td data-label="Role">${escapeHtml(role)}</td>
          <td data-label="Token"><code>${escapeHtml(token)}</code></td>
        </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(team.projectName)} API</title>
  <style>
    :root {
      --bg: #f4f7f5; --card: #ffffff; --text: #14211b; --muted: #55675e;
      --accent: #0f766e; --accent-soft: #d9f0ec; --border: #d6e0db;
      --get: #1a5fb4; --post: #0e7a4f; --put: #9a5b00; --delete: #b3261e;
      --code-bg: #eaf0ed;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0e1512; --card: #16211c; --text: #e7efeb; --muted: #9db1a7;
        --accent: #4fd1c0; --accent-soft: #123a35; --border: #263830;
        --get: #7fb4ff; --post: #5fd6a0; --put: #f0b45a; --delete: #ff8f86;
        --code-bg: #1d2c25;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: var(--bg); color: var(--text);
      font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    .wrap { max-width: 960px; margin: 0 auto; padding: 0 16px 48px; }
    header { padding: 40px 0 24px; }
    header h1 { margin: 0 0 8px; font-size: clamp(1.9rem, 5vw, 2.8rem); line-height: 1.15; }
    header p { margin: 0; color: var(--muted); max-width: 62ch; }
    .status {
      display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; padding: 6px 14px;
      border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 600; font-size: .95rem;
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
    section { margin-top: 36px; }
    h2 { font-size: 1.35rem; margin: 0 0 12px; }
    h3 { font-size: 1.05rem; margin: 0 0 4px; }
    p { margin: 0 0 8px; }
    .muted { color: var(--muted); font-size: .92rem; }
    .grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
    table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
    th { font-size: .85rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); background: var(--code-bg); }
    tr:last-child td { border-bottom: 0; }
    code { font: .9em ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--code-bg); padding: 2px 6px; border-radius: 6px; overflow-wrap: anywhere; }
    @media (min-width: 681px) { td:nth-child(2) code { white-space: nowrap; } }
    pre { margin: 0; padding: 14px 16px; background: var(--code-bg); border-radius: 10px; overflow-x: auto; font: .88rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .method { display: inline-block; min-width: 4.4em; text-align: center; font-weight: 700; font-size: .8rem; padding: 2px 8px; border-radius: 6px; border: 1.5px solid currentColor; }
    .method.get { color: var(--get); } .method.post { color: var(--post); }
    .method.put { color: var(--put); } .method.delete { color: var(--delete); }
    footer { margin-top: 40px; color: var(--muted); font-size: .9rem; }
    @media (max-width: 680px) {
      table, thead, tbody, tr, td { display: block; }
      thead { position: absolute; left: -9999px; }
      table { background: transparent; border: 0; }
      tr { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; margin-bottom: 12px; }
      td { border: 0; padding: 4px 0; }
      td::before { content: attr(data-label); display: block; font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Welcome to ${escapeHtml(team.projectName)}</h1>
      <p>${escapeHtml(team.description)}</p>
      <p style="margin-top:8px">${escapeHtml(team.audience)}</p>
      <div class="status"><span class="dot" aria-hidden="true"></span>API is running &middot; version ${escapeHtml(VERSION)} &middot; up ${uptime}s</div>
    </header>

    <section aria-labelledby="team">
      <h2 id="team">Team members &mdash; ${escapeHtml(team.teamName)}</h2>
      <ul class="grid">${memberCards}
      </ul>
    </section>

    <section aria-labelledby="endpoints">
      <h2 id="endpoints">Available endpoints</h2>
      <p class="muted">All paths are relative to this server. JSON endpoints return a <code>success</code> / <code>data</code> / <code>error</code> envelope.</p>
      <table>
        <thead><tr><th>Method</th><th>Path</th><th>Access</th><th>Description</th></tr></thead>
        <tbody>${endpointRows}
        </tbody>
      </table>
    </section>

    <section aria-labelledby="try">
      <h2 id="try">Try it</h2>
      <p class="muted">The prototype uses predefined mock tokens instead of real login. Send one as a bearer token.</p>
      <table>
        <thead><tr><th>User</th><th>Role</th><th>Token</th></tr></thead>
        <tbody>${tokenRows}
        </tbody>
      </table>
      <p style="margin-top:12px"></p>
      <pre>curl -H "Authorization: Bearer user-a-token" http://localhost:3000/api/v1/reports</pre>
    </section>

    <footer>
      Mock data is kept in memory and resets whenever the server restarts.
    </footer>
  </div>
</body>
</html>
`;
}

function greeting({ routeInfo, startedAt }) {
  return { status: 200, html: renderGreeting({ routes: routeInfo, startedAt }) };
}

module.exports = function greetingRoutes(P) {
  return [
    {
      method: 'GET',
      path: `${P}/greeting`,
      access: 'public',
      summary: 'This HTML page: project description, team, endpoint list and API status.',
      handler: greeting,
    },
  ];
};
