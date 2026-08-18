// ============================================================
// OpenEAU – carte utilisant des fichiers JSON pré-calculés
// ============================================================

const DATA_BASE = './data';

const MAP = L.map('map', {
  zoomControl: true,
  preferCanvas: true
}).setView([46.5, 2.5], 6);

L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
      '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
    detectRetina: true
  }
).addTo(MAP);

const stationLayer = L.layerGroup().addTo(MAP);

let mergedData = [];
let markerEntries = [];

let currentDept = 'all';
let currentRiver = 'all';

const ZOOM_IMPORTANCE = [
  { minZoom: 0, maxImportance: 1 },
  { minZoom: 7, maxImportance: 2 },
  { minZoom: 9, maxImportance: 3 },
  { minZoom: 11, maxImportance: 4 }
];

function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(value, decimals = 2) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return 'N/A';
  }

  return Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatDate(date) {
  if (!date) return 'N/A';

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return 'N/A';

  return d.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function relativeTime(date) {
  if (!date) return '';

  const timestamp = new Date(date).getTime();

  if (!Number.isFinite(timestamp)) return '';

  const minutes = Math.round(
    (Date.now() - timestamp) / 60000
  );

  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `il y a ${hours} h`;

  return `il y a ${Math.round(hours / 24)} j`;
}

function getLevelColor(level) {
  switch (level) {
    case 'very-low': return '#2563eb';
    case 'low': return '#60a5fa';
    case 'normal': return '#22c55e';
    case 'high': return '#f59e0b';
    case 'very-high': return '#ef4444';
    default: return '#64748b';
  }
}

function getLevelLabel(level) {
  switch (level) {
    case 'very-low': return 'Très bas';
    case 'low': return 'Bas';
    case 'normal': return 'Normal';
    case 'high': return 'Élevé';
    case 'very-high': return 'Très élevé';
    default: return 'Donnée indisponible';
  }
}

function visibleMaxImportance(zoom) {
  let maxImportance = 1;

  for (const rule of ZOOM_IMPORTANCE) {
    if (zoom >= rule.minZoom) {
      maxImportance = rule.maxImportance;
    }
  }

  return maxImportance;
}

function filteredAllStations() {
  return mergedData.filter(item => {
    const deptOk =
      currentDept === 'all' ||
      item.department === currentDept;

    const riverOk =
      currentRiver === 'all' ||
      item.river === currentRiver;

    return deptOk && riverOk;
  });
}

function visibleStations() {
  const maxImportance =
    visibleMaxImportance(MAP.getZoom());

  return filteredAllStations()
    .filter(item =>
      item.importance <= maxImportance
    );
}

function markerRadius(item, zoom) {
  if (zoom <= 6) {
    return item.importance === 1 ? 3.5 : 2.2;
  }

  if (zoom <= 8) {
    return item.importance === 1 ? 5 : 3.5;
  }

  if (zoom <= 10) {
    return item.importance <= 2 ? 6 : 4.5;
  }

  if (item.importance === 1) return 8;
  if (item.importance === 2) return 6.5;

  return 5;
}

function refreshMarkerSizes() {
  const zoom = MAP.getZoom();

  markerEntries.forEach(entry => {
    entry.marker.setRadius(
      markerRadius(entry.item, zoom)
    );
  });
}

function buildQuickPopup(item) {
  const color =
    getLevelColor(item.level);

  return `
    <div style="min-width:235px;font-family:Inter,sans-serif">

      <div style="
        font-size:14px;
        font-weight:700;
        line-height:1.25;
        margin-bottom:4px;
      ">
        ${escapeHTML(item.name)}
      </div>

      <div style="
        font-size:11px;
        color:#94a3b8;
        margin-bottom:8px;
      ">
        ${escapeHTML(item.river || '')}
        ${item.city ? ` · ${escapeHTML(item.city)}` : ''}
      </div>

      <div style="
        color:${color};
        font-size:11px;
        font-weight:700;
        margin-bottom:8px;
      ">
        ${getLevelLabel(item.level)}
      </div>

      <div style="
        font-size:11px;
        line-height:1.7;
      ">
        <b>Hauteur :</b>
        ${
          Number.isFinite(item.height_m)
            ? `${formatNumber(item.height_m)} m`
            : 'N/A'
        }

        <br>

        <b>Altitude de l'eau :</b>
        ${
          Number.isFinite(item.water_level_m_ngf)
            ? `${formatNumber(item.water_level_m_ngf)} m NGF`
            : 'N/A'
        }
        <br>

        <b>Débit :</b>
        ${
          Number.isFinite(item.flow_m3s)
            ? `${formatNumber(item.flow_m3s)} m³/s`
            : 'N/A'
        }
      </div>

      <div style="
        font-size:9px;
        color:#64748b;
        margin-top:7px;
      ">
        ${
          item.observed_at
            ? `${formatDate(item.observed_at)} · ${relativeTime(item.observed_at)}`
            : 'Aucune mesure actuelle'
        }
      </div>

      <button
        type="button"
        class="open-details-btn"
        style="
          width:100%;
          margin-top:10px;
          padding:7px;
          border:0;
          border-radius:6px;
          background:#38bdf8;
          color:#0f172a;
          font-size:11px;
          font-weight:700;
          cursor:pointer;
        "
      >
        Voir l'évolution
      </button>
    </div>
  `;
}

function renderMap() {
  stationLayer.clearLayers();
  markerEntries = [];

  const visible = visibleStations();
  const allFiltered = filteredAllStations();

  document.getElementById('count').textContent =
    `${visible.length} / ${allFiltered.length}`;

  const zoom = MAP.getZoom();

  visible.forEach(item => {
    const marker =
      L.circleMarker(
        [item.lat, item.lon],
        {
          radius: markerRadius(item, zoom),
          color: '#ffffff',
          weight: 1,
          fillColor: getLevelColor(item.level),
          fillOpacity: 0.9
        }
      ).addTo(stationLayer);

    marker.bindPopup(
      buildQuickPopup(item),
      {
        maxWidth: 320,
        autoPan: true
      }
    );

    marker.on('popupopen', event => {
      const button =
        event.popup
          .getElement()
          ?.querySelector(
            '.open-details-btn'
          );

      if (button) {
        button.onclick = clickEvent => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();

          openStationDetails(item);
        };
      }
    });

    markerEntries.push({
      item,
      marker
    });
  });
}

async function fetchJSON(url) {
  const response =
    await fetch(
      `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`,
      {
        cache: 'no-store'
      }
    );

  if (!response.ok) {
    throw new Error(
      `${response.status} – ${url}`
    );
  }

  return response.json();
}

function populateFilters() {
  const departments = new Set();
  const rivers = new Set();

  mergedData.forEach(item => {
    if (item.department) {
      departments.add(item.department);
    }

    if (item.river) {
      rivers.add(item.river);
    }
  });

  const departmentSelect =
    document.getElementById(
      'dept-select'
    );

  const riverSelect =
    document.getElementById(
      'river-select'
    );

  departmentSelect.innerHTML =
    '<option value="all">Tous les départements</option>';

  [...departments]
    .sort((a, b) =>
      a.localeCompare(b, 'fr')
    )
    .forEach(value => {
      const option =
        document.createElement('option');

      option.value = value;
      option.textContent = value;

      departmentSelect.appendChild(
        option
      );
    });

  riverSelect.innerHTML =
    '<option value="all">Tous les cours d\'eau</option>';

  [...rivers]
    .sort((a, b) =>
      a.localeCompare(b, 'fr')
    )
    .forEach(value => {
      const option =
        document.createElement('option');

      option.value = value;
      option.textContent = value;

      riverSelect.appendChild(
        option
      );
    });
}

function showError(message) {
  const box =
    document.getElementById('error');

  box.textContent = message;
  box.style.display = 'block';
}

function hideError() {
  document.getElementById(
    'error'
  ).style.display = 'none';
}

async function loadData() {
  try {
    hideError();

    document.getElementById(
      'last-updated'
    ).textContent =
      'Chargement…';

    const [stationsJson, liveJson] =
      await Promise.all([
        fetchJSON(
          `${DATA_BASE}/stations.json`
        ),
        fetchJSON(
          `${DATA_BASE}/live.json`
        )
      ]);

    const liveByCode =
      new Map(
        (liveJson.stations || [])
          .map(item => [
            item.code,
            item
          ])
      );

    mergedData =
      (stationsJson.stations || [])
        .map(station => {
          const live =
            liveByCode.get(
              station.code
            ) || {};

          return {
            code:
              station.code,

            siteCode:
              station.site_code ||
              station.code,

            name:
              station.name,

            river:
              station.river,

            city:
              station.city,

            department:
              station.department,

            lat:
              Number(station.lat),

            lon:
              Number(station.lon),

            importance:
              Number(
                station.importance || 3
              ),

            zeroScaleM:
              Number.isFinite(
                Number(station.zero_scale_m)
              )
                ? Number(station.zero_scale_m)
                : null,

            zeroScaleDatum:
              station.zero_scale_datum ||
              null,

            height_m:
              Number.isFinite(
                Number(live.height_m)
              )
                ? Number(live.height_m)
                : null,

            flow_m3s:
              Number.isFinite(
                Number(live.flow_m3s)
              )
                ? Number(live.flow_m3s)
                : null,

            level:
              live.level ||
              'unknown',

            ratio:
              Number.isFinite(
                Number(live.ratio)
              )
                ? Number(live.ratio)
                : null,

            normal_m3s:
              Number.isFinite(
                Number(live.normal_m3s)
              )
                ? Number(live.normal_m3s)
                : null,

            water_level_m_ngf:
              Number.isFinite(
                Number(live.water_level_m_ngf)
              )
                ? Number(live.water_level_m_ngf)
                : null,

            observed_at:
              live.observed_at ||
              null
          };
        });

    populateFilters();
    renderMap();

    document.getElementById(
      'last-updated'
    ).textContent =
      liveJson.updated
        ? `Données : ${formatDate(liveJson.updated)} (${relativeTime(liveJson.updated)})`
        : 'Données chargées';

  } catch (error) {
    console.error(error);

    showError(
      'Les données préparées sont indisponibles. ' +
      'Lance le workflow « Mise à jour des données OpenEAU » dans GitHub Actions.'
    );

    document.getElementById(
      'last-updated'
    ).textContent =
      'Erreur';
  }
}

// ------------------------------------------------------------
// HISTORIQUES PRÉ-CALCULÉS PAR GITHUB ACTIONS
// ------------------------------------------------------------

async function loadStationHistory(code) {
  const response = await fetch(
    `${DATA_BASE}/history/${encodeURIComponent(code)}.json?v=${Date.now()}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error(`Historique indisponible (${response.status})`);
  }

  return response.json();
}

// ------------------------------------------------------------
// DOWNSAMPLING
// ------------------------------------------------------------

function downsample(data, maxPoints = 500) {
  if (!Array.isArray(data) || data.length <= maxPoints) {
    return Array.isArray(data) ? data : [];
  }

  const step = data.length / maxPoints;
  const result = [];

  for (let i = 0; i < maxPoints; i++) {
    result.push(data[Math.floor(i * step)]);
  }

  return result;
}


// ------------------------------------------------------------
// GRAPHIQUE
// ------------------------------------------------------------

function drawChart(
  holder,
  data,
  unit,
  color,
  title
) {
  if (!data.length) {
    holder.innerHTML = `
      <div style="
        padding:25px;
        color:#94a3b8;
        text-align:center;
        font-size:11px;
      ">
        Aucune donnée sur cette période.
      </div>
    `;
    return null;
  }

  const width = 500;
  const height = 230;

  const left = 48;
  const right = 16;
  const top = 24;
  const bottom = 34;

  const plotWidth =
    width -
    left -
    right;

  const plotHeight =
    height -
    top -
    bottom;

  const values =
    data.map(
      point =>
        point.value
    );

  let min =
    Math.min(...values);

  let max =
    Math.max(...values);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const startTime =
    new Date(
      data[0].date
    ).getTime();

  const endTime =
    new Date(
      data[data.length - 1].date
    ).getTime();

  const timeRange =
    Math.max(
      endTime -
      startTime,
      1
    );

  const points =
    downsample(
      data
    );

  const coords =
    points.map(
      point => {

        const pointTime =
          new Date(
            point.date
          ).getTime();

        return {
          ...point,

          x:
            left +
            (
              (
                pointTime -
                startTime
              ) /
              timeRange
            ) *
            plotWidth,

          y:
            top +
            (
              1 -
              (
                (
                  point.value -
                  min
                ) /
                (
                  max -
                  min
                )
              )
            ) *
            plotHeight

        };
      }
    );

  const polyline =
    coords
      .map(
        point =>
          `${point.x.toFixed(2)},${point.y.toFixed(2)}`
      )
      .join(' ');

  const area =
    [
      `${left},${height-bottom}`,
      ...coords.map(
        point =>
          `${point.x.toFixed(2)},${point.y.toFixed(2)}`
      ),
      `${left + plotWidth},${height-bottom}`
    ].join(' ');

  holder.innerHTML = `
    <div
      class="hydro-chart"
      style="
        position:relative;
        background:#08111f;
        border:1px solid rgba(255,255,255,.08);
        border-radius:10px;
        padding:10px 10px 5px;
        touch-action:none;
      "
    >

      <div style="
        display:flex;
        justify-content:space-between;
        gap:8px;
        margin-bottom:4px;
        color:#94a3b8;
        font-size:10px;
      ">
        <span>${escapeHTML(title)}</span>
        <span>Survolez la courbe</span>
      </div>

      <div
        class="chart-tooltip"
        style="
          display:none;
          position:absolute;
          z-index:10;
          pointer-events:none;
          background:rgba(15,23,42,.97);
          border:1px solid rgba(255,255,255,.12);
          border-radius:7px;
          padding:7px 9px;
          color:#e2e8f0;
          font-size:10px;
          white-space:nowrap;
          box-shadow:0 8px 24px rgba(0,0,0,.35);
        "
      ></div>

      <svg
        class="hydro-svg"
        viewBox="0 0 ${width} ${height}"
        width="100%"
        height="230"
        style="display:block;cursor:crosshair"
      >
        <line
          x1="${left}"
          y1="${top}"
          x2="${left}"
          y2="${height-bottom}"
          stroke="rgba(255,255,255,.12)"
        />

        <line
          x1="${left}"
          y1="${height-bottom}"
          x2="${left+plotWidth}"
          y2="${height-bottom}"
          stroke="rgba(255,255,255,.12)"
        />

        <polygon
          points="${area}"
          fill="${color}"
          fill-opacity=".10"
        />

        <polyline
          points="${polyline}"
          fill="none"
          stroke="${color}"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <line
          class="chart-hover-line"
          x1="${left}"
          y1="${top}"
          x2="${left}"
          y2="${height-bottom}"
          stroke="rgba(255,255,255,.4)"
          stroke-dasharray="4 4"
          style="display:none"
        />

        <circle
          class="chart-hover-point"
          cx="${left}"
          cy="${top}"
          r="4"
          fill="${color}"
          stroke="#ffffff"
          stroke-width="2"
          style="display:none"
        />

        <text
          x="${left-8}"
          y="${top+4}"
          fill="#64748b"
          font-size="10"
          text-anchor="end"
        >
          ${formatNumber(max)}
        </text>

        <text
          x="${left-8}"
          y="${height-bottom+4}"
          fill="#64748b"
          font-size="10"
          text-anchor="end"
        >
          ${formatNumber(min)}
        </text>

        <text
          x="${left}"
          y="${height-7}"
          fill="#64748b"
          font-size="10"
        >
          ${escapeHTML(formatDate(data[0].date).slice(0,5))}
        </text>

        <text
          x="${left+plotWidth}"
          y="${height-7}"
          fill="#64748b"
          font-size="10"
          text-anchor="end"
        >
          ${escapeHTML(
            formatDate(
              data[data.length-1].date
            ).slice(0,5)
          )}
        </text>
      </svg>
    </div>
  `;

  const graph =
    holder.querySelector(
      '.hydro-chart'
    );

  const svg =
    graph.querySelector(
      '.hydro-svg'
    );

  const tooltip =
    graph.querySelector(
      '.chart-tooltip'
    );

  const hoverLine =
    graph.querySelector(
      '.chart-hover-line'
    );

  const hoverPoint =
    graph.querySelector(
      '.chart-hover-point'
    );

  function nearestPoint(svgX) {
    let nearest =
      coords[0];

    let best =
      Infinity;

    coords.forEach(
      point => {

        const distance =
          Math.abs(
            point.x -
            svgX
          );

        if (
          distance <
          best
        ) {

          best =
            distance;

          nearest =
            point;
        }
      }
    );

    return nearest;
  }

  svg.addEventListener(
    'mousemove',
    event => {

      const rect =
        svg.getBoundingClientRect();

      const x =
        (
          (
            event.clientX -
            rect.left
          ) /
          rect.width
        ) *
        width;

      if (
        x < left ||
        x > left +
          plotWidth
      ) {
        return;
      }

      const point =
        nearestPoint(x);

      hoverLine.setAttribute(
        'x1',
        point.x
      );

      hoverLine.setAttribute(
        'x2',
        point.x
      );

      hoverLine.style.display =
        'block';

      hoverPoint.setAttribute(
        'cx',
        point.x
      );

      hoverPoint.setAttribute(
        'cy',
        point.y
      );

      hoverPoint.style.display =
        'block';

      tooltip.innerHTML = `
        <div style="
          color:#94a3b8;
          margin-bottom:2px;
        ">
          ${escapeHTML(
            formatDate(
              point.date
            )
          )}
        </div>

        <strong style="
          font-size:13px;
        ">
          ${formatNumber(
            point.value
          )} ${escapeHTML(unit)}
        </strong>
      `;

      tooltip.style.display =
        'block';

      tooltip.style.left =
        `${Math.max(
          8,
          Math.min(
            event.clientX -
              graph.getBoundingClientRect().left +
              12,
            graph.clientWidth -
              tooltip.offsetWidth -
              8
          )
        )}px`;

      tooltip.style.top =
        '28px';
    }
  );

  svg.addEventListener(
    'mouseleave',
    () => {

      tooltip.style.display =
        'none';

      hoverLine.style.display =
        'none';

      hoverPoint.style.display =
        'none';
    }
  );

  return graph;
}

function filterDataToDays(data, days) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  if (!Number.isFinite(Number(days)) || Number(days) <= 0) {
    return data.slice();
  }

  const lastDate = new Date(data[data.length - 1].date).getTime();

  if (!Number.isFinite(lastDate)) {
    return data.slice();
  }

  const startDate =
    lastDate -
    Number(days) *
      24 *
      60 *
      60 *
      1000;

  return data.filter(point => {
    const pointDate = new Date(point.date).getTime();
    return Number.isFinite(pointDate) && pointDate >= startDate && pointDate <= lastDate;
  });
}

function renderChartControls(
  container,
  item,
  state
) {
  container.innerHTML = `
    <div style="
      display:flex;
      gap:5px;
      margin-bottom:4px;
    ">
      <button
        type="button"
        class="chart-type-btn"
        data-type="height"
        style="
          flex:1;
          border:1px solid ${
            state.type === 'height'
              ? 'rgba(56,189,248,.4)'
              : 'rgba(255,255,255,.08)'
          };
          background:${
            state.type === 'height'
              ? 'rgba(56,189,248,.12)'
              : 'rgba(255,255,255,.03)'
          };
          color:${
            state.type === 'height'
              ? '#7dd3fc'
              : '#94a3b8'
          };
          border-radius:6px;
          padding:6px;
          cursor:pointer;
          font-size:11px;
        "
      >
        Hauteur
      </button>

      <button
        type="button"
        class="chart-type-btn"
        data-type="flow"
        style="
          flex:1;
          border:1px solid ${
            state.type === 'flow'
              ? 'rgba(34,197,94,.4)'
              : 'rgba(255,255,255,.08)'
          };
          background:${
            state.type === 'flow'
              ? 'rgba(34,197,94,.12)'
              : 'rgba(255,255,255,.03)'
          };
          color:${
            state.type === 'flow'
              ? '#86efac'
              : '#94a3b8'
          };
          border-radius:6px;
          padding:6px;
          cursor:pointer;
          font-size:11px;
        "
      >
        Débit
      </button>
    </div>

    <div style="
      display:flex;
      gap:4px;
      margin:5px 0;
    ">
      ${
        [1,7,30,90,365]
          .filter(
            days =>
              days <=
              state.maxRangeDays
          )
          .map(
            days => `

              <button
                type="button"
                class="chart-range-btn"
                data-days="${days}"
                style="
                  flex:1;
                  border:1px solid ${
                    days ===
                    state.days
                      ? 'rgba(56,189,248,.45)'
                      : 'rgba(255,255,255,.08)'
                  };
                  background:${
                    days ===
                    state.days
                      ? 'rgba(56,189,248,.12)'
                      : 'rgba(255,255,255,.03)'
                  };
                  color:${
                    days ===
                    state.days
                      ? '#7dd3fc'
                      : '#94a3b8'
                  };
                  border-radius:5px;
                  padding:4px;
                  cursor:pointer;
                  font-size:10px;
                "
              >
                ${
                  days === 1
                    ? '1 j'
                    : days === 7
                      ? '7 j'
                      : days === 30
                        ? '30 j'
                        : days === 90
                          ? '3 mois'
                          : '1 an'
                }
              </button>
            `
          )
          .join('')
      }
    </div>

    <div id="chart-holder"></div>
  `;

  const holder =
    container.querySelector(
      '#chart-holder'
    );

  const source =
    state.type === 'height'
      ? state.heightHistory
      : state.flowHistory;

  const visible =
    filterDataToDays(
      source,
      state.days
    );

  drawChart(
    holder,
    visible,
    state.type === 'height'
      ? 'm'
      : 'm³/s',
    state.type === 'height'
      ? '#38bdf8'
      : '#22c55e',
    state.type === 'height'
      ? 'Évolution de la hauteur'
      : 'Évolution du débit'
  );

  container
    .querySelectorAll(
      '.chart-type-btn'
    )
    .forEach(
      button => {

        button.onclick = event => {

          event.preventDefault();
          event.stopPropagation();

          state.type =
            button.dataset.type;

          if (
            state.type === 'height'
          ) {

            state.maxRangeDays =
              30;

            state.days =
              Math.min(
                state.days,
                30
              );

          } else {

            state.maxRangeDays =
              365;

            state.days =
              Math.max(
                state.days,
                30
              );

          }

          renderChartControls(
            container,
            item,
            state
          );
        };
      }
    );

  container
    .querySelectorAll(
      '.chart-range-btn'
    )
    .forEach(
      button => {

        button.onclick = event => {

          event.preventDefault();
          event.stopPropagation();

          state.days =
            Number(
              button.dataset.days
            );

          renderChartControls(
            container,
            item,
            state
          );
        };
      }
    );

  const graph =
    holder.querySelector(
      '.hydro-chart'
    );

  if (graph) {

    graph.addEventListener(
      'wheel',
      event => {

        event.preventDefault();
        event.stopPropagation();

        const factor =
          event.deltaY < 0
            ? 0.65
            : 1.6;

        state.days =
          Math.max(
            1,
            Math.min(
              state.maxRangeDays,
              Math.round(
                state.days *
                factor
              )
            )
          );

        renderChartControls(
          container,
          item,
          state
        );

      },
      {
        passive: false
      }
    );
  }
}

async function openStationDetails(
  item
) {
  const popup =
    L.popup({
      maxWidth: 570,
      maxHeight: 720,
      closeButton: true,
      autoPan: true
    });

  popup
    .setLatLng(
      [
        item.lat,
        item.lon
      ]
    )
    .setContent(`
      <div style="
        width:430px;
        max-width:calc(100vw - 90px);
        padding:20px;
        text-align:center;
        font-family:Inter,sans-serif;
      ">
        <div style="
          font-size:17px;
          font-weight:700;
        ">
          ${escapeHTML(
            item.name
          )}
        </div>

        <div style="
          color:#94a3b8;
          font-size:11px;
          margin-top:6px;
        ">
          Chargement de l'historique…
        </div>
      </div>
    `)
    .openOn(MAP);

  try {
    const history =
      await loadStationHistory(
        item.code
      );

    const heightHistory =
      history.height || [];

    const flowHistory =
      history.flow || [];

    const state = {
      type: 'height',
      days: 30,
      maxRangeDays: 30,
      heightHistory,
      flowHistory
    };

    const content =
      `
        <div
          class="station-popup"
          style="
            width:540px;
            max-width:calc(100vw - 80px);
            font-family:Inter,sans-serif;
          "
        >

          <div style="
            display:flex;
            justify-content:space-between;
            gap:15px;
            align-items:flex-start;
            margin-bottom:14px;
          ">

            <div>

              <div style="
                font-size:18px;
                font-weight:700;
                line-height:1.2;
              ">
                ${escapeHTML(
                  item.name
                )}
              </div>

              <div style="
                margin-top:4px;
                color:#94a3b8;
                font-size:12px;
              ">
                ${escapeHTML(
                  item.river || ''
                )}
                ${
                  item.city
                    ? ` · ${escapeHTML(item.city)}`
                    : ''
                }
              </div>

            </div>

            <div style="
              background:${getLevelColor(
                item.level
              )};
              color:#0f172a;
              font-size:10px;
              font-weight:800;
              padding:5px 9px;
              border-radius:999px;
              white-space:nowrap;
            ">
              ${getLevelLabel(
                item.level
              )}
            </div>

          </div>

          <div style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:8px;
            margin-bottom:10px;
          ">

            <div style="
              background:rgba(56,189,248,.06);
              border:1px solid rgba(56,189,248,.12);
              border-radius:8px;
              padding:10px;
            ">
              <div style="
                color:#94a3b8;
                font-size:10px;
              ">
                Hauteur
              </div>

              <div style="
                font-size:18px;
                font-weight:700;
                margin-top:3px;
              ">
                ${
                  Number.isFinite(
                    item.height_m
                  )
                    ? `${formatNumber(
                        item.height_m
                      )} m`
                    : 'N/A'
                }
              </div>

              <div style="
                color:#64748b;
                font-size:9px;
                margin-top:3px;
              ">
                ${
                  item.observed_at
                    ? formatDate(
                        item.observed_at
                      )
                    : 'Aucune donnée'
                }
              </div>
            </div>

            <div style="
              background:rgba(34,197,94,.06);
              border:1px solid rgba(34,197,94,.12);
              border-radius:8px;
              padding:10px;
            ">
              <div style="
                color:#94a3b8;
                font-size:10px;
              ">
                Débit
              </div>

              <div style="
                font-size:18px;
                font-weight:700;
                margin-top:3px;
              ">
                ${
                  Number.isFinite(
                    item.flow_m3s
                  )
                    ? `${formatNumber(
                        item.flow_m3s
                      )} m³/s`
                    : 'N/A'
                }
              </div>

              <div style="
                color:#64748b;
                font-size:9px;
                margin-top:3px;
              ">
                ${
                  item.observed_at
                    ? formatDate(
                        item.observed_at
                      )
                    : 'Aucune donnée'
                }
              </div>
            </div>

          </div>

          ${
            Number.isFinite(item.zeroScaleM)
              ? `
                <div style="
                  background:rgba(255,255,255,.03);
                  border-radius:7px;
                  padding:9px 10px;
                  margin-bottom:8px;
                  color:#94a3b8;
                  font-size:10px;
                  line-height:1.55;
                ">
                  <div>
                    <strong style="color:#e2e8f0">
                      Cote du zéro d’échelle :
                    </strong>
                    ${formatNumber(item.zeroScaleM)} m
                    ${item.zeroScaleDatum ? `(${escapeHTML(item.zeroScaleDatum)})` : ''}
                  </div>
                  ${
                    Number.isFinite(item.water_level_m_ngf)
                      ? `
                        <div style="margin-top:2px">
                          <strong style="color:#e2e8f0">
                            Altitude de la surface de l’eau :
                          </strong>
                          ${formatNumber(item.water_level_m_ngf)} m
                          ${item.zeroScaleDatum ? escapeHTML(item.zeroScaleDatum) : 'NGF'}
                        </div>
                      `
                      : ''
                  }
                </div>
              `
              : ''
          }

          ${
            Number.isFinite(
              item.normal_m3s
            )
              ? `
                <div style="
                  background:rgba(255,255,255,.03);
                  border-radius:7px;
                  padding:8px 10px;
                  margin-bottom:9px;
                  font-size:10px;
                  color:#94a3b8;
                ">
                  Débit habituel du mois :
                  <strong style="color:#e2e8f0">
                    ${
                      formatNumber(
                        item.normal_m3s
                      )
                    } m³/s
                  </strong>
                </div>
              `
              : ''
          }

          <div id="chart-controls"></div>

          <details style="
            margin-top:12px;
          ">
            <summary style="
              cursor:pointer;
              color:#38bdf8;
              font-size:11px;
              padding:6px 0;
            ">
              Informations utiles sur la station
            </summary>

            <div style="
              margin-top:6px;
              font-size:11px;
              color:#cbd5e1;
              line-height:1.7;
            ">
              <div>
                <b>Cours d'eau :</b>
                ${escapeHTML(
                  item.river || 'N/A'
                )}
              </div>

              <div>
                <b>Commune :</b>
                ${escapeHTML(
                  item.city || 'N/A'
                )}
              </div>

              <div>
                <b>Département :</b>
                ${escapeHTML(
                  item.department || 'N/A'
                )}
              </div>

              <div>
                <b>Code station :</b>
                ${escapeHTML(
                  item.code
                )}
              </div>

              <div>
                <b>Latitude :</b>
                ${formatNumber(
                  item.lat,
                  5
                )}
              </div>

              <div>
                <b>Longitude :</b>
                ${formatNumber(
                  item.lon,
                  5
                )}
              </div>
            </div>
          </details>

        </div>
      `;

    popup.setContent(
      content
    );

    setTimeout(
      () => {

        const root =
          popup.getElement()
            ?.querySelector(
              '.station-popup'
            );

        const chartControls =
          root?.querySelector(
            '#chart-controls'
          );

        if (!chartControls) return;

        renderChartControls(
          chartControls,
          item,
          state
        );

      },
      20
    );

  } catch (error) {

    console.error(error);

    popup.setContent(`
      <div style="
        padding:20px;
        color:#fca5a5;
        font-family:Inter,sans-serif;
      ">
        <strong>
          Impossible de charger l'historique.
        </strong>

        <div style="
          margin-top:8px;
          color:#94a3b8;
          font-size:11px;
        ">
          ${escapeHTML(
            error.message
          )}
        </div>
      </div>
    `);
  }
}

document
  .getElementById('dept-select')
  .addEventListener(
    'change',
    event => {

      currentDept =
        event.target.value;

      renderMap();
    }
  );

document
  .getElementById('river-select')
  .addEventListener(
    'change',
    event => {

      currentRiver =
        event.target.value;

      renderMap();
    }
  );

MAP.on(
  'zoomend',
  () => {

    renderMap();
    refreshMarkerSizes();

  }
);

document
  .getElementById('refresh-btn')
  .addEventListener(
    'click',
    loadData
  );

loadData();
