-- AgriSense Database Initialization Script
-- Run this on first database creation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('farmer', 'coop_admin', 'admin')),
    region_id VARCHAR(100),
    crop_id VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cooperatives table
CREATE TABLE IF NOT EXISTS cooperatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    region_id VARCHAR(100) NOT NULL,
    admin_id UUID REFERENCES users(id),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    crops TEXT[] DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Farmer profiles (linked to users)
CREATE TABLE IF NOT EXISTS farmer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    cooperative_id UUID REFERENCES cooperatives(id),
    village VARCHAR(255),
    district VARCHAR(255),
    state VARCHAR(255),
    farm_size_hectares DECIMAL(10,2),
    primary_crop VARCHAR(100),
    crops TEXT[] DEFAULT '{}',
    irrigation_type VARCHAR(50) CHECK (irrigation_type IN ('rainfed', 'irrigated', 'partial')),
    soil_type VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fields table
CREATE TABLE IF NOT EXISTS fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
    cooperative_id UUID REFERENCES cooperatives(id),
    name VARCHAR(255) NOT NULL,
    crop_id VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    area_hectares DECIMAL(10,2) NOT NULL,
    location_lat DECIMAL(10,8) NOT NULL,
    location_lon DECIMAL(11,8) NOT NULL,
    irrigation_type VARCHAR(50) CHECK (irrigation_type IN ('rainfed', 'irrigated', 'partial')),
    planting_date DATE,
    season VARCHAR(50),
    soil_data JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disease scans table
CREATE TABLE IF NOT EXISTS disease_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE SET NULL,
    field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
    crop_id VARCHAR(100) NOT NULL,
    region_id VARCHAR(100) NOT NULL,
    image_url TEXT,
    image_hash VARCHAR(64),
    disease_id VARCHAR(100),
    disease_name VARCHAR(255),
    confidence DECIMAL(5,4),
    source VARCHAR(20) CHECK (source IN ('edge', 'cloud', 'hybrid')),
    symptoms TEXT[],
    location_lat DECIMAL(10,8),
    location_lon DECIMAL(11,8),
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high')),
    advisory_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Yield predictions table
CREATE TABLE IF NOT EXISTS yield_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
    farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE SET NULL,
    crop_id VARCHAR(100) NOT NULL,
    region_id VARCHAR(100) NOT NULL,
    season VARCHAR(50) NOT NULL,
    area_hectares DECIMAL(10,2),
    predicted_yield_min DECIMAL(8,2),
    predicted_yield_max DECIMAL(8,2),
    predicted_yield_expected DECIMAL(8,2),
    confidence DECIMAL(5,4),
    key_drivers TEXT[],
    explanation TEXT,
    model_version VARCHAR(50),
    weather_data JSONB,
    satellite_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advisories table
CREATE TABLE IF NOT EXISTS advisories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disease_id VARCHAR(100) NOT NULL,
    crop_id VARCHAR(100) NOT NULL,
    region_id VARCHAR(100) NOT NULL,
    language VARCHAR(10) NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high')),
    treatment TEXT NOT NULL,
    preventive_measures TEXT[],
    follow_up TEXT,
    safety_warnings TEXT[],
    local_names JSONB,
    generated_by VARCHAR(50) CHECK (generated_by IN ('ai', 'expert', 'template')),
    model_version VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weather cache table
CREATE TABLE IF NOT EXISTS weather_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_lat DECIMAL(10,8) NOT NULL,
    location_lon DECIMAL(11,8) NOT NULL,
    data JSONB NOT NULL,
    source VARCHAR(50),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(location_lat, location_lon, source)
);

-- Satellite data cache table
CREATE TABLE IF NOT EXISTS satellite_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_lat DECIMAL(10,8) NOT NULL,
    location_lon DECIMAL(11,8) NOT NULL,
    data JSONB NOT NULL,
    source VARCHAR(50),
    resolution INTEGER,
    acquired_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider usage tracking
CREATE TABLE IF NOT EXISTS provider_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id VARCHAR(100) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    region_id VARCHAR(100) NOT NULL,
    success BOOLEAN NOT NULL,
    latency_ms INTEGER,
    tokens_used INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model versions table
CREATE TABLE IF NOT EXISTS model_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('edge', 'cloud')),
    model_url TEXT NOT NULL,
    model_hash VARCHAR(64),
    input_size INTEGER,
    confidence_threshold DECIMAL(4,3),
    top_k INTEGER,
    accuracy_metrics JSONB,
    is_active BOOLEAN DEFAULT false,
    released_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(region_id, model_type, version)
);

-- Federated learning contributions
CREATE TABLE IF NOT EXISTS federated_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id VARCHAR(100) NOT NULL,
    farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE SET NULL,
    model_version VARCHAR(50) NOT NULL,
    contribution_type VARCHAR(50) CHECK (contribution_type IN ('weights', 'gradients', 'data_stats')),
    data_hash VARCHAR(64),
    sample_count INTEGER,
    metrics JSONB,
    status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_region ON users(region_id);
CREATE INDEX IF NOT EXISTS idx_fields_farmer ON fields(farmer_id);
CREATE INDEX IF NOT EXISTS idx_fields_cooperative ON fields(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_fields_crop ON fields(crop_id);
CREATE INDEX IF NOT EXISTS idx_disease_scans_farmer ON disease_scans(farmer_id);
CREATE INDEX IF NOT EXISTS idx_disease_scans_field ON disease_scans(field_id);
CREATE INDEX IF NOT EXISTS idx_disease_scans_created ON disease_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disease_scans_disease ON disease_scans(disease_id);
CREATE INDEX IF NOT EXISTS idx_yield_predictions_field ON yield_predictions(field_id);
CREATE INDEX IF NOT EXISTS idx_yield_predictions_created ON yield_predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advisories_lookup ON advisories(disease_id, crop_id, region_id, language, severity);
CREATE INDEX IF NOT EXISTS idx_weather_cache_location ON weather_cache(location_lat, location_lon);
CREATE INDEX IF NOT EXISTS idx_weather_cache_expires ON weather_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_provider_usage_lookup ON provider_usage(provider_id, task_type, region_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cooperatives_updated_at BEFORE UPDATE ON cooperatives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_farmer_profiles_updated_at BEFORE UPDATE ON farmer_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fields_updated_at BEFORE UPDATE ON fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_advisories_updated_at BEFORE UPDATE ON advisories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123 - change in production!)
INSERT INTO users (email, name, role, password_hash, region_id, crop_id)
VALUES (
    'admin@agrisense.app',
    'System Admin',
    'admin',
    crypt('admin123', gen_salt('bf')),
    'india',
    'rice'
) ON CONFLICT (email) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agrisense;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agrisense;