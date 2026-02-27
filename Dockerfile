FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Volume for persistent data (visit counter, image cache)
# Mount your Railway Volume at /data and set DATA_DIR=/data
VOLUME ["/data"]

ENV PORT=8080
ENV DATA_DIR=/data

EXPOSE 8080

CMD gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 app:app
