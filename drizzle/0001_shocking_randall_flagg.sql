CREATE TABLE "inventory_status_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fish_item_id" uuid NOT NULL,
	"auction_id" uuid,
	"from_status" "inventory_status",
	"to_status" "inventory_status" NOT NULL,
	"changed_by_user_id" uuid,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"auction_id" uuid,
	"fish_item_id" uuid,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_status_changes" ADD CONSTRAINT "inventory_status_changes_fish_item_id_fish_items_id_fk" FOREIGN KEY ("fish_item_id") REFERENCES "public"."fish_items"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory_status_changes" ADD CONSTRAINT "inventory_status_changes_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory_status_changes" ADD CONSTRAINT "inventory_status_changes_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_fish_item_id_fish_items_id_fk" FOREIGN KEY ("fish_item_id") REFERENCES "public"."fish_items"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "inventory_status_changes_fish_item_idx" ON "inventory_status_changes" USING btree ("fish_item_id");
--> statement-breakpoint
CREATE INDEX "inventory_status_changes_auction_idx" ON "inventory_status_changes" USING btree ("auction_id");
--> statement-breakpoint
CREATE INDEX "inventory_status_changes_created_at_idx" ON "inventory_status_changes" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "admin_actions_admin_idx" ON "admin_actions" USING btree ("admin_user_id");
--> statement-breakpoint
CREATE INDEX "admin_actions_auction_idx" ON "admin_actions" USING btree ("auction_id");
--> statement-breakpoint
CREATE INDEX "admin_actions_fish_item_idx" ON "admin_actions" USING btree ("fish_item_id");
--> statement-breakpoint
CREATE INDEX "admin_actions_created_at_idx" ON "admin_actions" USING btree ("created_at");
