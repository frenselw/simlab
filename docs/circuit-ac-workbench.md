# 交流工作台與活動接口

交流入口為 `sim/circuit-ac-workbench/index.html`；實作及驗收決策見[交流計劃](../plans/32-circuit-ac-workbench.md)。它與 DC 使用同一 `CircuitEditor`，但明確選用時間分析後端。工作台及兩個配置示例均不評分；正式 SCORM 題目、rubric 及活動 codec 另定。

## 開啟及部署

Live Server 可直接開交流入口。`npm run package:circuit-platform` 統一重建 DC 工作台、AC 工作台及兩個 DC SCORM 活動，核對共用來源與每包依賴。AC standalone ZIP 上載 Moodle **File resource**，主檔 `circuit-ac-workbench/index.html`；它沒有 `imsmanifest.xml`，不能當成已評分 SCO。

預設涵蓋交流／三種波形有效值、發電機及反向 LED、C/L、通斷自感、理想／線性變壓器、直流互感、充電後 LC、阻尼及空白畫布。共通操作沿用 DC 的位置：文件、設定及復原在頂欄；接線、手掌工具及播放在畫布上方；旋轉、複製、刪除與縮放在畫布底部。工具箱提供電壓圖／電流圖，可拖到畫布邊緣；預設不佔固定圖區。手機小圖可摺起或開啟大圖，控制面板仍獨立捲動。兩側捲頁區供 Moodle 外層捲動。

教師工作台預設啟動、按真實時間播放，預設 1 Hz；常用頻率為 0.1–2 Hz，另有「50 Hz · 真實交流」按鈕及課堂預設。頻率變更保留當刻相位，不以慢播代替低頻。數值輸入、滑塊、快捷按鈕及編輯命令使用相同的控制限制。時間求解器仍保留原數值能力與舊文件相容性，沒有把舊檔中的其他頻率偷偷改寫。

Control Panel 寬度沿用 DC（桌面 252px、短橫向 230px），移除「時間與實驗」及「課堂探索」。單步／初始條件按鈕按配置放在摺疊的「實驗操作」，API 及活動面板插槽保留。教師工作台保留與 DC 共用的 ¼ 速慢動作按鈕，只移除 1/10、1/100 等倍率選單。手動暫停／播放狀態在切換預設或載入文件時保留；恢復動態快照及單步仍停在暫停狀態。其他活動仍可按 profile 限制倍率能力。

交流導線電流卡按字體量度固定文字欄，約 122px 寬（一般模式，隨字體略變），保留箭嘴空間，以 mA 顯示（沿用共用數值格式，極值用緊湊科學記數）；過零、反向、未知量及科學記數都不伸縮卡片。DC／AC 共用緊湊箭嘴間距及內邊距；DC 保留自動 A／mA／μA 與適應文字的寬度，AC 則保留固定文字欄防止瞬時數值造成伸縮。

教師在 DC／AC 切換課堂示例時，保留顯示選項、操作模式及新導線設定；電勢參考端點屬於舊電路，會清除。導線總數若不足容納示例，提升至所需數目。教師開啟文件仍使用檔案內設定。

「電感對交流的作用」及「通電自感 · 電流建立」使用供電／放電切換開關，供電側維持原串聯電路，放電側讓線圈經負載燈衰減，保持線圈電流連續。「通電自感」初始為放電側、零電流，切至供電側才逐漸建立電流。自由搭建若把帶電流線圈完全斷路，仍保留模型診斷及暫停，不能把儲能清零。

## 實物、符號及燈光

LED 的實物電流動畫沿引腳與內部導電路徑顯示；符號模式沿電路方向顯示。反向並聯示例每半週由導通的一顆顯示箭頭，截止或未知支路不畫假電流，並遵守共用常規電流／電子／關閉選項。

交流新增元件有各自的 SVG 實物外觀：實驗電源、磁極與轉動線圈發電機、立體平行板電容、可變繞線電感、鐵芯與雙繞組變壓器、單刀雙擲開關、LED 外殼及交流指針儀表。「符號」使用簡化電路表示，不沿用器材外殼。切換視圖不改端子 ID、位置、接線或權威時間；器材本體的命中範圍依元件 bounds 及旋轉角度計算。

工作台電容範圍為 100–2000 μF（滑塊／快捷步進 10 μF），電感為 0.05–5 H（步進 0.05 H）；範圍由活動 profile 設定，見[範圍接口](circuit-activity-authoring.md#指定可調數值範圍)。數值核心仍保留原有範圍，超出本工作台配置的檔案明確拒絕，不改原值。

電容的板距隨 C 增大而減少；是壓縮比例的幾何示意，電學仍按輸入的 C 計算，畫布長度不當作物理 d。極板採有薄金屬邊的圓板，使用相同側視透視、保持豎直無傾斜，以投影後的板中心距離控制遠近（常用 C 範圍下約 13.3–42.3 世界單位）：接近時兩板部分重疊，分開時才出現空隙；外接孔位置保持，引線均為水平直線，右引線在板面上方繪製並延伸至右圓板板面中央。電荷依等面積徑向取樣均勻分佈，再投影至圓板表面。

電容的兩塊平行板以正紅、負藍表示，淨電荷符號由實際 q=CU 產生，兩板等量異號，電壓反向時交換正負。符號均勻排列；普通尺度以固定電荷組量表示，極密時重疊及壓縮顯示，並非逐個電子或評分依據，數值 q 不裁剪。未知量不冒充零。`ui.field`／場示意控制電荷及極性；「顯示讀值」只控制數值，實物的電荷示意仍可觀察。

電感實物沿用工作台的灰藍線架、銅色繞線及柔和邊線；左引線先向下接入，再沿筒身背面的半圈繞回上方；末半圈直接延伸為水平右引線，接點方向連續。少圈集中筒身中央，多圈延伸至整個筒身。可見圈數依固定磁路 L∝N² 作示意（1 H 對應 10 個可見圈）。變壓器兩側與電感重用連續螺旋繞線，繞在疊片環形鐵芯的兩柱上，背面半圈由鐵芯遮擋，前面半圈可見；兩側繞組線頭朝外，四條出線沿鐵芯外側平滑接出。器材內部不另畫裝飾圓孔，實際接線孔座標保持。兩側用一致 10:1 圈數比例顯示，調原／副匝數即時更新，器材下方標出實際匝數。兩側均有 1–2000 匝滑塊，每 1 匝一步確保兩端可達；快捷增減仍為每 10 匝，活動可按權限及範圍另限。實物與符號都跟隨設定，接孔位置、電學模型及保存格式保持。場面板重用相同器材繪圖。

燈泡亮度跟隨求解的 20 ms 平均功率，每個繪圖幀更新光暈與燈絲顏色；交流使用連續的亮度曲線，避免額定功率以上整段截成同一亮度。降低供電或增加串聯阻值會變暗；低頻交流可見週期亮暗，50 Hz 正弦通常較穩定。慢播改變觀看速度，沒有改電源頻率。這是顯示平滑，沒有新增燈絲熱慣性模型。

## 電表與指針

AC A／V／W 與靈敏電流計重用 DC 的解析欠阻尼指針模型；改讀值時保留針位及角速度，呈現超越、回擺及衰減，並受機械限位保護。暫停／只讀凍結，系統減少動態則直接定位。動態針位不保存為權威答案，不改有效值、平均功率或物理時間。

未接妥時指針機械回零，數值仍為 null，並標示未接妥；接線後資料不足顯示「收集量測中」。未知讀值不畫假針位，隱藏讀值亦隱藏指針。交流電表使用較大的錶面及可適應數字長度的刻度字體；AC A／V 每量程30小格，W為中心零、正負各30小格；A／V讀有效值，W讀平均有功功率，G保留有號瞬時電流且以 μA呈現。

畫布、手機持續預覽及放大錶盤使用同一個指針狀態與刻度幾何；三種交流電表亦可選取後開啟放大刻度。接線狀態在拓撲編譯時快取；未接電表不因時間窗滿足而冒充已量測到零。

## 建立配置

載入 `runtime-assets.json` 中的共用檔案及 `ac-runtime-assets.json` 中的七個交流檔案；HTML script 順序參考交流入口。兩者的 CSS 亦須載入。

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

`observationChannels` 為 null 時，電壓探頭可選電路端點或理想導線，電流探頭可選導線／支路；陣列最多四個 `{id,quantity}`，只允許指定元件通道，電壓探頭只能使用同一獲准元件的 a／b 端，不因相同電勢而越權。`observationLimit` 為 0–4，教師預設兩部；指定通道示例預設至少能容納其通道數。quantity 包括 voltage/current/charge/energy/flux，實際選項依元件能力建立。數字相位與游標不再常駐；底層相位運算仍可供活動外層使用。`ui.phase` 保留配置相容性；`ui.field` 同時控制場面板及電容極板符號，不能從快照開放。

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
| `setObservationChannels(list)` | 以已開放元件通道配置小儀器，數量受 observationLimit 限制 |
| `getObservationTools()` | 取得圖框、量尺、探頭及彎線的獨立 UI 配置，沒有整段波形 |
| `setObservationTools(list)` | 原子設定合法觀察工具；失效ID、越權測點、數量及非法值完整拒絕 |
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

零初始值的通電瞬態不等於穩態；無損 L/LC 不一定自行消除初始偏置。波形顯示緩衝為有限容量，沒有保存到session；時間窗超出已取樣區保留空白，不補造曲線。

## 物理界限

- 理想變壓器支援交流匝數／功率關係；直流激勵明確拒絕。線性線圈以耦合電感及線阻支援互感，不含飽和、磁滯或鐵損。兩側電氣隔離，跨任意參考點電壓仍未知。
- 發電機外界維持轉速；Φ為单匝、NΦ為磁通鏈，法線角 θ 與感應電動勢一致，不計機械減速。
- 燈是恆阻教學模型；LED 是正向壓降／有限導通電阻模型。沒有真實燈絲熱慣性、元件擊穿或接點火花。
- 帶電 C 理想短接、非零 L 電流突然空斷及矛盾理想源沒有有限解；使用可見放電支路或有限阻抗。這些診斷文件仍可保存及修正。
- DC 檔維持 v6；純 DC checks 不用來判斷 AC/時間效果。純導線 connected 檢查可以共用。

## SCORM 接入與驗收

兩示例的 `example-state.js` codec version 2 使用緊湊佈局，舊 version 1 明確拒絕，避免恢復時默默移動固定元件。教師完整 document／session 保存仍保留原來幾何，沒有自動壓縮。它只保存允許變動的參數及 physics，從 epoch 1 固定模板重建接線；這是外層 codec，不在通用 solver 內。它不評分。容量測試使用真正共享 makeSnapshot 及 pending 封套形狀，不代表已建立評分活動或通過 Moodle。

正式活動須自己的 rubric、null 答案、definition/model/schema epochs、時序取樣與三種 byte gates；沿用 SimScorm/SimActivityFlow 全生命週期。Pending/review 凍結權威時間；解說 playback 另用副本。高風險評分仍需可信 server。不能直接將任意教師 session 塞入 4000 bytes 或把預設電路算成已作答。

`npm run test:circuit-ac` 執行物理、配置／狀態／codec及 source/解壓包 browser 檢查；新測試已登記總 runner。實機與真正 Moodle T4 是獨立 gate。詳細實際結果以計劃 implementation record 為準。

## 小型波形儀器

電壓兩探頭量同一電氣島內兩點差，跨隔離兩側保留未知。電流探頭可落在導線任意位置，正向依導線A→B；不唯一循環電流不冒充零。量測線不屬於電路導線，沒有電阻／線長／庫存影響，可拉遠及拖線身增加彎點，雙擊線身拉直；每條最多32彎點，座標仍遵守畫布資源範圍。

圖框大小與資料量尺分開：角落44px把手可縮放框，⤢開大圖；雙擊標題摺起。資料＋／−只改量尺，按中間量尺可在縱軸／時間切換；所有儀器共用時間窗，時間縮放不改電源頻率。雙擊圖或Home按已收集資料適應縱軸；超出量尺明示。框停在畫面位置，移圖／縮放電路後，探頭和彎點跟隨其世界座標及绑定目標，線自動延伸。

工具箱以小型示波器圖示區分電壓／電流工具。圖下方固定尺標的全寬代表目前時間窗（例如「1 s」即整個繪圖寬度為1秒），波形滾動時尺標不變；時間量尺控制明示「時間窗」。不顯示絕對時間刻度或跳動的瞬時數字，未接探頭／未知量／超出量尺仍有簡短提示。圖框使用薄邊線，移除獨立數字列，操作按鈕維持44px可點範圍。

滑鼠／筆可拖取儀器，手指點取並保留工具箱捲動。標題方向鍵移框、角落把手方向鍵改大小；探頭方向鍵移動，Enter或雙擊選合法測點。Escape／pointercancel還原未提交UI拖動。只讀仍可觀察／移框，不改電路或已凍結物理時間。

觀察工具不進電路JSON或captureSession；頁面刷新開始fresh。活動若要保存版面可自行保存getObservationTools結果，再用setObservationTools原子驗證，但須自行遵守4000-byte作答封套及活動版本契約，不假定全曲線可存入SCORM。工具格式包含id、kind、x/y、width/height、range、span、probes(position/target/bends)；元件特殊quantity另有channel.id。不同電路載入時移除舊測點；固定活動會按可信指定通道初始化。
