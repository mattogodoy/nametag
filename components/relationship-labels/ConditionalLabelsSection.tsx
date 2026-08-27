'use client';

import { useTranslations } from 'next-intl';
import LabelVariantList from './LabelVariantList';
import type {
  ConditionRowCustomFieldTemplate,
  ConditionRowGroup,
} from './LabelVariantRow';
import LabelPreview, { type LabelPreviewPerson } from './LabelPreview';
import type { LabelVariant } from '@/lib/relationship-labels/types';

export interface ConditionalLabelsSectionProps {
  variants: LabelVariant[];
  /** The relationship type's own label, used as the fallback row's placeholder. */
  typeLabel: string;
  groups: ConditionRowGroup[];
  templates: ConditionRowCustomFieldTemplate[];
  people: LabelPreviewPerson[];
  genderSuggestions: string[];
  onChange: (variants: LabelVariant[]) => void;
}

/**
 * The collapsed home for conditional labels on the relationship type form. It
 * starts closed: a user who never wants conditional labels sees one extra
 * line, not a wall of controls.
 */
export default function ConditionalLabelsSection({
  variants,
  typeLabel,
  groups,
  templates,
  people,
  genderSuggestions,
  onChange,
}: ConditionalLabelsSectionProps) {
  const t = useTranslations('relationshipTypes.form.conditionalLabels');

  return (
    <details className="group rounded-lg border border-border">
      <summary className="cursor-pointer list-none rounded-lg px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="group-open:hidden">{t('expand')}</span>
        <span className="hidden group-open:inline">{t('collapse')}</span>
      </summary>

      <div className="flex flex-col gap-4 border-t border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t('sectionTitle')}</p>
          <p className="text-xs text-muted">{t('sectionHint')}</p>
          <p className="mt-1 text-xs text-muted">{t('absenceHint')}</p>
        </div>

        <LabelVariantList
          variants={variants}
          typeLabel={typeLabel}
          groups={groups}
          templates={templates}
          genderSuggestions={genderSuggestions}
          onChange={onChange}
        />

        <LabelPreview typeLabel={typeLabel} variants={variants} people={people} />
      </div>
    </details>
  );
}
