(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model.js") : root.AdvancedEquilibriumModel,
    typeof module === "object" && module.exports ? require("./notation.js") : root.AdvancedEquilibriumNotation);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AdvancedEquilibriumScene = api;
})(typeof window !== "undefined" ? window : globalThis, function (M, N) {
  "use strict";
  const unit = angle => ({ x: Math.cos(angle * Math.PI / 180), y: -Math.sin(angle * Math.PI / 180) });
  const point = (c, a, r) => { const u = unit(a); return { x: c.x + u.x * r, y: c.y + u.y * r }; };
  const xy = p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  const line = (a, b, attrs = "") => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${attrs}/>`;
  function arrowPath(start, end, scale = 1) {
    const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
    if (length < .01) return "";
    const u = { x: dx / length, y: dy / length }, n = { x: -u.y, y: u.x };
    const head = Math.min(14 * scale, length * .4), half = Math.min(6 * scale, length * .18), shaft = 1.7 * scale;
    const base = { x: end.x - u.x * head, y: end.y - u.y * head };
    return [
      { x: start.x + n.x * shaft, y: start.y + n.y * shaft },
      { x: base.x + n.x * shaft, y: base.y + n.y * shaft },
      { x: base.x + n.x * half, y: base.y + n.y * half }, end,
      { x: base.x - n.x * half, y: base.y - n.y * half },
      { x: base.x - n.x * shaft, y: base.y - n.y * shaft },
      { x: start.x - n.x * shaft, y: start.y - n.y * shaft }
    ].map((p, i) => `${i ? "L" : "M"}${xy(p)}`).join(" ") + " Z";
  }
  function edgeRadius(angle, rotation, halfWidth, halfHeight) {
    const u = unit(angle - rotation);
    return Math.min(halfWidth / Math.max(1e-8, Math.abs(u.x)), halfHeight / Math.max(1e-8, Math.abs(u.y)));
  }
  function reach(c, angle, l, top = 52) {
    const u = unit(angle), dx = u.x > 0 ? l.width - 18 - c.x : c.x - 18;
    const dy = u.y > 0 ? l.height - 27 - c.y : c.y - top;
    return Math.max(0, Math.min(dx / Math.max(Math.abs(u.x), 1e-8), dy / Math.max(Math.abs(u.y), 1e-8)));
  }
  function geometry(q, l) {
    const { width: w, height: h, center: c, displayScale: scale } = l, sign = q.params.sign;
    const tilt = ['A', 'D'].includes(q.family) ? sign * q.params.theta : 0;
    const normal = unit(90 + tilt), bodies = [], links = [], walls = [], surfaces = [];
    const circle = (center, radius, label = '', target = true) => ({ shape: 'circle', center, radius, label, target });
    const box = (center, width, height, label = '', target = true) => ({ shape: 'box', center, width, height, tilt, label, target });
    if (q.family === 'A' || q.family === 'B') {
      const radius = Math.min(25 * scale, w * .078, (h - 76) * .19);
      bodies.push(circle(c, radius));
      if (q.family === 'A') {
        const foot = { x: c.x - normal.x * radius, y: c.y - normal.y * radius };
        surfaces.push({ foot, tilt, rough: false });
        const x = c.x - sign * radius, bottom = foot.y - Math.tan(tilt * Math.PI / 180) * (x - foot.x);
        walls.push({ x, top: Math.max(54, c.y - radius - 60 * scale), bottom, sign });
      } else {
        for (const link of [...q.ropes.map(r => ({ ...r, type: 'rope' })), ...q.springs.map(r => ({ ...r, type: 'spring' }))]) {
          links.push({ ...link, from: point(c, link.angle, radius), to: point(c, link.angle, reach(c, link.angle, l)), fixed: true });
        }
      }
    } else if (q.family === 'C') {
      const width = Math.min(80 * scale, w * .19, (h - 76) * .60), height = width * .65;
      const distance = Math.min(width + 64 * scale, w / 2 - 14 - width / 2);
      const a = q.params.target === 'A' ? c : { x: c.x - sign * distance, y: c.y };
      const b = q.params.target === 'B' ? c : { x: c.x + sign * distance, y: c.y };
      bodies.push(box(a, width, height, 'A', q.params.target === 'A'), box(b, width, height, 'B', q.params.target === 'B'));
      surfaces.push({ foot: { x: c.x, y: c.y + height / 2 }, tilt: 0, rough: true });
      const from = { x: a.x + sign * width / 2, y: c.y + height * .20 }, to = { x: b.x - sign * width / 2, y: from.y };
      links.push({ type: 'spring', id: 'spring', state: 'compressed', from, to });
      const contact = { x: b.x - sign * width / 2, y: c.y - height * .23 };
      links.push({ type: 'rod', id: 'push', from: { x: contact.x - sign * Math.min((distance - width) * .78, 50 * scale), y: contact.y }, to: contact });
    } else if (q.family === 'D') {
      const width = Math.min(100 * scale, Math.max(66, w * .14) * scale, (h - 60) * .7), height = width * .59;
      bodies.push(box(c, width, height));
      surfaces.push({ foot: { x: c.x - normal.x * height / 2, y: c.y - normal.y * height / 2 }, tilt, rough: true });
      const angle = q.rods[0].angle + 180, edge = edgeRadius(angle, tilt, width / 2, height / 2);
      links.push({ type: 'rod', id: 'push', from: point(c, angle, reach(c, angle, l)), to: point(c, angle, edge) });
    } else if (q.family === 'E') {
      const radius = Math.min(22 * scale, w * .055, (h - 80) * .125), direction = unit(q.ropes[1].angle);
      const verticalRoom = q.params.target === 1 ? h - 27 - radius - c.y : c.y - 52 - radius - 14 * scale;
      const distance = Math.min(122 * scale, (w / 2 - 18 - radius) / Math.abs(direction.x), verticalRoom / direction.y);
      const a = q.params.target === 1 ? c : point(c, q.ropes[1].angle + 180, distance);
      const b = q.params.target === 2 ? c : point(c, q.ropes[1].angle, distance);
      bodies.push(circle(a, radius, '1', q.params.target === 1), circle(b, radius, '2', q.params.target === 2));
      links.push({ type: 'rope', id: 'a', from: point(a, q.ropes[0].angle, radius), to: point(a, q.ropes[0].angle, reach(a, q.ropes[0].angle, l)), fixed: true, label: 'a' });
      links.push({ type: 'rope', id: 'b', from: point(a, q.ropes[1].angle, radius), to: point(b, q.ropes[1].angle + 180, radius), label: 'b' });
      links.push({ type: 'rope', id: 'c', from: point(b, q.ropes[2].angle, radius), to: point(b, q.ropes[2].angle, reach(b, q.ropes[2].angle, l)), fixed: true, label: 'c' });
    }
    return { bodies, links, walls, surfaces };
  }
  function springPath(from, to, compressed, scale) {
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
    const lead = Math.min(8 * scale, length * .12), amplitude = Math.min(5 * scale, length * .10);
    const turns = Math.max(3, Math.min(compressed ? 9 : 7, Math.floor(length / (compressed ? 5 : 12))));
    let path = `M${xy(from)} L${xy({ x: from.x + ux * lead, y: from.y + uy * lead })}`;
    for (let i = 1; i <= turns * 16; i++) {
      const t = i / (turns * 16), d = lead + t * (length - lead * 2), n = Math.sin(t * turns * 2 * Math.PI) * amplitude;
      path += ` L${xy({ x: from.x + ux * d - uy * n, y: from.y + uy * d + ux * n })}`;
    }
    return `${path} L${xy(to)}`;
  }
  function sceneMarkup(q, l) {
    const { width: w, height: h, displayScale: scale } = l, scene = geometry(q, l), obstacles = [];
    let html = `<rect width="${w}" height="${h}" fill="#fff"/>`;
    for (const surface of scene.surfaces) {
      const span = w + h, { foot, tilt, rough } = surface;
      html += `<g class="scene-surface" transform="translate(${foot.x} ${foot.y}) rotate(${-tilt})"><rect x="${-span}" y="0" width="${span * 2}" height="${span}" fill="${rough ? '#f2eee6' : '#edf4f7'}"/>`;
      html += `<g data-background="ground">`;
      if (rough) for (let x = -span - 144; x < span + 144; x += 18) html += line({ x, y: 5 }, { x: x - 6, y: 13 }, 'stroke="#c7c3b8" stroke-width="1.4"');
      if (q.motion) for (let x = Math.floor(-span / 144) * 144 - 144; x < span + 144; x += 144)
        html += `<path d="M${x},${20 * scale}h100l${-18 * scale},${26 * scale}h-100Z" fill="#e5dfd4" stroke="#d3cbbb" stroke-width="1"/>`;
      html += `</g><line x1="${-span}" x2="${span}" y1="0" y2="0" stroke="#64748b" stroke-width="2.5"/></g>`;
    }
    for (const wall of scene.walls) {
      const x = wall.sign === 1 ? wall.x - 10 * scale : wall.x;
      html += `<rect class="scene-wall" x="${x}" y="${wall.top}" width="${10 * scale}" height="${wall.bottom - wall.top}" fill="#c9b18c"/><line x1="${wall.x}" x2="${wall.x}" y1="${wall.top}" y2="${wall.bottom}" stroke="#8a7759" stroke-width="2"/>`;
      obstacles.push({ x, y: wall.top, width: 10 * scale, height: wall.bottom - wall.top });
    }
    for (const link of scene.links) {
      const attrs = `data-link="${link.id}"`;
      if (link.type === 'spring') html += `<path class="scene-spring" ${attrs} data-state="${link.state}" d="${springPath(link.from, link.to, link.state === 'compressed', scale)}" fill="none" stroke="#64748b" stroke-width="${2 * scale}" stroke-linejoin="round"/>`;
      else html += line(link.from, link.to, `${attrs} class="scene-${link.type}" stroke="${link.type === 'rod' ? '#94a3b8' : '#8a7759'}" stroke-width="${(link.type === 'rod' ? 6 : 2.5) * scale}" stroke-linecap="round"`);
      if (link.fixed) {
        const angle = Math.atan2(link.to.y - link.from.y, link.to.x - link.from.x) * 180 / Math.PI;
        html += `<g transform="translate(${link.to.x} ${link.to.y}) rotate(${angle})"><path d="M0,${-10 * scale}v${20 * scale}m0,${-16 * scale}l${6 * scale},${4 * scale}m${-6 * scale},${3 * scale}l${6 * scale},${4 * scale}m${-6 * scale},${3 * scale}l${6 * scale},${4 * scale}" fill="none" stroke="#64748b" stroke-width="2"/></g>`;
      }
      if (link.label) {
        const p = { x: (link.from.x + link.to.x) / 2, y: (link.from.y + link.to.y) / 2 };
        const dx = link.to.x - link.from.x, dy = link.to.y - link.from.y, length = Math.hypot(dx, dy);
        p.x += dy / length * 12 * scale; p.y -= dx / length * 12 * scale;
        p.y = M.clamp(p.y, 51, h - 25);
        html += `<text class="rope-label math" x="${p.x}" y="${p.y}" text-anchor="middle" font-size="${15 * scale}" fill="#65543c" stroke="#fff" stroke-width="3" paint-order="stroke">${link.label}</text>`;
        obstacles.push({ x: p.x - 7 * scale, y: p.y - 14 * scale, width: 14 * scale, height: 16 * scale });
      }
    }
    let body;
    for (const object of scene.bodies) {
      const { center: c, target, label } = object, fill = target ? '#dbeafe' : '#e9e4dc', stroke = target ? '#476b96' : '#81786b';
      let bounds;
      if (object.shape === 'circle') {
        const r = object.radius;
        html += `<g class="object" data-body="${label || 'ball'}" data-target="${target}"><circle cx="${c.x}" cy="${c.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/><path d="M${c.x-r*.55},${c.y-r*.45}q${r*.3},${-r*.35} ${r*.8},${-r*.2}" fill="none" stroke="#fff" stroke-width="${2 * scale}" stroke-linecap="round"/></g>`;
        bounds = { x: c.x - r, y: c.y - r, width: r * 2, height: r * 2 };
      } else {
        const { width, height, tilt } = object, rotation = tilt * Math.PI / 180;
        html += `<g class="object" data-body="${label || 'block'}" data-target="${target}" transform="translate(${c.x} ${c.y}) rotate(${-tilt})"><rect x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/><path d="M${-width/2+7},${-height/2+6}h${width-14}" stroke="#fff" stroke-width="2"/></g>`;
        const widthBox = Math.abs(Math.cos(rotation)) * width + Math.abs(Math.sin(rotation)) * height;
        const heightBox = Math.abs(Math.sin(rotation)) * width + Math.abs(Math.cos(rotation)) * height;
        bounds = { x: c.x - widthBox / 2, y: c.y - heightBox / 2, width: widthBox, height: heightBox };
      }
      if (target) body = bounds; else obstacles.push(bounds);
      if (label) {
        const x = object.shape === 'circle' ? c.x + (label === '1' ? -1 : 1) * q.params.sign * (object.radius + 10 * scale) : c.x - object.width / 2 + 10 * scale;
        const y = object.shape === 'circle' ? c.y + 17 * scale : c.y - object.height / 2 - 9 * scale;
        html += `<text class="body-label" x="${x}" y="${y}" text-anchor="middle" font-family="system-ui" font-size="${14 * scale}" font-weight="${target ? 700 : 500}" fill="#334155" stroke="#fff" stroke-width="3" paint-order="stroke">${label}</text>`;
        obstacles.push({ x: x - 8 * scale, y: y - 14 * scale, width: 16 * scale, height: 16 * scale });
      }
    }
    html += `<circle class="center-mark" cx="${l.center.x}" cy="${l.center.y}" r="${3.5 * scale}" fill="#334155"/>`;
    return { html, body, obstacles, scene };
  }
  const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  function labelPositions(records, l, body, obstacles = []) {
    const scale = l.displayScale;
    const boxes = [], entries = records.map((r, i) => r[1] === null ? null : { record: r, i, end: M.endpoint(r, l), label: N.label(records, i) }).filter(Boolean);
    return entries.map(entry => {
      const u = unit(entry.record[1] / 10), n = { x: -u.y, y: u.x }, width = (entry.label.sub ? 27 : 19) * scale, height = 21 * scale;
      const options = [];
      for (const side of [1, -1]) for (const offset of [15, 28, 42]) for (const along of [9, -12]) {
        const x = M.clamp(entry.end.x + n.x * offset * side * scale + u.x * along * scale - width / 2, 6, l.width - width - 6);
        const y = M.clamp(entry.end.y + n.y * offset * side * scale + u.y * along * scale - height / 2, 43, l.height - height - 20);
        const b = { x, y, width, height };
        let penalty = (overlap(b, body) ? 200 : 0) + obstacles.filter(o => overlap(b, o)).length * 180 + boxes.filter(other => overlap(b, other)).length * 500 + offset;
        // Penalize labels covering any arrow shaft, not just another label.
        for (const arrow of entries) {
          for (let t = .25; t <= 1; t += .15) {
            const p = { x: l.center.x + (arrow.end.x - l.center.x) * t, y: l.center.y + (arrow.end.y - l.center.y) * t };
            if (p.x >= b.x - 3 && p.x <= b.x + b.width + 3 && p.y >= b.y - 3 && p.y <= b.y + b.height + 3) penalty += 55;
          }
        }
        options.push({ b, penalty });
      }
      options.sort((a, b) => a.penalty - b.penalty); boxes.push(options[0].b);
      return { ...entry, box: options[0].b };
    });
  }
  function render(svg, q, l, records, selected = -1, guideAngle = null) {
    const scale = l.displayScale;
    svg.setAttribute("viewBox", `0 0 ${l.width} ${l.height}`);
    const base = sceneMarkup(q, l);
    let html = base.html;
    if (guideAngle !== null) html += line(point(l.center, guideAngle, -55 * scale), point(l.center, guideAngle, 95 * scale), 'stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 4"');
    const positions = labelPositions(records, l, base.body, base.obstacles);
    html += '<g class="student-arrows">';
    const arrowOrder = positions.slice().sort((a, b) => (a.i === selected ? 1 : 0) - (b.i === selected ? 1 : 0) || records[b.i][2] - records[a.i][2]);
    for (const { i, end, label } of arrowOrder) html += `<path data-arrow="${i}" d="${arrowPath(l.center, end, scale)}" fill="${label.color}" opacity="${selected === -1 || selected === i ? 1 : .82}"/><circle cx="${end.x}" cy="${end.y}" r="${2.5 * scale}" fill="#fff" stroke="${label.color}"/>`;
    html += "</g><g class=\"force-labels\">";
    for (const { box, label } of positions) html += `<text class="force-label" x="${box.x + box.width / 2}" y="${box.y + 16 * scale}" text-anchor="middle" font-size="${18 * scale}" fill="${label.color}" stroke="#fff" stroke-width="${4 * scale}" paint-order="stroke" stroke-linejoin="round">${label.symbol}${label.sub ? `<tspan font-size="${12 * scale}" dy="${4 * scale}" font-style="normal">${label.sub}</tspan>` : ""}</text>`;
    svg.innerHTML = html + "</g>";
  }
  function animate(svg, elapsed, question) {
    const ground = svg.querySelector('[data-background="ground"]');
    if (ground) ground.setAttribute("transform", `translate(${M.backgroundOffset(elapsed, question.motion * question.params.sign)} 0)`);
  }
  return Object.freeze({ arrowPath, geometry, springPath, sceneMarkup, labelPositions, render, animate, unit, point });
});
