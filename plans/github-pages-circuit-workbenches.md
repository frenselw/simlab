# 三個電路工作台的 GitHub Pages 公開試用

## 範圍與決定（2026-10-30）

- 使用者授權立即公開 DC、AC、家庭三個既有工作台；不加入 SCORM 學生活動。
- 沿用[共用設計規則](00-shared-platform-and-style.md)、[製作契約](../docs/simulation-scorm-production-guide.md)及各工作台的既有模型、操作與文件版本。
- 這是非評量工具的部署改動。Assessment risk、rubric、評分、提交 phase／variant、作答快照與 SCORM 皆 N/A；不改工作台 runtime 或 JSON 匯出／匯入。
- 公開首頁只有三個入口與保存提示；使用 shared/styles.css，手機直排、桌面三欄，連結可用鍵盤操作。
- 發布腳本沿用 package-circuit-workbench.js 的清單驗證與 standalone ZIP，合併三份 assets.json 宣告的檔案，保留相對路徑；共用檔案去重，不複製整個 sim。
- GitHub Pages 只發布 output/pages。每次重建清除此固定生成目錄，避免已移除的項目殘留；不修改原有來源或其他 output。
- GitHub Actions 使用 workflow_dispatch 手動發布、github-pages environment 與最小 Pages／OIDC 權限；不因普通 push 自動更新。
- 影響位置：發布腳本、首頁 HTML／CSS、package.json 指令、Pages workflow、測試登記、README；三個工作台的 assets.json／runtime 保持。

## 驗證決定

- Node：精確比對三個清單的聯集與發布檔案、逐 byte 核對來源、重建移除殘留、首頁三個入口及 HTML／CSS 本地依賴完整性。
- Browser：生成網站在專案子路徑下，桌面 1280×900／觸控 320×500 的首頁與三個入口，檢查初始化、無橫向溢出、無 runtime／網路錯誤、原生全螢幕進出及文件保持；記錄截圖。發布後以同一 runner 驗證真實 HTTPS 網址。
- 將 Node 與 browser owners 登記於 tools/test-registry.js；執行 check、check:tests 及 committed selection preview。
- 工作台模型與操作未改，不重跑全站物理／完整手勢；本輪不建立真手機或 Moodle 驗收結論。

## 實際證據

- `node tools/pages.test.js` 通過：發布內容精確為 57 個檔案，三個入口、來源逐 byte、依賴與重建清理檢查通過。
- `npm run check:tests` 通過：281 entries（242 node／39 browser），48 helpers、2 manual；本輪新增 Pages Node 與 browser owners。
- `node tools/pages-browser-regression.js` 通過：本機生成網站在 `/pages/` 子路徑，1280×900 桌面／320×500 原生觸控共六個工作台案例。首頁三個連結、初始化、無橫向溢出、無網路／runtime 錯誤、原生全螢幕進出與文件保持均通過，已目視窄手機首頁及 AC。證據為 `output/playwright/pages/local-*.png` 與 `local-report.json`。
- 首次 Chrome 啟動受 sandbox 限制，提權後可執行；初次 5 秒 CDP 預設在 AC 載入時逾時，runner 已沿用既有 AC owner 的 30 秒 CDP timeout，完整重跑通過。未修改工作台 runtime。
- `npm run check` 通過（JavaScript 語法與 SCORM manifest profile）；Pages workflow 的 YAML 語法與 build／deploy jobs 檢查通過，`git diff --check` 通過。
- Committed selection preview：base `943b7c0c6f75651e875381faf71925ffc4658605` → implementation head `264de7b7aa46dea7aac8563207bd4b32805edda9`，`node tools/run-tests.js --base=<base> --head=HEAD --plan` 為 `full`，因新增 workflow／共用基礎設施而選中全部 281 entries、39 browser entries 及全部 packages。完整輸出 `output/pages-selection.json`。本機執行上述精準檢查；selection preview 不代表本輪已執行全站測試或遠端 CI 通過。
- `node tools/test-selection.test.js` 通過：既有 dependency／mode／unknown-path 與 Git range failure 選取規則保持。
- 正式發布：implementation `264de7b` 與 selection evidence `c57cc1b` 已推送 main。Pages 為公開 workflow 模式、HTTPS enforced。手動 [Pages run 40994632498](https://github.com/frenselw/simlab/actions/runs/40994632498) 的 build／deploy 均成功，部署 SHA `c57cc1bf2f080e342d2f00c431606846e361edba`；公開首頁 <https://frenselw.github.io/simlab/>。
- HTTPS 驗證：設定 `SIMLAB_PAGES_URL=https://frenselw.github.io/simlab/` 後執行同一 browser owner 通過，三個工作台 × 1280×900 桌面／320×500 原生觸控共六個案例。首頁導航、初始化、無網路／runtime 錯誤、無橫向溢出、原生全螢幕及文件保持均通過，已目視公開首頁。證據為 `output/playwright/pages/live-*.png` 與 `live-report.json`。
- 獨立的全站 Quality run 在本輪記錄時仍執行中，不將 Pages workflow 的成功當作全站 regression 成功。未執行真手機／Moodle 或重驗完整工作台手勢；原工作區的接線活動修改保留。
