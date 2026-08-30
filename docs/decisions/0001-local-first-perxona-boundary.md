# 0001：local-first 與 Perxona Key 邊界

- Status：Accepted
- Date：2026-08-30

## Context

Raise Room 處理私人薪資練習內容，且可選用 Perxona Presenter 與動態主管。

## Decision

情境與逐字稿預設留在 browser 本機；只有動態主管已設定且實際使用時，loopback Node server 才會把它們送往 Perxona Chatbot。音訊、影格與 landmarks 永不送往該服務。browser 只可使用受網域限制的 Publishable Key；Secret Key 僅存在 loopback Node server，並由同源 API 呼叫 Perxona Chatbot。

## Alternatives

- 將 Secret Key 放入 Vite 環境變數。
- 將逐字稿與媒體持久化到雲端。
- 直接由 browser 呼叫 Chatbot。

## Consequences

未設定 Key 時必須提供可見 fallback，且任何第三方資料流都要重新揭露與取得使用者明確同意。公開 Preview 不宣稱已完成真實 Key 或 Chatbot 驗收。
