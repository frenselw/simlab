# 家庭電路工作台

非評分的家庭電路概念工作台；使用同一 `CircuitEditor.mount()`、工作台 UI、接線／相機／歷史及全螢幕。入口為 [家庭工作台](../sim/circuit-household-workbench/index.html)，需求及驗收決定見[計劃](../plans/33-circuit-household-workbench.md)。實際驗收狀態以計劃的紀錄為準；本地瀏覽器不能代替真手機或 Moodle。

## 共用接合

- `analysis: 'household'` 明確選取家庭有效值模型；DC 的 v6 及 AC 的 v7 不作隱式轉換。家庭 runtime 只由家庭入口載入，DC／AC 不增加家庭依賴。
- [元件](../sim/circuit-workbench/circuit-household-components.js)登記十一類器件、端子及同一套實物／符號 SVG；家電款式、功率、故障及人物站立狀態使用既有檢視器與快捷選項。
- [接線規則](../sim/circuit-workbench/household-connections.js)供模型、接線提交、元件吸附及匯入共用。供電端固定身份與家電引線預定用途分開；家電兩條工作線的九種接法、外殼引線錯接及未接均合法。
- [模型](../sim/circuit-workbench/household-model.js)使用共用 solver 的線性網絡求解能力；擁有接觸、保護計時、事件及電能。對地電勢使用供電等效地；懸浮電勢不自行設成零。
- [介面補充](../sim/circuit-workbench/circuit-household-ui.js)只接入既有畫布、選取檢視器、說明及一行觀察，不另造編輯器或題目流程。
- [示例](../sim/circuit-household-workbench/presets.js)是八個獨立小電路，加保險絲變式及空白工作台；示例不鎖接線、不評分，也不以預設接法替代實際求解。

## 物理及讀值

單一 230 V、50 Hz 市電源，採有效值電阻等效：家電 `R = 230² / 額定輸入功率`，工作電流、功率及外殼電勢按實際連接計算。交流往返箭嘴只作概念示意。

源內阻 0.01 Ω；電表、閉合開關及保護器每通道 0.001 Ω。一般導線及外殼接地連線為理想導體；外殼受損絕緣、接地人體各取 2000 Ω。金屬外殼故障支路固定在家電預定 L 端；反接不會把故障移到另一端。雙重絕緣的指定故障只破壞內層，外層仍隔離。

斷路器／保險絲連續超額 2 s 動作；漏電保護器差流 ≥30 mA 持續 0.10 s 動作，均是教學延時。處理事件時切分模擬步，同時達條件的器件一起切斷後重算；幀率及元件順序不決定結果。手動復位／更換後，未排除的故障重新累計，沒有自動合閘。

理想接地、固定人體阻值、理想絕緣椅及單層絕緣破損均有模型界限；這些讀值不預測實際傷害或住宅合規。詳細界限放在工作台說明中。

## 文件及權威狀態

匯出封套為 `kind: 'simlab-household-concepts'`、`version: 1`、`model: 'concept-rms-1'`。其 `circuit` 使用獨立的 `simlab-household-circuit` v8／`analysis: 'household'`／`modelRevision: 1` 幾何文件；不是 DC 或 AC 文件的冒用。

封套保存實際接線（含錯接及自由端）、元件參數、`contacts`、`timeSeconds`、`protection` 及 `energyKWh`。市電圖案自帶 L／N 線芯，外接導線兩端均可拖接、拔開及刪除；舊檔的市電 `anchor` 只移除固定標記，保留接線和幾何。只有接地器件引線以 `anchor` 固定器件端，隨器件移除，且不經中間共接點繞道。

每個保護紀錄含狀態、累計秒數、原因，以及 `bodyCurrentSeen`／`bodyCurrentBeforeTrip`。前者保留本次動作計時區間曾有人體電流的事實，後者在跳掣時保存該事件；回到門檻以下、手動斷開或復位清空相應區間。不能因跳掣後電流變零而隱去曾有人體電流。

接觸對象須存在且是家電，手部位置須與外殼接觸相符。站地／站椅切換保留手的接觸位置；搬開人物或用電器、換用不同外殼款式時會解除接觸。匯入先完整驗證，失敗保留原文件；成功載入及復原／重做先暫停。幾何與參數預覽用副本，凍結權威時間，取消不提交。

電流／電壓、SVG、相機、捕獲及面板是派生或暫態資料，不保存為答案。重新整理從 C01 開始，沒有本機自動進度恢復、成績或 SCORM attempt。

## 觸控

手機沿用共用工作台的收合面板、局部 44 px 目標及 24 CSS px 吸附。家庭版畫布兩側各留完整 32 px 原生捲頁區，非操作空白也為 `pan-y`；拖線／拖手使用其本身的 `none` 目標及共用放大預覽。精細拖動時保持底部操作列及觀察句高度，避免重排取消捕獲。

雙指導航沿用共用相機；第二指建立相機手勢時才取消該次原生多指預設動作，單指空白捲動仍由瀏覽器處理。沒有外層 CSS 鎖定、捲動回寫或虛構 host 接收器。部署 owner、逐步樣本及可信輸入見計劃的 T0–T3 證據；跨來源 Moodle 與真手機另驗。

## 打包與驗證

資產由 [assets.json](../sim/circuit-household-workbench/assets.json)列出。`npm run package:circuit-platform` 同時重建 DC、AC、家庭工作台及兩個 DC 活動共五包，核對所有 ZIP 檔案與實際原始碼。家庭 ZIP 為 `output/circuit-household-workbench-standalone.zip`，沒有 SCORM manifest。

Node 驗證：`household-connections.test.js`、`household-model.test.js`、`household-state.test.js` 及 `presets.test.js`；[production fixtures](../sim/circuit-workbench/fixtures/household-v1-states.json)涵蓋合法錯接、部分接線、故障、人物及保護／電能狀態。

`tools/circuit-household-browser-regression.js` 檢查原始碼與實際 ZIP。既有 `tools/mobile-scroll-browser-regression.js` 已接受 standalone 資產清單／ZIP，並以家庭 phase profiles 及可信的線端、彎線、共接點、手部、開關、取消、雙指操作補足 T0–T3。這些 runner 及 Node tests 都遵循 test registry 的登記和選取規則。
