# 自由落體：頻閃量度實驗室

## 0. 文件狀態

- 文件角色：新 SimLab 活動的產品、教學、物理、量度操作、過程評分、持久化、
  SCORM、測試及 packaging 實作藍圖。
- Slug：`free-fall-stroboscopic-measurement-lab`
- 風險層級：T3（新模擬；同時涉及學科模型、操作評分、直接拖動、持久化及
  SCORM package）。
- Base ref：`main`；正式 review／implementation gate 使用
  `origin/main` 與 working tree 比較。
- 目前狀態：production activity；本次獲批 contract revision 升級 editable state 至
  snapshot `v4`／`rubricVersion:4`，`modelVersion:1` 保持不變。
- 語言：學生介面使用繁體中文；本文以繁體中文及必要英文識別字撰寫。
- 規格優先次序：本文件不得覆蓋
  `plans/00-shared-platform-and-style.md`、
  `docs/simulation-scorm-production-guide.md` 或 `AGENTS.md` 的共用契約。
- 本文件獲批後，物理模型、評分、量度證據、phase、snapshot schema、手勢責任
  及 acceptance gate 均以本文為基準；任何改變上述契約的修訂，先更新本文。

## 1. 目的與教學定位

本活動讓學生把自由落體的「公式」重新連結到可見、可量度的頻閃相片：

1. 系統在新 attempt 公平隨機指派並保存一個頻閃頻率；
2. 模擬生成由同一次自由落體形成的等時間間隔頻閃軌跡；
3. 學生把可移動直尺放到球旁邊，實際讀取總位移及相鄰間隔；
4. 學生整理時間比，並比較兩組距離系列；
5. 學生歸納：
   - 由靜止開始、加速度固定時，總位移 \(s\propto t^2\)；
   - 相等時間間隔內的位移比為連續奇數
     \(1:3:5:7:\ldots\)；
   - 以上現象是速度每一相等時間增加相同數值的結果。

核心學習證據不是「學生最後揀中答案」而已，而是完整證據鏈：

```text
保存隨機指派頻率
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
  - 分辨總位移、相鄰間隔、累積時間及每段時間的變化；
  - 由量度證據歸納 \(s\propto t^2\) 及
    \(\Delta s_1:\Delta s_2:\Delta s_3:\Delta s_4=1:3:5:7\)。
- Learner task：
  - 查看系統在新 attempt 一次性隨機指派的 `4 Hz`、`5 Hz` 或 `8 Hz`；
  - 按「拍攝頻閃相片」生成 \(P_0\)–\(P_4\)；
  - 把停泊在舞台側邊的直尺拖到球列旁；
  - 完成四個總位移讀數及四個相鄰間隔讀數；
  - 填寫 \(\Delta t\)、兩組時間比例及三條物理規律題；
  - 在提交前 review 檢查量度證據和答案，然後提交。
- Main interactions：
  - 拍攝前的連續自由落體示意及明確重播；
  - 已指派頻率 readout；
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

### 4.2 相機自動校準及相片尺換算

若所有頻率都使用固定 5 m 畫面，`6 Hz` 的第一段會在矮手機上過短。第一版因此
把頻閃相機視野校準至剛好容納 \(P_0\)–\(P_4\) 及底部留白。畫面旁明示：

> 相機已按今次軌跡調整視野；每次都要按直尺刻度讀取實際距離，不能比較像素。

改變相機比例只影響呈現，不改變物理量、scorer 或比例。畫面上的固定相片尺為
`0..5 cm`，不是把真實米數直接寫成厘米。明確 calibration 為：

```text
photoCm = meters × 5 / cameraMaxM
meters = photoCm × cameraMaxM / 5
```

內部 model、scorer、snapshot 的 `readingM`／`rulerZeroM` 仍一律使用米；
學生看見的直尺、舞台提示、review、結果、容差及錯誤訊息則使用「相片上距離」
厘米。學生手動輸入的相片厘米值在 Record 時只以
`photoCmToMeters()` 換算一次為權威米值；舞台上四捨五入至 `0.01 cm` 的提示
永不反向解析、永不寫入輸入欄。

### 4.3 理想模型，保留真實量度感

- 物理位置不加入隨機噪聲，讓比例規律可由理想數據成立。
- 學生讀尺及對準仍有有限精度，所以數值評分使用明確容差。
- UI 不顯示球的權威 \(s_n\) 米數；完成有效尺位後，舞台旁以 pointer-inert
  `<output>` 顯示由直尺 geometry 得出的相片讀數至 `0.01 cm`。
- 舞台 output 只是可見量度提示；只有學生手動輸入並按 Record 才建立答案。
  Record 不讀取或反向解析舞台 output。
- 提交後 review 才顯示理想值、學生值及差異。

### 4.4 手動答案與尺位證據互相獨立

活動不以 UI 硬鎖迫使每個學生完成有效尺位，否則「操作評分」會退化成入場條件。
每個 v3 新量度欄可手動輸入 `0..5 cm`（inclusive）或明確標記
「未能量度／跳過」。新 task 輸入為空白；review-edit 才預填該項先前已記錄的
相片厘米值。輸入中的未提交文字屬 transient，不保存。答案可以在沒有有效尺位時
記錄；若當下有 matching 有效尺位，才另外連結操作 evidence。v1 snapshot
已保存的 manual-without-evidence reading 經嚴格 migration 後仍可完成及取得既有
答案分，但不補造操作 evidence。這讓 scorer 能區分：

- 真正移尺量度後得到正確／不正確讀數；
- 答案正確但沒有尺位證據；
- 有移尺但擺位無效，而手動答案仍可 Record（不建立操作 evidence）；
- 完全跳過。

## 5. 物理及相機模型

### 5.1 常數及單位

```text
MODEL_VERSION = 1
g = 10.0 m/s²
initialVelocity = 0 m/s
initialDisplacement = 0 m
supportedFrequenciesHz = [4, 5, 6, 8]
assignableFrequenciesHz = [4, 5, 8]
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
| 8 Hz | 0.1250 s | 0.078125 m | 0.3125 m | 0.703125 m | 1.2500 m |

Model、scorer 及 snapshot 以米保留 full precision；學生畫面、相片尺、readout、
review 及 feedback 依 §4.2 calibration 顯示相片厘米。顯示最多保留兩個小數並移除
IEEE-754 尾數；不可用 rounded display value 重新評分。

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
- `8 Hz`：`cameraMaxM = 1.5 m`

直尺及球列共用 `yPx()`；resize 後由權威米制位置重畫，不把舊像素位置當答案。

### 5.5 隨機指派及頻閃生成

- genuinely new editable attempt 以 injected RNG 在 assignable `[4,5,8]` 作 unbiased index
  selection，恰好呼叫一次；指派結果先成為 v3 semantic state 並成功 draft
  checkpoint，之後才 enable「拍攝頻閃相片」。
- `Persistence.assignFrequency()` 是 fresh-assignment boundary，只接受 `[4,5,8]`；
  `assignedState()`、decode、restore 及 reset 才可接受 supported persisted `6 Hz`。
- `6 Hz` 是 supported persisted frequency，但不再由新 attempt 抽出。Model、scorer、
  decoder、reset、restore、review、finished、frozen 及 pending-final 全部必須保留並
  正確處理 `6 Hz`；這些路徑不得呼叫 RNG。Unsupported frequency 一律 fail closed。
- restore、render、submission retry、reset、preview replay 均不得呼叫 RNG 或
  reroll。Reset 清除量度／分析但保留同一 assigned frequency。
- 若第一次 assignment checkpoint 失敗，capture 保持 disabled 並進入誠實
  technical lock；不可用未持久化頻率開始活動。
- `setup/new`（只在 assignment 前短暫存在）及 `setup/assigned` 先顯示一個非互動
  實心球的連續自由落體示意：
  \(s=\tfrac12gt^2\)、\(0\le t\le1.00\text{ s}\)，使用固定 `0..5.5 m` 示意比例；
  \(t=1.00\text{ s}\) 時球位於 `5.00 m`。正常動態模式自動播放一次後停在終點，
  並一直提供「重播連續下落」。它不循環、不留下 \(P_0\)–\(P_4\)、不重選頻率、
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
  仍依 \(s=\tfrac12gt^2\) 連續移動。4／5／6／8 Hz 的最後曝光時間分別為
  `1.0000 s`、`0.8000 s`、約 `0.6667 s`、`0.5000 s`。
- Capture 可用非 flashing 本地狀態文字，但只說「已記錄 P₂」；setup、local
  assignment、capture status、stamp label 及 completion copy 不得顯示 numeric timestamp、
  exact \(\Delta t\) 或等價答案。內部 `timeS`／logical cadence 保持 full precision，
  只是不向學生顯示。禁止全舞台／全畫面明暗閃爍、白色 camera flash、
  背景 luminance animation 或反覆切換既有球影。
- \(P_4\) 完成後移除 live ball，只保留恰好五個靜態、標記
  \(P_0\)–\(P_4\) 的球影，然後才顯示直尺及量度 UI。完成文字為：
  「頻閃相片完成：五個球影來自同一個球，以相等時間間隔記錄；現在量度靜態相片。」
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
- 「重新開始」先確認會清除今次量度值及操作證據，但明示保留系統指派頻率。
- 確認後原子式清除讀數、比例答案、概念答案及 review 狀態，回到同一
  assigned-frequency setup。

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
- SVG 使用 uniform `xMidYMid meet` mapping；球影在所有 viewport/page-scale
  的 screen-space bounding box 保持近似圓形，不因舞台長寬比拉成橢圓。
- apparatus geometry 以同一 screen CTM 設可讀下限：球影直徑至少
  `18 CSS px`、`P₀`–`P₄` label 至少 `10 CSS px`、`0..5` ruler numeral 至少
  `16 CSS px`、尺內唯一 `cm` 至少 `18 CSS px` 且為粗體、主要 tick／body stroke 至少
  `1 CSS px`。這些下限透過 SVG user-unit 反換算達成，不改變 uniform CTM、
  viewBox、物理座標或 evidence CSS-pixel 定義；
- 相機繪圖 top margin 使用 `55 SVG user units`，為 ruler labels、起點球影及
  labels 留出互不重疊的空間；這只改呈現映射，不改物理或相片厘米 calibration；
- 每次曝光可顯示只包圍最新球影的 pointer-inert ring／camera cue；cue 不填滿、
  不改舞台 luminance、不接觸 learner state 或 checkpoint。Reduced motion 使用
  同位置的靜態局部 cue，不作 pulse animation。

Preview/live ball、曝光球影及最終球影均不是 draggable target，並使用
`pointer-events:none`；只有完成相片後的直尺可以移動。點選球影只可選擇量度
目標，不改變物理位置。

### 6.2 直尺

- 使用慣常相片尺：固定 `0..5 cm`，共 `51` 條刻線；每 `0.1 cm` 細刻度、
  每 `0.5 cm` 中刻度、每 `1 cm` 主刻度；標示 `0,1,2,3,4,5`，並只顯示一次
  直立、粗體 `cm`；
- `ruler.x` 永遠是固定右側 spine／零主刻度 anchor。尺身、全部 51 ticks 及
  `0..5` numerals 永遠向 anchor 左方伸展；跨過 guide／舞台中線不得 flip。
  `rulerSide` 只描述 anchor 所在 horizontal region，不再控制 draw direction；
- 每個 numeral screen-space 高度至少 `16 CSS px`。唯一 `cm` screen-space 高度至少
  `18 CSS px`，水平置於 full ruler body 中心，baseline 的權威 y 為
  `zeroY + tickSpan * 0.3 / 5`；numeral column 必須與這個 unit bbox 完全分離，
  不得用碰撞搜尋把它移到尺外或其他刻度；
- `ruler.y` 永遠代表零刻度 anchor，而不是尺身上緣；
- pointer 或 keyboard 將零刻度移至目前量度起點的 `6 CSS px` 範圍內，而且零主刻度
  segment 與該起點 guide 至少重疊 `4 CSS px` 時，production 把 `ruler.y` 精確吸附至
  該起點；只檢查目前 task 的 start guide，不吸附其他曝光點；
- 零刻度以上及最大刻度以下各保留 `12 SVG user units` 的尺身 end margin；
- full ruler body 可在零刻度對準 \(P_1\)–\(P_3\) 時自然超出並被舞台裁切；
  不可為了把整把尺塞進舞台而移動零刻度；
- 一個共用 geometry helper 由 zero anchor、固定 5 cm tick span、end margins、
  stage `getScreenCTM()`／inverse mapping
  算出 full body、與舞台相交的 visible body、dynamic visible width、measuring
  fixed right spine、leftward measuring edge 及 clamp；draw、position、hit/scoring geometry、restore 及 pointer/keyboard
  clamp 全部使用同一結果；
- SVG 使用 `preserveAspectRatio="xMidYMid meet"`；pointer client coordinates、
  HTML overlay、evidence CSS px、resize 及 restore 全部使用同一
  `getScreenCTM()`／inverse client↔SVG path。HTML overlay 與可見 SVG 尺身四邊
  在 CSS pixels 相差不超過 `1 px`；
- 固定、原生 focusable HTML button／pointer-capture target 透明覆蓋可見尺身
  intersection，寬度在 required viewport 及 200% zoom 至少 `44 CSS px`；
  fixed-right spine 必須先 clamp 至令 actual visible body intersection 至少 `44 CSS px`；
  owner 四邊與該 actual intersection 相差不超過 `1 px`，不得以越過 spine 的 phantom
  hit area 補足寬度。Overlay 不另畫 glyph、border、fill 或 rounded handle，學生直接拖動直尺本身；
- focus-visible outline 沿可見尺身顯示；尺身 top／middle／bottom／left edge／
  right edge 均須由 `elementFromPoint` 命中同一 drag owner；
- render SVG 球列或刻度時不得替換 HTML pointer-capture target；
- 不設局部放大鏡或其他跟隨手指的 ruler preview window。

### 6.3 量度任務

總位移模式：

1. 選擇「由 \(P_0\) 量起」；
2. 將直尺零刻度對準 \(P_0\)，讓零主刻度與 \(P_0\) 投影線重疊；
3. 讀取目前指定的 \(P_1\)–\(P_4\) 其中一項；
4. 每次記錄或跳過後，直尺自動返回左上角停泊區，下一項必須重新拖出並對準 \(P_0\)；
5. 系統只為該次在有效總位移尺位下輸入的讀數建立獨立操作證據。

相鄰間隔模式：

1. 依次選擇 \(P_0P_1\)、\(P_1P_2\)、\(P_2P_3\)、\(P_3P_4\)；
2. 每一段都把直尺零刻度重新對準較早的點；
3. 讀取較後一點對應刻度；
4. 系統要求本段被選中後曾實際移動直尺，才建立該段有效操作證據。

量度輸入是可編輯的手動相片厘米欄。新 task 必須空白；review-edit 預填該項
既有 reading 的相片厘米顯示值，並在 transient state 同時保留原 canonical
`readingM` 及 exact baseline text。若 Record 時文字與 baseline 完全相同，直接沿用
原 `readingM`；只有 learner 改變文字才重新解析及換算一次，避免純開啟／確認 edit
因顯示位數而改變 score／pass。移動直尺不改寫或清除學生輸入。Record 只接受可解析
為 finite、inclusive `0..5 cm` 的完整值，並以 `photoCmToMeters()` 轉換一次；
空白、非有限、負數及大於 `5` 均顯示錯誤。未提交輸入不進 snapshot。
Review-edit Record 必須把 transient `reusedOriginal` 明確傳入 persistence continuation。
只有該 flag 為 true、原 item 是 recorded，而且新 `readingM` 與原 canonical number
`Object.is` 相同時，才可把原 item 及其 total/gap process evidence bit-identically
保留並返回 review；這條路徑不得重新推導或清除 evidence。文字有任何改變時，即使
換算後接近原值，仍走一般 replacement：沒有新 matching valid placement 就清除該項
process link／gap evidence，有新 valid placement 才建立新 evidence。

合法 completed placement 會在舞台直尺旁的 pointer-inert `<output>` 顯示
「x.xx cm」，並只作一次 polite completion announcement；它不寫入 learner input。
output 位置跟隨尺身，horizontal bbox 留在舞台內。Readout visibility 只由目前 task、
當前 matching valid `activePlacement`、一致的 ruler geometry 及「沒有 active drag」
推導，不另設可 latch false 的 display-authorization state。Pointerdown 及 active drag
暫時隱藏 output；無效 completion、park、skip、task change、reset、review 或 technical
lock 均清除 stale output。Pointercancel 先保持 drag 期間的 suppression，再原子式回復
上一個 completed placement：若回復後仍是目前 task 的合法尺位，立即重現同一 readout；
否則保持清除。答案可在沒有 matching placement 時 Record；只有當下存在 matching
有效 placement 才另建 evidence。
Output 的 y anchor 必須由 full-precision canonical `readingM` 映射至直尺 measured
tick：`zeroY + tickSpan * readingM / cameraMaxM`，等價於目前 task 的 end tick；不得
以 `zeroY` 定位。Rounded `x.xx cm` 只作文字顯示，不得反向決定 y、auto-fill manual
input 或改寫答案。Output 優先放在 fixed spine／尺身右側，空間不足才 fallback，
horizontal candidates 均須檢查所有 ball stamps、P labels、ruler body/ticks、
numerals 及 unit bbox；先選無碰撞的 right，再選 body-left fallback，再掃描 stage 內其他
horizontal positions；若完全沒有無碰撞位置才選總 overlap area 最少者。Vertical center 始終保留上述 exact full-precision measured-y，
不得為 clamp 或碰撞避讓而改 y；output 保持 pointer-inert，每次 completion 只作一次 ARIA announcement。

### 6.4 有效尺位證據

有效總位移證據同時要求：

```text
frequency was randomly assigned and persisted
trajectory exists
ruler moved out of its parking state
movement since task activation >= MIN_MEANINGFUL_MOVE_NORM
ruler zero is within ZERO_ALIGNMENT_TOLERANCE_PX of P0
ruler zero major-tick segment overlaps the selected START guide horizontally
pointer/keyboard movement ended before the reading was recorded
```

每個有效相鄰間隔證據同時要求：

```text
the intended pair is active
ruler moved after that pair became active
movement >= MIN_MEANINGFUL_MOVE_NORM
ruler zero is aligned to the earlier point of that pair
ruler zero major-tick segment overlaps that pair's START guide horizontally
the reading is confirmed while this placement remains valid
```

初始常數：

```text
MIN_MEANINGFUL_MOVE_NORM = 0.025  // stage diagonal fraction
ZERO_ALIGNMENT_TOLERANCE_PX = 6
MIN_ZERO_TICK_OVERLAP_PX = 4
RULER_SNAP_TOLERANCE_PX = ZERO_ALIGNMENT_TOLERANCE_PX = 6
```

`MIN_MEANINGFUL_MOVE_NORM` 令不同 viewport 的「有移動」判斷一致；alignment 及
zero-tick／guide overlap 使用 CSS pixel，因為它們代表可見對準精度。水平投影線
固定由 SVG `x=80` 至 `x=285`，`pointer-events:none`，且所選 START guide 是
placement 的權威水平範圍。零主刻度 segment 與該 guide 的 screen-space horizontal
overlap 必須 inclusive `>=4 CSS px`；可沿 guide 任意位置，不設 `BALL_X` 鄰近條件。
吸附亦以 CSS pixel 判斷：只有垂直誤差 inclusive `<=6 CSS px` 且上述水平 overlap
成立時才吸附，吸附後 canonical `zeroErrorPx=0`。未進入吸附範圍、只接近非目前起點，
或沒有水平 overlap 時不得吸附或顯示舞台讀數。Pointer 的 meaningful movement 在同一
task 內跨完成手勢累積並 clamp 至 `1`，因此有效尺位後的細微校正不會把既有有效移動
歷史重設為零。真實 pointermove 或 keyboard nudge 一旦成功吸附，該吸附動作本身把
task-local `moveNorm` 提升至 `MIN_MEANINGFUL_MOVE_NORM`，因此放手／完成 nudge 後立即
建立有效 active placement 及顯示讀數；只有 pointerdown／pointerup 而沒有移動不得藉
吸附取得資格。task change／park／reset 仍重設該 movement。
若 \(P_0\) 上方的 ruler zero 對應輕微負
`rulerZeroM`，只要其 signed `zeroErrorPx` 與 CTM-derived pixels-per-metre 一致、
且在 inclusive `±6 CSS px` 內，persistence 必須接受；不得另以 `0 m` 下界推翻
scoring 的合法負側對準。所有常數集中定義並有正／負側邊界測試。

系統顯示中性對準狀態及量度值：

- 「直尺仍在停泊區」
- 「請把零刻度對準所選起點」
- 「直尺已靠近所選起點」
- 舞台 output：「x.xx cm」

不顯示「差 0.03 m」、正確讀數或是否會得分。

### 6.5 不以無關操作扣分

- 任意重試、拖動次數多、用時長、先放錯再修正均不扣分。
- Pointer（mouse／trusted touch）及 keyboard 是等價輸入。
- 只有最後提交中與每個量度項目關聯的最佳有效證據計分。
- 隨便把尺移動一下但未對準，不建立有效證據。
- v1 及 v2 manual reading 均可保留答案分；只有 matching 有效尺位建立操作 evidence。

## 7. 整體學習流程

```text
連續自由落體示意
→ 顯示已保存的隨機頻率
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
- 新 attempt 指派及成功保存頻率後 autoplay 一次不產生數據的連續下落示意，
  並提供明確重播。
- 簡短說明頻閃頻率是每秒拍攝次數。
- 畫面顯示今次獲派 `4/5/8 Hz`，並要求先預測「頻率愈高，相鄰影像時間是較短
  還是較長」；此預測不計分，提交後可比較。
- 按拍攝後先鎖定 conflicting setup actions，依所選 \(1/f\) 顯示一次 capture；
  \(P_4\) 完成及 live ball 移除後才出現量度表。Reduced motion 立即進入同一靜態
  結果。

### 7.2 量度

- 首次開啟總位移模式，提示零刻度要對準 \(P_0\)。
- 完成或跳過四個總位移項目後可進入相鄰間隔。
- 相鄰間隔按順序顯示四段；可回到較早項目重測。
- 每個距離項目均清楚標示「相片上距離」及單位 `cm`；時間仍用 `s`、頻率仍用
  `Hz`。
- 未填值不被當作 `0`。

### 7.3 分析

八項 measurement 均 recorded／skipped 後可進入分析。學生只填寫：

1. \(\Delta t=1/f\)；
2. 累積時間比 \(t_1:t_2:t_3:t_4\)；
3. 四段時間比；
4. 三條概念題。

兩組時間比例首項固定為 `1`，其餘三項可各自留白或填正有限數。總位移及相鄰
距離不再有 learner ratio input、handler、state、points 或 persistence field；分析頁改為
read-only semantic cards／lists，直接由 canonical full-precision meter readings 換算顯示
相片 `cm`：總位移列標示 P0→P1…P0→P4，間隔列標示 P0P1…P3P4，並顯示 colon series。
Skipped item 顯示「未量得」。這些 derived series 只作教學資訊，edit／restore 後即時
重算，不得被標成 learner correct／incorrect。提交前 copy 只可使用中性提示，例如
「比較兩組數值怎樣隨序號變化」；不得顯示、暗示或等價改寫任何 target ratio、law
或正確選項。Target comparisons 只可在 trusted result feedback 出現。

### 7.4 提交前 review

Review 顯示：

- 全域 validated frequency chip；
- 八個讀數；
- 每組量度旁只有「有尺位證據／未有尺位證據」，不顯示分數；
- 兩組 time-ratio 及三條 concept response 只顯示中性的完成／未完成狀態，不重播
  learner value 或任何 target-equivalent copy；
- 兩組 read-only derived distance series 只顯示 raw P-labelled measurement values；
- 「返回量度」、「返回分析」、「提交結果」。

返回量度或分析時保留其他答案及 `returnToReview`，修正後回到 review。
八個 measurements resolved 後 review 一律為 `ready`，即使所有 analysis fields 都是
null。若尚有 blank，第一次 Submit 只開 inline accessible warning：「N項未答，提交後
鎖定」，並明示未答得零分；warning 使用有 accessible name／description 的 inline
`alertdialog`（或等價 live modal pattern），提供「返回填寫」及「仍然提交」。第一次 action 不可呼叫 SCORM、建立 payload
或 lock；只有 explicit confirmation 才提交同一 canonical state。Nonblank 直接提交。
Double activation、focus restoration、retry 及 Escape/cancel（若提供）均不可繞過確認。

### 7.5 提交後 review

- 鎖定頻率、直尺、輸入及提交；
- 全域 validated frequency chip 在 trusted success、committed 及 finished result 保留；
- 顯示 responsive Traditional Chinese result cards，分組「操作」、「量度與時間」、
  「物理規律」；summary 顯示總分、pass 及 mastery cap 原因；
- 每個計分項以 icon + 文字顯示「正確／需修正／未作答／未有證據」，並列 learner
  answer、expected／tolerance、points／max 及 actionable guidance；不可只靠顏色；
- derived distance cards 明確標示資訊，不宣稱 learner correct；
- 以物理語言說明混淆，例如：
  - 「你找到了總位移平方比，但相鄰間隔應比較連續兩點之差。」
  - 「答案正確，但今次記錄未顯示直尺曾對準三個相鄰間隔。」
- 同一已完成 attempt 只供 review；重做需要 Moodle 新 attempt。

Frozen、retry、technical 或 unknown state 不顯示 confirmed correctness cards。若 Moodle
已有 validated authoritative score/status，trust mismatch 仍顯示該 recorded summary，但
不顯示 component correctness；只有完全沒有可信 Moodle summary 才顯示 `--`。
全域 frequency chip 只可取自 validated canonical draft/review/result；invalid／technical
unknown 不得猜 raw LMS field。Chip accessible name／text 為 `f = N Hz`，位於所有會 hide
的 phase section 外，涵蓋 editable、analysis、review、submitting、trusted result、
committed、frozen/retry 及 historical 6 Hz。

### 7.6 學生可見數學排版

- HTML learner copy 以語義 `<var>`、`<sub>`、`<sup>` 表示
  \(f,t,\Delta t,s,\Delta s,g,v,P_n,t_n,s_n,t^2\)；
- 單位使用直立文字，包括 `cm`、`s`、`Hz` 及
  `m s<sup>−2</sup>`；變量斜體，單位不可斜體；
- static 及 dynamic measurement／capture／review／result copy 保留語義 markup；
  dynamic 數值先驗證或 escape，再組成受控 DOM／HTML，不把富排版全部 flatten；
- operator、value、unit 之間用明確 whitespace／spacing wrapper；靜態及動態
  \(\Delta t\) 一律使用 rich `<span class="delta">Δ</span><var>t</var>`，
  令 delta 直立而量符號保持斜體；
- SVG labels 及 ARIA 可用等價 plain text，但 ARIA 必須保留
  `Δt = value s` 的 operator/value/unit spacing；不加入 MathJax 或其他 dependency。

## 8. Scoring

### 8.1 Compact contract

```text
Total: 100
Passing threshold: 60
Process evidence: 40
Quantitative measurements and time ratios: 30
Physical laws: 30
Lowest score: 0
Highest score: 100
```

### 8.2 操作過程（40 分）

| 證據 | 分數 | 取得條件 |
|---|---:|---|
| 學生主動拍攝 | 4 | 隨機頻率已保存，學生啟動 Generate 並生成相片；assignment 本身不取分 |
| 總位移：有效移尺及對準 | 8 | 達到最小移動量、零刻度及尺邊有效，並在該尺位至少確認一個讀數；純移動不取分 |
| 總位移：四個讀數連結有效尺位 | 4 | 每項 1 分 |
| 相鄰間隔：四次重新移尺、對準及記錄 | 24 | 每段 6 分 |

相鄰間隔每段的 6 分不可拆成靠「隨便移動」取得的部分；該段有效證據完整才得
6 分，否則 0 分。

### 8.3 過程 mastery gate

為落實「不能把尺放埋一邊再靠其他方法估計」：

```text
meaningfulRulerUse =
  at least one valid per-item total-displacement placement
  AND at least 3 of 4 total-displacement readings each linked to its own valid placement
  AND at least 3 of 4 valid adjacent-interval placements
```

每項 `valid total-displacement placement` 只有在同名總位移讀數於該次有效尺位確認後
才成立；每次記錄後直尺返回停泊區，下一項不得重用上一項尺位。隨便移尺、只對準
但不讀數或只輸入理論值均不成立。若
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
| 累積時間比 | 5（3 editable terms 各 `5/3`） |
| 每段時間比 | 5（3 editable terms 各 `5/3`） |

數值正確但沒有尺位證據仍可取得 reading points；process points 獨立。兩組 time ratio
的三個 editable terms 各自評分：blank 0、incorrect 0、correct `5/3`，互不 gate。
Derived distance series 完全 informational，不進 scorer。

### 8.5 物理規律（30 分）

使用三條單選題，每題只有一個最佳答案：

1. 由起點量度的總位移與時間關係：\(s\propto t^2\)（12 分）；
2. 相等時間間隔內的位移規律：按連續奇數比增加（10 分）；
3. 原因解釋：自由落體加速度固定，所以速度在每段相等時間增加相同數值
   （8 分）。

三題各自於每次活動載入時隨機排列三個選項；洗牌只改 DOM 顯示次序，canonical
answer ID、草稿回復及評分規則不變，而且不得保留 authored 原始次序。未答或選錯
為 0 分，不倒扣其他項目。不使用「全選所有敘述」可得分的多選設計。

### 8.6 Aggregation

- 每個 component 保留 full precision；
- 全部 component 相加後先 clamp 至 `0..100`；
- 再套用 `meaningfulRulerUse` cap；
- 最後四捨五入成整數；
- `passed = finalScore >= 60`；
- 重試、拖動次數、完成時間及輸入方式不扣分。

Rubric4 `detail` 對每個計分 item 提供 stable production shape：`status`（`correct`／
`incorrect`／`unanswered`／`no-evidence`）、`learner`、`expected`、`guidance`、`points`、
`max`。所有 item points reconciliation 必須等於 raw score；cap 後另列 cap explanation。
Legacy immutable v1/v2 final／finished／frozen 由 rubric2 dispatcher、v3 由 rubric3
dispatcher 重算／顯示原 recorded score/pass；editable v1–v3 migration 則轉 rubric4。

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
- `5 Hz` 的 \(s_1=0.200 m\) 對應相片約 `0.29 cm`；canonical 容差
  `0.030 m` 對應相片約 `0.04 cm`。Boundary test 先在米制執行，再驗證
  photo calibration 顯示，不以 `0.01 cm` readout rounding 改寫 inclusive 判斷。
- `5 Hz` 的 \(s_4=3.200 m\) 對應相片約 `4.57 cm`；canonical 容差
  `0.192 m` 對應相片約 `0.27 cm`。
- 相鄰間隔使用各段自己的 expected value，不用總位移容差代替。
- 對非有限、負值、缺單位語義或大於 camera range 的值 fail closed／0 分。

### 9.3 比例

現行 `rubricVersion: 4` 只有 `cumulativeTimeRatio` 與 `intervalTimeRatio` 兩組
可編輯比例。每組 canonical snapshot 都是四項陣列：首項必須精確為數值 `1`，
其餘三項各自為 `null` 或正有限數。每個可編輯 term 獨立與理想 target 比較，
每項滿分 `5/3`；留空獨立得 `0` 分，不設整組 all-or-nothing gate。比較常數：

```text
RATIO_TERM_TOLERANCE = 0.15
```

- inclusive comparison：
  `abs(studentTerm - targetTerm) <= RATIO_TERM_TOLERANCE`。
- `[2,8,18,32]` 等首項不是精確 `1` 的 snapshot 必須 fail closed，不可只 normalize。
- 累積時間 target 為 `1:2:3:4`；每段時間 target 為 `1:1:1:1`。
- 若 target term 為 `4.00`，`4.14` 在內、`4.15` 在 exact boundary 接受，
  `4.1501` 在外。
- `null` 以外不接受負值、零、`NaN` 或 `Infinity`。

總位移與相鄰間隔系列是由八項量度衍生的唯讀資料展示，不是分析答案欄位，
沒有自己的 input、change handler、snapshot 欄位或 ratio 分數。

只有 immutable legacy `rubricVersion: 2` review 可保留舊
`totalDisplacementRatio`／`intervalDistanceRatio` 與 empirical scorer，目的只是在
已完成 attempt 回看時保存原來分數；它們不得出現在現行 UI、editable schema 或
`rubricVersion: 4` scorer。Immutable `rubricVersion: 3` finished／frozen review 仍由
原 rubric3 scorer 重算而不改 bytes。

### 9.4 尺位

- transient PARK 由目前舞台 CTM 及 ruler geometry 動態重建：先 probe 當前
  `bodyWidth`／`headerMargin`，把 fixed-right anchor 設於 `bodyWidth`，並把零刻度設於
  至少 `headerMargin`，且位於 P0 下方超過 `6 CSS px`。因此 full ruler 的左／上緣在
  數學上可行時均不小於 `0`，透明 owner 與可見尺身完全留在 grid 內；只有當 full
  ruler 本身高於舞台時才容許不可避免的下緣裁切。PARK 在 initial／record／skip／
  unpositioned restore／unpositioned resize 均重新計算，不保存為
  `activePlacement`，不顯示 readout，也絕不構成 valid P0 alignment；
- `ZERO_ALIGNMENT_TOLERANCE_PX = 6 px`，inclusive；
- 零主刻度 segment 與 selected START guide 的水平重疊
  `zeroTickOverlapPx >= 4 px`，inclusive；投影線固定 `x=80..285`，可沿線任意位置；
- 最小移動量 `0.025` stage diagonal，inclusive；
- exact/inside/outside 測試包括 zero error `5.99/6.00/6.01 px`、overlap
  `3.99/4.00/4.01 px`，far-left／far-right exact boundary，以及 normalized
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
- 空白錯誤訊息不佔 layout 高度；只有 validation message 存在時才展開。
- final result 顯示後，panel 回到最頂並把結果標題置焦，讓分數立即可見。
- 每個 phase 把 primary／secondary actions 放在語義 action group；destructive
  reset 另成一列，與前一 action group 的 computed vertical gap 在所有 breakpoint
  （包括 `320 px` 寬）至少 `12 px`。按鈕文字只顯示「重新開始」，確認訊息說明會
  保留隨機指派頻率。
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
  placement 全部不變，並顯示非評分中斷提示。回復後 readout 重新由目前合法尺位
  推導：合法尺位重現 cancel 前同一文字，無效／unpositioned 尺位保持隱藏。

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
  - 記錄或跳過後自動返回停泊區；不另設手動返回停泊區按鈕。
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
- 兩組 time ratio 使用語義化 group；screen reader 可讀為「累積時間比，第 2 項」。
- `P₀`–`P₄` 同時有文字標籤，不只靠球影深淺。
- Moving ball 及 stamped images 不逐 frame announce；polite status 只報
  「正在拍攝」／新曝光點／「相片已完成」。不使用全舞台 flash，並按 §5.5 實作
  `prefers-reduced-motion` 的無計時等價路徑。
- Focus order 跟 panel 任務順序一致；返回舞台不造成 focus trap。
- Review edit measurement／analysis 後把 focus 交到目的 section 的 `tabindex="-1"`
  heading；不得落在 hidden review button 或 body。Blank-submit warning 使用可命名
  inline region/dialog semantics，Return 後 focus 恢復到 Submit 或對應 edit control。
- Result card status 同時使用 icon 及繁體中文文字；forced-colors 下保留 border、focus、
  grouping 及 status label。Cards 不建立 nested scroll，維持 bounded split-panel 及既有
  touch ownership matrix。
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
  zeroTickOverlapPx, // current-CTM audit metric, never trusted after CTM change
  rulerX,            // current-CTM cache; restore does not treat it as authoritative
  rulerSide: "left" | "right",
  rulerGeometry: "fixed-left-v1",
  horizontalMode: "guide-fraction" | "left-boundary" | "right-boundary",
  guideFraction,     // only for guide-fraction; 0..1
  boundaryOverlapPx,// only for boundary modes; fixed CSS-pixel relation
  readingM,        // confirmed finite reading; skipped task has no evidence object
  usedWhileValid   // validated together with raw metrics, never trusted alone
}
```

總位移每項使用自己的 compact finalized placement；`total1`–`total4` evidence key
本身就是 task identity，reading 由同名 measurement authoritative item 連結：

```js
total1: { // total2/total3/total4 同形
  mode,
  moveNorm,
  horizontalMode,
  guideFraction,      // horizontalMode=guide-fraction only
  boundaryOverlapPx,  // boundary mode only
  zeroErrorPx
}
```

每項 evidence 只保留重算該項操作分所需的 mode、movement、zero alignment 及 stable
horizontal relation；guide fraction 可推導 anchor／side，boundary mode 連同 overlap 可推導
side 及有效重疊，故不得另信任獨立 raw `rulerX`／`zeroTickOverlapPx`。已完成 evidence 不重建成 active ruler。四項 evidence 彼此獨立，
新 placement、record 或 skip 不得修改其他三項。
Gap evidence 亦保存同一 stable horizontal anchor／side，讓
raw overlap evidence 可審核，但已完成 gap 不用重建為 active ruler。

尚未確認讀數但已完成 pointerup／keyboard movement 的尺位是 draft semantic state，
不是計分 evidence。Draft 另外保存最多一個：

```js
activePlacement: {
  task,
  mode,
  moveNorm,
  rulerZeroM,
  rulerX,
  rulerSide: "left" | "right",
  rulerGeometry: "fixed-left-v1",
  horizontalMode,
  guideFraction,      // horizontalMode=guide-fraction only
  boundaryOverlapPx,  // boundary mode only
  zeroTickOverlapPx,
  zeroErrorPx
}
```

Restore／resize 由 selected guide、stable `horizontalMode`、fraction／boundary
overlap、`rulerSide` 及目前 CTM 重建尺位，並原子式 canonicalize current
`rulerX`、`rulerZeroM` 及 raw bounded `zeroTickOverlapPx`；不得信任舊 CTM 的 raw
CSS overlap，亦不得把舊 edge gap 解釋成 overlap。Canonicalization 不建立 reading、
evidence 或分數，也不因 resize commit；draft provider 只提供最新 in-memory state。
Record 再以目前可見尺位呼叫 `placementFromRuler()` 並 refresh active placement，
只有目前 task／geometry 仍有效才建立 evidence，舊 valid metric 不可取得分數。
Current v4 active-placement／gap horizontal fields 必須作 fail-closed cross-field canonical validation；
compact total evidence 只接受帶 stable horizontal relation 的 exact current shape，或 exact legacy compact shape：

- 新 production placement／evidence 必須帶 discriminator
  `rulerGeometry="fixed-left-v1"`，表示 right spine 固定、ticks 向左。沒有 discriminator
  的既有 v2 current shape 是 historical bidirectional schema，仍按原 side-dependent
  semantics 驗證，以保持 finalized evidence／review／finished／frozen score 不變；
  decoder 不可替 finalized historical evidence補 discriminator或重解 geometry。
- Editable historical active placement restore 時可由 stable guide relation 直接重建為
  fixed-left drawing，再原子式 canonicalize 成帶 discriminator 的新 active shape；這
  不建立 reading、evidence、checkpoint 或分數。Undiscriminated historical left-side
  guide placement 的 persisted `rulerX` 是舊 rightward tick 的左端；restore 必須以目前
  `screenCTM` 換算 `23 CSS px` 並取舊 tick segment 右端作新 fixed-right spine；boundary
  relation 同樣重建該 right endpoint，不可 hardcode SVG user units。Unknown discriminator、只帶部分新
  schema fields、current／legacy 混合均 fail closed；

- 零主刻度的 screen-space 長度為 `23 CSS px`，cross-field tolerance 固定為
  `0.01 px`；
- `left-boundary`／`right-boundary` 的 `boundaryOverlapPx` 與
  `zeroTickOverlapPx` 均須 finite、在 `0..23`，而且兩者差的絕對值不得超過
  `0.01 px`；mode 必須與 `rulerSide` 一致，且不得同時帶有 `guideFraction`；
- `guide-fraction` 只可帶 finite `guideFraction` `0..1`，不得帶有
  `boundaryOverlapPx`；`rulerX` 必須在 `0.01` 內等於
  `GUIDE_X1 + guideFraction * (GUIDE_X2 - GUIDE_X1)`，`rulerSide` 必須與該
  canonical anchor 一致，而完整零主刻度 overlap 必須在 `0.01 px` 內等於
  `23 CSS px`；
- 以上規則同時套用 active placement、draft／review decode、pending-final
  canonical validation 及 scorer。即使 answer 是手工構造、沒有經 decoder，
  矛盾 fields 亦不得建立 process link 或 meaningful-ruler-use。
- Current family（`rulerX`、`rulerSide`、`rulerGeometry`、`horizontalMode`、
  `guideFraction`／`boundaryOverlapPx`、`zeroTickOverlapPx`）與 legacy family
  （`legacyEdgeSide`、`legacyEdgeGapPx`）互斥。只要出現任何 current field，就必須
  通過完整 current canonical relation，且不得 fallback 至 legacy；只要出現任何
  legacy field，就必須是完整純 legacy shape，且不得帶任何 current field。混合、
  不完整 current 加合法 legacy、或矛盾 current 加合法 legacy 均在 draft、review、
  pending-final 及直接 scorer fail closed。

例如 `boundaryOverlapPx=0` 但 `zeroTickOverlapPx=4` 必須在所有路徑拒絕，
不可因其中一個欄位單獨達到計分門檻而取得操作分。Tolerance 只容納同一當刻
screen geometry 的浮點誤差；跨 CTM 必須先重建再 canonicalize，不可以 tolerance
接受舊 CTM raw value。
這讓學生仍可直接
讀數、再微調或跳過；不保存 DOM pixel transform。`activePlacement` 只可屬於目前
未解決的 exact item key（`total1`–`total4` 或 gap key）。任何 total／gap record 或
skip 都原子式清除 active placement、舞台讀數及 task-local movement，下一項必須由
upper-left PARK 重新 drag／nudge。Review snapshot 及 submitted state 永不包含 active
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
- 每個總位移讀數只有在自己的 exact-item active placement 有效時才建立同名 evidence；
  手動 record／invalid placement／skip 只刪除目前 item evidence；
- `withPlacement()` 只建立／替換 transient active placement，永不修改任何 finalized
  evidence；review-edit unchanged path 保留原 item、evidence、score/pass bit-identically；
- review 只顯示 evidence coverage，不重播假手勢。

這些證據在瀏覽器端仍可被竄改，所以只適用本文所定 low-risk boundary。

## 15. Phase/state matrix

| Phase | Variant／invariant | Current step | Required semantic state | Must be absent／pristine | Allowed next action |
|---|---|---:|---|---|---|
| `setup` | `new` | setup | canonical v4；frequency null；只可在 genuinely new attempt assignment checkpoint 前短暫存在 | trajectory、answers、evidence、result、enabled capture | inject RNG once, assign and checkpoint |
| `setup` | `assigned` | setup | legal persisted frequency；`frequencyAssigned=true` | trajectory、answers、evidence、result | learner-initiated capture |
| `measure-total` | `normal-unpositioned` | 0–3 | legal frequency；trajectory；earlier total items resolved | active placement；future total；all interval/analysis/result fields | move ruler, enter placement-ready, or skip |
| `measure-total` | `normal-placement-ready` | 0–3 | matching bounded `activePlacement`（可有效或未有效）；earlier total items resolved | current reading/evidence；future total；interval/analysis/result | record, adjust placement, or skip |
| `measure-total` | `review-edit-unpositioned` | 0–3 | `returnToReview=true`；complete existing answer set may remain | active placement；result metadata | move ruler, replace/skip item, or return |
| `measure-total` | `review-edit-placement-ready` | 0–3 | `returnToReview=true`；matching bounded `activePlacement` | result metadata | record replacement, adjust, skip, or return |
| `measure-interval` | `normal-unpositioned` | 0–3 | all total resolved；earlier gaps resolved | active placement；future gaps；analysis/result | move ruler, enter placement-ready, or skip |
| `measure-interval` | `normal-placement-ready` | 0–3 | matching bounded `activePlacement`（可有效或未有效）；all total and earlier gaps resolved | current reading/evidence；future gaps；analysis/result | record, adjust placement, or skip |
| `measure-interval` | `review-edit-unpositioned` | 0–3 | `returnToReview=true`；complete prior data may remain | active placement；result metadata | move ruler, replace/skip item, or return |
| `measure-interval` | `review-edit-placement-ready` | 0–3 | `returnToReview=true`；matching bounded `activePlacement` | result metadata | record replacement, adjust, skip, or return |
| `analyze` | `normal` | analysis | all eight measurement items recorded/skipped；v4 analysis all-null、partial、wrong 或 correct 均 legal | result metadata | answer, go back to measure, enter ready review |
| `analyze` | `review-edit` | analysis | `returnToReview=true`；existing all-null／partial answers valid | result metadata | revise or return to ready review |
| `review` | `ready` | review | 八個 measurement status 均為 recorded 或 skipped；exact v4 analysis shape（每個 answer 可 null）；evidence subset valid | result metadata、active placement | edit；nonblank direct submit；blank confirmation then submit |
| `submitted` | `locked` | review | valid review answer sufficient to rescore/redraw | editable phase, active ruler, transient drag | inspect feedback only |

`recorded` 量度可以沒有 valid evidence；`skipped` 必須沒有 reading/evidence。
這是讓「答案但沒有操作」成為可提交、可扣操作分的合法狀態。

Transitions：

```text
setup/new -> setup/assigned on injected unbiased assignment plus successful draft checkpoint
setup/assigned -> measure-total/normal-unpositioned[0] on first accepted Generate;
  one draft checkpoint occurs immediately, while transient capture temporarily hides measurement UI
measure-*/normal-unpositioned -> measure-*/normal-placement-ready on completed pointerup/keyboard placement
measure-*/normal-placement-ready -> same placement-ready on further completed adjustment
measure-total/normal-placement-ready[i] -> measure-total/normal-unpositioned[i+1]
  on record or explicit skip, clearing active placement and parking, for i < 3
measure-total/normal-unpositioned[i] -> measure-total/normal-unpositioned[i+1]
  on explicit skip, for i < 3
measure-total/normal-*[3] -> measure-interval/normal-unpositioned[0]
measure-interval/normal-*[i] -> measure-interval/normal-unpositioned[i+1]
measure-interval/normal-*[3] -> analyze/normal
analyze/normal -> review/ready at explicit review navigation after all measurements resolve
review/* -> measure-total/review-edit-unpositioned[i] on edit total item
review/* -> measure-interval/review-edit-unpositioned[i] on edit gap item
review-edit-unpositioned -> review-edit-placement-ready on completed placement
review/* -> analyze/review-edit on edit analysis
review-edit/* -> review/ready on explicit return
review/ready -> inline blank warning with zero SCORM calls when any answer item is null
review/ready -> submitted/locked only on nonblank direct submit or explicit still-submit confirmation
any editable generated phase -> setup/assigned only after confirmed reset,
  atomically clearing all trajectory-dependent state while preserving assigned frequency
```

`frozen`、`load-error` 及 trust-mismatch 是 shared lifecycle UI locks，不新增 production
phase 名稱到 activity snapshot。

`preview`、`capturing` 及 `static` 是 presentation state，不是 snapshot phase。
Restore 任一 generated draft／review 直接取 `static`；不得把半完成 capture 變成
新的 persisted phase 或 continuation。

`skipped` 是 resolved-and-submittable zero-credit measurement status；只有 status 尚未
選定才是 unresolved。Analysis null 是合法 unanswered，不會令 review 變成 incomplete。

## 16. Persistence contract

### 16.1 Draft snapshot semantics

Production 可使用 compact keys，但 decode 後語義必須等價：

```js
{
  v: 4,
  modelVersion: 1,
  rubricVersion: 4,
  phase,
  variant,
  currentStep,
  returnToReview,
  frequencyHz,
  frequencyAssigned,
  generated: true,
  activePlacement: { // optional; only in a *-placement-ready draft variant
    task,
    mode,
    moveNorm,
    rulerZeroM,
    rulerX,
    rulerSide,
    horizontalMode,
    guideFraction,      // conditional
    boundaryOverlapPx,  // conditional
    zeroTickOverlapPx,
    zeroErrorPx
  },
  measurements: {
    total1: { status, readingM },
    total2: { status, readingM },
    total3: { status, readingM },
    total4: { status, readingM },
    gap01: { status, readingM },
    gap12: { status, readingM },
    gap23: { status, readingM },
    gap34: { status, readingM }
  },
  evidence: {
    setupCompleted,
    total1: { mode, moveNorm, zeroErrorPx, horizontalMode, guideFraction },
    total2: { /* same compact finalized shape */ },
    total3: { /* same compact finalized shape */ },
    total4: { /* same compact finalized shape */ },
    gap01: { mode, moveNorm, rulerX, rulerSide, zeroErrorPx, zeroTickOverlapPx, readingM, usedWhileValid },
    gap12: { mode, moveNorm, rulerX, rulerSide, zeroErrorPx, zeroTickOverlapPx, readingM, usedWhileValid },
    gap23: { mode, moveNorm, rulerX, rulerSide, zeroErrorPx, zeroTickOverlapPx, readingM, usedWhileValid },
    gap34: { mode, moveNorm, rulerX, rulerSide, zeroErrorPx, zeroTickOverlapPx, readingM, usedWhileValid }
  },
  analysis: {
    deltaTS, // null | finite
    cumulativeTimeRatio: { values: [1, null|positiveFinite, null|positiveFinite, null|positiveFinite] },
    intervalTimeRatio: { values: [1, null|positiveFinite, null|positiveFinite, null|positiveFinite] },
    lawAnswerId,             // null | supported enum
    intervalLawAnswerId,     // null | supported enum
    accelerationAnswerId     // null | supported enum
  }
}
```

V4 analysis 的六個 keys 全部 required。只有 `null` 表示 blank；missing、empty string、
NaN、Infinity、ratio editable term `0`／negative 均 invalid。V4 必須拒絕 obsolete
`totalDisplacementRatio`／`intervalDistanceRatio` 或任何 mixed legacy/current shape。`setup`
phases 不得有 `generated=true` 或 measurement／analysis data。

### 16.2 Review snapshot

```js
{
  v: 4,
  locked: 1,
  modelVersion: 1,
  rubricVersion: 4,
  frequencyHz,
  frequencyAssigned: true,
  measurements: { /* all eight resolved items */ },
  evidence: { /* canonical process evidence subset */ },
  analysis: { /* exact v4 shape；null answers legal */ }
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
- legal one-time assigned frequency；
- phase、variant、current step、return-to-review；
- draft-only active placement 的 task、mode、normalized movement、米制零位、
  stable horizontal anchor／side 及 raw zero-tick overlap；
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
- 手動 reading 輸入中的未提交文字、review-edit original canonical／baseline
  transient pair 及舞台 output；
- debounce timers。

### 16.6 Restore invariants

- supported `v/modelVersion/rubricVersion`；
- phase／variant／currentStep combination is renderable；
- frequency legal and absent only in setup/new；
- generated phases have legal frequency；
- normal linear phases cannot skip required earlier resolution or contain stale future data；
- review-edit may retain complete future data only with `returnToReview=true`；
- `*-placement-ready` 必須有唯一、matching current task 的 bounded active
  placement；它可未達 scoring validity；restore／resize 以 stable guide-relative
  relation canonicalize 後 validity 不變，raw current-CTM cache 不作權威；
  `*-unpositioned`、analysis、review 及 submitted 必須沒有 active placement；
- each measurement status is `recorded` or `skipped` where required；
- v4 runtime 新增 `recorded` item 不要求 placement；當 matching persisted active
  placement 有效時才按既有規則建立 total/gap evidence。Validator 仍可接受經 exact v1 migration
  得到的 legacy recorded-without-evidence item，以保持舊 review／score；legacy
  edit replacement 重新受 current placement gate 約束；
- skipped item has no reading/evidence/active placement；
- recorded reading is finite, non-negative and within supported camera range；
- evidence task keys are unique and known；
- `mode` is `pointer` or `keyboard`；
- 所有 evidence 及 active-placement metrics 無論 `usedWhileValid` true／false 均須
  finite and bounded；
- `horizontalMode` 的 conditional keys、side、fraction／boundary overlap 必須一致；
  exact `4 CSS px` left／right boundary 在任一 required CTM restore 後仍為 exact 4；
- `usedWhileValid` implies metrics satisfy inclusive thresholds；
- gap evidence reading equals corresponding authoritative reading；
- total reading 只在同名 compact finalized evidence valid 時連結 placement；
- v4 analysis exact keys；兩組 ratio array 長度4、首項 numeric `1`、其餘只可 null 或
  positive finite；deltaT／三個 law answers 只可 null 或 legal value；
- review ready／submitted 明確具有 exact v4 analysis 及八個 resolved measurements；
- score、passed 及 legal continuation survive round-trip；
- editable v1/v2/v3 draft/review 先按各自 exact legacy schema 驗證，再一次性遷移至
  `v4/rubricVersion:4`；保留 frequency、measurements、finalized item evidence、deltaT、兩組 time
  ratios 及三個 laws，drop 兩組 obsolete distance ratios，legacy blank／missing answer
  正規化為 null；old complete/incomplete review 轉 `review/ready` 並按 rubric3 rescore；
  legacy active placement 是尚未計分的 bounded candidate，先套用
  `rulerZeroM >= 0`、`edgeGapPx 0..200` 及 placement-shape bounds，再映射為
  placement-ready；但 total active placement 在 migration 時必須丟棄並轉 unpositioned，
  防止 reload 繞過 fresh placement；gap active 可按既有規則 restore。Legacy finalized total／gap evidence 才套用
  `edgeGapPx 6..44` scoring gate。兩類均明確映射為
  `legacyEdgeGapPx`／`legacyEdgeSide`；不得將 legacy gap 重新解釋為
  `zeroTickOverlapPx`，亦不得用 v2 新增的負側對準 tolerance 將 v1-invalid
  placement 變成合法。
  configured/generated/review 保留原 frequency、meter readings 及 evidence。
  v1 setup/new 無 frequency 時進入同一 assignment boundary，成功保存前 capture
  disabled。其他 unsupported version fail closed；
- immutable legacy v1/v2/v3 submitted／finished／frozen 不轉成 rubric4；strict decode 後
  由 rubric2 dispatch 保留 recorded score/pass。Frozen retry 必須寫回原 bytes；unknown
  或 mixed legacy/current shape quarantine。V3 final／frozen 保持 rubric3 原 bytes／scorer；
- editable next save canonical re-encode produces one stable v4 shape。

Tuple dispatch 必須先 exact match 才進 decoder／scorer：current review 只接受
`(v=4, modelVersion=1, rubricVersion=4)`；legacy branch 只接受明確 supported
`(v=1, modelVersion=1, rubricVersion=2)`（先正規化至 immutable rubric2 shape）或
`(v=2, modelVersion=1, rubricVersion=2)`、`(v=3, modelVersion=1, rubricVersion=3)`。任何 cross-product unknown／mixed tuple 一律
reject。Finished decode／rescore exception 進 recorded-result safe fallback，不可 uncaught；
frozen exception 必須 quarantine pending、移除 retry／pagehide eligibility，亦不可 uncaught。

### 16.7 Size budget

- maximum draft shared envelope：`< 3000 UTF-8 bytes`；
- review shared envelope：`< 2600 bytes`；
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

- 新 attempt 隨機 frequency assignment 成功保存；
- 頻閃相片第一次合法生成（`Persistence.generate()` 後一次；preview frame、
  capture frame、每個 stamp 及 animation completion 都不另存）；
- pointerup／keyboard movement 完成後的尺位；
- 記錄／修改／跳過一個讀數；
- 完成一組 ratio／concept answer；
- 進入／離開 review；
- confirmed reset（保留 assigned frequency）；
- lifecycle flush。

不在每個 pointermove commit。Draft provider 永遠回傳最近完整 semantic state；
completed pointerup／keyboard movement 保存 `activePlacement` 而不是計分 evidence；
active drag 在 lifecycle flush 時取消並恢復上一個完整 active placement。只有確認
reading 才把 matching placement atomically 轉成 finalized evidence；任何 total／gap task
記錄或跳過後均清除 active placement 並把直尺返回左上角停泊區，下一項必須重新放置。

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
- 4／5／6／8 Hz 的 \(\Delta t,t_n,s_n,\Delta s_n\)；
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
- 每個 total reading 只連結自己的 finalized placement evidence；
- 每個 total／gap record 或 skip 後 ruler 回 CTM-derived upper-left PARK、stage readout 清空、
  movement 歸零，下一 item 為 unpositioned；reload 不可繞過 fresh drag／snap；
- review-edit 新 placement 不改其他 finalized evidence；replacement／manual／skip 只更新
  或刪除目前 item evidence；
- 修改 reading 而沒有新量度時清除 evidence link；
- time、distance、time-ratio、zero alignment、edge min/max、movement threshold
  全部有 just-inside、exact inclusive boundary、just-outside；
- 兩組時間比例各有三個可編輯 term，每 term 按 `5/3` 獨立測試正確、錯誤及留空；
- 衍生距離系列不計比例答案分；舊距離比例只在 immutable `rubricVersion: 2`
  compatibility matrix 驗證原分數保存；
- non-finite、負值、unsupported enums；
- score floor、ceiling、rounding、pass threshold。

### 18.3 Phase／persistence

- `setup/new`／`setup/assigned` snapshot 不含 preview／replay progress；
- injected RNG boundary 精確覆蓋 `0 -> 4`、`1/3 -> 5`、`2/3 -> 8`、接近 `1 -> 8`
  及非法 RNG；不得抽出 `6 Hz`；genuinely new attempt 只呼叫
  一次，restore/render/retry/reset 不呼叫；assignment checkpoint failure 不 enable
  capture；另直接驗證 `assignFrequency(new,6) -> null` 而 `assignedState/decode/reset(6)` 合法；
- generated draft／review restore 直接為完整 static presentation，不保存
  capture progress；
- 每個 phase／variant production-shaped round-trip；
- `score(original) === score(restore(encode(original)))` 且
  `passed(original) === passed(restore(encode(original)))`；
- 每個 restore fixture 執行一個合法 continuation；
- 每個 total／gap 的 placement-ready variant restore 後可記錄、微調或跳過；resolve 後
  下一 item 一律 unpositioned／parked；
- `6 Hz` 每個 total/gap step 的 normal/review-edit unpositioned/placement-ready 均把
  v2 decode round-trip 與 v1 migration 分開測試，各自執行 legal continuation 並返回
  ready review；
- normal phase stale future data rejection；
- review-edit retained future data acceptance；
- unchanged review-edit reuses bit-identical canonical `readingM` and preserves score/pass；
  production continuation 同時 bit-identically 保留該 item 及既有 total／gap evidence；
  changed text follows the normal one-time photo-cm conversion，沒有新 valid placement
  時清除舊 process evidence；
- skipped／reading／evidence impossible combinations；
- missing prior resolution、invalid current step；
- duplicate／unknown evidence key；
- invalid raw evidence／active-placement metrics 在 `usedWhileValid=true` 及 false
  兩個分支均 fail closed；
- ratio first term 不等於 numeric `1`、array length／term 非法；
- 只有 legacy v1/v2 decode validation 可接受距離 ratio `insufficient-data`，而且只限
  對應 source readings 不足；full-source legacy state 使用 `insufficient-data` 必須拒絕；
  editable migration 必須丟棄兩個 legacy distance-ratio fields。現行 v4 skipped review
  以 measurements 的 `skipped` resolution 表示，不得包含任何 distance-ratio key；
- v1 draft/review/manual-without-evidence migration、pending retry equality及其他 old
  version rejection；每個 legacy persisted phase／variant／step 均 round-trip
  migration並執行一個合法 continuation；v1 placement-ready active candidate 以
  historical `6 Hz` 重複覆蓋 setup、兩個 measurement phase、analyze、review、
  finished、frozen 及 pending lifecycle；v1/v2 frozen review bytes 不重寫；
  `edgeGapPx=100` 覆蓋 total／gap／review-edit，restore 後保持 placement-ready 但
  不建立 operation points；相同 `edgeGapPx=100` 作 finalized evidence 必須拒絕。
  v1 placement-ready draft、review 及
  pending inner review 的負 `rulerZeroM` 明確 fail closed／quarantine；
- discriminated fixed-left v2、undiscriminated historical v2 及 v1 各自 score/restore
  compatible；unknown、mixed current/legacy 或 incomplete geometry shape fail closed；
  editable historical active placement rerender 後才 canonicalize，review/frozen 不改 bytes；
- maximum draft／review／pending UTF-8 size；
- invalid editable、pending quarantine、invalid finished lock。
- `8 Hz` 完整 manual readings、placement evidence、analysis、review encode/decode 及
  SCORM durable submit/load round-trip 得 `score=100`、pass、`process=40`。

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
- 4／5／6／8 Hz capture schedule 精確為 \(n/f\)，P₀ immediate、五個 index 唯一且
  final position 精確取 Model；P₄ 後 live ball 移除；
- Generate 雙擊只有一次 semantic transition／checkpoint／sequence；
- cancel、visibility、reset、replay、resize、phase change 及 stale callback 不可
  加入舊 stamp 或改 phase／answers／evidence／score；
- reduced motion 沒有 motion／cadence timers，直接產生相同 static semantic result；
- restored generated draft／review 不重播 capture；
- 頻率由 genuinely new attempt unbiased 指派一次並在 capture 前保存；
- reset confirmation atomically 清除依賴資料但保留 assigned frequency；
- pointer drag 使用 relative offset，不令尺跳到手指中心；
- pointercancel 不建立 evidence，並驗證 visible ruler、active placement、phase、
  answers、evidence 及 focus 全部回復／保持 drag 前值；合法尺位在 active drag 時
  暫藏 readout，cancel 後重現相同文字及 aligned status，無效／unpositioned 尺位則
  保持隱藏；
- pointerup／keyboard movement 先建立可 restore active placement；確認 reading
  才建立 finalized evidence；
- 實際 mouse drag、trusted touch drag、Arrow／Shift+Arrow 完整完成；
- 實際 mouse 及 trusted touch 分別由可見尺身 top／middle／bottom／left edge／
  right edge 開始，全部命中同一 stable drag owner；pointercancel 回復先前位置；
- valid completed placement 的舞台 output 顯示至 `0.01 cm` 並 clamp／跟隨直尺；
  Record 只從可編輯 learner input 經 `photoCmToMeters()` 轉換一次，rounded stage
  output 不參與 conversion；pointerdown／invalid／persistence rejection／cancel／
  park／task／skip／reset／review／technical 清 stale output，且不改 learner input；
  completion 只作一次 polite announcement，單純顯示不建答案或 evidence；
- source／package 驗證 output bounding box stays inside stage beside the ruler、
  computed `pointer-events:none`／`elementFromPoint` 不搶 owner、ruler ARIA 含讀數，
  並在 invalid completion、park、skip、task、review-edit、reset、review、
  submission 及 technical lock 全部清 stale；
- 新 task input blank、review-edit prefill；未提交 input 不 persistence。Record 接受
  inclusive `0`／`5 cm`，拒絕 blank、non-finite、negative、`>5`；正確／錯誤答案
  均可在無 placement 時保存而不建 evidence，有有效 placement 時才獨立連結 evidence；
- HTML／CSS／DOM 全部沒有 magnifier；transparent overlay 沒有可見 handle glyph；
- `.nudge-grid`、`[data-nudge]` 及其 click binding 全部不存在；
- ruler capture target drag 中不被 render 替換；
- 每個 total 及 gap 都需要自己的新 movement；record／skip 後立即 PARK；
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
- 4／5／6／8 Hz capture 依次顯示 P₀–P₄，時間在 browser scheduler tolerance 內，
  最後恰好五個靜態 labels、無 live ball，再顯示 ruler／measurement；
- reduced motion preview 靜態、capture 即時完成且沒有 timed movement／cadence；
- source 及 extracted package 在 `320×500`、`390×500`、`390×600`、
  `430×800`、`700×390` landscape 及 `390×600 @ 200%` 的完整矩陣驗證：
  uniform CTM client↔SVG round-trip、球影 screen circularity、full/visible ruler
  body、overlay 四邊 `<=1 px`、visible width `>=44 px`、一個 `cm` unit、`51` ticks、
  `0.1/0.5/1 cm` hierarchy、`0..5` labels、兩端 margin、P0–P3 zero alignment、
  P1–P3 bottom clip；另量度 ball `>=18 CSS px` 且近似圓形、P label `>=10 CSS px`、
  ruler numeral `>=16 CSS px`、唯一粗體 body-centred unit `>=18 CSS px`、
  tick/body stroke `>=1 CSS px`、`cm` baseline 為 `0.3 cm`，全部 tick／numeral 位於 right spine 左側，
  unit 與全部 numerals bbox disjoint，owner 與 actual visible body 四邊 `<=1 px`，
  `elementFromPoint` 全尺身命中且沒有 invisible dead zone；
- 同一完整矩陣驗證 semantic `<var>/<sub>/<sup>`、computed sub/sup geometry 可見且
  不被所屬 copy block 裁切；學生距離 copy 不出現 meter unit，`m s^-2` 只作重力
  加速度單位且保持直立；
- production UI 以 real mouse/trusted touch/keyboard 在 guide far-left／far-right
  exact overlap boundary 及 `±6 px` 吸附邊界建立 canonical `zeroErrorPx=0` placement；
  `±6.01 px` 或水平 overlap `<4 px` 不吸附亦不顯示讀數；另驗證有效尺位後的細微
  pointer 校正，以及沒有既有 move history 的細微真實 drag 吸附，均取得 task-local
  meaningful movement 並顯示讀數；pointerdown／pointerup 零移動則不取得資格；另驗證 stage output tracking、
  clamp／stale clearing、editable input、full-precision `readingM`、encode/decode、
  evidence/no-evidence、restore/edit/input transience、review/result
  及 score 不發生第二次 calibration；
- 每個 total/gap task 於上述每個 viewport/zoom 驗證 output bbox 不碰 ball/P label/
  ruler/ticks/numerals/unit，vertical center 等於 full-precision measured tick，manual input 空白；
  `320×500` total1、persisted x100 必須完全 disjoint；
- source／package 跨 CTM matrix：320→desktop、desktop→320、200% zoom、resize
  及 reload，far-left／far-right 在 fixed-spine clamp 後保留至少 `4 CSS px` overlap、output
  visible、可 legal Record，且當前 invalid geometry 不可沿用 stale evidence；
- historical undiscriminated v2 active placement 覆蓋 guide/boundary 兩 side、x80、三個
  CTM scale；left-side 以 `23 CSS px / scaleX` 取舊 tick right endpoint，canonicalize 後
  valid 並可 legal Record，finalized review/frozen bytes 保持不變；
- trusted drag 及 keyboard 各自撞 left clamp，驗證 actual visible ruler `>=44 CSS px`
  且 owner 無 phantom extension；persisted `6 Hz` UI reset 保留6及 injected RNG calls=0；
- deliberately wrong manual answer with valid placement retains process evidence but loses
  numeric correctness, and draft/review round-trip preserves both facts；
- typography matrix 包括 ruler 左／右方向、水平 edges、far guides、P0–P3 vertical
  clipping、全部 required viewport／zoom，numerals／unit collision-free；
- setup preview、capture、static 全部通過 responsive／zoom、panel reachability 及
  no-third-scroll-owner；所有 phase 的 destructive reset 前距離 `>=12 px`
  （包括 `320 px` 寬）；localized exposure cue pointer-inert、無 full-stage luminance
  flash，reduced motion 為靜態等價。

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
- 4／5／6／8 Hz 均顯示可量度 \(P_0\)–\(P_4\)；
- 能在 trusted result feedback 分辨累積時間、總位移、每段時間、每段距離的關係；
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
3. 是否接受新 attempt 只指派 `4/5/8 Hz`、historical persisted attempt 仍支援 `6 Hz`，而非任意連續 slider。
4. 是否接受固定只分析 \(P_0\)–\(P_4\)，相機按頻率自動校準。
5. 是否接受不加隨機測量噪聲，只以讀尺及輸入容差保留實驗感。
6. 操作分佔 40%、數據 30%、規律 30% 是否合適。
7. 是否接受 meaningful ruler use gate：
   有效 total placement、最少三個有證據的總位移讀數及最少三個 gap placements，
   否則總分 cap 59。
8. 是否接受沒有有效尺位仍可輸入／提交，但只取得答案分，令操作評分真正可區分。
10. 是否接受 low-risk graded 分類；若要高風險考核，需另設 server-side trusted
   validation，不能只靠此 SCORM package。
