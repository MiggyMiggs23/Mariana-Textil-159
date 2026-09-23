-- SOLO base local desechable tarea1_test_*: soporte mínimo para integración.
CREATE TABLE usuarios (id integer PRIMARY KEY, ubicacion_id integer);
CREATE TABLE rollos (id integer PRIMARY KEY, ubicacion_id integer NOT NULL);
CREATE TABLE auditoria (id serial PRIMARY KEY, usuario_id integer, accion text,
  entidad text, entidad_id text, datos_despues jsonb, ip text);
CREATE TABLE permisos_usuario (id serial PRIMARY KEY, usuario_id integer,
  modulo text, puede_ver boolean, puede_crear boolean, puede_editar boolean,
  puede_autorizar boolean, updated_at timestamptz DEFAULT now(), updated_por integer);
CREATE TABLE permisos_rol (id serial PRIMARY KEY, rol text, modulo text,
  puede_ver boolean, puede_crear boolean, puede_editar boolean,
  puede_autorizar boolean, updated_at timestamptz DEFAULT now(), updated_por integer);
CREATE TABLE permisos_ubicacion (id serial PRIMARY KEY, ubicacion_id integer,
  rol text, modulo text, puede_ver boolean, puede_crear boolean, puede_editar boolean,
  puede_autorizar boolean, updated_at timestamptz DEFAULT now(), updated_por integer);