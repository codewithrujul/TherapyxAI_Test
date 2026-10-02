"""
Quick end-to-end check against your live HuggingFace Space.

Usage (PowerShell):
    $env:HF_SPACE_API_KEY = "<your API_KEY secret>"
    python test_live_endpoint.py

The key is read from an env var so it never gets pasted into chat or code.
"""
import json
import os
import sys
import urllib.request

BASE_URL = "https://rajshende2208-ml-inference.hf.space"
API_KEY = os.environ.get("HF_SPACE_API_KEY")
if not API_KEY:
    sys.exit("Set HF_SPACE_API_KEY first (see usage at top of this file).")

# 1) Health check -- no key needed
with urllib.request.urlopen(f"{BASE_URL}/health", timeout=60) as r:
    print("health:", r.status, r.read().decode())

# 2) Real classification -- same message pattern as our earlier local demo,
#    so results should match what we saw locally (turn 4 flagged high-risk).
payload = {
    "user_messages": [
        "It's been okay I guess, kind of a long week at work.",
        "Not really anything specific, just tired all the time lately.",
        "Not great honestly, I keep lying awake overthinking everything.",
        "I don't know, lately I just feel like nothing really matters anymore.",
        "Yeah, a few weeks now. Honestly sometimes I think everyone would be better off without me around.",
        "Yeah maybe.",
    ]
}
req = urllib.request.Request(
    f"{BASE_URL}/analyze-session",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json", "X-API-Key": API_KEY},
    method="POST",
)
with urllib.request.urlopen(req, timeout=120) as r:
    body = json.loads(r.read().decode())

print("\nresponse (what your backend receives):")
print(json.dumps(body["response"], indent=2))
print("\naudit_log turns returned:", len(body["audit_log"]["per_turn_detail"]))

# 3) Wrong key must be rejected -- confirms our auth check works
bad = urllib.request.Request(
    f"{BASE_URL}/analyze-session",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json", "X-API-Key": "wrong-key"},
    method="POST",
)
try:
    urllib.request.urlopen(bad, timeout=60)
    print("\nWARNING: wrong key was ACCEPTED -- auth check is broken!")
except urllib.error.HTTPError as e:
    print(f"\nwrong-key request correctly rejected: HTTP {e.code}")
