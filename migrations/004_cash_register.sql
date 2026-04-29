CREATE TABLE IF NOT EXISTS cash_sessions (
  id SERIAL PRIMARY KEY,
  operator_id INTEGER NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ,
  closing_amount NUMERIC(12,2),
  expected_amount NUMERIC(12,2),
  difference_amount NUMERIC(12,2),
  notes TEXT,
  FOREIGN KEY(operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL,
  performed_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES cash_sessions(id),
  FOREIGN KEY(performed_by) REFERENCES users(id)
);
