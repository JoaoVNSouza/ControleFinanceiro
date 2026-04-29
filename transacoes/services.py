"""Serviços de domínio: parcelamento, filtros e geração do resumo analítico.

As transações são tratadas como dicts vindos do Supabase REST.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, Optional

from . import repo
from .models import CATEGORIAS_DESPESA


@dataclass
class FiltroTransacoes:
    mes: Optional[str] = None
    data_de: Optional[str] = None
    data_ate: Optional[str] = None
    tipo: Optional[str] = None
    categoria: Optional[str] = None


def normalizar_tipo(valor: Optional[str]) -> str:
    v = (valor or "").upper().strip()
    if v in {"RECEITA", "RECEITAS", "INCOME"}:
        return "RECEITA"
    return "DESPESA"


def listar_transacoes(filtros: FiltroTransacoes) -> list[dict]:
    return repo.listar(
        mes=filtros.mes,
        data_de=filtros.data_de,
        data_ate=filtros.data_ate,
        tipo=filtros.tipo,
        categoria=filtros.categoria,
    )


def _adicionar_meses(base: date, meses: int) -> date:
    ano = base.year + (base.month - 1 + meses) // 12
    mes = (base.month - 1 + meses) % 12 + 1
    dia = min(base.day, _ultimo_dia_mes(ano, mes))
    return date(ano, mes, dia)


def _ultimo_dia_mes(ano: int, mes: int) -> int:
    proximo = date(ano + 1, 1, 1) if mes == 12 else date(ano, mes + 1, 1)
    return (proximo - timedelta(days=1)).day


def criar_transacoes(
    *,
    descricao: str,
    valor: Decimal,
    tipo: str,
    categoria: str,
    data_base: date,
    parcelas: int = 1,
) -> list[dict]:
    """Cria 1..N transações no Supabase. Para parcelamento, distribui o valor
    em N meses e adiciona o sufixo (i/N) na descrição (mesmo padrão do N8N)."""
    parcelas = max(1, int(parcelas or 1))
    tipo_norm = normalizar_tipo(tipo)

    valor_total = Decimal(valor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if parcelas == 1:
        return [repo.criar({
            "descricao": descricao,
            "valor": float(valor_total),
            "tipo": tipo_norm,
            "categoria": categoria,
            "data": data_base.isoformat(),
        })]

    valor_parcela = (valor_total / parcelas).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    diferenca = valor_total - (valor_parcela * parcelas)

    criadas: list[dict] = []
    for i in range(parcelas):
        valor_atual = valor_parcela + (diferenca if i == parcelas - 1 else Decimal("0"))
        criadas.append(repo.criar({
            "descricao": f"{descricao} ({i + 1}/{parcelas})",
            "valor": float(valor_atual),
            "tipo": tipo_norm,
            "categoria": categoria,
            "data": _adicionar_meses(data_base, i).isoformat(),
        }))

    return criadas


def _parse_data(valor) -> Optional[date]:
    if isinstance(valor, date):
        return valor
    if not valor:
        return None
    try:
        return datetime.strptime(str(valor)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def construir_resumo(transacoes: Iterable[dict]) -> dict:
    transacoes = list(transacoes)

    if not transacoes:
        return {
            "transaction_count": 0,
            "totals": {"income": 0.0, "expense": 0.0, "balance": 0.0},
            "comparison": {"income": 0.0, "expense": 0.0},
            "line": {"labels": [], "income": [], "expense": []},
            "pie": {"labels": [], "values": []},
            "insights": {
                "top_category": None,
                "best_day": None,
                "savings_rate": 0.0,
                "average_ticket": 0.0,
            },
        }

    receitas_total = Decimal("0")
    despesas_total = Decimal("0")
    por_dia_receita: dict[date, Decimal] = defaultdict(lambda: Decimal("0"))
    por_dia_despesa: dict[date, Decimal] = defaultdict(lambda: Decimal("0"))
    por_categoria_despesa: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    por_dia: dict[date, Decimal] = defaultdict(lambda: Decimal("0"))

    for tx in transacoes:
        valor = Decimal(str(tx.get("valor") or 0))
        dia = _parse_data(tx.get("data"))
        if dia is None:
            continue
        por_dia[dia] += valor
        if normalizar_tipo(tx.get("tipo")) == "RECEITA":
            receitas_total += valor
            por_dia_receita[dia] += valor
        else:
            despesas_total += valor
            por_dia_despesa[dia] += valor
            categoria = (tx.get("categoria") or "Sem categoria").strip() or "Sem categoria"
            por_categoria_despesa[categoria] += valor

    saldo = receitas_total - despesas_total

    dias_ordenados = sorted(set(list(por_dia_receita.keys()) + list(por_dia_despesa.keys())))
    line_labels = [d.strftime("%d/%m") for d in dias_ordenados]
    line_income = [float(por_dia_receita.get(d, Decimal("0"))) for d in dias_ordenados]
    line_expense = [float(por_dia_despesa.get(d, Decimal("0"))) for d in dias_ordenados]

    categorias_ordenadas = sorted(
        por_categoria_despesa.items(), key=lambda item: item[1], reverse=True
    )[:8]
    pie_labels = [k for k, _ in categorias_ordenadas]
    pie_values = [float(v) for _, v in categorias_ordenadas]

    top_categoria = None
    if categorias_ordenadas:
        nome, valor = categorias_ordenadas[0]
        top_categoria = {"name": nome, "value": float(valor)}

    melhor_dia = None
    if por_dia:
        dia, valor = max(por_dia.items(), key=lambda item: item[1])
        melhor_dia = {"label": dia.strftime("%d/%m"), "value": float(valor)}

    media = sum((Decimal(str(t.get("valor") or 0)) for t in transacoes), Decimal("0")) / len(transacoes)
    taxa_economia = (
        float((saldo / receitas_total) * 100) if receitas_total > 0 else 0.0
    )

    return {
        "transaction_count": len(transacoes),
        "totals": {
            "income": float(receitas_total),
            "expense": float(despesas_total),
            "balance": float(saldo),
        },
        "comparison": {
            "income": float(receitas_total),
            "expense": float(despesas_total),
        },
        "line": {
            "labels": line_labels,
            "income": line_income,
            "expense": line_expense,
        },
        "pie": {"labels": pie_labels, "values": pie_values},
        "insights": {
            "top_category": top_categoria,
            "best_day": melhor_dia,
            "savings_rate": taxa_economia,
            "average_ticket": float(media),
        },
        "categorias_disponiveis": sorted(set(CATEGORIAS_DESPESA)),
    }
