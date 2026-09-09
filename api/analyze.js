// api/analyze.js — Vercel 서버리스 핸들러 (독소조항 스니퍼)
// 분석 로직은 api/logic.js로 분리. 클라이언트와 같은 도메인 /api만 사용.

const { analyze } = require('./logic.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST만 지원됩니다' });
    return;
  }

  let body = '';
  try {
    body = req.body || '';
    if (typeof body === 'string' && body.trim()) {
      const ct = (req.headers['content-type'] || '').toLowerCase();
      if (ct.includes('application/json')) {
        body = JSON.parse(body);
      }
    }
  } catch (e) {
    body = req.body || '';
  }

  const text = (body.text || '').trim();

  if (!text) {
    res.status(200).json({
      ok: false,
      errorType: 'empty',
      message: '분석할 계약서 또는 약관 텍스트를 입력해 주세요',
    });
    return;
  }

  const result = analyze(text);

  res.status(200).json(result);
};
