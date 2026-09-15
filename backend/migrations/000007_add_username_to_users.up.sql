ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE NOT NULL DEFAULT '';

CREATE UNIQUE INDEX idx_users_username ON users(username);
