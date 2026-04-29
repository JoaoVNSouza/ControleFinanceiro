# ControleGastos

Painel financeiro em Django + Supabase REST + Chart.js, com integração WhatsApp via N8N (extração de transações por LLM).

## Stack

- **Django 5** + Gunicorn + WhiteNoise
- **Supabase** (Postgres na nuvem) acessado via REST/PostgREST com `supabase-py`
- **Chart.js 4** para gráficos
- **N8N** como pipeline de entrada por WhatsApp (fluxo em `ControleGastosN8N.json`)

A tabela `transacoes` no Supabase é o sistema de registro. O Django mantém apenas um SQLite local para sessions/admin/auth.

## Rodar localmente

```bash
python -m venv .venv
.venv\Scripts\activate         # Windows
# source .venv/bin/activate    # Linux/Mac

pip install -r requirements.txt
cp .env.example .env           # edite com suas credenciais
python manage.py migrate
python manage.py runserver
```

Abra `http://localhost:8000/`.

## Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase (ex.: `https://xxxx.supabase.co/`) |
| `SUPABASE_KEY` | sim | Chave `anon` ou `service_role` |
| `DJANGO_SECRET_KEY` | sim em prod | `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DJANGO_DEBUG` | recomendado | `False` em produção |
| `DJANGO_ALLOWED_HOSTS` | sim em prod | Hosts separados por vírgula. Ex.: `gastos.seudominio.com,xxxx.easypanel.host` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | sim em prod | Com esquema. Ex.: `https://gastos.seudominio.com` |
| `DJANGO_HSTS_SECONDS` | opcional | Ex.: `31536000` se HTTPS estável |
| `WEB_CONCURRENCY` | opcional | Workers do gunicorn (default 3) |
| `PORT` | opcional | Porta de escuta (default 8000) |

## Deploy no Easypanel direto do GitHub

### 1. Subir o projeto pro GitHub

```bash
git add .
git commit -m "Setup Django + Supabase REST"
git remote add origin git@github.com:<seu-usuario>/<seu-repo>.git
git push -u origin main
```

> Confira que `.env`, `db.sqlite3`, `staticfiles/` e `.venv/` estão no `.gitignore` (já estão).

### 2. Criar o app no Easypanel

1. Acesse o painel da sua VPS → **Project → New Service → App**.
2. Em **Source**, escolha **GitHub** e autorize o Easypanel a acessar seu repositório.
3. Selecione o repo e a branch (`main`).
4. Em **Build**, escolha **Dockerfile** (já existe na raiz).
5. Em **Deploy**, defina:
   - **Port**: `8000`
   - **Path**: `/`

### 3. Variáveis de ambiente

Em **Environment**, cole:

```
SUPABASE_URL=https://supabase.jvsystem.site/
SUPABASE_KEY=<sua-chave>
DJANGO_SECRET_KEY=<gere-uma-nova>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=gastos.seudominio.com,*.easypanel.host
DJANGO_CSRF_TRUSTED_ORIGINS=https://gastos.seudominio.com
```

Para gerar a `DJANGO_SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 4. Domínio + HTTPS

Em **Domains** → **Add Domain** → escolha o subdomínio (ex.: `gastos.seudominio.com`) e ative **HTTPS** (Easypanel emite Let's Encrypt automaticamente).

Importante: depois que o domínio estiver no ar, **inclua a URL HTTPS no `DJANGO_CSRF_TRUSTED_ORIGINS`** e redeploy. Sem isso o POST do form falhará com CSRF 403.

### 5. Deploy automático

No Easypanel, ative **Auto Deploy** na fonte do GitHub. Cada `git push` na `main` reconstrói e republica.

```bash
git push origin main   # dispara o deploy
```

## Como o build funciona

- O `Dockerfile` instala dependências, roda `collectstatic` (servido por WhiteNoise) e expõe `8000`.
- No `CMD` o container faz `migrate` (cria SQLite local de sessions) e sobe o `gunicorn`.
- Conexão com o Supabase é via HTTPS (REST/PostgREST), então funciona mesmo se o Postgres estiver atrás de Cloudflare.

## Integração N8N (WhatsApp)

O fluxo `ControleGastosN8N.json` recebe mensagens via Evolution API, passa pelo Gemini com os prompts de `IAPrompt/`, e grava direto na tabela `transacoes` do Supabase. O Django lê dessa mesma tabela — não precisa adaptação.

## Estrutura

```
controlegastos/        # settings, urls, wsgi
transacoes/            # app principal
  ├── repo.py          # acesso Supabase REST
  ├── services.py      # filtros, parcelamento, resumo analítico
  ├── views.py         # dashboard + endpoints JSON
  ├── forms.py         # validação
  ├── models.py        # constantes (TipoTransacao, categorias)
  └── templates/transacoes/dashboard.html
static/                # CSS + JS
ControleGastosN8N.json # fluxo do n8n (não é executado pelo Django)
IAPrompt/              # prompts da LLM no n8n
```

## Endpoints

| Método | URL | Descrição |
|---|---|---|
| GET | `/` | Dashboard |
| GET | `/api/transacoes/` | Lista com filtros (`mes`, `data_de`, `data_ate`, `tipo`, `categoria`) |
| POST | `/api/transacoes/criar/` | Cria 1..N transações (parcelamento) |
| PUT | `/api/transacoes/<id>/` | Atualiza |
| DELETE | `/api/transacoes/<id>/excluir/` | Exclui |
| GET | `/api/resumo/` | Totais + dados dos gráficos |
