(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsGraphNotation = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function isEnglishLetter(character) {
    return typeof character === "string" && character.length === 1 &&
      (character >= "A" && character <= "Z" || character >= "a" && character <= "z");
  }

  function tokenize(value) {
    const source = String(value ?? "");
    const parts = [];
    let plainStart = 0;

    function appendPlain(end) {
      if (end <= plainStart) return;
      const text = source.slice(plainStart, end);
      const previous = parts[parts.length - 1];
      if (previous && !previous.variable) previous.text += text;
      else parts.push({ text, variable: false });
    }

    function appendVariable(text) {
      parts.push({ text, variable: true });
    }

    let index = 0;
    while (index < source.length) {
      const character = source[index];
      const graphLike = (character === "x" || character === "v" || character === "a") &&
        (source[index + 1] === "-" || source[index + 1] === "–") && source[index + 2] === "t";
      if (graphLike) {
        const validBoundary = !isEnglishLetter(source[index - 1]) && !isEnglishLetter(source[index + 3]);
        if (validBoundary) {
          appendPlain(index);
          appendVariable(character);
          parts.push({ text: "–", variable: false });
          appendVariable("t");
          index += 3;
          plainStart = index;
          continue;
        }
        index += 3;
        continue;
      }
      if ("xvat".includes(character) &&
          !isEnglishLetter(source[index - 1]) && !isEnglishLetter(source[index + 1])) {
        appendPlain(index);
        appendVariable(character);
        index += 1;
        plainStart = index;
        continue;
      }
      index += 1;
    }
    appendPlain(source.length);
    return parts;
  }

  return { isEnglishLetter, tokenize };
});
