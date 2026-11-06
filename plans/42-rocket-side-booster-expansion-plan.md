# 火箭工廠實驗版：固體側助推器與新增零件實施計劃

狀態：**已實作並完成下方列出的本機驗證；完整裝置／Moodle閘門未完成。** 日期：2026-11-06。現行兩對／提早分離決定見第17節；早期規格及驗收按日期保留。下方規格已用於本次版本，完整配搭仍未逐一實飛。

依[活動基準計劃](42-rocket-side-booster-lab.md)、[新活動模板](NEW-SIMULATION-PLAN-TEMPLATE.md)、[共用設計](00-shared-platform-and-style.md)及[生產契約](../docs/simulation-scorm-production-guide.md)。本文件擁有後續擴充決策；基準計劃的既有測試／ZIP證據只適用未擴充副本。

## 1. Scope：要交付甚麼

只修改 `sim/rocket-side-booster-lab/` 的新活動，加入三件可配搭零件：一對固定推力固體助推器、一種中型燃料箱、一種均衡型液體引擎。保持150 kg載荷、一／兩個核心級及原入軌任務。

使用者已選：固體、固定推力、手動分離、主引擎可獨立調油門。其餘在本計劃作第一版具體設計，不視為已寫好的功能。舊 `rocket-space-mission-lab`、其manifest／測試／計劃／既有ZIP均不改；shared runtime亦不因本功能修改。

無新套件、圖片或外部runtime；沿用程序式Three.js模型、原位組裝ghost、現有UI／SCORM。第一版不做單側、四枚、助推器改裝／獨立油門、交叉供油、回收、燃燒中拋棄、任意側掛位置或完整剛體姿態。每級總箱數仍最多四個。

評核維持形成性／低風險browser grading，不作可信高風險成績來源。活動slug、activity ID及manifest路徑維持基準；擴充用新的answer／model版本隔離資料解讀。

## 2. 零件規格與配搭取捨

### 核心液體引擎

| 引擎 | 狀態／ID | 最大推力 | 乾重 | 比衝 Isp | 設計用途 |
|---|---|---:|---:|---:|---|
| 大推力引擎 | 現有 `engine-0` | 600 kN | 500 kg | 300 s | 重型下級、較大起飛推力，耗油較快 |
| 高效率引擎 | 現有 `engine-1` | 80 kN | 150 kg | 340 s | 輕型／上級，推力小、比衝高 |
| **均衡型引擎** | **新增 `engine-2`** | **250 kN** | **250 kg** | **320 s** | 中等重量核心級；推力、乾重及效率介乎兩者之間 |

新增引擎可裝主級、下級或上級，不限制到指定位置；每個核心級仍只裝一款引擎。三款皆沿用0–100%油門、關機及有燃料重燃的既有教學模型。新引擎不得在全部參數都優於舊款；須保留推力／重量／效率的選擇。

### 核心燃料箱

| 燃料箱 | 狀態／ID | 可用推進劑 | 乾重 | 初版顯示高度 |
|---|---|---:|---:|---:|
| 小燃料箱 | 現有 `small` | 1500 kg | 100 kg | 2.4 m |
| **中燃料箱** | **新增 `medium`** | **3000 kg** | **200 kg** | **3.25 m** |
| 大燃料箱 | 現有 `large` | 6000 kg | 400 kg | 4.1 m |

容量選現有兩款之間，三款燃料／乾重比相同，避免新箱無條件較划算。中箱等於兩小箱容量，但只佔四個箱位之一；大箱仍有最高單箱容量。三款可混搭、插入中間、重排、跨級搬移、拖回元件箱；上／下級燃料各自共用，不能供應固體助推器。模型外觀高度是組裝示意，不用它反推實際容積／密度。

### 固體助推器

| 項目 | 每枚候選值 | 安裝一對 |
|---|---:|---:|
| 固定推力 | 120 kN | 240 kN |
| 固體推進劑 | 3000 kg | 6000 kg |
| 乾重（含固定連接件） | 300 kg | 600 kg |
| Isp | 250 s | 相同 |
| 初始總質量 | 3300 kg | 6600 kg |
| 燃燒時間 | 約61.29 s | 同步耗盡 |

固體部件是整合引擎／燃料的完整零件，不佔核心燃料箱位，不接液體燃料管，不可在工廠拆成引擎與箱。兩枚規格相同，永遠成對裝拆／點火／分離，以維持平面模型的對稱條件。

固定推力是使用者指定的教學簡化；真實固體推力與燃面／噴嘴／環境壓力等有關。[NASA固體引擎原理](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/solid-rocket-engine/) 支持這個區別，並不提供本表候選數據。介面簡短標示「本模擬採固定推力」。

## 3. 玩家操作與組裝

### 元件箱及側掛位置

元件箱按現有樣式擴充至三引擎／三燃料箱／一對固體助推器／分離器／太空艙，按「引擎、燃料箱、其他」簡短標籤排列。卡片顯示容量或推力與乾重；選取後可看比衝／燃燒時間，避免每張卡塞滿文字。

核心繼續由下向上組裝、最後完成太空艙。下級已具備引擎與至少一箱時，才可安裝助推器；側掛操作在裝艙後亦可做，因為不延長核心。左右兩個可見側接點代表同一對零件；拖到任一側即預覽／安裝整對，不能只裝單側。

沿用30 CSS px附近吸附與可見接點預覽；新增側接點的動作使用明確part／stage／target種類，不把points陣列索引當核心級號。拖動／cancel／失焦／第二指中斷只改預覽，不改craft或保存草稿。鍵盤及點按提供「安裝到下級側面」，選中任一助推器可一按／Delete成對取下。

已有助推器時仍可替換核心引擎、增減燃料箱；若操作會令下級不完整，拒絕該操作並提示「先取下側助推器」。不靜默刪除助推器。移除全部元件亦清除整對，但保留既有試飛成果；飛行／check／唯讀時不可改裝。

### 發射與飛行控制

| 操作／事件 | 預定行為 |
|---|---|
| 發射到發射台 | 固體就緒但未點火；保留現有明確點火步驟 |
| 首次點火 | 如有助推器，同時點燃核心及整對固體；按鈕寫「點火：主引擎＋助推器」，即使核心油門0%也須清楚會點燃固體 |
| 主引擎油門／關機 | 只影響當前核心級，固體維持固定推力及耗油；按鈕／slider明確加「主引擎」字樣 |
| 核心燃料先耗盡 | 只關核心；固體照燒，飛行不自動暫停 |
| 固體燃盡 | 推力變0，保留600 kg整對乾重及阻力；顯示「已燃盡，可手動分離」，不自動拋棄 |
| 手動分離側助推器 | 第一版只允許飛行中、固體已燃盡、仍附著、editable；成對拋棄，不改核心油門／角度／點火狀態或running |
| 分離核心下級 | 有側助推器仍附著時先禁用並說明「先分離側助推器」；側推器分離後沿用原核心分級。沒有助推器的舊流程不變 |
| 暫停／檢查／renderer故障 | 凍結模擬時間與固體燃料，不把暫停當固體熄火；需明確繼續 |
| 保留成果／提交 | 仍可在任何editable階段做；固體仍燒時保留的紀錄不得假稱全火箭關機，部分分照計 |
| 地面燒完但未升空 | 可check／提交0分或返工廠改裝；不開放地面拋棄。低推重比只提示，不阻擋這種合法試飛 |

本計劃採「燃盡後手動分離」作首版設計；沒有加入自動分離或燃燒中拋棄。這項限制可在實作前按使用者意見改動。

### 儀表

工廠顯示總質量、起飛總推力及推重比，包含整對助推器；不足1時中性提示「起飛推力不足，可減載或改配搭」。飛行顯示核心各級燃料，加一列「固體助推器（一對）」百分比／就緒／燃燒中／已燃盡／已分離。分離過程只改顯示，不跳動油門或捲動位置。

側推器按鈕與核心分級分開，寫清楚「分離助推器」與「分離下級」，不依顏色區分。兩個分離動作都有44px觸控目標；短手機畫面要重排／允許面板捲動，不縮字或把重要按鈕推到不可達。

## 4. Physics：平行推進及燃料事件

令 `u` 為核心油門0–1，`Fcore` 為核心已點火且有燃料時的最大推力乘u，`Fb=120000 N`；固體同時附著且燃燒時 `Ftotal=Fcore+2Fb`，否則只有Fcore。對稱兩枚沿同一火箭軸線施力，不新增偏航／滾轉剛體積分。

核心耗油=`Fcore/(Isp_core·g₀)`；**每枚**固體耗油=`Fb/(Isp_booster·g₀)`。總質量含未分離核心各級、實際剩餘燃料、載荷、分離器，以及附著助推器的`2×(乾重+每枚剩餘燃料)`。[NASA比衝定義](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/) 支持此耗油關係；不同引擎Isp不能任意平均後套一次火箭方程。

沿用RK4，只把其燃料向量擴充為核心當前燃料與對稱助推器的每枚燃料。每個子步取原步長、核心耗盡時間、固體耗盡時間的最小值，事件後重算剩餘時段，不負油量、不漏時間、不先熄掉仍有油的另一組。零流量不能除以0或令積分卡在0秒。碰撞事件截短的同一實際dt亦用來扣兩組燃料。

現有`M.step()`回傳單引擎理想Δv的公式不能直接套在雙Isp推進；保留其呼叫介面，按同一子步積分`Ftotal/m`的純推進Δv，並驗單引擎極限仍符合火箭方程。保留地形接觸／模型時限與每幀工作量預算。

阻力沿用既有有效CdA做法：沒有助推器完全沿用原數值；附著時加入兩枚固體的有效迎風面積（初版半徑0.65 m，以同Cd相加作簡化），分離後移除。比重或燃料減少不能順便消除外殼阻力。

`totalThrust`、主／固體各自燃燒狀態與「全推進器關機」在model／parts共用既有入口或少量清楚函式，供UI、scoring及scene使用，不在每層再寫一套判斷。主引擎lit但油門0仍保留原「已點火」語意，不能當完全關機；固體燃燒時即使主引擎關閉也維持燃燒模式及最多5×，不開放真空滑行1000×。

### 已執行的靜態數值檢查

以下只用現有地球g與候選參數算初始推重比，不代表已飛行或能入軌。單級、150 kg載荷、均衡型引擎：

| 核心燃料箱／助推器 | 主油門 | 初始總質量 | 總推力 | 起飛推重比 |
|---|---:|---:|---:|---:|
| 2大箱／無 | 100% | 13,200 kg | 250 kN | 1.929 |
| 2大箱／一對 | 40% | 19,800 kg | 340 kN | 1.749 |
| 2大箱／一對 | 100% | 19,800 kg | 490 kN | 2.520 |
| 4大箱／無 | 100% | 26,000 kg | 250 kN | 0.979 |
| 4大箱／一對 | 40% | 32,600 kg | 340 kN | 1.062 |
| 4大箱／一對 | 100% | 32,600 kg | 490 kN | 1.531 |

Node assert已核對新引擎推力／Isp介乎舊兩款、中箱容量介乎舊兩箱、固體每枚約48.946 kg/s及61.292 s，並驗4大箱配搭加助推前後跨過推重比1。這提供候選量級，不保證任何配搭都有高效航線；0.979也不是「壞存檔」。

## 5. Responsive layout、3D及手勢

保留header／stage／panel與原959px斷點、bounded split-panel、全活動fullscreen及原相機操作。元件卡依原網格自然增加行數，沒有新增首頁／層層選單；工廠／飛行仍可看見stage並捲動panel到最後一項。

三款燃料箱沿用相同接合直徑，以高度、字母／容量標籤及環帶辨識；均衡引擎使用可辨認的噴嘴／色帶，不沿用「engine不是0就當1」分支。引擎本體維持現有2 m裝配高度，逐一驗上級整流罩／接點／火焰位置，不讓新engine落入舊高效率形狀的默認分支。

固體每枚候選長6.6 m、半徑0.65 m，左右中心距核心軸各2.4 m，噴嘴高度對齊主級噴嘴；此為程序模型初稿，可因接點／發射架淨空調整。固定掛下級，由實際part bounds計算完整寬高；短下級、上級、太空艙及基地支臂都要檢查，不能只驗最高核心火箭。

左右網格以同一邏輯pair零件點選、取下；三組火焰（核心／左／右）分別依真實燃燒狀態顯示。燃盡後側火焰熄、核心不受影響。分離由掛點的實際位置速度開始，兩邊沿視覺側軸展開；主飛船速度不因刪乾重突然增加，左右分離脈衝對稱抵消。鏡頭追核心，不被離體助推器拉遠。

現有scene只保留一個下級分離體；擴充為最多兩枚助推器＋一個下級的有界離體清單，沿用同一場景／renderer／animation loop及既有coast／impact基礎。只在分離事件建物件，落地／超時／返工廠／重建／renderer恢復時釋放；它們是視覺效果，不是計分權威，也不另存完整掉落歷史。

`partBounds`、`hullPoints/hullMinimum/hullClearance`、地表偏移、raycast、裝配／drag ghost、鏡頭取景、力箭頭支撐半徑、火焰噴口及基地收臂淨空要包含新外形。物理觸地沿用既有飛行參考點與地形模型，不順便改成新剛體碰撞引擎；畫面接地依完整外形修正，不以視覺mesh反改已保存速度／位置。

新卡、側接點、已裝pair及新增按鈕加入原手勢矩陣；panel捲動／stage空白／兩側scroll strips保持原owner。所有新組裝操作有鍵盤替代及原位ghost；不需要另開精密放大視窗。新側接點不得用跨整個stage的透明overlay侵佔空白捲動。

## 6. Phase/state matrix與轉移

不新增任務variant，variant仍0；不新增沒有畫面的phase。用助推器狀態區分同phase的合法續作，**每一列均需production encode/decode/restore＋一個合法UI／model續做**。

| Phase／variant | 必須／不得出現 | 合法下一步及check路徑 |
|---|---|---|
| workshop 空白／部分／完整，無pair | flight=null；三種箱／引擎可混搭但依原組裝依賴 | 裝件／check；完整後launch |
| workshop 有pair，無／有capsule | 下級完整；craft.boosters=2；flight=null | 成對移除、合法核心編輯、launch／check |
| pad 無pair／有pair ready | 完整craft；ready燃料滿；status=pad、maxHeight近零 | 首次ignite／控制／check |
| ascent（status=pad）固體burning／spent而未升空 | 點火已進ascent，但未達離台條件；時間／燃料合法，不能手動地面拋棄 | 調核心／續跑／返工廠／check |
| ascent 固體burning，核心lit／off／已耗盡 | 附著有燃料；即使核心off亦不得當全關機 | 核心控制、續燒／保留／check |
| ascent／coast 固體spent仍附著 | 固體燃料0；仍計600kg乾重與阻力；phase按核心lit決定 | 手動jettison／核心控制／保留／check |
| ascent／coast 無pair或已jettisoned，核心分離前／後 | jettisoned燃料0；核心active/separated關係沿用；分離上級後不可有附著pair | 核心分級／重燃／關機／保留／check |
| ended impact／escaped，pair各可達狀態 | 終止時保留燃料／狀態供還原，之後不再積分或提供分離控制；不把終止當可手動關固體 | 保留部分成果／工廠／check |
| check × 上述每個backPhase／variant | 完整保留原語意，running=false，絕不讓固體在check耗油 | return原列／明確submit，含全空白 |
| review／committed 新5或舊2/3/4 | 分版本驗證／重評；始終唯讀 | 查看；committed只retry finish |
| frozen pending-final 新或舊review | 同一canonical payload、合法版本與可重評答案 | 只retry原份；不遷移重寫 |
| technical／mismatch | 不接受非法enum／燃料／phase，無不可信分數 | 既有安全復原／技術鎖定；不覆蓋pending／recorded |

助推器最小狀態機：`ready → burning → spent → jettisoned`。只首個ignite可ready→burning；耗盡才burning→spent；飛行中手動操作才spent→jettisoned；各狀態不倒退。返工廠的新試飛按新craft建立新flight，不影響已保留record。

核心`stop`及`record-stop`只停止核心。若固體仍燒，phase保持推進狀態，record記全推進器尚未關機；Controller若按原規則暫停保留操作，只凍結時間。檢查／提交不可因尚未燃盡而被阻擋。

## 7. Persistence contract：版本、欄位與非法狀態

### 新版本資料

維持envelope version1及activity=`rocket-side-booster-lab-v1`；新答案採**schema5／modelVersion3**，避免舊解碼器將新欄位當舊資料。下列是實作目標，不是現有ZIP已支援格式。

| 權威欄位 | 新版本規格 |
|---|---|
| stage | `{engine:null|0|1|2,small:int,medium:int,large:int,order?:string}`；每種0..4、總數≤4；order只含s/m/l且與各箱數吻合；預設由下至上l→m→s時省略order |
| craft | 原payload0、stages[1..2]、separator、capsule?:false，加`boosters:0|2`；2時下級須完整；configuration保留原是否安裝pair，不因飛行分離改craft |
| flight | 原所有欄位，加`boosters:null|{status,fuel}`；status=ready/burning/spent/jettisoned，fuel是**每枚**剩餘kg；null僅craft.boosters=0 |
| booster invariants | ready滿3000且flight.status=pad；burning為0<fuel≤3000；spent／jettisoned為0。jettisoned不可status=pad；jettisoned／null以外皆附著；核心已separated時不得有ready/burning/spent |
| record | 原craft/state/fuel/active/separated/t/status/maxHeight，保存`mainLit:boolean`及上述booster state。`engineOff`由`!mainLit && status不是burning`重建，不能只信匯入的engineOff |
| transient | running、鏡頭／fullscreen、hover／drag、ghost、分離動畫及掉落mesh不存；從答案重畫附著狀態，不重播已分離瞬間 |

compact格式明確版本化：

```text
stage5  = [engine, small, medium, large, order?]
craft5  = [payload, stage5[], hasCapsule:boolean, boosterCount:0|2]
boost5  = null | [status, fuelPerBooster]
flight5 = [source, craft5, t, vector4, coreFuel2, active, separated,
           attitude, [mode, angle, throttle, lit], status, maxHeight, boost5]
record5 = null | [craft5, vector4, coreFuel2, active, separated,
                  t, status, maxHeight, mainLit, boost5]
draft5  = [5, 3, phase, backPhase, craft5, flight5|null, record5]
review5 = [5, 3, record5]
```

vector4仍[x,y,vx,vy]，z／vz重建0；coreFuel2仍[lower,upper|null]。schema5不可猜陣列長度或套舊欄位位置。嚴格驗型別、有限數值、stage／booster燃料上下界、箱次數、phase依賴及與flightcraft的一致性。兩份craft配置只在同一試飛內須一致；已保留record可屬於之前的不同設計。

### 舊資料與錯誤處理

- 同activity的schema2/3/4、model2 **未交draft**：沿用原migration後補medium=0、boosters=0／null，轉schema5／model3，保留phase/backPhase、craft、flight及record；舊record用原engineOff推得mainLit，分數及合法續做必須相同。
- 舊**finished review／pending-final**：保留schema、model、原scorer版本及canonical bytes，不能升版重編或用新表數值重算。新引擎／中箱只在schema5出現；legacy分支不得直接用需要medium欄位的新版capacity。
- 非本activity的snapshot一律拒收。非法finished保持可信摘要及唯讀；非法pending quarantine；非法draft只依既有「確認未交、同ID」復原流程，不自動清除。
- draft、review及包住reviewJson的pending最壞UTF-8大小各自≤4000 bytes。以兩級各四個混合箱、pair所有合法狀態、最大精度座標與時間、舊／新紀錄測試；超標不能截斷或丟record。

## 8. Scoring、SCORM及提交

保留100分四項10／15／45／30及70合格、原軌道與高度容差；不因選新引擎／中箱／助推器本身加減分。空白0，升空／太空部分分獨立保留；無論未燃盡、未分離、配置不完整，都可check及明確submit。

新schema安全入軌／圓化的「關機」需核心未點火且無仍附著燃燒固體。燃盡但未拋棄可計入軌，因為沒有推力，只是較重；不可用「必須先拋棄」作額外得分閘門。全新record保存足夠資訊重評，不信任計分快取。

shared scorm.js／activity-flow.js及全部startup／success／committed／frozen／retry、pending canonical／trust比較沿用基準；同一attempt續作，standalone refresh清空。任何新功能不得新增直接LMS欄位寫入或activity-local commit／finish／page lifecycle。renderer失效亦不能把答案重設或宣稱已提交。

## 9. 實際改動範圍與次序

| 次序／檔案（均為新副本） | 修改及完成條件 |
|---|---|
| A：parts.js／model.js | 新medium／engine-2／pair，統一質量／容量／總推力／耗油與全關機，事件子步／手動分離；先通過物理Node測試 |
| B：persistence.js／scoring.js／ui-runtime.js | schema5／model3、legacy draft migration／review保留、4000byte、核心與固體狀態、warp／保留成果／提交流程；先通過round-trip及lifecycle |
| C：index.html／main.js／styles.css／interaction.js | 新卡／名稱／說明／側掛接點與動作、主油門標籤、pair燃料及手動分離／disabled理由、成果配置摘要／keyboard |
| D：scene-art.js／scene.js／impact-effects.js | 新模型／medium材質／三組火焰、bounds／hull／選取／相機、離體body回收與接地效果；僅確有需要才改impact helper |
| E：新副本七組*.test.js／test-support.js | 移除兩引擎／兩箱硬編碼fixture假設，保留原無pairrecipe；新增下節case，不用繞過production validator的測試狀態 |
| F：tools/rocket-side-booster-browser-regression.js及其.test.js | 沿用既有49-case與三group，新case歸interaction／flight；保留所有原case、source及extracted package |
| G：manifest／sim/config.js／tools/test-registry.js | 現有runtime檔內完成則無新依賴；新增任何runtime檔須先入manifest，新test/helper按契約登記。實作後更新description為真實功能，不提早聲稱已完成 |
| H：本計劃／新activity基準計劃 | 寫清最後候選數值、測試／source commit／package hash／未驗項；不改舊活動計劃 |

不為兩個火箭活動抽新shared core；本次修改不得回寫舊活動。沿用既有入口與API，沒有引入插件系統、任意零件編輯器或新設定頁。檔名列的是可能影響範圍，不要求沒有實際需要也改一遍。

## 10. Test plan與交付閘門

| 類別／owner | 必要檢查 |
|---|---|
| parts／model Node | 三引擎×三箱所有合法選擇、混箱順序／插入／搬移／四箱上限；pair只裝一次且完整下級；總質量／推力／每枚流量；core0/40/100%不改固體；耗盡前後、同時耗盡、core先耗盡、0dt、真空極限、時間／碰撞精度 |
| 分離／physics Node | 燃燒中與地面拒分離、spent飛行可一次分離、乾重精確減600kg、主state速度連續／油門／running不變、核心分級閘門、未拋棄阻力仍在；無pair保持原recipe及數值 |
| persistence Node | 第6節每列（check×每backPhase亦展開）encode/decode/restore＋合法續做＋score相同；非法engine／order／paircount／fuel／status／separated拒收；所有舊draft／review／pending政策及4000byte上限 |
| scoring／lifecycle Node | 空白0／部分／100、固體燃燒時核心off不計已關機、spent附著可得軌道分；所有startup／submit結果、freeze／quarantine／canonical bytes／legacy成績、standalone refresh |
| browser interaction group | 新卡點按／鍵盤／trusted drag／取消、左右側slot同一pair、裝艙後側掛、全拆保留record、面板上下邊界與新fuel row、油門可見／手勢、不受分離改值 |
| browser flight group | 真正UI首次點火、core0固體續推／高倍速限制、燃盡提示／手動分離／後續核心分級、無自動拋棄、暫停／resume／check、source與extracted SCORM相同 |
| browser geometry／資源 | 最短／最長核心、混箱／engine-2、pad／上升／太空／接地、兩側分離實際邊界／畫面尺度、相機追核心、renderer恢復及重複試飛資源無累增；沿用原draw／triangle／texture預算 |
| gesture／layout | 新每種target、工廠／flight／check／review／pending／renderer fallback，T0–T3原owner矩陣；320×500/568、390×500/600/844、844×390、768×1024、1280×800，toolbar／keyboard／200%zoom與fullscreen |
| 回歸隔離 | 舊活動原檔／manifest／owner及原套件hash不變；新activity無pair舊配搭結果保留；新舊ID互拒 |

校準時至少執行：原無助推器手動100分recipe、均衡核心＋混箱的完整飛行、助推起飛→收核心油門→燃盡→手動拋棄→核心分級→上級入軌；再測低推重比、過大推力、燃盡後遲遲未分離及先關核心的失敗／部分分路線。新零件不保證每一配搭都能入軌，但至少須有一條使用新零件的可重現合法成功航線；候選規格以此校準後才凍結。

### 註冊及證據

沿用 `tools/test-registry.js` 的rocket-side-booster-lab scope、七組Node、browser audit及interaction／terrain／flight三owner。新helper／入口須登記，不能把case移到未註冊診斷腳本。browser group audit應驗新增清單及既有49-case仍完整，不只修改硬編碼數目。

- [ ] `npm run check`、`npm run check:tests`、相關Node及完整新activity browser owner通過。
- [ ] source＋extracted SCORM完整適用矩陣、manifest依賴閉包與逐byte來源核對；正式ZIP在output/packages/。
- [ ] 依生產契約跑全庫／package:all及必要CI；commit後保留真實base/head的`test:affected --plan`，registry／catalogue變更預期full。未commit不得寫有committed evidence。
- [ ] 真Moodle student attempt的resume／review／pending retry／分數／新attempt，以及真iPhone／Android／iPad、current/new-window T4另外驗，不能用Chrome模擬冒充。
- [ ] 用最後runtime hash／package SHA記錄結果。清除task scratch，保留必要報告與截圖；不刪備份／worktree。

前次設計交付只完成靜態assert及文件檢查；該次未擴充ZIP的證據保留在基準計劃，不能當成本次新功能證據。

## 11. 實作及實測紀錄（2026-11-05，未commit）

- 已加入三款核心引擎、三款箱及成對固體助推器；沿用本表250 kN均衡引擎、3000 kg中箱、每枚120 kN／3000 kg／300 kg／250 s固體數值。工廠有總推力／總質量／推重比，側接點、點按／鍵盤、原位ghost、獨立固體燃料表、主引擎油門及燃盡後手動分離。兩枚離體物件繼承飛行狀態後按原coast積分，各300kg，最多保留8模擬秒；不改核心速度，凍結時不推進，重建／超時釋放。
- Schema5／model3及本計劃compact格式已實作；為避免重寫已提交資料的舊codec，新增本活動專用persistence-legacy.js並在HTML／manifest宣告。新stage的medium=0及craft無pair時可在記憶體省略欄位（compact仍明確編0），與原空白stage形狀相容。舊review／pending保留schema2/3/4 codec及canonical bytes，舊draft轉5。shared runtime無改。
- 新增已註冊expansion.test.js，實測三引擎×三箱、混箱、主油門0/40/100%下固體固定推力／耗油、關核心後續燒／5×限制、燃盡事件、分離拒絕／成功一次、減600kg而速度及油門不跳、production restore＋續做、非法狀態拒收，以及Controller運行中分離／提交後鎖定。
- 新活動8組Node＋browser分組審計共9入口通過；原無pair滿分recipe保留。新recipe：下級大推力＋2大箱＋1中箱＋固體一對，上級高效率＋1大箱；前15s直上，其後140s漸轉至95°；固體燃燒時主油門60%，速度到7400／7700m/s後降至25／5%，燃盡手動拋棄、下級用完才分級。366.75s保留結果：近地點170.908km、遠地點467.378km、e=.022157，100分；已加入永久Node回歸。這不是所有配搭都能成功的聲明，均衡引擎的每條航線亦未校準。
- browser owner新增expandedParts至flight組，保留原49案例（共50），audit及registry303 entries通過。`--smoke`來源／package命令exit0，涵蓋既有layouts／launchOnly／lifecycle與新操作；之後修正中箱卡片文字及補總推力顯示，最後以`--expansion-only`重驗來源＋重建解壓ZIP、1280×800／390×844共4 flows、errors=[]。後一報告及hash才代表最後包，不把較早smoke冒充最後全矩陣。
- 最後browser證據：output/playwright/rocket-side-booster-lab/report.json；桌面／手機裝配與固體燃燒截圖目視。475份ZIP entries逐byte等於來源並核對依賴，完整hash／檔案大小／舊版隔離記錄在output/reports/rocket-side-booster-expansion.json；正式ZIP為output/packages/rocket-side-booster-lab-scorm.zip，已更新為本次功能。
- 原活動477檔、manifest、browser owner／audit及原plan全部對複製前SHA-256保持一致。本輪沒有部署Moodle／Sites或commit／push，沒有正式committed selection。全50-case owner、完整T0–T3／新target可信手勢、200% zoom／真手機／iPad／Moodle、全庫npm test／package:all／GitHub CI均未完成，尚不宣稱完整package-ready或Moodle-ready。
- 只保留正式ZIP、必要報告及browser證據；本輪scratch scripts清除。前次未擴充clone報告屬歷史，不能用其舊ZIP hash驗本次套件。

## 12. 提交及Sites發布（2026-11-05）

- 實作commit：`6d2a9452cce5b397b62a67214c8e951e1052984c`。正式committed selection以base `28e57a93330d3aa248d2a55886a8a952084d9272` → 該head執行，full／packages=all／303 entries；記錄output/reports/rocket-side-booster-committed-selection.json。這是選取預覽，不是全庫或GitHub CI已跑。
- 新建獨立owner-private Sites：[火箭工廠：側助推器實驗版](https://simlab-rocket-side-booster.ieyp.chatgpt.site)。project_id=`appgprj_6aeca66555b481919803e437687c4fa8`；保留原活動／原Sites，沒有改觀眾權限。
- Sites helper來源commit：`45f6cec0c4545a555d61c6977672b8745a0d8f2e`；474份runtime逐byte從已驗SCORM複製，根入口只加入相對base，build-info記錄SimLab commit及package hash。來源checkout保留於output/sites/rocket-side-booster，發布archive保留於output/sites/rocket-side-booster-deploy.tar.gz。
- Native部署`appgdep_6aeca7a9d2308191a480e0a3771d1768`確認succeeded，2026-11-05 23:58:49 UTC+08；version=`appgprj_6aeca66555b481919803e437687c4fa8~appgver_071cc2bc64d88191a0c52335b38fe978`。詳見output/reports/rocket-side-booster-sites-deployment.json；網址已交Codex browser panel開啟。
- 本輪沒有宣稱線上逐頁瀏覽／真手機／Moodle驗收或完整CI通過；發布成功由Sites native結果確認。

## 13. 分離效果與操作列修正（2026-11-06，實作前決策）

使用者要求助推器像下級分離般自然掉落，先向兩側推開、再滑行接地；桌面操作列不可意外換行，手機亦須減少固定佔高。只改本活動scene／styles／必要HTML定位及既有browser owner，原活動及權威飛行物理、rubric、schema5、manifest依賴不變。

- 分離物以實際掛點／質心與主體速度初始化，左右對稱推出，加入輕微反向翻轉；沿用M.step的重力／阻力／地形接觸。移除8秒消失及每幀100子步造成的追時落差；以每次有界時間預算同步，無進度時停止迴圈，不延長主體模擬時間。
- 跟隨近景沿用核心分離的0.6秒前景視覺過渡及1m=.001場景尺度；掉落位置與模型大小同尺度，禁止再用主火箭隨高度的放大比例乘物理位移。地面emit一次impact，重建／工廠／review清除所有離體物件；最多兩枚，不持續新增mesh。
- 倍率按鈕移到軌道／時間讀數列，飛行動作固定一列；手機按鈕保留44px高，窄屏動作列可側滑，不換成多行。收短關機文案及清楚accessible label；不改倍率選項、油門或實際飛行狀態。
- 沿用flight組expandedParts增驗分離0／.5／2／10秒的初始連續、左右外推、角度變化、位置／尺寸尺度及>8秒仍存在；低高度合法spent fixture續飛至落地，確認impact及無瞬移主體。source／extracted ZIP，桌面／320／390／短橫向，檢查deck高度、倍率列、44px目標／橫向可達及按鍵狀態。既有Node／check／registry與package閉包另驗，真機／Moodle不冒稱完成。

實測：新分離測試4尺寸（1280×800、390×844、320×500、844×390）加原compactDeck七尺寸，來源及解壓SCORM共22 flows通過，errors=[]。實際前景0.6秒過渡、左右速度／質心、輕微翻轉、10秒仍存在、主體狀態不被分離修改，以及核心續飛時兩枚獨立接地／各emit一次均有斷言。桌面底部跨全寬；手機列高不超過80px、44px操作目標、倍率固定位置、面板滑動不改答案及核心分級位置保留通過。桌面及320／390截圖已目視。

新活動8組Node、browser audit（保留原49＋新增兩case，共51）、check／check:tests（303 entries）通過。套件475 entries逐byte對來源、原活動hash保持一致；最後runtime／package SHA與22-flow報告在output/reports/rocket-booster-repair.json及output/playwright/rocket-side-booster-lab/report.json。無權威schema／rubric／原活動變更；全庫／完整51-case owner／真手機／Moodle未驗。

修正commit dc4cb6fb53f33459fc930cdaf3849e2dc0a9d3e5；正式selection base 8e195c1115ae28b11f36454d376425106bd98033 → 該head，affected／單一rocket-side-booster-lab包／261 entries（258 Node＋三個owning browser group），記錄output/reports/rocket-booster-repair-selection.json；只代表選取，不代表261項已執行。

## 14. 取消分離收縮與桌面底部列（2026-11-06）

使用者再次回報先收縮再掉落，以及桌面全寬底部列佔位。上一節的助推器0.6秒尺度過渡及桌面底部跨欄配置由本節取代：有pair的跟隨近景從發射開始固定1m=.001單位，分離不再切換鏡頭距離／比例；主火箭與離體物在分離前後同尺度。全景保留原示意模型，核心下級原有分離過渡不變。兩枚左右推出、繼承速度及重力／阻力／接地沿用上一修正。

桌面取消workspace底部跨欄，操作列回到右側controls-pane頂部；手機仍為一行44px動作及獨立倍率位置，不新增大列。仍附著助推器時隱藏暫不可用的核心分離掣，先讓玩家處理側推器。

既有boosterRepair增驗分離前、分離後與多個啟動中的animation frame，主體scale／兩枚scale均不變，鏡頭差值低於1e-9場景單位且作答狀態不變；保留推出／旋轉／>8秒／接地測試。compactDeck改回桌面右側上方的幾何驗收，保留手機可達及單行檢查。物理／schema／rubric／manifest依賴不改，只本活動視覺、控制顯示及回歸。

已更新原私人Sites網址，權限不變。Site來源commit c46280e6fa31176e815f6765d8bb9901e5e81b62，deployment appgdep_6aecaf8c6f8881918d293c735e693f37，native succeeded（2026-11-06 00:32:21 UTC+08），version appgprj_6aeca66555b481919803e437687c4fa8~appgver_e115e3063c08819195fdf9d5a46657f0；output/reports/rocket-booster-repair-sites.json保存來源與package hash。網址交Codex panel開啟，未冒稱線上手動操作／真機驗收。

本輪實測：來源＋解壓SCORM共22 flows、errors=[]；其中8組noShrink（4尺寸×source/package）驗固定主體／助推器尺度及鏡頭穩定，另保留14個compactDeck觸控／分級流程。新活動8組Node＋browser audit、check／check:tests、文件連結與diff檢查通過；桌面分離前後截圖目視。最新package／runtime hash及原版隔離核對為output/reports/rocket-booster-no-shrink.json；未跑全庫／完整51case或真手機／Moodle。

本修正commit 63440b8c295d30d5550ea467d3f547e573b9df24；正式selection base b9f9ae3999b0eeb595c3f166f3e018dd4e513d6a → 該head，affected／單一rocket-side-booster-lab包／261 entries，output/reports/rocket-booster-no-shrink-selection.json；不等於全套執行。Site來源commit 9cebf5504b0c42b6bd27500afde7282d215f9bd2，native部署appgdep_6aecb2844420819197a22f4ed9db4b40於2026-11-06 00:45:03 UTC+08確認succeeded，保留原私人網址／權限。來源及package hash記錄output/reports/rocket-booster-no-shrink-sites.json；已交帶v=63440b8的網址給Codex panel以載入新版，未宣稱真機／線上手動驗收。

## 15. 引擎卡片文案簡化（2026-11-06）

按使用者要求，三款核心引擎卡片只顯示推力及乾重：大推力600 kN／500 kg、高效率80 kN／150 kg、均衡250 kN／250 kg，移除比衝及用途短句。只改本活動index.html文案，不改參數、物理、存檔或舊活動。重建SCORM並逐檔核對來源，三組文字對照parts元資料；本輪不重跑browser流程。

## 16. 助推器連桿接合修正（2026-11-06）

使用者截圖指出下方桿懸空。根因：桿固定在y=1.6m，位於核心引擎而非從y=2m開始的燃料箱；長度亦只剛到箱身半徑。只改新活動buildRocket的兩側支架：上下桿依下級第一個燃料箱的上下環帶定位（距端0.2m），上桿不高於助推器圓筒，橫桿稍微嵌入兩側外殼以免透視角度出現縫隙。沿用原mesh／材質／掛點及分離時整對拆出，不改推力、質量、schema或評分。

驗收在既有browser owner新增brace case，覆蓋三種引擎、三種首箱及混箱順序，測實際幾何bounds與箱身／助推器重疊，並目視桌面與手機、source及解壓SCORM。保留分離續做，更新原私人Sites，舊活動不改。

本輪實測：18種幾何組合在source及extracted SCORM均通過，桌面1280×800／手機390×844組裝＋分離共4 flows、errors=[]。正面放大截圖目視，上下桿接到首箱上下環帶；分離後每枚保留兩根桿。art Node、browser audit（52 cases保留原49）、check／check:tests及diff通過。最新artifact hash與原版不變核對見output/reports/rocket-booster-brace.json；未跑全庫／完整owner／真機Moodle。

實作commit 6d9c1f429a7b116796a1d4bf53f1b47982cbd1b7；committed selection base e1ac7c4b261ae983e6f4696475ef571b123c9c4a → 該head，affected／單一rocket-side-booster-lab包／261 entries，output/reports/rocket-booster-brace-selection.json（非全套實跑）。原私人Sites已更新，Site來源10b96327d06bad24a46f65f124ce70d5ae9c0d52；deployment appgdep_6aed8a0ec81081919c696729e2e6c4f7在2026-11-06 16:04:37 UTC+08 native succeeded，output/reports/rocket-booster-brace-sites.json保存發布紀錄，未宣稱線上手動／真機驗收。

## 17. 兩對助推器與帶火分離（2026-11-06，實作前決定）

本節取代早期「最多一對、燃盡才可分離」限制。保留所有核心零件、評分10／15／45／30與70合格、原活動及私人Sites權限。

- 每次加入一對，最多兩對（craft.boosters=2或4）；兩對沿下級的左右／前後四方向排列，底部高度一致，任何上級都沒有助推器。選取已裝助推器取下時移除整組；飛行中一次分離全部，禁止在發射台及結束後分離。主火箭位置、速度、油門及播放狀態不因分離跳變。
- 附著時每枚沿用120 kN、3000 kg燃料、300 kg乾重、250 s比衝；總推力、質量、阻力及耗油依實際枚數計算。燃料表顯示一對／兩對，共用百分比（同時點燃且相同規格）。
- ready／burning／spent／jettisoned狀態保留；飛行中的burning與spent均可分離。jettisoned.fuel保存分離當刻的每枚剩餘燃料，只作釋放條件，不再算入主火箭。核心關機且沒有附著燃燒助推器即可計關機，離體引擎不影響評分。
- 離體物件繼承火箭的慣性速度，在各自徑向得到2 m/s向外的分離衝量；對稱推出的總橫向動量為零，軸向速度完全繼承，不額外向下推。每枚獨立三維積分位置、速度、剩餘燃料；固定推力沿自身向外張開的軸向施加，質量隨燃燒下降，重力為中心引力，阻力依空氣密度及速度計算。燃料事件精確截步，歸零才熄火。張開角使用簡化的阻尼轉動（初始角速度0.35 rad/s、1.5 s衰減時間），不宣稱完整六自由度Soyuz力矩模型。
- 視覺姿態與推力方向使用同一轉角；四枚向四方向張開，火焰隨燃料顯示，無強制向下的動畫。保留從發射開始的真實近景尺度及緊湊右側頂部操作列。離體位置屬暫態畫面，重載不重播；權威存檔保留主火箭及釋放時燃料，分離後續作／check／提交均合法。
- schema6／model4沿用compact tuple形狀，擴充枚數及帶燃料的jettisoned。schema5／model3須先按原限制驗證；可編輯draft轉6，舊review／pending保留原schema及canonical bytes。schema2–4策略不變。所有信任邊界仍嚴格驗證、上限4000 bytes，不新增runtime依賴。

必要覆蓋：0／2／4枚、三引擎與三箱、第二對加入／第三對拒絕／全部取下、上級禁止側掛；兩對推力／濕重／乾重／阻力，提早／燃盡分離、主體速度連續、附著與離體各自耗油／燃料歸零，真空加速與能量方向、四向對稱及接地一次、暫停無變化／無收縮；新狀態draft與review round-trip＋合法續做，schema5 draft migration及已提交canonical不變、非法枚數／燃料／狀態拒絕；既有無助推器100分航線與新配搭100分航線保持。

沿用expansion.test.js及browser owner的expandedParts／boosterRepair／braceMount，更新原「提早分離拒絕」斷言。source及解壓SCORM在桌面與手機模擬驗裝配、兩對帶火／燃盡分離、四向姿態／火焰／尺度與緊湊控制列；執行Node、registry、靜態檢查及正式套件來源閉包，commit後記錄selection。真手機／Moodle未執行不得聲稱通過。

效能校正：四枚分離的首輪畫面超過原100 draw-call預算。沿用既有instances helper，將每枚兩根相同支架合為一次繪製，保留兩根的幾何與獨立離體物件；browser明確斷言帶火分離仍在100 calls／100000 triangles內，並檢查各支架instance的實際接合。

本輪驗證：活動八組Node與browser inventory audit通過；新增兩對ready／burning／spent／帶燃料jettisoned與check round-trip及合法續作、舊schema5 draft升級／review canonical／pending retry維持。無助推器原100分航線保留；一對366.75 s及兩對344.75 s新配搭實際達100分。check及check:tests（303 entries）通過，最後支架改用instances後重跑art Node及syntax檢查。

最後runtime的來源＋解壓SCORM共34 flows：帶火分離8（桌面原生滑鼠／手機trusted touch，0.25／1／2秒姿態與推力方向、加速、耗油及熄火、提交）、燃盡分離／緊湊控制／支架26（四尺寸分離、七尺寸controls、36種支架組合每target）。四枚同步推出／尺度及鏡頭無收縮、各自接地且剛好4次impact、暫停不改作答均通過；errors=[]。帶火分離最高99 calls／73337 triangles。手機與桌面的四向張開截圖已目視。

來源／套件依賴閉包逐byte核對，正式ZIP保留output/packages/rocket-side-booster-lab-scorm.zip。最終hash、來源commit及481個原版檔案不變的核對保留在output/reports/rocket-four-boosters.json；兩份browser報告為rocket-four-boosters-early-browser.json／rocket-four-boosters-repair-browser.json。僅本活動變更；未跑全庫／package:all／完整52-case owner／真手機／真Moodle，不能視為Moodle-ready。

實作commit e9c637e58e7ada582c61f5f2c040d51cd4b41e7c；正式committed selection base 7d4607aba021ced4442343d2ad064b01dbcb8965 → 該head為affected／單一rocket-side-booster-lab包／261 entries，output/reports/rocket-four-boosters-selection.json僅是選取證據，非全套實跑。最終runtime 5dc46844aee15070aafbf1ec2fbb2b9f58ff553f5c732d2d6d8d5cc7727d6ef4，ZIP SHA256 d5a604c3aa0e371a43290641701db5db14cce3a483da7982dbaddd3daa1c3d5d，475 entries。

原私人Sites已更新，權限不變，網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。Site來源commit 6da857d4dd3421db8fdaee7b5425449b9ba63ddf；deployment appgdep_6aed9b323aec8191a5fdb191681229b5於2026-11-06 17:17:46 UTC+08 native succeeded，發布證據保留output/reports/rocket-four-boosters-sites.json。預覽panel已排隊開啟，未宣稱線上手動／真手機／Moodle驗收。

## 18. 火箭聲音實施決定（2026-11-06，實作前）

使用者已要求實施上一輪聲音設計。只改新實驗版，沿用原私人Sites。第一版使用本地原生Web Audio合成音效：裝配接合、點火、主引擎與油門／關機、獨立固體燃燒、核心／全組助推器分離、距離衰減與左右聲像、風聲及撞地；不加入背景音樂或語音倒數。

聲音不屬答案；schema6／model4、評分、SCORM lifecycle及舊pending canonical完全不改。預設靜音與30%音量，偏好僅在當頁記憶體，不寫localStorage或suspend_data。使用者點按後才建立／resume AudioContext；不支援或播放失敗只影響音效，仍可飛行及提交。單一44px圖示放現有header工具區，點開浮層調音量／靜音；保留窄屏標題、fullscreen及44px導航，不擴大控制面板。

聲音採機載聽感：主引擎音量與濾波跟主油門平滑變化，固體音量跟實際附著枚數、固定燃燒狀態而不跟主油門；機體低鳴可在真空保留，風聲與離體引擎外部聲隨大氣變稀而消失。帶火離體音讀現有四枚coast物理狀態，仍有燃料就保持推進聲，距離漸弱及按畫面左右定位，燃盡／接地才停。一次分離播放一個機械聲，各次接地只觸發一次，總混音限幅。

音調與播放速度使用真實時鐘，倍速只更新飛行狀態，不能把引擎升成尖叫；連續聲源數固定，短音效數有限且播完斷開。暫停、背景、check／review／pending、renderer故障時淡出並暫停audio context；主體撞地允許短撞擊尾聲，背景仍立即淡出。恢復／開聲先同步當前狀態，不重播過往點火、分離及撞擊。

修改範圍：audio.js（純mix與有限Web Audio圖）、main.js事件／render／frame及既有離體位置讀取、index.html／styles.css小音量控制、manifest新增本地runtime；audio.test.js登記至registry，既有browser owner新增soundEffects歸flight並更新完整inventory audit。測純mix的0／2／4枚與油門、距離／聲像／稀薄空氣、無副作用；mock context的懶載入、獨立gain、限幅、一次事件、暫停／失敗降級與源數回收。Browser在source＋extracted SCORM以桌面滑鼠／手機trusted touch驗開聲、音量／mute、倍速音調、獨立固體、帶火分離／耗盡、暫停／背景／成果、readonly resume與沒有作答變更，並用實際Web Audio渲染驗非零訊號及峰值。再跑活動Node、check／check:tests、manifest閉包及原版hash；commit後保留selection，部署成功才記錄。真手機／真Moodle／喇叭聆聽品質未驗不得聲稱通過。

本輪實測：九組活動Node（新增audio.test.js）與browser inventory audit通過，完整owner保留原49＋既有3＋soundEffects共53 cases；check／check:tests通過（304 entries）。最後音源去相關相位修正後重跑audio Node、source＋extracted SCORM的sound-only；4條完整流程採桌面1280×800原生滑鼠及手機390×844 trusted touch，另每個target執行320×500／390×844／844×390／768×1024／1280×800／1920×1080六種header幾何，44px控制、音量浮層、無重疊及無root溢出。

實際AudioContext點按開聲、原生音量輸入不改作答、六次裝配接合／一次點火／一次四枚分離、主油門0下固體續聲、5× playbackRate仍1、帶火離體距離與左右聲像／燃料耗盡熄聲、暫停70ms後context suspend與短聲源回收、原生分頁背景（四flow nativeHidden=true）、mute／重新開聲不重播、check／submitted review靜音與重載保持唯讀皆通過。8次OfflineAudioContext真實訊號渲染（主體／分離各四次）在100%音量RMS非零，最高峰值約0.372；分離左右相關係數約0.50–0.54，確認獨立聲場。errors=[]，手機音量掣及主畫面截圖已目視；未作真手機／真Moodle／喇叭聆聽校準，亦未跑全庫或完整53-case owner。

原版481個受保護檔案hash不變。正式套件保留output/packages/rocket-side-booster-lab-scorm.zip，476 entries，音效只有新增本地audio.js依賴；來源／manifest／解壓套件逐byte一致。最終runtime與ZIP hash、commit及核對見output/reports/rocket-audio.json；完整browser證據為output/reports/rocket-audio-browser.json。

實作commit 9a6603edf50cc1c3f91069247a4dbc97c83be979；正式committed selection base c4a73bccd4367b222ba597ee5a95099d9ef87b45 → 該head，因registry新增測試而為full／all packages／304 entries。output/reports/rocket-audio-selection.json僅是選取證據，非全庫實跑。最終runtime d798ba2e11bb44e34f742882a9be4daaf43e4b3f676a185171b19d5915fc14dd；476-entry ZIP SHA256 51c3794388c0f8a4b965e06283fce6463a14025b5a10740fbe42180426bbdb4b。

原私人Sites音效版發布成功，Site來源413a6fce6259f6c0e64b15f23859c4c675cf053d，deployment appgdep_6aedd399c5088191b17232ac95ebf898於2026-11-06 21:18:24 UTC+08 native succeeded；網址及權限不變。發布證據在output/reports/rocket-audio-sites.json，預覽panel已排隊開啟。未宣稱線上手動／真手機／Moodle音效驗收。

## 19. 限定本模擬的獨立審查及跟進（2026-11-06）

使用者要求一個sub-agent，只審查本火箭實驗版並由主agent跟進。審查假設是一位學習者在單一瀏覽器內操作靜態形成性活動；不擴至其他模擬，不回寫原版，已標示的模型簡化不當作缺陷。主agent先跑九組Node及browser audit為基線，全部通過，再獨立重現新問題；sub-agent只讀審查。

已確認起飛bug：高效率引擎＋四個小箱（150 kg太空艙），同樣燃燒10s，以1/60s逐幀推進仍在pad、高度／速度零；1/30s與0.1s則高112.8335 m、v23.2155 m/s，耗油一樣。原因是step把每幀小於1 mm的正向位移也視為壓在發射台，清零全部速度。修正只在積分結果真正不高於發射台時維持pad接觸；保留推重比不足時燃燒但不離台，加入60／30fps及粗步結果一致的反例測試。現有snapshot形狀、schema6／model4、質量／推力參數及評分不變，舊record／pending canonical不重算；修正影響可編輯飛行的後續積分，不回寫既有成果。

Sub-agent亦重現音效P2時序bug：AudioContext.resume尚未完成時，使用者點火後關主引擎；stop保留running=true，舊wake callback只查running/live，因此仍播ignite。採最小事件序號取消：新點火捕捉自身序號，關音效／非live／暫停／無有效點火時使序號失效，resume完成後必須仍是該次有效事件。不能用flight object identity，因正常改油門會clone flight。補deferred resume→stop、→workshop→新點火只播新一次；不改任何飛行／評分／存檔資料。

回歸決定：在既有browser owner新增launchPadFrames（flight，完整inventory54 cases），以實際Controller.tick的60／30fps／粗步各推進10秒、草稿round-trip及HUD核對；soundEffects加入原生滑鼠／觸控下延後resume→關機→完成resume不得播舊ignite，再點火只播一次。review-only執行兩者及既有lifecycle，source與解壓SCORM均需通過；Node的stop及跨試飛取消亦保留。registry入口不新增，仍304 entries。

獨立審查完成：sub-agent只讀確認以上P1起飛、P2延遲點火兩項，並覆核兩個patch；另外執行model／audio／persistence／lifecycle四組及7,195個合法狀態validate→encode→decode深比較，回報全部通過且沒有診斷檔需清理。未找到其他有具體反例的高影響問題；未把已標示的簡化模型、寫法喜好或未確認的效能疑慮列為缺陷。

Parent實際把兩個反例先加測試，舊碼分別失敗pad!=flying／ignite 1!=0，修後九組Node、browser audit（54 cases保留原49）及check／check:tests（304 entries）通過。review-only在來源＋解壓SCORM共8條完整流程：兩個target各有60／30fps／粗步Controller.tick＋draft round-trip、桌面滑鼠／手機trusted touch音效及延後resume取消、既有lifecycle（100／0分、review、pending／finish retry、standalone fresh、renderer恢復）。errors=[]；低推力手機畫面已目視112.8 m／23.2 m/s。完整browser證據output/reports/rocket-review-browser.json；審查與來源／套件hash記錄output/reports/rocket-review.json。未跑全庫／完整54-case owner／真手機／真Moodle／喇叭聆聽校準，不能當作完整裝置或Moodle-ready驗收。

修正commit 1e9c51a14919e3a0bdbd61b220175e9fe236e618；正式committed selection base 3e410ad33f4eb934da44f54ba1dd4850d29903a3 → 該head為affected／單一rocket-side-booster-lab包／262 entries，output/reports/rocket-review-selection.json僅是選取而非全套實跑。最終runtime 1733c3d4137fe97faffab1f58e2449da702d6e0960e7c0822d8c0e91ce4aedc9；476-entry ZIP SHA256 d967d2f3670ebbe112b76ed10a4aac938855dab1b57d0868fb53470916322a1e，481個原版檔案不變。

審查修正版已發布原私人Sites，權限不變。Site來源9e5cb20a04620cb51859d4a97c20679a3b489872；deployment appgdep_6aeddbf80e188191aa227d65e51d3b19於2026-11-06 21:54:07 UTC+08 native succeeded。發布證據output/reports/rocket-review-sites.json，預覽panel已排隊開啟；未宣稱真機／線上手動或Moodle驗收。

## 20. 太空靜音與入軌配樂（2026-11-06，實作前決定）

使用者明確要求按上一輪設計實施、commit並更新原私人Sites。此節取代第18節的真空仍保留機體轟鳴設定：飛行連續音與點火／關機／分離等實體短音，80–100 km按平滑高度曲線收細；海拔>=100 km為零。工廠接合聲仍保留；物理、火焰、scoring及所有權威snapshot保持schema6／model4不變，舊活動不改。

配樂採本地原創合成，沒有外部音檔、版權素材或新依賴：緩慢空靈和弦、少量泛音與短延遲空間感。兩組四音聲源輪流作長交叉淡入，每18個真實秒換和弦；固定最多8個音樂oscillator，首次需要時才建立並重用，不按幀新增聲源。混入現有壓縮／限幅／總音量。現有7個飛行聲源與已修復的過期點火取消機制保留。

入軌條件沿用O.safe：飛行中、近地點>=150 km、主引擎關閉且無附著燃燒固體，連續3個真實秒後確認。高度／候選判斷可在靜音時追蹤，音樂必須全域開聲且「太空音樂」已開才發聲。確認後初次6–8秒淡入，重新點火只把配樂壓至25%，關機回復，不重播；軌道仍bound且高度>=100 km可繼續，跌回100 km以下／逃逸／撞毀則約2秒淡出，低空飛行聲隨高度恢復。新試飛重置配樂；暫停／背景／check／review／pending沿用快速淡出與context suspend，保留樂段位置供同一次飛行繼續，未確認的3秒候選計時暫停即取消。倍速不改音樂節奏／音調。

現有音量浮層只加44px「太空音樂：開／關」切換；預設開（但全域仍預設靜音），總音量／靜音一併控制所有聲音。音樂偏好及音樂播放狀態只存當頁記憶體，不寫LMS或localStorage。修改audio.js／audio.test.js、main.js、index.html及必要局部styles，沿用manifest依賴；browser owner新增spaceMusic歸flight，inventory audit更新55 cases，無新test入口，registry仍304 entries。

必要驗證：79／80／90／99.9／100／120 km連續聲與短音靜音、再入恢復；直上越100 km不當成入軌，安全軌道關機3秒真實時間確認、倍速無影響、點火壓低／關機回復不重設、退出／新試飛／暫停／mute／背景／review的取消或保留；音樂開關及有限聲源、答案完全不變。Node使用可控真實時鐘，browser以實際Web Audio渲染比對高空靜音與入軌配樂非零訊號、限幅／立體聲，source及解壓SCORM皆測桌面與手機trusted touch。跑九組活動Node、browser audit、check／check:tests、manifest逐byte閉包及原版hash。保留正式ZIP／報告、commit selection，成功發布才記錄；真機／Moodle／喇叭聆聽校準未做不得聲稱通過。

本輪實測：九組Node、browser audit（55 cases保留既有54）、check／check:tests（304 entries）通過。space-music-only在source及extracted SCORM共10 flows：4條新spaceMusic（桌面原生滑鼠／手機trusted touch）、4條既有音效（含延後resume取消及背景）、2條完整lifecycle。實測安全軌道持續3秒後入樂、1000×不改音樂時間／音調、點火壓低與關機恢復、check／返回／暫停保持樂段、音樂獨立開關不改答案、再入／新試飛重置、成果仍100分及review靜音。

16次新OfflineAudioContext渲染（80／90／100km／安全軌道各4次）中100km RMS精確0，90km比80km更輕，配樂RMS約0.0475、峰值約0.127（100%音量），低於同測試80km主引擎RMS約0.086–0.088，且固定8個音樂oscillators不累增；延遲與柔和和弦皆為原創本地合成。手機音量浮層／太空音樂開關截圖已目視；context suspend以實際完成狀態等待，避免把非同步暫停誤判為固定150ms已完成。

原版481個檔案hash不變；runtime／manifest／正式476-entry ZIP逐byte閉包核對，套件output/packages/rocket-side-booster-lab-scorm.zip。最後來源commit、hash與證據分別output/reports/rocket-space-music.json及rocket-space-music-browser.json。未跑全庫／完整55-case owner／真手機／真Moodle／實際喇叭試聽校準，不能當成完整裝置驗收。

實作commit c9f505b319822ab94a040e62a3ec9ad70334c976；正式committed selection base 89db367792bc1f125edfa189ab9d3acf283e2350 → 該head為affected／單一rocket-side-booster-lab包／262 entries，output/reports/rocket-space-music-selection.json僅選取而非全套實跑。最終runtime b30ab72d9ecf820412f85f8366f74623f13b61548618e6177eaeeadeabd09eb6；476-entry ZIP SHA256 6eccc81b296eedd7d0c3d1268b5ecd220a1761fcdd21574c34cf4acdb1059f0c。

太空配樂版發布原私人Sites成功，權限不變，Site來源06adacde28e167a2ab14cce1d3183b8397815244；deployment appgdep_6aeded3290d881919c43f58eff79b8bb於2026-11-06 23:07:39 UTC+08 native succeeded。發布證據output/reports/rocket-space-music-sites.json；預覽panel已排隊開啟，未宣稱線上手動／真機或Moodle驗收。

## 21. 高空地形正方形交界（2026-11-06，實作前）

使用者截圖在離地96.1 km、水平飛行時出現有直角的淺色地面。先用實際WebGL分層重現，檢查regional／global terrain的裁切、顏色與繪製次序；只修新實驗版的根因，不改原版資產、飛行物理、schema6／model4、作答或SCORM lifecycle，也不新增設定或依賴。所有createTerrain／createGlobalTerrain caller及既有地形回歸均納入範圍。

沿用terrainColorSeams browser owner，加入約96 km及離開發射場的邊界姿態，source與解壓SCORM各驗桌面／手機寬度、實際像素及原有繪製預算；必要時測日夜與不同細節級別。修後跑活動Node、browser inventory audit、check／check:tests、manifest逐byte閉包及481個原版hash，保留套件及證據。按既有授權commit並更新同一私人Sites，記錄實際發布結果；未做真機／Moodle不得聲稱通過。

已分層重現：t=179.4 s、高96.1 km、theta=.01、向下跟隨鏡頭時出現相同淺色直線邊；隱藏clouds後邊界消失，隱藏global不消失。根因是clouds.renderOrder=-1，早於renderOrder=0的半透明regional外圈／漸淡內圈；雲已覆蓋不透明內圈，但外圈後畫覆蓋雲，露出地形方格。最終只把regional外圈renderOrder改為-2，讓所有地面早於雲(-1)，火焰／煙等前景特效(0)仍在雲之後；不透明內圈仍-3。維持原有深度測試／不寫深度，不更改地理／mesh／shader／資產。

terrainColorSeams新增20／96.1／300 km、quality0／2、桌面／手機的實際offscreen像素比對：同一組地球／global／regional／雲的一次render，對照先畫地面再單獨合成雲的參考。原碼在96.1 km像素最大誤差50、平均12.22／255，測試按預期失敗；低空雲尚未出現允許零覆蓋，高空必須有非零雲覆蓋以防空測。原有地形顏色日夜比較及100draw／100k triangles預算保留，55-case inventory不增入口。

最終實測：九組活動Node、browser inventory audit、check／check:tests（304 entries）通過。source及extracted SCORM各測1280×800／390×664的terrainColorSeams，新增24組像素比較（近景使用已分離上級），與明確最後畫雲的參考最大／平均誤差皆0；高空每組16,384個像素都有雲覆蓋。既有地面日夜顏色比較、繪製預算全部通過，桌面／手機96.1 km截圖目視已無方形邊界。另source＋package的cloudVisuals共4 flows驗1280×800／390×844、日／夜／terminator／horizon、暗面雲亮度及繪製預算，errors=[]。保留output/reports/rocket-cloud-seam-browser.json、rocket-cloud-visuals-browser.json及原碼失敗報告rocket-cloud-seam-before.json。481個原版hash不變；未跑全庫／完整55-case owner／真手機／Moodle。

實作commit b1bc9fb53a87f62ee74578b9e697dc90bb3d1551；committed selection base bfa5206c956770d222982b1015328f63de17a78c → 該head為affected／單一rocket-side-booster-lab包／262 entries，output/reports/rocket-cloud-seam-selection.json僅選取證據。476-entry正式ZIP逐byte符合manifest／來源／Site dist，runtime c381bbb17a1ab36e7ff50ef7623222691109825fce350386dce293c30230058c，ZIP SHA256 a213177063da2fc29f37d28f081efac52949d0d05b3d483b5fd358267f55eb85；詳output/reports/rocket-cloud-seam.json。

同一私人Sites發布成功，權限及網址不變：Site來源8bd37c1669345a770bf06789ead75156d906dcc5，deployment appgdep_6aedf31746348191a822624c8620ccf5於2026-11-06 23:32:48 UTC+08 native succeeded，網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。證據output/reports/rocket-cloud-seam-sites.json，未宣稱線上手動／真機或Moodle驗收。

## 22. 太空漂浮與深空軌道兩段配樂（2026-11-06，實作前）

使用者回報190×190 km沒有配樂，要求上太空已開始柔和音樂，穩定入軌再轉深邃、神秘、稍帶激動／不安的柔和音樂。已重現：O.circular(190000)、controls.lit=true而throttle=0，實際推力為0且O.safe=true，舊updateMusic仍拒絕開始orbitSince，4秒後musicReady仍false。這是已確認的觸發缺陷，不能斷言是使用者當時唯一原因；全域靜音／音樂開關／暫停仍須尊重。

修改僅限新實驗版audio.js、audio.test.js、main.js與現有音量浮層的短狀態文字、既有spaceMusic browser case。100 km以上實體飛行音效維持精確靜音；飛行中到達100 km即約6–8秒淡入「太空漂浮」，不要求bound／近地點安全／關機。安全軌道且實際M.thrust為0持續3個真實秒，交叉淡化成「深空軌道」；190×190 km、油門0及無燃料均可進入，不按lit旗標阻擋。重新點火不再把太空配樂壓到25%，因高空已無飛行聲遮蓋；安全軌道失效退回漂浮，低於100 km淡出。保留暫停／背景／review／mute、當頁記憶體與新試飛重置、時間倍率不改樂速的合約。

沿用原生Web Audio、兩組各四音、最多8個音樂oscillator：漂浮用較明亮開放和弦、較高音域；深空用低音及小調add9和弦、微量失諧及較暗濾波，換和弦更慢。兩段以長交叉淡化銜接，無突發巨響、外部音檔或新依賴；提高合成樂段增益使預設30%音量亦有可測訊號。全域仍預設關音、音樂開關預設開，音量浮層顯示靜音／等待100km／暫停／正在播放的樂段，避免「太空音樂：開」被誤認為已發聲。不新增常駐面板或更改飛行／schema6／model4／評分／SCORM狀態。

驗證：Node覆蓋未入軌／逃逸方向的100km高空、190km零油門、實際推力阻擋穩定確認、兩段切換與不累加聲源、真實計時、暫停／mute／背景／再入／新飛行。既有spaceMusic case在source＋extracted SCORM、桌面滑鼠＋手機trusted touch驗兩段、狀態／開關、1000×及review。OfflineAudioContext在預設30%及100%渲染兩段、淡入／交叉淡化，量RMS／峰值與音域差異；飛行音效靜音另行驗，不能再把100km的總音訊要求為零。九組Node、browser audit、check／check:tests、manifest閉包及原版481個hash不變後commit並更新原私人Sites。未做真手機／Moodle／實際喇叭聆聽，不宣稱音響校準。

最終實測：九組活動Node、browser inventory audit（沿用55 cases）、check／check:tests（304 entries）全部通過。space-music-only在source＋extracted SCORM共10 flows，4條配樂（桌面原生滑鼠／手機trusted touch）證實120 km未入軌即播放漂浮、190×190 km在lit=true／throttle=0下約3個真實秒轉深空、1000×保持樂速、重新點火不壓至25%、暫停／背景／mute／check／再入／新飛行正常。另4條既有音效及2條lifecycle含延遲resume取消、原生背景、成果100分與review靜音全部通過，errors=[]。

44次新增OfflineAudioContext渲染含預設30%／100%兩段樂、80／90／100km飛行效果及4次真正於6 s入安全軌道、9.25 s確認的24 s交叉淡化。100km只開飛行音效RMS精確0；30%漂浮／深空的穩態RMS約0.0323／0.0342、峰值0.0839／0.0909；100%峰值約0.280／0.303。漂浮首0.5 s RMS只有穩態約11%，確認柔和淡入；交接期間無斷聲、最大逐sample跳幅約0.00618，固定8個樂音oscillator。55Hz低音及131Hz基音投影明確區分兩種音域。桌面漂浮及手機190 km／0%油門、深空樂段狀態截圖已目視；完整證據output/reports/rocket-two-stage-music-browser.json。481個原版hash不變。未跑全庫／完整55-case owner／真手機／Moodle／喇叭聆聽校準。

實作commit 6df0a20d26eb25efb721920db037381326355e1d；committed selection base e44258195877d9383a5adfda201c24fa5ac379f9 → 該head為affected／單一rocket-side-booster-lab包／262 entries，output/reports/rocket-two-stage-music-selection.json僅選取證據。來源／browser／476-entry正式ZIP／Site dist逐byte核對一致；runtime 1e6096c44aaa696ef84c06989f8f0b695b42fa191c8730d813919d5823ee4ebd，ZIP SHA256 f6dbe0eb27ce0590576330b67e398e0af77c0fcdd8c466ddc99a169c35266912，詳output/reports/rocket-two-stage-music.json。

兩段配樂已發布原私人Sites，權限不變；Site來源55d1405040a90ef35ac4af024c4e03730754d83d，deployment appgdep_6aedf86683408191b91667671f732a2a於2026-11-06 23:55:26 UTC+08 native succeeded，網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。證據output/reports/rocket-two-stage-music-sites.json；未宣稱線上手動／真機／Moodle或喇叭聆聽驗收。
