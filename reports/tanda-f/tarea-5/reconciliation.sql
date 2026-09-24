with pairs as (
 select producto_id,ubicacion_id from movimientos where producto_id=$1
 union select producto_id,ubicacion_id from rollos where producto_id=$1
 union select producto_id,ubicacion_id from existencias where producto_id=$1)
 select p.producto_id,p.ubicacion_id,pr.unidad,
 coalesce((select sum(cantidad_actual) from rollos r where r.producto_id=p.producto_id and r.ubicacion_id=p.ubicacion_id and estado='DISPONIBLE'),0)::text available_roll_sum,
 coalesce((select sum(cantidad_actual) from rollos r where r.producto_id=p.producto_id and r.ubicacion_id=p.ubicacion_id and estado in ('DISPONIBLE','EN_TRANSITO')),0)::text inventory_roll_sum,
 coalesce((select sum(cantidad) from movimientos m where m.producto_id=p.producto_id and m.ubicacion_id=p.ubicacion_id),0)::text signed_ledger,
 (select cantidad_total::text from existencias e where e.producto_id=p.producto_id and e.ubicacion_id=p.ubicacion_id) cache
 from pairs p join productos pr on pr.id=p.producto_id order by p.ubicacion_id