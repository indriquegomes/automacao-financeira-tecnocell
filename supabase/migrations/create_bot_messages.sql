CREATE TABLE IF NOT EXISTS bot_messages (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_messages_chat_id ON bot_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_created_at ON bot_messages(created_at DESC);
