-- =============================================================================
-- VELO — PostgreSQL Initialization Script
-- =============================================================================
-- This runs automatically on first container start.
-- Creates all schemas needed by VELO services.
-- =============================================================================

-- ============================================
-- System 1: Auth & Core Messaging
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) UNIQUE,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    status_text VARCHAR(200),
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    identity_key TEXT NOT NULL,
    signed_prekey TEXT NOT NULL,
    prekey_signature TEXT NOT NULL,
    one_time_prekeys TEXT[],
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(100),
    device_token TEXT,
    platform VARCHAR(10),
    last_active TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id),
    token_hash VARCHAR(256) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    user_id UUID REFERENCES users(id),
    contact_id UUID REFERENCES users(id),
    nickname VARCHAR(100),
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, contact_id)
);

CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES users(id),
    max_members INT DEFAULT 1024,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- ============================================
-- System 3: HR & Attendance
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    team VARCHAR(100),
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    marked_by UUID REFERENCES users(id),
    points_impact INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS points_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    change_amount INT NOT NULL,
    reason VARCHAR(50) NOT NULL,
    description TEXT,
    issued_by UUID REFERENCES users(id),
    related_attendance_id UUID REFERENCES attendance_records(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points_balance (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    total_points INT DEFAULT 100,
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    month VARCHAR(7) NOT NULL,
    total_present INT DEFAULT 0,
    total_absent INT DEFAULT 0,
    total_half_days INT DEFAULT 0,
    total_leaves INT DEFAULT 0,
    total_late INT DEFAULT 0,
    points_earned INT DEFAULT 0,
    points_deducted INT DEFAULT 0,
    final_points INT DEFAULT 0,
    target_percentage DECIMAL(5,2),
    generated_at TIMESTAMP,
    UNIQUE(user_id, month)
);

CREATE TABLE IF NOT EXISTS hr_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    target_user_id UUID REFERENCES users(id),
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    performed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- System 4: Gmail Integration
-- ============================================

CREATE TABLE IF NOT EXISTS email_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    gmail_address VARCHAR(255) NOT NULL,
    vault_token_key VARCHAR(255) NOT NULL,
    history_id BIGINT,
    watch_expiry TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'active',
    connected_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS email_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    gmail_message_id VARCHAR(50) NOT NULL,
    gmail_thread_id VARCHAR(50) NOT NULL,
    subject TEXT,
    sender_address VARCHAR(255),
    sender_name VARCHAR(200),
    category VARCHAR(20),
    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_count INT DEFAULT 0,
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    snippet TEXT,
    received_at TIMESTAMP,
    UNIQUE(user_id, gmail_message_id)
);

CREATE TABLE IF NOT EXISTS email_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(20) NOT NULL,
    gmail_thread_id VARCHAR(50),
    gmail_message_id VARCHAR(50),
    recipient VARCHAR(255),
    performed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- System 5: Enterprise Broadcast
-- ============================================

CREATE TABLE IF NOT EXISTS broadcast_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id),
    target_type VARCHAR(10) NOT NULL,
    target_value VARCHAR(100),
    priority VARCHAR(10) DEFAULT 'INFO',
    message TEXT NOT NULL,
    scheduled_at TIMESTAMP,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule VARCHAR(50),
    requires_ack BOOLEAN DEFAULT FALSE,
    ack_deadline TIMESTAMP,
    total_recipients INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    read_count INT DEFAULT 0,
    ack_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcast_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES broadcast_messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    delivery_status VARCHAR(20) DEFAULT 'pending',
    delivery_channel VARCHAR(10),
    read_status BOOLEAN DEFAULT FALSE,
    acknowledged BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    ack_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delivery_broadcast ON broadcast_delivery_log(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_delivery_user ON broadcast_delivery_log(user_id);

CREATE TABLE IF NOT EXISTS broadcast_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES broadcast_messages(id),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(30) NOT NULL,
    details JSONB,
    performed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Done
-- ============================================
SELECT 'VELO database initialized successfully!' AS status;
