CREATE TABLE "rejected_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"bidder_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"code" text NOT NULL,
	"reason" text NOT NULL,
	"rejected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rejected_bids" ADD CONSTRAINT "rejected_bids_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rejected_bids" ADD CONSTRAINT "rejected_bids_bidder_id_users_id_fk" FOREIGN KEY ("bidder_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rejected_bids_auction_idx" ON "rejected_bids" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "rejected_bids_bidder_idx" ON "rejected_bids" USING btree ("bidder_id");--> statement-breakpoint
CREATE INDEX "rejected_bids_rejected_at_idx" ON "rejected_bids" USING btree ("rejected_at");--> statement-breakpoint
CREATE INDEX "rejected_bids_code_idx" ON "rejected_bids" USING btree ("code");