import { readJson, sendJson } from './lib/http.js';

const MAX_IMAGE_BYTES = 3_500_000;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary', 'keyLevels', 'timeframeAnalysis',
    'primaryScenario', 'alternativeScenario', 'warnings', 'preTradeChecklist'
  ],
  properties: {
    summary: {
      type: 'object',
      additionalProperties: false,
      required: ['asset', 'detectedTimeframe', 'marketStructure', 'bias', 'confidence', 'context'],
      properties: {
        asset: { type: 'string' },
        detectedTimeframe: { type: 'string' },
        marketStructure: { type: 'string' },
        bias: { type: 'string', enum: ['long', 'short', 'neutral'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        context: { type: 'string' }
      }
    },
    keyLevels: {
      type: 'object',
      additionalProperties: false,
      required: ['supports', 'resistances'],
      properties: {
        supports: { type: 'array', items: { type: 'string' } },
        resistances: { type: 'array', items: { type: 'string' } }
      }
    },
    timeframeAnalysis: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'timeframe', 'direction', 'setup', 'entryZone', 'entryPrice',
          'stopLoss', 'takeProfit1', 'takeProfit2', 'takeProfit3',
          'riskReward', 'invalidation', 'notes'
        ],
        properties: {
          timeframe: { type: 'string' },
          direction: { type: 'string', enum: ['Achat', 'Vente', 'Attendre'] },
          setup: { type: 'string' },
          entryZone: { type: 'string' },
          entryPrice: { type: 'string' },
          stopLoss: { type: 'string' },
          takeProfit1: { type: 'string' },
          takeProfit2: { type: 'string' },
          takeProfit3: { type: 'string' },
          riskReward: { type: 'string' },
          invalidation: { type: 'string' },
          notes: { type: 'string' }
        }
      }
    },
    primaryScenario: { type: 'string' },
    alternativeScenario: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
    preTradeChecklist: { type: 'array', items: { type: 'string' } }
  }
};

function buildPrompt(body) {
  const asset = body.asset || 'non précisé';
  const market = body.market || 'non précisé';
  const strategy = body.strategy || 'non précisée';
  const notes = body.notes || '';
  const timeframes = Array.isArray(body.timeframes) && body.timeframes.length
    ? body.timeframes.join(', ')
    : 'M5, M15, H1, H4, Daily';

  return `Analyse cette capture d'écran de graphique de trading.

Contexte fourni par le trader :
- Actif : ${asset}
- Marché : ${market}
- Stratégie habituelle : ${strategy}
- Notes : ${notes || 'aucune'}
- Timeframes à analyser : ${timeframes}

Instructions :
1. Identifie l'actif, le timeframe visible sur la capture, la structure de marché (tendance, range, compression).
2. Repère les niveaux clés visibles (supports, résistances, zones de liquidité, OB/FVG si visibles).
3. Pour CHAQUE timeframe demandé (${timeframes}), propose un plan de trade concret :
   - direction (Achat / Vente / Attendre si setup pas prêt)
   - type de setup (breakout, pullback, range, reversal…)
   - zone d'entrée et prix d'entrée précis si lisible sur le graphique
   - stop loss et 3 take profits
   - ratio risque/récompense estimé
   - condition d'invalidation du scénario
4. Donne un scénario principal et un scénario alternatif.
5. Liste les risques et pièges (news, spread, fausse cassure, manque de confluence…).
6. Propose une checklist courte avant d'entrer en position.

Règles :
- Réponds en français.
- Si un prix n'est pas lisible sur la capture, indique une zone approximative ou « non lisible ».
- Sois prudent : précise le niveau de confiance (high/medium/low).
- bias : long (haussier), short (baissier), neutral (pas de biais clair).
- direction par timeframe : utilise « Attendre » si le setup n'est pas valide sur ce TF.
- Ce n'est pas un conseil financier : reste factuel et pédagogique.`;
}

function extractImageDataUrl(body) {
  const raw = String(body.image || '').trim();
  if (!raw) return { error: 'Image requise (capture PNG/JPG en base64)' };
  if (!raw.startsWith('data:image/')) return { error: 'Format d\'image invalide' };
  const base64 = raw.split(',')[1] || '';
  if (!base64) return { error: 'Image vide ou corrompue' };
  const approxBytes = Math.ceil((base64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return { error: 'Image trop volumineuse (max ~3 Mo). Réduisez la capture.' };
  }
  return { dataUrl: raw };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, {
      error: 'Analyseur non configuré',
      hint: 'Ajoutez OPENAI_API_KEY dans les variables d’environnement Vercel, puis redéployez.'
    });
  }

  try {
    const body = await readJson(req);
    const imageResult = extractImageDataUrl(body);
    if (imageResult.error) {
      return sendJson(res, 400, { error: imageResult.error });
    }
    const imageUrl = imageResult.dataUrl;

    const prompt = buildPrompt(body);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.35,
        max_tokens: 4096,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'trade_analysis',
            strict: true,
            schema: ANALYSIS_SCHEMA
          }
        },
        messages: [
          {
            role: 'system',
            content: 'Tu es un analyste technique senior et trader discipliné. Tu analyses des captures de graphiques (TradingView, MT4/5, etc.) et produis des plans de trade structurés par timeframe. Tu ne garantis jamais un résultat — tu aides à la prise de décision.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
            ]
          }
        ]
      })
    });

    const openaiData = await openaiRes.json().catch(() => ({}));

    if (!openaiRes.ok) {
      const msg = openaiData?.error?.message || `Erreur OpenAI (${openaiRes.status})`;
      console.error('OpenAI error:', msg);
      return sendJson(res, 502, { error: 'Analyse impossible', detail: msg });
    }

    const content = openaiData?.choices?.[0]?.message?.content;
    if (!content) {
      return sendJson(res, 502, { error: 'Réponse vide du modèle d’analyse' });
    }

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      return sendJson(res, 502, { error: 'Format de réponse invalide' });
    }

    return sendJson(res, 200, {
      ok: true,
      analysis,
      model: MODEL,
      analyzedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Erreur serveur' });
  }
}
