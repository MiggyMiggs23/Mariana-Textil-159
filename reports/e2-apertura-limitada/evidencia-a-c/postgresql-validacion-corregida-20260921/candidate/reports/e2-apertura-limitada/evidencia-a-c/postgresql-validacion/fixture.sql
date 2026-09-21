-- PARTIAL SYNTHETIC DEPENDENCIES ONLY. NOT E1 production schema.
-- Derived from candidate lib/db/src/schema/{pos,aplicaciones-credito,clientes}.ts.
-- Preserve columns/types/keys used by A+C. Omit actors, sessions, operations,
-- enum domains, permanent E1 integrity and other unrelated columns.
-- No real closure guard is removed or replaced. Positive contract tests run
-- before closure guards are first installed on these synthetic tables.
CREATE TABLE clientes(id integer PRIMARY KEY);
INSERT INTO clientes VALUES (1),(2);
CREATE TABLE movimientos_credito(
 id serial PRIMARY KEY, cliente_id integer NOT NULL REFERENCES clientes(id),
 tipo text NOT NULL, importe numeric(12,2) NOT NULL,
 movimiento_origen_id integer REFERENCES movimientos_credito(id),
 naturaleza text, forma_pago text, cuenta_destino text,
 sitio_origen_id integer, sesion_caja_id integer,
 operacion_productor text, operacion_clave uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((tipo='VENTA_CREDITO' AND importe>0) OR (tipo='ABONO' AND importe<0)
 OR (tipo IN ('REVERSO','AJUSTE') AND importe<>0))
);
CREATE UNIQUE INDEX movimientos_operacion_uq_e1 ON movimientos_credito
 (operacion_productor,operacion_clave) WHERE operacion_productor IS NOT NULL;
CREATE TABLE aplicaciones_credito(
 id serial PRIMARY KEY,
 abono_movimiento_id integer NOT NULL REFERENCES movimientos_credito(id),
 venta_movimiento_id integer NOT NULL REFERENCES movimientos_credito(id),
 importe numeric(12,2) NOT NULL CHECK(importe>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(abono_movimiento_id,venta_movimiento_id)
);
CREATE TABLE cobros_credito_pendientes_e1(
 operacion_productor text NOT NULL, operacion_clave uuid NOT NULL,
 naturaleza text NOT NULL, cliente_id integer NOT NULL REFERENCES clientes(id),
 importe numeric(12,2) NOT NULL CHECK(importe>0 AND importe NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
 medio text NOT NULL, cuenta_destino text NOT NULL, sesion_caja_id integer,
 PRIMARY KEY(operacion_productor,operacion_clave),
 CHECK(operacion_productor='COBRO_PENDIENTE' AND naturaleza='INGRESO_FISICO')
);
INSERT INTO movimientos_credito(cliente_id,tipo,importe) VALUES(1,'VENTA_CREDITO',1000);