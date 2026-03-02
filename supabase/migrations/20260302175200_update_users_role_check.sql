-- Migration to update the role check constraint on the users table

DO $$ 
DECLARE 
    constraint_name TEXT;
BEGIN
    -- Find the constraint name for the 'role' check on table 'users'
    SELECT conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE contype = 'c' 
      AND n.nspname = 'public'
      AND conrelid = 'users'::regclass
      AND pg_get_constraintdef(c.oid) LIKE '%role%';

    -- Drop the old constraint if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || constraint_name;
    END IF;

    -- Add the new constraint including 'atleta'
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'gestor', 'atleta','financeiro','caixa','instrutor'));
END $$;
