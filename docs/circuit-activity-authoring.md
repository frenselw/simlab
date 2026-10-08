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

開放 `ui.palette` 後，同一工具箱支援點選／鍵盤新增及滑鼠／觸控筆拖到畫布放置，毋須額外配置。手指保留點選及原生面板捲動。拖放預覽不修改文件或庫存；釋放沿用 `addComponent` 命令的白名單、固定款式參數、數量上限與初始 ID 保留規則，取消不通知作答。

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

工具箱只建立這三種按鈕；上限包含已放在初始電路的同類元件。`key` 唯一，供命令新增指定款式；`params` 與 registry 預設合併。學生配置的不同款式必須以不可調參數區分；編譯時按 default／byType，以及初始元件的 byId 權限，拒絕可能同時符合多款的庫存歧義。只改 key／label，或以可調阻值／可開合狀態區分款式，都不能建立兩個獨立庫存。固定 model 可區分恆阻與熱燈，同時開放它們的 resistance。預置元件可以不在工具箱中，仍顯示並參與求解。

`limit` 是同款元件在畫布上的數量上限，不是必須使用的數量；達上限後取用按鈕停用，允許刪除的元件刪除後可再取用。學生模式的新增、複製、命令及載入答案均檢查庫存。若題目要求「恰好兩盞燈」，數量條件由活動的 `check`／rubric 判斷。正式活動仍須允許空白／部分作答進入最終檢查與提交，不以用滿庫存作為門檻。

學生款式辨識採實際可調權限；`closed` 只由 `switch` 及文件的 `allowSwitch` 開放，`params:true`／`['closed']` 不會使固定開關狀態可調。文件的 locked／editable／policy 亦適用於初始款式辨識；非法固定值的答案載入仍須拒絕，不能靠恢復繞過工具箱限制。

編輯器新增及複製元件時保留初始元件 ID，刪除預置元件後不把該 ID 派給其他工具箱元件，避免套錯 `byId` 權限。未開放 `label` 的新增元件使用 registry 預設名稱，載入亦檢查；初始元件仍使用作者提供的名稱。工具箱的 `label` 是按鈕文字，不是新增元件名稱。

### 導線電阻

`initialDocument.cables.resistance` 指定新線預設阻值，`initialDocument.wires[].resistance` 指定每條既有線的阻值；單位 Ω，預設 0。學生預設不能調整電阻；可信活動配置可用 `wireResistance:true` 開放逐線調整，不會開放教師設定或全局預設。`wires:false`、只讀及固定模式未開放 `allowParams` 時仍禁止修改。匯入答案會重新檢查阻值權限；固定既有線不能被換成另一阻值，新線必須採初始預設值。

使用 `editor.execute({type:'setWireResistance', id:'w1', value:2})` 修改某條線，沿用單步復原、權限及無效值原子拒絕。阻值不隨幾何修改而變；`connected` 只表示經導線接通，不表示等電位，`series` 判斷會計入有阻導線分支。文件已升為 v6，v1–v5 遷移後所有線及預設阻值為 0。新正式活動需將單線阻值納入自己的權威答案／rubric／SCORM 快照，不能只存畫面或求解結果。

教師控制面板的「取出導線」可用滑鼠／觸控筆拖到畫布；採相同 `addWire` 命令、庫存、預設長度／電阻及取消規則，預覽不建立作答資料。學生示例沒有此面板按鈕，原有底部取線入口及 `wires:false`／只讀限制保持。

### 元件與參數權限

規則依 `default` → `byType` → `byId` 覆蓋；後者最精確。六個欄位是 `move`、`rotate`、`remove`、`label`、`switch`、`params`。`params` 可用 `false`、`true` 或參數名稱陣列；`closed` 應由 `switch` 開放。未開放的參數輸入及元件操作不出現在學生面板。

```js
components:{
  byType:{switch:{switch:true}},
  byId:{c4:{params:['position']}}
}
```

這樣四孔變阻器 `c4` 只能改滑片位置，不能改阻值、孔數、位置或方向。初始文件已有的 `locked`、`editable` 及 `policy` 仍適用；配置不能越過它們解除固定。一般活動可保持文件的 `policy.mode='free'`，由外層配置固定元件，避免舊的整體固定模式擋住指定參數。

原本可搬動、可移除且未接線的元件，也可拖回本 editor 的面板或底部垃圾桶刪除；自由導線須兩端皆未接其他物件，且 `wires` 開放。hover 不改作答，放手只移除正式文件中的該物件，不提交搬動預覽；stock／onChange／undo 與既有 remove 命令一致。`remove:false`、只讀及已接線者不會被這條途徑刪除。垃圾桶沿用原控制，沒有新增配置或把活動生命周期放進核心。

### 介面裁剪

`ui.header` 預設 true，保留完整工作台頂欄。嵌入正式活動時設 false：editor 不掛頂欄、fullscreen button／controller 或 fullscreen target 標記，外層按 shared fullscreen contract 提供完整活動的唯一全螢幕入口。宿主不要自行加 fullscreen target 標記。復原／重做（若 `undo:true`）移至 stage 工具列，面板開關仍可使用；沒有頂欄入口的 `presets/files/settings/help` 須關閉，否則配置報錯。`probe`、外觀切換及其他 stage 控制可按原權限保留。

例如 `ui:{header:false, palette:true, inspector:true}` 可嵌入指定工具箱；外層使用自己的 header、題目／導航及提交區。教師入口的預設不變；教師若採嵌入模式，須明確關閉上述四項頂欄功能。外層須給宿主可用高度，並驗證短 iframe／手機的末端控制可達，不能靠移除頂欄宣稱完成所有 SCORM 版面工作。

`ui.wireCurrents` 控制導線電流標示的開放，教師預設 true、學生 false。開放後，面板可全部顯示／隱藏；inspector 開放時亦可逐線勾選，不依賴 `ui.readings`、教師 settings 或文件 `display.values`。只讀仍能切換這個檢視。`editor.execute({type:'setWireCurrentDisplay',id:'w1',visible:true})` 控制單線；省略 id 控制全部現有線。不合法 id／非布林 visible、未開放 profile 會拒絕且不改文件。`getInteraction().wireCurrents` 回傳暫態可見線 ID；不寫入作答或 JSON，不觸發 onChange，不新增復原步驟；load／destroy 清空，刪線清理，新線不繼承同 ID 的舊選擇。活動要顯示指定示範線，可在 mount 或載入後明確執行命令；匯入答案不能開放功能。數值採即時 solver 結果，方向固定為常規電流；低於 40% 的概覽提示放大查看。匯出 SVG 包含當前標示，SCORM 的題目、評分與恢復仍由活動外層負責。

`ui.potentialDirections` 以相同方式開放電勢方向：教師預設 true、學生 false。「圖上標示」同區提供兩種標示的全部開關，inspector 開放時可逐元件勾選。`editor.execute({type:'setPotentialDirectionDisplay',id:'c1',visible:true})` 控制單元件，省略 id 控制全部現有元件；驗證、只讀、onChange、載入／刪除清理與導線電流一致，`getInteraction().potentialDirections` 回傳暫態 ID。方向由低電勢端指向高電勢端；一般元件使用第一支路，變阻器 A–P、雙量程錶目前接入孔與 −、W 表 V+／V−。等電勢與未知不畫箭嘴。標示以 16 CSS px 文字避讓導線／元件；低於 40% 或同時開啟電勢方向後標籤無法避讓時，使用概覽提示放大／逐個顯示。SVG 包含當前標示；兩種標示新取元件／導線均預設隱藏，不保存至答案。

`ui` 支援 `header`、`palette`、`inspector`、`readings`、`presets`、`files`、`settings`、`probe`、`viewToggle`、`help`、`wireList`、`status`、`quickParameters`、`wireCurrents`、`potentialDirections`、`playback`。學生預設開啟 header、inspector、外觀切換和快捷參數，其餘關閉；`settings/files/presets` 只允許教師角色。關閉的部分不掛載進 DOM、不進 Tab 焦點順序。元件名稱、電源電壓、電阻、功率、電流示意仍由初始 document 的 `display` 決定；`display.potential` 現在只控制電勢色彩，不再自動開啟方向標示，v6 檔仍原樣保存此布林值。色彩控制在同一面板區，只適用於開放教師 settings 的配置；學生活動仍由作者固定色彩。實物儀表統一指針式，舊檔 `display.meters` 僅保留相容資料；`ui.readings` 控制面板的額外物理讀值，並非畫布標籤。

`ui.playback` 控制畫布上方暫停／繼續與 ¼ 速按鈕，教師預設 true、學生 false，可獨立於 settings 開放。只讀仍可控制觀察速度；播放狀態為 instance 暫態，不保存至答案、不觸發 onChange 或 undo。暫停凍結時間推進，仍可編輯並重算直流讀值；慢動作同步機械、電流及指針，不改元件參數。動態評量須依下節另定取樣與恢復規則。

`ui.status` 提供短路／過載或診斷的可存取提示，不佔工具列，也不顯示常態模型文字；設 false 可裁剪。畫布寬度至少 358 px 時，現有八個工具排成一行；極窄畫布換行，按鈕保持至少 44 px。

`ui.help:true` 在頂欄顯示問號按鈕，桌面及手機使用同一入口；教師顯示完整操作／模型說明，學生顯示簡明接線／移圖說明。`ui.help:false` 移除按鈕與說明視窗。控制面板沒有 `panelHelp` 或模型 footnote，不要依賴這些舊 DOM 目標。共用導航包含桌面空白處雙擊按住拖曳及放手恢復原工具，具體手勢見[課堂操作](circuit-workbench-core.md#課堂操作)。

選取元件後，快捷區只顯示該元件獲准修改的主參數：電源電動勢、電阻／燈泡電阻或變阻器滑片位置。它不依賴 inspector；`ui:{inspector:false, quickParameters:true}` 可讓學生只調整指定參數，無須打開面板。仍須用 `components.byId` 等規則開放實際參數，固定參數及只讀不顯示可改控制；`ui.quickParameters:false` 完全移除此區。百分比以 0–100 顯示，`position` 仍保存 0–1。

底部直接提供獲准的旋轉、刪除、複製及定位，不重複於 inspector。複製使用同款工具箱庫存，達上限／只讀時不能新增；定位與讀錶仍可使用。關閉 inspector 不會關閉這些底部操作。定位用準星、縮放用放大鏡加減；快捷數字與單位用共用 TeX 排版，聚焦時保留原生 number 輸入。快捷參數、元件操作與畫布縮放採一致分組；窄畫布及長數值自動換行，按鈕維持至少 44 px。

自訂 registry 元件可在定義中指定 `primaryParameter:'參數名稱'`。該參數須是有合法 `min/max/step` 的數值，沿用其 `label/unit/factor`；沒有主參數的元件不出現快捷區。快捷加減與輸入都走原有 `setParam`、權限及單步復原，沒有第二份參數或作答快照。

### 電磁繼電器與動態取樣

新增 `type:'relay'`，參數 `resistance`（Ω）、`pickupCurrent`（A，面板以 mA 顯示）及 `delay`（ms）；沿用元件白名單、庫存、固定／只讀及參數權限。五孔鍵 a/b 為線圈、c 共用、d 常閉、e 常開；畫布只畫接孔，不標字母。線圈與觸點隔離，途中兩邊斷開。詳見[繼電器操作與模型](circuit-workbench-core.md#電磁繼電器)。

新活動入口需載入本地 `circuit-relay-motion.js` 並列入 manifest。`getAnalysis()`、`voltage()` 及 check callback 的第二參數使用 editor 當前接點狀態；直接 `CircuitSolver.solve(doc)` 或未指定動態狀態的拓撲檢查使用未吸合狀態。既有 series／connected 檢查不是動態繼電器評量；使用此元件的題目須寫明取樣時間、過程／最終狀態評分及 pending／recorded 行為。

v6 document 保存參數與接線，不保存銜鐵位置或計時；load／destroy 清空動態狀態，load 從未吸合再演進。正式 SCORM 題目需要另外設計精簡權威動態快照、狀態 restore 與合法續作，不能把教師 JSON 當作完全相同瞬間的繼電器恢復。只讀可觀看電路繼續演進；若題目需要定格已提交瞬間，須在活動生命週期中明確處理，不將這個工作台當作已完成的評量活動。

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

D3／D4 已有兩個正式 consumer：[兩燈串聯計劃](../plans/30-circuit-dc-series-build.md)及[變阻器調參計劃](../plans/31-circuit-dc-rheostat-adjust.md)。各自的 `spec.js`、`scoring.js`、`persistence.js` 決定題目與答案；`circuit-activity-runtime.js`／`circuit-activity-page.js` 只接合共用 editor 和 SCORM lifecycle，不包含 rubric。Standalone 不啟用持久保存；Moodle 未答、部分答案、check、凍結及完成狀態由共用 runtime 管理。

`wirePointLimit` 是可信 config 的可選容量（整數 1–96，預設 96）。活動需要較小線形時，編輯器在 preview／history commit 前把超限路徑取樣成折線；保持原頂點次序、兩端、接線關係、阻值，折線長度不增加。恢復則嚴格拒絕超限文件，不在 decoder 暗中改形狀。D3 設 8，Float64 base64 無損保存實際文件；教師維持 96。任何新活動採用此選項，均須證明自己的最壞 draft、review 和真實 pending-final 不超過 4000 UTF-8 bytes。

`runtime-assets.json` 是 21 個核心依賴的唯一清單。`npm run package:circuit-platform` 將它與各入口自己的依賴合併，更新明列的教師 `assets.json` 及兩份 SCORM manifest，再用原本的 packager 重建三包。核心依賴新增／刪除只改中央清單；不要在三個 manifest 各抄一份。工具逐檔比對 ZIP 和來源，核對 HTML／CSS 引用依賴，並產生 `output/circuit-platform-build.json`。發布時仍須把新版 ZIP 上載到各 Moodle 活動／File resource；已部署的舊 ZIP 不會自動更新。

驗證命令：`npm run test:circuit-activities`（活動 scoring、codec、實際共享 SCORM runtime、source／ZIP 瀏覽器），`npm run check`（JS／manifest），共用核心的既有測試仍在 `npm test`。本地 iframe／模擬 LMS 不能替代真 Moodle 或實體手機 gate。

新活動引用 `../circuit-workbench/` 的原始核心，以配置裁剪工具及權限；不要把核心複製進活動資料夾。題目判斷使用已提交編輯的 document 與 solver analysis，不以粒子速度、指針暫態位置或畫面距離作為物理答案。每個電氣連通區的流動示意速度會自適應；不同電路或工作點之間不能以動畫快慢比較絕對電流。

新增活動仍須自己的計劃、目錄登記、rubric、精簡持久化及 SCORM manifest。manifest 要列出實際使用的共用 CSS／scripts、MathJax、全螢幕等依賴；教師 `assets.json` 是獨立包的清單，不會替活動補齊依賴。核心更新後重建引用它的活動 ZIP；檢查來源和解壓成品，不能只改來源便沿用舊包。整體責任及未實作的交流擴展方向見[架構與維護說明](circuit-workbench-architecture-review.md)。

## 驗證範圍

活動重構的精準測試為 `node sim/circuit-workbench/activity-core.test.js` 和 `node tools/circuit-workbench-browser-regression.js --activity-core-smoke`。後者包含 source／實際解壓 ZIP、1280／390 px、可信滑鼠與觸控接線、參數、固定限制、只讀、全螢幕、雙指導航、恢復續作、兩個 instance／卸載，以及原教師工作台的關鍵操作。證據在 `output/playwright/circuit-workbench/activity-core.json`；實機手機與真 Moodle 尚未驗證。DC 求解模型不因重構而增加電容／電感等瞬態能力。

快捷參數另有 `quick-controls.test.js` 和 browser runner 的 `--quick-controls-smoke`；針對參數權限、加減／輸入、單步復原、保存恢復後續調整、手機對齊及拖動穩定，也核對自動 ID 前綴的 label 關係和離開輸入欄時提交原元件。實際證據見[計劃第 50 節](../plans/28-circuit-workbench.md#50-對齊操作列與快捷參數2026-10-04)。

微電流動畫使用 `flow.test.js`／`component-flow.test.js` 及 `--micro-flow-smoke`；元件本體接線使用 `component-snapping.test.js` 及 `--component-snap-smoke`。按改動選擇必要檢查及相鄰權限／恢復案例，無需每次重跑完整教材和其他活動。具體已執行結果見[工作台計劃](../plans/28-circuit-workbench.md)，區分歷史審核、後續改動和未驗證平台。

A／V 接孔於 2026-10-05 內移，接孔變更使用 v5；2026-10-06 導線電阻升為 v6。v1–v4 匯入會先驗證舊幾何，再遷移相連線形。新活動使用 CircuitModel.empty()，不要把版本號硬編碼為 v4／v5。

說明入口／排版改動使用 `node tools/circuit-workbench-browser-regression.js --help-smoke`：來源／解壓 ZIP 共 14 個直向、短手機、橫向與桌面案例，核對頂欄 44 px 說明按鈕、無遮擋／水平溢出、面板底部清理及教師／學生可信開關說明。桌面相機捷徑可用 `--gesture-smoke --desktop-camera-only` 聚焦；`--gesture-smoke` 另包含手機雙指相鄰回歸。執行證據與範圍見計劃[第 59 節](../plans/28-circuit-workbench.md#59-桌面空白處雙擊拖畫布2026-10-06)及[第 60 節](../plans/28-circuit-workbench.md#60-移除面板底部重複說明2026-10-06)；歷史驗證不代表後續改動或真手機／Moodle 已通過。

導線電阻使用 `wire-resistance.test.js` 與 `--wire-resistance-smoke`，核對單線／新線預設、求解壓降／功率、保存恢復與學生／只讀權限；執行範圍及物理界限見[計劃第 61 節](../plans/28-circuit-workbench.md#61-單條導線電阻與新線預設2026-10-06)。

電流動畫的參考尺度與累積位移均為各 editor 的暫態，不寫入 v6 文件或作答。首次可解非零電流建立連通區尺度，調參時保持，新增／改接連通區或 loadDocument 時重設；preview 只使用尺度副本。微電流仍可見，但動畫快慢不是評分資料或精確電流比值。直接使用 renderer 時，可把同一 baseline Map 傳給 `flowReferences`／`advanceFlow`／`flow`，並在載入時清空；正式活動優先沿用 CircuitEditor.mount 的現有管理。精準檢查為 --flow-scale-smoke，參見[計劃第 62 節](../plans/28-circuit-workbench.md#62-同一電路調流時動畫速度改變2026-10-06)。
