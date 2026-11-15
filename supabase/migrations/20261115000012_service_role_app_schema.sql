-- =====================================================================
-- Navidad en Familia — 0012: la clave de servicio puede usar el esquema app
-- Las Edge Functions escriben con el rol service_role. Los triggers de
-- participants y families llaman a app.normalize_name() y
-- app.is_valid_person_name() con los permisos de quien inserta, y
-- service_role no tenía acceso al esquema app: create-member fallaba con
-- "permission denied for schema app" (INTERNAL_ERROR).
-- =====================================================================
grant usage on schema app to service_role;
grant execute on all functions in schema app to service_role;
