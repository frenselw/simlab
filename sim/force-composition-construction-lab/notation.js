(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ForceCompositionNotation = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  function vector(index) {
    const subscript = index === "R" ? "R" : String(index);
    return Object.freeze({ kind: "vector", text: "F", subscript, className: "math-vector", accessible: index === "R" ? "合力 F R" : `力矢量 F ${numberWord(index)}` });
  }

  function scalar(index) {
    return Object.freeze({ kind: "scalar", text: "F", subscript: String(index), className: "math-scalar", accessible: `力的大小 F ${numberWord(index)}` });
  }

  function point(name = "O") {
    return Object.freeze({ kind: "point", text: String(name), className: "math-point", accessible: name === "O" ? "作圖起點 O" : `點 ${name}` });
  }

  function operator(text) {
    return Object.freeze({ kind: "operator", text: String(text), className: "math-operator", accessible: text === "+" ? "加" : text === "=" ? "等於" : String(text) });
  }

  function number(value) {
    return Object.freeze({ kind: "number", text: String(value), className: "math-number", accessible: String(value) });
  }

  function unit(value) {
    return Object.freeze({ kind: "unit", text: String(value), className: "math-unit", accessible: value === "N" ? "牛頓" : String(value) });
  }

  function numberWord(value) {
    return ({ 1: "一", 2: "二", 3: "三" })[Number(value)] || String(value);
  }

  function vectorLabel(index) {
    return vector(index);
  }

  function expression(forceCount) {
    if (![2, 3].includes(forceCount)) throw new Error("Only two-force and three-force expressions are supported");
    const parts = [vector("R"), operator("=")];
    for (let index = 1; index <= forceCount; index += 1) {
      if (index > 1) parts.push(operator("+"));
      parts.push(vector(index));
    }
    return Object.freeze({
      parts: Object.freeze(parts),
      accessible: forceCount === 2 ? "合力等於力矢量 F 一加力矢量 F 二" : "合力等於力矢量 F 一加力矢量 F 二加力矢量 F 三"
    });
  }

  function tokenNode(documentObject, token) {
    const node = documentObject.createElement(token.kind === "vector" || token.kind === "scalar" || token.kind === "point" ? "var" : "span");
    node.className = token.className;
    node.textContent = token.text;
    if (token.subscript) {
      const sub = documentObject.createElement("sub");
      sub.className = "math-subscript-upright";
      sub.textContent = token.subscript;
      node.append(sub);
    }
    return node;
  }

  function appendHtml(target, specification) {
    const documentObject = target.ownerDocument;
    const wrapper = documentObject.createElement("span");
    wrapper.className = "math-expression";
    wrapper.setAttribute("aria-hidden", "true");
    for (const token of specification.parts || [specification]) wrapper.append(tokenNode(documentObject, token));
    const accessible = documentObject.createElement("span");
    accessible.className = "sr-only";
    accessible.textContent = specification.accessible || specification.parts?.map((token) => token.accessible).join(" ") || "";
    target.append(wrapper, accessible);
    return { wrapper, accessible };
  }

  function svgLabel(documentObject, token, attributes = {}) {
    const text = documentObject.createElementNS(SVG_NS, "text");
    text.setAttribute("class", "math-svg");
    text.setAttribute("role", "img");
    text.setAttribute("aria-label", token.accessible);
    for (const [key, value] of Object.entries(attributes)) text.setAttribute(key, String(value));
    const main = documentObject.createElementNS(SVG_NS, "tspan");
    main.setAttribute("class", token.className);
    main.textContent = token.text;
    text.append(main);
    if (token.subscript) {
      const sub = documentObject.createElementNS(SVG_NS, "tspan");
      sub.setAttribute("class", "math-subscript-upright");
      sub.setAttribute("baseline-shift", "sub");
      sub.setAttribute("font-size", "70%");
      sub.textContent = token.subscript;
      text.append(sub);
    }
    return text;
  }

  function accessibleForce(index) {
    return vector(index).accessible;
  }

  return Object.freeze({ vector, scalar, point, operator, number, unit, numberWord, vectorLabel, expression, tokenNode, appendHtml, svgLabel, accessibleForce });
});
