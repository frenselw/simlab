# 位置—時間圖運動實驗室：程序化隨機題目計劃

## 1. 文件狀態

- Activity slug：`position-time-graph-motion-lab`
- 本文件性質：現有活動的第二代題目生成、持久化及重做設計
- 實作狀態：production、unit、persistence、package及browser gate已實作；待真實Moodle student attempts驗收
- 基礎文件：
  - `plans/10-position-time-graph-motion-lab.md`
  - `plans/00-shared-platform-and-style.md`
  - `docs/simulation-scorm-production-guide.md`
- 評估風險：`low-risk graded`
- Runtime 原則：維持純 HTML、CSS、JavaScript；不新增 framework 或第三方 runtime dependency

本計劃取代新 attempt 使用 `alpha`／`beta`／`gamma` 三套固定題目的做法，但不在未確認
舊 attempt 相容策略前刪除 version 1 題庫。

## 2. 目的

每個新的 Moodle attempt 都要產生一份高隨機度但可驗證的五題題目。五個任務不再綁定於
少量固定 scenario sets，而是由五個獨立、有限、受約束的候選池生成。

設計必須同時保證：

1. 不同學生或不同新 attempt 抽到完全相同五題的機率極低；
2. 同一 attempt 重新整理、關閉後恢復或隔日再入時，題目及答案不變；
3. 已完成 attempt 保持鎖定，只作檢討，不在原 attempt 內重新抽題；
4. Moodle 建立第二個新 attempt 時，活動建立新的隨機 seed 及五題；
5. 所有數字都在 UI 控制步距、SVG 範圍、計分容差及學生可讀精度內；
6. 任務 5 每題都確實有多個可由 UI 建立的非重合解；
7. 題目參數會保存至 draft、pending-final 及 review，足以恢復、重畫及重算；
8. 任何被竄改、損壞或不合理的 generated scenario 都 fail closed；
9. snapshot 經 shared SCORM 包裝後仍低於 4000 UTF-8 bytes；
10. 舊 version 1 attempt 若已發布，仍可恢復及檢討。

## 3. 明確不包括

- 不承諾純 SCORM 可以在全校範圍內協調「每一題永不重複」；
- 不以 browser JavaScript 作高風險考試的防作弊邊界；
- 不加入 learner-facing 任意數字輸入來生成題目；
- 不使用無上限的「抽到有效為止」迴圈；
- 不在同一已完成 SCORM attempt 內清除成績再開始；
- 不依賴 Moodle 私有 URL、非標準 attempt number 或 undocumented JavaScript API；
- 不把 `localStorage` 當作權威 attempt history 或跨裝置防重機制；
- 不在 snapshot 只保存 seed 而省略權威題目參數。

## 4. 「恢復」與「重做」語意

### 4.1 同一 attempt 恢復

下列情況全部屬同一次 attempt：

- 重新整理頁面；
- 關閉 browser 後由 Moodle 再入；
- 做到中途後稍後繼續；
- 已提交後重新打開檢討。

活動必須從 `cmi.suspend_data` 恢復同一份 generated scenario。不得重新生成、重新抽 seed，
亦不得讓已保存答案對應另一份題目。

### 4.2 第二次新 attempt

學生完成第一次提交後，如 Moodle 活動設定允許多次 attempts，學生必須由 Moodle 開始一個
新的 attempt。新 attempt 沒有舊 draft／review snapshot，因此活動會建立新 seed 及新題目。

已完成的舊 attempt 繼續保持 review-only；活動內不提供會覆寫舊 attempt 的「重新開始」按鈕。

### 4.3 純 SCORM 的唯一性邊界

SCORM 1.2 activity 無法查詢其他學生或上一個已封存 attempt 的完整題目，因此：

- baseline 方案保證每個新 attempt 都建立新的 128-bit random seed；
- 完整五題重複機率要低至實際可忽略，但不是中央協調式數學保證；
- 若日後要求全校任何單題都絕不重複，必須使用 Moodle question engine、LTI 或 backend
  allocation service，以資料庫登記已派發的 scenario fingerprint；
- browser-only low-risk 版本不應聲稱具有該種嚴格唯一性。

## 5. 整體架構

```text
SimScorm.loadAttempt()
  -> SimActivityFlow.startup()
  -> existing attempt?
       yes: validate saved generated scenarios -> restore exact paper
       no: remain in explore

learner confirms start assessment
  -> create 128-bit seed with Web Crypto
  -> derive five mission random streams
  -> build finite candidate pools
  -> select one valid candidate per mission
  -> apply paper-level constraints
  -> validate complete generated paper
  -> save draft successfully
  -> reveal mission 1
```

生成、驗證、持久化及 UI 必須使用同一份 authoritative scenario object。不得讓 UI、scorer、
snapshot encoder 各自重新生成另一份題目。

## 6. Random seed 與 PRNG

### 6.1 Master seed

每個新 assessment attempt 使用：

```js
crypto.getRandomValues(new Uint32Array(4))
```

建立 128-bit seed，並以固定長度 base64url 或十六進制字串保存。不得以 `Math.random()` 作
attempt seed，亦不得只使用時間戳、student ID 或可預測流水號。

若 `crypto.getRandomValues` 不存在或失敗：

- 留在 `explore`；
- 不顯示任何半生成評估題；
- 不保存不完整 assessment；
- 顯示技術錯誤及安全重試動作；
- 不 fallback 至低熵 `Math.random()`。

### 6.2 Versioned deterministic PRNG

seed 只負責隨機選擇，不作保密或防作弊。使用一個小型、明確版本化、無 dependency 的
deterministic PRNG：

- 固定 32-bit unsigned arithmetic；
- master seed 分成四個 `uint32` state words；
- all-zero state 轉成文件指定的非零常數；
- 每個 mission 使用 domain-separated state，例如 `mission-1` 至 `mission-5`；
- PRNG algorithm、seed decoding、shuffle 及 integer sampling 都有 golden-vector tests；
- generator version 改變時不得用新算法重新解讀舊 attempt。

實作前要在 code comment 及本文件 implementation notes 記錄實際選用算法。可選用穩定的
`xoshiro128**` 或同級 32-bit algorithm；不得自行發明未測試的浮點亂數演算法。

### 6.3 避免 modulo bias

從 pool 抽 index 時要使用已測試的 bounded integer sampler。若直接由 32-bit 值 `% length`，
必須使用 rejection threshold 消除明顯 modulo bias；或者以 Fisher–Yates shuffle 後依序取值。

隨機分布不是計分正確性的信任邊界，但應避免某些題型因 pool 較大而長期過度出現。

## 7. 數值 lattice 與共同物理限制

所有生成器先在整數 lattice 運算，最後才轉成 learner-facing number，避免浮點等式造成隱藏
邊界錯誤。

建議內部表示：

```text
x2 = 2x
v2 = 2v
t  = integer seconds for generated task conditions

x2(t) = 2x0 + v2 * t
```

共同限制：

| 量 | 生成範圍 | UI step | 顯示要求 |
|---|---:|---:|---|
| 初始位置 `x0` | `-8..+8 m` | `1 m` | 一位小數可精確顯示 |
| 速度 `v` | `-2..+2 m/s` | `0.5 m/s` | 一位小數可精確顯示 |
| graph time | `0..6 s` | `0.5 s` | 一位小數 |
| generated condition time | `2,3,4,5,6 s`，按任務限制 | 整數 | 一位小數 |
| graph position | `-20..+20 m` | 任務指定 | 不可被 SVG 裁切 |
| meeting answer | `-20..+20 m` | `0.5 m` | 一位小數可精確輸入 |

對等速直線，只要 `x(0)` 及 `x(6)` 都在 `-20..+20 m`，整段即在範圍內；validator 仍要使用
共同 `lineWithinBounds()` 檢查，而不是由各 generator 重複另一套公式。

## 8. 有限候選池策略

每個 mission 都要由離散可達值枚舉 candidate pool，再過濾 invalid candidates。不得以無上限
random retry 生成。

候選池建立規則：

1. 使用 canonical、穩定排序；
2. 每個 candidate 先通過 mission validator；
3. pool 為空時立即 technical failure；
4. 先均勻選題型 category，再在該 category pool 內均勻選 candidate；
5. paper-level 選擇使用有限 shuffle／bounded search；
6. 所有 pool size 在 unit test 中有合理下限 assertion，防止日後約束意外收窄至幾題；
7. production 不保存整個 pool，只保存最後選中的 scenario。

## 9. 任務 1 生成規格

### 9.1 學習目標

由目標 `x–t` 圖線判斷截距及斜率，再設定車的初始位置和速度。

### 9.2 Candidate lattice

```text
x0 ∈ {-8,-7,...,+7,+8}
v  ∈ {-2,-1.5,-1,-0.5,+0.5,+1,+1.5,+2}
```

### 9.3 Validation

- `v !== 0`；靜止概念留給任務 4；
- `x0` 可由 `1 m` step 控制到達；
- `v` 可由 `0.5 m/s` step 控制到達；
- `lineWithinBounds({x0,v}) === true`；
- target line、student line 及圖例仍不只靠顏色區分；
- target values 不直接顯示於題幹；
- scorer 使用現有 position／velocity tolerance，不因 random generation 改為字串比較。

### 9.4 Authoritative scenario

```js
m1: { x0, v }
```

## 10. 任務 2 生成規格

### 10.1 學習目標

觀察已設定運動，在固定 `t=0 s` 及 `t=6 s` 設定兩個位置，建立 `x–t` 直線。

### 10.2 Candidate lattice

```text
x0 ∈ {-8,-6,-4,-2,0,+2,+4,+6,+8}
v  ∈ {-2,-1.5,-1,-0.5,+0.5,+1,+1.5,+2}
x6 = x0 + 6v
```

由於 `6 * 0.5` 是整數，`x6` 必定可用現有 `1 m` graph-handle step 準確設定。

### 10.3 Validation

- `v !== 0`；
- `x0` 是控制範圍內偶數；
- `x6` 是 `-20..+20 m` 內整數；
- 整條 motion line 在 graph bounds；
- production UI 初次進入時 `xStart`、`xEnd` 仍未設定；
- hidden answer 不因動畫或 live reading 而直接畫出正確線。

### 10.4 Authoritative scenario

```js
m2: { x0, v }
```

`x6` 是 derived value，恢復及計分時重算，不重複保存。

## 11. 任務 3 生成規格

### 11.1 學習目標

用 P、Q 探針量度兩條直線的帶符號速度，並比較速度大小而非圖線高度。

### 11.2 Candidate lattice

為保持 `0.5 s` 探針步距下一位小數讀數精確，本任務先只用整數速度：

```text
x0A, x0B ∈ {-8,-6,-4,-2,0,+2,+4,+6,+8}
x0A !== x0B
vA, vB ∈ {-2,-1,+1,+2}
```

如果日後想加入 `0.5` 或 `1.5 m/s`，必須先把探針位置及 `Δx` 顯示提升至足以精確表達
quarter-metre values，並新增顯示／計分一致性測試。

### 11.3 Category-first selection

先均勻選取：

```text
A faster: |vA| > |vB|
B faster: |vB| > |vA|
same:     |vA| = |vB|
```

再由對應 pool 抽取 candidate，避免因各 category 組合數不同而偏向某一答案。

### 11.4 Validation

- A、B 起點不同且均為可操作偶數；
- A、B 圖線全段在 bounds；
- 每份任務 3 至少一條線是負速度，令每個學生都處理一次負斜率；
- P、Q 可左右反序；`Δt = tQ - tP`、`Δx = xQ - xP` 保持一致次序；
- 任一圖線都有完整 `0..6 s` 可放置相隔至少 `2 s` 的探針；
- 不用線的垂直位置直接推斷速度大小；
- 不同起點及 category 組合應保留「較高不代表較快」的教學證據；
- A、B 不可是完全相同 motion。

### 11.5 Authoritative scenario

```js
m3: {
  A: { x0, v },
  B: { x0, v }
}
```

comparison answer 由 `abs(vA)`、`abs(vB)` 重算，不保存於 scenario。

## 12. 任務 4 生成規格

### 12.1 Category-first selection

三類題型先以相等機率選取：

```text
stationary
positive motion
negative motion
```

### 12.2 Stationary candidate

```text
x0 ∈ {-8,-7,...,+8}
v = 0
atTime = 6
atPosition = x0
```

### 12.3 Positive／negative candidate

```text
x0 ∈ {-8,-7,...,+8}
atTime ∈ {2,3,4,5}
v ∈ {-2,-1.5,-1,-0.5,+0.5,+1,+1.5,+2}
atPosition = x0 + v * atTime
```

positive category 只取 `v > 0`，negative category 只取 `v < 0`。

### 12.4 Validation

- `atPosition` 在 `-20..+20 m`；
- `atPosition` 位於 `0.5 m` lattice，可由一位小數精確顯示；
- motion 全段 `0..6 s` 留在 bounds；
- stationary 必須同時符合 `v=0`、`atTime=6`、`atPosition=x0`；
- non-stationary 不直接在題幹提供 `v`；
- 題幹提供的時間及位置與 scorer 使用值完全相同。

### 12.5 Authoritative scenario

```js
m4: { x0, v, atTime, atPosition }
```

雖然 `atPosition` 可重算，仍保存作題幹權威值；validator 必須證明它與 `{x0,v,atTime}` 一致。

## 13. 任務 5 生成規格

### 13.1 生成方向

先生成 A 車及指定相遇時間，再枚舉所有合法 B 解；不得先抽任意 A、B 再希望它們碰巧相遇。

### 13.2 A candidate lattice

```text
x0A ∈ {-8,-7,...,+8}
vA  ∈ {-2,-1.5,-1,-0.5,+0.5,+1,+1.5,+2}
t*  ∈ {2,3,4,5}
x*  = x0A + vA * t*
```

### 13.3 B solution enumeration

對每個 A／`t*` candidate，枚舉：

```text
x0B ∈ {-8,-7,...,+8}
vB  ∈ {-2,-1.5,-1,-0.5,0,+0.5,+1,+1.5,+2}
```

合法 B 必須：

```text
x0B + vB * t* = x*
```

並同時符合：

- B motion 全段在 `-20..+20 m`；
- `{x0B,vB}` 不與 A 完全相同；
- B 與 A 的唯一交點時間是公開的 `t*`；
- `x0B` 是 UI 可達整數；
- `vB` 是 UI 可達 `0.5 m/s` step；
- 每個 generated scenario 至少有三個不同合法 B solutions；
- `x*` 在 `-16..+16 m` 且位於 `0.5 m` lattice；
- `meetingX` input 可準確輸入 `x*`。

生成器只從具有至少三個合法 B 解的 A／`t*` candidates 中抽題。三個只是 solvability 下限，
不會成為 scorer 的答案清單；scorer 仍接受任何符合物理條件的學生 B。

### 13.4 Authoritative scenario

```js
m5: {
  A: { x0, v },
  meetTime
}
```

不保存 `exampleB`。validator 及 tests 由 lattice 即時枚舉合法解，證明題目可做；學生答案不與
某一個 example 比較。

## 14. Paper-level constraints

五題各自 valid 後，完整 paper 仍要通過：

1. 任務 1、2、4 的 `{x0,v}` 不可完全相同；
2. 整份 paper 至少包含一條正速度及一條負速度 motion；
3. 任務 3 本身至少包含一條負速度；
4. 任務 5 至少有三個合法 B solutions；
5. 每個 mission 的 learner-facing target values 均可由 production UI step 到達；
6. 所有 graph motions 全段在 bounds；
7. 不需要強制每份 paper 都有 `v=0`，因任務 4 category 會在不同 attempts 平衡抽取；
8. 不以跨學生狀態調整 category 機率；需要班級配額時屬 server allocation scope。

選擇演算法使用有限、可證明終止的 bounded search：

```text
shuffle each category pool deterministically
-> walk candidates in order
-> select first complete combination satisfying paper constraints
-> stop after finite pool exhaustion
```

若所有組合耗盡仍無完整 paper，活動 fail closed 並顯示 generation technical error，不以降低
constraint 或越界數值繼續。

## 15. Generated paper validator

新增一個 production `validateGeneratedPaper()`，同時供：

- assessment 開始前；
- draft encoder／decoder；
- review encoder／decoder；
- restored attempt；
- scorer precondition；
- tests。

validator 必須檢查：

- plain object、exact keys、generator version；
- 所有值是 finite number；
- 所有 lattice、step、range；
- 每個 mission-specific invariant；
- graph endpoint／whole-line bounds；
- M3 category、不同起點及 negative requirement；
- M4 stated endpoint relation；
- M5 exact meeting、non-coincident solutions、solution count；
- paper-level motion uniqueness及正／負覆蓋；
- 不接受 derived DOM ID、SVG coordinate、score、correct-answer flag；
- 不因學生答錯、漏答或探針不足而把合法 snapshot 當作 corrupt。

生成器及 validator 不能互相複製兩套略有不同的規則。數值集合及 invariant helpers 要由同一
production module export，tests 直接測 production functions。

## 16. Runtime module 責任

建議新增：

```text
sim/position-time-graph-motion-lab/generator.js
```

責任：

- seed encode／decode；
- versioned deterministic PRNG；
- domain-separated streams；
- candidate pool builders；
- M5 B-solution enumeration；
- generated-paper selection；
- generated-paper validation；
- canonical scenario clone／clean；
- optional paper fingerprint for logs/tests。

現有模組調整：

- `scoring.js`：接受 restored generated paper，不再只查固定 `SCENARIO_SETS`；保留 v1 scorer path；
- `persistence.js`：新增 schema v2 encode／decode／validate；
- `main.js`：在開始 assessment transition 中生成、驗證、保存；UI 只讀 state 中的 paper；
- `index.html`：在 `scoring.js`／`persistence.js`／`main.js` 前載入 `generator.js`；
- manifest：加入 `generator.js`；
- `tools/run-tests.js`：加入 generator tests；
- browser regression：確認 packaged `generator.js` 已載入及新 attempt 可生成。

不得建立活動專用 SCORM wrapper；startup、save、submit 仍經 shared runtime。

## 17. Phase／state matrix

生成題目不新增 learner-facing phase。seed creation、pool building 及 validation 是開始評估 transition
內的短暫技術步驟，不持久化為半完成 phase。

| Phase | Variant／invariant | Current step | Required semantic state | Must be absent／pristine | Allowed next action |
|---|---|---:|---|---|---|
| `explore` | `free` | 無 | exploration motion | generator／paper／assessment | 繼續探索；確認開始後生成並保存 paper |
| `mission` | `normal` | `0..4` | generator metadata、authoritative paper、seen prefix、answers | future answers pristine | 修改本題；保存；下一題 |
| `mission` | `from-review` | `0..4` | 同一 paper、五題已 seen、editing step、answers | 無第二份 paper | 修改本題；返回 final review |
| `final-review` | `ready` | 無 | 同一 paper、五題 seen、answers | active editing step | 修改指定題；最後提交 |
| `submitted-review` | `complete` | 無 | 同一 paper、authoritative answers、recomputed result | 所有編輯及再生成動作 | 只讀檢討 |

Technical outcomes：

- seed failure：留在 explore；
- generation failure：留在 explore，無 assessment draft；
- generated draft save failure：留在 explore，不 reveal mission 1；
- restored generated paper invalid：鎖定 technical load error，不覆寫；
- finished generated review invalid：保持鎖定，只顯示可信 Moodle summary；
- pending-final：使用 frozen review payload，不生成新 paper。

## 18. Persistence schema v2

### 18.1 Draft snapshot

建議 production encoder 使用緊湊 keys，但 code 要有清楚 mapping及測試：

```js
{
  v: 2,                  // persistence schema
  p: "mission",          // phase
  r: "normal",           // variant
  c: 2,                  // current step
  e: null,               // editing step
  x: { x0: 0, v: 1 },   // exploration state
  g: {
    v: 2,                // generator version
    s: "<128-bit seed>",
    q: {
      m1: { x0, v },
      m2: { x0, v },
      m3: { A: { x0, v }, B: { x0, v } },
      m4: { x0, v, atTime, atPosition },
      m5: { A: { x0, v }, meetTime }
    }
  },
  a: {
    seen: [true, true, true, false, false],
    ans: { m1, m2, m3, m4, m5 }
  }
}
```

Explore draft 不包含 `g` 或 assessment：

```js
{ v: 2, p: "explore", r: "free", c: null, e: null, x: {...}, g: null, a: null }
```

### 18.2 Review snapshot

```js
{
  v: 2,
  g: {
    v: 2,
    s: "<128-bit seed>",
    q: { m1, m2, m3, m4, m5 }
  },
  ans: { m1, m2, m3, m4, m5 }
}
```

Review 必須足以：

- validate paper；
- restore all learner answers；
- redraw every mission；
- enumerate M5 validity；
- recompute component及total score；
- compare saved score／pass metadata；
- 在 mismatch 時只顯示安全 Moodle summary。

### 18.3 權威與 derived data

權威保存：

- generator version；
- seed；
- 五題實際 scenario parameters；
- phase／variant／step／seen；
- learner answers。

不保存：

- candidate pools；
- PRNG current cursor；
- SVG positions；
- graph endpoints可由 scenario 精確重算的 duplicate fields；
- M3 correct comparison；
- M5 answer list／exampleB；
- score components、total、pass；
- animation time、pointer state、focus、modal state。

## 19. Version 1 相容策略

如果 version 1 有任何已發布 attempt：

1. 保留 `LIBRARY_VERSION = 1` 及三個 immutable fixed sets；
2. v1 draft／review decoder 繼續按 `lv + sid` 恢復；
3. v2 decoder 只接受 embedded generated paper；
4. v1 不會自動轉成 v2 random paper；
5. 已完成 v1 attempt 繼續原題檢討；
6. 新 attempt 一律建立 v2；
7. v1、v2 都經 production scorer，但 scenario source不同；
8. 加入 v1 frozen fixtures，防止日後 generator refactor 破壞舊 attempt。

只有在產品負責人明確確認 version 1 從未發布、沒有任何 Moodle attempt 後，才可在實作 PR 內
另作刪除 v1 compatibility 的決定。不得由開發者自行假設。

## 20. 新 attempt 防重策略

### 20.1 Baseline SCORM mode

- 每個 blank attempt 必須呼叫 Web Crypto 建立全新 seed；
- 不重用前一個 in-memory seed；
- 不以 student ID 單獨決定 paper；
- 不以 timestamp 單獨決定 paper；
- 完整 paper 可計算 canonical fingerprint，供 tests／diagnostics 使用；
- fingerprint 不作安全簽章，亦不聲稱防 learner tampering。

### 20.2 可選 soft same-device guard

若產品日後接受 `localStorage` 的私隱及跨裝置限制，可只保存上一份 paper fingerprint，當新
attempt 恰好生成完全相同 paper 時有限次重抽。這只能改善同 browser 重複，不能成為驗收所需
的權威保證，亦不得阻止正常 SCORM restore。

初版建議不加入此 guard；128-bit seed加大型 paper space已足夠低風險活動。

### 20.3 Strict uniqueness mode

若要求每位學生每條題目全域唯一，需另立 backend scope：

```text
learner/attempt requests paper
-> trusted allocator selects unused fingerprint
-> database reserves it atomically
-> signed/authoritative paper returned
-> server validates submission
```

此模式已超出 static SCORM 1.2，並會把 assessment risk／deployment model 改成 LTI 或 Moodle
server integration，不納入本次實作。

## 21. Scoring 與 tolerance

分數配置維持五題各 20 分及現有 component rubric。生成題目只改 target scenario，不改學生
可得分結構。

Scorer 必須：

- 先接受已驗證 generated paper；
- 使用 snapshot 中權威 scenario，而非重新以 seed 生成；
- M1/M4 比較 `{x0,v}`；
- M2 由 generated `{x0,v}` 重算 `x6` 及 slope；
- M3 由 generated A/B 重算速度及 magnitude comparison；
- M5 接受任何符合 `t*` 相遇的非重合 B；
- 所有 tolerance boundary tests 以多個 generated targets執行；
- invalid paper 不得回傳正常 `0/100 failed` 冒充合法提交，而要令 submission fail closed。

## 22. Snapshot 大小與效能預算

### 22.1 Size

- 最大合法 v2 draft shared snapshot：`< 4000 UTF-8 bytes`；
- 最大合法 v2 review shared snapshot：`< 4000 UTF-8 bytes`；
- 最大 review 經 pending-final checkpoint／escaping 後仍 `< 4000 bytes`；
- tests 必須使用 production encoder、`SimScorm.makeSnapshot()` 及 shared pending path實測；
- 不以手算 JSON 字符數代替。

### 22.2 Performance

- 所有 candidate pools 使用小型離散 lattice；
- 在一般手機上 generation／validation 應在單一短 task 內完成，目標 `< 50 ms`；
- M5 solution enumeration 要有明確最大組合數；
- 不在每次 render、drag、animation frame 重建 pools；
- pools 可在 module initialization 建立並 freeze；
- restore 只 validate saved paper，不重新抽題。

## 23. 安全、私隱與信任邊界

- random seed 不是秘密；learner 可在 developer tools 看到題目及 scorer；
- `crypto.getRandomValues` 用於高熵及降低重複，不把 browser scoring變成可信考試；
- 不在 learner JavaScript 放 server secret；
- 不把 raw student ID 保存到 suspend_data 或 localStorage；
- strict cross-student uniqueness 需要 trusted server；
- generated scenario、answer及score可被 learner-side tampering，因此活動仍只適合低風險小功課；
- invalid／tampered restored data要鎖定，不可自動生成新題覆寫證據。

## 24. Generator test plan

### 24.1 PRNG

- [ ] seed encode／decode round-trip；
- [ ] invalid length／characters rejected；
- [ ] all-zero handling fixed；
- [ ] golden vectors固定；
- [ ] same seed + version生成相同 paper；
- [ ] mission domain separation不會產生相同 stream；
- [ ] bounded sampler只回傳合法 index；
- [ ] Fisher–Yates結果為完整 permutation。

### 24.2 Candidate pools

- [ ] 每個 pool非空且大於文件指定最低數量；
- [ ] 每個 candidate通過 production mission validator；
- [ ] 所有值在 UI lattice；
- [ ] 所有 motion全段在 graph bounds；
- [ ] category pools齊全；
- [ ] M3 A faster／B faster／same齊全；
- [ ] M3每個可抽 candidate至少一個負速度；
- [ ] M4 stationary／positive／negative齊全；
- [ ] 每個 M5 candidate至少三個合法 B solutions；
- [ ] M5 solutions全部可由 UI重現。

### 24.3 Property sweep

使用固定測試 seed sequence，例如 10,000 個 seeds；因 seed sequence固定，測試不可 flaky：

- [ ] 每份 paper通過 `validateGeneratedPaper()`；
- [ ] 所有 target可顯示及可操作；
- [ ] 無 NaN／Infinity／out-of-range；
- [ ] 無無解 M5；
- [ ] 完整 paper fingerprint具有高多樣性；
- [ ] 每個 mission unique candidate count達最低門檻；
- [ ] category frequency落在寬鬆、固定、非脆弱的 sanity range；
- [ ] 不把「10,000份完全無碰撞」聲稱為數學保證，只作 regression evidence。

## 25. Persistence 與 lifecycle test plan

### 25.1 v2 round-trip fixtures

每個 state matrix row都要使用 production-generated paper：

- [ ] explore／free；
- [ ] mission／normal step 0..4；
- [ ] mission／from-review step 0..4；
- [ ] final-review／ready；
- [ ] submitted-review／complete；
- [ ] empty、partial、wrong、complete answers；
- [ ] M3 0／1／2 probes、同時刻、反序、時差不足；
- [ ] M5 wrong、parallel、coincident、valid alternate solution。

每個 fixture：

```text
generate -> encode -> shared snapshot -> decode -> restore
-> validate same paper -> same score -> execute one legal continuation
```

### 25.2 Attempt behavior

- [ ] 同一 draft reload保留完全相同 seed／paper／answers；
- [ ] reload不呼叫 generator；
- [ ] blank new attempt呼叫 seed provider一次並建立新 paper；
- [ ] seed save失敗不進入 mission；
- [ ] completed attempt重新入保持鎖定；
- [ ] pending-final只重試同一 review payload；
- [ ] new Moodle attempt不承接舊 in-memory paper；
- [ ] submission success／committed／frozen／兩類 retry production UI全部覆蓋。

### 25.3 Invalid generated state

- [ ] unknown schema／generator version；
- [ ] missing／extra mission keys；
- [ ] seed malformed；
- [ ] scenario value與 UI step不一致；
- [ ] motion越界；
- [ ] M2 endpoint不可達；
- [ ] M3同起點、無負速度、category不成立；
- [ ] M4 stated endpoint不一致；
- [ ] M5無解、少於三解、coincident-only、meet time越界；
- [ ] paper-level duplicate motion signature；
- [ ] draft phase與generated paper presence不匹配；
- [ ] finished invalid review保持鎖定，只顯示安全 Moodle summary。

### 25.4 Backward compatibility

- [ ] 所有現有 v1 phase fixtures仍可 decode；
- [ ] v1 score及合法 continuation不變；
- [ ] v1 review仍可重畫；
- [ ] v1不經 v2 generator；
- [ ] 新 attempt只產生 v2。

## 26. Interaction、browser 與 package tests

- [ ] Live Server／local fallback新 attempt可生成及完成五題；
- [ ] extracted SCORM ZIP由 manifest SCO href啟動；
- [ ] packaged `generator.js`載入及執行；
- [ ] browser test可注入固定 seed，避免 screenshot／DOM assertion不穩定；
- [ ] 至少測兩個不同 fixed seeds，證明 learner-facing numbers改變；
- [ ] reload同一 draft後 DOM題目數字不變；
- [ ] 320 px及desktop五題控制可到達；
- [ ] generated極值 scenario不裁切車、圖線、label或drag target；
- [ ] keyboard可設定所有 generated target lattice values；
- [ ] review顯示該 attempt原題，不重新生成；
- [ ] console無 error／warning；
- [ ] ZIP root有 manifest，runtime dependency齊全，無 tests／plans；
- [ ] temp extraction及Chrome profile安全清理。

## 27. Moodle 驗證

測試 Moodle activity要設定允許至少兩次 attempts，使用真實 student account記錄：

1. 第一次開始後記錄五題 fingerprint；
2. 中途離開再入，確認 fingerprint及答案不變；
3. 完成提交，確認score／status／review鎖定；
4. 重新打開第一次 attempt，仍是同一份只讀題目；
5. 從 Moodle開始第二次新 attempt；
6. 確認產生新 seed及不同完整 paper fingerprint；
7. 再次提交，確認兩次 attempt成績沒有互相覆寫；
8. 模擬 draft save failure、pending-final及finish retry；
9. 記錄 Moodle版本、browser、attempt設定、console及gradebook evidence。

如果第二次「重做」實際只重新打開第一次 completed attempt，要先修正 Moodle attempt設定或
learner操作流程，不可以由 activity偷偷清除已完成資料。

## 28. 實作順序

### Phase A：generator 純函數

- 建立 `generator.js`；
- 定義 seed／PRNG／lattice constants；
- 建立五個 candidate pools；
- 建立 M5 solution enumeration；
- 實作 mission及paper validators；
- 完成 golden vectors、pool及property tests。

### Phase B：scorer scenario abstraction

- 讓 scorer接受明確 scenario object；
- 保留 v1 fixed-set path；
- 加 generated target及tolerance tests；
- 確認 alternate M5 solutions仍可得分。

### Phase C：persistence schema v2

- 實作 v2 draft／review encode、decode、validate；
- 保留或明確移除 v1 compatibility；
- 完成phase matrix、invalid matrix、legal continuation及size tests。

### Phase D：production UI wiring

- assessment start transition建立新 paper；
- save成功後才 reveal mission 1；
- 所有任務由 state paper讀 scenario；
- technical failure fail closed；
- review使用保存的同一 paper。

### Phase E：attempt及browser regression

- fixed seed injection只供 tests；
- 測同 attempt reload及blank new attempt；
- extracted ZIP browser smoke；
- 320 px／desktop極值 scenario；
- cleanup及runtime dependency checks。

### Phase F：Moodle evidence

- 配置multiple attempts；
- 完成兩次真實student attempts；
- 驗證resume、review lock、new paper及gradebook；
- 記錄仍存在的browser-only信任邊界。

## 29. Repository quality gates

實作完成前必須：

- [ ] `generator.js`加入activity manifest；
- [ ] 所有新tests加入`tools/run-tests.js`；
- [ ] `npm run check`；
- [ ] `npm test`；
- [ ] `npm run package:all`；
- [ ] `npm run test:browser:position-time`；
- [ ] `git diff --check <base>...HEAD`；
- [ ] extracted ZIP由manifest SCO href成功啟動；
- [ ] 最大v2 snapshots低於4000 bytes；
- [ ] 無新增第三方runtime dependency；
- [ ] 無未列入manifest的runtime檔案；
- [ ] 無修改shared SCORM semantics來遷就activity-specific generation。

## 30. 驗收條件

### 隨機性

- 每個blank new attempt建立新128-bit seed；
- 五個mission由獨立domain streams／category pools選取；
- 不再只限於三套固定paper；
- 固定10,000 seed sweep顯示高paper多樣性及合理category分布；
- 文件及UI不聲稱browser-only能提供全域絕對唯一。

### 合理性

- 所有位置、速度、時間及答案都在UI step；
- 所有motion全段在graph bounds；
- M2 endpoints可準確設定；
- M3 probe readings與顯示精度一致；
- M4 condition與motion一致；
- 每個M5 scenario至少有三個非重合可操作解；
- 任一invalid generated paper都fail closed。

### Attempt 行為

- 同一次attempt恢復原題；
- 已完成attempt只讀鎖定；
- 第二個Moodle attempt建立新題；
- submission、pending-final及review都保存同一份權威paper；
- 舊v1 attempt按已確認兼容策略處理。

### 交付

- unit、persistence、lifecycle、package及real-browser tests全過；
- Moodle兩次student attempt有實際證據；
- snapshot size符合SCORM 1.2預算；
- assessment仍明確標示為low-risk browser-scored activity。

## 31. 已確認產品決定

本次實作採用：

1. 保留 version 1 fixed-set draft／review compatibility；新 blank attempt只建立 version 2 paper；
2. Moodle activity須由教師設定允許多次 attempts；activity本身不覆寫 completed attempt；
3. 採用 Web Crypto 128-bit seed的baseline probabilistic uniqueness，不另加backend allocator；
4. M4 stationary／positive／negative三類維持等機率category-first選取；
5. M5每題至少三個合法、UI可操作、非重合B solutions；
6. 不加入`localStorage` soft duplicate guard；
7. CI執行固定10,000 seeds property sweep。

## 32. Implementation notes

- Generator version 2 使用 `xoshiro128**`、32-bit unsigned arithmetic、固定domain derivation及
  rejection-threshold bounded sampler；golden vectors鎖定於`generator.test.js`。
- Production candidate pool sizes：M1 `136`、M2 `72`、M3 A/B/same
  `216/216/432`、M4 stationary/positive/negative `17/272/272`、M5 `326`。
- 固定10,000-seed sweep產生10,000個不同完整paper fingerprint；此結果只作regression evidence，
  不代表全域唯一性保證。
- Fully populated v2 fixtures經production `SimScorm.makeSnapshot()`及shared pending-final path量度：
  draft `642 bytes`、review `561 bytes`、pending-final `830 bytes`；三者均低於`4000 bytes`
  上限，並由`persistence.test.js`及`pending-final.test.js`每次執行驗證。
- Extracted-package browser gate會確認`generator.js`載入、兩個fixed seeds產生不同paper，
  以及同一saved draft reload後fingerprint不變。
- 真實Moodle student account的兩次attempt驗證仍屬部署環境驗收，不能由本機測試代替。
