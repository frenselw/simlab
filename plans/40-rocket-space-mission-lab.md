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
| Phone stage and controls | P27：直向控制區 clamp(240px, 42dvh, 360px)，包含固定飛行操作列；剩餘空間給 stage。低於520px的窄視窗控制區clamp(172px,calc(100dvh - 275px),220px)，優先保留約200px舞台以避開角落儀表／鏡頭列；panel獨立捲動，不依賴fullscreen。 |
| 數字例子 | P27設計預算：390×664、header約74px，stage約311px、controls約279px，其中可捲內容約206px；390×460，stage約200px、controls185px，其中可捲內容約112px。實測證據見P27；較早P22/P23高度為歷史。 |
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
- P11已commit／push：d4ee2fd0e2046e94cdacb2f63d4a1d5bd5eca5ab；提交選擇預覽output/rocket/selection-p11.log。沿用使用者明確持續發布授權，Sites來源1d9e34ad5fda3dbb2111ecb986be7f4aeed049ad、deployment appgdep_6adcca3e8bd88191962e7258617b60ca，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P12：預設直接旋轉、兩側捲頁把手與鏡頭按鈕（2026-10-24）

- 使用者明確要求將火箭以外背景改為預設orbit surface，取代P10/P11的先按轉動開關；中間舞台為宣告的相機操作區，左右各32 CSS px全高保留原生pan-y。沿用Circuit Workbench的小型32×64px可見捲頁把手圖案／原生捲動方式；不加host bridge、手動scrollBy或頁面樣式鎖。此要求取代先前背景一律host-owned的活動決定；面板仍獨立捲動。T0獨立全屏頁本身零捲動範圍；iframe T1/T2的外層document或T3的overflow owner才是兩側手勢的實際捲頁目的地。
- 中央背景mouse／touch直接旋轉，不顯示虛線框／提示框，不啟動或暫停物理、不保存答案；零件實際raycast／24px觸控局部容差仍為裝配拖放，grip內未命中零件則交相機。變軌標記保留自身手勢、鍵盤及preview。取消／失焦／第二指／lost capture只清理手勢，真正hidden才暫停，恢復可見不自動播放。
- 左下角改四個≥44px的近景／跟隨／地球／俯視按鈕，刪除選單和轉動開關；依上下文禁用不可用鏡頭並用aria-pressed標示。地球改明顯斜角，俯視沿軌道法線，實際投影／鏡頭位置需不同；相機切換不改答案或running。預覽／工具／鏡頭控制不能攔截兩側32px捲頁區。
- 範圍：本活動HTML/CSS/main/interaction/scene、既有rocket browser owner、mobile-scroll fixture/operations caller及本計劃。不改依賴、manifest、物理／評分／snapshot schema；沿用原有低風險評分及所有phase/variant保存契約。驗證source／extracted ZIP的mouse/touch直接轉動、旋轉及切鏡不中斷時間、paused不自啟、readonly不改答案、零件／節點原流程、20布局及320px把手可達；另跑中立iframe可信touch左右原生捲頁及面板隔離，記錄實際拓撲／覆蓋。真手機／真Moodle仍獨立驗收。

- P12完成證據：六個活動Node測試、npm run check、手機scroll acceptance單元測試、npm run check:tests（278 entries）、文件／diff檢查通過。source／extracted ZIP各1280×800 mouse及390×844、320×568、844×390 touch，無模式按鈕直接拖背景、方向鍵旋轉、兩側32px命中區及左下角≥44px鏡頭按鈕通過；原20布局及元件卡原生捲動／手柄拖放／即時預覽／中間插入／鍵盤調位／兩級搬移均通過。
- source／ZIP各以1280×800 mouse及390×844 touch在飛行中直接轉鏡頭、實際地球／俯視／跟隨切換，camera.position與active按鈕一致，running及時間繼續；原本paused不會自啟。組裝／唯讀旋轉不改答案或保存；失焦取消但續飛、hidden暫停及不自動恢復、關機滑行／分級、SCORM提交／恢復／鎖定／全屏／WebGL故障亦通過。手機與桌面direct-camera、三鏡頭截圖已人工檢視；未顯示相機虛線框。
- 中立host可信touch source及package各完成T1（單層iframe、390×844、camera-surface）、T2（有界中介iframe、320×568與390×844、camera-surface及planning）、T3（外層overflow元素owner、320×568、camera-surface），共12 cases；左右stage strip上下掃動實際外層owner，activity document／visual viewport／panel及答案不變；panel text／button starts、邊界／取消／連續掃動與之後stage掃動隔離通過，未寫host鎖樣式。相機／變軌操作的complete、cancel、secondary、blur、lostcapture通過，無遺留preview。報告scroll-p12-source/package-T1/T2/T3.json均completed=true、status=passed、errors=[]且全部gesture issues=[]；共同runtime digest ff32f69daeca8ff6de295d268be50aa9d2c6b3ed5b2b6b53e6601e347a40f4a3。T0獨立頁零外層捲動範圍，未主張把手可捲動不存在的頁面高度；真Moodle／跨origin receiver未測也未新增。
- 主report.json：completed=true、errors=[]、42 flows；runtime SHA-256：56cb098a2ee0bc4c9c67e97a86481a4bc86b92e73ef0f60894f3e1873a7910da；最後ZIP SHA-256：d130b7a5a8a368934fb99b762881a0225422a02ae7ce99ba8fcaba7fe2d1e6fa。報告／截圖在output/playwright/rocket-space-mission-lab/，ZIP在output/rocket-space-mission-lab-scorm.zip。未重跑全庫Node／browser、完整所有phase／變體iframe矩陣或200% zoom；真手機／Moodle與校內效能仍未驗證。
- P12已commit／push：6b560f1ce38977b374c71b6f111897eabedd7d1d；提交選擇預覽output/rocket/selection-p12.log（mobile-scroll共用fixture不在選擇器細分依賴內，保守列full；本次執行範圍以以上實測證據為準，未主張全庫測試）。沿用使用者明確持續發布授權，Sites來源2b2fd1df4c9176bcfb1a383cf4a37d3dcd25211d、deployment appgdep_6adcce007bc88191b7570bb7cf94996e，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P13：只有手機／觸控版顯示捲頁把手（2026-10-24）

- 使用者更正P12：桌面不需要捲頁把手。沿用Circuit Workbench的裝置能力media query：hover:hover且pointer:fine時隱藏；any-pointer:coarse保留，支援手機橫屏及觸控混合裝置，不以窄桌面視窗冒充手機。桌面相機操作區同時擴至兩邊，不留下無作用的32px區；觸控版仍保留兩側32px原生pan-y與小把手。
- 範圍只限CSS、既有browser owner及本計劃；不改依賴、manifest、物理／評分、phase／variant／snapshot或保存契約。更新實際CDP觸控能力，驗證1280px與窄390px滑鼠版無把手且背景可旋轉，320／390px及844px橫屏觸控仍有把手；重跑source／ZIP既有owner和聚焦T2觸控捲頁。沿用低風險評分及既有保存測試決策；真手機／Moodle仍獨立驗收。

- P13執行證據：npm run check、npm run check:tests（278 entries）、文件／diff檢查通過。source／extracted ZIP各20布局，1280×800及390×844 mouse使用實際fine-pointer能力：把手無尺寸／命中區、相機覆蓋舞台全闊；390×844、320×568及844×390 touch保留兩邊32px把手與原生pan-y。十組直接背景旋轉／方向鍵／鏡頭預設通過；桌面與手機截圖已檢視，桌面無把手、手機保留。原裝配／插入／調位／飛行／相機／評分提交／恢復／唯讀／全屏／故障回歸均通過。
- source與package T2各320×568 camera-surface profile通過：左右原生外層捲頁、面板內容／邊界／取消／連續掃動隔離、相機complete/cancel/secondary/blur/lostcapture；scroll-p13-source/package-T2.json皆completed=true、status=passed、errors=[]及全部gesture issues=[]。本次未重跑T1/T3、全phase矩陣或不受CSS影響的活動Node測試；P12證據保留為歷史，真手機／Moodle仍未驗證。
- 主report.json：completed=true、errors=[]、44 flows；runtime SHA-256：9b1a762b63fb7b0db55a02f2eba2c01a7eb0f36291cbe2079308fa9f57fed4d0；ZIP SHA-256：928a9da23f04cc8b2944aeb0b588f363e8e043f2aed0ad1f569a793275f2e169。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。
- P13已commit／push：f72d211b4ddfe4b9a7a29c638f910e7f9e0fa8bf；提交選擇預覽output/rocket/selection-p13.log。沿用使用者明確持續發布授權，Sites來源c06f90037af7a95afd0e10ac5de77ea7c2991976、deployment appgdep_6adcd03293048191afcd3b910503ceb1，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P14：桌面整卡拖放、簡潔元件面板及任務名稱（2026-10-24）

- 使用者要求桌面不顯示元件拖動把手、手機保留；桌面mouse整張元件卡可拖動，手機touch只有手柄開始拖動，卡片內容仍原生pan-y。仍可點卡片／Enter加入；一次drag/cancel後的合成click不得再加入一次；新觸控開始時清除上一手勢的click抑制，取消後首次點卡仍只加入一次。capture目標統一為穩定卡片button，更新所有既有測試caller及lostcapture。沿用P13裝置能力query，不加依賴／UA判斷。
- 刪除組裝標題下常駐掃動／拖動教學及初始提示佔位，實際操作只顯示精簡狀態；保留無法安裝、容量／技術錯誤、必要結束試飛及成績說明。衛星卡改成圖示／名稱及載荷質量標籤／數字與kg的一行排版，不再擠在公式文字裏；手機手柄文字維持單行，避免320px元件卡不必要增高。
- 面向學生的A/B改用「發射入軌／軌道變更」及發射／變軌紀錄，包含導航、保留／帶入按鈕、提示及成績明細；模型task A/B、record索引、評分與snapshot不變，成績標題只在UI轉譯，舊保存／pending／review繼續相容。
- 範圍：HTML/CSS/main/interaction、既有browser owner及本計劃。低風險評分、rubric、phase/variant保存矩陣與schema沿用。驗證source／ZIP的真實fine mouse整卡拖放（取消／無效落點／lost capture不額外新增）、touch掃卡不安裝／手柄拖放、鍵盤加入、衛星卡320px及桌面排版、無常駐操作教學／A/B copy；重跑既有裝配／任務／保存提交及聚焦iframe手機手勢隔離。真手機／真Moodle仍獨立驗收。

- P14完成證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）、文件／diff檢查通過。source／extracted ZIP共20布局；1280×800 fine mouse實際整卡拖入／插入／無效落點／取消／blur／lost capture不額外加入，390×844及320×568 touch掃卡仍捲面板、只由手柄拖入，取消後第一次普通點卡安裝一次通過；第二指只取消、不轉交新操作。卡片／Enter點選及已裝零件、同／跨級搬移、精確接縫重排、容量／即時警告／原位預覽保持通過。
- 十組source／ZIP的1280×800及窄390×844 mouse、390×844／320×568／844×390 touch排版通過：桌面無把手、手機手柄44px且單行；無常駐操作教學／初始佔位；衛星名稱與數值／kg不重疊，質量與模型一致。桌面及320pxcompact-panel截圖已檢視。按鈕／提示／導航／成績明細以發射入軌與軌道變更命名；原有A/B資料及評分不變，review及舊保存／pending相容。原相機／飛行／任務／提交重試／續做／鎖定／全屏／WebGL故障回歸通過。
- 最終source及package T2各320×568 camera-surface profile通過：左右原生外頁捲動、面板文字／按鈕／邊界／取消／連續掃動隔離、相機complete/cancel/secondary/blur/lostcapture；scroll-p14-source/package-T2.json皆completed=true、status=passed、errors=[]及全部gesture issues=[]。本次未重跑T1/T3、全phase矩陣或全庫Node／browser；真手機／Moodle仍未驗證。
- 主report.json：completed=true、errors=[]、44 flows；runtime SHA-256：7e812ca238376c82cd8ce2006a6fbab4b8f20704e0495191b98379cc17641424（已與最終宣告runtime bytes核對）；ZIP SHA-256：1b1d8764720356706fe8e1b11410a6f58a00eb7b444434ddd73ead9f22e60354。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。
- P14已commit／push：29e19683baa803c81958ca061a44b036c4f50d0c；提交選擇預覽output/rocket/selection-p14.log。沿用使用者明確持續發布授權，Sites來源c958ee594cdfd875af793c9b7a2a251f619f5109、deployment appgdep_6adcd5d2a330819199da084479f66c7d，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P15：飛行控制不中斷與按大小顯示的速度／推力箭嘴

- 使用者回報面板轉向等控制會突然暫停，及箭嘴固定長度／插入長火箭頂部。Controller已保留control的running，但tick把單一elapsed=0當作停止，合法零時間／小於積分容差的幀也會停飛。修正此停止判斷；只由明示暫停、規劃／檢查／提交、hidden、技術故障或已結束／模型界線停飛，不自動恢復原本暫停的飛行。用轉向微調／直上水平、姿態、油門與0-time-frame連續操作驗證；不聲稱已重現使用者實機事件。
- 速度長度以總速率m/s、推力長度以production M.thrust（包括引擎／油門／燃料）計算；固定viewport下採線性比例，不以固定箭長或當前高度冒充數值。0速率／0推力隱藏。以min(90px, viewport高×18%, viewport闊×25%)作8000m/s／600kN參考長度，world-per-pixel只跟鏡頭深度／縮放轉換，維持同一畫面速度加倍／力加倍箭長加倍。
- 起點以實際rocket.localToWorld中心、旋轉軸、剩餘級height及scale計算；在向量的鏡頭平面法線方向以火箭包絡cylinder的support距離加8px間隔置於機身兩側，不再從固定world-Y中點穿過火箭。箭身粗細與長度分開，向量以與圖例一致的深色unlit材質及圖示overlay保留日光／太空背景可見性；不把顯示位置／尺度帶入碰撞、力或評分。更新「只示方向」舊圖例，勿誤導箭長語意。
- 範圍：ui-runtime、scene、HTML圖例、既有lifecycle／browser owner及本計劃；沿用既有model／Three／manifest依賴，無新套件、無新增snapshot欄位或schema變更。低風險rubric、phase/variant矩陣、舊快照／pending／review及真正背景暫停契約不變。測試包含Node先重現0-time-frame停止、source／ZIP實際mouse/touch飛行控制與滑桿、paused不自啟、長短／傾斜／分級／不同高度縮放與三鏡頭箭嘴幾何、速度與油門倍數／零值及原有全回歸。真手機／Moodle仍獨立驗收。

- P15完成證據：六個活動Node測試、最終npm run check、npm run check:tests（278 entries）、文件／diff檢查通過。先以lifecycle測試重現control後tick(0)誤暫停，再驗證save true/false、0／1e-12／正常幀、手動paused保持paused。實際source／ZIP各1280×800 fine mouse及390×844 native touch的轉向±2°、直上／水平、油門±5%、原生滑桿與姿態選項皆保留running且時間前進；同一批按鈕在paused不自動恢復。
- source／ZIP各桌面及手機共288組production向量transform案例通過：最長八大燃料箱、最短單小燃料箱、分離後上級；1000m／150km、follow／orbit／plane、0°／90°與0.5×／2×鏡頭。向量沿實際方向且取樣線段全在機身保守cylinder外；速度／油門加倍箭長加倍，零速度／零油門／空燃料箱隱藏對應箭嘴，draw不改模型。密集矩陣暫停重複GPU出圖以免軟件GPU累積逾時，finally恢復production renderer；最後真實WebGL出圖及桌面／手機長火箭、上級截圖已檢視，深色加粗箭嘴位於機身外並可見。
- 原20布局、整卡／手柄拖放、原生面板捲動、已裝零件點選、插入／調位／跨級搬移、連續背景旋轉、三鏡頭、關機／分級續飛、hidden明示暫停、任務、提交重試／恢復／唯讀、全屏與WebGL故障回歸通過。本次未重跑獨立iframe scroll T1/T2/T3矩陣或全庫Node／browser；真手機與真Moodle仍未驗證。
- 主report.json：completed=true、errors=[]、52 flows；runtime SHA-256：5171a82ed7e84411c8b321830a911a986168584d2d0ef05a45bc1476c195df45（已與最終宣告runtime bytes核對）；ZIP SHA-256：e00343cdc123481b60d4ead6c1701df3757c524128066eea06f69c1085c716b6。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。
- P15已commit／push：59eecd76a65dea3718ad73c18375bf535729d076；提交選擇預覽output/rocket/selection-p15.log。沿用使用者明確持續發布授權，Sites來源333a564f746a47b660331c4fab68ba0b14da5148、deployment appgdep_6adcde0756748191916814518068e85f，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P16：完整速度讀數、分級燃料與由分離器向下加建

- 需求：補垂直及總速率，避免直上時水平0造成誤解；兩級各自顯示推進劑百分比；以分離器元件取代單級／兩級按鈕，原已完成的單級成為上級，在其引擎下加分離器／新下級，外殼包住上級噴嘴，飛行分離後再露出。
- 速度沿用O.elements的radial／tangential／speed，顯示垂直及水平分量的絕對值與總速率；低於1000m/s採m/s一位小數，否則km/s兩位，避免低速全部0.00。HUD保留緊湊三欄：高度、總速率及兩個分量、各級燃料。兩級依各自capacity顯示，active與未點火級不混合，分離後下級標示已分離而不是冒充已消耗；記錄／review使用selectedFlight同一套讀數。
- 兩級schema仍為lower-first stages[0]/[1]及separator boolean，最多兩級，mass／fuel／評分／snapshot schema不變。新增separator模型操作只在workshop且單級引擎與燃料完整時，原級原封移至index1、prepend空index0，增加既有60kg分離器。保留舊stages action供既有fixture／caller，刪除UI切換。移除分離器只在下級已空時恢復原上級，拒絕靜默丟失任何下級零件；check／review／pending保持鎖定。
- 分離器沿用元件卡mouse整卡／touch手柄、點選／鍵盤、舞台接點、原位預覽、直接點選取出與取消契約；只有原單級底部接點可裝，重複／未完成／第三級拒絕，拖放不改草稿直到釋放。引擎仍屬原上級，opaque interstage包覆噴嘴，不修改推力；分離器可取出且上級引擎仍可由可見安裝環／鍵盤選取。下級先點火，分離後切換原上級，所有元件及有序燃料箱保留。
- 範圍：parts／model／scene／main／HTML／CSS及既有model／persistence／browser owner／本計劃，無新依賴／資產。沿用既有低風險rubric、phase/variant、權威snapshot及提交／重試／信任契約。先加模型與codec往返／合法續做測試，再執行source／ZIP真實mouse/touch分離器拖放／取消／不合法／移除、兩級順序與外殼、讀數獨立／低速／下降／不同鏡頭／review、320px及橫向布局；六個Node、check／check:tests、文件及提交選擇預覽。真手機／Moodle另驗，不以本機模擬代替。

- P16完成證據：先用model測試重現separator不能建立下級，再通過六個活動Node測試、最終npm run check、npm run check:tests（278 entries）、文件／diff檢查。三變體保留有序上級、質量只增加60kg、未完成／重複／飛行／check拒絕、下級有件拒絕移除、空下級移除，以及下級600kN→原上級80kN順序通過。新建未完成下級／移除／launch／separated upper均有production codec往返與合法續做，舊快照／pending／唯讀契約不變。
- source／ZIP各1280×800 mouse及390×844、320×568、844×390 native touch分離器拖放／取消、原位預覽不更改答案、上級保留、空下級取出、鍵盤再加、第三級拒絕、下級有件不可靜默丟失、下級先點火及分離後原上級點火通過。實際shroud包住上級nozzle的bounds，安裝環仍可直接選取，分離後外殼消失；桌面／手機shell截圖已檢視。移除級數切換，新增元件沿用桌面整卡／手機手柄規則。
- source／ZIP各1280×800、390×844、320×568、844×390、390×460：總／垂直／水平速率300-400-500、1m/s直上及水平0、下降分量絕對值、3-4-5km/s換單位通過；兩級50%／25%獨立讀數、分離後下級「已分離」與上級25%、已提交review同一紀錄、切回單級僅主級100%通過。HUD數值及圖例不重疊／不越界；320px、橫向與短窗口截圖已檢視。HUD與圖例用flex自然換行，不擴充頁首標題或新增操作教學。
- 原20布局、裝配／中間插入／精確ordinal／跨級搬移／鍵盤調位、手機原生面板捲動／桌面整卡、不中斷飛行控制／背景旋轉／鏡頭、288組向量transform、任務、評分提交／恢復／pending重試／唯讀、全屏及WebGL故障回歸通過。本次未重跑獨立iframe scroll矩陣或全庫Node／browser；真手機與真Moodle仍未驗證。
- 主report.json：completed=true、errors=[]、70 flows；runtime SHA-256：7b53373adf8c4b7c5fe88eabda5dd1bfea042fb57ad8fb271a1bd4f120d87603（已與最終宣告runtime bytes核對）；ZIP SHA-256：39ecb9ed4895430d857c69a31dc1191e8b6fc18f86210494989d6dcad720b065。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。
- P16已commit／push：e758fd5f109a7f36561481099b6b600c08b8a87a；提交選擇預覽output/rocket/selection-p16.log，mode=affected。沿用使用者明確持續發布授權，Sites來源154bbe01bfed1f800b9264fa00c3abebc15a1560、deployment appgdep_6adce3bbafbc8191beb6b85fd35287f0，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P17：清楚表達鏡頭方向的名稱

- 使用者認為「俯視」有誤導。將鏡頭「地球」改「地球全景」、「俯視」改「軌道正視」，同步title與aria-label，說明分別是斜角看地球／軌道，及正面看軌道平面；避免以不明確的上下方向命名。
- 僅改HTML用詞；維持factory／follow／orbit／plane鍵、鏡頭位置、手勢、running、資料／評分／SCORM與schema。低風險文字改動不新增鏡像測試，沿用既有layouts／directCamera／launchAndCamera做source及ZIP聚焦驗證，特別確認320px四個鏡頭按鈕仍在舞台內、≥44px且不遮捲頁把手。其餘phase／變體／rubric／snapshot／pending契約沿用，未重跑全活動或全庫。

- P17執行證據：npm run check、check:tests（278 entries）、文件與diff檢查通過。ignored output/rocket-p17-camera-check.cjs選取既有registered owner的layouts／directCamera／launchAndCamera，source及extracted ZIP共20布局、14 flows，completed=true、errors=[]、selection=camera-labels。桌面及窄320／390／橫向touch，原生背景轉動、鏡頭預設位置／active與running一致、關機滑行／分級／明示暫停／hidden契約通過；320px按鈕≥44px且在捲頁把手內側，ZIP截圖已檢視。未重跑無關裝配／任務／SCORM完整矩陣、活動Node或全庫測試；真手機／Moodle未驗證。
- runtime SHA-256：3355273bea88d3b4209c70ae307bebaf6f674a03830ff1ac65eabc542eab3348（與最終宣告runtime bytes核對）；ZIP SHA-256：7f1d27212328027a03e27dea70b37b02ae87d4506dc11f3c340dc1823a6105ee。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。
- P17已commit／push：54ee5322627f895a4d9e8a750246f2ac9d00b05b；提交選擇預覽output/rocket/selection-p17.log。沿用持續發布授權，Sites來源3afcacc60603fe79a06386d9bb23a7327ca2934e、deployment appgdep_6adce525ea348191986292407ffc3ac5，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P18：精細零件、發射環境、地球與模擬時間自轉

- 使用者要求整體美術大幅提升，同時保持流暢；地球目前完全不轉。保留可愛載荷及淺色介面，重做3D零件的板縫／鉚釘／維修口／管線／冷卻環／噴嘴／隔熱材質及對應元件SVG；發射底座加入排焰口／排焰槽／鋼架／固定座／混凝土板／安全標線。河岸、道路、森林群、工業建築與海岸地形更精細，維持發射場至少300m清空、樹≥450m、遠方建築≥650m，近景雲移至遠處並用柔邊透明貼圖，避免遮住火箭。
- 地球使用本地2048×1024 NASA Earth Observatory Blue Marble Next Generation（2004年6月）地表圖，另以本地NASA雲圖／大氣邊緣／明暗面表達層次。來源：https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/ 及其credits；NASA影像使用規範：https://www.nasa.gov/nasa-brand-center/images-and-media/ 。只作科學教學呈現，非即時天氣，無NASA背書；記錄來源／縮圖處理／雜湊並在折疊說明署名，不載入遠端runtime資產。
- 自轉直接由selected flight的t決定，以NASA Earth Fact Sheet 23.9345h（86164.2s）為恆星日。前進／快轉跟實際積分t，paused／review／hidden不自動流逝，resume可重現相同地表角度。這一輪只補地表視覺自轉，不把它注入既有球對稱重力／初始地面速度／評分；無新snapshot欄位或schema改動。舊「首版不自轉」只描述歷史物理簡化，自此renderer有依t的地表動畫。
- 效能策略：表面細節烘入共用Canvas貼圖、重複鉚釘／環／管件／樹／建築用InstancedMesh，維持每個可選部件的part metadata／pick anchor／順序與1.6半徑包絡；引擎第一child仍為噴嘴，分離器外殼仍包住上級噴嘴。地球球面由256×128降低至128×64，以更細貼圖取代大量三角形；無動態陰影、後處理或新重型依賴，pixel ratio維持手機≤1.5／桌面≤2，≤100draw calls／≤100k triangles／ZIP≤5MB。重建／預覽釋放geometry、material及instancing buffers，快取貼圖不反覆建立，避免記憶體隨組裝增加。
- 範圍：scene／專用scene-art模組、元件SVG與少量CSS、本地影像及NOTICE、manifest、main必要的錯誤／載入接線、既有browser owner及本計劃。先保存同機baseline，再補自轉／快轉／暫停／還原、最大火箭／多高度與鏡頭、冷載本地貼圖、繪圖上限／RAF幀間隔／CPU draw與重建記憶體檢查；執行六個Node、完整source／ZIP既有互動／SCORM／故障回歸及檢查／提交選擇預覽。保留低風險rubric、phase／variant矩陣及權威snapshot／pending契約。軟件GPU與模擬觸控只作同機對照，不冒充真手機30fps／校內網路5秒／真Moodle驗收。

- P18首輪出圖／量度後調整：改用NASA真實雲層合成影像（1024×512本地JPEG），取代粗筆觸程序雲；近景仍用小型柔邊雲。微鉚釘改較低面數的實體頭，減少不可辨識的環／曲面分段；重複細節仍instancing，表面鉚釘／板縫保留貼圖。以輕量Phong材質表達金屬，大片地面／樹用Lambert，移除近景看不出的bump計算。追蹤視角在詳細地形足以覆蓋地球時不重繪全球球面／雲殼（120／300km門檻），軌道／正視保留完整全球層；持續檢查高度與天空連續性。森林256棵，仍多於原96棵，並守原清空距離。
- P18進一步優化：降低地面／雲圖的各向異性過濾，機身保留2×；近景按投影像素隱藏不足一像素的實體鉚釘／冷卻環，放大時恢復，貼圖細節一直保留。遠處樹／建築／地面雲在無法辨認時不送GPU；工廠大地板只在工廠顯示，發射時保留真實小範圍底座／apron，避免巨大貼圖地板蓋住草地與重複填色。

- P18地形出圖修正：高空寬三角形的vertex色曾把海岸拉成放射條紋；改由地面Lambert shader按每個fragment的本地座標算連續海岸／沙灘色，保留同一曲面與貼圖、無額外mesh或draw call。50／71／140km截圖再次檢視；修正前完整測試中止，不作最終通過證據。
- P18完成證據：六個活動Node測試、最終npm run check、check:tests（278 entries）、文件／diff檢查通過。既有registered browser owner加入本輪測試，最終source及extracted ZIP共20布局、88 flows，completed=true、errors=[]；所有manifest檔逐byte一致。真實mouse／native touch裝配、插入／跨級搬移、分離器遮罩與安裝環、全部速度及燃料讀數、不中斷控制／轉鏡、288組向量transform、任務／評分／提交重試／恢復／唯讀、全屏／WebGL失效恢復均回歸通過。
- P18新驗證：兩份交付各驗地表2048×1024／雲1024×512本地載入、runtime資源同origin及shader runnable；連續積分1秒及600秒後自轉角跟實際t一致，paused旋轉鏡頭不改時間／角度，Moodle fixture reload還原同角度，已提交review按紀錄t固定。封鎖地表圖片時明示載入失敗、保留成果且仍可檢查／提交，解除後正常啟動。
- P18負載驗證：每份以最長八箱火箭在0／20／119.999／120.001／179.999／180.001／299.999／300.001／1000km、follow／orbit／plane共27組實際GPU出圖，地表／雲／大氣門檻及<=100 calls／100k triangles通過；本矩陣最高68 calls／41550 triangles。微細節縮小隱藏／放大恢復、DPR3模擬下手機1.5／桌面2上限通過。每份12輪換引擎／燃料箱／原位preview再還原，暖機後geometries／textures／programs與WebGL live buffers固定（source {"geometries": 26, "textures": 7, "programs": 9, "buffers": 68}），模型不被renderer改動。
- P18同機對照：output/playwright/rocket-space-mission-lab/art-baseline.json保留P17原版，最終report.json保存本輪。Chrome SwiftShader、DPR1、paused場景每RAF單次draw、28幀捨首4幀；以下為source中位幀間隔／P95（ms），是軟件GPU短樣本而非真手機持續fps或網路載入測試。

| 尺寸／視角 | 原版中位／P95 | P18中位／P95 |
| --- | --- | --- |
| 1280／workshop | 33.4／33.5 | 33.4／33.5 |
| 1280／pad | 66.8／166.9 | 83.5／200.3 |
| 1280／ascent | 66.8／83.4 | 50.0／50.1 |
| 1280／orbit | 66.7／66.9 | 50.1／66.8 |
| 390／workshop | 16.7／16.7 | 16.7／16.8 |
| 390／pad | 16.7／33.4 | 16.8／33.4 |
| 390／ascent | 16.8／116.7 | 16.7／16.8 |
| 390／orbit | 33.4／50.0 | 16.7／66.7 |

- P18效能界限：整體global view減少球面幾何與高空層數，手機四視角中位接近一個refresh間隔；桌面軟件GPU發射台仍較重，不能聲稱所有視角都較原版快或保證真手機30fps。無陰影／後處理／遠端資產，新地球兩張影像合計439294 bytes，ZIP 679881 bytes；記錄實際數據而不作實機驗收。本次未重跑獨立iframe scroll矩陣或全庫Node／browser；真手機5秒／30fps與真Moodle仍待實際環境驗證。
- P18最終runtime SHA-256：f86e10fe0bffd9a2a61ae30c51c7fcd6de222d85acc3d0bd1ddfbeee9b4dcad9；ZIP SHA-256：582f9ad8033f1ee03e4f8280b6c6255f9880183c6e373c1720fb3bf8fe87ee61。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。桌面／手機零件近照、八箱整箭、清空發射區、升空／海岸、全球地球／雲層截圖已檢視。地球自轉只屬renderer，既有非自轉地面物理／評分與schema1不變。
- P18已commit／push：8210d290e901fc4b7bf5e7320b27501e08b2b57d；提交選擇預覽output/rocket/selection-p18.log，mode=affected。沿用使用者持續發布授權，Sites來源d4c03aa8cb21c3ba20f131a9cbd6cae9ecc79a74、deployment appgdep_6adcf48e8e70819186d912118f9caf2f，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P19：兩個獨立代理審核及初版除錯

- 使用者明確要求兩個subagents審核初版、匯總報告並跟進減少bug。審核基線3fc12d9（P18 runtime8210d29），代理audit_interaction_state負責互動／模型／持久化／提交，audit_scene_performance負責3D／鏡頭／資源／行動版效能；兩者只讀，root統一驗證及修正。報告：[初版審核及跟進](../docs/rocket-space-mission-lab-audit-2026-10-25.md)。負載為單一學生在本機或Moodle iframe使用。
- 確認四項：P1短逆向節點因12°/s未轉身就燒完而反向加速；P2長等待preview固定20000s截斷並回傳上一次burn；P2低高度遠離發射場時地球底圖與當地地形同時缺席；P2 live resize沿用桌面DPR2，超過手機1.5上限。先保留會失敗的重現，再修根因。手動A轉向限速不變，B自動燃燒每步先對準選定速度方向，亦涵蓋已儲存active burn續做；已保留／提交records不重算。
- preview隔離舊burn、依實際積分step budget推進至新燃燒終態；時間／計算上限或無進展時不冒充有效結果，UI明確表示未能完成預估。renderer在發射場附近且地形足以覆蓋時才省略全球底圖，遠離後保留地球；resize根據當前viewport重新套DPR上限。無新套件、runtime資產、snapshot欄位、schema、rubric或共享SCORM改動。
- 沿用既有assessment風險、rubric、phase／variant及權威snapshot契約。新Node覆蓋三載荷短逆向／錯向順行、自動active burn codec續做、A手動限速、長等待第二次燃燒preview與actual一致、模型邊界返回不可預估。既有registered browser owner加入合法降軌跨地心角跟隨、全viewport無reload DPR切換、UI預覽／自動方向／resume；完整source／ZIP、六個Node、check／check:tests、文件／diff及committed selection-preview。T0–T3手勢未改，獨立scroll矩陣不重跑；真手機及真Moodle另驗。

- P19場景覆核追加：R4亦涵蓋CSS尺寸不變時的DPR-only變化，resolution media query在CDP實測值已更新但change未觸發，改用既有RAF每幀比較一個已快取DPR數值，只有DPR變更才resize，不讀取每幀DOM尺寸。另確認R5：follow地球不寫depth以保留發射場地形，透明星點因此穿過球面；星點shader以同一球面做遮蔽，保留原漸現、地形depth及draw call數，補GPU pixel比較及shader runnable測試。R3用離發射點600km的保守margin（詳細地形半徑1280km）恢復全球底圖，留住近發射區效能；代理已驗五組視角無遠地形穿透。

- P19完成證據：兩代理覆核均關閉原finding及追加R5，共1項P1／4項P2已修，詳見審核報告。六個Node全綠；逆向短燃燒及P18 active burn續做新增測試先在修前失敗。最終registered owner source／ZIP共94 flows、20 layouts，completed=true、errors=[]；原互動／自然分級／向量／SCORM／故障回歸全部通過。新增GPU星點球面內像素一致、合法遠距低空地球、DPR3→1→2.5與手機切換、長等待第二次燃燒preview、舊active burn codec及reload等皆有實際執行證據。獨立代理驗DPR變更下paused不動／playing續飛，及context restore shader正常。
- P19檢查：npm run check、check:tests（278 entries）、文件及diff檢查通過；runtime SHA-256 b4fa613a935560a1e3840f4ff74eddb62505b7764caece30dc4b76274700732a，ZIP SHA-256 ab621f5cb5d857116837ab0251c0943b9e47811e0454dd8113d4fc2533678e76，大小680689 bytes。正式report與*-audit-*截圖在output/playwright/rocket-space-mission-lab/，獨立audit-scene-*證據在output/。無新schema／rubric／runtime依賴，已提交records不重算。真手機／真Moodle／獨立T1–T3矩陣未在本輪驗證。
- P19已commit／push：7a5ce1b90654ea8edaf85b9108f7eca84de2f187；committed selection-preview為output/rocket/selection-p19.log，mode=full，原因是既有test-support.js測試fixture helper未宣告為runtime asset consumer，選擇器保守全選。未更改共享選擇器／registry或把測試fixture加入runtime；本輪實際只執行活動六Node與完整活動source／ZIP，未執行全庫或等待CI。Sites來源a021704661dfcb71e3f5ca367b4bde341848496d、deployment appgdep_6adcfe8625c08191acad291bff4f2b4b，native succeeded；原網址與owner-private維持。


### P20：統一卡通地球，消除高空近景地形接縫

- 使用者真手機截圖在940.4km看見大片簡化青綠近景海洋蓋住寫實衛星地球，兩種海色／造型混雜；要求恢復一致卡通美術。P18仍保留發射場有限地形於所有高度、同時啟用全球底圖／雲殼，形成可見地形patch邊界；P19只補遠距底圖，未解決這個重疊及風格問題。
- 修正只涉及scene／scene-art、學習說明署名、舊影像manifest依賴及既有browser owner。重用P17原創大陸輪廓，生成一次性本地Canvas插畫地表／葉狀雲：海洋／陸地／海岸採同一組配色，加簡單海岸線及區域色塊，移除NASA照片與照片雲runtime依賴。保留精細火箭／發射台、河岸／樹木／建築與地球依t自轉。地圖是航天示意插畫，非地理／即時氣象資料。
- 近景環境按20–60km高度及距發射點300–600km平滑淡出；全程使用同一地球球面，20km以下發射區採近景海岸配色，60km以上及遠距採全球插畫；有限近景地面mesh已刪除，只有道路／河流／樹／建築／底座等細節隨高度淡出。雲／大氣同一透明度漸入；多角度、縮放及下降亦使用同一規則，避免切換高度硬跳。fade只改renderer材質／可見性，不改physics／rubric／schema／已儲存答案。
- before/after重現原940.4km／3300m/s、20／40／60km邊界、100／300／940.4／1200km、近／遠發射地心角、follow／orbit／plane、桌面／手機尺寸，驗證高空local opacity=0且studio／landscape均隱藏、地球仍可見、Canvas插畫資產及shader正常、draw calls／triangles上限、暫停／續做／DPR與星點遮蔽不回歸。以現有registered owner新增案例並更新舊「地形始終顯示／照片載入」測試為新契約，執行source／ZIP完整owner、六Node、check／check:tests、文件／diff及committed selection-preview。物理、snapshot及SCORM外層不變；真手機／真Moodle另驗，T1–T3手勢未改不重跑。

- P20出圖補正：單純淡出兩個重疊球面仍會在40km看見雙地平線。刪除發射場大型地面mesh，改為全程同一地球球面，以北極密集環支援發射點米級近景；同一fragment shader從近景海岸配色平滑轉為全球插畫，近景只留道路／河流／森林／建築／底座並淡出。球面隨跟隨地心角轉換，雲／大氣沿同一球面漸入，沒有第二個地面或有限patch邊界。相對原128×64球面僅小量增加全景面數，省去近景地面萬個三角形，仍守100k預算。

- P20完成證據：六個活動Node、npm run check、check:tests（278 entries）、文件／diff檢查通過。最終registered owner source／extracted ZIP共98 flows、20 layouts，completed=true、errors=[]；manifest所有runtime bytes與ZIP一致。真實單級火箭積分至942.3km重現升空，再覆核原截圖940.4km／3.30km/s、0／20／40／60／100／300／940.4／1200km及各邊界、四個地心角、follow／orbit／plane與縮放；高空無近景patch、同一球面保留、Canvas插畫無舊照片請求。新矩陣最高43 calls／43192 triangles，40km local opacity=.5、60km以上=0；原星點遮蔽／DPR／互動／SCORM／故障回歸通過。桌面／手機發射台、過渡、高空與地球全景截圖已檢視，沒有雙地平線／貼片邊界。
- P20 runtime SHA-256 338408133718ad44cf7a3bda1000e4a5a39c87a2e115bf9d22ca980fe621aeac；ZIP SHA-256 e0b988a93d66129335087f11574f46edb4c83118fdc47c88803fecc72661faa4，大小255995 bytes（移除439294 bytes照片，無新套件或外部runtime請求）。報告／截圖在output/playwright/rocket-space-mission-lab/。P18照片及有限地面mesh決策由本節取代；物理／schema／rubric／提交記錄不變。未重跑全庫或獨立T1–T3矩陣；真手機fps／真Moodle未驗證。
- P20已commit／push：33cfc4c8da4313b6b48e000e3547e240b279743e；committed selection-preview在output/rocket/selection-p20.log，mode=full，原因為已移除NOTICE.txt不再有manifest consumer，選擇器保守全選。未改共享選擇器或把舊照片／NOTICE重新加入runtime；實際只執行活動六Node、完整活動source／ZIP與既述靜態檢查，未執行全庫或等待CI。Sites來源4341518e47b67bf7f4b87974d3b91bc5b34cde35、deployment appgdep_6add538b8d848191a6264012087388be，native succeeded；精確使用驗過ZIP並清除Site舊照片，原網址與owner-private維持。

### P21：固定地理連續性、可辨地標及緊湊讀數

- 使用者指出P20隨高度改變地表配色使陸地消失、全球輪廓粗糙、近景缺地標及HUD遮箭。本輪移除高度驅動的地理混色：同一球面的固定沿海區與全球圖按空間座標銜接，近景海岸／河道／林地／田地／山脈／城鎮印在同一地表，遠景仍留住；只有米級3D道具按投影大小淡出。全球補可辨大陸海岸、山系、河湖及島鏈，維持原創卡通插畫，不加照片或依賴。
- 沿海發射區以加州海岸方向為示意基準，非測繪或真實發射基地。局部與全球共用定位，山脈3D輪廓與地圖陰影同位；發射台附近保持清空。HUD改三行小型讀數：高度／總速率、垂直／水平、兩級推進劑及向量圖例；保留所有讀數及無障礙名稱，不新增操作說明。鏡頭留足整箭空間。
- 範圍scene／scene-art／HTML／CSS與既有registered browser owner／本計劃；manifest及所有runtime依賴不變。沿用低風險rubric、phase／variant、權威snapshot／SCORM契約，無物理或答案遷移。補固定時間多高度／多鏡頭同地表採樣、海岸河山地標及GPU／布局斷言，執行完整source／ZIP owner、六Node、check／check:tests、文件／diff與committed selection-preview；真手機效能／Moodle另驗，未改T1–T3手勢。

- P21完成證據：六活動Node、npm run check、check:tests（278 entries）、文件／diff檢查通過。最終registered owner source／extracted ZIP共102 flows、20 layouts，completed=true、errors=[]，宣告runtime bytes與ZIP一致。GPU以固定鏡頭與同一球面材質讀回64×64地表，0／20／40／60／940.4km所有RGBA逐byte一致（近景747種像素色），確認不是以高度更換陸海圖；桌面／手機及兩份交付均通過。0／1／5／20／60／940.4km截圖、全球大陸／河湖／山系／生物群落、固定河道及36座山脈已檢視；近景海岸方向亦校正為同一全球沿岸方向，P20高度混色決策由本節取代。
- P21布局：1280×800／390×844／320×568／844×390／390×460皆驗整箭投影位於HUD及鏡頭列之間，讀數與圖例互不遮住，總／垂直／水平讀數、兩級燃料及review皆保留。桌面HUD 73.1px、手機70.1px，向量圖例移入同條末行；預設follow望向陸地地標。新美術矩陣最高47 calls／45424 triangles，無照片、新套件、共享runtime或schema改動；原組裝、分級、控制／鏡頭不中斷、星點／DPR、評分／恢復／pending重試及故障回歸皆過。未執行全庫或獨立T1–T3矩陣；本機SwiftShader與模擬觸控不建立真手機fps／Moodle驗收。
- 地圖由快取Canvas生成：全球4096×2048、區域2048×2048，兩者未含mipmap約48MiB RGBA紋理，比P20增加約40MiB；沒有額外下載，重建後geometry／texture／program／buffer固定，DPR與繪圖預算仍受測試約束。真手機GPU記憶體與長時間流暢度仍須實機確認。
- P21 runtime SHA-256 d6278264a53d6b4a44c53fc81f3d650c96cd539e2e24af3d918de987ad55ea42；ZIP SHA-256 b7c76c5fdbd315323078383fc5cb202295ba5781767a979267519230ca7c5c1a，257627 bytes。正式報告與geography／full-telemetry截圖在output/playwright/rocket-space-mission-lab/。

- P21同機對照：Chrome SwiftShader、DPR1、paused各28 RAF捨首4；保留P20驗證報告為p20-before-geography.json。下列為source中位／P95幀間隔（ms），並非真手機持續fps。手機orbit中位由16.8升至33.3ms，其他場景中位大致相同，不能聲稱新增細節完全零成本；維持draw-call／triangle／DPR上限與穩定重建，實機記憶體／長時間流暢度另驗。

| 尺寸／場景 | P20 | P21 |
| --- | --- | --- |
| 1280／workshop | 33.3／33.4 | 33.3／33.4 |
| 1280／pad | 66.7／66.8 | 66.7／66.8 |
| 1280／ascent | 66.8／83.5 | 66.7／66.8 |
| 1280／orbit | 50.1／66.8 | 50.0／50.1 |
| 390／workshop | 16.7／16.8 | 16.7／16.7 |
| 390／pad | 33.4／33.4 | 33.4／33.4 |
| 390／ascent | 16.8／66.7 | 16.8／33.4 |
| 390／orbit | 16.8／33.5 | 33.3／33.4 |

- 最終owner先因已移除的「箭長隨大小變化」舊文字斷言中止；只更新測試為速度／推力圖例存在，未更動runtime。保留前27個已過source flows，核對runtime SHA完全相同後，先由flightVectors續跑；cameraDrag的負角度字串插值亦只改測試加括號，未改runtime，再由launchAndCamera完成其餘source及完整package。兩份中止報告均保留，最終report以resumedSourceAt記錄，102 flows沒有跳過。
- P21已commit／push：83d02a942d46b180a36e73d2ce59840ba21a1f0c；committed selection-preview在output/rocket/selection-p21.log，mode=affected。實際執行活動六Node、完整source／ZIP owner與既述靜態檢查，未執行全庫或等待CI。沿用持續發布授權，Sites來源fdb78876ccf6cb11dbd16fadf9774a0c0cc633aa、deployment appgdep_6add5dddd2188191b7cd9409f91b894e，native succeeded；精確使用驗過ZIP，原網址及owner-private維持。

### P22：手機操作艙與獨立畫面／讀數分區

- 使用者要求先處理操作：HUD及三鏡頭掣遮畫面、手機控制區太高、捲動誤改油門／轉向、分離後上級點火不方便。新增simulation-pane內的讀數列／純3D舞台／鏡頭工具列，讀數與鏡頭按鈕不覆蓋Canvas；控制區用controls-pane固定飛行操作列加獨立捲動內容。手機直向控制區約26dvh（180–236px；短窗口166px），餘位給模擬區，維持header／stage／controls三區、全屏及32px側捲頁條。桌面仍並排。
- 飛行操作列固定顯示時間／狀態、暫停／繼續、當前級點火／關機及分離；分離仍僅切換上級並滑行，不自動點火。耗盡下級時分離按鈕與其後「上級點火」在同一操作位置，無須捲動找掣。保留paused／running、關機與分離不中斷、明示點火繼續等既有模型規則。
- 油門／俯仰角重排為並列設定組。手機／coarse pointer隱藏會搶垂直手勢的range，改用數值輸入、加減及直上／45°／水平預設；桌面range保留。B變速量同樣有手機數字輸入，保留原±5。數字僅合法change才寫入、編輯中不被RAF覆寫；滑過按鈕／數字欄只捲面板，不變答案。T1–T3頁面／iframe捲動拓樸不改，控制面板T0及所有新目標用trusted native touch驗。
- 範圍HTML／CSS／main、既有registered browser owner與本計劃；無scene／美術、physics、rubric、snapshot schema、共享SCORM或manifest依賴變更。沿用既有低風險assessment、phase／variant與保存／重試契約。先驗source及ZIP的桌面／手機／橫向／短窗口布局、非遮蔽讀數、純Canvas增高、原生面板滾動跨數字／按鈕不改值、數字／鍵盤合法／無效輸入、分離後無捲動點火及running／paused，並回歸裝配／鏡頭／向量／任務／提交恢復；六Node、check／check:tests、文件／diff及committed selection-preview。真手機與Moodle另驗。

- P22完成證據：六活動Node、npm run check、check:tests（278 entries）、文件／diff檢查通過。既有registered owner以output/rocket-p22-regression.cjs選取本輪相關案例，source／extracted ZIP共88 flows、20 layouts，completed=true、errors=[]、selection=mobile-cockpit；逐byte核對manifest runtime。保留auditFixes／sceneArt／原生裝配／分級／全部telemetry／flightControls／288組向量transform／20布局／直接轉鏡／任務／SCORM保存恢復／pending及WebGL故障等，省略未改美術的geographyAndHud／earthStyle／artBenchmark；未聲稱完整全活動或全庫測試。
- source／ZIP各390×844、320×568、844×390、390×460 native touch及1280×800 mouse操作艙通過：HUD完全位於Canvas上方、鏡頭／向量圖例完全位於Canvas下方、44px觸控按鈕、頁面與visualViewport不漂移、固定操作列不隨內容捲動。390×844純Canvas 459.1px，P21讀數至鏡頭列之間有效空間259.9px，增加約77%；新讀數43.4px、鏡頭列46.0px、固定操作列72.3px。五種尺寸與上下級截圖已檢視。
- 共32次trusted native touch從油門數字、角度數字、油門／轉向按鈕開始垂直掃動：只面板scrollTop增加，完整state／window／visualViewport一致。手機range隱藏、桌面range保留，35%／42°／非法999°／B變速250m/s數字與鍵盤change驗證通過；RAF不覆寫正在編輯的欄位。每份五尺寸各running／paused分離後保留滑行、不自動點火，無面板跳位、焦點不捲動，原分離按鈕同一觸點可直接點燃上級並明示續飛，合共20次分離接點火流程通過。移除分離toast以避免面板底部錨定突然跳位。
- runtime SHA-256 efc73fd33e3b2abe99930b976c79cd2918f51c820cf48bcc2b60ef043640bcba；ZIP SHA-256 a1edfce6a5cc64474cc3a47d9ad5cc3bee8390d9800b2a7110f1901f869aaa22，258631 bytes。報告／cockpit／full-telemetry等截圖在output/playwright/rocket-space-mission-lab/。無scene／物理／rubric／schema／共享runtime改動；真手機鍵盤與長時間操作、真Moodle及獨立T1–T3宿主矩陣本輪未驗，不能以模擬觸控取代實機驗收。
- P22已commit／push：dad6bf4e2376e44034936d8b7642bce86b297f62；committed selection-preview在output/rocket/selection-p22.log，mode=affected。實際執行活動六Node、相關source／ZIP owner（selection=mobile-cockpit）與既述靜態檢查，未執行全庫或等待CI。沿用持續發布授權，Sites來源86d440dc49dc009512535fcc72e381c9a9b19fec、deployment appgdep_6add6dc6a5a08191a7078805d88d0c34，native succeeded；精確使用驗過ZIP，原網址及owner-private維持。


### P23：角落儀表與可見燃料條

- 依使用者否決P22外置讀數／鏡頭列，取消兩列佔用Canvas高度。讀數改為左上窄儀表、右上兩級燃料橫條；鏡頭以44px按鈕置左下角，中央保留火箭視線。主要數字22px，分量與燃料至少13px，保留全部速率與單位。
- 沿用既定assessment risk、rubric、dependencies、phase/variant matrix及snapshot schema；不變更物理、美術、評分、持久化或共享runtime。僅調整活動CSS與既有registered browser owner幾何／可讀性斷言。
- 驗證決策：source與extracted ZIP的手機／桌面、短屏／橫屏，實際字體與橫條比例、Canvas填滿simulation pane、原生鏡頭與捲頁把手、控制區掃動不誤改、分離後原位點火、飛行／記錄／fullscreen／SCORM生命週期；截圖目視。未改的地球美術與基準不重跑，真手機及真Moodle仍為獨立驗收。

- P23完成證據：六活動Node、npm run check、check:tests（278 entries）、文件與diff檢查通過。既有registered owner以output/rocket-p23-check.cjs選取完整telemetry／mobileCockpit／20 layouts／directCamera／launchAndCamera／flightVectors／lifecycle，source及extracted ZIP共40 flows，completed=true、errors=[]、selection=compact-instruments；另以output/rocket-p23-geography.cjs重跑受影響geographyAndHud幾何及既有地理延續檢查（4 flows、五尺寸各兩份），completed=true、errors=[]。其餘未改美術、GPU基準及裝配評分矩陣本輪未重跑。
- 各五尺寸390×844／320×568／844×390／390×460／1280×800，主讀數至少22px、分量及燃料至少13px；兩級86×6px燃料條分別50%／25%比例通過，單級隱藏、分離標籤、複核結果皆保留。儀表卡避開畫面中線，Canvas與simulation pane同高，不再有外置讀數／鏡頭列；390×844 Canvas為549.5625px。手機直／橫／短屏及桌面截圖已目視檢查，主要數字、單位、橫條可見。
- 保留44px鏡頭按鈕及32px手機側邊捲頁把手；共32次trusted原生觸控掃動控制欄，不改state／window／visualViewport。source及ZIP共20次running／paused分離後同位置點燃上級，面板不跳動。轉鏡、飛行暫停／續飛、向量位置／長度、SCORM生命週期與fullscreen皆在既有owner選取案例通過。
- runtime SHA-256 84769e90c94fb75040848a7bb94bc138be3b4a491cc5c8869afbd57cf53955a2；ZIP SHA-256 81aeee99c3ebab6674f19fef07a9c48d5c34f041ae5ed7df478617b301d7e33b，258803 bytes。報告及截圖在output/playwright/rocket-space-mission-lab/。此輪沒有物理、scene、美術、rubric、snapshot schema或共享runtime修改；真手機與真Moodle未驗證，模擬觸控證據不代表實機驗收。
- P23已commit／push：045eea1ff057e54aa20423bbef345125b67cbbc6；committed selection-preview在output/rocket/selection-p23.log，mode=affected。實際執行上述活動六Node、source／ZIP選取owner與geographyAndHud，未聲稱完整全庫或等待CI。沿用持續發布授權，Sites來源645ce400fa4359c29505d2649781e11c0a644cde、deployment appgdep_6add72ead7e481918b06e805c0ac3550，native succeeded；使用驗過ZIP，原網址及owner-private維持。


### P24：移除組裝接點提示字

- 按使用者要求移除火箭上「拖入零件」、拖放接點名稱及「插入」提示，接點保留44px透明圓框與可存取名稱，保留拖放吸附及不相容警告。
- 沿用既定assessment risk／rubric／dependencies／phase matrix／snapshot schema，無物理、scene、評分、持久化或共享核心修改。此為局部文字及外觀修正，不新增測試；選取既有registered owner的onboarding／workshop，驗證source與ZIP的桌面／手機裝配、接點點按、原生拖放、分級與點火，並檢視組裝截圖。

- P24完成證據：main.js語法、既有interaction／lifecycle兩Node、check:tests（278 entries）、文件及diff檢查通過。既有registered browser owner以output/rocket-p24-check.cjs選取onboarding／workshop，source與extracted ZIP共8 flows，completed=true、errors=[]、selection=assembly-labels。各1280×800桌面、390×844與320×568原生觸控：空接點點按、鍵盤選取／移除、元件點按、拖放／取消、分離器裝配、點火及分級通過。未新增持久測試或改動registered owner。
- 接點沒有可見文字，保留aria-label；手機與桌面組裝截圖已目視。runtime SHA-256 62fed76245bf37198deefcd3d27a916ac4ee060f3c50994cc08e779e7fbb91b4；ZIP SHA-256 45701418974d6bc7b38efc5a474678f639035bb946d206fd83a4da56cebe60f4，258635 bytes。證據位於output/playwright/rocket-space-mission-lab/p24-assembly-check.json及*-assembly-no-labels-*.png／*-empty-socket-*.png。未重跑無關地球美術、全活動矩陣或全庫；真手機及真Moodle未驗證。
- P24已commit／push：be93722c9a0f054c54fd82616ec43d16d6baddc1；committed selection-preview在output/rocket/selection-p24.log，mode=affected。實際驗證範圍如上，未執行全庫或等待CI。沿用持續發布授權，Sites來源f7a25612a1f2ec264a6b4985c56379f014b4c77f、deployment appgdep_6add74bbb670819190b215848e2da9c8，native succeeded；使用驗過ZIP，原網址及owner-private維持。


### P25：可見分離與姿態噴氣

- 歷史實作（分離與RCS規則已於P29修正）：分離時保留下級與分離器幾何，沿用分離前位置／速度，加1.5 m/s微小分離速度；下級以既有模型的無推力、真空重力滑行作視覺軌跡，上級沿權威飛行狀態運動。模型尺寸本來已誇張，兩級相對位移亦按火箭顯示比例呈現。鏡頭四秒內平滑由完整火箭轉為跟隨上級，保留上下級點火流程。下級離鏡後或60模擬秒清理資源；不加入下級氣動、回收／碰撞評分。
- 轉向採一對相反方向的短促藍白RCS氣流，僅由實際姿態變化觸發，鏡頭旋轉不觸發。動畫由模擬時間驅動，暫停凍結、還原或複核不重播；減少動態設定保留穩定氣流、不閃動。
- 沿用既定assessment risk／rubric／dependencies／phase matrix／snapshot schema；效果僅位於scene與scene-art，main傳入可播放效果的edit標記，不改物理、燃料／評分、SCORM或持久化欄位。兩個既有runtime已在manifest，無新增依賴。
- 驗證決策：擴充既有registered browser owner的effects案例，source與ZIP、桌面／手機／窄屏／橫屏，驗證向上慣性、逐漸分開、上級點火加大間距、轉向氣流力矩方向、無轉鏡誤噴、暫停／還原／複核、資源清理及100 draw calls／100k triangles預算。沿用sceneArt、flightVectors、launchAndCamera與lifecycle相關檢查，目視分離及噴氣截圖。真手機與真Moodle為獨立驗收。

- P25完成證據：六活動Node、npm run check、check:tests（278 entries）、語法／文件／diff檢查通過。既有registered owner新增flightEffects，無新增runtime依賴。output/rocket-p25-check.cjs先跑source／ZIP的effects、sceneArt、flightVectors、launchAndCamera、lifecycle，共20 flows（p25-effects-check.json）。其後放大藍白氣流及改成整個下級完全離鏡才清理，source／ZIP四尺寸1280×800、390×844、320×568、844×390重跑effects／vectors，共12 flows（p25-final-effects-check.json）。最後修正噴氣以透明度脈動保持噴嘴位置，以及唯讀紀錄返回edit不可誤播，source／ZIP桌面1280×800與手機390×844重跑effects／vectors，共8 flows（p25-anchor-effects-check.json、selection=flight-effects-anchors）；三份報告completed=true、errors=[]，最後報告runtime與當前manifest逐byte一致。早期廣泛檢查與最後兩輪屬不同runtime雜湊，沒有聲稱最後再次執行全部活動／全庫或真Moodle。
- 分離前後上級投影位置誤差小於1px；下級繼承正向速度、關機滑行，兩級都上升，上級點火增加相對間距。下級頭部仍可見時不會清理；模擬時間暫停時位置／軌跡不變，轉鏡不觸發噴氣，reload／review／紀錄返回不重播。RCS順逆向成對氣流力矩、到位停止、快進完成後停止、噴嘴固定及減少動態穩定透明度通過；不改權威state。八次反覆重建／分離／清理，warm-up後geometry／texture／program／實際GL buffer數量一致：{"geometries":21,"textures":8,"programs":12,"buffers":63}。下級與上級同時顯示的測量上限45 draw calls／40462 triangles；RCS及向量各案例亦符合100／100k預算。手機／桌面分離及噴氣截圖已目視。
- 最終runtime SHA-256 4ae23e12f72ce08a50753fb316119e193f62ab7fe3e711093f79e7b4b906a9e4；ZIP SHA-256 755296c9fad7d4ab6523bf7d980421e09b4debfc06d1c75190a4a1dc1d283e7f，260007 bytes。效果按模擬時間運行、快進會加速；RCS僅作視覺呈現，不另扣燃料。真手機及真Moodle未驗證。
- P25已commit／push：e39bb3e605256055bfa2efe83468a881fa74f686；committed selection-preview在output/rocket/selection-p25.log，mode=affected。實際驗證選取與各輪runtime界線如上，未執行全庫或等待CI。沿用持續發布授權，Sites來源3ea0de13e97eae3bfff694152157e28a69cce1e6、deployment appgdep_6add7ab0c1408191b705fc6262e69d82，native succeeded；使用最終驗過ZIP，原網址及owner-private維持。


### P26：安裝接點改為小圓點

- 使用者指出大圓形遮擋火箭；改為10px可見圓點，吸附時12px並以小光環標示。保留44px透明按鈕及既有30px拖放吸附範圍，移除正常／選取／不相容／hover／snap各狀態的大底色與外框，不改安裝判定或接點位置。
- 沿用既定assessment risk／rubric／dependencies／phase matrix／snapshot schema；本輪僅活動CSS，無runtime依賴或物理／評分／保存修改，不新增持久測試。選取既有registered browser owner的onboarding／workshop，驗證source與ZIP桌面／手機點按、拖放、分級及點火，拖動期間核對小標記、透明44px命中區及截圖。

- P26完成證據：check:tests（278 entries）、文件及diff檢查通過。output/rocket-p26-check.cjs選取既有registered owner的onboarding／workshop，source／extracted ZIP共8 flows，completed=true、errors=[]、selection=small-sockets；1280×800桌面及390×844／320×568手機，原生點按、拖放／取消、裝配與分級／點火通過。拖動期間實測可見圓點10–12px、透明按鈕至少44×44px、無大底色／border／box-shadow，small-sockets-*.png已檢視。
- runtime SHA-256 3972fae562f47cafc771141198cca422f2d1892fd2f5bc317f4f3891a084c6b1；ZIP SHA-256 6a3a27ee01195727ac32991bac4e8fcbfecd3d30ccab800fa6da79ed5118e64d，260082 bytes。僅活動CSS，沒有JS／模型／評分／保存修改；未重跑無關美術、特效或全庫，真手機及真Moodle未驗證。
- P26已commit／push：3ad39f089516716c03e3f234e35e8bd08a60084b；committed selection-preview在output/rocket/selection-p26.log，mode=affected。實際驗證選取如上，未執行全庫或等待CI。沿用持續發布授權，Sites來源0dadc5104c0b32bea77d65f4036d855ff1588dc7、deployment appgdep_6add7cc7788c8191b92332649b0e186c，native succeeded；使用驗過ZIP，原網址及owner-private維持。


### P27：非全螢幕手機面板與美術優化規劃

- 使用者指出普通手機瀏覽器的控制區太窄，並要求保留卡通風格、提升地球／太空細節且兼顧性能的詳細方案。先修改自適應面板；美術只制定[實作方案](../docs/rocket-art-direction-and-performance-plan.md)，尚未更換場景資產。
- 影響範圍：活動styles.css、既有registered browser owner、此計劃及美術方案。沿用assessment risk、rubric、phase/variant、snapshot schema和依賴；CSS不寫入學習狀態，無model／SCORM／manifest新增依賴。
- 版面決定：取消26dvh／236px上限及短屏166px限制，直向改為clamp(240px,42dvh,360px)，短屏以clamp(172px,calc(100dvh - 275px),220px)分配，390×460保留200px舞台，避免角落儀表與鏡頭重疊。固定飛行操作列保留，內容獨立捲動，44px觸控及數字16px保留，底部兼容safe-area。全螢幕沿用同一套自適應規則。
- 驗證決定：延伸已登記mobileCockpit案例，加入375×600、390×664普通瀏覽器可視區；往返844／664／568／460px高度，檢查非全螢幕、可見內容高度、底部控制可達及state不變。source和extracted ZIP沿用layouts、telemetry、trusted touch、鏡頭／裝配及lifecycle相關案例；靜態check、check:tests、活動Node與文件檢查。真Safari工具列／鍵盤、實機熱負荷、真Moodle另驗。
- 目前未commit；committed selection-preview待有實際commit後記錄，不以工作目錄預覽冒充。

- P27完成證據：六活動Node測試、npm run check、check:tests（278 entries）、JS語法、文件及diff檢查通過。沿用既有registered owner，ignored wrapper選取mobileCockpit／toolbarResize／layouts／completeTelemetry／geographyAndHud／onboarding／paletteScrolling／directCamera／launchAndCamera／workshop／lifecycle，source與extracted ZIP共60 flows、20 layouts，completed=true、errors=[]。報告：[p27-panel-check.json](../output/playwright/rocket-space-mission-lab/p27-panel-check.json)。引擎Chrome 155.0.8059.86，軟體GPU；沒有以此宣稱真手機性能。
- 七種操作艙尺寸中，390×664舞台310.1px、控制區278.9px、可捲內容205.6px；375×600可捲內容178.7px；320×568為166.7px；390×844為281.2px。390×460短視窗保留200px舞台、可捲內容111.7px，儀表、鏡頭及向量圖例無重疊；第一輪短屏重疊的中止報告保留為p26-panel-first-run.json，最終版已重新完整執行本輪選取。
- source／ZIP共48次trusted touch從數字／加減掣起始掃動，只移動panel而不改state／window／visualViewport；28次running／paused分離後原位點燃上級流程通過。844→664→568→460→844高度往返保持暫停飛行state、最後控制可達，無根頁面溢出。窄／短手機、工廠、桌面與封裝手機截圖已目視。
- runtime SHA-256：75cb354c040e1776166fa962f77903acc1ce0323311f91852e9e2049712d81fd；ZIP SHA-256：60127d66a8e5b076ba16816ed82b3b17f20ebe719713f7256f34124b1eefeb03，260140 bytes。manifest所列runtime與解包內容逐byte一致。
- 測試歸屬工作目錄預覽在output/rocket/selection-p27-worktree.json，mode=affected、唯一browser owner為rocket-space-mission-lab；選取器列出240個Node及該browser owner，但本輪實際只執行上述六活動Node和指定browser案例。未提交，故無本輪committed selection-preview；未部署。無新增runtime依賴或美術資產，未重跑無關全庫／美術benchmark；真Safari工具列／鍵盤、真機長時間性能、獨立T1–T3宿主矩陣及真Moodle仍待驗。


### P28：卡通美術完整實作與原站部署

- 使用者已確認P27美術方案並明確要求完整實作及更新原有網站。沿用P27手機面板；美術按地理色圖、局部地貌、雲層／星野、火箭／發射場材質及性能收尾實作。Sites project appgprj_6adc62579ab88191aba299bcb282ce95，保留owner-private及原網址。
- 沿用既定低風險assessment、rubric、phase/variant、snapshot schema；美術與性能層不改物理、評分、快照、SCORM報告或提交規則。地理位置沿用原發射點轉換，自轉仍僅視覺。新增runtime貼圖／地理資料要列入manifest；offline資料與產生工具獨立保存來源及重建方法。
- 影響範圍：scene-art.js、scene.js、main.js必要渲染更新；新assets及離線製圖工具；manifest、既有browser owner及必要Node資產檢查／registry；活動計劃及美術方案證據。先保存未改美術的runtime供同環境比較。
- 測試決定：實際查看2K／4K地球、低空／中空／軌道、三鏡頭、極區／經線接縫；來源／ZIP全部火箭browser owner與六Node，地標跨高度一致、素材故障保持提交、暫停無閒置GPU繪製、像素比例及降級、重建資源穩定、100 calls／100k triangles、手機紋理預算與ZIP≤5MB。增加可重建素材自檢及測試歸屬；保存持續採樣及前後比較，軟體GPU證據不得稱真iPhone性能。
- 完成檢查後commit／push本活動變更、產生committed selection-preview，以測過SCORM內容更新Sites source checkout、保存版本及部署，核對native部署結果與build標識。真機／Moodle環境若無法取得，清楚保留驗收限制而不虛構結果。

- P28完整本地回歸完成：七活動Node、registry自測、npm run check、check:tests（279 entries）、修改文件鏈結、語法及diff檢查通過。既有registered browser owner全跑source／extracted ZIP，合共130 flows、20 layouts，completed=true、errors=[]；Chrome 155.0.8059.86／SwiftShader。報告[report.json](../output/playwright/rocket-space-mission-lab/report.json)，首輪樹木移位導致launch clearance失敗的報告保留為p28-first-full-run.json，修正後已重新完整執行。
- 已驗全球／局部地理跨高度一致、普通手機控制區與動態高度往返、trusted touch、裝配／分級／RCS、變軌／預覽、部分提交、Moodle模擬續做／pending／review鎖定、fullscreen、貼圖載入失敗仍可提交、context loss／restore、重建資源穩定。Node資產檢查驗來源／素材hash、海岸／地標、陸地和封裝完整；離線生成器另有接縫及shader座標roundtrip自檢。
- 完整回歸版本runtime SHA-256：7c1dc75e9f8bed400526a960094650191d8d88ec68cacf29478941d67e7f678d。全部採樣場景最多73 draw calls、48,554 triangles；貼圖估算手機45.583MiB／桌面84.583MiB（含mipmap，不含framebuffer／driver）。暫停300ms期間0 GPU draws／0操作定位更新；兩級DPR降級與冷卻不改model或新增textures，樹木維持450m clearance且避開河岸。
- P27面板與P28卡通美術在本輪一併提交及部署；P27段落的「未提交／未部署」是當時歷史狀態。真iPhone／Android工具列／鍵盤／熱負荷／冷載／輸入延遲、三輪真機基準、真Moodle及獨立T1–T3宿主矩陣未驗證；本輪本地通過不宣稱Moodle-ready或真手機30fps。

- 同機基準snapshot的runtime hash為75cb354c040e1776166fa962f77903acc1ce0323311f91852e9e2049712d81fd。原始與封裝四場景各合計60秒採樣；桌面p95約33.4／66.9／66.8／50.2ms，與舊版相同；手機軌道50.1→33.5ms。暫停300ms的舊版操作定位18次，新版0次。軟體GPU結果只作相對比較。
- 首輪手機pad source曾出現p95=50ms、package=33.5ms；對舊／新各三次重測，舊版三次33.5ms，新版50.1／33.5／33.5ms。針對這個觀察，把背景球每fragment的atan／asin轉成既有球體UV，保留世界方向固定與日夜漸變；兩行shader修改不涉及控制／物理／持久化。最終版再跑registered owner的geographyAndHud／earthStyle／sceneArt／artPerformance／layouts及三次手機pad benchmark，分別驗source／ZIP，報告p28-final-sky.json；不把此前的全流程報告冒充最後shader的runtime hash。

- 最後背景shader版本的source／ZIP專項驗證完成：20 flows、20 layouts、errors=[]，每份三次pad穩態採樣。source p95=50／33.5／33.5ms；package三次均33.5ms，與舊版三次33.5ms相同。首次source尾端慢幀仍保留為已知觀察，不能宣稱所有首次入景樣本都達到≤10%回退門檻；沒有把軟體GPU推算成真機性能。最後runtime hash c84316dcefbc2b2c53328db755eafb979e0b575110e1a6982ccc0e7251d00c9f，ZIP SHA-256 1f57b33b0bacf5dd91992d7bb48e79429075cdcb2610c4ec6d86d7080465d04b，910154 bytes。這份ZIP供Sites部署，之後不再重建。

- P28已commit／push：28cc65dc44dc99cd1f4df9cddb942b0e51c07d2e。committed selection-preview在output/rocket/selection-p28.json：mode=full，279 entries，原因包括新offline工具未映射及registry修改；這是選取預覽，不代表已跑其餘活動全庫或CI。實際執行範圍及最終shader專項如上。
- 使用已驗ZIP更新Sites checkout，helper已push來源726bcd1ac0cf62a604a0341a0a7ca6caff84b156並產生rocket-art-p28.tar.gz；保存版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_5ccb289f1b248191b048390156371781，deployment appgdep_6add9eca40d08191a320930256be19e7，native status=succeeded。原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-only audience維持。
- 線上核對完成：27份檔案中，25份程式／樣式／素材／版本資料逐byte等於已推送dist；兩份HTML移除託管平台額外插入的938字元script後，原頁內容亦逐byte一致。入口index.html由平台正常canonical redirect；驗證只跟隨同站點的對應目錄，不把service token帶離該站。build-info.sourceCommit=28cc65dc44dc99cd1f4df9cddb942b0e51c07d2e，packageSha256與上述最終ZIP相符。證據output/rocket/p28-live-verification.json；原網址已交給Codex頁籤開啟（queued），本地預覽server與測試Chrome已關閉。


### P29：分離軌跡、下級存續與RCS停止修正

- 使用者回報下級分離後衝到上級前方、很快消失，以及RCS在沒有繼續調向時長噴。根因包括實際位移乘上放大的火箭比例、下級忽略阻力、離鏡／60秒即清理，以及把微小自動姿態追蹤視為持續轉向。
- 範圍：scene的分離座標／生命週期與RCS視覺判定；model既有RK4增加僅供下級殘骸使用的質量選項，使其重用重力／阻力／觸地判定；既有model.test與registered browser owner的flightEffects案例。無新增依賴。權威上級物理、燃料、評分、SCORM、phase/variant及snapshot schema沿用；下級為session內視覺軌跡，reload／review不重播。
- 實作決定：保留上級原速度，下級繼承並沿分離軸減1.5m/s；用下級乾重、餘油、分離環質量計阻力，按實際世界單位顯示相對位移；下級模型放大比例另受其離地高度限制，避免插入地球，從上級向下望可見下降。取消離鏡及定時刪除，實際觸地或離開本次flight時清理；有足夠水平速度則按物理繞行，不強迫垂直墜落。RCS有可見轉向才噴，微小方向維持不持續顯示，停止轉向／到位後熄滅；暫停沿用效果凍結。
- 測試決定：七活動Node、check／check:tests及文件檢查；source與extracted ZIP四尺寸flightEffects，擴充低空阻力、傾斜分離、世界座標比例、超過60秒／離鏡返回、快進同步、下降與實際觸地、RCS小步長長時間到位後停止；沿用vectors、camera、mobile操作艙及lifecycle，檢查資源及100 calls／100k triangles。檢查後commit／push並更新既有owner-private網站；真手機／真Moodle另驗。


- P29主要回歸完成：七活動Node、npm run check、check:tests（279 entries）、語法及diff檢查通過。既有registered owner專項選取flightEffects／flightVectors／launchAndCamera／directCamera／mobileCockpit／lifecycle，source與extracted ZIP共42 flows、errors=[]、completed=true，報告output/playwright/rocket-space-mission-lab/p29-effects-check.json；runtime hash 361697fd674edad8b2b29c88bd9f699835fb554249ea49afa99adeb01a4f48fd。包含原生觸控、暫停／續做、還原／提交、context recovery等既有案例；不是全庫或全部火箭browser owner。
- 四尺寸1280×800、390×844、320×568、844×390均驗低空45°分離、真實座標比例、初速繼承、70秒離鏡返回仍保留、200秒後仍下降且最後實際觸地。從上級向下看的桌面及手機截圖已目視；下級按離地高度限制圖示大小，避免放大模型插入地球。分離、暫停、轉鏡均不改權威上級state。
- RCS正常0.1秒步長案例：100步中有9步顯示轉向，最後30步微小自動方向追蹤持續改變姿態，但0步顯示噴氣；順逆向力矩、快進到位、無轉鏡誤噴、減少動態與review不重播通過。八次重建／分離／清理warm-up後資源一致：29 geometries、8 textures、12 programs、106 GL buffers；仍符合100 calls／100k triangles預算。
- 首輪測試曾遇浮點時間assert與130次同步GPU繪製造成SwiftShader／CDP排隊逾時；已改為時間容差、直接採樣production drawEffects的小步長，再由既有正常draw案例驗圖形，資源重建分開browser turns。完整42-flow選取已重新通過，沒有把逾時當成功。最後另補impact／escaped時立即熄滅RCS，避免最後一幀長留；該單行修改後再跑source／ZIP四尺寸flightEffects，與上述較廣回歸分開記錄。

- 最終版source／extracted ZIP四尺寸共8個effects flows通過，errors=[]；新增實際觸地最後一步仍在轉向時RCS必須為0。報告output/playwright/rocket-space-mission-lab/p29-final-effects-check.json；最終靜態／registry亦通過。runtime SHA-256 2fa69aa7b2288fac3d819334477b4f3b96c368f29af02ec8c15323f1175b38c4；ZIP SHA-256 0e0acf2c78a6edbb1b01aa321063afff2bc503b154bfc8228b2cc38b0f7a635c，910202 bytes。此ZIP供本輪部署，之後不再重建；最後專項記錄的最大46 draw calls／43328 triangles。真iPhone／Android、實機熱負荷、真Moodle及全庫未驗證；下級軌跡仍是session內視覺狀態，reload／review不重播。


- P29已commit／push：06531bf638e1cd2909cf5dacd26276e0cfd95a00。committed selection-preview在output/rocket/selection-p29.json，mode=affected，只歸屬rocket-space-mission-lab；實際執行七Node與上述42-flow／最終8-flow專項，未聲稱全庫或完整browser owner／CI。
- Sites helper已push來源9f2efad18ae2a3b53011822bd93a318fd1b9c6e8，以上述驗過ZIP產生rocket-effects-p29.tar.gz。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_433d0bd3670c8191be848d5cf5cba4a1；deployment appgdep_6adda6a81f80819186ddf83f21adbc1a，native status=succeeded。原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-only audience維持。
- 線上27份檔案已核對：程式／樣式／素材／build-info逐byte相同，兩份HTML移除託管平台插入script後亦相同；只跟隨同origin的canonical index redirect。build-info.sourceCommit=06531bf638e1cd2909cf5dacd26276e0cfd95a00，packageSha256與最終ZIP相符，證據output/rocket/p29-live-verification.json。原網站已交給Codex頁籤開啟（queued），本地預覽及測試Chrome已關閉。


### P30：適量分布雲團、引擎辨識與簡潔SIMLAB標示

- 使用者要求改善僅集中發射場、交叉薄片狀的雲，適量分布到其他區域；大推力引擎改四噴嘴集束、高效率引擎改單個寬口真空鐘形噴嘴，選件圖亦須能辨識；移除P–1500／P–6000、條碼及序號裝飾，改為燃料箱上橫向SIMLAB。
- 範圍：scene-art.js的雲／引擎／機身貼圖與火焰、scene.js必要的噴嘴火焰縮放、index.html引擎SVG；既有離線雲圖生成器與clouds.webp／geography.json資產hash；既有art.test及registered browser owner專項。無新增依賴，manifest沿用既有資產。沿用assessment risk、rubric、phase/variant、snapshot schema、燃料／質量／推力與SCORM；兩種引擎僅更改視覺，安裝／分離器包覆／選取幾何契約維持原2m引擎高度。
- 雲決定：以單批次圓潤立體雲團取代交叉平面，少量分布近／遠處及四方，保留發射點周圍淨空；全球雲圖保留1K、適度且跨經度分布，不增加runtime紋理尺寸或逐幀雲模擬。近景雲不再當作地面微細裝飾過早隱藏，隨原有局部環境漸退。
- 驗證決定：檢查離線雲圖覆蓋／經線接縫／資產hash；七活動Node、check、check:tests；source與extracted ZIP桌面／手機的四／單噴嘴、火焰出口／油門縮放、logo貼圖、近遠雲分布與截圖、分離器包覆／安裝拖放、分離/RCS、資源重建與100 calls／100k triangles預算。維持手機紋理預算；檢查後commit／push，將測過ZIP部署原有owner-private網站並核對線上檔案。真手機／真Moodle另驗。

- 首輪美術預覽source／ZIP共4 flows通過，含實際噴嘴與火焰錨點、油門寬度、logo文字、雲團及全球雲覆蓋；桌面及手機截圖已目視。較廣回歸的naturalStaging發現加長真空噴嘴超出舊外殼0.15m，已把該外殼提高至2.32m（留2cm實際間隙）並把可點選安裝環調至引擎base+1.7m；引擎stage高度／質量／物理不變。失敗報告保留為p30-first-regression.json，修正後重跑。

- 補充幾何證據：擴殼到恰好2.3m時選取已通過，但instanced Float32噴嘴頂緣比殼的bbox高約0.000000085m；增加2cm實際間隙，沒有放寬包覆assert。既有測試現在分別記錄包覆與實際pick結果，方便診斷。

- 火焰沿用instances helper，把四個出口按三層顏色各合併一批，與單出口同為3次火焰draw；油門僅在數值改變時更新各instance的寬度，出口座標固定，逐幀只沿用既有長度動畫。bounds預先保留全寬，避免縮放後錯誤裁切。

- 58-flow source／ZIP較廣回歸通過（p30-art-regression.json），包含新版美術、sceneArt、artPerformance、naturalStaging、onboarding、assemblyDrags、launchAndCamera、flightEffects、flightVectors、lifecycle及工廠／10km低空各15秒採樣。桌面p95約33.5／50.2ms，舊版33.4／50.1ms；手機工廠16.8ms相同，低空median仍16.7ms，但p95由16.8升至33.4ms。據此只把手機地球經向網格128降至96，保留全部近地徑向細分、2K貼圖與雲／引擎形狀；桌面不變。最後另跑美術／地理一致性／scene資源與手機benchmark專項；不以較早58-flow報告冒充最後runtime。

- 手機96經向版本專項18 flows通過，但低空p95仍33.4ms（median16.7ms）。再針對近地shader：當地表完全由局部圖覆蓋時直接取局部色，省去被覆蓋的全球UV三角函數及atlas取樣；混合邊界與雲仍走原路。既有地理像素檢查加入強制原取樣路徑的GPU對照，確認快路徑與原路徑色值一致。這是性能修正，不另降雲／噴嘴細節。

- 最終近地取樣優化版：source／ZIP專項18 flows（p30-final-mobile.json）及完整局部混合邊界GPU對照4 flows（p30-shader-boundary.json）均completed=true、errors=[]。快路徑與強制原取樣路徑逐像素一致；手機工廠／10km低空各15秒採樣p95均16.8ms、median16.7ms，回復舊版基準。這是Chrome 155／SwiftShader本機相對比較，不推算為真iPhone效能。
- 最終七活動Node、靜態／registry（279 entries）、語法及diff檢查通過；雲圖生成器重建逐byte一致，覆蓋0.2538、四個經度區域0.2401–0.2676，1K與接縫契約維持。手機／桌面紋理估算45.417／84.417MiB，較舊版各少0.167MiB。重建資源穩定，最終專項最多72 draw calls／56186 triangles。桌面／手機兩引擎、噴嘴近照、近遠雲及軌道截圖已目視。
- 最終runtime SHA-256 83b50ab29527509903614aca3b3a4ebe519dc84d73f7e453268c9da59766ac75；供部署ZIP SHA-256 9a76f692478d67a8c6546f3c85f2fd27bf7ca7c891189d73b750efb27626d07b，945902 bytes。廣泛58-flow版本runtime為910687814d52b0c88867b67e8593d754c94adc3005a00cf8e2d54e903e8a83cf；先前baseline由9c1ac80 git archive建立，實際runtime hash e7fe2a61dc39a6a5653c5f0d57bcc63e2542df6c315cb47ccc2caa0785340d4b，四個15秒採樣保存在p30-first-regression.json的before flows。未重跑全庫／完整browser owner，真手機、熱負荷與真Moodle仍待驗。


- P30已commit／push：ce75a4796e2982abd14c42644de99c4806c3084d；committed selection-preview在output/rocket/selection-p30.json，mode=full、279 entries，原因是tools/rocket-art/README.md未映射。這是選取預覽，不代表已跑全庫／CI；實際執行範圍與runtime界線如上。
- Sites來源ae0e2970eeedb02c6dba4ec244d1a403d8c7fc96，archive為rocket-art-refinements-p30.tar.gz；版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_616bc6f3a3348191974fe3eeadd51c89，deployment appgdep_6addb6920658819191f301997449047a，native succeeded。沿用原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site與owner-only audience。
- 線上27份檔案核對完成：JS／CSS／素材／build-info逐byte等於驗過dist，兩份HTML移除託管平台插入script後亦一致；只跟隨同origin的canonical index redirect。build-info.sourceCommit=ce75a4796e2982abd14c42644de99c4806c3084d，packageSha256與最終ZIP相符。證據output/rocket/p30-live-verification.json；原網址已交給Codex頁籤開啟（queued）。本地預覽及所有測試Chrome已關閉，生成的Python cache已清理，既有.codex-remote-attachments未動。


### P31：連續立體區域地形與海岸／距離精度銜接

- 使用者授權實作先前分析並部署。範圍：既有離線地理生成器、區域地形資產與renderer、既有art.test及registered browser owner、manifest。保留卡通風格；assessment risk／rubric／phase與variant／權威snapshot／物理碰撞地球半徑／評分與SCORM沿用，地形僅作視覺，不改發射或軌道物理。
- 決定：以相同Natural Earth海陸輪廓離線生成約480km寬的曲面立體地形，包含連續山脊丘陵及幾何海岸；分16區，各提供三種精度、共享邊界輪廓，屏幕投影大小與品質控制精度，有緩衝防反覆切換。近場設備仍按原規則隱藏，但立體地形不在60km高度一刀切；遠景逐步融入原地球，邊緣高度歸零。預先生成幾何／法線／配色，不在飛行逐幀重建，不增加重型後製或動態陰影。樹／建築按新地面落點定位，發射點與既有近場河道保留平整淨空。
- 依賴：既有本地Three與離線Python／NumPy／SciPy／Pillow，無新套件或網絡地圖。新增runtime檔案納入manifest與資產hash。風險：海岸對齊、區域邊界裂縫、LOD跳變、手機繪圖量／記憶體及reload／context恢復；以source與extracted ZIP實際檢查。
- 驗證決定：七活動Node、靜態／registry／selection-preview；地形資產確定性與合法拓撲、海岸共享、正法線與有限數值、平整發射／河道；source及ZIP桌面與手機近地斜望／沿海／中高空／軌道／縮放／遠離／下降返回、狀態不變、LOD與draw budget（100 calls／100k triangles）、資源穩定、context recovery與提交可達。與原版同機同鏡頭比較15秒採樣；真iPhone／熱負荷與真Moodle另驗。完成後部署原owner-private網站。

- 實作補充：以SciPy Delaunay離線產生受海岸邊界約束的網格，每層核對海陸面積；棄用第一輪狹長三角面細分。分區／精度共用邊界，近場500m網格及原發射淨空保留，遠方山地依屏幕精度簡化；最多240組低面數立體林冠只在可辨識的中景出現。近地全覆蓋區域的地球shader直接畫安靜海色，避免被幾何覆蓋的地圖取樣；邊緣及軌道沿用原圖。新增terrain.bin與terrain.js已納入manifest，無增加runtime紋理。
- 首輪預覽修正：地球Float32近極點高度與地形三角面的深度太接近，出現底面穿透；另用像素對照檢查，並收緊follow相機的深度範圍。新art.test檢查所有LOD的共享邊界，揭示海岸／分區交點的0m與高度場判定差異；以同一分段高度統一處理，不放寬裂縫斷言。這些預覽不作最終驗證或部署證據。

- 性能補充：中央四區使用不透明地形先寫入depth，地球略過被覆蓋的像素，外環保留邊緣混合；手機近地海面另用48經向網格，地理海岸由獨立精細地形負責，120km以上／軌道恢復原96、桌面維持128。沒有降低海岸、山地、林地精度或貼圖解像度。河流原有水面／河岸共面，新增水面depth offset避免露出條紋。淡出的外環先恢復底圖，再淡出立體地形，避免海色清除已淡去的陸地。

- 回歸證據：p31-check.json共54 flows（含舊版4個benchmark及source／ZIP各25個流程），completed=true、errors=[]，runtime a4b7534087fe0470ad0a7bf37d1af12c54922397fc797f0bcf9682638dd7db14；涵蓋分離、RCS、向量、相機、自然上升、地球分層、context recovery與提交生命週期。後續36-flow p31-final.json（runtime f9f7195d7c808cb8a6acb58cc16221d50b7cab7b29a0c2d897bff8f9afe0fa46）通過地面像素對照、LOD資源重用與上述主流程；手機近海精度調整後20-flow p31-mobile-final.json（runtime 9068f5c7567419f7f1d4da9fbcffbc6fb468e89745595a1581ecc9eb21c3de14）亦通過。這些是不同runtime的階段證據，沒有冒充最終全套回歸。
- 最後將地形光照離線烘焙，使用vertex color基本材質，保留真實網格起伏；最終source／extracted ZIP共20 flows，p31-release.json completed=true、errors=[]。包含桌面／手機各高度與zoom、48／96／128海面精度、海岸、4次LOD循環穩定、品質降級、暫停不繪圖、地理GPU對照，以及地球加入前後不透明地形像素差異=0。最後runtime SHA-256 e01fc38ed32d787114c8ef11dc060c1ec5422824e00e3bf4c9bf1bd2b53bcd65；ZIP SHA-256 4d896ce9a0b7ed8d6b0ee1ca7da78855efc6ead0c1ebe6d29f739cdad40ab5a0，1929748 bytes，供部署並不再重建。
- 資源：最後視角取樣最多85 draw calls／73456 triangles，低於100／100k預算；terrain.bin 1877428 bytes、三層合計43250 triangles，離線重建逐byte相同（SHA-256 a226b8d3b517f96b094f4b2ec120f738446662f663a34ae0e715180e7a1f44ba）。所有共享邊界高度一致；手機／桌面紋理估算仍45.417／84.417MiB。七活動Node、靜態／registry（279 entries）、最後目標語法、docs與diff檢查通過。桌面／手機各高度、海岸、發射場與地平線截圖已目視。
- 性能限度：同機Chrome155／SwiftShader，每個場景暖機2.5秒、採樣15秒。02e8a9c git archive基準runtime 38eae13fff2232e62927a580e78b6dce0ae8d6e42de80ea020216651e825b417；工廠桌面／手機p95=33.5／16.8ms，10km上升桌面／手機p95=50.2／16.8ms。最後上升桌面median約50.1ms、p95=50.2ms，手機median約16.7ms（與原版相同）、p95=33.4ms，CPU p95約1.9–2.4ms。平均顯示節奏保留，但手機尾端慢幀未完全回到基準；不聲稱所有性能指標均無回退或推算為真iPhone表現。新場景沒有新增紋理或後製，仍按像素大小、分區、品質降級控制繪圖量。
- 真iPhone／Android、熱負荷與真Moodle未驗；未跑全庫或完整browser owner。山地高度是視覺示意，物理碰撞仍沿用原地球半徑，沒有新增地形碰撞或改評分／snapshot。

- 已commit／push實作3f0341b3e7f2fa17b5f1e47f3da3803d54e4bdc0。committed selection-preview位於output/rocket/selection-p31.json，base02e8a9c→3f0341b，mode=full、279 entries，原因是tools/rocket-art/README.md未映射；這是選取預覽，實際執行範圍及各runtime界線如上，不代表全庫／CI。
- Sites helper已push來源0da7b4d0c8e5df60d299b0ded9fe19c4ed551c40，archive為rocket-terrain-p31.tar.gz。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_b43555f7d46c8191857d1fe2555a4a37；deployment appgdep_6addccaa50348191b2c49a8b76afe176，native status=succeeded，2026-10-25 09:32:34 UTC。沿用原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site與owner-only audience。
- 線上29份檔案已核對：程式、樣式、地形binary及其他素材、build-info逐byte等於驗過dist；兩份HTML移除託管平台插入script後亦相同，僅跟隨同origin的canonical index redirect。build-info.sourceCommit=3f0341b3e7f2fa17b5f1e47f3da3803d54e4bdc0，packageSha256與最終ZIP一致；證據output/rocket/p31-live-verification.json。原網址已交給Codex頁籤開啟（queued），本地preview及全部測試Chrome已關閉；既有.codex-remote-attachments未動。
