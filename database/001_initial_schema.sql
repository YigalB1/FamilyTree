CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer',
  created_at    TIMESTAMP DEFAULT NOW(),
  last_login    TIMESTAMP
);

CREATE TABLE import_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename         TEXT,
  source_name      TEXT,
  imported_at      TIMESTAMP DEFAULT NOW(),
  imported_by      UUID REFERENCES users(id),
  persons_added    INTEGER DEFAULT 0,
  persons_updated  INTEGER DEFAULT 0,
  persons_skipped  INTEGER DEFAULT 0,
  conflicts_found  INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'pending'
);

CREATE TABLE persons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geni_id       TEXT UNIQUE,
  first_name_he TEXT,
  last_name_he  TEXT,
  first_name_en TEXT,
  last_name_en  TEXT,
  sex           TEXT,
  birth_date    TEXT,
  birth_place   TEXT,
  death_date    TEXT,
  death_place   TEXT,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  created_by    UUID REFERENCES users(id),
  source_id     UUID REFERENCES import_sessions(id)
);

CREATE TABLE families (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geni_id        TEXT UNIQUE,
  husband_id     UUID REFERENCES persons(id),
  wife_id        UUID REFERENCES persons(id),
  marriage_date  TEXT,
  marriage_place TEXT,
  divorced       BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  source_id      UUID REFERENCES import_sessions(id)
);

CREATE TABLE family_children (
  family_id UUID REFERENCES families(id),
  child_id  UUID REFERENCES persons(id),
  PRIMARY KEY (family_id, child_id)
);

CREATE TABLE import_conflicts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID REFERENCES import_sessions(id),
  person_id      UUID REFERENCES persons(id),
  field          TEXT,
  existing_value TEXT,
  new_value      TEXT,
  resolved       BOOLEAN DEFAULT FALSE,
  resolution     TEXT,
  resolved_by    UUID REFERENCES users(id),
  resolved_at    TIMESTAMP
);

CREATE TABLE change_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_at  TIMESTAMP DEFAULT NOW(),
  changed_by  UUID REFERENCES users(id),
  source      TEXT DEFAULT 'manual',
  session_id  UUID REFERENCES import_sessions(id)
);