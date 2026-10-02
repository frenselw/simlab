# 電路工作台：使用與核心介面

電路工作台是教師用的直流穩態工具。開啟 `sim/circuit-workbench/index.html` 即可使用，也可透過 Live Server。發布包由 `npm run package:circuit` 產生於 `output/circuit-workbench-standalone.zip`；解壓後保留 `circuit-workbench/` 與 `shared/` 的相對位置。

## 課堂操作

- 工具箱點選元件，拖動本體調整位置；按「取出導線」或畫布下方「＋導線」，先取出一條實際留在畫布上的線。預設共 10 條，取完後按鈕停用，刪線會歸還庫存。
- 兩端懸空時，拿任一端或線身都搬動整條線；把拿著的端點移到元件端子或其他線端，放手接好。接好一端後，拖自由端，已接的一端保持固定。
- 兩端接好後，拿線身彎曲。拿已接端點拉走即可拔開，亦可用畫布下方「拔開 A／B」。懸空或只接一端的線都可保留、儲存和計算。
- 每條線有最大路徑長度，包含彎曲弧長。預設 600 畫布單位，縮放不改變；拉盡時停止，不能吸附到過遠端子。教師設定可改庫存及新線長度，已取出的線維持自身上限。
- 幾條導線的端點可在空白位置共接成分支；共接不切線，也不消耗額外導線。只有共同端點 ID 導通，線身交叉不導通。拆開一條不會破壞其他線。
- 每次完整手勢算一步復原。Escape、觸控取消、次觸點、失去捕獲、失焦及視窗變更會取消本次未提交操作；原電路及讀值保持不變。
- 選元件可旋轉、複製、固定、刪除及修改參數。點開關直接開合；拖變阻器藍色滑塊直接改變阻值。
- 「探測」先點一個端子看電勢，再點另一端子量電勢差。在端子面板按「設為 0 V」改參考點。
- A 表串聯；V 表並聯。W 表的 I+/I− 串聯，V+/V− 跨接負載。可用「A／V／W 表接線」範例查看接法。
- 教學模式選「固定元件，只接線」；可另外開放旋轉、所有參數或某個元件的參數。這是教師操作規則。
- 「儲存」保存可再編輯的 JSON；「另存固定元件模板」只保留元件；SVG 匯出供講義／投影片使用。
- 復原／重做涵蓋清空、匯入及套用範例。重新整理開始新的示範，不會自動恢復先前文件。
- 手機初始收起面板，顯示完整電路；「＋導線」保持可用。「工具」可開關面板；選「手掌／拖畫布」後用一指移動整張畫布，再按一次返回拿取模式。「全圖」包含所有懸空線；導線端點在小倍率仍有 44 px 命中區；元件端子於拖線吸附／探測時開放，避免遮住本體。畫布下方可直接「放大所選」。兩側捲動帶留給播放器原生捲動。
- Tab 選導線端點，方向鍵搬動；面板的 A／B 接線對象選單及「接好」提供鍵盤替代。方向鍵亦可移動元件／共接點／變阻滑塊，R 旋轉，Delete 刪除，Escape 取消，Ctrl／⌘ Z 復原。

## 物理界限

理想導線為等電位。電源內阻與 A/W 電流線圈內阻可設 0；V 表／W 電壓線圈的輸入電阻欄位 **0 代表理想無限大**，其他正值才代表有限電阻。

正電流採端子 a → b 的被動符號，元件吸收功率為 UI。電源端口輸出、內阻損耗與總供能分開報告。W 表讀值為電壓線圈的電壓乘以電流線圈電流，保留反接符號；有限儀表電阻會影響電路，不能與非侵入式探測混淆。

熱效應燈是額定點校準的**教學近似**：冷態電阻取額定熱態的 1/10，環境／額定模型溫度為 293／2600 K，使用線性電阻溫度關係及四次方輻射散熱平衡。這些是本工具的明示模型常數，不是某種燈泡的實測材料擬合；沒有預熱、燒毀或光譜模型。

互不相連的電路各有自己的任意參考點。理想探測不能替浮接區定出跨區電壓。無解／未收斂讀值顯示 —；理想支路或導線環路電流不唯一時也顯示 —，不畫假方向。其他可解的獨立電路繼續顯示。電子動畫只示意金屬導線中的方向。

二極管、電容、電感、繼電器及瞬態仍屬後續階段；本版不聲稱已模擬充放電或磁場暫態。

## 模組邊界

- `component-registry.js`：端子、參數規格、預設值、直流支路模型與可選 SVG 呈現。
- `circuit-model.js`：結構及庫存／長度驗證、懸空端點引用、拿線／彎線／拔線／共接命令、策略及原子復原歷史。
- `circuit-solver.js`：MNA、非線性迭代、各獨立電路參考點、零空間識別、KCL 導線電流與診斷。
- `circuit-routing.js`：獨立幾何模組：順滑曲線、路徑弧長、有界變形與舊檔直角避障 A*。不依賴文件模型，讓驗證與編輯測量相同長度；顯示、命中、方向動畫及 SVG 匯出共用實際路徑，不決定電氣導通。
- `circuit-renderer.js`：實物／符號、數字／指針、讀值、電勢與方向。未完成操作不寫入電路文件。
- `circuit-document.js`：版本化 JSON 與模板匯出；先驗證後替換。匯入內容不能包含可執行模型。
- `main.js`：教師介面與可信輸入，所有命令在驗證後才提交。

電路文件 v3 包含 `kind/version/components/junctions/wires/cables/policy/display`。`cables: {count, length}` 是有限庫存及新線長度，各線另有 `length` 最大路徑長度，`shape: auto|free|smooth`、`via` 及兩個端點 ID。端點為 `componentId:portKey` 或 `junctionId:p`；懸空線端是單線使用的接點，多線使用同一接點才相連。新線與拖動後的線形保存實際採樣折線 `free`，SVG 圓角顯示；舊 `auto/smooth` 路線仍可讀取。`auto` 最多 24 個內部點，其他形狀最多 96 點。v1/v2 先嚴格驗證，再遷移為 v3，保留既有路線／拓撲並給有限長度；已超過 10 條的舊檔按實際數量保留庫存。檔案上限 256 KiB，元件／接點／導線上限為 80／600／240。JSON 匯入拒絕超庫存、超弧長、非法引用／數值及未知欄位。

`CircuitModel.addWire(doc,x,y)` 是互動取線命令；`moveWireEnd/attach/detach/bendWire` 保持有限長度與端點拓撲。`connect()` 供教師網表／預設構造，可明示既有較長路線，仍消耗庫存並保存有限上限；互動介面不能以點端子呼叫它。元件位置／方向更新後，以 `reconcile(doc,before)` 維持連接並檢查可達性，不能任意搬到短線達不到的位置。

## 工作台介面

載入頁面後使用 `window.CircuitWorkbench`：

| 方法 | 行為 |
|---|---|
| `getDocument()` | 回傳目前已提交電路的副本，沒有指標或拖動預覽 |
| `exportDocument()` | 驗證後回傳 JSON 文字 |
| `loadDocument(objectOrJson)` | 驗證全部內容、原子載入並重算；錯誤會拋出，原電路保留 |
| `getAnalysis()` | 電勢、元件、各支路、導線、參考點及診斷的副本 |
| `voltage(firstEndpoint, secondEndpoint)` | 兩點電壓；不能確定時回傳 null |
| `applyPolicy(partialPolicy)` | 取消暫態，設定 `mode/allowRotate/allowParams/allowSwitch` |
| `onChange(callback)` | 訂閱已提交變更；回傳取消訂閱函式 |
| `cancel()` | 取消本次未提交拖動，回復已提交狀態 |

計算 API 使用 `CircuitSolver.solve(validDocument)`。每個元件結果包含 `voltage/current/power/branches`；有模型支路時，`voltage/current` 對應第一支路，`power` 是各支路的吸收功率總和。儀表另有 `reading/unit`，電源另有 `delivered/internalPower/sourcePower`。各支路包含端子、電壓、電流與吸收功率；四端儀表的自身耗電包含兩線圈，與量測讀值分開。null 表示無可靠或唯一結果；不能當成 0。

## 擴充元件

以**可信的本地 JavaScript**呼叫 `CircuitRegistry.register(type, definition)`，提供唯一型別、名稱／圖示、任意數量端子、參數規格、`dc(component)`，以及可選的 `render(component, result, display)`。文件匯入只承認事先註冊的型別及合法參數。

`dc()` 回傳支路描述陣列，每項包含 `from/to/kind`：

- `branch`：理想或有串聯內阻的電壓約束，附 `resistance/emf`。
- `resistor`：有限電阻，附 `resistance`。
- `nonlinear`：附 `law(voltage, params)`，回傳 `current/conductance`，可另回傳工作電阻／溫度。

模型可讓不同子支路引用不同端子，因此不是把所有元件當成兩端電阻。測試已用一個新增的四端非線性雙負載證明，不改求解器或文件模組便可求解。新增時間狀態仍需設計版本遷移、初始化、步進及能量驗證；目前介面不能冒充時間引擎。

未來 SCORM 外層自行擁有題目、評分與小型權威快照，透過既有 `SimScorm/SimActivityFlow` 管理 attempt。教師完整文件不可直接當成 ≤4000 bytes 的 `suspend_data`，前端策略不能提供高風險評分的安全邊界。

## 驗證與發布

```sh
node sim/circuit-workbench/core.test.js
npm run test:browser:circuit
npm run package:circuit
```

瀏覽器 runner 使用專案既有 Chrome/CDP 工具，在原始頁面和 ZIP 解壓內容上執行。圖片及可信觸控樣本在 `output/playwright/circuit-workbench/`。完整結果與未驗證項目記錄在[活動計劃](../plans/28-circuit-workbench.md)；本地測試不代表真實手機或 Moodle 已驗收。
