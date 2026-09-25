-- PREPARED ONLY. Run ONLY after explicit approval on the intended database.
-- This installs protected reset-use evidence; it deletes no application data.
-- The first authorized reset also installs this exact evidence transactionally.
BEGIN;
CREATE TABLE IF NOT EXISTS public.test_reset_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id integer NOT NULL REFERENCES public.usuarios(id),
  actor_usuario text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  protected_customers boolean NOT NULL,
  cleared_tables jsonb NOT NULL
);
CREATE OR REPLACE FUNCTION public.test_reset_history_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El historial de reinicios no admite borrado ni modificación';
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.test_reset_history'::regclass AND tgname='test_reset_history_immutable'
  ) THEN
    CREATE TRIGGER test_reset_history_immutable
      BEFORE UPDATE OR DELETE OR TRUNCATE ON public.test_reset_history
      FOR EACH STATEMENT EXECUTE FUNCTION public.test_reset_history_immutable();
  END IF;
END $$;
COMMIT;