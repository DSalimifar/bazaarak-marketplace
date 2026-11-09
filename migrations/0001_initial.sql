PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  city_code TEXT NOT NULL,
  city_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('admin','seller','buyer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','blocked')),
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(invited_by) REFERENCES users(id),
  FOREIGN KEY(used_by) REFERENCES users(id)
);

CREATE TABLE seller_payment_methods (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  method_type TEXT NOT NULL CHECK (method_type IN ('card','account','iban')),
  holder_name TEXT NOT NULL,
  value_encrypted TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(seller_id) REFERENCES users(id)
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  category_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_irr INTEGER NOT NULL CHECK (price_irr > 0),
  stock INTEGER NOT NULL DEFAULT 1 CHECK (stock >= 0),
  city_code TEXT NOT NULL,
  city_name TEXT NOT NULL,
  image_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(seller_id) REFERENCES users(id),
  FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE INDEX idx_products_status_city ON products(status, city_code);
CREATE INDEX idx_products_seller ON products(seller_id);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment','receipt_submitted','payment_confirmed','ready_for_pickup','completed','cancelled','disputed')),
  subtotal_irr INTEGER NOT NULL CHECK (subtotal_irr > 0),
  buyer_note TEXT NOT NULL DEFAULT '',
  pickup_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(buyer_id) REFERENCES users(id),
  FOREIGN KEY(seller_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  title_snapshot TEXT NOT NULL,
  unit_price_irr INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE payment_receipts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  r2_object_key TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','confirmed','rejected')),
  seller_comment TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT,
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(submitted_by) REFERENCES users(id)
);

CREATE TABLE order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(actor_id) REFERENCES users(id)
);
