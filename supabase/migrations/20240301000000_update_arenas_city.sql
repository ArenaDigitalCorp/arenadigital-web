-- Add municipio_id to arenas table
ALTER TABLE public.arenas ADD COLUMN municipio_id integer;
ALTER TABLE public.arenas ADD CONSTRAINT arenas_municipio_id_fkey FOREIGN KEY (municipio_id) REFERENCES public.municipios (codigo_ibge);

-- Drop city and state columns from arenas table
ALTER TABLE public.arenas DROP COLUMN city;
ALTER TABLE public.arenas DROP COLUMN state;
