"""Acesso à tabela `transacoes` via Supabase REST (PostgREST).

Funciona pelo HTTPS, então atravessa Cloudflare/proxy sem problema —
diferente da conexão direta ao Postgres na porta 5432.
"""
from __future__ import annotations

from datetime import date, datetime
from functools import lru_cache
from typing import Any, Optional

from django.conf import settings
from supabase import Client, create_client


TABELA = "transacoes"


@lru_cache(maxsize=1)
def _client() -> Client:
    url = getattr(settings, "SUPABASE_URL", "") or ""
    key = getattr(settings, "SUPABASE_KEY", "") or ""
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL e SUPABASE_KEY precisam estar configurados no .env"
        )
    return create_client(url, key)


def _intervalo_do_mes(mes: str) -> tuple[Optional[date], Optional[date]]:
    try:
        inicio = datetime.strptime(mes + "-01", "%Y-%m-%d").date()
    except ValueError:
        return None, None
    if inicio.month == 12:
        fim = date(inicio.year + 1, 1, 1)
    else:
        fim = date(inicio.year, inicio.month + 1, 1)
    return inicio, fim


def listar(
    *,
    mes: Optional[str] = None,
    data_de: Optional[str] = None,
    data_ate: Optional[str] = None,
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
) -> list[dict[str, Any]]:
    query = _client().table(TABELA).select("*")

    if mes:
        inicio, fim = _intervalo_do_mes(mes)
        if inicio and fim:
            query = query.gte("data", inicio.isoformat()).lt("data", fim.isoformat())
    if data_de:
        query = query.gte("data", data_de)
    if data_ate:
        query = query.lte("data", data_ate)
    if categoria and categoria != "all":
        query = query.eq("categoria", categoria)
    # tipo é filtrado em Python para tolerar variações (DESPESA/despesa/despes)

    resp = query.order("data", desc=True).order("created_at", desc=True).execute()
    dados = resp.data or []

    if tipo and tipo != "all":
        from .services import normalizar_tipo
        alvo = normalizar_tipo(tipo)
        dados = [d for d in dados if normalizar_tipo(d.get("tipo")) == alvo]

    return dados


def obter(transacao_id: int) -> Optional[dict[str, Any]]:
    resp = _client().table(TABELA).select("*").eq("id", transacao_id).limit(1).execute()
    dados = resp.data or []
    return dados[0] if dados else None


def criar(payload: dict[str, Any]) -> dict[str, Any]:
    resp = _client().table(TABELA).insert(payload).execute()
    dados = resp.data or []
    return dados[0] if dados else payload


def atualizar(transacao_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    resp = _client().table(TABELA).update(payload).eq("id", transacao_id).execute()
    dados = resp.data or []
    return dados[0] if dados else payload


def excluir(transacao_id: int) -> None:
    _client().table(TABELA).delete().eq("id", transacao_id).execute()
