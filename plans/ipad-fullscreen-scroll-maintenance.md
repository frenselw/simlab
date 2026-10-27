# iPad 全螢幕捲動維護（2026-10-27）

## 範圍與決定

- 使用者回報：iPad 橫向全螢幕時，控制面板向下拉及回彈容易令整個活動退出全螢幕，未必已到捲動邊界。
- 維護共用顯示層，非新活動。遵守[共用規格](00-shared-platform-and-style.md)及[全螢幕契約](../docs/simulation-scorm-production-guide.md#one-click-fullscreen)。全部使用 shared/styles.css、fullscreen.js 的活動受影響；不新增依賴、manifest 項目或 catalogue entry。
- 評核風險、權威答案、rubric、phase/variant、snapshot schema、續作與 SCORM 報告沿用各活動，均不變。沒有新增持續狀態；全螢幕 class 只反映瀏覽器當下狀態。
- 現有 `contain` 阻止 scroll chaining，但保留 local overscroll。全螢幕時將 SCO 自己的 document、活動及其內部捲動區改為 `overscroll-behavior-y: none`，退出即恢復原 CSS。保留 native panel scroll、touch-action、畫圖、縮放與明確退出功能。
- 不修改 Moodle／ancestor frame 的 DOM 或捲動設定，不用全頁 touchmove preventDefault 或自動重新進入全螢幕。
- WebKit [227387](https://bugs.webkit.org/show_bug.cgi?id=227387) 記錄未到邊界就被 dismiss gesture 退出的情況。因此 CSS 是回彈／串接防護，不能單憑 Chrome 宣稱已修復 iPad 系統手勢。

## 驗證矩陣與交付

- 沿用已註冊 shared fullscreen Node 與 browser owners，擴展既有測試，不增加測試入口。
- Node：標準／legacy WebKit 進出、外部退出、拒絕及 destroy 後的 transient class 清理。
- Source／真解壓 ZIP：全活動既有 fullscreen rollout，核對每個可捲動元素的 computed overscroll；圓周相關四活動另以 1024×768 trusted touch 驗面板中段、頂／底邊界及反方向續捲，維持全螢幕、stage／host／答案與 LMS 不變。另執行既有 drawing／pending／review fullscreen regression，記錄其實際結果。
- 靜態：check、check:tests、文件連結、diff；重新產生全部 SCORM ZIP，確認 shared runtime source/package parity。
- 真 iPadOS／瀏覽器版本與活動待使用者補充；真 iPad、Moodle 的原回報仍待實機複驗，不以本機 viewport emulation 代替。

## 執行證據

- 使用者後續實機回報：已把新版ZIP上載Moodle，iPad仍稍微向下拉便退出全螢幕，感受不到改善。這是明確的實機失敗回報，CSS措施未解決其環境的問題；iPadOS／瀏覽器／實際部署hash及fullscreen event log尚未提供。不能再用下列Chrome成功作為iPad修復證據。
- 原因分析補充：WebKit公開的[原生fullscreen controller](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/ios/fullscreen/WKFullScreenWindowControllerIOS.mm)在FULLSCREEN_DISMISSAL_GESTURES分支向原生view加入單指向下UISwipeGestureRecognizer，並允許與其他手勢同時辨識；interactive dismiss另考慮位移及速度。這支持「面板捲動同時觸發原生退出」的推斷，不代表已確認使用者所裝版本的同一段實作。與網頁CSS overscroll分屬不同層級，需用實機事件及宿主對照確認；本輪分析沒有再更動runtime。
- `node sim/shared/fullscreen.test.js` 通過；標準／WebKit、外部退出、拒絕／busy 與 teardown class 清理均已執行。
- `npm run check`、`npm run check:tests`（279 entries）、browser runner syntax、文件連結及 `git diff --check` 通過。沿用既有 shared-fullscreen owner，沒有新增測試入口；本次未 commit，因此未提供 committed selection-preview。
- `npm run test:browser:fullscreen-rollout -- --tablet-only` 通過：Chrome 156.0.8078.48／CDP 真實輸入、source／extracted ZIP、四活動共8 cases及48次面板手勢，`completed=true`、`errors=[]`。報告：`output/playwright/fullscreen-rollout-tablet/report.json`。
- 最初 tablet fixture 錯把「誰提供向心力」初始觀察面板當成長捲動區；截圖確認整個面板內容已可見。改成透過 production「畫受力圖」按鈕進入有捲動範圍的作答視圖，沒有修改 runtime 或放寬捲動斷言。
- 既有 `npm run test:browser:fullscreen -- --headless` 失敗於第一個 source T0 面板手勢（scrollTop 100→100）；drawing 本身已完成，未跑到後面的 pending／review。隔離 `git archive 0fc1d30` 的完全未修改版本、同 Chrome／指標亦以同一 scrollTop／斷言失敗。基準報告：`output/playwright/fullscreen-scroll-baseline/unchanged-headless-report.json`。不能算作此測試通過，也沒有為使其通過而改斷言。
- 該既有測試 headed 模式另於首次 fullscreen entry timeout；未宣稱桌面原生視窗驗收成功。最初 sandbox 的 localhost EPERM／Chrome SIGABRT 是環境前置失敗，已改用允許 localhost／Chrome 的執行方式。
- 完整 `npm run test:browser:fullscreen-rollout` 最終通過：29活動、source／extracted ZIP、320×500／1280×900，以及四個圓周活動1024×768，共124 cases（含48次平板面板手勢），`completed=true`、`errors=[]`。實際進出、可讀標籤、header clearance、dialog、SCORM 不變、拒絕 policy、進入後所有捲動區 computed overscroll 及退出後原樣恢復均通過。報告：`output/playwright/fullscreen-rollout/report.json`。這項成功不取代上列失敗的 Newton 獨立 lifecycle suite。
- 全部29個 SCORM ZIP 已重新產生；根 manifest、launch、manifest 檔案集及所有928個 ZIP entries 與現行來源逐 byte 相同。hash／大小與明確的未提交修正標記：`output/fullscreen-scroll-package-verification.json`。沒有改現有 Moodle 或 Sites 部署。
- 這是回彈防護及本機回歸，未重跑全庫 `npm test`、完整各活動手勢矩陣、真 iPad／Moodle。原回報「未到邊界亦退出」仍待實機確認，不能宣稱 CSS 已解決 WebKit 原生 dismiss gesture。
