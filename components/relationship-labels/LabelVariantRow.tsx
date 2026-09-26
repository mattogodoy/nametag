'use client';

import { useTranslations } from 'next-intl';
import ConditionRow, {
  type ConditionRowCustomFieldTemplate,
  type ConditionRowGroup,
} from './ConditionRow';
import type { LabelCondition, LabelVariant } from '@/lib/relationship-labels/types';
import type { LabelWarning } from '@/lib/relationship-labels/warnings';

export type { ConditionRowGroup, ConditionRowCustomFieldTemplate };

export interface LabelVariantRowProps {
  variant: LabelVariant;
  /** Zero-based position among all rendered rows, fallback included last. */
  displayIndex: number;
  isFallback: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** The relationship type's own label, shown as the fallback row's placeholder. */
  typeLabel: string;
  groups: ConditionRowGroup[];
  templates: ConditionRowCustomFieldTemplate[];
  warnings: LabelWarning[];
  onLabelChange: (label: string) => void;
  onConditionChange: (conditionIndex: number, condition: LabelCondition) => void;
  onConditionRemove: (conditionIndex: number) => void;
  onAddCondition: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const controlClass =
  'p-1 text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary rounded';

export default function LabelVariantRow({
  variant,
  displayIndex,
  isFallback,
  canMoveUp,
  canMoveDown,
  typeLabel,
  groups,
  templates,
  warnings,
  onLabelChange,
  onConditionChange,
  onConditionRemove,
  onAddCondition,
  onRemove,
  onMoveUp,
  onMoveDown,
}: LabelVariantRowProps) {
  const t = useTranslations('relationshipTypes.form.conditionalLabels');
  // A 1-based row number gives every repeated control (move up, remove, the
  // label input...) its own accessible name, so a screen reader user can tell
  // which row a given "Move up" or "Remove this variant" button belongs to.
  const orderNumber = displayIndex + 1;
  const labelWord = t(isFallback ? 'labelOtherwise' : 'labelShow');

  const variantWarnings = warnings.filter((warning) => warning.conditionIndex === null);
  const conditionWarnings = (conditionIndex: number) =>
    warnings.filter((warning) => warning.conditionIndex === conditionIndex);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        {!isFallback && (
          <span
            aria-hidden="true"
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-medium text-muted"
          >
            {orderNumber}
          </span>
        )}
        <span className="text-sm text-muted">{labelWord}</span>
        <input
          type="text"
          aria-label={`${labelWord} ${orderNumber}`}
          placeholder={isFallback ? typeLabel : undefined}
          value={variant.label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="min-w-[8rem] flex-1 rounded border border-border bg-surface px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {!isFallback && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label={`${t('moveUp')} ${orderNumber}`}
              title={t('moveUp')}
              className={controlClass}
            >
              <span aria-hidden="true">&uarr;</span>
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label={`${t('moveDown')} ${orderNumber}`}
              title={t('moveDown')}
              className={controlClass}
            >
              <span aria-hidden="true">&darr;</span>
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${t('removeVariant')} ${orderNumber}`}
              title={t('removeVariant')}
              className={controlClass}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        )}
      </div>

      {variantWarnings.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted">{t('warnings.title')}</p>
          <ul className="flex flex-col gap-0.5">
            {variantWarnings.map((warning, i) => (
              <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
                {t(`warnings.${warning.code}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {variant.conditions.length > 0 && (
        <div className="flex flex-col gap-2 pl-2">
          {variant.conditions.map((condition, conditionIndex) => (
            <div key={conditionIndex} className="flex flex-col gap-1">
              <ConditionRow
                condition={condition}
                groups={groups}
                templates={templates}
                onChange={(next) => onConditionChange(conditionIndex, next)}
                onRemove={() => onConditionRemove(conditionIndex)}
              />
              {conditionWarnings(conditionIndex).map((warning, i) => (
                <p key={i} className="pl-2 text-xs text-amber-600 dark:text-amber-400">
                  {t(`warnings.${warning.code}`)}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAddCondition}
        aria-label={`${t('addCondition')} ${orderNumber}`}
        className="self-start rounded px-2 py-1 text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {t('addCondition')}
      </button>
    </div>
  );
}
