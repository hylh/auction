import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { createAuctionFn, createFishItemFn, getDemoUsersFn } from "../../server/functions";
import {
  type Step,
  TOTAL_STEPS,
  canAdvance,
  clampStep,
  validateStep,
} from "../../routes/-inventory-new-stepper";
import {
  buildPreviews,
  defaultAuctionWindow,
  initialFormState,
  validateForm,
} from "./inventory-form-logic";
import type { FieldErrors, InventoryFormState } from "./types";

type Message = { type: "success" | "error"; text: string };

// Owns the multi-step inventory form: state, the seller default, the client-only
// auction-window seeding, step navigation, and the create-fish/create-auction
// mutation. The route stays a thin layout that wires the returned values into
// presentational step components.
export function useInventoryForm() {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["demo-users"], queryFn: () => getDemoUsersFn() });
  const sellers = useMemo(
    () => users.data?.filter((user) => user.role === "seller") ?? [],
    [users.data],
  );

  const [values, setValues] = useState<InventoryFormState>(() => initialFormState());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<Message | null>(null);
  const [step, setStep] = useState<Step>(1);

  // Seed the auction window after mount only. Computing new Date() during the
  // initial render would differ between server and client and break hydration of
  // the datetime-local inputs, so this stays an effect rather than a derived value.
  useEffect(() => {
    setValues((current) => {
      if (current.startsAt || current.endsAt) {
        return current;
      }
      const window = defaultAuctionWindow();
      return { ...current, startsAt: window.startsAt, endsAt: window.endsAt };
    });
  }, []);

  // Derive the effective seller during render instead of syncing it with an
  // effect: fall back to the first seller until the user explicitly picks one.
  const sellerId = values.sellerId || sellers[0]?.id || "";
  const effectiveValues = useMemo<InventoryFormState>(
    () => ({ ...values, sellerId }),
    [values, sellerId],
  );

  const previews = useMemo(() => buildPreviews(effectiveValues), [effectiveValues]);

  const setField = <Key extends keyof InventoryFormState>(
    field: Key,
    value: InventoryFormState[Key],
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleNext = () => {
    const stepErrors = validateStep(step, effectiveValues);
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
      const validation = validateForm(effectiveValues);
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

  return {
    values,
    sellers,
    sellerId,
    fieldErrors,
    message,
    step,
    totalSteps: TOTAL_STEPS,
    previews,
    isUsersLoading: users.isLoading,
    isSubmitting: mutation.isPending,
    setField,
    handleNext,
    handleBack,
    submit: () => mutation.mutate(),
  };
}
