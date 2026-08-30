import { spawnSync } from "node:child_process";

export const REVIEW_DEADLINE = "2026-09-30";
export const ALLOWED_ADVISORIES = new Set([
  "GHSA-xcpc-8h2w-3j85",
  "GHSA-f88m-g3jw-g9cj",
]);

const ghsaFrom = (url) => {
  const match = typeof url === "string" ? url.match(/GHSA-([a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})/i) : null;
  return match ? `GHSA-${match[1].toLowerCase()}` : null;
};
const todayIsAfterDeadline = (today) => !/^\d{4}-\d{2}-\d{2}$/.test(today) || today > REVIEW_DEADLINE;

export function evaluateAuditReport(report, { today } = {}) {
  const vulnerabilities = report?.vulnerabilities;
  const errors = [];
  const knownAdvisories = [];

  if (!vulnerabilities || typeof vulnerabilities !== "object" || Array.isArray(vulnerabilities)) {
    return { ok: false, errors: ["無法解析 npm audit vulnerabilities 報告"], knownAdvisories };
  }

  if (Object.keys(vulnerabilities).length === 0) return { ok: true, errors, knownAdvisories };
  if (todayIsAfterDeadline(today)) errors.push(`已審閱 advisory 的期限 ${REVIEW_DEADLINE} 已到期或日期無效`);
  if (Number(report?.metadata?.vulnerabilities?.critical ?? 0) > 0) errors.push("npm audit 回報 critical vulnerability");

  const visited = new Set();
  const visiting = new Set();
  const visit = (dependency) => {
    if (visited.has(dependency)) return;
    if (visiting.has(dependency)) {
      errors.push(`無法解析 vulnerability 依賴循環：${dependency}`);
      return;
    }

    const vulnerability = vulnerabilities[dependency];
    if (!vulnerability || typeof vulnerability !== "object") {
      errors.push(`無法解析 vulnerability 依賴鏈：${dependency}`);
      return;
    }

    visiting.add(dependency);
    if (vulnerability.severity === "critical") errors.push(`critical vulnerability：${dependency}`);
    if (!Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
      errors.push(`無法解析 vulnerability 終端：${dependency}`);
    } else {
      for (const via of vulnerability.via) {
        if (typeof via === "string") {
          visit(via);
          continue;
        }
        if (!via || typeof via !== "object") {
          errors.push(`無法解析 vulnerability 終端：${dependency}`);
          continue;
        }
        if (via.severity === "critical") errors.push(`critical advisory：${dependency}`);
        const ghsa = ghsaFrom(via.url);
        if (!ghsa) {
          errors.push(`無法解析 advisory GHSA：${dependency}`);
        } else if (!ALLOWED_ADVISORIES.has(ghsa)) {
          errors.push(`未審閱 advisory：${dependency} ${ghsa}`);
        } else {
          knownAdvisories.push({ dependency, ghsa });
        }
      }
    }
    visiting.delete(dependency);
    visited.add(dependency);
  };

  for (const dependency of Object.keys(vulnerabilities)) visit(dependency);
  return { ok: errors.length === 0, errors: [...new Set(errors)], knownAdvisories };
}

function main() {
  const audit = spawnSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8" });
  if (audit.error || ![0, 1].includes(audit.status)) {
    console.error("無法執行 npm audit JSON 報告");
    process.exitCode = 1;
    return;
  }

  let report;
  try {
    report = JSON.parse(audit.stdout);
  } catch {
    console.error("無法解析 npm audit JSON 報告");
    process.exitCode = 1;
    return;
  }

  const result = evaluateAuditReport(report, { today: new Date().toISOString().slice(0, 10) });
  const summaries = [...new Map(result.knownAdvisories.map(({ dependency, ghsa }) => [`${dependency}:${ghsa}`, `${dependency} ${ghsa}`])).values()];
  for (const summary of summaries) console.log(`已審閱：${summary}`);
  console.log(`下次審閱期限：${REVIEW_DEADLINE}`);
  for (const error of result.errors) console.error(`audit gate：${error}`);
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.main) main();
