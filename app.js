const API_BASE = "http://localhost:8000/api";

const CATEGORIES = {
  income: [
    { id: "salario", name: "Salário" },
    { id: "freelance", name: "Freelance" },
    { id: "investimentos", name: "Investimentos" },
    { id: "outros_receita", name: "Outros" }
  ],
  expense: [
    { id: "alimentacao", name: "Alimentação" },
    { id: "moradia", name: "Moradia" },
    { id: "transporte", name: "Transporte" },
    { id: "contas", name: "Contas" },
    { id: "saude", name: "Saúde" },
    { id: "lazer", name: "Lazer" },
    { id: "compras", name: "Compras" },
    { id: "outros_despesa", name: "Outros" }
  ]
};

const state = {
  transactions: [],
  summary: null,
  charts: {
    comparison: null,
    line: null,
    pie: null
  }
};

const elements = {
  form: document.getElementById("transaction-form"),
  description: document.getElementById("description"),
  amount: document.getElementById("amount"),
  date: document.getElementById("date"),
  type: document.getElementById("type"),
  category: document.getElementById("category"),
  editForm: document.getElementById("edit-form"),
  editId: document.getElementById("edit-id"),
  editDescription: document.getElementById("edit-description"),
  editAmount: document.getElementById("edit-amount"),
  editDate: document.getElementById("edit-date"),
  editType: document.getElementById("edit-type"),
  editCategory: document.getElementById("edit-category"),
  transactionsList: document.getElementById("transactions-list"),
  emptyState: document.getElementById("empty-state"),
  balance: document.getElementById("balance"),
  income: document.getElementById("income"),
  expense: document.getElementById("expense"),
  txCount: document.getElementById("transactions-count"),
  currentPeriod: document.getElementById("current-period"),
  filterMonth: document.getElementById("filter-month"),
  filterDateFrom: document.getElementById("filter-date-from"),
  filterDateTo: document.getElementById("filter-date-to"),
  filterType: document.getElementById("filter-type"),
  filterCategory: document.getElementById("filter-category"),
  btnApplyFilters: document.getElementById("btn-apply-filters"),
  btnClearFilters: document.getElementById("btn-clear-filters"),
  btnRefresh: document.getElementById("btn-refresh"),
  btnOpenNew: document.getElementById("btn-open-new"),
  editModal: document.getElementById("edit-modal"),
  modalClose: document.getElementById("modal-close"),
  cancelEdit: document.getElementById("cancel-edit"),
  toast: document.getElementById("toast"),
  toastMessage: document.getElementById("toast-message"),
  comparisonChart: document.getElementById("comparison-chart"),
  lineChart: document.getElementById("line-chart"),
  pieChart: document.getElementById("pie-chart"),
  insightTopCategory: document.getElementById("insight-top-category"),
  insightTopCategoryValue: document.getElementById("insight-top-category-value"),
  insightBestDay: document.getElementById("insight-best-day"),
  insightBestDayValue: document.getElementById("insight-best-day-value"),
  insightSavingsRate: document.getElementById("insight-savings-rate"),
  insightAverageTicket: document.getElementById("insight-average-ticket")
};

document.addEventListener("DOMContentLoaded", async () => {
  initializeDefaults();
  populateCategories();
  populateFilterCategories();
  populateMonthFilter();
  bindEvents();
  await refreshAll();
});

function bindEvents() {
  elements.form.addEventListener("submit", handleAddTransaction);
  elements.editForm.addEventListener("submit", handleEditTransaction);

  elements.type.addEventListener("change", () => populateCategories(elements.type.value, elements.category));
  elements.editType.addEventListener("change", () => populateCategories(elements.editType.value, elements.editCategory));

  elements.btnApplyFilters.addEventListener("click", refreshAll);
  elements.btnClearFilters.addEventListener("click", clearFilters);
  elements.btnRefresh.addEventListener("click", refreshAll);
  elements.btnOpenNew.addEventListener("click", () => document.getElementById("nova-transacao").scrollIntoView({ behavior: "smooth" }));

  elements.modalClose.addEventListener("click", closeModal);
  elements.cancelEdit.addEventListener("click", closeModal);
  elements.editModal.addEventListener("click", (event) => {
    if (event.target === elements.editModal) closeModal();
  });

  elements.transactionsList.addEventListener("click", handleTableActions);

  document.querySelectorAll(".quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      elements.description.value = btn.dataset.desc || "";
      elements.type.value = btn.dataset.type || "expense";
      populateCategories(elements.type.value, elements.category);
      elements.category.value = btn.dataset.cat || "";
      elements.amount.focus();
    });
  });
}

function initializeDefaults() {
  elements.date.value = todayISO();
  elements.filterDateFrom.value = "";
  elements.filterDateTo.value = "";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthISO(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function populateCategories(type = "expense", target = elements.category) {
  const categories = CATEGORIES[type] || [];
  target.innerHTML = categories
    .map((category) => `<option value="${category.id}">${category.name}</option>`)
    .join("");
}

function populateFilterCategories() {
  const all = [...CATEGORIES.income, ...CATEGORIES.expense];
  elements.filterCategory.innerHTML = `
    <option value="all">Todas categorias</option>
    ${all.map((category) => `<option value="${category.id}">${category.name}</option>`).join("")}
  `;
}

function populateMonthFilter() {
  const now = new Date();
  const options = ['<option value="">Todos os meses</option>'];

  for (let i = -12; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    options.push(`<option value="${value}">${capitalize(label)}</option>`);
  }

  elements.filterMonth.innerHTML = options.join("");
  elements.filterMonth.value = monthISO(now);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

function normalizeTipo(tipo) {
  const t = String(tipo || "").toLowerCase().trim();
  if (["income", "receita", "receitas"].includes(t)) return "income";
  if (["expense", "despesa", "despesas", "despes"].includes(t)) return "expense";
  return "expense";
}

function normalizeTransaction(tx) {
  return {
    id: tx.id,
    descricao: tx.descricao ?? tx.description ?? "",
    valor: Number(tx.valor ?? tx.amount ?? 0),
    tipo: normalizeTipo(tx.tipo ?? tx.type),
    categoria: tx.categoria ?? tx.category ?? "outros_despesa",
    data: tx.data ?? tx.date ?? tx.created_at?.slice?.(0, 10) ?? "",
    created_at: tx.created_at ?? null
  };
}

function buildQueryParams() {
  const params = new URLSearchParams();

  if (elements.filterMonth.value) params.set("month", elements.filterMonth.value);
  if (elements.filterDateFrom.value) params.set("date_from", elements.filterDateFrom.value);
  if (elements.filterDateTo.value) params.set("date_to", elements.filterDateTo.value);
  if (elements.filterType.value !== "all") params.set("type", elements.filterType.value);
  if (elements.filterCategory.value !== "all") params.set("category", elements.filterCategory.value);

  return params;
}

async function refreshAll() {
  try {
    showToast("Carregando dados...", "success", 1200);
    updateCurrentPeriodLabel();

    const params = buildQueryParams();
    const query = params.toString();

    const [transactionsResponse, summaryResponse] = await Promise.all([
      fetch(`${API_BASE}/transactions${query ? `?${query}` : ""}`),
      fetch(`${API_BASE}/summary${query ? `?${query}` : ""}`)
    ]);

    if (!transactionsResponse.ok) throw new Error("Falha ao carregar transações.");
    if (!summaryResponse.ok) throw new Error("Falha ao carregar resumo.");

    const transactions = await transactionsResponse.json();
    const summary = await summaryResponse.json();

    state.transactions = Array.isArray(transactions) ? transactions.map(normalizeTransaction) : [];
    state.summary = summary;

    renderTransactions();
    renderDashboard(summary);
    renderCharts(summary);
    renderInsights(summary);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Erro ao carregar dados.", "error");
  }
}

function updateCurrentPeriodLabel() {
  if (elements.filterMonth.value) {
    const [year, month] = elements.filterMonth.value.split("-");
    const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric"
    });
    elements.currentPeriod.textContent = `Período: ${capitalize(label)}`;
    return;
  }

  if (elements.filterDateFrom.value || elements.filterDateTo.value) {
    const from = elements.filterDateFrom.value ? formatDate(elements.filterDateFrom.value) : "Início";
    const to = elements.filterDateTo.value ? formatDate(elements.filterDateTo.value) : "Fim";
    elements.currentPeriod.textContent = `Período: ${from} → ${to}`;
    return;
  }

  elements.currentPeriod.textContent = "Período: Todos";
}

function renderDashboard(summary) {
  const totals = summary?.totals || {};

  elements.balance.textContent = formatCurrency(totals.balance);
  elements.income.textContent = formatCurrency(totals.income);
  elements.expense.textContent = formatCurrency(totals.expense);
  elements.txCount.textContent = String(summary?.transaction_count ?? state.transactions.length);
}

function renderTransactions() {
  if (!state.transactions.length) {
    elements.transactionsList.innerHTML = "";
    elements.emptyState.style.display = "block";
    return;
  }

  elements.emptyState.style.display = "none";

  const typeLabels = {
    income: "Receita",
    expense: "Despesa"
  };

  elements.transactionsList.innerHTML = state.transactions
    .slice()
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map((tx) => `
      <tr>
        <td>${formatDate(tx.data)}</td>
        <td class="tx-desc">${escapeHtml(tx.descricao)}</td>
        <td><span class="badge category">${escapeHtml(getCategoryLabel(tx.tipo, tx.categoria))}</span></td>
        <td><span class="badge ${tx.tipo}">${typeLabels[tx.tipo] || tx.tipo}</span></td>
        <td class="${tx.tipo === "income" ? "amount-income" : "amount-expense"}">
          ${tx.tipo === "income" ? "+" : "-"} ${formatCurrency(tx.valor)}
        </td>
        <td>
          <div class="actions">
            <button class="icon-btn edit" data-action="edit" data-id="${tx.id}" title="Editar">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="icon-btn delete" data-action="delete" data-id="${tx.id}" title="Excluir">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `)
    .join("");
}

function getCategoryLabel(type, categoryId) {
  const list = CATEGORIES[type] || [];
  const found = list.find((item) => item.id === categoryId);
  return found ? found.name : (categoryId || "Sem categoria");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

function renderCharts(summary) {
  const comparisonCtx = elements.comparisonChart.getContext("2d");
  const lineCtx = elements.lineChart.getContext("2d");
  const pieCtx = elements.pieChart.getContext("2d");

  destroyCharts();

  const comparison = summary?.comparison || { income: 0, expense: 0 };
  const line = summary?.line || { labels: [], income: [], expense: [] };
  const pie = summary?.pie || { labels: [], values: [] };

  state.charts.comparison = new Chart(comparisonCtx, {
    type: "bar",
    data: {
      labels: ["Receitas", "Despesas"],
      datasets: [{
        label: "Valor",
        data: [comparison.income || 0, comparison.expense || 0],
        borderRadius: 12
      }]
    },
    options: chartBaseOptions({
      indexAxis: "x",
      plugins: { legend: { display: false } }
    })
  });

  state.charts.line = new Chart(lineCtx, {
    type: "line",
    data: {
      labels: line.labels || [],
      datasets: [
        {
          label: "Receitas",
          data: line.income || [],
          tension: 0.35,
          fill: true
        },
        {
          label: "Despesas",
          data: line.expense || [],
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: chartBaseOptions({
      plugins: { legend: { position: "bottom" } }
    })
  });

  state.charts.pie = new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: pie.labels || [],
      datasets: [{
        data: pie.values || [],
        borderWidth: 0,
        cutout: "68%"
      }]
    },
    options: chartBaseOptions({
      plugins: {
        legend: { position: "bottom" }
      }
    })
  });
}

function chartBaseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: "#c9cee5" },
        grid: { color: "rgba(255,255,255,0.06)" }
      },
      y: {
        ticks: {
          color: "#c9cee5",
          callback: (value) => formatCurrency(value)
        },
        grid: { color: "rgba(255,255,255,0.06)" }
      }
    },
    plugins: {
      legend: {
        labels: { color: "#eef2ff" }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label || ctx.label}: ${formatCurrency(ctx.raw)}`
        }
      }
    },
    ...extra
  };
}

function destroyCharts() {
  Object.values(state.charts).forEach((chart) => chart && chart.destroy());
  state.charts = { comparison: null, line: null, pie: null };
}

function renderInsights(summary) {
  const insights = summary?.insights || {};

  elements.insightTopCategory.textContent = insights.top_category?.name || "—";
  elements.insightTopCategoryValue.textContent = insights.top_category
    ? formatCurrency(insights.top_category.value)
    : "Sem dados";

  elements.insightBestDay.textContent = insights.best_day?.label || "—";
  elements.insightBestDayValue.textContent = insights.best_day
    ? formatCurrency(insights.best_day.value)
    : "Sem dados";

  elements.insightSavingsRate.textContent = `${Number(insights.savings_rate || 0).toFixed(1)}%`;
  elements.insightAverageTicket.textContent = formatCurrency(insights.average_ticket || 0);
}

async function handleAddTransaction(event) {
  event.preventDefault();

  const payload = {
    descricao: elements.description.value.trim(),
    valor: Number(elements.amount.value),
    tipo: normalizeTipo(elements.type.value),
    categoria: elements.category.value,
    data: elements.date.value
  };

  try {
    const response = await fetch(`${API_BASE}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Não foi possível salvar a transação.");
    }

    elements.form.reset();
    elements.date.value = todayISO();
    elements.type.value = "income";
    populateCategories("income", elements.category);

    showToast("Transação salva com sucesso!", "success");
    await refreshAll();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

function handleTableActions(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "edit") openEditModal(id);
  if (action === "delete") deleteTransaction(id);
}

function openEditModal(id) {
  const tx = state.transactions.find((item) => String(item.id) === String(id));
  if (!tx) return;

  elements.editId.value = tx.id;
  elements.editDescription.value = tx.descricao;
  elements.editAmount.value = tx.valor;
  elements.editDate.value = tx.data;
  elements.editType.value = tx.tipo;
  populateCategories(tx.tipo, elements.editCategory);
  elements.editCategory.value = tx.categoria;

  elements.editModal.classList.add("active");
}

function closeModal() {
  elements.editModal.classList.remove("active");
}

async function handleEditTransaction(event) {
  event.preventDefault();

  const id = elements.editId.value;
  const payload = {
    descricao: elements.editDescription.value.trim(),
    valor: Number(elements.editAmount.value),
    tipo: normalizeTipo(elements.editType.value),
    categoria: elements.editCategory.value,
    data: elements.editDate.value
  };

  try {
    const response = await fetch(`${API_BASE}/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Não foi possível atualizar a transação.");
    }

    closeModal();
    showToast("Transação atualizada!", "success");
    await refreshAll();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

async function deleteTransaction(id) {
  if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

  try {
    const response = await fetch(`${API_BASE}/transactions/${id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Não foi possível excluir a transação.");
    }

    showToast("Transação removida.", "success");
    await refreshAll();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

function clearFilters() {
  elements.filterMonth.value = "";
  elements.filterDateFrom.value = "";
  elements.filterDateTo.value = "";
  elements.filterType.value = "all";
  elements.filterCategory.value = "all";
  refreshAll();
}

function showToast(message, type = "success", duration = 2200) {
  elements.toast.className = `toast ${type} active`;
  elements.toastMessage.textContent = message;

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    elements.toast.classList.remove("active");
  }, duration);
}