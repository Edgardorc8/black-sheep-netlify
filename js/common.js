/*
 * Validaciones, constantes y utilidades compartidas entre data-supabase.js, data-demo.js y los módulos.
 * Extraído de data.js (líneas 26–88) para que producción no dependa del archivo de demo.
 */
(function () {
  const norm = (s) => String(s || "").trim().toLowerCase();

  const common = {
    norm,
    checkUsername(u) {
      if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new Error("Usuario: de 3 a 30 caracteres (letras, números, punto o guion, sin espacios).");
    },
    checkEmail(e) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Escribe un correo válido.");
    },
    checkPassword(p) {
      if (String(p || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
    },
    checkName(n) {
      if (!String(n || "").trim()) throw new Error("Escribe el nombre completo.");
    },
    checkHttpsUrl(u, label = "El enlace") {
      const s = String(u || "").trim();
      if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(s)) throw new Error(`${label} debe empezar con https://`);
      return s;
    },
    status: (u) => (!u.approved ? "pending" : u.disabled ? "disabled" : "active"),
  };

  // Texto original de "Quiénes somos" (el administrador lo puede cambiar en Administración → Contenido).
  common.DEFAULT_ABOUT = {
    title: "Somos las ovejas negras\nde la industria.",
    p1: "Black Sheep nació de un grupo de personas que se cansaron de lo mismo: de trabajar por el sueño de otros, de los ingresos que nunca crecen y de escuchar que “así son las cosas”. Un día decidimos dejar de seguir al rebaño.",
    p2: "Encontramos en la industria de los seguros de vida el lugar perfecto para hacerlo diferente. Aquí el esfuerzo se convierte en ingresos, la disciplina en crecimiento y el trabajo en algo más grande: proteger a las familias y crear riqueza, la de ellas y la nuestra.",
    pillars: [
      { title: "Enfoque", text: "Dejamos de hacer lo que hace todo el mundo. Concentramos nuestra energía en lo que de verdad da resultados." },
      { title: "Crecimiento", text: "Aprendemos todos los días. Cada lección, cada llamada y cada cliente nos hace mejores que ayer." },
      { title: "Riqueza", text: "Construimos libertad financiera para nuestras familias y protegemos el futuro de las familias que nos confían el suyo." },
    ],
    closing: "No buscamos encajar. Buscamos destacar.",
    highlight: "Bienvenido al rebaño.",
  };

  common.cleanAbout = (a) => {
    const t = (s) => String(s ?? "").trim();
    const out = {
      title: t(a.title), p1: t(a.p1), p2: t(a.p2), closing: t(a.closing), highlight: t(a.highlight),
      pillars: [0, 1, 2].map((i) => ({ title: t(a.pillars?.[i]?.title), text: t(a.pillars?.[i]?.text) })),
    };
    if (!out.title) throw new Error("El título no puede quedar vacío.");
    return out;
  };

  // Carriers: convierte la lista inicial (js/seeds/carriers-seed.js) al formato guardado.
  common.carrierFromSeed = (c) => ({
    name: c.name, logo: c.logo || "",
    contacts: (c.contacts || []).map(([label, value]) => ({ label, value })),
    links: (c.links || []).map(([label, url]) => ({ label, url })),
  });

  common.cleanCarrier = (c) => {
    const name = String(c.name || "").trim();
    if (!name) throw new Error("Escribe el nombre del carrier.");
    const links = (c.links || []).filter((l) => l.label && l.url).map((l) => ({ label: l.label.trim(), url: l.url.trim() }));
    links.forEach((l) => common.checkHttpsUrl(l.url, `El enlace "${l.label}"`));
    return {
      name, logo: c.logo || "",
      contacts: (c.contacts || []).filter((x) => x.label && x.value).map((x) => ({ label: x.label.trim(), value: x.value.trim() })),
      links,
    };
  };

  // Módulos del entrenamiento: cada lección pertenece a uno (ej. "El Comienzo").
  common.DEFAULT_MODULE = "El Comienzo";
  // Versión vigente de legal.html. Si cambia, los agentes deben aceptarla otra vez al entrar.
  common.TERMS_VERSION = "2026-10-26";
  common.cleanModule = (m) => String(m || "").trim().replace(/\s+/g, " ") || common.DEFAULT_MODULE;

  window.BSCommon = common;
  window.BSViews = window.BSViews || {};
})();
