import { sql } from "drizzle-orm";
import type { Transaction } from "./auction-audit";

export function lockAuctionRow(tx: Transaction, auctionId: string) {
  return tx.execute(sql`select id from auctions where id = ${auctionId} for update`);
}

export function lockFishItemRow(tx: Transaction, fishItemId: string) {
  return tx.execute(sql`select id from fish_items where id = ${fishItemId} for update`);
}
