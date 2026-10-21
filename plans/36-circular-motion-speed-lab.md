# 圓周運動：線速率與角速率量度

狀態：**P2 第六輪展平尺單位、桌面圖例及概念題選項順序已修正並發布；手機面板高度經指導文件核對保持原設定。P3 真 Moodle／真手機驗收待做。**

本活動讓學生自行開始及停止量度，把圓周軌跡展平後讀取路程、時間及累積轉角，計算並比較線速率與角速率。以同軸與不打滑皮帶兩個情境對照「相同角速率」與「相同線速率」的不同約束。

依 [新活動模板](NEW-SIMULATION-PLAN-TEMPLATE.md) 展開，遵循 [共同風格](00-shared-platform-and-style.md) 與 [製作及驗證契約](../docs/simulation-scorm-production-guide.md)。共同規則由原文件維護；下列數值、欄位及流程是本活動的 P1 決定。未執行的驗收保持未勾選。

## 使用者已確定的範圍與本次審查項目

已確定：

- 第一個活動只處理線速率與角速率量度及比較。
- 同一剛性圓盤上的兩點，以及不交叉、不伸長、不打滑皮帶連接的兩輪輪緣，是兩個主要情境。
- 每題隨機決定驅動速度，量度期間保持勻速；兩點速度必須符合裝置約束。
- 學生自行開始及停止量度；量度時連續留痕，停止後定格。
- 軌跡以動畫展成直線，對齊同一把尺，顯示路程、時間及轉角，讓學生計算。
- 切線方向、短時間位移、速度變化量 Δv 移到第二個活動；向心加速度亦不屬本版，其是否納入第二個活動另議。
- 本活動使用獨立 worktree；後續每輪完成實作或修正，都要驗證、commit、push，並部署到本活動的同一個 Sites 網站。
- 使用者於 2026-10-21 審查計劃並授權在專用 worktree 實作、測試、commit、push 及部署 Sites。

P1 依已批准計劃採用半徑題庫、轉速範圍、三位有效數字、100 分配分與 60 分達標線及第一版功能邊界；學生試用後可按實際回饋調整。

## Worktree 與並行開發邊界

| 項目 | 本活動決定 |
|---|---|
| Worktree | `C:/Users/frens/.codex/worktrees/circular-motion-speed-lab/simlab` |
| 分支 | `codex/circular-motion-speed-lab` |
| 起始分支與 commit | `main`；`e8800209c53f7e08b19b49ffe09123f5891e1b89` |
| GitHub remote | `origin`，`https://github.com/frenselw/simlab.git` |
| P1 變更 | 活動 runtime、manifest、目錄、測試登記、browser 驗證與本計劃；Sites 使用獨立私有來源 |
| 活動自有範圍 | `sim/circular-motion-speed-lab/`、本計劃、對應 manifest、活動專屬 browser driver |
| 共同編輯點 | `sim/config.js`、`tools/test-registry.js`，以及確有需要時的 mobile-scroll 活動登記 |
| 共用 runtime | 只引用既有 shared 檔案；不得順便重構或改動其他活動 |

所有後續命令均明確指定此 worktree 作工作目錄。不要切換原 checkout 的分支，不要把其他 worktree 的未提交檔案搬過來。開始新一輪先檢查本分支狀態與 remote；保留非本輪變更，不使用強制覆寫、整檔取代共同登記表或 force push。

加入 catalogue / registry 時只增加本活動的條目。整合其他分支或 main 前，先完成本輪 commit；解衝突時保留雙方活動登記。同步後重新核對受影響的測試、manifest 與部署資產。開發中的 localhost 埠及 browser session 均使用本活動名稱，避免干擾其他 worktree。

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `circular-motion-speed-lab`；由等時路程與轉角判斷 v、ω，理解同軸與皮帶的不同相等條件 |
| Delivery scope / package | 一個形成性 SCORM 1.2 SCO，內含兩個可獨立切換的情境；另以同一 runtime 部署 Sites 練習版 |
| Learner task / main interactions | 觀察、開始量度、停止量度、展平、輸入四個數值答案、比較及選擇原因、檢查與提交 |
| Shared subject core / activity outer layer | 無既有圓周運動核心可直接沿用；參考小車活動的量度體驗，學科模型與評分由本活動擁有 |
| Runtime files / libraries | 原生 HTML/CSS/JS + SVG；不新增套件、CDN、數學排版引擎、3D 引擎或通用物理框架 |
| Assessment risk / trusted validation | `formative`，前端評分；高權重正式考核不在本版範圍 |
| Out of scope | 速度向量、Δv、向心力／加速度、齒輪嚙合、交叉皮帶、打滑、帶伸長、角加速度、能量損失、學生手動設計傳動裝置、教師題庫編輯器 |

教材依據：人教版高中物理必修第二冊，第六章第 1 節（印刷頁 23–26）；頁 32 的相等條件可供教師理解銜接，但本活動不考加速度。來源 PDF 位於使用者提供的 `C:/Users/frens/Work/OneDrive - 時尚屋/澳門坊眾/Textbooks/S1-3/【人教版】高中必修 第二册物理电子课本.pdf`，不放入 runtime 或網站。

流程參考 [直線運動活動計劃](10-linear-motion-velocity-lab.md) 及 `sim/linear-motion-velocity-lab/`。沿用共同 runtime；不直接載入小車的整個 model 或複製它的 SCORM 控制器。第一版不抽出新 shared 模組，不為尚未實作的第二個活動預留介面。

### 預計檔案與責任

| 檔案 | 責任 |
|---|---|
| `sim/circular-motion-speed-lab/index.html` | 三區版面、兩情境導航、原生控制及無障礙標籤 |
| `styles.css` | 活動特有的響應式配置、軌跡／尺／讀數呈現 |
| `main.js` | 畫面、動畫、計時、操作轉換及 shared lifecycle 銜接 |
| `model.js` | 題目條件、兩種運動約束、累積量、讀數與展平幾何的純函數 |
| `scoring.js` | 依題目與量度資料產生權威讀數，評四個數值及四個概念答案 |
| `persistence.js` | schema 驗證、encode/decode、還原、重新評分所需的語意狀態 |
| 四個活動測試檔 | `model.test.js`、`scoring.test.js`、`persistence.test.js`、`ui-runtime.test.js` |
| 活動 browser driver | `tools/circular-motion-speed-browser-regression.js`；同一入口驗 source 與真正解壓 package |
| Manifest | `sim/manifests/circular-motion-speed-lab.xml`；列齊本活動六個 runtime 檔案及四個 shared 相依 |

活動自有檔案已按本表建立，沒有新抽象或外部相依。

## Catalogue metadata (`sim/config.js`)

| 欄位 | 值 |
|---|---|
| title | 圓周運動：線速率與角速率量度 |
| folder | circular-motion-speed-lab |
| categories | Mechanics |
| description | 自行計時記錄同軸與皮帶傳動的圓周軌跡，展平讀數並比較線速率與角速率。 |
| tags | physics、mechanics、circular-motion、measurement、belt-drive、scorm |
| status | 實作期間 planned；可部署並通過相應驗證後才 active |

P1 已同步新增 catalogue、manifest 與測試登記；發布前須保持三者一致。

## 學生流程與教學呈現

1. 開啟即見情境與低速轉動，頁首可選「同軸轉動／皮帶傳動」。開始時速度答案及作答欄均未填。
2. 按「開始量度」：從當下位置同時記錄兩點，公共計時器由零開始，軌跡只包含此次量度區間。
3. 按「停止量度」：兩點、時間及軌跡同步定格。學生自行決定何時停，不以量度滿一圈或達到固定秒數作完成門檻。
4. 按「展平軌跡」：兩條有色弧線展成直線，起點對齊共同零刻度；可按「返回圓周軌跡」看停止時的圓圖，再按「展平軌跡」重看，同一次量度及答案不變。
5. 讀取共同 Δt、各自 s 與 Δθ，計算 vA、vB、ωA、ωB。可提供公式文字「路程 ÷ 時間」「轉角 ÷ 時間」，不預填計算答案。
6. 判斷 vA 與 vB、ωA 與 ωB 的關係，各選一個原因。重點是條件而非模糊的「哪個比較快」。
7. 隨時進入「檢查答案」；完整、部分或全空白均可明確提交。提交後才顯示正誤、分項分數及解釋。

兩個情境互不依賴，可直接切換並保留各自草稿。建議先同軸後皮帶，但不以答對第一題解鎖第二題。既有量度結果可返回圓圖、再次展平或重播展平動畫，不會因此重新量度或改分。

### 同軸與皮帶圖示

- A 一律代表較小半徑，B 一律代表較大半徑；全活動維持 A 藍、B 橙，圖旁固定圖例標明 A／B。桌面較寬時把圖例字與色點放大，手機維持緊湊尺寸；字母不跟著旋轉點移動，顏色不是唯一辨認依據。
- 同軸用單一剛性圓盤上的 A、B 兩點，初始在同一半徑方向，以細參考線顯示共同掃角；不畫成兩個互相摩擦的輪。
- 皮帶用 A 小輪、B 大輪，B 是主動輪；普通外公切線形成不交叉皮帶，兩輪同向轉動。輪緣標記固定在輪上，皮帶記號獨立隨帶走，不能永久黏在輪緣標記上。
- 皮帶直線段要與兩輪實際相切，輪心距大於半徑和；不能用兩條穿過輪緣的水平線偽裝不同大小輪的切線。
- 轉向只作運動提示，不出速度箭頭、不問切線方向。第一版固定逆時針，避免加入不必要的符號判斷。

### 量度、跨圈與展平

- 記錄開始角、累積時間及題目條件，不記每幀軌跡點。超過一圈時，以「完整圈數＋剩餘弧」顯示；重疊軌跡不能當成只走一圈。
- 量度、暫停、停止及返回圓圖時，以固定起始射線、隨點轉動的終止射線及由內向外延伸的細角弧顯示累積轉角；角弧末端不畫彩色圓點，以免誤作第三個運動點。同軸 A、B 共用一個角圖，皮帶兩輪各有一個。每轉一圈角弧向外多一層，最多畫最近兩圈以限制 SVG 複雜度；下方整圈數仍以未截斷的實際轉角為準。轉動時不跳動顯示數值，暫停／停止後在圖下以 MathML 符號列出累積 rad 及對應度數，保留側欄正式 rad 讀數。不可將圓周軌跡的尾弧當成累積轉角。
- 停止後的總路程包含全部圈數；累積轉角不以 360° 或 2π 取餘。例如 1.5 圈是 3π rad。
- 展平的兩條線使用同一長度比例、同一零點。以較長總路程選共同尺量程；絕不把兩條線各自縮放至滿高。
- 展平直尺本身明示 m，尺旁亦明示 sA、sB 及 m。轉角仍在圓心射線／掃角參考中顯示，另列 ΔθA、ΔθB（rad）；可輔助顯示度數，但正式 ω 單位固定 rad/s。
- 展平動畫表示路徑的弧長逐段展直；已展直長度與剩餘路徑長度之和保持總路程。不要直接內插弧線與直線頂點，造成動畫中線長縮短卻仍標原長度。
- 跨很多圈時不逐圈生成無界數量的 SVG；用圈數及等比例總長呈現，總長仍涵蓋所有圈。可見曲線採有限取樣，權威讀數永遠來自解析弧長，不由折線長度估算。
- 展平時左邊保留不轉動的原圓周路徑，同軸情境兩圓同心，皮帶情境兩圓分開。彩色剩餘弧線依此次量度的實際累積轉角逐段縮短，右邊兩條直線依共用尺比例增長；不得另造一個按放大後直線像素距離高速滾動的小圓。約 1.8 秒完成，已展平與待展開數值相加始終等於總路程；左圓只用半徑比例表示軌跡，正式路程由右方共同直尺讀取。重播、返回圓圖及再次展平沿用同一資料，減少動態偏好直接顯示終態。
- P2 第二輪的皮帶沿真實外公切線閉合路徑加連續鏈節紋路，整條帶的紋路按輪緣線速率移動，兩輪及皮帶暫停時同步定格；移除只能在一條直線段活動的白點。
- 超短正時間仍可停止與計算，不設反應速度評分；若同一時刻的按鍵令 Δt 為零，保留量度狀態並提示繼續或進入檢查，不能除以零。

## Physics or subject model

### 題目參數草案

| 參數 | 首版範圍／決定 | 理由 |
|---|---|---|
| rA | 0.10、0.15、0.20 m 三選一 | 半徑具體、可辨認 |
| q = rB/rA | 1.5 或 2 | 差異足夠可見，又非永遠同一比例 |
| rB | q × rA | 不獨立亂數，保持題目關係 |
| 主動角速率 Ω | 0.35、0.45、0.55、0.65 rad/s 四選一 | 正常數秒量度可觀察弧線，又可自然跨圈 |
| 初始角 | 兩標記均由同一參考方向開始；之後依各自角速率運動 | 不額外隨機角位置增加認知負擔 |
| 皮帶輪心距 | 1.6(rA+rB) | 仍不重疊並存在外公切線；縮短兩輪間距，讓小屏幕輪與軌跡有足夠面積 |
| 兩情境抽題 | 各自抽取合法參數；保存具體參數索引 | 新 Moodle attempt／新 standalone session 抽新題；同 attempt 續作不重抽 |

上述半徑抽題是本計劃的建議；使用者已要求的是隨機驅動速度。實作前依審查結果可固定半徑題組，物理與評分設計不因此改變。

| 情境 | 角速率 | 線速率 | 等時比較 |
|---|---|---|---|
| coaxial | ωA = ωB = Ω | vA = rAΩ；vB = rBΩ | ΔθA = ΔθB；sB = q sA |
| belt | ωB = Ω；u = rBΩ；ωA = u/rA | vA = vB = u | sA = sB；ΔθA = q ΔθB |

對每點 i：累積 Δθi = ωi Δt、si = ri Δθi。繪圖當前角才可取模 2π；時間、圈數、路程和轉角權威值不得取模。比較題使用題目約束，而不是猜測輸入答案的大小。

此處 v 與 ω 均指非負大小。s/Δt 是平均線速率；本活動勻速時也等於瞬時線速率。圓周位移大小與路程不同，不稱 s/Δt 為平均速度大小；不引入位移計算。

### 計時、暫停與精度

- 由單調時間基準更新模型，不以幀數當時間。輪的位置、計時與軌跡共用同一累積時間；低幀率不得改變運動結果。
- 可暫停／繼續觀察；量度中暫停亦停止計時，不能混入閱讀時間。切換情境、開檢查、頁面進入背景時暫停；返回後由學生繼續或停止量度。
- 隱藏期間不補算真實經過時間。離頁保存由 shared provider 提供最新語意狀態，不新增活動自己的 commit/finish/pagehide 保存機制。
- Moodle 恢復正在量度的資料時保留 elapsed 與軌跡，但以暫停狀態顯示；不在學生未察覺時繼續計時。
- elapsed 的技術上限擬為 86,400 s。到達時暫停而不自動提交／改成已完成；保留資料，仍可停止量度、檢查或重新量度。這是數值防護，不是教學門檻。
- 物理值保留雙精度；s、Δt、Δθ 顯示三位有效數字，量度數值太小或太大時使用可讀科學記數法。UI 不顯示零分母或無限值。
- 計算題以重建出的顯示讀數作分子、分母，再取三位有效數字作參考結果。不能用未顯示的小數要求另一個答案。相等讀數共用同一來源與 formatter。

## Responsive layout contract

| Decision | Activity specification and reason |
|---|---|
| Three regions | Header：標題、兩情境按鈕、檢查入口、fullscreen；stage：輪／軌跡／尺；panel：計時控制、讀數、答案及回饋 |
| Fullscreen | 外層 main 標 `data-sim-fullscreen-target`，header 標 `data-sim-fullscreen`；沿用 `shared/fullscreen.js`，右上 44px 目標、20px 圖示，所有 phase 可用 |
| Desktop / tablet | 寬度 ≥ 820px 時左右排列；panel 約 280–320px，其餘給 stage |
| Control-panel classification | bounded split-panel；學生輸入答案時仍需看尺和讀數，panel 自己捲動，activity document 無第三個垂直捲動層 |
| Phone | Header → stage → panel；stage 目標約 60dvh、最低 13rem，並為可捲動 panel 保留至少約 7rem；生產指南硬下限 96 CSS px。500px 高播放器實測 stage 276px、panel 約 109px，符合約 7rem／硬下限，故本輪不任意改比例；窄直屏把皮帶裝置縱向呈現並裁去多餘留白，短橫屏改左右配置 |
| Phone text | 正文及輸入 16px，次要字 14px；主要讀數／尺標於實際縮放後仍可讀，按鈕至少 44px |
| 短播放器 | 320×225 等極短尺寸採緊湊雙欄、精簡文字；仍需可到達最後答案與提交鈕，不增加 stage 內捲動 |
| Viewports | 320×500、390×500、390×600、390×844、1280×800；另測 320×225、480×320、工具列變動、軟鍵盤及 200% zoom |
| Scroll topology | stage 空白與非互動 SVG 歸外層 host；panel 歸自身；原生手勢，不控制或修改 Moodle parent 的 DOM／overflow |

左右兩條展平線與尺須完整留在 stage；長讀數透過排版換行或合理記數法處理，禁止橫向整頁捲動。check／結果頁可收起 stage、讓答案摘要使用全高 panel，但 header 與 fullscreen 保留。

## Navigation, submission and reset

| Decision | Activity specification |
|---|---|
| Navigation | mixed：兩情境獨立；情境內量度→展平→數值作答有真實資料依賴 |
| Final check access | 每個 editable phase 均有「檢查答案」，包括 ready、量度未停、尚未展平及正在展平 |
| Incomplete submission | 摘要逐項顯示未量度／未答；不要求全部情境看過、不要求逐項略過，允許提交零分 |
| Editable reset | 「重新量度本情境」保留題目參數，清量度資料與四個依賴它的數值答案；兩個比較及兩個原因答案保留；另一情境完全不動 |
| Reset confirmation | 已有量度或數值答案才提示清除範圍；從全空白重新開始不增加確認 |
| Scored / pending | 無清除結果、重新量度或再提交不同答案；同一有效 payload 的技術重試依 shared 規則 |

| 操作／答案 | 依賴 | 缺少或改動時 | 合法下一步 |
|---|---|---|---|
| 開始量度 | 合法題目參數 | 未開始只有示範轉動，沒有成績資料 | 開始或檢查 |
| 停止量度 | measuring 且 elapsed > 0 | elapsed = 0 不創造偽測量 | 繼續、重新量度或檢查 |
| 展平／返回圓圖 | 已停止且正時間的記錄 | 不能替學生自動量度；返回圓圖只改暫態視圖，量度及答案不變 | 展平、返回、重播或檢查 |
| 四個數值答案 | 同情境 unwrapped 記錄 | 重新量度時清除；未量度保持未答，其他分項不受影響 | 作答、重播、換題或檢查 |
| 比較與原因 | 題目裝置條件 | 不依賴某次數值答案，不連鎖扣分 | 可獨立作答或檢查 |
| 檢查返回編輯 | 原 activeCase 及每個 case 狀態 | 不補造已完成旗標、不重抽題 | 改答案後再次按檢查 |

不增加專用「確認此步」按鈕。數值欄在 input 時同步保存文字，包括尚未離焦的有效或未完成輸入；離開欄位不應是防止答案遺失的必要條件。

## Diagrams, notation and assistance

| Decision | Activity specification and reason |
|---|---|
| Notation | 所有物理量和公式以原生 MathML 呈現 LaTeX 式字形：r、s、Δt、Δθ、v、ω 變量斜體，A/B 下標清楚，單位 m、s、rad、m/s、rad/s 正體；不顯示原始 LaTeX 或增加外部排版套件 |
| Arrow graphics | 僅有裝置轉向及掃角提示；沒有可建構的速度／力向量，向量箭頭評分 N/A |
| Snap | 不需要：沒有拖點、拖尺或自由作圖，不把正確答案吸附出來 |
| Touch preview | 不需要：按鈕、輸入與選項不要求精確圖上落點；讀數直接標示，不考手指讀尺位置 |
| 色彩及尺度 | A/B 顏色固定並加文字；輪半徑同比例，展平線共用距離比例；不能以等角弧圖當作相等弧長 |

第一版不增加人工拖尺、調節半徑、時間游標、任意旋轉視角或放大鏡。這些不是使用者目前要求的操作，會增加手勢與評分範圍。

## Touch gesture ownership contract

沿用 [完整手勢契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)。沒有拖曳仍需測量各 phase 的 stage／panel／host 行為；不以「無 drag」豁免手機驗證。

| Target type / modes | 可見範圍及計劃 selector | 事件與 touch-action | 鍵盤替代 |
|---|---|---|---|
| Header 導航／檢查 | `[data-case]`、`#checkButton`，每個 ≥44px | 原生 click；不建立 drag capture | Tab、Enter／Space |
| 量度／暫停／展平／重播／重新量度 | panel 的 `[data-action]`，每個 ≥44px | 原生按鈕；不得以透明 hit box 蓋住 stage | Tab、Enter／Space |
| 數值輸入 | `[data-answer]`，標明物理量與單位 | 原生輸入，可捲 panel | 鍵盤輸入 |
| 比較／原因選項 | `[data-choice]` 的原生 radio 與 label | 原生選取；label 有足夠高度 | Tab、方向鍵、Space |
| 圖形與尺 | `#motionStage`／`#motionSvg`，全區非操作面 | pan-y；SVG 不截走 host 手勢 | 由文字讀數取得等價資訊 |
| Fullscreen | shared `#fullscreenButton` | shared trusted click | shared 鍵盤行為 |

| Touch starts on | Owner | 本活動決定 | Evidence |
|---|---|---|---|
| 輪、皮帶、尺或 stage 空白 | enclosing host | pan-y，沒有全畫布 none 或透明互動覆蓋層 | 待驗 |
| panel，包括頂／底邊界 | panel only | 自身 overflow-y，contain，host 不連帶捲動 | 待驗 |
| 左／右 stage 邊緣 | enclosing host | 全 stage 均可滑；無 drawing/orbit，專用 32px 側帶要求 N/A | 待驗 |
| 自由畫布／拖動 handle | N/A | 首版完全沒有此類控制；新增即須更新本表與矩陣 | N/A |

| Host case | 計劃 frame chain／實際 owner | 執行要求 |
|---|---|---|
| T0 standalone | 直接開活動；bounded document 無可捲範圍，panel 為自身 owner | stage 無 host 可捲時記 N/A，不假稱測過外層捲動 |
| T1 direct iframe | scrollable outer window → bounded activity iframe | 外層 window 捲，panel／activity document 不動 |
| T2 nested | scrollable outer window → 不捲的 wrapper iframe → activity iframe | wrapper 不動，真正 outer owner 捲 |
| T3 element | bounded outer document → overflowing player element → activity iframe | player element 捲，所有 window 不動 |
| T4 Moodle | 真實 current-window 及提供的新視窗播放器；實測 frame chain、origin、sandbox、owner | 真手機 iPhone/Safari、Android/Chrome 另驗，不以 T1–T3 代替 |

| Phase / scenario / mode | fixture 與合法續作 | 需覆蓋的手勢／不變量 |
|---|---|---|
| ready；兩情境 | 新題→開始量度 | stage blanks、所有控制、panel 頂中底 |
| measuring；零／正時間，執行／暫停，跨圈 | 開始→量度／暫停→繼續或停止 | 滑動不能開始／停止或改答案；模型正常時間增量另記 |
| captured；一圈內／多圈 | 停止→展平 | 圖上起終點和重疊弧不截手勢 |
| 展平動畫／unwrapped | 展平→填一欄→重播 | 動畫不移動 panel／host，不改量度及輸入 |
| unwrapped；空白／部分／完整 | 作答→檢查→返回任一情境 | 鍵盤出現、未離焦輸入、尺與最後控制可達 |
| check；空白／部分／完整 | 直接進入→返回或提交 | 全高摘要 panel 的雙向滑動與邊界 |
| submitted／committed／pending／technical | 使用真正 lifecycle outcome 建 fixture | 唯讀不變、可用的 fullscreen／retry／文字，不新增重做入口 |
| reduced motion／SVG 不可用時的文字讀數 | 等價記錄與計算→檢查 | 無動畫亦可完成，不虛報圖形觀察能力 |

Source 及解壓 SCORM 均執行 T0–T3；覆蓋慢滑、雙向快速 flick、放手後 owner、panel 邊界、工具列／鍵盤變動及狀態不變。保留 trusted input、每次 move/release metrics、畫面與斷言結果；缺矩陣列或出現 `### Error` 均不能判通過。

## Scoring and tolerance

### 配分草案

每情境 50 分，兩情境共 100 分；暫定 60 分達標，最低 0。評最終保留的答案，不按操作次數、觀看時間或量了多少圈給分。

| 每情境分項 | 分值 | 評分依據 |
|---|---:|---|
| vA、vB、ωA、ωB | 每項 8，共 32 | 各自用所顯示路程／轉角與共同時間計算 |
| vA 與 vB 的大小關係 | 5 | A < B／A = B／A > B 三選一 |
| ωA 與 ωB 的大小關係 | 5 | 同上，與線速率題獨立 |
| 線速率關係的原因 | 4 | 固定語意 key 的單選 |
| 角速率關係的原因 | 4 | 固定語意 key 的單選 |

概念正解：同軸 vA < vB（等時轉角相同、B 半徑較大），ωA = ωB（同屬剛性盤）；皮帶 vA = vB（帶不伸長且不打滑），ωA > ωB（等時輪緣路程相同，A 半徑較小）。

原因選項固定語意為 `rigid-angle`、`equal-angle-larger-radius`、`belt-no-slip`、`equal-arc-smaller-radius`、`larger-always-faster`、`equal-time-means-equal-speed`。每題可從此集合選擇適當四個；比較／原因選項依當次隨機題目參數和題目種類穩定打亂，重繪及 Moodle 續作不跳位；評分仍按固定語意 key，不按位置。

- 四個數值互相獨立，一欄錯不抹掉另外三欄；比較與原因分亦獨立，不以錯數值傳遞扣分。
- 全空白與只有預設轉動／量度而未答皆 0；概念題可在未量度時獨立取得其分數。
- `null`／空字串是未答；未完成或不合法的數字文字不給該項分，但保留其他答案。
- 每個單選只能有一個值，不設多選全選策略；無額外操作分與罰分。
- 回饋在提交後逐項列出學生值、顯示讀數的代入、正解及裝置原因；不能僅顯示「錯誤」。檢查頁只列是否已填，不提前顯示正誤。

### 數值容差

設 E 為按顯示讀數計算並取三位有效數字的正參考值，容差採第三位有效數字的一半，即 0.5 × 10^(floor(log10(E)) − 2)，加只處理浮點邊界的 machine-epsilon guard；不加入籠統的 5% 誤差。

例 E = 0.125 m/s，允許絕對差 0.0005 m/s：0.12549 在內，0.12551 在外；另測下邊界與恰等於界線。答案不要求補足尾零，可接受有限十進數及科學記數法。負數、NaN 文字或未完成輸入屬可保存的錯誤／未完成答案，不當作正確物理值。

## Phase/state matrix

Global view 只有 `task`、`check`；activeCase 為 `coaxial` 或 `belt`。每情境的持久 phase 為 `ready`、`measuring`、`captured`、`unwrapped`。動畫播放／暫停及從展平返回圓圖的視圖切換是暫態；量度中的 elapsed 與開始角是語意狀態，必須保存。

| Phase / variant | 必要狀態 | 不得出現／保留資料 | 還原與合法續作 |
|---|---|---|---|
| ready，全空白／已有概念答案 | 合法題目，elapsed=0 | startAngles=null；四個數值字串空白；概念可留 | 觀察、開始或檢查 |
| measuring，elapsed=0 | startAngles 已建立 | 四個數值空白；可留概念答案 | 以暫停恢復，繼續或檢查 |
| measuring，elapsed>0，一圈內／多圈／到技術上限 | 開始角及 elapsed | 無偽 end timestamp；數值仍空白 | 暫停恢復，繼續／停止／檢查；上限時不再繼續加時 |
| captured，一圈內／多圈 | elapsed>0，停止記錄 | 尚未展平，四個數值空白 | 展平、重新量度或檢查 |
| unwrapped，動畫中斷／空白／部分／完整答案 | 正時間記錄 | 允許四欄任意合法長度文字；動畫幀不保存 | 還原直接顯示展平終態，編輯、重播或檢查 |
| check，兩情境 phase 任意合法組合 | activeCase 與所有答案 | 不改 phase、不捏造已量度 | 返回任一情境，或提交空白／部分／完整 |
| check 返回 task | 同上；被選情境為 activeCase | 其他情境原樣；無新題 | 編輯後再次檢查；無額外 fromReview 狀態，入口始終一致 |
| submitted review | shared review + 同一權威答案 | 結果唯讀；可含 ready／measuring／captured 的未完成記錄 | 唯讀切換／回顧，fullscreen；不能續量 |
| pending／committed | shared 擁有的凍結 payload／結果 | 不重抽、不重算成另一份提交 | 驗證後重試相同 payload／完成 finish |
| invalid／unknown technical | 可信任的最小資料 | 不把錯誤轉成新空白 attempt | 技術鎖定；不宣稱已提交／達標 |

| Transition / trigger | 前提與改動 |
|---|---|
| start | ready→measuring；記當下兩開始角，elapsed=0 |
| pause／resume | phase 不變；最新 elapsed 保存；切換、背景、check 或 restore 一律 paused |
| stop | measuring 且 elapsed>0→captured；固定讀數來源 |
| unwrap | captured→unwrapped；語意狀態先確定，動畫只是呈現；中斷後仍可續答 |
| remeasure | editable；當前 case→ready；清測量與數值答案，保留 definition、概念及另一 case |
| edit input／choice | 立即更新當前答案與 shared draft；不以 blur 作保存條件 |
| check／back | 只改 view／activeCase，暫停運動；不強迫停止未完成量度 |
| submit | 僅由 check 明確觸發；固定權威答案，交 shared 判斷結果 |

## Persistence contract

### 權威 answer schema v1

下表是欄位規格而非實作程式；所有列出的欄位均必須存在，不以遺漏必填欄位代表空白。外層使用 shared snapshot envelope，activity 為 slug；schema/model/rubric 版本均為 1。

| 欄位 | 精確型別／允許值 |
|---|---|
| schemaVersion / modelVersion / rubricVersion | 整數，各固定為 1 |
| view | `task` 或 `check` |
| activeCase | `coaxial` 或 `belt` |
| cases | 固定包含 coaxial、belt 兩個物件，不容許缺其中之一 |
| 每 case.definition.radiusIndex | 整數 0..2，對應 rA 題庫 |
| 每 case.definition.ratioIndex | 整數 0..1，對應 q 題庫 |
| 每 case.definition.speedIndex | 整數 0..3，對應 Ω 題庫 |
| 每 case.phase | `ready`／`measuring`／`captured`／`unwrapped` |
| 每 case.measurement.startAngles | null 或恰兩個有限數 [φA,φB]，各在 [0,2π)；同軸角一致（只留浮點 guard），皮帶兩標記可有不同相位 |
| 每 case.measurement.elapsed | 有限數 0..86400 秒；與 phase 不變量一致 |
| 每 case.answers.vA / vB / omegaA / omegaB | 各為長度 0..32 的原始字串；空字串未答，輸入中的 `-`、`.` 等可保存但不計分；渲染必須 escape |
| 每 case.answers.speedRelation / angularRelation | null 或 `lt`／`eq`／`gt`，均比較 A 對 B |
| 每 case.answers.speedReason / angularReason | null 或本計劃六個固定原因 key 之一，需符合該題允許選項集合 |

Draft 與 review 使用同一權威 answer 結構；review 另外由 shared envelope 保存結果比較 metadata。提交前 view 固定為 check，但允許每情境保留任何合法 phase；沒有完成量度的數值項維持未答。已完成記錄仍需滿足 phase/schema，不能因為唯讀就略過驗證。

| State category | 本活動處理 |
|---|---|
| Authoritative | 題目索引、phase、開始角、累積時間、原始答案、activeCase/view；這些足以重新計算、重畫與續作 |
| Derived | r、Ω、v、ω、路程、轉角、圈數、讀數、分數、DOM ID、尺量程及點坐標；由上述狀態重建，不信任外部提供的快取 |
| Transient | requestAnimationFrame 時戳、目前是否播放、純觀察角、展平動畫進度、返回圓圖視圖、焦點、hover、DOM、fullscreen；不保存 |
| Validation | 有限數、索引、版本、phase 組合、同軸相位、答案長度、選項 key、正時間依賴；合法錯答案與非法模型資料分開 |
| Compatibility | 第一版只接受 v1 組合；未來先決定已提交／pending 的舊版驗證與重評政策，不默默用新規則改舊分 |
| Size | 兩 case、八個最長數值字串、最長原因 key、跨圈與所有 shared envelope 最壞組合，實測 ≤4000 UTF-8 bytes；不保存軌跡歷史／圖片 |
| Invalid editable draft | 保留原資料並技術鎖定；首版不提供活動自訂「清除壞檔」捷徑 |
| Invalid finished | 保持唯讀，只顯示可信任的 LMS 摘要；不恢復編輯 |
| Invalid pending | 先 shared quarantine，再鎖定；不得重試被拒絕 payload、清除或重開 |

每個合法矩陣變體都須 production encode/decode/restore，確認分數相同，並執行一個合法續作。至少覆蓋兩情境 phase 的 4×4 組合，再加 view、activeCase、量度零／正／跨圈／上限、答案空白／部分／完整與檢查返回；無效組合另測，不以無效 fixture 代替真實未答狀態。

## Shared SCORM lifecycle

使用 `SimScorm.loadAttempt()`、`SimActivityFlow.startup()`、`SimScorm.setDraftProvider()`、`SimScorm.submitWithCallbacks()` 與 `SimActivityFlow.submission()`。shared styles、scorm、activity-flow、fullscreen 四個檔案均列入 manifest；不直接讀寫 LMS 欄位，不自行 commit/finish。

| Outcome / policy | 本活動行為 |
|---|---|
| editable startup | 新題或驗證後恢復；所有恢復的量度先 paused，原答案保留 |
| review startup | 還原權威答案、重評並經 `reviewResult()` 比對；唯讀顯示 |
| frozen startup | 驗證同一 pending 答案及重評一致性；只提供合法技術重試 |
| load-error | 顯示技術訊息及鎖定，不假扮 standalone 或新 attempt |
| success | 確認記錄完成，顯示分項與回顧，禁重新量度 |
| committed | 分數已 commit、finish 未完成；結果鎖定，僅重試 finish |
| frozen submit | 結果未確認，凍結同一 payload；不顯示「已提交／通過／不通過」 |
| retry | retryable=true 才可保留編輯及再試；false 為技術鎖定，不保證可重試 |
| Review trust | 分數／pass／LMS 不一致或未知，顯示不確定狀態，不把保存分數當權威 |
| Standalone / Sites | memory-only；刷新即新空白練習；忽略舊 localStorage/sessionStorage/IndexedDB，儲存被拒仍可用；不宣稱送到 Moodle |
| Moodle resume | 同 attempt 保留題目、草稿、回顧及有效 pending；只有 Moodle 提供新 attempt 才重抽 |

## Test plan

### 物理、讀數與教學可觀察結果

- [ ] 題庫所有合法組合符合 rB>rA、同軸等 ω、皮帶等 v；不交叉皮帶轉向、切點及輪緣／皮帶記號運動一致。
- [ ] 0.2 圈、整圈邊界、1.5 圈、兩輪不同圈數及大量圈數均有正確累積路程／轉角；不因取模或幀率漏計。
- [ ] 共同開始／停止時刻；量度前的觀察不計入；暫停與背景時間不計入；低幀率和一次較大合法 time delta 結果一致。
- [ ] 展平終態與原弧長一致；兩線零點、共同 px/m 比例、尺量程及標示正確；動畫中總長不變，少動態／中斷／重播不改資料。
- [ ] 同軸顯示不同長度相同轉角；皮帶顯示相同長度不同轉角；停止位置不影響上述關係。
- [ ] 三有效位顯示、整數進位、小數／科學記數法、除法參考值及上下容差界線；評分與畫面讀數一致。

### 評分、保存及生命週期

- [ ] 空白 0、只觀看／量度 0、單欄 8、獨立概念分、單情境全對 50、全對 100、60 分達標界線及上下限。
- [ ] 每個 editable phase 可進 check 並提交；未量度／量度未停／尚未展平可交；無全答／全看 gate。
- [ ] 當前情境重新量度只清依賴它的四個數值與記錄；另一情境及獨立概念保留。
- [ ] 每個矩陣變體 round-trip 後同分並執行合法續作；未離焦輸入、check 返回及背景中的 measuring 續作。
- [ ] 非有限模型數字、越界索引、缺欄位、非法 phase 依賴、壞版本、過長輸入、錯誤 key 被拒；合法錯誤數字文字不被當作毀損資料。
- [ ] 最壞 draft/review/pending envelope 的 UTF-8 大小 ≤4000；失敗時縮減非必要資料，不提高限制。
- [ ] shared 啟動／提交所有 outcome、壞 pending quarantine、review mismatch／unknown、儲存與 finish 失敗均有實際 UI assertion。
- [ ] Source 與解壓包的 standalone 刷新清草稿／check／已提交狀態；舊 checkpoints／壞資料／被拒儲存不阻新練習。Moodle 同 attempt 另驗恢復。

### 畫面、觸控與包裝

- [ ] 所有指定 viewport、短 iframe、200% zoom、鍵盤、工具列變化；尺、單位、最後輸入與提交鈕可達。
- [ ] 兩情境各 phase 在 source／package 以 trusted input 通過 T0–T3；blank、panel 頂中底、兩側、flick/release 及控制按鈕無錯誤手勢。
- [ ] Shared fullscreen 在 edit/check/review/pending 進出、外部退出與拒絕情況均正確，沒有覆蓋標題或遺失答案。
- [ ] 真正 ZIP 解壓後啟動；runtime 資產與來源一致，無 CDN，根有 imsmanifest.xml，無測試／源 PDF／憑證混入。

### Test registration and CI selection evidence

依 [登記程序](../docs/simulation-scorm-production-guide.md#test-registration-for-new-simulations) 實作，不另建測試清單。

| Item | 活動決定／待執行證據 |
|---|---|
| Runtime resources | 本活動 manifest + 六個自有／四個 shared runtime；將來新增任何載入資產須同時更新 |
| Logical tests | 上述四個 `sim/circular-motion-speed-lab/*.test.js` 加入 registeredTests；scope 由目錄繼承 |
| Browser owner | `tools/circular-motion-speed-browser-regression.js`，kind browser、scope circular-motion-speed-lab；一個入口依次驗 source／extracted package |
| Helpers | 初版不預建；若出現 `*-browser-cases.js`，登記確切 file、scope、consumers，不能只放檔案不登記 |
| Manual gate | 沿用已登記 mobile-scroll host runner 加本活動 phase fixture；T4 真 Moodle／真手機另記，不移出正式 CI 以省時間 |
| Registration check | `npm run check:tests`；實作後填命令、結果、報告位置 |
| Committed selection | `npm run test:affected -- --base=<實際基準SHA> --head=HEAD --plan`；記兩個真實 SHA、mode、browser entries、packages 及 fallback 原因 |
| Initial CI scope | 新 catalogue／registry 變更按現行政策觸發 full；不能以活動單測代替初次完整驗證 |
| Later scope | 已有可信 main 基線後按實際 diff 選擇；保留 source/package 及部署驗證，不把 selection preview 當執行結果 |
| GitHub evidence | 以實測 commit 對應 run URL、scope、結果；未完成不得預稱綠燈 |

Windows browser 命令依製作指南與使用者指定的 Git Bash wrapper；長流程放忽略的 `output/playwright/` script，啟動自己的本地 server、等待 HTTP 可用、關閉 browser/session。CLI exit 0 但輸出含 `### Error` 視為失敗。

## 實施順序及每輪交付

| 階段 | 實作範圍 | 階段完成條件 |
|---|---|---|
| P0 計劃審查（本輪） | 專用 worktree／branch、此完整計劃 | 文件連結與 diff 檢查；commit、push 計劃分支；交使用者審查。沒有可部署活動，Sites N/A |
| P1 第一個完整可用版本 | 兩種模型、量度／跨圈／展平、讀數、輸入／比較、部分評分、保存與提交、手機版、manifest/catalogue/tests | 通過 package-ready 所有適用自動／本機門檻後 commit、push、建立本活動私人 Sites 並發布；不能把未完成計分頁當完成版 |
| P2 使用者審查後每輪修改 | 依實際回饋做最小完整變更，同步模型／rubric／schema／測試影響 | 相關驗證、整條 branch diff、commit、push、更新同一 Site、記錄新版本與結果 |
| P3 真實教學驗收 | 真 Moodle、真手機、續作／提交／重試及試教 | Moodle-ready 證據另填；若需修正，回到 P2 完整交付循環 |

P1 內部可以分批提交可審閱的 model、UI、scoring 工作，不把每個中間 commit 當作完成交付。每次向使用者聲稱一輪可用版本完成，必須有該輪 commit、GitHub push 及成功 Sites 部署；失敗的項目明確標記未完成。

### 每輪 commit、push、Sites 部署的固定流程

1. 確認此 worktree／branch 及變更清單，完成本輪要求與相關測試。變更共享部分時覆蓋所有已知使用者，不碰無關改動。
2. 更新此計劃的現行決策及實際驗證記錄；檢查工作區 diff 與從真正 main/base 到本分支的整體 diff。先完成規定檢查，再 commit；不為過關關閉測試或降低斷言。
3. 將本輪完整變更 commit 到 `codex/circular-motion-speed-lab`，push 到 `origin` 同名分支（第一次建立 upstream）。不直接推 main、不 force push；合併 main 屬後續獨立整合操作。
4. 用已提交 SHA 執行 selection preview，記錄所選範圍。首次完整驗證及後續受影響驗證依規定執行，保留 GitHub CI 實際狀態。
5. 從已測 runtime 重建本活動 SCORM ZIP，解壓驗證。Sites 輸入使用同一份 runtime bytes；不得把未提交試改混進發布資產。
6. 按下節 Sites 官方流程同步來源、保存版本及部署，保留原有私人權限及同一 project ID／網址。必要的憑證只在記憶體及 stdin 傳入，不入 Git、檔案或 log。
7. 取得原生成功結果才宣稱已部署。記錄 GitHub commit、Site source commit、archive hash、saved version、deployment ID、實際 URL 與驗證限制。
8. 若發布證據只在部署後才取得，可再作一個純文件 commit 並 push 補記；runtime 未變不用為這個記錄提交重發完全相同網站。任何 runtime 變更必須重新驗證及部署。

只改計劃／文件的輪次仍 commit、push，但未改網站且沒有新活動產物時不建立空網站或無意義部署。這不豁免任何已完成實作／修正輪次的 Sites 發布要求。P0 已完成；本輪為獲准的 P1。

### Sites 發布規格

- 新建本活動自己的 Site，不重用平拋或其他活動的 project ID。首次預設 owner-private；往後保留 audience，不自動公開。
- 使用 Sites 技能的 buildless static HTML/JS 流程。網站來源工作目錄放此 worktree 的忽略目錄 `output/sites/circular-motion-speed-lab/`，其中 dist 包含活動入口及其本地 shared 相依，根 index 導向此活動。
- 不把整個 simlab checkout 當作 Site source repo，也不讓 Sites helper 改寫 simlab 的 origin／分支。GitHub 開發庫與 Sites 官方來源庫是兩個獨立 commit 記錄，證據中清楚分開。
- P1 已註冊並發布私人 Site。project ID 已記下；`.openai/hosting.json` 保存相同 ID 與 static directory。P2 沿用原 Site，不重新建立網站。
- 更新先 `get_site` 與 `create_source_repository_write_credential`，按官方 `site-workflow.mjs` 開啟／同步該來源，沿用其完整 opening result。複製本輪已驗 runtime 到正確 dist，不帶其他 Site identity、Git metadata、測試或憑證。
- 官方 helper 接收 stdin JSON，負責 Site source commit/push 與 archive；將回傳的 project_id、commit_sha、archive 原樣交 native publication，不手工偽造來源 commit。
- owner-private 使用 `save_version_and_deploy_private`，或官方提供的分開 save/deploy 流程。只在 pending/building/publishing 時查狀態；終態失敗即處理／報告，終態 succeeded 才完成。
- Site 是獨立練習展示：沒有 Moodle API 時依 shared standalone 規則運作，不增加另一套儲存或假 LMS。
- P0 計劃審查期間沒有建立 Site；P1 已建立並發布私人專用 Site。P2 修正仍使用同一 project ID、私人權限及網址。

## Package-ready checklist

- [x] 使用者已審查本計劃；模型、rubric、依賴、phase/schema、手機與測試決策齊全。
- [x] 本活動 Node／UI、source／解壓 package、T0–T3 與 fullscreen 適用矩陣均通過；真手機 T4 另列。
- [ ] `npm run check`、`npm run check:tests`、`npm test`、`npm run package:all` 依指南通過，記命令、SHA、範圍與報告。
- [x] `git diff --check <實際base>...HEAD` 及工作區差異檢查通過；測試登記與 committed selection evidence 齊全。
- [x] SCORM 根 manifest、全部 runtime 相依及來源／解壓一致性已驗。
- [x] 本輪 runtime commit 已 push；本活動私人 Site 部署成功，GitHub／Site source／archive／deployment 對應可追溯。

## Moodle-ready checklist

- [ ] Package-ready 通過；真 Moodle 學生帳號提交分數與狀態正確。
- [ ] 同 attempt 草稿續作、跨圈資料、pending retry、提交後唯讀及新 attempt 政策正確。
- [ ] T4 真手機 complete phase/mode 手勢矩陣通過，含 current-window／提供的新視窗播放器、flick/release、鍵盤與 fullscreen。
- [ ] 真正學生試用能解釋同軸等 ω、皮帶等 v，且能分清路程、轉角與平均速度大小；記錄需要修改的教學呈現。
- [ ] 高風險伺服器驗證 N/A：本活動限定形成性用途；如用途升級須另規劃。

## 實際證據與狀態

| 項目 | 本輪狀態 |
|---|---|
| Worktree 建立／附加 | 已完成，路徑與分支見前文 |
| 計劃 | 2026-10-21 使用者已批准 P1 實作及每輪發布；P2 四項回饋已更新於前文現行決定 |
| 文件／diff 檢查 | `node tools/check-docs.js plans/36-circular-motion-speed-lab.md` 通過、無 skipped links；staged diff 及 `git diff --check e8800209c53f7e08b19b49ffe09123f5891e1b89...27ff676bd3e8e25f97bd79c778bc231b7efa1683` 均通過 |
| Committed selection | `npm run test:affected -- --base=e8800209c53f7e08b19b49ffe09123f5891e1b89 --head=27ff676bd3e8e25f97bd79c778bc231b7efa1683 --plan` 通過；mode `docs`，原因 `Only ordinary documentation changed`，browser entries／packages 均為空，無 fallback；只使用原 checkout 的既有 Node dependencies，沒有新增套件 |
| 計劃 commit／push | 計劃 commit `27ff676bd3e8e25f97bd79c778bc231b7efa1683` 已 push 至 `origin/codex/circular-motion-speed-lab` 並建立 upstream；本節為其後的純文件證據補記 |
| Runtime／SCORM | 六個活動 runtime、四個 shared 相依、manifest、catalogue 與測試登記已建立；`npm run check` 通過（JavaScript 與 SCORM 1.2 manifest profile）；`npm run check:tests` 通過，251 entries／34 browser／48 helpers |
| Node | `npm run test:fast` 通過 217/217；報告 `output/ci-tests/local-1792564606800-20820/report.json` |
| 活動 browser | `node tools/circular-motion-speed-browser-regression.js`：source／解壓 package、390×844／320×225／1280×800、兩情境 100 分、空白 0 分、fullscreen、standalone refresh 通過；皮帶相切位置經圖片核對並增加範圍斷言 |
| 手機 T0–T3 | trusted-touch 報告 `output/playwright/mobile-scroll-acceptance-T0-standalone.json`、`T1-phases-package.json`、`T2-phases-source.json`、`T3-phases-package.json`：完成 1／8／12／3 列（T2 含 committed），errors 0、issues 0；真手機／真 Moodle T4 待驗 |
| 全套測試／package:all | `npm run package:all` 通過，全部 SCORM ZIP 已驗，包括本活動 12 files。Windows 本機 `npm test` 跑至 browser 38/251，既有 household／AC 電路瀏覽器斷言各有一次失敗；該兩段電路 runtime 與 browser 測試在本 branch 均無改動，因此中止必然失敗的長跑，不能列為全套通過。log：`output/playwright/circular-full-test.log`。GitHub Quality run [39559236680](https://github.com/frenselw/simlab/actions/runs/39559236680) 對應 runtime commit `c99ca2fa6754879dabd6371d60aad788d73b2b9b`；Node／基本檢查已過，8 browser shards 尚在執行，結果待補。Package-ready 的全套測試門檻仍開放 |
| Runtime commit／selection | `c99ca2fa6754879dabd6371d60aad788d73b2b9b` 已 push 至 `origin/codex/circular-motion-speed-lab`。以 base `e8800209c53f7e08b19b49ffe09123f5891e1b89`、head `c99ca2fa6754879dabd6371d60aad788d73b2b9b` 做 committed selection preview：mode `full`、packages `all`，原因 `Shared policy, infrastructure or dependency changed: sim/config.js`；`git diff --check` 通過 |
| Sites | 私人 project ID `appgprj_6ad85f290a0081919a849c43bdabdde5`，Site source commit `0aecd0507261b60f65befac75364a7331ae42b00`；本機發布 tar SHA-256 `52417561E68016013D3783B7CD68ED5BE1BBA8772CC0C09BE0043001B4D045AB`，服務端 archive hash `sha256:08b038c6618bf54ac62c13333ea57f7544a2547b1734ebdc6ef5cead72b364b8`。Version 1 `appgprj_6ad85f290a0081919a849c43bdabdde5~appgver_6abb95f20a888191be9cf2a3f2e607ae`，deployment `appgdep_6ad866fc0f248191916f537a9bd97568` succeeded；[試用網址](https://circular-motion-speed-lab.ieyp.chatgpt.site)。`get_site` 複核 custom 權限只有 owner 一人、無群組及外部訪客。Site 與 SCORM 來源 runtime bytes 已逐檔 SHA-256 比對一致 |

上表其餘 runtime、測試和 Sites 證據對應 P1，屬歷史記錄；不能以 P1 通過記錄代替新版本驗證。

### P2 使用者回饋修訂與交付證據（2026-10-21）

| 項目 | P2 結果 |
|---|---|
| 交付內容 | 電腦版縮窄 panel、放大 stage；手機 stage 目標 60dvh，短屏預留 panel 高度；原生 MathML 排版物理量及關係；展平後可返回定格圓圖並再次展平，保留量度／答案；A／B 固定圖例取代跟隨轉動點的文字。皮帶輪心距縮至 1.6 倍半徑和，保留不重疊及真切線。 |
| 活動 commit／push | `15e23347410c029f2d452f0d1a21c093723309f1` 已 push 到 `origin/codex/circular-motion-speed-lab`；`git diff --check c2b3bda735f36f8fb744688334b74463bd6687a1...15e23347410c029f2d452f0d1a21c093723309f1` 通過。 |
| 基本／活動測試 | `npm run check`、`npm run check:tests`、四個活動 Node 測試、活動 source／解壓 package browser 完整流程、`npm run package:all`、計劃連結檢查均通過；SCORM ZIP 12 files，SHA-256 `BD06F6DD519BB608832062783AB36BC346A53E489400DE9050787F8153EC17DF`。Browser 覆蓋 390×844、390×600、320×500、320×225、820×600、1280×800、滿分／空白提交、返回／再次展平及保留答案。 |
| 手機可信手勢 | T0 standalone 1、T1 解壓 package 24、T2 source nested 24、T3 package element 3 情境；報告在 `output/playwright/mobile-scroll-acceptance-*`，全部 completed，errors 0、gesture issues 0。320×500 首輪曾發現 panel 太矮，修正 stage 高度上限後重新通過。 |
| 全庫 Node 測試 | `npm run test:fast` 執行 217 項，215 通過；`sim/force-composition-construction-lab/persistence.test.js` 與 `tools/ci-prepare.test.js` 在本機各達 120 秒 timeout。兩者均不屬本活動修改，單獨重跑均通過；報告 `output/ci-tests/local-1792571534672-33484/report.json`。整輪仍不能標成全庫通過。 |
| 測試選取預覽 | `test:affected --base=c2b3bda735f36f8fb744688334b74463bd6687a1 --head=15e23347410c029f2d452f0d1a21c093723309f1 --plan`：mode `affected`、package `circular-motion-speed-lab`，沒有 fallback；活動瀏覽器回歸已獨立執行。 |
| Sites | 沿用原 owner-private project `appgprj_6ad85f290a0081919a849c43bdabdde5` 及[試用網址](https://circular-motion-speed-lab.ieyp.chatgpt.site)。已核對來源 runtime 10 個檔案與本 branch 完全一致；Site source commit `4cdbd93e6525687eed5a431dca4aef80ea2e8bc8`，發布 tar SHA-256 `D2958F8BC4E245466B237CBDDA60EB5739E827859B9C53D3E22EEF1C0E4758EA`；version `appgprj_6ad85f290a0081919a849c43bdabdde5~appgver_d3756b2419d08191b1851e0e43af130f`，deployment `appgdep_6ad87cc9051c8191ae0886bca0b2539f` 原生結果 `succeeded`。 |

GitHub CI 無需等待；真 Moodle、真手機 T4 及學生試用仍待驗，不以本地瀏覽器結果代替。

### P2 第二輪動畫及皮帶修訂（2026-10-21）

| 項目 | 結果 |
|---|---|
| 動畫／傳動 | 展平時 A、B 的圓弧示意同步滾動、縮短，留下按共同尺量度的直線；約 1.8 秒，重播及返回圓圖可用，減少動態偏好直接顯示終態。皮帶真實切線閉合路徑加移動鏈節紋路，取消單一白點；暫停時鏈節及兩輪同步定格。不改模型、評分、持久 schema 或外部相依。 |
| 活動 commit／push | `376996da9cc236ab5b1a2407a22d2a036eeaabc6` 已 push 至 `origin/codex/circular-motion-speed-lab`；從 `c31407a96e0a1c565234ba721c468ef0e07fb0b2` 的 committed diff 檢查通過。`test:affected --plan` 選本活動及其 browser scope、package `circular-motion-speed-lab`，無 fallback。 |
| 自動驗證 | `npm run check`、`npm run check:tests`、四個本活動 Node 測試、source／解壓 package browser 完整流程、`npm run package:all` 及本計劃連結檢查通過。Browser 包括動畫中段兩條曲線及部分直線、動畫終態、返回／再次展平、整條皮帶紋路移動及暫停定格、兩情境評分 100／0、手機和桌面版面。SCORM ZIP 12 files，SHA-256 `CE52992457EB5B028B6B2819A641564556CBE95C4412E371790DF2B82B7B2B66`。 |
| 手機可信手勢 | T0 standalone 1、T1 package 6、T2 source nested 3、T3 package element 3 個選定相關情境，全數 completed、errors 0、gesture issues 0；報告為 `output/playwright/circular-speed-P3-T0.json` 及 `circular-speed-P2-round2-T1.json`、`T2.json`、`T3.json`。首次並行 T1／T2 曾分別在 Chrome cleanup／CDP evaluation 逾時，減少並行後完整重跑通過。 |
| Sites | 沿用 owner-private project `appgprj_6ad85f290a0081919a849c43bdabdde5` 及[試用網址](https://circular-motion-speed-lab.ieyp.chatgpt.site)，`get_site` 確認 version 3、owner-only。網站 10 個 runtime 檔案與本活動 branch 逐檔 byte hash 一致；Site source commit `1b60918d1f93acc9c229310d12a8d72ae3b50526`；tar SHA-256 `C3311568AA154E6F6EAB80EA4FA355ACF4B4AB1B8B9CD7D7F2985F973D9D7D17`；version `appgprj_6ad85f290a0081919a849c43bdabdde5~appgver_8ff6474d7ea08191908f52da0f2a0190`，deployment `appgdep_6ad8865a4b808191bff08cee48bf202e` succeeded。 |

本輪未重跑全庫 217 項 Node 測試，亦未等 GitHub CI；真 Moodle／真手機 T4 仍是獨立驗收。

第二輪的「滾動圓弧」為歷史版本：它按放大後的直線像素距離轉動，可能在短量度時間內錯誤地顯示多圈。第三輪已移除該小圓；上表保留第二輪當時的發布及測試證據，不能用作現行動畫的正確性證據。

### P2 第三輪展平轉角修訂與交付證據（2026-10-21）

| 項目 | 結果 |
|---|---|
| 動畫／物理對應 | 左側原圓周軌跡固定，同軸兩圓同心、皮帶兩圓分開；彩色剩餘弧線按此次量度的實際累積轉角縮短，右側直線按相同進度和共用尺增長。移除按放大像素距離高速滾動的示意小圓；保留重播、返回圓圖及減少動態行為。 |
| 活動 commit／push | `b63c491110351d2dc2280dc677458dbcdc801139` 已 push 到 `origin/codex/circular-motion-speed-lab`；committed selection preview 為 affected，選本活動 browser scope 及 package `circular-motion-speed-lab`。 |
| 自動驗證 | `node tools/check.js`、`node tools/test-registry.js`（251 entries）、本活動四個 Node 測試、source／解壓 package browser 完整流程、`node tools/package-all.js`、計劃連結檢查及 `git diff --check` 均通過。Browser 於動畫中段核對實際 Δθ 消失比例等於已展直長度比例、原圓周中心固定、終態無殘餘弧線；並覆蓋兩情境、評分 100／0、返回及再次展平。SCORM ZIP 12 files，SHA-256 `31AE178A2C70294569A4CCB84F02632FE8ADC10F6AC8577FED8E9DC6AD315D3D`。 |
| 手機可信手勢 | T0 standalone 1、T1 package 4、T2 source nested 2、T3 package element 2 個選定情境，全部 completed、status passed、gesture issues 0；報告為 `output/playwright/circular-speed-P2-round3-T0.json` 至 `T3.json`。 |
| Sites | 原 owner-private project `appgprj_6ad85f290a0081919a849c43bdabdde5` 的[試用網址](https://circular-motion-speed-lab.ieyp.chatgpt.site)已更新至 version 4，access policy 仍為 custom、唯一使用者為 owner。網站 10 個 runtime 檔案與本活動 branch 逐檔 SHA-256 一致；Site source commit `d1550173d8e6f5ff28fccc2202adbbb42f408940`；tar SHA-256 `45BFB1B492D5B5595D099C6C96912BFB3851799FF30EAAF0DE70EA2DEA4D2E12`；version `appgprj_6ad85f290a0081919a849c43bdabdde5~appgver_2256e6e82cdc8191a13882246fbc2f41`，deployment `appgdep_6ad88cd6bbb88191803eddd164d669ed` succeeded。 |

本輪未重跑全庫 Node 測試，亦未等 GitHub CI；真 Moodle／真手機 T4 仍是獨立驗收。

### P2 第四輪累積轉角圖示與交付證據（2026-10-21）

| 項目 | 結果 |
|---|---|
| 角圖／讀數 | 量度時在輪心顯示淡色角扇、起始／終止射線和向外增長的角弧；同軸共用一個角圖，皮帶兩輪各自顯示。跨圈時最多畫最近兩圈，整圈數和最終轉角均由未截斷的量度值計算；暫停或停止後，圖下以 MathML 符號顯示累積 rad 和對應度數。展平／返回圓圖、評分和存檔 schema 不變。 |
| 活動 commit／push | `78067d3cf58a98311b2b710c1a1e53b3c7943bc7` 已 push 到 `origin/codex/circular-motion-speed-lab`；committed selection preview 為 `affected`，選本活動 browser scope 和 package `circular-motion-speed-lab`。 |
| 自動驗證 | `node tools/check.js`、`node tools/test-registry.js`（251 entries）、本活動四個 Node 測試、`node tools/check-docs.js`、`git diff --check`、`node tools/package-all.js` 及 source／解壓 package browser 完整流程通過。Browser 驗量度中角圖與實際 Δθ 一致、同軸一個角圖／皮帶兩個、跨過一圈後角弧半徑增大、停止後 rad／度數、既有展平及返回流程、100／0 分。SCORM ZIP 12 files，SHA-256 `4B606A7A43224D155F3F72E910D9F461FD06BDC03DBF7F9D80880828350B2B8A`。 |
| 手機可信手勢 | T0 standalone 1、T1 package 8、T2 source nested 2、T3 package element 2 個情境，全部 completed、status passed、gesture issues 0；報告 `output/playwright/circular-speed-P2-round4-T0.json` 至 `T3.json`。另以 390×844 截圖核對量度中及跨圈停止後的角圖，圖片 `output/playwright/circular-speed-angle-live.png`、`circular-speed-angle-multiturn.png`。 |
| Sites | 沿用原 owner-private project `appgprj_6ad85f290a0081919a849c43bdabdde5` 及[試用網址](https://circular-motion-speed-lab.ieyp.chatgpt.site)，已更新至 version 5，access policy 仍為 custom、只有 owner 一名使用者。網站 10 個 runtime 檔案與本活動 branch 逐檔 SHA-256 一致；Site source commit `42ddbfb9dbd2b47cc0dae9099a639ffaec18ff41`；tar SHA-256 `E58C820056A13DB6632D40768FEC51F6992DB2DB51EA15D508FD8092CF2F54D9`；version `appgprj_6ad85f290a0081919a849c43bdabdde5~appgver_423d8857a0fc819195fcd4a9789d288a`，deployment `appgdep_6ad895d24ca48191979373d9751cfab1` succeeded。 |

本輪未重跑全庫 Node 測試，亦未等 GitHub CI；真 Moodle／真手機 T4 仍是獨立驗收。

### P2 第五輪轉角圖端點修訂與交付證據（2026-10-21）

| 項目 | 結果 |
|---|---|
| 視覺修訂 | 移除角弧末端額外的彩色圓點，改以角扇、起始／終止射線及無圓點的弧線表達轉角；A、B 輪緣仍各只有原來的運動點。保留跨圈向外延伸、整圈數及停止後 rad／度數讀數。 |
| 活動 commit／push | `7da57b16e74e6fedc0f96f392f0d3d90c52a2a50` 已 push 到 `origin/codex/circular-motion-speed-lab`；committed selection preview 為 `affected`，選本活動 browser scope 和 package `circular-motion-speed-lab`。 |
| 自動驗證 | `node tools/check.js`、`node tools/test-registry.js`（251 entries）、本活動四個 Node 測試、計劃連結及 `git diff --check` 通過；source／解壓 package browser 完整流程核對量度中與跨圈後角弧無額外端點、數值對應、既有展平／評分。`node tools/package-all.js` 通過；SCORM ZIP 12 files，SHA-256 `BB19C73692E9B60D7AE139C49C50E0350F347224031D2089945B6FD55DAA8DC4`。已視覺核對 `output/playwright/circular-speed-angle-live.png` 及 `circular-speed-angle-multiturn.png`。 |
| 手機可信手勢 | T0 standalone 1、T1 package 4、T2 source nested 2、T3 package element 2 個選定情境，全部 completed、status passed、gesture issues 0；報告 `output/playwright/circular-speed-P2-round5-T0.json` 至 `T3.json`。 |
| Sites | 原 owner-private project `appgprj_6ad85f290a0081919a849c43bdabdde5` 的[試用網址](https://circular-motion-speed-lab.ieyp.chatgpt.site)已更新至 version 6，access policy 仍為 custom、只有 owner 一名使用者。網站 10 個 runtime 檔案與本活動 branch 逐檔 SHA-256 一致；Site source commit `b3764daf5f6ef8cba9dfc62fa3ae33a3ac1e4ce9`；tar SHA-256 `CCDC6FC266FAC8E33ED2B937CADD22BB9E202123D44953AC2DE7C1F36670F7C9`；version `appgprj_6ad85f290a0081919a849c43bdabdde5~appgver_cba18322acd48191a14b2fd0089ff20e`，deployment `appgdep_6ad8cb3a1b408191b5b038d0e205ad46` succeeded。 |

本輪未重跑全庫 Node 測試，亦未等 GitHub CI；真 Moodle／真手機 T4 仍是獨立驗收。

### P2 第六輪尺、圖例、面板及選項修訂與交付證據（2026-10-21）

| 項目 | 結果 |
|---|---|
| 介面決策 | 展平尺右端直接標 `m`，不只在標題及線長附單位。桌面 ≥820px 的 A／B 圖例字及色點隨可用空間增大（1280px 截圖核對）；手機維持緊湊圖例。按共同版面基線及生產指南，保留 bounded split-panel：stage 目標 60dvh，500px 高播放器實測 stage 276px、panel 約 109px，滿足 96 CSS px 硬下限且接近計劃的約 7rem；面板獨立捲動並可到達最後控制，不任意改比例。 |
| 題目選項 | 兩道比較題及兩道原因題按當次隨機題目參數與題目種類作穩定打亂；重繪、返回或 Moodle 續作仍維持同一次順序，評分只看語意 key。測試覆蓋兩情境各 24 組參數：正解可出現在每個位置，選項集合完整，無新增 snapshot 欄位。 |
| 活動 commit／push | `353e4dca4313c0b985389116bf248225d47e85bf` 已 push 到 `origin/codex/circular-motion-speed-lab`；committed selection preview 為 `affected`，選本活動 browser scope 及 package `circular-motion-speed-lab`。 |
| 自動驗證 | `node tools/check.js`、`node tools/test-registry.js`（251 entries）、四個本活動 Node 測試、`node tools/check-docs.js`、`git diff --check`、`node tools/package-all.js`、source／解壓 package browser 完整流程均通過。Browser 驗直尺 `m` 確實在 SVG 可見範圍、桌面圖例字 ≥17px、手機 panel ≥96px／stage ≤60dvh、同次選項順序穩定，以及既有兩情境 100／0 評分。SCORM ZIP 12 files，SHA-256 `91597F6EFFF273ED5CD28516B26A64A2F37B4FE1F06BCD744BDFA5B14C109D67`。 |
| 手機可信手勢 | T0 standalone 1、T1 package 4（320×500、390×844）、T2 source nested 2、T3 package element 2 個選定情境，全部 completed、status passed、gesture issues 0；報告 `output/playwright/circular-speed-P2-round6-T0.json` 至 `T3.json`。T1 的 500px iframe 量得 stage 276px、panel 108.8px，兩輪組一致。 |
| Sites | 沿用 owner-private project `appgprj_6ad85f290a0081919a849c43bdabdde5` 及[試用網址](https://circular-motion-speed-lab.ieyp.chatgpt.site)，已更新至 version 7，access policy 仍為 custom、只有 owner 一人。網站 10 個 runtime 檔案與本活動 branch 逐檔 SHA-256 一致；Site source commit `8170ec1624c6f56edbf4711182e9245ef7c57582`；tar SHA-256 `0778E1CC171EF9C814D117A1CB062D9204C580E02DAED0CBE08C10C9DE583318`；version `appgprj_6ad85f290a0081919a849c43bdabdde5~appgver_f7113a5d681c8191ade6945b60a0937e`，deployment `appgdep_6ad8d1b8d7a48191a24839acf0496607` succeeded。 |

本輪未重跑全庫 Node 測試，亦未等 GitHub CI；真 Moodle／真手機 T4 仍是獨立驗收。
