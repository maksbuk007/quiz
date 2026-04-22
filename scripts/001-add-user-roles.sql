-- Add role field to users table
-- Roles: 'creator' (platform owner), 'admin' (can create/manage own games), 'user' (default)

-- Check if the role column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
END $$;

-- Set the platform creator
UPDATE users 
SET role = 'creator' 
WHERE email = 'bukatinmaksimilian6@gmail.com';

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add RLS policies for role-based access
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read games
DROP POLICY IF EXISTS "Games are viewable by everyone" ON games;
CREATE POLICY "Games are viewable by everyone" ON games
  FOR SELECT USING (true);

-- Policy: Creator can do everything
DROP POLICY IF EXISTS "Creator can do everything" ON games;
CREATE POLICY "Creator can do everything" ON games
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'creator'
    )
  );

-- Policy: Admins can insert their own games
DROP POLICY IF EXISTS "Admins can create games" ON games;
CREATE POLICY "Admins can create games" ON games
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'creator')
    )
  );

-- Policy: Admins can update/delete their own games
DROP POLICY IF EXISTS "Admins can manage own games" ON games;
CREATE POLICY "Admins can manage own games" ON games
  FOR UPDATE USING (
    "createdBy" = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'creator'
    )
  );

DROP POLICY IF EXISTS "Admins can delete own games" ON games;
CREATE POLICY "Admins can delete own games" ON games
  FOR DELETE USING (
    "createdBy" = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'creator'
    )
  );
