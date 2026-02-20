'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import Step1ServerConfig from './wizard/Step1ServerConfig';
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
};

const STEPS = ['stepServer', 'stepBackup', 'stepSync'] as const;

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

  const stepTitles = [tw('step1Title'), tw('step2Title'), tw('step3Title')];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={stepTitles[currentStep - 1]}
      size="lg"
    >
      <div>
        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((stepKey, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;

            return (
              <div key={stepKey} className="flex items-center">
                {index > 0 && (
                  <div
                    className={`w-12 h-0.5 mx-1 ${
                      isCompleted ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
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
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
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
        {currentStep === 1 && (
          <Step1ServerConfig
            data={data}
            onUpdate={handleUpdate}
            onNext={() => setCurrentStep(2)}
            onCancel={onClose}
          />
        )}
        {currentStep === 2 && (
          <Step2BackupDownload
            data={data}
            onUpdate={handleUpdate}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && (
          <Step3SyncConfig
            data={data}
            onUpdate={handleUpdate}
            onBack={() => setCurrentStep(2)}
            onClose={onClose}
          />
        )}
      </div>
    </Modal>
  );
}
