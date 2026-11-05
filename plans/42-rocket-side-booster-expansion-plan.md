# 火箭工廠實驗版：固體側助推器與新增零件實施計劃

狀態：**已實作並完成下方列出的本機驗證；完整裝置／Moodle閘門未完成。** 日期：2026-11-05。下方規格已用於本次版本，完整配搭仍未逐一實飛。

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
