# 誰提供向心力：受力分析與圓心方向

狀態：**依使用者 2026-10-22 審閱意見重做動態情境與畫力操作；本地與部署證據見文末。** 由 [新活動模板](NEW-SIMULATION-PLAN-TEMPLATE.md) 複製後填寫，遵循 [共同風格](00-shared-platform-and-style.md) 及 [製作及驗證契約](../docs/simulation-scorm-production-guide.md)。P0 草案及前版驗證屬歷史記錄，不能代替新版驗收。

## 已確認需求與審查邊界

- 第二個新活動研究「甚麼實際作用力提供向心力」，與操作轉盤的定量探究分成獨立 SCORM。
- 六個正式情境：水平細線牽引小球、物體隨水平圓盤轉動、圓錐擺、拱形路面最高點、凹形路面最低點、地球繞太陽。後兩者是使用者明確要求，不能降為只讀可選延伸。
- 每題主線：辨認圓心方向 → 建立實際受力圖 → 判斷徑向合力關係。向心力不是額外新增的實際作用力。
- 標題不標章號；數學符號採 LaTeX 樣式；圖例清楚、手機 panel 可用、沒有空白提交／重設彈窗。
- 已有圓周活動處理切線速度及加速度方向，本活動以它們作前置概念，不再重做完整 Δv 推導。
- 參考教材：使用者提供的 `C:/Users/frens/Work/OneDrive - 時尚屋/澳門坊眾/Textbooks/S1-3/【人教版】高中必修 第二册物理电子课本.pdf`，印刷頁27–32、35–38。教材不放網站或package。
- 使用者其後明確指示在獨立 worktree 按本計劃製作全部內容；此指示授權 P1–P4 的程式、測試、打包與獨立 Sites 部署。P5 仍需真 Moodle／真手機環境。

## Worktree 與交付節奏

| 項目 | 決定 |
|---|---|
| Worktree | `C:/Users/frens/.codex/worktrees/centripetal-force-source-lab-1447/simlab` |
| Branch | `codex/centripetal-force-source-lab` |
| Base | main：`4aa4d50680f9c757b932e7db08be118f80142950`，與另一新活動同起點 |
| Remote | origin，`https://github.com/frenselw/simlab.git` |
| 自有範圍 | 本計劃、`sim/centripetal-force-source-lab/`、本slug manifest、專屬browser driver |
| 共同編輯點 | catalogue、test-registry、mobile-scroll活動登記及完成時README；只增本活動條目，整合時保留其他worktree內容 |
| 開發資源 | 建議埠4382、browser session `centripetal-source`；佔用時選空閒埠，不終止其他服務 |
| 每輪完成 | 相應驗證→commit→push本分支→可試用runtime部署本活動獨立Sites。按使用者要求不等CI才回報；CI待跑／失敗須如實標示 |
| 本輪交付 | 六情境獨立 SCORM、專屬測試及獨立 Sites；依實測結果判斷 package-ready，不改 main |

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `centripetal-force-source-lab`；由運動軌跡找徑向，辨認實際外力、區分力與合力／分力、建立向心力來源關係 |
| Delivery scope / package | 形成性SCORM 1.2，六個可直接切換的情境及一題共同概念；Sites同runtime練習版 |
| Learner task / interactions | 觀察／定格、選圓心方向、選力種類及施力來源、拖箭尖、刪除／改種類、選關係式、對照拱／凹、檢查提交 |
| Shared subject core / activity outer layer | 現有受力作圖活動未提供通用mount核心；沿用其箭頭、snap、preview設計但不搬整份controller。情境資料、權威力集合、評分及snapshot由本活動擁有 |
| Runtime files / libraries | HTML/CSS/JS＋SVG，HTML局部命中區；不新增依賴/CDN；共享styles/scorm/activity-flow/fullscreen，簡單數式使用原生MathML/SVG數學字體 |
| Assessment risk | formative，前端評分；高風險可信伺服器驗證不屬此版，無秘密 |
| Out of scope | 自由三維鏡頭、整段非勻速橋面動力學、離地／打滑後軌跡、橢圓軌道及N體、萬有引力數值運算、受力箭長比例評分、重做完整速度／加速度推導、教師編題器 |

### 預計檔案與參考

| File | Responsibility |
|---|---|
| index.html、styles.css | 三區與六情境導航、fullscreen、可讀數式、手機舞台及panel |
| model.js | 題庫definition、合法幾何與物理條件、實際力集合、方向與關係字典 |
| main.js | 場景、箭頭編輯、指針／鍵盤、preview、shared生命周期，無直接LMS API |
| scoring.js | 一對一配對、缺漏／額外力、方向容差、關係式及整合題分數 |
| persistence.js | v2定義、v1遷移、深層驗證、還原、受力圖與canonical答案 |
| scene.js | 六個SVG情景、運動相位、車輛位置及下一次橋頂／凹底目標 |
| ui-runtime.js | shared startup／submission 的活動控制器、鎖定與retry |
| tests | model.test.js、scoring.test.js、persistence.test.js、interaction.test.js、lifecycle.test.js |
| browser | tools/centripetal-force-source-browser-regression.js；同driver跑source及解壓package |
| manifest | sim/manifests/centripetal-force-source-lab.xml；七自有runtime檔＋四shared依賴 |

閱讀參考：[既有受力圖](21-force-equilibrium-diagram-lab.md)、[圓周方向活動](37-circular-motion-vector-lab.md)。前者的圖長不評分與手機預覽適用；後者的方向表達可沿用。不能把平衡題的「合力為零」或先前活動的歷史尺寸直接搬入本模型；本活動不依賴它們的runtime／測試資料。

## Catalogue metadata (`sim/config.js`)

| Field | Planned value |
|---|---|
| title | 誰提供向心力：受力分析與圓心方向 |
| folder | centripetal-force-source-lab |
| categories | Mechanics |
| description | 在六個圓周運動情境中畫出實際作用力，辨認圓心方向並建立向心力關係。 |
| tags | physics、mechanics、centripetal-force、free-body-diagram、circular-motion、scorm |
| status | 實作時planned，可部署後active；P0不新增catalogue條目 |

## 學生流程與情境

1. 直接開第一情境，短循環動畫表示運動，預設無答案／受力箭頭。六情境按固定教學次序導航，不依答對解鎖。
2. 一般情境按「畫受力圖」保存目前觀察位置；橋題按「分析車在拱橋頂部時」／「分析車在凹路最低點時」，等待汽車下一次到達指定點才顯示作答區。學生選力後從物件拖出箭頭，或用加入鍵和方向按鈕；已作答題的保存位置不隨重播而改變。
3. 選圓心方向；它是明確答案，初始null。圖中可見軌跡／圓心是物理證據，但不預填標準向心箭頭。
4. 從力的種類／來源選單選一項，按「加入」，由物體重心產生待定方向標記。拖箭尖或鍵盤定方向；沒有方向的力屬合法部分答案，不冒充完成。
5. 回答「哪些實際作用力或分量提供向心力？」用情境專屬的關係式選項。它不依賴前項是否答對，不從學生錯圖反算物理運動。
6. 切題保留草稿；檢查頁顯示六題完成／未答及圖，不顯正誤。任何空白／部分狀態可明確提交。
7. 提交且結果可信後，對照學生圖與參考圖；先保留實際作用力，在獨立合成示意中顯示徑向合力，不把它當第三／第四個外力。

### 六題定義與物理條件

| ID / 情境 | 呈現與限制 | 實際力（本表為教師答案） | 正確關係 |
|---|---|---|---|
| string 水平細線小球 | 光滑水平桌面，細線水平、拉緊，等速繞固定點；俯視演示→徑向豎直剖面分析 | 地球重力向下、桌面支持向上、繩拉力水平向圓心 | F向=T；N=mg |
| disk 隨水平圓盤 | 物體隨盤等速且不相對滑動；表面有足夠靜摩擦；同類剖面 | 重力下、支持上、靜摩擦水平向內 | F向=f_s；f_s≤μ_sN，不預設總等於最大摩擦 |
| cone 圓錐擺 | 單懸點、繩長L、θ相對豎直；水平等速圓周 | 重力下、拉力沿繩斜向懸點 | F向=T sinθ；T cosθ=mg；拉力與重力合力水平向內 |
| crest 拱橋頂 | 汽車最高點瞬間，忽略空氣阻力與驅動／制動，仍接觸橋；圓心下方 | 重力下、橋支持上 | F向=mg−N=mv²/r |
| trough 凹路底 | 汽車最低點瞬間，同樣忽略水平驅動／制動，仍接觸；圓心上方 | 重力下、路面支持上 | F向=N−mg=mv²/r |
| earth 地球繞太陽 | 太陽近似固定，地球按圓軌道等速；示意尺寸與時間不按真實比例 | 太陽對地球引力，指向太陽 | F向=F引；可解釋等於mv²/r，首版不考萬有引力計數 |

拱／凹是兩個正式評分題；頁首提供相鄰切換，兩題畫面與作答各自保存。圓心位於畫面外時用虛線半徑及「圓心方向」位置關係提示，不能為了顯示完整圓而把車／箭頭縮細。

### 重點迷思與回饋

| 錯誤 | 提交後解釋 |
|---|---|
| 重力／拉力之外再加向心力 | 向心力是徑向作用效果的名稱，不是另一個施力物體帶來的額外外力 |
| 靜摩擦一律向後 | 靜摩擦可提供向內加速度；方向須看維持不滑動所需的作用，不是單看物體相對地面速度 |
| 圓錐擺用整個T | T包含平衡重力的豎直分量；向內的是T的水平分量，亦是T與重力的合力 |
| 拱／凹都寫mg−N | 先找圓心；最高點向下，最低點向上，沿向內方向列合力 |
| 地球額外有離心力／向心力 | 本題採近似慣性的太陽參考框架；太陽引力已提供所需徑向作用，不另添力 |
| 把地球對太陽引力畫在地球上 | 研究對象是地球，受力圖只畫作用在地球上的力；反作用力作用在太陽 |
| 認為任何圓周運動合力都向內 | 等速時全合力向內；一般變速時只有徑向分量提供向心加速度。橋題只分析指定頂／底瞬間 |

圓錐擺的「T與mg的合力」及「T的水平分量」都是正確說法，單選題合併成同一正確選項，不能同時設成兩個互斥候選。結果演示只使用權威模型比例，不用學生隨意箭長合成出偽物理。

## Physics or subject model

| State variables | Rules / units | Parameter decisions |
|---|---|---|
| 重心與圓心方向 | 每題以物體重心為作圖原點；方向用數學座標x右y上，畫面映射翻轉y | string/disk/cone左右鏡像；crest固定向下、trough固定向上；earth取8個45°等分位置 |
| string | T=mv²/r，N=mg | m∈{0.10,0.20}kg，r∈{0.30,0.45}m，v∈{0.60,0.90}m/s，g=9.8m/s² |
| disk | f_s=mv²/r，N=mg；f_s≤μ_smg | m同上，r∈{0.30,0.40}m，v∈{0.50,0.70}m/s，μ_s=0.5；驗所有組合不滑動 |
| cone | r=L sinθ，T=mg/cosθ，ω²=g/(L cosθ)，v=ωr | m∈{0.20,0.30}kg、L∈{1.0,1.2}m、θ∈{25°,35°,45°}；先抽m/L/θ再派生，不獨立亂抽r/ω |
| crest/trough | v=λ√(gr)，N頂=(1−λ²)mg，N底=(1+λ²)mg | m∈{800,1000}kg、r∈{20,30,40}m、λ∈{0.4,0.6,0.8}，頂N>0；此兩題共用一組參數方便對照 |
| earth | 只評向太陽引力與圓心方向；概念圓軌道F引=m_Ev²/r | 不出虛構天文數字；動畫一圈約12s只作時間加速示意，明示尺寸／時間非真實比例 |
| 學生箭頭 | 尾固定重心；類型key＋方向角＋顯示長度 | 方向0…3599（0.1°）；長度40…100為顯示單位、非N；null方向為未完成 |
| 參考箭頭 | 用模型真實方向與相對大小，採一張圖內共同尺度 | 最短箭可讀時調整整圖尺度，不能各力獨立拉長再聲稱合成 |

畫面不需要把各物理參數全部擠入題幹；模型值用於正確動畫與結果圖。橋題的演示只標示「分析最高／最低點」及當刻速度，首版不播放整段看似勻速的拱／凹行車，以免暗示額外驅動力不存在。若後續要演示完整過橋，另補能量與切向模型後才做。

演示角位相為暫態，作圖的代表位置由題目definition決定，停止後不讓重心逃離箭尾。物理錯答不改變場景的運動、引力方向或參考解。新attempt抽取definition與完整選項排列；同attempt所有頁與Moodle續作固定，不因轉頁重抽。

## Responsive layout contract

| Decision | Activity specification and reason |
|---|---|
| Three regions | 頁首：活動標題、當前情境／六題導航、檢查、fullscreen；舞台：情境與受力圖；panel：中心方向、力工具、關係式 |
| Fullscreen | main/header使用共享markers，載shared/fullscreen.js；右上44px留白，狀態訊息在完整目標內 |
| Desktop / tablet | ≥900px舞台1fr＋面板340px（上限總寬34%）；場景和作圖可並列，圖例20px；不可因空間多仍保持細小手機圖例 |
| Classification | bounded split-panel；畫圖／選式時需持續看舞台，panel獨立捲動 |
| Phone stage/panel | 以guide 44dvh為舞台初值、panel剩餘；正常320×500目標panel≥144px，硬下限96px。作圖模式以大受力圖為主，保留簡化實景、繩／表面／圓心參照；不要兩幅縮到看不清 |
| Short/zoom | 高≤400且寬≥480用左右；更窄以compact題目select及模式切換保留96px panel；最後控制可達、側帶不消失；不以小字解決 |
| Text | 正文/控件18px，必要圖字16px實際呈現，44px targets；數式真正上下標及直立單位，手指遮擋用preview |
| Viewports | 320×500、390×500、390×600、390×844、480×320、320×225、1280×800、200% zoom、鍵盤／工具列變化 |
| Scroll topology | 根文件bounded無range，panel contained scroll，舞台非互動pan-y交真宿主owner；不改parent樣式、不將舞台swipe送panel |

## Navigation, submission and reset

| Decision | Activity specification |
|---|---|
| Navigation | independent六題；同題三項亦不以正確性解鎖。circle方向可由實景判斷，不須先畫對力；關係式不依學生圖派生正解 |
| Final check | 所有editable頁、剛加入無方向力、拖動中都能檢查；未完成pointer rollback到最後committed形狀，null箭亦能提交 |
| Incomplete submission | 顯示六題／各分項已答、方向未定、未答；可全空白明確提交 |
| Editable reset | 刪選定力／清本題圖／清本題答案皆明確標範圍，直接執行不彈窗；改力種類保留方向，不自動轉向；清圖不清中心／關係答案 |
| Scored/pending | 不可畫、改類型、改方向或清結果；允許唯讀切題／學生-參考圖對照、fullscreen；pending只技術retry |

| Step | Required data | Missing / changed | Legal next action |
|---|---|---|---|
| 選圓心方向 | 題目definition | 初始null、錯誤方向合法；不能自動校正 | 改選／畫圖／關係／check |
| 加力 | 明確選palette kind | 沒選時不自動加預設正力；加入後angle=null | 拖方向／鍵盤／刪力／check |
| 改箭頭 | 有selected arrow index | null方向可首次定向；修改類型不改幾何 | 放手提交／cancel回滾／check |
| 關係式 | definition；無學生圖依賴 | 錯選保留，不因畫圖改動自動清除 | 修改／切題／check |
| 從check返回 | 保存page、mode及selected | 不需所有題已訪問 | 任一合法編輯後再check |

## Diagrams, notation and assistance

| Decision | Activity specification and reason |
|---|---|
| Notation | T、N、mg、f_s、F引、F向代表大小，方向由實際箭頭；學生式子標「我的關係」。θ從豎直量；向量合成在獨立區域解釋 |
| Arrow graphics | 一個連續實心箭形，箭尖對準canonical端點；學生箭同樣可讀但不按長度評大小。參考層不同顏色＋文字／空心，色覺非唯一區別 |
| Labels | 力名與來源（如「太陽對地球的引力」）固定列表可查；stage短符號避免碰箭頭；選中提示不遮重心或繩 |
| Snap | 同一場景所有力均可吸到可見水平／豎直、繩方向及反向、徑向及反向；不按所選kind縮成只剩正解。touch角距≤8°、mouse≤5°且端點距候選射線≤14/10 CSS px；保持拖動preview與放手一致 |
| Scoring tolerance | 與snap分開，方向誤差≤10°；可以不吸附仍正確。角度以圓周最小差，不把359°與1°當358° |
| Touch preview | 必須；首次定向／箭尖拖動／改長度時2×局部圖含重心、真實繩／表面／圓心參照及學生箭，固定無遮擋角，無參考答案；up/cancel/切題/鎖定清理 |
| Geometry assistance | null方向以重心旁「方向未定」小標及可拖handle呈現，不顯示默認向內箭；鍵盤可直接選八方向再微調1°／5°，所有方向都可選 |

第一版不要求全舞台自由起筆：先選力再拖穩定handle，減少手機精準起點負擔。保留左右可滑帶，圖本身空白不捕捉；不同箭頭端點重疊時從panel力清單選定再拖，不能因多個halo遮住整幅圖。

## Touch gesture ownership contract

預定selector及target如下，實作後須填實際命中／尺寸與可信輸入證據。

| Target type / modes | Footprint / hit area | Capture / touch-action | Keyboard |
|---|---|---|---|
| 未定方向把手 | `.force-handle[data-index]` 重心旁可見handle，44×44局部halo | 穩定HTML、down前none，首次放手才保存angle | 原生方向控制＋微調 |
| 已有箭尖 | 同selector對準真正箭尖，44px；多箭只active一個可拖層 | 固定節點，拖時不重建 | 左右1°、Shift5°、上下改示意長度 |
| 力列表選取／改類型／刪除 | `.force-row`內原生button/select | 原生、無全列透明拖層 | 原生 |
| 圓心方向／關係式 | 原生大選項 | auto | Tab/方向/Space |
| 唯讀對照與fullscreen | 原生button | 不編輯答案 | 原生 |

| Starts on | Owner | Strategy | Evidence |
|---|---|---|---|
| 場景／受力圖空白、繩間空隙 | enclosing host | pan-y、SVG非互動層不吃事件；不是全圖none | 待驗 |
| panel及其top/bottom | panel only | native contained；host/iframe/stage固定 | 待驗 |
| 左右側帶 | enclosing host | 各≥32 CSS px於320px寬，所有編輯／唯讀模式可觸及 | 待驗 |
| 未定／已定方向把手 | simulation | 固定capture，其他所有scroll/viewport不變 | 待驗 |
| 無active arrow的原把手位置 | enclosing host | 移除舊halo、preview不攔截 | 待驗 |

首版不需要全幅drawing surface或scroll adapter；普通雙指介入取消／回滾當前拖動並釋放capture，不聲稱既有none手勢可立即變成native swipe；手指全放開後新手勢按起點決定owner。若後續加入secondary-touch forwarding，須依guide使用已驗的shared機制、補manifest與單獨交接測試。

| Host | Frame chain / actual owner | Origin / path | Evidence |
|---|---|---|---|
| T0 | 直接source／解壓入口；根文件bounded，panel自有range | 無宿主range的移動N/A明示 | 待驗 |
| T1 | 可捲外層window→activity iframe | 同源原生pan | 待驗 |
| T2 | 可捲外層window→無range wrapper→activity | 真owner外層，wrapper固定 | 待驗 |
| T3 | bounded window→`#scrollOwner`可捲元素→iframe | 真owner元素，window固定 | 待驗 |
| T4 | 真Moodle current/new-window | 現場記origin/sandbox/frame chain、真正owner／scroll range | 未驗 |

| Phase / scenario / mode | Legal fixture + continuation | Required regions | Coverage |
|---|---|---|---|
| 六題初始演示／analysis空白 | production新attempt→分析／直接作答 | 實景空白、兩側帶、panel、fullscreen | 各六幾何，T0–T3 source/package |
| 加力但angle=null | 正式UI加入kind→拖方向 | null handle、重心空白、preview | 六題，不能僅用序列化假狀態 |
| 部分／完整／額外／重複箭頭 | 正式還原→改一支箭 | 每類handle、列表、重疊箭尖、留白 | string/disk三力、cone斜力、bridge兩反向、earth任意角分別驗 |
| check→return-edit | blank/partial/full→返回 | 原selected與palette、清圖、下一次拖動 | 同上 |
| submitted/committed/frozen/technical | shared真outcome或fakeLMS正式入口 | disabled halo消失，唯讀切題/對照、panel、fullscreen | 同上 |
| resize/fallback/reduced-motion | renderer簡化仍同canonical圖 | hit geometry和preview重定位、跨屏不誤編輯 | 同上 |

依 [完整驗收](../docs/simulation-scorm-production-guide.md#coverage-and-observable-acceptance) 記trusted pointer、每次move/release與20/100/400/1000ms的owner、非owner、iframe、visual viewport、canonical答案；正反向慢拖及快flick、panel邊界、cancel/lost-capture/blur/lock均驗。程序滾動只作setup，不算驗收。

## Scoring and tolerance

每情境16分×6=96，加一題「向心力是否額外實際作用力」4分，總分100，60達標，最低0。各情境內及各情境間分開給分；預設動畫與圖上的圓心不算作答。

| 分項 | 每題分數 | 規則 |
|---|---:|---|
| 圓心方向 | 3 | 明確選定，與definition的inward一致；錯/未答0 |
| 實際力種類與來源 | 6 | 正確集合有n個力，每個一對一matched給6/n；每個額外／重複學生力扣2，只在此6分項扣到0，不連坐其他分項 |
| 已匹配力的方向 | 4 | 每個正確種類且方向在容差內給4/n；angle=null或錯向該力0，其他正確力保留 |
| 向心力關係 | 3 | 正確語意key得3；不以學生前面選圓心或箭頭是否正確改變答案 |
| 綜合題 | 共4 | 正確說明向心力是實際作用力的徑向合效果，不是另加一個力 |

配對使用種類＋施力來源，若同類多支先選方向誤差最小的合法匹配，未被配對者都算extra；同一參考力不得多次得分。方向分只依唯一匹配，不因加幾十支方向試探取得優勢；每題最多6支（正解最多3），超上限以頁內文字提示。類型清單可含錯誤候選，不能把「向心力」選項直接禁掉來替學生作答。

首版 kind 字典固定9種：`earth-gravity`、`sun-gravity`、`tension`、`normal`、`static-friction`、`kinetic-friction`、`extra-centripetal`、`centrifugal`、`drive`。各名稱明列來源；例如earth題的sun-gravity才對，earth-gravity在該題是合法錯答。force palette未選=null，不會預填第一個正解。

inward為八方向key，題目幾何均支援該集合；方向作圖則連續。關係式候選為每題固定key集合：string `tension/gravity/normal/sum-all`，disk `static/kinetic/weight/extra`，cone `horizontal-resultant/full-tension/weight/extra`，crest與trough `weight-minus-normal/normal-minus-weight/sum/weight`，earth `solar-gravity/extra/centrifugal/balanced-pair`。候選完整排列由seed固定，選項字母不進snapshot。

方向容差為最小圓周差≤10°，邊界例9.9°、10.0°接受，10.1°拒絕；359°與1°誤差2°。座標量化0.1°是canonical輸入精度，不能保存後再降低精度。箭長只要在合法顯示範圍不評大小；課題沒有N數值答案，數值輸入容差N/A。分項用完整精度累加，最後顯示／上報統一round至兩位小數，pass用同一最終分數比較60，避免還原改變達標。

全空白（包括null力方向而完全沒有其他作答）不是自動滿分；若學生明確加入正確種類但未畫方向，種類部分分合法。完全 untouched 的六題空arrows、inward=null、relation=null、綜合null必須0。

## Phase/state matrix

業務phase只有 `edit/check/review`；edit/view為 `scene/analysis`；submitted/pending等由shared outcome控制。演示正在播放、指針座標與預覽不保存；恢復scene以停止畫面呈現並提供播放，恢復analysis可直接畫。

| Phase / invariant variant | Required semantic state | Absent / retained | Legal continuation |
|---|---|---|---|
| edit/new | 六題definition、六份空答案、page0、view scene | palette/selected/null；綜合null | 看圖、分析、加力、check |
| edit/analysis-empty | 任一page、view analysis | arrows=[]；inward/relation可獨立有答案 | 選kind加入／回答／check |
| edit/force-kind-only | arrows含合法kind、angle=null、len合法 | selected指該箭；可保留其他完整箭 | 拖方向／刪除／check |
| edit/partial-or-complete | 0…6合法箭，有錯答／extra仍合法 | 獨立答案不要求完成 | 改圖／關係／切題／check |
| edit/after-check | fromReview=true，returnTo與page/view有效 | 原圖／selected/palette不清 | 任一合法操作後再check |
| check/blank-partial-complete | 六份答案、綜合與returnTo | 不需要visited/allAnswered | 明確submit或返回任一題 |
| review/finished | validated canonical review＋可信shared狀態 | 編輯控件無效，但可唯讀切題 | 參考對照／fullscreen |
| shared frozen/committed | validated同一review payload | 不因動畫或切題改答案 | 原payload retry／finish retry |

| Transition | Preconditions | Effects |
|---|---|---|
| analyse / first answer | editable＋合法page | view analysis、演示停止，definition代表位置固定 |
| add force | palette明選kind、arrows<6 | 加[kind,null,60]，selected新索引；不預設正確方向 |
| commit drag | 指針仍有效、合法終點 | 量化角度到0.1°並保存顯示長度，更新draft；只改該箭 |
| cancel/secondary/blur | active drag | 回到pointerdown前canonical箭，null仍null；清capture/preview，已完成其他答案保留 |
| change kind | selected合法 | 只改kind，不旋轉或刪方向；可能由對答變錯答亦保留 |
| delete | selected合法 | 刪一箭，重建derived ids與selected索引；無dangling |
| check/submit | 任意editable含部分箭 | 停動畫、回滾未完drag、保存returnTo；submit走shared，不要求補答 |
| clear drawing | editable | 本題arrows=[]、selected=null；inward/relation不動；清本題全部則另明示 |

## Persistence contract

用shared makeSnapshot（envelope version 1），answer v2、modelVersion2、rubricVersion1。草稿與review保存同一權威答案形狀，review需足以重畫及重新評分；saved score僅比較metadata。

| Field | Exact schema / valid values |
|---|---|
| `v,mv,rv` | 2、2、1；舊1、1、1按嚴格遷移規則還原；未知版本拒絕 |
| `seed` | uint32，固定完整選項排列；物理題目由具體definition保存，不重抽替換 |
| `def` | 固定6個variant tuples，對應下面題型；以版本化definition規則驗合法組合，不重抽或用seed覆蓋；seed只控制選項排列 |
| `def[0]` | [mirror0/1,mIndex0/1,rIndex0/1,vIndex0/1] |
| `def[1]` | [mirror0/1,mIndex0/1,rIndex0/1,vIndex0/1]，另驗不滑動 |
| `def[2]` | [mirror0/1,mIndex0/1,LIndex0/1,thetaIndex0…2] |
| `def[3],def[4]` | 同一[mIndex0/1,rIndex0…2,lambdaIndex0…2]；crest/trough一對相同參數 |
| `def[5]` | [orbitalPosition0…7,direction0/1] |
| `phase,view,page` | phase edit/check/review；view scene/analysis；page0…5 |
| `fromReview,returnTo` | boolean；null或[page0…5,scene/analysis]；check需有效returnTo |
| `items` | 固定6個I，不能缺題；空白是合法I不是省略欄位 |
| `I.pose` | null 或 0–9999 整數；橋頂／凹底只准 null 或 5000；舊題null保留原方向 |
| `I.inward` | null或八方向key（E/NE/N/NW/W/SW/S/SE），錯誤方向合法 |
| `I.arrows` | 0…6個[kindIndex0…8,angle:null或0…3599整數,length:40…100整數]；重複kind合法錯答，不能decoder拒絕 |
| `I.relation` | null或本題關係式字典key；錯式合法，未知key非法 |
| `I.palette,I.selected` | null或kindIndex；null或有效arrow索引；選中狀態決定下一次操作，需存 |
| `concept` | null或綜合題key：`radial-effect/extra-force/motion-force` |

definition採具體tuples為物理權威，seed只派生選項順序；實作時採「合法組合驗證」這一路徑，不要求用seed重抽物理題目來覆蓋definition。所有新題由生成器先建立合法tuples再存，模型表版本固定各index意義。

| Category | Treatment |
|---|---|
| Authoritative | definition、每題pose、答案kind/angle/length、inward/relation/concept、palette/selected、page/view/returnTo/fromReview、seed/version |
| Transient | 未保存的播放位置／等待目標／播放、pointer狀態、未commit拖動、hover、preview、fullscreen；還原不重播中途動作 |
| Derived | reference directions/forces、diagram位置、arrow ids、文字／選項順序、score、enabled controls；重新計算 |
| Size | 6題×6箭上界；最大draft/review及有效pending連shared envelope實測≤4000 UTF-8 bytes。不存圖像、自由長文或每幀位置 |
| Version | v1嚴格驗證後補pose:null並升至v2；draft/review/pending均驗原分數不變。未知模型／rubric需technical lock，不靜默改正解 |
| Invalid editable | 首版technical load lock，不自動清除；有證據未提交的恢復才按shared契約另處理 |
| Invalid finished | 維持review-only，只顯可信Moodle摘要；不能變新題 |
| Invalid pending | quarantinePending後technical lock，無重試／清除／編輯；合法payload才可shared retry |

每矩陣列皆以正式encode/decode/restore測相同分數並執行一個合法續作；尤其null方向→真正拖出箭、delete重映selected、check→edit的palette延續。缺required欄位、非法角度／非有限值、超6箭、非法definition是損壞；學生畫反、畫多向心力、重複力、完全未答都必須能還原及評分。

## Shared SCORM lifecycle

實作依 [shared lifecycle](../docs/simulation-scorm-production-guide.md#mandatory-shared-lifecycle-flow)：loadAttempt→startup；setDraftProvider取得最後canonical答案；語意變更saveDraft；submitWithCallbacks所有outcome交submission。不得自行讀寫raw LMS欄位或寫commit/finish/pagehide/pageshow控制器。

| Outcome / policy | Activity handler |
|---|---|
| editable | 驗證／還原或建立空白；停止演示，畫面可續作 |
| review | 驗schema→重畫權威答案→scorer→reviewResult比較；鎖定 |
| frozen startup | 驗nested review、canonical答案及重算分，僅合法同payload可retry；否則quarantine |
| load-error | technical lock，無已提交／達標宣稱；不偷偷當standalone |
| success | 已記錄，學生／參考對照可看，所有答案唯讀 |
| committed | 已commit但finish失敗，保持鎖定，只允許finish retry |
| frozen submit | 狀態未確認、分數--，凍結原payload，不公布確定pass/fail |
| retry | retryable=true可編輯及再試；false技術錯誤而不承諾再試；均不標submitted |
| review trust | mismatch／unknown顯不確定，completionLabel(null)不等於fail |
| Standalone | memory-only；刷新新空白，舊local/session/IndexedDB答案不讀，storage denied不阻止練習 |
| Moodle | 同attempt保留draft/review/pending，只有LMS新attempt才重新產題 |

pending／technical不顯示「提交後正解」以免技術錯誤冒充完成；可確認已commit的結果才按shared信任狀態開放回饋。所有模式保留fullscreen。

## Test plan

- [x] model：六情境全部variant的力集合、左右鏡像、圓心方向、橋頂N>0、盤上f_s≤μ_sN、圓錐擺r/ω/T一致、earth任意位置向太陽，沒有錯把反作用力畫在地球。
- [x] scoring：滿分100、空白0、種類但null方向的部分分、方向10°邊界／跨360°、重複一對一、extra扣分下限、選所有力無優勢、關係式與前項獨立、錐擺等價表述。
- [x] persistence：每矩陣列round-trip＋合法下一動作、最壞4000bytes、selected刪除重映、未知版本／invalid def、錯誤答案合法、方向precision、review與pending canonical mismatch。
- [x] interaction：實際controller的新增null箭／首次方向／改種類不轉向／cancel回滾／清圖不清關係／preview清理；不以source字串檢查代替。
- [x] lifecycle：四startup、四submission及retryable分支、invalid finished、pending quarantine、review trust mismatch/unknown、獨立刷新與Moodle同attempt。
- [x] browser：source及真正解壓package；六情境可信觸控作答、換題、check返回、空白/部分/完整提交、唯讀回看、extra箭、fullscreen、減少動態與fallback。
- [ ] 所有T0–T3幾何／模式／viewport與move-release手勢證據；Windows依guide用Git Bash，server啟動/HTTP ready/結束清理；stdout有`### Error`即失敗。

### Test registration and CI selection evidence

| Item | Decision / evidence |
|---|---|
| Runtime declaration | 本slug manifest：八自有runtime（含scene.js）＋shared styles/scorm/activity-flow/fullscreen |
| Logical entries | 六個本slug *.test.js（含scene.test.js）；kind node、scope資料夾slug |
| Browser owner | file `tools/centripetal-force-source-browser-regression.js`，kind browser，scope本slug；source/package同entry執行 |
| Helpers | 首版N/A，不為預期未用需求拆helper；有新增時照命名／literal import/consumers規則登記 |
| Manual gates | 既有mobile-scroll manual runner新增本活動矩陣；實機T4另列，不拿manual登記豁免source/package |
| Registration validation | 修訂版 `npm run check:tests`：264 entries，228 Node、36 browser、48 helpers、2 manual |
| Committed selection | `4aa4d50680f9c757b932e7db08be118f80142950` → `192cd7bda1cd324863345e164b272c64f5d78e86`；`npm run test:affected -- --base=... --head=HEAD --plan` 選 full、packages all，含本活動五項 Node 與專屬 browser；鍵盤修正 commit 為 `ac0c336f9e09d77a8f5ba75f1b696e45e6a49471` |
| Actual GitHub | 首個實作 SHA `192cd7bda1cd324863345e164b272c64f5d78e86` 的 [Quality run](https://github.com/frenselw/simlab/actions/runs/39740026658) plan/checks/四個 Node 分片已通過；鍵盤修正 SHA 的 [Quality run](https://github.com/frenselw/simlab/actions/runs/39742626251) 待最終結果 |

## 實施階段與交付

| Phase | 工作與退出條件 |
|---|---|
| P0 歷史 | 已建計劃草案並提交；使用者其後明確要求實作 |
| P1 | 六題definition／方向／rubric／schema及純測試，先證明錯答可保存且部分分正確 |
| P2 | 三區、兩視圖、箭頭編輯與手勢／preview；六題先可操作，手機可讀再接完整shared flow |
| P3 | manifest/catalogue/registry、source及package全流程、完整T0–T3、fullscreen、初次全套回歸 |
| P4 | commit/push後讀Sites skill，建立本活動獨立站點；只部署runtime，核對private source／owner-only慣例及實際存取，不重用另一活動project |
| P5 | 真Moodle／真手機T4、attempt續作與結果記錄；未有環境時如實列未驗證，不聲稱Moodle-ready |

每輪可試用變更完成後都需測試、commit、push、更新同一Sites站點；記branch SHA、資產hash、Site project/version/deployment id、存取範圍與網址。計劃文件修訂只做文件檢查與提交，不因文檔更新重部署未變runtime。main整合另依使用者授權，合併時保留其他活動登記、核對實際base及受影響驗證。

## Package-ready checklist

- [ ] 計劃已批准；六情境與全部矩陣、鍵盤替代、錯誤／部分作答證據完成。
- [ ] check:tests、check、npm test、package:all及實際base diff檢查通過；所有新增正式測試有owner。
- [ ] ZIP根imsmanifest.xml、runtime相依完整、無教材／開發檔；source與解壓package皆通過。
- [ ] 手機／短iframe／zoom可讀、panel最後控制可達、左右側帶可滑、T0–T3與fullscreen完整。
- [ ] commit/push及Sites版本資產可核對；CI狀態按實際回報。

## Moodle-ready checklist

- [ ] package-ready完成；真Moodle學生帳號上報分數及狀態。
- [ ] 同attempt草稿／review／pending續作，提交鎖定及LMS新attempt政策驗證。
- [ ] iPhone/Safari、Android/Chrome適用T4所有情境／模式，current-window及提供的new-window，實測frame chain與scroll owner。
- [ ] 高風險服務端驗證N/A：僅形成性；local/fake LMS不能代替真Moodle或真手機。

## P0 文件驗證記錄

本節保留 P0 草案當時的文件檢查記錄；當時尚未執行 runtime、browser、package、Sites 或 Moodle。其後驗證另記於下節。

| P0 項目 | 2026-10-22 證據 |
|---|---|
| Worktree / branch | 已由記錄的共同main SHA建立，只有本計劃列入變更 |
| Template | 與原模板逐一比較，全部14個二級節均保留並填寫；另補六情境、迷思、實施階段 |
| 文件連結 | `node tools/check-docs.js plans/39-centripetal-force-source-lab.md` 通過，無略過連結 |
| Diff | `git diff --cached --check` 通過，staged範圍只有本計劃；不當作runtime驗收 |
| 待審重點 | 六題各16分＋概念4分、先選力再拖方向、橋頂／橋底正式成對、地球題只辨引力來源、手機方向預覽 |

## 2026-10-22 前版實作與驗證記錄（歷史）

| 項目 | 實際證據／狀態 |
|---|---|
| 工作分支 | `codex/centripetal-force-source-lab`；獨立 managed worktree，未改 main 或另一新活動 worktree |
| 核心實作 | 六情境模型及合法 definition、96+4 分 rubric、v1 draft/review schema、同 attempt 固定選項、實際力箭頭與獨立參考圖、SCORM shared lifecycle |
| 邏輯測試 | 五個本活動 Node 測試通過：model、scoring、persistence、interaction、lifecycle；涵蓋空白／部分／重複力、方向容差、pending 位元組上限、合法恢復、四種提交結果及技術鎖定 |
| 註冊與靜態檢查 | `npm run check:tests`：263 entries（227 Node、36 browser）；`npm run check`：JavaScript 與全部 SCORM manifest profile 通過 |
| 打包 | `npm run package:all` 通過；本活動 ZIP 12 entries（manifest＋七自有 runtime＋四 shared），專屬 browser driver 比較 manifest 引用、source 與解壓 ZIP 各檔位元組 |
| 專屬瀏覽器 | source／解壓 package 都跑六題可信觸控作圖、13次拖動取得滿分、320×500 至 1280×800 七種 viewport、空白／部分提交、Moodle fake draft/pending/committed 續作、standalone 刷新、cancel、fullscreen；見 `output/playwright/centripetal-force-source-lab/report.json`（ignored artifact） |
| 共用手勢矩陣 | T2 source 與 package 均 `--phases=all --viewports=320x500,390x844`：各48/48 profile／viewport，全部零 issues；T1 source/package亦各48/48通過；T3前版執行已停止，未完成 |
| 全專案 Node | `npm run test:fast` 225/227；既有 `force-composition-construction-lab/persistence.test.js` 與 `tools/ci-prepare.test.js` 各超過本機 runner 120 秒上限，兩者單獨執行均通過。GitHub 四個 Node 分片通過；本機 full 命令不可記為通過 |
| Sites | 獨立 project `appgprj_6ad9ab2ffe008191bea6e486a6000e05`、version 2 `appgprj_6ad9ab2ffe008191bea6e486a6000e05~appgver_3876d3cbdda88191b6a26eb581561c54`、deployment `appgdep_6ad9bed0fba481919ef938f0de8d6439` 成功；source commit `72fddcdfa07ce9a9e37f56b575de1c9ae4506f48`；`https://centripetal-force-source-lab.ieyp.chatgpt.site`；custom allowlist 僅擁有人、零 external visitor；七自有及四 shared runtime 與工作樹逐檔 SHA-256 一致 |
| SCORM 資產 | 鍵盤修正後 ZIP SHA-256 `00B4F4FD3B422370AA3DA1AB54143A10FA5E6FC9C5E2525E277E32725B12052C` |
| Moodle／實機 | 未驗證；本地 fake LMS 與 Chrome 觸控不能代替真 Moodle 或手機 |

## 2026-10-22 審閱修訂：場景、操作與定點分析

使用者審閱前版後要求六情境重新繪製，加入真正由物體拖出實際力箭頭的操作，並修正橋頂分析時序。上表僅為前版證據；新版須重新跑受影響的 source／package、持續性與手機驗收，重新打包及更新同一私人 Sites。

| 決定 | 新版契約 |
|---|---|
| 評分風險與rubric | 仍為形成性前端 96＋4 分；力種類、方向與關係不變。場景中的移動位置是物理題目上下文，不能讓重播動畫悄悄改變已畫的答案。 |
| 六個場景 | SVG 繪出桌面、細線、小球；有刻度的轉盤與物塊；懸點、繩、圓錐擺球；有車身、車輪與弧形路面的拱橋和凹路；太陽、地球與公轉軌跡。全由本活動本地 runtime 生成，無遠端圖片依賴。 |
| 操作／畫力 | 場景可播放／暫停及拖曳時間滑桿；分析後保留情境截圖和局部受力圖。學生先選實際力，再由研究對象直接拖出箭頭；既有加入鍵、箭尖編輯、方向鍵及觸控放大預覽作替代。繪圖在指針放開時才原子保存，取消回滾。 |
| 一般情境 | 水平細線、圓盤、圓錐擺及地球可在當前位置立即分析；保存首次／重新選定的運動相位。前三題的正式受力圖是隨物體轉動的徑向剖面，避免把俯視平面上的重力誤作徑向力；地球題的太陽方向須按保存相位計算。已有答案時重播只作觀察，不暗改保存相位。 |
| 橋頂／凹底 | 按鍵分別寫「分析車在拱橋頂部時」、「分析車在凹路最低點時」；從目前汽車位置繼續播放，到下一次經過中央最高／最低點才停車、保存相位並開受力圖。已超過中央點要循環到下一圈。偏好減少動態時直接顯示目標點。 |
| 權威快照 | answer schema v2，每題新增 `pose`：`null` 或 0–9999 的一圈相位，橋題固定 5000；模型／評分只用已保存的pose。舊 v1 draft/review/pending 嚴格驗證後遷移為 `pose:null`，保留原答案和舊評分。動畫播放位置與等待狀態只是暫態，不進 SCORM。 |
| 依賴 | 新 `scene.js` 為本活動自有純 SVG/運動幾何 runtime；加入 `index.html`、manifest、package 與 test registry。shared SCORM/activity-flow/fullscreen 不改。 |
| 必跑驗證 | scene 幾何／車到頂事件／跨圈及六物件測試；v1→v2 與所有 editable phase/variant round-trip；直接拖畫、取消、多指、鍵盤、橋頂已過時等待與停車的真觸控 browser；source／解壓 package、短屏與 T0–T3、ZIP 位元組及 Sites 版本核對。 |

### 修訂版實測與交付

| 項目 | 2026-10-22 證據 |
|---|---|
| 六個場景與畫力 | scene.js 六種具體物件與背景；播放／暫停／進度拖曳；從物件直接拖出力及箭尖編輯；參考既有 force-equilibrium-diagram-lab 的原點拖畫／取消模型，無新增外部依賴 |
| 邏輯 | 六個本活動 Node 測試通過；任意地球相位、原點拖畫、橋頂／凹底前後及跨圈、舊 v1 review/pending 維持 100 分、嚴格橋題 pose、最大 pending ≤4000 bytes |
| 專屬 browser | 最終 source／解壓 package 均通過：六物件截圖、橋題 2500／7500 相位按分析後等待至下一個 5000、任意地球 1376 相位、已答重播保持相位、直接畫力與取消、13 次可信觸控作圖取得 100 分；七種 viewport、鍵盤、空白／部分、續作、鎖定、fullscreen及200% zoom |
| Browser report | `output/playwright/centripetal-force-source-lab/report.json` completed=true、errors=[]；assetHash `5ec0188dd348b905f69b0e3588cc6bc52e4d7cb1a820b140e7c1904bd526aa1d` |
| 手機容器 | 新版 focused T3 source／package：initial、橋頂分析、直接畫力、完整作答 × 320×500／390×844，各 8/8 零 issues。未把前版全部T1/T2證據宣稱為新版全矩陣 |
| 手勢判定修正 | 共用觀察器加入本活動權威state；動畫自動變動的motionPosition只作播放進度，不列作答。新增測試證明保存pose變動仍報錯；觀察器測試通過 |
| 靜態與包裝 | check、check-docs、check:tests、git diff --check 及 package:all 通過；本 ZIP 13 entries（manifest＋八自有＋四shared） |
| SCORM ZIP | `output/centripetal-force-source-lab-scorm.zip`；SHA-256 `19F39FF6F43982692BBD65D9C4DB8E0705130C70B608E6A03085E42A7E9F4438` |
| Sites v3 | 同一 owner-only project `appgprj_6ad9ab2ffe008191bea6e486a6000e05`；八自有 runtime 與 worktree SHA-256 一致。Site source commit `cbd9c18a97dccf80e544355e8d99194d7d07aa4c`；version `appgprj_6ad9ab2ffe008191bea6e486a6000e05~appgver_a25849402d448191a4e2b46113c9e836`；deployment `appgdep_6ad9ca956d408191afe6b8c16d910bb7` succeeded；[預覽](https://centripetal-force-source-lab.ieyp.chatgpt.site) |
| Git 與 selection | runtime commit `6c167cafc3cfa0d1563a0b2ac55f2c064d3adcf5` 已推送 `codex/centripetal-force-source-lab`；以 `ac0c336f9e09d77a8f5ba75f1b696e45e6a49471` 為 base 的 committed `--affected --plan` 選 full／packages all／264 entries；CI 未等待終態 |
| 限制 | 不等待 GitHub CI 才交付；本輪不重跑全專案 Node 或全部 T0–T3 phase matrix。真 Moodle／實機 T4 未驗證，package-ready／Moodle-ready 清單維持未勾選，不能冒稱完成 |
