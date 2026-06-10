/* Dashboard "Vers van de pers": leest data/publicaties.json en tekent
 * overzichten van het NRC-publicatieritme met Plotly. Alle tijden komen als
 * ISO-strings met Nederlandse offset binnen; uren worden uit de string zelf
 * gelezen zodat het dashboard in elke tijdzone hetzelfde toont. */

const WEEKDAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const ACCENT = "#d30f1d";
const INKT = "#1a1a1a";
const DESK_KLEUREN = [
  "#1a1a1a", "#d30f1d", "#3a6ea5", "#c89933", "#5b8c5a",
  "#8c5b7f", "#c2703d", "#7a7a7a", "#4db3b3",
];

const PLOT_CONFIG = { displayModeBar: false, responsive: true };
const PLOT_LAYOUT = {
  font: { family: '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif', size: 12, color: INKT },
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  margin: { l: 50, r: 20, t: 10, b: 45 },
};

let alleArtikelen = [];

function uurVan(item) { return parseInt(item.published_at.slice(11, 13), 10); }
function datumVan(item) { return item.published_at.slice(0, 10); }

function weekdagVan(item) {
  const [j, m, d] = datumVan(item).split("-").map(Number);
  return (new Date(j, m - 1, d).getDay() + 6) % 7; // 0 = maandag
}

function gefilterd() {
  const periode = document.getElementById("filter-periode").value;
  const desk = document.getElementById("filter-desk").value;
  const type = document.getElementById("filter-type").value;

  let items = alleArtikelen;
  if (periode !== "all") {
    const laatste = items[items.length - 1].published_at.slice(0, 10);
    const grens = new Date(laatste);
    grens.setDate(grens.getDate() - (Number(periode) - 1));
    const grensStr = grens.toISOString().slice(0, 10);
    items = items.filter((i) => datumVan(i) >= grensStr);
  }
  if (desk !== "all") items = items.filter((i) => i.desk === desk);
  if (type !== "all") items = items.filter((i) => i.artikeltype === type);
  return items;
}

function vulFilters() {
  const desks = [...new Set(alleArtikelen.map((i) => i.desk))].sort();
  const types = [...new Set(alleArtikelen.map((i) => i.artikeltype))].sort();
  for (const desk of desks) {
    document.getElementById("filter-desk").add(new Option(desk, desk));
  }
  for (const type of types) {
    document.getElementById("filter-type").add(new Option(type, type));
  }
}

function renderKpis(items, dagen) {
  const totaal = items.length;
  const perUur = Array(24).fill(0);
  items.forEach((i) => perUur[uurVan(i)]++);
  const piekUur = perUur.indexOf(Math.max(...perUur));
  const aandeelPiek = totaal ? (100 * perUur[16]) / totaal : 0;
  // Referentie: gelijkmatige spreiding over de dagprogrammering van 8-22 uur.
  const referentie = 100 / 14;

  const kpis = [
    { waarde: totaal, label: "publicaties in deze periode" },
    { waarde: (totaal / dagen).toFixed(1), label: "gemiddeld per dag" },
    {
      waarde: `${piekUur}–${piekUur + 1} u`,
      label: `drukste uur (gem. ${(perUur[piekUur] / dagen).toFixed(1)} artikelen)`,
    },
    {
      waarde: `${aandeelPiek.toFixed(0)}%`,
      label: `verschijnt tussen 16 en 17 u (bij gelijke spreiding 8–22 u: ${referentie.toFixed(0)}%)`,
      alert: true,
    },
  ];

  document.getElementById("kpis").innerHTML = kpis
    .map(
      (k) => `<div class="kpi${k.alert ? " alert" : ""}">
        <div class="waarde">${k.waarde}</div><div class="label">${k.label}</div></div>`
    )
    .join("");
}

function renderUren(items, dagen) {
  const perUur = Array(24).fill(0);
  items.forEach((i) => perUur[uurVan(i)]++);
  const gemiddeld = perUur.map((n) => n / dagen);
  const kleuren = gemiddeld.map((_, uur) => (uur === 16 ? ACCENT : "#b8b4ac"));
  const uniform = items.length / dagen / 14;

  Plotly.newPlot(
    "chart-uren",
    [{
      x: [...Array(24).keys()],
      y: gemiddeld,
      type: "bar",
      marker: { color: kleuren },
      hovertemplate: "%{x}:00–%{x}:59<br>gem. %{y:.1f} artikelen per dag<extra></extra>",
    }],
    {
      ...PLOT_LAYOUT,
      height: 320,
      xaxis: { title: { text: "uur van de dag" }, dtick: 1 },
      yaxis: { title: { text: "artikelen per dag" }, rangemode: "tozero" },
      shapes: [{
        type: "line", x0: -0.5, x1: 23.5, y0: uniform, y1: uniform,
        line: { color: INKT, width: 1.5, dash: "dot" },
      }],
      annotations: [{
        x: 2, y: uniform, yanchor: "bottom", showarrow: false,
        text: "gelijke spreiding 8–22 u", font: { size: 11, color: INKT },
      }],
    },
    PLOT_CONFIG
  );
}

function renderHeatmap(items) {
  // Tel hoe vaak elke weekdag in de periode voorkomt, zodat we per cel kunnen middelen.
  const datums = [...new Set(items.map(datumVan))];
  const weekdagTelling = Array(7).fill(0);
  datums.forEach((d) => {
    const [j, m, dag] = d.split("-").map(Number);
    weekdagTelling[(new Date(j, m - 1, dag).getDay() + 6) % 7]++;
  });

  const z = Array.from({ length: 7 }, () => Array(24).fill(0));
  items.forEach((i) => z[weekdagVan(i)][uurVan(i)]++);
  const gemiddeld = z.map((rij, wd) =>
    rij.map((n) => (weekdagTelling[wd] ? n / weekdagTelling[wd] : 0))
  );

  Plotly.newPlot(
    "chart-heatmap",
    [{
      z: gemiddeld.reverse(),
      x: [...Array(24).keys()],
      y: [...WEEKDAGEN].reverse(),
      type: "heatmap",
      colorscale: [[0, "#f7f5f1"], [0.5, "#e3a0a5"], [1, ACCENT]],
      hovertemplate: "%{y} %{x}:00–%{x}:59<br>gem. %{z:.1f} artikelen<extra></extra>",
      colorbar: { title: { text: "per uur" }, thickness: 12 },
    }],
    {
      ...PLOT_LAYOUT,
      height: 300,
      xaxis: { title: { text: "uur van de dag" }, dtick: 1 },
      yaxis: { dtick: 1 },
    },
    PLOT_CONFIG
  );
}

function renderDesks(items) {
  const telling = {};
  items.forEach((i) => (telling[i.desk] = (telling[i.desk] || 0) + 1));
  const top = Object.entries(telling)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([desk]) => desk);

  const traces = top.map((desk, idx) => {
    const perUur = Array(24).fill(0);
    items.filter((i) => i.desk === desk).forEach((i) => perUur[uurVan(i)]++);
    return {
      x: [...Array(24).keys()],
      y: perUur,
      name: desk,
      type: "bar",
      marker: { color: DESK_KLEUREN[idx % DESK_KLEUREN.length] },
      hovertemplate: `${desk}<br>%{x}:00–%{x}:59: %{y} artikelen<extra></extra>`,
    };
  });

  Plotly.newPlot(
    "chart-desks",
    traces,
    {
      ...PLOT_LAYOUT,
      height: 340,
      barmode: "stack",
      xaxis: { title: { text: "uur van de dag" }, dtick: 2 },
      yaxis: { title: { text: "artikelen (totaal periode)" } },
      legend: { orientation: "h", y: -0.25, font: { size: 10 } },
    },
    PLOT_CONFIG
  );
}

function renderDagen(items) {
  const perDag = {};
  items.forEach((i) => (perDag[datumVan(i)] = (perDag[datumVan(i)] || 0) + 1));
  const datums = Object.keys(perDag).sort();

  Plotly.newPlot(
    "chart-dagen",
    [{
      x: datums,
      y: datums.map((d) => perDag[d]),
      type: "bar",
      marker: { color: "#b8b4ac" },
      hovertemplate: "%{x}<br>%{y} artikelen<extra></extra>",
    }],
    {
      ...PLOT_LAYOUT,
      height: 340,
      xaxis: { type: "category", tickangle: -45 },
      yaxis: { title: { text: "artikelen" } },
    },
    PLOT_CONFIG
  );
}

function renderTabel(items) {
  const rijen = [...items]
    .reverse()
    .slice(0, 20)
    .map((i) => {
      const tijd = `${datumVan(i).slice(8)}-${datumVan(i).slice(5, 7)} ${i.published_at.slice(11, 16)}`;
      const auteur = i.author ? ` — ${i.author}` : "";
      return `<tr>
        <td class="tijd">${tijd}</td>
        <td><a href="${i.url}" target="_blank" rel="noopener">${i.title}</a>${auteur}</td>
        <td>${i.desk}</td><td>${i.artikeltype}</td></tr>`;
    });
  document.querySelector("#tabel-laatste tbody").innerHTML = rijen.join("");
}

function render() {
  const items = gefilterd();
  if (!items.length) return;
  const dagen = new Set(items.map(datumVan)).size;

  renderKpis(items, dagen);
  renderUren(items, dagen);
  renderHeatmap(items);
  renderDesks(items);
  renderDagen(items);
  renderTabel(items);
}

async function init() {
  const resp = await fetch("data/publicaties.json");
  alleArtikelen = await resp.json();
  alleArtikelen.sort((a, b) => a.published_at.localeCompare(b.published_at));

  const laatste = alleArtikelen[alleArtikelen.length - 1];
  document.getElementById("laatst-bijgewerkt").textContent =
    `Laatste publicatie: ${laatste.published_at.slice(0, 16).replace("T", " ")}`;

  vulFilters();
  ["filter-periode", "filter-desk", "filter-type"].forEach((id) =>
    document.getElementById(id).addEventListener("change", render)
  );
  render();
}

init();
