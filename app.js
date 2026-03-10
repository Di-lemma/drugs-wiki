const state = {
  drugs: [],
  filtered: [],
  selectedSlug: null,
};

let sectionObserver;

const colors = {
  threshold: "#9ab9b1",
  light: "#79a89e",
  common: "#2f7d71",
  strong: "#b8833f",
  heavy: "#9c4f46",
  onset: "#8eb6ad",
  peak: "#2f7d71",
  offset: "#d1a267",
  after: "#8a7a68",
};

const els = {
  loading: document.getElementById("loading-state"),
  page: document.getElementById("drug-page"),
  list: document.getElementById("drug-list"),
  search: document.getElementById("drug-search"),
  drugCount: document.getElementById("drug-count"),
  resultCount: document.getElementById("result-count"),
  emptyState: document.getElementById("empty-state-template"),
};

async function init() {
  try {
    const raw =
      window.__DRUGS_DATA__ ??
      (await fetch("./drugs.json").then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      }));
    state.drugs = normalizeDrugs(raw);
    state.filtered = [...state.drugs];
    state.selectedSlug = getInitialSlug();
    if (!state.selectedSlug && state.drugs.length) {
      state.selectedSlug = state.drugs[0].slug;
    }
    bindEvents();
    renderList();
    renderPage();
    els.loading.hidden = true;
    els.page.hidden = false;
  } catch (error) {
    els.loading.textContent = `Failed to load drugs.json: ${error.message}`;
  }
}

function bindEvents() {
  els.search.addEventListener("input", () => {
    const query = els.search.value.trim().toLowerCase();
    state.filtered = state.drugs.filter((drug) => drug.searchable.includes(query));
    if (!state.filtered.some((drug) => drug.slug === state.selectedSlug)) {
      state.selectedSlug = state.filtered[0]?.slug ?? null;
    }
    renderList();
    renderPage();
  });

  window.addEventListener("hashchange", () => {
    const slug = getInitialSlug();
    if (!slug) {
      return;
    }
    state.selectedSlug = slug;
    renderList();
    renderPage();
  });
}

function normalizeDrugs(raw) {
  const items = Array.isArray(raw) ? raw : [raw];
  return items
    .filter((item) => item && typeof item === "object")
    .map((drug, index) => {
      const slug = slugify(drug.drug_name || `drug-${index + 1}`);
      const aliases = Array.isArray(drug.alternative_names) ? drug.alternative_names : [];
      const categories = Array.isArray(drug.categories) ? drug.categories : [];
      return {
        ...drug,
        slug,
        aliases,
        categories,
        searchable: [
          drug.drug_name,
          drug.chemical_class,
          drug.psychoactive_class,
          ...aliases,
          ...categories,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    })
    .sort((a, b) => (a.drug_name || "").localeCompare(b.drug_name || ""));
}

function renderList() {
  els.drugCount.textContent = `${state.drugs.length} entries`;
  els.resultCount.textContent = `${state.filtered.length} shown`;

  if (!state.filtered.length) {
    els.list.innerHTML = "";
    return;
  }

  els.list.innerHTML = state.filtered
    .map((drug) => {
      const subtitle = [drug.psychoactive_class, drug.chemical_class]
        .filter(Boolean)
        .slice(0, 1)
        .join(" · ");
      return `
        <a class="drug-link ${drug.slug === state.selectedSlug ? "active" : ""}" href="#${drug.slug}">
          <strong>${escapeHtml(drug.drug_name || "Untitled")}</strong>
          <span>${escapeHtml(subtitle || "Reference entry")}</span>
        </a>
      `;
    })
    .join("");
}

function renderPage() {
  if (!state.filtered.length || !state.selectedSlug) {
    els.page.innerHTML = els.emptyState.innerHTML;
    return;
  }

  const drug =
    state.drugs.find((entry) => entry.slug === state.selectedSlug) ||
    state.filtered[0] ||
    state.drugs[0];

  if (!drug) {
    els.page.innerHTML = els.emptyState.innerHTML;
    return;
  }

  if (drug.slug !== state.selectedSlug) {
    state.selectedSlug = drug.slug;
    window.location.hash = drug.slug;
  }

  const dosageRoutes = drug.dosages?.routes_of_administration || [];
  const durationCurves = Array.isArray(drug.duration_curves) ? drug.duration_curves : [];
  const interactions = drug.interactions || {};
  const citations = Array.isArray(drug.citations) ? drug.citations : [];
  const notes = splitNotes(drug.notes);

  els.page.innerHTML = `
    <section class="hero panel">
      <div class="hero-top">
        <div>
          <p class="eyebrow">${escapeHtml((drug.categories || []).join(" · ") || "Drug entry")}</p>
          <h2>${escapeHtml(drug.drug_name || "Untitled entry")}</h2>
          <p class="hero-summary">${escapeHtml(drug.addiction_potential || drug.notes || "No summary available.")}</p>
        </div>
        <div class="hero-actions">
          <a class="hero-prompt" href="https://psyai--e16719564.replit.app/" target="_blank" rel="noreferrer">
            <span class="hero-prompt-icon">◍</span>
            <span class="hero-prompt-copy">
              <strong>Have a question?</strong>
              <span>Ask PsyAI</span>
            </span>
          </a>
          ${
            drug.search_url
              ? `<a class="hero-link" href="${escapeAttr(drug.search_url)}" target="_blank" rel="noreferrer">Open source ↗</a>`
              : ""
          }
        </div>
      </div>

      <div class="chip-row">
        ${renderChips(drug.aliases)}
      </div>

      <div class="tag-row">
        ${renderTags(drug.categories)}
      </div>

      <div class="hero-metrics">
        ${metricCard("Chemical class", drug.chemical_class)}
        ${metricCard("Psychoactive class", drug.psychoactive_class)}
        ${metricCard("Half-life", drug.half_life)}
        ${metricCard("Total duration", drug.duration?.total_duration)}
      </div>
    </section>

    <section class="section-grid">
      <section class="section-card span-5">
        <h3><span class="section-icon">◌</span>Core Profile</h3>
        <dl class="inline-data">
          ${inlineRow("Onset", drug.duration?.onset)}
          ${inlineRow("Peak", drug.duration?.peak)}
          ${inlineRow("Offset", drug.duration?.offset)}
          ${inlineRow("After-effects", drug.duration?.after_effects)}
          ${inlineRow("Addiction potential", drug.addiction_potential)}
        </dl>
      </section>

      <section class="section-card span-7">
        <h3><span class="section-icon">✳</span>Subjective Effects</h3>
        ${renderEffectsCloud(drug.subjective_effects)}
      </section>

      <section class="section-card span-12">
        <h3><span class="section-icon">▦</span>Dosage By Route</h3>
        ${renderDosageTable(dosageRoutes)}
      </section>

      <section class="section-card span-8">
        <h3><span class="section-icon">∿</span>Duration Curves</h3>
        ${renderDurationChart(durationCurves)}
      </section>

      <section class="section-card section-card-summary span-4">
        <h3><span class="section-icon">◷</span>Timing Summary</h3>
        <dl class="inline-data">
          ${inlineRow("Total", drug.duration?.total_duration)}
          ${inlineRow("Onset", drug.duration?.onset)}
          ${inlineRow("Peak", drug.duration?.peak)}
          ${inlineRow("Offset", drug.duration?.offset)}
          ${inlineRow("After", drug.duration?.after_effects)}
        </dl>
      </section>

      <section class="section-card span-12">
        <h3><span class="section-icon">⌁</span>Duration Data</h3>
        ${renderDurationDetails(durationCurves)}
      </section>

      <section class="section-card span-6">
        <h3><span class="section-icon">⚑</span>Interactions</h3>
        ${renderInteractions(interactions)}
      </section>

      <section class="section-card span-6">
        <h3><span class="section-icon">✎</span>Notes</h3>
        ${renderNotes(notes)}
      </section>

      <section class="section-card span-12">
        <h3><span class="section-icon">⎘</span>Citations</h3>
        ${renderCitations(citations)}
      </section>
    </section>
  `;

  applyInViewTracking();
}

function metricCard(label, value) {
  return `
    <article class="metric-card">
      <h3>${escapeHtml(label)}</h3>
      <p>${escapeHtml(value || "Unknown")}</p>
    </article>
  `;
}

function inlineRow(label, value) {
  return `
    <div class="inline-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || "Unknown")}</dd>
    </div>
  `;
}

function renderChips(items = []) {
  const filtered = (items || []).filter(Boolean);
  if (!filtered.length) {
    return '<span class="chip">No alternative names listed</span>';
  }
  return filtered.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
}

function renderTags(items = []) {
  const filtered = (items || []).filter(Boolean);
  if (!filtered.length) {
    return '<span class="tag">uncategorized</span>';
  }
  return filtered.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("");
}

function renderEffectsCloud(items = []) {
  const filtered = (items || []).filter(Boolean);
  if (!filtered.length) {
    return '<div class="effects-cloud"><span class="effect-word size-2 tone-1">No subjective effects listed</span></div>';
  }

  return `
    <div class="effects-cloud">
      ${filtered
        .map((item, index) => {
          const weight = getEffectWeight(item, index, filtered.length);
          const tone = (index % 4) + 1;
          const position = (index % 3) + 1;
          const noise = getEffectNoise(item, index);
          return `<span class="effect-word size-${weight} tone-${tone} pos-${position}" style="--drift-x:${noise.x}px;--drift-y:${noise.y}px;--tilt:${noise.tilt}deg">${escapeHtml(item)}</span>`;
        })
        .join("")}
    </div>
  `;
}

function renderDosageTable(routes) {
  if (!routes.length) {
    return "<p>No dosage data available.</p>";
  }

  return `
    <div class="table-scroll">
    <table class="dosage-table">
      <thead>
        <tr>
          <th>Route</th>
          <th>Dose bands</th>
          <th>Scale</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${routes
          .map((route) => {
            const scale = buildDoseScale(route.dose_ranges || {}, route.units || "");
            return `
              <tr>
                <td><strong>${escapeHtml(route.route || "Unknown")}</strong><br /><span class="footer-note">${escapeHtml(route.units || "")}</span></td>
                <td>${renderDoseBands(route.dose_ranges || {}, route.units || "")}</td>
                <td>${scale}</td>
                <td>${escapeHtml(route.notes || "—")}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
    </div>
  `;
}

function renderDoseBands(ranges, units) {
  const order = ["threshold", "light", "common", "strong", "heavy"];
  return `
    <div class="dense-list">
      ${order
        .filter((key) => ranges[key])
        .map(
          (key) => `
            <div class="dense-list-item">
              <strong>${capitalize(key)}</strong>
              <div class="footer-note">${formatDoseLabel(String(ranges[key]), units)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function buildDoseScale(ranges, units) {
  const order = ["threshold", "light", "common", "strong", "heavy"];
  const parsed = order
    .map((key) => ({ key, ...parseRange(String(ranges[key] || "")) }))
    .filter((item) => Number.isFinite(item.start));

  if (!parsed.length) {
    return "<p class=\"footer-note\">No numeric range to chart.</p>";
  }

  const maxValue = parsed.reduce((max, item) => Math.max(max, item.end ?? item.start), 0);
  const fallbackSpan = Math.max(maxValue * 0.12, 1);
  const segments = parsed
    .map((item) => {
      const start = item.start;
      const rawEnd = item.end ?? item.start;
      const end = item.openEnded ? Math.max(rawEnd, maxValue + fallbackSpan) : rawEnd;
      const left = (start / (maxValue + fallbackSpan)) * 100;
      const width = (Math.max(end - start, 0.6) / (maxValue + fallbackSpan)) * 100;
      return `<span class="dose-segment" style="left:${left}%;width:${width}%;background:${colors[item.key]};"></span>`;
    })
    .join("");

  return `
    <div class="dose-scale">
      <div class="dose-track">${segments}</div>
      <div class="dose-labels">
        <span>0 ${escapeHtml(units)}</span>
        <span>${formatNumber(maxValue + fallbackSpan)} ${escapeHtml(units)}</span>
      </div>
    </div>
  `;
}

function renderDurationChart(curves) {
  if (!curves.length) {
    return "<p>No duration curve data available.</p>";
  }

  const prepared = curves
    .map((entry, index) => {
      const points = normalizeCurvePoints(buildCurvePoints(entry));
      if (points.length < 2) {
        return null;
      }
      return {
        entry,
        points,
        color: getRouteColor(index),
      };
    })
    .filter(Boolean);

  if (!prepared.length) {
    return "<p>No duration curve data available.</p>";
  }

  const maxHour = prepared.reduce((max, item) => Math.max(max, item.points[item.points.length - 1].t), 1);
  const units = getDurationUnits(prepared.map((item) => item.entry));
  const width = 760;
  const height = 320;
  const margin = { top: 18, right: 18, bottom: 40, left: 44 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const xScale = (value) => margin.left + (clamp(value, 0, maxHour) / maxHour) * chartWidth;
  const yScale = (value) => margin.top + (1 - clamp(value, 0, 1)) * chartHeight;

  const tickValues = buildXAxisTicks(maxHour);
  const verticalGridlines = tickValues
    .map((tick) => {
      const x = xScale(tick);
      return `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + chartHeight}" stroke="rgba(31, 26, 22, 0.1)" />`;
    })
    .join("");

  const horizontalGuides = [0, 0.5, 1]
    .map((tick) => {
      const y = yScale(tick);
      return `
        <line x1="${margin.left}" y1="${y}" x2="${margin.left + chartWidth}" y2="${y}" stroke="rgba(31, 26, 22, 0.08)" />
        <text x="${margin.left - 8}" y="${y + 3}" class="axis-label" text-anchor="end">${tick.toFixed(1)}</text>
      `;
    })
    .join("");

  const curvesSvg = prepared
    .map(({ entry, points, color }) => {
      const linePath = buildSmoothPath(points, xScale, yScale);
      const labelX = Math.min(xScale(points[points.length - 1].t) + 8, width - 18);
      const labelY = Math.max(yScale(points[points.length - 1].y) - 8, margin.top + 12);
      return `
        <path d="${linePath}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
        <circle cx="${xScale(points[0].t)}" cy="${yScale(points[0].y)}" r="2.25" fill="${color}"></circle>
        <circle cx="${xScale(points[points.length - 1].t)}" cy="${yScale(points[points.length - 1].y)}" r="2.25" fill="${color}"></circle>
        <text x="${labelX}" y="${labelY}" class="curve-label" fill="${color}">${escapeHtml(entry.method || "Route")}</text>
      `;
    })
    .join("");

  const tickLabels = tickValues
    .map((tick) => {
      const x = xScale(tick);
      return `<text x="${x}" y="${height - 10}" class="axis-label" text-anchor="middle">${formatTickLabel(tick, units)}</text>`;
    })
    .join("");

  const ariaMethods = prepared.map(({ entry }) => entry.method || "route").join(", ");

  return `
    <svg class="timeline-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Approximate subjective effect intensity over time by route of administration for ${escapeAttr(ariaMethods)}. Intensity is normalized from zero to one and is not a pharmacokinetic model.">
      <rect x="${margin.left}" y="${margin.top}" width="${chartWidth}" height="${chartHeight}" rx="12" fill="rgba(255, 255, 255, 0.48)" stroke="rgba(31, 26, 22, 0.05)" />
      ${verticalGridlines}
      ${horizontalGuides}
      <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${margin.left + chartWidth}" y2="${margin.top + chartHeight}" stroke="rgba(31, 26, 22, 0.18)" />
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="rgba(31, 26, 22, 0.18)" />
      ${curvesSvg}
      ${tickLabels}
      <text x="${margin.left + chartWidth / 2}" y="${height - 24}" class="axis-label" text-anchor="middle">${escapeHtml(`Time (${units})`)}</text>
      <text x="12" y="${margin.top + chartHeight / 2}" class="axis-label" text-anchor="middle" transform="rotate(-90 12 ${margin.top + chartHeight / 2})">Intensity</text>
    </svg>
  `;
}

function buildCurvePoints(entry) {
  const curve = entry.duration_curve || {};
  const onsetStart = finiteOrNull(curve.onset?.start);
  const onsetEndRaw = finiteOrNull(curve.onset?.end);
  const peakStartRaw = finiteOrNull(curve.peak?.start);
  const peakEndRaw = finiteOrNull(curve.peak?.end);
  const offsetStartRaw = finiteOrNull(curve.offset?.start);
  const offsetEndRaw = finiteOrNull(curve.offset?.end);
  const afterStartRaw = finiteOrNull(curve.after_effects?.start);
  const afterEndRaw = finiteOrNull(curve.after_effects?.end);

  const onsetEnd = maxDefined(onsetEndRaw, onsetStart);
  const peakStart = maxDefined(peakStartRaw, onsetEnd);
  const peakEnd = maxDefined(peakEndRaw, peakStart);
  const peakMid = midpoint(peakStart, peakEnd);
  const offsetStart = maxDefined(offsetStartRaw, peakEnd);
  const offsetEnd = maxDefined(offsetEndRaw, offsetStart);
  const afterStart = maxDefined(afterStartRaw, offsetEnd);
  const afterEnd = maxDefined(afterEndRaw, afterStart);
  const chartEnd = Math.max(
    afterEnd || 0,
    curve.total_duration?.max || 0,
    offsetEnd || 0,
    peakEnd || 0,
    onsetEnd || 0,
    1
  );

  return [
    { t: 0, y: 0 },
    { t: onsetStart, y: 0.05 },
    { t: onsetEnd, y: 0.45 },
    { t: peakMid, y: 1 },
    { t: peakEnd, y: 0.95 },
    { t: offsetStart, y: 0.75 },
    { t: offsetEnd, y: 0.3 },
    { t: afterStart, y: 0.18 },
    { t: afterEnd, y: 0.02 },
    { t: chartEnd, y: 0 },
  ].filter((point) => Number.isFinite(point.t));
}

function normalizeCurvePoints(points) {
  if (!points.length) {
    return [];
  }

  const sorted = points
    .map((point) => ({ t: Math.max(point.t, 0), y: clamp(point.y, 0, 1) }))
    .sort((a, b) => a.t - b.t || a.y - b.y);

  const chartEnd = Math.max(sorted[sorted.length - 1].t, 1);
  const minGap = Math.max(chartEnd * 0.015, 0.05);
  const merged = [];

  for (const point of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(point);
      continue;
    }

    if (Math.abs(point.t - last.t) < minGap * 0.35) {
      last.t = Math.max(last.t, point.t);
      last.y = Math.max(last.y, point.y);
      continue;
    }

    merged.push(point);
  }

  const normalized = [];

  merged.forEach((point, index) => {
    if (index === 0) {
      normalized.push({ ...point, t: 0 });
      return;
    }

    const previous = normalized[normalized.length - 1];
    normalized.push({
      t: Math.max(point.t, previous.t + minGap),
      y: point.y,
    });
  });

  normalized[normalized.length - 1].t = Math.max(normalized[normalized.length - 1].t, chartEnd);
  normalized[normalized.length - 1].y = 0;
  normalized[0].y = 0;

  const deduped = [];

  for (const point of normalized) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(last.t - point.t) < 1e-6) {
      last.y = Math.max(last.y, point.y);
      continue;
    }
    deduped.push({ ...point });
  }

  return deduped;
}

function buildSmoothPath(points, xScale, yScale) {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M ${xScale(points[0].t)} ${yScale(points[0].y)}`;
  }

  if (points.length === 2) {
    return `M ${xScale(points[0].t)} ${yScale(points[0].y)} L ${xScale(points[1].t)} ${yScale(points[1].y)}`;
  }

  const xs = points.map((point) => xScale(point.t));
  const ys = points.map((point) => yScale(point.y));
  const dx = new Array(points.length - 1);
  const dy = new Array(points.length - 1);
  const slopes = new Array(points.length - 1);

  for (let index = 0; index < points.length - 1; index += 1) {
    dx[index] = xs[index + 1] - xs[index];
    dy[index] = ys[index + 1] - ys[index];
    slopes[index] = dx[index] === 0 ? 0 : dy[index] / dx[index];
  }

  const tangents = new Array(points.length);
  tangents[0] = slopes[0];
  tangents[points.length - 1] = slopes[points.length - 2];

  for (let index = 1; index < points.length - 1; index += 1) {
    if (
      slopes[index - 1] === 0 ||
      slopes[index] === 0 ||
      Math.sign(slopes[index - 1]) !== Math.sign(slopes[index])
    ) {
      tangents[index] = 0;
      continue;
    }
    tangents[index] = (slopes[index - 1] + slopes[index]) / 2;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    if (slopes[index] === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }

    const a = tangents[index] / slopes[index];
    const b = tangents[index + 1] / slopes[index];
    const hypotenuse = Math.hypot(a, b);

    if (hypotenuse > 3) {
      const scale = 3 / hypotenuse;
      tangents[index] = scale * a * slopes[index];
      tangents[index + 1] = scale * b * slopes[index];
    }
  }

  let path = `M ${xs[0]} ${ys[0]}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const segmentWidth = xs[index + 1] - xs[index];
    const cp1x = xs[index] + segmentWidth / 3;
    const cp1y = ys[index] + (tangents[index] * segmentWidth) / 3;
    const cp2x = xs[index + 1] - segmentWidth / 3;
    const cp2y = ys[index + 1] - (tangents[index + 1] * segmentWidth) / 3;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${xs[index + 1]} ${ys[index + 1]}`;
  }

  return path;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function maxDefined(...values) {
  const nums = values.filter(Number.isFinite);
  return nums.length ? Math.max(...nums) : null;
}

function buildXAxisTicks(maxHour) {
  const tickCount = maxHour <= 3 ? Math.ceil(maxHour) + 1 : 6;
  const step = niceStep(maxHour / Math.max(tickCount - 1, 1));
  const ticks = [];

  for (let value = 0; value < maxHour; value += step) {
    ticks.push(Number(value.toFixed(2)));
  }

  if (ticks[ticks.length - 1] !== Number(maxHour.toFixed(2))) {
    ticks.push(Number(maxHour.toFixed(2)));
  }

  return ticks;
}

function niceStep(value) {
  if (value <= 0) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  const normalized = value / power;
  if (normalized <= 1) {
    return power;
  }
  if (normalized <= 2) {
    return 2 * power;
  }
  if (normalized <= 5) {
    return 5 * power;
  }
  return 10 * power;
}

function midpoint(start, end) {
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return (start + end) / 2;
  }
  return Number.isFinite(start) ? start : end;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTickLabel(value, units) {
  return `${formatNumber(value)}${units === "hours" ? "h" : ` ${units}`}`;
}

function getDurationUnits(entries) {
  const units = new Set(
    entries
      .map((entry) => String(entry.duration_curve?.units || "").trim())
      .filter(Boolean)
  );
  return units.size === 1 ? Array.from(units)[0] : "hours";
}

function getRouteColor(index) {
  const palette = ["#2f6f68", "#a97749", "#7d607d", "#55719a", "#7a7251", "#8d5c56"];
  return palette[index % palette.length];
}


function renderInteractions(interactions) {
  const groups = [
    { key: "dangerous", label: "Dangerous", className: "risk-danger" },
    { key: "unsafe", label: "Unsafe", className: "risk-unsafe" },
    { key: "caution", label: "Caution", className: "risk-caution" },
  ];

  return `
    <div class="risk-grid">
      ${groups
        .map((group) => {
          const items = interactions[group.key] || [];
          return `
            <section class="risk-card ${group.className}">
              <h4>${group.label}</h4>
              <div class="interaction-list">
                ${
                  items.length
                    ? items.map((item) => `<div class="interaction-item">${escapeHtml(item)}</div>`).join("")
                    : '<div class="interaction-item">No entries listed.</div>'
                }
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDurationDetails(curves = []) {
  if (!curves.length) {
    return "<p>No duration detail rows available.</p>";
  }

  return `
    <div class="table-scroll">
    <table class="duration-table">
      <thead>
        <tr>
          <th>Method</th>
          <th>Units</th>
          <th>Onset</th>
          <th>Peak</th>
          <th>Offset</th>
          <th>After</th>
          <th>Total</th>
          <th>Reference</th>
        </tr>
      </thead>
      <tbody>
        ${curves
          .map((entry) => {
            const curve = entry.duration_curve || {};
            return `
              <tr>
                <td>${escapeHtml(entry.method || "Unknown")}</td>
                <td>${escapeHtml(curve.units || "—")}</td>
                <td>${formatDurationSegment(curve.onset)}</td>
                <td>${formatDurationSegment(curve.peak)}</td>
                <td>${formatDurationSegment(curve.offset)}</td>
                <td>${formatDurationSegment(curve.after_effects)}</td>
                <td>${formatTotalDuration(curve.total_duration)}</td>
                <td class="table-reference" title="${escapeAttr(curve.reference || "—")}">${escapeHtml(curve.reference || "—")}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
    </div>
  `;
}

function renderNotes(notes) {
  if (!notes.length) {
    return "<p>No notes available.</p>";
  }
  return `
    <div class="paragraph-list">
      ${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}
    </div>
  `;
}

function renderCitations(citations) {
  if (!citations.length) {
    return "<p>No citations listed.</p>";
  }
  return `
    <div class="citation-list">
      ${citations
        .map(
          (citation) => `
            <div class="citation-item">
              <a href="${escapeAttr(citation.reference || "#")}" target="_blank" rel="noreferrer">
                ${escapeHtml(citation.name || citation.reference || "Reference")}
              </a>
              <div class="footer-note mono">${escapeHtml(citation.reference || "")}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function splitNotes(notes) {
  return String(notes || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseRange(value) {
  const numbers = String(value).match(/\d+(\.\d+)?/g)?.map(Number) || [];
  const openEnded = /[+>]/.test(String(value));
  if (!numbers.length) {
    return { start: null, end: null, openEnded: false };
  }
  if (numbers.length === 1) {
    return { start: numbers[0], end: numbers[0], openEnded };
  }
  return {
    start: Math.min(...numbers),
    end: Math.max(...numbers),
    openEnded,
  };
}

function formatDoseLabel(value, units) {
  const normalized = String(value || "");
  if (!units || normalized.toLowerCase().includes(String(units).toLowerCase())) {
    return escapeHtml(normalized);
  }
  return `${escapeHtml(normalized)} ${escapeHtml(units)}`;
}

function formatDurationSegment(segment) {
  if (!segment) {
    return "—";
  }
  const numeric = Number.isFinite(segment.start) && Number.isFinite(segment.end)
    ? `${formatNumber(segment.start)}-${formatNumber(segment.end)}`
    : "—";
  const iso = [segment.iso_start?.join(", "), segment.iso_end?.join(", ")].filter(Boolean).join(" to ");
  return escapeHtml(iso ? `${numeric} h (${iso})` : `${numeric} h`);
}

function formatTotalDuration(segment) {
  if (!segment) {
    return "—";
  }
  const numeric = Number.isFinite(segment.min) && Number.isFinite(segment.max)
    ? `${formatNumber(segment.min)}-${formatNumber(segment.max)} h`
    : "—";
  const iso = Array.isArray(segment.iso) ? segment.iso.join(", ") : "";
  const note = segment.note ? `; ${segment.note}` : "";
  return escapeHtml([numeric, iso].filter(Boolean).join(" | ") + note);
}

function legend(label, color) {
  return `<span class="legend-key" style="--legend-color:${color}">${escapeHtml(label)}</span>`;
}

function formatConfidence(value) {
  return Number.isFinite(value) ? `${value}% conf.` : "";
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getInitialSlug() {
  return decodeURIComponent(window.location.hash.replace(/^#/, "").trim());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function getEffectWeight(value, index, total) {
  const length = String(value).length;
  if (length <= 16 && index % 5 === 0) {
    return 4;
  }
  if (length <= 22 && (index % 3 === 0 || total <= 5)) {
    return 3;
  }
  if (length >= 34) {
    return 1;
  }
  return 2;
}

function getEffectNoise(value, index) {
  const seed = Array.from(String(value)).reduce(
    (sum, char, charIndex) => sum + char.charCodeAt(0) * (charIndex + 3),
    index * 17 + 11
  );
  const x = ((seed % 23) - 11) * 1.4;
  const y = ((Math.floor(seed / 7) % 17) - 8) * 1.5;
  const tilt = ((Math.floor(seed / 13) % 11) - 5) * 1.1;
  return { x: Math.round(x), y: Math.round(y), tilt: tilt.toFixed(1) };
}

function applyInViewTracking() {
  if (sectionObserver) {
    sectionObserver.disconnect();
  }

  const cards = Array.from(
    els.page.querySelectorAll(".hero, .section-card, .metric-card")
  );

  if (!cards.length || typeof IntersectionObserver === "undefined") {
    return;
  }

  sectionObserver = new IntersectionObserver(handleSectionIntersect, {
    root: null,
    rootMargin: "-18% 0px -42% 0px",
    threshold: [0.2, 0.4, 0.6],
  });

  cards.forEach((card) => sectionObserver.observe(card));
}

function handleSectionIntersect(entries) {
  const visibleEntries = entries.filter((entry) => entry.isIntersecting);
  const cards = Array.from(
    els.page.querySelectorAll(".hero, .section-card, .metric-card")
  );

  cards.forEach((card) => card.classList.remove("in-view"));

  if (!visibleEntries.length) {
    return;
  }

  const bestEntry = visibleEntries.reduce((best, current) => {
    if (!best) {
      return current;
    }
    return current.intersectionRatio > best.intersectionRatio ? current : best;
  }, null);

  bestEntry?.target.classList.add("in-view");
}

init();
