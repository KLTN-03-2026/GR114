/**
 * Hàm làm sạch URL TikTok và YouTube để tối ưu Cache
 * @param {string} url - Link gốc người dùng dán vào
 * @returns {string} - Link đã được chuẩn hóa
 */
const cleanVideoUrl = (url) => {
    try {
        const urlObj = new URL(url);
        
        // 1. Xử lý YouTube (Shorts & Watch)
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            let videoId = '';
            if (urlObj.pathname.includes('/shorts/')) {
                videoId = urlObj.pathname.split('/shorts/')[1].split('/')[0];
            } else if (urlObj.searchParams.has('v')) {
                videoId = urlObj.searchParams.get('v');
            } else {
                videoId = urlObj.pathname.split('/').pop();
            }
            return `https://www.youtube.com/watch?v=${videoId.split('?')[0]}`;
        }

        // 2. Xử lý TikTok
        if (urlObj.hostname.includes('tiktok.com')) {
            // Loại bỏ các tham số ?is_from_webapp...
            const cleanPath = urlObj.pathname.split('?')[0];
            // Đảm bảo link có dạng tiktok.com/@user/video/ID
            return `https://www.tiktok.com${cleanPath}`;
        }

        return url;
    } catch (e) {
        return url; // Nếu lỗi thì trả về gốc
    }
};

module.exports = { cleanVideoUrl };