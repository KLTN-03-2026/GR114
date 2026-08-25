# LegAI Chatbot Benchmark: live_case_005

Generated: 2026-08-24T06:32:04.244Z
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
- Issue recall / precision: 100.0% / 100.0% (over-decomposition 0; missed 0)
- Expected-document Recall@5: N/A
- Subject coverage accuracy (scorable): 0.0%
- Coverage verdicts: real false-positive 1; real false-missing 0; benchmark artifacts 0; ambiguous/review 0
- Grounding decision accuracy / rate: 100.0% / 100.0% (unnecessary 0; missed 0)
- Citation document hit rate: N/A

## 3. Metrics by category

- multi_aspect: gate 100.0%, grounding 100.0%, retrieval N/A, coverage 0.0%

## 4. Complexity-gate failures

- None

## 5. Decomposition failures

- None

## 6. Retrieval misses

- None

## 7. Coverage Diagnostics

- CASE_005 Q1 (Quyền của người lao động khi đơn phương chấm dứt hợp đồng lao động theo quy định pháp luật): doc=69-2020-qh14 title=Luật Người lao động Việt Nam đi làm việc ở nước ngoài theo hợp đồng số 69/2020/QH14 article=Điều 6 pinecone=0.695 content=1.000 titleScore=0.437 articleScore=0.000 final=0.803 mode=clear_separation target=NA snippet="Điều 6. Quyền, nghĩa vụ của người lao động Việt Nam đi làm việc ở nước ngoài theo hợp đồng 1. Người lao động Việt Nam đi làm việc ở nước ngoài theo hợp đồng có các quyền sau đây: a) Được cung cấp thông tin về chính sách, pháp luật của Việt "; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_005 Q2 (Nghĩa vụ của người lao động khi đơn phương chấm dứt hợp đồng lao động theo quy định pháp luật): doc=DOC-1775801439737-77 title=Bộ luật dân sự 2015 số 91/2015/QH13 áp dụng 2025 mới nhất article=Điều
492 pinecone=0.711 content=0.483 titleScore=0.056 articleScore=0.000 final=0.416 mode=ambiguous_fallback target=NA snippet="Điều 492. Đơn phương chấm dứt thực hiện hợp đồng thuê khoán 1. Trường hợp một bên đơn phương chấm dứt thực hiện hợp đồng thì phải báo cho bên kia biết trước một thời gian hợp lý; nếu thuê khoán theo thời vụ hoặc theo chu kỳ khai thác thì th"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_005 Q2 (Nghĩa vụ của người lao động khi đơn phương chấm dứt hợp đồng lao động theo quy định pháp luật): doc=69-2020-qh14 title=Luật Người lao động Việt Nam đi làm việc ở nước ngoài theo hợp đồng số 69/2020/QH14 article=Điều 46 pinecone=0.705 content=0.820 titleScore=0.352 articleScore=0.000 final=0.630 mode=ambiguous_fallback target=NA snippet="Điều 46. Quyền, nghĩa vụ của người lao động do doanh nghiệp dịch vụ đưa đi làm việc ở nước ngoài 1. Các quyền, nghĩa vụ quy định tại Điều 6 của Luật này. 2. Ký kết hợp đồng đưa người lao động Việt Nam đi làm việc ở nước ngoài với doanh nghi"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_005 Q2 (Nghĩa vụ của người lao động khi đơn phương chấm dứt hợp đồng lao động theo quy định pháp luật): doc=69-2020-qh14 title=Luật Người lao động Việt Nam đi làm việc ở nước ngoài theo hợp đồng số 69/2020/QH14 article=Điều 49 pinecone=0.703 content=0.820 titleScore=0.352 articleScore=0.000 final=0.613 mode=ambiguous_fallback target=NA snippet="Điều 49. Quyền, nghĩa vụ của người lao động do đơn vị sự nghiệp đưa đi làm việc ở nước ngoài 1. Các quyền, nghĩa vụ quy định tại Điều 6 và khoản 5 Điều 46 của Luật này. 2. Ký kết hợp đồng đưa người lao động Việt Nam đi làm việc ở nước ngoài"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_005 Q2 (Nghĩa vụ của người lao động khi đơn phương chấm dứt hợp đồng lao động theo quy định pháp luật): doc=35-2026-tt-bgdđt-2026 title=Thông tư 35/2026/TT-BGDĐT article=Điều 104 pinecone=0.702 content=0.496 titleScore=0.000 articleScore=0.000 final=0.337 mode=ambiguous_fallback target=NA snippet="Điều 104. Thủ tục, nghĩa vụ, trách nhiệm của các bên khi thực hiện chấm dứt hợp đồng trước thời hạn Thủ tục, nghĩa vụ, trách nhiệm của các bên khi thực hiện chấm dứt hợp đồng trước thời hạn theo quy định tại ĐKCT, tuân thủ Điều 64 Nghị định"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_005 Q2 (Nghĩa vụ của người lao động khi đơn phương chấm dứt hợp đồng lao động theo quy định pháp luật): doc=69-2020-qh14 title=Luật Người lao động Việt Nam đi làm việc ở nước ngoài theo hợp đồng số 69/2020/QH14 article=Điều 51 pinecone=0.702 content=0.627 titleScore=0.352 articleScore=0.000 final=0.475 mode=ambiguous_fallback target=NA snippet="Điều 51. Quyền, nghĩa vụ của người lao động Việt Nam đi làm việc ở nước ngoài theo hợp đồng lao động trực tiếp giao kết 1. Người lao động Việt Nam đi làm việc ở nước ngoài theo hợp đồng lao động trực tiếp giao kết có các quyền sau đây: a) Đ"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_005 Q3 (Thời hạn báo trước khi người lao động đơn phương chấm dứt hợp đồng lao động): doc=DOC-1775801439737-77 title=Bộ luật dân sự 2015 số 91/2015/QH13 áp dụng 2025 mới nhất article=Điều
492 pinecone=0.720 content=0.612 titleScore=0.000 articleScore=0.000 final=0.496 mode=clear_separation target=NA snippet="Điều 492. Đơn phương chấm dứt thực hiện hợp đồng thuê khoán 1. Trường hợp một bên đơn phương chấm dứt thực hiện hợp đồng thì phải báo cho bên kia biết trước một thời gian hợp lý; nếu thuê khoán theo thời vụ hoặc theo chu kỳ khai thác thì th"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY

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

- Coverage: 0
- Freshness: 0
- Target mismatch: 0
- Irrelevant RAG: 1
- Empty RAG: 0
- Other: 0

## 9. Citation failures

- None

## 10. Operational summary

- Decomposer: 1 (1/query)
- Embedding: 3 (3/query)
- Final Gemini: 1; all Gemini 2/query
- Grounding decisions: 1
- Actual Grounding calls: 1 (1/query)
- Tokens: {"promptTokenCount":583,"candidatesTokenCount":153,"totalTokenCount":736} (SDK-exposed usage only)
- Average measured latency: 82489 ms/query

## 11. Top 10 important failures

- CASE_005: real coverage false-positive: RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY

## Recommended live cases

- CASE_005: rag_irrelevant

Live cases are recommendations only; they were not automatically executed.
