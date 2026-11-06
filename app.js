(function () {
  const $app = document.getElementById("app");
  // La sesión vive en sessionStorage: sigue al recargar, pero se borra al cerrar la pestaña o el navegador.
  const SESSION = "bs_session";
  let me = null;
  let view = "home";         // "home" | "class" | "ranking" | "admin"
  let selectedId = null;     // video abierto en el aula
  let cleanupPlayer = null;

  // ---------- Utilidades ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (t) => {
    t = Math.max(0, Math.floor(t || 0));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  };
  const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  let maskSeq = 0;
  function logoMark() {
    const id = "bsm" + ++maskSeq;
    const face = "M22 34C22 28.5 26.5 27 32 27S42 28.5 42 34L40.4 46.5C39.6 53 36 57 32 57S24.4 53 23.6 46.5Z";
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><mask id="${id}"><rect width="64" height="64" fill="#fff"/>
      <path d="${face}" fill="none" stroke="#000" stroke-width="3"/>
      <ellipse cx="27.2" cy="39" rx="1.7" ry="2.3" fill="#000"/><ellipse cx="36.8" cy="39" rx="1.7" ry="2.3" fill="#000"/></mask></defs>
      <g mask="url(#${id})" fill="currentColor"><circle cx="20" cy="27" r="9.5"/><circle cx="32" cy="20" r="11"/><circle cx="44" cy="27" r="9.5"/>
      <circle cx="23" cy="16" r="6.5"/><circle cx="41" cy="16" r="6.5"/>
      <ellipse cx="13" cy="38" rx="8" ry="3.4" transform="rotate(24 13 38)"/><ellipse cx="51" cy="38" rx="8" ry="3.4" transform="rotate(-24 51 38)"/>
      <path d="${face}"/></g></svg>`;
  }
  const brand = (sub = "AGENCY") =>
    `<div class="brand">${logoMark()}<div class="brand-text"><span class="brand-name">BLACK SHEEP</span><span class="brand-sub">${sub}</span></div></div>`;

  const ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="m17 9 5 6M22 9l-5 6"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z"/></svg>',
    course: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9.2 5 2.8-5 2.8z" fill="currentColor"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3M8.5 20h7l-1-3h-5z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
    headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
    dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3.2c0 4.3 9 2.3 9 6.6 0 1.9-2 3.2-4.5 3.2s-4.5-1.3-4.5-3"/></svg>',
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/></svg>',
    medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="15" r="5"/><path d="M8.5 11 6 3h4l2 5 2-5h4l-2.5 8"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7 6 6 0 0 1-5.2-3L3 14.5a1.5 1.5 0 0 1 2.4-1.8L8 15"/></svg>',
    phoneOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-2.3 0-4.5.4-6.6 1.2-.6.2-1 .8-1 1.4v2.6c0 .7.6 1.3 1.3 1.2l3-.4c.6-.1 1-.6 1-1.2v-1.4a12 12 0 0 1 4.6 0v1.4c0 .6.4 1.1 1 1.2l3 .4c.7.1 1.3-.5 1.3-1.2v-2.6c0-.6-.4-1.2-1-1.4A18.5 18.5 0 0 0 12 9z"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V5l8-2v18M12 8l8 2v11M3 21h18M7.5 8h1M7.5 12h1M7.5 16h1M15.5 13h1M15.5 17h1"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.5-.6 4.9-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  };

  // ---------- Arranque ----------
  async function boot() {
    localStorage.removeItem(SESSION);   // versiones anteriores la guardaban de forma permanente
    const id = sessionStorage.getItem(SESSION);
    me = id && !resetToken() ? await BSData.getUser(id) : null;
    me ? render() : publicScreen();
    window.addEventListener("hashchange", () => { if (!me) publicScreen(); });
  }

  function logout() {
    teardown();   // guarda el progreso del video abierto antes de cerrar sesión
    window.BSQuote?.clearAll();   // la ficha del cotizador tiene datos del cliente
    BSData.logout?.();
    sessionStorage.removeItem(SESSION);
    me = null; selectedId = null; view = "home";
    go("");
  }

  // ---------- Pantallas públicas (portada) ----------
  const resetToken = () => new URLSearchParams(location.search).get("reset");
  let flash = "";   // mensaje de éxito que se muestra una vez en el login

  function go(hash) {
    if (location.hash.slice(1) === hash) publicScreen();
    else location.hash = hash;   // dispara hashchange → publicScreen()
  }

  function publicScreen() {
    teardown();
    closeModal();
    if (resetToken()) return renderReset();
    const h = location.hash.slice(1);
    if (h === "registro") return renderSignup();
    if (h === "recuperar") return renderForgot();
    return renderLogin();
  }

  function cover(inner, { compact = false } = {}) {
    $app.innerHTML = `
      <main class="cover ${compact ? "compact" : ""}">
        <div class="cover-in">
          <div class="cover-mark">${logoMark()}</div>
          <h1 class="cover-name">BLACK SHEEP</h1>
          <p class="cover-sub">AGENCY</p>
          ${inner}
        </div>
      </main>`;
  }

  // Envía un formulario mostrando errores debajo y bloqueando el botón mientras trabaja.
  function bindForm(form, handler, busyText = "Un momento…") {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      const err = form.querySelector(".error");
      const label = btn.textContent;
      if (err) err.textContent = "";
      btn.disabled = true;
      btn.textContent = busyText;
      try {
        await handler(Object.fromEntries(new FormData(form)), form);
      } catch (ex) {
        if (err) err.textContent = ex.message; else toast(ex.message);
      } finally {
        if (btn.isConnected) { btn.disabled = false; btn.textContent = label; }
      }
    });
  }

  async function renderLogin() {
    const settings = await BSData.getSettings();
    cover(`
      ${flash ? `<p class="cover-msg ok">${esc(flash)}</p>` : ""}
      <form class="cover-form" id="loginForm" autocomplete="on">
        <label class="cover-field"><span>Usuario o correo</span><input name="username" autocomplete="username" required autofocus></label>
        <label class="cover-field"><span>Contraseña</span><input name="password" type="password" autocomplete="current-password" required></label>
        <div class="error"></div>
        <button class="cover-btn" type="submit">Entrar</button>
        <div class="cover-links">
          <a href="#recuperar">¿Olvidaste tu contraseña?</a>
          ${settings.allowSignup ? `<a href="#registro">Crear cuenta</a>` : ""}
        </div>
      </form>
      <p class="cover-legal"><a href="legal.html#terminos">Términos</a> · <a href="legal.html#privacidad">Privacidad</a></p>
      ${BSData.demoLogin ? `
      <div class="demo-access">
        <p>Modo de prueba · acceso rápido</p>
        <div>
          <button class="demo-btn" data-demo="admin">Administrador</button>
          <button class="demo-btn" data-demo="agent">Agente</button>
        </div>
      </div>` : ""}`);
    flash = "";
    document.querySelectorAll("[data-demo]").forEach((b) => (b.onclick = async () => {
      try { enter(await BSData.demoLogin(b.dataset.demo)); } catch (ex) { toast(ex.message); }
    }));
    bindForm(document.getElementById("loginForm"), async (f) => {
      enter(await BSData.login(f.username, f.password));
    }, "Entrando…");
  }

  function enter(user) {
    me = user;
    sessionStorage.setItem(SESSION, me.id);
    view = "home";
    history.replaceState(null, "", location.pathname);
    render();
  }

  async function renderSignup() {
    const settings = await BSData.getSettings();
    if (!settings.allowSignup) {
      return cover(`
        <div class="cover-form">
          <p class="cover-msg">El registro está cerrado por ahora. Pide a tu manager que te cree la cuenta.</p>
          <div class="cover-links center"><a href="#">Volver a iniciar sesión</a></div>
        </div>`);
    }
    cover(`
      <form class="cover-form" id="signupForm" autocomplete="on">
        <h2 class="cover-title">Crear cuenta</h2>
        <label class="cover-field"><span>Nombre completo</span><input name="name" autocomplete="name" required autofocus></label>
        <label class="cover-field"><span>Correo</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="cover-field"><span>Usuario</span><input name="username" autocomplete="username" placeholder="ej. juan.perez" required></label>
        <label class="cover-field"><span>Contraseña</span><input name="password" type="password" autocomplete="new-password" minlength="6" required></label>
        <label class="cover-field"><span>Confirmar contraseña</span><input name="password2" type="password" autocomplete="new-password" minlength="6" required></label>
        ${termsCheck()}
        <div class="error"></div>
        <button class="cover-btn" type="submit">Crear cuenta</button>
        <div class="cover-links center"><span>¿Ya tienes cuenta?</span><a href="#">Iniciar sesión</a></div>
      </form>`, { compact: true });
    bindForm(document.getElementById("signupForm"), async (f) => {
      if (f.password !== f.password2) throw new Error("Las contraseñas no coinciden.");
      const { status } = await BSData.signup(f);
      if (status === "active") {
        flash = "¡Tu cuenta está lista! Ya puedes entrar.";
        return go("");
      }
      cover(`
        <div class="cover-form">
          <p class="cover-msg ok"><b>¡Listo, ${esc(f.name.split(" ")[0])}!</b>
          ${status === "confirm_email"
            ? "Te enviamos un correo para confirmar tu cuenta. Después, tu manager debe aprobarla."
            : "Tu cuenta fue creada y está pendiente de aprobación. Podrás entrar cuando tu manager la active."}</p>
          <div class="cover-links center"><a href="#">Volver a iniciar sesión</a></div>
        </div>`);
    }, "Creando cuenta…");
  }

  function renderForgot() {
    cover(`
      <form class="cover-form" id="forgotForm">
        <h2 class="cover-title">Recuperar contraseña</h2>
        <p class="cover-hint">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>
        <label class="cover-field"><span>Correo</span><input name="email" type="email" autocomplete="email" required autofocus></label>
        <div class="error"></div>
        <button class="cover-btn" type="submit">Enviar enlace</button>
        <div class="cover-links center"><a href="#">Volver a iniciar sesión</a></div>
      </form>`);
    bindForm(document.getElementById("forgotForm"), async (f) => {
      const { demoLink } = await BSData.requestPasswordReset(f.email);
      cover(`
        <div class="cover-form">
          <p class="cover-msg ok">Si <b>${esc(f.email)}</b> está registrado, te llegará un correo con el enlace para crear tu nueva contraseña. Revisa también la carpeta de spam.</p>
          ${demoLink ? `<p class="cover-msg">Modo demo: aquí no se envían correos. <a href="${esc(demoLink)}">Abrir el enlace de recuperación</a></p>` : ""}
          <div class="cover-links center"><a href="#">Volver a iniciar sesión</a></div>
        </div>`);
    }, "Enviando…");
  }

  function renderReset() {
    cover(`
      <form class="cover-form" id="resetForm">
        <h2 class="cover-title">Nueva contraseña</h2>
        <label class="cover-field"><span>Contraseña nueva</span><input name="password" type="password" autocomplete="new-password" minlength="6" required autofocus></label>
        <label class="cover-field"><span>Confirmar contraseña</span><input name="password2" type="password" autocomplete="new-password" minlength="6" required></label>
        <div class="error"></div>
        <button class="cover-btn" type="submit">Guardar contraseña</button>
      </form>`);
    bindForm(document.getElementById("resetForm"), async (f) => {
      if (f.password !== f.password2) throw new Error("Las contraseñas no coinciden.");
      await BSData.completePasswordReset(resetToken(), f.password);
      await BSData.logout?.();
      sessionStorage.removeItem(SESSION);
      history.replaceState(null, "", location.pathname);
      flash = "Contraseña actualizada. Ya puedes entrar.";
      publicScreen();
    }, "Guardando…");
  }

  // ---------- Shell ----------
  // Menú agrupado. "mobile: true" = aparece en la barra inferior del celular (el resto va en "Más").
  const NAV = [
    { id: "home", label: "Inicio", icon: "home", mobile: true },
    { group: "Aprender" },
    { id: "class", label: "Entrenamiento", icon: "course", mobile: true },
    { id: "roleplay", label: "Roleplay IA", icon: "chat" },
    { id: "calls", label: "Llamadas modelo", icon: "headphones" },
    { group: "Vender" },
    { id: "agenda", label: "Agenda", icon: "calendar", mobile: true },
    { id: "quote", label: "Cotizador", icon: "search" },
    { id: "carriers", label: "Carriers", icon: "building" },
    { id: "leads", label: "Inversión en leads", icon: "target" },
    { id: "sales", label: "Mis ventas", icon: "dollar", mobile: true },    { id: "illus", label: "Ilustraciones IUL", icon: "calc" },
    { group: "Crecer" },
    { id: "achievements", label: "Logros", icon: "medal" },
    { id: "ranking", label: "Ranking", icon: "trophy" },
    { group: "Equipo", admin: true },
    { id: "admin", label: "Administración", icon: "gear", admin: true },
  ];
  let moreOpen = false;

  function shell(inner) {
    const navItems = NAV.filter((n) => !n.admin || me.role === "admin");
    const btn = (n) => `<button class="nav-item" data-view="${n.id}" aria-current="${view === n.id ? "page" : "false"}">${ICON[n.icon]}<span>${n.label}</span></button>`;
    const items = navItems.map((n) => (n.group ? `<p class="nav-group">${n.group}</p>` : btn(n))).join("");
    const mobileItems = navItems.filter((n) => n.mobile).map(btn).join("");
    const inMore = !navItems.some((n) => n.mobile && n.id === view);
    return `
      <div class="app">
        <aside class="side">
          <div class="side-brand">${brand()}</div>
          <nav class="nav">${items}</nav>
          <div class="side-user">
            <div class="avatar">${esc(initials(me.name))}</div>
            <div class="who"><b>${esc(me.name)}</b><small>${me.role === "admin" ? "Administrador" : "Agente"}</small></div>
            <button class="icon-btn" id="logout" aria-label="Cerrar sesión" title="Cerrar sesión">${ICON.logout}</button>
          </div>
        </aside>
        <nav class="tabbar">
          ${mobileItems}
          <button class="nav-item" id="moreBtn" aria-current="${inMore ? "page" : "false"}">${ICON.grid}<span>Más</span></button>
        </nav>
        <div class="more-sheet ${moreOpen ? "open" : ""}" id="moreSheet"><div class="more-in">${items}</div></div>
        <main class="main"><div class="wrap">${inner}</div>
          <footer class="legal-foot"><a href="legal.html#terminos" target="_blank">Términos de uso</a><a href="legal.html#privacidad" target="_blank">Privacidad</a><a href="legal.html#grabaciones" target="_blank">Grabaciones</a></footer>
        </main>
      </div>`;
  }

  function goView(next) {
    view = next;
    moreOpen = false;
    render();
    window.scrollTo(0, 0);
  }

  function bindShell() {
    document.getElementById("logout").onclick = logout;
    document.querySelectorAll(".nav-item[data-view], [data-go]").forEach((b) =>
      (b.onclick = () => goView(b.dataset.view || b.dataset.go)));
    const sheet = document.getElementById("moreSheet");
    document.getElementById("moreBtn").onclick = () => { moreOpen = !moreOpen; sheet.classList.toggle("open", moreOpen); };
    sheet.onclick = (e) => { if (e.target === sheet) { moreOpen = false; sheet.classList.remove("open"); } };
  }

  function teardown() {
    if (cleanupPlayer) { cleanupPlayer(); cleanupPlayer = null; }
  }

  async function render() {
    teardown();
    closeModal();
    // Agentes que aún no aceptan la versión vigente de los términos (cuentas viejas o términos nuevos).
    if (me.role !== "admin" && me.termsVersion !== BSCommon.TERMS_VERSION) return renderTermsGate();
    if (view === "admin" && me.role === "admin") return renderAdmin();
    if (view === "ranking") return renderRanking();
    if (view === "class") return renderClass();
    if (window.BSViews?.[view]) return window.BSViews[view]();
    if (SOON[view]) return renderSoon(view);
    return renderHome();
  }

  function renderTermsGate() {
    const updated = !!me.termsVersion;
    cover(`
      <form class="cover-form" id="termsForm">
        <h2 class="cover-title">${updated ? "Actualizamos los términos" : "Antes de continuar"}</h2>
        <p class="cover-hint">Hola, ${esc(me.name.split(" ")[0])}. Para usar el portal necesitamos que leas y aceptes estos documentos:</p>
        <div class="legal-list">
          <a href="legal.html#terminos" target="_blank">Términos de uso</a>
          <a href="legal.html#privacidad" target="_blank">Política de privacidad</a>
          <a href="legal.html#grabaciones" target="_blank">Aviso sobre grabaciones</a>
        </div>
        ${termsCheck()}
        <div class="error"></div>
        <button class="cover-btn" type="submit">Aceptar y entrar</button>
        <div class="cover-links center"><a href="#" id="termsLogout">Salir</a></div>
      </form>`, { compact: true });
    document.getElementById("termsLogout").onclick = (e) => { e.preventDefault(); logout(); };
    bindForm(document.getElementById("termsForm"), async (f) => {
      if (!f.terms) throw new Error("Marca la casilla para continuar.");
      me = await BSData.acceptTerms(me.id);
      render();
    }, "Guardando…");
  }
  const termsCheck = () => `
    <label class="cover-check"><input type="checkbox" name="terms" value="1" required>
      <span>Acepto los <a href="legal.html#terminos" target="_blank">Términos de uso</a>, la <a href="legal.html#privacidad" target="_blank">Política de privacidad</a> y el <a href="legal.html#grabaciones" target="_blank">Aviso sobre grabaciones</a>. Soy mayor de 18 años.</span></label>`;

  // Secciones que todavía se están construyendo.
  const SOON = {
    achievements: ["Crecer", "Logros", "medal", "Gana insignias por tus avances: primera póliza, programa completado, metas del mes y más."],
  };
  function renderSoon(id) {
    const [group, title, icon, text] = SOON[id];
    $app.innerHTML = shell(`
      <div class="page-head"><div><p class="eyebrow">${group}</p><h1>${title}</h1></div></div>
      <section class="panel soon">
        <div class="soon-icon">${ICON[icon]}</div>
        <p class="eyebrow">Próximamente</p>
        <h2>${title}</h2>
        <p>${text}</p>
      </section>`);
    bindShell();
  }

  // ---------- Piezas compartidas ----------
  const firstName = (n) => esc(n.split(" ")[0]);
  const pctOf = (n, total) => (total ? Math.round((n / total) * 100) : 0);
  const dateLabel = () => new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });

  // ---------- Inicio ----------
  async function renderHome() {
    const [videos, progress, about, calls, sales, prefsList] = await Promise.all([
      BSData.listVideos(), BSData.getProgress(me.id), BSData.getAbout(),
      BSData.items(me.id, "call"), BSData.items(me.id, "sale"), BSData.items(me.id, "prefs"),
    ]);
    const done = videos.filter((v) => progress[v.id]?.done).length;
    const pct = pctOf(done, videos.length);
    const follow = window.BSFollow.pending(sales);
    const nextIdx = videos.findIndex((v) => !progress[v.id]?.done);
    const next = videos[nextIdx];

    const hero = !videos.length
      ? `<div class="hero"><p class="eyebrow">Entrenamiento</p><h2>Aún no hay lecciones</h2><p class="hero-sub">Tu manager publicará los videos muy pronto.</p></div>`
      : next
        ? `<div class="hero">
            <p class="eyebrow">${progress[next.id]?.max ? "Continúa donde te quedaste" : done ? "Tu siguiente lección" : "Empieza tu entrenamiento"}</p>
            <h2>${esc(next.title)}</h2>
            <p class="hero-sub">${(() => { const m = groupModules(videos).find((x) => x.items.includes(next)); return `${esc(m.name)} · Lección ${m.items.indexOf(next) + 1} de ${m.items.length}`; })()}${next.desc ? " · " + esc(next.desc) : ""}</p>
            <div class="hero-foot">
              <div class="hero-bar"><div class="bar dark"><i style="width:${pct}%"></i></div><span>${pct}% del programa</span></div>
              <button class="hero-btn" data-go="class">${ICON.play}<span>${progress[next.id]?.max ? "Continuar" : "Ver lección"}</span></button>
            </div>
          </div>`
        : `<div class="hero">
            <p class="eyebrow">Programa completado</p>
            <h2>Completaste las ${videos.length} lecciones</h2>
            <p class="hero-sub">Ya eres oficialmente parte del rebaño. Puedes repasar cualquier lección cuando quieras.</p>
            <div class="hero-foot"><span></span><button class="hero-btn" data-go="class">${ICON.course}<span>Repasar</span></button></div>
          </div>`;

    $app.innerHTML = shell(`
      <div class="page-head"><div><p class="eyebrow cap">${dateLabel()}</p><h1>Hola, ${firstName(me.name)}</h1></div></div>
      ${follow.some((x) => x.late) ? homeFollow(follow) : ""}
      ${hero}
      <div class="stats">
        <div class="stat"><span>Lecciones completadas</span><b>${done}<small>/${videos.length}</small></b></div>
        <div class="stat"><span>Tu progreso</span><b>${pct}<small>%</small></b></div>
      </div>
      ${follow.some((x) => x.late) ? "" : homeFollow(follow)}
      <div class="home-grid">
        ${homeCalls(calls)}
        ${homeSales(sales, prefsList[0] || {})}
      </div>
      ${aboutSection(about)}`);
    bindShell();
    window.BSFollow.bindList(follow);
  }

  // Seguimiento obligatorio de clientes (modules/seguimientos.js): solo aparece si hay algo por hacer.
  function homeFollow(items) {
    if (!items.length) return "";
    const late = items.filter((x) => x.late).length;
    return `
      <section class="panel home-card fu-panel ${late ? "has-late" : ""}">
        <div class="panel-head">
          <h3>Seguimiento de clientes</h3>
          <span>${late ? `<b class="neg">${late} atrasado${late === 1 ? "" : "s"}</b> · ` : ""}${items.length} por hacer</span>
        </div>
        ${window.BSFollow.listHtml(items, { limit: 4 })}
        <div class="home-foot"><button class="link-btn" data-go="sales">Ver todos en Mis ventas →</button></div>
      </section>`;
  }

  // ---------- Inicio: tu día ----------
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fmt12 = (t) => { let [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${h}:${String(m).padStart(2, "0")}${ap}`; };

  function homeCalls(calls) {
    const today = ymd(new Date()), now = Date.now();
    const at = (c) => new Date(`${c.date}T${c.time}`).getTime();
    const pending = calls.filter((c) => c.status === "pending");
    const todays = pending.filter((c) => c.date === today).sort((a, b) => a.time.localeCompare(b.time));
    const late = pending.filter((c) => at(c) < now).length;
    const rows = todays.slice(0, 5).map((c) => `
      <li class="${at(c) < now ? "late" : ""}">
        <span class="hc-time">${fmt12(c.time)}</span>
        <span class="hc-who"><b>${esc(c.name)}</b>${c.note ? `<small>${esc(c.note)}</small>` : ""}</span>
        ${c.phone ? `<a class="icon-btn" href="tel:${esc(c.phone)}" aria-label="Llamar a ${esc(c.name)}">${ICON.phone}</a>` : ""}
      </li>`).join("");
    return `
      <section class="panel home-card">
        <div class="panel-head">
          <h3>Tus llamadas de hoy</h3>
          <span>${todays.length} ${todays.length === 1 ? "llamada" : "llamadas"}${late ? ` · <b class="neg">${late} atrasada${late === 1 ? "" : "s"}</b>` : ""}</span>
        </div>
        ${rows ? `<ul class="home-calls">${rows}</ul>${todays.length > 5 ? `<p class="hint home-more">y ${todays.length - 5} más…</p>` : ""}`
          : `<div class="empty small"><p>No tienes llamadas agendadas para hoy.</p></div>`}
        <div class="home-foot"><button class="link-btn" data-go="agenda">Ver agenda →</button></div>
      </section>`;
  }

  function homeSales(sales, prefs) {
    const S = window.BSSales;
    const month = ymd(new Date()).slice(0, 7);
    const t = S.totals(sales.filter((s) => String(s.date).startsWith(month)));
    const goal = +prefs.goal || 0;
    const monthName = new Date().toLocaleDateString("es", { month: "long" });
    return `
      <section class="panel home-card">
        <div class="panel-head"><h3>Tus ventas de ${monthName}</h3><span>${t.count} ${t.count === 1 ? "póliza" : "pólizas"}</span></div>
        <div class="home-sales">
          <div><span>AP</span><b>${S.money(t.ap)}</b></div>
          <div><span>Comisión</span><b>${S.money(t.ip)}</b></div>
          <div><span>Adelanto</span><b class="gold">${S.money(t.adv)}</b></div>
        </div>
        ${goal ? `<div class="home-goal"><div class="bar"><i style="width:${Math.min(100, (t.ap / goal) * 100)}%"></i></div>
          <small>${t.ap >= goal ? "¡Meta cumplida! 🔥" : `${S.money(goal - t.ap)} para tu meta de ${S.money(goal)}`}</small></div>`
          : `<p class="hint home-more">Ponte una meta del mes en Mis ventas para ver tu avance aquí.</p>`}
        <div class="home-foot"><button class="link-btn" data-go="sales">Ver mis ventas →</button></div>
      </section>`;
  }

  // ---------- Quiénes somos ----------
  // Lo que va entre comillas se resalta en blanco, como "así son las cosas".
  const richText = (s) => esc(s).replace(/(“[^”]+”|&quot;[^&]+?&quot;)/g, "<em>$1</em>");

  function aboutSection(a) {
    const paragraphs = [a.p1, a.p2].filter(Boolean);
    const pillars = a.pillars.filter((p) => p.title || p.text);
    return `
      <section class="about">
        <div class="about-mark" aria-hidden="true">${logoMark()}</div>
        <p class="eyebrow">Quiénes somos</p>
        <h2>${esc(a.title).replace(/\n/g, "<br>")}</h2>
        ${paragraphs.length ? `<div class="about-text ${paragraphs.length === 1 ? "single" : ""}">${paragraphs.map((p) => `<p>${richText(p)}</p>`).join("")}</div>` : ""}
        ${pillars.length ? `<div class="pillars" style="--cols:${pillars.length}">
          ${pillars.map((p, i) => `<div class="pillar"><span>${String(i + 1).padStart(2, "0")}</span><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>`).join("")}
        </div>` : ""}
        ${a.closing || a.highlight ? `<p class="about-sign">${esc(a.closing)} <b>${esc(a.highlight)}</b></p>` : ""}
      </section>`;
  }

  // ---------- Ranking de ventas ----------
  // Se conectará más adelante con el dashboard de ventas.
  function renderRanking() {
    $app.innerHTML = shell(`
      <div class="page-head"><div><p class="eyebrow">Ventas</p><h1>Ranking</h1></div></div>
      <section class="panel soon">
        <div class="soon-icon">${ICON.trophy}</div>
        <p class="eyebrow">Próximamente</p>
        <h2>Ranking de ventas</h2>
        <p>Aquí verás a los mejores vendedores de Black Sheep. Muy pronto se conectará con el dashboard de ventas.</p>
      </section>`);
    bindShell();
  }

  // ---------- Aula ----------
  function groupModules(videos) {
    const out = [];
    videos.forEach((v) => {
      const name = v.module || BSCommon.DEFAULT_MODULE;
      let m = out.find((x) => x.name === name);
      if (!m) out.push((m = { name, items: [] }));
      m.items.push(v);
    });
    return out;
  }

  async function renderClass() {
    const [videos, progress] = await Promise.all([BSData.listVideos(), BSData.getProgress(me.id)]);
    const doneCount = videos.filter((v) => progress[v.id]?.done).length;
    const firstOpen = videos.findIndex((v) => !progress[v.id]?.done);   // -1 = todo completado
    const unlockedUpTo = firstOpen === -1 ? videos.length - 1 : firstOpen;
    const pct = videos.length ? Math.round((doneCount / videos.length) * 100) : 0;

    let idx = videos.findIndex((v) => v.id === selectedId);
    if (idx === -1 || idx > unlockedUpTo) idx = firstOpen === -1 ? -1 : firstOpen;
    const current = idx >= 0 ? videos[idx] : null;
    selectedId = current?.id ?? null;

    const head = `
      <div class="page-head">
        <div><p class="eyebrow">Programa de formación</p><h1>Entrenamiento</h1></div>
        <div class="progress-sum">
          <div class="row"><span>Tu progreso</span><b>${doneCount} de ${videos.length} · ${pct}%</b></div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>
      </div>`;

    if (!videos.length) {
      $app.innerHTML = shell(head + `<div class="panel empty"><h2>Aún no hay lecciones</h2><p>Tu manager publicará los videos muy pronto.</p></div>`);
      return bindShell();
    }

    // Agrupa por módulo, en el orden en que aparecen. Se desbloquea en orden a través de todos los módulos.
    const modules = groupModules(videos);
    const list = modules.map((m) => `
      <li class="module-head"><b>${esc(m.name)}</b><small>${m.items.filter((v) => progress[v.id]?.done).length}/${m.items.length}</small></li>
      ${m.items.map((v, k) => {
        const i = videos.indexOf(v), p = progress[v.id], done = p?.done, locked = i > unlockedUpTo;
        const status = done ? "Completado" : locked ? "Bloqueado" : p?.max ? `En curso · ${fmt(p.max)}` : "Disponible";
        return `<li><button class="lesson-item ${done ? "done" : ""}" data-id="${v.id}" ${locked ? "disabled" : ""} aria-current="${v.id === selectedId}">
          <span class="num">${done ? ICON.check : locked ? ICON.lock : k + 1}</span>
          <span><b>${esc(v.title)}</b><small>Lección ${k + 1} · ${status}</small></span>
        </button></li>`;
      }).join("")}`).join("");
    const curMod = current && modules.find((m) => m.items.includes(current));

    const main = current ? `
      <section class="panel player">
        <div class="video-box">
          <video id="vid" src="${esc(current.url)}" playsinline preload="metadata" disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video>
          <div class="video-overlay" id="overlay"><div class="play-big">${ICON.play}</div></div>
        </div>
        <div class="controls">
          <button class="ctrl" id="playBtn" aria-label="Reproducir">${ICON.play}</button>
          <div class="seek" id="seek" title="Solo puedes regresar a partes que ya viste">
            <div class="track"></div><div class="watched" id="watched"></div><div class="played" id="played"></div><div class="knob" id="knob"></div>
          </div>
          <span class="time" id="time">0:00 / 0:00</span>
          <button class="ctrl" id="muteBtn" aria-label="Silenciar">${ICON.vol}</button>
          <button class="ctrl" id="fullBtn" aria-label="Pantalla completa">${ICON.full}</button>
        </div>
        <div class="lesson-info">
          <p class="eyebrow">${esc(curMod.name)} · Lección ${curMod.items.indexOf(current) + 1} de ${curMod.items.length}</p>
          <h2>${esc(current.title)}</h2>
          ${current.desc ? `<p>${esc(current.desc)}</p>` : ""}
          <div class="rule">${ICON.info}<span>Debes ver el video completo para desbloquear la siguiente lección. No es posible adelantar ni cambiar la velocidad; el video se pausa si cambias de pestaña.</span></div>
          <div class="next-row">
            <span class="status-pill ${progress[current.id]?.done ? "ok" : ""}" id="statusPill">${progress[current.id]?.done ? "Completado" : "Pendiente"}</span>
            ${idx < videos.length - 1 ? `<button class="btn" id="nextBtn" ${progress[current.id]?.done ? "" : "disabled"}>Siguiente lección →</button>` : ""}
          </div>
        </div>
      </section>` : `
      <section class="panel finish">
        ${logoMark()}
        <h2>¡Programa completado!</h2>
        <p>Viste las ${videos.length} lecciones. Ya eres oficialmente parte del rebaño. Puedes repasar cualquier lección desde la lista.</p>
      </section>`;

    $app.innerHTML = shell(head + `
      <div class="classroom">
        ${main}
        <aside class="panel">
          <div class="panel-head"><h3>Lecciones</h3><span>${doneCount}/${videos.length}</span></div>
          <ul class="lesson-list">${list}</ul>
        </aside>
      </div>`);
    bindShell();

    document.querySelectorAll(".lesson-item").forEach((b) => (b.onclick = () => { selectedId = b.dataset.id; render(); }));
    const next = document.getElementById("nextBtn");
    if (next) next.onclick = () => { selectedId = videos[idx + 1].id; render(); };
    if (current) cleanupPlayer = mountPlayer(current, progress[current.id] || {});
  }

  // ---------- Reproductor bloqueado ----------
  function mountPlayer(video, saved) {
    const v = document.getElementById("vid");
    const box = v.parentElement;
    const overlay = document.getElementById("overlay");
    const playBtn = document.getElementById("playBtn");
    const seek = document.getElementById("seek");
    const els = { watched: document.getElementById("watched"), played: document.getElementById("played"), knob: document.getElementById("knob"), time: document.getElementById("time") };

    let done = !!saved.done;
    let maxWatched = saved.max || 0;     // punto más lejano visto legítimamente
    let lastSave = 0;
    let guard = false;                   // evita bucles al corregir currentTime

    const persist = async (extra = {}) => {
      lastSave = Date.now();
      await BSData.saveProgress(me.id, video.id, { max: maxWatched, duration: v.duration || 0, ...extra });
    };

    function paint() {
      const d = v.duration || 0;
      const pp = d ? (v.currentTime / d) * 100 : 0;
      const wp = d ? (Math.max(maxWatched, v.currentTime) / d) * 100 : 0;
      els.played.style.width = pp + "%";
      els.watched.style.width = (done ? 100 : wp) + "%";
      els.knob.style.left = pp + "%";
      els.time.textContent = `${fmt(v.currentTime)} / ${fmt(d)}`;
    }

    function snapBack() {
      guard = true;
      v.currentTime = maxWatched;
      toast("No puedes adelantar el video. Debes verlo completo.");
    }

    const onMeta = () => {
      if (!done && maxWatched > 0 && maxWatched < v.duration - 1) v.currentTime = maxWatched;
      paint();
    };
    const onTime = () => {
      if (guard) { guard = false; return paint(); }
      if (!done) {
        // Avance normal: ~0.25 s entre eventos. Un salto mayor es un intento de adelantar.
        if (v.currentTime > maxWatched + 1.5) return snapBack();
        maxWatched = Math.max(maxWatched, v.currentTime);
        if (Date.now() - lastSave > 5000) persist();
      }
      paint();
    };
    const onSeeking = () => { if (!done && v.currentTime > maxWatched + 1) snapBack(); };
    const onRate = () => { if (v.playbackRate !== 1) v.playbackRate = 1; };
    const onPlay = () => { overlay.classList.add("hidden"); playBtn.innerHTML = ICON.pause; playBtn.setAttribute("aria-label", "Pausar"); };
    const onPause = () => { overlay.classList.remove("hidden"); playBtn.innerHTML = ICON.play; playBtn.setAttribute("aria-label", "Reproducir"); };
    const onEnded = async () => {
      if (done) return;
      if (maxWatched >= v.duration - 2) {
        done = true;
        maxWatched = v.duration;
        await persist({ done: true });
        toast("¡Lección completada! Se desbloqueó la siguiente.");
        render();
      }
    };
    const onError = () => toast("No se pudo cargar el video. Revisa tu conexión o avisa a tu manager.");
    const onHidden = () => { if (document.hidden && !v.paused) v.pause(); };
    const toggle = () => (v.paused ? v.play() : v.pause());
    const onKey = (e) => {
      if (e.code === "Space" && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); toggle(); }
    };

    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("ratechange", onRate);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("error", onError);
    v.addEventListener("contextmenu", (e) => e.preventDefault());
    v.addEventListener("click", toggle);
    overlay.onclick = toggle;
    playBtn.onclick = toggle;
    document.addEventListener("visibilitychange", onHidden);
    document.addEventListener("keydown", onKey);

    seek.onclick = (e) => {
      const r = seek.getBoundingClientRect();
      const t = ((e.clientX - r.left) / r.width) * (v.duration || 0);
      if (done || t <= maxWatched) { guard = true; v.currentTime = t; }
      else toast("Solo puedes regresar a partes que ya viste.");
    };
    document.getElementById("muteBtn").onclick = (e) => {
      v.muted = !v.muted;
      e.currentTarget.innerHTML = v.muted ? ICON.mute : ICON.vol;
    };
    document.getElementById("fullBtn").onclick = () => {
      document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen?.();
    };

    return () => {
      if (!done && maxWatched > 0) persist();
      v.pause();
      document.removeEventListener("visibilitychange", onHidden);
      document.removeEventListener("keydown", onKey);
    };
  }

  // ---------- Ventana modal ----------
  let activeModal = null;
  function closeModal() {
    if (activeModal) { activeModal.close(); activeModal.remove(); activeModal = null; }
  }
  function openModal(title, body, onMount) {
    closeModal();
    const dlg = document.createElement("dialog");
    dlg.className = "modal";
    dlg.innerHTML = `
      <div class="modal-head"><h3>${title}</h3><button class="icon-btn" data-close aria-label="Cerrar">${ICON.x}</button></div>
      <div class="modal-body">${body}</div>`;
    document.body.appendChild(dlg);
    activeModal = dlg;
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) closeModal(); });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeModal(); });
    dlg.showModal();
    onMount?.(dlg);
  }

  // ---------- Administración ----------
  let adminTab = "agents";   // "agents" | "lessons" | "settings"
  const STATUS = { pending: "Pendiente", active: "Activo", disabled: "Inactivo" };
  const statusTag = (u) => { const s = BSCommon.status(u); return `<span class="tag st-${s}">${STATUS[s]}</span>`; };
  const signupLink = () => `${location.origin}${location.pathname}#registro`;

  async function renderAdmin() {
    const [users, videos, settings] = await Promise.all([BSData.listUsers(), BSData.listVideos(), BSData.getSettings()]);
    const pending = users.filter((u) => !u.approved);
    const tabs = [
      ["agents", `Agentes${pending.length ? ` <span class="count">${pending.length}</span>` : ""}`],
      ["lessons", "Lecciones"],
      ["content", "Contenido"],
      ["roleplay", "Roleplay"],
      ["settings", "Ajustes"],
    ].map(([id, label]) => `<button class="seg-btn" data-tab="${id}" aria-selected="${adminTab === id}">${label}</button>`).join("");

    let body = "";
    if (adminTab === "agents") body = await adminAgents(users, videos, pending);
    if (adminTab === "lessons") body = adminLessons(videos);
    if (adminTab === "content") body = adminContent(await BSData.getAbout());
    if (adminTab === "roleplay") body = await window.BSRoleplayAdmin.html();
    if (adminTab === "settings") body = adminSettings(settings);

    $app.innerHTML = shell(`
      <div class="page-head"><div><p class="eyebrow">Panel de control</p><h1>Administración</h1></div></div>
      <div class="seg" role="tablist">${tabs}</div>
      ${body}`);
    bindShell();
    document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { adminTab = b.dataset.tab; render(); }));
    if (adminTab === "agents") bindAgents(users, videos);
    if (adminTab === "lessons") bindLessons(videos);
    if (adminTab === "content") bindContent();
    if (adminTab === "roleplay") window.BSRoleplayAdmin.bind();
    if (adminTab === "settings") bindSettings();
  }

  // ----- Contenido (Quiénes somos) -----
  function adminContent(a) {
    const area = (name, value, rows = 4) => `<textarea class="input" name="${name}" rows="${rows}">${esc(value)}</textarea>`;
    return `
      <form class="panel card-pad content-form" id="aboutForm">
        <div class="content-head">
          <div>
            <h3>Quiénes somos</h3>
            <p class="hint">Este texto aparece al final del Inicio de todos los agentes. Lo que pongas entre comillas “así” se resalta.</p>
          </div>
          <button class="btn btn-ghost btn-sm" type="button" data-go="home">Ver en el Inicio</button>
        </div>
        <label class="field"><span>Título (Enter = salto de línea)</span>${area("title", a.title, 2)}</label>
        <div class="form-grid">
          <label class="field"><span>Párrafo 1</span>${area("p1", a.p1, 6)}</label>
          <label class="field"><span>Párrafo 2</span>${area("p2", a.p2, 6)}</label>
        </div>
        <div class="pillar-fields">
          ${a.pillars.map((p, i) => `
            <div>
              <p class="pillar-label">Pilar ${String(i + 1).padStart(2, "0")}</p>
              <label class="field"><span>Nombre</span><input class="input" name="pt${i}" value="${esc(p.title)}"></label>
              <label class="field"><span>Texto</span>${area(`px${i}`, p.text, 6)}</label>
            </div>`).join("")}
        </div>
        <div class="form-grid">
          <label class="field"><span>Frase final</span><input class="input" name="closing" value="${esc(a.closing)}"></label>
          <label class="field"><span>Frase en dorado</span><input class="input" name="highlight" value="${esc(a.highlight)}"></label>
        </div>
        <p class="hint">Si dejas un párrafo o un pilar vacío, no se muestra.</p>
        <div class="error"></div>
        <div class="modal-foot">
          <button class="btn btn-ghost" type="button" id="aboutReset">Restaurar texto original</button>
          <button class="btn" type="submit">Guardar cambios</button>
        </div>
      </form>`;
  }

  function bindContent() {
    const form = document.getElementById("aboutForm");
    bindForm(form, async (f) => {
      await BSData.saveAbout({
        title: f.title, p1: f.p1, p2: f.p2, closing: f.closing, highlight: f.highlight,
        pillars: [0, 1, 2].map((i) => ({ title: f[`pt${i}`], text: f[`px${i}`] })),
      });
      toast("Texto guardado. Ya se ve en el Inicio.");
    }, "Guardando…");
    document.getElementById("aboutReset").onclick = async () => {
      if (!confirm("¿Volver al texto original de Quiénes somos? Se perderán tus cambios.")) return;
      await BSData.saveAbout(null);
      toast("Texto original restaurado.");
      render();
    };
  }

  // ----- Agentes -----
  async function adminAgents(users, videos, pending) {
    const approved = users.filter((u) => u.approved);
    const progressByUser = Object.fromEntries(await Promise.all(users.map(async (u) => [u.id, await BSData.getProgress(u.id)])));
    // Seguimientos de clientes atrasados por agente (el admin puede leer las ventas de todos).
    const lateByUser = Object.fromEntries(await Promise.all(approved.map(async (u) => [u.id, window.BSFollow.lateCount(await BSData.items(u.id, "sale"))])));
    const fecha = (t) => (t ? new Date(t).toLocaleDateString("es", { day: "numeric", month: "short" }) : "");

    const pendingPanel = pending.length ? `
      <section class="panel pending-panel">
        <div class="panel-head"><h3>Solicitudes pendientes</h3><span>${pending.length} por aprobar</span></div>
        <div class="table-scroll"><table class="table">
          ${pending.map((u) => `<tr>
            <td><b>${esc(u.name)}</b><br><small class="muted">@${esc(u.username)}</small></td>
            <td class="hide-sm">${esc(u.email)}</td>
            <td class="hide-sm muted">${fecha(u.createdAt)}</td>
            <td><div class="actions">
              <button class="btn btn-sm" data-approve="${u.id}">Aprobar</button>
              <button class="btn btn-ghost btn-sm btn-danger" data-reject="${u.id}">Rechazar</button>
            </div></td>
          </tr>`).join("")}
        </table></div>
      </section>` : "";

    const rows = approved.map((u) => {
      const p = progressByUser[u.id];
      const n = videos.filter((v) => p[v.id]?.done).length;
      const pct = videos.length ? Math.round((n / videos.length) * 100) : 0;
      return `<tr class="row-link" data-edit="${u.id}" data-search="${esc(`${u.name} ${u.username} ${u.email}`.toLowerCase())}">
        <td><div class="agent"><span class="avatar sm">${esc(initials(u.name))}</span><span><b>${esc(u.name)}</b>${u.id === me.id ? '<small class="you">Tú</small>' : ""}<br><small class="muted">@${esc(u.username)}</small></span></div></td>
        <td class="hide-md">${esc(u.email) || '<span class="muted">—</span>'}</td>
        <td>${u.role === "admin" ? '<span class="tag admin">Admin</span> ' : ""}${statusTag(u)}</td>
        <td class="hide-sm"><div class="mini-bar"><div class="bar"><i style="width:${pct}%"></i></div></div><small class="muted">${n}/${videos.length} lecciones</small></td>
        <td class="hide-sm">${lateByUser[u.id] ? `<b class="neg">${lateByUser[u.id]} atrasado${lateByUser[u.id] === 1 ? "" : "s"}</b>` : '<span class="muted">Al día</span>'}</td>
        <td><div class="actions"><button class="btn btn-ghost btn-sm" data-edit="${u.id}">Editar</button></div></td>
      </tr>`;
    }).join("");

    return `
      ${pendingPanel}
      <section class="panel">
        <div class="panel-head">
          <h3>Agentes <span class="muted">· ${approved.length}</span></h3>
          <div class="toolbar">
            <input class="input search" id="userSearch" type="search" placeholder="Buscar por nombre, usuario o correo">
            <button class="btn btn-sm" id="newUser">${ICON.plus}<span>Nuevo agente</span></button>
          </div>
        </div>
        <div class="table-scroll"><table class="table">
          <thead><tr><th>Agente</th><th class="hide-md">Correo</th><th>Estado</th><th class="hide-sm">Entrenamiento</th><th class="hide-sm">Seguimientos</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </section>`;
  }

  function bindAgents(users) {
    const search = document.getElementById("userSearch");
    search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      document.querySelectorAll("tr[data-search]").forEach((tr) => { tr.hidden = q && !tr.dataset.search.includes(q); });
    };
    document.getElementById("newUser").onclick = newUserModal;
    document.querySelectorAll("[data-edit]").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); editUserModal(el.dataset.edit); }));
    document.querySelectorAll("[data-approve]").forEach((b) => (b.onclick = async () => {
      await BSData.approveUser(b.dataset.approve);
      toast("Cuenta aprobada. Ya puede entrar.");
      render();
    }));
    document.querySelectorAll("[data-reject]").forEach((b) => (b.onclick = async () => {
      const u = users.find((x) => x.id === b.dataset.reject);
      if (!confirm(`¿Rechazar y borrar la solicitud de ${u.name}?`)) return;
      await BSData.deleteUser(u.id);
      toast("Solicitud rechazada.");
      render();
    }));
  }

  const userFields = (u = {}, { password = false, role = true } = {}) => `
    <div class="form-grid">
      <label class="field"><span>Nombre completo</span><input class="input" name="name" value="${esc(u.name)}" required></label>
      <label class="field"><span>Usuario</span><input class="input" name="username" value="${esc(u.username)}" placeholder="ej. juan.perez" required></label>
      <label class="field"><span>Correo</span><input class="input" name="email" type="email" value="${esc(u.email)}"></label>
      ${role ? `<label class="field"><span>Rol</span><select class="input" name="role">
        <option value="agent" ${u.role !== "admin" ? "selected" : ""}>Agente</option>
        <option value="admin" ${u.role === "admin" ? "selected" : ""}>Administrador</option>
      </select></label>` : ""}
      ${password ? `<label class="field"><span>Contraseña</span><input class="input" name="password" minlength="6" required></label>` : ""}
    </div>`;

  function newUserModal() {
    openModal("Nuevo agente", `
      <form id="newUserForm">
        <p class="hint">La cuenta queda activa de inmediato. Compártele su usuario y contraseña.</p>
        ${userFields({}, { password: true })}
        <div class="error"></div>
        <div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn" type="submit">Crear agente</button></div>
      </form>`, (dlg) => {
      bindForm(dlg.querySelector("form"), async (f) => {
        await BSData.createUser(f);
        closeModal();
        toast("Agente creado.");
        render();
      }, "Creando…");
    });
  }

  async function editUserModal(id) {
    const [users, videos, progress] = await Promise.all([BSData.listUsers(), BSData.listVideos(), BSData.getProgress(id)]);
    const u = users.find((x) => x.id === id);
    if (!u) return;
    const isMe = u.id === me.id;
    const lessonRows = videos.map((v, i) => `
      <li class="check-row">
        <span><b>${i + 1}. ${esc(v.title)}</b><small class="muted">${progress[v.id]?.done ? "Completada" : progress[v.id]?.max ? `En curso · ${fmt(progress[v.id].max)}` : "Sin empezar"}</small></span>
        <button class="btn btn-sm ${progress[v.id]?.done ? "" : "btn-ghost"}" data-lesson="${v.id}" data-done="${progress[v.id]?.done ? 1 : 0}">${progress[v.id]?.done ? `${ICON.check} Completada` : "Marcar completada"}</button>
      </li>`).join("");

    openModal(esc(u.name), `
      <div class="modal-status">${u.role === "admin" ? '<span class="tag admin">Admin</span> ' : ""}${statusTag(u)} <span class="muted">@${esc(u.username)}</span></div>

      <form class="modal-section" id="dataForm">
        <h4>Datos</h4>
        ${userFields(u, { role: !isMe })}
        <div class="error"></div>
        <div class="modal-foot"><button class="btn" type="submit">Guardar cambios</button></div>
      </form>

      <form class="modal-section" id="passForm">
        <h4>Contraseña</h4>
        <div class="inline-form">
          <input class="input" name="password" placeholder="Contraseña nueva" minlength="6" required>
          <button class="btn" type="submit">Cambiar</button>
        </div>
        <div class="error"></div>
      </form>

      <div class="modal-section">
        <h4>Entrenamiento</h4>
        <ul class="check-list">${lessonRows || '<li class="muted">No hay lecciones.</li>'}</ul>
        <button class="btn btn-ghost btn-sm" id="resetProg">Reiniciar todo el progreso</button>
      </div>

      ${u.role === "admin" ? "" : `
      <div class="modal-section">
        <h4>Términos y privacidad</h4>
        <p class="muted">${u.termsAcceptedAt
          ? `Aceptó la versión ${esc(u.termsVersion)} el ${new Date(u.termsAcceptedAt).toLocaleString("es", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}${u.termsVersion !== BSCommon.TERMS_VERSION ? " · se le pedirá aceptar la versión nueva al entrar" : ""}.`
          : "Todavía no los acepta. Se le pedirá al entrar."}</p>
      </div>`}

      ${isMe ? "" : `
      <div class="modal-section danger">
        <h4>Acceso</h4>
        <div class="actions start">
          ${u.approved ? `<button class="btn btn-ghost btn-sm" id="toggleUser">${u.disabled ? "Reactivar acceso" : "Desactivar acceso"}</button>` : `<button class="btn btn-sm" id="approveUser">Aprobar cuenta</button>`}
          <button class="btn btn-ghost btn-sm btn-danger" id="deleteUser">Eliminar agente</button>
        </div>
      </div>`}`, (dlg) => {
      const $ = (s) => dlg.querySelector(s);
      bindForm($("#dataForm"), async (f) => {
        await BSData.updateUser(id, { ...f, role: isMe ? u.role : f.role });
        if (isMe) me = { ...me, name: f.name.trim() };
        closeModal();
        toast("Cambios guardados.");
        render();
      }, "Guardando…");
      bindForm($("#passForm"), async (f, form) => {
        await BSData.setPassword(id, f.password);
        form.reset();
        toast("Contraseña actualizada.");
      }, "Cambiando…");
      dlg.querySelectorAll("[data-lesson]").forEach((b) => (b.onclick = async () => {
        const done = b.dataset.done !== "1";
        if (!done && !confirm("¿Quitar esta lección como completada? El agente tendrá que verla otra vez.")) return;
        await BSData.setLessonDone(id, b.dataset.lesson, done);
        await render();
        await editUserModal(id);
      }));
      $("#resetProg").onclick = async () => {
        if (!confirm(`¿Reiniciar todo el progreso de ${u.name}? Tendrá que ver los videos desde el inicio.`)) return;
        await BSData.resetProgress(id);
        toast("Progreso reiniciado.");
        await render();
        await editUserModal(id);
      };
      if (isMe) return;
      const tog = $("#toggleUser"), appr = $("#approveUser");
      if (tog) tog.onclick = async () => { await BSData.toggleUser(id); toast(u.disabled ? "Acceso reactivado." : "Acceso desactivado."); closeModal(); render(); };
      if (appr) appr.onclick = async () => { await BSData.approveUser(id); toast("Cuenta aprobada."); closeModal(); render(); };
      $("#deleteUser").onclick = async () => {
        if (!confirm(`¿Eliminar a ${u.name} y todo su progreso? No se puede deshacer.`)) return;
        await BSData.deleteUser(id);
        closeModal();
        toast("Agente eliminado.");
        render();
      };
    });
  }

  // ----- Lecciones -----
  function adminLessons(videos) {
    const rows = videos.map((v, i) => `<tr>
        <td class="c-idx">${i + 1}</td>
        <td><b>${esc(v.title)}</b>${v.desc ? `<br><small class="muted">${esc(v.desc)}</small>` : ""}</td>
        <td class="hide-sm"><span class="tag">${esc(v.module || BSCommon.DEFAULT_MODULE)}</span></td>
        <td class="hide-sm"><span class="tag">${v.storage_path ? "Archivo" : "Enlace"}</span></td>
        <td><div class="actions">
          <span class="order-btns">
            <button class="btn btn-ghost btn-sm" data-move="-1" data-id="${v.id}" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button>
            <button class="btn btn-ghost btn-sm" data-move="1" data-id="${v.id}" ${i === videos.length - 1 ? "disabled" : ""} aria-label="Bajar">↓</button>
          </span>
          <button class="btn btn-ghost btn-sm" data-vedit="${v.id}">Editar</button>
          <button class="btn btn-ghost btn-sm btn-danger" data-vdel="${v.id}">Eliminar</button>
        </div></td>
      </tr>`).join("");
    return `
      <section class="panel">
        <div class="panel-head">
          <h3>Lecciones <span class="muted">· se ven en este orden</span></h3>
          <button class="btn btn-sm" id="newLesson">${ICON.plus}<span>Nueva lección</span></button>
        </div>
        <div class="table-scroll"><table class="table">${rows || `<tr><td class="empty">Sin lecciones todavía.</td></tr>`}</table></div>
      </section>`;
  }

  function lessonModal(v, videos) {
    const mods = [...new Set(videos.map((x) => x.module || BSCommon.DEFAULT_MODULE))];
    const defMod = v?.module || mods[mods.length - 1] || BSCommon.DEFAULT_MODULE;
    openModal(v ? "Editar lección" : "Nueva lección", `
      <form id="lessonForm">
        <label class="field"><span>Módulo</span><input class="input" name="module" list="modList" value="${esc(defMod)}" placeholder="${esc(BSCommon.DEFAULT_MODULE)}">
          <datalist id="modList">${mods.map((m) => `<option value="${esc(m)}">`).join("")}</datalist></label>
        <label class="field"><span>Título</span><input class="input" name="title" value="${esc(v?.title)}" required></label>
        <label class="field"><span>Descripción</span><textarea class="input" name="desc">${esc(v?.desc)}</textarea></label>
        <label class="field"><span>${v ? "Reemplazar video (archivo MP4)" : "Archivo de video (MP4)"}</span><input class="input" name="file" type="file" accept="video/mp4,video/webm,video/quicktime"></label>
        <label class="field"><span>${v ? "…o nuevo enlace" : "…o enlace del video"}</span><input class="input" name="url" placeholder="${v ? "Déjalo vacío para mantener el video actual" : "https://…"}"></label>
        <div class="error"></div>
        <div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn" type="submit">${v ? "Guardar cambios" : "Agregar lección"}</button></div>
      </form>`, (dlg) => {
      bindForm(dlg.querySelector("form"), async (f) => {
        const data = { ...f, file: f.file?.size ? f.file : null };
        if (v) await BSData.updateVideo(v.id, data); else await BSData.addVideo(data);
        closeModal();
        toast(v ? "Lección actualizada." : "Lección agregada.");
        render();
      }, "Guardando…");
    });
  }

  function bindLessons(videos) {
    document.getElementById("newLesson").onclick = () => lessonModal(null, videos);
    document.querySelectorAll("[data-vedit]").forEach((b) => (b.onclick = () => lessonModal(videos.find((v) => v.id === b.dataset.vedit), videos)));
    document.querySelectorAll("[data-move]").forEach((b) => (b.onclick = async () => { await BSData.moveVideo(b.dataset.id, Number(b.dataset.move)); render(); }));
    document.querySelectorAll("[data-vdel]").forEach((b) => (b.onclick = async () => {
      if (!confirm("¿Eliminar esta lección? Se borrará el progreso de todos en ella.")) return;
      await BSData.deleteVideo(b.dataset.vdel);
      toast("Lección eliminada.");
      render();
    }));
  }

  // ----- Ajustes -----
  function adminSettings(s) {
    return `
      <section class="panel card-pad settings">
        <h3>Registro de agentes</h3>
        <p class="hint">Controla si los agentes pueden crear su propia cuenta desde el enlace de registro.</p>
        <label class="switch-row">
          <span><b>Permitir que los agentes creen su cuenta</b><small>Aparece "Crear cuenta" en la portada.</small></span>
          <input type="checkbox" class="switch" data-setting="allowSignup" ${s.allowSignup ? "checked" : ""}>
        </label>
        <label class="switch-row">
          <span><b>Las cuentas nuevas necesitan mi aprobación</b><small>Recomendado: así nadie ajeno a la agencia ve los videos.</small></span>
          <input type="checkbox" class="switch" data-setting="requireApproval" ${s.requireApproval ? "checked" : ""}>
        </label>
        <div class="field link-field">
          <span>Enlace de registro para compartir</span>
          <div class="inline-form">
            <input class="input" id="signupLink" value="${esc(signupLink())}" readonly>
            <button class="btn" id="copyLink">${ICON.copy}<span>Copiar</span></button>
          </div>
        </div>
      </section>`;
  }

  function bindSettings() {
    document.querySelectorAll("[data-setting]").forEach((c) => (c.onchange = async () => {
      await BSData.saveSettings({ [c.dataset.setting]: c.checked });
      toast("Ajuste guardado.");
    }));
    document.getElementById("copyLink").onclick = async () => {
      const input = document.getElementById("signupLink");
      try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand("copy"); }
      toast("Enlace copiado.");
    };
  }

  // Herramientas compartidas para los módulos de modules/*.js (se registran en window.BSViews).
  window.BS = {
    esc, toast, ICON, shell, bindShell, bindForm, openModal, closeModal, go: goView, render,
    me: () => me,
    view: () => view,
  };

  boot();
})();
