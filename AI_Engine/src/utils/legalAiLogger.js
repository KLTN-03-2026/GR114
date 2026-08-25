const LEVELS = Object.freeze({ info: 0, debug: 1, verbose: 2 });

function getLevel() {
    const value = String(process.env.LEGAL_AI_LOG_LEVEL || 'info').toLowerCase();
    return Object.prototype.hasOwnProperty.call(LEVELS, value) ? value : 'info';
}

function enabled(level) {
    return LEVELS[getLevel()] >= LEVELS[level];
}

function line(section, fields = {}, level = 'info') {
    if (!enabled(level)) return;
    console.log(`[${section}]`);
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) console.log(`${key}=${value}`);
    }
}

function debug(section, fields) {
    line(section, fields, 'debug');
}

function verbose(section, fields) {
    line(section, fields, 'verbose');
}

function error(section, fields = {}) {
    console.error(`[${section}]`);
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) console.error(`${key}=${value}`);
    }
}

module.exports = { getLevel, enabled, line, debug, verbose, error };
