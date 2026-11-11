-- Seed basic categories
INSERT OR IGNORE INTO categories (id, title, is_active) VALUES
  ('cat_food', 'خوراکی', 1),
  ('cat_handicraft', 'صنایع دستی', 1),
  ('cat_apparel', 'پوشاک', 1),
  ('cat_home', 'خانه و زندگی', 1),
  ('cat_other', 'سایر', 1);

-- Seed initial admin account
-- Replace phone number or credentials as needed
INSERT OR IGNORE INTO users (id, phone, display_name, city_code, city_name, role, status, created_at)
VALUES (
  'usr_admin_initial',
  '09120000000',
  'مدیر اصلی بازارچه',
  'THR',
  'تهران',
  'admin',
  'active',
  CURRENT_TIMESTAMP
);

-- Seed initial invitation token hash (SHA-256 of initial setup secret)
INSERT OR IGNORE INTO invitations (id, token_hash, invited_by, expires_at, created_at)
VALUES (
  'inv_initial_admin_setup',
  'ea225b318b291f79d01b70019c975b92d51151c44ef95b92de6eb9f3dcbd3626',
  'usr_admin_initial',
  '2030-01-01 00:00:00',
  CURRENT_TIMESTAMP
);
