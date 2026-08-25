# LegAI Chatbot Benchmark: after_complexity_decomposition_fix

Generated: 2026-08-24T03:06:35.155Z
Mode: free/mock

## 1. Dataset summary

40 cases; 33 scorable; 7 review required.

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

- Complexity accuracy: 97.0%
- Issue recall / precision: 15.6% / 46.7%
- Expected-document Recall@5: 88.9%
- Grounding decision accuracy / rate: 69.7% / 25.0%
- Citation document hit rate: 77.8%

## 3. Metrics by category

- simple_single_issue: gate 100.0%, grounding 75.0%, retrieval 75.0%
- multi_aspect: gate 100.0%, grounding 20.0%, retrieval 100.0%
- messy_long: gate 0.0%, grounding 100.0%, retrieval N/A
- conversational: gate 100.0%, grounding 100.0%, retrieval 100.0%
- current_law: gate 100.0%, grounding 66.7%, retrieval 100.0%
- historical_version: gate 100.0%, grounding 50.0%, retrieval 50.0%
- future_law: gate 100.0%, grounding 0.0%, retrieval 100.0%
- old_vs_new: gate 100.0%, grounding 0.0%, retrieval 100.0%
- document_number: gate 100.0%, grounding 66.7%, retrieval 66.7%
- target_law: gate 100.0%, grounding 100.0%, retrieval 100.0%
- rag_sufficient: gate 100.0%, grounding 100.0%, retrieval 100.0%
- rag_insufficient: gate 100.0%, grounding 100.0%, retrieval N/A
- partial_effect: gate N/A, grounding N/A, retrieval N/A
- expired_historical: gate 100.0%, grounding 100.0%, retrieval 100.0%

## 4. Complexity-gate failures

- CASE_009: expected complex, got simple (no signals)
- CASE_010: expected complex, got simple (no signals)
- CASE_020: expected complex, got simple (no signals)
- CASE_030: expected complex, got simple (no signals)
- CASE_035: expected complex, got simple (no signals)

## 5. Decomposition failures

- CASE_009: expected 3 issues, got 0
- CASE_010: expected 3 issues, got 0
- CASE_019: expected 3 issues, got 2
- CASE_020: expected 3 issues, got 0
- CASE_030: expected 2 issues, got 0
- CASE_035: expected 3 issues, got 0

## 6. Retrieval misses

- None

## 7. False coverage cases

- CASE_005: pipeline marked complete although gold expects Grounding
- CASE_006: pipeline marked complete although gold expects Grounding
- CASE_007: pipeline marked complete although gold expects Grounding
- CASE_008: pipeline marked complete although gold expects Grounding
- CASE_009: pipeline marked complete although gold expects Grounding
- CASE_010: pipeline marked complete although gold expects Grounding
- CASE_013: pipeline marked complete although gold expects Grounding
- CASE_017: pipeline marked complete although gold expects Grounding
- CASE_018: pipeline marked complete although gold expects Grounding
- CASE_019: pipeline marked complete although gold expects Grounding
- CASE_020: pipeline marked complete although gold expects Grounding
- CASE_027: pipeline marked complete although gold expects Grounding
- CASE_028: pipeline marked complete although gold expects Grounding
- CASE_034: pipeline marked complete although gold expects Grounding
- CASE_035: pipeline marked complete although gold expects Grounding
- CASE_039: pipeline marked complete although gold expects Grounding
- CASE_040: pipeline marked complete although gold expects Grounding

## 8. Grounding over-trigger cases

- CASE_003: rag_irrelevant
- CASE_015: rag_irrelevant
- CASE_021: rag_irrelevant
- CASE_033: current_info_with_outdated_rag_issueYear_check

## 9. Grounding under-trigger cases

- CASE_006: gold expects Grounding
- CASE_007: gold expects Grounding
- CASE_008: gold expects Grounding
- CASE_010: gold expects Grounding
- CASE_017: gold expects Grounding
- CASE_018: gold expects Grounding
- CASE_019: gold expects Grounding
- CASE_020: gold expects Grounding
- CASE_034: gold expects Grounding
- CASE_035: gold expects Grounding
- CASE_040: gold expects Grounding

## 10. Citation failures

- CASE_003: no final structured citation
- CASE_013: no final structured citation
- CASE_015: no final structured citation
- CASE_021: no final structured citation
- CASE_033: no final structured citation

## 11. Call-count summary

- Decomposer: 7
- Embedding: 51
- Final Gemini: 30
- Grounding decisions: 10
- Actual Grounding calls: 0

## 12. Token summary

{"promptTokenCount":4102,"candidatesTokenCount":1033,"totalTokenCount":5135} (only SDK-exposed usage; no estimates)

## 13. Latency summary

Average measured total: 3583 ms/query.

## 14. Top 10 important failures

- CASE_003: grounding over-trigger: rag_irrelevant
- CASE_005: false coverage
- CASE_006: grounding under-trigger: 
- CASE_006: false coverage
- CASE_007: grounding under-trigger: 
- CASE_007: false coverage
- CASE_008: grounding under-trigger: 
- CASE_008: false coverage
- CASE_009: complexity false-simple
- CASE_009: false coverage

## Recommended live cases

- CASE_005: rag_irrelevant
- CASE_013: current_info_with_outdated_rag_issueYear_check

Live cases are recommendations only; they were not automatically executed.
