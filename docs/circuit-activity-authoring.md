# 用共用電路編輯器製作活動

`CircuitEditor.mount(host, config)` 是現已實作的入口。教師版的 `main.js` 也使用它；學生版不必複製畫布、接線、手勢、儀表或求解程式。可先開啟 `sim/circuit-workbench/activity-examples.html`，試用四種配置；實際可複用的設定在 `activity-profiles.js`。

## 最快開始

複製 `activity-examples.html` 作為新活動的外層，保留共用 CSS／scripts 的相對路徑，將最後的 `activity-examples.js` 改成自己的活動程式。若放在另一個活動資料夾，所有共用依賴改指向 `../circuit-workbench/`，並在該活動 manifest 列出。宿主需要明確高度，例如 `height:70dvh`；編輯器填滿宿主，不控制外層頁面捲動。

```js
const config = CircuitActivityProfiles.create('two-lamps');
const editor = await CircuitEditor.mount(
  document.getElementById('activityEditor'), config
);
checkButton.onclick = () => {
  const result = editor.check();
  feedback.textContent = result.message;
};
```

四個示例的題目、選擇器、檢查按鈕、回饋及只讀預覽都在外層。示例沒有分數、提交或持久化；正式活動由自己的外層接入題目、rubric、部分分、SCORM 與 attempt lifecycle。

## 寫一份配置

例如只提供兩盞固定的燈，其他元件及教師設定完全不出現在介面：

```js
const doc = CircuitModel.empty();
const lamp1 = CircuitModel.add(doc, 'lamp', 260, 220);
const lamp2 = CircuitModel.add(doc, 'lamp', 560, 220);
doc.cables = {count:4, length:600};
doc.display.values = false;
doc.display.flow = 'off';

const editor = await CircuitEditor.mount(host, {
  role:'student',
  title:'兩燈串聯',
  initialDocument:doc,
  palette:[],
  ui:{inspector:false, viewToggle:true},
  check:answer => CircuitChecks.series(answer, [lamp1.id, lamp2.id])
});
```

學生預設不能搬動、旋轉、刪除、改名、開合或改元件參數；可以取線、接線、拔線、彎線及復原。導航、手機雙指拖移／捏合、讀錶及全螢幕沿用原功能。`wires:false` 在學生及教師配置都禁止線路變動，包含命令、鍵盤及載入；`undo:false` 可關閉復原／重做。

開放 `move:true` 並保留接線權限時，也可拖元件本體，讓白色接孔靠近懸空導線端點接好；不需要活動另寫吸附程式。接孔高亮是暫態預覽，放手才將搬動及接線合成一筆變更。兩個接孔可同時接線，多線共接點整組接到同一孔；保留已接線並遵守有限長度。移開、取消或第二指導航不會留下新接線。`wires:false`、固定元件及只讀仍禁止這條接線途徑；程式 `move` 只搬動，明確接線繼續用 `attach`。兩個入口都需要本地 `circuit-snapping.js`，新活動的資產清單也要列入。

### 指定工具箱及庫存

```js
palette:[
  {type:'battery', limit:1},
  {type:'switch', limit:1},
  {type:'lamp', key:'ideal-lamp', label:'恆阻燈',
   params:{model:'ideal', resistance:12}, limit:2}
],
components:{default:{move:true, rotate:true, remove:true, switch:true}},
ui:{palette:true, inspector:true}
```

工具箱只建立這三種按鈕；上限包含已放在初始電路的同類元件。`key` 唯一，供命令新增指定款式；`params` 與 registry 預設合併。不同款式應以固定的模型參數區分，不要同時開放修改用來區分款式的參數。預置元件可以不在工具箱中，仍顯示並參與求解。

編輯器新增及複製元件時保留初始元件 ID，刪除預置元件後不把該 ID 派給其他工具箱元件，避免套錯 `byId` 權限。未開放 `label` 的新增元件使用 registry 預設名稱，載入亦檢查；初始元件仍使用作者提供的名稱。工具箱的 `label` 是按鈕文字，不是新增元件名稱。

### 元件與參數權限

規則依 `default` → `byType` → `byId` 覆蓋；後者最精確。六個欄位是 `move`、`rotate`、`remove`、`label`、`switch`、`params`。`params` 可用 `false`、`true` 或參數名稱陣列；`closed` 應由 `switch` 開放。未開放的參數輸入及元件操作不出現在學生面板。

```js
components:{
  byType:{switch:{switch:true}},
  byId:{c4:{params:['position']}}
}
```

這樣四孔變阻器 `c4` 只能改滑片位置，不能改阻值、孔數、位置或方向。初始文件已有的 `locked`、`editable` 及 `policy` 仍適用；配置不能越過它們解除固定。一般活動可保持文件的 `policy.mode='free'`，由外層配置固定元件，避免舊的整體固定模式擋住指定參數。

### 介面裁剪

`ui` 支援 `palette`、`inspector`、`readings`、`presets`、`files`、`settings`、`probe`、`viewToggle`、`help`、`wireList`、`status`、`quickParameters`。學生預設開啟 inspector、外觀切換和快捷參數，其餘關閉；`settings/files/presets` 只允許教師角色。關閉的部分不掛載進 DOM、不進 Tab 焦點順序。元件名稱、電源電壓、電阻、功率、電流示意仍由初始 document 的 `display` 決定；實物儀表統一指針式，舊檔 `display.meters` 僅保留相容資料；`ui.readings` 控制面板的額外物理讀值，並非畫布標籤。

選取元件後，快捷區只顯示該元件獲准修改的主參數：電源電動勢、電阻／燈泡電阻或變阻器滑片位置。它不依賴 inspector；`ui:{inspector:false, quickParameters:true}` 可讓學生只調整指定參數，無須打開面板。仍須用 `components.byId` 等規則開放實際參數，固定參數及只讀不顯示可改控制；`ui.quickParameters:false` 完全移除此區。百分比以 0–100 顯示，`position` 仍保存 0–1。

自訂 registry 元件可在定義中指定 `primaryParameter:'參數名稱'`。該參數須是有合法 `min/max/step` 的數值，沿用其 `label/unit/factor`；沒有主參數的元件不出現快捷區。快捷加減與輸入都走原有 `setParam`、權限及單步復原，沒有第二份參數或作答快照。

## 檢查接口

這些純函數接受嚴格 circuit document，回傳 `{passed, message, evidence}`，不給分、不提交；可在 Node 測試，也可在活動外層直接呼叫。`config.check(answer, analysis)` 可自行組合或編寫本題條件；controller 只傳入已完成編輯的快照及重算分析，不會把拖動預覽當成答案。

| 函數 | 用途與界限 |
|---|---|
| `series(doc, ids, {requirePowered:false})` | 按導線共接及元件導電支路判斷串聯，可檢查沒有電源的兩盞燈；短接、並聯及分支不通過。只適用於每個目標有一條有效支路的元件。 |
| `series(doc, ids, {requirePowered:true})` | 再要求每個目標有非零、可確定的電流，且電路沒有求解診斷；開路時零電流相等不算正確。 |
| `connected(doc, [['c1:b','c2:a'], ...])` | 每組端點須經導線接通；支援中途共接及多條線，不按畫面距離或交叉判斷。這是必要連接檢查，額外連線應另用拓撲或自訂條件排除。 |
| `parameter(doc, {id,key,value,tolerance})` | 檢查指定值；亦可用 `min/max` 檢查數值範圍，模型等字串採精確比對。 |
| `sliderEffect(doc, {rheostat,lamp,direction:'right',effect:'dimmer'})` | 在副本的 20%、50%、80% 位置重算實際燈功率，要求正功率、單調變暗及至少 3% 變化；原作答不變。支持左／右／上／下和 brighter；旋轉後按實際滑片方向解釋。這是三點效果檢查，複雜自訂模型若需全行程證明，應另寫本題檢查。 |
| `all(...results)` | 組合條件並保留每項證據。 |

四孔變阻器採 A=`a`、B=`c`、P₁=`b`、P₂=`d`。同一滑片的兩孔等電位。限流接 A–P 時向右增加阻值、燈變暗；B–P 的效果相反，A–B 與 P₁–P₂ 不產生要求的滑片控制。檢查會驗證電路，沒有把接孔圖形當作答案。

## Controller、保存與只讀

| 方法 | 行為 |
|---|---|
| `getDocument()`／`exportDocument()` | 已完成編輯的獨立快照／JSON；不含配置、相機、選取、浮窗及動畫。 |
| `getAnalysis()`／`voltage(a,b)` | 重算已完成編輯的電路；未知電流或浮接跨區電壓仍保留 null。 |
| `onChange(fn)` | 只有成功提交的變更、復原、重做或載入才通知；回傳取消訂閱函數。 |
| `loadDocument(jsonOrObject)` | 嚴格驗證及重新套用本活動的固定元件、參數、白名單、庫存、顯示與線長限制；拒絕非法資料時保留原電路。只讀時不接受載入。 |
| `execute(command)` | 受相同權限檢查的程式命令；成功 true，拒絕 false 並提示；格式／已卸載錯誤 throw。 |
| `check()` | 呼叫本活動檢查，回傳結果副本；不修改作答。 |
| `setReadOnly(true/false)` | 取消尚未完成手勢、凍結電路修改；仍可移圖、縮放、讀錶及全螢幕。 |
| `fit()`／`cancel()` | 全圖或取消手勢，不改作答。 |
| `destroy()` | 可重複呼叫；解除事件、動畫、observer、捕獲、訂閱及 DOM，再可於同一宿主掛載新活動。 |

命令格式：

```js
editor.execute({type:'addComponent', key:'ideal-lamp', x:260, y:220});
editor.execute({type:'addWire', x:400, y:220});
editor.execute({type:'attach', id:'w1', end:'from', target:'c1:b'});
editor.execute({type:'attach', id:'w1', end:'to', target:'c2:a'});
editor.execute({type:'setParam', id:'c4', key:'position', value:.75});
```

其餘命令為 `detach{id,end}`、`straighten{id}`、`remove{id}`、`move{id,x,y}`、`rotate{id,direction:1/-1}`、`flipMeter{id}`、`toggleSwitch{id}`、`undo`、`redo`。新增線仍受有限長度約束，不能用 `attach` 越過線長。

同頁可掛載多個 editor；ID 自動加 instance 前綴，CSS 只作用於 `.circuit-editor`，指標與鍵盤事件歸所屬宿主管理。只有教師 bootstrap 使用空前綴來保留既有工作台 DOM 介面；其他外層應使用 controller 而非猜固定 DOM ID。原 `window.CircuitWorkbench` API 保留，現在指向教師 editor controller。

正式活動應在恢復／review 之前載入已驗證快照，再設只讀。通用 JSON 最多 256 KiB，不能直接塞進 SCORM 1.2 的 ≤4000 bytes suspend_data；各活動須另定題目版本、必要答案欄位及壓縮編碼，依 [production guide](simulation-scorm-production-guide.md) 驗證 blank／partial／pending／recorded 的 round-trip 和合法續作。活動配置來自可信本地程式，不跟學生檔案匯入；前端限制不是高風險評分的信任邊界。

## 共用核心的維護與發布

新活動引用 `../circuit-workbench/` 的原始核心，以配置裁剪工具及權限；不要把核心複製進活動資料夾。題目判斷使用已提交編輯的 document 與 solver analysis，不以粒子速度、指針暫態位置或畫面距離作為物理答案。每個電氣連通區的流動示意速度會自適應；不同電路或工作點之間不能以動畫快慢比較絕對電流。

新增活動仍須自己的計劃、目錄登記、rubric、精簡持久化及 SCORM manifest。manifest 要列出實際使用的共用 CSS／scripts、MathJax、全螢幕等依賴；教師 `assets.json` 是獨立包的清單，不會替活動補齊依賴。核心更新後重建引用它的活動 ZIP；檢查來源和解壓成品，不能只改來源便沿用舊包。整體責任及未實作的交流擴展方向見[架構與維護說明](circuit-workbench-architecture-review.md)。

## 驗證範圍

活動重構的精準測試為 `node sim/circuit-workbench/activity-core.test.js` 和 `node tools/circuit-workbench-browser-regression.js --activity-core-smoke`。後者包含 source／實際解壓 ZIP、1280／390 px、可信滑鼠與觸控接線、參數、固定限制、只讀、全螢幕、雙指導航、恢復續作、兩個 instance／卸載，以及原教師工作台的關鍵操作。證據在 `output/playwright/circuit-workbench/activity-core.json`；實機手機與真 Moodle 尚未驗證。DC 求解模型不因重構而增加電容／電感等瞬態能力。

快捷參數另有 `quick-controls.test.js` 和 browser runner 的 `--quick-controls-smoke`；針對參數權限、加減／輸入、單步復原、保存恢復後續調整、手機對齊及拖動穩定，也核對自動 ID 前綴的 label 關係和離開輸入欄時提交原元件。實際證據見[計劃第 50 節](../plans/28-circuit-workbench.md#50-對齊操作列與快捷參數2026-10-04)。

微電流動畫使用 `flow.test.js`／`component-flow.test.js` 及 `--micro-flow-smoke`；元件本體接線使用 `component-snapping.test.js` 及 `--component-snap-smoke`。按改動選擇必要檢查及相鄰權限／恢復案例，無需每次重跑完整教材和其他活動。具體已執行結果見[工作台計劃](../plans/28-circuit-workbench.md)，區分歷史審核、後續改動和未驗證平台。

A／V 接孔於 2026-10-05 內移，文件改用 v5；v1–v4 匯入會先驗證舊幾何，再遷移相連線形。新活動使用 CircuitModel.empty()，不要把版本號硬編碼為 v4。
