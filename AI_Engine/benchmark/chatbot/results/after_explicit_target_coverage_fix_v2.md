# LegAI Chatbot Benchmark: after_explicit_target_coverage_fix_v2

Generated: 2026-08-24T04:19:37.928Z
Mode: free/mock

## 1. Dataset summary

40 cases; 33 general scorable; 7 general review required. Subject coverage: 12 raw labeled, 10 scorable, 2 review required.

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

- Complexity accuracy: 93.9% (false-simple 2; false-complex 0)
- Issue recall / precision: 11.1% / 41.7% (over-decomposition 7; missed 40)
- Expected-document Recall@5: 88.9%
- Subject coverage accuracy (scorable): 40.0%
- Coverage verdicts: real false-positive 6; real false-missing 0; benchmark artifacts 2; ambiguous/review 2
- Grounding decision accuracy / rate: 72.7% / 27.5% (unnecessary 4; missed 5)
- Citation document hit rate: 74.1%

## 3. Metrics by category

- simple_single_issue: gate 100.0%, grounding 75.0%, retrieval 75.0%, coverage N/A
- multi_aspect: gate 80.0%, grounding 20.0%, retrieval 100.0%, coverage 0.0%
- messy_long: gate 0.0%, grounding 100.0%, retrieval N/A, coverage 0.0%
- conversational: gate 100.0%, grounding 100.0%, retrieval 100.0%, coverage N/A
- current_law: gate 100.0%, grounding 66.7%, retrieval 100.0%, coverage 100.0%
- historical_version: gate 100.0%, grounding 50.0%, retrieval 50.0%, coverage N/A
- future_law: gate 100.0%, grounding 0.0%, retrieval 100.0%, coverage 100.0%
- old_vs_new: gate 100.0%, grounding 100.0%, retrieval 100.0%, coverage 100.0%
- document_number: gate 100.0%, grounding 66.7%, retrieval 66.7%, coverage N/A
- target_law: gate 100.0%, grounding 100.0%, retrieval 100.0%, coverage N/A
- rag_sufficient: gate 100.0%, grounding 100.0%, retrieval 100.0%, coverage N/A
- rag_insufficient: gate 100.0%, grounding 100.0%, retrieval N/A, coverage 33.3%
- partial_effect: gate N/A, grounding N/A, retrieval N/A, coverage N/A
- expired_historical: gate 100.0%, grounding 100.0%, retrieval 100.0%, coverage N/A

## 4. Complexity-gate failures

- CASE_009: expected complex, got simple (no signals)
- CASE_010: expected complex, got simple (no signals)
- CASE_020: expected complex, got simple (no signals)
- CASE_030: expected complex, got simple (no signals)
- CASE_034: expected complex, got simple (multiple_requested_outputs)
- CASE_035: expected complex, got simple (no signals)

## 5. Decomposition failures

- CASE_009: expected 3 issues, got 0
- CASE_010: expected 3 issues, got 0
- CASE_019: expected 3 issues, got 2
- CASE_020: expected 3 issues, got 0
- CASE_030: expected 2 issues, got 0
- CASE_034: expected 3 issues, got 0
- CASE_035: expected 3 issues, got 0

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
- CASE_007 Q1 (Mức phạt tiền đối với hành vi vi phạm hành chính cụ thể): doc=15-2012-qh13 title=Luật Xử lý vi phạm hành chính số 15/2012/QH13 article=Điều 23 pinecone=0.728 content=1.000 titleScore=0.337 articleScore=0.000 final=0.807 mode=clear_separation target=NA snippet="Điều 23. Phạt tiền 1. Mức phạt tiền trong xử phạt vi phạm hành chính từ 50.000 đồng đến 1.000.000.000 đồng đối với cá nhân, từ 100.000 đồng đến 2.000.000.000 đồng đối với tổ chức, trừ trường hợp quy định tại khoản 3 Điều 24 của Luật này. Đố"; insufficient because DECOMPOSITION_TOO_BROAD, RETRIEVAL_SEMANTIC_ONLY, COVERAGE_EXISTENCE_ONLY
- CASE_007 Q2 (Các hình thức xử phạt bổ sung áp dụng đối với hành vi vi phạm hành chính cụ thể): doc=15-2012-qh13 title=Luật Xử lý vi phạm hành chính số 15/2012/QH13 article=Điều 21 pinecone=0.791 content=0.888 titleScore=0.268 articleScore=0.000 final=0.721 mode=clear_separation target=NA snippet="Điều 21. Các hình thức xử phạt và nguyên tắc áp dụng 1. Các hình thức xử phạt vi phạm hành chính bao gồm: a) Cảnh cáo; b) Phạt tiền; c) Tước quyền sử dụng giấy phép, chứng chỉ hành nghề có thời hạn hoặc đình chỉ hoạt động có thời hạn; d) Tị"; insufficient because DECOMPOSITION_TOO_BROAD, RETRIEVAL_SEMANTIC_ONLY, COVERAGE_EXISTENCE_ONLY
- CASE_009 Q1 (tôi ký hợp đồng rồi công ty cứ nợ lương 2 tháng tôi muốn nghỉ luôn nhưng họ bảo phải báo trước rồi còn giữ giấy tờ của tôi vậy tôi được nghỉ không, có đòi lương được không, giấy tờ họ có phải trả không?): doc=69-2020-qh14 title=Luật Người lao động Việt Nam đi làm việc ở nước ngoài theo hợp đồng số 69/2020/QH14 article=Điều 53 pinecone=0.711 content=0.196 titleScore=0.044 articleScore=0.000 final=0.220 mode=ambiguous_fallback target=NA snippet="Điều 53. Đăng ký hợp đồng lao động 1. Hồ sơ đăng ký hợp đồng lao động bao gồm: a) Văn bản đăng ký theo mẫu do Bộ trưởng Bộ Lao động - Thương binh và Xã hội quy định; b) Bản sao hợp đồng lao động kèm theo bản dịch tiếng Việt được chứng thực;"; insufficient because DECOMPOSITION_TOO_BROAD, RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_009 Q1 (tôi ký hợp đồng rồi công ty cứ nợ lương 2 tháng tôi muốn nghỉ luôn nhưng họ bảo phải báo trước rồi còn giữ giấy tờ của tôi vậy tôi được nghỉ không, có đòi lương được không, giấy tờ họ có phải trả không?): doc=106-2025-qh15 title=Luật Thi hành án dân sự số 106/2025/QH15 article=Điều 94 pinecone=0.702 content=0.069 titleScore=0.000 articleScore=0.000 final=0.089 mode=ambiguous_fallback target=NA snippet="Điều 94. Cưỡng chế buộc nhận người lao động trở lại làm việc Trường hợp cưỡng chế thi hành nghĩa vụ buộc nhận người lao động trở lại làm việc thì khi ra quyết định cưỡng chế, Chấp hành viên ấn định thời hạn 05 ngày làm việc kể từ ngày được "; insufficient because DECOMPOSITION_TOO_BROAD, RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_009 Q1 (tôi ký hợp đồng rồi công ty cứ nợ lương 2 tháng tôi muốn nghỉ luôn nhưng họ bảo phải báo trước rồi còn giữ giấy tờ của tôi vậy tôi được nghỉ không, có đòi lương được không, giấy tờ họ có phải trả không?): doc=DOC-1775801439737-77 title=Bộ luật dân sự 2015 số 91/2015/QH13 áp dụng 2025 mới nhất article=Điều
329 pinecone=0.700 content=0.196 titleScore=0.000 articleScore=0.000 final=0.166 mode=ambiguous_fallback target=NA snippet="Điều 329. Ký cược 1. Ký cược là việc bên thuê tài sản là động sản giao cho bên cho thuê một khoản tiền hoặc kim khí quý, đá quý hoặc vật có giá trị khác (sau đây gọi chung là tài sản ký cược) trong một thời hạn để bảo đảm việc trả lại tài s"; insufficient because DECOMPOSITION_TOO_BROAD, RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_009 Q1 (tôi ký hợp đồng rồi công ty cứ nợ lương 2 tháng tôi muốn nghỉ luôn nhưng họ bảo phải báo trước rồi còn giữ giấy tờ của tôi vậy tôi được nghỉ không, có đòi lương được không, giấy tờ họ có phải trả không?): doc=DOC-1775801439737-77 title=Bộ luật dân sự 2015 số 91/2015/QH13 áp dụng 2025 mới nhất article=Điều
346 pinecone=0.695 content=0.095 titleScore=0.000 articleScore=0.000 final=0.074 mode=ambiguous_fallback target=NA snippet="Điều 346. Cầm giữ tài sản Cầm giữ tài sản là việc bên có quyền (sau đây gọi là bên cầm giữ) đang nắm giữ hợp pháp tài sản là đối tượng của hợp đồng song vụ được chiếm giữ tài sản trong trường hợp bên có nghĩa vụ không thực hiện hoặc thực hi"; insufficient because DECOMPOSITION_TOO_BROAD, RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_009 Q1 (tôi ký hợp đồng rồi công ty cứ nợ lương 2 tháng tôi muốn nghỉ luôn nhưng họ bảo phải báo trước rồi còn giữ giấy tờ của tôi vậy tôi được nghỉ không, có đòi lương được không, giấy tờ họ có phải trả không?): doc=78-2015-qh13 title=Luật Nghĩa vụ quân sự số 78/2015/QH13 article=Căn cứ/Mở đầu pinecone=0.692 content=0.154 titleScore=0.000 articleScore=0.032 final=0.108 mode=ambiguous_fallback target=NA snippet="Điều 49. Chế độ chính sách của công dân trong thời gian đăng ký nghĩa vụ quân sự, khám, kiểm tra sức khỏe 1. Công dân đang làm việc tại cơ quan, tổ chức trong thời gian thực hiện đăng ký nghĩa vụ quân sự, khám, kiểm tra sức khỏe nghĩa vụ qu"; insufficient because DECOMPOSITION_TOO_BROAD, RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_027 Q1 (Hôm nay Chính phủ vừa ban hành quy định pháp luật nào về AI?): doc=71-2025-qh15 title=Luật Công nghiệp công nghệ số số 71/2025/QH15 article=Căn cứ/Mở đầu pinecone=0.775 content=0.272 titleScore=0.043 articleScore=0.000 final=0.271 mode=direct_selection target=NA snippet="Điều 44. Quy định dấu hiệu nhận dạng đối với hệ thống trí tuệ nhân tạo 1. Hệ thống trí tuệ nhân tạo tương tác trực tiếp với con người phải có thông báo cho người sử dụng biết việc đang tương tác với hệ thống trí tuệ nhân tạo, trừ trường hợp"; insufficient because RETRIEVAL_SEMANTIC_ONLY, COVERAGE_EXISTENCE_ONLY, FRESHNESS_ONLY
- CASE_027 Q1 (Hôm nay Chính phủ vừa ban hành quy định pháp luật nào về AI?): doc=71-2025-qh15 title=Luật Công nghiệp công nghệ số số 71/2025/QH15 article=Căn cứ/Mở đầu pinecone=0.774 content=0.302 titleScore=0.043 articleScore=0.000 final=0.290 mode=direct_selection target=NA snippet="Điều 43. Quản lý hệ thống trí tuệ nhân tạo 1. Hệ thống trí tuệ nhân tạo rủi ro cao là hệ thống trí tuệ nhân tạo trong một số trường hợp sử dụng có khả năng gây ra rủi ro, tổn hại nghiêm trọng tới sức khỏe con người, quyền con người, quyền c"; insufficient because RETRIEVAL_SEMANTIC_ONLY, COVERAGE_EXISTENCE_ONLY, FRESHNESS_ONLY
- CASE_027 Q1 (Hôm nay Chính phủ vừa ban hành quy định pháp luật nào về AI?): doc=71-2025-qh15 title=Luật Công nghiệp công nghệ số số 71/2025/QH15 article=Căn cứ/Mở đầu pinecone=0.767 content=0.196 titleScore=0.043 articleScore=0.000 final=0.206 mode=direct_selection target=NA snippet="Điều 41. Nguyên tắc phát triển, cung cấp, triển khai sử dụng trí tuệ nhân tạo 1. Nguyên tắc phát triển, cung cấp, triển khai sử dụng trí tuệ nhân tạo: a) Phục vụ sự thịnh vượng và hạnh phúc của con người, lấy con người làm trung tâm, nâng c"; insufficient because RETRIEVAL_SEMANTIC_ONLY, COVERAGE_EXISTENCE_ONLY, FRESHNESS_ONLY
- CASE_027 Q1 (Hôm nay Chính phủ vừa ban hành quy định pháp luật nào về AI?): doc=71-2025-qh15 title=Luật Công nghiệp công nghệ số số 71/2025/QH15 article=Căn cứ/Mở đầu pinecone=0.734 content=0.196 titleScore=0.043 articleScore=0.000 final=0.151 mode=direct_selection target=NA snippet="Điều 45. Trách nhiệm của các chủ thể trong hoạt động phát triển, cung cấp, triển khai sử dụng hệ thống trí tuệ nhân tạo 1. Chủ thể trong hoạt động phát triển, cung cấp, triển khai sử dụng hệ thống trí tuệ nhân tạo bao gồm: a) Chủ thể phát t"; insufficient because RETRIEVAL_SEMANTIC_ONLY, COVERAGE_EXISTENCE_ONLY, FRESHNESS_ONLY
- CASE_027 Q1 (Hôm nay Chính phủ vừa ban hành quy định pháp luật nào về AI?): doc=71-2025-qh15 title=Luật Công nghiệp công nghệ số số 71/2025/QH15 article=Căn cứ/Mở đầu pinecone=0.727 content=0.162 titleScore=0.043 articleScore=0.000 final=0.116 mode=direct_selection target=NA snippet="Điều 42. Chiến lược nghiên cứu, phát triển và ứng dụng trí tuệ nhân tạo 1. Chiến lược nghiên cứu, phát triển và ứng dụng trí tuệ nhân tạo được xây dựng trên cơ sở định hướng phát triển kinh tế - xã hội, quốc phòng, an ninh; xu thế công nghệ"; insufficient because RETRIEVAL_SEMANTIC_ONLY, COVERAGE_EXISTENCE_ONLY, FRESHNESS_ONLY
- CASE_028 Q1 (Mức lệ phí mới nhất tuần này cho thủ tục hành chính chưa có trong kho là bao nhiêu?): doc=446-qđ-bnv-2026 title=QUYẾT ĐỊNH VỀ VIỆC CÔNG BỐ TÁI CẤU TRÚC QUY TRÌNH GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH article=Điều 3 pinecone=0.695 content=0.271 titleScore=0.139 articleScore=0.000 final=0.283 mode=ambiguous_fallback target=NA snippet="đủ điều kiện kinh doanh dịch vụ lưu trữ Văn thư và Lưu trữ nhà nước Sở Nội vụ 13 1.005132 Đăng ký hợp đồng nhận lao động thực tập dưới 90 ngày Quản lý lao động ngoài nước Cơ quan chuyên môn về lao động thuộc Ủy ban nhân dân cấp tỉnh 14 1.01"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY, FRESHNESS_ONLY
- CASE_028 Q1 (Mức lệ phí mới nhất tuần này cho thủ tục hành chính chưa có trong kho là bao nhiêu?): doc=513-qđ-ttpvhcc-2026 title=Quyết định 513/QĐ-TTPVHCC về việc công bố thủ tục hành chính được sửa đổi, bổ sung và bị bãi bỏ article=Điều 4 pinecone=0.675 content=0.295 titleScore=0.139 articleScore=0.000 final=0.252 mode=ambiguous_fallback target=NA snippet="(dichvucong.gov.vn) Chưa quy định - Nghị định số 144/2020/NĐ-CP ngày 14/12/2020 của Chính phủ quy định về hoạt động nghệ thuật biểu diễn; - Nghị định số 116/2026/NĐ-CP ngày 02/4/2026 của Chính phủ sửa đổi, bổ sung một số điều của các Nghị đ"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY, FRESHNESS_ONLY
- CASE_028 Q1 (Mức lệ phí mới nhất tuần này cho thủ tục hành chính chưa có trong kho là bao nhiêu?): doc=513-qđ-ttpvhcc-2026 title=Quyết định 513/QĐ-TTPVHCC về việc công bố thủ tục hành chính được sửa đổi, bổ sung và bị bãi bỏ article=Căn cứ/Mở đầu pinecone=0.674 content=0.271 titleScore=0.139 articleScore=0.000 final=0.232 mode=ambiguous_fallback target=NA snippet="Bộ trưởng Bộ Tài chính quy định mức thu, chế độ thu, nộp phí thẩm định cấp giấy phép kinh doanh karaoke, vũ trường; - Nghị định số 116/2026/NĐ-CP ngày 02/4/2026 của Chính phủ sửa đổi, bổ sung một số điều của các Nghị định có quy định thủ tụ"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY, FRESHNESS_ONLY
- CASE_028 Q1 (Mức lệ phí mới nhất tuần này cho thủ tục hành chính chưa có trong kho là bao nhiêu?): doc=513-qđ-ttpvhcc-2026 title=Quyết định 513/QĐ-TTPVHCC về việc công bố thủ tục hành chính được sửa đổi, bổ sung và bị bãi bỏ article=Điều 4 pinecone=0.672 content=0.271 titleScore=0.139 articleScore=0.000 final=0.227 mode=ambiguous_fallback target=NA snippet="mức thu, chế độ thu, nộp phí thẩm định cấp giấy phép kinh doanh karaoke, vũ trường; - Nghị định số 116/2026/NĐ-CP ngày 02/4/2026 của Chính phủ sửa đổi, bổ sung một số điều của các Nghị định có quy định thủ tục hành chính liên quan đến hoạt "; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY, FRESHNESS_ONLY
- CASE_028 Q1 (Mức lệ phí mới nhất tuần này cho thủ tục hành chính chưa có trong kho là bao nhiêu?): doc=893-qđ-bvhttdl-2026 title=QUYẾT ĐỊNH VỀ VIỆC CÔNG BỐ THỦ TỤC HÀNH CHÍNH ĐƯỢC SỬA ĐỔI, BỔ SUNG TRONG LĨNH VỰC XUẤT BẢN, IN VÀ PHÁT HÀNH article=Điều 2 pinecone=0.662 content=0.212 titleScore=0.139 articleScore=0.000 final=0.164 mode=ambiguous_fallback target=NA snippet="Điều 2.Quyết định này có hiệu lực thi hành kể từ ngày ký đến hết ngày 28/02/2027. Các thủ tục hành chính tương ứng đã công bố tại các Quyết định số 682/QĐ-BVHTTDL ngày 14/3/2025; Quyết định số 2069/QĐ-BVHTTDL ngày 19/6/2025; Quyết định số 2"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY, FRESHNESS_ONLY
- CASE_034 Q1 (Luật Phòng chống mua bán người 53/2024/QH15 quy định quyền của nạn nhân, trách nhiệm cơ quan nhà nước và biện pháp hỗ trợ như thế nào?): doc=53-2024-qh15 title=LUẬT PHÒNG, CHỐNG MUA BÁN NGƯỜI SỐ 53/2024/QH15 article=Điều 5 pinecone=0.808 content=0.507 titleScore=0.277 articleScore=0.000 final=0.463 mode=ambiguous_fallback target=true snippet="Điều 5. Chính sách của Nhà nước về phòng, chống mua bán người 1. Phòng, chống mua bán người là nội dung của chiến lược quốc gia phòng, chống tội phạm và được kết hợp với việc thực hiện các chương trình khác về phát triển kinh tế - xã hội. 2"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_034 Q1 (Luật Phòng chống mua bán người 53/2024/QH15 quy định quyền của nạn nhân, trách nhiệm cơ quan nhà nước và biện pháp hỗ trợ như thế nào?): doc=53-2024-qh15 title=LUẬT PHÒNG, CHỐNG MUA BÁN NGƯỜI SỐ 53/2024/QH15 article=Unknown pinecone=0.794 content=0.390 titleScore=0.277 articleScore=0.000 final=0.345 mode=ambiguous_fallback target=true snippet="QUỐC HỘI CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM Độc lập – Tự do – Hạnh phúc Luật số: 53/2024/QH15 Hà Nội, Ngày 28 tháng 11 năm 2024 LUẬT PHÒNG, CHỐNG MUA BÁN NGƯỜI Căn cứ Hiến pháp nước Cộng hòa xã hội chủ nghĩa Việt Nam; Quốc hội ban hành Luật"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_034 Q1 (Luật Phòng chống mua bán người 53/2024/QH15 quy định quyền của nạn nhân, trách nhiệm cơ quan nhà nước và biện pháp hỗ trợ như thế nào?): doc=66-2011-qh12 title=Luật Phòng, chống mua bán người số 66/2011/QH12 article=Điều 6 pinecone=0.788 content=0.550 titleScore=0.163 articleScore=0.000 final=0.421 mode=ambiguous_fallback target=false snippet="Điều 6. Quyền và nghĩa vụ của nạn nhân 1. Đề nghị cơ quan, tổ chức, người có thẩm quyền áp dụng các biện pháp bảo vệ mình, người thân thích khi bị xâm hại hoặc có nguy cơ bị xâm hại về tính mạng, sức khỏe, danh dự, nhân phẩm và tài sản. 2. "; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_034 Q1 (Luật Phòng chống mua bán người 53/2024/QH15 quy định quyền của nạn nhân, trách nhiệm cơ quan nhà nước và biện pháp hỗ trợ như thế nào?): doc=53-2024-qh15 title=LUẬT PHÒNG, CHỐNG MUA BÁN NGƯỜI SỐ 53/2024/QH15 article=Điều 1 pinecone=0.781 content=0.620 titleScore=0.277 articleScore=0.000 final=0.463 mode=ambiguous_fallback target=true snippet="Điều 1. Phạm vi điều chỉnh Luật này quy định về phòng ngừa, phát hiện, xử lý hành vi mua bán người và các hành vi khác vi phạm pháp luật về phòng, chống mua bán người; tiếp nhận, xác minh, xác định, hỗ trợ, bảo vệ nạn nhân, người đang trong"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_034 Q1 (Luật Phòng chống mua bán người 53/2024/QH15 quy định quyền của nạn nhân, trách nhiệm cơ quan nhà nước và biện pháp hỗ trợ như thế nào?): doc=66-2011-qh12 title=Luật Phòng, chống mua bán người số 66/2011/QH12 article=Điều 5 pinecone=0.780 content=0.507 titleScore=0.163 articleScore=0.000 final=0.367 mode=ambiguous_fallback target=false snippet="Điều 5. Chính sách của Nhà nước về phòng, chống mua bán người 1. Phòng, chống mua bán người là nội dung của chương trình phòng, chống tội phạm, tệ nạn xã hội và được kết hợp với việc thực hiện các chương trình khác về phát triển kinh tế - x"; insufficient because RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY

### Benchmark artifacts

- CASE_013: FRESHNESS_ONLY, BENCHMARK_GOLD_MISMATCH
- CASE_017: BENCHMARK_GOLD_MISMATCH

### Ambiguous / review required

- CASE_006: AMBIGUOUS
- CASE_008: AMBIGUOUS

## 8. Grounding outcomes

### Over-trigger

- CASE_003: rag_irrelevant
- CASE_015: rag_irrelevant
- CASE_021: rag_irrelevant
- CASE_033: current_info_with_outdated_rag_issueYear_check

### Under-trigger

- CASE_006: gold expects Grounding
- CASE_007: gold expects Grounding
- CASE_008: gold expects Grounding
- CASE_010: gold expects Grounding
- CASE_017: gold expects Grounding
- CASE_018: gold expects Grounding
- CASE_020: gold expects Grounding
- CASE_034: gold expects Grounding
- CASE_035: gold expects Grounding
- CASE_040: gold expects Grounding

### Reason distribution

- Coverage: 1
- Freshness: 4
- Target mismatch: 1
- Irrelevant RAG: 7
- Empty RAG: 0
- Other: 0

## 9. Citation failures

- CASE_003: no final structured citation
- CASE_013: no final structured citation
- CASE_015: no final structured citation
- CASE_019: no final structured citation
- CASE_021: no final structured citation
- CASE_033: no final structured citation

## 10. Operational summary

- Decomposer: 7 (0.175/query)
- Embedding: 49 (1.225/query)
- Final Gemini: 29; all Gemini 0.9/query
- Grounding decisions: 11
- Actual Grounding calls: 0 (0/query)
- Tokens: {"promptTokenCount":3505,"candidatesTokenCount":864,"totalTokenCount":4369} (SDK-exposed usage only)
- Average measured latency: 3272 ms/query

## 11. Top 10 important failures

- CASE_003: grounding over-trigger: rag_irrelevant
- CASE_005: real coverage false-positive: RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_006: grounding under-trigger: 
- CASE_007: grounding under-trigger: 
- CASE_007: real coverage false-positive: DECOMPOSITION_TOO_BROAD, RETRIEVAL_SEMANTIC_ONLY, COVERAGE_EXISTENCE_ONLY
- CASE_008: grounding under-trigger: 
- CASE_009: complexity false-simple
- CASE_009: real coverage false-positive: DECOMPOSITION_TOO_BROAD, RETRIEVAL_SEMANTIC_ONLY, SELECTOR_TOO_PERMISSIVE, COVERAGE_EXISTENCE_ONLY
- CASE_010: complexity false-simple
- CASE_010: grounding under-trigger: 

## Recommended live cases

- CASE_005: rag_irrelevant
- CASE_013: current_info_with_outdated_rag_issueYear_check

Live cases are recommendations only; they were not automatically executed.
