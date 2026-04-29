FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=controlegastos.settings \
    PORT=8000

WORKDIR /app

# Como usamos só Supabase REST (não psycopg) basta o slim — sem libpq.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collectstatic em build-time. As migrations rodam no entrypoint
# para garantir o SQLite local de sessions/admin.
RUN SECRET_KEY_BUILD=1 DJANGO_SECRET_KEY=build-only-key python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn controlegastos.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-3} --access-logfile - --error-logfile -"]
