const COLORS = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#4d7c0f", "#c2410c", "#0f766e"];

export function ensureMap(element) {
  if (!element) return { ok: false, error: "지도 칸을 찾지 못했습니다." };
  element.hidden = false;
  element.style.display = "block";
  element.style.height = "min(58vh, 520px)";
  element.style.minHeight = "280px";
  if (!window.L) return { ok: false, error: "지도를 불러오지 못했습니다. 페이지를 새로고침해 주세요." };
  if (!element._leafletMap) {
    const map = window.L.map(element, { zoomControl: true }).setView([36.4, 127.8], 7);
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      detectRetina: false,
    }).addTo(map);
    element._leafletLayer = window.L.layerGroup().addTo(map);
    map.on("click", (event) => element._onPick?.(event.latlng.lat, event.latlng.lng));
    element._leafletMap = map;
  }
  const map = element._leafletMap;
  requestAnimationFrame(() => {
    map.invalidateSize();
    requestAnimationFrame(() => map.invalidateSize());
  });
  return { ok: true, map };
}

export function onMapPick(element, onPick) {
  if (element) element._onPick = onPick;
}

export function drawMarkers(element, people, midpoint) {
  const map = element?._leafletMap;
  const layer = element?._leafletLayer;
  if (!map || !layer || !window.L) return;
  layer.clearLayers();
  const bounds = [];
  for (const person of people) {
    if (person.lat == null || person.lng == null) continue;
    bounds.push([person.lat, person.lng]);
    window.L.circleMarker([person.lat, person.lng], {
      radius: 9,
      color: "#111",
      weight: 2,
      fillColor: COLORS[person.seat % COLORS.length],
      fillOpacity: 0.95,
    }).bindTooltip(person.name, { permanent: true, direction: "top", className: "pin-tip" }).addTo(layer);
  }
  if (midpoint) {
    bounds.push([midpoint.lat, midpoint.lng]);
    window.L.circleMarker([midpoint.lat, midpoint.lng], {
      radius: 13,
      color: "#111",
      weight: 3,
      fillColor: "#fff",
      fillOpacity: 1,
    }).bindTooltip("중간지점", { permanent: true, direction: "bottom", className: "pin-tip" }).addTo(layer);
  }
  if (bounds.length === 1) map.setView(bounds[0], 15);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  requestAnimationFrame(() => map.invalidateSize());
}

export function showPlace(element, place, label) {
  const ready = ensureMap(element);
  if (!ready.ok) return ready;
  const map = element._leafletMap;
  const layer = element._leafletLayer;
  layer.clearLayers();
  window.L.circleMarker([place.lat, place.lng], {
    radius: 11,
    color: "#111",
    weight: 2,
    fillColor: "#fff",
    fillOpacity: 1,
  }).bindTooltip(label, { permanent: true, direction: "top", className: "pin-tip" }).addTo(layer);
  map.setView([place.lat, place.lng], 14);
  requestAnimationFrame(() => map.invalidateSize());
  return ready;
}
