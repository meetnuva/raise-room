# 貢獻指南

Raise Room 是本機優先的私人練習工具。請以繁體中文維持 UI 與使用者文件的一致性；程式碼、command 與 API identifier 保持原名。

## 本機準備

需要 Node `24.13.1`：

```bash
nvm use
npm ci
cp .env.example .env.local
```

`.env.local` 只能留在本機，絕不可提交。未設定 Perxona 時，請使用明確標示的本機腳本 fallback，不需也不應建立真實 Key 或 Chatbot。

## 開發與驗證

```bash
npm run dev
npm test
npm run build
npm run audit:known
npm run release:check
```

新行為先寫會失敗的測試，再以最小實作讓它通過。送出前至少執行與變更相符的測試；涉及公開檔案、依賴或文件時執行 `npm run release:check`。

## 隱私與產品邊界

- 維持 local-first：逐字稿與可觀察的語音／視覺 aggregate 不得變成雲端保存資料。
- 不得加入雇主評分、招募篩選、欺瞞偵測、情緒、人格或自信推論。
- 任何權限都必須由使用者明確操作觸發；不可自動要求鏡頭、麥克風或模型下載。
- 不提交真實 Key、token、私人逐字稿，或含 Key 的截圖。

## Pull Request 檢查表

- [ ] 測試與 build 已完成，必要時 `npm run release:check` 也通過。
- [ ] 文件、資料流與可見 fallback 已隨行為更新。
- [ ] 沒有自動權限請求、憑證、真實逐字稿或未遮蔽截圖。
- [ ] 變更仍符合 local-first 與非雇主評分的產品邊界。
