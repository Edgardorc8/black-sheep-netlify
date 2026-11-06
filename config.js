/*
 * Configuración del portal.
 * Mientras SUPABASE_URL esté vacío, el portal funciona en MODO DEMO (datos en el navegador).
 * Pega aquí la "Project URL" y la llave "anon / publishable" de Supabase → Project Settings → API.
 * La llave anon es pública (va en la página). NUNCA pegues aquí la llave "service_role" / "secret".
 */
window.BS_CONFIG = {
  SUPABASE_URL: "https://vnuirixhrnwhkczbnbnn.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_0GlhDdwbZ4HWY-NvPhhvLg_0KDpLLgo",
  // Dominio interno solo para agentes que el administrador crea SIN correo. No se envían correos ahí.
  EMAIL_DOMAIN: "agentes.blacksheep.app",
};
