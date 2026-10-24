# 火箭工廠與太空任務：3D SCORM 實施計劃

狀態：**使用者已批准實作；P1–P3 功能已接通，P4 驗證中，P5 待實際環境驗收。** 日期：2026-10-24。
本文件從 [新活動計劃模板](NEW-SIMULATION-PLAN-TEMPLATE.md) 複製並填寫；遵循 [共同產品與風格](00-shared-platform-and-style.md) 及 [製作與驗證契約](../docs/simulation-scorm-production-guide.md)。下列數值、配分和效能預算是具體設計決定／待驗證目標，不能當成已通過的證據。

## 已確認需求與本輪範圍

- 本 worktree 專門開發「火箭工廠與太空任務」，採真正 3D 場景，風格可愛、易上手，保留合理的發射與軌道物理。
- 借鑑 Kerbal Space Program 的組裝、試飛、失敗後修改、入軌及變軌循環；美術和介面自行製作。
- 學生要親手砌火箭、控制發射、嘗試入軌，並在軌道上改變速度。探索與任務成果是主體，公式與填答是輔助。
- 使用者已審查本計劃並明確指示立即開發，授權 runtime、測試、manifest、catalogue 和網站實作。
- 延續既有要求：標題不帶教材章號；繁體中文；數學符號採 LaTeX 樣式；讀數固定位置；不用重設／空白提交彈窗；手機舞台和控制 panel 均須可用。
- 教材參照：先前已讀的高中物理必修第二冊，第七章印刷頁 59–64。原 PDF 只作參考，不打包。
- 卡文迪許實驗及天體質量活動不在本活動範圍。

## 分支、工作範圍與交付節奏

| 項目 | 決定 |
|---|---|
| Worktree | C:/Users/frens/.codex/worktrees/bb0b/simlab |
| 專用分支 | codex/rocket-space-mission-lab |
| 建立起點 | main 的 1ef4bdf4fd696b4a12c37f7c1bedfe6d6f96849d |
| Remote | origin，https://github.com/frenselw/simlab.git |
| 本輪文件 | plans/40-rocket-space-mission-lab.md |
| 活動目錄 | sim/rocket-space-mission-lab/ |
| 共用編輯位置 | sim/config.js、sim/manifests/rocket-space-mission-lab.xml、tools/test-registry.js、tools/mobile-scroll-cases.js、tools/mobile-scroll-browser-regression.js 的活動 CLI 登記如有需要、README.md |
| 現有未追蹤內容 | .codex-remote-attachments/ 保留；不納入本活動提交 |
| 開發埠／瀏覽器 session | 預定 4383／rocket-space-mission；衝突時另選空閒埠，不終止其他工作服務 |
| 每輪完成 | 相應檢查 → 只提交本輪變更 → push 本分支 → 有可試用版本時部署獨立 Sites → 核對部署版本和網址 |
| 回報 | 按使用者要求不用等待 CI 才交付；清楚標示 CI 待跑、失敗或通過及對應 SHA |
| 合併 | 完成驗收後才處理 main 整合；本輪不合併，不覆蓋其他活動 |

## 學生實際體驗

### 一次完整體驗

1. 進入裝配間，看到衛星載荷、兩種燃料箱、兩種引擎及分離器。點零件直接裝到目前選中的級，或拖零件到接點；可轉動鏡頭檢查成品。
2. 到發射台，由自己控制點火、油門、漸漸轉向、關機、分級。姿態穩定由系統協助，學生不需要處理翻滾。
3. 隨時切換跟隨鏡頭與地球軌道圖。軌道圖顯示「現在關機後」的預測路徑，讓學生看出飛得高仍可能落回地球。
4. 遇到問題可暫停，看具體原因，再回工廠改裝或重試。已保留的任務紀錄不因一次重試被清除。
5. 入軌後把變軌標記放到近地點或遠地點，調整沿運動方向／反向的變速量；預覽後親自確認執行。
6. 令衛星到達較高的目標圓軌道，保留成果，最後到「任務紀錄」檢查並明確提交。

建議課堂體驗 20–30 分鐘，可分兩次完成；不是計時競賽，不因多次試飛扣分。

### 任務 A：把自己的衛星送入軌道

- 起始裝配是空白的可裝配槽，只有待安裝的載荷提示；預設展示不構成學生答案。
- 任務描述：「組裝火箭，把衛星送到離地 200–400 km 的接近圓形軌道。」
- 先讓學生試飛，再依情況給一行可行動的提示，例如「目前路徑仍穿過地面；可以檢查沿地面方向的速度」。
- 提示按需展開；不自動換引擎、補燃料、選點火時機或修正軌道。
- 成功建立安全軌道後可繼續調整，也可保留現有部分成果。不用成功才可進入檢查頁。

### 任務 B：把軌道升高

- 任務描述：「讓衛星到達指定的較高圓軌道。」
- 可帶入任務 A 的安全入軌快照，或明確選「使用練習飛船」從 300 km 圓軌道開始。兩者都可做任務 B，練習飛船不補發任務 A 分數。
- 目標高度每次 attempt 從 600、800、1000 km 三種變體選一個；P1 須先驗證每種可完成，同一 attempt 保持不變。初期教學預覽可固定 800 km。
- 以近／遠地點標記選點火位置，選方向並調整預計 Δv。提供小幅增減按鈕，拖曳不是唯一輸入方法。
- 虛線預覽由同一物理模型生成，表示目前計劃與剩餘燃料下的結果。
- 「執行計劃」只執行學生已選定的節點／方向／變速量，協助定向和準時點火；不自動求最優解、不自動完成第二次圓化。
- 第一輪抬高遠地點，第二輪由學生再安排點火抬高近地點。隨時可取消尚未開始的計劃。
- 燃燒中可緊急關機，保留已消耗燃料及已發生的變速；不回滾物理時間。

### 如何保持有趣與容易操作

- 火箭、燃料箱、發射台採圓潤低多邊形造型；白／暖灰機身、藍綠和橙色區分部件；衛星可有簡單面孔標記，不引入角色對話系統。
- 工廠亮色、發射時天空漸暗、太空深藍。頁面 header／controls 仍遵循共用淺色與高對比風格。
- 推進火焰、分級和地球曲面提供清楚的操作回應。煙霧只作表現，不影響物理或遮擋讀數。
- 失敗以停機、落地標記和一行診斷呈現；保留返回工廠的直接入口，不彈 modal，不以爆炸動畫拖延重試。
- 自由探索可暫停、重試、改裝；正式提交後遵循 review-only 契約。任務完成徽章屬遊戲內形成性回饋，不表示已向 Moodle 提交。
- 展開公式為可選說明；主要操作不用學生輸入科學記數法或先計火箭方程。

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | rocket-space-mission-lab；理解載荷、推力、燃料和分級的取捨；分辨升空與入軌；利用點火位置／方向改變軌道 |
| Delivery scope / package | 一個形成性 SCORM 1.2 SCO；同一 runtime 的 Sites 練習版；ZIP 為 output/rocket-space-mission-lab-scorm.zip |
| Learner task / main interactions | 裝配、控制油門與俯仰、分級、觀察關機後軌道、配置並執行變軌、選擇保留任務紀錄 |
| Shared subject core / activity outer layer | 目前無可直接套用的火箭核心；物理與軌道邏輯留在本活動。重用 shared styles/scorm/activity-flow/fullscreen，不提早抽象成跨活動航天框架 |
| Assessment risk / trusted validation | formative；瀏覽器評分不能防篡改，不作高風險考試；不放秘密。若將來高風險評量，另需可信端驗證 |
| Out of scope | 月球／多天體引力、登陸／回收／對接、完整六自由度剛體、結構破壞、燃料管路、熱損傷、氣動升力、多人模式、登入、雲端存檔、整段飛行錄影匯出 |
| 可用平台 | 現代桌面、平板及支援 WebGL 2 的手機；實際最低裝置以 P1／P5 實測界定 |
| 首版 3D 範圍 | 真正透視投影、可旋轉鏡頭、立體零件和球形地球；飛行位置／速度以三維向量計算，但推力與運動受限於固定平面，沒有首版傾角任務 |

### 技術選型

**採 Three.js 0.185.1 + 原生 JavaScript + HTML/CSS 控制介面；物理採獨立可測試的 JavaScript 數值模型。**

| 選項 | 判斷 |
|---|---|
| Three.js | 採用。現有重心活動已有 0.185.1、本地 ES modules 與 LICENSE；適合少量模型、鏡頭、軌道曲線及自行控制的物理 |
| Babylon.js | 能勝任，但本活動不需要整套引擎附帶的編輯器／碰撞物理整合；改用它會加入第二套 3D 依賴 |
| 通用剛體物理庫 | 首版不採用。核心是中心引力、可變質量推進、分級和軌道計算；不靠碰撞引擎代替這些模型 |
| 原生 WebGL | 能做到，但需自行處理過多繪圖細節，沒有本活動的具體收益 |
| WebGPU | 不作首版必要條件；使用 Three.js WebGLRenderer 的 WebGL 2 路線 |
| React／建置框架 | 不新增；保留靜態頁、Live Server、相對路徑和既有打包方式 |

- 依賴固定採已在 repo 的版本，不在本輪升級。實作時將同一發行檔及 LICENSE 複製到本活動 vendor/three-0.185.1/，核對 hash，維持本活動可獨立打包；不重構另一活動的 vendor 路徑。
- 現有兩個 minified JS 合計約 751 kB（未壓縮檔案長度），不是整個 ZIP 大小承諾。
- 沿用現有 ES module 匯入方式；Three.js 不負責飛行積分、評分或答案儲存。
- 首版模型用 Three.js 幾何體組裝；不引入遠端材質、模型 CDN、大型 HDR、角色動畫或 glTF 載入器。後續只有確認需要時才加資產。
- 介面文字、按鈕、量表用 DOM；舞台數學標籤用可縮放的 DOM/SVG overlay，保持中文和數學可讀性。
- 使用局部投影命中區、既有 pointer/capture 模式與簡單相機控制；不為少數固定視角引入額外控制插件。

### 預定 runtime 文件與影響範圍

| 文件 | 責任 |
|---|---|
| index.html、styles.css | 三區版面、可存取控制、舞台／panel／fullscreen markers |
| parts.js | 教學零件參數、裝配相容規則、載荷與目標變體；不含使用者答案 |
| model.js | 位置、速度、質量、引力、推進、阻力、分級、時間積分 |
| orbit.js | 軌道參數、撞地判斷、節點定位、預覽；與 model 共用物理常數 |
| scene.js | Three.js 場景、模型、相機、縮放、資源釋放及 context recovery |
| interaction.js | 命中區、拖放、姿態／節點控制、手勢暫態 |
| scoring.js | 只從已保留且合法的紀錄重算 100 分 rubric |
| persistence.js | schema、語義驗證、快照、還原及 4000-byte 檢查 |
| main.js | 任務狀態、UI 串接、shared lifecycle glue；不另寫 commit/finish |
| vendor/three-0.185.1/ | three.module.min.js、three.core.min.js、LICENSE |
| tools/rocket-space-mission-browser-regression.js | 一個有明確 owner 的 source／package 瀏覽器回歸 |
| 既有 registry／catalogue／manifest／README | 登記資源、測試、可用活動與操作說明；不修改其他活動答案 |

上述是責任邊界，實作時小型邏輯可合併；避免為每個視覺部件建立新架構。

## Catalogue metadata (`sim/config.js`)

| 欄位 | 預定值 |
|---|---|
| title | 火箭工廠與太空任務 |
| folder | rocket-space-mission-lab |
| categories | Mechanics |
| description | 組裝立體火箭，控制發射與分級，把衛星送入軌道，再親手規劃變軌任務。 |
| tags | physics、mechanics、gravity、rocket、orbital-motion、3d、scorm |
| status | 初次 runtime 登記 planned；有可部署並驗證的活動才改 active |

本輪只有計劃，不新增 catalogue 空入口。

## Physics or subject model

### 世界與簡化邊界

- 採球形、固定、首版不自轉的地球：R = 6.371 × 10^6 m，μ = GM = 3.986004418 × 10^14 m³/s²；比衝換算 g₀ = 9.80665 m/s²。這是教學常數，不宣稱含地球自轉／非球形擾動。
- 物理一律 SI、JavaScript double。位置原點在地心；初始發射台 r = (R, 0, 0)，初始相對地球速度為零；初始順行切向為 +y。
- 真實尺度決定重力與速度；只加快模擬時間，不偷偷縮小地球、降低入軌速度或補推力。
- 火箭在跟隨視角按米級顯示；軌道視角用放大的標記代表飛船，標示「飛船圖示非同比例」。不把渲染尺寸帶入碰撞／引力。
- 發射／燃燒限制於 xy 平面。相機可在三維繞看；學生明白「觀察角度」與「飛行方向」是兩個控制。
- 所有物體的中心引力持續存在；入軌不關掉重力，關機不把速度歸零。
- 大氣採平滑教學模型：ρ(h) = 1.225 exp(-h/8500) kg/m³，80–120 km 用連續 taper 降到零，120 km 以上真空。不是精密標準大氣。
- 阻力為 -½ρ C_d A |v|v，C_d = 0.35、A = 3.14 m² 作固定教學值，無風、不計升力／熱損傷；UI 明確列為簡化。主線不要求辨認氣動細節。

### 零件與裝配

以下為教學火箭的初始參數，P1 必須以實際積分證明有多種可成功設計，才凍結 modelVersion。

| 零件 | 乾質量 | 推進劑／能力 | 學生會感受到的差異 |
|---|---:|---|---|
| 衛星載荷 | 120／150／180 kg | attempt 變體固定其中一種 | 載荷影響整體加速；三變體都必須可完成 |
| 小燃料箱 | 100 kg | 1500 kg 推進劑 | 較輕、續航較短 |
| 大燃料箱 | 400 kg | 6000 kg 推進劑 | 可燃燒更久，也增加起飛質量 |
| 大推力引擎 | 500 kg | 600 kN、I_sp = 300 s | 較適合起飛，較重 |
| 高效率引擎 | 150 kg | 80 kN、I_sp = 340 s | 較省推進劑、推力較低 |
| 級間分離器 | 60 kg | 分開上下級 | 去掉耗盡級的乾質量；剩餘燃料亦隨棄級失去 |

- UI 可簡稱「燃料」，說明其包括燃料與氧化劑，不需要從空氣吸氧。
- 最多兩級，每級一個引擎及 1–4 個燃料箱。上下順序：衛星 → 上級箱／引擎 → 分離器 → 下級箱／引擎；單級亦可嘗試。
- 以明確接點／槽組裝，支援加入、替換、移除及小／大箱數量。不是任意物件堆疊的結構模擬。
- 缺引擎／缺箱是合法未完成設計；可保留及提交，但不能點火。弱推重比設計可嘗試點火，火箭留在發射台並消耗燃料，不由 UI 禁止探索。
- 首版不提供一鍵載入完整火箭；用接點提示引導組裝，避免預設成品代替學生設計。
- 分級只棄掉下級；上級繼承同一位置與速度，不憑空加速。分離瞬間油門歸零，學生再點火；上級推進劑不被下級引擎使用。

解析可行性初查：150 kg 載荷、下級大推力引擎＋4 大箱、上級高效率引擎＋1 大箱及分離器，起飛總質量 32,860 kg，推重比約 1.86，理想總 Δv 約 11.39 km/s。**這只是忽略重力／阻力損失的預算，不是成功入軌證據。** P1 須找出實際可飛控制序列、另一成功設計與失敗對照，不能用加分或隱藏加速補救不足設計。

### 更新規則

| State variables | Update rules / formulas | Units / bounds |
|---|---|---|
| r、v | dr/dt = v；dv/dt = -μr/‖r‖³ + F_thrust/m + F_drag/m | m、m/s；三維有限數，平面約束 z、v_z = 0 |
| 推進劑 p_i、總質量 m | m = 衛星＋仍連接乾質量＋剩餘推進劑；dp_active/dt = -u F_max/(I_sp g₀) | kg；0 ≤ p_i ≤ 該級容量 |
| 油門 u | 0–1；無燃料／未點火時推力為零 | 無量綱；顯示 % |
| 俯仰 β | 由當地向外徑向朝順行切向轉；β = 0° 向上，90° 沿當地水平；允許 0–180° | 控制目標角，限速追蹤 12°/s，不把飛行速度旋到機身方向 |
| 姿態輔助 | 對準當地俯仰／沿速度／反速度；只改推力方向，不直接修改位置、速度或軌道 | 操作簡化，不宣稱剛體姿態動力學 |
| 分級 | 移除下級與分離器質量、保留 r/v；棄級純視覺，碰撞計算只追蹤主飛船 | 防止重複分離、負質量 |
| 落地 | 已離地的主飛船穿越 ‖r‖ = R 時定位接觸事件，停止該次飛行 | 不穿過地球；低推力未離地以台面支承約束 |
| 逃逸／遠離 | 比能 ε ≥ 0、徑向向外且離地高度達 100,000 km，標示離開本任務區域並停下 | 不把橢圓遠地點判成逃逸 |

軌道參數從 r/v 重算：ε = |v|²/2 - μ/|r|；a = -μ/(2ε)（只對束縛軌道）；h_vec = r × v；e_vec = (v × h_vec)/μ - r/|r|；e = |e_vec|；r_p = a(1-e)、r_a = a(1+e)。安全性用離地高度 h_p = r_p-R、h_a = r_a-R。近徑向、近圓、拋物線邊界均定義可顯示分支，不能除零或顯示 NaN。

### 積分、預覽與時間

- 主模型用 RK4；燃燒或大氣中最大子步 0.1 s；真空滑行最大子步 2 s。燃料耗盡、分級、接觸地面與開始／終止燃燒切在事件邊界，不跨過後再補值。
- 物理步長與畫面 fps 無關。時間快轉只增加子步數，不把 dt 乘成巨大的步長。每幀有運算上限，追不上時放慢時間快轉並顯示實際倍率，不丟物理步。
- 可選 1×、5×；真空關機後另開 20×、100×、1000×。開始燃燒或接近大氣／地面時自動降至 ≤5×。可在暫停時修改控制，按繼續才影響後續運動。
- 變軌預覽採同一模型的有限推力燃燒。學生設定 Δv 是累積推力加速度積分 ∫F/m dt 的目標，非飛船速率的直接增量；方向可隨速度更新。
- 節點選「下一次近地點／遠地點」，在明顯圓軌道可選任意軌道相位；近圓時不顯示不穩定的遠近點標籤。
- 預覽包含燃燒時間與耗油，燃料不足要顯示可達結果；不畫出實際無法達成的完整理想軌道。執行前若初態改變，重新預覽。
- 虛線「現在關機後路徑」在大氣中用含阻力模型；「變軌後預覽」只在任務 B 的安全真空軌道可編輯。
- 預覽重算節流至最多 5 Hz，拖放結束補算精確版本；單次阻塞目標 <80 ms，必要時拆批讓出主執行緒，先不加 Worker。
- 背景／失焦及 WebGL context loss 暫停飛行，回來要明確繼續。以 visibilitychange／blur 處理模擬暫態，不另寫 pagehide／pageshow 或 LMS 關閉邏輯。
- 成果軌道可由保存的物理狀態重建；本頁可提供最近一次試飛的有限採樣回放，最多 600 點，只存記憶體，不把完整時間線塞進 SCORM。重新進入 Moodle 保留任務快照，不能宣稱保留完整試飛影片。

### 校準與物理驗收目標

- 200 km 圓軌道，依本計劃 R/μ 算得 v 約 7.79 km/s、周期約 88.4 min；以解析值驗證實作。
- 真空關機圓軌道積分 10 圈：相對能量與角動量漂移各 <10^-5；將 dt 減半後任務判定一致。
- 真空無重力引擎 fixture 的 Δv 與 I_sp g₀ ln(m₀/m₁) 差 <0.1%；燃料消耗、質量減少與推力一致。
- 理想短時近／遠地點變速用解析式交叉檢查；正式有限燃燒的預覽／執行差以收斂測試判定，不強求瞬時公式完全相同。
- 三個指定配對變體（120 kg／600 km、150 kg／800 km、180 kg／1000 km）全部有可完成路徑；學生不必知道開發測試的控制序列。
- 60/30/15 fps、不同快轉倍率、暫停／恢復下，同一控制序列的終態在數值容差內一致。

## Responsive layout contract

| Decision | Activity specification and reason |
|---|---|
| Three regions | Header：標題、任務 A／B／紀錄導航、共享全屏。Stage：3D、簡潔讀數、鏡頭控制。Panel：部件或當前飛行控制、單一主要動作 |
| Fullscreen | 整個活動根節點 data-sim-fullscreen-target，header data-sim-fullscreen；shared/fullscreen.js，44 px 可按區，20 px 圖示 |
| Desktop / tablet | ≥960 px：stage＋約 320 px panel；stage 至少約 65% 可用寬；橫向短畫面 ≥640 px 且高 <520 px 採兩欄，panel 約 40% 寬 |
| Control-panel classification | bounded split-panel；飛行中需要同時看舞台與操作，panel 獨立捲動 |
| Phone stage and controls | 高度扣 header 後名義上 stage 54%、panel 46%；stage 上限 400 px。panel 目標至少 160 px，絕不低於契約 96 px；短視窗先縮舞台／改欄，不縮字 |
| 數字例子 | 390×844、header 約104：stage 約400、panel 約340；375×667：stage 約304、panel 約259。這些是設計預算，需用實際渲染驗證 |
| Phone text | 主字／控制 16 px；次要字≥14 px；關鍵舞台讀數≥16 px；固定寬度 tabular numerals，符號不隨數值位數移動 |
| Viewports | 320×568、375×667、390×844、430×932、768×1024、1280×800、1920×1080、844×390、640×360、390×460 iframe、200% zoom、鍵盤／工具列變動 |
| Scroll topology | 活動根無競爭捲動範圍；panel overflow-y:auto＋contain；舞台空白／側條原生捲動 enclosing owner；T0–T4 實測 |
| 相機 | 工廠斜視／發射跟隨／全地球軌道／軌道正視四個 preset；每種有回正。手機 zoom 用＋／−，不要求雙指精準操作 |
| 讀數 | 初期只顯示 h、沿地面方向速率、燃料；展開才看 h_p、h_a、總速率等。單位固定；飛船後方不掛大面積文字 |
| 動畫敏感／無障礙 | 支援減少動態、關掉鏡頭自動轉場；暫停與鍵盤替代可用；重要結果以文字可讀，不只靠顏色 |

### 3D 效能與故障

- 單一 WebGL canvas，切換場景共享 renderer；dispose 舊幾何／材質，不反覆建立 context。
- 目標首包 ZIP ≤5 MB、無外部請求；畫面約 ≤100 draw calls、≤100k 三角形，手機 pixel ratio 上限 1.5、桌面 2。
- 真機目標持續 ≥30 fps、操作回應 ≤100 ms；首次可操作在測試中階裝置及正常校內網路 ≤5 s。必須記錄裝置／瀏覽器／網路，不能用桌面數字代替。
- 用較低陰影／粒子／地球細節作自動視覺降級，不改物理模型或答案。
- 無 WebGL 2 時展示可讀的技術訊息、已存紀錄和允許的提交／回看入口；不把靜態圖稱為完成的 3D 模擬。
- context lost 暫停並保存可用模型快照；恢復後重建 scene，不扣燃料、不自動點火。恢復失敗仍可保留／檢查已完成部分；pending／review 保持鎖定。
- 本活動的 3D 驗收要求真 WebGL 2；故障狀態的無障礙／scroll／SCORM 路徑另測，不作功能替代。

## Navigation, submission and reset

| Decision | Activity specification |
|---|---|
| Navigation | mixed：A、B、紀錄可直接選；A 的裝配→發射→保留紀錄有資料依賴；B 可用 A 快照或明確選練習初態 |
| Final check access | 所有可編輯階段都有「任務紀錄／檢查並提交」，包括空白工廠、飛行中、未設定節點、失敗後 |
| Incomplete submission | 顯示未保留成果及其零分影響，保留獨立部分分數，允許空白提交；不彈警告視窗 |
| Editable reset | 「回工廠」停止目前試飛並保留裝配；「重新試飛」用當前設計起飛；兩者保留已選任務紀錄。「移除這份紀錄」才清除該份，提供頁內撤銷直到下一次實質編輯 |
| Scored / pending | 無改裝、點火、重試、清紀錄；可旋轉觀察已交成果、改鏡頭及全屏；pending 只開合法同一 payload retry |
| 變更依賴 | 修改裝配只影響下一次飛行，不能改寫已保存紀錄；替換 A 紀錄不改寫正在做的 B 初態，B 明確重新帶入時才更新 |
| 形成性回饋 | 試飛期間允許顯示物理結果、任務目標達成及原因；不顯示正式總分／Moodle 結果，提交後才給正式分數 |

同時只運行一艘飛船。切換 A／B／紀錄頁籤只暫停並切換畫面，不替換目前 flight；另一任務以頁內明確按鈕「結束目前試飛並開始任務 B／重新試飛 A」啟動。按鈕旁說明會替換未保留的飛行狀態，並提供先保留紀錄的入口，不彈確認窗。既有 A／B records 和工廠草稿始終保留；僅觀看另一任務不丟進度。

| Step / question | Required upstream data | If missing or changed | Legal next actions |
|---|---|---|---|
| 裝配 | 載荷變體和槽位 | 部分配置合法 | 編輯、去紀錄、提交 |
| 發射 | 可點火拓撲；推重比不足不是拓撲錯誤 | 缺引擎／箱顯示對應接點；不造設計 | 返回裝配、去紀錄 |
| 保留 A | 學生發起的自建火箭試飛快照 | 未試飛為 null；進行中先暫停 | 保留／替換、繼續、檢查 |
| B 初態 | 可用 A 安全軌道，或學生選練習飛船 | 無初態為合法空白 | 帶入／選練習、檢查 |
| B 節點 | 安全束縛真空軌道、可用燃料 | 無燃料仍可看預覽限制；不補油 | 改計劃、換初態、檢查 |
| 保留 B | 學生確認並已執行至少一段點火 | 初始練習飛船不計分 | 保留結果、再變軌、檢查 |

## Diagrams, notation and assistance

| Decision | Activity specification |
|---|---|
| Notation | h 為離地高度、r 為地心距離；v 用速率讀數，箭頭另標 v 向量；Δv 表示計劃推進變速量；m、F、T、h_p、h_a 的數學字體遵循 baseline |
| 箭頭與路徑 | 推力、速度箭頭與真方向一致；火焰沿推力反向。實際路徑實線、關機路徑短虛線、變軌預覽另一色長虛線＋圖例，不能只靠顏色 |
| 地球／飛船比例 | 軌道位置按同一地心尺度；飛船圖示可放大並標示。局部跟隨視角採浮動渲染原點，model 仍用地心座標 |
| 接點 snap | 手指／滑鼠均 30 CSS px；限可相容可見槽，拖曳期間預覽，釋放用同一解。不要自動選最有利零件 |
| 節點 snap | 手指 24 px、滑鼠 14 px 對可見近／遠地點；一般圓軌道允許自由相位，按鈕同等可用 |
| 油門／姿態 | 油門 5% 操作格、俯仰 2° 操作格，皆可按鈕細調；這是輸入解析度，不是得分容差 |
| Touch preview | 接點附近顯示穩定上角放大實景預覽，因指尖會遮槽；節點顯示軌道局部與已 snap 節點。油門／視角旋轉無須放大，數字旁置即可 |
| 教學輔助 | 自動姿態穩定、暫停、時間快轉、節點執行；不自動替學生安排完整起飛曲線或圓化答案 |

## Touch gesture ownership contract

採 [製作指南手勢契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)。首版不以整個透明 canvas 攔截觸控。相機以明確「轉動視角」模式啟動中央有可見邊界的 orbit surface；普通模式空白仍可捲動 host。

| Target type / modes | Visible footprint / hit area | Capture / touch-action before down | Keyboard alternative |
|---|---|---|---|
| 零件／接點 | 投影到畫面、局部 44 px target；空隙不覆蓋 | 穩定 HTML target，none | 選裝配級＋點零件直接加入、數量增減按鈕 |
| 油門把手 | 44×44 px，位於 panel | none，只把手拖動；panel 其他區正常捲動 | range／±5% |
| 俯仰把手 | 舞台局部圓弧與44 px把手 | none，camera 固定 | ±2°、向上／水平 |
| 變軌節點 | 軌道上局部44 px target | none，camera 固定 | 近地點／遠地點／相位增減 |
| Δv 控制 | panel 中原生 range＋±按鈕 | none 於 range 實際互動區 | 原生鍵盤 |
| 相機 orbit 模式 | 明確可見中央區；兩側各≥32 CSS px | none，穩定 capture；模式離開即移除攔截 | 方向鍵、preset、zoom ± |
| 回放時間把手 | panel 內可見44 px範圍；review只改觀看 | none | 左右鍵 |
| 普通文字、圖例、空白 | 無透明互動蓋層 | pan-y | 不適用 |

| Touch starts on | Owner | Activity strategy | Evidence |
|---|---|---|---|
| 舞台空白／零件間空隙 | enclosing host | pan-y、保持根無捲動 | P4 待跑 |
| panel 中間／頂底 | panel only | contained native scroll，不改 parent styles | P4 待跑 |
| 宣告相機旋轉區 | simulation | 只改相機，不卡主題控制 | P4 待跑 |
| 左／右側條 | enclosing host | 320 px 寬各32 px，其他尺寸至少同寬，overlay不得蓋住 | P4 待跑 |
| 每種拖把手／接點 | simulation | 捕捉穩定，pointermove/up；非 owner 座標固定 | P4 待跑 |
| review／pending 空白 | enclosing host | 移除編輯 targets；允許明確相機控制 | P4 待跑 |

優先原生捲動。若某 Moodle topology 不通，先確認真 owner，再按指南設計及驗證 adapter；不盲目呼叫 parent/top.scrollBy，不改 enclosing overflow 掩蓋問題。

| Host case | Frame chain / actual owner | Origin / mechanism | Evidence |
|---|---|---|---|
| T0 | standalone bounded activity；無外部範圍 | host movement N/A，panel／gesture仍測 | source＋extracted 待跑 |
| T1 | outer document → activity iframe；outer window 為 owner | 中性 same-origin fixture，原生 pan | source＋extracted 待跑 |
| T2 | outer document → bounded wrapper → activity；最外 window | wrapper 不得變 owner | source＋extracted 待跑 |
| T3 | outer document bounded → #player-scroll overflow element → activity | #player-scroll 為 owner，所有 windows 固定 | source＋extracted 待跑 |
| T4 | 實際 Moodle current-window／offered new-window | 記錄實際 origin、sandbox、元素／window owner；未有環境不得猜 | 真手機／Moodle 待驗 |

| Phase / mode | Legal fixture / continuation | Touch coverage |
|---|---|---|
| 空白／部分／完整工廠 | production 加零件、返回修改 | 接點、零件、旋轉模式、空白、側條、panel |
| pad／升空／分級後／滑行 | production launch 和分級 | 油門、俯仰、鏡頭模式、空白、panel |
| impact／escaped／暫停 | 真模型事件或合法還原後繼續 | 非法控制不存在，重試可用、空白可捲 |
| B 未選／選初態／node preview／burn | production 選擇、配置、執行 | 節點、Δv、旋轉、取消、panel |
| check→返回 A／B | 正常導航 | 保存依賴、每種重編輯手勢 |
| review／committed／frozen | shared startup fixtures | 只有觀看／retry，沒有改答案 |
| WebGL unavailable／lost／restored | 真初始化故障／context extension | 技術資訊、保留紀錄、全屏、panel／host |
| 200% zoom／方向切換 | 上述每種不同命中幾何 | target 重新投影、preview無遮擋、最後控制可達 |

所有行在 source 和 extracted package 測 T0–T3、兩方向、快速 flick、panel 邊界、取消、失焦、第二指及 pointer capture。記錄每次 move／release 的 owner、所有非 owner 與 canonical 答案；連續飛行時間另列，不能用它掩蓋手勢改答案。T4 驗收與桌面可信觸控分開記錄。

## Scoring and tolerance

採 **100 分形成性任務成果評量，60 分達標**；不是競速或「一次成功」測驗。評分只讀學生按「保留為任務紀錄」選定的快照；展示／練習預設不自動給分。

| Rubric component | Points | Exact condition |
|---|---:|---|
| A：可起飛設計 | 10 | 已保留自建／學生發起試飛紀錄；合法裝配，當時完整初始配置的滿油門起飛推重比 >1.05 |
| A：到達太空高度 | 10 | 同份紀錄的當前高度 h ≥100 km；在該高度可隨時暫停保留，不必完成整圈 |
| A：安全束縛軌道 | 20 | ε<0、h_p≥150 km、h_a≤1000 km，該快照未 impact/escaped |
| A：目標接近圓軌道 | 20 | h_p及h_a都在200–400 km，e≤0.03；由 r/v 重算 |
| B：遠地點到目標 | 15 | 已保留學生實際執行點火後紀錄；束縛軌道，h_a在目標高度±10% |
| B：近地點到目標 | 15 | 同類合法點火後紀錄；束縛軌道，h_p在目標高度±10% |
| B：完成圓化 | 10 | h_p、h_a均在目標帶且e≤0.03、安全；不要求使用固定兩次點火方法 |

- A 的四項分開判定；B 可用練習初態獨立取得分數。不同合法設計／點火策略都按結果評分。
- 自建配置與保留飛行狀態來源必須一致。修改工廠草稿不改已保存 record。
- 空白 record = null，該任務零分；完全 untouched attempt =0。沒有「已按過幾次」分數，不因失敗次數或耗時扣分。
- 練習初態 B 必須真的開始燃燒、推進劑減少，才有可保留的 B 證據；載入練習飛船本身零分。
- 真正任務成果會即時顯示，符合探索取向；正式分項得分只在提交後給出。
- 保存全精度，畫面才四捨五入。高度界線包含端點；數值比對 epsilon =1 m，e epsilon=10^-6；TWR epsilon=10^-6，ε束縛要求嚴格為負。
- 例：h_p=149,998 m 不得算安全，150,000 m 可；800 km 目標帶720–880 km，719,998 m 不通過；e=0.03001不通過。
- 拖放 snap 容差獨立於上述評分容差；模型積分誤差必須比評分帶窄得多。
- 重試保留上一份紀錄；學生選擇新紀錄後才替換，不自動挑歷來最高分。

## Phase/state matrix

以下是 activity 的語義 phase；running／paused 是模擬暫態。Moodle 恢復一律停在同一物理時刻等待繼續，不自動扣燃料。

| Phase / variant | Required semantic state | Absent / retained | Legal continuation / check |
|---|---|---|---|
| workshop：空白／部分／完整 | variant、editable craft；部分件允許null | flight可null，兩份records可null | 組裝；合法後到pad；任意檢查 |
| pad：可點火／推重比不足 | 不可變flight craft、滿箱、r/v初態、t=0 | 沒有node/burn | 點火、回工廠、檢查 |
| ascent：燃燒／關機／一級耗盡 | flight物理狀態、控制、燃料 | node=null | 繼續、關機、分級、保留、檢查 |
| ascent：分離後 | active=1、下級已移除、上級燃料合法 | 不可再分級 | 再點火、保留、檢查 |
| coast：束縛／未安全／非束縛 | 無推力、可重算軌道或無束縛標記 | records保留 | 繼續、點火、停下保留、檢查 |
| ended：impact／escaped | 終止事件狀態、t>0 | 目前run不可繼續飛 | 回工廠／重試、看紀錄、檢查 |
| mission：B尚未選初態 | flight=null、node=null | A與B已選records可保留 | 明確帶入A／選練習、檢查 |
| mission：B初態／滑行 | source=own或practice，合法安全軌道 | B零操作也合法，record仍null | 放node、繼續、檢查 |
| planning：未完整／有效／燃料不足 | B flight＋node；node量值可0 | 不足可顯示但不能宣稱成功 | 改node、取消、可執行時確認、檢查 |
| armed：等節點 | B flight、已確認node且事件未到 | 上一次burn可保留，開始新燃燒才替換 | 滑行至點火、取消、檢查 |
| burning：進行／中途關機 | burn含初態、已消耗量及累積Δv | node仍保存作審查依據 | 繼續／關機、保留已完成部分、檢查 |
| check：空白／部分／完整 | records可null、backPhase有效 | 飛行暫停但完整保留 | 明確submit、回原工作繼續 |
| review：成功／committed | canonical review answer；無可編輯flight | 已交record可部分／空白 | 觀察／全屏；committed只finish retry |
| frozen：合法／無效pending | shared envelope；合法者可重算 | 不可改records | 同payload retry；無效者quarantine |
| technical：load/render error | 可判可信資料及錯誤種類 | 不能創造成功狀態 | renderer可恢復／已知可編輯者檢查；LMS不明者技術鎖 |

| Transition / trigger | Preconditions | State changes / downstream effects |
|---|---|---|
| 換零件 | workshop且editable | 只改下一次craft；不改records／舊flight |
| 開始試飛 | 完整拓撲、學生確認 | 新flight不可變配置；records不清 |
| 保留A／B | 合法自建試飛／已執行B點火 | B若仍燃燒先暫停並關機，標記interrupted；克隆該狀態與來源，替換對應record |
| 檢查 | 任一editable phase | 暫停，不丟flight／node，記backPhase |
| 從check返回 | 尚未提交 | 還原phase、保持暫停，讓學生明確繼續 |
| 提交／pending | shared outcome | 清所有拖曳、停止積分；按合法結果鎖／恢復編輯 |
| context loss | 任意phase | 相同語義phase＋暫態render fault；不把它變成新attempt |

## Persistence contract

採 [snapshot/restore contract](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract)。以下為精確語義欄位；序列化短鍵／tuple 由 schema v1 固定映射，不在不同phase改變意思。

### 權威型別

| Type | Exact schema / validation |
|---|---|
| Craft | {payload:0或1或2, stages:[Stage或Stage,Stage], separator:boolean}；workshop的stage engine可null、箱數可0，最多兩級；flight必須完整。stage次序由下至上 |
| Stage | {engine:null或0或1, small:0..4整數, large:0..4整數}；0=大推力、1=高效率；small+large≤4，flight時≥1；不保存計算所得重量 |
| VectorState | [x,y,z,vx,vy,vz] 六個finite number；z/vz必須0；空間半徑與速度設定合理上限，impact狀態允許邊界接觸 |
| Controls | {mode:tilt或prograde或retrograde, angle:0..180, throttle:0..1, lit:boolean}；angle單位degree，模型姿態另保存 |
| Flight | {source:own或practice, craft:Craft, t:finite≥0, state:VectorState, fuel:[p0,p1或null], active:0或1, separated:boolean, attitude:0..2π, controls:Controls, status:pad或flying或impact或escaped}；attitude為xy平面從+x計的慣性姿態rad，與當地俯仰不同 |
| Node | null 或 {at:periapsis或apoapsis或phase, angle:0..2π, direction:prograde或retrograde, dv:0..2000, confirmed:boolean, fireAt:null或finite≥0}；angle採同一地心平面；近圓採phase；確認時求出模擬時刻fireAt，恢復不延至下一圈 |
| Burn | null 或 {status:active或completed或interrupted, before:VectorState, beforeFuel:[p0,p1或null], startTime:finite≥0, achievedDv:finite≥0, targetDv:0..2000, direction:prograde或retrograde}；實際減燃料且時間增加才構成已執行；燃燒結束後保留到下次點火或新試飛 |
| ARecord | null 或 {craft:完整Craft, state:VectorState, fuel:[p0,p1或null], active:0或1, separated:boolean, t:finite>0, status:flying或impact或escaped}；只能由own run的保留動作產生 |
| BRecord | null 或 {source:own或practice, craft:完整Craft, before:VectorState, after:VectorState, fuelBefore:[p0,p1或null], fuelAfter:[p0,p1或null], active:0或1, separated:boolean, elapsed:finite>0, direction:prograde或retrograde, achievedDv:finite>0}；保留最後一次已完成／中止點火及其後滑行狀態 |
| Draft answer | {schema:1, modelVersion:1, variant:0..2, phase:editable枚舉, backPhase:null或editable枚舉, craft:Craft, task:A或B, flight:Flight或null, node:Node, burn:Burn, records:[ARecord,BRecord]} |
| Review answer | {schema:1, modelVersion:1, variant:0..2, records:[ARecord,BRecord]}；無flight/node/camera，足夠重算／重畫已選成果 |

- 三種 variant 固定映射載荷120/150/180 kg及B目標600/800/1000 km，避免不必要的任意連續隨機值；同一attempt不得重抽。
- 無回答用明確 null／空配置；欄位缺失、非法enum、負燃料、重複分級、craft/fuel容量不符、stage倒置是無效資料。
- flight craft是當次出發設計，與workshop草稿可以不同；records是獨立凍結選擇，不能以「與最新草稿不同」為由丟棄。
- B帶入A時克隆已保留安全軌道的配置、r/v、燃料和級狀態，油門／點火歸零，B時鐘從0開始。練習飛船固定單級高效率引擎＋1小箱（1500 kg推進劑）＋variant載荷，無分離器；初始r=(R+300000,0,0)、v=(0,√(μ/‖r‖),0)、t=0。不提供自訂初始速度輸入；record來源驗證不等於防篡改。
- 首版B不分級；不改飛行配置。單級active=0、separated=false；兩級分離後active=1、separated=true，下級fuel欄固定0，不以null冒充仍可用級。
- 未確認node的fireAt=null；armed的fireAt≥flight.t，開始燃燒時startTime=fireAt且burn.status=active；中斷／完成轉為滑行並保存burn。重開Moodle先暫停，明確繼續後才接續原燃燒。
- task指出目前試飛所屬A或B；頁籤viewTab是暫態，還原預設回目前任務。只切頁籤不改task、phase或flight；check才以backPhase保存返回點。
- before/after必須是同一stage／配置，燃料減少、時間正向，無非有限值；重新計算軌道和質量，不信任保存的成功旗標、分數、h_p/h_a、TWR。
- 數值邊界：t≤604800 s；|r|在R附近至R+10^8 m；|v|≤30000 m/s；燃料≤各級容量；超出UI可產生範圍拒絕，不能偷偷clamp成另一個合法答案。
- 長時間運行到界線前自動暫停並提示本次任務範圍；不可先寫入無法還原的值。
- 精確的能力／相依驗證用production constructor和mutation路徑建立fixtures；不能由測試捏造另一套state。

| State category | Treatment |
|---|---|
| Authoritative | 上述configuration、當前物理狀態、控制、node/burn、選定records和phase |
| Transient | pointer、hover、snap preview、DOM、Three物件、renderer錯誤狀態、running、viewTab、快轉倍率、相機及600點試飛回放；還原為暫停／預設可讀鏡頭 |
| Derived | 總質量、推重比、軌道參數、HUD文字、所有網格／軌道line、得分與過關徽章 |
| Version compatibility | schema=1/modelVersion=1；未知版本不重新解釋。參數調整在發佈前完成；已發佈更動需明確新版本與遷移或舊版本支援 |
| Size | Draft目標≤3200 UTF-8 bytes；review目標≤2200；包含shared pending-final的轉義reviewJson後仍≤4000。P1先用最大兩級／兩份records／active burn狀態量測 |
| 超出大小 | 禁止交付超標方案；先縮短固定鍵和省去derived，不降精度、不刪已選成果、不用外部儲存繞過限制 |
| Invalid editable | 只有shared狀態確認未提交才提供頁內「重新載入空白草稿」並清理覆寫；預設不自動丟答案 |
| Invalid finished | 持續鎖定，只顯示可信LMS摘要，不偽造可回看的3D成果 |
| Invalid pending | quarantinePending後技術鎖；不retry受污染內容，不開放重設 |

saveDraft在裝配完成動作、點火／關機／分級、暫停、node確認／取消、保留紀錄及導航時發生；不在pointermove或每幀commit。setDraftProvider回傳最新完整物理狀態，shared lifecycle負責離開頁面時的保存。保存／恢復不得額外消耗燃料。

## Shared SCORM lifecycle

使用 shared/scorm.js、shared/activity-flow.js；startup用loadAttempt＋startup，submission用submitWithCallbacks＋submission，四個outcome共用同一路由。

| Outcome / policy | Handler |
|---|---|
| editable | 新建或合法還原draft，註冊provider，飛行暫停待繼續 |
| review | decode→rescore→reviewResult比較；可信時重畫records及得分，全部已交操作鎖定 |
| frozen | 驗證nested review及canonical answer，合法才retry同payload；無效quarantine |
| load-error | 技術鎖，保留錯誤與可信摘要，不標示已交／不合格 |
| success | 已確認提交，read-only |
| committed | 已commit但finish失敗，成果保持鎖定，只提供finish retry |
| frozen submission | 不能確定完成，凍結答案，顯示待確認，不顯示確定分數 |
| retry | retryable=true可回到編輯／重試；false顯示技術失敗，不聲稱已交；飛行保持暫停 |
| trust mismatch／unknown | 不用本地旗標覆寫LMS結果；unknown用不確定標籤 |
| Standalone refresh | memory-only，刷新空白新練習；不讀／寫持久答案，storage denied也可用 |
| Moodle resume | 同attempt保留草稿、已交或pending；新attempt只能由LMS建立 |
| Render failure | 物理／答案仍在記憶體及合法草稿；renderer可復原。LMS技術失敗不得當standalone繼續 |

## Test plan

### 有意義的測試與檔案

| Test | Required executed evidence |
|---|---|
| model.test.js | 質量／耗油、推力、pad支承、分級守恆、撞地、RK4收斂、快轉與fps無關、三變體可完成及失敗對照 |
| orbit.test.js | 圓／橢圓／徑向／逃逸邊界；r與h區分；短時變速解析對照；finite-burn preview與實際執行一致 |
| scoring.test.js | 空白0、所有獨立部分分數、練習初態零分、practice不給A分、合法不同策略、所有容差just-inside/outside |
| persistence.test.js | 每個phase/variant真encode/decode/restore並執行一個合法下一步；最大draft/review/pending≤4000；無效欄位／依賴／版本測試 |
| interaction.test.js | 接點選擇、capture/cancel、相機與物理控制分開、node修改／取消、check返回、record替換不污染另一任務 |
| lifecycle.test.js | 實際production outcome/render，startup四態、submit四態、retryable真假、invalid final/pending、trust mismatch、unknown |
| tools/rocket-space-mission-browser-regression.js | source與extracted ZIP：組裝→試飛→保留→B變軌→提交→還原；可信touch、全屏、WebGL初始化／丟失／恢復、console與request錯誤 |
| 既有mobile-scroll runner | 登記本活動完整phase/mode表，T0–T3 source/package；T4手動部署證據獨立 |

固定回歸序列只作開發驗證；不將一組答案寫成學生必須照做的流程。圖形檢查實際看見火箭、地球、軌道、數學標籤，不只檢查canvas存在。

### Test registration and CI selection evidence

| Item | Activity decision / executed evidence |
|---|---|
| Runtime resource declaration | sim/manifests/rocket-space-mission-lab.xml列全部runtime、Three兩個module、LICENSE和四個shared檔；scope由manifest反向依賴 |
| Logical entries | sim/rocket-space-mission-lab/model.test.js、orbit.test.js、scoring.test.js、persistence.test.js、interaction.test.js、lifecycle.test.js；全入registeredTests |
| Browser owner | file=tools/rocket-space-mission-browser-regression.js，kind=browser，scope=rocket-space-mission-lab；同entry跑source與package，不重複登記 |
| Case helpers | 首版盡量使用現有helper。新增專屬helper須依 *-browser-cases.js命名，登記helpers及真實import consumer |
| Manual gates | 沿用已登記mobile-scroll矩陣作部署檢查；若新增獨立runner須列manualBrowserTests、scope及原因。真手機／Moodle不是免測理由 |
| check:tests | P0無新測試／runtime；實作後每新增entry執行並記結果，現階段待執行 |
| committed selection | 實作commit後跑 npm run test:affected -- --base=<已驗證main SHA> --head=HEAD --plan；記錄確切SHA、owner browser及package |
| full verification | 初次registry/catalogue變更預期全範圍；dependency／shared變更亦全範圍，不繞過CI選擇 |
| GitHub evidence | 實作後記錄run URL／SHA／狀態；不等CI才給試用連結，但不得將pending當passed |

- [ ] 空白／部分／不同策略和容差邊界評分已通過。
- [ ] 每個可編輯phase可進檢查並提交；recorded/pending無清除／重啟。
- [ ] phase/state matrix所有行以production schema round-trip並執行合法continuation。
- [ ] invalid-state矩陣及含轉義pending的4000-byte上限已執行。
- [ ] source及extracted standalone刷新清空，Moodle同attempt恢復；舊checkpoint／storage denied不污染新standalone。
- [ ] 所有3D故障／低畫質／手機尺寸／文字／snap／preview路徑已驗證。
- [ ] shared fullscreen在editable/review/pending及denied狀態均通過。
- [ ] source與extracted全部T0–T3可信手勢、release、邊界及不變量通過。
- [ ] registration和committed selection證據完整。
- [ ] 實測效能及物理校準達標，或明確調整並重新審查交付限制。

## 實作分期與審查點

| Phase | 具體交付 | 驗收及提交節奏 |
|---|---|---|
| P0 本輪 | 本分支＋完整計劃 | 文件連結／模板章節／diff檢查；commit＋push計劃，等待使用者審查 |
| P1 風險驗證 | Three場景基礎、可測physics／orbit、最大snapshot草模；一組真正可入軌及變軌序列 | 核對WebGL手機候選、物理收斂、燃料可行性、SCORM容量。只稱技術預覽；測試後commit＋push，有可見版本才部署Sites |
| P2 工廠與發射 | 完整拖放／點選組裝、飛行控制、分級、相機、診斷及A紀錄 | 手機操作＋A實際成功／失敗路徑；commit＋push＋Sites試用 |
| P3 軌道任務 | B獨立初態、節點預覽、有限燃燒、圓化、紀錄與最終rubric | 所有變體／邊界、兩種不同策略；commit＋push＋Sites |
| P4 整合與package-ready | 完整SCORM lifecycle／restore、manifest/catalogue/registry、全屏、故障恢復、README | package-ready全套、source/package矩陣、完整必需測試；commit＋push＋部署並報CI狀態 |
| P5 Moodle-ready | 真Moodle學生attempt及真手機驗收紀錄 | 真實提交／續做／pending／review及T4；只有證據具備才標Moodle-ready |

每輪更新此計劃的實際證據。Sites使用本活動獨立站點，封裝當前commit的完整相對路徑資產；部署後核對build標識、network、實際入口及手機布局。第一次有runtime時才建立站點，不部署只有計劃的空頁。部署操作屆時遵循Sites skill與工具契約。

### 需在P1消除的風險

| 風險 | 具體處理／停止聲稱完成的條件 |
|---|---|
| 3D手機效能或WebGL不支援 | 實機量測、降視覺成本；未通過前不聲稱手機ready，不用靜態替代冒充3D完成 |
| 火箭看似合理但無法入軌 | 先證明動力與控制可行，再裝飾；校準零件參數須更新modelVersion決定和所有相關fixture |
| 1000×引起穿地或漏事件 | 步長不放大、定位事件、限制每幀步數；同控制序列結果一致 |
| 座標尺度使近景抖動 | 地心double model＋camera-relative render；軌道／近景轉換測試 |
| 節點預覽與實際不一致 | 同有限燃燒模型、重算初態、驗證耗油與停止條件，禁止理想圖冒充可執行結果 |
| SCORM裝不下飛行草稿 | 最大shape及pending-first驗證；不存路徑／Three物件；不犧牲恢復或精度 |
| 太多控制使學生只忙操作 | 初期平面飛行、姿態穩定、暫停、分情境panel；P2用手機完成整條流程再定稿 |

## Package-ready checklist

- [ ] 決策、phase/variant、rubric、snapshot和所有證據齊全。
- [ ] 小手機、短iframe、橫向、200% zoom保持可讀、控制可達，符合本計劃panel預算。
- [ ] npm run check、npm test、npm run package:all通過；記命令、版本、報告與ZIP位置。
- [ ] npm run package -- rocket-space-mission-lab產生獨立ZIP；根有imsmanifest.xml。
- [ ] 每個runtime資產宣告完整，無CDN、測試fixture或開發檔進包；斷網仍可載入既有本地資產。
- [ ] git diff --check及實際base差異檢查通過。
- [ ] built/extracted啟動、完整任務、SCORM、可信手勢與全屏通過。
- [ ] Windows瀏覽器檢查遵循製作指南Git Bash路線；CLI即使exit 0但含「### Error」也視為失敗。
- [ ] Sites部署與提交SHA一致，試用入口經驗證；CI狀態如實回報。

## Moodle-ready checklist

- [ ] package-ready已達成；真Moodle學生帳號提交分數／status成功。
- [ ] 未完成flight草稿恢復到相同時刻並暫停，燃料／裝配／node／records一致。
- [ ] pending重試、committed finish retry、完成後review-only及LMS新attempt符合契約。
- [ ] T4真手機完整phase/mode手勢矩陣，在current-window及提供的new-window player執行，記實際owner與origin。
- [ ] WebGL初始化及context復原在目標手機／Moodle iframe可用。
- [ ] 高風險server驗證：N/A，本活動僅形成性；不可把此項解讀為可用於高風險考試。
- [ ] 真Moodle、真手機及尚未驗證限制與本地證據分開列明。

## 參考與P0證據

- [Three.js WebGLRenderer官方文件](https://threejs.org/docs/pages/WebGLRenderer.html)：WebGL 2需求；查閱2026-10-24。
- [Babylon.js Havok整合文件](https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin/)：一般剛體引擎與WASM整合；用於技術比較，不是本活動依賴。
- [NASA Rocket Thrust Equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/) 與 [Specific Impulse](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/)：推進與耗油關係。
- [NASA Ideal Rocket Equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/)：僅作理想Δv預算與模型測試。
- [NASA Gravity & Mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-4/)：入軌和近／遠地點變速的教學物理。
- 現有 [重心3D renderer](../sim/centre-of-mass-investigation-lab/part3-renderer.js) 與 [其manifest](../sim/manifests/centre-of-mass-investigation-lab.xml)：確認本地Three版本／資源打包模式；不把舊活動手機證據套用到本活動。
- P0文件檢查（2026-10-24）：node tools/check-docs.js plans/40-rocket-space-mission-lab.md 通過；模板全部14個二級章節齊全；Markdown表格欄數一致。提交前另以git diff --cached --check檢查實際新文件差異。
- P0只提交本計劃至codex/rocket-space-mission-lab；commit SHA及push結果以Git紀錄和本輪交付回覆為準，不在文件內預先宣稱遠端成功。
- 上述為P0設計紀錄；實作證據及與初始規劃的差異如下，不將預算當成已通過結果。

## 實作紀錄與驗證證據

### P1–P3：模型與可操作版本（2026-10-24）

- 已完成本地Three.js 3D工廠、跟隨／地球／正視鏡頭、點選與拖放組裝、發射／油門／俯仰／分級、任務B節點與有限推力預覽及執行、任務紀錄及共用SCORM流程。
- 已執行六個活動Node測試：model、orbit、scoring、persistence、interaction、lifecycle均通過。三載荷均由真實推進、阻力及重力積分入軌，三目標均由兩次有限燃燒達到40分；合併A/B成果為100分，未操作／練習初態為0分。
- 第二種設計亦已驗證：下級3大箱／大推力引擎，上級1大箱／高效率引擎，150 kg載荷，約202–217 km軌道且剩餘推進劑；與4大箱方案採不同轉向控制序列。
- 真空10圈能量／角動量漂移、火箭方程、分級、低推重比台面支承、撞地與逃逸邊界已測。逃逸fixture由兩次實際2000 m/s推進產生，並在100,000 km範圍邊界停止。
- 草稿／review採固定tuple codec，保留原始double精度、恢復固定平面零分量；包含最大草稿、active burn、兩份成果及轉義pending的容量測試通過。tuple欄位由persistence.js固定，與上方語義schema對應。
- 續做會暫停；已確認節點保存fireAt，燃燒保存active／completed／interrupted；pending另保存不可變canonical比較字串，防止同分但不同答案的重試。
- 任務B的可操作安全界線為近地點≥150 km、遠地點≤20,000 km，與A評分界線分開，容許1000 km目標附近的有限燃燒誤差及探索；超出總範圍的束縛軌道只暫停，不錯稱逃逸。
- 此版提供本頁600點最近實際路徑，未加入時間軸回放控制；Moodle保留權威飛行快照。
- npm ci --no-audit --no-fund使用既有lockfile，未新增／升級依賴。三維vendor與既有來源hash相同。
- npm run check:tests：278 entries（240 Node、38 browser、48 helpers、2 manual）；npm run check通過。
- 第一輪source／extracted ZIP browser已通過20個桌面／手機布局、可信零件／節點拖動、操作、提交、續做、pending／finish retry、standalone刷新、全屏與真WebGL context loss／restore。後續改動須以P4最終報告runtimeHash重新核對。
- 真手機效能、校內網路首載與真Moodle尚未執行，不能稱Moodle-ready。
- Sites已建立獨立private項目appgprj_6adc62579ab88191aba299bcb282ce95；身份亦即時保存在本地專用Sites checkout的.openai/hosting.json，避免重建同一站點。發布結果待P4補記。

### P4：試用版交付證據（2026-10-24）

- 最終程式提交：00d37e065670c78e60f5c6361e0818c2cad1cc38；專用分支已push。其後文件提交不改runtime。
- 最終活動browser報告：output/playwright/rocket-space-mission-lab/report.json，completed=true、errors=[]；runtime SHA-256為69a1b513de4f5c5d333be2f85012ff07ac1477e3460db6c56c7436852a04f00d。source及extracted ZIP的20個布局、桌面／橫向手機變軌、可信拖放、放大預覽避讓、空白／100分提交、續做、pending／finish retry、全屏、context loss／restore及繪圖例外後保留答案並提交均通過。
- 完整觸控矩陣：source及package的T1/T2/T3各40 cases，standalone source／package的T0各14 cases；共268 cases、2304 gestures、0 issues。證據位於同目錄scroll-source-T1/T2/T3.json、scroll-package-T1/T2/T3.json、scroll-standalone-T0.json、scroll-standalone-T0-package.json。相機／節點包含完成、取消、第二指、失焦及lost capture；真手機T4仍未執行。
- 全項目Node回歸：240/240通過，output/tests/rocket-full-node.json；後續新增即時節點與最大兩級active-burn草稿測試亦已專項重跑通過。
- npm run check、npm run check:tests及npm run package:all通過，證據為output/rocket/check-final.log、registry-final.log、package-all-final.log。所有SCORM包均已驗證；本活動ZIP為output/rocket-space-mission-lab-scorm.zip。
- 已提交選擇預覽記錄於output/rocket/committed-selection.log；新增catalogue／registry選取全量檢查。GitHub Quality未等待完成；額外全項目browser回歸已停止以免拖延交付及繼續佔用本機資源，其不完整報告不作通過證據。活動專項browser及上述觸控矩陣均已完成。
- 試用站：https://simlab-rocket-space-missions.ieyp.chatgpt.site （owner-private）；最後觸控修正已成功部署並保持同一網址；Sites來源提交e1aaa059b9788dfaed8c8adbf0ea55d82d289857，deployment appgdep_6adc6ed5d6308191be8351d28324a509，native結果succeeded。站點build-info.json記錄來源commit及ZIP hash。
- 交付定位：可操作的形成性SCORM試用版。package-ready的全量回歸gate仍待確認；Moodle-ready未達成，真Moodle／真手機／校內網路效能尚未驗收。沒有聲稱完整飛行影片、三維自由軌道傾角或多天體任務。

### P5：首次操作回饋修正（2026-10-24）

- 使用者回報按「下級」、控制區按鈕及拖放看似無反應。本機可信滑鼠事件未重現全部失效；確認舊流程中零件按鈕只選取、未選零件按接點會無聲返回，且拖曳沒有隨指標移動的零件標示。
- 改為預設裝配主級，點一下零件即加入；兩級時先選目前裝配級。舞台接點改為選級，與控制區同步標示；相同引擎、箱數上限及放錯位置均有頁內回饋。新增滑鼠／觸控共用的拖動標籤與30 CSS px接點容差；release先清除active，避免lostcapture重入。拖動標籤位於fullscreen目標內，不攔截輸入。
- 保留原配色與三區布局；手機先展示級數及零件，載荷資訊移至其後。「拖動視角／結束轉動」明示相機模式。快照schema、評分、物理模型及已保存答案未改。
- 六個活動Node測試通過；npm run check:tests通過（278 entries）。最終活動browser source及extracted ZIP完成20種布局；各有桌面可信滑鼠、手機可信觸控從空白裝配開始，Enter鍵加入、編輯區移除、兩級選擇、箱數上限、滑鼠／觸控拖放與取消、點火推進、任務B、提交／鎖定／續做／重試及全屏／WebGL故障恢復通過。報告completed=true、errors=[]，runtime SHA-256：0f8beeeea84963e700e859908b6196cf85f7820e4cfa94f6f6d1434639c75d46。
- 舊P4全觸控矩陣屬當時版本；本次僅重跑本活動專項，沒有重跑全庫Node／browser或完整觸控矩陣。真手機與真Moodle仍未驗證，不宣稱已重現並排除使用者裝置的所有失效。
- 修正版已commit／push：8f726c809e6e42f3a263165280e0593c73a0cc83；Sites來源ca5be107437f45aaafb6b054430bf38c6920f87b，deployment appgdep_6adc7313a6688191bbc2bccb7dd4ac5a native結果succeeded，保持原owner-private網址。ZIP SHA-256：1622b3af9a07b25c497b226487bf54e922beb3d301ec1d3bb8049db628b57d40。未等待CI。

### P6：拖入／拖回及連續升空環境（實作決策，2026-10-24）

- 依使用者指定參考Circuit Workbench的palette preview、有效snap、release提交、取消復位及panel discard。只參考手勢，不改電路共用核心。變更範圍為本活動parts/model、interaction、scene、main、HTML/CSS、既有Node／browser測試及本計劃；不新增依賴。
- 元件箱拖入：引擎只可入空的引擎位，燃料箱只可入未滿四箱的燃料位；拖錯位置不修改答案。保留點選／鍵盤加入及數量控制作替代操作。舞台上的已裝引擎或燃料箱可直接拖走，放回元件箱（控制區）才移除，亦可移至另一個相容級；未放到有效位置、取消、失焦或失去capture均回原位。衛星載荷與兩級分離器由任務／級數決定，不能作散件移除。
- 已裝零件採實際3D幾何raycast；單一穩定HTML grip貼合可拖零件的畫面投影及局部touch halo，不攔截周圍空白或側條。元件箱及安裝拖動均有實際零件外觀預覽；相機在拖動中固定。只在有效release執行一次model change及共用保存，預覽不改答案。
- 沿用權威craft的每級engine／small／large計數，不新增持久id或改snapshot版本；同類燃料箱可互換。新增原子transfer action，同時驗證來源存在與目的相容後才搬移或移除；不污染既有flight／records。評分／SCORM／phase/variant matrix均沿用現行契約；workshop可改，check／pending／review均不可改。
- 飛行在同一局部地平座標顯示發射台、地面、道路、樹木／建築及雲層；場景位置隨實際飛船位置連續改變，不再以是否剛離地切掉地面。依高度連續變暗的天空、漸現星空及高空地球曲面建立高度參照。跟隨鏡頭逐漸拉遠，火箭圖示適度放大並明示，物理計算仍用原本真實尺度。背景只是教學視覺，並非地理重建或大氣光學模型。
- 驗證：既有六個Node測試加入相容性、原子移除／搬移、失效目的不動及保存往返；本活動source＋extracted ZIP browser驗證可信mouse/touch拖入／拖回／搬移／錯位／取消，原有提交鎖定及手機布局，並檢查點火前後地面連續、不同高度天空漸暗與圖像預算。真手機／Moodle及全庫回歸不以本次本地證據代替。

- P6完成證據：六個活動Node測試通過（含相容性、原子搬移／取出、check不可改、保留已有A紀錄、移除後codec往返）。npm run check、npm run check:tests、文件及diff檢查通過。
- 最終source／extracted ZIP專項report.json為completed=true、errors=[]；runtime SHA-256：290f0f03e1f33294605287b911412b4decd0c60108b1739b835e8c68cefc0ace。兩份產物各驗證1280×800可信mouse及390×844可信touch的完整拖入／拖出／移級／錯接／已有引擎拒絕／取消復位；直接拖到實體接合處亦可吸附。記錄實際pointerdown目標，拖動期間panel／stage／visualViewport／相機保持固定；點選已裝零件同步目前裝配級。共用check／submit／pending／review、全屏與WebGL故障測試仍通過。
- 同一真實模型的直上飛行在1 m、約100 m、1 km、20 km、50 km、69 km、71 km、100 km、140 km採樣；地面／發射台位置隨高度連續，天空fraction單調由0至1，70 km附近無跳色。實際畫面人工檢視1 m／1 km／20 km／71 km／140 km及手機組裝截圖；高空globe作背景、詳細地面負責depth，避免兩個表面相交閃爍。採樣最高77262 triangles、58 draw calls，在原圖像預算內。
- ZIP：output/rocket-space-mission-lab-scorm.zip；圖像及報告：output/playwright/rocket-space-mission-lab/；靜態檢查：output/rocket/check-p6.log。此證據限本地Chrome及模擬觸控，未重跑全庫browser／完整iframe觸控矩陣，未驗真手機／真Moodle／校內效能。未等待CI。
- P6已commit／push：e14d77ae1440c3a15cba496a176982780e4ad18b；提交選擇預覽output/rocket/selection-p6.log已產生。Sites來源1374c85b32d126f3c66127e5571e105f11572a2d，deployment appgdep_6adc8303394881918f0cfdafb5f2b0ca，native結果succeeded，維持原owner-private網址。ZIP SHA-256：3023b99e881620bc8d11a517778071b8e76073b75d8bd8dbd076eb80d4f549fa。


### P7：手機滾動、獨立手柄及原位裝配預覽（2026-10-24）

- 元件卡圖片／名稱／資料使用原生縱向滾動；只有明示「⠿ 拖動」的44 × 44 CSS px以上手柄攔截拖動。卡片輕點及鍵盤Enter／Space仍可加入零件；手柄輕點不安裝。保留舞台已裝零件拖出／移級。
- 組裝不再開獨立放大視窗。有效接點以同一production model action計算臨時craft，在原舞台顯示整枚火箭安裝後的排列，固定相機及原接點幾何；pointerup才提交及保存。離開接點／取消／失焦／第二指／lost capture恢復原模型。變軌標記的既有放大預覽不變。
- 錯位／已有引擎／四箱上限不改答案，舞台顯示短暫「無法安裝」警告。正常拖動中顯示放手安裝提示。評分、快照、SCORM schema、phase/variant及manifest依賴不變。
- 驗證決策：沿用已登記活動browser owner及六個Node測試；擴充可信touch的卡片上掃／下掃、各手柄、原位整體預覽／草稿不變、有效release、無效drop警告、取消及跨級搬移；source與extracted ZIP均執行。真手機／Moodle另列，未驗證前不宣稱通過。

- P7執行證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）及diff檢查通過。沿用既有browser owner，source與extracted ZIP各通過10種布局；各在320×568、390×844及844×390以可信touch從元件圖／名稱／資料開始掃動，面板滾動而答案／LMS草稿／舞台／根視窗／visualViewport不變，沒有開始元件拖動；四手柄均≥44×44 CSS px。
- source及package各有1280×800可信mouse與390×844可信touch驗證：手柄起手、無獨立組裝preview window、原位預覽不改答案／保存、release後craft與預覽完全相同、錯位／已有引擎拒絕、拖回元件箱及跨級搬移。有效接點上的取消、blur及lost capture亦恢復原模型；錯位顯示舞台「無法安裝」警告。保留點選及Enter鍵加入；原有變軌預覽、提交／鎖定／續做／重試、全屏及WebGL故障恢復仍通過。
- report.json：completed=true、errors=[]；runtime SHA-256：dda32d54749e3fab8c4eace101e02fa9b63502a78c9071ae4bd1cafa81a60a97。報告及手機原位／錯位截圖位於output/playwright/rocket-space-mission-lab/。SCORM包：output/rocket-space-mission-lab-scorm.zip；ZIP SHA-256：c83909ad60ee42e8d085addd5ad782c7a8401db7ff5ec091bb3476331c18fab8。未重跑全庫Node／browser及完整iframe觸控矩陣；真手機、真Moodle、校內效能仍未驗證，未宣稱Moodle-ready。
- P7已commit／push：d20e220f1a74c7affa370817197ca16055587fcd；提交選擇預覽output/rocket/selection-p7.log已產生。使用者明確要求再部署後，Sites來源6c3639cc35f8d3bce20a14c29bc11a85e268239a、deployment appgdep_6adc965cbbf08191819b2917fb168408，native結果succeeded，維持原owner-private網址https://simlab-rocket-space-missions.ieyp.chatgpt.site。此輪僅部署已驗證產物，未重跑測試或等待CI。


### P8：拖動中即時失效提示及緊湊頂欄（2026-10-24）

- 修正P7只在放手後提示的缺口：零件在舞台內未對準相容接點時立即顯示「無法安裝」，持續按住不逾時；移至有效接點、離開舞台、取消或返回元件箱即清除。從palette拖回控制區視為取消，不顯示安裝錯誤；已裝零件拖回元件箱仍為正常取出。invalid release保留短暫提示。
- 頂欄移除英文品牌／標語，狀態移入操作面板；桌面短標題與導航同列，手機只保留同列三個導航與共享全屏控制。保持按鈕≥44 CSS px、不遮擋、不橫溢。標題仍可供輔助技術讀取；不改共享樣式。
- 變更限本活動HTML/CSS、interaction/main、既有browser owner及本計劃；物理、rubric、phase/snapshot、SCORM與manifest依賴不變。測試沿用六個Node測試及source/extracted ZIP owner，新增未放手即提示、超過2.6秒仍顯示、同手勢失效→有效清除、返回元件箱無錯誤、頂欄高度／導航與全屏可達性。

- P8完成證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）、文件及diff檢查通過。source與extracted ZIP的20種布局，頂欄均53 CSS px，三導航及共享全屏掣均≥44 CSS px高、不重疊、無橫溢；390×844手機截圖人工檢視通過。
- source/package各以1280×800可信mouse及390×844可信touch驗證：零件仍按住時無效位置已有警告，保持2.8秒仍顯示，同一手勢移至空白／有效接點即時切換提示；palette拖回元件箱不改答案且放手後沒有安裝警告，已裝零件拖回仍正確取出。原位預覽／release一致、取消／blur／lost capture、原有滾動、任務、SCORM、全屏及WebGL故障恢復均通過。
- report.json：completed=true、errors=[]；runtime SHA-256：7b2c7be1dedf0ebd1394179d1074dcd0985388eb930440c441bd9efa5fec531c；ZIP SHA-256：d24702cad2eedf7c20fa8f4119dbb6a3560827e0d79e93459fecde8887f82cf4。報告及invalid-held手機／桌面截圖在output/playwright/rocket-space-mission-lab/；ZIP為output/rocket-space-mission-lab-scorm.zip。未重跑全庫Node／browser、完整iframe矩陣；真手機及真Moodle仍未驗證。
- 發布偏好（使用者2026-10-24明確指示）：已批准本活動網站發布，要求同一網站後續修改不要每次重新詢問。對既有appgprj_6adc62579ab88191aba299bcb282ce95、原私人讀者範圍及本活動範圍，完成必要測試後直接沿用授權部署；不增加聊天確認。工具審批層的拒絕仍須如實處理，不得繞過。
- P8已commit／push：ab8749f80e39eb0efbc44708f8f71acad0121918；選擇預覽output/rocket/selection-p8.log。使用者再次明確確認網站發布授權後，Sites來源267cfedf98fcbd60074242bd50655174c214ab5e、deployment appgdep_6adc9e673428819195fafbe48b830c2c，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；發布已測試產物，未重跑測試或等待CI。


### P9：燃料箱接縫插入與重排（2026-10-24）

- 新燃料箱可拖至引擎上方、任兩個燃料箱之間或最上方；同級及跨級的已裝燃料箱可直接拖到接縫重排。引擎仍只在每級底部，每級最多四箱；載荷／分離器沿用任務決定。保留手柄、原生滾動、原位完整預覽、release一次提交、錯位／取消還原與即時警告。
- 最小模型擴充：stage沿用engine/small/large作質量與容量，新增可選order字串（s/l，由下至上）。只在非舊有「大箱在下、小箱在上」順序時保存order；三欄舊stage按原排序讀取。所有改數量、插入、指定ordinal取出／同級移動／跨級搬移同步計數與次序，先驗證目的才原子修改。modelVersion不變，排列不改物理與rubric。
- Snapshot相容擴充：既有schema/envelope仍為1；stage tuple原[engine,small,large]照常讀取，可選第4欄order（最多4個s/l，數量必須相符，canonical次序不重複保存）。draft、flight、records、review與pending均用同一codec。未知欄位、錯誤順序／次數／插入索引均拒絕；4000-byte gate及舊快照回讀需執行驗證。
- UI以每級頂部接點加各接縫的可視標記提供30 CSS px snap；穩定原接點與相機，預覽不改答案。活動outer layer將flat snap target解為stage/at傳入production model；不靠renderer私藏次序。
- 測試：擴充既有model/persistence及browser owner，不新增依賴或test entry。Node檢查首／中／尾插入、重排、精確取出、容量／索引／鎖定、計數守恆、舊新codec及有序飛行／紀錄續做／容量。source/extracted ZIP各以可信mouse/touch在異種箱之間插入、取消、同級重排、跨級搬移，實際預覽與保存一致，並重跑原有回歸。真手機／Moodle仍獨立驗收。

- P9執行證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）、文件與diff檢查通過。新增中間插入、同級／跨級／精確ordinal搬移、滿箱與非法索引拒絕、次序／質量／容量守恆、check鎖定測試；所有變體的舊／新codec、錯誤order拒絕及有序workshop/pad/ascent/active-burn/check/review往返與合法續做通過，含有序紀錄pending 4000-byte gate。
- source及extracted ZIP各有1280×800可信mouse與390×844可信touch：兩大箱中間插小箱成large/small/large、取消不變、同級重排、四箱滿時拒絕新增、精確選取第2大箱跨級插入及非拖放重排控制通過；預覽期間答案／LMS草稿／相機／scroll均不變，release與完整預覽一致。20種布局、原手柄／面板滾動／即時警告、任務／SCORM／全屏／WebGL故障回歸亦通過。桌面及手機middle-insert截圖已人工檢視。
- report.json：completed=true、errors=[]；runtime SHA-256：8977c59daa6e73af806da938c8620a31eae53063f4b0761bf39d5562ea672b1c；ZIP SHA-256：5a5aba9063391ac5bd6dd6a523f4c55075bd7446c2a6819db81f094629620995。報告及截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。未重跑全庫Node／browser及完整iframe矩陣，真手機／Moodle仍未驗證。
- P9已commit／push：643e59e887b637f9f8067817d9416f1683cb10f9；提交選擇預覽output/rocket/selection-p9.log。沿用使用者明確持續發布授權，Sites來源a7901506a168c3fee6ea6ae03dfe98bb5dc81147、deployment appgdep_6adcac65d5dc8191bbf9694b8ef5ba78，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P10：清晰標題／控制、空曠發射台與外圍景觀（2026-10-24）

- 頂部恢復常見可見標題，手機以20px標題列＋44px導航列呈現，總高≤80px；桌面同列。刪除舞台英文／大標語／副標，不讓文字遮火箭。導航改為組裝發射、軌道任務、成果提交；鏡頭只留有標籤選單與轉動開關，縮放／回正移到面板可展開的「鏡頭設定」。
- 保留既有明示相機模式及兩側≥32px捲動區。開／關相機模式、選鏡頭、縮放均不暫停或啟動物理；只改顯示。以實際running狀態標示「飛行中／已暫停／待發射」，暫停與繼續按鈕命名清楚；發射台只顯示「點火發射」，避免無效果的播放控制。
- 關機／分級是物理控制，不再暗中改running；運行中關機後滑行、分級後可點火上級，原本暫停時仍保持暫停。規劃／檢查／提交、失焦、技術故障及恢復仍遵守現有暫停契約；模型方程、評分及保存schema不變。
- 發射台周圍至少350m不設樹木／建築，保留清楚平台與混凝土底座；移除貼近火箭的裝飾燈柱。外圍添加河流／河岸、森林群及遠方建築／道路，全部本地低面數幾何、instancing，仍守100 draw calls／100,000 triangles預算與連續升空環境。
- 範圍：本活動HTML/CSS/main/scene/ui-runtime、既有lifecycle/browser測試與計劃。新測試覆蓋可見緊湊標題／無舞台標語／導航全屏可達、清空區及實際pad截圖、運行／暫停時相機mode可信touch、關機／分級後時間繼續。沿用owner重跑source/ZIP、手柄／接縫、SCORM／故障／高度採樣；真手機／Moodle仍獨立驗收。

- P10完成證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）、文件／diff檢查通過。新增Controller測試證明關機與分級保留running，原本暫停時操作不會偷偷恢復；check／提交／技術故障暫停契約沿用原有測試。
- source及extracted ZIP各以1280×800及390×844驗證可見頂欄標題、無畫面標語、鏡頭選單及開關；20布局頂欄高度集合為[53, 75] CSS px，導航及全屏按鈕可達、不重疊。縮放／回正收納面板，stage只留鏡頭／轉動視角。SVG裝配導線以真正hidden屬性切換，發射／飛行不再殘留接點導線；A任務恢復預設follow，避免在發射台卻見地球遠景。
- 發射平台空曠底座及兩個額外yaw角度、桌面／手機畫面已人工檢視；樹木中心最近450m，建築中心距離>650m，96棵樹與12座遠方建築、河流／河岸在場景內。原真實模型升空高度採樣及天空漸變通過，採樣最高80018 triangles／58 draw calls。
- 四組source/package可信mouse／touch流程證明：待發射只有明示點火、運行時開關／拖動相機仍繼續計時、原本暫停時開關相機不啟動、關機後滑行／分級繼續、暫停與繼續按鈕及狀態文字一致。原手柄／接縫插入／即時警告、任務／SCORM／續做／全屏／WebGL故障恢復仍通過。觸控測試等待實際pointer事件／回饋處理完成，不以固定20ms幀時限判失敗。
- report.json：completed=true、errors=[]；runtime SHA-256：baf97c1bce712e33b984daf89f72e652ce1eea06860c8b274df12157aee5f506；ZIP SHA-256：bd11c9113dd19f071b255b0770be7012ebecbfe4f03ee4587a859b62859d1b54。報告及clear-launch-pad／flight-controls／ascent截圖在output/playwright/rocket-space-mission-lab/，ZIP為output/rocket-space-mission-lab-scorm.zip。未重跑全庫Node／browser或完整iframe矩陣；真手機／Moodle與校內效能未驗證。
- P10已commit／push：9063559d77bec20cd066093782158f69ecf52d70；提交選擇預覽output/rocket/selection-p10.log。沿用使用者明確持續發布授權，Sites來源6ff0bb7d48cc7913e7b681ef3c142d1e1e7df21d、deployment appgdep_6adcb380f5188191a206e58b17929e91，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P11：直接操作火箭與可見頁面的相機失焦（2026-10-24）

- 使用者要求刪除重複的各級引擎選單／數量控制，以及無清楚作用的「＋上級／下級」。保留元件卡加入／手柄拖放、火箭實際零件點選／搬移，只有空級顯示與模型空位重合的「拖入零件」入口；已裝級直接按零件決定裝配級。點選零件才出現取出／上移／下移工具，鍵盤可從火箭本身逐件選取並操作，不再列兩份完整編輯器。
- 失焦只清理暫存手勢／預覽；真正document.hidden才暫停飛行且不自動恢復。原window.blur無條件pause是可見的手機／iframe操作仍可能停飛的路徑；不聲稱已重現使用者實機。規劃、提交、技術故障等既有暫停及鎖定仍保留。
- 範圍：本活動HTML/CSS/main及既有browser owner；不改物理、評分、snapshot schema、manifest或依賴。沿用原有低風險教學評分及所有階段／變體往返契約。測試更新所有舊選單caller、直接點零件／鍵盤取出重排、空級可達、容量拒絕，並加入相機可信touch期間失焦取消但時間繼續／背景事件暫停且不自動恢復的回歸；source與extracted ZIP同跑。真手機／Moodle仍需獨立驗收。

- P11完成證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）、文件／diff檢查通過。source及extracted ZIP共20布局；1280×800 mouse、390×844與320×568 touch加入／點選取出、鍵盤裝配與移除最後零件後焦點返回空級均通過。兩級已裝零件直接點選、精確接縫插入／重排／跨級搬移、滿箱拒絕及鍵盤選取後調位通過；舊選單及常駐「＋上級／下級」均不存在。桌面及390px零件工具截圖已檢視，工具位於火箭旁、不遮火箭，且按鈕位於舞台內。
- source／ZIP各於1280×800及390×844在運行中可信touch轉鏡頭，再注入可見window.blur：取消手勢但running／飛行時間繼續；注入document.hidden／visibilitychange則暫停，恢復可見／focus亦不自動恢復。失焦來源以事件回歸覆蓋，並非使用者實機重現。原待發射／明示暫停繼續／關機滑行／分級、SCORM保存／提交重試／review恢復／全屏／WebGL故障回歸亦通過。已提交review無craft欄位，空級提示必須安全隱藏，不可影響確認成績。
- report.json：completed=true、errors=[]；runtime SHA-256：79ecf036a78aefa3e5897d7c32663c3440cb84c0589026bd107c9ba9e5af29cf；ZIP SHA-256：4f045f2c86da9cd96dcbbee36ef276b8d3325d297f162ca577910c8288a99e18。報告及part-tools／onboarding／flight-controls截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。未重跑全庫Node／browser或完整iframe矩陣；真手機／Moodle與校內效能仍未驗證。
