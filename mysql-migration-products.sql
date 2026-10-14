-- =========================================================
-- MIGRATION: shop product/menu catalog (products table)
-- Run this in phpMyAdmin / MySQL CLI on EXISTING databases.
-- (Fresh installs already include products via mysql-schema.sql)
-- Safe to run multiple times (IF NOT EXISTS).
-- =========================================================

USE mi_advantage;

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY,
    shop_id VARCHAR(100),
    name TEXT NOT NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_products_shop_id ON products(shop_id);
