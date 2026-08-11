#!/usr/bin/env node
// Generates assets/svg/recent-activity.svg from the GitHub Events API.
// Uses only Node built-ins (fetch is available in Node 18+).

import { writeFileSync } from "node:fs";

const USER = process.env.GH_USER || "Emmraan";
const TOKEN = process.env.GITHUB_TOKEN || "";
const MAX_ROWS = 5;
const OUT = "assets/svg/recent-activity.svg";

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function eventLabel(e) {
  const repo = e.repo ? e.repo.name : "unknown/repo";
  const [owner, name] = repo.split("/");
  switch (e.type) {
    case "PushEvent": {
      const size =
        Number.isFinite(e.payload && e.payload.size) ? e.payload.size
        : Array.isArray(e.payload && e.payload.commits) ? e.payload.commits.length
        : null;
      const count = size === null ? "" : `${size} `;
      return { icon: "⬆️", color: "#00D9FF", text: `Pushed ${count}commit(s) to <b>${owner}/${name}</b>` };
    }
    case "WatchEvent":
      return { icon: "⭐", color: "#FFD700", text: `Starred <b>${owner}/${name}</b>` };
    case "ForkEvent":
      return { icon: "🍴", color: "#FF00FF", text: `Forked <b>${owner}/${name}</b>` };
    case "PullRequestEvent":
      return { icon: "🔀", color: "#7ee787", text: `${e.payload.action || "opened"} a PR in <b>${owner}/${name}</b>` };
    case "IssuesEvent":
      return { icon: "🐛", color: "#FFD700", text: `${e.payload.action || "opened"} an issue in <b>${owner}/${name}</b>` };
    case "IssueCommentEvent":
      return { icon: "💬", color: "#00D9FF", text: `Commented on an issue in <b>${owner}/${name}</b>` };
    case "CreateEvent":
      return { icon: "🌱", color: "#FF00FF", text: `Created ${e.payload.ref_type || "ref"} in <b>${owner}/${name}</b>` };
    case "ReleaseEvent":
      return { icon: "🏷️", color: "#FFD700", text: `Published a release in <b>${owner}/${name}</b>` };
    case "PublicEvent":
      return { icon: "🎉", color: "#7ee787", text: `Made <b>${owner}/${name}</b> public` };
    case "GollumEvent":
      return { icon: "📝", color: "#00D9FF", text: `Updated the wiki of <b>${owner}/${name}</b>` };
    default:
      return { icon: "🔹", color: "#8b949e", text: `${e.type} in <b>${owner}/${name}</b>` };
  }
}

// plain text version for the aria-label
function plainLabel(lbl) {
  return lbl.text.replace(/<[^>]+>/g, "");
}

async function main() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "recent-activity-svg",
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const res = await fetch(`https://api.github.com/users/${USER}/events/public?per_page=100`, { headers });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

  const events = await res.json();
  const rows = events.filter((e) => e && e.repo).slice(0, MAX_ROWS);

  const rowHeight = 74;
  const headerH = 110;
  const padBottom = 40;
  const height = headerH + rows.length * rowHeight + padBottom;

  const rowSvgs = rows
    .map((e, i) => {
      const y = headerH + i * rowHeight;
      const lbl = eventLabel(e);
      const repoUrl = `https://github.com/${e.repo.name}`;
      const chipBg = lbl.color + "22";
      const chipStroke = lbl.color + "66";
      const time = timeAgo(e.created_at);
      const text = lbl.text
        .replace(/<b>([^<]+)<\/b>/g, `<tspan fill="#e6edf3" font-weight="bold">$1</tspan>`);
      return `
    <!-- row ${i + 1} -->
    <g>
      <rect x="40" y="${y}" width="1120" height="${rowHeight - 12}" rx="12" fill="#161B22" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1"/>
      <rect x="54" y="${y + 18}" width="40" height="40" rx="10" fill="${chipBg}" stroke="${chipStroke}" stroke-width="1"/>
      <text x="74" y="${y + 44}" font-family="Segoe UI, sans-serif" font-size="20" text-anchor="middle">${lbl.icon}</text>
      <text x="112" y="${y + 33}" font-family="Segoe UI, sans-serif" font-size="15" fill="#c9d1d9">${text}</text>
      <text x="112" y="${y + 52}" font-family="Fira Code, monospace" font-size="11.5" fill="${lbl.color}">${time}</text>
      <text x="1140" y="${y + 36}" font-family="Fira Code, monospace" font-size="12" fill="#8b949e">↗</text>
    </g>`;
    })
    .join("");

  const svg = `<svg viewBox="0 0 1200 ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Recent GitHub activity for ${USER}: ${rows.map((e) => plainLabel(eventLabel(e))).join("; ")}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="raBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0D1117"/>
      <stop offset="100%" stop-color="#161B22"/>
    </linearGradient>
    <linearGradient id="raAccent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00D9FF"/>
      <stop offset="50%" stop-color="#FF00FF"/>
      <stop offset="100%" stop-color="#FFD700"/>
    </linearGradient>
    <pattern id="raGrid" width="36" height="36" patternUnits="userSpaceOnUse">
      <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#00D9FF" stroke-width="0.4"/>
    </pattern>
  </defs>

  <rect width="1200" height="${height}" fill="url(#raBg)"/>
  <rect width="1200" height="${height}" fill="url(#raGrid)" opacity="0.07"/>

  <!-- Header -->
  <g>
    <text x="40" y="48" font-family="Fira Code, monospace" font-size="13" letter-spacing="3" fill="#00D9FF">// RECENT ACTIVITY</text>
    <line x1="230" y1="43" x2="1160" y2="43" stroke="url(#raAccent)" stroke-opacity="0.5" stroke-width="1.5"/>
  </g>
  <text x="40" y="84" font-family="Segoe UI, sans-serif" font-size="14" fill="#8b949e">Latest public activity across the GitHub ecosystem.</text>

  <g font-family="Segoe UI, sans-serif">${rowSvgs}
  </g>
</svg>
`;

  writeFileSync(OUT, svg, "utf8");
  console.log(`Wrote ${OUT} (${height}px tall, ${rows.length} rows)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
