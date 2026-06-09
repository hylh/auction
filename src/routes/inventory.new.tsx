import { createFileRoute } from "@tanstack/react-router";
import { AuctionStep } from "../components/inventory/auction-step";
import { FishDetailsStep } from "../components/inventory/fish-details-step";
import { PricingSellerStep } from "../components/inventory/pricing-seller-step";
import { useInventoryForm } from "../components/inventory/use-inventory-form";
import { WizardProgress } from "../components/inventory/wizard-progress";

export const Route = createFileRoute("/inventory/new")({
  component: NewInventoryPage,
});

function NewInventoryPage() {
  const form = useInventoryForm();
  const { values, fieldErrors, previews, step, totalSteps, setField } = form;

  return (
    <main className="page">
      <section className="hero">
        <div>
          <span className="pill">Inventory intake</span>
          <h1>Add fish for sale.</h1>
          <p>
            Fish weight is entered in kilograms and stored as integer grams. Money is entered in NOK
            and stored as integer cents. You can list inventory only, or create an active or
            scheduled auction immediately.
          </p>
        </div>
      </section>

      <article className="card c-teal">
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            form.submit();
          }}
        >
          {/* Step progress indicator — hidden on desktop via CSS */}
          <WizardProgress step={step} />

          {/* All field panels. On desktop (≥768px) wizard-panels/wizard-panel become
              display:contents so every field is a direct grid item of .form — identical
              to the pre-wizard layout. On mobile (<768px) CSS shows only the active panel. */}
          <div className="wizard-panels" data-step={step}>
            <FishDetailsStep
              values={values}
              fieldErrors={fieldErrors}
              previews={previews}
              setField={setField}
            />
            <PricingSellerStep
              values={values}
              sellers={form.sellers}
              sellerId={form.sellerId}
              fieldErrors={fieldErrors}
              previews={previews}
              setField={setField}
            />
            <AuctionStep
              values={values}
              fieldErrors={fieldErrors}
              previews={previews}
              setField={setField}
            />
          </div>

          {/* Submit — always visible on desktop; on mobile only visible on step 3 (CSS). */}
          <button
            className="button wizard-submit"
            disabled={form.isSubmitting || form.isUsersLoading}
            type="submit"
          >
            {form.isSubmitting
              ? "Adding fish..."
              : values.createAuction
                ? "Add fish and create auction"
                : "Add fish"}
          </button>

          {/* Back / Next navigation — mobile only (hidden on desktop via CSS). */}
          <div className="wizard-nav">
            {step > 1 && (
              <button type="button" className="button secondary" onClick={form.handleBack}>
                ← Back
              </button>
            )}
            {step < totalSteps && (
              <button type="button" className="button" onClick={form.handleNext}>
                Next →
              </button>
            )}
          </div>
        </form>
        {form.message && <p className={form.message.type}>{form.message.text}</p>}
      </article>
    </main>
  );
}
