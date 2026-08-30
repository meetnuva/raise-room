# Raise Room

Raise Room 是以本機優先為原則的私人薪資檢討練習空間。你可以設定情境、進行文字模擬會議，並在結束後查看能回到逐字稿的教練建議。

## 安裝

```bash
npm install
```

## 開發

```bash
npm run dev
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

- 攝影機、即時語音、視覺分析與雲端儲存。
- 真正的 Perxona Presenter 或任何 Perxona 連線。
- 雇主評分、招募篩選、謊言偵測或心理判定。

## Local-first

會議逐字稿只保留在目前的 React memory；關閉或重新整理頁面後不會保留。情境草稿只存在此瀏覽器的本機草稿。詳見 [資料與隱私邊界](docs/privacy-boundary.md) 與 [Perxona 整合邊界](docs/perxona-integration.md)。
