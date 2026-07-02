import fs from 'fs/promises';
import path from 'path';
import XLSX from 'xlsx';

const ROOT = path.resolve('.');
const OUT_DIR = path.join(ROOT, 'data', 'cbds');
const MAP_ID = 'cbds-mt103-to-pacs008';

const cbdsRules = [
  {
    cbdsRuleRef: 'CBDS-MT103-20',
    mtField: '20',
    sourcePath: 'finEnvelope.block4.fields.20',
    targetPath: 'Document.FIToFICstmrCdtTrf.GrpHdr.MsgId',
    conversionRule: 'output := trim(src);',
    notes: 'Sender reference to group header message id.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-20-INSTR',
    mtField: '20',
    sourcePath: 'finEnvelope.block4.fields.20',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId',
    conversionRule: 'output := trim(src);',
    notes: 'Instruction id aligned with sender reference.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-21',
    mtField: '21',
    sourcePath: 'finEnvelope.block4.fields.21',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId',
    conversionRule: 'output := trim(src);',
    notes: 'Related reference to end-to-end id.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-23B',
    mtField: '23B',
    sourcePath: 'finEnvelope.block4.fields.23B',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtTpInf.LclInstrm.Prtry',
    conversionRule: 'output := upper(trim(src));',
    notes: 'Bank operation code to local instrument proprietary code.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-32A-DATE',
    mtField: '32A',
    sourcePath: 'finEnvelope.block4.fields.32A.components.valueDate',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt',
    conversionRule: 'output := yymmddtoiso(src);',
    notes: 'YYMMDD value date to ISO date.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-32A-CCY',
    mtField: '32A',
    sourcePath: 'finEnvelope.block4.fields.32A.components.currency',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy',
    conversionRule: 'output := upper(trim(src));',
    notes: 'Interbank settlement currency.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-32A-AMT',
    mtField: '32A',
    sourcePath: 'finEnvelope.block4.fields.32A.components.amount',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text',
    conversionRule: 'output := mtamounttodecimal(src);',
    notes: 'Interbank settlement amount to decimal dot format.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-33B-CCY',
    mtField: '33B',
    sourcePath: 'finEnvelope.block4.fields.33B.components.currency',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.@Ccy',
    conversionRule: 'output := upper(trim(src));',
    notes: 'Instructed amount currency.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-33B-AMT',
    mtField: '33B',
    sourcePath: 'finEnvelope.block4.fields.33B.components.amount',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.#text',
    conversionRule: 'output := mtamounttodecimal(src);',
    notes: 'Instructed amount value.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-50K',
    mtField: '50K',
    sourcePath: 'finEnvelope.block4.fields.50K',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm',
    conversionRule: 'output := mtpartyname(src);',
    notes: 'Ordering customer name extraction.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-52A',
    mtField: '52A',
    sourcePath: 'finEnvelope.block4.fields.52A',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI',
    conversionRule: 'output := upper(trim(src));',
    notes: 'Ordering institution BIC.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-53A',
    mtField: '53A',
    sourcePath: 'finEnvelope.block4.fields.53A',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt1.FinInstnId.BICFI',
    conversionRule: 'output := upper(trim(src));',
    notes: 'Sender correspondent BIC.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-56A',
    mtField: '56A',
    sourcePath: 'finEnvelope.block4.fields.56A',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt2.FinInstnId.BICFI',
    conversionRule: 'output := upper(trim(src));',
    notes: 'Intermediary institution BIC.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-57A',
    mtField: '57A',
    sourcePath: 'finEnvelope.block4.fields.57A',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI',
    conversionRule: 'output := upper(trim(src));',
    notes: 'Account with institution BIC.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-59',
    mtField: '59',
    sourcePath: 'finEnvelope.block4.fields.59',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm',
    conversionRule: 'output := mtpartyname(src);',
    notes: 'Beneficiary customer name extraction.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-70',
    mtField: '70',
    sourcePath: 'finEnvelope.block4.fields.70',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd',
    conversionRule: 'output := trim(src);',
    notes: 'Remittance information.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-71A',
    mtField: '71A',
    sourcePath: 'finEnvelope.block4.fields.71A',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr',
    conversionRule: 'output := mtchargebearertoiso(src);',
    notes: 'Charge bearer code normalization (OUR->DEBT, BEN->CRED, SHA->SHA).'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-71B',
    mtField: '71B',
    sourcePath: 'finEnvelope.block4.fields.71B',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgsInf.Amt.#text',
    conversionRule: 'output := mtamounttodecimal(src);',
    notes: 'Sender charges amount.'
  },
  {
    cbdsRuleRef: 'CBDS-MT103-72',
    mtField: '72',
    sourcePath: 'finEnvelope.block4.fields.72',
    targetPath: 'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstrForNxtAgt.InstrInf',
    conversionRule: 'output := trim(src);',
    notes: 'Sender to receiver information.'
  },
  {
    cbdsRuleRef: 'CBDS-SYSTEM-CREDTTM',
    mtField: 'SYSTEM',
    sourcePath: 'finEnvelope.meta.createdAt',
    targetPath: 'Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm',
    conversionRule: 'output := trim(src);',
    notes: 'Transformation timestamp into PACS group header creation time.'
  }
];

function buildMapperDsl(rules) {
  const lines = [];
  lines.push('SERVICE "cbds-transform-service";');
  lines.push('');
  lines.push('MAPPER "cbds-mt103-to-pacs008" SOURCE "swift-mt103" TARGET "pacs" DESCRIPTION "CBDS MT103 to PACS.008 transformation" ENABLED TRUE BEGIN');
  for (const rule of rules) {
    lines.push(`  MAP "${rule.sourcePath}" TO "${rule.targetPath}" USING "${rule.conversionRule.replaceAll('"', '\\"')}";`);
  }
  lines.push('END;');
  lines.push('');
  return lines.join('\n');
}

function getByPath(source, dottedPath) {
  const parts = String(dottedPath || '').split('.').map((part) => part.trim()).filter(Boolean);
  let cursor = source;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const metadataRows = [
    ['key', 'value'],
    ['artifactId', MAP_ID],
    ['description', 'CBDS MT103 to PACS.008 mapping workbook'],
    ['sourceTypeId', 'swift-mt103'],
    ['targetTypeId', 'pacs'],
    ['targetSchemaPath', 'schemas/pacs.008.001.14.xsd'],
    ['generatedAt', new Date().toISOString()],
    ['ruleCount', cbdsRules.length],
    ['assumption', 'CBDS alignment based on repository canonical MT103->PACS rule set']
  ];

  const ruleRows = [
    ['RuleRef', 'MTField', 'SourcePath', 'TargetPath', 'ConversionRule', 'Notes']
  ];
  for (const rule of cbdsRules) {
    ruleRows.push([
      rule.cbdsRuleRef,
      rule.mtField,
      rule.sourcePath,
      rule.targetPath,
      rule.conversionRule,
      rule.notes
    ]);
  }

  const sampleMtRows = [
    ['SampleMT103'],
    ['MT103'],
    [':20:CBDSREF123456'],
    [':21:CBDS-E2E-0001'],
    [':23B:CRED'],
    [':32A:260702CAD12500,45'],
    [':33B:CAD12500,45'],
    [':50K:/123456789'],
    ['ALPHA IMPORTS LTD'],
    [':52A:ROYCCAT2'],
    [':53A:BOFACATT'],
    [':56A:CITIUS33'],
    [':57A:TDOMCATTTOR'],
    [':59:/000987654321'],
    ['BETA SUPPLIES INC'],
    [':70:INV-2026-07-02'],
    [':71A:SHA'],
    [':71B:15,00'],
    [':72:/INS/CBDS ROUTING']
  ];

  const outputJsonPath = path.join(OUT_DIR, 'cbds-mt103-to-pacs008-output.json');
  const outputXmlPath = path.join(OUT_DIR, 'cbds-mt103-to-pacs008-output.xml');

  let transformed = null;
  let transformedXml = '';
  try {
    transformed = JSON.parse(await fs.readFile(outputJsonPath, 'utf-8'));
  } catch {
    transformed = null;
  }
  try {
    transformedXml = await fs.readFile(outputXmlPath, 'utf-8');
  } catch {
    transformedXml = '';
  }

  const transformedRows = [
    ['Section', 'Path', 'Value']
  ];

  if (transformed) {
    const keyPaths = [
      'Document.FIToFICstmrCdtTrf.GrpHdr.MsgId',
      'Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.@Ccy',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.#text',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd',
      'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstrForNxtAgt.InstrInf'
    ];

    for (const keyPath of keyPaths) {
      transformedRows.push(['Field', keyPath, String(getByPath(transformed, keyPath) ?? '')]);
    }
  } else {
    transformedRows.push(['Info', 'output-json', 'Run scripts/test-cbds-mt103-to-pacs.mjs to generate output.json first']);
  }

  transformedRows.push(['', '', '']);
  transformedRows.push(['XML', 'full-document', transformedXml || 'No XML output found. Run test script first.']);

  const pcodeProofDir = path.join(OUT_DIR, 'pcode-proof');
  const pcodeSummaryPath = path.join(pcodeProofDir, 'cbds-pcode-proof-summary.json');
  const pcodeRunResultPath = path.join(pcodeProofDir, 'cbds-pcode-run-result.json');
  const pcodeXmlPath = path.join(pcodeProofDir, 'cbds-pcode-transformed-pacs.xml');

  let pcodeSummary = null;
  let pcodeRunResult = null;
  let pcodeXml = '';

  try {
    pcodeSummary = JSON.parse(await fs.readFile(pcodeSummaryPath, 'utf-8'));
  } catch {
    pcodeSummary = null;
  }

  try {
    pcodeRunResult = JSON.parse(await fs.readFile(pcodeRunResultPath, 'utf-8'));
  } catch {
    pcodeRunResult = null;
  }

  try {
    pcodeXml = await fs.readFile(pcodeXmlPath, 'utf-8');
  } catch {
    pcodeXml = '';
  }

  const pcodeRows = [
    ['Section', 'Path', 'Value']
  ];

  if (pcodeSummary) {
    pcodeRows.push(['Proof', 'proof', String(pcodeSummary.proof || '')]);
    pcodeRows.push(['Proof', 'compileMode', String(pcodeSummary.compileMode || '')]);
    pcodeRows.push(['Proof', 'assertions', String(pcodeSummary.assertions || '')]);
    pcodeRows.push(['Proof', 'pcodePath', String(pcodeSummary.pcodePath || '')]);
    pcodeRows.push(['Proof', 'programMapPath', String(pcodeSummary.programMapPath || '')]);
  } else {
    pcodeRows.push(['Info', 'summary', 'Run scripts/prove-cbds-via-pcode.mjs to generate pcode proof artifacts']);
  }

  if (pcodeRunResult) {
    pcodeRows.push(['Runtime', 'runtime', String(pcodeRunResult.runtime || '')]);
    pcodeRows.push(['Runtime', 'inputQueue', String(pcodeRunResult.inputQueue || '')]);
    pcodeRows.push(['Runtime', 'publishedCount', String(pcodeRunResult.publishedCount || '0')]);
    pcodeRows.push(['Runtime', 'error', String(pcodeRunResult.error || '')]);

    const firstDelivery = Array.isArray(pcodeRunResult.deliveries) ? pcodeRunResult.deliveries[0] : null;
    pcodeRows.push(['Runtime', 'firstDelivery.queueName', String(firstDelivery?.queueName || '')]);

    let pcodeDoc = null;
    if (firstDelivery?.message) {
      try {
        const parsedMsg = JSON.parse(String(firstDelivery.message));
        pcodeDoc = parsedMsg;
      } catch {
        pcodeDoc = null;
      }
    }

    if (pcodeDoc) {
      const proofPaths = [
        'Document.FIToFICstmrCdtTrf.GrpHdr.MsgId',
        'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId',
        'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt',
        'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy',
        'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text',
        'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm',
        'Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr'
      ];

      for (const keyPath of proofPaths) {
        pcodeRows.push(['PcodeField', keyPath, String(getByPath(pcodeDoc, keyPath) ?? '')]);
      }
    }
  }

  pcodeRows.push(['', '', '']);
  pcodeRows.push(['XML', 'pcode-full-document', pcodeXml || 'No pcode XML output found. Run prove-cbds-via-pcode first.']);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(metadataRows), 'Metadata');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(ruleRows), 'Rules');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sampleMtRows), 'SampleMT103');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(transformedRows), 'TransformedMessage');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(pcodeRows), 'PcodeProof');

  const xlsxPath = path.join(OUT_DIR, 'cbds-mt103-to-pacs008-mapper.xlsx');
  XLSX.writeFile(workbook, xlsxPath);

  const mapPayload = {
    id: MAP_ID,
    name: 'CBDS MT103 to PACS008',
    description: 'CBDS-aligned MT103 to PACS.008 mapping artifact',
    sourceTypeId: 'swift-mt103',
    targetTypeId: 'pacs',
    sourceSchemaPath: 'schemas/swift-mt103.json',
    targetSchemaPath: 'schemas/pacs.008.001.14.xsd',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: cbdsRules.map((rule, index) => ({
      id: `cbds_rule_${String(index + 1).padStart(2, '0')}`,
      sourcePath: rule.sourcePath,
      targetPath: rule.targetPath,
      kind: 'leaf',
      sourceValueType: 'string',
      targetValueType: 'string',
      conversionRule: rule.conversionRule,
      cbdsRuleRef: rule.cbdsRuleRef,
      notes: rule.notes
    })),
    submaps: []
  };

  const jsonPath = path.join(OUT_DIR, 'cbds-mt103-to-pacs008.map.json');
  await fs.writeFile(jsonPath, `${JSON.stringify(mapPayload, null, 2)}\n`, 'utf-8');

  const dslPath = path.join(OUT_DIR, 'cbds-mt103-to-pacs008.mapper.pas');
  await fs.writeFile(dslPath, `${buildMapperDsl(cbdsRules)}\n`, 'utf-8');

  console.log('Generated artifacts:');
  console.log(`- ${xlsxPath}`);
  console.log(`- ${jsonPath}`);
  console.log(`- ${dslPath}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
