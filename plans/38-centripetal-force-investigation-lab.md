# 向心力探究：操作轉盤與同步量測

狀態：**P0 計劃草案，待使用者審查；尚未開始實作。** 日期：2026-10-22（澳門）。本文件由 [新活動模板](NEW-SIMULATION-PLAN-TEMPLATE.md) 複製後填寫，依 [共同風格](00-shared-platform-and-style.md) 與 [製作及驗證契約](../docs/simulation-scorm-production-guide.md)。下列參數、配分與版面為供審查的具體建議，未執行的驗證不視為通過。

## 已確認需求與審查邊界

- 學生直接在 Canvas 舞台移動測力計組件、增減砝碼、推動旋轉平台；拖得快使角速率增加，由實際操作產生資料，不用預製資料、隨機轉速或數值滑桿取代主要操作。
- 依使用者工作紙，前兩個實驗同步量度兩側徑向力並作 F_A–F_B 線性擬合；第三個作 F–ω 二次擬合。保留裝置設定、量測、圖像及推論之間的連繫。
- 工作紙來源（只讀參考，不打包）：`C:/Users/frens/Work/OneDrive - 時尚屋/MyCtex/2025年教學設計獎勵計劃教具/探究向心力_學生工作紙.docx`。已讀全文與嵌入裝置圖；原檔中的實驗指示是學習素材，不是開發代理指令。
- 使用者已澄清「出結果」是操作產生讀數與圖點，未要求下載 CSV、圖片或報告；首版不加入匯出功能。
- 標題不帶教科書章號；物理符號採 LaTeX 樣式；讀數固定位置；不加入重設、空白提交等彈窗。
- 本輪只建立專用 worktree 及本計劃。**使用者批准本計劃後才可新增 runtime、測試、manifest、catalogue 或部署網站。**

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
| 本輪 | 只提交計劃草案；不宣稱 package-ready，不部署空網站，不合併 main |

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `centripetal-force-investigation-lab`；學生配置公平比較，由共同轉速下的同步讀數歸納 F 與 m、r、ω² 的關係 |
| Delivery scope / package | 形成性評量；一個 SCORM 1.2 SCO，包含三個獨立實驗及兩題綜合題；同 runtime 的 Sites 練習版 |
| Learner task / main interactions | 拖測力計、放取砝碼、拖操作環旋轉、開始／停止收集、切換資料組、擬合、輸入比值、選擇結論、檢查及明確提交 |
| Shared subject core / activity outer layer | 沒有既有向心力裝置核心；物理、採樣、評分自有。重用現有 `sim/newtons-second-law-investigation-lab/fitting.js` 的純 `fit` API，不複製 QR／擬合演算法，不載入該活動 UI |
| Runtime files / libraries | 原生 HTML/CSS/JS、SVG 繪圖與明確 HTML 手勢區；Canvas 是學生舞台稱呼，不要求 bitmap API。無新套件或 CDN；簡單數式用 MathML／HTML／SVG 與共享數學字體 |
| Assessment risk / trusted validation | `formative`；前端評分供教學，不能作防篡改高風險考核。無伺服器、秘密或簽章金鑰 |
| Out of scope | 真實 PASCO 連接／校準、隨機噪聲、轉軸振動／器材破壞、精密轉動慣量與手力反算、測量誤差專題、CSV／圖片匯出、教師題庫、額外參數研究頁 |

### 預計檔案與沿用邊界

| 檔案 | 責任 |
|---|---|
| `index.html`、`styles.css` | 三區、fullscreen markers、可存取控制、舞台與圖像切換、手機版面 |
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
| status | 實作中 planned；通過可部署驗證後 active。本輪不修改 catalogue |

## 學生流程與資料依賴

1. 開啟是停止的共同旋轉平台，A／B 固定圖例、兩側測力計與樽蓋，尚無資料與答案。選「半徑／質量／角速率」可直接切換，各保留工作。
2. 題目只給研究目標；學生選改變量及保持不變的量，在舞台配置兩側裝置。不得按題目自動調成公平設定。
3. 「開始收集」建立一個固定裝置配置的資料組。手指拖操作環，平台角位移連續改變；放手慣性續轉。顯示固定欄位的 ω、F_A、F_B 與小型即時散點圖。
4. 「停止收集」保留圖點並停止實驗時間；切到大圖，按「擬合」取得本組真實擬合結果。半徑／質量頁為線性（含截距），角速率頁為二次（含一次項及常數），不強制過原點。
5. 學生算比值／倍數、比較擬合、選有控制條件的結論。實驗一／二另可換比例開第二組比較；不是完成門檻。
6. 「檢查」始終可達，包括停止未推動、空資料組、未擬合或全空白。明確提交後才給分及完整物理解釋。

| 實驗 | 正確裝置條件 | 圖像（固定軸次序） | 提交後理論解釋 |
|---|---|---|---|
| radius | m_A=m_B，r_A≠r_B；整組配置不變 | x=F_B，y=F_A | k=r_A/r_B；共同 ω 可隨時間變，每次同步比較 ω_A=ω_B |
| mass | r_A=r_B，m_A≠m_B | x=F_B，y=F_A | k=m_A/m_B |
| omega | 選定 A 作被測組件，m_A、r_A 在組內不變；B 保留在平台 | x=ω，y=F_A | F=aω²+bω+c；理想 a=m_A r_A，b=c=0；a 是擬合係數，不是加速度 |

工作紙「控制 ω」解釋為前兩組每對 A/B 同時具有相同角速率，不是整段採樣永遠一個轉速。兩側同平台約束自動成立；學生仍需辨認相等條件。另一側器材保留與工作紙一致，但不聲稱任意配置都完全動平衡；首版假設轉軸固定且忽略晃動。

## Physics or subject model

| State variables | Update rules / formulas | Units | Calibration constants |
|---|---|---|---|
| 基礎被測質量 m_0 | 樽蓋＋螺絲合計，兩側相同；不含測力計外殼 | kg | 草案 0.040 |
| 砝碼數 n_A、n_B | m_i=m_0+0.020n_i；n_i 整數 0…8 | kg | 每塊 0.020，總質量 0.040…0.200 |
| 半徑 r_i | 軸心到被測組件質心；尺上離散位置 | m | 0.10…0.40，每格 0.05，共 7 格 |
| 初始配置 | 三頁均 r_A=r_B=0.20、n_A=n_B=2；不預造半徑／質量差異 | 同上 | 預設不構成前兩頁完整有效對比 |
| 轉角 φ、帶符號轉速 Ω | 拖動期間由連續展開的觸控角與時間得到；放手 φ 增量=ΩΔt | rad、rad/s | |Ω|上限 6；新開平台 Ω=0；ω=|Ω| 作圖，轉向獨立顯示 |
| 徑向讀數 | F_i=m_i r_i ω²；同一採樣的 ω 同時計算兩側 | N | 無噪聲；原始運算保留精度，顯示三位有效數字 |
| 加速期間 | 徑向加速度 rω²、切向加速度 rα | m/s² | 感應器理想化為只讀徑向分量；固定裝置傳遞切向作用，不把量測值稱總合力 |
| 擬合 | 現有 fit('linear'/'quadratic', points)，使用保留樣本重建的未顯示捨入讀數 | 隨軸 | 奇異／不同橫座標不足回傳無結果，不能注入理論係數 |

### 推動、續轉與中斷

- 使用可見操作環的分段 HTML 命中區（12 段、局部 44px 觸控厚度）；環內空白不接管。接觸時記錄相對角，不跳到手指絕對方位；跨 ±π 連續解包。
- 每個有效事件以不大於 120ms 的最近角度窗口估算 Ω；不足兩個有效時間樣本不製造速度。零時間、非有限值、超過 120ms 的事件空檔不反算極大速度。上限是虛擬裝置上限，須以限速後角位移驅動畫面與讀數，不能畫面很快而數值被單獨截斷。
- 手勢角增量大於可連續辨認界限時停止該段估算，保留前一合法速度，頁內提示慢一點重推；不得把跨圈別名誤判反轉。拖到中心附近時保留角度，避免 atan2 奇點。
- 有效放手沿最後實際 Ω 慣性續轉；只點一下無角位移不加速。重新觸碰、減速、反轉均連續；不按手指壓力猜物理扭矩。
- 「停止／設定」令模擬時間暫停；畫面可回到水平設定姿態，明示設定狀態，並非聲稱小球實際受巨大制動。m、r 只在設定狀態可改。
- 切頁、檢查、失焦、隱藏、pointercancel、失去 capture 或第二指介入均安全暫停；不在背景補採樣、不突然續轉。操作環的已接受歷史樣本保留；未放下的砝碼／半徑拖動回滾。
- 鍵盤替代：聚焦操作環，左右鍵按時間改 Ω、Space 暫停；走相同模型與採樣。不給任何數字滑桿作主流程，也不按手勢熟練度給分。

### 採樣、資料組與擬合

- 點「開始收集」才建立 run 並固定 cfg；動畫有動但未收集時不產生評分資料。ω=0 可顯示原點，不把它自動當學生記錄。
- 記錄解析度為 0.001 rad/s：接受真實操作得到的 ω 後轉為整數 q=round(1000ω)，q∈[250,6000]，以 q/1000 作該次權威量測值。F_A、F_B 由同一 q 與凍結 cfg 推得。
- 以 0.25 rad/s 間隔分成 24 個採樣槽；每槽保留第一個真實樣本，6.000 歸最後槽。不把資料換成槽中心，不插值補足未經過的轉速，不按幀數生成假點。停留在同速只更新 live 讀數。
- 每頁最多兩個 run，每組最多 24 點；預計完整資料最多 144 個整數。開始另一組前停止現組；已有兩組時須由學生明確刪除一組，不能自動丟棄舊組。
- 修改 m／r 只改下一組 working cfg，不覆寫任何舊 run；當前作答及擬合都綁定 run。使用者選定的評分資料組另以 selected 索引保存，切換看圖不暗換評分組。
- 擬合可在數學上可識別時執行：線性至少 2 個不同 x，二次至少 3 個不同 x；充分採樣得分另見 rubric。繼續採樣後舊擬合標記清除，已填結論保留並頁內提醒重新比較，不彈窗。
- 原始圖點由量測資料生成，不可拖動到理論線上。曲線沒有資料時不預畫；錯誤配置仍畫其真實結果。半徑與質量頁即使同時變兩量也可能有直線，須透過設定評分與 k 的解釋辨認混雜。

## Responsive layout contract

| Decision | Activity specification and reason |
|---|---|
| Three regions | 頁首：無章號標題、三實驗導航、檢查及 fullscreen；舞台：裝置／大圖；面板：記錄、組別、擬合與作答 |
| Fullscreen | 外層 main 標記 data-sim-fullscreen-target，header 標記 data-sim-fullscreen；重用 shared/fullscreen.js，預留右上 44px，不手寫第二個按鈕 |
| Desktop / tablet | ≥900px，舞台 1fr、面板 340px（最多可用寬的 34%）；裝置與 live 圖並列。桌面圖例至少 20px，讀數 22px |
| Classification | bounded split-panel；看裝置／圖時仍需操作面板，面板獨立捲動 |
| Phone | 依 production guide 的 44dvh 舞台起點調整，正常直向舞台 44dvh、面板取剩餘。320×500 目標面板可見 ≥144px，硬下限 ≥96 CSS px；若頁首變高，先改緊湊任務選單、縮減非必要圖內文字，不縮按鈕 |
| Short viewport | 高≤400 且寬≥480 用左右欄；更窄保留 ≥96px 面板，裝置／圖像只顯一主視圖。200% zoom 重新排列，不靠整頁橫捲 |
| Phone text | 控制／正文 18px，必要圖標 16px 實際縮放後，讀數 20px；44px 操作目標，公式真上下標，數字固定等寬欄 |
| Viewports | 320×500、390×500、390×600、390×844、480×320、320×225、1280×800；工具列／鍵盤／200% zoom 均待驗 |
| Scroll topology | 活動根文件 bounded 無可用垂直 range；panel 原生 contained scroll；舞台空白原生 pan-y 傳到真正宿主 owner。不得修改 parent overflow 或鎖宿主 |

手機收集時以裝置為主，小圖不要求讀細刻度；停止後大圖可切回原裝置，資料不變。正常頁首與面板高度須實測，44dvh 是指引起點不是已驗收比例。

## Navigation, submission and reset

| Decision | Activity specification |
|---|---|
| Navigation | mixed：三個實驗彼此獨立；單組設定→採樣→擬合有真資料依賴。圖像空白亦可觀看或進檢查，不捏造前置答案 |
| Final check | 所有 editable 子模式可到 check；先暫停運動，結束可提交手勢／回滾未完成裝置拖動，保留已接受資料 |
| Incomplete submission | 顯示未答項、無資料／未擬合的中立狀態；全空白可明確提交零分 |
| Editable reset | 按鈕明示「清除此組資料與答案」或「清除此題」；直接執行、不開 alert/confirm；不波及其他題。無重抽隨機題功能 |
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
| Notation | m、r、ω、F 均表示大小；運動方向另以圖示標記。F_A/F_B 下標固定，ω 是角速率非帶符號 Ω。單位直立，數學字體依 baseline；不向學生顯示 raw LaTeX |
| Arrows | 如顯示感應器量測方向，用單一實心箭頭及明確「徑向讀數」，不加第三個物體／額外合力；固定 A/B 圖例，不跟轉動 |
| Radius snap | 沿尺投影到合法格，連續預覽後放手保持；可見格的最近點、touch 12px／mouse 8px 門檻；相鄰格不足 24px 時提供放大讀尺與 ± 按鈕，不暗吸到本題正解 |
| Mass snap | 砝碼 drop 到可見樽蓋目標，touch 18px／mouse 10px 局部距離；未命中回工具盤，n 到上限不多加；增減按鈕等效 |
| Touch preview | 半徑拖動需要，顯示軸心方向、尺格、被測質心及當前 snap，2× 放大、固定無遮擋角；砝碼與大操作環不需精密預覽，因為只判目標／轉動，不考手指微小角度 |
| Graph | A/B 散點以共同資料生成；固定 x=F_B、y=F_A，顯示 N；ω圖顯示 rad/s 與 N。刻度選正常數，不把不同組各自變形後疊成同一線 |

## Touch gesture ownership contract

以下為預定 selector／拓撲，實作後填實際命中點及證據，不能把名稱當作已通過驗證。

| Target / modes | Visible footprint / hit region | Capture / touch-action | Keyboard |
|---|---|---|---|
| 操作環／collect | `.spin-segment` 12 個環形分段，44px 局部厚度，環內空白無 overlay | 穩定 HTML 節點，none 在 down 前已設；旋轉不重建捕捉元素 | 左右鍵改速度、Space 暫停 |
| A/B 半徑把手／setup | `.radius-handle[data-side]` 可見手柄＋44px 局部範圍，不覆蓋全尺 | 穩定 HTML，none | 左右鍵移一格 |
| 砝碼／setup | `.mass-token` 44×44；已放砝碼同樣可取回 | 穩定 HTML，none；拖曳副本不接事件 | 選 A/B，± 加減 |
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
| collect，0點／部分點／24點 | 由 setup 開始→可信推動→放手 | 環各象限、跨π、重抓、反向、快速flick；空白不得變速度或採樣模式 | 同上 |
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
| 實際公平配置 | 4 | selected run 至少有兩個不同樣本；r頁等質量且異半徑，m頁等半徑且異質量；ω頁組內凍結 m/r 且實際有改轉速。角色答錯不連坐 |
| 資料範圍 | 4 | 至少3個不同槽且 ω跨度≥1.0 rad/s 得4；至少2槽且跨度≥0.5得2；其餘0。資料不公平仍可得真實採樣部分分 |
| 定量比較 | 4 | r/m頁輸入 selected cfg 的 r_A/r_B 或 m_A/m_B；ω頁填「角速率加倍時力的倍數」4。數值正確可獨立得分，不能預填 |
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
| collect/partial/full | current run 含1…24唯一槽樣本 | 角色與概念答案可有可無 | 還原後暫停，繼續推動／停止／check |
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

用 shared makeSnapshot envelope，活動 answer schema v1 / modelVersion1 / rubricVersion1。以下名稱與範圍是實作契約，不是 runtime 已存在。深層拒絕非法參照／非有限值／未知版本；錯誤物理答案不是壞資料。

| Field | Exact type / values |
|---|---|
| `v,mv,rv` | 各為整數1 |
| `seed` | uint32；只控制選項排列，不控制學生轉速 |
| `page,view,fromReview` | page=0…2；view 上表enum；boolean |
| `returnTo` | null 或 [page,setup/collect/analyse]，collect/analyse須有合法current |
| `tasks` | 固定3個 T，依 radius/mass/omega；不得缺頁或多頁 |
| `T.work` | [rAIndex,rBIndex,nA,nB]，前二0…6，後二0…8整數 |
| `T.current,T.selected` | null 或本T.runs的有效索引；刪組後重映；資料有但未選評分組合法 |
| `T.roles` | [自變量key或null,控制量key陣列或null]；控制量最多2且不同；錯誤角色合法 |
| `T.runs` | 0…2個 R |
| `R.cfg` | 同T.work型別，run成立後不可變 |
| `R.q` | 0…24個整數250…6000，按獲取次序、槽不得重複；力從cfg/q重建 |
| `R.fit` | boolean；true須線性／二次資料可識別且與頁相符 |
| `R.a` | [定量輸入字串或null,比較key或null,理由key或null]；字串≤12；選項按各頁字典驗證 |
| `T.law` | null或本頁關係選項key；不綁資料組，不被刪組清掉 |
| `sync,massParts` | 各null或綜合題字典key；支持零分但完整語意的錯答 |

| State category | Treatment |
|---|---|
| Authoritative | cfg、真實接受的q、角色／各組答案／結論、selected/current、view/returnTo/fromReview、seed及版本 |
| Transient | 連續φ/Ω、rAF時間、指針窗口、drag preview、capture、hover、fullscreen；草稿還原一律暫停，不補背景時間 |
| Derived | F讀數、fit係數、圖點座標、DOM ids、score、選項排列、按鈕狀態；由已驗權威資料重建 |
| Size | 6組×24整數為上界；以最長合法輸入及shared envelope/result實測draft/review/有效pending均≤4000 UTF-8 bytes。超標先縮DTO重複key，不刪學生資料、不降低精度 |
| Versions | v1前無歷史格式；未知版本拒絕，不猜測遷移。模型或rubric變更須版本決定與測試 |
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
- [ ] 採樣：未開始不記錄、只收真實值、同槽不堆點、24槽上限、0/250/6000界線、暫停隱藏不補樣、改cfg不覆寫舊組、第三組不得默刪；擬合奇異與實際錯配置。
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
| Helpers | 首版不另設helper；若實作真的拆cases，須以規定檔名與literal import登記consumers，不能漏掃 |
| Manual gates | 既有mobile-scroll manual runner增加本slug矩陣；T4真Moodle／手機為另行部署驗收，不冒充日常CI |
| Registration check | 待實作後 `npm run check:tests`，記錄結果與log；目前沒有新測試可登記 |
| Committed preview | 待runtime commit後 `npm run test:affected -- --base=<實際main SHA> --head=HEAD --plan`；初次catalogue/registry變更預期full，核對browser及package被包含 |
| GitHub | 待測SHA、run URL、scope及結果；使用者不用等CI才收本地結果，不把pending稱passed |

## 實施階段與交付

| 階段 | 工作與退出條件 |
|---|---|
| P0 本輪 | 完成本計劃、worktree、文件檢查並提交草案；停止等使用者審查 |
| P1 批准後 | model／角色與rubric／schema及純測試先行；用真實狀態矩陣驗證，不先寫整個UI再補生命週期 |
| P2 | 三區＋直接拖動＋收集／圖像／擬合；先驗手機手勢不被空白層吞掉，再連評分與shared flow |
| P3 | catalogue、manifest、registry、source與package、fullscreen、完整T0–T3；新活動按guide跑初次全套 |
| P4 | 可試用版本commit/push後，讀Sites skill並建立此活動獨立站點；只部署manifest runtime，保留私人來源／owner-only存取慣例，核對實際設定，不沿用另一活動project id |
| P5 | 真實Moodle與手機驗收；若環境未提供，清楚標為package-ready待Moodle，不能勾選未驗證項 |

部署每輪記錄 branch SHA、runtime檔案清單及hash、Site project/version/deployment id、存取範圍與可用網址；不打包工作紙或個人路徑。部署指南屬執行前需重新核對的服務規格，本輪不建立站點。

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

本節只記本輪文件結果；所有runtime、package、Moodle及Sites驗收仍未執行。

| P0 項目 | 2026-10-22 證據 |
|---|---|
| Worktree / branch | 已由記錄的共同main SHA建立，只有本計劃列入變更 |
| Template | 與原模板逐一比較，全部14個二級節均保留並填寫；另補學生流程、手動旋轉模型與實施階段 |
| 文件連結 | `node tools/check-docs.js plans/38-centripetal-force-investigation-lab.md` 通過，無略過連結 |
| Diff | `git diff --cached --check` 通過，staged範圍只有本計劃；不將文件通過視為runtime證據 |
| 待審重點 | 直接拖轉手感、每題最多兩組／每組24點、三項實驗與100分rubric、正常短手機panel目標144px、擬合重用既有純函數 |
