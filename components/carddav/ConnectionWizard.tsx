'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import Step1ServerConfig from './wizard/Step1ServerConfig';
import Step2AddressBookSelect from './wizard/Step2AddressBookSelect';
import Step2BackupDownload from './wizard/Step2BackupDownload';
import Step3SyncConfig from './wizard/Step3SyncConfig';
import type { WizardData } from './wizard/Step1ServerConfig';

interface ConnectionWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_DATA: WizardData = {
  provider: 'google',
  serverUrl: 'https://www.googleapis.com/.well-known/carddav',
  username: '',
  password: '',
  testPassed: false,
  backupDownloaded: false,
  syncEnabled: false,
  addressBookUrl: null,
  addressBookName: null,
  addressBooks: [],
};

type StepKey = 'stepServer' | 'stepAddressBook' | 'stepBackup' | 'stepSync';

export default function ConnectionWizard({ isOpen, onClose }: ConnectionWizardProps) {
  const tw = useTranslations('settings.carddav.wizard');

  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      /* eslint-disable react-hooks/set-state-in-effect -- resetting state when modal opens is intentional */
      setCurrentStep(1);
      setData(INITIAL_DATA);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen]);

  const handleUpdate = (partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  // Determine if the address book step is needed (2+ books)
  const showAddressBookStep = data.addressBooks.length > 1;

  // Build dynamic step list
  const steps: StepKey[] = showAddressBookStep
    ? ['stepServer', 'stepAddressBook', 'stepBackup', 'stepSync']
    : ['stepServer', 'stepBackup', 'stepSync'];

  const stepTitleMap: Record<StepKey, string> = {
    stepServer: tw('step1Title'),
    stepAddressBook: tw('step2abTitle'),
    stepBackup: tw('step2Title'),
    stepSync: tw('step3Title'),
  };

  const currentStepKey = steps[currentStep - 1];

  // When moving past step 1 and there's exactly 1 address book, auto-select it
  const handleStep1Next = () => {
    if (data.addressBooks.length === 1) {
      const book = data.addressBooks[0];
      handleUpdate({
        addressBookUrl: book.url,
        addressBookName: book.displayName || null,
      });
    }
    setCurrentStep(2);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={stepTitleMap[currentStepKey]}
      size="lg"
    >
      <div>
        {/* Step indicator */}
        <div className="flex items-start justify-center mb-8">
          {steps.map((stepKey, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;

            return (
              <div key={stepKey} className="flex items-start">
                {index > 0 && (
                  <div
                    className={`w-12 h-0.5 mt-4 mx-1 ${
                      isCompleted ? 'bg-primary' : 'bg-surface-elevated'
                    }`}
                  />
                )}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : isCompleted
                          ? 'bg-primary/20 text-primary border-2 border-primary'
                          : 'bg-surface-elevated text-muted'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      stepNumber
                    )}
                  </div>
                  <span
                    className={`mt-1 text-xs ${
                      isActive
                        ? 'text-primary font-medium'
                        : 'text-muted'
                    }`}
                  >
                    {tw(stepKey)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        {currentStepKey === 'stepServer' && (
          <Step1ServerConfig
            data={data}
            onUpdate={handleUpdate}
            onNext={handleStep1Next}
            onCancel={onClose}
          />
        )}
        {currentStepKey === 'stepAddressBook' && (
          <Step2AddressBookSelect
            data={data}
            addressBooks={data.addressBooks}
            onUpdate={handleUpdate}
            onNext={() => setCurrentStep(currentStep + 1)}
            onBack={() => setCurrentStep(currentStep - 1)}
          />
        )}
        {currentStepKey === 'stepBackup' && (
          <Step2BackupDownload
            data={data}
            onUpdate={handleUpdate}
            onNext={() => setCurrentStep(currentStep + 1)}
            onBack={() => setCurrentStep(currentStep - 1)}
          />
        )}
        {currentStepKey === 'stepSync' && (
          <Step3SyncConfig
            data={data}
            onUpdate={handleUpdate}
            onBack={() => setCurrentStep(currentStep - 1)}
            onClose={onClose}
          />
        )}
      </div>
    </Modal>
  );
}
