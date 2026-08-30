# Raise Room

Raise Room 是以本機優先為原則的私人薪資檢討練習空間。你可以設定情境、進行文字模擬會議，並在結束後查看能回到逐字稿的教練建議。

## 安裝

```bash
npm install
```

## 開發

```bash
npm run dev
npm run dev -- --host
```

## 測試與建置

```bash
npm test
npm run build
```

## 目前 MVP 能力

- 在瀏覽器內設定薪資檢討情境與本機草稿。
- 透過文字輸入進行 deterministic 模擬會議，保留本局逐字稿。
- 依逐字稿中的具體請求、量化成果、拒絕後回應與下一步，產生附證據連結的會後教練報告。
- 用同一情境再練一次，或回到設定頁重新開始。

## 尚未啟用能力

- 即時語音、視覺分析與雲端儲存。
- 雇主評分、招募篩選、謊言偵測或心理判定。

## Local-first

會議逐字稿只保留在目前的 React memory；關閉或重新整理頁面後不會保留。情境草稿只存在此瀏覽器的本機草稿。詳見 [資料與隱私邊界](docs/privacy-boundary.md) 與 [Perxona 整合邊界](docs/perxona-integration.md)。

## Phase 2：可選鏡頭與 Perxona Presenter

會議中的「開啟我的鏡頭」只會在你直接點擊後請求權限，影像只在本機 `<video>` 預覽。`getUserMedia` 必須在安全內容（HTTPS 或 localhost）中使用；`http://lvh.me` 不足以同時驗證鏡頭權限。

若要使用 3D 主管，請由 `.env.example` 複製設定，填入 Publishable Key、Avatar、Scene、Voice ID。沒有完整設定時，文字型 deterministic 主管會照常運作。不可把 Secret Key 放入前端。
