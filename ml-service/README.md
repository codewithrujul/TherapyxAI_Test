# ml-service

FastAPI service hosting the two production disorder-detection models,
deployed as a HuggingFace Docker Space (requires PRO, $9/month, to host a
Docker Space — CPU Basic hardware itself is free).

## Setup steps

1. **Push your models to HF Hub** (one-time, from your dev machine where
   the trained models exist):
   ```bash
   pip install huggingface_hub
   huggingface-cli login   # or set HF_TOKEN env var
   ```
   Edit `push_models_to_hub.py` to set your own HF username in the repo
   IDs, then run it:
   ```bash
   python push_models_to_hub.py
   ```

2. **Create a Docker Space on HuggingFace**:
   - huggingface.co/new-space
   - SDK: **Docker**
   - Hardware: **CPU Basic** (free, 2 vCPU / 16GB — plenty for two DistilBERT models)
   - Visibility: **Private** (this is an internal API, not a public demo)

3. **Set Space secrets** (Settings tab on the Space, not committed to the repo):
   - `API_KEY` — a random shared secret; your `queue-worker`'s
     `ORACLE_API_KEY` env var (rename if you like) must match this exactly
   - `FOUR_CLASS_MODEL_ID` — e.g. `your-username/mental-health-4class-v2`
   - `SUICIDAL_MODEL_ID` — e.g. `your-username/suicidal-binary-v2`
   - `HF_TOKEN` — a read-scoped token, needed since the model repos are private

4. **Push this folder's contents** (`main.py`, `Dockerfile`, `requirements.txt`)
   to the Space's own git repo (HF gives you a git remote URL on the Space page):
   ```bash
   git remote add space https://huggingface.co/spaces/your-username/your-space-name
   git push space main
   ```
   HF automatically builds the Docker image and deploys it — watch the
   "Logs" tab on the Space page for build progress.

5. **Your endpoint** will be at:
   `https://your-username-your-space-name.hf.space/analyze-session`

   Point `queue-worker`'s `ORACLE_ANALYZE_ENDPOINT` at this URL.

## Testing

```bash
curl -X POST https://your-username-your-space-name.hf.space/analyze-session \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <your API_KEY secret>" \
  -d '{"user_messages": ["I feel really anxious about tomorrow."]}'
```

`/health` is also available (no API key needed) for uptime monitoring.
