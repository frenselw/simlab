# 手機滾動審查：main（2026-10-01）

本輪已建立基於 `main` 的獨立 worktree，並審查全目錄。**更正：平衡作圖及同類活動確實有空白舞台滾動問題；重心活動須分頁判斷，一維、二維正常，三維有問題。** 先前只測初始畫面及單層 iframe，不能代表使用者在 Moodle 內嵌播放器的體驗。

更新後，**10 個活動已發現具體手勢問題，2 個活動屬需要統一的舊版整頁捲動版面，其餘 7 個活動只在已執行的畫面／host 矩陣未見異常**。這不是 7 個活動的完整實機驗收。此文件保留 main 修復前的歷史審查證據。Runtime 修復及新版驗收另見[修復驗證記錄](mobile-scroll-repair-verification-2026-10-01.md)。

使用者已確認問題出現在 Moodle 內嵌播放器，而且不限於一個手機瀏覽器。使用者的實際回報列為問題證據，不以局部本機測試否定。

- 分支：`codex/mobile-scroll-audit`
- Worktree：`/Users/hangwong/.codex/worktrees/mobile-scroll-audit/simlab`
- 基準：本機 `main` 的 `0bb873c8d7eb53ae2714fd100f453f8666ba2a94`。
- 原 checkout 為 `codex/motion-composition-stroboscopic-plan`；本輪工作均在獨立 worktree 執行。
- 依據：[共用手機互動規則](../plans/00-shared-platform-and-style.md#mobile-interaction)、[手勢 ownership 契約](simulation-scorm-production-guide.md#selective-touch-gesture-ownership)。

## 審查方法與範圍

`main` 的 catalogue 與實際 `sim/*/index.html` 均有 19 個活動，全部納入。使用本機 Chrome `155.0.8059.27`，viewport `390 × 844`、`360 × 640`，嵌入高度 `500px`。外頁可上下捲動，測試起點遠離其邊界。

每個活動在開發原碼及重新打包、解壓後的 SCORM launch page，各執行六個手勢：空白舞台上掃／下掃、面板中段上掃／下掃、面板頂端向外掃、面板底端向外掃。首輪單層 iframe 矩陣共 456 筆手勢記錄。面板底部只剩按鈕時，補測可原生捲動的按鈕；首輪空白舞台落點檢查周圍 12px，並排除互動 target；這會避開覆蓋視覺空白的大型透明 target，構成首輪漏測。補測保留這種命中的資訊，按畫面可見物件判斷空白，直接掃動三維立體旁的透明旋轉區。

輸入使用 CDP `Input.dispatchTouchEvent`，記錄 `isTrusted` 及 `pointerType: touch`。程式化捲動只用於設置起點。觀察包含外頁／內頁位置、兩者 visual viewport、iframe bounds、面板 scrollTop、可捲動元素、可取得的 production state／表單／SCORM 草稿及每一步的捲動取樣。**判讀包括手指單向移動期間有否反向跳動，不能只看放手後的總位移。**

外頁沒有額外的 touch handler，也沒有協助鎖定面板的 `postMessage` bridge，避免測試 host 掩蓋活動本身的行為。

補測增加以下範圍，均記錄可信 touch 輸入、owner 與 non-owner 的捲動位置、viewport、iframe bounds 及 learner state：

- 全部 19 個活動的初始畫面，置於「可捲動外頁 → 固定且不可捲動的中介 iframe → 活動 iframe」的同 origin 巢狀播放器；viewport `390 × 844`，source 與 extracted SCORM 各六個手勢，共 228 筆。中介頁沒有額外手勢 handler 或橋接程式。
- 重心的一維、二維、三維分開由正式 tab 進入；兩個尺寸、source 與 extracted SCORM，各六個手勢，共 72 筆。三維測立體旁的視覺空白，而不是避開透明 orbit target。
- 重心三維的 WebGL 正常 renderer 及明確指定的 Canvas fallback，兩者均測視覺空白。
- 平衡作圖的診斷對照：只在 page preload 暫停 document 的 touch 轉送 listeners，不改 activity 檔案；source 與 extracted SCORM 的巢狀播放器六個手勢均恢復正確 owner。
- 單層 iframe 的快速 swipe 補測保留了放手後 20／100／400／1000ms 的取樣。不過正常對照活動同樣沒有明顯慣性，因此本輪不據此判定真實手機慣性好壞。

上述巢狀結構重現了使用者描述的無法滾動，尚未直接量度使用者實際 Moodle 的 DOM／scroll topology。以下「本輪未見異常」只指已測畫面與 host；不是全部題目、所有 phase、所有拖曳類型或完整手機驗收通過。真實 Moodle、實體手機、Safari／Android 個別瀏覽器、跨 origin 及完整 phase 矩陣仍需後續驗證。

## 全目錄結果

下列結果在原碼與解壓 SCORM 一致。

| 活動 | 分類 | 本輪觀察 |
|---|---|---|
| `kinematics-driving-challenge` | **確認異常** | 單層 iframe 單向掃動時外頁反向跳動；兩個尺寸、兩個方向均重現。巢狀播放器外頁完全不郁。面板自身及邊界正常。 |
| `force-orthogonal-decomposition` | **確認異常** | 與駕駛挑戰相同：單層出現座標回饋震盪，巢狀播放器外頁完全不郁。面板自身及邊界正常。 |
| `force-composition-construction-lab` | **確認異常** | 初始空白舞台有手動轉送與原生滾動競爭；合力作圖模式的左右邊緣會起筆，外頁不滾動。 |
| `static-kinetic-friction-investigation-lab` | **確認異常** | 初始空白舞台的外頁滾動會反向跳動；面板自身及邊界正常。 |
| `displacement-distance-map-journey` | **確認異常** | 空白地圖手勢捲動了兄弟控制面板，外頁不郁；面板頂／底向外掃亦會帶動外頁。 |
| `fbd-horizontal-block` | 舊版版面差異 | 控制面板沒有獨立捲動範圍；上掃空白舞台時，先捲動活動內頁，外頁保持原位。 |
| `plane-mirror-pencil-ray-diagram` | 舊版版面差異 | 同樣先捲動活動內頁，控制面板沒有獨立捲動範圍；空白 swipe 的取消操作另產生空白草稿寫入。 |
| `position-time-graph-motion-lab` | 已測畫面未見異常 | 空白舞台只捲動外頁；面板只捲動自身，邊界固定。單層及巢狀 iframe 均正常，與使用者的正常例子一致。 |
| `free-fall-stroboscopic-measurement-lab` | 已測畫面未見異常 | 空白舞台只捲動外頁；面板只捲動自身，邊界固定。單層及巢狀 iframe 均正常，與使用者的正常例子一致。 |
| `newtons-second-law-investigation-lab` | **確認異常：巢狀播放器** | 只轉送到不可捲動的直接 parent，並取消原生滾動；空白舞台上／下掃的外頁位移均為 0。 |
| `force-equilibrium-diagram-lab` | **確認異常** | 使用者在 Moodle 回報有問題；巢狀播放器已重現空白舞台上／下掃外頁位移均為 0。原單層測試漏掉此情境。 |
| `force-equilibrium-advanced-diagram-lab` | **確認異常：巢狀播放器** | 與基本平衡作圖使用相同的直接 parent 轉送路徑；空白舞台上／下掃的外頁位移均為 0。 |
| `newtons-third-law-reaction-force-lab` | **確認異常：巢狀播放器** | 相同的直接 parent 轉送問題；空白舞台上／下掃的外頁位移均為 0，面板自身及邊界正常。 |
| `kinematics-qualitative-graph-sketching` | 已測畫面未見異常 | 練習畫板外的非作圖區及面板正常，已補驗底部按鈕起始的邊界 swipe。 |
| `kinematics-quantitative-graph-builder` | 已測畫面未見異常 | 初始非拖曳圖面及面板矩陣正常。 |
| `centre-of-mass-investigation-lab` | **確認異常：三維** | 一維、二維的空白與面板矩陣正常；三維的透明 orbit target 覆蓋立體旁視覺空白，上／下掃外頁位移均為 0，卻改變觀察方向及保存草稿。 |
| `hookes-law-spring-investigation-lab` | 已測畫面未見異常 | 初始空白舞台及面板正常；原碼有 pointer 轉送與原生接手的混合路徑，後續應補驗其他 phase。 |
| `inertial-reference-frame-road-observer` | 已測畫面未見異常 | 外頁與面板 ownership 正常；內頁 scrollHeight 有額外高度，但本輪 touch 未令內頁移動。 |
| `linear-motion-velocity-lab` | 已測畫面未見異常 | 外頁與面板 ownership 正常；內頁 scrollHeight 有額外高度，但本輪 touch 未令內頁移動。 |

受力圖的[原活動計劃](../plans/01-fbd-horizontal-block-mvp.md#touch-gesture-ownership)明訂 document 捲動，實作與該歷史版面相符。兩個舊活動另列為版面統一工作，避免把自然流版面與反向震盪混成同一個 bug。若採用本次使用者描述的「面板獨立捲動、空白舞台讓外頁捲動」，兩者需要重新分類並改成 bounded split-panel。

## 共通原因與對照證據

### 1. iframe 的 clientY 回饋震盪

駕駛挑戰及正交分解保存 iframe 內的 `clientY`，再用相鄰事件的差值呼叫 `parent.scrollBy()`。外頁一捲動，iframe 位置亦改變；同一手指的下一個 `clientY` 因此包括 iframe 位移。這個位移被當成反向手指移動，再轉送回外頁。

例：390px 手機，手指持續向上移動 88px，駕駛挑戰的外頁相對位移取樣為：

```text
0 → 22 → 11 → 33 → 22 → 44 → 33 → 55 px
```

期間有三次反向移動，放手後仍得到正的總位移，因此只檢查 `after > before` 的測試會漏掉此問題。相同活動在對照實驗使用原生滾動後，取樣為：

```text
0 → 7 → 18 → 29 → 40 → 51 → 62 → 73 px
```

程式定位：`sim/kinematics-driving-challenge/main.js` 的 `stageTouchY` handlers（約 1409–1425 行），以及 `sim/force-orthogonal-decomposition/main.js` 的 `startStageHostTouch`／`moveStageHostTouch`（約 1693–1714 行）。座標定義可參考 [Touch.clientY](https://developer.mozilla.org/en-US/docs/Web/API/Touch/clientY) 及 [Touch.screenY](https://developer.mozilla.org/en-US/docs/Web/API/Touch/screenY)。

### 2. 手動轉送與原生捲動競爭

力的合成的 `bindHostForwarding()`（`main.js` 約 1834–1861 行）及摩擦力的 stage touch handlers／`hostSwipe()`（`main.js` 約 1634、1966 行）在被動 listener 裏手動捲動 parent。原生捲動亦接手同一手勢，並且手動路徑仍使用變動中的 `clientY`。兩者的每步取樣都有反向移動。

對上述四個活動，以 page preload **暫時略過舞台 host-forwarding touch listeners** 做診斷對照，沒有改寫活動檔案：原碼與解壓 SCORM 各四個活動、每個六個手勢，均消除反向跳動，其他捲動 owner 保持預期。這是原因與候選方案的證據，並非已完成 production 修正或所有拖曳／phase 的回歸驗收。

### 3. 地圖轉送給錯誤 owner

`sim/displacement-distance-map-journey/main.js` 約 1374–1431 行，把空白地圖的垂直手勢設為 `owner: "panel"`，直接改 `controlPanel.scrollTop`；CSS 的 `.journey-map` 使用 `pan-x pinch-zoom`，不讓垂直原生捲動接手。這正是「手指掃舞台，控制面板卻郁」的原因。面板本身欠缺邊界 containment，另有 scroll chaining。

### 4. 合力作圖模式沒有左右捲動帶

`sim/force-composition-construction-lab/styles.css:33` 的 `.stage.resultant-draw-ready { touch-action: none; }` 覆蓋整幅舞台；host forwarding 在未畫合力時亦退出。

額外測試用 production model 建立合法 H1 首尾相接草稿，經 `encodeDraft → decodeDraft` 驗證，再由正式 startup restore，按已解鎖的「開始畫合力」按鈕進入作圖。可信觸控從距左右邊緣各 16px 的位置掃動：外頁位移為 0，兩邊均建立了 `originKey: FREE` 的新合力。原碼及解壓 SCORM 均重現。

後續必須把中央 drawing surface 與左右可用捲動帶分開，量度實際寬度，再驗證兩邊均不開始筆劃。單改轉送座標不足以解決這個模式。

### 5. 直接 parent 不一定是可捲動的 host

基本／進階平衡作圖、牛頓第二定律及作用反作用四個活動，在 document 的 touchmove 中使用 `screenY` 差值呼叫 `window.parent.scrollBy()`，隨即設 `handled = true` 並 `preventDefault()`。穩定的座標只解決 iframe 位移回饋，沒有解決 scroll topology。

在單層 iframe，直接 parent 正是可捲動外頁，因此原測試有位移。在巢狀播放器，直接 parent 是 scroll range 為 0 的中介 iframe：`scrollBy()` 沒有效果，原生向外的滾動仍被取消，真正有捲動範圍的外頁收到 0 位移。

source 與 extracted SCORM 的四個活動，空白舞台上／下掃均重現外頁位移 0；panel 與 learner state 保持固定。相同 host 中，正常對照的位置—時間及自由落體活動，上掃外頁分別移動約 56px、65px。基本平衡作圖在診斷 preload 暫停 document touch 轉送後，上／下掃亦恢復原生外頁滾動，面板 ownership 保持正常。

程式定位：`sim/force-equilibrium-diagram-lab/main.js:305`、`sim/force-equilibrium-advanced-diagram-lab/main.js:310`、`sim/newtons-second-law-investigation-lab/main.js:378`、`sim/newtons-third-law-reaction-force-lab/main.js:152`。四者應列入同一批 host 手勢修正，不能因單層 iframe 的 `screenY` 取樣穩定而列為正常。

### 6. 重心三維的透明旋轉 target 過大

`sim/centre-of-mass-investigation-lab/styles.css:13` 的 `.orbit-target` 由舞台左／頂各 7% 開始，寬、高均為 86%，背景透明，繼承 `.direct-target` 的 `touch-action:none`。這個矩形包括立體以外的大片視覺空白；按在那裏會進入 `main.js:381` 的 `beginOrbit()`，而不會交給 host。

補測由正式「三維」tab 進入，落點距舞台左邊約 12%（390px 時 46.8px、360px 時 43.2px），在立體左邊的可見空白。手指上／下掃 70px，host 與 panel 位移均為 0，但 `part3.view`、觀察證據及 SCORM 草稿改變。兩個尺寸、source／extracted SCORM、WebGL／Canvas fallback 均重現。

同輪的一維、二維空白 swipe 分別正確帶動外頁，panel 中段及頂／底亦保持獨立。活動分類須寫明「三維有問題」，不能把初始一維通過當成三個部分都正常。後續修正應收窄旋轉 ownership 並讓立體旁的可見空白可捲動，保留立體旋轉、候選點及鍵盤操作。

## 後續修正順序與驗收

2026-10-01 已將具體工作、逐活動程式定位、phase/mode及host案例、執行批次與完成條件整理到[手機滾動修復計劃](../plans/mobile-scroll-repair-plan.md)。以下順序保留為本次審查結論；本段是修復前的工作排序。Runtime 現已按該計劃修復，最新結果見[修復驗證記錄](mobile-scroll-repair-verification-2026-10-01.md)。

1. 同批修正四個反向跳動活動，以及平衡基本／進階、牛頓第二定律、作用反作用的直接 parent 轉送路徑。本機 Chrome 已證實原生路徑可用；先移除多餘舞台轉送並保留拖曳 target 的 gesture ownership。如實際 player 需要 fallback，使用相對穩定的外頁／screen 座標、單一 owner、縮放一致性及明確的 origin 策略，不能混用原生與手動移動。
2. 同輪處理力的合成的中央作圖範圍與左右捲動帶，以及重心三維過大的透明旋轉區。
3. 修正地圖的 stage-to-panel forwarding 及面板頂／底邊界串流。
4. 另行安排受力圖／平面鏡的版面統一；先更新各自活動計劃的布局分類，不把它們視為四個轉送 bug 的同一個小改動。
5. 其餘 7 個已測畫面未見異常的活動保留為比較與回歸對照。全目錄仍須補齊 phase、作圖／拖曳 target、左右 strips、短 iframe、zoom、取消／鎖定狀態與實機 player 的矩陣；透明 target 必須對照可見物件，不能自動從空白 swipe 測試排除。

新增驗收必須在手勢途中逐步取樣。持續單向 swipe 不得有明顯反向外頁位移；面板每個取樣點均不得帶動 host；空白區及兩邊 scroll strips 不得開始作圖或改答案。保留 production guide 所需的 non-owner／viewport／iframe／state assertions，並在 source 及 extracted package 各執行。

## 本機證據與命令

證據保存在此 worktree 的 ignored `output/playwright/`，報告正文置於 `docs/` 供版本控制：

- `mobile-scroll-audit.js`：可重跑的診斷流程，使用專案現有 CDP／打包工具，不新增 runtime 依賴。
- `mobile-scroll-audit-source.json`、`mobile-scroll-audit-package.json`：合併補測後的完整 19 活動矩陣。
- `mobile-scroll-native-probe-source.json`、`mobile-scroll-native-probe-package.json`：四活動對照實驗。
- `mobile-scroll-resultant-source.json`、`mobile-scroll-resultant-package.json`：合力作圖模式左右邊緣的 production restore／可信觸控證據。
- `mobile-scroll-audit-summary.json`：首輪全目錄摘要及取樣；只保留歷史證據，當前分類以本報告及 followup summary 為準。
- `mobile-scroll-followup.js`、`mobile-scroll-followup-summary.json`：新增 host 拓撲、分頁及視覺空白診斷，並記錄更正後的全目錄分類。
- `mobile-scroll-nested-source.json`、`mobile-scroll-nested-package.json`：19 活動在巢狀播放器的完整矩陣。
- `mobile-scroll-centre-parts-source.json`、`mobile-scroll-centre-parts-package.json`：重心一維／二維／三維在兩個尺寸的矩陣。
- `mobile-scroll-centre-fallback-source.json`、`mobile-scroll-centre-fallback-package.json`：重心三維 Canvas fallback 補測。
- `mobile-scroll-nested-native-probe-source.json`、`mobile-scroll-nested-native-probe-package.json`：平衡作圖暫停 document 轉送的對照證據。
- `mobile-scroll-flick-source.json`：快速手勢及放手後取樣，不作實機慣性驗收依據。
- `mobile-scroll-centre-part3.png`：三維空白測試落點對照的畫面。
- `raw-mobile-scroll-*.json`：初次及補測原始記錄，保留落點修正前的實驗，不作最終分類依據。
- `output/<slug>-scorm.zip`：本輪實際建置的 19 份 SCORM。

從 worktree root 重跑（需有 `package.json` 所列開發依賴與 Chrome）：

```sh
node output/playwright/mobile-scroll-audit.js --mode=source
node output/playwright/mobile-scroll-audit.js --mode=package
node output/playwright/mobile-scroll-audit.js --native-probe --viewports=390x844 --slugs=kinematics-driving-challenge,force-orthogonal-decomposition,force-composition-construction-lab,static-kinetic-friction-investigation-lab
node output/playwright/mobile-scroll-audit.js --resultant-fixture --viewports=390x844 --slugs=force-composition-construction-lab
node output/playwright/mobile-scroll-followup.js --nested --viewports=390x844 --mode=source
node output/playwright/mobile-scroll-followup.js --nested --viewports=390x844 --mode=package
node output/playwright/mobile-scroll-followup.js --parts=1,2,3 --visual-blank --slugs=centre-of-mass-investigation-lab --mode=source
node output/playwright/mobile-scroll-followup.js --parts=1,2,3 --visual-blank --slugs=centre-of-mass-investigation-lab --mode=package
```

今輪透過 `NODE_PATH` 讀取原 checkout 已安裝的開發依賴；沒有安裝新的套件。此流程是審查工具，正常退出代表資料收集完成，issue flags 仍需判讀；不能把退出碼當作發佈通過。

已執行 `npm run check`、`node tools/mobile-touch-scroll.test.js`，兩者通過；19 個活動均成功打包並完成 extracted launch 測試。既有 static touch tests 通過，仍重現上述實際異常，故不能以這些檢查代替可信手勢取樣。`git diff --check` 在報告完成後另行核對。

本輪交付是全目錄審查、更正先前分類及修正方案。尚未完成 production runtime 修正、完整 `npm test`／release regression 或真實 Moodle／實機手機驗收。
