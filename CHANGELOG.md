# Changelog

## [Unreleased]

### Added

- Meet 式首頁、嚴格下一個整點排程與 5／10／20 分鐘的薪資談判練習。
- 首頁 → 會前準備室 → 正式談判 → 會後報告流程，可提早開始完整一局練習。
- 七分頁設定、session-only 裝置選擇與明確 combined camera／microphone permission。
- 男性／女性主管呈現的可用性檢查、lobby Presenter SDK preflight，以及正式會議才 mount 的 Presenter stage。
- 比例壓力事件、會議資訊側欄、可重回 lobby 的報告導覽，以及本機 ASR／視覺觀察與證據連結報告。
- 統一的本地 SVG icon、tooltip、keyboard menu、原生設定 dialog、Meet 式底部六控制列與跨尺寸 drawer 規則。

### Fixed

- Cancel stale Presenter mounts after React StrictMode cleanup so the engine-load race leaves one `sv-presenter`.
- Validate proportional pressure-event payloads at the manager API boundary and refresh expired schedules immediately when returning home.
- 移除被誤追蹤的內部 `.superpowers` report，讓 release-files 保持拒絕內部 agent 證據與其他禁止路徑的閘門。
