-- Add follow_up_templates column to workflows table
-- This stores custom follow-up message templates as JSON array

ALTER TABLE workflows
ADD COLUMN IF NOT EXISTS follow_up_templates JSONB DEFAULT '[]'::JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN workflows.follow_up_templates IS
'JSON array of follow-up message templates. Each item has: {message: string, delay_hours: number}';
