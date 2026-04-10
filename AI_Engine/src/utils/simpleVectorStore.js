// AI_Engine/src/utils/simpleVectorStore.js

// Tính độ tương đồng Cosine (Cosine Similarity)
function cosineSimilarity(a, b) {
    let dot = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

class HierarchicalNSW {
    constructor(space, numDimensions) {
        this.space = space;
        this.numDimensions = numDimensions;
        this.vectors = {}; // Lưu trữ vector: index -> vector array
    }

    initIndex(maxElements) {
        // Khởi tạo index (với bản simple này thì không cần làm gì phức tạp)
        this.vectors = {};
    }

    addPoint(vector, index) {
        this.vectors[index] = vector;
    }

    // Tìm kiếm K vector giống nhất
    searchKnn(queryVector, k) {
        const results = [];

        // Duyệt qua tất cả vector để tính điểm (Brute-force search)
        // Với dữ liệu nhỏ (<100k) thì cách này vẫn rất nhanh và chính xác
        for (const [index, vector] of Object.entries(this.vectors)) {
            const score = cosineSimilarity(queryVector, vector);
            results.push({ id: parseInt(index), score });
        }

        // Sắp xếp giảm dần theo điểm số
        results.sort((a, b) => b.score - a.score);

        // Trả về danh sách index của k kết quả tốt nhất
        return {
            neighbors: results.slice(0, k).map(r => r.id),
            distances: results.slice(0, k).map(r => r.score)
        };
    }

    // Xuất dữ liệu để lưu vào file JSON
    toJSON() {
        return { vectors: this.vectors };
    }

    // Nạp dữ liệu từ file JSON
    fromJSON(json) {
        if (json && json.vectors) {
            this.vectors = json.vectors;
        }
    }
}

module.exports = { HierarchicalNSW };