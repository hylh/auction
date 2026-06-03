CREATE TYPE "public"."auction_status" AS ENUM('scheduled', 'active', 'closed', 'unsold', 'withdrawn');
CREATE TYPE "public"."fish_species" AS ENUM('salmon', 'cod', 'tuna', 'halibut', 'mackerel', 'trout', 'herring');
CREATE TYPE "public"."inventory_status" AS ENUM('draft', 'listed', 'in_auction', 'sold', 'withdrawn');
CREATE TYPE "public"."user_role" AS ENUM('seller', 'buyer', 'admin');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "display_name" text NOT NULL,
  "role" "user_role" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "fish_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "species" "fish_species" NOT NULL,
  "display_name" text NOT NULL,
  "weight_grams" integer NOT NULL,
  "catch_region" text NOT NULL,
  "grade" text NOT NULL,
  "starting_price_cents" integer DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'NOK' NOT NULL,
  "seller_id" uuid NOT NULL,
  "status" "inventory_status" DEFAULT 'draft' NOT NULL,
  "description" text,
  "image_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "auctions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fish_item_id" uuid NOT NULL,
  "status" "auction_status" DEFAULT 'scheduled' NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "minimum_increment_cents" integer NOT NULL,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "bids" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "auction_id" uuid NOT NULL,
  "bidder_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "auction_id" uuid NOT NULL,
  "fish_item_id" uuid NOT NULL,
  "winning_bid_id" uuid NOT NULL,
  "buyer_id" uuid NOT NULL,
  "seller_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'NOK' NOT NULL,
  "completed_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "fish_items" ADD CONSTRAINT "fish_items_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_fish_item_id_fish_items_id_fk" FOREIGN KEY ("fish_item_id") REFERENCES "public"."fish_items"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bids" ADD CONSTRAINT "bids_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_users_id_fk" FOREIGN KEY ("bidder_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_fish_item_id_fish_items_id_fk" FOREIGN KEY ("fish_item_id") REFERENCES "public"."fish_items"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_winning_bid_id_bids_id_fk" FOREIGN KEY ("winning_bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "fish_items_seller_idx" ON "fish_items" USING btree ("seller_id");
CREATE INDEX "fish_items_species_idx" ON "fish_items" USING btree ("species");
CREATE INDEX "fish_items_status_idx" ON "fish_items" USING btree ("status");
CREATE INDEX "auctions_fish_item_idx" ON "auctions" USING btree ("fish_item_id");
CREATE INDEX "auctions_status_idx" ON "auctions" USING btree ("status");
CREATE INDEX "auctions_window_idx" ON "auctions" USING btree ("starts_at", "ends_at");
CREATE INDEX "bids_auction_amount_idx" ON "bids" USING btree ("auction_id", "amount_cents");
CREATE INDEX "bids_auction_time_idx" ON "bids" USING btree ("auction_id", "accepted_at");
CREATE INDEX "bids_bidder_idx" ON "bids" USING btree ("bidder_id");
CREATE INDEX "sales_completed_at_idx" ON "sales" USING btree ("completed_at");
CREATE INDEX "sales_fish_item_idx" ON "sales" USING btree ("fish_item_id");
CREATE UNIQUE INDEX "sales_auction_unique_idx" ON "sales" USING btree ("auction_id");
CREATE UNIQUE INDEX "sales_winning_bid_unique_idx" ON "sales" USING btree ("winning_bid_id");
