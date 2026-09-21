const DATABASE_NAME = "mobile-photo-book";
const DATABASE_VERSION = 1;

function id() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("数据库操作失败"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("数据库事务中断"));
    transaction.onerror = () => reject(transaction.error || new Error("数据库事务失败"));
  });
}

async function collectByIndex(index, query) {
  if ("getAll" in index) return openRequest(index.getAll(query));
  return new Promise((resolve, reject) => {
    const rows = [];
    const request = index.openCursor(query);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(rows);
      rows.push(cursor.value);
      cursor.continue();
    };
  });
}

export class PhotoBookDB {
  static async connect() {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("books")) {
        const books = db.createObjectStore("books", { keyPath: "id" });
        books.createIndex("byOrder", "order", { unique: false });
        books.createIndex("byStatus", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains("pages")) {
        const pages = db.createObjectStore("pages", { keyPath: "id" });
        pages.createIndex("byBook", "bookId", { unique: false });
        pages.createIndex("byBookOrder", ["bookId", "order"], { unique: true });
      }
    };
    return new PhotoBookDB(await openRequest(request));
  }

  constructor(db) { this.db = db; }

  async listBooks({ readyOnly = true } = {}) {
    const tx = this.db.transaction("books", "readonly");
    const rows = await openRequest(tx.objectStore("books").getAll());
    await transactionDone(tx);
    return rows
      .filter((book) => !readyOnly || book.status === "ready")
      .sort((a, b) => a.order - b.order);
  }

  async getBook(bookId) {
    const tx = this.db.transaction("books", "readonly");
    const row = await openRequest(tx.objectStore("books").get(bookId));
    await transactionDone(tx);
    return row;
  }

  async createImportingBook(order) {
    const book = {
      id: id(),
      order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pageCount: 0,
      lastReadPage: 0,
      status: "importing",
    };
    const tx = this.db.transaction("books", "readwrite");
    tx.objectStore("books").add(book);
    await transactionDone(tx);
    return book;
  }

  async addPage({ bookId, order, blob, width, height, mime, originalName }) {
    const page = { id: id(), bookId, order, blob, width, height, mime, originalName };
    const tx = this.db.transaction("pages", "readwrite");
    tx.objectStore("pages").add(page);
    await transactionDone(tx);
    return page;
  }

  async completeBook(bookId, pageCount) {
    const tx = this.db.transaction("books", "readwrite");
    const store = tx.objectStore("books");
    const book = await openRequest(store.get(bookId));
    if (!book) {
      tx.abort();
      throw new Error("找不到待完成的书本");
    }
    book.status = "ready";
    book.pageCount = pageCount;
    book.updatedAt = new Date().toISOString();
    store.put(book);
    await transactionDone(tx);
    return book;
  }

  async getPage(bookId, order) {
    const tx = this.db.transaction("pages", "readonly");
    const row = await openRequest(tx.objectStore("pages").index("byBookOrder").get([bookId, order]));
    await transactionDone(tx);
    return row;
  }

  async deleteBook(bookId) {
    const tx = this.db.transaction(["books", "pages"], "readwrite");
    const pages = tx.objectStore("pages").index("byBook");
    const request = pages.openCursor(IDBKeyRange.only(bookId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    tx.objectStore("books").delete(bookId);
    await transactionDone(tx);
  }

  async deleteAll() {
    const tx = this.db.transaction(["books", "pages"], "readwrite");
    tx.objectStore("books").clear();
    tx.objectStore("pages").clear();
    await transactionDone(tx);
  }

  async setBookOrder(bookIds) {
    const tx = this.db.transaction("books", "readwrite");
    const store = tx.objectStore("books");
    const books = await Promise.all(bookIds.map((bookId) => openRequest(store.get(bookId))));
    books.forEach((book, order) => {
      if (!book) return;
      book.order = order;
      book.updatedAt = new Date().toISOString();
      store.put(book);
    });
    await transactionDone(tx);
  }

  async setLastReadPage(bookId, lastReadPage) {
    const tx = this.db.transaction("books", "readwrite");
    const store = tx.objectStore("books");
    const book = await openRequest(store.get(bookId));
    if (book) {
      book.lastReadPage = lastReadPage;
      book.updatedAt = new Date().toISOString();
      store.put(book);
    }
    await transactionDone(tx);
  }

  async cleanupIncompleteBooks() {
    const tx = this.db.transaction("books", "readonly");
    const incomplete = await collectByIndex(tx.objectStore("books").index("byStatus"), IDBKeyRange.only("importing"));
    await transactionDone(tx);
    await Promise.all(incomplete.map((book) => this.deleteBook(book.id)));
    return incomplete.length;
  }

  async getStorageEstimate() {
    if (!navigator.storage?.estimate) return null;
    return navigator.storage.estimate();
  }
}
