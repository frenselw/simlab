# 力的正交分解：作圖 MVP 歷史計劃

## 文件狀態（2026-09-22）

本文件保留 2026-09-09 至 2026-09-17 的 A 階段／B1 演進，已由[完整版交付計劃](20-force-orthogonal-decomposition-full-delivery.md)取代為現行規格。完整版及後續修正已經 PR #14 合併至 `main`，三情境、sin／cos 作答、草稿保存、SCORM 打包／提交及鎖定閱覽均已實作，目錄為 `active`。真實 Moodle 與實機手機驗收仍待完成。

以下「本輪不包含」「不加入 package」「planned」及試玩指令均指當時 MVP，不適用於目前活動，也不應據此移除已交付功能。現行版本練習時不提供公式正誤，評核回饋於最終提交鎖定後顯示。

## 歷史範圍與試玩紀錄

日期：2026-09-09。分支：`codex/force-orthogonal-decomposition`。

本文件限定本次 MVP 實作範圍；完整產品方向見 [後續路線](20-force-orthogonal-decomposition-roadmap.md)，不得因為路線列有功能便全部實作。MVP 已在本 worktree 完成為可直接開啟的作圖原型，尚未宣稱 package-ready 或 Moodle-ready。

2026-09-17：使用者在控制點出界修正後確認「目前效果不錯」。目前作圖及操作手感可作為後續版本的基礎；本次只同步計劃，不啟動公式、斜面或正式交付功能。

後續授權紀錄（2026-09-17）：使用者再要求立即完成公式階段。當時程式在原四步之後新增第 5 步 sin θ／cos θ 拖放，實作範圍及驗收以 roadmap 的 B1 歷史契約為準。「不含公式」描述僅指原 MVP；保存、斜面及 SCORM 在 B1 當時尚未加入，其後已由完整版交付。

## 1. 目的及範圍

先製作可直接用瀏覽器操作的作圖原型，確認學生可以依照教師的順序，親手建立方向虛線、垂線、分力箭嘴，並體驗合理的吸附。這一階段驗證作圖效果及操作手感，不是完整教學或評核活動。

- Slug：`force-orthogonal-decomposition`。
- 學生可見標題：`力的正交分解：作圖練習`，附簡短 `作圖原型` 標示。
- 只有一幅固定題圖：原力由共同起點斜向右上，分解方向為水平及垂直。
- 原力位置、大小、方向固定，學生不拖動原力。
- 不顯示數值、不要求計算，避開 45° 及近水平／垂直的退化圖形。
- Assessment risk：`formative`，沒有成績或通過門檻；trusted validation 不適用。
- Libraries：none；原生 HTML、CSS、JavaScript、SVG、Pointer Events。
- 本輪已按下列規格完成可試用原型；沒有把未來完整版本功能帶入本次實作。

用語暫定：使用者最後提到的「級線」按前文解讀為「角弧」。MVP 包含最簡單的 θ 放置及角弧顯示，以便驗證這個操作；不包含三角函數答案。若使用者澄清不是角弧，先調整此項範圍。

### MVP 包含

1. 學生由原力箭尾畫兩條方向虛線。
2. 由原力箭頭向兩條方向線畫垂線，接近方向／垂足時即時吸附。
3. 由原力箭尾畫兩支分力箭嘴，接近已建立垂足時吸附。
4. 拖放一個 θ 到 O 或 P 的銳角，預覽及顯示角弧；放置後可再次拖動。
5. 返回上一步、重畫目前步驟、重設本圖。
6. 手機及桌面作圖、基本鍵盤替代操作、必要的幾何及可信觸控驗證。
7. 畫完後直接編輯：拖動方向線的小方點、垂線終點或分力箭頭；標角步驟仍可直接修改分力。
8. 控制點保持可達：新建／編輯終點不超出可操作範圍，視窗縮小後控制點仍留在畫面內。

### 明確不包含

- sin／cos 卡片、公式、數值計算或答案講解。
- 斜面、重力分解、其他象限、可調原力、自由探索或隨機題目。
- 已知斜面傾角的等角判斷，以及 O／P 以外頂點的 θ 放置。
- 多題導覽、示範動畫、提示分級、分數、提交或成績頁。
- localStorage、草稿、重載恢復、SCORM／Moodle 保存及 ZIP 打包。
- 任意增加線條、整支分力平移、箭尾自由編輯、完整繪圖工具列。箭頭／虛線終點的直接編輯已按試玩回饋納入。
- 修改現有「力的合成」活動，或建立通用作圖框架。

## 2. 參考與最小檔案配置

實作前讀取專案共同規範、production guide、本文件及 roadmap。

參考 `plans/19-force-composition-construction-lab.md` 第 27、31、35、39 節，以及該活動 `model.js`、`main.js` 的相關函式。沿用視覺及手感：單一形狀箭嘴的尖端就是幾何端點、螢幕像素吸附、透明大觸控區、拖動期間不改 camera、不移動未被拖動的物件。不要沿用舊活動歷史上整個空白舞台接管拖動的做法；本活動遵守目前手勢擁有權規範。

預計只有：

- `sim/force-orthogonal-decomposition/index.html`：舞台、短工具列及語意控制。
- `styles.css`：活動版面、透明操作區及標籤，引用 `../shared/styles.css`。
- `model.js`：少量可測的幾何、吸附及步驟狀態操作。
- `main.js`：SVG 繪製、輸入事件、畫面狀態。
- `model.test.js`：有實際風險的幾何及狀態行為測試。
- `tools/force-orthogonal-decomposition-browser-regression.test.js`：註冊用的 source contract checks。
- `tools/force-orthogonal-decomposition-browser-regression.sh`、`tools/force-orthogonal-decomposition-playwright-check.js`、`tools/force-orthogonal-decomposition-static-server.js`：可重複執行的真實瀏覽器 acceptance runner。

新增測試已登記至 `tools/run-tests.js`。沒有為將來功能預建 scoring、persistence、generator 或空殼模組。MVP 無 LMS lifecycle，因此本階段不接入 `scorm.js`／`activity-flow.js`；正式加入 lifecycle 時必須使用共同 runtime。

實作檔案：`index.html`、`styles.css`、`model.js`、`main.js`、`model.test.js`，source contract checks，以及 tracked 的真實瀏覽器 runner。Playwright acceptance 不以 regex-only assertions 取代。

此原型不登記為 `active`，不加入 `package:all`。若需目錄入口，只能用 `planned`，並先確認現有目錄正確處理 planned；否則直接以活動 URL 開啟。未來正式活動 metadata 預定為 title `力的正交分解作圖實驗室`、folder 同 slug、categories `[Mechanics]`、description `沿指定方向作圖分解力，選擇角度並以三角函數表示分力。`、tags `[physics, forces, vectors, decomposition, drawing, scorm]`；本輪不修改 config。

## 3. 固定幾何與模型

用數學座標描述，渲染時才轉換 SVG 的向下 y 軸：

- 共同起點 O = (0, 0)，原力箭頭 P = (240, 160)。數字僅作圖形單位，不是牛頓。
- 水平單位方向 u = (1, 0)，垂直單位方向 v = (0, 1)。
- 正確垂足 A = (240, 0)，B = (0, 160)。
- 原力 OP、方向線 OA／OB 所在直線、垂線 PA／PB、分力 OA／OB。
- 對任一過 O 的單位方向 d，垂足 H = O + ((P - O) · d)d。
- θ 候選是 O 的 ∠AOP、∠POB，以及 P 的 ∠BPO、∠OPA，均為銳角；MVP 只畫符號及角弧，不顯示度數。

以少量向量／投影運算表達以上關係即可，不建立任意坐標系編輯器。方向線是無箭嘴的雙向直線；角度吸附以模 180° 比較，所以向左拉也可以建立水平線。分力是有方向的矢量，不能以模 180° 把反向箭嘴當成正確。

## 4. 四步操作

### A. 畫分解方向

舞台起初只有原力 F。選用目前步驟的起筆點，由 O 拖出方向線；有效拖動後預覽穿过 O 的虛線，方向由手指決定，畫面中的線長由舞台邊界裁切。

接近水平或垂直才 snap；學生仍要分別畫兩條。第一條完成後可再次由 O 起筆畫另一條。最多兩條，重複水平線不算另一條垂直線。兩條都有記錄後可進下一步，未吸附的斜線仍保留，不因 snap 以外的操作自動校正。

### B. 作垂線

由 P 拖出線段，向已畫的兩條方向線作垂線。開始時不顯示尚未作出的垂足或正確線條輪廓。

- 接近某條線的垂直方向時，將拖動方向吸附，但保留學生拖出的投影長度。
- 接近該線的垂足且方向合理時，終點精確吸附到垂足。
- 線段真正到達或穿過垂足且方向垂直時顯示直角小記號；短線不會自動補長。
- 最多兩條；兩條記錄存在便可進入下一步，不要求先全部正確。
- 若前一步方向線畫錯，投影及吸附按已畫線計算，不偷偷改為水平／垂直答案。

候選同時接近時先維持目前候選，再以最近者決定；不預先指定「第一條必須水平」。垂線配對的是目標方向線，不是建立次序；同一目標不能同時算作兩個完成項。

### C. 畫分力

由 O 分別拖出兩支實線箭嘴。箭尾固定 O，箭頭跟手指移動；接近可見的「已畫垂線與方向線的交點」才吸附。不吸附到尚未由學生作圖建立的隱藏垂足。

如錯誤虛線有實際可見交點，可以吸附至該交點；平行、重疊、交點只在垂線線段延長部分時不提供端點 snap。因此貼齊並不保證答案正確。未接近目標時自由位置可以保留。

最多兩支分力，保留 F₁、F₂ 中性標籤，不顯示公式。箭尾固定 O，畫完可直接拖動箭頭更改方向與長度；編輯沿用交點吸附、保留編號，不增加第三支箭嘴。不提供整體平移。

### D. 放 θ 及看角弧

兩支分力記錄存在後可以進入本步。只有目前圖形確實形成正確水平／垂直分解時，才提供 O／P 的四個銳角候選；否則顯示中性說明「目前圖形未形成可標示的分解銳角，請返回調整」，不畫假的 θ 角弧，也不刪除錯圖。θ 候選以各自頂點計算角弧與吸附扇區。

θ 來源放在舞台內的固定小標籤座，避免跨捲動區拖曳。拖近某銳角區域時顯示預覽角弧，放手記錄該角的語意鍵；另一銳角同樣有效。遠離任何候選放手則返回原有位置／標籤座，不留下無所屬角度的 θ。

θ 位置以角弧中點及可读間距排版，避免壓住原力與分力。不以標籤文字所在的座標代替角度語意。θ 可以重新拖放；改選只改變角弧，原力及分力完全不動。完成後仍留在同一圖，沒有評分或提交頁。

## 5. Snap 與箭嘴規格

以下是初始調校值，需以手機實際尺寸驗證，不能只看 SVG 單位：

| 項目 | 初值 | 邊界例子 |
|---|---|---|
| 滑鼠端點距離 | ≤ 14 CSS px | 13.9 吸附；14.1 不吸附 |
| 觸控端點距離 | ≤ 20 CSS px | 19.9 吸附；20.1 不吸附 |
| 鍵盤端點距離 | ≤ 12 CSS px | 11.9 吸附；12.1 不吸附 |
| 方向角距離 | ≤ 10° | 9.9° 吸附；10.1° 不吸附 |
| 方向起筆最短距離 | 12 CSS px | 小於門檻視為點選，不建立線 |
| θ 候選 | 距角弧中點 ≤ 24 CSS px，且落在該銳角扇區 | 相鄰扇區不能只因頂點相近而互搶 |

- 端點、方向、角弧容差獨立，以命名常數集中管理。
- 拖動中即時 preview；放手提交當刻圖形，不能放手後再跳到另一位置。
- 已吸附目標在進入半徑的 1.3 倍內保持，超出後解除；邊界測試分開驗證首次進入及已吸附退出，避免抖動。
- 只修正正在拖動的線／箭嘴／θ，原力及其他圖形保持固定。
- 箭身及箭頭使用單一填色 path，尖端與模型端點完全對齊；短箭嘴的視覺縮放不改幾何長度。
- 輔助線淡色虛線、原力及分力實線，不依賴顏色作唯一區分；標籤避開線段。
- 沒有持續大光圈或箭身外框。只在目前工具的起筆位置提供細小中性提示，透明 hit target 至少 44 × 44 CSS px。

## 6. 狀態及修改規則

只有記憶體狀態，刷新即回初始圖；頁面清楚標示「原型不保存進度」。沒有 snapshot schema 或舊版本 migration，因為 MVP 不發佈可保存的學生 attempt。

權威狀態：目前步驟、最多兩條方向記錄（自由方向／吸附軸鍵）、最多兩條垂線（起點固定 P、終點及目標關係）、最多兩支分力（起點固定 O、終點及可選交點關係）、θ 角鍵或空值。端點及角度的幾何关系可衍生，不保存 SVG／DOM 作為答案。pointer、hover、preview 不屬於作答狀態。

| 階段／變體 | 保留內容 | 尚未建立或已清除 | 合法操作 |
|---|---|---|---|
| 方向：0／1／2 條，可正確或未吸附 | 目前方向線 | 垂線、分力、θ | 畫方向、重畫；兩條記錄後下一步 |
| 垂線：0／1／2 條，可短線或錯線 | 兩條方向線、目前垂線 | 分力、θ | 畫垂線、重畫、返回；兩條記錄後下一步 |
| 分力：0／1／2 支，可自由端點 | 方向線、垂線、目前分力 | θ | 畫箭嘴、重畫、返回；兩支記錄後下一步 |
| 標角：幾何可用／不可用、θ 空／已選 | 全部作圖；不可用幾何必須 θ 空 | 不適用 | 可用時拖 θ；返回、重設 |

各步驟可拖動該步已畫的圖形，標角步驟亦可直接修改分力；修改方向線／垂線則返回相應步驟。舞台右上角與面板的「上一步／下一步」只切換目前工具，保留全部圖形及 θ。故上表各步驟另有「返回編輯」變體，允許保留既有後續內容；未修改時下一步回到原狀。直接編輯保留其他線和箭嘴的座標，重新驗證交點關係，解除失效的關係鍵及 θ。只有「重畫本步」才清除該步及後續內容；重設清除全部。MVP 不另做多層 undo stack。

## 7. 版面及手勢擁有權

分類：短工具列、自然頁面流，沒有獨立捲動控制面板。上方是主要圖形，下方只有目前步驟一句說明及返回／重畫／下一步／重設，避免多層卡片。桌面限制最大寬度；手機舞台按固定題圖取景，拖動過程不得縮放或移動 camera。轉向／viewport 改變時才重新排版。

空白舞台不作起筆區。各步驟從已存在、穩定的 O／P HTML hit target 起筆；同一位置只啟用目前工具，避免事件衝突。`touch-action: none` 在 pointerdown 前已設定於這些 target，其他舞台使用 `pan-y`。持有 pointer capture 的元素整次拖動不能被 render 替換。

| 觸控起始區 | 擁有者 | 驗證結果 |
|---|---|---|
| 空白舞台 | 外層頁面／Moodle-like host | host 有範圍時移動且 iframe 跟隨；不修改圖形，不轉移到工具列 |
| 短工具列非互動區 | 外層頁面／host | 正常頁面捲动；沒有獨立 panel owner |
| O 的方向線起筆 target | 模擬 | 方向預覽變化；所有頁面、文件、viewport、iframe 捲動／位置 delta 為 0 |
| P 的垂線起筆 target | 模擬 | 垂線變化；上述 delta 全為 0 |
| O 的分力起筆 target | 模擬 | 箭嘴變化；上述 delta 全為 0 |
| θ 標籤座或已放置 θ target | 模擬 | θ／角弧預覽變化；上述 delta 全為 0 |
| 方向虛線小方點（各兩個穩定 HTML target） | 模擬 | 修改該方向，其他圖形不移動；上述 delta 全為 0 |
| 垂線終點（各兩個穩定 HTML target） | 模擬 | 修改該終點，其他圖形不移動；上述 delta 全為 0 |
| 已畫分力箭頭（各兩個穩定 HTML target） | 模擬 | 修改該箭頭方向與長度，另一箭嘴保持原位；上述 delta 全為 0 |

所有 drag row 必須收到 trusted touch 的 pointermove 及 pointerup，不得 pointercancel。每個 target 都有明確 HTML 尺寸；不能只靠 SVG path 的 touch-action。鍵盤以 Tab 選起筆控制，Enter 開始／確認、方向鍵移動端點、Escape 取消；θ 以方向鍵切換候選。純點選不自動畫出答案。

嵌入驗證採用內容高度貼合的自然流 iframe，讓外層 host 成為正常捲動者；不增加 iframe 內第三個垂直捲動區。如果實際瀏覽器不能由舞台將手勢交給 host，調整拓撲或只轉送同一 host，須再次驗證；不得轉送給兄弟控制區。

## 8. MVP 實作次序與驗收

1. 固定原力、箭嘴及手機舞台，先確認尖端對齊、標籤可讀、觸控起筆區不互搶。
2. 完成兩條方向虛線及方向 snap，再接兩條垂線及垂足 snap。
3. 加上分力箭嘴、可見交點 snap，以及返回／重畫／重設。
4. 加上 O／P 共四個 θ 候選、即時角弧預覽及基本鍵盤操作。
5. 完成聚焦驗證並交付可操作的原型給使用者試手感；到此停止，不自行加入 roadmap 功能。

必要驗收：

- [x] 一次完整滑鼠流程確實由學生畫出兩條方向線、兩條垂線、兩支分力及 θ。
- [x] θ 在 O／P 的四個位置都能操作，移動 θ 不改變圖形。
- [x] 幾何測試涵蓋方向模 180°、投影垂直、短線不補長、端點精確對齊、方向／距離進入與退出邊界。
- [x] 錯線可保留；錯誤可見交點可吸附，隱藏交點不能吸附；吸附不改其他物件。
- [x] 返回／下一步保留作圖；重畫清除該步及依賴內容，無殘留箭嘴及角弧；刷新回初始圖。
- [x] 小圖形／相鄰目標不會造成 target 互搶或 snap 抖動；模型以 sticky exit radius 保持既有 target，離開後才切換鄰近 target。
- [x] 桌面、390 × 600、320 × 500、手機橫向及 200% zoom 可讀、工具可達，圖形不在拖動中跳動。
- [x] development source 在可捲動 Moodle-like iframe 中，逐行執行上述 trusted-touch matrix，雙向 swipe、每種拖曳皆測；記錄 browser engine、device、host／activity document／visual viewport scroll、iframe bounds、learner state 前後值。
- [x] 直接頁面本輪有 natural scroll range，已直接驗證空白舞台捲動 activity document；因此不以 N/A 取代 iframe host 測試，iframe matrix 另行完成。
- [x] Playwright 採 Git Bash 路線；tracked runner `tools/force-orthogonal-decomposition-browser-regression.sh` 自行啟動／等待／關閉本地 server、清理唯一 browser session；stdout 有 `### Error` 即視為失敗。
- [x] 所有新增測試加入 `tools/run-tests.js`；`npm.cmd run check` 及 `git diff --check` 已通過。
- [ ] `npm.cmd test` 全套測試：被既有 `position-time-browser-regression.js:307` 的 Chrome DevTools WebSocket helper 提前阻斷，待修復該環境／既有 harness 後再重跑。
- [x] 沒有新增評分、保存、題庫、SCORM 或斜面功能；沒有改壞既有力的合成活動。

本階段只可稱為「MVP 作圖原型可試用」，不能稱 package-ready 或 Moodle-ready。打包及 packaged-touch matrix 因沒有 SCORM 產物而延後；正式版本必須補做，不能以此處的 source 測試代替。

### MVP 實作證據（2026-09-11）

- 新增 `sim/force-orthogonal-decomposition/` 的 `index.html`、`styles.css`、`model.js`、`main.js` 及 `model.test.js`；新增 `tools/force-orthogonal-decomposition-browser-regression.test.js`，並已登記到 `tools/run-tests.js`。
- `model.test.js` 覆蓋方向、投影、垂足／交點／θ snap、箭嘴端點、phase transition、返回／重畫／重設及正確分解判定。
- `model.test.js` 另覆蓋相鄰可見交點的 sticky snap：靠近另一 target 時不搶點，離開 exit radius 後才切換。
- tracked 的自包含 Git Bash Playwright runner（shell + static server + page-function）已驗證 1100 × 760 滑鼠完整流程、全四步鍵盤續作、390 × 600／320 × 500／700 × 390／200% zoom、直接頁面與可捲動 host 的 source iframe scroll ownership，以及 O／P／θ 拖動期間的 trusted pointermove／pointerup 和無 pointercancel；已輸出 desktop、mobile、320、landscape、zoom、embedded-touch screenshots。
- 本輪補強了 commit 端的 sticky target 一致性（垂線及分力）、預覽／提交的共同最短距離、點選／過短分力不建立答案、鍵盤由實際 O／P 起點並必須先移動、θ 的獨立 24 CSS px snap radius，以及 live component preview 的可見填色；runner 另驗證 O／P 偏心點選不會消耗作答槽位，並驗證 sticky band 內放手仍保留原 target。
- `npm.cmd run check` 及 `git diff --check` 已通過；`npm.cmd test` 在既有 `position-time-browser-regression.js:307` 的 Chrome DevTools WebSocket helper 失敗並提前停止，尚未跑到本活動測試，故本活動兩個新增測試另行直接執行且均通過。
- 既有 full-suite blocker 已用獨立隨機 profile／DevTools port 重跑：系統 Chrome 152 的 GPU process 先 crash，造成 `position-time-browser-regression.js:307` WebSocket failure；改用兩個隔離 Playwright Chromium builds 後 CDP 可用，但同一既有 harness 在 position-time mission 5 的 speed-label geometry assertion（line 1165）失敗，兩次／兩個 builds 均重現；以其中一個 build 跑完整 `npm.cmd test` 則又在既有 touch path 的 `Input.dispatchTouchEvent` timeout 停止。這不是本 MVP 的產品變更，仍待另行修復既有 harness／browser compatibility。沒有產出 SCORM package，因此 packaged-touch matrix 仍待正式活動階段補做。

## 9. 完成後如何銜接

### 控制點邊界修訂（2026-09-17）

- 新建及編輯垂線／分力時，終點沿原射線截短至可操作範圍；保留整個 52px 拖曳 target，並避開舞台導覽。方向吸附和交點吸附後仍須在此範圍內，不會因吸附把終點送出界。
- 視窗縮放後，既有端點若超出新範圍，編輯控制點沿同一射線移至畫面內；不因 resize 偷改學生的作圖，可直接拖動該點再調整。方向虛線控制點同樣保持可見。鍵盤位置亦受邊界限制，避免累積不可見的移動距離。
- 模型四邊截短及方向保留、滑鼠新建超長垂線、虛線／分力逐邊拖出後再次修正、320px resize 後重新拖曳均通過；source iframe trusted-touch 驗證拖出底邊再抓回，收到 pointermove／pointerup、無 pointercancel、host／activity／panel 不捲動。
- 專項模型、瀏覽器 contract、完整專項 Playwright、`npm.cmd run check` 通過；未新增 SCORM package，正式 packaged-touch 驗證仍按原計劃延後。

### 完成後直接編輯（2026-09-17）

- 每種線提供兩個固定掛載、52px 透明 HTML 編輯 target，畫面僅顯示虛線的細小方點；分力可直接抓箭頭。當前步驟開啟該類編輯，標角步驟也開啟分力箭頭編輯，以免錯圖被標角門檻卡住。
- 既有 Pointer Events／鍵盤流程共用編輯預覽，放手或 Enter 才提交；Escape／pointercancel／點選不移動保留原作圖。預覽時不新增記錄；線條 key、數量及未編輯圖形的座標保持不變。
- 上游編輯不刪除其他線或箭嘴，按新的可見交點重新驗證關係 key；失效關係解除、符合新幾何的舊端點可恢復關係，不會移動端點代答。只有不再成立的 θ 被清除，可修正後再放置。
- 模型測試涵蓋各類編輯、修復、重複方向拒絕、零長度拒絕及不改原 state；瀏覽器涵蓋 F₁ 錯位再修正、鍵盤編輯／取消、各兩條虛線編輯，以及六個編輯 target 的 trusted-touch 捲動鎖定。

### θ 再拖動及舞台導覽修訂（2026-09-17）

- θ 只呈現數學字母，無圓形底色、邊框、陰影；48px 透明 HTML target 保留易用觸控範圍。拖動時字母跟隨手指，角弧只預覽目前候選；放手保留單一 θ 與角弧。
- 支援 O／P 共四個銳角，已放置 θ 可由任一候選再拖到另一候選，保留 pointer capture 並使用頂點局部座標判斷。
- 舞台右上角新增 44px 上／下一步按鈕及目前步驟。兩套導覽狀態一致；純導覽不清除內容，只有重畫／重設才清除。
- 模型、程式檢查、專項瀏覽器流程通過；新增滑鼠拖動中跟隨、P 的兩個角、舞台導覽保留內容、無可見圓形底，以及 iframe 中已放置 θ 再拖至 P 的 trusted-touch 檢查。所有拖動保持頁面位置且無 pointercancel。

### 延長垂線亦可標角（2026-09-17）

- 使用者截圖顯示兩條正確垂線延長超過垂足、分力止於交點，卻被舊有 endpoint snap key 判定拒絕標 θ。
- 正確性改由實際線段幾何判斷：每條垂線須垂直於對應軸，而且線段到達或穿過垂足；兩條須覆蓋不同方向。過短或斜交仍不接受。分力端點仍須與各自可見交點一致。
- 直角記號同樣根據幾何顯示，接受延長線段；本條取代早期只在終點吸附時才顯示直角／允許標角的限制。
- 新增模型正反例及完整滑鼠重現流程，確認延長兩條輔助線後仍可用選角按鈕放置 θ。

### θ 操作及數學排版修訂（2026-09-17）

- 按使用者試玩回饋，在第 4 步加入兩個可見虛線角弧及放置提示，並提供「原力與水平分力之間」／「原力與垂直分力之間」點選按鈕；原有拖曳及鍵盤操作保留。選角只改 θ，不改分力幾何。
- 符號使用本機數學／襯線字體、斜體變量及 SVG tspan 下標；F₁、F₂ 的數字使用較小正體下標，不引入 MathJax、外部字體或新 library。
- 專項瀏覽器流程新增雙向點選及幾何不變檢查，連同滑鼠、鍵盤、手機 trusted-touch、窄屏及縮放流程通過；模型測試、程式檢查與 whitespace check 通過。

### 管理者整合驗收（2026-09-11）

- 已整合至原專案 `codex/force-orthogonal-decomposition` 工作分支，未提交 Git commit。
- 管理者重跑模型測試、`npm.cmd run check`、`git diff --check` 及 tracked Git Bash Playwright 全流程，均通過。瀏覽器 runner 已補上 Git Bash 工具 PATH，可直接依專案指引執行。
- 最後視覺審查修正重複 θ 及力名壓線；修正後再跑完整專項瀏覽器流程並檢視桌面截圖。
- 截圖位於 `output/force-orthogonal-decomposition/`；完整專案 `npm.cmd test` 的既有 position-time 故障仍如上所述，不宣稱全套通過。
- MVP 作圖原型已可試用；無保存、公式配對、斜面或 SCORM 功能。後續按 roadmap 另定階段。

交付時更新本文件的實作證據：實際檔案、通過測試、仍待調整的手感、使用者回饋。同步更新 roadmap 的階段狀態，不刪除尚未實作需求。下一次開工先讀兩份文件，以使用者選定的下一階段為範圍。

保持模型與畫面薄薄分開，後續沿用方向線／垂線／分力／角鍵，增加題目設定及公式答案即可。不要為這個過渡預先建立完整評核平台；正式保存 schema 必須在新增 persistence 前另行完成。
