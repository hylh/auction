import { and, eq } from "drizzle-orm";
import type { db } from "../db/client";
import { adminActions, inventoryStatusChanges, users } from "../db/schema";
import type { InventoryLifecycleStatus } from "./auction-types";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function assertAdminUser(tx: Transaction, adminUserId: string, errorMessage: string) {
  const admin = await tx.query.users.findFirst({
    where: and(eq(users.id, adminUserId), eq(users.role, "admin")),
  });
  if (!admin) {
    throw new Error(errorMessage);
  }
}

export async function recordInventoryStatusChange(
  tx: Transaction,
  input: {
    fishItemId: string;
    auctionId: string | null;
    fromStatus: InventoryLifecycleStatus | null;
    toStatus: InventoryLifecycleStatus;
    changedByUserId: string | null;
    reason: string;
  },
) {
  if (input.fromStatus === input.toStatus) return;

  await tx.insert(inventoryStatusChanges).values({
    fishItemId: input.fishItemId,
    auctionId: input.auctionId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    changedByUserId: input.changedByUserId,
    reason: input.reason,
  });
}

export async function recordAdminAction(
  tx: Transaction,
  input: {
    adminUserId: string;
    action: string;
    auctionId: string | null;
    fishItemId: string | null;
    reason: string;
  },
) {
  await tx.insert(adminActions).values(input);
}
