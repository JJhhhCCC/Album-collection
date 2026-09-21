import { PhotoBookDB } from "./db.js";
import { optimizeImage } from "./image.js";

const $ = (id) => document.getElementById(id);
const ui = {
  add: $("addButton"), manage: $("manageButton"), emptyAdd: $("emptyAddButton"),
  empty: $("emptyState"), stackFrame: $("stackFrame"), stack: $("bookStack"),
  libraryActions: $("libraryActions"), clearAll: $("clearAllButton"), status: $("statusMessage"),
  composer: $("composer"), closeComposer: $("closeComposerButton"), addGroup: $("addGroupButton"),
  generate: $("generateButton"), groups: $("stagingGroups"), groupCount: $("groupCount"), fileInput: $("fileInput"),
  reader: $("reader"), readerBook: $("readerBookTitle"), readerPage: $("readerPageLabel"),
  readerImage: $("readerImage"), readerImageWrap: $("readerImageWrap"), readerPaper: $("readerPaper"),
  readerCaption: $("readerCaption"), readerStage: $("readerStage"), readerTip: $("readerTip"),
  previous: $("previousPageButton"), next: $("nextPageButton"), closeReader: $("closeReaderButton"), resetZoom: $("resetZoomButton"),
};

const state = {
  db: null,
  books: [],
  groups: [],
  managing: false,
  importing: false,
  reader: null,
  readerUrl: null,
  drag: null,
  gesture: { points: new Map(), start: null, scaleAtStart: 1, pinchDistance: 0, lastTap: 0 },
  zoom: { scale: 1, x: 0, y: 0 },
};

function uid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function button(label, onClick, { className = "", ariaLabel = label, disabled = false } = {}) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  element.setAttribute("aria-label", ariaLabel);
  element.disabled = disabled;
  element.addEventListener("click", onClick);
  return element;
}

function setStatus(message = "") {
  ui.status.textContent = message;
}

function titleFor(bookId) {
  const position = state.books.findIndex((book) => book.id === bookId);
  return `book${position + 1}`;
}

function move(items, from, to) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return false;
  const [entry] = items.splice(from, 1);
  items.splice(to, 0, entry);
  return true;
}

function showComposer({ openPicker = false } = {}) {
  ui.composer.hidden = false;
  renderGroups();
  if (openPicker) requestAnimationFrame(() => ui.fileInput.click());
}

function closeComposer() {
  if (state.importing) return;
  ui.composer.hidden = true;
}

function disposeEntry(entry) {
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
}

function isImageCandidate(file) {
  return file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name || "");
}

function addGroupFromFiles(files) {
  const accepted = Array.from(files).filter(isImageCandidate);
  if (!accepted.length) {
    setStatus("请选择可读取的图片文件。");
    return;
  }
  const group = {
    id: uid(),
    error: "",
    files: accepted.map((file) => ({ id: uid(), file, previewUrl: URL.createObjectURL(file), error: "" })),
  };
  state.groups.push(group);
  setStatus(`已添加第 ${state.groups.length} 组图片。`);
  renderGroups();
}

function removeGroup(groupId) {
  const index = state.groups.findIndex((group) => group.id === groupId);
  if (index < 0) return;
  state.groups[index].files.forEach(disposeEntry);
  state.groups.splice(index, 1);
  renderGroups();
}

function moveGroup(groupId, delta) {
  const index = state.groups.findIndex((group) => group.id === groupId);
  if (move(state.groups, index, index + delta)) renderGroups();
}

function movePhoto(groupId, photoId, delta) {
  const group = state.groups.find((entry) => entry.id === groupId);
  if (!group) return;
  const index = group.files.findIndex((entry) => entry.id === photoId);
  if (move(group.files, index, index + delta)) renderGroups();
}

function removePhoto(groupId, photoId) {
  const group = state.groups.find((entry) => entry.id === groupId);
  if (!group) return;
  const index = group.files.findIndex((entry) => entry.id === photoId);
  if (index < 0) return;
  disposeEntry(group.files[index]);
  group.files.splice(index, 1);
  if (!group.files.length) removeGroup(groupId);
  else renderGroups();
}

function createOrderTools({ onUp, onDown, onDelete, upDisabled, downDisabled, deleteLabel = "删除" }) {
  const tools = document.createElement("div");
  tools.className = "group-tools";
  tools.append(
    button("↑", onUp, { ariaLabel: "上移", disabled: upDisabled || state.importing }),
    button("↓", onDown, { ariaLabel: "下移", disabled: downDisabled || state.importing }),
    button("×", onDelete, { className: "danger", ariaLabel: deleteLabel, disabled: state.importing }),
  );
  return tools;
}

function renderGroups() {
  ui.groups.replaceChildren();
  ui.groupCount.textContent = `${state.groups.length} 本`;
  ui.generate.disabled = state.importing || !state.groups.length || state.groups.some((group) => !group.files.length);
  ui.addGroup.disabled = state.importing;

  if (!state.groups.length) {
    const empty = document.createElement("p");
    empty.className = "staging-empty";
    empty.textContent = "先添加一组图片；每一组会变成一本书。";
    ui.groups.append(empty);
    return;
  }

  state.groups.forEach((group, groupIndex) => {
    const card = document.createElement("article");
    card.className = "staging-group";
    card.draggable = !state.importing;
    card.addEventListener("dragstart", () => {
      state.drag = { type: "group", id: group.id };
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => { state.drag = null; card.classList.remove("is-dragging"); });
    card.addEventListener("dragover", (event) => event.preventDefault());
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      if (state.drag?.type !== "group") return;
      const from = state.groups.findIndex((entry) => entry.id === state.drag.id);
      if (move(state.groups, from, groupIndex)) renderGroups();
    });

    const header = document.createElement("header");
    header.className = "staging-group__header";
    const label = document.createElement("div");
    const strong = document.createElement("div");
    strong.className = "staging-group__label";
    strong.textContent = `book${groupIndex + 1}`;
    const meta = document.createElement("div");
    meta.className = "staging-group__meta";
    meta.textContent = group.error || `${group.files.length} 张照片`;
    if (group.error) meta.style.color = "#a82929";
    label.append(strong, meta);
    header.append(label, createOrderTools({
      onUp: () => moveGroup(group.id, -1), onDown: () => moveGroup(group.id, 1), onDelete: () => removeGroup(group.id),
      upDisabled: groupIndex === 0, downDisabled: groupIndex === state.groups.length - 1, deleteLabel: "删除这组图片",
    }));
    card.append(header);

    const list = document.createElement("ol");
    list.className = "photo-list";
    group.files.forEach((entry, photoIndex) => {
      const row = document.createElement("li");
      row.className = "photo-row";
      row.draggable = !state.importing;
      row.addEventListener("dragstart", (event) => {
        event.stopPropagation();
        state.drag = { type: "photo", groupId: group.id, id: entry.id };
        row.classList.add("is-dragging");
      });
      row.addEventListener("dragend", () => { state.drag = null; row.classList.remove("is-dragging"); });
      row.addEventListener("dragover", (event) => event.preventDefault());
      row.addEventListener("drop", (event) => {
        event.preventDefault(); event.stopPropagation();
        if (state.drag?.type !== "photo" || state.drag.groupId !== group.id) return;
        const from = group.files.findIndex((item) => item.id === state.drag.id);
        if (move(group.files, from, photoIndex)) renderGroups();
      });
      const preview = document.createElement("img");
      preview.src = entry.previewUrl;
      preview.alt = "";
      const details = document.createElement("div");
      const name = document.createElement("div");
      name.className = "photo-row__name";
      name.textContent = entry.file.name || "未命名照片";
      details.append(name);
      if (entry.error) {
        const error = document.createElement("div");
        error.className = "photo-row__error";
        error.textContent = entry.error;
        details.append(error);
      }
      const tools = document.createElement("div");
      tools.className = "photo-tools";
      tools.append(
        button("←", () => movePhoto(group.id, entry.id, -1), { ariaLabel: "照片左移", disabled: photoIndex === 0 || state.importing }),
        button("→", () => movePhoto(group.id, entry.id, 1), { ariaLabel: "照片右移", disabled: photoIndex === group.files.length - 1 || state.importing }),
        button("×", () => removePhoto(group.id, entry.id), { className: "danger", ariaLabel: "删除照片", disabled: state.importing }),
      );
      row.append(preview, details, tools);
      list.append(row);
    });
    card.append(list);
    ui.groups.append(card);
  });
}

async function warnOnStorage() {
  const estimate = await state.db.getStorageEstimate();
  if (!estimate?.quota || !estimate.usage) return;
  const percentage = estimate.usage / estimate.quota;
  if (percentage >= 0.8) setStatus(`本机照片书已使用约 ${Math.round(percentage * 100)}% 的可用空间，请清理不需要的书本。`);
}

async function importGroups() {
  if (state.importing || !state.groups.length) return;
  state.importing = true;
  ui.generate.textContent = "正在生成…";
  renderGroups();
  if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
  const successful = new Set();
  let imported = 0;
  const startingOrder = state.books.length;

  for (const group of state.groups) {
    group.error = "";
    group.files.forEach((file) => { file.error = ""; });
    let transientBook;
    try {
      transientBook = await state.db.createImportingBook(startingOrder + imported);
      for (let index = 0; index < group.files.length; index += 1) {
        const entry = group.files[index];
        ui.generate.textContent = `正在处理第 ${imported + 1} 本 · ${index + 1}/${group.files.length}`;
        let image;
        try {
          image = await optimizeImage(entry.file);
        } catch (error) {
          entry.error = error.message || "这张图片无法读取。";
          throw error;
        }
        await state.db.addPage({ bookId: transientBook.id, order: index, ...image });
      }
      await state.db.completeBook(transientBook.id, group.files.length);
      successful.add(group.id);
      imported += 1;
    } catch (error) {
      if (transientBook) await state.db.deleteBook(transientBook.id).catch(() => undefined);
      group.error = error.message || "这组图片无法生成，请移除有问题的照片后重试。";
      const failed = group.files.find((entry) => !entry.error);
      if (failed) failed.error = "这一组未生成，请检查文件后重试。";
    }
  }

  state.groups = state.groups.filter((group) => {
    if (!successful.has(group.id)) return true;
    group.files.forEach(disposeEntry);
    return false;
  });
  await refreshLibrary();
  await warnOnStorage();
  state.importing = false;
  ui.generate.textContent = "生成书本";
  if (state.groups.length) {
    setStatus(`${imported} 本已生成；其余图片组需要处理后重试。`);
    renderGroups();
  } else {
    setStatus(`${imported} 本书已保存到这台设备。`);
    closeComposer();
  }
}

function renderLibrary() {
  const hasBooks = state.books.length > 0;
  ui.empty.hidden = hasBooks;
  ui.stackFrame.hidden = !hasBooks;
  ui.manage.hidden = !hasBooks;
  ui.manage.textContent = state.managing ? "完成" : "整理";
  ui.libraryActions.hidden = !hasBooks || !state.managing;
  ui.stack.replaceChildren();
  if (!hasBooks) return;

  state.books.forEach((book, index) => {
    const isCover = index === state.books.length - 1;
    const item = document.createElement("article");
    item.className = `book-item ${isCover ? "book-item--cover" : "book-item--spine"}`;
    item.dataset.bookId = book.id;
    item.dataset.color = book.colorKey || "cobalt";
    item.draggable = state.managing;
    item.addEventListener("dragstart", () => {
      if (!state.managing) return;
      state.drag = { type: "book", id: book.id };
      item.classList.add("is-dragging");
    });
    item.addEventListener("dragend", () => { state.drag = null; item.classList.remove("is-dragging"); });
    item.addEventListener("dragover", (event) => { if (state.managing) event.preventDefault(); });
    item.addEventListener("drop", async (event) => {
      event.preventDefault();
      if (!state.managing || state.drag?.type !== "book") return;
      const from = state.books.findIndex((entry) => entry.id === state.drag.id);
      if (!move(state.books, from, index)) return;
      await state.db.setBookOrder(state.books.map((entry) => entry.id));
      await refreshLibrary();
    });
    const open = button("", () => openBook(book.id));
    open.className = "book-open";
    const title = document.createElement("span");
    title.className = "book-open__title";
    title.textContent = `book${index + 1}`;
    const count = document.createElement("span");
    count.className = "book-open__count";
    count.textContent = `${book.pageCount} 页`;
    open.append(title, count);
    item.append(open);
    if (state.managing) {
      const tools = document.createElement("div");
      tools.className = "book-tools";
      tools.append(
        button("↑", () => reorderBook(index, -1), { ariaLabel: `上移 book${index + 1}`, disabled: index === 0 }),
        button("↓", () => reorderBook(index, 1), { ariaLabel: `下移 book${index + 1}`, disabled: index === state.books.length - 1 }),
        button("×", () => deleteBook(book.id), { className: "danger", ariaLabel: `删除 book${index + 1}` }),
      );
      item.append(tools);
    }
    ui.stack.append(item);
  });
}

async function refreshLibrary() {
  state.books = await state.db.listBooks();
  renderLibrary();
}

async function reorderBook(index, delta) {
  if (!move(state.books, index, index + delta)) return;
  await state.db.setBookOrder(state.books.map((book) => book.id));
  await refreshLibrary();
}

async function deleteBook(bookId) {
  const name = titleFor(bookId);
  if (!confirm(`确定删除 ${name} 吗？其中的所有照片都会从这台设备移除。`)) return;
  await state.db.deleteBook(bookId);
  setStatus(`${name} 已删除。`);
  await refreshLibrary();
}

async function clearLibrary() {
  if (!confirm("确定清空全部书本吗？此操作会删除这台设备中的所有照片书。")) return;
  await state.db.deleteAll();
  state.managing = false;
  setStatus("全部书本已清空。");
  await refreshLibrary();
}

function setZoom(scale = 1, x = 0, y = 0) {
  const stage = ui.readerStage.getBoundingClientRect();
  const safeScale = Math.min(4, Math.max(1, scale));
  const maxX = ((stage.width * safeScale) - stage.width) / 2;
  const maxY = ((stage.height * safeScale) - stage.height) / 2;
  state.zoom = { scale: safeScale, x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  ui.readerImageWrap.style.transform = `translate3d(${state.zoom.x}px, ${state.zoom.y}px, 0) scale(${state.zoom.scale})`;
  ui.resetZoom.hidden = safeScale <= 1.01;
}

function resetZoom() { setZoom(); }

function updateHistoryPage() {
  if (!state.reader || !history.state?.photoBook) return;
  const photoBook = { ...history.state.photoBook, page: state.reader.page };
  history.replaceState({ ...history.state, photoBook }, "", `#book=${encodeURIComponent(state.reader.bookId)}&page=${state.reader.page + 1}`);
}

function wait(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }

async function showReaderPage({ direction = 0, animate = false } = {}) {
  if (!state.reader) return;
  const { bookId, page } = state.reader;
  if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ui.readerPaper.classList.add(direction > 0 ? "is-turning-next" : "is-turning-previous");
    await wait(310);
  } else if (animate) {
    ui.readerPaper.classList.add("is-fading");
  }
  const imagePage = await state.db.getPage(bookId, page);
  if (!imagePage) throw new Error("无法读取这一页照片。");
  const nextUrl = URL.createObjectURL(imagePage.blob);
  const previousUrl = state.readerUrl;
  ui.readerImage.src = nextUrl;
  ui.readerImage.alt = `${titleFor(bookId)}，第 ${page + 1} 页，${imagePage.originalName}`;
  ui.readerCaption.textContent = imagePage.originalName;
  ui.readerPage.textContent = `${page + 1} / ${state.reader.pageCount}`;
  state.readerUrl = nextUrl;
  state.db.setLastReadPage(bookId, page).catch(() => undefined);
  updateHistoryPage();
  resetZoom();
  await Promise.all([state.db.getPage(bookId, Math.max(0, page - 1)), state.db.getPage(bookId, Math.min(state.reader.pageCount - 1, page + 1))]);
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  ui.readerPaper.classList.remove("is-turning-next", "is-turning-previous", "is-fading");
}

async function openBook(bookId, requestedPage, { fromHistory = false } = {}) {
  const book = state.books.find((entry) => entry.id === bookId) || await state.db.getBook(bookId);
  if (!book || book.status !== "ready") {
    setStatus("这本书暂时无法打开。");
    return;
  }
  const page = Number.isInteger(requestedPage) ? Math.max(0, Math.min(requestedPage, book.pageCount - 1)) : Math.max(0, Math.min(book.lastReadPage || 0, book.pageCount - 1));
  state.reader = { bookId, page, pageCount: book.pageCount, busy: false };
  ui.reader.hidden = false;
  ui.reader.setAttribute("aria-hidden", "false");
  ui.readerBook.textContent = titleFor(bookId);
  ui.readerPage.textContent = "加载中";
  ui.readerCaption.textContent = "";
  if (!fromHistory) history.pushState({ photoBook: { bookId, page } }, "", `#book=${encodeURIComponent(bookId)}&page=${page + 1}`);
  try {
    await showReaderPage();
    ui.closeReader.focus({ preventScroll: true });
  } catch (error) {
    setStatus(error.message || "无法打开照片。");
    teardownReader();
  }
}

function teardownReader() {
  if (state.readerUrl) URL.revokeObjectURL(state.readerUrl);
  state.readerUrl = null;
  state.reader = null;
  resetZoom();
  ui.reader.hidden = true;
  ui.reader.setAttribute("aria-hidden", "true");
}

function closeReader() {
  if (!state.reader) return;
  if (history.state?.photoBook) history.back();
  else teardownReader();
}

async function turnPage(direction) {
  if (!state.reader || state.reader.busy || state.zoom.scale > 1.01) return;
  const target = state.reader.page + direction;
  if (target < 0 || target >= state.reader.pageCount) {
    ui.readerTip.textContent = target < 0 ? "已经是第一页" : "已经是最后一页";
    return;
  }
  state.reader.busy = true;
  state.reader.page = target;
  try {
    await showReaderPage({ direction, animate: true });
    ui.readerTip.textContent = "左右滑动翻页 · 双指缩放照片";
  } catch (error) {
    state.reader.page -= direction;
    setStatus(error.message || "翻页失败。 ");
  } finally {
    if (state.reader) state.reader.busy = false;
  }
}

function distance(points) {
  const [a, b] = [...points.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function bindReaderGestures() {
  ui.readerStage.addEventListener("pointerdown", (event) => {
    if (!state.reader || event.target.closest("button")) return;
    ui.readerStage.setPointerCapture?.(event.pointerId);
    state.gesture.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.gesture.points.size === 1) state.gesture.start = { x: event.clientX, y: event.clientY, time: Date.now() };
    if (state.gesture.points.size === 2) {
      state.gesture.pinchDistance = distance(state.gesture.points);
      state.gesture.scaleAtStart = state.zoom.scale;
      state.gesture.start = null;
    }
  });
  ui.readerStage.addEventListener("pointermove", (event) => {
    if (!state.gesture.points.has(event.pointerId)) return;
    event.preventDefault();
    const previous = state.gesture.points.get(event.pointerId);
    state.gesture.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.gesture.points.size >= 2) {
      const factor = distance(state.gesture.points) / Math.max(1, state.gesture.pinchDistance);
      setZoom(state.gesture.scaleAtStart * factor, state.zoom.x, state.zoom.y);
    } else if (state.zoom.scale > 1.01) {
      setZoom(state.zoom.scale, state.zoom.x + event.clientX - previous.x, state.zoom.y + event.clientY - previous.y);
    }
  });
  const finish = (event) => {
    if (!state.gesture.points.has(event.pointerId)) return;
    const current = state.gesture.points.get(event.pointerId);
    const start = state.gesture.start;
    state.gesture.points.delete(event.pointerId);
    if (state.gesture.points.size === 1) {
      state.gesture.pinchDistance = 0;
      state.gesture.start = null;
      return;
    }
    if (state.gesture.points.size) return;
    if (state.zoom.scale > 1.01 || !start) return;
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) turnPage(dx < 0 ? 1 : -1);
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && Date.now() - state.gesture.lastTap < 280) resetZoom();
    state.gesture.lastTap = Date.now();
    state.gesture.start = null;
  };
  ui.readerStage.addEventListener("pointerup", finish);
  ui.readerStage.addEventListener("pointercancel", finish);
}

function registerWebMCP() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const register = (tool) => Promise.resolve(context.registerTool(tool)).catch(() => undefined);
  register({
    name: "list_photo_books", title: "列出照片书", description: "读取当前设备中可见照片书的名称、ID 和页数。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async () => {
      await refreshLibrary();
      return { books: state.books.map((book, index) => ({ id: book.id, title: `book${index + 1}`, pages: book.pageCount })) };
    },
  });
  register({
    name: "open_photo_book", title: "打开照片书", description: "打开指定的本地照片书，从上次阅读页开始。",
    inputSchema: { type: "object", properties: { bookId: { type: "string" } }, required: ["bookId"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (input) => {
      if (!input || typeof input.bookId !== "string") throw new Error("bookId 必须是字符串");
      await openBook(input.bookId, undefined);
      return { opened: input.bookId };
    },
  });
  register({
    name: "go_to_photo_page", title: "跳至照片页", description: "打开指定书本的指定页码。页码从 1 开始。",
    inputSchema: { type: "object", properties: { bookId: { type: "string" }, page: { type: "integer", minimum: 1 } }, required: ["bookId", "page"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (input) => {
      if (!input || typeof input.bookId !== "string" || !Number.isInteger(input.page) || input.page < 1) throw new Error("bookId 和 page 无效");
      await openBook(input.bookId, input.page - 1);
      return { opened: input.bookId, page: input.page };
    },
  });
}

function bindEvents() {
  ui.add.addEventListener("click", () => showComposer());
  ui.emptyAdd.addEventListener("click", () => showComposer({ openPicker: true }));
  ui.closeComposer.addEventListener("click", closeComposer);
  ui.addGroup.addEventListener("click", () => ui.fileInput.click());
  ui.fileInput.addEventListener("change", () => {
    addGroupFromFiles(ui.fileInput.files);
    ui.fileInput.value = "";
  });
  ui.generate.addEventListener("click", importGroups);
  ui.manage.addEventListener("click", () => { state.managing = !state.managing; renderLibrary(); });
  ui.clearAll.addEventListener("click", clearLibrary);
  ui.previous.addEventListener("click", () => turnPage(-1));
  ui.next.addEventListener("click", () => turnPage(1));
  ui.closeReader.addEventListener("click", closeReader);
  ui.resetZoom.addEventListener("click", resetZoom);
  bindReaderGestures();
  window.addEventListener("keydown", (event) => {
    if (!state.reader) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); turnPage(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); turnPage(1); }
    if (event.key === "Escape") { event.preventDefault(); closeReader(); }
  });
  window.addEventListener("popstate", (event) => {
    const snapshot = event.state?.photoBook;
    if (snapshot && !state.reader) openBook(snapshot.bookId, snapshot.page, { fromHistory: true });
    else if (!snapshot && state.reader) teardownReader();
  });
}

async function initialize() {
  try {
    state.db = await PhotoBookDB.connect();
    const cleared = await state.db.cleanupIncompleteBooks();
    await state.db.backfillBookColors();
    await refreshLibrary();
    await warnOnStorage();
    if (cleared) setStatus("已清理一次未完成的导入，请重新添加那组图片。 ");
    bindEvents();
    registerWebMCP();
  } catch (error) {
    setStatus("这台设备无法使用本地照片书存储。请检查浏览器的站点数据权限后重试。 ");
    console.error(error);
  }
}

initialize();
