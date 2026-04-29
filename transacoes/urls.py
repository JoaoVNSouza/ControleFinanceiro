from django.urls import path

from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("api/transacoes/", views.api_listar, name="api-listar"),
    path("api/transacoes/criar/", views.api_criar, name="api-criar"),
    path("api/transacoes/<int:transacao_id>/", views.api_atualizar, name="api-atualizar"),
    path("api/transacoes/<int:transacao_id>/excluir/", views.api_excluir, name="api-excluir"),
    path("api/resumo/", views.api_resumo, name="api-resumo"),
]
