# 火箭工廠實驗版：單一太空艙分離、返航與降落計劃

狀態：**已實作；本機驗證與發佈紀錄見第13–15節。** 日期：2026-11-07。前12節保留設計及驗收範圍，未勾選項不代表已通過。

依[現行擴充計劃](42-rocket-side-booster-expansion-plan.md)、[活動基準](42-rocket-side-booster-lab.md)、[共用設計](00-shared-platform-and-style.md)、[生產契約](../docs/simulation-scorm-production-guide.md)及[計劃模板](NEW-SIMULATION-PLAN-TEMPLATE.md)。本文件擁有太空艙返航擴充的規格；未涉及的組裝、助推器、入軌及提交規則沿用現行活動。先前研究中的「普通／返航兩款太空艙」方案取消。

## 1. 交付範圍與玩家體驗

**只提供一款太空艙，所有新試飛均內置小型推進器、返航燃料、隔熱盾，以及小減速傘＋主降落傘。** 不增加另一款艙、第三個可組裝核心級或另外拋棄的服務艙。降落傘是同一套設備的兩個階段，不另設多款傘的零件目錄。

| 決定 | 本次規格 |
|---|---|
| 活動／目標 | 延伸 `rocket-side-booster-lab`：入軌後分離太空艙、逆行減速、再入及安全降落，同時理解二級處置 |
| 交付 | 現有 SCORM 1.2 活動與 standalone；manifest `sim/manifests/rocket-side-booster-lab.xml`；`npm run package -- rocket-side-booster-lab` |
| 評核風險 | 形成性／低風險 browser grading；本次返航是可探索的延伸，不增加得分門檻 |
| 物理／平台邊界 | 使用活動自有 model／parts／orbit／persistence／scene／audio；沿用 shared styles、fullscreen、SCORM／activity-flow，不抽出通用多航天器引擎 |
| 保護範圍 | 原 `rocket-space-mission-lab`、其 manifest／測試／素材／套件及舊 Site 不改 |
| 不做 | 對接、多人控制、電池／通訊／氧氣資源、升力導引、精確落點、天氣、完整六自由度、傘繩剛體、降落傘故障抽籤、額外傘型選單 |

典型操作：

1. 用現有零件組裝及入軌；建議先「保留入軌成果」，未保留亦可繼續返航。
2. 關閉主引擎，按「分離太空艙」。鏡頭和控制預設跟太空艙；二級不消失。
3. 選「逆行」，調低油門點火，把近地點降至約 50–70 km 後關機。顯示目前近地點及燃料，不承諾固定燃燒秒數。
4. 按一次「降落傘待命」。即使在太空按下，也只會待命，不會立即開傘。
5. 保持隔熱盾迎向來流，再入時由大氣減速；合適高度和速度自動先開小傘，再開主傘。
6. 安全觸地／濺落後顯示着陸速度、燃料及二級處置狀態。玩家仍須明確提交；返航不會覆寫先前保留的入軌成果。

## 2. 單一太空艙規格

以下為**教學模型的初始校準值**，不是現實載人太空艙的工程規格；實作時須以完整試飛確認及在此更新。

| 項目 | 初始值／決定 |
|---|---|
| 乾重 | 180 kg：原有 150 kg 基礎艙體＋30 kg 內置返航設備；包含引擎、燃料箱、隔熱盾及兩階段傘具，不重複計重 |
| 推進劑 | 30 kg，滿載 210 kg；發射時已計入整箭質量，分離不會憑空增加燃料 |
| 小引擎 | 合力 1 kN、Isp 300 s，0–100% 油門、可關機及重燃；僅在太空艙分離後可用 |
| 外觀 | 艙底保留完整隔熱盾；艙側小噴嘴提供沿艙軸的合推力，姿控噴口與主推進噴口可辨認；不畫穿過隔熱盾的大噴管 |
| 姿控 | 沿用二維角度／順行／逆行及最大 12°/s；分離後艙的主推進與姿控共用 30 kg 燃料，初值每實際轉動 1°耗 0.0005 kg；燃料不足限制可完成的轉角，空箱不再主動轉向 |
| 質量簡化 | 傘展開不改總乾重；隔熱盾餘量是防護能力指標，本版不另模擬燒蝕質量損失；不做角動量與獨立姿控燃料箱 |
| 舊攻略影響 | 新艙比舊 150 kg 艙多 60 kg；輕／重／初學配搭及剩油數字必須重新試飛，尤其不能照搬原先剩油極少的輕型配搭 |

理想火箭方程給出滿油約 454 m/s 的總 Δv。200 km 圓軌道在理想瞬時逆行減速下，約 42 m/s 可把近地點降至 60 km，210 kg 艙約用 3 kg 燃料。這只說明容量有餘裕；實際有限時間燃燒、姿控及餘量仍須驗證，不能當作已成功返航的證據。

現實航天器會按設計把推進系統放在艙體或服務模組；此處把返航設備整合成一件可組裝零件，是降低操作複雜度的教學決定。例見 [ESA Orion 服務模組推進系統](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Orion/European_Service_Module_Propulsion)。

## 3. 分離、鏡頭與二級去向

### 分離條件與初速度

- 允許未入軌、正在上升或橢圓軌道時分離，不用「已穩定入軌」作門檻。必須已離地、主引擎實際推力為零，且側助推器已分離；兩級火箭須先完成下級分離。
- 單級火箭亦可由最後核心級分離同一款太空艙；UI 對應稱「核心級」，不虛構二級。
- 以分離前同一時刻的世界位置、姿態和速度拆出兩件物體，保持模型比例及接合位置。沿艙軸加入約 1 m/s 的相對分離速度，按兩件質量分配反向衝量，總質量與線動量守恆。
- 分離後艙與二級引擎先保持關閉；艙的點火必須由玩家操作，二級只由其自動程序或明確手動操作點火。
- 不縮小模型、不把速度重設為零、不強制讓二級垂直跌落。在軌道上，兩者最初應沿相近軌道逐漸分開；有剩餘燃料的推進照常改變軌道。

### 同時存在的兩個主體

- `flight` 始終代表主要載具：分離前是整箭，分離後是太空艙；只新增一個有界的 `upperStage` 狀態，不建立任意數量的載具管理系統。
- 預設操控及跟隨太空艙。以一個緊湊選擇器「操控：太空艙／二級」切換；選擇後 HUD、燃料、油門、姿態、預測軌道及鏡頭跟隨同一物體。另一件繼續模擬。
- 全景／軌道模式可同時看到兩者的位置、分色軌道及名稱；遠處以標記顯示，不以假近距離或縮放冒充分離效果。
- 一件撞毀、再入銷毀或逃逸不會終止另一件。太空艙着陸先暫停供觀看，仍可切到二級並繼續；整體 `ended` 只在沒有仍可飛行的主體時使用。正式提交／pending／review 則凍結全部主體。

### 二級自動處置

分離時預設啟用「二級自動離軌」，亦可切到二級手動操作：

| 階段 | 行為／結束條件 |
|---|---|
| 安全等待 | 至少等待 10 個模擬秒且距離太空艙 ≥50 m；未達時不點火，顯示「等待安全距離」 |
| 判斷軌道 | 近地點已 ≤60 km 則不浪費燃料，直接等待再入；未達則逆行轉向 |
| 逆行燃燒 | 方向誤差 ≤5°才點火，按實際剩油及原二級引擎推力／Isp 推進；接近 60 km 目標時限制步長及油門，避免大推力單步超越目標 |
| 關機／觀察 | 近地點到達目標即關機；顯示「已進入再入軌道」，不是「已銷毀」 |
| 無油／未完成 | 關機並顯示「燃料不足，離軌未完成」及實際軌道；無燃料的安全高軌二級可一直留軌，不假裝自然落下 |
| 進入大氣 | 按阻力及獨立熱負荷積分；失去防護後顯示解體／燃燒。到 100 km 不立即刪除，也不保證全部碎片完全燒盡；只保留可讀的處置結果，不逐塊計算碎片 |
| 手動接管 | 單純看二級不取消程序；第一次手動改姿態／油門／點火時明確轉為「手動」。可按原位置的小按鈕恢復自動離軌，避免兩套指令爭用控制 |

自動處置只是可取消的二級程序，不替玩家完成太空艙返航。這類使用上級剩餘推進劑作離軌燃燒的設計可參考 [ESA Ariane 6 概述](https://www.esa.int/Enabling_Support/Space_Transportation/Launch_vehicles/Ariane_6_overview)。

## 4. 再入、隔熱盾與降落傘

### 大氣與隔熱

沿用現有重力、球形地球、二維軌道及隨高度改變的密度；現行模型 ≥120 km 無阻力。100 km 是既有聲音／太空提示界線，**不是突然開始／完成再入的物理開關**。本版不新增風、地球自轉大氣或精確地理着陸導引；速度與接地判斷沿用現有簡化地面／大氣參考。

分離艙使用獨立迎風面積／阻力係數，不能再沿用整支火箭的面積。熱負荷以隨 `sqrt(密度) × 速度³` 增長的教學近似累積，係數和隔熱容量集中在活動參數。艙底隔熱盾朝向來流時消耗較慢，方向錯誤加快防護耗損；UI 只顯示「隔熱盾餘量」，不虛構經工程驗證的攝氏溫度。餘量耗盡才判為艙體再入損毀，並保留原因；不存在無條件安全返航。

「逆行」使小引擎減速時推力反向於速度，關機後也讓艙底隔熱盾迎向來流。保持逆行屬姿控操作，依上節耗油；開傘後簡化為傘具穩定姿態，不能任意以小引擎加速拖傘。

### 一套兩階段傘具

只需一個「降落傘待命」控制；待命後由條件開傘，無強制高速開主傘或多套傘型設定。小傘先穩定／減速，主傘再提供觸地速度所需阻力，參考 [NASA 載人艙降落傘順序](https://www.nasa.gov/reference/crew-module/)；以下數值是本模型的初值，不照搬 Orion 硬件參數。

| 階段 | 所有條件同時成立才開始 | 展開時間／阻力初值 |
|---|---|---|
| 待命 | 已分離、艙體未損毀、玩家按下待命 | 可在高空先待命；不產生傘阻力 |
| 小減速傘 | 下降中；離地高度 AGL ≤8 km；空速 ≤250 m/s；動壓 q ≤10 kPa；主引擎實際推力為零 | 約 2 個模擬秒漸開；完全展開傘具 `CdA=8 m²`，連艙體合計9.5 m² |
| 主降落傘 | 小傘已完全展開；下降中；AGL ≤3 km；空速 ≤80 m/s；q ≤4 kPa；引擎仍關閉 | 約 4 個模擬秒漸開；有效 `CdA=120 m²`，平滑取代小傘而不重複相加 |
| 觸地 | 真正掃掠碰撞到現有地形／海面 | 以當刻法向及切向速度判斷結果，停止穿地 |

- `q=½ρv²`；開傘同時驗高度、速度、密度與動壓，且密度必須大於零，不能只看高度。高度 HUD 的海拔與開傘 AGL 清楚區分。
- 等待時只顯示一條原因，如「已待命，等待減速至 250 m/s 以下」；高空或上升時按下不爆傘，也不悄悄完成。
- 傘面積隨展開進度連續增加，阻力始終作用於相對氣流反向；先拉出、繩索拉直、傘面鼓起，艙體連續減速，不突然靜止、瞬移或像彈簧縮放。
- 首次小傘拉出後鎖定艙的主引擎點火，顯示「降落傘已展開」；沒有收傘／切傘／重開流程。太遲待命會因展開不足而硬着陸，不憑空補救。
- 初始安全觸地界線：向地面的法向速度 ≤6 m/s、切向速度 ≤5 m/s，且艙體未損毀。超出顯示「硬着陸／撞毀」；不因碰地一律套用現有 `impact`。
- 210 kg、海平面、主傘完全展開的理想終端速度約 5.3 m/s；須再校準不同剩油、地形高度及主傘展開過程，才可確認上述界線適合本模型。
- 陸地顯示輕微觸地塵與傘面鬆落；水面顯示小水花及艙體停留，不模擬海浪、翻覆或長期漂流。

## 5. 聲音設計

沿用原生 Web Audio、本地合成、既有音量浮層及兩段太空配樂；不增加外部音源或第三套常駐音樂。全域仍預設靜音、音量 30%，音樂開關預設開；需用者手勢啟動，啟動失敗不影響飛行。

**物理音效按目前跟隨／操控的主體判斷高度及聽感。≥100 km 的引擎、分離、碰撞等飛行物理聲維持靜音；配樂是非場景音樂，保留。** 切換主體不能把遠方二級燃燒／撞擊聲直接搬到太空艙耳邊。

| 情境 | 音效／音樂與混音 |
|---|---|
| 太空艙分離 | 低空才有短促、輕微機械扣件／推開聲；80–100 km 按既有曲線淡出，≥100 km 只保留視覺與狀態提示 |
| 艙的引擎／姿控 | 低空小推進器較輕、較細的推進聲；姿控短噴低音量且合併節流，不能每幀新增聲源；太空完全無物理音 |
| 太空漂浮／安全軌道 | ≥100 km 慢慢播放原「太空漂浮」；安全軌道且實際無推力持續 3 個真實秒，交叉淡化為原「深空軌道」。切換物體平滑更新，不重播開頭；同一次飛行不因分離重設樂段 |
| 太空艙離軌 | 近地點跌出安全條件，深空轉回漂浮；穿越 100 km 往下時配樂柔和淡出，不以恐怖突發音效提示危險 |
| 再入 | 100 km 以下按密度、空速及熱負荷逐漸出現風切與克制的低頻震動；80–100 km 仍尊重既有淡出曲線，不能在門檻突然一聲巨響 |
| 小傘／主傘 | 短促出傘、繩索繃緊及布料鼓起聲；主傘較飽滿，隨減速回到柔和風聲。音量受開傘載荷及總限幅控制，不作爆炸聲 |
| 安全觸地／濺落 | 輕柔着地聲或水花，隨後風聲淡出；畫面文字確認結果，聲音不是唯一提示 |
| 硬着陸／再入損毀 | 短促但有上限的碰撞／破裂聲，避免突然大幅變響；只在聽者附近及可傳聲高度發生，不播遠方二級事故的全域爆炸 |

倍速只改物理進度，音樂節奏／音調不變；開傘等一次性音效可略壓縮但不隨 1000× 重複播放。聲源仍有固定上限，新增短音重用現有短音池；連續聲先重用現有風聲／震動層，確有必要才增加一層並給出數量斷言。暫停、背景、check、review、pending 全部淡出／suspend；恢復只播新事件。Moodle 還原、切換主體及鏡頭不重播分離／開傘聲，聲音設定不寫入答案或跨刷新儲存。

## 6. 版面、操作與圖示

沿用 header／3D stage／bounded split-panel 三區及現有 breakpoint，不新增佔滿上方面板底部的發射／返航大列。點火／關機與原分級操作留在現有 compact flight deck，固定列維持原高度；分艙／操控對象／姿態模式／傘待命放在可捲動飛行設定頂部，只在適用時顯示。倍速沿用收合選單，不因加分離按鈕把多個倍率擠到新一行。

| 區域 | 具體變更 |
|---|---|
| 工廠 | 只有一張太空艙零件卡；短說明「乾重 180 kg・燃料 30 kg」，返航設備列於展開說明；引擎卡維持使用者指定的推力／乾重短說明 |
| 飛行 deck | 沿用點火／關機、油門、分離位置；按進度把分離動作換成「分離太空艙」，不可用時有簡短原因 |
| 艙分離後 | 出現緊湊的操控選擇器、順行／逆行、單一降落傘待命控制；油門與角度控制重用，不新增第二套儀表板 |
| HUD | 主體名及其高度／速度／燃料；艙返航時增加隔熱盾與傘狀態的小狀態列，二級只顯示短處置摘要。需要時顯示 AGL，避免混淆海拔 |
| 手機 | 新控制最少 44 px 點按區；320 px 寬及短 iframe 下仍可看場景並操作。不縮小字體硬塞、不遮鏡頭／全螢幕、不加水平整頁捲動 |
| 結果 | 入軌成果和非計分返航摘要並列可讀；已評分／pending 沒有重開或清空結果動作 |

箭頭沿用力 `F`、速度 `v` 與 SI 單位；全景以不同顏色加名稱辨認兩件物體，不能只靠顏色。無新增精密拖曳，故不增加吸附／放大預覽；既有組裝／鏡頭拖曳保留原指尖遮擋處理與鍵盤替代。新按鈕／選擇器支援 Tab、Enter／Space及可讀狀態，禁用原因可由鍵盤讀取。

觸控所有權沿用現有 owner：panel 可捲動、stage 空白及兩側 scroll strips 屬外層 host，組裝 handle／鏡頭 handle 才捕捉拖曳。傘、軌道標記、熱光及離軌文字是不可攔截觸控的場景顯示；不得覆蓋空白區成為透明命中面。新增控制在相同 owner 中，T0–T3 每個新增 phase 仍須實測；T4 真 Moodle／真手機另列，不沿用歷史結果冒充通過。

## 7. 評分、成果與導航

本次維持 **10／15／45／30，70 分合格**及現有容差：起飛、進入太空、入軌進度、近圓程度；安全軌道仍是關機、束縛軌道、近地點 ≥150 km，近圓 `e≤0.03`。不把「200 km」改成唯一評分高度，不因返航故意降低近地點而自動扣掉已保留成果。

- `records[0]` 仍只收玩家明確保留的主要載具成果，不能拿二級自動程序或另一段試飛補分。太空艙分離後的主要載具也可明確保留；若覆寫原成果，沿用原有明確覆寫操作，不能自動替換。
- 返航狀態記錄艙是否安全着陸／硬着陸／損毀，以及二級是否仍在軌／已進入再入軌道／已再入損毀；本版不加分、徽章門檻或額外提交步驟。
- 空白、部分組裝、未點火、飛行中、開傘中、着陸後及二級仍飛行時均可前往 check；未保留成果為 0 分合法答案。check 返回原狀態時維持暫停，玩家自行繼續。
- 返航不需要先提交；正式提交後兩個主體與自動程序全部唯讀，不以「繼續返航」重新打開已評分／pending attempt。
- 工廠重組／新試飛沿用可編輯階段原有範圍，清除當次飛行與二級，不擅自清除已保留成果；採現有確認規則。

## 8. 權威狀態與版本

現行為 schema6／model4；新資料採 **schema7／model5**，activity ID 不變。擴充既有 `flight`，不把返航放在 renderer 私有動畫，也不借用現有僅作畫面的下級殘件充當二級處置。

| 欄位 | 型別／規則 |
|---|---|
| 既有 state | `variant=0`、craft、phase／backPhase、flight／null、`records:[record|null]`；核心一／兩級、每級最多四箱、助推器 0／2／4 沿用 |
| `flight.capsule` | `{detached:boolean, fuel:number, heat:number, chute:{armed:boolean, phase, since:number|null}, touchdown:null|{normal:number,tangent:number}}` |
| capsule 範圍 | fuel 0..30 kg；heat 0..1 為已消耗防護比例；chute.phase 僅 `stowed/drogue-opening/drogue/main-opening/main`；since 為當階段起始模擬時間，0..flight.t，stowed 為 null；touchdown 存碰撞前兩分量的非負大小，只有已觸地狀態可有 |
| 主體狀態 | 原 `flight.state[6]`、attitude、controls、maxHeight 繼續表示主要載具；status 在原 pad/flying/impact/escaped 外增 `landed/destroyed`。分離後核心 fuel 槽歸零、active/separated 保留組裝歷史語義，質量與推力改取艙資料 |
| `flight.upperStage` | `null` 或既有標準 flight 形狀加 `{heat,auto:{mode,separatedAt}}`；craft 只含原最後核心級且 capsule=false，fuel=[remaining,null]、active=0、separated=false、boosters=null；t與主艙同步。這個有界副本重用原 RK4／耗油／碰撞，不另造二級積分器；不含 capsule／upperStage／controlled 欄位 |
| upper 範圍 | fuel 0..該級容量；status 僅 flying/impact/escaped/destroyed；heat 0..1；auto.mode 僅 waiting/turning/burning/coasting/no-fuel/manual/done；separatedAt 0..flight.t；60 km 目標及安全距離是 model5 固定參數，不信任 snapshot 自訂值 |
| `flight.controlled` | `main/upper`；upper 只在其存在時合法；只改操作對象，不改得分來源 |
| 時間／座標 | 兩主體共用 `flight.t`，無第二個可漂移時鐘；座標、速度、姿態與能量／邊界沿用生產 validator 的有限值檢查，z/vz 必為 0 |
| 成果 record | 保留原權威軌道／craft／fuel 等；新紀錄標 physicsVersion=5，舊 model4 紀錄另走原 codec；舊已提交／pending 按原 envelope 版本選 scorer，不能用新草稿版本改解舊提交；model5 加上分離與艙狀態以正確重畫。engineOff 按該主體實際推力判斷，不能只讀 lit；不保存 scene 物件或計算後分數冒充答案 |

分離時核心燃料只移交一次給 upperStage；整箭／艙／二級不會同時擁有同一份燃料。未分離時 upperStage 必為 null、controlled 必為 main、傘未展開、艙 fuel 不可消耗。已分離時不得仍附著側助推器或下級；傘階段的依賴、since／t、terminal status／熄火／觸地關係都要驗證。燃料、phase、時間及參照不合法屬錯誤，不是「未作答」。

### Snapshot 與舊版兼容

- Draft 沿用 shared envelope，compact answer 內含上述全部權威飛行狀態、成果及 check 返回位置；Review 包含保留成果及可選的最終雙主體靜態快照以重畫返航結果，還原後絕不運行。新 tuple 定義如下，schema5/6 的既有 decoder 不改其索引或含義。
- 不保存粒子、音樂播放秒數、聲源、相機矩陣、軌跡歷史、DOM或暫存推算；本版只保留重用標準flight需要的單一核心craft副本。傘展開進度由 phase／since／t 重建；音效不以還原狀態觸發過去事件。
- 最壞 draft／review（四助推器、兩級各四箱、已保留成果、兩主體、check）必須實測 **≤4000 UTF-8 bytes**，保存原始數值精度。超限先去除重複／派生資料，不裁掉必要狀態或默默捨棄二級。
- 舊版已提交／committed／pending 保留原物理版本、答案及 canonical retry payload，按舊規則重評／重畫，不注入新設備或改舊成績；非法 pending 仍 quarantine。
- 舊版可編輯 workshop draft 於原有合法入口升級成唯一新版艙，保留組裝與已保留成果；成果自帶原物理版本。
- 舊版正在飛行的 Moodle draft **不在半空偷偷加 60 kg、不丟棄進度**：內部維持 model4 到玩家原有「返回工廠／新試飛」動作，再以新艙重新起飛；該次舊飛行不提供新艙分離。短提示「這次試飛沿用舊設定；重新試飛使用更新後的太空艙」。這是資料兼容，沒有第二款可選艙。
- Standalone 刷新仍全新開始；Moodle 同 attempt 才續作。invalid editable draft 沿用已確認未交的安全復原／technical lock，絕不因載入錯誤清掉 submitted 或 pending。

新 compact answer（`null` 保留為未作答／不存在；不得用空 tuple 代替）：

```text
Draft  = [7, 5, phase, backPhase, C(workshopCraft), F(flight), R(record)]
Review = [7, 5, R(record), F(finalFlight)]

V = [x, y, vx, vy]                         // 還原 z/vz=0，沿用 encV
C = 現行 schema6 encC 的 craft tuple       // payload/stages/capsule/boosters
Controls = [mode, angle, throttle, lit]
Cap = [detached, fuel, heat, armed, chutePhase, chuteSince, touchdown]
touchdown = null | [normalSpeed, tangentSpeed]
Upper = null | [source, C, t, V, coreFuel, active, separated, attitude,
                Controls, status, maxHeight, B, heat, autoMode, separatedAt]
F = null | [source, C, t, V, coreFuel, active, separated, attitude,
            Controls, status, maxHeight, B, Cap, Upper, controlled]
B = null | [boosterStatus, perBoosterFuel]   // 沿用 encB

R = null | [physicsVersion, recordData]
model5 recordData = [C, V, coreFuel, active, separated, t, status,
                     maxHeight, pushing, B, Cap]
```

`F` 原有12欄保持位置，新增 Cap／Upper／controlled；model5 的 `pushing` 是保留當刻實際總推力是否大於零，解碼為 `engineOff=!pushing`，與舊紀錄的 `mainLit` 分支區分。本次新草稿保留的既有 model4 成果以 [4,原 schema6 recordData] 儲存；新版紀錄用 [5,model5 recordData]。更早的 submitted／pending 仍走原版本 decoder／scorer；不僅補一個 model5 tag。舊已提交／pending envelope 仍整份沿用，不因新 wrapper 重新編碼。`Review.F` 可為 null（例如只保留舊成果後在工廠提交），與有飛行但未保留成果的 `Review.R=null` 均合法。

## 9. 可保存狀態與合法延續矩陣

下列是實作前必須覆蓋的族群；括號內互斥／邊界 variant 在正式測試 fixture 表中逐一展開，不以單一 happy path 代替。每列均可 check／明確提交；check 本身保存原 backPhase 與同一狀態。

| Phase／variant | 必要狀態與保留／缺省 | 一個必要合法延續 |
|---|---|---|
| workshop 空白／部分／完整 | flight=null；無新回收狀態；records 可 null 或已有 | 增／減件，或完整組裝後送發射台 |
| pad 未點火／燃燒 | 艙已裝且未分離；upper=null；傘 stowed | 點火／關機；不能在台上分離 |
| ascent/coast 未分艙 | 一／兩級；核心分離前後；0／2／4 助推器附著／已分離；核心有油／空油 | 原點火／關機／級分離，或滿足條件後分艙 |
| 分艙等待／轉向／燃燒 | upper 存在；獨立油量；main/upper 各可操控；自動程序按當刻等待條件 | 切主體、繼續一個步長並驗兩者同時前進，或手動接管 |
| 艙滑行／推進 | 艙有油／空油；順行／逆行／手動角度；安全／非安全軌道；upper 自動／手動／已終止 | 關機、合法姿控、調油門；無油不能產生推力 |
| 二級離軌完成／不足 | upper 為 coasting/no-fuel/manual/done，軌道與燃料相符 | 繼續再入或保持真實留軌；不得自動宣稱已銷毀 |
| 再入待命前／後 | heat=0／部分／臨界；傘 stowed、armed false/true | 合法進入小傘階段，或因過熱 destroyed |
| 小傘開啟中／已開 | phase/since 合法，主引擎關閉，艙下降 | 面積連續增加；達條件轉主傘，未達繼續等 |
| 主傘開啟中／已開 | 未觸地、隔熱未失效；仍需計算阻力 | 繼續下降，或在真實接地時分安全／硬着陸 |
| 艙已着陸／撞毀／過熱／逃逸 | primary terminal，upper 可仍 flying；只有觸地才有 touchdown | upper 活着時繼續觀察；兩者終止才整體 ended |
| 二級先撞毀／再入解體 | upper terminal、main 仍 flying | 艙繼續運行，鏡頭／聲音／成果不被二級事故重設 |
| ended | 兩主體均 terminal，或只有未分離載具且已 terminal | 可編輯時返回工廠／保留合法成果／check |
| check × 所有上述變體 | 原 backPhase／雙主體／成果凍結 | return 仍暫停；或提交當前答案，包括未作答 |
| submitted/committed/review | 有效 review、各版本成果及最後快照；全部唯讀 | 只允許顯示／鏡頭／音量／fullscreen，committed 只技術 finish retry |
| frozen pending-final | 驗證過的 canonical payload，不可變動 | 只重試同一份；無效資料 quarantine／technical lock |
| 舊 model4 editable draft | 原飛行質量與軌道、原成果不變；無新分艙入口 | 原合法操作可繼續，返回工廠後新飛行升級 |
| invalid/mismatch/unknown | 不虛構雙主體或成績，不把不合法狀態當空白 | 按 shared trust／recovery 規則鎖定或明確復原 |

暫停／背景／檢查／提交對所有主體和程序用同一時鐘；倍速共用 work budget。任何一件正在推進、再入或展傘即按其需要限制步長／可用倍速，UI 顯示實際倍率，不因玩家看太空艙就跳過二級燃燒。燃盡、開傘、接地及熱失效需在步長邊界定位；不能一次越過整段降落。切換主體不自行繼續已暫停的模擬。

## 10. 實作落點與依賴

無新 library、外部素材或網絡依賴。先擴充現有檔案；只有既有檔案難以維持清楚邊界時才拆活動內小檔，並同步 manifest。不修改 shared 平台去遷就本活動。

| 檔案／呼叫鏈 | 必須跟進的內容 |
|---|---|
| `parts.js` → 組裝、TWR、model、scene、成果重畫 | 唯一艙規格、全程質量及燃料所有權；舊版數值兼容 |
| `model.js`／`orbit.js` → runtime、軌道 HUD、scorer、測試 | 分艙衝量、兩主體推進、處置程序、艙阻力／熱負荷／傘／着陸；重用既有 orbit helper，不另造軌道公式 |
| `persistence.js` → startup／draft provider／pending／review | schema7/model5、欄位／依賴 validator、compact codec、逐版本還原及 byte ceiling |
| `ui-runtime.js` → `main.js` → scene／audio | 共用時鐘／work budget、主體選擇、pause／check／review、actual warp、單一事件來源 |
| `index.html`／`styles.css`／`main.js`／`interaction.js`（如受影響） | 緊湊控制、禁用原因、鍵盤／觸控、成果與返航摘要；現有 drag／scroll 不退化 |
| `scene.js`／`art.js` 及既有 art recovery | 艙／二級各自真實位置、保持比例、盾與傘、軌道標記、再入／觸地畫面；renderer recovery 後按權威狀態重建 |
| `audio.js` → `main.js` 的事件與聽者 | 高空物理靜音、兩段配樂延續、再入／開傘／着陸、切換及還原無重播、有限聲源 |
| `scoring.js`／成果呈現／legacy fixtures | 原 rubric／空白／部分分不變；只評保留的主要載具紀錄，與回收及背景程序解耦 |
| manifest／`sim/config.js` | 實作時更新必要依賴閉包；維持同一 catalogue entry，描述可改為「配搭引擎、燃料箱與固體側助推器，挑戰入軌及太空艙返航降落」，現有 active 不代表新返航已完成 |
| 活動 Node tests／browser driver／inventory audit／`tools/test-registry.js` | 擴充既有擁有者的有意義案例；新 entry/helper 才按 production guide 登記；更新 browser case inventory 及 committed selection evidence |

## 11. 分步實作與驗收

### A. 質量、雙主體與分離

- [ ] 單一艙的210 kg滿載質量計入發射；0／2／4 助推器與一／兩級的 TWR、耗油、分級無重複計重；重新測初學／最輕／最重配搭。
- [ ] 分離前後質量／線動量誤差在浮點容差內；初速度連續、分離不縮小、不瞬間跌落；core fuel 只轉移一次。
- [ ] 兩主體在切換、背景、pause、warp、check 下同時或一同停止；有油二級真實離軌、無油留軌、原先近地點已低時不額外點火。
- [ ] 重現 200 km 圓軌分艙，兩者最初仍在近似軌道；支持 60×200 km 的核心軌道分艙、艙自行圓化而核心再入，不限制只能已入軌分離。

### B. 真正完成返航

- [ ] 新版典型火箭能送艙入約200 km軌道，保留入軌成果後，艙獨立減速至50–70 km近地點、關機、再入、兩階段開傘、安全接地；完整以 production advance 跑通，非只把狀態硬改至着陸。
- [ ] 連續試不同剩油／姿態／入射陡度／地形高度；逆行盾朝向正確、保護消耗合理，過陡或錯向可失敗。記錄參數、最大減速度、開傘高度／速度／動壓與接地速度，調整本文件初值。
- [ ] 小傘／主傘在高度、速度、動壓、下降方向的門檻內外各測；待命不立即開傘、上升不開、空氣稀薄不產生假減速；展開中還原及高倍率不跳步。
- [ ] 主傘 fully-open／尚未完全展開、法向6 m/s／切向5 m/s邊界、地形掃掠碰撞、陸地／水面及太遲待命分別驗證；不要以固定動畫秒數宣稱安全着陸。
- [ ] 二級再入事件不會殺死主艙；艙先着陸仍可查看二級，兩者終止後能合法 check。

### C. 保存、評分及生命周期

- [ ] 上述每個可存族群及其正式展開變體做 production encode/decode/restore，分數不變，並各執行一個合法延續；不只比較 JSON。特別覆蓋 inactive upper 自動燃燒、傘開到一半、艙終止但 upper 活着。
- [ ] 拒絕非有限數、超容量、無引用主體、非法 phase／since、重複燃料、觸地／熄火矛盾；合法 null／未作答仍可提交。
- [ ] schema5/6 舊 draft、已提交、pending、legacy score fixtures 的原有解讀不變；不在半空改重、不清除舊成果／canonical retry；新最大 snapshot ≤4000 bytes。
- [ ] `loadAttempt()`＋`SimActivityFlow.startup()` 的 editable/review/frozen/load-error，及 `submitWithCallbacks()` 的 success/committed/frozen/retry 均走現有 shared lifecycle；invalid finished、mismatch、unknown、pending quarantine 不解除鎖定。
- [ ] source 與 extracted SCORM 的 standalone 刷新清空；Moodle stub 同 attempt 保留雙主體、傘進度及成果；記錄 review-only 不運行、pending 同份重試；真 Moodle 另驗。

### D. 畫面、聲音與交付

- [ ] source＋extracted SCORM，桌面滑鼠／鍵盤及手機 trusted touch，覆蓋分艙、主體切換、空油二級、自動離軌、再入、傘兩階段、着陸、check return、review/pending 及 renderer recovery。
- [ ] 320×500/568、390×500/844、短橫向／iframe、tablet／desktop、工具列／鍵盤變化及200% zoom；新控制44px、倍速不散成多行大區、上方面板底部不新增大發射列。
- [ ] T0 standalone／T1 direct iframe／T2 nested player／T3 element owner 的新增狀態依 production gesture contract 驗雙向 swipe、空白／左右 strip、panel邊界、快速 flick／release及中斷，既有組裝拖曳不變；source／package 分別保留證據。shared fullscreen trusted click/tap及外部退出同步仍可用。
- [ ] 可控 real clock／OfflineAudioContext 驗100 km物理音精確靜音、80–100 km平滑恢復、兩段配樂不中斷、再入／開傘／觸地有限峰值與聲源；mute、背景、暫停、restore、切換及倍速不重播。瀏覽器實際 Web Audio 啟動及音量／音樂開關亦驗證；喇叭／耳機聆聽另外校準，渲染非零不等於好聽。
- [ ] 所有新增測試歸入現有九組活動 Node tests 及 browser `flight/interaction/terrain` 的適當 owner；如新增檔／helper 則先登記 registry。更新 browser inventory audit，記錄 `npm run check:tests` 和 committed base/head selection preview；registry／catalogue 變更按 guide 觸發完整所需驗證，不能只跑局部後聲稱全庫通過。
- [ ] 執行相符的活動／選定及 guide 要求的全庫檢查，`npm run check`、`npm test`、`npm run package:all`、`git diff --check`；manifest逐byte依賴閉包、ZIP解壓 launch smoke、原活動保護hash及新Site發佈來源一致性。實際命令／SHA／結果才寫入完成證據。
- [ ] package-ready 與 Moodle-ready 分開。真 Moodle 學生提交、同attempt續作／pending／review、新attempt、T4真手機及其實際scroll owner均待實測；未做不聲稱通過。

實作順序為 A → B → C／D 的最終整合，但狀態／存檔及對應小測試隨每一步完成，不能把「最後補存檔」當作捷徑。最初計劃先交設計；本輪已按此實作，完成的本機檢查與交付另見第13節。臨時試飛腳本按[清理契約](../docs/simulation-scorm-production-guide.md#generated-output-and-cleanup)移除，ZIP留 `output/packages/`，必要量測與截圖留 `output/reports/`／`output/playwright/`。

## 12. 本次證據與仍待確認項

最初設計階段只檢視現有 parts／model／persistence／scoring／runtime、計劃與測試註冊，並查閱上列 NASA／ESA 的返航／降落傘／上級離軌資料；當時未實作或試飛新功能；本輪證據見下節。NASA 的多級傘順序支持「先減速穩定、後主傘」的設計理由，**不驗證本模型的質量、開傘門檻、熱係數或落地安全界線**。

200 km 離軌與艙 Δv 的理想數字沿用前次研究報告 `output/reports/rocket-capsule-separation-study.json`（分析資料，不是通過的返航測試）。熱容量、艙迎風面積、傘面積／展開載荷及着陸門檻須在 B 階段校準；若同一套傘不能覆蓋正常返航的合理地形／剩油範圍，先調整這一套設備，不新增更多選項掩蓋問題。


## 13. 實作與本機證據（2026-11-07）

- 已實作唯一180 kg乾重＋30 kg推進劑太空艙、1 kN小引擎／耗油姿控、接點位置分離、雙主體及可切換操控、二級自動離軌、隔熱消耗、兩階段傘與按實際地形法向／切向速度判定着陸。二級重用標準 flight／RK4，只擴充有界狀態；codec形狀已同步上節。固定 flight deck 不加高，新控制在可捲動設定區。
- 模型根位置沿用既有載具底部語義：二級底部保持原世界位置，艙按最後核心級的幾何高度移到接點；分離速度按質量分配1 m/s相對衝量。沒有縮放／瞬移到鏡頭前或重設速度。早期徑向分離會更新新艙的maxHeight，避免合法飛行變成不可保存資料。
- 正常逆行再入與錯向再入已作對照。正面隔熱係數0.15、暴露艙體1.5，配合 `sqrt(密度)×(v/7800)^3×dt` 的無量綱消耗；前者成功着陸，後者防護耗盡。這是教學校準，沒有宣稱工程熱力／材料安全驗證。
- `recovery.test.js` 跑通精確200 km圓軌分艙、約60 km近地點煞車、再入、小傘／主傘及約5.26 m/s安全觸地；亦由正式組裝／點火／飛行指令升至約238×293 km，繼續分艙返航，約5.32 m/s觸地、剩約25.82 kg燃料，原保留成果維持100分。另覆蓋質量／線動量、空油二級留軌、操控接管／恢復自動、兩分量觸地門檻、錯向熱失效、非法快照及每次round-trip後的合法延續。
- 四枚助推器、兩級各四個混排燃料箱、有成果與雙主體的合法草稿936 bytes、review900 bytes、pending1097 bytes；將數字字面長度保守放大並加256-byte variant餘量後2706 bytes，仍小於4000。真實Controller驗證雙主體pending凍結及同份canonical retry進入唯讀review。
- 本活動十組Node測試通過；browser inventory audit及 `check:tests` 通過（305 entries）。全庫Node首次258/260通過，另兩個無關活動／CI測試因本機120秒時限超時；用原runner、300秒時限逐項重跑2/2通過，未改這兩項測試或其產品程式。證據 `output/reports/rocket-return-node.txt`、`rocket-return-physics.txt`、`rocket-return-global-node.txt`、`rocket-return-timeout-rerun/report.json`。
- 最終返航專項在 source＋extracted SCORM、1280×800滑鼠／鍵盤及390×844 trusted touch共4 flows通過：實際分艙、原生操控選擇器切換、逆行點火、兩階段傘、開傘途中保存還原、着陸、提交與唯讀返航畫面；errors=[]。保留 `output/playwright/rocket-side-booster-lab/report.json` 及同目錄capsule截圖。較廣的 flight owner、最終打包／Site發佈結果續記於下。
- 音效沿用7個連續聲源／8個短音池／8個樂音oscillator；加入小引擎、耗油姿控、開傘布料及柔和着陸聲，100 km物理靜音與兩段配樂仍保留。新增Node驗有限聲源、空油無姿控聲、高空靜音；既有音訊回歸及瀏覽器配樂／音效案例繼續覆蓋。未做真喇叭／耳機聆聽校準。
- 原活動481個受保護檔案SHA256逐一不變。新增返航狀態的完整T1–T3手勢矩陣仍待驗；未做真Moodle或真手機T4；未執行完整跨活動browser／GitHub CI，不將本機檢查稱作Moodle-ready。原活動及其Site沒有改動。

最終交付：實作commit `b065542b4d694ca68f0a9c12a3f1892a0ec99c5a`。最終十組活動Node、check／check:tests及diff whitespace通過；較廣flight owner的21 cases在source＋extracted SCORM共42次執行通過，errors=[]（`output/playwright/rocket-side-booster-lab-flight/report.json`）。這批在開發中版本起跑，紀錄runtime為 `ddd5e94a16a98bdb505b5a11d066893f2d539495aeadc848907c9ceccbfb6fca`；完成後續返航呈現及舊版兼容修正的最終runtime `1b41568a088c3baf0f647207b36de3a5172841e7ef8f9692e9246aa8e2b46276` 已重跑十組Node及4條返航browser flows，並逐byte核對來源／SCORM／Site dist一致。`package:all`通過後重建本活動最終477-entry ZIP；476個manifest runtime檔案及root imsmanifest完整，ZIP SHA256 `079a24d050818fb13dac5fd8c1b5368a04851daafe784e6937693d055a5119b8`，證據 `output/reports/rocket-capsule-return.json`。committed selection為 `a2914d381723566110f4190126e4cccb074c93cb` → 實作head，因registry／catalogue變更選full／305 entries；`output/reports/rocket-return-selection.json`是選取證據，並非GitHub實跑證據。

已發布原私人Sites，權限維持owner-only：Site來源commit `cf9633d3c16ddfd9a475ea35733ebc8c9b8f406c`；deployment `appgdep_6aeea3e64ca88191bcca820d7cdcb5f6` 於2026-11-07 12:07:13 UTC+08 native succeeded，網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。紀錄 `output/reports/rocket-capsule-return-sites.json`；已請Codex開啟網址（UI回覆queued），沒有聲稱線上手動試飛或實機／Moodle驗收。部署tar在保存成功後移除，保留SCORM ZIP及必要報告／截圖；Site來源checkout及原有附件沒有清除。

## 14. 固定引擎／分離操作區（2026-11-07）

使用者回報點火與分離按鈕分散、隨階段出現而難找。可捲動飛行設定頂部改為固定並排「引擎」與「分離」兩區：引擎區固定點火／關機及原油門；分離區依序固定助推器／下級／太空艙，不因完成或未符合條件而隱藏，改用禁用狀態及短原因。操控對象在兩區上方，方向與返航操作置於其下。上方固定deck只保留飛行讀數、暫停／繼續及倍速，不集中所有操作。

手機320px仍保持兩區、44px觸控及獨立panel捲動，固定deck不加高；不新增工具列浮層。只改index／局部styles／main呈現及所屬browser案例，不改模型、分離條件、評分、SCORM或snapshot。保留所有原按鈕ID及事件；新增controlZones案例歸interaction，測桌面／手機／短橫向、點火關機與各次分離前後位置不變、禁用原因與真實點按；並重跑既有返航流程以涵蓋存檔／提交。新案例同步inventory audit／registry驗證，未執行的真手機與Moodle驗收仍待驗。


本輪實作及驗證：按鈕保留原ID，顯示／禁用統一由renderCommandZones負責；引擎與分離動作不再經舊邏輯先隱藏再顯示。十組活動Node、browser inventory audit（57 cases）、check／check:tests（305 entries）及diff whitespace通過。source＋extracted SCORM共12 flows通過：四種尺寸各走點火／關機、助推器／下級／太空艙分離，五個按鈕在所屬區域的相對位置變化<1px、觸控高度≥44px、固定deck≤80px、無整頁水平溢出；另四條既有完整返航／存檔／唯讀提交流程仍通過。桌面用原生滑鼠，其餘尺寸用trusted touch，操控選擇器另有原生鍵盤驗證。證據保存output/reports/rocket-control-zones-node.txt、rocket-control-zones-browser.json及output/playwright/rocket-side-booster-lab/*control-zones*.png。本輪沒有聲稱真手機／Moodle驗收。

實作commit `02b2e3ff299d3c57e2b89d209646f32edbcc0583`；runtime `9bd5b80d9cad7c1a6eaf724b3cd816c0aa8e663fc4cca7e3492091e8c29039e5` 的來源／477-entry SCORM ZIP／Site dist逐byte一致，原活動481檔不變。committed selection為e4d8b3c→實作head，affected／263 entries，詳output/reports/rocket-control-zones-selection.json（選取證據，非實跑）。

原私人Sites已更新且權限不變：Site來源 `37a9604b44f5699b23376ab486cb517a480842a2`，deployment `appgdep_6aeeb2012d808191b37e79aa5f8a9750` 於2026-11-07 13:07:20 UTC+08 native succeeded；網址仍為 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。證據output/reports/rocket-control-zones-sites.json；封裝tar保存成功後已移除，Site checkout及原有附件保留。

## 15. 太空艙分離防穿透（2026-11-07）

已用27 km／1 km/s徑向上升狀態重現：初始相對速度只有1 m/s，但0.5秒後因兩者阻力／質量不同，艙底與級底的沿軸距離由6.4 m變成−10.74 m；200 km真空測試2秒後仍只是約1 m/s。根因包括沒有兩主體接觸處理，而非應抹掉兩者共同的飛行速度。

保留各自真實重力／阻力及繼承速度，分離給約1 m/s軸向＋0.5 m/s側向的小相對速度，按質量分配反向衝量。加入僅限艙與最後核心級的二維有向外形接觸：質量加權消除重疊、移除相向法向速度，維持總線動量；近距離縮短積分步長，避免高速單步穿越。低空阻力可讓二者短暫接觸，不保證任意低空高速狀態都能以小彈簧力立即飛離；不改空氣密度或假裝無阻力。外形／接觸進度全部由既有狀態重建，無新snapshot欄位／評分／資源。

跟隨畫面以同一世界比例重建接點並取消殘留的下級分離鏡頭偏移；不縮放、不用固定向下動畫。驗證高空慢分離、27／60／100 km高速、不同姿態與級長、瞬間速度及動量守恆、接觸後存檔續作、兩個操控對象，以及既有完整返航。這是兩個教學剛性外形的防穿透，不加入六自由度轉動碰撞、對接、碰撞損傷或碎片系統。新測試沿用recovery Node及既有flight browser owner並更新inventory。

另已重現近景主艙scale=0.0012727而二級=0.001的視覺不一致：最低鏡頭距離令短太空艙放大約27%。現雙主體近景統一每米0.001世界單位；新browser逐格比對實際世界距離與畫面3D模型距離，以及兩者scale比值為1。

實作驗證：十組活動Node通過；recovery測12個高度／姿態組合、每0.01秒取樣、接觸前後動量與存檔合法延續。source＋extracted SCORM在1280×800滑鼠、390×844 trusted touch共12 flows通過：27 km與200 km各逐格分離／保存還原，另四條既有完整返航／提交流程；errors=[]。27 km測試8秒後相對速率約0.21 m/s且不重疊；200 km初始約1.118 m/s，8秒後約1.118 m/s、底部相距約14.94 m，沒有突然加速穿越。browser inventory增為58 cases，registry仍305 entries。證據output/reports/rocket-capsule-contact-node.txt、rocket-capsule-contact-physics.txt、rocket-capsule-contact-browser.json及同任務capsule-separation截圖。真手機／Moodle／完整六自由度碰撞仍未驗證。

實作commit `eed4650ea49fa8e554633cd3fad351597aea8ff7`；runtime `9329a47e050209887f53683889039f7d77e2ca73d8eb3998e0e0d900377c5762` 的來源、477-entry SCORM ZIP及Site dist逐byte一致，原481檔不變。check／check:tests及diff whitespace通過；committed selection見output/reports/rocket-capsule-contact-selection.json，僅為選取證據。最新部署仍維持私人權限：Site來源 `97895cdc6c37f9a87ffcee3afde412a10d9269b6`，deployment `appgdep_6aeeb57108588191bef3083866bf681f` 於2026-11-07 13:21:59 UTC+08 native succeeded；網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。紀錄output/reports/rocket-capsule-contact-sites.json；部署tar保存成功後移除，保留Site來源checkout及原有附件。
