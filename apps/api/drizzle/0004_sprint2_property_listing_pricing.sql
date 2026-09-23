-- Hand-fixed after `drizzle-kit generate`: drizzle-kit double-quotes any
-- customType dataType() string it doesn't recognize as a builtin, which is
-- invalid SQL for "geography(Point, 4326)" (a type expression, not an
-- identifier). If this migration is ever regenerated from schema.ts, strip
-- the quotes drizzle-kit adds around `geography(Point, 4326)` again.
CREATE TABLE "host_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"rejection_reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_documents_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "host_documents_owner_type_check" CHECK ("host_documents"."owner_type" in ('host_profile', 'property')),
	CONSTRAINT "host_documents_doc_type_check" CHECK ("host_documents"."doc_type" in ('pan', 'aadhaar', 'ownership_proof', 'authorization_letter', 'utility_bill', 'business_reg')),
	CONSTRAINT "host_documents_review_status_check" CHECK ("host_documents"."review_status" in ('pending', 'accepted', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "host_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"host_type" text NOT NULL,
	"legal_name" text NOT NULL,
	"business_name" text,
	"gstin" text,
	"kyc_status" text DEFAULT 'not_started' NOT NULL,
	"kyc_reviewed_by" uuid,
	"kyc_reviewed_at" timestamp with time zone,
	"kyc_rejection_reason" text,
	"payout_account_name" text,
	"payout_bank_name" text,
	"payout_ifsc" text,
	"payout_account_last4" text,
	"payout_account_enc" text,
	"payout_key_version" integer,
	"payout_added_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "host_profiles_host_type_check" CHECK ("host_profiles"."host_type" in ('individual', 'business')),
	CONSTRAINT "host_profiles_kyc_status_check" CHECK ("host_profiles"."kyc_status" in ('not_started', 'submitted', 'verified', 'rejected')),
	CONSTRAINT "host_profiles_status_check" CHECK ("host_profiles"."status" in ('active', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"position" integer NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_photos_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "listing_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"method" text NOT NULL,
	"evidence_document_id" uuid,
	"verified_by" uuid,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "listing_verifications_level_check" CHECK ("listing_verifications"."level" between 0 and 4),
	CONSTRAINT "listing_verifications_method_check" CHECK ("listing_verifications"."method" in ('self_declared', 'phone', 'photo_review', 'property_authorization', 'physical'))
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"host_user_id" uuid NOT NULL,
	"space_label" text NOT NULL,
	"space_type" text NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"vehicle_types" jsonb,
	"length_cm" integer,
	"width_cm" integer,
	"height_cm" integer,
	"covered" boolean DEFAULT false NOT NULL,
	"amenities" jsonb,
	"access_method" text,
	"rules" text,
	"location" geography(Point, 4326),
	"status" text DEFAULT 'draft' NOT NULL,
	"status_reason" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_space_type_check" CHECK ("listings"."space_type" in ('exclusive', 'pool')),
	CONSTRAINT "listings_capacity_check" CHECK (("listings"."space_type" = 'exclusive' and "listings"."capacity" = 1) or ("listings"."space_type" = 'pool' and "listings"."capacity" > 1)),
	CONSTRAINT "listings_access_method_check" CHECK ("listings"."access_method" in ('qr', 'guard_manual', 'open')),
	CONSTRAINT "listings_status_check" CHECK ("listings"."status" in ('draft', 'pending_verification', 'published', 'paused', 'suspended', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pricing_version_id" uuid NOT NULL,
	"rule_type" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"days_of_week" jsonb,
	"window_start_min" integer,
	"window_end_min" integer,
	"min_duration_min" integer,
	CONSTRAINT "pricing_rules_rule_type_check" CHECK ("pricing_rules"."rule_type" in ('base_hourly', 'base_daily', 'peak', 'weekend')),
	CONSTRAINT "pricing_rules_amount_check" CHECK ("pricing_rules"."amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pricing_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"property_type" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"locality" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"entry_location" geography(Point, 4326) NOT NULL,
	"outsider_policy" text NOT NULL,
	"security_contacts" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_property_type_check" CHECK ("properties"."property_type" in ('society', 'commercial', 'standalone', 'independent_home')),
	CONSTRAINT "properties_outsider_policy_check" CHECK ("properties"."outsider_policy" in ('allowed', 'authorized_only', 'disallowed')),
	CONSTRAINT "properties_status_check" CHECK ("properties"."status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "property_access_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"gate_hours" jsonb NOT NULL,
	"access_methods" jsonb NOT NULL,
	"escort_required" boolean DEFAULT false NOT NULL,
	"emergency_override_contact" jsonb,
	"effective_from" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"authorized_by_user_id" uuid NOT NULL,
	"authorization_type" text NOT NULL,
	"permitted_parking_types" jsonb NOT NULL,
	"outsider_policy" text NOT NULL,
	"document_id" uuid,
	"effective_from" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_authorizations_type_check" CHECK ("property_authorizations"."authorization_type" in ('owner_self', 'society_resolution', 'management_contract')),
	CONSTRAINT "property_authorizations_outsider_policy_check" CHECK ("property_authorizations"."outsider_policy" in ('allowed', 'authorized_only', 'disallowed'))
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"scope_type" text,
	"scope_id" uuid,
	"granted_by_type" text NOT NULL,
	"granted_by_user_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "user_roles_role_check" CHECK ("user_roles"."role" in ('host', 'property_manager')),
	CONSTRAINT "user_roles_scope_type_check" CHECK ("user_roles"."scope_type" in ('property')),
	CONSTRAINT "user_roles_granted_by_type_check" CHECK ("user_roles"."granted_by_type" in ('self', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_persona" text;--> statement-breakpoint
ALTER TABLE "host_profiles" ADD CONSTRAINT "host_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_verifications" ADD CONSTRAINT "listing_verifications_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_verifications" ADD CONSTRAINT "listing_verifications_evidence_document_id_host_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."host_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_pricing_version_id_pricing_versions_id_fk" FOREIGN KEY ("pricing_version_id") REFERENCES "public"."pricing_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_versions" ADD CONSTRAINT "pricing_versions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_access_policies" ADD CONSTRAINT "property_access_policies_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_authorizations" ADD CONSTRAINT "property_authorizations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_authorizations" ADD CONSTRAINT "property_authorizations_authorized_by_user_id_users_id_fk" FOREIGN KEY ("authorized_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_authorizations" ADD CONSTRAINT "property_authorizations_document_id_host_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."host_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "host_documents_owner_idx" ON "host_documents" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_photos_cover_unique_idx" ON "listing_photos" USING btree ("listing_id") WHERE "listing_photos"."is_cover" = true;--> statement-breakpoint
CREATE INDEX "listing_photos_listing_id_idx" ON "listing_photos" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_verifications_listing_id_idx" ON "listing_verifications" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listings_location_gist_idx" ON "listings" USING gist ("location");--> statement-breakpoint
CREATE INDEX "listings_property_id_idx" ON "listings" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "listings_host_user_id_idx" ON "listings" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "listings_published_idx" ON "listings" USING btree ("status") WHERE "listings"."status" = 'published';--> statement-breakpoint
CREATE INDEX "pricing_rules_pricing_version_id_idx" ON "pricing_rules" USING btree ("pricing_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_versions_listing_version_idx" ON "pricing_versions" USING btree ("listing_id","version");--> statement-breakpoint
CREATE INDEX "properties_location_gist_idx" ON "properties" USING gist ("location");--> statement-breakpoint
CREATE INDEX "properties_entry_location_gist_idx" ON "properties" USING gist ("entry_location");--> statement-breakpoint
CREATE INDEX "properties_locality_idx" ON "properties" USING btree ("locality");--> statement-breakpoint
CREATE INDEX "properties_created_by_idx" ON "properties" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_access_policies_property_version_idx" ON "property_access_policies" USING btree ("property_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "property_authorizations_live_unique_idx" ON "property_authorizations" USING btree ("property_id") WHERE "property_authorizations"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "property_authorizations_property_id_idx" ON "property_authorizations" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_live_grant_unique_idx" ON "user_roles" USING btree ("user_id","role",coalesce("scope_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "user_roles"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_scope_idx" ON "user_roles" USING btree ("scope_type","scope_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_last_persona_check" CHECK ("users"."last_persona" in ('driver', 'owner'));