# 家庭電路工作台：作者與維護指引

非評分、無 SCORM attempt 的 standalone 工具。入口為
`sim/circuit-household-workbench/index.html`，打包使用
`npm run package:circuit-platform`，輸出
`output/circuit-household-workbench-standalone.zip`。Moodle 使用 File resource。
完整範圍、具名教學曲線、數值基準及驗收見[實施計劃](../plans/33-circuit-household-workbench.md)。

預設是中學生概念圖：只畫市電、電能表、總開關、L／N／E、一個插座及一盞燈。
選線只改觀察；點插座才放大三孔、插頭保險絲與金屬外殼，選地線才提供漏電示範。
燈的開關、漏電及保護使用同一個 editor session 的正式電路，沒有第二套假讀值。
`CircuitHouseholdPresets.create('concept')` 是完整合法的簡化並聯回路；
`concept.js`／`concept.css` 擁有學生概念圖。頁首「⋯」才進教師搭建工具，H01–H18 保留於此。
返回概念圖會按原有未保存變更確認流程載入標準回路；刷新從標準冷態開始。

沿用[共用 editor API](circuit-activity-authoring.md)，掛載設定為
`analysis:'household-rms'`，預設文件由 `CircuitHouseholdPresets.create('concept')`
建立；作者也可用 `create('H01')` 或 `CircuitModel.empty('household-rms')`。載入可選的
`household-runtime-assets.json` 依賴；不要載入 AC transient 後端。
家庭頁的 `assets.json` 已列齊共用核心、家庭模組及外層檔案。

| 擁有者 | 責任 |
|---|---|
| `circuit-household-components.js` | L／N／PE、源 N–PE 電氣連結、多端子內部支路、家電銘牌／絕緣／故障、外觀；registry 參數是嚴格文件白名單 |
| `circuit-household.js` | 共用電阻求解轉接、有號係數及非負 RMS 大小、固定源 PE 對地讀值、差流、時鐘、事件、熱量、電能、session 驗證 |
| `circuit-protection.js` | HH-teaching-1 解析熱更新及最早事件；不是 B／C／D 型或實物時間規格 |
| 共用 `CircuitEditor` | 接線／相機／捕獲／預覽／權限／只讀／歷史／卸載；每 instance 擁有獨立 session |
| 家庭外層 | H01–H18、配電配置、五組工具箱、房間定位、摘要、文件下載與匯入；不另跑第二套電流模型 |

DC 文件保持 v6，AC 保持 v7，家庭為 v8／modelRevision 1。DC 的
`CircuitSolver.solve` 明確拒絕家庭文件；`solveResistive` 是共用低層網絡計算。
家庭消費者使用 `CircuitHousehold.solve` 或 editor `getAnalysis()`／`voltage()`。
`mode:'household-rms'` 明示有效值語義；`current`／`voltage` 內部保持有號
正弦係數，`currentRms`／`voltageRms` 是大小，`power`／`meanPower` 是平均功率。
四端 W 表保留接反符號，L／N 感測使用有號和；不能相減兩個無號儀表數字。

`earthReference` 是供電源的 `:e`，新增市電源時自動建立；空白可為 null。
UI 的任意 0 V 設定不改變對地測量。孤島對地讀值是 null，不能當成零或安全。
I 類有 PE 與外殼端；II 類沒有 PE，基本絕緣失效不建立故障支路；非導電
外殼沒有虛構金屬端點。改類別前須先拔開會消失的端子，非法導線參照拒絕匯入。

搭建、改接或插拔須先關閉市電；幾何、顯示及故障實驗不重設時鐘。
暫停凍結熱量與 kWh，斷電但繼續時間會冷卻。熔絲只用更換恢復；MCB／RCD
復位保留熱記憶及尚未排除的故障。拖板的共同載流限制與插頭熔絲分開，
不另虛構拖板內第二條熔絲。線段發熱只顯示無量綱熱狀態，不推算攝氏溫度。

家庭新增 editor 命令／API：

```js
editor.execute({type:'setWireProperties', id:'w1', role:'PE', rating:20, open:false});
editor.resetProtection('c6'); // 自動判斷復位或更換；使用相同權限、只讀及歷史邊界
editor.focus('c6');
editor.advanceTime(1); // 單次 >0 且 ≤10 s，並暫停
const saved=editor.captureSession();
editor.restoreSession(saved); // 先驗證、原子替換、暫停
```

`CircuitHouseholdPersistence` 分開配置及實驗用途。配置限 256 KiB；實驗
限 1 MiB，包括 v8 文件、版本、來源示例標記與完整 physics。UI、播放意圖、
瞬時波形和取樣歷史不保存；刷新從預設重新開始。未知欄位、錯誤集合及不可能
保護狀態拒絕，原文件/session 保留。事件顯示歷史最多 100 筆，權威熱量和
電能不截短。自由 wire rating／role／open 使用同一參數權限管道。

家庭專用手機 CSS 保留 32 px 全高側條；一般空白使用 pan-y，平移／繪線
模式及局部可拖目標使用相應捕獲。共用畫布操作列移至控制面板，短手機舞台
有實際繪圖空間。source／ZIP trusted-touch 驗證仍須按[生產指引](simulation-scorm-production-guide.md)
逐案執行，不能以 CSS 或 desktop 截圖代替。

Node 四個家庭測試、家庭 browser driver 與 standalone asset list 已登記。
家庭屬 `circuit-family`；共同核心變更選取全部五個電路包。獨立
`mobile-scroll-browser-regression.js` 支援 registered standalone 清單與實際
ZIP 資源指紋；T0 用 `--mode=standalone --entry=source|package`，T1–T3 用
`--mode=source|package --host=T1|T2|T3 --slugs=circuit-household-workbench`。
`--phases=all` 使用正式示例與續作，不產生虛構評分狀態。

真手機／真 Moodle 證據與本地自動驗證分開。後續 H6 評量包須各自定 rubric、
4000 bytes codec 及提交生命週期，不能繼承工作台的非評分保存方案。
