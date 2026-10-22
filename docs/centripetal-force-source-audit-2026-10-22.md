# 向心力來源實驗室：第三位最終結案整合

日期：2026-10-22。最終共同基準：`7d246166630da7ce6b2c62a44bc42f7a6dd4be41`。

## 判定

**S1–S5 全部關閉。兩位 reviewer 第二輪各自完整覆核後，沒有提出新的未解決可重現問題；第三位核對報告、正式 diff 與測試產物後同意結案。**

這個判定限於已讀程式及已執行的本地驗證範圍。它不宣稱未知缺陷不存在，也不表示真實手機或 Moodle-ready。Root 可繼續既有交付流程；線上部署不在本結案證據內。

## 獨立性與基準

- 第一輪 A、B 各自審核整個活動，不是分工檢查不同部分；完成前沒有互看發現。第三位在兩報告完成後才整合出4個 runtime 問題及1個測試入口缺陷。
- 修正後兩位再次完整覆核六情景、操作／呈現、評分、保存、提交、手機布局、套件及最新使用者要求；各自聲明未讀對方第二輪報告。
- 第二輪起始基準 `8350a5dbcc24980fa5b6b725e8a00442385ff677`；最終基準 `7d24616` 只改 browser capture 斷言的3行 diff。第三位實際核對這段 diff：沒有 runtime 或 manifest 改動。
- 第三位結案時再次確認 HEAD 為最終基準，工作樹無正式未提交變動。未改 source／tests／plans、未 commit 或部署；本檔僅是 ignored 審核報告。

## 逐項結案

| 編號／來源 | 狀態 | 修正與關閉依據 |
|---|---|---|
| **S1 / A1：第二指接手取消的拖動** | **已關閉** | 把手只接受 primary 與主要按鈕，取消時釋放原拖動 capture。A 的獨立可信診斷及兩人的正式 suite 都驗證第二指落原點／箭尖、兩種放手次序不改答案；preview 收起、原 primary 立即釋放、全部放手後全無 capture，新單指仍可畫力。 |
| **S2 / A2：無拖動輕點／右鍵改答案** | **已關閉** | 真正移動達4 CSS px才更新／提交。可信偏位18px輕點維持270°／60；正式 suite另驗2px抖動及右鍵不變，正常拖動仍有效。門檻使用CSS座標，沒有改量化、吸附或評分。 |
| **S3 / A3+B2：選項重建失焦** | **已關閉** | render 依穩定key還原仍可見且可用的控件。A、B獨立方向鍵診斷都能連續選到sum-all／normal，焦點保持INPUT；正式兩路另驗concept、圓心按鈕／力卡／已畫力及Tab續行。沒有新增鍵盤說明。 |
| **S4 / B1：短參考力不可辨向** | **已關閉** | 參考箭最短32單位、移除編輯端點圓。最小張力／靜摩擦、左右鏡像、320／390／1280寬度在source及package通過幾何檢查；A、B均實際看圖確認方向。B獨立量測張力由約6.54×2.35px變成33.72×12.14px。結果頁及plan明示箭長不表示大小比例，不拿示意長度作合成，物理模型及評分不變。 |
| **S5 / B3：T0 standalone profiles未接通** | **已關閉** | routing只增加本活動，沿用9個既有standalone profiles。Root實跑9×2viewport=18cases全部通過；A、B讀取並各自核對15檔runtime digest與最終程式一致。未把這18cases誤稱hosted26profiles。 |

## Capture 測試分歧的處理紀錄

8350a5d 的新增測試曾要求「第二指落下時，兩個pointer都沒有capture」，因此失敗。A、B 的診斷一致：正在畫力的 primary 已釋放；被拒絕的 secondary 沒有建立 drag，答案未變，但瀏覽器仍給予它 implicit capture。

第三位讀取活動契約後裁定修正測試，不新增沒有使用者效果的 runtime 分支。契約要求取消／回滾「當前拖動」並釋放其capture，且明示既有touch-action:none手勢不保證中途成為native swipe；全放手後新手勢才重新決定owner。瀏覽器在touch pointerdown前建立implicit capture、在up／cancel後自動釋放，符合[Pointer Events §9.4–9.5](https://www.w3.org/TR/pointerevents3/#implicit-pointer-capture)。

最終7d24616立即驗被取消的primary，在兩指全部放開且事件派送完成後驗所有pointerId；保留完整答案不變、preview清理、兩種放手順序及下一次拖動測試。兩位各自重跑**正式、未改斷言的完整suite**成功。這個失敗已解釋和修正，沒有隱藏或當成「一開始全部通過」。中途略過inputAudit的診斷、殘留觸點造成的診斷失敗均不作為最終通過依據。

## 最終證據

### 兩位各自執行

- 7個活動Node測試：model、scene、notation、scoring、persistence、interaction、lifecycle，全部通過。
- check、test-registry（265 entries）、diff check通過。
- A、B各自完整source及重建／解壓SCORM browser：`completed=true`、`errors=[]`，source／package各14個報告entries。共同assetHash：`4beb5fb114e4fbcc2084bbca8d79f03b7ed552554cda5ceef8c2c22581a1ff5f`。
- 覆蓋六題物理與視覺、13次可信作圖100分、七viewport、空白／部分／錯力／提交唯讀、draft／pending／committed、standalone刷新、橋題等候、地球吸附／舊相位、透明LaTeX、單一preview、fullscreen及原縮放檢查。
- A及B另重跑各自第一輪的獨立診斷，未只依賴root新增測試。

### Root 執行、reviewer／第三位核對的手機宿主檢查

| 宿主／來源 | 範圍 | 最終結果 |
|---|---|---|
| T0 standalone | initial、case-0至5、check、submitted共9profiles；320×500及390×844 | 18cases；completed=true、status=passed、errors=0、gesture issues=0 |
| T3 source | direct-drawing、case-0-partial；320×500 | 2cases；同上全部通過 |
| T2 解壓package | direct-drawing、case-0-partial；390×844 | 2cases；同上全部通過 |

三報告15檔runtime digest均為 `3dd4afc3469542e6ba53ed18ffd2f6a4d04cd853758e828fba304c4abd8ad343`。T0的baseCommit仍記啟動測試時的93244e8、T3記8350a5d；不能只靠該欄位認定舊runtime。兩位已獨立重算檔名＋內容digest確認T0對應修正版；第三位核對三份報告digest一致，以及8350a5d→7d24616 runtime未變。不同runner的assetHash與runtime digest算法不同，不混稱同一雜湊。

第一輪T3／T2各26profiles屬原基準歷史證據，沒有冒稱本輪全矩陣重跑。

## 報告及產物位置

- 第一輪整合：`C:/Users/frens/Documents/Projects/simlab/output/audit-synthesis/report.md`
- A第二輪：`C:/Users/frens/.codex/worktrees/centripetal-force-source-lab-1447/simlab/output/audit-review-a/recheck/review-a-recheck.md`
- A最終browser：同上`recheck/browser-fixed/report.json`。
- B第二輪：`C:/Users/frens/Documents/Projects/simlab/output/audit-review-b/recheck/report.md`
- B最終browser：同上`recheck/browser-7d24616/report.json`。
- Root mobile：`C:/Users/frens/.codex/worktrees/centripetal-force-source-lab-1447/simlab/output/playwright/centripetal-source-audit-T0.json`，同目錄T2.json、T3.json。

第三位完整讀取兩份覆核報告，檢視正式修正diff、共同基準及乾淨狀態，讀取兩份最終browser與三份mobile報告的結果／範圍／digest。沒有重跑已由兩位獨立完成的相同測試。

## 未驗範圍與剩餘風險

沒有未解決的已證實finding。未驗真實手機、Safari／Firefox、真Moodle及跨來源真實player；沒有重跑T0–T3×source/package×所有viewport完整矩陣或全專案所有活動。200% page scale是模擬證據，不能外推所有實機縮放。

本輪未核對線上Site、未部署、未等待GitHub CI；交付需由root沿既有流程完成。**審核可結案，未知平台差異仍屬上述明列的未驗風險。**

## Root 交付補記

- 上文保留第三位的結案原文；以下是root完成的發佈證據，不冒稱reviewer檢查了線上環境。
- 同一owner-only Site已更新，十個活動runtime與覆核工作樹逐檔一致：source `f57dc3f54acd01e1274a47857152a540434323cb`，deployment `appgdep_6ad9fd4ba80c8191b6f41c47f7fd1c62` succeeded，分享範圍不變。
- [已更新的模擬](https://centripetal-force-source-lab.ieyp.chatgpt.site/centripetal-force-source-lab/)；15檔SCORM ZIP SHA-256：`1B19C591AE2C5466DF5AFC0CF0CE64D51D7B3036204270931E93CF1541DE5D3E`。
- Committed selection preview：base `93244e8` → head `7d24616`，full／packages all／265 entries。只記錄選擇預覽，不代表執行全專案265項；修正已推送，未等待GitHub CI。
