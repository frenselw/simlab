# 自由落體：頻閃量度實驗室

## 0. 文件狀態

- 文件角色：新 SimLab 活動的產品、教學、物理、量度操作、過程評分、持久化、
  SCORM、測試及 packaging 實作藍圖。
- Slug：`free-fall-stroboscopic-measurement-lab`
- 風險層級：T3（新模擬；同時涉及學科模型、操作評分、直接拖動、持久化及
  SCORM package）。
- Base ref：`main`；正式 review／implementation gate 使用
  `origin/main` 與 working tree 比較。
- 目前狀態：供用戶審批的計劃草案；未獲批前不建立 activity runtime、
  registration、manifest 或 package。
- 語言：學生介面使用繁體中文；本文以繁體中文及必要英文識別字撰寫。
- 規格優先次序：本文件不得覆蓋
  `plans/00-shared-platform-and-style.md`、
  `docs/simulation-scorm-production-guide.md` 或 `AGENTS.md` 的共用契約。
- 本文件獲批後，物理模型、評分、量度證據、phase、snapshot schema、手勢責任
  及 acceptance gate 均以本文為基準；任何改變上述契約的修訂，先更新本文。

## 1. 目的與教學定位

本活動讓學生把自由落體的「公式」重新連結到可見、可量度的頻閃相片：

1. 學生自行設定頻閃頻率；
2. 模擬生成由同一次自由落體形成的等時間間隔頻閃軌跡；
3. 學生把可移動直尺放到球旁邊，實際讀取總位移及相鄰間隔；
4. 學生整理時間比及距離比；
5. 學生歸納：
   - 由靜止開始、加速度固定時，總位移 \(s\propto t^2\)；
   - 相等時間間隔內的位移比為連續奇數
     \(1:3:5:7:\ldots\)；
   - 以上現象是速度每一相等時間增加相同數值的結果。

核心學習證據不是「學生最後揀中答案」而已，而是完整證據鏈：

```text
設定頻率
→ 生成等時間頻閃圖
→ 移動並對準直尺
→ 讀取及記錄量度
→ 比較比例
→ 說明自由落體規律
```

本活動明確例外於一般「只評提交最終答案」做法：操作過程本身是學習目標，
所以最終提交的權威狀態包括精簡而可重算的量度操作證據。系統不以拖動次數、
速度或手勢熟練程度評分，只判斷學生有沒有完成與量度目標直接相關的有效操作。

### 1.1 針對的常見錯誤概念

- 頻閃點之間距離相等，因為拍攝時間間隔相等；
- 球每一段「多行相同距離」，而不是每段增加量形成奇數比；
- 總位移與時間成正比，而不是與時間平方成正比；
- \(1:3:5:7\) 是由起點量到各點的總位移比；
- \(1:4:9:16\) 是相鄰點之間的間隔比；
- 改變頻閃頻率會改變重力加速度或球的真實運動；
- 畫面像素距離可直接當作米，不需要校準標尺；
- 量度時直尺零刻度不需要對準量度起點。

## 2. Scope

- Learning objective：
  - 由頻閃頻率求相鄰影像的時間間隔 \(\Delta t=1/f\)；
  - 用直尺量度由釋放點至 \(P_1\)–\(P_4\) 的總位移；
  - 用直尺量度 \(P_0P_1\)、\(P_1P_2\)、\(P_2P_3\)、\(P_3P_4\)
    四段相鄰間隔；
  - 分辨總位移比、相鄰間隔距離比、累積時間比及每段時間比；
  - 由量度證據歸納 \(s\propto t^2\) 及
    \(\Delta s_1:\Delta s_2:\Delta s_3:\Delta s_4=1:3:5:7\)。
- Learner task：
  - 從未設定狀態選擇 `4 Hz`、`5 Hz` 或 `6 Hz`；
  - 按「拍攝頻閃相片」生成 \(P_0\)–\(P_4\)；
  - 把停泊在舞台側邊的直尺拖到球列旁；
  - 完成四個總位移讀數及四個相鄰間隔讀數；
  - 填寫 \(\Delta t\)、四組比例及三條物理規律題；
  - 在提交前 review 檢查量度證據和答案，然後提交。
- Main interactions：
  - 拍攝前的連續自由落體示意及明確重播；
  - 頻率 segmented control；
  - 生成／重新拍攝按鈕；
  - mouse／trusted touch 直接拖動直尺；
  - 選擇量度目標；
  - 聚焦直尺後以方向鍵／Shift+方向鍵移動；
  - 數值輸入、比例輸入、單選概念題；
  - review、返回修正、提交。
- Runtime files（實作階段）：
  - `sim/config.js`（package root 為 `config.js`，manifest 必須明列）
  - `sim/free-fall-stroboscopic-measurement-lab/index.html`
  - `sim/free-fall-stroboscopic-measurement-lab/styles.css`
  - `sim/free-fall-stroboscopic-measurement-lab/model.js`
  - `sim/free-fall-stroboscopic-measurement-lab/animation.js`
  - `sim/free-fall-stroboscopic-measurement-lab/scoring.js`
  - `sim/free-fall-stroboscopic-measurement-lab/persistence.js`
  - `sim/free-fall-stroboscopic-measurement-lab/main.js`
  - 對應的 `*.test.js`
  - 共用 `sim/shared/styles.css`、`sim/shared/scorm.js`、
    `sim/shared/activity-flow.js`
- Libraries：無；使用原生 HTML、CSS、JavaScript、SVG 及 Pointer Events。
- Assessment risk：`low-risk graded`。
- Trusted validation：不適用於此低風險版本。瀏覽器端操作證據及 scorer 可被
  developer tools 改寫；本文接受其用於形成性或低風險評核，不宣稱防作弊。
- Out of scope：
  - 空氣阻力、終端速度、浮力、自轉或橫向運動；
  - 由非零初速度開始；
  - 不同星球或讓學生改變 \(g\)；
  - 真實相機曝光、殘影亮度或感光誤差模型；
  - 自動影像辨識；
  - 斜尺、旋轉尺、卡尺或自由縮放尺；
  - 多次實驗的統計平均及不確定度傳播；
  - 跨 Moodle attempts 的完整操作歷史；
  - 高風險考試用途；
  - 第一版不加入隨機 \(g\)、隨機釋放高度或題庫。

## 3. Catalogue metadata (`sim/config.js`)

計劃階段只定義 metadata；實作達到 deployable gate 前狀態為 `planned`。

```js
{
  title: "自由落體：頻閃量度實驗室",
  folder: "free-fall-stroboscopic-measurement-lab",
  categories: ["Mechanics"],
  description: "設定頻閃頻率，移動直尺量度自由落體各位置，從總位移及相鄰間隔歸納運動規律。",
  tags: [
    "physics",
    "mechanics",
    "kinematics",
    "free-fall",
    "stroboscopic-motion",
    "measurement",
    "constant-acceleration",
    "scorm"
  ],
  status: "planned"
}
```

- `folder` 必須與 activity directory 及 manifest slug 完全相同。
- package-ready 並獲批准後才把 `status` 改為 `active`。

## 4. 核心產品及教學決定

### 4.1 固定顯示 \(P_0\)–\(P_4\)

不論學生選擇哪個合法頻率，頻閃相片固定顯示：

- \(P_0\)：釋放一刻，\(t=0\)；
- \(P_1\)：第一次相隔 \(\Delta t\) 的影像；
- \(P_2\)、\(P_3\)、\(P_4\)：其後等時間影像。

畫面及題目一律使用 \(P_0\)–\(P_4\)，避免「第一個球影是不是起點」的歧義。
題目用語必須清楚區分：

- 「由起點 \(P_0\) 至 \(P_n\) 的總位移」；
- 「相鄰兩點 \(P_{n-1}\) 至 \(P_n\) 的間隔距離」。

### 4.2 相機自動校準，但不提供答案

若所有頻率都使用固定 5 m 畫面，`6 Hz` 的第一段會在矮手機上過短。第一版因此
把頻閃相機視野校準至剛好容納 \(P_0\)–\(P_4\) 及底部留白。畫面旁明示：

> 相機已按今次軌跡調整視野；每次都要按直尺刻度讀取實際距離，不能比較像素。

改變相機比例只影響呈現，不改變物理量、scorer 或比例。內部 model、scorer、
snapshot 的 `readingM`／`rulerZeroM` 仍一律使用米；學生看見的直尺、距離輸入、
review、結果、容差及錯誤訊息一律使用厘米，邊界只作一次
`cm ÷ 100 -> m` 或 `m × 100 -> cm` 轉換。

### 4.3 理想模型，保留真實量度感

- 物理位置不加入隨機噪聲，讓比例規律可由理想數據成立。
- 學生讀尺及對準仍有有限精度，所以數值評分使用明確容差。
- UI 不顯示球的權威 \(s_n\) 數字，不提供自動距離 readout。
- 有效對準提示只說「可以讀數」，不顯示正確讀數或誤差大小。
- 提交後 review 才顯示理想值、學生值及差異。

### 4.4 可以跳過或不用尺，但不能取得操作分

活動不以 UI 硬鎖迫使每個學生完成有效尺位，否則「操作評分」會退化成入場條件。
每個量度欄可：

- 輸入一個讀數；
- 明確標記「未能量度／跳過」；
- 在沒有有效尺位證據下輸入估算值。

後兩種路徑仍可完成及提交，但相關操作分為零。這讓 scorer 能區分：

- 真正移尺量度後得到正確／不正確讀數；
- 答案正確但沒有尺位證據；
- 有移尺但擺位無效；
- 完全跳過。

## 5. 物理及相機模型

### 5.1 常數及單位

```text
MODEL_VERSION = 1
g = 10.0 m/s²
initialVelocity = 0 m/s
initialDisplacement = 0 m
allowedFrequenciesHz = [4, 5, 6]
pointCount = 5  // P0 through P4
```

採用課程常見近似 \(g=10.0\ \text{m s}^{-2}\)。學生介面在說明卡明示此近似；
不可暗中用 `9.81` 而令理想比例與顯示數值不一致。

### 5.2 位置及時間

對所選頻率 \(f\)：

```text
Δt = 1 / f
t_n = n × Δt
s_n = 0.5 × g × t_n²
v_n = g × t_n
```

其中 \(n=0,1,2,3,4\)，向下定為正方向。相鄰間隔：

```text
Δs_n = s_n - s_(n-1)
     = 0.5 × g × Δt² × (2n - 1)
```

因此：

```text
t_1:t_2:t_3:t_4 = 1:2:3:4
s_1:s_2:s_3:s_4 = 1:4:9:16
Δt_1:Δt_2:Δt_3:Δt_4 = 1:1:1:1
Δs_1:Δs_2:Δs_3:Δs_4 = 1:3:5:7
```

### 5.3 代表數值

| 頻率 | \(\Delta t\) | \(s_1\) | \(s_2\) | \(s_3\) | \(s_4\) |
|---:|---:|---:|---:|---:|---:|
| 4 Hz | 0.2500 s | 0.3125 m | 1.2500 m | 2.8125 m | 5.0000 m |
| 5 Hz | 0.2000 s | 0.2000 m | 0.8000 m | 1.8000 m | 3.2000 m |
| 6 Hz | 0.1667 s | 0.1389 m | 0.5556 m | 1.2500 m | 2.2222 m |

Model 及 scorer 以米保留 full precision；學生畫面、直尺、輸入、review 及
feedback 顯示厘米。輸入如 `20 cm` 精確轉為 `0.2 m`、`31.25 cm` 精確轉為
`0.3125 m`，不可預先四捨五入、重複除以 100，亦不可用顯示值重新評分。
feedback、review 及 ARIA 的厘米顯示最多保留兩個小數並移除 IEEE-754 尾數；
restore/edit input 則以 decimal-place shift 保留 canonical learner reading 的實際
精度（例如 `31.25`），不可先經 display rounding 再回寫 authoritative state。

### 5.4 相機範圍

```text
cameraMaxM = ceil((s_4 + 0.25 m) / 0.5 m) × 0.5 m
cameraMinM = 0
usableStageHeightPx = stageHeightPx - topPaddingPx - bottomPaddingPx
yPx(s) = topPaddingPx + usableStageHeightPx × s / cameraMaxM
```

代表範圍：

- `4 Hz`：`cameraMaxM = 5.5 m`
- `5 Hz`：`cameraMaxM = 3.5 m`
- `6 Hz`：`cameraMaxM = 2.5 m`

直尺及球列共用 `yPx()`；resize 後由權威米制位置重畫，不把舊像素位置當答案。

### 5.5 頻閃生成

- 學生必須由「未設定」主動選擇頻率，沒有預選正確答案。
- `setup/new` 及 `setup/configured` 先顯示一個非互動實心球的連續自由落體示意：
  \(s=\tfrac12gt^2\)、\(0\le t\le1.00\text{ s}\)，使用固定 `0..5.5 m` 示意比例；
  \(t=1.00\text{ s}\) 時球位於 `5.00 m`。正常動態模式自動播放一次後停在終點，
  並一直提供「重播連續下落」。它不循環、不留下 \(P_0\)–\(P_4\)、不選擇頻率、
  不產生讀數／evidence／score／checkpoint。學生可見文字必須說明：
  「連續自由落體示意（尚未拍攝）：畫面只有同一個正在下落的球；此預覽不產生
  量度數據。」
- 第一次合法按「拍攝頻閃相片」時，production 只執行一次
  `Persistence.generate()` 及一次 semantic draft checkpoint，取消任何預覽，
  並進入不持久化的 `capturing` presentation。快速雙擊或重複 activation 不可重複
  phase transition、checkpoint、timer 或球影。
- Capture 由同一實心球在 \(t=0\) 重新開始連續下落。\(P_0\) 立即留下；其後在
  精確 logical time \(t_n=n/f\) 留下 \(P_n\)，而位置必須直接取
  `Model.displacementAt(f,n)`，不可取動畫 frame 的近似位置。實心球在曝光之間
  仍依 \(s=\tfrac12gt^2\) 連續移動。4／5／6 Hz 的最後曝光時間分別為
  `1.0000 s`、`0.8000 s`、約 `0.6667 s`。
- Capture 可用非 flashing 本地狀態文字，例如
  「已記錄 P₂，t=0.400 s」；並說明「實心球是正在下落的同一個球；留下的球影是
  相機每隔 Δt 記錄的位置」。禁止全舞台／全畫面明暗閃爍、白色 camera flash、
  背景 luminance animation 或反覆切換既有球影。
- \(P_4\) 完成後移除 live ball，只保留恰好五個靜態、標記
  \(P_0\)–\(P_4\) 的球影，然後才顯示直尺及量度 UI。完成文字為：
  「頻閃相片完成：五個球影來自同一個球，彼此相隔 Δt；現在量度靜態相片。」
  最終幾何必須與權威 model 完全相同；量度期間沒有持續物理時鐘。
- Preview／capture 的 token、frame ID、elapsed time、live-ball 位置、已顯示球影
  index 及 status 全屬 transient。Resize 只按目前 transient/model 重畫，不重啟
  sequence；visibility interruption、取消、phase change 或 stale callback 必須
  token-guard。已生成 draft／review reload 永遠直接顯示完整靜態相片，不恢復半段
  animation。
- `prefers-reduced-motion: reduce` 不自動平移球，也不按 cadence 計時顯示球影。
  拍攝前顯示起點／終點／箭頭及「連續下落動畫已按你的動態效果設定省略」；
  按生成後立即顯示相同的完整權威 \(P_0\)–\(P_4\) 靜態相片、所選 \(f\)、
  \(\Delta t\) 及 equal-time sampling 說明。重播按鈕仍可操作但不強制動畫。
- 改變頻率時，先顯示確認：「重新拍攝會清除今次量度值及操作證據」。
- 確認後原子式清除所有依賴舊頻率的讀數、比例答案、概念答案及 review 狀態，
  保留的只有非評分 UI 偏好。

## 6. 畫面及量度工具

### 6.1 舞台

舞台使用 SVG 畫：

- 淺色相機背景及垂直方向提示；
- 拍攝前一個非互動 preview ball；capture 時一個非互動 live ball 及逐次保留的
  半透明曝光球影；
- \(P_0\)–\(P_4\) 五個相同球影；
- 每點旁的 `P₀`–`P₄` 標籤；
- 選中量度目標時的兩條淡水平投影線；
- 直尺停泊區及量度工作區；
- 不顯示位置數字、答案線或自動括號距離。

Preview/live ball、曝光球影及最終球影均不是 draggable target，並使用
`pointer-events:none`；只有完成相片後的直尺可以移動。點選球影只可選擇量度
目標，不改變物理位置。

### 6.2 直尺

- 垂直透明直尺；學生刻度及標籤使用厘米，內部幾何仍使用米；
- 細刻度每 `5 cm`、中刻度每 `10 cm`、主刻度每 `50 cm`；只標示主刻度
  `0, 50, 100, ...`，並在尺身空白位置只顯示一次直立 `cm`；
- `ruler.y` 永遠代表零刻度 anchor，而不是尺身上緣；
- 零刻度以上及最大刻度以下各保留 `12 SVG user units` 的尺身 end margin；
- full ruler body 可在零刻度對準 \(P_1\)–\(P_3\) 時自然超出並被舞台裁切；
  不可為了把整把尺塞進舞台而移動零刻度；
- 一個共用 geometry helper 由 zero anchor、tick span、end margins、stage CTM
  算出 full body、與舞台相交的 visible body、dynamic visible width、measuring
  edge 及 clamp；draw、position、hit/scoring geometry、restore 及 pointer/keyboard
  clamp 全部使用同一結果；
- SVG 使用 `preserveAspectRatio="none"`（或等價明確 CTM），HTML overlay 與
  可見 SVG 尺身四邊在 CSS pixels 相差不超過 `1 px`；
- 固定、原生 focusable HTML button／pointer-capture target 透明覆蓋可見尺身
  intersection，寬度在 required viewport 及 200% zoom 至少 `44 CSS px`；
  overlay 不另畫 glyph、border、fill 或 rounded handle，學生直接拖動直尺本身；
- focus-visible outline 沿可見尺身顯示；尺身 top／middle／bottom／left edge／
  right edge 均須由 `elementFromPoint` 命中同一 drag owner；
- render SVG 球列或刻度時不得替換 HTML pointer-capture target；
- 不設局部放大鏡或其他跟隨手指的 ruler preview window。

### 6.3 量度任務

總位移模式：

1. 選擇「由 \(P_0\) 量起」；
2. 將直尺零刻度對準 \(P_0\)，尺邊靠近球列；
3. 保持同一尺位，依次讀取 \(P_1\)–\(P_4\)；
4. 每輸入一個值時，系統記錄該讀數是否在有效總位移尺位下輸入。

相鄰間隔模式：

1. 依次選擇 \(P_0P_1\)、\(P_1P_2\)、\(P_2P_3\)、\(P_3P_4\)；
2. 每一段都把直尺零刻度重新對準較早的點；
3. 讀取較後一點對應刻度；
4. 系統要求本段被選中後曾實際移動直尺，才建立該段有效操作證據。

### 6.4 有效尺位證據

有效總位移證據同時要求：

```text
frequency was actively selected
trajectory exists
ruler moved out of its parking state
movement since task activation >= MIN_MEANINGFUL_MOVE_NORM
ruler zero is within ZERO_ALIGNMENT_TOLERANCE_PX of P0
ruler measuring edge is within the allowed adjacency band beside the ball column
pointer/keyboard movement ended before the reading was recorded
```

每個有效相鄰間隔證據同時要求：

```text
the intended pair is active
ruler moved after that pair became active
movement >= MIN_MEANINGFUL_MOVE_NORM
ruler zero is aligned to the earlier point of that pair
ruler edge is beside the ball column
the reading is confirmed while this placement remains valid
```

初始常數：

```text
MIN_MEANINGFUL_MOVE_NORM = 0.025  // stage diagonal fraction
ZERO_ALIGNMENT_TOLERANCE_PX = 6
RULER_EDGE_MIN_GAP_PX = 6
RULER_EDGE_MAX_GAP_PX = 44
```

`MIN_MEANINGFUL_MOVE_NORM` 令不同 viewport 的「有移動」判斷一致；alignment 使用
CSS pixel 是因為它代表可見對準精度。所有常數集中定義並有邊界測試。

系統只顯示中性狀態：

- 「直尺仍在停泊區」
- 「請把零刻度對準所選起點」
- 「直尺已靠近所選起點，可以讀數」

不顯示「差 0.03 m」、正確讀數或是否會得分。

### 6.5 不以無關操作扣分

- 任意重試、拖動次數多、用時長、先放錯再修正均不扣分。
- Pointer（mouse／trusted touch）及 keyboard 是等價輸入。
- 只有最後提交中與每個量度項目關聯的最佳有效證據計分。
- 隨便把尺移動一下但未對準，不建立有效證據。
- 把尺放在畫面一側後輸入理論值，可以取得答案分，但沒有相應操作分。

## 7. 整體學習流程

```text
連續自由落體示意
→ 設定頻率
→ 連續下落及等時間曝光
→ 靜態頻閃相片
→ 總位移量度
→ 相鄰間隔量度
→ 數據及比例分析
→ 提交前 review
→ SCORM submit
→ locked review
```

### 7.1 設定

- 畫面直接進入實驗，不設 landing page。
- 未選頻率時先 autoplay 一次不產生數據的連續下落示意，並提供明確重播。
- 簡短說明頻閃頻率是每秒拍攝次數。
- 學生選擇 `4/5/6 Hz`，畫面要求先預測「頻率愈高，相鄰影像時間是較短還是
  較長」；此預測不計分，提交後可比較。
- 按拍攝後先鎖定 conflicting setup actions，依所選 \(1/f\) 顯示一次 capture；
  \(P_4\) 完成及 live ball 移除後才出現量度表。Reduced motion 立即進入同一靜態
  結果。

### 7.2 量度

- 首次開啟總位移模式，提示零刻度要對準 \(P_0\)。
- 完成或跳過四個總位移項目後可進入相鄰間隔。
- 相鄰間隔按順序顯示四段；可回到較早項目重測。
- 每個距離項目均清楚顯示單位 `cm`；時間仍用 `s`、頻率仍用 `Hz`。
- 未填值不被當作 `0`。

### 7.3 分析

學生填寫：

1. \(\Delta t=1/f\)；
2. 累積時間比 \(t_1:t_2:t_3:t_4\)；
3. 總位移比 \(s_1:s_2:s_3:s_4\)；
4. 四段時間比；
5. 四段相鄰距離比；
6. 三條概念題。

比例輸入顯示首項固定為 `1`，其餘三項由學生輸入。UI 可提供「把第一項化為 1」
的非答案提示，但不自動填入比例。兩組時間比按理想等時拍攝比較；兩組距離比
明確標示為「根據你記錄的讀數約化」，scorer 以學生自己的正有限讀數計算
empirical target。物理規律題再要求學生辨認理想平方關係及連續奇數規律，避免
把有讀尺誤差的實驗比例假裝成完全精確整數。

### 7.4 提交前 review

Review 顯示：

- 所選頻率及 \(\Delta t\)；
- 八個讀數；
- 每組量度旁只有「有尺位證據／未有尺位證據」，不顯示分數；
- 四組比例；
- 三條概念答案；
- 未完成項目；
- 「返回量度」、「返回分析」、「提交結果」。

返回量度或分析時保留其他答案及 `returnToReview`，修正後回到 review。

### 7.5 提交後 review

- 鎖定頻率、直尺、輸入及提交；
- 顯示總分、操作／數據／規律三部分；
- 顯示理想數值及合理容差；
- 以物理語言說明混淆，例如：
  - 「你找到了總位移平方比，但相鄰間隔應比較連續兩點之差。」
  - 「答案正確，但今次記錄未顯示直尺曾對準三個相鄰間隔。」
- 同一已完成 attempt 只供 review；重做需要 Moodle 新 attempt。

### 7.6 學生可見數學排版

- HTML learner copy 以語義 `<var>`、`<sub>`、`<sup>` 表示
  \(f,t,\Delta t,s,\Delta s,g,v,P_n,t_n,s_n,t^2\)；
- 單位使用直立文字，包括 `cm`、`s`、`Hz` 及
  `m s<sup>−2</sup>`；變量斜體，單位不可斜體；
- static 及 dynamic measurement／capture／review／result copy 保留語義 markup；
  dynamic 數值先驗證或 escape，再組成受控 DOM／HTML，不把富排版全部 flatten；
- SVG labels 及 ARIA 可用等價 plain text；不加入 MathJax 或其他 dependency。

## 8. Scoring

### 8.1 Compact contract

```text
Total: 100
Passing threshold: 60
Process evidence: 40
Quantitative measurements and ratios: 30
Physical laws: 30
Lowest score: 0
Highest score: 100
```

### 8.2 操作過程（40 分）

| 證據 | 分數 | 取得條件 |
|---|---:|---|
| 主動設定頻率並拍攝 | 4 | 由未設定狀態選擇合法頻率及生成相片 |
| 總位移：有效移尺及對準 | 8 | 達到最小移動量、零刻度及尺邊有效，並在該尺位至少確認一個讀數；純移動不取分 |
| 總位移：四個讀數連結有效尺位 | 4 | 每項 1 分 |
| 相鄰間隔：四次重新移尺、對準及記錄 | 24 | 每段 6 分 |

相鄰間隔每段的 6 分不可拆成靠「隨便移動」取得的部分；該段有效證據完整才得
6 分，否則 0 分。

### 8.3 過程 mastery gate

為落實「不能把尺放埋一邊再靠其他方法估計」：

```text
meaningfulRulerUse =
  valid total-displacement placement
  AND at least 3 of 4 total-displacement readings confirmed while that placement is valid
  AND at least 3 of 4 valid adjacent-interval placements
```

`valid total-displacement placement` 只有在至少一個總位移讀數於有效尺位確認後
才成立；隨便移尺、只對準但不讀數或只輸入理論值均不成立。若
`meaningfulRulerUse` 為 false：

```text
final score = min(raw score, 59)
```

即使理論答案全對，沒有跨兩類量度的足夠尺位證據亦不能達到合格。這是公開評分
規則，不是隱藏懲罰。若用戶希望操作只佔分但不設合格 gate，批准計劃時可移除此
cap；實作後不應再暗改。

### 8.4 定量數據及比例（30 分）

| 項目 | 分數 |
|---|---:|
| \(\Delta t=1/f\) | 4 |
| 四個總位移讀數 | 8（每項 2） |
| 四個相鄰間隔讀數 | 8（每項 2） |
| 累積時間比 | 2 |
| 總位移比 | 3 |
| 每段時間比 | 2 |
| 相鄰間隔距離比 | 3 |

數值正確但沒有尺位證據仍可取得讀數分；這種分離正是把「操作」及「答案」結合
而不重複計分。距離比例只在對應四個 learner readings 全部為正有限數時評分；
若首項被跳過、為零或無效，該距離比例 component 為 0，並顯示「沒有足夠量度
數據約化比例」，但其他 component 不倒扣。

若距離比例的四個 source readings 並非全部為正有限數，UI 不要求學生亂填比例，
而提供唯一 canonical resolved state：

```js
{ status: "insufficient-data" }
```

學生確認「量度數據不足，不能約化」後可繼續及提交，該 ratio component 為 0。
只有四個 source readings 全部正有限時，合法狀態才是：

```js
{ status: "answered", values: [1, term2, term3, term4] }
```

時間比例永遠使用 `answered`；`insufficient-data` 只適用於兩組距離比例，而且只在
其 source readings 確實不足時有效。

Term-wise allocation（保留 full precision，最後才 aggregate）：

```text
cumulative-time ratio:      3 editable terms × (2/3 point)
total-displacement ratio:   3 editable terms × 1 point
interval-time ratio:        3 editable terms × (2/3 point)
interval-distance ratio:    3 editable terms × 1 point
```

### 8.5 物理規律（30 分）

使用三條單選題，每題只有一個最佳答案：

1. 由起點量度的總位移與時間關係：\(s\propto t^2\)（12 分）；
2. 相等時間間隔內的位移規律：按連續奇數比增加（10 分）；
3. 原因解釋：自由落體加速度固定，所以速度在每段相等時間增加相同數值
   （8 分）。

不使用「全選所有敘述」可得分的多選設計。未答或選錯為 0 分，不倒扣其他項目。

### 8.6 Aggregation

- 每個 component 保留 full precision；
- 全部 component 相加後先 clamp 至 `0..100`；
- 再套用 `meaningfulRulerUse` cap；
- 最後四捨五入成整數；
- `passed = finalScore >= 60`；
- 重試、拖動次數、完成時間及輸入方式不扣分。

## 9. Tolerance

### 9.1 時間

```text
DELTA_T_ABS_TOLERANCE_S = 0.005 s
```

- 對稱、inclusive absolute tolerance：
  `abs(student - expected) <= DELTA_T_ABS_TOLERANCE_S`。
- `5 Hz` 理想值 `0.200 s`：
  - just inside：`0.2049 s`
  - exact boundary（接受）：`0.2050 s`
  - just outside：`0.2051 s`
- `6 Hz` 可接受合理四捨五入 `0.167 s`。

### 9.2 距離讀數

```text
distanceTolerance(expected) = max(0.03 m, 0.06 × expected) // canonical internal meters
```

- 對稱、inclusive absolute-or-relative tolerance：
  `abs(student - expected) <= distanceTolerance(expected)`。
- `5 Hz` 的 \(s_1=0.200 m\)（顯示 `20 cm`），容差
  `0.030 m`（顯示 `3 cm`）：
  - just inside：`22.9 cm`（canonical `0.229 m`）
  - exact boundary（接受）：`23 cm`（canonical `0.230 m`）
  - just outside：`23.01 cm`（canonical `0.2301 m`）
- `5 Hz` 的 \(s_4=3.200 m\)（顯示 `320 cm`），容差
  `0.192 m`（顯示 `19.2 cm`）：
  - just inside：`339.1 cm`
  - exact boundary（接受）：`339.2 cm`
  - just outside：`339.21 cm`
- 相鄰間隔使用各段自己的 expected value，不用總位移容差代替。
- 對非有限、負值、缺單位語義或大於 camera range 的值 fail closed／0 分。

### 9.3 比例

UI 及 canonical snapshot 的首項必須精確為數值 `1`，其餘三項為正有限數。時間比
與理想 target 比較；距離比按對應四個 learner readings 計算：

```text
empiricalTarget_i = reading_i / reading_1
```

scorer 不先把 empirical target 四捨五入。比較常數：

```text
RATIO_TERM_TOLERANCE = 0.15
```

- inclusive comparison：
  `abs(studentTerm - targetTerm) <= RATIO_TERM_TOLERANCE`。
- `[2,8,18,32]` 等首項不是精確 `1` 的 snapshot 必須 fail closed，不可只 normalize。
- 每個其餘 term 獨立得分，避免一個小失誤清空全組。
- 若 target term 為 `4.00`：
  - 第二項 `4.14` 在內；
  - 第二項 `4.15` 在 exact boundary，接受；
  - 第二項 `4.1501` 在外。
- 例如 `4 Hz` 的合法讀數 `0.30,1.25,2.80,5.00 m`，empirical target 約為
  `1:4.167:9.333:16.667`；學生忠實由讀數約化可得分。理想
  `1:4:9:16` 由概念題評核。
- 不接受負值、零 denominator、`NaN`、`Infinity`。

### 9.4 尺位

- `ZERO_ALIGNMENT_TOLERANCE_PX = 6 px`，inclusive；
- 尺邊距球列可見邊界 `6..44 px`，inclusive；
- 最小移動量 `0.025` stage diagonal，inclusive；
- exact/inside/outside 測試包括 zero error `5.99/6.00/6.01 px`、edge minimum
  `5.99/6.00/6.01 px`、edge maximum `43.99/44.00/44.01 px`，以及 normalized
  move `0.0249/0.0250/0.0251`；`0.0250` 精確門檻接受。

所有物理、量度及 scoring tolerance 集中在純函數模組，不散落 DOM handler。

## 10. Responsive layout contract

- Control-panel classification：`bounded split-panel`。
- 原因：學生需要反覆操作量度表及分析題，同時保持頻閃舞台及直尺可見。
- Phone stage track：
  - baseline `minmax(13rem, 46vh)`；
  - 支援時用 `46dvh`；
  - `320×500`／`390×500` 實測後可在不違反清晰量度的前提下微調。
- 上方：頻閃舞台及直尺。
- 下方：獨立 scrolling control panel。
- `html`、`body`、app shell 在 bounded iframe 無可用 vertical scroll range。
- shrinking grid／flex chain 全部需要 `min-height: 0`。
- panel 使用 `overflow-y: auto` 及 `overscroll-behavior: contain`。
- 不把舞台變成獨立 vertical scroller。
- 極矮 viewport／200% zoom：
  - CSS effective viewport `max-height: 32rem` 時，明確覆蓋 normal track 為
    `minmax(7rem, 38dvh) minmax(7rem, 1fr)`；
  - `max-height: 22rem` 時再覆蓋為
    `minmax(6rem, 34dvh) minmax(6rem, 1fr)`；
  - compact mode 縮短 app chrome、隱藏非必要長說明，但不隱藏題目、單位、
    active pair 或主要按鈕；
  - 縮短非必要說明；
  - 保留 \(P_0\)–\(P_4\)、尺邊及 active pair；
  - 透明 ruler overlay 只覆蓋可見尺身，不建立尺身以外的 invisible dead zone；
  - 所有主要行動在 panel 可到達；
  - 不以壓扁 panel 換取舞台高度。
- Tablet／desktop：
  - 舞台左側／上方為主；
  - panel 右側，約 `20rem..26rem`；
  - 增加空間但不加入手機沒有的必需操作。

## 11. Touch gesture ownership contract

### 11.1 Draggable target inventory

| Target type | Selector／hit-target | Pointer-capture target | Render 可在 drag 中替換？ |
|---|---|---|---:|
| 直尺 | 固定透明 HTML overlay，精確覆蓋可見 SVG 尺身 intersection；無另畫 handle 或放大鏡 | 同一 HTML ruler element | No |

球影、水平投影線、SVG labels 及舞台背景均不是 drag target。

### 11.2 Gesture ownership matrix

| Touch starts on | Expected owner | Expected scroll delta | Required pointer／state result |
|---|---|---|---|
| 已知非互動舞台空白 | enclosing page／Moodle host | host 非零且 iframe 同向移動；activity document、activity viewport、panel 為 0 | 不開始 drag，不改變 phase、答案、尺位或 evidence |
| independently scrolling control panel | control panel only | 有 range 時 panel 非零；host、host/activity viewport、activity document、iframe 為 0 | 舞台及 learner state 不變；panel 頂／底邊界亦不 chain 到 host |
| 直尺 HTML hit target | simulation | 所有 host/page/document/panel/viewport/iframe delta 為 0 | 直尺改變；收到 pointermove、pointerup；沒有 pointercancel；pointerup 後才可建立 placement evidence |

### 11.3 Technical decision

- Root stage blank region：`touch-action: pan-y`。
- Ruler HTML hit target：有效 `touch-action: none` 必須在 `pointerdown` 前存在。
- Panel：native vertical scrolling plus `overscroll-behavior: contain`。
- Activity document 不得成為第三 scroll owner。
- 不把舞台 gesture 轉送到 sibling panel。
- 若 iframe native topology 不能把空白舞台 swipe 交給 enclosing host：
  - 先改 topology；
  - 必要時只 forward 給同一 host owner 並驗證；
  - 未通過前不得 package-ready。
- 直接 standalone page 沒有 host scroll range 時，只可把 blank-stage 非零 host delta
  標為 N/A；Moodle-like iframe 測試不可使用此例外。
- SVG inner graphics 不作唯一 `touch-action: none` 邊界。
- Ruler capture element 在 drag 期間保持 mounted。
- `pointercancel` 清除 pointer capture／transient drag，不建立 evidence，並原子式
  把可見直尺回復至 drag 前最後一個 completed `activePlacement`；若之前沒有
  placement，回復停泊區。既有 phase、answers、evidence、focus 及 semantic
  placement 全部不變，並顯示非評分中斷提示。

### 11.4 Trusted touch evidence

development source 及 built/extracted SCORM 均在 scrollable Moodle-like iframe
用 browser-level trusted touch 驗證三列。每次記錄：

- host page scroll；
- host visual viewport；
- iframe rectangle；
- activity document scroll；
- activity visual viewport；
- panel scroll；
- ruler position；
- phase、active task、answers、evidence count；
- event `isTrusted`、pointer type、pointermove/up/cancel counts；
- browser engine／device。

Preview／capture 有 transient running clock；在這兩個 presentation 做 gesture
side-effect 測試時必須 pause／fake clock 或只比較權威 learner state 並按預期視覺
演進判斷。靜態量度期沒有 running clock。

## 12. Accessibility

- 所有核心操作支援 touch、mouse 及 keyboard。
- Ruler focus 後：
  - Arrow：細移；
  - Shift+Arrow：大移；
  - 「返回停泊區」按鈕不計作有效量度。
- Keyboard 造成的實際尺位變化與 pointer drag 同等計分；不以殘疾學生未用
  拖曳扣分。
- Ruler 有可讀名稱、目前零刻度對應位置及 active measurement 的簡潔描述。
- Ruler handle 使用原生 focusable button；可加
  `aria-roledescription="可移動直尺"`，並以 `aria-describedby` 連結方向鍵、
  Shift+方向鍵及直接拖動說明。Accessible name／description 必須包含 active
  measurement 及目前零刻度位置，不用不合適的單軸 slider role 表示二維移動。
- Ruler 及所有 panel controls 有清晰、非只靠顏色的 `:focus-visible` indicator。
  Arrow／Shift+Arrow、resize 及 rerender 後 focus 保留在原控制；不得跳回 body。
- 對準狀態透過文字及顏色／線形雙重表示。
- Touch targets 最少 `44×44 px`。
- 數值欄有可見 label、單位及錯誤訊息；不以 placeholder 代替 label。
- 比例使用語義化 group；screen reader 可讀為「總位移比，第 2 項」。
- `P₀`–`P₄` 同時有文字標籤，不只靠球影深淺。
- Moving ball 及 stamped images 不逐 frame announce；polite status 只報
  「正在拍攝」／新曝光點／「相片已完成」。不使用全舞台 flash，並按 §5.5 實作
  `prefers-reduced-motion` 的無計時等價路徑。
- Focus order 跟 panel 任務順序一致；返回舞台不造成 focus trap。
- 200% zoom 仍可完成所有核心操作。

## 13. Runtime responsibilities

### `model.js`

- 常數、頻率 validator；
- \(t_n,s_n,\Delta s_n\) 純函數；
- camera range 及米制幾何；
- 不接觸 DOM、SCORM 或 scoring。

### `scoring.js`

- 尺位 evidence validation；
- time、distance、ratio tolerance；
- 三部分 scorer；
- mastery gate、pass/fail、feedback classification；
- 不讀 DOM 或 saved score metadata。

### `persistence.js`

- draft/review encoder、decoder；
- phase matrix validation；
- canonical authoritative answer；
- size checks helpers；
- 不把 saved score 當權威。

### `animation.js`

- 小型 injected-clock controller，使用 model 的連續位置及精確 exposure schedule；
- 管理 preview／capture／static transient presentation、token cancellation、
  stale-callback rejection 及 reduced-motion immediate path；
- 不接觸 learner state、persistence、score 或 SCORM。

### `main.js`

- render、animation controller 接線、Pointer Events、keyboard ruler controls；
- phase transitions；
- semantic checkpoint；
- `SimScorm.loadAttempt()`／`SimActivityFlow.startup()`；
- `SimScorm.makeSnapshot()`／`setDraftProvider()`；
- `submitWithCallbacks()`／`SimActivityFlow.submission()`；
- 不直接呼叫 raw LMS API。

### `styles.css`

- bounded split-panel；
- stage、SVG ruler、transparent stable ruler overlay、control panel；
- responsive／zoom／reduced-motion；
- selective touch-action。

## 14. Authoritative operation evidence

不保存完整 pointer event log；SCORM 1.2 空間不適合歷史 telemetry。每個已確認
gap item 保存最後一份 canonical evidence：

```js
{
  mode: "pointer" | "keyboard",
  task: "gap01" | "gap12" | "gap23" | "gap34",
  moveNorm,        // movement after this task activation
  zeroErrorPx,
  edgeGapPx,
  readingM,        // confirmed finite reading; skipped task has no evidence object
  usedWhileValid   // validated together with raw metrics, never trusted alone
}
```

總位移使用一份 shared finalized placement，加每個 reading 自己的
`usedTotalPlacement` link：

```js
totalPlacement: {
  task: "total",
  mode,
  moveNorm,
  rulerZeroM,
  edgeSide,
  zeroErrorPx,
  edgeGapPx
}
```

它保留 `rulerZeroM` 及 `edgeSide`，因同一尺位需要連續供四個總位移讀數使用及在
reload／review-edit 重建。Gap evidence 不需要重建已完成尺位，所以不保存這兩項。

尚未確認讀數但已完成 pointerup／keyboard movement 的尺位是 draft semantic state，
不是計分 evidence。Draft 另外保存最多一個：

```js
activePlacement: {
  task,
  mode,
  moveNorm,
  rulerZeroM,
  edgeSide: "left" | "right",
  edgeGapPx,
  zeroErrorPx
}
```

Restore 由 `rulerZeroM`、`edgeSide` 及 `edgeGapPx` 重建相同尺位，讓學生仍可直接
讀數、再微調或跳過；不保存 DOM pixel transform。`activePlacement` 只可屬於目前
未解決 task。Gap reading confirmed／skip／離開 task 時原子式清除；
total-displacement reading confirmed 後則保留同一 active placement 給下一個 total
reading，直至離開 total phase。Review snapshot 及 submitted state 永不包含 active
placement。Candidate placement 可以未達有效
對準門檻；其 metrics 仍須 bounded，restore 後保留「未有效」狀態，只有符合全部
門檻才可在確認 reading 時產生 `usedWhileValid=true`。

規則：

- `usedWhileValid=true` 但 raw metrics 不符合門檻時 snapshot invalid；
- `task` 唯一，不容許 duplicate／unknown task；
- `readingM` 必須與對應 answer table 一致；
- evidence 不保存 viewport size、pointer ID、event timestamp 或 DOM ID；
- normalized movement 可跨 resize restore；completed evidence 不重播手勢，而 draft
  `activePlacement` 只重建靜止尺位，不重建 pointer capture；
- 修改該讀數時，若沒有新有效尺位，只保留舊 evidence 的歷史關聯會造成誤導，
  因此 atomically 清除該 item 的 `usedWhileValid`；重新有效量度才建立新 evidence；
- 總位移四個讀數可共用一個 valid total placement，但每個 reading 記錄自己是否在
  該 placement 仍有效時確認；
- 第一個 total reading 連結有效尺位後，該 total placement 及可見尺位保持不變供
  其餘 total readings；若學生選擇重新對準，先原子式清除四個
  `usedTotalPlacement` links，再建立新 placement，避免混合兩個尺位的 evidence；
- review 只顯示 evidence coverage，不重播假手勢。

這些證據在瀏覽器端仍可被竄改，所以只適用本文所定 low-risk boundary。

## 15. Phase/state matrix

| Phase | Variant／invariant | Current step | Required semantic state | Must be absent／pristine | Allowed next action |
|---|---|---:|---|---|---|
| `setup` | `new` | setup | supported versions；frequency null | trajectory、answers、evidence、result | choose frequency |
| `setup` | `configured` | setup | legal frequency；active-selection flag | trajectory、answers、evidence、result | generate photo or change frequency |
| `measure-total` | `normal-unpositioned` | 0–3 | legal frequency；trajectory；earlier total items resolved | active placement；future total；all interval/analysis/result fields | move ruler, enter placement-ready, or skip |
| `measure-total` | `normal-placement-ready` | 0–3 | matching bounded `activePlacement`（可有效或未有效）；earlier total items resolved | current reading/evidence；future total；interval/analysis/result | record, adjust placement, or skip |
| `measure-total` | `review-edit-unpositioned` | 0–3 | `returnToReview=true`；complete existing answer set may remain | active placement；result metadata | move ruler, replace/skip item, or return |
| `measure-total` | `review-edit-placement-ready` | 0–3 | `returnToReview=true`；matching bounded `activePlacement` | result metadata | record replacement, adjust, skip, or return |
| `measure-interval` | `normal-unpositioned` | 0–3 | all total resolved；earlier gaps resolved | active placement；future gaps；analysis/result | move ruler, enter placement-ready, or skip |
| `measure-interval` | `normal-placement-ready` | 0–3 | matching bounded `activePlacement`（可有效或未有效）；all total and earlier gaps resolved | current reading/evidence；future gaps；analysis/result | record, adjust placement, or skip |
| `measure-interval` | `review-edit-unpositioned` | 0–3 | `returnToReview=true`；complete prior data may remain | active placement；result metadata | move ruler, replace/skip item, or return |
| `measure-interval` | `review-edit-placement-ready` | 0–3 | `returnToReview=true`；matching bounded `activePlacement` | result metadata | record replacement, adjust, skip, or return |
| `analyze` | `normal` | analysis | all eight measurement items recorded/skipped；partial supported analysis answers | result metadata | answer, go back to measure, enter review when complete |
| `analyze` | `review-edit` | analysis | `returnToReview=true`；existing complete/partial answers valid | result metadata | revise or return to review |
| `review` | `incomplete` | review | valid frequency、trajectory；至少一個 measurement status 尚未 resolved，或 `deltaTS`／任一 ratio／concept answer 缺少 | result metadata | open missing item; no submit |
| `review` | `complete` | review | 八個 measurement status 均為 recorded 或 skipped；`deltaTS`、四組 ratio 及三個 concept answer 全部存在且 canonical；evidence subset valid | result metadata、active placement | edit or submit |
| `submitted` | `locked` | review | valid review answer sufficient to rescore/redraw | editable phase, active ruler, transient drag | inspect feedback only |

`recorded` 量度可以沒有 valid evidence；`skipped` 必須沒有 reading/evidence。
這是讓「答案但沒有操作」成為可提交、可扣操作分的合法狀態。

Transitions：

```text
setup/new -> setup/configured on legal active frequency selection
setup/configured -> measure-total/normal-unpositioned[0] on first accepted Generate;
  one draft checkpoint occurs immediately, while transient capture temporarily hides measurement UI
measure-*/normal-unpositioned -> measure-*/normal-placement-ready on completed pointerup/keyboard placement
measure-*/normal-placement-ready -> same placement-ready on further completed adjustment
measure-total/normal-placement-ready[i] -> measure-total/normal-placement-ready[i+1]
  on record or explicit skip, preserving the same total placement, for i < 3
measure-total/normal-unpositioned[i] -> measure-total/normal-unpositioned[i+1]
  on explicit skip, for i < 3
measure-total/normal-*[3] -> measure-interval/normal-unpositioned[0]
measure-interval/normal-*[i] -> measure-interval/normal-unpositioned[i+1]
measure-interval/normal-*[3] -> analyze/normal
analyze/normal -> review/incomplete at any explicit review navigation
analyze/normal -> review/complete when all required answer fields exist
review/* -> measure-total/review-edit-unpositioned[i] on edit total item
review/* -> measure-interval/review-edit-unpositioned[i] on edit gap item
review/* -> measure-total/review-edit-placement-ready[i] when a canonical finalized
  totalPlacement can be reconstructed for the chosen total item
review-edit-unpositioned -> review-edit-placement-ready on completed placement
review/* -> analyze/review-edit on edit analysis
review-edit/* -> review/complete|incomplete on explicit return
review/complete -> submitted/locked on success or committed outcome
any editable generated phase -> setup/configured only after confirmed frequency reset,
  atomically clearing all trajectory-dependent state
```

`frozen`、`load-error` 及 trust-mismatch 是 shared lifecycle UI locks，不新增 production
phase 名稱到 activity snapshot。

`preview`、`capturing` 及 `static` 是 presentation state，不是 snapshot phase。
Restore 任一 generated draft／review 直接取 `static`；不得把半完成 capture 變成
新的 persisted phase 或 continuation。

`skipped` 是 resolved-and-submittable zero-credit measurement status；只有 status 尚未
選定才是 unresolved。Review/incomplete 不得因存在 skipped item 而阻止提交。

## 16. Persistence contract

### 16.1 Draft snapshot semantics

Production 可使用 compact keys，但 decode 後語義必須等價：

```js
{
  v: 1,
  modelVersion: 1,
  rubricVersion: 1,
  phase,
  variant,
  currentStep,
  returnToReview,
  frequencyHz,
  frequencyActivelySelected,
  generated: true,
  activePlacement: { // optional; only in a *-placement-ready draft variant
    task,
    mode,
    moveNorm,
    rulerZeroM,
    edgeSide,
    edgeGapPx,
    zeroErrorPx
  },
  measurements: {
    total1: { status, readingM, usedTotalPlacement },
    total2: { status, readingM, usedTotalPlacement },
    total3: { status, readingM, usedTotalPlacement },
    total4: { status, readingM, usedTotalPlacement },
    gap01: { status, readingM },
    gap12: { status, readingM },
    gap23: { status, readingM },
    gap34: { status, readingM }
  },
  evidence: {
    setupCompleted,
    totalPlacement: {
      mode, moveNorm, rulerZeroM, edgeSide, zeroErrorPx, edgeGapPx
    },
    gap01: { mode, moveNorm, zeroErrorPx, edgeGapPx, readingM, usedWhileValid },
    gap12: { mode, moveNorm, zeroErrorPx, edgeGapPx, readingM, usedWhileValid },
    gap23: { mode, moveNorm, zeroErrorPx, edgeGapPx, readingM, usedWhileValid },
    gap34: { mode, moveNorm, zeroErrorPx, edgeGapPx, readingM, usedWhileValid }
  },
  analysis: {
    deltaTS,
    cumulativeTimeRatio,    // {status: "answered", values}
    totalDisplacementRatio, // {status, values?}
    intervalTimeRatio,      // {status: "answered", values}
    intervalDistanceRatio,  // {status, values?}
    lawAnswerId,
    intervalLawAnswerId,
    accelerationAnswerId
  }
}
```

不存在的 semantic field 應省略，不用空 object 冒充已存在。`setup` phases 不得有
`generated=true` 或任何 measurement／analysis data。

### 16.2 Review snapshot

```js
{
  v: 1,
  locked: 1,
  modelVersion: 1,
  rubricVersion: 1,
  frequencyHz,
  frequencyActivelySelected: true,
  measurements: { /* all eight resolved items */ },
  evidence: { /* canonical process evidence subset */ },
  analysis: { /* all authoritative answers */ }
}
```

Review snapshot 不保存：

- score、passed、feedback；
- SVG／DOM／Canvas pixels；
- camera pixel height；
- ruler current pixels 或 draft-only `activePlacement`；
- pointer ID、capture、hover、focus；
- correct distances／ratios；
- cached `meaningfulRulerUse`；
- button enabled state。

Restore：

```text
validate versions and canonical schema
→ recompute trajectory from frequency
→ validate measurement/evidence relationships
→ activity scorer
→ SimActivityFlow.reviewResult(computed, saved metadata, Moodle attempt)
```

### 16.3 Authoritative state

- model／rubric version；
- legal selected frequency and active selection evidence；
- phase、variant、current step、return-to-review；
- draft-only active placement 的 task、mode、normalized movement、米制零位、尺邊
  side／gap；
- eight measurement statuses and learner readings；
- canonical operation evidence raw metrics；
- learner time、ratio and concept answers。

### 16.4 Derived state rebuilt

- \(\Delta t,t_n,s_n,\Delta s_n\)；
- camera range and pixels；
- ruler ticks and parking geometry；
- draft active placement 對應的靜止 ruler transform；
- expected answers and tolerance；
- score、pass、mastery gate、feedback；
- current selected DOM row、CSS classes、buttons；
- placement valid indicator。

### 16.5 Transient state never persisted

- pointer ID／capture；
- drag start/current pixels；
- active key-repeat；
- preview／capture token、requestAnimationFrame ID、start／elapsed time；
- live-ball 位置、目前已顯示的 exposure index、capture／preview status；
- focus／hover；
- live-region queue；
- debounce timers。

### 16.6 Restore invariants

- supported `v/modelVersion/rubricVersion`；
- phase／variant／currentStep combination is renderable；
- frequency legal and absent only in setup/new；
- generated phases have legal frequency；
- normal linear phases cannot skip required earlier resolution or contain stale future data；
- review-edit may retain complete future data only with `returnToReview=true`；
- `*-placement-ready` 必須有唯一、matching current task 的 bounded active
  placement；它可未達 scoring validity，但 restore 後 validity 不變；
  `*-unpositioned`、analysis、review 及 submitted 必須沒有 active placement；
- each measurement status is `recorded` or `skipped` where required；
- skipped item has no reading/evidence/active placement；
- recorded reading is finite, non-negative and within supported camera range；
- evidence task keys are unique and known；
- `mode` is `pointer` or `keyboard`；
- 所有 evidence 及 active-placement metrics 無論 `usedWhileValid` true／false 均須
  finite and bounded；
- `usedWhileValid` implies metrics satisfy inclusive thresholds；
- gap evidence reading equals corresponding authoritative reading；
- total reading linked to placement only when total placement is valid；
- analysis enums and ratio states supported；`answered` array finite、長度 4、首項精確
  為 numeric `1`；`insufficient-data` 只可用於 source readings 不足的距離比例，
  且不得有 `values`；
- review complete／submitted 明確具有 `deltaTS`、四組 ratio、三個 concept answers
  及八個 resolved measurement statuses；
- score、passed 及 legal continuation survive round-trip；
- unsupported old versions fail closed unless an explicit tested migration is added；
- canonical re-encode produces one stable shape。

### 16.7 Size budget

- maximum draft shared envelope：`< 3000 UTF-8 bytes`；
- review shared envelope：`< 2400 bytes`；
- pending-final payload including escaped review JSON：`< 4000 bytes`；
- production-shaped maximum fixtures must assert actual UTF-8 size；
- 若超標，先壓縮 field names／evidence shape；不可刪除重算操作分所需語義。

### 16.8 Invalid snapshot policy

- Invalid editable draft：
  - 保持 technical lock；
  - 只有 shared runtime 能明確覆寫／清除並成功 commit 後，才建立乾淨 editable state；
  - 不自稱開了 Moodle 新 attempt。
- Pending-final：
  - decode、重算 model、validate evidence、rescore；
  - canonical answer及 result metadata 都相符才可 retry 同一 payload；
  - 深層 validation 失敗先 `SimScorm.quarantinePending()`，再 technical lock。
- Invalid finished review／finished attempt 帶 draft：
  - 維持 locked；
  - 只顯示可信 Moodle summary；
  - 不重新開放量度。
- Score／status mismatch：
  - Moodle record 優先；
  - 隱藏不可信詳細 component feedback。

### 16.9 Draft checkpoint policy

只在 semantic boundary 保存：

- 頻率選擇；
- 頻閃相片第一次合法生成（`Persistence.generate()` 後一次；preview frame、
  capture frame、每個 stamp 及 animation completion 都不另存）；
- pointerup／keyboard movement 完成後的尺位；
- 記錄／修改／跳過一個讀數；
- 完成一組 ratio／concept answer；
- 進入／離開 review；
- confirmed reset；
- lifecycle flush。

不在每個 pointermove commit。Draft provider 永遠回傳最近完整 semantic state；
completed pointerup／keyboard movement 保存 `activePlacement` 而不是計分 evidence；
active drag 在 lifecycle flush 時取消並恢復上一個完整 active placement。只有確認
reading 才把 matching placement atomically 轉成 finalized evidence；gap task 隨即
清除 active placement，total task 則保留同一 placement 給下一個 total reading。

## 17. Shared SCORM lifecycle

Startup：

| Outcome | Editable | 學生畫面 |
|---|---:|---|
| `review` | No | validate、rescore、locked review；失敗時安全 Moodle summary |
| `editable` | Yes | 新建／restore draft，register draft provider |
| `frozen` | No | 驗證同一 pending payload 後 retry；不聲稱已提交／有分 |
| `load-error` | No | technical lock；score 顯示 `--`，completion 未確定 |

Submission：

| Outcome | Editable | 學生畫面 |
|---|---:|---|
| `success` | No | 已提交 locked review |
| `committed` | No | 結果已 commit；finish retry；保持 locked |
| `frozen` | No | pending／未確認；凍結同一答案；不顯示 pass/fail claim |
| retryable `retry` | Yes | 保留答案，顯示可重試技術錯誤 |
| non-retryable `retry` | Depends on shared result | 不承諾可重試，不聲稱 submitted |

必須使用：

```js
SimScorm.loadAttempt()
SimActivityFlow.startup()
SimScorm.makeSnapshot()
SimScorm.setDraftProvider()
SimScorm.submitWithCallbacks()
SimActivityFlow.submission()
SimScorm.retryPending()
SimScorm.quarantinePending()
SimActivityFlow.reviewResult()
```

不加入 activity-local raw LMS、commit、finish、pagehide 或 BFCache lifecycle。

## 18. Test plan

### 18.1 Model

- \(s(t)=\tfrac12gt^2\) 的連續 preview／live-ball 位置及相等時間下遞增 displacement；
- 4／5／6 Hz 的 \(\Delta t,t_n,s_n,\Delta s_n\)；
- \(s\) 比為 `1:4:9:16`；
- gap 比為 `1:3:5:7`；
- 非法頻率、非有限值 fail closed；
- camera range 代表值；
- resize／不同 DPR 不改變物理值。

### 18.2 Scoring

- 滿分 evidence＋答案 = 100；
- 全部答案正確但無 evidence，raw answer 分正確，final cap = 59；
- valid total placement＋3 linked total readings＋3 gaps 通過 mastery gate；
- 少於 3 linked total readings，或少於 3 gaps，不通過 gate；
- 答案錯但操作正確保留 process 分；
- 尺有移動但 zero／edge 無效不取 process 分；
- pointer／keyboard evidence 等價；
- gap 必須在 active task 後重新移動；
- total placement 可連結四個 total readings；
- 記錄 total1 後可見／authoritative placement 保持，total2–total4 可直接讀取；
  每個中途 reload 都重建同一尺位及保持相同 legal continuation；
- total phase 重新對準先清除所有舊 `usedTotalPlacement` links，避免 evidence
  混用兩個尺位；
- 修改 reading 而沒有新量度時清除 evidence link；
- time、distance、ratio、zero alignment、edge min/max、movement threshold
  全部有 just-inside、exact inclusive boundary、just-outside；
- empirical distance ratios 接受由合法 rounded readings 算出的比例；
- 四組 ratio 按 `2/3,1,2/3,1` 每 term 的精確 partial credit；
- non-finite、負值、unsupported enums；
- score floor、ceiling、rounding、pass threshold。

### 18.3 Phase／persistence

- `setup/new`／`setup/configured` snapshot 不含 preview／replay progress；
- generated draft／review restore 直接為完整 static presentation，不保存
  capture progress；
- 每個 phase／variant production-shaped round-trip；
- `score(original) === score(restore(encode(original)))` 且
  `passed(original) === passed(restore(encode(original)))`；
- 每個 restore fixture 執行一個合法 continuation；
- 每個 total／gap 的 placement-ready variant restore 後可直接記錄、微調或跳過；
- normal phase stale future data rejection；
- review-edit retained future data acceptance；
- skipped／reading／evidence impossible combinations；
- missing prior resolution、invalid current step；
- duplicate／unknown evidence key；
- invalid raw evidence／active-placement metrics 在 `usedWhileValid=true` 及 false
  兩個分支均 fail closed；
- ratio first term 不等於 numeric `1`、array length／term 非法；
- 距離 ratio `insufficient-data` 只在 source readings 不足時接受；skip path 可用
  該 canonical resolved state 提交而不需亂填；有完整 readings 時拒絕該狀態；
- old version rejection；
- maximum draft／review／pending UTF-8 size；
- invalid editable、pending quarantine、invalid finished lock。

### 18.4 Lifecycle UI

- startup `review/editable/frozen/load-error`；
- submission `success/committed/frozen/retryable retry/non-retryable retry`；
- trusted review、score mismatch、status mismatch、unknown Moodle status；
- frozen pending-final：canonical answer 相同可 retry；不同 canonical answer 即使
  score／passed 完全相同亦 quarantine 及 technical lock；
- technical states不顯示「已提交／合格／不合格」；
- tests execute production render/outcome functions，不作 source-string assertions。

### 18.5 Interaction

- fake clock 驗證 preview 自動播放一次、物理加速、明確 replay 從起點重啟及不改
  learner state；
- 4／5／6 Hz capture schedule 精確為 \(n/f\)，P₀ immediate、五個 index 唯一且
  final position 精確取 Model；P₄ 後 live ball 移除；
- Generate 雙擊只有一次 semantic transition／checkpoint／sequence；
- cancel、visibility、reset、replay、resize、phase change 及 stale callback 不可
  加入舊 stamp 或改 phase／answers／evidence／score；
- reduced motion 沒有 motion／cadence timers，直接產生相同 static semantic result；
- restored generated draft／review 不重播 capture；
- 頻率由 unset 主動選擇；
- 改頻率 confirmation atomically 清除依賴資料；
- pointer drag 使用 relative offset，不令尺跳到手指中心；
- pointercancel 不建立 evidence，並驗證 visible ruler、active placement、phase、
  answers、evidence 及 focus 全部回復／保持 drag 前值；
- pointerup／keyboard movement 先建立可 restore active placement；確認 reading
  才建立 finalized evidence；
- 實際 mouse drag、trusted touch drag、Arrow／Shift+Arrow 完整完成；
- 實際 mouse 及 trusted touch 分別由可見尺身 top／middle／bottom／left edge／
  right edge 開始，全部命中同一 stable drag owner；pointercancel 回復先前位置；
- `20 cm -> 0.2 m`、`31.25 cm -> 0.3125 m`、空白／負值／NaN／Infinity invalid；
  restore、edit、review、locked result 只顯示 cm，而 canonical JSON、schema version、
  score 及 evidence 保持相同；
- HTML／CSS／DOM 全部沒有 magnifier；transparent overlay 沒有可見 handle glyph；
- `.nudge-grid`、`[data-nudge]` 及其 click binding 全部不存在；
- ruler capture target drag 中不被 render 替換；
- total placement 可以連續記錄四值；
- 每個 gap 需要新 movement；
- neutral alignment hint 不泄漏讀數；
- skip 路徑可完成並接受扣分；
- submitted state 全部 locked。

### 18.6 Layout／accessibility

- `320×500`、`390×500`、`390×600`、正常手機 portrait；
- phone landscape、browser toolbar、software keyboard、200% zoom；
- panel 可到真正底部，primary actions reachable；
- activity document 無 vertical range；
- no horizontal overflow；
- touch targets、focus order、labels、live region；
- phone、short viewport、desktop 及 200% zoom 全 keyboard traversal；
- ruler／panel controls 有 visible focus；Arrow／Shift+Arrow／resize／rerender 後 focus
  保留；assistive tree 可讀 ruler control semantics、active task、目前零位及操作說明；
- source 及 extracted package 在 setup 顯示可重播 preview，位移增量隨等時間增加；
- 4／5／6 Hz capture 依次顯示 P₀–P₄，時間在 browser scheduler tolerance 內，
  最後恰好五個靜態 labels、無 live ball，再顯示 ruler／measurement；
- reduced motion preview 靜態、capture 即時完成且沒有 timed movement／cadence；
- source 及 extracted package 在 `320×500`、`390×500`、`390×600`、
  `430×800`、`700×390` landscape 及 `390×600 @ 200%` 的完整矩陣驗證：
  full/visible ruler body、overlay 四邊 `<=1 px`、visible width `>=44 px`、一個 `cm`
  unit、5/10/50 cm hierarchy、兩端 margin、P0–P3 zero alignment、P1–P3 bottom clip、
  `elementFromPoint` 全尺身命中且沒有 invisible dead zone；
- 同一完整矩陣驗證 semantic `<var>/<sub>/<sup>`、computed sub/sup geometry 可見且
  不被所屬 copy block 裁切；學生距離 copy 不出現 meter unit，`m s^-2` 只作重力
  加速度單位且保持直立；
- production UI 以 real mouse 建立合法 placement，分別輸入 `20`、`31.25` 並按
  Record；canonical `readingM` 必須為 `0.2`、`0.3125`，encode/decode、evidence、
  restore/edit、review/result 及 score 不可發生第二次單位轉換；
- display normalization 覆蓋 `1.8 m → 180 cm`、`0.6 m → 60 cm`、
  `1.4 m → 140 cm`、`0.108 m → 10.8 cm`，source/package 不顯示 IEEE 長尾；
- setup preview、capture、static 全部通過 responsive／zoom、panel reachability 及
  no-third-scroll-owner；沒有 full-stage luminance flash。

### 18.7 Trusted touch matrix

在 development source 及 built/extracted package：

1. blank stage swipe 上下兩方向：
   - host 及 iframe 非零同向；
   - activity document、viewport、panel 零；
   - ruler、phase、answers、evidence 不變。
2. panel swipe：
   - panel 有 range 時非零；
   - host、iframe、documents、viewports 零；
   - panel top／bottom boundary 不 chain。
3. ruler drag：
   - ruler 改變；
   - 所有 scroll candidates 零；
   - trusted touch pointermove＋pointerup；
   - no pointercancel；
   - 合法 pointerup 只建立 active placement；確認 reading 才建立 evidence。

同一 source／package browser gate 另驗證 preview／capture 期間 stage swipe 及 panel
middle／top／bottom ownership；比較權威 state 時忽略或 fake 預期 transient visual
clock。Static 後另以實際 mouse drag、trusted touch drag、Arrow 及 Shift+Arrow
驗證直尺；moving ball／stamp 不得取得 gesture ownership。

### 18.8 Registration／package

- 新 tests 加入 `tools/run-tests.js`；
- metadata 加入 `sim/config.js`；
- manifest 及 ZIP root 明確包含 `config.js`，即使 activity `index.html` 不直接引用；
- manifest 包含每個 runtime dependency；
- tests／screenshots 不入 ZIP；
- ZIP root 有 `imsmanifest.xml`；
- source `src/href` 與 manifest 一致；
- built artifact browser smoke；
- `npm run check`；
- `npm test`；
- `npm run package:all`；
- `git diff --check origin/main...HEAD`。

### 18.9 Real Moodle gate

- student account，非 teacher preview；
- current-window player 完整流程及 trusted touch matrix；
- offered 時 new-window player 重複；
- draft resume；
- pending retry；
- completed attempt review-only；
- new attempt 才可改分；
- score/status 正確記錄；
- Moodle evidence 與 local evidence 分開記錄。

## 19. Acceptance criteria

### 19.1 教學

- 學生先看見一個連續加速下落的球，再看見同一球按所選 \(\Delta t\) 留下
  \(P_0\)–\(P_4\)，並清楚知道 preview 不產生數據；
- 學生清楚知道 \(P_0\) 是起點；
- 4／5／6 Hz 均顯示可量度 \(P_0\)–\(P_4\)；
- 能分辨累積時間、總位移、每段時間、每段距離四組比例；
- feedback 不混淆 `1:4:9:16` 與 `1:3:5:7`；
- 改相機比例不被誤解成改變運動。

### 19.2 操作評分

- 有效證據要求移尺、零位對準、尺邊鄰近及當下記錄；
- 隨便移一下、把尺放旁邊或只輸入理論值不能取得操作分；
- 同一物理操作的 pointer、mouse、keyboard 路徑等價；
- scorer 可由 review snapshot 重算全部 process points；
- 不保存冗長 event history；
- mastery gate 行為及 cap 有明確測試和學生可見說明。

### 19.3 技術

- preview／capture 全屬 token-guard transient；generated restore 靜態且 double
  activation 不重複 checkpoint；
- reduced motion 沒有 timed movement/cadence，但 state、相片、量度及 score 等價；
- 每個 saveable state round-trip 並可合法繼續；
- corrupt／pending／finished invalid state fail closed；
- shared lifecycle 四種 submission outcome 誠實呈現；
- bounded split-panel 及完整三區 gesture matrix 通過 source 和 package；
- package、manifest、registration、test runner 完整；
- low-risk browser trust boundary 清楚記錄。

## 20. 分階段實作順序

### Phase A：純 model、scorer、persistence

- 實作 \(t_n,s_n,\Delta s_n\)；
- 定義 evidence validator；
- 完成三部分 scorer、tolerance、mastery gate；
- 完成 phase decoder 及 round-trip／invalid tests。

### Phase B：舞台及直尺

- SVG 球列、camera calibration、尺刻度；
- stable HTML ruler target；
- pointer、keyboard、direct-ruler overlay geometry；
- neutral placement status。

### Phase C：學習流程

- setup、兩類量度、分析、review；
- skip／estimate path；
- frequency reset；
- feedback。

### Phase D：Persistence／SCORM

- shared snapshot and provider；
- startup／submission outcomes；
- frozen validation／quarantine；
- locked review。

### Phase E：Browser／package／Moodle

- responsive、accessibility、trusted touch；
- registration、manifest、test runner；
- source and package smoke；
- real Moodle student gate。

## 21. 需要用戶批准的主要決策

1. Slug 及學生標題是否合適：
   `free-fall-stroboscopic-measurement-lab`／「自由落體：頻閃量度實驗室」。
2. 是否接受第一版固定 \(g=10.0\ \text{m s}^{-2}\)。
3. 是否接受頻率選項 `4/5/6 Hz`，而非任意連續 slider。
4. 是否接受固定只分析 \(P_0\)–\(P_4\)，相機按頻率自動校準。
5. 是否接受不加隨機測量噪聲，只以讀尺及輸入容差保留實驗感。
6. 操作分佔 40%、數據 30%、規律 30% 是否合適。
7. 是否接受 meaningful ruler use gate：
   有效 total placement、最少三個有證據的總位移讀數及最少三個 gap placements，
   否則總分 cap 59。
8. 是否接受沒有有效尺位仍可輸入／提交，但只取得答案分，令操作評分真正可區分。
9. 是否接受兩組距離比例按學生實際讀數評核 approximate empirical ratio，而理想
   `1:4:9:16`／`1:3:5:7` 由概念題評核。
10. 是否接受 low-risk graded 分類；若要高風險考核，需另設 server-side trusted
   validation，不能只靠此 SCORM package。
