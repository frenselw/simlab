# 牛頓第三定律：反作用力作圖挑戰

狀態：**2026-09-28 已完成實作及本機 package-ready 驗收；真實 Moodle／實體手機驗收待進行。** 以下保留已批准的設計契約及實際證據；原規劃階段記錄標為歷史。

- 專用分支：`codex/newtons-third-law-reaction-force-lab`。
- 基準：`main`，`9fea6f1`。
- 由[新活動計劃範本](NEW-SIMULATION-PLAN-TEMPLATE.md)建立，依[共用風格](00-shared-platform-and-style.md)及[製作指南](../docs/simulation-scorm-production-guide.md)。
- 主要參考：[共點力平衡基礎版](21-force-equilibrium-diagram-lab.md)及[進階版](22-force-equilibrium-advanced-diagram-lab.md)。本活動不以物體平衡為前提。

## 建議的學生體驗

每題先呈現一個物體的完整已知受力圖，標明力的種類、方向及大小。學生逐一為指定的已知力畫反作用力：**選受力物體 → 選起筆點 → 畫方向及長度 → 標明力的種類**。種類可以先選或後補，沒有強制答題順序。

每個指定力只有一個反作用力作答格，避免把辨認配對變成猜應畫幾支箭頭。學生可把反作用力畫在原物體、另一個錯誤物體、錯誤起點，亦可畫錯方向、大小或種類；這些都是可保存、可提交的答案，不會被介面自動修正。

第一版採五種情境各一題，共八支反作用力。題目次序可直接跳轉，每題內有「下一個反作用力」，最後有「下一題／檢查作答」。導航顯示未開始、作答中及已作答，不在提交前標示對錯。

## 五種題目

以下是未鏡像例子；正確答案欄只供設計及提交後回饋。A–E 是固定題型代號，出場次序另行隨機。

| 題型 | 預先呈現的研究物體及受力 | 要學生補畫的反作用力 | 核心辨認及隨機性 |
|---|---|---|---|
| A 粗糙斜面上的滑塊 | 木塊沿斜面勻速下滑；已畫重力、斜面支持力、沿坡向上的滑動摩擦力 | 木塊對斜面的壓力，垂直坡面向內；木塊對斜面的摩擦力，沿坡向下。共2支，兩者均作用在斜面 | 支持力的配對不是重力；斜面的摩擦力方向與木塊所受的相反。坡向、坡角、重量隨機 |
| B 兩物體一起加速 | 外力推動小塊 A，使它推著 B 在光滑水平面上一起向右加速；完整畫出 B 所受的重力、地面支持力及 A 的水平接觸推力 | B 對 A 的接觸壓力向左；B 對地面的壓力向下。共2支，作用在不同物體 | 加速不影響相互作用力等大；質量不同不代表作用力較大的一方會「勝出」。整體左右鏡像、質量及加速度隨機 |
| C 彈簧與小車 | 光滑水平軌道上的小車接著水平彈簧，從變形位置由靜止釋放的一刻；已畫重力、支持力及彈簧作用於小車的力 | 小車對彈簧的力，沿彈簧軸與已知力相反；小車對軌道的壓力向下。共2支 | 同時支援拉伸及壓縮，並明寫變形狀態。彈簧在左／右、拉伸／壓縮及力值隨機；不得只出壓縮版本 |
| D 繩吊小球／擺球 | 已畫小球的重力及繩拉力；靜止垂直懸吊，或在指定瞬間沿圓弧運動，條件明示 | 小球對繩的拉力，畫在靠近小球的繩端，沿繩背離固定端。共1支 | 反作用力直接作用在繩上，不能換成遠處固定架所受的力。靜止／擺動、擺角、重量及瞬時速度尺度隨機 |
| E 地球與下落物體 | 地球及附近的小球以誇張比例顯示；小球離地、忽略空氣阻力，只受指向地心的萬有引力（重力） | 小球對地球的萬有引力，從地心沿兩者中心連線指向小球，大小與已知重力相同。共1支 | 不能畫在小球上，不能選支持力，也不能因地球較大而畫較大的力。小球方位及已知力值隨機 |

A–D 的重力仍完整呈現，旁註「本題毋須畫重力的反作用力」；它不是漏畫的力。E 專門處理這個配對。E 採離地小球以免多出支持力；標示「物體大小及距離為示意，不按比例」，力箭頭仍使用本題共同的大小比例。

D 的動態版本是**擺球在某一瞬間的受力**，不宣稱整段垂直圓周運動均速，也不額外畫一支「向心力」。第一版不增加力矩求解或剛體自轉題。

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `newtons-third-law-reaction-force-lab`；辨認兩個相互作用的物體，畫出等大、反向、同作用線及同類型的配對力，區分反作用力與平衡力 |
| Learner task / main interactions | 五題、八個配對；已知受力圖唯讀，學生選受力物體、起點、力種類並拖動箭尖；可改物體／起點、刪除、復原、下一步、檢查及提交 |
| Runtime files / libraries and justification | 原生 HTML/CSS/JS、SVG、Pointer Events；`index.html`、`styles.css`、`main.js`、`model.js`、`generator.js`、`scene.js`、`notation.js`、`scoring.js`、`persistence.js`、`ui-runtime.js`；沿用三個 shared 檔案，無新增依賴的需求 |
| Assessment risk / trusted validation | `formative`；100分、60分達標，瀏覽器評分只供形成性練習；高風險伺服器驗證不在本版範圍 |
| Out of scope | 由學生求出題目中各力大小、計算加速度／力矩、任意多物體碰撞引擎、連續追蹤運動中的作用點、繪製所有環境物體的完整受力圖、電磁及相對論力學 |

## Catalogue metadata (`sim/config.js`)

以下為已批准的目錄規格；完成 package-ready 後登記為 `active`。

```js
{
  title: "牛頓第三定律：反作用力作圖挑戰",
  folder: "newtons-third-law-reaction-force-lab",
  categories: ["Mechanics"],
  description: "從斜面、接觸推動、彈簧、繩與萬有引力五個情境，選出受力物體並畫出反作用力的作用點、方向、大小與種類。",
  tags: ["physics", "mechanics", "newtons-third-law", "action-reaction", "forces", "drawing", "scorm"],
  status: "active"
}
```

## Physics or subject model

### 物理定義與用字

- 給定 B 對 A 的力，所求是 A 對 B 的力：`F(A→B) = −F(B→A)`，箭頭字樣明確表示「施力物體 → 受力物體」。向量等式與力的大小分開排版。
- 兩力同時存在，分別作用於不同物體；運動狀態不是它們是否等大的條件。只有分析包含兩物體的整個系統時，才可把它們視為相消的內力；不能說它們在單一物體上互相抵銷。[OpenStax 第三定律](https://openstax.org/books/university-physics-volume-1/pages/5-5-newtons-third-law)
- 本版都是理想化接觸、繩／彈簧與牛頓萬有引力，按相同相互作用的兩力共線表示。不是任取一支方向相反的力就構成配對。
- 種類選項固定為：**接觸正向力（支持力／壓力）、摩擦力、繩端拉力、彈力（彈簧接觸）、萬有引力**。所有作答格都可選全部五類，不按答案篩選；不把「反作用力」本身當作力的種類。
- 支持力與壓力在這些題目中都屬接觸正向力，名稱差異不導致錯判。繩端拉力及彈簧接觸力的標籤須按實際施力／受力物體敘述，不能將小車對彈簧的力寫成彈簧對小車的力。
- E 中地球受到的是小球對它的萬有引力，不寫成「地球所受的重力」。以球對稱地球及小球近似質點，合力沿中心連線，地球的等效作用點取地心。[OpenStax 萬有引力](https://openstax.org/books/university-physics-volume-1/pages/13-1-newtons-law-of-universal-gravitation)

### 題目生成與大小的來源

座標用世界 x 向右、y 向上，角度逆時針；鏡像同步處理物體、文字、箭頭、作用點及答案。模型的力用 N，長度不是任意顯示參數。

| 題型／變數 | 生成規則與必須成立的物理條件 | 可見資訊 |
|---|---|---|
| A | θ取20°、30°、40°；重量W取10、15、20 N。N=W cosθ，f=W sinθ，取μₖ=tanθ，確保勻速下滑。接觸合力的作用點取重心鉛直線與底面的交點，木塊截面高／底寬取0.6，並驗證交點位於底面內；N與f在此接觸合力點分解，避免畫成有未平衡力矩卻不轉動 | 坡角、運動狀態、三力大小與方向；學生不用求μₖ |
| B | 示意g=10 m/s²，B質量2或3 kg，A質量1 kg；a=4或6 m/s²。B受F=m_B a、N=W=m_B g。外部驅動作用於A，大小足以令兩塊共同加速；水平接觸力通過兩塊中心高度 | 指定B、地面光滑、共同加速方向、三力；接觸推力標F，其正確種類的反作用力標F′ |
| C | W取10或20 N；已知彈簧力Fₛ/W取0.5或0.75；選正k及相容變形量。N=W，釋放時a=±Fₛ/m；彈簧水平且經小車中心高度 | 明寫已拉長／已壓縮、當刻由靜止釋放、彈簧的固定端及三力 |
| D | 靜止版θ=0、T=W。擺動版θ取−30°、0°、30°，v²/L取0.5g或g，T=m(g cosθ+v²/L)>0；沿切線速度與重力切向分量相容。θ從向下鉛直線量度 | 狀態、繩走向、T與W；只需用已知T畫配對，不要求學生推導向心加速度 |
| E | 小球在地球上方不同方位，例如從向右方向起計45°、75°、105°、135°；已知引力取8、12、16 N。使用一致的m與近地g描述；圖中誇張大小不代入物理計算 | 小球與地心、中心連線、指向地心的已知引力；空氣阻力不計 |

內部先以未捨入值驗證運動條件。生成器v2的新作答把已知力取到公開作圖刻度：低於10 N每格0.5 N，10 N或以上每格1 N，令所有已知大小均可精確畫出；例如27.99 N改成28 N。原始物理值與取整值分開，取整誤差不超過相鄰半格且小於5%；介面說明數值按作圖刻度取近似值。參考箭長、標示值、標準答案及大小評分均用同一取整值，不宣稱取整後的分量和恰為零。配對方向仍為原力加180°。v1只供恢復舊attempt，保留原0.01 N力值及原分數，並提供0.01 N微調按鈕，舊題也能畫出相同數值。

新作答生成一次 uint32 seed及五題排列；每類的幾何、變形／運動狀態和力值由版本化有限參數表決定。Moodle同attempt、換題、清本題／全部、復原及pending重試不重抽；獨立刷新或Moodle提供新attempt才重新生成。題型與視覺裝飾使用分離子序列。

### 受力物體、起點及接觸處的歸屬

本活動不能沿用兩個平衡活動「全部箭尾固定在指定物體重心」的模型，也不能沿用其方向相關的顯示半徑／箭長不計分規則。

1. 學生先在面板選「這支力作用在哪個物體？」；列出場景中的相關物體，包含原研究物體。初始不預選正確物體。圖中保留物體名稱標記；物體選擇集中於面板，避免窄手機圖中多個44px按鈕互相遮擋。
2. 被選物體顯示它的**全部公開起筆標記**：中心、可見接觸合力位置或繩／彈簧端點。學生先在面板選任一公開標記，再從圖中唯一的44px起筆抓手拖出箭頭；全部標記仍可選，避免中心和接觸點接近時命中區重疊。不按目前所求力隱藏錯誤標記，不考微小像素命中。
3. 接觸界面兩側可以有相同的幾何座標。答案須獨立保存`recipientBodyId`，並在圖旁及面板明示「此箭頭畫在：木塊／斜面／繩……」。不可只靠箭尾在哪個多邊形內推斷歸屬，也不可為了區分物體而把力任意平移成兩條平行作用線。
4. 因此即使學生在同一接觸位置畫出反向箭頭，但選的是原木塊，它仍是錯誤受力物體的答案；可以保存及提交。中心起點也保留為可選點，不自動改成正確接觸點。
5. 接觸起點是分布接觸力的理想化合力位置；提示只說明「接觸力由接觸標記起筆、引力由中心點起筆」這個通用約定，不顯示本題正確物體。第一版不做在空白任意位置落筆的自由畫布。
6. 由面板更換受力物體會清除本格不再適用的起點及箭頭，保留力種類，並可復原；更換同一物體的起點只平移箭尾，保留方向及物理大小。兩種行為均需明確提示影響範圍。

### 箭長與運動表示

- 同題所有已知力與學生力共用`L=sF`的線性比例尺，s只與穩定的版面配置有關，不因物體、力種類或箭頭方向而變化；畫面顯示力尺。兩力等大必須等長。
- 絕不複製原活動將0–1000顯示長度按方向可用半徑重映射的做法。改變視窗大小要等比例重繪所有力，不能改force值或分數。
- 可調大小範圍每題統一為0.01至3倍本題最大已知力（N），不按所選目標力訂上限。短箭頭可保留大hit area；箭尖必須仍在模型端點，不能為了最短可見箭長而改大小。
- 手機優先保證已知箭頭及正確配對完整可見；有意畫得太長的錯誤箭頭不得被夾回「正確」長度。若超框，明示超框並提供邊界編輯抓手／大小微調，保存真值；非等比例縮短畫面上的箭頭不允許。實作時須以最短iframe專項驗證這個策略。
- 這是指定瞬間的相互作用力圖。A的低對比地面紋理反向等速平移；B的地面紋理反向加速，由6 px/s在4秒內升至46 px/s的顯示上限，並註明為限速運動示意。物體、接觸面、起點及所有力向量保持原位。C–E保留指定瞬間：彈簧剛釋放時速度為零、之後加速度會改變，不套用B的勻加速動畫；D另有淡圓弧軌跡。
- 動畫按經過的可見播放時間計算，暫停、隱藏頁面及非作圖／檢討階段不累積時間；同題切換配對或重繪不跳回原位，切換題目則由慢速重新展示。動畫不保存到作答快照，也不改已知物理量。
- 運動提示不隨學生錯誤作圖改變；已知物體受力圖在開始已完整顯示。背景可暫停及尊重reduced motion，但不把「暫停觀察」說成物理靜止。

## Responsive layout contract

依[共用版面](00-shared-platform-and-style.md#layout)；沿用兩個平衡活動的三區、色系、數學字體與箭頭構造。

| Decision | Activity specification and reason |
|---|---|
| Three regions | header：五題及各反作用力進度、檢查；stage：完整已知力圖與學生箭頭；panel：題意、所選原力、受力物體、種類、編輯及下一步 |
| Desktop / tablet | 參考≥820px或≥600px且高≤520px左右排版，panel約18–22rem；保留大力名、大箭頭，適合投影；不逐字複製舊模型的縮放算法 |
| Control-panel classification | `bounded split-panel`，選物體／力種類時仍需看場景；panel獨立捲動 |
| Phone stage and controls | 初始沿用約44dvh，短高時重排；已知力數最多3、學生力每題最多2。當前配對突出，其餘力仍可辨，不靠縮小字體容納 |
| Phone text | 控制16px，必要圖名／讀數至少14px，桌面圖力名約22–26px；preview數值16–18px；物體中心只標點，不印「重心」 |
| Viewports | 320×400、320×500、390×500／600／844、740×360、768×900、1024×768、1280×900；toolbar變化、200% zoom；無數字鍵盤輸入，軟鍵盤N/A |
| Scroll topology | 左右各≥32px可用host捲動帶；blank stage歸host，panel只捲自身；hit targets不蓋側帶；activity document無第三個scroll owner |

已知箭頭與學生箭頭用不同的固定角色色及文字區分；顏色不按答案對錯變換。相交箭頭由面板選取，不修改物理方向來避讓。文字可移位加細引線。依2026-09-28使用者要求，B、C水平接觸情境的支持力與重力錯開顯示：重力保持原位，支持力及該接觸處的全部公開標記沿水平接觸面向外移0.3個場景單位（鏡像同步）。由該標記畫出的任何學生箭頭、抓手、preview及參考答案共用同一顯示位置，因此支持力與正確反作用力仍共線；錯誤物體／力種類不會自動修正。這是圖示位置的例外，原始物理幾何、作答的物體／起點ID、方向、大小、版本及評分不改，其他情境不移位。

## Navigation, submission and reset

| Decision | Activity specification |
|---|---|
| Navigation | 五題independent直接跳轉；每題指定力用小分頁。同一題切換配對、選物體／起點及重繪保留面板捲動位置；換題及進出檢查才回到題意頂部。所有切換保留答案，取消未放手操作；下一步只是引導，沒有完成門檻 |
| Final check access | 每個editable狀態均可到檢查，包括未選物體、只選種類、只選起點及畫圖未標種類；拖動中的工作值不當作已完成答案 |
| Incomplete submission | 列出每題已選物體／已畫／已標種類數，容許明確提交空白或部分答案；最後一題不自動交卷 |
| Editable reset | 清本格、清本題、清全部；已有答案時說清範圍並確認。全部清除保留seed、題目及順序，不換題；undo/redo保留當頁有限操作歷史 |
| Scored / pending attempt | 已提交review-only；pending frozen只重試相同提交。無清結果／重新開始按鈕；獨立refresh及Moodle新attempt按共用契約 |

| Step / question | Required upstream data and why | If missing or changed | Legal next actions / final-check route |
|---|---|---|---|
| 所有A–E | 只需該seed生成的已知力及候選物體；互不依賴 | 無答案合法 | 選物體／種類、畫圖、換題、檢查 |
| 從標記起筆 | 本格已選一個候選受力物體 | 未選則只提示選物體，不替學生選答案 | 選物體、改種類、下一步或檢查 |
| 改物體／起點 | 既有同格資料 | 按前述真實依賴清除或平移，不影響其他格 | 可復原及繼續；始終可檢查 |
| 從檢查返回編輯 | 保留全部權威答案及returnToCheck | 不重抽、不刪未答項 | 改答案、返回檢查、明確提交 |

完整作答標記派生自本格的物體、起點、箭頭及種類都非null；錯誤內容亦算已作答。題目完成色只在所有指定格有作答時出現，不洩露正確性。底部顯示「本題已作答1/2」及明確下一步。

## Diagrams, notation and assistance

| Decision | Activity specification and reason |
|---|---|
| Notation | 已知力N、f、T、Fₛ、G及大小採math serif、變量斜體、真下標與正體N單位；圖上可用短標籤，面板完整寫施力／受力者。原生選單只用中文，旁邊另排數學符號 |
| Arrow graphics | 沿用單一連續實心箭頭，箭尖精確落在力向量端點；給定與學生共用比例尺；標籤避讓但不移動作用線 |
| Snap | 起筆從公開標記選擇。方向吸附到水平／鉛直、可見斜面平行／垂直、繩／彈簧軸、地球中心連線，全部雙向；touch入6°出9°，mouse/pen入4°出6°。不得把反向當唯一可吸附方向 |
| Length assistance | 拖動大小採公開刻度：低於10 N每格0.5 N，10 N或以上每格1 N，拖動最小0.5 N。預設取最近刻度，已吸附時在相鄰半格外再容許0.18格才跳值，減少手指抖動；10 N交界按上下各自格距處理。v2新題提供±0.1 N微調，v1舊題提供±0.01 N微調；既有0.01 N保存精度不變，舊答案恢復不量化。所有力值同規則，不對正確大小設特殊磁吸；計分仍採原±10%容差，與吸附分開 |
| Touch preview | 起筆及箭尖精調必需：2×真實局部場景＋固定文字讀數「畫在：…、F=… N、θ=…°」；顯示目前吸附後的學生值，不顯示應有大小／方向或對錯 |

preview採牛頓第二定律修正後的做法：讀數在獨立固定區域，不把大文字一起裁切放大。預覽與主圖用相同坐標轉換，角落穩定且避開手指，不截斷數字、單位或物體名；放手、取消、失焦、resize、換題及鎖定都消失。預覽中的動態讀數在放手後隱藏；主圖保留簡短力名與大小標籤，固定面板亦可讀取已保存數值。

保留鍵盤替代及焦點可達性，但不在主要學生介面堆放keyboard提示。大小微調按鈕及種類／物體控制均可用滑鼠和手指完成。

## Touch gesture ownership contract

依[完整touch契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)。本活動需自行驗證，不以原活動的截圖或事件測試代替。

| Target type | Selector / hit area and size | Stable capture target / pre-pointerdown touch-action | Keyboard alternative |
|---|---|---|---|
| 候選物體名稱 | `.body-select`，≥44px | 一般按鈕；點選不啟動繪圖，pan-y | Tab／Enter選取 |
| 已選物體的各起筆標記 | `.anchor-hit`，≥44px | 穩定HTML target，none；相近標記由面板列表選取，不能留重疊且不可達的hit area | 選標記後方向鍵及大小步進，Enter確認 |
| 既有反作用力箭尖 | `.reaction-head-hit`，≥44px | 各格獨立穩定target，none，不因render換node | 從列表選本格後調方向／大小 |
| 超框箭尖抓手 | `.offscale-head-hit`，≥44px，若存在 | 同上；小步編輯沿真實力值，不跳回可見邊界 | 相同微調；Escape取消 |
| 已知力與其他場景圖案 | 唯讀SVG，pointer-events不攔截pan | 非draggable；從panel選原力 | 面板分頁可達 |

| Touch starts on | Owner | Activity strategy / region dimensions | Source and packaged evidence |
|---|---|---|---|
| 空白、唯讀已知力、未選物體背景 | host | pan-y；不暗中選答案／新增箭頭 | 已通過：兩向trusted swipe，完整state及非owner幾何不變 |
| panel中段及兩端 | panel | overflow-y auto、overscroll contain | 已通過：中段兩向及上下邊界，只動panel |
| 全舞台自由作畫面 | N/A | 只由公開標記起筆，不鋪全舞台drawing overlay | 已通過：空白stage由host接收pan，只有獨立抓手攔截 |
| 左strip、右strip | host | 各≥32px，分開測；不被body／anchor／head target覆蓋 | 已通過：左右各32px帶分開兩向swipe |
| 每種起點、箭尖及超框抓手 | simulation | trusted move/up，其他scroll、iframe bounds、visual viewport固定 | 已通過：五類／八格origin與head、wrong-owner同接觸點、overlap及offscale |
| review／frozen／committed的舊target位置 | host | 移除編輯ownership | 已通過：三種mode舊箭尖位置兩向pan，完整state不變 |

測試source及實際ZIP解壓兩路，在可捲動的Moodle-like iframe中記錄全部host、iframe、activity document、兩方visual viewport、panel及權威答案前後值。若需同源host forwarding，記錄路徑並防double scroll；真實跨來源Moodle另驗。A、B的背景紋理平移是獨立視覺狀態，不改變幾何或權威答案；手勢測試比較完整答案和所有scroll／viewport值，另驗證加速上限、鏡像方向、暫停／reduced motion、換題／重繪及作答不變。

原受力圖程式可提供結構參考，但放手必須使用最終pointerup解析後位置；preview、放手及保存一致。須補回自然抖動、cancel／lostcapture、多指、resize及blur的rollback，不照搬舊pointerup僅保存最後move的細節。

## Scoring and tolerance

每題20分，五題100分；同題按指定反作用力數K平均。每個配對評以下五項，種類／方向／大小均可獨立保留部分分。

| 項目 | 該配對分值比例 | 判準 |
|---|---|---|
| 受力物體 | 45% | 學生明確選的是已知力的施力物體；須有實際選擇，不能給預設分 |
| 起點及作用線 | 5% | 已畫箭頭、物體正確、選在相應接觸／繩端／地心標記，作用線與已知力共線；公開點位按anchor ID判定，不按手指像素苛扣 |
| 方向 | 20% | 相對已知力反向，最短圓周角差≤10°；即使物體選錯仍獨立評這項 |
| 大小 | 20% | 學生力值與已知力值的相對誤差≤10%，兩側對稱；按物理N值，不按viewport像素 |
| 力的種類 | 10% | 同一物理相互作用的類型；支持力／壓力為同一類，標籤別名不誤扣 |

每題分數為`20/K × 各配對已得比例之和`。作用線的角度容差亦為10°，允許同向或反向的平行線判斷，再按正確起點確認共線；反向由獨立方向項判斷。起點項依賴物體正確是其真實物理依賴，不抹去其他三項分數。

受力物體權重較高，避免把八支力全畫在原物體上，仍靠長度及方向達標；全部物體都錯時最高50分。只選正確種類仍得種類分；只選正確物體也有對應部分分。完全未動的空白作答為0，預先給出的力不計作答。

- 大小容差例：原力10.00 N，9.00及11.00接受，8.99及11.01不接受；方向10.0°接受、10.1°不接受，0／360跨界同等處理。
- 大小保存0.01 N，方向保存0.1°；量化發生在實際放手形成權威答案時，顯示、評分及恢復都用同值，不在還原時另捨入。
- 每個原力只有一格，改畫取代該格，不用新增數量懲罰；不能對同格選多個種類或交多支箭頭來碰答案。其他格不能借用一支正確箭頭重複得分。
- 反作用力種類未選、方向未畫或其他缺項按項目給0；完整性標記不等於正確性。
- 詳細回饋只在確認提交後顯示：用「誰對誰」解釋錯物體、支援／重力混淆、方向、等長和繩的兩端不是同一配對；可切換學生圖／參考圖，保持只讀。

## Phase/state matrix

每格以同一schema保存空白與部分作答。題型A/B/C各2格，D/E各1格；版本1的五個類型都須覆蓋以下矩陣，不只測第一題。

| Phase / variant | Current step / authoritative state | Absent / retained | Legal continuation after restore |
|---|---|---|---|
| edit／全空 | 當前q、target及全部空記錄 | 無預填物體、種類或箭頭 | 選任一物體／種類；亦可直接檢查 |
| edit／只選種類 | kind非null，body可null | 沒有杜撰起點／箭頭 | 選物體、從公開點開始或檢查 |
| edit／只選物體／起點 | body非null；anchor可有；vector為null | 種類可未答 | 畫箭頭、改物體或檢查 |
| edit／已有箭頭、未標種類 | 合法body、anchor、angle及force；kind=null | 其他題全部保留 | 補種類、改箭頭、檢查 |
| edit／一般完整或錯誤 | 所有欄位合法，允許錯body／anchor／type／vector、超框、重疊 | 不自動修正學生錯誤 | 編輯、刪除或檢查 |
| edit／從檢查返回 | returnToCheck=true，可搭配上述任一答案形態 | 全部其他格保留 | 修改後返回check |
| check／空白、部分、完整 | 當前返回題與格合法，全部答案保留 | 沒有all-complete門檻 | 返回edit或明確提交 |
| review／確認完成 | 版本、seed、權威答案及重算結果 | 沒有可編輯暫態 | 切題只讀檢討 |
| pending-final／合法 | shared封套內的完整review快照及同一提交結果 | 全程凍結，不能清除／改題 | 驗證後重試相同payload |
| committed／finish未完成 | 已記錄結果，review快照有效 | 仍只讀 | 只重試完成程序 |
| technical／不可信狀態 | 依shared分辨未提交損壞draft、未知狀態、錯review或錯pending | 不偽造分數、不可擅自重開 | 只有已確認未提交draft可走規定恢復；其餘保持技術鎖 |

提交中的pointer工作值不是saveable phase：檢查、導航或中斷時取消，保留最近一次已完成的答案。undo/redo歷史不要求跨載入保存；恢復後不能聲稱仍可撤銷載入前的操作。

## Persistence contract

依[權威快照](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract)及[恢復測試](../docs/simulation-scorm-production-guide.md#required-persistence-tests)。下列為已實作的 version 1 固定 schema。

```text
{
  schemaVersion: 1, generatorVersion: 1 | 2, rubricVersion: 1,
  seed: uint32,
  phase: "edit" | "check" | "review",
  question: integer 0..4, target: integer 0..K(question)-1,
  returnToCheck: boolean,
  answers: [A[2], B[2], C[2], D[1], E[1]]
}
record = [recipientBodyId | null, anchorId | null,
          kindId | null, angle10 | null, force100 | null]
```

- body與anchor使用該題有限整數ID；kindId為0..4；angle10為0..3599；force100為正整數，最大值按本題共同3Fmax上限。空記錄五欄均null。
- body可錯，但必須屬本題可選物體；anchor必須屬所選body。body=null時anchor與vector必須null，但kind可有；anchor=null時vector必須null。角度與大小必須同時有或同時null，畫了箭頭但kind=null合法。
- answers按固定A–E題型排列；畫面順序由seed重建。標準力／正確物體／正確向量／世界座標由seed+generatorVersion生成，不接受快照夾帶的答案表。
- `question`指固定題型ID；`target`指該型的已知力slot。check保留合法返回索引；returnToCheck只在edit可true，check及review須false。
- draft承載edit/check，review承載phase=review的同一權威答案；結果只作shared封套comparison metadata，恢復後重新評分。

| State category | Activity fields and treatment |
|---|---|
| Authoritative | 版本、seed、已選body／anchor／kind、angle／force、phase、question／target、returnToCheck；包括合法錯誤、未作答及超框真值 |
| Transient | pointer、吸附hysteresis、未放手幾何、preview角落、動畫時間、焦點、DOM、undo/redo；不寫suspend_data |
| Derived | 已知題目及正解、作用點世界座標、像素比例、hit targets、標籤位置、進度、分數；由權威值重建 |
| Version compatibility | schema及rubric仍為1；新作答generatorVersion=2。v1的draft/check/review/pending按原生成器還原、重算及續作，不遷移數值，不改既有成績。未知生成器版本拒絕 |
| Size | 全部8格最長值連shared draft/review/pending封套須實測≤4000 UTF-8 bytes；預期遠低於上限，但現階段沒有production實測值 |
| Invalid finished review | 保持鎖定，只顯示可信Moodle摘要，不能降級成editable |
| Invalid pending-final | deeper decode/rescore失敗須quarantinePending，再技術鎖；不重試被拒payload、不清除checkpoint |
| Invalid editable draft | 只有shared已確認未提交時可由明確恢復操作清除；未知狀態不重設 |

每個有效矩陣格必須執行production encode→decode→restore→一個合法下一步，確認分數、原題及未答形態一致。另測未知ID、body/anchor依賴錯誤、種別越界、NaN/Infinity、向量只有一欄、超上限force、錯slot數及不可能phase，不把錯物理答案當成壞schema。

## Shared SCORM lifecycle

直接沿用`SimScorm.loadAttempt()`＋`SimActivityFlow.startup()`、draft provider及`SimScorm.submitWithCallbacks()`＋`SimActivityFlow.submission()`；不加入raw LMS字段存取或活動自己的commit/finish/pagehide流程。

| Outcome / policy | Activity behavior |
|---|---|
| Startup editable | 新作答或恢復合法draft，不重抽既有seed |
| Startup review | 驗證、恢復、重算及reviewResult比對；只讀 |
| Startup frozen | 深層驗證同一review答案和結果；合法才允許同payload retry |
| Startup load-error | 技術鎖，不偽裝成standalone或空白新attempt |
| Submit success | 已確認記錄，顯示只讀結果及解釋 |
| Submit committed | 成績已記錄，只讀，可重試finish |
| Submit frozen | 答案凍結，不宣稱分數已確認；可重試同一有效提交 |
| Submit retry | 依retryable允許編輯／retry或技術錯誤提示；不可顯示已提交 |
| Standalone refresh | 記憶體模式；refresh清空答案並新seed，不讀localStorage／sessionStorage舊checkpoint，不額外加刷新告示 |
| Moodle resume / new attempt | 同attempt恢復相同題目、答案與階段；已完成仍只讀；只有Moodle提供新attempt才重新開始 |

## Test plan

以下列出驗收要求；勾選項只代表已執行的本機證據，不代表真實 Moodle／實體手機驗收。

- [x] 題型參數有限集合窮舉：A向量和／接觸力矩、B共同加速度與外部驅動、C拉伸及壓縮符號、D張力為正及指定狀態、E中心方向；各配對數值等大反向。
- [x] 種類分類涵蓋支持力／壓力同類、彈簧兩端施受力者、繩端與固定架區別及引力受力者；不把向心力或合力當新增外力。
- [x] 受力物體全錯最高50分、全部空白0分；各評分項獨立、同格不得多選碰答案；角度及大小容差的剛好內／外、跨0度與量化邊界。
- [x] 每個A–E×所有saveable variant production round-trip及合法續作，含錯body、同接觸座標不同owner、null種類、超框、重疊和check返回；同分同pass。
- [x] invalid schema與合法未答分開；最大draft/review/pending封套≤4000 bytes。
- [x] shared startup／四種submission outcomes、quarantine、真假review差異、保存失敗與重試；錯誤時沒有假成功。
- [x] source與extracted ZIP均由實際UI完成八個配對、100分及部分／空白提交；Moodle-like同attempt續作／review／pending及standalone refresh重置、儲存不可用。
- [x] 大小比例在所有物體、方向、viewport及zoom一致：等大的給定／學生箭頭等長；不能沿用舊的方向相關長度映射；錯過長與超框真值保持。
- [x] 320×400等全部尺寸的可讀性及touch矩陣，左右strip、每類anchor／head／offscale target、shared contact owner、panel兩端、鎖定舊target。
- [x] preview固定讀數完整、正確顯示吸附後大小／角度及學生選的受力物體，2×真實場景；不遮手指、不攔截、不洩露答案；release/cancel/blur/resize/navigation/lock均清除。
- [x] 自然抖動不誤改長度；pointerup與最後move不同採最終位置；圖外放手／多指／lost capture安全取消；鍵盤小步不被吸附吞掉，不沿用另一支箭頭工作值。
- [x] 已作答進度與下一步在錯答案、clear、undo／redo、恢復後一致；不預判對錯，不阻止空白檢查／明確提交。
- [x] 測試新增至`tools/run-tests.js`；擬增`tools/newtons-third-law-browser-regression.js`及npm focused command；runtime全列入manifest。

## Package-ready checklist

- [x] 使用者批准本計劃；實作後核對活動特有模型、rubric、snapshot及相容性。
- [x] 所有純測試、production恢復續作及source／實際extracted browser與trusted-touch矩陣通過。
- [x] `npm run check`、`npm test`、`npm run package:all`與`git diff --check <base>...HEAD`通過並記錄實際證據。
- [x] ZIP根有imsmanifest.xml；沒有測試檔或遠端runtime依賴，逐檔與source一致。
- [x] 桌面投影、手機／短iframe／橫向／200% zoom及所有必要操作可讀可達。
- [x] 形成性評核風險與未驗證部署範圍有記錄。

## Moodle-ready checklist

- [ ] 真實Moodle學生attempt提交成績、同attempt刷新／離開續作、pending retry及只讀review正確。
- [ ] 由Moodle提供新attempt時重新生成；舊attempt成績不被覆寫。
- [ ] 實體手機在現視窗及提供時的新視窗player完成整個手勢矩陣；跨來源實際環境通過。
- [x] N/A：可信服務端評分，第一版只作形成性活動，不作高風險考核。
- [x] 明確區分本機package證據與真實Moodle／實體手機驗收。

## 已批准的實作次序

1. 先完成五題的唯讀場景、物體／接觸點及共同比例尺，逐題確認「誰對誰」和同一直線的表示沒有歧義。
2. 完成一個端到端配對操作：可選錯物體、起點、方向／大小與種類；包含手機固定數值preview及放手清除，再推廣到其餘題型。
3. 加入五題隨機生成、八格答案、進度／下一步、復原清除及獨立部分分。
4. 接合shared SCORM、production快照恢復與所有提交結果，登記目錄／manifest／tests。
5. 執行上述package-ready驗收、記錄證據、產生ZIP；真實Moodle／手機另列待驗或實測結果。

## 原規劃階段完成範圍（歷史）

- 已開專用branch並參考兩個受力圖活動的現行程式、計劃及共用契約。
- 已完成本規劃草案，物理定義查核來源列於上文。
- 此段為使用者批准前的歷史記錄：當時只完成計劃，尚未實作或驗收。2026-09-28 已獲批准；實際實作證據另列下方。


## 2026-09-28 實作與本機證據

已建立完整活動、五類情境及八個配對，沿用 shared SCORM／activity-flow。
所有候選物體及起點均能被選錯；給定力和學生力按同一物理比例繪製。
面板選擇起筆點、圖中只放一個抓手，是為避免窄畫面中相鄰44px命中區重疊的實作細化。
桌面力標籤24px、手機14px；preview 2×場景與獨立的物體／N值／角度讀數，放手及中斷清除。

- 純測試：75種有限物理變化，300份seed生成；225組scene渲染；評分邊界及全部錯物體最多50分。
- Production persistence：225組decode／controller restore／合法續作，包含全部75種變化；最大draft／review／pending封套391／422／615 bytes。
- Lifecycle：新作答、draft、review、pending、committed、technical、quarantine、保存失敗及重試；獨立refresh不讀取舊localStorage。
- 最後修正包括輪子／固定支架接駁，以及提交暫未確認時保留當前題目與配對；再跑全套新活動純測試及source／ZIP完整browser／touch runner，全部通過。另有`smoke-report.json`視覺核對。
- Browser runner：`tools/newtons-third-law-browser-regression.js`；正式source及實際解壓ZIP，Chrome 154／CDP trusted touch；詳見`output/playwright/newtons-third-law/report.json`與同目錄截圖。
- 另外的中斷／多指／鎖定矩陣：`output/playwright/newtons-third-law/edges-report.json`，source／ZIP各320及390px，全部通過。
- ZIP：`output/newtons-third-law-reaction-force-lab-scorm.zip`。`npm run package:all`已通過全部套件檔案核對；`npm run check`及目前staged diff whitespace檢查已通過。
- 完整`npm test`已於2026-09-28通過（exit 0，紀錄`output/third-law-full-test.log`）；最新新活動focused browser亦exit 0（`output/third-law-final-browser.log`）。最終`npm run check`及`npm run package:all`均exit 0；staged與基準`9fea6f1`的diff whitespace gate一併核對。
- 本機HTTP預覽已回應200；實際Moodle學生attempt、實體手機和跨來源player尚未驗證，Moodle-ready維持未完成。

## 2026-09-28 手機操作回饋修正

使用者已透過手機Remote預覽，要求較容易選取整數力值，以及加速情境的背景動態。
本次採上述公開力值刻度與防抖規則，保留微調、共同比例尺及原有評分；新增B的限速加速背景。
生成器、隨機次序、rubric及快照版本均保持相容，恢復舊答案不重新量化。

- `model.test.js`：所有75種物理變化的正確力值由兩個方向接近刻度，均保留原±10%大小得分；另驗18 N防抖、10 N格距交界、鏡像背景方向、速度上限、位移連續及不同幀率。
- `tools/newtons-third-law-browser-regression.js --assistance`：source及實際解壓ZIP，Chrome 154，320／390／1280px。18 N拖動與preview一致，抖動保持18 N；按鈕改成18.1 N並恢復後保留。
- 背景實測由約8.17增至14.17 px/s，達46 px/s後封頂；箭頭幾何及作答不變。暫停時重繪不跳回原位、恢復播放、切題重播、reduced motion及檢查階段停止計時均通過。證據：`output/playwright/newtons-third-law/assistance-report.json`。
- 完整活動source／ZIP runner再次通過：各9個viewport、8個實際滑鼠配對得100分，以及320／390px和320×400短iframe的trusted-touch矩陣。證據：`output/playwright/newtons-third-law/report.json`。
- 本輪完整`npm test`與`npm run check`均exit 0；紀錄為`output/third-law-usability-full-test.log`及`output/third-law-usability-check.log`。
- `npm run package:all` exit 0，所有ZIP已重新產生並核對；本活動15個檔案與source一致，根目錄有`imsmanifest.xml`。紀錄：`output/third-law-usability-packages.log`；修改後diff whitespace檢查通過。
- 使用者的Remote預覽回饋不代替真實Moodle player的正式手機手勢／持久化驗收；該部署驗收仍待執行。

## 2026-09-28 精確力值、面板位置與推力符號修正

依使用者提供的27.99 N擺球例子，新作答改用生成器v2：取整到可畫出的公開力值刻度，標示、箭長、參考答案及評分共用取整值。原始物理計算仍保留並驗證，學生看到的力值明示為取近似值。v1題目按舊生成器恢復，使用0.01 N微調可畫出原有小數，沒有遷移已作答或已提交結果。

同題切換配對與一般編輯保留面板捲動；換題及檢查仍展示新內容的頂部。兩木塊接觸推力標F，對應接觸正向反作用力標F′；選錯種類時仍顯示學生所選種類的符號。

- 純模型驗證75種v2題目、全部viewport／配對均可精確畫到給定大小；300個seed的v1數值、幾何、答案、次序及物理資料與先前發布版本的指紋一致。
- Production persistence：v1與v2合共450組還原及合法續作，另以評分容差邊界驗證舊draft/check/pending/review不被換成v2題目或改分。
- `--usability` browser檢查已通過source及實際解壓ZIP，320／390px trusted touch及1280px桌面。面板不跳頂，新題28 N可精確作圖，舊題27.99 N可微調、恢復及提交；推力顯示F。紀錄：`output/playwright/newtons-third-law/usability-report.json`。
- 本輪完整活動browser runner亦通過：source／ZIP各9個viewport、8個滑鼠配對得100分、320／390px及320×400短iframe的trusted-touch矩陣；原有防抖、微調保存及背景限速動畫檢查一併通過。紀錄：`output/playwright/newtons-third-law/report.json`，browser errors為空。
- 本輪完整`npm test`與`npm run check`均exit 0；紀錄：`output/third-law-numeric-full-test.log`及`output/third-law-numeric-check.log`。
- `npm run package:all` exit 0，全部SCORM ZIP重新產生並驗證；本活動15個檔案（41,142 bytes）與source逐一相符，含根目錄`imsmanifest.xml`。紀錄：`output/third-law-numeric-packages.log`。
- 本輪證據限本機瀏覽器及模擬LMS；真實Moodle player與實體手機的正式驗收仍待執行。

## 2026-09-28 支持力與重力的顯示避讓

依使用者要求，水平面木塊及小車的重力保持原位；支持力沿接觸面向外稍移，接觸雙方的公開標記、學生箭頭、抓手及preview共用此顯示座標。支持力與正確反作用力仍共線等長；偏移與學生選擇的物體、力種類及答案正誤無關。原始題目幾何、力值、快照及評分不變，v1／v2舊作答直接適用。

- `scene.test.js`檢查144組版本／水平情境／鏡像／viewport組合的實際SVG箭頭：重力原位、支持力與反作用力共線等長、抓手標記對齊，以及原始題目不被修改；最短320×199場景的兩條作用線相距約9.64px。
- `--smoke`已通過source及實際解壓ZIP的9種viewport、全五類情境、200% zoom與已作答畫面。已目視核對390px木塊／小車及1280px木塊截圖，兩支箭頭清楚分開。紀錄：`output/third-law-support-smoke.log`及`output/playwright/newtons-third-law/smoke-report.json`。
- 完整活動source／ZIP browser runner通過；各8個實際滑鼠配對得100分，320／390px與320×400短iframe的trusted-touch矩陣通過，包含起筆、改箭尖、preview、取消、捲動、檢查與提交後鎖定。紀錄：`output/playwright/newtons-third-law/report.json`，browser errors為空；450組新舊版本還原及合法續作亦通過。
- 本輪完整`npm test`、`npm run check`及`npm run package:all`均exit 0；紀錄：`output/third-law-support-full-test.log`、`output/third-law-support-check.log`及`output/third-law-support-packages.log`。全部ZIP已重新產生並驗證，本活動15個檔案（41,370 bytes）與source逐一相符。
- 本機預覽回應HTTP 200；本輪未進行真實Moodle player／實體手機驗收，部署驗收仍待執行。
