CREATE TABLE IF NOT EXISTS finance_accounts (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  settled_at TIMESTAMPTZ,
  settled_by INTEGER,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(settled_by) REFERENCES users(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);
