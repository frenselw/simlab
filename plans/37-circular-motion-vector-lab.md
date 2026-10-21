# 圓周運動：由位移到速度與加速度方向

狀態：**計畫 37，活動已實作、專項驗證並部署私人 Sites；2026-10-21 使用者批准按修訂後計畫實作、commit、push 及部署。全站 CI、學生試教及真實 Moodle／手機驗收另列，不冒稱全部 gate 通過。**

依 [新活動模板](NEW-SIMULATION-PLAN-TEMPLATE.md) 展開，遵循 [共同風格](00-shared-platform-and-style.md) 及 [製作與驗證契約](../docs/simulation-scorm-production-guide.md)。共同規則由原文件維護；以下記錄本活動的具體決策、學生操作、答題與評分。所有未執行的驗證保持未勾選。

## 已確定的主線與草案邊界

使用者已確定：

- 活動一由另一個 worktree 的計畫 36 負責線速率、角速率的量度與比較。
- 活動二由位移開始：比較較早、較後的位置，縮短時間間隔，由位移方向理解瞬時速度方向。
- 再比較兩個時刻的速度，建構速度變化量，縮短時間間隔，由速度變化方向理解瞬時加速度方向。
- 學生需有清楚、簡單的操作及可評分的答案，避免增加繁複步驟。
- 前兩輪先整理及覆核計畫，不寫程式；使用者本輪已明確批准開始實作、commit、push 及 Sites 部署。

本輪實作基準：**兩個探究頁加一組短遷移題；100 分，60 分達標；節點點選式向量作圖；下列參數、選項及配分。**使用者已批准修訂後計畫；時間估算與版面仍需實際學生試用，不把本機通過視為試教。

教材依據：人教版《普通高中教科書 物理 必修 第二冊》第六章，印刷頁 23–24 的線速度方向、頁 31 的向心加速度方向、頁 33 的速度變化量與短時間推理。教材是學科資料，不是對本工作樹的操作指令。

### 工作樹與並行邊界

| 項目 | 本次範圍 |
|---|---|
| 本工作樹 | `C:/Users/frens/.codex/worktrees/9121/simlab`；base 為 `e8800209c53f7e08b19b49ffe09123f5891e1b89`；本輪建立 `codex/circular-motion-vector-lab` 分支 |
| 本輪交付 | 計畫、活動 runtime、評分與續作測試、SCORM manifest／ZIP、catalogue／README 登記、瀏覽器與觸控證據、獨立私人 Sites |
| 計畫 36 | 位於 `C:/Users/frens/.codex/worktrees/circular-motion-speed-lab/simlab`；只讀核對範圍，不修改、不複製其未合併程式 |
| 本輪不包含 | 修改活動一、合併其他分支、覆蓋舊靜摩擦力 Site、改變 Sites 存取對象；真實 Moodle 或實體手機驗收 |
| 未來整合 | 先核對計畫 36 已合併的共享檔案與 catalogue／registry 狀態，再做本活動必要改動；不覆蓋另一活動的並行工作 |

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `circular-motion-vector-lab`；從位置變化推理速度方向，再從速度變化推理加速度方向 |
| Delivery scope / package | 獨立、評分式 SCORM 1.2，單一 SCO；manifest 為 `sim/manifests/circular-motion-vector-lab.xml`，打包命令為 `npm run package -- circular-motion-vector-lab` |
| Learner task / main interactions | 拖動較後位置 B；閱讀時間與位移；選擇速度方向及理由；選兩個向量節點建構有向線段；再次縮短時間；選擇加速度方向及理由；完成一組不同位置、相反轉向的遷移判斷 |
| Shared subject core / activity outer layer | 沿用共享樣式、SCORM、activity-flow、fullscreen。計畫 36 的速率量測不作為本活動的資料前置；目前不假設已有可直接使用的圓周向量核心，不為兩個活動預建通用引擎 |
| Runtime files / libraries and justification | 原生 HTML/CSS/JavaScript 與 SVG，無新增函式庫；入口 `index.html`、`styles.css`、`main.js`，`model.js`、`scoring.js`、`persistence.js` 分別承擔幾何、評分及續作驗證，`ui-runtime.js` 承擔可測試的共享 lifecycle 接合與權限 |
| Assessment risk / trusted validation | `formative`；前端評分供教學回饋，不適用高風險評核。若改作高權重考核，需另有可信伺服器驗證 |
| Out of scope | 速率／角速率計算、皮帶傳動、向心力及受力圖、加速度大小計算、推導或探究 a = v²/r、非勻速圓周運動、整圈平均加速度題、三維角速度向量、自由手寫辨識 |

預計 12–18 分鐘，屬試教前估計。核心達成標準是學生能分清「位移」與「速度變化量」，並把兩次短時間推理連接起來；不以拖動次數或停留時間定義完成。

## Catalogue metadata (`sim/config.js`)

以下資料已登記至 catalogue；active 表示可部署，不代表 Moodle-ready。

| 欄位 | 草案值 |
|---|---|
| title | 圓周運動：由位移到速度與加速度方向 |
| folder | circular-motion-vector-lab |
| categories | Mechanics |
| description | 縮短兩個時刻的間隔，觀察位移方向、建構速度變化量，判斷瞬時速度與向心加速度方向。 |
| tags | physics、mechanics、circular-motion、displacement、velocity-change、centripetal-acceleration、vectors、scorm |
| status | active；驗證範圍見本計畫實際證據 |

## 學生操作、答題與教學呈現

### 主畫面的共同語言

- O 表示圓心；A 是固定的較早位置，B 是沿指定轉向、較後時刻的位置。A、B 是同一物體的兩個時刻，不是兩顆同時存在的小球。
- 畫面持續顯示轉向提示及「較早 A／較後 B」；拖 B 靠近 A 代表縮短時間，不代表物體倒轉運動。
- 「位置圖」使用 m；「速度向量圖」使用 m/s。兩個圖域、原點與刻度明確分開，不共用一把尺。
- B 可直接沿圓周拖動，亦可用「縮短時間／加長時間」按鈕或鍵盤等效操作。無需按記錄、達到指定角度或完成若干次操作才可答題。
- 頁首提供「位移與速度」「速度變化與加速度」「遷移挑戰」及「檢查答案」。順序是教學建議；後頁採模型參考資料，不消費前頁答案，故允許直接切換並保留草稿。
- 不開放運動參數自由調整；學生只需專注時間間隔及方向。初始圖形與示範讀數不算作答。

### 最短操作路線與教學銜接

兩個探究使用同一節奏：「看兩個時刻的差別 → 縮短時間 → 判斷 A 時刻的方向」。學生核心操作只有兩次縮短間隔及一次兩點連線；之後是一組短遷移題。可以反覆觀察，但不額外要求播放、暫停、記錄、計算或觀看動畫確認。

| 學生路線 | 主要操作與作答 | 系統代辦的事 |
|---|---|---|
| 位移 → 速度 | 拖近 B；選速度方向及一句理由 | 畫出 A→B 的真實位移，保留可辨方向的延長線 |
| 速度變化 → 加速度 | 點選連線起、終點；拖近 B；選加速度方向及一句理由 | 提供正確參考速度、自動平移至共同起點，將學生作圖的方向同步帶回 A 點比較 |
| 遷移 | 換位置與轉向後回答三道單選 | 保留觀察工具，但不要求再拖一次或再作圖 |

合共七道單選及一條有向連線，最後只提交一次。各題一直可答，頁面的操作提示不構成解鎖條件。每頁僅突出當前一句操作提示；先呈現目前主要控制，平均量定義以兩行呈現。探究二先顯示三個節點，只有已選起點才顯示修改線段控制；圖例與較長說明移至題目之後，減少首屏文字。

探究一直接提供位移箭頭，故評分證據是「能否利用位移推理速度方向」，不聲稱另外測得學生獨立作位移向量的能力。探究二才讓學生建構差向量，不再要求手動畫兩支速度或自行搬移箭頭。

### 探究一：由位移得出速度方向（25 分）

本頁正式配分為 V1 15 分、V2 10 分，共 25 分；所有分數以後方 rubric 表為準。

畫面提供一行定義提醒：「平均速度 = 位移 ÷ 時間間隔；除以正數不改變方向。」依使用者修訂，位移統一寫作 Δx（不加向量箭頭或絕對值），對應平均速度 = Δx/Δt；速度與加速度保留向量記號，均用本地 LaTeX 排版。這行交代從位移到速度的理由，不預告切線答案；不把當前有限間隔的平均速度直接標成 A 點瞬時速度。

| 學生看到／操作 | 畫面反應 | 答題及證據 |
|---|---|---|
| 開啟頁面 | A 固定，B 初始位於前方 60°；淡色圓弧表示實際路徑，實心直箭頭 A→B 表示位移 | 尚未選任何答案 |
| 把 B 拖近 A，亦可拖遠比較 | 位移箭頭按真實幾何縮短、轉向；同步顯示 Δt 及位移大小；虛線「位移方向延長線」讓短箭頭方向仍可辨認 | 操作不計分，不自動填答案 |
| 回答 V1：「根據觀察，A 點的瞬時速度應指向哪裡？」 | 四張大圖卡均顯示同一 A、轉向及同長候選箭頭；候選為順運動切線、反向切線、向內徑向、向外徑向，順序依題目定義輪換 | 單選，允許清除為未答；正解為順運動切線 |
| 回答 V2：「把 B 逐漸移近 A，以下哪句描述正確？」 | 三個文字選項，內容見答案字典 | 檢查是否理解方向逐漸趨近，並非任何有限間隔都已完全相同 |
| 前往下一頁或檢查 | 保留間隔及兩個答案，不要求先答對或答齊 | 後頁不依賴本頁選項是否正確 |

學生提示僅需：「把較後位置 B 拖近 A，觀察位移方向的變化。」不預先畫出主場景的標準切線或直角標記；選項內必然包含候選切線，但不突出正解。

位移箭頭與圓弧須有清楚不同外觀；不可把弧長標成位移大小。當 B 很近，延長線只表示方向，不增加位移長度，也不冒充速度箭頭。

### 探究二：由速度變化得出加速度方向（45 分）

本頁使用同一主情境的 A、轉向與速率，但有自己保存的時間間隔，初始重新展開至 60°，讓速度差異容易看清。初次呈現時以「先把兩個時刻拉開，方便比較速度」說明；不需學生確認。這不改寫探究一的間隔；再返回本頁則保留這一頁的觀察間隔，不重新拉開。

畫面沿用上一頁的句式：「平均加速度 = 速度變化量 ÷ 時間間隔；除以正數不改變方向。」公式對應平均加速度 = Δv/Δt，並將 Δv 寫清楚為「末速度 − 初速度」。這是定義提醒，沒有告知應選哪兩個端點或加速度應朝哪裡。

| 學生看到／操作 | 畫面反應 | 答題及證據 |
|---|---|---|
| 開啟本頁 | 位置圖顯示模型正確的初速度 v₁、末速度 v₂，兩箭頭等長且分別沿切線；一次短動畫把副本平移至速度向量圖共同起點 S，保留方向、大小及顏色 | 參考速度不從 V1 答案生成，不把前頁錯誤傳入本頁 |
| 閱讀題目：「用圖中的兩個速度，作出末速度減初速度的向量。」 | 對齊後，標明「共同起點」「初速度末端」「末速度末端」；初／末速度與各自端點的文字及外觀對應，不只靠顏色 | 初始沒有學生 Δv 箭頭，不預填 U→V |
| 選起點，再選終點 | 面板有上述三個語意完整的節點按鈕，各 ≥44px；先提示「選線段起點」，再提示「選線段終點」，圖上連成有向線段 | D1 評是否選到兩個速度的末端，D2 評相減的箭頭方向；正確建構為 U→V |
| 把 B 拖近 A，再拉遠比較 | vB 及學生線段隨 U、V 更新；位置圖 A 點同步顯示「我的作圖方向」虛線方向提示，讓學生直接與圓心位置比較 | 不需學生再搬移線段；不自動把錯誤的 S→V 或 V→U 修成 U→V；不按拖近程度計分 |
| 回答 A1：「根據縮短時間後的觀察，A 點的瞬時加速度應指向哪裡？」 | 四方向候選與 V1 類似，但不標記任何正解 | 單選；正解為向內徑向 |
| 回答 A2：「縮短時間間隔後，可以怎樣利用正確的速度變化量？」 | 三個文字選項，內容見答案字典 | 檢查由平均量推理瞬時方向；不能把 Δv 變小誤作瞬時加速度趨零 |

作圖採「點起點、點終點」的有向連線，避免在很短的 Δv 上要求精準自由手繪。S、U、V 僅為內部語意 key；圖中顯示中文的共同起點、初速度末端、末速度末端，並維持非互動標記，操作按鈕固定在面板，即使 U、V 很接近也不發生觸控目標重疊。鍵盤與滑鼠使用相同節點關係。

完成線段後提供「重新作圖」「改終點」。重新作圖清除起點與終點，再依序點選；改終點保留起點、清除終點，進入合法半作答狀態。只有起點時亦可重新作圖。選回相同節點不形成線段，保持原狀並提示「請選另一個節點作為終點」，不計作一次作答或扣分。這兩種操作直接改變已保存的答案狀態，不另設需要恢復的端點編輯模式。

學生線段始終標示「我的速度變化量作圖」；只有提交後的正解層可標示「參考 Δv」。不得把學生的錯誤線段冒充真實加速度，不顯示由錯線段推算的物理 a 讀數。未作圖時仍能觀察兩個速度末端、回答 A1／A2 或提交。

「我的作圖方向」只在起、終點都選定時出現：在 A 點畫與學生線段同向的虛線提示，外觀明確不同於實心物理向量，標明「只比較方向」。它沒有長度刻度，不代表位移、Δv 的大小或已判定正確的加速度；線段畫反時，提示亦保持反向。沒有線段或只選一端時不補出提示。這樣學生無須在速度圖的 U 點與位置圖的 A 點之間自行想像搬移，且不新增一個操作步驟。速度圖保留真實比例的實心學生線段，不再另加一條長延長線，避免兩幅圖同時堆疊方向提示。

初次自動平移不需按確認或觀看完成才能操作。減少動態偏好、切頁、載入或動畫中斷時直接顯示對齊結果；不保存動畫進度。

### 短遷移題：換位置與轉向（30 分）

這是計畫新增的精簡檢查，不增加新物理情境。主情境的起點旋轉 45°，轉向反轉，半徑與速率不變。

- 畫面只顯示位置圖、轉向及 A／B；可像探究一一樣縮短時間並看位移，不預先顯示參考速度、加速度箭頭。
- T1：「這次 A 點的瞬時速度應指向哪裡？」四方向大圖卡單選，10 分。
- T2：「這次 A 點的瞬時加速度應指向哪裡？」四方向大圖卡單選，10 分。
- T3：「物體的速率保持不變，為甚麼仍然有加速度？」三選一，10 分；正解是速度方向仍在改變。
- 不要求再做一次 Δv 作圖或數值計算；三個答案互相獨立，沒有前題答對才開放後題的限制。

### 答案字典與回饋時機

選項值是語意，不是畫面 A/B/C/D 編號。

| 題目 | 語意值與顯示內容；第一項為本計畫中的正解，實際顯示須輪換 |
|---|---|
| V1、T1 | `forward-tangent` 順運動切線；`backward-tangent` 反向切線；`inward` 指向圓心；`outward` 背離圓心。實際以大圖卡呈現，無需學生背選項名稱 |
| A1、T2 | 使用同一四方向語意集合，正解為 `inward` |
| V2 | `displacement-per-time`：位移方向會越來越接近 A 點的瞬時速度方向；`finite-equals-instant`：任何時間間隔的位移方向都完全等於 A 點的瞬時速度方向；`arc-is-displacement`：應看圓弧的彎曲方向，因為 A 到 B 的圓弧就是位移 |
| A2 | `velocity-change-per-time`：時間越短，正確 Δv 的方向越接近 A 點的瞬時加速度方向；`finite-equals-instant`：任何時間間隔的 Δv 方向都完全等於 A 點的瞬時加速度方向；`vanishing-change-zero-acceleration`：Δv 越短，便代表 A 點的瞬時加速度越接近零 |
| T3 | `direction-changes`：速度方向持續改變，所以速度仍在改變；`speed-only`：只要速率不變，速度就沒有變化；`motion-direction`：物體繼續前進，所以加速度必定沿前進方向 |

這是形成性探究，觀察圖與探究二提供的正確參考速度本來就是學習材料。學生可以返回探究一修訂答案；最終狀態評分，不把先前猜測錯誤累積扣分，不聲稱這是無提示的診斷測驗。

提交前提供操作提示、兩行平均量定義、位移／時間讀數、探究二的參考速度及「我的作圖／我的作圖方向」；不標對錯、不顯示分數、不自動補正 Δv 或顯示主場景的正解加速度。定義提醒屬教學支援；V2／A2 改為判斷短時間推論，不再只要求抄回定義。提交後，按可信提交結果提供：學生答案、參考答案、逐項得分及短回饋。

| 常見錯誤 | 提交後針對性回饋 |
|---|---|
| 速度選向內 | 「位移描述位置的改變；把時間縮短後，其方向趨近切線。指向圓心的是這裡的瞬時加速度方向。」 |
| 速度選反向切線 | 「切線有兩個方向，速度應配合圖中的實際轉向。」 |
| Δv 畫成 V→U | 「你找到了兩個速度的末端，這部分有分；箭頭表示初速度減末速度，本題要求末速度減初速度，所以方向相反。」 |
| Δv 畫成 S→V | 「你找到了末速度端，得到這個端點的部分分；整支線仍是末速度本身，需要比較初、末兩個速度的末端。」 |
| 認為有限間隔已等同瞬時方向 | 「目前的位移／速度變化量對應一段時間；把這段時間縮短，其方向才逐漸趨近 A 時刻的方向。」 |
| 認為 Δv 越短代表加速度越接近零 | 「時間間隔也同時縮短。加速度要看速度變化量除以時間間隔，不能只看 Δv 的長度。」 |
| 加速度選切線 | 「加速度描述速度的改變。此處速率不變，但速度方向改變；短時間的速度變化方向趨近圓心。」 |
| 認為速率不變就無加速度 | 「速度有大小和方向；兩支速度箭頭等長，方向不同，仍有速度變化。」 |

結果圖再顯示標準切線、半徑線所呈現的垂直關係、正確 U→V，以及 A 點向內加速度方向。首版以綠色空心箭頭表示參考答案，保留學生的紫色實心作圖；小畫面不另堆疊 90° 字樣或方角符號，不能覆蓋成看似學生本來答對。

## Physics or subject model

### 參數與推導（供實作及驗證，不要求學生代入計算）

| State variables | Update rules / formulas | Units | Calibration constants |
|---|---|---|---|
| 主情境起角 θA | 起點索引 0、1、2、3 對應 0°、90°、180°、270°；新 attempt 等機會選一個 | rad（內部） | 題目中途不變 |
| 轉向 d | +1 逆時針，−1 順時針；新 attempt 等機會選一個 | 無 | 數學座標 x 向右、y 向上；畫面 y 需反向映射 |
| 半徑 r、線速率 u | 固定 r = 0.50 m、u = 0.50 m/s，角速率 Ω = u/r = 1.00 rad/s | m、m/s、rad/s | 僅是清楚呈現的模型值，不出參數研究題 |
| 正轉角間隔 δ | 每頁獨立保存整數 5–60°；主兩頁初始 60°，遷移初始 45° | °，計算時換 rad | B 沿指定轉向前進：θB = θA + dδ；不跨越 A，不取零時間 |
| 正時間間隔 | Δt = δ/Ω，δ 使用 rad | s | 縮短間隔不是減小物體速率 |
| 位置 | rA = r(cos θA, sin θA)，rB 同理；Δr = rB − rA | m | 位移是弦向量；弧長 rδ 不作位移讀數 |
| 速度 | vA = du(−sin θA, cos θA)，vB 同理 | m/s | 速率相同，方向隨位置改變；沒有徑向速度分量 |
| 速度圖 | 共同起點 S；U = S + kvA，V = S + kvB，k 為該圖統一顯示比例 | CSS px 與 m/s 的映射 | 平移保留向量，S 不是物理圓心 O |
| 速度變化 | Δv = vB − vA；正確幾何是 U→V | m/s | 學生的其他節點配對是可評分錯答，不是壞資料 |
| 平均量 | 平均速度 = Δr/Δt；平均加速度 = Δv/Δt | m/s、m/s² | 兩者分別與 Δr、Δv 同方向；不把有限間隔平均量標為 A 點瞬時量 |
| 瞬時方向 | vA 沿順運動切線；aA 指向 O | 方向 | δ 趨近 0 時才取得相應極限方向；a 的大小只作內部物理校核，不顯示或考核 |
| 遷移情境 | θA 改為主情境 θA + 45°（模 360°），d 改為 −d | 同上 | 由主題目資料推導，不另存可互相矛盾的副本 |

重要物理驗證：在本活動 0 < δ ≤ 60° 內，有限間隔 Δv 指向的是相對弧段中點的向內方向，不是必然精確沿 A 或 B 的半徑。Δr 與 A 點瞬時速度、Δv 與 A 點瞬時加速度的方向誤差，均為 δ/2；δ = 5° 時仍有 2.5°，只能說「很接近」，不能宣稱已完全相等。

兩種差向量的大小均隨 δ 縮小；不能用「Δv 變小」直接斷言瞬時加速度變小。首版不展示加速度大小變化曲線，也不要求計算此比值。

### 數字與選項呈現

- 時間、位移大小顯示三位有效數字及單位；內部幾何保留精度，不以顯示捨入值反算位置。沒有數值輸入題，也沒有有效數字作答扣分。
- 新 attempt 每題獨立抽取完整排列：方向題 24 種、理由題 6 種，以 definition.choiceRanks 保存各題排列編碼；拖動、清除答案、轉頁、檢查及 Moodle 還原不重新排序。舊快照缺少 choiceRanks 時沿用 choiceShift 循環位移，不改既有次序；standalone refresh 依共用契約建立新 attempt 及新次序。
- 初始答案全部為 null；不能因候選箭頭已存在、B 已在某位置或平移動畫完成而視為學生作答。

## Responsive layout contract

| Decision | Activity specification and reason |
|---|---|
| Three regions | 頁首：標題、三任務導航、檢查及全螢幕；舞台：位置圖／速度圖；面板：時間調整、節點作圖按鈕及當頁題目 |
| Fullscreen (mandatory) | 全活動目標與頁首使用共享 markers，依 [fullscreen 契約](../docs/simulation-scorm-production-guide.md#one-click-fullscreen)；右上 44px 按鈕預留空間，含 `sim/shared/fullscreen.js` 及共享樣式 |
| Desktop / tablet | ≥900px 草案採舞台與 320–380px 面板左右；探究二舞台內位置圖與速度圖並排，標明圖域 |
| Control-panel classification | `bounded split-panel`；學生需看圖同時作答，面板獨立捲動，文件本身無競爭的垂直捲動 |
| Phone stage and controls | 頁首下方舞台 52dvh，正常高度保留 ≥96px 可見面板；探究二兩圖並排。高度 ≤400px 用緊湊任務 select 取代三個頁首任務按鈕；寬度 ≥480px 優先左右重排，更窄則保留 96px 面板並壓縮舞台非必要文字。按鈕仍 ≥44px，最後控制可捲至 |
| Phone text | 面板正文、選項、提示、次要按鈕及回饋統一 18px，標題 22px、子標題 20px；公式分式採 displaystyle 避免分子／分母縮小；圖中必要標記至少 18px 實際呈現；細節另以面板文字及局部預覽支援，不能只指定未縮放 SVG 字級 |
| Viewports | 320×500、390×500、390×600、390×844、480×320、320×225 短播放器、桌面、鍵盤／工具列改變與 200% zoom；均為待驗證尺寸 |
| Scroll topology | bounded 活動頁＋原生 pan-y 舞台＋contained 面板，沒有 forwarding adapter 或 host lock；T1 外層 window、T2 越過無 range wrapper 的外層 window、T3 指定 scrollOwner 元素。實際證據逐命令列於後文；T4 尚待真實部署環境驗收 |

版面數值是草案；若雙圖在窄畫面不可讀，先調整排列／短標籤及預覽，不新增橫向整頁捲動或讓學生來回切換才能比對同一組向量。

## Navigation, submission and reset

| Decision | Activity specification |
|---|---|
| Navigation | `independent` 資料依賴：三個任務可直接跳轉，建議依 1→2→3 學習；後頁由同一固定模型產生參考速度，不消費前頁作答 |
| Final check access | 每一可編輯頁、半選節點及返回修改狀態都可直接檢查；沒有觀看、拖近、完成動畫或答齊門檻 |
| Incomplete submission | 檢查頁列各題「已答／未答」、作圖起點及終點是否選定；中立說明未答零分，仍提供明確提交 |
| Editable reset | 「清除本頁答案」只清該頁答案並重設該頁間隔；已有答案才提示範圍。單獨改時間不清答案；沒有換新隨機題按鈕 |
| Scored / pending attempt | 已記錄與待確認提交均不可清除、重做或修改；只保留共享契約允許的技術重試與唯讀查看 |

| Step / question | Required upstream data and why | If missing or changed | Legal next actions / final-check route |
|---|---|---|---|
| 位移與速度 | 題目 definition；自己的位置間隔 | B 改變只更新圖與讀數，V1／V2 是固定 A 的瞬時判斷，保留原答 | 拖 B、改答案、切頁、檢查 |
| 速度變化與加速度 | 同一 definition、自己的速度間隔；選終點需已有起點 | 未選起點可選任一 S/U/V；只有起點屬合法部分作答；改間隔保留語意節點，重新生成線段，不偷改答案 | 作圖、改間隔、獨立回答 A1／A2、檢查 |
| 遷移 | definition 推導的新起點／轉向及自己的間隔 | 不要求主情境答對；改間隔不清答案 | 觀察、改答案、檢查 |
| 檢查返回修改 | 同一份 definition、answers、三個間隔 | 回到所選任務，其他頁工作全部保留 | 任務內隨時再進檢查，不另設需完成的 review-edit 子流程 |

## Diagrams, notation and assistance

| Decision | Activity specification and reason |
|---|---|
| Notation | 學習畫面位移寫 Δx，不加向量箭頭或絕對值；圖區旁顯示 Δx 及 Δt 數值，位移箭頭旁直接標 Δx。速度箭頭直接標 v₁、v₂；學生完成相減連線後在該線旁標 Δv，參考線於正式提交後顯示。依使用者教材，位移、速度、速度變化及加速度的符號均不加向量箭號；圖中表達方向的實際箭頭保留。正文、圖及結果使用本地 LaTeX SVG 字形與下標，不顯示原始 LaTeX 字串；物理模型內部 dr／Δr 仍是二維位移差 |
| Arrow graphics | 位移、速度及學生連線均用連續實心箭身／箭頭；箭尖精確落在模型終點。短向量縮小箭頭外觀而不拉長幾何；延長線為細虛線且明確標「方向延長線」 |
| Direction comparison | 探究二 A 點的「我的作圖方向」是無長度刻度的虛線方向提示，由學生線段推導，並非新增物理向量；實際 Δv 作圖仍保留於速度圖且按共同尺度呈現。空白／半作圖不顯示，錯答不補正 |
| Snap | B 拖動限制在可見圓周合法弧段，投影角度取最近 1°，限制 5–60°；這是時間刻度控制，不是正確答案吸附。S/U/V 用語意按鈕選定節點，無自由座標或隱藏正解吸附 |
| Touch preview | B 近 A 時有遮擋：提供固定角落約 3 倍局部預覽，含 A、B、實際弦／方向延長線；位置不得遮住手指與題目，尺寸與標籤需實測。節點按鈕及單選題不需放大鏡 |

拖 B 時鏡頭與圖比例固定；預覽不接收輸入，不顯示標準切線／加速度答案。放手、取消、失焦、第二指、切頁或鎖定時清除預覽。位置圖與速度圖可用不同明示尺度，但速度圖中的兩支速度和學生線段必須共用同一尺度，不可逐箭頭正規化後冒稱有大小比例。

## Touch gesture ownership contract

使用 [完整觸控契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)。以下 selector 已建立，證據與未驗項目列於後文。

| Target type / modes | Visible footprint, selector, hit area/halo and size | Stable capture target / pre-pointerdown touch-action | Keyboard alternative |
|---|---|---|---|
| B 位置把手：三任務可編輯狀態 | `[data-position-handle]`，可見點＋局部 44×44 CSS px HTML 目標；不得把整個圓盤設為操作區 | 固定 DOM 目標，按下前已為 `none`；只有拖 B 捕捉 pointer | 縮短／加長時間按鈕每次 5°，邊界夾限；方向鍵每次 1° |
| S/U/V 起終點按鈕 | `[data-vector-node]`，面板三個各 ≥44px 的原生按鈕，只顯示共同起點／初速度末端／末速度末端，不顯示 S／U／V；圖上標記及方向提示不攔截手勢 | 原生點擊、面板捲動；無拖曳 capture | Tab、Enter／Space |
| 重新作圖／改終點／清本頁 | `[data-answer-action]`，各 ≥44px | 原生面板控制 | Tab、Enter／Space |
| 方向圖卡與理由選項 | 原生 radio＋label；方向圖卡隱藏可見圓鈕與 1–4 編號，保留 native radio 可達性、鍵盤操作及選中外框，`[data-answer-choice]`，整個選項可點 | 原生點擊與面板捲動 | Tab、方向鍵／Space |
| 任務導航、檢查、提交、技術重試 | 原生按鈕，明確 focus | 原生；提交鎖定同步取消任何拖動 | Tab、Enter／Space |
| 全螢幕 | 共享控制、44px，所有 lifecycle 狀態可達 | 共享行為 | 共享鍵盤行為 |

| Touch starts on | Owner | Activity strategy / region dimensions | Source and packaged evidence |
|---|---|---|---|
| 非互動圖形、圖上 S/U/V、舞台空白 | enclosing page／Moodle host | `pan-y`；速度箭頭及方向延長線不得有大型透明命中區 | 待驗 |
| 面板中段、頂端、底端 | panel only | containment；邊界亦不得捲 host | 待驗 |
| B 把手 | simulation | 只改目前頁間隔；其他 scroll／viewport／iframe 位置固定 | 待驗 |
| B 旁的視覺空白 | host，除已聲明局部 halo | 比對截圖與真實落手目標，不能以透明 overlay 排除失敗 | 待驗 |
| 左右舞台邊緣 | host | 草案各保留 32 CSS px 可落手空白，把手 halo 不侵入；本版無整面自由作圖／orbit，仍核對兩側可達性 | 待驗 |
| 自由作圖區 | N/A | 作圖由面板節點按鈕完成，沒有全畫布攔截區域 | N/A |

| Host case | Frame chain and actual owner selector/window | Origin/sandbox / native path or verified adapter | Source/extracted evidence; deployment/device evidence separately |
|---|---|---|---|
| T0 standalone | 直接啟動、bounded document，panel 自身可捲 | 真正無 enclosing range 才可把 host 移動列 N/A | 待驗 |
| T1 direct iframe | 外層可捲 document → 活動 iframe | 先驗 native path；外層實際 window 為 owner | 待驗 |
| T2 nested player | 可捲外層 → 無捲動 wrapper → 活動 | 不把 wrapper 當作 owner；記錄全部 frame 位置 | 待驗 |
| T3 overflowing element | 外層 window 無 range，指定 player element 可捲 → 活動 | 記錄元素 selector／range；window 必須固定 | 待驗 |
| T4 real Moodle | 真實 current-window 與有提供的 new-window 播放器 | 記錄實際 origin／sandbox／frame chain／owner，不從本機推論 | 待部署及實體裝置驗證 |

| Phase / page / scenario / mode | Legal production fixture and UI continuation | Blank points, drawing/orbit bounds, side strips and every target | Host cases / viewports / source-package evidence |
|---|---|---|---|
| 位移頁空白／已答，5°／中間／60° | production restore 後拖 B、選答案或檢查 | 所有主題起角及轉向的把手、近 A 預覽、空白與面板 | T0–T3 source＋package 全覆蓋；T4 另驗 |
| 速度頁無作圖／只有起點／完整正確／反向／其他錯線段 | restore 後選端點、改端點、改間隔 | B、節點按鈕、動態 U/V、答案與面板 | 同上 |
| 對齊動畫中及減少動態模式 | 正常進頁，或以 reduced-motion 直接對齊 | 動畫不得影響按鈕、空白、答案或保存 | 同上；靜態模式不能省略 |
| 遷移題空白／部分／完整 | restore 後操作不同角位置及反向 B | 新幾何、兩側空白及選項 | 同上，不能用主情境取代 |
| 檢查、返回三頁修改 | 每頁空白／部分均可進檢查，再返回 | 檢查頁無可拖舞台；面板末端提交可達 | 同上 |
| 已提交、committed、pending、technical lock | 用合法共享啟動／提交結果進入 | disabled targets 不截斷空白；結果／重試／fullscreen 可達，無清除 | 同上 |
| SVG 不可呈現的錯誤狀態 | 顯示明確技術訊息，不偽造可作圖畫面 | 保留可達控制及 host／panel 捲動 | 待驗；無另設 Canvas fallback |

依指南測試上下、慢拖、快速 flick、release 後、面板邊界、取消／lost capture／第二指／blur／切頁／提交鎖定；記錄每個 move、release 及其後的全部 owner 與非 owner 指標、可信事件、canonical state 與保存結果。取消回復按下前間隔；拖動中不保存暫態中間值，正常放手才保存新間隔。此活動沒有背景持續模型時間，無需用時間流逝豁免狀態差異。

## Scoring and tolerance

### 100 分 rubric 草案

按最終答案評分，最低 0、最高 100，60 分為草案達標線。一次提交包含三頁，逐項可得部分分，不用整頁全對條件。配分只在此表定義。

| ID | 學生答案 | 正確標準 | 分數 |
|---|---|---|---:|
| V1 | 主情境速度方向 | `forward-tangent` | 15 |
| V2 | 由位移推理速度方向的理由 | `displacement-per-time` | 10 |
| D1 | 選出需要比較的速度端點 | 已選節點包含 U 得 5 分、包含 V 得 5 分；不論先後，每個端點只計一次 | 10 |
| D2 | 末速度減初速度的箭頭方向 | 完整線段為 U→V 才得此項；V→U 及其他配對均不得方向分 | 10 |
| A1 | 主情境瞬時加速度方向 | `inward` | 15 |
| A2 | 由速度變化推理加速度方向的理由 | `velocity-change-per-time` | 10 |
| T1 | 遷移速度方向 | 該新情境的 `forward-tangent` | 10 |
| T2 | 遷移加速度方向 | 該新情境的 `inward` | 10 |
| T3 | 速率不變仍有加速度的理由 | `direction-changes` | 10 |
| 合計 | 主探究 70、遷移 30 | | 100 |

| Decision | Activity specification |
|---|---|
| Granularity | 七道單選各自按完整方向或推論評分，答對得該題全分，錯誤／未答為 0；方向與理由分開，互不扣連帶分。D1 評兩個端點，D2 評正確端點之間的箭向；D2 對完整 U→V 的依賴是真實作圖要求。A1／A2 不以作圖先正確為得分條件 |
| Unanswered / null | 所有單選及節點未答值為 null；空白得 0。只選 U 或 V、尚未選第二端，仍得 D1 的 5 分；只選 S 為 0；未完成線段不給 D2 |
| Extras / duplicates / penalties | 每題單選、僅一條節點線段，不可多選碰運氣；無負分、無重複操作分、無時間或次數加分；錯誤只失去該項分數 |
| Tolerances | 評分比較語意 key，沒有像素／角度繪圖容差或數值計算容差。1° 控制步長與 5–60° 觀察區間不參與得分；不能要求拖到最小值才給方向分 |

作圖部分分以學科證據區分「找到了甚麼」與「相減方向是否正確」，不把起點、終點各自機械地當成一題。以下列盡合法作圖狀態的得分：

| 學生作圖狀態 | D1 端點 | D2 箭向 | 作圖合計／20 | 反映的理解 |
|---|---:|---:|---:|---|
| 全空白 | 0 | 0 | 0 | 尚無作答 |
| 只有 S | 0 | 0 | 0 | 尚未選到要比較的速度端點 |
| 只有 U，或只有 V | 5 | 0 | 5 | 找到其中一個端點，連線尚未完成 |
| U→V | 10 | 10 | 20 | 端點與相減方向均正確 |
| V→U | 10 | 0 | 10 | 比較對了兩個速度末端，但相減方向反了 |
| S→U、U→S、S→V、V→S | 5 | 0 | 5 | 找到一個端點，卻把共同起點當成另一端 |

其餘獨立得分例子：全部未答但曾拖 B 為 0；只答對 V1 為 15；V1 錯但 V2 對仍得 10；作圖全空白但 A1 對得 15；V→U 加 A1 正確、其餘未答得 25；全部正確為 100。不存在重複扣分或「作圖錯便整頁零分」。

單選題不另細分「選中了同一直線但箭頭反向」的分數，因為它提交的是一個完整方向判斷；作圖題則明確包含選節點與定箭向兩個可分辨的操作。總分 60 是形成性報告門檻，不代表每個概念均已掌握；結果仍逐項呈現缺口，不另加隱藏必對題。端點名稱非法、題目定義非法屬解碼錯誤；合法但錯誤的方向／節點配對須照常評分。

## Phase/state matrix

草稿只用可實際呈現的 `edit`、`check` 兩種 phase；`task` 為 0 位移、1 速度變化、2 遷移。已提交／pending／技術鎖由共享 lifecycle 狀態決定，不以活動自存一個可偽造的 finished 布林值決定權限。

| Phase / variant | Current step | Required semantic state | Absent / retained data | Legal continuation / final-check route |
|---|---|---|---|---|
| edit／全新 | 0 | 完整 definition，三間隔 60／60／45，全部答案 null | 無學生線段；有模型示範幾何 | 拖 B、答題、跳頁或空白檢查 |
| edit／任一頁未答但觀察過 | 0、1、2 分別展開 | 合法間隔及 definition | 答案可全 null；不保存 seen/completed 旗標 | 更改間隔、作答或檢查 |
| edit／普通部分或完整作答 | 0、1、2 分別展開 | 任意合法答案組合；三頁間無答案前置 | 未來頁可已有答案，不能因導航先後拒絕 | 修改、清本頁或檢查 |
| edit／向量只選起點 | 任一 task；通常 1 | `deltaFrom` 為 S/U/V，`deltaTo` 為 null | 其他題可空白／部分／完整；畫面不虛構終點 | task 1 可選終點；各頁可檢查並提交部分分 |
| edit／完整向量：正確、反向、其他錯答 | 任一 task | 兩個不同且合法的節點 key | 錯答同樣可呈現、保存與繼續，不修正 | 改間隔、重新作圖、改終點或檢查 |
| check／空白、部分、完整 | 保存進入前 task 0／1／2 | 全份 definition、觀察間隔、答案 | 半條作圖合法；不新增假答案 | 明確提交或選指定 task 返回修改 |
| edit／由 check 返回 | 0、1、2 分別展開 | 保留所有欄位，phase 改 edit、task 改所選 | 可有跨頁答案與半線段；不另需 fromReview 旗標 | 同一般 edit，隨時再檢查 |
| 共享 review／已記錄 | 任意唯讀查看頁 | 合法 review 快照、重算及信任比較結果 | 答案不變；唯讀頁切換不再寫答案 | 查看回饋／fullscreen，無重新作答 |
| 共享 committed／已 commit 未 finish | check 結果畫面 | 已提交同一 payload | 凍結；不當成可編輯 draft | 只重試 finish 或查看 |
| 共享 frozen／結果未確認 | check 技術狀態 | 已驗證 pending payload | 不宣稱已記錄分數，無清除 | 重試同一 payload |
| load-error／不可信快照 | 技術狀態或受限既有結果 | 只使用可信 LMS 摘要 | 不把錯誤轉成新 attempt；不重建虛假答案 | 明確技術處理／fullscreen |

可保存狀態需依 phase×task 展開，再覆蓋 null／混合作答／完整作答、無線段／只起點／正向／反向／其他線段，以及三間隔最小／中間／最大與主題定義變體。這些是參數化測試分類，不是只測表內一個代表就宣稱全部通過。

| Transition / trigger | Preconditions | State changes / downstream effects |
|---|---|---|
| 拖 B 放手／時間按鈕 | editable，合法當頁 | 只更新該頁整數間隔；作圖 key 與答案不變；取消回復原值 |
| 選向量起點 | editable，task 1，起終點皆 null | 起點記所選 key，終點仍為 null；其他答案保留 |
| 選向量終點 | editable，task 1，有起點、終點為 null，選另一節點 | 終點記所選 key；不依正確性拒收；兩端已選時須先用修改控制，節點按鈕不直接改答案 |
| 重新作圖／改終點 | editable，task 1 | 前者把兩端清為 null；後者保留起點、只把終點清為 null；其他答案保留 |
| 切任務 | editable | task 改變；phase edit；保存所有頁草稿 |
| 進檢查 | 任一 editable 狀態 | phase check；保留 task 供返回；半作答也可進入 |
| 返回修改 | check | phase edit、task 改所選；無答案清除 |
| 清本頁 | editable，必要時確認範圍 | 清該頁所屬答案，間隔回預設；其他頁與 definition 不變 |
| 提交 | check，payload 通過結構／物理定義驗證 | 交共享提交；不得因未答／錯答而擋下 |

## Persistence contract

依 [snapshot/restore 契約](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract)，保存權威答案及可續作狀態，不保存畫面截圖或操作歷史。以下是資料規格表，沒有實作程式。

### answer schema v1

| 欄位 | 精確型別／合法值 |
|---|---|
| `schemaVersion`、`modelVersion`、`rubricVersion` | 三個必填整數，首版均為 1 |
| `definition.startIndex` | 必填整數 0、1、2、3，代表起點所在的 90° 區段 |
| `definition.startOffsetDeg` | 新 attempt 必有 0–89 整數，與 startIndex 組成全圓 360 個隨機角度；舊 v1 快照缺少此欄時按 0° 還原，不重新抽位置；若欄位存在但無效則拒絕 |
| `definition.sense` | 必填整數 −1 或 +1 |
| `definition.choiceShift` | 必填整數 0、1、2、3，保留舊 v1 快照的輪換次序 |
| `definition.choiceRanks` | 新 attempt 必有，依 QUESTIONS 順序保存 7 個整數；方向題 0–23、理由題 0–5，各自獨立抽選。舊快照缺少時使用 legacy choiceShift；存在但長度／元素非法則拒絕，不重抽 |
| `phase` | 必填 `edit` 或 `check`；review 快照只允許 check |
| `task` | 必填整數 0、1、2；check 保留返回位置 |
| `observation.positionGapDeg` | 必填整數 5–60；初始 60 |
| `observation.velocityGapDeg` | 必填整數 5–60；初始 60 |
| `observation.transferGapDeg` | 必填整數 5–60；初始 45 |
| `answers.velocityDirection`、`answers.accelerationDirection`、`answers.transferVelocity`、`answers.transferAcceleration` | 必填，值為 null 或方向字典四個語意 key 之一 |
| `answers.velocityReason` | 必填，null 或 V2 字典三個 key 之一 |
| `answers.accelerationReason` | 必填，null 或 A2 字典三個 key 之一 |
| `answers.transferReason` | 必填，null 或 T3 字典三個 key 之一 |
| `answers.deltaFrom` | 必填，null 或 `S`／`U`／`V` |
| `answers.deltaTo` | 必填，null 或 `S`／`U`／`V`；非 null 時 from 亦非 null 且兩者不同 |

| Snapshot | Exact schema / field types / allowed values |
|---|---|
| Draft | 共享 draft envelope＋上述 answer 全部欄位；edit／check 都可保存 |
| Review | 共享 review envelope＋同一份 answer，phase 必為 check；包括三觀察間隔，以重畫提交時的學生線段；結果只放共享比較 metadata |
| Unanswered encoding | 明確 null；缺少必填欄位不等於未答。錯方向／錯節點配對是合法學生答案，不得以正解驗證器拒絕 |

`deltaFrom`／`deltaTo` 是學生選擇的權威語意引用，必須驗證；兩者共同決定 D1 的端點分及 D2 的箭向分，不再各自對應一項 10 分。U/V 像素位置及生成的 DOM ID 是推導資料，重新計算。題目版本決定半徑、速率、起角推導及選項輪換，不允許快照另夾帶權限或評分設定。

| State category | Activity fields and treatment |
|---|---|
| Authoritative | 上述 definition、九個答案欄位、phase／task、三間隔；從這些重畫、重算並續作 |
| Transient | pointer、拖曳候選角、按下前備份、hover、放大窗、平移動畫進度、fullscreen、DOM；不保存 |
| Derived | A/B 位置、時間讀數、所有向量幾何、A 點的學生作圖方向提示、選項次序、是否可選終點、得分與通過狀態；由權威資料重建，不為自動方向提示增加答案欄位 |
| Version compatibility | 首版只接受 (schema, model, rubric) = (1,1,1)；未來版本另寫已測 migration，不能把未知版本當首版 |
| Size | 預算目標每份 answer＋共享 envelope 不超過 2000 bytes；正式上限仍為 4000 UTF-8 bytes，須實測 draft／review／pending 最長合法欄位，不能用預算代替證據 |
| Invalid finished review | 保持唯讀，只顯示可信記錄摘要；不開新題、不顯示不可信細項正誤 |
| Invalid pending-final | 先以共享 quarantine 阻止任何重試，保留 checkpoint 並技術鎖定；不可清除或覆寫 |
| Invalid editable draft | 首版採技術載入鎖，不提供活動內清除損壞資料捷徑；不能混同於合法 null／半作答 |

正常語意操作完成才保存；拖動中斷取最後已落實狀態。切頁／檢查須取消暫態拖動、回復按下前間隔再保存。註冊共享 draft provider，由共享 runtime 處理離頁；不另寫活動 pagehide／finish。恢復後跳過平移動畫並生成靜態對齊圖，保留同樣的可作答操作。

## Shared SCORM lifecycle

使用共享 `SimScorm.loadAttempt()`、`SimActivityFlow.startup()`、draft provider、`SimScorm.submitWithCallbacks()` 及 `SimActivityFlow.submission()`；不直接存取原始 LMS 欄位。依 [共享流程](../docs/simulation-scorm-production-guide.md#mandatory-shared-lifecycle-flow) 區分結果。

| Outcome / policy | Activity handler, controls and learner-facing message |
|---|---|
| Startup editable | 建立或恢復上述草稿，開放三任務與檢查 |
| Startup review | 驗證答案、重畫、重算，以 `reviewResult()` 比對；唯讀，不依快照內結果決定分數 |
| Startup frozen | 驗證 pending 的完整答案、重算及比較；合法才允許同 payload 重試 |
| Startup load-error | 「暫時無法安全載入作答」；不自動轉 standalone，不清除結果 |
| Submit success | 「已提交」；顯示可信分數及回饋，全部答案鎖定 |
| Submit committed | 「成績已記錄，結束連線尚未完成」；答案鎖定，只重試 finish |
| Submit frozen | 「提交結果尚未確認」；答案凍結、未確認分數顯示 --，只重試同一份有效 payload |
| Submit retry | retryable 為 true 時依共享契約回可編輯檢查並提示尚未提交；false 時技術鎖，不保證重試可行 |
| Review trust | mismatch／unknown／invalid recorded summary 均採共享不確定狀態；不把重算分數冒稱 LMS 確認結果 |
| Standalone refresh | 記憶體練習；草稿、檢查、已提交刷新都開始新空白題目，忽略舊持久 checkpoint，storage 被拒仍可用 |
| Moodle resume / recovery | 同 attempt 恢復 draft／review／pending；只有 Moodle 提供新 attempt 才重設；保存失敗須清楚提示，不虛稱已保留 |

## Test plan

本節保留驗證項目，實際已執行命令、通過範圍及限制列於後文；未勾選項目不冒稱已驗。

### 物理、教學及答案

- [x] 四個起點×兩轉向、遷移起點／反向及 5–60° 全部整數間隔，驗證位置先後、正 Δt、切向速度及正確向量相減。
- [x] Δr 是弦而非弧；平移保持速度大小與方向；Δv = vB − vA，反向線段等於負 Δv；S 不與 O 混淆。
- [x] 驗證有限間隔方向相對 A 的誤差為 δ/2，最小間隔仍不是精確極限；不出零時間／零除及不正確「完全等於」標示。
- [ ] 速度圖單一尺度、兩速度等長，短箭頭的幾何終點不因裝飾改變；虛線延長不被當作大小。
- [x] 未選答案／只操作／只看動畫均零分；rubric 各項與 100 分上限、60 分邊界均驗證。D1 每個 U/V 各 5 分，D2 僅 U→V 得 10；V→U 得 10、含 S 的完整線得 5、單 U/V 得 5；不得套回舊起／終點各 10 分規則。
- [ ] S/U/V 六種有向配對、三種半作答與空白均可正確呈現、評分；同節點點選保持狀態，無不可續作答案。
- [x] 方向與理由獨立得分；作圖錯／未答不取消 A1／A2；60 分只決定總分門檻，回饋仍顯示未掌握項目。
- [ ] 兩頁平均量定義與 V2／A2 的短時間推論一致；沒有把有限間隔的平均量當成 A 時刻瞬時量，也沒有用 Δv 縮短直接推斷加速度趨零。
- [ ] 「我的作圖方向」與學生線段同向，包括反向及含 S 的錯答；只在完整線段時顯示，改 B／恢復／重新作圖時同步更新或移除；沒有冒充正解、增加作答步驟或另存答案。
- [ ] 顯示選項輪換後仍按語意評分；教材參考速度與學生錯答分開；改 B 不自動修正我的線段。
- [ ] 主／遷移答案互不覆蓋；返回修改、重新作圖清兩端、改終點保留起點、清本頁範圍及所有空白／部分檢查路徑正確。

### 保存、續作與生命週期

- [x] phase/state matrix 的參數化合法變體逐項 production encode/decode/restore；分數相同，並執行一次合法續作，而非只比 JSON。
- [x] 缺欄位、錯型別、非有限／非整數／越界間隔、非法方向或節點、to 有值但 from 為 null、from=to、未知版本及不合法 review phase 分別拒絕。
- [x] 合法錯答案與 null／半作答不得被當作壞資料；未知 generated IDs 不作權威依據；錯誤題目參數不靜默修成另一題。
- [x] draft／review／共享 pending 最長合法內容實測 UTF-8 bytes ≤4000，包含最長選項字串與所有 envelope metadata。
- [x] 啟動四結果、提交四結果及不可重試分支、review 比對一致／不一致／未知均測 production 控制與畫面。
- [ ] invalid finished 保持唯讀；invalid pending quarantine 並阻止手動／離頁／BFCache 重試；技術畫面不聲稱已提交或通過。
- [x] source 與解壓包 standalone 刷新清除各階段答案，含舊／損壞 checkpoint 及拒絕 storage；fake LMS 另驗同 attempt 續作與新 attempt。

### 版面、觸控、套件

- [ ] 所有頁／phase／模式在上述尺寸、200% zoom、鍵盤及工具列變動下可讀；面板末端及檢查／提交可達。
- [ ] B 近 A 的放大窗、拖動／按鈕／鍵盤等價性、固定鏡頭、取消／第二指／blur／切頁／鎖定回復均驗證。
- [ ] source＋真正解壓 SCORM 執行 T0–T3 全矩陣，逐 move／release／after-release 驗 owner、非 owner、可信輸入及答案不受捲動影響。
- [ ] source＋package 的全螢幕進出、外部退出、拒絕／不支援、答案與 LMS 連線保持、各鎖定狀態可達均驗證。
- [x] manifest 包含所有 runtime 依賴，解壓實際啟動，無外部 CDN、測試檔或未宣告 sibling 資產。

### Test registration and CI selection evidence

遵循 [新增活動測試登記程序](../docs/simulation-scorm-production-guide.md#test-registration-for-new-simulations)。四個 Node entry 與一個活動 browser entry 已登記；沿用既有獨立觸控 runner，不另建重複 host 引擎。

| Item | Activity decision / executed evidence |
|---|---|
| Runtime resource declaration | `sim/manifests/circular-motion-vector-lab.xml`：7 個活動 runtime＋4 個 shared 相依；ZIP 另含根 imsmanifest.xml，共 12 files |
| Logical test entries | `sim/circular-motion-vector-lab/model.test.js`、`scoring.test.js`、`persistence.test.js`、`lifecycle.test.js`，已加入 registeredTests，scope 繼承活動目錄 |
| Browser entries / owner | `tools/circular-motion-vector-browser-regression.js`，kind browser、scope circular-motion-vector-lab；使用既有 Chrome/CDP driver 驗 source／package、版面、完整／空白／部分作答、SCORM 信任／續作、fullscreen 及 48 組可信拖動 |
| Case helpers | 首版不預建；如拆分 helpers，依真實 import 及 consumers 登記，不另當 executable test |
| Separate manual gates | 既有 manualBrowserTests 的 `tools/mobile-scroll-browser-regression.js` 追加本活動 production profiles 及 owned-operation probe；同一工具分開執行 source／package 的 T0–T3，T4 仍是必要的真實裝置部署驗證 |
| Registration check | `npm run check:tests` 已通過：251 entries／217 Node／34 browser／48 helpers／2 manual；本輪無新套件，CLI 使用原 checkout 已安裝、與 lock 相同的依賴 |
| CI selection preview | 已在 base `e8800209c53f7e08b19b49ffe09123f5891e1b89`、head `3777a5b7d7e2956df3f8208d25258873c02e2101` 執行 --plan：full／251 entries／packages all。實際首個理由是非部署測試 helper `sim/circular-motion-vector-lab/test-support.js` 沒有 runtime asset consumer，保守走全站；catalogue／registry 亦屬全站政策。見 `output/ci-tests/circular-vector-selection.json`；不把 preview 當驗收 |
| Actual GitHub verification | 對應本活動 runtime commit 的 Quality run 39575238920：checks 與 Node 四 shards 已 success，8 個 browser shards 執行中；尚無全站成功聲明，不引用計畫 36 紀錄 |

## Package-ready checklist

- [x] 本計畫具體草案經審閱，實際操作與評分無矛盾；必要 keyboard alternatives 已實作。
- [x] 活動物理、評分、phase restore／合法續作、lifecycle、所列已驗版面及 source／package T0–T3 觸控有證據；200% zoom 與真手機另列。
- [ ] `npm run check`、`npm run check:tests`、`npm test`、`npm run package:all` 及實際 base 至 HEAD 的 diff 檢查通過。
- [x] ZIP 根目錄有 imsmanifest.xml，所有依賴齊備且與實測 source 相符；解壓啟動與全螢幕通過。
- [ ] 已提交選擇預覽與 GitHub 驗證記錄對應實際候選 SHA；形成性評核限制有記錄。

## Moodle-ready checklist

- [ ] Package-ready 全部通過；真實 Moodle 學生帳戶能記錄空白、部分及完整作答的分數／狀態。
- [ ] 同 attempt 草稿續作、pending 重試、已提交唯讀與 Moodle 新 attempt 政策正常。
- [ ] 支援的實體手機／瀏覽器在 current-window 與有提供的 new-window 完成 T4 全 phase／模式矩陣，包含快速滑動及 release 後。
- [ ] 記錄真實 frame／scroll owner 與部署限制；本機模擬證據不代替實體裝置證據。
- [ ] 高風險伺服器驗證：目前 N/A（形成性）；若用途改變則必須重新評估並完成。

## 前兩輪文件交付紀錄（歷史：僅計畫階段）

- 2026-10-21：僅建立計畫 37，使用既有模板的全部必要章節；把學生流程、選項、節點作圖、100 分 rubric、草稿 schema、階段矩陣及未來驗證列明。
- 本輪不建立任何 runtime、manifest、測試或 registry／catalogue 改動，不改計畫 36，不 commit／push／部署。
- 文件檢查：已核對模板必要章節齊備、8 個本地文件連結及章節錨點有效、9 個評分項合計 100 分；檢視操作與保存狀態的一致性，新文件 diff 未發現空白格式問題。
- 活動程式、打包、瀏覽器、SCORM、真實 Moodle 與實體手機驗收全部尚未執行；配分、時間與版面參數仍屬待試教的設計草案。
- 2026-10-21 再覆核：補上兩次「平均量定義 → 縮短時間 → 瞬時方向」的教學銜接；節點使用完整語意標籤，A 點自動帶入學生作圖的方向供比較，不增加操作步驟。
- 本次將作圖 20 分改為「端點識別 10＋相減方向 10」；反向連線保留端點分，僅選到一端得 5 分。三頁仍為 25／45／30 分，不增題目，V2／A2 改為判斷短時間推論；選項字典與未來驗證同步更新。尚無活動實作或已保存作答，故目前仍是待實作的 v1 規格，不涉及既有成績遷移。
- 本次文件檢查通過：14 個模板必要章節、8 個本地連結／錨點、9 個評分項合計 100 分、三頁 25／45／30 分；部分分表的 6 列涵蓋 10 種合法作圖狀態且加總一致，舊選項 key 已移除，diff 無空白格式問題。這是文件與配分核對，不是活動測試或試教證據。

## 2026-10-21 實作與本地證據

實作保留修訂後的 25／45／30 分、端點 5＋5 分與箭向 10 分，以及合法空白／部分提交。沒有新增計算、播放、逐題解鎖或持久 standalone 成績。七個 runtime、四個活動 Node 測試、一個正式 browser entry、manifest、catalogue 及 README 已建立；`test-support.js` 僅供測試，不入包。

| 驗證 | 實際結果與證據 |
|---|---|
| 活動 Node | 四個活動測試通過；物理覆蓋 1,344 組起點／轉向／任務／間隔；評分覆蓋 128 種單選正解組合×10 種合法作圖狀態；保存覆蓋 17,280 組 phase／task／definition／間隔／答案／作圖分類，各自 draft＋review round-trip 後執行合法續作 |
| 快照容量 | 最長選項及合法 metadata 實測 draft 630、review 657、pending-final 884 UTF-8 bytes；皆低於 4,000 bytes；權威資料不包含 DOM ID 或權限 |
| 活動 browser | `node tools/circular-motion-vector-browser-regression.js` 通過 source／真解壓 package，48 組可信拖動、8 種 viewport×3 頁、完整 100、空白 0、部分 5／10／25 分、實際鍵盤、fullscreen 進出、draft／check／recorded standalone refresh、同 attempt check／recorded／pending resume、提交重試及錯誤唯讀。報告 `output/playwright/circular-motion-vector-lab/report.json`；engine Chrome 155.0.8059.86 |
| T0 source／package | `circular-vector-T0-{source,package}-phases-final.json`，各 16 列；320×500／390×844 的三任務、檢查、三頁結果及 renderer error；純 UI 路徑，無 restore 注入。Moodle pending／committed 模式由 T1–T3 覆蓋；T0 真正無 enclosing range，host 移動 N/A |
| T1 source／package | `circular-vector-T1-{source,package}-final.json`，各 42 列，含活動 19 profiles×2 viewport 與兩個已知正常活動作為捲動對照 |
| T2 source | `circular-vector-T2-source-320-final.json` 21 列；`circular-vector-T2-source-390-operations-final.json` 19 列，`circular-vector-T2-source-controls-390.json` 2 列；初始較早的 `circular-vector-T2-source.json` 僅作歷史空白／面板證據，不代替 owned-operation 最終報告 |
| T2 package | `circular-vector-T2-package-final.json` 42 列；同上述 19 profiles×2 viewport＋控制活動 |
| T3 source／package | `circular-vector-T3-{source,package}-final.json`，各 42 列；window 固定，指定 scrollOwner 元素為 owner |
| 面板連續手勢 | `circular-vector-panel-sequence.json`，320／390 px 的文字／按鈕起手、touchcancel、取消後再滑、100ms 間隔連滑及下一次背景滑動通過；監測中沒有 host style lock |
| 觸控命令 | 使用既有 `node tools/mobile-scroll-browser-regression.js --host=Tn --mode=source或package --phases=all --operations --viewports=320x500,390x844 --slugs=circular-motion-vector-lab,...`；T0 用 standalone／standalone-package，無 forwarding 或修改 host 的 receiver |
| 修正與重驗 | 初輪發現窄屏 B halo 侵入 32px 捲動帶，已調整圓盤幾何並重新驗 source／package；另修正 audit 等待 reload 時誤讀舊 document 的競態。最終採實際 UI 導航測取消，先前失敗報告保留為歷史，不列為通過 |
| 靜態與登記 | `node tools/check.js`、`npm run check:tests`、`node tools/check-docs.js plans/37-circular-motion-vector-lab.md README.md` 通過；registry 251 entries（217 Node／34 browser）、48 helpers、2 manual |
| 全站 Node | `node tools/run-tests.js --kind=node --report=output/ci-tests/circular-vector-node.json`：215／217 在 runner 時限內通過；既有 `sim/force-composition-construction-lab/persistence.test.js`、`tools/ci-prepare.test.js` 超過 120s，報告維持 timeout。兩者其後以各自 `node` 命令單獨重跑皆 exit 0；不改既有測試或時限，不冒稱原整輪已綠燈 |
| 打包 | `node tools/package-all.js` 通過，全部 SCORM ZIP 已驗；本活動 `output/circular-motion-vector-lab-scorm.zip` 為 12 files，source 與真解壓檔案逐 byte 一致；最終 ZIP SHA-256 `8F87B92FC1ED859FA0C75EAD82D9BEA945B829130D70EF6172726C85291CF041` |
| 範圍限制 | 尚未執行全站 34 個 browser entry／完整 npm test；不以活動專項或 selection preview 冒稱全站 CI 通過。200% zoom、實體鍵盤／手機與 T4 真 Moodle 尚無完整驗收證據 |

觸控報告位於 `output/playwright/`，記錄每個 move、release／after-release、canonical 答案與 suspend_data、實際 owner／全部非 owner、可信事件及 host style 監測。T0 的半作答／已答差異只改 pointer-events:none 的圖形及既有原生選項狀態，無新增 hit region；其完整語意續作由活動 browser 與 T1–T3 的 19 profiles 分開驗證，不把 T0 純 UI profiles 說成 Moodle restore。

## Sites 交付

- 專用 project ID：`appgprj_6ad878e05e148191aee5ef92740b63f1`。[正式試用網址](https://circular-motion-vector-lab.ieyp.chatgpt.site)，原生私人發布已回傳 succeeded。
- Sites source checkout：本 worktree 的忽略目錄 `output/sites/circular-motion-vector-lab/`。`.openai/hosting.json` 指定同一 project ID 及 static directory `dist`；dist 的根入口導向本活動並保留 query／hash，活動相依保持相對路徑。
- 新網站由使用者要求建立，已核對 current user 為 owner；custom audience 僅 owner 一人，無群組／外部訪客。保留私人權限，不將根目錄舊靜摩擦力 Site 改指本活動。
- 用官方 Sites helper 的 hidden stdin 接收 scoped credential；GitHub 開發庫與 Sites source 分開 commit／push，最終 11 個 runtime 資產逐檔 SHA-256 相同；官方 helper 封裝後交原生私人發布，沒有變更 audience。

| 正式交付 | 實際識別及結果 |
|---|---|
| GitHub runtime commit | `3777a5b7d7e2956df3f8208d25258873c02e2101`，已 push 至 `origin/codex/circular-motion-vector-lab` 並以 ls-remote 複核；未合併 main |
| Sites source commit | `1544d63c2e297e903b8a6ec6307c128806794c9f`，官方 helper 已推送並核對 source tree／remote HEAD |
| Site archive | `output/sites/circular-motion-vector-lab-release.tar.gz`；SHA-256 `96B37A7B3E32138C6B823F122ACCC9FCE20021330243B227AA31AA1E9B596249`；與已推送 Site source 對應，發布後不改 archive |
| Saved version | version 1：`appgprj_6ad878e05e148191aee5ef92740b63f1~appgver_24cac84b2fcc81919d99bb4f27a8efe5` |
| Deployment | `appgdep_6ad882da78848191a304446e6579cc15`，2026-10-21 17:16（澳門）回傳 succeeded；正式網址及 owner-only 存取保持 |
| 附屬證據 | `output/sites/circular-vector-runtime-verification.json`、`output/sites/circular-vector-deployment.json`；根入口 query／hash 保留已驗，已在 Codex 右側開啟正式網址 |
| GitHub CI | [Quality run 39575238920](https://github.com/frenselw/simlab/actions/runs/39575238920) 對應 runtime commit；plan、checks、node-1 至 node-4 success，browser-1 至 browser-8 尚在執行。發布文件與 browser reload 等待防競態屬後續測試／文件修訂，活動 runtime bytes 不變 |


## 2026-10-21 第一部分圖像修訂

依使用者回饋，圖中文字由 14px 放大至一般 18px，A／B 使用本地 LaTeX SVG 字形（一般 24px、極短畫面 18px）；數值 22px。位移改為 Δx，沒有向量箭頭或絕對值，與 Δt 一起顯示在圖區右上方。其他速度／加速度保留向量記號；定義、題目及回饋均沿用本地 CircuitMath，不引入外部 CDN。原有 44px B 拖曳區仍在實際位置，移除疊在點上的 B 字；標籤改為在圓外搜尋不遮擋圓周、向量、方向延長線或彼此的位置。

新 attempt 的起點為 `startIndex × 90° + startOffsetDeg`，均勻覆蓋 360 個整數角度；角度只在建立 attempt 時抽選。保存／還原保留同一角度，舊 v1 快照沒有 offset 時仍維持舊位置，不重抽題。評分與提交流程不變。

| 修訂驗證 | 實際證據 |
|---|---|
| 活動 Node | 五個活動測試通過；物理擴至 5,376 組；新 presentation test 檢查 11,520 組標籤幾何及全圓 360 個新起點；評分原矩陣不變；保存保留原 17,280 組舊格式 round-trip，另驗 offset 保存、續作及無效值 |
| 快照容量 | 加入最大 offset 的最長 draft／review／pending 為 650／677／906 bytes，仍低於 4,000 bytes |
| 最終 browser | source／真解壓 package 通過；各新增 32 組非正交起點／長短間隔／手機寬度的實際字形與數值避讓檢查，並重跑原有評分、resume、fullscreen、鍵盤與 48 組可信拖曳；`output/playwright/circular-motion-vector-lab/report.json` |
| 最終可信觸控 | T2 source／package 各 10 列（320×500、390×844；initial、第一頁 blank／answered／submitted／pending），所有 issues／errors 為空；包括真拖曳、取消、預覽及非 owner 捲動。報告 `output/playwright/circular-vector-labels-T2-source-final.json`、`circular-vector-labels-T2-package.json` |
| 視覺檢查 | 實際檢視 `source-first-part-5.png`、`source-first-part-60.png` 及速度變化頁手機截圖；修正窄屏速度符號與時間讀數的碰撞 |
| 套件 | manifest 增加 presentation runtime、本地 MathJax renderer／bundle／license；重建 SCORM，共 16 files；browser 已比對逐檔來源與解壓資產 |

以上為本次局部修訂的本地證據；先前完整 T0–T3 為初版歷史證據。本次不冒稱全站 browser、實體手機或真 Moodle 已重新驗收。


本次靜態檢查、check:tests（252 entries：218 Node／34 browser）及文件連結檢查通過。已提交比較的 selection preview 為 `bc2e120…37ccb27`，因新增測試登記而正確選取 full／252 tests；檔案 `output/ci-tests/circular-vector-label-selection.json` 僅為選取證據，不冒稱已在本機執行全部 252 項。活動 runtime hash 為 `e5506fe61932d77169363df379efebb8595262803dfa4fdf15516e19776b6bd4`，與最終 browser report 相符。

| 修訂交付 | 實際識別及結果 |
|---|---|
| GitHub runtime | `37ccb27ea818370893575828b8c368cf5127e6a3`，已 push 同一分支並以 ls-remote 複核 |
| Sites source | `644209e7ea6b9a1cd23343a7f21019e327af7c6d`，官方 helper 推送／封裝完成；15 個 runtime 資產與已驗來源及 archive 逐 byte 相同 |
| Site archive | `output/sites/circular-motion-vector-lab-labels.tar.gz`；SHA-256 `9512fa000a4f7196f2a6df7f9bdc956588c2ace6b5d112bbf246b61a357bdc8a` |
| Saved version | `appgprj_6ad878e05e148191aee5ef92740b63f1~appgver_a1c336af1f508191a37d5cf6ccec5245` |
| Deployment | `appgdep_6ad88bdc343881918dc32c200edab87f`，2026-10-21 17:54（澳門）回傳 succeeded；同一[正式網址](https://circular-motion-vector-lab.ieyp.chatgpt.site)，owner-only 權限不變 |
| SCORM ZIP | `output/circular-motion-vector-lab-scorm.zip`，16 files；SHA-256 `5b24e4ad74fd72bdfc980f2dbdf8b3c8885bbf3cd79a0282f9400b3ff8318cc6` |
| 證據檔案 | `output/sites/circular-vector-labels-runtime-verification.json`、`circular-vector-labels-deployment.json`；已開啟正式網址並關閉本次本機預覽 server |
| GitHub CI | [Quality run 39580367639](https://github.com/frenselw/simlab/actions/runs/39580367639) 對應本次 runtime，發布時仍 pending；本次本地證據不代替其全站結果 |


## 2026-10-21 速度圖整組置中修訂

依瀏覽器註解，右方速度圖改以 S／U／V 三點範圍的中心對齊速度圖區中心，而非把共同起點 S 固定於中心。每次間隔變動或 resize 都以當前向量重新計算平移量，維持向量長度比例；平移對齊動畫沿用此新起點。只改顯示座標，物理模型、端點語意、答案與評分皆維持原定義；沒有新 hit region 或保存欄位。

- `presentation.test.js` 新增 13,440 組角度／轉向／5–60° 間隔的整組中心檢查，與原有標籤／數學字形測試通過；其餘四個活動 Node entry 亦通過。
- 正式 browser 增加使用者 665×604 viewport；檢查各尺寸不同間隔及可信拖曳後的整組中心，沿用既有 source／真解壓 SCORM 評分、保存、fullscreen、鍵盤與觸控流程。
- 已檢視 `output/playwright/circular-motion-vector-lab/source-665x604-difference.png`；整組速度圖位於右圖區中央。此為本地瀏覽器證據，不代表實體手機或真 Moodle 驗收。

本次 source／真解壓 SCORM browser 全部通過（9 種 viewport×3 頁×2 套資產、48 組可信拖曳），報告 `output/playwright/circular-motion-vector-lab/report.json`；靜態檢查、check:tests 及文件連結檢查亦通過。T0–T3 的完整嵌入與實機驗收未於本次非互動圖形平移重新執行。


本次 runtime commit `26f0ec3a76c4d6faa3f91e8caa203a365c0b2de5` 已 push 並以 ls-remote 複核。已提交範圍的 selection preview 選取 affected／219 tests（報告 `output/ci-tests/circular-vector-center-selection.json`；不冒稱全部已執行）；check:tests 維持 252 entries。最終 runtime hash `774c96c6444baa1c2a8320d05e16ea34e740d50e1e429181f3371aeb476ecd87` 與 browser report 一致。

Sites source commit `0104013e97f0c1202856130f733d303e14f468c9` 已由官方 helper 推送及封裝，15 個 runtime 資產逐 byte 核對通過。原生私人發布回傳 succeeded：deployment `appgdep_6ad89123287c8191a0e69e48d7208d50`，version `appgprj_6ad878e05e148191aee5ef92740b63f1~appgver_7de5c2da8e4c81919444037407eb491a`，2026-10-21 18:17（澳門）。沿用[正式網址](https://circular-motion-vector-lab.ieyp.chatgpt.site/circular-motion-vector-lab/)及原有 owner-only 權限。

封裝：`output/sites/circular-motion-vector-lab-centered.tar.gz`，SHA-256 `0933378b4d3a25973106e7901df52245cf44b58709a93390e390b2721fcd3add`；重建 SCORM ZIP SHA-256 `805853093fe4de0e39fa3fa4c31091fbdaaa65a8b5af15a0429402bc52ee3157`。交付證據位於 `output/sites/circular-vector-center-runtime-verification.json`、`circular-vector-center-deployment.json`。[本次 CI](https://github.com/frenselw/simlab/actions/runs/39582094935) 發布時仍 in_progress，與上述本地證據分開記錄。


## 2026-10-21 主圖、大圖卡及中文名稱修訂

依使用者回饋，正常手機舞台提高至 52dvh；第一／三部分圓盤依可用寬高放大，桌面半徑上限由 165px 改為 300px。位置點半徑 6.5px、圓線 2.4px、路徑 6px，向量箭身及箭頭同步加粗；A／B 一般 28px。讀數留在圖旁，窄屏固定排列避免拖動期間換行令圓盤跳動。轉向文字移入操作指示，減少圖內文字遮擋；第二部分保留速度向量與位置圖可用邊界，驗證兩個速度箭頭的末端完整顯示。

四方向答案改為 2×2 大圖卡，SVG 填滿卡內空間；移除可見 radio 圓鈕及 1–4 編號。原生 radio 仍可聚焦及用方向鍵操作，整張圖卡可觸控選取，選中用 3px 藍框表示。理由題維持原來文字 radio；空白／部分作答、清除此題及評分規則不變。

第二部分的圖、操作按鈕、作答摘要及回饋統一使用「共同起點」「初速度末端」「末速度末端」。圖中文字以避讓配置及細虛線指回對應端點；矮圖區使用「起點／初速端／末速端」，固定按鈕保留全名。S／U／V 只作內部 key，既有 Moodle 保存資料不變，不重抽題或改評分。

本次 presentation Node 檢查：原有 11,520 組圓周標籤、13,440 組速度圖中心及 360 個新起點皆通過；另驗 47,040 組中文標籤版面，涵蓋 5–60° 全部整數間隔、轉向及窄／矮圖區。其餘四個活動 Node 測試亦通過。正式 browser 新增整張圖卡的可信觸控及原生方向鍵選答、中文按鈕名稱和箭頭邊界檢查；source／真解壓 SCORM 與手機 T2 嵌入的最終結果另記於下方。


最終來源／真解壓 SCORM browser 均通過：54 組 viewport／任務／資產排版，48 組可信 B 拖曳、整張圖卡可信觸控選答及原生方向鍵、既有空白／部分／完整成績與保存／提交生命週期。最終 runtime hash `b0443f03a9860f4c6dceea9191bf00be65ecf81138204cffb7aa3fa376e25dee` 與報告逐檔計算一致。

最終 T2 手機嵌入 source／package 各 4 列（320×500、390×844；initial 及第二頁已答），所有檢查通過，包含拖曳、取消、放大預覽及非 owner 捲動。報告 `output/playwright/circular-vector-large-T2-source-final.json`、`circular-vector-large-T2-package-final.json`；較早 `circular-vector-large-T2-source.json` 為中途歷史證據。靜態檢查、check:tests（252 entries）及文件檢查通過；未重做完整 T0–T3／實機／真 Moodle 驗收。

Runtime commit `39e36014832fa33bf6de0ecefca26cb5762685f9` 已 push 並以 ls-remote 複核。已提交範圍的 selection preview 為 affected／219 tests，檔案 `output/ci-tests/circular-vector-large-selection.json`；它是選取證據，不代表本機已執行全部 219 項。[本次 CI](https://github.com/frenselw/simlab/actions/runs/39620029340) 發布時仍在執行。

Sites source commit `cb4b6f736cd8e87ef272bc666c402a5b783539b9` 經官方 helper 推送及封裝；15 個 runtime 資產與來源／archive 逐 byte 相同。2026-10-21 22:49（UTC+8），原生私人發布回傳 succeeded：deployment `appgdep_6ad8d0ff50e08191bf0ec3283362313a`，version `appgprj_6ad878e05e148191aee5ef92740b63f1~appgver_6c6b66823aa48191ba83151a3ee85566`。沿用[正式網址](https://circular-motion-vector-lab.ieyp.chatgpt.site/circular-motion-vector-lab/)及 owner-only 權限。

Site archive `output/sites/circular-motion-vector-lab-large-cards.tar.gz` SHA-256 `9cc954070e7fb3f2ce14526ee3ad691cb874313fc5eb896d6d38b4672f609f44`；SCORM ZIP SHA-256 `293a0a23587f9bdbcf0daa284b3489f966422334456fb3337eded7c1d83bf643`。證據檔案 `output/sites/circular-vector-large-runtime-verification.json`、`circular-vector-large-deployment.json`。


## 2026-10-21 面板字級、圖上符號與獨立選項排序

依使用者回饋，檢查整個 Control Panel：正文、題目、文字選項、說明、清除此題、次要按鈕、端點狀態及回饋統一 18px；主／子標題為 22／20px。平均量公式改用 displaystyle，保留一般下標比例，分子／分母不再縮成小字。

Δx 除了數值讀數，也直接以符號配細引線標在位移箭頭旁；第二部分位置圖的兩支切向速度及右圖兩支速度均標 v₁、v₂。學生完成連線後，紫色線旁標 Δv，圖例清楚說明為「我作出的 Δv」；不預先畫出正確差向量。正式提交後的綠色參考差向量另以同色 Δv 標示。公式統一為 Δv = v₂ − v₁。標籤為非互動圖形，保留 A／B、中文端點名稱及原有觸控區。

之前只有循環輪換，新 attempt 改為每題獨立完整排列。保存排列編碼 choiceRanks，四選圖可達全部 24 種次序，三選文字可達全部 6 種；舊格式仍依 choiceShift 還原，學生答案與評分規則不變。模型測試遍歷所有排列，保存測試覆蓋新欄位 draft／review round-trip、非法排列及還原後續作；原 17,280 組舊格式矩陣保留。

五個活動 Node entry、靜態檢查及 check:tests（252 entries）通過。正式 browser 已驗 source／真解壓 SCORM：54 組排版、48 組可信拖曳，逐一檢查面板可見正文不小於 18px、圖上符號存在，及非平凡排列在拖動、check／return、Moodle reload 後保持相同 DOM 次序。已檢視第一部分與第二部分實際截圖。本次完整嵌入／實機／真 Moodle 驗收仍另列，不以本地瀏覽器取代。

本次最終 T2 source／package 各 4 列通過（320×500、390×844；initial、第二頁已答），報告 `output/playwright/circular-vector-symbols-T2-source-final.json`、`circular-vector-symbols-T2-package-final.json`。最長合法 draft／review／pending 為 684／711／942 UTF-8 bytes，低於 4,000 bytes。最終 runtime hash `b7d8e314ab1b52e7b5fb0d73da79a84687514e85607770b635589aa5d57ddb93` 與 browser report 一致。


本次 runtime commit `edd4a6270959c6065e1fa714c083192f9c4fb8f7` 已 push 並以 ls-remote 複核；已提交範圍的選取預覽為 affected／219 tests，檔案 `output/ci-tests/circular-vector-symbols-selection.json`（選取證據，不冒稱本機已跑全部）。[本次 CI](https://github.com/frenselw/simlab/actions/runs/39625041317) 發布時仍 in_progress。

Sites source commit `70c4976dbf6923465d17d081db1f3562b05a96e9` 已由官方 helper 推送／封裝；15 個 runtime 資產與來源及 archive 逐 byte 相同。2026-10-21 23:24（UTC+8）原生私人發布回傳 succeeded，deployment `appgdep_6ad8d93f01448191b2cbe56f621970ea`，version `appgprj_6ad878e05e148191aee5ef92740b63f1~appgver_a0a48ea0c63c8191836eee38a6bfe174`。沿用[正式網址](https://circular-motion-vector-lab.ieyp.chatgpt.site/circular-motion-vector-lab/)與 owner-only 權限。

Site archive `output/sites/circular-motion-vector-lab-symbols.tar.gz` SHA-256 `8255ecc34535472b2d079edc73d46ca2c304c85751140941e14bdcd61ddbdba8`；SCORM ZIP SHA-256 `87c457f56f50cc0f5d03eb5d928eccf51e295603ef44b2274ca828bcc9e78300`。證據檔案 `output/sites/circular-vector-symbols-runtime-verification.json`、`circular-vector-symbols-deployment.json`。


## 2026-10-21 透明標籤及教材記法修訂

依使用者明確要求，移除物理量與中文端點標籤的白色背景矩形，保留符號／文字及細引線，使背景真正透明，不以白塊遮蓋圓盤。位置圖標籤選位新增圓周相交代價，優先避開圓線。標籤可位於圓內的空白區，仍直接對應各自箭頭；不以背景色掩蓋位置衝突。

整個活動的圖內、面板定義、選項文字及回饋均採教材式記法：Δx、Δv、v₁、v₂、平均速度及平均加速度均不加上方向量箭號。保留真正表示運動／位移／速度變化方向的幾何箭頭，物理模型、答案、評分、已保存選項次序均不變。此為使用者對共用 notation 習慣的明確例外，歷史段落仍保留先前當時的記法與證據，不代表現行標籤樣式。

本次 presentation 測試通過，沿用原有圓周／中文端點／速度圖中心檢查；新增 48 組方向／間隔的 Δx 標籤不跨圓周檢查，以及不產生 vector accent 的字形檢查。正式 browser 新增各頁直接檢查無標籤背景 rect、無向量箭號 TeX；以來源及真解壓 SCORM 重跑既有流程。此圖形樣式變更沒有新的觸控區、保存欄位或評分分支，完整 T0–T3／實機／真 Moodle 本次不重作。

本次最終 source／真解壓 SCORM browser 通過：54 組 viewport／任務／資產排版、48 組可信拖曳及既有評分／保存／提交流程；靜態、check:tests（252 entries）與文件檢查通過。已檢視第一／第二部分實際截圖。Runtime hash `31934d7bda2a5ef4a4bc3d3ada444841703731df798a7666b6148b472a6407bd` 與最終 browser report 一致。


本次 runtime commit `d7ceeadd219535d87e190d410d32e29a339d1e89` 已 push 並以 ls-remote 複核；選取預覽為 affected／219 tests，檔案 `output/ci-tests/circular-vector-plain-selection.json`，僅為選取證據。[本次 CI](https://github.com/frenselw/simlab/actions/runs/39626709303) 發布時 pending。

Sites source `853434168476767e47e46775c350d61bd461c445` 經官方 helper 推送／封裝，15 個 runtime 資產逐 byte 核對。2026-10-21 23:34（UTC+8）原生私人發布 succeeded：deployment `appgdep_6ad8db8888888191bda00e9c32ae1514`，version `appgprj_6ad878e05e148191aee5ef92740b63f1~appgver_c3eee650a5d48191b07fc9a21969557a`；沿用[正式網址](https://circular-motion-vector-lab.ieyp.chatgpt.site/circular-motion-vector-lab/)及 owner-only 權限。

Archive `output/sites/circular-motion-vector-lab-plain-labels.tar.gz` SHA-256 `18dad4c527fe85359579385e7cbf7ce7ee9e75c0acd5f9cdb43e19e8e81da05d`；SCORM ZIP SHA-256 `35b1c6cce6f4df16771d9fe8087958c17339741688c5c7ec1b9fcd8ecb4ee6f1`。證據：`output/sites/circular-vector-plain-runtime-verification.json`、`circular-vector-plain-deployment.json`。


## 2026-10-22 移除標籤引線及桌面頁首靠右

依使用者回饋，移除 Δx、v₁、v₂、Δv 及中文端點名稱的虛線引線，沿用透明、無向量上標箭號的教材記法。物理量符號放在各自箭頭旁的空位；中文名稱增加端點附近的候選位置，再以既有避讓規則選位，避免闊畫面因固定網格而把名稱放得太遠。真正表示位移／速度變化方向的延長虛線屬教學內容，仍保留。

桌面（寬度至少 900px）三個任務按鈕改為自然寬度，與「檢查答案」集中在頁首右方，全螢幕按鈕仍在最右側。沿用手機第二行任務導覽及矮屏下拉選單。沒有更改答案、評分、保存資料或觸控區。

驗證新增 2940×800 闊畫面、桌面按鈕間距及無標籤引線檢查；presentation 測試增加闊圖端點名稱距離上限，原有避線、中文名稱及物理量標籤檢查通過。最終來源／真解壓 SCORM 瀏覽器及發布證據補記於下方。


最終 source／真解壓 SCORM browser 通過：10 種 viewport×3 頁×2 套資產，共 60 組排版、48 組可信拖曳，以及既有空白／部分／完整評分、保存、提交、fullscreen 與鍵盤流程；零瀏覽器例外。已檢視第一部分、手機及 2940px 闊圖截圖。最終 runtime hash `979108d6d9a92eedbc044324e73c411b699ea07fcb7d027a74c3a4b14ee2ad16` 與報告相同；presentation、靜態、check:tests（252 entries）與文件檢查通過。沒有新增互動區，本次未重新做完整 T0–T3／實體手機／真 Moodle 驗收。

Runtime commit `3d936c19df41bfd34178359decc5b5660b836649` 已 push 並以 ls-remote 核對。已提交範圍的選取證據存於 `output/ci-tests/circular-vector-no-leaders-selection.json`，僅代表選取，不代表全部被選項目已執行。

Sites source `b4ecf4e650eab7f4083d6dbfe3f67bc0a4486f31` 經官方 helper 推送／封裝，全部 15 個 runtime 資產與 archive 逐 byte 核對。2026-10-22 00:04（澳門）私人發布 succeeded：deployment `appgdep_6ad8e27c48108191ab80ca8121b31fa5`，version `appgprj_6ad878e05e148191aee5ef92740b63f1~appgver_e5120506b37881919ad1f9d0e7e7be4f`。沿用[正式網址](https://circular-motion-vector-lab.ieyp.chatgpt.site/circular-motion-vector-lab/)及 owner-only 權限。

Archive `output/sites/circular-motion-vector-lab-no-leaders.tar.gz` SHA-256 `f06f6c9a87e999b87bbfb077c6f54eec482ee278418fd2c7c1e55f361dc52655`；SCORM ZIP SHA-256 `96fc1bb2166e5f5041ad7dadcf585ffe60061ab8246d0ca9c5afb8014ee6a725`。證據：`output/sites/circular-vector-no-leaders-runtime-verification.json`、`circular-vector-no-leaders-deployment.json`。


## 2026-10-22 雙獨立全面審核：修正決策

兩位 reviewer 均獨立覆蓋完整活動；第三位核實及去重後採納兩項 P2。F37-01：窄速度圖的 Δv 可與中文名稱碰撞，橫屏單位標題也可能裁切；沿用短中文名稱並補足合法空位候選、適配標題，保持透明無引線、不改向量端點或評分。F37-02：數學 renderer 啟動失敗須在活動初始化邊界顯示技術鎖定，關閉假作答控制、保留 fullscreen，且不建立草稿／寫成績；不新增 fallback renderer。

修正範圍為 presentation、main 與既有 Node／browser 回歸；權威資料、rubric、SCORM schema、manifest 依賴不變。新測試須覆蓋兩份報告的合法 production fixture、不同轉向／間隔／錯答及提交後參考符號，以及 renderer ready rejection／bundle 缺失。修正後兩位再次全面複核，由第三位整理；只有兩位同輪皆無新 finding 才結束。


F37-01 的版面實作補充：高度 ≤400px 的左右面板斷點由 480px 移至 700px，窄橫屏改用全寬舞台及下方面板，避免把兩圖各壓成約 123px。極矮（≤250px）頁首採 44px 控制的緊湊間距，fullscreen 觸控區不縮小，騰出圖區高度；因此需補執行受影響尺寸的 source／package 手勢檢查。數學標籤優先安排較寬符號，既有候選不足才掃描可用空位，不以背景遮蓋或拋錯代替合法配置。


第二輪複核過程另確認極矮左圖 A／v₂ 仍可能碰撞，並補修後再交兩位全面再驗。現在先更新讀數再選位，以實際讀數 SVG 框、O 字形、A／B 及點／線共同避讓；極矮速度頁可用讀數兩側空位，讀數背景透明。A／B 候選增加 42／60px 中間偏移，避免合法 review 因無候選而進入 technical。

兩位 reviewer 對最終 runtime hash `2ca19d3da787f25c1f9e86ae327022514a9e7fd8a75e1faf7484dfe2e53d55bd` 各自完整複核，F37-01／F37-02 皆關閉，兩位均沒有未處理的新 finding。現有五個 Node entry 全通過；新增 14,112 組右圖中文／物理量／錯答／參考量共同配置，以及 2,160 組極矮左圖整數角度／轉向／review／速度／讀數／O 避讓。正式來源／真解壓 SCORM browser 通過 60 組排版、48 組可信拖曳、每套資產 20 組左右實際字形及 2 種啟動故障，零例外；完整初輪／複核結論及驗證界線另見最終審核報告。
