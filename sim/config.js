const simulationList = [
  {
    title: "水平面靜止物體受力圖",
    folder: "fbd-horizontal-block",
    categories: ["Mechanics"],
    description: "學生為受外力但保持靜止的水平面物體建立自由體圖並提交評分。",
    tags: ["physics", "forces", "free-body-diagram", "scorm"],
    status: "active"
  },
  {
    title: "平面鏡鉛筆成像光路圖",
    folder: "plane-mirror-pencil-ray-diagram",
    categories: ["Light & Waves"],
    description: "學生為平面鏡前的鉛筆繪製入射光線、反射光線、虛線延長線，並放置虛像。",
    tags: ["physics", "optics", "ray-diagram", "plane-mirror", "scorm"],
    status: "active"
  },
  {
    title: "路程、位移與總位移地圖任務",
    folder: "displacement-distance-map-journey",
    categories: ["Mechanics"],
    description: "在隨機地圖中拖曳小人行走，量度路程，畫出分段位移和總位移。",
    tags: ["physics", "mechanics", "displacement", "distance", "vectors", "scorm"],
    status: "active"
  },
  {
    title: "慣性參考系：公路觀察任務",
    folder: "inertial-reference-frame-road-observer",
    categories: ["Mechanics"],
    description: "在斜角公路場景中轉換觀察位置，根據物體的相對運動找出合適的慣性參考系。",
    tags: ["physics", "mechanics", "reference-frame", "inertial-frame", "motion", "scorm"],
    status: "active"
  },
  {
    title: "位置—時間圖運動實驗室",
    folder: "position-time-graph-motion-lab",
    categories: ["Mechanics"],
    description: "自由設定車的起點和速度，觀察、繪畫及量度位置—時間圖，再完成操作評估。",
    tags: ["physics", "mechanics", "kinematics", "position-time-graph", "motion", "scorm"],
    status: "active"
  },
  {
    title: "直線運動：平均速度與瞬時速度",
    folder: "linear-motion-velocity-lab",
    categories: ["Mechanics"],
    description: "利用移動標尺、計時器和時間放大鏡，量度位移與時間，計算平均速度，並理解瞬時速度。",
    tags: ["physics", "mechanics", "kinematics", "velocity", "instantaneous-velocity", "scorm"],
    status: "active"
  },
  {
    title: "勻速與勻變速：駕駛控制挑戰",
    folder: "kinematics-driving-challenge",
    categories: ["Mechanics"],
    description: "按住油門與煞車，在平路和斜坡製造勻速、勻加速及勻減速，並用無數字運動圖像判斷表現。",
    tags: ["physics", "mechanics", "kinematics", "uniform-motion", "constant-acceleration", "driving", "scorm"],
    status: "active"
  },
  {
    title: "勻速與勻變速：三圖手繪挑戰",
    folder: "kinematics-qualitative-graph-sketching",
    categories: ["Mechanics"],
    description: "根據直線運動描述，親手畫出定性的 x–t、v–t 及 a–t 圖，並完成由加速到停止的分段綜合挑戰。",
    tags: ["physics", "mechanics", "kinematics", "motion-graphs", "position-time", "velocity-time", "acceleration-time", "drawing", "scorm"],
    status: "active"
  },
  {
    title: "勻速與勻變速：三圖定量建構挑戰",
    folder: "kinematics-quantitative-graph-builder",
    categories: ["Mechanics"],
    description: "根據具體初始位置、初速度、加速度和時間，拖動精確坐標點建立 x–t、v–t 及 a–t 圖。",
    tags: ["physics", "mechanics", "kinematics", "motion-graphs", "position-time", "velocity-time", "acceleration-time", "constant-acceleration", "graph-construction", "scorm"],
    status: "active"
  },
  {
    title: "自由落體：頻閃量度實驗室",
    folder: "free-fall-stroboscopic-measurement-lab",
    categories: ["Mechanics"],
    description: "設定頻閃頻率，移動直尺量度自由落體各位置，從總位移及相鄰間隔歸納運動規律。",
    tags: ["physics", "mechanics", "kinematics", "free-fall", "stroboscopic-motion", "measurement", "constant-acceleration", "scorm"],
    status: "active"
  },
  {
    title: "重心探究實驗室",
    folder: "centre-of-mass-investigation-lab",
    categories: ["Mechanics"],
    description: "透過承托、懸掛畫鉛垂線和旋轉立體，從實驗證據找出一維、二維及三維物體的重心。",
    tags: ["physics", "mechanics", "centre-of-mass", "balance", "suspension", "scorm"],
    status: "active"
  },
  {
    title: "胡克定律：彈簧探究與預測實驗室",
    folder: "hookes-law-spring-investigation-lab",
    categories: ["Mechanics"],
    description: "量度兩條彈簧在不同負載下的伸長，建立 F–x 模型，完成預測，並用自己的模型設計最大安全負載。",
    tags: ["physics", "mechanics", "hookes-law", "spring", "spring-constant", "force-extension", "measurement", "graph", "prediction", "engineering", "scorm"],
    status: "active"
  },
  {
    title: "靜摩擦力與滑動摩擦力探究實驗室",
    folder: "static-kinetic-friction-investigation-lab",
    categories: ["Mechanics"],
    description: "直接拖動物體，在 30 秒內同步記錄拉力—時間圖，從力平衡與牛頓第二定律探究靜摩擦力、最大靜摩擦力及滑動摩擦力。",
    tags: ["physics", "mechanics", "friction", "static-friction", "kinetic-friction", "direct-manipulation", "newtons-laws", "force-time-graph", "measurement", "scorm"],
    status: "active"
  },
  {
    title: "力的合成作圖實驗室",
    folder: "force-composition-construction-lab",
    categories: ["Mechanics"],
    description: "平移隨機力矢量，利用平行四邊形法則及首尾相接法作出兩力和三力的合力。",
    tags: ["physics", "mechanics", "forces", "vectors", "vector-addition", "resultant-force", "parallelogram-law", "head-to-tail", "drawing", "scorm"],
    status: "active"
  }
];

if (typeof window !== "undefined") {
  window.simulationList = simulationList;
}

if (typeof module !== "undefined") {
  module.exports = { simulationList };
}
