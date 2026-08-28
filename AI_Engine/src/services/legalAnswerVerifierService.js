const { GoogleGenerativeAI } = require('@google/generative-ai');
const SystemConfig = require('../config/SystemConfig');
const { inferDocumentRegime } = require('./legalEvidenceEligibilityService');
const { recordCostUsage } = require('../utils/costUsageTelemetry');

const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const VERDICTS = new Set(['PASS', 'WARN', 'FAIL']);
const CONFIDENCES = new Set(['HIGH', 'MEDIUM', 'LOW']);
const OUTPUT_SCHEMA = {
    type: 'OBJECT',
    properties: {
        verdict: { type: 'STRING', enum: [...VERDICTS] },
        confidence: { type: 'STRING', enum: [...CONFIDENCES] },
        failedIssueIds: { type: 'ARRAY', items: { type: 'STRING' } },
        unsupportedClaims: { type: 'ARRAY', items: { type: 'STRING' } },
        wrongRegimeClaims: { type: 'ARRAY', items: { type: 'STRING' } },
        factUncertainties: { type: 'ARRAY', items: { type: 'STRING' } },
        repairInstructions: { type: 'ARRAY', items: { type: 'STRING' } }
    },
    required: ['verdict', 'confidence', 'failedIssueIds', 'unsupportedClaims', 'wrongRegimeClaims', 'factUncertainties', 'repairInstructions']
};

function assessLegalAnswerRisk({ userQuestion = '', expectedIssues = [], documents = [], citations = [], grounded = false, integrity = null } = {}) {
    const regimes = new Set(documents.map(document => inferDocumentRegime(document).regime).filter(regime => regime !== 'UNKNOWN'));
    const riskyDomain = /hình sự|khởi tố|đất đai|thừa kế|hợp đồng|lao động|tranh chấp/iu.test(userQuestion);
    const reasons = [];
    if (expectedIssues.length > 1) reasons.push('complex_query');
    if (regimes.size > 1) reasons.push('multiple_regimes');
    if (riskyDomain) reasons.push('high_risk_domain');
    if (grounded) reasons.push('grounding_used');
    if (citations.length > 1) reasons.push('multiple_substantive_citations');
    if (integrity && integrity.valid === false) reasons.push('integrity_warning');
    return { shouldVerify: reasons.length > 0, reasons, regimes: [...regimes] };
}

function compactEvidence(documents = []) {
    return documents.map((document, index) => ({
        evidenceId: String(document.id || document.vector_id || document.chunk_id || document.doc_id || `E${index + 1}`),
        law: document.title || document.law_name || document.doc_id || '',
        article: document.dieu || document.article || document.article_number || '',
        supportedIssueIds: document.supportedIssueIds || [],
        authorityRoles: document.authorityRoles || {},
        regime: inferDocumentRegime(document).regime,
        sourceUrlPresent: Boolean(document.sourceUrl || document.source || document.protected_url),
        excerpt: String(document.content || document.text || '').slice(0, 1200)
    }));
}

function buildIssueEvidenceMapping({ expectedIssues = [], normalizedDraft = {}, documents = [] } = {}) {
    const analysis = normalizedDraft.structuredAnswer?.analysis || [];
    return expectedIssues.map(issue => ({
        issueId: issue.id,
        claim: analysis.find(item => item.issueId === issue.id)?.content || '',
        evidence: compactEvidence(documents).filter(document => document.supportedIssueIds.includes(issue.id))
            .map(document => ({
                evidenceId: document.evidenceId,
                authorityRole: document.authorityRoles[issue.id] || 'UNMAPPED',
                law: document.law,
                article: document.article,
                sourceUrlPresent: document.sourceUrlPresent,
                regime: document.regime,
                excerpt: document.excerpt
            }))
    }));
}

function parseVerifierResult(raw) {
    const text = typeof raw === 'string' ? raw : raw?.response?.text?.();
    const value = JSON.parse(String(text || '').trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
    if (!VERDICTS.has(value?.verdict) || !CONFIDENCES.has(value?.confidence)) throw new Error('Invalid verifier verdict or confidence');
    for (const field of ['failedIssueIds', 'unsupportedClaims', 'wrongRegimeClaims', 'factUncertainties', 'repairInstructions']) {
        if (!Array.isArray(value[field]) || value[field].some(item => typeof item !== 'string')) throw new Error(`Invalid verifier field: ${field}`);
    }
    return value;
}

function buildVerifierPrompt({ userQuestion, expectedIssues, draft, documents, normalizedDraft }) {
    return `You are a bounded legal consistency verifier. Judge ONLY whether the draft is supported by VERIFIED_EVIDENCE_MAPPING below. Do not use legal memory. PASS is forbidden if any core claim exceeds its evidence, any citation/article is invalid, any REJECTED evidence is relied upon, or any issue lacks correct-regime PRIMARY authority. Missing facts produce WARN only when the legal basis is supported. Wrong regime, unsupported core claims, contradictions, or missing substantive issues produce FAIL. Return only strict JSON matching the requested schema.\n\nQUESTION:\n${userQuestion}\n\nISSUES:\n${JSON.stringify(expectedIssues)}\n\nDRAFT:\n${draft}\n\nVERIFIED_EVIDENCE_MAPPING:\n${JSON.stringify(buildIssueEvidenceMapping({ expectedIssues, normalizedDraft, documents }))}`;
}

async function generateVerifier(modelName, prompt, options = {}) {
    if (options.generate) return options.generate(modelName, prompt, { search: false, grounding: false, tools: [] });
    const apiKey = process.env.GEMINI_API_KEY || SystemConfig?.geminiApiKey;
    if (!apiKey) throw new Error('Gemini API key is not configured for legal verifier');
    const genAI = options.genAI || new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    return model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, topP: 0.1, maxOutputTokens: 900, responseMimeType: 'application/json', responseSchema: OUTPUT_SCHEMA }
    });
}

async function verifyLegalDraft(input, options = {}) {
    const latency = options.latency;
    const started = latency?.now?.() ?? Date.now();
    latency?.increment('verifierCalls');
    const prompt = buildVerifierPrompt(input);
    let primaryError;
    let attemptStarted = latency?.now?.() ?? Date.now();
    try {
        const raw = await generateVerifier(PRIMARY_MODEL, prompt, options);
        const result = parseVerifierResult(raw);
        recordCostUsage(latency, { stage: 'verifier', model: PRIMARY_MODEL, response: raw, latencyMs: (latency?.now?.() ?? Date.now()) - attemptStarted, success: true, grounded: false });
        latency?.add('verifierMs', (latency?.now?.() ?? Date.now()) - started);
        latency?.detail({ type: 'legalVerifier', verdict: result.verdict, confidence: result.confidence });
        return { ...result, model: PRIMARY_MODEL };
    } catch (error) {
        primaryError = error;
        recordCostUsage(latency, { stage: 'verifier', model: PRIMARY_MODEL, response: error?.response, latencyMs: (latency?.now?.() ?? Date.now()) - attemptStarted, success: false, grounded: false, failureType: error?.code || 'API_ERROR' });
    }
    attemptStarted = latency?.now?.() ?? Date.now();
    try {
        const raw = await generateVerifier(FALLBACK_MODEL, prompt, options);
        const result = parseVerifierResult(raw);
        recordCostUsage(latency, { stage: 'verifier', model: FALLBACK_MODEL, response: raw, latencyMs: (latency?.now?.() ?? Date.now()) - attemptStarted, success: true, grounded: false });
        latency?.add('verifierMs', (latency?.now?.() ?? Date.now()) - started);
        latency?.detail({ type: 'legalVerifier', verdict: result.verdict, confidence: result.confidence });
        return { ...result, model: FALLBACK_MODEL, usedFallback: true };
    } catch (error) {
        recordCostUsage(latency, { stage: 'verifier', model: FALLBACK_MODEL, response: error?.response, latencyMs: (latency?.now?.() ?? Date.now()) - attemptStarted, success: false, grounded: false, failureType: error?.code || 'API_ERROR' });
        latency?.add('verifierMs', (latency?.now?.() ?? Date.now()) - started);
        error.cause = primaryError;
        throw error;
    }
}

async function applyRiskBasedVerification(input, options = {}) {
    const risk = assessLegalAnswerRisk(input);
    if (!risk.shouldVerify) return { answer: input.normalizedDraft, risk, verifierSkipped: true, repairTriggered: false };
    let verification;
    try { verification = await verifyLegalDraft({ ...input, draft: input.normalizedDraft.answer }, options); }
    catch (error) {
        const integrityIssueIds = [...new Set((input.integrity?.failures || []).map(item => item.issueId).filter(Boolean))];
        const answer = input.integrity?.valid === false && options.safePartial
            ? await options.safePartial({ failedIssueIds: integrityIssueIds.length ? integrityIssueIds : input.expectedIssues.map(issue => issue.id), reason: 'verifier_api_failure' })
            : input.normalizedDraft;
        return { answer, risk, verifierFailed: true, verifierError: error, repairTriggered: false };
    }
    if (verification.verdict === 'PASS' && input.integrity?.valid === false) {
        verification = {
            ...verification,
            verdict: 'FAIL',
            failedIssueIds: [...new Set([
                ...verification.failedIssueIds,
                ...(input.integrity.failures || []).map(item => item.issueId).filter(Boolean)
            ])],
            repairInstructions: [...verification.repairInstructions, 'Repair all deterministic citation, authority, and regime integrity failures before returning the answer.']
        };
    }
    if (verification.verdict !== 'FAIL') return { answer: input.normalizedDraft, risk, verification, repairTriggered: false };
    const failedIds = [...new Set(verification.failedIssueIds)];
    const repairStarted = options.latency?.now?.() ?? Date.now();
    options.latency?.increment('repairTriggered');
    const repaired = await options.repair({ verification, failedIssueIds: failedIds });
    options.latency?.add('repairMs', (options.latency?.now?.() ?? Date.now()) - repairStarted);
    for (let index = 0; index < failedIds.length; index += 1) options.latency?.increment('repairedIssueCount');
    return { answer: repaired, risk, verification, repairTriggered: true, repairedIssueCount: failedIds.length };
}

module.exports = { PRIMARY_MODEL, FALLBACK_MODEL, OUTPUT_SCHEMA, assessLegalAnswerRisk, compactEvidence, buildIssueEvidenceMapping, parseVerifierResult, buildVerifierPrompt, verifyLegalDraft, applyRiskBasedVerification };
