# 小小航天家：火箭升空與返航

本計劃取代此slug先前SCORM活動及評核計劃。使用者明確要求改為純探索、兒童及學生可反覆遊玩，移除全部評分、提交、成果紀錄與Moodle流程。原rocket-space-mission-lab保持不變；原Site project／網址保留。

依共用設計plans/00-shared-platform-and-style.md與docs/simulation-scorm-production-guide.md的scope-and-shared-cores契約：本次是非評核workbench。風險／rubric／正式提交／答案snapshot／LMS resume／分數信任：全部N/A；不再建立attempt或SCORM套件。重新整理回空白工廠，沒有localStorage／LMS自動還原；不新增匯入匯出。保留物理、音效、鏡頭、助推器／分級／太空艙與返航、10°／10%與±1%油門、fullscreen。

## 產品與狀態

完整主題「小小航天家：火箭升空與返航」。單行約49px頂欄只放品牌／短副題、音效及fullscreen；刪除任務tabs與狀態列。控制區不再放評核目標，閉合飛行指南放下方，飛行設定不再重複標題；返航標題與動作同一行。手機320／390短屏及844橫屏均保留44px按鈕、獨立控制面板捲動與原手勢所有權。

只保留workshop→pad→ascent／coast→ended；variant固定0，模型只持有設計及當前flight，無records／check／schema／result。返回工廠可保留設計反覆試飛，清空設計只在工廠可用；頁面refresh fresh。Orbit提示僅描述物理及提供指引，不以分數或過關判定限制探索。Technical failure顯示載入／操作提示，不聲稱已保存或已提交。

## 範圍與依賴

替換ui-runtime為純記憶體play controller，main／index移除評核UI與分支；model移除評核phase/actions。移除本slug的scoring／persistence／legacy／lifecycle測試及SCORM manifest；shared scorm／activity-flow保留供其他活動但本工具不載入。assets.json成為唯一standalone執行檔宣告，tools/package-rocket-explorer.js產生standalone ZIP、無imsmanifest.xml。更新catalogue、Site標題與dist，不改原活動或其他workbench。

## 驗證決策

保留並遷移物理Node測試（發射、軌道、solid／staging、返航、熱防護、傘、撞地、聲音、互動／素材），刪除已失效評分／LMS codec測試，以workbench controller測試覆蓋新啟動／reset／pause／非法command及frame budget。Browser由SCORM attempt fixtures改為source與解壓standalone；檢查API存在也零讀寫、無評分提交DOM／scripts、refresh fresh、反覆試飛，手機緊湊頂欄及trusted touch／fullscreen／dial-fader、助推器／二級／太空艙轉向與分離、開傘平滑鏡頭及安全返航，保留WebGL錯誤／遺漏資產檢查。registry與selection-preview隨刪除的assessed owners更新，不假稱舊58 cases仍完整執行；與assets一致的ZIP／Site closure及原481檔hash驗證。真手機未驗證；真Moodle readiness對本工具N/A。

## 已執行驗證

- 8 個模擬 Node 測試檔及 standalone browser/package contract 共 9 項通過；registry／selection 另 2 項通過。`npm run check` 與 `npm run check:tests` 通過（301 entries：258 Node、43 browser；48 helpers、2 manual）。
- source 與解壓 standalone 各 14 個 browser flows，共 28 個通過：六種 viewport layout、trusted assembly、四 viewport 10°／10%／±1% controls、fullscreen popup、雙飛船控制／分離、完整再入及兩級降落傘返航、平滑開傘鏡頭和二級觸地。Runtime errors／HTTP 資產錯誤均為零。
- 最後標題置中及刪除舊計分說明後，額外重新跑 source／standalone 各六 viewport layout；API／Storage trap 零讀寫。純網頁 refresh fresh、保留設計重新試飛、無舊評核 DOM／scripts。
- 瀏覽器報告：`output/playwright/rocket-side-booster-lab/explorer-full-report.json`（完整流程）及 `explorer-report.json`（最後 layout）。Node／registry／layout console 在 `output/reports/rocket-explorer-*.txt`。
- 原活動 481 個 protected files SHA-256 全部一致。實體手機尚未驗證；本工具無 Moodle readiness gate。
