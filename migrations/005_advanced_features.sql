-- ============ ADVANCED DATABASE FEATURES ============
-- Data: 2026-05-04
-- Objetivo: Adicionar índices, soft delete, triggers e colunas de validade

-- ============ ÍNDICES PARA PERFORMANCE ============

-- Índices em produtos (busca rápida)
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING GIN(to_tsvector('portuguese', name));

-- Índices em estoque
CREATE INDEX IF NOT EXISTS idx_stock_product_id ON stock(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_warehouse_id ON stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_quantity ON stock(quantity);

-- Índices em vendas (relatórios rápidos)
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_operator_id ON sales(operator_id);
CREATE INDEX IF NOT EXISTS idx_sales_total ON sales(total);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method);

-- Índices em usuários
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email UNIQUE);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Índices em logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON audit_logs(level);

-- ============ COLUNAS DE VALIDADE PARA PERECÍVEIS ============

ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_alert_days INTEGER DEFAULT 7;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN DEFAULT FALSE;

-- Criar índice para produtos próximos do vencimento
CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date) 
WHERE is_perishable = TRUE AND active = TRUE;

-- ============ SOFT DELETE ============

-- Adicionar coluna deleted_at para soft delete
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Criar índices para soft delete
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_discounts_deleted_at ON discounts(deleted_at);

-- ============ TRIGGERS PARA ESTOQUE AUTOMÁTICO ============

-- Trigger: Baixar estoque ao vender
CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE stock 
  SET quantity = quantity - NEW.quantity
  WHERE product_id = NEW.product_id;
  
  -- Log da movimentação
  INSERT INTO stock_movements (product_id, type, quantity, reason, created_at)
  VALUES (NEW.product_id, 'sale', NEW.quantity, 'Venda #' || NEW.sale_id, NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stock_on_sale ON sale_items;
CREATE TRIGGER trigger_update_stock_on_sale
AFTER INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_sale();

-- Trigger: Registrar alterações de preço em auditoria
CREATE OR REPLACE FUNCTION audit_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price != OLD.price THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value, level)
    VALUES (
      COALESCE(current_setting('app.current_user_id')::INTEGER, 0),
      'UPDATE',
      'products',
      NEW.id,
      OLD.price::TEXT,
      NEW.price::TEXT,
      'warning'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_price_change ON products;
CREATE TRIGGER trigger_audit_price_change
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION audit_price_change();

-- Trigger: Alerta de estoque baixo
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity <= NEW.min_stock THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, level, description)
    VALUES (
      NULL,
      'ALERT',
      'stock',
      NEW.product_id,
      'warning',
      'Estoque baixo para produto: ' || NEW.product_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_low_stock ON stock;
CREATE TRIGGER trigger_check_low_stock
AFTER UPDATE ON stock
FOR EACH ROW
EXECUTE FUNCTION check_low_stock();

-- ============ VIEWS PARA RELATÓRIOS ============

-- View: Produtos próximos do vencimento
CREATE OR REPLACE VIEW v_expiring_products AS
SELECT 
  p.id,
  p.name,
  p.barcode,
  p.expiry_date,
  p.expiry_alert_days,
  (p.expiry_date - NOW()) AS days_until_expiry,
  s.quantity,
  p.price
FROM products p
LEFT JOIN stock s ON p.id = s.product_id
WHERE p.is_perishable = TRUE 
  AND p.deleted_at IS NULL
  AND p.expiry_date IS NOT NULL
  AND (p.expiry_date - NOW()) <= (p.expiry_alert_days || ' days')::INTERVAL
ORDER BY p.expiry_date ASC;

-- View: Produtos em estoque crítico
CREATE OR REPLACE VIEW v_critical_stock AS
SELECT 
  p.id,
  p.name,
  p.barcode,
  p.min_stock,
  s.quantity,
  (p.min_stock - s.quantity) AS deficit,
  p.price,
  (p.price * (p.min_stock - s.quantity)) AS reposition_cost
FROM products p
LEFT JOIN stock s ON p.id = s.product_id
WHERE s.quantity <= p.min_stock
  AND p.deleted_at IS NULL
ORDER BY deficit DESC;

-- View: Vendas do dia com operador
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT 
  s.id,
  s.created_at,
  u.name AS operator_name,
  s.total,
  s.discount_amount,
  s.payment_method,
  COUNT(si.id) AS items_count
FROM sales s
LEFT JOIN users u ON s.operator_id = u.id
LEFT JOIN sale_items si ON s.id = si.sale_id
WHERE DATE(s.created_at) = CURRENT_DATE
GROUP BY s.id, u.name
ORDER BY s.created_at DESC;

-- View: Relatório de performance por operador
CREATE OR REPLACE VIEW v_operator_performance AS
SELECT 
  u.id,
  u.name,
  COUNT(s.id) AS total_sales,
  SUM(s.total) AS total_revenue,
  AVG(s.total) AS avg_sale_value,
  SUM(s.discount_amount) AS total_discounts,
  DATE(MAX(s.created_at)) AS last_sale_date
FROM users u
LEFT JOIN sales s ON u.id = s.operator_id AND DATE(s.created_at) = CURRENT_DATE
WHERE u.deleted_at IS NULL AND u.role = 'operator'
GROUP BY u.id, u.name
ORDER BY total_revenue DESC;

-- ============ MATERIALIZED VIEW PARA CACHE ============

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sales_summary AS
SELECT 
  DATE(s.created_at) AS sale_date,
  s.payment_method,
  COUNT(*) AS total_transactions,
  SUM(s.total) AS total_amount,
  SUM(s.discount_amount) AS total_discounts,
  AVG(s.total) AS avg_transaction
FROM sales s
WHERE s.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(s.created_at), s.payment_method;

-- Índice para materialized view
CREATE INDEX IF NOT EXISTS idx_mv_sales_summary_date ON mv_sales_summary(sale_date DESC);

-- ============ FUNCTION PARA REFRESH DE MATERIALIZED VIEW ============

CREATE OR REPLACE FUNCTION refresh_sales_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_summary;
END;
$$ LANGUAGE plpgsql;

-- ============ BACKUP E RETENÇÃO ============

-- Tabela para histórico de backups
CREATE TABLE IF NOT EXISTS backup_history (
  id SERIAL PRIMARY KEY,
  backup_name VARCHAR(255) NOT NULL,
  backup_size BIGINT,
  backup_date TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'success',
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_backup_history_date ON backup_history(backup_date DESC);

-- ============ COMENTÁRIOS PARA DOCUMENTAÇÃO ============

COMMENT ON TABLE products IS 'Tabela de produtos com suporte a perecíveis e validade';
COMMENT ON COLUMN products.is_perishable IS 'Indica se o produto é perecível (frutas, verduras, etc)';
COMMENT ON COLUMN products.expiry_date IS 'Data de vencimento do produto';
COMMENT ON COLUMN products.deleted_at IS 'Soft delete - data de exclusão lógica';

COMMENT ON VIEW v_expiring_products IS 'Produtos próximos do vencimento para alertas';
COMMENT ON VIEW v_critical_stock IS 'Produtos com estoque abaixo do mínimo';
COMMENT ON VIEW v_daily_sales IS 'Vendas do dia com informações do operador';
COMMENT ON VIEW v_operator_performance IS 'Performance de vendas por operador';

-- ============ GRANT PERMISSIONS ============

-- Permissões para aplicação
GRANT SELECT ON v_expiring_products TO greenstore;
GRANT SELECT ON v_critical_stock TO greenstore;
GRANT SELECT ON v_daily_sales TO greenstore;
GRANT SELECT ON v_operator_performance TO greenstore;
GRANT SELECT ON mv_sales_summary TO greenstore;
