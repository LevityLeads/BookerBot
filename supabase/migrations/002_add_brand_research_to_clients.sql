-- ============================================
-- ADD BRAND RESEARCH FIELDS TO CLIENTS
-- ============================================
-- Brand research now happens at the Client level, not Workflow level
-- This allows multiple workflows to share the same brand knowledge

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS brand_url TEXT,
ADD COLUMN IF NOT EXISTS brand_summary TEXT,
ADD COLUMN IF NOT EXISTS brand_services JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS brand_target_audience TEXT,
ADD COLUMN IF NOT EXISTS brand_tone TEXT,
ADD COLUMN IF NOT EXISTS brand_usps JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS brand_faqs JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS brand_dos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS brand_donts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS brand_researched_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN clients.brand_url IS 'Website URL used for brand research';
COMMENT ON COLUMN clients.brand_summary IS 'AI-generated summary of the brand';
COMMENT ON COLUMN clients.brand_services IS 'Array of services/products offered';
COMMENT ON COLUMN clients.brand_target_audience IS 'Description of target audience';
COMMENT ON COLUMN clients.brand_tone IS 'Brand voice/tone description';
COMMENT ON COLUMN clients.brand_usps IS 'Array of unique selling points';
COMMENT ON COLUMN clients.brand_faqs IS 'Array of {question, answer} objects';
COMMENT ON COLUMN clients.brand_dos IS 'Array of things the AI should do';
COMMENT ON COLUMN clients.brand_donts IS 'Array of things the AI should avoid';
COMMENT ON COLUMN clients.brand_researched_at IS 'When brand research was last performed';
