# 靜摩擦力與滑動摩擦力探究實驗室

> 文件地位：本 plan 是產品、教學、物理模型、數據量測、互動、評分、持久化、SCORM、測試及驗收的正式 implementation blueprint。
>
> 文件路徑：`plans/18-static-kinetic-friction-investigation-lab.md`
>
> 來源：[GitHub issue #11](https://github.com/frenselw/simlab/issues/11)。issue 內容已在兩份獨立審核後收斂為本文件；本 plan 的明確決定優先於較早的 issue wording。
>
> Plan revision：`25`（2026-08-09；保留 Part B 滑動後拉力可即時增加／減少的 direct Newton force-control，但修正高拉力下物體過快衝到舞台盡頭的互動問題。direct force-control 只在滑動期間再次改變手指位置後啟用；學生的拉力箭嘴及量測到的 `F拉` 仍跟隨輸入，不會自動鎖定勻速值。為配合手機舞台，直接施力的運動更新加入明確、非摩擦的速度比例反應阻尼 `36 N·s/m`，令 `F_net` 隨速度增加而較易控制；放手仍回到零拉力並先減速、再停下，學生仍可於同一 30 秒記錄內重新施力。此為 runtime interaction parameter，不寫入 snapshot；`physicsVersion` 維持 7，`measurementVersion` 維持 4，並增加 unit／browser regression 驗證加力可用及移動速度受控。）

本計劃必須遵從：

- `AGENTS.md`
- `plans/00-shared-platform-and-style.md`
- `docs/simulation-scorm-production-guide.md`
- `plans/NEW-SIMULATION-PLAN-TEMPLATE.md`

任何改變以下內容的修訂，必須先更新 plan、相關 version 及測試，才可以修改 implementation：

- 學習目標；
- 物理模型；
- 力感測器及運動量測模型；
- `F拉–t` 圖、隱藏運動狀態及同步記錄規則；
- 題目生成；
- 評分及容差；
- delayed-feedback contract；
- phase/state matrix；
- snapshot schema；
- touch gesture ownership；
- SCORM lifecycle。

---

## 1. Scope

- **Slug**：`static-kinetic-friction-investigation-lab`
- **學生可見標題**：`靜摩擦力與滑動摩擦力探究實驗室`
- **Plan**：`plans/18-static-kinetic-friction-investigation-lab.md`
- **學生介面語言**：繁體中文
- **建議完成時間**：20–28 分鐘；實作後再以學生 pilot 校準中位數及第 90 百分位完成時間
- **Assessment risk**：`low-risk graded`
- **Trusted validation for high risk**：`not applicable`
- **SCORM**：1.2
- **Libraries**：`none`
- **核心技術**：原生 HTML、CSS、JavaScript、Canvas、SVG、Pointer Events
- **Shared runtime**：
  - `sim/shared/styles.css`
  - `sim/shared/scorm.js`
  - `sim/shared/activity-flow.js`

### 1.1 Learning objectives

完成活動後，學生應能：

1. 說明摩擦力會因應接觸面的相對滑動趨勢而調整；
2. 由物體沒有水平外力及水平方向力平衡，推出：

   \[
   f_s=0
   \]
3. 由物體受水平拉力但仍保持靜止，推出：

   \[
   f_s=F_{\text{拉}}
   \]
4. 說明靜摩擦力並非固定等於 `μsN`，而是：

   \[
   0\leq f_s\leq f_{s,\max}
   \]
5. 透過逐步增加拉力、直接反覆向左／向右拖拉，找出物體開始滑動的臨界值，並估計最大靜摩擦力；
6. 由 Part B 的物體近似勻速滑動，推出：

   \[
   f_k\approx F_{\text{拉}}
   \]
7. 說明物體正在加速時：

   \[
   F_{\text{拉}}-f_k=ma
   \]

   因此此時測力計讀數不能直接當作滑動摩擦力；
8. 比較低速及較高速近似勻速區段的平均拉力，認識在本活動採用的高中理想模型下，滑動摩擦力的平均值基本不隨速度改變；
9. 分辨「直接量得的拉力」和「由運動狀態及牛頓定律推斷的摩擦力」；
10. 從自己產生的單一 `F拉–t` 圖建立及應用摩擦力模型；速度只作模擬內部回饋及評分判斷，不直接呈現給學生。

### 1.2 Learner task

學生需要：

1. 在沒有水平外力時，選擇摩擦力為零的類型、方向及大小；
2. 在指定的較小水平拉力下，直接由物體中央拖出拉力箭嘴，再選擇是否拖出等大反向的靜摩擦力箭嘴；
3. 直接拖拉物體並逐步增加拉力，向左／向右反覆試拉至物體開始滑動，再填寫最大靜摩擦力估計；
4. 進入 Part B，從舞台最左位置直接按住物體中央向右拖動拉力，在 30 秒內令物體開始並繼續移動，並在開始滑動後盡量調整至勻速直線運動；
5. 從同一次實驗即時產生的單一拉力—時間圖標示關鍵區段；
6. 由量測結果推斷靜摩擦力、最大靜摩擦力及滑動摩擦力；
7. 完成四個未直接測試情境的操作式預測；
8. 進入提交前檢查，一次提交後查看完整結果。

### 1.3 Main interactions

- A1 選擇摩擦力類型、方向及大小；保存後仍可直接返回修改，不清除 B／C／D 的獨立資料；
- A2 在控制欄選擇「畫拉力」或「畫摩擦力」，再直接由物體中央拖出對應箭嘴；可清除摩擦力箭嘴表示沒有摩擦力，保存後仍可重畫並修改；
- A3 不設向左／向右／重新試拉按鈕；直接拖動物體中央的拉力箭嘴，箭嘴端點即時跟隨手指／滑鼠，拉力可隨時向左／向右及改變大小；放手後拉力歸零，物體仍按當時速度及摩擦力連續運動；
- A／B／C／D 任務列可直接切換；Part B 不要求先完成 Part A，Part C 沒有有效 trace 時顯示中性等待提示，Part D 可先完成預測；
- Part B 只使用舞台上的 `experimentOrigin` 直接拖動 target；物體由舞台最左位置開始，拉力只可向右；手指向右移少量便增加拉力，向左移只會減少向右拉力至零，手指停住時力值保持；開始滑動後仍由手指位置直接控制拉力，不會被自動勻速輔助覆蓋；
- 放手後拉力回到 `0 N`，物體按滑動摩擦力自然減速，未到 30 秒仍可再次按住物體中央施力，不因物體停下而鎖定；
- 30 秒時間上限、超時提示及重新開始記錄；
- 物體移動太快／太慢時顯示「細力啲」／「大力啲」；
- 只顯示與測力計等效的拉力及 `F拉–t` 圖，不顯示摩擦力數值；
- 選擇 Part A 的摩擦力方向及類型；
- 拖動同步圖像的：
  - 開始移動時間 marker；
  - 靜止區段 start/end；
  - 低速勻速區段 start/end；
  - 加速區段 start/end；
  - 高速勻速區段 start/end；
- 查看自己所選區段的時間、平均拉力、拉力變化量及拉力標準差；
- 完成四個預測情境；
- review-edit；
- final submit。

### 1.4 Runtime files

```text
sim/static-kinetic-friction-investigation-lab/
  index.html
  styles.css
  generator.js
  physics.js
  measurement.js
  graph.js
  scoring.js
  persistence.js
  main.js

  generator.test.js
  physics.test.js
  measurement.test.js
  graph-analysis.test.js
  scoring.test.js
  persistence.test.js
  lifecycle.test.js
  delayed-feedback.test.js
  accessibility.test.js
  production-wiring.test.js
```

另加：

```text
sim/manifests/static-kinetic-friction-investigation-lab.xml
tools/static-kinetic-friction-browser-regression.js
```

### 1.5 第一版明確不包括

- 斜面；
- 改變物體質量或正向力作正式學生任務；
- 計算 `μs` 或 `μk`；
- 比較不同材料；
- 黏滑現象的高階 tribology 模型；
- 摩擦生熱；
- 空氣阻力；
- 速度非常高時摩擦係數改變；
- 任意二維拖動；
- 真實繩索鬆弛、碰撞或旋轉；
- 學生自行輸入任意公式；
- 完整 pointer path、每幀輸入或操作時間評分；
- 高風險考試或防 DevTools 篡改；
- SCORM 2004、xAPI 或 LRS。

---

## 2. Catalogue metadata (`sim/config.js`)

未完成 package-ready checks 前必須保持 `planned`：

```js
{
  title: "靜摩擦力與滑動摩擦力探究實驗室",
  folder: "static-kinetic-friction-investigation-lab",
  categories: ["Mechanics"],
  description:
    "直接拖動物體在 30 秒內同步記錄拉力—時間圖，從力平衡與牛頓第二定律探究靜摩擦力、最大靜摩擦力及滑動摩擦力。",
  tags: [
    "physics",
    "mechanics",
    "friction",
    "static-friction",
    "kinetic-friction",
    "direct-manipulation",
    "newtons-laws",
    "force-time-graph",
    "measurement",
    "scorm"
  ],
  status: "planned"
}
```

`folder`、活動資料夾、manifest identifier、snapshot activity identifier 必須完全相同。

---

## 3. 不可妥協的教學及產品契約

### 3.1 Editable phase 永遠不直接顯示摩擦力讀數

學生可以直接觀察或量度：

- Part B 測力計讀數／拉力 `F拉`；
- 物體有沒有移動及移動快慢的文字提示；
- 自己畫的受力箭嘴；
- Part A 指定外力及物體有沒有開始滑動；
- 自己選取圖像區段的時間及拉力統計值。

學生在提交前**不會直接看到**：

- 「摩擦力感測器」；
- 即時 `fs`；
- 即時 `fk`；
- 真實 `fs,max`；
- 真實 `μs` 或 `μk`；
- 正確 graph marker；
- 正確區段；
- 系統判定「靜摩擦／滑動摩擦」；
- 正確性顏色；
- 分數或合格狀態。

摩擦力只可以由學生根據：

\sum F_x=ma
\]

和當時運動狀態推斷。

### 3.2 `F拉–t`、隱藏運動狀態及記錄不可以分開生成

禁止：

```js
drawPresetForceCurve();
drawPresetVelocityCurve();
```

亦禁止：

```js
if (phase === "breakaway") {
  force = PRESET_PEAK;
}
```

學生介面只有一張 F–T 圖，不顯示第二張速度圖；但物理狀態、隱藏速度及量測記錄仍必須來自同一個時間步：

```text
學生手柄輸入
→ 連接系統產生拉力
→ 接觸狀態決定摩擦
→ 牛頓第二定律計算加速度
→ 更新速度與位置
→ 感測器量測層
→ 同一 timestamp 記錄拉力，並保留隱藏速度供「細力啲／大力啲」回饋、trial acceptance 及 C 評分
```

每一個 graph sample 必須包含同一時刻的：

```js
{
  timeS,
  measuredPullN,
  measuredVelocityMps // hidden authority data; never learner-facing in B/C
}
```

### 3.3 波動必須有明確來源

學生看到的波動只可來自：

1. **學生實際拖動不完全平穩**；
2. **表面沿位置的細微差異**；
3. **感測器有限響應、量化及極小量測誤差**。

禁止只為「看起來真實」而做：

```js
force += (Math.random() - 0.5) * 0.8;
```

任何量測波動都必須：

- 幅度受限；
- seeded、可重現；
- 不改變主要物理規律；
- 不令學生誤以為滑動摩擦力平均值隨速度增加；
- 不掩蓋最大靜摩擦峰值；
- 不成為評分陷阱。

### 3.4 探究現象與正確性回饋分開

提交前可提供：

- 真實模擬現象；
- 測力計讀數；
- 物體移動及速度調節提示；
- 單一 F–T 同步圖線；
- 學生自己所選區段的統計值；
- 實驗資料是否足夠完整的技術提示；
- 「記錄時間太短」；
- 「未有一段足夠長的近似勻速資料」；
- 「測力計超出量程」；
- 「重新實驗會清除圖像分析，但保留獨立的 Part D 預測」等中性依賴提示。

提交前不可提供：

- 正確／錯誤；
- 峰值選得太早／太遲；
- 區段選得好／不好；
- 正確滑動摩擦力；
- 正確最大靜摩擦力；
- 正確答案範圍；
- 綠剔、紅交叉；
- 正確 graph overlay；
- 隱藏在 DOM、ARIA、`data-*` 或透明圖層的答案。

### 3.5 只保存語意操作證據

不保存：

- 每個 pointermove；
- 拖動次數；
- 用時；
- 滑鼠或觸控；
- 完整高頻輸入軌跡；
- 中途錯過多少次；
- 重試次數。

只保存：

- A1 的零摩擦力答案；
- A2 的指定外力要求、學生直接拖出的外力向量及可選的學生靜摩擦力答案；
- A3 的試拉次數、最佳臨界值、方向及最大靜摩擦力估計；
- 一次獲接受的實驗 trace；
- 實驗產生的 breakaway event；
- 學生最後選擇的 graph marker／interval；
- 學生的摩擦力推斷；
- 四個預測答案。

---

## 4. 核心錯誤概念

| 錯誤概念 | 活動如何處理 |
|---|---|
| 粗糙面一定有摩擦力 | Part A1 直接要求學生在無水平外力時選擇 `f=0`，D1 再以未直接測試情境應用同一概念 |
| 靜摩擦力是固定數值 | Part A2 用一個小於上限的指定外力建立等大反向箭嘴；A3 再逐步試拉找上限 |
| 靜摩擦力永遠等於 `μsN` | 圖像顯示拉力可由 0 一直增加，`μsN` 只是上限 |
| 物體一移動，測力計讀數就一定等於滑動摩擦力 | 加速區段要求學生用 `F拉−fk=ma` 分析 |
| 滑得越快，滑動摩擦力一定越大 | 比較兩段不同速度但近似勻速的平均拉力 |
| 最大靜摩擦力是開始運動後的力 | 由物體實際開始移動的 hidden physics event 對齊單一 F–T 圖，峰值取自之前／臨界位置 |
| 摩擦力總是阻止物體「移動」 | 結果回饋改寫為「阻礙接觸面之間的相對滑動或相對滑動趨勢」 |
| 物體靜止就一定沒有力 | 靜止但有非零拉力及非零靜摩擦力 |
| 速度不變代表完全沒有力 | 低速／高速勻速區段都有拉力及摩擦力，但合力近似零 |

---

## 5. 整體流程

```text
A／B／C／D 任務可自由切換
→ 各 Part 保存自己的作答資料
→ 可返回修改，保留其他 Part
→ review（所有資料完整後）
→ submit
→ locked result
```

第一畫面直接進入任務，不設 landing page。上方 A／B／C／D 使用可操作任務列；切換只改變目前顯示的 Part，不代表答案完成或顯示正誤。B 的實驗記錄可在 A 未完成時開始；C 必須有 B 的有效 trace 才能進行圖像操作；D 的情境預測可在 C 未完成時先作答。所有未提交的 Part 都可以返回修改。

---

## 6. Part A：三個簡單受力圖／試拉任務

Part A 完全不使用測力計、讀數、歸零或 tare。舞台只顯示水平面、物體及由物體中央出發的簡化受力箭嘴；測力計只在 Part B 正式實驗出現。

### 6.1 A1：沒有水平外力時，摩擦力為零

初始情境固定為物體放在水平粗糙面上，但沒有任何水平外力。學生直接選擇：

- 摩擦力類型：`none`；
- 方向：`none`；
- 大小：`0 N`。

兩個選單初始都顯示 disabled 的「請選擇」，大小讀數亦顯示「請選擇」；系統不預選「沒有摩擦力」，學生必須明確揀選類型、方向及大小。若新開題或 draft 的 canonical `zeroForce` 仍為 `null`，啟動時會清除瀏覽器可能復原的表單值，確保畫面仍從「請選擇」開始；已有明確保存答案的 draft／review 則照常復原。學生必須按「保存 A1」作明確確認；未選答案不能靠預設值得分。A1 評分為 4 分：類型 1 分、方向 1 分、大小 2 分。

A1 保存按鈕在正常 `balance` phase 不會因已保存而鎖定。若學生改動並重新保存，只更新 A1 authority，不清除 A2、A3、實驗 trace、圖像分析及預測；相同答案重存視為 no-op。

### 6.2 A2：指定較小拉力下的靜摩擦力

系統為每個 seed 生成一個固定的指定拉力：

```js
balancePullDirection = "left" | "right";
balancePullN = quantize(staticLimitMeanN * pick([0.24, 0.28, 0.32, 0.36]), 0.1);
```

它必定小於本情境的最大靜摩擦力，並以文字明確顯示，例如「向右 2.1 N」。學生不需要、亦不能自行把力拉到會滑動的程度；只需在受力圖上建立靜摩擦力：

```text
靜摩擦力類型：static
大小：與指定拉力相同
方向：與指定拉力相反
```

控制欄只顯示指定拉力的方向／大小，並提供目前繪圖模式。學生用手指或滑鼠直接在物體中央開始拖動：

- 「畫拉力」模式建立學生的 applied-force 向量；
- 「畫摩擦力」模式建立學生的 static-friction 向量；
- 「不畫摩擦力」清除藍色箭嘴，明確代表沒有摩擦力。

兩支箭嘴都由物體中央出發，箭嘴方向及長度由學生拖動決定；不以 control-panel range 或測力計讀數代替。畫面上的學生施加水平力統一稱為「拉力」，紅／藍箭嘴文字分別在物體上方錯開排列，避免名稱與數字重疊。保存後 A2 仍可重新選模式、重畫並更新答案；只更新 A2 authority，不清除 A3 trial、實驗 trace、分析及預測，相同答案重存則保留下游 authority。A2 評分為 6 分：學生拉力方向 1 分、學生拉力大小 2 分、摩擦力類型 1 分、方向 1 分、大小 1 分；拉力及摩擦力大小使用 `max(0.15 N, 5%)` 的 inclusive tolerance。

Part A 內所有水平力箭嘴的 line 都使用同一個物體幾何中心 `comY` 作為起點；文字 label 可以放在物體上方以保持可讀性，但不改變力向量的起點。中心只保留一個約 `8 px` 的小閃爍圓點作提示，外層 `48×48 px` 透明 overlay 只作穩定觸控 hit target，不再顯示大型圓圈或「受力圖由重心出發」文字。Prediction stage 沿用同一種中心起點視覺規格。

學生在此觀察到：物體仍然靜止，所以水平方向合力為零，而靜摩擦力會按需要調整，並不是固定的最大值。

### 6.3 A3：逐步增加拉力，找出最大靜摩擦力

完成 A2 後，物體中央的拉力繪圖 target 會直接開放。學生由物體中央按住並拖動拉力箭嘴；箭嘴由物體重心出發，箭嘴端點和拉力大小／方向即時跟隨手指／滑鼠，不設「向左試拉」、「向右試拉」或「重新試拉」按鈕。拖動期間的水平拉力取為重心至箭嘴端點的有向距離；放手代表拉力即時回到 `0 N`，物體不會被重置或突然停下，而會按當時速度及滑動摩擦力自然減速。學生可以在物體仍運動時重新按住物體，向相反方向施力；物體會按合力連續出現由靜止開始加速、勻速、減速及倒轉方向的運動：

```js
breakawayThresholdCN = Math.ceil(staticLimitMeanN * 10) * 10;
```

物體在舞台上由靜止轉為滑動；A3 舞台只顯示紅色學生拉力箭嘴，完全不顯示靜摩擦力箭嘴或假定的摩擦力讀數。放手後拉力歸零，物體仍可繼續滑行並減速；下一次按住物體即可即時改變方向及大小。當物體離開可見舞台範圍時，舞台才顯示「物體返回中央」按鈕；按下後只把 A3 的暫態位置、速度及當前拉力重設為中央、靜止、`0 N`，不清除已保存的試拉證據。系統只保存試拉次數、最小開始滑動拉力及方向，不保存 pointer path 或操作時間。臨界值採 0.1 N 語意步進，確保學生實際可以逐步接近。

找到至少一次臨界值後，學生填寫「我估計最大靜摩擦力」並保存。A3 評分為 10 分；答案與生成的 `staticLimitMeanN` 比較，容許：

```js
Math.max(0.30, 0.05 * staticLimitMeanN)
```

這個誤差容許學生因逐步加力或未能一次精準踩在臨界點而仍能表達正確概念。A3 的試拉本身是學習證據及進入答案欄的 prerequisite，不以試拉次數或方向扣分。

### 6.4 Part A 完成條件

三項答案均明確保存，且 A3 至少有一次開始滑動試拉，Part A 才算完成；但這個完成狀態不再鎖住 Part B、C 或 D。Part A 完成後不顯示正誤、真實摩擦係數或隱藏的最大值；完整分數及物理解釋只在提交後顯示。返回 A 修改時保留 B 的 trace、C 的分析及 D 的預測；若學生在 A 仍未完成時先做 B／D，之後返回 A 仍可保存答案。

---

## 7. Part B：直接拖動物體並同步產生 `F拉–t` 圖

### 7.1 舞台與可見量

舞台模仿 Part A：只顯示水平粗糙面、物體及由物體重心出發的紅色向右拉力箭嘴；不顯示測力計圖案、繩或摩擦力箭嘴。物體由舞台最左位置開始。記錄期間，物體中央顯示一個很小的閃爍圓點作為 `experimentOrigin` 觸控／滑鼠 target；學生直接按住該圓點向右拖動，拉力箭嘴跟手指同步改變。向左移只會減少向右拉力，不能施加向左拉力。

物體下方固定顯示一張單一圖：

\[
\text{拉力 }F_{\text{拉}}\text{—時間 }t
\]

時間軸固定為 `0–30 s`。圖線在記錄期間逐點增加，圖上只畫學生施加的拉力；此拉力就是本活動中測力計應量到的拉力。摩擦力數值、最大靜摩擦力及滑動摩擦力均不在 B 顯示。

### 7.2 操作與 30 秒限制

學生按「開始 30 秒記錄」後，物體放在舞台最左位置；按住物體中央的直接拖動 target 調整向右拉力：

1. 先慢慢向右增加拉力，直至物體開始移動；
2. 開始移動後繼續施力，盡量保持勻速直線運動；
3. 手指停住時，直接拖動 target 保持目前的拉力；手指向右移少量，向右拉力相應增加少量；向左移只會減少目前向右拉力，不能改成向左拉力；有效範圍為 `0–12 N`；
4. 直接拖動輸入先轉為 connector handle target，`Physics.stepPhysics` 以 spring／connector 的實際張力作為測力計等效讀數。當張力超過最大靜摩擦力，接觸狀態由 static 轉為 sliding；滑動開始時因 `f_k<f_{s,max}`，張力會自然出現 breakaway drop，不能由程式硬畫成固定拉力。學生在滑動期間再次改變手指位置時，才進入本次拖動的 direct force-control，讓拉力可即時增加／減少並保持；這不是自動勻速或 kinetic-follow 輔助，而是學生新輸入的實際水平力，物體的加速、減速或重新停下由 `F_{\mathrm{net}}=ma` 決定；
5. 放手後 target 回到無拉力狀態，物體不會瞬間停下，而會按 `F_{\mathrm{net}}=F_{\mathrm{拉}}-f_k=ma` 先減速，速度降至零後才重新進入 static；未到 30 秒，學生仍可再次按住物體中央施力令物體重新運動；
6. 物理操作的 handle response 預設使用 `HANDLE_OMEGA=24` 及 `HANDLE_SPEED_LIMIT_MPS=0.06`，令物體在手機窄舞台上明顯慢速移動；滑動期間學生再次改力時可暫用 `0.24 m/s` 的 handle response 追上新輸入，之後仍保留加速、勻速、減速及重新施力的連續行為；
7. 可在任何時刻停止並保存一次已開始移動且有持續移動的記錄；「重新開始」在沒有 accepted trial、只有未保存／失敗記錄或已有 accepted trial 時都可使用，一按即清除舊 B trace／C analysis 並直接開始新的 30 秒記錄，不需停止、確認或保留目前資料。

記錄時間不可超過 `30 s`。若時間達到上限，立即停止物理更新並顯示：

> 時間已經超時，請重新開始記錄。

超時記錄不會成為 C 的資料；學生按「重新開始記錄」後，物體、時間及 `F拉–t` 圖全部回到空白狀態。學生可以無限重試，不因超時扣分。

### 7.3 即時輔助提示

輔助只描述運動速度，不透露摩擦力答案：

- 尚未移動：「慢慢增加拉力，令物體開始移動。」
- 移動太快：「細力啲。」
- 移動太慢或即將停下：「大力啲。」
- 速度在適合範圍：「保持呢個拉力，盡量保持勻速直線運動。」活動簡介及操作要求亦明確指出，開始滑動後的主要目標是盡量保持勻速直線運動；系統只提供「細力啲／大力啲」方向提示，不會自動把拉力鎖定在勻速值。

直接拖動的水平位移映射改善學生微調拉力時的操作解析度；A、B、C、D 仍共用同一個 seeded 靜摩擦／滑動摩擦模型，不另設 B 專用摩擦力或人為阻尼。

系統不要求特定拉力上升曲線、不預先標示峰值、不顯示摩擦力，亦不因學生的拉力路徑不同而即時判斷答案正誤。保存前只檢查是否已開始移動、是否在 30 秒內及是否有足夠的持續移動資料。

---

## 8. Part C：從同一張 `F拉–t` 圖找出摩擦力概念

### 8.1 圖像與介面

C 只保留 B 產生的單一 `F拉–t` 圖，時間軸仍為 `0–30 s`，不再同時放置第二張速度圖、速度游標或另一套圖表操作。學生返回 C 後，圖線和 B 完全相同；所有分析控制均在圖下方逐項完成，當前項目才可操作，其餘項目保持清楚的「未開始／已保存」狀態。

### 8.2 學生要完成的五個簡單項目

#### C1：物體仍然靜止而拉力增加的區段

學生在 F–T 圖拖動一對開始／結束 handles，選出物體仍然靜止而拉力增加的區段。

所選區段統計顯示：

- 開始及結束時間；
- 平均拉力；
- 拉力變化量；
- 拉力標準差。

學生再選擇：

- 摩擦力類型；
- 摩擦力和拉力的關係。

正確概念：

\[
v=0,\quad a=0
\]

所以：

\[
f_s=F_{\text{拉}}
\]

#### C2：物體剛開始移動的時刻

學生拖動一條垂直 marker，放在物體由靜止開始移動的時刻；畫面只讀出該時刻的 F–T 拉力。

學生輸入／拖動一個最大靜摩擦力估值：

\[
f_{s,\max}\approx F_{\text{拉,peak}}
\]

學生選取的讀數完全來自自己的圖。

學生亦須明確把該估值標示為「最大靜摩擦力」；此 enum 初值為 `null`，不由題目預先選好。

#### C3：開始移動後的穩定拉力區段

學生在 breakaway 之後選取一段較穩定的拉力區段，估計滑動摩擦力。系統只顯示：

```text
平均拉力
拉力變化量
拉力標準差
```

在勻速近似下：

\[
f_k\approx\overline{F_{\text{拉}}}
\]

#### C4：拉力較大而令物體加速的區段

學生根據 F–T 圖選取開始移動後拉力明顯高於穩定平台的區段。

學生要判斷：

\[
F_{\text{拉}}\quad ?\quad f_k
\]

正確是：

\[
F_{\text{拉}}>f_k
\]

系統保留物體運動狀態作提交後判斷，學生只需由圖理解：

\[
F_{\text{拉}}-f_k=ma
\]

學生不可以將這段較大的拉力直接當成滑動摩擦力。

UI 另問「這段的平均測力計讀數可否直接當作 `fk`？」並保存 `pullEqualsFk: "yes" | "no"`；初值為 `null`。

這一部分用來防止學生只記：

> 開始滑動後，測力計讀數就是滑動摩擦力。

#### C5：比較另一段移動後的拉力平台

學生再選取另一段移動後較穩定的拉力平台，並比較兩段平台平均值：

\[
f_k\approx\overline{F_{\text{拉,fast}}}
\]

預期兩者平均值接近，但瞬時 F–T 曲線可以有細微波動。

學生最後選擇一個敘述：

> 在本活動所採用的高中理想模型下，速度改變時，滑動摩擦力的平均值基本保持不變。

### 8.3 Graph selection UI

每一個區段有：

- 半透明選區；
- start handle；
- end handle；
- 區段名稱；
- 只與目前項目相關的數據統計。

Graph handles 不吸附到正確區段，只可吸附到一般 sampling timestamp。

系統可以防止：

- end 早於 start；
- 區段短過最小長度；
- 選區超出 `0–30 s`；
- 所選區段超出 trace。

系統不會在操作時告訴學生哪一段正確；正確性只在提交後判定。C 的五項均來自 B 的同一張圖，不要求學生重新操作另一張圖或重新學習另一套游標。

---

## 9. Part D：未直接測試情境預測

每個 attempt 由 seed 生成四個情境。學生不是答純 MC，而是要：

1. 選擇靜摩擦／滑動摩擦／無摩擦；
2. 設定摩擦力方向；
3. 拖動摩擦力箭嘴大小；
4. 判斷物體運動會保持、加速、減速或開始滑動。

### D1：沒有水平拉力，物體靜止

權威關係：

\[
F_{\text{拉}}=0,\qquad f_s=0
\]

### D2：物體靜止，非零拉力低於最大靜摩擦力

權威關係：

\[
f_s=F_{\text{拉}}
\]

### D3：物體已經向右滑動，拉力大於滑動摩擦力

題卡明示：「以本次實驗建立的模型，估計此材料的**平均滑動摩擦力**」，箭嘴 label 亦顯示「平均 `fk` 估值」，不要求未知位置的瞬時微小 variation。

權威關係：

\[
F_{\text{拉}}>f_k
\]

所以：

\[
a>0
\]

### D4：物體向右滑動，拉力小於滑動摩擦力

題卡同樣要求平均 `fk` 估值；表面微小 variation 不進 prediction authority。

權威關係：

\[
F_{\text{拉}}<f_k
\]

所以物體減速。

提交後 feedback 可進一步說明（不是另一個計分小題）：

> 當物體停下，而目前拉力仍低於最大靜摩擦力，摩擦力會變成多少？

正確是重新進入靜摩擦狀態：

\[
f_s=F_{\text{拉}}
\]

而不是繼續保持原來的 `fk`。

---

## 10. Delayed-feedback contract

提交前只顯示：

- 學生自己量到的數據；
- 學生自己選取區段的統計值；
- 學生自己建立的力箭嘴；
- 完成狀態；
- 技術性資料質素；
- 上游修改會清除下游答案的中性提示。

提交前禁止：

- 正確區段；
- 正確 marker；
- 正確摩擦力；
- 正確公式提示；
- 「太大／太小」；
- 「接近峰值」；
- 「這段是勻速」；
- 「你的兩個平均值相同」；
- 即時分數；
- 逐題重試回饋。

可自由修改，但同一 attempt 只提交一次。提交後整個 attempt 鎖定；再做必須由 Moodle 開新 attempt。

---

## 11. Physics model

### 11.1 權威單位

內部全部用 SI：

- 位置：m；
- 速度：m/s；
- 加速度：m/s²；
- 力：N；
- 時間：s；
- 質量：kg。

Physics 使用完整 SI precision。量測層先按本 plan 的 resolution 量化，量化後的 canonical measured values 同時供 graph、scoring 及 snapshot 使用；顯示層可以再作格式化，但不可反向成為 authority。

### 11.2 權威物理狀態

```js
{
  timeS,

  block: {
    positionM,
    velocityMps,
    accelerationMps2
  },

  handle: {
    targetPositionM,
    positionM,
    velocityMps
  },

  connector: {
    extensionM,
    tensionPhysicalN
  },

  contact: {
    mode: "static" | "sliding",
    frictionPhysicalN
  }
}
```

Sensor calibration、noise PRNG 及 recorder state 屬 `measurement.js`，不放入 `physics.js` 的 state。`physics.step()` 只輸出 physical state 與 transition events；`measurement.step()` 消費該輸出，且任何 measured value 都不可反饋 physics。

### 11.3 Part B 舞台直接拖動／spring connector 模型

Part B 使用固定於物體中央、穩定 48×48 CSS px 的 `experimentOrigin` overlay。學生按住舞台上的小圓點向右拖動；pointer 位移透過同一個 semantic update function 轉為 connector handle target，向右位移增加 `0–12 N` 的目標拉力，向左位移只會把向右拉力減少至零，不能產生向左拉力。pointer 停住時 target 不變，拉力保持；pointerup／pointercancel 令施加拉力回到零，但不清除物體的物理速度或圖線。mouse、trusted touch 及 keyboard 方向鍵使用同一套 force update。

舞台只顯示由物體重心出發的紅色拉力箭嘴；B 不顯示 `f_s`、`f_k` 或任何摩擦力箭嘴。F–t 圖只畫由 measurement layer 量到的 connector tension；圖上不再顯示「拉力」／「F–t 圖 0–30 秒」的冗餘頂部標籤，只保留放大的刻度、`F拉/N` 及小寫 `t/s` 軸標籤。

正向力及摩擦 authority：

```js
normalForceN = scenario.massKg * GRAVITY_MPS2;
staticLimitAt(x) = scenario.muS * normalForceN;
kineticFrictionAt(x) = scenario.muK * normalForceN *
  (1 + scenario.surfaceVariationFraction * surfaceVariation(x));
```

V1 的最大靜摩擦力不隨位置變；只有滑動摩擦力有小幅、active-track 零平均的空間 variation。所有可到達位置仍必須滿足 `staticLimitAt(x) > kineticFrictionAt(x)`。

對每一個 physics tick，初次拉動先以 handle response、connector extension 及 damping 計算實際張力，再用牛頓第二定律更新：

\[
F_{\text{net}}=F_{\text{拉}}-f_k=ma
\]

物體靜止時，若 connector tension 未超過最大靜摩擦力，接觸狀態保持 static；超過臨界值便轉為 sliding。因為 `f_k<f_{s,max}`，breakaway tick 後實際 connector tension 會由峰值落到滑動平台，不可把拉力鎖定為學生剛才的數值。滑動後，學生若再次改變手指位置，該次拖動進入 direct force-control，拉力數值直接成為這次新的施力；手指停住時保持，向左移只減少向右力，放手則回到 `0 N`。在兩種模式下，物體都以 `F_{\mathrm{net}}=ma` 更新；若拉力 `< f_k` 或放手令拉力降至 `0 N`，`a<0`，物體先按目前速度減速，速度降至零才回到 static，因此學生可在同一段 30 秒記錄中重新加力、減力或令物體再次移動。圖像只顯示量測到的 `F拉`，不顯示 `f_s` 或 `f_k`。

為配合手機窄舞台，未突破或尚未再次改力時的 handle response 固定為 `HANDLE_OMEGA=24`、`HANDLE_ZETA=1`、`HANDLE_SPEED_LIMIT_MPS=0.06`。滑動中學生再次改力後，runtime 以明確的 `0.24 m/s` response limit 讓 connector 有機會追上新施力；若該次拖動已進入 direct force-control，物理引擎直接以學生的新拉力及 `F_{\mathrm{net}}=ma` 更新 block。這個 transient control 不進 snapshot，放手時清除並把 handle 放回無拉力位置；block 仍按實際摩擦、質量及剩餘速度自然減速或再次運動。

### 11.4 Part B 運動提示

提示根據速度及加速度提供 pacing guidance，不會寫出摩擦力數值或正確答案：物體未動時提示慢慢增加拉力；移動太快時提示「細力啲」；移動太慢或即將停下時提示「大力啲」；速度在合適範圍時提示保持拉力、盡量勻速。提示只影響 learner feedback，不會改寫物理 state。

### 11.5 靜摩擦狀態

當物體仍然靜止：

\[
|F_{\text{拉}}|\leq f_{s,\max}
\]

接觸面提供：

\[
f_s=F_{\text{拉}}
\]

方向相反，令：

\[
a=0
\]

```js
function resolveStaticContact(state, tensionN, scenario) {
  const limitN = staticLimitAt(
    state.block.positionM,
    scenario
  );

  if (
    Math.abs(state.block.velocityMps) <= V_STICK_MPS &&
    tensionN <= limitN + FORCE_EPSILON_N
  ) {
    return {
      mode: "static",
      frictionN: tensionN,
      accelerationMps2: 0,
      velocityMps: 0
    };
  }

  return null;
}
```

### 11.6 開始滑動

當：

\[
F_{\text{拉}}>f_{s,\max}
\]

contact mode 由：

```text
static -> sliding
```

Transition tick 內以相鄰 physical tension 對 `staticLimitN` 的 crossing 作線性插值：

```js
u = clamp(
  (staticLimitN - previousTensionN) /
    (proposedTensionN - previousTensionN),
  0,
  1
);
breakawayTimeS = previousTimeS + u * dt;
```

若 denominator 小於 epsilon，使用觸發 tick time。Physics 只發出以下 raw event：

```js
{
  type: "breakaway",
  timeS: breakawayTimeS,
  physicalTensionN,
  staticLimitN
}
```

Measurement layer 消費 raw event，使用同一 `u` 在相鄰 measurement states 間插值後量化，建立 `MeasuredBreakawaySidecar { timeMs, measuredPullCN, measuredVelocityMMps, preBreakPeakGridIndex }`。Physics 不知道 measured values 或 sample index；merged canonical index 永遠在 unpack／merge 時派生，不進 raw event 或 snapshot。此規則固定於 `physicsVersion`／`measurementVersion`，避免 marker authority 隨 frame schedule改變。

這個 event：

- 提交前不顯示為正確答案；
- 用於評分學生的 marker；
- 用於 review overlay；
- 用於驗證 trace 是真正由靜止進入滑動。

### 11.7 滑動狀態

本活動採用平均值基本不依賴速度的高中 Coulomb model：

\[
f_k(x)=\mu_{k,0}N[1+A_s\eta(x)]
\]

其中：

- `μk,0N` 是平均滑動摩擦力；
- `η(x)` 是零平均、受限的表面空間變化；
- `As` 很小。

物體向右滑動時：

\[
a=\frac{F_{\text{拉}}-f_k}{m}
\]

```js
function resolveSlidingContact(state, tensionN, scenario) {
  const frictionN = kineticFrictionAt(
    state.block.positionM,
    scenario
  );

  const accelerationMps2 =
    (tensionN - frictionN) / scenario.massKg;

  return {
    mode: "sliding",
    frictionN,
    accelerationMps2
  };
}
```

### 11.8 停止及重新黏住

當拉力小於滑動摩擦力，物體會減速。

如果下一步速度會越過零，而且：

\[
F_{\text{拉}}\leq f_{s,\max}
\]

便重新進入 static：

```js
function maybeRestick(state, tensionN, nextVelocityMps, scenario) {
  const staticLimitN = staticLimitAt(
    state.block.positionM,
    scenario
  );

  if (
    state.block.velocityMps > 0 &&
    nextVelocityMps <= 0 &&
    tensionN <= staticLimitN + RESTICK_EPSILON_N
  ) {
    return {
      mode: "static",
      frictionN: tensionN,
      velocityMps: 0,
      accelerationMps2: 0
    };
  }

  return null;
}
```

### 11.9 完整 fixed-step

```js
const PHYSICS_DT_S = 1 / 240;

function stepPhysics(state, input, scenario, dt) {
  const handle = stepHandle(
    state.handle,
    input.handleTargetPositionM,
    dt
  );

  const tautening = splitAtRestLengthCrossing(
    state,
    handle,
    scenario.connector.restLengthM,
    dt
  );

  if (tautening) {
    return stepSlackThenTautSubsteps(
      state,
      handle,
      input,
      scenario,
      tautening.slackDt,
      tautening.tautDt
    );
  }

  const extensionM = Math.max(
    0,
    handle.positionM -
      state.block.positionM -
      scenario.connector.restLengthM
  );

  const relativeVelocityMps =
    handle.velocityMps - state.block.velocityMps;

  const gapM = handle.positionM - state.block.positionM;
  const isTaut = gapM >= scenario.connector.restLengthM;
  const dampingWeight = smoothstep(
    0,
    DAMPING_ENGAGEMENT_LENGTH_M,
    extensionM
  );

  const tensionN = isTaut
    ? Math.max(
        0,
        scenario.connector.stiffnessNPerM * extensionM +
          dampingWeight *
            scenario.connector.dampingNsPerM * relativeVelocityMps
      )
    : 0;

  const staticResult =
    state.contact.mode === "static"
      ? resolveStaticContact(state, tensionN, scenario)
      : null;

  if (staticResult) {
    return updatePhysicalStateAndTime(
      state,
      {
        handle,
        extensionM,
        tensionN,
        contact: staticResult,
        blockPositionM: state.block.positionM,
        blockVelocityMps: 0
      },
      scenario,
      dt
    );
  }

  const sliding = resolveSlidingContact(
    state,
    tensionN,
    scenario
  );

  const proposedVelocityMps =
    state.block.velocityMps +
    sliding.accelerationMps2 * dt;

  const restick = maybeRestick(
    state,
    tensionN,
    proposedVelocityMps,
    scenario
  );

  if (restick) {
    return updatePhysicalStateAndTime(
      state,
      {
        handle,
        extensionM,
        tensionN,
        contact: restick,
        blockPositionM: state.block.positionM,
        blockVelocityMps: 0
      },
      scenario,
      dt
    );
  }

  const velocityMps = Math.max(0, proposedVelocityMps);
  const positionM =
    state.block.positionM + velocityMps * dt;

  return updatePhysicalStateAndTime(
    state,
    {
      handle,
      extensionM,
      tensionN,
      contact: {
        ...sliding,
        mode: "sliding"
      },
      blockPositionM: positionM,
      blockVelocityMps: velocityMps
    },
    scenario,
    dt
  );
}
```

使用 semi-implicit Euler；scoring 不可以依賴 render frame。

### 11.10 Fixed timestep runner

```js
let accumulatorS = 0;
let previousFrameMs = null;
const inputQueue = []; // { timeS, handleTargetPositionM }

function animationFrame(nowMs) {
  if (previousFrameMs === null) {
    previousFrameMs = nowMs;
  }

  const rawFrameDurationS = (nowMs - previousFrameMs) / 1000;
  if (rawFrameDurationS > 0.05) {
    accumulatorS = 0;
    previousFrameMs = nowMs;
    if (recorder.isRunning()) abortTrialForTimingGap();
    renderApparatus(physicsState);
    requestAnimationFrame(animationFrame);
    return;
  }
  const frameDurationS = rawFrameDurationS;

  previousFrameMs = nowMs;
  accumulatorS += frameDurationS;

  while (accumulatorS >= PHYSICS_DT_S) {
    const tickTimeS = physicsState.timeS + PHYSICS_DT_S;
    const tickInput = inputAt(inputQueue, tickTimeS);

    physicsState = stepPhysics(
      physicsState,
      tickInput,
      scenario,
      PHYSICS_DT_S
    );

    const measured = measurement.step(
      measurementState,
      physicsState,
      scenario,
      PHYSICS_DT_S
    );
    measurementState = measured.state;
    recorder.captureIfDue(physicsState, measured);
    accumulatorS -= PHYSICS_DT_S;
  }

  renderApparatus(physicsState);
  requestAnimationFrame(animationFrame);
}
```

Pointer、keyboard 及 coalesced input 必須用 `event.timeStamp` 經固定 page-time→simulation-time offset 轉成 simulation-clock timestamp 並進入 queue；每個 physics tick 使用該 tick 時刻以前的最後 target（zero-order hold）。同 timestamp 依 browser event order，舊 queue entries 在所有較早 ticks 消費後才移除。不可把最新 target 追溯套用到積壓 ticks。

超過 `50 ms` 的背景／stall 時間明確丟棄，不作 catch-up；若正在記錄，該次 trial 以中性技術原因作廢並返回 recording 前 checkpoint。相同 seed、相同 timestamped input path 和相同 versions 必須在 60／90／120 Hz、coalesced events 及含短 stall 的 render schedules 下產生同一 canonical trace。

---

## 12. 真實波動及量測模型

### 12.1 表面空間差異

不使用每一 frame 獨立 random。

生成一條 deterministic surface profile：

```js
function surfaceVariation(positionM, profile) {
  const a =
    0.55 *
    Math.sin(
      2 * Math.PI * positionM / profile.lambda1M +
      profile.phase1
    );

  const b =
    0.30 *
    Math.sin(
      2 * Math.PI * positionM / profile.lambda2M +
      profile.phase2
    );

  const c =
    0.15 *
    Math.sin(
      2 * Math.PI * positionM / profile.lambda3M +
      profile.phase3
    );

  const raw = a + b + c;
  return (raw - profile.activeTrackMean) *
    profile.activeTrackScale;
}
```

Generator 必須在固定、版本化的 active track grid 上計算並保存 `activeTrackMean`。為避免任意位置超界，固定 `activeTrackScale = 1 / (1 + abs(activeTrackMean))`；因 raw sinus sum 本身在 `[-1,1]`，runtime 回傳必在 `[-1,1]`，而 active-grid 平均精確為 0（只差 floating epsilon）。所以「零平均」是 runtime 函數對本活動可到達路段的可測 invariant，而不只是 generator 暫時計算值；大量 seeds 亦須驗證任何合法慢／快平台位置不會產生系統性速度相關 bias。

滑動摩擦：

```js
function kineticFrictionAt(positionM, scenario) {
  const variation = surfaceVariation(
    positionM,
    scenario.surfaceProfile
  );

  return scenario.kineticFrictionMeanN *
    (1 + scenario.surfaceVariationFraction * variation);
}
```

初始建議：

```js
const SURFACE_VARIATION_FRACTION = 0.02;
```

即平均 `5.0 N` 的滑動摩擦力，表面造成的物理波動通常只約：

\[
\pm0.10\,\mathrm N
\]

量級。

#### 重要效果

因為變化是 `η(x)`，不是 `η(t)`：

- 同一表面位置有一致細節；
- 低速時，波動在時間軸較疏；
- 高速時，物體更快經過相同空間特徵，波動在時間軸較密；
- 但平均摩擦力不會因此隨速度增加。

### 12.2 學生手部輸入

學生拖動本身會有：

- 微小速度變化；
- 停頓；
- 加速；
- 減速。

這些會經有限剛度連接系統自然反映在拉力圖，不需要人工加入大幅 noise。

### 12.3 Sensor calibration

每個 attempt 開始時，Part B 測力計的零點由系統固定校準，不生成需要學生修正的 bias，也不保存 tare correction。這個校準是 Part B runtime 的量測前提，不是 learner action；Part A 完全不建立測力計或讀數流程。

```js
forceMeasuredN = quantize(
  Math.max(0, forceFilteredN + boundedNoiseN),
  FORCE_SENSOR_RESOLUTION_N
);
```

`measurement.js` 不再提供 `tare()`，measurement state 不包含 `tared`、`tareCorrectionCN` 或 `forceBiasN`。零拉力時的 Part B 顯示讀數只受 bounded noise 影響；Part A 沒有 measurement record、sensor input 或 tare control。這些欄位及操作不可出現在 draft、review 或 pending-final snapshot。

### 12.4 感測器響應

感測器只屬 measurement layer，不反過來改變 physics。

一階低通：

\[
F_m(t+\Delta t)
=
F_m(t)
+
\alpha[F_{\text{物理}}-F_m(t)]
\]

其中：

\[
\alpha=1-e^{-\Delta t/\tau}
\]

```js
function lowPass(previous, target, dt, timeConstantS) {
  const alpha = 1 - Math.exp(-dt / timeConstantS);
  return previous + alpha * (target - previous);
}
```

初始建議：

```js
const FORCE_SENSOR_TAU_S = 0.025;
const VELOCITY_SENSOR_TAU_S = 0.040;
```

### 12.5 感測器 noise

只在 graph sample 時更新 seeded AR(1) noise：

```js
function stepCorrelatedNoise(previous, rng, rho) {
  const white = clamp(gaussianFromSeededRng(rng), -3, 3);
  return clamp(
    rho * previous +
      Math.sqrt(1 - rho * rho) * white,
    -3,
    3
  );
}
```

```js
forceMeasuredN =
  quantize(
    Math.max(
      0,
      forceFilteredN +
        FORCE_SENSOR_NOISE_SIGMA_N * forceNoise
    ),
    FORCE_SENSOR_RESOLUTION_N
  );
```

初始建議：

```js
const FORCE_SENSOR_NOISE_SIGMA_N = 0.015;
const FORCE_SENSOR_RESOLUTION_N = 0.01;
const FORCE_NOISE_RHO = 0.70;
const FORCE_SENSOR_NOISE_MAX_ABS_N = 0.045;
```

量測 noise 應該極小，不可以靠大幅亂跳製造「儀器感」。所有 seeds 均須滿足 `abs(boundedNoiseN) <= FORCE_SENSOR_NOISE_MAX_ABS_N`；速度 noise 同樣硬截在 `3σ = 0.0075 m/s`。超量程判定使用 physical／filtered signal 加已知硬上限，不得由罕見 random outlier 單獨令 trial 失敗。

### 12.6 Velocity measurement

速度 authority 來自 physics state；measurement layer 仍保存經輕微 sensor response 處理的 hidden 值，供 B 的速度文字提示、trial acceptance 及 C 評分，不在學生 graph 顯示：

```js
velocityMeasuredMps =
  quantize(
    Math.max(
      0,
      velocityFilteredMps +
        VELOCITY_NOISE_SIGMA_MPS * velocityNoise
    ),
    VELOCITY_RESOLUTION_MPS
  );
```

建議：

```js
const VELOCITY_NOISE_SIGMA_MPS = 0.0025;
const VELOCITY_RESOLUTION_MPS = 0.001;
```

速度訊號只作 hidden physics／feedback／scoring authority；學生 B／C 不會看到速度圖或速度數值。

### 12.7 PASCO 實測校準

以上 constants 是 implementation 初值，不應視為最終定案。

正式凍結前，應以同類 PASCO 裝置做至少：

```text
5–10 次由靜止拉至低速勻速
5–10 次低速 → 加速 → 高速勻速
```

量度：

- 峰值／滑動平台平均值比例；
- breakaway force drop 時間；
- 低速平台 force coefficient of variation；
- 高速平台 force coefficient of variation；
- 兩段平台平均值差異；
- 基線 force RMS；
- force trace 自相關時間；
- 加速區段拉力高於平台的幅度。

建議初始驗收範圍：

```text
peak force > kinetic plateau mean by at least 10%
slow/fast plateau mean ratio: 0.94–1.06
plateau force coefficient of variation: about 1%–5%
force baseline RMS after calibrated startup: small relative to kinetic plateau
acceleration interval mean force > plateau mean
```

目標不是逐點複製某一次 PASCO trace，而是校準統計特徵和整體趨勢。

---

## 13. Graph sampling 及保存

### 13.1 Sampling

Physics：

```js
const PHYSICS_DT_S = 1 / 240;
```

Graph：

```js
const GRAPH_SAMPLE_DT_S = 0.10; // 10 Hz; 301 samples cover 0–30 s
```

每次 sample：

```js
function captureSample(physics, measurement) {
  return {
    timeS: physics.timeS,
    measuredPullN: measurement.forceMeasuredN,
    measuredVelocityMps: measurement.velocityMeasuredMps
  };
}
```

同一 sample object 產生一張 learner-facing F–T 圖及一組 hidden velocity data，禁止兩個獨立 recorder。

### 13.2 Breakaway peak 保留

一般 25 Hz sampling 可能錯過非常窄的峰值。Canonical trace 因此由兩部分組成：

1. 嚴格 `100 ms` grid samples；
2. 一個帶有自身 `timeMs` 及量測值的 breakaway sidecar sample。

`static -> sliding` 的 physics event 發生時，measurement layer 在該精確 simulation time 更新 filter，量化 `measuredPullCN`／`measuredVelocityMMps`，並保存 breakaway 前 grid samples 的 local measured peak index。Renderer／scorer 以 `(timeMs, kind)` 穩定排序合併兩者；同 timestamp 時 event 取代普通 grid sample，不重複。所有 graph answer index 都指向這個 deterministic merged canonical array。

學生 `f_s,max` 讀圖分的 authority 是合併後 trace 在 breakaway 前／當刻的最大**可見 measured pull**：

```js
visibleBreakawayPeakCN = max(
  regularSamples[preBreakPeakGridIndex].pullCN,
  breakaway.measuredPullCN
);
```

Hidden physical `staticLimitAt(x)` 只用於 model 診斷及提交後解釋，不直接作讀圖分答案。

### 13.3 Trace compression

SCORM 1.2 snapshot 必須保持低於 project 規定的 4000 UTF-8 bytes。

不保存 JSON object array：

```js
[
  { timeS: 0.04, measuredPullN: 0.01, ... },
  ...
]
```

改用固定 grid＋quantized packed trace及一個 event sidecar：

```js
{
  sampleDtMs: 100,
  regularSampleCount: 301,
  forceVelocityBase64: "...",
  breakaway: {
    timeMs: 1726,
    measuredPullCN: 643,
    measuredVelocityMMps: 3,
    preBreakPeakGridIndex: 42
  }
}
```

每個 sample：

```text
uint16 force in centinewtons
int16 velocity in millimetres per second
```

```js
function packTrace(samples) {
  const bytes = new ArrayBuffer(samples.length * 4);
  const view = new DataView(bytes);

  samples.forEach((sample, index) => {
    const offset = index * 4;

    view.setUint16(
      offset,
      Math.round(sample.measuredPullN * 100),
      true
    );

    view.setInt16(
      offset + 2,
      Math.round(sample.measuredVelocityMps * 1000),
      true
    );
  });

  return bytesToBase64(new Uint8Array(bytes));
}
```

`unpackTrace()` 必須驗證：

- `sampleDtMs === 40`；
- `regularSampleCount`；
- exact byte length；
- force range；
- velocity range；
- finite values；
- event time/value、pre-break index 及 stable merge index；
- maximum trace duration。

```js
const MAX_RECORDING_DURATION_S = 12.0;
const MAX_REGULAR_SAMPLE_COUNT = 301; // t = 0.00 ... 12.00 s
```

畫面在剩餘 `2 s` 顯示中性倒數，到 `12.0 s` 自動停止；若必要區段仍不完整，trial 不接受並可重做。超過上限的 sample 永不進 authority。Canonical packing 在「保留這次實驗」時只做一次，draft、review、graph、scoring 共用同一 bytes；提交時不得按 viewport pixel 或不同 rate 再 decimate。

---

## 14. Trial analysis authority

`measurement.js` 提供 pure functions：

```js
windowStats(samples, startIndex, endIndex)
detectBreakaway(samples, eventIndex)
findStaticRiseCandidates(samples, breakaway, options)
findPlateauCandidates(samples, options)
findAccelerationCandidates(samples, options)
validateAcceptedTrial(trace, event)
```

### 14.1 Window slope

```js
function linearSlope(samples, valueKey) {
  const n = samples.length;
  const meanT =
    samples.reduce((sum, s) => sum + s.timeS, 0) / n;

  const meanY =
    samples.reduce((sum, s) => sum + s[valueKey], 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (const sample of samples) {
    const dt = sample.timeS - meanT;
    numerator += dt * (sample[valueKey] - meanY);
    denominator += dt * dt;
  }

  return denominator > 0 ? numerator / denominator : null;
}
```

### 14.2 近似勻速 window

```js
function isVelocityPlateau(stats) {
  return (
    stats.durationS >= MIN_PLATEAU_DURATION_S &&
    Math.abs(stats.velocitySlopeMps2) <=
      MAX_PLATEAU_ABS_SLOPE_MPS2 &&
    stats.meanVelocityMps >= MIN_MOVING_SPEED_MPS
  );
}
```

初始值：

```js
const MAX_PLATEAU_ABS_SLOPE_MPS2 = 0.04;
const MIN_MOVING_SPEED_MPS = 0.04;
```

### 14.3 Acceleration window

```js
function isAccelerationWindow(stats) {
  return (
    stats.durationS >= MIN_ACCELERATION_DURATION_S &&
    stats.velocityChangeMps >=
      MIN_ACCELERATION_DELTA_V_MPS &&
    stats.velocitySlopeMps2 >=
      MIN_ACCELERATION_SLOPE_MPS2
  );
}
```

初始值：

```js
const MIN_ACCELERATION_DURATION_S = 0.50;
const MIN_ACCELERATION_DELTA_V_MPS = 0.06;
const MIN_ACCELERATION_SLOPE_MPS2 = 0.08;

const MIN_PRE_BREAK_DURATION_S = 0.80;
const MIN_PRE_BREAK_FORCE_RISE_N = 1.00;
const MAX_PRE_BREAK_LOADING_RATE_N_PER_S = 6.0;
const MIN_POST_BREAK_MOVING_DURATION_S = 0.40;
const FORCE_SENSOR_RANGE_N = 12.0;
const MAX_PLATEAU_FORCE_CV = 0.08;
const MAX_OTHER_PHASE_FRACTION = 0.15;
const MIN_STATIC_RISE_DURATION_S = 0.60;
const MIN_STATIC_RISE_FORCE_DELTA_N = 0.80;
const MIN_STATIC_RISE_FORCE_SLOPE_N_PER_S = 0.30;
const MAX_STATIC_ABS_VELOCITY_MPS = 0.012;
```

以上只用於：

- 判斷實驗是否有足夠可分析資料；
- 建立提交後正確 overlay；
- 評分學生所選區段。

Editable graph 不會顯示 authority windows。

### 14.4 Trial acceptance 及等價 windows

`validateAcceptedTrial()` 的所有邊界均 inclusive。最低可分析 trial 必須同時具備：

- breakaway 前至少 `0.80 s` 資料，measured pull 的 `max-min` 至少 `1.00 N`；
- force 讀數全程不超過 `12.0 N`；
- breakaway 後至少 `1.00 s` 持續移動（方向可由學生操作決定）；
- 記錄在 30 秒上限內完成。

接受 trial 只檢查「開始移動＋繼續移動」這個 B 任務門檻，不要求學生採用特定拉力曲線、平台速度或加速段。C 的 hidden-velocity candidate finder 另行枚舉所有滿足自身統計及合理時序的 contiguous windows，不把單一 hidden window 當唯一答案；學生 interval 必須滿足自身統計、other-phase fraction 不高於 `0.15`，並與**任一**同類 authority candidate 達到最佳 IoU：

```js
intersectionDuration / unionDuration >= INTERVAL_MIN_IOU;
```

若提交後 overlay 只顯示一個代表 window，deterministic tie-break 依序是：最大 duration、最低 hidden `abs(velocitySlope)`／force CV、最早 start index。Tie-break 不會排斥另一個同樣有效的 learner window。測試必須包含多個合法 plateau、邊界相等、全圖選取及跨 phase 過多四類 case。

C1 static-rise candidate 另須全部滿足：duration ≥ `0.60 s`、`maxPull-minPull ≥ 0.80 N`、force least-squares slope ≥ `0.30 N/s`、所有 sample time 不晚於 `breakaway.timeMs`，且 `max(abs(measuredVelocity)) ≤ 0.012 m/s`。

Other-phase fraction 用相鄰 sample pair 的 midpoint classifier 計算：每個 pair 的 duration 為 `t[i+1]-t[i]`；若 midpoint 不符合目標類型的上述 predicate（static-rise、plateau 或 acceleration），該 duration 計入 `otherDuration`。正式分母固定為 `learnerWindowEndTime - learnerWindowStartTime`：

```js
otherPhaseFraction = otherDuration / learnerWindowDuration;
```

Event sidecar 造成的非等距 interval 使用其真實 `timeMs`，不可按 sample count 近似 duration。

Pair-level midpoint/local predicates 集中在 pure `classifyPairForTarget(pair, targetType, constants)`；static-rise pair 除低速外必須有 `ΔF/Δt ≥ 0.30 N/s`，因此先保持恆定拉力的 preload 不可冒充上升段；window-level slope、duration、CV predicates 保持另一組 pure helpers，禁止互相偷用造成 classifier 與 candidate finder 漂移。

---

## 15. 題目生成

### 15.1 Deterministic versions

```js
generateScenario({
  seed,
  generatorVersion: 1,
  physicsVersion: 7,
  measurementVersion: 4
});
```

新 attempt 只建立一次 uint32 seed。

不同用途用 derived seed：

```js
const surfaceSeed = deriveSeed(seed, "surface");
const sensorSeed = deriveSeed(seed, "sensor");
const predictionSeed = deriveSeed(seed, "prediction");
```

避免改一個 noise stream 就改變 prediction questions。

### 15.2 候選參數

建議使用有限、經驗證題庫，而不是任意浮點組合：

```js
const MASS_OPTIONS_KG = [1.5, 1.7, 1.9, 2.1];

const FRICTION_PAIRS = [
  { muS: 0.36, muK: 0.28 },
  { muS: 0.38, muK: 0.29 },
  { muS: 0.40, muK: 0.31 },
  { muS: 0.42, muK: 0.32 }
];
```

生成後必須滿足：

```text
1. 4.5 N <= f_s,max <= 9.0 N
2. 3.2 N <= mean f_k <= 7.0 N
3. f_s,max - mean f_k >= 0.8 N
4. force sensor range 足夠
5. breakaway 峰值可在圖上清楚辨認
6. 所有預測情境值可顯示至 0.1 N 而不產生邊界歧義
7. 慢速與高速平台平均值 authority 相同

Part A 額外生成：

```js
const BALANCE_PULL_FRACTIONS = [0.24, 0.28, 0.32, 0.36];
balancePullDirection = pick(["left", "right"]);
balancePullN = quantize(staticLimitMeanN * pick(BALANCE_PULL_FRACTIONS), 0.1);
```

`balancePullN` 必須大於 0 且小於 `staticLimitMeanN`；A3 的可操作臨界值為 `ceil(staticLimitMeanN * 10) * 10` centinewton，直接拖曳的水平端點以 0.1 N 語意步進量化，讓學生可以逐步接近臨界值。

物體質量及摩擦係數提交前不顯示。

### 15.3 四個 prediction 的 deterministic authority

四個 canonical slots 永遠是 `zero`、`static-below-limit`、`sliding-pull-greater`、`sliding-pull-less`，只由 `predictionSeed` 決定具體顯示值及順序。所有顯示 force 先 quantize 至 `0.1 N`，再驗證下列 margin；未通過就 deterministic 選下一個候選，不作無界 retry。

Prediction cards 是同一材料的理想化瞬時分析，使用 `staticLimitMeanN`／`kineticFrictionMeanN`；不疊加 sensor noise 或表面微小 variation，避免把未顯示的位置細節變成評分陷阱。

```js
const PREDICTION_BOUNDARY_MARGIN_N = 0.60;
const PREDICTION_FORCE_STEP_N = 0.10;

D1 = { pullN: 0, velocityMps: 0 };

D2.pullN = chooseDisplayed(
  0.55 * staticLimitMeanN,
  0.75 * staticLimitMeanN,
  value => staticLimitMeanN - value >= PREDICTION_BOUNDARY_MARGIN_N
);

D3 = {
  velocityMps: choose([0.10, 0.12, 0.14]),
  pullN: displayedAtLeast(
    kineticFrictionMeanN + Math.max(1.0, 0.20 * kineticFrictionMeanN)
  )
};

D4 = {
  velocityMps: choose([0.16, 0.18, 0.20]),
  pullN: displayedAtMost(
    kineticFrictionMeanN - Math.max(0.8, 0.18 * kineticFrictionMeanN)
  )
};
```

所有題目 authority：

| Slot | `frictionType` | `direction` | `magnitudeN` | `motionOutcome` |
|---|---|---|---:|---|
| D1 | `none` | `none` | `0` | `remain-still` |
| D2 | `static` | `left` | displayed pull | `remain-still` |
| D3 | `kinetic` | `left` | experiment `kineticFrictionMeanN` | `speed-up` |
| D4 | `kinetic` | `left` | experiment `kineticFrictionMeanN` | `slow-down` |

`magnitudeCN` 只有在該題 `frictionType` 及 `direction` 均正確時才可取得 2 分；D1 要求明確選擇 `none`，不是 untouched default。D2 使用 balance tolerance；D3／D4 使用 `FK` tolerance。每項須有 just-inside／just-outside tests，並驗證顯示 rounding 後仍離 `f_s,max`／`f_k` 邊界至少 `0.60 N`。

---

## 16. Scoring

### 16.1 總分

```text
Total: 100
Passing threshold: 60
Score floor: 0
Score ceiling: 100
```

Mastery gates：

```js
passed =
  totalScore >= 60 &&
  balanceScore >= 10 &&
  analysisScore >= 20 &&
  predictionScore >= 8;
```

Part B 是最終提交前的 completion prerequisite：學生仍可在未完成 A 時直接進入 B、開始記錄及返回其他 Part；只有最終提交時，沒有有效 B trace 才不算完整。它獎勵完成探究操作，但不另設沒有區辨力的 navigation gate；概念 mastery 由 Part A、C、D gates 判定。

### 16.2 Part A：力平衡，20 分

#### A1：沒有水平拉力，4 分

- 類型選 `none`：1；
- 方向選 `none`：1；
- 大小為 `0 N`（`0.10 N` 內）：2。

#### A2：指定小拉力的力平衡，6 分

- 學生直接畫出的拉力方向符合指定方向：1；
- 學生直接畫出的拉力大小符合指定大小：2；
- 摩擦力類型選 `static`（若不畫，保存為 `none`，不取得此分）：1；
- 摩擦力方向與指定拉力相反：1；
- 摩擦力大小等於指定拉力：1。

指定拉力由 scenario 固定保存，不來自測力計讀數。

#### A3：最大靜摩擦力估計，10 分

- 至少一次合法試拉到物體開始滑動，才可保存估計；
- 學生填寫的最大靜摩擦力在 `max(0.30 N, 5%)` 內得 10 分；
- 試拉方向、次數及是否一次命中不另扣分。

### 16.3 Part B：最低可分析實驗操作證據，20 分

| 證據 | 分數 |
|---|---:|
| 逐步增加拉力並形成有效 breakaway | 6 |
| 有效低速近似勻速區段 | 5 |
| 有效加速區段 | 4 |
| 有效較高速近似勻速區段 | 5 |

這部分不按：

- 做得快；
- 一次成功；
- 拉得最平滑；
- noise 最少。

只判斷是否產生足夠的物理證據。

未齊四項時只能中性重做，不能進入 analysis；因此本部分是明示的 completion credit，不應在 feedback 假裝能區分已提交 learners 的不同能力。

### 16.4 Part C：同步圖像分析，40 分

#### 靜止上升區段：7 分

- 區段符合物體未移動、拉力上升：3；
- 選靜摩擦力：2；
- 說明 `fs=F拉`：2。

#### 最大靜摩擦力：9 分

- breakaway marker：4；
- 讀取 peak：3；
- `identifiedAs: "maximum-static-friction"`：2。

#### 低速勻速及滑動摩擦力：8 分

- 區段有效：4；
- 以平均拉力估計 `fk`：4。

#### 加速區段：7 分

- 區段有效：3；
- 判斷 `F拉>fk`：2；
- `pullEqualsFk: "no"`：2。

#### 高速勻速與速度比較：9 分

- 區段有效：4；
- 高速平台 `fk` 估值：3；
- 正確比較慢／快平台平均值：2。

### 16.5 Part D：四個預測，20 分

每題 5 分：

- 摩擦力類型：1；
- 方向：1；
- 大小：2；
- 運動結果：1。

固定 canonical slot，不存在全選得分。

### 16.6 不扣分項目

- 重做實驗；
- 修改 graph marker；
- 返回 review 修改；
- 使用 keyboard；
- 使用 reduced motion；
- 花較長時間；
- 先做哪個靜止記錄；
- 資料有正常細微波動；
- 重開同一未提交 draft。

---

## 17. Tolerance

所有 constants 集中在 `scoring.js`。

```js
const ZERO_FRICTION_TOLERANCE_N = 0.10;

const BALANCE_ABS_TOLERANCE_N = 0.15;
const BALANCE_REL_TOLERANCE = 0.05;
const MAX_STATIC_BALANCE_ABS_TOLERANCE_N = 0.30;
const MAX_STATIC_BALANCE_REL_TOLERANCE = 0.05;

const BREAKAWAY_TIME_TOLERANCE_S = 0.16;

const FS_MAX_ABS_TOLERANCE_N = 0.20;
const FS_MAX_REL_TOLERANCE = 0.04;

const FK_ABS_TOLERANCE_N = 0.15;
const FK_REL_TOLERANCE = 0.05;

const INTERVAL_MIN_IOU = 0.70;
const PLATFORM_COMPARISON_ABS_N = 0.25;
const PLATFORM_COMPARISON_REL = 0.06;

const FLOAT_EPSILON = 1e-9;
```

### 17.1 Balance magnitude

```js
function balanceToleranceN(expectedN) {
  return Math.max(
    BALANCE_ABS_TOLERANCE_N,
    BALANCE_REL_TOLERANCE * expectedN
  );
}
```

這個 tolerance 用於 A2 的指定外力平衡；例如預期 `4.0 N`：

- `4.20 N`：剛好 5%，接受；
- `4.21 N`：同時超過 `0.15 N` absolute 及 5% relative tolerance，不接受；
- 所有邊界 inclusive。

A1 的零摩擦力使用 `ZERO_FRICTION_TOLERANCE_N = 0.10 N`，但類型及方向仍必須明確選擇 `none`。A3 的最大靜摩擦力估計使用獨立、較寬鬆的：

```js
function maximumStaticBalanceToleranceN(expectedN) {
  return Math.max(0.30, 0.05 * expectedN);
}
```

A3 臨界試拉值以直接拖曳的 0.1 N 語意步進量化，故首次滑動值為 `ceil(staticLimitMeanN * 10) * 10` centinewton；這個操作值只作學習及可恢復的試拉證據，評分仍以學生填寫的估計與生成的物理上限比較。

### 17.2 Breakaway marker

若權威 breakaway time：

\[
t_b=2.40\,\mathrm s
\]

接受：

\[
|t_{\text{student}}-2.40|\leq0.16\,\mathrm s
\]

`2.56 s` 接受；`2.561 s` 不接受。

Marker time 以 physics transition 的 `breakaway.timeMs` 為 authority；學生 marker 可落在 merged canonical trace 的 event 或 grid timestamps。`estimatedFsMaxCN` 則與 `visibleBreakawayPeakCN` 比較，不與 hidden physical limit 比較。若 visible peak 為 `6.00 N`，tolerance 是 `max(0.20 N, 4%) = 0.24 N`：`6.24 N` 接受，`6.241 N` 不接受。

### 17.3 Interval scoring

學生區段要同時：

1. 時間長度足夠；
2. 自身統計符合該類型；
3. 和任一同類 experiment authority candidate 有 `IoU >= 0.70`；
4. 不包含大量其他 phase。

避免學生選一小點或全圖都得分。

### 17.4 `fk` 平台估值

使用 10% trimmed mean，降低小量尖峰影響：

```js
function trimmedMean(values, trimFraction = 0.10) {
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * trimFraction);
  const kept = sorted.slice(trim, sorted.length - trim);

  return kept.reduce((sum, value) => sum + value, 0) /
    kept.length;
}
```

若 visible plateau trimmed mean 是 `5.00 N`，tolerance 為 `max(0.15 N, 5%) = 0.25 N`：`5.25 N` 接受，`5.251 N` 不接受。D3／D4 magnitude 使用同一規則；D2 使用 balance tolerance；D1 使用 `ZERO_FRICTION_TOLERANCE_N`。平台比較以 `max(0.25 N, 6% × reference)` 為 inclusive 相等範圍，並為 just-inside／just-outside 留測試。

---

## 18. 提交後 feedback

提交後才顯示：

- 真實 contact mode；
- 真實平均 `fk`；
- 真實 `fs,max`；
- 學生 marker；
- 正確 breakaway marker；
- 學生選擇區段；
- 最佳匹配的 experiment authority candidate window；
- 慢／快平台 trimmed mean；
- 每部分分數；
- 物理解釋。

### 常見診斷

#### 無外力但畫了摩擦力

> 粗糙面可以提供摩擦力，但不代表一定已經有摩擦力。這個狀態水平方向沒有其他力，而且物體加速度為零，所以摩擦力亦應為零。

#### 將靜摩擦力畫成固定最大值

> 最大靜摩擦力是靜摩擦力可以達到的上限。物體仍靜止時，實際靜摩擦力只需調整到足以平衡目前拉力。

#### 將 acceleration force 當 `fk`

> 這段速度正在增加，所以合力不是零。測力計讀數包括用來克服滑動摩擦力和令物體加速的部分，不可以直接當成滑動摩擦力。

#### 慢速及高速平台比較錯誤

> 兩段速度不同，但都近似勻速，因此兩段都可以用平均拉力估計滑動摩擦力。細微上下波動不代表平均滑動摩擦力隨速度增加。

---

## 19. Dependency invalidation

### 19.1 修改 Part A

A1／A2／A3 在正常 `balance` phase 均可重選／重畫／重試後重新保存。A 的 canonical answer 有語意改變時，只更新 A 自己的 authority；B trace、C analysis 及 D predictions 仍可保留，因四個 Part 可以獨立完成及返回修改。review-edit 仍保留原有完整 review authority，只有提交後的正式修改才進入 locked attempt 外的新 attempt。

### 19.2 重新做實驗

必須中性確認：

> 重新保留另一組實驗資料，會清除目前依賴該 trace 的圖像標記；Part D 預測屬獨立情境答案，會保留。

確認後原子式清除：

```js
analysis = createEmptyAnalysis();
trial = null;
phase = "experiment";
```

舊 accepted trial 在學生按確認前保留；確認後先完成上述單一 authority transition，再開始新的 transient recording。若新 recording cancel／中斷，restore 到 `experiment/ready`，不復活舊 trace。

### 19.3 修改 graph analysis

若改變以下任何一項：

- static interval 的 start/end、friction type 或 relation；
- breakaway marker；
- slow plateau；
- acceleration interval；
- fast plateau；
- `fs,max`；
- `fk`；
- acceleration 的 `pullEqualsFk`；
- fast plateau 的 `speedComparison`；

清除 prediction answers，因為 prediction 應建立在學生最新模型上。

若保存後 canonical analysis authority 與原值不同，原子式清空四個 predictions 並轉到 `phase:"predict"`、`variant:"answer-ready"`、`activePredictionIndex:0`；不能返回不完整的 `review/complete`。若 canonical value 完全相同，視為沒有語意變更，保留 predictions 並返回 review。

### 19.4 非破壞性返回

由 review 返回查看，但沒有保存修改：

- 保留全部下游答案；
- `fromReview=true`；
- 返回 review 時不重置。

---

## 20. Responsive layout contract

### 20.1 Classification

`bounded split-panel`

原因：

- 實驗舞台必須在學生拉動測力計期間保持可見；
- graph analysis 舞台亦必須和操作面板同時可見；
- 控制內容較多；
- 手機控制面板需要獨立捲動；
- activity body 不可以成為 Moodle host 和 panel 之間第三個 scroll owner。

### 20.2 Phone

```css
html,
body {
  height: 100%;
  overflow: hidden;
}

.app {
  --header-track: auto;
  --stage-track: minmax(12rem, 34vh);
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows:
    var(--header-track)
    var(--stage-track)
    minmax(0, 1fr);
  overflow: hidden;
}

.stage {
  min-height: 0;
  overflow: hidden;
  touch-action: pan-y;
}

.control-panel {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

Graph phase 可以將 stage track 調至：

```css
--stage-track: minmax(15rem, 50dvh);
```

本活動的 Part A 舞台是橫向受力圖，主要視覺內容按手機寬度縮放；若沿用
baseline 的較高舞台，上下會出現 letterbox 空位，並把 control panel 壓到
只剩一小段。因此一般手機採用 `minmax(12rem, 34dvh)`（不支援 `dvh` 時
退回 `34vh`），把餘下高度交給 panel；這仍然保留完整物體、地面、力箭嘴及
小型重心提示點。

但 `320×500` 和 `390×500` 下仍要確保 panel 有可用高度。

具體 compact policy：

- effective CSS viewport `376–560px` 高或 200% zoom 時，header 收成單行 `2.5rem`、stage track 使用 `minmax(10rem, 34dvh)`，移除非必要 subtitle；只縮小 apparatus／graph geometry，不縮小文字或 44 px targets；
- effective height `<376px` 時進入 ultra-compact：`--header-track:2rem`、`--stage-track:clamp(5rem,32dvh,7rem)`；Part A、B 都只保留物體、水平面、中央力箭嘴及 active target，B 的 0–30 s F–T 圖保留主要軸線，C 只顯示同一張 F–T 圖。Panel 使用全部餘高，不再宣稱固定 `10rem` minimum，但必須至少完整顯示兩個 44 px controls，其他 controls 可在同一 panel 內捲到；
- B／C 不設「拉力／速度」切換 panes；B 的即時 F–T 圖與 C 的分析 F–T 圖共用同一時間軸及資料格式，C 的 handles 只操作目前選區；
- 非 ultra-compact 時 control panel 可用高度不得低於 `10rem`；所有模式的 primary action 永遠在 panel 正常 flow 的末端可捲到；
- `html > body > .app > .activity-main > .stage/.control-panel` 整條 shrinking chain 均設 `min-height: 0`，只有 `.control-panel` 有 `overflow-y: auto`；
- stage 內容在 extreme height 內 reflow／scale，不建立第三個 stage scroller。

自動驗收量測 header/stage/panel rectangles、`panel.scrollHeight/clientHeight`、最後 focus target rectangle，以及 `html/body/app.scrollHeight === clientHeight`（容許 1 px rounding）。

### 20.3 Desktop／tablet

- controls 左側約 `20–24rem`；
- stage 右側；
- desktop header 使用 `clamp(4.5rem, 8vh, 5.5rem)`，只保留一行主標題及階段列，不以固定高 header 留白；
- graph 仍上下排列；
- 不新增 desktop-only 必要操作；
- DOM reading order：controls 先，stage 後；
- 不使用橫向捲動。

### 20.4 美術風格

沿用 shared styles：

- app background：淺灰；
- panel：近白；
- stage：白色；
- accent：`#2563eb`；
- object：淡紅／酒紅邊框，參考既有自由體圖模擬；
- 測力計拉力 curve：橙色／`--force-tension`；
- velocity curve：藍色；
- friction red 只在提交後 authority overlay 使用；
- 文字、dash pattern 和圖示並用，不只靠顏色；
- 1 px border；
- 8 px radius；
- 系統 UI 字體；
- 數值 readout 使用 monospace；
- 地面有清楚的厚度、頂部黑色地面線及斜線 hatch 陰影，參考既有自由體圖模擬；
- 不使用木紋、實驗室裝飾背景、深藍品牌 banner、卡通人物或大面積漸變。

---

## 21. Touch gesture ownership

### 21.1 Draggable target inventory

| Target | Hit-target strategy | Capture target | Render 期間可替換？ |
|---|---|---|---:|
| Part B 物體中央 `experimentOrigin` | 穩定 48×48 px HTML overlay；只在 experiment recording 顯示，位置跟隨物體重心；可見提示只保留很小閃爍圓點 | 同一 overlay | No |
| Part A2／A3 物體中央繪圖 target | 穩定 48×48 px 透明 HTML overlay，位置跟隨物體中央；只顯示約 8 px 小閃爍圓點；A2 依目前模式畫拉力／摩擦力，A3 直接自由畫拉力，拉力端點跟隨 active pointer；物體離開舞台後 target 隱藏並顯示中央回復按鈕 | 同一 overlay | No |
| Prediction friction magnitude handle | 穩定 44×44 px HTML overlay | 同一 overlay | No |
| Breakaway time marker | 穩定 44 px 寬 HTML overlay | 同一 overlay | No |
| 每個 interval start handle | 穩定 44×44 px HTML overlay | 同一 overlay | No |
| 每個 interval end handle | 穩定 44×44 px HTML overlay | 同一 overlay | No |

Canvas／SVG 只負責畫 visual；pointer capture target 不可以因 render 被重建。

### 21.2 Gesture matrix

| Touch starts on | Owner | Required result |
|---|---|---|
| 非互動 stage 空白位置 | Moodle／enclosing host | host scroll 及 iframe rectangle delta 非零；activity document、activity visual viewport 及 panel delta=0；learner state 不變 |
| Control panel（含 top/bottom boundary） | panel | panel 有 range 時 delta 非零；host、host/activity visual viewport、iframe rectangle、stage及activity document delta=0；learner state不變 |
| Part B 物體中央 `experimentOrigin` | simulation | trusted touch／mouse／keyboard 直接拖動物體中央，按 pointer 位移調整 `0–12 N` 向右拉力；放手後 tension 回零，物體按 spring／connector 及牛頓第二定律先減速再停，仍可再次施力；host、兩個 visual viewport、iframe rectangle、activity document、panel及stage delta=0；pointermove、pointerup；無 pointercancel |
| Part A2／A3 物體中央繪圖 target | simulation | A2 拉力／摩擦力向量端點或 A3 即時拉力端點改變；A3 物體按合力連續位移／加速／減速／反向，pointerup 令拉力歸零但保留物體運動；物體離開舞台後顯示中央回復按鈕；host、兩個 visual viewport、iframe rectangle、activity document、panel delta=0；pointermove、pointerup；無 pointercancel |
| Prediction friction magnitude handle | simulation | 對應 magnitude 改變；上述全部位置 delta=0；pointermove、pointerup；無 pointercancel |
| Breakaway time marker | simulation | marker index 改變；上述全部位置 delta=0；pointermove、pointerup；無 pointercancel |
| Interval start handle（逐一測五類） | simulation | 對應 start index 改變；上述全部位置 delta=0；pointermove、pointerup；無 pointercancel |
| Interval end handle（逐一測五類） | simulation | 對應 end index 改變；上述全部位置 delta=0；pointermove、pointerup；無 pointercancel |

Rules：

```css
.stage {
  touch-action: pan-y;
}

.drag-hit-target {
  touch-action: none;
}
```

- 不將 `touch-action:none` 放在整個 stage；
- 不將 stage swipe 轉送 sibling panel；
- 使用 `setPointerCapture(pointerId)`；
- `pointercancel` 回復 gesture 前的 semantic checkpoint；
- multi-touch／non-primary pointer 不可建立答案；
- source page 和 built SCORM 都要用 browser-level trusted touch 驗證。

Scroll topology：

- direct source page 無 enclosing scroll range 時，只有 blank-stage 的 non-zero host delta 可標 N/A，其餘 zero-delta/state assertions 仍測；
- automated source 及 extracted-package 驗收一律放入同源、可捲動 Moodle-like host iframe，host 預先離邊界，雙方向 swipe；
- 首選 browser native pan chain。`touch-action: pan-y` **不視為跨 iframe 已獲證明**；實作前先以 target browsers 做 spike；
- 若 native iframe chain 無法令 enclosing host 移動，只可用同源 parent access 或帶 origin allow-list 的 `postMessage` bridge，把該次 blank-stage delta 轉送給同一 host owner。Bridge 不監聽 panel／drag targets，也不稱為 native scrolling；
- 若實際 Moodle origin/topology 既不能 native chain、又沒有安全 host bridge，該 launch mode 不可標 Moodle-ready，必須調整 Moodle player/topology，不能把 gesture 改派 sibling panel；
- current-window 及 new-window 各自記錄採用 native 或 bridge、browser/device、trusted event、before/after metrics。

---

## 22. Accessibility

- 所有 drag 有 keyboard alternative；
- B 物體中央直接拉力 target：
  - ArrowRight：增加向右拉力；
  - ArrowLeft：減少向右拉力至零，不會建立向左拉力；
  - Shift＋Arrow：較大步幅；
- graph marker：
  - ArrowLeft／Right：一個 sample；
  - Shift＋Arrow：五個 samples；
- A2 物體中央繪圖 target：
  - 先用「畫拉力」／「畫摩擦力」按鈕選擇向量，再由 target 的 ArrowLeft／Right 改變端點；
  - `Shift` 使用較大步幅；
  - 「不畫摩擦力」清除可選的摩擦力向量；
- A3 物體中央繪圖 target：
  - ArrowLeft／Right 逐步增加／減少目前拉力並保留方向；
  - Shift 使用較大步幅；
  - 達到臨界值後只顯示拉力及中性滑動／加速狀態；
- 所有 hit target 至少 44×44 px；
- focus-visible 清楚；
- graph line 有文字 label；
- 同步 cursor 有可聚焦文字讀數，逐 sample 宣告 `timeS`、`measuredPullN`；
- 提供 keyboard-only／screen-reader data view（virtualized table 或分頁 table），欄位為時間、拉力；可跳到前／後 local extremum 及已選 interval 邊界，但不可標示 authority breakaway 或正確 window；
- 每個 interval 的可存取統計區完整讀出 start/end、duration、平均拉力、拉力變化量及拉力標準差，並由 headings／`aria-describedby` 關聯至目前 task；
- `aria-describedby` 解釋操作；
- 動態 accessible name，例如：
  - 「物體中央拉力 target，目前 4.2 牛頓」
  - 「最大靜摩擦力時間標記，目前 2.44 秒」
  - 「低速區段開始，目前 3.20 秒」
- live region 最多每秒更新 3–4 次，不逐 frame announce；
- 只 announce：
  - 記錄開始；
  - 物體開始移動；
  - 區段已記錄；
  - 實驗已停止；
- editable accessibility tree 不可以包含正確答案；
- `prefers-reduced-motion`：
  - 保留必要物理運動；
  - 移除非必要 easing、閃光、彈跳；
  - 可降低 render frame rate，但 physics 固定時間步不變；
- forced-colors 可辨；
- 200% zoom 仍可完成；
- phase change、review-edit 返回及 validation error 有 deterministic focus destination；keyboard-only 及 screen-reader flow 必須能完成全部 100 分可評項目；
- 公式使用 `<var>`、`<sub>`、直立單位，不載入 MathJax／KaTeX。

---

## 23. Phase/state matrix

| Phase | Variant | Current step | Required semantic state | Must be absent／pristine | Allowed navigation |
|---|---|---:|---|---|---|
| `balance` | `zero-ready`／`static-ready`／`breakaway-ready`／`answer-complete` | A1–A3 | A 部分可以是任何已保存／未完成組合；B 的 trace、C 的分析及 D 的預測可同時保留 | 只有 transient drag 不入 snapshot | A／B／C／D；保存 A 答案後仍留在 A |
| `balance` | `review-edit` | A1/A2/A3 target | review authority 保留；`fromReview=true`；`working.editDraft.kind="balance"` | active drag／DOM state | cancel／same-value save 回 review；changed save 回 balance |
| `experiment` | `ready` | B | `trial=null`；A 可完整、部分完成或仍為空；D 預測可已存在；B 舞台顯示空白 0–30 s F–T 軸 | analysis 只可在有 trial 後保存；running state 不入 snapshot | A／B／C／D；開始 30 秒記錄 |
| `experiment` | `running`（transient） | B | `experimentOrigin` direct-drag force state；初次 breakaway 使用 spring/connector，滑動中再次改力可進入 direct Newton force-control；物體由舞台最左開始、中央紅色拉力箭嘴、即時 F–T 線及速度提示 | running state、pointer path、force-control mode、超時 transient 不可進 snapshot | 停止並保存，或一按「重新開始」立即清除並重開；切換時先中止 transient |
| `experiment` | `accepted` | B | canonical packed 0–30 s regular trace＋breakaway sidecar；C 可空或已有舊分析 | 不把 transient recorder 寫入 snapshot | A／B／C／D；C 需有效 trace |
| `experiment` | `review-edit` | B | 從檢查頁按「重新做實驗」即清除舊 trial／C analysis，轉為新的 running B；`fromReview=false` | 舊 running trial／active pointer／確認或保留 prompt | 新的 30 秒記錄、A／B／C／D |
| `analysis` | `waiting-for-trial` | C | 沒有 accepted trial；畫面只顯示中性等待提示 | C 的 analysis authority 必須全為 `null` | A／B／C／D；不可保存 C field |
| `analysis` | `selection-ready`／`selection-only`／`task-complete`／`complete` | C1–C5 | accepted trial；單一 0–30 s F–T 圖；`working.activeAnalysisTask` 指向目前選取的 C 子任務；其餘 C 子任務可為空、partial 或 complete | 不保存無 trial 的 C authority；不再保存第二張 learner-facing velocity graph | A／B／C／D；可用 C 子任務選擇器返回修改 |
| `analysis` | `review-edit` | C1–C5 target | review authority 保留；可保存 target replacement | active pointer／DOM state | cancel／save 回 review 或 analysis |
| `predict` | `answer-ready`／`answer-draft`／`answer-complete`／`complete` | D1–D4 | 四題可以按任意順序保存；`working.activePredictionIndex` 只代表舞台目前顯示題目 | 不要求 C complete；partial prediction 仍不算提交完整 | A／B／C／D；可選擇任一 D 子題返回修改 |
| `predict` | `review-edit` | D1–D4 target | 原本 prediction authority 保留；`working.editDraft` 可存在 | active pointer／DOM state | cancel／save replacement |
| `review` | `complete` | — | 所有 A、B、C、D authority 完整；`fromReview=false`；無 edit draft | transient drag／running trial | submit／enter exact review-edit row |
| locked result | `submitted` | — | validated review snapshot＋recomputed trusted result | editable controls／draft provider | review only |

Transitions：

```text
A／B／C／D -> A／B／C／D
  由任務列直接切換；setPhase 不再要求順序，也不清除其他 Part 的 authority。

B -> C
B 只在 30 秒內完成並保存有效 direct-drag trace 後，C 才可實際保存分析；沒有 trace 仍可進入等待畫面。

C -> D
  不要求 C complete；D 可先保存任意一題，之後返回 C。

C 子任務／D 子題 -> 另一個子任務／子題
  working cursor 記住目前舞台；選擇器讓學生返回修改已保存項目。

A／C／D 保存
  只更新該 Part 的 authority；不因返回修改而清除其他 Part。

review -> submit
  只有 A、B、C、D 全部完整時 canonical completeness validation 才會通過。

review -> section
  仍可用原有 review-edit 進入精確修改 row；提交後整個 attempt 鎖定。
```

Active recording 本身不是 saveable phase。頁面中斷時恢復到記錄前最後 semantic checkpoint。每個 saveable row 都要有 production-shaped encode/decode/restore fixture，並在 restore 後執行表中一個合法 next action；generic `editable phase` fixture 不算覆蓋。

---

## 24. Persistence contract

### 24.1 Authority shape

以下是 logical authority/type shape，不是一個把所有 nullable variants 同時混合的合法 fixture；每個實際 snapshot 必須對應 phase/state matrix 的一行。`persistence.js` 可把這些語意欄位映射成版本化短 wire keys／fixed-order arrays 以符合 byte budget，但 decoder 只接受該 version 的 exact shape，round-trip 後必須還原同一 logical authority、score 及 next action。

```js
{
  schemaVersion: 5,
  generatorVersion: 1,
  physicsVersion: 7,
  measurementVersion: 4,
  rubricVersion: 2,

  seed: 1234567890,

  phase:
    "balance" |
    "experiment" |
    "analysis" |
    "predict" |
    "review",

  variant: "<one exact matrix variant>",
  fromReview: false,

  balance: {
    zeroForce: null | {
      frictionType: "none" | "static" | "kinetic",
      direction: "none" | "left" | "right",
      frictionMagnitudeCN: integer,
      committed: true
    },
    staticCase: null | {
      appliedDirection: "left" | "right",
      appliedMagnitudeCN: integer,
      learnerAppliedForce: {
        direction: "left" | "right",
        magnitudeCN: integer,
        committed: true
      },
      learnerForce: {
        frictionType: "static" | "kinetic" | "none",
        direction: "none" | "left" | "right",
        frictionMagnitudeCN: integer,
        committed: true
      }
    },
    breakaway: {
      attempts: integer,
      bestPullCN: null | integer,
      bestDirection: null | "left" | "right",
      learnerMaxCN: null | integer,
      committed: false | true
    }
  },

  trial: null | {
    sampleDtMs: 100,
    regularSampleCount: 301,
    forceVelocityBase64: "...",
    breakaway: {
      timeMs: 1726,
      measuredPullCN: 643,
      measuredVelocityMMps: 3,
      preBreakPeakGridIndex: 42
    }
  },

  analysis: {
    staticInterval: null | {
      startIndex,
      endIndex,
      frictionType: null | "static" | "kinetic" | "none",
      relation: null | "equal" | "less" | "greater"
    },

    breakaway: null | {
      markerIndex,
      estimatedFsMaxCN: null | integer,
      identifiedAs:
        null |
        "maximum-static-friction" |
        "kinetic-friction" |
        "applied-force"
    },

    slowPlateau: null | {
      startIndex,
      endIndex,
      estimatedFkCN: null | integer
    },

    acceleration: null | {
      startIndex,
      endIndex,
      relation:
        null |
        "pull-greater" |
        "equal" |
        "pull-less",
      pullEqualsFk: null | "yes" | "no"
    },

    fastPlateau: null | {
      startIndex,
      endIndex,
      estimatedFkCN: null | integer,
      speedComparison:
        null |
        "same-average" |
        "higher-at-fast-speed" |
        "lower-at-fast-speed"
    }
  },

  predictions: [
    null | {
      scenarioId,
      frictionType: null | "none" | "static" | "kinetic",
      direction: null | "none" | "left" | "right",
      magnitudeCN: null | integer,
      motionOutcome:
        null |
        "remain-still" |
        "speed-up" |
        "slow-down" |
        "start-sliding",
      committed: false | true
    },
    null,
    null,
    null
  ],

  working: {
    activeBalanceStep: null,
    activeAnalysisTask: 0,
    activePredictionIndex: 0,
    reviewEditTarget: null | {
      section: "balance" | "experiment" | "analysis" | "predict",
      semanticKey
    },
    editDraft: null | {
      kind: "balance" | "analysis-task" | "prediction",
      value
    }
  }
}
```

力以 centinewton、速度以 mm/s 儲存，減少 JSON 長度並避免浮點 serialization drift。

`learnerAppliedForce`／`learnerForce` 的 incomplete draft 只可存在於未提交的 DOM／local interaction state；saveable snapshot 只保存 committed vectors（沒有摩擦力時保存 committed `none` force）。nullable analysis inference fields、partial prediction 與 `working.editDraft` 只可出現在 matrix 明列的 partial/review-edit variants。Review normalization 固定 `phase:"review"`、`variant:"complete"`、`fromReview:false`，要求所有 answer fields committed/non-null，並移除整個 `working`。

Part A／B 使用 `s5` wire version。`balance` 的短鍵為 `b.z`（A1）、`b.s`（A2 的指定方向／大小、學生 applied vector 及學生 friction vector）及 `b.r`（A3 attempts、best pull、方向、估計值、committed）；`b.s` 使用 fixed-order `[specifiedDirectionCode, specifiedMagnitudeCN, learnerAppliedForce, learnerForce]`；applied force 使用 `[directionCode, magnitudeCN, committed]`，摩擦力使用 `[typeCode, directionCode, magnitudeCN, committed]`。B 的 trial 使用 `100 ms`、`0–30 s` 的 301-point canonical grid；packed velocity 只作 hidden physics／scoring data，不能當作 learner-facing graph。所有大小以 centinewton 保存，不保存任何 raw pointer path 或 drag timing。A3 的 `bestPullCN` 必須來自至少一個合法試拉，並以 0.1 N 語意步進對齊；`learnerMaxCN` 只可在 A3 trial 後提交。C3／C5 `selection-only` 明確要求 `estimatedFkCN:null`，C5 另要求 `speedComparison:null`；task-complete 才要求非 null。

舊 `s1`／`s2`／`s3` editable draft 只以其 seed 安全重開為 `zero-ready`，不把舊測力計／tare／observation 或舊 A2 force shape 冒充成新 Part A 答案；舊 finished review 因 Part A semantic contract 不相容而 fail closed，顯示 technical load error，不重算成新答案。

### 24.2 Review snapshot

Review 保存：

- versions；
- seed；
- A1 zero-force answer、A2 specified-pull／learner-applied-force／learner-friction-force answer 及 A3 trial summary；
- packed trace；
- breakaway event；
- 所有 graph selections 及推斷；
- 四個 predictions。

移除：

- active drag；
- raw pointer；
- recording state；
- unsaved working handles；
- live sensor filter state；
- requestAnimationFrame state；
- CSS classes；
- DOM nodes。

Review authority 必須足以：

```text
validate
→ unpack trace
→ regenerate scenario
→ rebuild graphs
→ rescore
→ redraw submitted answers
```

Saved score／pass 只屬 comparison metadata。

### 24.3 Derived fields

不保存：

- mass；
- `μs`、`μk`；
- true friction；
- surface waveform parameters；
- prediction question authority；
- graph SVG path；
- interval statistics；
- score；
- pass；
- button enabled state；
- panel scroll；
- physics running state。

Scenario 由 seed 及 versions 重建；stats 由 trace 重算。

### 24.4 Decoder validation

必須拒絕：

- 非 finite／非法整數；
- unknown version；
- invalid seed；
- invalid phase；
- A1／A2／A3 欄位 shape、提交次序或 `committed` invariant 錯；
- A2 指定外力不是由合法 scenario value 產生，或 A3 沒有試拉就提交估計；
- trial byte length 和 `regularSampleCount` 不一致；
- trace 超出量程；
- breakaway time/value、pre-break grid index 或 merged canonical index 非法；
- analysis 在 trial 之前存在；
- interval end 早於 start；
- interval 超出 trace；
- prediction 欄位 shape／scenario identity 非法；D 預測可以在 C 未完成時保存，只有進入 review 才要求四項 C 分析及四項 D 預測完整；
- duplicate scenarioId；
- dangling relationship；
- review 不完整；
- saveable phase 沒有合法下一步；
- running trial 被序列化；
- stale future data 違反 invalidation policy。

### 24.5 Snapshot size

```js
expect(
  SimScorm.snapshotBytes(maxDraftSnapshot)
).toBeLessThanOrEqual(4000);

expect(
  SimScorm.snapshotBytes(maxReviewSnapshot)
).toBeLessThanOrEqual(2800);

expect(
  utf8Bytes(capturedMaxPendingCheckpoint)
).toBeLessThanOrEqual(4000);
```

`maxDraftSnapshot` 使用每個 saveable row 中最大者；`maxReviewSnapshot` 使用 301 grid samples、breakaway sidecar、全部 answers 及最大合法整數。`capturedMaxPendingCheckpoint` 必須經 production `submitWithCallbacks()`／fake LMS 實際產生，包含 escaped `reviewJson`，不能用手算近似。

若最大 fixture 超標，在 implementation freeze 前提升 `measurementVersion` 並重新設計**唯一 canonical pack**；不得只在 review 降頻、不得按 viewport pixel decimate、不得改動已保存的 sample-index semantics。絕不刪除 authority answers或保存 screenshot。

### 24.6 Invalid snapshot policy

- **Finished invalid review**：保持 locked，只顯示可信 Moodle summary；
- **Pending-final nested review invalid**：
  - `SimScorm.quarantinePending()`；
  - technical lock；
  - 不揭示答案或分數；
- **Editable draft invalid**：fail closed technical load error；
- **Active trial 中斷**：恢復至記錄前最後合法 checkpoint，顯示：
  > 上次實驗記錄未完成，請重新開始這次記錄。

---

## 25. SCORM lifecycle

活動使用 repo 共用 lifecycle，不直接呼叫 LMS API。

```js
const ACTIVITY =
  "static-kinetic-friction-investigation-lab";

const attempt = SimScorm.loadAttempt(ACTIVITY);
const startupState =
  SimActivityFlow.startup(attempt);
```

### 25.1 Startup

```js
switch (startupState) {
  case "review":
    restoreValidateRescoreAndShowFinished(attempt);
    break;

  case "editable":
    restoreOrCreateDraft(attempt);
    break;

  case "frozen":
    validateFrozenNestedReviewThenRetry(attempt);
    break;

  default:
    showTechnicalLoadError(attempt);
}
```

Finished flow 固定為：

```text
read review envelope
→ decode/validate authoritative answer and exact matrix row
→ canonical normalize
→ regenerate scenario by saved versions
→ activity scorer
→ SimActivityFlow.reviewResult(computed, saved metadata, Moodle attempt)
→ completionLabel(true|false|null)
→ locked review or safe Moodle summary
```

Frozen flow 在任何 `retryPending()` 前固定為：

```text
decode pending checkpoint and nested reviewJson
→ validate/normalize/rescore nested answer
→ compare canonical authoritative answer, score, maxScore and passed
→ valid: keep same immutable payload and route retry outcome
→ invalid/mismatch: SimScorm.quarantinePending() then technical lock
```

只比較 aggregate score/pass 不足。Quarantine 測試還要確認其後 `retryPending()` 回 `no-pending`，且 durable diagnostic checkpoint 沒被不可信資料覆寫。Unknown Moodle status 用 `completionLabel(null)`，不可顯示 failed。

### 25.2 Draft checkpoints

只在 semantic change 後更新：

- A1 zero-force answer 保存；
- A2 直接拖出的 applied／friction vectors 保存；
- A3 直接拖曳越過臨界值後的每次試拉及最大靜摩擦力估計保存；
- accepted trial；
- graph handle pointerup；
- graph keyboard adjustment；
- inference 保存；
- prediction 保存；
- phase change；
- review-edit navigation。

不在每個 physics step 或 pointermove commit。

```js
SimScorm.setDraftProvider(() =>
  SimScorm.makeSnapshot(
    ACTIVITY,
    "draft",
    encodeDraft(authority)
  )
);
```

### 25.3 Submission

```js
function submitFinalAnswer() {
  const scenario = regenerateScenario(authority);
  const result = scoreAnswer(authority, scenario);

  const reviewAnswer =
    normalizeReviewAuthority(authority);

  const reviewSnapshot = SimScorm.makeSnapshot(
    ACTIVITY,
    "review",
    reviewAnswer,
    result
  );

  const handle = (outcome) =>
    SimActivityFlow.submission(outcome, {
      success: showSubmittedReview,

      committed:
        showCommittedAndRetryFinish,

      frozen:
        showFrozenPendingWithoutReveal,

      retry: (failure) =>
        showSubmissionError({
          retryable: failure.retryable
        })
    });

  return SimScorm.submitWithCallbacks(
    result,
    reviewSnapshot,
    {
      onSuccess: handle,
      onFailure: handle
    }
  );
}
```

#### Outcome wording

| Outcome | Learner-facing behavior |
|---|---|
| `success` | 已提交，locked result |
| `committed` | 成績已寫入但完成程序未結束；locked；可重試 finish |
| `frozen` | 最終提交狀態未確認；不顯示分數、合格或正確答案 |
| retryable `retry` | 保留 editable answer，可再嘗試提交 |
| non-retryable `retry` | technical error；不承諾可以重試 |

---

## 26. Key implementation separation

### `generator.js`

負責：

- seed；
- scenario parameters；
- surface profile；
- prediction questions；
- versioning；
- constraints。

不可接觸：

- DOM；
- SCORM；
- scoring；
- requestAnimationFrame。

### `physics.js`

Pure／Node-testable：

- handle controller；
- tension；
- contact state；
- static／sliding transition；
- restick；
- fixed-step update；
- timestamped input queue consumption；
- physical transition events；
- physical invariants。

不可接觸 sensor filter、noise、graph recorder 或 DOM。

### `measurement.js`

負責：

- sensor response；
- deterministic calibrated-zero measurement configuration；
- seeded measurement noise；
- measurement state／PRNG/sample index；
- graph sampling；
- breakaway event；
- trial quality；
- trace pack／unpack；
- window statistics。

### `graph.js`

負責：

- physics/data → SVG coordinate；
- SVG path；
- time marker；
- interval handles；
- client↔graph conversion；
- accessible labels；
- graph selection geometry。

### `scoring.js`

Pure：

- score balance；
- score experiment evidence；
- score analysis；
- score predictions；
- feedback diagnostics；
- mastery gates。

### `persistence.js`

Pure：

- encode draft；
- encode review；
- decode；
- validate matrix；
- restore；
- normalize review；
- size checks。

### `main.js`

只負責 orchestration：

- startup；
- event handlers；
- render；
- phase transitions；
- invalidation；
- SCORM callbacks；
- focus management。

避免一個單一 `main.js` 同時包含 physics、UI、persistence 及 scoring。

---

## 27. Test plan

### 27.1 Generator tests

至少大量 seeds 驗證：

```text
f_s,max 在範圍內
f_k 在範圍內
f_s,max > f_k
drop 足夠清楚
sensor range 足夠
prediction values 合法
derived seeds 互不干擾
same seed reproduces same scenario
```

### 27.2 Physics tests

必須包括：

1. 物理模型無拉力（對應 Part A1 概念，但不是 sensor observation）：`f=0, v=0`；
2. 拉力低於最大靜摩擦：`fs=F拉, a=0`；
3. 超過上限：`static -> sliding`；
4. breakaway 後拉力自然下降；
5. 固定低速拉動穩定後：`mean(F拉)≈mean(fk)`；
6. 增加握把速度：`F拉>fk`、`v` 增加；
7. 重新高速勻速後拉力回到相同平均平台；
8. 拉力減少後物體減速；
9. 停止後重新 static；
10. 直接施力低於最大靜摩擦時保持靜止，超過上限後開始滑動；
11. 直接施力放手後按滑動摩擦自然減速，反向施力可令物體減速後倒轉；
12. 直接施力在合力接近零時可維持近似勻速；
13. runtime `surfaceVariation()` 在 active grid 平均接近零且所有位置受限；
14. 相同位置重現相同表面 variation；
15. slack connector 在任何 relative velocity 下 tension 都為 0；
16. tautening／slack release 邊界連續且無單步 impulse；
17. `0.06 m/s` slow-handle approach 的首個 taut substep 不會單靠 dashpot 觸發 breakaway，damping由0單調engage；
18. 相同 timestamped input path 在 60／90／120 Hz、coalescing 及短 stall schedules 產生同一 canonical trace；
19. 超過 50 ms stall 令 running trial 中性作廢而不 catch-up；
20. physics 結果不受 sensor noise 影響；
21. 無 NaN／Infinity；
22. energy／速度不會數值爆炸。

### 27.3 Measurement tests

- 同 seed、同 input trace 完全相同；
- 不同 seed 只改細節，不改主要趨勢；
- graph force 和 velocity timestamps 完全一致；
- breakaway event sample 必定保存；
- raw physics event 不含 measured/index 欄位；measurement sidecar enrichment 只發生一次；
- 大量 seeds 的 force noise 絕對值 ≤ `0.045 N`、velocity noise ≤ `0.0075 m/s`；
- 每個 attempt 的 calibrated baseline 接近零；
- measurement state 不含 tare／bias 欄位，draft／review restore 不會重建這些欄位；
- sensor filter 有預期 response；
- slow／fast 平均平台近似；
- 快速經過相同 surface 時，波動在 time axis 變密；
- pack→unpack 保留 regular timestamps、breakaway event time/value、visible peak、merged indices、window stats及marker score；
- 12.0 s 自動停止且 `regularSampleCount <= 301`；
- corrupt base64 fail closed；
- max draft ≤ 4000 bytes、max review ≤ 2800 bytes、production pending checkpoint ≤ 4000 bytes。

### 27.4 Graph analysis tests

- coordinate mapping；
- interval order；
- minimum duration；
- inclusive boundary；
- slope calculation；
- trimmed mean；
- 對任一 candidate 的 best IoU；
- 多個同樣有效 plateau／acceleration windows；
- marker tolerance；
- graph resize 不改變 semantic sample index；
- SVG path 不成為 authority；
- event sidecar peak 在 pack／unpack 後不消失或改變時間。

### 27.5 Scoring tests

- 每項滿分／部分／零分；
- A1 初始兩個 select 及大小 readout 均為「請選擇」，不可由預選值直接保存；
- tolerance just-inside／just-outside；
- A3 沒有合法開始滑動試拉，即使估計值填對都不能保存／得 A3 分；
- A2 未保存的 learner applied／friction vector 不可由 default 得分；`none` 必須以 committed 摩擦力答案保存；prediction `committed=false` 不可由 default 得分；
- C2 `identifiedAs` 及 C4 `pullEqualsFk` 各有唯一 authority source；
- `f_s,max` 估值只對 visible measured peak，不對 hidden static limit；
- D1–D4 type/direction/magnitude/outcome dependency及各自 tolerance；
- acceleration force 不可以取得 kinetic plateau 分；
- selecting entire graph 不會取得全部 interval 分；
- duplicate prediction 不增加分；
- score floor 0；
- score ceiling 100；
- mastery gates；
- restore 前後 score 完全相同。

### 27.6 Persistence tests

每一個 phase／variant：

```text
encode
→ decode
→ restore
→ score equality
→ execute one legal next action
```

包括：

- balance 的 `zero-ready`、`static-ready`、`static-answer-pending`、`breakaway-ready`、`breakaway-answer-pending`、`answer-complete` 及三個 balance review-edit target；
- experiment ready；
- accepted trial；
- analysis 每個 task 的 selection-ready／selection-only／task-complete；
- predictions 每個 index 的 answer-ready／answer-draft／answer-complete；
- review；
- balance／experiment／每個 analysis task／每個 prediction 的 exact review-edit row及 cancel/save；
- analysis review-edit 的 cancel、same-value save、changed-value save→predict/answer-ready，以及 restore 後 continuation；
- C3／C5 selection-only nullable inference restore 後可保存並成為 task-complete；
- invalid future data；
- page lifecycle during running saves pre-record checkpoint；fabricated serialized running variant is rejected；
- finished invalid review；
- pending-final quarantine；
- unknown versions；
- corrupt packed trace。

### 27.7 Delayed-feedback tests

Editable DOM／accessibility tree 不可包含：

- true `μs`；
- true `μk`；
- true `fk`；
- true `fs,max`；
- authority intervals；
- correct marker；
- result score；
- pass/fail；
- hidden correct graph path。

結果 view 可以包含，但只在合法 submitted review。

### 27.8 Browser regression

測試：

```text
320×500
390×500
390×600
normal phone portrait
phone landscape
tablet
desktop
browser toolbar change
software keyboard
200% zoom
effective height below 376 CSS px ultra-compact
```

另測：

- blank stage swipe；
- panel swipe 及 panel 邊界；
- force handle drag；
- friction handle drag；
- breakaway marker drag；
- 每種 interval handle；
- pointerup；
- no pointercancel；
- source page；
- built/extracted SCORM；
- scrollable Moodle-like iframe；
- running simulation 使用 fake clock／pause，以免正常時間演化被當作 gesture side effect。

### 27.9 Lifecycle、accessibility 及 wiring suites

`lifecycle.test.js` 必須以 production outcome/render functions 覆蓋：

- startup `review`、`editable`、`frozen`、`load-error`；
- submission `success`、`committed`、`frozen`、retryable `retry`、non-retryable `retry`；
- 完整 review envelope preflight、pending checkpoint、final writes；
- canonical answer match/mismatch、score/status mismatch、unknown Moodle status；
- invalid nested pending → quarantine → `retryPending()` 回 `no-pending`。

`accessibility.test.js` 覆蓋完整 keyboard-only 作答、逐 sample accessible data view、同步文字讀數、interval statistics relationships、phase/review-edit focus，以及 editable tree 無 authority answer。`production-wiring.test.js` 驗證 HTML runtime dependency、manifest、唯一 `sim/config.js` metadata、planned/active gate及 test runner registration。

所有 `sim/static-kinetic-friction-investigation-lab/*.test.js` **以及** `tools/static-kinetic-friction-browser-regression.js` 必須逐一加入 `tools/run-tests.js`；runner 的 browser entry 實際驅動 production regression，而不是只作 source-string proxy。Browser regression 亦保留明確的獨立 package-ready npm command，並對 source 及 extracted ZIP 各跑一次；遺漏 registration 或任何 `### Error` 均令 gate failure。

---

## 28. Implementation sequence and freeze gates

1. **Generator／physics core**：凍結 seed streams、單向 connector、contact model、timestamped input queue；unit tests 全綠才前進。
2. **Calibration／model freeze**：完成 plan 要求的 PASCO 兩組各 5–10 次量測，保存 peak/platform、CV、autocorrelation及acceleration evidence；據此凍結 physics／measurement constants並更新相應 versions。
3. **Measurement／canonical trace**：完成 calibrated-zero measurement、bounded noise、25 Hz grid＋event sidecar、12 s limit及 pack round-trip；禁止 UI 先另造 trace shape。
4. **Analysis／scoring freeze**：完成 candidate-set、IoU、visible-peak authority、D1–D4 generator、100-point rubric及所有 boundary tests；任何 rubric 改動提升 `rubricVersion`。
5. **Persistence／SCORM size**：逐 matrix row round-trip＋legal continuation，通過 max draft/review/pending byte tests及 frozen trust/quarantine tests。
6. **Learner UI／accessibility**：實作 bounded split-panel、direct manipulation、keyboard/screen-reader data view、delayed feedback及review-edit invalidation。
7. **Lifecycle integration**：只用 shared startup/submission API，實際通過完整 review envelope preflight及全部 outcomes。
8. **Registration／package**：更新 `sim/config.js`（先保持 `planned`）、manifest、`tools/run-tests.js`、browser npm gate；核對所有 local dependencies。
9. **Artifact verification**：source及built/extracted package browser smoke、完整 trusted-touch matrix、responsive/zoom checks、all quality commands。
10. **Promotion／Moodle**：其餘 package-ready checks 全通過後改 `status` 為 `active`，重跑 check/test/package及built artifact驗收，再進行 Moodle student checks。

任何改變 physics、measurement、generator、rubric 或 schema contract 的修訂，必須先更新本 plan、對應 version、fixtures及calibration impact，再修改 implementation。

---

## 29. Manifest

```xml
<resource
  identifier="RES-STATIC-KINETIC-FRICTION-INVESTIGATION-LAB"
  type="webcontent"
  adlcp:scormtype="sco"
  href="static-kinetic-friction-investigation-lab/index.html">

  <file href="config.js"/>

  <file href="static-kinetic-friction-investigation-lab/index.html"/>
  <file href="static-kinetic-friction-investigation-lab/styles.css"/>
  <file href="static-kinetic-friction-investigation-lab/generator.js"/>
  <file href="static-kinetic-friction-investigation-lab/physics.js"/>
  <file href="static-kinetic-friction-investigation-lab/measurement.js"/>
  <file href="static-kinetic-friction-investigation-lab/graph.js"/>
  <file href="static-kinetic-friction-investigation-lab/scoring.js"/>
  <file href="static-kinetic-friction-investigation-lab/persistence.js"/>
  <file href="static-kinetic-friction-investigation-lab/main.js"/>

  <file href="shared/styles.css"/>
  <file href="shared/scorm.js"/>
  <file href="shared/activity-flow.js"/>
</resource>
```

---

## 30. Package-ready checklist

- [ ] Plan 所有章節定稿；
- [ ] 實作及其餘 readiness checks 進行期間 `status: "planned"`；
- [ ] PASCO calibration evidence 已記錄，constants及versions已凍結；
- [ ] syntax checks；
- [ ] generator tests；
- [ ] physics tests；
- [ ] measurement tests；
- [ ] graph analysis tests；
- [ ] scoring tests；
- [ ] persistence matrix tests；
- [ ] lifecycle tests；
- [ ] delayed-feedback tests；
- [ ] accessibility tests；
- [ ] 所有新 `.test.js` 及 browser regression 已加入 `tools/run-tests.js`，browser regression 另有獨立 npm quality-gate command；
- [ ] browser regression；
- [ ] real-touch matrix source page；
- [ ] real-touch matrix built SCORM；
- [ ] `npm.cmd run check`；
- [ ] `npm.cmd test`；
- [ ] `npm.cmd run package:all`；
- [ ] `git diff --check origin/main...HEAD`；
- [ ] ZIP root 有 `imsmanifest.xml`；
- [ ] ZIP 沒有 tests、screenshots 或 temporary files；
- [ ] 所有 local dependencies 存在 manifest；
- [ ] built ZIP browser smoke；
- [ ] max draft ≤ 4000 bytes、max review ≤ 2800 bytes、production pending checkpoint ≤ 4000 bytes；
- [ ] editable DOM 沒有 authority answers；
- [ ] assessment risk 清楚寫明。
- [ ] 其餘項目全通過後將 catalogue `status` 改為 `active`，再完整重跑 check、test、package、built smoke及trusted-touch matrix；

---

## 31. Moodle-ready checklist

- [ ] Package-ready checklist 已完整通過；
- [ ] Attempts allowed：`3`；attempts grading：`Highest grade`；
- [ ] 完成／passed／failed 後強制 new attempt 才可改分；lock after final attempt：`No`，容許只讀 review；
- [ ] Preview mode：disabled；student skip content structure page：`Never`；
- [ ] Attempt status 在 entry page 及 dashboard 可見；
- [ ] 用學生帳戶測試；
- [ ] 新 attempt；
- [ ] draft resume；
- [ ] 中途關閉 active trial 後安全回復；
- [ ] pending-final retry；
- [ ] completed attempt 只讀；
- [ ] new attempt 才能改成績；
- [ ] score/status 正確；
- [ ] current-window player；
- [ ] new-window player；
- [ ] 真實手機完整 gesture matrix；
- [ ] panel 底部可到達；
- [ ] 沒有 nested scroll trap；
- [ ] Moodle evidence 另行記錄。

---

## 32. 核心設計總結

整個活動的認知鏈必須是：

```text
沒有水平外力時判斷摩擦力為零
→ 在指定小外力下畫出等大反向靜摩擦力
→ 逐步試拉找到開始移動前的臨界值
→ 再於 Part B 直接拖動物體，用 connector 張力量到拉力及運動
→ 在勻速滑動區推斷滑動摩擦力
→ 在加速區發現拉力不等於摩擦力
→ 比較兩個速度的勻速平台
→ 將模型應用到未測試情境
```

`F拉–t` 圖的：

- 上升；
- 峰值；
- breakaway 後下降；
- 低速平台；
- 加速時再升高；
- 高速勻速後返回相近平台；
- 小幅波動；

全部必須由同一套物理引擎、實際學生輸入及量測模型自然產生，不可由程式按教科書形狀硬畫。

目前三個關鍵產品決定：

1. **Part A 顯示學生自己受力圖的 `ΣFx`，但不提供正誤；**
2. **Part B 使用舞台物體中央 direct-drag＋寬鬆 pacing guide；初次拉動採 spring／connector 產生 breakaway drop，滑動中再次改力採 direct Newton force-control，仍呈現可調拉力、連續運動及放手後減速；**
3. **重新做實驗會清除全部 graph analysis 及舊 trace，但保留獨立的 Part D 預測；沒有已保存 trace 時同樣可以重新開始。**

---

## 參考科學資料

- PASCO：Static and Kinetic Friction 實驗，以力感測器和運動量測比較 breakaway peak 及滑動區域。
- OpenStax University Physics：靜摩擦力會因應外力調整至最大值；`fk=μkN` 是 introductory/high-school 常用簡化模型。
