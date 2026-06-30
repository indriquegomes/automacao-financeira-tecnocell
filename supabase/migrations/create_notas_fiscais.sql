CREATE TABLE IF NOT EXISTS notas_fiscais (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  empresa TEXT,
  valor TEXT,
  data_nf TEXT,
  descricao TEXT,
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_chat_id ON notas_fiscais(chat_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_created_at ON notas_fiscais(created_at DESC);
