# 電路工作台共用架構審視（2026-10-11 更新）

**現行狀態：** [交流實作計劃](../plans/32-circuit-ac-workbench.md)已加入第二個時間後端，共用同一editor／profile／圖形及手勢；DC v6保持，AC v7明確transient。AC模組是可選依賴，以 `ac-runtime-assets.json` 為準，DC獨立入口不需要載入。API、檔案責任及界限見[交流作者與維護指引](circuit-ac-workbench.md)。歷史驗證依其日期／版本解讀，不能當作最新版全套通過。

共用編輯器與活動配置已實作，教師工作台也改用同一個入口。現在製作簡單接線或調參活動，只需提供初始電路、供應及權限、介面選項和本題檢查；不必另寫導線、端子吸附、觸控手勢、指針動畫或直流求解。

計劃第 47 節移除了記錄／圖像，第 48 節完成共用重構；其後加入元件本體吸附、快捷參數並完成整體審核。記錄表、擬合、CSV 及實驗模組維持移除，沒有加回基礎編輯器。

## 已形成的三層

| 層 | 擁有的內容 | 檔案 |
|---|---|---|
| 共用引擎 | 元件、多端子、電路文件、拓撲、電學、有限導線、圖形、標籤與指針 | registry、model、solver、routing、document、renderer、math、meter-motion |
| 可配置編輯器 | DOM、畫布、相機、命中、吸附、接線、預覽、命令、權限、只讀、訂閱、卸載 | `circuit-editor.js`、`circuit-editor-ui.js`、`circuit-editor.css`、`circuit-profile.js`、`circuit-snapping.js` |
| 活動／教師外層 | 本題元件、可做操作、檢查、回饋；正式活動另擁有分數、階段與 SCORM | 教師 `main.js`；學生示例 `activity-profiles.js`、`activity-examples.js`；純檢查 `circuit-checks.js` |

原 `main.js` 現在只掛載教師配置並保留 `window.CircuitWorkbench`。`index.html` 是教師入口，學生示例使用獨立入口 `activity-examples.html`。

## 活動需要與實作

| 需要 | 現在的做法 |
|---|---|
| 只顯示兩盞燈，檢查串聯 | 初始文件只有兩燈，工具箱為空、面板關閉；按實際共接及支路拓撲判斷，不要求有電源，也不以零電流相等作證據。 |
| 給定種類及數量，學生自己取出 | 工具箱白名單及每款庫存；預置元件計入庫存，非法種類、參數及超量的文件亦不能載入。 |
| 固定元件，只准接線 | 學生預設固定全部元件；按 ID 或類型開放例外。接線、拔線、彎線沿用原操作。 |
| 拿元件接線 | 開放 move 及接線後，自動使用共用的本體拖動吸附；兩端同接及共接點保持、有限線長、單步歷史與取消都不需活動重寫。 |
| 只准改滑片位置 | `params:['position']`；阻值、孔數、位置、方向都可固定，未開放的輸入不顯示。 |
| 檢查滑片向右令燈變暗 | 在副本取三個滑片位置，由求解器計算燈功率及單調變化，處理實際元件方向，排除未接、短接、固定阻值或反方向。 |
| 學生不見教師／進階功能 | settings、文件、範例等介面不掛載，也不進 Tab 焦點順序；畫布數值由本題的 display 決定。 |
| 隱藏按鈕後仍不能越權 | 預覽、滑鼠、觸控、鍵盤、面板、公開命令和載入均受相同 profile 檢查；作答不能匯入權限配置。 |
| 提交後檢視 | `setReadOnly(true)` 取消未完成手勢並拒絕電路修改；移圖、縮放、全螢幕及讀錶保留。正式活動外層仍擁有 pending／recorded 規則。 |
| 切換活動或同頁多個電路 | `mount/destroy`；DOM ID、CSS、事件及相機按 instance 分開，卸載停止動畫、observer、捕獲及訂閱。 |
| 接入題目／評分 | 檢查回傳 passed／message／evidence，不內建分數或提交；本題 rubric、部分分及 SCORM 在外層。 |

完整可複製配置、API 及命令見[活動製作指南](circuit-activity-authoring.md)。未知配置欄位會報錯，避免設定拼錯後默默開放不需要的內容。

## 後續維護與交流版本邊界

2026-10-07 的後續路線見 [DC 共用核心與 SCORM 架構計劃](../plans/29-circuit-platform-dc-scorm.md)。D1／D2 已加入無內部頂欄的嵌入配置、學生工具箱款式歧義檢查，並把短路／過載判斷集中到 solver。2026-10-08 按使用者要求延續 D3–D5，新增[兩燈串聯](../plans/30-circuit-dc-series-build.md)及[滑片調參](../plans/31-circuit-dc-rheostat-adjust.md)兩個評量入口，各自擁有評分及保存，共用 `circuit-activity-runtime.js`／`circuit-activity-page.js` 接合 SCORM。`wirePointLimit` 讓活動以有限的實際線形保存，教師預設不變；`runtime-assets.json` 與 `package:circuit-platform` 當時實證一份核心供三個DC包重建；加入AC後目前統一重建四包。真 Moodle／實機證據獨立於 package-ready，不能由本地瀏覽器推定。AC非評量工作台及兩個教學示例已實作；正式AC評分、家庭及高壓輸電活動仍未定案，未實作接口不能當成可用API。

目前 DC 依賴與責任如下：

| 使用者 | DC 依賴及邊界 |
|---|---|
| `CircuitEditor` | 透過 `CircuitSolver.solve(doc, relayStates)` 求解，relay Map 按 instance 管理，僅同步已提交文件；讀值／兩點電壓／check 的分析沿用相同狀態，預覽不推進或重置該狀態 |
| `CircuitChecks` | `topology` 使用 registry 的靜態 `dc()`；powered series 及 slider 三點取樣使用同一 solver。這些是靜態 DC 證據，動態繼電器評量須另定取樣，不能套用默認未吸合接法 |
| `CircuitSolver.hazards(doc, analysis)` | 使用同一文件與分析的 relay contact、端點、線阻及讀值判斷短路／過載，回傳 wires／components 的標記及 short／overload；可在 Node 使用，不依賴畫圖、MathJax 或 DOM |
| `CircuitRenderer.visualState()` | 保留相容入口，轉用 solver 的 hazards；顏色、燈光及發熱圖形留在 renderer，閾值取 solver 的 `hazardLimits` |

DC穩態方程及v6文件語義保持自己的邊界；AC明確選時間後端及v7文件，不提供全域分析模式。新增分析模型仍須同步處理solver、讀值／probe／renderer／hazards及活動檢查各依賴，不能只改畫圖。

教師入口與各學生活動應引用同一份核心原始碼；導線、吸附、標籤、儀表外觀或手勢的通用改進在核心修改一次，由配置控制各活動是否顯示或開放。題目專用的檢查、數據記錄／圖像、分數及回饋留在活動外層。不要為每個活動或電流種類複製一份編輯器。

## 現行AC責任與共用修改

| 責任 | 擁有者／邊界 |
|---|---|
| 操作／配置 | 同一 `CircuitEditor`及profile選`dc`或`transient`；接線、相機、權限、只讀及卸載共用 |
| 時間模型 | `CircuitTransient.Session`擁有積分、事件及權威physics；核心session version 1／modelRevision 1，AC doc v7 |
| 量測／歷史 | `CircuitObservation`按接受時間步求RMS／峰值／磁通觀察，波形及觀察配置有界，非權威physics |
| 顯示 | 共用renderer／Math處理電流、標籤及字形；AC display、場圖、連續發電機及scope/UI模組處理時間模式呈現 |
| 活動 | 預設及無評分例子在AC presets／outer scripts；題目、rubric、codec及SCORM仍由正式活動自己的外層擁有 |

電流箭頭配色及未選取概覽移除等通用改進在共用檔案改一次，DC／AC同時生效；顯示歸零不裁剪原始模型或保存值。AC初始／restore的理想磁通與RMS需重收集，耦合共同磁通由線圈狀態派生；詳細契約見[AC指引](circuit-ac-workbench.md)。檔案依賴及精準測試入口也由該指引維護，不在各活動複製第二份規格。

來源共用不會自動更新已發布的 ZIP。核心更新後重建教師包及引用它的活動包，檢查實際依賴與解壓入口；測試按改動選擇最小重現及相鄰回歸，記錄版本和實際執行範圍，沿用未改部分的歷史證據時明確註明。

## 保留的邊界

- 活動配置是可信本地程式，DC答案使用嚴格v6 document（2026-10-06加入單線及新線預設電阻；v1–v5匯入補0 Ω，保留接線／接孔遷移）；AC使用明確v7／modelRevision，兩種後端文件不能互相冒用。導線電阻走既有直流電阻支路，學生預設固定，外層可明確開放逐線調整；相機、粒子、慣性、浮窗與選取仍為暫態。合法未答及部分接線能保存、恢復並繼續操作。
- `series` 是單支路元件的拓撲檢查，`connected` 只驗證必要共接，三點滑片效果亦有取樣界限；複雜題目可用自訂 check 配合相同求解器。它們不是適用於所有電路的評分 rubric。
- 目前沒有「在求解中存在、卻看不見又能吸附」的隱藏元件模式。未提供的元件不在工具箱，預置文件只包含本題要顯示的元件；特殊隱藏模型需由活動明確設計，不能只把圖形藏起來。
- 新穩態元件仍可透過 registry 自訂端子／支路及 render 本體，工具箱依配置建立。內部流動路徑和某些儀表說明仍採內建型別分派；新元件要補適合自己的顯示。2026-10-07 已新增繼電器的有限機械延時：instance relay Map 控制先斷後通，由既有 DC solver 求解當前拓撲；五孔線圈與 SPDT 觸點保持隔離。這不包含線圈電感／反電動勢或接點彈跳；電容／電感電氣瞬態已在AC時間後端另有步進、能量及session；時間後端目前不支援該DC機械繼電器，不能把此近似當作完整線圈瞬態模型。
- 教師 JSON 的 256 KiB 上限不是 SCORM 1.2 的 ≤4000 bytes 作答方案。正式活動須定題目版本、精簡快照、round-trip、部分分與合法續作，依 [production guide](simulation-scorm-production-guide.md) 接入 SimScorm／SimActivityFlow。前端限制不是高風險評分的信任邊界。

## 驗證

四種技術示例沒有成績、提交或 standalone 答案持久化。精準測試覆蓋拓撲／參數／滑片效果正反例、配置限制、合法部分答案恢復、source 與解壓 ZIP 的桌面／手機模擬操作、只讀、全螢幕、活動卸載／多 instance，以及教師原有關鍵操作。實際證據及範圍見[計劃第 48 節](../plans/28-circuit-workbench.md#48-可配置活動編輯器與檢查接口2026-10-04)；不把這些結果當作實機手機或真 Moodle 驗收。

[三位 reviewer 的整合報告](circuit-workbench-audit-2026-10-04.md)對應其記錄的最終 runtime 指紋；其後微電流動畫及示例整理的精準證據見[計劃第 52 節](../plans/28-circuit-workbench.md#52-微電流動畫自適應及移除重複示例2026-10-04)。不能把歷史審核當作未來改動的自動通過。
