import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FISH_SPECIES } from "../domain/constants";
import { createFishItemFn, getDemoUsersFn } from "../server/functions";

export const Route = createFileRoute("/inventory/new")({
  component: NewInventoryPage,
});

function NewInventoryPage() {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["demo-users"], queryFn: () => getDemoUsersFn() });
  const sellers = users.data?.filter((user) => user.role === "seller") ?? [];
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: Record<string, FormDataEntryValue>) => createFishItemFn({ data }),
    onSuccess: (fish) => {
      setMessage(`${fish.displayName} was added as listed inventory.`);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => setMessage(error.message),
  });

  return (
    <main className="page">
      <section className="hero">
        <span className="pill">Inventory intake</span>
        <h1>Add fish for sale.</h1>
        <p>
          Fish weight is entered in kilograms and stored as integer grams. Money is entered in NOK
          and stored as integer cents.
        </p>
      </section>

      <section className="card">
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            mutation.mutate(Object.fromEntries(formData));
          }}
        >
          <label className="field">
            <span>Species</span>
            <select name="species" defaultValue="salmon">
              {FISH_SPECIES.map((species) => (
                <option key={species} value={species}>
                  {species}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Display name</span>
            <input name="displayName" defaultValue="Morning catch salmon crate" />
          </label>
          <label className="field">
            <span>Weight (kg)</span>
            <input name="weightKilograms" inputMode="decimal" defaultValue="42.5" />
          </label>
          <label className="field">
            <span>Catch region</span>
            <input name="catchRegion" defaultValue="Lofoten" />
          </label>
          <label className="field">
            <span>Freshness / grade</span>
            <input name="grade" defaultValue="A" />
          </label>
          <label className="field">
            <span>Starting price (NOK)</span>
            <input name="startingPriceMajor" inputMode="decimal" defaultValue="1800" />
          </label>
          <label className="field">
            <span>Seller</span>
            <select name="sellerId" defaultValue={sellers[0]?.id}>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Description</span>
            <textarea
              name="description"
              defaultValue="Packed in ice and ready for same-day auction."
            />
          </label>
          <label className="field">
            <span>External image URL</span>
            <input name="imageUrl" placeholder="https://example.com/fish.jpg" />
          </label>
          <button className="button" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Adding fish..." : "Add fish"}
          </button>
        </form>
        {message && <p className="success">{message}</p>}
      </section>
    </main>
  );
}
