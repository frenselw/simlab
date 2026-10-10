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

### 電容引線與薄板更正（2026-10-09）

- 使用者明確要求水平直線及右板「板面中央」，而非邊緣／後方中點。兩引線去除全部轉折；右線終點為 front-face 幾何中心，極板位置平移0.5使中心 y=0，導線放在極板繪圖之後，保持板面上的線可見。
- 板側厚度從4降至1.5，outline略收細。板距／電荷／端子ID及±60座標、數值模型均保持。
- 新斷言覆蓋水平無轉折、板面中心、前景繪圖及薄板；AC profile／codec／圖形 Node、source／ZIP focused **50 observations**、`npm run check` 通過。正負電荷、動態板距及新引線截圖已檢視；四包已統一重建逐檔核對。
- 證據：`output/ac-baseline/ac-capacitor-straight-lead.log`。只改 AC 繪圖，既有電學及外部 gate 維持。


### 電感圓筒及連續引線（2026-10-09）

- 依使用者提供的少圈／多圈參考圖，實物電感改為白色圓筒線架；繞線前、後半圈連續接合，後半圈被筒身遮擋。左引線水平進入後向上接繞組，右引線從繞組下端接至端子中線。少圈集中中央，多圈鋪滿筒身，線寬隨密度調整。
- 沿用既有 L 對可見圈數關係、共用 renderer 及場面板，不改電感／線阻／初始電流、符號模式、端子 ID 或 ±60 接孔座標。器材命中 bounds 隨圓筒外框調整。
- Node 覆蓋白色筒身、連續引線接點及稀疏／密集跨度；source／ZIP focused **56 observations** 通過，少圈／多圈截圖已檢視。四包由統一 builder 重建逐檔核對來源。
- 證據：`output/ac-baseline/ac-inductor-former.log`、`output/playwright/circuit-ac/source-inductor-few-turns.png`、`source-inductor-many-turns.png`，以及對應 package 截圖。原全站已知阻塞及外部 gate 維持。


### 極板透視及電感引線／風格更正（2026-10-09）

- 使用者要求參考接線方法而非複製 PhET 外觀。電感改用本工作台既有的灰藍線架、銅色繞線及柔和邊線；減少繞線粗度，左引線與繞組以相同切線方向平滑接合，末半圈直接收至水平右引線，去除原先上下直角轉折。少圈中央／多圈鋪滿及 L 對圈數的示意關係保持。
- 電容板寬由26收至22，透視斜升由5降至1，薄邊由1.5降至1.2；電荷网格跟隨板面。兩條引線仍為水平直線，右端仍接前板面中心；可變板距、正負電荷及固定端子不變。
- AC Node、source／ZIP focused **56 observations**、`npm run check` 通過；已檢視少圈、多圈、正負極板及實際充電畫面。四包由統一 builder 重建及核對來源。僅修改器材繪圖及相應檢查，不改電學、文件或權限。
- 證據：`output/ac-baseline/ac-smooth-reactive-art.log` 及 `output/playwright/circuit-ac/` 的 source／package reactive-art、inductor-few-turns、inductor-many-turns、capacitor-charging 截圖。全站已知阻塞及外部 gate 維持。


### 密集繞組留白置中（2026-10-09）

- 修正繞組以 count 而非 count−1 個圈距計算起點而偏左的問題；按圓筒可見面的透視作小幅位置補償，使密集繞組兩側露出的筒身更均衡。圈數、疏密尺度、平滑接出曲線、接孔及電學保持。
- Node 與 source／ZIP 增加繞組置中斷言；AC focused **58 observations**、Node 及 syntax／manifest check 通過，密集繞組截圖已檢視。四包統一重建及核對來源。證據：`output/ac-baseline/ac-centred-winding.log`，原全站及外部 gate 保持。


### 圓板電容及明顯透視（2026-10-09）

- 使用者澄清需要更大的透視斜度，並指定採 PASCO 類圓板器材外觀；取代原矩形極板為兩塊同角度斜投影的圓板，加薄金屬後緣，使用工作台既有金屬及正紅／負藍配色。圓板從相同 circle 幾何投影，不改電學面積或 C 參數語義。
- 電荷改用等面積徑向取樣，再投影至圓板，均勻分佈且允許高密度重疊；原 q=CU、等量異號、反向、未知、顯示權限及資源上限保持。板距仍隨 C 變化。右水平引線接前圓板中央；左水平引線精確接後緣在 y=0 的交點，沒有懸空。
- Node 增加圓板／薄邊、端點交線及電荷筆劃在圓面內的驗證；AC source／ZIP focused **60 observations**、Node 及 syntax／manifest check 通過。圓板正負電荷、板距及充電截圖已檢視，四包統一重建並核對來源。
- 證據：`output/ac-baseline/ac-circular-capacitor.log` 及 source／package 的 reactive-art、capacitor-larger、capacitor-charging 截圖。符號模式、端子、文件／動態狀態、原全站及外部 gate 保持。


### 電感左引線由下方繞入（2026-10-09）

- 依使用者澄清，左引線先由端子中線平滑向下，再接筒身背面的半圈，由下方繞回第一圈上端；背面半圈隨筒身遮擋。右側末半圈及引線保持，不再左右同向從上方接出。圈數、置中、風格、端子及數值模型保持。
- Node 驗證下方接點／背面半圈的連續路徑及繪圖層次，source／ZIP 驗證實際 SVG 引線向下的幾何；focused **62 observations**、AC Node 及 syntax／manifest check 通過。少圈／多圈畫面已檢視，四包統一重建核對。證據：`output/ac-baseline/ac-inductor-lower-entry.log`。原全站及外部 gate 保持。


### 豎直圓板及窄縫（2026-10-09）

- 依使用者要求，圓板投影移除剪切斜度，兩塊板保持豎直；縮小 gap 公式至 2+4/(1+C/0.0005)，常用範圍只留約2.8–5.3世界單位的窄縫，仍隨 C 反向變化。圓板薄邊、正負電荷、直線引線及固定接孔保持。
- 電荷與左引線交點同步使用豎直投影；Node 驗證窄縫、接點及電荷在圓面內，source／ZIP 增加實際投影無傾斜斷言。focused **64 observations**、AC Node 及 syntax／manifest check 通過，2000 μF及充電截圖已檢視；四包統一重建核對來源。證據：`output/ac-baseline/ac-upright-close-plates.log`。原電學、全站及外部 gate 保持。


### 圓板投影重疊與分開（2026-10-09）

- 使用者以近／遠參考圖澄清：接近時兩板的投影應部分重疊。移除為防止重疊而額外加入的兩個14單位半板寬，改以板中心距離控制位置；常用 C 下中心距離約13.3–42.3，接近時重疊、分開時有可見空隙。豎直圓板、薄邊、電荷及水平引線保持。
- 幾何比例不改 C、q、儲能或權威文件；左引線交點及右板面中心同步更新。Node及browser新增近板重疊／遠板分離的斷言，使用實際圓板外框驗證，並檢視2000 μF／100 μF截圖。
- AC source／ZIP focused **68 observations**、Node及syntax／manifest check通過，四包統一重建核對來源。證據：`output/ac-baseline/ac-overlapping-plates.log`，source／package capacitor-larger及capacitor-separated截圖。原全站及外部 gate保持。


### LED 電流動畫、示例設定及電感放電（2026-10-09）

- LED 原先有求解電流及發光，但缺少 renderer 的元件導電動畫路徑。接上共用 componentFlowPaths：實物沿引脚與內部導體，符號沿支路；旋轉、正負方向、電子／常規電流及關閉共用既有邏輯，截止／未知不畫假電流。
- DC／AC 教師以選單切换示例時保留 display、policy及新導線預設；舊電勢參考端點清除，導線總數至少容納預設已有線。正常 loadDocument／文件恢復仍使用文件自己的設定；profile驗證及學生權限保持。
- 原 inductive 示例在非零電流時斷開單刀開關，沒有放電路徑，實測回報 inconsistent 並暫停；這是理想模型的約束診斷。改為可見供電／放電 SPDT：供電側保留原串聯 source／L／lamp 的參數與數值，放電側經原負載燈成閉路。切換保留電感電流、儲能依線阻及燈衰減；沒有改 solver、暗加電阻或清空能量。
- Node驗證 LED兩視圖及反向並聯半週導通、端點及 off，電感切換電流連續、耗散、保存恢復續算及再供電；DC flow／component-flow／platform、AC／transient通過。AC source／ZIP focused **94 observations**，含真滑鼠點擊切換後不暫停；DC source／ZIP五 viewport的設定檢查 **40 observations** 通過，另有syntax／manifest check。LED及新供電／放電示例截圖已檢視，四包統一重建核對。
- 證據：`output/ac-baseline/ac-led-settings-inductive.log`、`shared-preset-settings-dc.log`。原全站已知阻塞及外部 gate保持，舊匯入電路不自動重接。


### RL 放電、變壓器繞線及雙匝數滑塊（2026-10-09）

- 「通電自感 · 電流建立」沿用 inductive 的供電／放電 SPDT 接法；初始在放電側、零電流，切換至供電側才建立電流，斷電後經原負載燈衰減。保留直流源、1 H及原線阻／負載參數，切換不清儲能；solver與無通路診斷不改。
- 電感及變壓器重用一份連續螺旋繞線 SVG 計算；變壓器分別沿兩個鐵芯柱繞製，後半圈在疊片環形鐵芯之後，前半圈及平滑接線可見。圈數比例、端子／同名端與物理模型保持，原電感幾何保持。
- 原線圈沒滑塊是 inspector只接受主要參數；加入元件定義的 slider metadata，兩個匝數滑塊皆按模型全範圍1–2000顯示。原副預設 UI步距為1，解決原先偏好上限100及min=1／step=10導致終點不可達；快捷每10匝保持。活動範圍可覆蓋 UI步距，所有操作仍經profile驗證。
- Node核對 RL通斷電連續／衰減、繞組前後層次、兩側控制及活動步距覆蓋；AC／transient解析、能量、codec與既有圖形檢查通過。AC source／ZIP focused **110 observations**，含原副兩滑塊真滑鼠拖至1及2000、真點擊 RL通斷不暫停；DC source／ZIP快捷回歸 **70 observations**及syntax／manifest check通過。變壓器、雙滑塊及RL放電截圖已檢視。
- 四包統一重建核對來源；證據：`output/ac-baseline/ac-transformer-rl-controls.log`、`dc-transformer-controls-followup.log`。原全站及外部 gate保持。


### 變壓器外側出線及移除裝飾圓孔（2026-10-09）

- 移除貼近鐵芯的四個裝飾 socket 圓形，保留共用 renderer 的四個實際接線端子及原座標。
- 兩側繞組的可見半圈對稱朝外；變壓器末圈改為完整繞過鐵芯，後半圈回到外側再接出。四條引線只在鐵芯外側作短而平滑的轉接，切線接續繞組及水平接線端，不再横跨鐵芯正面／形成內部迴彎。電感仍使用原有半圈接出幾何，物理及符號不改。
- Node驗證無装飾circle、外側方向及引線起點；browser使用實際出線 path bounding box核對不進入鐵芯正面，source／ZIP focused **112 observations** 通過，原副滑塊端點及RL切換回歸保持。syntax／manifest check通過，最後變壓器畫面已檢視。四包統一重建核對來源。證據：`output/ac-baseline/ac-transformer-terminal-layout.log`。原全站及外部 gate保持。


### AC 電表依 DC 技術細節整理（2026-10-09）

- 參照 DC 計劃第938–941及1220節的機械針／未知值合約；AC A/V/W及AC工作台內的G/W重用同一解析欠阻尼模型，保留位置與速度、超越回擺、衰減及機械限位。原DC A/V算法／參數保持；每種表使用自己的零點、角度、支點及行程。指針不是數值答案，不進入權威快照。
- 原AC表沒接上共用動畫，而且未接線狀態混為collecting。編譯時快取接線狀態，未接妥始終reading=null，機械針回零；資料未足明示collecting，未知／非法接孔不画假讀值。修正AC內G的單位由器材代號G誤作單位，回到SI的A、介面μA；雙量程缺共用／雙正孔、低量程格值亦與DC對齊。
- 三種AC錶面放大及重新校準刻度，A/V30格、W正負各30格；數字依長度調整以避免擠壓。端子座標與電學保持，palette、命中bounds及手機預覽viewBox同步更新。放大錶盤與手機持續預覽重用同一針位，暫停／只讀凍結，減少動態直接定位。恢復新session清除舊机械速度。變壓器設計不改。
- Node慣性測試 **24 cases**，含原DC16及AC/G8；meter/math **96 fixtures**、AC物理／codec／指針未知值／單位及transient解析驗證通過。source／ZIP AC focused **232 observations**，以真實RAF核對四種電表超越、回零、暫停、實際開啟的放大錶盤同步、手機觸控預覽、只讀、減少動態及320/390×500短畫面；canvas/dialog同步誤差0，實際SVG角誤差小於0.000002°（沿用DC 0.0001°幾何容差）。
- 原DC source／ZIP指針回歸 **24 observations**及syntax／manifest check通過；已檢視未接針、大錶盤、手機及短畫面截圖。四包統一重建核對。證據：`output/ac-baseline/ac-meter-inertia.log`、`dc-meter-inertia-followup.log`。沒有把物理／量測誤差容差改鬆，原全站已知阻塞及外部 gate維持。


### 可移動波形儀器與可延伸量測線：實作決定（2026-10-09，驗證待補）

- 使用者要求參考PhET的電壓圖／電流圖工具，取代固定大波形區及控制板四通道／游標設定；預設無圖，取工具後才顯示，教師預設最多兩部，可信活動可配置0–4部並保持既有指定觀察通道。
- 圖框以畫布內CSS位置定位，不隨電路縮放縮小，能拖到邊緣；量尺＋／−只改資料縱軸，大小按鈕及44px角落把手只改框尺寸，另可摺起／放大。時間軸初始按實驗選取後固定，同時觀察的圖用同一時間窗，沒有改物理頻率／播放倍率。
- 電壓兩探頭讀同一電氣島內兩點差；電流探頭量測指定導線或支路，有號電流／不唯一量保留null。探頭線只作量測呈現，不加入求解器、不耗導線庫存、不套有限電路導線長度；探頭可拉遠、線身可拉出彎點，綁定後跟隨端子／導線。
- 圖／探頭／線的手勢捕獲與電路編輯分開，取消還原UI，不寫電路文件或時間快照；兩側32px捲頁區保持。鍵盤可移圖、改框、移探頭／選擇合法測點。活動限制在UI及公開接口同樣驗證。
- 公開觀察工具配置是獨立UI狀態，不自動持久化或冒充SCORM答案；captureSession仍只包含電路與物理。給外層取得／原子設定工具狀態的接口，指定通道限制、数量、失效ID及非法形狀需拒絕。正式評量／題目／Moodle gate仍N/A／另定。
- 重用CircuitObservation及Routing的量測／位置／走線能力；原生Canvas/SVG/DOM，新增一個可選scope UI檔案，登記到AC依賴和測試入口。顯示緩衝按固定時間bin保留首／末／最小／最大資料，容量有界，未知處斷線；有效值／功率的物理積分不變。
- 驗證：純模型的探頭讀值／隔離／不唯一／限制／峰值及工具狀態round-trip；source/ZIP真實mouse/pen/touch拖取、移圖框、resize、資料放縮、兩探頭電壓／導線電流、長線／彎線／取消、相機變動、只讀、多instance、320×500及原生捲動；既有DC／AC回歸與四包重建。


### 可移動波形儀器：完成及驗證（2026-10-09）

- 已用工具箱的電壓圖／電流圖取代常駐大圖、四下拉及游標選項。教師預設兩部，活動可配置0–4及指定元件通道；特殊charge/energy/flux能力仍供作者使用。兩種放大分開：量尺按鈕可在縱軸／時間切換，所有圖時間軸對齊；框可用44px角把手縮放，⤢開大框，雙擊標題摺起，窄畫面以摺起和大圖保持可用。
- 非侵入兩點電壓／導線電流已接上同一物理解，探頭吸附端點／理想導線及電流支路，綁定後跟隨相機及幾何。量測線不耗库存／不套電路線長，線身可拉出彎點、雙擊拉直、Escape／cancel還原；所有操作不改電路／權威物理。圖框互相可置頂，超出資料量尺明示。
- `getObservationTools/setObservationTools`提供獨立UI配置round-trip及原子驗證，`setObservationChannels`保留作者接口，數量及固定通道作用於UI與API。活動電壓探頭不得混合不同獲准通道，未知／跨島／不唯一電流不畫假零。顯示Trace保留取樣峰值、缺口及同時刻事件，RMS／功率積分不變。
- 新pure scope測試已登記run-tests，涵蓋量測truth、隔離、未知、snap、長線與資源、非法／越權／數量／配置restore及有界峰值／事件；AC／transient／原profile及codec Node通過。AC source／ZIP完整 **1212 observations**通過，正式入口包含新scope cases；獨立新儀器focused **88 observations**，涵蓋mouse/pen/touch、兩種縮放、時間對齊、長線／彎線／Escape、讀值、只讀、相機、鍵盤、手機與短畫面。
- 固定transformer/LC活動的工具配置、拒絕非法測點／通道及合法續作、DC+AC+多AC的工具／時間隔離及卸載均納入完整browser；T1–T3原生捲頁把手在儀器存在時保持。DC source／ZIP快捷回歸 **70 observations**、syntax／manifest及diff通過。桌面實際曲線、大框、390/320px及橫向截圖已檢視。
- `circuit-scope-ui.js`已登記AC資產與兩入口，七份AC核心依賴及四個成品由統一builder重建核對。證據：`output/ac-baseline/ac-floating-full.log`、`ac-floating-scope.log`、`dc-scope-followup.log`。全站已知阻塞及真Moodle／實機gate仍按原記錄，正式AC題目沒有自行建立。


### 波形儀器圖示、固定時間尺標及薄框（2026-10-09）

- 電壓／電流工具加入原生SVG小型示波器圖案，沿用工具箱尺寸、拖取及鍵盤名稱；兩種曲線使用各自顏色。沒有增加圖片或外部依賴。
- 移除滾動的絕對時間刻度，圖下方固定尺標由繪圖左端延伸至右端，全寬代表 `span`（例如1 s或2 s），只在時間量尺變更時更新；波形仍按權威模擬時間滾動。時間控制明示「時間窗」，所有圖仍同步。
- 移除正負跳動的瞬時數字及其獨立22px列；未接探頭、未知量及超出量尺保留簡短圖內提示。框改1px邊線及淺色／白色操作區，圖區增加可用高度；44px按鈕、大框／角落resize／資料縮放／摺起及長量測線維持。
- 探頭及Trace純模型測試、syntax／manifest check及diff通過；source／ZIP focused **100 observations**通過，新增實際Canvas字串檢查（只有縱軸刻度）、模擬时间前進而尺標穩定、時間縮放後所有尺標同步及薄框／44px命中範圍。桌面兩儀器、大框及320px手機截圖已檢視。
- source／ZIP完整AC回歸 **1224 observations**通過，包含短畫面、既有物理／電表／元件操作、活動配置、快照續作、多instance、原生捲頁及全螢幕。四個成品已統一重建核對來源；證據：`output/ac-baseline/ac-scope-ruler.log`、`ac-scope-ruler-full.log`、`ac-scope-ruler-check.log`。此次只改AC可選儀器UI，物理解、DC共用控制及正式活動評分不變；全站既有阻塞及真Moodle／實機gate仍按原記錄。


### 軸拖動、連續預覽與課堂示例整理（2026-10-10，完成）

- 使用者要求圖框上下極窄、無常駐量尺按鈕、兩軸均可mouse／touch直接拖縮放。移除footer列；標題16px、時間區18px，expand／close及resize放邊角，透明命中區保持44px。保留框／資料兩種縮放、Home／方向鍵、摺起及原生捲頁區。
- 時間標尺改1/2/5系列、不大於半窗，5 s窗標2 s（40%寬），1 s窗標0.5 s（50%寬），隨range伸縮而不是隨模擬時刻跳動。圖框UI取消還原量尺與曲線；波形和實際頻率不改。
- 電流探頭由Renderer既有導電路徑吸附至元件內部，component target可带fraction，完整驗證0–1，跟隨移動／旋轉／視圖。透明度約22%，selector覆蓋共用pressed／hover樣式，避免绑定又變不透明。
- 共用slider改用AC獨立動態副本；主要session及權威analysis訂閱不在預覽中前進。副本保留20 ms視覺積分而RMS重新收集，播放中波形／光／發熱即時更新；放手一次接受文件及續作時間，取消完整還原。C/L改變仍屬重設實驗。DC保持靜態預覽／原操作。強烈過載可在完整量測窗未滿時用保守三種波形峰值界提前提示，正常額定三波形不得誤報。
- 時間模式的flow新增顯示界（1 pA及電氣島觀察峰值的1e-5），極小電流不再被18px/s最低速度顯示；不改求解數值／波形，DC既有微／nano級電流維持。
- 整理所有教師示例接線：分支明確junction、正交路由，純幾何驗證所有不同wire只可在共享endpoint相交，无長度重疊；self儲能線圈／燈改平行直立兩支路，互感／LED／RC/RL/LC沒有重疊回線。仍核對bounds、端子、線長及物理方向。
- 方／三角波合併到既有源波形控制、舊create別名保留；交流電感0.2 Hz／5 H／12 Ω與直流RL 5 H／0.1 Ω／3 Ω分別呈現頻率效應及約1.61秒電流建立。電容交流2000 μF／120 Ω／0.5 Hz，RMS功率對應亮度在低／高頻約0.304／0.593；電感低／高頻約0.499／0.035。RC採有放電側的SPDT及約1秒時間常數。
- self 5 H在供電後3秒斷電，燈有清楚反向电流與短暫亮光；互感用5 H／20 Ω放電及50 μA量程，驗證通／斷方向相反且脈衝>30%滿量程，直流穩定趨零。LC採2000 μF／5 H（T≈0.628秒），衰減線阻8 Ω。現有範圍不足1–2秒LC：1秒需例如C≈5066 μF或L≈12.7 H；2秒約20264 μF或50.7 H。維持使用者選定範圍，明示限制，不用改慢播冒充物理參數。
- 固定LC技術示例模板已重排並改參數，外層codec升version 3，明確拒絕1／2；完整教師JSON/session及物理modelRevision不升版。正式SCORM題目仍另定。

- 驗證：Node AC/platform／transient／scope／flow／component-flow及DC platform core通過。幾何測試對所有預設無額外交叉／重疊，並避開元件指定bounds或通用器材中央區；新增RC初始放電不供電、解析充放電及保存後合法續作，避免SPDT共用端接錯造成斜線及常供電。
- 完整AC source／ZIP **1258 observations**通過；最後進一步收窄框、修正RC接線及補單指滑片／場示意後，最新 source／ZIP 儀器與連續預覽 **150 observations**、全示例兩視圖／RC/self續作／微小電流 **136 observations**通過。新preset cases也接入既有完整browser入口，沒有只放在臨時腳本。DC source／ZIP快捷參數、拖動／取消、history、權限與恢復 **70 observations**通過；syntax／manifest及diff通過。
- 已檢視最新超薄圖框、半透明探頭、大框／390/320px、按住源滑塊發熱、所有預設，以及RC正確接線／self反向放電／極小電流無箭頭截圖。測試以可見的控制命中區操作；浮動量測線若覆蓋中央，選未被覆蓋部分驗證原生單指控制。所有四包由統一builder重新核對來源／依賴指紋。
- 證據：`output/ac-baseline/ac-axis-preview-full.log`、`ac-axis-preview-final.log`、`ac-presets-final.log`、`dc-live-preview-followup.log`、`ac-axis-preview-check.log`。既有全站阻塞及真Moodle／實機gate仍分開記錄；正式AC SCORM题目沒有自行加入。


### 示例反覆切換不再暫停（2026-10-10）

- 全部示例以不同運行時間反覆切換排查；問題集中於LC／衰減LC在振盪側切回充電時，原接法把非零電流的電感空斷。舊browser把此診斷當成預期結果，沒有驗收示例能正常來回操作；本次改成所有示例都必須持續播放／無診斷的明確回歸。
- 只修改兩個LC示例：C/L始終串聯成閉路，SPDT選擇經原100 Ω電阻及直流源充電，或直接LC振盪。充電是RLC過程，原L/C及理想／衰減線阻保持，切換保存電容電壓與電感電流；沒有暗加電阻、清儲能或屏蔽求解器故障。外接線仍無交叉／重疊，元件中央區及端子／有限線長檢查通過。
- 固定LC配置同用新模板，技術示例codec升至version 4、明確拒絕1／2／3；教師完整文件與session仍保存原電路，不自動改接，modelRevision保持1。C/L範圍沿用已確認值，本次沒有套用尚在討論的擴大範圍。
- Node AC/platform及transient通過；新增 **240次**跨不同時刻、所有示例的反覆切換、储能連續及每次保存恢復後合法續作，允許浮點roundoff但不放寬物理驗證誤差。生產技術codec各phase的round-trip與byte gates通過。
- source／解壓ZIP browser **532 observations**通過，含全部示例兩視圖、12個有開關示例的真滑鼠反覆切換、實際paused=false／無診斷／模擬時間前進，以及LC與衰減LC恢復後真觸控切换。时间前進等待遵守每幀運算預算，不要求較慢互感在固定90ms內完成特定物理時間。最新LC兩模式截圖已檢視。
- 四成品由統一builder核對重建；syntax／manifest及diff通過。證據：`output/ac-baseline/ac-switch-node.log`、`ac-switch-presets.log`、`ac-switch-check.log`。自由搭建的理想空斷線圈等非法接法仍提供真實診斷，外部Moodle／實機及全站既有阻塞仍維持原記錄。


### 目前讀值圓點及橫軸擴展保留歷史（2026-10-10）

- 依使用者提供的PhET表達，在電壓／電流等波形末端畫實心圓點，直接讀當下物理解，距右邊界14px；未知／超出Y量尺不画假點。右側為小段未來留白，X軸全寬及時間間隔的比例仍一致，不把圖最右邊當作現在。
- 原Trace只保留正在觀看的時間窗，拖大時已丟掉舊波形。新增獨立1000秒／8192bin有界歷史，滿額逐步壓縮、保留峰值與缺口；顯示仍最多1025bin。setSpan从歷史及較細的近期資料重畫，不因時間縮小再放大丟資料；預覽複製完整歷史，取消不改權威曲線。未收集區間以淡色及文字說明，不偽造過去資料。
- 50 Hz帶兩圖驗證發現每次物理取樣都重複JSON複製電路文件；改用共用editor既有viewDocument唯讀視圖，對外onAnalysis仍提供獨立結果副本、權限及權威狀態合約保持。
- scope Node驗證舊窗擴至20／100秒、反覆縮放、獨立預覽copy、100000取樣的容量／尖峰／未知缺口、1000秒到期及時間重設；transient物理回歸通過。source／ZIP browser **194 observations**通過：實際Canvas圓點與模型U/I及14px間距、未接探頭不留點、收集30秒後真拖動X軸反覆擴至約20秒而左側保持波形、既有mouse/pen/touch／手機／只讀／動態預覽，以及兩圖50 Hz實際時間倍率0.85–1.15範圍。
- 已檢視圓點、20秒完整歷史及手機大框截圖；syntax／manifest及diff通過。四包統一重建核對，證據：`output/ac-baseline/ac-scope-current-history.log`、`ac-scope-current-history-check.log`。不改物理模型、評分或SCORM；既有全站及外部gate維持。

### 擴大電容／電感的常用範圍（2026-10-10）

- 依使用者確認，常用滑塊改為 C 0.01–0.2 F、L 0.5–10 H；電容預設0.02 F並直接以F顯示，步進0.001 F；電感預設1 H、步進0.1 H。教師數字欄仍接受C最低0.0001 F、L最低0.05 H，舊文件按實際SI值恢復，不偷偷改值。較小值會延伸滑塊下限並用連續步進，避免最大端點不可達。學生活動的自訂範圍仍完整生效，不套用教師常用下限。
- 板距隨新範圍反比縮放，電荷組量改2.5 mC，保持CU、極性及均勻分佈語義，避免大C直接填滿圖形上限。電感繞線沿用既有L比例及動態線寬。物理方程與modelRevision不變。
- RC改0.02 F／50 Ω，保留1秒時間常數；電容交流改0.02 F／12 Ω，維持可見頻率差異；LC改0.02 F／5 H及30 Ω充電支路，約2秒充電、週期約1.987秒。0.2 F配10 H可達約8.886秒週期，之前的小範圍限制記錄已由本段取代。示例仍保持合理放電路徑及連續切換。
- 固定模板技術codec升至5，明確拒絕1–4，避免用新LC參數續算舊模板快照；教師完整document/session保留原參數與幾何。正式AC評分活動仍未新增。
- transient解析測試包括最大C的RC時間常數、保存恢復續算及最大C/L的LC四分之一週期與能量；配置／codec／240次示例切換、scope Node均通過。source／ZIP browser：元件及真滑塊端點／舊值恢復246 observations、示例532、波形194；DC共用快捷操作70。已檢視0.2 F電容與LC示例截圖。syntax／manifest及diff通過；四包统一重建核對。證據：`output/ac-baseline/ac-expanded-ranges*.log`、`dc-expanded-ranges-followup.log`。全站既有阻塞、外部Moodle及實機gate維持原記錄，這些本地證據不代表外部通過。

### 縮小波形儀器探頭（2026-10-10）

- 電流／電壓探頭圓面由44px改28px、邊線由3px改2px；半透明、標記及吸附提示保持，透明拖動命中區仍44×44px，不改測點、接線、物理或保存格式。
- source／解壓ZIP的scope browser 194 observations通過，新增外觀28px／命中44px／中心對齊及半透明核對，既有滑鼠、筆、模擬觸控及鍵盤流程保持。已檢視雙儀器截圖；證據：`output/ac-baseline/ac-smaller-probes.log`。四包統一重建；外部Moodle與真手機未重新驗收。

### 以燈觀察儲能釋放及LED調查（2026-10-10）

- RC示例以20 Ω、6 V恆阻燈替換定值電阻，C改0.1 F，時間常數2秒。充電約6秒後切換，電源退出放電迴路；燈再次亮起並逐漸熄滅，電流方向反轉。開關接線與元件ID保持；教師保存的舊文件不改寫。
- 自感示例保留原有可見放電燈及無交叉接線，改10 H／1 Ω線阻、3 Ω／3 V燈，合上約8秒後斷開，放電時間常數2.5秒，避免原先快速過載閃光。RL已有燈而保持原接法；理想LC仍無損，未把燈加入振盪支路。
- Node解析與模型驗證通過：RC／RL／自感斷源後功率及儲能逐步下降、亮度由0.584／0.576／0.384逐步降至近零、無過載、方向與恢復續作正確；全部示例240次切換保持連續狀態。source／ZIP browser 610 observations核對實際SVG亮度序列、接線、滑鼠／模擬觸控切換及繼續播放；已檢視RC和自感亮燈截圖。syntax／manifest、diff及四包統一重建通過。
- LED另以現有solver及廠商資料調查，未新增預設或改LED畫法：C 0.02 F、6 V，串220 Ω與預設LED可得到約18.3 mA逐漸下降；反接截止，殘餘電壓接近正向壓降，Node解析測試已登記。L 10 H、20 mA放电在1.8 V LED上僅約0.1秒，加220 Ω後約0.055秒，因此不能直接替換原燈而期待幾秒漸暗。現有LED外觀只有亮／熄；若日後新增LED示例須補漸暗、限流、方向及必要反向保護，模型仍無永久損坏。
- 證據：`output/ac-baseline/ac-discharge-led-physics.log`、`ac-discharge-led-inductor.log`、`ac-discharge-lamps-node.log`、`ac-discharge-lamps-browser.log`、`ac-discharge-lamps-check.log`。LED參考來源及具體模型限制見[工作台文件](../docs/circuit-ac-workbench.md#led-放電的可行性)。未重跑全站既有阻塞或真Moodle／實機gate。

### 交流電表外殼精簡（2026-10-10）

- 按使用者要求，移除AC A／V／W實物外殼兩側的額外圓孔；共用socket繪圖仍供其他元件使用，實際接線孔由editor保留。端子、引線、物理、讀值及保存格式不變。
- source／解壓ZIP元件及電表browser 246 observations通過，涵蓋指針回零／慣性／放大錶盤同步、接線量測及手機預覽。已檢視精簡電流表截圖；四包統一重建。證據：`output/ac-baseline/ac-meter-clean-case.log`、`ac-meter-clean-case-check.log`；外部Moodle及實機未重驗。
