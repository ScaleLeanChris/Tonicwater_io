# TonicWater.io SEO Agent - Docker Image
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create articles directory
RUN mkdir -p /app/articles_data

# Environment variables (override at runtime)
ENV PYTHONUNBUFFERED=1
ENV ARTICLES_DIR=/app/articles_data

# Default command: run the agent
CMD ["python", "src/main.py", "--demo"]
