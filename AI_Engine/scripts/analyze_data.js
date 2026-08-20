const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../clean_data.json'), 'utf8'));

console.log('\n=== PHAN TICH DU LIEU clean_data.json ===\n');

let totalDocs = data.length;
let totalChars = 0;
let contentStats = {
  minLen: Infinity,
  maxLen: 0,
  avgLen: 0
};

data.forEach((doc) => {
  const content = doc.Content || doc.content || '';
  const len = content.length;
  totalChars += len;
  contentStats.minLen = Math.min(contentStats.minLen, len);
  contentStats.maxLen = Math.max(contentStats.maxLen, len);
});

contentStats.avgLen = totalChars / totalDocs;

console.log('THONG KE CO BAN:');
console.log('- Tong so documents: ' + totalDocs);
console.log('- Tong ky tu: ' + totalChars.toLocaleString('vi-VN'));
console.log('- Do dai min: ' + contentStats.minLen + ' ky tu');
console.log('- Do dai max: ' + contentStats.maxLen.toLocaleString('vi-VN') + ' ky tu');
console.log('- Do dai trung binh: ' + Math.round(contentStats.avgLen).toLocaleString('vi-VN') + ' ky tu\n');

// Token estimation: Vietnamese ~2.5 chars/token
const CHARS_PER_TOKEN = 2.5;
const avgTokensPerDoc = Math.round(contentStats.avgLen / CHARS_PER_TOKEN);

console.log('TINH TOAN TOKEN (tieng Viet: ~2.5 ky tu/token):');
console.log('- Token trung binh/document: ' + avgTokensPerDoc + ' tokens');
console.log('- Tong token: ' + Math.round(totalChars / CHARS_PER_TOKEN).toLocaleString('vi-VN') + ' tokens\n');

console.log('PHAN TICH CODE HIEN TAI (BATCH_SIZE = 5):');
const estimatedTokensPerBatch = avgTokensPerDoc * 5;
console.log('- Token/batch: ' + estimatedTokensPerBatch + ' tokens');
console.log('- Delays: 15s giua batches');
console.log('- Batches/phut: ' + Math.floor(60 / 15));
console.log('- TPM tieu thu: ' + (Math.floor(60 / 15) * estimatedTokensPerBatch) + ' tokens');
console.log('- Gioi han TPM: 30,000 tokens/phut');
const riskLevel = (Math.floor(60 / 15) * estimatedTokensPerBatch) / 30000 * 100;
console.log('- RUI RO: ' + riskLevel.toFixed(1) + '% cua gioi han\n');

// Calculate smartChunk stats
console.log('SMARTCHUNK ANALYSIS:');
let totalChunks = 0;
let chunkLengths = [];

data.forEach((law) => {
  const content = law.Content || law.content || '';
  const regex = /(?=\n\s*Dieu\s+\d+[a-zA-ZdD]*[\.:\s])/g;
  const parts = content.split(regex);

  parts.forEach(part => {
    const trim = part.trim();
    if (trim.length > 0) {
      if (trim.length > 2500) {
        const subChunks = trim.match(/[\s\S]{1,1500}(?!\S)/g) || [trim];
        subChunks.forEach(sub => {
          chunkLengths.push(sub.trim().length);
          totalChunks++;
        });
      } else {
        chunkLengths.push(trim.length);
        totalChunks++;
      }
    }
  });
});

const avgChunkLen = chunkLengths.reduce((a, b) => a + b, 0) / chunkLengths.length;
const avgTokensPerChunk = Math.round(avgChunkLen / CHARS_PER_TOKEN);

console.log('- Tong chunks (tu smartChunk): ' + totalChunks);
console.log('- Do dai trung binh chunk: ' + Math.round(avgChunkLen) + ' ky tu');
console.log('- Token trung binh/chunk: ' + avgTokensPerChunk + ' tokens');
console.log('- Token cua 5 chunks: ' + (avgTokensPerChunk * 5) + ' tokens\n');

console.log('=== IMPACT ANALYSIS: BATCH_SIZE = 5 ===');
const tokensPerMinAvg = (Math.floor(60 / 15)) * (avgTokensPerChunk * 5);
console.log('- Theo current code: ' + tokensPerMinAvg + ' TPM');
console.log('- Gioi han: 30,000 TPM');
console.log('- Trang thai: ' + (tokensPerMinAvg > 30000 ? '[ERROR] VUOT GIOI HAN!' : 'OK (nhung con co risk)'));
console.log('- Tong thoi gian du kien (neu 1 doc = 10 chunks): ' + (Math.ceil(totalDocs / 1) * 60) + ' giay (khong tinh delay)\n');

console.log('=== DE XUAT DYNAMIC BATCHING ===');
const MAX_TOKENS_PER_BATCH = 15000;
const MAX_TOKENS_PER_MINUTE = 25000;
const optimalBatchSize = Math.floor(MAX_TOKENS_PER_BATCH / avgTokensPerChunk);

console.log('- Max tokens/batch (de an toan): ' + MAX_TOKENS_PER_BATCH + ' tokens');
console.log('- Optimal batch size: ' + optimalBatchSize + ' chunks');
console.log('- Dieu chinh delay de dung ~' + MAX_TOKENS_PER_MINUTE + ' TPM');
