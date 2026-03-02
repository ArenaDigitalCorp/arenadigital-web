-- Migration to remove 'esportes_preferido' column from 'atleta' table
-- This data is now managed in the 'atleta_esportes' table.

ALTER TABLE atleta DROP COLUMN IF EXISTS esportes_preferido;
