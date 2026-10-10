# AC 工作台獨立審核與修正（2026-10-11）

兩位 reviewer 各自完整審核現有AC工作台及兩個技術示例，沒有分拆範圍，初輪亦沒有互相交換發現。第三位 agent 在兩份完整報告完成後去重及核實，主 agent 按匯總修正，再交原兩位獨立複查。

初輪基準為 `ef83124`。修正及最終審核版本為 **`ba19ba5993f1d0996a498766eca2b38b499098f8`**；兩位 reviewer 均明確 **APPROVED，完整已審範圍無剩餘實據問題**。本報告及計劃的後續提交只保存紀錄，沒有再改runtime。

## 審核範圍

各 reviewer 都讀取專案規範、[AC計劃](../plans/32-circuit-ac-workbench.md)、[AC作者指引](circuit-ac-workbench.md)、[共用作者指引](circuit-activity-authoring.md)及[架構責任](circuit-workbench-architecture-review.md)，並審閱：

- 全部10個可選AC模組、教師入口及兩個技術示例、配置、固定模板codec與依賴。
- 時間求解、事件、能量、狀態驗證／原子restore／合法續作、量測窗口及有界波形歷史。
- C/L歸零、場線／電荷／磁極、連續發電機、理想／耦合變壓器共同磁通、電表、bar與數學符號。
- Scope探頭、量尺、工具還原、權限／只讀、preview隔離、卸載／多instance及共用DC邊界。
- 手機／fullscreen／手勢契約、預設圖像、打包與文件／測試有效性；外部驗收限制另列。

## 初輪發現與結案

| 項目 | 核實及修正 | 結案證據 |
|---|---|---|
| P2：Scope還原後首次新增無反應 | 還原的 `scope-1` 與序號衝突。`fresh()`改為跳過當前已用ID，保留原ID及原子驗證。 | 兩位各自重現前後差異；單個、多個及非數字ID還原後一次新增成功，非法重複ID拒絕且工具／physics不變；source／ZIP可信工具箱點擊通過。 |
| P2：互感預設接線遮住匝數比 | 上方回線y230穿過新caption，元件bounds亦重疊。只上移限流電阻至(510,140)及junction／回線至y210，不改模型、端子或拓撲。 | 既有全預設分離／有限接線／wire-body檢查及240次切換／restore續作通過；兩位獨立目視；source／ZIP的1280／320px實際SVG路徑均不穿caption。 |
| P2：作者配置接受不支援通道 | profile原本只檢查quantity枚舉。registry提供共用能力清單，AC元件宣告額外charge／energy／flux，profile與通道列舉同用。 | 交流源的charge／energy／flux全部編譯時拒絕；LC、兩種變壓器及發電機全部原可用通道接受；DC不新增AC observer依賴，共用權限／部分答案續作通過。 |
| P2：browser仍測舊能量／場線契約 | 能量selector混入數學label；inspector標籤已含字形；場線關閉還要求電荷消失。只修selector及過時期望，保留原物理斷言。 | 恰有兩個能量行／值0 J／meter0、反向尾值不閃回、原始能量仍>0及snapshot不變；關閉場線仍保留48個電荷、無場線、physics不變。 |
| P2：2 Hz燈泡測試基準受幀相位影響 | 規律60 Hz樣本可有最低亮度約0.10754、9個兩位小數階，與20 ms功率積分吻合。以實際接受時間逐幀核對解析功率及已批准共用亮度映射，替代任意最低值／階數門檻。 | source／ZIP逐幀功率誤差<0.015 W、亮度誤差<0.005；仍核對可見低頻亮暗、真實時間率、50 Hz穩定及電流卡固定寬度。沒有改產品算法或放寬求解器精度。 |
| P3：兩處現行文件落後 | 可選資產由6變10；燈光文案仍聲稱額定以上不截平。更新唯一依賴清單引用及共用飽和映射，保留歷史紀錄。 | 本地連結／錨點、資產及測試入口核對；兩位確認與實作一致。 |

## 實際驗證及成品

精準跟進沿用未改實作的初輪證據，沒有因小修正反覆跑全站。兩位初輪各自執行的transient、Scope、display／energy sync、field、generator、transformer、readout math、AC meter九個Node suites通過；`ac-platform`初輪因互感圖像中止，沒有把中止後段冒稱通過。

修正後主 agent及兩位 reviewer 各自核對完整 `ac-platform.test.js`、`scope.test.js`、共用 `activity-core.test.js`；前者包括此前中止的幾何／路徑及240次切換續作，後者19組權限／snapshot／check。主 agent另跑共用 `core.test.js`及syntax／manifest檢查，均通過。

主 agent執行的source／解壓ZIP專項如下；兩位覆核實際log、JSON、零runtime exceptions及提交版本，沒有將覆核當成自己重跑。

| 專項 | 通過數 | 本地證據 |
|---|---:|---|
| `--realtime-smoke` | 140 | `output/ac-review/fixed-realtime.log`、`fixed-realtime-evidence.json` |
| `--scope-smoke` | 206 | `output/ac-review/fixed-scope.log`、`fixed-scope-evidence.json` |
| `--reactive-art-smoke` | 276 | `output/ac-review/fixed-reactive-art.log`、`fixed-reactive-art-evidence.json` |
| 互感實際SVGcaption／導線／1280及320px版面 | 21 | `output/ac-review/fixed-layout.log`、`fixed-layout-evidence.json`及四張`fixed-*-mutual-*.png` |

圖像檢查的暫存runner曾遇導航等待及macOS `/var`／`/private/var`安全路徑問題，修正runner後上述source／ZIP四視窗全部通過；這些初次失敗不計作通過。本次沒有改生產server或套件路徑規則。

統一builder重建DC／AC工作台及兩個DC SCORM包，核對21個共用檔及10個AC檔指紋；兩位另核對AC ZIP38個資產與提交runtime。AC ZIP SHA-256為 `1e8758b6359547e4a9c2739f11f2d5a72dae2a0913531574dc7817807508a79d`，成品及指紋見 `output/circuit-platform-build.json`。它仍為standalone工具，沒有 `imsmanifest.xml`。

獨立原始／複查／匯總材料保存在本地 `output/ac-review/reviewer-1.md`、`reviewer-2.md`、`reviewer-1-followup.md`、`reviewer-2-followup.md`及`consolidated.md`；本文件保存可版本追蹤的結論。

## 結論與界限

三個產品／配置細節、兩類測試及兩處文件偏差均已關閉。兩位獨立reviewer確認修正提交及成品runtime，原完整AC審核範圍沒有剩餘實據問題。

本輪沒有重跑全站或完整AC browser／T0–T3手勢矩陣，既有未改部分的歷史證據仍按原日期解讀。真手機及真Moodle T4、未制定的正式AC評分活動依然未驗收／不在本次實作範圍；本地審核通過不代替這些外部gate，也不表示已部署新版ZIP到Moodle。
