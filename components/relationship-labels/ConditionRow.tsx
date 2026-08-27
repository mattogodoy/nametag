'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { CustomFieldType } from '@prisma/client';
import {
  LABEL_SUBJECTS,
  PERSON_FIELD_KEYS,
  OPERATORS_WITHOUT_OPERAND,
  operatorsForSource,
  type LabelCondition,
  type LabelOperator,
  type LabelSource,
} from '@/lib/relationship-labels/types';
import { parseOperand, serializeOperand } from '@/lib/relationship-labels/operand';
import { PREDEFINED_DATE_TYPES } from '@/lib/important-date-types';

export interface ConditionRowGroup {
  id: string;
  name: string;
}

export interface ConditionRowCustomFieldTemplate {
  id: string;
  name: string;
  type: CustomFieldType;
  options: string[];
}

interface ConditionRowProps {
  condition: LabelCondition;
  groups: ConditionRowGroup[];
  templates: ConditionRowCustomFieldTemplate[];
  genderSuggestions: string[];
  onChange: (condition: LabelCondition) => void;
  onRemove: () => void;
}

type SegmentKey = 'prefix' | 'subject' | 'data' | 'operator' | 'operand';

const SEGMENT_KEYS: readonly SegmentKey[] = ['prefix', 'subject', 'data', 'operator', 'operand'];

/**
 * The sentence order comes from the locale, which supplies it as a
 * comma-separated list in `conditionalLabels.segmentOrder`. There is no
 * hardcoded fallback on purpose: every locale file carries the key, so a verb
 * final language can reorder the sentence by editing its own translation only.
 * An unknown or duplicated segment is dropped, and any segment the locale
 * omitted is appended in `SEGMENT_KEYS` order so no control can disappear.
 */
function readSegmentOrder(raw: string): SegmentKey[] {
  const isSegmentKey = (value: string): value is SegmentKey =>
    (SEGMENT_KEYS as readonly string[]).includes(value);

  const requested = raw
    .split(',')
    .map((part) => part.trim())
    .filter(isSegmentKey);

  const ordered = Array.from(new Set(requested));
  for (const key of SEGMENT_KEYS) {
    if (!ordered.includes(key)) ordered.push(key);
  }
  return ordered;
}

const DATA_VALUE_SEPARATOR = '::';
const SHORTCUT_IS_PAST = '__shortcut_isPast';
const SHORTCUT_IS_FUTURE = '__shortcut_isFuture';

function encodeDataValue(source: LabelSource, ref: string): string {
  return `${source}${DATA_VALUE_SEPARATOR}${ref}`;
}

function decodeDataValue(value: string): { source: LabelSource; ref: string } {
  const separatorIndex = value.indexOf(DATA_VALUE_SEPARATOR);
  return {
    source: value.slice(0, separatorIndex) as LabelSource,
    ref: value.slice(separatorIndex + DATA_VALUE_SEPARATOR.length),
  };
}

type ValueKind = 'select' | 'boolean' | 'number' | 'date' | 'gender' | 'text';

export default function ConditionRow({
  condition,
  groups,
  templates,
  genderSuggestions,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const t = useTranslations('relationshipTypes.form.conditionalLabels');
  const tDateTypes = useTranslations('people.form.importantDates');
  const reactId = useId();

  const operand = parseOperand(condition.operand);
  const operandMode = operand?.kind ?? 'literal';
  const isDateSource = condition.source === 'DATE_TYPE' || condition.source === 'DATE_TITLE';
  const needsOperand = !OPERATORS_WITHOUT_OPERAND.has(condition.operator);

  const activeTemplate =
    condition.source === 'CUSTOM_FIELD'
      ? templates.find((template) => template.id === condition.subjectRef) ?? null
      : null;

  function determineValueKind(): ValueKind {
    if (condition.source === 'CUSTOM_FIELD') {
      switch (activeTemplate?.type) {
        case 'SELECT':
          return 'select';
        case 'BOOLEAN':
          return 'boolean';
        case 'NUMBER':
          return 'number';
        default:
          return 'text';
      }
    }
    if (isDateSource) return 'date';
    if (condition.source === 'PERSON_FIELD' && condition.subjectRef === 'gender') return 'gender';
    return 'text';
  }

  function handleSubjectChange(subject: LabelCondition['subject']) {
    onChange({ ...condition, subject });
  }

  function handleDataChange(value: string) {
    const { source, ref } = decodeDataValue(value);
    const operators = operatorsForSource(source);
    onChange({
      ...condition,
      source,
      subjectRef: ref,
      operator: operators[0],
      operand: null,
    });
  }

  function handleDateTitleRefChange(ref: string) {
    onChange({ ...condition, subjectRef: ref });
  }

  function handleOperatorChange(value: string) {
    if (value === SHORTCUT_IS_PAST) {
      onChange({ ...condition, operator: 'BEFORE', operand: serializeOperand({ kind: 'now' }) });
      return;
    }
    if (value === SHORTCUT_IS_FUTURE) {
      onChange({ ...condition, operator: 'AFTER', operand: serializeOperand({ kind: 'now' }) });
      return;
    }
    const operator = value as LabelOperator;
    const nextOperand = OPERATORS_WITHOUT_OPERAND.has(operator) ? null : condition.operand;
    onChange({ ...condition, operator, operand: nextOperand });
  }

  function handleModeChange(mode: 'literal' | 'now' | 'ref') {
    if (mode === 'now') {
      onChange({ ...condition, operand: serializeOperand({ kind: 'now' }) });
      return;
    }
    if (mode === 'ref') {
      onChange({ ...condition, operand: serializeOperand({ kind: 'ref', ref: condition.subjectRef }) });
      return;
    }
    onChange({ ...condition, operand: serializeOperand({ kind: 'literal', value: '' }) });
  }

  function handleLiteralChange(value: string) {
    onChange({ ...condition, operand: serializeOperand({ kind: 'literal', value }) });
  }

  const controlClass =
    'px-2 py-1 text-sm border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed';

  function renderSegment(key: SegmentKey): React.ReactNode {
    switch (key) {
      case 'prefix':
        return (
          <span key={key} className="text-sm text-muted">
            {t('conditionPrefix')}
          </span>
        );

      case 'subject':
        return (
          <select
            key={key}
            aria-label={t('subject.DESCRIBED')}
            value={condition.subject}
            onChange={(e) => handleSubjectChange(e.target.value as LabelCondition['subject'])}
            className={controlClass}
          >
            {LABEL_SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {t(`subject.${subject}`)}
              </option>
            ))}
          </select>
        );

      case 'data':
        return (
          <span key={key} className="inline-flex items-center gap-2">
            <select
              aria-label={t('sourceGroups.PERSON_FIELD')}
              value={encodeDataValue(
                condition.source,
                condition.source === 'DATE_TITLE' ? '' : condition.subjectRef
              )}
              onChange={(e) => handleDataChange(e.target.value)}
              className={controlClass}
            >
              <optgroup label={t('sourceGroups.PERSON_FIELD')}>
                {PERSON_FIELD_KEYS.map((field) => (
                  <option key={field} value={encodeDataValue('PERSON_FIELD', field)}>
                    {t(`fields.${field}`)}
                  </option>
                ))}
              </optgroup>
              {templates.length > 0 && (
                <optgroup label={t('sourceGroups.CUSTOM_FIELD')}>
                  {templates.map((template) => (
                    <option key={template.id} value={encodeDataValue('CUSTOM_FIELD', template.id)}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {groups.length > 0 && (
                <optgroup label={t('sourceGroups.GROUP')}>
                  {groups.map((group) => (
                    <option key={group.id} value={encodeDataValue('GROUP', group.id)}>
                      {group.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t('sourceGroups.DATE_TYPE')}>
                {PREDEFINED_DATE_TYPES.map((type) => (
                  <option key={type} value={encodeDataValue('DATE_TYPE', type)}>
                    {tDateTypes(`types.${type}`)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t('sourceGroups.DATE_TITLE')}>
                <option value={encodeDataValue('DATE_TITLE', '')}>
                  {t('sourceGroups.DATE_TITLE')}
                </option>
              </optgroup>
            </select>
            {condition.source === 'DATE_TITLE' && (
              <input
                type="text"
                aria-label={t('sourceGroups.DATE_TITLE')}
                placeholder={t('sourceGroups.DATE_TITLE')}
                value={condition.subjectRef}
                onChange={(e) => handleDateTitleRefChange(e.target.value)}
                className={controlClass}
              />
            )}
          </span>
        );

      case 'operator': {
        const operators = operatorsForSource(condition.source);
        return (
          <select
            key={key}
            aria-label={t('conditionPrefix')}
            value={condition.operator}
            onChange={(e) => handleOperatorChange(e.target.value)}
            className={controlClass}
          >
            {operators.map((operator) => (
              <option key={operator} value={operator}>
                {t(`operators.${operator}`)}
              </option>
            ))}
            {isDateSource && (
              <>
                <option value={SHORTCUT_IS_PAST}>{t('shortcuts.isPast')}</option>
                <option value={SHORTCUT_IS_FUTURE}>{t('shortcuts.isFuture')}</option>
              </>
            )}
          </select>
        );
      }

      case 'operand': {
        if (!needsOperand) return <span key={key} aria-hidden="true" />;

        const valueKind = determineValueKind();
        const modes: Array<'literal' | 'now' | 'ref'> = isDateSource
          ? ['literal', 'now', 'ref']
          : ['literal', 'ref'];
        const datalistId = `${reactId}-gender-suggestions`;

        return (
          <span key={key} className="inline-flex items-center gap-2">
            <select
              aria-label={t('operandKind.literal')}
              value={operandMode}
              onChange={(e) => handleModeChange(e.target.value as 'literal' | 'now' | 'ref')}
              className={controlClass}
            >
              {modes.map((mode) => (
                <option key={mode} value={mode}>
                  {t(`operandKind.${mode}`)}
                </option>
              ))}
            </select>
            {operandMode === 'literal' && (
              <>
                {valueKind === 'select' && (
                  <select
                    aria-label={t('operandKind.literal')}
                    value={operand?.kind === 'literal' ? operand.value : ''}
                    onChange={(e) => handleLiteralChange(e.target.value)}
                    className={controlClass}
                  >
                    <option value="" />
                    {(activeTemplate?.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                {valueKind === 'boolean' && (
                  <input
                    type="checkbox"
                    aria-label={t('operandKind.literal')}
                    checked={operand?.kind === 'literal' && operand.value === 'true'}
                    onChange={(e) => handleLiteralChange(e.target.checked ? 'true' : 'false')}
                    className="h-4 w-4 text-primary border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
                {valueKind === 'number' && (
                  <input
                    type="number"
                    aria-label={t('operandKind.literal')}
                    value={operand?.kind === 'literal' ? operand.value : ''}
                    onChange={(e) => handleLiteralChange(e.target.value)}
                    className={controlClass}
                  />
                )}
                {valueKind === 'date' && (
                  <input
                    type="date"
                    aria-label={t('operandKind.literal')}
                    value={operand?.kind === 'literal' ? operand.value : ''}
                    onChange={(e) => handleLiteralChange(e.target.value)}
                    className={controlClass}
                  />
                )}
                {valueKind === 'gender' && (
                  <>
                    <input
                      type="text"
                      list={datalistId}
                      aria-label={t('operandKind.literal')}
                      value={operand?.kind === 'literal' ? operand.value : ''}
                      onChange={(e) => handleLiteralChange(e.target.value)}
                      className={controlClass}
                    />
                    <datalist id={datalistId}>
                      {genderSuggestions.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                  </>
                )}
                {valueKind === 'text' && (
                  <input
                    type="text"
                    aria-label={t('operandKind.literal')}
                    value={operand?.kind === 'literal' ? operand.value : ''}
                    onChange={(e) => handleLiteralChange(e.target.value)}
                    className={controlClass}
                  />
                )}
              </>
            )}
          </span>
        );
      }

      default:
        return null;
    }
  }

  const segments = readSegmentOrder(t('segmentOrder'));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {segments.map((key) => renderSegment(key))}
      <button
        type="button"
        onClick={onRemove}
        title={t('removeCondition')}
        aria-label={t('removeCondition')}
        className="ml-1 px-2 py-1 text-sm text-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}
