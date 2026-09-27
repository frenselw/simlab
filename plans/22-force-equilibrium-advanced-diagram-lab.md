# 共點力平衡：進階受力圖挑戰

> 2026-09-27：使用者已同意本計劃並要求立即完整實作。專用分支：`codex/force-equilibrium-advanced-diagram-lab`，由`main`的`724c3a3`建立。以下作為實作契約；文末原規劃階段紀錄屬歷史。

本活動由[新活動範本](NEW-SIMULATION-PLAN-TEMPLATE.md)建立，依[共用風格](00-shared-platform-and-style.md)及[製作指南](../docs/simulation-scorm-production-guide.md)。操作與美術完整沿用[基礎版](21-force-equilibrium-diagram-lab.md)；本文件集中記錄五種新題的物理條件、研究對象及必要差異。以下為實作契約；驗收結果以文末實測證據為準。

## 教材分析及選題理由

- 圖1只有圖像：小球接觸豎直擋板和45°斜面，未附完整題幹。改編時明訂兩個面固定、光滑且保持接觸，考兩個不同來源的支持力；不假設原圖已交代這些條件。
- 圖2的梯子靠光滑牆、底端接觸粗糙地面。其完整受力圖須保留牆端、地端及重心的不同作用位置；整體屬剛體平衡，不能把所有箭尾移到重心後仍當作完整梯子模型。本版不選入，可另作剛體平衡活動。
- 圖3的雙木塊壓縮彈簧、水平推力下的斜面勻速運動、三繩連接兩球，分別改成單一研究物體的作圖題。原題的求力大小要求不搬入本版；每題只評力的種類和方向。
- 三角支架題若選用，須先理想化為鉸接輕桿及接點，並增加桿力的辨認規則。本輪以「斜繩＋拉伸彈簧」取代，讓五題同時覆蓋彈簧拉伸及壓縮，維持清楚的六種力選項。
- 知識點對應`physics-question-adapt`參考表的「力和力的圖示」、「重力」、「彈力的方向」、「摩擦力的產生條件及方向」、「靜摩擦力與最大靜摩擦力」、「共點力的平衡／平衡狀態及平衡條件／共點力平衡的應用」。五題均為作圖題；A、B為普通，C、D、E為困難，指本系列內的建議分級。

## 五種進階題型

以下方向以未鏡像的示例為準。A–E是題型代號，不是固定出場次序。每次五類各一題；多物體場景仍只指定一個物體作答，一關只有一張受力圖。

| 題型 | 題設及研究對象 | 正確受力（只供設計與提交後回饋） | 進階重點及可變項 |
|---|---|---|---|
| A 雙接觸面中的小球 | 球靜止於左側豎直擋板與向右升高斜面之間；兩面固定、光滑 | 重力向下；擋板支持力向右；斜面支持力垂直斜面向左上，共3力 | 同一物體有兩個N；光滑不代表沒有接觸力。鏡像、斜面角度隨機 |
| B 斜繩與拉伸彈簧 | 小球靜止，由左上拉緊的輕繩和右側已拉長的輕彈簧連接固定端 | 重力向下；繩拉力沿繩指向左上固定端；彈簧彈力沿彈簧指向右側固定端，共3力 | 同時辨認T和Fₛ；彈簧可水平、斜上或斜下，力未必向上。鏡像、繩角及彈簧角隨機 |
| C 壓縮彈簧與兩木塊 | 粗糙水平面上的A、B之間夾有壓縮輕彈簧；施力器另向右推B，兩塊都靜止；本次明確指定A或B | A：G向下、N向上、Fₛ向左、f向右，共4力。B：G向下、N向上、Fₛ向右、F向右、f向左，共5力 | 壓縮彈簧把兩端推開；靜摩擦抵抗滑動趨勢；只畫指定物體的外力。整體鏡像、指定物體隨機 |
| D 水平推動斜面木塊 | 木塊接觸粗糙斜面，受到朝上坡一側的水平推力；相對斜面勻速上行或下行 | G鉛直向下；N垂直斜面向外；F保持水平；f沿斜面與相對滑動方向相反，共4力 | 水平推力不沿斜面；同一施力方向配合不同運動方向，摩擦方向不同。鏡像、坡角及上／下行隨機 |
| E 三繩連接兩球 | 上方繩a連天花與球1，斜繩b連球1至右下球2，水平繩c連球2與右牆；繩均拉緊，兩球靜止；指定球1或球2 | 球1：G向下、a的拉力向左上、b的拉力向右下。球2：G向下、b的拉力向左上、c的拉力向右；各3力 | 繩拉力也可有向下分量；同一條b對兩球作用方向相反；不混入另一物體受力。鏡像、幾何及指定物體隨機 |

### 題幹及提交後解說

- **A題幹**：「小球靜止在兩個固定的光滑接觸面之間，並同時接觸兩面。請畫出小球受到的各個力。」解說按接觸來源逐一辨認兩個支持力，指出支持力垂直接觸面，不把兩個N合併成一支任意方向的力。
- **B題幹**：「小球由一條拉緊的輕繩及一條已被拉長的輕彈簧連接固定端，保持靜止。請畫出小球受到的各個力。」解說分別追蹤繩端及彈簧端；拉伸彈簧沿自身軸線把小球拉向固定端，不能因物體靜止就忽略彈簧。
- **C題幹**：「兩木塊放在粗糙水平面，之間的輕彈簧保持壓縮。施力器水平向右推木塊B，兩木塊仍靜止。請只畫出木塊〔本次指定A／B〕受到的各個力。」鏡像時同步改左右。解說先移除摩擦作趨勢判斷，再還原抵抗趨勢的靜摩擦；B的兩支同向力來自不同物體，不能只留其中一支。
- **D題幹**：「施力器沿水平方向推動木塊，木塊沿粗糙斜面相對地面勻速〔上行／下行〕。請畫出木塊受到的各個力。」解說用相對滑動決定摩擦方向，指出勻速時仍可有多個外力，且N未必等於G。
- **E題幹**：「兩個等重小球由三條拉緊的輕繩連接，水平繩c接到固定牆，兩球保持靜止。請只畫出小球〔本次指定1／2〕受到的各個力。」解說逐條判斷哪些繩直接接到研究物體，並沿繩指向另一端；球1受到b向右下的拉力。

各題的正確力數、方向及上述解說均不在提交前顯示。題幹會明示粗糙／光滑、接觸／拉緊、彈簧拉伸／壓縮、運動狀態及研究物體，避免要學生從裝飾線條猜條件。

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `force-equilibrium-advanced-diagram-lab`；辨認多接觸、多物體、彈簧及不同摩擦情境中的真正外力與方向 |
| Learner task / main interactions | 五張獨立受力圖；沿用基礎版選種類、中心起筆、改箭尖、刪改、undo/redo、清除本題／全部、檢查及明確提交 |
| Runtime files / libraries and justification | 使用原生HTML/CSS/JS、SVG；`index.html`、`styles.css`、`main.js`及與基礎版同職責的model/generator/scene/notation/scoring/persistence/ui-runtime模組；沿用三個shared檔案，不增函式庫 |
| Assessment risk / trusted validation | `formative`；瀏覽器判分、100分、60分達標；高風險評核所需服務端驗證不在本版範圍 |
| Out of scope | 求力大小、依箭長判平衡、分力圖、力矩／梯子／剛體轉動、彈簧振動、加速度、要求兩個物體各交一圖、老師題庫編輯器 |

五類以質點／平動分析處理：箭尾統一在指定物體中心，只保留中心圓點。這是受力示意慣例，不把真實接觸位置任意移動後用來分析力矩。原基礎版保持獨立；新活動有自己的activity id、題目生成器、快照與SCORM包。

## Catalogue metadata (`sim/config.js`)

```js
{
  title: "共點力平衡：進階受力圖挑戰",
  folder: "force-equilibrium-advanced-diagram-lab",
  categories: ["Mechanics"],
  description: "在多接觸面、彈簧及多物體平衡情境中，辨認指定物體的外力並畫出正確方向。",
  tags: ["physics", "mechanics", "equilibrium", "free-body-diagram", "spring", "drawing", "scorm"],
  status: "active"
}
```

以上metadata已加入`sim/config.js`，與基礎版各自獨立列出。

## Physics or subject model

### 安全隨機化與內部平衡條件

新attempt固定一個uint32 seed、generatorVersion及五類排列。C／E的研究物體只在生成時指定，學生不能切換成另一物體共用原答案；切題、清除答案及Moodle恢復均保留原題。左右鏡像同步作用於幾何、文字、速度及答案。

以下W表示重力大小，力以N、長度以m、彈簧常數k以N/m、摩擦因數及比值以無量綱表示；角度以度定義，內部計算用一致的弧度轉換。數值只供生成器確認存在正值的平衡解，不要求學生計算或按比例畫力。

| 題型及狀態變量 | 實作取值／幾何限制 | 平衡條件及檢查 |
|---|---|---|
| A：坡角θ、mirror | θ∈{30°,40°,45°,50°,55°}；球和兩個面恰好接觸；豎板高度足夠 | N斜面=W/cosθ；N牆=Wtanθ，均>0；ΣF=0 |
| B：繩對水平角γ、彈簧對水平角δ、mirror | γ∈{45°,55°,65°}；δ∈{−15°,0°,15°}；繩向左上、彈簧固定端在右側；L>L₀ | T=Wcosδ/sin(γ+δ)，Fₛ=Wcosγ/sin(γ+δ)，均>0；Fₛ=k(L−L₀)，k>0；斜向下彈簧也有有效平衡解 |
| C：目標A/B、mirror及內部力尺度 | W_A>0，W_B/W_A∈{0.8,1,1.2}；壓縮力S/W_A∈{0.15,0.20,0.25}；外推力P/W_A∈{0.10,0.15}；L<L₀ | N_A=W_A，N_B=W_B；f_A=S，f_B=S+P；取μₛA=S/W_A+0.10、μₛB=(S+P)/W_B+0.10，確保兩塊均能靜止。S=k(L₀−L)>0，不以動摩擦因數冒充最大靜摩擦條件 |
| D：坡角θ、μ、沿坡速度符號s、mirror | θ∈{25°,30°,35°,40°}；μ∈{0.15,0.25,0.35}；s=+1上行或−1下行；水平推力始終朝上坡一側 | P=W(sinθ+sμcosθ)/(cosθ−sμsinθ)>0；N=Wcosθ+Psinθ>0；f=μN，方向沿坡為−s。檢查分母>0及tanθ>μ，兩種運動都存在正值解 |
| E：頂繩與豎直角α、目標1/2、mirror | 兩球重力均為W；α∈{20°,25°,30°,35°}；b由球1向右下，對水平角β=atan[1/(2tanα)]；c水平 | $T_a=2W/\cos\alpha$，$T_b=W/\sin\beta$，$T_c=T_b\cos\beta$，均>0；兩球分別驗證ΣF=0。不得獨立亂抽a、b角度後仍聲稱等重兩球平衡 |

不得抽到零張力、零彈簧力、脫離接觸或需要摩擦超過上限的題。實作前窮舉有限參數組，確認正值、平衡殘差及可畫幾何；同類力的方向間距須>20°並留額外顯示裕度。C中B的F與Fₛ同向屬不同種類的真實外力，必須允許重疊，不能為排版旋轉答案。

### 動畫及場景表示

- A、B、C、E靜止；D每套必有一題勻速。沿用基礎版低對比地面紋理，以−v沿斜面平移；指定物體、箭頭、中心及作圖座標固定。上行／下行文字持續可見，背景暫停或reduced-motion不改答案。
- D的施力器與木塊一同移動，不畫成連到固定地面的彈簧／繩卻仍維持恆定變形。B、C的彈簧只出現在靜止題，不做伸縮振動。
- C使用上下錯開的彈簧接點與水平施力器，讓兩個來源都可辨；用題意及中性裝置方向標記表達施力，不預畫可得分的答案箭頭。
- C／E清楚標出物體字母／編號及「作圖物體：…」。指定物體置於作圖區主要位置，只在其中心顯示起筆點；另一物體仍清楚可見但不可起筆。手機不能靠透明到看不清的背景物體表示研究對象。
- 彈簧以線圈和端點表示，並用「已拉長」／「已壓縮」給足條件；不靠線圈疏密自行猜測自然長度。

## Responsive layout contract

Apply [layout](00-shared-platform-and-style.md#layout) and [mobile interaction](00-shared-platform-and-style.md#mobile-interaction).

| Decision | Activity specification and reason |
|---|---|
| Three regions | 沿用基礎版header題目跳轉、場景stage、題意及力種類panel；不另設新首頁 |
| Desktop / tablet | 沿用≥820px或≥600px且高≤520px的左右排列及18–22rem panel。符合基礎版舞台尺寸時保留1.8倍物體／力名／箭頭投影顯示 |
| Control-panel classification | `bounded split-panel`；學生選六類力時仍需看清場景，panel獨立捲動 |
| Phone stage and controls | 沿用基礎版44dvh與短高reflow；只新增第六列「彈簧彈力」，不可用縮小文字塞進同一高度 |
| Phone text | 主要控制16px、輔助14px；物體編號、彈簧狀態及力名在實際縮放後可讀；中心不加「重心」二字 |
| Viewports | 320×500、390×500／600、正常直向、橫向、短iframe、toolbar變化及200% zoom；無文字輸入，軟鍵盤N/A；保留硬體鍵盤作圖 |
| Scroll topology | 沿用blank stage／兩側≥32px歸host、panel只捲自身、作圖handle獨占；activity document沒有第三個垂直scroller |

A／E有兩個同類力，C可能有五支力和同向不同類力；必須特別檢查標籤避讓、重疊箭頭的面板選取及兩個物體可見性。排版不得改受力方向或露出正確力數。

## Navigation, submission and reset

Apply [navigation](00-shared-platform-and-style.md#navigation) and [submission/reset](00-shared-platform-and-style.md#submission-and-reset).

| Decision | Activity specification |
|---|---|
| Navigation | 五題independent，沿用header跳題及隨機題序；保留各題草稿 |
| Final check access | 任一edit狀態均可檢查，包含空題及只選種類尚未畫箭頭；沒有全看完／全做完門檻 |
| Incomplete submission | 總覽只說明已選／已畫／未答數，不透露應有力數；允許明確提交空白或部分答案 |
| Editable reset | 沿用清除本題、undo/redo及確認後清除全部答案；保留seed、研究物體、題目及順序，清空答案不換題 |
| Scored / pending attempt | 沿用同頁只讀／frozen及技術retry；無清結果／重開控制；獨立refresh依共用契約重新開始 |

| Step / question | Required upstream data and why | If missing or changed | Legal next actions / final-check route |
|---|---|---|---|
| 任一A–E | 只依當次生成的本題場景及指定物體 | 空白合法，不依其他題；研究物體不可由學生切換 | 選力、畫圖、刪改、換題或檢查 |
| 中心起筆 | 已新增並選中一個待畫的力記錄 | 無方向以null保留，不自動畫正確箭頭 | 畫方向、改種類、刪除或檢查 |
| 總覽返回本題 | 保留本題及其他四題全部答案 | 只取消未完成drag，不重抽題 | 編輯後返回檢查或切題 |

## Diagrams, notation and assistance

Apply [diagrams/notation](00-shared-platform-and-style.md#diagrams-and-notation), [snapping](00-shared-platform-and-style.md#snapping) and [touch preview](00-shared-platform-and-style.md#touch-preview).

| Decision | Activity specification and reason |
|---|---|
| Notation | 沿用G、N、f、T、F，新增Fₛ，選項明寫「彈簧彈力」。支持力和繩拉力亦源自彈性作用，故不把泛稱「彈力」設成與它們互斥的選項。F仍專指明示施力器的外加推力 |
| Arrow graphics | 完整沿用基礎版單一填色箭頭、精確箭尖、math serif及真下標；箭長不代表力大小，重心起點不計分。A的N、E的T用新增次序下標，不按先畫哪一個判分 |
| Snap | 必需；沿用touch入6°／離9°、mouse/pen入4°／離6°；水平、鉛直、可見接觸面平行／垂直、繩軸及新增彈簧軸的雙向。所有種類共用，不能把彈簧軸自動選成拉／推的正確一向 |
| Touch preview | 中心起筆和箭尖編輯必需，手指會遮住角度與附近的繩／彈簧；沿用1.8倍真實場景、固定角落及避手指規則。加入真實彈簧軸、接觸面和研究物體；完成／取消／換題／鎖定即清除 |

六類都使用相同「−／數量／＋」操作；每類最多3、總數最多8，所有題型相同，不能按該題答案隱藏不需要的類型。重疊箭頭可從面板選取，不能自動合併B木塊的F與Fₛ。繩與彈簧固定端、線圈及接觸幾何屬題目資訊，不在選中某類力後加單向答案提示。

## Touch gesture ownership contract

依[完整touch契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)，沿用基礎版穩定target及ownership。本活動另行執行新場景／新力類型的驗收，原活動測試不代替本活動證據。

| Target type | Selector / hit area and size | Stable capture target / pre-pointerdown touch-action | Keyboard alternative |
|---|---|---|---|
| 指定物體中心起筆 | `.origin-hit`，≥44px | 穩定HTML target，none；drag不replace | 面板選力後用方向鍵／參考角作圖 |
| 六類力及同類多力的每個箭尖 | `.force-head-hit`，≥44px | 各自穩定target，none；重疊時由面板決定選中目標 | 面板選取、方向及長度微調 |
| 指定物體以外的物體、繩及彈簧 | 非draggable場景 | 不鋪全舞台攔截層 | N/A，無需操作 |

| Touch starts on | Owner | Activity strategy / region dimensions | Source and packaged evidence |
|---|---|---|---|
| 空白舞台、另一物體、繩、彈簧 | host | pan-y；不改任何作答 | source＋package，兩向swipe通過；SVG內容不攔截手勢 |
| panel及頂／底邊界 | panel | 只捲本身，host及stage固定 | 六列控制、middle/top/bottom通過 |
| 全舞台自由繪圖層 | N/A | 採中心handle，不建立全舞台drawing overlay | 檢查沒有誤加攔截層 |
| 左側strip | host | ≥32px且不被箭尖target／preview侵佔 | 兩向swipe通過 |
| 右側strip | host | 同左，分開驗證 | 兩向swipe通過 |
| 中心及每類箭尖 | simulation | trusted move/up、無正常cancel；host、panel、document及viewport固定 | G/N/f/T/F/Fₛ、第二個N/T及同向F＋Fₛ均通過 |
| 鎖定後舊target位置 | host | 撤除drag ownership，不能改答案 | review／frozen／committed均通過 |

- host路徑、bounded-document enforcement及多指取消／rollback沿用基礎版；若同源iframe使用host forwarding，記錄並排除double scroll。不同源及實體Moodle仍需部署驗收。
- 新增`tools/force-equilibrium-advanced-browser-regression.js`，在可捲host測source／extracted兩路，記錄全部scroll／viewport／iframe bounds、trusted pointer及答案前後差異；證據放`output/playwright/force-equilibrium-advanced/`。
- D背景時間另行控制以隔離手勢效果；DOM-dispatch、programmatic scroll或沿用基礎版截圖均不當作新活動觸控驗收。

## Scoring and tolerance

| Decision | Activity specification |
|---|---|
| Rubric | 完整沿用每題20分、五題100分、60分達標；種類8分、方向12分，按本題真實力數平均分配 |
| Granularity | 同類一對一配對，不按新增次序；每個外力獨立給分；C指定A/B依各自4/5個力正規化為20分 |
| Unanswered / null | 空題0分；正確種類而方向null／錯誤仍有種類分；不給預設箭頭、固定起點或整潔分 |
| Extras / duplicates / penalties | 設K為真正力數、m為種類配對數、d為正確方向數、e為多餘記錄數；每題clamp((8m+12d−20e)/K,0,20)，同基礎版 |
| Tolerances | 最短圓周角差≤10°；10.1°不接受，0／360跨界一致；箭長與起點不評。吸附閾值與判分閾值分離 |

提交前只呈現作答進度；提交確認後逐題顯示漏力、多力、種類或方向問題及其施力來源。沿用「我的圖／參考圖」切換；pending不顯示已確認分數。C／E的反作用力如作用在另一物體上，不能加進本題研究對象的答案。

## Phase/state matrix

沿用基礎版`edit`／`check`與shared runtime狀態；不額外設研究物體選擇phase。以下每一列在實作時都須以production encode/decode/restore驗證，並執行一個合法後續操作。

| Phase / variant | Current step | Required semantic state | Absent / retained data | Legal continuation / final-check route |
|---|---|---|---|---|
| edit／空白 | current=0…4 | seed及五個答案陣列，本題[] | 其他題可有答；returnToCheck=false | 新增力、換題或check |
| edit／只有待畫記錄 | current=0…4 | 有種類，方向／長度同為null | 不補幾何 | 畫方向、刪改或check |
| edit／已畫或混合記錄 | current=0…4 | 有合法角度／長度或null記錄 | 錯方向、錯種類及多餘力仍是合法答案 | 改圖、刪除、換題或check |
| edit／從check返回，含上述三種內容 | current=0…4 | returnToCheck=true，原答案保留 | 不重抽指定物體或場景 | 返回check或切題 |
| check／五題全空白 | current=null | 五個[]，returnToCheck=false | 無預設箭頭 | 明確提交0分或選題編輯 |
| check／只有種類或部分圖 | current=null | null與已畫記錄並存 | 保留部分答案 | 明確提交部分答案或編輯 |
| check／現有記錄全畫好 | current=null | 每個現有記錄有方向 | 不代表答案數量／種類正確 | 明確提交或編輯 |
| review／空白、部分、已畫 | 選題為transient | 已驗證權威答案及可信結果 | 沒有editable phase、working drag或undo | 只讀切題及看參考圖 |
| frozen／上述三種答案內容 | shared決定 | immutable且已驗證的nested review payload | 禁止改答及重抽題 | retry同一payload；不合法則quarantine |

| Transition / trigger | Preconditions | State changes / downstream effects |
|---|---|---|
| 新增／改種類／刪除／完成pointerup | editable且操作合法 | 一次atomic command及draft save，其他題不改 |
| 清除本題 | editable，非空時確認 | 清本題，保留題目／目標／其他答案，可undo |
| 清除全部 | edit/check，有答且確認 | 五題[]，edit/current=0/returnToCheck=false；清暫態與歷史，保留seed；保存失敗顯示重試，不能冒稱已保存 |
| drag取消／viewport改變／lock | 有working operation | rollback，清capture與preview，不存半完成答案 |
| header換題 | editable | 取消working，保存已commit答案，只改current |
| 進check／返回編輯 | 任意合法editable／check | 切phase/current/returnToCheck，保留全部權威作答 |
| 最終提交 | check，包括空白 | 依目前答案評分，製作review snapshot，交shared處理四outcomes |

## Persistence contract

Follow the production guide's [snapshot/restore contract](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract) and [required persistence tests](../docs/simulation-scorm-production-guide.md#required-persistence-tests). Specify exact versioned fields and validation before implementation.

| Snapshot | Exact schema / field types / allowed values |
|---|---|
| Draft | 新activity id；answer含schemaVersion=1、generatorVersion=1、rubricVersion=1、seed:uint32、phase:edit/check、current:0…4或null、returnToCheck:boolean、answers:恰好5個陣列 |
| Review | 同三個版本、seed、answers；省略phase/current/returnToCheck，分數及passed僅為shared metadata的比較資料 |
| 一支力 | `[kind,angle10,length1000]`；kind整數0…5對應G/N/f/T/F/Fₛ；angle10為0…3599、0°向右逆時針；length1000為1…1000，沿用基礎版安全顯示半徑；每類≤3、每題≤8 |
| Unanswered encoding | 空題[]；已選種類未畫為`[kind,null,null]`；方向／長度必須同時為null或有效值。缺欄、半null或越界均不當空白 |
| 題序及研究物體 | answers固定A–E排列；current指隨機呈現位置。場景、C/E目標及順序由seed/version重建，不信任另外保存的display labels或答案表 |

| State category | Activity fields and treatment |
|---|---|
| Authoritative | 版本、seed、五題force tuples、draft的phase/current/returnToCheck；學生力的種類與方向即使錯誤也要保留 |
| Transient | drag/preview/capture/hover、選中力、undo/redo、背景相位／暫停、review選題；不存 |
| Derived | 研究物體、場景幾何、題序、預期外力、內部平衡大小、標籤、DOM IDs、分數及解說 |
| Version compatibility | 獨立activity id，拒絕基礎版快照混入；初版只接受已登記v1組合。以後須保留舊generator／rubric或明確拒絕，不悄悄重判 |
| Size | 40-record最壞樣本：draft 797、review 774、shared pending envelope 956 UTF-8 bytes，均≤4000；測試包括三個彈簧力及同類多力 |
| Invalid finished review | 鎖定，僅呈現可信Moodle摘要，不另開練習 |
| Invalid pending-final | decode／rescore不符即quarantine，保留資料但禁retry／clear／edit |
| Invalid editable draft | 先技術鎖定；只有確定未提交時提供確認後覆寫新draft的recovery，成功保存才恢復；未知／已交／pending不可清 |

Finished restore validates and restores answers, runs the activity scorer, then uses `SimActivityFlow.reviewResult()` to compare computed, saved and Moodle outcomes.

## Shared SCORM lifecycle

Use `SimScorm.loadAttempt()` with `SimActivityFlow.startup()`, register `SimScorm.setDraftProvider()`, and route `submitWithCallbacks()` through `SimActivityFlow.submission()` as specified in the [shared lifecycle flow](../docs/simulation-scorm-production-guide.md#mandatory-shared-lifecycle-flow).

| Outcome / policy | Activity handler, controls and learner-facing message |
|---|---|
| Startup editable | 新seed／空白或還原同seed草稿，register draft provider；不預設答案 |
| Startup review | validate、重建、重算並核對，可信時開只讀回饋 |
| Startup frozen / load-error | frozen先驗證nested payload，只retry合法提交；load-error呈現技術鎖定，不假稱成績已確認 |
| Submit success / committed | success開確認後只讀結果；committed鎖定、說明成績已記錄但連線未結束，只提供finish retry |
| Submit frozen / retry | frozen說明提交待確認、保留同payload；retry依retryable決定編輯／重試或technical error，不標已提交 |
| Review trust | match正常檢討；mismatch鎖定並說明不一致；unknown／invalid只呈現可信摘要，不冒稱失敗或重開 |
| Standalone refresh | 依[共用契約](../docs/simulation-scorm-production-guide.md#standalone-refresh-and-moodle-resume)用記憶體模式；草稿／check／提交後refresh均開新seed及空白答案，忽略舊storage、權限被拒仍可用；不加入使用者已拒絕的refresh提示句 |
| Moodle resume / recovery | 同一attempt保留題目、指定物體、作答及結果／pending；只有Moodle給新attempt才開空白新題，活動不自行清成績 |

不在activity自行寫raw LMS fields、localStorage或commit/finish/pagehide處理；語意操作保存草稿，背景動畫及pointermove不保存。

## Test plan

Apply all relevant [verification checks](../docs/simulation-scorm-production-guide.md#verification-checklists), including the minimum phone/short-iframe viewport matrix.

- [x] Generator窮舉有限參數：每套五類各一、D提供勻速；ΣF殘差、N/T/Fₛ正值、靜摩擦上限、彈簧L與L₀關係、E兩球同時平衡；seed/version與鏡像一致。
- [x] 物理語意：A兩N、B斜下彈簧、C兩目標及同向F/Fₛ、D上／下行摩擦、E向下拉力；不替學生畫分力、合力或另一物體的力。
- [x] 六類force tuples的評分／decode／顯示全覆蓋；C4/5力及E換目標仍各20分；N/T交換新增次序不影響分數，F與Fₛ不可互代。
- [x] D背景沿坡等速反向移動而作圖物體／座標固定；pause、reduced-motion及不同frame rate不改作答／評分。
- [x] Scoring covers blank/partial answers, component independence, extras, penalties and tolerance boundaries.
- [x] Every editable phase can reach final check and submit blank/partial work; scored/pending states have no erase/restart route.
- [x] Production encode/decode/restore round-trip covers **every** matrix row with production-shaped fixtures, equal score and execution of one legal continuation.
- [x] Invalid matrix combinations, numbers, enums, dependencies and authoritative keys fail closed; derived IDs rebuild; version policy and 4000-byte ceiling are tested.
- [x] Production startup/submission/render logic covers all outcomes above, invalid finished review, pending retry and trust mismatch/unknown status; source checks alone are insufficient.
- [x] Source and extracted SCORM standalone refresh clears partial/check/submitted work and permits redraw/submission, including old draft/review/pending/corrupt checkpoints and denied browser storage; separate Moodle cases retain same-attempt work.
- [x] Phone typography, arrow/label geometry, snap and required previews work in the planned viewport/zoom matrix.
- [x] Every applicable gesture row passes with trusted input in a scrollable Moodle-like iframe on **source and extracted SCORM**; record all guide-required scroll/viewport/iframe metrics, including no third scroll owner.
- [x] Every new test is registered in `tools/run-tests.js`; runtime dependencies are in the manifest and metadata in `sim/config.js`.

## Package-ready checklist

- [x] Above decisions, state matrix and test evidence are complete; required keyboard alternatives work.
- [x] Phone, tablet and desktop layouts, short iframe, toolbar/keyboard changes and 200% zoom preserve readable content and reachable actions.
- [x] `npm run check`, `npm test` and `npm run package:all` pass; record commands, results and artifact paths.
- [x] `git diff --check` and the PR diff against its actual base pass.
- [x] ZIP has root `imsmanifest.xml`, every runtime asset is declared and no development-only files ship.
- [x] Built/extracted launch smoke and the full applicable trusted-touch matrix pass; use the documented Git Bash route on Windows.
- [x] Assessment risk and any trusted validation requirement are recorded.

## Moodle-ready checklist

- [ ] Package-ready gates pass; real Moodle student-account submission records score/status.
- [ ] Draft resume, pending retry, immutable scored review and LMS new-attempt policy work.
- [ ] Real-phone complete gesture matrix passes in current-window and offered new-window Moodle players.
- N/A：本活動為formative低風險作圖練習，不提供高風險評核所需的server-side validation。
- [ ] Moodle and physical-device evidence is recorded separately from local checks; list any unverified item explicitly.

## 原規劃階段紀錄（歷史）

1. 審閱並調整這五類題意、物理條件及視覺研究物體標示；確認後再進入simulation實作。
2. 在本專用分支建立獨立活動，以基礎版最新介面為起點，實作生成器／參考場景／第六種力及題目回饋，先完成模型與評分核對。
3. 接入既有作圖、投影尺寸、手機preview、清除及shared SCORM流程；驗證多物體、同向箭頭及新增彈簧列沒有遮擋／操作退化。
4. 完成source及extracted package的作圖／restore／trusted-touch檢查，更新catalogue、manifest及test runner，再交付新SCORM ZIP；main合併與發布留待實作完成後處理。

規劃階段提交`b6bff48`只建立分支及本計劃。其後使用者批准完整實作；目前狀態以以下實作證據為準。


## 完整實作及驗證紀錄（2026-09-27）

- 專用分支`codex/force-equilibrium-advanced-diagram-lab`，基準`724c3a3`。新增獨立活動、manifest、目錄項目、六個Node測試檔及source／extracted SCORM browser runner；沿用原版三區排版及shared SCORM，沒有增加學生活動依賴。
- 新增六類共用force palette中的「彈簧彈力」Fₛ。C、E每次只指定一個研究物體，只有該物體可起筆。C的F與Fₛ即使完全重疊，也能由面板選取，選中箭頭／hit target置頂；參考圖用不同示意箭長分辨同向來源，方向及評分不變。
- A、B、C、E靜止；D沿斜面反向平移低對比地面紋理，物體、中心、答案固定。新增彈簧場景進入相同的真實局部preview與總覽，不預畫答案；E上方空間留給繩a，隱藏與繩重疊的重複起筆提示，面板仍提供完整操作說明。
- `generator.test.js`：窮舉164種參數組合，檢查力和、正值、彈簧變形／胡克定律、靜／滑動摩擦、兩球各自平衡及鏡像；2,000組seed覆蓋全部164種題目及120種次序。
- `scene.test.js`：164種題目×7種stage尺寸，共1,148組實際場景幾何檢查，涵蓋球與兩面接觸、彈簧／繩連接、兩木塊落地、施力器作用於B、兩球及固定端可見、最大箭長仍在可操作範圍；另驗證同向箭頭選取後顯示順序。
- `model/scoring`：六類記錄、同類數量上限、type-blind snap、有效箭尖、歷史及notation；空白、null方向、部分分、多力、10°／10.1°、跨0°及箭長無關。C的4／5力同樣滿分20；F不能代替Fₛ；E球1的b拉力反向會失去該方向分；同類N／T作答次序不影響分數。
- `persistence`：48種phase／內容／返回檢查round-trip和合法後續，另有100組seed的六類部分答案重建、分數相等及續做，覆蓋C／E目標與左右鏡像的8種組合；錯答與損壞資料分開檢查，拒絕基礎版activity id混入。
- `lifecycle`：執行正式Controller及shared runtime，涵蓋空白／種類未畫／部分／滿分、draft/check/review/frozen、四種submission結果、保存／commit／finish失敗、retry、未知／不一致資料及pending quarantine；清除全部保留seed和目標，已交與pending不可清除；same-attempt恢復及空白LMS新attempt分開驗證。
- 瀏覽器使用項目既有Chrome/CDP工具和browser-level trusted touch，手勢矩陣各用獨立分頁，避免跨矩陣的emulator手勢狀態互相影響。實際pointer、preview、host／iframe／document／panel與雙方visual viewport仍全部斷言，沒有以合成DOM事件代替觸控。

- 新活動瀏覽器回歸已通過source與extracted package。Chrome 154.0.8037.57；每路9種視窗及200% visual viewport scale、52個場景／視窗組合，合共104個場景檢查。手機force標籤18px；桌面舞台達條件時32.4px。軟鍵盤N/A（無文字輸入）；硬體鍵盤Enter／方向鍵／確認及重新畫圖已測。
- 可信觸控證據98列：source／package各有390×500及320×500的23列，加每路3列拉伸／壓縮彈簧preview、箭尖編輯及重疊選取檢查。包括兩側條帶及空白雙向host捲動、panel中段／兩端、六種類與重複N/T、cancel rollback、多指handoff、review/frozen/committed舊target範圍；記錄before/after答案、pointer和完整捲動幾何。執行例外為0。
- source／package正式UI均驗證獨立頁partial/check/submitted重新整理為空白，以及之後重新畫／提交；四種舊checkpoint與拒絕localStorage均不鎖住啟動。另測Moodle fixture的draft/review/pending恢復、同payload retry、新attempt空白，沒有自行清舊成績。
- `npm run check`通過。`npm run package:all`已通過全部17個SCORM包；新包15個檔案（根`imsmanifest.xml`與14個runtime檔），逐檔與目前source相同，不含測試／工具。新包41,707 bytes；SHA-256 `9516529d0668fd5c78b6608d5ba07fc2935c7ffae4e89a70f465a8f72993d877`。
- 證據：`output/playwright/force-equilibrium-advanced/report.json`、`package-parity.json`、同目錄source/package場景與preview截圖；全項目命令紀錄為`output/advanced-equilibrium-full-test.log`及`output/advanced-equilibrium-package-all.log`。

全項目`npm test`已完整通過，包括新活動、其餘既有活動及shared runtime；`npm run check`、`npm run package:all`（17包）及新增檔案／完整分支diff的whitespace檢查均通過。Package-ready已完成。真實Moodle帳戶、實體手機及不同源iframe仍未測試，本地證據不構成Moodle-ready。

成品入口：`sim/force-equilibrium-advanced-diagram-lab/index.html`。本機預覽：`http://127.0.0.1:8765/force-equilibrium-advanced-diagram-lab/`。新SCORM包：`output/force-equilibrium-advanced-diagram-lab-scorm.zip`；全部17包位於`output/`。
