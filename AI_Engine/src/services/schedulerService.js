const cron = require('node-cron');
const { getSystemSettings } = require('../controllers/adminController');
const { processLegalCrawl } = require('./crawlService');

exports.init = (io) => {
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const currentHourMinute = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        console.log(` [Scheduler] Đang kiểm tra lịch cào lúc: ${currentHourMinute}`);

        try {
            const settings = await getSystemSettings();

            if (settings && settings.IsAutoCrawlOn) {
                if (settings.CrawlTime === currentHourMinute) {
                    console.log(' [AUTO CRAWL]  Đang kích hoạt...');

                    let urlList = [];
                    try {
                        urlList = JSON.parse(settings.TargetUrls);
                    } catch (e) {
                        urlList = settings.TargetUrls
                            .split(/[\s,;]+/)
                            .map(u => u.trim())
                            .filter(u => u !== '');
                    }

                    if (urlList.length > 0) {
                        processLegalCrawl(urlList, io);
                    } else {
                        console.log(' Không có URL nào để cào!');
                    }
                }
            }
        } catch (error) {
            console.error(' Lỗi :', error.message);
        }
    });
};
