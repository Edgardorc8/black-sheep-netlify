/*
 * Cotizador — acceso a Integrity Connect + ficha del cliente.
 * Integrity no se puede mostrar dentro de esta página (bloquea los iframes por seguridad),
 * así que se abre en otra pestaña y cada agente entra con su propia cuenta.
 * Aquí NUNCA se guardan contraseñas de Integrity.
 *
 * La ficha sirve para cotizar y, si un carrier rechaza al cliente, aplicar con otro sin
 * volver a pedirle los datos. Se guarda solo en esta pestaña, incluido el SSN (que se muestra
 * tapado), y se borra con "Limpiar", al cerrar sesión o al cerrar la página.
 */
(function () {
  const INTEGRITY_URL = "https://connect.integrity.com/ClientsSSO";
  const DRAFT_KEY = "bs_quote_draft";

  // [campo, etiqueta, tipo, opciones o ejemplo]
  const SECTIONS = [
    ["Datos personales", [
      ["name", "Nombre del cliente", "text", ""],
      ["phone", "Teléfono", "text", "ej. (555) 123-4567"],
      ["dob", "Fecha de nacimiento / edad", "text", "ej. 05/12/1971 o 53 años"],
      ["birthCountry", "País de nacimiento", "text", "ej. México"],
      ["sex", "Sexo", "select", ["", "Hombre", "Mujer"]],
      ["job", "Trabajo / ocupación", "text", "ej. construcción"],
      ["state", "Estado donde vive", "text", "ej. TX"],
      ["address", "Dirección", "text", "Calle, ciudad y código postal", "wide"],
      ["ssn", "SSN", "ssn", ""],
    ]],
    ["Salud", [
      ["tobacco", "¿Fuma o usa tabaco?", "select", ["", "No", "Sí"]],
      ["height", "Estatura", "text", "ej. 5'8\""],
      ["weight", "Peso (lb)", "text", "ej. 180"],
      ["conditions", "Condiciones de salud", "area", "ej. diabetes tipo 2 desde 2018, presión alta controlada"],
      ["meds", "Medicamentos", "area", "ej. metformina 500mg, lisinopril"],
    ]],
    ["Póliza", [
      ["product", "Producto", "select", ["", "IUL", "Vida a término", "Final Expense", "Vida entera", "Anualidad", "No sabe"]],
      ["budget", "Presupuesto mensual", "text", "ej. $150"],
      ["beneficiaries", "Beneficiarios", "area", "ej. María Pérez — esposa — 100%"],
    ]],
  ];
  const ALL = SECTIONS.flatMap(([, f]) => f);

  let ssnVisible = false;

  // La ficha vive en sessionStorage, igual que la sesión: sigue al recargar o al ir y volver de
  // Integrity, y se borra al cerrar la página. Cada agente tiene la suya.
  const store = window.sessionStorage;
  try { Object.keys(localStorage).filter((k) => k.startsWith(DRAFT_KEY)).forEach((k) => localStorage.removeItem(k)); } catch {}   // versiones anteriores
  const keyFor = () => `${DRAFT_KEY}_${BS.me()?.id || "anon"}`;
  function dropOthers() {
    try {
      Object.keys(store)
        .filter((k) => (k === DRAFT_KEY || k.startsWith(DRAFT_KEY + "_")) && k !== keyFor())
        .forEach((k) => store.removeItem(k));
    } catch {}
  }
  const loadDraft = () => { dropOthers(); try { return JSON.parse(store.getItem(keyFor())) || {}; } catch { return {}; } };
  const saveDraft = (d) => { try { store.setItem(keyFor(), JSON.stringify(d)); } catch {} };
  function clearAll() {
    ssnVisible = false;
    try {
      Object.keys(store).filter((k) => k === DRAFT_KEY || k.startsWith(DRAFT_KEY + "_")).forEach((k) => store.removeItem(k));
    } catch {}
  }

  function summary(d) {
    const fecha = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
    const lines = ["FICHA DEL CLIENTE", `Fecha: ${fecha} · Agente: ${BS.me().name}`];
    SECTIONS.forEach(([title, fields]) => {
      const rows = fields.map(([k, label]) => (d[k] ? `${label}: ${d[k]}` : null)).filter(Boolean);
      if (rows.length) lines.push("", title.toUpperCase(), ...rows);
    });
    return lines.join("\n");
  }

  function renderQuote() {
    const { esc, ICON } = BS;
    const d = loadDraft();
    const field = ([k, label, type, extra, size]) => {
      if (type === "select") return `<label class="field"><span>${label}</span><select class="input" name="${k}">${extra.map((o) => `<option value="${esc(o)}" ${o === (d[k] || "") ? "selected" : ""}>${o || "—"}</option>`).join("")}</select></label>`;
      if (type === "area") return `<label class="field span-all"><span>${label}</span><textarea class="input" name="${k}" rows="2" placeholder="${esc(extra)}">${esc(d[k])}</textarea></label>`;
      if (type === "ssn") return `<label class="field"><span>${label}</span>
        <div class="ssn-wrap"><input class="input" name="ssn" type="${ssnVisible ? "text" : "password"}" value="${esc(d.ssn)}" placeholder="•••-••-••••" autocomplete="off" inputmode="numeric">
        <button class="icon-btn" type="button" id="ssnToggle" aria-label="${ssnVisible ? "Ocultar" : "Mostrar"} SSN">${ssnVisible ? ICON.eyeOff : ICON.eye}</button></div></label>`;
      return `<label class="field ${size === "wide" ? "span-2" : ""}"><span>${label}</span><input class="input" name="${k}" value="${esc(d[k])}" placeholder="${esc(extra)}" autocomplete="off"></label>`;
    };

    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head"><div><p class="eyebrow">Vender</p><h1>Cotizador</h1></div></div>

      <section class="hero quote-hero">
        <p class="eyebrow">Integrity Connect</p>
        <h2>Cotiza todos los carriers en un solo lugar.</h2>
        <p class="hero-sub">Pones las condiciones de salud del cliente y Integrity te dice con qué carriers califica y cuánto le cuesta. Así sabes desde el principio qué ofrecerle.</p>
        <div class="hero-foot">
          <span class="muted">Se abre en otra pestaña. Entra con <b>tu propia cuenta</b> de Integrity.</span>
          <a class="hero-btn" href="${INTEGRITY_URL}" target="_blank" rel="noopener noreferrer">${ICON.external}<span>Abrir Integrity</span></a>
        </div>
      </section>

      <div class="steps">
        <div><span>1</span><b>Llena la ficha</b><p>Mientras hablas con el cliente, anota sus datos aquí abajo.</p></div>
        <div><span>2</span><b>Cotiza en Integrity</b><p>Inicia sesión y pon los datos para ver qué carriers califican.</p></div>
        <div><span>3</span><b>¿Lo rechazaron?</b><p>Aplica con otro carrier usando la misma ficha, sin volver a pedirle nada.</p></div>
      </div>

      <form class="panel card-pad quote-form" id="quoteForm" autocomplete="off">
        <div class="content-head">
          <div>
            <h3>Ficha del cliente</h3>
            <p class="hint">Se guarda mientras trabajas. Se borra con "Limpiar", al cerrar sesión o al cerrar la página: descárgala antes.</p>
          </div>
          <div class="head-actions">
            <button class="btn btn-ghost btn-sm" type="button" id="clearQuote">Limpiar</button>
            <button class="btn btn-ghost btn-sm" type="button" id="copyQuote">${ICON.copy}<span>Copiar</span></button>
            <button class="btn btn-sm" type="button" id="downloadQuote">${ICON.download}<span>Descargar .txt</span></button>
          </div>
        </div>
        ${SECTIONS.map(([title, fields]) => `
          <p class="pillar-label quote-section">${title}</p>
          <div class="quote-grid">${fields.map(field).join("")}</div>`).join("")}
      </form>`);
    BS.bindShell();

    const form = document.getElementById("quoteForm");
    const read = () => Object.fromEntries(new FormData(form));
    const persist = () => saveDraft(read());
    form.addEventListener("input", persist);
    form.addEventListener("change", persist);
    document.getElementById("ssnToggle").onclick = () => {
      ssnVisible = !ssnVisible;
      const input = form.ssn;
      input.type = ssnVisible ? "text" : "password";
      const btn = document.getElementById("ssnToggle");
      btn.innerHTML = ssnVisible ? ICON.eyeOff : ICON.eye;
      btn.setAttribute("aria-label", `${ssnVisible ? "Ocultar" : "Mostrar"} SSN`);
    };
    document.getElementById("clearQuote").onclick = () => {
      if (!confirm("¿Borrar la ficha para empezar con otro cliente?")) return;
      clearAll();
      BS.render();
    };
    document.getElementById("copyQuote").onclick = async () => {
      try {
        await navigator.clipboard.writeText(summary(read()));
        BS.toast("Ficha copiada.");
      } catch { BS.toast("No se pudo copiar. Selecciona el texto manualmente."); }
    };
    // Guarda la ficha como archivo de bloc de notas: "Ficha - Nombre - 2026-10-24.txt".
    // En Chrome/Edge abre "Guardar como" para elegir la carpeta; en otros navegadores se descarga normal.
    document.getElementById("downloadQuote").onclick = async () => {
      const f = read();
      if (!Object.entries(f).some(([k, v]) => k !== "ssn" && String(v).trim())) return BS.toast("La ficha está vacía.");
      const name = (f.name || "Cliente").trim().replace(/[\\/:*?"<>|]+/g, "").slice(0, 60) || "Cliente";
      const fileName = `Ficha - ${name} - ${new Date().toISOString().slice(0, 10)}.txt`;
      const blob = new Blob(["﻿" + summary(f).replace(/\n/g, "\r\n")], { type: "text/plain;charset=utf-8" });

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: "Bloc de notas", accept: { "text/plain": [".txt"] } }],
          });
          const w = await handle.createWritable();
          await w.write(blob);
          await w.close();
          return BS.toast(`Ficha guardada como "${handle.name}".`);
        } catch (err) {
          if (err.name === "AbortError") return;   // canceló la ventana de "Guardar como"
          // Si el navegador no deja abrir la ventana, se descarga de la forma normal.
        }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      BS.toast("Ficha descargada en tu carpeta de Descargas.");
    };
  }

  window.BSViews.quote = renderQuote;
  window.BSQuote = { clearAll };   // app.js la llama al cerrar sesión
})();
