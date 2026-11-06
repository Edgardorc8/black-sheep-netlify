/*
 * Capa de datos — MODO DEMO.
 * Guarda todo en el navegador (localStorage) para poder probar el portal sin servidor.
 * En producción data-supabase.js reemplaza a BSData con las mismas funciones, sin tocar app.js.
 */
(function () {
  const KEY = "bs_academy_db_v1";

  // Cuenta inicial de administrador para la demo. Cámbiala desde el panel al entrar.
  const SEED_ADMIN = { username: "admin", email: "admin@blacksheep.demo", password: "BlackSheep#2026", name: "Administrador" };

  // Videos de prueba locales solo para probar el reproductor.
  const SEED_VIDEOS = [
    { title: "Bienvenida a Black Sheep", desc: "Quiénes somos, nuestra historia y cómo está organizada la agencia.", url: "assets/demo/leccion-1.mp4" },
    { title: "Cultura Black Sheep", desc: "Nuestros valores, la disciplina y lo que esperamos de cada agente.", url: "assets/demo/leccion-2.mp4" },
    { title: "Fundamentos del IUL", desc: "Conceptos clave del Indexed Universal Life explicados para el cliente.", url: "assets/demo/leccion-3.mp4" },
    { title: "Manejo de objeciones", desc: "Los seis pasos para responder la objeción real del cliente.", url: "assets/demo/leccion-4.mp4" },
  ];

  // Agente de prueba para ver el portal como lo ve un agente (solo en la demo).
  const SEED_AGENT = { username: "agente.demo", email: "agente@blacksheep.demo", password: "Agente#2026", name: "Carlos Méndez" };

  const DEFAULT_SETTINGS = { allowSignup: true, requireApproval: true };
  const RESET_MINUTES = 60;

  // ---------- Validaciones compartidas (también las usa data-supabase.js) ----------
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
  // Carriers: convierte la lista inicial (modules/carriers-seed.js) al formato guardado.
  common.carrierFromSeed = (c) => ({
    name: c.name, logo: c.logo || "",
    contacts: (c.contacts || []).map(([label, value]) => ({ label, value })),
    links: (c.links || []).map(([label, url]) => ({ label, url })),
  });
  common.cleanCarrier = (c) => {
    const name = String(c.name || "").trim();
    if (!name) throw new Error("Escribe el nombre del carrier.");
    const links = (c.links || []).filter((l) => l.label && l.url).map((l) => ({ label: l.label.trim(), url: l.url.trim() }));
    links.forEach((l) => { if (!/^https?:\/\//i.test(l.url)) throw new Error(`El enlace "${l.label}" debe empezar con https://`); });
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

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  async function hash(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("bs::" + text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }

  async function db() {
    let d = load();
    if (!d) {
      d = {
        users: [{ id: uid(), username: SEED_ADMIN.username, email: SEED_ADMIN.email, name: SEED_ADMIN.name, role: "admin", approved: true, passHash: await hash(SEED_ADMIN.password), createdAt: Date.now() }],
        videos: SEED_VIDEOS.map((v) => ({ id: uid(), ...v })),
        progress: {},
      };
    }
    // Actualiza demos guardadas con versiones anteriores del portal.
    const v2 = d.videos.find((v) => v.title === "Mentalidad de oveja negra");
    if (v2) { v2.title = SEED_VIDEOS[1].title; v2.desc = SEED_VIDEOS[1].desc; }
    d.videos.forEach((v) => { if (!v.module) v.module = common.DEFAULT_MODULE; });
    if (d.demoAgents) {
      const demoIds = d.users.filter((u) => u.demo).map((u) => u.id);
      d.users = d.users.filter((u) => !u.demo);
      demoIds.forEach((id) => delete d.progress[id]);
      delete d.demoAgents;
    }
    d.users.forEach((u) => {
      if (u.approved === undefined) u.approved = true;
      if (u.email === undefined) u.email = u.username === SEED_ADMIN.username ? SEED_ADMIN.email : "";
    });
    if (!d.seedAgent) {
      if (!d.users.some((u) => u.username === SEED_AGENT.username)) {
        const id = uid();
        d.users.push({ id, username: SEED_AGENT.username, email: SEED_AGENT.email, name: SEED_AGENT.name, role: "agent", approved: true, passHash: await hash(SEED_AGENT.password), createdAt: Date.now() });
        d.progress[id] = { [d.videos[0].id]: { max: 20, duration: 20, done: true, doneAt: Date.now() } };
      }
      d.seedAgent = true;
    }
    if (!d.modelCalls) {
      // Una llamada de ejemplo con audio de prueba (sin voz) para ver cómo funciona la sección.
      d.modelCalls = [{
        id: uid(), createdAt: Date.now(), srcUrl: "assets/demo/llamada-demo.mp3", blobId: null,
        title: "Ejemplo: cita agendada para presentación IUL", agent: "Ejemplo", category: "Primera llamada", result: "Cita agendada",
        desc: "Audio de prueba sin voz. Sube tus llamadas reales desde el botón \"Subir llamada\".",
        moments: [{ t: 12, label: "Saludo y rompehielos" }, { t: 48, label: "Preguntas de calificación" }, { t: 95, label: "Objeción: \"déjeme pensarlo\"" }, { t: 130, label: "Cierre de la cita" }],
      }];
    }
    d.settings ||= { ...DEFAULT_SETTINGS };
    d.resets ||= {};
    save(d);
    return d;
  }

  // ---------- Archivos grandes de la demo (audios) en IndexedDB ----------
  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open("bs_blobs", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const idbTx = async (mode, fn) => {
    const dbh = await idb();
    return new Promise((res, rej) => {
      const tx = dbh.transaction("files", mode);
      const req = fn(tx.objectStore("files"));
      tx.oncomplete = () => res(req?.result);
      tx.onerror = () => rej(tx.error || new Error("No se pudo guardar el archivo en este navegador."));
    });
  };
  const blobPut = (id, file) => idbTx("readwrite", (s) => s.put(file, id));
  const blobDel = (id) => idbTx("readwrite", (s) => s.delete(id));
  const blobUrls = {};
  async function blobUrl(id) {
    if (blobUrls[id]) return blobUrls[id];
    const blob = await idbTx("readonly", (s) => s.get(id));
    return blob ? (blobUrls[id] = URL.createObjectURL(blob)) : "";
  }

  // ---------- Roleplay con IA real en la computadora (carpeta roleplay-local) ----------
  // Si el servidor local está encendido, la demo usa Claude y la voz humana; si no, frases de ejemplo.
  const LOCAL_AI = "http://localhost:8787";
  let localAiOk = null;
  async function localAi() {
    if (localAiOk !== null) return localAiOk;
    try {
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 1200);
      localAiOk = (await fetch(LOCAL_AI, { signal: ctl.signal })).ok;
    } catch { localAiOk = false; }
    setTimeout(() => { localAiOk = null; }, 15000);   // vuelve a revisar en un rato
    return localAiOk;
  }
  async function localCall(body) {
    const r = await fetch(LOCAL_AI, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (body.action === "tts") return r.status === 200 ? r.blob() : null;
    const out = await r.json();
    if (!r.ok) throw new Error(out.error || "El servidor local del roleplay no respondió.");
    return out;
  }

  const publicUser = ({ passHash, ...u }) => u;
  const findUser = (d, id) => {
    const u = d.users.find((x) => x.id === id);
    if (!u) throw new Error("Ese agente ya no existe.");
    return u;
  };
  function assertUnique(d, { username, email }, exceptId) {
    if (d.users.some((u) => u.id !== exceptId && u.username === username)) throw new Error("Ese usuario ya está en uso.");
    if (email && d.users.some((u) => u.id !== exceptId && u.email === email)) throw new Error("Ese correo ya está registrado.");
  }

  window.BSData = {
    mode: "demo",

    // ----- Sesión -----
    async login(identifier, password) {
      const d = await db();
      const id = norm(identifier);
      const u = d.users.find((x) => x.username === id || (x.email && x.email === id));
      if (!u || u.passHash !== (await hash(password))) throw new Error("Usuario o contraseña incorrectos.");
      if (!u.approved) throw new Error("Tu cuenta está pendiente de aprobación. Podrás entrar cuando tu manager la apruebe.");
      if (u.disabled) throw new Error("Tu acceso está desactivado. Habla con tu manager.");
      return publicUser(u);
    },
    // Acceso rápido de la demo: entra como administrador o como agente de prueba.
    async demoLogin(role) {
      const seed = role === "admin" ? SEED_ADMIN : SEED_AGENT;
      return this.login(seed.username, seed.password);
    },
    async getUser(id) {
      const u = (await db()).users.find((x) => x.id === id);
      return u && u.approved && !u.disabled ? publicUser(u) : null;
    },
    async acceptTerms(id) {
      const d = await db();
      const u = findUser(d, id);
      Object.assign(u, { termsVersion: common.TERMS_VERSION, termsAcceptedAt: new Date().toISOString() });
      save(d);
      return publicUser(u);
    },

    // ----- Registro y recuperación -----
    async getSettings() { return (await db()).settings; },
    async getAbout() { return (await db()).about || common.DEFAULT_ABOUT; },
    async saveAbout(a) {
      const d = await db();
      d.about = a ? common.cleanAbout(a) : null;   // null = volver al texto original
      save(d);
    },
    async saveSettings(s) {
      const d = await db();
      d.settings = { ...d.settings, ...s };
      save(d);
    },
    async signup({ name, email, username, password, terms }) {
      const d = await db();
      if (!d.settings.allowSignup) throw new Error("El registro está cerrado. Pide a tu manager que te cree la cuenta.");
      if (!terms) throw new Error("Debes aceptar los Términos de uso y la Política de privacidad.");
      username = norm(username); email = norm(email);
      common.checkName(name); common.checkEmail(email); common.checkUsername(username); common.checkPassword(password);
      assertUnique(d, { username, email });
      const approved = !d.settings.requireApproval;
      d.users.push({ id: uid(), username, email, name: name.trim(), role: "agent", approved, passHash: await hash(password), createdAt: Date.now(),
        termsVersion: common.TERMS_VERSION, termsAcceptedAt: new Date().toISOString() });
      save(d);
      return { status: approved ? "active" : "pending" };
    },
    async requestPasswordReset(email) {
      const d = await db();
      email = norm(email);
      common.checkEmail(email);
      const u = d.users.find((x) => x.email === email);
      // En la demo no se envían correos: devolvemos el enlace para poder probar el flujo.
      if (!u) return {};
      const token = uid() + uid();
      d.resets[token] = { userId: u.id, exp: Date.now() + RESET_MINUTES * 60000 };
      save(d);
      return { demoLink: `${location.pathname}?reset=${token}` };
    },
    async completePasswordReset(token, password) {
      common.checkPassword(password);
      const d = await db();
      const r = d.resets[token];
      if (!r || r.exp < Date.now()) throw new Error("El enlace ya venció o no es válido. Pide uno nuevo.");
      findUser(d, r.userId).passHash = await hash(password);
      delete d.resets[token];
      save(d);
    },

    // ----- Agentes (solo administrador) -----
    async listUsers() { return (await db()).users.map(publicUser); },
    async createUser({ name, email, username, password, role = "agent" }) {
      const d = await db();
      username = norm(username); email = norm(email);
      common.checkName(name); common.checkUsername(username); common.checkPassword(password);
      if (email) common.checkEmail(email);
      assertUnique(d, { username, email });
      d.users.push({ id: uid(), username, email, name: name.trim(), role, approved: true, passHash: await hash(password), createdAt: Date.now() });
      save(d);
    },
    async updateUser(id, { name, email, username, role }) {
      const d = await db();
      const u = findUser(d, id);
      username = norm(username); email = norm(email);
      common.checkName(name); common.checkUsername(username);
      if (email) common.checkEmail(email);
      assertUnique(d, { username, email }, id);
      Object.assign(u, { name: name.trim(), email, username, role: role === "admin" ? "admin" : "agent" });
      save(d);
    },
    async setPassword(id, password) {
      common.checkPassword(password);
      const d = await db();
      findUser(d, id).passHash = await hash(password);
      save(d);
    },
    async approveUser(id) {
      const d = await db();
      findUser(d, id).approved = true;
      save(d);
    },
    async toggleUser(id) {
      const d = await db();
      const u = findUser(d, id);
      u.disabled = !u.disabled;
      save(d);
    },
    async deleteUser(id) {
      const d = await db();
      d.users = d.users.filter((u) => u.id !== id);
      delete d.progress[id];
      save(d);
    },
    async resetProgress(id) {
      const d = await db();
      delete d.progress[id];
      save(d);
    },
    async setLessonDone(userId, videoId, done) {
      const d = await db();
      const p = (d.progress[userId] ||= {});
      if (done) p[videoId] = { ...(p[videoId] || {}), max: p[videoId]?.duration || p[videoId]?.max || 0, done: true, doneAt: Date.now() };
      else delete p[videoId];
      save(d);
    },

    // ----- Lecciones -----
    async listVideos() { return (await db()).videos; },
    async addVideo({ title, desc, module, url, file }) {
      if (file) throw new Error("En modo demo solo se pueden agregar enlaces. Subir archivos funciona al conectar Supabase.");
      if (!String(title || "").trim() || !String(url || "").trim()) throw new Error("Título y enlace del video son obligatorios.");
      const d = await db();
      d.videos.push({ id: uid(), title: title.trim(), desc: String(desc || "").trim(), module: common.cleanModule(module), url: url.trim() });
      save(d);
    },
    async updateVideo(id, { title, desc, module, url, file }) {
      if (file) throw new Error("En modo demo solo se pueden usar enlaces. Subir archivos funciona al conectar Supabase.");
      if (!String(title || "").trim()) throw new Error("El título es obligatorio.");
      const d = await db();
      const v = d.videos.find((x) => x.id === id);
      Object.assign(v, { title: title.trim(), desc: String(desc || "").trim(), module: common.cleanModule(module) });
      if (String(url || "").trim()) v.url = url.trim();
      save(d);
    },
    async moveVideo(id, dir) {
      const d = await db();
      const i = d.videos.findIndex((v) => v.id === id), j = i + dir;
      if (j < 0 || j >= d.videos.length) return;
      [d.videos[i], d.videos[j]] = [d.videos[j], d.videos[i]];
      save(d);
    },
    async deleteVideo(id) {
      const d = await db();
      d.videos = d.videos.filter((v) => v.id !== id);
      Object.values(d.progress).forEach((p) => delete p[id]);
      save(d);
    },

    // ----- Roleplay IA (demo: el cliente responde con frases de ejemplo y voz del navegador) -----
    async rpCatalog() {
      const d = await db();
      if (!d.rpScenarios) { d.rpScenarios = (window.BSRoleplaySeed || []).map((s) => ({ id: uid(), active: true, ...s })); save(d); }
      return d.rpScenarios.filter((s) => s.active).map(({ id, title, level, brief }) => ({ id, title, level, brief }));
    },
    async rpScenarios() { await this.rpCatalog(); return (await db()).rpScenarios; },
    async rpSaveScenario(s) {
      const d = await db();
      if (!String(s.title || "").trim()) throw new Error("Escribe el título del escenario.");
      const i = s.id ? d.rpScenarios.findIndex((x) => x.id === s.id) : -1;
      if (i >= 0) d.rpScenarios[i] = { ...d.rpScenarios[i], ...s }; else d.rpScenarios.push({ ...s, id: uid() });
      save(d);
    },
    async rpDeleteScenario(id) { const d = await db(); d.rpScenarios = d.rpScenarios.filter((x) => x.id !== id); save(d); },
    async rpLedger(userId) { return [...((await db()).rpLedger || []).filter((x) => x.userId === userId)].sort((a, b) => b.createdAt - a.createdAt); },
    async rpBalance(userId) { return (await this.rpLedger(userId)).reduce((s, x) => s + x.amount, 0); },
    async rpAddCredit(userId, amount, note) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n === 0) throw new Error("Escribe un monto.");
      const d = await db();
      (d.rpLedger ||= []).push({ id: uid(), userId, amount: n, kind: n > 0 ? "recarga" : "ajuste", note: String(note || "").trim(), createdAt: Date.now() });
      save(d);
    },
    async rpSessions(userId) { return [...((await db()).rpSessions || []).filter((x) => x.userId === userId)].sort((a, b) => b.createdAt - a.createdAt); },
    rpLocalAi: () => localAi(),
    async rpStart(userId, scenarioId) {
      const d = await db();
      const sc = d.rpScenarios.find((x) => x.id === scenarioId);
      if (!sc) throw new Error("Escenario no disponible.");
      const s = { id: uid(), userId, scenarioId, title: sc.title, level: sc.level, transcript: [{ role: "client", text: sc.opening || "¿Bueno? ¿Quién habla?" }], cost: 0, createdAt: Date.now() };
      if (await localAi()) {
        const r = await localCall({ action: "start", scenario: sc });
        s.localId = r.sessionId;
        s.transcript[0].text = r.opening;
      }
      (d.rpSessions ||= []).push(s);
      save(d);
      return { sessionId: s.id, opening: s.transcript[0].text, level: sc.level, title: sc.title, demo: !s.localId };
    },
    async rpTurn(sessionId, text) {
      const d = await db();
      const s = d.rpSessions.find((x) => x.id === sessionId);
      if (s.localId) {
        const r = await localCall({ action: "turn", sessionId: s.localId, text });
        s.transcript.push({ role: "agent", text }, { role: "client", text: r.reply });
        s.cost += r.cost || 0;
        save(d);
        return r;
      }
      s.transcript.push({ role: "agent", text });
      const lines = (window.BSRoleplayDemoLines || {})[s.level] || ["Ajá... ¿y eso cuánto me costaría?"];
      const n = s.transcript.filter((m) => m.role === "agent").length - 1;
      const hangup = n >= lines.length - 1;
      const reply = lines[Math.min(n, lines.length - 1)];
      s.transcript.push({ role: "client", text: reply });
      save(d);
      await new Promise((r) => setTimeout(r, 700));   // simula que el cliente "piensa"
      return { reply, hangup, cost: 0 };
    },
    // Con el servidor local: voz humana (ElevenLabs) si está configurada; si no, voz del navegador.
    async rpTts(sessionId, text) {
      const s = (await db()).rpSessions.find((x) => x.id === sessionId);
      return s?.localId ? localCall({ action: "tts", sessionId: s.localId, text }) : null;
    },
    async rpGrade(sessionId, seconds) {
      const d = await db();
      const s = d.rpSessions.find((x) => x.id === sessionId);
      s.seconds = seconds;
      if (s.localId) {
        const r = await localCall({ action: "grade", sessionId: s.localId });
        Object.assign(s, { grade: r.grade, cost: r.cost, endedAt: Date.now() });
        save(d);
        return r;
      }
      s.grade = window.BSRoleplayDemoGrade;
      s.endedAt = Date.now();
      save(d);
      await new Promise((r) => setTimeout(r, 900));
      return { grade: s.grade, cost: 0 };
    },

    // ----- Carriers (los edita el administrador, los ven todos) -----
    async listCarriers() {
      const d = await db();
      const seed = (window.BSCarrierSeed || []).map(common.carrierFromSeed);
      if (!d.carriers) { d.carriers = seed.map((c) => ({ id: uid(), ...c })); d.carriersV = 2; save(d); }
      if ((d.carriersV || 1) < 2) {
        // v2: sin Ladder Life, con logos y con el portal/Sales Desk de National Life.
        d.carriers = d.carriers.filter((c) => c.name !== "Ladder Life").map((c) => {
          const s = seed.find((x) => x.name === c.name);
          if (!s) return c;
          return c.name === "National Life Group" ? { ...c, ...s } : { ...c, logo: c.logo || s.logo };
        });
        d.carriersV = 2;
        save(d);
      }
      return [...d.carriers].sort((a, b) => a.name.localeCompare(b.name));
    },
    async saveCarrier(c) {
      const d = await db();
      const row = common.cleanCarrier(c);
      const i = c.id ? d.carriers.findIndex((x) => x.id === c.id) : -1;
      if (i >= 0) d.carriers[i] = { ...d.carriers[i], ...row }; else d.carriers.push({ id: uid(), ...row });
      save(d);
    },
    async deleteCarrier(id) {
      const d = await db();
      d.carriers = d.carriers.filter((x) => x.id !== id);
      save(d);
    },

    // ----- Llamadas modelo (las administra el administrador, las escuchan todos) -----
    // En la demo los audios se guardan en IndexedDB de este navegador (no salen de la computadora).
    async listModelCalls() {
      const d = await db();
      const list = d.modelCalls || [];
      return Promise.all(list.map(async (c) => ({ ...c, url: c.blobId ? await blobUrl(c.blobId) : c.srcUrl || "" })));
    },
    // file = archivo nuevo (opcional). Si no hay archivo y viene srcUrl, se usa ese enlace.
    async saveModelCall(call, file) {
      if (!String(call.title || "").trim()) throw new Error("El título es obligatorio.");
      const d = await db();
      d.modelCalls ||= [];
      const prev = call.id ? d.modelCalls.find((x) => x.id === call.id) : null;
      const { url, ...data } = call;
      let blobId = prev?.blobId || null, srcUrl = prev?.srcUrl || "";
      const newUrl = String(call.srcUrl || "").trim();
      if (file || newUrl) {
        if (blobId) await blobDel(blobId);
        blobId = null; srcUrl = "";
        if (file) { blobId = uid(); await blobPut(blobId, file); } else srcUrl = newUrl;
      }
      if (!blobId && !srcUrl) throw new Error("Sube el archivo de audio o pega un enlace.");
      const row = { ...prev, ...data, blobId, srcUrl };
      if (prev) Object.assign(prev, row);
      else d.modelCalls.unshift({ ...row, id: uid(), createdAt: Date.now() });
      save(d);
    },
    async deleteModelCall(id) {
      const d = await db();
      const c = (d.modelCalls || []).find((x) => x.id === id);
      if (c?.blobId) await blobDel(c.blobId);
      d.modelCalls = (d.modelCalls || []).filter((x) => x.id !== id);
      save(d);
    },

    // ----- Datos propios del agente (ventas, campañas, leads, agenda…) -----
    // Cada "kind" es una lista de objetos que pertenece a un agente.
    async items(userId, kind) {
      const d = await db();
      return [...(d.items?.[userId]?.[kind] || [])];
    },
    async saveItem(userId, kind, item) {
      const d = await db();
      d.items ||= {};
      const list = ((d.items[userId] ||= {})[kind] ||= []);
      const i = item.id ? list.findIndex((x) => x.id === item.id) : -1;
      const saved = i >= 0
        ? { ...list[i], ...item, updatedAt: Date.now() }
        : { ...item, id: uid(), createdAt: Date.now(), updatedAt: Date.now() };
      if (i >= 0) list[i] = saved; else list.push(saved);
      save(d);
      return saved;
    },
    async saveItems(userId, kind, items) {
      const out = [];
      for (const it of items) out.push(await this.saveItem(userId, kind, it));
      return out;
    },
    async deleteItem(userId, kind, id) {
      const d = await db();
      const list = d.items?.[userId]?.[kind];
      if (list) d.items[userId][kind] = list.filter((x) => x.id !== id);
      save(d);
    },

    // ----- Progreso -----
    async getProgress(userId) { return (await db()).progress[userId] || {}; },
    async saveProgress(userId, videoId, data) {
      const d = await db();
      const p = (d.progress[userId] ||= {});
      const prev = p[videoId] || {};
      // El progreso solo puede avanzar, nunca retroceder.
      p[videoId] = {
        max: Math.max(prev.max || 0, data.max || 0),
        duration: data.duration || prev.duration || 0,
        done: prev.done || !!data.done,
        doneAt: prev.doneAt || (data.done ? Date.now() : undefined),
      };
      save(d);
      return p[videoId];
    },
  };
})();
