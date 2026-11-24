import { query } from "./index";

export const INIT_SCHEMA_SQL = `
-- Neon PostgreSQL schema for Pixa V3
CREATE TABLE IF NOT EXISTS "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(128) NOT NULL UNIQUE,
    admin_slot VARCHAR(32) UNIQUE,
    hashed_password VARCHAR(1024) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_superuser BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    auth_version INTEGER NOT NULL DEFAULT 1,
    credits INTEGER NOT NULL DEFAULT 0,
    free_presentation_used BOOLEAN NOT NULL DEFAULT false,
    has_purchased_credits BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_user_username ON "user" (LOWER(username));

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    plan_id VARCHAR(64),
    price_inr INTEGER,
    reference_id VARCHAR(128),
    description VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_credit_transactions_user_id ON credit_transactions (user_id);
CREATE INDEX IF NOT EXISTS ix_credit_transactions_reference_id ON credit_transactions (reference_id);

CREATE TABLE IF NOT EXISTS presentations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    version VARCHAR(11) NOT NULL DEFAULT 'v2',
    content TEXT NOT NULL,
    n_slides INTEGER NOT NULL,
    language VARCHAR NOT NULL,
    title VARCHAR,
    file_paths JSONB,
    outlines JSONB,
    layout JSONB,
    structure JSONB,
    instructions TEXT,
    tone VARCHAR,
    verbosity VARCHAR,
    include_table_of_contents BOOLEAN DEFAULT false,
    include_title_slide BOOLEAN DEFAULT true,
    web_search BOOLEAN DEFAULT false,
    theme JSONB,
    fonts JSONB,
    generation_mode VARCHAR NOT NULL DEFAULT 'standard',
    community_design_ids JSONB,
    credits_charged INTEGER NOT NULL DEFAULT 0,
    is_free_generation BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_presentations_owner_id ON presentations (owner_id);

CREATE TABLE IF NOT EXISTS slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presentation UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    layout_group VARCHAR NOT NULL,
    layout VARCHAR NOT NULL,
    "index" INTEGER NOT NULL,
    content JSONB NOT NULL,
    html_content TEXT,
    speaker_note TEXT,
    properties JSONB,
    ui JSONB
);

CREATE INDEX IF NOT EXISTS ix_slides_presentation ON slides (presentation);
CREATE INDEX IF NOT EXISTS ix_slides_owner_id ON slides (owner_id);

CREATE TABLE IF NOT EXISTS template_v2 (
    id VARCHAR PRIMARY KEY,
    owner_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    description TEXT,
    raw_layouts JSONB,
    components JSONB,
    merged_components JSONB,
    layouts JSONB,
    theme JSONB,
    assets JSONB,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_template_v2_owner_id ON template_v2 (owner_id);

CREATE TABLE IF NOT EXISTS admin_api_keys (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    key_value TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    assigned_user_id TEXT UNIQUE,
    allow_sharing BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_admin_api_keys_provider ON admin_api_keys (provider);
CREATE INDEX IF NOT EXISTS ix_admin_api_keys_status ON admin_api_keys (status);

CREATE TABLE IF NOT EXISTS admin_api_key_assignments (
    user_id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_admin_api_key_assignments_key_id ON admin_api_key_assignments (key_id);
CREATE INDEX IF NOT EXISTS ix_admin_api_key_assignments_provider ON admin_api_key_assignments (provider);

CREATE TABLE IF NOT EXISTS provider_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS async_tasks (
    id VARCHAR PRIMARY KEY,
    owner_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    type VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    message TEXT,
    error JSONB,
    data JSONB,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_async_tasks_type ON async_tasks (type);
CREATE INDEX IF NOT EXISTS ix_async_tasks_status ON async_tasks (status);
CREATE INDEX IF NOT EXISTS ix_async_tasks_owner_id ON async_tasks (owner_id);

CREATE TABLE IF NOT EXISTS chat_history_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    presentation_id UUID REFERENCES presentations(id) ON DELETE CASCADE,
    template_v2_id VARCHAR,
    conversation_id UUID NOT NULL,
    position INTEGER NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_chat_history_messages_conversation_id ON chat_history_messages (conversation_id);
CREATE INDEX IF NOT EXISTS ix_chat_history_messages_presentation_id ON chat_history_messages (presentation_id);

CREATE TABLE IF NOT EXISTS imageasset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    is_uploaded BOOLEAN NOT NULL DEFAULT false,
    path TEXT NOT NULL,
    extras JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_imageasset_owner_id ON imageasset (owner_id);

CREATE TABLE IF NOT EXISTS font_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR NOT NULL,
    path TEXT NOT NULL,
    normalized_family_name VARCHAR NOT NULL,
    family_name VARCHAR,
    subfamily_name VARCHAR,
    full_name VARCHAR,
    postscript_name VARCHAR,
    weight_class INTEGER,
    width_class INTEGER,
    format VARCHAR,
    size_bytes INTEGER NOT NULL,
    extras JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_font_uploads_normalized_family_name ON font_uploads (normalized_family_name);

CREATE TABLE IF NOT EXISTS keyvaluesqlmodel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR NOT NULL,
    value JSONB
);

CREATE INDEX IF NOT EXISTS ix_keyvaluesqlmodel_key ON keyvaluesqlmodel (key);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id VARCHAR PRIMARY KEY,
    owner_id UUID REFERENCES "user"(id) ON DELETE CASCADE,
    url VARCHAR NOT NULL,
    secret VARCHAR,
    event VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_webhook_subscriptions_event ON webhook_subscriptions (event);

CREATE TABLE IF NOT EXISTS presenton_cloud_provider (
    id INTEGER PRIMARY KEY DEFAULT 1,
    issuer VARCHAR(512) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    email VARCHAR(320) NOT NULL,
    access_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_plans (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    credits INTEGER NOT NULL,
    price_inr INTEGER NOT NULL,
    description TEXT,
    presentations_included INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_credit_plans_active ON credit_plans (is_active, sort_order);

CREATE TABLE IF NOT EXISTS payment_orders (
    id VARCHAR(128) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    plan_id VARCHAR(64) NOT NULL,
    amount_inr INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL DEFAULT 'created',
    razorpay_order_id VARCHAR(128) UNIQUE,
    razorpay_payment_id VARCHAR(128),
    razorpay_signature TEXT,
    receipt VARCHAR(128),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_payment_orders_user_id ON payment_orders (user_id);
CREATE INDEX IF NOT EXISTS ix_payment_orders_razorpay_order_id ON payment_orders (razorpay_order_id);
`;

let isInitialized = false;

export async function ensureSchema(): Promise<void> {
  if (isInitialized) return;
  try {
    await query(INIT_SCHEMA_SQL);

    // Ensure default credit plans are seeded
    await query(`
      INSERT INTO credit_plans (id, name, credits, price_inr, description, presentations_included, is_active, sort_order)
      VALUES 
        ('plan_50', 'Starter Pack', 50, 19, 'Ideal for assignments and coursework projects.', 5, true, 1),
        ('plan_100', 'Pro Pack', 100, 49, 'Best value for frequent creators, pitches, and reports.', 10, true, 2)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        credits = EXCLUDED.credits,
        price_inr = EXCLUDED.price_inr,
        description = EXCLUDED.description,
        presentations_included = EXCLUDED.presentations_included,
        is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order;
    `);

    isInitialized = true;
    console.info("[Pixa V3 DB] Neon PostgreSQL schema verified.");
  } catch (err) {
    console.error("[Pixa V3 DB] Failed to verify/initialize schema:", err);
    throw err;
  }
}
