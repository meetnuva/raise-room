# 安全性政策

## 回報方式

GitHub 啟用 Security → Report a vulnerability 後，請優先用該管道回報。公開 issue 不得包含 Key、token、私人逐字稿、音訊、影像或未遮蔽的設定截圖。若憑證疑似外洩，請立即在對應服務撤銷並更換，不要把值貼到任何回報中。

目前只支援 `main` 的 Preview 版本；舊版與本機修改版本不在支援範圍內。

## Key 邊界

`PERXONA_CONNECT_SECRET_KEY` 只可存在本機 Node server 的環境中，絕不進入 browser、Vite bundle 或 Git。`VITE_PERXONA_CONNECT_PUBLISHABLE_KEY` 是可公開使用、但仍應受網域限制的 browser 設定。兩者都必須在懷疑外洩時立即撤銷／輪替；Publishable Key 並不代表可忽略濫用風險。

## 已知相依性 advisory

| Advisory | 目前依賴路徑 | 目前非可達性說明 | 下次審閱 |
| --- | --- | --- | --- |
| `GHSA-xcpc-8h2w-3j85` | `@huggingface/transformers` → `onnxruntime-node` → `adm-zip` | browser Whisper path 不呼叫 Node ZIP 處理 | 2026-09-30 |
| `GHSA-f88m-g3jw-g9cj` | `@huggingface/transformers` → `sharp` | browser Whisper path 不呼叫 Node image processing | 2026-09-30 |

這兩項 advisory 尚無本專案採用的修正版本；它們只是經審閱後暫時接受，並不表示已修復、無害或不需持續追蹤。`npm run audit:known` 對新 advisory、critical、無法解析的依賴鏈或逾期審閱一律 fail closed。
