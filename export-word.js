/**
 * Export du journal de trading au format Word (.docx)
 * Utilise la bibliothèque docx via CDN
 */

const DOCX_URL = 'https://esm.sh/docx@8.5.0?bundle';

function base64ToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getImageType(dataUrl) {
  const mime = (dataUrl.match(/data:([^;]+)/) || [])[1] || 'image/png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('bmp')) return 'bmp';
  return 'png';
}

function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 600, height: 400 });
    img.src = dataUrl;
  });
}

function scaleImage(width, height, maxWidth = 480) {
  if (width <= maxWidth) return { width, height };
  const ratio = maxWidth / width;
  return { width: maxWidth, height: Math.round(height * ratio) };
}

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const cj = () => window.TradingJournalCurrency;
const formatMoney = (n) => cj().formatMoney(n);
const formatMoneyUnsigned = (n) => cj().formatMoneyUnsigned(n);
const withCurrency = (n) => cj().withCurrency(n);

function calcActualRR(resultAmount, riskAmount) {
  if (!resultAmount || !riskAmount || parseFloat(riskAmount) === 0) return '—';
  return (parseFloat(resultAmount) / parseFloat(riskAmount)).toFixed(2);
}

function computeKPIs(trades, startingCapital) {
  const total = trades.length;
  const winners = trades.filter((t) => parseFloat(t.resultAmount) > 0);
  const losers = trades.filter((t) => parseFloat(t.resultAmount) < 0);
  const totalGains = winners.reduce((s, t) => s + parseFloat(t.resultAmount), 0);
  const totalLosses = Math.abs(losers.reduce((s, t) => s + parseFloat(t.resultAmount), 0));
  const net = totalGains - totalLosses;
  const winRate = total ? ((winners.length / total) * 100).toFixed(1) : '0.0';
  const avgWin = winners.length ? (totalGains / winners.length).toFixed(2) : '0.00';
  const avgLoss = losers.length ? (totalLosses / losers.length).toFixed(2) : '0.00';
  const profitFactor = totalLosses > 0 ? (totalGains / totalLosses).toFixed(2) : totalGains > 0 ? '∞' : '0.00';
  const planRespected = trades.filter((t) => t.planRespected === 'Oui').length;
  const planRate = total ? ((planRespected / total) * 100).toFixed(1) : '0.0';

  let running = parseFloat(startingCapital) || 0;
  let peak = running;
  let maxDD = 0;
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach((t) => {
    running += parseFloat(t.resultAmount) || 0;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  });

  return { total, winners: winners.length, losers: losers.length, winRate, net, avgWin, avgLoss, profitFactor, planRate, maxDD, totalGains, totalLosses };
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function val(v) {
  return v !== null && v !== undefined && v !== '' ? String(v) : '—';
}

function buildInfoTable(docx, rows) {
  const { Table, TableRow, TableCell, WidthType, Paragraph, TextRun } = docx;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: val(value) })] })],
          }),
        ],
      })
    ),
  });
}

async function buildImageParagraph(docx, dataUrl, title) {
  const { ImageRun, Paragraph, TextRun, AlignmentType } = docx;
  const items = [];
  items.push(new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: title, bold: true, size: 22 })],
  }));

  if (!dataUrl) {
    items.push(new Paragraph({
      children: [new TextRun({ text: 'Aucune capture disponible', italics: true, color: '888888' })],
    }));
    return items;
  }

  try {
    const dims = await getImageDimensions(dataUrl);
    const scaled = scaleImage(dims.width, dims.height);
    items.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: base64ToUint8Array(dataUrl),
          transformation: { width: scaled.width, height: scaled.height },
          type: getImageType(dataUrl),
        }),
      ],
    }));
  } catch {
    items.push(new Paragraph({
      children: [new TextRun({ text: 'Image non disponible', italics: true, color: '888888' })],
    }));
  }
  return items;
}

async function buildTradeSection(docx, trade, index) {
  const { Paragraph, TextRun, HeadingLevel, PageBreak } = docx;

  const children = [];

  children.push(new Paragraph({
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text: `TRADE N°${index + 1} — ${val(trade.asset)} (${formatDate(trade.date)})`, bold: true, size: 28, color: '1E40AF' })],
  }));

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { after: 120 },
    children: [new TextRun('1. Informations générales du trade')],
  }));

  children.push(buildInfoTable(docx, [
    ['Date du trade', formatDate(trade.date)],
    ['Actif tradé', trade.asset],
    ['Sens', trade.direction],
    ["Prix d'entrée", trade.entryPrice],
    ['Stop Loss', trade.stopLoss],
    ['Objectif / Take Profit', trade.takeProfit],
    ['Taille de position', trade.positionSize],
    ['Risque en $', trade.riskAmount ? withCurrency(trade.riskAmount) : ''],
    ['Résultat du trade', trade.resultType],
    ['Montant du résultat', formatMoney(trade.resultAmount)],
    ['Ratio R/R prévu', trade.plannedRR],
    ['Ratio R/R réalisé', trade.actualRR || calcActualRR(trade.resultAmount, trade.riskAmount)],
    ['R Multiple', calcActualRR(trade.resultAmount, trade.riskAmount)],
  ]));

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun('2. Plan de trade')],
  }));

  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: "Raison de l'entrée : ", bold: true }),
      new TextRun({ text: val(trade.entryReason) }),
    ],
  }));

  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: 'Conditions de marché : ', bold: true }),
      new TextRun({ text: (trade.marketConditions || []).join(', ') || '—' }),
    ],
  }));

  children.push(new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({ text: 'Timeframe utilisé : ', bold: true }),
      new TextRun({ text: (trade.timeframes || []).join(', ') || '—' }),
    ],
  }));

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { after: 120 },
    children: [new TextRun('3. Gestion émotionnelle')],
  }));

  children.push(buildInfoTable(docx, [
    ["État émotionnel avant l'entrée", trade.emotionBefore],
    ['État émotionnel pendant le trade', trade.emotionDuring],
    ['État émotionnel après le trade', trade.emotionAfter],
  ]));

  if (trade.emotionComments) {
    children.push(new Paragraph({
      spacing: { before: 80, after: 120 },
      children: [
        new TextRun({ text: 'Commentaires émotionnels : ', bold: true }),
        new TextRun({ text: trade.emotionComments }),
      ],
    }));
  }

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { after: 120 },
    children: [new TextRun('4. Erreurs et discipline')],
  }));

  children.push(buildInfoTable(docx, [
    ['Plan de trading respecté ?', trade.planRespected],
    ['Erreurs commises', (trade.errors || []).join(', ') || 'Aucune'],
  ]));

  if (trade.errorDescription) {
    children.push(new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({ text: 'Description des erreurs : ', bold: true }),
        new TextRun({ text: trade.errorDescription }),
      ],
    }));
  }

  if (trade.lessonLearned) {
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'Leçon à retenir : ', bold: true }),
        new TextRun({ text: trade.lessonLearned, italics: true }),
      ],
    }));
  }

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { after: 120 },
    children: [new TextRun('5. Captures avant / après')],
  }));

  const beforeItems = await buildImageParagraph(docx, trade.screenshotBefore, 'Capture avant le trade');
  const afterItems = await buildImageParagraph(docx, trade.screenshotAfter, 'Capture après le trade');
  children.push(...beforeItems, ...afterItems);

  children.push(new Paragraph({ children: [new PageBreak()] }));

  return children;
}

async function buildDocument(journalData, options = {}) {
  const docx = await import(DOCX_URL);
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, AlignmentType,
    Header, Footer, PageNumber, PageBreak,
  } = docx;

  const { profile, trades, weeklyNotes, personalNotes } = journalData;
  const sortedTrades = options.singleTradeId
    ? trades.filter((t) => t.id === options.singleTradeId)
    : [...trades].sort((a, b) => b.date.localeCompare(a.date));

  const kpi = computeKPIs(trades, profile.startingCapital);
  const exportDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const children = [];

  // ── Page de garde ──
  children.push(new Paragraph({ spacing: { before: 600 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'JOURNAL DE TRADING PROFESSIONNEL', bold: true, size: 40, color: '1E40AF' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 400 },
    children: [new TextRun({ text: `Exporté le ${exportDate}`, size: 22, color: '666666' })],
  }));

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
    children: [new TextRun('Profil du trader')],
  }));

  children.push(buildInfoTable(docx, [
    ['Nom du trader', profile.traderName],
    ['Marché principal', profile.mainMarket],
    ['Stratégie utilisée', profile.strategy],
    ['Capital de départ', profile.startingCapital ? formatMoneyUnsigned(profile.startingCapital) : ''],
    ['Risque maximum par trade', profile.maxRisk ? `${profile.maxRisk} %` : ''],
  ]));

  if (!options.singleTradeId) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun('Tableau KPI — Synthèse globale')],
    }));

    children.push(buildInfoTable(docx, [
      ['Total trades', kpi.total],
      ['Trades gagnants', kpi.winners],
      ['Trades perdants', kpi.losers],
      ['Taux de réussite', `${kpi.winRate} %`],
      ['Gain moyen', formatMoneyUnsigned(kpi.avgWin)],
      ['Perte moyenne', formatMoneyUnsigned(kpi.avgLoss)],
      ['Profit Factor', kpi.profitFactor],
      ['Résultat net', formatMoney(kpi.net)],
      ['Drawdown maximum', formatMoneyUnsigned(kpi.maxDD)],
      ['Respect du plan', `${kpi.planRate} %`],
    ]));

    // Tableau récapitulatif
    if (trades.length > 0) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [new TextRun('Suivi des trades — Vue d\'ensemble')],
      }));

      const headerRow = new TableRow({
        tableHeader: true,
        children: ['Date', 'Actif', 'Sens', 'Résultat $', 'R Multiple', 'Plan'].map((h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })],
          })
        ),
      });

      const dataRows = [...trades]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) =>
          new TableRow({
            children: [
              formatDate(t.date), t.asset, t.direction,
              formatMoney(t.resultAmount),
              calcActualRR(t.resultAmount, t.riskAmount),
              t.planRespected || '—',
            ].map((cell) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: val(cell), size: 18 })] })],
              })
            ),
          })
        );

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows],
      }));

      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // Analyses hebdomadaires
    const weekKeys = Object.keys(weeklyNotes || {}).sort().reverse();
    if (weekKeys.length > 0) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
        children: [new TextRun('Analyses hebdomadaires')],
      }));

      weekKeys.forEach((key) => {
        const notes = weeklyNotes[key];
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 120 },
          children: [new TextRun(`Semaine du ${formatDate(key)}`)],
        }));
        [
          ['Ce qui a bien fonctionné', notes.good],
          ['Ce qui doit être amélioré', notes.improve],
          ['Erreurs récurrentes', notes.errors],
          ['Objectif semaine prochaine', notes.goal],
        ].forEach(([label, text]) => {
          if (text) {
            children.push(new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({ text: `${label} : `, bold: true }),
                new TextRun({ text }),
              ],
            }));
          }
        });
      });

      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    if (personalNotes) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
        children: [new TextRun('Notes personnelles')],
      }));
      children.push(new Paragraph({ children: [new TextRun(personalNotes)] }));
    }

    const checklistItems = [
      'Le trade respecte ma stratégie.',
      'Le risque est défini avant l\'entrée.',
      'Le Stop Loss est placé à un niveau logique.',
      'L\'objectif est réaliste.',
      'Le ratio risque/rendement est acceptable.',
      'Je ne suis pas en train de trader sous l\'émotion.',
      'Je n\'augmente pas la taille de position pour me refaire.',
      'J\'accepte la perte potentielle avant d\'entrer.',
    ];
    if (journalData.checklist) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [new TextRun('Checklist pré-trade')],
      }));
      checklistItems.forEach((item, i) => {
        const checked = journalData.checklist[i] ? '☑' : '☐';
        children.push(new Paragraph({
          children: [new TextRun({ text: `${checked}  ${item}` })],
        }));
      });
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [new TextRun('Détail des trades')],
    }));
  }

  // ── Chaque trade ──
  for (let i = 0; i < sortedTrades.length; i++) {
    const tradeChildren = await buildTradeSection(docx, sortedTrades[i], i);
    children.push(...tradeChildren);
  }

  if (sortedTrades.length === 0) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'Aucun trade enregistré.', italics: true })],
    }));
  }

  const traderName = profile.traderName || 'Trader';
  const doc = new Document({
    creator: 'Journal de Trading Professionnel',
    title: options.singleTradeId
      ? `Trade ${sortedTrades[0]?.asset || ''} — ${traderName}`
      : `Journal de Trading — ${traderName}`,
    description: 'Export du journal de trading professionnel',
    sections: [{
      properties: {
        page: {
          margin: { top: 1200, right: 1000, bottom: 1200, left: 1000 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `Journal de Trading — ${traderName}`, size: 16, color: '888888' })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', size: 16, color: '888888' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' }),
              new TextRun({ text: ' / ', size: 16, color: '888888' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '888888' }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}

async function exportJournalToWord(journalData, options = {}) {
  const blob = await buildDocument(journalData, options);
  const date = new Date().toISOString().slice(0, 10);
  const name = journalData.profile?.traderName
    ? journalData.profile.traderName.replace(/\s+/g, '-').toLowerCase()
    : 'journal';
  const filename = options.singleTradeId
    ? `trade-${name}-${date}.docx`
    : `journal-trading-${name}-${date}.docx`;
  downloadBlob(blob, filename);
}

window.TradingJournalExport = {
  exportAllToWord: (journalData) => exportJournalToWord(journalData),
  exportSingleTradeToWord: (journalData, tradeId) => exportJournalToWord(journalData, { singleTradeId: tradeId }),
};
