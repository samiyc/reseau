/**
 * The map: an SVG of the grid, built once, then repainted from a view (web/view.js). It draws and listens; it decides
 * nothing. A branch is a wide transparent stroke (the target for the pointer), the visible line, an arrow for the
 * direction of the flow, and a label shown only when the line is heavily loaded or open.
 */

const NS = "http://www.w3.org/2000/svg";
/** Layout units (0 to 100) to the viewBox's (0 to 1000). */
const SCALE = 10;

function node(/** @type {string} */ name, /** @type {Record<string, string | number>} */ attributes, /** @type {Element} */ parent) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  parent.append(element);
  return element;
}

function branchShape(/** @type {Element} */ layer, /** @type {number[]} */ [x1, y1, x2, y2], /** @type {string} */ name) {
  const group = node("g", { class: "branch", tabindex: 0, role: "button", "aria-label": name }, layer);
  const ends = { x1, y1, x2, y2 };
  node("line", { ...ends, class: "hit" }, group);
  const line = node("line", { ...ends, class: "wire" }, group);
  const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const arrow = node("path", { d: "M -10 -8 L 10 0 L -10 8 Z", class: "arrow" }, group);
  const length = Math.hypot(x2 - x1, y2 - y1);
  const [nx, ny] = [-(y2 - y1) / length, (x2 - x1) / length];
  const label = node("text", { x: mx + 26 * nx, y: my + 26 * ny, class: "branch-label" }, group);
  return { group, line, arrow, label, at: `translate(${mx} ${my}) rotate(${angle})` };
}

function busShape(/** @type {Element} */ layer, /** @type {number[]} */ [x, y], /** @type {number} */ id) {
  const group = node("g", { class: "bus", tabindex: 0, "aria-label": `Nœud ${id}` }, layer);
  node("circle", { cx: x, cy: y, r: 17 }, group);
  node("text", { x, y, class: "bus-id" }, group).textContent = String(id);
  const production = node("text", { x: x + 24, y: y - 22, class: "production" }, group);
  return { group, production };
}

/**
 * Builds the map of `grid` in `svg`, at `layout`'s places. `on.branch(k)` is called on a click (or Enter) on branch k,
 * `on.hover(target, event)` when the pointer enters or leaves a branch or a bus (`target` null on leaving).
 */
export function createMap(/** @type {SVGSVGElement} */ svg, grid, /** @type {Record<number, number[]>} */ layout, on) {
  svg.setAttribute("viewBox", "0 0 1000 1000");
  const at = (/** @type {number} */ bus) => layout[grid.busId[bus]].map((value) => value * SCALE);
  const [wires, stations] = [node("g", {}, svg), node("g", {}, svg)];
  const branches = Array.from({ length: grid.branchCount }, (_, k) => {
    const name = `${grid.busId[grid.from[k]]}-${grid.busId[grid.to[k]]}`;
    const shape = branchShape(wires, [...at(grid.from[k]), ...at(grid.to[k])], `Ligne ${name}`);
    shape.group.addEventListener("click", () => on.branch(k));
    shape.group.addEventListener("keydown", (event) => event.key === "Enter" && on.branch(k));
    shape.group.addEventListener("pointermove", (event) => on.hover({ kind: "branch", index: k }, event));
    shape.group.addEventListener("pointerleave", () => on.hover(null));
    return shape;
  });
  const buses = Array.from({ length: grid.busCount }, (_, i) => {
    const shape = busShape(stations, at(i), grid.busId[i]);
    shape.group.addEventListener("pointermove", (event) => on.hover({ kind: "bus", index: i }, event));
    shape.group.addEventListener("pointerleave", () => on.hover(null));
    return shape;
  });
  return { branches, buses };
}

/** Repaints the map from a view: per branch its colour, width, state and label; per bus its production label. */
export function paintMap(map, view) {
  map.branches.forEach((shape, k) => {
    const branch = view.branches[k];
    shape.group.classList.toggle("open", branch.open);
    shape.group.classList.toggle("overloaded", branch.overloaded);
    shape.line.setAttribute("stroke", branch.color);
    shape.line.setAttribute("stroke-width", String(branch.width));
    shape.arrow.setAttribute("fill", branch.color);
    shape.arrow.setAttribute("transform", `${shape.at}${branch.reversed ? " rotate(180)" : ""}`);
    shape.arrow.classList.toggle("hidden", !branch.arrow);
    shape.label.textContent = branch.label;
  });
  map.buses.forEach((shape, i) => {
    shape.production.textContent = view.buses[i].production;
    shape.group.classList.toggle("short", view.buses[i].short);
  });
}
