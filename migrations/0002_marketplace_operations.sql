-- Bazaarak operational features. Safe to apply after 0001_initial.sql.
PRAGMA foreign_keys = ON;
CREATE INDEX IF NOT EXISTS idx_users_status_role_created ON users(status, role, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created ON orders(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_seller_created ON orders(seller_id, created_at);
CREATE INDEX IF NOT EXISTS idx_products_status_created ON products(status, created_at);
INSERT OR IGNORE INTO categories(id,title,is_active) VALUES
  ('cat-food','خوراکی',1),
  ('cat-handmade','صنایع دستی',1),
  ('cat-clothing','پوشاک',1),
  ('cat-home','خانه و زندگی',1),
  ('cat-other','سایر',1);
