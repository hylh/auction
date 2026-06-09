import { FieldError, FieldHint } from "./field-feedback";
import type { FormPreviews } from "./inventory-form-logic";
import type { FieldErrors, InventoryFormState, SetField } from "./types";

type Seller = { id: string; displayName: string };

type PricingSellerStepProps = {
  values: InventoryFormState;
  sellers: Array<Seller>;
  sellerId: string;
  fieldErrors: FieldErrors;
  previews: FormPreviews;
  setField: SetField;
};

export function PricingSellerStep({
  values,
  sellers,
  sellerId,
  fieldErrors,
  previews,
  setField,
}: PricingSellerStepProps) {
  return (
    <div className="wizard-panel" data-panel="2">
      <label className="field">
        <span>Starting price (NOK)</span>
        <input
          name="startingPriceMajor"
          inputMode="numeric"
          value={values.startingPriceMajor}
          onChange={(event) => setField("startingPriceMajor", event.currentTarget.value)}
        />
        <FieldHint preview={previews.startingPrice} />
        <FieldError message={fieldErrors.startingPriceMajor ?? previews.startingPriceError} />
      </label>

      <label className="field">
        <span>Seller</span>
        <select
          name="sellerId"
          value={sellerId}
          onChange={(event) => setField("sellerId", event.currentTarget.value)}
        >
          <option value="">Choose seller</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.displayName}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.sellerId} />
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          name="description"
          value={values.description}
          onChange={(event) => setField("description", event.currentTarget.value)}
        />
        <FieldError message={fieldErrors.description} />
      </label>

      <label className="field">
        <span>External image URL</span>
        <input
          name="imageUrl"
          placeholder="https://example.com/fish.jpg"
          value={values.imageUrl}
          onChange={(event) => setField("imageUrl", event.currentTarget.value)}
        />
        <FieldError message={fieldErrors.imageUrl ?? previews.imageError} />
        {previews.imageUrl && (
          <img
            alt={`${values.displayName} preview`}
            className="preview-image"
            src={previews.imageUrl}
          />
        )}
      </label>
    </div>
  );
}
