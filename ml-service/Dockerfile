FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
# CPU-only torch build -- no GPU on the CPU Basic Space tier, and no need
# for one given these are small DistilBERT models.
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

COPY app.py .

# HuggingFace Docker Spaces expect the app to listen on port 7860.
EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
