from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase_connect import SupabaseConnect

app = FastAPI(title="Controle Gastos", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = SupabaseConnect()


class TransactionIn(BaseModel):
    descricao: str = Field(min_length=1)
    valor: float = Field(gt=0)
    tipo: str
    categoria: str = Field(min_length=1)
    data: str


class TransactionUpdate(BaseModel):
    descricao: str = Field(min_length=1)
    valor: float = Field(gt=0)
    tipo: str
    categoria: str = Field(min_length=1)
    data: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/transactions")
def get_transactions(
    month: Optional[str] = Query(default=None, description="YYYY-MM"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    type: Optional[str] = None,
    category: Optional[str] = None,
):
    return db.list_transactions(
        month=month,
        date_from=date_from,
        date_to=date_to,
        tx_type=type,
        category=category,
    )


@app.post("/api/transactions")
def create_transaction(payload: TransactionIn):
    data = payload.model_dump()
    data["tipo"] = normalize_tipo(data["tipo"])
    return db.create_transaction(data)


@app.put("/api/transactions/{transaction_id}")
def update_transaction(transaction_id: str, payload: TransactionUpdate):
    data = payload.model_dump()
    data["tipo"] = normalize_tipo(data["tipo"])
    return db.update_transaction(transaction_id, data)


@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(transaction_id: str):
    db.delete_transaction(transaction_id)
    return {"message": "Transação excluída com sucesso"}


@app.get("/api/summary")
def get_summary(
    month: Optional[str] = Query(default=None, description="YYYY-MM"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    type: Optional[str] = None,
    category: Optional[str] = None,
):
    return db.build_summary(
        month=month,
        date_from=date_from,
        date_to=date_to,
        tx_type=type,
        category=category,
    )


def normalize_tipo(value: str) -> str:
    t = (value or "").strip().lower()
    if t in {"income", "receita", "receitas"}:
        return "income"
    return "expense"
