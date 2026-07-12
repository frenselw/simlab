# SimLab 項目審核跟進計劃

## 文件目的

本文件把項目全面審核提出的事項整理成兩個工作階段：

- **先做**：影響 SCORM 提交可靠性、套件合規、明確評分錯誤及基本發布品質的工作。
- **後做**：提升恢復能力、跨平台開發體驗、效能與維護性的工作。

本計劃以 SimLab 的實際用途為準，不把它當作高風險或防作弊的正式考試系統。

## 已確定的產品定位

### 活動用途

- SimLab 用於低風險功課、課堂活動及學生自學練習。
- 不要求活動具備高風險考試所需的防作弊或伺服器端驗證能力。
- 接受純前端 SCORM 分數可被少數熟悉瀏覽器工具的學生修改，這是已知限制，不列入修正範圍。

### 作答次數與提交後狀態

- Moodle 應容許學生無限次作答。
- 每次正式提交後，該次 attempt 保持只讀，讓學生查看答案和回饋。
- 學生如要重新作答，應返回 Moodle 開始新的 attempt。
- 建議 Moodle 的多次作答評分方式設為最高分。
- SimLab 不需要在同一 attempt 內提供「清除並重做」。

### 地圖活動的答案提示

- `displacement-distance-map-journey` 保留目前的引導式設計。
- 答題時繼續顯示已走路程、正確位移大小和方向文字。
- 不新增「練習模式／評估模式」。
- 這項活動的分數代表學生在提示下完成概念配對，不解讀為獨立量度或計算能力的高可信證據。

### 操作方式與鍵盤支援

- 核心操作維持手機觸控拖曳及桌面滑鼠拖曳。
- 暫不為地圖人物、位移箭頭或其他可拖曳物件加入方向鍵控制。
- 不加入需要文字輸入的控制，避免手機彈出軟鍵盤。
- 一般按鈕仍應使用原生 `button` 元素，保留瀏覽器本身的焦點、Enter 和 Space 操作。
- 觸控目標、拖曳穩定性及手機版體驗優先於完整鍵盤操作覆蓋。

## 先做

這一階段完成後，項目應達到「可以可靠地作為低風險 Moodle 練習發布」的水平。

### 1. 修正 SCORM 1.2 manifest

四份 manifest 的：

```xml
adlcp:scormType="sco"
```

改為：

```xml
adlcp:scormtype="sco"
```

驗收：

- 四份 manifest 通過 SimLab SCORM 1.2 manifest profile 及語義連結驗證；此項不宣稱取代官方完整 schema set。
- 所有活動仍能成功打包。
- ZIP 根目錄包含 `imsmanifest.xml`。

### 2. 修正 SCORM 提交失敗處理

調整共用 `sim/shared/scorm.js`，避免 Moodle 寫入失敗但畫面仍顯示成功並鎖定。

要求：

- 只有 `LMSInitialize()` 真正成功後才標記為已初始化。
- 捕捉 LMS API 呼叫所拋出的 exception。
- 檢查 score、lesson status、exit、commit 和 finish 的回傳結果。
- 讀取並記錄 `LMSGetLastError()`、`LMSGetErrorString()` 提供的錯誤資料。
- `submitResult()` 返回清楚的提交狀態，而不是直接返回評分結果。
- 最低限度在 raw score、lesson status 和 commit 成功後，活動才可顯示「已提交」並鎖定。
- 提交失敗時保留學生答案，顯示「未能傳送到 Moodle，請重試」，並保持提交按鈕可用。
- 防止學生重按按鈕時同時產生多個提交請求。

活動在 Live Server 找不到 LMS API 時，繼續使用現有 local fallback，讓開發測試可以正常提交。

### 3. 加入 fake LMS 自動測試

至少測試以下情況：

- initialize 成功及失敗。
- score raw 寫入失敗。
- lesson status 寫入失敗。
- commit 失敗。
- finish 失敗。
- LMS API 拋出 exception。
- 失敗後可以重新提交。
- 沒有 LMS API 時 local fallback 正常運作。

測試亦要確認：提交失敗不會鎖定活動，成功提交才會進入 review-only 狀態。

### 4. 修正已確認的評分與模型錯誤

#### FBD 空白答案

- 完全空白答案應為 `0` 分，不可因為沒有多餘力而取得 clean completion 分。
- clean completion 分只可在必要力完整且沒有多餘力時取得。
- 空白或明顯未完成時可以提交，以便學生取得回饋，但提交前顯示確認提示。

#### 平面鏡重複光路

- 同一來源的兩束光必須使用可辨識的不同入射路徑。
- 建議以鏡面入射點距離作判斷，容差寫成容易修改的常數。
- 重疊或過度接近的光路不能取得完整性滿分。
- 回饋應指出同一物點需要兩條不同路徑。

#### 地圖最後一段路程

- 到達目標門檻後，吸附到入口前的剩餘道路距離亦要加入 `routeDistance`。
- trace 要包含完整走到入口的最後一段。
- 加入到達容差內外的邊界測試。

### 5. 建立最低限度品質檢查和 CI

提供一致的根目錄指令，至少包括：

```text
npm run check
npm test
npm run package -- <slug>
npm run package:all
```

GitHub Actions 至少執行：

- 所有 JavaScript 語法檢查。
- 四個活動的 scoring tests。
- 共用 SCORM fake LMS tests。
- 四份 manifest profile 及語義連結 validation。
- 打包全部活動。
- 檢查 ZIP 的 `imsmanifest.xml` 位於根目錄。
- 確認 ZIP 沒有 tests、screenshots 或暫存檔。

### 6. 修正低風險、結論明確的小問題

- 修正參考系 restore 把空白 LMS score 當成 `0`。
- 修正地圖合法 seed `0` 無法恢復。
- 更新 README 和 AGENTS 的活動清單，使其包含目前四個活動。

## 後做

這一階段提升課堂使用的韌性及日後維護體驗，但不阻塞第一輪發布。

### 1. 保存未提交的中途進度

只在重要狀態改變時保存，不在每次 pointer move 時寫入 Moodle。

建議保存時機：

- 完成地圖一段路程或一組答案。
- 完成參考系一輪觀察或保存一題答案。
- 平面鏡或 FBD 到達具意義的完成階段。
- `pagehide`。

未完成活動使用 `cmi.core.exit = suspend` 並 commit；只有正式提交才使用 `logout` 和 finish。

實施前要為每個活動定義 compact draft snapshot，避免超出 SCORM 1.2 的儲存限制。

### 2. 統一 review snapshot 驗證

所有活動使用一致的基本格式：

```js
{
  version: 1,
  activity: "activity-slug",
  answer: {},
  score: 0,
  passed: false
}
```

恢復已提交 attempt 時：

- 驗證 version、activity 和答案結構。
- 以保存的結構化答案重新執行 scoring。
- 與 Moodle raw score 和 snapshot score 比對。
- 資料不完整、損壞或版本不相容時，顯示安全摘要，不讓頁面因 restore error 中斷。

先擴充現有參考系活動的做法，不急於建立大型共用框架。

### 3. 停止參考系活動的永久 Canvas 重畫

- 只在播放動畫時維持 `requestAnimationFrame` loop。
- 暫停、等待、作答、提交及 review 狀態只在畫面狀態改變時重畫。
- resize 時重畫一次。
- 頁面隱藏時停止動畫，恢復播放時重設時間基準。

這項修改不改變學習流程，主要降低手機 CPU、電量和發熱負擔。

### 4. 改善跨平台打包

- 移除對作業系統 `zip` executable 的依賴。
- 使用小型 Node 開發依賴產生 ZIP；依賴不包含在學生使用的 SCORM package runtime 內。
- 不再用格式敏感的 regex 解析 manifest file entries。
- 使用 XML parser，或由明確的活動檔案清單建立 package 並與 manifest 交叉檢查。

### 5. 小步整理重複程式碼

只在至少兩個活動出現相同、穩定的需求後才抽取共用 helper，例如：

- snapshot envelope validation；
- SCORM 提交狀態顯示；
- 純 DOM 文字節點 helper。

暫不因為個別 `main.js` 較長而進行完整 MVC 拆分，也不引入前端框架。

## 暫不進行

以下事項目前不列入工作範圍：

- 防止學生在瀏覽器修改分數。
- 加入後端、LTI 或 Moodle server-side 重新評分。
- 限制作答次數。
- 在同一 attempt 內清除答案並重做。
- 地圖活動的隱藏答案評估模式。
- 地圖活動的練習／評估雙模式。
- 為拖曳物件加入方向鍵控制。
- 為所有活動追求完整鍵盤操作覆蓋或正式無障礙認證。
- 引入大型前端框架或全面重寫現有活動。

## 尚待確認的一項教學規則

### FBD 箭頭長度是否代表力的相對大小

目前評分只要求箭頭超過最低長度，沒有檢查相反方向的力是否等大；但回饋會說明物體靜止及合力為零。

建議採用以下方案：

- 箭頭長度代表力的相對大小。
- 支持力與重力的長度差，以及外力與摩擦力的長度差，容許約 `±20%`。
- 不要求垂直力與水平力互相等長。
- 評分回饋指出哪一對力尚未平衡。

如果不採用長度評分，替代方案是固定箭頭長度，並在題目中清楚說明本題只評力的種類、方向和作用點。

這項會改變 FBD 的教學要求和 scoring rubric，因此在實施前需要最後確認。

## 建議執行次序

1. Manifest 合規修正。
2. SCORM 提交結果契約及錯誤處理。
3. Fake LMS tests。
4. FBD 空白分、平面鏡重複光路、地圖尾段距離。
5. 根目錄品質指令及 CI。
6. Restore 小修正及文件同步。
7. 中途保存和統一 snapshot validation。
8. Canvas 效能及跨平台打包改善。
9. 按實際重複情況整理少量共用程式碼。

完成「先做」後，應先用學生帳戶在 Moodle 測試一次完整流程：進入活動、提交、記錄分數、重看已提交 attempt，以及返回入口開始新的 attempt。
