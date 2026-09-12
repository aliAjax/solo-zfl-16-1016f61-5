const storageKey = "zfl16-movable-type-workshop";

const starterInventory = [
  { id: crypto.randomUUID(), char: "山", style: "宋体旧字", size: 30, quantity: 4, wear: "微磨" },
  { id: crypto.randomUUID(), char: "月", style: "宋体旧字", size: 30, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "风", style: "楷体木刻", size: 28, quantity: 2, wear: "微磨" },
  { id: crypto.randomUUID(), char: "花", style: "楷体木刻", size: 28, quantity: 2, wear: "新" },
  { id: crypto.randomUUID(), char: "茶", style: "黑体铅字", size: 24, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "雨", style: "仿宋细字", size: 22, quantity: 4, wear: "新" }
];

const defaultState = {
  inventory: starterInventory,
  selectedTypeId: starterInventory[0].id,
  placements: [],
  drafts: [],
  works: [],
  settings: {
    paperSize: "postcard",
    flowMode: "horizontal",
    gridGap: 8,
    workTitle: "晚风小笺"
  }
};

const HISTORY_LIMIT = 50;
const WORK_LIMIT = 12;

let state = loadState();
const history = { past: [], future: [] };
let renamingWorkId = null;
let renameDraftValue = "";

const els = {
  paperSize: document.querySelector("#paperSize"),
  flowMode: document.querySelector("#flowMode"),
  gridGap: document.querySelector("#gridGap"),
  workTitle: document.querySelector("#workTitle"),
  stage: document.querySelector("#stage"),
  typeList: document.querySelector("#typeList"),
  typeForm: document.querySelector("#typeForm"),
  charInput: document.querySelector("#charInput"),
  styleInput: document.querySelector("#styleInput"),
  sizeInput: document.querySelector("#sizeInput"),
  quantityInput: document.querySelector("#quantityInput"),
  wearInput: document.querySelector("#wearInput"),
  inventorySearch: document.querySelector("#inventorySearch"),
  styleFilter: document.querySelector("#styleFilter"),
  selectedTypeLabel: document.querySelector("#selectedTypeLabel"),
  shortageBadge: document.querySelector("#shortageBadge"),
  usageList: document.querySelector("#usageList"),
  draftList: document.querySelector("#draftList"),
  workList: document.querySelector("#workList"),
  placedCount: document.querySelector("#placedCount"),
  inventoryCount: document.querySelector("#inventoryCount"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  saveWorkBtn: document.querySelector("#saveWorkBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearBoardBtn: document.querySelector("#clearBoardBtn"),
  undoBtn: document.querySelector("#undoBtn"),
  redoBtn: document.querySelector("#redoBtn"),
  modalBackdrop: document.querySelector("#modalBackdrop"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  modalCloseBtn: document.querySelector("#modalCloseBtn")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: { ...defaultState.settings, ...parsed.settings }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getGrid(size = state.settings.paperSize) {
  if (size === "bookmark") return { cols: 7, rows: 18 };
  if (size === "square") return { cols: 12, rows: 12 };
  return { cols: 16, rows: 10 };
}

function paperLabel(size) {
  if (size === "bookmark") return "书签";
  if (size === "square") return "方形小笺";
  return "明信片";
}

function placementKey(row, col) {
  return `${row}:${col}`;
}

function getSelectedType() {
  return state.inventory.find((item) => item.id === state.selectedTypeId) || null;
}

function getUsage() {
  return state.placements.reduce((acc, placement) => {
    acc[placement.typeId] = (acc[placement.typeId] || 0) + 1;
    return acc;
  }, {});
}

function getShortages() {
  const usage = getUsage();
  return state.inventory
    .filter((item) => (usage[item.id] || 0) > item.quantity)
    .map((item) => ({ item, used: usage[item.id], over: usage[item.id] - item.quantity }));
}

function snapshotBoard() {
  return {
    settings: structuredClone(state.settings),
    placements: structuredClone(state.placements)
  };
}

function pushHistory() {
  history.past.push(snapshotBoard());
  if (history.past.length > HISTORY_LIMIT) history.past.shift();
  history.future = [];
}

function applySnapshot(snapshot) {
  state.settings = structuredClone(snapshot.settings);
  state.placements = structuredClone(snapshot.placements);
  renderAll();
}

function undo() {
  if (!history.past.length) return;
  history.future.push(snapshotBoard());
  applySnapshot(history.past.pop());
}

function redo() {
  if (!history.future.length) return;
  history.past.push(snapshotBoard());
  applySnapshot(history.future.pop());
}

function updateUndoRedo() {
  els.undoBtn.disabled = !history.past.length;
  els.redoBtn.disabled = !history.future.length;
}

function renderSettings() {
  els.paperSize.value = state.settings.paperSize;
  els.flowMode.value = state.settings.flowMode;
  els.gridGap.value = state.settings.gridGap;
  els.workTitle.value = state.settings.workTitle;
}

function renderStyleFilter() {
  const current = els.styleFilter.value || "all";
  const styles = [...new Set(state.inventory.map((item) => item.style))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  els.styleFilter.innerHTML = `<option value="all">全部风格</option>${styles
    .map((style) => `<option value="${escapeHtml(style)}">${escapeHtml(style)}</option>`)
    .join("")}`;
  els.styleFilter.value = styles.includes(current) ? current : "all";
}

function renderInventory() {
  const keyword = els.inventorySearch.value.trim();
  const style = els.styleFilter.value;
  const usage = getUsage();
  const items = state.inventory.filter((item) => {
    const matchesKeyword = !keyword || `${item.char}${item.style}${item.wear}`.includes(keyword);
    const matchesStyle = style === "all" || item.style === style;
    return matchesKeyword && matchesStyle;
  });

  els.inventoryCount.textContent = `${state.inventory.length}枚字模`;
  els.typeList.innerHTML = items
    .map((item) => {
      const used = usage[item.id] || 0;
      const selected = item.id === state.selectedTypeId ? "selected" : "";
      return `
        <article class="type-card ${selected}" draggable="true" data-type-id="${item.id}">
          <div class="glyph" style="font-size:${Math.min(item.size, 36)}px">${escapeHtml(item.char)}</div>
          <div class="type-meta">
            <strong>${escapeHtml(item.char)} · ${escapeHtml(item.style)}</strong>
            <span>${item.size}px · ${escapeHtml(item.wear)} · 已用${used}/${item.quantity}</span>
          </div>
          <button class="mini-btn" title="删除字模" data-delete-type="${item.id}" type="button">×</button>
        </article>
      `;
    })
    .join("");
}

function renderStage() {
  const { cols, rows } = getGrid();
  const map = new Map(state.placements.map((item) => [placementKey(item.row, item.col), item]));
  els.stage.className = `stage ${state.settings.paperSize}`;
  els.stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  els.stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  els.stage.style.gap = `${state.settings.gridGap}px`;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const placement = map.get(placementKey(row, col));
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const vertical = state.settings.flowMode === "vertical" ? "vertical" : "";
      cells.push(`
        <button class="cell ${type ? "used" : ""} ${vertical}" data-row="${row}" data-col="${col}" type="button" aria-label="第${row + 1}行第${col + 1}列">
          ${type ? escapeHtml(type.char) : ""}
        </button>
      `);
    }
  }
  els.stage.innerHTML = cells.join("");
}

function renderUsage() {
  const usage = getUsage();
  const entries = state.inventory.filter((item) => usage[item.id]);
  els.placedCount.textContent = `${state.placements.length}个落字`;

  const shortages = entries.filter((item) => usage[item.id] > item.quantity);
  els.shortageBadge.textContent = shortages.length ? `${shortages.length}处超量` : "数量充足";
  els.shortageBadge.className = `badge ${shortages.length ? "warn" : "ok"}`;

  const selectedType = getSelectedType();
  els.selectedTypeLabel.textContent = selectedType ? `当前：${selectedType.char} · ${selectedType.style}` : "未选择字模";

  els.usageList.innerHTML =
    entries
      .map((item) => {
        const used = usage[item.id];
        const warn = used > item.quantity ? "warn" : "";
        return `
          <div class="usage-item ${warn}">
            <strong>${escapeHtml(item.char)} ${escapeHtml(item.style)}</strong>
            <span>${used}/${item.quantity}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">还没有落字。</p>`;
}

function renderDrafts() {
  els.draftList.innerHTML =
    state.drafts
      .map(
        (draft) => `
          <article class="draft-item">
            <strong>${escapeHtml(draft.title)}</strong>
            <span>${draft.placements.length}个落字 · ${new Date(draft.savedAt).toLocaleString("zh-CN")}</span>
            <div class="draft-actions">
              <button type="button" data-load-draft="${draft.id}">载入</button>
              <button type="button" data-delete-draft="${draft.id}">删除</button>
            </div>
          </article>
        `
      )
      .join("") || `<p class="empty">还没有保存草稿。</p>`;
}

function renderWorks() {
  els.workList.innerHTML =
    state.works
      .map((work) => {
        if (work.id === renamingWorkId) {
          return `
            <article class="draft-item">
              <input class="rename-input" type="text" maxlength="24" value="${escapeHtml(renameDraftValue)}" data-rename-input="${work.id}" />
              <div class="draft-actions">
                <button type="button" data-confirm-rename="${work.id}">确定</button>
                <button type="button" data-cancel-rename>取消</button>
              </div>
            </article>
          `;
        }
        return `
          <article class="draft-item">
            <strong>${escapeHtml(work.name)}</strong>
            <span>${work.placements.length}个落字 · ${paperLabel(work.settings.paperSize)} · ${new Date(work.savedAt).toLocaleString("zh-CN")}</span>
            <div class="draft-actions work-actions">
              <button type="button" data-preview-work="${work.id}">预览</button>
              <button type="button" data-restore-work="${work.id}">恢复</button>
              <button type="button" data-rename-work="${work.id}">重命名</button>
              <button type="button" data-remove-work="${work.id}">移除</button>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">还没有命名作品。</p>`;

  if (renamingWorkId) {
    const input = els.workList.querySelector("[data-rename-input]");
    if (input && document.activeElement !== input) {
      input.focus();
      input.select();
    }
  }
}

function renderAll() {
  saveState();
  renderSettings();
  renderStyleFilter();
  renderInventory();
  renderStage();
  renderUsage();
  renderDrafts();
  renderWorks();
  updateUndoRedo();
}

function placeType(row, col, typeId = state.selectedTypeId) {
  if (!typeId) return;
  pushHistory();
  const existingIndex = state.placements.findIndex((item) => item.row === row && item.col === col);
  if (existingIndex >= 0) {
    if (state.placements[existingIndex].typeId === typeId) {
      state.placements.splice(existingIndex, 1);
    } else {
      state.placements[existingIndex].typeId = typeId;
    }
  } else {
    state.placements.push({ row, col, typeId });
  }
  renderAll();
}

function addType(event) {
  event.preventDefault();
  const item = {
    id: crypto.randomUUID(),
    char: els.charInput.value.trim(),
    style: els.styleInput.value.trim(),
    size: Number(els.sizeInput.value),
    quantity: Number(els.quantityInput.value),
    wear: els.wearInput.value
  };
  if (!item.char || !item.style) return;
  state.inventory.unshift(item);
  state.selectedTypeId = item.id;
  els.typeForm.reset();
  els.sizeInput.value = 24;
  els.quantityInput.value = 3;
  renderAll();
}

function saveDraft() {
  const title = state.settings.workTitle.trim() || "未命名作品";
  state.drafts.unshift({
    id: crypto.randomUUID(),
    title,
    settings: structuredClone(state.settings),
    placements: structuredClone(state.placements),
    savedAt: new Date().toISOString()
  });
  state.drafts = state.drafts.slice(0, 8);
  renderAll();
}

function uniqueWorkName(base, excludeId = null) {
  const names = new Set(state.works.filter((work) => work.id !== excludeId).map((work) => work.name));
  if (!names.has(base)) return base;
  let index = 2;
  while (names.has(`${base}（${index}）`)) index += 1;
  return `${base}（${index}）`;
}

function saveWork() {
  const shortages = getShortages();
  if (shortages.length) {
    showShortageModal("保存作品", shortages);
    return;
  }
  state.works.unshift({
    id: crypto.randomUUID(),
    name: uniqueWorkName(state.settings.workTitle.trim() || "未命名作品"),
    settings: structuredClone(state.settings),
    placements: structuredClone(state.placements),
    savedAt: new Date().toISOString()
  });
  state.works = state.works.slice(0, WORK_LIMIT);
  renderAll();
}

function restoreWork(workId) {
  const work = state.works.find((item) => item.id === workId);
  if (!work) return;
  pushHistory();
  applySnapshot(work);
}

function previewWork(workId) {
  const work = state.works.find((item) => item.id === workId);
  if (!work) return;
  const body = document.createElement("div");
  body.className = "work-preview";
  const meta = document.createElement("p");
  meta.className = "modal-tip";
  const flow = work.settings.flowMode === "vertical" ? "竖排" : "横排";
  meta.textContent = `${work.placements.length}个落字 · ${paperLabel(work.settings.paperSize)} · ${flow} · 保存于 ${new Date(work.savedAt).toLocaleString("zh-CN")}`;
  const canvas = drawWorkCanvas(work);
  canvas.className = "preview-canvas";
  body.append(meta, canvas);
  openModal(`预览：${work.name}`, body);
}

function openModal(title, bodyNode) {
  els.modalTitle.textContent = title;
  els.modalBody.replaceChildren(bodyNode);
  els.modalBackdrop.hidden = false;
}

function closeModal() {
  els.modalBackdrop.hidden = true;
  els.modalBody.replaceChildren();
}

function showShortageModal(actionName, shortages) {
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="modal-tip">以下字模用量超出库存，本次${escapeHtml(actionName)}已被拦截。请撤下多余落字或补充字模数量后再试。</p>
    <div class="usage-list">
      ${shortages
        .map(
          ({ item, used, over }) => `
            <div class="usage-item warn">
              <strong>${escapeHtml(item.char)} · ${escapeHtml(item.style)}</strong>
              <span>已用 ${used} / 库存 ${item.quantity}，超出 ${over}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
  openModal(`字模超量，无法${actionName}`, body);
}

function drawWorkCanvas(work) {
  const settings = work.settings;
  const { cols, rows } = getGrid(settings.paperSize);
  const cell = settings.paperSize === "bookmark" ? 44 : 56;
  const gap = settings.gridGap;
  const margin = 48;
  const width = cols * cell + (cols - 1) * gap + margin * 2;
  const height = rows * cell + (rows - 1) * gap + margin * 2 + 70;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#2f2921";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.fillStyle = "#22201c";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(settings.workTitle || "未命名作品", margin, 50);
  work.placements.forEach((placement) => {
    const type = state.inventory.find((item) => item.id === placement.typeId);
    if (!type) return;
    const x = margin + placement.col * (cell + gap);
    const y = margin + 45 + placement.row * (cell + gap);
    ctx.fillStyle = "#2f2921";
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = "#fff5df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.min(type.size + 8, 42)}px serif`;
    ctx.fillText(type.char, x + cell / 2, y + cell / 2);
  });
  return canvas;
}

function exportPreview() {
  const shortages = getShortages();
  if (shortages.length) {
    showShortageModal("导出预览图", shortages);
    return;
  }
  const canvas = drawWorkCanvas({ settings: state.settings, placements: state.placements });
  const link = document.createElement("a");
  link.download = `${state.settings.workTitle || "movable-type"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.paperSize.addEventListener("change", () => {
  state.settings.paperSize = els.paperSize.value;
  const { cols, rows } = getGrid();
  state.placements = state.placements.filter((item) => item.row < rows && item.col < cols);
  renderAll();
});

els.flowMode.addEventListener("change", () => {
  state.settings.flowMode = els.flowMode.value;
  renderAll();
});

els.gridGap.addEventListener("input", () => {
  state.settings.gridGap = Number(els.gridGap.value);
  renderAll();
});

els.workTitle.addEventListener("input", () => {
  state.settings.workTitle = els.workTitle.value;
  saveState();
});

els.typeForm.addEventListener("submit", addType);
els.inventorySearch.addEventListener("input", renderInventory);
els.styleFilter.addEventListener("change", renderInventory);
els.saveDraftBtn.addEventListener("click", saveDraft);
els.saveWorkBtn.addEventListener("click", saveWork);
els.exportBtn.addEventListener("click", exportPreview);
els.undoBtn.addEventListener("click", undo);
els.redoBtn.addEventListener("click", redo);
els.clearBoardBtn.addEventListener("click", () => {
  if (!state.placements.length) return;
  pushHistory();
  state.placements = [];
  renderAll();
});

els.typeList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) {
    const typeId = deleteButton.dataset.deleteType;
    state.inventory = state.inventory.filter((item) => item.id !== typeId);
    state.placements = state.placements.filter((item) => item.typeId !== typeId);
    if (state.selectedTypeId === typeId) state.selectedTypeId = state.inventory[0]?.id || null;
    renderAll();
    return;
  }
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  state.selectedTypeId = card.dataset.typeId;
  renderAll();
});

els.typeList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.typeId);
});

els.stage.addEventListener("dragover", (event) => {
  if (event.target.closest(".cell")) event.preventDefault();
});

els.stage.addEventListener("drop", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  event.preventDefault();
  placeType(Number(cell.dataset.row), Number(cell.dataset.col), event.dataTransfer.getData("text/plain"));
});

els.stage.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  placeType(Number(cell.dataset.row), Number(cell.dataset.col));
});

els.draftList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-draft]");
  const deleteButton = event.target.closest("[data-delete-draft]");
  if (loadButton) {
    const draft = state.drafts.find((item) => item.id === loadButton.dataset.loadDraft);
    if (!draft) return;
    pushHistory();
    applySnapshot(draft);
  }
  if (deleteButton) {
    state.drafts = state.drafts.filter((item) => item.id !== deleteButton.dataset.deleteDraft);
    renderAll();
  }
});

els.workList.addEventListener("click", (event) => {
  const previewButton = event.target.closest("[data-preview-work]");
  const restoreButton = event.target.closest("[data-restore-work]");
  const renameButton = event.target.closest("[data-rename-work]");
  const removeButton = event.target.closest("[data-remove-work]");
  const confirmButton = event.target.closest("[data-confirm-rename]");
  const cancelButton = event.target.closest("[data-cancel-rename]");

  if (previewButton) {
    previewWork(previewButton.dataset.previewWork);
    return;
  }
  if (restoreButton) {
    restoreWork(restoreButton.dataset.restoreWork);
    return;
  }
  if (renameButton) {
    const work = state.works.find((item) => item.id === renameButton.dataset.renameWork);
    if (!work) return;
    renamingWorkId = work.id;
    renameDraftValue = work.name;
    renderWorks();
    return;
  }
  if (removeButton) {
    const workId = removeButton.dataset.removeWork;
    state.works = state.works.filter((item) => item.id !== workId);
    if (renamingWorkId === workId) renamingWorkId = null;
    renderAll();
    return;
  }
  if (confirmButton) {
    const workId = confirmButton.dataset.confirmRename;
    const work = state.works.find((item) => item.id === workId);
    const name = renameDraftValue.trim();
    if (work && name) work.name = uniqueWorkName(name, workId);
    renamingWorkId = null;
    renderAll();
    return;
  }
  if (cancelButton) {
    renamingWorkId = null;
    renderWorks();
  }
});

els.workList.addEventListener("input", (event) => {
  if (event.target.matches("[data-rename-input]")) renameDraftValue = event.target.value;
});

els.workList.addEventListener("keydown", (event) => {
  if (!event.target.matches("[data-rename-input]")) return;
  if (event.key === "Enter") {
    event.preventDefault();
    const workId = event.target.dataset.renameInput;
    const work = state.works.find((item) => item.id === workId);
    const name = renameDraftValue.trim();
    if (work && name) work.name = uniqueWorkName(name, workId);
    renamingWorkId = null;
    renderAll();
  }
  if (event.key === "Escape") {
    renamingWorkId = null;
    renderWorks();
  }
});

els.modalCloseBtn.addEventListener("click", closeModal);
els.modalBackdrop.addEventListener("click", (event) => {
  if (event.target === els.modalBackdrop) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.modalBackdrop.hidden) {
    closeModal();
    return;
  }
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
  } else if (key === "y") {
    event.preventDefault();
    redo();
  }
});

renderAll();
