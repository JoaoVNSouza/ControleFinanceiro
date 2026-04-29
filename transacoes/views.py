from __future__ import annotations

import json
from datetime import date

from django.http import HttpResponseBadRequest, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from . import repo
from .forms import TransacaoForm
from .models import CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, TipoTransacao
from .services import (
    FiltroTransacoes,
    construir_resumo,
    criar_transacoes,
    listar_transacoes,
    normalizar_tipo,
)


def _filtros_da_request(request) -> FiltroTransacoes:
    return FiltroTransacoes(
        mes=request.GET.get("mes") or None,
        data_de=request.GET.get("data_de") or None,
        data_ate=request.GET.get("data_ate") or None,
        tipo=request.GET.get("tipo") or None,
        categoria=request.GET.get("categoria") or None,
    )


def dashboard(request):
    """Página principal: dashboard + form + tabela + análise."""
    hoje = date.today()
    contexto = {
        "hoje_iso": hoje.isoformat(),
        "mes_atual": hoje.strftime("%Y-%m"),
        "categorias_despesa": CATEGORIAS_DESPESA,
        "categorias_receita": CATEGORIAS_RECEITA,
        "tipos": [
            (TipoTransacao.RECEITA, "Receita"),
            (TipoTransacao.DESPESA, "Despesa"),
        ],
    }
    return render(request, "transacoes/dashboard.html", contexto)


def _serializar(tx: dict) -> dict:
    return {
        "id": tx.get("id"),
        "data": (tx.get("data") or "")[:10],
        "descricao": tx.get("descricao") or "",
        "valor": float(tx.get("valor") or 0),
        "tipo": normalizar_tipo(tx.get("tipo")),
        "categoria": tx.get("categoria") or "",
        "created_at": tx.get("created_at"),
    }


@require_http_methods(["GET"])
def api_listar(request):
    try:
        dados = listar_transacoes(_filtros_da_request(request))
    except Exception as exc:
        return JsonResponse({"detail": str(exc)}, status=502)
    return JsonResponse([_serializar(tx) for tx in dados], safe=False)


@require_http_methods(["GET"])
def api_resumo(request):
    try:
        dados = listar_transacoes(_filtros_da_request(request))
    except Exception as exc:
        return JsonResponse({"detail": str(exc)}, status=502)
    return JsonResponse(construir_resumo(dados))


@require_http_methods(["POST"])
def api_criar(request):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return HttpResponseBadRequest("JSON inválido")

    form = TransacaoForm(payload)
    if not form.is_valid():
        return JsonResponse({"detail": "Dados inválidos", "errors": form.errors}, status=400)

    cleaned = form.cleaned_data
    try:
        criadas = criar_transacoes(
            descricao=cleaned["descricao"],
            valor=cleaned["valor"],
            tipo=cleaned["tipo"],
            categoria=cleaned["categoria"],
            data_base=cleaned["data"],
            parcelas=cleaned.get("parcelas") or 1,
        )
    except Exception as exc:
        return JsonResponse({"detail": str(exc)}, status=502)

    return JsonResponse({
        "criadas": len(criadas),
        "ids": [tx.get("id") for tx in criadas if tx.get("id")],
    }, status=201)


@require_http_methods(["PUT", "PATCH"])
def api_atualizar(request, transacao_id: int):
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return HttpResponseBadRequest("JSON inválido")

    update_payload: dict = {}
    if "descricao" in payload:
        update_payload["descricao"] = payload["descricao"]
    if "valor" in payload:
        update_payload["valor"] = float(payload["valor"])
    if "tipo" in payload:
        update_payload["tipo"] = normalizar_tipo(payload["tipo"])
    if "categoria" in payload:
        update_payload["categoria"] = payload["categoria"]
    if "data" in payload:
        update_payload["data"] = payload["data"]

    try:
        tx = repo.atualizar(transacao_id, update_payload)
    except Exception as exc:
        return JsonResponse({"detail": str(exc)}, status=502)

    return JsonResponse({"id": tx.get("id"), "ok": True})


@require_http_methods(["DELETE"])
def api_excluir(request, transacao_id: int):
    try:
        repo.excluir(transacao_id)
    except Exception as exc:
        return JsonResponse({"detail": str(exc)}, status=502)
    return JsonResponse({"ok": True})
