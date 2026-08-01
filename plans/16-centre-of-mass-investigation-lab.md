# 重心探究實驗室（實作計劃）

## 1. Scope

- Slug: `centre-of-mass-investigation-lab`
- Learner-facing title: `重心探究實驗室`
- Learning objectives:
  1. 透過逐次承托，找出一維非均勻物體的重心；
  2. 透過不同懸掛點的鉛垂線，實驗找出二維非均勻平板的重心；
  3. 利用均勻立體的對稱性，判斷其重心位於幾何中心；
  4. 分辨「實驗證據」與「直接猜測」，並以有效操作支持答案。
- Learner task: 可隨時在一維承托、二維懸掛畫線及三維觀察選點之間切換；三部分完成後檢查並提交一次完整結果。
- Main interactions:
  - 拖動一維物體下方的窄承托點並放手測試；
  - 在平板上平移、用旋轉手柄轉動、將指定小孔套上牆釘、等待阻尼擺停止；
  - 沿鉛垂線在平板本地座標中畫線，並在交會位置標註重心；
  - 旋轉半透明均勻立體，由多個三維候選點選出幾何中心；
  - touch／pen 精細操作期間使用固定角落的即時真實場景 preview window。
- Runtime files planned:
  - `sim/centre-of-mass-investigation-lab/index.html`
  - `sim/centre-of-mass-investigation-lab/styles.css`
  - `sim/centre-of-mass-investigation-lab/generator.js`
  - `sim/centre-of-mass-investigation-lab/model.js`
  - `sim/centre-of-mass-investigation-lab/scoring.js`
  - `sim/centre-of-mass-investigation-lab/persistence.js`
  - `sim/centre-of-mass-investigation-lab/ui-policy.js`
  - `sim/centre-of-mass-investigation-lab/main.js`
  - `sim/centre-of-mass-investigation-lab/part3-renderer.js`
  - `sim/centre-of-mass-investigation-lab/vendor/three-0.185.1/three.module.min.js`
  - `sim/centre-of-mass-investigation-lab/vendor/three-0.185.1/three.core.min.js`（0.185.1 module build 的官方靜態依賴）
  - `sim/centre-of-mass-investigation-lab/vendor/three-0.185.1/LICENSE`
  - 對應的 `*.test.js` 測試檔；
  - `sim/shared/styles.css`、`sim/shared/scorm.js`、`sim/shared/activity-flow.js`。
- Libraries: 本地 vendored `Three.js 0.185.1`（官方 ESM minified build，MIT License）只用於第三部分；第一、二部分使用原生 SVG。第三部分同時保留原生 Canvas 2D 作 renderer construction failure、WebGL 不可用及 context loss 的一級相容模式。無 CDN、import map、MathJax 或 KaTeX。
- Assessment risk: `low-risk graded`。分數可用作低風險課堂評估及回饋，不可單獨用於高風險考試或重要資格判定。
- Trusted validation for high risk: 不適用。瀏覽器內的題目、操作證據與 scorer 可被技術熟練的學習者修改；不可把本活動當作高風險考核的可信邊界。若日後用於高風險考核，必須由 Moodle／LTI／後端以 seed、版本、操作證據及答案重新評分。
- Risk tier: T3 — 新模擬，涉及物理模型、計分、持久化、觸控 gesture ownership、無障礙、manifest 及 SCORM 包裝。
- Out of scope for v1:
  - 任意上載物件圖片或自訂質量分佈；
  - 真正剛體碰撞、板與釘的摩擦接觸求解器；
  - 雙指縮放；
  - 以雙指旋轉作唯一操作途徑；
  - 任意多面體、凹多面體或體積積分；
  - 自由輸入三維坐標；
  - 高風險防作弊或伺服器端驗證。

## 2. Catalogue metadata (`sim/config.js`)

實作完成並通過 package-ready checks 前以 `planned` 登記；只有可部署版本才改為 `active`。

```js
{
  title: "重心探究實驗室",
  folder: "centre-of-mass-investigation-lab",
  categories: ["Mechanics"],
  description: "透過承托、懸掛畫鉛垂線和旋轉立體，從實驗證據找出一維、二維及三維物體的重心。",
  tags: ["physics", "mechanics", "centre-of-mass", "balance", "suspension", "scorm"],
  status: "planned"
}
```

- [ ] `folder` 與活動資料夾、manifest slug 完全一致且不重複。
- [ ] learner-facing 文案使用繁體中文。
- [ ] 新測試加入 `tools/run-tests.js`。
- [ ] 所有 runtime files 加入 `sim/manifests/centre-of-mass-investigation-lab.xml`。

## 3. 教學流程及畫面結構

### 3.1 整體流程及視覺基準

```text
載入／恢復
  ↔ 第一部分：一維承托
  ↔ 第二部分：二維懸掛與畫線
  ↔ 第三部分：三維旋轉與選點
  → 檢查完整證據及答案
  → 提交
  → 鎖定的結果檢視
```

- 第一個畫面直接進入第一部分，不設裝飾性 landing page。頂部使用一直可見的「一維杆／二維平板／三維立體」tab；已完成與目前部分有文字及圖示雙重狀態。
- 三個 tab 可按任意次序來回切換，不以完成前一部分作門檻。切換前取消未完成 gesture／動畫並回復上一個 semantic checkpoint，再保存新的 active tab。
- 「檢查」只在三部分均完成後啟用；不設每部分確認／下一步按鈕。
- `檢查` 畫面顯示每部分已取得的實驗證據，不顯示隱藏重心或正確候選點。
- 檢查時可選擇「重新做此部分」。為保持狀態清楚，重新做會先確認，然後清除該部分的答案及操作證據；其他部分不受影響。
- 最終提交後整個 attempt 鎖定，只可查看已提交的操作、答案、正確解釋及分項得分。

視覺必須跟隨 `plans/00-shared-platform-and-style.md` 及現有 `position-time`／`free-fall` 活動：白／淺灰畫布、`#2563eb` 藍色重點、系統字體、1 px 分隔線及平面控制面板。禁止深藍品牌橫幅、英文實驗室標誌、米色筆記紙、木紋工作桌、黃銅裝飾、粗黑捆邊及卡通物件。物件以少量漸變和透明度建立簡潔立體感，不以粗線模擬立體。

### 3.2 各部分完成條件

| 部分 | 最低有效操作證據 | 可確認的答案 |
|---|---|---|
| 一維 | 至少一次真正放手的承托測試，並曾進入可接受的中性平衡範圍 | 系統以同一 production `markPart1` transition 保存並揭示生成題目的精確重心；紅點固定，不設學生微調 |
| 二維 | 兩個不同小孔各有一次已停止的懸掛，並各畫一條有效鉛垂線；兩線方向有足夠夾角 | 在平板本地座標標註重心 |
| 三維 | 完成兩個有足夠角度差的觀察姿態 | 選擇 A–E 其中一個三維候選點；選擇可先作 tentative 保存 |

直接寫入答案但欠缺相應語意證據的 state 必須被 persistence decoder 及 scorer 拒絕或計為零，不得只靠 UI 隱藏按鈕。

## 4. 數學及物理量顯示合約

### 4.1 技術決定

第一版不載入 MathJax／KaTeX。只有真正需要向學生顯示的物理量、單位及讀數使用接近 LaTeX 的排版；第一部分不向中學生顯示重心位置、力矩或轉動方程公式，只用「承托點在重心正下方時，杆會保持平衡」的文字提示。

- 物理變數使用語意化 `<var>`，以 Georgia／Times 類數學字體及 italic 顯示；
- 數字下標使用 `<sub class="numeric-subscript">`，一般文字下標保持直立；
- 指數使用 `<sup>`，例如 `m/s²` 的 `2`；
- 單位使用直立字體，不可 italic；
- 數值與單位使用不換行 `.quantity` wrapper；
- 分式使用語意 HTML／CSS stacked fraction，不以斜線模擬複雜推導；
- SVG 內使用對應的 `.svg-math-symbol`、`.svg-numeric-subscript`、`.svg-unit` 及 `<tspan>`；
- 每個完整公式容器使用 `role="math"` 及可讀中文 `aria-label`；
- 原始 TeX 指令，例如 `\frac`、`\mathrm` 或 `$...$`，不可直接顯示予學習者；
- 窄屏公式可在語意項目之間換行，不能縮到難以閱讀或造成整頁水平捲動。

示例 DOM：

```html
<span class="formula" role="math" aria-label="重心位置 x 下標 cm 等於各質量乘位置的總和除以總質量">
  <var>x<sub>cm</sub></var>
  <span aria-hidden="true">=</span>
  <span class="fraction" aria-hidden="true">
    <span class="numerator">Σ <var>m<sub>i</sub></var><var>x<sub>i</sub></var></span>
    <span class="denominator">Σ <var>m<sub>i</sub></var></span>
  </span>
</span>
```

### 4.2 必須使用數學排版的內容

- 學習流程實際顯示的角度、誤差或單位；內部模型的 `x_cm`、`x_s`、`M`、`m_i`、`θ` 等不因存在於程式而要求顯示；
- 所有公式卡、即時角度／距離讀數、坐標或長度標籤；
- review 中的容差、誤差及實驗線交會解釋；
- 單位 `m`、`cm`、`kg`、`rad`、`°`、`N·m`；
- ARIA 純文字則使用可朗讀中文，不強迫讀屏器解讀視覺公式 DOM。

普通英文縮寫、按鈕字母 A–E、程式內部 key 及日常中文數字不套用物理量 italic。

## 5. 可重建的隨機題目

### 5.1 共同規則

- 只在建立全新 attempt 時呼叫 RNG 一次產生 `seed`。
- `generatorVersion + seed` 必須可完全重建三部分的幾何、質量分佈、孔位、候選點及正確答案。
- restore、render、resize、動畫重播、preview render、submission retry 都不得再次呼叫 RNG。
- 已發布的 `generatorVersion` 不可原地改寫；生成規則改變時增加版本並保留舊 decoder／generator，或明確拒絕未曾發布的版本。
- 生成器輸出必須使用有限、已量化數值，避免不同瀏覽器浮點差異改變可見題目或答案。
- scorer 從版本及 seed 重建 ground truth，不信任 snapshot 內由 learner 可改寫的 `trueCentre`、`correctCandidate` 或預計分數。

### 5.2 第一部分生成限制

- 杆的歸一化長度 `L = 1`。所有題目使用同一支簡潔、中性、外觀左右對稱的細長杆；隱藏質量分布不可透過粗幼、配件、顏色或陰影洩漏。
- 隱藏質量模型使用 3–5 個正質量區段／集中質量，所有 `m_i > 0`。
- 重心：

  \[
  x_{\mathrm{cm}}=\frac{\sum_i m_i x_i}{\sum_i m_i}
  \]

- `x_cm` 必須位於 `[0.18L, 0.82L]`，避免答案貼邊及承托動畫不可讀。
- 非均勻題目的 `x_cm` 與幾何中點至少相差 `0.08L`；外觀不可直接標示隱藏 ballast 的數值。
- 題庫需要左右偏重兩類平衡分布，防止固定選同一側。

### 5.3 第二部分生成限制

- 平板使用一組已驗證的不規則簡單多邊形模板，再以 seed 選擇 2–4 個隱藏正質量 ballast；不在 runtime 隨機生成未驗證的自交多邊形。
- 所有平板長度使用同一 plate-local unit；定義 characteristic size `S = √A`，其中 `A` 是平板多邊形的 plate-local 面積。下文所有百分比距離及 scorer tolerance 均以此 `S` 為唯一尺度，不使用 bounding-box width／height／diagonal。
- 平板總重心由面密度基底與 ballast 加權求得；必須位於多邊形內部安全區，與邊界距離至少為 `0.08S`。
- 生成 3–5 個可見小孔，全部位於平板內並有足夠邊界厚度。
- 每個孔與真重心距離不少於 `0.18S`，否則懸掛方向不穩定。
- 至少存在一對孔，使兩次懸掛後記錄在平板本地座標的鉛垂線夾角介乎 `45°–135°`。
- 任何兩孔的可觸控 hit targets 在初始姿態不可完全重疊。
- 幾何形心與質量重心至少相差 `0.06S`，確保「非均勻」有實際意義，但視覺外觀不可直接透露 ballast。

### 5.4 第三部分生成限制

- v1 題庫只使用均勻球體、正方體及長方體；每題只出現一個立體。
- 真重心固定為物體本地座標原點 `(0, 0, 0)`。
- 生成五個固定於物體座標的候選點，其中一個為原點，其餘四個距原點至少為包圍半徑的 `22%`，且互相不重疊。
- 每個候選點必須嚴格位於立體內：球體中心距離不超過 `0.82r`；正方體／長方體每個本地坐標至相應面至少保留該半軸 `12%` 的 margin。任何 observation 姿態都不可把候選點生成到實體外或表面上。
- 正確點的 A–E 標籤由 seed 均勻分配；不可讓幾何中心永遠叫 C。
- 初始相機姿態不得令兩個候選點在投影後重疊；若接近重疊，generator 換用另一個已驗證姿態。

## 6. 第一部分：一維非均勻物體

### 6.1 模型

狀態變數：

- 杆角度 `θ`、角速度 `ω`；
- 承托點 `x_s`；
- 真重心 `x_cm`；
- 杆繞承托點的轉動慣量 `I_s`；
- 操作 episode、結果 `left-fall | right-fall | balanced`。

承托點與重心距離：

\[
d=x_{\mathrm{cm}}-x_s
\]

放手後的示意剛體模型：

\[
I_s\ddot{\theta}=Mgd\cos\theta-c\dot\theta
\]

- 物理模型只用來決定方向和可理解的跌落動畫；scorer 不從 animation frame 推斷答案。
- 若 `|d| <= τ_balance`，直接進入水平的中性平衡狀態，不加入隨機擾動令正確答案失敗。教學文案只稱「平衡／中性平衡」；點支承下沒有回復力矩，不可稱為穩定平衡。
- 初始建議 `τ_balance = 0.018L`，顯示與 scoring 共用易改常數；實機測試後可在 `0.015L–0.025L` 內調整。
- 若超出容差，杆按 torque 符號向相應一側傾倒；角度到達視覺界限後停止，顯示中性提示「承托點不在重心正下方，再試一次」。
- 不顯示距離重心幾多或方向箭頭，以免把二分搜尋答案直接送出；跌落方向本身就是物理觀察。

### 6.2 互動

- 承托架使用簡潔的實色幾何造型；其 apex 在所有靜止及動畫 frame 均與杆底面準確接觸，並作為杆旋轉 pivot。整個可見承托架都是穩定的拖動 hit target（最少 `44 × 44 CSS px`），不只細小尖端可拖動，亦不攔截架外空白 swipe。
- mouse：按住承托點水平拖動；放開立即進行承托測試。
- touch／pen：相同單指拖動，pointerdown 前 hit target 已有 `touch-action:none`，並 capture 同一 pointer。
- keyboard 等價操作保留在可聚焦的 stage target，但 learner-facing 面板及提示採 pointer／touch-first 文案，不顯示鍵盤操作 disclosure 或鍵名說明。
- 預設筆記面板不放操作按鈕列；核心操作直接在 stage target 完成，且不會自動尋找重心。
- 放手進入平衡容差後，production `markPart1` 路徑立即把生成題目的精確 `x_cm`（不是承托位置 `x_s`）寫入既有 `markX` 相容欄位，並在杆上揭示固定的小紅點及可見標籤「重心」，不要求另一次點擊。
- 第一部分不建立可拖動／可聚焦的重心標註 target，亦不提供方向鍵、`−／＋` 或其他微調途徑。平衡容差只判斷實驗證據；揭示位置永遠是生成題目的精確 `x_cm`。
- tap-only 未改變位置仍可算一次有效放手測試，但不可重複按同一位置累積多份過程分。

### 6.3 第一部分 preview window

- touch／pen 拖動承托點時必須立即顯示真實 SVG 局部預覽；mouse／keyboard 不顯示。第一部分沒有可拖動的重心標註點。
- preview 固定在 pointerdown 時離手指最遠的 stage 角落，整個 gesture 不換角，避免跳動。
- crop 中心跟隨實際承托尖端，顯示當前杆、承托點及原有刻度背景；平衡完成前不得加入真重心、方向提示、額外十字線或數值答案。
- 原圖被拖 target 加強 highlight；preview `pointer-events:none`、`aria-hidden:true`，不改 layout、scroll height 或 learner state。
- pointerup、pointercancel、lostpointercapture、blur、reset、phase change、restore 及 render rollback 立即清除。

### 6.4 第一部分答案與 tolerance

- `markX` 保留為已發布 v1／v2 snapshot、pending payload 及 scorer 的相容欄位。新 production 只可在 balanced episode 完成時寫入生成題目的精確 `x_cm`；它不再是學生可編輯答案。
- 新 production 的 `e₁ = |markX - x_cm|/L = 0`，因此 balanced evidence 後取得本 component 的 15 分。為保持舊 review score／pass exact comparison，相容 scorer 仍按舊規則處理已保存的非精確 `markX`：`e₁ <= 0.02` 取 15 分；`0.02 < e₁ <= 0.05` 取 `15 - 10(e₁-0.02)/0.03` 分；`e₁ > 0.05` 為零。舊值只用於驗證及重算，不作顯示坐標或可編輯 channel。
- 顯示採用百分比或示意刻度；內部保留完整有限精度。

## 7. 第二部分：二維非均勻平板

### 7.1 坐標系及權威資料

- `world coordinates`：牆、釘、重力方向與 pointer 的畫面坐標；向下為正 `y`。
- `plate-local coordinates`：多邊形、孔、已畫線、學生重心標註及隱藏重心的固定坐標。
- 平板的 world transform 只由平移 `p=(p_x,p_y)` 及角度 `θ` 導出。
- 學生畫落平板的線必須轉換並儲存為 plate-local endpoints；之後平板移動或轉動，舊線跟平板一起移動及轉動。
- 不可把線保存在牆面／viewport 坐標，否則不同懸掛姿態的交點沒有物理意義。

### 7.2 懸掛物理模型

當孔 `h` 套在釘的位置 `p_nail` 後，該孔成為固定 pivot。設 pivot 至重心距離為 `d`，相對穩定方向角為 `φ`：

\[
I_p\ddot{\phi}=-Mgd\sin\phi-c\dot\phi
\]

其中：

- `I_p = I_cm + Md²`；
- 使用 fixed timestep、semi-implicit Euler 更新；
- frame gap 要 clamp，background tab 恢復時不可一次跳過整段動畫；
- damping 選為明顯但不拖延的 underdamped 效果，目標在約 `1.5–3.0 s` 內視覺停止；
- 每個 hole instance 使用固定 damping ratio `ζ = 0.55`，並按 `c = 2ζ√(I_p Mgd)` 計算 dimensionally consistent damping；不得跨不同 `I_p`／`M`／`d` 使用同一裸常數 `c`。
- 若初始姿態落在倒立不穩定平衡的 `3°` 範圍內，runtime 以固定方向將 transient angle 移到離倒立點 `3°` 的位置，模擬實際釘孔／手部不可避免的微小擾動；不改解析 settled target、權威答案或 scoring。一般生成姿態維持約 `1.5–3.0 s`，此倒立 escape 例外須在 `4.3 s` 內停止，永不無限鎖定。
- fixed timestep `Δt = 1/120 s`，每個 rendered frame 最多 catch up `0.05 s`；更大 background gap 暫停而非一次積分。
- 同時滿足 `|φ| < φ_stop = 0.75°` 及 `|ω| < ω_stop = 1.5°/s` 持續 `0.25 s` 才視為 settled；
- settled 時把姿態吸附到解析平衡方向，消除積分殘差；
- reduced-motion 模式縮短為一次小幅擺動後停止，但保留「因重力轉到重心正下方」的因果順序。

動畫中的 transform、`φ`、`ω` 不屬權威 learner answer，不逐 frame 保存。只有「某孔已成功懸掛並停止」才形成 semantic checkpoint。

### 7.3 平移、旋轉及套釘操作決定

為同時支援 mouse、單指手機和鍵盤，v1 把平移與旋轉分成不同、穩定的 hit target；不使用難以發現的手勢作唯一途徑。

#### 平移

- mouse／touch／pen 拖動平板內非孔、非旋轉手柄的可見區域，整塊平板跟隨相對 grab offset 平移，不跳到 pointer 中心。
- 平移時保持目前角度不變。
- 鍵盤聚焦平板後，方向鍵平移，Shift＋方向鍵較大步距。

#### 旋轉

- 平板外側顯示一個簡潔弧形旋轉手柄，視覺約 `24–32 px`，hit target 至少 `44 × 44 CSS px`。每次 render 在兩個相反候選位置中選擇較安全的一側，並 clamp 到 stage 內至少 22 px inset；平板靠近頂／側邊時手柄須自動翻側而不消失。
- mouse／單指／pen 拖動旋轉手柄時，以 pointer 相對平板中心的 `atan2` 角度差更新 `θ`；平板中心在此 gesture 內保持不動。
- pointerdown 記錄角度 offset，避免一按下就跳角。
- 旋轉手柄保留可聚焦等價操作；learner-facing 面板不顯示 keyboard disclosure，亦不在主 control panel 建立操作按鈕牆。
- mouse wheel、trackpad gesture 及裝置方向感應器不作必要輸入，避免平台差異及誤觸。
- 雙指 twist 可在後續 usability 測試證明穩定後加入為額外捷徑；即使加入，單指手柄及 stage 上的鍵盤替代仍必須完整可用。
- 平板一旦成功掛上釘並開始自由擺動，所有人工平移／旋轉 target 暫時鎖定；停止後如尚未畫線，直接拖動平板或另一個孔即可取下重掛。

#### 套釘

- 孔是平板上的明確圓形 target；drag 開始前已存在穩定 hit geometry。
- 當任一孔中心進入釘的 snap radius，顯示中性對準 highlight；不顯示隱藏重心或最優孔。
- 放手時只有該孔仍在 snap radius 內才成功掛上；系統把孔中心精確對齊釘後開始擺動。
- 牆上只顯示細小釘點及淡色 snap halo，不畫鈎；平板使用約 `0.52` alpha 的單色半透明填色和 `1.5–2 px` 邊，釘及孔在重疊時仍清楚可見。
- 同一時間只可有一個 active hole；第二指不能改變 active target。
- 拖動任何孔或整塊平板時，系統實時計算距牆釘最近而且尚未畫線的 eligible hole；進入既定 `42 CSS px` 吸附半徑時，以高對比虛線／尺寸變化同時提示牆釘及該孔。整板放手時自動使用該最近孔精確對準並開始懸掛，不需要預先點選孔。
- 若未對準便放手，平板留在最後安全姿態，不形成 hang evidence。
- 已 settled 但尚未畫線時，學生可直接拖動平板或另一個孔取下重掛。canonical `detachActiveHole` transition 會先移除該未畫線 active hang record，再開始新 drag；不得留下 orphan hang evidence。擺動途中仍鎖定取下操作。

#### Keyboard-only 完整流程

- focus order 固定為「平板平移 → 旋轉手柄 → 小孔 1–5 → 畫鉛垂線區 → 重心標註」，未解鎖的 stage target 不進 tab order；control panel 不另設 operational button wall。
- 聚焦某小孔後按 Enter／Space，使用與 pointer drop 相同的 relationship model 將該孔對齊牆釘並開始相同阻尼擺，而不是建立較低要求的 keyboard evidence。
- settled 後聚焦板上的畫線區並按 Enter／Space，建立一條通過 active hole、方向等於當前 world vertical、並裁切至板內可見長度的 plate-local 線；這是實體鉛垂線 tracing 的無障礙等價操作，不自動標出交點或重心。
- 重心標註解鎖後，stage 上先出現中性標註 target，初值為學生線組的 bounding box 中心（不是 least-squares intersection 或真重心）；Enter／Space 確認，方向鍵逐步移動 `0.01S`，Shift＋方向鍵移動 `0.05S`。控制面板不提供放置或四向微調按鈕。
- pointer 與 keyboard 路徑產生同一 production-shaped hole／hang／line／mark schema，並通過完全相同的 validity、persistence 及 scoring rules；input mode 只可作診斷，不改分。

### 7.4 鉛垂線及畫線工具

- 平板 settled 後，釘下顯示鉛錘及鉛垂線；鉛垂線屬 world vertical，穿過 pivot。
- 學生選擇畫線工具，從懸掛孔附近開始，沿板面拖到另一側；系統即時顯示學生線。
- pointer world endpoints 在完成時逆變換為 plate-local endpoints 保存。
- pointer 必須從目前懸掛孔／pivot 開始並向下真正拖線。live ghost 的起點固定在 pivot，終點只向畫面下方延伸；raw drag 與向下垂直方向相差 `≤ 10°` 時，吸附到穿過該孔的精確 world vertical，再把精確線反變換為 plate-local endpoints。向上拖或超出吸附範圍不產生有效證據。
- 有效線必須：
  - 對應目前已 settled 的孔；
  - 在 plate-local 坐標穿過該孔的距離不超過 `0.025S`；
  - 畫線當刻在 world 坐標與鉛垂方向的偏差不超過 `5°`；
  - 在平板內的可見長度不少於 `0.45S`；
  - 每次懸掛最多記錄一條計分線。
- 無效線保留作暫時草圖直到學生重畫，但不產生 evidence，並以具體中性回饋說明「未穿過懸掛孔」、「未沿鉛垂方向」或「線段太短」。
- 學生可使用 2–4 個不同孔，各畫最多一條有效線；第 3、4 條線提升交會估計的可靠性，但不因數量本身重複加過程分。

### 7.5 線交會及標註

- 兩條有效線的 acute angle 必須至少 `25°` 才解鎖標註；generator 確保有合理孔組合可達成。
- 兩條線時使用解析線交點；三至四條線時使用本地坐標的 least-squares line intersection 作學生證據中心。
- UI 可顯示學生線自然形成的交會，但不自動畫十字或顯示數值交點。
- 學生自行在平板上放置重心標註；標註保存為 plate-local point。
- 設 `e₂ = distance(mark,trueCOM)/S`；`e₂ <= 0.03` 屬滿分 band，`0.03 < e₂ <= 0.07` 屬 partial band，`e₂ > 0.07` 為零，實際點數依 §12.2 唯一公式。
- boundary examples：穿孔距離 `0.0249S` 有效、`0.0251S` 無效；板內線長 `0.4501S` 有效、`0.4499S` 無效；mark error `0.0299S` 取滿結果分、`0.0301S` 進入部分分、`0.0701S` 結果分為零。
- scorer 另計算學生標註與其線組 least-squares 交點的距離，用作「有否根據自己實驗線作答」的診斷及少量分數，不用來取代真重心準確度。

### 7.6 第二部分 preview window

所有 touch／pen 精細直接操作均有真實 preview；mouse／keyboard 不顯示：

| Target | Preview focus | 必須包含 | 不可加入 |
|---|---|---|---|
| 平板平移／孔套釘 | active hole；沒有 active hole 時為 grab point | 真實板邊、孔、牆釘及現有線 | 隱藏重心、snap 路徑、答案方向 |
| 旋轉手柄 | 手柄及鄰近板邊 | 真實手柄、板邊、孔／線（若 crop 內存在） | 角度答案、自動對準提示 |
| 畫線筆尖 | 當前筆尖 | 平板紋理、懸掛孔、鉛垂線及學生線 | 自動正確線、額外十字線 |
| 重心標註 | 標註點 | 平板及學生已畫線 | 真重心或 scorer tolerance circle |

- preview host 位於完整 stage overlay，不可放在會裁切的平板 SVG 子容器。
- 固定於 pointerdown 最遠角落，尺寸約 `min(52vw, 11.5rem)`，不改 stage layout。
- SVG preview 直接 sanitized clone 當前可見 scene layer，並用跟隨實際 target 的 viewBox 裁切；移除 ID、drag hit、tabindex、role 及重複 ARIA。
- preview 不應重複包含自己，並須保持 `pointer-events:none`、`aria-hidden:true`。
- preview 只屬 transient UI，不保存、不計分、不逐 move 宣告給讀屏器。

## 8. 第三部分：均勻對稱立體

### 8.1 3D 顯示模型

- 使用本地 Three.js 0.185.1 WebGL renderer 繪製具 studio lights、半透明材質、輪廓及空間 grid 的立體；原生 Canvas 2D 投影是可完成相同 orbit／候選選擇／計分流程的 first-class fallback。
- `part3-renderer.js` 只接收由 canonical `{yaw10,pitch10}` 及 candidate state 導出的 scene input；camera、mesh、matrix、renderer、context 及 frame state永不保存。
- renderer construction failure 立即切換 Canvas；`webglcontextlost` 必須 `preventDefault()` 並以 Canvas 顯示 canonical state，`webglcontextrestored` 後以同一 canonical state 重建畫面，不產生 observation evidence。
- 權威物體、候選點及相機方向保存在三維模型坐標；Canvas pixels 只屬 derived rendering。
- 姿態權威表示固定為整數十分一度 `{ yaw10, pitch10 }`：`yaw10` canonical wrap 至 `[-1800,1800)`，`pitch10` clamp 至 `[-800,800]`；render 時才導出 rotation matrix／normalized quaternion。禁止 roll 作核心要求，以降低手機操作複雜度。
- 立體以半透明面、清楚輪廓及深度排序顯示；後方候選點透明度稍低，不能只用顏色表達深度。
- 球體使用經緯參考線或三個大圓提示旋轉；正方體／長方體顯示半透明面及可辨識邊。
- 候選點 A–E 固定在物體本地坐標，旋轉時一同投影；Three 及 Canvas 模式均以可見 HTML 標籤覆蓋投影點。layout 以 stage 實際 CSS 闊高建立相隔 `48 CSS px` 的 deterministic slots，按深度及距投影錨點分配五個唯一位置；不設可退回重疊位置的 fallback。標籤離錨點超過 `16 CSS px` 時，以不可互動的幼虛線及小錨點顯示關係。
- resize 時由三維狀態重新投影，絕不把舊 Canvas pixel 當答案。
- orbit HTML overlay 在 normal／hover／focus／active 都保持透明，不能被共用 `button:hover` 填白；候選點使用高對比、可見字母的 44 px hit target，選中時即時以形狀、描邊及狀態文字回饋。320、390 及 desktop 寬度每次 resize 後必須產生 nonblank frame。
- renderer construction、render、resize 或 context event 任一例外均立即以同一 canonical state 畫 Canvas fallback；fallback 本身失敗時顯示技術狀態而非白畫面。

### 8.2 電腦及手機旋轉操作

#### Mouse／trackpad

- 在立體的專用 orbit hit region 按住及拖動：水平 delta 控制 yaw、垂直 delta 控制 pitch。
- 保留相對 drag 路徑；按下時物體不跳動。
- click candidate 與 orbit drag 使用 `5 CSS px` activation threshold 區分；tap/click 未超過 threshold 才作選點。
- 不要求右鍵、中鍵、滾輪或 trackpad 雙指手勢。

#### Touch／pen

- 單指在 orbit region 拖動使用相同 yaw／pitch 模型；active pointer capture 後 host、panel 及 viewport 全部保持不動。
- 第二指不接管 active gesture；v1 不提供 pinch zoom，防止 scroll／zoom ownership 混亂。
- 單指點候選點即建立 tentative selection 並顯示 highlight；未完成兩個 observation 時只保存選擇，不構成完成 evidence，亦不能進入 check。

#### Keyboard／compact equivalent

- Canvas 後提供可聚焦的 A–E radio list，與投影點雙向同步；radio 在 observation gate 前亦可 tentative 選擇。
- Canvas orbit region 可聚焦；方向鍵旋轉，Shift＋方向鍵使用較大角度。
- 提供文字摘要：立體種類、目前大致觀察方向、候選點標籤；不可朗讀哪一點是中心。

### 8.3 有效觀察證據

- 每次 gesture／button／keyboard episode 結束時先把 view quantize 至 `{yaw10,pitch10}`，再以兩個 view-forward unit vectors 的夾角計算 canonical orientation difference。
- 第一次與初始 canonical view 相差至少 `21.0°` 才記錄 observation 1。
- 第二個 canonical view 與 observation 1 相差至少 `36.0°` 才形成 observation 2。整數 `0.1°` 表示及 `1°` guard band 確保 encode／restore 不會把有效證據推過原本的 `20°／35°` 教學門檻。
- 只在 gesture end 或 stage target 的鍵盤 step 完成後 checkpoint，不逐 frame 保存。
- 自動動畫、restore render、preview render 及微小手震不算觀察證據。
- 兩個 observation 齊全後才可確認候選點；scorer 同時檢查 evidence，不能只信任 UI gate。

### 8.4 第三部分 preview window

- touch／pen orbit drag 及候選點 pointerdown 時顯示固定角落 Canvas preview；mouse／keyboard 不顯示。
- preview 使用同一份當前 3D model state 及 renderer 在第二個小 Canvas 重畫，不能使用低資訊量的合成圖示。
- orbit drag 時 crop／camera focus 跟隨 pointerdown 對應的 model-space surface point或最近候選區域；候選點操作時以該候選點為中心。
- preview 顯示真實立體面、邊及候選點，但不得加上幾何中心、答案十字、額外深度數值或 scorer 提示。
- 固定於最遠角落、`pointer-events:none`、`aria-hidden:true`，在 gesture 結束或取消立即清除。

### 8.5 第三部分 scoring tolerance

- 答案是離散 candidate key，不從 Canvas pixel 保存。
- 正確 candidate 的 model-space position 必須精確為 `(0,0,0)`。
- scorer 由 generator 重建 candidate map，再比較 learner selected key。
- 選錯不給結果分；不使用「不停試到中」模式。確認後只可在整體檢查頁透過「重新做第三部分」清除該部分重做。

## 9. Responsive layout contract

- Control-panel classification: `bounded split-panel`。面板只顯示任務、證據及物理筆記，不是 remote control，亦不顯示 keyboard disclosure；第一至三部分預設不顯示移動、測試、掛孔、畫線、旋轉、視角或標註按鈕列。
- 原因：三部分均有持續可見 stage 及重複使用的工具／證據／確認控制；學生操作 panel 時 stage 必須保持可見。
- Phone app: `height:100vh` fallback 後使用 `height:100dvh`。
- Phone stage track 初值：`minmax(13rem, 46vh)`，支援 `46dvh`；第二部分如可讀性測試不足，可按 phase 調至 `48dvh`，但不可由 intrinsic content 擠壓 panel。
- 下方 controls panel 取得餘下高度，`overflow-y:auto; overscroll-behavior:contain; min-height:0`。
- `html`、`body`、app shell 及中介 grid/flex children 在 bounded iframe 內不可有可用垂直 scroll range。
- desktop／tablet：stage 左／上，controls 右／下；stage 仍為主要區域，不新增 desktop-only 必要操作。
- 320×500、390×500、390×600、一般直向、橫向、200% zoom 及軟鍵盤情境下，提交、重試及技術處理等必要按鈕必須可在 panel 內到達；第一至三部分的操作由 stage targets 擁有。
- 極短高度以縮小 stage 內 padding、reflow formula card 和壓縮非必要說明處理；stage 不成為獨立垂直 scroller。
- preview overlay 不影響 grid track、scrollHeight 或 hit target geometry。

## 10. Touch gesture ownership contract

### 10.1 Draggable target inventory

| Target type | Selector／hit strategy | Capture target | Rendering 可在 drag 中替換？ |
|---|---|---|---:|
| 一維承托點 | 明確 SVG rect／HTML overlay，最少 52×52 CSS px | 穩定 hit target | No |
| 二維平板平移面 | visible polygon 的獨立 stable overlay，不覆蓋孔／手柄 | stage interaction layer | No |
| 二維小孔 | 每孔獨立 circle hit geometry | 該孔 hit target | No |
| 二維旋轉手柄 | 明確 52×52 CSS px hit overlay | 穩定 handle target | No |
| 二維畫線／取下層 | 只覆蓋目前平板可見 polygon 的穩定 layer；active pivot 附近向下拖屬畫線，其餘位置拖動路由至 canonical 取下／整板或最近孔平移；牆面／stage 空白不屬此 target | 同一穩定 plate layer | No |
| 二維重心標註 | 明確 point hit overlay | 穩定 hit target | No |
| 三維 orbit region | Canvas 上方明確且有尺寸的 HTML hit layer | orbit layer | No |
| 三維候選點 A–E | 投影位置對應的 stable HTML buttons／hit overlays | 各 candidate button | No |

active target 在 drag 中不得因全面 `innerHTML` 重畫而卸載。需要更新 SVG 時，只更新 visual attributes／separate visual layer；pointer capture target 保持 mounted。

### 10.2 Gesture ownership matrix

| Touch starts on | Expected owner | Expected scroll delta | Required pointer result |
|---|---|---:|---|
| 已知非互動 stage 空白 | Moodle／enclosing host | host 非零並帶動 iframe；activity document、panel、visual viewport 為 0 | 不開始 drag、不改 learner state |
| independently scrolling control panel | panel only | panel 有 range 時非零；host、iframe、activity document、兩邊 visual viewport 為 0 | stage 固定；邊界亦不 chain 到 host |
| 一維承托 target | simulation | 所有 host、document、panel、viewport、iframe position 為 0 | 承托架移動；有 pointermove＋pointerup；無 pointercancel；preview 正常清除 |
| 二維平板／孔／旋轉手柄／畫線／標註 | simulation | 同上全部為 0 | 正確 target 獨佔 gesture，沒有平移／旋轉模式串擾 |
| 三維 orbit／candidate target | simulation | 同上全部為 0 | orbit 或 selection 只發生其一；無誤選及 pointercancel |

### 10.3 Technical decisions

- stage root blank region: `touch-action:pan-y`。
- 每個 direct-manipulation hit target 在 `pointerdown` 前已有 `touch-action:none`；不可在 pointerdown 後才動態加入。
- 不在整個 SVG／Canvas／stage 設 `touch-action:none`。
- draw mode 只令 plate polygon 內的 stable drawing hit layer 使用 `touch-action:none`；polygon 外 stage 空白保持 `pan-y`。trusted iframe matrix 必須在 draw mode 開啟時分別驗證板內畫線 gesture 及板外 host-owned swipe。
- pointerdown 只接受 primary active gesture；第二指不可接管或改 preview focus。
- capture target 保持 mounted，直至 pointerup／cancel／lost capture。
- 每個 gesture 記錄 grab offset／angle offset；target 不跳到手指中心。
- Moodle-like scrollable iframe 必須以 trusted touch gestures 分別測 source 及 packaged SCORM；DOM `dispatchEvent`、CSS source check 或 direct-page 測試不算完整證據。
- 若 iframe 原生行為未能把 stage 空白 swipe 交給 host，應調整 scroll topology 或只轉交同一 host owner；禁止把 stage swipe 轉發至 sibling panel。

## 11. Preview window 共同合約

### 11.1 啟用範圍

- 所有 touch／pen 的精細 drag target 必須顯示 preview。
- 第三部分廣域 orbit drag 亦顯示真實 renderer preview，以符合一致觸控回饋；mouse／keyboard 不顯示。
- tap-only target 可在 pointerdown 顯示 preview，若未成為 drag，pointerup 後立即消失；preview 本身不等於答案或操作證據。

### 11.2 視覺及資料規則

- 固定在 pointerdown 起點最遠的 stage 角落；gesture 中途不追手指及不換角。
- 顯示「原圖現有內容的真實局部放大」，不是 summary card、答案提示或另畫的 mini simulation。
- SVG 使用 sanitized scene clone＋跟隨 authoritative target 的 viewBox；Canvas 使用相同 model state 的第二次 render。
- crop 跟隨實際 snapped／displayed target，而非未經限制的 raw pointer。
- 約 `min(52vw, 11.5rem)`，有高對比邊框但不遮擋主要操作區。
- clone 移除所有 ID、drag target、focus target、event-related data、role 及重複 ARIA。
- `pointer-events:none`、`aria-hidden:true`、不接受焦點、不改 DOM scroll topology。
- preview 不加入原圖不存在的十字線、數值、標題、正確位置、tolerance circle 或方向提示；若原場景本身已有鉛垂線，它可自然出現在 crop。
- 原圖 active target 同時有非顏色唯一的 highlight，例如輪廓加粗／halo。

### 11.3 Lifecycle

- 以下事件全部清除 preview：pointerup、pointercancel、lostpointercapture、window blur、visibility loss、phase change、reset、restore、submission lock、render rollback。
- preview state 是 transient UI，不進 draft／review snapshot，不觸發 SCORM commit，不逐 pointermove 宣告 ARIA。
- sub-threshold jitter、tap-only、invalid drop 亦必須清除 preview。

## 12. Scoring

### 12.1 總分及原則

- Total: 100。
- Passing threshold: 60（可在部署前由教師／Moodle 要求確認）。
- Score floor: 0。
- score、review metadata、pending payload及送 LMS 的值全部保留 scorer 的 canonical 完整精度；只在 learner-facing DOM 另行四捨五入顯示。不得把顯示分數寫回 result，確保 restore 後 `SimActivityFlow.reviewResult()` 的 exact comparison 一致。
- 重複、無效、同一位置 spam 或程式性直接填答案不增加過程分。
- 不要求學生故意答錯或失敗若干次；第一次準確完成仍可取滿分。
- 每項結果分都有相應 evidence gate。欠缺有效操作時，即使答案碰巧正確，該結果分為零。

### 12.2 分項

| 部分 | Component | Points | Evidence／accuracy |
|---|---|---:|---|
| 一維 | 完成至少一次真正承托放手 | 5 | 有 finite support position 及 completed release episode |
| 一維 | 找到水平中性平衡 | 10 | episode result 為 balanced，並通過 generator ground truth 驗證 |
| 一維 | 平衡後揭示生成題目的精確重心 | 15 | 新 production 的 `markX=x_cm`：15；欠 balanced evidence：0。舊 snapshot 的非精確 `markX` 仍按原 `e₁` bands 重算，以保持已提交 review 分數相容 |
| 二維 | 兩個不同孔成功懸掛並 settled | 12 | 每個有效孔 6，最多兩個計分；額外孔不重複加分 |
| 二維 | 兩條有效鉛垂線 | 18 | 每條 9；必須對應不同 settled holes 並通過幾何驗證 |
| 二維 | 交會證據質素 | 10 | 設 `eᵢ=distance(mark,leastSquaresIntersection)/S`；`eᵢ≤0.03`: 10；`0.03<eᵢ≤0.08`: `10(0.08-eᵢ)/0.05`；`eᵢ>0.08`: 0；退化／平行組合為 0 |
| 二維 | 標註真重心 | 15 | 設 `e₂=distance(mark,trueCOM)/S`；`e₂≤0.03`: 15；`0.03<e₂≤0.07`: `15-10(e₂-0.03)/0.04`；`e₂>0.07`: 0；欠兩孔兩線 evidence: 0 |
| 三維 | 兩個有效觀察姿態 | 5 | orientation difference 規則通過 |
| 三維 | 選中幾何中心 | 10 | 正確 candidate: 10；錯誤: 0；欠觀察 evidence: 0 |

### 12.3 防亂估及 penalties

- UI 不允許在 evidence gate 前確認答案；scorer 仍獨立重驗。
- 第一部分欠承托／平衡而直接有 `markX`：結果分 0，invalid snapshot policy 視 shape 決定拒絕或清除未合法值。新 UI 沒有直接填寫或調整 `markX` 的入口。
- 第二部分欠兩個不同 settled holes 或兩條 valid lines 而直接有 mark：結果分 0，該 state 不可提交。
- 第三部分欠兩個 observation 而選 candidate：tentative editing state 合法並可 restore，但結果分 0、該部分未完成且不可進入 check／提交。
- 不以 pointermove 次數、停留時間或畫線數量直接加分。
- 無效 drop、無效線及錯誤候選不扣到負分；「重新做此部分」清除該部分證據，不提供試錯後保留最高分。
- 完全沒有完成有效操作而靠 state 注入答案，總分必須為 0。

### 12.4 Scorer invariants

- scorer 輸入只接受 production-shaped authoritative answer／evidence。
- 所有數值必須 finite 並在合法 normalized ranges。
- line／hole／candidate keys 必須屬 generator 重建的題目，且 relationship 完整。
- score 不信任 persisted `valid`、`balanced`、`settled`、`intersection` 或 `correct` flags；全部由 seed、geometry 及 evidence data 重算。
- `score(original) === score(restore(encode(original)))`。

## 13. Phase/state matrix

### 13.1 Matrix

v2 把 active tab 與各部分完成度分開；`variant` 只可為 `editing | complete | submitted`，不再保存 sequential／redo variant 或 `returnToCheck`。三個 part substate 在任何 editable tab 都按自身證據獨立驗證。

| Phase | Variant | Required semantic state | Allowed next action |
|---|---|---|---|
| `part1`／`part2`／`part3` | `editing` | canonical seed/version；三個獨立合法的 part substates；目前 tab 可完整或未完整 | 操作目前 tab、切換任意 tab；三部分完整時進入 check |
| `check` | `complete` | 三部分均完整；transient absent | 返回任意 tab或 submit |
| `review` | `submitted` | 三部分均完整的 authoritative answer | 只讀檢視 |

### 13.2 Transitions

```text
partN/editing -> partM/editing        on switchPart(M), after rollback and checkpoint
part1/editing                         gains balance／mark evidence in place
part2/editing                         gains settled／line／mark evidence in place
part2/editing                         may detach one unlined active hang, removing its hang record
part3/editing                         gains tentative selection／observation evidence in either order
partN/editing -> check/complete       on enterCheck only when all three complete
check/complete -> partN/editing       on switchPart(N), preserving all evidence
editable/check -> partN/editing       on resetPart(N), clearing only that part
check -> review                       only through successful/committed SCORM submission handling
```

- 不保存 `swinging`、`dragging`、`drawing-in-progress` 或 `orbiting` phase。若頁面在動畫／gesture 中離開，draft provider 只提交上一個已完成 semantic checkpoint。
- restore 後的下一步必須與原 state 相同；每個 matrix row 的 round-trip test 都執行一個合法 continuation。

## 14. Persistence contract

### 14.1 Draft snapshot（概念 schema）

```js
{
  v: 2,
  generatorVersion: 1,
  seed: 123456789,
  phase: "part2",
  variant: "editing",
  part1: {
    supportEpisodes: [{ x: 0.41, outcome: "left-fall" }, { x: 0.56, outcome: "balanced" }],
    markX: 0.558 // 新 production 必須等於由 seed 重建的精確 x_cm
  },
  part2: {
    hangRecords: [{ holeKey: "h1" }, { holeKey: "h3" }],
    activeHoleKey: null,
    lines: [
      { holeKey: "h1", a: [0.12, -0.31], b: [0.10, 0.35] },
      { holeKey: "h3", a: [-0.28, -0.08], b: [0.29, 0.19] }
    ],
    mark: null
  },
  part3: {
    view: { yaw10: 250, pitch10: -120 },
    observations: [{ yaw10: 250, pitch10: -120 }],
    selectedCandidateKey: null
  }
}
```

實際 encoder 可使用較短 field names 壓縮，但 production code、tests 及 plan 必須有一份清楚 mapping；不可用難以驗證的任意 binary blob。

### 14.2 Review snapshot

```js
{
  v: 2,
  generatorVersion: 1,
  seed,
  part1: { supportEpisodes, markX },
  part2: { hangRecords, lines, mark },
  part3: { view, observations, selectedCandidateKey }
}
```

review 必須足以：

- 重建相同三題及隱藏 ground truth；
- 重畫所有學生承托結果、平板鉛垂線、mark、3D 候選 selection；
- 重新驗證 evidence、重算 score／pass；
- 與 Moodle 保存的 summary 作 trust comparison。

`markX` 保持 schema v2 欄位名稱及數值 shape，避免破壞已發布草稿、review 及 pending-final payload。新 production 在 balanced completion 寫入精確 `x_cm`；decoder 不改寫舊的非精確值，scorer 仍依舊 rubric 重算，而 UI 由 seed 重建並顯示精確 `x_cm`，不把舊值畫成物理重心，也不靜默覆寫 snapshot。

### 14.3 Authoritative、derived、transient

Authoritative learner state：

- generator version／seed；
- completed support episode positions；
- part1 `markX` 相容 checkpoint（新 production 為精確生成 `x_cm`；舊非精確值只供驗證／相容重算，不是現行 learner input）；
- distinct hole keys with completed settled records；
- plate-local line endpoints及其 hole relationship；
- part2 plate-local mark；
- canonical current `view:{yaw10,pitch10}` 及最多兩個 observations；每個 observation item 只可有同樣兩個 integer fields；
- selected candidate key；
- active phase／簡化 variant。

Derived and rebuilt：

- hidden masses、true centres、moments of inertia、equilibrium angles；
- SVG paths、Canvas pixels、world transforms、least-squares intersection；
- score、pass、valid line flags、button enabled state；
- candidate projected pixels、depth sorting；
- generated DOM IDs。

Never persisted：

- pointer IDs、capture target、raw client coordinates、grab offsets；
- preview corner／markup／Canvas；
- in-progress swing angle／angular velocity；
- in-progress draft line；
- hover、focus、open formula card、animation frame timestamps。

### 14.4 Validation

- seed、version、phase、variant、keys 及所有 arrays 有明確 type／length bounds。
- `yaw10` 必須為 canonical integer `[-1800,1800)`、`pitch10` 為 integer `[-800,800]`；decoder 不接受等價但非 canonical 角度，orientation evidence 只從 decode 後 integers 重算。
- 所有 numbers finite；normalized coordinate、angle、line length及candidate key 在合法範圍。
- support episodes 設合理上限，例如只保留最近 12 次及第一個 balanced episode；重複 spam 不令 snapshot 無限增長。
- hangRecords／lines 的 hole keys 唯一並存在於 generated plate；line relationship 不可 dangling。
- 最多 4 條 valid lines；每條 endpoints 不可相同或近零長度。
- 三部分 substate 互相獨立驗證；active phase 不限制其他部分可否已有答案。
- `marked` 必須有相應 evidence gate；`review` 必須三部分完整。
- part3 tentative `selectedCandidateKey` 不需要 observation gate 才可保存；只有 complete/check/review 要求兩個有效 observations。scorer 對欠 observations 的 selection 給 0 分。
- generated IDs 若出現在舊 snapshot 應忽略並重建，不作 authoritative key。
- representative maximum draft／review 必須低於 4000 UTF-8 bytes。
- decoder 確定性遷移舊 v1 `normal`、`redo`、`review` 及 pending-final 內的合法 answer；只移除 sequential／`returnToCheck` 表示並保留 active phase及權威證據。v1 variant、依賴或 evidence 關係損壞時拒絕，不可用 v2 較寬鬆規則洗白；encoder 永遠只輸出 v2。

### 14.5 Invalid snapshot policy

- editable draft：只在 plan-defined clear／overwrite path 能確保移除壞 snapshot 時重設；否則鎖定並顯示技術載入錯誤。
- finished invalid review：保持 attempt 鎖定，只顯示可信 Moodle summary，不開新 editable attempt。
- pending-final：由 shared runtime 凍結及重試同一 payload；若 deeper decoder／rescorer 拒絕，先 `SimScorm.quarantinePending()` 再顯示 technical lock。

## 15. Shared SCORM lifecycle

### 15.1 Startup

使用 `SimScorm.loadAttempt()` 及 `SimActivityFlow.startup()`：

| Outcome | Editable? | UI |
|---|---:|---|
| `review` | No | 驗證 review、由 seed 重建並重算；不一致時顯示安全 Moodle summary |
| `editable` | Yes | 新建或恢復 draft；register draft provider |
| `frozen` | No | 同一 pending payload 等候 retry；不得宣稱已提交／得分／及格 |
| `load-error` | No | 技術錯誤 lock；不得顯示推測分數 |

### 15.2 Submission

使用 `SimScorm.submitWithCallbacks()`，兩個 callback 都經 `SimActivityFlow.submission()`：

| Outcome | Editable? | UI |
|---|---:|---|
| `success` | No | 已提交、完成 attempt、只讀 review |
| `committed` | No | 結果已 commit；finish 可 retry；只讀 |
| `frozen` | No | 待確認，不能顯示 score/pass claim |
| `retry` | 視 `retryable` | 嚴格按 shared outcome；不可承諾一定可 retry |

- submission score 是 final submitted state，不以過程中的最高分替代。
- semantic change 後保存 draft；pointermove／animation frame 不 commit。
- page lifecycle draft provider 可 flush 最新已完成 semantic checkpoint。

## 16. Accessibility and input equivalence

- 所有視覺 drag 都有 keyboard／button 等價途徑，且使用同一 model function 和 scorer。
- touch target 最少 44×44，精細 target 目標為 52×52 CSS px；可見圖形可較細。
- focus ring 清楚，不只靠顏色表示 active、valid 或 invalid。
- 平板的孔有穩定名稱「小孔 1／2／…」；候選點為真實 radio buttons，不只存在 Canvas pixels。
- 每次 gesture end 才用 live region 宣告重要結果，例如「小孔 2 已掛好，平板正在擺動」及「平板已停止，可以畫鉛垂線」；不逐 frame 宣告。
- 跌落／擺動資訊有文字等價，不要求聽聲音。
- reduced motion 保留物理因果及最終姿態，不把動畫完全跳成無解釋瞬移。
- 高對比模式下板邊、孔、釘、線、標註及候選點仍可分辨。
- 任何正誤、active／inactive、前／後深度都不能只靠顏色。
- formula `aria-label` 使用自然中文；視覺變數 italic 不影響讀屏。
- Canvas 提供可讀摘要及 DOM candidate controls；Canvas 本身不作唯一語意來源。

## 17. Feedback and review

### 17.1 作答期間

- 不顯示真重心、距離答案數值或「向左／右移幾多」。
- 只提供操作有效性與物理現象：跌落方向、是否掛上、是否 settled、線是否穿過孔及沿鉛垂方向、觀察角度是否足夠。
- 若兩條線夾角太細，提示「兩條線方向太接近，請選另一個小孔」，不建議指定答案孔。
- 技術錯誤與學習結果分開；未保存／未提交不可寫成失敗或零分。

### 17.2 提交後

- 第一部分顯示由 seed 重建的精確重心；說明承托點進入容差只代表實驗接受的平衡範圍，而理想情況下承托點與重心完全重合時總力矩為零。舊 snapshot 的非精確 `markX` 不畫成學生 mark 或物理重心。
- 第二部分顯示真重心、學生各條線、line intersection／least-squares point 及 mark；說明每次平衡時重心在 pivot 正下方。
- 第三部分顯示幾何中心及對稱面／對稱軸提示。
- 分項顯示「操作證據分」與「答案準確分」，讓學生知道亂估為何不會得到完整分數。
- review 使用同一 native math renderer，不顯示 raw TeX。

## 18. Test plan

### 18.1 Generator／model unit tests

- [ ] 同一 version＋seed 在 Node／browser 重建完全相同題目。
- [ ] part1 質量全正、重心範圍、偏離中點及左右分布覆蓋。
- [ ] part1 torque sign、balance tolerance just-inside／just-outside、跌落方向。
- [ ] part2 polygon 不自交、重心安全距離、孔數／孔距、可用 line-angle pair。
- [ ] `S = √A` 對每個 plate template 唯一重建；所有 `0.025S`、`0.45S`、`0.03S`、`0.07S` just-inside／just-outside boundaries 共用同一尺度。
- [ ] part2 equilibrium 令 pivot→COM world vector 垂直向下。
- [ ] damping 按 `ζ = 0.55` per-instance calibration，在 generator 的 `I_p`／`M`／`d` extrema 保持 underdamped、finite、約 1.5–3.0 s settle；測 fixed-step、frame-gap clamp、threshold dwell及 settled snap。
- [ ] world↔plate-local transform round-trip。
- [ ] 畫線 validity：穿孔距離、垂直角、最短長度 boundaries。
- [ ] 兩線 intersection及 3–4 線 least-squares；平行／近退化拒絕。
- [ ] part3 projection finite、所有 candidates 有指定 solid-interior margin、candidate separation、correct key randomized、quaternion normalization。

### 18.2 Scoring tests

- [ ] 每個 component、partial-credit boundary、score floor及 total=100。
- [ ] 正確答案但欠 evidence 的每部分結果分均為 0。
- [ ] 第一次成功可取滿過程分，不要求先失敗。
- [ ] 重複同 hole／同 line／pointer spam 不累積分。
- [ ] 兩孔兩線 relationships 必須有效且 angle 足夠。
- [ ] part3 wrong candidate 及欠 observation evidence。
- [ ] scorer 不信任 persisted `correct`／`intersection`／`score` flags。

### 18.3 Persistence matrix tests

- [ ] §13 每個 phase／variant 有 production encode/decode/restore round-trip。
- [ ] 每個 restored fixture 執行一個合法 continuation並到達預期 state。
- [ ] `score(original) === score(restore(encode(original)))`。
- [ ] redo variant 保留其他部分、清除目標部分並 return check。
- [ ] missing previous parts、future data、illegal active answer、phase/variant mismatch fail closed。
- [ ] NaN、Infinity、負值、out-of-range coordinates／angles、invalid enum 拒絕。
- [ ] duplicate／dangling hole keys、candidate keys、line relationships 拒絕。
- [ ] generated DOM IDs 被忽略及重建。
- [ ] maximum snapshot < 4000 UTF-8 bytes。

### 18.4 UI/runtime tests

- [ ] mouse、touch、pen、keyboard 路徑呼叫同一 semantic update functions。
- [ ] 所有 drag target 在 pointerdown 前有有效 `touch-action:none`，stage blank 為 `pan-y`。
- [ ] stable capture target 不在 drag 中卸載；收到 pointermove＋pointerup，無 pointercancel。
- [ ] activation threshold 防 tap／手震誤改答案。
- [ ] translation／rotation／hole／draw targets 不串擾。
- [ ] pointerup、cancel、lost capture、blur、phase change 全部清 preview。
- [ ] preview 固定最遠角、真實 scene content、sanitized、no recursive clone、no answer overlay。
- [ ] mouse／keyboard 不顯示 touch preview。
- [ ] part2 舊線在重新移動／旋轉時保持 plate-local transform。
- [ ] part3 click-vs-orbit threshold及 DOM radio synchronization。
- [ ] native formula markup 包含 `<var>`、sub/sup、upright units、role math、ARIA；無 MathJax／raw TeX。
- [ ] reduced-motion 路徑仍產生正確 settled semantic event。

### 18.5 Responsive／trusted browser matrix

- [ ] Chromium、WebKit；可行時加 Firefox desktop smoke。
- [ ] 320×500、390×500、390×600、正常手機直向、橫向、tablet、desktop、200% zoom。
- [ ] browser toolbar／visual viewport change、orientation change、軟鍵盤後 controls bottom 可到達。
- [ ] source direct page及 packaged SCORM 均運作。
- [ ] scrollable Moodle-like iframe 具有上下 host range，記錄 host／iframe／activity document／panel／兩邊 visual viewport。
- [ ] trusted stage blank swipe 只移動 host；panel swipe 只移動 panel，包括 boundary；每種 draggable target 只由 simulation 擁有。
- [ ] 每種 touch target 驗證 preview 與 active target 同步，外層所有 scroll position 為 0 delta。
- [ ] 平板擺動使用 fake clock／controlled RAF，browser check 不因 animation timing flaky。

### 18.6 Lifecycle／package tests

- [ ] startup `review`、`editable`、`frozen`、`load-error`。
- [ ] submission `success`、`committed`、`frozen`、retryable／non-retryable `retry`。
- [ ] valid trusted review；saved metadata score/pass mismatch；Moodle recorded score/status mismatch；unknown Moodle status 均走正確 trusted／safe-summary 路徑。
- [ ] finished invalid review remains locked with safe Moodle fallback。
- [ ] pending-final deeper rejection calls quarantine and remains locked。
- [ ] pending-final canonical comparison 會拒絕「aggregate score/pass 相同但 authoritative answer／evidence 不同」的 payload，且不 retry 被拒內容。
- [ ] test files 全部加入 `tools/run-tests.js`。
- [ ] manifest 包含 activity 及 shared runtime 每個實際載入檔。
- [ ] config metadata 唯一且 source／package parity。
- [ ] SCORM ZIP root 有 `imsmanifest.xml`，離線不依賴 CDN。
- [ ] package browser smoke 完成三部分、提交、reload review。
- [ ] `npm run check` 通過 XML、SCORM 1.2 manifest profile、registration 及 package-ready 靜態檢查。
- [ ] 真 Moodle student attempt 驗證 suspend/resume、commit、finish、score/status及 review lock。

## 19. Implementation sequence

### Batch 1 — plan contracts and pure core

1. 鎖定 tolerance、scoring rubric、generator version及 phase matrix。
2. 實作 deterministic generator、1D／2D geometry與 physics、3D projection純函數。
3. 實作 scorer及 unit tests；先證明 evidence gates 和 ground truth 重建。

### Batch 2 — persistence and lifecycle

1. 實作 production-shaped encoder／decoder／restore。
2. 完成 matrix round-trip、invalid-state、byte-size及 continuation tests。
3. 接駁 shared startup／submission outcomes，但先以最小 UI fixture 驗證。

### Batch 3 — learner UI and direct manipulation

1. 建立 bounded split-panel shell及三個 phase stage。
2. 完成第一部分承托、第二部分 transform／旋轉手柄／掛釘／畫線、第三部分 Canvas orbit／candidate controls。
3. 所有 target 加 keyboard／button equivalent，gesture end 才保存。

### Batch 4 — preview and accessibility

1. 建立共用但 activity-local 的 preview controller；SVG clone及 Canvas re-render 分開 adapter。
2. 逐 target 驗證 fixed-corner、sanitization、cleanup及 scroll isolation。
3. 完成 native math formatter、formula CSS、ARIA、live region、reduced motion及 high contrast。

### Batch 5 — registration, package and release evidence

1. 更新 `sim/config.js`、manifest、test runner。
2. 跑 targeted tests 後一次完整 `npm test`，再跑 `npm run check` 驗證 manifest profile 及全 repo 靜態合約。
3. 建 package，跑 source／package browser matrix及 parity。
4. 依 T3 workflow 做適用 specialist discovery、單一 implementation batch、bounded fix verification及 final release gate。
5. 真 Moodle attempt 通過前維持 `planned`；所有 gate 通過後才改 `active`。

## 20. Acceptance criteria

- [ ] 學生可在 phone、tablet、desktop 完成所有三部分，無 desktop-only 必要 gesture。
- [ ] 第一部分由實際承托跌落／平衡找重心，不提供答案方向數值。
- [ ] 第二部分每條線固定於平板本地坐標，換孔後仍保持物理正確。
- [ ] 平板可用 mouse、單指手柄、keyboard／buttons 旋轉；雙指不是必需。
- [ ] 阻尼擺最後令重心位於 pivot 正下方，且 reduced motion 仍保留因果。
- [ ] 第三部分候選點固定在三維物體內，旋轉後 depth／hit test 正確。
- [ ] 所有 touch／pen 直接操作有真實、固定角落 preview；不洩漏答案、不攔截 pointer、不寫 persistence。
- [ ] 所有物理量及公式使用一致 native LaTeX-like semantic typography，無 learner-facing raw TeX。
- [ ] 正確答案欠操作證據不獲結果分；完全無有效操作的直接猜測總分為 0。
- [ ] draft／review 可重建、可重算、可重畫；snapshot < 4000 bytes。
- [ ] SCORM 四種 startup及四種 submission outcomes 全部安全處理。
- [ ] trusted touch Moodle-like iframe matrix同時通過 source及 packaged SCORM。
- [ ] package 離線可用、manifest 完整、Moodle reload 後保持 submitted review lock。
