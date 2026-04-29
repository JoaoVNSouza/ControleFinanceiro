"""Constantes de domínio. As transações ficam no Supabase via REST,
não há model Django com persistência local."""
from django.db import models


class TipoTransacao(models.TextChoices):
    RECEITA = "RECEITA", "Receita"
    DESPESA = "DESPESA", "Despesa"


CATEGORIAS_DESPESA = [
    "Compra", "Frete", "Embalagens", "Taxas de Cartão", "Tarifas Bancárias",
    "Juros / Multas", "Aluguel", "Luz", "Água", "Internet", "Salários",
    "Comissão", "Impostos", "Sistema", "Marketing", "Manutenção",
    "Material de Escritório", "Combustível", "Transporte", "Alimentação",
    "Outros",
]

CATEGORIAS_RECEITA = [
    "Venda", "Bonificação", "Juros", "Pagamentos", "Outras Receitas",
]
