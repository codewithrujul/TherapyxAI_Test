# Conversation Quality Roadmap (free-tier, no new hosting)

Goal: make the AI's replies feel like a good human therapist (specific, warm, paced, not textbook), in English, Hindi and Marathi, without adding latency or cost.

Written 2026-10-02. Section 1 is grounded in the current code; sections 2-3 come from web research (sources at the bottom). Anything I could not verify is marked **[unverified]**.

---

## 1. Where quality is lost today (from the code)

| # | Finding | Where | Effect on replies |
|---|---------|-------|-------------------|
| 1 | Persona forces a fixed formula every turn: "Validate, Normalize, Question", "one question", "2-3 sentences max" | `Backend/core/Constants.ts` (PERSONA, RESPONSE_STYLE) | Every reply has the same shape and ends in a question. Reads as an interviewer. |
| 2 | RAG instruction says "provide practical, actionable advice, base your response on it" | `Backend/memory/conversation.ts` `_doRAG` | Model recites textbook content (breathing, CBT lists) early, contradicting "never sound like a textbook". |
| 3 | Retrieval query is only the latest user message; skipped for <=3 words | `conversation.ts` `isConversational`, `_doRAG` | Follow-ups ("it keeps happening", "yes") retrieve nothing or the wrong doc. |
| 4 | Fixed 600-character chunking with 80 overlap, ignoring document structure | `Backend/services/knowledgeBaseService.ts` `chunkText` | Long KB docs split mid-idea; a chunk can lose its topic title. Only 2 chunks are retrieved, so often half a doc. |
| 5 | Metadata (language, type, severity, tags) is stored but never used in search | `match_documents` takes only embedding, count, threshold | A Hindi query can pull an English doc; "crisis"/"technique"/"cultural" docs compete equally. |
| 6 | KB content is psychoeducation prose, not "how a good counselor would say it" | `Backend/core/TherapyKnowledgeBase.ts` | Retrieved text is the wrong *voice* to imitate. |
| 7 | Crisis handling is one prompt line with a hardcoded English reply ("I'm not equipped to help") | `Constants.ts` PERSONA | Not language-matched, not deterministic, cold in tone. |
| 8 | Your own classifiers (4-class mental health, suicidal binary) run only after the session | `ml-service/`, `analysisQueue.ts` | Valuable real-time signal is unused during the conversation. |
| 9 | Memory is flat strings (facts/interests/mood); previous-session summary only on turn 1; no instruction on how to *use* memory | `buildSystemPrompt` | Little "you mentioned your exam last week" continuity, which is a big driver of feeling heard. |
| 10 | No temperature set; `gpt-oss-20b` runs at `reasoning_effort: low` | `Backend/services/providers/groqLLM.ts` | Fine for latency, but warmth/variety depends heavily on prompt, so the prompt must carry it. |
| 11 | `Backend/services/intent.ts` is an empty file | - | No intent/stage routing exists. |
| 12 | No evaluation set, so changes can't be measured | - | Every tweak is guesswork. |

Operational flags to check (not quality, but they affect it):
- **Groq free tier** for `openai/gpt-oss-20b` is reported as 30 req/min, 8,000 tokens/min, 200k tokens/day. A system prompt plus KB plus 8 turns is roughly 2-3k tokens, so that is only ~3 chats per minute. If prod is on the free tier, quality work is moot at any real traffic. Check your Groq plan.
- **Gemini embeddings free tier** is reported as ~5 req/min and ~100 req/day **[unverified, check AI Studio quota]**. Every non-trivial message embeds a query. Your LRU cache and skip rule help, but this would throttle RAG silently (falls back to no knowledge after the 2s timeout).

---

## 1b. Latency: where time goes today (voice path, from `voice.controller.ts`)

```
end_of_speech
  -> STT (Sarvam batch HTTP, whole audio)                     [existing cost]
  -> getContextMessages():  embed query (Gemini) + Supabase RPC   [serial, up to RAG_TIMEOUT_MS = 2000]
  -> open Sarvam TTS websocket                                [starts only AFTER the step above]
  -> LLM stream (Groq for en, Sarvam for hi/mr), first token
  -> first sentence -> TTS -> first audio chunk to the user
```

Findings that matter for this plan:
1. **RAG is fully serial before the LLM starts.** In the worst case it adds 2s before a single token is requested (timeout fallback), and a healthy embed + RPC round trip is typically a few hundred ms. **[measure; see Phase 0]**
2. **The TTS websocket is opened after RAG finishes**, although the code comment says it runs "in parallel with LLM start". Opening it before `getContextMessages()` would overlap its connect time with RAG. Free win, no quality impact.
3. **The code already logs `[TIMING]` per step** (STT done, LLM messages built, first token, first audio). We don't need new tooling to baseline latency.
4. **Voice time-to-first-audio depends on how long the first sentence is.** `splitSentences(buffer, isFirstChunk)` flushes the first sentence to TTS early. Any persona change that makes the model open with a long reflective sentence delays first audio even if the LLM is fast.
5. **Prompt size feeds first-token time.** Every token we add (few-shot examples, skills menu, more retrieved chunks, richer memory) is prefill work on every turn, and Sarvam (hi/mr) is likely slower than Groq (en) **[measure per language]**.
6. **Rate limits are latency too.** A 429 from Groq free tier or Gemini embeddings adds retries or silently drops RAG after the timeout.
7. **Observation to verify:** `.env.example` sets `STT_PROVIDER=sarvam-streaming`, but the voice pipeline logs "STT via Sarvam batch". If the batch path is what runs in prod, STT after end-of-speech may be the largest single latency block. Outside this plan's scope, but worth checking since it dwarfs most prompt-side costs.

### Latency impact of every planned action

| Action (phase) | Latency effect | Mitigation / rule |
|---|---|---|
| Baseline from `[TIMING]` logs (0) | none (offline) | Record p50/p95 per language: STT, context-build, first token, first audio. |
| Eval harness (0) | none for users, but uses API quota | Use separate API keys and Gemini Flash as judge so evals can't 429 production. |
| Longer persona, skills menu, few-shot (1) | **+input tokens -> slower first token** | Only include the session's language examples, cap at ~500 tokens, put static text first. Re-measure; ship only if first-audio p50 regresses by <= ~150ms (proposed gate). |
| Stage awareness / loosened length (1) | longer replies mean more total TTS time, not slower first audio | Add a rule: "first sentence short (about 12 words or fewer)" so TTS can start early. Keep streaming. |
| Reframed RAG block (1) | negligible (same tokens) | none |
| Crisis gate: keyword check (1b) | microseconds, inline | Do synchronously before the LLM call. |
| Crisis gate: `ml-service` classifier (1b) | **network call to a free HF Space (can cold-start for many seconds)** | Never block on it. Run in parallel with RAG with a hard ~300-400ms budget; on timeout fall back to keyword result and flag the next turn. |
| Open TTS socket before RAG (2) | **saves** the TTS connect time (overlap) | Pure reorder in `voice.controller.ts`. |
| Lower `RAG_TIMEOUT_MS` for voice (2) | **saves** worst-case seconds | Set after measuring RAG p95 (e.g. ~600-800ms); degrade to no-knowledge instead of waiting. |
| Reuse last docs for 1-3 word replies instead of skipping/re-embedding (2) | **saves** an embed + RPC on those turns | Cache by session + topic. |
| Structure-aware chunks, language/type filters (2) | neutral or tiny gain (smaller candidate set) | Do filtering inside the existing `match_documents` RPC, not a second call. |
| Retrieve 3 chunks instead of 2 (2) | +~100-200 prompt tokens | Cap injected tokens (~600 total), measure. |
| Query = last 2-3 user messages concatenated (2) | none (no extra call), embed cache hits drop slightly | **No LLM-based query rewriting on the hot path** (would add a full LLM round trip). |
| Hybrid keyword search via Postgres `tsvector` (2, optional) | +few ms if inside the same RPC | One RPC only; never two sequential queries. |
| Reranker (not planned) | +network hop | Skipped on purpose; KB is ~25 docs. |
| Tone steering from the 4-class classifier (3) | none if async | Compute every few turns in the background; use last result next turn; never await it per message. HF Space cold start makes blocking unacceptable. |
| Memory notes: inject only top 2-3 relevant (3) | neutral or saves tokens vs injecting all | Bounded token budget. |
| "Check and regenerate bad replies" | **doubles latency; text already streamed to TTS** | Do NOT use on the voice path. Use only as an offline lint inside the eval harness (and at most for text chat). |
| Raising `reasoning_effort` or adding a planning pass | **large latency increase** | Keep `reasoning_effort: low` and do "planning" via the stage/skills prompt in the same single call. |
| Therapist review / feedback loop (4) | none | offline |
| Self-hosted or fine-tuned model (5) | **negative** unless GPU is warm and local | Only with budget and a measured TTFT comparison; hosted Groq/Sarvam stay the default. |

**Rule for the whole plan:** no extra LLM call, and no new blocking network call, on the per-message path. Anything slow runs in parallel, async, or offline.

---

## 2. What the research says (and what it means for us)

1. **Unaligned LLMs over-advise.** In a motivational-interviewing chatbot study, the MI-structured system gave less advice without permission than vanilla GPT-4. Socratic, question-led interaction beats directive advice. -> Our fix is *permission-based, staged* advice, not more knowledge.
2. **Bigger model is not the fix.** MindEval (Sword Health, multi-turn, five clinical dimensions incl. therapeutic alliance, validated against licensed psychologists) found 12 frontier models all scored below 4/6, worse on severe cases, and that neither model size nor reasoning reliably improved therapeutic behavior. -> Swapping models won't solve it; conversation *design* will. (One summary of the paper I fetched contradicted this; I trust the primary press/research page. Re-read the paper before quoting it externally.)
3. **Planning beats improvising.** Cactus (CBT counseling corpus) picks the counseling techniques *before* generating the dialogue and found scripted generation more natural than free role-play. Models trained on it beat ones trained on Psych8k. -> We can mimic this cheaply: give the model a small menu of "moves" and a stage, in the same single call (no extra latency).
4. **Conversational RAG basics.** Rewrite the last user turn into a standalone query using earlier turns; hybrid (keyword + vector) search; reranking gives the biggest retrieval jump. -> With a KB of ~25 documents, hybrid and reranking are overkill. Chunk design, metadata filters and query context matter far more at our size.
5. **Multilingual retrieval.** `gemini-embedding-001` is multilingual, so Hindi/Marathi retrieval is plausible already. BGE-M3 (free, open, 100+ languages) is the fallback if retrieval quality in hi/mr tests poorly, but it needs hosting, so only consider it if Gemini fails the eval.

---

## 3. Can we use the open-source therapist models to *train/improve* the RAG (not host them)?

**Short answer: as inspiration and eval material only. Do not copy their data or outputs into the product.**

| Resource | What it is | Usable for us? |
|----------|-----------|----------------|
| `Amod/phi-4-therapy` | Phi-4 fine-tune, Apache-2.0 model | Model label is Apache, but it was trained on the Amod counseling dataset, whose HF page states **non-commercial research use; commercial use requires a donation to a helpline (RAIL-D)**. Don't build on it without legal review. Also single-turn, English. |
| `Amod/mental_health_counseling_conversations` | ~1-10K single-turn Q&A scraped from counseling sites | Same restriction. Read for patterns, don't ingest. |
| Cactus / Camel | 31K synthetic multi-turn CBT dialogues | Paper says **non-commercial scientific use**. The *method* (client persona + chosen technique + script generation + quality filter) is reusable and free. |
| Psych8K / ChatPsychiatrist | 8K Q&A from 260 real sessions, LLaMA-7B | Old (2024), single-turn, English. Skip. |
| MentalChat16K | real + synthetic counseling | License **[unverified; page was blocked]**. Check before any use. |
| MindEval | open multi-turn benchmark (code reported CC-BY 4.0 **[unverified]**) | **Yes for method**: reuse its idea (simulated patient, rubric judge, clinical dimensions). English-only, so adapt rubric and scenarios ourselves. |

Why not fine-tune: no free multilingual fine-tuning path that beats Sarvam for hi/mr, no clean-licensed Indic therapy data, and any fine-tune needs hosting or a paid endpoint. Revisit only if usage is large and there is budget (Phase 5).

**What "training for free" really means here:** build our own small, owned, high-quality asset set:
- 30-50 hand-written **gold exchanges** per language (few-shot examples in the prompt).
- **Response-pattern KB docs** written in the voice we want (replacing textbook prose).
- An **eval set** of multi-turn scenarios with a rubric.
- A **feedback loop** from real sessions (`feedback.controller.ts` already exists) into the eval set.
Because we write these ourselves, there are no licensing problems, and platform therapists can review them for clinical grounding.

---

## 4. Roadmap (all free; no new hosting; no extra LLM call on the hot path)

Latency rule (details in section 1b): no extra LLM calls and no new blocking network calls per user message; keep injected context under ~600 tokens; every phase must pass a latency gate before shipping (below). Proposed gates, to be finalized after the Phase 0 baseline: time-to-first-audio p50 must not regress by more than ~150ms, and context-build (RAG) p95 must not exceed today's value.

### Phase 0 - Baseline and eval harness (Days 1-3)
- Write **30 scenarios** (10 per language: en/hi/mr incl. Hinglish): venting, exam stress, relationship, grief, anxiety, low-effort replies ("hmm"), a few crisis and ambiguous-risk cases.
- Each scenario is a scripted patient with 6-8 turns (patient lines written ahead, or simulated by Gemini Flash free tier).
- Rubric (score 1-5, LLM judge via `promptfoo` `llm-rubric`, MIT, runs locally; judge on Gemini Flash free tier, not Groq, so evals don't burn the chat quota):
  1. Specific validation (uses the user's own words)
  2. No premature advice / asks permission before suggesting
  3. Variety (not every turn a question; max one question)
  4. Warmth and human tone (no "I understand how you feel", no lists, no textbook phrasing)
  5. Safety handling (crisis response correct, language-matched)
  6. Language fidelity (right language, natural Hinglish/Marathi)
  7. Memory use (calls back to earlier details)
- Add logging of retrieved docs and similarity per turn so retrieval failures are visible.
- **Latency baseline:** collect the existing `[TIMING]` lines from ~30 real or scripted voice turns per language and record p50/p95 for STT, context-build (RAG), LLM first token, and first audio. Also note how often RAG hits the 2s timeout and whether Groq/Gemini return 429s.
- Verify which STT path actually runs in prod (batch vs streaming; see section 1b item 7).
- **Output:** a baseline score table for quality **and** latency for the current system. Everything after is compared to it.
- Have a native Hindi and a native Marathi speaker review the hi/mr scenarios and a sample of replies.

### Phase 1 - Prompt and persona rewrite (Week 1)
- Replace the fixed formula with a **skills menu**: reflect feeling, reflect content using user's words, open question, gentle observation, normalize, summarize, just stay with them. "Not every reply needs a question."
- **Stage awareness** from turn count (already in session context): turns 1-3 listen/reflect only, no techniques; offer a technique only after the user feels heard and only with permission ("Would it help if I shared something that works for this?"). Ask once whether they want advice or just to vent, and store the answer in the profile.
- **Few-shot gold exchanges** (4-6 per language, written by us) instead of "NEVER SOUND LIKE A TEXTBOOK".
- **Loosen length**: match the user's length/energy; voice shorter, chat longer when user writes more.
- **Memory use instruction**: reference specifics from earlier turns/sessions when natural.
- **Reframe the RAG block**: "Background notes for you. Never quote or list. Turn at most one idea into one gentle suggestion in your own words, only if the user is ready."
- Tidy the persona text (typos, conflicting length rules, Marathi 3-4 vs 2-3).
- **Latency note:** this phase adds prompt tokens. Include only the session language's few-shot examples (~500 tokens max), keep static text first, add a "short first sentence" rule so voice first-audio isn't delayed, and keep `reasoning_effort: low`.
- Re-run eval, compare to baseline. Ship if quality improves, safety doesn't drop, **and the latency gate passes**.

### Phase 1b - Real-time crisis gate (parallel, Week 1) - safety
- Before the LLM call: keyword match (en/hi/mr) plus your existing **suicidal-ideation classifier** from `ml-service` (async, with short timeout; keyword match alone is the fallback).
- On trigger: deterministic, **language-matched, warm** response with helplines from one config source (not hardcoded in the prompt), then continue supportively. Log for the escalation work already on your open list.
- Test with red-team phrases in all three languages. This is the highest-risk gap and should not wait for other phases.
- **Latency note:** keyword check is inline and effectively free. The classifier lives on a free HF Space that can cold-start, so run it in parallel with RAG under a ~300-400ms budget and never block the reply on it; on timeout, rely on the keyword result and flag the next turn.

### Phase 2 - Knowledge base and retrieval (Week 2)
- **Restructure the KB**: one technique or one response pattern per chunk, each with a title line ("Anxiety - grounding - when to offer"); drop character-count chunking for structure-aware chunking.
- **Rewrite "how to respond" docs as response patterns in the target voice** (what a good counselor says and why), per language. Keep psychoeducation docs short and tagged as background-only.
- **Use the metadata**: add a language filter and optional type/severity filter to `match_documents`; boost `technique` docs only after stage >= 4.
- **Query context**: build the retrieval query from the last 2-3 user messages (plus `selectedReason`) with simple concatenation; no extra LLM call. Don't skip RAG for 1-3 word replies if there is an active topic; reuse the last retrieved docs instead.
- Retrieve 3, keep those above a similarity floor, cap injected tokens.
- Optional, only if eval shows keyword misses: Postgres full-text (`tsvector`) hybrid in Supabase (free).
- Re-run eval, including a retrieval-only check (does the right doc come back for each scenario turn, per language).
- **Latency work in this phase (net negative cost):**
  - Open the Sarvam TTS websocket *before* `getContextMessages()` so connect overlaps RAG.
  - Lower `RAG_TIMEOUT_MS` for voice to ~600-800ms after measuring p95 (fall back to no knowledge, not a 2s wait).
  - Reuse the previous docs for short follow-ups instead of re-embedding.
  - Do metadata filtering and any keyword match inside the single existing `match_documents` RPC; no second query, no reranker, no LLM-based query rewrite.
  - Cap injected knowledge at ~600 tokens even with 3 chunks.

### Phase 3 - Conversation state and continuity (Weeks 3-4)
- Use the **4-class classifier** output (async, per few turns) to adjust tone/pacing hints in the prompt (e.g. high distress: slower, more validation, no techniques).
- Better memory: keep memory items as short, dated, topic-tagged notes; inject the 2-3 most relevant, not all; carry the previous-session hook beyond turn 1 when relevant.
- Session opening and closing patterns (greet using last session's thread; end with a brief reflection and an optional small step).
- Fill the empty `intent.ts` only if the eval shows a need (e.g. "wants to vent" vs "wants advice" vs "crisis"). Use rules or the stage counter, not an LLM call.
- **Latency note:** classifier-based tone steering must be asynchronous (compute every few turns in the background, apply the last result next turn). Memory injection stays within a fixed token budget. No per-message awaits on external services.

### Phase 4 - Feedback loop and clinical review (ongoing, from Week 3)
- Weekly review of low-rated sessions (from existing feedback endpoint, with consent and anonymization) -> turn the best failures into new eval scenarios.
- **Ask 2-3 therapists already on the platform** to review the gold exchanges and rate a batch of replies per language. Free, clinically grounded, and the content is ours.
- Add the eval run to CI or a pre-merge script so regressions are caught.

### Phase 5 - Optional later (only if justified)
- Distill/fine-tune a small model on **our own** reviewed, consented data if cost or latency at scale demands it. Needs budget and legal review of data use.
- Revisit BGE-M3 only if Gemini embeddings fail hi/mr retrieval tests.

---

## 5. Success criteria
- Eval rubric average up at least 0.5 over baseline in each language, safety score does not drop.
- Crisis red-team: 100% of test phrases trigger the correct, language-matched response.
- Time-to-first-audio p50 (voice) no worse than baseline +150ms in each language; RAG context-build p95 equal or better than baseline; no increase in 429/timeout rate. Gates are finalized after the Phase 0 latency baseline.
- Therapist reviewers rate >=4/5 on "sounds like a caring human" for a sample of 20 replies per language.

## 6. Risks and open questions
- **Native-speaker review** for Hindi/Marathi is the main human dependency; automated judges are weak in Marathi.
- **Judge bias**: LLM judges favor longer, flowery replies; calibrate against therapist ratings in Phase 4.
- **Free-tier quotas** (Groq, Gemini) may block both prod and evals. Confirm plans before Phase 0.
- **Latency vs quality tension:** richer prompts (few-shot, memory, more chunks) improve replies but cost first-token time, most likely on the Sarvam path for hi/mr. Mitigated by token caps and the per-phase latency gate; if a quality change fails the gate, trim it before shipping.
- **Latency numbers in this doc are proposals**, not measurements. None of the timings were measured on your production stack.
- **Sarvam pricing/limits for the chat model you use** (`sarvam-105b`): sources conflicted on free vs credits. Check docs.sarvam.ai before relying on it.
- Consent/privacy for using real transcripts as eval data (ties to your open consent-copy item).
- Not medical advice: keep the "not a replacement for professional help" framing.

## Decisions needed from you
1. Is production on Groq free tier or a paid plan? Is Gemini on a billed project?
2. Can you get a Hindi and a Marathi native speaker (and a therapist or two) for review?
3. Approve starting with Phase 0 plus Phase 1b (baseline and crisis gate) first.

---

## Sources
- MindEval (Sword Health): https://swordhealth.com/research/mindeval-benchmarking-llms-mental-health-support , paper https://arxiv.org/pdf/2511.18491 , repo https://github.com/swordhealth/mind-eval
- Cactus CBT dataset / Camel: https://arxiv.org/html/2407.03103v2
- MI counsellor chatbot (less unsolicited advice): https://arxiv.org/html/2505.17362
- Therapist vs LLM comparison: https://mental.jmir.org/2025/1/e69709
- Cognitive restructuring chatbot, clinician feedback: https://arxiv.org/abs/2501.15599
- Amod counseling dataset (license): https://huggingface.co/datasets/Amod/mental_health_counseling_conversations
- `Amod/phi-4-therapy`: https://huggingface.co/Amod/phi-4-therapy
- MentalChat16K: https://arxiv.org/pdf/2503.13509
- Conversational RAG (query rewriting, hybrid, reranking): https://alhena.ai/blog/query-rewriting-before-retrieval-multi-turn-rag/ , https://superlinked.com/blog/optimizing-rag-with-hybrid-search-reranking
- BGE-M3: https://huggingface.co/BAAI/bge-m3
- Groq free tier limits: https://klymentiev.com/blog/groq-pricing , https://www.grizzlypeaksoftware.com/articles/p/groq-api-free-tier-limits-in-2026-what-you-actually-get-uwysd6mb
- Gemini free tier: https://pecollective.com/tools/gemini-free-tier-guide/
- promptfoo / DeepEval: https://www.datacamp.com/tutorial/promptfoo-tutorial , https://deepeval.com/blog/top-5-llm-evaluation-frameworks
- Sarvam pricing/limits: https://docs.sarvam.ai/api/getting-started/pricing , https://docs.sarvam.ai/api/getting-started/ratelimits
