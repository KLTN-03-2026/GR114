const lawSourceService = require('../services/lawSourceService');

class SourceController {
  resolveLink = async (req, res) => {
    try {
      const { lawNum, lawName } = req.query;

      console.log(`[LAZY RESOLVE TRIGGERED] -> LawNum: ${lawNum}, LawName: ${lawName}`);

      if (!lawNum) {
        return res.redirect(302, 'https://vbpl.vn');
      }

      // Gọi service cào/check SSMS
      const targetUrl = await lawSourceService.resolveCanonicalUrl(
        String(lawNum), 
        lawName ? String(lawName) : undefined
      );

      console.log(`[LAZY RESOLVE SUCCESS] -> Redirecting to: ${targetUrl}`);

      return res.redirect(302, targetUrl);

    } catch (error) {
      console.error('[SourceController Error]:', error.message);
      return res.redirect(302, 'https://vbpl.vn');
    }
  }
}

module.exports = new SourceController();