CREATE TYPE "public"."area_unit" AS ENUM('acre', 'guntha', 'cent', 'sqft', 'sqyd', 'hectare');--> statement-breakpoint
CREATE TYPE "public"."call_kind" AS ENUM('audio', 'video');--> statement-breakpoint
CREATE TYPE "public"."call_policy" AS ENUM('anyone_in_chat', 'nobody');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('ringing', 'accepted', 'rejected', 'cancelled', 'missed', 'busy', 'ended');--> statement-breakpoint
CREATE TYPE "public"."conversation_kind" AS ENUM('direct', 'room');--> statement-breakpoint
CREATE TYPE "public"."land_type" AS ENUM('agricultural', 'residential', 'commercial', 'industrial', 'farmhouse', 'plantation');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'sold');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'system', 'call');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('buyer', 'seller', 'broker');--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"caller_id" uuid NOT NULL,
	"callee_id" uuid NOT NULL,
	"kind" "call_kind" NOT NULL,
	"status" "call_status" DEFAULT 'ringing' NOT NULL,
	"room_name" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp (3) with time zone,
	"ended_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "conversation_kind" NOT NULL,
	"title" text,
	"listing_id" uuid,
	"created_by" uuid NOT NULL,
	"direct_key" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_direct_key_unique" UNIQUE("direct_key")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"land_type" "land_type" NOT NULL,
	"area" double precision NOT NULL,
	"area_unit" "area_unit" NOT NULL,
	"area_sqft" double precision NOT NULL,
	"price_inr" bigint NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"locality" text NOT NULL,
	"district" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"approx_location" boolean DEFAULT true NOT NULL,
	"road_access_ft" integer,
	"water_source" text,
	"title_docs" text[] DEFAULT '{}' NOT NULL,
	"zoning" text,
	"images" text[] NOT NULL,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid,
	"kind" "message_kind" DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"family" uuid NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "saved_listings" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_listings_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL,
	"phone" text,
	"rera_id" text,
	"avatar_url" text,
	"verified" boolean DEFAULT false NOT NULL,
	"call_policy" "call_policy" DEFAULT 'anyone_in_chat' NOT NULL,
	"show_approx_location" boolean DEFAULT true NOT NULL,
	"push_token" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_caller_id_users_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_callee_id_users_id_fk" FOREIGN KEY ("callee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calls_caller_idx" ON "calls" USING btree ("caller_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "calls_callee_idx" ON "calls" USING btree ("callee_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "members_user_idx" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "listings_feed_idx" ON "listings" USING btree ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "listings_geo_idx" ON "listings" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "listings_owner_idx" ON "listings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "messages_conv_idx" ON "messages" USING btree ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family");