-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  original_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'In Stock',
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  customer TEXT DEFAULT 'Walk-in',
  status TEXT DEFAULT 'Done',
  payment TEXT DEFAULT 'Paid',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) -- to track who made the sale
);

-- Transaction Items Table (Line items for each order)
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price_at_time DECIMAL(10,2) NOT NULL
);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users to have full access (for now)
-- Note: In a production environment, you might want to restrict this further
CREATE POLICY "Enable read access for authenticated users" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON products FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON transactions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" ON transaction_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON transaction_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON transaction_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON transaction_items FOR DELETE TO authenticated USING (true);

-- Transaction History Table
CREATE TABLE IF NOT EXISTS transaction_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON transaction_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON transaction_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON transaction_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON transaction_history FOR DELETE TO authenticated USING (true);
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

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON expenses FOR DELETE TO authenticated USING (true);