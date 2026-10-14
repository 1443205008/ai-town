CREATE TABLE IF NOT EXISTS worlds (id text PRIMARY KEY, version integer NOT NULL CHECK(version>=0), state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS world_events (world_id text NOT NULL REFERENCES worlds(id), seq bigint NOT NULL, data jsonb NOT NULL, PRIMARY KEY(world_id,seq));
CREATE TABLE IF NOT EXISTS simulation_commands (world_id text NOT NULL REFERENCES worlds(id), key text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(world_id,key));
CREATE TABLE IF NOT EXISTS world_snapshots (id text PRIMARY KEY, world_id text NOT NULL REFERENCES worlds(id), version integer NOT NULL, state jsonb NOT NULL, checksum text NOT NULL);
CREATE INDEX IF NOT EXISTS snapshot_world_version ON world_snapshots(world_id,version DESC);
