/*
 * Agenda de citas — misma lógica que "Agenda de Llamadas.html":
 *  - "No contestó": rellamada el mismo día (por defecto +2 h, editable) y otra al día
 *    siguiente a la misma hora (solo una por día por contacto).
 *  - "Contestó": ofrece borrar las rellamadas automáticas pendientes de ese contacto.
 *  - Importa/exporta el formato del bloc de notas: "10/18 07:30am Nombre 8649090334 NOTA".
 *  - Botón de WhatsApp y confirmación de cita con plantilla editable.
 *  - Alarma con sonido 10 minutos antes (mientras el portal esté abierto).
 * Cada llamada es un item "call" del agente.
 */
(function () {
  const AVISO_MIN = 10;
  const DEF_TPL = `📅 CONFIRMACIÓN DE CITA

👤 Cliente: {cliente}
📆 Fecha: {fecha}
🕖 Hora: {hora}
📲 Modalidad: Llamada telefónica / Videollamada

Asesor: {agente}

📋 Motivo: Presentación de nuestro programa de protección y ahorro IUL.

✅ Por favor, notificar alguna modificación antes de la fecha en caso tal.`;

  // ---------- Fechas ----------
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => ymd(new Date());
  const toDate = (date, time) => { const [y, m, d] = date.split("-").map(Number); const [h, mi] = time.split(":").map(Number); return new Date(y, m - 1, d, h, mi); };
  const addMin = (date, time, mins) => { const d = toDate(date, time); d.setMinutes(d.getMinutes() + mins); return { date: ymd(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; };
  const fmt12 = (t) => { let [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${pad(h)}:${pad(m)}${ap}`; };
  const fmtMD = (s) => { const [, m, d] = s.split("-"); return `${m}/${d}`; };
  const longDay = (s) => toDate(s, "00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const dayTitle = (s) => {
    const t = todayStr(), tm = ymd(new Date(Date.now() + 864e5));
    return s === t ? `Hoy · ${longDay(s)}` : s === tm ? `Mañana · ${longDay(s)}` : longDay(s);
  };

  // Un contacto = mismo teléfono (o mismo nombre si no tiene teléfono).
  const digits = (p) => (p || "").replace(/\D/g, "");
  const keyOf = (c) => digits(c.phone) || c.name.trim().toLowerCase();
  const waLink = (p) => { const d = digits(p); return `https://wa.me/${d.length === 10 ? "1" + d : d}`; };   // 10 dígitos = EE. UU.

  // ---------- Datos ----------
  const uidMe = () => BS.me().id;
  const loadCalls = () => BSData.items(uidMe(), "call");
  const saveCall = (c) => BSData.saveItem(uidMe(), "call", c);
  const delCall = (id) => BSData.deleteItem(uidMe(), "call", id);
  async function loadCfg() { const [p] = await BSData.items(uidMe(), "prefs"); return p || {}; }
  async function saveCfg(changes) { const p = await loadCfg(); return BSData.saveItem(uidMe(), "prefs", { ...p, ...changes }); }
  const hasPending = (calls, key, date, time) =>
    calls.some((c) => c.status === "pending" && keyOf(c) === key && c.date === date && (!time || c.time === time));

  // ---------- Formato del bloc de notas ----------
  function parseDT(s) {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s*m?\.?/i);
    if (!m) return null;
    let [, mo, d, y, h, mi, ap] = m; mo = +mo; d = +d; h = +h;
    if (ap.toLowerCase() === "p" && h < 12) h += 12;
    if (ap.toLowerCase() === "a" && h === 12) h = 0;
    const now = new Date();
    y = y ? (+y < 100 ? 2000 + +y : +y) : now.getFullYear();
    if (!m[3] && now.getMonth() === 11 && mo === 1) y++;   // diciembre → enero
    return { date: `${y}-${pad(mo)}-${pad(d)}`, time: `${pad(h)}:${mi}`, rest: s.slice(m[0].length).trim() };
  }
  function parseLine(line) {
    const p = parseDT(line.trim()); if (!p) return null;
    let name = p.rest, phone = "", note = "";
    const pm = p.rest.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (pm) { name = p.rest.slice(0, pm.index).trim(); phone = digits(pm[0]); note = p.rest.slice(pm.index + pm[0].length).trim(); }
    else { const nm = p.rest.match(/^(.*?)\s+([A-ZÁÉÍÓÚÑ]{2,}(?:\s+.*)?)$/); if (nm) { name = nm[1]; note = nm[2]; } }
    if (!name) return null;
    return { date: p.date, time: p.time, name, phone, note, status: "pending" };
  }

  // ---------- Acciones ----------
  function noAnswerModal(c, calls) {
    const { esc } = BS;
    const r = addMin(c.date, c.time, 120);
    const next = addMin(c.date, c.time, 1440);
    BS.openModal("No contestó", `
      <form id="naForm">
        <p class="na-who"><b>${esc(c.name)}</b> ${esc(c.phone)}</p>
        <label class="field"><span>¿A qué hora lo vuelves a llamar hoy?</span><input class="input big-time" type="time" name="time" value="${r.date === c.date ? r.time : ""}" autofocus></label>
        <p class="hint">También se agenda automático para mañana: <b>${fmtMD(next.date)} ${fmt12(c.time)}</b></p>
        <div class="modal-foot">
          <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn btn-ghost" type="button" id="naTomorrow">Solo mañana</button>
          <button class="btn" type="submit">Reagendar</button>
        </div>
      </form>`, (dlg) => {
      const go = async (time) => {
        const base = { name: c.name, phone: c.phone, note: c.note, status: "pending" };
        const k = keyOf(c), made = [];
        await saveCall({ ...c, status: "noanswer" });
        if (time && !hasPending(calls, k, c.date, time)) { await saveCall({ ...base, date: c.date, time, auto: "Rellamada" }); made.push(`${fmtMD(c.date)} ${fmt12(time)}`); }
        if (!hasPending(calls, k, next.date)) { await saveCall({ ...base, ...next, auto: "Día siguiente" }); made.push(`${fmtMD(next.date)} ${fmt12(next.time)}`); }
        BS.closeModal();
        BS.toast(made.length ? `Reagendado: ${made.join(" y ")}` : "Marcado como no contestó (ya tenía llamadas agendadas).");
        BS.render();
      };
      dlg.querySelector("form").onsubmit = (e) => { e.preventDefault(); go(dlg.querySelector("[name=time]").value); };
      dlg.querySelector("#naTomorrow").onclick = () => go("");
    });
  }

  async function answered(c, calls) {
    await saveCall({ ...c, status: "done" });
    const extra = calls.filter((x) => x.id !== c.id && x.status === "pending" && keyOf(x) === keyOf(c) && x.auto);
    if (extra.length && confirm(`${c.name} ya contestó.\n¿Borrar también sus ${extra.length} rellamada(s) automática(s) pendientes?`)) {
      for (const x of extra) await delCall(x.id);
    }
    BS.toast("Marcado como contestó.");
    BS.render();
  }

  function optionsModal(c, calls) {
    const { esc } = BS;
    const sameContact = calls.filter((x) => keyOf(x) === keyOf(c)).length;
    BS.openModal(esc(c.name), `
      <form id="editCallForm">
        <div class="form-grid">
          <label class="field"><span>Fecha</span><input class="input" type="date" name="date" value="${c.date}" required></label>
          <label class="field"><span>Hora</span><input class="input" type="time" name="time" value="${c.time}" required></label>
          <label class="field"><span>Nombre</span><input class="input" name="name" value="${esc(c.name)}" required></label>
          <label class="field"><span>Teléfono</span><input class="input" name="phone" value="${esc(c.phone)}"></label>
        </div>
        <label class="field"><span>Nota</span><input class="input" name="note" value="${esc(c.note)}"></label>
        <div class="error"></div>
        <div class="modal-foot"><button class="btn" type="submit">Guardar cambios</button></div>
      </form>
      <div class="modal-section danger">
        <h4>Eliminar</h4>
        <div class="actions start">
          <button class="btn btn-ghost btn-sm" id="delOne">Solo este horario (${fmtMD(c.date)} ${fmt12(c.time)})</button>
          <button class="btn btn-ghost btn-sm btn-danger" id="delContact">Contacto completo (${sameContact} ${sameContact === 1 ? "horario" : "horarios"})</button>
        </div>
      </div>`, (dlg) => {
      BS.bindForm(dlg.querySelector("form"), async (f) => {
        const moved = f.date !== c.date || f.time !== c.time;
        await saveCall({ ...c, date: f.date, time: f.time, name: f.name.trim(), phone: digits(f.phone), note: f.note.trim(), alerted: moved ? false : c.alerted });
        BS.closeModal();
        BS.toast("Llamada actualizada.");
        BS.render();
      }, "Guardando…");
      dlg.querySelector("#delOne").onclick = async () => {
        await delCall(c.id);
        BS.closeModal(); BS.toast("Horario eliminado."); BS.render();
      };
      dlg.querySelector("#delContact").onclick = async () => {
        if (!confirm(`¿Eliminar definitivamente a ${c.name}? Se borrarán sus ${sameContact} horario(s).`)) return;
        for (const x of calls.filter((x) => keyOf(x) === keyOf(c))) await delCall(x.id);
        BS.closeModal(); BS.toast(`${c.name} eliminado.`); BS.render();
      };
    });
  }

  async function citaModal(c) {
    const { esc } = BS;
    const cfg = await loadCfg();
    BS.openModal("Confirmar cita por WhatsApp", `
      <form id="citaForm">
        <div class="form-grid">
          <label class="field"><span>Cliente</span><input class="input" name="cliente" value="${esc(c.name)}"></label>
          <label class="field"><span>Teléfono</span><input class="input" name="tel" value="${esc(c.phone)}"></label>
          <label class="field"><span>Fecha de la cita</span><input class="input" type="date" name="fecha" value="${c.date}"></label>
          <label class="field"><span>Hora de la cita</span><input class="input" type="time" name="hora" value="${c.time}"></label>
          <label class="field"><span>Asesor</span><input class="input" name="agente" value="${esc(cfg.citaAgente || BS.me().name)}"></label>
          <label class="field"><span>Zona horaria (opcional)</span><input class="input" name="zona" value="${esc(cfg.citaZona)}" placeholder="ej. hora del Pacífico"></label>
        </div>
        <label class="field"><span>Mensaje (lo puedes editar antes de mandarlo)</span><textarea class="input wa-msg" name="msg" rows="9"></textarea></label>
        <details class="tpl-details"><summary>Editar plantilla</summary>
          <p class="hint">Usa {cliente}, {fecha}, {hora} y {agente}. Se guarda para la próxima vez.</p>
          <textarea class="input" name="tpl" rows="8">${esc(cfg.citaTpl || DEF_TPL)}</textarea>
        </details>
        <div class="error"></div>
        <div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn btn-wa" type="submit">Enviar por WhatsApp</button></div>
      </form>`, (dlg) => {
      const form = dlg.querySelector("form");
      const build = () => {
        const f = Object.fromEntries(new FormData(form));
        const fecha = f.fecha ? longDay(f.fecha) : "";
        const hora = f.hora ? fmt12(f.hora).replace(/^0/, "").replace(/(am|pm)$/, " $1") + (f.zona.trim() ? ` (${f.zona.trim()})` : "") : "";
        form.msg.value = f.tpl.replaceAll("{cliente}", f.cliente.trim()).replaceAll("{fecha}", fecha).replaceAll("{hora}", hora).replaceAll("{agente}", f.agente.trim());
      };
      ["cliente", "fecha", "hora", "agente", "zona", "tpl"].forEach((n) => form[n].addEventListener("input", build));
      build();
      BS.bindForm(form, async (f) => {
        if (!digits(f.tel)) throw new Error("Falta el teléfono.");
        await saveCfg({ citaAgente: f.agente.trim(), citaZona: f.zona.trim(), citaTpl: f.tpl });
        window.open(`${waLink(f.tel)}?text=${encodeURIComponent(f.msg)}`, "_blank", "noopener");
        BS.closeModal();
      }, "Abriendo…");
    });
  }

  function toolsModal(calls) {
    const exportText = calls.filter((c) => c.status === "pending").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map((c) => `${fmtMD(c.date)} ${fmt12(c.time)} ${c.name}${c.phone ? " " + c.phone : ""}${c.note ? " " + c.note : ""}`).join("\n");
    BS.openModal("Importar / Exportar", `
      <form id="importForm" class="modal-section" style="padding-top:0">
        <h4>Importar del bloc de notas</h4>
        <p class="hint">Pega tus líneas tal como las tienes, por ejemplo: <b>10/18 07:30am Edith Herbas 8649090334</b>. Lo que vaya después del teléfono se guarda como nota.</p>
        <textarea class="input mono" name="text" rows="6" required></textarea>
        <div class="error"></div>
        <div class="modal-foot"><button class="btn" type="submit">Importar</button></div>
      </form>
      <div class="modal-section">
        <h4>Exportar llamadas pendientes</h4>
        <textarea class="input mono" rows="6" readonly id="expText">${BS.esc(exportText)}</textarea>
        <div class="modal-foot"><button class="btn btn-ghost btn-sm" type="button" id="copyExp">${BS.ICON.copy}<span>Copiar texto</span></button></div>
      </div>
      <div class="modal-section danger">
        <h4>Borrar toda la agenda</h4>
        <button class="btn btn-ghost btn-sm btn-danger" type="button" id="clearAll">Borrar todas las llamadas (${calls.length})</button>
      </div>`, (dlg) => {
      BS.bindForm(dlg.querySelector("#importForm"), async (f) => {
        const lines = f.text.split(/\r?\n/).filter((l) => l.trim());
        const ok = [], bad = [];
        lines.forEach((l) => { const c = parseLine(l); if (c) ok.push(c); else bad.push(l); });
        if (!ok.length) throw new Error("No pude leer ninguna línea. Revisa que empiecen con la fecha y hora, ej. 10/18 07:30am");
        await BSData.saveItems(uidMe(), "call", ok);
        BS.closeModal();
        if (bad.length) alert(`Importadas: ${ok.length}\nNo se pudieron leer (${bad.length}):\n${bad.join("\n")}`);
        else BS.toast(`${ok.length} llamadas importadas.`);
        BS.render();
      }, "Importando…");
      dlg.querySelector("#copyExp").onclick = async () => {
        try { await navigator.clipboard.writeText(dlg.querySelector("#expText").value); BS.toast("Copiado."); } catch { BS.toast("No se pudo copiar."); }
      };
      dlg.querySelector("#clearAll").onclick = async () => {
        if (!calls.length) return BS.toast("La agenda ya está vacía.");
        const n = new Set(calls.map(keyOf)).size;
        if (!confirm(`¿BORRAR TODOS los contactos (${n}) y sus ${calls.length} horario(s)? No se puede deshacer.`)) return;
        for (const c of calls) await delCall(c.id);
        BS.closeModal(); BS.toast("Agenda borrada."); BS.render();
      };
    });
  }

  // ---------- Pantalla ----------
  let filter = "upcoming", query = "", showDone = false;

  async function renderAgenda() {
    const { esc, ICON } = BS;
    const [calls, cfg] = await Promise.all([loadCalls(), loadCfg()]);
    const t = todayStr(), now = new Date();
    const q = query.trim().toLowerCase(), qd = digits(q);
    const items = calls.filter((c) => {
      if (!showDone && c.status !== "pending") return false;
      if (filter === "today" && c.date !== t) return false;
      if (filter === "upcoming" && c.date < t && c.status !== "pending") return false;
      if (q && !(c.name.toLowerCase().includes(q) || (qd && digits(c.phone).includes(qd)) || (c.note || "").toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    const todayPending = calls.filter((c) => c.status === "pending" && c.date === t).length;
    const late = calls.filter((c) => c.status === "pending" && toDate(c.date, c.time) < now).length;
    const nextCall = calls.filter((c) => c.status === "pending" && toDate(c.date, c.time) >= now).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];

    const groups = {};
    items.forEach((c) => (groups[c.date] ||= []).push(c));
    const list = Object.keys(groups).map((d) => {
      const pend = groups[d].filter((c) => c.status === "pending").length;
      return `<div class="day">
        <h3 class="${d < t ? "past" : ""}">${dayTitle(d)} <span class="count">${pend}</span></h3>
        ${groups[d].map((c) => {
          const diff = (toDate(c.date, c.time) - now) / 6e4;
          const cls = c.status === "done" ? "done" : c.status === "noanswer" ? "nr" : `${diff < 0 ? "late" : ""} ${diff <= 15 && diff > -60 ? "due" : ""}`;
          const phone = c.phone ? `<a class="muted-link mono" href="tel:${esc(digits(c.phone))}">${esc(c.phone)}</a>` : "";
          const st = c.status === "done" ? '<span class="tag st-active">Contestó</span>' : c.status === "noanswer" ? '<span class="tag st-disabled">No contestó</span>' : "";
          const acts = c.status === "pending"
            ? `<button class="btn btn-sm btn-ok" data-ans="${c.id}">${ICON.check}<span>Contestó</span></button>
               <button class="btn btn-ghost btn-sm" data-na="${c.id}">No contestó</button>
               ${c.phone ? `<a class="btn btn-ghost btn-sm btn-wa-ghost" href="${waLink(c.phone)}" target="_blank" rel="noopener">WhatsApp</a>
                            <button class="btn btn-ghost btn-sm" data-cita="${c.id}">${ICON.calendar}<span>Cita</span></button>` : ""}
               <button class="icon-btn" data-opt="${c.id}" aria-label="Más opciones" title="Cambiar hora, nota o eliminar">${ICON.edit}</button>`
            : `${st}
               ${c.phone ? `<button class="btn btn-ghost btn-sm" data-cita="${c.id}">${ICON.calendar}<span>Cita</span></button>` : ""}
               <button class="btn btn-ghost btn-sm" data-undo="${c.id}">Deshacer</button>
               <button class="icon-btn" data-opt="${c.id}" aria-label="Más opciones">${ICON.edit}</button>`;
          return `<div class="call-row ${cls}">
            <span class="call-time">${fmt12(c.time)}</span>
            <span class="call-who"><b>${esc(c.name)}</b> ${phone}${c.auto ? `<span class="tag">${esc(c.auto)}</span>` : ""}${c.note ? `<span class="call-note">${esc(c.note)}</span>` : ""}</span>
            <span class="call-acts">${acts}</span>
          </div>`;
        }).join("")}
      </div>`;
    }).join("");

    const alarmOn = cfg.alarm !== false;
    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head">
        <div><p class="eyebrow">Vender</p><h1>Agenda</h1></div>
        <div class="head-actions">
          <button class="btn btn-ghost btn-sm" id="alarmBtn">${alarmOn ? "🔔 Alarmas activadas" : "🔕 Alarmas apagadas"}</button>
          <button class="btn btn-ghost btn-sm" id="testAlarm">Probar sonido</button>
          <button class="btn btn-ghost btn-sm" id="toolsBtn">Importar / Exportar</button>
        </div>
      </div>

      <div class="stats four">
        <div class="stat"><span>Pendientes hoy</span><b>${todayPending}</b></div>
        <div class="stat"><span>Atrasadas</span><b class="${late ? "neg" : ""}">${late}</b></div>
        <div class="stat wide"><span>Siguiente llamada</span><b class="next-call">${nextCall ? `${fmt12(nextCall.time)} <small>${esc(nextCall.name)}${nextCall.date !== t ? ` · ${fmtMD(nextCall.date)}` : ""}</small>` : "—"}</b></div>
      </div>

      <form class="panel card-pad add-call" id="addCall">
        <h3>Agendar llamada</h3>
        <div class="add-call-grid">
          <label class="field"><span>Fecha</span><input class="input" type="date" name="date" value="${t}" required></label>
          <label class="field"><span>Hora</span><input class="input" type="time" name="time" required></label>
          <label class="field"><span>Nombre</span><input class="input" name="name" required></label>
          <label class="field"><span>Teléfono</span><input class="input" name="phone"></label>
          <label class="field"><span>Nota</span><input class="input" name="note" placeholder="Opcional"></label>
          <button class="btn" type="submit">${ICON.plus}<span>Agregar</span></button>
        </div>
      </form>

      <section class="panel">
        <div class="panel-head agenda-tools">
          <div class="chips plain">
            ${[["upcoming", "Hoy y próximos"], ["today", "Solo hoy"], ["all", "Todo"]].map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${filter === k}">${l}</button>`).join("")}
          </div>
          <div class="toolbar">
            <label class="check-inline"><input type="checkbox" id="showDone" ${showDone ? "checked" : ""}> Mostrar contestadas</label>
            <input class="input search" type="search" id="callSearch" placeholder="Buscar nombre, teléfono o nota" value="${esc(query)}">
          </div>
        </div>
        <div class="agenda-list">${list || `<div class="empty"><p>No hay llamadas ${showDone ? "" : "pendientes "}para mostrar.</p></div>`}</div>
      </section>`);
    BS.bindShell();

    const byId = (id) => calls.find((c) => c.id === id);
    BS.bindForm(document.getElementById("addCall"), async (f) => {
      await saveCall({ date: f.date, time: f.time, name: f.name.trim(), phone: digits(f.phone), note: f.note.trim(), status: "pending" });
      BS.toast("Llamada agendada.");
      await BS.render();
      document.querySelector("#addCall [name=name]")?.focus();
    }, "Agregando…");
    document.querySelectorAll("[data-filter]").forEach((b) => (b.onclick = () => { filter = b.dataset.filter; BS.render(); }));
    document.getElementById("showDone").onchange = (e) => { showDone = e.target.checked; BS.render(); };
    const search = document.getElementById("callSearch");
    search.oninput = () => { query = search.value; clearTimeout(search._t); search._t = setTimeout(async () => { await BS.render(); const s = document.getElementById("callSearch"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 250); };
    document.querySelectorAll("[data-ans]").forEach((b) => (b.onclick = () => answered(byId(b.dataset.ans), calls)));
    document.querySelectorAll("[data-na]").forEach((b) => (b.onclick = () => noAnswerModal(byId(b.dataset.na), calls)));
    document.querySelectorAll("[data-cita]").forEach((b) => (b.onclick = () => citaModal(byId(b.dataset.cita))));
    document.querySelectorAll("[data-opt]").forEach((b) => (b.onclick = () => optionsModal(byId(b.dataset.opt), calls)));
    document.querySelectorAll("[data-undo]").forEach((b) => (b.onclick = async () => { await saveCall({ ...byId(b.dataset.undo), status: "pending" }); BS.render(); }));
    document.getElementById("toolsBtn").onclick = () => toolsModal(calls);
    document.getElementById("testAlarm").onclick = () => beep();
    document.getElementById("alarmBtn").onclick = async () => {
      await saveCfg({ alarm: !alarmOn });
      if (!alarmOn) { askNotif(); BS.toast("Te avisaré 10 minutos antes de cada llamada."); }
      BS.render();
    };
  }

  // ---------- Alarma 10 minutos antes (funciona en cualquier sección del portal) ----------
  let actx = null, alarmLoop = null, titleLoop = null;
  function unlockAudio() {
    try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch {}
  }
  document.addEventListener("click", unlockAudio);
  document.addEventListener("keydown", unlockAudio);
  function beep() {
    unlockAudio(); if (!actx) return;
    const t0 = actx.currentTime;
    [0, 0.25, 0.5, 1.0, 1.25, 1.5].forEach((d, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "square"; o.frequency.value = i % 3 === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.2);
      o.connect(g).connect(actx.destination); o.start(t0 + d); o.stop(t0 + d + 0.22);
    });
  }
  function askNotif() { try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {} }
  function stopAlarm() {
    clearInterval(alarmLoop); clearInterval(titleLoop); alarmLoop = titleLoop = null;
    document.title = "Black Sheep Agency";
  }

  let checking = false;
  async function checkAlarms() {
    const me = BS?.me?.();
    if (!me || checking) return;
    checking = true;
    try {
      const cfg = await loadCfg();
      if (cfg.alarm === false) return;
      const now = Date.now();
      const calls = await loadCalls();
      const due = calls.filter((c) => {
        if (c.status !== "pending" || c.alerted) return false;
        const m = (toDate(c.date, c.time) - now) / 6e4;
        return m <= AVISO_MIN && m > -1;
      });
      if (!due.length) return;
      for (const c of due) await saveCall({ ...c, alerted: true });
      const { esc } = BS;
      BS.openModal("⏰ ¡Llamada en 10 minutos!", `
        <div class="alarm-list">${due.map((c) => `<div><b>${fmt12(c.time)}</b> · ${esc(c.name)} ${c.phone ? `<a class="muted-link mono" href="tel:${esc(digits(c.phone))}">${esc(c.phone)}</a>` : ""}${c.note ? `<br><span class="call-note">${esc(c.note)}</span>` : ""}</div>`).join("")}</div>
        <div class="modal-foot"><button class="btn" data-close>Entendido</button></div>`, (dlg) => {
        dlg.classList.add("alarm");
        dlg.addEventListener("close", stopAlarm);
        dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", stopAlarm));
      });
      beep();
      // Repite el sonido cada 5 s durante 1 minuto o hasta que presionen "Entendido".
      clearInterval(alarmLoop); let n = 0;
      alarmLoop = setInterval(() => { if (++n > 12) { clearInterval(alarmLoop); return; } beep(); }, 5000);
      clearInterval(titleLoop); let f = false;
      titleLoop = setInterval(() => { document.title = (f = !f) ? "⏰ ¡LLAMADA EN 10 MIN!" : "Black Sheep Agency"; }, 1000);
      try {
        if ("Notification" in window && Notification.permission === "granted")
          due.forEach((c) => new Notification("⏰ Llamada en 10 minutos", { body: `${fmt12(c.time)} — ${c.name} ${c.phone}`, requireInteraction: true }));
      } catch {}
      window.focus();
    } finally {
      checking = false;
    }
  }
  setInterval(checkAlarms, 20000);
  setTimeout(checkAlarms, 3000);

  window.BSViews.agenda = renderAgenda;
  window.BSAgenda = { saveCall, todayStr, fmt12 };
})();
