// api/logic.js — 독소조항 스니퍼 분석 로직 (규칙 기반)
// Vercel 핸들러와 분리된 순수 분석 모듈.

const CATEGORIES = [
  // ---------- 일반 계약서·약관 ----------
  {
    id: 'penalty',
    label: '위약금·환불불가',
    leaseOnly: false,
    patterns: [
      { regex: /위약금/i, strength: 2 },
      { regex: /계약금\s*포\s*기/i, strength: 3 },
      { regex: /페널티/i, strength: 2 },
      { regex: /패널티/i, strength: 2 },
      { regex: /환불\s*불가/i, strength: 3 },
      { regex: /반환\s*불가/i, strength: 3 },
      { regex: /되돌려\s*받지/i, strength: 2 },
    ],
    defaultRisk: '중',
  },
  {
    id: 'auto-renew',
    label: '자동연장·자동결제',
    leaseOnly: false,
    patterns: [
      { regex: /자동\s*연장/i, strength: 3 },
      { regex: /자동\s*갱신/i, strength: 3 },
      { regex: /별도\s*통보\s*없이/i, strength: 3 },
      { regex: /자동으로\s*연장/i, strength: 3 },
      { regex: /재계약\s*거부\s*불가/i, strength: 2 },
      { regex: /갱신\s*거절을/i, strength: 2 },
      { regex: /Opt-?out/i, strength: 2 },
      { regex: /수신\s*거부/i, strength: 1 },
    ],
    defaultRisk: '중',
  },
  {
    id: 'privacy-third',
    label: '개인정보 제3자 제공·마케팅 강제',
    leaseOnly: false,
    patterns: [
      { regex: /제3자\s*제공/i, strength: 3 },
      { regex: /마케팅\s*활용/i, strength: 2 },
      { regex: /개인정보\s*제공/i, strength: 2 },
      { regex: /정보\s*제공\s*동의/i, strength: 2 },
      { regex: /필수\s*동의/i, strength: 2 },
      { regex: /마케팅\s*동의.*필수/i, strength: 3 },
      { regex: /제3자\s*제공.*동의/i, strength: 3 },
    ],
    defaultRisk: '중',
  },
  {
    id: 'unilateral-termination',
    label: '사업자(임대인)의 일방적 해지·조건 변경',
    leaseOnly: false,
    patterns: [
      { regex: /일방적으로/i, strength: 3 },
      { regex: /임대인.*정하는/i, strength: 3 },
      { regex: /사업자.*정하는/i, strength: 3 },
      { regex: /임대인이\s*정한/i, strength: 3 },
      { regex: /사업자가\s*정한/i, strength: 3 },
      { regex: /임의로/i, strength: 2 },
      { regex: /통보\s*없이/i, strength: 3 },
      { regex: /사전\s*통보.*없이/i, strength: 3 },
      { regex: /언제든지.*보여줘야/i, strength: 3 },
      { regex: /응해야/i, strength: 2 },
    ],
    defaultRisk: '중',
  },
  {
    id: 'dispute-court',
    label: '불리한 관할법원·분쟁해결',
    leaseOnly: false,
    patterns: [
      { regex: /관할법원/i, strength: 2 },
      { regex: /관할\s*합의/i, strength: 2 },
      { regex: /○○\s*지방법원/i, strength: 2 },
      { regex: /사업자\s*소재지/i, strength: 2 },
      { regex: /중재\s*합의/i, strength: 2 },
      { regex: /소송.*관할/i, strength: 2 },
    ],
    defaultRisk: '중',
  },
  {
    id: 'liability-limit',
    label: '손해배상 책임 제한(사업자 유리)',
    leaseOnly: false,
    patterns: [
      { regex: /손해배상\s*책임\s*제한/i, strength: 3 },
      { regex: /면책/i, strength: 3 },
      { regex: /책임\s*없음/i, strength: 3 },
      { regex: /배상하지\s*아니/i, strength: 3 },
      { regex: /배상\s*한도/i, strength: 2 },
      { regex: /책임.*제한/i, strength: 2 },
      { regex: /손해.*책임.*없다/i, strength: 3 },
    ],
    defaultRisk: '중',
  },

  // ---------- 임대차 특화 ----------
  {
    id: 'restoration-over',
    label: '과도한 원상복구 의무',
    leaseOnly: true,
    patterns: [
      { regex: /원상복구/i, strength: 2 },
      { regex: /원상\s*회복/i, strength: 2 },
      { regex: /정상적\s*사용.*마모/i, strength: 3 },
      { regex: /정상적인\s*사용.*마모/i, strength: 3 },
      { regex: /자연\s*마모/i, strength: 3 },
      { regex: /통상적인\s*마모/i, strength: 3 },
      { regex: /세월.*흔적/i, strength: 2 },
      { regex: /훼손.*복구.*부담/i, strength: 2 },
      { regex: /원상복구.*비용.*전액/i, strength: 3 },
    ],
    defaultRisk: '상',
  },
  {
    id: 'deposit-delay',
    label: '보증금 반환 지연·부당 공제',
    leaseOnly: true,
    patterns: [
      { regex: /보증금.*반환.*지연/i, strength: 3 },
      { regex: /반환\s*지연/i, strength: 2 },
      { regex: /반환\s*일정/i, strength: 2 },
      { regex: /임대인이\s*정한\s*순서/i, strength: 3 },
      { regex: /임대인이\s*정한\s*일정/i, strength: 3 },
      { regex: /이자\s*지급\s*책임.*없다/i, strength: 3 },
      { regex: /이자\s*책임.*없다/i, strength: 3 },
      { regex: /이자\s*지급.*면제/i, strength: 3 },
      { regex: /보증금.*공제/i, strength: 2 },
      { regex: /환급.*지연/i, strength: 2 },
    ],
    defaultRisk: '상',
  },
  {
    id: 'sublease-ban',
    label: '전대차·재임대 전면 금지 및 위반 시 즉시 해지',
    leaseOnly: true,
    patterns: [
      { regex: /전대차/i, strength: 2 },
      { regex: /재임대/i, strength: 2 },
      { regex: /임차권\s*양도/i, strength: 2 },
      { regex: /전대/i, strength: 2 },
      { regex: /재임대.*금지/i, strength: 2 },
      { regex: /전대.*금지/i, strength: 2 },
      { regex: /위반.*즉시\s*해지/i, strength: 3 },
      { regex: /위반.*계약\s*해지/i, strength: 2 },
    ],
    defaultRisk: '중',
  },
  {
    id: 'maintenance-unclear',
    label: '관리비 항목 불명확·임의 추가 청구',
    leaseOnly: true,
    patterns: [
      { regex: /관리비.*별도/i, strength: 2 },
      { regex: /관리비.*추가\s*청구/i, strength: 3 },
      { regex: /관리비.*실비/i, strength: 2 },
      { regex: /실비\s*정산/i, strength: 2 },
      { regex: /관리비.*정산/i, strength: 2 },
      { regex: /관리비.*부담.*임대인/i, strength: 2 },
      { regex: /임의로.*추가/i, strength: 2 },
    ],
    defaultRisk: '중',
  },
  {
    id: 'tenant-unfair-special',
    label: '임차인에게만 불리한 특약(임대인 임의 방문·수선 거부권 등)',
    leaseOnly: true,
    patterns: [
      { regex: /임대인\s*임의\s*방문/i, strength: 3 },
      { regex: /임의\s*방문/i, strength: 3 },
      { regex: /사전\s*통보.*없는\s*방문/i, strength: 3 },
      { regex: /사전\s*통보.*방문/i, strength: 2 },
      { regex: /언제든지\s*집을\s*보여줘야/i, strength: 3 },
      { regex: /보여줘야\s*하며/i, strength: 2 },
      { regex: /응해야\s*한다/i, strength: 2 },
      { regex: /임대인.*방문.*동의/i, strength: 2 },
      { regex: /임대차\s*기간.*방문/i, strength: 2 },
      { regex: /주거의\s*평온/i, strength: 1 },
      { regex: /즉시\s*해지/i, strength: 3 },
      { regex: /거절.*해지/i, strength: 3 },
    ],
    defaultRisk: '상',
  },
];

// ---------- 입력 유효성 (0단계) ----------

function isMeaningfulText(text) {
  const t = (text || '').trim();
  if (!t) return false;
  if (t.length < 3) return false;
  const korean = (t.match(/[\uac00-\ud7af]/g) || []).length;
  if (korean < 2 && t.length < 10) return false;
  return true;
}

function looksLikeContract(text) {
  const t = (text || '').trim();
  if (!isMeaningfulText(t)) return false;

  const hasArticle = /제\d+조/i.test(t);
  const hasSpecialAgreement = /특약\s*사항/i.test(t);
  const hasNumberedItems = /(^|\n)\s*\d+[\.\)]\s/.test(t);
  const hasLeaseKeywords = /(보증금|월세|차임|임대료|임대인|임차인|임대차|계약기간|특약)/i.test(t);
  const hasTerms = /(계약|조항|약관|동의|규정|정책|이용약관|서비스\s*약관)/i.test(t);

  return hasArticle || hasSpecialAgreement || hasNumberedItems || hasLeaseKeywords || hasTerms;
}

function isLeaseContract(text) {
  const t = (text || '').trim();
  const leaseSignals = /(보증금|월세|차임|임대료|임대인|임차인|임대차|전대차|원상복구|관리비|보증금.*반환)/i;
  return leaseSignals.test(t);
}

// ---------- 조항 분할 ----------

function splitIntoClauses(text) {
  const t = (text || '').trim();
  if (!t) return [];

  const specialMatch = t.match(/(특약\s*사항)/i);
  const clauses = [];
  if (specialMatch) {
    const idx = specialMatch.index;
    const beforeSpecial = t.slice(0, idx);
    if (beforeSpecial.trim()) {
      clauses.push(...extractClausesFromBlock(beforeSpecial));
    }
    const afterSpecial = t.slice(idx + specialMatch[0].length);
    clauses.push({
      type: 'special',
      text: afterSpecial.trim(),
      index: clauses.length,
    });
    return clauses;
  }

  return extractClausesFromBlock(t);
}

function extractClausesFromBlock(block) {
  const lines = block.split(/\n/);
  const clauses = [];
  let current = '';
  let currentType = 'article';
  let currentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const headerMatch = line.match(/^(제\d+조)\s*(.*)/);
    if (headerMatch) {
      if (current.trim()) {
        clauses.push({
          type: currentType,
          text: current.trim(),
          index: currentIndex++,
        });
      }
      current = line;
      currentType = 'article';
      continue;
    }

    const itemStartRe = /^(?:\d+[\.\)])\s+/;
    const circledRe = /^[①②③④⑤⑥⑦⑧⑨⑩]+\.\s*/;

    if (itemStartRe.test(line) || circledRe.test(line)) {
      if (current.trim()) {
        clauses.push({
          type: currentType,
          text: current.trim(),
          index: currentIndex++,
        });
      }
      current = line;
      currentType = 'item';
      continue;
    }

    if (line.trim() === '' && current.trim()) {
      clauses.push({
        type: currentType,
        text: current.trim(),
        index: currentIndex++,
      });
      current = '';
      currentType = 'article';
      continue;
    }

    current += (current ? '\n' : '') + line;
  }

  if (current.trim()) {
    clauses.push({
      type: currentType,
      text: current.trim(),
      index: currentIndex++,
    });
  }

  return clauses;
}

// ---------- 카테고리 매칭 ----------

function scoreClauseForCategory(clauseText, category) {
  const text = clauseText || '';
  let score = 0;
  let matchedPatterns = [];

  for (const pattern of category.patterns) {
    if (pattern.regex.test(text)) {
      score += pattern.strength;
      matchedPatterns.push({
        pattern: pattern.regex.source,
        strength: pattern.strength,
      });
    }
  }

  if (score === 0) return null;

  return { category, score, matchedPatterns };
}

function determineRiskLevel(score, category, clauseText) {
  let risk = category.defaultRisk;

  const hasHighStrength = category.patterns.some(
    (p) => p.strength >= 3 && p.regex.test(clauseText)
  );

  const strongContextRe = /(일방적으로|즉시\s*해지|언제든지.*보여줘야|사전\s*통보.*없이|반환\s*지연.*이자|면책|환불\s*불가|반환\s*불가|자연\s*마모|원상복구.*비용\s*전액)/i;
  const hasStrongContext = strongContextRe.test(clauseText);

  if (hasHighStrength || hasStrongContext) {
    if (category.id === 'restoration-over' || category.id === 'deposit-delay' || category.id === 'tenant-unfair-special') {
      risk = '상';
    } else if (category.id === 'penalty' || category.id === 'auto-renew' || category.id === 'unilateral-termination') {
      risk = hasStrongContext ? '상' : '중';
    } else {
      risk = hasStrongContext ? '상' : '중';
    }
  }

  if (score <= 1 && !hasStrongContext) {
    risk = '하';
  }

  return risk;
}

// ---------- 근거·체크포인트 생성 ----------

const REASONS = {
  penalty: {
    상: '환불·반환이 아예 불가능하거나, 중도 해지 시 과도한 위약금을 부담하게 하는 구조입니다. 약관의 규제에 관한 법률상 소비자에게 부당하게 불리한 조항은 무효로 볼 여지가 있고, 특히 환불이 원천 차단되면 실질적 금전 피해로 이어질 수 있습니다.',
    중: '중도 해지나 환불 시 일정 금액을 포기하게 하는 조항입니다. 업계 관행상 통용되는 수준일 수 있으나, 금액이 과도하거나 조건이 불공평하면 약관의 규제에 관한 법률상 문제 소지가 있습니다.',
    하: '위약금·환불 관련 언급이 있으나 부담이 크지 않거나 표준적인 수준으로 보입니다. 다만 구체적 금액과 조건을 확인해 보시는 것이 좋습니다.',
  },
  'auto-renew': {
    상: '별도 통보 없이 자동으로 연장되거나, 해지(옵트아웃) 절차가 매우 어렵게 설계되어 있습니다. 약관의 규제에 관한 법률상 소비자가 쉽게 해지할 수 있어야 한다는 취지에 반할 수 있고, 원치 않는 계약 지속으로 이어질 수 있습니다.',
    중: '자동연장 구조가 있으나 통보나 해지 절차가 어느 정도 마련되어 있을 수 있습니다. 연장 시점, 통보 방식, 해지 방법을 구체적으로 확인해 보시는 것이 좋습니다.',
    하: '자동연장·갱신 관련 언급이 있으나 부담이 크지 않은 수준입니다. 연장 조건과 해지 방법을 한 번 확인해 보세요.',
  },
  'privacy-third': {
    상: '개인정보 제3자 제공이나 마케팅 활용을 사실상 필수 동의처럼 강제하는 구조입니다. 정보주체의 동의는 자유롭게 선택할 수 있어야 한다는 점에서 약관법상 문제가 될 수 있고, 동의 거부 시 계약 자체가 어려워지면 부당합니다.',
    중: '제3자 제공·마케팅 동의 관련 조항이 있으나, 필수/선택 구분이 되어 있을 가능성도 있습니다. 동의 항목이 필수인지 선택인지, 거부 시 불이익이 있는지 확인해 보세요.',
    하: '개인정보·마케팅 동의 관련 언급이 있으나 부담이 크지 않은 수준입니다. 동의 항목과 범위를 한 번 확인해 보세요.',
  },
  'unilateral-termination': {
    상: '사업자(임대인)가 일방적으로 계약을 해지하거나 조건을 바꿀 수 있는 권한을 넓게 갖고 있습니다. 약관의 규제에 관한 법률상 신의성실 원칙에 반하고, 소비자에게 부당하게 불리한 조항은 무효 소지가 큽니다.',
    중: '사업자 측의 해지·변경 권한이 명시되어 있으나, 행사 조건이 어느 정도 정해져 있을 수 있습니다. 권한 행사 요건, 사전 통보 여부, 이의 제기 방법을 확인해 보세요.',
    하: '사업자 측의 권한 관련 언급이 있으나 부담이 크지 않은 수준입니다. 행사 조건과 제한 범위를 확인해 보세요.',
  },
  'dispute-court': {
    상: '분쟁 발생 시 관할법원이나 분쟁해결 절차가 소비자에게 크게 불리하게 정해져 있습니다. 특히 사업자 소재지 관할로 하면 소비자에게 실제와 먼 지역에서 소송해야 하는 부담이 생길 수 있습니다.',
    중: '관할법원·분쟁해결 조항이 있으나, 소비자 거주지 관할 선택 가능성 등 보완 여지가 있는지 확인해 보시는 것이 좋습니다.',
    하: '관할·분쟁해결 관련 언급이 있으나 부담이 크지 않은 수준입니다. 관할법원과 분쟁 절차를 한 번 확인해 보세요.',
  },
  'liability-limit': {
    상: '사업자의 손해배상 책임을 광범위하게 면제하거나 제한하는 조항입니다. 약관의 규제에 관한 법률상 사업자의 고의·중과실로 인한 손해까지 면책하는 조항은 무효로 볼 여지가 큽니다.',
    중: '손해배상 책임 제한·면제 조항이 있으나, 어디까지 제한되는지 범위를 확인해 볼 필요가 있습니다. 고의·중과실까지 포함하는지, 제한이 과도한지 살펴보세요.',
    하: '책임 제한 관련 언급이 있으나 부담이 크지 않은 수준입니다. 제한 범위와 예외 사항을 확인해 보세요.',
  },
  'restoration-over': {
    상: '정상적인 사용으로 인한 자연 마모까지 임차인이 원상복구하도록 하는 것은 과도한 부담입니다. 주택임대차보호법상 통상 기대되는 범위를 넘어서며, 계약 종료 시 분쟁의 주요 원인이 됩니다. 현관 바닥 자연 마모, 벽지 세월 흔적 등 일상적 마모를 임차인이 책임질 법적 의무는 일반적으로 없습니다.',
    중: '원상복구 의무가 언급되어 있으나, 범위를 구체화할 여지가 있는지 확인해 보세요. 임차인 과실 훼손과 자연 마모를 구분하는 문구가 있으면 분쟁 예방에 도움이 됩니다.',
    하: '원상복구 관련 언급이 있으나 부담이 크지 않은 수준입니다. 원상복구 범위와 기준을 확인해 보세요.',
  },
  'deposit-delay': {
    상: '보증금 반환 시기와 방법을 임대인이 일방적으로 정하고, 반환 지연에 대한 이자 책임까지 면제하는 것은 주택임대차보호법상 보증금 반환 의무를 사실상 무력화하는 조항입니다. 반환 일정이 지연되어도 임차인이 이자를 청구할 수 없게 되어 실질적 금전 피해로 이어질 수 있습니다. 약관법상 불공정 약관에 해당할 가능성이 높습니다.',
    중: '보증금 반환 일정·방법에 관한 조항이 있으나, 반환 기한을 특정하고 지연 시 이자 청구 가능 여부를 명시하도록 수정할 여지가 있는지 확인해 보세요.',
    하: '보증금 반환 관련 언급이 있으나 부담이 크지 않은 수준입니다. 반환 기한과 조건을 확인해 보세요.',
  },
  'sublease-ban': {
    상: '전대차·재임대가 전면 금지되고 위반 시 즉시 해지되는 구조입니다. 주거 이전 사정변화나 동거인 변동 등 불가피한 상황에서 대체 수단이 막힐 수 있어 주의가 필요합니다.',
    중: '전대·재임대가 제한되어 있으나, 임대인의 사전 동의 하에 가능한 예외가 있는지 확인해 보세요. 전면 금지인지, 동의 절차가 있는지 살펴보시면 좋습니다.',
    하: '전대·재임대 관련 언급이 있으나 부담이 크지 않은 수준입니다. 허용 범위와 절차를 확인해 보세요.',
  },
  'maintenance-unclear': {
    상: '관리비 항목이 불명확하거나, 임대인이 임의로 추가 청구할 수 있는 구조입니다. 임차인이 예상하지 못한 비용이 계속 발생할 수 있어 계약 전 항목을 명확히 해두는 것이 중요합니다.',
    중: '관리비 관련 조항이 있으나, 세부 항목과 산정 기준이 명확한지 확인해 보세요. 실비 정산 방식이라면 어떤 항목이 포함되는지 미리 물어보는 것이 좋습니다.',
    하: '관리비 관련 언급이 있으나 부담이 크지 않은 수준입니다. 관리비 항목과 산정 방식을 확인해 보세요.',
  },
  'tenant-unfair-special': {
    상: '임대인의 임의 방문이나 사전 통보 없는 방문을 강제하고, 거절 시 즉시 해지까지 가능하게 하는 등 임차인에게만 지나치게 불리한 특약입니다. 주택임대차보호법상 임차인은 계약 기간 중 해당 주택을 평온하게 사용할 권리가 있으며, 임대인의 무단 출입은 불법행위가 될 수 있습니다. 약관법상 소비자에게 부당하게 불리한 조항으로 무효 소지가 큽니다.',
    중: '임대인 방문·협조 관련 특약이 있으나, 방문 목적·사전 통보 기간·동의 요건 등을 구체화할 여지가 있는지 확인해 보세요. 중개 목적의 방문이라면 사전 일정 협의 절차를 넣는 것이 바람직합니다.',
    하: '임차인 협조 관련 특약이 있으나 부담이 크지 않은 수준입니다. 방문 절차와 동의 요건을 확인해 보세요.',
  },
};

function generateReason(risk, category, clauseText) {
  const riskReasons = REASONS[category.id];
  if (!riskReasons) {
    return '이 조항은 주의가 필요합니다. 좀 더 구체적인 내용을 확인해 보시는 것이 좋습니다.';
  }
  return (riskReasons[risk]) || riskReasons['중'] || '이 조항은 주의가 필요합니다. 좀 더 구체적인 내용을 확인해 보시는 것이 좋습니다.';
}

const CHECKPOINTS = {
  penalty: '위약금·환불불가 금액과 조건, 특히 중도 해지 시 실제 부담액을 구체적으로 확인해 보세요.',
  'auto-renew': '자동연장 시점, 연장 전 통보 여부, 해지(옵트아웃) 방법과 기간을 확인해 보세요.',
  'privacy-third': '제3자 제공·마케팅 동의가 필수인지 선택인지, 거부 시 불이익이 있는지 확인해 보세요.',
  'unilateral-termination': '사업자(임대인)의 해지·변경 권한 행사 요건, 사전 통보 여부, 이의 제기 방법을 확인해 보세요.',
  'dispute-court': '관할법원과 분쟁 해결 절차를 확인하고, 소비자 거주지 관할 선택 가능 여부가 있는지 살펴보세요.',
  'liability-limit': '배상 책임 제한 범위, 특히 고의·중과실까지 포함하는지 확인해 보세요.',
  'restoration-over': '"정상적인 사용 마모"와 "임차인 과실로 인한 훼손"을 명확히 구분하는 문구를 추가해 달라고 요청해 보세요.',
  'deposit-delay': '보증금 반환 기한을 특정(예: 해지 후 14일 이내)하고, 지연 시 연체 이자 청구 가능 여부를 명시하도록 요청해 보세요.',
  'sublease-ban': '전대·재임대 금지 범위와 예외(사전 동의 등)가 있는지 확인해 보세요.',
  'maintenance-unclear': '관리비 세부 항목과 산정 기준을 계약서에서 명확히 확인할 수 있는지, 추가 청구 사유가 무엇인지 물어보세요.',
  'tenant-unfair-special': '"임대인의 요청"이 언제, 어떤 이유로, 얼마나 자주 가능한지 구체화하도록 수정할 수 있는지 확인해 보세요. 방문 시 사전 통보 기간과 목적을 명시하는 것이 좋습니다.',
};

function generateCheckpoint(risk, category, clauseText) {
  return CHECKPOINTS[category.id] || '해당 조항의 구체적 조건과 예외 사항을 확인해 보시는 것이 좋습니다.';
}

// ---------- 종합 위험도 ----------

function calculateOverallRisk(detectedItems) {
  if (detectedItems.length === 0) return '하';

  let high = 0, mid = 0;
  for (const item of detectedItems) {
    if (item.risk === '상') high++;
    else if (item.risk === '중') mid++;
  }

  if (high >= 1) return '상';
  if (mid >= 1) return '중';
  return '하';
}

// ---------- 메인 분석 ----------

function analyze(text) {
  const trimmed = (text || '').trim();

  // 0단계: 유효성 판단
  if (!isMeaningfulText(trimmed)) {
    return {
      ok: false,
      errorType: 'empty',
      message: '분석할 계약서 또는 약관 텍스트를 입력해 주세요',
    };
  }

  if (!looksLikeContract(trimmed)) {
    return {
      ok: false,
      errorType: 'not-contract',
      message: '입력하신 내용은 계약서·약관으로 보이지 않습니다. 계약서나 약관 조항 텍스트를 붙여넣어 주세요.',
    };
  }

  if (trimmed.length < 80 && !/(제\d+조|특약\s*사항|보증금|월세|차임)/i.test(trimmed)) {
    return {
      ok: false,
      errorType: 'too-short',
      message: '입력된 내용이 너무 짧아 판단하기 어렵습니다. 계약서의 해당 조항 전체를 붙여넣어 주세요',
    };
  }

  // 조항 분할
  const clauses = splitIntoClauses(trimmed);
  const isLease = isLeaseContract(trimmed);
  const isPartial = clauses.length < 2;

  // 1단계: 독소조항 후보 탐지
  const detectedItems = [];

  for (const clause of clauses) {
    const clauseText = clause.text;

    for (const category of CATEGORIES) {
      if (category.leaseOnly && !isLease) continue;

      const scoring = scoreClauseForCategory(clauseText, category);
      if (!scoring) continue;

      const risk = determineRiskLevel(scoring.score, category, clauseText);

      // 위험도 "하" 항목은 별도 ⚠️ 로 나열하지 않음 (스킬 규칙)
      if (risk === '하') continue;

      const quote = clauseText.length > 120 ? clauseText.slice(0, 120) + '…' : clauseText;

      detectedItems.push({
        risk,
        category: category.label,
        quote,
        problem: generateReason(risk, category, clauseText),
        checkpoint: generateCheckpoint(risk, category, clauseText),
        clauseIndex: clause.index,
        clauseType: clause.type,
      });
    }
  }

  // 4단계: 입력 순서 보존 (clauseIndex 기준 정렬)
  detectedItems.sort((a, b) => a.clauseIndex - b.clauseIndex);

  // 종합 위험도
  const overallRisk = calculateOverallRisk(detectedItems);

  // 독소조항 없는 경우
  if (detectedItems.length === 0) {
    let extraNote = '';
    if (isLease) {
      extraNote = ' 그래도 일반적으로 확인하면 좋은 항목: ① 원상복구 범위가 "자연 마모"까지 포함하는지, ② 보증금 반환 기한과 지연 시 이자 청구 가능 여부를 확인해 보세요.';
    } else {
      extraNote = ' 그래도 일반적으로 확인하면 좋은 항목: ① 중도 해지·환불 조건이 명확히 적혀 있는지, ② 자동연장·해지 절차가 소비자에게 불리하지 않은지 확인해 보세요.';
    }

    return {
      ok: true,
      items: [],
      overallRisk: '하',
      note: '이 계약서/약관에서는 뚜렷한 독소조항이 발견되지 않았습니다.' + extraNote,
      isPartial: isPartial && clauses.length > 0,
      clauseCount: clauses.length,
    };
  }

  // 부분 제공 안내
  const partialNote = (isPartial || clauses.length < 3)
    ? '\n\n※ 일부 조항만 제공되어 전체 계약 맥락을 반영하지 못했을 수 있습니다.'
    : '';

  // 결과 출력 텍스트 (스킬 출력 형식 그대로)
  let outputText = '';
  for (const item of detectedItems) {
    outputText += `⚠️ [${item.risk}] ${item.category}\n`;
    outputText += `원문: "${item.quote}"\n`;
    outputText += `문제점: ${item.problem}\n`;
    outputText += `체크포인트: ${item.checkpoint}\n\n`;
  }

  outputText += `종합 위험도: ${overallRisk}${partialNote}\n\n`;
  outputText += '※ 본 분석은 법률 자문이 아니라 계약 서명 전 위험 인지를 돕기 위한 참고 정보입니다. 구체적인 법률 판단이 필요하시면 변호사 등 전문가의 상담을 받으시길 권해 드립니다.';

  return {
    ok: true,
    items: detectedItems,
    overallRisk,
    text: outputText,
    isPartial: isPartial || clauses.length < 3,
    clauseCount: clauses.length,
  };
}

module.exports = { analyze, CATEGORIES };
