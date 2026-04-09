-- Add original_price_at_time column to the transaction_items table
ALTER TABLE transaction_items 
ADD COLUMN IF NOT EXISTS original_price_at_time numeric;

-- Backfill original_price_at_time by pulling original_price from the products table for existing records
UPDATE transaction_items ti
SET original_price_at_time = p.original_price
FROM products p
WHERE ti.product_id = p.id AND ti.original_price_at_time IS NULL;

-- (Optional) If we want to make it not null in the future or add a default.
-- For now we just add it and backfill.
