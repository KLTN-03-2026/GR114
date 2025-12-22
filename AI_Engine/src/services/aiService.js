const ragService = require('./ragService');
const ollamaService = require('./ollamaService');

/**
 * Khởi tạo các service cần thiết
 * @returns {Promise<void>}
 */
const initialize = async () => {
    try {
        console.log('Khởi tạo AI Service...');

        // Kiểm tra kết nối Ollama
        const isOllamaConnected = await ollamaService.checkConnection();
        if (!isOllamaConnected) {
            console.error('Không thể kết nối đến Ollama. Vui lòng kiểm tra xem Ollama đã được khởi động chưa?');
        } else {
            console.log('Kết nối Ollama thành công');
        }

        // Tải dữ liệu pháp luật
        await ragService.loadLegalData();

        // Khởi tạo vector store (có thể mất nhiều thời gian)
        console.log('Bắt đầu khởi tạo vector store (quá trình này có thể mất vài phút)...');
        await ragService.createVectorStore();

        console.log('Khởi tạo AI Service thành công');
    } catch (error) {
        console.error('Lỗi khi khởi tạo AI Service:', error);
        throw error;
    }
};

/**
 * Trả lời câu hỏi pháp lý dựa trên RAG
 * @param {string} question - Câu hỏi của người dùng
 * @param {Object} options - Các tùy chọn (temperature, top_k, ...)
 * @returns {Promise<Object>} - Kết quả trả về bao gồm câu trả lời và tài liệu liên quan
 */
const answerLegalQuestion = async (question, options = {}) => {
    try {
        // Kiểm tra nếu câu hỏi chứa số hiệu văn bản pháp luật hoặc từ khóa về loại văn bản và năm
        const docNumberRegex = /(\d+)\/([A-Za-z0-9\-]+)/i;
        const docTypeYearRegex = /(luật|nghị định|thông tư|quyết định|nghị quyết|công văn|thông báo|chỉ thị|công điện).*?(20\d{2})/i;
        const yearDocTypeRegex = /(20\d{2}).*?(luật|nghị định|thông tư|quyết định|nghị quyết|công văn|thông báo|chỉ thị|công điện)/i;

        // Nếu câu hỏi có dạng tìm kiếm văn bản pháp luật
        if (docNumberRegex.test(question) ||
            docTypeYearRegex.test(question) ||
            yearDocTypeRegex.test(question) ||
            question.toLowerCase().includes('văn bản') ||
            question.toLowerCase().includes('tìm')) {

            console.log('Phát hiện câu hỏi tìm kiếm văn bản pháp luật, sử dụng phương thức truy xuất...');

            try {
                // Sử dụng phương thức mới để truy xuất văn bản pháp luật
                const legalDocuments = await ragService.getLegalDocumentsForQuery(question);

                if (legalDocuments.success && legalDocuments.data && legalDocuments.data.length > 0) {
                    // Tạo câu trả lời từ dữ liệu văn bản pháp luật
                    const documentsInfo = legalDocuments.data.map((doc, index) => {
                        const docNumber = doc.documentNumber ? ` - Số: ${doc.documentNumber}` : '';
                        // Tạo đường dẫn đến trang chi tiết văn bản trong web
                        const localUrl = `http://localhost:3000/legal/documents/${doc.id}`;
                        return `${index + 1}. **${doc.title}** (${doc.documentType}${docNumber}) - Ban hành ngày: ${formatDate(doc.issuedDate)}\n   **[👉 XEM CHI TIẾT](${localUrl})**`;
                    }).join('\n\n');

                    return {
                        answer: `Tôi đã tìm thấy các văn bản pháp luật sau đây phù hợp với yêu cầu của bạn:\n\n${documentsInfo}\n\nBạn có thể nhấp vào link "XEM CHI TIẾT" để xem nội dung đầy đủ của văn bản.`,
                        documents: legalDocuments.data
                    };
                } else {
                    // Không tìm thấy văn bản nào phù hợp
                    return {
                        answer: `Tôi không tìm thấy văn bản pháp luật nào phù hợp với yêu cầu "${question}" của bạn. Vui lòng thử lại với từ khóa khác hoặc cung cấp thêm thông tin chi tiết.`,
                        documents: []
                    };
                }
            } catch (error) {
                console.error('Lỗi khi truy xuất văn bản pháp luật:', error);
                return {
                    answer: 'Đã xảy ra lỗi khi tìm kiếm văn bản pháp luật. Vui lòng thử lại sau.',
                    documents: []
                };
            }
        }

        // Kiểm tra câu hỏi về danh tính (ai là ai)
        if (/bạn là ai|bạn tên gì|bạn là gì|cho mình biết về bạn|giới thiệu về bạn/i.test(question)) {
            return {
                answer: "Tôi là LegAI - trợ lý AI pháp luật của nền tảng LegAI, được phát triển để tư vấn và hỗ trợ về các vấn đề pháp lý tại Việt Nam. Tôi có thể giúp bạn tìm hiểu thông tin pháp luật, soạn thảo văn bản pháp lý cơ bản, và kết nối với luật sư chuyên nghiệp khi cần. Bạn cần hỗ trợ về vấn đề pháp lý nào?",
                sources: []
            };
        }

        // Kiểm tra câu chào
        if (/xin chào|chào bạn|hello|hi|hey|good morning|good afternoon|good evening/i.test(question)) {
            return {
                answer: "Chào bạn! Tôi là LegAI - trợ lý AI pháp luật của LegAI, nền tảng tư vấn pháp luật trực tuyến hàng đầu Việt Nam. Tôi có thể giúp bạn giải đáp các thắc mắc về pháp luật Việt Nam, hỗ trợ soạn thảo văn bản pháp lý, và kết nối với luật sư chuyên nghiệp. Bạn cần tư vấn về vấn đề pháp lý nào?",
                sources: []
            };
        }

        // Đảm bảo câu hỏi không rỗng
        if (!question || question.trim() === '') {
            return {
                answer: 'Câu hỏi không được để trống. Vui lòng đặt câu hỏi cụ thể về pháp luật.',
                documents: []
            };
        }

        // Xử lý các câu hỏi về tư vấn pháp lý
        const legalAdviceQuestions = [
            /tư\s*vấn\s*pháp\s*l(ý|uật)/i,
            /tư\s*vấn\s*luật/i,
            /(tư\s*vấn|hướng\s*dẫn)\s*(về)?\s*(vấn\s*đề)?\s*pháp\s*l(ý|uật)/i,
            /dịch\s*vụ\s*tư\s*vấn\s*pháp\s*l(ý|uật)/i,
            /tư\s*vấn\s*(về)?\s*(vấn\s*đề)?\s*pháp\s*l(ý|uật)/i
        ];

        // Nếu là câu hỏi về tư vấn pháp lý
        if (legalAdviceQuestions.some(pattern => pattern.test(question.trim()))) {
            return {
                answer: "Tôi là LegAI - trợ lý AI pháp luật của nền tảng LegAI, có thể tư vấn cho bạn về các vấn đề pháp lý sau:\n\n1. **Tư vấn pháp luật dân sự**: Hợp đồng, quyền sở hữu tài sản, thừa kế, bồi thường thiệt hại...\n\n2. **Tư vấn pháp luật hôn nhân gia đình**: Đăng ký kết hôn, ly hôn, quyền nuôi con, cấp dưỡng, chia tài sản chung...\n\n3. **Tư vấn pháp luật doanh nghiệp**: Thành lập doanh nghiệp, quản trị công ty, giải thể, phá sản...\n\n4. **Tư vấn pháp luật lao động**: Hợp đồng lao động, bảo hiểm xã hội, tranh chấp lao động...\n\n5. **Tư vấn pháp luật đất đai**: Quyền sử dụng đất, thủ tục chuyển nhượng, tranh chấp đất đai...\n\nNgoài ra, LegAI còn cung cấp các dịch vụ:\n- Kết nối với luật sư chuyên nghiệp\n- Soạn thảo và quản lý hợp đồng, văn bản pháp lý\n- Tra cứu văn bản pháp luật\n- Hỗ trợ giải quyết các vấn đề pháp lý\n\nTôi cung cấp thông tin pháp luật chung, giải thích các quy định pháp luật, và hướng dẫn các thủ tục pháp lý. Xin lưu ý rằng thông tin này mang tính tham khảo và không thay thế cho tư vấn chính thức từ luật sư. Với các vấn đề phức tạp hoặc cần đại diện pháp lý, bạn nên tham khảo ý kiến luật sư qua tính năng kết nối luật sư của LegAI.\n\nBạn cần tư vấn về vấn đề pháp lý cụ thể nào?",
                documents: []
            };
        }

        // Xử lý các câu hỏi chung về luật
        const genericLegalQuestions = [
            /^(về)?\s*luật\s*$/i,
            /^(về)?\s*pháp\s*luật\s*$/i,
            /^(về)?\s*luật\s*(pháp)?\s*$/i,
            /^luật\s*mà$/i,
            /^pháp\s*luật\s*mà$/i,
            /hỏi\s*(về)?\s*luật/i,
            /nói\s*(về)?\s*luật/i,
            /thế\s*(hỏi|nói)\s*(về)?\s*luật/i,
            /luật\s*(là\s*(gì|sao))?$/i,
            /pháp\s*luật\s*(là\s*(gì|sao))?$/i
        ];

        // Nếu là câu hỏi chung về luật
        if (genericLegalQuestions.some(pattern => pattern.test(question.trim()))) {
            return {
                answer: "Tôi là LegAI - trợ lý AI pháp luật và có thể tư vấn về nhiều lĩnh vực pháp luật Việt Nam. Hiện tại tôi có thông tin về:\n\n1. Luật Hôn nhân và Gia đình 2014 (điều kiện kết hôn, thủ tục đăng ký kết hôn, ly hôn)\n2. Luật Doanh nghiệp 2020 (thành lập, tổ chức quản lý doanh nghiệp)\n3. Bộ luật Dân sự 2015 (quyền sở hữu, thừa kế, hợp đồng)\n4. Các quy định về lao động theo Bộ luật Lao động 2019\n5. Thủ tục đăng ký kinh doanh\n6. Thủ tục khởi kiện dân sự\n\nNền tảng LegAI cung cấp nhiều dịch vụ bao gồm tư vấn pháp luật trực tuyến, kết nối luật sư chuyên nghiệp, soạn thảo và quản lý hợp đồng, tra cứu văn bản pháp luật, và hỗ trợ giải quyết các vấn đề pháp lý.\n\nBạn quan tâm đến lĩnh vực nào? Hoặc bạn có thể hỏi cụ thể về vấn đề pháp lý bạn đang gặp phải.",
                documents: []
            };
        }

        // Kiểm tra câu hỏi mở đầu hoặc yêu cầu hỏi
        const promptingQuestions = [
            /^thế\s*(hỏi|nói)\s*(gì|j)\s*(đi|đây|nào)/i,
            /^(hỏi|nói)\s*(gì|j)\s*(đi|đây|nào)/i,
            /^(hỏi|nói)\s*(cái\s*gì|cái\s*j)\s*(đi|đây|nào)/i,
            /^(giới\s*thiệu|kể)\s*(gì|j)\s*(đi|đây|nào)/i,
            /muốn\s*biết\s*(gì|j)/i,
            /biết\s*(gì|j)/i
        ];

        // Nếu là câu hỏi mở đầu hoặc yêu cầu hỏi
        if (promptingQuestions.some(pattern => pattern.test(question.trim()))) {
            return {
                answer: "Tôi là LegAI - trợ lý AI pháp luật của nền tảng tư vấn pháp luật trực tuyến LegAI. Tôi có thể giúp bạn giải đáp các thắc mắc về pháp luật Việt Nam như Luật Hôn nhân và Gia đình, Luật Doanh nghiệp, Bộ luật Dân sự, và nhiều lĩnh vực khác. \n\nLegAI cung cấp nhiều dịch vụ hữu ích như:\n1. Tư vấn pháp luật trực tuyến\n2. Kết nối với luật sư chuyên nghiệp\n3. Soạn thảo và quản lý hợp đồng, văn bản pháp lý\n4. Tra cứu văn bản pháp luật\n5. Hỗ trợ giải quyết các vấn đề pháp lý\n\nBạn có thể hỏi tôi về các vấn đề như đăng ký kết hôn, thành lập doanh nghiệp, quyền thừa kế, hợp đồng, quan hệ lao động, hoặc các thủ tục pháp lý. Bạn cần tư vấn về vấn đề nào?",
                documents: []
            };
        }

        // Kiểm tra câu hỏi về tên luật sư cụ thể
        const specificLawyerQuestions = [
            /biết\s*(luật\s*sư|ls)\s*nào/i,
            /tên\s*(luật\s*sư|ls)/i,
            /(luật\s*sư|ls)\s*[oơở]\s*đây/i,
            /(luật\s*sư|ls)\s*nào\s*(giỏi|tốt)/i,
            /^(luật\s*sư|ls)\s*ở\s*/i,
            /giới\s*thiệu\s*(luật\s*sư|ls)/i,
            /có\s*(luật\s*sư|ls)\s*không/i
        ];

        // Nếu là câu hỏi về tên luật sư cụ thể
        if (specificLawyerQuestions.some(pattern => pattern.test(question.trim()))) {
            return {
                answer: "Tôi là LegAI - trợ lý AI pháp luật của nền tảng LegAI và không phải là luật sư. Thay vì đề xuất một luật sư cụ thể, LegAI cung cấp tính năng kết nối với đội ngũ luật sư chuyên nghiệp đa lĩnh vực. Bạn có thể dễ dàng tìm kiếm và kết nối với luật sư phù hợp với vấn đề của mình thông qua thanh công cụ của nền tảng LegAI.\n\nTôi có thể giúp giải đáp các câu hỏi chung về pháp luật, hỗ trợ soạn thảo văn bản pháp lý, và cung cấp hướng dẫn ban đầu cho vấn đề của bạn. Sau đó, nếu cần tư vấn chuyên sâu, bạn có thể dễ dàng kết nối với luật sư chuyên môn thông qua nền tảng của chúng tôi.",
                documents: []
            };
        }

        // Kiểm tra câu hỏi về thông tin chung về luật sư
        const generalLawyerQuestions = [
            /luật\s*sư/i,
            /^(về)?\s*nghề\s*luật\s*$/i,
            /^(về)?\s*nghề\s*luật\s*sư\s*$/i
        ];

        // Nếu là câu hỏi về thông tin chung về luật sư
        if (generalLawyerQuestions.some(pattern => pattern.test(question.trim())) &&
            !specificLawyerQuestions.some(pattern => pattern.test(question.trim()))) {
            return {
                answer: "Luật sư là người hành nghề luật, được đào tạo chuyên môn về pháp luật và được cấp phép hành nghề. Tại Việt Nam, để trở thành luật sư, một người phải có bằng cử nhân luật, hoàn thành khóa đào tạo nghề luật sư, tham gia kỳ thi cấp chứng chỉ hành nghề luật sư và được cấp thẻ luật sư.\n\nLuật sư có thể tư vấn pháp luật, soạn thảo hợp đồng, đại diện cho khách hàng trong các vụ việc dân sự, hình sự, hành chính và các lĩnh vực pháp lý khác.\n\nNền tảng LegAI cung cấp dịch vụ kết nối với đội ngũ luật sư chuyên nghiệp từ nhiều lĩnh vực khác nhau, giúp bạn dễ dàng tìm được luật sư phù hợp với vấn đề của mình. Để kết nối với luật sư, bạn có thể sử dụng tính năng kết nối luật sư trên nền tảng LegAI.\n\nTôi là LegAI - trợ lý AI pháp luật, thông tin tôi cung cấp chỉ mang tính tham khảo, không thay thế cho tư vấn pháp lý chuyên nghiệp từ một luật sư được cấp phép.",
                documents: []
            };
        }

        // Kiểm tra xem câu hỏi có yêu cầu về văn bản pháp luật không
        const legalDocumentKeywords = /văn\s*bản|luật\s*mới|nghị\s*định\s*mới|thông\s*tư\s*mới|quyết\s*định\s*mới|văn\s*bản\s*pháp\s*luật|văn\s*bản\s*mới\s*nhất/i;

        if (docNumberRegex.test(question) || legalDocumentKeywords.test(question)) {
            console.log('Câu hỏi liên quan đến văn bản pháp luật, sử dụng phương thức mới để truy xuất...');

            try {
                // Sử dụng phương thức mới để truy xuất văn bản pháp luật
                const legalDocuments = await ragService.getLegalDocumentsForQuery(question);

                if (legalDocuments.success && legalDocuments.data && legalDocuments.data.length > 0) {
                    // Tạo câu trả lời từ dữ liệu văn bản pháp luật
                    const documentsInfo = legalDocuments.data.map((doc, index) => {
                        const docNumber = doc.documentNumber ? ` - Số: ${doc.documentNumber}` : '';
                        // Tạo đường dẫn đến trang chi tiết văn bản trong web
                        const localUrl = `http://localhost:3000/legal/documents/${doc.id}`;
                        return `${index + 1}. **${doc.title}** (${doc.documentType}${docNumber}) - Ban hành ngày: ${formatDate(doc.issuedDate)}\n   **[👉 XEM CHI TIẾT](${localUrl})**`;
                    }).join('\n\n');

                    return {
                        answer: `Tôi đã tìm thấy các văn bản pháp luật sau đây phù hợp với yêu cầu của bạn:\n\n${documentsInfo}\n\nBạn có thể nhấp vào link "XEM CHI TIẾT" để xem nội dung đầy đủ của văn bản.`,
                        documents: legalDocuments.data
                    };
                } else {
                    // Nếu không tìm thấy văn bản nào, thông báo cho người dùng
                    return {
                        answer: `Tôi không tìm thấy văn bản pháp luật nào phù hợp với yêu cầu "${question}" của bạn. Vui lòng thử lại với từ khóa khác hoặc cung cấp thêm thông tin chi tiết.`,
                        documents: []
                    };
                }
            } catch (error) {
                console.error('Lỗi khi truy xuất văn bản pháp luật:', error);
                return {
                    answer: 'Đã xảy ra lỗi khi tìm kiếm văn bản pháp luật. Vui lòng thử lại sau.',
                    documents: []
                };
            }
        }

        // Kiểm tra xem nội dung có liên quan đến pháp luật không
        const legalKeywords = /lu[aậ]t|ph[aá]p|[dđ][iị]nh|[dđ][iê]̀u|kho[aả]n|ngh[iị]\s*[dđ][iị]nh|quy[eêề]n|ngh[iĩ]a\s*v[uụ]|h[iì]nh\s*s[uự]|d[aâ]n\s*s[uự]|h[aà]nh\s*ch[íi]nh|t[oố]\s*t[uụ]ng|th[uưủ]\s*t[uụ]c|doanh\s*nghi[eệ]p|kinh\s*doanh|lao\s*[dđ][oộ]ng|h[oô]n\s*nh[aâ]n|gia\s*[dđ][iì]nh|k[eế]t\s*h[oô]n|ly\s*h[oô]n|th[uừ]a\s*k[eế]|di\s*ch[uú]c|ch[uứ]ng\s*kho[áa]n/i;

        // Truy vấn các tài liệu liên quan nếu câu hỏi liên quan đến pháp luật hoặc đủ dài
        if (legalKeywords.test(question) || question.length > 80) {
            console.log('Tìm kiếm tài liệu liên quan...');
            let relevantDocs = [];

            try {
                relevantDocs = await ragService.query(question, options.topK || 5);
            } catch (error) {
                console.error('Lỗi khi tìm kiếm tài liệu:', error);
                return {
                    answer: 'Đã xảy ra lỗi khi tìm kiếm tài liệu pháp luật. Vui lòng thử lại sau hoặc liên hệ quản trị viên.',
                    documents: []
                };
            }

            if (relevantDocs && relevantDocs.length > 0) {
                console.log(`Tìm thấy ${relevantDocs.length} tài liệu liên quan`);

                // Lấy câu trả lời từ LLM dựa trên tài liệu tìm được
                console.log('Tạo câu trả lời từ LLM...');
                let answer;

                try {
                    answer = await ollamaService.generateResponse(question, relevantDocs, options);
                } catch (error) {
                    console.error('Lỗi khi tạo câu trả lời:', error);
                    return {
                        answer: 'Đang gặp sự cố khi kết nối với dịch vụ trợ lý ảo. Vui lòng thử lại sau.',
                        documents: []
                    };
                }

                // Chuẩn bị thông tin về tài liệu để trả về (không bao gồm nội dung đầy đủ)
                const documentInfo = relevantDocs.map(doc => ({
                    id: doc.id,
                    type: doc.type,
                    title: doc.title,
                    originalId: doc.originalId
                }));

                return {
                    answer,
                    documents: documentInfo
                };
            }
        }

        // Nếu không tìm thấy tài liệu liên quan hoặc câu hỏi không liên quan đến pháp luật
        // Sử dụng ollamaService để tạo câu trả lời tự nhiên
        try {
            const answer = await ollamaService.generateResponse(question, [], {
                ...options,
                conversational: true // Đánh dấu đây là cuộc trò chuyện thông thường
            });

            return {
                answer,
                documents: []
            };
        } catch (error) {
            console.error('Lỗi khi tạo câu trả lời:', error);
            return {
                answer: 'Đang gặp sự cố khi kết nối với dịch vụ trợ lý ảo. Vui lòng thử lại sau.',
                documents: []
            };
        }
    } catch (error) {
        console.error('Lỗi khi xử lý câu hỏi:', error);
        return {
            answer: 'Đã xảy ra lỗi khi xử lý câu hỏi. Vui lòng thử lại sau.',
            documents: []
        };
    }
};

/**
 * Định dạng ngày tháng
 * @param {string} dateString - Chuỗi ngày tháng
 * @returns {string} - Chuỗi ngày tháng đã định dạng
 */
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

/**
 * Khởi động lại vector store (sử dụng khi cập nhật dữ liệu)
 * @returns {Promise<void>}
 */
const reloadVectorStore = async () => {
    try {
        console.log('Bắt đầu tải lại vector store...');

        // Reset biến lưu trữ trong ragService
        await ragService.createVectorStore();

        console.log('Đã tải lại vector store thành công');
    } catch (error) {
        console.error('Lỗi khi tải lại vector store:', error);
        throw error;
    }
};

module.exports = {
    initialize,
    answerLegalQuestion,
    reloadVectorStore
}; 