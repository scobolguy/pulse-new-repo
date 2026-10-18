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
    this.rawGroupStates = new Map();
    this.odoDependentGroups = new Map();
    this.paragraphs = new Map();
    this.sections = new Map();
    this.sizeErrorDepth = 0;
    this.files = new Map();
    this.filesByRecord = new Map();
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
    this.whenCompiled = cobolDateTime(new Date());
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
  }

  fieldOffsetWithin(recordName, fieldName) {
    if (recordName === fieldName) return 0;
    let offset = 0;
    let child = fieldName;
    while (child !== recordName) {
      const parent = this.dataParents.get(child);
      const parentField = parent && this.fieldOf(parent);
      if (!parentField || parentField.kind !== 'group') {
        throw new Error(`[COBOLISH] Alternate key ${fieldName} is not contained in record ${recordName}`);
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
    const walk = node => {
      if (!node) return;
      if (node.constructor?.name === 'DataDescriptionEntryContext') entries.push(node);
      for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) walk(node.getChild(index));
    };
    walk(tree);

    const parents = [];
    for (const entry of entries) {
      const name = storageName(entry.IDENTIFIER()?.getText());
      if (!name) continue;
      const level = Number(text(entry.fileLevelNumber()));
      if (level === 66) throw new Error(`[COBOLISH] Level-66 RENAMES entry ${name} is recognized but not yet implemented`);
      if (level === 88) {
        this.collectConditionName(name, entry, parents.at(-1));
        continue;
      }
      while (parents.length && parents.at(-1).level >= level) parents.pop();
      if (level === 77) parents.length = 0;
      let picture = null;
      let occurs = null;
      let dependingOn = null;
      let redefinesName = null;
      let justified = false;
      let indexUsage = false;
      let initial = null;
      let sortKeys = null;
      let sortDescending = false;
      for (const clause of entry.dataClause() || []) {
        const pictureCtx = clause.pictureClause && clause.pictureClause();
        if (pictureCtx) {
          const symbols = text(pictureCtx).toUpperCase().replace(/\s+/g, '').replace(/^(?:PICTURE|PIC)(?:IS)?/, '').replace(/\(\d+\)/g, '');
          if (/[^SVXAZP9]/.test(symbols)) {
            throw new Error(`[COBOLISH] Edited PICTURE ${symbols} for ${name} is recognized but not yet implemented`);
          }
          picture = parsePicture(text(pictureCtx));
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
      }
      const parent = parents.at(-1);
      const path = [name, ...(parent?.path || [])];
      let key = name;
      if (this.fields.has(key)) {
        const prefix = parent?.name || 'DATA';
        key = `${prefix}_${name}`;
        let suffix = 2;
        while (this.fields.has(key)) key = `${prefix}_${name}_${suffix++}`;
      }
      const dimensions = [...(parent?.dimensions || []), ...(occurs === null ? [] : [occurs])];
      const field = {
        ...(picture || (indexUsage
          ? { kind: 'decimal', signed: false, precision: 10, scale: 0 }
          : { kind: 'group', length: 0 })),
        children: [], dimensions, dependingOn, redefinesName, indexNames: [],
        sortKeys, sortDescending,
        justified, sourceName: name, path
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
      this.fields.set(key, field);
      const sameNameKeys = this.dataNameKeys.get(name) || [];
      sameNameKeys.push(key);
      this.dataNameKeys.set(name, sameNameKeys);
      if (initial) this.initialValues.set(key, initial);
      for (const clause of entry.dataClause() || []) {
        if (clause.INDEXED?.()) {
          for (const index of clause.identifierList().IDENTIFIER()) {
            const indexName = storageName(index.getText());
            if (this.fields.has(indexName)) throw new Error(`[COBOLISH] Duplicate index-name ${indexName}`);
            this.fields.set(indexName, { kind: 'decimal', signed: false, precision: 10, scale: 0, dimensions: [] });
            field.indexNames.push(indexName);
          }
        }
      }
      if (parent) {
        this.fields.get(parent.name).children.push(key);
        this.dataParents.set(key, parent.name);
      }
      parents.push({ name: key, level, dimensions, path });
    }
    for (const [name, field] of [...this.fields].reverse()) {
      if (field.kind === 'group') {
        field.length = field.children.reduce((length, child) => {
          const item = this.fieldOf(child);
          const repetitions = item.dimensions.slice(field.dimensions.length).reduce((a, b) => a * b, 1);
          return length + this.fieldLength(item) * repetitions;
        }, 0);
        if (this.initialValues.has(name)) {
          throw new Error(`[COBOLISH] Group VALUE initialization is not yet implemented: ${name}`);
        }
      }
    }
    for (const [name, field] of this.fields) {
      if (!field.dependingOn) continue;
      const controllers = this.dataNameKeys.get(field.dependingOn) || [];
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
      const bases = this.dataNameKeys.get(field.redefinesName) || [];
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
    return field.kind === 'decimal' ? field.precision : field.length;
  }

  // A level-88 entry names values of the item it follows (manual ch. 7, condition-name entry).
  collectConditionName(name, entry, parent) {
    if (!parent) throw new Error(`[COBOLISH] Level-88 condition-name ${name} has no conditional variable`);
    if (this.fields.has(name) || this.conditions.has(name)) throw new Error(`[COBOLISH] Duplicate data name ${name}`);
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
    this.conditions.set(name, { parent: parent.name, values });
  }

  conditionNameReference(expression) {
    const terms = expression.term();
    if (terms.length !== 1 || terms[0].factor().length !== 1) return null;
    const reference = terms[0].factor(0).dataReference?.();
    if (!reference || reference.COLON?.()) return null;
    const condition = this.conditions.get(storageName(reference.IDENTIFIER().getText()));
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
    if (!field) throw new Error(`[COBOLISH] Undeclared data item ${name}`);
    if (field.redefinesBase) {
      if (reference.COLON?.()) {
        throw new Error('[COBOLISH] Reference modification on a redefined item is not yet implemented');
      }
      return this.emitRedefinedValue(reference, name, field);
    }
    if (reference.COLON?.()) {
      if (field.kind !== 'string') throw new Error('[COBOLISH] Reference modification currently requires an alphanumeric item');
      this.emit(`LOAD ${name}`);
      const start = this.nextHiddenField();
      this.emitExpression(reference.expression(0));
      this.emit('PUSH_INT 1');
      this.emit('SUB');
      this.emit(`STORE ${start}`);
      this.emitSlice(() => this.emit(`LOAD ${start}`), () => {
        if (reference.expression(1)) {
          this.emit(`LOAD ${start}`);
          this.emitExpression(reference.expression(1));
          this.emit('ADD');
        } else this.emit(`PUSH_INT ${field.length}`);
      });
    } else if (reference.expression().length) {
      this.emitIndex(reference);
      this.emit(`ARR_GET ${name} ${field.dimensions.reduce((a, b) => a * b, 1)}`);
    } else this.emitNamedReference(name);
  }

  emitRedefinedValue(reference, name, field) {
    const subscripts = reference?.expression?.() || [];
    if (subscripts.length !== field.dimensions.length) {
      throw new Error(`[COBOLISH] ${name} requires ${field.dimensions.length} subscripts`);
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
    this.emit(`LOAD ${field.redefinesBase}`);
    this.emitSlice(() => this.emit(`LOAD ${offset}`), () => {
      this.emit(`LOAD ${offset}`);
      this.emit(`PUSH_INT ${this.fieldLength(field)}`);
      this.emit('ADD');
    });
    if (field.kind === 'decimal') {
      this.runtimeLibraries.add('math');
      this.emit('CALL PROC_COBOL_RT_NUMVAL 1');
    }
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
            this.emit(`DEC_DISPLAY ${item.precision} ${item.scale}`);
            if (item.signed || item.scale) {
              throw new Error('[COBOLISH] Group MOVE requires unsigned integral display items');
            }
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
    if (field.redefinesBase) throw new Error(`[COBOLISH] Writing redefined item ${name} is not yet implemented`);
    if (reference.COLON?.()) {
      if (field.kind !== 'string') throw new Error('[COBOLISH] Reference modification currently requires an alphanumeric item');
      const value = this.nextHiddenField();
      const start = this.nextHiddenField();
      const end = this.nextHiddenField();
      this.emit(`STORE ${value}`);
      this.emitExpression(reference.expression(0));
      this.emit('PUSH_INT 1');
      this.emit('SUB');
      this.emit(`STORE ${start}`);
      if (reference.expression(1)) {
        this.emit(`LOAD ${start}`);
        this.emitExpression(reference.expression(1));
        this.emit('ADD');
      } else this.emit(`PUSH_INT ${field.length}`);
      this.emit(`STORE ${end}`);
      this.emit(`LOAD ${name}`);
      this.emitSlice(() => this.emit('PUSH_INT 0'), () => this.emit(`LOAD ${start}`));
      this.emit(`LOAD ${value}`);
      this.emit(`PUSH_STR ${JSON.stringify(' '.repeat(field.length))}`);
      this.emit('CONCAT');
      this.emitSlice(() => this.emit('PUSH_INT 0'), () => {
        this.emit(`LOAD ${end}`);
        this.emit(`LOAD ${start}`);
        this.emit('SUB');
      });
      this.emit('CONCAT');
      this.emit(`LOAD ${name}`);
      this.emitSlice(() => this.emit(`LOAD ${end}`), () => this.emit(`PUSH_INT ${field.length}`));
      this.emit('CONCAT');
      this.emit(`STORE ${name}`);
      this.invalidateRawGroups(name);
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
    if (field.redefinesBase) throw new Error(`[COBOLISH] Writing redefined item ${name} is not yet implemented`);
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
          this.emitReceiverConversion(item, false);
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
    const walk = node => {
      if (!node) return;
      if (node.constructor?.name === 'FileControlClauseContext') selects.push(node);
      if (node.constructor?.name === 'FileDescriptionEntryContext') {
        const name = storageName(node.IDENTIFIER()?.getText());
        if (name) descriptions.set(name, node);
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
      const records = description?.dataDescriptionEntry?.() || [];
      const recordEntries = records.filter(entry => text(entry.fileLevelNumber?.()) === '01');
      const recordEntry = recordEntries[0] || records[0] || null;
      const recordName = storageName(recordEntry?.IDENTIFIER()?.getText());
      const indexedKeyName = storageName(recordKey?.IDENTIFIER?.()?.getText());
      const relativeKeyName = storageName(relativeKey?.IDENTIFIER?.()?.getText());
      const statusName = storageName(fileStatus?.IDENTIFIER?.()?.getText());
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
          const alternateName = storageName(alternate.IDENTIFIER().getText());
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
        recordNames: recordEntries.map(entry => storageName(entry.IDENTIFIER()?.getText())),
        recordVarying: recordVaryingClause ? {
          minimum: varyingSizes[0] ? Number(text(varyingSizes[0])) : null,
          maximum: varyingSizes.at(-1) ? Number(text(varyingSizes.at(-1))) : null,
          dependingOn: storageName(recordVaryingClause.IDENTIFIER()?.getText())
        } : null,
        linage,
        alternateKeys,
        statusName,
        recordName,
        handleName: `__ISAM_HANDLE_${name}`,
        currentKeyName: `__FILE_CURRENT_KEY_${name}`,
        sequenceCounterName: `__FILE_SEQUENCE_${name}`,
        linageCounterName: linage ? `__FILE_LINAGE_COUNTER_${name}` : null
      };
      this.files.set(name, file);
      for (const record of file.recordNames) this.filesByRecord.set(record, file);
      this.fields.set(file.handleName, { kind: 'decimal', precision: 10, scale: 0 });
      this.fields.set(file.currentKeyName, { kind: 'string', length: 256 });
      this.fields.set(file.sequenceCounterName, { kind: 'decimal', precision: 10, scale: 0 });
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
        if (use && !/DEBUGGING/i.test(text(use))) {
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
    const exitFlag = `__COBOL_PEXIT_${target.last}`;
    const savedExitFlag = this.nextHiddenField();
    this.emit(`LOAD ${exitFlag}`);
    this.emit(`STORE ${savedExitFlag}`);
    this.emit('PUSH_INT 1');
    this.emit(`STORE ${exitFlag}`);
    this.emit(`CALL PARA_${target.first} 0`);
    this.emit(`LOAD ${savedExitFlag}`);
    this.emit(`STORE ${exitFlag}`);
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
      this.emit(`LOAD ${file.handleName}`);
      this.emit('CALL_EXT host.isam_status 1');
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
      this.emit(`PUSH_STR ""`);
      this.emit(`STORE ${file.currentKeyName}`);
      if (file.linage) {
        this.emit('PUSH_INT 1');
        this.emit(`STORE ${file.linageCounterName}`);
        this.emit('PUSH_INT 1');
        this.emit('STORE LINAGE_COUNTER');
      }
      if (file.organization === 'SEQUENTIAL'
        || (file.organization === 'RELATIVE' && file.access === 'SEQUENTIAL')) {
        if (mode === 'EXTEND' || mode === 'I-O') {
          this.emit(`LOAD ${file.handleName}`);
          this.emit('CALL_EXT host.isam_count 1');
          this.emit(`STORE ${file.sequenceCounterName}`);
        }
      }
      this.emit(`${openEndLabel}:`);
    }
  }

  emitClose(ctx) {
    for (const item of ctx.closeFileItem() || []) {
      if (item.REEL() || item.UNIT()) throw new Error('[COBOLISH] CLOSE REEL/UNIT is recognized but not yet implemented');
      const file = this.fileOf(item.IDENTIFIER().getText());
      this.emit(`LOAD ${file.handleName}`);
      this.emit(`CALL_EXT host.isam_close${item.LOCK() ? '_lock' : ''} 1`);
      const statusName = file.statusName || this.nextHiddenStringField(2);
      this.emit('DEC_DISPLAY 2 0');
      this.emit(`STORE ${statusName}`);
      this.emitFileDeclarativeHandler(file, statusName);
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${file.handleName}`);
      this.emit('PUSH_STR ""');
      this.emit(`STORE ${file.currentKeyName}`);
    }
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

  emitRead(ctx) {
    const file = this.fileOf(ctx.IDENTIFIER()?.getText());
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
    const recordName = storageName(ids[0]?.getText());
    const file = this.filesByRecord.get(recordName);
    if (!file) throw new Error(`[COBOLISH] ${rewrite ? 'REWRITE' : 'WRITE'} ${recordName} is not a declared file record`);
    const clauses = (rewrite ? [] : ctx.writeClause?.() || []);
    const fromClause = clauses.find(clause => clause.FROM?.());
    const rewriteSource = rewrite && ctx.FROM?.() ? ids[1]?.getText() : null;
    const recordSource = storageName(fromClause?.IDENTIFIER?.()?.getText() || rewriteSource || recordName);
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

  emitStart(ctx) {
    const file = this.fileOf(ctx.IDENTIFIER()?.getText());
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
    if (ctx.IDENTIFIER?.()) {
      throw new Error(`[COBOLISH] User-defined class ${text(ctx.IDENTIFIER())} requires SPECIAL-NAMES`);
    }
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
      const allowed = {
        NUMERIC: '0123456789',
        ALPHABETIC: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
        ALPHABETIC_UPPER: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
        ALPHABETIC_LOWER: 'abcdefghijklmnopqrstuvwxyz '
      }[kind];
      if (!allowed) throw new Error(`[COBOLISH] Unsupported class condition ${kind}`);
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

  emitReceiverConversion(field, rounded) {
    if (field.kind === 'decimal') {
      this.emit(`DEC_QUANT ${field.scale}${rounded ? ' ROUNDED' : ''}`);
      const value = this.nextHiddenField();
      const quotient = this.nextHiddenField();
      this.emit(`STORE ${value}`);
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
    if (ctx.copyStatement && ctx.copyStatement()) {
      throw new Error('[COBOLISH] COPY requires copybook expansion before compilation');
    }
    if (ctx.execStatement && ctx.execStatement()) {
      throw new Error('[COBOLISH] EXEC blocks require a configured preprocessor');
    }
    if (ctx.exitStatement?.()) {
      if (ctx.exitStatement().PROGRAM()) throw new Error('[COBOLISH] EXIT PROGRAM is recognized but not yet implemented');
      return undefined;
    }
    // Pulse interop declarations are resolved from metadata, not emitted inline.
    if (ctx.interopStatement?.() || ctx.sendServiceStatement?.()) return undefined;
    throw new Error(`[COBOLISH] Statement ${text(ctx).slice(0, 40)} is recognized but not yet implemented`);
  }

  procedureLabel(name) {
    if (!this.paragraphs.has(name)) throw new Error(`[COBOLISH] Undefined procedure name ${name}`);
    return `PARA_${name}`;
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

  emitJumpTo(name) {
    const label = this.procedureLabel(name);
    this.emitSegmentEntry(name);
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
        const condition = this.conditions.get(storageName(target.IDENTIFIER().getText()));
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
    const target = text(ctx.callTarget()).replace(/^['"]|['"]$/g, '').toUpperCase();
    const parameters = (ctx.callUsingClause()?.callUsingItem() || []).map(item => item.callParameter());
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
      this.emit(`CALL ${storageName(target)} 0`);
      return;
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
    const value = this.nextHiddenField();
    if (source.intrinsicFunction?.()) this.emitIntrinsicFunction(source.intrinsicFunction());
    else if (source.literal?.()) this.emitLiteral(source.literal());
    else this.emitReference(source.dataReference());
    this.emit(`STORE ${value}`);
    for (const target of ctx.receivingList().dataReference()) {
      const name = this.resolveDataName(target);
      const field = this.fieldOf(name);
      const constant = source.literal?.() && field?.kind === 'string'
        ? literalStringValue(source.literal(), field.length) : null;
      if (constant !== null && !target.expression().length) {
        const aligned = field.justified
          ? constant.padStart(field.length).slice(-field.length)
          : constant.padEnd(field.length).slice(0, field.length);
        this.emit(`PUSH_STR ${JSON.stringify(aligned)}`);
        this.emit(`STORE ${name}`);
      } else {
        this.emit(`LOAD ${value}`);
        if (field?.kind === 'string' && sourceField?.kind === 'decimal' && !sourceReference.COLON?.()) {
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
      if (target.expression().length || target.COLON?.()) {
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
      this.emitExpression(expressions[0]);
      this.emitExpression(expressions[1]);
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
    this.emitEvaluateSubject(subject);
    if (ctx.literal()) this.emitLiteral(ctx.literal());
    else if (ctx.booleanLiteral()) this.emit(`PUSH_INT ${/^TRUE$/i.test(text(ctx.booleanLiteral())) ? 1 : 0}`);
    else if (ctx.IDENTIFIER()) this.emit(`LOAD ${storageName(ctx.IDENTIFIER().getText())}`);
    else this.emitExpression(range.expression(0));
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
    const variable = varying ? storageName(varying.IDENTIFIER().getText()) : null;
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
    const names = [...this.paragraphs.keys()];
    const first = storageName(text(ctx.performTarget()));
    const range = (ctx.performClause() || []).find(clause => clause.THRU() || clause.THROUGH());
    const endTarget = range ? storageName(text(range.paragraphName())) : first;
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
        if (field.kind === 'decimal' && !reference.COLON?.()) {
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
    if (!field || field.kind !== 'string' || target.expression().length || target.COLON?.()) {
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
    this.collectDataItems(tree);
    this.collectFileMetadata(tree);
    this.collectDeclaratives(tree);
    const symbols = this.collectSystemMetadata(tree);

    const paragraphs = [];
    const topLevel = [];
    const walk = node => {
      if (!node) return;
      const kind = node.constructor?.name;
      if (kind === 'DeclarativesContext') return;
      if (kind === 'ParagraphContext') {
        if (this.declarativeParagraphs.has(storageName(text(node.paragraphName())))) return;
        paragraphs.push(node);
        return;
      }
      if (kind === 'ProcedureSectionContext') {
        const name = storageName(text(node.IDENTIFIER()));
        if (this.declarativeSections.has(name)) return;
        const segment = node.segmentNumber() ? Number(text(node.segmentNumber())) : 0;
        paragraphs.push(node);
        this.segments.set(name, segment);
        for (const paragraph of node.paragraph()) {
          paragraphs.push(paragraph);
          this.segments.set(storageName(text(paragraph.paragraphName())), segment);
        }
        const last = node.paragraph().at(-1);
        this.sections.set(name, last ? storageName(text(last.paragraphName())) : name);
        return;
      }
      if (kind === 'ProcedureDivisionContext') {
        topLevel.push(node);
        for (let index = 0; index < node.getChildCount(); index += 1) {
          const child = node.getChild(index);
          if (child.constructor?.name !== 'SentenceContext') walk(child);
        }
        return;
      }
      for (let index = 0; index < (node.getChildCount?.() || 0); index += 1) walk(node.getChild(index));
    };
    walk(tree);
    const procedureName = node => storageName(text(node.paragraphName ? node.paragraphName() : node.IDENTIFIER()));
    const regularParagraphs = paragraphs;
    const allParagraphs = [...regularParagraphs, ...this.declarativeProcedureNodes];
    for (const paragraph of allParagraphs) {
      const name = procedureName(paragraph);
      if (this.paragraphs.has(name)) throw new Error(`[COBOLISH] Duplicate procedure name ${name}`);
      this.paragraphs.set(name, paragraph);
      this.controlFields.push(`__COBOL_PEXIT_${name}`);
    }
    this.collectAlters(tree);

    this.emit('# Auto-generated from ANTLR Cobolish grammar');
    this.emit('JMP MAIN');

    // Procedures are laid out in source order so control falls through and GO TO is a jump;
    // PERFORM CALLs the first procedure and RETs at the armed end of its range.
    const procedures = {};
    for (const paragraph of regularParagraphs) {
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
      if (field.kind === 'group') continue;
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
    for (const file of this.files.values()) {
      this.emit('PUSH_INT 0');
      this.emit(`STORE ${file.handleName}`);
    }
    for (const division of topLevel) this.emitSentences(division);
    if (regularParagraphs.length) this.emit(`JMP PARA_${procedureName(regularParagraphs[0])}`);
    else this.emit('HALT');

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
