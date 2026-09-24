(function () {
  "use strict";

  function getContrastingColor(hexColor) {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "#1e293b" : "#ffffff";
  }

  const DAYS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
  const DAYS_SHORT = ["L", "M", "M", "J", "V", "S"];

  const DEFAULT_COLORS = [
    "#dc2626",
    "#ef4444",
    "#f87171",
    "#b91c1c",
    "#ea580c",
    "#f97316",
    "#fb923c",
    "#c2410c",
    "#d97706",
    "#f59e0b",
    "#fbbf24",
    "#92400e",
    "#ca8a04",
    "#eab308",
    "#facc15",
    "#65a30d",
    "#84cc16",
    "#a3e635",
    "#16a34a",
    "#22c55e",
    "#4ade80",
    "#0d9488",
    "#14b8a6",
    "#2dd4bf",
    "#0891b2",
    "#06b6d4",
    "#22d3ee",
    "#0284c7",
    "#0ea5e9",
    "#38bdf8",
    "#2563eb",
    "#3b82f6",
    "#60a5fa",
    "#4f46e5",
    "#6366f1",
    "#818cf8",
    "#7c3aed",
    "#8b5cf6",
    "#a78bfa",
    "#9333ea",
    "#a855f7",
    "#c084fc",
    "#c026d3",
    "#d946ef",
    "#e879f9",
    "#db2777",
    "#ec4899",
    "#f472b6",
    "#e11d48",
    "#f43f5e",
    "#fb7185",
    "#78716c",
    "#a8a29e",
    "#d6d3d1",
    "#475569",
    "#64748b",
    "#94a3b8",
    "#1e293b",
    "#0f172a",
    "#f1f5f9",
    "#ffffff",
  ].map((hex) => ({ bg: hex, color: getContrastingColor(hex) }));

  const STORAGE_KEY = "edt_v17";

  let state = {
    MATIN: { slots: [], grid: [] },
    APREM: { slots: [], grid: [] },
  };

  let colorMemory = {};

  const classeInput = document.getElementById("classeInput");
  const etabInput = document.getElementById("etabInput");
  const anneeStartInput = document.getElementById("anneeStartInput");
  const anneeEndInput = document.getElementById("anneeEndInput");
  const classeDisplay = document.getElementById("classeDisplay");
  const etabDisplay = document.getElementById("etabDisplay");
  const anneeDisplay = document.getElementById("anneeDisplay");

  const tableMatin = document.getElementById("tableMatin");
  const tableAprem = document.getElementById("tableAprem");
  const bodyMatin = document.getElementById("bodyMatin");
  const bodyAprem = document.getElementById("bodyAprem");

  const addSlotMatin = document.getElementById("addSlotMatin");
  const removeSlotMatin = document.getElementById("removeSlotMatin");
  const addSlotAprem = document.getElementById("addSlotAprem");
  const removeSlotAprem = document.getElementById("removeSlotAprem");

  const exportPdfBtn = document.getElementById("exportPdfBtn");

  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modalClose = document.getElementById("modalClose");
  const modalCancel = document.getElementById("modalCancel");
  const modalConfirm = document.getElementById("modalConfirm");

  let modalOnConfirm = null;

  function isSmallScreen() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function save() {
    try {
      const payload = {
        state,
        DAYS,
        colorMemory,
        classe: classeInput.value,
        etab: etabInput.value,
        anneeStart: anneeStartInput.value,
        anneeEnd: anneeEndInput.value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("Erreur de sauvegarde LocalStorage:", e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.state) state = d.state;
      if (d.colorMemory) colorMemory = d.colorMemory;
      classeInput.value = d.classe || "";
      etabInput.value = d.etab || "";
      anneeStartInput.value = d.anneeStart || "";
      anneeEndInput.value = d.anneeEnd || "";
      return true;
    } catch (e) {
      console.warn("Erreur lors du chargement des données:", e);
      return false;
    }
  }

  function normalizeKey(text) {
    return (text || "").trim().toUpperCase().replace(/\s+/g, " ");
  }

  function hashColor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    const idx = Math.abs(h) % DEFAULT_COLORS.length;
    return DEFAULT_COLORS[idx];
  }

  function getColorFor(matKey) {
    if (colorMemory[matKey]) {
      const c = colorMemory[matKey];
      return { bg: c.bg, color: c.color || getContrastingColor(c.bg) };
    }
    const auto = hashColor(matKey);
    colorMemory[matKey] = { bg: auto.bg, color: auto.color };
    return auto;
  }

  function propagateColorFor(matKey, colorObj) {
    colorMemory[matKey] = { bg: colorObj.bg, color: colorObj.color };
    ["MATIN", "APREM"].forEach((period) => {
      const p = state[period];
      p.grid.forEach((row) => {
        row.forEach((cell) => {
          if (!cell || !cell.lines) return;
          cell.lines.forEach((line) => {
            if (normalizeKey(line.text) === matKey) {
              line.color = { bg: colorObj.bg, color: colorObj.color };
            }
          });
        });
      });
    });
  }

  function ensureGridDimensions(period) {
    const p = state[period];
    if (!Array.isArray(p.slots)) p.slots = [];
    if (!Array.isArray(p.grid)) p.grid = [];
    while (p.grid.length < p.slots.length) {
      p.grid.push(DAYS.map(() => null));
    }
    p.grid.length = p.slots.length;
    for (let i = 0; i < p.grid.length; i++) {
      if (!Array.isArray(p.grid[i])) p.grid[i] = [];
      while (p.grid[i].length < DAYS.length) p.grid[i].push(null);
      p.grid[i].length = DAYS.length;
    }
  }

  function updateTitle() {
    classeDisplay.textContent = classeInput.value || "—";
    etabDisplay.textContent = etabInput.value || "—";
    const s = anneeStartInput.value.trim();
    const e = anneeEndInput.value.trim();
    anneeDisplay.textContent = s || e ? `${s || "?"} – ${e || "?"}` : "—";
  }

  function buildHeaders() {
    const isSmall = isSmallScreen();

    [tableMatin, tableAprem].forEach((table) => {
      const daysRow = table.querySelector(".days-row");
      const frag = document.createDocumentFragment();

      const thH = document.createElement("th");
      thH.className = "col-horaire";
      thH.textContent = "HORAIRE";
      frag.appendChild(thH);

      DAYS.forEach((j, i) => {
        const th = document.createElement("th");
        th.textContent = isSmall ? DAYS_SHORT[i] : j;
        th.dataset.full = j;
        th.dataset.short = DAYS_SHORT[i];
        frag.appendChild(th);
      });

      daysRow.innerHTML = "";
      daysRow.appendChild(frag);
    });
  }

  function updateHeadersOnResize() {
    const isSmall = isSmallScreen();
    [tableMatin, tableAprem].forEach((table) => {
      const ths = table.querySelectorAll(".days-row th:not(.col-horaire)");
      ths.forEach((th, i) => {
        th.textContent = isSmall ? DAYS_SHORT[i] : DAYS[i];
      });
    });
  }

  function buildSection(period, tbody) {
    ensureGridDimensions(period);
    const p = state[period];
    const frag = document.createDocumentFragment();

    for (let slotIdx = 0; slotIdx < p.slots.length; slotIdx++) {
      const slotLabel = p.slots[slotIdx];
      const tr = document.createElement("tr");

      const tdTime = document.createElement("td");
      tdTime.className = "time-cell";
      tdTime.contentEditable = "true";
      tdTime.spellcheck = false;
      tdTime.dataset.placeholder = "HORAIRE";
      tdTime.textContent = (slotLabel || "").toUpperCase();

      tdTime.addEventListener("input", () => {
        const cleaned = tdTime.textContent
          .replace(/[\r\n]+/g, " ")
          .trim()
          .toUpperCase();
        state[period].slots[slotIdx] = cleaned;
        save();
      });

      tdTime.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          tdTime.blur();
        }
      });

      tdTime.addEventListener("click", (e) => e.stopPropagation());
      tdTime.addEventListener("mousedown", (e) => e.stopPropagation());
      tdTime.addEventListener("blur", save);

      tr.appendChild(tdTime);

      for (let dayIdx = 0; dayIdx < DAYS.length; dayIdx++) {
        const cellData = p.grid[slotIdx][dayIdx];

        const td = document.createElement("td");
        td.className = "subject-cell";
        td.dataset.period = period;
        td.dataset.slot = slotIdx;
        td.dataset.day = dayIdx;

        if (cellData && cellData.lines && cellData.lines.length > 0) {
          renderFilledCell(td, cellData);
        } else {
          td.classList.add("empty");
        }

        td.addEventListener("click", (e) => {
          if (e.target.classList.contains("remove-btn")) return;
          e.stopPropagation();
          openCellEditor(period, slotIdx, dayIdx);
        });

        tr.appendChild(td);
      }

      frag.appendChild(tr);
    }

    tbody.innerHTML = "";
    tbody.appendChild(frag);
  }

  function renderFilledCell(td, cellData) {
    td.innerHTML = "";
    td.classList.remove("empty");
    td.style.background = "";
    td.style.color = "";

    const content = document.createElement("div");
    content.className = "subject-content";

    cellData.lines.forEach((line) => {
      const lineEl = document.createElement("div");
      lineEl.className = "subject-line";
      lineEl.textContent = (line.text || "").toUpperCase();

      const key = normalizeKey(line.text);
      const lineColor = line.color || (key ? getColorFor(key) : null);
      if (lineColor) {
        lineEl.style.background = lineColor.bg;
        lineEl.style.color =
          lineColor.color || getContrastingColor(lineColor.bg);
      }

      content.appendChild(lineEl);
    });

    td.appendChild(content);

    const rb = document.createElement("button");
    rb.className = "remove-btn";
    rb.textContent = "×";
    rb.title = "Vider la cellule";
    rb.addEventListener("click", (e) => {
      e.stopPropagation();
      const period = td.dataset.period;
      const slotIdx = parseInt(td.dataset.slot, 10);
      const dayIdx = parseInt(td.dataset.day, 10);
      state[period].grid[slotIdx][dayIdx] = null;
      save();
      refresh();
    });
    td.appendChild(rb);
  }

  function openCellEditor(period, slotIdx, dayIdx) {
    ensureGridDimensions(period);
    const p = state[period];
    const existing = p.grid[slotIdx][dayIdx] || {
      lines: [{ text: "" }],
    };

    modalTitle.textContent = `${period === "MATIN" ? "MATIN" : "APRÈS-MIDI"}-${DAYS[dayIdx]}-MATIÈRE`;

    modalBody.innerHTML = `
      <label>Matières</label>
      <div class="matieres-editor" id="matieresEditor"></div>
      <button class="excel-btn" id="addLineBtn">
        <img src="images/add.png" alt="" class="btn-icon">
        <span>Ajouter une matière</span>
      </button>
      <div class="color-palette" id="colorPalette">
        <div class="color-palette-label" id="paletteLabel">Couleur</div>
        <div class="color-picker" id="colorPicker"></div>
      </div>
    `;

    const matieresEditor = modalBody.querySelector("#matieresEditor");
    const colorPalette = modalBody.querySelector("#colorPalette");
    const colorPicker = modalBody.querySelector("#colorPicker");
    const paletteLabel = modalBody.querySelector("#paletteLabel");
    const addLineBtn = modalBody.querySelector("#addLineBtn");

    const lines = existing.lines.map((l) => ({
      text: (l.text || "").toUpperCase(),
      color: l.color ? { bg: l.color.bg, color: l.color.color } : null,
    }));

    lines.forEach((line) => {
      if (!line.color && line.text.trim()) {
        line.color = getColorFor(normalizeKey(line.text));
      }
    });

    let activeLineIndex = lines.findIndex((l) => l.text.trim());
    if (activeLineIndex === -1) activeLineIndex = 0;

    let currentColor = lines[activeLineIndex]?.color || DEFAULT_COLORS[0];

    function renderMatieres() {
      matieresEditor.innerHTML = "";

      lines.forEach((line, i) => {
        const item = document.createElement("div");
        item.className = "matiere-item";

        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = line.text;
        inp.placeholder = "Nom de la matière";

        inp.addEventListener("input", () => {
          line.text = inp.value.toUpperCase();

          const key = normalizeKey(line.text);
          if (key && colorMemory[key]) {
            const knownColor = colorMemory[key];
            line.color = {
              bg: knownColor.bg,
              color: knownColor.color || getContrastingColor(knownColor.bg),
            };
            const btns = matieresEditor.querySelectorAll(".matiere-color-btn");
            if (btns[i]) btns[i].style.background = knownColor.bg;
            if (i === activeLineIndex) {
              currentColor = line.color;
              updateSwatches();
            }
          }
        });

        inp.addEventListener("focus", () => {
          activeLineIndex = i;
          const key = normalizeKey(line.text);
          currentColor =
            line.color || (key ? getColorFor(key) : DEFAULT_COLORS[0]);
          updatePaletteVisibility();
          updateSwatches();
        });

        inp.addEventListener("blur", () => {
          const key = normalizeKey(inp.value);
          if (key) {
            if (colorMemory[key]) {
              line.color = {
                bg: colorMemory[key].bg,
                color:
                  colorMemory[key].color ||
                  getContrastingColor(colorMemory[key].bg),
              };
            } else if (!line.color) {
              line.color = getColorFor(key);
            }
            const btns = matieresEditor.querySelectorAll(".matiere-color-btn");
            if (btns[i] && line.color) btns[i].style.background = line.color.bg;
            if (i === activeLineIndex) {
              currentColor = line.color || DEFAULT_COLORS[0];
              updateSwatches();
            }
          }
        });

        item.appendChild(inp);

        const colorBtn = document.createElement("button");
        colorBtn.className = "matiere-color-btn";
        colorBtn.type = "button";
        colorBtn.title = "Changer la couleur de cette matière";

        const displayColor =
          line.color ||
          (line.text.trim()
            ? getColorFor(normalizeKey(line.text))
            : DEFAULT_COLORS[0]);
        colorBtn.style.background = displayColor.bg;

        colorBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          activeLineIndex = i;
          const key = normalizeKey(line.text);
          currentColor =
            line.color || (key ? getColorFor(key) : DEFAULT_COLORS[0]);
          updatePaletteVisibility();
          updateSwatches();
        });

        item.appendChild(colorBtn);

        if (lines.length > 1) {
          const del = document.createElement("button");
          del.className = "matiere-remove-btn";
          del.type = "button";
          del.textContent = "×";
          del.title = "Supprimer cette matière";
          del.addEventListener("click", () => {
            lines.splice(i, 1);
            if (lines.length === 0) {
              lines.push({ text: "", color: null });
            }
            if (activeLineIndex >= lines.length) {
              activeLineIndex = lines.length - 1;
            }
            currentColor = lines[activeLineIndex]?.color || DEFAULT_COLORS[0];
            renderMatieres();
            updateSwatches();
          });
          item.appendChild(del);
        }

        matieresEditor.appendChild(item);
      });
    }

    function updatePaletteVisibility() {
      const line = lines[activeLineIndex];
      const key = line ? normalizeKey(line.text) : "";
      paletteLabel.textContent = key
        ? `Couleur de « ${line.text} »`
        : "Couleur";
      colorPalette.classList.add("active");
    }

    function updateSwatches() {
      colorPicker.querySelectorAll(".color-swatch").forEach((sw) => {
        const isActive = currentColor && sw.dataset.bg === currentColor.bg;
        sw.classList.toggle("active", isActive);
      });
    }

    DEFAULT_COLORS.forEach((c) => {
      const sw = document.createElement("div");
      sw.className = "color-swatch";
      sw.dataset.bg = c.bg;
      sw.style.background = c.bg;
      sw.title = c.bg;
      sw.addEventListener("click", () => {
        currentColor = { bg: c.bg, color: c.color };
        if (lines[activeLineIndex]) {
          lines[activeLineIndex].color = currentColor;
          const btn =
            matieresEditor.querySelectorAll(".matiere-color-btn")[
              activeLineIndex
            ];
          if (btn) btn.style.background = c.bg;
        }
        updateSwatches();
      });
      colorPicker.appendChild(sw);
    });

    addLineBtn.addEventListener("click", () => {
      lines.push({ text: "", color: null });
      activeLineIndex = lines.length - 1;
      currentColor = DEFAULT_COLORS[0];
      renderMatieres();
      updateSwatches();

      setTimeout(() => {
        const inputs = matieresEditor.querySelectorAll("input");
        if (inputs.length > 0) {
          inputs[inputs.length - 1].focus();
        }
      }, 30);
    });

    renderMatieres();
    updatePaletteVisibility();
    updateSwatches();

    modalOnConfirm = () => {
      ensureGridDimensions(period);

      const cleaned = lines
        .map((l) => ({
          text: l.text.trim().toUpperCase(),
          color: l.color ? { bg: l.color.bg, color: l.color.color } : null,
        }))
        .filter((l) => l.text !== "");

      if (cleaned.length === 0) {
        state[period].grid[slotIdx][dayIdx] = null;
      } else {
        cleaned.forEach((l) => {
          const key = normalizeKey(l.text);
          if (!l.color) {
            l.color = getColorFor(key);
          } else {
            propagateColorFor(key, l.color);
          }
        });

        state[period].grid[slotIdx][dayIdx] = {
          lines: cleaned,
        };
      }
      save();
      refresh();
    };

    openModal();
    setTimeout(() => {
      const inputs = matieresEditor.querySelectorAll("input");
      if (inputs.length > 0 && inputs[activeLineIndex]) {
        inputs[activeLineIndex].focus();
      }
    }, 80);
  }

  function openModal() {
    modalOverlay.classList.add("active");
  }

  function closeModal() {
    modalOverlay.classList.remove("active");
    modalOnConfirm = null;
  }

  modalClose.addEventListener("click", closeModal);
  modalCancel.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  modalConfirm.addEventListener("click", () => {
    if (modalOnConfirm) modalOnConfirm();
    closeModal();
  });

  function addSlotTo(period) {
    state[period].slots.push("");
    state[period].grid.push(DAYS.map(() => null));
    save();
    refresh();
    setTimeout(() => {
      const tbody = period === "MATIN" ? bodyMatin : bodyAprem;
      const rows = tbody.querySelectorAll("tr");
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const timeCell = lastRow.querySelector(".time-cell");
        if (timeCell) timeCell.focus();
      }
    }, 60);
  }

  function removeSlotFrom(period) {
    const p = state[period];
    if (p.slots.length === 0)
      return alert(`Aucune ligne à supprimer dans ${period}.`);
    if (
      !confirm(
        `Supprimer la dernière ligne de ${period === "MATIN" ? "Matin" : "Après-midi"} ?`,
      )
    )
      return;
    p.slots.pop();
    p.grid.pop();
    save();
    refresh();
  }

  function exportPdf() {
    const titreAnnee = anneeDisplay.textContent;
    const classe = classeInput.value || "—";
    const etab = etabInput.value || "—";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert(
        "Veuillez autoriser les fenêtres surgissantes (pop-ups) pour exporter en PDF.",
      );
      return;
    }

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Emploi du temps</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          font-family: Arial, sans-serif;
          color: #000;
        }
        .pdf-header {
          text-align: center;
          margin: 0 0 8mm 0;
        }
        h1 {
          font-size: 18pt;
          margin: 0 0 3mm 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: bold;
        }
        h2 {
          font-size: 12pt;
          margin: 0;
          font-weight: bold;
          text-transform: uppercase;
          color: #333;
        }
        .section-title {
          background: #1e3a5f !important;
          color: #fff !important;
          text-align: center;
          font-weight: bold;
          padding: 8px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          margin-top: 6mm;
          margin-bottom: 3mm;
          font-size: 11pt;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-bottom: 4mm;
        }
        th, td {
          border: 1px solid #1e3a5f;
          text-align: center;
          vertical-align: middle;
          padding: 0;
          text-transform: uppercase;
          word-wrap: break-word;
        }
        th {
          background: #eef4fa !important;
          color: #1e3a5f;
          font-size: 10pt;
          font-weight: bold;
          padding: 6px 4px;
          height: 10mm;
        }
        .time-cell {
          background: #dbe6f0 !important;
          color: #1e3a5f;
          font-weight: bold;
          font-size: 9pt;
          width: 26mm;
          padding: 6px 4px;
        }
        .cell-container {
          display: flex;
          flex-direction: column;
          min-height: 12mm;
          width: 100%;
        }
        .subject-line {
          flex: 1 1 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 10pt;
          line-height: 1.15;
          text-transform: uppercase;
          padding: 5px 3px;
          min-height: 6mm;
        }
      </style>
    </head><body>
      <div class="pdf-header">
        <h1>EMPLOI DU TEMPS (${escapeHtml(titreAnnee)})</h1>
        <h2>CLASSE DE ${escapeHtml(classe)} - ${escapeHtml(etab)}</h2>
      </div>
    `;

    ["MATIN", "APREM"].forEach((period) => {
      const p = state[period];
      if (p.slots.length === 0) return;

      html += `<div class="section-title">${period === "MATIN" ? "MATIN" : "APRÈS-MIDI"}</div>`;
      html += `<table><thead><tr><th style="width:26mm;">HORAIRE</th>`;
      DAYS.forEach((j) => {
        html += `<th>${j}</th>`;
      });
      html += `</tr></thead><tbody>`;

      for (let slotIdx = 0; slotIdx < p.slots.length; slotIdx++) {
        const slotLabel = p.slots[slotIdx];
        html += `<tr><td class="time-cell">${escapeHtml((slotLabel || "—").toUpperCase())}</td>`;

        for (let dayIdx = 0; dayIdx < DAYS.length; dayIdx++) {
          const cell = p.grid[slotIdx] ? p.grid[slotIdx][dayIdx] : null;
          html += `<td style="padding:0; vertical-align:stretch;">`;

          if (cell && cell.lines.length > 0) {
            html += `<div class="cell-container">`;
            cell.lines.forEach((l) => {
              const key = normalizeKey(l.text);
              const lineColor = l.color || (key ? getColorFor(key) : null);
              const bg = lineColor ? lineColor.bg : "#ffffff";
              const fg = lineColor
                ? lineColor.color || getContrastingColor(lineColor.bg)
                : "#000000";

              html += `<div class="subject-line" style="background:${bg} !important; color:${fg} !important;">${escapeHtml(l.text.toUpperCase())}</div>`;
            });
            html += `</div>`;
          }

          html += `</td>`;
        }

        html += `</tr>`;
      }

      html += `</tbody></table>`;
    });

    html += `</body></html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 300);
    };
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  function refresh() {
    buildSection("MATIN", bodyMatin);
    buildSection("APREM", bodyAprem);
  }

  function bindEvents() {
    classeInput.addEventListener("input", () => {
      updateTitle();
      save();
    });
    etabInput.addEventListener("input", () => {
      updateTitle();
      save();
    });
    anneeStartInput.addEventListener("input", () => {
      updateTitle();
      save();
    });
    anneeEndInput.addEventListener("input", () => {
      updateTitle();
      save();
    });

    addSlotMatin.addEventListener("click", () => addSlotTo("MATIN"));
    removeSlotMatin.addEventListener("click", () => removeSlotFrom("MATIN"));
    addSlotAprem.addEventListener("click", () => addSlotTo("APREM"));
    removeSlotAprem.addEventListener("click", () => removeSlotFrom("APREM"));

    exportPdfBtn.addEventListener("click", exportPdf);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalOverlay.classList.contains("active"))
        closeModal();
    });

    window.addEventListener("beforeunload", save);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") save();
    });

    window.addEventListener("resize", updateHeadersOnResize);
  }

  function init() {
    const loaded = load();
    if (!loaded) {
      state = {
        MATIN: { slots: [], grid: [] },
        APREM: { slots: [], grid: [] },
      };
    }
    updateTitle();
    buildHeaders();
    refresh();
    bindEvents();
  }

  init();
})();
