# 勻速與勻變速：三圖定量建構挑戰計劃

## 0. 文件狀態

- 文件角色：新 SimLab 活動的產品、教學、題目、直接操作、數學模型、評分、持久化、
  SCORM、測試及封裝規格。
- 計劃狀態：implementation complete；T3 subject、SCORM、interaction、test/package及
  independent final verification已通過，local package-ready。**尚未 Moodle-ready**：仍需在真實
  Moodle SCORM 1.2及實體手機（current-window及new-window，如提供）重複手勢矩陣、軟體鍵盤、
  draft／pending／finished LMS lifecycle及成績／completion證據。CDP 多點接觸可驗證 rollback 與
  ownership geometry，但 Chrome 不會在該路徑交付原 primary 的 `pointerup`／`pointercancel`；
  這一 continuation 證據延後至 Moodle-ready 實機確認。
- 計劃檔案：`plans/14-kinematics-quantitative-graph-builder.md`
- 建議 slug：`kinematics-quantitative-graph-builder`
- 學生可見標題：`勻速與勻變速：三圖定量建構挑戰`
- 開發 branch：`codex/kinematics-quantitative-graph-builder`
- 學生可見語言：繁體中文。
- 參考規格：
  - `AGENTS.md`
  - `plans/00-shared-platform-and-style.md`
  - `docs/simulation-scorm-production-guide.md`
  - `plans/NEW-SIMULATION-PLAN-TEMPLATE.md`
  - `plans/10-position-time-graph-motion-lab.md`
  - `plans/13-kinematics-qualitative-graph-sketching.md`
  - `sim/kinematics-qualitative-graph-sketching/`
- 本文件是 implementation blueprint。任何改變題目範圍、學習目標、控制點語意、題庫、
  評分、容差、phase、snapshot schema、手勢責任或 SCORM 行為的修訂，必須先更新本文件。

### 0.1 已確認的 simulation 題目

本活動處理：

> **根據一段具體的一維勻速或勻變速直線運動數據，精確建構互相對應的
> 位置—時間圖、速度—時間圖及加速度—時間圖。**

第一版包括四類單段運動：

1. 正方向勻速；
2. 由靜止開始正方向勻加速；
3. 已有正初速度的正方向勻加速；
4. 正方向勻減速至剛好停止，不反向。

本活動直接承接：

```text
kinematics-driving-challenge
  操作建立勻速／勻加速／勻減速直覺

→ kinematics-qualitative-graph-sketching
  定性手繪 x–t／v–t／a–t 的方向、斜率及曲率

→ 本活動
  以具體 x₀、v₀、a、T 建立精確定量三圖
```

### 0.2 核心產品決定

1. 學生不以手指自由畫精確曲線。
2. 學生設定少量、具真實物理意義的坐標點。
3. 控制點的時間坐標由題目固定；學生只設定縱坐標。
4. 所有可設定值吸附到題目合法的物理量刻度。
5. 直線由兩個實際坐標點唯一決定。
6. 勻變速 `x–t` 圖由 `t=0`、`t=T/2`、`t=T` 三個實際位置點唯一決定二次函數。
7. 曲線外的 Bézier 控制柄不代表真實位置，因此禁止使用。
8. 系統按學生控制點精確生成圖線；不以像素比較，亦不以線性／二次擬合猜測答案。
9. 每幅圖獨立作答；系統不會由一幅正確圖自動填寫另外兩幅答案。
10. 提交前只顯示完整度，不顯示正確性；提交後才疊加正確圖線及提供物理回饋。
11. 第一版只處理單段運動；定量分段曲線留待後續活動。
12. 題庫只使用經人工及自動驗證的有限數值格，確保全部控制點答案是整數、位於圖軸內，
    且手機可以可靠設定。

---

## 1. 目的與教學定位

現有定性活動已考核學生能否畫出：

- 直線或曲線；
- 斜率固定、增加或減少；
- 圖線在零軸上方、下方或沿零軸；
- 加速、勻速、減速及靜止的分段特徵。

本活動把要求提升至定量層次。學生需要把：

```text
x₀、v₀、a、T
```

轉換成指定時間的：

```text
x(t)、v(t)、a(t)
```

再以精確坐標點建構三幅圖。

核心學習證據不是學生拖動了多少次，而是最後提交的控制點物理量值，以及由這些點唯一生成的
圖線。

### 1.1 教學原則

1. 物理數值是權威答案；SVG 像素位置只是顯示結果。
2. 手機作圖精度不應決定物理分數。
3. Snap-to-grid 是本活動的數學作圖工具，不是自動修正答案。
4. 控制點必須位於圖線上，並代表一個真實的 `(t,x)`、`(t,v)` 或 `(t,a)`。
5. 對勻變速 `x–t` 圖，三點是插值條件，不是最小二乘擬合樣本。
6. 學生三點放錯時，系統仍忠實畫出由錯誤三點決定的二次曲線。
7. 不預填水平線、零線、起點或其他具有物理意義的答案。
8. 不要求學生逐秒設定大量重複點。
9. 不因重試、拖動次數、使用數值輸入或使用微調按鈕扣分。
10. 同一題三幅圖之間的數值矛盾提供診斷回饋，但不重複扣分。

---

## 2. Scope

- Slug：`kinematics-quantitative-graph-builder`
- 學生可見標題：`勻速與勻變速：三圖定量建構挑戰`
- 學科分類：力學
- 建議完成時間：25–35 分鐘；以學生 pilot 的中位數及第 90 百分位再修訂。
- 前置知識：
  - 一維運動的正方向；
  - `x–t`、`v–t`、`a–t` 圖的定性形狀；
  - `x–t` 圖斜率代表速度；
  - `v–t` 圖斜率代表加速度；
  - 基本代入運算。
- 主要操作：
  - 閱讀 `x₀`、`v₀`、`a`、`T`；
  - 計算指定時間的物理量；
  - 在數字坐標圖拖動控制點；
  - 使用刻度吸附；
  - 使用 `−／＋` 或數值欄精確設定；
  - 切換 `x–t`、`v–t`、`a–t`；
  - 提交後以同步時間游標檢討三圖。
- 技術：原生 HTML、CSS、JavaScript、SVG、HTML hit targets、Pointer Events。
- Libraries：無。
- 網絡資源：無。
- Assessment risk：`formative`。
- Trusted validation：不適用。題目、答案及 scorer 在瀏覽器內，不能作高風險考試的可信邊界。
- SCORM：1.2。

### 2.1 第一版明確不包括

- 自由手繪或筆跡分析；
- 逐像素答案比較；
- 線性／二次回歸判斷學生畫了甚麼；
- Bézier 曲線手柄；
- 非勻變速任意曲線；
- 負方向運動；
- 負初速度；
- 停止後反向；
- `v–t` 圖面積與位移；
- `a–t` 圖面積與速度改變；
- 切線量度瞬時速度；
- 公式推導或公式選擇評分；
- 定量多階段運動；
- 位置、速度或加速度的不連續跳變；
- 多物體、相遇或追及；
- 數據噪音、實驗不確定度或有效數字評估；
- 任意教師輸入題目；
- 自動代入或內置求解器；
- 顯示標準答案容許區；
- 把正確答案預填成一條可拉的水平線；
- 保存原始 pointer 軌跡、SVG path 或截圖；
- 高風險考試、SCORM 2004、xAPI 或 LRS。

---

## 3. 學習目標

完成活動後，學生應能：

1. 從題目辨認初始位置 `x₀`、初速度 `v₀`、加速度 `a` 及運動時間 `T`。
2. 使用

   ```text
   v(t) = v₀ + at
   ```

   求指定時間的速度。
3. 使用

   ```text
   x(t) = x₀ + v₀t + ½at²
   ```

   求指定時間的位置。
4. 對勻速運動使用 `a=0`，把 `x(t)=x₀+vt` 連結到 `x–t` 直線。
5. 把 `x–t` 圖在 `t=0` 的截距連結到 `x₀`。
6. 把 `v–t` 圖在 `t=0` 的截距連結到 `v₀`。
7. 把 `v–t` 直線的斜率連結到固定加速度 `a`。
8. 把 `a–t` 水平線的高度連結到固定加速度 `a` 的數值及正負號。
9. 以兩個實際坐標點建立勻速 `x–t`、所有 `v–t` 及所有 `a–t` 直線。
10. 以三個實際位置點建立勻變速 `x–t` 二次曲線。
11. 分辨「曲線通過三個正確位置」與「曲線外形大概正確但數值錯誤」。
12. 檢查同一運動的三幅圖是否在初值、末值及加速度上互相一致。
13. 說明勻減速至停止時：
    - `v–t` 在 `T` 到達零；
    - `x–t` 在 `T` 具有水平切線；
    - `a–t` 在整段保持負常數。

### 3.1 Mastery evidence

活動必須留下以下可評分證據：

- `x–t`：學生設定的 `x(0)`、需要時的 `x(T/2)`、`x(T)`；
- `v–t`：學生設定的 `v(0)`、`v(T)`；
- `a–t`：學生設定的 `a(0)`、`a(T)`；
- 四個情境的完整／部分／未設定狀態；
- 最終提交時由控制點重建的線性或二次函數；
- 提交後可重算的逐點分數及跨圖矛盾。

---

## 4. Learner task

### 4.0 Learner notation implementation status

Local package implementation uses native semantic HTML/SVG notation (no MathJax or KaTeX): physics
variables use `<var>`, numeric indices use `<sub class="numeric-subscript">`, exponents use `<sup>`,
and units remain upright. Learner-facing velocity and acceleration units use the consistent slash forms
`m/s` and `m/s²`; graph labels disambiguate compound units as `v / (m/s)` and `a / (m/s²)`.
Number–unit pairs use one semantic no-wrap quantity wrapper. This covers task
prompts, formula card, graph controls and SVG axes, point rows, review/result feedback and cursor readout;
plain ARIA text remains readable. Learner-facing task labels use `任務 n/4`, never internal paper IDs or
English Mission/M abbreviations. The graph keeps the 740:500 SVG aspect ratio, so its percentage-based
HTML hit overlay remains aligned with circular SVG control markers at every responsive size.
Every graph SVG accessible name includes the vertical-range unit even when every control point is unset:
`m` for `x–t`, `m/s` for `v–t`, and `m/s²` for `a–t`.
On noncompact mobile widths the stage row follows the 740:500 board width within a bounded 13rem–48dvh
track, recovering unused vertical space for the independently scrolling controls. During a direct touch
drag, the actual control point keeps its normal relative path; a transient adjacent coordinate label shows the fixed
`t` value and current snapped `x`/`v`/`a` quantity beside (never over) the marker. After activation, a
non-intercepting fixed-corner SVG magnifier shows the actual local graph region around that point: enlarged
grid／guide／axis context, the live student path when defined, the actual marker and a crosshair. Its local
viewBox follows the snapped marker while the outer magnifier stays in the board corner farthest from
pointerdown. It repeats the complete point ID、fixed time and snapped quantity, contains no cloned IDs, and
is discarded on up, cancel, lost capture, rollback, blur or render. Neither label nor magnifier is bold,
persisted or announced per move.
Both the main SVG and magnifier draw direct, ID-free filled triangular positive-direction arrowheads:
upward on the value axis and rightward on the `t` axis. Only the horizontal `y=0` line is a thick axis; a nonzero plot minimum
or maximum boundary remains a thin grid line. On `x–t`, the minimum is zero, so the bottom boundary is
that single thick zero axis. Because the cropped local view can exclude the main arrow tips, the magnifier
also has a small invariant ID-free orientation cue anchored inside the current viewBox: `t` points right
and value points up. The cue uses unfilled axis shafts with filled triangular tips beneath the live student
path, stays away from the central marker/crosshair and the separate HTML readout, and does not change the
crop or fixed-corner rule.
At 320–480 CSS-pixel widths, the SVG uses enlarged axis, tick and dock-label typography; 481–819 uses an
intermediate tier. These tiers change only SVG text metrics, never graph coordinates, axis ranges or hit
overlay geometry. Scorer diagnostics pass through the same safe notation renderer, including signed
number–unit quantity wrappers.

學生需要完成一個不計分操作練習及四個計分情境。

每個情境的流程：

1. 閱讀題目提供的 `x₀`、`v₀`、`a`、`T`。
2. 可展開公式提示卡，但系統不代入或計算答案。
3. 按建議次序處理 `x–t`、`v–t`、`a–t`，亦可在同一情境自由切換。
4. 計算每個固定時間控制點應有的縱坐標。
5. 以以下任一等價方式設定每點：
   - 在圖上垂直拖動；
   - 使用 `−／＋` 微調；
   - 在對應數值欄輸入合法整數。
6. 觀察程式根據自己的控制點即時生成直線或二次曲線。
7. 可清除單一點、修改、切換圖或稍後再做。
8. 四個情境、十二幅圖均曾開啟後進入提交前檢視。
9. 檢視頁只顯示未設定／部分／完整，不顯示對錯。
10. 學生可返回任一圖修改。
11. 學生最後一次過提交全部控制點。
12. 提交後比較自己的圖線與正確圖線，並以同一時間游標檢查 `x(t)`、`v(t)`、`a(t)`。

### 4.1 不計分操作練習

練習使用一條沒有物理答案的示範坐標圖：

- 兩個控制點的時間固定；
- 控制點初始為「未設定」；
- 學生試用拖動、吸附、數值欄、微調及清除；
- 系統展示「兩點設定後才生成圖線」；
- 練習不保存到正式 answers；
- 不要求完成特定數值；
- 可隨時開始正式挑戰。

---

## 5. Catalogue metadata (`sim/config.js`)

```js
{
  title: "勻速與勻變速：三圖定量建構挑戰",
  folder: "kinematics-quantitative-graph-builder",
  categories: ["Mechanics"],
  description: "根據具體初始位置、初速度、加速度和時間，拖動精確坐標點建立 x–t、v–t 及 a–t 圖。",
  tags: [
    "physics",
    "mechanics",
    "kinematics",
    "motion-graphs",
    "position-time",
    "velocity-time",
    "acceleration-time",
    "constant-acceleration",
    "graph-construction",
    "scorm"
  ],
  status: "planned"
}
```

登記要求：

- `folder`、activity directory、manifest slug、snapshot activity identifier 完全一致；
- implementation 及 package-ready gates 完成前保持 `planned`；
- local package-ready 後改為 `active`；Moodle-ready 仍需另行證據；
- 不建立重複 catalogue entry；
- metadata 不得把本活動描述成自由手繪。

---

## 6. 物理及數學模型

### 6.1 基本模型

所有題目使用一維固定加速度模型：

```text
x(t) = x₀ + v₀t + ½at²
v(t) = v₀ + at
a(t) = a
0 <= t <= T
```

其中：

- `x`、`x₀`：位置，單位 `m`；
- `v`、`v₀`：速度，單位 `m/s`；
- `a`：加速度，單位 `m/s²`；
- `t`、`T`：時間，單位 `s`。

第一版所有正確題目均滿足：

```text
x(t) >= 0
v(t) >= 0
```

在勻減速題：

```text
v(T) = 0
v(t) > 0 for 0 <= t < T
```

### 6.2 直線建構

兩個不同時間的實際點：

```text
(t₀,y₀), (t₁,y₁)
```

唯一決定：

```text
y(t) = y₀ + (y₁-y₀)(t-t₀)/(t₁-t₀)
```

使用兩點的圖：

- 勻速 `x–t`；
- 所有 `v–t`；
- 所有 `a–t`。

即使正確答案應水平，學生兩端可設定不同值；程式必須忠實畫出學生建立的斜線，不可強制拉平。

### 6.3 二次曲線建構

對勻變速 `x–t`，控制時間固定為：

```text
t₀ = 0
t₁ = T/2
t₂ = T
```

學生設定：

```text
x₀* = x(0)
x₁* = x(T/2)
x₂* = x(T)
```

三個不同時間的實際點唯一決定：

```text
x_student(t) = At² + Bt + C
```

令：

```text
h = T/2
C = x₀*
A = (x₂* - 2x₁* + x₀*) / (2h²)
B = (x₁* - x₀* - Ah²) / h
```

學生曲線所暗示的物理參數：

```text
implied x₀ = C
implied v₀ = B
implied a  = 2A
```

用途：

- SVG 精確繪圖；
- 提交後診斷初始位置、初始斜率及曲率；
- 跨圖一致性檢查。

這是精確插值，不是 regression。三點有任何錯誤時仍可產生唯一學生曲線。

### 6.4 學生圖線求值

提交後的同步游標使用學生控制點所定義的函數：

- 兩點圖：以直線方程求值；
- 三點 `x–t`：以二次函數求值；
- 未完成控制點：顯示 `--`，不可外推或猜測。

正確圖線使用題目權威 `x₀`、`v₀`、`a`、`T` 計算。

### 6.5 數值精度

- 題目權威值及 scorer 使用完整有限 Number；
- 第一版學生可選值全部是整數；
- 拖動及微調以 `1` 個對應物理單位為一步；
- 顯示整數不加無意義小數；
- 計算函數保留 full precision；
- 不從 SVG 像素反推答案；
- viewport 改變時由權威物理值重畫。

---

## 7. 題庫及數值 lattice

### 7.1 題庫策略

第一版使用：

```text
QUESTION_SET_VERSION = 1
6 份人工驗證 paper
每份 paper 含 4 個固定類型情境
```

新 attempt 開始正式挑戰時選一個 `paperId`。同一 attempt 的 draft、pending、review 及 rescore
必須以 `questionSetVersion + paperId` 重建完全相同題目。

選擇 paper 不是安全邊界。可使用 `crypto.getRandomValues()`；不支援時使用經測試 fallback。
選定後立即成為 semantic state，不可在 reload 後重抽。

### 7.2 四個情境

| Mission | 運動 | 已知量 | `x–t` 控制時間 | `v–t` 控制時間 | `a–t` 控制時間 |
|---|---|---|---|---|---|
| 1 | 正方向勻速 | `x₀,v,T`；`a=0` | `0,T` | `0,T` | `0,T` |
| 2 | 由靜止勻加速 | `x₀,v₀=0,a,T` | `0,T/2,T` | `0,T` | `0,T` |
| 3 | 有正初速度勻加速 | `x₀,v₀,a,T` | `0,T/2,T` | `0,T` | `0,T` |
| 4 | 勻減速至停止 | `x₀,v₀,a,T`，並明示不反向 | `0,T/2,T` | `0,T` | `0,T` |

### 7.3 Version 1 papers

每格次序為：

```text
(x₀ / m, v₀ / m/s, a / m/s², T / s)
```

| Paper | Mission 1 | Mission 2 | Mission 3 | Mission 4 |
|---|---|---|---|---|
| A | `(0,5,0,4)` | `(0,0,2,4)` | `(2,2,1,4)` | `(0,8,-2,4)` |
| B | `(4,3,0,6)` | `(2,0,2,6)` | `(0,3,2,6)` | `(4,12,-2,6)` |
| C | `(2,4,0,4)` | `(4,0,1,4)` | `(4,1,2,4)` | `(2,4,-1,4)` |
| D | `(6,2,0,6)` | `(0,0,2,6)` | `(2,2,2,6)` | `(0,12,-2,6)` |
| E | `(3,5,0,4)` | `(6,0,1,4)` | `(0,4,1,4)` | `(5,8,-2,4)` |
| F | `(5,3,0,4)` | `(2,0,2,6)` | `(6,2,2,4)` | `(2,12,-2,6)` |

### 7.4 代表性答案

Paper A：

| Mission | `x(0)` | `x(T/2)` | `x(T)` | `v(0)` | `v(T)` | `a(0)` | `a(T)` |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0 | 不適用 | 20 | 5 | 5 | 0 | 0 |
| 2 | 0 | 4 | 16 | 0 | 8 | 2 | 2 |
| 3 | 2 | 8 | 18 | 2 | 6 | 1 | 1 |
| 4 | 0 | 12 | 16 | 8 | 0 | -2 | -2 |

### 7.5 題庫 validator

發布前自動驗證每一 paper：

- paper ID 唯一；
- 四個 mission 齊全且類型固定；
- 所有權威數值 finite；
- `T ∈ {4,6}` 且 `T/2` 是整數；
- 所有控制點正確值是整數；
- Mission 1：`a=0`、`v₀>0`；
- Mission 2：`v₀=0`、`a>0`；
- Mission 3：`v₀>0`、`a>0`；
- Mission 4：`v₀>0`、`a<0`、`v(T)=0`；
- `0 <= x(t) <= 60 m`；
- `0 <= v(t) <= 15 m/s`；
- `-2 <= a <= 2 m/s²`；
- 正確曲線在固定時間內不反向；
- 正確圖線與坐標上限之間有至少一個 snap step 的可見空間；
- 正確答案不落在任何 scaler 或 renderer 的 clipping 邊界；
- 每個 mission 可由其顯示數字唯一計算；
- 顯示值與 scorer 權威值完全相同，不使用隱藏小數。

已發布 `QUESTION_SET_VERSION=1` 不可原地改寫 paper。若需改數值，新增 version 並保留舊版本
的 restore／review decoder。

---

## 8. 整體學習流程

```text
共享 SCORM startup
→ 控制點操作練習（不計分）
→ 選定並保存 paper
→ Mission 1：勻速三圖
→ Mission 2：由靜止勻加速三圖
→ Mission 3：有初速度勻加速三圖
→ Mission 4：勻減速至停止三圖
→ 提交前檢視
→ 明確確認
→ shared SCORM submission
→ 鎖定檢討
```

### 8.1 同一情境的三圖安排

- 顯示次序及 canonical answer 次序均為 `x–t → v–t → a–t`；
- 一次只顯示一幅足夠大的 active graph；
- 三個普通按鈕以 `aria-pressed` 表示 active graph；
- 學生可自由切換同一情境三幅圖；
- 切換前 commit 目前控制點值；
- 首次進入情境顯示 `x–t`；
- 「下一幅」前往同情境下一幅未 visited 圖；
- 三幅均 visited 後才前往下一情境；
- `visited` 不等於 `complete`；
- 空白或 partial 圖可以稍後完成；
- 十二幅均 visited 後進入 review；
- review 可返回任何一幅圖修改。

### 8.2 公式提示卡

每個 mission 顯示可展開的公式提示：

```text
v(t) = v₀ + at
x(t) = x₀ + v₀t + ½at²
```

Mission 1 可另顯示：

```text
a=0 時，x(t)=x₀+vt
```

提示卡：

- 不自動代入；
- 不自動計算；
- 不顯示指定控制點答案；
- 開啟或關閉不計分、不持久化；
- 提交後可保持可用作檢討。

### 8.3 提交前 review

review 顯示：

- paper 及四個情境摘要；
- 每幅圖 `未設定／部分完成／已完整`；
- 學生目前生成的縮圖；
- 返回編輯按鈕；
- 不顯示標準答案；
- 不顯示逐點正誤；
- 不顯示預計得分；
- 若有空白／partial，明確警告對應點會得 0 分；
- 學生仍可確認提交未完成答案。

### 8.4 提交後 review

提交後：

- 學生線：實線；
- 正確線：虛線，標示「正確圖線」；
- 控制點顯示學生坐標及正確坐標；
- 顯示逐圖得分及最多兩項主要回饋；
- 顯示同一情境最重要的一項跨圖矛盾；
- 提供只讀 `t` 游標；
- 游標同步顯示正確 `x(t)`、`v(t)`、`a(t)`；
- 若學生圖完整，亦顯示學生圖所代表的對應值；
- 同一 attempt 鎖定，不可修改或重交。

---

## 9. 定量 graph builder

### 9.1 權威資料

每幅圖的權威學生答案只包含控制點縱坐標：

```js
// Mission 1 x–t
[xAt0, xAtT]

// Mission 2–4 x–t
[xAt0, xAtHalfT, xAtT]

// v–t
[vAt0, vAtT]

// a–t
[aAt0, aAtT]
```

每個 entry：

```text
null 或合法整數
```

時間、圖類型、單位、軸範圍、snap step 及正確答案由 question definition 重建，不重複保存。

### 9.2 未設定狀態

- 所有控制點初始為 `null`；
- 未設定點在 plot 下方的 control-point dock 顯示小型空心圓點，不顯示 `?` 或其他文字；
- dock 與 plot 數據區清楚分隔；dock 方框頂邊須低於時間刻度文字的 bounding box，
  並保留可見間距，`0`、`T` 及中間刻度不得與 dock 或 point marker 重疊；
- `48 × 48 CSS px` 的固定 HTML hit target 在 dock 下移後仍必須完整留在 graph board 內；
- dock 內的空心圓點不位於任何有效 y 值，亦不構成學生答案；
- 未有足夠控制點時只顯示已設定點，不畫推測線；
- 兩點圖要兩點均設定才畫線；
- 三點圖要三點均設定才畫二次曲線；
- 不以 `0`、中間值或上一次圖的值作預設。

### 9.3 固定時間

- 控制點不可左右拖動；
- 每個點上方或 point row 明示固定時間；
- 拖動只改變對應 y；
- `t=0`、`t=T/2`、`t=T` 使用題目真實秒數；
- 不顯示 1.87 s 等連續時間；
- 不容許學生更改 mission duration。

### 9.4 吸附

```text
x step = 1 m
v step = 1 m/s
a step = 1 m/s²
```

- pointer y 先映射到物理值，再四捨五入到 snap step；
- 夾在該圖合法 axis range；
- 拖動標籤顯示完整 `(t,y)` 及單位；
- 同一 snap cell 內的微小 movement 不建立新答案；
- snap 規則在手機、滑鼠、鍵盤及數值欄一致；
- scorer 比較 snap cell，不比較像素。

### 9.5 Drag activation

- `pointerdown` 只選中點，不立即改值；
- 超過約 `4 CSS px` activation threshold 後才開始設定；
- tap-only 不改值、不保存；
- 記錄 pointer 與控制點的垂直 grab offset，避免點跳到手指中心；
- 已設定點從目前值開始相對拖動；
- 未設定點由 dock 開始，第一次有效 move 投影到 plot；
- `pointerup` 才 commit 一次 semantic change 及 draft save；
- `pointercancel`／blur／lost capture 回復 drag 前值，不保存半完成答案。

### 9.6 HTML hit targets

每個可拖點使用固定、明確尺寸的 HTML overlay：

- 視覺圓點約 `16–20 CSS px`；
- effective hit target 至少 `48 × 48 CSS px`；
- 位於 SVG 上方；
- SVG control-point graphics `pointer-events:none`；
- hit target 在整次 drag 保持 mounted；
- render 更新位置，不替換 capture element；
- `touch-action:none` 在 `pointerdown` 前已生效；
- selected point 使用形狀、輪廓及文字，不只靠顏色。

### 9.7 點 rows 及等價輸入

操作面板為 active graph 顯示 point rows，例如：

```text
P₀，t = 0 s
x₀： [  8  ] m    −  +  清除

P₁，t = 2 s
x₁： [ 12  ] m    −  +  清除

P₂，t = 4 s
x₂： [ 20  ] m    −  +  清除
```

要求：

- 數值 input 的 `step=1`；
- placeholder 為「未設定」；
- 合法輸入與拖動雙向同步；
- 非整數、空字串、超出範圍或 non-finite 不 commit；
- 清空已設定 input 經 blur／Enter 後將該點設回 `null`；
- `−／＋` 是等價精準操作；
- selected row 與 graph point 同步 highlight；
- 每個 row 先以 `Pₙ，t = … s` 顯示 concise identity／time context；下一行的同一 control line
  依 point row index 顯示語意 numeric subscript 的 `xₙ／vₙ／aₙ：`、number input、獨立 upright
  unit、`−`、`+`、`清除`，不再使用
  `位置 x（m）`、`速度 v（m/s）`、`加速度 a（m/s²）`或 `x / m` 類組合標題；
- 每個 number input 的 accessible name 明示 `Pₙ`、固定時間、quantity name／symbol、讀作「下標 n」
  的 index及unit，不能只靠相鄰 visual label區分 point rows；
- 在 `320–390 CSS px` phone，symbol label、input、unit、`−`、`+`、`清除` 必須保持同一行，
  control line 及 panel 不得 horizontal overflow；unit 不換行，input 可縮，三個 action target
  各至少 `44 × 44 CSS px`；
- 不計分 practice rows 使用相同的 `Pₙ，t=… s` context 及 `xₙ：input m − + 清除` control-line
  contract，並保留 practice-specific input／button ARIA names及 selected-row synchronization；
- point context、control label、unit、drag coordinate label及magnifier copy使用normal font weight；數學變量保持語意
  italic但不額外加粗；
- software keyboard 開啟時主要操作仍可達。

### 9.8 清除及復原

- 提供「復原上一步」、「取消復原」、「清除這一點」、「清除這幅圖」；
- 每次 pointerup、合法數值 commit、stepper click 或清除是一個 undo operation；
- 每幅圖 session-only undo／redo 最多 24 步；
- 切換圖再返回仍保留該圖 history；
- review-edit 返回仍保留同一 browser session history；
- reload 可恢復權威點值，但 undo／redo history 重設；
- 清除整圖為一個可復原 operation；
- 空白圖的清除 disabled；
- 不使用 `window.confirm`；
- inline status 說明可復原。

### 9.9 SVG path

- 直線使用精確端點建立 SVG path；
- 二次曲線從學生 `A,B,C` 以不少於 121 個均勻時間 sample 生成顯示 path；
- sample 只為 render，不成為權威答案；
- 正確答案及學生答案使用同一 coordinate transform；
- 圖線超出 axis range時由 plot clip-path 裁切，但控制點仍是合法保存答案；
- renderer 不修改或夾正學生函數；
- resize 只重畫，不改物理值。

---

## 10. 坐標圖及 axis contract

### 10.1 共用

每幅圖顯示：

- 數字時間軸；
- 數字縱軸；
- 圖名及單位；
- major／minor grid；
- 固定時間 guides；
- point IDs；
- active point coordinate label；
- 學生圖線圖例；
- 提交後正確圖線圖例。

正方向以 SVG filled triangle 直接畫出，不使用 `marker` ID／URL reference：縱軸箭頭向上，時間軸箭頭
向右。只有 `y=0` 的水平線使用粗 `axis` 樣式；當 plot minimum／maximum 不是零時，其邊界
只使用細 `grid` 樣式。水平零軸 shaft 終點必須恰好位於時間箭頭三角形底邊，縱軸 shaft
起點必須恰好位於 value 箭頭三角形底邊，不得穿入 triangle；兩軸使用 round linecap／linejoin
及 geometric precision，在唯一共同 origin 形成平滑、無重複線段的接合。`x–t` 的 minimum
為零，因此底部零線就是唯一粗水平軸。magnifier
重畫同一組 axis／arrow context，且保持 ID-free；另在 current viewBox 內固定顯示小型向右
`t`／向上 value orientation cue，即使 crop 排除主軸箭頭仍可看見正方向。cue 使用無填色 shaft
及 filled triangular tips，shaft 同樣只抵達各 triangle base，
位於 live student path 下層，且不覆蓋中央 marker／crosshair 或 SVG 外的 coordinate readout。

軸標籤：

```text
t / s
位置 x / m
速度 v / (m/s)
加速度 a / (m/s²)
```

時間軸標籤使用 `t / s`，直接放在向右箭頭外側的預留 margin，垂直位置跟隨 `y=0`
水平軸；不得再固定於圖板底部中央。標籤必須貼近軸端，同時不得遮擋時間刻度、dock
控制點、學生圖線或三角形箭頭。

### 10.2 時間軸

- domain：`0..T`；
- major tick：`1 s`；
- 控制點時間以較強 guide 顯示；
- `T/2` 在加速 `x–t` 圖明確標示；
- 不容許 zoom、pan 或自行改軸。

### 10.3 `x–t` 軸

- minimum：`0 m`；
- maximum：

  ```text
  max(20, ceil((maxCorrectX + 4) / 10) × 10)
  ```

- absolute ceiling：`60 m`；
- snap：`1 m`；
- major tick：axis max `<=30` 時每 `5 m`，否則每 `10 m`；
- minor grid：`1 m` 或視覺降密度後每 `2 m`，但 snap step 不變；
- axis 在學生作答前固定，不隨控制點移動。

### 10.4 `v–t` 軸

- minimum：`-4 m/s`，容許學生表達錯誤反向；
- maximum：

  ```text
  max(10, ceil((maxCorrectV + 2) / 5) × 5)
  ```

- absolute ceiling：`20 m/s`；
- snap：`1 m/s`；
- 零軸清楚但不暗示正確答案；
- axis 在作答前固定。

### 10.5 `a–t` 軸

- fixed domain：`-3..+3 m/s²`；
- snap：`1 m/s²`；
- zero axis 在中央；
- major tick：`1 m/s²`；
- 正負標示由數值刻度及軸方向表達。

### 10.6 Axis leakage

軸範圍只按公開題目及 coarse scale family選擇：

- 不把 axis max 設成正確終點；
- 至少保留可見 headroom；
- 不在正確值位置加特殊 grid；
- 不在提交前顯示正確控制點；
- question validator 保證 axis 不裁切正確答案。

---

## 11. 關卡設計

### 11.1 Mission 1：正方向勻速

題目格式：

> 物體在 `t=0` 時位於 `x=x₀`，其後以固定速度 `v` 向正方向運動 `T` 秒。
> 建立這段運動的三幅圖。

學生建立：

- `x–t`：`(0,x₀)`、`(T,x₀+vT)`；
- `v–t`：`(0,v)`、`(T,v)`；
- `a–t`：`(0,0)`、`(T,0)`。

主要錯誤：

- `x–t` 從原點而不是 `x₀` 開始；
- 把 `x–t` 畫水平；
- `v–t` 只在一端為 `v`；
- 把 `a–t` 高度設為 `v`；
- 把固定油門概念錯當成圖像量。

### 11.2 Mission 2：由靜止開始勻加速

題目格式：

> 物體在 `t=0` 時位於 `x=x₀` 並由靜止開始，以固定正加速度 `a` 運動 `T` 秒。

學生建立：

- `x–t`：`x(0)`、`x(T/2)`、`x(T)`；
- `v–t`：`v(0)=0`、`v(T)=aT`；
- `a–t`：`a(0)=a(T)=a`。

主要錯誤：

- `x–t` 三點成一直線；
- `v–t` 不由零開始；
- 把 `a–t` 畫成由零向上斜；
- 忘記位置公式的 `½`；
- 把 `T/2` 誤用成一半位置。

### 11.3 Mission 3：已有正初速度的勻加速

題目格式：

> 物體在 `t=0` 時位於 `x=x₀`，已有正初速度 `v₀`，其後以固定正加速度 `a`
> 運動 `T` 秒。

主要錯誤：

- `v–t` 從零開始；
- `x–t` 起始斜率當成零；
- 遺漏 `v₀t`；
- 把 `x₀` 與 `v₀` 放錯圖；
- 只計速度改變 `aT`，忘記加上 `v₀`。

### 11.4 Mission 4：勻減速至停止

題目格式：

> 物體在 `t=0` 時位於 `x=x₀`，以正初速度 `v₀` 運動，並以固定負加速度 `a`
> 勻減速。物體在 `T` 秒剛好停止，沒有反向。

主要錯誤：

- 把負加速度當成負速度；
- `v–t` 在 `T` 仍大於零；
- `v–t` 在 `T` 低於零；
- `a–t` 畫在零軸上方；
- `x–t` 位置下降；
- `x–t` 終點切線不水平；
- 位置公式代入負 `a` 時符號錯誤。

---

## 12. Scoring

### 12.1 Compact contract

```text
Total: 100
Passing threshold:
  raw total >= 70（不先四捨五入）
  x–t family >= 20/40
  v–t family >= 16/32
  a–t family >= 14/28
  every mission >= 10/25
  positive-acceleration representative gate:
    Mission 2 或 Mission 3 至少一個情境的 x–t、v–t、a–t 全部控制點正確
  deceleration representative gate:
    Mission 4 的 x–t、v–t、a–t 全部控制點正確
Components:
  each mission = 25
  x–t = 10, v–t = 8, a–t = 7
Penalties:
  none for attempts, tools, formula-card use or time
  unset/wrong point earns 0 for that point only
Lowest score: 0
Highest score: 100
```

### 12.2 每個 mission

#### `x–t`（10 分）

Mission 1：

- `x(0)`：5；
- `x(T)`：5。

Mission 2–4：

- `x(0)`：3；
- `x(T/2)`：3；
- `x(T)`：4。

#### `v–t`（8 分）

- `v(0)`：4；
- `v(T)`：4。

#### `a–t`（7 分）

- `a(0)`：3.5；
- `a(T)`：3.5。

### 12.3 計分原則

- 每個 point component 獨立；
- 未設定 point：該 component 0；
- 設定錯誤：該 component 0；
- 設定正確：取得該 component 全分；
- 不以 generated path 的像素誤差另行計分；
- 不因三點生成「看似接近」的曲線給額外模糊分；
- 不重複為直線／水平／拋物線形狀加分，因形狀由已計分控制點唯一決定；
- 跨圖 consistency 只作回饋，不再扣分；
- 每題使用 full-precision component 分；
- `rawScore` 是所有 full-precision component 的總和；
- `result.score` 直接使用 clamp 後的 `rawScore`，不先四捨五入；
- canonical production answer 的分數以 `0.5` 為最小步距；顯示整數時不加 `.0`，半分顯示一位小數；
- SCORM `cmi.core.score.raw` 使用同一 `rawScore`；
- `passed` 只以未四捨五入的 `rawScore`、graph-family totals、mission totals及兩個
  representative semantic gates 判斷；
- final clamp `0..100`；
- saved score／passed 只作 comparison metadata，不是權威答案。

### 12.4 點解不按操作過程計分

本活動的學習目標是定量圖像，不是操作效率。以下不計分：

- 拖動次數；
- 先做哪幅圖；
- 使用 drag、stepper 或 number input；
- 是否開啟公式卡；
- 重試次數；
- undo／redo；
- 完成時間。

### 12.5 Borderline tests

- reachable exact boundary：Mission 1只有`x–t=10`、Mission 2全對`25`、Mission 3只有
  `x–t=10`、Mission 4全對`25`，得到total `70`、family `x=40,v=16,a=14`及所有gates，pass；
- total `69.99`：fail；
- raw total `69.5` 不可因顯示成 `70` 而 pass；production 必須顯示／提交 `69.5`；
- x–t `19.99`：fail；
- v–t `15.99`：fail；
- a–t `13.99`：fail；
- 任一 mission `9.99`：fail；
- 其他三個 mission 滿分但 Mission 4 完全空白：fail；
- 正確所有 `x–t`，但每幅 `v–t` 只答對 `v(0)`、每幅 `a–t` 只答對 `a(0)`：
  即使 raw total、family及mission floors達標，仍因兩個 representative gates而 fail；
- Mission 2／3 沒有任何一個完整正確三圖情境：fail；
- Mission 4 的 `x–t`、`v–t` 或 `a–t` 任一控制點錯：fail；
- Mission 4 只有 `x(0)` 錯，即使 `x(T/2)`、`x(T)`、`v–t`、`a–t` 正確：fail；
- 學生只答所有起點但沒有末點：只取得相應 point 分；
- `a(0)` 正確、`a(T)` 錯誤：保留 3.5；
- `x–t` 三點全部正確，但另外兩圖錯：`x–t` 仍取滿分，另顯示跨圖矛盾。

---

## 13. Tolerance

### 13.1 權威比較

第一版答案在 UI 只能落於整數 snap cells，因此正式比較採：

```text
student cell ID === target cell ID
```

Production persistence 只接受 `Number.isSafeInteger` 的 canonical cell ID。非整數 raw 值在
decode／input boundary 已經無效，不可進入正式 scorer。不存在 floating-point、百分比或像素容差。

### 13.2 解釋性容差

正式 accepted range 是「同一個 canonical snap cell」，不是半個 cell 的模糊區：

| Quantity | UI step | Accepted range | Just inside | Just outside |
|---|---:|---:|---|---|
| `x` | `1 m` | exact target cell only | target `8`, student `8` | nearest representable `7` or `9` |
| `v` | `1 m/s` | exact target cell only | target `5`, student `5` | nearest representable `4` or `6` |
| `a` | `1 m/s²` | exact target cell only | target `-2`, student `-2` | nearest representable `-3` or `-1` |

Production input 在 commit 前先 snap，故正常學生答案只會完全相等或相差至少一個 cell；
例如 target `8` 時 student cell `9` 必定錯。`|Δ|=0.5` 及所有其他非整數不屬任何可保存的
canonical答案，必須在 input／decode boundary 拒絕。對離散格而言，正確 target cell本身是
「剛在範圍內」，相鄰 cell是「剛超出範圍」。

### 13.3 Easy-to-change constants

集中於 model／scoring modules：

```js
const INPUT_STEPS = Object.freeze({ x: 1, v: 1, a: 1 });
const ACTIVATION_THRESHOLD_CSS_PX = 4;
const MAX_UNDO = 24;
```

任何改變 snap step 都必須重新驗證：

- 全部 paper；
- axis 可讀性；
- scoring cell semantics；
- persistence canonicalization；
- 手機 drag；
- just-inside／outside tests。

---

## 14. Feedback

### 14.1 優先次序

每幅圖最多顯示兩項主要回饋：

1. 未設定／partial；
2. 起點或初值；
3. 中間點／曲率；
4. 終點或停止條件；
5. 正負號；
6. 直線斜率或水平高度；
7. 同一情境最重要的跨圖矛盾。

### 14.2 Graph-level derived feedback

`x–t` 三點完整時可顯示：

```text
你的 x–t 圖暗示：
x₀ = ...
v₀ = ...
a = ...
```

`v–t` 兩點完整時可顯示：

```text
你的 v–t 圖暗示：
v₀ = ...
a = (v(T)-v(0))/T = ...
```

`a–t` 兩點完整時：

- 兩端相同：顯示固定加速度值；
- 兩端不同：指出學生建立了隨時間改變的加速度，不符合勻變速。

### 14.3 回饋例子

- `x₀` 錯：「你的圖線在 `t=0` 從錯誤位置開始；先把題目的初始位置放到縱軸截距。」
- 勻速終點錯：「起點正確，但 `x(T)` 不符 `x=x₀+vT`，所以直線斜率代表了另一個速度。」
- 中點錯：「首尾位置正確，但中間點錯誤；這會建立另一條二次曲線。」
- 漏 `½`：「你的中間及終點位置偏大；代入 `½at²` 時要保留 `½`。」
- `v₀` 漏掉：「你的 `v–t` 圖由零開始，但題目中的物體在 `t=0` 已有初速度。」
- `v(T)` 錯：「先計算速度改變 `aT`，再加上初速度 `v₀`。」
- 負加速度符號錯：「題目是勻減速，`a–t` 圖應在零軸下方。」
- 停止條件錯：「物體在 `T` 剛好停止，所以 `v(T)=0`。」
- 跨圖：「你的 `v–t` 圖斜率表示 `a=+2 m/s²`，但 `a–t` 圖設定為 `+1 m/s²`。」
- 未作答：「這個控制點仍未設定，因此本部分沒有可評分答案。」

### 14.4 提交前禁止

提交前不顯示：

- point correctness；
- 正確數值；
- 得分；
- 正確線；
- 正確線容許區；
- 自動代入結果；
- 「較接近答案」方向提示。

可以顯示：

- 控制點是否未設定；
- 兩點／三點是否足夠生成圖線；
- 值是否超出合法 axis；
- input 是否為合法整數。

---

## 15. Responsive layout contract

- Control-panel classification：`bounded split-panel`。
- 原因：學生需要在 stage 觀察圖線，同時反覆使用 point rows、數值 input、stepper、公式卡及
  navigation；stage 必須在操作 control panel 時保持可見。
- `html`／`body`：`height:100%`、`overflow:hidden`，在 bounded iframe 內不可有 usable
  vertical scroll range。
- `.graph-app`：`height:100vh`，再以 `100dvh` enhancement；`min-height:0`。
- phone／窄 tablet：
  - 上列 stage；
  - 下列 independently scrolling controls；
  - normal-height stage track 初始：

    ```css
    minmax(13rem, min(48vh, 48dvh))
    ```

  - 實作 spike 可在 `42–52dvh` 內調整，但須記錄最終值及證據。
- extreme-height／layout-zoom／software-keyboard compact mode：
  - 當 effective app height `<=420 CSS px`，或 `visualViewport.height` 顯示鍵盤令可用高度進入
    同等範圍，取消 `13rem` minimum；
  - compact stage track 起始值：

    ```css
    clamp(5.5rem, 34dvh, 9rem)
    ```

  - graph、dock、labels按 stage可用寬高等比例縮放或減少非必要 minor labels；
  - 不建立 stage scroller；
  - point row number input／stepper保持完整等價操作，因此極矮畫面不要求以縮小圖板作精細拖動；
  - controls panel必須仍有正高度、可捲到 primary action及active input；
  - app以 `visualViewport`／`ResizeObserver` 只觸發 layout recompute，不改答案、不保存 transient size；
  - `320×500 at 200% layout zoom`、約 `160×250 CSS px` effective viewport及實際 software-keyboard
    open／close均須以 browser evidence鎖定最終 compact constants。
- controls panel：
  - `min-height:0`；
  - `overflow-y:auto`；
  - `overscroll-behavior:contain`；
  - 是 activity 內唯一 vertical scroll owner。
- desktop `>=820px`：
  - controls 在左，`clamp(18rem,24vw,25rem)`；
  - stage 在右並填滿剩餘空間；
  - controls 仍可獨立捲動；
  - stage 不建立縱向 scroller。
- controls DOM 先於 stage，配合桌面左→右閱讀順序；
- 窄屏以 CSS 視覺把 stage 置上，不改 semantic DOM order；
- graph board 不橫向捲動；
- stage 以可用寬高維持約 `4/3` aspect ratio；
- `320×500` 仍可設定所有控制點；
- software keyboard 出現時：
  - controls 的 active input 可捲到可見；
  - primary action 仍可到達；
  - app body 不產生第三 scroll owner；
  - stage 必須切換到上述 compact track，不可停留在 `13rem` minimum，亦不可變成獨立 scroller。
- 200% layout zoom：
  - reflow 為單欄；
  - 無水平溢出；
  - graph、point rows、primary action 可達。
- technical／safe-summary 畫面無 active graph 時可收起 stage，讓 controls 使用完整高度。

---

## 16. Touch gesture ownership contract

### 16.1 Draggable target inventory

| Target type | Selector／hit-target strategy | Pointer-capture target | Drag 中可替換？ |
|---|---|---|---:|
| 未設定 `x` point | 固定 HTML `.point-hit[data-quantity="x"]`，dock 中至少 `48×48` | hit target 自身 | 否 |
| 已設定 `x` point | 同一固定 HTML hit target，只更新 transform | hit target 自身 | 否 |
| 未設定 `v` point | 固定 HTML `.point-hit[data-quantity="v"]` | hit target 自身 | 否 |
| 已設定 `v` point | 同一固定 HTML hit target，只更新 transform | hit target 自身 | 否 |
| 未設定 `a` point | 固定 HTML `.point-hit[data-quantity="a"]` | hit target 自身 | 否 |
| 已設定 `a` point | 同一固定 HTML hit target，只更新 transform | hit target 自身 | 否 |
| 結果時間游標 | 固定 HTML `.time-cursor-hit`，只讀 review 可操作 | hit target 自身 | 否 |

`x`、`v`、`a` 分開列為 target types，測試不可只驗一種後假設其餘相同。

### 16.2 Gesture ownership matrix

| Touch starts on | Expected owner | Expected scroll delta | Required pointer result |
|---|---|---:|---|
| `.stage-region` 已知非互動 padding／plot blank region | Enclosing page／Moodle host | host 非零且 iframe 同向移動；activity document、visual viewport及 panel 為 0 | 不選點、不改答案、不開始 drag |
| `.controls-panel` 普通文字／空白 | Controls panel | panel 有 range 時非零；host、iframe、document、兩個 visual viewport 為 0 | stage 及 learner state 不變 |
| `.controls-panel` 頂／底 boundary outward swipe | Controls panel | panel 保持 boundary；host、iframe、document、visual viewports 為 0 | gesture 不洩漏，不改 learner state |
| 任一 `x` point hit target | Simulation | 所有 host／document／panel／viewport／iframe delta 為 0 | point 改變；有 `pointermove`、`pointerup`；無 `pointercancel` |
| 任一 `v` point hit target | Simulation | 全部 0 | 同上 |
| 任一 `a` point hit target | Simulation | 全部 0 | 同上 |
| 結果時間游標 | Simulation | 全部 0 | cursor 改變；權威答案及 score 不變；無 `pointercancel` |
| point row button／input | Native control | 不因 tap 捲動 host | 每次只改一次指定 point |
| Active drag期間第二個touch亦由另一個point hit target開始 | Simulation仍只保留原active pointer | 所有scroll delta為0 | 忽略第二pointer；不接管、不改第二點、不建立第二undo；原drag可正常完成 |
| Active drag期間第二個touch由blank stage開始 | Enclosing page／host，按blank-stage規則 | host／iframe可非零；activity document及panel為0 | 原point drag先rollback且不得commit；之後第二touch不被simulation重新分配 |
| Active drag期間第二個touch由controls panel開始 | Controls panel，按panel規則 | panel有range時可非零；host／iframe／document為0 | 原point drag先rollback且不得commit；panel gesture不改learner answer |

### 16.3 Technical decision

- stage root blank region：`touch-action:pan-y`；
- 每個 point hit target：`touch-action:none` 在 `pointerdown` 前已生效；
- 結果 `.time-cursor-hit`：`touch-action:none` 在 `pointerdown` 前已生效；
- controls panel：原生 `pan-y`、independent scroll；
- active drag 的第二個 pointer 若從 controls panel 開始：先 in-place rollback 原 drag，不替換
  hit target DOM；Chrome 不會在第一指已由 `touch-action:none` target capture 後為第二指另開 native
  panel pan，因此只為此 continuation capture 第二 pointer，按起始 `scrollTop` 與 `clientY` 手動作
  bounded panel scroll；不改靜態 `touch-action:pan-y`，不加 document TouchEvent guard，亦不改一般
  單指 panel 的原生捲動；
- controls panel：`overscroll-behavior:contain`；
- 不在整幅 stage 或 SVG 設 `touch-action:none`；
- SVG inner graphics 不是 gesture boundary；
- hit target 有 explicit CSS size；
- capture target 全程 mounted；
- render 只更新 transform／label／path；
- result cursor hit target在整個cursor drag保持mounted；render只更新其transform及readout；
- active drag 只接受 primary pointer；
- 第二pointer若由另一drag target開始只被忽略；若由blank stage或panel開始，simulation須把
  目前working value回復到pre-drag authoritative value，解除原capture／drag state，並讓第二pointer
  保持其start-region owner；multi-touch cancellation不得保存半完成答案；
- 不把 stage gesture 轉送 sibling controls；
- 不呼叫 `parent.scrollBy` 作一般路由；
- bounded activity document 不可成為第三 scroll owner；
- development source 及 built／extracted SCORM 均在 scrollable Moodle-like iframe host 以 trusted
  touch input 測完整 matrix；
- direct standalone 沒有 host scroll range時，只可把 blank-stage non-zero delta 標為 N/A；
  packaged iframe gate 不可用此例外；
- Moodle current-window 及 offered new-window 必須用 real phone 重複。

### 16.4 Drag evidence

每次 trusted touch test 前後記錄：

- host `scrollY`；
- host visual viewport offset／pageTop（可量度時）；
- iframe bounding rect；
- activity document `scrollTop`；
- activity visual viewport offset；
- controls panel `scrollTop`；
- active point value；
- answer array；
- phase／taskIndex／selected point；
- pointer event counts及 `isTrusted`／`pointerType`。

---

## 17. Keyboard and accessibility

### 17.1 Point keyboard

每個 point hit target：

- `Tab` 聚焦；
- `Enter`／`Space` 選取；
- `Up`／`Right`：增加一步；
- `Down`／`Left`：減少一步；
- `Shift + Arrow`：增加／減少 5 步，但仍 snap 及 clamp；
- `Delete`／`Backspace`：設回未設定；
- `Escape`：取消未 commit keyboard operation；
- 更新 point row 及 graph；
- 每次 key commit 建立一個 undo step。

### 17.2 結果時間游標

提交後的 `.time-cursor-hit` 是可聚焦 slider：

- `role="slider"`；
- `aria-valuemin="0"`、`aria-valuemax=T`、`aria-valuenow`及包含秒數的`aria-valuetext`；
- `Left`／`Down`：`t` 減少 `0.5 s`；
- `Right`／`Up`：`t` 增加 `0.5 s`；
- `Home`：`t=0`；
- `End`：`t=T`；
- pointer及keyboard均使用同一`0.5 s` snap、clamp及readout；
- cursor只改result review的transient display time，不改authoritative answer、score、passed或snapshot；
- pointercancel回復drag前的display time，不影響任何learner answer；
- cursor accessible name說明它同步查看該情境的`x(t)`、`v(t)`、`a(t)`；
- cursor移動後以節流`aria-live`讀出時間及三個正確物理量；有完整學生圖時另讀學生圖對應值；
- result graph重新render時hit target不可被替換，焦點不可無故遺失。

### 17.3 Accessible graph summary

active graph 提供：

- 圖名、軸、單位、範圍；
- mission data；
- 每個固定時間 point 的目前狀態；
- generated line：
  - 未完成；
  - 直線；
  - 二次曲線；
- 不在提交前朗讀正確答案或對錯。

### 17.4 General

- 所有控制最少 `44×44 CSS px`；
- selected point 不只靠顏色；
- focus ring 清楚；
- point IDs、時間及單位可見；
- input 有完整 label；
- drag 有 number-input及 stepper 等價替代；
- `aria-live="polite"` 只在 commit 後簡短報讀，不在每個 pointermove 發聲；
- pointermove 的視覺 coordinate label 可即時更新但節流；
- reduced motion 移除非必要動畫；
- learner-facing `x`、`v`、`a`、`t` 使用 `<var>`；
- 技術錯誤不稱為已提交、合格或不合格；
- result graph 是只讀圖像；只有時間游標保持可操作；
- formula card 使用原生 button／region relationship；
- 不使用不完整 ARIA tabs。

---

## 18. Runtime files and responsibilities

建議 production shape：

```text
sim/kinematics-quantitative-graph-builder/
  index.html
  styles.css
  main.js
  question-definitions.js
  question-definitions.test.js
  graph-model.js
  graph-model.test.js
  scoring.js
  scoring.test.js
  persistence.js
  persistence.test.js
  ui-policy.js
  ui-runtime.test.js
  accessibility.test.js

sim/manifests/kinematics-quantitative-graph-builder.xml
tools/kinematics-quantitative-graph-browser-regression.js
```

重用：

```text
sim/shared/styles.css
sim/shared/scorm.js
sim/shared/activity-flow.js
```

責任：

- `question-definitions.js`
  - question-set version；
  - paper definitions；
  - mission prompts；
  - axis definitions；
  - control times；
  - target value calculation；
  - paper validator。
- `graph-model.js`
  - point answer validation；
  - snap／clamp；
  - line equation；
  - quadratic interpolation；
  - implied physical parameters；
  - coordinate transforms；
  - Editor／undo／redo；
  - 不知道分值或 SCORM。
- `scoring.js`
  - point components；
  - graph-family及mission totals；
  - mastery gates；
  - cross-graph diagnostics；
  - feedback priority；
  - final result。
- `persistence.js`
  - schema；
  - phase/state validation；
  - compact answers；
  - draft／review encode/decode/restore；
  - size guard。
- `ui-policy.js`
  - shared lifecycle outcome 到誠實 learner-facing UI。
- `main.js`
  - DOM wiring；
  - stable hit targets；
  - Pointer Events；
  - keyboard；
  - SVG render；
  - phase transitions；
  - draft save；
  - shared SCORM glue。

不複製：

- shared SCORM API lookup；
- commit／finish；
- BFCache lifecycle；
- activity-flow trust logic。

---

## 19. Phase/state matrix

Production editable phases：

```text
practice
task
review
```

完成後由 finished review snapshot 及 shared lifecycle 呈現，不建立 activity-local
`submitted` persistence phase。

| Phase | Variant／invariant | Current step | Required semantic state | Must be absent／pristine | Allowed next action |
|---|---|---:|---|---|---|
| `practice` | new／restored | none | `qv=1`；`visitedMask=0`；12 answers null；尚未選 paper | `pid`、`taskIndex`、`variant` | 練習；開始挑戰 |
| `task` | first-pass mission 1 | `0..2` | 合法 paper；目前 mission `x–t` 及 active graph visited；visited answers 可 null／partial／complete | future mission visited bits／answers | 同 mission切換；下一幅；下一 mission |
| `task` | first-pass mission 2–4 | `3..11` | 合法 paper；所有 prior missions 全 visited；目前 mission `x–t` 及 active graph visited | future mission visited bits／answers | 同上；最後進 review |
| `task` | review-edit | `0..11` | 合法 paper；`visitedMask=0xFFF`；answers 可 null／partial／complete | 無 future restriction | 同 mission切換；返回 review |
| `review` | incomplete | none | 合法 paper；全 visited；至少一圖 null／partial | `taskIndex`、`variant` | 編輯；警告後提交 |
| `review` | ready | none | 合法 paper；全 visited；12 圖均 complete | `taskIndex`、`variant` | 編輯或提交 |

### 19.1 Transitions

```text
practice
  -> task(first-pass, Mission 1 x–t)
     when learner starts challenge and paper selection is committed

task(first-pass, graph)
  -> task(first-pass, another graph in same mission)
  -> task(first-pass, next mission x–t)
     when all three current mission graphs have been visited
  -> review
     when all 12 graphs have been visited

review
  -> task(review-edit, selected graph)
  -> shared submission after explicit confirmation

task(review-edit)
  -> task(review-edit, another graph in same mission)
  -> review

success／committed
  -> locked review

frozen
  -> locked retry of identical pending payload

retryable retry
  -> editable review with same answers

non-retryable retry
  -> technical lock
```

### 19.2 Invariants

- canonical task order是四個 mission，每個 `x–t, v–t, a–t`；
- active editor只修改 `answers[taskIndex]`；
- `visited` 不代表 point complete；
- answer 可為 null 或合法 partial point array；
- 全部 entries均為null的point array不是canonical，encoder必須折疊成answer `null`；
- first-pass future mission answers 必須 null；
- first-pass 未 visited graph 不可有 answer；
- review-edit 可保留所有 future answers；
- review 可含 partial／null，因 learner 可明確提交未完成答案；
- selected point、formula-card open、active input、pointer state不是 semantic continuation；
- restore 後沒有 selected point仍可合法選取並繼續。

---

## 20. Persistence contract

### 20.1 Draft answer

Learner-facing key names在文件使用完整名稱；production encoder可使用以下 compact schema：

```js
{
  v: 1,
  qv: 1,
  phase: "practice" | "task" | "review",
  pid: "A",              // task/review only
  ti: 0,                 // task only
  mode: "first" | "edit",// task only
  vm: 0,                 // 12-bit visited mask
  ans: [
    null,
    [0, 20],
    [5, null]
  ]                      // exact length 12
}
```

實際每個 `ans[i]`：

- `null`：未有任何 point；
- point array：固定長度 2 或 3；
- each entry：`null` 或 canonical integer。
- 若point array全部entries為`null`，production canonicalizer必須輸出`null`；decoder拒絕
  all-null array，避免同一authoritative answer有兩種encoding。

### 20.2 Review answer

```js
{
  v: 1,
  qv: 1,
  locked: 1,
  pid: "A",
  ans: [/* exact 12 canonical point arrays/null */]
}
```

Review 必須足以：

- validate question paper；
- restore student control points；
- regenerate every student line；
- rescore；
- regenerate feedback；
- redraw result；
- compare canonical authoritative review during pending retry。

Shared envelope comparison metadata must be validated separately：

- `score` finite and within `0..100`；
- `maxScore` exactly `100`；
- `passed` boolean；
- recomputed `score`／`passed` must match before detailed trusted review；
- invalid or mismatched finished metadata yields locked safe Moodle summary；
- invalid or mismatched pending metadata is quarantined before retry。

Because shared `SimScorm.makeSnapshot()` currently adds `score` and `passed` but not `maxScore`, the activity
must use one small local builder rather than calling it bare for a review：

```js
function makeReviewSnapshot(reviewAnswer, result) {
  const snapshot = SimScorm.makeSnapshot(ACTIVITY, "review", reviewAnswer, result);
  snapshot.maxScore = result.maxScore;
  assertSnapshotSize(snapshot);
  return snapshot;
}
```

- `result.maxScore` must be exactly `100` before the builder runs；
- the builder adds metadata only；it must not duplicate LMS write、commit、finish或 lifecycle logic；
- the same builder output is passed to `submitWithCallbacks()` and used in pending／finished validation tests；
- draft snapshots continue to call `SimScorm.makeSnapshot(ACTIVITY,"draft",answer)` directly；
- tests must prove that a normal submitted review contains `maxScore:100` and reopens as detailed trusted review。

不保存：

- correct target points；
- derived line coefficients；
- axis pixels；
- SVG path；
- score／passed as answer；
- feedback text；
- cross-graph diagnostics；
- selected point；
- undo／redo；
- formula-card state；
- pointer state；
- DOM refs。

### 20.3 Authoritative／derived／transient

Authoritative：

- schema version；
- question-set version；
- paper ID；
- phase／mode／task index；
- visited mask；
- point arrays。

Derived：

- paper parameters；
- control times；
- target points；
- axis ranges；
- line／quadratic coefficients；
- SVG；
- completeness；
- score／pass；
- feedback；
- graph summaries；
- button states。

Transient：

- active pointer ID；
- drag backup；
- selected point；
- pointer coordinate；
- input focus；
- undo／redo；
- formula card open；
- time-cursor hover。

### 20.4 Save boundaries

Save：

- pointerup after actual snap-cell change；
- number input commit；
- stepper click；
- clear point／clear graph；
- undo／redo；
- graph／mission navigation；
- phase change；
- entering review；
- shared lifecycle draft flush。

Do not save：

- pointerdown；
- tap-only；
- every pointermove；
- selection highlight；
- formula-card toggle；
- result time-cursor movement。

Active drag during pagehide：

- rollback to pre-drag authoritative point；
- draft provider returns last committed answer；
- restore has no active pointer。

### 20.5 Restore validation

- exact supported `v`；
- exact supported `qv`；
- legal phase／mode／task index；
- legal `pid` for that question version；
- exact answers length 12；
- point array length matches task；
- each point null or finite canonical integer；
- all-null point array rejected／canonical production encoder collapses it to answer null；
- each value within that task axis range；
- no unknown fields in canonical activity answer if strict encoder requires；
- first-pass prior/current/future visited invariants；
- unvisited graph has null answer；
- practice has no paper；
- task／review has paper；
- review has full visited mask；
- review `locked=1`；
- canonical re-encode stable；
- derived coefficients finite when enough points exist；
- scorer result identical after round-trip；
- scorer `passed` decision identical after round-trip；
- legal next action identical after round-trip。

Structurally valid but physically wrong values remain valid learner answers. Examples：

- `v(T)<0`；
- `a(0)≠a(T)`；
- wrong `x(T/2)`；
- three-point curve implying wrong acceleration；
- inconsistent three graphs。

These must restore and score normally; they are not corrupt snapshots.

### 20.6 Size budgets

Targets：

```text
activity draft answer           <= 1600 UTF-8 bytes
activity review answer          <= 1300 UTF-8 bytes
shared review envelope          <= 2200 UTF-8 bytes
full pending-final checkpoint   <= 3200 UTF-8 bytes
project absolute ceiling        < 4000 UTF-8 bytes
```

Production encoder must test maximum partial arrays and maximum review envelope with `TextEncoder`.

### 20.7 Invalid snapshot policy

- Invalid editable draft：
  - fail closed；
  - lock unsafe actions；
  - show technical load error；
  - do not silently reset or overwrite；
  - only add a reset path if shared runtime later provides a formal tested clear API and this plan is updated。
- Invalid finished review：
  - remain locked；
  - show only trustworthy Moodle summary；
  - never reopen editing。
- Pending-final：
  - validate nested review；
  - restore authoritative points；
  - rescore；
  - require finite saved `score` in `0..100`、`maxScore===100`及boolean `passed`；
  - compare canonical answer、recomputed `score`、`maxScore`及`passed`；
  - deeper failure calls `SimScorm.quarantinePending()`；
  - never retry rejected payload。
- Unsupported old version：
  - fail closed unless an explicit tested migration is added。

### 20.8 Required round-trip invariant

For every saveable matrix row／variant：

```text
score(original) === score(restore(encode(original)))
passed(original) === passed(restore(encode(original)))
legalNextAction(original) === legalNextAction(restored)
```

Each fixture must execute one production legal continuation after restore。

---

## 21. Shared SCORM lifecycle

### 21.1 Startup

```js
const attempt = SimScorm.loadAttempt(ACTIVITY);
const startupState = SimActivityFlow.startup(attempt);
```

| Outcome | Editable? | Learner-facing behavior |
|---|---:|---|
| `review` | 否 | validate review、restore points、rescore、trust comparison、locked review 或 safe Moodle summary |
| `editable` | 是 | create／restore draft，register latest draft provider |
| `frozen` | 否 | validate immutable pending payload and retry same payload；不聲稱提交或可信分數 |
| `load-error` | 否 | technical lock；不顯示 pass／fail／submitted claim |

### 21.2 Submission

```js
SimScorm.submitWithCallbacks(result, reviewSnapshot, callbacks)
SimActivityFlow.submission(outcome, handlers)
```

| Outcome | Editable? | Learner-facing behavior |
|---|---:|---|
| `success` | 否 | submitted locked review |
| `committed` | 否 | committed result locked；可 retry finish |
| `frozen` | 否 | pending／unconfirmed；retry identical payload；score、pass、fail顯示 `--` |
| `retry` retryable | 是 | 返回 review；保留相同 paper及 points；可重新提交 |
| `retry` non-retryable | 否 | technical lock；不承諾 retry |

### 21.3 Finished restore

```text
validate review snapshot
→ rebuild paper
→ restore authoritative point arrays
→ regenerate graph models
→ activity scorer
→ SimActivityFlow.reviewResult(computed, saved metadata, Moodle attempt)
```

- saved metadata is comparison-only；
- unknown Moodle completion不可顯示「不合格」；
- trust mismatch抑制不可信詳細回饋；
- finished attempt始終鎖定；
- Live Server使用同一 submission path及 local fallback；
- activity不得新增 raw LMS calls、pagehide commit、finish或 BFCache logic。

---

## 22. Test plan

所有新 test files 加入 `tools/run-tests.js`。

### 22.1 Question definitions

- six unique paper IDs；
- every paper has four mission types in correct order；
- every mission parameters finite；
- validator checks all §7.5 constraints；
- all target points are integers；
- all correct graphs fit axes；
- Mission 4 stops exactly at `T`；
- no correct graph reverses；
- question copy shows exactly scorer values；
- axis headroom does not equal target endpoint；
- question version and paper rebuild deterministic；
- no released paper mutation。

### 22.2 Graph model

- integer snap positive／zero／negative；
- clamp at axis top／bottom；
- coordinate transform round-trip；
- tap-only no change；
- activation threshold；
- grab offset；
- primary pointer only；
- second pointer on another drag target ignored while primary drag remains authoritative；
- pointerup commit；
- pointercancel／blur／lost capture rollback；
- number input validation；
- stepper；
- clear point／graph；
- undo／redo；
- per-task history；
- line through exact endpoints；
- quadratic through all three exact points；
- representative Paper A coefficients；
- implied `x₀,v₀,a`；
- incomplete points produce no line；
- wrong points still produce deterministic finite curve；
- resize does not alter values；
- path sampling is render-only。

### 22.3 Scoring

- every point component；
- partial answers；
- empty answers；
- mission totals 25；
- graph totals `40/32/28`；
- total 100；
- no score rounding；canonical half-point totals preserved through result and SCORM；
- score floor／ceiling；
- exact snap cell comparison；
- exact target cell acceptance and adjacent-cell rejection for `x`、`v`、positive `a`及negative `a`；
- noninteger raw values including explicit `|Δ|=0.5` rejected at input／decode boundary for every quantity；
- pass threshold及 all mastery gates exact／±0.01；
- raw `69.5` remains score `69.5` and fail；no pre／post-rounding ambiguity；
- subject counterexample：all `v(0)` correct／all `v(T)` wrong、all `a(0)` correct／all `a(T)` wrong，
  even with total／family／mission floors, fails representative gates；
- positive-acceleration representative gate complete／one-point-missing cases；
- deceleration representative gate complete／every one-point-wrong-or-missing case, including only `x(0)` wrong；
- no process penalty；
- inconsistent graphs do not double-deduct；
- cross-graph diagnostics deterministic；
- maximum two graph feedback messages；
- Mission 4 wrong sign／wrong zero endpoint；
- correct `x–t` but wrong `v–t` remains independently scored。

### 22.4 Persistence

For every state-matrix row and invariant variant：

- production encode／decode／restore；
- score equality；
- passed equality；
- legal continuation；
- practice with no paper；
- first-pass every mission and active graph；
- active answer null／partial／complete；
- prior mission requirements；
- future mission restrictions；
- review-edit with all future answers retained；
- review incomplete／ready；
- answers length；
- point array lengths；
- all-null point array decode rejection and production encode collapse to answer null；
- null entries；
- noninteger、negative where axis disallows、out-of-range、`NaN`、`Infinity`；
- invalid paper/version；
- invalid phase/mode/task；
- visited-mask missing prior／current bits；
- future bit／answer；
- unvisited graph answer；
- review task fields forbidden；
- structurally valid wrong physics accepted；
- max snapshot sizes；
- invalid editable fail-closed；
- invalid finished locked fallback；
- pending deeper reject quarantines。

### 22.5 Lifecycle UI

- startup `review`、`editable`、`frozen`、`load-error`；
- submission `success`、`committed`、`frozen`、retryable `retry`、non-retryable `retry`；
- trusted review；
- local `makeReviewSnapshot()` adds `maxScore:100`, stays below size budget, and a normal shared submission
  reopens as detailed trusted review rather than safe fallback；
- score mismatch；
- pass mismatch；
- finished `maxScore` missing、zero、nonfinite、not `100`及mismatched；
- pending `maxScore` missing、zero、nonfinite、not `100`及mismatched all quarantine before retry；
- canonical answer mismatch；
- unknown Moodle status；
- invalid finished metadata；
- technical states use honest wording；
- actual production outcome/render functions, not source-string tests。

### 22.6 Interaction and responsive

Development source and built／extracted package：

- `320×500`、`390×500`、`390×600`；
- normal portrait、landscape、tablet、desktop；
- software keyboard；
- browser toolbar change；
- 200% layout zoom；
- begin with partial in-progress points, dynamically resize across desktop／phone widths and short heights,
  rotate portrait↔landscape, and open／close software keyboard；after each change assert authoritative answers
  unchanged, stable HTML hit targets still align with SVG points／docks, keyboard focus and number inputs remain
  reachable, point drag still works, controls panel remains the only activity scroll owner, and primary actions
  remain reachable；
- run the same dynamic resize／orientation sequence against source and built／extracted package；
- no horizontal scroll；
- point rows and primary actions reachable；
- controls only panel scroll；
- body/app no third scroll owner；
- desktop controls left／stage right；
- phone stage top／controls bottom；
- stage remains visible during panel gesture；
- all unset docks visible；
- correct line appears only when all required points set；
- no default answer line；
- formula card does not compute；
- graph switching preserves values；
- review-edit preserves all values；
- selected point and row stay synchronized；
- at `390px` and `320px`, trusted drags on both leftmost and rightmost point targets show an ID-free
  fixed-opposite-corner SVG magnifier with local grid／guide／axis context, live student path, actual marker,
  crosshair and complete coordinate；its outer rect stays fixed while its clamped local viewBox changes with
  vertical drag, and it hides on every end／rollback path；
- adjacent drag label、magnifier copy、point context、control symbol及unit have computed normal font
  weight；visible rows use `Pₙ，t=… s` context plus one-line `xₙ／vₙ／aₙ: input unit − + 清除`
  controls；input ARIA explicitly announces the matching point index, time, quantity and unit；
- at `320px` and `390px`, each point control line keeps symbol、input、upright no-wrap unit and all three
  actions on one row without panel／row horizontal overflow, while each action remains at least `44×44px`；
  check both unscored practice rows, every `x／v／a` row in a two-point task, and exact per-graph cardinality
  in an accelerated task (`x₀／x₁／x₂`, but only `v₀／v₁` and `a₀／a₁`)；for every rendered row, run the same
  semantic-subscript、indexed ARIA/time/unit、positive-input-width、ordered/aligned one-line geometry、
  `44×44px` action and line／row／panel overflow assertions；
- prompts、summaries、feedback、ARIA、drag labels and magnifier copy use `m/s` and `m/s²` consistently；
- each main graph and magnifier has direct ID-free filled triangular upward value and rightward time
  arrowheads with nonempty filled geometry, correct tip direction and no clipping；the horizontal
  `y=0` line is the sole thick horizontal axis, nonzero min／max boundaries remain thin grid lines, and the
  `x–t` bottom zero line is thick exactly once；main graph、magnifier context及orientation cue shafts stop
  exactly at the respective triangle bases, and each graph/lens has exactly one horizontal and one vertical
  axis meeting at one round/geometricPrecision origin without a doubled segment；
- every unset `x`／`v`／`a` graph accessible name includes its vertical-range unit (`m`／`m/s`／`m/s²`)；
- during a representative zero-value `v`／`a` touch drag, the magnifier keeps a rendered rightward `t` and
  upward value cue inside its current viewBox without changing its fixed opposite corner or covering the
  central marker/crosshair or separate coordinate readout；browser checks also require computed display,
  visibility and opacity for the magnifier context, zero axis, main axis arrows and nonzero boundary grids；
- student path／correct path distinguishable by more than color；
- result time cursor changes no answer。
- result time cursor hit target has pre-pointerdown `touch-action:none`, remains mounted during drag, and
  preserves focus across result rerenders；

### 22.7 Trusted touch

On source and extracted package in scrollable Moodle-like iframe：

- blank-stage swipes both directions move host／iframe only；
- controls ordinary swipes move panel only；
- controls top／bottom boundary outward swipes do not leak；
- every `x` target drag；
- every `v` target drag；
- every `a` target drag；
- unset dock to plot drag；
- set point drag；
- result time-cursor drag；
- host／document／panel／visual viewport／iframe deltas per matrix；
- `isTrusted=true`；
- touch pointer type；
- pointermove／pointerup；
- no pointercancel；
- active-drag multi-touch from another point target leaves scroll fixed and ignores the second point；
- active-drag second touch from blank stage rolls back the first drag and follows host-owner row；
- active-drag second touch from panel rolls back the first drag and follows panel-owner row；
- tap-only no answer；
- learner state only changes for intended target。

DOM `dispatchEvent`、source inspection、computed CSS及 programmatic `scrollTop` 不可作 acceptance gesture。

### 22.8 Accessibility

- controls-before-stage DOM order；
- accessible graph summary；
- full point labels；
- keyboard point adjustment；
- delete point；
- number input equivalent；
- result time cursor slider semantics, `0.5 s` Arrow stepping, Home／End, clamp, focus retention and
  throttled synchronized `x(t)`／`v(t)`／`a(t)` announcement；
- result cursor pointer／keyboard movement leaves authoritative answers、score、passed及snapshot unchanged；
- formula card relationships；
- no color-only status；
- live-region throttling；
- reduced motion；
- locked graph semantics；
- technical wording；
- no incomplete ARIA tabs。

### 22.9 Package

- manifest includes every runtime dependency；
- source-to-manifest dependency parity audit parses every local `script[src]`、stylesheet／icon／other
  `link[href]`、media／asset URL及code-loaded local runtime asset；the referenced set must exactly be declared
  in the activity manifest (except explicitly documented data URLs), so an asset omitted from both manifest and
  ZIP cannot escape the gate；
- tests excluded；
- root `imsmanifest.xml`；
- `sim/config.js` registration；
- tests in `tools/run-tests.js`；
- `npm run check`；
- `npm test`；
- `npm run package:all`；
- `git diff --check origin/main...HEAD`；
- ZIP entries exactly match manifest；
- built／extracted browser smoke；
- built／extracted complete touch matrix。

---

## 23. Acceptance criteria

### 23.1 Teaching

- 學生必須設定具體物理坐標，不可只選擇圖形；
- 手機手指精度不影響正確 cell；
- 每個 point 都有真實物理意義；
- `x–t` 二次曲線由三個 graph points精確建立；
- 不使用曲線外手柄；
- 正確三點生成精確正確曲線；
- 錯誤三點生成忠實錯誤曲線；
- 四類運動均由所有學生完成；
- `x–t`、`v–t`、`a–t` 都有 mastery floor；
- 學生不能完全跳過減速題仍合格；
- 提交後可把自己的值、圖線及三圖關係連結；
- 提交前不洩漏答案。

### 23.2 Interaction

- touch、mouse、keyboard、number input均可完成同一 learner task；
- fixed-time point只垂直改值；
- snap及label即時一致；
- unset state不構成答案；
- tap-only不意外設定；
- pointercancel不留下半完成值；
- point target不被 finger完全遮蔽，必要時實作局部 coordinate label而非移動物理點；
- graph switching、reload及review-edit保留權威答案；
- no horizontal scroll；
- primary action reachable。

### 23.3 Reliability

- pure question/model/scorer/persistence modules；
- restore preserves score and next action；
- invalid states fail closed；
- pending deeper mismatch quarantined；
- full pending checkpoint <4000 bytes；
- shared lifecycle all outcomes honest；
- submitted attempt locked；
- source and built artifact touch matrix pass；
- package root and manifest correct。

### 23.4 Moodle-ready

- real student account records score/status；
- draft resume restores same paper and points；
- pending retry reuses identical payload；
- finished attempt reopens review-only；
- new attempt follows Moodle policy；
- real phone current-window complete gesture matrix；
- offered new-window complete matrix；
- Moodle evidence recorded separately；
- local/package tests do not claim Moodle-ready。

---

## 24. Implementation sequence

### Phase A：interaction spike

1. 建立 branch及批准本計劃；
2. prototype一個兩點圖及一個三點圖；
3. stable HTML hit targets；
4. unset dock；
5. snap／grab offset／activation threshold；
6. number input／stepper equivalent；
7. bounded split-panel；
8. trusted touch matrix in Moodle-like iframe；
9. 未通過 touch及320×500不得開始完整 UI。

### Phase B：pure model and questions

1. question papers及validator；
2. axis builder；
3. point answer model；
4. line interpolation；
5. quadratic interpolation；
6. implied parameters；
7. Editor／undo／redo；
8. unit tests。

### Phase C：task UI

1. practice；
2. four mission flow；
3. graph switch；
4. point rows；
5. SVG renderer；
6. formula card；
7. review completeness；
8. accessibility。

### Phase D：scoring and review

1. point components；
2. mastery gates；
3. cross-graph diagnostics；
4. feedback；
5. correct overlay；
6. result time cursor；
7. scoring and UI tests。

### Phase E：persistence and SCORM

1. phase matrix implementation；
2. compact schemas；
3. round-trip and invalid matrix；
4. size guard；
5. shared startup；
6. shared submission；
7. pending quarantine；
8. lifecycle UI tests。

### Phase F：registration, package and browser gates

1. `sim/config.js`；
2. manifest；
3. test runner；
4. source browser regression；
5. package；
6. extracted package smoke；
7. extracted package trusted touch；
8. quality gates。

### Phase G：student／Moodle validation

1. small student pilot；
2. record completion time and interaction difficulties；
3. refine only plan-defined easy constants；
4. real Moodle student attempt；
5. current-window real phone；
6. new-window when offered；
7. record Moodle-ready evidence。

---

## 25. Package-ready checklist

- [x] 本計劃獲批准。
- [x] Slug、folder、manifest、snapshot ID一致。
- [x] Topic、learning objectives及learner task保持本文件定義。
- [x] Six v1 papers通過validator。
- [x] 所有正確控制點為整數。
- [x] 無預填答案。
- [x] 兩點直線及三點二次曲線精確。
- [x] 不使用 regression或pixel scoring。
- [x] Snap、stepper及number input一致。
- [x] Every draggable target type在inventory及trusted-touch tests內（CDP多點 continuation 限制待實機確認）。
- [x] Bounded split-panel scroll topology符合matrix。
- [x] `320×500`、landscape、keyboard-like viewport、zoom可用；實體軟體鍵盤待 Moodle-ready。
- [x] Scoring total、graph-family及mission mastery gates完成。
- [x] Persistence matrix每個row restore及continue。
- [x] Review可由authoritative points重畫及rescore。
- [x] Snapshot及pending payload低於budget。
- [x] Invalid editable draft fail closed。
- [x] Invalid finished review保持locked。
- [x] Pending deeper failure quarantined。
- [x] Shared startup／submission全部outcomes有誠實UI。
- [x] Tests加入`tools/run-tests.js`。
- [x] Runtime files加入manifest。
- [x] HTML／CSS／code-loaded local assets與manifest通過source-to-manifest dependency parity audit。
- [x] Activity加入`sim/config.js`並在 package-ready 後為`active`。
- [x] Source trusted-touch matrix通過。
- [x] Built／extracted trusted-touch matrix通過。
- [x] `npm run check`通過。
- [x] `npm test`通過。
- [x] `npm run package:all`通過。
- [x] `git diff --check`通過。
- [x] ZIP root含`imsmanifest.xml`。
- [x] Tests及development-only files不進ZIP。
- [x] Extracted launch browser smoke通過。
- [x] Assessment risk記錄為formative。

---

## 26. Moodle-ready checklist

- [ ] Package-ready完成。
- [ ] Moodle以SCORM 1.2上載。
- [ ] Student account測試。
- [ ] Score、pass、completion正確記錄。
- [ ] Draft resume保留同一paper及points。
- [ ] Pending retry。
- [ ] Finished attempt只讀。
- [ ] New attempt policy正確。
- [ ] Real phone current-window gesture matrix通過。
- [ ] Offered時new-window gesture matrix通過。
- [ ] Moodle evidence獨立記錄。
- [ ] 不把local／package evidence當作Moodle-ready。
