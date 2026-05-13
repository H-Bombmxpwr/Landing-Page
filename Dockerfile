FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.2 /uv /uvx /bin/

WORKDIR /app

# Install dependencies first (cached layer)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy app
COPY . .

ENV PORT=8080
ENV DATA_DIR=/data
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8080

CMD uv run --frozen gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 app:app
