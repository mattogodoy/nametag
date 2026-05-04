'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from './ui/Modal';
import { GraphFilterGroupPill } from './GraphFilterPills';

export default function GraphFilterHelpModal() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex w-6 h-6 items-center justify-center rounded-full border border-foreground/40 bg-surface-elevated text-base font-bold text-muted hover:text-foreground hover:border-foreground transition-colors shrink-0"
        aria-label={t('graph.filterHelp.ariaLabel')}
        title={t('graph.filterHelp.ariaLabel')}
      >
        ?
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t('graph.filterHelp.title')}
        size="lg"
        closeAriaLabel={tCommon('close')}
      >
        <div className="space-y-4 text-sm text-foreground">
          {/* Section 1: explains include/exclude filters. */}
          <section>
            <h3 className="font-semibold text-base mb-2">
              {t('graph.filterHelp.groupsSection')}
            </h3>
            <p className="text-muted-foreground">
              {t('graph.filterHelp.groupsDescription')}
            </p>
            <div className="space-y-2 mt-2">
              <div>
                <span className="text-muted-foreground font-bold mr-2">
                  {t('graph.filterHelp.includingSection')}
                </span>
                <GraphFilterGroupPill
                  id="help-include-example"
                  label={t('graph.filterHelp.example')}
                  color="#3b82f6"
                  isNegative={false}
                  removeDisabled={true}
                />
                <p className="text-muted-foreground mt-2">
                  {t('graph.filterHelp.includingDescription')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground font-bold mr-2">
                  {t('graph.filterHelp.excludingSection')}
                </span>
                <GraphFilterGroupPill
                  id="help-exclude-example"
                  label={t('graph.filterHelp.example')}
                  color="#3b82f6"
                  isNegative={true}
                  removeDisabled={true}
                />
                <p className="text-muted-foreground mt-2">
                  {t('graph.filterHelp.excludingDescription')}
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: explains match modes (any vs all). */}
          <section className="pt-4 border-t border-border">
            <h3 className="font-semibold text-base mb-2">
              {t('graph.filterHelp.matchModeSection')}
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-muted-foreground font-bold mb-1">
                  {t('graph.filterHelp.anyMode')}
                </p>
                <p className="text-muted-foreground">
                  {t('graph.filterHelp.anyModeDescription')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground font-bold mb-1">
                  {t('graph.filterHelp.allMode')}
                </p>
                <p className="text-muted-foreground">
                  {t('graph.filterHelp.allModeDescription')}
                </p>
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </>
  );
}
