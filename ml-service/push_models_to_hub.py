"""
Run this ONCE from your dev machine (where the trained models already
exist locally) to push both production models to private HuggingFace Hub
repos. The ml-service Docker Space then pulls them down at startup via
AutoModel.from_pretrained(repo_id) -- same pattern used throughout this
project for every external dataset/model.

Requires: pip install huggingface_hub, and `huggingface-cli login` first
(or set HF_TOKEN env var) with a token that has write access.
"""
from huggingface_hub import HfApi
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Update these to your own HF username/org.
FOUR_CLASS_LOCAL_PATH = "D:/Raj/git project/.scratch/finetuned-mental-health-model-4class-v2/final"
FOUR_CLASS_REPO_ID = "rajshende2208/mental-health-4class-v2"

SUICIDAL_LOCAL_PATH = "D:/Raj/git project/.scratch/finetuned-suicidal-binary-v2/final"
SUICIDAL_REPO_ID = "rajshende2208/suicidal-binary-v2"

api = HfApi()

for local_path, repo_id in [
    (FOUR_CLASS_LOCAL_PATH, FOUR_CLASS_REPO_ID),
    (SUICIDAL_LOCAL_PATH, SUICIDAL_REPO_ID),
]:
    print(f"Pushing {local_path} -> {repo_id}...")
    api.create_repo(repo_id, private=True, exist_ok=True)  # private=True: not public

    tokenizer = AutoTokenizer.from_pretrained(local_path)
    model = AutoModelForSequenceClassification.from_pretrained(local_path)

    tokenizer.push_to_hub(repo_id, private=True)
    model.push_to_hub(repo_id, private=True)
    print(f"Done: https://huggingface.co/{repo_id}")

print("\nBoth models pushed. Update FOUR_CLASS_MODEL_ID / SUICIDAL_MODEL_ID")
print("in main.py (or as env vars on the Space) to match the repo IDs above.")
