// invoke vem do global injetado pelo Tauri (withGlobalTauri: true no tauri.conf.json)
const { invoke } = window.__TAURI__.core;
import { renderMarkdown } from "./markdown.js";

// ---------- Paleta de dots para os boards na sidebar ----------
const DOT_COLORS = ["#5090d0","#9080d0","#4ab890","#c89040","#e07070","#80a0c0"];
function dotColor(index) { return DOT_COLORS[index % DOT_COLORS.length]; }

// ---------- Estado ----------
const state = {
  boards: [],
  currentBoardId: null,
  board: null,
  editingCard: null,
};

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// ---------- Custom Select ----------
function getPriorityValue() {
  return $("#detail-priority-wrap").dataset.value || "";
}

function setPriorityValue(val) {
  const wrap = $("#detail-priority-wrap");
  wrap.dataset.value = val;
  const labels = { "": "—", high: "Alta", medium: "Média", low: "Baixa" };
  $("#detail-priority-label").textContent = labels[val] || "—";
}

function initCustomSelect() {
  const btn = $("#detail-priority-btn");
  const menu = $("#detail-priority-menu");
  const options = menu.querySelectorAll(".custom-select-option");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });

  options.forEach((opt) => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      setPriorityValue(opt.dataset.value);
      menu.classList.add("hidden");
    });
  });

  document.addEventListener("click", () => {
    menu.classList.add("hidden");
    $("#detail-tag-menu").classList.add("hidden");
  });
}

// ---------- Tag picker (flags row) ----------
function renderTagPicker() {
  const menu = $("#detail-tag-menu");
  menu.innerHTML = "";
  if (globalTags.length === 0) {
    menu.appendChild(el("div", "custom-select-option", "-"));
    return;
  }
  globalTags.forEach((tag) => {
    const opt = el("div", "custom-select-option");
    const dot = el("span", "global-tag-dot");
    dot.style.background = tag.color;
    dot.style.marginRight = "6px";
    opt.append(dot, document.createTextNode(tag.label));
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      const tags = state.editingCard.card.tags || [];
      if (!tags.find((t) => t.label === tag.label && t.color === tag.color)) {
        tags.push({ label: tag.label, color: tag.color });
        state.editingCard.card.tags = tags;
        renderTagList();
      }
      menu.classList.add("hidden");
    });
    menu.appendChild(opt);
  });
}

function initTagPicker() {
  const btn = $("#detail-tag-btn");
  const menu = $("#detail-tag-menu");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    renderTagPicker();
    menu.classList.toggle("hidden");
  });
}

// ---------- Datepicker ----------
let dpYear, dpMonth;

function dpFormat(y, m, d) {
  return `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y}`;
}

function dpParse(str) {
  if (!str) return null;
  const [d, m, y] = str.split("/").map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
}

function dpToISO(str) {
  if (!str) return null;
  const [d, m, y] = str.split("/").map(Number);
  return (y && m && d) ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
}

function dpFromISO(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-").map(Number);
  return (y && m && d) ? `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}` : "";
}

function dueDaysInfo(isoDate) {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(isoDate + "T00:00:00");
  const diff = Math.round((due - today) / 86400000);
  if (diff > 0) return { text: `${diff} ${diff === 1 ? "dia" : "dias"}`, cls: "" };
  if (diff === 0) return { text: "expira hoje", cls: "badge-due-today" };
  return { text: "expirado", cls: "badge-due-expired" };
}

function dpRender() {
  const picker = $("#detail-due-picker");
  picker.innerHTML = "";

  const header = el("div", "dp-header");
  const prevBtn = el("button", "dp-nav", "‹");
  const nextBtn = el("button", "dp-nav", "›");
  const label = el("span", "dp-label");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  label.textContent = `${months[dpMonth]} ${dpYear}`;
  prevBtn.onclick = (e) => { e.stopPropagation(); dpMonth--; if (dpMonth < 0) { dpMonth = 11; dpYear--; } dpRender(); };
  nextBtn.onclick = (e) => { e.stopPropagation(); dpMonth++; if (dpMonth > 11) { dpMonth = 0; dpYear++; } dpRender(); };
  header.append(prevBtn, label, nextBtn);
  picker.appendChild(header);

  const grid = el("div", "dp-grid");
  ["D","S","T","Q","Q","S","S"].forEach((d) => grid.appendChild(el("span", "dp-dow", d)));

  const firstDay = new Date(dpYear, dpMonth, 1).getDay();
  const daysInMonth = new Date(dpYear, dpMonth + 1, 0).getDate();
  const selDate = dpParse($("#detail-due").value);

  for (let i = 0; i < firstDay; i++) grid.appendChild(el("span", "dp-empty"));

  for (let d = 1; d <= daysInMonth; d++) {
    const btn = el("button", "dp-day", String(d));
    if (selDate && selDate.getFullYear() === dpYear && selDate.getMonth() === dpMonth && selDate.getDate() === d) {
      btn.classList.add("selected");
    }
    btn.onclick = (e) => {
      e.stopPropagation();
      $("#detail-due").value = dpFormat(dpYear, dpMonth, d);
      picker.classList.add("hidden");
    };
    grid.appendChild(btn);
  }
  picker.appendChild(grid);
}

function dpToggle() {
  const picker = $("#detail-due-picker");
  if (picker.classList.contains("hidden")) {
    const sel = dpParse($("#detail-due").value);
    const now = sel || new Date();
    dpYear = now.getFullYear();
    dpMonth = now.getMonth();
    dpRender();
    picker.classList.remove("hidden");
  } else {
    picker.classList.add("hidden");
  }
}

// ---------- Modais ----------
function uiPrompt({ title, placeholder = "", value = "" }) {
  return new Promise((resolve) => {
    const overlay = el("div", "dialog-overlay");
    const dialog  = el("div", "dialog");
    const input   = el("input", "dialog-input");
    input.placeholder = placeholder;
    input.value = value;

    const actions = el("div", "dialog-actions");
    const cancel  = el("button", "btn-sm", "Cancelar");
    const ok      = el("button", "btn-primary", "OK");
    actions.append(cancel, ok);
    dialog.append(el("div", "dialog-title", title), input, actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    input.focus(); input.select();

    const close = (val) => { overlay.remove(); resolve(val); };
    ok.onclick     = () => close(input.value.trim() || null);
    cancel.onclick = () => close(null);
    overlay.onclick = (e) => { if (e.target === overlay) close(null); };
    input.onkeydown = (e) => {
      if (e.key === "Enter")  { e.preventDefault(); close(input.value.trim() || null); }
      if (e.key === "Escape") { e.preventDefault(); close(null); }
    };
  });
}

function uiConfirm({ title, message, confirmText = "Confirmar", danger = false }) {
  return new Promise((resolve) => {
    const overlay = el("div", "dialog-overlay");
    const dialog  = el("div", "dialog");
    dialog.append(el("div", "dialog-title", title));
    if (message) dialog.append(el("div", "dialog-message", message));

    const actions = el("div", "dialog-actions");
    const cancel  = el("button", "btn-sm", "Cancelar");
    const ok      = el("button", danger ? "btn-primary danger-btn" : "btn-primary", confirmText);
    actions.append(cancel, ok);
    dialog.append(actions);
    overlay.append(dialog);
    document.body.appendChild(overlay);
    ok.focus();

    const close = (val) => { overlay.remove(); document.removeEventListener("keydown", onKey); resolve(val); };
    const onKey = (e) => { if (e.key === "Escape") close(false); if (e.key === "Enter") close(true); };
    document.addEventListener("keydown", onKey);
    ok.onclick     = () => close(true);
    cancel.onclick = () => close(false);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

// ---------- Carregamento ----------
async function loadBoards() {
  state.boards = await invoke("list_boards");
  renderSidebar();
  if (!state.currentBoardId && state.boards.length > 0) {
    await selectBoard(state.boards[0].id);
  } else if (state.boards.length === 0) {
    showEmptyState();
  }
}

async function selectBoard(id) {
  state.currentBoardId = id;
  state.board = await invoke("get_board", { id });
  renderSidebar();
  renderBoard();
}

function applyBoard(board) {
  state.board = board;
  renderBoard();
}

// ---------- Sidebar ----------
function renderSidebar() {
  const list = $("#board-list");
  list.innerHTML = "";
  state.boards.forEach((b, idx) => {
    const item  = el("div", "board-item");
    const dot   = el("span", "board-dot");
    dot.style.background = dotColor(idx);
    const name  = el("span", "board-item-name", b.name);
    item.append(dot, name);
    if (b.id === state.currentBoardId) item.classList.add("active");
    item.onclick = () => selectBoard(b.id);
    list.appendChild(item);
  });
}

function showEmptyState() {
  $("#board-header").classList.add("hidden");
  $("#columns").classList.add("hidden");
  $("#empty-state").style.display = "";
}

// ---------- Render do board ----------
function renderBoard() {
  if (!state.board) return showEmptyState();

  $("#empty-state").style.display = "none";
  $("#board-header").classList.remove("hidden");
  $("#columns").classList.remove("hidden");
  $("#board-title").textContent = state.board.name;

  const container = $("#columns");
  container.innerHTML = "";

  // colunas normais
  for (const col of state.board.columns) {
    container.appendChild(renderColumn(col));
  }

  // coluna de arquivo — sempre à direita
  container.appendChild(renderArchiveColumn());
}

// ---------- Cor de coluna ----------
function applyColumnColor(wrap, color) {
  if (!color) {
    wrap.style.borderTop    = "";
    wrap.style.background   = "";
    wrap.style.borderRadius = "";
    return;
  }
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  wrap.style.borderTop    = `2px solid rgba(${r},${g},${b},0.55)`;
  wrap.style.background   = `rgba(${r},${g},${b},0.06)`;
  wrap.style.borderRadius = "var(--radius)";
}

// ---------- Coluna normal ----------
function renderColumn(col) {
  const wrap = el("div", "column");
  wrap.dataset.columnId = col.id;

  // header
  const header    = el("div", "col-header");
  const titleWrap = el("div", "col-title-wrap");
  const nameInput = el("input", "col-title");
  nameInput.value = col.name;
  nameInput.onchange = async () => {
    applyBoard(await invoke("rename_column", {
      boardId: state.board.id, columnId: col.id, name: nameInput.value,
    }));
  };

  // controles de cor
  const colorInput = document.createElement("input");
  colorInput.type  = "color";
  Object.assign(colorInput.style, {
    position: "absolute", opacity: "0", width: "1px", height: "1px", pointerEvents: "none",
  });
  colorInput.value = col.color || "#5090d0";
  if (col.color) applyColumnColor(wrap, col.color);

  const colorSwatch = el("span", "col-color-swatch");
  if (col.color) colorSwatch.style.background = col.color;

  const colorBtn = el("button", "btn-sm col-color-btn");
  colorBtn.title = "Clique direito para remover a cor";
  colorBtn.append(colorSwatch, document.createTextNode("Cor"));
  colorBtn.addEventListener("click", (e) => { e.stopPropagation(); colorInput.click(); });
  colorBtn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    colorSwatch.style.background = "";
    applyColumnColor(wrap, null);
    const colInState = state.board.columns.find((c) => c.id === col.id);
    if (colInState) colInState.color = null;
    invoke("save_board", { board: state.board });
  });
  colorInput.addEventListener("change", async () => {
    const color = colorInput.value;
    colorSwatch.style.background = color;
    applyColumnColor(wrap, color);
    const colInState = state.board.columns.find((c) => c.id === col.id);
    if (colInState) colInState.color = color;
    await invoke("save_board", { board: state.board });
  });

  const visible = col.cards.filter((c) => !c.archived);
  const count   = el("span", "col-count", String(visible.length));
  titleWrap.append(nameInput);
  header.append(titleWrap, count);

  // drag-to-reorder na coluna
  header.draggable = true;
  header.addEventListener("dragstart", (e) => {
    if (e.target === nameInput || e.target === delBtn) { e.preventDefault(); return; }
    e.stopPropagation();
    draggedColumnId = col.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-mova-column", col.id);
    setFadedDragImage(e, wrap);
    // o espaço de destino tem o tamanho da coluna arrastada
    colPlaceholder.style.height = `${wrap.offsetHeight}px`;
    setTimeout(() => wrap.classList.add("col-dragging"), 0);
  });
  header.addEventListener("dragend", () => {
    draggedColumnId = null;
    wrap.classList.remove("col-dragging");
    colPlaceholder.remove();
  });
  // Quando um CARD é arrastado sobre o header, posiciona placeholder no início da coluna
  header.addEventListener("dragover", (e) => {
    if (draggedColumnId) return;
    e.preventDefault();
    placeCardAtStart(cardsEl);
  });
  header.addEventListener("drop", (e) => dropCardHere(e, col.id));

  const delBtn = el("button", "btn-sm danger", "Excluir");
  delBtn.title = "Excluir coluna";
  delBtn.onclick = async () => {
    const ok = await uiConfirm({
      title: `Excluir "${col.name}"`,
      message: "Todos os cards desta coluna serão removidos.",
      confirmText: "Excluir", danger: true,
    });
    if (ok) applyBoard(await invoke("delete_column", { boardId: state.board.id, columnId: col.id }));
  };
  // cards
  const cardsEl = el("div", "column-cards");
  cardsEl.dataset.columnId = col.id;
  setupDropZone(cardsEl, col.id);

  for (const card of visible) {
    cardsEl.appendChild(renderCard(card, col.id));
  }

  // botão add
  const addBtn = el("button", "add-card-btn", "+ adicionar card");
  // Ao arrastar um card sobre o botão, posiciona placeholder no início da coluna
  addBtn.addEventListener("dragover", (e) => {
    if (draggedColumnId) return;
    e.preventDefault();
    placeCardAtStart(cardsEl);
  });
  addBtn.addEventListener("drop", (e) => dropCardHere(e, col.id));
  addBtn.onclick = async () => {
    const newBoard = await invoke("add_card", { boardId: state.board.id, columnId: col.id, title: "Sem título" });
    applyBoard(newBoard);
    const newCol = newBoard.columns.find(c => c.id === col.id);
    const newCard = [...newCol.cards].reverse().find(c => !c.archived);
    if (newCard) {
      openCardDetail(col.id, newCard, { isNew: true });
      $("#detail-title").select();
    }
  };

  // rodapé: cor + excluir
  const colFooter = el("div", "col-footer");
  colFooter.append(colorBtn, colorInput, delBtn);

  wrap.append(header, addBtn, cardsEl, colFooter);
  return wrap;
}

// ---------- Coluna de arquivo ----------
function renderArchiveColumn() {
  const archived = state.board.columns.flatMap((c) => c.cards.filter((card) => card.archived));

  const wrap   = el("div", "archive-column");
  const header = el("div", "archive-col-header");
  const icon   = el("span", "archive-icon", "⬚");
  const title  = el("span", "archive-col-title", "arquivo");
  header.append(icon, title);
  wrap.appendChild(header);

  const cardsArea = el("div", "archive-cards");
  for (const card of archived) {
    const c = el("div", "card-archived");
    c.append(el("div", "card-archived-title", card.title));

    const unarchBtn = el("button", "card-unarchive-btn", "↩");
    unarchBtn.title = "Desarquivar";
    unarchBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      applyBoard(await invoke("archive_card", { boardId: state.board.id, cardId: card.id, archived: false }));
    });
    c.appendChild(unarchBtn);

    c.onclick = () => openCardDetail(
      state.board.columns.find((col) => col.cards.some((x) => x.id === card.id))?.id,
      card
    );
    cardsArea.appendChild(c);
  }
  wrap.appendChild(cardsArea);

  if (archived.length > 0) {
    const footer = el("div", "archive-footer");
    const clearBtn = el("button", "btn-sm danger", "Excluir todos");
    clearBtn.onclick = async () => {
      const ok = await uiConfirm({
        title: "Excluir arquivo",
        message: "Todos os cards arquivados serão removidos permanentemente.",
        confirmText: "Excluir tudo",
        danger: true,
      });
      if (!ok) return;
      for (const col of state.board.columns) {
        col.cards = col.cards.filter((c) => !c.archived);
      }
      await invoke("save_board", { board: state.board });
      renderBoard();
    };
    footer.appendChild(clearBtn);
    wrap.appendChild(footer);
  }

  return wrap;
}

// ---------- Card ----------
// Ícones das ações do card: SVG fixo do próprio app (nenhum texto do usuário entra aqui).
const ICON_ARROW_RIGHT =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
const ICON_ARCHIVE =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="12" height="3.2" rx="0.8"/><path d="M3.2 6.2V12.5a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V6.2M6.5 9h3"/></svg>';

function renderCard(card, columnId) {
  const c = el("div", "card");
  c.draggable = true;
  c.dataset.cardId = card.id;

  // borda esquerda vermelha em alta prioridade
  if (card.priority === "high") c.classList.add("priority-high");

  const title = el("div", "card-title", card.title);
  title.title = card.title; // título completo no hover, para quando ele é cortado com "..."
  c.append(title);

  if (card.description?.trim()) {
    const plain = card.description.replace(/[#*`>\-]/g, "").trim();
    c.append(el("div", "card-desc", plain));
  }

  // footer: badges + data
  const footer = el("div", "card-footer");
  const badges = el("div", "badges");

  if (card.priority) {
    const labels = { high: "alta", medium: "média", low: "baixa" };
    badges.append(el("span", `badge badge-priority-${card.priority}`, labels[card.priority]));
  }
  if (card.status) {
    badges.append(el("span", "badge badge-status", card.status));
  }
  for (const tag of card.tags || []) {
    const t = el("span", "badge badge-tag", tag.label);
    // monta cor de fundo derivada da cor da tag (escurece para o bg, usa a cor no fg)
    t.style.background = hexToMuted(tag.color);
    t.style.color = tag.color;
    badges.append(t);
  }
  footer.appendChild(badges);

  if (card.due_date) {
    const info = dueDaysInfo(card.due_date);
    if (info) {
      const cls = ["badge", "badge-due", info.cls].filter(Boolean).join(" ");
      footer.append(el("span", cls, info.text));
    }
  }

  if (footer.children.length) c.appendChild(footer);

  // Ações do card (aparecem no hover): mandar para a próxima coluna e arquivar.
  const actions = el("div", "card-actions");

  const colIdx = state.board.columns.findIndex((col) => col.id === columnId);
  const nextCol = state.board.columns[colIdx + 1];
  const moveBtn = el("button", "card-action-btn");
  moveBtn.innerHTML = ICON_ARROW_RIGHT;
  moveBtn.title = nextCol ? `Mover para "${nextCol.name}"` : "Já está na última coluna";
  moveBtn.disabled = !nextCol;
  moveBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!nextCol) return;
    const moved = removeCardFromState(card.id);
    if (!moved) return;
    insertCardInState(nextCol.id, moved, null); // entra no fim da próxima coluna
    await invoke("save_board", { board: state.board });
    renderBoard();
  });

  const archBtn = el("button", "card-action-btn");
  archBtn.innerHTML = ICON_ARCHIVE;
  archBtn.title = "Arquivar";
  archBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    applyBoard(await invoke("archive_card", { boardId: state.board.id, cardId: card.id, archived: true }));
  });

  actions.append(moveBtn, archBtn);
  c.appendChild(actions);

  c.onclick = () => openCardDetail(columnId, card);

  c.addEventListener("dragstart", (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ cardId: card.id, fromColumn: columnId }));
    setFadedDragImage(e, c);
    // o espaço de destino tem a altura do card arrastado
    placeholder.style.height = `${c.offsetHeight}px`;
    requestAnimationFrame(() => c.classList.add("dragging"));
  });
  c.addEventListener("dragend", () => { c.classList.remove("dragging"); placeholder.remove(); });

  return c;
}

// Escurece um hex pra usar como fundo do badge de tag (opacidade baixa)
function hexToMuted(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},0.15)`;
}

// ---------- Drag and drop com reordenação ----------
const placeholder    = el("div", "card-placeholder");
const colPlaceholder = el("div", "col-placeholder");

// Imagem de arraste semitransparente: assim dá para ver o destino por baixo do que está sendo
// arrastado. O clone fica fora da tela só durante o dragstart (o WebKit tira a "foto" na hora).
function setFadedDragImage(e, node) {
  const ghost = node.cloneNode(true);
  ghost.classList.add("drag-ghost");
  ghost.style.width = `${node.offsetWidth}px`;
  document.body.appendChild(ghost);
  const r = node.getBoundingClientRect();
  e.dataTransfer.setDragImage(ghost, e.clientX - r.left, e.clientY - r.top);
  setTimeout(() => ghost.remove(), 0);
}
let draggedColumnId  = null;

function placeCardAtStart(cardsEl) {
  const first = cardsEl.querySelector(".card:not(.dragging)");
  if (first && placeholder.nextSibling !== first) cardsEl.insertBefore(placeholder, first);
  else if (!first && placeholder.parentNode !== cardsEl) cardsEl.appendChild(placeholder);
}

async function dropCardHere(e, columnId) {
  if (draggedColumnId) return;
  e.preventDefault();
  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
  const next = placeholder.nextElementSibling;
  const beforeCardId = next?.classList.contains("card") ? next.dataset.cardId : null;
  placeholder.remove();
  const card = removeCardFromState(data.cardId);
  if (!card) return;
  insertCardInState(columnId, card, beforeCardId);
  await invoke("save_board", { board: state.board });
  renderBoard();
}

// Igual ao getDragAfterElement mas com histerese: exige que o cursor passe
// além do midpoint em ±H px antes de mudar de posição, eliminando oscilação.
function getDragAfterElement(zone, y, currentAfter) {
  const H = 8;
  const els = [...zone.querySelectorAll(".card:not(.dragging)")];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const mid = box.top + box.height / 2;
    // Se o placeholder já está antes deste card, exige descer H px além do mid para sair.
    // Caso contrário, exige subir H px acima do mid para entrar.
    const threshold = currentAfter === child ? mid + H : mid - H;
    const offset = y - threshold;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: -Infinity, element: null }).element;
}

function setupDropZone(zone, columnId) {
  let lastAfter = undefined;

  zone.addEventListener("dragover", (e) => {
    if (draggedColumnId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const after = getDragAfterElement(zone, e.clientY, lastAfter);
    if (after !== lastAfter) {
      lastAfter = after;
      if (after == null) zone.appendChild(placeholder);
      else zone.insertBefore(placeholder, after);
    }
  });

  zone.addEventListener("dragleave", (e) => {
    if (draggedColumnId) return;
    const col = zone.closest(".column") ?? zone;
    if (!col.contains(e.relatedTarget)) {
      lastAfter = undefined;
      placeholder.remove();
    }
  });

  zone.addEventListener("drop", (e) => { lastAfter = undefined; dropCardHere(e, columnId); });
}

function removeCardFromState(cardId) {
  for (const col of state.board.columns) {
    const i = col.cards.findIndex((c) => c.id === cardId);
    if (i !== -1) return col.cards.splice(i, 1)[0];
  }
  return null;
}

function insertCardInState(columnId, card, beforeCardId) {
  const col = state.board.columns.find((c) => c.id === columnId);
  if (!col) return;
  if (beforeCardId == null) {
    let lastVisible = -1;
    col.cards.forEach((c, idx) => { if (!c.archived) lastVisible = idx; });
    col.cards.splice(lastVisible + 1, 0, card);
  } else {
    const idx = col.cards.findIndex((c) => c.id === beforeCardId);
    col.cards.splice(idx === -1 ? col.cards.length : idx, 0, card);
  }
}

// ---------- Reordenação de colunas ----------
function setupColumnDropZone() {
  const container = $("#columns");

  container.addEventListener("dragover", (e) => {
    if (!draggedColumnId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const cols = [...container.querySelectorAll(".column:not(.col-dragging)")];
    let insertBefore = null;
    for (const c of cols) {
      const rect = c.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) { insertBefore = c; break; }
    }
    const archiveCol = container.querySelector(".archive-column");
    container.insertBefore(colPlaceholder, insertBefore || archiveCol || null);
  });

  container.addEventListener("drop", async (e) => {
    if (!draggedColumnId) return;
    e.preventDefault();

    const children = [...container.children];
    const phIdx    = children.indexOf(colPlaceholder);
    colPlaceholder.remove();
    if (phIdx === -1) { draggedColumnId = null; return; }

    let newIdx = 0;
    for (let i = 0; i < phIdx; i++) {
      const child = children[i];
      if (child.classList.contains("column") && !child.classList.contains("col-dragging")) newIdx++;
    }

    const cols    = state.board.columns;
    const fromIdx = cols.findIndex((c) => c.id === draggedColumnId);
    draggedColumnId = null;
    if (fromIdx === -1) return;

    const [moved] = cols.splice(fromIdx, 1);
    cols.splice(newIdx, 0, moved);
    await invoke("save_board", { board: state.board });
    renderBoard();
  });
}

// ---------- Overlay de detalhe ----------
function openCardDetail(columnId, card, { isNew = false } = {}) {
  if (!card) return;
  state.editingCard = { columnId, card: structuredClone(card) };
  const c = state.editingCard.card;

  $("#detail-title").value    = c.title;
  setPriorityValue(c.priority || "");
  $("#detail-due").value      = dpFromISO(c.due_date);
  $("#desc-edit").value       = c.description || "";

  renderTagList();
  setDescMode(isNew || !c.description ? "edit" : "view");

  $("#archive-card-btn").textContent = c.archived ? "Desarquivar" : "Arquivar";
  $("#card-overlay").classList.remove("hidden");
}

function closeCardDetail() {
  $("#card-overlay").classList.add("hidden");
  state.editingCard = null;
}

function renderTagList() {
  const list = $("#tag-list");
  list.innerHTML = "";
  const tags = state.editingCard.card.tags || [];
  tags.forEach((tag, i) => {
    const chip = el("span", "tag-chip badge-tag", tag.label);
    chip.style.background = hexToMuted(tag.color);
    chip.style.color = tag.color;
    const x = el("button", null, "✕");
    x.onclick = () => { tags.splice(i, 1); renderTagList(); };
    chip.appendChild(x);
    list.appendChild(chip);
  });
}

function renderDescView() {
  const edit = $("#desc-edit");
  const view = $("#desc-view");
  view.innerHTML = renderMarkdown(edit.value);
  view.querySelectorAll(".md-checkbox").forEach(cb => {
    cb.addEventListener("click", async () => {
      const idx = parseInt(cb.dataset.idx);
      let count = 0;
      edit.value = edit.value.replace(
        /^([-*]\s+\[)([ xX])(\])/gm,
        (match, pre, state, post) =>
          count++ === idx ? pre + (state.trim() === "" ? "x" : " ") + post : match
      );
      renderDescView();
      if (state.editingCard) await persistCard();
    });
  });
}

function setDescMode(mode) {
  const edit = $("#desc-edit");
  const view = $("#desc-view");
  if (mode === "edit") {
    edit.classList.remove("hidden");
    view.classList.add("hidden");
    $("#edit-mode-btn").classList.add("active");
    $("#view-mode-btn").classList.remove("active");
  } else {
    renderDescView();
    view.classList.remove("hidden");
    edit.classList.add("hidden");
    $("#view-mode-btn").classList.add("active");
    $("#edit-mode-btn").classList.remove("active");
  }
}

async function persistCard() {
  const c = state.editingCard.card;
  c.title       = $("#detail-title").value.trim() || "Sem título";
  c.priority    = getPriorityValue() || null;
  c.due_date    = dpToISO($("#detail-due").value);
  c.description = $("#desc-edit").value;
  applyBoard(await invoke("update_card", { boardId: state.board.id, card: c }));
}

async function saveCard() {
  await persistCard();
  closeCardDetail();
}

// ---------- Eventos ----------
function bindEvents() {
  const newBoard = async () => {
    const name = await uiPrompt({ title: "Novo painel", placeholder: "Nome do painel" });
    if (name) {
      const board = await invoke("create_board", { name });
      await loadBoards();
      await selectBoard(board.id);
    }
  };
  $("#new-board-btn").onclick   = newBoard;
  $("#empty-new-board").onclick = newBoard;

  $("#add-column-btn").onclick = async () => {
    const name = await uiPrompt({ title: "Nova coluna", placeholder: "Nome da coluna" });
    if (name) applyBoard(await invoke("add_column", { boardId: state.board.id, name }));
  };

  $("#delete-board-btn").onclick = async () => {
    const ok = await uiConfirm({
      title: "Excluir painel",
      message: `O painel "${state.board.name}" será removido permanentemente.`,
      confirmText: "Excluir", danger: true,
    });
    if (ok) {
      await invoke("delete_board", { id: state.board.id });
      state.currentBoardId = null;
      state.board = null;
      await loadBoards();
    }
  };

  $("#close-detail").onclick  = closeCardDetail;
  $("#card-overlay").onclick  = (e) => { if (e.target.id === "card-overlay") closeCardDetail(); };
  $("#edit-mode-btn").onclick = () => setDescMode("edit");
  $("#view-mode-btn").onclick = () => setDescMode("view");
  $("#save-card-btn").onclick = saveCard;

  $("#detail-due").onclick = (e) => { e.stopPropagation(); dpToggle(); };
  $("#detail-due-picker").onclick = (e) => e.stopPropagation();
  document.addEventListener("click", () => { $("#detail-due-picker").classList.add("hidden"); });

  $("#archive-card-btn").onclick = async () => {
    const c = state.editingCard.card;
    applyBoard(await invoke("archive_card", { boardId: state.board.id, cardId: c.id, archived: !c.archived }));
    closeCardDetail();
  };

  $("#delete-card-btn").onclick = async () => {
    const ok = await uiConfirm({
      title: "Excluir card",
      message: "Este card será removido permanentemente.",
      confirmText: "Excluir", danger: true,
    });
    if (ok) {
      applyBoard(await invoke("delete_card", { boardId: state.board.id, cardId: state.editingCard.card.id }));
      closeCardDetail();
    }
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#card-overlay").classList.contains("hidden")) closeCardDetail();
  });

  // Links da descrição abrem no navegador padrão, e não navegam a própria janela do app.
  // O listener fica no contêiner (não em cada <a>), porque o conteúdo é trocado a cada render.
  $("#desc-view").addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    e.preventDefault();
    const href = link.getAttribute("href") || "";
    // Só web e e-mail: qualquer outro esquema é ignorado.
    if (!/^(https?:\/\/|mailto:)/i.test(href)) return;
    window.__TAURI__.opener.openUrl(href).catch(console.error);
  });
}

// ---------- Modal de tags globais ----------
let globalTags = [];

async function loadGlobalTags() {
  globalTags = await invoke("list_tags");
}

function renderGlobalTagList() {
  const list = $("#global-tags-list");
  list.innerHTML = "";
  if (globalTags.length === 0) {
    list.appendChild(el("div", "global-tag-empty", "Nenhuma tag criada ainda."));
    return;
  }
  globalTags.forEach((tag) => {
    const row = el("div", "global-tag-row");
    const dot = el("span", "global-tag-dot");
    dot.style.background = tag.color;
    const label = el("span", "global-tag-label", tag.label);
    const del = el("button", "global-tag-del", "✕");
    del.title = "Excluir tag";
    del.onclick = async () => {
      globalTags = await invoke("delete_tag", { id: tag.id });
      renderGlobalTagList();
    };
    row.append(dot, label, del);
    list.appendChild(row);
  });
}

function openTagsModal() {
  renderGlobalTagList();
  $("#new-tag-label").value = "";
  $("#tags-overlay").classList.remove("hidden");
  $("#new-tag-label").focus();
}

function closeTagsModal() {
  $("#tags-overlay").classList.add("hidden");
}

// ---------- Boot ----------
bindEvents();
initCustomSelect();
initTagPicker();
setupColumnDropZone();
loadBoards().catch(console.error);
loadGlobalTags().catch(console.error);

$("#reload-app-btn").onclick = () => loadBoards().catch(console.error);

// Eventos do modal de tags (fora do bindEvents pois dependem de loadGlobalTags)
$("#tags-btn").onclick = openTagsModal;
$("#close-tags-btn").onclick = closeTagsModal;
$("#tags-overlay").onclick = (e) => { if (e.target.id === "tags-overlay") closeTagsModal(); };

$("#create-tag-btn").onclick = async () => {
  const label = $("#new-tag-label").value.trim();
  const color = $("#new-tag-color").value;
  if (!label) return;
  globalTags = await invoke("create_tag", { label, color });
  $("#new-tag-label").value = "";
  renderGlobalTagList();
};

$("#new-tag-label").onkeydown = (e) => {
  if (e.key === "Enter") $("#create-tag-btn").click();
};
