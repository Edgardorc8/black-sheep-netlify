/*
 * Capa de datos — MODO PRODUCCIÓN (Supabase).
 * Se activa sola cuando config.js tiene SUPABASE_URL y SUPABASE_ANON_KEY.
 * Expone las mismas funciones que data.js, así app.js no cambia.
 */
(function () {
  const cfg = window.BS_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  if (!window.supabase?.createClient) {
    console.error("Supabase SDK no disponible.");
    return;
  }

  // La sesión se guarda en sessionStorage: al cerrar la página o el navegador, la sesión se cierra.
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const C = window.BSCommon;
  const norm = C.norm;
  const SIGNED_URL_SECONDS = 6 * 60 * 60;
  const siteUrl = () => `${location.origin}${location.pathname}`;
  const PROFILE_COLS = "id, username, name, email, role, approved, disabled, created_at, terms_version, terms_accepted_at";
  const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "m4v"]);
  const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"]);
  const AUDIO_EXTS = new Set(["mp3", "m4a", "wav", "ogg", "webm", "aac"]);
  const AUDIO_MIMES = new Set(["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/aac"]);

  const cleanDbError = (msg = "") => {
    if (/duplicate key|unique constraint/i.test(msg)) return "Ese registro ya existe.";
    if (/row-level security|permission denied|insufficient_privilege/i.test(msg)) return "No tienes permiso para realizar esta acción.";
    if (/violates foreign key|violates check constraint/i.test(msg)) return "Los datos enviados no son válidos.";
    if (/JWT|token|expired/i.test(msg)) return "Tu sesión expiró. Vuelve a iniciar sesión.";
    return "No se pudo completar la operación. Intenta de nuevo.";
  };

  const must = ({ data, error }) => {
    if (error) {
      console.warn("[Supabase]", error.message);
      throw new Error(cleanDbError(error.message));
    }
    return data;
  };
  const toUser = (p) => p && { ...p, email: p.email || "", createdAt: p.created_at, termsVersion: p.terms_version || "", termsAcceptedAt: p.terms_accepted_at };

  async function profile(id) {
    const { data } = await sb.from("profiles").select(PROFILE_COLS).eq("id", id).maybeSingle();
    return toUser(data);
  }

  async function adminCall(body) {
    const { data, error } = await sb.functions.invoke("admin-users", { body: { ...body, emailDomain: cfg.EMAIL_DOMAIN } });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    return data;
  }

  async function rpCall(body) {
    const { data, error } = await sb.functions.invoke("roleplay", { body });
    if (error) {
      let msg = error.message, extra = {};
      try { extra = await error.context.json(); msg = extra.error || msg; } catch {}
      const e = new Error(msg); e.hangup = !!extra.hangup; throw e;
    }
    return data;
  }

  async function uploadVideo(file) {
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    if (!VIDEO_EXTS.has(ext) || (file.type && !VIDEO_MIMES.has(file.type.toLowerCase()))) {
      throw new Error("Formato de video no permitido. Usa MP4, WebM o MOV.");
    }
    const path = `${crypto.randomUUID()}.${ext}`;
    const contentType = VIDEO_MIMES.has((file.type || "").toLowerCase()) ? file.type : "video/mp4";
    const { error } = await sb.storage.from("videos").upload(path, file, { contentType });
    if (error) throw new Error(/exceeded|too large|maximum/i.test(error.message)
      ? "El video es demasiado pesado para tu plan de Supabase. Comprímelo o usa un enlace."
      : cleanDbError(error.message));
    return path;
  }

  window.BSData = {
    mode: "supabase",

    // ----- Sesión -----
    async login(identifier, password) {
      const id = norm(identifier);
      const fail = (msg) => {
        if (/banned/i.test(msg)) throw new Error("Tu acceso está desactivado. Habla con tu manager.");
        if (/confirm/i.test(msg)) throw new Error("Primero confirma tu correo: revisa tu bandeja de entrada (y spam).");
        throw new Error("Usuario o contraseña incorrectos.");
      };
      let data;
      if (id.includes("@")) {
        const r = await sb.auth.signInWithPassword({ email: id, password });
        if (r.error) fail(r.error.message);
        data = r.data;
      } else {
        // Con usuario: el servidor busca el correo e inicia sesión, sin mostrarle el correo a nadie.
        const { data: s, error } = await sb.functions.invoke("login-usuario", { body: { username: id, password } });
        if (error || !s?.access_token) {
          let msg = "";
          try { msg = (await error?.context?.json())?.error || ""; } catch {}
          fail(msg);
        }
        const r = await sb.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
        if (r.error) fail(r.error.message);
        data = r.data;
      }
      const p = await profile(data.user.id);
      const problem = !p ? "Tu cuenta no tiene perfil. Habla con tu manager."
        : !p.approved ? "Tu cuenta está pendiente de aprobación. Podrás entrar cuando tu manager la apruebe."
        : p.disabled ? "Tu acceso está desactivado. Habla con tu manager." : "";
      if (problem) { await sb.auth.signOut(); throw new Error(problem); }
      return p;
    },
    async getUser(id) {
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid || uid !== id) return null;
      const p = await profile(uid);
      return p && p.approved && !p.disabled ? p : null;
    },
    async logout() { await sb.auth.signOut(); },
    async acceptTerms() {
      must(await sb.rpc("accept_terms", { v: C.TERMS_VERSION }));
      return profile((await sb.auth.getSession()).data.session.user.id);
    },

    // ----- Registro y recuperación -----
    async getSettings() {
      const s = must(await sb.from("settings").select("allow_signup, require_approval, rp_voice_per_1k, rp_margin_pct, rp_min_balance, rp_billing").eq("id", 1).single());
      return {
        allowSignup: s.allow_signup, requireApproval: s.require_approval,
        rpVoicePer1k: Number(s.rp_voice_per_1k), rpMarginPct: Number(s.rp_margin_pct), rpMinBalance: Number(s.rp_min_balance), rpBilling: !!s.rp_billing,
      };
    },
    async getAbout() {
      const { data } = await sb.from("settings").select("about").eq("id", 1).maybeSingle();
      return data?.about || C.DEFAULT_ABOUT;
    },
    async saveAbout(a) {
      must(await sb.from("settings").update({ about: a ? C.cleanAbout(a) : null }).eq("id", 1));
    },
    async saveSettings(s) {
      const row = {};
      if ("allowSignup" in s) row.allow_signup = s.allowSignup;
      if ("requireApproval" in s) row.require_approval = s.requireApproval;
      if ("rpVoicePer1k" in s) row.rp_voice_per_1k = s.rpVoicePer1k;
      if ("rpMarginPct" in s) row.rp_margin_pct = s.rpMarginPct;
      if ("rpMinBalance" in s) row.rp_min_balance = s.rpMinBalance;
      if ("rpBilling" in s) row.rp_billing = s.rpBilling;
      must(await sb.from("settings").update(row).eq("id", 1));
    },
    async signup({ name, email, username, password, terms }) {
      const settings = await this.getSettings();
      if (!settings.allowSignup) throw new Error("El registro está cerrado. Pide a tu manager que te cree la cuenta.");
      if (!terms) throw new Error("Debes aceptar los Términos de uso y la Política de privacidad.");
      username = norm(username); email = norm(email);
      C.checkName(name); C.checkEmail(email); C.checkUsername(username); C.checkPassword(password);
      if (!must(await sb.rpc("username_available", { u: username }))) throw new Error("Ese usuario ya está en uso.");
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { signup: "true", username, name: name.trim(), terms_version: C.TERMS_VERSION }, emailRedirectTo: siteUrl() },
      });
      if (error) throw new Error(/registered|exists/i.test(error.message) ? "Ese correo ya está registrado." : error.message);
      // Supabase no avisa si el correo ya existe: devuelve un usuario sin identidades.
      if (data.user && !data.user.identities?.length) throw new Error("Ese correo ya está registrado.");
      if (!data.session) return { status: "confirm_email" };
      await sb.auth.signOut();
      return { status: settings.requireApproval ? "pending" : "active" };
    },
    async requestPasswordReset(email) {
      email = norm(email);
      C.checkEmail(email);
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}?reset=1` });
      if (error && /rate|seconds/i.test(error.message)) throw new Error("Espera un minuto antes de pedir otro enlace.");
      return {};
    },
    async completePasswordReset(_token, password) {
      C.checkPassword(password);
      const { data } = await sb.auth.getSession();
      if (!data.session) throw new Error("El enlace ya venció o no es válido. Pide uno nuevo.");
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw new Error(/different/i.test(error.message) ? "La contraseña nueva debe ser distinta a la anterior." : error.message);
    },

    // ----- Agentes (solo administrador) -----
    async listUsers() {
      return must(await sb.from("profiles").select(PROFILE_COLS).order("created_at")).map(toUser);
    },
    createUser: (u) => adminCall({ action: "create", ...u }),
    updateUser: (id, u) => adminCall({ action: "update", id, ...u }),
    setPassword: (id, password) => adminCall({ action: "setPassword", id, password }),
    toggleUser: (id) => adminCall({ action: "toggle", id }),
    deleteUser: (id) => adminCall({ action: "delete", id }),
    async approveUser(id) { must(await sb.from("profiles").update({ approved: true }).eq("id", id)); },
    async resetProgress(id) { must(await sb.from("progress").delete().eq("user_id", id)); },
    async setLessonDone(userId, videoId, done) {
      if (done) must(await sb.from("progress").upsert({ user_id: userId, video_id: videoId, done: true }));
      else must(await sb.from("progress").delete().eq("user_id", userId).eq("video_id", videoId));
    },

    // ----- Lecciones -----
    async listVideos() {
      const rows = must(await sb.from("videos").select("*").order("position").order("created_at"));
      const paths = rows.filter((r) => r.storage_path).map((r) => r.storage_path);
      const signed = {};
      if (paths.length) {
        const list = must(await sb.storage.from("videos").createSignedUrls(paths, SIGNED_URL_SECONDS));
        list.forEach((s) => { if (s.signedUrl) signed[s.path] = s.signedUrl; });
      }
      return rows.map((r) => ({ id: r.id, title: r.title, desc: r.description, module: r.module, url: r.storage_path ? signed[r.storage_path] || "" : r.url, storage_path: r.storage_path }));
    },
    async addVideo({ title, desc, module, url, file }) {
      if (!String(title || "").trim()) throw new Error("El título es obligatorio.");
      if (!file && !String(url || "").trim()) throw new Error("Sube un archivo de video o pega un enlace.");
      const cleanUrl = file ? null : C.checkHttpsUrl(url, "El enlace del video");
      const storage_path = file ? await uploadVideo(file) : null;
      const { data: last } = await sb.from("videos").select("position").order("position", { ascending: false }).limit(1);
      const position = (last?.[0]?.position ?? -1) + 1;
      must(await sb.from("videos").insert({ title: title.trim(), description: String(desc || "").trim(), module: C.cleanModule(module), url: cleanUrl, storage_path, position }));
    },
    async updateVideo(id, { title, desc, module, url, file }) {
      if (!String(title || "").trim()) throw new Error("El título es obligatorio.");
      const old = must(await sb.from("videos").select("storage_path").eq("id", id).single());
      const row = { title: title.trim(), description: String(desc || "").trim(), module: C.cleanModule(module) };
      if (file) Object.assign(row, { storage_path: await uploadVideo(file), url: null });
      else if (String(url || "").trim()) Object.assign(row, { storage_path: null, url: C.checkHttpsUrl(url, "El enlace del video") });
      must(await sb.from("videos").update(row).eq("id", id));
      // Si se reemplazó el archivo, borra el anterior para no ocupar espacio.
      if (old.storage_path && "storage_path" in row) await sb.storage.from("videos").remove([old.storage_path]);
    },
    async moveVideo(id, dir) {
      const rows = must(await sb.from("videos").select("id, position").order("position").order("created_at"));
      const i = rows.findIndex((v) => v.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= rows.length) return;
      [rows[i], rows[j]] = [rows[j], rows[i]];
      // Renumera todo para que el orden quede limpio (0, 1, 2…).
      await Promise.all(rows.map((r, k) => (r.position === k ? null : sb.from("videos").update({ position: k }).eq("id", r.id))));
    },
    async deleteVideo(id) {
      const row = must(await sb.from("videos").select("storage_path").eq("id", id).single());
      must(await sb.from("videos").delete().eq("id", id));
      if (row.storage_path) await sb.storage.from("videos").remove([row.storage_path]);
    },

    // ----- Roleplay IA (función "roleplay" del servidor: Claude + voz humana + cobro) -----
    async rpCatalog() { return must(await sb.rpc("roleplay_catalog")); },
    async rpScenarios() { return must(await sb.from("roleplay_scenarios").select("*").order("level").order("title")); },
    async rpSaveScenario(s) {
      if (!String(s.title || "").trim()) throw new Error("Escribe el título del escenario.");
      const row = { title: s.title.trim(), level: s.level, brief: s.brief || "", persona: s.persona || "", opening: s.opening || "", voice_id: s.voice_id || "", rubric: s.rubric || "", active: s.active !== false };
      if (s.id) must(await sb.from("roleplay_scenarios").update(row).eq("id", s.id));
      else must(await sb.from("roleplay_scenarios").insert(row));
    },
    async rpDeleteScenario(id) { must(await sb.from("roleplay_scenarios").delete().eq("id", id)); },
    async rpLedger(userId) {
      return must(await sb.from("roleplay_ledger").select("*").eq("user_id", userId).order("created_at", { ascending: false }))
        .map((r) => ({ ...r, amount: Number(r.amount), createdAt: Date.parse(r.created_at) }));
    },
    async rpBalance(userId) { return (await this.rpLedger(userId)).reduce((s, x) => s + x.amount, 0); },
    async rpAddCredit(userId, amount, note) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n === 0) throw new Error("Escribe un monto.");
      must(await sb.from("roleplay_ledger").insert({ user_id: userId, amount: n, kind: n > 0 ? "recarga" : "ajuste", note: String(note || "").trim() }));
    },
    async rpSessions(userId) {
      return must(await sb.from("roleplay_sessions").select("id, title, level, grade, cost, seconds, created_at, transcript").eq("user_id", userId).order("created_at", { ascending: false }).limit(30))
        .map((r) => ({ ...r, cost: Number(r.cost), createdAt: Date.parse(r.created_at) }));
    },
    async rpStart(_userId, scenarioId) { return rpCall({ action: "start", scenarioId }); },
    async rpTurn(sessionId, text) { return rpCall({ action: "turn", sessionId, text }); },
    async rpGrade(sessionId, seconds) { return rpCall({ action: "grade", sessionId, seconds }); },
    // Devuelve el audio (MP3) de la voz del cliente.
    async rpTts(sessionId, text) {
      const { data } = await sb.auth.getSession();
      const r = await fetch(`${cfg.SUPABASE_URL}/functions/v1/roleplay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${data.session?.access_token}` },
        body: JSON.stringify({ action: "tts", sessionId, text }),
      });
      if (!r.ok) { let m = "La voz no está disponible."; try { m = (await r.json()).error || m; } catch {} throw new Error(m); }
      return r.blob();
    },

    // ----- Carriers -----
    async listCarriers() {
      let rows = must(await sb.from("carriers").select("*").order("name"));
      // Primera vez: el administrador llena la tabla con la lista inicial; los agentes la ven igual.
      if (!rows.length) {
        const seed = (window.BSCarrierSeed || []).map(C.carrierFromSeed);
        const { data: me } = await sb.auth.getUser();
        const p = me?.user && (await profile(me.user.id));
        if (p?.role !== "admin") return seed.map((c, i) => ({ id: `seed-${i}`, ...c }));
        rows = must(await sb.from("carriers").insert(seed).select()).sort((a, b) => a.name.localeCompare(b.name));
      }
      return rows;
    },
    async saveCarrier(c) {
      const row = C.cleanCarrier(c);
      if (c.id) must(await sb.from("carriers").update(row).eq("id", c.id));
      else must(await sb.from("carriers").insert(row));
    },
    async deleteCarrier(id) { must(await sb.from("carriers").delete().eq("id", id)); },

    // ----- Llamadas modelo (bucket privado "calls") -----
    async listModelCalls() {
      const rows = must(await sb.from("model_calls").select("*").order("created_at", { ascending: false }));
      const paths = rows.filter((r) => r.storage_path).map((r) => r.storage_path);
      const signed = {};
      if (paths.length) {
        must(await sb.storage.from("calls").createSignedUrls(paths, SIGNED_URL_SECONDS)).forEach((s) => { if (s.signedUrl) signed[s.path] = s.signedUrl; });
      }
      return rows.map((r) => ({
        id: r.id, title: r.title, agent: r.agent, category: r.category, result: r.result, desc: r.description,
        moments: r.moments || [], srcUrl: r.url || "", storage_path: r.storage_path,
        url: r.storage_path ? signed[r.storage_path] || "" : r.url || "", createdAt: Date.parse(r.created_at),
      }));
    },
    async saveModelCall(call, file) {
      if (!String(call.title || "").trim()) throw new Error("El título es obligatorio.");
      const prev = call.id ? must(await sb.from("model_calls").select("storage_path, url").eq("id", call.id).single()) : null;
      const row = {
        title: call.title.trim(), agent: call.agent || "", category: call.category || "", result: call.result || "",
        description: call.desc || "", moments: call.moments || [],
      };
      const newUrl = String(call.srcUrl || "").trim();
      if (file) {
        const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
        if (!AUDIO_EXTS.has(ext) || (file.type && !AUDIO_MIMES.has(file.type.toLowerCase()))) {
          throw new Error("Formato de audio no permitido. Usa MP3, M4A, WAV u OGG.");
        }
        row.storage_path = `${crypto.randomUUID()}.${ext}`;
        row.url = null;
        const contentType = AUDIO_MIMES.has((file.type || "").toLowerCase()) ? file.type : "audio/mpeg";
        const { error } = await sb.storage.from("calls").upload(row.storage_path, file, { contentType });
        if (error) throw new Error(/exceeded|too large|maximum/i.test(error.message) ? "El audio es demasiado pesado para tu plan de Supabase." : cleanDbError(error.message));
      } else if (newUrl && newUrl !== prev?.url) {
        Object.assign(row, { storage_path: null, url: C.checkHttpsUrl(newUrl, "El enlace del audio") });
      }
      if (!file && !newUrl && !prev?.storage_path && !prev?.url) throw new Error("Sube el archivo de audio o pega un enlace.");
      if (call.id) must(await sb.from("model_calls").update(row).eq("id", call.id));
      else must(await sb.from("model_calls").insert(row));
      if (prev?.storage_path && "storage_path" in row) await sb.storage.from("calls").remove([prev.storage_path]);
    },
    async deleteModelCall(id) {
      const row = must(await sb.from("model_calls").select("storage_path").eq("id", id).single());
      must(await sb.from("model_calls").delete().eq("id", id));
      if (row.storage_path) await sb.storage.from("calls").remove([row.storage_path]);
    },

    // ----- Datos propios del agente (ventas, campañas, leads, agenda…) -----
    async items(userId, kind) {
      const rows = must(await sb.from("agent_items").select("id, data, created_at, updated_at").eq("user_id", userId).eq("kind", kind).order("created_at"));
      return rows.map((r) => ({ ...r.data, id: r.id, createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at) }));
    },
    async saveItem(userId, kind, item) {
      const { id, createdAt, updatedAt, ...data } = item;
      const row = id
        ? must(await sb.from("agent_items").update({ data, updated_at: new Date().toISOString() }).eq("id", id).select().single())
        : must(await sb.from("agent_items").insert({ user_id: userId, kind, data }).select().single());
      return { ...row.data, id: row.id, createdAt: Date.parse(row.created_at), updatedAt: Date.parse(row.updated_at) };
    },
    async saveItems(userId, kind, items) {
      const rows = must(await sb.from("agent_items").insert(items.map(({ id, createdAt, updatedAt, ...data }) => ({ user_id: userId, kind, data }))).select());
      return rows.map((r) => ({ ...r.data, id: r.id, createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at) }));
    },
    async deleteItem(_userId, _kind, id) { must(await sb.from("agent_items").delete().eq("id", id)); },

    // ----- Progreso -----
    async getProgress(userId) {
      const rows = must(await sb.from("progress").select("video_id, max, duration, done, done_at").eq("user_id", userId));
      return Object.fromEntries(rows.map((r) => [r.video_id, { max: r.max, duration: r.duration, done: r.done, doneAt: r.done_at }]));
    },
    async saveProgress(userId, videoId, data) {
      // El trigger de la base de datos impide que el progreso retroceda.
      const row = must(await sb.from("progress").upsert({
        user_id: userId, video_id: videoId, max: data.max || 0, duration: data.duration || 0, done: !!data.done,
      }).select().single());
      return { max: row.max, duration: row.duration, done: row.done, doneAt: row.done_at };
    },
  };
})();
