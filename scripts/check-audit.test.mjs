import { describe, expect, test } from "vitest";
import { evaluateAuditReport } from "./check-audit.mjs";

const advisory = (id, severity = "high") => ({
  source: 1,
  name: id,
  dependency: id,
  title: id,
  url: `https://github.com/advisories/${id}`,
  severity,
});

const reviewedReport = {
  vulnerabilities: {
    "@huggingface/transformers": {
      name: "@huggingface/transformers",
      severity: "high",
      via: ["onnxruntime-node", "sharp"],
    },
    "onnxruntime-node": {
      name: "onnxruntime-node",
      severity: "high",
      via: ["adm-zip"],
    },
    "adm-zip": {
      name: "adm-zip",
      severity: "high",
      via: [advisory("GHSA-xcpc-8h2w-3j85")],
    },
    sharp: {
      name: "sharp",
      severity: "high",
      via: [advisory("GHSA-f88m-g3jw-g9cj")],
    },
  },
};

describe("evaluateAuditReport", () => {
  test("接受目前已審閱的 Transformers 傳遞依賴圖", () => {
    expect(evaluateAuditReport(reviewedReport, { today: "2026-08-30" }).ok).toBe(true);
  });

  test("拒絕未審閱的 GHSA", () => {
    const report = structuredClone(reviewedReport);
    report.vulnerabilities.sharp.via = [advisory("GHSA-aaaa-bbbb-cccc")];
    expect(evaluateAuditReport(report, { today: "2026-08-30" }).ok).toBe(false);
  });

  test("拒絕 critical advisory", () => {
    const report = structuredClone(reviewedReport);
    report.vulnerabilities["adm-zip"].via = [advisory("GHSA-xcpc-8h2w-3j85", "critical")];
    expect(evaluateAuditReport(report, { today: "2026-08-30" }).ok).toBe(false);
  });

  test("審閱到期後拒絕既有 advisory", () => {
    expect(evaluateAuditReport(reviewedReport, { today: "2026-10-01" }).ok).toBe(false);
  });

  test("拒絕無法解析的傳遞依賴", () => {
    const report = { vulnerabilities: { package: { name: "package", severity: "high", via: ["missing"] } } };
    expect(evaluateAuditReport(report, { today: "2026-08-30" }).ok).toBe(false);
  });
});
