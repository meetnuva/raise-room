# 0001：local-first 與 Perxona Key 邊界

- Status：Accepted
- Date：2026-08-30

## Context

Raise Room 處理私人薪資練習內容，且可選用 Perxona Presenter 與動態主管。

## Decision

情境、逐字稿、語音與視覺觀察預設留在 browser 本機。browser 只可使用受網域限制的 Publishable Key；Secret Key 僅存在 loopback Node server，並由同源 API 呼叫 Perxona Chatbot。

## Alternatives

- 將 Secret Key 放入 Vite 環境變數。
- 將逐字稿與媒體持久化到雲端。
- 直接由 browser 呼叫 Chatbot。

## Consequences

未設定 Key 時必須提供可見 fallback，且任何第三方資料流都要重新揭露與取得使用者明確同意。公開 Preview 不宣稱已完成真實 Key 或 Chatbot 驗收。
