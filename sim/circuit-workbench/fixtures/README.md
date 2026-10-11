# AC 能量恢復回歸資料

這些JSON為固定測試資料，不是runtime依賴，不加入工作台／Sites資產清單。

- `cw06-v1-ac-capacitor.json`：原 `183703959ffe32532e1e0480849e77b0a828d323` 的完整Transient Session，6 V RMS、1 Hz、理想源直接接0.02 F C；含接近¼、½、1週期。0.49999 s用原預設步長；部分半／整週期例以maxStep=0.002 s得到舊版自身仍reliable的歷史，不把舊失效狀態冒充可恢復資料。
- `cw03-r2-v2-island-books.json`：原 `dcfde3ce183d714b03ff4fcf0fd66db9f91080e2` 的完整Session，含可拆分舊帳、真正零歷史、兩個活躍區塊的不可分配歷史，以及舊粗能量域接受的242.548659 μJ虛假耗散。
- `cw06-legacy-example-codecs.json`：原dcfde3c Session的變壓器及LC充電／自由振盪狀態，保存舊codec v6的physics；測試亦移除v2能量帳以核對相應v5遷移，並經目前正式codec及受限示例profile恢復／續算。

產生時用git取得對應提交的 `circuit-transient.js`，透過Node VM載入原Session，文件、registry及示例模板用目前正式適配器。資料內保留來源提交及方法；這不是整個歷史checkout或舊版完整browser驗收。CI直接讀固定JSON，沒有依賴git歷史或執行舊求解器。新測試會改動複本以驗證拒絕，不改fixture或用新版公式重建舊歷史。
