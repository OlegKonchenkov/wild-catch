-- Add short manual fallback code to qr_codes (max 6 chars, uppercase alphanumeric)
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS manual_code text;

-- Populate existing rows with a unique 6-char code
UPDATE qr_codes
SET manual_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
WHERE manual_code IS NULL;

-- Enforce uniqueness and max length
CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_manual_code_unique ON qr_codes (manual_code);
ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_manual_code_length CHECK (char_length(manual_code) <= 6);
