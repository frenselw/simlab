# 胡克定律：彈簧探究與預測實驗室

> 來源：[GitHub Issue #7](https://github.com/frenselw/simlab/issues/7)
> 文件地位：本 plan 是產品、教學、物理模型、互動、評分、持久化、SCORM、測試及驗收的 implementation blueprint。

任何改變學習目標、題庫、物理模型、評分、容差、phase、snapshot schema、手勢責任或 delayed-feedback contract 的修訂，必須先更新本 plan、相關 version 及測試，才可修改 implementation。

## Scope

- Slug：`hookes-law-spring-investigation-lab`
- Plan：`plans/17-hookes-law-spring-investigation-lab.md`
- 學生可見標題：`胡克定律：彈簧探究與預測實驗室`
- Learning objective：學生透過量度兩條未知彈簧在不同作用力下的伸長建立 \(F-x\) 關係，理解彈簧常數 \(k\)，並把自己建立的模型用於未量度情境的預測及工程設計。
- Learner task：標定自然長度、完成兩條彈簧共六次量度、建立兩條通過原點的模型線、完成三次盲測預測與一次盲測工程設計、review 後一次提交，再查看結果。
- Main interactions：spring tabs、固定負載選擇、zero marker／measurement cursor／model handle／prediction marker 拖動及鍵盤替代、第三階段的彈簧＋負載聯動預測、跨階段返回／繼續、module `− / count / +`、review-edit、final submit。
- Runtime files：`index.html`、`styles.css`、`generator.js`、`model.js`、`animation.js`、`scoring.js`、`persistence.js`、`main.js`，以及對應 tests、manifest 與 browser regression。
- Shared runtime：`sim/shared/styles.css`、`sim/shared/scorm.js`、`sim/shared/activity-flow.js`。
- Libraries：`none`
- 技術：原生 HTML、CSS、JavaScript、SVG、Pointer Events。
- 學生介面語言：繁體中文。
- 建議完成時間：20–30 分鐘；實作後以學生 pilot 的中位數及第 90 百分位再校準。
- SCORM：1.2。
- Assessment risk：`low-risk graded`
- Trusted validation for high risk：`not applicable`；本活動不是高風險評核。若日後升級為高風險，必須改用 Moodle question type、LTI 或 backend 以 seed、versions 與 authority 重新評分。
- Out of scope：見「明確不包括」。

### 核心教學問題

活動處理：

> 學生透過量度兩條未知彈簧在不同作用力下的伸長，建立 \(F-x\) 關係，理解不同彈簧有不同彈簧常數 \(k\)，再把自己建立的模型用於未量度情境的預測及工程設計。

核心關係：

\[
F=kx
\]

其中：

- \(F\)：彈簧所受拉力／平衡時負載對彈簧施加的力，單位 N；
- \(x\)：相對自然長度的伸長量，單位 m；
- \(k\)：彈簧常數，單位 N/m；
- 同一條彈簧在胡克定律適用範圍內，\(F\) 與 \(x\) 成正比；
- 同一作用力下，\(k\) 越大，\(x\) 越小，彈簧越硬；
- 在 \(F-x\) 圖上，通過原點直線的斜率為 \(k\)。

本活動不只展示「拉得越長，力越大」，而要留下完整、可重算的學習證據：

```text
標定自然長度
→ 加上指定負載
→ 等待穩定
→ 移動量度游標
→ 記錄兩條彈簧的 F–x 數據
→ 以自己的數據建立通過原點的模型線
→ 對未量度負載作三次盲測預測
→ 完成一次盲測工程設計
→ 檢查自己的最終答案
→ 一次提交
→ 才揭示正確性、理想模型、預測結果及工程測試
```

---


### Delayed-feedback 與不可妥協的產品契約

#### 2.1 最終提交前不提供任何正確性回饋

活動在最終提交前，只可提供：

- 真實探究情境中的可觀察物理現象；
- 學生自己放置的零位、游標、模型線、預測線及工程方案；
- 學生自己量得及記錄的數據；
- 完成度；
- 操作是否可以執行的技術性提示；
- prerequisite／依賴關係提示；
- 修改上游資料將清除下游答案的中性警告。

最終提交前禁止：

- 「正確／錯誤」；
- 綠剔、紅交叉或用顏色暗示答案；
- 「太高／太低／接近」；
- 正確 \(k\)；
- 理想伸長量；
- 模型線配合程度、殘差或百分比；
- 預測位置與實際位置比較；
- 工程方案安全／不安全；
- 最佳彈簧、最佳負載或最大安全負載；
- 分數、合格／不合格；
- 在 DOM、ARIA label、隱藏文字、`data-*` attribute 或不可見圖層預先放入答案。

不能只用 CSS 把正確答案隱藏；editable phase 根本不應 render 理想線、實際挑戰終點、正誤文字或 score view model。

#### 2.2 探究現象與評核答案必須分開

探究階段可以重複觀察：

- 彈簧 A／B 在 `1.0 N`、`2.0 N`、`3.0 N` 下的真實平衡伸長；
- 自己的量度游標與讀數；
- 自己的三個數據點；
- 自己建立的模型線。

這些是學生取得證據的過程，不是系統判斷答案。

評核階段則使用未在探究階段直接測試的負載。預測及工程挑戰在提交前不得播放實際結果。

#### 2.3 不設「檢查答案」或逐題試錯

- 預測及工程方案在最終提交前可自由修改；
- 可修改不等於可試錯，因為系統不會揭示任何結果；
- 不設逐題「測試」、「檢查」、「再試一次」；
- 最終提交後整個 attempt 鎖定；
- 同一 attempt 只可查看結果，不可調整答案或重新提交；
- 需要再做時，必須由 Moodle 開始另一個 attempt。

#### 2.4 以最終語意狀態及精簡操作證據評分

活動不保存完整 pointer log，亦不按以下項目加減分：

- 拖動次數；
- 完成速度；
- 使用滑鼠、觸控或鍵盤；
- 中途改過多少次；
- 曾經放錯位置；
- 是否先看 A 或 B；
- 是否按順序量度。

只保存可重算的最後證據，例如：

- 已確認的零位；
- 每個指定負載最後一次已記錄游標位置；
- 有效操作模式及最低移動證據；
- 模型控制點；
- 三個預測伸長；
- 工程方案。

---


### 學習目標及常見錯誤概念

完成後，學生應能：

1. 分辨彈簧「總長度」與「伸長量」；
2. 以未加負載時的末端位置作自然長度基準；
3. 在靜態平衡情況下，把負載作用力與彈簧張力大小連結；
4. 說明同一條彈簧的伸長量隨作用力增加；
5. 由實驗數據辨認 \(F\propto x\)；
6. 在 \(F-x\) 圖建立一條通過原點的模型直線；
7. 把 \(F-x\) 圖斜率解釋為彈簧常數 \(k\)；
8. 比較兩條彈簧：同一 \(F\) 下，伸長較少者有較大 \(k\)；
9. 使用 \(x=F/k\) 預測未直接量度的伸長；
10. 使用模型選擇彈簧及負載，在伸長限制內令承載力最大；
11. 以實驗誤差角度分辨「量度有偏差」與「模型沒有配合自己的數據」；
12. 知道本活動只處理胡克定律適用範圍，不把所有彈簧在任意拉伸下都視為線性。

#### 3.1 針對的常見錯誤概念

- \(x\) 是整條彈簧的長度；
- \(k\) 越大，彈簧在同一力下伸得越長；
- \(k\) 是負載改變時會跟着改變的量；
- \(F-x\) 圖的縱截距可以任意；
- \(F-x\) 圖的斜率代表伸長量；
- 較長的彈簧必然有較小／較大的 \(k\)；
- 相同砝碼數量只代表相同質量，不知道在本活動已換算為指定作用力；
- 動畫振盪幅度或停下速度是判斷 \(k\) 的主要依據；
- 見到一個方案失敗後換另一個，便等於掌握胡克定律。

---


### 包括

- 兩條未知、但在指定範圍內遵從胡克定律的彈簧 A／B；
- 每條彈簧各自的自然長度及 \(k\)；
- 三個固定探究負載：`1.0 N`、`2.0 N`、`3.0 N`；
- 標定自然長度；
- 量度末端位置及伸長量；
- 兩組 \(F-x\) 數據；
- 通過原點的模型線；
- 三個未量度負載的預測；
- 一個「伸長不可超過限制、承載力盡量大」的工程方案；
- delayed feedback；
- SCORM 1.2 draft／review／result；
- 手機、平板、桌面；
- touch、mouse、keyboard；
- deterministic seed、可重建題目及可重算分數。

### 明確不包括

- 超過彈性限度、永久形變或滯後；
- 非線性彈簧；
- 壓縮；
- 彈簧串聯／並聯；
- 彈性勢能；
- 簡諧運動週期；
- 由質量自行計算重量；
- 改變重力場；
- 摩擦、空氣阻力或真實阻尼量度；
- 實驗不確定度傳播、最佳擬合統計教學或誤差棒；
- 任意教師輸入題目；
- 自由加入任意數量的數據點；
- 高風險考試或防 developer-tools 篡改；
- SCORM 2004、xAPI 或 LRS；
- 以動畫振盪頻率評核 \(k\)。

---

## Catalogue metadata (`sim/config.js`)

實作及 package-ready 前使用 `planned`；只有完整通過 deployable gate 後才改為 `active`。

```js
{
  title: "胡克定律：彈簧探究與預測實驗室",
  folder: "hookes-law-spring-investigation-lab",
  categories: ["Mechanics"],
  description: "量度兩條彈簧在不同負載下的伸長，建立 F–x 模型，並在不獲即時正誤提示下完成預測與工程設計。",
  tags: [
    "physics",
    "mechanics",
    "hookes-law",
    "spring",
    "spring-constant",
    "force-extension",
    "measurement",
    "graph",
    "prediction",
    "engineering",
    "scorm"
  ],
  status: "planned"
}
```

驗收：

- [ ] `folder` 與 plan、activity directory、manifest slug 完全一致；
- [ ] learner-facing copy 使用繁體中文；
- [ ] categories／tags 無重複；
- [ ] package-ready 前不可設為 `active`。

---

## 題目生成與公平隨機化

### 6.1 權威單位

內部一律用 SI：

- 力：N；
- 長度／位置／伸長：m；
- 彈簧常數：N/m。

畫面可顯示 cm，但只在 display layer 換算：

```js
displayCm = meters * 100;
meters = displayCm / 100;
```

不可把已四捨五入的畫面文字反向解析成權威答案。所有 scoring、persistence、prediction 及 engineering calculation 使用 full-precision SI 值。

### 6.2 彈簧常數題庫

第一版使用經驗證的有限題庫，不任意抽連續浮點數：

```js
const K_PAIRS_N_PER_M = [
  [20, 35],
  [20, 40],
  [25, 40],
  [25, 45],
  [30, 50],
  [35, 50]
];
```
- 使用六組經驗證的 \(k\) 組合，並由 seed 隨機抽取及交換 A／B；第三階段不再綁定固定負載，而是按選中的 \(k\) 動態生成整數厘米標準答案，因此可以保留題庫的彈簧常數多樣性；

要求：

- A／B assignment 由 seed 隨機交換；
- 兩條彈簧 \(k\) 不相等；
- 比例差異足以在手機量度中辨認；
- 每一個生成的預測負載都必須落在 \(0 < x \le 18\,\mathrm{cm}\) 及 \(F \le 4\,\mathrm{N}\) 內；
- 不用顏色作 spring identity；A／B 文字及線形必須一直存在。

### 6.3 自然長度

從經驗證集合抽取：

```js
const NATURAL_LENGTHS_M = [0.075, 0.085, 0.095, 0.105];
```

A／B 可有不同自然長度，目的是阻止學生把「彈簧看起來較長」直接當作 \(k\) 較小。

必須滿足：

```text
L0 + maxExtension <= STAGE_MAX_ENDPOINT_M
```

建議固定物理舞台範圍：

```js
const STAGE_SPAN_M = 0.29;
const MAX_LINEAR_EXTENSION_M = 0.18;
```

### 6.4 探究負載

固定為：

```js
const INVESTIGATION_FORCES_N = [1.0, 2.0, 3.0];
```

只准正式記錄這三個負載。學生可任意次序量度及重做；第三階段的負載由另一個生成規則抽取，並排除這三個已量度的力值，以免直接試出盲測答案。

### 6.5 預測題

使用未直接量度的負載：

```js
const PREDICTION_COUNT = 3;
const PREDICTION_MIN_EXTENSION_CM = 3;
const PREDICTION_MAX_FORCE_N = 4;
```

生成規則：

- 每題先由 seed 決定所屬彈簧，再從該彈簧的候選整數伸長量 `3..18 cm` 抽取；
- 力值按 `forceN = kNPerM * extensionCm / 100` 計算，最多顯示兩位小數；
- 三題至少包含 A、B 各一次，三個力值及三個整數厘米伸長答案均不重複；
- 預測力值排除 `1.0 N`、`2.0 N`、`3.0 N`，並限制為 `> 0` 及 `<= 4.0 N`；
- 所有真實伸長均 `> 0` 且 `<= MAX_LINEAR_EXTENSION_M`，所以標準答案一定是整數厘米；
- `predictionForcesN` 由生成後的三題派生，不再是全局固定常數；
- 畫面軸及拖動範圍可以完整表示；
- 題目不顯示正確末端、正確伸長或容許區。

### 6.6 工程題

固定 force module：

```js
const MODULE_FORCE_N = 0.5;
const MAX_MODULE_COUNT = 8;
```

學生選擇：

- spring A 或 B；
- `1..8` 個 force modules。

題目要求：

> 裝置的彈簧伸長不可超過指定上限。選擇彈簧及負載數量，在安全範圍內令承載力最大。

伸長上限候選：

```js
const LIMITS_M = [0.06, 0.07, 0.08, 0.09, 0.10, 0.11, 0.12];
```

generator 必須先枚舉全部合法 spring／limit 組合，再從通過以下 constraints 的候選中以 seed 選取；不可使用結果不穩定的無限 rejection loop：

```text
1. 兩條彈簧都至少可安全承受 1 個 module；
2. 全局最佳安全 module count 唯一；
3. 最佳 count 在 3..7，不能因「全部加上」自然得滿分；
4. 次佳方案至少比最佳少 1 個 module；
5. 最佳方案再加 1 個 module 必定超出限制；
6. 顯示至 0.1 cm 後不產生安全邊界歧義；
7. 所有 extension 仍在胡克定律適用範圍。
```

最佳答案由枚舉得出，不 hard-code A／B：

```js
function enumerateDesigns(scenario) {
  return ["A", "B"].flatMap((springKey) =>
    Array.from({ length: MAX_MODULE_COUNT }, (_, i) => {
      const moduleCount = i + 1;
      const forceN = moduleCount * MODULE_FORCE_N;
      const extensionM = forceN / scenario.springs[springKey].kNPerM;
      return {
        springKey,
        moduleCount,
        forceN,
        extensionM,
        safe: extensionM <= scenario.design.limitM + FLOAT_EPSILON
      };
    })
  );
}
```

### 6.7 Deterministic generator

建議：

```js
generateScenario({ seed, generatorVersion: 3 })
```

- 新 attempt 只建立一次 uint32 seed；
- 使用小型 deterministic PRNG，例如 `mulberry32`；
- snapshot 保存 `seed` 及 `generatorVersion`；
- restore／review／pending-final 由同一版本重建相同 scenario；
- scenario object `deepFreeze`；
- generator 不接觸 DOM、SCORM 或 scoring；
- 測試大量 seeds，保證所有 constraints 成立；
- 改題庫語意時增加 `generatorVersion`，不得悄悄令舊 snapshot 生成另一題。

---

## Physics or subject model

### 7.1 靜態平衡

對 spring \(s\)：

```js
function extensionM(forceN, kNPerM) {
  return forceN / kNPerM;
}

function endpointM(naturalLengthM, forceN, kNPerM) {
  return naturalLengthM + extensionM(forceN, kNPerM);
}
```

在本活動：

\[
F_\text{spring}=kx
\]

靜態平衡時：

\[
F_\text{spring}=F_\text{load}
\]

所以：

\[
x_\text{eq}=\frac{F_\text{load}}{k}
\]

所有權威位置直接由公式求出。動畫 frame 不可成為量度真值。

### 7.2 學生量度值

學生先確認零位 `zeroM`，再把量度游標放在 `cursorM`：

```js
function measuredExtensionM(zeroM, cursorM) {
  return cursorM - zeroM;
}
```

UI 約束 `cursorM >= zeroM`，但不比較它是否接近真實 endpoint。學生可以記錄一個不準確但格式合法的量度；正確性到提交後才判斷。

### 7.3 模型線

圖軸：

- horizontal：extension \(x\)，畫面顯示 cm；
- vertical：force \(F\)，畫面顯示 N；
- 原點固定；
- 不提供 intercept handle；
- 一個 control point 固定在 `F = 2.5 N`，學生只調整該點的 \(x\)。

```js
const MODEL_HANDLE_FORCE_N = 2.5;

function kFromModelHandle(handleExtensionM) {
  return MODEL_HANDLE_FORCE_N / handleExtensionM;
}
```

學生模型：

```js
function modelForceN(kModelNPerM, xM) {
  return kModelNPerM * xM;
}
```

模型 handle 不吸附到正確答案或數據點。可吸附至一般 `0.1 cm` 刻度，因為這只是作圖工具，不是答案修正。

### 7.4 自己數據的最佳通過原點斜率

提交後才計算及顯示：

\[
k_\text{fit}=\frac{\sum_i F_i x_i}{\sum_i x_i^2}
\]

```js
function fitKThroughOrigin(records) {
  const numerator = records.reduce((sum, r) => sum + r.forceN * r.measuredExtensionM, 0);
  const denominator = records.reduce((sum, r) => sum + r.measuredExtensionM ** 2, 0);
  return denominator > MIN_FIT_DENOMINATOR ? numerator / denominator : null;
}
```

用途：

- 分辨「模型線沒有配合學生自己的點」；
- 分辨「模型配合自己的點，但整組量度有系統偏差」；
- 不在提交前顯示 residual、fit score 或 \(k_\text{fit}\)。

### 7.5 動畫只屬 presentation

負載改變時，彈簧可以短暫振動後停在權威 equilibrium。建議在 `animation.js` 使用 injected clock 的二階阻尼視覺 controller：

```js
a = omega * omega * (xEq - xDisplay) - 2 * zeta * omega * v;
v += a * dt;
xDisplay += v * dt;
```

建議：

```js
const VISUAL_OMEGA = 8;
const VISUAL_ZETA = 0.32;
const SETTLE_POSITION_EPS_M = 0.0002;
const SETTLE_SPEED_EPS_M_PER_S = 0.001;
```

規則：

- `xEq` 永遠由 `F/k` 計算；
- animation 不能改變權威答案；
- scoring 不讀 animation frame；
- load change、phase change、resize、visibility change 使用 token 取消 stale callback；
- restore 直接顯示穩定 equilibrium，不重播半段動畫；
- `prefers-reduced-motion: reduce` 立即顯示 equilibrium；
- 「已穩定」只係操作狀態，不代表學生量度正確；
- 記錄按鈕只在穩定後啟用，避免量度移動中的端點。

---

## 學生流程與 UI phase

```text
investigate
→ model
→ predict
→ design
→ review
→ submit
→ locked result
```

第一畫面直接進入實驗，不設 landing page。

### 8.1 Phase A：探究與量度

#### A1. Spring tabs

- `彈簧 A`／`彈簧 B`；
- tab 可自由切換；
- 顯示文字 identity，不只靠顏色；
- 每條 spring 保存獨立零位、量度及 active load；
- 畫面只顯示一條 spring，避免手機並排過窄；
- desktop 可在摘要區同時顯示兩條已記錄 data table，但主要 stage 仍只操作一條。

#### A2. 自然長度標定

未確認 calibration 時：

1. spring 保持無額外負載；
2. 固定直尺顯示絕對位置；
3. 「自然長度零位」水平 marker 由停泊位置開始；
4. 學生拖動 marker 對準 unloaded endpoint；
5. 可用鍵盤微調；
6. 按「記錄自然長度位置」。

按下後只顯示：

> 已記錄彈簧 A 的自然長度位置。

禁止顯示：

- 對準正確；
- 偏高／偏低；
- 誤差；
- 正確零位。

確認後 zero marker 鎖定。按「重新標定」必須先顯示中性確認：

> 重新標定會清除這條彈簧已記錄的量度、模型及所有依賴模型的預測／工程方案。

實際確認後才原子式清除依賴資料。

#### A3. 選擇負載

顯示三個指定 load cards：

- `1.0 N`
- `2.0 N`
- `3.0 N`

學生可任意次序選擇。選擇後按「掛上負載」，彈簧移動到 equilibrium。負載圖示以 force label 為權威，不要求學生另算 \(mg\)。

不得提供其他正式探究負載。

#### A4. 量度游標

spring 穩定後：

- 顯示一條可拖動水平 measurement cursor；
- cursor 從 zero 附近的停泊位置開始，每個 load task 都要重新移動；
- cursor 與 zero marker 之間顯示 bracket；
- live readout 顯示學生目前設定的 `cursorM - zeroM`，例如 `伸長量 6.2 cm`；
- readout 只是學生操作尺的讀數，不比較真值；
- pointerdown 暫時隱藏浮動 readout，pointerup 後再顯示；
- 按「記錄量度」保存最後位置；
- 同一 load 可重新量度並覆蓋。

立即回饋只可以是：

> 已記錄彈簧 A 在 2.0 N 下的量度。

不顯示準確度。

#### A5. 操作證據

calibration 及 measurement 記錄要包含精簡證據：

```js
{
  mode: "pointer" | "keyboard",
  moveM,
  positionM
}
```

measurement record 另帶：

```js
{
  loadKey,
  cursorM,
  mode,
  moveM
}
```

規則：

- pointer／keyboard 同等；
- `moveM` 只驗證曾進行實際操作，不按移動多少給分；
- record transition 要求 spring 已穩定、cursor 曾移動及數值在 stage 合法範圍；
- 不保存逐 frame pointer path；
- 不保存完成時間或 drag count；
- resize 不改變物理 meter coordinate；
- pointercancel 回復 drag 前 semantic checkpoint，不建立 record。

#### A6. Data table

每條 spring 顯示：

| \(F\) / N | 學生量得 \(x\) / cm |
|---:|---:|
| 1.0 | ... |
| 2.0 | ... |
| 3.0 | ... |

- 只顯示學生值；
- 不顯示理想值、誤差、正確標記；
- 未記錄項目顯示「未記錄」；
- 每項可選「重新量度」；
- 兩條 spring 各有三項後，model phase 解鎖。

### 8.2 Phase B：建立 \(F-x\) 模型

每條 spring 顯示由自己的三項量度生成的 data points。

學生操作：

1. 切換 A／B；
2. 拖動 `F=2.5 N` 水平 guide 上的 model handle；
3. 系統畫出由原點通過該 handle 的直線；
4. 可用方向鍵及微調按鈕調整；
5. readout 顯示學生自己的：
   - `2.5 N 對應的模型伸長`；
   - `模型 k = ... N/m`。

這不是正確性回饋，因為數值完全由學生目前線的位置計算。

禁止：

- 自動 best-fit；
- 自動把線吸到 data points；
- 顯示「配合良好」；
- 顯示理想線；
- 顯示 \(k_\text{true}\)；
- 顯示 residual／R²；
- 以綠／紅表示模型。

兩條模型都有值後，predict phase 解鎖。

### 8.3 Phase C：三個盲測預測（重點重做）

第三階段必須先把學生要做的事說清楚，而不是只展示一條寫着「模」的線。每題的題目卡及圖台都要明確顯示：

- 題目指定的彈簧 A 或 B；
- 題目指定但未在第一階段直接量度的負載力 \(F\)；
- 這是一個「預測總長度」任務：學生要先用第二階段自己畫出的 \(F-x\) 直線斜率 \(k\) 預測伸長 \(x=F/k\)，再用自然長度 \(L_0\) 加上伸長量，得到預測總長度 \(L=L_0+x\)；
- 可以返回第二階段查看 A／B 的數據、直線及斜率，再返回第三階段；返回不會改動已記錄的預測或其他後續答案。

圖台的初始狀態是有意設計的預測工作區，不是實際測試結果：

- 題目指定的彈簧及負載必須同時畫出來；
- 負載即使已畫在彈簧末端，也保持在最短位置，即自然長度位置 \(x=0\)；
- 圖台以天花板／固定端、彈簧、不同重量的不同大小／顏色負載及「最短位置（\(x=0\)）」基準線建立物理語境；
- 橙色 prediction marker 在彈簧及負載旁邊，學生拖動它時，彈簧、負載及預測位置必須同步伸長或縮短；
- 最短位置標籤與學生預測伸長標籤必須分開排版；prediction card 的數值與單位保持同一個不可拆分的數學量，手機窄屏也不可把數值／單位拆成不完整的多行；
- 預測伸長答案限制為整數厘米；pointer／keyboard 每次調整固定為 `1 cm`，並以整數厘米顯示，避免手機拖動時因過細步距造成誤觸；
- 題目切換控制要使用「選擇題目 1」等清楚文案，並在可見題目內容及 accessible name 中同時指出彈簧與負載，不使用只有「編輯 1」的模糊按鈕；已選題目只用卡片高亮表示，不另加「目前編輯」文字；
- 圖台即時顯示學生自己的預測伸長量及由 \(L_0+x\) 得到的預測總長度，讓學生知道自己正在預測什麼；
- 舞台只顯示學生目前的預測位置，不 render 實際終點、理想端點、誤差或正確位置；提交前不真正掛上該負載。

三題預測可在最終提交前修改。學生可在第三階段、第四階段及 review 之間返回任何已解鎖的較前階段查看資料，再按正常的下一階段按鈕返回；只要沒有覆蓋上游答案，所有已記錄的 predictions／design 都保留。系統只顯示：

- 題目指定的彈簧及負載；
- `預測 1 已填寫`／`3 項預測已完成`；
- 學生自己的伸長量及總長度。

禁止：

- 在第三階段用實際掛載結果試驗；
- reveal、方向提示、容許帶、「接近」或正確答案；
- 以任何隱藏 DOM、ARIA、`data-*` 或 off-screen element 預載 actual endpoint。

### 8.4 Phase D：盲測工程設計

題目示例：

> 彈簧的伸長不可超過 8.0 cm。請選擇彈簧及 0.5 N 負載模組數量，在安全範圍內令總負載最大。

學生操作：

- 選擇 spring A／B；
- 用 `− / count / +` 設置 modules；
- stage 顯示已選 spring、自然長度、limit line、未掛上的 load stack；
- 顯示自己的方案摘要：
  - spring；
  - module count；
  - total force。

提交前不可：

- 讓 spring 實際伸長；
- 顯示 predicted extension；
- 顯示安全／危險；
- 顯示最佳 count；
- 因 A 不得而容許學生看結果後換 B。

### 8.5 Phase E：review

review 顯示全部學生答案：

- A／B 零位；
- 六項量度；
- 自己的 data points；
- 自己的兩條模型線及 model \(k\)；
- 三項預測；
- 工程方案。

review 只標示：

- 已完成／未完成；
- 數值格式；
- 依賴資料是否仍有效。

不顯示任何正確性。

學生可返回指定 section 修改。只有全部 required evidence 完整時才可最終提交。

最終按鈕文案應清楚：

> 提交並查看結果

並提示：

> 提交後本次作答會鎖定，系統才會顯示正確性、分數及實際測試結果。

### 8.6 Phase F：locked result

只在以下情況 reveal：

- `success`；
- `committed`；
- 已完成 attempt 的可信 `review` restore。

不可在以下情況 reveal：

- editable；
- retryable `retry`；
- non-retryable technical retry；
- `frozen` pending；
- load-error；
- finished snapshot 無法驗證而只能用 Moodle fallback。

結果頁包括：

1. 分數及 mastery；
2. calibration／cursor alignment；
3. 學生數據與理想數據；
4. 學生 model line、自己的 best-fit line、理想 \(k\) line；
5. 三個 prediction marker 與 actual endpoint；
6. 工程方案動畫、limit line、實際 extension、最佳安全方案；
7. 物理語意 feedback；
8. 同一 attempt 只讀，沒有「修改」或「再提交」。

---

## 上游修改與下游 invalidation

必須由單一 pure transition policy 管理，不可由不同 click handler 各自清資料。

### 9.1 重新標定 spring S

清除：

- spring S 的三項 measurements；
- spring S 的 model；
- 所有 predictions；
- design。

保留：

- 另一條 spring 的 calibration；
- 另一條 spring 的 measurements；
- 另一條 spring 的 model（如已有）。

### 9.2 覆蓋 spring S 的 measurement

清除：

- spring S 的 model；
- 所有 predictions；
- design。

保留另一條 spring model。

### 9.3 修改任何 spring model

清除：

- 三個 predictions；
- design。

不清除 measurements。

### 9.4 修改 prediction

- 不清除其他 predictions；
- 不清除 design。

### 9.5 只返回較前 phase 查看資料

- 從 `design` 返回 `predict`、從 `predict` 返回 `model`／`investigate`，或從 `model` 返回 `investigate`，是非破壞性的 phase navigation，不是答案修改；
- 必須以 `fromReview=true`（或等價的 review-continuation variant）保存，使已完成的 predictions／design 可以在前面 phase 暫時存在；
- 返回後再按下一階段返回原 phase，不可清除或重置已記錄答案、scenario seed、版本或 score evidence；
- 只有學生實際重新記錄 calibration／measurement／model／prediction／design，才按 9.1–9.4 的 destructive invalidation policy 清除依賴資料；
- 返回及繼續操作只發出中性導覽提示，例如「已返回第二階段；沒有更改已記錄的後續答案」。

### 9.6 修改 design

- 不改其他資料。

任何 destructive invalidation 前要有中性確認；只說依賴資料會失效，不能暗示原答案錯。

建議 pure functions：

```js
replaceCalibration(state, springKey, evidence)
replaceMeasurement(state, springKey, loadKey, evidence)
replaceModel(state, springKey, handleExtensionM)
replacePrediction(state, predictionId, extensionM)
replaceDesign(state, springKey, moduleCount)
```

每個 transition：

1. validate event；
2. clone semantic state；
3. 更新 authority；
4. 原子式清除 dependents；
5. normalize phase；
6. 建立一次 draft checkpoint；
7. render。

---

## Scoring

### 10.1 總分與合格條件

```text
Total: 100
Passing threshold: 60
Score floor: 0
Score ceiling: 100
```

除總分外，必須通過 mastery gates：

```js
passed =
  totalScore >= 60 &&
  experimentScore >= 8 &&
  modelScore >= 8 &&
  predictionScore >= 18 &&
  engineeringScore >= 8;
```

避免學生只靠某一部分補償完全未掌握的核心。

### 10.2 Part 1：實驗操作，20 分

#### 自然長度 calibration：8 分

每條 spring 4 分：

- error `<= 0.002 m`：4 分；
- error `> 0.002 m && <= 0.004 m`：2 分；
- error `> 0.004 m`：0 分。

只在 calibration evidence shape 合法、曾實際移動及位置有限時評分。

#### 六次 measurement cursor alignment：12 分

每項 2 分：

- endpoint error `<= 0.0025 m`：2 分；
- error `> 0.0025 m && <= 0.005 m`：1 分；
- error `> 0.005 m`：0 分。

不按學生顯示位數評分；用保存的物理 meter coordinate 與權威 endpoint 比較。

### 10.3 Part 2：模型，20 分

每條 spring 8 分，共 16：

#### A. 配合自己的數據：每 spring 4 分

比較 `kModel` 與 `kFitThroughOrigin`：

- relative error `<= 5%`：4；
- `>5% && <=10%`：3；
- `>10% && <=20%`：1；
- `>20%` 或 fit 無法建立：0。

#### B. 物理 \(k\) 準確度：每 spring 4 分

比較 `kModel` 與 scenario true \(k\)，同一 tier：

- `<=5%`：4；
- `<=10%`：3；
- `<=20%`：1；
- 其他：0。

#### C. 比較硬度：4 分

若：

```js
Math.sign(kModelA - kModelB) === Math.sign(kTrueA - kTrueB)
```

得 4 分，否則 0。題庫保證 true \(k\) 不相等及差異足夠，不設「相同」答案。

### 10.4 Part 3：三個預測，36 分

每題 12 分。令：

```js
errorM = Math.abs(predictedExtensionM - trueExtensionM);

fullToleranceM = Math.max(0.003, 0.05 * trueExtensionM);
goodToleranceM = Math.max(0.006, 0.10 * trueExtensionM);
partialToleranceM = Math.max(0.012, 0.20 * trueExtensionM);
```

- `error <= fullTolerance`：12；
- `<= goodTolerance`：9；
- `<= partialTolerance`：5；
- 其他：0。

使用 absolute floor 防止小 extension 的相對誤差過度嚴格。

### 10.5 Part 4：工程設計，24 分

先計算：

```js
forceN = moduleCount * MODULE_FORCE_N;
extensionM = forceN / selectedSpring.kNPerM;
safe = extensionM <= limitM + FLOAT_EPSILON;
```

若未選 spring、module count 不合法、count 為 0 或 unsafe：

```text
engineeringScore = 0
```

若 safe：

```js
safetyPoints = 8;
efficiencyPoints = Math.round(
  16 * Math.min(1, forceN / optimalSafeForceN)
);
engineeringScore = safetyPoints + efficiencyPoints;
```

- 安全但保守：部分分；
- 唯一最大安全負載：24 分；
- 超出限制：0 分，因安全性是硬 constraint；
- 不另為「選中較硬 spring」重複加分，最佳化分已包含。

### Duplicate／extra-item handling

- calibration、measurement、model 及 prediction 使用固定 canonical slots；同一 slot 的新確認值只會原子式覆蓋舊值，不會建立 duplicate scoring item。
- 額外 DOM／generated items、unknown keys、重複或 dangling authoritative relationship keys 不得增加分數，decode 時必須拒絕。
- 工程題只接受一個 spring key 與 `1..8` 的整數 module count；count 失效、為 0 或 unsafe 均為 0 分。
- 不存在「全選」得分路徑；固定題目數、唯一工程 optimum 及 safety hard constraint 消除額外選項優勢。

### 10.6 不扣分項目

- 重做；
- 修改；
- 使用 keyboard；
- 多次切換 tabs；
- 花較長時間；
- 動畫 reduced-motion；
- 量度次序；
- 進入 review 再返回。

---

## Tolerance 及邊界例子

所有 constants 集中在 `scoring.js`：

```js
const ZERO_FULL_ERROR_M = 0.002;
const ZERO_PARTIAL_ERROR_M = 0.004;
const CURSOR_FULL_ERROR_M = 0.0025;
const CURSOR_PARTIAL_ERROR_M = 0.005;
const MODEL_FULL_REL = 0.05;
const MODEL_GOOD_REL = 0.10;
const MODEL_PARTIAL_REL = 0.20;
const PREDICT_FULL_ABS_M = 0.003;
const PREDICT_GOOD_ABS_M = 0.006;
const PREDICT_PARTIAL_ABS_M = 0.012;
const FLOAT_EPSILON = 1e-9;
const MIN_OPERATION_MOVE_M = 0.005;
```

邊界必須 inclusive，並測試：

- calibration `0.002 m` 得滿分；`0.0020001 m` 不得滿分；
- calibration `0.004 m` 得部分；`0.0040001 m` 得 0；
- cursor `0.0025 m` 得 2；剛超過得 1；
- model exactly `5%` 得最高 tier；剛超過降 tier；
- prediction exactly combined threshold 仍在該 tier；
- engineering exactly on limit 安全；超過 `1e-9` 以外不安全；
- score 永不小於 0 或大於 100。

以上為 implementation 初始值。學生 pilot 可調整，但修改前必須更新 plan、rubricVersion、測試及 borderline examples。

---

## 提交後的物理 feedback 診斷

提交後 feedback 應用物理語意，不只顯示分數。

### 12.1 Calibration／measurement

- zero 偏差大：
  - 「你記錄的零位與未加負載時的彈簧末端有明顯差距。伸長量應由自然長度位置量起。」
- zero 準但 cursor 不準：
  - 「自然長度基準合理，但部分游標未對準負載穩定後的末端。」
- 兩者合理：
  - 「你能以自然長度作基準並量度伸長。」

### 12.2 Model

- model 接近 own fit、但遠離 true k：
  - 「模型有配合你的數據，但整組數據可能受零位或讀尺偏差影響。」
- data 好、model 不接近 own fit：
  - 「量度點合理，但模型直線的斜率未能代表這組數據。」
- slope order 反轉：
  - 「同一作用力下伸長較少的彈簧應有較大的 \(k\)，其 \(F-x\) 線亦較斜。」
- model good：
  - 「你建立的通過原點直線能代表 \(F=kx\)。 」

### 12.3 Prediction

逐題顯示：

- student predicted extension；
- actual extension；
- absolute difference；
- 同一 force 下 \(k\) 對 extension 的影響。

不使用侮辱性或只說「錯」。

### 12.4 Engineering

顯示：

- selected spring；
- load；
- actual extension；
- limit；
- safe／unsafe；
- optimal safe design；
- 若過分保守，說明仍可增加多少 module；
- 若 unsafe，說明 \(F/k\) 超過限制。

---

## Responsive layout contract

### 13.1 分類

`bounded split-panel`

原因：

- stage 必須在 calibration、measurement、model、prediction 操作期間一直可見；
- controls 內容多，手機上要獨立捲動；
- 不可讓 activity body 成為 Moodle 與 panel 之間的第三 scroll owner。

### 13.2 Phone

建議：

```css
.app {
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: minmax(14rem, 46vh) minmax(0, 1fr);
  overflow: hidden;
}
```

支援 `46dvh` enhancement。

- stage upper row；
- panel lower row；
- panel `overflow-y:auto`；
- panel `overscroll-behavior:contain`；
- shrinking chain 全部 `min-height:0`；
- `html`、`body`、app shell 在 bounded iframe 無可用 vertical range；
- 320×500、390×500 仍可觸及 primary actions；
- extreme height／200% zoom 時重排 stage labels、縮短非必要說明，不增加 stage vertical scroller。

### 13.3 Desktop／tablet

- DOM reading order：controls 先、stage 後；
- desktop CSS：左側約 `20–24rem` controls、右側 stage；
- stage 填滿餘下空間；
- tablet 依有效寬度轉成上下；
- 不因 desktop 增加手機沒有的必需操作。

---

## Touch gesture ownership contract

### 14.1 Draggable target inventory

| Target type | Hit-target strategy | Capture target | Render 可否在 drag 中替換 |
|---|---|---|---|
| 自然長度 zero marker | 對齊 SVG marker 的固定 HTML button overlay，至少 44×44 px | 同一 HTML button | 不可 |
| measurement cursor | 固定 HTML button overlay，至少 44×44 px | 同一 HTML button | 不可 |
| graph model handle | 固定 HTML button overlay，至少 44×44 px | 同一 HTML button | 不可 |
| prediction marker | 固定 HTML button overlay，至少 44×44 px | 同一 HTML button | 不可 |

Spring selection 及 module count 使用普通 buttons，不增加 drag owner。

### 14.2 Gesture matrix

| Touch starts on | Owner | Expected result |
|---|---|---|
| 已知非互動 stage 空白 | enclosing page／Moodle host | host 非零 scroll 及 iframe 同向移動；activity document、panel 不動；learner state 不變 |
| independently scrolling control panel | panel only | panel 有 range 時非零；host、iframe、activity document、stage 不動；頂／底亦不 chain |
| zero marker | simulation | marker 改變；所有 scroll／viewport／iframe delta 為 0；有 pointermove／pointerup；無 pointercancel |
| measurement cursor | simulation | cursor 改變；所有 scroll delta 為 0；無 pointercancel |
| model handle | simulation | handle／student line 改變；所有 scroll delta 為 0 |
| prediction marker | simulation | student prediction 改變；所有 scroll delta 為 0 |
| final locked result 中原 drag footprint | host／panel，視起點區域 | 不再建立 drag；submitted state 不變 |

### 14.3 Technical requirements

- blank stage root：`touch-action: pan-y`；
- drag overlays：`touch-action:none` 在 `pointerdown` 前已生效；
- 不把 `touch-action:none` 放整個 SVG／stage；
- inner SVG graphics 不作唯一 gesture boundary；
- `setPointerCapture(pointerId)`；
- stable capture target drag 全程 mounted；
- render 更新 SVG visual，不重建 overlay node；
- non-primary pointer／multi-touch 開始時取消或忽略，不能破壞原 state；
- `pointercancel` 回復 drag 前 semantic checkpoint，不提交答案；
- 不把 stage swipe 轉送 sibling panel；
- source page 及 built/extracted SCORM 都要用 browser-level trusted touch 在 scrollable Moodle-like iframe 驗證；
- DOM `dispatchEvent`、source string 或 computed style 不算驗收。

### 14.4 Coordinate conversion

SVG 使用 `preserveAspectRatio="xMidYMid meet"`。所有 client↔SVG／physics conversion 經同一 helper：

```js
function clientToSvg(svg, clientX, clientY) {
  const point = new DOMPoint(clientX, clientY);
  return point.matrixTransform(svg.getScreenCTM().inverse());
}
```

再由 SVG y 轉物理 meter。pointer、keyboard、resize、overlay positioning、scoring evidence 必須共享同一 mapping，不可各自用 magic pixel ratio。

---

## Accessibility

- 所有核心 drag 有 keyboard equivalent；
- zero／cursor／prediction：
  - ArrowUp／ArrowDown：`0.001 m`；
  - Shift+Arrow：`0.005 m`；
- model handle：
  - ArrowLeft／ArrowRight：`0.001 m` extension；
  - Shift+Arrow：`0.005 m`；
- focusable native button overlays；
- 可讀 accessible name，例如：
  - 「彈簧 A 自然長度零位，目前 8.4 cm」；
  - 「2.0 N 量度游標，目前伸長 6.1 cm」；
- `aria-describedby` 說明拖動及方向鍵；
- A／B、data points、lines 使用文字、形狀及 dash pattern，不只顏色；
- focus-visible 清楚；
- touch target 至少 44×44 px；
- `prefers-reduced-motion` 直接 equilibrium，學習內容不減少；
- 動畫不逐 frame announce；
- neutral live region 只報：
  - 負載已掛上；
  - 彈簧已穩定；
  - 量度已記錄；
  - section 已完成；
- editable phase 的 screen reader tree 不得包含正確答案；
- review 返回 edit 時 focus 到 section heading；
- result card 用 icon＋文字；
- forced-colors 可辨；
- 200% zoom 可完成；
- 不以 placeholder 代替 visible label；
- 物理變數用 `<var>`，單位直立；不載入 MathJax／KaTeX。

---

## Phase/state matrix

| Phase | Variant | Required state | Must be absent／pristine | Allowed next |
|---|---|---|---|---|
| `investigate` | active spring 未 calibration | valid seed；working zero marker | 該 spring measurements／model；all predictions／design | confirm calibration／switch spring |
| `investigate` | spring 已 calibration、0–2 records | calibration；合法 active load／cursor draft | 該 spring model；predictions／design | record／replace measurement |
| `investigate` | 一條 complete、另一條 incomplete | completed spring data 可存在 | incomplete spring model；predictions／design | 完成另一條 |
| `investigate` | 兩條各 3 records | both calibration＋6 records | predictions／design；model 可為 null | go model／remeasure |
| `model` | 0–1 model complete | six records | predictions／design | set model／return investigate |
| `model` | both complete | six records＋two handles | predictions／design | go predict／edit model |
| `predict` | 0–2 predictions | both models | design absent | set prediction／return model |
| `predict` | 3 complete | both models＋3 predictions | design may be absent | go design |
| `design` | empty | all predictions | design absent | choose spring／modules |
| `design` | complete | all predictions＋valid design | — | go review／edit |
| `review` | complete | all required authority | no working drag | submit／return specific section |
| `investigate/model/predict/design` | `fromReview=true` | review-complete answer may temporarily retain downstream data until an actual upstream replacement | current transient drag only | return review without change，或 replacement 後按 invalidation 清除 |
| `design/predict/model/investigate` | non-destructive backward navigation | current phase prerequisites＋已記錄的下游答案；`fromReview=true` | 不得清除 predictions／design；不得顯示答案揭示 | return to the phase just left／continue |
| locked result | submitted/review | validated review answer＋computed result | editable controls | review only |

Transitions：

```text
investigate -> model
  when both calibrations and all six records exist

model -> predict
  when both model handles exist

predict -> design
  when all three prediction values exist

design -> review
  when spring and valid module count exist

review -> submit
  when canonical completeness passes

review -> <section>
  when learner chooses edit; set fromReview=true

<section from review> -> review
  when no invalidating change and answer remains complete

design -> predict -> model -> investigate
  when learner requests a non-destructive backward navigation; preserve downstream answers and set fromReview=true

earlier phase -> later phase
  when prerequisites exist; preserve downstream answers while returning from a navigation continuation

any editable phase -> earlier normalized phase
  after an upstream replacement clears required dependents and the phase is normalized by the invalidation policy
```

不可保存 production UI 無法 render 的 phase。

---

## Persistence contract

### 17.1 建議 authority shape

```js
{
  schemaVersion: 1,
  generatorVersion: 3,
  rubricVersion: 2,
  seed: 1234567890,

  phase: "investigate" | "model" | "predict" | "design" | "review",
  fromReview: false,
  activeSpring: "A" | "B",
  activeLoadKey: "F1" | "F2" | "F3" | null,
  activePredictionIndex: 0 | 1 | 2,

  calibrations: {
    A: null | { zeroM, mode, moveM },
    B: null | { zeroM, mode, moveM }
  },

  measurements: {
    A: {
      F1: null | { cursorM, mode, moveM },
      F2: null | { cursorM, mode, moveM },
      F3: null | { cursorM, mode, moveM }
    },
    B: {
      F1: null | { cursorM, mode, moveM },
      F2: null | { cursorM, mode, moveM },
      F3: null | { cursorM, mode, moveM }
    }
  },

  models: {
    A: null | { handleExtensionM },
    B: null | { handleExtensionM }
  },

  predictions: [
    null | { extensionM },
    null | { extensionM },
    null | { extensionM }
  ],

  design: null | {
    springKey: "A" | "B",
    moduleCount
  },

  working: {
    zeroDraftM: null | number,
    cursorDraftM: null | number
  }
}
```

`working` 只用於 editable draft；review snapshot normalization 要移除未確認 transient working values。

### Draft 與 review authority

- Draft snapshot 使用上述完整 authority shape；`phase`、`fromReview`、active keys 及 `working` 必須符合 phase/state matrix，讓 restore 後可執行同一合法 continuation。
- Review snapshot 使用同一組完整 authoritative answers（seed、versions、兩項 calibration、六項 measurements、兩項 models、三項 predictions 及 design），固定為完整的 `phase: "review"`；移除 `working` 與未確認 drag draft，並把只服務 editable continuation 的 active UI state 正規化。
- Review authority 必須足以 validate、rescore、重畫所有 submitted marker／line／design；score、pass 及 Moodle metadata 不屬 authority。

### 17.2 不保存的 derived fields

- true \(k\)；
- natural lengths；
- challenge specs；
- true endpoints；
- data table force values；
- measured extension（由 calibration＋cursor 推導）；
- model \(k\)（由 handle 推導）；
- own-fit \(k\)；
- optimal design；
- score；
- pass；
- button enabled state；
- CSS classes；
- SVG path；
- DOM nodes；
- animation position／velocity；
- pointer ID；
- hover／focus；
- complete counts。

scenario 由 seed 重建；result 由 authority 重新計算。

### 17.3 Snapshot envelope

```js
SimScorm.makeSnapshot(ACTIVITY, "draft", draftAnswer);
SimScorm.makeSnapshot(ACTIVITY, "review", reviewAnswer, result);
```

代表性最大 draft／review 必須低於 4000 UTF-8 bytes，建議留下 assertion：

```js
expect(SimScorm.snapshotBytes(maxDraftSnapshot)).toBeLessThanOrEqual(4000);
expect(SimScorm.snapshotBytes(maxReviewSnapshot)).toBeLessThanOrEqual(4000);
```

### 17.4 Decoder validation

必須拒絕：

- 非 finite number；
- unknown schema／generator／rubric version；
- invalid phase；
- invalid seed；
- unknown A／B／load key；
- measurement 在 calibration 前存在；
- duplicate／dangling keys；
- model 在六項 measurement 未完成時存在，除非合法 `fromReview` state 且 authority 仍完整；
- prediction 在兩個 models 不完整時存在；
- design 在 predictions 不完整時存在；
- review 不完整；
- negative extension；
- cursor above zero；
- marker／cursor／handle 超出物理 bounds；
- module count 非 integer 或不在 `1..8`；
- phase 與 active index 不可 render；
- partial current/legacy mixed schema；
- stale future data 違反 invalidation policy。

### 17.5 Restore

```text
parse envelope
→ validate version/activity/kind
→ decode authority
→ regenerate scenario(seed, generatorVersion)
→ validate cross-relations
→ rebuild derived values
→ rescore when review
→ render legal phase
```

required invariant：

```text
score(validState) === score(restore(encode(validState)))
```

而且每個 round-trip fixture 要執行一個合法 continuation，不可只比較 JSON。

### 17.6 Invalid state policy

- finished review invalid：保持 locked，只顯示可信 Moodle summary；
- pending-final nested review invalid：`SimScorm.quarantinePending()`，technical lock，不 reveal；
- editable draft invalid：fail closed technical load error；現有 shared runtime 未有 plan-approved clear-draft API 前，不可 silent reset；
- saved score／passed 只作 comparison metadata，不作權威；
- restore review 要以 activity scorer 重算，再交 `SimActivityFlow.reviewResult()`。

---

## Shared SCORM lifecycle

Startup UI：

| Outcome | Editable? | Learner-facing behavior |
|---|---:|---|
| `review` | No | 驗證 review authority、重建 scenario、重算並顯示 locked result；無法驗證時只顯示可信 Moodle summary |
| `editable` | Yes | 建立或 restore draft，register draft provider，render 合法 phase |
| `frozen` | No | 驗證同一 pending payload 後 retry；狀態未確認，不 reveal score／pass／fail |
| `load-error` | No | Technical lock；不稱 submitted／failed |

Submission UI：

| Outcome | Editable? | Learner-facing behavior |
|---|---:|---|
| `success` | No | Submitted review-only result |
| `committed` | No | Committed result；允許 finish retry |
| `frozen` | No | Pending／unconfirmed；鎖定且不 reveal |
| `retry` | Depends | 依 `retryable` 決定是否維持 editable；不得聲稱已提交或承諾可 retry |

```js
const ACTIVITY = "hookes-law-spring-investigation-lab";
const attempt = SimScorm.loadAttempt(ACTIVITY);
const startupState = SimActivityFlow.startup(attempt);
```

### 18.1 Startup

- `review`：
  - validate review；
  - regenerate scenario；
  - restore authority；
  - rescore；
  - compare saved/Moodle metadata；
  - show locked result。
- `editable`：
  - new 或 restore draft；
  - register `SimScorm.setDraftProvider()`；
  - render editable phase。
- `frozen`：
  - validate nested review／canonical authority；
  - 同一 payload retry；
  - controls locked；
  - 不顯示正確性、score、pass/fail。
- `load-error`：
  - technical lock；
  - 不稱 submitted／failed。

### 18.2 Draft checkpoint

semantic change 後保存，例如：

- calibration confirm；
- measurement record／replace；
- model drag end；
- prediction drag end；
- design change；
- phase change；
- return from review。

不要每個 pointermove commit。drag end 更新 in-memory state，再一次 save；page lifecycle 由 shared draft provider flush 最新 state。

### 18.3 Submission

```js
const result = scoreAnswer(authority, scenario);
const review = SimScorm.makeSnapshot(ACTIVITY, "review", reviewAnswer, result);

const handle = (outcome) => SimActivityFlow.submission(outcome, {
  success: showSubmittedResult,
  committed: showCommittedResultAndFinishRetry,
  frozen: showFrozenPendingWithoutReveal,
  retry: (failure) => showSubmissionError({ retryable: failure.retryable })
});

SimScorm.submitWithCallbacks(result, review, {
  onSuccess: handle,
  onFailure: handle
});
```

- `success`：locked result；
- `committed`：result 可顯示，finish retry；
- `frozen`：不 reveal；
- retryable `retry`：維持 editable，同一 final 尚未成立；
- non-retryable `retry`：technical error；
- 不直接使用 raw LMS API；
- 不加 activity-local `pagehide`／`pageshow`／commit／finish。

---

## Runtime files 與責任

```text
plans/17-hookes-law-spring-investigation-lab.md

sim/hookes-law-spring-investigation-lab/
  index.html
  styles.css
  generator.js
  generator.test.js
  model.js
  model.test.js
  animation.js
  animation.test.js
  scoring.js
  scoring.test.js
  persistence.js
  persistence.test.js
  main.js
  lifecycle.test.js

sim/manifests/hookes-law-spring-investigation-lab.xml

tools/
  hookes-law-spring-browser-regression.js
  hookes-law-spring-browser-regression.test.js
```

並更新：

- `sim/config.js`
- `tools/run-tests.js`

### `generator.js`

- deterministic PRNG；
- spring pair／A-B assignment；
- natural length；
- prediction specs；
- engineering limit；
- scenario constraints；
- pure、DOM-free。

### `model.js`

- \(x=F/k\)；
- endpoint；
- measured extension；
- graph conversions；
- model handle to \(k\)；
- through-origin fit；
- design enumeration；
- pure、DOM-free。

### `animation.js`

- injected clock；
- damped visual settle；
- token cancellation；
- reduced-motion immediate path；
- 不改 authority／score。

### `scoring.js`

- component tiers；
- process evidence validator；
- model fit；
- predictions；
- engineering optimum；
- mastery gates；
- learner feedback classifications；
- pure、DOM-free、saved metadata-free。

### `persistence.js`

- canonical state；
- transitions／invalidation；
- encode／decode；
- phase matrix validation；
- review normalization；
- snapshot size helpers；
- migrations 或 explicit reject。

### `main.js`

- startup／SCORM glue；
- render；
- stable overlays；
- Pointer Events／keyboard；
- phase navigation；
- semantic checkpoints；
- submission outcomes；
- 不含散落的 physics formulas 或 rubric constants。

### `styles.css`

- shared tokens；
- bounded split-panel；
- SVG stage／graph；
- overlay alignment；
- focus／forced colors；
- responsive／zoom；
- selective touch-action；
- reduced motion。

---

## 關鍵 code policy

### 20.1 Editable view 不接收 reveal data

建議分開 view model：

```js
function buildEditableViewModel(state, scenario) {
  return {
    // only observable apparatus state and learner-owned answers
  };
}

function buildResultViewModel(state, scenario, result) {
  return {
    // true k, true extensions, ideal lines, errors, optimum
  };
}
```

`buildEditableViewModel()` 不得返回：

- true prediction endpoint；
- true engineering extension；
- optimal design；
- correctness flags；
- score。

### 20.2 Reveal gate

```js
function mayRevealCorrectness(activityState) {
  return (
    activityState === "submitted-success" ||
    activityState === "submitted-committed" ||
    activityState === "trusted-finished-review"
  );
}
```

所有 result components 在 gate false 時根本不建立。

### 20.3 Pure scorer

```js
const result = scoreHookesLawAttempt(authority, scenario);
// { score, maxScore: 100, passed, completed: true, breakdown, feedback }
```

scorer 不讀：

- DOM；
- CSS pixel；
- saved score；
- current animation；
- current tab；
- hidden input；
- localStorage。

### 20.4 Rounding

- internal full precision；
- display cm：通常 0.1 cm；
- \(k\)：可顯示 0.1 N/m；
- score 使用明確 integer tier；
- display rounding 永不寫回 authority；
- review-edit 未改文字時不得因 display round-trip 改值。

---

## Test plan

### 21.1 Generator

- [ ] 同 seed 同 version 完全相同；
- [ ] 不同 seed 有合理 variation；
- [ ] 大量 seeds 均符合 pair、stage、linear-range constraints；
- [ ] A／B assignment 可交換；
- [ ] predictions 至少各用 A／B 一次；
- [ ] prediction force 不在 investigation set；
- [ ] engineering optimum 唯一；
- [ ] optimum count `3..7`；
- [ ] optimum 再加一個 module unsafe；
- [ ] display rounding 不造成 boundary ambiguity。

### 21.2 Physics/model

- [ ] `F=kx` exact fixtures；
- [ ] `endpoint=L0+F/k`；
- [ ] SI↔cm conversion；
- [ ] measured extension；
- [ ] model handle conversion；
- [ ] fit-through-origin known data；
- [ ] zero denominator；
- [ ] design enumeration／optimum；
- [ ] non-finite rejection。

### 21.3 Scoring

- [ ] 每個 component point total；
- [ ] calibration boundaries；
- [ ] cursor boundaries；
- [ ] model 5／10／20% boundaries；
- [ ] prediction combined absolute／relative boundaries；
- [ ] engineering exact limit；
- [ ] unsafe zero；
- [ ] efficiency ratio；
- [ ] mastery gates；
- [ ] floor／ceiling；
- [ ] invalid evidence 無分；
- [ ] model-close-to-own-data／far-from-true diagnostic；
- [ ] score unchanged after round-trip。

### 21.4 Invalidation

- [ ] recalibration clears correct dependent subset；
- [ ] remeasurement clears only changed spring model＋all downstream；
- [ ] model change clears predictions＋design；
- [ ] prediction change keeps design；
- [ ] no-change return from review preserves all；
- [ ] non-destructive design→predict→model→predict→design navigation preserves all recorded predictions and leaves design unchanged until edited；
- [ ] destructive transition atomic；
- [ ] no stale model/prediction remains after restore。

### 21.5 Persistence

每個 saveable phase／variant：

- [ ] encode/decode/restore；
- [ ] legal next action executed；
- [ ] production-shaped fixture；
- [ ] size <=4000 bytes；
- [ ] invalid enums；
- [ ] NaN／Infinity；
- [ ] missing prerequisites；
- [ ] stale future data；
- [ ] invalid relationship keys；
- [ ] incomplete review；
- [ ] current／legacy mix；
- [ ] finished invalid remains locked；
- [ ] pending invalid quarantine；
- [ ] editable invalid fail closed。

### 21.6 Delayed-feedback contract

Browser-level assertions，不只 source-string：

- [ ] editable investigate 無 correct/incorrect；
- [ ] model phase 無 ideal line／true \(k\)；
- [ ] prediction phase DOM／accessibility tree 無 actual endpoint；
- [ ] prediction phase clearly names the target spring/load、draws both from the shortest \(x=0\) position、moves them together with the marker、and shows only student extension/total-length readouts；
- [ ] prediction phase can return to model/investigate and resume without changing recorded predictions；
- [ ] debug shortcut 直接進入 predict phase 後，仍可返回 model 查看兩條已自動填入的斜率，再返回 predict；
- [ ] design phase不動畫實際 extension；
- [ ] review 無 score／correctness；
- [ ] repeated prediction adjustments不產生 feedback；
- [ ] switching A→B 不產生安全結果；
- [ ] `frozen` 不 reveal；
- [ ] `success`／`committed`／trusted review 才 reveal；
- [ ] hidden／offscreen／ARIA／data attribute 無答案 leakage；
- [ ] result lock 後 drag owners disabled。

### 21.7 Lifecycle

- [ ] startup `review`；
- [ ] `editable` new／draft；
- [ ] `frozen` valid／invalid；
- [ ] `load-error`；
- [ ] submission `success`；
- [ ] `committed`；
- [ ] `frozen`；
- [ ] retryable／non-retryable `retry`；
- [ ] score/status match／mismatch／unknown；
- [ ] actual production outcome render functions。

### 21.8 Animation

- [ ] equilibrium always exact model value；
- [ ] frame rate variation 不改 final；
- [ ] stale callbacks cancelled；
- [ ] restore static settled；
- [ ] reduced motion immediate；
- [ ] record unavailable before settle；
- [ ] gesture test fake clock／pause；
- [ ] animation state不進 snapshot。

### 21.9 Responsive／touch

- [ ] 320×500；
- [ ] 390×500；
- [ ] 390×600；
- [ ] normal portrait；
- [ ] landscape；
- [ ] toolbar height change；
- [ ] software keyboard；
- [ ] 200% zoom；
- [ ] blank stage host swipe both directions；
- [ ] panel swipe／top／bottom；
- [ ] zero marker trusted drag；
- [ ] cursor trusted drag；
- [ ] model handle trusted drag；
- [ ] prediction marker trusted drag；
- [ ] prediction marker drag moves the spring and load together from the shortest position；
- [ ] pointerup received、無 pointercancel；
- [ ] source and built package；
- [ ] locked former footprints no longer drag。

### 21.10 Accessibility

- [ ] keyboard completes whole activity；
- [ ] focus order；
- [ ] visible focus；
- [ ] accessible names；
- [ ] neutral live announcements；
- [ ] editable accessibility tree無答案；
- [ ] reduced motion；
- [ ] forced colors；
- [ ] not color-only；
- [ ] 44 px targets。

### 21.11 Package

- [ ] runtime files in manifest；
- [ ] tests not packaged；
- [ ] shared styles／scorm／activity-flow listed；
- [ ] `npm.cmd run check`；
- [ ] `npm.cmd test`；
- [ ] `npm.cmd run package -- hookes-law-spring-investigation-lab`；
- [ ] `npm.cmd run package:all`；
- [ ] ZIP root `imsmanifest.xml`；
- [ ] built/extracted browser smoke；
- [ ] no CDN／network dependency；
- [ ] no raw TeX visible；
- [ ] `git diff --check origin/main...HEAD`。

---

## Package-ready checklist

- [ ] activity opens directly into the experiment；
- [ ] all six measurements can be completed without keyboard；
- [ ] keyboard-only path also complete；
- [ ] A／B data survive tab switches；
- [ ] no pre-submit correctness leakage；
- [ ] student can revise before final without trial feedback；
- [ ] student can inspect earlier slopes from Phase 3 and return without losing Phase 3 answers；
- [ ] review is complete but neutral；
- [ ] submission locks attempt；
- [ ] result reconstructs every submitted marker／line／design；
- [ ] score 0..100 and mastery gates correct；
- [ ] local fallback works；
- [ ] all persistence／lifecycle tests pass；
- [ ] complete trusted-touch matrix passes source and packaged launch；
- [ ] catalogue entry remains `planned` until all above pass。

---

## Moodle-ready checklist

- [ ] real student account draft resume；
- [ ] real submission records score／status；
- [ ] pending retry；
- [ ] committed finish retry；
- [ ] completed re-entry review-only；
- [ ] new attempt policy；
- [ ] current-window player real-phone touch matrix；
- [ ] new-window player touch matrix when offered；
- [ ] no reveal in frozen／technical states；
- [ ] Moodle evidence recorded separately。

---

## Assessment risk 與 trust boundary

`low-risk graded`

原因：

- 操作及答案都在 learner browser；
- JavaScript scorer、scenario 及 SCORM call 可被 developer tools 改寫；
- seed、obfuscation 或 minification 不構成可信邊界；
- 本活動適合形成性及低風險課堂評核；
- 不可單獨用作高風險考試、資格判定或秘密答案系統；
- 若日後要高風險，必須由 Moodle question type、LTI 或 backend 以 seed、versions、authority 重新評分；
- 不可把 secret／signing key 放入 SCORM ZIP。

---

## Definition of Done

- [ ] simulation-specific plan 已建立並與本 issue 一致；
- [ ] generator／model／scoring／persistence 已分離；
- [ ] delayed-feedback gate 有 browser-level tests；
- [ ] 兩條 spring、六次量度、兩條 model、三個 prediction、一個 design 全部可完成；
- [ ] upstream invalidation 正確；
- [ ] snapshot <4000 bytes；
- [ ] SCORM startup／submission 全 outcomes 完整；
- [ ] source／package trusted-touch pass；
- [ ] package-ready；
- [ ] 真實 Moodle 驗收後才標記 Moodle-ready。
