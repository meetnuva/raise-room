# 0003：以單一 loopback runtime 提供開源 Preview

- Status：Accepted
- Date：2026-08-30

## Context

專案需要在不建立部署平台、帳號系統或多租戶資料層的前提下，讓貢獻者可重現 Preview。

## Decision

維持單一 Node Express server 與 Vite build，固定只監聽 `127.0.0.1`。CI 僅驗證安裝、測試、build、audit 與 tracked-file release gate，不使用 secrets 或部署。

## Alternatives

- 加入雲端部署與遠端資料庫。
- 直接讓 Vite browser bundle 接觸 Secret Key。
- 宣稱提供 hosted multi-tenant service。

## Consequences

使用者必須在本機設定環境檔，未設定動態主管時使用 fallback。公開文件必須明確標示 Preview／local-first 範圍，不可把未驗收的裝置、VRoid、Key 或十分鐘 E2E 描述為完成。
