# 交流工作台與活動接口

交流入口為 `sim/circuit-ac-workbench/index.html`；實作及驗收決策見[交流計劃](../plans/32-circuit-ac-workbench.md)。它與 DC 使用同一 `CircuitEditor`，但明確選用時間分析後端。工作台及兩個配置示例均不評分；正式 SCORM 題目、rubric 及活動 codec 另定。

## 開啟及部署

Live Server 可直接開交流入口。`npm run package:circuit-platform` 統一重建 DC 工作台、AC 工作台及兩個 DC SCORM 活動，核對共用來源與每包依賴。AC standalone ZIP 上載 Moodle **File resource**，主檔 `circuit-ac-workbench/index.html`；它沒有 `imsmanifest.xml`，不能當成已評分 SCO。

預設涵蓋交流／三種波形有效值、發電機及反向 LED、C/L、通斷自感、理想／線性變壓器、直流互感、充電後 LC、阻尼及空白畫布。上方「更多」提供文件、設定、操作及說明；手機控制面板獨立捲動。波形可在 stage 打開，窄畫面切到波形。兩側捲頁區供 Moodle 外層捲動。

## 建立配置

載入 `runtime-assets.json` 中的共用檔案及 `ac-runtime-assets.json` 中的六個交流檔案；HTML script 順序參考交流入口。兩者的 CSS 亦須載入。

```js
const doc = CircuitModel.empty('transient');
CircuitModel.add(doc, 'ac-source', 160, 260);
CircuitModel.add(doc, 'capacitor', 460, 260);

const editor = await CircuitEditor.mount(host, {
  role:'student', analysis:'transient', initialDocument:doc,
  palette:[{type:'resistor', limit:2}],
  components:{byId:{c1:{params:['frequency']}}},
  ui:{header:false, palette:true, inspector:true, readings:true,
      playback:true, waveform:true, field:false, energy:false, phase:false},
  simulation:{play:true, step:true, rate:false, reset:false},
  observationChannels:[{id:'c1', quantity:'voltage'}],
  panelContent:questionElement
});
```

`panelContent` 是外層建立的 DOM element，插入同一 Control Panel；題目、答題及 SCORM 仍由外層管理。`ui.header:false` 需關閉內部 presets/files/settings/help，外層擁有整個活動唯一 fullscreen。

元件白名單、款式庫存、固定參數、ID 保留、導線及操作權限沿用[作者指南](circuit-activity-authoring.md)。同種類不能只用可調 C/L 值建立互相重疊的兩款庫存。初始元件亦計入庫存，所有載入／restore 重新驗證 profile。

`observationChannels` 為 null 時可選目前支援的通道；陣列最多四個 `{id,quantity}`，固定指定觀察範圍。quantity 包括 voltage/current/charge/energy/flux，實際選項依元件能力建立。`ui.phase` 限穩定正弦的相位比較；`ui.field` 同時控制場面板及電容極板符號，不能從快照開放。

## 時間與動態狀態

| API | 行為 |
|---|---|
| `getAnalysis()` | 目前已提交電路及物理時間的獨立讀值；不推進，preview 不作答 |
| `onAnalysis(fn)` | 已接受物理取樣通知，與 `onChange` 分開；取消訂閱函數 |
| `getPlayback()` | 暫停、設定倍率、實際倍率及控制權限；非存檔資料 |
| `setPlayback({paused,rate})` | 受 play/rate 及只讀限制；慢播不修改 f |
| `advanceTime(seconds)` | 受 step/只讀限制，0<seconds≤10；返回進度及分析 |
| `resetSimulation()` | 受 reset/只讀限制；回 t=0、保持搭建 |
| `captureSession()` | 取得 document＋權威 physics，沒有 UI、波形歷史或 pointer |
| `restoreSession(snapshot)` | 版本、數值、模型、端點、數值歷史與 profile 全部驗證後原子恢復；暫停、量測重新收集 |
| `setObservationChannels(list)` | 最多四個已開放通道；非法／隱藏工具不開放 |
| `setFieldDisplay(boolean)` | 只在 ui.field 開放時切换場；觀察操作不改答案 |

開關、R、振幅、f 更新保留 C 電壓／L 電流；f 保留當刻相位。C/L、匝數、耦合、初始條件、元件增刪或改接線建立新實驗。純搬動、旋轉、線形、名稱及檢視不重設時間。拖動預覽用狀態副本，取消不得改主狀態。AC undo/redo 回到編輯事件對應的 document＋physics 並暫停。

`setReadOnly(true)` 在 AC 同時暫停時間；播放、單步、reset、載入及 restore 均拒絕。仍可移圖、縮放、全螢幕與觀察。檢視／游標與普通面板捲動不自行推進或尋址時間；播放中的時間由 stepper 進行。背景頁面不追算離開的時間。

Session version 1 的 physics 欄位：`time`、`step`（下一步建議）、`sources`（ID→目前弧度相位）、`dynamic`（支路 key→`{i,v}`，C 的 v／i 及 L 的 i／電感電壓）、`work`、`dissipated`、`event`（下一步 BE 起步）。模型 epoch 及 document v7 分開。來源相位、ID 與 dynamic keys 必須與文件完全吻合。導數歷史可補足平行電容等瞬間代數解的不唯一；不把未知歷史重設為零。

教師「儲存電路檔」匯出設計及初始條件，不是保存目前瞬間。兩配置示例提供記憶體保存／恢復瞬間按鈕，重新整理清空；活動作者可使用 session API 保存自己的必要答案。

## 離線運算及量測

```js
const session = CircuitTransient.run(doc, {
  events:[{time:0.1, command:{type:'toggleSwitch', id:'c3'}}],
  until:0.2
});
const result = session.read();
```

離線／live 共用積分器；events 為按時間排序的 setParam/toggleSwitch。會重設初始條件的參數變更不能混入同一事件表，須另開一次運算。數值／理想衝突停在事件，返回診斷，沒有暗加電阻、清儲能或裁剪電流。

`components`／`wires` 的 voltage/current/power 為瞬時有方向量；`measurements[id]` 包括 collecting/unknown/ready、時間窗、voltageRms/currentRms/averagePower。RMS 及有功功率來自時間積分，不是幀率抽樣，也不是所有波形峰值除 √2。儀表未知／收集中不顯示零。燈的顯示使用 20 ms 平均功率；交流過載依完整參考周期的平均功率，DC瞬態用短窗；耐壓依瞬時峰值。

零初始值的通電瞬態不等於穩態；無損 L/LC 不一定自行消除初始偏置。波形 buffer 為有限容量，沒有保存到 session；游標超出已取樣區只顯示未取得資料。

## 物理界限

- 理想變壓器支援交流匝數／功率關係；直流激勵明確拒絕。線性線圈以耦合電感及線阻支援互感，不含飽和、磁滯或鐵損。兩側電氣隔離，跨任意參考點電壓仍未知。
- 發電機外界維持轉速；Φ為单匝、NΦ為磁通鏈，法線角 θ 與感應電動勢一致，不計機械減速。
- 燈是恆阻教學模型；LED 是正向壓降／有限導通電阻模型。沒有真實燈絲熱慣性、元件擊穿或接點火花。
- 帶電 C 理想短接、非零 L 電流突然空斷及矛盾理想源沒有有限解；使用可見放電支路或有限阻抗。這些診斷文件仍可保存及修正。
- DC 檔維持 v6；純 DC checks 不用來判斷 AC/時間效果。純導線 connected 檢查可以共用。

## SCORM 接入與驗收

兩示例各自的 `example-state.js` 只保存允許變動的參數及 physics，從 epoch 1 固定模板重建接線；這是外層 codec，不在通用 solver 內。它不評分。容量測試使用真正共享 makeSnapshot 及 pending 封套形狀，不代表已建立評分活動或通過 Moodle。

正式活動須自己的 rubric、null 答案、definition/model/schema epochs、時序取樣與三種 byte gates；沿用 SimScorm/SimActivityFlow 全生命週期。Pending/review 凍結權威時間；解說 playback 另用副本。高風險評分仍需可信 server。不能直接將任意教師 session 塞入 4000 bytes 或把預設電路算成已作答。

`npm run test:circuit-ac` 執行物理、配置／狀態／codec及 source/解壓包 browser 檢查；新測試已登記總 runner。實機與真正 Moodle T4 是獨立 gate。詳細實際結果以計劃 implementation record 為準。
