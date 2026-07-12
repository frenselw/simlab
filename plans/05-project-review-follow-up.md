# SimLab 項目審核跟進 Checklist

## 狀態說明

- `[x]` 已決定或已完成
- `[ ]` 尚待決定、實作或人工驗收

本計劃以 SimLab 作為低風險功課、課堂活動及自學練習為前提，不把它當作高風險或防作弊的正式考試系統。

## 已確定的產品定位

- [x] SimLab 用於低風險功課、課堂活動及學生自學練習。
- [x] 接受純前端 SCORM 分數可能被少數學生修改，不加入防作弊或伺服器端重新評分。
- [x] Moodle 容許學生無限次作答。
- [x] 每次正式提交後，該次 attempt 保持只讀。
- [x] 學生如要重新作答，返回 Moodle 開始新的 attempt。
- [x] 建議 Moodle 多次作答評分方式設為最高分。
- [x] 不在同一 attempt 內提供「清除並重做」。
- [x] 地圖活動保留目前的引導式設計及答案 readout。
- [x] 地圖活動不新增「練習模式／評估模式」。
- [x] 核心操作維持手機觸控拖曳及桌面滑鼠拖曳。
- [x] 不為拖曳物件加入方向鍵控制或文字輸入控制。
- [x] 一般按鈕繼續使用原生 `button`，保留瀏覽器本身的焦點、Enter 和 Space 操作。

## 先做

### SCORM manifest 與打包

- [x] 四份 manifest 把 `adlcp:scormType` 改為 `adlcp:scormtype`。
- [x] 四份 manifest 正式宣告 `config.js`。
- [x] 加入 SimLab SCORM 1.2 manifest profile 驗證。
- [x] 加入 metadata、organization、item、resource、launch file 及 identifier 語義連結檢查。
- [x] 加入錯誤 manifest fixture 及負面驗證案例。
- [x] 驗證 ZIP 根目錄包含 `imsmanifest.xml`。
- [x] 精確比對 ZIP 內容與 manifest 宣告。
- [x] 確認 ZIP 不包含 tests、screenshots 或暫存檔。

> 此處是針對 SimLab 套件結構的 profile 與語義驗證，不宣稱取代官方完整 SCORM 1.2 schema set。

### SCORM 提交可靠性

- [x] 只在 `LMSInitialize()` 成功後標記為已初始化。
- [x] 捕捉 LMS API exception。
- [x] 檢查 score、lesson status、exit、commit 和 finish 的回傳結果。
- [x] 讀取並記錄 `LMSGetLastError()` 和 `LMSGetErrorString()`。
- [x] `submitResult()` 返回結構化提交狀態。
- [x] 四個活動只在提交成功後鎖定。
- [x] 提交失敗時保留答案、顯示錯誤並容許重試。
- [x] 防止同時產生多個提交請求。
- [x] Live Server 頂層頁面保留 local fallback。
- [x] Moodle iframe／popup 找不到 API 時不會誤用 local fallback。
- [x] 未提交便離頁時，以 `exit = suspend` best-effort commit 並關閉 session。
- [x] 正式提交使用 `exit = logout`。
- [x] `LMSFinish` 失敗後可由再次提交或 `pagehide` 重試。

### Fake LMS 測試

- [x] Initialize 成功及失敗。
- [x] Score raw 寫入失敗。
- [x] Lesson status 寫入失敗。
- [x] Exit 寫入失敗。
- [x] Commit 失敗。
- [x] Finish 失敗及重試。
- [x] LMS API 拋出 exception。
- [x] Embedded／opener 找不到 API。
- [x] Standalone local fallback。
- [x] 未提交 `pagehide` session close。
- [x] 失敗 callback 不鎖定，成功 callback 才鎖定。

### 評分與模型修正

- [x] FBD 完全空白答案改為 `0` 分。
- [x] FBD clean completion 只在必要力完整且沒有多餘力時取得。
- [x] FBD 空白或明顯未完成提交前顯示確認。
- [x] 平面鏡同一來源的兩束光必須使用不同入射路徑。
- [x] 重疊光路不能取得完整性滿分並會顯示針對性回饋。
- [x] 地圖到達目標時補計吸附到入口前的剩餘道路距離。
- [x] 地圖 trace 包含完整走到入口的最後一段。
- [x] 加入地圖到達容差、距離累加、轉折 trace 及終點測試。

### 品質檢查與 CI

- [x] 加入 `npm run check`。
- [x] 加入 `npm test`。
- [x] 加入 `npm run package -- <slug>`。
- [x] 加入 `npm run package:all`。
- [x] GitHub Actions 執行 JavaScript syntax checks。
- [x] GitHub Actions 執行四個 scoring tests。
- [x] GitHub Actions 執行 fake LMS tests。
- [x] GitHub Actions 執行 manifest profile 及語義連結驗證。
- [x] GitHub Actions 打包並檢查全部活動。
- [x] README 列出目前需要的 Node、`xmllint`、`zip` 和 `unzip`。

### 小型修正與文件

- [x] 修正參考系 restore 把空白 LMS score 當成 `0`。
- [x] 修正地圖合法 seed `0` 無法恢復。
- [x] 更新 README 的活動清單。
- [x] 更新 AGENTS 的活動清單。
- [x] 兩個獨立 reviewer 完成多輪 review。
- [x] 跟進所有 actionable findings，最終兩個 review 路線均為 no findings。

### Moodle 人工驗收

- [ ] 用學生帳戶進入每個活動。
- [ ] 提交後確認 Moodle 正確記錄分數及狀態。
- [ ] 重新進入已提交 attempt，確認只可重看。
- [ ] 返回 Moodle 開始新的 attempt。
- [ ] 確認無限次作答及最高分設定符合預期。
- [ ] 模擬或實際測試一次傳送失敗後重新提交。

## 後做

### 保存未提交的中途進度

- [x] 為每個活動定義 compact draft snapshot。
- [x] 完成地圖一段路程或一組答案時保存。
- [x] 完成參考系一輪觀察或一題答案時保存。
- [x] 為平面鏡及 FBD 選擇有意義的保存階段。
- [x] `pagehide` 時保存未提交進度。
- [x] 未完成活動使用 `exit = suspend` 並 commit。
- [x] 驗證 snapshot 不超出 SCORM 1.2 儲存限制。

### 統一 review snapshot 驗證

- [x] 統一 `version`、`activity`、`answer`、`score`、`passed` 基本格式。
- [x] 驗證 snapshot version、activity 和答案結構。
- [x] Restore 時以結構化答案重新評分。
- [x] 與 Moodle raw score 和 snapshot score 比對。
- [x] 資料損壞或版本不相容時顯示安全摘要。
- [x] 先沿用參考系活動的成熟做法，不建立大型框架。

### 參考系 Canvas 效能

- [x] 只在播放時維持 `requestAnimationFrame` loop。
- [x] 暫停、等待、作答、提交及 review 狀態只在改變時重畫。
- [x] Resize 時重畫一次。
- [x] 頁面隱藏時停止動畫。
- [x] 恢復播放時重設時間基準。

### 跨平台打包

- [x] 移除對系統 `zip` executable 的依賴。
- [x] 使用小型 Node 開發依賴產生 ZIP。
- [x] 移除對系統 `unzip` 的依賴。
- [x] 移除對系統 `xmllint` 的依賴，或提供一致的跨平台替代方案。
- [x] 不再用格式敏感的 regex 解析 manifest file entries。

### 小步整理重複程式碼

- [x] 只在至少兩個活動有相同、穩定需求時抽取共用 helper。
- [x] 共用最小 snapshot envelope、容量檢查、讀取及 draft 保存 helper。
- [x] 評估後保留各活動現有提交狀態 UI，不額外抽象。
- [x] 不因個別 `main.js` 較長而進行完整 MVC 拆分。
- [x] 不引入大型前端框架。

## 已確認不做

- [x] 不防止學生在瀏覽器修改分數。
- [x] 不加入後端、LTI 或 Moodle server-side 重新評分。
- [x] 不限制作答次數。
- [x] 不在同一 attempt 內清除答案並重做。
- [x] 不加入地圖隱藏答案評估模式。
- [x] 不加入地圖練習／評估雙模式。
- [x] 不為拖曳物件加入方向鍵控制。
- [x] 暫不追求完整鍵盤操作覆蓋或正式無障礙認證。
- [x] 不引入大型前端框架或全面重寫現有活動。

## 尚待決定

### FBD 箭頭長度是否代表力的相對大小

- [ ] 決定是否把箭頭相對長度納入 scoring rubric。

建議方案：

- [ ] 箭頭長度代表力的相對大小。
- [ ] 支持力與重力、外力與摩擦力分別容許約 `±20%` 長度差。
- [ ] 不要求垂直力與水平力互相等長。
- [ ] 回饋指出哪一對力尚未平衡。

替代方案：

- [ ] 固定箭頭長度。
- [ ] 題目清楚說明只評力的種類、方向和作用點。

這項會改變 FBD 的教學要求和 scoring rubric，實施前需要最後確認。
