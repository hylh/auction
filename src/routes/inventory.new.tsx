import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { DEMO_USERS, FISH_SPECIES } from "../domain/constants";
import { centsFromMajor, formatMoney } from "../domain/money";
import { auctionInputSchema, fishInputSchema } from "../domain/validation";
import { formatKilograms, gramsFromKilograms } from "../domain/weight";
import { createAuctionFn, createFishItemFn, getDemoUsersFn } from "../server/functions";
import {
  type Step,
  STEP_LABELS,
  TOTAL_STEPS,
  canAdvance,
  clampStep,
  validateStep,
} from "./-inventory-new-stepper";

type InventoryFormState = {
  species: (typeof FISH_SPECIES)[number];
  displayName: string;
  weightKilograms: string;
  catchRegion: string;
  grade: string;
  startingPriceMajor: string;
  sellerId: string;
  description: string;
  imageUrl: string;
  createAuction: boolean;
  startsAt: string;
  endsAt: string;
  minimumIncrementMajor: string;
};

type FieldErrors = Partial<Record<keyof InventoryFormState, string>>;

const dummyFishItemId = "00000000-0000-4000-8000-000000000099";

export const Route = createFileRoute("/inventory/new")({
  component: NewInventoryPage,
});

function NewInventoryPage() {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["demo-users"], queryFn: () => getDemoUsersFn() });
  const sellers = users.data?.filter((user) => user.role === "seller") ?? [];
  const [values, setValues] = useState<InventoryFormState>(() => initialFormState());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [step, setStep] = useState<Step>(1);
  const previews = useMemo(() => buildPreviews(values), [values]);

  useEffect(() => {
    if (!values.sellerId && sellers[0]) {
      setValues((current) => ({ ...current, sellerId: sellers[0].id }));
    }
  }, [sellers, values.sellerId]);

  useEffect(() => {
    setValues((current) => {
      if (current.startsAt || current.endsAt) {
        return current;
      }
      const window = defaultAuctionWindow();
      return { ...current, startsAt: window.startsAt, endsAt: window.endsAt };
    });
  }, []);

  const handleNext = () => {
    const stepErrors = validateStep(step, values);
    setFieldErrors((prev) => ({ ...prev, ...stepErrors }));
    if (canAdvance(step, stepErrors)) {
      setStep(clampStep(step + 1));
    }
  };

  const handleBack = () => {
    setStep(clampStep(step - 1));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      setMessage(null);
      const validation = validateForm(values);
      setFieldErrors(validation.fieldErrors);
      if (!validation.ok) {
        throw new Error("Fix the highlighted fields before adding inventory.");
      }

      const fish = await createFishItemFn({ data: validation.fishInput });
      if (!validation.auctionInput) {
        return `${fish.displayName} was added as listed inventory.`;
      }

      const auction = await createAuctionFn({
        data: {
          ...validation.auctionInput,
          fishItemId: fish.id,
        },
      });

      return `${fish.displayName} was listed and ${auction.status} auction ${auction.id.slice(0, 8)} was created.`;
    },
    onSuccess: (resultMessage) => {
      setMessage({ type: "success", text: resultMessage });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => setMessage({ type: "error", text: error.message }),
  });

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
            mutation.mutate();
          }}
        >
          {/* Step progress indicator — hidden on desktop via CSS */}
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

          {/* All field panels. On desktop (≥768px) wizard-panels/wizard-panel become
              display:contents so every field is a direct grid item of .form — identical
              to the pre-wizard layout. On mobile (<768px) CSS shows only the active panel. */}
          <div className="wizard-panels" data-step={step}>
            {/* Step 1 — Fish details */}
            <div className="wizard-panel" data-panel="1">
              <label className="field">
                <span>Species</span>
                <select
                  name="species"
                  value={values.species}
                  onChange={(event) =>
                    updateField(
                      setValues,
                      "species",
                      event.currentTarget.value as InventoryFormState["species"],
                    )
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
                  onChange={(event) =>
                    updateField(setValues, "displayName", event.currentTarget.value)
                  }
                />
                <FieldError message={fieldErrors.displayName} />
              </label>

              <label className="field">
                <span>Weight (kg)</span>
                <input
                  name="weightKilograms"
                  inputMode="decimal"
                  value={values.weightKilograms}
                  onChange={(event) =>
                    updateField(setValues, "weightKilograms", event.currentTarget.value)
                  }
                />
                <FieldHint preview={previews.weight} />
                <FieldError message={fieldErrors.weightKilograms ?? previews.weightError} />
              </label>

              <label className="field">
                <span>Catch region</span>
                <input
                  name="catchRegion"
                  value={values.catchRegion}
                  onChange={(event) =>
                    updateField(setValues, "catchRegion", event.currentTarget.value)
                  }
                />
                <FieldError message={fieldErrors.catchRegion} />
              </label>

              <label className="field">
                <span>Freshness / grade</span>
                <input
                  name="grade"
                  value={values.grade}
                  onChange={(event) => updateField(setValues, "grade", event.currentTarget.value)}
                />
                <FieldError message={fieldErrors.grade} />
              </label>
            </div>

            {/* Step 2 — Pricing & seller */}
            <div className="wizard-panel" data-panel="2">
              <label className="field">
                <span>Starting price (NOK)</span>
                <input
                  name="startingPriceMajor"
                  inputMode="numeric"
                  value={values.startingPriceMajor}
                  onChange={(event) =>
                    updateField(setValues, "startingPriceMajor", event.currentTarget.value)
                  }
                />
                <FieldHint preview={previews.startingPrice} />
                <FieldError
                  message={fieldErrors.startingPriceMajor ?? previews.startingPriceError}
                />
              </label>

              <label className="field">
                <span>Seller</span>
                <select
                  name="sellerId"
                  value={values.sellerId}
                  onChange={(event) =>
                    updateField(setValues, "sellerId", event.currentTarget.value)
                  }
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
                  onChange={(event) =>
                    updateField(setValues, "description", event.currentTarget.value)
                  }
                />
                <FieldError message={fieldErrors.description} />
              </label>

              <label className="field">
                <span>External image URL</span>
                <input
                  name="imageUrl"
                  placeholder="https://example.com/fish.jpg"
                  value={values.imageUrl}
                  onChange={(event) =>
                    updateField(setValues, "imageUrl", event.currentTarget.value)
                  }
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

            {/* Step 3 — Auction (optional) */}
            <div className="wizard-panel" data-panel="3">
              <section className="card nested-card">
                <label className="checkbox-field">
                  <input
                    checked={values.createAuction}
                    name="createAuction"
                    onChange={(event) =>
                      updateField(setValues, "createAuction", event.currentTarget.checked)
                    }
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
                        onChange={(event) =>
                          updateField(setValues, "startsAt", event.currentTarget.value)
                        }
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
                        onChange={(event) =>
                          updateField(setValues, "endsAt", event.currentTarget.value)
                        }
                      />
                      <FieldError message={fieldErrors.endsAt} />
                    </label>
                    <label className="field">
                      <span>Minimum increment (NOK)</span>
                      <input
                        name="minimumIncrementMajor"
                        inputMode="numeric"
                        value={values.minimumIncrementMajor}
                        onChange={(event) =>
                          updateField(setValues, "minimumIncrementMajor", event.currentTarget.value)
                        }
                      />
                      <FieldHint preview={previews.minimumIncrement} />
                      <FieldError
                        message={
                          fieldErrors.minimumIncrementMajor ?? previews.minimumIncrementError
                        }
                      />
                    </label>
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Submit — always visible on desktop; on mobile only visible on step 3 (CSS). */}
          <button
            className="button wizard-submit"
            disabled={mutation.isPending || users.isLoading}
            type="submit"
          >
            {mutation.isPending
              ? "Adding fish..."
              : values.createAuction
                ? "Add fish and create auction"
                : "Add fish"}
          </button>

          {/* Back / Next navigation — mobile only (hidden on desktop via CSS). */}
          <div className="wizard-nav">
            {step > 1 && (
              <button type="button" className="button secondary" onClick={handleBack}>
                ← Back
              </button>
            )}
            {step < TOTAL_STEPS && (
              <button type="button" className="button" onClick={handleNext}>
                Next →
              </button>
            )}
          </div>
        </form>
        {message && <p className={message.type}>{message.text}</p>}
      </article>
    </main>
  );
}

function validateForm(values: InventoryFormState):
  | {
      ok: true;
      fieldErrors: FieldErrors;
      fishInput: Record<string, string>;
      auctionInput: {
        fishItemId: string;
        adminUserId: string;
        startsAt: string;
        endsAt: string;
        minimumIncrementCents: number;
      } | null;
    }
  | { ok: false; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const fishInput = {
    species: values.species,
    displayName: values.displayName,
    weightKilograms: values.weightKilograms,
    catchRegion: values.catchRegion,
    grade: values.grade,
    startingPriceMajor: values.startingPriceMajor,
    sellerId: values.sellerId,
    description: values.description,
    imageUrl: values.imageUrl,
  };
  const parsedFish = fishInputSchema.safeParse(fishInput);

  if (!parsedFish.success) {
    Object.assign(fieldErrors, flattenFieldErrors(parsedFish.error.flatten().fieldErrors));
  }

  try {
    gramsFromKilograms(values.weightKilograms);
  } catch (error) {
    fieldErrors.weightKilograms = error instanceof Error ? error.message : "Invalid weight";
  }

  try {
    centsFromMajor(values.startingPriceMajor);
  } catch (error) {
    fieldErrors.startingPriceMajor =
      error instanceof Error ? error.message : "Invalid starting price";
  }

  let auctionInput: {
    fishItemId: string;
    adminUserId: string;
    startsAt: string;
    endsAt: string;
    minimumIncrementCents: number;
  } | null = null;

  if (values.createAuction) {
    let minimumIncrementCents = 0;
    try {
      minimumIncrementCents = centsFromMajor(values.minimumIncrementMajor);
    } catch (error) {
      fieldErrors.minimumIncrementMajor =
        error instanceof Error ? error.message : "Invalid minimum increment";
    }

    const auctionCandidate = {
      fishItemId: dummyFishItemId,
      adminUserId: DEMO_USERS.admin,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      minimumIncrementCents,
    };
    const parsedAuction = auctionInputSchema.safeParse(auctionCandidate);
    if (!parsedAuction.success) {
      const auctionErrors = flattenFieldErrors(parsedAuction.error.flatten().fieldErrors);
      Object.assign(fieldErrors, auctionErrors);
      const incrementError = (auctionErrors as Record<string, string | undefined>)
        .minimumIncrementCents;
      if (incrementError) {
        fieldErrors.minimumIncrementMajor = incrementError;
      }
    }
    if (new Date(values.endsAt) <= new Date()) {
      fieldErrors.endsAt = "Auction end time must be in the future";
    }
    auctionInput = auctionCandidate;
  }

  if (Object.keys(fieldErrors).length > 0 || !parsedFish.success) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    fieldErrors,
    fishInput,
    auctionInput,
  };
}

function flattenFieldErrors(errors: Record<string, Array<string> | undefined>): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([, messages]) => messages?.[0])
      .map(([field, messages]) => [field, messages?.[0]]),
  ) as FieldErrors;
}

function buildPreviews(values: InventoryFormState) {
  const weight = safePreview(values.weightKilograms, (value) => {
    const grams = gramsFromKilograms(value);
    return `Will store ${grams.toLocaleString("en-GB")} grams (${formatKilograms(grams)}).`;
  });
  const startingPrice = safePreview(values.startingPriceMajor, (value) => {
    const cents = centsFromMajor(value);
    return `Starting price: ${formatMoney(cents)}.`;
  });
  const minimumIncrement = safePreview(values.minimumIncrementMajor, (value) => {
    const cents = centsFromMajor(value);
    return `Minimum increment: ${formatMoney(cents)}.`;
  });

  return {
    weight: weight.preview,
    weightError: weight.error,
    startingPrice: startingPrice.preview,
    startingPriceError: startingPrice.error,
    minimumIncrement: minimumIncrement.preview,
    minimumIncrementError: minimumIncrement.error,
    ...imagePreview(values.imageUrl),
  };
}

function safePreview(value: string, parse: (value: string) => string) {
  if (!value.trim()) {
    return { preview: null, error: null };
  }

  try {
    return { preview: parse(value), error: null };
  } catch (error) {
    return { preview: null, error: error instanceof Error ? error.message : "Invalid value" };
  }
}

function imagePreview(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { imageUrl: null, imageError: null };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { imageUrl: null, imageError: "Image preview requires an http(s) URL" };
    }
    return { imageUrl: url.toString(), imageError: null };
  } catch {
    return { imageUrl: null, imageError: "Enter a valid URL to preview the image" };
  }
}

function FieldError({ message }: { message?: string | null }) {
  return message ? <span className="field-error">{message}</span> : null;
}

function FieldHint({ preview }: { preview?: string | null }) {
  return preview ? <span className="field-hint">{preview}</span> : null;
}

function initialFormState(): InventoryFormState {
  return {
    species: "salmon",
    displayName: "Morning catch salmon crate",
    weightKilograms: "42.5",
    catchRegion: "Lofoten",
    grade: "A",
    startingPriceMajor: "1800",
    sellerId: "",
    description: "Packed in ice and ready for same-day auction.",
    imageUrl: "",
    createAuction: true,
    startsAt: "",
    endsAt: "",
    minimumIncrementMajor: "100",
  };
}

function defaultAuctionWindow() {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  return {
    startsAt: toLocalDateTimeInput(startsAt),
    endsAt: toLocalDateTimeInput(endsAt),
  };
}

function toLocalDateTimeInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function updateField<Key extends keyof InventoryFormState>(
  setValues: Dispatch<SetStateAction<InventoryFormState>>,
  field: Key,
  value: InventoryFormState[Key],
) {
  setValues((current) => ({ ...current, [field]: value }));
}
