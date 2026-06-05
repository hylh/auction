import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  AUCTION_STATUSES,
  FISH_SPECIES,
  INVENTORY_STATUSES,
  USER_ROLES,
} from "../domain/constants";

export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const fishSpeciesEnum = pgEnum("fish_species", FISH_SPECIES);
export const inventoryStatusEnum = pgEnum("inventory_status", INVENTORY_STATUSES);
export const auctionStatusEnum = pgEnum("auction_status", AUCTION_STATUSES);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  role: userRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fishItems = pgTable(
  "fish_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    species: fishSpeciesEnum("species").notNull(),
    displayName: text("display_name").notNull(),
    weightGrams: integer("weight_grams").notNull(),
    catchRegion: text("catch_region").notNull(),
    grade: text("grade").notNull(),
    startingPriceCents: integer("starting_price_cents").notNull(),
    currency: text("currency").notNull().default("NOK"),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id),
    status: inventoryStatusEnum("status").notNull().default("draft"),
    description: text("description"),
    imageUrl: text("image_url"),
    ...timestampsWithUpdate(),
  },
  (table) => [
    index("fish_items_seller_idx").on(table.sellerId),
    index("fish_items_species_idx").on(table.species),
    index("fish_items_status_idx").on(table.status),
  ],
);

export const auctions = pgTable(
  "auctions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fishItemId: uuid("fish_item_id")
      .notNull()
      .references(() => fishItems.id),
    status: auctionStatusEnum("status").notNull().default("scheduled"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    minimumIncrementCents: integer("minimum_increment_cents").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestampsWithUpdate(),
  },
  (table) => [
    index("auctions_fish_item_idx").on(table.fishItemId),
    index("auctions_status_idx").on(table.status),
    index("auctions_window_idx").on(table.startsAt, table.endsAt),
  ],
);

export const bids = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id),
    bidderId: uuid("bidder_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bids_auction_amount_idx").on(table.auctionId, table.amountCents),
    index("bids_auction_time_idx").on(table.auctionId, table.acceptedAt),
    index("bids_bidder_idx").on(table.bidderId),
  ],
);

export const rejectedBids = pgTable(
  "rejected_bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id),
    bidderId: uuid("bidder_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    code: text("code").notNull(),
    reason: text("reason").notNull(),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("rejected_bids_auction_idx").on(table.auctionId),
    index("rejected_bids_bidder_idx").on(table.bidderId),
    index("rejected_bids_rejected_at_idx").on(table.rejectedAt),
    index("rejected_bids_code_idx").on(table.code),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auctionId: uuid("auction_id")
      .notNull()
      .references(() => auctions.id),
    fishItemId: uuid("fish_item_id")
      .notNull()
      .references(() => fishItems.id),
    winningBidId: uuid("winning_bid_id")
      .notNull()
      .references(() => bids.id),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("NOK"),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sales_completed_at_idx").on(table.completedAt),
    index("sales_fish_item_idx").on(table.fishItemId),
    uniqueIndex("sales_auction_unique_idx").on(table.auctionId),
    uniqueIndex("sales_winning_bid_unique_idx").on(table.winningBidId),
  ],
);

export const inventoryStatusChanges = pgTable(
  "inventory_status_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fishItemId: uuid("fish_item_id")
      .notNull()
      .references(() => fishItems.id),
    auctionId: uuid("auction_id").references(() => auctions.id),
    fromStatus: inventoryStatusEnum("from_status"),
    toStatus: inventoryStatusEnum("to_status").notNull(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("inventory_status_changes_fish_item_idx").on(table.fishItemId),
    index("inventory_status_changes_auction_idx").on(table.auctionId),
    index("inventory_status_changes_created_at_idx").on(table.createdAt),
  ],
);

export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    auctionId: uuid("auction_id").references(() => auctions.id),
    fishItemId: uuid("fish_item_id").references(() => fishItems.id),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("admin_actions_admin_idx").on(table.adminUserId),
    index("admin_actions_auction_idx").on(table.auctionId),
    index("admin_actions_fish_item_idx").on(table.fishItemId),
    index("admin_actions_created_at_idx").on(table.createdAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  fishItems: many(fishItems),
  bids: many(bids),
  rejectedBids: many(rejectedBids),
  changedInventoryStatuses: many(inventoryStatusChanges),
  adminActions: many(adminActions),
}));

export const fishItemsRelations = relations(fishItems, ({ one, many }) => ({
  seller: one(users, {
    fields: [fishItems.sellerId],
    references: [users.id],
  }),
  auctions: many(auctions),
  sales: many(sales),
  statusChanges: many(inventoryStatusChanges),
  adminActions: many(adminActions),
}));

export const auctionsRelations = relations(auctions, ({ one, many }) => ({
  fishItem: one(fishItems, {
    fields: [auctions.fishItemId],
    references: [fishItems.id],
  }),
  bids: many(bids),
  rejectedBids: many(rejectedBids),
  sales: many(sales),
  inventoryStatusChanges: many(inventoryStatusChanges),
  adminActions: many(adminActions),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  auction: one(auctions, {
    fields: [bids.auctionId],
    references: [auctions.id],
  }),
  bidder: one(users, {
    fields: [bids.bidderId],
    references: [users.id],
  }),
}));

export const rejectedBidsRelations = relations(rejectedBids, ({ one }) => ({
  auction: one(auctions, {
    fields: [rejectedBids.auctionId],
    references: [auctions.id],
  }),
  bidder: one(users, {
    fields: [rejectedBids.bidderId],
    references: [users.id],
  }),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  auction: one(auctions, {
    fields: [sales.auctionId],
    references: [auctions.id],
  }),
  fishItem: one(fishItems, {
    fields: [sales.fishItemId],
    references: [fishItems.id],
  }),
  winningBid: one(bids, {
    fields: [sales.winningBidId],
    references: [bids.id],
  }),
  buyer: one(users, {
    fields: [sales.buyerId],
    references: [users.id],
  }),
  seller: one(users, {
    fields: [sales.sellerId],
    references: [users.id],
  }),
}));

export const inventoryStatusChangesRelations = relations(inventoryStatusChanges, ({ one }) => ({
  fishItem: one(fishItems, {
    fields: [inventoryStatusChanges.fishItemId],
    references: [fishItems.id],
  }),
  auction: one(auctions, {
    fields: [inventoryStatusChanges.auctionId],
    references: [auctions.id],
  }),
  changedBy: one(users, {
    fields: [inventoryStatusChanges.changedByUserId],
    references: [users.id],
  }),
}));

export const adminActionsRelations = relations(adminActions, ({ one }) => ({
  admin: one(users, {
    fields: [adminActions.adminUserId],
    references: [users.id],
  }),
  auction: one(auctions, {
    fields: [adminActions.auctionId],
    references: [auctions.id],
  }),
  fishItem: one(fishItems, {
    fields: [adminActions.fishItemId],
    references: [fishItems.id],
  }),
}));

function timestampsWithUpdate() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  };
}
