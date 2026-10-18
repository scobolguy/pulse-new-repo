// Builders for the CCVS-guided coverage catalog. Each case is a complete, self-checking
// COBOL 85 program. Checks created with k(label, condition) DISPLAY "<id> <label>: PASS"
// or "...: FAIL", so the expected output is one PASS line per check, in program order.

export function ccvsCase(module, id, ccvs, description, build) {
  const labels = [];
  const k = (label, condition) => {
    labels.push(label);
    return [
      `IF ${condition}`,
      `    DISPLAY "${id} ${label}: PASS"`,
      'ELSE',
      `    DISPLAY "${id} ${label}: FAIL"`,
      'END-IF'
    ].join('\n');
  };
  const parts = build(k);
  const source = parts.source ?? assemble(id, parts);
  return {
    module,
    id,
    ccvs,
    description,
    source,
    format: parts.format ?? 'free',
    copybooks: parts.copybooks ?? null,
    input: parts.input ?? '',
    expected: parts.expected ?? labels.map(label => `${id} ${label}: PASS`)
  };
}

function assemble(id, parts) {
  return [
    'IDENTIFICATION DIVISION.',
    `PROGRAM-ID. ${id}.`,
    parts.environment ? `ENVIRONMENT DIVISION.\n${parts.environment}` : null,
    'DATA DIVISION.',
    parts.fileSection ? `FILE SECTION.\n${parts.fileSection}` : null,
    'WORKING-STORAGE SECTION.',
    parts.ws ?? '',
    'PROCEDURE DIVISION.',
    'MAIN-LINE.',
    parts.proc ?? '',
    'STOP RUN.',
    parts.paragraphs ?? null
  ].filter(line => line !== null).join('\n');
}

// Lays text out in reference format: sequence area (columns 1-6), indicator (column 7)
// and Areas A/B (columns 8-72). Lines beginning with "D " or "* " use that indicator.
export function fixedFormat(text) {
  return text.split('\n').map((line, index) => {
    const sequence = String((index + 1) * 10).padStart(6, '0');
    const match = line.match(/^([D*/-]) (.*)$/);
    const indicator = match ? match[1] : ' ';
    const code = match ? match[2] : line;
    if (code.length > 65) throw new Error(`Fixed-format line exceeds column 72: ${code}`);
    return `${sequence}${indicator}${code}`;
  }).join('\n');
}

// Indents every line of a block so k() output sits in Area B of a fixed-format program.
export const areaB = (block, spaces = 4) => block.split('\n').map(line => `${' '.repeat(spaces)}${line}`).join('\n');
