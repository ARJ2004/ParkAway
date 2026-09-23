-- Its own migration, first, alone (05-sprint-2-detailed-plan.md §2.3) — the
-- only migration that can fail for environmental reasons (extension not
-- installed at the OS level / no superuser) rather than logical ones.
CREATE EXTENSION IF NOT EXISTS postgis;
