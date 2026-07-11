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
  }
];

if (typeof window !== "undefined") {
  window.simulationList = simulationList;
}

if (typeof module !== "undefined") {
  module.exports = { simulationList };
}
