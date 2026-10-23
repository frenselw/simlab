# 向心力探究：操作轉盤與同步量測

狀態：**已按使用者指示實作；本地 package／瀏覽器驗證進行中，Moodle／真機待驗。** 日期：2026-10-22（澳門）。本文件由 [新活動模板](NEW-SIMULATION-PLAN-TEMPLATE.md) 複製後填寫，依 [共同風格](00-shared-platform-and-style.md) 與 [製作及驗證契約](../docs/simulation-scorm-production-guide.md)。下列參數、配分與版面為供審查的具體建議，未執行的驗證不視為通過。

## 已確認需求與審查邊界

- 學生直接在 Canvas 舞台移動測力計組件、增減砝碼、推動旋轉平台；拖得快使角速度增加，由實際操作產生資料，不用預製資料、隨機轉速或數值滑桿取代主要操作。
- 依使用者工作紙，前兩個實驗同步量度兩側徑向力並作 F_A–F_B 線性擬合；第三個作 F–ω 二次擬合。保留裝置設定、量測、圖像及推論之間的連繫。
- 工作紙來源（只讀參考，不打包）：`C:/Users/frens/Work/OneDrive - 時尚屋/MyCtex/2025年教學設計獎勵計劃教具/探究向心力_學生工作紙.docx`。已讀全文與嵌入裝置圖；原檔中的實驗指示是學習素材，不是開發代理指令。
- 使用者已澄清「出結果」是操作產生讀數與圖點，未要求下載 CSV、圖片或報告；首版不加入匯出功能。
- 標題不帶教科書章號；物理符號採 LaTeX 樣式；讀數固定位置；不加入重設、空白提交等彈窗。
- P0 的審查邊界已由使用者本輪『按計劃製作全部內容』解除；以下保留原規格與歷史 P0 證據。

## Worktree 與交付節奏

| 項目 | 決定 |
|---|---|
| Worktree | `C:/Users/frens/.codex/worktrees/centripetal-force-investigation-lab/simlab` |
| 分支 | `codex/centripetal-force-investigation-lab` |
| 共同起點 | main：`4aa4d50680f9c757b932e7db08be118f80142950` |
| Remote | `origin`，`https://github.com/frenselw/simlab.git` |
| 專有範圍 | 本計劃、`sim/centripetal-force-investigation-lab/`、同 slug manifest、專屬 browser driver |
| 共同編輯點 | `sim/config.js`、`tools/test-registry.js`、必要的 mobile-scroll 活動登記、完成時 README 條目 |
| 並行原則 | 所有命令指定本 worktree；不切換原 checkout、不搬用其他 worktree 的未提交檔案。合併前先 commit，保留雙方 catalogue／registry 條目，不 force push |
| 開發資源 | 建議本地埠 4381，browser session `centripetal-investigation`；埠佔用時選空閒埠並記錄，不終止其他活動服務 |
| 後續每輪 | 完成相應測試 → commit → push 本分支 → 有可試用 runtime 時部署本活動獨立 Sites → 核對版本／資產／實際可開啟網址。按使用者指示不等 CI 才回報；CI 未完要如實註明 |
| 本輪 | 完成 runtime、測試、打包與私有試用站點；真 Moodle／實機仍作獨立驗收，不合併 main |

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `centripetal-force-investigation-lab`；學生配置公平比較，由共同轉速下的同步讀數歸納 F 與 m、r、ω² 的關係 |
| Delivery scope / package | 形成性評量；一個 SCORM 1.2 SCO，包含三個獨立實驗及兩題綜合題；同 runtime 的 Sites 練習版 |
| Learner task / main interactions | 拖測力計、放取砝碼、拖操作環旋轉、放手後按量測／切換分析、切換資料組、擬合、輸入比值、選擇結論、檢查及明確提交 |
| Shared subject core / activity outer layer | 沒有既有向心力裝置核心；物理、採樣、評分自有。重用現有 `sim/newtons-second-law-investigation-lab/fitting.js` 的純 `fit` API，不複製 QR／擬合演算法，不載入該活動 UI |
| Runtime files / libraries | 原生 HTML/CSS/JS、SVG 繪圖與明確 HTML 手勢區；Canvas 是學生舞台稱呼，不要求 bitmap API。無新套件或 CDN；簡單數式用 MathML／HTML／SVG 與共享數學字體 |
| Assessment risk / trusted validation | `formative`；前端評分供教學，不能作防篡改高風險考核。無伺服器、秘密或簽章金鑰 |
| Out of scope | 真實 PASCO 連接／校準、隨機噪聲、轉軸振動／器材破壞、精密轉動慣量與手力反算、測量誤差專題、CSV／圖片匯出、教師題庫、額外參數研究頁 |

### 預計檔案與沿用邊界

| 檔案 | 責任 |
|---|---|
| `index.html`、`styles.css` | 三區、fullscreen markers、可存取控制、裝置舞台及面板獨立即時圖、手機版面 |
| `model.js` | 裝置設定、質量／半徑、轉動積分、徑向讀數、採樣槽、資料組與擬合輸入 |
| `main.js` | 真實 pointer／keyboard 操作、畫面、動畫、共享生命周期接合；不含權威評分公式 |
| `scoring.js` | 問題字典、組內資料與設定的獨立分項、容差、回饋 |
| `persistence.js` | 本文件 schema、深層驗證、版本、恢復與派生重建 |
| 本活動五個測試 | `model.test.js`、`scoring.test.js`、`persistence.test.js`、`interaction.test.js`、`lifecycle.test.js` |
| Browser driver | `tools/centripetal-force-investigation-browser-regression.js`；一次正式 entry 覆蓋 source 與真正解壓 package |
| Manifest | `sim/manifests/centripetal-force-investigation-lab.xml`；列六個自有 runtime 檔案、共用 styles/scorm/activity-flow/fullscreen 及既有 fitting.js |

若既有 fitting API 確有缺陷才單獨修改；此檔變更須回歸牛頓第二定律活動及新活動，manifest 反向消費關係要被選取器識別。手勢視覺參考既有圓周及受力活動，不複製其 SCORM、全螢幕或生命周期控制器。

## Catalogue metadata (`sim/config.js`)

| 欄位 | 預定值 |
|---|---|
| title | 向心力探究：操作轉盤與同步量測 |
| folder | centripetal-force-investigation-lab |
| categories | Mechanics |
| description | 親手推動旋轉平台，調整兩側質量與半徑，由同步測力讀數及擬合探究向心力關係。 |
| tags | physics、mechanics、centripetal-force、fair-test、measurement、curve-fitting、scorm |
| status | 實作中 planned；通過 package-ready 閘門後改 active。現已加入 catalogue，因全套測試未通過，仍標 planned |

## 學生流程與資料依賴

1. 開啟是停止、放大的器材設定視圖，顯示 A／B 彩色托座、兩側測力計與圓片砝碼，尚無資料與答案。選「半徑／質量／角速度」可直接切換，各保留工作。
2. 題目只給研究目標；學生選改變量及保持不變的量，在舞台配置兩側裝置。不得按題目自動調成公平設定。
3. 「準備轉盤」建立固定裝置配置的資料組；推動、放手勻速續轉後，按「量測一點」同步記錄兩側讀數。拖動／動畫／調速按鈕不自動採樣；記錄後圖點立即更新。
4. 按「3 圖像」暫停轉盤，保留圖點；按「擬合」取得本組真實擬合結果，裝置保留顯示。半徑／質量頁為線性（含截距），角速度頁為二次（含一次項及常數），不強制過原點。
5. 學生算比值／倍數、比較擬合、選有控制條件的結論。實驗一／二另可換比例開第二組比較；不是完成門檻。
6. 「檢查」始終可達，包括停止未推動、空資料組、未擬合或全空白。明確提交後才給分及完整物理解釋。

| 實驗 | 正確裝置條件 | 圖像（固定軸次序） | 提交後理論解釋 |
|---|---|---|---|
| radius | m_A=m_B，r_A≠r_B；整組配置不變 | x=F_B，y=F_A | k=r_A/r_B；每次放手後保持共同 ω 不變並同步量測，ω_A=ω_B |
| mass | r_A=r_B，m_A≠m_B | x=F_B，y=F_A | k=m_A/m_B |
| omega | 選定 A 作被測組件，m_A、r_A 在組內不變；B 保留在平台 | x=ω，y=F_A | F=aω²+bω+c；理想 a=m_A r_A，b=c=0；a 是擬合係數，不是加速度 |

前兩組每次先推轉、放手，維持共同角速度不變後才同步量測A/B；量測之間可再調速，以取得F_A–F_B比較圖。兩側同平台約束自動成立；學生仍需辨認相等條件。另一側器材保留與工作紙一致，但不聲稱任意配置都完全動平衡；首版假設轉軸固定且忽略晃動。

## Physics or subject model

| State variables | Update rules / formulas | Units | Calibration constants |
|---|---|---|---|
| 基礎被測質量 m_0 | 樽蓋＋螺絲合計，兩側相同；不含測力計外殼 | kg | 草案 0.040 |
| 砝碼數 n_A、n_B | m_i=m_0+0.020n_i；n_i 整數 0…8 | kg | 每塊 0.020，總質量 0.040…0.200 |
| 半徑 r_i | 軸心到被測組件質心；尺上離散位置 | m | 0.10…0.40，每格 0.05，共 7 格 |
| 初始配置 | 三頁均 r_A=r_B=0.20、n_A=n_B=2；不預造半徑／質量差異 | 同上 | 預設不構成前兩頁完整有效對比 |
| 轉角 φ、帶符號轉速 Ω | 拖動期間由連續展開的觸控角與時間得到；放手 φ 增量=ΩΔt | rad、rad/s | |Ω|上限 6；新開平台 Ω=0；ω=Ω帶符號作圖，逆時針為正、順時針為負 |
| 徑向讀數 | F_i=m_i r_i ω²；同一採樣的 ω 同時計算兩側 | N | 無噪聲；原始運算保留精度，顯示三位有效數字 |
| 加速期間 | 徑向加速度 rω²、切向加速度 rα | m/s² | 感應器理想化為只讀徑向分量；固定裝置傳遞切向作用，不把量測值稱總合力 |
| 擬合 | 現有 fit('linear'/'quadratic', points)，使用保留樣本重建的未顯示捨入讀數 | 隨軸 | 奇異／不同橫座標不足回傳無結果，不能注入理論係數 |

### 推動、續轉與中斷

- 使用可見操作環的分段 HTML 命中區（24 段、局部至少 44px 觸控範圍）；環內空白不接管。接觸時記錄相對角，不跳到手指絕對方位；跨 ±π 連續解包。
- 每個有效事件以不大於 120ms 的最近角度窗口估算 Ω；不足兩個有效時間樣本不製造速度。零時間、非有限值、超過 120ms 的事件空檔不反算極大速度。上限是虛擬裝置上限，須以限速後角位移驅動畫面與讀數，不能畫面很快而數值被單獨截斷。
- 手勢角增量大於可連續辨認界限時停止該段估算，保留前一合法速度，頁內提示慢一點重推；不得把跨圈別名誤判反轉。拖到中心附近時保留角度，避免 atan2 奇點。
- 有效放手沿最後實際 Ω 慣性續轉；只點一下無角位移不加速。重新觸碰、減速、反轉均連續；不按手指壓力猜物理扭矩。
- 「停止／設定」令模擬時間暫停；畫面可回到水平設定姿態，明示設定狀態，並非聲稱小球實際受巨大制動。m、r 只在設定狀態可改。
- 切頁、檢查、失焦、隱藏、pointercancel、失去 capture 或第二指介入均安全暫停；不在背景補採樣、不突然續轉。操作環的已接受歷史樣本保留；未放下的砝碼／半徑拖動回滾。
- 鍵盤替代：聚焦操作環，左右鍵按時間改 Ω、Space 暫停；另設「推快一格／減慢一格」按鈕，走相同模型與採樣。不給任何數字滑桿作主流程，也不按手勢熟練度給分。

### 採樣、資料組與擬合

- 點「準備轉盤」建立run並固定cfg；只有放手勻速後按「量測一點」才產生評分資料。拖動／動畫／調速均不記點，低於可量速度時明示需推快。
- 記錄解析度為 0.001 rad/s：接受真實操作得到的 ω 後轉為整數 q=round(1000ω)，q∈[-6000,-250]∪[250,6000]，以 q/1000 作該次權威量測值。F_A、F_B 由同一 q 與凍結 cfg 推得。
- 移除採樣槽排除；每次按量測保留實際整數q，只有完全相同q視為重複並提示調速。0.25rad/s區間只用於評分的覆蓋度，不再阻止記點；半徑／質量以角速度大小評覆蓋，第三頁以帶符號角速度評覆蓋。
- 每頁最多兩個run，每組最多48點（共288整數）；介面顯示已量／48，滿額停用量測並提示另開組，不默刪舊點。開始另一組前停止現組；已有兩組時須由學生明確刪除一組，不能自動丟棄舊組。
- 修改 m／r 只改下一組 working cfg，不覆寫任何舊 run；當前作答及擬合都綁定 run。使用者選定的評分資料組另以 selected 索引保存，切換看圖不暗換評分組。
- 擬合可在數學上可識別時執行：線性至少 2 個不同 x，二次至少 3 個不同 x；充分採樣得分另見 rubric。繼續採樣後舊擬合標記清除，已填結論保留並頁內提醒重新比較，不彈窗。
- 原始圖點由量測資料生成，不可拖動到理論線上。曲線沒有資料時不預畫；錯誤配置仍畫其真實結果。半徑與質量頁即使同時變兩量也可能有直線，須透過設定評分與 k 的解釋辨認混雜。

## Responsive layout contract

| Decision | Activity specification and reason |
|---|---|
| Three regions | 頁首：無章號標題、三實驗導航、檢查及 fullscreen；舞台：裝置與直接標值；面板：探究目標、設定、收集、可收合即時圖、組別、擬合與作答 |
| Fullscreen | 外層 main 標記 data-sim-fullscreen-target，header 標記 data-sim-fullscreen；重用 shared/fullscreen.js，預留右上 44px，不手寫第二個按鈕 |
| Desktop / tablet | ≥900px，舞台 1fr、面板 340px（最多可用寬的 34%）；裝置與 live 圖並列。桌面圖例至少 20px，讀數 22px |
| Classification | bounded split-panel；看裝置／圖時仍需操作面板，面板獨立捲動 |
| Phone | 收集時舞台 34dvh；設定時 38dvh，≤359px 且高>400px 時舞台至少190px，先顯示探究目標再列器材控制。320×500 面板硬下限 ≥96 CSS px；≤359px 即時讀數分兩行，長小數不裁切；按鈕至少44px |
| Short viewport | 高≤400 且寬≥480 用左右欄；更窄保留 ≥96px 面板，圖像以面板原生捲動查看，裝置仍保留。200% zoom 重新排列，不靠整頁橫捲 |
| Phone text | 控制／正文 18px，必要圖標 16px 實際縮放後，讀數 20px；44px 操作目標，公式真上下標，數字固定等寬欄 |
| Viewports | 320×500、390×500、390×600、390×844、480×320、320×225、1280×800；工具列／鍵盤／200% zoom 均待驗 |
| Scroll topology | 活動根文件 bounded 無可用垂直 range；panel 原生 contained scroll；舞台空白原生 pan-y 傳到真正宿主 owner。不得修改 parent overflow 或鎖宿主 |

圖像獨立於裝置，收集時同步更新真實樣本，分析時顯示同一圖及擬合；可隨時收合，仍持續採樣，進入分析則預設展開。390×600 可同時看見操作列、完整圖軸與裝置；320×500 須捲動面板看完整圖，裝置保持固定。

## Navigation, submission and reset

| Decision | Activity specification |
|---|---|
| Navigation | mixed：三個實驗彼此獨立；單組設定→採樣→擬合有真資料依賴。圖像空白亦可觀看或進檢查，不捏造前置答案 |
| Final check | 所有 editable 子模式可到 check；先暫停運動，結束可提交手勢／回滾未完成裝置拖動，保留已接受資料 |
| Incomplete submission | 顯示未答項、無資料／未擬合的中立狀態；全空白可明確提交零分 |
| Editable reset | 按鈕明示「清除此組資料與答案」或「清除此題」；直接執行、不開 alert/confirm；不波及其他題。無重抽隨機題功能 |
| Return / redo | 頂部步驟導航 sticky，收集／圖像有「← 返回設定」，保留舊組；設定頁明示「清除本組並重做」，按目前 working cfg 重建本組，其他組與概念答案不動。極短 320×225 面板保留自然捲動導航 |
| Scored / pending | 不可修改裝置、資料或答案，無重設／重開；可唯讀切圖、看其他組及 fullscreen；只保留 shared flow 允許的重試 |

| Step | Upstream | Missing / changed | Legal continuation |
|---|---|---|---|
| 設定 | definition＋working cfg | 不需要已有 run | 拖動、角色作答、開始、切頁、check |
| 收集 | 存在固定 cfg 的 active run | 空 samples 合法；cfg 改變須新 run | 推動、暫停／繼續、停止、check |
| 擬合 | 選定 run 的足夠不同 x | 不足時顯示未能擬合；不填理論值 | 返回收集、換組、獨立答結論、check |
| 修改返回 | 相同各頁資料及 fromReview | 不清其他題；資料增加令本 run 擬合需重做 | 合法操作後可再 check |

## Diagrams, notation and assistance

| Decision | Activity specification and reason |
|---|---|
| Notation | m、r、F表示大小；ω表示帶符號角速度，逆時針正、順時針負。F_A/F_B 下標固定。物理量、公式、圖軸與單位以本地 MathJax 的 LaTeX 排版；不向學生顯示 raw LaTeX |
| Arrows | 如顯示感應器量測方向，用單一實心箭頭及明確「徑向讀數」，不加第三個物體／額外合力；A/B 標記跟托座移動、文字正向，讀數欄固定 |
| Radius snap | 保留按下位置與拖柄的偏移，按水平位移連續預覽器材及拖柄；限制於本側合法範圍，放手取最近尺格，不要求手指貼近尺線；取消則回滾。相鄰格不足24px時直接標示最近合法半徑並提供 ± 按鈕，不另開預覽窗，不暗吸到本題正解 |
| Mass snap | 砝碼 drop 到可見樽蓋目標，touch 18px／mouse 10px 局部距離；未命中回工具盤，n 到上限不多加；增減按鈕等效 |
| Touch preview | 按本輪使用者明確要求，半徑直接在裝置尺旁用 LaTeX 標值，拖動時同步更新；取消獨立放大預覽窗，保留連續跟手及放手定位。砝碼拖動時俯視圓片跟隨手指，放錯位置回工具盤 |
| Graph | A/B 散點以共同資料生成；固定 x=F_B、y=F_A，顯示 N；ω圖顯示 rad/s 與 N。刻度選正常數，不把不同組各自變形後疊成同一線 |

## Touch gesture ownership contract

以下為預定 selector／拓撲，實作後填實際命中點及證據，不能把名稱當作已通過驗證。

| Target / modes | Visible footprint / hit region | Capture / touch-action | Keyboard |
|---|---|---|---|
| 操作環／collect | `.spin-segment` 24 個環形分段，至少 44px 局部範圍，環內空白無 overlay | 穩定 HTML 節點，none 在 down 前已設；旋轉不重建捕捉元素 | 左右鍵改速度、Space 暫停；面板有推快／減慢按鈕 |
| A/B 半徑把手／setup | `.radius-handle[data-side]` 可見手柄＋44px 局部範圍，不覆蓋全尺 | 穩定 HTML，none | 左右鍵移一格 |
| 砝碼／setup | `.mass-token.tray` 66×62（手機60×54）；`.placed` 貼合俯視圓形托座，至少44px，兩側最小半徑亦不重疊 | 穩定 HTML，none；拖動時托座命中提示；滿8塊不接受移入也不扣走來源 | 選 A/B，± 加減 |
| 資料組／圖像控制 | 原生 button/select；圖像本身唯讀 | auto；不把整圖設 none | 原生鍵盤 |

| Touch starts on | Owner | Strategy | Evidence |
|---|---|---|---|
| 非互動舞台／環內空白／物件外空白 | enclosing host | pan-y；透明 SVG pointer-events 不截取 | 待驗 |
| panel 中間／頂／底 | panel | overflow-y:auto、overscroll-behavior:contain；所有宿主位置不變 | 待驗 |
| 左右側帶 | enclosing host | 各≥32 CSS px，320px 窄屏仍可手指起滑，所有模式保留 | 待驗 |
| 三類拖動目標 | simulation | none；固定 capture；指針改變目標，其他 scroll/viewport 固定 | 待驗 |
| scored/pending 的舊編輯位置 | enclosing host 或明示唯讀按鈕 | 移除 editing hit halo，不能留下透明捕捉層 | 待驗 |

第一版不新增 forwarding adapter、不使用全 Canvas touch-action:none；原生路徑若在指定 host 不通，先查拓撲，修正後才宣稱 readiness。手勢期間可前進的連續模擬時間另外記錄；採樣是教學資料，不能以「只是動畫」豁免錯誤增刪。

| Host | Frame chain / actual owner | Origin / path | Evidence |
|---|---|---|---|
| T0 | 直接頁；根文件 bounded，無外層 range 屬明確 N/A；panel 自有 range | localhost source／解壓 package | 待驗 |
| T1 | 外層 scrollable window → activity iframe | 同源原生 | 待驗 |
| T2 | 外層 scrollable window → bounded wrapper → activity | wrapper 沒 range；外層是真 owner | 待驗 |
| T3 | bounded outer window → `#scrollOwner` overflow element → iframe | 指定 element，window 不動 | 待驗 |
| T4 | 真 Moodle current/new-window 的實測 frame chain | origin/sandbox/fullscreen policy 待現場記錄 | 未驗；不可用 T0–T3 代替 |

| Phase / geometry variant | Production fixture + continuation | Targets / blanks | Coverage |
|---|---|---|---|
| 三頁 setup，空白及不同半徑／砝碼 | 正式 startup→拖動任一裝置 | 各 radius、mass，兩側帶、環內空白、panel | T0–T3 source/package |
| collect，0點／部分點／48點 | 由 setup 開始→可信推動→放手→按量測 | 環各象限、跨π、重抓、反向、快速flick；空白不得變速度或採樣模式 | 同上 |
| pause／analyse 未擬合、已擬合、第二組 | 正式樣本 fixture→續採樣／fit／切組 | 圖空白、原生按鈕、側帶、panel top/bottom | 三頁圖不同軸與標籤均驗 |
| check→返回編輯 | 空白／部分／完整資料→edit→合法再收集 | 保留資料，恢復所有合法目標 | 同上 |
| review／committed／frozen／technical | shared fake LMS 各正式 outcome | 所有舊拖動區停用；唯讀切圖、fullscreen、panel | 同上 |
| fallback／reduced-motion／resize | 不建新 phase；實際簡化 renderer＋同語意模型 | HTML targets 隨真幾何更新；無大型透明殘留 | 同上 |

依 [完整驗收](../docs/simulation-scorm-production-guide.md#coverage-and-observable-acceptance) 記每次 move、release、20/100/400/1000ms owner/non-owner、trusted pointer、snapshot、DOM style mutation；雙向慢拖／快速 flick／中斷均要測，不以最後位置或 synthetic event 當證據。

## Scoring and tolerance

總分 100、達標 60、最低 0。每實驗 30 分，共 90；同步量測理由 5、被測總質量組成 5。評 submitted 最終選定組及明確答案，不以推動次數、旋轉方向、遊玩時間或預設位置給分。

| 每頁分項 | 分數 | 判分 |
|---|---:|---|
| 自變量／控制量角色 | 6 | 自變量正確 2；兩個應控制量各 2。控制量最多選 2，錯答保留；ω頁控制 m/r，r頁控制 m/共同ω，m頁控制 r/共同ω |
| 實際公平配置 | 4 | selected run 至少有兩個不同樣本；r頁等質量（rv3容許等半徑；rv1/rv2歷史規則要求異半徑），m頁等半徑且異質量；ω頁組內凍結 m/r 且實際有改轉速。角色答錯不連坐 |
| 資料範圍 | 4 | 至少3個不同槽且 ω跨度≥1.0 rad/s 得4；至少2槽且跨度≥0.5得2；其餘0。資料不公平仍可得真實採樣部分分 |
| 定量比較 | 4 | r/m頁輸入 selected cfg 的 r_A/r_B 或 m_A/m_B；ω頁填「角速度加倍時力的倍數」4。數值正確可獨立得分，不能預填 |
| 擬合解讀 | 6 | r/m頁比較實測 k 與剛填的物理比值、判斷能否支持單變量結論，各3；須本組 fit 成功。錯配置的正確「不能隔離」解釋亦可得分。ω頁二次型判斷3、二次項／常數項意義3 |
| 有條件的物理結論 | 6 | 單選正比 m／正比 r／正比 ω²，選項都附正確控制條件；與自己資料是否充分分開評，未採樣仍可回答概念 |

選項以語意 key 保存，自變量 `m/r/omega/force`，控制量為其中最多兩個不同 key；關係題 `linear/square/inverse/none` 並由題目附上條件；比較題 `supports/confounded/no-contrast/insufficient`；理由用獨立字典，不用 A/B/C/D 做答案。完整選項排列由 attempt seed 決定，切頁／續作不重抽。

量的數值答案採 |輸入−目標|≤max(0.01,0.02|目標|) 的對稱容差；例目標2接受1.96及2.04，不接受1.959或2.041。以內部值判，不用顯示捨入反算。角色／語意選擇無數值容差。公平配置用離散 cfg 精確比較；採樣跨度按 q 精確比較（999與1000分開測）。r/m頁輸入限制有限十進位字串≤12字，空字串為未答，非數字保留操作提示但不存成 NaN。擬合比較的權威比值始終由 cfg 重算，不因前一格學生算錯而改正解或連帶扣分。

配分依真正資料依賴處理：無 run 時依資料的項目為0；未選角色不抹去有效資料分；壞擬合不得假裝有 k。重複同速不加分。兩組只評明確 selected 一組，另一組供比較，避免堆資料拿分。尚未採樣、未作答、未明確選擇的 untouched attempt 必為0。

## Phase/state matrix

可保存業務 view 只有 `setup/collect/analyse/check/review`；技術狀態由 shared outcome 決定，不創造只存在於 persistence 的 phase。運動／指針是暫態；collect 的可還原樣式就是「已暫停收集」，有明確繼續按鈕。

| Phase / variant | Required semantic state | Absent / retained | Legal continuation |
|---|---|---|---|
| setup/new | 三頁合法 working cfg，空 run、全 null 答案 | selected/current=null | 拖裝置、開始、check |
| setup/changed | 新 working cfg；可以保留既有 run | 舊 run cfg 永不改 | 新建第1/2組或返回舊圖、check |
| collect/empty | current 指向合法 run，samples=[] | fitted=false | 推動／停止／check |
| collect/partial/full | current run 含1…48唯一q樣本 | 角色與概念答案可有可無 | 還原後暫停，繼續推動／停止／check |
| analyse/unfitted | current run 可空、少點或夠點 | fitted=false；所有概念答案可獨立保留 | 收集、合法fit、check |
| analyse/fitted | current run fitted=true 且資料可識別 | fit係數派生不存 | 輸入、選selected、續採樣使fitted=false、check |
| check/blank-partial-complete | 三頁答案與所選組，returnPage/returnView有效 | 不要求所有頁已訪問／fit | submit 或回有效頁 |
| edit-after-check | fromReview=true＋原合法setup/collect/analyse | 完整保留獨立工作 | 一個合法操作後再check |
| review/finished | 權威review答案；shared確認已記錄 | 無編輯current指針 | 唯讀切頁／fullscreen |
| shared pending/committed | 同一validated review payload | 凍結；不重新抽seed或採樣 | shared retry或finish retry |

| Transition | Preconditions | Effects |
|---|---|---|
| start run | editable，working cfg合法，組數<2 | 複製cfg，空samples，current指向新組；首組selected=0，其後保留原selected |
| accept sample | collecting且非hidden、有效真實q、未占槽 | 加入q，清fitted；不改其他頁／組 |
| setup edit | editable且已暫停 | working變；已採樣組不變 |
| fit | 選定current資料可識別 | fitted=true；數值結果由資料算；失敗不設true |
| delete run | editable＋使用者明確按範圍按鈕 | 刪該組及其答案，重映current/selected；被刪評分組設null，不悄悄選別組。若current被刪，有剩組則只切顯示current到剩組；無剩組則current=null、view及該頁returnTo轉setup，避免無資料的collect/analyse死路 |
| check / navigation | 任一editable | 停運動與收集、處理拖動收尾，保留return語意 |
| submit | shared允許＋canonical可驗證 | 用同一答案建review、評分並交shared；不因空白阻止 |

## Persistence contract

用 shared makeSnapshot envelope，活動answer schema v1 / modelVersion2 / rubricVersion1，兼容既有mv1。以下為現行實作契約。深層拒絕非法參照／非有限值／未知版本；錯誤物理答案不是壞資料。

| Field | Exact type / values |
|---|---|
| `v,mv,rv` | v=1、rv=1；新稿mv=2，舊稿mv=1按原限制解碼；只在editable更新時升級，review／pending保持原樣 |
| `seed` | uint32；只控制選項排列，不控制學生轉速 |
| `page,view,fromReview` | page=0…2；view 上表enum；boolean |
| `returnTo` | null 或 [page,setup/collect/analyse]，collect/analyse須有合法current |
| `tasks` | 固定3個 T，依 radius/mass/omega；不得缺頁或多頁 |
| `T.work` | [rAIndex,rBIndex,nA,nB]，前二0…6，後二0…8整數 |
| `T.current,T.selected` | null 或本T.runs的有效索引；刪組後重映；資料有但未選評分組合法 |
| `T.roles` | [自變量key或null,控制量key陣列或null]；控制量最多2且不同；錯誤角色合法 |
| `T.runs` | 0…2個 R |
| `R.cfg` | 同T.work型別，run成立後不可變 |
| `R.q` | mv2：0…48個唯一整數，250≤abs(q)≤6000；mv1：0…24正整數且原槽不重複。按獲取次序保存，力從cfg/q重建 |
| `R.fit` | boolean；true須線性／二次資料可識別且與頁相符 |
| `R.a` | [定量輸入字串或null,比較key或null,理由key或null]；字串≤12；選項按各頁字典驗證 |
| `T.law` | null或本頁關係選項key；不綁資料組，不被刪組清掉 |
| `sync,massParts` | 各null或綜合題字典key；支持零分但完整語意的錯答 |

| State category | Treatment |
|---|---|
| Authoritative | cfg、真實接受的q、角色／各組答案／結論、selected/current、view/returnTo/fromReview、seed及版本 |
| Transient | 連續φ/Ω、rAF時間、指針窗口、drag preview、capture、hover、fullscreen、圖像展開狀態；草稿還原一律暫停，不補背景時間 |
| Derived | F讀數、fit係數、圖點座標、DOM ids、score、選項排列、按鈕狀態；由已驗權威資料重建 |
| Size | 6組×48整數為上界；以最長合法輸入及shared envelope/result實測draft/review/有效pending均≤4000 UTF-8 bytes。超標先縮DTO重複key，不刪學生資料、不降低精度 |
| Versions | mv1的正數資料、已提交分數及pending均保留相容；mv1 editable更新時升mv2，未知版本拒絕。相容性由有分數review／pending重試測試保護 |
| Invalid editable | 首版採technical load lock，不自動清除；避免誤判finished而擦除。未提交且可證明安全的恢復另走shared契約 |
| Invalid finished/pending | finished保持鎖定只顯可信LMS摘要；pending深層驗證失敗先quarantinePending，再technical lock，無retry/clear/edit |

每個合法矩陣列要 production encode→decode→restore、分數相等、至少一個真合法 continuation；collect還原要真的繼續取得下一槽，不只比較JSON。q陣列是有限解析度量測本身，保存整數不再捨入；不能將力讀數或保存總分作權威答案。

## Shared SCORM lifecycle

依 [mandatory flow](../docs/simulation-scorm-production-guide.md#mandatory-shared-lifecycle-flow) 接 loadAttempt→startup、setDraftProvider、saveDraft、submitWithCallbacks→submission，禁止活動自有 LMSGet/Set/Commit/Finish 或 pagehide/pageshow 控制器。

| Outcome | 本活動行為 |
|---|---|
| editable | 建新或還原深層驗證draft；停止旋轉；按已存view呈現可續作狀態 |
| review | 驗snapshot→還原→scorer→reviewResult比較，鎖定；不信任舊score |
| frozen startup | 驗nested review及canonical答案、重算分，再允許同payload重試；失敗隔離 |
| load-error | technical lock、數值--；不顯已提交／達標，不能偷偷降為standalone |
| success | 已記錄review-only |
| committed | 結果已commit但finish失敗；仍鎖定，只允許finish retry |
| frozen submit | 結果未確認；凍結原答案，無通過／失敗宣稱；同payload retry |
| retry | retryable=true保持可編輯／重新提交；false顯技術錯誤，不承諾可重試；兩者均非submitted |
| review trust | matched按可信結果；mismatch/unknown按shared不確定標示，completionLabel保留null，不當fail |
| Standalone | 記憶體練習；刷新全新空白，不讀/寫跨刷新答案儲存；storage denied仍可用 |
| Moodle | 同attempt還原draft/review/pending，只有LMS新attempt才重開 |

資料組／作答完成及樣本槽新增才觸發語意draft更新；不是每pointermove呼叫LMS。draft provider取得最新已接受資料。提交前暫停採樣、產生一次canonical答案，四種outcome都不得再改它。

## Test plan

- [ ] model：質量含基座、半徑以質心、F比例、改ω時同步比值恆定、錯配置k、反轉同ω同F、α不污染徑向值、跨π/零dt/大dt/中心/限速／續轉連續性。
- [ ] 採樣：未開始不記錄、只收真實值、每按一次一點、重複q提示、48點上限、±250/±6000界線、暫停隱藏不補樣、改cfg不覆寫舊組、第三組不得默刪；擬合奇異與實際錯配置。
- [ ] scoring：100分、全空白0、部分項獨立、錯配置但正確判斷混雜、比值與跨度容差邊界、選項全部／重複拒絕、preset不給分。
- [ ] persistence：逐矩陣列round-trip＋合法續作、最壞bytes、空run／未選selected、刪組參照、fit缺資料、未知版本、NaN/Infinity、非法q／重槽與錯答案合法性。
- [ ] interaction／lifecycle：測真controller入口，shared所有startup/submit/trust結果、pending canonical mismatch隔離、空白check/submit、review鎖定、standalone刷新與Moodle同attempt分別測。
- [ ] Browser：可信拖轉／拖半徑／加取砝碼→收集→擬合→部分提交→唯讀，source與解壓ZIP同流程；桌面與手機，三實驗、兩組、返回編輯、fallback、fullscreen。
- [ ] 所有T0–T3手勢矩陣及指定viewport，保留實際move/release證據；Windows依guide用Git Bash，runner內啟server、等HTTP就緒、結束關session；stdout含`### Error`即驗證失敗。

### Test registration and CI selection evidence

| Item | Decision / evidence |
|---|---|
| Runtime resources | 本slug manifest列六自有檔＋四shared＋既有fitting；反向資產消費須涵蓋Newton fitting |
| Logical entries | 本slug上述五個*.test.js，各node、scope由資料夾繼承 |
| Browser entry | `file: tools/centripetal-force-investigation-browser-regression.js`、kind browser、scope本slug，driver內source/package；不再重複兩個相同entry |
| Helpers | `sim/centripetal-force-investigation-lab/test-support.js` 僅供兩個node測試，不入package；無另設browser cases helper。其變更觸發full selection，詳見下列預覽 |
| Manual gates | 既有mobile-scroll manual runner增加本slug矩陣；T4真Moodle／手機為另行部署驗收，不冒充日常CI |
| Registration check | `npm run check:tests` 通過：263 entries、227 node、36 browser；本活動5個 node與1個browser entry 已登記 |
| Committed preview | `main=4aa4d50680f9c757b932e7db08be118f80142950`、實作commit `1d58f9ba2a26d6e922a90f3e52cb753989d58c2c`；`npm run test:affected -- --base=main --head=HEAD --plan` 選 full：新增 `test-support.js` 無runtime資產消費者，而 catalogue／registry 也屬全套觸發；包括本活動browser與全部package |
| GitHub | 實作commit的 PR-triggered workflow 查詢回傳空陣列；未取得可核對的CI通過結果或run URL，不把branch push當CI pass |

## 實施階段與交付

| 階段 | 工作與退出條件 |
|---|---|
| P0 本輪 | 完成本計劃、worktree、文件檢查並提交草案；停止等使用者審查 |
| P1 批准後 | model／角色與rubric／schema及純測試先行；用真實狀態矩陣驗證，不先寫整個UI再補生命週期 |
| P2 | 三區＋直接拖動＋收集／圖像／擬合；先驗手機手勢不被空白層吞掉，再連評分與shared flow |
| P3 | catalogue、manifest、registry、source與package、fullscreen、完整T0–T3；新活動按guide跑初次全套 |
| P4 | 可試用版本commit/push後，讀Sites skill並建立此活動獨立站點；只部署manifest runtime，保留私人來源／owner-only存取慣例，核對實際設定，不沿用另一活動project id |
| P5 | 真實Moodle與手機驗收；若環境未提供，清楚標為package-ready待Moodle，不能勾選未驗證項 |

部署每輪記錄 branch SHA、runtime檔案清單及hash、Site project/version/deployment id、存取範圍與可用網址；不打包工作紙或個人路徑。部署指南屬執行前需重新核對的服務規格；P0 當時未建立站點，P4 的實際部署證據見下節。

## Package-ready checklist

- [ ] 計劃獲批准；模型、評分、schema、手勢、鍵盤與深層錯誤處理皆有實際證據。
- [ ] `npm run check:tests`、`npm run check`、`npm test`、`npm run package:all`、實際base diff檢查通過。
- [ ] ZIP根目錄imsmanifest.xml、所有runtime相依齊全、無開發檔；source及解壓package均通過完整適用流程。
- [ ] 三區短手機／zoom可讀、最後控制可達、fullscreen保留作答、T0–T3矩陣全部通過。
- [ ] commit/push與Sites資產對應可核對；CI結果按實際狀態報告。

## Moodle-ready checklist

- [ ] package-ready完成，真實學生帳號記錄分數／狀態。
- [ ] 同attempt續作、提交鎖定、pending retry、新attempt政策驗證。
- [ ] iPhone/Safari及Android/Chrome適用T4完整矩陣、current-window及提供的new-window，記frame chain與真正owner。
- [ ] 高風險可信伺服器驗證 N/A：本活動僅形成性；local結果不取代Moodle／真手機證據。

## P0 文件驗證記錄

本節為 P0 歷史文件結果；後續 runtime 與 package 證據另見下節。

| P0 項目 | 2026-10-22 證據 |
|---|---|
| Worktree / branch | 已由記錄的共同main SHA建立，只有本計劃列入變更 |
| Template | 與原模板逐一比較，全部14個二級節均保留並填寫；另補學生流程、手動旋轉模型與實施階段 |
| 文件連結 | `node tools/check-docs.js plans/38-centripetal-force-investigation-lab.md` 通過，無略過連結 |
| Diff | `git diff --cached --check` 通過，staged範圍只有本計劃；不將文件通過視為runtime證據 |
| 待審重點 | 直接拖轉手感、每題最多兩組／每組48點、三項實驗與100分rubric、正常短手機panel目標144px、擬合重用既有純函數 |


## P1–P3 實作及本地驗證記錄（2026-10-22）

使用者已授權按本計劃完成活動。原 checkout 的其他未提交改動未搬入本 worktree。下表只記已執行的本地證據；Sites、CI、真 Moodle 及真手機另記，不互相替代。

| 項目 | 已執行證據 |
|---|---|
| runtime | 三頁共用可拖動轉盤、A/B 測力計與砝碼；手勢／鍵盤調速、凍結配置資料組、同步徑向讀數、線性／二次擬合、100 分分項評分、明確提交與只讀檢討 |
| snapshot | `model/scoring/persistence/interaction/lifecycle.test.js` 均通過；逐頁空組／部分／擬合／check／返回編輯 round-trip，最長合法 pending ≤4000 bytes；非法值拒絕 |
| registration | `npm run check:tests` 通過：263 entries（227 node、36 browser）；本活動5個node及1個source/package browser entry |
| manifest/check | `npm run check` 通過；`npm run package:all` 通過；本活動ZIP根有 `imsmanifest.xml`，共14個檔案、僅宣告runtime |
| source/package browser | `node tools/centripetal-force-investigation-browser-regression.js` 通過；可信 touch 拖半徑、放取砝碼、推環採樣，鍵盤調速，擬合、空白／部分提交、刷新全新、只讀、fullscreen存在；1280×800、390×600及320×500／390×500／390×844／480×320／320×225佈局，含短視窗操作環 |
| touch host | `tools/mobile-scroll-browser-regression.js`：T0 standalone、T1/T2/T3 source 初始390×600通過；T1/T3 package 初始390×600通過；T2 source及package的 collect／analyse／fitted／check／submitted／pending／committed 390×600通過，報告在 `output/playwright/` |
| 視覺 | 已審桌面、390×600及320×225截圖；手機圖軸／下標及極短視窗面板與操作環已調整 |
| 全套 | `npm test` 在既有 `tools/circuit-household-browser-regression.js:613` 失敗（預期 `closed`，實得 `tripped`）；該測試獨立重跑同樣失敗。`npm run test:fast` 225/227 通過，既有 force-composition persistence 及 ci-prepare 各在120秒限時逾時；兩者獨立不設限時重跑均通過。全套閘門仍未通過，不能標記 package-ready。 |

本地檢查不證明真 Moodle 分數記錄、T4 宿主、iPhone/Safari 或 Android/Chrome。極短 320×225 視窗以面板按鈕設定 m/r，舞台保留推環；展開全螢幕可直接拖動全部器材。

既有家庭電路瀏覽器失敗位於本分支未修改的 driver；獨立重跑同一斷言仍失敗，根因尚未查明。新活動的 source/package 瀏覽器與 T2 解壓包觸控測試各自通過。

補充可信觸控證據：T1 source 的 `--phases=all` 於 320×500 及 390×844 共32個案例完成，錯誤0、手勢所有權問題0；包含三頁 setup/collect/analyse/fitted、check、submitted、pending、committed。T0–T3 所有 mode／viewport／phase 組合尚未全跑，故不宣稱完整手勢矩陣通過。

## P4 私人 Site 部署記錄（2026-10-22）

| 項目 | 已核對資料 |
|---|---|
| branch | `codex/centripetal-force-investigation-lab`，實作commit `1d58f9ba2a26d6e922a90f3e52cb753989d58c2c` 已推上origin |
| SCORM | 最終 `npm run package:all` 通過；本活動ZIP共14檔，13個runtime資產與下列Site檔案逐位元組相同，Site額外根頁只作入口轉址 |
| Site | private／owner-only，project `appgprj_6ad9b25e7b4c8191987acc391bcc66de`，source commit `ccf936de40f5265db8d2473e0c9b5bb249c1f2bf`，version `appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_1c17b7dcaab8819180beb3456487177a`，deployment `appgdep_6ad9b2cc1e108191ad3278204db8750c` 已回報 `succeeded` |
| URL | https://centripetal-force-investigation-lab.ieyp.chatgpt.site |

Site `dist` 檔案及SHA-256（其中13個為SCORM runtime，根頁為Site入口）：

| 路徑 | SHA-256 |
|---|---|
| `centripetal-force-investigation-lab/index.html` | `36b75f0a2403ca55016134989714a13882177975c0900045dcaf5c76ed6a44e7` |
| `centripetal-force-investigation-lab/main.js` | `f8a46b372dfdde0875e4ba53f18e1c76d41bd36714a2b1c693e6e5ac62ddc640` |
| `centripetal-force-investigation-lab/model.js` | `2916a6babbfab81f97a1b905f19adf7ab62e3db37763e3840d304a9522e3aea0` |
| `centripetal-force-investigation-lab/persistence.js` | `ff054cc4b999e9e320933ac8718ac9d15c3d2ba3e1ff4ff60288424e4be807d0` |
| `centripetal-force-investigation-lab/scoring.js` | `c91809d4188dae90f1e6ed97c9bccd2f34b74767c7ae67fecad8bfe3fdc7e04d` |
| `centripetal-force-investigation-lab/styles.css` | `75cc7e98669f49bd7539b62bbcd736a38f385686e83f5d9cf348ebc111c57b80` |
| `centripetal-force-investigation-lab/ui-runtime.js` | `5891e7932eb7a4c935b03511f69a3f330b747726c059244f589267d2018c49b5` |
| `config.js` | `0a64557bbd060fe05d1283e4bdf970f1773034b61f82b70f0efae1ef96d2835d` |
| `index.html` | `1e08b2dd24dcfa6dd6e6af94f7092fb7c99838d3b6e383c4431eb2cd3071a11f` |
| `newtons-second-law-investigation-lab/fitting.js` | `04058829952839db0310d04e6bfce8ad306a0ce0a29c48dd3a26f78ae6fa090f` |
| `shared/activity-flow.js` | `125497c68f792b303f7ec2e71c9ed23d7ef76e0f6e4b73ab8d3554ab5fd39d79` |
| `shared/fullscreen.js` | `055324bc99add2c0d5c7bfa5d5947363d3fbe5d1f3f72e8320aefcd4b1f2be5a` |
| `shared/scorm.js` | `7fd3bdf36249c942ebb94003fcc5b3dff07c3cfed5b494a887dffdc334e05ca8` |
| `shared/styles.css` | `e750bf358e83cf738a9fb1df8f63056148e80cd89c35ea4d72b3dc51fcb7cbc2` |

## 使用者回饋修正與再驗證（2026-10-22，歷史版本）

使用者要求所有顯示的物理量改為 LaTeX 排版，並指出不知道如何加砝碼及轉環。介面改用既有本地 MathJax 渲染物理符號、單位、圖軸及擬合式；設定控制移到面板開首，明示 A/B 的「＋砝碼」、開始收集、金色環拖動步驟。手機設定畫面縮小舞台，320×500 無捲動時已能見到 A 側增加砝碼按鈕。金色環由 12 個小命中區增至 24 個至少 44px 命中區；另設推快／減慢按鈕，與拖動共用同一運動及採樣模型。拖砝碼期間會跟隨手指預覽。

| 項目 | 已執行證據 |
|---|---|
| 純測試及登記 | 本活動五個 node 測試全通過；`npm run check`、`npm run check:tests` 通過，登記仍為 263 entries（227 node、36 browser） |
| SCORM | `npm run package:all` 通過，本活動 ZIP 17 檔、16 個 runtime 資產；SHA-256 `5dd807ef7fab8e23ad00a208720596fd07424f980549071463e38fa2ce2bd7da` |
| source／package browser | `node tools/centripetal-force-investigation-browser-regression.js` 通過兩種入口；驗證 MathJax SVG、設定面板順序、A/B 增減砝碼、砝碼拖動預覽、金環可信觸控採樣、只用「推快一格」三次採樣後擬合，以及 320×500 A 側加砝碼按鈕可見 |
| T2 package host | `tools/mobile-scroll-browser-regression.js --slugs=centripetal-force-investigation-lab --mode=package --host=T2 --phases=all --viewports=390x600` 完成，全部 case 無 issue；包含設定、採樣、擬合、檢查、提交及 pending／committed。報告 `output/playwright/centripetal-fix-T2-package-all.json` |
| 視覺 | 已檢視 390×600 設定／收集、320×500 設定及 package 圖像截圖；公式 SVG 不被舞台 SVG 樣式放大 |

本節是回饋修正後的版本證據；上面的 14 檔與第一次 Site 部署記錄是歷史快照。T4 真 Moodle／真手機及先前已知的全套測試失敗尚未驗收，活動維持 planned。

本輪 Site runtime 變更檔案 SHA-256（其他 10 個 runtime 檔案沿用上表 hash；另有 Site 根頁轉址）：

| 路徑 | SHA-256 |
|---|---|
| `centripetal-force-investigation-lab/index.html` | `cf4c679d9ddc5a58700f0c80f1eabb1cc156dbd0dc36bc5301f6834eaf76bef2` |
| `centripetal-force-investigation-lab/main.js` | `bd90263ccbcb0213151ee014859cbe595674c86dd222f484b6a69a5a7d3e7d3d` |
| `centripetal-force-investigation-lab/styles.css` | `1dda7ff1aedc172b77b5aaa543524141195a34df57d7b638188235bdc26775d9` |
| `circuit-workbench/circuit-math.js` | `2c35e09e31eb2b205b4aa72c3801832a5c7f4a2cb7e1b4f4fa6ea531f2e196b4` |
| `circuit-workbench/mathjax-license.txt` | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| `circuit-workbench/mathjax-tex-svg.js` | `d4295dc33744836935c1399feece5159577b34c5c8ffb9f1c6324cd82e03a882` |

| 更新版 Site 項目 | 已核對資料 |
|---|---|
| branch | `codex/centripetal-force-investigation-lab`，功能 commit `dcce06198d1d7059a28a40d2ac7492cec74d349a` 已推到 origin；此表的部署證據隨下一個文件 commit 推送 |
| source | `4cdfd3757577b16106c0e959052996fcd5636f14`，Site `dist` 的 16 個 runtime 檔案與 ZIP 對應項逐位元組一致，來源樹乾淨 |
| private deploy | version 2，`appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_b3ce401c8430819193fb3d79451e808c`；deployment `appgdep_6ad9c572383c81919f9525b685d3ce0d` 回報 `succeeded` |
| audience／URL | owner-only，無外部訪客；https://centripetal-force-investigation-lab.ieyp.chatgpt.site |

## 裝置及返回設定重新設計（2026-10-22，歷史版本）

使用者指出旋轉物件、砝碼位置與返回設定均不直觀。本輪沿用既有物理模型、rubric、snapshot 及依賴，修改裝置繪圖、操作配置及其瀏覽器驗證：

- 設定採用器材放大圖，收集採用完整俯視轉盤；顯示中心軸、徑向導軌、測力計、A/B 托座及實際數量的圓片砝碼。托座、砝碼與 A/B 標記一起轉動；文字保持正向。半徑圖形按數值成比例，設定時回到水平姿態，尺格與拖柄同源。
- 砝碼盤、已裝砝碼的觸控目標與可見物件重合；拖動時標示可放的托座及命中提示。半徑拖柄分別位於 A 側下方及 B 側上方，與砝碼操作區分開，保留 44px 目標及兩側捲動帶。
- 步驟導航固定在面板頂端。收集／圖像均能直接「返回設定」，暫停但保留資料；「清除本組並重做」是明確動作，只重置當前組的樣本、擬合與圖像答案，採用目前器材設定，不影響其他組或題目。提交／pending 後不提供該操作。
- 收集或查看舊組時，裝置與讀數一律使用該組凍結 cfg；設定頁顯示 working cfg，兩者不可混用。
- 驗證決策：source／解壓包執行加取砝碼、尺格拖動、旋轉、返回設定保留舊組、以新設定重做、兩組共存、舊組繼續採樣與提交鎖定；檢視桌面及手機截圖，重跑 T2 package 所有既有階段及新增返回設定階段。

| 本輪驗證 | 已執行證據 |
|---|---|
| source／SCORM browser | 原始頁與解壓包全部通過；可信觸控放取砝碼、滿8塊拒絕移入且不丟來源、按實際數量畫圓片、拖尺格／金環、固定返回導航、保留舊組、新設定重做及合法重新擬合、舊組凍結配置讀數、提交後隱藏重做 |
| 手機／桌面 | 1280×800、390×600 互動流程；320×500、390×500、390×844、480×320、320×225 佈局；320×500 第一個加砝碼按鈕可見，兩側最小半徑的觸控區分開。已審桌面及手機設定／收集／8塊砝碼截圖 |
| T2 package | `--phases=all --viewports=390x600` 17 個案例完成，全部通過，包含新增 returned-setup 及 submitted／pending／committed。報告 `output/playwright/centripetal-redesign-T2-package-all.json` |
| 模型／登記 | 本活動5個node測試通過；`npm run check:tests`：263 entries（227 node、36 browser）；沿用本活動 browser entry，新增回歸在原 driver 中 |
| 靜態／文件／打包 | 最後一版 `npm run check`、`node tools/check-docs.js plans/38-centripetal-force-investigation-lab.md` 及 `npm run package:all` 全部通過 |
| package／Site 資產 | SCORM 17檔、16個runtime；Site逐檔相同。最後ZIP SHA-256：`7dc703e8e1653a85cb45ef76d4c6a1ea0b42ee781d43b8998085a00b7da369e6` |
| 限制 | 未重跑既有失敗的全套測試，未驗真 Moodle／真手機；不宣稱 package-ready 或 Moodle-ready。前兩輪限制及失敗證據仍有效 |

本輪僅更改以下三個 runtime 檔案，其他13個沿用前輪 hash；保留既有 MathJax 及其本地授權檔：

| 路徑 | SHA-256 |
|---|---|
| `centripetal-force-investigation-lab/index.html` | `4c5986219d9949109420fbdc641c73b668f49a3c8311c21ff5449a95de59719e` |
| `centripetal-force-investigation-lab/main.js` | `639aa1140117c11cab4bd7bb7bcdf6ba1376b7dfd9c7c66ba799f2957af7edba` |
| `centripetal-force-investigation-lab/styles.css` | `cd5e4c33a5ba5e2d9ab475b781d80138c0567dcc7fd154d0c1f9478e3fad738c` |

| 本輪交付 | 已核對資料 |
|---|---|
| branch | `codex/centripetal-force-investigation-lab`，功能 commit `f35cfc66a010efbfdc9d18d1a4961e99c9468c43` 已推到 origin |
| committed selection | `node tools/run-tests.js --base=6dd06666c20fc5aac2ac64fb3634d442f060a3c1 --head=f35cfc66a010efbfdc9d18d1a4961e99c9468c43 --plan` 成功；保守選取 full 263，原因 `Unrecognised dependency: tools/mobile-scroll-cases.js`。這是選取預覽，並非263項全通過。輸出 `output/centripetal-redesign-selection.json` |
| Site source | `376d69a5a2d877c7db82edcf2008d9f62775218c`；16個 runtime 與最後 SCORM 相同 |
| private deploy | version `appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_2d8bf9d2a0d4819195b6b62d9ee6b439`，deployment `appgdep_6ad9cc1de09c8191ae0e459eb5f42ae6` 回報 `succeeded`；owner-only 存取範圍維持不變 |
| URL | https://centripetal-force-investigation-lab.ieyp.chatgpt.site |

## 統一俯視及即時拖動修正（2026-10-22，歷史版本）

使用者指出側視堆疊圓片在俯視轉盤旋轉時形狀不合理，A/B 拖柄亦未即時帶動器材。本輪範圍為裝置繪圖、砝碼預覽、半徑手勢與既有 browser driver；物理模型、rubric、snapshot、依賴及提交流程沿用。

- 器材、砝碼盤及拖動預覽一致使用平面圓環；俯視只見最上層圓片，數量由正向的 A/B 數量標籤顯示，零塊只畫空托座。移除側面堆疊、偏移陰影與方向性金屬漸層。
- A/B 拖柄保留抓取偏移，按水平位移連續帶動托座、測力計及引導線，不受垂直偏離尺線影響。放手才把最近合法尺格寫入 working cfg；取消／第二指／失焦回到原設定。預覽不寫入 snapshot。
- 驗證決策：source／解壓包用可信觸控按住並逐步移動，核對放手前器材與拖柄的位置、即時讀數、抓取偏移、斜拖、A/B 方向、邊界及取消回滾；保留砝碼／採樣／返回設定／提交測試。檢視不同旋轉角度與手機截圖，重跑 T2 package 設定及收集階段。

| 本輪驗證 | 已執行證據 |
|---|---|
| source／SCORM browser | 最後版本的既有 browser driver 通過；手機兩側可信 touch、桌面含 mouse；每次 move 的器材與拖柄位移在 1px 內一致，含 2 SVG 單位微移、離尺線 28px 的斜拖、偏心抓取、上下限、取消回滾、同格放手清除預覽。放手前 working cfg 不變，讀數即時預覽，放手後才保存 |
| 圖像／遮擋 | 只顯示頂層圓片，0 塊為空托座，數量標籤反映配置；已審 390×600 按住 A/B、桌面及手機旋轉截圖。讀尺框改在左下砝碼盤位置，拖半徑期間暫隱砝碼盤；自動核對不遮托座或活動拖柄。手機收集提示移由面板提供，避免蓋住旋轉中的數量標籤 |
| T2 package | 390×600 的 initial／setup-1／setup-2／returned-setup／collect-0 共 5 案例通過，issues 0；報告 `output/playwright/centripetal-flat-drag-T2-package.json` |
| 模型／靜態／登記 | 活動五個 node 測試、最後版本 `npm run check`、`git diff --check`、plan 文件連結檢查通過；`check:tests` 263 entries（227 node、36 browser），沿用原 browser entry |
| 打包／資產 | `npm run package:all` 通過；SCORM 17 檔、16 個 runtime，Site dist 逐檔與 ZIP 相同。ZIP SHA-256：`1c91ce75df194c1cbd6d9cb4924faf157188f1a1e4e51c6e9b537b12899d1d0d` |
| 限制 | 未重跑前述已知失敗的全套測試；真手機、T4 真 Moodle 及全手勢矩陣未驗。本輪不提升 package-ready／Moodle-ready 狀態 |

本輪三個 runtime 變更檔案 SHA-256；其餘 13 個沿用前輪：

| 路徑 | SHA-256 |
|---|---|
| `centripetal-force-investigation-lab/index.html` | `994240353d528f7e1b0017e1a5aa95643fc8f0455d642c64fd8cfed51c9fe6ce` |
| `centripetal-force-investigation-lab/main.js` | `293caf00677fb40513680a58b53aa1d49057280da0bfcae30f920bb841a92ea8` |
| `centripetal-force-investigation-lab/styles.css` | `05275175f04212411e2db528af9f0580c093f02d749e88f78618468a1acf2f99` |

| 本輪交付 | 已核對資料 |
|---|---|
| branch | `codex/centripetal-force-investigation-lab`，功能 commit `4a89664e4dd624d0f80eb13b8b6a4a9d3c6ff607` 已推到 origin |
| committed selection | `run-tests.js --base=2c9e6cd46e3029a04dad5c0bf2dcf247ced1fbbd --head=4a89664e4dd624d0f80eb13b8b6a4a9d3c6ff607 --plan` 成功；affected 模式共 228 expected（含既有 canary），對應本活動 package／browser scope。這是選取預覽，非 228 項全通過；本輪實際執行見上表。輸出 `output/centripetal-flat-drag-selection.json` |
| Site source | `19a46d88effb21c0cef1e369923e98e163140f69`，16 個 runtime 與最後 SCORM 逐位元組相同 |
| private deploy | version 4，`appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_abc1e42ed0608191ae4ea2fe421dd075`；deployment `appgdep_6ad9d41b03f88191a7607d7c1dcaf293` 回報 `succeeded`，owner-only 範圍維持不變 |
| URL | https://centripetal-force-investigation-lab.ieyp.chatgpt.site |

## 教學流程、裝置標示與即時圖像重整（2026-10-22，歷史版本）

使用者要求移除半徑預覽窗、直接在裝置標值；改善標字遮擋及拖柄；先交代任務才設定器材；收集期間顯示即時圖像，圖像可收合且不可蓋住儀器；完成後由兩位 sub agents 獨立審核並跟進。

本輪實施決策（動工前）：

- 先呈現本頁探究問題與操作目標，再進入器材設定；不增加必答門檻，空白／部分仍可提交。沿用 rubric、權威 cfg／q 資料、snapshot 及 SCORM 流程。
- 設定尺直接標示兩側半徑，拖動時更新最近合法格值；半徑預覽窗刪除。移除舞台中間重疊的「測力計／軸心」文字，改以清楚的圖形與分區標示；托座、砝碼與操作環統一平面風格，拖柄保留至少 44px 目標。
- 裝置 SVG 始終留在舞台；數據圖移至面板獨立區域，收集時同步顯示真實樣本，分析時使用同一圖像與擬合資料。明示展開／收合，只改顯示偏好，不修改數據或停止採樣；進入分析預設展開。新偏好是暫態 UI，不改保存 schema。
- 保留兩側 32px 宿主捲動帶，圖像面板維持原生捲動；三頁、舊組凍結配置、返回重做、只讀／pending 均沿用既有規則。
- 驗證：原始頁與解壓包執行持續拖半徑、直接標值、任務先於控制、即時採樣點、圖像收合／再展開、裝置不遮擋、擬合／繼續採樣／返回設定及提交；T2 package 覆蓋三頁與收合新變體。初版完成後開兩位 agents，分別檢查操作／視覺與狀態／數據，修正問題後覆驗。

### 兩位獨立審核與跟進

- `ux_audit`：指出手機操作列被圖推到下方、窄屏讀數裁切、A/B 說明重疊與數量徽章太小。已將操作列放在圖前、縮緊收集圖、讀數改在全寬舞台且≤359px分兩行、數量與半徑固定於轉盤下方、徽章至少14px並簡化為 A·2。覆核可信0.5px慢速拖動產生 ω=0.133、F=0.000141，320px讀數範圍 x34.55–285.45，無裁切；最小半徑標示分開。390×600完整圖軸位於 y493–593，操作列與裝置同屏。320×500原生捲動後可看全圖、收合及繼續拖動。
- `data_flow_audit`：確認圖點使用所選組凍結 cfg／q、收合不停止採樣、唯讀／pending不開放修改。指出只讀空圖提示與 MathJax 尚未就緒時的 Y 軸 fallback；已改中立空圖提示並保留共同旋轉容器。另補上返回舊組後圖點座標仍依凍結配置的 browser assertion。
- 兩位在修正後覆核，均回報無剩餘具體阻擋問題。審核為程式及桌面 Chromium 模擬尺寸，不代替真手機或 Moodle 驗收。

| 本輪驗證 | 已執行證據 |
|---|---|
| 最終 source／SCORM browser | `node tools/centripetal-force-investigation-browser-regression.js` 通過；直接半徑標值與連續拖動、任務先於設定、收集點即時更新、收合後仍採樣與再展開、擬合保留裝置、舊組凍結配置圖點、空白只讀提示、320×500極慢讀數及完整圖的捲動／收合 |
| T2 package | 390×600全部19 profiles通過，包含 collect-collapsed／analyse-collapsed、三頁與submitted／pending／committed；報告 `output/playwright/centripetal-layout-T2-package-all.json`。最後窄屏修正後另跑320×500 initial／collect-0／collect-collapsed／analyse-0／analyse-collapsed共5項，全部無issue；報告 `output/playwright/centripetal-layout-T2-package-320.json` |
| 純測試／登記／靜態 | 活動5個node測試通過；`npm run check:tests`為263 entries（227 node、36 browser）；最終`npm run check`通過。沿用本活動browser登記，收合變體加入既有mobile-scroll-cases |
| 視覺 | 已檢視1280×800及390×600設定／旋轉、320×500設定與極慢轉速截圖；公式、數量及半徑無重疊；320×500不宣稱第一屏可見完整圖 |
| 最終打包 | `npm run package:all`通過；本活動17檔、16個runtime。ZIP SHA-256：`01a713a3c21316e6206466c7a16f133a47263669def3c4ea78a4ea152ee4b91a`；Site runtime與ZIP逐位元組相同 |
| 未驗範圍 | 未重跑先前已知失敗的全套測試；真手機／Safari、真Moodle T4、完整T0–T3矩陣未驗。維持planned，不宣稱package-ready／Moodle-ready |

本輪3個runtime變更檔案的SHA-256；其餘13個沿用上輪：

| 路徑 | SHA-256 |
|---|---|
| `centripetal-force-investigation-lab/index.html` | `eba3ed9b2ff1661e2258ee83234a9d9c39271c77aa0eabbde683a99e56392b59` |
| `centripetal-force-investigation-lab/main.js` | `1eda5699685f68dccc88b8123144e9080d23987b3f24e650f4ec3091bd03fb5e` |
| `centripetal-force-investigation-lab/styles.css` | `0cb7beff5d0cc87a16633481645cdde73679258216b463ea78663b23a21d5f5c` |

| 本輪交付 | 已核對資料 |
|---|---|
| branch | `codex/centripetal-force-investigation-lab`，功能commit `fdb6aac32f2e0497dbad218368e3ca2681adf414` 已推到origin |
| committed selection | `run-tests.js --base=c547b50e7367858f88b41aa94e73823af6572c68 --head=fdb6aac32f2e0497dbad218368e3ca2681adf414 --plan` 成功；full263，原因 `Unrecognised dependency: tools/mobile-scroll-cases.js`。只是選取預覽，並非263項全通過；輸出 `output/centripetal-layout-selection.json` |
| Site source | `7ceeafbce8babb4598dea24ff21429478e7ba81b`，16個runtime與最終SCORM逐位元組相同 |
| private deploy | version5，`appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_70bef56d9b9881919819c506d2d8b84c`；deployment `appgdep_6ad9df760f3881918059050c25f19957` 回報 `succeeded`，維持owner-only |
| URL | https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/ |

## 手動穩速量測與砝碼操作修正（2026-10-22，歷史版本）

- 範圍：本活動 model／persistence／controller／main／HTML／CSS、五個既有純測試與browser driver、mobile-scroll fixtures及本計劃。共用SCORM／fitting及依賴不變。
- 使用者要求先推轉、放手後按量測。改為準備轉盤→自由調速→放手勻速→「量測一點」，拖動及動畫不自動採樣。每次同步量度A/B，測量時共同角速度固定；可再調速、放手及量下一點以作既有F_A–F_B圖。第三頁顯示帶正負的角速度，逆時針為正，力仍取徑向大小。
- 移除24個區間的採樣排除，保留0.001rad/s真實精度；每組最多48個不同讀數、兩組不變，顯示容量及重複／滿額原因，不默刪舊點。來源角速度範圍±6，最低可量大小0.25；負值合法。模型版本mv2；舊mv1草稿可編輯升級，已提交／pending保留原版本及分數。
- 評分仍100分；正數舊資料分數保持一致，半徑／質量的充分採樣依不同角速度大小，第三頁依帶符號角速度；曲線使用實際負x範圍，不預畫理論線。最大合法draft/review/pending須實測≤4000bytes。
- 固定面板四欄寬度，砝碼塊數與總質量分行；砝碼盤改成有內距、清楚「取用／放回」的整塊命中區，拖回時高亮並提示。俯視托座周圍八格表示已加砝碼數，零塊明示空托座與基礎質量0.040kg（托座連螺絲），不是零質量。
- 驗證：量測前無採樣、拖住時不能量、放手後速度不變且每按一次只加一點、正負轉向及跨24點、重複與滿額、舊草稿／review／pending相容、返回／提交鎖定；桌面與窄屏加減欄對齊、砝碼完整在盤內、拖入與拖回提示和零塊狀態。完成後沿用兩位審核員覆核具體改動。


### 本輪審核及驗證結果

- `ux_audit`獨立測桌面1280×800、390×600、320×500：四列加減鈕同欄且44px；砝碼可拖回整個盤（包括右下角），綠框及放手提示有效；零塊／八塊及每格標示跟實際數量一致；推轉、調速、反向均不偷記點，按量測才加一點。發現盤蓋B徽章、重複浮動提示及手機量測列擠圖，全部修正。最後320半徑標示範圍A x72.09–154.35、B x165.71–248.07，相隔11.36px；390完整圖y497.67–597.67。320完整圖仍需面板捲動。
- `data_flow_audit`核對正負角速度、畫面轉向、負x擬合及每次採樣caller；以舊HEAD模型建立100分mv1稿，確認新scorer、review及pending重試不變，舊draft更新可升mv2且保留原q。修正提示role=status每幀重寫問題，只在文字改變時更新；有分數的舊review／pending／draft路徑已補入lifecycle測試。

| 驗證 | 已執行證據 |
|---|---|
| 純測試 | model／scoring／persistence／interaction／lifecycle五項通過；48個負q與完整答案的draft 2779、review 2816、pending 3158 UTF-8 bytes，均低於4000 |
| 最終browser | 原始頁與解壓包通過；可信觸控／滑鼠拖入取回、固定按鈕欄、圖示內距、零塊基礎質量、放手勻速、拖住不可量、調速不記點、每按一次一點、重複提示、實際量至48點、正負x圖與擬合範圍、滿額明示且不刪資料；保留返回／重做／只讀／fullscreen測試 |
| T2 package | 390×600全部19 profiles通過，issues為0；含三頁、fitted、返回設定、收合、submitted／pending／committed。報告 `output/playwright/centripetal-manual-T2-package-all.json`；其後只有擬合顯示的數值格式微調，最終source／package browser已重驗 |
| 靜態／登記 | npm run check、check:tests通過，263 entries（227 node、36 browser）；最後JS語法／文件連結／git diff --check通過，沿用既有登記 |
| 套件 | npm run package:all通過；本活動17檔、16個runtime與Site逐位元組一致。ZIP SHA-256：`26940946a43cf857f279aeee9381edab35206e52ccb4c98e1b39483b236adf65` |
| 限制 | 未重跑先前已知失敗的全套測試；未驗真手機／Safari、T4真Moodle及全T0–T3矩陣。維持planned，不宣稱package-ready／Moodle-ready；320×500需要捲動面板看完整圖 |

本輪7個runtime變更檔案SHA-256；其餘9個沿用上輪：

| 路徑 | SHA-256 |
|---|---|
| `centripetal-force-investigation-lab/index.html` | `783cb4390f7928c5fa22cf9b7cc6c8badfeef229c207014a8b0b40c78753622b` |
| `centripetal-force-investigation-lab/main.js` | `7d38fddb0090a12f808960b8d083276861de3e83e83d4b99162cf2845490f4e0` |
| `centripetal-force-investigation-lab/model.js` | `47d89ddb5507c7b2954548e39dfef32dc4677a150286cfc2862c72616410fa99` |
| `centripetal-force-investigation-lab/persistence.js` | `f4e32755f96399ec480dba8f366566440c1684776b531fe1107d20b4613d34c9` |
| `centripetal-force-investigation-lab/scoring.js` | `3ba3c8c1452e4e41aba803b4bfbc5e08e9523ac8353ba7e3453246642760b044` |
| `centripetal-force-investigation-lab/styles.css` | `33ceb2de56ef5521ab8c41c5a7e07be74a010be97ccac7b8ef4d4676347854ec` |
| `centripetal-force-investigation-lab/ui-runtime.js` | `f67d5b9e0a88abe022c9d9bf535120f919e2795605928ad595a61c77e4c2a4e1` |

| 本輪交付 | 已核對資料 |
|---|---|
| branch | `codex/centripetal-force-investigation-lab`，功能commit `bf2548323917bc669a86813f8241d8ba7d9a7bef` 已推到origin |
| committed selection | `run-tests.js --base=dc58139396166f9969f27ab66abf9ff7c860dc2b --head=bf2548323917bc669a86813f8241d8ba7d9a7bef --plan` 成功；full263，原因 `Unrecognised dependency: tools/mobile-scroll-cases.js`。僅為選取預覽，不是263項全通過；輸出 `output/centripetal-manual-selection.json` |
| Site source | `dfdd8524c7da5db5a07460be66502d9ff6021612`，16個runtime與最終SCORM逐位元組相同 |
| private deploy | version6，`appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_3fa6242c0f448191b0be04dfab673acc`；deployment `appgdep_6ad9e8a44a648191af07ede9ada34bf1` 回報 `succeeded`，維持owner-only |
| URL | https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/ |

## 同步比值探究與按住減速採樣（2026-10-22，動工前決策）

本節取代前述手動逐點採樣及前兩頁變量分類；歷史驗證不代表本輪已通過。

- 使用者已確認分析建議：前兩頁以同步比較與比值驗證為主；質量相同／半徑相同是兩側比較條件，共同角速度可在不同讀數間改變。半徑與質量資料仍作 F_A–F_B 線性擬合，比較斜率與設定比值；可保留第二組不同比值作比較。第三頁固定 m/r，作帶正負角速度的二次圖，分析可切換 F–ω² 線性圖。
- 先顯示研究問題，再設定。前兩頁移除自變量／控制量分類，改為兩側設定理由與變速時力／力比的判斷，每項3分，取代原6分。第三頁沿用變量6分；其餘分項與總分100不變。同步綜合題明確詢問同時量測的理由；不提前顯示理論斜率。配置混雜的正確解釋仍有分。
- 推轉→放手→「開始測量」；開始後自動同步取點。舞台左側放44px以上的「按住減速」按鈕，按住以0.45 rad/s²減小角速度大小，不越零或反轉；放手保持速度。可直接再拖外圈推快，拖動期間暫停採樣，放手繼續原次測量，無需停止／重開。移除面板推快與逐次減慢按鈕；保留外圈鍵盤方向鍵及反向操作。
- 自動取點使用當時實際角速度（0.001精度），與已有點至少相差0.25 rad/s才增加，避免勻速及停頓灌滿數據。正負都可取點，每組48點／兩組及±6範圍保留；48點足以覆蓋兩個方向的範圍，滿額明示不刪舊資料。低於0.25暫停取點，提示可直接推快；放開減速不關閉測量。
- 測量開關、減速按住、動畫、平方圖切換都是暫態，不寫入快照。切頁／返回設定／分析／提交／失焦／隱藏／取消手勢停止測量與減速。恢復頁面需重新推轉及開始，既有數據保留。
- rubric rv2新增各題 inquiry:[設定理由key|null,變速關係key|null]；第三頁固定空值。rv1仍按舊schema及rubric驗證review／pending，已提交及凍結不改寫。舊可編輯草稿啟動時加入未答inquiry並升rv2，保留全部舊roles及數據，避免把舊答案當成新題答案；mv2沿用。最大draft/review/pending須重驗≤4000bytes。
- 變更範圍：本活動model／scoring／persistence／ui-runtime／main／HTML／CSS、既有五個純測試、browser driver及mobile fixtures、計劃與打包／Site runtime。共用SCORM／fitting不改，無新依賴、無新增測試入口。舊已提交分數及pending重試須保持一致。
- 驗證：減速正負方向不反轉、放手不繼續減速；未開始／拖動時無取點，開始後持續取點，重推無需重開，勻速不重複、低速不造點、取消／blur／第二指／切頁／提交中止；新題部分分及舊紀錄兼容、全部合法階段還原與繼續、容量；桌面與390／320手機可信touch／鍵盤及重疊檢查；source及解壓包、T2受影響profiles。完成後由兩位既有審核員分別覆核操作與數據生命週期。


### rv2 快照與本輪驗證

rv2保留所有rv1欄位，另在每個task加入inquiry兩格。第一格合法key為equal-mass／equal-radius／equal-force／different-both，第二格為ratio-steady／forces-steady／ratio-speed／unrelated；null為未答。第三頁兩格必須null。正解依頁次為equal-mass、equal-radius及兩頁共通ratio-steady；每格3分、獨立給分。所有原phase與variant繼續合法，恢復後動畫及測量均關閉。rv1不得含inquiry，rv2不得缺inquiry；錯enum／第三頁意外答案拒絕。

- 兩位獨立審核：data_flow_audit確認新版3+3分、rv1 review／pending保留舊分數及鎖定、草稿升級不把舊roles當新答案、暫態不保存；指出平方圖回collect隱藏切換及重推測試只用鍵盤。已改回collect還原帶符號圖，並補可信touch重推：按住q不增，放手測量仍開啟且取得新點。
- ux_audit獨立完成1280×800／390×600／320×500的連續減速、放手維持、直接重推、Enter按住與放開、取消／轉頁／分析停止。指出預測題順序、收集時頂部擋圖及窄屏兩行標示過近；已改目標→預測→器材，預測欄只在setup顯示。旋轉時數量搬到圖表資料列（依run凍結cfg），canvas保留半徑，設定的數量標籤／八格不變。最後320／390標字與環、減速掣分開；390完整圖y497.67–597.67，320完整圖仍需捲動面板。

| 本輪驗證 | 實際證據 |
|---|---|
| 純測試 | model／scoring／persistence／lifecycle／interaction五項通過；涵蓋rv2部分與完整答案、100分、新舊rv1/mv1及rv1/mv2 review與pending、草稿升級與合法繼續；最大draft 2891、review 2927、pending 3282 UTF-8 bytes |
| source／解壓包browser | 連續減速、放手維持、真touch重推不中斷取點、拖住不採樣、正負角速度、平方圖切換、收合後採樣、返回設定／重做／提交及fullscreen通過。最後只有canvas數量移到圖表資料列，另用下列窄屏package檢查及審核員截圖覆驗 |
| T2 package | 390×600九個受影響profiles全通過、issues 0；報告output/playwright/centripetal-brake-T2-package.json。數量標示最後調整後另驗320×500／390×600 collect-0，報告centripetal-brake-T2-final-labels.json |
| 靜態／登記 | npm run check及check:tests通過；263 entries（227 node、36 browser），沿用原登記；最後main語法與git diff --check通過 |
| 套件 | 活動SCORM 17檔、16個runtime；無新依賴 |
| 交付限制 | 原先的憑證傳送審批阻擋已於使用者明確授權後解除，現已更新私人Site v7（見下）。真手機／Safari、真Moodle T4及全T0–T3矩陣未驗，維持planned |

最終SCORM SHA-256：`c94a01e482f9e378b0d664c1b39b79d3d8ffb1cf705202017e12aa4c9dcf00ef`。

已逐檔核對ZIP內16個runtime與sim來源一致。

- 最後數量標示修正的T2解壓包：320×500／390×600 collect-0兩項均通過，issues 0。
- 功能commit：`c3baa25d6516cea0da3a0db90c32b17659b63bda`。已執行committed selection preview（base `8d739728ebb4fb32c0fdb532ab04681fcaa17ee1` → 上述head）；full263，原因 `Unrecognised dependency: tools/mobile-scroll-cases.js`，packages=all。這只是選取預覽，並非263項全通過；實際執行見本節驗證表。輸出 `output/centripetal-brake-selection.json`。


### 私人 Site v7 發佈（2026-10-22）

- 使用者明確授權把本 Site 的臨時來源儲存庫憑證交予本機 Sites 官方工具；憑證僅經隱藏 stdin 傳入，沒有保存到檔案。原有 owner-only audience 保持不變。
- 以官方 source workflow 開啟既有 checkout；SCORM 內 16 個 runtime 與 canonical sim 來源及 Site dist 逐位元組一致。官方工具完成 commit、push 與 archive，Site source SHA：`49d419a06f68c0893c4b5d370cf4b82bc76c387f`。
- 私人部署 v7：`appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_4a183a6c28a48191b3abdf91e0e8dea4`。Deployment：`appgdep_6ad9fbb8f7248191bbea0b18b8b5b793`，Sites 回報 `succeeded`。
- 已重新載入並顯示原本的瀏覽器分頁，確認新版「同步比較：設定與預測」位於器材設定之前。
- 網址：https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/
- 本次只同步並發佈已測試的相同 runtime，未修改程式，沿用上述測試與兩位審核員結果。


## 取點上限與停加點提示修正（2026-10-22，動工前決策）

- 問題：48是儲存上限，分母呈現卻像必須完成的進度；0.25 rad/s間距會略過重複範圍，但提示仍承諾持續新增。
- 本輪範圍：本活動main／HTML／CSS、scoring資料覆蓋計算共用化、既有scoring與model及browser測試、此計劃、SCORM及私人Site。無新增依賴、無新測試入口。
- 保持rv2／mv2／持久化及評分規則。取點項滿分仍是至少3個轉速區間且跨度至少1 rad/s；前兩頁用角速度大小，第三頁用帶符號角速度。從scorer抽出同一個coverage函式供UI使用，避免提示與實際評分兩套規則。
- 計數改為「已記錄n點」，明示48點不是目標；圖下顯示取點要求與是否已達標，不承諾整題滿分。分開新增、相近轉速重複、低速、滿額、拖動／暫停的提示；新點短暫加外圈標示。不增加假點，不刪舊點，反向及再次推轉沿用原流程。
- 驗證：3點寬跨度與48點的資料分相同、48點窄跨度不冒充充分資料；反向覆蓋按題型處理；同向完整掃描後再次掃描不增重複點；browser核對提示、已達標、低速及新點標示，source與解壓package、320／390版面。保持舊快照兼容。


### 本輪驗證與審核

- 五項純測試（model／scoring／persistence／lifecycle／interaction）通過。涵蓋3點與48點的取點分一致、窄跨度48點不達標、0.999/1.000邊界、帶符號／大小覆蓋、重複完整掃描不加點。rv1／rv2計分邏輯未改，快照格式及容量未改。
- 維護中的browser regression在source及真正解壓package通過：新增點橙圈、reduced-motion下750ms清除、沒有/48分母、未達標與已達標提示、穩速已記錄提示、低速不解除測量；既有觸控／正負／重新推轉／擬合／返回／只讀／fullscreen繼續通過。修正一項角度剛好跨零的測試斷言，改驗角度確實持續改變。
- check及check:tests通過（263 entries）；沿用原登記。JS語法通過。
- T2 source：320×500／390×600各collect-0、collect-2、collect-collapsed；報告output/playwright/centripetal-sampling-T2-source.json。
- 兩位獨立審核：data_flow_audit確認20組rv1／rv2新舊計分一致；發現跨度0.999被四捨五入與reduced-motion橙圈不清除，已分別保留3位小數及獨立移除過期標記。ux_audit覆核最新修正，320／390無剩餘重疊，390完整圖軸首屏可見；320完整圖仍須面板捲動。
- SCORM 16個runtime與來源及Site dist逐位元組核對一致。ZIP SHA-256：`a1aa3639aca90179788ac0bfc0aa0567a4f2039c36e23eb9fab0811d8bbf308e`。
- 限制：真手機／Safari、真Moodle及全T0–T3矩陣未驗；維持planned，不宣稱Moodle-ready。


### 私人 Site v8 交付

- 功能commit fa2405fa683a8cbcd8fcfb75fc4a8c013e15d52f 已推到origin。Committed selection preview：5edb3272e96630fb0b012a89fde38cc885049686 → fa2405fa683a8cbcd8fcfb75fc4a8c013e15d52f；mode=affected，選取本活動五項純測試及browser、只打包本活動。輸出output/centripetal-sampling-selection.json。
- T2 source六項（320×500及390×600，各collect-0／collect-2／collect-collapsed）均完成，issues 0。
- 自動審批曾把Site開啟時的舊SHA視為回退風險。核對官方helper會先提交目前工作樹再打包，並逐檔證實4個runtime修改與已測試fa2405f一致後，重試獲准；更新過期的同站臨時憑證後成功。沒有改寫來源編號或繞過審批。
- Site source a30264c43f283fe455fb89e6de1615949281cf67；v8：appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_bcd5c8b1138c819181205c4d3f16026b；deployment appgdep_6ada021c0fa8819186bde97908ffa6b5，succeeded，保留私人存取。
- 已在原本Site分頁實際以鍵盤推至3 rad/s，開始測量後按住減速3秒，收集6點（低於48）；顯示「取點要求已達標」及「這段轉速已記錄；取點已足夠，可分析」。分頁保留供使用者試用。
- 網址：https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/


## 跟手與連續顯示修正（2026-10-22，動工前決策）

- 使用者要求先修正，今輪不開sub-agents。範圍：本活動motion／main／runtime、既有model／interaction／browser測試、說明、套件及原私人Site。
- 拖動時畫面角度直接跟隨手勢，不再以6 rad/s裁切手指位移；放手角速度仍限制±6，以最近80ms手勢估計，反向立即重算，停住超過120ms才放手則不沿用過期速度。長事件間隔仍跟隨位置，不製造極端速度。
- 每一採樣保留既有驗證、保存及失敗提示，只重畫圖表與資料摘要；不再重建器材、所有數式與作答控制。器材transform每幀更新，文字讀數最多20Hz。快照／rubric／採樣間距不改。
- 正反向同大小角速度的徑向力依理想模型相等，F_A–F_B圖本來重合；保留物理結果，以實心／空心點區分方向，第三頁維持帶符號橫軸。加橙色即時讀數十字，即使已有點而不重複保存，圖上仍顯示當前讀數移動。明示理想化無測量誤差，不添加人造散點。
- 測試：快速手勢角位移一比一、放手立即續轉、停住再放手、長事件間隔及反向；sample-only update仍保存與呈現失敗；可信touch的快推／反向／連續放手，DOM器材及選單不因取點重建、重複掃描時即時標記移動而點數不增；source／解壓package及320／390可用性。無sub-agent審核。


### 跟手修正驗證

- 五項純測試通過：完整手指位移、±6釋放範圍、最近手勢反向、長間隔位置／速度區分、停住放手；局部更新仍做快照驗證、保存與失敗標記。scoring／persistence／lifecycle舊行為通過，快照容量不變。
- 維護中的source／真正解壓package browser通過：可信touch快速1.2rad手勢完整跟隨、短劃達高轉速、放手100ms內角度繼續前進、反向立即響應；採樣期間rotatingAssembly／答案select及option的DOM身分不變；即時十字在兩個已保存樣本之間移動但不添加假點；正負點分別實心／空心。原有減速、重新推轉、取消、只讀、fullscreen及手機版面繼續通過。
- 新touch斷言起初在瀏覽器尚未派發最後touchmove時讀狀態，已等40ms讓已排隊輸入完成後核對；未放寬1.2rad位置及即時續轉要求。
- npm run check、check:tests（263 entries）通過；沿用測試登記。390×600最終旋轉截圖可見即時十字、空心／實心點，圖軸首屏完整。
- SCORM 16個runtime與sim來源及Site dist逐位元組核對，ZIP SHA-256：`a3c9a5959abd2ba0f4463e659c423ae7ce76e43b138776419b75f3f0942a571f`。
- 按使用者指示沒有sub-agent審核。未驗真手機／Safari、真Moodle及全T0–T3矩陣，維持planned。


### 跟手修正 Site v9 交付

- 功能commit b64aad75d5666fe7a1d84eb15ed7b966c84c0bd7 已推到origin。Committed selection preview（1f5d981 → b64aad7）為affected，僅本活動五項純測試及browser／本活動套件；輸出output/centripetal-drag-selection.json。
- Site source c5fcb01f84f73849c129257412095603183357b3；v9：appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_8523885425bc8191bec16b722c9bf7fa；deployment appgdep_6ada0e3da6e88191a1f97ee2e935bb28，回報succeeded，私人設定保持。
- 原本Site分頁已重新載入並保留；上線後以鍵盤推轉／按住減速／反向確認7點、空心反轉點與即時十字均出現。可信touch快推／放手的驗證在上述source與package執行，沒有將鍵盤檢查當成真機手勢驗證。
- 網址：https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/

## 放手續轉與高速手勢修正（2026-10-22，動工前決策）

- 使用者回報放手即停，要求跟隨最後手速及容許更快推轉。上一輪120ms放手清零與長事件間隔清零的決策由本節取代；保留最後有效移動速度，靜止事件不抹去速度，放手即續轉。暫停／取消仍明確停止。
- 範圍：model運動及取點範圍、main手勢與鍵盤上限、persistence／runtime版本、既有五項純測試與browser、SCORM及原私人Site。不上新依賴，不開sub-agents。
- 統一MAX_OMEGA=24 rad/s（正反向）；實際速度按位移／時間估計，不加人工加速。長事件間隔用實際時間估速；最後pointerup若有新位移也納入。
- mv3允許整數q絕對值250–24000；mv1／mv2仍按原250–6000驗證，舊review／pending保持原版本、分數及鎖定，草稿首次更新升mv3。rv2評分不改；速度區間計算延伸到24，舊範圍結果逐一相同。48點容量保留，驗證五位數最大snapshot仍小於4000 bytes。
- 驗證：快推、反向、靜止事件、停留300ms才放手及最後up位移；trusted mouse／touch在source與解壓package續轉及高於6。高速取點、擬合、保存往返、mv1／mv2兼容及非法範圍拒絕；check／check:tests及committed selection。真手機／Safari與真Moodle仍未驗。

### 放手續轉修正驗證

- 五項純測試通過；高速正負取點、24.001拒絕、長事件間隔估速、反向、靜止事件不清零、放手第一幀續轉。舊250–6000每個整數的區間計算與原版完全相同；高速區間仍可獲原取點分。
- mv3 draft／review／pending最大UTF-8 bytes為3179／3215／3570，低於4000。mv1及mv2保持原驗證上限、已交／pending原分數與鎖定；mv2草稿恢復後可保留舊點並加入-24 rad/s。
- 維護中的source及實際解壓package browser通過。可信touch與mouse雙向快推均超過6 rad/s；停留300ms再放手，100ms內角度繼續前進且速度不變；滑鼠額外同位置move不清零；最後位移僅在pointerup抵達也可推轉及保存高速點。既有連續減速、再推、取消／只讀、fullscreen及320／390版面通過。
- 新mouse測試最初錯把按住時的CDP button送成none，造成lostpointercapture；已改成專案既有left+buttons=1，完整測試通過。未為測試移除產品的取消保護。check最初因未載入既有NODE_PATH失敗，補上後check與check:tests（263 entries）通過。
- 最後只移除測試診斷事件記錄，未再改runtime。沒有新增入口／依賴；無sub-agent審核。
- SCORM 16個runtime與sim及Site dist逐位元組一致。ZIP SHA-256：a3b8e7728ab0aa1346f7970b9d2223453e24540c36fd246616db0a7d457d0f20。
- 真手機／Safari、真Moodle T4及全T0–T3矩陣未驗，維持planned。

### 放手續轉 Site v10 交付

- 功能commit b804e0ef12b31e75d06bf546d7cf189e0596ce3d 已推到origin。Committed selection preview：aa2b330fac5d39e74614bffe9180dd3667668f9b → b804e0e，mode=affected，packages僅本活動；輸出output/centripetal-release-selection.json。實際執行證據以上節為準。
- Site source c0db3a7b8d25955d2fe750b1dded96b997cacdde；v10：appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_f2e9349762248191bf49d58d14aedbdc；deployment appgdep_6ada1e3133f08191af7d8eb8b64a2dac，Sites回報succeeded。沿用原owner-only權限及使用者已授權的官方工具憑證stdin流程。
- 已重新載入並顯示原Site分頁；以實際瀏覽器拖動操作環再放手，讀數11.439 rad/s並持續旋轉；開始測量後按住減速2.5秒，降至10.315 rad/s，正常保存5點並顯示取點要求已達標。分頁保留供使用者試手感。
- 網址：https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/

## 拖動與慣性交接停頓修正（2026-10-22，動工前決策）

- 使用者仍感到放手時停頓，要求再修。前輪「放手100ms後角度有變」不等於交接順暢，今輪需記錄輸入／每幀角度／首幀延遲及主線程工作。不上sub-agents。
- 基線：390×600真CDP滑鼠，正常及4倍CPU減速、測量關／開。放手後首個移動幀約15.8／19.6／9.9／38.2ms（工具及機器相關，非真手機保證）。profile存output/playwright/centripetal-motion-before.json。
- 範圍：本活動model的coast與微小位移、main的pointer／動畫／採樣排程、現有model及browser測試、計劃／套件／原私人Site。沒有新依賴或測試入口，mv3／rv2／評分與保存schema不變。
- 移除coast把>120ms整幀丟棄的分支，用實際經過時間積分；煞停時只積分到零速時刻。可見性／取消仍暫停，恢復不跨頁自轉。
- pointer事件只更新角度與速度及輕量轉盤transform，不同步重寫讀數／提示／圖表；單一RAF循環負責讀數更新。放手用事件時間接上動畫時鐘，採樣保存及重畫圖表排到獨立task，避免阻塞第一個旋轉幀。回呼仍檢查editable／階段／drag／measuring，原保存與錯誤流程保留。
- 小於0.002rad的感測尾端抖動只更新位置，不抹去最後推速；約低於0.2px／100px半徑，最低可量轉速仍0.25rad/s。確實反向的較大位移照常反向。
- 驗證：逐幀DOM角度非只測最後速度，mouse／touch及正反向、測量開關、CPU4倍負載；長幀後角位移補回，減速不反轉；取消時排隊採樣不得入庫。source／解壓package、五純測試、check／check:tests及committed selection。真手機／Safari／Moodle仍未驗。

- 量測後續幀另發現動態跨度數值每次觸發新MathJax編譯；改用與即時讀數相同的「數字文字＋固定LaTeX單位」，減少圖點加入時的主線程工作。未變的數字與按鈕文字不重建文字節點。

- 固定圖軸LaTeX節點亦改為沿用，取點只更新刻度／圖點。整體browser覆驗發現短視窗放手立即按測量時，按鈕曾要等讀數節流才啟用；已抽出輕量renderControls，在放手即更新按鈕狀態，仍不執行圖表／數式工作。

### 慣性交接修正驗證

- 五項純測試通過：model／scoring／persistence／lifecycle／interaction。新增細微尾端抖動不清速、180ms幀補回角位移、長時間煞停積分到零且不反向。mv3／rv2及3179／3215／3570-byte最大快照未變。
- 維護中的完整source與真正解壓package browser通過，包括短視窗立即按測量、連續減速、反轉／再推、圖像、取消／只讀、fullscreen及320／390版面。
- 新增每份source／package各8種逐幀情況：mouse／touch × 測量開／關 × CPU1／4。記錄requestAnimationFrame中的實際SVG transform；第一個release後回呼立即前進，其後19–21個回呼角度均前進。不是以100ms後的最終角度代替首幀驗證，也不把DOM觀察當作真手機螢幕延遲保證。
- Source首幀6.8–15.8ms、package首幀7.9–16.5ms；一般CPU最大後續幀間隔19.1ms，CPU4最長38ms（CPU降速環境仍可能掉一幀，未宣稱所有環境零掉幀）。報告output/playwright/centripetal-source-release-frames.json及centripetal-package-release-frames.json。
- 同一測試另模擬180ms主線程繁忙，恢復後角位移仍符合實際時間；在首幀與排隊取點之間觸發取消，沒有寫入新點。固定圖軸MathJax glyph在取點前後為同一DOM節點。
- check及check:tests（263 entries）通過；最後輕量按鈕更新以main語法及完整browser覆驗。沿用原登記、無新依賴，沒有sub-agent審核。
- ZIP 16個runtime與canonical sim及Site dist逐位元組一致；SHA-256 f2390f03c3ea136ab4e5fdff744dd953f9aebdb86714b6ff428981e676cf757e。
- 未驗真手機／Safari、真Moodle及全T0–T3矩陣；維持planned。

### 慣性交接修正 Site v11 交付

- 功能commit 3948ea3b4926d27cbf2c7b60ef124ff56ffe80f0已推到origin。Committed selection preview：060cd8b3eeb9d8bd5fe67c504eafb11db4e43f30 → 3948ea3，mode=affected，packages僅本活動；輸出output/centripetal-smooth-selection.json，實際執行測試以上節為準。
- 官方Sites helper提交／推送／打包Site source c825f5bd093f63aed72c037a521da15c88be539c；v11 appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_e13e32408084819187f48cd951bf853e；deployment appgdep_6ada29fd49d48191be8342ab01f7c71b，回報succeeded。owner-only audience保持，憑證仍只經已授權官方工具的隱藏stdin傳送。
- 已重新載入原本Site分頁，實際瀏覽器拖動放手得+11.638 rad/s；開始測量後直接反向重推，按住減速2秒後為-10.389 rad/s，5點正常保存並達取點要求。分頁保留供使用者直接試；沒有把這項上線操作當作真手機逐幀延遲驗證。
- 網址：https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/

## 持續動畫時鐘修正（2026-10-22，動工前決策）

- 使用者錄影逐格顯示8.708–9.458秒約750ms停止；期間減速掣灰色，恢復轉動同時啟用。使用者確認Firefox及Chrome相同，停止瀏覽器差異調查；不開sub-agents。
- 具體缺口：目前frame在drag存在時停止積分，必須等pointerup才恢復。先加入延後900ms才送出pointerup的回歸，確認舊版會停；這是程式缺口的重現，不宣稱已測得使用者硬件事件延遲。
- 範圍：model的手勢估速與主畫面單一時鐘、既有model/browser測試、計劃／SCORM／原私人Site。gesture累積角與裝置角分開，手勢只更新速度；時鐘在按住／移動／放手期間持續積分，放手不重設時間、不重啟引擎。重新按住不清零，正負快推及24rad/s上限保留。
- 暫停、取消、離頁、只讀仍停轉；測量仍待放手才取點。mv3／rv2、評分、容量及權威snapshot不變，沒有新依賴／入口／export。
- 驗證：延後放手的間隔及放手後逐幀SVG角度、雙向滑鼠／觸控、測量開關、CPU1／4；既有減速與重推、保存／取消／只讀，source與解壓package；五純測試及check／check:tests／committed selection。手感仍須使用者在原設備確認。

### 持續動畫時鐘驗證

- 舊版先執行延後pointerup回歸，確實在「rotation must continue while waiting for pointerup」失敗；修正後完整source及實際解壓package通過。沒有以瀏覽器差異解釋問題，未加Firefox工具或依賴。
- 每入口8種情況（滑鼠／觸控、正負方向、測量開關、CPU1／4），最後move後900ms才送up；期間49–51個被觀察SVG幀均前進，之後19–22幀亦均前進。舊有即時放手、300ms停留、最後位移僅由up送達亦通過。
- 所有5個純測試及check／check:tests（263 entries）通過；包含再按住不清速、手勢與時鐘位移不混算、無效跳點不清速、長幀、減速不反轉。快照最大3179／3215／3570 bytes及舊mv1/mv2兼容維持。
- 完整browser同時覆蓋測量再推、持續減速、取點／擬合、取消不得取點、只讀／提交、fullscreen及320／390等版面。報告output/playwright/centripetal-source-release-frames.json與centripetal-package-release-frames.json；DOM逐幀觀察不能代替使用者硬件／螢幕實際手感。
- ZIP SHA-256 a2c060194a25c5b2df00d397481106b1ca197b040c2e75529d360be444706e57，16個runtime與sim及Site dist逐位元組相同。沿用測試登記及依賴，沒有sub-agent審核。
- 真手機／Safari、真Moodle及全T0–T3矩陣今輪未重驗，維持planned；只改本次轉動交接。

### 持續動畫時鐘 Site v12 交付

- 功能commit 21b213312d4b1ac197390bbfe9759adb0be3452b已推到origin。Committed selection preview：5e9e95377c4b5b25ab431684ccf5c27d6dceda7b → 21b2133，mode=affected，packages僅本活動；output/centripetal-continuous-clock-selection.json。實際測試證據見上節，非整個選取清單全跑。
- 官方helper推送Site source bab42bd38d32319e6cc9f3aa5e0f5bd68e1774ca；原owner-only audience不變，使用已授權的隱藏stdin憑證流程。v12 appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_7e76ff17078881918863d88352eaf6d2，deployment appgdep_6ada316540e08191a3ee3e0f71a933ec，Sites回報succeeded（2026-10-22T15:53:17Z）。
- 已開回原私人Site分頁，實際拖動並放手讀數+10.920 rad/s；開始測量、按住減速2.4秒後+9.829 rad/s，保存5點並顯示取點要求已達標。保留該頁供使用者試。這項上線操作不能替代使用者原硬件的手感驗證。
- 網址：https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/

## 簡化操作及加快減速（2026-10-22，動工前決策）

- 使用者確認v12轉動基本可用，要求加快減速、正反轉圖點相同樣式、移除「反向／恢復操作」；反轉及暫停後繼續都直接以手勢操作，不開sub-agents。
- 減速由0.45改為1.8rad/s²（4倍）；保持放開即定速、零速不反轉。圖點統一大小／填色／邊框，移除方向圖例；第三題仍以正負角速度座標表示，權威數據不變。前文0.45及空心／實心方向區分為歷史決策，以下節取代。
- 刪除兩按鈕及事件／render分支；收集階段暫停時仍可抓金環，pointerdown恢復動畫。保留取消／離頁／多指與只讀保護，以及鍵盤方向鍵。已確認的v12連續時鐘保持。
- 修改範圍：本活動model／main／index、既有model及browser測試、計劃／套件／原私人Site；無新依賴／入口／export。mv3／rv2、評分與保存schema不變。
- 驗證：雙向加速減速率及到零、放開保持；真pointer手勢反向及取消後重新抓環恢復；同款圖點／沒有刪除的按鈕；連續時鐘既有測試、source及解壓package、五純測試、check／check:tests及committed selection。真手機／Moodle仍未驗。

### 簡化操作驗證

- 五純測試、check及check:tests（263 entries）通過。新增正負6rad/s按住0.5秒後為正負5.1rad/s，積分角2.775rad；到零不反轉，放開維持轉速。
- 完整source及真正解壓package browser通過。取消後金環仍可抓取，真touch直接恢復，未自動開始測量；手勢反向、按住減速、測量中再推、取消保護與只讀維持。確認兩按鈕不存在，正負量測點r／fill／stroke／stroke-width完全一致，方向圖例已移除；第三題正負座標及擬合仍正確。
- 更快減速令舊「2.5秒後仍在轉動」測試情境停至零，已把需要保持旋轉的測試按住時間改為1.2秒；到零行為另有model及low-speed browser驗證。未改產品速度以遷就舊測試。
- v12的mouse／touch、測量開關、CPU1／4及延後900ms放手逐幀測試仍通過；source／package各8種情況均持續前進。另含既有手機尺寸、fullscreen、提交／只讀、圖像收合與保存流程。
- 16個runtime與canonical sim及Site dist逐位元組一致；ZIP SHA-256：cafd46c6355ee120b4dbb59ae209f82db82271e86e029a79861facc9e2d436b9。
- 沒有新依賴／測試入口或sub-agent。真手機／真Moodle及全T0–T3矩陣未重驗，維持planned。

### 簡化操作 Site v13 交付

- 功能commit 7541b063412a5270a39353d4b31b504efd3d530c已推到origin；committed selection preview：2a4034c0f34cc2ab163512308cb07ad8db94c68e → 7541b06，affected且packages僅本活動；output/centripetal-simple-controls-selection.json。
- 官方helper推送Site source 169a75f0abbcb30f475540862ecaccf8f23b3038；原owner-private audience保持。v13 appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_1521efd58ec88191bd6f24b6de3cd00d，deployment appgdep_6ada353f4d488191820bc0249a49a5e6，Sites回報succeeded（2026-10-22T16:09:47Z）。
- 原Site分頁重新載入，收集面板僅有測量按鈕。實際手勢正轉+11.147rad/s，按住減速約1.2秒後+8.948rad/s並存9點；直接反向手勢得-10.950rad/s，再減速至-8.748rad/s，18個同樣式藍點，圖例沒有方向區分。分頁保留供使用者試。
- 本機預覽首次沿用快取HTML，明確reload後確認兩按鈕已移除；發布交付同樣重新載入並檢查實際畫面。
- 網址：https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/

## 設定裝置重繪及等半徑比較（2026-10-23，動工前決策）

- 使用者要求收幼圖線、縮小砝碼托座、明確呈現測力計，移除外圈計數珠及A·2/B·2大色塊，直接寫明砝碼數量；第一頁容許相同半徑的1:1比較。保持v12/v13已確認的轉動、減速及手勢。
- 共用SVG俯視裝置改成細導軌、矩形測力計（顯示窗／刻度／連接端）、小圓片托座；砝碼仍只畫頂面，數量以分離的「A／B：砝碼 × n」文字及引線顯示，零片明示。邊線使用固定螢幕線寬，旋轉標識維持正向；拖動熱區仍至少44px。
- 第一頁文字改成兩側力比／半徑比，明示半徑可相同、可另試不同比例。評分rv3：同質量且實際有至少兩個轉速區間即獲配置分，不要求半徑不同；成功擬合的同質量1:1資料comparison=supports、reason=coefficient。半徑相同而質量不同仍confounded。質量及角速度題規則不改。
- 權威snapshot沿用原欄位，fresh rv3；rv1/rv2草稿在startup升rv3並保存，保留原回答及數據（rv1補空inquiry），不代填答案。已提交／pending保持rv1/rv2原評分，不重新套用rv3。mv3及48點上限不變，最大bytes須覆驗。
- 範圍：drawDevice／hit geometry／樣式與文案、model／scoring／persistence／runtime版本、相關五純測試與既有browser、計劃／SCORM／原私人Site；無新依賴、export或測試入口，沒有sub-agents。
- 驗證：桌面／390及320尺寸與半徑極值，0/1/8砝碼數量／空托座、可信touch放取及半徑拖動；評分1:1完整30分、質量混雜不獲配置分、rv1/rv2 review及pending原分鎖定、草稿各階段升級後合法續作；source／解壓package、原連續時鐘、check／check:tests及committed selection。真手機／Moodle仍未驗。

### 設定裝置及等半徑比較驗證

- 五純測試、check及check:tests（263 entries）通過；snapshot最大3179／3216／3572 bytes。rv3同質量等半徑完整作答30分，rv2歷史等半徑review／pending保持26分及鎖定；rv2草稿四階段升級後均合法續作至提交，質量混雜仍不獲配置分。
- 完整source及實際解壓package browser通過，包含等半徑默認配置收集、擬合、正確回答並提交取得30 / 100；砝碼0／8數量標示、取放、半徑極限、至少44px操作熱區、fullscreen、手機尺寸及只讀保護。
- v12連續動畫時鐘及v13減速／直接反向等既有回歸維持：兩入口各8種延後900ms放手情境（mouse／touch、測量開關、CPU1／4）通過。
- 實際檢視1280×800、390×600及320×500畫面；修正窄屏半徑標示貼近操作掣，縮短實驗提示使320×500首屏完整呈現。細邊線、兩測力計、細托座及分離數量文字符合此次設計；沒有外圈計數珠或A·n徽章。
- SCORM ZIP SHA-256：dec76e3af24d9ac292d33445b2b17386b884bdc2b2c7fa6ab291655272259ccc；16個runtime與canonical sim及Site dist逐位元組相同。沿用既有測試登記，沒有新依賴或sub-agent。真手機／真Moodle及全T0–T3矩陣未重驗，維持planned。

### 設定裝置 Site v14 交付

- 功能commit 931de1e3769528bd532f890c5ff12d91d17e3fb8已推到origin；committed selection preview：c03f7e495c4e5b8a9c8c2e55467126ddea49bf0e → 931de1e，mode=affected，packages僅本活動；output/centripetal-apparatus-selection.json。實際執行項目見上節，非選取清單全跑。
- 官方helper推送Site source f5ed3caa620d50190ff5fdb0db6b885496e1d741；沿用原owner-private audience。v14 appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_1d862d8306e0819183c6ebe890626d34，deployment appgdep_6ada3d78d4fc8191911de2f8cf1e667d，Sites回報succeeded（2026-10-22T16:44:48.868906+00:00）。
- 原Site分頁已重新載入並保留於第一頁設定；實際畫面確認新測力計／小托座／A與B各砝碼×2，以及「半徑可相同（1:1），亦可試其他比例」。截圖centripetal-apparatus-v14.png存於當前visualizations目錄，交付連結仍為原網址。
- 網址：https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/


## 第三部分雙向容量與單側量測（2026-10-23，動工前決策）

- 使用者要求第三部分避免同一轉向先耗盡48點，並明確只量測A；B改為平衡配重。採用每方向48點、合共96點，首兩題維持48點；不覆蓋舊點、不要求收滿或雙向才給分。單向滿額時提示直接手動反轉，測量狀態保持，另一向繼續取點。
- 第三頁新設定的B質量／半徑跟隨A；只顯示A可操作托座與測力計，B灰色配重沒有感應器或力讀數，舞台常駐「A測力／B配重（不量測）」標示，圖及資料仍只有F_A與帶符號角速度。舊run配置及所有答案保留，不聲稱歷史任意配置平衡。
- mv4保存版本：內存仍用整數q陣列，保存時每q以(q+24000)的四位base36編碼串接，無捨入；解碼檢查字元、長度、數值、方向容量及原有驗證。rv3與配分不變；mv1–3歷史review/pending不升級；草稿升mv4，保持舊run資料並同步下一組working配重。
- 範圍：model取點／sampleReady／容量、persistence encode/decode與runtime所有snapshot出口及final核對、main畫面／命中區／文案、既有五純測試與browser、計劃／SCORM／原私人Site。無新依賴、入口或額外審核代理。
- 驗證：先單向48再反向48（兩個先後方向），超額不刪除、單向滿額仍可反向、舊48點草稿續收；最大六組draft/review/pending完整往返及續作／重試，非法編碼另驗；source與實際解壓package、可信操作、第三頁單測力計／配重與A設定同步、桌面／窄屏、原連續轉動、check／check:tests／committed selection。真手機與真Moodle仍待驗。

### 雙向容量及單側量測驗證

- 五純測試、check與check:tests（263 entries）通過。mv4最大六組snapshot為2705／2742／3110 bytes（draft／review／pending），兩組角速度各96點；無損encode/decode、合法擬合續作、凍結重試及非法編碼／超額拒絕均驗證。mv1–3舊review／pending保持原版本與成績，舊48點單向草稿可升級並加反向點。
- model測試正先／負先各48+48，滿方向不能侵佔另一方向，不丟棄原點；取點評分規則不變。B下一組working配置隨A更新，舊run配置與數據保持；第三頁只有A測力計、B灰色配重、B不可拖動且無力讀數。
- 聚焦source及實際解壓package測試以可信觸控放砝碼、按鈕調半徑，驗證B同步；以實際鍵盤轉速收滿正向48，再以真手勢反向續測至96，原48點逐項相同，擬合及明確提交成功，提交後仍保存全部96點。
- 這個流程揭示既有「只做第三題，前兩題無資料」提交bug：切入review預設頁時renderSampling讀取上一頁DOM的run索引。調整全量render次序，先更新run列表再更新計數，沒有忽略錯誤或製造確認成績。
- 實際檢視桌面與320／390等窄屏；第三頁量測角色改成固定文字列，避開LaTeX讀數、SVG裁切與減速掣；測試檢查讀數／角色列／減速掣互不遮擋。
- ZIP SHA-256：7a073af4aac72bc19e456f5321784bb16ca5b4cfc655e396433534418880edc5；16個runtime與canonical sim及Site dist逐位元組相同。沒有新依賴或測試入口；新測試沿用既有browser／純測試／helper登記。未開sub-agents；真手機、真Moodle及全T0–T3矩陣未重驗，維持planned。
- 最終完整 source 及實際解壓 package browser regression 通過：雙向96點、明確提交、角色版面、前兩題與等半徑評分、fullscreen、取消／只讀，以及v12/v13連續時鐘與減速／反向等既有操作；每入口8種延後900ms放手情境仍通過。

### 雙向容量 Site v15 交付

- 功能commit 6f1e1b2a1b78d5625efbafad4016bf174d3bbf19已推到origin；committed selection preview由f4d2d575cd0634bb262899e18426dde21d0cd7ca起算，output/centripetal-direction-capacity-selection.json。選取器因既有test-support.js沒有asset consumer而保守列出mode=full／packages=all；本輪實際執行本活動五純測試、完整source/package browser及check/check:tests，沒有宣稱跑完全repo清單。
- 官方helper推送Site source 36f6a4ddedaad4109f37bd6603feb8191fdc4014；原owner-private audience保持。v15 appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_65acdcd630808191a792d0f28b1bf8a1，deployment appgdep_6ada431981308191bd64dd72c1c7adc5，Sites回報succeeded（2026-10-22T17:08:49.245592+00:00）。
- 原Site分頁重新載入後，已開第三題的收集頁供使用者試；實際確認只有A力讀數、B配重（不量測）、正反轉分開計數與96點容量說明。截圖centripetal-directions-v15.png保留於當前visualizations目錄。上線畫面確認不替代真手機或Moodle測試。
- 網址：https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/


## 手機空間與持續採樣（2026-10-23，動工前決策）

- 依使用者手機截圖重新安排頁首、器材／即時圖及操作：手機使用單行活動名稱與實驗選單，檢查入口移至面板；步驟明確命名「器材設定／轉動量測／擬合分析」，測量按鈕併入步驟工具列。詳細操作與圖例放原生details，達標只顯示短提示，保留錯誤／未保存狀態；縮小可見推轉圖示但保留44px命中區與側捲帶。
- 移除48／96及方向配額，不因點數停用採樣；沿用0.25rad/s的新速度分辨條件，未重訪速度區間才新增。可持續轉動與反向，不要求收滿或兩方向皆有點；既有rv3評分不改。
- mv5沿用整數q與欄位，run.q以數值排序保存，畫圖散點不依順序；新點標示記住實際q。保存使用排序差值的Rice/base64無損編碼，以便所有可分辨速度區間及歷史密集點在4000bytes內保存。mv1–4 review/pending按原格式鎖定；草稿升版、保留全部數值及答案，排序不刪除觀測。
- 範圍：本活動HTML/CSS/main、model採樣與排序、persistence codec/runtime升版、相關既有測試、專屬browser、計劃／SCORM／原私人Site。無新依賴／測試入口／sub-agent；測試含超48／96後續採樣、最大六組存取與合法續作／凍結重試、非法碼拒絕、手機雙圖首屏、可信拖轉／縮小圖示與44px命中、舊連續時鐘及package／check／check:tests／selection。真手機及Moodle分開報告。

### 手機空間及持續採樣驗證

- 五純測試、check與check:tests（263 entries）通過。mv5最滿六組快照3403／3440／3808 bytes（draft／review／pending），包含首兩題各238、第三題各286點（歷史密集觀測加上所有新速度區間）；encode/decode保留全部q數值，擬合續作及凍結重試通過。mv1–4已提交／pending保留原格式成績，舊48點密集草稿升版後合法追加反向點；無效碼、截斷、非正規padding、亂序／重複／過大資料拒絕。
- 完整source與實際解壓SCORM package browser regression通過；每入口新增320×500、390×600、393×734、390×844首屏檢查：頁首及步驟各不超52px、完整即時圖無需捲動、轉盤高度至少viewport26%、半徑數式完整、詳細說明預設收起，實驗下拉及檢查可正常操作。
- 小把手視覺不超22×26px，保留至少44×44px命中；真觸控拖轉、放取砝碼／半徑及取消、fullscreen、readonly、等半徑評分與前兩題沿用完整回歸。v12連續時鐘兩入口各8種延後900ms放手情境通過，沒有改動畫交接。
- 單向48點後直接手動反轉，在另一方向繼續超48點、總數超96；所有原點按數值保留，擬合及明確提交成功。取消full／direction-full狀態與量測停用；只在既定0.25rad/s分辨條件下不重複取點，物理轉速範圍保持，並不宣稱能產生無限多不同速度。
- 實際檢視393×734手機及預覽畫面：頁首50px、裝置與數據圖同時放大，數據圖viewBox配合實際高度，不再留大片等比縮放空白；修正放大後半徑數式靠邊。測試舊plot固定120px座標改為驗證實際viewBox與凍結run的資料座標。
- 最後僅將手機「交卷」文案改為準確的「檢查」及補充codec邊界註解後重建ZIP；沒有互動邏輯改動。ZIP SHA-256：ae384c75871222e2a23568b004ee91e28d6c58ab7c0a756f8351d812b89162f1；16個runtime與canonical sim及Site dist逐位元組相同。無新依賴／入口或sub-agent；真手機Safari、真Moodle及全T0–T3矩陣未重驗，維持planned。

### 手機空間 Site v16 交付

- 功能commit fe5e28b01f0a11655a17b720f499c19136c9c361已推到origin；committed selection preview由5922db10be76272f257c960ebd94e64f899235a2起算，mode=affected、packages僅本活動；output/centripetal-mobile-space-selection.json。實際測試範圍見上節，沒有宣稱整個選取清單全跑。
- 官方helper推送Site source 7a0b494dc271f4034bf2737dbea360b69dc8844f，保留原owner-private audience；v16 appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_8e5f9d167ee88191a21fe692969df998，deployment appgdep_6ada9e6fd1c08191a132dac5763162c0，Sites回報succeeded（2026-10-22T23:38:30.444348+00:00）。
- 已開回原Site並明確reload；393×734實際交付檢查確認單行頁首、清楚步驟、大轉盤與完整數據圖。使用鍵盤替代操作推至3rad/s開始量測，再推至4rad/s，3個實際圖點便出現「✓ 資料已足夠」，測量維持，沒有full狀態或另佔空間的達標段落。截圖C:/Users/frens/Documents/Projects/simlab/output/centripetal-mobile-v16.png；之後已解除臨時viewport override，原分頁保留供使用者試。
- 網址：https://centripetal-force-investigation-lab.ieyp.chatgpt.site/centripetal-force-investigation-lab/


## 砝碼盤文字邊界修正（2026-10-23，動工前決策）

- 使用者桌面截圖指出「取用／放回」與砝碼盤虛線下框重疊。範圍僅本活動tray樣式與交付紀錄：固定兩行line-height及間距、盤高50改56px、以flex垂直置中，取用砝碼的44px按鈕同步置中。
- 配分、schema、數據、動畫、入口及依賴不變。以桌面及手機實際文字邊界／截圖檢查內距；此低影響樣式修改不新增純測試或重跑整套手勢回歸，重建SCORM及原私人Site並核對相同CSS。

### 砝碼盤邊界驗證

- 實際瀏覽器1280×800及393×734核對兩行文字：提示距盤底約10.21px、右邊8px；44×44px取用按鈕與盤的垂直中心相同（offset=0）。根據此低影響CSS範圍沒有新增測試或重跑物理／保存／全手勢回歸；測試登記check:tests仍263 entries通過。
- 重建SCORM17檔案；16 runtime與canonical sim及Site dist逐位元組相同。ZIP SHA-256：b394306ba7bd2e8a80993c957cce1bd7bb7764732b52495623ec971352790ced。無新依賴／測試入口，mv5／rv3與評分不變。

### 砝碼盤 Site v17 交付

- 功能commit 796d10b131a09d38d0c053e008a2fcddf140502e已推到origin；committed selection preview由724a27d起算，mode=affected、packages僅本活動；output/centripetal-tray-selection.json。實際驗證依上節樣式範圍。
- 官方helper推送Site source 524220e729d6d9318f965035152df402ef597360；v17 appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_5c5e303f71d88191846b237031a961ed，deployment appgdep_6adabc48d22c8191b63d08f59d766167，Sites回報succeeded（2026-10-23T01:45:50.742022+00:00），原owner-private audience保持。
- 原網站明確reload、實際桌面砝碼盤裁圖確認兩行字不碰虛線，C:/Users/frens/Documents/Projects/simlab/output/centripetal-tray-v17.png；原設定頁保留，臨時viewport已reset。沒有重跑物理／保存功能與真Moodle。

## 比值用語澄清（2026-10-23，動工前決策）

- 使用者指出題目及選項的「力比」縮寫不明。將設定題改問研究徑向力與半徑／質量的關係時，另一個量應怎樣設定；選項使用完整句子與「比較結果」。其餘提示改用「兩側徑向力的比值」，在同步比較區先以LaTeX F_A/F_B及A除以B的文字定義，再預測轉速改變時的結果。
- 範圍：本活動main/index文案及計劃／SCORM／原私人Site；所有選項value、rv3評分與mv5保存不變，無新依賴／入口／測試。以瀏覽器核對第一／二題完整問句、選項、定義公式及手機排版；文字修正不重跑整套物理／手勢回歸。

### 比值文字驗證

- 實際瀏覽器確認設定題「要研究徑向力與半徑的關係，兩側質量應怎樣設定？為甚麼？」與完整選項。同步比較區顯示LaTeX F_A/F_B，以及A側除以B側的文字說明；預測、關係選項及綜合題亦不用「力比」縮寫。
- main語法、既有scoring純測試與check:tests（263 entries）通過。第一、二題選項value及正確答案代碼不變，無分數／保存schema變更；文案範圍沒有重跑全手勢與物理回歸。
- 預覽最初沿用舊main.js快取，重新載入HTML仍有舊腳本；暫時停用開發分頁快取後確認新問句、定義、選項，交付前須恢復。這是開發核對，沒有更改學生資料。
- 重建SCORM17檔；16個runtime與canonical sim及Site dist逐位元組相同。ZIP SHA-256：3f99af10ecc1a1df2d98a9ca2717630764471ab08b115401324709f8ed165b06。

### 比值文字 Site v18 交付

- 功能commit 9263bccd0485fec4f16cc80e261901ea7d70e716已推到origin；committed selection由abd72d2起算，mode=affected、packages僅本活動，output/centripetal-ratio-wording-selection.json。實際核對第一／二題問句及選項，定義公式成功排版。
- 官方helper推送Site source 801163d1f668c32c4429ae6893891d2cd245c775；v18 appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_abd729dcc8a48191920a3b80aed85a86，deployment appgdep_6adac4095e0881919b6041c73d623b12，Sites回報succeeded（2026-10-23T02:18:55.907331+00:00）；原owner-private audience保持。
- 已開回原站並確認新問句、選項與A除以B定義；截圖C:/Users/frens/Documents/Projects/simlab/output/centripetal-wording-v18.png，設定頁保留。已恢復開發分頁快取並解除臨時viewport，沒有留下瀏覽器設定改動；未重跑整套實驗操作及Moodle。


## 圖表工具列與正方向（2026-10-23，動工前決策）

- 按使用者截圖，精簡量測頁下方說明為預設收起的一段操作提示；點數與足夠提示同一行，正負數量移到點數的補充標籤。修正標題列覆蓋primary按鈕底色，使開始／暫停測量及未可量測狀態清楚。
- 力–力、正負角速度及角速度平方圖的坐標軸皆加右／上正方向箭頭；投影座標、數據、配分rv3、保存mv5及旋轉手勢不變。範圍為index/styles/main、既有瀏覽器回歸及交付；無新入口／依賴。
- 執行focused source及解壓SCORM瀏覽器檢查：320–393px手機及桌面、點數與足夠提示同列、按鈕外觀／啟用切換、三種圖的箭頭方向。重建包並同步原私人Site；不重跑與此修改無關的完整旋轉／保存／Moodle驗證。

### 圖表工具列驗證

- focused browser source及解壓SCORM檢查通過（320×500、393×734、1280×800）：開始／暫停按鈕切換及啟用／停用文字對比≥4.5；點數與足夠提示同一列並不碰按鈕；簡短說明預設收起。力–力、正負角速度及角速度平方圖的SVG端點與marker皆核對為向右／向上。無瀏覽器例外。截圖output/playwright/centripetal-{source,package}-graph-*.png。
- main／browser driver語法及check:tests通過（263 entries）。變更已連同既有browser driver登記，不新增測試入口；沒有重跑完整旋轉／保存與真機Moodle。
- 重建SCORM17檔，16個runtime與canonical sim及Site dist逐位元組相同；ZIP SHA-256：004ebba470e2439cdb4b6f7da5665112f36610e5f08374b166d42bf740ff8439。rv3／mv5及運動實現未改。

### 圖表工具列 Site v19 交付

- 功能commit 76906fdfadafb84f449998be33f3a82dbe5e0cfa已推至origin；committed selection由6e5fdcb起算，mode=affected、packages僅本活動，output/centripetal-graph-controls-selection.json。第一次selection漏設NODE_PATH，改用現有workspace依賴後成功，沒有新增依賴。
- 官方helper推送Site source 3dd6d11753cf05ec49db69b635be04b885e71276；v19 appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_f0fe46a96e008191b835314f5fef448c，deployment appgdep_6adac6730a848191932c8199274b5613，Sites回報succeeded（2026-10-23T02:29:14.480574+00:00）；原owner-private audience保持。
- 原站reload確認新簡短說明，實際以鍵盤推轉、按開始測量及按住減速新增13點；「13點 ✓足夠」同列，開始／暫停測量是清楚實色按鈕，右／上箭頭可見。截圖C:/Users/frens/Documents/Projects/simlab/output/centripetal-graph-v19.png；保留量測頁可繼續操作。暫時分頁快取設定已恢復，本次沒有改viewport，臨時憑證已清除。未重跑全手勢回歸及真手機／Moodle。

## 擬合線可見性與結果精簡（2026-10-23，動工前決策）

- 使用者截圖顯示擬合後只有密集點，並要求不顯示RMSE。根因是擬合線先繪製，再被實心點覆蓋；改為點後繪製橙色線、固定3px螢幕線寬。線性、正負角速度二次及平方圖共用此修正；公式刪除RMSE顯示。
- 範圍僅main繪圖／結果、既有browser回歸及交付；數學擬合、原始數據、保存mv5、評分rv3不變。檢查來源及解壓SCORM的手機／桌面與密集點案例，斷言曲線有效且層級在所有點之上，公式沒有RMSE；不重跑全手勢及真Moodle。

### 擬合線驗證

- focused來源及解壓SCORM瀏覽器檢查通過：320×500、393×734、1280×800，線性、二次及角速度平方擬合path有效，畫在所有圖點之後，固定3px螢幕線寬；結果公式沒有RMSE／均方根誤差。來源與包均實際量得超過96點，密集點擬合仍通過；數據提交保留所有量測。無瀏覽器例外。
- 瀏覽器截圖確認橙線清楚穿過藍點，output/playwright/centripetal-{source,package}-visible-fit-*.png及96-points-390x600.png。main及driver語法、check:tests（263 entries）通過；新斷言納入既有driver，無新入口。沒有重跑完整拖動／保存與真手機／Moodle。
- SCORM17檔，16個runtime與canonical sim及Site dist逐位元組相同；ZIP SHA-256：bc809f5ab007902afd45f3fb6b4ddaa426b3408362240670d096410706896bcf。數據、擬合計算、mv5及rv3未改。

### 擬合線 Site v20 交付

- 功能commit 61ca8d523384b91f38969591f0572d69afa3f5e3已推至origin；committed selection由2e4820c起算，mode=affected、packages僅本活動，output/centripetal-fit-visibility-selection.json。
- 官方helper推送Site source f0f737306ebc19c149fabe46768220b3b6d88a91；v20 appgprj_6ad9b25e7b4c8191987acc391bcc66de~appgver_4cfc3825098c8191a0104fbc56afee8c，deployment appgdep_6adacb8a57408191ab50fe956754f2f7，Sites回報succeeded（2026-10-23T02:50:56.643605+00:00）；原owner-private audience保持。
- 原站reload後實際推轉、量測26點及擬合；橙線清楚在藍點上方，公式為F_A=1F_B+0N，沒有RMSE。已開回擬合圖並保留可操作分頁，截圖C:/Users/frens/Documents/Projects/simlab/output/centripetal-fit-v20.png。暫時分頁快取設定已恢復，未改viewport，臨時憑證已清除。未重跑完整旋轉手勢／保存或真手機／Moodle。
