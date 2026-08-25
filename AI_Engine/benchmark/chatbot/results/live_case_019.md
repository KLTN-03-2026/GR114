# LegAI Chatbot Benchmark: live_case_019

Generated: 2026-08-24T06:44:28.621Z
Mode: live

## 1. Dataset summary

40 cases; 1 general scorable; 0 general review required. Subject coverage: 1 raw labeled, 1 scorable, 0 review required.

| Category | Cases |
|---|---:|
| simple_single_issue | 4 |
| multi_aspect | 5 |
| messy_long | 3 |
| conversational | 3 |
| current_law | 3 |
| historical_version | 2 |
| future_law | 2 |
| old_vs_new | 3 |
| document_number | 3 |
| target_law | 3 |
| rag_sufficient | 2 |
| rag_insufficient | 3 |
| partial_effect | 2 |
| expired_historical | 2 |

## 2. Overall metrics

- Complexity accuracy: 100.0% (false-simple 0; false-complex 0)
- Issue recall / precision: 0.0% / 0.0% (over-decomposition 2; missed 3)
- Expected-document Recall@5: 100.0%
- Subject coverage accuracy (scorable): 100.0%
- Coverage verdicts: real false-positive 0; real false-missing 0; benchmark artifacts 0; ambiguous/review 0
- Grounding decision accuracy / rate: 100.0% / 100.0% (unnecessary 0; missed 0)
- Citation document hit rate: 0.0%

## 3. Metrics by category

- old_vs_new: gate 100.0%, grounding 100.0%, retrieval 100.0%, coverage 100.0%

## 4. Complexity-gate failures

- None

## 5. Decomposition failures

- CASE_019: expected 3 issues, got 2

## 6. Retrieval misses

- None

## 7. Coverage Diagnostics

- None

### Benchmark artifacts

- None

### Ambiguous / review required

- None

## 8. Grounding outcomes

### Over-trigger

- None

### Under-trigger

- None

### Reason distribution

- Coverage: 1
- Freshness: 0
- Target mismatch: 1
- Irrelevant RAG: 0
- Empty RAG: 0
- Other: 0

## 9. Citation failures

- None

## 10. Operational summary

- Decomposer: 1 (1/query)
- Embedding: 2 (2/query)
- Final Gemini: 1; all Gemini 2/query
- Grounding decisions: 1
- Actual Grounding calls: 1 (1/query)
- Tokens: {"promptTokenCount":596,"candidatesTokenCount":127,"totalTokenCount":723} (SDK-exposed usage only)
- Average measured latency: 47690 ms/query

## 11. Top 10 important failures

- None

## Recommended live cases

- No evidence-based candidate from this run.

Live cases are recommendations only; they were not automatically executed.
