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
  }
];

if (typeof window !== "undefined") {
  window.simulationList = simulationList;
}

if (typeof module !== "undefined") {
  module.exports = { simulationList };
}
