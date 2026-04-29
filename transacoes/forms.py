from django import forms
from .models import CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, TipoTransacao


CATEGORIAS_CHOICES = [
    (c, c) for c in sorted(set(CATEGORIAS_DESPESA + CATEGORIAS_RECEITA))
]


class TransacaoForm(forms.Form):
    descricao = forms.CharField(
        max_length=255,
        widget=forms.TextInput(attrs={
            "placeholder": "Ex.: Salário, supermercado, boleto...",
            "autocomplete": "off",
        }),
    )
    valor = forms.DecimalField(
        min_value=0.01, max_digits=12, decimal_places=2,
        widget=forms.NumberInput(
            attrs={"step": "0.01", "placeholder": "0,00"}),
    )
    data = forms.DateField(widget=forms.DateInput(attrs={"type": "date"}))
    tipo = forms.ChoiceField(choices=TipoTransacao.choices)
    categoria = forms.ChoiceField(choices=CATEGORIAS_CHOICES)
    parcelado = forms.BooleanField(required=False)
    parcelas = forms.IntegerField(
        required=False, min_value=1, max_value=60, initial=1,
        widget=forms.NumberInput(attrs={"min": "1", "max": "60", "step": "1"}),
    )

    def clean(self):
        cleaned = super().clean()
        parcelado = cleaned.get("parcelado")
        parcelas = cleaned.get("parcelas") or 1
        if parcelado and parcelas < 2:
            self.add_error(
                "parcelas", "Para crédito parcelado informe ao menos 2 parcelas.")
        if parcelado and cleaned.get("tipo") != TipoTransacao.DESPESA:
            self.add_error(
                "parcelado", "Parcelamento só é aplicável para despesas.")
        cleaned["parcelas"] = parcelas if parcelado else 1
        return cleaned


class FiltroForm(forms.Form):
    mes = forms.CharField(required=False)
    data_de = forms.DateField(
        required=False, widget=forms.DateInput(attrs={"type": "date"}))
    data_ate = forms.DateField(
        required=False, widget=forms.DateInput(attrs={"type": "date"}))
    tipo = forms.ChoiceField(
        required=False,
        choices=[("all", "Todos"), ("RECEITA", "Receitas"),
                 ("DESPESA", "Despesas")],
    )
    categoria = forms.ChoiceField(
        required=False,
        choices=[("all", "Todas")] + CATEGORIAS_CHOICES,
    )
