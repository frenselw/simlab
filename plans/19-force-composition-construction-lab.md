# 力的合成作圖實驗室

> 本文件是 `force-composition-construction-lab` 第一版的實作藍圖。第一版只處理力的合成，不包括力的分解；未完成本文件列出的 phase/state、persistence、scoring、touch 及 package 契約前，不開始製作 UI。

## 1. Scope

- **Slug**：`force-composition-construction-lab`
- **學生可見標題**：`力的合成作圖實驗室`
- **學習範疇**：Mechanics／Vectors／Forces
- **第一版題數**：5 題
  - 平行四邊形法則基礎題 2 題；
  - 首尾相接法基礎題 2 題；
  - 三個力首尾相接進階題 1 題。
- **Libraries**：none；使用原生 HTML、CSS、JavaScript、SVG 及 Pointer Events。
- **Assessment risk**：`formative`。
- **Trusted validation for high risk**：not applicable。所有題目、答案及分數均在學生瀏覽器內運算，不可用作高風險考核的可信邊界。

### 1.1 Learning objectives

學生完成活動後應能：

1. 說明力是具有大小及方向的矢量；
2. 在矢量作圖中平移力矢量的圖示，而不改變其大小及方向；
3. 將兩個力的箭尾放在同一點，利用平行四邊形法則作出合力；
4. 將兩個力首尾相接，作出由整條力鏈起點指向終點的合力；
5. 將三個力排列成一條首尾相接的力鏈，作出三力合力；
6. 理解力矢量相加時，改變相加次序不會改變最終合力。

### 1.2 Learner task and question sequence

| 題目 | 方法 | 力的數目 | 必須完成的操作 | 引導程度 |
|---|---|---:|---|---|
| P1 | 平行四邊形法則 | 2 | 平移兩力至共同起點、畫兩條虛線輔助線、畫合力 | 完整分步提示 |
| P2 | 平行四邊形法則 | 2 | 同 P1 | 只保留目前步驟提示，不顯示示範 |
| H1 | 首尾相接法 | 2 | 任選一力放到作圖起點、另一力首尾相接、畫合力 | 完整關係提示，不指定唯一次序 |
| H2 | 首尾相接法 | 2 | 同 H1；學生自行選擇兩力次序 | 只保留目前步驟提示 |
| T1 | 三力首尾相接 | 3 | 每個力恰好使用一次、接成力鏈、畫三力合力 | 進階題；只指定方法，不指定排列次序 |

每個新 Moodle attempt 生成一套新的五題。Editable draft reload、pending-final retry 及已提交 review 必須重現同一套題目，不得重新抽題。

### 1.3 Main interactions

- 拖動整支預設力矢量的圖示作平移；
- 力矢量不可旋轉、不可拉長、不可縮短；
- 把力矢量的箭尾吸附到作圖起點或另一個力的箭頭；
- 從系統提供的語意端點 handle 拖出虛線輔助線；基礎第一題只顯示合法起點，第二題由學生選擇；
- 從力鏈起點拖出合力；
- 返回、下一題、題目進度切換、復原上一步、重設本題；
- 進入提交前檢查，然後作一次最終提交。

### 1.4 Runtime files

```text
sim/force-composition-construction-lab/
  index.html
  styles.css
  generator.js
  notation.js
  model.js
  scoring.js
  persistence.js
  ui-runtime.js
  main.js
  generator.test.js
  notation.test.js
  model.test.js
  scoring.test.js
  persistence.test.js
  lifecycle.test.js
  ui-runtime.test.js
  accessibility.test.js

tools/
  force-composition-browser-regression.test.js

sim/manifests/
  force-composition-construction-lab.xml
```

所有新 test file 必須加入 `tools/run-tests.js`。所有 HTML 引用、shared runtime 及 runtime file 必須加入 manifest。

### 1.5 第一版明確不包括

- 力的分解；
- 三力題混合使用平行四邊形法則及首尾相接法；
- 四個或以上力；
- 數值式三角函數計算；
- 學生改變預設力的大小或方向；
- 自由新增、刪除或複製力矢量；
- 零合力、近乎零合力、近乎共線或退化平行四邊形題目；
- 老師自訂題目工具；
- 作答路徑分析或逐 pointer 軌跡記錄；
- 高風險考核及 server-side scoring；
- SCORM 2004 或 xAPI。

---

## 2. Catalogue metadata (`sim/config.js`)

```js
{
  title: "力的合成作圖實驗室",
  folder: "force-composition-construction-lab",
  categories: ["Mechanics"],
  description: "平移隨機力矢量，利用平行四邊形法則及首尾相接法作出兩力和三力的合力。",
  tags: [
    "physics",
    "mechanics",
    "forces",
    "vectors",
    "vector-addition",
    "resultant-force",
    "parallelogram-law",
    "head-to-tail",
    "drawing",
    "scorm"
  ],
  status: "planned"
}
```

`folder`、活動資料夾、manifest identifier 及 snapshot activity identifier 必須完全相同。藍圖及開發期間固定使用 `planned`；只有 package-ready checklist 全部通過後，最後一個 catalogue change 才可將 `status` 改為 `active`。

---

## 3. 用字及不可妥協的教學契約

### 3.1 學生介面用字

統一使用：

- `平行四邊形法則`；
- `首尾相接法`；
- `力矢量`，一般語境可簡稱 `力`；
- `箭尾`、`箭頭`；
- `共同起點`；
- `虛線輔助線`；
- `合力`；
- `平移`。

不得在學生介面出現「平衡四邊形」、「手尾連接」、「兩個質量」等語音輸入誤字。

### 3.2 物理模型及可平移範圍

本活動把各力視為**作用於同一質點的力矢量**，只研究矢量的大小、方向及矢量和，不研究剛體作用點、力矩或轉動效應。學生拖動的是力矢量的作圖表示；平移圖示不代表可在真實剛體上任意改變力的作用點。

預設力矢量是剛性幾何物件。每個預設力以固定矢量分量表示：

```js
{
  key: "F1",
  dx,
  dy
}
```

學生只改變箭尾位置 `tail={x,y}`。任何操作後都必須保持：

```text
head.x - tail.x = dx
head.y - tail.y = dy
length = hypot(dx, dy)
direction = atan2(dy, dx)
```

UI 不提供箭頭端點 resize handle、旋轉 handle、大小 slider 或角度輸入。拖動命中區覆蓋整支力矢量；pointer delta 只更新 `tail.x/tail.y`。

### 3.3 共同起點由學生任意選擇，不預先畫出答案

舞台不再顯示固定的 `O` 點或中央起點。學生第一次放置一支力時，放手位置會成為本題的共同起點；之後的另一支力、力鏈及合力只按這個學生所選的語意起點檢查。起點仍會受整支力矢量可見範圍限制，但不要求接近任何預設屏幕位置。

- P1/P2：兩個力的箭尾都要吸附到學生所選的共同起點；
- H1/H2：任一個力可先在任意位置建立共同起點，另一力再接到它的箭頭；
- T1：任一個力可成為力鏈第一項，在任意位置建立共同起點，其餘兩力依次接上。

固定的 `O` 已取消；生成器只用 safe-area 約束確保任意學生起點仍能容納整支力矢量，review、鍵盤操作及端點吸附改用保存的語意共同起點。

### 3.4 三力題方法範圍

T1 只接受首尾相接法，不接受混合平行四邊形法。三個力可以按任何排列次序組成力鏈；六種排列全部是合法答案。Scorer 只檢查：

1. 第一個力的箭尾在學生所選共同起點；
2. 三個預設力各使用一次；
3. 有兩個有效首尾接點；
4. 沒有分支、循環或一個箭頭接多個箭尾；
5. 合力由整條鏈第一個箭尾指向最後一個箭頭。

---

## 4. 整體流程及介面

### 4.1 開啟活動

活動直接開入 P1，不設 landing page。Header 只顯示標題、一句任務說明及 `第 1 / 5 題`。舞台顯示隨機預設力、方格背景及目前已畫幾何；操作面板顯示：

- 題型及目前步驟；
- 力矢量固定不變的短提示；
- P1–T1 五題進度按鈕；
- `復原上一步`；
- `重設本題`；
- `上一題`／`下一題`；
- `前往提交前檢查`。

P1–T1 五個進度按鈕由fresh draft成功建立及UI解鎖一刻起全部可用，題目之間沒有prerequisite、順序鎖或part解鎖條件。學生可以按任何次序作答、跳過任何題或任何part；未完成題目不會被清除，亦不阻止學生查看其他題。系統不自動替學生完成空白題。

### 4.2 P1/P2：平行四邊形法則

1. 兩個隨機力 `F₁`、`F₂` 初始放在互不重疊的位置；
2. 學生先把其中一支力拖到任意合法位置，放手後建立共同起點；
3. 另一支力箭尾進入該共同起點的吸附距離並放手後，吸附到完全相同的共同起點；
4. 兩力都到位後，guide 起筆 handles 才出現；
5. 學生由 `F₁` 箭頭拖出一條與 `F₂` 對應的虛線輔助線；
6. 學生由 `F₂` 箭頭拖出一條與 `F₁` 對應的虛線輔助線；
7. 每條線的起點由 handle 固定；學生只決定終點。終點接近第四頂點時才吸附；
8. 兩條正確輔助線都吸附後，合力起筆 handles 才出現；
9. 學生由共同起點拖至平行四邊形對角頂點，畫出合力；
10. 合力終點吸附後，本題標示「完成」，但仍可返回修改。

沒有吸附的輔助線／合力保留為 provisional geometry，學生可再次拖動其終點。它們不會被稱為正確，亦不取得該項分數。

P1 顯示逐步文字，例如「先把兩個箭尾移到共同起點」，並只顯示目前合法的 guide／resultant 起筆 handle。

P2 只顯示「完成平行四邊形，再畫出合力」。當 guides 可畫時，所選共同起點、`F₁` 箭頭及 `F₂` 箭頭都顯示外觀一致的中性 handle；學生要自行選擇起點。P2 最多保存兩條 guide records；錯誤起點仍可畫 provisional line，但不能吸附或得分。同一origin再次起筆會取代該origin舊線，production state不產生duplicate origin。已有兩條時，學生必須選取、清除或重畫其中一條，不會暗中新增第三條。兩條正確 guides 到位後，resultant 階段在所有目前幾何端點顯示相同中性 handles；只有由所選共同起點起筆的 resultant 可以吸附。

### 4.3 H1/H2：兩力首尾相接法

1. 兩個隨機力初始分開；
2. 學生可先選 `F₁` 或 `F₂`，在任意位置建立共同起點；
3. 把另一個力的箭尾移近第一個力的箭頭並放手，形成首尾接點；
4. 有效力鏈形成後，合力起筆 handle 在所選共同起點出現；
5. 學生拖至力鏈最後一個箭頭畫合力；
6. 合力終點吸附後完成。

H1 的完整提示是：「任選一個力，在任意位置開始作圖；再把另一個力的箭尾接到第一個力的箭頭。兩個次序都可以。」力鏈完成後只在所選共同起點顯示 resultant 起筆 handle。

H2 不指定次序；力鏈完成後，在所選共同起點及目前所有力的箭尾／箭頭顯示外觀一致的中性 handles。錯誤 origin 可以留下 provisional resultant，但不能吸附或得分。Editable view 不顯示第二個力應放在哪一邊的 ghost arrow。

### 4.4 T1：三力首尾相接進階題

1. 三個隨機力 `F₁`、`F₂`、`F₃` 初始分開；
2. 任一力可先在任意位置建立共同起點；
3. 其餘兩力逐一接到目前力鏈的自由箭頭；
4. 吸附只接受由所選共同起點向外延伸的單一路徑，不建立分支或循環；
5. 三力鏈完成後，所有目前力鏈端點顯示外觀一致的中性 handles；學生要自行選擇由共同起點畫至最後一個箭頭；
6. 六個排列次序全部接受，所得合力端點相同。

第一版不提供「平行四邊形」工具給 T1，避免學生誤以為必須畫多組中間合力。題目文字清楚寫明「請用首尾相接法」。錯誤 resultant origin 只形成 provisional line，不能吸附或得分。

### 4.5 修改、復原及 downstream invalidation

- 每個 semantic command 在 mutation 前把完整「目前題目 authoritative pre-state」推入 undo stack；mutation、snap、downstream invalidation 及 derived status recompute 必須在同一 atomic command 完成，之後才 request draft save；不保存每個 pointermove；
- `復原上一步` 只影響目前題目，最多保存最近 20 個 in-memory checkpoints；undo history 不進 SCORM snapshot；
- undo pop 後整體恢復該題 pre-state並立即 request draft save；被 upstream invalidation 清除的 guides/resultant 亦須一起恢復；
- `重設本題` 是一個可 undo 的 atomic command；
- reload 後仍可由已保存語意狀態繼續，但舊 undo history 不恢復，`復原上一步` 保持 disabled，直至學生完成一個新的 semantic command；undo availability 不是 persistence continuation invariant；
- 拖動一個已連接的力會先解除該力相關接點；
- 上游幾何失效時，所有依賴它的輔助線、合力及完成狀態立即清除，不留下 stale answer；
- P 題任何力離開共同起點：清除兩條輔助線及合力；
- H/T 題任何首尾接點被解除：清除合力；
- `重設本題` 在已有作答時先確認，然後回到該 seed 所定的初始位置；不重新抽題；
- 返回其他題及進入提交前檢查不清除任何合法答案。

提交前不預先顯示尚未由學生建立的正確幾何；handles、吸附及完成狀態只確認學生已自行移到容差範圍內的局部關係。這些即時確認是形成性鷹架，不等同無提示評核。

### 4.6 提交前檢查及最終 review

`前往提交前檢查` 進入 summary，只列出五題的「完成／未完成」狀態，不顯示分數、正確端點或答案輪廓。學生可以返回任一題修改，或確認最終提交。

允許提交任何完成度，包括完成`0/5`題、只做一題、只做其中一個part或跳過任何指定題。學生毋須先打開每一題；所有未作答項目保持空白並計0分，系統不得自動補答、建立預設答案或阻止提交。提交前需顯示中性確認：「仍有 N 題未完成，提交後不能修改，仍要提交嗎？」當五題全空白時，`N=5`，同一確認仍提供可用的「仍要提交」動作。提交後attempt鎖定。

已提交且`trusted-match`的 review 顯示：

- 總分及完成狀態；
- 每題各 scoring component；
- 學生提交的矢量位置、輔助線及合力；
- 只有在 submitted review 才可按「顯示正確作圖」切換正確幾何 overlay；
- 不容許拖動、復原、重設或再次提交。

---

## 5. 隨機題目生成契約

### 5.1 Seed、版本及重現性

Fresh attempt 使用 `crypto.getRandomValues()` 產生 unsigned 32-bit seed；若 API 不可用，才以時間、高解析時間及本地 counter 混合產生 fallback seed。Seed 只在 fresh attempt 建立一次。

```js
{
  schemaVersion: 1,
  generatorVersion: 1,
  seed: 0x00000000 // uint32
}
```

`generator.js` 使用固定 deterministic PRNG，並以 immutable registry dispatch：

```js
const GENERATORS = Object.freeze({
  1: generateV1
});
```

相同 `(generatorVersion, seed)` 必須產生完全相同的五題、矢量分量、初始位置及作圖安全區。已發布的 `generateV1` 不得原地改寫；任何會改變 PRNG consumption、rejection order、placement、fallback 或 output 的 change 必須新增 generator version。不得在 render 或 pointer handler 直接使用 `Math.random()`。

Fresh attempt 必須先生成 seed及完整 fresh state，建立 production draft envelope，並由 `SimScorm.saveDraft()` 成功 commit，才可 render/unlock editable UI。首次保存失敗時顯示 technical save lock及「重試建立練習」；不得先讓學生作答，亦不得在 reload 時偷偷換 seed。

每個已發布 generator version 留 immutable golden fixtures：多個固定 seeds、角度 boundary seeds及至少一個 forced-fallback seed，固定五題完整 specs、initial positions及signatures。最新 build 必須能由舊 v1 production snapshot 重現 golden outputs。

同一學生的新 Moodle attempt 會重新抽 seed。Draft reload、BFCache、pending retry、review restore 及同一 attempt 重入沿用原 seed。

純瀏覽器 SCORM 無法在所有學生之間作全域協調，因此「每個同學不同」在第一版定義為：每個 attempt 從 2³² seed 空間獨立抽樣，碰撞機會可忽略，但不宣稱數學上保證全班零重複。若日後要求絕對唯一，必須由 Moodle／LTI／後端派發題目 ID。

### 5.2 座標及矢量模型

- SVG `viewBox`：`0 0 760 500`；
- generator仍保留`(380,250)`作為safe-area／legacy fallback參考，但production舞台不顯示亦不要求學生靠近該點；
- 可見安全區：`x=70..690`、`y=60..440`；
- 所有箭頭、marker及label的 model geometry 須留在可見安全區；44 CSS px hit-target footprint 另在最小 viewport browser layout test 驗證，不以 SVG safe region 作虛假保證；
- 方向以數學角度生成，再轉為 SVG `dy=-L*sin(theta)`；
- 所有 model geometry 使用未四捨五入 double precision；
- pointerup provisional position 量化至 `0.1 SVG unit`；
- 顯示層不得反向改寫權威幾何。

### 5.3 P1、P2、H1、H2 基礎題約束

每題獨立生成兩個力：

```text
長度 L：85..135 SVG unit，以 5 unit 為一級
方向：0°..355°，以 5° 為一級
兩力最小夾角 theta：30° <= theta <= 150°
只排除完全直角：theta !== 90°
合力長度：65..220 SVG unit
長度比例：min(L1,L2)/max(L1,L2) >= 0.65
```

因此：

- `theta=30°`、`60°`、`85°`、`95°`、`120°`、`150°` 可生成；
- `theta=25°` 因近乎同向而拒絕；
- `theta=155°` 因近乎反向而拒絕；
- 只拒絕 `theta=90°`。

四條基礎題不得完全相同，亦不得只交換 `F₁/F₂` label。V1 signature 固定為把兩個 `[length,directionDeg]` tuples按 numeric lexicographic order排序，再以 `type:length@direction|length@direction` serialization；不把本來不同的全局旋轉題粗略合併。同一 attempt 內若 signature 重複便重新生成。Signature function及golden strings受 generator version保護。

生成器同時驗證：

- P 題的 `O`、`O+F1`、`O+F2`、`O+F1+F2` 全部在安全區；
- H 題兩個合法次序的中間端點及共同終點全部在安全區；
- 合力箭頭及 label 不被面板或舞台邊界遮擋；
- 初始力矢量的 visual geometry 不互相重疊、不接近任何合法吸附點，避免題目一開始已局部作答。

### 5.4 T1 三力進階題約束

```text
每力長度：70..110 SVG unit，以 5 unit 為一級
方向：0°..355°，以 5° 為一級
任兩力最小夾角：25°..155°
只排除任兩力夾角 theta = 90°
三力合力長度：60..220 SVG unit
```

生成器要驗證由 `O` 出發的所有單力 endpoint、兩力 subset sum、三力總和均在安全區，並對六種排列檢查完整 shaft、arrowhead及label的 model bounds，不只檢查 endpoints。相交線段可以接受，但每支力必須保留一段可獨立辨認的 shaft；重疊 touch targets 由 §8 的明確選取機制解決。另需拒絕：

- 三力合力近乎零；
- 任兩力近乎同向或反向；
- 三力全部集中於同一狹窄方向扇區；
- 任一合法排列會令箭頭或 drag target 超出安全區；
- 初始三力互相重疊或已在吸附距離內。

### 5.5 Bounded generation

每題最多作 256 次 rejection sampling。若仍未找到合法題目，使用由 seed 選擇、按合法 5° increments 旋轉及按合法 5-unit 長度級別縮放的 versioned valid fallback template；fallback 仍須通過同一 validator，不可繞過約束。Generator 不可無限 loop，也不可靜默放寬角度、安全區或非退化條件。

Generator test 必須以至少 10,000 個固定 seeds 驗證：

- 每個 seed 都在 bounded attempts 內產生五題；
- 所有題目通過約束；
- 同一 seed 完全 deterministic；
- 同一 attempt 四條基礎題沒有重複 signature；
- 10,000 個 seeds 中整套題目的 canonical signature 至少 99% 不同；
- 各合法方向扇區及長度級別在大量 seeds 中都有樣本；只作寬鬆 distribution sanity check，不要求脆弱的完全均勻；
- normal generation 的 fallback 使用率低於 1%；
- fallback 即使被強制走到亦符合全部約束。

---

## 6. 幾何、端點吸附及作圖模型

### 6.1 Canonical vector operations

```js
head(force, tail) = {
  x: tail.x + force.dx,
  y: tail.y + force.dy
}

sum(...forces) = {
  dx: sum(force.dx),
  dy: sum(force.dy)
}
```

P 題第四頂點：

```text
C = O + F1 + F2
```

H/T 題最終鏈終點亦為：

```text
C = O + sum(all forces)
```

所有合法排列必須得到同一 `C`；generator/model tests 以 inclusive `MODEL_EPSILON` 比較數學結果，不以 rounded DOM pixel 比較。Learner snap/scoring 使用下述語意 relationship keys，不靠浮點座標猜連接。

### 6.2 Endpoint-only snap is sufficient by construction

學生不能改變預設力的 `dx/dy`；新畫線由 semantic endpoint handle 開始，P2/H2/T1 再獨立驗證 origin relationship。因此 snap 只需要比較**被拖動的語意端點**與合法 target endpoint 的螢幕距離：

```js
distanceCssPx(
  screenPoint(candidateSemanticEndpoint),
  screenPoint(targetEndpoint)
)
```

Whole-force drag 保留 pointerdown grab offset；先由 pointer delta 算出 candidate model tail，再量度 candidate tail，不使用 raw pointer client position。Line drag 同樣先更新 candidate authoritative endpoint，再量度該 endpoint。Pointer 只產生位移，永遠不是 snap/scoring endpoint。

不另作角度或線長容差。當預設力 `dx/dy` 不變，或新畫線 origin relationship 已驗證，而且目標終點相同時，方向與長度已被唯一決定。

### 6.3 Snap thresholds

| Pointer type | 吸附距離 | 剛好內／外例子 |
|---|---:|---|
| touch | `20 CSS px` | `19 px` 吸附；`21 px` 不吸附 |
| mouse / pen | `14 CSS px` | `13 px` 吸附；`15 px` 不吸附 |
| keyboard | `12 CSS px` equivalent | 一步後進入範圍即吸附；仍在範圍外不吸附 |

Easy-to-change constants：

- `SNAP_TOUCH_PX = 20`；
- `SNAP_POINTER_PX = 14`；
- `SNAP_KEYBOARD_PX = 12`；
- `MODEL_EPSILON = 0.01 SVG unit`；
- `POSITION_QUANTUM = 0.1 SVG unit`。

比較使用 inclusive `distance <= threshold`。吸附距離在 client CSS pixel space 計算，把 candidate endpoint及target endpoint分別經 SVG screen CTM 投影；不乘 `devicePixelRatio`。此規則確保手機、desktop、CSS transform、viewBox letterboxing及browser zoom有相同手感。不得直接以固定 SVG unit 代替 CSS px。

### 6.4 Drag bounds and clamping

Pointer capture可以在舞台或iframe外收到pointerup，因此所有自由幾何都要有production clamp：

```text
MODEL_VISUAL_INSET = 34 SVG unit
FREE_LINE_INSET = 24 SVG unit

force tail x:
  [MODEL_VISUAL_INSET - min(0, dx),
   760 - MODEL_VISUAL_INSET - max(0, dx)]
force tail y:
  [MODEL_VISUAL_INSET - min(0, dy),
   500 - MODEL_VISUAL_INSET - max(0, dy)]

free line endpoint:
  x = 24..736
  y = 24..476
```

Pointer及keyboard每次 candidate update都走同一 clamp；pointerup 前再 canonicalize一次。Release在舞台外不會產生 decoder 隨後拒絕的 state。Generated snap targets由generator validator保證落在合法 bounds；已snap geometry由relationship重建，不再clamp。Label及44 CSS px overlays在browser layout tests另作可達性驗證。

### 6.5 Snap target rules

- 只在 pointerup／keyboard commit 時正式吸附；pointermove 只顯示接近 target 的中性高亮；
- 如果同時有多個合法 target，選 screen distance 最近者；距離完全相同則使用穩定 key order；
- P 題力箭尾只可吸附到 `O`；
- P1 guide origin固定在指定力箭頭；P2 origin可由中性 handles選擇，但只有 `F1_HEAD/F2_HEAD`各一次是合法 relationship；origin合法且終點接近 `C`才吸附；
- P1 resultant origin固定在 `O`；P2可選其他endpoint作provisional origin，但只有`ORIGIN`可吸附到`C`；
- H/T 第一個力箭尾只可吸附到 `O`；
- H/T 後續力箭尾只可吸附到目前單一路徑的自由箭頭；
- H1 resultant origin固定在 `O`；H2/T1可選其他現有endpoint作provisional origin，但只有`ORIGIN`可吸附到力鏈自由箭頭；
- 不接受箭頭接箭頭、箭尾接箭尾（P 共同起點除外）、分支或循環；
- 放手在閾值外不自動修正，保留學生位置或 provisional endpoint；
- 不顯示 invisible full-answer hit region；只在 endpoint 已足夠接近時吸附。

### 6.6 Canonical snapped geometry and wire authority

成功吸附後不把計算出的double座標寫入wire，而保存compact authoritative relationship。Restore由generator spec及relationship重建exact target coordinates。自由／provisional positions才保存integer tenths，避免三角函數小數、`0.1`量化及`MODEL_EPSILON`互相衝突。

Force placement：

```js
{ mode: "initial" }
{ mode: "free", tail10: [integerX10, integerY10] }
{ mode: "snap", targetKey: "ORIGIN" | "F1_HEAD" | "F2_HEAD" | "F3_HEAD" }
```

Guide/resultant：

```js
{
  originKey: "ORIGIN" | "F1_TAIL" | "F1_HEAD" | "F2_TAIL" | "F2_HEAD" | "F3_TAIL" | "F3_HEAD" | "CORNER",
  end: { mode: "free", point10: [integerX10, integerY10] }
     | { mode: "snap", targetKey: "CORNER" | "CHAIN_END" }
}
```

起點及snapped終點由keys及目前canonical force geometry派生，不重複保存座標。Decoder驗證key白名單、reference存在、force-tail anchor graph唯一、無branch/cycle及prerequisite。Free geometry即使視覺上剛好與target重合，`mode:"free"`仍不會被誤判已吸附；只有production snap transition可以建立`mode:"snap"`。

---

## 7. 視覺及藝術風格

沿用 `fbd-horizontal-block`、`static-kinetic-friction-investigation-lab` 及 shared styles 的安靜實驗工具風格：

- 淺灰 app 背景、白色舞台、清楚 panel 邊界；
- system UI 字體；
- SVG 方格約 40 CSS px；
- 普通力矢量 `5 px`、round line cap、大型箭頭；
- 合力使用 `--force-resultant: #f59e0b`；
- 輔助線使用 slate gray、`stroke-dasharray: 5 5`、`3 px`；
- 作圖起點及未完成 endpoint 使用中性灰，不使用答案顏色；
- `F₁`、`F₂`、`F₃` 使用有色但不對應特定力種類的本地 semantic tokens；
- labels 使用 SVG `<tspan baseline-shift="sub">` 顯示數字下標，不使用 `F_1`；
- 選取中力矢量加外框／光暈，其他力矢量不降至不可讀；
- touch drag 時在離手指最遠的舞台角落顯示固定局部放大鏡，標明目前操作 `F₁/F₂/F₃`；
- 不使用裝飾性插畫、玻璃效果、動畫背景或與作圖無關的顏色；
- `prefers-reduced-motion` 關閉非必要 transition；snap 只用短促 `120–160 ms` 靜態位置過渡或直接定位。

顏色不可成為唯一辨識方式；每支力同時有文字 label，guide/resultant 使用不同線型與 label。

### 7.1 LaTeX-like 數學及物理符號渲染契約

第一版不引入MathJax、KaTeX或其他數學排版dependency；本題沒有分式、根式或大型矩陣，原生semantic HTML、CSS及SVG已足以產生接近LaTeX的結果。不得顯示raw LaTeX source、ASCII underscore notation（例如`F_1`）或把整條公式當普通UI sans-serif文字。

本活動沿用胡克定律活動的`.math-inline/.math-variable/.math-number/.math-unit`原則，並在本activity加入：

```css
:root {
  --math-font: "Cambria Math", "STIX Two Math", "Times New Roman", serif;
}

.math-expression,
.math-svg {
  font-family: var(--math-font);
}

.math-vector {
  font-style: italic;
  font-weight: 700;
}

.math-scalar,
.math-point {
  font-style: italic;
  font-weight: 400;
}

.math-number,
.math-operator,
.math-unit,
.math-subscript-upright {
  font-style: normal;
}
```

Notation固定如下：

| 物理／幾何概念 | LaTeX等價寫法 | 視覺規則 | 學生可見讀法 |
|---|---|---|---|
| 第一、二、三個力矢量 | `\boldsymbol{F}_1`、`\boldsymbol{F}_2`、`\boldsymbol{F}_3` | `F`使用math serif粗斜體；數字下標較細、正體 | 力矢量 F 一／二／三 |
| 合力矢量 | `\boldsymbol{F}_{\mathrm R}` | `F`粗斜體；`R`為較細正體下標 | 合力 F R |
| 力的大小 | `F_1`、`F_2`、`F_3` | `F`一般斜體、不加粗；數字下標正體 | 力的大小 F 一／二／三 |
| 共同起點 | 語意 key `ORIGIN`；坐標由`anchor10`保存 | 不在舞台預先顯示固定字母；handle以「起點」accessible label表示 | 學生所選共同起點 |
| 二力合成 | `\boldsymbol{F}_{\mathrm R}=\boldsymbol{F}_1+\boldsymbol{F}_2` | vectors粗斜體；`=`、`+`正體並有一致間距 | 合力等於力矢量 F 一加力矢量 F 二 |
| 三力合成 | `\boldsymbol{F}_{\mathrm R}=\boldsymbol{F}_1+\boldsymbol{F}_2+\boldsymbol{F}_3` | 同上 | 合力等於三個力矢量之和 |
| 力的SI單位（如review需要） | `N` | 正體，數值與單位之間保留窄空格 | 牛頓 |

「粗斜體」是本活動表示矢量的固定方式，等價於LaTeX的`\boldsymbol{}`；不依賴Unicode combining over-arrow，避免不同系統字體令箭號錯位。箭嘴圖形本身仍表示幾何方向。任何地方若只談大小，必須改用非粗體scalar符號，不能把vector及magnitude排成一樣。

HTML dynamic notation必須由`notation.js`的pure rendering helpers建立，不可在不同render functions手寫不一致markup。例如：

```html
<span class="math-expression" aria-hidden="true">
  <var class="math-vector">F</var><sub class="math-subscript-upright">1</sub>
  <span class="math-operator"> = </span>
  ...
</span>
<span class="sr-only">力矢量 F 一……</span>
```

SVG diagram labels使用同一math font及weight：

```html
<text class="math-svg" role="img" aria-label="力矢量 F 一">
  <tspan class="math-vector">F</tspan>
  <tspan class="math-subscript-upright"
         baseline-shift="sub"
         font-size="70%">1</tspan>
</text>
```

Requirements：

- HTML、SVG、題目文字、按鈕、progress、live region、summary、submitted feedback及correct overlay使用同一notation mapping；
- visible math group對screen reader隱藏時，必須有一段自然語言`.sr-only`等價內容；SVG label直接使用`role="img"`及明確`aria-label`；不可讓screen reader讀出「F underscore one」；
- numeric subscript使用`<sub>`或SVG`tspan baseline-shift="sub"`，不得使用普通baseline細字假扮；
- operators、numbers、upright subscripts及units保持正體；variables/points用斜體；vector symbols用粗斜體；
- formula不可因button的`font:inherit`退回UI sans-serif；focused/selected/disabled狀態亦保持math typography；
- 不以圖片方式渲染公式；文字在200% zoom、high contrast及copy/print context保持清楚；
- 題目editable view只顯示通用關係式，不把隨機題正確方向、第四頂點、合力位置或數值答案寫入formula；
- manifest不加入MathJax/KaTeX；如日後題型需要原生方法不能可靠處理的複雜公式，先更新plan及manifest，再考慮vendored library。

---

## 8. Responsive layout contract

- **Control-panel classification**：`bounded split-panel`。
- **原因**：學生會反覆使用題目進度、提示、undo、reset、navigation 及 submit controls，同時必須持續看見作圖舞台。
- **Phone stage track**：baseline `minmax(14rem, 47vh)`，並以 `47dvh` enhancement；在 `320x500` 或 landscape 可降至 `minmax(12rem, 43dvh)`，但不得建立獨立 stage scroller。
- **Phone layout**：舞台在上；control panel 佔餘下高度並獨立垂直滾動。
- **Desktop/tablet**：舞台在左、panel 在右；舞台保持主要寬度，panel 約 `20rem–24rem`。
- **Activity document invariant**：bounded iframe 內 `html`、`body`、app shell 沒有可用 vertical scroll range；只有 Moodle host 及 control panel 是 normal scroll owners。
- **Extreme height/zoom**：縮小 label、重排進度列、把非主要說明折疊；不可讓舞台成為第三個垂直 scroller。所有主按鈕及 keyboard focus target 必須可達。

使用 `100vh` fallback，再用 `100dvh`；所有會縮小的 grid/flex children 設 `min-height:0`。Panel 使用 `overflow-y:auto` 及 `overscroll-behavior:contain`。

### 8.1 Draggable target inventory

| Target type | Selector／hit-target strategy | Pointer-capture target | Render during drag |
|---|---|---|---|
| `F₁/F₂/F₃` 整支力矢量 | 每支力一個沿shaft全長、cross-axis厚度最少44 CSS px的穩定HTML overlay；覆蓋shaft及label，而非只覆蓋SVG arrowhead | 同一 HTML overlay | overlay保持mounted，只更新transform；不可replace |
| guide起筆 handle | 每個目前顯示的semantic endpoint使用44×44 CSS px HTML button overlay；P1只顯示合法，P2顯示所有相關端點 | 同一 button | 保持mounted；開始畫線不replace |
| provisional guide endpoint | 每條provisional guide一個44×44 CSS px HTML button overlay | 同一 button | 保持mounted；SVG line可更新但capture target不換 |
| snapped guide endpoint | 每條已snap guide仍保留可focus、可重新拖出的44×44 CSS px HTML button overlay | 同一 button | complete/revisit期間保持mounted；拖離時atomic invalidation |
| resultant起筆 handle | 每個目前顯示的semantic endpoint使用44×44 CSS px HTML button overlay | 同一 button | 保持mounted；開始畫線不replace |
| provisional resultant endpoint | 44×44 CSS px HTML button overlay | 同一 button | 保持mounted |
| snapped resultant endpoint | 已完成題仍保留可focus、可重新拖出的44×44 CSS px HTML button overlay | 同一 button | 保持mounted；提交鎖定時在下一gesture前移除owning behavior |

所有 drag targets 在 pointerdown 前已有 `touch-action:none`。SVG `line/path/circle/g` 只作 visual，不是唯一 gesture boundary。

首尾junction必然會令前一力箭頭與後一力箭尾 overlays重疊。Panel固定提供「選擇 F₁／F₂／F₃」segmented controls；選取後把該力overlay提升到active z-layer並明確高亮，然後才拖動。非重疊shaft仍可直接tap選取。只靠固定z-order不算可達；touch、mouse及keyboard都要可以選到每一支力。

### 8.2 Touch gesture ownership matrix

| Touch starts on | Expected owner | Expected scroll delta | Required pointer/state result |
|---|---|---|---|
| 已知非互動舞台空白區 | enclosing page／Moodle host | host 非零且 iframe 同方向移動；activity document、activity viewport、panel 為 0 | 不開始拖動，不改變題目幾何、phase、current question 或 snapshot |
| 獨立滾動 control panel | panel only | panel 有 range 時非零；host、iframe、activity document、host/activity viewport 為 0 | 舞台固定；到 panel top/bottom 仍不 chain 到 host；不改變答案 |
| 任一預設力矢量 overlay，包括重疊junction經selector選取後 | simulation | 所有 host/document/panel/viewport/iframe delta 為 0 | 力矢量整體平移；至少一個 `pointermove`、最後 `pointerup`，沒有 `pointercancel` |
| 任一 guide 起筆、provisional或snapped endpoint handle | simulation | 全部 scroll delta 為 0 | guide 改變；`pointermove` + `pointerup`；沒有 `pointercancel` |
| 任一 resultant 起筆、provisional或snapped endpoint handle | simulation | 全部 scroll delta 為 0 | resultant 改變；`pointermove` + `pointerup`；沒有 `pointercancel` |
| 已提交後原 drag footprint | host／panel 按起始區域正常擁有 | 舞台空白位置由 host 擁有；panel 由 panel 擁有 | 無 overlay 擷取；提交幾何及 suspend data 不變 |

### 8.3 Technical touch decisions

- root stage blank region：`touch-action:pan-y`；
- panel：native vertical scroll + `overscroll-behavior:contain`；
- drag target：pre-pointerdown `touch-action:none`；
- pointer capture target 在 drag 全程 mounted；
- pointercancel 視為取消，rollback 到 pointerdown 前 geometry，不當作成功；
- development source、built/extracted SCORM 及 Moodle-like iframe 使用同一 scroll topology；
- **Production topology decision**：bounded activity document本身零scroll range；非互動blank-stage trusted vertical touch由activity記錄連續`clientY` delta，先驗證`window.parent!==window`且parent可作same-origin access，再只向同一`window.parent`執行`scrollBy(0,deltaY)`；event target若在任何drag handle/interactive control內便不forward。Message不經sibling panel，亦不提供panel fallback；
- direct standalone／new-window沒有parent scroll owner時不forward，blank-stage非零delta只可按規則標N/A；cross-origin parent在第一版不嘗試無驗證`postMessage` bridge，必須使用已驗證的Moodle same-origin launch或先修訂host topology；
- implementation開始前先以最小Moodle-like same-origin iframe spike驗證上述唯一production topology、delta方向、無double-scroll及trusted events；若實際Moodle部署不是same-origin或observable contract失敗，必須停下並修訂本plan，不能在activity UI完成後臨場改為另一owner；
- direct standalone page 真正沒有 enclosing scroll range 時，只有 blank-stage 非零 delta 可標 N/A；Moodle-like iframe test 不可用此例外；
- trusted touch acceptance 必須使用 browser protocol `touchStart/touchMove/touchEnd` 或真機，並assert `event.isTrusted===true`、`pointerType==="touch"`，記錄browser engine及device；不接受 DOM `dispatchEvent`、source/CSS inspection 或 programmatic `scrollTop` 當作 acceptance gesture。

### 8.4 Implementation-before-UI iframe spike evidence

2026-08-15 在正式 activity UI 實作前，以 `output/force-composition-scroll-spike/` 的最小 same-origin Moodle-like iframe host 驗證 §8.3 唯一 production topology。Browser protocol `Input.dispatchTouchEvent` 產生的 gesture 均為 trusted touch；測試環境為 `Chrome/151.0.7922.138`、macOS headless、`390×500` viewport。

- 非互動舞台空白區向上 swipe：parent host `scrollY` 非零、iframe 同方向移動；activity document、activity visual viewport、panel及learner geometry保持不變；forwarding由 trusted `touchmove` 驅動；
- control panel swipe：只有 panel scroll 改變；host、iframe、activity document、host/activity visual viewport及learner geometry保持不變；panel top及bottom boundary均不chain到host；
- pre-pointerdown stable HTML drag target：geometry改變；host、iframe、activity document、panel及visual viewport全為零delta；收到 trusted touch `pointermove`及`pointerup`，沒有`pointercancel`；
- 因此正式activity沿用「bounded inner document零scroll range + blank-stage same-origin parent `scrollBy` forwarding + panel native contained scroll + target-local `touch-action:none`」；不加入cross-origin或sibling-panel fallback。

---

## 9. Keyboard、screen reader 及可用性

- 每支力 overlay 是可 focus button，aria-label 包括力 label、目前箭尾位置及「方向和長度固定，只可平移」；
- focus 力後，方向鍵每次平移 `2 SVG unit`，Shift+方向鍵平移 `10 SVG unit`；進入 keyboard snap threshold 即 canonical snap；
- guide/resultant 起筆 handle 可按 Enter 開始，方向鍵移動 provisional endpoint，Enter commit，Escape rollback；
- 所有 keyboard update 走與 pointer 相同的 model transition、snap、invalidation 及 draft checkpoint；
- `復原上一步`、`重設本題`、題目 navigation 及 submit 全部可鍵盤操作；
- live region 只宣告 semantic event，例如「F₂ 已接到 F₁ 箭頭」、「第一條輔助線已連接」、「本題完成」；不逐 pointermove 報讀；
- 進度按鈕使用可讀名稱：「第 3 題，首尾相接法，未完成」；
- focus 不會因 render 被重設；重新 render 後恢復到同一 semantic target；
- 顏色、線型及文字共同表達矢量／輔助線／合力；
- 200% zoom、320 CSS px width 及 Windows high contrast mode 保持主操作可達；
- touch hit target 最少 44×44 CSS px；重疊時使用panel selector、active z-layer及selected highlight，不能只靠deterministic z-order。

---

## 10. Scoring and feedback

### 10.1 Scoring summary

- **Total**：100
- **Passing threshold**：60
- **Lowest score**：0
- **Highest score**：100
- **Scoring moment**：提交的最終 canonical state；不計 pointer 路徑、重試次數、用時或使用 undo 次數。

五題各 20 分：

| 題型 | Component | 每題分數 |
|---|---|---:|
| P1/P2 | `F₁` 箭尾在共同作圖起點 | 2 |
| P1/P2 | `F₂` 箭尾在共同作圖起點 | 2 |
| P1/P2 | `F₁` 箭頭出發的輔助線終點正確 | 4 |
| P1/P2 | `F₂` 箭頭出發的輔助線終點正確 | 4 |
| P1/P2 | 合力由 `O` 指向 `O+F₁+F₂` | 8 |
| H1/H2 | 任一第一支力的箭尾在 `O` | 4 |
| H1/H2 | 第二支力與第一支力有效首尾相接 | 4 |
| H1/H2 | 合力由力鏈起點指向終點 | 12 |
| T1 | 任一第一支力的箭尾在 `O` | 2 |
| T1 | 第一個由 `O` 出發的有效首尾接點 | 4 |
| T1 | 第二個有效接點並完成三力單一路徑 | 4 |
| T1 | 合力由三力鏈起點指向終點 | 10 |

總計：`20 + 20 + 20 + 20 + 20 = 100`。

### 10.2 Duplicate、extra and invalid geometry

- 預設力不可新增、刪除或複製，因此沒有「全選」得分漏洞；
- P題最多保存兩條guide records；同一origin重畫會取代舊線，decoder拒絕duplicate origin；錯誤origin沒有利益；已有兩條時由學生明確選取、清除或重畫，不暗中新增；
- 錯誤 origin key、分支、循環、同一力重複出現、resultant 起點錯誤均不取得相應 component；
- H/T placement及junction分數只由`O`出發的連續有效chain prefix取得；浮在其他位置的局部head-tail coincidence不得分；
- resultant 不可在必要 arrangement／guides 未完成前存在；stale dependent geometry 在 production transition 中清除，在 decoder 中拒絕；
- provisional geometry 不吸附便不取得該項分數；
- 分數 clamp 到 `0..100`。

### 10.3 Tolerance

Scoring 不直接使用 pointer snap CSS threshold。成功吸附會保存validated semantic relationship；scorer只按`mode:"snap"`、target/origin keys及合法anchor graph給分。`mode:"free"`即使數字座標剛好等於target亦不得分，因此viewport或wire rounding不會改變review分數。`MODEL_EPSILON`只用於generator/model數學不變量，inclusive `error <= 0.01 SVG unit`。

Scorer固定回傳：

```js
{
  score,
  maxScore: 100,
  passed: score >= 60,
  completed: true,
  feedback
}
```

### 10.4 Editable and submitted feedback

提交前只顯示：

- 目前需要做的操作；
- 成功吸附的中性事件；
- 每題完成／未完成；
- 無效操作的技術提示，例如「請由標示的起點開始畫線」；
- 不顯示分數、正確合力 ghost、正確第四頂點或逐項答案。

提交後 feedback 按題說明：共同起點、兩條輔助線、首尾相接及合力有何正確／缺漏；可切換正確作圖 overlay。不能只顯示數字。

---

## 11. Phase/state matrix

### 11.1 Activity-level phases

Production UI 只 render：`practice`、`summary`、`review`。

| Phase | Variant/invariant | Current question | Required semantic state | Must be absent/pristine | Allowed next action |
|---|---|---:|---|---|---|
| `practice` | current question fresh／placing／guides／resultant／complete | integer `0..4` | valid seed/version；五個 valid answers；current question UI 可由唯一 derived status render | pointer drag、DOM refs、undo history 不進 snapshot | edit、reset、navigate、go summary；undo只在transient checkpoint存在時可用 |
| `summary` | one or more incomplete，包括`0/5`完成 | last editable index `0..4` | valid seed/version；五題答案可全部blank/incomplete；completion derived；未瀏覽題不會自動初始化成答案 | active pointer drag、answer overlay、score/result metadata | return to any question or confirm incomplete/fully blank submission |
| `summary` | all complete | last editable index `0..4` | 五題全部 canonical complete | active pointer drag、answer overlay、score/result metadata | return edit or submit |
| `review` | `trusted-match` | not persisted | valid regenerated scenario及submitted answers（可有未完成題）；computed score/pass與saved metadata及Moodle record一致 | editable phase/current、pointer drag、undo、draft-only UI | navigate review questions、toggle post-submit correct overlay |
| `review` | `trust-mismatch` | not persisted | answer snapshot可validate/rescore，但computed、saved或Moodle record不一致 | editable controls、computed feedback、correct overlay、submission claims | show safe recorded Moodle summary；safe navigation/exit only |
| `review` | `unknown-status` | not persisted | answer可validate，但Moodle pass/fail未知 | editable controls、pass/fail claim、computed feedback、correct overlay | show recorded score如可信及indeterminate completion；safe navigation/exit only |
| `review` | `safe-Moodle-fallback` | not persisted | finished attempt但review missing/invalid/stale kind；只信任Moodle fields | answer geometry、computed score、correct overlay、editable controls | safe Moodle summary；navigation/exit only |

`review` 只存在於 review snapshot／finished startup，不是 editable draft phase。Editable snapshot 出現 `review` 要拒絕；finished review snapshot 出現 `practice/summary` 亦拒絕。

### 11.2 P question answer variants

| Variant | Required semantic state | Must be absent | Allowed next action |
|---|---|---|---|
| `fresh` | `F1/F2` placements均為`mode:"initial"` | guides、resultant | translate either force |
| `placing` | 至少一個placement已非initial；未有兩個forces同時`mode:"snap",targetKey:"ORIGIN"` | guides、resultant | continue translating／reset／navigate |
| `guides` | both placements為`mode:"snap",targetKey:"ORIGIN"`；0–2 guide records；**至少一條必要 guide 未 canonical snapped**，records可有P2錯誤origin或provisional endpoint | resultant | draw/edit/clear guide；兩條必要 guides snapped後derived variant立即變`resultant` |
| `resultant` | both placements snapped at `ORIGIN`；兩 guides以正確origin及`end.mode:"snap",targetKey:"CORNER"`完成；resultant為null或合法provisional | stale guide origins、額外 line | draw/edit resultant |
| `complete` | above + resultant canonical snapped | extra/provisional duplicate resultant | revisit；moving upstream clears downstream |

### 11.3 H question answer variants

| Variant | Required semantic state | Must be absent | Allowed next action |
|---|---|---|---|
| `fresh` | both placements為`mode:"initial"` | resultant | translate either force |
| `placing` | 至少一個placement已非initial；anchor graph未形成由`O`出發、使用兩力一次的完整chain | resultant | continue translating／reset／navigate |
| `resultant` | valid two-force chain；resultant null 或合法 provisional | branches、cycles、duplicate force use | draw/edit resultant |
| `complete` | valid chain + canonical snapped resultant | extra resultant | revisit；moving force clears resultant |

### 11.4 T question answer variants

| Variant | Required semantic state | Must be absent | Allowed next action |
|---|---|---|---|
| `fresh` | three placements均為`mode:"initial"` | resultant | translate any force |
| `placing` | anchor graph有zero/one valid junction，或由`O`出發的chain未使用三力 | resultant | extend chain／reposition／reset／navigate |
| `resultant` | valid three-force single path from `O`；兩 junctions；all force keys exactly once；resultant null/provisional | branch、cycle、dangling duplicate、mixed-method guides | draw/edit resultant |
| `complete` | valid chain + canonical snapped resultant | guides、extra resultant | revisit；moving force clears resultant |

### 11.5 Transitions

```text
practice/fresh -> practice/placing
  after a completed vector translation that changes a tail

practice/placing -> practice/guides|resultant
  when the required canonical vector arrangement becomes valid

practice/guides -> practice/resultant
  when both P guides are canonical snapped

practice/resultant -> practice/complete
  when resultant endpoint canonical snaps

practice/complete -> earlier derived variant
  when an upstream vector or guide is moved; dependent geometry is cleared atomically

practice/complete -> practice/resultant
  when snapped resultant endpoint is dragged free

practice/resultant -> practice/guides
  when a snapped guide is dragged free; resultant is cleared in the same command

practice/any -> practice/fresh
  on confirmed reset; reset pre-state remains one undo checkpoint

practice/<derived-after> -> practice/<derived-before>
  on undo of one complete semantic command

practice -> summary
  when learner selects pre-submit check

summary -> practice
  when learner selects a question to edit

summary -> pending final -> review
  through SimScorm.submitWithCallbacks and successful shared lifecycle outcome
```

Pointerdown／pointermove 不改 phase variant；pointerup 或 keyboard commit 才執行 semantic transition及 draft checkpoint。Pointercancel rollback，不建立 continuation。

### 11.6 Locked runtime variants（不是 editable snapshot phases）

| Runtime variant | Answer geometry | Score/completion display | Only legal continuation |
|---|---|---|---|
| `pending-valid` | 顯示已validate的 frozen submitted geometry；不可編輯 | `--`及indeterminate；不可稱已提交／合格／不合格 | retry same immutable pending payload |
| `pending-quarantined` | 不顯示可被誤認為可信的answer review | technical lock only | safe navigation/exit |
| `committed-finish-retry` | 顯示committed locked review | committed result及honest「已記錄，尚待完成連線」 | retry finish only |
| `load-error` | 無 | `--`及technical load error | safe navigation/exit；不得write |

以上variants由shared startup/submission outcome及activity deeper validation派生，不寫成`phase`。每個production-shaped fixture都要執行一個表內合法continuation；沒有retry action的fallback以safe navigation/exit作continuation。

---

## 12. Persistence contract

### 12.1 Authoritative answer shape

V1直接使用以下readable production wire；不得在實作時另創test-only或未記錄的短key schema。若日後要壓縮，必須bump schema version並固定migration/golden fixtures。

```js
{
  schemaVersion: 1,
  generatorVersion: 1,
  seed,                 // uint32
  phase: "practice" | "summary", // draft only
  currentQuestion: 0,   // draft only, 0..4
  answers: [
    {
      type: "parallelogram",
      placements: [
        { mode: "initial" }
          | { mode: "free", tail10: [integerX10, integerY10] }
          | { mode: "snap", targetKey: "ORIGIN" },
        // F2 same union
      ],
      guides: [
        null | {
          originKey: "ORIGIN" | "F1_HEAD" | "F2_HEAD",
          end: { mode: "free", point10: [integerX10, integerY10] }
             | { mode: "snap", targetKey: "CORNER" }
        },
        // second guide slot has the same union; max length is exactly 2
      ],
      resultant: null | {
        originKey: "ORIGIN" | "F1_TAIL" | "F1_HEAD" | "F2_TAIL" | "F2_HEAD" | "CORNER",
        end: { mode: "free", point10: [integerX10, integerY10] }
           | { mode: "snap", targetKey: "CORNER" }
      }
    },
    // P2 same shape
    {
      type: "head-to-tail-2",
      placements: [
        { mode: "initial" }
          | { mode: "free", tail10: [integerX10, integerY10] }
          | { mode: "snap", targetKey: "ORIGIN" | "F1_HEAD" | "F2_HEAD" },
        // second force same union; self-reference is never valid
      ],
      resultant: null | {
        originKey: "ORIGIN" | "F1_TAIL" | "F1_HEAD" | "F2_TAIL" | "F2_HEAD",
        end: { mode: "free", point10: [integerX10, integerY10] }
           | { mode: "snap", targetKey: "CHAIN_END" }
      }
    },
    // H2 same shape
    {
      type: "head-to-tail-3",
      placements: [
        { mode: "initial" }
          | { mode: "free", tail10: [integerX10, integerY10] }
          | { mode: "snap", targetKey: "ORIGIN" | "F1_HEAD" | "F2_HEAD" | "F3_HEAD" },
        // F2/F3 same union; self-reference is never valid
      ],
      resultant: null | {
        originKey: "ORIGIN" | "F1_TAIL" | "F1_HEAD" | "F2_TAIL" | "F2_HEAD" | "F3_TAIL" | "F3_HEAD",
        end: { mode: "free", point10: [integerX10, integerY10] }
           | { mode: "snap", targetKey: "CHAIN_END" }
      }
    }
  ]
}
```

Draft envelope必須有`phase/currentQuestion`；review answer必須完全省略兩fields。Question types and order固定`[P,P,H,H,T]`並與index相符。Force `dx/dy`、initial placements、correct endpoints、question signature、completion status、chain order及score全部由`(generatorVersion,seed)`加saved relationships/free geometry派生，不重複保存。

Integer tenths必須是safe integers；decode時除以10恢復provisional model position。Snap placements不保存tail；snap line ends不保存point。Relationship key與數字座標互斥，mixed form一律拒絕。

Index-specific origin policy亦屬schema invariant：P1 guide origins只接受`F1_HEAD/F2_HEAD`且各一次、resultant只接受`ORIGIN`；P2接受上列extended provisional origins但只有正確origins可snap。H1 resultant只接受`ORIGIN`；H2/T1接受extended provisional origins但只有`ORIGIN`可snap。Decoder不得把P2/H2/T1的較寬union誤套到guided題。

### 12.2 Draft snapshot

```js
SimScorm.makeSnapshot(ACTIVITY, "draft", encodeDraft(state))
```

Draft 保存：seed/version、editable phase、current question 及五題 authoritative relationships/free geometry。每次 force pointerup、line pointerup、keyboard commit、undo、reset、navigation、phase change 後 request draft checkpoint；pointermove 不 commit。

Register `SimScorm.setDraftProvider()`，使 shared lifecycle 在 pagehide 等時機取得最新 in-memory snapshot。活動不得自行加入 pagehide/pageshow 或 raw LMS calls。

Fresh draft的首次commit失敗時不解鎖UI。正常作答中的semantic checkpoint若`saveDraft()`回傳false：保留目前in-memory state及panel navigation，顯示持續可見的「未能儲存最新進度」technical banner及「重試儲存」，並鎖定final submit及清除資料；後續semantic command可繼續更新同一local state及重試，但不得標示「已保存」。只有最新完整draft成功commit後才移除banner及解鎖submit。Reload前必須明示未durable修改可能遺失。

### 12.3 Review snapshot

```js
SimScorm.makeSnapshot(
  ACTIVITY,
  "review",
  encodeReview({ generatorVersion, seed, answers }),
  result
)
```

Review 保存相同 authoritative submitted geometry，但移除 editable `phase/currentQuestion`、undo、focus、pointer、hover、magnifier及 correct-overlay toggle。即使學生提交未完成題，對應 provisional／null geometry 仍要保存，以便重畫及重新評分。

Restore order 固定為：

```text
validate envelope/version
-> regenerate exact five questions from generatorVersion + seed
-> decode and validate authoritative geometry/state dependencies
-> restore submitted answers
-> run activity scorer
-> SimActivityFlow.reviewResult(computed, saved metadata, Moodle attempt)
```

Saved score/pass 只作 comparison metadata，不是權威答案。

Pending-final deeper validation額外要求：`encodeReview(restore(decode(nestedReview)))`必須deep-equal經production canonical normalization後的nested authoritative answer，並且rescore result與payload score/pass相同。只比較aggregate score/pass不足；canonical re-encode不等即`quarantinePending()`。

### 12.4 Persisted vs transient vs derived

Persisted authority：

- schema/generator version；
- seed；
- editable phase/current question；
- 每支力的placement mode、free integer-tenths tail或snap target relationship；
- guide origin relationship key及free integer-tenths endpoint／snap target relationship；
- resultant origin relationship key及free integer-tenths endpoint／snap target relationship。

Transient，永不保存：

- active pointerId、capture target、pointer start/delta；
- pointerdown rollback copy；
- undo history；
- DOM／SVG element refs；
- hover、focus ring、magnifier position；
- current near-snap candidate；
- animation progress；
- post-submit correct-overlay toggle。

Derived and rebuilt：

- force tails from `initial/snap` relationships、heads、lengths、directions；
- question specs及initial positions；
- chain order及junctions；
- fourth vertex/resultant endpoint；
- question variant/completion；
- score、pass、feedback；
- hit-target positions、button enablement、CSS classes；
- generated DOM IDs。

### 12.5 Decoder validation

Decoder 必須拒絕：

- unknown schema/generator version；
- seed 非 uint32；
- wrong question count/order/type；
- free positions不是safe integer tenths，或decode後超出與UI clamp完全相同的hard geometry bounds；
- relationship mode同時帶數字座標，或free mode同時帶target key；
- snap self-reference、dangling target、multiple children、branch或cycle；H/T完整chain不是恰好一個`ORIGIN` root，或P guide/resultant階段不是恰好兩力都以`ORIGIN`為共同起點；
- invalid／duplicate guide origin keys；
- P guides 在共同起點 arrangement 成立前存在；
- P resultant 在兩 guides canonical snapped 前存在；
- H/T resultant 在完整 canonical chain 前存在；
- stale dependent geometry；
- branch、cycle、duplicate force key、wrong `ORIGIN` relationship；
- production UI 不可 render 的 phase/currentQuestion 組合；
- draft 使用 review-only data，或 review 帶 editable phase；
- snapshot 超過 4000 UTF-8 bytes。

Generated DOM IDs 不進 wire；若 future wire 含未知 generated ID，decoder 忽略而非把它當 authoritative relationship。`originKey/targetKey` 是 authoritative relationship keys，必須白名單、uniqueness及referential-integrity驗證。每一個production semantic transition完成後，development/test invariant立即執行production encode/decode；UI可保存state不得被同版decoder拒絕。

### 12.6 Round-trip invariants

每個 matrix row／question variant 都要證明：

```text
score(original) === score(restore(encode(original)))
derivedVariant(original) === derivedVariant(restored)
legalNextAction(original) === legalNextAction(restored)
```

並在 restore 後實際執行一個合法 continuation，例如：移動下一支力、完成一條 guide、畫 resultant、由 summary 返回 edit。

Representative maximum draft/review/pending-final全部使用exact production encoder及shared runtime pending shape：

```js
SimScorm.snapshotBytes(maxDraft) <= 4000
SimScorm.snapshotBytes(maxReview) <= 4000
SimScorm.snapshotBytes(maxPendingFinal) <= 4000
```

`maxPendingFinal`包括escaped `reviewJson`、score、maxScore及passed；fixture要包含最多provisional geometry、最大正負integer-tenths位數及Traditional Chinese UTF-8 feedback/envelope metadata。只驗inner review JSON不足以通過submission preflight。

### 12.7 Invalid snapshot policy

- **Finished invalid review**：attempt 保持鎖定，只顯示可信 Moodle summary；不可變回 editable；
- **Structurally valid pending-final，但 deeper geometry decode/rescore 失敗**：先 `SimScorm.quarantinePending()`，再顯示 technical lock；
- **Pending-final nested review可validate，但canonical authoritative answer與immutable pending expectation不一致**：即使aggregate score/pass相同亦必須quarantine；
- **Pending-final valid**：保持 frozen，只 retry 相同 immutable payload；
- **Editable invalid draft**：先鎖定並顯示「練習資料無法載入」；只在學生明確按「清除損壞資料並重新開始」後，以 shared runtime 寫入新的 fresh draft 成功，才可建立新 seed 及解鎖；
- **Load/read error**：鎖定所有 unsafe actions，不清除資料、不寫新 draft、不聲稱已提交／合格／不合格。

---

## 13. Shared SCORM lifecycle

Startup：

```js
const attempt = SimScorm.loadAttempt(ACTIVITY);
const startupState = SimActivityFlow.startup(attempt);
```

| Outcome | Editable? | Learner-facing behavior |
|---|---:|---|
| `review` | No | validate、regenerate、restore、rescore；按trusted/mismatch/unknown/fallback variant顯示locked review或safe Moodle summary |
| `editable` | Yes | valid draft先restore及register provider；fresh attempt先成功commit完整fresh draft，然後才unlock UI |
| `frozen` | No | validate nested review及canonical answer equality後 retry same payload；狀態未確認 |
| `load-error` | No | technical lock；不顯示 score/pass/fail claim |

Submission 只由 summary 進入：

```js
SimScorm.submitWithCallbacks(result, reviewSnapshot, {
  onSuccess: handleSubmissionOutcome,
  onFailure: handleSubmissionOutcome
});
```

兩個 callback 都交 `SimActivityFlow.submission()`，處理：

| Outcome | Editable? | UI |
|---|---:|---|
| `success` | No | submitted review-only |
| `committed` | No | result committed、attempt locked；可 retry finish |
| `frozen` | No | pending/unconfirmed；不顯示 score/pass/fail；只 retry same payload |
| retryable `retry` | Yes | 返回 summary/editable，可重試；不可稱已提交 |
| non-retryable `retry` | No | technical error；不承諾重試 |

同一 attempt final 後移除所有 drag ownership、undo/reset/submit actions。正常draft save失敗走§12.2的unsaved technical policy。不得加入活動本地 LMSGet/Set/Commit/Finish、pagehide、BFCache retry 或 pending-final 邏輯。

---

## 14. Runtime responsibilities

### `generator.js`

- seeded PRNG；
- immutable version registry、golden fixtures及versioned question generation；
- 基礎／進階 constraint validators；
- initial placement solver；
- bounded fallback templates；
- canonical signatures。

### `notation.js`

- pure notation token／DOM specification helpers；
- HTML及SVG共用的vector、scalar、point、operator、subscript及unit mapping；
- `F₁/F₂/F₃`、合力`F`下標`R`及二／三力合成式；
- visible math及Traditional Chinese accessible label成對輸出；
- 不讀SCORM、pointer、question answer或viewport；
- 不接受raw HTML string injection；由安全DOM APIs建立elements／attributes。

### `model.js`

- immutable vector math；
- whole-vector translation；
- screen-space endpoint snap candidate selection；
- chain／parallelogram relationship validation；
- guide/resultant transitions；
- upstream invalidation；
- question derived variants；
- keyboard/pointer 共用 semantic transitions。

### `scoring.js`

- pure final-state scorer；
- 五題 components；
- `0..100` clamp；
- Traditional Chinese submitted feedback；
- 不讀 DOM／SCORM／viewport。

### `persistence.js`

- draft/review encode/decode；
- matrix/dependency validation；
- regenerate scenario and restore；
- relationship key validation；
- snapshot byte checks；
- invalid pending canonical answer comparison helpers。

### `ui-runtime.js`

- shared startup/submission outcome到 honest UI state 的 mapping；
- editable/summary/review controls policy；
- technical/frozen/committed/retry labels；
- focus restoration及post-submit ownership removal；
- functions 必須可由 Node tests 直接執行，不以 source string assertions 代替。

### `main.js`

- DOM wiring／render；
- 所有dynamic物理符號及公式經`notation.js`建立，不手寫分叉markup；
- stable HTML drag overlays；
- pointer capture及rollback；
- keyboard events／ARIA announcements；
- navigation／undo in-memory stack；
- draft checkpoint requests；
- shared SCORM lifecycle glue。

### `styles.css`

- shared token extensions；
- local math font及vector/scalar/operator/subscript/unit typography；
- bounded split-panel；
- SVG visual style；
- stable overlays、focus、selected、magnifier；
- responsive／zoom／reduced-motion rules。

---

## 15. Test plan

### 15.1 Generator

- [ ] immutable `GENERATORS` registry；相同version/seed產生完全相同五題及初始位置；
- [ ] v1 golden specs/signatures及forced-fallback fixture在最新build保持不變；舊v1 production snapshot可restore；
- [ ] 10,000 seeds 全部 bounded completion；
- [ ] P/H角度`30..150°`且不等於`90°`；
- [ ] boundary `30/85/95/150°` 接受；`25/90/155°` 拒絕；
- [ ] 力長、比例、合力長度符合範圍；
- [ ] 四條基礎題 signature 不重複；
- [ ] T1 pairwise `25..155°`、無`90°`、非零合力及所有permutation完整shaft/arrowhead/label fit；
- [ ] initial visual geometry不重疊、不預先吸附；
- [ ] forced fallback 仍通過同一 validator；
- [ ] 跨seeds套題variation達門檻；合法方向/長度級別有樣本；normal fallback rate <1%。

### 15.2 Notation and math rendering

- [ ] `notation.test.js`驗證vector/scalar/point/operator/number/subscript/unit token mapping；
- [ ] `F₁/F₂/F₃`及合力`F`下標`R`在HTML與SVG使用相同math family、粗斜體vector及正體下標；
- [ ] scalar force magnitude不是粗體；vector及magnitude的DOM/class contract可區分；
- [ ] 二力及三力合成式visual tokens順序、operators及spacing固定；不輸出raw `F_1`或raw LaTeX source；
- [ ] HTML visual group有自然語言`.sr-only`等價；SVG有`role="img"`及正確Traditional Chinese `aria-label`；
- [ ] buttons、progress、live region、summary、submitted feedback及correct overlay全部走同一helper；
- [ ] 200% zoom、high contrast、selected/focus/disabled狀態仍保持math font、斜體／粗體及下標位置；
- [ ] editable DOM/accessibility tree沒有由notation renderer洩漏隨機正確方向、第四頂點或合力位置；
- [ ] source及manifest沒有MathJax/KaTeX/CDN dependency。

### 15.3 Model and snap

- [ ] 任意 translation 後 `dx/dy/length/direction` 不變；
- [ ] UI transition 沒有 resize/rotate path；
- [ ] P tails 只吸附 `O`；
- [ ] H/T 只接受合法 free chain head；
- [ ] 六種 T1 orders 得同一 resultant endpoint；
- [ ] 分支、循環、錯誤 endpoint 不吸附；
- [ ] touch 19 px snap、21 px不 snap；mouse 13 px snap、15 px不 snap；
- [ ] inclusive threshold boundary；screen CTM scaling、CSS transform、zoom、letterboxing後CSS threshold不變且不乘devicePixelRatio；
- [ ] 分別抓tail、shaft中段、arrowhead、label，candidate semantic tail一致；raw pointer不參與snap；
- [ ] nearest valid target及stable tie-break；
- [ ] P1/H1 fixed legal origin；P2/H2/T1錯誤origin可provisional但不可snap；endpoint-only validation；
- [ ] relationship snap重建exact coordinates；free座標即使重合亦不當snap；
- [ ] force/line clamp在四邊、pointerup outside iframe及keyboard路徑一致，立即encode/decode合法；
- [ ] pointercancel rollback；
- [ ] moving upstream atomically clears dependent geometry；
- [ ] undo恢復完整pre-state，包括被invalidation清除的guides/resultant；reset可undo；
- [ ] keyboard走相同 transition及snap。

### 15.4 Scoring

- [ ] P每項`2+2+4+4+8=20`；
- [ ] H每項`4+4+12=20`；
- [ ] T每項`2+4+4+10=20`；
- [ ] all correct = 100；all blank = 0；
- [ ] incomplete/provisional components only earn canonical completed points；
- [ ] H reversed order及 T all six orders同分；
- [ ] branch/cycle/stale result及floating junction不得分；只計由`O`出發的continuous prefix；
- [ ] semantic snap relationships計分；free geometry重合不得分；generator math使用inclusive model epsilon；
- [ ] score clamp、pass threshold 60；
- [ ] feedback說明具體作圖缺漏。

### 15.5 Persistence matrix

每一 saveable variant 留 production-shaped fixture：

- [ ] P fresh／placing／guides 0,1及2條但至少一條未snap／兩guide snapped的resultant null或provisional／complete；variants互斥；
- [ ] H fresh／placing／resultant provisional／complete，兩種 chain order；
- [ ] T fresh／placing 0/1 junction／resultant provisional／complete及六種 order；
- [ ] activity practice every currentQuestion、summary incomplete、summary complete；
- [ ] 每 fixture encode/decode/restore round-trip；
- [ ] score及derived variant相同；
- [ ] restore 後執行一個 legal continuation；
- [ ] exact production max draft/review/pending-final envelopes全部<=4000 bytes；
- [ ] seed reload重現同一題，fresh new seed才改題。
- [ ] 每個production transition產生的state立即通過production encode/decode；
- [ ] fresh seed在首次draft commit成功前UI locked；首次及正常checkpoint save failure走不同technical policy。

Invalid matrix：

- [ ] wrong versions/seed/type/order/count；
- [ ] non-safe integer tenths/out-of-bounds/mixed free+snap representation；
- [ ] guides before common origin；
- [ ] resultant before prerequisites；
- [ ] duplicate/invalid/dangling/self relationship keys及multiple roots/children；
- [ ] branch/cycle/stale downstream；
- [ ] unrenderable phase/current；
- [ ] draft/review field contamination；
- [ ] finished invalid review locked；editable invalid draft clear-before-restart；
- [ ] invalid nested pending calls quarantine；authoritative answer被改但aggregate score/pass相同亦quarantine。

### 15.6 Lifecycle and UI policy

- [ ] startup `review/editable/frozen/load-error`；
- [ ] submission `success/committed/frozen/retryable retry/non-retryable retry`；
- [ ] review `trusted-match/trust-mismatch/unknown-status/safe-Moodle-fallback`；
- [ ] locked runtime `pending-valid/pending-quarantined/committed-finish-retry/load-error`及表列legal continuation；
- [ ] technical states show `--` and indeterminate completion，不稱 submitted/pass/fail；
- [ ] same-page final outcome立即移除所有 drag ownership；
- [ ] final review cannot edit/resubmit；
- [ ] fresh draft成功commit後P1–T1五個progress buttons同時enabled；可由P1直接跳T1、由任何part跳到任何題，答案互不清除；
- [ ] `0/5` completed可進summary並確認提交；五個blank answers保持null/initial、score=0，系統不auto-fill亦不以未瀏覽阻擋submission；
- [ ] `1/5`、只做單一part及任意skip組合均可submit，未作答component計0；
- [ ] actual production outcome/render functions tested，不用 source-string checks。

### 15.7 Accessibility

- [ ] all drag targets可 focus並有可讀 aria-label；
- [ ] arrow keys及Shift step；Enter/Escape line workflow；
- [ ] semantic live announcements不 spam；
- [ ] focus survives render；
- [ ] 44×44 targets及相鄰 target selection；
- [ ] junction重疊時panel selector、active z-layer及keyboard可選每一支力；
- [ ] non-color distinctions；
- [ ] 200% zoom及high contrast；
- [ ] reduced motion。

### 15.8 Responsive and trusted touch

- [ ] `320x500`、`390x500`、`390x600`、normal portrait、landscape、browser toolbar change、software keyboard及200% zoom可達 panel bottom和主要 actions；
- [ ] bounded `html/body/app shell` 無 vertical scroll range；
- [ ] Moodle-like host 有 range並離 boundary；記錄 host scroll、host visual viewport、iframe rect、activity document scroll、activity visual viewport、panel scroll及learner state；
- [ ] implementation前iframe spike選定並記錄唯一production host-scroll topology；
- [ ] blank stage trusted swipe兩方向只移動 host/iframe；
- [ ] panel trusted swipe只移動 panel，並在 top/bottom boundary 不 chain；
- [ ] trusted events assert `isTrusted===true`、`pointerType==="touch"`並記錄engine/device；
- [ ] 每個`F₁/F₂/F₃` overlay，包括junction重疊經selector選取後，各自trusted drag；geometry改變、所有scroll delta=0、pointermove+pointerup、no pointercancel；
- [ ] guide/resultant start、provisional endpoint及snapped endpoint各自trusted drag通過同一contract；
- [ ] T1六種排列全部有browser flow；input matrix至少各兩種次序用touch/mouse/keyboard，並選一個seed以三種input重做同一次序；
- [ ] final lock後 former footprints不再擷取；
- [ ] development source及built/extracted SCORM完整重跑；
- [ ] Moodle real phone current-window及new-window（如提供）另作 Moodle-ready evidence。

### 15.9 Package

- [ ] 新 tests 全部加入 `tools/run-tests.js`；
- [ ] `sim/config.js` metadata完整且 folder唯一；
- [ ] manifest exact inventory：`config.js`、`shared/styles.css`、`shared/scorm.js`、`shared/activity-flow.js`、activity `index.html/styles.css/generator.js/notation.js/model.js/scoring.js/persistence.js/ui-runtime.js/main.js`；tests/tools不得入ZIP；
- [ ] `npm run check`；
- [ ] `npm test`；
- [ ] `npm run package -- force-composition-construction-lab`；
- [ ] `npm run package:all`；
- [ ] `git diff --check origin/main...HEAD`；
- [ ] ZIP root有 `imsmanifest.xml`，無 tests／temporary files；
- [ ] extracted package launch及browser smoke；
- [ ] built artifact完整 trusted-touch matrix。

---

## 16. Package-ready checklist

- [x] 五題流程、隨機約束及三力單一方法已按本 plan 實作；
- [x] 學生只能平移預設力，任何 code path 都不能改 `dx/dy`；
- [x] endpoint-only snap由固定矢量geometry、validated origin relationship及semantic endpoint計算保證正確；
- [x] editable view沒有 ghost answer或正確 endpoint overlay；
- [x] HTML/SVG/controls/review使用同一LaTeX-like notation contract；vector粗斜體、scalar斜體、下標/數字/operators/units正體，並有自然語言accessible equivalent；
- [x] 五題可自由返回，draft reload不換題不丟答案；
- [x] P1–T1由UI解鎖起全部可直接跳轉；`0/5`完成亦可提交且五題空白計0分；
- [x] 每個 phase/variant round-trip及legal continuation通過；
- [x] invalid state fail closed；
- [x] shared lifecycle全部 outcomes有誠實 UI；
- [x] mobile bounded split-panel及完整 touch matrix通過 source + built artifact；
- [x] keyboard、automated screen-reader semantics及zoom/responsive contracts通過；真人AT及真機另列Moodle-ready；
- [x] scoring、manifest、catalogue、tests及package gates通過；
- [x] draft、review及pending-final envelopes全部<=4000 bytes；
- [x] formative trust boundary已記錄。

## 17. Moodle-ready checklist

- [ ] 以學生帳戶上載及完成 SCORM 1.2；
- [ ] fresh attempt隨機抽題；同一 draft resume題目不變；新 attempt重新抽題；
- [ ] 提交記錄 score/status；
- [ ] pending retry使用同一 immutable payload；
- [ ] completed attempt重入只可 review；
- [ ] Moodle設定的新 attempt policy符合老師要求；
- [ ] 真機 current-window及new-window（如提供）完整 touch matrix；
- [ ] Moodle evidence與local package-ready evidence分開記錄。

---

## 18. Definition of Done

第一版只有在以下全部成立時完成：

1. 每個 attempt 生成五題符合角度、長度、可見範圍及非退化約束的題目；
2. 兩題平行四邊形、兩題兩力首尾相接及一題三力首尾相接均可完整操作；
3. 所有預設力只能平移，大小及方向永遠不變；
4. endpoint snap不會把明顯錯誤操作自動修正；
5. 六種三力排列都可作答及取得相同正確合力；
6. score、feedback、persistence及review可由authoritative geometry重建；
7. 每個 persisted matrix variant round-trip後可執行同一 legal continuation；
8. corrupt、pending、finished及load-error state全部fail closed並使用誠實文案；
9. 手機、鍵盤、screen reader、trusted touch及built SCORM tests通過；
10. 所有學生可見物理符號符合LaTeX-like notation及accessible reading contract；
11. 五題沒有prerequisite，可任意跳轉，亦可在`0/5`完成時提交；
12. package及Moodle gates完成。

目前交付界線以 **package-ready** 為完成；第 12 項的本地／package gates 已完成，真實 Moodle、真人 screen reader 及實體手機 gates 按產品決定保留在 §17，不能由本地證據冒充。

---

## 19. 雙重對抗審查及修訂紀錄

初稿完成後由兩個獨立 reviewer 只讀審查，沒有 reviewer 直接修改檔案：

1. **物理／教學 reviewer**：檢查力的物理語境、香港繁中用字、五題遞進、隨機題約束、endpoint-only snap、鷹架及部分分；
2. **Production red-team reviewer**：對照 shared plan/template/SCORM guide，挑戰 generator version、phase matrix、snapshot authority、pending-final、undo、touch ownership及package tests。

兩份 review 均判定沒有 P0；本版已採納的主要 P1/P2 修正：

- 明確限定為同一質點的力矢量作圖，不把圖示平移誤說成真實剛體作用點可任意搬動；
- 基礎題只排除近同向、近反向及完全 `90°`，接受 `85°/95°`；
- P1/H1保留guided handles，P2/H2/T1要求學生自行選擇中性endpoint handle；
- snap比較candidate semantic tail/line endpoint，不比較raw pointer；
- H/T scoring拆出由`O`出發的continuous-prefix部分分；
- generator改為immutable version registry、golden fixtures，fresh seed成功commit後才解鎖；
- snapped state改存`mode/targetKey` relationship，free state只存integer tenths，消除浮點重載歧義；
- 增加drag clamp、互斥P variants、review/runtime locked variants、atomic undo及production transition round-trip invariant；
- 4,000-byte gate擴至escaped pending-final envelope及canonical nested-answer equality；
- 補齊snapped endpoint inventory、junction overlap selector及唯一same-origin host-forwarding topology；
- manifest exact inventory、六種三力browser flow、distribution sanity及trusted-event assertions加入test plan。

保留不改的核心決定：五題結構、三力第一版只用首尾相接法、六種三力排列全部接受、預設力大小／方向不可改、學生任意選共同起點、screen-space snap、final-state scoring、submitted lock及formative trust boundary。

其後按產品要求再補充兩項硬性契約：原生HTML/CSS/SVG的LaTeX-like物理符號渲染（不引入MathJax），以及P1–T1全程無順序鎖、包括`0/5`完成仍可提交。

---

## 20. Implementation evidence（2026-08-15）

- 分支：`codex/force-composition-construction-lab`；catalogue狀態已在全部package-ready gates通過後改為`active`。
- iframe spike：Chrome 151、`390×500`、same-origin parent scroll forwarding；blank stage只移動host，panel及drag owner矩陣通過，production使用同一拓撲。
- generator/model/scoring/persistence：10,000 seeds、immutable golden fixtures、五題完整規格、六種T1排列、phase/variant round-trip、invalid-state matrix及4,000-byte envelopes全部通過。
- production browser regression：development source及extracted SCORM package均通過五題mouse滿分、`0/5`提交、iframe draft reload、T1六排列（mouse/touch/keyboard）、trusted host/panel ownership、每個force/guide/resultant target、load-error及invalid-finished fail-closed。
- 全專案 gates：`npm test`、`npm run check`、單一活動package及`npm run package:all`全部通過；ZIP root有`imsmanifest.xml`，共14 files，manifest與HTML runtime dependency exact parity，無tests或temporary files。
- 視覺QA：`1280×800`及`390×600` source screenshots已檢視；desktop split-panel及mobile stage-top/control-bottom層級、文字、物理符號及可達控制沒有發現阻塞問題。
- 未冒充的外部證據：§17真實Moodle學生帳戶、current/new-window真機、Moodle attempt policy及真人screen-reader操作仍未執行，維持unchecked。

## 21. User-requested visual and anchor revision（2026-08-15）

- 預設力的 HTML drag hit target 保留觸控所需的尺寸，但取消長條大圈、持續外框、大型 `box-shadow` 及拖動後的整箭虛線圈；透明 hit target 不再製造干擾性高亮。
- 移除舞台中央 `O` 點及其標籤。第一支力在任意合法可見位置放手後，production state 以 `anchor10` 保存該共同起點；wire-level `ORIGIN` 只代表「所選共同起點」的語意關係，不再代表固定坐標。
- 平行四邊形第四頂點、首尾力鏈終點、合力 snap、review correct overlay及保存驗證均由該 `anchor10` 重建；舊有沒有`anchor10`的狀態仍以 legacy fallback 讀取，避免不必要地破壞既有 draft。
- targeted evidence：model／persistence／scoring／lifecycle／accessibility tests通過；Playwright smoke 以非中央位置建立`anchor10=[3315,2263]`，drag target的`boxShadow`為`none`、border為透明。
- 移除舞台上可見的 near-snap 圓圈、端點圓形操作器及控制面板 F1／F2 選擇按鈕；保留透明的 44px 觸控／鍵盤 hit target，避免干擾作圖視覺。
- 平行四邊形題的兩力可只移動其中一力；當其箭尾接近另一支靜止力的箭尾時，兩力會共同吸附到該位置並建立 `anchor10`，不要求兩支力都先移動。
- 輔助線由方向吸附：F1/F2 箭頭端點的線段只要接近對邊方向（10° 內）便保存為 `targetKey: "PARALLEL"`，保留學生實際拉出的線長，不再強制終點落在第四頂點。
- 力矢量標籤以方向法線、舞台邊界及既有標籤碰撞作候選位置評分，按每支力的方向自動避開箭身及互相重疊；拖動焦點不再以大型虛線圈包住整支箭。

## 22. 即時吸附及可錯誤作答的合力模式（2026-08-15）

- 力、輔助線及合力均在 pointer／keyboard 拖動尚未放手時套用 snap preview；離開吸附距離或方向時即時還原自由預覽，放手只提交當刻狀態。
- 平行四邊形題在兩支力已共同起點且兩條輔助線均已畫出的情況下，控制面板顯示「開始畫合力（鎖定前面作圖）」；進入後移除 F1/F2 及輔助線 hit target，只保留合力作圖。
- 合力模式接受任意可用端點、舞台空白位置及任意終點，保留錯誤方向／起點；`canonicalResultant`及 scoring 仍只把正確共同起點至對角頂點計為完整，錯誤作答可保存、重載及檢視。

## 23. 箭嘴、力名及合力雙端編輯（2026-08-15）

- 箭矢改用與 `fbd-horizontal-block` 一致的 SVG `<marker>` 箭頭定義；`refX` 讓箭頭尖端與線段端點連續，並分開處理三種力、合力及 review 正確作圖顏色。
- `F_1`、`F_2`、`F_3` 及 `F_R` 標籤改用較短法線距離、置中錨點及碰撞／邊界候選評分，避免離力線過遠或落在箭身上。
- 合力畫出後仍可留在合力模式，新增透明的合力起點及終點 hit target；兩端都可在 pointer／keyboard 拖動期間即時預覽並吸附。
- 平行四邊形合力兩端的 snap targets 是四個角：共同起點、`F_1` 箭頭、`F_2` 箭頭及第四頂點。未貼近角時，起點以 `FREE + originPoint10` 保存，故錯誤答案不會被自動改正；端點自由位置亦保留。
- persistence 驗證擴展至自由合力起點及四角端點，`canonicalResultant` 仍只把共同起點至第四頂點的正確對角線計為完成。
- 平行四邊形合力模式的空白舞台 pointer drag 可建立 `FREE + originPoint10` 起點；進入該模式後暫停 host-forwarding，避免學生畫合力時被頁面捲動搶走手勢。

## 24. 手機舞台縮放及合力整體平移（2026-08-16）

- 保留 760×500 物理模型座標及 scoring／保存語意；手機窄舞台按目前作圖幾何建立 camera viewBox，縮小必要留白，讓兩支力在 portrait stage 仍有足夠可拖動及畫線的實際尺寸；desktop／較寬 tablet 保留完整模型視窗，避免力矢量過度放大或裁切。
- 合力線身新增透明 `resultant-hit` 操作層；pointer／keyboard 拖動整條線會以同一位移量更新起點和終點，方向及長度保持不變，移動期間仍可按平行四邊形四角即時吸附；未吸附的位置以 `FREE + originPoint10` 保存，首尾相接題亦可保存自由起點及自由終點。
- 新增合力平移的 model／persistence round-trip 覆蓋，並以手機尺寸實際瀏覽器流程檢查 responsive viewBox、合力線身 hit target 及端點位移。

## 25. 力符號避讓箭線（2026-08-16）

- `F_1`、`F_2`、`F_3` 及 `F_R` 標籤由固定中點偏移改為候選位置評分：候選會避開整段箭線／虛線／合力線、其他標籤及 camera 邊界，並保留小幅清晰間距。
- 以線段與標籤矩形的交疊／距離檢查取代只比較標籤中心點，避免斜向或短箭線穿過符號框；手機及 desktop screenshot 均確認符號不壓住箭線且沒有過度遠離。

## 26. 標籤近距離及合力避讓修訂（2026-08-16）

- 標籤碰撞框按 SVG 字形的實際 baseline 及可見尺寸校準，不再以過大的固定框把符號推離箭線；正常候選先放在箭線中點兩側的最近安全距離。
- 候選位置增加小幅沿箭線方向的滑移，以及必要時的第二層法線距離；因此合力接近直立、而 `F_2` 或虛線從旁邊穿過時，`F_R` 會優先移到最近的清晰位置，避免與其他力名或箭線重疊。
- 標籤排序仍以「不出界、不撞其他標籤、不穿過任何作圖線」為硬性條件，再以距離作次序；沒有改動力的大小、方向、吸附、評分或保存語意。

## 27. 吸附端點與箭頭尖端對齊（2026-08-16）

- 力箭頭及合力改用單一 SVG `<path>` 整體幾何，將箭身、箭頭基部及尖端畫在同一個填色形狀內；箭頭尖端座標直接等於模型線段端點，不再由 `<line>` 疊加 marker。
- 箭頭長度、寬度及短向量縮放只屬於視覺繪製參數，保留模型中的端點、吸附距離、向量大小／方向及評分語意不變。

## 28. 首尾連接法首次吸附雙向一致（2026-08-16）

- 首個被移動的力若接近另一支尚未放置力的箭頭，兩力會即時以「另一支力為鏈根、正在移動的力接到其箭頭」保存；不再只支援先移動某一固定力的方向。
- H1、H2 及 T1 的首次吸附因此支援任意力先行，後續力仍只會吸附到目前力鏈最後一個箭頭；滑鼠、觸控及鍵盤共用相同端點關係及 snap 閾值。
- 新增 reverse-first model coverage，並把 H1/H2 production mouse flow 改為相反次序；完整 source/package browser regression 仍通過。

## 29. 首尾連接法與合力模式統一（2026-08-16）

- 首尾連接法及三力題不再顯示連接位置的裝飾圓點；端點關係只以箭頭／透明 hit target 表達，視覺風格與平行四邊形題一致。
- 五題共用同一個「開始畫合力（鎖定前面作圖）」按鈕契約：前置力／輔助線未完成時按鈕仍顯示但 disabled；解鎖後進入合力模式，力矢量及輔助線不可再移動，按鈕可返回修改模式。
- H1、H2、T1 合力模式接受舞台空白或任一力的箭尾／箭頭作為起點，終點亦可自由繪畫；兩端可在 pointer／keyboard 拖動時即時吸附到任一力端點或鏈尾，並保留錯誤方向／錯誤端點供學生修改。
- persistence 接受上述首尾題自由／吸附端點，但 `canonicalResultant` 及 scoring 仍只把由共同起點至正確鏈尾的合力計為完成；錯誤作答不會被 UI 自動修正。
- pointer 完成作圖後保留 control panel 原有 scrollTop，避免新增「清除輔助線」或合力控制項造成手機拖動期間面板跳動；source 與 extracted SCORM trusted-touch matrix 均通過。

## 30. H1／H2 首尾端點吸附雙向完整（2026-08-16）

- H1／H2 的 force drag 不再只比較「移動力箭尾 → 另一力箭頭」；亦比較「移動力箭頭 → 另一力箭尾」的候選位置。
- 四種組合均即時吸附：F1 尾→F2 頭、F2 尾→F1 頭、F1 頭→F2 尾、F2 頭→F1 尾。後兩種會把移動力建立為鏈根，再把另一力接到移動力箭頭，保存的仍是既有 canonical `ORIGIN`／`F*_HEAD` relationship，不增加不兼容的 wire shape。
- H1／H2 已建立鏈後重新拖動時，頭→尾吸附會正確重設兩力根次序；T1 維持只接受不會產生 branch 的尾→頭接續。
- 新增 model 四向 endpoint cases、已建立鏈 re-root case，以及 source／extracted SCORM browser mouse flow；兩個活動題目均確認四種方向一致。
