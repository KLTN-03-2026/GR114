const AUTHORITY_ROLES = Object.freeze({
    PRIMARY: 'PRIMARY',
    SUPPORTING: 'SUPPORTING',
    REJECTED: 'REJECTED'
});

const REGIME_FIT = Object.freeze({
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
    REJECT: 'REJECT'
});

const ISSUE_PURPOSES = Object.freeze({
    CRIMINAL_LIABILITY: 'CRIMINAL_LIABILITY',
    CRIMINAL_PROCEDURE: 'CRIMINAL_PROCEDURE',
    CIVIL_DAMAGE: 'CIVIL_DAMAGE',
    FAMILY_PROTECTION: 'FAMILY_PROTECTION',
    STATE_COMPENSATION: 'STATE_COMPENSATION',
    GENERAL: 'GENERAL'
});

const DOCUMENT_REGIMES = Object.freeze({
    CRIMINAL_SUBSTANTIVE: 'CRIMINAL_SUBSTANTIVE',
    CRIMINAL_PROCEDURE: 'CRIMINAL_PROCEDURE',
    CIVIL_TORT: 'CIVIL_TORT',
    CIVIL_GENERAL: 'CIVIL_GENERAL',
    STATE_COMPENSATION: 'STATE_COMPENSATION',
    DOMESTIC_VIOLENCE: 'DOMESTIC_VIOLENCE',
    UNKNOWN: 'UNKNOWN'
});
const { hasValidArticleMetadata } = require('./articleIdentifierService');

function normalize(value) {
    return String(value || '')
        .normalize('NFC')
        .toLocaleLowerCase('vi-VN')
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function documentText(document = {}) {
    return normalize([
        document.title, document.law_name, document.documentType,
        document.category, document.agency, document.chuong,
        document.dieu, document.content, document.text
    ].filter(Boolean).join(' '));
}

function hasAny(text, phrases) {
    const padded = ` ${normalize(text)} `;
    return phrases.some(phrase => padded.includes(` ${normalize(phrase)} `));
}

function matchedPhrases(text, phrases) {
    const padded = ` ${normalize(text)} `;
    return phrases.filter(phrase => padded.includes(` ${normalize(phrase)} `));
}

const ISSUE_SIGNAL_PHRASES = Object.freeze({
    familyRelationship: ['vợ', 'chồng', 'vợ chồng', 'cha', 'mẹ', 'con', 'ông bà', 'anh chị em', 'thành viên gia đình', 'người thân', 'gia đình', 'chung sống như vợ chồng'],
    neighborRelationship: ['hàng xóm', 'láng giềng', 'nhà bên cạnh'],
    bodilyInjury: ['xô xát', 'bạo lực', 'đánh', 'đập', 'thương tích', 'tổn hại sức khỏe', 'gãy tay', 'rách đầu', 'bị thương', 'sức khỏe bị xâm phạm'],
    compensation: ['bồi thường', 'thiệt hại', 'chi phí', 'viện phí', 'khám bệnh', 'chữa bệnh'],
    reconciliation: ['hòa giải', 'hoà giải', 'rút yêu cầu', 'bãi nại', 'thỏa thuận', 'thoả thuận'],
    criminalProcedure: ['khởi tố', 'đình chỉ', 'rút yêu cầu', 'yêu cầu của bị hại', 'tố tụng', 'bãi nại'],
    criminalLiability: ['trách nhiệm hình sự', 'tội phạm', 'phạm tội', 'bị truy cứu', 'bị phạt tù', 'cấu thành tội'],
    fault: ['lỗi', 'cùng gây', 'hai bên', 'mức độ lỗi'],
    explicitStateWrongdoing: ['oan sai', 'bắt giữ trái pháp luật', 'khởi tố trái pháp luật', 'thi hành công vụ gây thiệt hại', 'người thi hành công vụ', 'cơ quan nhà nước gây thiệt hại', 'yêu cầu nhà nước bồi thường', 'trách nhiệm bồi thường của nhà nước'],
    stateActorMention: ['cơ quan nhà nước', 'người thi hành công vụ', 'cán bộ', 'công chức', 'công an', 'tòa án', 'toà án', 'viện kiểm sát']
});

function inferIssueContext(issue = {}, userQuery = '') {
    const issueText = normalize(issue.query);
    const parentText = normalize(userQuery);
    const issueMatches = Object.fromEntries(Object.entries(ISSUE_SIGNAL_PHRASES)
        .map(([name, phrases]) => [name, matchedPhrases(issueText, phrases)]));
    const parentMatches = Object.fromEntries(Object.entries(ISSUE_SIGNAL_PHRASES)
        .map(([name, phrases]) => [name, matchedPhrases(parentText, phrases)]));
    const familyRelationship = issueMatches.familyRelationship.length > 0;
    const neighborRelationship = issueMatches.neighborRelationship.length > 0;
    const bodilyInjury = issueMatches.bodilyInjury.length > 0;
    const compensation = issueMatches.compensation.length > 0;
    const reconciliation = issueMatches.reconciliation.length > 0;
    const criminalProcedure = issueMatches.criminalProcedure.length > 0;
    const criminalLiability = issueMatches.criminalLiability.length > 0;
    const fault = issueMatches.fault.length > 0;
    const explicitStateWrongdoing = issueMatches.explicitStateWrongdoing.length > 0;
    const stateActorMention = issueMatches.stateActorMention.length > 0;
    const stateCompensationContext = explicitStateWrongdoing || (
        compensation && stateActorMention && hasAny(issueText, ['trái pháp luật', 'sai phạm', 'gây thiệt hại', 'do quyết định', 'do hành vi'])
    );

    let purpose = ISSUE_PURPOSES.GENERAL;
    if (compensation && stateCompensationContext) purpose = ISSUE_PURPOSES.STATE_COMPENSATION;
    else if (reconciliation && (criminalProcedure || criminalLiability)) purpose = ISSUE_PURPOSES.CRIMINAL_PROCEDURE;
    else if (criminalProcedure && (criminalLiability || bodilyInjury)) purpose = ISSUE_PURPOSES.CRIMINAL_PROCEDURE;
    else if (criminalLiability || (hasAny(issueText, ['khởi tố']) && bodilyInjury)) purpose = ISSUE_PURPOSES.CRIMINAL_LIABILITY;
    else if (compensation || fault) purpose = ISSUE_PURPOSES.CIVIL_DAMAGE;
    else if (familyRelationship && bodilyInjury) purpose = ISSUE_PURPOSES.FAMILY_PROTECTION;

    const matchedSignals = Object.entries(issueMatches)
        .filter(([, phrases]) => phrases.length > 0)
        .flatMap(([name, phrases]) => phrases.map(phrase => `${name}:${phrase}`));
    const parentSignalsIgnoredForPurpose = Object.entries(parentMatches)
        .filter(([name, phrases]) => phrases.length > 0 && issueMatches[name].length === 0)
        .flatMap(([name, phrases]) => phrases.map(phrase => `${name}:${phrase}`));

    return {
        purpose,
        familyRelationship,
        neighborRelationship,
        bodilyInjury,
        compensation,
        reconciliation,
        criminalProcedure,
        criminalLiability,
        fault,
        stateActorMention,
        stateCompensationContext,
        privateIndividualContext: neighborRelationship || (bodilyInjury && !stateCompensationContext),
        matchedSignals,
        parentSignalsIgnoredForPurpose
    };
}

function inferDocumentRegime(document = {}) {
    const identityText = normalize([
        document.title, document.law_name, document.documentType,
        document.category, document.agency
    ].filter(Boolean).join(' '));
    const propositionText = normalize([
        document.chuong, document.dieu, document.content, document.text
    ].filter(Boolean).join(' '));
    const identitySignals = {
        criminalProcedure: matchedPhrases(identityText, ['bộ luật tố tụng hình sự', 'luật tố tụng hình sự']),
        criminalSubstantive: matchedPhrases(identityText, ['bộ luật hình sự', 'luật hình sự']),
        civil: matchedPhrases(identityText, ['bộ luật dân sự', 'luật dân sự']),
        stateCompensation: matchedPhrases(identityText, ['luật trách nhiệm bồi thường của nhà nước', 'trách nhiệm bồi thường của nhà nước']),
        domesticViolence: matchedPhrases(identityText, ['luật phòng chống bạo lực gia đình', 'phòng chống bạo lực gia đình'])
    };
    if (normalize(document.category) === 'dân sự') identitySignals.civil.push('category:dân sự');
    const stateCompensationScope = identitySignals.stateCompensation.length > 0;
    const domesticViolenceScope = identitySignals.domesticViolence.length > 0;
    const criminalProcedure = identitySignals.criminalProcedure.length > 0;
    const criminalSubstantive = !criminalProcedure && identitySignals.criminalSubstantive.length > 0;
    const civilIdentity = identitySignals.civil.length > 0;
    const tortSpecific = civilIdentity && hasAny(propositionText, ['thiệt hại do sức khỏe bị xâm phạm', 'bồi thường thiệt hại ngoài hợp đồng', 'nguyên tắc bồi thường', 'bên bị thiệt hại có lỗi', 'mức độ lỗi', 'người gây thiệt hại']);
    const civilGeneral = civilIdentity && hasAny(propositionText, ['quyền dân sự bị xâm phạm', 'bồi thường toàn bộ thiệt hại', 'nguyên tắc cơ bản']);

    let regime = DOCUMENT_REGIMES.UNKNOWN;
    if (stateCompensationScope) regime = DOCUMENT_REGIMES.STATE_COMPENSATION;
    else if (domesticViolenceScope) regime = DOCUMENT_REGIMES.DOMESTIC_VIOLENCE;
    else if (criminalProcedure) regime = DOCUMENT_REGIMES.CRIMINAL_PROCEDURE;
    else if (criminalSubstantive) regime = DOCUMENT_REGIMES.CRIMINAL_SUBSTANTIVE;
    else if (tortSpecific) regime = DOCUMENT_REGIMES.CIVIL_TORT;
    else if (civilGeneral || civilIdentity) regime = DOCUMENT_REGIMES.CIVIL_GENERAL;

    return {
        regime,
        stateCompensationScope,
        domesticViolenceScope,
        criminalProcedure,
        criminalSubstantive,
        civilIdentity,
        tortSpecific,
        civilGeneral,
        identitySignals,
        documentIdentitySignal: Object.entries(identitySignals)
            .flatMap(([name, phrases]) => phrases.map(phrase => `${name}:${phrase}`)),
        propositionSignals: matchedPhrases(propositionText, [
            'khởi tố vụ án hình sự', 'yêu cầu của bị hại', 'rút yêu cầu khởi tố',
            'cố ý gây thương tích', 'tổn hại cho sức khỏe', 'xâm phạm sức khỏe', 'thương tích',
            'bồi thường thiệt hại', 'thiệt hại do sức khỏe bị xâm phạm', 'nguyên tắc bồi thường',
            'bên bị thiệt hại có lỗi', 'mức độ lỗi', 'người gây thiệt hại'
        ])
    };
}

function hasGenericArticleScope(document = {}) {
    const text = normalize([document.dieu, document.article, document.article_number, document.articleTitle, document.content, document.text].filter(Boolean).join(' '));
    const articleHeading = normalize([document.dieu, document.article, document.article_number, document.articleTitle].filter(Boolean).join(' '));
    const documentIdentity = normalize([document.title, document.law_name, document.documentType].filter(Boolean).join(' '));
    const leadingArticleText = normalize(String(document.content || document.text || '').slice(0, 500));
    const bareArticleHeading = /^điều\s+\d+[a-z]?$/u.test(articleHeading);
    const amendmentWrapperArticle = bareArticleHeading && hasAny(documentIdentity, ['sửa đổi bổ sung', 'luật sửa đổi']);
    return amendmentWrapperArticle || hasAny(`${articleHeading} ${leadingArticleText}`, [
        'phạm vi điều chỉnh', 'đối tượng áp dụng', 'nhiệm vụ', 'giải thích từ ngữ',
        'nguyên tắc chung', 'quy định chung', 'hiệu lực thi hành', 'điều khoản thi hành'
    ]) || (
        hasAny(documentIdentity, ['sửa đổi bổ sung', 'luật sửa đổi']) &&
        hasAny(text, ['sửa đổi bổ sung một số điều', 'sửa đổi một số điều']) &&
        !hasAny(articleHeading, ['tội', 'trách nhiệm', 'hình phạt', 'bồi thường', 'khởi tố'])
    );
}

function hasCoreAuthorityFit(issueContext, documentContext, document = {}) {
    if (!hasValidArticleMetadata(document) || hasGenericArticleScope(document)) return false;
    const text = normalize([document.dieu, document.article, document.article_number, document.articleTitle, document.content, document.text].filter(Boolean).join(' '));
    switch (issueContext.purpose) {
        case ISSUE_PURPOSES.CRIMINAL_LIABILITY:
            return documentContext.regime === DOCUMENT_REGIMES.CRIMINAL_SUBSTANTIVE &&
                issueContext.criminalLiability &&
                (!issueContext.bodilyInjury || (
                    hasAny(text, ['tội cố ý gây thương tích', 'người nào cố ý gây thương tích', 'gây tổn hại cho sức khỏe của người khác']) &&
                    hasAny(text, ['người nào', 'chịu trách nhiệm hình sự', 'bị phạt', 'phạt tù', 'phạt cải tạo', 'cấu thành tội'])
                ));
        case ISSUE_PURPOSES.CRIMINAL_PROCEDURE:
            if (documentContext.regime !== DOCUMENT_REGIMES.CRIMINAL_PROCEDURE) return false;
            if (issueContext.reconciliation) {
                return hasAny(text, ['yêu cầu của bị hại', 'rút yêu cầu', 'rút yêu cầu khởi tố']) &&
                    hasAny(text, ['khởi tố vụ án hình sự', 'chỉ được khởi tố', 'đình chỉ', 'xử lý theo pháp luật tố tụng hình sự']);
            }
            return issueContext.criminalProcedure && hasAny(text, ['khởi tố vụ án hình sự', 'đình chỉ', 'tố tụng hình sự']);
        case ISSUE_PURPOSES.CIVIL_DAMAGE:
            if (documentContext.regime !== DOCUMENT_REGIMES.CIVIL_TORT) return false;
            if (issueContext.fault && !hasAny(text, ['bên bị thiệt hại có lỗi', 'mức độ lỗi', 'lỗi của mình gây ra'])) return false;
            if (issueContext.compensation && !hasAny(text, ['bồi thường thiệt hại', 'thiệt hại do sức khỏe bị xâm phạm', 'chi phí cứu chữa', 'thu nhập bị mất'])) return false;
            return issueContext.compensation || issueContext.fault;
        case ISSUE_PURPOSES.STATE_COMPENSATION:
            return documentContext.regime === DOCUMENT_REGIMES.STATE_COMPENSATION && documentContext.stateCompensationScope;
        case ISSUE_PURPOSES.FAMILY_PROTECTION:
            return documentContext.regime === DOCUMENT_REGIMES.DOMESTIC_VIOLENCE && documentContext.domesticViolenceScope;
        default:
            return false;
    }
}

function decision(eligible, authorityRole, regimeFit, reasons, scopeSignals, coreAuthorityFit = false) {
    return { eligible, authorityRole, regimeFit, reasons, scopeSignals, coreAuthorityFit };
}

function evaluateLegalEvidence({ issue = {}, userQuery = '', document = {}, inferredIssueContext = null } = {}) {
    const issueContext = inferredIssueContext || inferIssueContext(issue, userQuery);
    const documentContext = inferDocumentRegime(document);
    const scopeSignals = { issue: issueContext, document: documentContext };
    const coreAuthorityFit = hasCoreAuthorityFit(issueContext, documentContext, document);

    if (!hasValidArticleMetadata(document)) {
        return decision(false, AUTHORITY_ROLES.REJECTED, REGIME_FIT.REJECT, ['invalid_article_metadata'], scopeSignals, false);
    }
    if (hasGenericArticleScope(document)) {
        return decision(false, AUTHORITY_ROLES.REJECTED, REGIME_FIT.REJECT, ['non_specific_article_scope'], scopeSignals, false);
    }

    if (documentContext.regime === DOCUMENT_REGIMES.UNKNOWN) {
        return decision(false, AUTHORITY_ROLES.REJECTED, REGIME_FIT.REJECT, ['unknown_legal_regime'], scopeSignals, false);
    }

    if (documentContext.regime === DOCUMENT_REGIMES.STATE_COMPENSATION) {
        if (!issueContext.stateCompensationContext) {
            return decision(false, AUTHORITY_ROLES.REJECTED, REGIME_FIT.REJECT, ['state_compensation_scope_mismatch'], scopeSignals);
        }
        return decision(true, AUTHORITY_ROLES.PRIMARY, REGIME_FIT.HIGH, ['state_compensation_context_confirmed'], scopeSignals, coreAuthorityFit);
    }

    if (documentContext.regime === DOCUMENT_REGIMES.DOMESTIC_VIOLENCE) {
        if (!issueContext.familyRelationship) {
            return decision(false, AUTHORITY_ROLES.REJECTED, REGIME_FIT.REJECT, ['family_relationship_required'], scopeSignals);
        }
        if (issueContext.purpose === ISSUE_PURPOSES.FAMILY_PROTECTION) {
            return decision(true, AUTHORITY_ROLES.PRIMARY, REGIME_FIT.HIGH, ['family_relationship_confirmed'], scopeSignals, coreAuthorityFit);
        }
        return decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.MEDIUM, ['family_scope_confirmed_but_not_core_authority'], scopeSignals);
    }

    const purpose = issueContext.purpose;
    if (purpose === ISSUE_PURPOSES.CRIMINAL_PROCEDURE) {
        if (documentContext.regime === DOCUMENT_REGIMES.CRIMINAL_PROCEDURE) {
            return coreAuthorityFit
                ? decision(true, AUTHORITY_ROLES.PRIMARY, REGIME_FIT.HIGH, ['criminal_procedure_authority'], scopeSignals, true)
                : decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.MEDIUM, ['criminal_procedure_proposition_not_established'], scopeSignals, false);
        }
        if (documentContext.regime === DOCUMENT_REGIMES.CRIMINAL_SUBSTANTIVE) {
            return decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.MEDIUM, ['substantive_criminal_authority_not_procedural'], scopeSignals);
        }
        return decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.LOW, ['no_core_criminal_procedure_authority'], scopeSignals);
    }

    if (purpose === ISSUE_PURPOSES.CRIMINAL_LIABILITY) {
        if (documentContext.regime === DOCUMENT_REGIMES.CRIMINAL_SUBSTANTIVE) {
            return coreAuthorityFit
                ? decision(true, AUTHORITY_ROLES.PRIMARY, REGIME_FIT.HIGH, ['substantive_criminal_authority'], scopeSignals, true)
                : decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.MEDIUM, ['criminal_liability_proposition_not_established'], scopeSignals, false);
        }
        if (documentContext.regime === DOCUMENT_REGIMES.CRIMINAL_PROCEDURE) {
            return decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.MEDIUM, ['procedural_authority_not_substantive_liability'], scopeSignals);
        }
        return decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.LOW, ['no_core_substantive_criminal_authority'], scopeSignals);
    }

    if (purpose === ISSUE_PURPOSES.CIVIL_DAMAGE || purpose === ISSUE_PURPOSES.STATE_COMPENSATION) {
        if (documentContext.regime === DOCUMENT_REGIMES.CIVIL_TORT) {
            return coreAuthorityFit
                ? decision(true, AUTHORITY_ROLES.PRIMARY, REGIME_FIT.HIGH, ['specific_civil_tort_authority'], scopeSignals, true)
                : decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.MEDIUM, ['civil_damage_proposition_not_established'], scopeSignals, false);
        }
        if (documentContext.regime === DOCUMENT_REGIMES.CIVIL_GENERAL) {
            return decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.MEDIUM, ['general_civil_authority_only'], scopeSignals);
        }
        return decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.LOW, ['no_core_civil_tort_authority'], scopeSignals);
    }

    if (purpose === ISSUE_PURPOSES.FAMILY_PROTECTION) {
        return decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.LOW, ['no_core_family_protection_authority'], scopeSignals);
    }

    // A GENERAL issue has no positive, issue-specific regime signal. Preserve
    // useful evidence for synthesis, but never let it establish authority
    // coverage independently.
    return decision(true, AUTHORITY_ROLES.SUPPORTING, REGIME_FIT.LOW, ['unclassified_issue_supporting_only'], scopeSignals);
}

function canSatisfyAuthorityCoverage(evaluation, document = null) {
    return (!document || hasValidArticleMetadata(document)) && evaluation?.eligible === true && evaluation.authorityRole === AUTHORITY_ROLES.PRIMARY && evaluation.coreAuthorityFit === true;
}

module.exports = {
    AUTHORITY_ROLES,
    REGIME_FIT,
    ISSUE_PURPOSES,
    DOCUMENT_REGIMES,
    inferIssueContext,
    inferDocumentRegime,
    hasCoreAuthorityFit,
    evaluateLegalEvidence,
    canSatisfyAuthorityCoverage
};
