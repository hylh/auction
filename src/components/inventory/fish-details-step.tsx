import { FISH_SPECIES } from "../../domain/constants";
import { FieldError, FieldHint } from "./field-feedback";
import type { FormPreviews } from "./inventory-form-logic";
import type { FieldErrors, InventoryFormState, SetField } from "./types";

type FishDetailsStepProps = {
  values: InventoryFormState;
  fieldErrors: FieldErrors;
  previews: FormPreviews;
  setField: SetField;
};

export function FishDetailsStep({ values, fieldErrors, previews, setField }: FishDetailsStepProps) {
  return (
    <div className="wizard-panel" data-panel="1">
      <label className="field">
        <span>Species</span>
        <select
          name="species"
          value={values.species}
          onChange={(event) =>
            setField("species", event.currentTarget.value as InventoryFormState["species"])
          }
        >
          {FISH_SPECIES.map((species) => (
            <option key={species} value={species}>
              {species}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.species} />
      </label>

      <label className="field">
        <span>Display name</span>
        <input
          name="displayName"
          value={values.displayName}
          onChange={(event) => setField("displayName", event.currentTarget.value)}
        />
        <FieldError message={fieldErrors.displayName} />
      </label>

      <label className="field">
        <span>Weight (kg)</span>
        <input
          name="weightKilograms"
          inputMode="decimal"
          value={values.weightKilograms}
          onChange={(event) => setField("weightKilograms", event.currentTarget.value)}
        />
        <FieldHint preview={previews.weight} />
        <FieldError message={fieldErrors.weightKilograms ?? previews.weightError} />
      </label>

      <label className="field">
        <span>Catch region</span>
        <input
          name="catchRegion"
          value={values.catchRegion}
          onChange={(event) => setField("catchRegion", event.currentTarget.value)}
        />
        <FieldError message={fieldErrors.catchRegion} />
      </label>

      <label className="field">
        <span>Freshness / grade</span>
        <input
          name="grade"
          value={values.grade}
          onChange={(event) => setField("grade", event.currentTarget.value)}
        />
        <FieldError message={fieldErrors.grade} />
      </label>
    </div>
  );
}
