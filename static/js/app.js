/* ControleGastos · cliente do dashboard (light + mobile-first) */

const API = {
    listar: "/api/transacoes/",
    criar: "/api/transacoes/criar/",
    atualizar: (id) => `/api/transacoes/${id}/`,
    excluir: (id) => `/api/transacoes/${id}/excluir/`,
    resumo: "/api/resumo/"
};

const CATEGORIAS = window.CATEGORIAS || { RECEITA: [], DESPESA: [] };
const CSRF_TOKEN = window.CSRF_TOKEN || "";

const state = {
    transactions: [],
    summary: null,
    charts: { comparison: null, line: null, pie: null },
    expandedId: null
};

const $ = (id) => document.getElementById(id);

const el = {
    form: $("transaction-form"),
    description: $("description"),
    amount: $("amount"),
    date: $("date"),
    type: $("type"),
    category: $("category"),
    isCredit: $("is-credit"),
    parcelasRow: $("parcelas-row"),
    parcelas: $("parcelas"),
    parcelaValor: $("parcela-valor"),
    parcelaResumo: $("parcela-resumo"),
    segBtns: document.querySelectorAll(".seg-btn"),

    editForm: $("edit-form"),
    editId: $("edit-id"),
    editDescription: $("edit-description"),
    editAmount: $("edit-amount"),
    editDate: $("edit-date"),
    editType: $("edit-type"),
    editCategory: $("edit-category"),

    txList: $("transactions-list"),
    emptyState: $("empty-state"),
    balance: $("balance"),
    income: $("income"),
    expense: $("expense"),
    currentPeriod: $("current-period"),

    filtros: $("filtros"),
    btnToggleFilters: $("btn-toggle-filters"),
    filterMonth: $("filter-month"),
    filterDateFrom: $("filter-date-from"),
    filterDateTo: $("filter-date-to"),
    filterType: $("filter-type"),
    filterCategory: $("filter-category"),
    btnApply: $("btn-apply-filters"),
    btnClear: $("btn-clear-filters"),
    btnFab: $("btn-fab"),

    editModal: $("edit-modal"),
    modalClose: $("modal-close"),
    cancelEdit: $("cancel-edit"),

    toast: $("toast"),
    toastMessage: $("toast-message"),

    comparisonChart: $("comparison-chart"),
    lineChart: $("line-chart"),
    pieChart: $("pie-chart"),

    insightTopCategory: $("insight-top-category"),
    insightTopCategoryValue: $("insight-top-category-value"),
    insightBestDay: $("insight-best-day"),
    insightBestDayValue: $("insight-best-day-value"),
    insightSavingsRate: $("insight-savings-rate"),
    insightAverageTicket: $("insight-average-ticket")
};

/* ============== Init ============== */

document.addEventListener("DOMContentLoaded", async () => {
    populateCategories(currentTipo(), el.category);
    populateFilterCategories();
    populateMonthFilter();
    bindEvents();
    updateParcelaPreview();
    await refreshAll();
});

function bindEvents() {
    el.form.addEventListener("submit", handleAdd);
    el.editForm.addEventListener("submit", handleEdit);

    el.segBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tipo = btn.dataset.tipo;
            el.segBtns.forEach((b) => {
                const active = b === btn;
                b.classList.toggle("active", active);
                b.setAttribute("aria-checked", active ? "true" : "false");
            });
            el.type.value = tipo;
            populateCategories(tipo, el.category);
            if (tipo === "RECEITA") {
                el.isCredit.checked = false;
                toggleParcelas(false);
            }
        });
    });

    el.editType.addEventListener("change", () =>
        populateCategories(el.editType.value, el.editCategory)
    );

    el.isCredit.addEventListener("change", (e) => toggleParcelas(e.target.checked));
    el.parcelas.addEventListener("input", updateParcelaPreview);
    el.amount.addEventListener("input", updateParcelaPreview);

    el.btnApply.addEventListener("click", () => {
        toggleFilters(false);
        refreshAll();
    });
    el.btnClear.addEventListener("click", clearFilters);

    el.btnToggleFilters.addEventListener("click", () => toggleFilters());
    el.btnFab.addEventListener("click", () => {
        $("nova-transacao").scrollIntoView({ behavior: "smooth", block: "start" });
        el.description.focus({ preventScroll: true });
    });

    el.modalClose.addEventListener("click", closeModal);
    el.cancelEdit.addEventListener("click", closeModal);
    el.editModal.addEventListener("click", (e) => {
        if (e.target === el.editModal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && el.editModal.classList.contains("active")) closeModal();
    });

    el.txList.addEventListener("click", handleListClick);
}

function toggleFilters(force) {
    const willOpen = typeof force === "boolean" ? force : el.filtros.hasAttribute("hidden");
    if (willOpen) {
        el.filtros.removeAttribute("hidden");
    } else {
        el.filtros.setAttribute("hidden", "");
    }
    el.btnToggleFilters.setAttribute("aria-expanded", String(willOpen));
}

function currentTipo() {
    return el.type.value || "DESPESA";
}

/* ============== Categorias e meses ============== */

function populateCategories(tipo, target) {
    const lista = CATEGORIAS[tipo] || [];
    target.innerHTML = lista.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function populateFilterCategories() {
    const todas = Array.from(new Set([...CATEGORIAS.RECEITA, ...CATEGORIAS.DESPESA])).sort();
    el.filterCategory.innerHTML = `
        <option value="all">Todas categorias</option>
        ${todas.map((c) => `<option value="${c}">${c}</option>`).join("")}
    `;
}

function populateMonthFilter() {
    const now = new Date();
    const opcoes = ['<option value="">Todos os meses</option>'];
    for (let i = -12; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        opcoes.push(`<option value="${value}">${capitalize(label)}</option>`);
    }
    el.filterMonth.innerHTML = opcoes.join("");
    el.filterMonth.value = window.MES_ATUAL || "";
}

function capitalize(t) {
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ============== Format ============== */

function formatCurrency(v) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
}

function formatDate(v) {
    if (!v) return "—";
    const d = new Date(v + "T00:00:00");
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function escapeHtml(t) {
    const div = document.createElement("div");
    div.textContent = String(t ?? "");
    return div.innerHTML;
}

/* ============== Parcelas ============== */

function toggleParcelas(ativo) {
    if (ativo) {
        el.parcelasRow.removeAttribute("hidden");
        if (Number(el.parcelas.value) < 2) el.parcelas.value = 2;
    } else {
        el.parcelasRow.setAttribute("hidden", "");
    }
    updateParcelaPreview();
}

function updateParcelaPreview() {
    const valor = Number(el.amount.value || 0);
    const parcelas = Math.max(1, Number(el.parcelas.value || 1));
    if (!el.isCredit.checked || parcelas < 2 || valor <= 0) {
        el.parcelaValor.textContent = formatCurrency(valor);
        el.parcelaResumo.textContent = "Lançamento único";
        return;
    }
    el.parcelaValor.textContent = formatCurrency(valor / parcelas);
    el.parcelaResumo.textContent = `${parcelas}x mensais`;
}

/* ============== HTTP ============== */

async function http(url, opts = {}) {
    const headers = {
        "Content-Type": "application/json",
        "X-CSRFToken": CSRF_TOKEN,
        ...(opts.headers || {})
    };
    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || (err.errors ? JSON.stringify(err.errors) : `HTTP ${res.status}`));
    }
    if (res.status === 204) return null;
    return res.json();
}

function buildQueryParams() {
    const params = new URLSearchParams();
    if (el.filterMonth.value) params.set("mes", el.filterMonth.value);
    if (el.filterDateFrom.value) params.set("data_de", el.filterDateFrom.value);
    if (el.filterDateTo.value) params.set("data_ate", el.filterDateTo.value);
    if (el.filterType.value && el.filterType.value !== "all") params.set("tipo", el.filterType.value);
    if (el.filterCategory.value && el.filterCategory.value !== "all") params.set("categoria", el.filterCategory.value);
    return params;
}

async function refreshAll() {
    try {
        updatePeriodLabel();
        const q = buildQueryParams().toString();
        const suf = q ? `?${q}` : "";

        const [transactions, summary] = await Promise.all([
            http(API.listar + suf),
            http(API.resumo + suf)
        ]);

        state.transactions = Array.isArray(transactions) ? transactions : [];
        state.summary = summary;

        renderBalance(summary);
        renderTransactions();
        renderCharts(summary);
        renderInsights(summary);
    } catch (error) {
        console.error(error);
        showToast(error.message || "Erro ao carregar.", "error");
    }
}

function updatePeriodLabel() {
    if (el.filterMonth.value) {
        const [y, m] = el.filterMonth.value.split("-");
        const label = new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
        el.currentPeriod.textContent = capitalize(label);
        return;
    }
    if (el.filterDateFrom.value || el.filterDateTo.value) {
        const from = el.filterDateFrom.value ? formatDate(el.filterDateFrom.value) : "Início";
        const to = el.filterDateTo.value ? formatDate(el.filterDateTo.value) : "Fim";
        el.currentPeriod.textContent = `${from} → ${to}`;
        return;
    }
    el.currentPeriod.textContent = "Todos";
}

/* ============== Render ============== */

function renderBalance(summary) {
    const totals = summary?.totals || {};
    el.balance.textContent = formatCurrency(totals.balance);
    el.income.textContent = formatCurrency(totals.income);
    el.expense.textContent = formatCurrency(totals.expense);
}

function renderTransactions() {
    if (!state.transactions.length) {
        el.txList.innerHTML = "";
        el.emptyState.removeAttribute("hidden");
        return;
    }
    el.emptyState.setAttribute("hidden", "");

    el.txList.innerHTML = state.transactions
        .slice()
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .map((tx) => {
            const tipo = (tx.tipo || "DESPESA").toUpperCase();
            const isReceita = tipo === "RECEITA";
            const expanded = state.expandedId && String(state.expandedId) === String(tx.id);
            const icon = isReceita ? "fa-arrow-trend-up" : "fa-arrow-trend-down";
            return `
                <li class="tx-item ${expanded ? "expanded" : ""}" data-id="${tx.id}">
                    <span class="tx-icon ${isReceita ? "income" : "expense"}">
                        <i class="fa-solid ${icon}" aria-hidden="true"></i>
                    </span>
                    <div class="tx-info">
                        <span class="tx-desc">${escapeHtml(tx.descricao || "—")}</span>
                        <span class="tx-meta">
                            <span>${formatDate(tx.data)}</span>
                            <span class="dot" aria-hidden="true"></span>
                            <span>${escapeHtml(tx.categoria || "—")}</span>
                        </span>
                    </div>
                    <span class="tx-amount ${isReceita ? "income" : "expense"}">
                        ${isReceita ? "+" : "−"} ${formatCurrency(tx.valor)}
                    </span>
                    <div class="tx-actions">
                        <button class="icon-btn edit" data-action="edit" data-id="${tx.id}" aria-label="Editar">
                            <i class="fa-solid fa-pen" aria-hidden="true"></i>
                        </button>
                        <button class="icon-btn danger" data-action="delete" data-id="${tx.id}" aria-label="Excluir">
                            <i class="fa-solid fa-trash" aria-hidden="true"></i>
                        </button>
                    </div>
                </li>
            `;
        })
        .join("");
}

function handleListClick(event) {
    const actionBtn = event.target.closest("button[data-action]");
    if (actionBtn) {
        const id = actionBtn.dataset.id;
        const action = actionBtn.dataset.action;
        if (action === "edit") openEditModal(id);
        if (action === "delete") deleteTransaction(id);
        return;
    }
    const item = event.target.closest(".tx-item");
    if (!item) return;
    const id = item.dataset.id;
    state.expandedId = state.expandedId && String(state.expandedId) === String(id) ? null : id;
    renderTransactions();
}

function renderCharts(summary) {
    destroyCharts();
    const comparison = summary?.comparison || { income: 0, expense: 0 };
    const line = summary?.line || { labels: [], income: [], expense: [] };
    const pie = summary?.pie || { labels: [], values: [] };

    const tickColor = "#6b7280";
    const gridColor = "rgba(15,23,42,0.06)";

    const palette = {
        green: "#10b981",
        red: "#ef4444",
        blue: "#2563eb",
        indigo: "#4f46e5",
        cyan: "#0891b2",
        teal: "#14b8a6",
        amber: "#f59e0b",
        rose: "#fb7185",
        slate: "#64748b"
    };
    const pieColors = [palette.blue, palette.red, palette.amber, palette.indigo, palette.teal, palette.rose, palette.cyan, palette.slate];

    state.charts.comparison = new Chart(el.comparisonChart, {
        type: "bar",
        data: {
            labels: ["Receitas", "Despesas"],
            datasets: [{
                data: [comparison.income || 0, comparison.expense || 0],
                backgroundColor: [palette.green, palette.red],
                borderRadius: 12,
                borderSkipped: false,
                maxBarThickness: 64
            }]
        },
        options: chartBaseOptions(tickColor, gridColor, { plugins: { legend: { display: false } } })
    });

    state.charts.line = new Chart(el.lineChart, {
        type: "line",
        data: {
            labels: line.labels || [],
            datasets: [
                {
                    label: "Receitas",
                    data: line.income || [],
                    tension: 0.4,
                    fill: true,
                    borderColor: palette.green,
                    backgroundColor: "rgba(16,185,129,0.14)",
                    pointBackgroundColor: palette.green,
                    pointRadius: 2,
                    borderWidth: 2.5
                },
                {
                    label: "Despesas",
                    data: line.expense || [],
                    tension: 0.4,
                    fill: true,
                    borderColor: palette.red,
                    backgroundColor: "rgba(239,68,68,0.14)",
                    pointBackgroundColor: palette.red,
                    pointRadius: 2,
                    borderWidth: 2.5
                }
            ]
        },
        options: chartBaseOptions(tickColor, gridColor, {
            plugins: { legend: { position: "bottom", labels: { color: tickColor, padding: 10, boxWidth: 10, font: { size: 11 } } } }
        })
    });

    state.charts.pie = new Chart(el.pieChart, {
        type: "doughnut",
        data: {
            labels: pie.labels || [],
            datasets: [{
                data: pie.values || [],
                backgroundColor: pieColors,
                borderWidth: 0,
                cutout: "65%"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { color: tickColor, padding: 10, boxWidth: 10, font: { size: 11 } } },
                tooltip: {
                    callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` }
                }
            }
        }
    });
}

function chartBaseOptions(tickColor, gridColor, extra = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
            y: { ticks: { color: tickColor, font: { size: 11 }, callback: (v) => formatCurrency(v) }, grid: { color: gridColor } }
        },
        plugins: {
            tooltip: {
                callbacks: { label: (ctx) => `${ctx.dataset.label || ctx.label}: ${formatCurrency(ctx.raw)}` }
            }
        },
        ...extra
    };
}

function destroyCharts() {
    Object.values(state.charts).forEach((c) => c && c.destroy());
    state.charts = { comparison: null, line: null, pie: null };
}

function renderInsights(summary) {
    const ins = summary?.insights || {};
    el.insightTopCategory.textContent = ins.top_category?.name || "—";
    el.insightTopCategoryValue.textContent = ins.top_category ? formatCurrency(ins.top_category.value) : "Sem dados";

    el.insightBestDay.textContent = ins.best_day?.label || "—";
    el.insightBestDayValue.textContent = ins.best_day ? formatCurrency(ins.best_day.value) : "Sem dados";

    el.insightSavingsRate.textContent = `${Number(ins.savings_rate || 0).toFixed(1)}%`;
    el.insightAverageTicket.textContent = formatCurrency(ins.average_ticket || 0);
}

/* ============== Ações ============== */

async function handleAdd(event) {
    event.preventDefault();
    const tipo = currentTipo();
    const parcelado = el.isCredit.checked && tipo === "DESPESA";
    const parcelas = parcelado ? Math.max(2, Number(el.parcelas.value) || 2) : 1;

    const payload = {
        descricao: el.description.value.trim(),
        valor: Number(el.amount.value),
        tipo,
        categoria: el.category.value,
        data: el.date.value,
        parcelado,
        parcelas
    };

    try {
        const result = await http(API.criar, { method: "POST", body: JSON.stringify(payload) });
        el.form.reset();
        el.date.value = new Date().toISOString().slice(0, 10);
        el.segBtns.forEach((b) => {
            const active = b.dataset.tipo === "DESPESA";
            b.classList.toggle("active", active);
            b.setAttribute("aria-checked", active ? "true" : "false");
        });
        el.type.value = "DESPESA";
        populateCategories("DESPESA", el.category);
        el.isCredit.checked = false;
        toggleParcelas(false);

        const msg = result?.criadas > 1 ? `Parcelado em ${result.criadas} meses` : "Adicionado";
        showToast(msg, "success");
        await refreshAll();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Erro ao salvar.", "error");
    }
}

function openEditModal(id) {
    const tx = state.transactions.find((t) => String(t.id) === String(id));
    if (!tx) return;
    const tipo = (tx.tipo || "DESPESA").toUpperCase();
    el.editId.value = tx.id;
    el.editDescription.value = tx.descricao;
    el.editAmount.value = tx.valor;
    el.editDate.value = tx.data;
    el.editType.value = tipo;
    populateCategories(tipo, el.editCategory);
    if ([...el.editCategory.options].some((o) => o.value === tx.categoria)) {
        el.editCategory.value = tx.categoria;
    }
    el.editModal.classList.add("active");
    el.editModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
    el.editModal.classList.remove("active");
    el.editModal.setAttribute("aria-hidden", "true");
}

async function handleEdit(event) {
    event.preventDefault();
    const id = el.editId.value;
    const payload = {
        descricao: el.editDescription.value.trim(),
        valor: Number(el.editAmount.value),
        tipo: el.editType.value,
        categoria: el.editCategory.value,
        data: el.editDate.value
    };
    try {
        await http(API.atualizar(id), { method: "PUT", body: JSON.stringify(payload) });
        closeModal();
        showToast("Atualizado", "success");
        await refreshAll();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Erro ao atualizar.", "error");
    }
}

async function deleteTransaction(id) {
    if (!confirm("Excluir esta transação?")) return;
    try {
        await http(API.excluir(id), { method: "DELETE" });
        if (String(state.expandedId) === String(id)) state.expandedId = null;
        showToast("Excluído", "success");
        await refreshAll();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Erro ao excluir.", "error");
    }
}

function clearFilters() {
    el.filterMonth.value = "";
    el.filterDateFrom.value = "";
    el.filterDateTo.value = "";
    el.filterType.value = "all";
    el.filterCategory.value = "all";
    refreshAll();
}

/* ============== Toast ============== */

function showToast(message, type = "success", duration = 2200) {
    el.toast.className = `toast ${type} active`;
    el.toastMessage.textContent = message;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => el.toast.classList.remove("active"), duration);
}
