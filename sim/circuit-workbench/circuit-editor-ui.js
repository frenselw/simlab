(function (root) {
  'use strict';
  const template = `
  <svg class="icon-defs" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><symbol id="icon-settings" viewBox="0 0 24 24"><path d="m10 3-.6 2.3-2 .9-2.1-.6-2 3.4 1.6 1.7v2.6L3.3 15l2 3.4 2.1-.6 2 .9L10 21h4l.6-2.3 2-.9 2.1.6 2-3.4-1.6-1.7v-2.6l1.6-1.7-2-3.4-2.1.6-2-.9L14 3Z"/><circle cx="12" cy="12" r="3"/></symbol><symbol id="icon-save" viewBox="0 0 24 24"><path d="M5 3h12l3 3v15H4V3ZM8 3v6h8V3M8 21v-7h8v7"/></symbol><symbol id="icon-open" viewBox="0 0 24 24"><path d="M3 20V5h7l2 3h9v4M3 20l3-8h16l-3 8Z"/></symbol><symbol id="icon-locate" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></symbol><symbol id="icon-zoom-in" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6M10 7v6"/></symbol><symbol id="icon-zoom-out" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6"/></symbol><symbol id="icon-fit" viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8h8v8H8Z"/></symbol><symbol id="icon-straight" viewBox="0 0 24 24"><path d="M5 12h14"/><circle cx="3" cy="12" r="2"/><circle cx="21" cy="12" r="2"/></symbol><symbol id="icon-attach" viewBox="0 0 24 24"><path d="M2 8h4M18 8h4M11 7h2M11 9h2M3 18h6l-2-2M9 18l-2 2M21 18h-6l2-2M15 18l2 2"/><rect x="6" y="5" width="5" height="6" rx="1"/><rect x="13" y="5" width="5" height="6" rx="1"/></symbol><symbol id="icon-detach" viewBox="0 0 24 24"><path d="M1 8h3M20 8h3M9 7h2M9 9h2M9 18H3l2-2M3 18l2 2M15 18h6l-2-2M21 18l-2 2"/><rect x="4" y="5" width="5" height="6" rx="1"/><rect x="15" y="5" width="5" height="6" rx="1"/></symbol><symbol id="icon-meter" viewBox="0 0 24 24"><path d="M3 18a9 9 0 0 1 18 0ZM12 17l4-7M6 11l1 1M12 8v2M18 11l-1 1"/></symbol><symbol id="icon-flip" viewBox="0 0 24 24"><path d="M4 8h16l-4-4M20 16H4l4 4"/></symbol><symbol id="icon-rotate-cw" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M15 8h6V2"/></symbol><symbol id="icon-rotate-ccw" viewBox="0 0 24 24"><g transform="translate(24 0) scale(-1 1)"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M15 8h6V2"/></g></symbol><symbol id="icon-trash" viewBox="0 0 24 24"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></symbol><symbol id="icon-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></symbol><symbol id="icon-probe" viewBox="0 0 24 24"><path d="m4 20 6-6M7 11l6 6M9 13l8-8 3 3-8 8M17 5l3-3"/></symbol><symbol id="icon-wire" viewBox="0 0 24 24"><path d="M3 5c0 12 18 2 18 14"/><circle cx="3" cy="3" r="2"/><circle cx="21" cy="21" r="2"/></symbol><symbol id="icon-panel" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M18 9h1M18 13h1"/></symbol><symbol id="icon-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2M12 17h.01"/></symbol></defs></svg>
  <header class="sim-header" data-sim-fullscreen>
    <div class="brand"><h1>電路工作台 <span class="badge">直流</span></h1><p>搭建・量測・探索</p></div>
    <nav class="header-actions" aria-label="電路文件及操作">
      <select id="preset" aria-label="課堂範例"><option value="series">兩燈串聯</option><option value="parallel">兩燈並聯</option><option value="mixed">串並混聯</option><option value="ohm">全電路歐姆定律</option><option value="limiting">滑動變阻器 · 限流</option><option value="divider">滑動變阻器 · 分壓</option><option value="gAmmeter">G 表 · 並聯分流</option><option value="gVoltmeter">G 表 · 串聯分壓</option><option value="meters">A／V／W 表接線</option><option value="bridge">橋式電路</option><option value="wiring">固定元件接線</option><option value="empty">空白畫布</option></select>
      <button id="undo" title="復原（Ctrl/⌘ Z）" aria-label="復原">↶</button><button id="redo" title="重做（Ctrl/⌘ Shift Z）" aria-label="重做">↷</button>
      <button id="settings" class="icon-button" title="設定" aria-label="設定" aria-controls="settingsDialog" aria-expanded="false"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-settings"/></svg></button><button id="save" class="icon-button" title="儲存電路檔" aria-label="儲存電路檔" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-save"/></svg></button><button id="open" class="icon-button" title="開啟電路檔" aria-label="開啟電路檔" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-open"/></svg></button><button id="help" class="icon-button" title="操作說明與模型" aria-label="操作說明與模型" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-help"/></svg></button>
    </nav>
  </header>
  <div class="workspace">
    <section id="stage" class="stage" aria-label="電路畫布">
      <div class="stage-tools"><div class="segmented"><button id="realView" aria-pressed="true">實物</button><button id="schematicView" aria-pressed="false">電路圖</button></div><span id="circuitStatus">直流穩態</span><button id="probe" class="icon-button" title="探測兩點電壓" aria-label="探測兩點電壓" aria-pressed="false"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-probe"/></svg></button><button id="pickWire" class="icon-button" title="拿導線：重疊時優先拿導線" aria-label="拿導線：重疊時優先拿導線" aria-pressed="false"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-wire"/></svg></button><button id="pan" class="hand-tool" aria-pressed="false" title="拖動畫布；觸控板可雙指滑動，捏合縮放" aria-label="手掌工具：拖動整張畫布"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v7c0 4-2.5 6-6 6h-2c-2 0-3.4-1-4.6-2.6L4 14c-1-1.5 1-3 2.2-1.7L8 14Z"/></svg><span>拖畫布</span></button><button id="panelToggle" class="icon-button" title="收起操作面板" aria-label="收起操作面板" aria-controls="panel" aria-expanded="true"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-panel"/></svg></button></div>
      <div id="canvasArea" class="canvas-area">
        <div class="scroll-strip left" role="group" aria-label="左下角捲頁把手：上下滑動可捲動頁面" title="上下滑動可捲動頁面"><svg viewBox="0 0 16 40" aria-hidden="true"><path d="m4 9 4-4 4 4M5 18h6M5 22h6m-7 9 4 4 4-4"/></svg></div>
        <div id="surface" class="surface" role="group" aria-label="電路畫布操作區" aria-describedby="canvasInstructions">
          <span id="canvasInstructions" class="sr-only">拖線端靠近元件接孔，或拖元件接孔靠近線端，放手接好。雙指拖動畫布，捏合縮放。滑鼠滾輪縮放；雙擊畫布空白處，第二下按住並拖曳，放開後恢復原工具。也可中鍵拖動，或按住空白鍵再拖動。觸控板按住空白鍵再雙指滑動可平移，捏合縮放。左右底角的捲頁把手可上下滑動，捲動外層頁面。</span>
          <svg id="circuitSvg" xmlns="http://www.w3.org/2000/svg" aria-label="電路圖形"><g id="scene"></g><g id="flowLayer"></g><g id="ghostLayer"></g></svg>
          <div id="hitLayer" class="hit-layer"></div><div id="canvasNotice" class="canvas-notice" hidden aria-hidden="true"></div>
          <div id="emptyHint" class="empty-hint" hidden><strong>從一個元件開始</strong><span>從工具箱取出元件和導線，拖線端或元件接孔互相靠近接好。</span></div>
        </div>
        <div class="scroll-strip right" role="group" aria-label="右下角捲頁把手：上下滑動可捲動頁面" title="上下滑動可捲動頁面"><svg viewBox="0 0 16 40" aria-hidden="true"><path d="m4 9 4-4 4 4M5 18h6M5 22h6m-7 9 4 4 4-4"/></svg></div>
        <div id="preview" class="preview" hidden aria-hidden="true"><span>接線預覽</span><button id="closePreview" type="button" aria-label="關閉刻度預覽" hidden>×</button><svg xmlns="http://www.w3.org/2000/svg"></svg></div>
      </div>
      <div class="stage-bottom"><div id="quickParameters" class="quick-parameters" role="group" aria-label="元件快捷參數" hidden><span id="quickName" class="quick-name"></span><div class="quick-stepper"><button id="quickMinus" type="button" aria-label="減少參數">−</button><label class="quick-field" for="quickValue"><span id="quickLabel" class="sr-only"></span><input id="quickValue" type="number" step="any" inputmode="decimal" aria-labelledby="quickLabel"><span id="quickUnit" aria-hidden="true"></span><span id="quickReadout" aria-hidden="true"></span></label><button id="quickPlus" type="button" aria-label="增加參數">＋</button></div></div><span id="hint" role="status" aria-live="polite">雙指拖畫布、捏合縮放；桌面按住空白鍵拖動或雙指滑動。</span><div id="selectionActions" class="context-actions" role="group" aria-label="所選物件操作" hidden><span id="selectionTip">拖線身改形狀</span><button id="straightenSelected" class="icon-button" title="拉直導線：兩端之間的最短形狀" aria-label="拉直導線：兩端之間的最短形狀" hidden><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-straight"/></svg></button><button id="detachFrom" class="icon-button socket-action" title="拔開 A 端" aria-label="拔開 A 端"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-detach"/></svg><small>A</small></button><button id="detachTo" class="icon-button socket-action" title="拔開 B 端" aria-label="拔開 B 端"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-detach"/></svg><small>B</small></button><button id="inspectMeter" class="icon-button" title="放大錶盤刻度" aria-label="放大錶盤刻度" hidden><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-meter"/></svg></button><button id="flipMeterSelected" data-action="左右換接孔" class="icon-button" title="左右換接孔" aria-label="左右換接孔" hidden><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-flip"/></svg></button><button id="rotateCounterSelected" class="icon-button" title="逆時針旋轉 90° 並拉直所連導線（Shift+R）" aria-label="逆時針旋轉 90° 並拉直所連導線（Shift+R）" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-rotate-ccw"/></svg></button><button id="rotateSelected" data-action="旋轉 90°" class="icon-button" title="順時針旋轉 90° 並拉直所連導線（R）" aria-label="順時針旋轉 90° 並拉直所連導線（R）" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-rotate-cw"/></svg></button><button id="deleteSelected" class="icon-button danger" title="刪除所選" aria-label="刪除所選" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-trash"/></svg></button><button id="copySelected" data-action="複製元件" class="icon-button" title="複製元件" aria-label="複製元件"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-copy"/></svg></button><button id="focusSelected" class="icon-button" data-action="定位所選" title="定位所選" aria-label="定位所選" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-locate"/></svg></button></div><div class="camera-tools"><button id="quickWire" class="take-wire">＋導線 <span>16/20</span></button><div class="camera-pan" role="group" aria-label="移動畫布"><button data-camera="left" aria-label="向左查看">←</button><button data-camera="right" aria-label="向右查看">→</button><button data-camera="up" aria-label="向上查看">↑</button><button data-camera="down" aria-label="向下查看">↓</button></div><div class="camera-zoom" role="group" aria-label="畫布縮放"><button data-camera="out" class="icon-button" title="縮小畫布" aria-label="縮小畫布"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-zoom-out"/></svg></button><output id="zoomReadout">100%</output><button data-camera="in" class="icon-button" title="放大畫布" aria-label="放大畫布"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-zoom-in"/></svg></button><button id="fitView" class="icon-button" title="顯示全圖並啟用自動適應" aria-label="顯示全圖並啟用自動適應" data-camera="fit" aria-pressed="true"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-fit"/></svg></button></div></div></div>
    </section>
    <aside id="panel" class="panel" aria-label="操作面板">
      <section class="panel-section"><h2>元件工具箱</h2><div id="palette" class="palette"></div></section>
      <section class="panel-section cable-toolbox"><h2>導線工具箱</h2><button id="addWire" class="take-wire"><svg viewBox="0 0 80 32" aria-hidden="true"><path d="M8 16H72"/><circle cx="8" cy="16" r="4"/><circle cx="72" cy="16" r="4"/></svg><span>取出導線 <b id="wireStock">16 / 20</b></span></button><p class="note">拿線端或元件接孔互相靠近接線，拿線身移動或彎曲。</p></section>
      <section id="diagramLabels" class="panel-section"><h2>圖上標示</h2><div id="wireCurrentControls" class="diagram-label-controls" role="group" aria-label="導線電流標示" title="藍色箭嘴表示常規電流方向。"><h3>導線電流</h3><div class="wire-current-controls"><button id="showWireCurrents" type="button" aria-label="顯示全部導線電流">全顯示</button><button id="hideWireCurrents" type="button" aria-label="隱藏全部導線電流">全隱藏</button></div></div><div id="potentialDirectionControls" class="diagram-label-controls" role="group" aria-label="電勢升高方向標示" title="琥珀色箭嘴由低電勢指向高電勢。"><h3>電勢方向</h3><div class="wire-current-controls"><button id="showPotentialDirections" type="button" aria-label="顯示全部元件電勢方向">全顯示</button><button id="hidePotentialDirections" type="button" aria-label="隱藏全部元件電勢方向">全隱藏</button></div></div><div id="potentialColorControls"><label class="check"><input type="checkbox" id="potential">電勢色彩</label><div id="potentialLegend" hidden><div id="potentialScale" class="potential-scale" role="img"></div><div id="potentialTicks" class="potential-ticks"><span id="potentialLow"></span><span id="potentialMid"></span><span id="potentialHigh"></span></div><p class="note potential-zero-note">各電路分別以 <span data-help-tex="0\\,\\mathrm{V}" data-help-text="0 V"></span> 為參考。</p></div></div></section>
      <section class="panel-section inspector"><h2 id="selectionTitle">電路概覽</h2><div id="properties"></div><div id="objectActions" class="object-actions"></div></section>
      <details class="panel-section"><summary>連線清單</summary><div id="wireList"></div></details>
    </aside>
  </div>
  <input id="fileInput" type="file" accept=".json,application/json" hidden>
  <dialog id="helpDialog" aria-labelledby="helpTitle" class="help-dialog">
    <div class="dialog-head"><div><h2 id="helpTitle">電路工作台 · 快速上手</h2><p class="note">先接線，再量度與調整。</p></div><button id="closeHelp" aria-label="關閉說明" title="關閉說明">×</button></div>
    <div class="help-body">
      <section><h3>三步搭建</h3><ol class="help-steps">
        <li><strong>取出元件與導線</strong><span>從工具箱選取，也可按畫布下方「＋導線」。</span></li>
        <li><strong>拖到接孔，放手接好</strong><span>把線端拖近白色圓孔，出現藍圈便可放手。</span></li>
        <li><strong>移動與改形狀</strong><span>拖元件搬位；接好一端後拖線身彎曲。拉走已接線端可拔開。</span></li>
      </ol><p class="help-tip">線身交叉不會接通；線太短可移近元件或接另一條線。</p></section>
      <section><h3>儀表接法</h3><dl class="help-meters">
        <div><dt>電流表 <span data-help-tex="\\mathrm{A}" data-help-text="A"></span></dt><dd>串聯；量程 <span data-help-tex="0.6\\,\\mathrm{A}" data-help-text="0.6 A"></span>／<span data-help-tex="3\\,\\mathrm{A}" data-help-text="3 A"></span>。</dd></div>
        <div><dt>電壓表 <span data-help-tex="\\mathrm{V}" data-help-text="V"></span></dt><dd>並聯；量程 <span data-help-tex="3\\,\\mathrm{V}" data-help-text="3 V"></span>／<span data-help-tex="15\\,\\mathrm{V}" data-help-text="15 V"></span>。</dd></div>
        <div><dt>電功率表 <span data-help-tex="\\mathrm{W}" data-help-text="W"></span></dt><dd><span data-help-tex="I_{+},\\ I_{-}" data-help-text="I+、I−"></span> 串聯；<span data-help-tex="V_{+},\\ V_{-}" data-help-text="V+、V−"></span> 跨接用電器。<br><span data-help-tex="P=(V_{+}-V_{-})I" data-help-text="P = (V+ − V−) I"></span></dd></div>
      </dl><p class="help-tip">電流表／電壓表接共用 <span data-help-tex="-" data-help-text="−"></span> 孔及一個量程孔，先用大量程。等指針停定再讀數；手機點電錶可放大刻度。</p></section>
      <section><h3>移圖與讀值</h3><ul class="help-short-list">
        <li><strong>手機：</strong>雙指拖畫布、捏合縮放。</li>
        <li><strong>桌面：</strong>滾輪縮放；雙擊畫布空白處，第二下按住並拖曳；放開後恢復原工具。也可按住空白鍵拖畫布。</li>
        <li><strong>調參：</strong>選元件後用底部分組工具調參、旋轉、刪除、複製或定位；調參用 <span data-help-tex="-\\,/\\,+" data-help-text="−／＋"></span>；其他選項在設定。</li>
        <li><strong>電勢：</strong>「圖上標示」可全部或逐元件顯示升高方向；琥珀色箭嘴由低指向高，跟隨接孔旋轉。電勢色彩可獨立開關；探測工具可量兩點電壓。</li>
        <li><strong>導線電流：</strong>面板可全部顯示／隱藏，選導線後可逐條開關。靜態箭嘴表示常規電流方向，數字表示大小；「未能確定」不代表零。</li>
      </ul></section>
      <details class="help-more"><summary>更多操作與模型</summary><ul class="help-short-list">
        <li><kbd>R</kbd> 旋轉、<kbd>Esc</kbd> 取消、<kbd>Ctrl／⌘ Z</kbd> 復原。選導線後亦可用接好／拔開圖示。</li>
        <li>靈敏電流計：中心零，滿偏 <span data-help-tex="\\pm50\\,\\mu\\mathrm{A}" data-help-text="±50 μA"></span>；內阻 <span data-help-tex="100\\,\\Omega" data-help-text="100 Ω"></span>。</li>
        <li>變阻器：<span data-help-tex="A-P" data-help-text="A–P"></span> 限流；<span data-help-tex="A-B" data-help-text="A–B"></span> 供電、由 <span data-help-tex="P" data-help-text="P"></span> 取分壓。</li>
        <li>導線預設為理想；選線可設定固定總電阻，教師設定只影響新取線。拖動或彎線不改阻值。</li><li>預設理想電源內阻 <span data-help-tex="r=0\\,\\Omega" data-help-text="r = 0 Ω"></span>。互不相連的電路，各有自己的零伏參考。</li>
        <li>箭頭速度、燈光與發熱只作教學示意；未知讀值顯示「—」，不代表零。</li>
      </ul></details>
    </div>
  </dialog>
<dialog id="settingsDialog" aria-labelledby="settingsTitle"><div class="dialog-head"><div><h2 id="settingsTitle">工作台設定</h2><p class="note">即時套用；電路設定可復原及隨電路檔儲存。</p><p id="settingsNotice" class="settings-notice" role="status" aria-live="polite" hidden></p></div><button id="closeSettings" aria-label="關閉設定" title="關閉設定">×</button></div><div class="settings-grid">
<section class="settings-section"><h3>顯示與教學</h3>        <label>方向示意<select id="flow"><option value="current">常規電流</option><option value="electron">導線中的電子</option><option value="off">關閉</option></select></label>
        <p class="note">同一電路電流變小時，箭頭／電子會變慢；微小電流保留可見速度。動畫不代表真實漂移速度。</p>
        <label class="check"><input type="checkbox" id="projection">投影字體</label><label class="check"><input type="checkbox" id="pause">暫停動畫</label>
</section>
<section class="settings-section"><h3>畫布標籤</h3>        <label class="check"><input type="checkbox" id="names" checked>顯示元件名稱</label><label class="check"><input type="checkbox" id="values" checked>顯示畫布讀值與參數</label><label class="check"><input type="checkbox" id="rheostatResistance" checked>顯示滑動變阻器電阻</label>
        <details id="advancedValues"><summary>進階內容</summary><label class="check"><input id="loadResistance" type="checkbox">顯示用電器電阻</label><label class="check"><input id="loadPower" type="checkbox">顯示用電器功率</label><label class="check"><input id="sourceResistance" type="checkbox">顯示電源內阻</label></details>
</section>
<section class="settings-section"><h3>教師設定</h3>        <label>操作模式<select id="mode"><option value="free">自由搭建</option><option value="wiring">固定元件，只接線</option></select></label>
        <fieldset id="policyOptions" hidden><legend>固定模式開放項目</legend><label class="check"><input id="allowRotate" type="checkbox">旋轉元件</label><label class="check"><input id="allowParams" type="checkbox">修改所有參數</label><label class="check"><input id="allowSwitch" type="checkbox" checked>開合開關</label></fieldset>
<label>導線總數<input id="cableCount" type="number" min="1" max="240" step="1"></label><label>新導線預設電阻（Ω）<input id="cableResistance" type="number" min="0" max="1000000" step="any" aria-describedby="cableResistanceNote"></label><p id="cableResistanceNote" class="note">0 Ω 為理想導線；只影響之後取出的線，已有導線可逐條調整。阻值不隨畫圖長度改變。</p><label>新導線最大長度<select id="cableLength"><option value="240">短 · 240</option><option value="400">中 · 400</option><option value="600">標準 · 600</option><option value="900">長 · 900</option><option value="1200">特長 · 1200</option></select></label><p class="note">長度以畫布單位計；縮放不會改變。設定只影響之後取出的導線。</p></section>
<section class="settings-section"><h3>文件與整理</h3><div class="stack"><button id="saveTemplate">另存固定元件模板</button><button id="exportSvg">匯出 SVG 電路圖</button><button id="autoRoute">整理全部線形</button><button id="clearWires">只移除導線</button><button id="clearAll">清空畫布</button></div></section>
</div></dialog>
<dialog id="meterDialog"><div class="dialog-head"><h2 id="meterTitle">雙量程錶盤</h2><button id="closeMeter" aria-label="關閉錶盤">×</button></div><div id="meterDetail" class="meter-detail"></div></dialog>

`;
  function build(host, profile, prefix) {
    host.classList.add('sim-app','workbench','circuit-editor');
    host.setAttribute('data-sim-fullscreen-target','');
    host.tabIndex = -1;
    const content = document.createElement('template'); content.innerHTML = template;
    const refs = {app:host};
    for (const element of content.content.querySelectorAll('[id]')) {
      const id = element.id; refs[id] = element; element.dataset.circuitId = id; element.id = prefix + id;
    }
    for (const element of content.content.querySelectorAll('*')) {
      for (const attribute of ['href','aria-controls','aria-labelledby','aria-describedby','for']) {
        const value=element.getAttribute(attribute); if (!value) continue;
        if (attribute==='href' && value.startsWith('#')) element.setAttribute(attribute,'#'+prefix+value.slice(1));
        else if (attribute!=='href') element.setAttribute(attribute,value.split(/\s+/).map(id=>prefix+id).join(' '));
      }
    }
    const remove = (...ids) => ids.forEach(id=>refs[id].remove());
    const ui=profile.ui, student=profile.role==='student';
    if (!ui.presets) remove('preset');
    if (!ui.files) remove('save','open','fileInput');
    if (!ui.settings) remove('settings','settingsDialog');
    if (!ui.probe) remove('probe');
    if (!ui.quickParameters) remove('quickParameters');
    if (!ui.wireCurrents) remove('wireCurrentControls');
    if (!ui.potentialDirections) remove('potentialDirectionControls');
    if (!ui.settings) remove('potentialColorControls');
    if (!ui.wireCurrents && !ui.potentialDirections && !ui.settings) remove('diagramLabels');
    if (!ui.viewToggle) refs.realView.parentElement.remove();
    if (!ui.status) remove('circuitStatus');
    if (!profile.undo) remove('undo','redo');
    if (!ui.help) remove('help','helpDialog');
    else if (student) {
      refs.helpDialog.innerHTML='<div class="dialog-head"><h2 id="'+prefix+'helpTitle">電路操作</h2><button type="button" aria-label="關閉說明" title="關閉說明">×</button></div><div class="help-body"><ol class="help-steps"><li><strong>拖線端接孔</strong><span>拖近白色圓孔，見藍圈便放手接好。</span></li><li><strong>調整線形</strong><span>接好一端後，可拿線身彎曲。線身交叉不會接通。</span></li><li><strong>移動畫布</strong><span>雙指拖動、捏合縮放；桌面雙擊畫布空白處，第二下按住並拖曳，放開後恢復原工具。</span></li></ol></div>';
      refs.closeHelp=refs.helpDialog.querySelector('button');refs.closeHelp.id=prefix+'closeHelp';refs.closeHelp.dataset.circuitId='closeHelp';
    }
    if (!ui.palette) refs.palette.closest('.panel-section').remove();
    if (!ui.inspector) refs.properties.closest('.panel-section').remove();
    if (!ui.wireList) refs.wireList.closest('.panel-section').remove();
    if (student || !profile.wires) refs.addWire.closest('.panel-section').remove();
    if (!profile.wires) remove('quickWire','pickWire','detachFrom','detachTo','straightenSelected');
    if (!ui.palette && !ui.inspector && !ui.wireList && !ui.wireCurrents && !ui.potentialDirections && !ui.settings && (!ui.help || student)) {
      remove('panel','panelToggle'); host.classList.add('no-panel','panel-hidden');
    }
    const heading=content.content.querySelector('.brand h1');
    heading.replaceChildren(document.createTextNode(profile.title+' '));
    const badge=document.createElement('span'); badge.className='badge'; badge.textContent='直流'; heading.append(badge);
    content.content.querySelector('.brand p').textContent=profile.subtitle;
    host.replaceChildren(content.content);
    return refs;
  }
  root.CircuitEditorUI=Object.freeze({build});
})(window);
