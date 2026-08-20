const CANONICAL_CATEGORIES = Object.freeze([
    'Bộ máy hành chính',
    'Cán bộ - Công chức',
    'Tài chính nhà nước',
    'Thuế - Phí - Lệ phí',
    'Kế toán - Kiểm toán',
    'Tiền tệ - Ngân hàng',
    'Chứng khoán',
    'Bảo hiểm',
    'Doanh nghiệp',
    'Đầu tư',
    'Thương mại',
    'Đấu thầu',
    'Xuất nhập khẩu',
    'Dân sự',
    'Hình sự',
    'Tố tụng',
    'Tư pháp',
    'Quốc phòng - An ninh',
    'Ngoại giao',
    'Lao động - Tiền lương',
    'Giáo dục',
    'Y tế',
    'Văn hóa - Thể thao - Du lịch',
    'Văn hóa - Xã hội',
    'Tài nguyên - Môi trường',
    'Nông nghiệp - Nông thôn',
    'Bất động sản',
    'Xây dựng - Đô thị',
    'Giao thông - Vận tải',
    'Công nghệ thông tin',
    'Khoa học - Công nghệ',
    'Sở hữu trí tuệ',
    'Hiến pháp',
    'Lĩnh vực khác'
]);

const LEGACY_CATEGORY_ALIASES = Object.freeze({
    'Hành chính': 'Bộ máy hành chính',
    'Cán bộ công chức': 'Cán bộ - Công chức',
    'Thủ tục Tố tụng': 'Tố tụng',
    'Ngân hàng': 'Tiền tệ - Ngân hàng',
    'Giao thông vận tải': 'Giao thông - Vận tải',
    'Lao động': 'Lao động - Tiền lương',
    'Nông nghiệp': 'Nông nghiệp - Nông thôn',
    'Khoa học công nghệ': 'Khoa học - Công nghệ',
    'Văn hóa thể thao du lịch': 'Văn hóa - Thể thao - Du lịch',
    'Dịch vụ pháp lý': 'Tư pháp',
    'Quốc phòng': 'Quốc phòng - An ninh'
});

const CATEGORIES_REQUIRING_RECLASSIFICATION = Object.freeze([
    'Tài chính',
    'Thể thao - Y tế',
    'Quyền dân sự',
    'An ninh trật tự'
]);

const canonicalCategorySet = new Set(CANONICAL_CATEGORIES);
const reclassificationCategorySet = new Set(CATEGORIES_REQUIRING_RECLASSIFICATION);

const isValidLegalCategory = category => canonicalCategorySet.has(String(category || '').trim());

const getLegalCategoryNormalization = category => {
    const value = String(category || '').trim();

    if (canonicalCategorySet.has(value)) {
        return { input: value, category: value, status: 'CANONICAL' };
    }
    if (LEGACY_CATEGORY_ALIASES[value]) {
        return { input: value, category: LEGACY_CATEGORY_ALIASES[value], status: 'ALIASED' };
    }
    if (reclassificationCategorySet.has(value)) {
        return { input: value, category: null, status: 'NEEDS_RECLASSIFICATION' };
    }
    return { input: value, category: null, status: 'UNKNOWN' };
};

const normalizeLegalCategory = category => getLegalCategoryNormalization(category).category;

module.exports = {
    CANONICAL_CATEGORIES,
    LEGACY_CATEGORY_ALIASES,
    CATEGORIES_REQUIRING_RECLASSIFICATION,
    isValidLegalCategory,
    getLegalCategoryNormalization,
    normalizeLegalCategory
};
