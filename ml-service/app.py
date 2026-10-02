"""
FastAPI service hosting the two fine-tuned disorder-detection models.
Deployed as a HuggingFace Docker Space.

Receives a session's worth of user messages in one request, runs the same
analyze_session() logic already tested in session_batch_pipeline.py, and
returns the split {response, audit_log} result.
"""
import hmac
import os
from typing import List

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# ─── Config ─────────────────────────────────────────────────────────────────
# Models are pulled from private HF Hub repos at startup -- set these to
# wherever you push them with push_models_to_hub.py.
FOUR_CLASS_MODEL_ID = os.environ.get("FOUR_CLASS_MODEL_ID", "rajshende2208/mental-health-4class-v2")
SUICIDAL_MODEL_ID = os.environ.get("SUICIDAL_MODEL_ID", "rajshende2208/suicidal-binary-v2")

# Shared secret checked on every request -- must match ORACLE_API_KEY (kept
# that name in queue-worker/config/env.ts, even though this now runs on HF,
# not Oracle -- rename there if you want, functionally identical).
# .strip(): a trailing space/newline pasted into the Space secret is an easy, invisible mistake.
API_KEY = os.environ["API_KEY"].strip()

SUICIDAL_THRESHOLD = 0.35
WINDOW_SIZE = 3
FLAG_THRESHOLD = 0.30

app = FastAPI(title="Disorder Detection Service")

# ─── Load both models once, at startup (not per-request) ──────────────────────
print("Loading models...")
four_tok = AutoTokenizer.from_pretrained(FOUR_CLASS_MODEL_ID)
four_model = AutoModelForSequenceClassification.from_pretrained(FOUR_CLASS_MODEL_ID)
four_model.eval()

sui_tok = AutoTokenizer.from_pretrained(SUICIDAL_MODEL_ID)
sui_model = AutoModelForSequenceClassification.from_pretrained(SUICIDAL_MODEL_ID)
sui_model.eval()
print("Models loaded.")


def _classify_text(text: str):
    # return_token_type_ids=False: DistilBERT's forward() rejects that input, and older
    # transformers versions add it for tokenizers saved as "BertTokenizer".
    inputs = four_tok(text, return_tensors="pt", truncation=True, max_length=256,
                      return_token_type_ids=False)
    with torch.no_grad():
        logits = four_model(**inputs).logits[0]
    four_probs = torch.softmax(logits, dim=-1)
    four_result = {four_model.config.id2label[i]: float(four_probs[i]) for i in range(len(four_probs))}

    inputs2 = sui_tok(text, return_tensors="pt", truncation=True, max_length=256,
                      return_token_type_ids=False)
    with torch.no_grad():
        logits2 = sui_model(**inputs2).logits[0]
    sui_probs = torch.softmax(logits2, dim=-1)
    suicidal_prob = float(sui_probs[sui_model.config.label2id["Suicidal"]])

    return four_result, suicidal_prob


def analyze_session(user_messages: List[str]):
    per_turn_results = []
    history = []

    for i, text in enumerate(user_messages):
        history.append(text)
        window_text = " ".join(history[-WINDOW_SIZE:])

        # Suicidal: the message ALONE, no window -- ties the flag to the
        # exact message, not blurred by surrounding turns.
        _, suicidal_prob = _classify_text(text)
        # 4-class: WITH windowed context -- short replies inherit meaning
        # from the turns just before them.
        four_probs, _ = _classify_text(window_text)

        probs = {**four_probs, "Suicidal": suicidal_prob}
        primary = "Suicidal" if suicidal_prob >= SUICIDAL_THRESHOLD else max(four_probs, key=four_probs.get)

        per_turn_results.append({
            "turn_index": i,
            "text": text,
            "probabilities": {k: round(v, 4) for k, v in probs.items()},
            "primary": primary,
            "is_high_risk": suicidal_prob >= SUICIDAL_THRESHOLD,
        })

    high_risk_turns = [r for r in per_turn_results if r["is_high_risk"]]
    labels = ["Normal", "Depression", "Anxiety", "PTSD"]
    summary = {
        label: round(sum(r["probabilities"][label] for r in per_turn_results) / len(per_turn_results), 4)
        for label in labels
    }
    summary["Suicidal"] = round(max(r["probabilities"]["Suicidal"] for r in per_turn_results), 4)
    dominant_flags = [label for label, p in summary.items() if p >= FLAG_THRESHOLD]

    response = {
        "message_count": len(user_messages),
        "high_risk_triggered": len(high_risk_turns) > 0,
        "high_risk_turns": [
            {"turn": r["turn_index"], "text": r["text"], "suicidal_prob": r["probabilities"]["Suicidal"]}
            for r in high_risk_turns
        ],
        "session_summary": summary,
        "dominant_flags": dominant_flags,
    }
    audit_log = {"per_turn_detail": per_turn_results}
    return response, audit_log


# ─── API ────────────────────────────────────────────────────────────────────
class AnalyzeSessionRequest(BaseModel):
    user_messages: List[str]


@app.get("/health")
def health():
    # Hit periodically by an external uptime monitor (or Railway) to keep
    # the Space warm and confirm it's alive.
    return {"status": "ok"}


@app.post("/analyze-session")
def analyze_session_endpoint(req: AnalyzeSessionRequest, x_api_key: str = Header(None)):
    supplied = (x_api_key or "").strip()
    if not hmac.compare_digest(supplied.encode(), API_KEY.encode()):
        # Lengths only, never the keys. Visible in the Space's Logs tab (owner only).
        print(f"[auth] rejected request: supplied_len={len(supplied)} expected_len={len(API_KEY)}")
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    if not req.user_messages:
        raise HTTPException(status_code=400, detail="user_messages must be a non-empty list")

    response, audit_log = analyze_session(req.user_messages)
    return {"response": response, "audit_log": audit_log}
