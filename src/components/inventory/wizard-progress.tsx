import { STEP_LABELS, TOTAL_STEPS, type Step } from "../../routes/-inventory-new-stepper";

type WizardProgressProps = {
  step: Step;
};

export function WizardProgress({ step }: WizardProgressProps) {
  return (
    <div className="wizard-step-indicator" aria-live="polite">
      <div className="wizard-dots" role="list" aria-label="Steps">
        {([1, 2, 3] as Step[]).map((s) => (
          <span
            key={s}
            role="listitem"
            aria-label={`Step ${s}: ${STEP_LABELS[s]}${s === step ? " (current)" : s < step ? " (complete)" : ""}`}
            className={`wizard-dot${s === step ? " active" : s < step ? " done" : ""}`}
          />
        ))}
      </div>
      <span className="wizard-step-label">
        Step {step} of {TOTAL_STEPS} — {STEP_LABELS[step]}
      </span>
    </div>
  );
}
