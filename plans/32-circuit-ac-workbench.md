# 交流電路工作台

2026-10-09：使用者批准 A0–A6 實作。沿用 `codex/circuit-platform-dc-scorm-plan`，基準 `f7912e2`。
依 [共用產品規則](00-shared-platform-and-style.md)、[production guide](../docs/simulation-scorm-production-guide.md)、[活動作者指南](../docs/circuit-activity-authoring.md)及[架構說明](../docs/circuit-workbench-architecture-review.md)實作。本計劃由 [activity template](NEW-SIMULATION-PLAN-TEMPLATE.md)各決策節點填寫；共用契約不在此另訂例外。

## Scope

| 決策 | 規格 |
|---|---|
| Slug／目標 | `circuit-ac-workbench`；中學交流、有效值、電容／電感、自感／互感、變壓器及 LC 振盪 |
| 交付 | 非評量教師工作台、可配置核心、兩個無評分嵌入示例、standalone ZIP；正式 AC SCORM 題目及 rubric 另議 |
| 教材 | 人教版高中選擇性必修第二冊，印刷頁 40–43、49–62、71–75；本地 Textbooks 原 PDF 已讀 |
| 操作 | 自由取物、接線、調參、播放／暫停／單步、瞬時與窗內量測、游標、能量及場示意 |
| 共用核心 | `CircuitEditor.mount`；不複製 DC editor。共用接線、拖放、吸附、權限、有限導線、實物／符號及 renderer |
| 依賴 | 原生 HTML/CSS/JS/SVG/Canvas；沿用本地 MathJax、styles、fullscreen，不引入新 runtime library |
| Assessment risk | N/A：本次沒有學生評分；後續活動需自己的 assessment risk／rubric／codec／SCORM manifest |
| 不包含 | 家庭、高壓輸電、整流／濾波、完整相量、三相、調諧、磁芯飽和／磁滯／鐵損、火花及燒毀 |

## Catalogue metadata

`title:'交流電路工作台'`、`folder:'circuit-ac-workbench'`、`categories:['物理','電學']`、`description:'搭建交流、電容電感與變壓器電路，觀察波形、有效值及能量交換。'`、`tags:['交流','電路','電容','電感','變壓器','工作台']`。只在 source／package gates 通過後設 `status:'active'`。

## Architecture and public interfaces

- `analysis:'dc'|'transient'` 是可信 mount 配置，預設 dc。所有讀值、check、probe、renderer、hazards 路徑使用選定後端；DC 方程及預設不重寫。
- v1–v6 繼續遷移至 v6／匯出 v6。AC v7 帶 `analysis:'transient'`、`modelRevision:1`；初始 C 電壓及 L 電流是元件參數，目前時間／狀態另存。
- DC 拒絕 AC 文件。AC 顯式將支援的 v6 文件轉為 v7；不支援元件完整拒絕，不能自動刪除。無全域分析模式。
- `getAnalysis()` 不推進時間。增加播放／暫停／倍率／單步／reset、`captureSession()`／`restoreSession()`、獨立分析訂閱與活動 panel 插槽。
- 時間求解器同時提供 instance session 與確定性離線 events/until 運算，兩者共用積分程式。
- AC 配置覆蓋模型／款式／數量／參數／操作、播放及量測通道；UI、命令、鍵盤、匯入與 restore 共用驗證。
- 保留近期 DC 改進：滑片數字即時更新、滑鼠／筆 palette／取線拖放、未接物件回 panel／垃圾桶、符號名稱。
- renderer 使用後端 hazards；DC series／sliderEffect 保持 DC 範圍，純導線連接檢查可用於 AC。

## Physics or subject model

| 元件／状态 | 方程／規格 | 单位／預設 |
|---|---|---|
| AC source | 正弦、對稱方波、對稱三角波；輸入有效值換算各波形峰值；可調初相位及內阻 | 6 V rms、1 Hz、0°；工作台 f 0.1–2 Hz 或 50 Hz，數值核心仍保留 0.1–1000 Hz |
| Generator | θ 隨時間；Φ=BS cosθ 為單匝磁通量；e=NBSω sinθ；轉速同時影響振幅及頻率 | SI；原生 SVG，外界保持轉速 |
| R／rheostat／wire | 沿用阻值及端子語義；幾何不是物理電阻 | Ω；不變更 DC schema |
| Lamp | 恆阻燈，功率驅動亮度；不拿 DC 熱平衡當熱瞬態 | 額定參數沿用現有 |
| Capacitor | i=C du/dt；q=Cu；E=½Cu²；狀態 u | 1000 μF，初始 u=0 |
| Inductor | u=L di/dt+Ri；E=½Li²；狀態 i；R=0 支援理想 LC | 1 H，初始 i=0 |
| Switch／SPDT | 離散事件，SPDT 不能同時接通兩邊 | boolean／兩個接點選擇 |
| Ideal transformer | 電壓比等於匝數比，電流反比，功率守恆；兩側隔離；純交流用途 | n1:n2=200:100 |
| Coupled transformer | M=k√(L1L2)，L2=L1(n2/n1)²；兩側同組方程；k<1；線阻與漏耦合 | L1=2 H、k=.999、R1=1 Ω、R2=.25 Ω |
| LED | 正向壓降＋有限導通電阻，反向截止；反向並聯顯示方向 | 教學近似，沒有擊穿模型 |
| AC A/V/W meters | 有效電流／有效電壓／平均有功功率，數字與指針讀同一統計 | 明示量測窗及資料不足 |
| G meter | 有方向的瞬時電流，指針平滑只作呈現 | A，介面 μA |

線性線圈不模擬飽和、磁滯及鐵損；不把效率直接乘電壓。互感斷電預設含可見放電支路。理想變壓器遇直流激勵明確停止並提示改模型。

### Integrator and failure policy

修正節點分析；平滑處梯形法，事件後短暫 backward Euler 再回梯形。自適應步長／step doubling，週期及自然變化尺度限步，波形跳變與操作事件為 breakpoint。拓撲編譯只在電氣變更時重建。初始條件明確，不把零初始瞬態當穩態。

物理時間與 RAF 分開；單幀運算設 budget，忙時放慢時間而非跳步。未知／浮接／不唯一保留 null。矛盾理想源、帶電 C 理想短接、帶電流 L 無通路及数值失敗保留文件、凍結事件時間並診斷；不暗加電阻、清能量、裁剪電流。無損受迫共振可增長，不能用假耗散壓平。

### Editing and time transitions

| 操作 | 物理處理 |
|---|---|
| 暫停／只讀 AC | 物理時間凍結，仍可移圖／縮放／量測 |
| 倍率 | 只改牆鐘對模擬時間比例，不改 f |
| switch／R／振幅／f | 事件時保留 C voltage／L current；改 f 保留相位連續 |
| C／L／N／k／初始值 | 新實驗，回 t=0 並提示 |
| 新增／刪除／重接 | 新電路回初始條件；移動／旋轉／彎線不重設 |
| preview | 主狀態停步；副本計算與即時數字；取消還原，release 才 onChange |
| undo／redo | 編輯事件對應 document＋physics snapshot，還原後暫停；不逐時間步入 history |
| 背景／恢復 | 不補追離開時間；恢復保存瞬間後暫停 |

### Measurement and visual observations

每個積分步計算 ∫u²dt、∫i²dt、∫uidt，產生 RMS 與平均功率，不能由 RAF 抽樣。峰值/√2 只適用正弦。顯示時間窗、收集中；更改條件清統計。相位差限穩定正弦及明確參考頻率，不適用時保留曲線與游標。

最多四條波形：兩端 voltage、支路 current、C charge、C/L/coupled energy，共用時間軸、各自單位與軸比例；兩游標有鍵盤／數值替代。固定容量 ring buffer；繪圖抽樣不丟積分資料。場、電流及發電機角度同一物理時間；電子不穿過 C 介質。

## Responsive layout contract

| 決策 | 規格 |
|---|---|
| 三區 | Header：title/presets/fullscreen；stage：電路／波形；panel：工具、參數、量測、外層插槽 |
| 桌面 | ≥760 px；stage 左、panel 252px 右（跟隨 DC）；波形開合時 stage 內約 1/3 高 |
| Phone | 上 stage、下 bounded panel；電路／波形切換。共通控制沿用 DC 的位置與窄畫面排列；stage 保留至少 75px 畫布，短畫面讓獨立捲動 panel 讓出高度，按鈕仍為 44px |
| Bounded shell | 100dvh，min-height:0；html/body 沒有競爭 scroll；panel overflow-y:auto/overscroll contain |
| Fullscreen | 整個活動唯一 target/header、shared script；外層有 header 時內層 ui.header=false |
| 文字／按鈕 | Traditional Chinese、主控制 16px、圖形放大可讀、44px target；狀態亦有文字 |
| Viewports | 1280×800、768×1024、390×844、320×500、844×390、500px iframe、200% zoom |

## Navigation, submission and reset

教師主題預設可獨立切換，明示載入新電路；reset simulation 保留搭建但回初始值。Standalone refresh fresh。check/submit/rubric/recorded lifecycle **N/A：非評量工作台**。活動插槽不提供分數；正式活動後續自己的計劃決定 blank／partial／check／review／pending。

## Diagrams, notation and assistance

SI 內部數值，u/i/q 為有正負瞬時量，U/I 为 RMS，Φ 與 NΦ 分開。正方向端子 a→b；耦合線圈同名端明示，跨隔離任意 reference 的電壓未知。使用共享數學字型與格式。

接孔吸附沿用現有 24 CSS px、component snap 既有幾何；不是評分容差。手指 wire-end 精準接孔需放大預覽；粗元件搬動／按鈕／range 不需放大；波形游標以數值與 keyboard 避免遮蔽。不新增旋轉線圈自由 3D 手勢。

## Touch gesture ownership contract

| Target／mode | 規格／owner | Keyboard alternative |
|---|---|---|
| component／wire end／wire body／rheostat | 現有 stable hit capture、none；操作 owns gesture，viewport fixed | 現有選取／方向鍵／commands |
| palette／take wire | 滑鼠／筆 drag；touch click／panel pan-y | button click |
| SPDT | local button hit、44px；event only一次 | Enter／Space |
| graph cursors | local 44px capture none，其餘 graph pan-y | range／number／arrows |
| panel | panel only，兩端不串到 host | tab／原生 scroll |
| left/right strips | 各≥32 CSS px，不被 graph 蓋住；native host pan-y | N/A |
| blank stage outside manipulation | native enclosing owner | N/A |

| Host | 实際 owner／strategy | Evidence |
|---|---|---|
| T0 | bounded workbench；無 host range 時 N/A，不偽造捲動 | 待執行 |
| T1 | scrollable outer window → iframe | 待執行 |
| T2 | outer window → fixed wrapper → iframe | 待執行 |
| T3 | bounded windows，overflowing owner element → iframe | 待執行 |
| T4 | 真 Moodle 及真手機 owner 實測 | 待外部環境，不能用本地替代 |

running/paused/preview/diagnostic/readonly，real/symbol、graph開／關／mobile graph view 均要 legal fixture，操作後記錄時間狀態及 scroll owner。所有 targets、strip兩方向、panel邊界、快速滑動、取消及 resize 依 production guide。

## Scoring and tolerance

Rubric/pass/分數／提交 **N/A：教師工具及無評分技術示例**。物理解析誤差≤0.5%（近零絕對電壓1e-6 V／電流1e-9 A）；理想 LC 100周期能量漂移≤0.5%；與未來評分容差分開。

## Phase/state matrix

| State | 必須保留 | 合法續作 |
|---|---|---|
| blank／partial wiring | v7 doc，初始 states，未知讀值 | 取物／接線／保存／load |
| running／paused RC/RL | t、source phase、C u／L i／數值歷史 | 改 R／switch／advance |
| LC quarter／SPDT前後 | q/i polarity、energy、switch contact | 續算／切換，unsupported保留diagnostic |
| mutual transient | both winding i、phase、coupled history | 有放電支路的 switch event |
| preview | authoritative snapshot 不改 | cancel／release |
| diagnostic | 合法 doc、事件時間、last continuous states、診斷 | 修正參數／接線／reset，不能假零讀值 |
| embedded readonly | frozen doc＋time | 縮放／view／probe，不推進 |
| restored | 同一 doc＋t＋physics，暫停，measure collection fresh | 同 production command 合法續作 |

## Persistence contract

教師 document 256KiB 限制，manual import/export，無 localStorage 答案。Session envelope `{kind:'simlab-circuit-session',version:1,modelRevision:1,document,physics}`；physics exact keys 為 `time,step,sources,dynamic,work,dissipated,event`；sources 是 ID→目前弧度，dynamic 是支路 key→`{i,v}`（C u/i、L i/電感電壓、coupled winding i/u）。keys 與當前 doc 的元件完全一致；finite、range、數值及歷史相容、model revision、doc 及 profile 全驗證，原子 restore。preview／camera／DOM／particle／full ring buffer不保存；統計恢復後收集中。

**未來 SCORM**：活動自己定definition/model epoch、精簡固定模板 codec、null answers、snapshot three byte gates與 rubric。動態時間評分用固定初始條件／事件／窗口重算。核心 session不是任意電路≤4000bytes承諾；兩技術示例量測 compact必要動態欄位以證明可做活動。Pending/review時間必須凍結；演示playback另用副本。

## Shared SCORM lifecycle

N/A：本次沒有已評分 SCO，不提供 raw LMS handling。後續沿用 SimScorm／SimActivityFlow 全 outcome；D3/D4 是架構驗證 prototype，介面完善另議，不因 AC 改其題目或 rubric。

## Implementation stages

| 階段 | 出口 |
|---|---|
| A0 基準／接口 | 保存DC presets document/analysis/hazards/SVG及23測試；v6維持，analysis guard |
| A1 時間核心 | R/C/L、SPDT、adaptive integration、events、energy、snapshot、離線運算，解析驗證通過 |
| A2 交流工作台 | editor、AC meters、waveform、time、panel slot、bounded layout |
| A3 變壓器 | ideal＋coupled、isolation、load、DC通斷互感 |
| A4 教材預設 | 五組／空白可編輯預設；generator/LED/field/energy聯動 |
| A5 嵌入／恢復 | fixed transformer params＋fixed LC SPDT兩個無分數示例；權限／合法續作／多instance／只讀 |
| A6 發布 | 中央assets、AC standalone ZIP、三DC包重建、source/package、文檔及catalogue |

## Test plan and evidence

- [x] RC/RL解析及switch連續性；R/RLC正弦、相位、三種RMS與平均功率。
- [x] LC100周期能量；damped/critical/overdamped；離線與分段、不同幀率／倍率同t狀態一致。
- [x] ideal transformer ratios/power/load；coupled directions/DC steady/energy/isolation。
- [x] generator phase/N/B/S/f；LED polarity；unsupported impulses／contradictory sources／unknowns不假讀值。
- [x] 所有 state matrix row session round-trip後執行合法續作；壞 keys/numbers/revisions/profile 原子拒絕。
- [x] 原DC全部circuit單元、完整source/package teacher及兩DC活動相鄰回歸，與baseline同源比對。
- [x] AC source/package desktop/mobile/short iframe/200% zoom，T0–T3可信gesture／fullscreen／panel／strips。
- [x] check、runtime syntax、dependency manifest／assets完整、ZIP逐檔byte／hash。
- [ ] 真Moodle／實機（外部gate；尚無環境，不宣稱Moodle-ready）。

## Implementation record

尚未完成的驗收留空。基準及臨時證據保存在 ignored `output/ac-baseline/`；後續在此記錄實際版本、結果與限制，不以計劃冒稱完成。

### A0／A1 核心驗證（2026-10-09）

- 變更前 23 個 circuit Node 測試通過；14 個 DC 預設的文件、分析、hazards 及完整 scene SVG hash 已保存。
- v7／analysis guard、交流元件及純時間 solver 加入後，14 個預設逐項比對不變，全部舊 circuit Node 加新 transient test 通過。
- production Session 驗證 RC/RL 指數、LC 四分之一週期／100週期能量、分段時間、阻尼／臨界／過阻尼、三種 RMS／平均功率、C/L相位、ideal/coupled transformer、隔離、通斷電互感方向、SPDT charging→LC、LED／generator、快照及不可靠解。
- 修正方波 breakpoint 的浮點相位歸零及來源內阻功率符號；不放寬解析容差。
- 此時僅核心及 Node gate；交流 UI、browser／package 及外部 gate 仍未完成。

### A2–A5 完成及修正（2026-10-09）

- 同一 editor 接入 transient session、控制／數值預覽、事件 history、原子 session restore、analysis 訂閱及 panelContent。已提供 16 個可編輯預設（五組主題及空白），兩個固定 student 配置示例、四通道波形／雙游標、RMS／平均功率、場及能量。
- 普通 AC source 可設 0–1000 V rms（包括課本 220 V 例子），f 0.1–1000 Hz。Source／C/L／coupled 的參數及動態模型仍明確與 v6 DC 分開。
- 燈的呈現採 20 ms 平均功率；AC 警示採完整週期平均，避免額定正弦峰值誤報。DC 自感的短時亮度仍能呈現。電容耐壓繼續按瞬時電壓。
- 恢復保留平行 C 等代數瞬間未唯一決定的導數歷史，以附加歷史約束重建讀值；加入平行 C／帶電流 L+LED 的 restore／續作測試，不把歷史清零。資料不足的游標不取未計算時間的假數值。
- 32px 波形左右區避開游標 halo；640×400／DPR2 作 200% 等效版面檢查。Headless CDP 退出 native fullscreen 後重設宣告 viewport，再進行座標触控驗證，避免 compositor 使用退出前的縮放；這是測試 fixture 處理，不是 app scroll bridge。
- 完整 AC source／實際解包 **604 observations** 通過：六 viewport、RMS、播放／暫停、實物／符號、游標、palette／C body 可信輸入、SPDT 正常與空斷診斷、range preview/Escape/release、restore／非法原子拒絕、readonly、兩配置、T1/T2/T3 canvas＋graph 原生 owner、running invariants、fullscreen 允許／拒絕／unsupported；runtime exception 為零。額外驗證同頁 DC＋AC 及兩個 AC 的獨立時間、文件、參數及 destroy；截圖已檢視。
- 全部 **25 circuit Node 檔**及 helper tests 通過；14 DC preset document／analysis／hazards／完整 SVG hash 再次對照 A0 完全一致。DC 全套 teacher source/ZIP **4986**、focused quick controls **70**、embedded core **66**、原兩個 SCORM source/ZIP **842** observations 通過。完整套後的 AC opt-in／range guard 變更另以最後 targeted suite 複核；不把早期大套證據當作未來變更自動通過。
- 可信輸入找到共有的 Escape 後 detached range 在 release 再提交問題；共用 input/change handler 拒絕失效／已取消預覽，DC 和 AC 同改一次。已有兩側 production browser assertion。
- Windows DevToolsActivePort 暫時 EBUSY 改為原 bounded startup loop retry；其它錯誤仍 throw，helper 單元驗證 EBUSY→success 與 EACCES→reject。
- 固定模板 production codec 已用實際 shared makeSnapshot／pending 封套形狀量測：transformer sample draft/review/pending **335/361/546**；LC **294/320/508** bytes。另執行 transformer 2／LC 6 個實際 phase variants（包括充電、切換、quarter／half），最長 compact session 分別 **256／344** bytes，decode/restore後合法續作。這些是技術容量證據，沒有產生評分活動。
- `npm run check`、34 個新文檔 local links、diff check 通過。`npm test` 已執行，新 AC／原 DC SCORM 等前段通過後進入重複的 teacher 大矩陣；該矩陣先前完整4986及最後70/66已獨立通過，本次主動停止這段重複 aggregation，沒有把取消記為通過或新產品失敗。
- 直接接續總 runner 在 circuit 後、已知 blocker 前的8個 Node groups（牛頓測試版及shared fullscreen）通過；`scorm-fullscreen-browser-regression.js` 的source/package native／iframe／policy／SCORM，以及全站 `fullscreen-rollout-browser-regression.js` source/package 均通過。
- 現版直接執行 `newtons-third-law-fullscreen-activity-regression.js --smoke`，仍在第132行 `assert.ok(r.stage>=195)` 失敗（exit1）。Newton兩入口、該runner及shared/styles與基準f7912e2無diff；原計劃29第17.2節已有更早修改前同一失敗證據。**總 suite 沒有完整跑完，不宣稱全站綠燈。** 記錄：`output/ac-baseline/npm-test-final.log`、`newton-final.log`、`shared-fullscreen-final.log`、`fullscreen-rollout-final.log`。

### A6 本地發布及外部 gate

- `npm run package:circuit-platform` 重建四包：DC teacher 29 檔、AC teacher 34 檔、兩 DC SCORM 各34檔。每包21共用檔及全體 runtime byte 與來源相同；AC 六個可選依賴另列，無核心副本。指紋在 `output/circuit-platform-build.json`。
- AC catalogue 已通過本地 package-ready 並設 active；README／production guide／作者指南已更新四包維護流程。
- AC ZIP 用 File resource、主檔 `circuit-ac-workbench/index.html`，没有 assessment manifest。正式 AC rubric／SCORM activities 依使用者安排另議；D3/D4 prototype 教學版面完善亦不是本次新增範圍。
- 真 Moodle／真手機 T4 未有環境，未標記 Moodle-ready。完整外部 fullscreen／native scroll、低風險正式活動的記分／續作／pending／review仍須各自驗收。
- 此版按 A0/A1、A2–A5、A6 分階段提交並 push。最後 release verification 在 `output/ac-release-verification.json`：25個circuit Node、604個AC browser observations、四個套件、21共用及6個AC擴展檔案的SHA與source/ZIP逐檔byte核對；文檔提交不冒稱新的runtime執行。

### 共通控制欄位置修正（2026-10-09）

- 按使用者回饋，移除 AC 將共通按鈕搬入「更多」的 DOM 操作，以及頂欄／底部操作的獨立排列覆寫。DC／AC 直接使用同一 template 與容器寬度規則；旋轉、複製、刪除與相機在底部，復原與文件工具在頂欄，接線／手掌／播放在畫布上方。
- 波形開關放在交流量測面板；時間、波形及場／能量仍為 AC 額外工具。短畫面依可用高度分配畫布與 panel，不以隱藏共通操作或縮小觸控目標換取空間。
- 完整 AC source／ZIP 回歸 **688 observations** 通過，新增共通 DOM 位置及可信旋轉／縮放／復原斷言。其後補上波形「返回電路」，避免 panel 收起時無法切回；最後六 viewport 的 source／ZIP focused 回歸 **348 observations** 通過，包含 panel 隱藏後返回及動態狀態不變。
- `npm run check`、transient 解析測試及 AC profile／codec／合法恢復測試通過；四包已由統一 build 重建並逐檔核對。這次未改 DC 的 editor／template／CSS 或物理核心。證據：`output/ac-baseline/ac-toolbar-followup.log`、`ac-toolbar-final.log`；既有全站及外部 gate 狀態保持。

### 交流元件實物外觀修正（2026-10-09）

- 按使用者回饋，十種 AC 元件分開實物及符號繪圖：電源器材／正弦源、磁極轉子／發電機符號、無極性電容／平行板、繞線線圈／電感、雙擲器材／接點、鐵芯雙繞組／變壓器、LED 封裝／二極管，以及三種交流錶盤／儀表圓圈。
- 不移動元件端子，不改 transient 方程或時間狀態。AC 器材本體按已有 bounds 計算可點選範圍，轉向後仍可選取；DC 元件的命中規則保留。
- 燈光沿用已有平均功率顯示，新增實際求解驗證：3 V／6 V 對應不同亮度、功率約四倍；50 Hz 跨相位亮度穩定、1 Hz 過零／峰值亮度不同、零供電不亮。
- 完整 AC source／ZIP **796 observations** 通過，包含十種元件的兩視圖、本體可信點選、時間不自行演進及各預設的既有操作／恢復／多 instance／gesture regression；實物與符號 contact sheets 已逐一檢視。
- **25 circuit Node 檔**、`npm run check` 及 DC source／ZIP focused 快捷操作 **70 observations** 通過；四包已統一重建與來源逐檔核對。證據：`output/ac-baseline/ac-apparatus-browser.log`、`dc-apparatus-followup.log`，圖在 `output/playwright/circuit-ac/*-apparatus-{real,schematic}.png`。未改物理模型或文檔版本，全站／Moodle／實機 gate 狀態保持原記錄。

### 低頻、真實時間及面板打磨（2026-10-09）

- 使用者指定常用頻率 0.1–2 Hz、另設 50 Hz 真實交流。預設普通源 1 Hz、generator 2 Hz；頻率控制 metadata 統一滑塊、快捷步進及編輯 transition，非法 2–50 Hz 間值拒絕。原模型的 SI／離線數值範圍與已保存文件不做靜默改寫。
- 工作台設定倍率固定 1；移除原自動 1/100 速。求解時間按前台真實 elapsed 推進，仍限制每幀計算預算及防止背景追算。數值算不及時仍不跳過物理時間步，不承諾任意龐大電路在所有裝置必定即時。
- 燈泡每 RAF 更新，與较低頻的整體 label layout 分開；顯示保留 20 ms 平均功率，交流採連續亮度曲線，避免硬裁剪亮度的平頂。沒有改電路功率、儲能或燈絲熱模型；DC 顯示保留。
- Panel 回到 DC 寬度／breakpoint；移除時間與實驗、預設講解及課堂探索。波形保留配置允許的單步及回到初始條件；教師工作台不提供慢播／倍率。
- 交流 wire-current card 固定幅寬、固定 mA、預留箭嘴空間；過零或未知狀態亦不收縮。DC label 路徑保留。
- 50 Hz 的無儲能電路改用每週期至少 32 步（每步兩個半步取樣），避免對沒有儲能歷史的電路重做完整一步的狀態誤差估計；含 C/L 仍保留原 128 步上限與自適應誤差控制。解析有效值、功率、能量及事件測試保持原容差。
- 發現量測 bin 在浮點邊界會漏掉步進餘段；修正邊界捨入。修改前 120 次 50 Hz frame continuation 有 27 次 displayPower 未能確定，修正後全部穩定，沒有用零或上一個數字冒充未知。
- 實際測量 source／ZIP 的 2 Hz／50 Hz：1.602–1.611 s 實際時間對應約 1.619 s 物理時間；頻率、動態燈光及固定 card widths 的 focused 28 observations 通過。完整 AC source／ZIP **828 observations**、25 個 circuit Node、DC source／ZIP focused **70 observations**、`npm run check` 及四包 source byte 檢查通過。實物／手機／電流卡截圖已檢視。最後只有註解及未使用時間面板 CSS 清理，已重新打包；沒有用早期 ZIP 的 hash 冒稱後來來源相同。
- 日誌：`output/ac-baseline/ac-real-time-focus.log`、`ac-real-time-browser.log`、`ac-real-time-node-final.log`、`dc-real-time-followup.log`。固定 transformer 示例仍保持原 50 Hz 模板，舊 codec 不偷偷換成 1 Hz；正式活動／真 Moodle／實機 gate 仍按既有安排。

### 共用慢速按鈕及預設啟動更正（2026-10-09）

- 使用者澄清：只移除 1/10、1/100 等選單，保留 DC 共用的 ¼ 速慢動作按鈕。移除工作台 rate:false 設定及 AC 將按鈕移出 DOM 的操作；配置禁止倍率時仍保留 disabled 按鈕，不能越權。
- AC 初始播放條件與 DC 對齊，保留系統 reduced-motion 設定；沒有 play 權限的活動仍暫停。切換預設／載入文件保留手動播放狀態，回到初始條件亦保留。切換慢動作或新 session 清空前台排程餘量，避免以舊倍率／舊文件追算。
- 動態快照 restore、undo/redo checkpoint、單步及只讀仍依既有明確檢視／凍結合約暫停。
- 完整 AC source／ZIP **846 observations** 通過；其後重設操作補上排程清零及先 reset 再清波形，最後 focused **52 observations** 驗證自動啟動、¼ 速、無倍率選單、暫停保留、運行中重設及 2/50 Hz 效果。DC source／ZIP focused **70 observations**、AC profile／codec Node 及 check 通過。
- 日誌：`output/ac-baseline/ac-autoplay-browser.log`、`ac-autoplay-final.log`、`dc-autoplay-followup.log`。四包已按最新來源重建核對；原有全站與外部驗收狀態維持。

### 預設電路的緊湊佈局（2026-10-09）

- 依使用者要求，收緊全部非空 AC 預設的元件中心及導線外框，縮短單純串聯的空段，C/L 串聯使用转角、LC 以左側儲能／右側切換配置，變壓器與自感減少上下空白。沿用共用相機及自動適應；AC 自動放大上限由 120% 提高至 180%，DC 保留 120%。器材世界尺寸與工具不變，讓相同畫布能顯示較大的器材。
- 17 個預設對照修改前：元件 ID／種類／params、導線 ID／from／to／resistance，以及 t=0.1 的完整 physics snapshot 均完全一致。只是初始幾何，沒有更改電學或既有匯入文件。
- 固定嵌入示例的外層 codec 升至 version 2，拒絕舊固定模板，避免靜默重排；modelRevision、完整 document／session 格式不變。
- 完整 AC source／ZIP **854 observations** 通過（包含 desktop scale>150% 斷言）；最後再收緊三元件的上下空段，六 viewport source／ZIP focused **350 observations** 通過。Desktop default 180%／手機／LC／transformer／mutual 的截圖已逐一檢視；電容器內文字在倒轉排列仍保持正向。
- Node 驗證所有 preset 的 body bounds 不重疊、有限導線的實際兩端等於接孔及外框寬度；AC physics／profiles／codec、`npm run check`、DC source／ZIP focused **70 observations** 通過。最後幾何再次比對 17 個預設的 params／端點／t=0.1 physics 完全一致。
- 證據：`output/ac-baseline/ac-layout-before.json`、`ac-compact-final.log`、`ac-compact-controls.log`、`dc-compact-followup.log`。四包由统一 builder 重建核對；原全站與外部 gate 維持。

### 電流卡收窄（2026-10-09）

- 依使用者回饋，一般 AC 電流卡從約 178px 收至約 124px，依既有字體量度函數預留最長格式的固定文字欄及箭嘴空間，顯示字體不縮小。使用既有 CircuitMath 数值格式，極小／極大值緊湊科學記數，不另寫 formatter；mA 單位、瞬時數值及方向邏輯不變。
- Node 覆蓋零、極小／極大、正負及未知量，要求卡片寬度固定且小於145px；瀏覽器核對實時寬度不變、數字在框內且不碰箭嘴。DC 標籤的排法不變。
- AC source／ZIP focused **60 observations**、AC profile／codec／格式 Node、DC wire-current-label Node 及 `npm run check` 通過。實測卡寬 124.14px，2 Hz／50 Hz 各幀保持同寬；文字在框內且與箭嘴分開，截图已檢視。四包已由 builder 重建核對。
- 日誌：`output/ac-baseline/ac-current-card-narrow-final.log`。原全站／Moodle／實機 gate 狀態保持。

### 電容電荷與可變繞組（2026-10-09）

- 工具箱及新元件的名稱改為「變壓器」。既有教師自訂 label 不批量改寫。
- 實物電容改為兩塊平行、帶厚度與透視的金屬板；正紅、負藍，電荷組依 q=CU 等量異號，隨電壓反向交換。均勻網格與多子路徑集中成兩個 SVG charge paths，密集時允許重疊／壓縮，最多4096組/板保護繪圖資源；真實q與電路結果不裁剪。
- 電容電荷與燈光同樣逐 RAF 更新；未知/關閉場不畫假電荷。場面板重用元件 renderer，電容方向跟隨畫布旋轉。普通「讀值」開關與質性的電荷示意分開。
- 電感圈數依 L∝N² 的示意尺度調整；transformer 原、副圈數以同一10:1尺度跟隨实际匝數，繪圖標明实际N。兩視圖均更新，不修改 L/M/匝數求解或端子。
- 新 Node 驗證電荷平衡、增減、反向顏色、C 的影響、未知及 field 關閉，以及 L/N 兩視圖動態繞組；browser 验證即時 RC charging 和權限，不以私有 SVG 數量做活動評分。
- AC source／ZIP focused **32 observations** 及完整 **894 observations** 通過；DC source／ZIP focused **70 observations**、AC physics／profiles／codec Node、`npm run check` 通過。正負極板、電感與變壓器不同圈數、實際 RC charging 及 field 的 screenshot 已檢視。
- 日誌：`output/ac-baseline/ac-reactive-art-focus.log`、`ac-reactive-art-browser.log`、`dc-reactive-art-followup.log`。四包已按最新來源重建逐檔核對；外部 gate 狀態不變。

### DC／AC 共用緊湊電流標籤（2026-10-09）

- 使用者要求共通介面改進也套用 DC。renderer 的 current card 共用 28px 箭嘴欄及 4px 水平內邊距，由相同 layout 路徑計算；不按 analysis 選兩套留白。
- DC 自動單位／TeX 與適應文字寬度保留；AC 的固定欄及固定 mA 是時間變化所需的呈現策略。共同留白修改令 DC 非零 current card 比舊版收窄 6px，AC 亦按同一規則進一步收窄。
- DC source／ZIP 的 **26 viewport/view cases**（1280／390／320px、兩視圖、可信標籤操作）、AC source／ZIP focused **60 observations**、DC label／AC profile Node 及 `npm run check` 通過。DC 的 arrow/text 間距及卡寬有專項斷言，自動單位、零與未知語義保持。
- 日誌：`output/ac-baseline/shared-current-dc-browser.log`、`shared-current-ac-browser.log`。統一 builder 已更新四包並核對來源；外部 gate 狀態不變。

### C／L 範圍及電容板距（2026-10-09）

- 使用者選定工作台 C 100–2000 μF、L 0.05–5 H；C 每10 μF、L 每0.05 H步進。共用 components.byType/byId.ranges（SI）限定 min/max/step，UI、快捷、命令、palette、匯入及restore同一驗證；不授予本來未開放的參數權限。舊文件超出此profile則拒絕，不靜默裁剪，核心模型range／格式不變。
- 元件parameterSpec合併 byType/byId 範圍，quick controls與inspector使用同一份spec；個別活動可設另一range，限制也適用DC元件。
- 平行板的可見gap按 C 反向變化，採壓縮幾何比例避免極端參數使器材穿出接孔。透視斜升從11減至5，plate右側中點 y=-3，引線精確接到動態right edge；孔ID及座標仍固定±60。
- Node及browser覆蓋range設定、非法restore/load／命令、快捷上限、不同C板距與midpoint lead。AC source／ZIP focused **50** 及完整 **912 observations**、25 circuit Node、DC source／ZIP focused **70 observations**、check／diff 通過。1000／2000 μF 的板距及右引線截圖已檢視；四包已由 builder 重建逐檔核對。
- 證據：`output/ac-baseline/ac-ranges-plates-focus.log`、`ac-ranges-plates-browser.log`、`circuit-ranges-node.log`、`dc-ranges-followup.log`。舊模型 range／格式、全站已知 blocker 及外部 gate 維持。
