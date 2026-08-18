# AI Chatbot Flow - LegalBot

## 1. Entry Point

- Client POSTs to `/api/ai/ask`
- Route defined in `AI_Engine/src/routes/aiRoutes.js`
- Controller handler: `AI_Engine/src/controllers/aiController.js` → `exports.ask`

## 2. Controller: `aiController.ask`

Steps:
1. Read request body: `question` or `message`
2. Validate input
3. Call `ragService.query(userQuery)` to retrieve Pinecone matches
4. Log source type
5. Call `geminiService.generateAnswerWithGemini(userQuery, relatedDocs, [], true)`
6. Return JSON response containing:
   - `success`
   - `answer`
   - `citations`
   - `sources`

## 3. RAG service: `AI_Engine/src/services/ragService.js`

Steps:
1. Initialize Gemini embedding and Pinecone index if needed
2. Embed the user query using `gemini-embedding-2` with `taskType: 'RETRIEVAL_QUERY'`
3. Reduce embedding to 768 dimensions
4. Query Pinecone index with `topK` and `includeMetadata: true`
5. Map search results into objects containing:
   - `id`
   - `title`
   - `law_name`
   - `content`
   - `dieu`
   - `source`
   - `sourceUrl`
   - `score`
6. Return list of matching documents to controller

## 4. Gemini service: `AI_Engine/src/services/geminiService.js`

Current chatbot flow uses a structured citation method:

- `generateAnswerWithGemini(userQuestion, documents, [], true)`
- Build a prompt with:
  - strict RAG boundary instructions
  - conversation history
  - RAG document context
  - required JSON output schema
- Define `responseSchema` for Gemini to produce:
  ```json
  {
    "answer": "...",
    "citations": [
      {
        "lawName": "...",
        "dieu": "...",
        "khoan": "...",
        "quoteSnippet": "...",
        "sourceUrl": "..."
      }
    ]
  }
  ```
- Call Gemini model with `responseMimeType: 'application/json'`
- Parse the JSON response and return it to controller
- If parsing fails, fallback to `{ answer, citations: [] }`

## 5. Metadata flow

- During data import in `AI_Engine/scripts/import_json_data.js`:
  - `smartChunk()` now labels non-Điều chunks as `Căn cứ/Mở đầu`
  - Pinecone metadata now includes `law_name`
- `ragService.query()` uses `metadata.law_name` or `metadata.title`
- `generateAnswerWithGemini(..., [], true)` instructs Gemini to use `lawName` from citations

## 6. Final API response

The current `/api/ai/ask` response returns:
```json
{
  "success": true,
  "answer": "...",
  "citations": [
    {
      "lawName": "...",
      "dieu": "...",
      "khoan": "...",
      "quoteSnippet": "...",
      "sourceUrl": "..."
    }
  ],
  "sources": [
    {
      "title": "...",
      "source": "...",
      "dieu": "...",
      "khoan": "..."
    }
  ]
}
```

## 7. Summary flow diagram

1. Client → `/api/ai/ask`
2. `aiController.ask`
3. `ragService.query(userQuery)`
4. Pinecone returns candidate docs
5. `geminiService.generateAnswerWithGemini(..., [], true)`
6. Gemini returns structured JSON
7. Controller formats and sends response

## 8. Key files

- `AI_Engine/src/routes/aiRoutes.js`
- `AI_Engine/src/controllers/aiController.js`
- `AI_Engine/src/services/ragService.js`
- `AI_Engine/src/services/geminiService.js`
- `AI_Engine/scripts/import_json_data.js`

## 9. Notes

- `law_name` is now stored in Pinecone metadata for citation mapping
- Chunks without explicit `Điều` are labeled as `Căn cứ/Mở đầu`
- The current AI flow is designed to return citations in structured JSON for frontend use
