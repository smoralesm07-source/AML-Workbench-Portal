-- ATLAS AML 0.64.0 · corrección de tipo jurídico sustentada por RES
-- Conserva la fuente RADAR_OSFL en profile.fuentes; sólo corrige el tipo/rol.

update public.aml_entities e
set entity_type='Persona jurídica',
    profile=jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(coalesce(e.profile,'{}'::jsonb),'{tipo_entidad}',to_jsonb('LEGAL_ENTITY'::text),true),
            '{tipo_entidad_es}',to_jsonb('Persona jurídica'::text),true),
          '{roles}',coalesce((select jsonb_agg(x) from jsonb_array_elements_text(coalesce(e.profile->'roles','[]'::jsonb)) x where x<>'OSFL'),'[]'::jsonb),true),
        '{roles_es}',coalesce((select jsonb_agg(x) from jsonb_array_elements_text(coalesce(e.profile->'roles_es','[]'::jsonb)) x where x<>'OSFL'),'[]'::jsonb),true),
      '{contexto,res_classification_override}',jsonb_build_object(
        'effective_type','Persona jurídica',
        'basis','RES_RUT_EXACTO_FORMA_SOCIETARIA',
        'applied_at',now()
      ),true),
    updated_at=now()
from public.aml_entity_classification_override_v0620 o
where o.entity_id=e.entity_id
  and e.entity_type='OSFL';

-- Control esperado al primer corte aplicado: 303 overrides, todos corregidos,
-- y los 303 conservan RADAR_OSFL como procedencia observable.
select count(*) as overrides,
       count(*) filter(where e.entity_type='Persona jurídica') as corrected_base,
       count(*) filter(where e.profile->'fuentes' ? 'RADAR_OSFL') as provenance_preserved
from public.aml_entity_classification_override_v0620 o
join public.aml_entities e using(entity_id);
