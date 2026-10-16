# 家庭電路工作台

非評分的家庭電路概念工作台；使用同一 `CircuitEditor.mount()`、工作台 UI、接線／相機／歷史及全螢幕。入口為 [家庭工作台](../sim/circuit-household-workbench/index.html)，需求及驗收決定見[計劃](../plans/33-circuit-household-workbench.md)。實際驗收狀態以計劃的紀錄為準；本地瀏覽器不能代替真手機或 Moodle。

## 共用接合

- `analysis: 'household'` 明確選取家庭有效值模型；DC 的 v6 及 AC 的 v7 不作隱式轉換。家庭 runtime 只由家庭入口載入，DC／AC 不增加家庭依賴。
- [元件](../sim/circuit-workbench/circuit-household-components.js)登記十一類器件、端子及同一套實物／符號 SVG；家電款式、功率、故障及人物站立狀態使用既有檢視器與快捷選項。
- [接線規則](../sim/circuit-workbench/household-connections.js)供模型、接線提交、元件吸附及匯入共用。供電端固定身份與家電引線預定用途分開；家電兩條工作線的九種接法、外殼引線錯接及未接均合法；供電側 L／N／E 互接、開關／保險絲錯串 N／E 亦保留，按有限線路阻抗求解。
- [模型](../sim/circuit-workbench/household-model.js)使用共用 solver 的線性網絡求解能力；擁有接觸、保護計時、事件及電能。對地電勢使用供電等效地；懸浮電勢不自行設成零。
- [介面補充](../sim/circuit-workbench/circuit-household-ui.js)只接入既有畫布、選取檢視器、說明及一行觀察，不另造編輯器或題目流程。「圖上標示」保留共用的導線電流、電勢方向全顯示／全隱藏及電勢色彩；L／N／E 圖例附加在原區域，不能清掉原控制。選取導線或元件後也可各別開啟標示，初始保持關閉以免擠滿畫布。
- [示例](../sim/circuit-household-workbench/presets.js)提供九個概念小電路，加保險絲變式及空白工作台；重複的 C08 接線比較已移出選單，保留工廠入口供舊文件及回歸使用。所有示例均可自由改接，不評分，也不以預設接法替代實際求解。

## 物理及讀值

設定中的「家庭供電與標示」提供供電電壓 220／230 V、「顯示接線標示 L／N／E」及「顯示市電電壓」。兩個顯示選項預設關閉，獨立於總畫布讀值選項，對實物／符號及 SVG 匯出皆生效；端子仍可接線，無障礙名稱及側面圖例保留。切換示例保留供電選擇。錶面內的數字、單位及保護器字樣跟機殼同比例縮放，不再以最低螢幕字級把字放大至遮住圖案；電能表數字限於固定顯示窗寬度，詳細數值可選取元件在面板查看。

單一 220／230 V（設定選擇，預設 230 V）、50 Hz 市電源，採有效值電阻等效：家電 `R = 230² / 額定輸入功率`，工作電流、功率及外殼電勢按實際連接及所選電壓計算；220 V 時沿用 230 V 額定等效電阻，工作功率隨電壓平方減少。交流往返箭嘴只作概念示意。圖上導線電流是有效值，電勢方向及色彩採本模型的參考電勢，並非 50 Hz 瞬時圖；插座比較 L／N，人物比較雙手，其餘器件沿用實際支路兩端。單端接地符號沒有跨端電勢方向。開啟電勢色彩時，外接導線依計算電勢著色；關閉後恢復 L／N／E 線色，角色及家電自帶線芯身份不變。

供電等效電阻 0.05 Ω；每條外接導線、電表、閉合開關及保護器每通道 0.001 Ω，固定而不隨畫面線長改變；家電 E 端至金屬外殼仍視為內部理想連接。外殼受損絕緣取 2000 Ω。人體以兩手各經 1000 Ω 接到同一身體節點，站地時身體再經 1000 Ω 回等效地，站椅時只斷開腳的支路；單手至地或雙手之間等效 2000 Ω。金屬外殼故障支路固定在家電預定 L 端；反接不會把故障移到另一端。雙重絕緣的指定故障只破壞內層，外層仍隔離。

家電內部的電流箭嘴沿 L／N 引線及馬達線圈／電熱絲顯示，符號視圖則穿過負載符號；沿用共用電流／電子／關閉選項，與外接導線同步交流往返。正常地線無箭嘴，漏電時依各端子實際電流及故障支路顯示，不把全部漏電量誤當地線電流。洗衣機不把衣物、滾筒及轉軸當導體，風筒沿單一等效工作路徑示意。斷電停止、暫停凍結，動畫不改物理模型或存檔。

市電本體的兩條可見線芯亦顯示實際端子電流，曲線與圖案一致，沿用同一交流相位、電子反向及停止規則。它們分開顯示，不畫電流穿過套管或兩線之間的絕緣；單獨放置、沒有回路時不顯示箭嘴。

斷路器／保險絲連續超額 2 s 動作，電流達額定值 5 倍則以 0.02 s 快速過流切斷；漏電保護器差流 ≥30 mA 持續 0.10 s 動作，均是教學等效，並非實物完整時間—電流曲線。處理事件時切分模擬步，同時達條件的器件一起切斷後重算；幀率及元件順序不決定結果。手動復位／更換後，未排除的故障重新累計，沒有自動合閘。

有限接地線、固定人體阻值、理想絕緣椅及單層絕緣破損均有模型界限；這些讀值不預測實際傷害或住宅合規。詳細界限放在工作台說明中。

## 文件及權威狀態

匯出封套為 `kind: 'simlab-household-concepts'`、`version: 2`、`model: 'concept-rms-2'`。其 `circuit` 使用獨立的 `simlab-household-circuit` v8／`analysis: 'household'`／`modelRevision: 1` 幾何文件；不是 DC 或 AC 文件的冒用。

`circuit.supplyVoltage` 僅接受 220／230；`display.terminalLabels` 及 `display.showSupplyVoltage` 為布林值。舊文件缺少時分別補為 230／false／false，不更動接線、時間、電能或切斷前讀數；DC／AC 文件不接受這些家庭欄位。顯示開關及電壓選擇沿用單次復原／重做及只讀限制。

封套保存實際接線（含錯接及自由端）、元件參數、`contacts`、`timeSeconds`、`protection` 及 `energyKWh`。市電圖案自帶 L／N 線芯，但從工具箱取出市電或接地元件均不自動附加外接導線；點按取件、拖放、複製及命令新增使用相同規則。用戶自行取普通導線，任一端均可吸附接地 E 接線點，可經共接點連接插座、家電地線或手部；也容許供電角色互接，由實際電流顯示短路或回流改變。所有外接導線兩端均可拔接、刪除及分支，移除元件只把導線拔開留在畫布。舊檔的市電／接地 `anchor` 經驗證後移除固定標記，保留接線、線形及模擬狀態；匯出接線範本清空全部導線及共接點。

斷路器／漏電保護器只在按把手時開合或復位，按外框、額定值及狀態文字只選取；把手命中以按下時的局部座標判定，隨元件旋轉，拖動不開合。符號視圖以中央雙接點區操作。鍵盤 Enter 選取本體，開合及復位使用面板控制。檢視器「開關狀態」即時顯示「跳掣（已斷開）」，選「合上」或按「復位並合上」均執行既有明確復位命令。這個顯示選項不寫入元件參數或文件。熔斷保險絲點本體只選取，須按「更換保險絲」恢復；播放中跳掣／熔斷也即時更新狀態及「復位並合上／更換保險絲」，不需改選一次。提高額定值或移除故障不自動恢復供電，未修好就合上仍會再次動作；只讀狀態停用操作。

v1 文件經嚴格驗證後轉用此模型，保留接線、時間、電能及保護／人體事件；舊事件缺少切斷前讀數時保持 null，不補算歷史數字。每個保護紀錄含狀態、計時種類 timingMode、累計秒數、原因、currentBeforeTrip／residualBeforeTrip，以及 `bodyCurrentSeen`／`bodyCurrentBeforeTrip`。前者保留本次動作計時區間曾有人體電流的事實，後者在跳掣時保存該事件；回到門檻以下、手動斷開或復位清空相應區間及切斷前讀數。不能因跳掣後電流變零而隱去曾有人體電流。切斷前電流與目前通過電流分別標示，事件在拔掉短路及保存／載入後保留，直到明確復位／更換。

接觸對象須存在且是家電，手部位置須與外殼接觸相符。站地／站椅切換保留手的接觸位置；搬開人物或用電器、換用不同外殼款式時會解除接觸。匯入先完整驗證，失敗保留原文件；成功載入及復原／重做先暫停。幾何與參數預覽用副本，凍結權威時間，取消不提交。

金屬外殼家電、雙重絕緣家電及人物禁止整件旋轉：旋轉按鈕隱藏，R／Shift+R、命令及 model 操作均受同一元件能力限制，教師及接線模式也不能覆寫。仍可搬動、接線及切換款式；內部扇葉、滾筒及刀片動畫照常。舊文件的既有方向保留，避免改動接線及手部接觸位置；載入後也不能再旋轉。

人物採有五官、髮型、衣領／袖口、手指、褲袋及鞋底的原生 SVG，站地與站椅沿用相同手部接觸座標。站椅時腳底貼在絕緣椅面上，外形邊界包含抬高後的頭部。選取人物後，下方共用快捷選單直接切換「站在地上／站在絕緣椅上」，沿用 `setParam`、權限及單步復原；切換保留既有手部接觸，人體電流按原模型即時重算。

兩手各有可見的接線點：右手沿用 `person:hand`，左手為 `person:hand-left`，兩個 44 px 目標均使用共用導線端吸附、拔線、共接點拆線及讀電勢。可把導線端拖到手，也可拖手部圓圈，帶動人物靠近未接的導線端點／共接點，以 24 CSS px 距離吸附；指定手部的吸附只接正在拖的那一手，不順帶接另一手。右手另保留既有拖手接觸外殼。雙手亦可直接吸附任何非人物元件的實際端子，包括家電 L／N／E、插座三孔、市電及接地。手與端子精確重合時接通，移開立即斷開，不新增／拆分導線、不耗庫存。一般線身靠近或交叉不接通；人物本體拖動不提供端子吸附。原有普通導線仍保持接線，需要斷開時拔線。預覽凍結權威狀態，Escape／取消不接線，放手是一次可復原操作；兩手拖動及已接另一手仍遵守有限線長、移動／接線權限及只讀。已有任一手接線或直接接觸端子時，底部站姿切換保留雙手與導線位置。普通接線保存在原 `wires`，直接接觸由雙手及端子重合的幾何保存並求解；兩者共用接線角色判定，沒有新增存檔欄位；舊文件、原有 `contacts` 和單手至地電流保持相容。雙手不以理想導線短接，而經有限人體電阻連接，故兩手分別接 L、N 合法，直接把不同供電角色接同一手也會保留，可能形成繞過人體的導線短路。站椅只切斷腳的回路，兩手跨 L／N 時仍有人體電流；同接 L、同接 N 或只接一手的站椅狀態沒有持續人體電流。選取人物顯示人體電流、雙手電壓及流向地面的電流；人體電流取各支路絕對值最大者，避免把同一雙手電流加倍。移動人物或改接觸對象遵守原有線長限制，失敗保留原文件。

採插座的示例（C01–C06 及相容入口 C08）的市電經電表／保護裝置後先向右延伸為水平 L／N 幹線，再以有實際共接點的向下分支接插座，插座再接家電。C06 的兩個插座分別從同一對幹線取電；拔開其中一個分支不切斷另一個，觀察句會指出仍有多少件正在工作。切換家電種類時，既有預設名稱跟隨新種類更新；自訂名稱及名稱編輯限制保留，載入舊文件不重新命名。導線轉折採直角，線路交叉仍不自動接通；這是初始示例布局，載入舊文件時不重排學生的接線。

頁首固定為「家庭電路工作台／概念探索／認識家居接線與用電安全」，不隨示例改為問題句。示例以共用 optgroup 分為「接線基礎」「防觸電保護」「過流與短路」，標題採「主題：比較內容」。工具箱順序為市電、電能表、斷路器、漏電保護器、保險絲、普通開關、插座、接地、金屬家電、雙重絕緣家電、人物；不改種類身份及庫存。C02 將開關移到火線下方路徑並縮短繞線，N 線避開未連接的 E 孔；C06 左右排列兩個獨立支路，避免下方支路穿過上方家電；插座接地引入與引出分開，沒有重疊線段。既有存檔不自動重排。插座接地引入及家電 N／E 回線另保留至少 24 單位的平行間距，避免縮小後貼合；垂直交叉沿用共用跨線顯示，交叉不接通。

目前選單內的每件家電均有獨立火線開關。一般插座示例將它置於 L 分支；C02 保留可改接零線的原開關。C07 使用 5 A 斷路器及三個有開關的並聯負載：400 W 攪拌機、700 W 吸塵機及 1200 W 吹風機。初始只開第一件；前兩件一起仍未超額，第三件加入後持續超額而跳掣。關掉第三件不自動復位，須按把手重新合上。多件家電的一行觀察會顯示實際總功率。C07fuse 簡化為市電、3 A 保險絲、火線開關及 1200 W 吹風機，初始斷開，合上後觀察熔斷；保留讀數及明確更換。兩例不加入插座或地線。保險絲的實物／符號邊界包含規格文字，使共用標籤布局能避讓名稱。

人體電流達 1 mA 顯示門檻時，人物改為閉眼、繃緊嘴部，肩旁出現顫動標記；頭部與軀幹沿既有 frame 輕微左右顫動。手掌、雙腳、椅子、端子及導線固定，沒有旋轉整個元件或改動接觸狀態。橙色虛線只沿實際有電流的手／腳支路流動；雙手回路不畫經腳接地。電流歸零後立即移除表情、標記及路徑，保護切斷後仍由原事件文字說明曾有人體電流。暫停、只讀及頁面隱藏凍結動畫，拖曳預覽則跟家電一樣繼續示意、凍結權威物理時間；重畫保留相位，存檔不加入相位。減少動態效果時保留靜態反應及路徑，停止顫動與流動；反應及幅度不代表實際傷害程度，顯示門檻也不是安全界線。

C10「短路保護：大電流與跳掣」有市電、15 A 斷路器、火線開關及 60 W 塑膠風扇；預留跨線一端接 L，拖自由端到 N 可觀察低阻旁路、快速切斷及保留讀數。拔開短路後仍須明確復位。短路偵測沿實際閉合導電路徑求得，保護器按自身電流動作，上游或旁路短路不會令無故障電流經過的下游裝置假跳掣。平衡 L–N 短路也不會單憑過流令純 RCD 動作。

C09「人體觸電：雙手接火線與零線」只有市電與人物，兩手分接 L／N；拔開任一手再接回，直接比較回路與人體電流。可在 C04 把兩手接在保護器後的 L／N 比較：站椅時回流經 N 返回，差流為零，漏電保護器不會因人體電流而跳掣；站地時另有對地支路，按實際差流及延時動作。

電流／電壓、SVG、相機、捕獲及面板是派生或暫態資料，不保存為答案。重新整理從 C01 開始，沒有本機自動進度恢復、成績或 SCORM attempt。

## 觸控

控制面板的「導線顏色」有三個互斥選項：火線／零線／地線顏色（預設）、電勢漸變顏色、普通導線顏色。地線黃綠條紋及身份圖例只在第一種顯示，電勢色階只在第二種顯示；普通模式使用共用灰藍色。舊文件的 `display.potential` 保持相容，只有普通模式保存可選 `display.roleColours:false`；不改電學結果或 AC／DC 的原勾選設定。

電勢模式的家庭色階採低藍／高紅，外線依分析結果的有效電阻作逐段 SVG 漸變，元件引線亦依各端子實際電勢配色；保護器兩側分開處理，未知電勢顯灰，不把 L／N／E 身份當作電勢。普通模式同時統一元件引線顏色；兩種模式都移除引線的黃綠覆層。拖板外部白線外皮維持白色，內線透明度不變。DC／AC 色階及物理模型保持。

三位拖板 `house-power-strip` 只加入工具箱，不加入既有示例。三個插位的 L／N／E 各自並聯至總插頭；白殼內幹線相距 3 單位、透明度約 88%，外線只畫白色外皮與邊框。插頭獨立拖動，以 24 CSS px 吸附現有插座或另一拖板的空位，三腳一起接通，拖開即斷開；一個插位只接受一個插頭。方向鍵移動插頭、Shift 微調、Enter 吸附，觸控沿用放大預覽。線長限制 600 世界單位；只讀、鎖定及禁止改接線時不能插拔。保存沿用 v8 元件參數 `plugX / plugY / plugAngle`，插入關係由精確幾何派生；v2 session 不變。模板匯出前須先拔插頭。圖像、幾何及 Node 驗收記於[家庭計劃](../plans/33-circuit-household-workbench.md#三位拖板追加2026-10-16)，本輪按用戶要求不開 Chrome。

插入後搬拖板本體，插頭留在接收插座，只有白色電源線形狀改變；線拉盡時限制本體移動，不自動拔頭。搬動接收插座時，插頭隨插座保持插入，拖板串接亦遵守這個規則。直接拖插頭才能拔出；未插入時插頭隨整件搬動。此規則在家庭幾何 reconcile 統一處理，涵蓋本體拖動、方向鍵、move 命令及元件吸附；隱藏插頭腳不參與本體接普通導線的吸附，不新增保存格式。

手機沿用共用工作台的收合面板、局部 44 px 目標及 24 CSS px 吸附。家庭版畫布沿用 DC／AC 共用的全闊 surface，不額外扣除兩側寬度或加 margin；左右底角沿用共用的 32×64 px 短捲頁把手，覆蓋在畫布底角，不預留全高空白帶。家庭版非操作空白仍為 `pan-y`。拖線／拖手使用其本身的 `none` 目標及共用放大預覽。精細拖動時保持底部操作列及觀察句高度，避免重排取消捕獲。

雙指導航沿用共用相機；第二指建立相機手勢時才取消該次原生多指預設動作，單指空白捲動仍由瀏覽器處理。沒有外層 CSS 鎖定、捲動回寫或虛構 host 接收器。部署 owner、逐步樣本及可信輸入見計劃的 T0–T3 證據；跨來源 Moodle 與真手機另驗。

## 打包與驗證

金屬風扇採圓形護網及長支柱，雙重絕緣風扇採帶提手、短腳及五葉扇的方形塑膠機身，兩款有不同輪廓。兩類仍以同軸正面剖視表示馬達帶動扇葉，內部半透明；雙重絕緣邊界圍繞馬達，金屬款維持 E–外殼接點。動畫接入共用 editor 的既有 frame，一般播放以實際推進的模擬時間及 `working` 結果旋轉扇葉；護網不轉，暫停、斷電、保護切斷及只讀時停止。角度只是顯示狀態，不寫入存檔；轉速為教學示意。

拖動、觸控導航及參數預覽期間，電路權威時間、電能及保護計時仍凍結，示意動畫則按同一 frame 的經過時間、慢動作倍率和播放速率繼續更新。動畫仍看當前預覽的 `working` 結果，明確暫停／斷電／只讀／頁面隱藏時不轉動；移動其他元件也不會把已通電家電的動畫停住。扇葉、刀片、送風滾筒及風擺沿用此共用時間入口，不增加另一個動畫迴圈或把示意角度寫入存檔。

冷氣機工作時亮綠色指示燈，機身右下角顯示固定「25°C」，下方風擺按模擬時間每 6 s 緩慢往返；不是室溫或製冷計算。斷電／保護切斷後熄燈、隱去溫度並停止風擺；暫停只凍結擺動，保留通電顯示。風擺相位沿用家庭 UI 的暫態動畫處理，不加入存檔，重畫時保留，刪除元件及 destroy 時清理。

冷氣內部送風部分另用專屬 SVG：馬達位於橫向送風滾筒一端，轉軸兩端分別接到馬達端蓋及滾筒軸心，另一端有支承。內部組件半透明，之後再疊上淡色機殼面板；葉片及連軸均可透視。此圖只表達室內送風部分，1000 W 仍是既定整機等效負載，不代表該送風馬達的獨立功率；端口及外殼接觸座標保持原契約。

實物開關只畫搖板，不再在其下方疊加灰色開關符號；符號視圖仍保留標準開關圖。金屬風扇、熱水器及冷氣的圖內接地螺絲放在左側；外接端子不變。冷氣有塑膠外罩及內部金屬機架，E 線接在機架螺絲，機架、螺絲及故障路徑均在半透明外罩內。塑膠外罩不等於雙重絕緣；本模型冷氣的「接觸外殼」代表接觸導電金屬部位，檢視器有明示，不模擬塑膠表面導電。實際機款應以廠方指定接地端子為準，見 [Daikin 安裝手冊的 earth terminal 說明](https://www.daikin.eu/content/dam/document-library/installation-manuals/ac/sky-air/fhq-cb/FHQ-CB_3PEN368557-3B_Installation%20manuals_English.pdf)。左／右只屬教學圖布局，不是產品接地規定。

冷氣滾筒的葉片會繞水平軸更新投影，機殼及支架位置固定；與風擺共用既有 frame，暫停或無工作電流時停轉。熱水器及風筒使用連續螺旋電熱絲，半透明剖視下通電呈紅色、斷電恢復灰色；紅色是加熱狀態提示，並非水中實際發紅或熱慣性模型。風筒先由馬達帶動扇葉送風，再經加熱區；攪拌機改為直軸連接杯底刀片，吸塵機改為連軸抽風葉輪。這些轉動均跟隨 `working` 及模擬時間，位置／功率／端口／原文件接觸座標不變，沒有加入溫度或機械動力學求解。

雙重絕緣家電目前提供攪拌機 400 W、風扇 60 W、吹風機 1200 W、吸塵機 700 W；新元件及 C05／C06／C08 使用攪拌機。舊台燈只供舊文件相容讀取，保留 40 W、原外形及接觸座標，不出現在新元件的種類選單；載入舊台燈時才顯示目前的舊選項。吸塵機文件按目前選定的 700 W 教學款式重新計算負載。

新金屬家電提供熱水器 2000 W、洗衣機 500 W、金屬風扇 60 W。洗衣機取代新選單中的冷氣，以金屬機身、左側接地螺絲、操作面板及圓形玻璃門清楚表達接地概念；500 W 是洗衣運轉的教學等效值，不代表所有機型或加熱模式。滾筒沿用既有 frame／轉角更新緩轉，通電、拖曳、暫停、斷電及只讀規則與原家電一致，轉角不入存檔。舊冷氣只作 `legacyChoices: ['aircon']`，保留 1000 W、圖像、接觸座標及動畫；新選單不提供冷氣，載入舊檔才顯示其舊選項，接線及模擬狀態不自動轉成洗衣機。

資產由 [assets.json](../sim/circuit-household-workbench/assets.json)列出。`npm run package:circuit-platform` 同時重建 DC、AC、家庭工作台及兩個 DC 活動共五包，核對所有 ZIP 檔案與實際原始碼。家庭 ZIP 為 `output/circuit-household-workbench-standalone.zip`，沒有 SCORM manifest。

Node 驗證：`household-connections.test.js`、`household-model.test.js`、`household-state.test.js` 及 `presets.test.js`；[production fixtures](../sim/circuit-workbench/fixtures/household-v1-states.json)涵蓋合法錯接、部分接線、故障、人物及保護／電能狀態。

`tools/circuit-household-browser-regression.js` 檢查原始碼與實際 ZIP。既有 `tools/mobile-scroll-browser-regression.js` 已接受 standalone 資產清單／ZIP，並以家庭 phase profiles 及可信的線端、彎線、共接點、手部、開關、取消、雙指操作補足 T0–T3。這些 runner 及 Node tests 都遵循 test registry 的登記和選取規則。

## Sites 部署（2026-10-15）

[家庭電路工作台正式網址](https://simlab-household-circuit-workbench.ieyp.chatgpt.site)。Sites 原生發布回傳 `succeeded`，version 1，維持新站預設的擁有者私人存取；不是公開學生入口或 Moodle／SCORM 部署。

- Project ID：`appgprj_6ad0b88108c08191a7568eda54a1f36c`；後續重用此站，不使用 repository 根目錄另一站的 `.openai/hosting.json`。
- Runtime 提交：`00247a963ab201ab2d61507d70e96a9302abf241`；Sites 已推送來源：`3d4360a21f5d1b73476fcd8400960444453a0fa6`。
- Saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_ac71e06224e481918fb56a976c98e67d`；deployment：`appgdep_6ad0b99cb81c8191bc8ad6707c7035f7`。
- 獨立 checkout：`output/sites/circuit-household-workbench/`，`static.directory` 為 `dist`。官方 helper 封裝為 `output/sites/circuit-household-workbench-00247a9.tar.gz`；Windows 使用 Git Bash 及 `TAR_OPTIONS=--force-local`。

30 個 runtime assets 與上述 SimLab 提交逐 byte／SHA-256 一致，HTML／CSS 相對引用存在。部署目錄 1280／390 px 的 HTTP 200、根入口跳轉並保留 query／hash、工作台掛載、可信視圖切換、求解可靠、無水平溢出及無執行例外檢查通過；已檢視手機截圖。證據在 `output/sites/household-runtime-verification.json`、`household-browser-verification.json` 及 `household-deploy-390.png`。本次發布沿用前述 385 項 source／ZIP 回歸，未重跑完整 CI、真手機或 Moodle 驗證。

### Version 2：手機短捲頁把手

同一網址及私人存取保持，移除家庭版全高把手樣式，恢復 DC／AC 共用的底角 32×64 px 把手。Sites source commit 為 `eaa140163f618d5bc68098e6dd9557cdbf70d514`；saved version 為 `appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_e2d1bcf1f5188191a9b77e11df00d9ff`，deployment 為 `appgdep_6ad0c949b080819198834d1f12a2886e`，原生回傳 `succeeded`。官方 archive：`output/sites/circuit-household-workbench-short-grips.tar.gz`。

30 個 runtime files 與來源一致；部署目錄桌面／兩種手機寬度的尺寸及基本運作檢查、實際 ZIP 的 T2 兩尺寸 34 次可信觸控捲動均通過。詳細證據見[家庭計劃](../plans/33-circuit-household-workbench.md)。未重跑完整物理回歸、真手機或 Moodle。

### Version 3：標示開關及 220／230 V

同一網址及私人存取保持。預設隱藏接線字母／市電電壓，設定可分別開啟並選擇 220／230 V；修正圖案內文字隨縮放放大至遮住機殼。Sites source commit：`9c054e9c6bb4cbecc43a38c2d25f00fe565f18a2`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_318982c30ea0819194b2dbd06f6f6def`；deployment：`appgdep_6ad0d3537e548191b31cf24c2e5340b8`，原生回傳 `succeeded`。官方 archive：`output/sites/circuit-household-workbench-display-settings.tar.gz`。391 項完整 source／ZIP 回歸及最後 28 項設定專項通過；最終 30 個 runtime files 與部署目錄一致，詳細證據見計劃。真手機／Moodle 另驗。

### Version 4：開關及左側接地圖像

移除實物開關下方的重複符號，三款家電接地螺絲移左；冷氣的機架及接地點畫在半透明塑膠罩內，檢視器明示接觸對象代表導電金屬部位。Sites source：`c695ce930602d702b6437519389064e64280f482`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_2687c148cdb08191a01e28026d494c4f`；deployment：`appgdep_6ad0daa483948191a356aff03ea7f63c`，原生回傳 `succeeded`，原網址及私人存取保持。官方 archive：`output/sites/circuit-household-workbench-earth-art.tar.gz`。Source／ZIP 圖像專項 38 checks、Node 相關套件及部署目錄檢查通過，詳見計劃；未重跑完整物理回歸、真手機或 Moodle。

### Version 5：以洗衣機取代新選單的冷氣

新金屬家電選單改用 500 W 教學洗衣機，保留舊冷氣文件相容。Sites source：`cdc93a3761316f6ea9fcf9d8f18708f1be56d48b`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_ec1e21e282308191bb1acac0ee7951a1`；deployment：`appgdep_6ad0e0ac7e2c8191a0999f274cac13d5`，原生回傳 `succeeded`，原網址及私人存取保持。官方 archive：`output/sites/circuit-household-workbench-washer.tar.gz`。Source／ZIP 圖像專項 42 checks、四個家庭 Node suites 及部署目錄檢查通過；30 個 runtime assets 與來源一致，詳見計劃。未重跑完整物理回歸、真手機或 Moodle。

### Version 6：快捷按鈕與向量讀數

額定電流快捷中欄改用共用 64 px 闊度，44 px 高度及平直內側邊框；家電／站立種類保留 136 px。電能表使用既有 CircuitMath 向量數字，四位小數及 kWh 的可讀標籤放在錶窗內 44×13 SVG 視口，避免 Linux 字型及低縮放文字量度造成越界；原邊界檢查保留。Sites source：`f37f0e4acd971575bb2126cfdc4649dc2c5e226d`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_3d9519ad9fb881918c958cf50d176529`；deployment：`appgdep_6ad0e89e6b348191a06707ff91372f25`，原生回傳 `succeeded`，原網址及私人存取保持。官方 archive：`output/sites/circuit-household-workbench-quick-controls.tar.gz`；30 個 runtime assets 與來源逐 byte／SHA-256 一致，設定 source／ZIP 專項 54 checks 及部署目錄檢查通過，完整回歸及 CI 證據另記計劃。未做真手機或 Moodle 驗證。

### Version 7：把手操作、導覽與示例整理

保護器把手才開合／復位，其他位置只選取；工具箱將保護裝置放在一起，示例分類及標題與 DC／AC 導覽方式一致。固定家庭電路頁首、概念探索標章及副標題；整理 C02／C06 及插座地線路徑。Sites source：`55e19ae2cb09d357e0290f27af274fc6b272dbf3`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_2ec01e7e11e48191b9e61858c6a86a8d`；deployment：`appgdep_6ad0f2be6e888191b174cfb9943af127`，原生回傳 `succeeded`，原網址及私人存取保持。官方 archive：`output/sites/circuit-household-workbench-organization.tar.gz`。最終完整 household source／ZIP **445 checks**、相關 Node suites、DC 手機 smoke 及部署目錄檢查通過，詳見計劃；未做真手機或 Moodle 驗證。

### Version 8：家電內部電流動畫

九款新舊家電及兩種視圖接入共用電流動畫，與外接導線同步，保留反接、漏電及地線實際分流。Sites source：`cd8569e0496af2f1e1dc863b79b6a4ca16de2897`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_599e533c3f548191a82ce13b4cb77b91`；deployment：`appgdep_6ad0f91a77f8819186d5cd3d550d1a60`，原生回傳 `succeeded`，原網址及私人存取保持。官方 archive：`output/sites/circuit-household-workbench-internal-flow.tar.gz`。Source／ZIP 動畫專項 **94 checks**、家庭 Node、共用 component-flow／winding-flow、AC platform、DC flow browser smoke 及部署目錄檢查通過；30 個 runtime assets 與來源一致，證據見計劃。未重跑完整 household 瀏覽器回歸、真手機或 Moodle。

### Version 9：接觸、接線與支路開關

移除重複 C08 選單入口，分開 N／E 路徑；補上市電線芯動畫及雙手直接接觸端子，移開不留額外線；所有現行家電示例加入火線開關，C07 改為三件獨立開關負載，C07fuse 縮為四件元件並修正規格／名稱避讓。Sites source：`9ecbadefad5d9bc8f32d6b0fd7e8dbfec1bda70a`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_ac833ff7ddfc8191ac12677b03c9ed8f`；deployment：`appgdep_6ad106ecfeec81919153754a72e772dd`，原生回傳 `succeeded`，原網址及私人存取保持。官方 archive：`output/sites/circuit-household-workbench-switched-examples.tar.gz`。最終 source／ZIP 完整 **737 checks**、新示例 70 checks、動畫實際幀專項 94 checks、Node 及 DC 吸附回歸通過；30 個 runtime assets 與來源一致，部署目錄入口／手機／桌面檢查通過。遠端 CI 及獨立審查另記實際結果，未做真手機或 Moodle 驗證。
### Version 10：共用標籤布局效能

重用固定障礙物碰撞計算，保留既有標籤位置、物理模型及 CI 100 ms 效能門檻。Sites source：`047d086b9eb54bf133ad2d0ed6012c9e8c0504dd`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_a6f5df4633a08191b72dbccdbafa8973`；deployment：`appgdep_6ad10d6432e08191b2254e5df7c192e2`，原生回傳 `succeeded`，原網址及私人存取保持。Archive：`output/sites/circuit-household-workbench-label-performance.tar.gz`。本輪 AC protection-budget source／ZIP 134 observations、家庭 source／ZIP 70 checks、標籤／layout／電流卡 Node 及部署目錄三尺寸通過。完整 737 checks 為此次共用效能修正前證據；新 head CI 及獨立審查另驗。
### Version 11：獨立審查修正

完整 CI 成功後，兩位獨立 reviewer 及第三位匯總確認的三項問題已修正：N/E 混接的保護接地判定、舊款家電快捷種類空白、舊冷氣改款時的預設名稱。Sites source：`50a240012e60d7ac49f4a338467393c70d80c399`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_78c5b1712bbc8191a92649ba9f685e72`；deployment：`appgdep_6ad117dc05648191baab69c5868fa270`，原生回傳 `succeeded`，原網址及私人存取保持。Archive：`output/sites/circuit-household-workbench-review-fixes.tar.gz`。來源／ZIP 專項 50 checks、家庭四個 Node owner、共用 core／platform-core／AC platform、靜態／registry 及三尺寸部署目錄驗證通過。30 runtime assets 指紋：output/sites/household-review-fixes-assets.json。新 head CI 與原 reviewers 重驗另驗；真手機及 Moodle 未驗。
### Version 12：舊款選單連續操作

修正 UI reviewer 重驗找到的持續焦點問題：舊款改款後同步選項及值，使用值配對，避免第二次改款與畫面不符。Sites source：`fd5ac16f606749ecd4982ebe3831f25f1b3800d7`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_2a77f05ba07c819197786c916cec6271`；deployment：`appgdep_6ad11994cd808191a56e56f6d47ff259`，原生回傳 `succeeded`，原網址及私人存取保持。Archive：`output/sites/circuit-household-workbench-focus-fix.tar.gz`。source／ZIP 50 checks 包含持續焦點可信 ArrowDown、連續改款／歷史；check／registry 及三尺寸部署目錄通過，30 runtime assets 與來源一致。新 head CI 及兩位原 reviewer 再驗另驗；未驗真手機或 Moodle。

### 最新發布：三位拖板與全闊畫布（2026-10-16）

同步 SimLab `9005206` 的全部 30 個 runtime assets，包含三人觸電比較、暫停保護事件及現存短路提示修正、三位拖板，以及移除左右各 32 px 的全高空白留位。Sites source：`a10391a8025f39c4d8d3b36ec6438322996fc397`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_085404f87130819182c913a156419878`；deployment：`appgdep_6ad19c62740481918bd3a616ecf5d5f9`，原生回傳 `succeeded`，原網址及 owner-only 存取保持。官方 archive：`output/sites/circuit-household-workbench-power-strip-fullwidth.tar.gz`，30 個來源檔案逐 byte／SHA-256 相符，證據 `output/sites/household-power-strip-fullwidth-assets.json`。沿用本輪已記錄的 Node／靜態及套件檢查；按用戶要求未開 Chrome，未另做瀏覽器、真手機或 Moodle 驗收。

### 控制面板回復共用高度（2026-10-16）

移除家庭手機 `.workspace` 固定 112 px 的覆寫，沿用 AC／DC 共用 `minmax(112px,31%)`、收合及短橫向布局。SimLab runtime：`66b7d2f`；Sites source：`f3c0829555fc168d8c960b7d79c31b6314229d05`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_89cf71fce6bc8191b474046535a476c3`；deployment：`appgdep_6ad19dd635f08191b47d8da90a185b75`，原生回傳 `succeeded`。30 runtime assets 與來源逐 byte／SHA-256 相符，證據 `output/sites/household-shared-panel-height-assets.json`；官方 archive 為 `output/sites/circuit-household-workbench-shared-panel-height.tar.gz`。原網址及存取保持；本輪為單條 CSS 刪除，diff／家庭包重建通過，按用戶要求未開 Chrome 或新增測試。

### 三種導線顏色模式發布（2026-10-16）

SimLab runtime：`8e2151f`；Sites source：`4fac2a5b0003b8bd15b615e6773d7e17549a8fbc`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_ad95c76b08608191a7b934932987be1a`；deployment：`appgdep_6ad19fa8b7448191b80147785758b671`，原生回傳 `succeeded`。身份色／電勢漸變／普通色選單、舊值相容及 36 個歷史 fixture Node 檢查通過，五包已重建。30 runtime assets 與來源逐 byte／SHA-256 相符，證據 `output/sites/household-wire-colour-modes-assets.json`；官方 archive 為 `output/sites/circuit-household-workbench-wire-colour-modes.tar.gz`。原網址及存取保持；按用戶要求未開 Chrome。

### 電勢模式完整覆蓋引線與漸變（2026-10-16）

SimLab runtime：`802aff4`；Sites source：`8244b335cf5130f4284783f179dc8710051fc09b`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_6adf811a1f08819190c3098fa499ac8e`；deployment：`appgdep_6ad1a23cd59c8191ba8d643a710a16ca`，原生回傳 `succeeded`。修正元件引線殘留身份色，以及家庭外線有效電阻未啟用漸變；統一使用低藍／高紅電勢色階，端子未知顯灰。原 presets／household-connections Node owner 及五包重建通過；30 runtime assets 與來源相同，證據 `output/sites/household-actual-potential-colours-assets.json`，archive 為 `output/sites/circuit-household-workbench-actual-potential-colours.tar.gz`。原網址及存取保持；按用戶要求未開 Chrome，未作畫面驗收。

### 搬拖板時保持插頭插定（2026-10-16）

SimLab runtime：`4091a14`；Sites source：`fa5137d1ecd93ac0e3a7f5817151d1970a7d0716`；saved version：`appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_50d2040a05488191ab0c67ee1f22391d`；deployment：`appgdep_6ad1c1bb1ab88191adccb881a014db78`，原生回傳 `succeeded`。搬本體保持插頭接通，直接拖插頭仍可拔出；Node connections／snapping 及五包重建通過。30 runtime assets 與來源一致，證據 `output/sites/household-anchored-plug-assets.json`，archive 為 `output/sites/circuit-household-workbench-anchored-plug.tar.gz`。原網址及存取保持；按用戶要求未開 Chrome，未作畫面驗收。

### 固定模板插拔與實際供電來源（2026-10-16）

固定元件接線模板仍固定拖板本體；插頭的三個位置／方向參數改由接線權限管理，滑鼠、觸控、鍵盤及文件變更共用規則。只讀、鎖定或 wires:false 仍禁止插拔，不開放其他參數。模板仍須先拔插頭再匯出，重新載入後可接線、插入及拔出。

接線診斷的 connections 改讀求解器實際閉合低阻通路到市電 L／N、獨立接地 E 的來源；connectionSources 列出各引線的全部來源，斷開為空、多來源明確顯示混接。孔位印刷標示及身份線色仍使用原角色判定，不以這些標示作供電診斷。分析結果由文件及保護狀態重算，不新增存檔欄位或版本。工具箱瀏覽器驗收保留正式清單比對、按鈕及圖示尺寸檢查，移除重複的固定 11 項預期。

發布：SimLab runtime `8ea9ccf`；Sites source `8492d861c2dd96dd02e3d60709d72e09e55c999f`；saved version `appgprj_6ad0b88108c08191a7568eda54a1f36c~appgver_ed008e8fb57c81919dbf10cd49082d3b`；deployment `appgdep_6ad1cf2cfab48191a6d7908d9a080b8b` 原生回傳 succeeded。30 個 runtime assets 與提交來源一致，證據 `output/sites/household-wiring-origin-fixes-assets.json`，archive 為 `output/sites/circuit-household-workbench-wiring-origin-fixes.tar.gz`。原網址及 owner-only 存取保持。本機家庭四 Node owner、共用 core／platform-core／snapping、靜態／registry 及五包重建通過；遠端 Quality 38865865094 對應 runtime SHA 的 source／package 結果另記，未開本機 Chrome。

### 普通開關兩端的來源判斷（2026-10-16）

普通開關綜合 a／b 兩端的實際閉合低阻供電來源，去重後只有一種來源便保留 L／N／E 分類；一端隔離或兩端同源不會失去判斷。多種來源另顯示「不同或混接的供電來源」，兩端都沒有來源才顯示未接入線路。分析欄位 sourceRoles 由當前接線與開合狀態重算，不寫入存檔；孔位字母及身份線色保持原用途。
