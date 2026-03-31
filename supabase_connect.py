import os
from datetime import date, datetime, timedelta
from typing import Any, Optional
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


class SupabaseConnect:
    def __init__(self) -> None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv('SUPABASE_KEY')

        if not url or not key:
            raise RuntimeError(
                "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env")

        self.client: Client = create_client(url, key)

    def _base_query(self):
        return self.client.table("transacoes").select("*")

    def list_transactions(
        self,
        month: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        tx_type: Optional[str] = None,
        category: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        query = self._base_query()

        if month:
            start = datetime.strptime(month + "-01", "%Y-%m-%d").date()
            if start.month == 12:
                end = date(start.year + 1, 1, 1)
            else:
                end = date(start.year, start.month + 1, 1)

            query = query.gte("data", start.isoformat()).lt(
                "data", end.isoformat())

        if date_from:
            query = query.gte("data", date_from)

        if date_to:
            query = query.lte("data", date_to)

        if tx_type and tx_type != "all":
            query = query.eq("tipo", tx_type)

        if category and category != "all":
            query = query.eq("categoria", category)

        response = query.order("data", desc=False).order(
            "created_at", desc=False).execute()

        return response.data or []

    def create_transaction(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = self.client.table("transacoes").insert(payload).execute()
        data = response.data or []
        return data[0] if data else payload

    def update_transaction(self, transaction_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = (
            self.client
            .table("transacoes")
            .update(payload)
            .eq("id", transaction_id)
            .execute()
        )
        data = response.data or []
        return data[0] if data else payload

    def delete_transaction(self, transaction_id: str) -> None:
        self.client.table("transacoes").delete().eq(
            "id", transaction_id).execute()

    def build_summary(
        self,
        month: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        tx_type: Optional[str] = None,
        category: Optional[str] = None,
    ) -> dict[str, Any]:
        transactions = self.list_transactions(
            month=month,
            date_from=date_from,
            date_to=date_to,
            tx_type=tx_type,
            category=category,
        )

        if not transactions:
            return {
                "transaction_count": 0,
                "totals": {"income": 0, "expense": 0, "balance": 0},
                "comparison": {"income": 0, "expense": 0},
                "line": {"labels": [], "income": [], "expense": []},
                "pie": {"labels": [], "values": []},
                "insights": {
                    "top_category": None,
                    "best_day": None,
                    "savings_rate": 0,
                    "average_ticket": 0,
                },
            }

        import pandas as pd

        df = pd.DataFrame(transactions).copy()
        df["tipo"] = df["tipo"].astype(str).str.lower().replace(
            {"despesa": "expense", "despes": "expense", "receita": "income"}
        )
        df["valor"] = pd.to_numeric(df["valor"], errors="coerce").fillna(0)
        df["categoria"] = df["categoria"].fillna(
            "Sem categoria").replace("", "Sem categoria")
        df["data"] = pd.to_datetime(df["data"], errors="coerce")
        df = df.dropna(subset=["data"])

        income_df = df[df["tipo"] == "income"]
        expense_df = df[df["tipo"] == "expense"]

        income_total = float(income_df["valor"].sum())
        expense_total = float(expense_df["valor"].sum())
        balance = income_total - expense_total

        daily = (
            df.assign(day=df["data"].dt.strftime("%d/%m"))
            .groupby(["day", "tipo"])["valor"]
            .sum()
            .unstack(fill_value=0)
            .reset_index()
        )

        line_labels = daily["day"].tolist()
        line_income = daily["income"].tolist() if "income" in daily else [
            0] * len(line_labels)
        line_expense = daily["expense"].tolist() if "expense" in daily else [
            0] * len(line_labels)

        cat_series = (
            expense_df.groupby("categoria")["valor"]
            .sum()
            .sort_values(ascending=False)
        )

        pie_labels = cat_series.head(8).index.tolist()
        pie_values = [float(v) for v in cat_series.head(8).tolist()]

        top_category = None
        if not cat_series.empty:
            top_category = {
                "name": str(cat_series.index[0]),
                "value": float(cat_series.iloc[0]),
            }

        best_day = None
        day_series = (
            df.groupby(df["data"].dt.strftime("%d/%m"))["valor"]
            .sum()
            .sort_values(ascending=False)
        )
        if not day_series.empty:
            best_day = {
                "label": str(day_series.index[0]),
                "value": float(day_series.iloc[0]),
            }

        average_ticket = float(df["valor"].mean()) if not df.empty else 0
        savings_rate = (balance / income_total *
                        100) if income_total > 0 else 0

        return {
            "transaction_count": int(len(df)),
            "totals": {
                "income": income_total,
                "expense": expense_total,
                "balance": balance,
            },
            "comparison": {
                "income": income_total,
                "expense": expense_total,
            },
            "line": {
                "labels": line_labels,
                "income": [float(v) for v in line_income],
                "expense": [float(v) for v in line_expense],
            },
            "pie": {
                "labels": pie_labels,
                "values": pie_values,
            },
            "insights": {
                "top_category": top_category,
                "best_day": best_day,
                "savings_rate": float(savings_rate),
                "average_ticket": average_ticket,
            },
        }
