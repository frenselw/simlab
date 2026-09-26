# 共點力平衡：受力圖挑戰

> 2026-09-26 使用者已批准依草案完整實作。專用分支：`codex/force-equilibrium-diagram-lab`。以下為實作契約；文末歷史的「只建立計劃」記錄不代表目前工作階段。
>
> 本文件由 [新活動計劃範本](NEW-SIMULATION-PLAN-TEMPLATE.md) 建立，依循[共用產品與風格](00-shared-platform-and-style.md)及[製作與驗收契約](../docs/simulation-scorm-production-guide.md)。以下記錄已批准並實作的參數及分數配置；驗收證據只取自本活動的實際測試。

## 已實作的主要設計

學生在五種平衡情境中自行選擇力的種類，再由物體重心畫出箭頭。評核力是否齊全、種類及方向是否正確；箭長、實際大小、作用點及力矩不計分。箭長可以調整，方便分開標籤，但不代表力的大小比例。

每次作答五類各抽一題，並打亂出場次序。物體、重心、受力箭頭及作圖座標固定；勻速情境以地面紋理和低對比分格反向等速平移表達相對運動，配合「相對地面向右／向左勻速直線運動」文字。靜止情境沒有背景平移。

| 題型代號（不是固定次序） | 場景與狀態 | 預期受力；此欄只供設計及提交後回饋 | 主要變化與思考 |
|---|---|---|---|
| A 斜面靜止 | 木塊靜止於粗糙斜面，無繩或其他推拉 | 重力、支持力、沿斜面向上的靜摩擦力 | 斜面左右鏡像及不同傾角；支持力不一定向正上方 |
| B 平地拉動 | 繩拉木箱，粗糙水平地面；靜止或勻速 | 重力、支持力、繩拉力、摩擦力 | 左／右拉；繩可水平或斜向上；辨認繩方向及摩擦方向 |
| C 雙繩懸吊 | 物體由兩條不對稱斜繩吊住，靜止 | 重力、兩個繩拉力 | 兩條繩的角度各自改變；同類力可以有多個 |
| D 斜面加繩 | 物體在光滑斜面，由上方繩子拉住，靜止 | 重力、支持力、繩拉力 | 斜面鏡像；繩可沿斜面或與斜面成小角；光滑接觸沒有摩擦力 |
| E 光滑平地多力 | 光滑水平面，兩個或三個外加推力；靜止或勻速 | 重力、支持力、每一個外加推力 | 施力器方向與數量改變；合力為零時，速度不由其中某一個力決定 |

手機畫箭頭及改方向時，第一版即提供真實場景的局部放大預覽。預覽包含物體、可見繩／接觸面、學生箭頭及吸附後箭尖，不提供正確受力答案。

### 參考活動與沿用範圍

目前確認的主要參考是[力的合成作圖實驗室](19-force-composition-construction-lab.md)，並已讀取其現行箭頭、座標轉換及 preview 實作。使用者提到「兩個」參考活動，但目錄只有一個以「力的合成」命名的活動；已詢問第二個活動的指向。使用者其後批准按本草案實作，因此採用合成活動中兩種方法共用的核心；不再把第二個參考的名稱列為開工阻礙。力的正交分解不作本活動的題型依據。

| 已有元素 | 本活動採用方式 |
|---|---|
| 單一連續實心箭頭、箭尖與模型端點一致 | 沿用構造原則；學生可改方向和顯示長度，箭尾固定在重心 |
| 數學斜體、真正下標、力名避讓箭線及邊界 | 沿用；中文力名與符號對應一致，同類多力用 T₁、T₂／F₁、F₂ 等 |
| 拖動中即時吸附、放手提交當刻幾何 | 沿用，但吸附只依可見方向，與力種類及答案無關 |
| 固定舞台 camera、SVG／觸控／預覽使用同一座標轉換 | 沿用；背景平移另用獨立視覺層，不改作圖座標 |
| 真實場景預覽、取消操作安全回復 | 沿用並按現行共用規則固定在不遮擋的角落，必要時才換角 |
| 每題草稿、復原、直接跳題、提交前檢查、提交後只讀 | 沿用現行共用契約 |
| 合成題既有的平移力鏈及合力評分 | 不適用於本活動；本活動自行定義受力集合及方向判分 |

另查閱[水平面靜止物體受力圖](01-fbd-horizontal-block-mvp.md)以了解項目已有的重心起筆及力種類計數操作。它只作相關既有設計資料；其中箭長平衡分、固定起點分及舊驗收契約不搬入本活動。

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `force-equilibrium-diagram-lab`；辨認平衡物體所受的各個外力及方向，區分靜止與勻速都可平衡 |
| Learner task / main interactions | 五題獨立受力圖；選力種類、重心起筆、拖箭尖、刪除／改種類／復原、跳題、檢查及明確提交 |
| Runtime files / libraries and justification | 原生 HTML/CSS/JavaScript、SVG、Pointer Events；使用既有 shared styles、SCORM 及 activity-flow，暫無新函式庫需要 |
| Assessment risk / trusted validation | `formative`，建議滿分 100、60 分達標；瀏覽器評分供形成性練習。高風險考核另需可信服務端驗證，不在本版範圍 |
| Out of scope | 求力的大小、分解力、力矩／轉動、非平衡加速度、斜面角度由學生調整、學生把物體拖走、老師出題工具 |

所有圖都採用質點／平動受力分析：把真實接觸力及繩拉力的示意箭尾統一放在重心，只是畫圖慣例，不宣稱可以在剛體上任意改變真實作用點。第一版五類都使用此慣例，沒有另設作用點例外；將來若加力矩題，須另訂模型。

## Catalogue metadata (`sim/config.js`)

以下登記已加入目錄；完成本地製作驗收後標記為 `active`。

```js
{
  title: "共點力平衡：受力圖挑戰",
  folder: "force-equilibrium-diagram-lab",
  categories: ["Mechanics"],
  description: "在五種隨機平衡情境中，從物體重心畫出種類與方向正確的受力圖。",
  tags: ["physics", "mechanics", "forces", "equilibrium", "free-body-diagram", "drawing", "scorm"],
  status: "active"
}
```

## Physics or subject model

### 物理與題意邊界

- 每題明示「靜止」或「相對地面勻速直線運動」、接觸面粗糙／光滑、繩是否拉緊及施力來源；不要求學生從動畫速度猜狀態。
- 正確答案只包含其他物體對研究物體施加的外力。運動方向標記不是力，不新增「運動力」或慣性力；合力也不是在各外力之外多加的一個力。
- 重力鉛直向下；支持力垂直接觸面並指離接觸面；繩拉力沿拉緊的繩指向外部繩端。
- A 的重力沿斜面分量產生向下滑的趨勢，靜摩擦力沿斜面向上。不能把這個規則推廣成「所有靜止物體的摩擦力都向上」。
- B 的靜止版本由題目明確的拉繩建立滑動趨勢；勻速版本的摩擦力反對木箱相對地面的滑動。第一版不含輸送帶或方向資訊不足的靜摩擦題。
- 力種類選單固定為重力 G、支持力 N、摩擦力 f、繩拉力 T、外加推力 F。第一版不把靜／滑動摩擦細分類另作評分；回饋會說明。F 專指場景中明示施力器的推力，避免把「拉力」與「外力」當成可互換的選項。
- C 的兩個 T、E 的多個 F 分別是不同外力。學生的下標只是新增順序，不要求先畫左繩或指定 F₁ 對哪個施力器；判分按種類和方向配對。
- 不畫分力代替真實外力；不要求學生用箭長閉合力多邊形。所有學生圖及參考圖註明「箭長不代表力的大小」。

### 隨機生成與確實可平衡的條件

以地面為慣性參考系，x 向右、y 向上，角度逆時針。以下 mg 是生成器內部的正值力尺度，不在學生介面要求輸入質量或牛頓數值。左右鏡像對整個場景、文字和答案同時進行。

| 題型 | 實作抽樣與內部平衡驗證 |
|---|---|
| A | θ ∈ {20°,25°,30°,35°}；左右鏡像。N = mg cos θ，f = mg sin θ；取 μₛ = tan θ + 0.15，確保靜摩擦力在可用範圍內 |
| B | 拉向左或右；繩對水平夾角 α ∈ {0°,20°,30°,40°}；T = λmg，λ ∈ {0.20,0.30,0.40}。N = mg − T sin α > 0；f = T cos α。靜止時 μₛ = f/N + 0.15；勻速時 μₖ = f/N。速度與水平拉向相同 |
| C | 左／右繩各與水平成 α、β ∈ {25°,30°,…,65°}，差至少 10°。T左 = mg cos β / sin(α+β)，T右 = mg cos α / sin(α+β)，兩者均為正，水平分量相消、鉛直分量之和為 mg |
| D | θ ∈ {20°,25°,30°,35°}；繩由上坡側伸出，與斜面夾角 β ∈ {0°,10°,20°}。T = mg sin θ / cos β，N = mg cos θ − T sin β > 0，摩擦力為零。繩與支持力方向不能重合 |
| E：兩推力 | 水平相向推力等大，本版固定各為 0.5mg；N = mg、f = 0。相向施力器提供足夠場景資訊，不先畫受力箭頭 |
| E：三推力 | 兩支斜推桿分別施加向右下、向左下推力，與水平夾角 α、β ∈ {25°,35°,45°}。水平分量幅值分別取 p·mg、q·mg，其中 p ∈ {0.35,0.45,0.55}、q ∈ {0.75,0.85,0.95}；第三推力水平向右，大小 (q−p)mg。N = mg + p·mg tan α + q·mg tan β，f = 0；可整體鏡像 |

生成器只保留所有接觸支持力及繩張力為正、靜摩擦條件可行、各力向量和為零的題目。E 的同類方向間距至少 25°，大於兩倍建議判分容差；排除箭向太接近而無法公平分辨的幾何。題意、物件位置、繩／桿走向、答案及背景移動全部由同一題目資料建立。

A、C、D 固定為靜止；B、E 的狀態組合從「靜止／勻速」「勻速／靜止」「勻速／勻速」中抽取，確保每套都有靜止與勻速。E 勻速方向獨立抽左／右，不能由某一支推力方向推斷速度。

新 attempt 只產生一次 uint32 seed；以版本化 deterministic generator 分別抽各題參數及五類排列。用獨立子序列處理題目幾何、次序和裝飾，避免增添背景細節改變原題答案。Moodle 刷新、回題、草稿恢復、重試提交和已交 review 都使用同一 seed/version；不重新抽題。依 2026-09-26 使用者修訂，獨立練習重新整理視為新一輪，產生新 seed 及空白作答。

實作直接從已窮舉驗證的有限安全參數表抽樣；C 題先篩出符合夾角差的非空集合，再抽一次，因此沒有拒絕重抽迴圈，也不需要 fallback。新版本另增 generator 版本；保留已發布版本以重現舊答案。隨機性以鏡像、幾何、受力數目及狀態為主，不以換色冒充不同題。

### 固定物體與移動背景

| 狀態／層 | 顯示規則 |
|---|---|
| 研究物體、重心、受力箭頭及 hit targets | 固定在作圖座標，不隨背景位置改變；每題作圖期間 camera 不自動縮放或追蹤箭頭 |
| 靜止情境 | 地面紋理、物體均靜止 |
| 勻速情境 | 物體下方的低對比地面分格及表面紋理按 −v 等速平移，物體固定；移除物體上方的直立遠景裝飾。分格間距與速度保持一致，循環接縫不可跳動 |
| 拉繩／施力器 | B、E 勻速時由與物體一起移動的施力來源維持作用，不能畫成接到地面固定柱卻隨物體同行；C、D 的固定繩端只出現在靜止題 |
| 文字及運動提示 | 「相對地面向左／右勻速直線運動」持續可見；如用速度箭頭，放在物體之外，標 v，外觀與力箭頭區分 |
| 暫停背景／減少動態 | 提供「暫停背景」；尊重 prefers-reduced-motion。保留勻速文字，暫停只是觀察功能，不把題目改成靜止或改答案 |

背景只表達題設運動，不由學生畫出的力或箭長驅動。錯圖不令木箱突然加速；也不因動畫暫停加入任何假想力。方向與畫圖座標由 ground/world → 固定 screen 轉換；純背景 offset 不參與 pointer mapping、snap、scoring 或 persistence。

## Responsive layout contract

依[共用 layout](00-shared-platform-and-style.md#layout)與[手機互動](00-shared-platform-and-style.md#mobile-interaction)。

| Decision | Activity specification and reason |
|---|---|
| Three regions | Header：標題、五題跳轉、檢查入口；stage：場景、物體及受力圖；panel：題意、力種類／數量、選中力及操作 |
| Desktop / tablet | ≥820 CSS px（或 ≥600px 且高度 ≤520px 的橫向） 左舞台、右 panel；panel 約 18–22rem，舞台保留足夠空間畫五支箭頭 |
| Desktop projection | 舞台寬 ≥520px 且高 ≥400px 時，物體、力名、箭頭粗幼／箭頭頭部及標籤避讓區放大 1.8 倍；力名字級由 18px 增至 32.4px。同步調整箭尖安全區與最短顯示箭長，端點和 hit target 一致；其餘舞台保留原手機尺寸 |
| Center marker | 只保留重心圓點，不在圖內寫「重心」；操作說明與無障礙名稱仍可使用「重心」 |
| Control-panel classification | bounded split-panel；學生反覆選力並看圖，舞台須保持可見 |
| Phone stage and controls | Header → stage → 獨立捲動 panel；stage 為 minmax(13rem,44dvh)，vh fallback；高度 ≤450px 的窄屏改為 minmax(166px,43dvh)，橫向轉左右分區，不建第三個 scroller |
| Phone text | 主要控制 16px，輔助文字約14px；力符號、情境標籤在 SVG 縮放後仍至少約14px，不能靠縮小至難讀字級容納 |
| Viewports | 320×500、390×500、390×600、正常手機直向、橫向、短 Moodle iframe、工具列變高低、200% zoom；沒有文字輸入欄，軟鍵盤呼出為 N/A；硬體鍵盤可完成作圖及提交 |
| Scroll topology | activity document 無可用垂直 scroll range；blank stage 及側帶歸 enclosing host，panel 只捲自身；無水平頁面捲動 |

操作面板使用對齊的「中文種類／符號／− 數量 +」五列，每類最多3個、每題合共最多8個記錄，所有題型採同一上限，不透露答案數量。選中力可改種類、刪除及用方向微調掣；多個同類力用緊湊選取列處理重疊，不產生大量重複新增按鈕。

## Navigation, submission and reset

依[導航](00-shared-platform-and-style.md#navigation)與[提交規則](00-shared-platform-and-style.md#submission-and-reset)。

| Decision | Activity specification |
|---|---|
| Navigation | 五題 independent，header 直接跳題，按本次隨機順序顯示第1–5題；每題保留草稿，可任意先做或返回 |
| Final check access | 每個 edit 狀態及任何已選力／未畫方向狀態均可直接進檢查；不設先看完五題的門檻 |
| Incomplete submission | 只列「已選幾個力、已畫幾個方向、哪些題未作答」；不提前告知應有幾個力或對錯；全空白亦可明確提交 |
| Editable reset | 「清除本題」保留本題 seed、場景及其他四題；已有記錄時確認，支援 undo；不提供本題重抽來避開難題 |
| Scored / pending attempt | 本頁已記錄只讀、pending frozen 同一份答案重試；不提供清成績或 restart 控制。Moodle 重開維持相同記錄；獨立練習刷新開始新一輪，見下方明確例外 |

| Step / question | Required upstream data and why | If missing or changed | Legal next actions / final-check route |
|---|---|---|---|
| 任一 A–E 題 | 只需本次生成的場景；不依賴其他題答案 | 空白合法，切換題目不改其他草稿 | 選力／作圖／刪改／換題／檢查 |
| 選力後起筆 | 已由學生新增的力種類記錄 | 沒有方向仍保留為「待畫方向」；不補預設正確箭頭 | 起筆／改種類／刪除／換題／檢查 |
| 提交前檢查 | 全部五題的現有記錄，允許空陣列 | 修改某題只更新該題 | 返回任一題或提交現有答案 |

### 一支力的操作

1. 學生按某類力的 +，新增一個「待畫方向」記錄；此時沒有預設方向的答案箭頭。
2. 選中待畫記錄後，由重心的44px起筆 target 向外拖出箭頭。只有方向明確的拖動才建立角度；短點按保持待畫，不隨機補方向。
3. 放手提交該箭頭；之後拖箭尖改方向／顯示長度，或在面板選取及微調。箭尾一直留在重心；不把固定起點當成學生所得分。
4. 重疊箭頭可從面板選定；只提升該箭頭的操作 target，不移動另一支箭頭或改答案避開重疊。
5. 拖動期間使用 working state，pointerup 才形成一次 undo 及 draft save；cancel／lost capture／blur／hidden／鎖定／viewport 中途改變均安全 rollback。換題或檢查前若仍在拖動，先取消未完成操作。

Undo/redo 每題保留最近20個 in-memory操作，涵蓋新增、作圖、改種類、刪除及清除；reload 不恢復歷史。Return、skip、背景播放狀態都不自動新增力或影響評分。

## Diagrams, notation and assistance

依[圖示／符號](00-shared-platform-and-style.md#diagrams-and-notation)、[吸附](00-shared-platform-and-style.md#snapping)與[touch preview](00-shared-platform-and-style.md#touch-preview)。

| Decision | Activity specification and reason |
|---|---|
| Notation | G、N、f、T、F 用相同 math serif；下標為真正下標。同一活動以帶箭頭的圖示表示矢量，標籤 G 等識別該力；若在解說寫矢量方程，使用矢量符號，mg、N等純數值關係用大小記號 |
| Arrow graphics | 沿用合成活動的單一填色 path、精確箭尖；手機顯示軸身約3–4px、箭嘴約12–16px，實際比例經視覺檢查；標籤避物體、繩桿及其他力名，不能為避讓改力方向 |
| Anchor / length | 重心固定、不計分；長度僅作可讀性調整，不設大小數據欄、不計平衡比例分、不由箭長算合力 |
| Snap | 所有力共用、種類無關：水平／鉛直雙向、可見斜面平行／垂直雙向、可見繩／桿的兩向；不按正確答案吸附，不因選G就自動向下 |
| Snap tolerances | touch入6°／離9°、mouse/pen入4°／離6°，keyboard選定參考方向亦可；沒有端點對接距離吸附需求，角度容差與判分容差分開。釋放保留當刻方向 |
| Touch preview | 重心起筆及箭尖拖動都必須有，touch／pen啟動；按鈕、背景及面板捲動無需預覽 |

可見幾何的平行／垂直參考是對所有種類一樣的作圖輔助，正反兩向都可選；不得顯示「此類力應往哪裡」的單向 ghost。學生可保留錯方向，吸附不能變成答案驗證器。

Preview 寬128–160 CSS px、1.8倍局部視圖。從同一場景模型重畫相關物體／接觸面／繩桿、學生現有力及吸附後箭尖；不複製互動 target，不保留重複 DOM IDs。優先固定在起筆時不遮手指與主要作圖的上角，以安全距離及滯後規則換角，不能跟手指跨中心頻繁跳位。狹窄畫面若單一裁切不能同時顯示重心與箭尖，保留箭尖局部細節及同一完整場景的縮圖，兩者使用同一實際幾何，不能重畫成獨立假箭線。

Preview 不擋操作、不改主舞台縮放；完成、取消、失去capture、換題、進檢查及鎖定都清除。背景播放可暫停供觀察；preview 的背景相位與主圖一致。

鍵盤：選力列可Tab到達；Enter開始方向操作，方向鍵以1°／Shift+5°調整，面板亦提供逆／順時針及顯示長度微調；Enter確認、Escape取消。待畫記錄的鍵盤起始方位是中性暫態，不按種類給答案，也須學生確定才保存。Screen reader只在semantic commit後朗讀，不逐pointermove播報。

## Touch gesture ownership contract

採[完整觸控契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)。

| Target type | Selector / hit area and size | Stable capture / pre-pointerdown touch-action | Keyboard alternative |
|---|---|---|---|
| 重心起筆 | `.origin-hit`，至少44×44 CSS px，僅選了待畫力時啟用 | 穩定HTML target、none；整次起筆保持mounted | 選待畫記錄後Enter開始方向操作 |
| 每一支力箭尖，包括同類重複記錄 | `.force-head-hit`，至少44×44 CSS px | 穩定HTML target、none；只移位置不replace | 面板選定，再方向／長度微調 |

本版採「中心起筆 handle」而非全舞台自由畫線，中央空白不覆蓋 drawing layer。仍明確保留左右各至少32 CSS px 的可起手捲動帶；箭尖命中框的可達範圍不能侵佔兩帶，箭頭長度沿原方向縮短以留出空間。

| Touch starts on | Owner | Activity strategy / expected result | Evidence |
|---|---|---|---|
| 非互動場景／物體非handle部分／背景 | enclosing host | pan-y；host有range時捲host及iframe，document與panel不動、不改答案 | source/package：blank ±，已通過；實機待測 |
| 左側捲動帶 | enclosing host | 實測≥32px且無overlay；上下swipe均可 | source/package：left ±，已通過 |
| 右側捲動帶 | enclosing host | 同左側，分開測試 | source/package：right ±，已通過 |
| panel及其上下邊界 | panel only | pan-y、overscroll containment；舞台與host固定、不改答案 | source/package：panel middle/top/bottom，已通過 |
| 重心起筆／每種力的箭尖 | simulation | 有pointermove及pointerup、無正常pointercancel；所有host/document/panel/viewport/iframe位置不動 | source/package：G/N/f/T/F 及第二個 T、F 起筆／箭尖，已通過 |
| 提交／pending鎖定後的舊target位置 | enclosing host | 立即撤除owning behavior，可作背景swipe；答案及snapshot不變 | source/package：review/frozen/committed footprint，已通過 |
| 第二指由另一drag target開始 | 原active pointer繼續 | 第二指不改力、不形成undo；原指可完成 | source/package：second-force，已通過 |
| 第二指由blank stage／panel開始 | 該起始區域owner | 原drag先rollback，不能把第二指轉作受力操作；驗證host／panel行為 | source/package：second-host/second-panel，已通過 |

只接受primary pointer。SVG圖形不是唯一手勢邊界；preview為pointer-events:none。拖動不攔截panel或把stage swipe送到panel。優先驗證native host scroll；若同源Moodle iframe需要轉送，只轉送起於非互動舞台的手勢到實際enclosing host，記錄為forwarding並測無double scroll。本版同源 host 轉送以 screenY 的差值計算，再按 host 的 visualViewport scale 換算，避免 iframe 自身位移造成來回跳動；測試逐步記錄 hostTrace 驗證方向不反轉。不同源部署須另證明可行拓撲，不能憑舊活動驗收推定。

驗證使用真機或browser-level trusted touch，覆蓋source及extracted SCORM，記錄isTrusted、pointerType、engine/device、每個owner的scroll/viewport/iframe bounds與答案前後差異。背景時間暫停或固定以隔離手勢效果。實機Moodle的current-window及可用new-window另列驗收，不能以DOM事件或CSS斷言代替。

## Scoring and tolerance

| Decision | Activity specification |
|---|---|
| Rubric | 每題20分、五題100分；每題種類佔8分、方向佔12分，按該題真正外力數平均分配；60分達標 |
| Granularity | 每個真正外力獨立配對；正確種類但方向錯／未畫仍可得種類分。其他題不受本題錯誤影響 |
| Unanswered / null | 空題0分；已選種類而方向null是合法部分答案，無方向分；完全未操作沒有預設答案／整潔／固定起點分 |
| Extras / duplicates / penalties | 一個學生記錄最多配對一個真正外力，一個真正外力最多配對一個記錄。同類多個真實力合法；超額或不需要的記錄扣本題分數，最低0 |
| Tolerances | 方位用圓周最短角差，≤10°接受、10.1°不接受；0°／360°跨界一致。大小、長度與起點不參與得分 |

設K為真正外力數，M為學生記錄數。先在同類力之間找一對一配對：優先最大化種類配對數m，再最大化其中方向在容差內的數目d；不以新增次序或箭長配對。未配對學生記錄數e = M − m。

每題分數 = clamp((8m + 12d − 20e) / K, 0, 20)。總分為五題分數相加；中間計算不四捨五入，只在顯示時處理小數。每個多餘箭頭的扣分等於一個完整正確外力的分值，避免用多支同類箭頭覆蓋所有方向而獲益。扣分只在該題，按規則保留其他四題及本題尚有的部分分數；不以「有錯就整題零分」取代此算式。

以K=4的平地拉動題為例：

| 最終答案 | 本題分數 |
|---|---:|
| 空白 | 0/20 |
| 只畫兩個真正外力，種類及方向都對 | 10/20 |
| 四個所需種類都選對，但方向全錯或未畫 | 8/20 |
| 三個全對，另一個種類對但方向錯 | 17/20 |
| 四個全對，再加一個多餘的力 | 15/20 |
| 四個全對，不論四支箭頭長短比例 | 20/20 |

提交前只回應操作是否記錄，不顯示正確／錯誤色碼、正確力數或解答。提交成功後逐題指出漏了哪個力、哪個多餘、方向為何不符，以及靜摩擦／滑動摩擦／繩拉力／支持力的理由；可切換「我的圖／參考圖」，不需要在窄屏重疊所有箭頭。參考圖仍註明箭長不按比例。Pending或技術錯誤狀態不宣稱成績已確認。

## Phase/state matrix

不另加第六個練習關；簡短操作說明放在活動內，需要時展開。所有可保存的semantic phase只有`edit`和`check`；已提交以review snapshot呈現，技術鎖定由shared runtime狀態決定。

| Phase / variant | Current step | Required semantic state | Absent / retained data | Legal continuation / final-check route |
|---|---|---|---|---|
| edit / fresh或本題空白 | current=0…4 | seed/version及五個答案陣列；目前可為[] | 其他四題可空白或有答；returnToCheck=false | 新增力、換題或直接check |
| edit / 只有待畫記錄 | current=0…4 | 有種類、angle及length皆null的記錄 | 不補任何幾何 | 起筆、刪除、換題或check |
| edit / 有已畫或混合記錄 | current=0…4 | 合法角度／長度或待畫記錄 | 錯種類、錯方向、重複力都是合法學生答案 | 改箭頭、刪改、換題或check |
| edit / 從check返回，涵蓋上述三種內容 | current=0…4 | returnToCheck=true；目前及其他題原答案保留 | 不用visited或完成旗標阻止空題 | 保存修改後「返回檢查」；亦可直接換其他題 |
| check / 五題空白 | current=null | 五個[]、returnToCheck=false | 不創建預設答案 | 提交0分，或選任一題編輯 |
| check / 只有種類或部分圖 | current=null | 保留null方向與已畫方向 | 不把缺答誤判資料損壞 | 提交部分答案或返回編輯 |
| check / 所有現有記錄均已畫 | current=null | 現有記錄都有方向；不代表力數或方向正確 | 不保存「全部正確」假設 | 提交或返回編輯 |
| submitted review / 空白、部分、已畫 | review selection為暫態 | 已驗證的權威答案及重新評分結果 | 無editable phase、undo或active pointer | 只讀選題、切換參考圖 |
| pending frozen / 同上三種內容 | runtime決定 | 驗證nested review及同一payload | 禁止改答或重抽 | 只重試同一提交；驗證失敗quarantine |

| Transition / trigger | Preconditions | State changes / downstream effects |
|---|---|---|
| 新增力／改種類／刪除／清除本題 | editable | 一次atomic command，保存本題；不改場景或別題 |
| 起筆／改箭尖pointerup | editable且active pointer一致 | working幾何canonicalize後commit一次；render、save及scoring使用同一角度 |
| cancel／viewport改變／lock | 有working operation | rollback到開始前，清preview及capture；不保存半完成角度 |
| header選題 | editable | 取消working，保存已commit草稿，只更新current |
| 前往check | 任一editable variant | 取消working，phase=check、current=null、returnToCheck=false |
| check選題編輯 | check | phase=edit、current=所選呈現序號、returnToCheck=true |
| 最終提交 | check，包括全空白 | 依目前答案算分及製作review snapshot，交shared四outcomes處理 |

## Persistence contract

依[權威快照契約](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract)與[持久化測試](../docs/simulation-scorm-production-guide.md#required-persistence-tests)。以下為已實作的資料契約。

| Snapshot | Exact schema / field types / allowed values |
|---|---|
| Draft answer | schemaVersion=1、generatorVersion=1、rubricVersion=1、seed=uint32、phase=`edit`或`check`、current=0…4或null、returnToCheck=boolean、answers=恰好5個陣列 |
| Review answer | 相同schemaVersion/generatorVersion/rubricVersion/seed/answers；不保存editable phase/current/returnToCheck。分數及passed只在shared review metadata作比較 |
| Answer ordering | answers固定按A,B,C,D,E儲存，與呈現次序分開；current指本次隨機排列位置，次序由seed/version重建，不信任另存題目順序 |
| One force record | compact tuple `[kind, angle10, length1000]`；kind為0…4，依序對應G/N/f/T/F；每類≤3、每題總數≤8 |
| Placed geometry | angle10為0…3599整數、0°向右逆時針；length1000為1…1000整數，只控制顯示半徑。方向與長度必須同為有效值 |
| Unanswered encoding | 空題=[]；已選種類未畫方向為`[kind,null,null]`。缺欄、只一欄null或非法數字不是空白答案 |

箭尾由本題重心重建。長度以該方向的安全顯示半徑內插：1對應最短可辨箭長，1000對應不越過安全區的最長箭長；正常高度手機最短44px；極短視窗沿同方向縮短至安全區內。Viewport改變只重算顯示尺度、不改angle10、length1000或分數；短高先reflow舞台，再以安全區裁限顯示半徑。角度以0.1°作權威精度，確認操作時先量化，stage、preview、保存及評分一致，不在restore時另作較粗取整。

| State category | Activity fields and treatment |
|---|---|
| Authoritative | 三個版本、seed、五題種類／方向／顯示長度；draft的phase/current/returnToCheck |
| Transient | active pointer、working drag、選中箭頭、preview、hover、undo/redo、背景相位／暫停、參考圖開關；全部不持久化 |
| Derived | 場景參數、題序、真正外力／大小、重心及屏幕位置、T₁等labels、DOM IDs、分數及回饋；按版本重建 |
| Version compatibility | 初版只支援明確登記的v1組合。後續改generator或rubric須保留舊版本或明確拒絕，不用新容差偷偷重判舊成績 |
| Size | 只存最多40個compact力記錄及小型metadata，詳細解說重算；完整draft/review/pending UTF-8上限4000 bytes；40-record 壓力樣本 draft/review/pending 為 788/765/938 bytes，非法超限另行拒絕 |
| Invalid finished review | 維持只讀，僅顯示可信的Moodle摘要及資料無法還原提示，不重開新attempt |
| Invalid pending-final | 權威decode及rescore／canonical answer比較失敗即quarantine，禁止改答、清除或retry錯payload |
| Invalid editable draft | 先技術鎖定；只有明確未提交且使用者選擇恢復時，才依shared recovery清除／覆寫；未知提交狀態不清除 |

必須拒絕非法enum、非有限數字、非整數、超範圍、錯誤欄位組合及無法render的phase/current關係。錯誤方向、錯種類、額外力、重複力、全空白及null方向都是合法學生作答，不因不符合標準答案而被decoder拒絕。Label／DOM ID不是權威關聯，不在snapshot儲存；依穩定陣列位置重新建立。

Finished restore：validate → regenerate scene → restore learner records → rescore with saved rubric version → `SimActivityFlow.reviewResult()`核對computed、saved、LMS；不以舊score代替答案驗證。每個matrix row須有正式encode/decode/restore及一個真正可執行的後續動作。

## Shared SCORM lifecycle

採[shared lifecycle](../docs/simulation-scorm-production-guide.md#mandatory-shared-lifecycle-flow)，不另做commit／finish／page lifecycle。依 2026-09-26 使用者明確要求，Standalone 使用 shared runtime 預設的記憶體模式，不 opt in `enableStandalonePersistence(ACTIVITY)`：刷新可開始新一輪，包括提交後。這是本活動獨立練習的明確例外；Moodle 的草稿、已交檢討及 pending 恢復規則不變。

| Outcome / policy | Activity handler, controls and learner-facing message |
|---|---|
| Startup editable | 建立或還原同一seed草稿，register draft provider，開放編輯 |
| Startup review | 驗證／重算，顯示只讀受力圖及信任狀態 |
| Startup frozen | 先驗證nested review及同一答案，保留鎖定；只提供合法payload重試 |
| Startup load-error | 顯示「目前未能讀取作答資料」，鎖定不安全操作，不假稱已提交或重新抽題 |
| Submit success | 已確認提交；顯示成績、逐題回饋及只讀檢討 |
| Submit committed | 成績已記錄、結束連線未完成；鎖定並允許finish retry |
| Submit frozen | 「提交尚未確認，答案已保留供重試」；不宣稱confirmed score/pass/fail |
| Submit retry | 沒有durable final state；依retryable保留編輯及重試或技術錯誤提示，不標submitted |
| Review trust | match正常檢討；mismatch提示記錄不一致；unknown以未確定狀態呈現，不轉成不及格 |
| Standalone storage | 僅保存於目前頁面記憶體；顯示重新整理可開始新一輪的提示。不讀寫舊版本 localStorage checkpoint，因此原先被已交記錄鎖住的頁面也能恢復練習；不刪除舊資料或操作 Moodle 記錄 |
| Standalone reload | 草稿或提交後重新整理均開新一輪；同頁提交後仍只讀。localStorage 無法讀寫不阻止獨立練習。Moodle 的損壞未交草稿仍依既有驗證及保存流程恢復 |

只在新增／刪改力、完成drag、清除、換題、進出check等semantic change保存。背景animation及pointermove不寫snapshot；不讀寫raw LMS fields或自行寫localStorage欄位。

## Test plan

驗證由下列模型、持久化、正式 runtime 與瀏覽器測試執行；具體命令及產物記於文末。

- [x] Generator：同seed/version同幾何／順序；每套五類各一、至少一勻速；鏡像答案及文字一致；遍歷離散組合驗證ΣF≈0、N/T>0、摩擦可行、同類方向間距、有限抽樣及版本拒絕政策。
- [x] Scoring：全空白、只選種類、部分正確、錯方向、多餘／重複、雙繩交換順序、E多推力、10°與10.1°、0/360跨界、各箭長改變分數不變；枚舉新增多餘同類方向不能提高分數的例子。
- [x] Physics wording：靜摩擦依趨勢、滑動摩擦依相對地面速度；光滑無摩擦；勻速不加「運動力」；繩不施推力，接觸N不為負；題目提供足夠線索。
- [x] Model/UI：種類null方向不補答、固定重心、不按種類自動轉向；每個操作undo/redo；pointercancel安全回復；選中重疊力可編輯；量化後preview／release／save一致。
- [x] Motion：背景位移與時間成正比、方向相反；相同elapsed time在30/60/120Hz結果相同；物體／箭尾／hit targets／camera不漂移；循環無跳格；pause/reduced-motion不改題設或答案。
- [x] Persistence：每一phase/variant作production round-trip並執行合法下一步；五題混合空白／待畫／錯答；還原前後score及passed一致；非法state拒絕與合法錯答分開；完整snapshot≤4000bytes。
- [x] Lifecycle：執行production startup與四submit outcomes、不可retry錯誤、trust mismatch／unknown、invalid finished、pending quarantine。Standalone 的刷新與舊 checkpoint 隔離依本次修訂另驗證，見文末。
- [x] Navigation：每個editable狀態可到check及提交空白／部分；回check編輯保留其他題；提交後及pending不能刪改／清除／重新抽題。
- [x] Mobile：完整viewport/zoom矩陣、五力標籤碰撞、44px targets、兩側實測32px、preview真實幾何及不遮擋、相同角度在不同屏幕判分一致；鍵盤流程無死路。
- [x] Trusted touch：在可捲host iframe逐行測上文matrix，包括所有種類／多個同類、multi-touch、panel邊界及鎖定後舊target；source與extracted package各自執行並記錄全部scroll／viewport／iframe metrics。
- [x] Integration：新tests登記到`tools/run-tests.js`；runtime asset逐一對manifest及catalogue；ZIP根有imsmanifest.xml、無測試／暫存檔。

實作檔案：`index.html`、`styles.css`、`main.js`、`generator.js`、`model.js`、`scoring.js`、`persistence.js`、`notation.js`、`scene.js`、`ui-runtime.js`。五個測試檔分別驗證生成、模型、評分、持久化及正式 shared SCORM lifecycle；`tools/force-equilibrium-browser-regression.js` 驗證實際 DOM、手勢、畫面與提交流程。全部已登記於 `tools/run-tests.js`。

## Package-ready checklist

- [x] 使用者已批准依本草案實作五類情境、隨機範圍、評分配置及目前參考核心；後續修訂寫回此文件。
- [x] 方向／長度分離、固定物體移動背景、觸控preview及host ownership 通過模型與實際瀏覽器驗證。
- [x] Model、rubric、dependencies、state matrix及權威schema全部照核定規格實作，本活動所需測試通過。
- [x] Phone/tablet/desktop、短iframe、工具列高度變化及200%zoom已按文末列明方式驗證。
- [x] `npm run check`、`npm test`、`npm run package:all`及diff checks通過，命令及產物見下方。
- [x] Manifest完整，ZIP只含runtime；從extracted artifact完成smoke及完整trusted-touch matrix。

## Moodle-ready checklist

- [x] Package-ready完成。
- [ ] 真實學生帳戶提交有score/status；草稿恢復、pending retry、只讀檢討、0分／部分分及Moodle新attempt規則驗證。
- [ ] 實體手機在current-window及可用new-window通過完整手勢矩陣、preview、背景動畫及可讀性檢查。
- [ ] Moodle與實機證據獨立記錄；不得以本地browser模擬聲稱完成。
- N/A 高風險grading：本版只作 formative 練習；若用途改變，先提供可信服務端驗證方案。

## 實作次序與歷史記錄

1. 審閱本草案，確認參考活動及五類內容；先處理題意和物理可行性。
2. 實作generator/model/scoring；以一個斜面題和一個勻速平地題驗證方向判分及移動背景。
3. 做手機重心起筆、箭尖編輯、preview及iframe手勢spike，解決窄屏標籤與多力重疊。
4. 完成五類場景、隨機題序、check/review、草稿／SCORM與鍵盤操作。
5. 執行source/package驗證，再做實機Moodle驗收。

2026-09-26 第一輪（歷史）：只建立專用分支與計劃，沒有活動程式或 SCORM 包。使用者其後批准完整實作；目前狀態以以下實作證據為準。


## 首次實作及驗證證據（2026-09-26，修訂前歷史）

以下記錄對應初版提交 `fb97179`；Standalone 保存政策已由文末的使用者修訂取代。

- 分支：`codex/force-equilibrium-diagram-lab`。原生 SVG、十個活動 runtime 檔案、五個模型／持久化／lifecycle 測試檔、一個瀏覽器回歸 runner；沒有新增學生活動的外部函式庫。
- `generator.test.js`：2,000 組 seed 重現；窮舉離散物理參數組合，檢查向量和、接觸力／張力正值及摩擦條件。
- `scoring.test.js`：空白、部分分、未畫方向、重複及多餘力、一對一配對、10°／10.1°界線、跨 0°、長度無關；100 組 seed 的滿分／零分及多畫同類方向不可提高分數檢查。
- `persistence.test.js`：48 個正式快照 round-trip 及合法後續動作；錯答與損壞資料分開驗證。40-record 壓力樣本為 draft 788、review 765、pending 938 bytes。
- `lifecycle.test.js`：執行正式 `Controller` 與 shared `scorm.js`，涵蓋四種提交結果、LMS 儲存／結束失敗、四種空白或完整程度的 finished/pending 重開及後續操作、資料不一致／quarantine；standalone 儲存失敗、pending 重試、草稿恢復成功及失敗。
- 瀏覽器工具：macOS 上 Chrome 154.0.8037.57，CDP browser-level trusted touch（isTrusted=true）；沿用項目既有 runner helper。Playwright CLI wrapper 嘗試因 registry DNS 失敗，沒有安裝或更改執行依賴。
- 畫面矩陣：320×400、320×500、390×500、390×600、390×844、740×360、768×900、1024×768、1280×900；活動 document 沒有可用垂直或水平捲動。390px 的 CSS 佈局覆蓋 780px 視窗 200% 桌面縮放的等效可用寬度，另以 `visualViewport.scale=2` 檢查實際放大畫面；這不是實體手機的手勢縮放證據。無文字輸入欄，軟鍵盤呼出 N/A；硬體鍵盤已測 Enter、方向鍵、確認及提交。
- 截圖：`output/playwright/force-equilibrium/` 的 source/package 各 viewport、A–E 五類圖、E 三推力五箭圖、touch-preview 及 200-percent。逐圖檢查手機標籤與預覽；推桿字母標籤避開上方狀態文字。
- 完整手勢報告：`output/playwright/force-equilibrium/report.json`，逐列保留 host、activity document、panel、雙方 visual viewport、iframe bounds、答案及 pointer diagnostics。不同 viewport 的手勢矩陣使用獨立瀏覽器分頁，並在 fixture 換頁重設 CDP touch emulation；協定命令最多等待 15 秒，處理 iframe 換頁後較慢的 Chrome 事件確認，所有手勢／位置／答案斷言維持不變。

真實 Moodle 學生帳戶與實體手機尚未驗證；不同源 iframe 的 host 捲動亦未建立部署證據。這些保留於 Moodle-ready，不能由本地 Chrome 模擬代替。

- 最終新活動 browser regression 已通過 source 與 extracted package；390×500、320×500 各 22 個手勢證據列，合共 88 列，包含單向 hostTrace、review/frozen/committed 舊 target、雙指及真正預覽。所有 runtime exception 檢查為空。
- 全項目首次驗證遇到既有摩擦力測試的時序敏感斷言：確認重做後先等候約 340ms，再讀取 recorder，可能已被獨立的 50ms stalled-frame watchdog 結束。測試改為在同一可信 click task 觀察「清除舊記錄並開始錄製」的 atomic 結果，保留原有 stalled-frame 測試；沒有修改該活動 runtime。


### 最終製作驗收

| 命令／檢查 | 結果 |
|---|---|
| `npm run check` | 通過；最終 active 目錄與全部 JavaScript／manifest profile |
| `npm test` | 全部通過；包含本活動五個測試檔、source/package browser runner，以及既有活動／shared runtime 全套測試 |
| `npm run package:all` | 全部 16 個 SCORM 套件通過；新活動 ZIP 共 15 個檔案（包含根 imsmanifest.xml） |
| `git diff --check` 及新增檔案 whitespace 檢查 | 通過；沒有 PR，分支實作基準為 `d49cb15438d6a6ffcd7c4921759754ee0e66ce6f` |
| 最終 ZIP／source parity | manifest 宣告、所有 HTML runtime 參照與 ZIP 項目一致；不含 tests／工具／暫存截圖 |

成品入口：`sim/force-equilibrium-diagram-lab/index.html`。套件：`output/force-equilibrium-diagram-lab-scorm.zip`。目錄 status 已設為 `active`。本輪完成 package-ready；真實 Moodle／實體手機的 Moodle-ready 項目仍未驗證。

## 桌面展示及獨立練習修訂（2026-09-26）

使用者要求桌面力名及箭頭更適合投影、手機保留現有大小、圖內只標重心圓點、替換直立遠景，以及獨立練習提交後可用重新整理再做。

- 舞台達 520×400 CSS px 時使用 1.8 倍顯示尺度，力名 32.4px，箭桿約 6.1px；手機力名維持 18px、箭桿 3.4px。標籤避讓盒、物體外框、箭尖邊距和可調長度範圍一併配合；不改權威角度、長度記錄及評分。重心旁文字已移除。
- 勻速場景改為物體下方淡色地面分格，144px 週期連續平移；移除原有直立遠景。物體、力箭及畫圖座標固定，背景不參與答案或評分。
- Standalone 改用 shared SCORM 預設記憶體模式，刷新清空本頁作答並抽新一輪；面板有對應提示。舊 checkpoint 不讀寫、不刪除，不再導致永久只讀。Moodle 保留原有 draft/review/pending 恢復和四種提交結果。
- 正式 lifecycle 測試已驗證草稿及提交後刷新、新一輪合法作答、舊 finished/pending/損壞 checkpoint 的隔離、localStorage 讀寫受限仍可練習，以及同頁已交只讀。生成器、評分、48 行快照 round-trip、幾何及 manifest 檢查均已通過。
- 本次瀏覽器驗證已通過 390px 原手機字級、1024px／1280px 桌面字級與五類圖、三推力五箭圖、桌面拖畫／箭尖再編輯、實際重新整理及舊 checkpoint；source 與 extracted package 使用同一正式程式。兩種來源各有 390px／320px 的 22 行可信觸控檢查，合共 88 行；runtime exceptions 為零。

| 本次修訂驗收 | 結果 |
|---|---|
| `npm run check` | 通過 JavaScript 及 SCORM manifest 檢查 |
| `npm test` | 全套通過，包括本活動更新後的 lifecycle／幾何／source 及 package 瀏覽器測試，以及其餘既有活動與 shared runtime |
| `npm run package:all` | 16 個套件全部通過；更新後的本活動 ZIP 有 15 個檔案 |
| 成品 parity | ZIP 中 14 個 runtime 檔案與目前 source 逐位元組一致；根目錄有 `imsmanifest.xml` |

更新成品沿用 `output/force-equilibrium-diagram-lab-scorm.zip`。畫面及觸控證據在 `output/playwright/force-equilibrium/`；本機 Chrome 模擬與 fake LMS 不代表真實手機／Moodle 已通過，Moodle-ready 項目仍待實測。
