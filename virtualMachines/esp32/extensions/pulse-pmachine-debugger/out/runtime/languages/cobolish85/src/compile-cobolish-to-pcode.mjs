import Cobolish85Visitor from '../grammar/generated/Cobolish85Visitor.js';
import { parseCobolishWithAntlr } from './cobolish-antlr-compiler.mjs';
import { parsePicture } from './cobol-picture.mjs';
import { preprocessCobolText } from './cobol-text-preprocessor.mjs';
import { assertSupportedFeatures } from './unsupported-features.mjs';
import { buildPcodeSourceMap } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-source-map.mjs';
import { linkPcodeLibraries } from '../../../virtualMachines/esp32/pmachines/shared/pcode-library-linker.mjs';
import { SERVICE_HOST_BINDINGS_VERSION } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { HOST_CAPABILITIES_VERSION, requiredHostCapabilities } from '../../../virtualMachines/esp32/pmachines/shared/contracts/host-capabilities.mjs';
import { getCobolRuntimeLibrary } from './cobol-runtime-libraries.mjs';

function text(ctx) {
  return ctx ? ctx.getText() : '';
}

function originalText(ctx) {
  if (!ctx?.start || !ctx?.stop) return text(ctx);
  try {
    return ctx.start.getInputStream().getText(ctx.start.start, ctx.stop.stop);
  } catch {
    return text(ctx);
  }
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// COBOL names are case-insensitive and hyphenated; pcode names are neither.
function storageName(name) {
  return String(name || '').trim().toUpperCase().replace(/-/g, '_');
}

function cobolDateTime(date) {
  const offset = -date.getTimezoneOffset();
  const offsetHours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const offsetMinutes = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    + `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
    + `${String(date.getSeconds()).padStart(2, '0')}${String(Math.floor(date.getMilliseconds() / 10)).padStart(2, '0')}`
    + `${offset < 0 ? '-' : '+'}${offsetHours}${offsetMinutes}`;
}

function unquote(value) {
  const raw = String(value || '');
  return raw.length >= 2 && ((raw[0] === '"' && raw.at(-1) === '"') || (raw[0] === '\'' && raw.at(-1) === '\''))
    ? raw.slice(1, -1).split(raw[0].repeat(2)).join(raw[0])
    : raw;
}

const COMPARATORS = {
  '=': 'EQ',
  '<>': 'NEQ',
  '!=': 'NEQ',
  'NOT=': 'NEQ',
  '<': 'LT',
  '<=': 'LE',
  '>': 'GT',
  '>=': 'GE'
};

function comparisonOpcode(ctx) {
  const raw = text(ctx).toUpperCase().replace(/^IS/, '');
  const negated = raw.startsWith('NOT');
  const operator = negated ? raw.slice(3) : raw;
  const opcode = COMPARATORS[operator]
    || (operator.startsWith('GREATER') ? (operator.includes('EQUAL') ? 'GE' : 'GT')
      : operator.startsWith('LESS') ? (operator.includes('EQUAL') ? 'LE' : 'LT')
        : operator.startsWith('EQUAL') ? 'EQ' : null);
  if (!opcode) throw new Error(`[COBOLISH] Unsupported comparator ${text(ctx)}`);
  return negated ? { EQ: 'NEQ', NEQ: 'EQ', LT: 'GE', LE: 'GT', GT: 'LE', GE: 'LT' }[opcode] : opcode;
}

function literalStringValue(ctx, length) {
  if (ctx.stringLiteral?.()) return unquote(text(ctx));
  const raw = text(ctx).toUpperCase();
  if (raw.startsWith('ALL')) {
    const nested = ctx.allLiteral?.()?.literal?.();
    const unit = nested ? literalStringValue(nested, 1) : null;
    return unit === null ? null : unit.repeat(length);
  }
  if (['SPACE', 'SPACES'].includes(raw)) return ' '.repeat(length);
  if (raw === 'QUOTES' || raw === 'QUOTE') return '"'.repeat(length);
  if (['ZERO', 'ZEROS', 'ZEROES'].includes(raw)) return '0'.repeat(length);
  if (['HIGH-VALUE', 'HIGH-VALUES'].includes(raw)) return '\u00ff'.repeat(length);
  if (['LOW-VALUE', 'LOW-VALUES'].includes(raw)) return '\u0000'.repeat(length);
  return null;
}

function editedPictureInfo(picture) {
  const raw = String(picture || '').trim().toUpperCase().replace(/\s+/g, '')
    .replace(/^(?:PICTURE|PIC)(?:IS)?/, '');
  const expanded = raw.replace(/([A-Z0-9$*+\-.,/])\((\d+)\)/g, (_match, symbol, count) =>
    symbol.repeat(Number(count)));
  if (!/[^SVXAP9]/.test(expanded)) return null;
  const tokens = expanded.match(/CR|DB|[9Z*+$\-.,/B0]/g) || [];
  if (tokens.join('') !== expanded) {
    throw new Error(`[COBOLISH] Unsupported edited PICTURE ${raw}`);
  }
  return { mask: expanded.replace(/[SV]/g, ''), length: expanded.replace(/[SV]/g, '').length };
}

function reportClauseWords(ctx) {
  const words = [];
  for (let index = 0; index < (ctx?.getChildCount?.() || 0); index += 1) {
    const child = ctx.getChild(index);
    words.push(child.symbol ? child.getText().toUpperCase() : child);
  }
  return words;
}

function editedPictureScale(mask, decimalPointComma) {
  const point = mask.indexOf(decimalPointComma ? ',' : '.');
  return point < 0 ? 0 : (mask.slice(point + 1).match(/[9Z*]/g) || []).length;
}

/**
 * Walks a Cobolish parse tree and emits pcode. Numeric data items are compiled as
 * fixed-point decimals whose scale comes from their PICTURE, so arithmetic follows
 * COBOL rules: the receiving field decides truncation, and ROUNDED is half-up.
 */
class CobolishCodegen extends Cobolish85Visitor {
  constructor() {
    super();
    this.lines = [];
    this.sourceLines = [];
    this.currentSourceLine = 0;
    this.labelId = 0;
    this.fields = new Map();
    this.dataParents = new Map();
    this.dataNameKeys = new Map();
    this.programs = [];
    this.currentProgram = null;
    this.externalDataNames = new Map();
    this.rawGroupStates = new Map();
    this.odoDependentGroups = new Map();
    this.paragraphs = new Map();
    this.sections = new Map();
    this.procedureDisplayNames = new Map();
    this.sizeErrorDepth = 0;
    this.files = new Map();
    this.filesByRecord = new Map();
    this.reports = new Map();
    this.reportDeclaratives = new Map();
    this.fileDeclaratives = new Map();
    this.declarativeParagraphs = new Set();
    this.declarativeSections = new Set();
    this.declarativeProcedureNodes = [];
    this.hiddenFieldId = 0;
    this.initialValues = new Map();
    this.conditions = new Map();
    this.segments = new Map();
    this.alters = new Map();
    this.controlFields = [];
    this.currentParagraph = null;
    this.currentSegment = 0;
    this.sentenceEnd = null;
    this.runtimeLibraries = new Set();
    this.debuggingMode = false;
    this.debugHooks = new Map();
    this.userClasses = new Map();
    this.symbolicCharacters = new Map();
    this.alphabets = new Map();
    this.decimalPointComma = false;
    this.whenCompiled = cobolDateTime(new Date());
  }

  collectPrograms(tree) {
    const addProgram = (node, parent = null) => {
      const sourceId = node.identificationDivision()?.programIdClause()?.programName()?.getText()
        ?.replace(/^['"]|['"]$/g, '') || `PROGRAM-${this.programs.length + 1}`;
      const key = storageName(sourceId);
      if (this.programs.some(program => program.key === key)) {
        throw new Error(`[COBOLISH] Duplicate PROGRAM-ID ${sourceId}`);
      }
      const attributes = text(node.identificationDivision()?.programIdClause()?.programAttributes()).toUpperCase();
      const program = {
        node,
        parent,
        sourceId,
        key,
        prefix: this.programs.length ? `${key}_` : '',
        root: this.programs.length === 0,
        common: attributes.includes('COMMON'),
        initial: attributes.includes('INITIAL'),
        dataNames: new Map(),
        conditions: new Map(),
        dataFields: [],
        linkageNames: [],
        linkageFields: [],
        paragraphs: [],
        procedureNames: new Map(),
        procedureDivision: node.procedureDivision(),
        entryLabel: null
      };
      this.programs.push(program);
      for (const nested of node.nestedProgram() || []) addProgram(nested.programUnit(), program);
    };

    const root = tree.programUnit?.();
    if (root) addProgram(root);
    for (const additional of tree.additionalProgram?.() || []) addProgram(additional.programUnit());
    if (!this.programs.length) throw new Error('[COBOLISH] Compilation unit has no program');
  }

  registerProgramDataName(program, sourceName, key) {
    const names = program.dataNames.get(sourceName) || [];
    if (!names.includes(key)) names.push(key);
    program.dataNames.set(sourceName, names);
    const allNames = this.dataNameKeys.get(sourceName) || [];
    if (!allNames.includes(key)) allNames.push(key);
    this.dataNameKeys.set(sourceName, allNames);
  }

  resolveProgramDataName(program, sourceName, qualifiers = []) {
    const matches = keys => {
      if (!qualifiers.length) return keys;
      return keys.filter(key => {
        const path = this.fieldOf(key)?.path || [];
        let position = 1;
        for (const qualifier of qualifiers) {
          position = path.indexOf(qualifier, position);
          if (position < 0) return false;
          position += 1;
        }
        return true;
      });
    };
    const local = matches(program?.dataNames.get(sourceName) || []);
    if (local.length === 1) return local[0];
    if (local.length > 1) throw new Error(`[COBOLISH] Data item ${sourceName} requires qualification`);

    for (let ancestor = program?.parent; ancestor; ancestor = ancestor.parent) {
      const visible = matches(ancestor.dataNames.get(sourceName) || [])
        .filter(key => this.isGlobalDataName(key));
      if (visible.length === 1) return visible[0];
      if (visible.length > 1) throw new Error(`[COBOLISH] Data item ${sourceName} requires qualification`);
    }

    const external = matches(this.externalDataNames.get(sourceName) || []);
    if (external.length === 1) return external[0];
    if (external.length > 1) throw new Error(`[COBOLISH] Data item ${sourceName} requires qualification`);
    return null;
  }

  isGlobalDataName(name) {
    let current = name;
    while (current) {
      if (this.fieldOf(current)?.isGlobal) return true;
      current = this.dataParents.get(current);
    }
    return false;
  }

  emit(line) {
    this.lines.push(line);
    this.sourceLines.push(this.currentSourceLine);
  }

  nextLabel(prefix) {
    this.labelId += 1;
    return `${prefix}_${this.labelId}`;
  }

  fieldOf(name) {
    return this.fields.get(storageName(name)) || null;
  }

  dataStorageSlots(name) {
    const field = this.fieldOf(name);
    if (!field || field.redefinesBase) {
      throw new Error(`[COBOLISH] Cannot pass ${name} by reference with its current storage layout`);
    }
    if (field.kind === 'group') return field.children.flatMap(child => this.dataStorageSlots(child));
    const count = (field.dimensions || []).reduce((total, size) => total * size, 1);
    return Array.from({ length: count }, (_value, index) => ({
      name: field.dimensions?.length ? `${name}_${index}` : name,
      field
    }));
  }

  compatibleReferenceSlot(left, right) {
    if (left.kind !== right.kind) return false;
    if (left.kind === 'string') return left.length === right.length;
    return left.precision === right.precision
      && left.scale === right.scale
      && left.signed === right.signed
      && left.separateSign === right.separateSign
      && left.signPosition === right.signPosition;
  }

  correspondingFields(sourceReference, targetReference) {
    const sourceName = this.resolveDataName(sourceReference);
    const targetName = this.resolveDataName(targetReference);
    const source = this.fieldOf(sourceName);
    const target = this.fieldOf(targetName);
    if (source?.kind !== 'group' || target?.kind !== 'group'
      || sourceReference.expression().length || targetReference.expression().length) {
      throw new Error('[COBOLISH] CORRESPONDING requires unsubscripted group items');
    }
    const leaves = groupName => {
      const result = new Map();
      const visit = name => {
        const field = this.fieldOf(name);
        if (field.kind !== 'group') {
          if (field.sourceName !== 'FILLER') {
            const entries = result.get(field.sourceName) || [];
            entries.push({ name, field });
            result.set(field.sourceName, entries);
          }
          return;
        }
        for (const child of field.children) {
          const childField = this.fieldOf(child);
          if (childField.dimensions.length) {
            throw new Error('[COBOLISH] CORRESPONDING with table items is not yet implemented');
          }
          visit(child);
        }
      };
      visit(groupName);
      return result;
    };
    const sourceLeaves = leaves(sourceName);
    const targetLeaves = leaves(targetName);
    const pairs = [];
    for (const [name, sourceItems] of sourceLeaves) {
      const targetItems = targetLeaves.get(name);
      if (!targetItems) continue;
      if (sourceItems.length !== 1 || targetItems.length !== 1) {
        throw new Error(`[COBOLISH] CORRESPONDING item ${name} is ambiguous`);
      }
      pairs.push({ source: sourceItems[0], target: targetItems[0] });
    }
    return pairs;
  }

  resolveDataName(reference) {
    const name = storageName(reference.IDENTIFIER().getText());
    const qualifiers = asArray(reference.qualifier?.())
      .map(qualifier => storageName(qualifier.IDENTIFIER().getText()));
    const scoped = this.resolveProgramDataName(this.currentProgram, name, qualifiers);
    if (scoped) return scoped;
    if (qualifiers.length) {
      const matches = (this.dataNameKeys.get(name) || []).filter(key => {
        const path = this.fieldOf(key)?.path || [];
        let position = 1;
        for (const qualifier of qualifiers) {
          position = path.indexOf(qualifier, position);
          if (position < 0) return false;
          position += 1;
        }
        return true;
      });
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) throw new Error(`[COBOLISH] Data item ${name} remains ambiguous after qualification`);
      throw new Error(`[COBOLISH] Data item ${name} is not qualified by ${qualifiers.join(' OF ')}`);
    }
    if (this.currentProgram && this.dataNameKeys.has(name)) {
      throw new Error(`[COBOLISH] Undeclared data item ${name} in program ${this.currentProgram.sourceId}`);
    }
    const candidates = this.dataNameKeys.get(name) || [];
    if (candidates.length > 1) throw new Error(`[COBOLISH] Data item ${name} requires qualification`);
    return candidates[0] || name;
  }

  ensureRawGroupState(name, field) {
    if (!this.rawGroupStates.has(name)) {
      const value = this.nextHiddenField();
      this.fields.set(value, { kind: 'string', length: field.length });
      this.rawGroupStates.set(name, { value });
    }
    return this.rawGroupStates.get(name);
  }

  invalidateRawGroups(name) {
    let parent = this.dataParents.get(name);
    while (parent) {
      this.rawGroupStates.delete(parent);
      parent = this.dataParents.get(parent);
    }
    for (const group of this.odoDependentGroups.get(name) || []) this.rawGroupStates.delete(group);
    for (const [group, field] of this.fields) {
      if (field.renamesChildren?.includes(name)) this.rawGroupStates.delete(group);
    }
  }

  fieldOffsetWithin(recordName, fieldName) {
    if (recordName === fieldName) return 0;
    let offset = 0;
    let child = fieldName;
    while (child !== recordName) {
      const parent = this.dataParents.get(child);
      const parentField = parent && this.fieldOf(parent);
      if (!parentField || parentField.kind !== 'group') {
        throw new Error(`[COBOLISH] Data item ${fieldName} is not contained in record ${recordName}`);
      }
      for (const sibling of parentField.children) {
        if (sibling === child) break;
        const field = this.fieldOf(sibling);
        const repetitions = field.dimensions.slice(parentField.dimensions.length).reduce((a, b) => a * b, 1);
        offset += this.fieldLength(field) * repetitions;
      }
      child = parent;
    }
    return offset;
  }

  collectDataItems(tree) {
    const entries = [];
    for (const program of this.programs) {
      const walk = (node, section = '') => {
        if (!node) return;
        const kind = node.constructor?.name;
        if (kind === 'NestedProgramContext') return;
        if (kind === 'DataDescriptionEntryContext') {
          entries.push({ entry: node, program, section });
          return;
        }
        const childSection = kind === 'WorkingStorageSectionContext' ? 'WORKING'
          : kind === 'LocalStorageSectionContext' ? 'LOCAL'
            : kind === 'LinkageSectionContext' ? 'LINKAGE' : section;
        for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) {
          walk(node.getChild(index), childSection);
        }
      };
      walk(program.node);
    }

    let activeProgram = null;
    let parents = [];
    for (const { entry, program, section } of entries) {
      if (activeProgram !== program) {
        activeProgram = program;
        parents = [];
      }
      this.currentProgram = program;
      const name = storageName(entry.IDENTIFIER()?.getText());
      if (!name) continue;
      const level = Number(text(entry.fileLevelNumber()));
      if (level === 66) {
        const parent = [...parents].reverse().find(item => this.fieldOf(item.name)?.kind === 'group');
        const renames = entry.dataClause().map(clause => clause.renamesClause?.()).find(Boolean);
        if (!parent || !renames) throw new Error(`[COBOLISH] RENAMES ${name} must follow data items in a containing group`);
        const identifiers = renames.IDENTIFIER().map(identifier => storageName(identifier.getText()));
        const children = this.fieldOf(parent.name).children;
        const first = children.findIndex(child => this.fieldOf(child).sourceName === identifiers[0]);
        const last = children.findIndex(child => this.fieldOf(child).sourceName === (identifiers[1] || identifiers[0]));
        if (first < 0 || last < first) throw new Error(`[COBOLISH] RENAMES ${name} must name an ordered range of siblings`);
        const renamedChildren = children.slice(first, last + 1);
        const renamedFields = renamedChildren.map(child => this.fieldOf(child));
        if (renamedFields.some(field => field.dimensions.length)) {
          throw new Error(`[COBOLISH] RENAMES ${name} cannot include table items`);
        }
        const key = `${program.prefix}${name}`;
        const length = renamedFields.reduce((total, field) => total + this.fieldLength(field), 0);
        this.fields.set(key, {
          kind: 'group', length, children: renamedChildren, dimensions: [], dependingOn: null,
          redefinesName: null, indexNames: [], sortKeys: null, sortDescending: false,
          justified: false, sourceName: name, path: [name, ...(parent.path || [])],
          renamesChildren: renamedChildren
        });
        this.registerProgramDataName(program, name, key);
        continue;
      }
      if (level === 88) {
        this.collectConditionName(name, entry, parents.at(-1), program);
        continue;
      }
      while (parents.length && parents.at(-1).level >= level) parents.pop();
      if (level === 77) parents.length = 0;
      let picture = null;
      let editedPicture = null;
      let blankWhenZero = false;
      let occurs = null;
      let dependingOn = null;
      let redefinesName = null;
      let justified = false;
      let signPosition = null;
      let separateSign = false;
      let indexUsage = false;
      let initial = null;
      let sortKeys = null;
      let sortDescending = false;
      const external = Boolean(parents.at(-1)?.external
        || (entry.dataClause() || []).some(clause => clause.externalClause?.()));
      const isGlobal = (entry.dataClause() || []).some(clause => clause.globalClause?.());
      for (const clause of entry.dataClause() || []) {
        const pictureCtx = clause.pictureClause && clause.pictureClause();
        if (pictureCtx) {
          const symbols = text(pictureCtx).toUpperCase().replace(/\s+/g, '').replace(/^(?:PICTURE|PIC)(?:IS)?/, '').replace(/\(\d+\)/g, '');
          editedPicture = editedPictureInfo(text(pictureCtx));
          if (editedPicture) {
            picture = { kind: 'string', length: editedPicture.length, signed: false, pascalishType: 'string' };
          } else if (/[^SVXAZP9]/.test(symbols)) {
            throw new Error(`[COBOLISH] Unsupported PICTURE ${symbols} for ${name}`);
          } else picture = parsePicture(text(pictureCtx));
        }
        if (clause.VALUE?.()) initial = clause.literal();
        if (clause.REDEFINES?.()) redefinesName = storageName(clause.IDENTIFIER().getText());
        if (clause.occursKeyClause?.()) {
          sortKeys = clause.occursKeyClause().IDENTIFIER().map(identifier => storageName(identifier.getText()));
          sortDescending = Boolean(clause.occursKeyClause().DESCENDING());
        }
        if (clause.usageClause?.() && /^INDEX$/i.test(text(clause.usageClause()))) indexUsage = true;
        if (clause.OCCURS?.()) {
          const bounds = clause.cobolNumber();
          occurs = Number(text(bounds.at(-1)));
          if (!Number.isSafeInteger(occurs) || occurs < 1) throw new Error(`[COBOLISH] Invalid OCCURS for ${name}`);
          if (clause.IDENTIFIER?.()) dependingOn = storageName(clause.IDENTIFIER().getText());
        }
        if (clause.JUSTIFIED?.()) justified = true;
        if (clause.BLANK?.()) blankWhenZero = true;
        if (clause.SIGN?.()) {
          const signClause = text(clause).toUpperCase().replace(/[^A-Z]/g, '');
          signPosition = signClause.includes('TRAILING') ? 'TRAILING' : 'LEADING';
          separateSign = signClause.includes('SEPARATE');
        }
      }
      const parent = parents.at(-1);
      const path = [name, ...(parent?.path || [])];
      let key = external
        ? (this.externalDataNames.get(name)?.[0] || `__EXTERNAL_${name}`)
        : `${program.prefix}${name}`;
      if (this.fields.has(key) && !external) {
        const keyPrefix = parent?.name || `${program.prefix || 'DATA'}DATA`;
        key = `${keyPrefix}_${name}`;
        let suffix = 2;
        while (this.fields.has(key)) key = `${keyPrefix}_${name}_${suffix++}`;
      }
      const dimensions = [...(parent?.dimensions || []), ...(occurs === null ? [] : [occurs])];
      const field = {
        ...(picture || (indexUsage
          ? { kind: 'decimal', signed: false, precision: 10, scale: 0 }
          : { kind: 'group', length: 0 })),
        children: [], dimensions, dependingOn, redefinesName, indexNames: [],
        sortKeys, sortDescending,
        justified, signPosition, separateSign, editedPicture: editedPicture?.mask,
        blankWhenZero, sourceName: name, path, programKey: program.key,
        isGlobal, isExternal: external, isLinkage: section === 'LINKAGE',
        storageSection: section
      };
      if (initial && field.kind === 'decimal') {
        const raw = text(initial);
        const [whole, fraction = ''] = raw.replace(/^[+-]/, '').split('.');
        if (!/^(ZERO|ZEROS|ZEROES)$/i.test(raw)
          && (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)
            || (/^[+-]/.test(raw) && !field.signed)
            || whole.replace(/^0+/, '').length > field.precision - field.scale
            || /[1-9]/.test(fraction.slice(field.scale)))) {
          throw new Error(`[COBOLISH] VALUE for ${name} does not fit its numeric PICTURE`);
        }
      } else if (initial && field.kind === 'string') {
        const value = literalStringValue(initial, field.length);
        if (value === null || value.length > field.length) {
          throw new Error(`[COBOLISH] VALUE for ${name} does not fit its alphanumeric PICTURE`);
        }
      };
      if (!this.fields.has(key)) this.fields.set(key, field);
      this.registerProgramDataName(program, name, key);
      program.dataFields.push(key);
      if (field.isLinkage && level === 1) program.linkageNames.push(name);
      if (external) {
        const keys = this.externalDataNames.get(name) || [];
        if (!keys.includes(key)) keys.push(key);
        this.externalDataNames.set(name, keys);
      }
      if (initial) this.initialValues.set(key, initial);
      for (const clause of entry.dataClause() || []) {
        if (clause.INDEXED?.()) {
          for (const index of clause.identifierList().IDENTIFIER()) {
            const sourceIndexName = storageName(index.getText());
            const indexName = `${program.prefix}${sourceIndexName}`;
            if (this.fields.has(indexName)) throw new Error(`[COBOLISH] Duplicate index-name ${sourceIndexName}`);
            this.fields.set(indexName, { kind: 'decimal', signed: false, precision: 10, scale: 0, dimensions: [], programKey: program.key });
            this.registerProgramDataName(program, sourceIndexName, indexName);
            field.indexNames.push(indexName);
          }
        }
      }
      if (parent) {
        if (!this.fields.get(parent.name).children.includes(key)) this.fields.get(parent.name).children.push(key);
        this.dataParents.set(key, parent.name);
      }
      parents.push({ name: key, level, dimensions, path, external });
    }
    this.currentProgram = null;
    for (const [name, field] of [...this.fields].reverse()) {
      if (field.kind === 'group') {
        field.length = field.children.reduce((length, child) => {
          const item = this.fieldOf(child);
          const repetitions = item.dimensions.slice(field.dimensions.length).reduce((a, b) => a * b, 1);
          return length + this.fieldLength(item) * repetitions;
        }, 0);
        if (this.initialValues.has(name)) {
          const value = literalStringValue(this.initialValues.get(name), field.length);
          if (value === null || value.length > field.length) {
            throw new Error(`[COBOLISH] Group VALUE for ${name} must be a nonnumeric literal or figurative constant that fits the group`);
          }
          if (field.dimensions.length || field.redefinesName || field.renamesChildren) {
            throw new Error(`[COBOLISH] Group VALUE for ${name} cannot apply to a table, REDEFINES, or RENAMES item`);
          }
        }
      }
    }
    for (const [name, field] of this.fields) {
      if (!field.dependingOn) continue;
      const program = this.programs.find(item => item.key === field.programKey);
      const controllers = program?.dataNames.get(field.dependingOn) || this.dataNameKeys.get(field.dependingOn) || [];
      if (controllers.length > 1) {
        throw new Error(`[COBOLISH] OCCURS DEPENDING ON item ${field.dependingOn} requires qualification`);
      }
      field.dependingOn = controllers[0] || field.dependingOn;
      let parent = this.dataParents.get(name);
      while (parent) {
        const groups = this.odoDependentGroups.get(field.dependingOn) || new Set();
        groups.add(parent);
        this.odoDependentGroups.set(field.dependingOn, groups);
        parent = this.dataParents.get(parent);
      }
    }
    for (const [name, field] of this.fields) {
      if (!field.redefinesName) continue;
      const program = this.programs.find(item => item.key === field.programKey);
      const bases = program?.dataNames.get(field.redefinesName) || this.dataNameKeys.get(field.redefinesName) || [];
      if (bases.length !== 1) {
        throw new Error(`[COBOLISH] REDEFINES target ${field.redefinesName} must resolve to one data item`);
      }
      this.assignRedefinitionLayout(name, bases[0], 0, [], []);
    }
  }

  assignRedefinitionLayout(name, base, offset, dimensions, strides) {
    const field = this.fieldOf(name);
    field.redefinesBase = base;
    field.redefinesOffset = offset;
    field.redefinesStrides = strides;
    if (field.kind !== 'group') return;
    let childOffset = 0;
    for (const child of field.children) {
      const item = this.fieldOf(child);
      const extraDimensions = item.dimensions.slice(dimensions.length);
      const childStrides = [...strides];
      for (let index = 0; index < extraDimensions.length; index += 1) {
        const repetitions = extraDimensions.slice(index + 1).reduce((total, size) => total * size, 1);
        childStrides.push(this.fieldLength(item) * repetitions);
      }
      this.assignRedefinitionLayout(child, base, offset + childOffset, item.dimensions, childStrides);
      const repetitions = extraDimensions.reduce((total, size) => total * size, 1);
      childOffset += this.fieldLength(item) * repetitions;
    }
  }

  fieldLength(field) {
    return field.kind === 'decimal' ? field.precision + (field.separateSign ? 1 : 0) : field.length;
  }

  // A level-88 entry names values of the item it follows (manual ch. 7, condition-name entry).
  collectSpecialNames(tree) {
    this.decimalPointComma = /DECIMAL-POINTISCOMMA/i.test(text(tree).toUpperCase());
    const visit = node => {
      if (!node) return;
      if (node.constructor?.name === 'ClassClauseContext') {
        const name = storageName(asArray(node.IDENTIFIER?.())[0]?.getText());
        const characters = new Set();
        for (const entry of node.classEntry?.() || []) {
          const values = asArray(entry.literal?.()).map(value => unquote(text(value)));
          if (values.length === 1) {
            for (const character of values[0]) characters.add(character);
          } else if (values.length === 2 && [...values[0]].length === 1 && [...values[1]].length === 1) {
            const start = values[0].codePointAt(0);
            const end = values[1].codePointAt(0);
            for (let code = start; code <= end; code += 1) characters.add(String.fromCodePoint(code));
          } else {
            throw new Error(`[COBOLISH] CLASS ${name} requires single-character literals or ranges`);
          }
        }
        this.userClasses.set(name, [...characters].join(''));
      } else if (node.constructor?.name === 'SymbolicClauseContext') {
        const names = asArray(node.IDENTIFIER?.()).map(identifier => storageName(identifier.getText()));
        const values = asArray(node.cobolNumber?.()).map(value => Number(text(value)));
        if (names.length !== values.length) throw new Error('[COBOLISH] SYMBOLIC CHARACTERS requires one ordinal per name');
        names.forEach((name, index) => {
          const ordinal = values[index];
          if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 256) {
            throw new Error(`[COBOLISH] SYMBOLIC CHARACTER ${name} has an invalid ordinal`);
          }
          this.symbolicCharacters.set(name, String.fromCharCode(ordinal - 1));
        });
      } else if (node.constructor?.name === 'AlphabetClauseContext') {
        const identifiers = asArray(node.IDENTIFIER?.());
        const name = storageName(identifiers[0]?.getText());
        const native = Array.from({ length: 256 }, (_value, index) => String.fromCharCode(index));
        const ranks = new Map();
        let rank = 0;
        const add = characters => {
          for (const character of characters) {
            if (character.charCodeAt(0) > 255 || ranks.has(character)) {
              throw new Error(`[COBOLISH] ALPHABET ${name} contains an invalid or repeated character`);
            }
            ranks.set(character, rank);
          }
          rank += 1;
        };
        const literalCharacters = literal => {
          if (literal.stringLiteral?.()) return unquote(text(literal));
          const ordinal = Number(text(literal));
          if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 256) {
            throw new Error(`[COBOLISH] ALPHABET ${name} requires characters or ordinals from 1 to 256`);
          }
          return String.fromCharCode(ordinal - 1);
        };
        const entries = asArray(node.alphabetEntry?.());
        const predefined = text(identifiers[1]).toUpperCase();
        if (!entries.length && !['NATIVE', 'STANDARD-1', 'STANDARD-2'].includes(predefined)) {
          throw new Error(`[COBOLISH] Unsupported predefined ALPHABET ${predefined}`);
        }
        for (const entry of entries) {
          const values = asArray(entry.literal()).map(literalCharacters);
          if (entry.THRU?.() || entry.THROUGH?.()) {
            if (values.some(value => value.length !== 1)) {
              throw new Error(`[COBOLISH] ALPHABET ${name} range endpoints must be single characters`);
            }
            const first = values[0].charCodeAt(0);
            const last = values[1].charCodeAt(0);
            const step = first <= last ? 1 : -1;
            for (let code = first; code !== last + step; code += step) add(String.fromCharCode(code));
          } else if (entry.ALSO?.().length) {
            add(values.join(''));
          } else {
            for (const character of values[0]) add(character);
          }
        }
        for (const character of native) if (!ranks.has(character)) add(character);
        this.alphabets.set(name, native.map(character => String(ranks.get(character)).padStart(3, '0')).join(''));
      }
      for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) visit(node.getChild(index));
    };
    visit(tree);
  }

  collectConditionName(name, entry, parent, program = this.currentProgram) {
    if (!parent) throw new Error(`[COBOLISH] Level-88 condition-name ${name} has no conditional variable`);
    const conditionKey = `${program?.prefix || ''}${name}`;
    if (program?.dataNames.has(name) || this.conditions.has(conditionKey)) throw new Error(`[COBOLISH] Duplicate data name ${name}`);
    const values = [];
    for (const clause of entry.dataClause() || []) {
      const list = clause.conditionValueClause?.();
      if (list) {
        for (const value of list.conditionValue()) {
          const [from, thru = null] = value.literal();
          values.push({ from, thru });
        }
      } else if (clause.VALUE?.() && clause.literal?.()) {
        values.push({ from: clause.literal(), thru: null });
      } else {
        throw new Error(`[COBOLISH] Level-88 condition-name ${name} allows only VALUE clauses`);
      }
    }
    if (!values.length) throw new Error(`[COBOLISH] Level-88 condition-name ${name} requires a VALUE clause`);
    this.conditions.set(conditionKey, { parent: parent.name, values });
    program.conditions?.set(name, conditionKey);
  }

  conditionForName(name) {
    const key = this.currentProgram?.conditions?.get(name) || name;
    return this.conditions.get(key) || null;
  }

  conditionNameReference(expression) {
    const terms = expression.term();
    if (terms.length !== 1 || terms[0].factor().length !== 1) return null;
    const reference = terms[0].factor(0).dataReference?.();
    if (!reference || this.isReferenceModified(reference)) return null;
    const condition = this.conditionForName(storageName(reference.IDENTIFIER().getText()));
    return condition ? { reference, condition } : null;
  }

  // Pushes a condition-value literal in the representation of the conditional variable.
  emitConditionValue(field, literal) {
    this.emitLiteral(literal);
    if (field.kind !== 'decimal') this.emitReceiverConversion({ kind: 'string', length: field.length }, false);
  }

  emitConditionName(reference, condition) {
    const parent = condition.parent;
    const field = this.fieldOf(parent);
    const value = this.nextHiddenField();
    if (reference.expression().length) {
      this.emitIndex(reference, parent);
      this.emit(`ARR_GET ${parent} ${field.dimensions.reduce((a, b) => a * b, 1)}`);
    } else this.emitNamedReference(parent);
    this.emit(`STORE ${value}`);
    condition.values.forEach(({ from, thru }, index) => {
      this.emit(`LOAD ${value}`);
      this.emitConditionValue(field, from);
      if (thru) {
        this.emit('GE');
        this.emit(`LOAD ${value}`);
        this.emitConditionValue(field, thru);
        this.emit('LE');
        this.emit('AND');
      } else this.emit('EQ');
      if (index) this.emit('OR');
    });
  }

  // SET condition-name TO TRUE moves the first listed value to the conditional variable.
  emitSetConditionTrue(reference, condition) {
    const parent = condition.parent;
    const field = this.fieldOf(parent);
    this.emitLiteral(condition.values[0].from);
    if (reference.expression().length) {
      const value = this.nextHiddenField();
      this.emit(`STORE ${value}`);
      this.emitIndex(reference, parent);
      this.emit(`LOAD ${value}`);
      this.emitReceiverConversion(field, false);
      this.emit(`ARR_SET ${parent} ${field.dimensions.reduce((a, b) => a * b, 1)}`);
    } else this.storeNamedReference(parent);
  }

  emitSlice(start, end) {
    start();
    this.emit('DEC_STR');
    this.emit('PARSE_INT');
    end();
    this.emit('DEC_STR');
    this.emit('PARSE_INT');
    this.emit('CALL_EXT host.string_slice 3');
  }

  emitIndex(reference, name = this.resolveDataName(reference)) {
    const dimensions = this.fieldOf(name)?.dimensions || [];
    const subscripts = reference.expression();
    if (subscripts.length !== dimensions.length) throw new Error(`[COBOLISH] ${name} requires ${dimensions.length} subscripts`);
    for (let index = 0; index < subscripts.length; index += 1) {
      if (index) {
        this.emit(`PUSH_INT ${dimensions[index]}`);
        this.emit('MUL');
      }
      this.emitExpression(subscripts[index]);
      this.emit('PUSH_INT 1');
      this.emit('SUB');
      if (index) this.emit('ADD');
    }
    this.emit('DEC_STR');
    this.emit('PARSE_INT');
  }

  emitReference(reference) {
    const name = this.resolveDataName(reference);
    const field = this.fieldOf(name);
    if (!field && !reference.expression().length && !reference.COLON?.() && this.symbolicCharacters.has(name)) {
      this.emit(`PUSH_STR ${JSON.stringify(this.symbolicCharacters.get(name))}`);
      return;
    }
    if (!field) throw new Error(`[COBOLISH] Undeclared data item ${name}`);
    const modification = this.referenceModification(reference);
    if (modification) {
      this.emitItemText(reference, name, field, modification.subscripted);
      const start = this.nextHiddenField();
      this.emitExpression(modification.start);
      this.emit('PUSH_INT 1');
      this.emit('SUB');
      this.emit(`STORE ${start}`);
      this.emitSlice(() => this.emit(`LOAD ${start}`), () => {
        if (modification.length) {
          this.emit(`LOAD ${start}`);
          this.emitExpression(modification.length);
          this.emit('ADD');
        } else this.emit(`PUSH_INT ${this.fieldLength(field)}`);
      });
    } else if (field.redefinesBase) {
      return this.emitRedefinedValue(reference, name, field);
    } else if (reference.expression().length) {
      this.emitIndex(reference);
      this.emit(`ARR_GET ${name} ${field.dimensions.reduce((a, b) => a * b, 1)}`);
    } else this.emitNamedReference(name);
  }

  emitRedefinedValue(reference, name, field) {
    this.emitRedefinedText(reference, field);
    if (field.kind === 'decimal') {
      this.runtimeLibraries.add('math');
      this.emit('CALL PROC_COBOL_RT_NUMVAL 1');
    }
  }

  displaySignMode(field) {
    return field.separateSign ? ` ${field.signPosition}_SEPARATE` : '';
  }

  // Byte-layout views require each DISPLAY numeric to occupy exactly its PICTURE width.
  assertFixedDisplayWidth(field, name) {
    if (field?.kind === 'decimal' && field.signed && !field.separateSign) {
      throw new Error(`[COBOLISH] ${name} uses an embedded sign; byte-layout access requires SIGN SEPARATE or an unsigned item`);
    }
  }

  referenceModification(reference) {
    if (reference?.COLON?.()) {
      return { start: reference.expression(0), length: reference.expression(1) || null, subscripted: false };
    }
    const modifier = reference?.referenceModifier?.();
    if (modifier) return { start: modifier.expression(0), length: modifier.expression(1) || null, subscripted: true };
    return null;
  }

  isReferenceModified(reference) {
    return Boolean(this.referenceModification(reference));
  }

  emitRedefinedOffset(reference, field) {
    const subscripts = reference?.expression?.() || [];
    if (subscripts.length !== field.dimensions.length) {
      throw new Error(`[COBOLISH] ${field.sourceName} requires ${field.dimensions.length} subscripts`);
    }
    const offset = this.nextHiddenField();
    this.emit(`PUSH_INT ${field.redefinesOffset}`);
    for (let index = 0; index < subscripts.length; index += 1) {
      this.emitExpression(subscripts[index]);
      this.emit('PUSH_INT 1');
      this.emit('SUB');
      this.emit(`PUSH_INT ${field.redefinesStrides[index]}`);
      this.emit('MUL');
      this.emit('ADD');
    }
    this.emit(`STORE ${offset}`);
    return offset;
  }

  emitBaseText(baseName) {
    const baseField = this.fieldOf(baseName);
    this.emitNamedReference(baseName);
    if (baseField?.kind === 'decimal') {
      this.emit(`DEC_DISPLAY ${baseField.precision} ${baseField.scale}${this.displaySignMode(baseField)}`);
    }
  }

  emitRedefinedText(reference, field) {
    const offset = this.emitRedefinedOffset(reference, field);
    this.emitBaseText(field.redefinesBase);
    this.emitSlice(() => this.emit(`LOAD ${offset}`), () => {
      this.emit(`LOAD ${offset}`);
      this.emit(`PUSH_INT ${this.fieldLength(field)}`);
      this.emit('ADD');
    });
  }

  // Pops the item's full DISPLAY text and splices it into the redefined base storage.
  storeRedefinedText(reference, field) {
    const baseName = field.redefinesBase;
    const baseField = this.fieldOf(baseName);
    this.assertFixedDisplayWidth(baseField, baseName);
    const value = this.nextHiddenField();
    this.emit(`STORE ${value}`);
    const offset = this.emitRedefinedOffset(reference, field);
    const baseText = this.nextHiddenField();
    this.emitBaseText(baseName);
    this.emit(`STORE ${baseText}`);
    this.emit(`LOAD ${baseText}`);
    this.emitSlice(() => this.emit('PUSH_INT 0'), () => this.emit(`LOAD ${offset}`));
    this.emit(`LOAD ${value}`);
    this.emit('CONCAT');
    this.emit(`LOAD ${baseText}`);
    this.emitSlice(() => {
      this.emit(`LOAD ${offset}`);
      this.emit(`PUSH_INT ${this.fieldLength(field)}`);
      this.emit('ADD');
    }, () => this.emit(`PUSH_INT ${this.fieldLength(baseField)}`));
    this.emit('CONCAT');
    this.storeItemText(null, baseName, baseField, false);
  }

  // Pushes an item's current DISPLAY text, as used by reference modification.
  emitItemText(reference, name, field, subscripted) {
    if (field.redefinesBase) {
      this.emitRedefinedText(subscripted ? reference : null, field);
      return;
    }
    if (subscripted) {
      if (field.kind === 'group') throw new Error(`[COBOLISH] Reference modification of subscripted group ${name} is not supported`);
      this.emitIndex(reference, name);
      this.emit(`ARR_GET ${name} ${field.dimensions.reduce((a, b) => a * b, 1)}`);
    } else this.emitNamedReference(name);
    if (field.kind === 'decimal') {
      this.emit(`DEC_DISPLAY ${field.precision} ${field.scale}${this.displaySignMode(field)}`);
    }
  }

  // Pops full-width DISPLAY text and stores it in the item's own representation.
  storeItemText(reference, name, field, subscripted) {
    this.assertFixedDisplayWidth(field, name);
    if (field.redefinesBase) {
      this.storeRedefinedText(subscripted ? reference : null, field);
    } else if (field.kind === 'group') {
      if (subscripted) throw new Error(`[COBOLISH] Reference modification of subscripted group ${name} is not supported`);
      this.storeNamedReference(name);
    } else if (subscripted) {
      const value = this.nextHiddenField();
      this.emit(`STORE ${value}`);
      this.emitIndex(reference, name);
      this.emit(`LOAD ${value}`);
      this.emitDisplayReceiverConversion(field);
      this.emit(`ARR_SET ${name} ${field.dimensions.reduce((a, b) => a * b, 1)}`);
      this.invalidateRawGroups(name);
    } else {
      this.emitDisplayReceiverConversion(field);
      this.emit(`STORE ${name}`);
      this.invalidateRawGroups(name);
    }
  }

  // Pops a value, converts it to the redefining item's PICTURE, and writes its bytes into the base.
  storeRedefined(reference, field, rounded) {
    this.assertFixedDisplayWidth(field, field.sourceName);
    if (field.kind === 'decimal') {
      this.emitReceiverConversion(field, rounded);
      this.emit(`DEC_DISPLAY ${field.precision} ${field.scale}${this.displaySignMode(field)}`);
    } else if (field.kind === 'string') {
      this.emitReceiverConversion(field, rounded);
    } else {
      this.emitReceiverConversion({ kind: 'string', length: field.length }, false);
    }
    this.storeRedefinedText(reference, field);
  }

  emitNamedReference(name) {
    const field = this.fieldOf(name);
    if (!field) throw new Error(`[COBOLISH] Undeclared data item ${name}`);
    if (field.redefinesBase) return this.emitRedefinedValue(null, name, field);
    if (field.dimensions.length) {
      throw new Error(`[COBOLISH] Table ${name} requires subscripts`);
    } else if (field.kind === 'group') {
      const state = this.rawGroupStates.get(name);
      if (state) {
        this.emit(`LOAD ${state.value}`);
        return;
      }
      this.emit('PUSH_STR ""');
      const append = childName => {
        const item = this.fieldOf(childName);
        if (item.kind === 'group') {
          item.children.forEach(append);
          return;
        }
        const count = item.dimensions.reduce((total, dimension) => total * dimension, 1);
        for (let index = 0; index < count; index += 1) {
          const skip = item.dependingOn ? this.nextLabel('ODO_SKIP') : null;
          if (skip) {
            this.emit(`LOAD ${item.dependingOn}`);
            this.emit(`PUSH_INT ${index}`);
            this.emit('GT');
            this.emit(`JZ ${skip}`);
          }
          this.emit(`LOAD ${item.dimensions.length ? `${childName}_${index}` : childName}`);
          if (item.kind === 'decimal') {
            this.emit(`DEC_DISPLAY ${item.precision} ${item.scale}${item.separateSign ? ` ${item.signPosition}_SEPARATE` : ''}`);
          }
          this.emit('CONCAT');
          if (skip) this.emit(`${skip}:`);
        }
      };
      field.children.forEach(append);
    } else this.emit(`LOAD ${name}`);
  }

  storeReference(reference, rounded = false) {
    const name = this.resolveDataName(reference);
    const field = this.fieldOf(name);
    if (!field) throw new Error(`[COBOLISH] Undeclared data item ${name}`);
    const modification = this.referenceModification(reference);
    if (modification) {
      const length = this.fieldLength(field);
      const value = this.nextHiddenField();
      const start = this.nextHiddenField();
      const end = this.nextHiddenField();
      const current = this.nextHiddenField();
      this.emit(`STORE ${value}`);
      this.emitExpression(modification.start);
      this.emit('PUSH_INT 1');
      this.emit('SUB');
      this.emit(`STORE ${start}`);
      if (modification.length) {
        this.emit(`LOAD ${start}`);
        this.emitExpression(modification.length);
        this.emit('ADD');
      } else this.emit(`PUSH_INT ${length}`);
      this.emit(`STORE ${end}`);
      this.emitItemText(reference, name, field, modification.subscripted);
      this.emit(`STORE ${current}`);
      this.emit(`LOAD ${current}`);
      this.emitSlice(() => this.emit('PUSH_INT 0'), () => this.emit(`LOAD ${start}`));
      this.emit(`LOAD ${value}`);
      this.emit(`PUSH_STR ${JSON.stringify(' '.repeat(length))}`);
      this.emit('CONCAT');
      this.emitSlice(() => this.emit('PUSH_INT 0'), () => {
        this.emit(`LOAD ${end}`);
        this.emit(`LOAD ${start}`);
        this.emit('SUB');
      });
      this.emit('CONCAT');
      this.emit(`LOAD ${current}`);
      this.emitSlice(() => this.emit(`LOAD ${end}`), () => this.emit(`PUSH_INT ${length}`));
      this.emit('CONCAT');
      this.storeItemText(reference, name, field, modification.subscripted);
    } else if (field.redefinesBase) {
      this.storeRedefined(reference, field, rounded);
    } else if (reference.expression().length) {
      const value = this.nextHiddenField();
      this.emit(`STORE ${value}`);
      this.emitIndex(reference);
      this.emit(`LOAD ${value}`);
      this.emitReceiverConversion(field, rounded);
      this.emit(`ARR_SET ${name} ${field.dimensions.reduce((a, b) => a * b, 1)}`);
      this.invalidateRawGroups(name);
    } else this.storeNamedReference(name, rounded);
  }

  storeNamedReference(name, rounded = false) {
    const field = this.fieldOf(name);
    if (!field) throw new Error(`[COBOLISH] Undeclared data item ${name}`);
    if (field.redefinesBase) return this.storeRedefined(null, field, rounded);
    if (field.dimensions.length) throw new Error(`[COBOLISH] Table ${name} requires subscripts`);
    if (field.kind === 'group') {
      const value = this.nextHiddenField();
      this.emit(`STORE ${value}`);
      const offset = this.nextHiddenField();
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${offset}`);
      const assign = childName => {
        const item = this.fieldOf(childName);
        if (item.kind === 'group') {
          item.children.forEach(assign);
          return;
        }
        const count = item.dimensions.reduce((total, dimension) => total * dimension, 1);
        const length = this.fieldLength(item);
        for (let index = 0; index < count; index += 1) {
          const skip = item.dependingOn ? this.nextLabel('ODO_SKIP') : null;
          if (skip) {
            this.emit(`LOAD ${item.dependingOn}`);
            this.emit(`PUSH_INT ${index}`);
            this.emit('GT');
            this.emit(`JZ ${skip}`);
          }
          this.emit(`LOAD ${value}`);
          this.emitSlice(() => this.emit(`LOAD ${offset}`), () => {
            this.emit(`LOAD ${offset}`);
            this.emit(`PUSH_INT ${length}`);
            this.emit('ADD');
          });
          this.emitDisplayReceiverConversion(item);
          this.emit(`STORE ${item.dimensions.length ? `${childName}_${index}` : childName}`);
          this.emit(`LOAD ${offset}`);
          this.emit(`PUSH_INT ${length}`);
          this.emit('ADD');
          this.emit(`STORE ${offset}`);
          if (skip) this.emit(`${skip}:`);
        }
      };
      this.fieldOf(name).children.forEach(assign);
      const state = this.ensureRawGroupState(name, field);
      this.emit(`LOAD ${value}`);
      this.emitReceiverConversion({ kind: 'string', length: field.length }, false);
      this.emit(`STORE ${state.value}`);
    } else this.storeInto(name, rounded);
  }

  collectFileMetadata(tree) {
    const selects = [];
    const descriptions = new Map();
    const reportDescriptions = new Map();
    const walk = node => {
      if (!node) return;
      if (node.constructor?.name === 'FileControlClauseContext') selects.push(node);
      if (node.constructor?.name === 'FileDescriptionEntryContext') {
        const name = storageName(node.IDENTIFIER()?.getText());
        if (name) descriptions.set(name, node);
      }
      if (node.constructor?.name === 'ReportDescriptionEntryContext') {
        const name = storageName(node.IDENTIFIER()?.getText());
        if (name) reportDescriptions.set(name, node);
      }
      for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) walk(node.getChild(index));
    };
    walk(tree);

    for (const select of selects) {
      const name = storageName(select.IDENTIFIER()?.getText());
      const clauses = select.selectClause() || [];
      const organization = clauses.find(clause => clause.fileOrgClause?.())?.fileOrgClause?.();
      const access = clauses.find(clause => clause.accessModeClause?.())?.accessModeClause();
      const recordKey = clauses.find(clause => clause.recordKeyClause?.())?.recordKeyClause?.();
      const relativeKey = clauses.find(clause => clause.relativeKeyClause?.())?.relativeKeyClause?.();
      const fileStatus = clauses.find(clause => clause.fileStatusClause?.())?.fileStatusClause?.();
      const fileSource = unquote(text(select.fileSource()));
      const pathParts = fileSource.replace(/\\/g, '/').split('/');
      const root = pathParts.length > 1 ? pathParts.shift() : 'data';
      const relativePath = pathParts.join('/');
      const description = descriptions.get(name);
      let ownerNode = description;
      while (ownerNode && ownerNode.constructor?.name !== 'ProgramUnitContext') ownerNode = ownerNode.parentCtx;
      const ownerProgram = this.programs.find(program => program.node === ownerNode) || this.programs[0];
      const resolveFileDataName = sourceName => this.resolveProgramDataName(ownerProgram, storageName(sourceName))
        || storageName(sourceName);
      const records = description?.dataDescriptionEntry?.() || [];
      const recordEntries = records.filter(entry => text(entry.fileLevelNumber?.()) === '01');
      const recordEntry = recordEntries[0] || records[0] || null;
      const reportFileClause = (description?.fileDescClause?.() || [])
        .find(clause => clause.reportFileClause?.())?.reportFileClause?.();
      const reportName = storageName(reportFileClause?.IDENTIFIER()?.getText());
      const reportRecordName = reportName ? `__COBOL_REPORT_RECORD_${name}` : null;
      const recordName = resolveFileDataName(recordEntry?.IDENTIFIER()?.getText()) || reportRecordName;
      const indexedKeyName = resolveFileDataName(recordKey?.IDENTIFIER?.()?.getText());
      const relativeKeyName = resolveFileDataName(relativeKey?.IDENTIFIER?.()?.getText());
      const statusName = resolveFileDataName(fileStatus?.IDENTIFIER?.()?.getText());
      const organizationText = text(organization).toUpperCase();
      const organizationKind = organizationText.includes('INDEXED')
        ? 'INDEXED' : organizationText.includes('RELATIVE') ? 'RELATIVE' : 'SEQUENTIAL';
      const recordVaryingClause = (description?.fileDescClause?.() || [])
        .find(clause => clause.recordVaryingClause?.())?.recordVaryingClause?.();
      const varyingSizes = asArray(recordVaryingClause?.cobolNumber?.());
      const linageClause = (description?.fileDescClause?.() || [])
        .find(clause => clause.linageClause?.())?.linageClause?.();
      const linageValues = asArray(linageClause?.linageValue?.());
      let linageValueIndex = 0;
      const nextLinageValue = () => {
        const value = text(linageValues[linageValueIndex++]);
        return value ? storageName(value) : null;
      };
      const linage = linageClause ? {
        pageSize: nextLinageValue(),
        footing: linageClause.FOOTING?.() ? nextLinageValue() : null,
        top: linageClause.TOP?.() ? nextLinageValue() : null,
        bottom: linageClause.BOTTOM?.() ? nextLinageValue() : null
      } : null;
      const alternateKeys = clauses.filter(clause => clause.alternateKeyClause?.())
        .map(clause => {
          const alternate = clause.alternateKeyClause();
        const alternateName = resolveFileDataName(alternate.IDENTIFIER().getText());
          const field = this.fieldOf(alternateName);
          if (!field || field.dimensions.length || field.kind === 'group') {
            throw new Error(`[COBOLISH] ALTERNATE RECORD KEY ${alternateName} must be an elementary, non-table record item`);
          }
          return {
            name: alternateName,
            offset: this.fieldOffsetWithin(recordName, alternateName),
            length: this.fieldLength(field),
            duplicates: Boolean(alternate.DUPLICATES?.())
          };
        });
      const file = {
        name,
        source: fileSource,
        root,
        path: relativePath,
        organization: organizationKind,
        access: access ? text(access).toUpperCase().replace(/^ACCESSMODE(?:IS)?/, '') : 'SEQUENTIAL',
        keyName: organizationKind === 'INDEXED' ? indexedKeyName
          : organizationKind === 'RELATIVE' ? relativeKeyName : '__COBOL_SEQUENTIAL_KEY__',
        relativeKeyName,
        optional: Boolean(select.optionalFileClause?.()),
        recordNames: recordEntries.map(entry => resolveFileDataName(entry.IDENTIFIER()?.getText()))
          .concat(reportRecordName ? [reportRecordName] : []),
        recordVarying: recordVaryingClause ? {
          minimum: varyingSizes[0] ? Number(text(varyingSizes[0])) : null,
          maximum: varyingSizes.at(-1) ? Number(text(varyingSizes.at(-1))) : null,
          dependingOn: storageName(recordVaryingClause.IDENTIFIER()?.getText())
        } : null,
        linage,
        alternateKeys,
        statusName,
        recordName,
        reportName,
        sortDescription: Boolean(description?.SD?.()),
        handleName: `__ISAM_HANDLE_${name}`,
        currentKeyName: `__FILE_CURRENT_KEY_${name}`,
        sequenceCounterName: `__FILE_SEQUENCE_${name}`,
        linageCounterName: linage ? `__FILE_LINAGE_COUNTER_${name}` : null
      };
      this.files.set(name, file);
      for (const record of file.recordNames) this.filesByRecord.set(record, file);
      if (reportRecordName) {
        this.fields.set(reportRecordName, { kind: 'string', length: 132, dimensions: [] });
      }
      this.fields.set(file.handleName, { kind: 'decimal', precision: 10, scale: 0 });
      this.fields.set(file.currentKeyName, { kind: 'string', length: 256 });
      this.fields.set(file.sequenceCounterName, { kind: 'decimal', precision: 10, scale: 0 });
      if (file.sortDescription) {
        file.sortState = {
          buffer: this.nextHiddenStringField(0),
          size: this.nextHiddenField(),
          cursor: this.nextHiddenField(),
          phase: this.nextHiddenField()
        };
        this.fields.set('SORT_RETURN', { kind: 'decimal', precision: 2, scale: 0, dimensions: [] });
      }
      if (reportName) {
        const reportDescription = reportDescriptions.get(reportName);
        if (!reportDescription) {
          throw new Error(`[COBOLISH] Report ${reportName} referenced by file ${name} has no RD description`);
        }
        this.fields.set('LINE_COUNTER', { kind: 'decimal', precision: 10, scale: 0, dimensions: [] });
        this.fields.set('PAGE_COUNTER', { kind: 'decimal', precision: 10, scale: 0, dimensions: [] });
        this.fields.set('__COBOL_RW_SUPPRESS', { kind: 'decimal', precision: 1, scale: 0, dimensions: [] });
        this.reports.set(reportName, this.collectReportMetadata(reportDescription, file, ownerProgram));
      }
      if (linage) {
        this.fields.set(file.linageCounterName, { kind: 'decimal', precision: 10, scale: 0, dimensions: [] });
        this.fields.set('LINAGE_COUNTER', { kind: 'decimal', precision: 10, scale: 0, dimensions: [] });
      }
      if (file.recordVarying?.dependingOn) {
        const candidates = this.dataNameKeys.get(file.recordVarying.dependingOn) || [];
        if (candidates.length !== 1) {
          throw new Error(`[COBOLISH] RECORD VARYING item ${file.recordVarying.dependingOn} must resolve to one data item`);
        }
        file.recordVarying.dependingOn = candidates[0];
      }
    }
  }

  collectReportMetadata(description, file, ownerProgram) {
    const reportName = storageName(description.IDENTIFIER()?.getText());
    const clauses = asArray(description.reportDescriptionClause?.());
    const limits = clauses.find(clause => clause.LIMIT?.() || clause.LIMITS?.());
    const limitValues = asArray(limits?.cobolNumber?.()).map(value => Number(text(value)));
    let valueIndex = 0;
    const pageLimit = limitValues[valueIndex++] || 60;
    const headingLine = limits?.HEADING?.() ? limitValues[valueIndex++] : null;
    const firstDetail = limits?.FIRST?.() ? limitValues[valueIndex++] : 1;
    const lastDetail = limits?.LAST?.() ? limitValues[valueIndex++] : pageLimit;
    const footingLine = limits?.FOOTING?.() ? limitValues[valueIndex] : null;

    const controls = [{ sourceName: 'FINAL', key: null }];
    let hasFinal = false;
    const controlClause = clauses.find(clause => clause.CONTROL?.() || clause.CONTROLS?.());
    for (const word of reportClauseWords(controlClause).slice(1)) {
      if (typeof word !== 'string' || ['IS', 'ARE', ','].includes(word)) continue;
      if (word === 'FINAL') {
        if (controls.length > 1 || hasFinal) throw new Error(`[COBOLISH] FINAL must be the first control of report ${reportName}`);
        hasFinal = true;
        continue;
      }
      const sourceName = storageName(word);
      const key = this.resolveProgramDataName(ownerProgram, sourceName);
      if (!key) throw new Error(`[COBOLISH] Control ${sourceName} of report ${reportName} is not a data item`);
      const field = this.fieldOf(key);
      if (field.dimensions?.length) throw new Error(`[COBOLISH] Control ${sourceName} must not be a table`);
      this.hiddenFieldId += 1;
      const saved = `__COBOL_RW_CTL_${this.hiddenFieldId}`;
      this.fields.set(saved, field.kind === 'decimal'
        ? { kind: 'decimal', precision: 18, scale: field.scale, signed: true, dimensions: [] }
        : { kind: 'string', length: this.fieldLength(field), dimensions: [] });
      controls.push({ sourceName, key, decimal: field.kind === 'decimal', saved });
    }
    const controlLevel = (name, groupName) => {
      if (!name || name === 'FINAL') return 0;
      const level = controls.findIndex(control => control.sourceName === storageName(name));
      if (level < 1) throw new Error(`[COBOLISH] Report group ${groupName} names ${name}, which is not a control of ${reportName}`);
      return level;
    };

    const stateField = () => this.nextHiddenField();
    const report = {
      name: reportName,
      file,
      program: ownerProgram,
      pageLimit,
      headingLine,
      firstDetail,
      lastDetail,
      footingLine,
      controls,
      groups: [],
      counters: [],
      started: stateField(),
      groupIndicate: stateField(),
      nextPage: stateField()
    };

    let currentGroup = null;
    let currentLine = null;
    const typeNames = {
      RH: 'REPORT_HEADING', PH: 'PAGE_HEADING', CH: 'CONTROL_HEADING', DE: 'DETAIL',
      CF: 'CONTROL_FOOTING', PF: 'PAGE_FOOTING', RF: 'REPORT_FOOTING', DETAIL: 'DETAIL'
    };
    for (const entry of description.reportGroupDescriptionEntry?.() || []) {
      const entryLevel = Number(text(entry.fileLevelNumber?.()));
      const entryName = entry.IDENTIFIER?.() ? storageName(entry.IDENTIFIER().getText()) : null;
      const groupClauses = entry.reportGroupClause?.() || [];
      const typeClause = groupClauses.find(clause => clause.TYPE?.());
      if (typeClause) {
        if (entryLevel !== 1) throw new Error(`[COBOLISH] TYPE clause must appear on a level 01 report group in ${reportName}`);
        const words = reportClauseWords(typeClause).filter(word => word !== 'TYPE' && word !== 'IS');
        let type;
        let controlName = null;
        if (['REPORT', 'PAGE', 'CONTROL'].includes(words[0])) {
          type = `${words[0]}_${words[1]}`;
          controlName = words[2] || null;
        } else {
          type = typeNames[words[0]];
          controlName = words[1] || null;
        }
        if (!type) throw new Error(`[COBOLISH] Unsupported report group TYPE ${words.join(' ')}`);
        const isControl = type === 'CONTROL_HEADING' || type === 'CONTROL_FOOTING';
        if (isControl && !controlName) {
          throw new Error(`[COBOLISH] ${type.replace('_', ' ')} group ${entryName || ''} requires a control name`);
        }
        if (!isControl && controlName) throw new Error(`[COBOLISH] Unexpected control name in TYPE ${words.join(' ')}`);
        if (controlName === 'FINAL' && !hasFinal) throw new Error(`[COBOLISH] Report ${reportName} does not declare CONTROL FINAL`);
        currentGroup = {
          name: entryName,
          type,
          level: isControl ? controlLevel(controlName, entryName) : null,
          lines: [],
          nextGroup: null,
          counters: []
        };
        if (currentGroup.name && report.groups.some(group => group.name === currentGroup.name)) {
          throw new Error(`[COBOLISH] Duplicate report group ${currentGroup.name} in ${reportName}`);
        }
        report.groups.push(currentGroup);
        currentLine = null;
      } else if (entryLevel === 1) {
        throw new Error(`[COBOLISH] Report group ${entryName || ''} in ${reportName} requires a TYPE clause`);
      }
      if (!currentGroup) continue;

      const item = {
        name: entryName, column: null, picture: null, edited: null, source: null, value: null, sum: null,
        groupIndicate: false, justified: false, blankWhenZero: false
      };
      let lineSpec = null;
      for (const clause of groupClauses) {
        const words = reportClauseWords(clause);
        const number = asArray(clause.cobolNumber?.())[0];
        if (words[0] === 'LINE') {
          lineSpec = words.includes('NEXT')
            ? { absolute: null, relative: 1, nextPage: true }
            : words.includes('PLUS')
              ? { absolute: null, relative: Number(text(number)), nextPage: false }
              : { absolute: Number(text(number)), relative: 0, nextPage: false };
        } else if (words[0] === 'NEXT') {
          if (entryLevel !== 1) throw new Error(`[COBOLISH] NEXT GROUP must appear on the report group entry ${currentGroup.name || ''}`);
          currentGroup.nextGroup = words.includes('PAGE')
            ? { kind: 'page' }
            : { kind: words.includes('PLUS') ? 'plus' : 'absolute', value: Number(text(number)) };
        } else if (words[0] === 'SUM') {
          item.sum ||= { operands: [], upon: [], reset: null };
          item.sum.operands.push(...asArray(clause.dataReference?.()));
          let mode = null;
          for (const word of words) {
            if (word === 'UPON' || word === 'RESET') mode = word;
            else if (typeof word === 'string' && !['ON', ','].includes(word)) {
              if (mode === 'UPON') item.sum.upon.push(storageName(word));
              else if (mode === 'RESET') item.sum.reset = word;
            }
          }
        } else if (words[0] === 'GROUP') {
          item.groupIndicate = true;
        } else if (words[0] === 'JUSTIFIED') {
          item.justified = true;
        } else if (words[0] === 'BLANK') {
          item.blankWhenZero = true;
        } else if (words[0] === 'COLUMN') {
          item.column = Number(text(number)) || 1;
        } else if (clause.pictureClause?.()) {
          item.edited = editedPictureInfo(text(clause.pictureClause()));
          item.picture = item.edited
            ? { kind: 'string', length: item.edited.length }
            : parsePicture(text(clause.pictureClause()));
        } else if (words[0] === 'SOURCE') {
          item.source = asArray(clause.dataReference())[0];
        } else if (words[0] === 'VALUE') {
          item.value = clause.literal();
        }
      }

      if (lineSpec) {
        if (currentLine && !currentLine.items.length) Object.assign(currentLine, lineSpec);
        else {
          currentLine = { ...lineSpec, items: [] };
          currentGroup.lines.push(currentLine);
        }
      }
      if (item.sum) {
        if (currentGroup.type !== 'CONTROL_FOOTING') {
          throw new Error(`[COBOLISH] SUM clause is only supported in CONTROL FOOTING groups (${reportName})`);
        }
        if (!item.picture || item.picture.kind === 'group') {
          throw new Error(`[COBOLISH] SUM item ${item.name || ''} in ${reportName} requires a numeric PICTURE`);
        }
        const scale = item.edited ? editedPictureScale(item.edited.mask, this.decimalPointComma) : item.picture.scale || 0;
        let key;
        if (item.name && item.name !== 'FILLER') {
          key = `${ownerProgram.prefix}${item.name}`;
          if (this.fields.has(key)) throw new Error(`[COBOLISH] SUM counter ${item.name} duplicates a data name`);
          this.registerProgramDataName(ownerProgram, item.name, key);
        } else {
          this.hiddenFieldId += 1;
          key = `__COBOL_RW_SUM_${this.hiddenFieldId}`;
        }
        this.fields.set(key, {
          kind: 'decimal', precision: 18, scale, signed: true, dimensions: [], children: [],
          sourceName: item.name, path: [item.name || key], programKey: ownerProgram.key
        });
        const counter = {
          key,
          sourceName: item.name,
          group: currentGroup,
          level: currentGroup.level,
          operands: item.sum.operands,
          upon: item.sum.upon,
          resetLevel: item.sum.reset ? controlLevel(item.sum.reset, currentGroup.name) : currentGroup.level,
          rollFrom: []
        };
        if (counter.resetLevel > counter.level) {
          throw new Error(`[COBOLISH] RESET ON for ${item.name || 'SUM counter'} must name a higher control level`);
        }
        currentGroup.counters.push(counter);
        report.counters.push(counter);
        item.counter = key;
      }
      const printable = item.column !== null && (item.value || item.source || item.counter);
      if (item.column !== null && !printable) {
        throw new Error(`[COBOLISH] Report item in ${currentGroup.name || reportName} requires SOURCE, VALUE or SUM`);
      }
      if (printable) {
        if (!item.picture) throw new Error(`[COBOLISH] Report item in ${currentGroup.name || reportName} requires a PICTURE`);
        if (item.groupIndicate && currentGroup.type !== 'DETAIL') {
          throw new Error('[COBOLISH] GROUP INDICATE is only allowed in DETAIL report groups');
        }
        if (!currentLine) {
          currentLine = { absolute: null, relative: 1, nextPage: false, items: [] };
          currentGroup.lines.push(currentLine);
        }
        currentLine.items.push(item);
      }
    }

    for (const counter of report.counters) {
      counter.dataOperands = [];
      for (const operand of counter.operands) {
        const operandName = storageName(operand.IDENTIFIER().getText());
        const source = report.counters.find(candidate => candidate.sourceName === operandName);
        if (source) {
          if (source.level < counter.level || (source.level === counter.level && source.group === counter.group)) {
            throw new Error(`[COBOLISH] SUM counter ${operandName} can only be rolled forward to a higher control level`);
          }
          source.rollFrom.push(counter);
        } else counter.dataOperands.push(operand);
      }
      for (const name of counter.upon) {
        if (!report.groups.some(group => group.type === 'DETAIL' && group.name === name)) {
          throw new Error(`[COBOLISH] SUM UPON ${name} does not name a detail group of ${reportName}`);
        }
      }
    }
    for (const group of report.groups) {
      if ((group.type === 'CONTROL_HEADING' || group.type === 'CONTROL_FOOTING')
        && report.groups.some(other => other !== group && other.type === group.type && other.level === group.level)) {
        throw new Error(`[COBOLISH] Report ${reportName} has more than one ${group.type.replace('_', ' ')} for one control`);
      }
      for (const line of group.lines) line.items.sort((left, right) => left.column - right.column);
    }
    return report;
  }

  collectDeclaratives(tree) {
    const visit = node => {
      if (!node) return;
      if (node.constructor?.name === 'DeclarativeSectionContext') {
        const sectionName = storageName(node.IDENTIFIER()?.getText());
        const paragraphs = asArray(node.paragraph?.());
        const target = {
          first: storageName(paragraphs[0]?.paragraphName?.()?.getText() || sectionName),
          last: storageName(paragraphs.at(-1)?.paragraphName?.()?.getText() || sectionName)
        };
        this.declarativeSections.add(sectionName);
        this.declarativeParagraphs.add(sectionName);
        for (const paragraph of paragraphs) {
          this.declarativeParagraphs.add(storageName(paragraph.paragraphName()?.getText()));
          this.declarativeProcedureNodes.push(paragraph);
        }
        const use = node.useStatement?.();
        if (use && /DEBUGGING/i.test(text(use))) {
          const targets = asArray(use.debugTarget?.());
          for (const target of targets) {
            const targetName = storageName(target.paragraphName?.()?.getText?.() || '');
            const debugParagraph = storageName(paragraphs[0]?.paragraphName?.()?.getText?.() || sectionName);
            if (target.ALL?.()) this.debugHooks.set('*', debugParagraph);
            else if (targetName) this.debugHooks.set(targetName, debugParagraph);
          }
        } else if (use && use.REPORTING?.()) {
          if (!paragraphs.length) throw new Error('[COBOLISH] USE BEFORE REPORTING requires a paragraph');
          const groupName = storageName(use.IDENTIFIER().getText());
          if (this.reportDeclaratives.has(groupName)) {
            throw new Error(`[COBOLISH] Multiple USE BEFORE REPORTING procedures are assigned to ${groupName}`);
          }
          this.reportDeclaratives.set(groupName, target);
        } else if (use) {
          const files = asArray(use.identifierList?.()?.IDENTIFIER?.())
            .map(identifier => storageName(identifier.getText()));
          if (!paragraphs.length) {
            throw new Error('[COBOLISH] USE AFTER STANDARD ERROR PROCEDURE requires a paragraph');
          }
          if (!files.length) {
            throw new Error('[COBOLISH] USE AFTER STANDARD ERROR PROCEDURE requires named files');
          }
          for (const file of files) {
            if (this.fileDeclaratives.has(file)) {
              throw new Error(`[COBOLISH] Multiple declarative error procedures are assigned to ${file}`);
            }
            this.fileDeclaratives.set(file, target);
          }
        }
        return;
      }
      for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) {
        visit(node.getChild(index));
      }
    };
    visit(tree);
    this.debuggingMode = String(tree.getText?.() || '').toUpperCase().includes('WITHDEBUGGINGMODE');
    if (this.debugHooks.size) {
      this.fields.set('DEBUG_NAME', { kind: 'string', length: 30, signed: false, pascalishType: 'string', dimensions: [] });
      this.fields.set('DEBUG_CONTENTS', { kind: 'string', length: 30, signed: false, pascalishType: 'string', dimensions: [] });
      this.initialValues.set('DEBUG_NAME', { getText: () => 'SPACES' });
      this.initialValues.set('DEBUG_CONTENTS', { getText: () => 'SPACES' });
      this.dataNameKeys.set('DEBUG_NAME', ['DEBUG_NAME']);
      this.dataNameKeys.set('DEBUG_CONTENTS', ['DEBUG_CONTENTS']);
    }
    for (const groupName of this.reportDeclaratives.keys()) {
      if (![...this.reports.values()].some(report => report.groups.some(group => group.name === groupName))) {
        throw new Error(`[COBOLISH] USE BEFORE REPORTING references unknown report group ${groupName}`);
      }
    }
    for (const name of this.fileDeclaratives.keys()) {
      const file = this.files.get(name);
      if (!file) throw new Error(`[COBOLISH] Declarative error procedure references unknown file ${name}`);
      file.declarativeActiveName = `__COBOL_DECL_ACTIVE_${name}`;
      this.fields.set(file.declarativeActiveName, { kind: 'decimal', precision: 1, scale: 0 });
    }
  }

  fileOf(name) {
    const file = this.files.get(storageName(name));
    if (!file) throw new Error(`[COBOLISH] File ${name} has no SELECT declaration`);
    if (file.organization === 'INDEXED' && !file.keyName) throw new Error(`[COBOLISH] Indexed file ${name} has no RECORD KEY`);
    if (file.organization === 'RELATIVE' && !file.relativeKeyName) throw new Error(`[COBOLISH] Relative file ${name} has no RELATIVE KEY`);
    if (!file.root || !file.path) throw new Error(`[COBOLISH] File ${name} ASSIGN TO must use root/path form`);
    if (!file.recordName || !this.fieldOf(file.recordName)) throw new Error(`[COBOLISH] File ${name} has no declared record`);
    if (file.organization === 'RELATIVE') {
      const key = this.fieldOf(file.relativeKeyName);
      if (key?.kind !== 'decimal' || key.scale !== 0) {
        throw new Error(`[COBOLISH] RELATIVE KEY ${file.relativeKeyName} must be an integer data item`);
      }
    }
    return file;
  }

  emitRelativeKey(file) {
    const field = this.fieldOf(file.relativeKeyName);
    this.emit(`LOAD ${file.relativeKeyName}`);
    this.emit(`DEC_DISPLAY ${field.precision} 0`);
  }

  fileBackendKeyName(file) {
    if (file.organization === 'INDEXED' && (file.access === 'SEQUENTIAL' || file.alternateKeys.length)) {
      return `__COBOL_FILE_V1__:${JSON.stringify({
        keyName: file.keyName,
        organization: file.organization,
        access: file.access,
        alternateKeys: file.alternateKeys
      })}`;
    }
    if (file.organization === 'RELATIVE') return `__RELATIVE__:${file.relativeKeyName}`;
    if (file.organization === 'SEQUENTIAL') return '__SEQUENTIAL__';
    return file.keyName;
  }

  emitDeclarativeCall(target) {
    const exitFlag = `__COBOL_PEXIT_${target.last}`;
    const savedExitFlag = this.nextHiddenField();
    this.emit(`LOAD ${exitFlag}`);
    this.emit(`STORE ${savedExitFlag}`);
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${exitFlag}`);
    this.emit(`CALL PARA_${target.first} 0`);
    this.emit(`LOAD ${savedExitFlag}`);
    this.emit(`STORE ${exitFlag}`);
  }

  emitFileKey(file, rewrite = false) {
    if (file.organization === 'INDEXED') {
      this.emit(`LOAD ${file.keyName}`);
    } else if (file.organization === 'RELATIVE') {
      if (file.access === 'SEQUENTIAL' && !rewrite) {
        this.emit(`LOAD ${file.sequenceCounterName}`);
        this.emit('PUSH_INT 1');
        this.emit('ADD');
        this.emit(`STORE ${file.sequenceCounterName}`);
        this.emit(`LOAD ${file.sequenceCounterName}`);
        this.storeNamedReference(file.relativeKeyName);
      }
      this.emitRelativeKey(file);
    } else if (rewrite) {
      this.emit(`LOAD ${file.currentKeyName}`);
    } else {
      this.emit(`LOAD ${file.sequenceCounterName}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.emit(`STORE ${file.sequenceCounterName}`);
      this.emit(`LOAD ${file.sequenceCounterName}`);
      this.emit('DEC_DISPLAY 10 0');
    }
  }

  emitFileStatus(file) {
    if (file.statusName) {
      if (!this.fieldOf(file.statusName)) {
        throw new Error(`[COBOLISH] FILE STATUS item ${file.statusName} is not declared`);
      }
      this.emit(`LOAD ${file.handleName}`);
      this.emit('CALL_EXT host.isam_status 1');
      this.emit(`STORE ${file.statusName}`);
    }
    this.emitFileDeclarativeHandler(file);
  }

  emitFileDeclarativeHandler(file, statusSource = file.statusName, knownStatus = null) {
    const target = this.fileDeclaratives.get(file.name);
    if (!target) return;

    const end = this.nextLabel('DECLARATIVE_END');
    if (knownStatus !== null) {
      if (['00', '02', '04', '05', '10', '46'].includes(knownStatus)) return;
    } else {
      for (const status of ['00', '02', '04', '05', '10', '46']) {
        const nextStatus = this.nextLabel('DECLARATIVE_STATUS_NEXT');
        if (statusSource) this.emit(`LOAD ${statusSource}`);
        else {
          this.emit(`LOAD ${file.handleName}`);
          this.emit('CALL_EXT host.isam_status 1');
        }
        this.emit(`PUSH_STR ${JSON.stringify(status)}`);
        this.emit('STREQ');
        this.emit(`JZ ${nextStatus}`);
        this.emit(`JMP ${end}`);
        this.emit(`${nextStatus}:`);
      }
    }

    this.emit(`LOAD ${file.declarativeActiveName}`);
    this.emit('PUSH_INT 0');
    this.emit('EQ');
    this.emit(`JZ ${end}`);
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${file.declarativeActiveName}`);
    this.emitDeclarativeCall(target);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${file.declarativeActiveName}`);
    this.emit(`${end}:`);
  }

  emitReadRecord(file, recordName, intoTarget = null) {
    if (!file.recordVarying) {
      this.emit(`LOAD ${recordName}`);
      this.storeNamedReference(file.recordName);
      if (intoTarget && intoTarget !== file.recordName) {
        this.emitNamedReference(file.recordName);
        this.storeNamedReference(intoTarget);
      }
      return;
    }

    const lengthName = this.nextHiddenField();
    const endLabel = this.nextLabel('READ_RECORD_END');
    this.emit(`LOAD ${recordName}`);
    this.emit('CALL_EXT host.string_length 1');
    this.emit(`STORE ${lengthName}`);
    this.emit(`LOAD ${lengthName}`);
    this.storeNamedReference(file.recordVarying.dependingOn);
    for (const candidate of file.recordNames) {
      const nextCandidate = this.nextLabel('READ_RECORD_NEXT');
      this.emit(`LOAD ${lengthName}`);
      this.emit(`PUSH_INT ${this.fieldLength(this.fieldOf(candidate))}`);
      this.emit('EQ');
      this.emit(`JZ ${nextCandidate}`);
      this.emit(`LOAD ${recordName}`);
      this.storeNamedReference(candidate);
      if (intoTarget && intoTarget !== candidate) {
        this.emitNamedReference(candidate);
        this.storeNamedReference(intoTarget);
      }
      this.emit(`JMP ${endLabel}`);
      this.emit(`${nextCandidate}:`);
    }
    this.emit(`LOAD ${recordName}`);
    this.storeNamedReference(file.recordName);
    if (intoTarget && intoTarget !== file.recordName) {
      this.emitNamedReference(file.recordName);
      this.storeNamedReference(intoTarget);
    }
    this.emit(`${endLabel}:`);
  }

  emitIntegerValue(value) {
    if (/^\d+$/.test(String(value))) this.emit(`PUSH_INT ${value}`);
    else {
      this.emit(`LOAD ${storageName(value)}`);
      this.emit('DEC_STR');
      this.emit('PARSE_INT');
    }
  }

  emitPrinterControlRecord(file, page) {
    if (file.organization !== 'SEQUENTIAL') {
      throw new Error('[COBOLISH] WRITE ADVANCING requires a sequential print file');
    }
    const recordLength = Math.max(...file.recordNames.map(name => this.fieldLength(this.fieldOf(name))));
    const value = page ? `\f${' '.repeat(Math.max(0, recordLength - 1))}` : ' '.repeat(recordLength);
    this.emit(`LOAD ${file.handleName}`);
    this.emitFileKey(file);
    this.emit(`PUSH_STR ${JSON.stringify(value)}`);
    this.emit('CALL_EXT host.isam_write 3');
    this.emit(`STORE ${this.nextHiddenField()}`);
    this.emitFileStatus(file);
  }

  emitPrinterAdvance(file, spec) {
    if (Boolean(spec.PAGE?.())) {
      this.emitPrinterControlRecord(file, true);
      return;
    }
    const amount = asArray(spec.cobolNumber?.())[0];
    const reference = spec.dataReference?.();
    if (amount) this.emitIntegerValue(text(amount));
    else if (reference) {
      this.emitReference(reference);
      this.emit('DEC_STR');
      this.emit('PARSE_INT');
    } else throw new Error('[COBOLISH] WRITE ADVANCING requires a line count or PAGE');
    const remaining = this.nextHiddenField();
    const loop = this.nextLabel('PRINTER_ADVANCE');
    const end = this.nextLabel('PRINTER_ADVANCE_END');
    this.emit('PUSH_INT 1');
    this.emit('SUB');
    this.emit(`STORE ${remaining}`);
    this.emit(`${loop}:`);
    this.emit(`LOAD ${remaining}`);
    this.emit('PUSH_INT 0');
    this.emit('GT');
    this.emit(`JZ ${end}`);
    this.emitPrinterControlRecord(file, false);
    this.emit(`LOAD ${remaining}`);
    this.emit('PUSH_INT 1');
    this.emit('SUB');
    this.emit(`STORE ${remaining}`);
    this.emit(`JMP ${loop}`);
    this.emit(`${end}:`);
  }

  emitLinageAdvance(file, amount, page, endOfPageClauses) {
    if (!file.linage) return;
    if (page) {
      this.emit('PUSH_INT 1');
      this.emit(`STORE ${file.linageCounterName}`);
    } else {
      this.emit(`LOAD ${file.linageCounterName}`);
      this.emitIntegerValue(amount);
      this.emit('ADD');
      this.emit(`STORE ${file.linageCounterName}`);
    }
    this.emit(`LOAD ${file.linageCounterName}`);
    this.emit('DEC_DISPLAY 10 0');
    this.emit('STORE LINAGE_COUNTER');
    const endOfPage = this.nextLabel('LINAGE_END_PAGE');
    const notEndOfPage = this.nextLabel('LINAGE_NOT_END_PAGE');
    const finished = this.nextLabel('LINAGE_ADVANCE_END');
    if (page) this.emit(`JMP ${endOfPage}`);
    else {
      const threshold = file.linage.footing || file.linage.pageSize;
      this.emit(`LOAD ${file.linageCounterName}`);
      if (!file.linage.footing && file.linage.bottom) {
        this.emitIntegerValue(file.linage.pageSize);
        this.emitIntegerValue(file.linage.bottom);
        this.emit('SUB');
      } else this.emitIntegerValue(threshold);
      this.emit('GE');
      this.emit(`JZ ${notEndOfPage}`);
      this.emit(`${endOfPage}:`);
    }
    this.emitPrinterControlRecord(file, true);
    for (const clause of endOfPageClauses) {
      if (!clause.NOT?.()) {
        for (const sentence of clause.sentence?.() || []) this.visitSentenceNode(sentence);
      }
    }
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${file.linageCounterName}`);
    this.emit('PUSH_INT 1');
    this.emit('STORE LINAGE_COUNTER');
    this.emit(`JMP ${finished}`);
    this.emit(`${notEndOfPage}:`);
    for (const clause of endOfPageClauses) {
      if (clause.NOT?.()) {
        for (const sentence of clause.sentence?.() || []) this.visitSentenceNode(sentence);
      }
    }
    this.emit(`${finished}:`);
  }

  emitAfterSuccessfulWrite(file, emitWriteEffects) {
    const checkStatus02 = this.nextLabel('WRITE_STATUS_02');
    const end = this.nextLabel('WRITE_EFFECTS_END');
    this.emit(`LOAD ${file.handleName}`);
    this.emit('CALL_EXT host.isam_status 1');
    this.emit('PUSH_STR "00"');
    this.emit('STREQ');
    this.emit(`JZ ${checkStatus02}`);
    emitWriteEffects();
    this.emit(`JMP ${end}`);
    this.emit(`${checkStatus02}:`);
    if (file.alternateKeys.length) {
      this.emit(`LOAD ${file.handleName}`);
      this.emit('CALL_EXT host.isam_status 1');
      this.emit('PUSH_STR "02"');
      this.emit('STREQ');
      this.emit(`JZ ${end}`);
      emitWriteEffects();
    }
    this.emit(`${end}:`);
  }

  emitWriteAdvance(file, spec, endOfPageClauses) {
    const page = Boolean(spec.PAGE?.());
    const amount = asArray(spec.cobolNumber?.())[0];
    const reference = spec.dataReference?.();
    if (!page && !amount && !reference) {
      throw new Error('[COBOLISH] WRITE ADVANCING requires a line count or PAGE');
    }
    const value = amount ? text(amount) : reference ? this.resolveDataName(reference) : '1';
    this.emitPrinterAdvance(file, spec);
    this.emitLinageAdvance(file, value, page, endOfPageClauses);
  }

  emitFileStatusBranch(file, successStatus, successSentences, failureSentences, additionalSuccessStatuses = []) {
    const endLabel = this.nextLabel('ISAM_END');
    for (const status of [successStatus, ...additionalSuccessStatuses]) {
      const nextStatus = this.nextLabel('ISAM_STATUS_NEXT');
      this.emit(`LOAD ${file.handleName}`);
      this.emit('CALL_EXT host.isam_status 1');
      this.emit(`PUSH_STR ${JSON.stringify(status)}`);
      this.emit('STREQ');
      this.emit(`JZ ${nextStatus}`);
      for (const sentence of successSentences || []) this.visitSentenceNode(sentence);
      this.emit(`JMP ${endLabel}`);
      this.emit(`${nextStatus}:`);
    }
    for (const sentence of failureSentences || []) this.visitSentenceNode(sentence);
    this.emit(`${endLabel}:`);
  }

  emitOpen(ctx) {
    let mode = 'INPUT';
    for (const child of ctx.children || []) {
      const kind = child.constructor?.name;
      if (kind === 'OpenModeContext') mode = text(child).toUpperCase();
      if (kind !== 'OpenFileItemContext') continue;
      if (child.REVERSED()) throw new Error('[COBOLISH] OPEN REVERSED is recognized but not yet implemented');
      const file = this.fileOf(child.IDENTIFIER().getText());
      if (file.sortDescription) throw new Error(`[COBOLISH] OPEN is not valid for SD file ${file.name}`);
      this.emitOpenFile(file, mode);
    }
  }

  emitOpenFile(file, mode) {
    const backendKeyName = this.fileBackendKeyName(file);
    const backendMode = file.optional ? `${mode}-OPTIONAL` : mode;
    const savedHandleName = this.nextHiddenField();
    const openSuccessLabel = this.nextLabel('ISAM_OPEN_SUCCESS');
    const openEndLabel = this.nextLabel('ISAM_OPEN_END');
    this.emit(`LOAD ${file.handleName}`);
    this.emit(`STORE ${savedHandleName}`);
    this.emit(`PUSH_STR ${JSON.stringify(file.root)}`);
    this.emit(`PUSH_STR ${JSON.stringify(file.path)}`);
    this.emit(`PUSH_STR ${JSON.stringify(backendKeyName)}`);
    this.emit(`PUSH_STR ${JSON.stringify(backendMode)}`);
    this.emit('CALL_EXT host.isam_open 4');
    this.emit(`STORE ${file.handleName}`);
    const openStatus = this.nextHiddenStringField(2);
    this.emit(`LOAD ${file.handleName}`);
    this.emit('CALL_EXT host.isam_status 1');
    this.emit(`STORE ${openStatus}`);
    this.emit(`LOAD ${openStatus}`);
    this.emit('PUSH_STR "41"');
    this.emit('EQ');
    this.emit(`JZ ${openSuccessLabel}`);
    this.emit(`LOAD ${file.handleName}`);
    this.emit('CALL_EXT host.isam_close 1');
    this.emit(`STORE ${this.nextHiddenField()}`);
    this.emit(`LOAD ${savedHandleName}`);
    this.emit(`STORE ${file.handleName}`);
    if (file.statusName) {
      this.emit('PUSH_STR "41"');
      this.emit(`STORE ${file.statusName}`);
    }
    this.emitFileDeclarativeHandler(file, file.statusName, '41');
    this.emit(`JMP ${openEndLabel}`);
    this.emit(`${openSuccessLabel}:`);
    this.emitFileStatus(file);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${file.sequenceCounterName}`);
    this.emit('PUSH_STR ""');
    this.emit(`STORE ${file.currentKeyName}`);
    if (file.linage) {
      this.emit('PUSH_INT 1');
      this.emit(`STORE ${file.linageCounterName}`);
      this.emit('PUSH_INT 1');
      this.emit('STORE LINAGE_COUNTER');
    }
    if ((file.organization === 'SEQUENTIAL'
      || (file.organization === 'RELATIVE' && file.access === 'SEQUENTIAL'))
      && (mode === 'EXTEND' || mode === 'I-O')) {
      this.emit(`LOAD ${file.handleName}`);
      this.emit('CALL_EXT host.isam_count 1');
      this.emit(`STORE ${file.sequenceCounterName}`);
    }
    this.emit(`${openEndLabel}:`);
    return openStatus;
  }

  emitClose(ctx) {
    for (const item of ctx.closeFileItem() || []) {
      if (item.REEL() || item.UNIT()) throw new Error('[COBOLISH] CLOSE REEL/UNIT is recognized but not yet implemented');
      const file = this.fileOf(item.IDENTIFIER().getText());
      if (file.sortDescription) throw new Error(`[COBOLISH] CLOSE is not valid for SD file ${file.name}`);
      this.emitCloseFile(file, Boolean(item.LOCK()));
    }
  }

  emitCloseFile(file, locked = false) {
    this.emit(`LOAD ${file.handleName}`);
    this.emit(`CALL_EXT host.isam_close${locked ? '_lock' : ''} 1`);
    const statusName = file.statusName || this.nextHiddenStringField(2);
    this.emit('DEC_DISPLAY 2 0');
    this.emit(`STORE ${statusName}`);
    this.emitFileDeclarativeHandler(file, statusName);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${file.handleName}`);
    this.emit('PUSH_STR ""');
    this.emit(`STORE ${file.currentKeyName}`);
    return statusName;
  }

  nextHiddenField() {
    this.hiddenFieldId += 1;
    const name = `__COBOL_TMP_${this.hiddenFieldId}`;
    this.fields.set(name, { kind: 'decimal', precision: 10, scale: 0 });
    return name;
  }

  nextHiddenStringField(length) {
    this.hiddenFieldId += 1;
    const name = `__COBOL_TMP_${this.hiddenFieldId}`;
    this.fields.set(name, { kind: 'string', length });
    return name;
  }

  sortFileOf(name) {
    const file = this.fileOf(name);
    if (!file.sortDescription || file.recordVarying || file.recordNames.length !== 1) {
      throw new Error(`[COBOLISH] SORT/MERGE requires a single fixed-length SD record for ${name}`);
    }
    if (this.fieldLength(this.fieldOf(file.recordName)) < 1) {
      throw new Error(`[COBOLISH] SD record ${file.recordName} must have a positive length`);
    }
    const validateLayout = name => {
      const field = this.fieldOf(name);
      if (field.kind === 'decimal' && field.signed && !field.separateSign) {
        throw new Error(`[COBOLISH] Signed SD item ${name} requires SIGN LEADING/TRAILING SEPARATE; embedded sign storage is not yet implemented`);
      }
      for (const child of field.children || []) validateLayout(child);
    };
    validateLayout(file.recordName);
    return file;
  }

  emitSort(ctx, merge = false) {
    const identifiers = asArray(ctx.IDENTIFIER());
    const file = this.sortFileOf(text(identifiers[0]));
    const state = file.sortState;
    const width = this.fieldLength(this.fieldOf(file.recordName));
    const collatingName = storageName(text(ctx.collatingSequencePhrase?.()?.IDENTIFIER()));
    const collating = collatingName ? this.alphabets.get(collatingName) : null;
    if (collatingName && !collating) throw new Error(`[COBOLISH] Unknown ALPHABET ${collatingName}`);
    const keys = ctx.sortKeyClause().flatMap(clause => clause.dataReference().map(reference => {
      const name = this.resolveDataName(reference);
      const field = this.fieldOf(name);
      if (!field || field.kind === 'group' || field.dimensions.length ||       reference.expression().length || this.isReferenceModified(reference)) {
        throw new Error(`[COBOLISH] SORT/MERGE key ${name} must be an elementary, unsubscripted SD item`);
      }
      return {
        field, offset: this.fieldOffsetWithin(file.recordName, name),
        length: this.fieldLength(field), descending: Boolean(clause.DESCENDING()), collating
      };
    }));
    const input = merge ? null : ctx.sortInput();
    const inputs = merge ? identifiers.slice(1) : asArray(input.IDENTIFIER?.());
    const output = ctx.sortOutput();
    const validateFile = identifier => {
      const external = this.fileOf(text(identifier));
      if (external.sortDescription || external.organization !== 'SEQUENTIAL' || external.recordVarying) {
        throw new Error(`[COBOLISH] SORT/MERGE USING/GIVING requires a fixed-length sequential FD file: ${external.name}`);
      }
      return external;
    };
    const inputFiles = inputs.map(validateFile);
    const outputFiles = asArray(output.IDENTIFIER?.()).map(validateFile);
    const done = this.nextLabel('SORT_DONE');
    const busy = this.nextLabel('SORT_BUSY');
    const exit = this.nextLabel('SORT_EXIT');
    this.emit(`LOAD ${state.phase}`);
    this.emit('PUSH_INT 0');
    this.emit('EQ');
    this.emit(`JZ ${busy}`);
    this.emit('PUSH_INT 0');
    this.emit('STORE SORT_RETURN');
    this.emit('PUSH_STR ""');
    this.emit(`STORE ${state.buffer}`);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${state.size}`);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${state.cursor}`);
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${state.phase}`);

    const mergeInput = merge ? this.nextHiddenStringField(0) : null;
    const mergeSize = merge ? this.nextHiddenField() : null;
    const merged = merge ? this.nextHiddenStringField(0) : null;
    for (const external of inputFiles) {
      if (merge) {
        this.emit('PUSH_STR ""');
        this.emit(`STORE ${mergeInput}`);
        this.emit('PUSH_INT 0');
        this.emit(`STORE ${mergeSize}`);
      }
      this.emitSortReadFile(external, merge ? mergeInput : state.buffer, merge ? mergeSize : state.size, width, done, merge ? keys : null);
      if (merge) {
        this.emitMergeBuffers(state.buffer, mergeInput, merged, width, keys);
        this.emit(`LOAD ${merged}`);
        this.emit(`STORE ${state.buffer}`);
        this.emit(`LOAD ${state.size}`);
        this.emit(`LOAD ${mergeSize}`);
        this.emit('ADD');
        this.emit(`STORE ${state.size}`);
      }
    }
    if (input?.procedureRange()) {
      const names = input.procedureRange().paragraphName().map(name => storageName(text(name)));
      this.emitProcedureRange(names[0], names.at(-1));
    }
    this.emit('LOAD SORT_RETURN');
    this.emit('PUSH_INT 0');
    this.emit('EQ');
    this.emit(`JZ ${done}`);
    if (!merge) this.emitSortOrder(state, width, keys);
    this.emit('PUSH_INT 2');
    this.emit(`STORE ${state.phase}`);
    for (const external of outputFiles) this.emitSortWriteFile(external, state, width, done);
    if (output.procedureRange()) {
      const names = output.procedureRange().paragraphName().map(name => storageName(text(name)));
      this.emitProcedureRange(names[0], names.at(-1));
    }
    this.emit(`${done}:`);
    for (const buffer of [state.buffer, mergeInput, merged].filter(Boolean)) {
      this.emit('PUSH_STR ""');
      this.emit(`STORE ${buffer}`);
    }
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${state.phase}`);
    this.emit(`JMP ${exit}`);
    this.emit(`${busy}:`);
    this.emit('PUSH_INT 16');
    this.emit('STORE SORT_RETURN');
    this.emit(`${exit}:`);
  }

  emitSortOpenFile(file, mode, errorExit) {
    const status = this.emitOpenFile(file, mode);
    const opened = this.nextLabel('SORT_OPENED');
    for (const accepted of mode === 'INPUT' ? ['00', '05'] : ['00']) {
      this.emit(`LOAD ${status}`);
      this.emit(`PUSH_STR "${accepted}"`);
      this.emit('STREQ');
      this.emit('NOT');
      this.emit(`JZ ${opened}`);
    }
    const alreadyOpen = this.nextLabel('SORT_ALREADY_OPEN');
    this.emit(`LOAD ${status}`);
    this.emit('PUSH_STR "41"');
    this.emit('STREQ');
    this.emit('NOT');
    this.emit(`JZ ${alreadyOpen}`);
    this.emitCloseFile(file);
    this.emit(`${alreadyOpen}:`);
    this.emit('PUSH_INT 16');
    this.emit('STORE SORT_RETURN');
    this.emit(`JMP ${errorExit}`);
    this.emit(`${opened}:`);
  }

  emitSortReadFile(file, buffer, size, width, errorExit, orderedKeys = null) {
    this.emitSortOpenFile(file, 'INPUT', errorExit);
    const loop = this.nextLabel('SORT_READ');
    const close = this.nextLabel('SORT_READ_CLOSE');
    const valid = this.nextLabel('SORT_READ_VALID');
    const failed = this.nextLabel('SORT_READ_FAILED');
    const record = this.nextHiddenStringField(width);
    const status = this.nextHiddenStringField(2);
    const previous = orderedKeys ? this.nextHiddenStringField(width) : null;
    const hasPrevious = orderedKeys ? this.nextHiddenField() : null;
    if (orderedKeys) {
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${hasPrevious}`);
    }
    this.emit(`${loop}:`);
    this.emit(`LOAD ${file.handleName}`);
    this.emit('CALL_EXT host.isam_read_next 1');
    this.emit(`STORE ${record}`);
    this.emitFileStatus(file);
    this.emit(`LOAD ${file.handleName}`);
    this.emit('CALL_EXT host.isam_status 1');
    this.emit(`STORE ${status}`);
    this.emit(`LOAD ${status}`);
    this.emit('PUSH_STR "10"');
    this.emit('STREQ');
    this.emit('NOT');
    this.emit(`JZ ${close}`);
    this.emit(`LOAD ${status}`);
    this.emit('PUSH_STR "00"');
    this.emit('STREQ');
    this.emit('NOT');
    this.emit(`JZ ${valid}`);
    this.emit(`${failed}:`);
    this.emit('PUSH_INT 16');
    this.emit('STORE SORT_RETURN');
    this.emit(`JMP ${close}`);
    this.emit(`${valid}:`);
    this.emit(`LOAD ${record}`);
    this.emitReceiverConversion({ kind: 'string', length: width }, false);
    this.emit(`STORE ${record}`);
    if (orderedKeys) {
      const first = this.nextLabel('MERGE_FIRST_RECORD');
      this.emit(`LOAD ${hasPrevious}`);
      this.emit(`JZ ${first}`);
      this.emitSortComparison(previous, record, orderedKeys);
      this.emit('PUSH_INT 0');
      this.emit('LE');
      this.emit(`JZ ${failed}`);
      this.emit(`${first}:`);
      this.emit(`LOAD ${record}`);
      this.emit(`STORE ${previous}`);
      this.emit('PUSH_INT 1');
      this.emit(`STORE ${hasPrevious}`);
    }
    this.emit(`LOAD ${buffer}`);
    this.emit(`LOAD ${record}`);
    this.emit('CONCAT');
    this.emit(`STORE ${buffer}`);
    this.emit(`LOAD ${size}`);
    this.emit(`PUSH_INT ${width}`);
    this.emit('ADD');
    this.emit(`STORE ${size}`);
    this.emit(`JMP ${loop}`);
    this.emit(`${close}:`);
    this.emitSortCloseFile(file, errorExit);
  }

  emitSortCloseFile(file, errorExit) {
    const status = this.emitCloseFile(file);
    const closed = this.nextLabel('SORT_CLOSED');
    this.emit(`LOAD ${status}`);
    this.emit('PUSH_STR "00"');
    this.emit('STREQ');
    this.emit('NOT');
    this.emit(`JZ ${closed}`);
    this.emit('PUSH_INT 16');
    this.emit('STORE SORT_RETURN');
    this.emit(`${closed}:`);
    this.emit('LOAD SORT_RETURN');
    this.emit('PUSH_INT 0');
    this.emit('EQ');
    this.emit(`JZ ${errorExit}`);
  }

  emitSortWriteFile(file, state, width, errorExit) {
    this.emitSortOpenFile(file, 'OUTPUT', errorExit);
    const loop = this.nextLabel('SORT_WRITE');
    const close = this.nextLabel('SORT_WRITE_CLOSE');
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${state.cursor}`);
    this.emit(`${loop}:`);
    this.emit(`LOAD ${state.cursor}`);
    this.emit(`LOAD ${state.size}`);
    this.emit('LT');
    this.emit(`JZ ${close}`);
    this.emitSortNextRecord(state, width);
    this.storeNamedReference(file.recordName);
    this.emitWriteFileRecord(file, file.recordName);
    this.emit(`LOAD ${file.handleName}`);
    this.emit('CALL_EXT host.isam_status 1');
    this.emit('PUSH_STR "00"');
    this.emit('STREQ');
    this.emit('NOT');
    this.emit(`JZ ${loop}`);
    this.emit('PUSH_INT 16');
    this.emit('STORE SORT_RETURN');
    this.emit(`${close}:`);
    this.emitSortCloseFile(file, errorExit);
  }

  emitSortNextRecord(state, width) {
    this.emit(`LOAD ${state.buffer}`);
    this.emitSlice(() => this.emit(`LOAD ${state.cursor}`), () => {
      this.emit(`LOAD ${state.cursor}`);
      this.emit(`PUSH_INT ${width}`);
      this.emit('ADD');
    });
    this.emit(`LOAD ${state.cursor}`);
    this.emit(`PUSH_INT ${width}`);
    this.emit('ADD');
    this.emit(`STORE ${state.cursor}`);
  }

  emitRelease(ctx) {
    const sourceName = storageName(text(ctx.IDENTIFIER()));
    const name = this.resolveProgramDataName(this.currentProgram, sourceName) || sourceName;
    const file = this.filesByRecord.get(name);
    if (!file?.sortDescription) throw new Error(`[COBOLISH] RELEASE ${name} requires an SD record`);
    this.sortFileOf(file.name);
    const state = file.sortState;
    const valid = this.nextLabel('RELEASE_VALID');
    const end = this.nextLabel('RELEASE_END');
    this.emit(`LOAD ${state.phase}`);
    this.emit('PUSH_INT 1');
    this.emit('EQ');
    this.emit('NOT');
    this.emit(`JZ ${valid}`);
    this.emit('PUSH_INT 16');
    this.emit('STORE SORT_RETURN');
    this.emit(`JMP ${end}`);
    this.emit(`${valid}:`);
    if (ctx.dataReference()) {
      this.emitReference(ctx.dataReference());
      this.storeNamedReference(name);
    }
    const width = this.fieldLength(this.fieldOf(name));
    this.emit(`LOAD ${state.buffer}`);
    this.emitNamedReference(name);
    this.emitReceiverConversion({ kind: 'string', length: width }, false);
    this.emit('CONCAT');
    this.emit(`STORE ${state.buffer}`);
    this.emit(`LOAD ${state.size}`);
    this.emit(`PUSH_INT ${width}`);
    this.emit('ADD');
    this.emit(`STORE ${state.size}`);
    this.emit(`${end}:`);
  }

  emitReturn(ctx) {
    const file = this.sortFileOf(text(ctx.IDENTIFIER()));
    const state = file.sortState;
    const atEnd = this.nextLabel('RETURN_AT_END');
    const valid = this.nextLabel('RETURN_VALID');
    const end = this.nextLabel('RETURN_END');
    this.emit(`LOAD ${state.phase}`);
    this.emit('PUSH_INT 2');
    this.emit('EQ');
    this.emit('NOT');
    this.emit(`JZ ${valid}`);
    this.emit('PUSH_INT 16');
    this.emit('STORE SORT_RETURN');
    this.emit(`JMP ${atEnd}`);
    this.emit(`${valid}:`);
    this.emit(`LOAD ${state.cursor}`);
    this.emit(`LOAD ${state.size}`);
    this.emit('LT');
    this.emit(`JZ ${atEnd}`);
    this.emitSortNextRecord(state, this.fieldLength(this.fieldOf(file.recordName)));
    this.storeNamedReference(file.recordName);
    if (ctx.dataReference()) {
      this.emitNamedReference(file.recordName);
      this.storeReference(ctx.dataReference());
    }
    const sentences = [[], []];
    let branch = 0;
    for (const child of ctx.children || []) {
      if (text(child).toUpperCase() === 'NOT') branch = 1;
      if (child.constructor?.name === 'SentenceContext') sentences[branch].push(child);
    }
    for (const sentence of sentences[1]) this.visitSentenceNode(sentence);
    this.emit(`JMP ${end}`);
    this.emit(`${atEnd}:`);
    for (const sentence of sentences[0]) this.visitSentenceNode(sentence);
    this.emit(`${end}:`);
  }

  emitSortKey(record, key) {
    this.emit(`LOAD ${record}`);
    this.emitSlice(() => this.emit(`PUSH_INT ${key.offset}`), () => this.emit(`PUSH_INT ${key.offset + key.length}`));
    if (key.field.kind === 'decimal') {
      // All records have the same key scale, so their exact display integers have the same ordering.
      this.emitDisplayReceiverConversion({ ...key.field, scale: 0 });
    } else if (key.collating) {
      const value = this.nextHiddenStringField(key.length);
      const result = this.nextHiddenStringField(key.length * 3);
      const index = this.nextHiddenField();
      const ordinal = this.nextHiddenField();
      const loop = this.nextLabel('SORT_COLLATE');
      const end = this.nextLabel('SORT_COLLATE_END');
      this.emit(`STORE ${value}`);
      this.emit('PUSH_STR ""');
      this.emit(`STORE ${result}`);
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${index}`);
      this.emit(`${loop}:`);
      this.emit(`LOAD ${index}`);
      this.emit(`PUSH_INT ${key.length}`);
      this.emit('LT');
      this.emit(`JZ ${end}`);
      this.emit(`PUSH_STR ${JSON.stringify(Array.from({ length: 256 }, (_value, code) => String.fromCharCode(code)).join(''))}`);
      this.emit(`LOAD ${value}`);
      this.emitSlice(() => this.emit(`LOAD ${index}`), () => {
        this.emit(`LOAD ${index}`);
        this.emit('PUSH_INT 1');
        this.emit('ADD');
      });
      this.emit('CALL_EXT host.string_index 2');
      this.emit('PUSH_INT 3');
      this.emit('MUL');
      this.emit(`STORE ${ordinal}`);
      this.emit(`LOAD ${result}`);
      this.emit(`PUSH_STR ${JSON.stringify(key.collating)}`);
      this.emitSlice(() => this.emit(`LOAD ${ordinal}`), () => {
        this.emit(`LOAD ${ordinal}`);
        this.emit('PUSH_INT 3');
        this.emit('ADD');
      });
      this.emit('CONCAT');
      this.emit(`STORE ${result}`);
      this.emit(`LOAD ${index}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.emit(`STORE ${index}`);
      this.emit(`JMP ${loop}`);
      this.emit(`${end}:`);
      this.emit(`LOAD ${result}`);
    }
  }

  emitSortComparison(left, right, keys) {
    const end = this.nextLabel('SORT_COMPARE_END');
    for (const key of keys) {
      const a = this.nextHiddenField();
      const b = this.nextHiddenField();
      const next = this.nextLabel('SORT_COMPARE_NEXT');
      const greater = this.nextLabel('SORT_COMPARE_GREATER');
      this.emitSortKey(left, key);
      this.emit(`STORE ${a}`);
      this.emitSortKey(right, key);
      this.emit(`STORE ${b}`);
      this.emit(`LOAD ${a}`);
      this.emit(`LOAD ${b}`);
      this.emit('LT');
      this.emit(`JZ ${greater}`);
      this.emit(`PUSH_INT ${key.descending ? 1 : -1}`);
      this.emit(`JMP ${end}`);
      this.emit(`${greater}:`);
      this.emit(`LOAD ${a}`);
      this.emit(`LOAD ${b}`);
      this.emit('GT');
      this.emit(`JZ ${next}`);
      this.emit(`PUSH_INT ${key.descending ? -1 : 1}`);
      this.emit(`JMP ${end}`);
      this.emit(`${next}:`);
    }
    this.emit('PUSH_INT 0');
    this.emit(`${end}:`);
  }

  emitMergeBuffers(left, right, result, width, keys) {
    const positions = [this.nextHiddenField(), this.nextHiddenField()];
    const lengths = [this.nextHiddenField(), this.nextHiddenField()];
    const records = [this.nextHiddenStringField(width), this.nextHiddenStringField(width)];
    const loop = this.nextLabel('SORT_MERGE');
    const tail = [this.nextLabel('SORT_MERGE_RIGHT_TAIL'), this.nextLabel('SORT_MERGE_LEFT_TAIL')];
    const takeRight = this.nextLabel('SORT_MERGE_TAKE_RIGHT');
    const end = this.nextLabel('SORT_MERGE_END');
    this.emit('PUSH_STR ""');
    this.emit(`STORE ${result}`);
    [left, right].forEach((buffer, index) => {
      this.emit(`LOAD ${buffer}`);
      this.emit('CALL_EXT host.string_length 1');
      this.emit(`STORE ${lengths[index]}`);
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${positions[index]}`);
    });
    this.emit(`${loop}:`);
    [left, right].forEach((buffer, index) => {
      this.emit(`LOAD ${positions[index]}`);
      this.emit(`LOAD ${lengths[index]}`);
      this.emit('LT');
      this.emit(`JZ ${tail[index]}`);
      this.emit(`LOAD ${buffer}`);
      this.emitSlice(() => this.emit(`LOAD ${positions[index]}`), () => {
        this.emit(`LOAD ${positions[index]}`);
        this.emit(`PUSH_INT ${width}`);
        this.emit('ADD');
      });
      this.emit(`STORE ${records[index]}`);
    });
    this.emitSortComparison(records[0], records[1], keys);
    this.emit('PUSH_INT 0');
    this.emit('LE');
    this.emit(`JZ ${takeRight}`);
    const append = index => {
      this.emit(`LOAD ${result}`);
      this.emit(`LOAD ${records[index]}`);
      this.emit('CONCAT');
      this.emit(`STORE ${result}`);
      this.emit(`LOAD ${positions[index]}`);
      this.emit(`PUSH_INT ${width}`);
      this.emit('ADD');
      this.emit(`STORE ${positions[index]}`);
      this.emit(`JMP ${loop}`);
    };
    append(0);
    this.emit(`${takeRight}:`);
    append(1);
    [right, left].forEach((buffer, index) => {
      const remaining = 1 - index;
      this.emit(`${tail[index]}:`);
      this.emit(`LOAD ${result}`);
      this.emit(`LOAD ${buffer}`);
      this.emitSlice(() => this.emit(`LOAD ${positions[remaining]}`), () => this.emit(`LOAD ${lengths[remaining]}`));
      this.emit('CONCAT');
      this.emit(`STORE ${result}`);
      this.emit(`JMP ${end}`);
    });
    this.emit(`${end}:`);
  }

  emitSortOrder(state, width, keys) {
    const run = this.nextHiddenField();
    const offset = this.nextHiddenField();
    const destination = this.nextHiddenStringField(0);
    const left = this.nextHiddenStringField(0);
    const right = this.nextHiddenStringField(0);
    const merged = this.nextHiddenStringField(0);
    const pass = this.nextLabel('SORT_PASS');
    const pair = this.nextLabel('SORT_PAIR');
    const nextPass = this.nextLabel('SORT_NEXT_PASS');
    const end = this.nextLabel('SORT_ORDER_END');
    this.emit(`PUSH_INT ${width}`);
    this.emit(`STORE ${run}`);
    this.emit(`${pass}:`);
    this.emit(`LOAD ${run}`);
    this.emit(`LOAD ${state.size}`);
    this.emit('LT');
    this.emit(`JZ ${end}`);
    this.emit('PUSH_STR ""');
    this.emit(`STORE ${destination}`);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${offset}`);
    this.emit(`${pair}:`);
    this.emit(`LOAD ${offset}`);
    this.emit(`LOAD ${state.size}`);
    this.emit('LT');
    this.emit(`JZ ${nextPass}`);
    [left, right].forEach((buffer, index) => {
      this.emit(`LOAD ${state.buffer}`);
      this.emitSlice(() => {
        this.emit(`LOAD ${offset}`);
        this.emit(`LOAD ${run}`);
        this.emit(`PUSH_INT ${index}`);
        this.emit('MUL');
        this.emit('ADD');
      }, () => {
        this.emit(`LOAD ${offset}`);
        this.emit(`LOAD ${run}`);
        this.emit(`PUSH_INT ${index + 1}`);
        this.emit('MUL');
        this.emit('ADD');
      });
      this.emit(`STORE ${buffer}`);
    });
    this.emitMergeBuffers(left, right, merged, width, keys);
    this.emit(`LOAD ${destination}`);
    this.emit(`LOAD ${merged}`);
    this.emit('CONCAT');
    this.emit(`STORE ${destination}`);
    this.emit(`LOAD ${offset}`);
    this.emit(`LOAD ${run}`);
    this.emit('PUSH_INT 2');
    this.emit('MUL');
    this.emit('ADD');
    this.emit(`STORE ${offset}`);
    this.emit(`JMP ${pair}`);
    this.emit(`${nextPass}:`);
    this.emit(`LOAD ${destination}`);
    this.emit(`STORE ${state.buffer}`);
    this.emit(`LOAD ${run}`);
    this.emit('PUSH_INT 2');
    this.emit('MUL');
    this.emit(`STORE ${run}`);
    this.emit(`JMP ${pass}`);
    this.emit(`${end}:`);
    for (const buffer of [destination, left, right, merged]) {
      this.emit('PUSH_STR ""');
      this.emit(`STORE ${buffer}`);
    }
  }

  emitRead(ctx) {
    const file = this.fileOf(ctx.IDENTIFIER()?.getText());
    if (file.sortDescription) throw new Error(`[COBOLISH] READ is not valid for SD file ${file.name}; use RETURN`);
    const clauses = ctx.readClause() || [];
    const keyClause = clauses.find(clause => /^KEY/i.test(text(clause)));
    const intoClause = clauses.find(clause => clause.INTO?.());
    const intoTarget = intoClause ? storageName(intoClause.IDENTIFIER().getText()) : null;
    const target = intoTarget || file.recordName;
    if (!target || !this.fieldOf(target)) {
      throw new Error(`[COBOLISH] READ ${file.name} requires a declared file record or INTO target`);
    }
    this.emit(`LOAD ${file.handleName}`);
    const readNext = !keyClause && !((file.organization === 'INDEXED' || file.organization === 'RELATIVE')
      && file.access !== 'SEQUENTIAL' && !clauses.some(clause => clause.NEXT?.()));
    if (!readNext) {
      const key = keyClause ? keyClause.IDENTIFIER?.()?.getText() : file.keyName;
      if (!key) throw new Error(`[COBOLISH] READ ${file.name} KEY must name a data item`);
      const alternate = file.alternateKeys.find(item => item.name === storageName(key));
      if (alternate) {
        this.emit(`PUSH_STR ${JSON.stringify(alternate.name)}`);
        this.emit(`LOAD ${storageName(key)}`);
        this.emit('CALL_EXT host.isam_read_alt 3');
      } else if (file.organization === 'RELATIVE') {
        this.emitRelativeKey(file);
        this.emit('CALL_EXT host.isam_read 2');
      }
      else this.emit(`LOAD ${storageName(key)}`);
      if (!alternate && file.organization !== 'RELATIVE') this.emit('CALL_EXT host.isam_read 2');
    } else {
      this.emit('CALL_EXT host.isam_read_next 1');
    }
    const record = this.nextHiddenField();
    const endRead = this.nextLabel('READ_NO_RECORD');
    this.emit(`STORE ${record}`);
    const duplicateSuccess = this.nextLabel('READ_DUPLICATE_SUCCESS');
    this.emit(`LOAD ${file.handleName}`);
    this.emit('CALL_EXT host.isam_status 1');
    this.emit('PUSH_STR "00"');
    this.emit('STREQ');
    this.emit(`JZ ${duplicateSuccess}_CHECK`);
    this.emit(`JMP ${duplicateSuccess}`);
    this.emit(`${duplicateSuccess}_CHECK:`);
    if (file.alternateKeys.length) {
      this.emit(`LOAD ${file.handleName}`);
      this.emit('CALL_EXT host.isam_status 1');
      this.emit('PUSH_STR "02"');
      this.emit('STREQ');
      this.emit(`JZ ${endRead}`);
    } else this.emit(`JMP ${endRead}`);
    this.emit(`${duplicateSuccess}:`);
    this.emit(`LOAD ${file.handleName}`);
    this.emit('CALL_EXT host.isam_current_key 1');
    this.emit(`STORE ${file.currentKeyName}`);
    if (file.organization === 'RELATIVE') {
      this.emit(`LOAD ${file.currentKeyName}`);
      this.storeNamedReference(file.relativeKeyName);
    }
    this.emitReadRecord(file, record, intoTarget);
    this.emit(`${endRead}:`);
    this.emitFileStatus(file);

    const atEnd = [];
    const notAtEnd = [];
    for (const clause of clauses) {
      if (/^NOTATEND/i.test(text(clause))) notAtEnd.push(...(clause.sentence?.() || []));
      else if (/^ATEND/i.test(text(clause))) atEnd.push(...(clause.sentence?.() || []));
    }
    if (atEnd.length || notAtEnd.length) this.emitFileStatusBranch(file, '10', atEnd, notAtEnd);
    const invalid = clauses.flatMap(clause => clause.invalidKeyClause?.()?.sentence() || []);
    const valid = clauses.flatMap(clause => clause.notInvalidKeyClause?.()?.sentence() || []);
    if (invalid.length || valid.length) {
      this.emitFileStatusBranch(file, '00', valid, invalid, file.alternateKeys.length ? ['02'] : []);
    }
  }

  emitInvalidKeyBranch(ctx, file, additionalSuccessStatuses = []) {
    const invalid = ctx.invalidKeyClause?.()?.sentence() || [];
    const valid = ctx.notInvalidKeyClause?.()?.sentence() || [];
    if (invalid.length || valid.length) {
      this.emitFileStatusBranch(file, '00', valid, invalid, additionalSuccessStatuses);
    }
  }

  emitWrite(ctx, rewrite = false) {
    const ids = asArray(ctx.IDENTIFIER?.());
    const sourceRecordName = storageName(ids[0]?.getText());
    const recordName = this.resolveProgramDataName(this.currentProgram, sourceRecordName) || sourceRecordName;
    const file = this.filesByRecord.get(recordName);
    if (!file) throw new Error(`[COBOLISH] ${rewrite ? 'REWRITE' : 'WRITE'} ${recordName} is not a declared file record`);
    if (file.sortDescription) throw new Error(`[COBOLISH] ${rewrite ? 'REWRITE' : 'WRITE'} is not valid for SD record ${recordName}; use RELEASE`);
    const clauses = (rewrite ? [] : ctx.writeClause?.() || []);
    const fromClause = clauses.find(clause => clause.FROM?.());
    const rewriteSource = rewrite && ctx.FROM?.() ? ids[1]?.getText() : null;
    const sourceName = storageName(fromClause?.IDENTIFIER?.()?.getText() || rewriteSource || sourceRecordName);
    const recordSource = this.resolveProgramDataName(this.currentProgram, sourceName) || sourceName;
    if (!this.fieldOf(recordSource)) throw new Error(`[COBOLISH] File record ${recordSource} is not declared`);
    const advances = clauses.flatMap(clause => {
      const nested = clause.writeAdvancingClause?.();
      if (nested) return [{ spec: nested, before: Boolean(nested.BEFORE?.()) }];
      if (/^AFTERADVANCING/i.test(text(clause))) return [{ spec: clause, before: false }];
      return [];
    });
    const endOfPageClauses = clauses.map(clause => clause.endOfPageClause?.()).filter(Boolean);
    for (const advance of advances.filter(item => item.before)) {
      this.emitWriteAdvance(file, advance.spec, endOfPageClauses);
    }
    if (recordSource !== recordName) {
      this.emitNamedReference(recordSource);
      this.storeNamedReference(recordName);
    }
    this.emitWriteFileRecord(file, recordName, rewrite);
    if (file.linage || advances.some(item => !item.before) || endOfPageClauses.length) {
      this.emitAfterSuccessfulWrite(file, () => {
        if (file.linage) this.emitLinageAdvance(file, '1', false, endOfPageClauses);
        for (const advance of advances.filter(item => !item.before)) {
          this.emitWriteAdvance(file, advance.spec, endOfPageClauses);
        }
      });
    }
    if (rewrite) return this.emitInvalidKeyBranch(ctx, file);
    const invalid = clauses.filter(clause => /^INVALIDKEY/i.test(text(clause))).flatMap(clause => clause.sentence?.() || []);
    const valid = clauses.filter(clause => /^NOTINVALIDKEY/i.test(text(clause))).flatMap(clause => clause.sentence?.() || []);
    if (invalid.length || valid.length) {
      this.emitFileStatusBranch(file, '00', valid, invalid, file.alternateKeys.length ? ['02'] : []);
    }
  }

  emitWriteFileRecord(file, recordName, rewrite = false) {
    this.emit(`LOAD ${file.handleName}`);
    this.emitFileKey(file, rewrite);
    this.emitNamedReference(recordName);
    if (file.recordVarying) {
      if (!file.recordVarying.dependingOn) {
        throw new Error(`[COBOLISH] RECORD VARYING for ${file.name} requires DEPENDING ON`);
      }
      this.emitSlice(
        () => this.emit('PUSH_INT 0'),
        () => this.emit(`LOAD ${file.recordVarying.dependingOn}`)
      );
    }
    this.emit(`CALL_EXT host.isam_${rewrite ? 'rewrite' : 'write'} 3`);
    this.emit(`STORE ${this.nextHiddenField()}`);
    this.emitFileStatus(file);
  }

  emitStart(ctx) {
    const file = this.fileOf(ctx.IDENTIFIER()?.getText());
    if (file.sortDescription) throw new Error(`[COBOLISH] START is not valid for SD file ${file.name}`);
    if (file.organization === 'SEQUENTIAL') throw new Error('[COBOLISH] START is not valid for sequential files');
    const clause = (ctx.startClause() || [])[0];
    const keyToken = clause?.IDENTIFIER?.();
    if (!clause || !keyToken) throw new Error(`[COBOLISH] START ${file.name} requires KEY [comparison] data-item`);
    const opcode = clause.comparator?.() ? comparisonOpcode(clause.comparator()) : 'EQ';
    const comparator = { EQ: '=', GT: '>', GE: '>=', LT: '<', LE: '<=' }[opcode];
    if (!comparator) throw new Error('[COBOLISH] START does not support a not-equal key condition');
    this.emit(`LOAD ${file.handleName}`);
    if (file.organization === 'RELATIVE') this.emitRelativeKey(file);
    else this.emit(`LOAD ${storageName(keyToken.getText())}`);
    this.emit(`PUSH_STR ${JSON.stringify(comparator)}`);
    this.emit('CALL_EXT host.isam_start 3');
    this.emit(`STORE ${this.nextHiddenField()}`);
    this.emitFileStatus(file);
    this.emitInvalidKeyBranch(ctx, file);
  }

  emitDelete(ctx) {
    const file = this.fileOf(ctx.IDENTIFIER()?.getText());
    if (file.sortDescription) throw new Error(`[COBOLISH] DELETE is not valid for SD file ${file.name}`);
    if (file.organization === 'SEQUENTIAL') throw new Error('[COBOLISH] DELETE is not valid for sequential files');
    this.emit(`LOAD ${file.handleName}`);
    this.emitFileKey(file, true);
    this.emit('CALL_EXT host.isam_delete 2');
    this.emit(`STORE ${this.nextHiddenField()}`);
    this.emitFileStatus(file);
    this.emitInvalidKeyBranch(ctx, file);
  }

  collectSystemMetadata(tree) {
    const systems = [];
    const queues = [];
    const services = [];
    const walk = node => {
      if (!node) return;
      if (node.constructor?.name === 'SystemMetaClauseContext') {
        const names = asArray(node.stringLiteral?.()).map(item => text(item).replace(/^"|"$/g, ''));
        const raw = text(node).toUpperCase();
        const abstract = raw.startsWith('SYSTEMTYPE');
        const systemId = names[0] || '';
        const typeName = abstract ? null : (names[1] || null);
        const system = {
          name: systemId,
          systemId,
          typeName,
          abstract,
          visibility: text(node.systemVisibilityClause?.()).toUpperCase().includes('EXPOSED') ? 'exposed' : 'internal',
          members: []
        };

        for (const member of asArray(node.systemMember?.())) {
          const memberNames = asArray(member.systemQueueMember?.()?.stringLiteral?.() || member.systemServiceMember?.()?.stringLiteral?.())
            .map(item => text(item).replace(/^"|"$/g, ''));
          const memberText = text(member).toUpperCase();
          const visibility = memberText.includes('EXPOSED') ? 'exposed' : 'internal';
          if (member.systemQueueMember?.()) {
            const queueContext = member.systemQueueMember();
            const hasAlias = Boolean(queueContext.ARROW?.());
            const queue = {
              kind: 'queue',
              symbol: memberNames[0],
              queueName: hasAlias ? (memberNames[1] || memberNames[0]) : memberNames[0],
              dataTypeId: hasAlias ? (memberNames[2] || null) : (memberNames[1] || null),
              dataTypeIds: [hasAlias ? memberNames[2] : memberNames[1]].filter(Boolean),
              systemId,
              visibility
            };
            system.members.push(queue);
            if (!abstract) queues.push({ ...queue, queueName: `${systemId}.${queue.queueName}` });
          } else if (member.systemServiceMember?.()) {
            const serviceContext = member.systemServiceMember();
            const hasAlias = Boolean(serviceContext.ARROW?.());
            const service = {
              kind: 'service',
              symbol: memberNames[0],
              serviceId: hasAlias ? (memberNames[1] || memberNames[0]) : memberNames[0],
              systemId,
              visibility
            };
            system.members.push(service);
            if (!abstract) services.push(service);
          }
        }
        systems.push(system);
        return;
      }
      for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) walk(node.getChild(index));
    };
    walk(tree);
    return { systems, queues, services };
  }

  // Every numeric value on the stack is a decimal, so mixed-scale arithmetic is exact.
  emitLiteral(ctx, stringLength = null) {
    const raw = text(ctx);
    if (stringLength !== null) {
      const stringValue = literalStringValue(ctx, stringLength);
      if (stringValue !== null) {
        this.emit(`PUSH_STR ${JSON.stringify(stringValue)}`);
        return;
      }
    }
    if (ctx.stringLiteral && ctx.stringLiteral()) {
      this.emit(`PUSH_STR ${JSON.stringify(unquote(raw))}`);
      return;
    }
    if (/^(SPACE|SPACES|QUOTES|QUOTE)$/i.test(raw)) {
      this.emit(`PUSH_STR ${JSON.stringify(/^QUOTES?$/i.test(raw) ? '"' : ' ')}`);
      return;
    }
    if (ctx.figurativeConstant?.() || ctx.allLiteral?.()) {
      if (ctx.allLiteral?.()) {
        const nested = ctx.allLiteral().literal();
        const one = literalStringValue(nested, 1);
        if (one !== null) {
          this.emit(`PUSH_STR ${JSON.stringify(one.repeat(stringLength || 1))}`);
          return;
        }
      }
      if (/^HIGH-VALUES?$/i.test(raw)) {
        this.emit(`PUSH_STR ${JSON.stringify('\u00ff'.repeat(stringLength || 1))}`);
        return;
      }
      if (/^LOW-VALUES?$/i.test(raw)) {
        this.emit(`PUSH_STR ${JSON.stringify('\u0000'.repeat(stringLength || 1))}`);
        return;
      }
      throw new Error(`[COBOLISH] Figurative constant ${raw} needs an alphanumeric context`);
    }
    if (/^(ZERO|ZEROS|ZEROES)$/i.test(raw)) {
      this.emit('PUSH_DEC 0 0');
      return;
    }
    if (/^TRUE$/i.test(raw)) {
      this.emit('PUSH_INT 1');
      return;
    }
    if (/^FALSE$/i.test(raw)) {
      this.emit('PUSH_INT 0');
      return;
    }
    const [whole, fraction = ''] = raw.replace(/^\+/, '').split('.');
    this.emit(`PUSH_DEC ${whole}${fraction} ${fraction.length}`);
  }

  emitFactor(ctx, stringLength = null) {
    if (ctx.literal && ctx.literal()) {
      const literal = ctx.literal();
      const raw = text(literal);
      this.emitLiteral(literal, /^(?:ALL|HIGH-VALUES?|LOW-VALUES?|SPACES?|QUOTES?)$/i.test(raw) ? stringLength : null);
      return;
    }
    if (ctx.expression && ctx.expression()) {
      this.emitExpression(ctx.expression());
      return;
    }
    if (ctx.dataReference?.()) {
      this.emitReference(ctx.dataReference());
      return;
    }
    if (ctx.POW?.()) {
      const factors = asArray(ctx.factor());
      const exponentText = text(factors[1]);
      if (!/^[+-]?\d+$/.test(exponentText)) {
        throw new Error('[COBOLISH] Exponentiation currently requires an integer literal exponent');
      }
      const exponent = Number(exponentText);
      if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) {
        throw new Error('[COBOLISH] Exponentiation literal exponent must be between -100 and 100');
      }
      if (exponent === 0) {
        this.emit('PUSH_DEC 1 0');
        return;
      }
      if (exponent < 0) this.emit('PUSH_DEC 1 0');
      this.emitFactor(factors[0]);
      for (let count = 1; count < Math.abs(exponent); count += 1) {
        this.emitFactor(factors[0]);
        this.emit('MUL');
      }
      if (exponent < 0) this.emit('DIV');
      return;
    }
    if (ctx.MINUS?.()) {
      this.emit('PUSH_DEC 0 0');
      this.emitFactor(ctx.factor(0));
      this.emit('SUB');
      return;
    }
    if (ctx.PLUS?.()) return this.emitFactor(ctx.factor(0));
    if (ctx.intrinsicFunction?.()) {
      this.emitIntrinsicFunction(ctx.intrinsicFunction());
      return;
    }
    throw new Error(`[COBOLISH] Expression operand ${text(ctx)} is recognized but not yet implemented`);
  }

  intrinsicArgumentKind(expression) {
    let kind = null;
    const walk = node => {
      if (!node || kind) return;
      if (node.dataReference?.()) {
        const name = this.resolveDataName(node.dataReference());
        const field = this.fieldOf(name);
        if (field) kind = field.kind === 'string' || field.kind === 'group' ? 'text' : 'numeric';
        return;
      }
      if (node.intrinsicFunction?.()) {
        const name = text(node.intrinsicFunction().functionName()).toUpperCase();
        if (['UPPER-CASE', 'LOWER-CASE', 'REVERSE', 'CHAR', 'CURRENT-DATE', 'WHEN-COMPILED'].includes(name)) kind = 'text';
        else if (['LENGTH', 'ORD'].includes(name)) kind = 'numeric';
        if (kind) return;
      }
      if (node.literal?.()) {
        const raw = text(node.literal());
        if (/^["']/.test(raw)) kind = 'text';
        else kind = 'numeric';
        return;
      }
      for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) walk(node.getChild(index));
    };
    walk(expression);
    if (kind) return kind;
    return /^["']/.test(text(expression)) ? 'text' : 'numeric';
  }

  findDataReference(node) {
    if (!node) return null;
    if (node.dataReference?.()) return node.dataReference();
    for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) {
      const result = this.findDataReference(node.getChild(index));
      if (result) return result;
    }
    return null;
  }

  expandIntrinsicArguments(args) {
    return args.flatMap(argument => {
      const reference = this.findDataReference(argument);
      if (!reference?.ALL?.()) return [argument];
      const name = this.resolveDataName(reference);
      const field = this.fieldOf(name);
      if (!field?.dimensions?.length) {
        throw new Error(`[COBOLISH] FUNCTION argument ${name}(ALL) must reference a table`);
      }
      const count = field.dimensions.reduce((total, dimension) => total * dimension, 1);
      return Array.from({ length: count }, (_, index) => ({ arrayElement: `${name}_${index}` }));
    });
  }

  emitNumericArrayCall(label, args, emitArgument) {
    const values = this.expandIntrinsicArguments(args);
    if (values.length === 0) throw new Error(`[COBOLISH] FUNCTION ${label.replace('COBOL_RT_', '')} requires an argument`);
    const sourceArgs = args.length === 1 && values.length > 1 ? [args[0]] : args;
    if (sourceArgs.some(argument => this.intrinsicArgumentKind(argument) !== 'numeric')) {
      throw new Error(`[COBOLISH] FUNCTION ${label.replace('COBOL_RT_', '')} requires numeric arguments`);
    }
    this.runtimeLibraries.add('math');
    this.emit('PUSH_STR "["');
    values.forEach((argument, index) => {
      if (index > 0) {
        this.emit('PUSH_STR ","');
        this.emit('CONCAT');
      }
      emitArgument(argument);
      this.emit('DEC_STR');
      this.emit('CONCAT');
    });
    this.emit('PUSH_STR "]"');
    this.emit('CONCAT');
    this.emit(`CALL PROC_${label} 1`);
  }

  emitIntrinsicFunction(ctx) {
    if (ctx.referenceModifier?.()) {
      throw new Error(`[COBOLISH] FUNCTION ${text(ctx.functionName())} reference modification is not implemented`);
    }
    const name = text(ctx.functionName()).toUpperCase();
    let args = asArray(ctx.argumentList?.()?.expression?.());
    if ((name === 'MOD' || name === 'REM') && args.length === 1) {
      const separatedLiterals = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/
        .exec(originalText(ctx.argumentList()).trim());
      if (separatedLiterals) args = [separatedLiterals[1], separatedLiterals[2]];
    }
    const requireArity = count => {
      if (args.length !== count) throw new Error(`[COBOLISH] FUNCTION ${name} requires ${count} argument${count === 1 ? '' : 's'}`);
    };
    const emitArgument = argument => {
      if (argument?.arrayElement) {
        this.emit(`LOAD ${argument.arrayElement}`);
        return;
      }
      if (typeof argument !== 'string') {
        this.emitExpression(argument);
        return;
      }
      const [whole, fraction = ''] = argument.replace(/^\+/, '').split('.');
      this.emit(`PUSH_DEC ${whole}${fraction} ${fraction.length}`);
    };
    const emitCall = (library, label, parameters) => {
      this.runtimeLibraries.add(library);
      parameters.forEach(emitArgument);
      this.emit(`CALL PROC_${label} ${parameters.length}`);
    };

    if (name === 'WHEN-COMPILED') {
      requireArity(0);
      this.emit(`PUSH_STR ${JSON.stringify(this.whenCompiled)}`);
      return;
    }
    if (name === 'CURRENT-DATE') {
      requireArity(0);
      emitCall('text', 'COBOL_RT_CURRENT_DATE', []);
      return;
    }
    if (name === 'ABS') {
      requireArity(1);
      emitCall('core', 'COBOL_RT_ABS', args);
      return;
    }
    if (name === 'LENGTH') {
      requireArity(1);
      emitCall('text', 'COBOL_RT_LENGTH', args);
      return;
    }
    if (name === 'UPPER-CASE' || name === 'LOWER-CASE' || name === 'REVERSE') {
      requireArity(1);
      const label = {
        'UPPER-CASE': 'COBOL_RT_UPPER',
        'LOWER-CASE': 'COBOL_RT_LOWER',
        REVERSE: 'COBOL_RT_REVERSE'
      }[name];
      emitCall('text', label, args);
      return;
    }
    if (name === 'CHAR') {
      requireArity(1);
      emitCall('text', 'COBOL_RT_CHAR', args);
      return;
    }
    if (name === 'ORD') {
      requireArity(1);
      emitCall('text', 'COBOL_RT_ORD', args);
      return;
    }
    if (name === 'NUMVAL' || name === 'NUMVAL-C') {
      if (name === 'NUMVAL') {
        requireArity(1);
        emitCall('math', 'COBOL_RT_NUMVAL', args);
      } else {
        if (args.length < 1 || args.length > 2) {
          throw new Error('[COBOLISH] FUNCTION NUMVAL-C requires one or two arguments');
        }
        emitCall('math', args.length === 1
          ? 'COBOL_RT_NUMVAL_C'
          : 'COBOL_RT_NUMVAL_C_WITH_CURRENCY', args);
      }
      return;
    }
    if (name === 'RANDOM') {
      if (args.length > 1) throw new Error('[COBOLISH] FUNCTION RANDOM accepts zero or one argument');
      const label = args.length === 0 ? 'COBOL_RT_RANDOM' : 'COBOL_RT_RANDOM_SEEDED';
      emitCall('math', label, args);
      return;
    }
    if (name === 'PRESENT-VALUE') {
      if (args.length < 2) {
        throw new Error('[COBOLISH] FUNCTION PRESENT-VALUE requires a discount rate and at least one period-end amount');
      }
      this.emitNumericArrayCall('COBOL_RT_PRESENT_VALUE', args, emitArgument);
      return;
    }
    if (name === 'MEAN' || name === 'MEDIAN' || name === 'MIDRANGE' || name === 'RANGE'
      || name === 'SUM' || name === 'VARIANCE' || name === 'STANDARD-DEVIATION'
      || name === 'ORD-MAX' || name === 'ORD-MIN') {
      const label = `COBOL_RT_${name.replace(/-/g, '_')}`;
      this.emitNumericArrayCall(label, args, emitArgument);
      return;
    }
    const mathFunctions = {
      ACOS: 'ACOS', ASIN: 'ASIN', ATAN: 'ATAN', COS: 'COS', SIN: 'SIN', TAN: 'TAN',
      LOG: 'LOG', LOG10: 'LOG10', SQRT: 'SQRT', FACTORIAL: 'FACTORIAL',
      INTEGER: 'INTEGER', 'INTEGER-PART': 'INTEGER_PART', MOD: 'MOD', REM: 'REM',
      'INTEGER-OF-DATE': 'INTEGER_OF_DATE', 'DATE-OF-INTEGER': 'DATE_OF_INTEGER',
      'INTEGER-OF-DAY': 'INTEGER_OF_DAY', 'DAY-OF-INTEGER': 'DAY_OF_INTEGER',
      ANNUITY: 'ANNUITY'
    };
    if (mathFunctions[name]) {
      const label = `COBOL_RT_${mathFunctions[name]}`;
      const arity = ['MOD', 'REM', 'ANNUITY'].includes(name) ? 2 : 1;
      requireArity(arity);
      emitCall('math', label, args);
      return;
    }
    if (name === 'MAX' || name === 'MIN') {
      const expandedArgs = this.expandIntrinsicArguments(args);
      if (expandedArgs.length < 2) throw new Error(`[COBOLISH] FUNCTION ${name} requires at least two arguments`);
      const kind = this.intrinsicArgumentKind(args[0]);
      if (args.some(argument => this.intrinsicArgumentKind(argument) !== kind)) {
        throw new Error(`[COBOLISH] FUNCTION ${name} arguments must have the same category`);
      }
      const library = kind === 'text' ? 'text' : 'core';
      const label = kind === 'text'
        ? `COBOL_RT_${name}_TEXT2`
        : `COBOL_RT_${name}_NUMERIC2`;
      this.runtimeLibraries.add(library);
      emitArgument(expandedArgs[0]);
      for (const argument of expandedArgs.slice(1)) {
        emitArgument(argument);
        this.emit(`CALL PROC_${label} 2`);
      }
      return;
    }
    throw new Error(`[COBOLISH] Intrinsic FUNCTION ${name} is recognized but not yet implemented`);
  }

  emitTerm(ctx, stringLength = null) {
    const factors = asArray(ctx.factor());
    if (factors.length === 0) return;
    this.emitFactor(factors[0], stringLength);
    for (let index = 1; index < factors.length; index += 1) {
      this.emitFactor(factors[index], stringLength);
      const operator = text(ctx.getChild((2 * index) - 1)).toUpperCase();
      if (operator !== '*' && operator !== '/') throw new Error(`[COBOLISH] Unsupported operator ${operator}`);
      this.emit(operator === '*' ? 'MUL' : 'DIV');
    }
  }

  emitExpression(ctx, stringLength = null) {
    const terms = asArray(ctx.term());
    if (terms.length === 0) return;
    this.emitTerm(terms[0], stringLength);
    for (let index = 1; index < terms.length; index += 1) {
      this.emitTerm(terms[index], stringLength);
      const operator = text(ctx.getChild((2 * index) - 1)).toUpperCase();
      if (operator !== '+' && operator !== '-') throw new Error(`[COBOLISH] Unsupported operator ${operator}`);
      this.emit(operator === '+' ? 'ADD' : 'SUB');
    }
  }

  emitRelation(ctx) {
    const expressions = asArray(ctx.expression());
    if (expressions.length === 0) return;
    const conditionName = expressions.length === 1 ? this.conditionNameReference(expressions[0]) : null;
    if (conditionName) {
      this.emitConditionName(conditionName.reference, conditionName.condition);
      return;
    }
    const lengths = expressions.map(expression => this.alphanumericLength(expression));
    const knownLengths = lengths.filter(length => length !== null);
    const width = knownLengths.length ? Math.max(...knownLengths) : null;
    this.emitExpression(expressions[0], width);
    if (width !== null) this.emitReceiverConversion({ kind: 'string', length: width }, false);
    if (expressions.length < 2) return;
    this.emitExpression(expressions[1], width);
    if (width !== null) this.emitReceiverConversion({ kind: 'string', length: width }, false);
    this.emit(comparisonOpcode(ctx.comparator()));
  }

  emitClassCondition(ctx) {
    const className = ctx.IDENTIFIER?.() ? storageName(text(ctx.IDENTIFIER())) : null;
    const expression = ctx.expression();
    const kind = text(ctx.classKind()).toUpperCase().replace(/-/g, '_');
    const reference = expression.term().length === 1 && expression.term(0).factor().length === 1
      ? expression.term(0).factor(0).dataReference?.()
      : null;
    const field = reference ? this.fieldOf(this.resolveDataName(reference)) : null;
    if (!field || field.kind === 'decimal') {
      this.emit(`PUSH_INT ${kind === 'NUMERIC' && field?.kind === 'decimal' ? 1 : 0}`);
    } else {
      const length = field.length;
      const value = this.nextHiddenField();
      const index = this.nextHiddenField();
      const valid = this.nextHiddenField();
      const character = this.nextHiddenField();
      const loop = this.nextLabel('CLASS_CHECK');
      const next = this.nextLabel('CLASS_NEXT');
      const end = this.nextLabel('CLASS_END');
      const allowed = className ? this.userClasses.get(className) : {
        NUMERIC: '0123456789',
        ALPHABETIC: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
        ALPHABETIC_UPPER: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
        ALPHABETIC_LOWER: 'abcdefghijklmnopqrstuvwxyz '
      }[kind];
      if (!allowed) throw new Error(`[COBOLISH] Unknown or unsupported class condition ${className || kind}`);
      this.emitReference(reference);
      this.emit(`STORE ${value}`);
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${index}`);
      this.emit('PUSH_INT 1');
      this.emit(`STORE ${valid}`);
      this.emit(`${loop}:`);
      this.emit(`LOAD ${index}`);
      this.emit(`PUSH_INT ${length}`);
      this.emit('LT');
      this.emit(`JZ ${end}`);
      this.emit(`LOAD ${value}`);
      this.emitSlice(() => this.emit(`LOAD ${index}`), () => {
        this.emit(`LOAD ${index}`);
        this.emit('PUSH_INT 1');
        this.emit('ADD');
      });
      this.emit(`STORE ${character}`);
      this.emit(`PUSH_STR ${JSON.stringify(allowed)}`);
      this.emit(`LOAD ${character}`);
      this.emit('CALL_EXT host.string_index 2');
      this.emit('PUSH_INT 0');
      this.emit('GE');
      this.emit('NOT');
      this.emit(`JZ ${next}`);
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${valid}`);
      this.emit(`${next}:`);
      this.emit(`LOAD ${index}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.emit(`STORE ${index}`);
      this.emit(`JMP ${loop}`);
      this.emit(`${end}:`);
      this.emit(`LOAD ${valid}`);
    }
    if (ctx.NOT()) this.emit('NOT');
  }

  emitAbbreviatedRelation(ctx, base) {
    if (!base) throw new Error(`[COBOLISH] Abbreviated relation ${text(ctx)} has no preceding relation`);
    this.emitExpression(base.subject);
    if (ctx.comparator()) {
      this.emitExpression(ctx.expression(0), this.alphanumericLength(base.subject));
      this.emit(comparisonOpcode(ctx.comparator()));
      const updated = { subject: base.subject, comparator: ctx.comparator() };
      if (ctx.NOT()) this.emit('NOT');
      return updated;
    }
    this.emitExpression(ctx.expression(0), this.alphanumericLength(base.subject));
    this.emit(comparisonOpcode(base.comparator));
    if (ctx.NOT()) this.emit('NOT');
    return base;
  }

  alphanumericLength(expression) {
    const terms = expression.term();
    if (terms.length !== 1 || terms[0].factor().length !== 1) return null;
    const factor = terms[0].factor(0);
    const literal = factor.literal?.();
    if (literal?.stringLiteral()) return unquote(text(literal)).length;
    if (literal && /^(SPACE|SPACES|QUOTES)$/i.test(text(literal))) return 1;
    const reference = factor.dataReference?.();
    const field = reference && this.fieldOf(this.resolveDataName(reference));
    return field && field.kind !== 'decimal' ? field.length : null;
  }

  emitCondition(ctx, inheritedRelation = null) {
    if (ctx.relation && ctx.relation()) {
      const relation = ctx.relation();
      const expressions = asArray(relation.expression());
      if (expressions.length === 1 && inheritedRelation) {
        const conditionName = this.conditionNameReference(expressions[0]);
        if (conditionName) {
          this.emitConditionName(conditionName.reference, conditionName.condition);
          return inheritedRelation;
        }
        this.emitExpression(inheritedRelation.subject);
        this.emitExpression(expressions[0], this.alphanumericLength(inheritedRelation.subject));
        this.emit(comparisonOpcode(inheritedRelation.comparator));
        return inheritedRelation;
      }
      this.emitRelation(relation);
      return expressions.length === 2 ? { subject: expressions[0], comparator: relation.comparator() } : inheritedRelation;
    }
    if (ctx.signCondition?.()) {
      const sign = ctx.signCondition();
      this.emitExpression(sign.expression());
      this.emit('PUSH_DEC 0 0');
      this.emit(sign.POSITIVE() ? 'GT' : sign.NEGATIVE() ? 'LT' : 'EQ');
      if (sign.NOT()) this.emit('NOT');
      return inheritedRelation;
    }
    if (ctx.classCondition?.()) {
      this.emitClassCondition(ctx.classCondition());
      return inheritedRelation;
    }
    if (ctx.abbreviatedRelation?.()) {
      const conditions = asArray(ctx.condition());
      const base = this.emitCondition(conditions[0], inheritedRelation);
      const updated = this.emitAbbreviatedRelation(ctx.abbreviatedRelation(), base);
      const operator = text(ctx.abbreviatedRelation().getChild(0)).toUpperCase().startsWith('OR') ? 'OR' : 'AND';
      this.emit(operator);
      return updated;
    }
    const conditions = asArray(ctx.condition());
    if (text(ctx.getChild(0)).toUpperCase() === 'NOT') {
      this.emitCondition(conditions[0], inheritedRelation);
      this.emit('NOT');
      return inheritedRelation;
    }
    if (text(ctx.getChild(0)) === '(') {
      return this.emitCondition(conditions[0], null);
    }
    if (conditions.length === 2) {
      const base = this.emitCondition(conditions[0], inheritedRelation);
      const rightBase = this.emitCondition(conditions[1], base);
      this.emit(text(ctx.getChild(1)).toUpperCase() === 'OR' ? 'OR' : 'AND');
      return rightBase || base;
    }
    throw new Error(`[COBOLISH] Condition ${text(ctx).slice(0, 40)} is recognized but not yet implemented`);
  }

  // The receiving field's PICTURE fixes the stored scale, as COBOL requires.
  storeInto(name, rounded) {
    const target = storageName(name);
    const field = this.fieldOf(target);
    if (field?.redefinesBase) return this.storeRedefined(null, field, rounded);
    this.invalidateRawGroups(target);
    if (field) this.emitReceiverConversion(field, rounded);
    this.emit(`STORE ${target}`);
  }

  emitTextLength() {
    const value = this.nextHiddenField();
    const length = this.nextHiddenField();
    const loop = this.nextLabel('TEXT_LENGTH');
    const end = this.nextLabel('TEXT_LENGTH_END');
    this.emit(`STORE ${value}`);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${length}`);
    this.emit(`${loop}:`);
    this.emit(`LOAD ${value}`);
    this.emitSlice(() => this.emit(`LOAD ${length}`), () => {
      this.emit(`LOAD ${length}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
    });
    this.emit('PUSH_STR ""');
    this.emit('STREQ');
    this.emit(`JZ ${loop}_NEXT`);
    this.emit(`JMP ${end}`);
    this.emit(`${loop}_NEXT:`);
    this.emit(`LOAD ${length}`);
    this.emit('PUSH_INT 1');
    this.emit('ADD');
    this.emit(`STORE ${length}`);
    this.emit(`JMP ${loop}`);
    this.emit(`${end}:`);
    this.emit(`LOAD ${length}`);
  }

  emitDisplayReceiverConversion(field) {
    if (field.kind === 'decimal') {
      if (field.separateSign && field.signPosition === 'TRAILING') {
        const value = this.nextHiddenStringField(this.fieldLength(field));
        this.emit(`STORE ${value}`);
        this.emit(`LOAD ${value}`);
        this.emitSlice(() => this.emit(`PUSH_INT ${field.precision}`),
          () => this.emit(`PUSH_INT ${field.precision + 1}`));
        this.emit(`LOAD ${value}`);
        this.emitSlice(() => this.emit('PUSH_INT 0'), () => this.emit(`PUSH_INT ${field.precision}`));
        this.emit('CONCAT');
      }
      this.emit('DEC_QUANT 0');
      if (field.scale) {
        this.emit(`PUSH_DEC 1${'0'.repeat(field.scale)} 0`);
        this.emit('DIV');
      }
    }
    this.emitReceiverConversion(field, false);
  }

  emitReceiverConversion(field, rounded) {
    if (field.kind === 'decimal') {
      this.emit(`DEC_QUANT ${field.scale}${rounded ? ' ROUNDED' : ''}`);
      const value = this.nextHiddenField();
      const quotient = this.nextHiddenField();
      this.emit(`STORE ${value}`);
      if (field.scalingPower > 0) {
        const factor = `1${'0'.repeat(field.scalingPower)}`;
        this.emit(`LOAD ${value}`);
        this.emit(`PUSH_DEC ${factor} 0`);
        this.emit('DIV');
        this.emit('DEC_QUANT 0');
        this.emit(`PUSH_DEC ${factor} 0`);
        this.emit('MUL');
        this.emit(`STORE ${value}`);
      }
      this.emit(`LOAD ${value}`);
      this.emit(`PUSH_DEC 1${'0'.repeat(field.precision)} ${field.scale}`);
      this.emit('DIV');
      this.emit('DEC_QUANT 0');
      this.emit(`PUSH_DEC 1${'0'.repeat(field.precision)} ${field.scale}`);
      this.emit('MUL');
      this.emit(`STORE ${quotient}`);
      this.emit(`LOAD ${value}`);
      this.emit(`LOAD ${quotient}`);
      this.emit('SUB');
      if (!field.signed) {
        const positive = this.nextLabel('UNSIGNED');
        this.emit(`STORE ${value}`);
        this.emit(`LOAD ${value}`);
        this.emit('PUSH_INT 0');
        this.emit('LT');
        this.emit(`JZ ${positive}`);
        this.emit('PUSH_INT 0');
        this.emit(`LOAD ${value}`);
        this.emit('SUB');
        this.emit(`STORE ${value}`);
        this.emit(`${positive}:`);
        this.emit(`LOAD ${value}`);
      }
    } else if (field.kind === 'string') {
      if (!field.justified) {
        this.emit(`PUSH_STR ${JSON.stringify(' '.repeat(field.length))}`);
        this.emit('CONCAT');
        this.emitSlice(() => this.emit('PUSH_INT 0'), () => this.emit(`PUSH_INT ${field.length}`));
      } else {
        const value = this.nextHiddenField();
        const length = this.nextHiddenField();
        const truncate = this.nextLabel('RIGHT_TRUNCATE');
        const end = this.nextLabel('RIGHT_END');
        this.emit(`STORE ${value}`);
        this.emit(`LOAD ${value}`);
        this.emitTextLength();
        this.emit(`STORE ${length}`);
        this.emit(`LOAD ${length}`);
        this.emit(`PUSH_INT ${field.length}`);
        this.emit('LT');
        this.emit(`JZ ${truncate}`);
        this.emit(`PUSH_STR ${JSON.stringify(' '.repeat(field.length))}`);
        this.emitSlice(() => this.emit('PUSH_INT 0'), () => {
          this.emit(`PUSH_INT ${field.length}`);
          this.emit(`LOAD ${length}`);
          this.emit('SUB');
        });
        this.emit(`LOAD ${value}`);
        this.emit('CONCAT');
        this.emit(`JMP ${end}`);
        this.emit(`${truncate}:`);
        this.emit(`LOAD ${value}`);
        this.emitSlice(() => {
          this.emit(`LOAD ${length}`);
          this.emit(`PUSH_INT ${field.length}`);
          this.emit('SUB');
        }, () => this.emit(`LOAD ${length}`));
        this.emit(`${end}:`);
      }
    }
  }

  emitSizeGuardedStore(name, rounded, sizeErrorCtx, notSizeErrorCtx = null) {
    const target = storageName(name);
    const field = this.fieldOf(target);
    if (!field || field.kind !== 'decimal' || (!sizeErrorCtx && !notSizeErrorCtx)) {
      this.storeInto(target, rounded);
      for (const sentence of notSizeErrorCtx?.sentence() || []) this.visitSentenceNode(sentence);
      return;
    }

    // ON SIZE ERROR: keep the old value and run the handler when the result overflows.
    const handlerLabel = this.nextLabel('SIZEERR');
    const endLabel = this.nextLabel('SIZEEND');
    this.emit(`DEC_QUANT ${field.scale}${rounded ? ' ROUNDED' : ''}`);
    this.emit(`STORE __size_tmp_${target}`);
    this.emit(`LOAD __size_tmp_${target}`);
    this.emit(`DEC_FITS ${field.precision}`);
    this.emit(`JZ ${handlerLabel}`);
    this.emit(`LOAD __size_tmp_${target}`);
    this.emit(`STORE ${target}`);
    for (const sentence of notSizeErrorCtx?.sentence() || []) this.visitSentenceNode(sentence);
    this.emit(`JMP ${endLabel}`);
    this.emit(`${handlerLabel}:`);
    for (const sentence of sizeErrorCtx?.sentence() || []) this.visitSentenceNode(sentence);
    this.emit(`${endLabel}:`);
  }

  visitSentenceNode(ctx) {
    const statement = ctx.statement ? ctx.statement() : null;
    if (!statement) return;
    const previousSourceLine = this.currentSourceLine;
    this.currentSourceLine = Number(ctx.start?.line) || previousSourceLine;
    try {
      this.emitStatement(statement);
    } finally {
      this.currentSourceLine = previousSourceLine;
    }
  }

  emitReportStatement(ctx) {
    const identifiers = asArray(ctx.IDENTIFIER?.()).map(item => storageName(text(item)));
    if (ctx.INITIATE?.()) {
      for (const name of identifiers) {
        const report = this.reports.get(name);
        if (!report) throw new Error(`[COBOLISH] INITIATE references unknown report ${name}`);
        this.emit('PUSH_INT 0');
        this.emit('STORE LINE_COUNTER');
        this.emit('PUSH_INT 1');
        this.emit('STORE PAGE_COUNTER');
        for (const state of [report.started, report.groupIndicate, report.nextPage]) {
          this.emit('PUSH_INT 0');
          this.emit(`STORE ${state}`);
        }
        for (const counter of report.counters) this.emitReportCounterReset(counter);
      }
      return;
    }
    if (ctx.TERMINATE?.()) {
      for (const name of identifiers) {
        const report = this.reports.get(name);
        if (!report) throw new Error(`[COBOLISH] TERMINATE references unknown report ${name}`);
        const end = this.nextLabel('REPORT_TERMINATE_END');
        this.emitReportFlagTest(report.started);
        this.emit(`JZ ${end}`);
        this.emitReportControlSwap(report, () => this.emitReportFootings(report, 0));
        this.emitReportGroups(report, 'PAGE_FOOTING');
        this.emitReportGroups(report, 'REPORT_FOOTING');
        this.emit('PUSH_INT 0');
        this.emit(`STORE ${report.started}`);
        this.emit(`${end}:`);
      }
      return;
    }

    const name = identifiers[0];
    let report = this.reports.get(name);
    let detail = null;
    if (!report) {
      const matches = [...this.reports.values()].filter(candidate =>
        candidate.groups.some(group => group.name === name && group.type === 'DETAIL'));
      if (matches.length !== 1) {
        throw new Error(`[COBOLISH] GENERATE requires a report or one uniquely defined detail report group, got ${name}`);
      }
      report = matches[0];
      detail = report.groups.find(group => group.name === name && group.type === 'DETAIL');
    }
    const breaks = this.nextLabel('REPORT_CONTROLS');
    const body = this.nextLabel('REPORT_DETAIL');
    this.emitReportFlagTest(report.started);
    this.emit(`JZ ${breaks}_FIRST`);
    const levels = report.controls.length - 1;
    for (let level = 1; level <= levels; level += 1) {
      this.emitReportControlChanged(report.controls[level]);
      this.emit(`JZ ${breaks}_${level}`);
    }
    this.emit(`JMP ${body}`);
    for (let level = 1; level <= levels; level += 1) {
      this.emit(`${breaks}_${level}:`);
      this.emitReportControlSwap(report, () => this.emitReportFootings(report, level));
      this.emitReportHeadings(report, level);
      this.emit(`JMP ${body}`);
    }
    this.emit(`${breaks}_FIRST:`);
    this.emitReportGroups(report, 'REPORT_HEADING');
    const headingGroup = report.groups.find(group => group.type === 'REPORT_HEADING');
    if (headingGroup?.nextGroup?.kind === 'page') {
      const samePage = this.nextLabel('REPORT_HEADING_PAGE');
      this.emitReportFlagTest(report.nextPage);
      this.emit(`JZ ${samePage}`);
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${report.nextPage}`);
      this.emit('LOAD PAGE_COUNTER');
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.emit('STORE PAGE_COUNTER');
      this.emit('PUSH_INT 0');
      this.emit('STORE LINE_COUNTER');
      this.emit(`${samePage}:`);
    }
    this.emitReportGroups(report, 'PAGE_HEADING');
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${report.started}`);
    this.emitReportHeadings(report, 0);
    this.emit(`${body}:`);
    for (const counter of report.counters) {
      if (!counter.dataOperands.length) continue;
      if (counter.upon.length && (!detail || !counter.upon.includes(detail.name))) continue;
      for (const operand of counter.dataOperands) {
        this.emit(`LOAD ${counter.key}`);
        this.emitReference(operand);
        this.emit('ADD');
        this.emit(`STORE ${counter.key}`);
      }
    }
    if (detail) {
      this.emitReportGroup(report, detail);
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${report.groupIndicate}`);
    }
  }

  emitReportFlagTest(flag) {
    this.emit(`LOAD ${flag}`);
    this.emit('PUSH_INT 0');
    this.emit('NEQ');
  }

  emitReportControlChanged(control) {
    this.emitNamedReference(control.key);
    this.emit(`LOAD ${control.saved}`);
    this.emit(control.decimal ? 'EQ' : 'STREQ');
  }

  emitReportControlSwap(report, body) {
    const current = report.controls.slice(1).map(control => {
      const value = control.decimal ? this.nextHiddenField() : this.nextHiddenStringField(0);
      if (control.decimal) this.fields.set(value, { ...this.fields.get(control.saved) });
      this.emitNamedReference(control.key);
      this.emit(`STORE ${value}`);
      this.emit(`LOAD ${control.saved}`);
      this.storeNamedReference(control.key);
      return value;
    });
    body();
    report.controls.slice(1).forEach((control, index) => {
      this.emit(`LOAD ${current[index]}`);
      this.storeNamedReference(control.key);
    });
  }

  emitReportFootings(report, lowest) {
    for (let level = report.controls.length - 1; level >= lowest; level -= 1) {
      const footing = report.groups.find(group => group.type === 'CONTROL_FOOTING' && group.level === level);
      if (footing) {
        this.emitReportGroup(report, footing);
        for (const counter of footing.counters) {
          for (const target of counter.rollFrom) {
            this.emit(`LOAD ${target.key}`);
            this.emit(`LOAD ${counter.key}`);
            this.emit('ADD');
            this.emit(`STORE ${target.key}`);
          }
        }
      }
      for (const counter of report.counters) {
        if (counter.resetLevel === level) this.emitReportCounterReset(counter);
      }
    }
  }

  emitReportHeadings(report, highest) {
    for (let level = highest; level < report.controls.length; level += 1) {
      const heading = report.groups.find(group => group.type === 'CONTROL_HEADING' && group.level === level);
      if (heading) this.emitReportGroup(report, heading);
    }
    for (const control of report.controls.slice(1)) {
      this.emitNamedReference(control.key);
      this.emit(`STORE ${control.saved}`);
    }
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${report.groupIndicate}`);
  }

  emitReportCounterReset(counter) {
    this.emit(`PUSH_DEC 0 ${this.fieldOf(counter.key).scale}`);
    this.emit(`STORE ${counter.key}`);
  }

  emitReportGroups(report, type) {
    for (const group of report.groups) {
      if (group.type === type) this.emitReportGroup(report, group);
    }
  }

  isReportBodyGroup(group) {
    return ['CONTROL_HEADING', 'DETAIL', 'CONTROL_FOOTING'].includes(group.type);
  }

  emitReportMaxLine(base) {
    const done = this.nextLabel('REPORT_LINE_BASE');
    const low = this.nextLabel('REPORT_LINE_LOW');
    this.emit('LOAD LINE_COUNTER');
    this.emit(`PUSH_INT ${base}`);
    this.emit('LT');
    this.emit(`JZ ${low}`);
    this.emit(`PUSH_INT ${base}`);
    this.emit(`JMP ${done}`);
    this.emit(`${low}:`);
    this.emit('LOAD LINE_COUNTER');
    this.emit(`${done}:`);
  }

  emitReportPageAdvance(report) {
    this.emitReportGroups(report, 'PAGE_FOOTING');
    this.emit('LOAD PAGE_COUNTER');
    this.emit('PUSH_INT 1');
    this.emit('ADD');
    this.emit('STORE PAGE_COUNTER');
    this.emit('PUSH_INT 0');
    this.emit('STORE LINE_COUNTER');
    this.emitReportGroups(report, 'PAGE_HEADING');
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${report.groupIndicate}`);
  }

  emitReportFit(report, group) {
    const first = group.lines[0];
    if (!first) return;
    const limit = group.type === 'CONTROL_FOOTING' ? report.footingLine ?? report.lastDetail : report.lastDetail;
    const advance = this.nextLabel('REPORT_ADVANCE');
    const fits = this.nextLabel('REPORT_FITS');
    this.emitReportFlagTest(report.nextPage);
    this.emit(`JZ ${advance}_TEST`);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${report.nextPage}`);
    this.emit(`JMP ${advance}`);
    this.emit(`${advance}_TEST:`);
    if (first.nextPage) {
      this.emit('LOAD LINE_COUNTER');
      this.emit(`PUSH_INT ${report.firstDetail - 1}`);
      this.emit('GT');
      this.emit(`JZ ${fits}`);
      this.emit(`JMP ${advance}`);
    } else if (first.absolute !== null) {
      this.emit('LOAD LINE_COUNTER');
      this.emit(`PUSH_INT ${first.absolute}`);
      this.emit('LT');
      this.emit(`JZ ${advance}`);
      this.emit(`JMP ${fits}`);
    } else {
      let total = 0;
      for (const line of group.lines) {
        if (line.absolute !== null) break;
        total += line.relative;
      }
      this.emitReportMaxLine(report.firstDetail - 1);
      this.emit(`PUSH_INT ${total}`);
      this.emit('ADD');
      this.emit(`PUSH_INT ${limit}`);
      this.emit('GT');
      this.emit(`JZ ${fits}`);
      this.emit(`JMP ${advance}`);
    }
    this.emit(`${advance}:`);
    this.emitReportPageAdvance(report);
    this.emit(`${fits}:`);
  }

  emitReportGroup(report, group) {
    const skip = this.nextLabel('REPORT_SUPPRESSED');
    const declarative = group.name ? this.reportDeclaratives.get(group.name) : null;
    if (declarative) {
      declarative.used = true;
      this.emit('PUSH_INT 0');
      this.emit('STORE __COBOL_RW_SUPPRESS');
      this.emitDeclarativeCall(declarative);
      this.emit('LOAD __COBOL_RW_SUPPRESS');
      this.emit('PUSH_INT 0');
      this.emit('EQ');
      this.emit(`JZ ${skip}`);
    }
    const body = this.isReportBodyGroup(group);
    if (body) this.emitReportFit(report, group);
    for (const line of group.lines) {
      if (line.absolute !== null) {
        this.emit(`PUSH_INT ${line.absolute}`);
      } else if (body) {
        this.emitReportMaxLine(report.firstDetail - 1);
        this.emit(`PUSH_INT ${line.relative}`);
        this.emit('ADD');
      } else {
        this.emit('LOAD LINE_COUNTER');
        this.emit(`PUSH_INT ${line.relative}`);
        this.emit('ADD');
      }
      this.emit('STORE LINE_COUNTER');
      this.emitReportLine(report, group, line);
    }
    const next = group.nextGroup;
    if (next?.kind === 'page') {
      this.emit('PUSH_INT 1');
      this.emit(`STORE ${report.nextPage}`);
    } else if (next?.kind === 'plus') {
      this.emit('LOAD LINE_COUNTER');
      this.emit(`PUSH_INT ${next.value}`);
      this.emit('ADD');
      this.emit('STORE LINE_COUNTER');
    } else if (next?.kind === 'absolute') {
      this.emit(`PUSH_INT ${next.value}`);
      this.emit('STORE LINE_COUNTER');
    }
    this.emit(`${skip}:`);
  }

  emitReportLine(report, group, line) {
    const record = this.nextHiddenStringField(132);
    this.emit('PUSH_STR ""');
    this.emit(`STORE ${record}`);
    let cursor = 1;

    for (const item of line.items) {
      if (item.column < cursor) {
        throw new Error(`[COBOLISH] Report items overlap at column ${item.column} in ${group.name || report.name}`);
      }
      if (item.column > cursor) {
        this.emit(`LOAD ${record}`);
        this.emit(`PUSH_STR ${JSON.stringify(' '.repeat(item.column - cursor))}`);
        this.emit('CONCAT');
        this.emit(`STORE ${record}`);
        cursor = item.column;
      }
      const picture = item.picture;
      const width = picture.kind === 'decimal' ? picture.precision + (picture.separateSign ? 1 : 0) : picture.length;
      const value = this.nextHiddenStringField(width);
      const indicated = item.groupIndicate ? this.nextLabel('REPORT_INDICATED') : null;
      const stored = item.groupIndicate ? this.nextLabel('REPORT_ITEM') : null;
      if (indicated) {
        this.emitReportFlagTest(report.groupIndicate);
        this.emit(`JZ ${indicated}`);
      }
      let numeric;
      if (item.counter) {
        this.emit(`LOAD ${item.counter}`);
        numeric = true;
      } else if (item.value) {
        this.emitLiteral(item.value);
        numeric = !item.value.stringLiteral?.() && /^[+-]?(?:\d|\.\d)/.test(text(item.value));
      } else {
        const sourceName = item.source.IDENTIFIER().getText().toUpperCase();
        this.emitReference(item.source);
        numeric = ['LINE-COUNTER', 'PAGE-COUNTER'].includes(sourceName)
          || (!this.isReferenceModified(item.source) && this.fieldOf(this.resolveDataName(item.source))?.kind === 'decimal');
      }
      if (item.edited && numeric) {
        this.emit(`DEC_EDIT ${JSON.stringify(item.edited.mask)} ${this.decimalPointComma ? 1 : 0} ${item.blankWhenZero ? 1 : 0}`);
      } else if (picture.kind === 'decimal' && numeric && item.blankWhenZero) {
        const zero = this.nextLabel('REPORT_BLANK_ZERO');
        const shown = this.nextLabel('REPORT_SHOWN');
        const number = this.nextHiddenField();
        this.fields.set(number, { kind: 'decimal', precision: 18, scale: picture.scale, signed: true, dimensions: [] });
        this.emit(`STORE ${number}`);
        this.emit(`LOAD ${number}`);
        this.emit('PUSH_INT 0');
        this.emit('EQ');
        this.emit(`JZ ${zero}`);
        this.emit(`PUSH_STR ${JSON.stringify(' '.repeat(width))}`);
        this.emit(`JMP ${shown}`);
        this.emit(`${zero}:`);
        this.emit(`LOAD ${number}`);
        this.emit(`DEC_DISPLAY ${picture.precision} ${picture.scale}`);
        this.emit(`${shown}:`);
      } else if (picture.kind === 'decimal') {
        if (!numeric) {
          this.runtimeLibraries.add('math');
          this.emit('CALL PROC_COBOL_RT_NUMVAL 1');
        }
        this.emit(`DEC_DISPLAY ${picture.precision} ${picture.scale}`);
      } else {
        if (numeric) this.emit('DEC_STR');
        this.emitReceiverConversion({ kind: 'string', length: width, justified: item.justified }, false);
      }
      if (indicated) {
        this.emit(`JMP ${stored}`);
        this.emit(`${indicated}:`);
        this.emit(`PUSH_STR ${JSON.stringify(' '.repeat(width))}`);
        this.emit(`${stored}:`);
      }
      this.emit(`STORE ${value}`);
      this.emit(`LOAD ${record}`);
      this.emit(`LOAD ${value}`);
      this.emit('CONCAT');
      this.emit(`STORE ${record}`);
      cursor += width;
    }

    this.emit(`LOAD ${report.file.handleName}`);
    this.emitFileKey(report.file);
    this.emit(`LOAD ${record}`);
    this.emit('CALL_EXT host.isam_write 3');
    this.emit(`STORE ${this.nextHiddenField()}`);
    this.emitFileStatus(report.file);
  }

  emitStatement(ctx) {
    if (ctx.moveCorrespondingStatement?.()) return this.emitMoveCorresponding(ctx.moveCorrespondingStatement());
    if (ctx.moveStatement && ctx.moveStatement()) return this.emitMove(ctx.moveStatement());
    if (ctx.setStatement?.()) return this.emitSet(ctx.setStatement());
    if (ctx.computeStatement && ctx.computeStatement()) return this.emitCompute(ctx.computeStatement());
    if (ctx.addStatement && ctx.addStatement()) return this.emitArithmetic(ctx.addStatement(), 'ADD');
    if (ctx.subtractStatement && ctx.subtractStatement()) return this.emitArithmetic(ctx.subtractStatement(), 'SUBTRACT');
    if (ctx.multiplyStatement && ctx.multiplyStatement()) return this.emitArithmetic(ctx.multiplyStatement(), 'MULTIPLY');
    if (ctx.divideStatement && ctx.divideStatement()) return this.emitArithmetic(ctx.divideStatement(), 'DIVIDE');
    if (ctx.ifStatement && ctx.ifStatement()) return this.emitIf(ctx.ifStatement());
    if (ctx.evaluateStatement && ctx.evaluateStatement()) return this.emitEvaluate(ctx.evaluateStatement());
    if (ctx.searchStatement?.()) return this.emitSearch(ctx.searchStatement());
    if (ctx.performStatement && ctx.performStatement()) return this.emitPerform(ctx.performStatement());
    if (ctx.displayStatement && ctx.displayStatement()) return this.emitDisplay(ctx.displayStatement());
    if (ctx.acceptStatement && ctx.acceptStatement()) return this.emitAccept(ctx.acceptStatement());
    if (ctx.callStatement && ctx.callStatement()) return this.emitCall(ctx.callStatement());
    if (ctx.openStatement && ctx.openStatement()) return this.emitOpen(ctx.openStatement());
    if (ctx.closeStatement && ctx.closeStatement()) return this.emitClose(ctx.closeStatement());
    if (ctx.readStatement && ctx.readStatement()) return this.emitRead(ctx.readStatement());
    if (ctx.writeStatement && ctx.writeStatement()) return this.emitWrite(ctx.writeStatement());
    if (ctx.rewriteStatement && ctx.rewriteStatement()) return this.emitWrite(ctx.rewriteStatement(), true);
    if (ctx.startStatement && ctx.startStatement()) return this.emitStart(ctx.startStatement());
    if (ctx.deleteStatement && ctx.deleteStatement()) return this.emitDelete(ctx.deleteStatement());
    if (ctx.stopRunStatement && ctx.stopRunStatement()) return this.emit('HALT');
    if (ctx.continueStatement && ctx.continueStatement()) return undefined;
    if (ctx.gobackStatement && ctx.gobackStatement()) return this.emit('HALT');
    if (ctx.goToStatement?.()) return this.emitGoTo(ctx.goToStatement());
    if (ctx.alterStatement?.()) return this.emitAlter(ctx.alterStatement());
    if (ctx.nextSentenceStatement?.()) return this.emit(`JMP ${this.sentenceEnd}`);
    if (ctx.stringStatement?.())  return this.emitString(ctx.stringStatement());
    if (ctx.unstringStatement?.()) return this.emitUnstring(ctx.unstringStatement());
    if (ctx.inspectStatement?.()) return this.emitInspect(ctx.inspectStatement());
    if (ctx.initializeStatement?.()) return this.emitInitialize(ctx.initializeStatement());
    if (ctx.cancelStatement?.()) return this.emitCancel(ctx.cancelStatement());
    if (ctx.sortStatement?.()) return this.emitSort(ctx.sortStatement());
    if (ctx.mergeStatement?.()) return this.emitSort(ctx.mergeStatement(), true);
    if (ctx.releaseStatement?.()) return this.emitRelease(ctx.releaseStatement());
    if (ctx.returnStatement?.()) return this.emitReturn(ctx.returnStatement());
    if (ctx.reportStatement?.()) return this.emitReportStatement(ctx.reportStatement());
    if (ctx.suppressStatement?.()) {
      if (!this.reports.size) throw new Error('[COBOLISH] SUPPRESS PRINTING requires a report');
      this.emit('PUSH_INT 1');
      this.emit('STORE __COBOL_RW_SUPPRESS');
      return;
    }
    if (ctx.copyStatement && ctx.copyStatement()) {
      throw new Error('[COBOLISH] COPY requires copybook expansion before compilation');
    }
    if (ctx.execStatement && ctx.execStatement()) {
      throw new Error('[COBOLISH] EXEC blocks require a configured preprocessor');
    }
    if (ctx.exitStatement?.()) {
      if (ctx.exitStatement().PROGRAM()) return this.emit('RET');
      return undefined;
    }
    // Pulse interop declarations are resolved from metadata, not emitted inline.
    if (ctx.interopStatement?.() || ctx.sendServiceStatement?.()) return undefined;
    throw new Error(`[COBOLISH] Statement ${text(ctx).slice(0, 40)} is recognized but not yet implemented`);
  }

  procedureLabel(name) {
    const key = this.currentProgram?.procedureNames.get(storageName(name)) || storageName(name);
    if (!this.paragraphs.has(key)) throw new Error(`[COBOLISH] Undefined procedure name ${name}`);
    return `PARA_${key}`;
  }

  // Entering an independent segment (50-99) from another segment restores its ALTERed GO TOs.
  emitSegmentEntry(name) {
    const segment = this.segments.get(name) ?? 0;
    if (segment < 50 || segment === this.currentSegment) return;
    for (const [paragraph, alter] of this.alters) {
      if (this.segments.get(paragraph) !== segment) continue;
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${alter.variable}`);
    }
  }

  emitDebugEntry(name) {
    if (!this.debuggingMode) return;
    const debugParagraph = this.debugHooks.get(name) || this.debugHooks.get('*');
    if (!debugParagraph) return;
    const displayName = this.procedureDisplayNames?.get(name) || name.replaceAll('_', '-');
    this.emit(`PUSH_STR ${JSON.stringify(displayName)}`);
    this.emitReceiverConversion(this.fieldOf('DEBUG_NAME'), false);
    this.emit('STORE DEBUG_NAME');
    this.emit('PUSH_STR "PERFORM LOOP"');
    this.emitReceiverConversion(this.fieldOf('DEBUG_CONTENTS'), false);
    this.emit('STORE DEBUG_CONTENTS');
    this.emit('PUSH_INT 1');
    this.emit(`STORE __COBOL_PEXIT_${debugParagraph}`);
    this.emit(`CALL PARA_${debugParagraph} 0`);
    this.emit('PUSH_INT 0');
    this.emit(`STORE __COBOL_PEXIT_${debugParagraph}`);
  }

  emitJumpTo(name) {
    const key = this.currentProgram?.procedureNames.get(storageName(name)) || storageName(name);
    const label = this.procedureLabel(name);
    this.emitSegmentEntry(key);
    this.emit(`JMP ${label}`);
  }

  emitGoTo(ctx) {
    const targets = (ctx.paragraphName() || []).map(name => storageName(text(name)));
    const alter = this.alters.get(this.currentParagraph);
    if (alter && targets.length <= 1) {
      alter.targets.forEach((target, index) => {
        const skip = this.nextLabel('ALTER_SKIP');
        this.emit(`LOAD ${alter.variable}`);
        this.emit(`PUSH_INT ${index}`);
        this.emit('EQ');
        this.emit(`JZ ${skip}`);
        this.emitJumpTo(target);
        this.emit(`${skip}:`);
      });
      return;
    }
    if (!targets.length) throw new Error('[COBOLISH] GO TO without a procedure name requires a matching ALTER');
    if (!ctx.DEPENDING()) return this.emitJumpTo(targets[0]);
    // An out-of-range DEPENDING value falls through to the next statement.
    targets.forEach((target, index) => {
      const skip = this.nextLabel('GOTO_SKIP');
      this.emitReference(ctx.dataReference());
      this.emit(`PUSH_DEC ${index + 1} 0`);
      this.emit('EQ');
      this.emit(`JZ ${skip}`);
      this.emitJumpTo(target);
      this.emit(`${skip}:`);
    });
  }

  emitAlter(ctx) {
    const names = ctx.paragraphName().map(name => storageName(text(name)));
    for (let index = 0; index < names.length; index += 2) {
      const alter = this.alters.get(names[index]);
      this.emit(`PUSH_INT ${alter.targets.indexOf(names[index + 1])}`);
      this.emit(`STORE ${alter.variable}`);
    }
  }

  // ALTER may only name a paragraph that consists of a single GO TO (manual ch. 9, ALTER).
  collectAlters(tree) {
    const pending = [tree];
    const pairs = [];
    while (pending.length) {
      const node = pending.pop();
      if (node?.constructor?.name === 'AlterStatementContext') {
        const names = node.paragraphName().map(name => storageName(text(name)));
        for (let index = 0; index < names.length; index += 2) pairs.push([names[index], names[index + 1]]);
      }
      for (let index = 0; index < (node?.getChildCount?.() || 0); index += 1) pending.push(node.getChild(index));
    }
    for (const [source, target] of pairs) {
      let alter = this.alters.get(source);
      if (!alter) {
        const paragraph = this.paragraphs.get(source);
        const statements = (paragraph?.sentence?.() || []).map(sentence => sentence.statement());
        const goTo = statements.length === 1 ? statements[0].goToStatement?.() : null;
        if (!goTo || goTo.paragraphName().length > 1 || goTo.DEPENDING()) {
          throw new Error(`[COBOLISH] ALTER target ${source} must be a paragraph consisting of a single GO TO`);
        }
        const initial = goTo.paragraphName().map(name => storageName(text(name)));
        alter = { variable: `__COBOL_ALTER_${source}`, targets: initial };
        this.alters.set(source, alter);
        this.controlFields.push(alter.variable);
      }
      this.procedureLabel(target);
      if (!alter.targets.includes(target)) alter.targets.push(target);
    }
  }

  // The grammar keeps sentence periods as DOT children, so NEXT SENTENCE targets the next one.
  emitSentences(node) {
    let end = this.nextLabel('SENTENCE_END');
    this.sentenceEnd = end;
    for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) {
      const child = node.getChild(index);
      if (child.constructor?.name === 'SentenceContext') this.visitSentenceNode(child);
      else if (child.constructor?.name !== 'ParagraphContext' && text(child) === '.') {
        this.emit(`${end}:`);
        end = this.nextLabel('SENTENCE_END');
        this.sentenceEnd = end;
      }
    }
    this.emit(`${end}:`);
  }

  emitSet(set) {
    const source = set.setSource();
    const setTrue = /^TRUE$/i.test(text(source));
    if (setTrue && !set.UP() && !set.DOWN()) {
      for (const target of set.dataReference()) {
        const condition = this.conditionForName(storageName(target.IDENTIFIER().getText()));
        if (!condition) throw new Error('[COBOLISH] SET ... TO TRUE requires a condition-name');
        this.emitSetConditionTrue(target, condition);
      }
      return;
    }
    if (source.ON() || source.OFF() || source.literal()?.booleanLiteral()) {
      throw new Error('[COBOLISH] SET condition-name/switch TO TRUE/FALSE/ON/OFF is recognized but not yet implemented');
    }
    const adjust = set.UP() ? 'ADD' : set.DOWN() ? 'SUB' : null;
    for (const target of set.dataReference()) {
      const name = this.resolveDataName(target);
      if (!this.fieldOf(name)) throw new Error('[COBOLISH] SET currently requires a numeric or index receiver');
      if (adjust) this.emitReference(target);
      if (source.literal()) this.emitLiteral(source.literal());
      else this.emitReference(source.dataReference());
      if (adjust) this.emit(adjust);
      this.storeReference(target, false);
    }
  }

  emitCall(ctx) {
    const targetNode = ctx.callTarget();
    const targetText = text(targetNode);
    const target = targetText.replace(/^['"]|['"]$/g, '').toUpperCase();
    const callItems = ctx.callUsingClause()?.callUsingItem() || [];
    const parameters = callItems.map(item => item.callParameter());
    if (target === 'QUEUE-WRITE-SYNC' || target === 'QUEUE-WRITE-ASYNC') {
      if (parameters.length !== 2) throw new Error(`[COBOLISH] ${target} requires a queue symbol and message`);
      const queue = text(parameters[0]).replace(/^['"]|['"]$/g, '');
      const message = parameters[1];
      if (message.literal && message.literal()) this.emitLiteral(message.literal());
      else this.emit(`LOAD ${storageName(text(message))}`);
      this.emit('ROUTE_SET_MESSAGE');
      this.emit(`${target === 'QUEUE-WRITE-SYNC' ? 'QUEUE_WRITE_SYNC' : 'QUEUE_WRITE_ASYNC'} ${JSON.stringify(queue)}`);
      return;
    }
    if (!['DB-INSERT', 'DB-SELECT', 'DB-UPDATE', 'DB-DELETE'].includes(target)) {
      return this.emitCobolProgramCall(ctx, target, targetNode, callItems);
    }

    const staticValue = (parameter, label) => {
      const raw = text(parameter).trim();
      if (!raw) throw new Error(`[COBOLISH] ${target} ${label} is required`);
      return raw.replace(/^['"]|['"]$/g, '');
    };
    const emitValue = (parameter) => {
      if (parameter.literal && parameter.literal()) this.emitLiteral(parameter.literal());
      else this.emit(`LOAD ${storageName(text(parameter))}`);
    };
    const quoted = value => JSON.stringify(String(value));
    const database = staticValue(parameters[0], 'database');
    const table = staticValue(parameters[1], 'table');

    if (target === 'DB-INSERT') {
      const columns = staticValue(parameters[2], 'columns');
      const values = parameters.slice(3);
      if (values.length !== columns.split(',').filter(Boolean).length) throw new Error('[COBOLISH] DB-INSERT requires one value per column');
      values.forEach(emitValue);
      this.emit(`DB_INSERT ${quoted(database)},${quoted(table)},${quoted(columns)}`);
      return;
    }

    if (target === 'DB-SELECT') {
      const columns = staticValue(parameters[2], 'columns');
      const whereColumn = staticValue(parameters[3], 'where column');
      const whereOperator = staticValue(parameters[4], 'where operator');
      const targets = parameters.slice(6);
      if (targets.length !== columns.split(',').filter(Boolean).length) throw new Error('[COBOLISH] DB-SELECT requires one target per selected column');
      if (whereColumn) emitValue(parameters[5]);
      this.emit(`DB_SELECT ${quoted(database)},${quoted(table)},${quoted(columns)},${quoted(whereColumn)},${quoted(whereOperator)}`);
      [...targets].reverse().forEach(parameter => this.emit(`STORE ${storageName(text(parameter))}`));
      return;
    }

    if (target === 'DB-UPDATE') {
      const columns = staticValue(parameters[2], 'columns');
      const whereColumn = staticValue(parameters[3], 'where column');
      const whereOperator = staticValue(parameters[4], 'where operator');
      const values = parameters.slice(6);
      if (values.length !== columns.split(',').filter(Boolean).length) throw new Error('[COBOLISH] DB-UPDATE requires one value per column');
      if (whereColumn) emitValue(parameters[5]);
      values.forEach(emitValue);
      this.emit(`DB_UPDATE ${quoted(database)},${quoted(table)},${quoted(columns)},${quoted(whereColumn)},${quoted(whereOperator)}`);
      return;
    }

    const whereColumn = staticValue(parameters[2], 'where column');
    const whereOperator = staticValue(parameters[3], 'where operator');
    if (whereColumn) emitValue(parameters[4]);
    this.emit(`DB_DELETE ${quoted(database)},${quoted(table)},${quoted(whereColumn)},${quoted(whereOperator)}`);
  }

  emitProgramStateReset(program, sections = ['WORKING', 'LOCAL']) {
    const resetFields = [...new Set(program.dataFields)]
      .filter(name => {
        const field = this.fieldOf(name);
        return field && !field.isExternal && !field.isLinkage
          && sections.includes(field.storageSection)
          && field.kind !== 'group';
      });
    for (const name of resetFields) {
      const field = this.fieldOf(name);
      const count = (field.dimensions || []).reduce((total, size) => total * size, 1);
      for (let index = 0; index < count; index += 1) {
        const initial = this.initialValues.get(name);
        if (initial && field.kind === 'string') {
          this.emit(`PUSH_STR ${JSON.stringify(literalStringValue(initial, field.length).padEnd(field.length))}`);
        } else if (initial) {
          this.emitLiteral(initial);
          this.emit(`DEC_QUANT ${field.scale}`);
        } else if (field.kind === 'decimal') this.emit(`PUSH_DEC 0 ${field.scale}`);
        else this.emit(`PUSH_STR ${JSON.stringify(' '.repeat(field.length))}`);
        this.emit(`STORE ${field.dimensions?.length ? `${name}_${index}` : name}`);
      }
    }
    this.emitGroupInitialValues([...new Set(program.dataFields)].filter(name => {
      const field = this.fieldOf(name);
      return field && !field.isExternal && !field.isLinkage && sections.includes(field.storageSection);
    }));
  }

  emitGroupInitialValues(names) {
    for (const name of names) {
      const field = this.fieldOf(name);
      if (field?.kind !== 'group' || !this.initialValues.has(name)) continue;
      this.emit(`PUSH_STR ${JSON.stringify(literalStringValue(this.initialValues.get(name), field.length).padEnd(field.length))}`);
      this.storeNamedReference(name);
    }
  }

  emitProgramInvocation(program, callItems) {
    this.emitProgramStateReset(program, program.initial ? ['WORKING', 'LOCAL'] : ['LOCAL']);
    if (program.linkageNames.length !== callItems.length) {
      throw new Error(`[COBOLISH] CALL ${program.sourceId} supplies ${callItems.length} arguments; expected ${program.linkageNames.length}`);
    }
    const byReferenceActuals = [];
    let passingMode = 'REFERENCE';
    for (let index = 0; index < program.linkageNames.length; index += 1) {
      const linkageName = program.linkageNames[index];
      const linkageKey = this.resolveProgramDataName(program, linkageName);
      const formalSlots = this.dataStorageSlots(linkageKey);
      const item = callItems[index];
      const parameter = item.callParameter();
      const identifier = parameter.IDENTIFIER?.();
      const itemMode = text(item.callPassingMode?.()).toUpperCase();
      if (itemMode) passingMode = itemMode;
      const mode = passingMode;
      if (!identifier) {
        if (formalSlots.length !== 1) {
          throw new Error(`[COBOLISH] CALL literal argument for ${linkageName} must match one elementary LINKAGE item`);
        }
        if (mode === 'REFERENCE') {
          throw new Error('[COBOLISH] A literal cannot be passed BY REFERENCE');
        }
        this.emitLiteral(parameter.literal());
        this.emitReceiverConversion(formalSlots[0].field, false);
        continue;
      }
      const callerName = this.resolveProgramDataName(this.currentProgram, storageName(identifier.getText()));
      if (!callerName) throw new Error(`[COBOLISH] Undeclared CALL argument ${identifier.getText()}`);
      const actualSlots = this.dataStorageSlots(callerName);
      if (actualSlots.length !== formalSlots.length) {
        const actualField = this.fieldOf(callerName);
        const actualLength = actualField ? this.fieldLength(actualField) : 0;
        const formalLength = this.fieldLength(this.fieldOf(linkageKey));
        if (mode === 'REFERENCE' && actualSlots.length === 1
          && actualSlots[0].field.kind === 'string'
          && formalSlots.every(slot => slot.field.kind === 'string')
          && actualLength === formalLength) {
          let offset = 0;
          for (const slot of formalSlots) {
            const length = this.fieldLength(slot.field);
            this.emit(`PUSH_REF ${actualSlots[0].name}@${offset}:${length}`);
            offset += length;
          }
          byReferenceActuals.push(callerName);
          continue;
        }
        throw new Error(`[COBOLISH] CALL argument ${identifier.getText()} does not match LINKAGE layout ${linkageName}`);
      }
      if (mode === 'REFERENCE') {
        for (let slot = 0; slot < actualSlots.length; slot += 1) {
          if (!this.compatibleReferenceSlot(actualSlots[slot].field, formalSlots[slot].field)) {
            throw new Error(`[COBOLISH] CALL argument ${identifier.getText()} has an incompatible BY REFERENCE layout for ${linkageName}`);
          }
          this.emit(`PUSH_REF ${actualSlots[slot].name}`);
        }
        byReferenceActuals.push(callerName);
      } else {
        for (let slot = 0; slot < actualSlots.length; slot += 1) {
          this.emit(`LOAD ${actualSlots[slot].name}`);
          this.emitReceiverConversion(formalSlots[slot].field, false);
        }
      }
    }
    this.emit(`CALL ${program.entryLabel} ${program.linkageFields.length}`);
    for (const name of new Set(byReferenceActuals)) {
      if (this.fieldOf(name)?.kind === 'group') this.rawGroupStates.delete(name);
      this.invalidateRawGroups(name);
    }
  }

  isProgramVisible(program) {
    return !program.parent
      || program.parent === this.currentProgram
      || (program.common && program.parent === this.currentProgram?.parent);
  }

  emitCobolProgramCall(ctx, target, targetNode, callItems) {
    const onException = asArray(ctx.callOnExceptionClause?.()?.sentence?.());
    const onOverflow = asArray(ctx.callOverflowClause?.()?.sentence?.());
    const notOnException = asArray(ctx.callNotOnExceptionClause?.()?.sentence?.());
    const exceptionSentences = [...onException, ...onOverflow];
    const knownProgram = this.programs.find(program =>
      program.key === storageName(target) && this.isProgramVisible(program));
    const dynamic = Boolean(targetNode.IDENTIFIER?.());
    const success = this.nextHiddenField();
    const end = this.nextLabel('CALL_END');
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${success}`);

    if (dynamic) {
      const targetName = this.resolveProgramDataName(this.currentProgram, storageName(target));
      if (!targetName) throw new Error(`[COBOLISH] Undeclared CALL target ${target}`);
      const targetValue = this.nextHiddenField();
      this.emitNamedReference(targetName);
      this.emit('TRIM');
      this.emit('UPPER');
      this.emit(`STORE ${targetValue}`);
      for (const program of this.programs.filter(item => this.isProgramVisible(item))) {
        const next = this.nextLabel('CALL_NEXT');
        this.emit(`LOAD ${targetValue}`);
        this.emit(`PUSH_STR ${JSON.stringify(program.sourceId)}`);
        this.emit('STREQ');
        this.emit(`JZ ${next}`);
        if (program.linkageNames.length === callItems.length) {
          this.emitProgramInvocation(program, callItems);
          this.emit('PUSH_INT 1');
          this.emit(`STORE ${success}`);
          this.emit(`JMP ${end}`);
        } else {
          this.emit(`JMP ${end}`);
        }
        this.emit(`${next}:`);
      }
    } else if (knownProgram) {
      this.emitProgramInvocation(knownProgram, callItems);
      this.emit('PUSH_INT 1');
      this.emit(`STORE ${success}`);
    } else if (!exceptionSentences.length && !notOnException.length) {
      this.emit(`CALL PARA_${storageName(target)} 0`);
      return;
    }

    if (exceptionSentences.length || notOnException.length) {
      const failed = this.nextLabel('CALL_EXCEPTION');
      this.emit(`LOAD ${success}`);
      this.emit(`JZ ${failed}`);
      for (const sentence of notOnException) this.visitSentenceNode(sentence);
      this.emit(`JMP ${end}`);
      this.emit(`${failed}:`);
      for (const sentence of exceptionSentences) this.visitSentenceNode(sentence);
      if (!exceptionSentences.length) this.emit('CALL PARA___COBOL_MISSING_PROGRAM 0');
    } else if (dynamic) {
      const missing = this.nextLabel('CALL_MISSING');
      this.emit(`LOAD ${success}`);
      this.emit(`JZ ${missing}`);
      this.emit(`JMP ${end}`);
      this.emit(`${missing}:`);
      this.emit('CALL PARA___COBOL_MISSING_PROGRAM 0');
    }
    this.emit(`${end}:`);
  }

  emitCancel(ctx) {
    const names = (ctx.STRING_LITERAL?.() || []).map(item => unquote(text(item)).toUpperCase());
    for (const name of names) {
      const program = this.programs.find(item => item.key === storageName(name));
      if (program && !program.initial) this.emitProgramStateReset(program, ['WORKING']);
    }
    for (const identifier of ctx.IDENTIFIER?.() || []) {
      const name = storageName(identifier.getText());
      const targetName = this.resolveProgramDataName(this.currentProgram, name);
      const targetField = targetName ? this.fieldOf(targetName) : null;
      if (!targetField || targetField.kind !== 'string') {
        throw new Error(`[COBOLISH] CANCEL identifier ${name} must name an alphanumeric program-name item`);
      }
      const targetValue = this.nextHiddenStringField(targetField.length);
      this.emitNamedReference(targetName);
      this.emit('TRIM');
      this.emit('UPPER');
      this.emit(`STORE ${targetValue}`);
      for (const program of this.programs.filter(item => this.isProgramVisible(item) && !item.initial)) {
        const next = this.nextLabel('CANCEL_NEXT');
        this.emit(`LOAD ${targetValue}`);
        this.emit(`PUSH_STR ${JSON.stringify(program.sourceId.toUpperCase())}`);
        this.emit('STREQ');
        this.emit(`JZ ${next}`);
        this.emitProgramStateReset(program, ['WORKING']);
        this.emit(`${next}:`);
      }
    }
  }

  emitMove(ctx) {
    const source = ctx.moveSource();
    const literal = source.literal?.();
    const literalText = text(literal);
    if (literal && (literal.figurativeConstant?.() || literal.allLiteral?.())) {
      for (const target of ctx.receivingList().dataReference()) {
        const name = this.resolveDataName(target);
        const field = this.fieldOf(name);
        if (field?.kind !== 'string' || target.expression().length) {
          throw new Error(`[COBOLISH] Figurative literal ${literalText} requires an unsubscripted alphanumeric receiver`);
        }
        const value = literalStringValue(literal, field.length);
        if (value === null) throw new Error(`[COBOLISH] Figurative literal ${literalText} is not an alphanumeric value`);
        const aligned = field.justified
          ? value.padStart(field.length).slice(-field.length)
          : value.padEnd(field.length).slice(0, field.length);
        this.emit(`PUSH_STR ${JSON.stringify(aligned)}`);
        this.emit(`STORE ${name}`);
      }
      return;
    }
    const sourceReference = source.dataReference?.();
    const sourceField = sourceReference
      ? this.fieldOf(this.resolveDataName(sourceReference))
      : null;
    const sourceLiteral = source.literal?.();
    const numericSource = sourceField?.kind === 'decimal'
      || Boolean(sourceLiteral && /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/i.test(text(sourceLiteral)));
    const value = this.nextHiddenField();
    if (source.intrinsicFunction?.()) this.emitIntrinsicFunction(source.intrinsicFunction());
    else if (source.literal?.()) this.emitLiteral(source.literal());
    else this.emitReference(source.dataReference());
    this.emit(`STORE ${value}`);
    for (const target of ctx.receivingList().dataReference()) {
      const name = this.resolveDataName(target);
      const field = this.fieldOf(name);
      const constant = source.literal?.() && field?.kind === 'string' && !field.redefinesBase
        ? literalStringValue(source.literal(), field.length) : null;
      if (constant !== null && !target.expression().length && !this.isReferenceModified(target)) {
        const aligned = field.justified
          ? constant.padStart(field.length).slice(-field.length)
          : constant.padEnd(field.length).slice(0, field.length);
        this.emit(`PUSH_STR ${JSON.stringify(aligned)}`);
        this.emit(`STORE ${name}`);
      } else {
        this.emit(`LOAD ${value}`);
        const targetModified = this.isReferenceModified(target);
        if (field?.editedPicture && numericSource && !this.isReferenceModified(sourceReference) && !targetModified) {
          this.emit(`DEC_EDIT ${JSON.stringify(field.editedPicture)} ${this.decimalPointComma ? 1 : 0} ${field.blankWhenZero ? 1 : 0}`);
        } else if (sourceField?.editedPicture && field?.kind === 'decimal' && !targetModified) {
          this.runtimeLibraries.add('math');
          this.emit('CALL PROC_COBOL_RT_NUMVAL_C 1');
        } else if ((field?.kind === 'string' || targetModified) && sourceField?.kind === 'decimal'
          && !this.isReferenceModified(sourceReference)) {
          this.emit(`DEC_DISPLAY ${sourceField.precision} ${sourceField.scale}`);
        }
        this.storeReference(target);
      }
    }
  }

  emitMoveCorresponding(ctx) {
    const source = ctx.dataReference();
    const targets = ctx.receivingList().dataReference();
    for (const target of targets) {
      for (const pair of this.correspondingFields(source, target)) {
        this.emitNamedReference(pair.source.name);
        this.storeNamedReference(pair.target.name);
      }
    }
  }

  emitStringItem(item) {
    if (item.literal()) this.emitLiteral(item.literal());
    else this.emitReference(item.dataReference());
  }

  emitOverflow(clause, flag) {
    if (!clause) return;
    const failed = this.nextLabel('OVERFLOW');
    const end = this.nextLabel('OVERFLOW_END');
    const success = [];
    const failure = [];
    let not = false;
    for (const child of clause.children || []) {
      if (text(child).toUpperCase() === 'NOT') not = true;
      if (child.constructor?.name === 'SentenceContext') (not ? success : failure).push(child);
    }
    this.emit(`LOAD ${flag}`);
    this.emit(`JZ ${failed}`);
    for (const sentence of failure) this.visitSentenceNode(sentence);
    this.emit(`JMP ${end}`);
    this.emit(`${failed}:`);
    for (const sentence of success) this.visitSentenceNode(sentence);
    this.emit(`${end}:`);
  }

  emitString(ctx) {
    const [target, pointer] = ctx.dataReference();
    const field = this.fieldOf(this.resolveDataName(target));
    if (field?.kind !== 'string' || field.justified || target.expression().length) {
      throw new Error('[COBOLISH] STRING requires an elementary alphanumeric receiver without JUSTIFIED or reference modification');
    }
    const combined = this.nextHiddenField();
    const position = this.nextHiddenField();
    const count = this.nextHiddenField();
    const overflow = this.nextHiddenField();
    const done = this.nextLabel('STRING_DONE');
    this.emit('PUSH_STR ""');
    for (const group of ctx.stringGroup()) {
      const items = group.stringItem();
      const sources = group.SIZE() ? items : items.slice(0, -1);
      for (const item of sources) {
        this.emitStringItem(item);
        if (!group.SIZE()) {
          const value = this.nextHiddenField();
          const index = this.nextHiddenField();
          const full = this.nextLabel('STRING_FULL');
          this.emit(`STORE ${value}`);
          this.emit(`LOAD ${value}`);
          this.emitStringItem(items.at(-1));
          this.emit('CALL_EXT host.string_index 2');
          this.emit(`STORE ${index}`);
          this.emit(`LOAD ${value}`);
          this.emit(`LOAD ${index}`);
          this.emit('PUSH_INT 0');
          this.emit('LT');
          this.emit(`JZ ${full}_SLICE`);
          this.emit(`JMP ${full}`);
          this.emit(`${full}_SLICE:`);
          this.emitSlice(() => this.emit('PUSH_INT 0'), () => this.emit(`LOAD ${index}`));
          this.emit(`${full}:`);
        }
        this.emit('CONCAT');
      }
    }
    this.emit(`STORE ${combined}`);
    if (pointer) this.emitReference(pointer);
    else this.emit('PUSH_INT 1');
    this.emit('PUSH_INT 1');
    this.emit('SUB');
    this.emit(`STORE ${position}`);
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${overflow}`);
    this.emit(`LOAD ${position}`);
    this.emit('PUSH_INT 0');
    this.emit('LT');
    this.emit(`LOAD ${position}`);
    this.emit(`PUSH_INT ${field.length}`);
    this.emit('GE');
    this.emit('OR');
    this.emit(`JZ ${done}_VALID`);
    this.emit(`JMP ${done}`);
    this.emit(`${done}_VALID:`);
    this.emit(`LOAD ${combined}`);
    this.emitTextLength();
    this.emit(`STORE ${count}`);
    this.emit(`LOAD ${count}`);
    this.emit(`PUSH_INT ${field.length}`);
    this.emit(`LOAD ${position}`);
    this.emit('SUB');
    this.emit('GT');
    this.emit(`JZ ${done}_FITS`);
    this.emit(`PUSH_INT ${field.length}`);
    this.emit(`LOAD ${position}`);
    this.emit('SUB');
    this.emit(`STORE ${count}`);
    this.emit(`JMP ${done}_WRITE`);
    this.emit(`${done}_FITS:`);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${overflow}`);
    this.emit(`${done}_WRITE:`);
    this.emitReference(target);
    this.emitSlice(() => this.emit('PUSH_INT 0'), () => this.emit(`LOAD ${position}`));
    this.emit(`LOAD ${combined}`);
    this.emitSlice(() => this.emit('PUSH_INT 0'), () => this.emit(`LOAD ${count}`));
    this.emit('CONCAT');
    this.emitReference(target);
    this.emitSlice(() => {
      this.emit(`LOAD ${position}`);
      this.emit(`LOAD ${count}`);
      this.emit('ADD');
    }, () => this.emit(`PUSH_INT ${field.length}`));
    this.emit('CONCAT');
    this.storeReference(target);
    if (pointer) {
      this.emit(`LOAD ${position}`);
      this.emit(`LOAD ${count}`);
      this.emit('ADD');
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.storeReference(pointer);
    }
    this.emit(`${done}:`);
    this.emitOverflow(ctx.overflowClause(), overflow);
  }

  emitUnstring(ctx) {
    const delimiters = ctx.unstringDelimiter();
    if (delimiters.length === 0) throw new Error('[COBOLISH] UNSTRING requires at least one delimiter');
    const pointer = ctx.POINTER() ? ctx.dataReference(0) : null;
    const tally = ctx.TALLYING() ? ctx.dataReference(pointer ? 1 : 0) : null;
    const receivers = ctx.unstringReceiver();
    const source = this.nextHiddenField();
    const length = this.nextHiddenField();
    const position = this.nextHiddenField();
    const end = this.nextLabel('UNSTRING_END');
    const overflow = this.nextHiddenField();
    const delimiterValues = delimiters.map(delimiter => {
      const value = this.nextHiddenField();
      this.emitStringItem(delimiter.stringItem());
      this.emit(`STORE ${value}`);
      return { value, all: Boolean(delimiter.ALL()) };
    });
    this.emitStringItem(ctx.stringItem());
    this.emit(`STORE ${source}`);
    this.emit(`LOAD ${source}`);
    this.emitTextLength();
    this.emit(`STORE ${length}`);
    if (pointer) this.emitReference(pointer);
    else this.emit('PUSH_INT 1');
    this.emit('PUSH_INT 1');
    this.emit('SUB');
    this.emit(`STORE ${position}`);
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${overflow}`);
    this.emit(`LOAD ${position}`);
    this.emit('PUSH_INT 0');
    this.emit('LT');
    this.emit(`LOAD ${position}`);
    this.emit(`LOAD ${length}`);
    this.emit('GE');
    this.emit('OR');
    this.emit(`JZ ${end}_VALID`);
    this.emit(`JMP ${end}`);
    this.emit(`${end}_VALID:`);
    for (const receiver of receivers) {
      const next = this.nextLabel('UNSTRING_NEXT');
      const tail = this.nextHiddenField();
      const split = this.nextHiddenField();
      const candidate = this.nextHiddenField();
      const segmentStart = this.nextHiddenField();
      const chosenDelimiter = this.nextHiddenField();
      const delimiterLength = this.nextHiddenField();
      const all = this.nextHiddenField();
      this.emit(`LOAD ${position}`);
      this.emit(`LOAD ${length}`);
      this.emit('LT');
      this.emit(`JZ ${next}`);
      this.emit(`LOAD ${position}`);
      this.emit(`STORE ${segmentStart}`);
      this.emit(`LOAD ${source}`);
      this.emitSlice(() => this.emit(`LOAD ${position}`), () => this.emit(`LOAD ${length}`));
      this.emit(`STORE ${tail}`);
      this.emit(`LOAD ${length}`);
      this.emit(`LOAD ${position}`);
      this.emit('SUB');
      this.emit(`STORE ${split}`);
      this.emit('PUSH_STR ""');
      this.emit(`STORE ${chosenDelimiter}`);
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${delimiterLength}`);
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${all}`);
      delimiterValues.forEach(({ value, all: allDelimiter }, index) => {
        const unmatched = this.nextLabel('UNSTRING_NO_MATCH');
        const nextDelimiter = this.nextLabel('UNSTRING_NEXT_DELIMITER');
        this.emit(`LOAD ${tail}`);
        this.emit(`LOAD ${value}`);
        this.emit('CALL_EXT host.string_index 2');
        this.emit(`STORE ${candidate}`);
        this.emit(`LOAD ${candidate}`);
        this.emit('PUSH_INT 0');
        this.emit('GE');
        this.emit(`JZ ${unmatched}`);
        this.emit(`LOAD ${candidate}`);
        this.emit(`LOAD ${split}`);
        this.emit('LT');
        this.emit(`JZ ${unmatched}`);
        this.emit(`LOAD ${candidate}`);
        this.emit(`STORE ${split}`);
        this.emit(`LOAD ${value}`);
        this.emit(`STORE ${chosenDelimiter}`);
        this.emit(`LOAD ${value}`);
        this.emitTextLength();
        this.emit(`STORE ${delimiterLength}`);
        this.emit(`PUSH_INT ${allDelimiter ? 1 : 0}`);
        this.emit(`STORE ${all}`);
        this.emit(`JMP ${nextDelimiter}`);
        this.emit(`${unmatched}:`);
        this.emit(`${nextDelimiter}:`);
      });
      const currentReceiver = receiver.dataReference(0);
      this.emit(`LOAD ${tail}`);
      this.emitSlice(() => this.emit('PUSH_INT 0'), () => this.emit(`LOAD ${split}`));
      this.storeReference(currentReceiver);
      const receiverReferences = receiver.dataReference();
      let referenceIndex = 1;
      if (receiver.DELIMITER()) {
        this.emit(`LOAD ${chosenDelimiter}`);
        this.storeReference(receiverReferences[referenceIndex++]);
      }
      if (receiver.COUNT()) {
        this.emit(`LOAD ${split}`);
        this.storeReference(receiverReferences[referenceIndex]);
      }
      this.emit(`LOAD ${segmentStart}`);
      this.emit(`LOAD ${split}`);
      this.emit('ADD');
      this.emit(`LOAD ${delimiterLength}`);
      this.emit('ADD');
      this.emit(`STORE ${position}`);
      const skipAll = this.nextLabel('UNSTRING_SKIP_ALL');
      const repeat = this.nextLabel('UNSTRING_REPEAT_DELIMITER');
      const doneAll = this.nextLabel('UNSTRING_ALL_DONE');
      this.emit(`LOAD ${all}`);
      this.emit(`JZ ${skipAll}`);
      this.emit(`${repeat}:`);
      this.emit(`LOAD ${delimiterLength}`);
      this.emit('PUSH_INT 0');
      this.emit('GT');
      this.emit(`JZ ${doneAll}`);
      this.emit(`LOAD ${position}`);
      this.emit(`LOAD ${length}`);
      this.emit('GE');
      this.emit(`JZ ${doneAll}_CHECK`);
      this.emit(`JMP ${doneAll}`);
      this.emit(`${doneAll}_CHECK:`);
      this.emit(`LOAD ${source}`);
      this.emitSlice(() => this.emit(`LOAD ${position}`), () => {
        this.emit(`LOAD ${position}`);
        this.emit(`LOAD ${delimiterLength}`);
        this.emit('ADD');
      });
      this.emit(`LOAD ${chosenDelimiter}`);
      this.emit('EQ');
      this.emit(`JZ ${doneAll}`);
      this.emit(`LOAD ${position}`);
      this.emit(`LOAD ${delimiterLength}`);
      this.emit('ADD');
      this.emit(`STORE ${position}`);
      this.emit(`JMP ${repeat}`);
      this.emit(`${doneAll}:`);
      this.emit(`${skipAll}:`);
      if (tally) {
        this.emitReference(tally);
        this.emit('PUSH_DEC 1 0');
        this.emit('ADD');
        this.storeReference(tally);
      }
      this.emit(`${next}:`);
    }
    this.emit(`LOAD ${position}`);
    this.emit(`LOAD ${length}`);
    this.emit('LT');
    this.emit(`STORE ${overflow}`);
    if (pointer) {
      this.emit(`LOAD ${position}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.storeReference(pointer);
    }
    this.emit(`${end}:`);
    this.emitOverflow(ctx.overflowClause(), overflow);
  }

  emitCompute(ctx) {
    const phrases = this.sizeErrorPhrases(ctx);
    const receivers = ctx.arithmeticReceivers().arithmeticReceiver();
    for (const receiver of receivers) {
      this.emitExpression(ctx.expression());
      this.storeArithmeticResult(receiver, phrases);
    }
  }

  sizeErrorPhrases(ctx) {
    const phrases = ctx.sizeErrorPhrases?.();
    return { onError: phrases?.sizeErrorClause() || null, notOnError: phrases?.notSizeErrorClause() || null };
  }

  storeArithmeticResult(receiver, phrases) {
    const target = receiver.dataReference();
    const rounded = Boolean(receiver.ROUNDED());
    if (phrases.onError || phrases.notOnError) {
      if (target.expression().length || this.isReferenceModified(target)) {
        throw new Error('[COBOLISH] Subscripted ON SIZE ERROR receiver is not yet implemented');
      }
      this.emitSizeGuardedStore(target.IDENTIFIER().getText(), rounded, phrases.onError, phrases.notOnError);
    } else this.storeReference(target, rounded);
  }

  // ADD x TO y is `y := y + x`; SUBTRACT/MULTIPLY/DIVIDE follow the same shape.
  // The GIVING forms compute the result once from the operands instead.
  emitArithmetic(ctx, verb) {
    if (ctx.correspondingPhrase?.()) {
      const operands = ctx.expression();
      const receivers = ctx.arithmeticReceivers?.()?.arithmeticReceiver?.() || [];
      if (!['ADD', 'SUBTRACT'].includes(verb) || operands.length !== 1
        || receivers.length === 0 || ctx.givingPhrase?.()) {
        throw new Error(`[COBOLISH] ${verb} CORRESPONDING requires one group operand and group receivers`);
      }
      const source = this.findDataReference(operands[0]);
      if (!source) throw new Error(`[COBOLISH] ${verb} CORRESPONDING requires a group operand`);
      for (const receiver of receivers) {
        const target = receiver.dataReference();
        for (const pair of this.correspondingFields(source, target)) {
          if (pair.source.field.kind !== 'decimal' || pair.target.field.kind !== 'decimal') continue;
          this.emitNamedReference(pair.target.name);
          this.emitNamedReference(pair.source.name);
          this.emit(verb === 'ADD' ? 'ADD' : 'SUB');
          this.storeNamedReference(pair.target.name, receiver.ROUNDED?.());
        }
      }
      return;
    }
    const giving = ctx.givingPhrase?.();
    const remainder = giving?.REMAINDER() ? giving.dataReference() : null;
    const phrases = this.sizeErrorPhrases(ctx);
    const operands = ctx.expression();
    let dividend = null;
    let divisor = null;
    if (remainder) {
      if (verb !== 'DIVIDE' || !giving || operands.length !== 2) {
        throw new Error('[COBOLISH] REMAINDER requires DIVIDE with two operands and GIVING');
      }
      dividend = this.nextHiddenField();
      divisor = this.nextHiddenField();
      const dividendExpression = ctx.BY() ? operands[0] : operands[1];
      const divisorExpression = ctx.BY() ? operands[1] : operands[0];
      this.emitExpression(dividendExpression);
      this.emit(`STORE ${dividend}`);
      this.emitExpression(divisorExpression);
      this.emit(`STORE ${divisor}`);
    }
    const emitSum = list => list.forEach((operand, index) => {
      this.emitExpression(operand);
      if (index) this.emit('ADD');
    });
    const receivers = giving ? giving.arithmeticReceivers().arithmeticReceiver() : ctx.arithmeticReceivers().arithmeticReceiver();
    for (const receiver of receivers) {
      const target = receiver.dataReference();
      const zeroCheck = verb === 'DIVIDE' && phrases.onError;
      const divideLabel = zeroCheck ? this.nextLabel('DIVIDE_NONZERO') : null;
      const divideEnd = zeroCheck ? this.nextLabel('DIVIDE_END') : null;
      if (zeroCheck) {
        const divisorExpression = ctx.BY() ? operands[1] : operands[0];
        this.emitExpression(divisorExpression);
        this.emit('PUSH_DEC 0 0');
        this.emit('EQ');
        this.emit(`JZ ${divideLabel}`);
        for (const sentence of phrases.onError.sentence() || []) this.visitSentenceNode(sentence);
        this.emit(`JMP ${divideEnd}`);
        this.emit(`${divideLabel}:`);
      }
      if (verb === 'ADD') {
        if (giving) emitSum(operands);
        else {
          this.emitReference(target);
          emitSum(operands);
          this.emit('ADD');
        }
      } else if (verb === 'SUBTRACT') {
        if (giving) this.emitExpression(operands.at(-1));
        else this.emitReference(target);
        emitSum(giving ? operands.slice(0, -1) : operands);
        this.emit('SUB');
      } else if (verb === 'MULTIPLY') {
        this.emitExpression(operands[0]);
        if (giving) this.emitExpression(operands[1]);
        else this.emitReference(target);
        this.emit('MUL');
      } else {
        // DIVIDE a INTO b: b / a. DIVIDE a BY b GIVING c: a / b. DIVIDE a BY b (Cobolish): b / a.
        if (giving && ctx.BY()) {
          this.emitExpression(operands[0]);
          this.emitExpression(operands[1]);
        } else {
          if (giving) this.emitExpression(operands[1]);
          else this.emitReference(target);
          this.emitExpression(operands[0]);
        }
        this.emit('DIV');
      }
      this.storeArithmeticResult(receiver, phrases);
      if (remainder) {
        this.emit(`LOAD ${dividend}`);
        this.emitReference(target);
        this.emit(`LOAD ${divisor}`);
        this.emit('MUL');
        this.emit('SUB');
        this.storeReference(remainder);
      }
      if (zeroCheck) {
        this.emit(`JMP ${divideEnd}`);
        this.emit(`${divideEnd}:`);
      }
    }
  }

  emitIf(ctx) {
    const elseLabel = this.nextLabel('COB_ELSE');
    const endLabel = this.nextLabel('COB_ENDIF');
    this.emitCondition(ctx.condition());
    this.emit(`JZ ${elseLabel}`);
    for (const sentence of ctx.sentence() || []) this.visitSentenceNode(sentence);
    this.emit(`JMP ${endLabel}`);
    this.emit(`${elseLabel}:`);
    const elseClause = ctx.elseClause && ctx.elseClause();
    if (elseClause) {
      for (const sentence of elseClause.sentence() || []) this.visitSentenceNode(sentence);
    }
    this.emit(`${endLabel}:`);
  }

  emitSearch(ctx) {
    const tableReference = ctx.dataReference(0);
    const tableName = this.resolveDataName(tableReference);
    const table = this.fieldOf(tableName);
    if (!table || table.kind !== 'group' && table.kind !== 'string' || table.dimensions.length !== 1
      || tableReference.expression().length) {
      throw new Error('[COBOLISH] SEARCH requires an unsubscripted one-dimensional table');
    }
    const indexName = table.indexNames?.[0];
    if (!indexName) throw new Error(`[COBOLISH] Table ${tableName} requires INDEXED BY for SEARCH`);
    const indexField = this.fieldOf(indexName);
    if (indexField?.kind !== 'decimal') throw new Error(`[COBOLISH] SEARCH index ${indexName} is not numeric`);
    const end = this.nextLabel('SEARCH_END');
    const exhausted = this.nextLabel('SEARCH_EXHAUSTED');
    const atEnd = ctx.sentence() || [];
    const whens = ctx.searchWhen();
    const emitAtEnd = () => {
      for (const sentence of atEnd) this.visitSentenceNode(sentence);
    };

    if (!ctx.ALL()) {
      const loop = this.nextLabel('SEARCH_LOOP');
      const varying = ctx.VARYING() ? ctx.dataReference(1) : null;
      const varyingName = varying ? this.resolveDataName(varying) : null;
      this.emit(`${loop}:`);
      this.emit(`LOAD ${indexName}`);
      this.emit('PUSH_INT 1');
      this.emit('LT');
      this.emit(`JZ ${loop}_UPPER`);
      this.emit(`JMP ${exhausted}`);
      this.emit(`${loop}_UPPER:`);
      this.emit(`LOAD ${indexName}`);
      this.emit(`PUSH_INT ${table.dimensions[0]}`);
      this.emit('GT');
      this.emit(`JZ ${loop}_TEST`);
      this.emit(`JMP ${exhausted}`);
      this.emit(`${loop}_TEST:`);
      for (const whenClause of whens) {
        const next = this.nextLabel('SEARCH_NEXT_WHEN');
        this.emitCondition(whenClause.condition());
        this.emit(`JZ ${next}`);
        for (const sentence of whenClause.sentence() || []) this.visitSentenceNode(sentence);
        this.emit(`JMP ${end}`);
        this.emit(`${next}:`);
      }
      this.emit(`LOAD ${indexName}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.emit(`STORE ${indexName}`);
      if (varyingName && varyingName !== indexName) {
        this.emit(`LOAD ${varyingName}`);
        this.emit('PUSH_INT 1');
        this.emit('ADD');
        this.emit(`STORE ${varyingName}`);
      }
      this.emit(`JMP ${loop}`);
    } else {
      if (ctx.VARYING()) throw new Error('[COBOLISH] SEARCH ALL with VARYING is not supported');
      if (whens.length !== 1) throw new Error('[COBOLISH] SEARCH ALL currently requires one WHEN condition');
      const condition = whens[0].condition();
      const relation = condition.relation?.();
      const expressions = relation?.expression?.() || [];
      const leftReference = expressions[0] && this.findDataReference(expressions[0]);
      if (!relation || expressions.length !== 2 || !leftReference
        || comparisonOpcode(relation.comparator()) !== 'EQ') {
        throw new Error('[COBOLISH] SEARCH ALL requires a single equality condition on a table key');
      }
      const keyField = this.fieldOf(this.resolveDataName(leftReference));
      if (!table.sortKeys?.includes(keyField?.sourceName)
        || !keyField.path.slice(1).includes(table.sourceName)) {
        throw new Error(`[COBOLISH] SEARCH ALL condition must use a declared key of ${tableName}`);
      }
      const low = this.nextHiddenField();
      const high = this.nextHiddenField();
      const middle = this.nextHiddenField();
      const loop = this.nextLabel('SEARCH_ALL_LOOP');
      const updateHigh = this.nextLabel('SEARCH_ALL_HIGH');
      this.emit('PUSH_INT 1');
      this.emit(`STORE ${low}`);
      this.emit(`PUSH_INT ${table.dimensions[0]}`);
      this.emit(`STORE ${high}`);
      this.emit(`${loop}:`);
      this.emit(`LOAD ${low}`);
      this.emit(`LOAD ${high}`);
      this.emit('GT');
      this.emit(`JZ ${loop}_PROBE`);
      this.emit(`JMP ${exhausted}`);
      this.emit(`${loop}_PROBE:`);
      this.emit(`LOAD ${low}`);
      this.emit(`LOAD ${high}`);
      this.emit('ADD');
      this.emit('PUSH_INT 2');
      this.emit('DIV');
      this.emit('DEC_QUANT 0');
      this.emit(`STORE ${middle}`);
      this.emit(`LOAD ${middle}`);
      this.emit(`STORE ${indexName}`);
      this.emitExpression(expressions[0]);
      this.emitExpression(expressions[1]);
      this.emit('EQ');
      this.emit(`JZ ${loop}_DIRECTION`);
      for (const sentence of whens[0].sentence() || []) this.visitSentenceNode(sentence);
      this.emit(`JMP ${end}`);
      this.emit(`${loop}_DIRECTION:`);
      this.emitExpression(expressions[0]);
      this.emitExpression(expressions[1]);
      this.emit(table.sortDescending ? 'GT' : 'LT');
      this.emit(`JZ ${updateHigh}`);
      this.emit(`LOAD ${middle}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.emit(`STORE ${low}`);
      this.emit(`JMP ${loop}`);
      this.emit(`${updateHigh}:`);
      this.emit(`LOAD ${middle}`);
      this.emit('PUSH_INT 1');
      this.emit('SUB');
      this.emit(`STORE ${high}`);
      this.emit(`JMP ${loop}`);
    }

    this.emit(`${exhausted}:`);
    emitAtEnd();
    this.emit(`${end}:`);
  }

  // Consecutive WHEN phrases with no statements share the next phrase's statements.
  emitEvaluate(ctx) {
    const endLabel = this.nextLabel('COB_ENDEVAL');
    const subjects = ctx.evaluateSubject() || [];
    let pending = [];
    for (const whenClause of ctx.whenClause() || []) {
      const conditions = whenClause.whenCondition() || [];
      const sentences = whenClause.sentence() || [];
      if (whenClause.OTHER()) {
        for (const sentence of sentences) this.visitSentenceNode(sentence);
        pending = [];
        continue;
      }
      pending.push(conditions);
      if (!sentences.length) continue;
      const nextLabel = this.nextLabel('COB_WHEN');
      pending.forEach((conditionGroup, index) => {
        this.emitWhenConditions(conditionGroup, subjects);
        if (index) this.emit('OR');
      });
      pending = [];
      this.emit(`JZ ${nextLabel}`);
      for (const sentence of sentences) this.visitSentenceNode(sentence);
      this.emit(`JMP ${endLabel}`);
      this.emit(`${nextLabel}:`);
    }
    this.emit(`${endLabel}:`);
  }

  emitWhenConditions(conditions, subjects) {
    if (conditions.length !== subjects.length) {
      throw new Error('[COBOLISH] EVALUATE and WHEN ALSO phrases must have the same number of subjects');
    }
    conditions.forEach((condition, index) => {
      this.emitWhenCondition(condition, subjects[index]);
      if (index) this.emit('AND');
    });
  }

  emitEvaluateSubject(subject) {
    if (subject.expression()) this.emitExpression(subject.expression());
    else this.emitCondition(subject.condition());
  }

  emitWhenCondition(ctx, subject) {
    const expressions = ctx.expression() || [];
    if (expressions.length === 2) {
      const lengths = expressions.map(expression => this.alphanumericLength(expression));
      const knownLengths = lengths.filter(length => length !== null);
      const width = knownLengths.length ? Math.max(...knownLengths) : null;
      for (const expression of expressions) {
        this.emitExpression(expression, width);
        if (width !== null) this.emitReceiverConversion({ kind: 'string', length: width }, false);
      }
      this.emit(comparisonOpcode(ctx.comparator()));
      if (/^FALSE$/i.test(text(subject))) this.emit('NOT');
      return;
    }
    if (ctx.ANY()) {
      this.emit('PUSH_INT 1');
      return;
    }
    if (ctx.condition()) {
      const subjectText = text(subject).toUpperCase();
      if (subjectText !== 'TRUE' && subjectText !== 'FALSE') {
        throw new Error('[COBOLISH] WHEN condition requires EVALUATE TRUE or FALSE');
      }
      this.emitCondition(ctx.condition());
      if (subjectText === 'FALSE') this.emit('NOT');
      return;
    }
    const range = ctx.whenRange();
    if (range?.THRU() || range?.THROUGH()) {
      this.emitEvaluateSubject(subject);
      this.emitExpression(range.expression(0));
      this.emit('GE');
      this.emitEvaluateSubject(subject);
      this.emitExpression(range.expression(1));
      this.emit('LE');
      this.emit('AND');
      if (range.NOT()) this.emit('NOT');
      return;
    }
    // A bare value is compared against the EVALUATE subject.
    const subjectLength = subject.expression() ? this.alphanumericLength(subject.expression()) : null;
    const literalLength = ctx.literal()?.stringLiteral()
      ? unquote(text(ctx.literal())).length : null;
    const identifierName = ctx.IDENTIFIER()
      ? this.resolveProgramDataName(this.currentProgram, storageName(ctx.IDENTIFIER().getText()))
        || storageName(ctx.IDENTIFIER().getText())
      : null;
    const identifierField = identifierName ? this.fieldOf(identifierName) : null;
    const valueLength = literalLength ?? (identifierField?.kind === 'string' ? identifierField.length : null);
    const knownLengths = [subjectLength, valueLength].filter(length => length !== null);
    const width = knownLengths.length ? Math.max(...knownLengths) : null;
    if (subject.expression()) {
      this.emitExpression(subject.expression(), width);
      if (width !== null) this.emitReceiverConversion({ kind: 'string', length: width }, false);
    } else this.emitEvaluateSubject(subject);
    if (ctx.literal()) {
      this.emitLiteral(ctx.literal(), width);
      if (width !== null) this.emitReceiverConversion({ kind: 'string', length: width }, false);
    } else if (ctx.booleanLiteral()) this.emit(`PUSH_INT ${/^TRUE$/i.test(text(ctx.booleanLiteral())) ? 1 : 0}`);
    else if (identifierName) {
      this.emitNamedReference(identifierName);
      if (width !== null) this.emitReceiverConversion({ kind: 'string', length: width }, false);
    } else this.emitExpression(range.expression(0));
    this.emit('EQ');
    if (range?.NOT()) this.emit('NOT');
  }

  emitPerform(ctx) {
    const inline = ctx.inlinePerform();
    const clauses = ctx.performClause() || [];
    const sources = inline ? [inline] : clauses;
    const afters = sources.flatMap(source => source.performAfter?.() || []);
    const until = sources.find(source => source.UNTIL())?.condition();
    const times = sources.find(source => source.TIMES())?.performCount();
    const varying = sources.find(source => source.VARYING());
    const testAfter = Boolean(sources.find(source => source.performTest?.())?.performTest().AFTER());
    if (afters.length && testAfter) throw new Error('[COBOLISH] PERFORM WITH TEST AFTER VARYING ... AFTER is recognized but not yet implemented');
    const variable = varying
      ? (this.resolveProgramDataName(this.currentProgram, storageName(varying.IDENTIFIER().getText()))
        || storageName(varying.IDENTIFIER().getText()))
      : null;
    const count = times ? this.nextHiddenField() : null;
    if (afters.length) return this.emitPerformVaryingAfter(ctx, [varying, ...afters]);
    if (varying) {
      this.emitExpression(varying.expression(0));
      this.storeInto(variable, false);
    }
    if (times) {
      if (times.cobolNumber()) this.emit(`PUSH_INT ${text(times.cobolNumber())}`);
      else this.emitReference(times.dataReference());
      this.emit(`STORE ${count}`);
    }
    const start = this.nextLabel('PERFORM');
    const body = this.nextLabel('PERFORM_BODY');
    const end = this.nextLabel('PERFORM_END');
    this.emit(`${start}:`);
    if (until && !testAfter) {
      this.emitCondition(until);
      this.emit(`JZ ${body}`);
      this.emit(`JMP ${end}`);
    } else if (times) {
      this.emit(`LOAD ${count}`);
      this.emit('PUSH_INT 0');
      this.emit('GT');
      this.emit(`JZ ${end}`);
    }
    this.emit(`${body}:`);
    this.emitPerformBody(ctx);
    if (varying) {
      this.emit(`LOAD ${variable}`);
      this.emitExpression(varying.expression(1));
      this.emit('ADD');
      this.storeInto(variable, false);
    }
    if (times) {
      this.emit(`LOAD ${count}`);
      this.emit('PUSH_INT 1');
      this.emit('SUB');
      this.emit(`STORE ${count}`);
    }
    if (until && testAfter) {
      this.emitCondition(until);
      this.emit(`JZ ${start}`);
    } else if (until || times) this.emit(`JMP ${start}`);
    this.emit(`${end}:`);
  }

  emitPerformBody(ctx) {
    const inline = ctx.inlinePerform();
    if (inline) {
      for (const sentence of inline.sentence()) this.visitSentenceNode(sentence);
      return;
    }
    const first = storageName(text(ctx.performTarget()));
    const range = (ctx.performClause() || []).find(clause => clause.THRU() || clause.THROUGH());
    const endTarget = range ? storageName(text(range.paragraphName())) : first;
    this.emitProcedureRange(first, endTarget);
  }

  emitProcedureRange(first, endTarget = first) {
    first = this.currentProgram?.procedureNames.get(storageName(first)) || storageName(first);
    endTarget = this.currentProgram?.procedureNames.get(storageName(endTarget)) || storageName(endTarget);
    const names = [...this.paragraphs.keys()];
    const last = this.sections.get(endTarget) || endTarget;
    const from = names.indexOf(first);
    const to = names.indexOf(last);
    if (from < 0 || to < from) throw new Error(`[COBOLISH] Invalid PERFORM paragraph range ${first} THRU ${last}`);
    // Arm the exit of the range's last paragraph; control returns when it reaches that end.
    const flag = `__COBOL_PEXIT_${last}`;
    const saved = this.nextHiddenField();
    this.emit(`LOAD ${flag}`);
    this.emit(`STORE ${saved}`);
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${flag}`);
    this.emitSegmentEntry(first);
    this.emit(`CALL PARA_${first} 0`);
    this.emit(`LOAD ${saved}`);
    this.emit(`STORE ${flag}`);
  }

  // VARYING ... AFTER: when an inner condition holds, reset that variable to its FROM value,
  // augment the next outer variable and retest the outer condition.
  emitPerformVaryingAfter(ctx, levels) {
    const names = levels.map(level => storageName(level.IDENTIFIER().getText()));
    const tests = levels.map(() => this.nextLabel('PERFORM_TEST'));
    const end = this.nextLabel('PERFORM_END');
    levels.forEach((level, index) => {
      this.emitExpression(level.expression(0));
      this.storeInto(names[index], false);
    });
    const augment = index => {
      this.emit(`LOAD ${names[index]}`);
      this.emitExpression(levels[index].expression(1));
      this.emit('ADD');
      this.storeInto(names[index], false);
    };
    levels.forEach((level, index) => {
      const next = this.nextLabel('PERFORM_NEXT');
      this.emit(`${tests[index]}:`);
      this.emitCondition(level.condition());
      this.emit(`JZ ${next}`);
      if (index === 0) this.emit(`JMP ${end}`);
      else {
        this.emitExpression(level.expression(0));
        this.storeInto(names[index], false);
        augment(index - 1);
        this.emit(`JMP ${tests[index - 1]}`);
      }
      this.emit(`${next}:`);
    });
    this.emitPerformBody(ctx);
    augment(levels.length - 1);
    this.emit(`JMP ${tests.at(-1)}`);
    this.emit(`${end}:`);
  }

  emitDisplay(ctx) {
    for (const item of ctx.displayItem() || []) {
      if (item.intrinsicFunction()) this.emitIntrinsicFunction(item.intrinsicFunction());
      else if (item.literal()) this.emitLiteral(item.literal());
      else {
        const reference = item.dataReference();
        this.emitReference(reference);
        const field = this.fieldOf(this.resolveDataName(reference));
        if (field.kind === 'decimal' && !this.isReferenceModified(reference)) {
          this.emit(`DEC_DISPLAY ${field.precision} ${field.scale}`);
        }
      }
      this.emit('PRINT');
    }
    // UPON names a device; every device maps to the same console stream.
    if (!ctx.displayNoAdvancingClause()) this.emit('PRINT_NL');
  }

  emitAccept(ctx) {
    const source = ctx.IDENTIFIER?.()?.getText()?.toUpperCase();
    for (const target of ctx.receivingList().dataReference()) {
      if (source) {
        this.emit(`PUSH_STR ${JSON.stringify(source)}`);
        this.emit('CALL_EXT host.date_accept 1');
      } else this.emit('LOAD_NAME src');
      this.storeReference(target);
    }
  }

  emitInitialize(ctx) {
    const categories = asArray(ctx.initializeCategory());
    const values = asArray(ctx.inspectValue());
    const replacements = new Map(categories.map((category, index) => [
      text(category).toUpperCase().replace(/\s+DATA$/, ''),
      values[index]
    ]));
    for (const reference of ctx.dataReference()) {
      const rootName = this.resolveDataName(reference);
      const root = this.fieldOf(rootName);
      if (!root) throw new Error(`[COBOLISH] Undeclared data item ${rootName}`);
      if (reference.expression().length && root.kind === 'group') {
        throw new Error('[COBOLISH] INITIALIZE of a subscripted group is not yet implemented');
      }
      const leaves = [];
      const collect = (name) => {
        const field = this.fieldOf(name);
        if (field.kind === 'group') {
          field.children.forEach(collect);
        } else leaves.push({ name, field });
      };
      collect(rootName);
      for (const { name, field } of leaves) {
        const category = field.kind === 'decimal' ? 'NUMERIC' : 'ALPHANUMERIC';
        const replacement = replacements.get(category) || replacements.get(`${category}_DATA`) || null;
        const count = field.dimensions.reduce((total, dimension) => total * dimension, 1);
        if (reference.expression().length) {
          if (name !== rootName) throw new Error('[COBOLISH] INITIALIZE of a subscripted group is not yet implemented');
          this.emitInitializeValue(replacement, field);
          this.storeReference(reference);
          continue;
        }
        for (let index = 0; index < count; index += 1) {
          this.emitInitializeValue(replacement, field);
          const storage = field.dimensions.length ? `${name}_${index}` : name;
          this.emitReceiverConversion(field, false);
          this.emit(`STORE ${storage}`);
        }
      }
    }
  }

  emitInitializeValue(replacement, field) {
    if (replacement) {
      if (replacement.literal()) this.emitLiteral(replacement.literal(), field.kind === 'string' ? field.length : null);
      else this.emitReference(replacement.dataReference());
      return;
    }
    if (field.kind === 'decimal') this.emit('PUSH_DEC 0 0');
    else this.emit(`PUSH_STR ${JSON.stringify(' '.repeat(field.length))}`);
  }

  emitInspect(ctx) {
    const target = ctx.dataReference();
    const name = this.resolveDataName(target);
    const field = this.fieldOf(name);
    if (!field || field.kind !== 'string' || target.expression().length || this.isReferenceModified(target)) {
      throw new Error('[COBOLISH] INSPECT currently requires an unsubscripted alphanumeric item');
    }
    const source = this.nextHiddenField();
    const sourceLength = this.nextHiddenField();
    this.emitReference(target);
    this.emit(`STORE ${source}`);
    this.emit(`PUSH_INT ${field.length}`);
    this.emit(`STORE ${sourceLength}`);

    const tallying = ctx.inspectTallying();
    if (tallying) {
      const counters = tallying.dataReference();
      const forItems = tallying.inspectTallyFor();
      if (counters.length !== forItems.length || forItems.some(item => item.inspectValue().length > 1)) {
        throw new Error('[COBOLISH] INSPECT TALLYING currently supports one tallying phrase per counter');
      }
      for (let index = 0; index < counters.length; index += 1) {
        const counter = counters[index];
        const tallyFor = forItems[index] || forItems[0];
        this.emitInspectTally(source, sourceLength, counter, tallyFor);
      }
    }
    const replacing = ctx.inspectReplacing();
    if (replacing) {
      const items = replacing.inspectReplaceItem();
      if (items.length > 1 || items.some(item => item.inspectValue().length !== (item.CHARACTERS() ? 1 : 2))) {
        throw new Error('[COBOLISH] INSPECT REPLACING currently supports one replacement phrase');
      }
      this.emitInspectReplace(source, sourceLength, target, items[0]);
    }
    const converting = ctx.inspectConverting();
    if (converting) {
      if (converting.inspectBeforeAfter().length) {
        throw new Error('[COBOLISH] INSPECT CONVERTING with BEFORE/AFTER INITIAL is not yet implemented');
      }
      this.emitInspectConvert(source, sourceLength, target, converting);
    }
  }

  emitInspectBounds(source, sourceLength, clauses) {
    const start = this.nextHiddenField();
    const end = this.nextHiddenField();
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${start}`);
    this.emit(`LOAD ${sourceLength}`);
    this.emit(`STORE ${end}`);
    for (const clause of clauses || []) {
      const value = clause.inspectValue();
      const delimiter = this.nextHiddenField();
      const position = this.nextHiddenField();
      this.emitInspectValue(value, null);
      this.emit(`STORE ${delimiter}`);
      this.emit(`LOAD ${source}`);
      this.emit(`LOAD ${delimiter}`);
      this.emit('CALL_EXT host.string_index 2');
      this.emit(`STORE ${position}`);
      if (clause.BEFORE()) {
        const done = this.nextLabel('INSPECT_BEFORE_DONE');
        this.emit(`LOAD ${position}`);
        this.emit('PUSH_INT 0');
        this.emit('GE');
        this.emit(`JZ ${done}`);
        this.emit(`LOAD ${position}`);
        this.emit(`STORE ${end}`);
        this.emit(`${done}:`);
      } else {
        const done = this.nextLabel('INSPECT_AFTER_DONE');
        this.emit(`LOAD ${position}`);
        this.emit('PUSH_INT 0');
        this.emit('GE');
        this.emit(`JZ ${done}`);
        this.emit(`LOAD ${position}`);
        this.emit(`LOAD ${delimiter}`);
        this.emitTextLength();
        this.emit('ADD');
        this.emit(`STORE ${start}`);
        this.emit(`${done}:`);
      }
    }
    return { start, end };
  }

  emitInspectValue(value, length) {
    if (value.literal()) this.emitLiteral(value.literal(), length);
    else this.emitReference(value.dataReference());
  }

  emitInspectTally(source, sourceLength, counter, tallyFor) {
    const bounds = this.emitInspectBounds(source, sourceLength, tallyFor.inspectBeforeAfter());
    const mode = tallyFor.CHARACTERS() ? 'CHARACTERS'
      : tallyFor.LEADING() ? 'LEADING' : 'ALL';
    const count = this.nextHiddenField();
    const position = this.nextHiddenField();
    const needle = this.nextHiddenField();
    const needleLength = this.nextHiddenField();
    const loop = this.nextLabel('INSPECT_TALLY');
    const next = this.nextLabel('INSPECT_TALLY_NEXT');
    const end = this.nextLabel('INSPECT_TALLY_END');
    this.emitReference(counter);
    this.emit(`STORE ${count}`);
    this.emit(`LOAD ${bounds.start}`);
    this.emit(`STORE ${position}`);
    if (mode !== 'CHARACTERS') {
      this.emitInspectValue(tallyFor.inspectValue(0), 1);
      this.emit(`STORE ${needle}`);
      this.emit(`LOAD ${needle}`);
      this.emitTextLength();
      this.emit(`STORE ${needleLength}`);
    }
    this.emit(`${loop}:`);
    this.emit(`LOAD ${position}`);
    this.emit(`LOAD ${bounds.end}`);
    this.emit('LT');
    this.emit(`JZ ${end}`);
    if (mode === 'CHARACTERS') {
      this.emit(`LOAD ${count}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.emit(`STORE ${count}`);
      this.emit(`JMP ${next}`);
    } else {
      this.emit(`LOAD ${source}`);
      this.emitSlice(() => this.emit(`LOAD ${position}`), () => {
        this.emit(`LOAD ${position}`);
        this.emit(`LOAD ${needleLength}`);
        this.emit('ADD');
      });
      this.emit(`LOAD ${needle}`);
      this.emit('STREQ');
      this.emit(`JZ ${mode === 'LEADING' ? end : next}`);
      this.emit(`LOAD ${count}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.emit(`STORE ${count}`);
      this.emit(`LOAD ${position}`);
      this.emit(`LOAD ${needleLength}`);
      this.emit('ADD');
      this.emit(`STORE ${position}`);
      this.emit(`JMP ${loop}`);
    }
    this.emit(`${next}:`);
    this.emit(`LOAD ${position}`);
    this.emit('PUSH_INT 1');
    this.emit('ADD');
    this.emit(`STORE ${position}`);
    this.emit(`JMP ${loop}`);
    this.emit(`${end}:`);
    this.emit(`LOAD ${count}`);
    this.storeReference(counter);
  }

  emitInspectReplace(source, sourceLength, target, item) {
    const mode = item.CHARACTERS() ? 'CHARACTERS'
      : item.LEADING() ? 'LEADING' : item.FIRST() ? 'FIRST' : 'ALL';
    const pairs = item.inspectValue();
    const needle = this.nextHiddenField();
    const replacement = this.nextHiddenField();
    const needleLength = this.nextHiddenField();
    const bounds = this.emitInspectBounds(source, sourceLength, item.inspectBeforeAfter());
    if (mode !== 'CHARACTERS') {
      this.emitInspectValue(pairs[0], 1);
      this.emit(`STORE ${needle}`);
      this.emitInspectValue(pairs[1], 1);
      this.emit(`STORE ${replacement}`);
      this.emit(`LOAD ${needle}`);
      this.emitTextLength();
      this.emit(`STORE ${needleLength}`);
    } else {
      this.emitInspectValue(pairs[0], 1);
      this.emit(`STORE ${replacement}`);
    }
    const position = this.nextHiddenField();
    const output = this.nextHiddenField();
    const replaced = this.nextHiddenField();
    const loop = this.nextLabel('INSPECT_REPLACE');
    const copyChar = this.nextLabel('INSPECT_COPY');
    const append = this.nextLabel('INSPECT_APPEND');
    const end = this.nextLabel('INSPECT_REPLACE_END');
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${position}`);
    this.emit('PUSH_STR ""');
    this.emit(`STORE ${output}`);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${replaced}`);
    this.emit(`${loop}:`);
    this.emit(`LOAD ${position}`);
    this.emit(`LOAD ${sourceLength}`);
    this.emit('LT');
    this.emit(`JZ ${end}`);
    this.emit(`LOAD ${position}`);
    this.emit(`LOAD ${bounds.start}`);
    this.emit('GE');
    this.emit(`LOAD ${position}`);
    this.emit(`LOAD ${bounds.end}`);
    this.emit('LT');
    this.emit('AND');
    if (mode === 'FIRST') {
      this.emit(`LOAD ${replaced}`);
      this.emit('PUSH_INT 0');
      this.emit('EQ');
      this.emit('AND');
    }
    this.emit(`JZ ${copyChar}`);
    if (mode === 'LEADING') {
      this.emit(`LOAD ${replaced}`);
      this.emit('PUSH_INT 0');
      this.emit('EQ');
      this.emit(`JZ ${copyChar}`);
    }
    if (mode !== 'CHARACTERS') {
      this.emit(`LOAD ${source}`);
      this.emitSlice(() => this.emit(`LOAD ${position}`), () => {
        this.emit(`LOAD ${position}`);
        this.emit(`LOAD ${needleLength}`);
        this.emit('ADD');
      });
      this.emit(`LOAD ${needle}`);
      this.emit('STREQ');
      this.emit(`JZ ${copyChar}`);
    }
    this.emit(`${append}:`);
    if (mode === 'CHARACTERS') {
      this.emit(`LOAD ${output}`);
      this.emit(`LOAD ${replacement}`);
      this.emit('CONCAT');
      this.emit(`STORE ${output}`);
      this.emit(`LOAD ${position}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
      this.emit(`STORE ${position}`);
    } else {
      this.emit(`LOAD ${output}`);
      this.emit(`LOAD ${replacement}`);
      this.emit('CONCAT');
      this.emit(`STORE ${output}`);
      if (mode === 'FIRST') {
        this.emit('PUSH_INT 1');
        this.emit(`STORE ${replaced}`);
      }
      this.emit(`LOAD ${position}`);
      this.emit(`LOAD ${needleLength}`);
      this.emit('ADD');
      this.emit(`STORE ${position}`);
    }
    this.emit(`JMP ${loop}`);
    this.emit(`${copyChar}:`);
    if (mode === 'LEADING') {
      this.emit('PUSH_INT 1');
      this.emit(`STORE ${replaced}`);
    }
    this.emit(`LOAD ${output}`);
    this.emit(`LOAD ${source}`);
    this.emitSlice(() => this.emit(`LOAD ${position}`), () => {
      this.emit(`LOAD ${position}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
    });
    this.emit('CONCAT');
    this.emit(`STORE ${output}`);
    this.emit(`LOAD ${position}`);
    this.emit('PUSH_INT 1');
    this.emit('ADD');
    this.emit(`STORE ${position}`);
    this.emit(`JMP ${loop}`);
    this.emit(`${end}:`);
    this.emit(`LOAD ${output}`);
    this.storeReference(target);
  }

  emitInspectConvert(source, sourceLength, target, converting) {
    const from = this.nextHiddenField();
    const to = this.nextHiddenField();
    const position = this.nextHiddenField();
    const output = this.nextHiddenField();
    const char = this.nextHiddenField();
    const mapIndex = this.nextHiddenField();
    const loop = this.nextLabel('INSPECT_CONVERT');
    const next = this.nextLabel('INSPECT_CONVERT_NEXT');
    const appendOriginal = this.nextLabel('INSPECT_CONVERT_ORIGINAL');
    const end = this.nextLabel('INSPECT_CONVERT_END');
    this.emitInspectValue(converting.inspectValue(0), 1);
    this.emit(`STORE ${from}`);
    this.emitInspectValue(converting.inspectValue(1), 1);
    this.emit(`STORE ${to}`);
    this.emit('PUSH_INT 0');
    this.emit(`STORE ${position}`);
    this.emit('PUSH_STR ""');
    this.emit(`STORE ${output}`);
    this.emit(`${loop}:`);
    this.emit(`LOAD ${position}`);
    this.emit(`LOAD ${sourceLength}`);
    this.emit('LT');
    this.emit(`JZ ${end}`);
    this.emit(`LOAD ${source}`);
    this.emitSlice(() => this.emit(`LOAD ${position}`), () => {
      this.emit(`LOAD ${position}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
    });
    this.emit(`STORE ${char}`);
    this.emit(`LOAD ${from}`);
    this.emit(`LOAD ${char}`);
    this.emit('CALL_EXT host.string_index 2');
    this.emit(`STORE ${mapIndex}`);
    this.emit(`LOAD ${mapIndex}`);
    this.emit('PUSH_INT 0');
    this.emit('GE');
    this.emit(`JZ ${appendOriginal}`);
    this.emit(`LOAD ${output}`);
    this.emit(`LOAD ${to}`);
    this.emitSlice(() => this.emit(`LOAD ${mapIndex}`), () => {
      this.emit(`LOAD ${mapIndex}`);
      this.emit('PUSH_INT 1');
      this.emit('ADD');
    });
    this.emit('CONCAT');
    this.emit(`STORE ${output}`);
    this.emit(`JMP ${next}`);
    this.emit(`${appendOriginal}:`);
    this.emit(`LOAD ${output}`);
    this.emit(`LOAD ${char}`);
    this.emit('CONCAT');
    this.emit(`STORE ${output}`);
    this.emit(`${next}:`);
    this.emit(`LOAD ${position}`);
    this.emit('PUSH_INT 1');
    this.emit('ADD');
    this.emit(`STORE ${position}`);
    this.emit(`JMP ${loop}`);
    this.emit(`${end}:`);
    this.emit(`LOAD ${output}`);
    this.storeReference(target);
  }

  build(tree) {
    this.collectPrograms(tree);
    this.collectSpecialNames(tree);
    this.collectDataItems(tree);
    this.collectFileMetadata(tree);
    this.collectDeclaratives(tree);
    const symbols = this.collectSystemMetadata(tree);

    const paragraphs = [];
    const topLevel = [];
    for (const program of this.programs) {
      this.currentProgram = program;
      const division = program.procedureDivision;
      topLevel.push({ node: division, program });
      const walk = node => {
        if (!node) return;
        const kind = node.constructor?.name;
        if (kind === 'DeclarativesContext') return;
        if (kind === 'ParagraphContext') {
          const sourceName = storageName(text(node.paragraphName()));
          if (this.declarativeParagraphs.has(sourceName)) return;
          const name = `${program.prefix}${sourceName}`;
          program.procedureNames.set(sourceName, name);
          program.paragraphs.push(name);
          paragraphs.push({ node, program, name });
          return;
        }
        if (kind === 'ProcedureSectionContext') {
          const sourceName = storageName(text(node.IDENTIFIER()));
          const name = `${program.prefix}${sourceName}`;
          if (this.declarativeSections.has(sourceName)) return;
          const segment = node.segmentNumber() ? Number(text(node.segmentNumber())) : 0;
          paragraphs.push({ node, program, name });
          program.procedureNames.set(sourceName, name);
          program.paragraphs.push(name);
          this.segments.set(name, segment);
          for (const paragraph of node.paragraph()) {
            const paragraphSourceName = storageName(text(paragraph.paragraphName()));
            const paragraphName = `${program.prefix}${paragraphSourceName}`;
            program.procedureNames.set(paragraphSourceName, paragraphName);
            program.paragraphs.push(paragraphName);
            paragraphs.push({ node: paragraph, program, name: paragraphName });
            this.segments.set(paragraphName, segment);
          }
          const last = node.paragraph().at(-1);
          this.sections.set(name, last ? `${program.prefix}${storageName(text(last.paragraphName()))}` : name);
          return;
        }
        for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) {
          const child = node.getChild(index);
          if (child.constructor?.name !== 'SentenceContext') walk(child);
        }
      };
      walk(division);
    }
    this.currentProgram = null;
    const procedureName = item => item.name
      || storageName(text(item.paragraphName ? item.paragraphName() : item.IDENTIFIER()));
    const regularParagraphs = paragraphs;
    const allParagraphs = [...regularParagraphs, ...this.declarativeProcedureNodes];
    for (const paragraph of allParagraphs) {
      const name = paragraph.name || procedureName(paragraph);
      if (this.paragraphs.has(name)) throw new Error(`[COBOLISH] Duplicate procedure name ${name}`);
      this.paragraphs.set(name, paragraph.node || paragraph);
      this.procedureDisplayNames.set(name, text((paragraph.node || paragraph).paragraphName
        ? (paragraph.node || paragraph).paragraphName() : (paragraph.node || paragraph).IDENTIFIER()));
      this.controlFields.push(`__COBOL_PEXIT_${name}`);
    }
    for (const program of this.programs) {
      program.entryLabel = `COBOL_PROGRAM_${program.key}`;
      const using = program.procedureDivision.procedureUsingClause?.()?.procedureParameterList?.()?.procedureParameter?.() || [];
      program.linkageNames = using.map(parameter => storageName(text(parameter)));
      for (const name of program.linkageNames) {
        const key = this.resolveProgramDataName(program, name);
        if (!key || !this.fieldOf(key)?.isLinkage) {
          throw new Error(`[COBOLISH] PROCEDURE DIVISION USING for ${program.sourceId} names undeclared LINKAGE data ${name}`);
        }
        program.linkageFields.push(...this.dataStorageSlots(key).map(slot => slot.name));
      }
    }
    this.collectAlters(tree);

    this.emit('# Auto-generated from ANTLR Cobolish grammar');
    this.emit('JMP MAIN');

    // Procedures are laid out in source order so control falls through and GO TO is a jump;
    // PERFORM CALLs the first procedure and RETs at the armed end of its range.
    const procedures = {};
    for (const program of this.programs) {
      this.currentProgram = program;
      const programParagraphs = regularParagraphs.filter(paragraph => paragraph.program === program);
      for (const paragraph of programParagraphs) {
        const name = procedureName(paragraph);
        const label = `PARA_${name}`;
        const next = this.nextLabel('PARA_FALL');
        this.currentParagraph = name;
        this.currentSegment = this.segments.get(name) ?? 0;
        this.emit(`${label}:`);
        this.emitDebugEntry(name);
        this.emitSentences(paragraph.node);
        this.emit(`LOAD __COBOL_PEXIT_${name}`);
        this.emit(`JZ ${next}`);
        this.emit('RET');
        this.emit(`${next}:`);
        procedures[label] = { name: label, params: [], locals: [] };
      }
      if (programParagraphs.length) this.emit(program.root ? 'HALT' : 'RET');
    }
    for (const program of this.programs) {
      this.currentProgram = program;
      this.currentParagraph = null;
      this.emit(`${program.entryLabel}:`);
      this.emitSentences(program.procedureDivision);
      if (program.paragraphs.length) this.emit(`CALL PARA_${program.paragraphs[0]} 0`);
      this.emit('RET');
      procedures[program.entryLabel] = {
        name: program.entryLabel,
        params: program.linkageFields,
        locals: []
      };
    }
    this.currentProgram = null;
    if (this.declarativeProcedureNodes.length) {
      const afterDeclaratives = this.nextLabel('AFTER_DECLARATIVES');
      this.emit(`JMP ${afterDeclaratives}`);
      for (const paragraph of this.declarativeProcedureNodes) {
        const name = procedureName(paragraph);
        const label = `PARA_${name}`;
        const next = this.nextLabel('PARA_FALL');
        this.currentParagraph = name;
        this.currentSegment = this.segments.get(name) ?? 0;
        this.emit(`${label}:`);
        this.emitSentences(paragraph);
        this.emit(`LOAD __COBOL_PEXIT_${name}`);
        this.emit(`JZ ${next}`);
        this.emit('RET');
        this.emit(`${next}:`);
        procedures[label] = { name: label, params: [], locals: [] };
      }
      this.emit(`${afterDeclaratives}:`);
    }
    this.emit('HALT');
    this.currentParagraph = null;
    this.currentSegment = 0;

    this.emit('MAIN:');
    for (const name of this.controlFields) {
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${name}`);
    }
    for (const [name, field] of [...this.fields]) {
      if (field.kind === 'group' || field.redefinesBase) continue;
      const count = (field.dimensions || []).reduce((a, b) => a * b, 1);
      for (let index = 0; index < count; index += 1) {
        const initial = this.initialValues.get(name);
        if (initial) {
          if (field.kind === 'string') {
            this.emit(`PUSH_STR ${JSON.stringify(literalStringValue(initial, field.length).padEnd(field.length))}`);
          } else {
            this.emitLiteral(initial);
            this.emit(`DEC_QUANT ${field.scale}`);
          }
        } else if (field.kind === 'decimal') this.emit(`PUSH_DEC 0 ${field.scale}`);
        else this.emit(`PUSH_STR ${JSON.stringify(' '.repeat(field.length))}`);
        this.emit(`STORE ${field.dimensions?.length ? `${name}_${index}` : name}`);
      }
    }
    this.emitGroupInitialValues([...this.fields.keys()]);
    for (const file of this.files.values()) {
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${file.handleName}`);
    }
    const rootDivision = topLevel.find(item => item.program.root);
    if (rootDivision) {
      this.currentProgram = rootDivision.program;
      this.emitSentences(rootDivision.node);
    }
    const rootProgram = this.programs[0];
    this.currentProgram = rootProgram;
    if (rootProgram.paragraphs.length) this.emit(`JMP PARA_${rootProgram.paragraphs[0]}`);
    else this.emit('HALT');
    this.currentProgram = null;

    return {
      pcodeText: `${this.lines.join('\n')}\n`,
      globals: [...this.fields.keys(), ...this.controlFields],
      fields: Object.fromEntries(this.fields),
      files: Object.fromEntries(this.files),
      symbols,
      procedures,
      sourceLineByAddress: this.lines.flatMap((line, index) => {
        const instruction = line.trim();
        return instruction && !instruction.startsWith('#') && !instruction.endsWith(':')
          ? [this.sourceLines[index]]
          : [];
      })
    };
  }
}

export function compileCobolishToPcode(sourceText, options = {}) {
  const { tree, errors } = parseCobolishWithAntlr(preprocessCobolText(sourceText, { copybooks: options.copybooks }));
  if (errors.length > 0) {
    throw new Error(`[COBOLISH] Parse failed:\n${errors.join('\n')}`);
  }
  assertSupportedFeatures(tree);

  const codegen = new CobolishCodegen();
  const built = codegen.build(tree);
  const hostBindings = built.pcodeText.split(/\r?\n/)
    .filter(line => line.startsWith('CALL_EXT '))
    .map(line => ({ mnemonic: 'CALL_EXT', operand: { label: line.split(/\s+/)[1] } }));
  const runtimeMatch = String(sourceText || '').match(/\bPULSE\s+(SERVICE|DAEMON|PROGRAM)\s+("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_-]*)/i);
  const runtimeUnit = runtimeMatch
    ? { kind: runtimeMatch[1].toLowerCase(), id: unquote(runtimeMatch[2]), placement: 'local' }
    : null;

  const program = {
    pcodeText: built.pcodeText,
    programMap: {
      version: 1,
      generatedAt: new Date().toISOString(),
      sourceLanguage: 'cobolish',
      executionModel: 'cobolish-program',
      ...(runtimeUnit ? { runtimeUnit } : {}),
      ...(hostBindings.length ? {
        hostBindingsVersion: SERVICE_HOST_BINDINGS_VERSION,
        hostCapabilitiesVersion: HOST_CAPABILITIES_VERSION,
        requiredHostCapabilities: requiredHostCapabilities(hostBindings),
        targets: ['js']
      } : {}),
      globals: built.globals,
      fields: built.fields,
      files: built.files,
      symbols: built.symbols,
      procedures: built.procedures,
      sourceMap: buildPcodeSourceMap({
        pcodeText: built.pcodeText,
        sourceText,
        sourceFile: options.fileName || null,
        sourceLanguage: 'cobolish',
        sourceLineByAddress: built.sourceLineByAddress
      }),
      entryLabel: 'MAIN'
    }
  };
  const runtimeLibraries = [...codegen.runtimeLibraries].map(getCobolRuntimeLibrary);
  return linkPcodeLibraries(program, [...(options.pcodeLibraries || []), ...runtimeLibraries]);
}
