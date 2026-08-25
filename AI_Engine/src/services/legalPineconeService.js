const { Pinecone } = require('@pinecone-database/pinecone');
const SystemConfig = require('../config/SystemConfig');

const DEFAULT_LEGAL_PINECONE_INDEX = 'legai-index-v3';

let cachedClient;
let cachedIndex;
let cachedApiKey = '';
let cachedIndexName = '';

function resolveLegalPineconeIndexName(config = SystemConfig, env = process.env) {
    return config?.pineconeIndex || env.PINECONE_INDEX_NAME || env.PINECONE_INDEX || DEFAULT_LEGAL_PINECONE_INDEX;
}

function resolveLegalPineconeApiKey(config = SystemConfig, env = process.env) {
    return config?.pineconeApiKey || env.PINECONE_API_KEY || '';
}

function getLegalPineconeIndex(options = {}) {
    const config = options.config || SystemConfig;
    const env = options.env || process.env;
    const PineconeClass = options.PineconeClass || Pinecone;
    const apiKey = resolveLegalPineconeApiKey(config, env);
    const indexName = resolveLegalPineconeIndexName(config, env);

    if (!apiKey) throw new Error('Missing canonical Pinecone API key.');

    if (!cachedClient || cachedApiKey !== apiKey || cachedIndexName !== indexName) {
        cachedClient = new PineconeClass({ apiKey });
        cachedIndex = cachedClient.index(indexName);
        cachedApiKey = apiKey;
        cachedIndexName = indexName;
    }

    return cachedIndex;
}

function resetLegalPineconeCacheForTests() {
    cachedClient = undefined;
    cachedIndex = undefined;
    cachedApiKey = '';
    cachedIndexName = '';
}

module.exports = {
    DEFAULT_LEGAL_PINECONE_INDEX,
    resolveLegalPineconeIndexName,
    resolveLegalPineconeApiKey,
    getLegalPineconeIndex,
    resetLegalPineconeCacheForTests
};
