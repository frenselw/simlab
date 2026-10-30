# 三個電路工作台的 GitHub Pages 公開試用

## 擴充為互動模擬首頁（2026-10-30）

- 使用者要求加入既有 `rocket-space-mission-lab`、首頁每個入口顯示實際截圖，並移除「電路工作台」作為全站名稱。新名稱為「SimLab · 互動模擬」，保留三個原入口及 URL。
- 發布腳本沿用既有三個 standalone 清單，火箭沿用現有 SCORM packager／manifest 收集全部本地模組、材質及地形；公開輸出移除根目錄 imsmanifest.xml。不複製未選中的活動。
- 火箭的 rubric、phase／variant、snapshot schema、獨立練習重新整理規則及 SCORM 接合完全沿用[原活動計劃](40-rocket-space-mission-lab.md)。本輪不修改活動 runtime／評分／保存，公開網址屬 standalone 試玩，不回傳 Moodle 成績。
- 截圖為瀏覽器實際畫面，存於 tools/pages/previews，四個入口一對一；使用 alt、明確尺寸及手機響應式縮圖。桌面兩欄、手機一欄，圖片與文字共享完整連結。
- 影響位置為 build-pages、首頁 HTML／CSS／四張圖片、Pages Node／browser owners、workflow 顯示名與 README；沿用既有 registry entries，不加入新依賴。
- 驗證：精確發布清單及來源 bytes、圖片／四入口與依賴、過期輸出移除；本地與 HTTPS 的桌面／窄手機首頁圖片載入、四入口、原三台全螢幕／文件保持，以及火箭 WebGL 初始化、合法組裝／待發射、全螢幕／狀態保持與 standalone 刷新。重驗最小部署範圍，不重跑整套飛行／rubric／手勢或宣稱真機驗收。
- 以下首次三工作台的證據為歷史版本；本輪新證據於完成後另列。

### 本輪驗證

- `node tools/pages.test.js` 通過：532 個發布檔案精確匹配工作台清單、rocket manifest 與四張首頁圖片；逐 byte 與原始來源／截圖一致，檢查標題、四入口、PNG 格式／真實尺寸、相對依賴及過期輸出清除。
- 四張首頁預覽均為本輪瀏覽器實際截圖，1280×900；火箭截圖為合法單級組裝後的待發射場景。已目視桌面首頁、火箭及窄手機首頁／火箭畫面。
- `node tools/pages-browser-regression.js` 通過：本地 `/pages/` 子路徑 × 四模擬 × 桌面 1280×900／原生觸控 320×500，共八個案例。四圖片 decode／alt／尺寸、標題、入口、無橫向溢出、原生全螢幕及狀態保持均通過；火箭 WebGL、合法組裝／待發射、重新整理回到空白工廠通過。證據為 `output/playwright/pages/local-*.png` 與 `local-report.json`。
- Chrome 會額外探測專案路徑以外的 origin `/favicon.ico`；此未宣告的瀏覽器圖示探測不計入 runtime 依賴錯誤。其他 HTTP／載入錯誤及 JS exceptions 仍失敗。進行原生操作前等字體及兩幀 layout，沿用嚴格幾何與可信輸入斷言。
- `npm run check`、`npm run check:tests`（281 entries：242 node／39 browser，沿用既有 owners）、文件連結、JS 語法與 diff 檢查通過。
- Committed selection preview：base `a1497030988334e2196bfd9d150d47bca4967043` → implementation head `a64f170090e663c23b9b4aef5e0e9f7d4b7f9934`，`full`（workflow／共用基礎設施），選中全部 281 entries、39 browser entries 與全部 packages。輸出 `output/pages-rocket-selection.json`，僅為選取預覽，不代表全站測試已執行。
- 發布：手動 [Pages run 40996146565](https://github.com/frenselw/simlab/actions/runs/40996146565) 的 build／deploy 均成功，部署 SHA `785695c9d5601d5e5d4e8c04f67153c18a83f3fb`；沿用 <https://frenselw.github.io/simlab/>，工作流程顯示名更新為 `Publish SimLab simulations`。
- HTTPS browser：以 `SIMLAB_PAGES_URL=https://frenselw.github.io/simlab/` 執行同一 owner，八個案例全部通過。四截圖／新標題／入口、原生全螢幕及狀態保持、火箭 WebGL／合法組裝與待發射／standalone 刷新均確認，已目視公開首頁。證據 `output/playwright/pages/live-report.json`、`live-*.png`。此為公開部署精準 smoke，不代表全站 CI、完整飛行／評分回歸或真手機／Moodle 驗收。

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
