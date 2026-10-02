-- Explicitly applied migration; never a startup initializer.
-- Only the E5 print INSERT lane changes. All financial guards remain byte-identical.
DO $migration$
DECLARE
  source text;
  original text;
  patched text;
  known_hash text;
  branch text := $branch$
  -- RECEIPT_MATRIX_PRINT_V1: documentary INSERT, not monetary authority.
  IF TG_TABLE_NAME='e5_impresiones' THEN
    IF j->>'content' IS NULL OR (j->>'content')::jsonb->>'action' IS DISTINCT FROM 'IMPRIMIR'
      OR (j->>'content')::jsonb->>'docId' IS DISTINCT FROM j->>'documento_id'
      OR (j->>'content')::jsonb#>>'{input,claveOperacion}' IS DISTINCT FROM j->>'clave'
      OR (j->>'content')::jsonb#>>'{input,motivo}' IS DISTINCT FROM j->>'motivo'
    THEN RAISE EXCEPTION 'E5: intención documental de impresión inválida' USING ERRCODE='42501'; END IF;
    PERFORM 1
    FROM public.usuarios u
    JOIN public.e5_documentos d ON d.id=(j->>'documento_id')::uuid
    JOIN public.e5_cobros c ON c.id=d.cobro_id
    LEFT JOIN public.permisos_usuario pu ON pu.usuario_id=u.id AND pu.modulo='recibos_abonos'
    LEFT JOIN public.permisos_rol pr ON pr.rol=u.rol AND pr.modulo='recibos_abonos'
    LEFT JOIN public.permisos_ubicacion pl ON pl.ubicacion_id=u.ubicacion_id AND pl.rol=u.rol AND pl.modulo='recibos_abonos'
    WHERE u.id=(j->>'actor_id')::integer AND u.activo
      AND c.id::text=(j->>'content')::jsonb->>'cobroId'
      AND (u.rol::text='ADMIN' OR (
        u.ubicacion_id IS NOT NULL AND c.ubicacion_id=u.ubicacion_id
        AND d.tipo='RECIBO' AND c.detail->>'reciboId'=d.id::text
        AND COALESCE(pu.puede_ver,
          CASE WHEN pr.updated_por IS NOT NULL THEN pr.puede_ver
            ELSE COALESCE(pl.puede_ver,pr.puede_ver,false) END,false)
        AND EXISTS (SELECT 1 FROM public.e5_operaciones o
          WHERE o.cobro_id=c.id AND o.accion='RECIBIR'
            AND o.content::jsonb->'input'->>'entrada'='CAJA')
      ))
    FOR SHARE OF u;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E5: permiso efectivo o alcance de recibo no autorizado' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
$branch$;
BEGIN
  SELECT p.prosrc,pg_get_functiondef(p.oid) INTO source,original
  FROM pg_proc p WHERE p.oid=to_regprocedure('public.e5_insert_authority()')
    AND NOT p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog']
    AND p.prorettype='trigger'::regtype;
  IF source IS NULL THEN RAISE EXCEPTION 'Receipt guard: missing or changed function configuration'; END IF;
  IF position('RECEIPT_MATRIX_PRINT_V1' in source)>0 THEN
    IF position(branch in source)=0 THEN RAISE EXCEPTION 'Receipt guard: installed branch drift'; END IF;
    source:=replace(source,branch,'');
  END IF;
  known_hash:=encode(sha256(convert_to(source,'UTF8')),'hex');
  -- E5 original source hash; the E11 extension is validated by its retained source hash.
  IF known_hash<>'124271a0007f135354a031abc7ee33ec74c6e6eafb255dd8341a9525c904e6f5' THEN
    IF to_regclass('public.e11_e5_definiciones') IS NULL THEN
      RAISE EXCEPTION 'Receipt guard: unknown financial guard body';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.e11_e5_definiciones
      WHERE firma='public.e5_insert_authority()' AND hash_instalado=known_hash)
    THEN RAISE EXCEPTION 'Receipt guard: financial guard hash drift'; END IF;
  END IF;
  IF position('RECEIPT_MATRIX_PRINT_V1' in original)>0 THEN RETURN; END IF;
  IF (length(source)-length(replace(source,E'BEGIN\n','')))<>length(E'BEGIN\n') THEN
    RAISE EXCEPTION 'Receipt guard: ambiguous function BEGIN';
  END IF;
  patched:=replace(source,E'BEGIN\n',E'BEGIN\n'||branch);
  IF replace(patched,branch,'')<>source THEN RAISE EXCEPTION 'Receipt guard: unrelated body change'; END IF;
  EXECUTE replace(original,source,patched);
END
$migration$;