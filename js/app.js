(() => {
  "use strict";

  const STORAGE_KEY = "upCafePosDataV1";
  const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
  const dateTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short" });
  const seedMenus = [
    { id: "m1", name: "Kopi Susu UP+", category: "Kopi", price: 22000, icon: "\u2615" },
    { id: "m2", name: "Americano", category: "Kopi", price: 18000, icon: "\uD83E\uDDCA" },
    { id: "m3", name: "Cappuccino", category: "Kopi", price: 24000, icon: "\u2615" },
    { id: "m4", name: "Matcha Latte", category: "Non-kopi", price: 26000, icon: "\uD83C\uDF75" },
    { id: "m5", name: "Cokelat", category: "Non-kopi", price: 23000, icon: "\uD83C\uDF6B" },
    { id: "m6", name: "Teh Lemon", category: "Non-kopi", price: 16000, icon: "\uD83C\uDF4B" },
    { id: "m7", name: "Croissant", category: "Snack", price: 19000, icon: "\uD83E\uDD50" },
    { id: "m8", name: "Banana Bread", category: "Snack", price: 17000, icon: "\uD83C\uDF5E" }
  ];

  const $ = id => document.getElementById(id);
  let data;
  let cart = new Map();
  let selectedTransaction = null;
  let toastTimer;

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function showToast(message, error = false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("error", error);
    toast.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = "none"; }, 4500);
  }

  function readData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = { menus: seedMenus, transactions: [], sequence: 1 };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.menus) || !Array.isArray(parsed.transactions) || !Number.isSafeInteger(parsed.sequence)) {
      throw new Error("Format data lokal tidak valid.");
    }
    return parsed;
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      updateStorageStatus();
      return true;
    } catch (error) {
      showToast(`Data gagal disimpan. Penyimpanan browser mungkin penuh atau dinonaktifkan: ${error.message}`, true);
      return false;
    }
  }

  function updateStorageStatus() {
    try {
      const size = new Blob([JSON.stringify(data)]).size;
      $("storageStatus").textContent = `Data saat ini sekitar ${(size / 1024).toFixed(1)} KB di localStorage browser ini. Ini bukan backup eksternal.`;
    } catch (error) {
      $("storageStatus").textContent = `Ukuran data tidak dapat diperiksa: ${error.message}`;
    }
  }

  function format(value) {
    return money.format(Number(value) || 0);
  }

  function totalCart() {
    return [...cart.values()].reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function newId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function renderMenus() {
    $("menuGrid").innerHTML = data.menus.map(menu => `
      <button class="menu-button" type="button" data-add="${escapeHtml(menu.id)}">
        <span class="menu-icon" aria-hidden="true">${escapeHtml(menu.icon || "\uD83C\uDF7D\uFE0F")}</span>
        <span><span class="menu-name">${escapeHtml(menu.name)}</span><span class="menu-category">${escapeHtml(menu.category || "Menu")}</span></span>
        <span class="menu-price">${format(menu.price)}</span>
      </button>`).join("") || '<p class="empty">Belum ada menu. Tambahkan menu melalui Kelola Menu.</p>';
  }

  function renderCart() {
    const items = [...cart.values()];
    $("cartItems").innerHTML = items.length ? items.map(item => `
      <div class="cart-row">
        <div><strong>${escapeHtml(item.name)}</strong><small>${format(item.price)} × ${item.quantity} = ${format(item.price * item.quantity)}</small></div>
        <div class="qty">
          <button type="button" data-qty="-1" data-id="${escapeHtml(item.id)}" aria-label="Kurangi ${escapeHtml(item.name)}">−</button>
          <strong>${item.quantity}</strong>
          <button type="button" data-qty="1" data-id="${escapeHtml(item.id)}" aria-label="Tambah ${escapeHtml(item.name)}">+</button>
        </div>
      </div>`).join("") : '<p class="empty">Keranjang masih kosong.</p>';
    $("cartCount").textContent = `${items.reduce((sum, item) => sum + item.quantity, 0)} item`;
    $("subtotal").textContent = format(totalCart());
    $("total").textContent = format(totalCart());
    $("checkoutButton").disabled = items.length === 0;
    updateChange();
  }

  function updateChange() {
    const isCash = $("paymentMethod").value === "Tunai";
    $("cashField").hidden = !isCash;
    const received = Number($("cashReceived").value) || 0;
    $("changeRow").hidden = !isCash || totalCart() === 0 || received < totalCart();
    $("changeAmount").textContent = format(Math.max(0, received - totalCart()));
  }

  function transactionLabel(tx) {
    if (tx.status === "cancelled") return ["Dibatalkan", "cancelled"];
    if (tx.paymentStatus === "paid") return ["Selesai", "paid"];
    return ["Menunggu pembayaran", ""];
  }

  function renderHistory() {
    const query = $("historySearch").value.trim().toLocaleLowerCase("id-ID");
    const rows = [...data.transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter(tx => tx.number.toLocaleLowerCase("id-ID").includes(query) || (tx.customer || "").toLocaleLowerCase("id-ID").includes(query));
    $("historyRows").innerHTML = rows.map(tx => {
      const [label, css] = transactionLabel(tx);
      const actions = [
        `<button class="button small secondary" data-receipt="${escapeHtml(tx.id)}">Struk</button>`,
        tx.status !== "cancelled" && tx.paymentStatus !== "paid" ? `<button class="button small" data-paid="${escapeHtml(tx.id)}">Tandai lunas</button>` : "",
        tx.status !== "cancelled" ? `<button class="button small danger" data-cancel="${escapeHtml(tx.id)}">Batalkan</button>` : ""
      ].filter(Boolean).join("");
      return `<tr>
        <td><strong>${escapeHtml(tx.number)}</strong></td><td>${dateTime.format(new Date(tx.createdAt))}</td>
        <td>${escapeHtml(tx.customer || "—")}</td><td>${format(tx.total)}</td>
        <td>${escapeHtml(tx.paymentMethod)}<br><span class="status ${tx.paymentStatus === "paid" ? "paid" : ""}">${tx.paymentStatus === "paid" ? "Lunas" : "Belum lunas"}</span></td>
        <td><span class="status ${css}">${label}</span></td><td>${actions}</td></tr>`;
    }).join("");
    $("historyEmpty").hidden = rows.length > 0;
  }

  function renderReport() {
    const day = $("reportDate").value;
    const rows = data.transactions.filter(tx => dateKey(new Date(tx.createdAt)) === day);
    const paid = rows.filter(tx => tx.status !== "cancelled" && tx.paymentStatus === "paid");
    const pending = rows.filter(tx => tx.status !== "cancelled" && tx.paymentStatus !== "paid");
    const cancelled = rows.filter(tx => tx.status === "cancelled");
    $("reportCount").textContent = String(paid.length);
    $("reportSales").textContent = format(paid.reduce((sum, tx) => sum + tx.total, 0));
    $("reportPending").textContent = String(pending.length);
    $("reportCancelled").textContent = String(cancelled.length);
    $("reportRows").innerHTML = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(tx => {
      const [label, css] = transactionLabel(tx);
      return `<tr><td>${escapeHtml(tx.number)}</td><td>${escapeHtml(tx.customer || "—")}</td><td>${escapeHtml(tx.paymentMethod)}</td>
        <td><span class="status ${tx.paymentStatus === "paid" ? "paid" : ""}">${tx.paymentStatus === "paid" ? "Lunas" : "Belum lunas"}</span></td>
        <td><span class="status ${css}">${label}</span></td><td>${format(tx.total)}</td></tr>`;
    }).join("");
    $("reportEmpty").hidden = rows.length > 0;
  }

  function renderMenuTable() {
    $("menuRows").innerHTML = data.menus.map(menu => `<tr>
      <td>${escapeHtml(menu.icon || "")} ${escapeHtml(menu.name)}</td><td>${escapeHtml(menu.category || "—")}</td><td>${format(menu.price)}</td>
      <td><button class="button small secondary" data-edit="${escapeHtml(menu.id)}">Edit</button>
      <button class="button small danger" data-remove="${escapeHtml(menu.id)}">Hapus</button></td></tr>`).join("");
    $("menuEmpty").hidden = data.menus.length > 0;
  }

  function renderAll() {
    renderMenus();
    renderCart();
    renderHistory();
    renderReport();
    renderMenuTable();
    updateStorageStatus();
  }

  function transactionNumber(date) {
    const day = dateKey(date).replaceAll("-", "");
    const existing = new Set(data.transactions.map(tx => tx.number));
    let number;
    do {
      number = `UPC-${day}-${String(data.sequence++).padStart(5, "0")}`;
    } while (existing.has(number));
    return number;
  }

  function openCheckout() {
    if (!cart.size) return showToast("Pilih menu sebelum checkout.", true);
    const total = totalCart();
    if ($("paymentMethod").value === "Tunai" && (Number($("cashReceived").value) || 0) < total) {
      return showToast("Uang diterima masih kurang dari total pesanan.", true);
    }
    const status = $("paymentMethod").value === "Tunai" ? "Lunas" : "Belum dikonfirmasi";
    $("confirmMessage").textContent = `Selesaikan transaksi ${format(total)} dengan metode ${$("paymentMethod").value}? Pembayaran dicatat: ${status}.`;
    $("confirmDialog").hidden = false;
  }

  function completeCheckout() {
    const createdAt = new Date();
    const method = $("paymentMethod").value;
    const total = totalCart();
    const transaction = {
      id: newId(),
      number: transactionNumber(createdAt),
      createdAt: createdAt.toISOString(),
      customer: $("customerName").value.trim(),
      items: [...cart.values()].map(item => ({ ...item })),
      subtotal: total,
      total,
      paymentMethod: method,
      paymentStatus: method === "Tunai" ? "paid" : "pending",
      status: "completed",
      cashReceived: method === "Tunai" ? Number($("cashReceived").value) : null,
      change: method === "Tunai" ? Number($("cashReceived").value) - total : null,
      cancellation: null,
      paidAt: method === "Tunai" ? createdAt.toISOString() : null
    };
    data.transactions.push(transaction);
    if (!saveData()) {
      data.transactions.pop();
      data.sequence--;
      return;
    }
    cart.clear();
    $("customerName").value = "";
    $("cashReceived").value = "";
    $("confirmDialog").hidden = true;
    renderAll();
    selectedTransaction = transaction;
    $("printDialog").hidden = false;
    showToast(`Transaksi ${transaction.number} tersimpan di browser ini.`);
  }

  function cancelTransaction(id) {
    const tx = data.transactions.find(item => item.id === id);
    if (!tx || tx.status === "cancelled" || !confirm(`Batalkan ${tx.number}? Catatan transaksi tidak dihapus.`)) return;
    tx.status = "cancelled";
    tx.cancellation = { cancelledAt: new Date().toISOString(), note: "Dibatalkan oleh staff" };
    if (saveData()) {
      renderHistory();
      renderReport();
      showToast("Pembatalan dicatat; riwayat transaksi tetap disimpan.");
    } else {
      tx.status = "completed";
      tx.cancellation = null;
    }
  }

  function markPaid(id) {
    const tx = data.transactions.find(item => item.id === id);
    if (!tx || tx.status === "cancelled" || tx.paymentStatus === "paid") return;
    if (!confirm(`Konfirmasi pembayaran ${tx.number} sudah diterima?`)) return;
    tx.paymentStatus = "paid";
    tx.paidAt = new Date().toISOString();
    if (saveData()) {
      renderHistory();
      renderReport();
      showToast("Status pembayaran dicatat lunas. Pastikan dana benar-benar diterima.");
    } else {
      tx.paymentStatus = "pending";
      tx.paidAt = null;
    }
  }

  function showReceipt(id) {
    selectedTransaction = data.transactions.find(tx => tx.id === id) || selectedTransaction;
    if (!selectedTransaction) return showToast("Transaksi tidak ditemukan.", true);
    $("printDialog").hidden = false;
  }

  function printReceipt() {
    if (!selectedTransaction) return showToast("Transaksi untuk dicetak tidak ditemukan.", true);
    const tx = selectedTransaction;
    const receipt = $("receipt");
    const width = $("paperWidth").value;
    receipt.classList.toggle("wide", width === "80");
    receipt.style.setProperty("--paper-width", `${width}mm`);
    receipt.innerHTML = `<div class="receipt-center"><strong>UP+ CAFE</strong><br>Terima kasih sudah berkunjung</div>
      <div class="receipt-rule"></div><div>No: ${escapeHtml(tx.number)}</div><div>${dateTime.format(new Date(tx.createdAt))}</div>
      <div>Pelanggan: ${escapeHtml(tx.customer || "Umum")}</div><div class="receipt-rule"></div>
      ${tx.items.map(item => `<div class="receipt-item"><div class="receipt-name">${escapeHtml(item.name)} × ${item.quantity}</div>
      <div class="receipt-line"><span>${format(item.price)} × ${item.quantity}</span><span>${format(item.price * item.quantity)}</span></div></div>`).join("")}
      <div class="receipt-rule"></div><div class="receipt-line"><span>Subtotal</span><span>${format(tx.subtotal)}</span></div>
      <div class="receipt-line"><strong>TOTAL</strong><strong>${format(tx.total)}</strong></div>
      <div>Pembayaran: ${escapeHtml(tx.paymentMethod)} (${tx.paymentStatus === "paid" ? "Lunas" : "Belum lunas"})</div>
      ${tx.cashReceived !== null ? `<div class="receipt-line"><span>Tunai</span><span>${format(tx.cashReceived)}</span></div><div class="receipt-line"><span>Kembalian</span><span>${format(tx.change)}</span></div>` : ""}
      ${tx.status === "cancelled" ? "<div class=\"receipt-rule\"></div><strong>DIBATALKAN</strong>" : ""}
      <div class="receipt-rule"></div><div class="receipt-center">Simpan struk ini sebagai bukti transaksi</div>`;
    $("printDialog").hidden = true;
    window.print();
  }

  function resetMenuForm() {
    $("menuForm").reset();
    $("menuId").value = "";
    $("menuFormHeading").textContent = "Tambah menu";
    $("cancelMenuEdit").hidden = true;
  }

  function onMenuSubmit(event) {
    event.preventDefault();
    const name = $("menuName").value.trim();
    const price = Number($("menuPrice").value);
    if (!name || !Number.isSafeInteger(price) || price < 1) return showToast("Masukkan nama menu dan harga berupa angka bulat lebih dari nol.", true);
    const id = $("menuId").value;
    const existing = data.menus.find(menu => menu.id === id);
    const previous = existing ? { ...existing } : null;
    const menu = { id: id || newId(), name, price, category: $("menuCategory").value.trim() || "Menu", icon: $("menuIcon").value.trim() || "\uD83C\uDF7D\uFE0F" };
    if (existing) Object.assign(existing, menu);
    else data.menus.push(menu);
    if (saveData()) {
      resetMenuForm();
      renderMenus();
      renderMenuTable();
      showToast(existing ? "Menu berhasil diperbarui." : "Menu berhasil ditambahkan.");
    } else if (existing) {
      Object.assign(existing, previous);
    } else {
      data.menus.pop();
    }
  }

  function exportBackup() {
    try {
      const backup = { ...data, format: "up-cafe-pos-backup-v1", exportedAt: new Date().toISOString() };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `up-cafe-pos-backup-${dateKey(new Date())}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("File backup JSON dibuat. Pastikan file tersimpan di lokasi terpisah.");
    } catch (error) {
      showToast(`Backup gagal dibuat: ${error.message}`, true);
    }
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const incoming = JSON.parse(await file.text());
      const valid = incoming?.format === "up-cafe-pos-backup-v1"
        && Array.isArray(incoming.menus)
        && Array.isArray(incoming.transactions)
        && Number.isSafeInteger(incoming.sequence);
      if (!valid) throw new Error("File bukan backup UP+ Cafe POS yang valid.");
      if (!incoming.menus.every(menu => typeof menu.id === "string" && typeof menu.name === "string" && Number.isSafeInteger(menu.price) && menu.price > 0)) {
        throw new Error("Data menu pada file backup tidak valid.");
      }
      if (!incoming.transactions.every(tx => typeof tx.id === "string" && typeof tx.number === "string" && Array.isArray(tx.items) && Number.isFinite(tx.total) && ["completed", "cancelled"].includes(tx.status) && ["paid", "pending"].includes(tx.paymentStatus))) {
        throw new Error("Ada data transaksi yang tidak valid pada file backup.");
      }
      const oldData = data;
      const ids = new Set(data.transactions.map(tx => tx.id));
      const numbers = new Set(data.transactions.map(tx => tx.number));
      const menus = new Set(data.menus.map(menu => menu.id));
      data = {
        menus: [...data.menus, ...incoming.menus.filter(menu => !menus.has(menu.id))],
        transactions: [...data.transactions, ...incoming.transactions.filter(tx => !ids.has(tx.id) && !numbers.has(tx.number))],
        sequence: Math.max(data.sequence, incoming.sequence)
      };
      if (!saveData()) {
        data = oldData;
        return;
      }
      renderAll();
      showToast("Impor selesai. Data unik digabungkan; transaksi lama tidak dihapus.");
    } catch (error) {
      showToast(`Impor gagal: ${error.message}`, true);
    } finally {
      $("importFile").value = "";
    }
  }

  function initialize() {
    try {
      data = readData();
    } catch (error) {
      document.querySelector("main").innerHTML = `<div class="critical-warning"><strong>Data POS tidak dapat dibuka.</strong><br>${escapeHtml(error.message)} Periksa penyimpanan browser atau pulihkan dari file backup.</div>`;
      return;
    }

    const today = new Date();
    $("todayLabel").textContent = today.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    $("reportDate").value = dateKey(today);
    document.querySelector(".tabs").addEventListener("click", event => {
      const button = event.target.closest("[data-tab]");
      if (!button) return;
      document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
      document.querySelectorAll(".panel").forEach(panel => panel.classList.toggle("active", panel.id === `panel-${button.dataset.tab}`));
    });
    $("menuGrid").addEventListener("click", event => {
      const button = event.target.closest("[data-add]");
      if (!button) return;
      const menu = data.menus.find(item => item.id === button.dataset.add);
      if (!menu) return showToast("Menu tidak ditemukan. Muat ulang halaman.", true);
      const item = cart.get(menu.id);
      if (item) item.quantity++;
      else cart.set(menu.id, { id: menu.id, name: menu.name, price: menu.price, quantity: 1 });
      renderCart();
    });
    $("cartItems").addEventListener("click", event => {
      const button = event.target.closest("[data-qty]");
      if (!button) return;
      const item = cart.get(button.dataset.id);
      if (!item) return;
      item.quantity += Number(button.dataset.qty);
      if (item.quantity <= 0) cart.delete(item.id);
      renderCart();
    });
    $("paymentMethod").addEventListener("change", updateChange);
    $("cashReceived").addEventListener("input", updateChange);
    $("checkoutButton").addEventListener("click", openCheckout);
    $("cancelCheckout").addEventListener("click", () => { $("confirmDialog").hidden = true; });
    $("confirmCheckout").addEventListener("click", completeCheckout);
    $("historySearch").addEventListener("input", renderHistory);
    $("clearSearch").addEventListener("click", () => { $("historySearch").value = ""; renderHistory(); });
    $("reportDate").addEventListener("change", renderReport);
    $("historyRows").addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.receipt) showReceipt(button.dataset.receipt);
      if (button.dataset.cancel) cancelTransaction(button.dataset.cancel);
      if (button.dataset.paid) markPaid(button.dataset.paid);
    });
    $("printButton").addEventListener("click", printReceipt);
    $("closePrintDialog").addEventListener("click", () => { $("printDialog").hidden = true; });
    $("menuForm").addEventListener("submit", onMenuSubmit);
    $("cancelMenuEdit").addEventListener("click", resetMenuForm);
    $("menuRows").addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.edit) {
        const menu = data.menus.find(item => item.id === button.dataset.edit);
        if (!menu) return;
        $("menuId").value = menu.id;
        $("menuName").value = menu.name;
        $("menuPrice").value = menu.price;
        $("menuCategory").value = menu.category;
        $("menuIcon").value = menu.icon;
        $("menuFormHeading").textContent = "Edit menu";
        $("cancelMenuEdit").hidden = false;
        $("menuName").focus();
      }
      if (button.dataset.remove) {
        const menu = data.menus.find(item => item.id === button.dataset.remove);
        if (!menu || !confirm(`Hapus “${menu.name}” dari daftar menu? Transaksi lama tidak diubah.`)) return;
        const oldMenus = data.menus;
        data.menus = data.menus.filter(item => item.id !== menu.id);
        if (saveData()) {
          cart.delete(menu.id);
          renderMenus();
          renderMenuTable();
          renderCart();
          showToast("Menu dihapus. Catatan transaksi lama tetap disimpan.");
        } else {
          data.menus = oldMenus;
        }
      }
    });
    $("exportButton").addEventListener("click", exportBackup);
    $("importButton").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", event => importBackup(event.target.files[0]));
    window.addEventListener("storage", event => {
      if (event.key !== STORAGE_KEY) return;
      try {
        data = readData();
        renderAll();
        showToast("Data diperbarui dari tab browser lain.");
      } catch (error) {
        showToast(`Data dari tab lain gagal dibaca: ${error.message}`, true);
      }
    });
    renderAll();
  }

  initialize();
})();
