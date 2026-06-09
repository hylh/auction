import { FieldError, FieldHint } from "./field-feedback";
import type { FormPreviews } from "./inventory-form-logic";
import type { FieldErrors, InventoryFormState, SetField } from "./types";

type AuctionStepProps = {
  values: InventoryFormState;
  fieldErrors: FieldErrors;
  previews: FormPreviews;
  setField: SetField;
};

export function AuctionStep({ values, fieldErrors, previews, setField }: AuctionStepProps) {
  return (
    <div className="wizard-panel" data-panel="3">
      <section className="card nested-card">
        <label className="checkbox-field">
          <input
            checked={values.createAuction}
            name="createAuction"
            onChange={(event) => setField("createAuction", event.currentTarget.checked)}
            type="checkbox"
          />
          <span>Create an auction from this inventory after listing it</span>
        </label>

        {values.createAuction && (
          <div className="grid">
            <label className="field">
              <span>Starts at</span>
              <input
                name="startsAt"
                type="datetime-local"
                value={values.startsAt}
                onChange={(event) => setField("startsAt", event.currentTarget.value)}
              />
              <FieldHint preview="Use now or earlier for an active auction; use a future time to schedule." />
              <FieldError message={fieldErrors.startsAt} />
            </label>
            <label className="field">
              <span>Ends at</span>
              <input
                name="endsAt"
                type="datetime-local"
                value={values.endsAt}
                onChange={(event) => setField("endsAt", event.currentTarget.value)}
              />
              <FieldError message={fieldErrors.endsAt} />
            </label>
            <label className="field">
              <span>Minimum increment (NOK)</span>
              <input
                name="minimumIncrementMajor"
                inputMode="numeric"
                value={values.minimumIncrementMajor}
                onChange={(event) => setField("minimumIncrementMajor", event.currentTarget.value)}
              />
              <FieldHint preview={previews.minimumIncrement} />
              <FieldError
                message={fieldErrors.minimumIncrementMajor ?? previews.minimumIncrementError}
              />
            </label>
          </div>
        )}
      </section>
    </div>
  );
}
