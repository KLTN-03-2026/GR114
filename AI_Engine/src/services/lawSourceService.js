const sql = require('mssql');
const axios = require('axios');
const cheerio = require('cheerio');
const { pool, poolConnect } = require('../config/db');

class LawSourceService {
    /**
     * Resolves a legal document URL from the SSMS cache or
     * by performing a direct lookup against VBPL.
     *
     * Google Search Grounding is intentionally handled by geminiService.
     *
     * @param {string} lawNumber - Official legal document number.
     * @param {string} [lawName] - Official legal document name.
     * @returns {Promise<string>} Verified legal document URL.
     */
    async resolveCanonicalUrl(lawNumber, lawName) {
        if (!lawNumber) {
            throw new Error('Missing legal document number.');
        }

        const cleanLawNum = String(lawNumber).trim();
        const cleanLawName = lawName ? String(lawName).trim() : '';

        try {
            await poolConnect;

            // Step 1: Check the SSMS cache for an existing verified URL.
            const request = pool.request();

            request.input(
                'LawNumber',
                sql.NVarChar(100),
                cleanLawNum
            );

            const result = await request.query(`
                SELECT CanonicalUrl
                FROM dbo.LawSources
                WHERE LawNumber = @LawNumber
            `);

            if (result.recordset && result.recordset.length > 0) {
                const cachedUrl = result.recordset[0].CanonicalUrl;

                if (this.isValidLegalSourceUrl(cachedUrl)) {
                    this.incrementClickCount(cleanLawNum);
                    return cachedUrl;
                }

                console.warn(
                    `[LawSourceService] Invalid cached URL rejected: ${cachedUrl}`
                );
            }

            // Step 2: Attempt to resolve the exact document directly from VBPL.
            const vbplUrl = await this.scrapeDirectFromVBPL(
                cleanLawNum,
                cleanLawName
            );

            if (this.isValidLegalSourceUrl(vbplUrl)) {
                await this.cacheResolvedUrl(
                    cleanLawNum,
                    cleanLawName,
                    vbplUrl
                );

                return vbplUrl;
            }

            throw new Error(
                `No cached or direct VBPL source found for ${cleanLawNum}.`
            );

        } catch (error) {
            console.error(
                '[LawSourceService Error]:',
                error.message
            );

            throw error;
        }
    }

    /**
     * Validates whether a URL belongs to an approved legal source
     * and points to a specific document page rather than a homepage
     * or search result page.
     */
    isValidLegalSourceUrl(sourceUrl) {
        if (!sourceUrl || typeof sourceUrl !== 'string') {
            return false;
        }

        try {
            const url = new URL(sourceUrl);
            const hostname = url.hostname.toLowerCase();
            const pathname = url.pathname.toLowerCase();

            const allowedHosts = [
                'vbpl.vn',
                'www.vbpl.vn',
                'thuvienphapluat.vn',
                'www.thuvienphapluat.vn',
                'xaydungchinhsach.chinhphu.vn'
            ];

            if (!allowedHosts.includes(hostname)) {
                return false;
            }

            // Reject homepages and empty paths.
            if (!pathname || pathname === '/') {
                return false;
            }

            // Reject search and lookup result pages.
            if (
                pathname.includes('/tim-kiem') ||
                pathname.includes('/search') ||
                pathname.includes('/tra-cuu')
            ) {
                return false;
            }

            return true;

        } catch {
            return false;
        }
    }

    /**
     * Validates a URL returned by geminiService and caches it
     * only when it belongs to an approved legal source.
     *
     * This method does not perform any Google Search or Gemini API call.
     */
    async validateAndCacheResolvedUrl(
        lawNumber,
        lawName,
        sourceUrl
    ) {
        if (!lawNumber) {
            throw new Error('Missing legal document number.');
        }

        if (!this.isValidLegalSourceUrl(sourceUrl)) {
            throw new Error(
                `Invalid legal source URL rejected: ${sourceUrl}`
            );
        }

        const cleanLawNum = String(lawNumber).trim();
        const cleanLawName = lawName
            ? String(lawName).trim()
            : '';

        const normalizedUrl = this.normalizeUrl(sourceUrl);

        await poolConnect;

        await this.cacheResolvedUrl(
            cleanLawNum,
            cleanLawName,
            normalizedUrl
        );

        return normalizedUrl;
    }

    /**
     * Performs a direct lookup against VBPL and extracts
     * a specific legal document detail URL.
     */
    async scrapeDirectFromVBPL(lawNumber, lawName) {
        try {
            const searchKeyword = lawName
                ? `${lawNumber} ${lawName}`
                : lawNumber;

            const searchUrl =
                'https://vbpl.vn/van-ban/tim-kiem?keyword=' +
                encodeURIComponent(searchKeyword);

            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                        'Chrome/122.0.0.0 Safari/537.36',
                    'Accept':
                        'text/html,application/xhtml+xml,application/xml;q=0.9,' +
                        'image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language':
                        'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://vbpl.vn/',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 6000
            });

            const $ = cheerio.load(response.data);

            let exactUrl = null;

            $('a[href*="/van-ban/chi-tiet/"]').each(
                (index, element) => {
                    const href = $(element).attr('href');

                    if (!href) {
                        return;
                    }

                    const linkText = $(element)
                        .text()
                        .replace(/\s+/g, ' ')
                        .trim();

                    const normalizedUrl = href.startsWith('http')
                        ? href
                        : `https://vbpl.vn${href}`;

                    const numberMatches =
                        linkText
                            .toLowerCase()
                            .includes(lawNumber.toLowerCase());

                    const nameMatches =
                        !lawName ||
                        linkText
                            .toLowerCase()
                            .includes(lawName.toLowerCase());

                    if (
                        this.isValidLegalSourceUrl(normalizedUrl) &&
                        normalizedUrl.includes('/van-ban/chi-tiet/') &&
                        numberMatches &&
                        (nameMatches || !lawName)
                    ) {
                        exactUrl = normalizedUrl;
                        return false;
                    }
                }
            );

            return exactUrl;

        } catch (error) {
            console.warn(
                '[VBPL Lookup Warning]:',
                error.message
            );

            return null;
        }
    }

    /**
     * Normalizes a URL for reliable comparison and storage.
     */
    normalizeUrl(sourceUrl) {
        try {
            const url = new URL(sourceUrl);

            url.hash = '';

            return url
                .toString()
                .replace(/\/$/, '')
                .toLowerCase();

        } catch {
            return '';
        }
    }

    /**
     * Stores a verified legal source URL in SSMS.
     */
    async cacheResolvedUrl(
        lawNumber,
        lawName,
        canonicalUrl
    ) {
        if (!this.isValidLegalSourceUrl(canonicalUrl)) {
            throw new Error(
                `Attempted to cache an invalid legal source URL: ${canonicalUrl}`
            );
        }

        const request = pool.request();

        request.input(
            'LawNumber',
            sql.NVarChar(100),
            lawNumber
        );

        request.input(
            'LawName',
            sql.NVarChar(255),
            lawName || ''
        );

        request.input(
            'CanonicalUrl',
            sql.NVarChar(2000),
            canonicalUrl
        );

        await request.query(`
            IF EXISTS (
                SELECT 1
                FROM dbo.LawSources
                WHERE LawNumber = @LawNumber
            )
            BEGIN
                UPDATE dbo.LawSources
                SET
                    LawName = @LawName,
                    CanonicalUrl = @CanonicalUrl,
                    UpdatedAt = GETDATE()
                WHERE LawNumber = @LawNumber
            END
            ELSE
            BEGIN
                INSERT INTO dbo.LawSources
                    (LawNumber, LawName, CanonicalUrl)
                VALUES
                    (@LawNumber, @LawName, @CanonicalUrl)
            END
        `);
    }

    /**
     * Updates access statistics for a cached legal source.
     */
    incrementClickCount(lawNumber) {
        const request = pool.request();

        request.input(
            'LawNumber',
            sql.NVarChar(100),
            lawNumber
        );

        request.query(`
            UPDATE dbo.LawSources
            SET
                ClickCount = ClickCount + 1,
                UpdatedAt = GETDATE()
            WHERE LawNumber = @LawNumber
        `).catch(() => {});
    }
}

module.exports = new LawSourceService();