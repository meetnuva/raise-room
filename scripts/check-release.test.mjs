import { describe, expect, test } from "vitest";
import { validateTrackedFiles } from "./check-release.mjs";

const validEntries = [
  ["README.md", "# Raise Room"],
  ["LICENSE", "MIT License"],
  ["CONTRIBUTING.md", "# 貢獻"],
  ["SECURITY.md", "# 安全性"],
  ["CODE_OF_CONDUCT.md", "# 行為準則"],
  [".env.example", "PERXONA_CONNECT_SECRET_KEY=\nVITE_PERXONA_CONNECT_PUBLISHABLE_KEY=\n"],
];

describe("validateTrackedFiles", () => {
  test("接受完整公共文件與空白的範例 credential", () => {
    expect(validateTrackedFiles(validEntries)).toEqual([]);
  });

  test("拒絕追蹤的 local environment 檔", () => {
    expect(validateTrackedFiles([[".env.local", "SECRET=x"]])[0]).toContain(".env.local");
  });

  test("拒絕範例檔中的實際 Secret Key", () => {
    expect(validateTrackedFiles([[".env.example", "PERXONA_CONNECT_SECRET_KEY=real-value"]])[0]).toContain("PERXONA_CONNECT_SECRET_KEY");
  });

  test("拒絕追蹤的 build 產物", () => {
    expect(validateTrackedFiles([["dist/index.html", "..."]])[0]).toContain("dist");
  });

  test("拒絕 credential candidate 而不回顯其值", () => {
    const errors = validateTrackedFiles([...validEntries, ["config.txt", "VITE_PERXONA_CONNECT_PUBLISHABLE_KEY=private-value"]]);
    expect(errors.join("\n")).toContain("VITE_PERXONA_CONNECT_PUBLISHABLE_KEY");
    expect(errors.join("\n")).not.toContain("private-value");
  });

  test.each([".DS_Store", ".superpowers/state", "node_modules/pkg/index.js", "cert.pem", "key.key"])("拒絕禁止追蹤路徑 %s", (path) => {
    expect(validateTrackedFiles([...validEntries, [path, "safe"]])[0]).toContain(path);
  });
});
