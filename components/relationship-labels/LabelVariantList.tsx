'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import LabelVariantRow, {
  type ConditionRowCustomFieldTemplate,
  type ConditionRowGroup,
} from './LabelVariantRow';
import type { LabelCondition, LabelVariant } from '@/lib/relationship-labels/types';
import { findLabelWarnings } from '@/lib/relationship-labels/warnings';
import { serializeOperand } from '@/lib/relationship-labels/operand';

export interface LabelVariantListProps {
  variants: LabelVariant[];
  /** The relationship type's own label, used as the fallback row's placeholder. */
  typeLabel: string;
  groups: ConditionRowGroup[];
  templates: ConditionRowCustomFieldTemplate[];
  onChange: (variants: LabelVariant[]) => void;
}

function defaultCondition(): LabelCondition {
  return {
    subject: 'DESCRIBED',
    source: 'PERSON_FIELD',
    subjectRef: 'nickname',
    operator: 'IS',
    operand: serializeOperand({ kind: 'literal', value: '' }),
  };
}

/** A variant with no conditions is the fallback, and it must be last. */
function hasExplicitFallback(variants: readonly LabelVariant[]): boolean {
  const last = variants[variants.length - 1];
  return last !== undefined && last.conditions.length === 0;
}

/**
 * LabelVariantList is a controlled component: it never mutates `variants`,
 * it only ever calls `onChange` with a new array for its parent to store.
 */
export default function LabelVariantList({
  variants,
  typeLabel,
  groups,
  templates,
  onChange,
}: LabelVariantListProps) {
  const t = useTranslations('relationshipTypes.form.conditionalLabels');
  const [generatorField, setGeneratorField] = useState('');

  const explicitFallback = hasExplicitFallback(variants);
  // The fallback row is always rendered, even when no explicit fallback
  // variant exists yet: in that state its input is empty and only shows the
  // relationship type's own label as a placeholder.
  const displayVariants: LabelVariant[] = explicitFallback
    ? variants
    : [...variants, { label: '', conditions: [] }];
  const fallbackDisplayIndex = displayVariants.length - 1;

  const warnings = findLabelWarnings(variants, {
    groupIds: groups.map((group) => group.id),
    templateIds: templates.map((template) => template.id),
  });

  function warningsFor(variantIndex: number) {
    return warnings.filter((warning) => warning.variantIndex === variantIndex);
  }

  /**
   * Applies one variant's new value at a display position. When that position
   * is beyond the real `variants` array (the synthetic fallback), the row is
   * materialized into a real, appended variant.
   */
  function replaceVariant(displayIndex: number, variant: LabelVariant) {
    if (displayIndex < variants.length) {
      const next = variants.slice();
      next[displayIndex] = variant;
      onChange(next);
      return;
    }
    onChange([...variants, variant]);
  }

  function insertBeforeFallback(toInsert: LabelVariant[]): LabelVariant[] {
    if (explicitFallback) {
      return [...variants.slice(0, -1), ...toInsert, variants[variants.length - 1]];
    }
    return [...variants, ...toInsert];
  }

  function handleLabelChange(displayIndex: number, label: string) {
    replaceVariant(displayIndex, { ...displayVariants[displayIndex], label });
  }

  function handleConditionChange(
    displayIndex: number,
    conditionIndex: number,
    condition: LabelCondition
  ) {
    const current = displayVariants[displayIndex];
    const conditions = current.conditions.slice();
    conditions[conditionIndex] = condition;
    replaceVariant(displayIndex, { ...current, conditions });
  }

  function handleConditionRemove(displayIndex: number, conditionIndex: number) {
    const current = displayVariants[displayIndex];
    replaceVariant(displayIndex, {
      ...current,
      conditions: current.conditions.filter((_, i) => i !== conditionIndex),
    });
  }

  function handleAddCondition(displayIndex: number) {
    const current = displayVariants[displayIndex];
    replaceVariant(displayIndex, {
      ...current,
      conditions: [...current.conditions, defaultCondition()],
    });
  }

  function handleRemoveVariant(displayIndex: number) {
    onChange(variants.filter((_, i) => i !== displayIndex));
  }

  function swap(indexA: number, indexB: number) {
    const next = variants.slice();
    const tmp = next[indexA];
    next[indexA] = next[indexB];
    next[indexB] = tmp;
    onChange(next);
  }

  function handleMoveUp(displayIndex: number) {
    if (displayIndex <= 0 || displayIndex >= variants.length) return;
    swap(displayIndex - 1, displayIndex);
  }

  function handleMoveDown(displayIndex: number) {
    // Mirrors canMoveDown's own boundary: the last real (non-fallback) variant
    // must never be swapped down into or past the fallback's position.
    const lastRealIndex = explicitFallback ? variants.length - 2 : variants.length - 1;
    if (displayIndex < 0 || displayIndex >= lastRealIndex) return;
    swap(displayIndex, displayIndex + 1);
  }

  function handleAddVariant() {
    onChange(insertBeforeFallback([{ label: '', conditions: [defaultCondition()] }]));
  }

  const selectTemplates = templates.filter((template) => template.type === 'SELECT');

  function handleGenerate() {
    if (!generatorField) return;

    const template = selectTemplates.find((candidate) => candidate.id === generatorField);
    if (!template) return;

    onChange(
      insertBeforeFallback(
        template.options.map((value) => ({
          label: value,
          conditions: [
            {
              subject: 'DESCRIBED',
              source: 'CUSTOM_FIELD',
              subjectRef: template.id,
              operator: 'IS',
              operand: serializeOperand({ kind: 'literal', value }),
            },
          ],
        }))
      )
    );
    setGeneratorField('');
  }

  return (
    <div className="flex flex-col gap-3">
      {displayVariants.map((variant, displayIndex) => (
        <LabelVariantRow
          key={displayIndex}
          variant={variant}
          displayIndex={displayIndex}
          isFallback={displayIndex === fallbackDisplayIndex}
          canMoveUp={displayIndex > 0 && displayIndex < fallbackDisplayIndex}
          canMoveDown={displayIndex < fallbackDisplayIndex - 1}
          typeLabel={typeLabel}
          groups={groups}
          templates={templates}
          warnings={warningsFor(displayIndex)}
          onLabelChange={(label) => handleLabelChange(displayIndex, label)}
          onConditionChange={(conditionIndex, condition) =>
            handleConditionChange(displayIndex, conditionIndex, condition)
          }
          onConditionRemove={(conditionIndex) => handleConditionRemove(displayIndex, conditionIndex)}
          onAddCondition={() => handleAddCondition(displayIndex)}
          onRemove={() => handleRemoveVariant(displayIndex)}
          onMoveUp={() => handleMoveUp(displayIndex)}
          onMoveDown={() => handleMoveDown(displayIndex)}
        />
      ))}

      <button
        type="button"
        onClick={handleAddVariant}
        className="self-start rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {t('addVariant')}
      </button>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('generate')}</span>
          <select
            aria-label={t('generate')}
            value={generatorField}
            onChange={(e) => setGeneratorField(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="" />
            {selectTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">{t('generateHint')}</p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!generatorField}
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {t('generateApply')}
        </button>
      </div>
    </div>
  );
}
