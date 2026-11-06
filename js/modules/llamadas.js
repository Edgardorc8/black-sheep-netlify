/*
 * Llamadas modelo — grabaciones reales del equipo (con los datos del cliente silenciados).
 * Todos los agentes las escuchan; el administrador las sube, edita y elimina.
 * Cada llamada puede tener "momentos clave" (minuto + etiqueta) para saltar directo a lo importante.
 * Se marca como escuchada al llegar al 90 % y se recuerda dónde se quedó cada agente.
 */
(function () {
  const CATEGORIES = ["Primera llamada", "Presentación IUL", "Manejo de objeciones", "Cierre", "Seguimiento", "Otra"];
  const RESULTS = ["Venta", "Cita agendada", "No cerró (para aprender)"];
  const SPEEDS = [1, 1.25, 1.5, 2];
  const POS_KEY = (id) => `bs_callpos_${id}`;

  const pad = (n) => String(n).padStart(2, "0");
  const fmtT = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  };
  // "02:15 Objeción de precio" o "1:02:15 Cierre" → { t: 135, label }
  function parseMoments(text) {
    return String(text || "").split(/\r?\n/).map((line) => {
      const m = line.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–·.]?\s*(.+)$/);
      if (!m) return null;
      return { t: (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3], label: m[4].trim() };
    }).filter(Boolean).sort((a, b) => a.t - b.t);
  }
  const momentsText = (ms) => (ms || []).map((x) => `${fmtT(x.t)} ${x.label}`).join("\n");

  // Lo que ya escuchó el agente se guarda en sus preferencias.
  async function getPrefs() { const [p] = await BSData.items(BS.me().id, "prefs"); return p || {}; }
  async function markListened(id) {
    const p = await getPrefs();
    if ((p.listened || []).includes(id)) return;
    await BSData.saveItem(BS.me().id, "prefs", { ...p, listened: [...(p.listened || []), id] });
    BS.toast("Llamada marcada como escuchada ✓");
  }

  // Cada llamada va en la carpeta de un agente (campo "agent"); sin agente → "General".
  const GENERAL = "General";
  const folderOf = (c) => (c.agent || "").trim() || GENERAL;
  const NEW_FOLDER = "__new__";

  // ---------- Formulario del administrador ----------
  function callModal(call, folders, presetFolder) {
    const { esc } = BS;
    const opts = (list, cur) => `<option value="">—</option>` + list.map((x) => `<option ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("");
    const curFolder = call ? folderOf(call) : presetFolder || "";
    const folderOpts = `<option value="">Elige una carpeta…</option>` +
      folders.map((f) => `<option ${f === curFolder ? "selected" : ""}>${esc(f)}</option>`).join("") +
      `<option value="${NEW_FOLDER}">+ Nueva carpeta…</option>`;
    BS.openModal(call ? "Editar llamada" : "Subir llamada", `
      <form id="mcForm">
        <p class="hint">Sube solo llamadas ya censuradas (sin fecha de nacimiento, Social, cuenta bancaria, dirección, etc.).</p>
        <label class="field"><span>Título</span><input class="input" name="title" value="${esc(call?.title)}" placeholder="ej. Cierre de IUL con objeción de precio" required></label>
        <div class="form-grid">
          <label class="field"><span>Carpeta (agente que hizo la llamada)</span><select class="input" name="folder" required>${folderOpts}</select></label>
          <label class="field" id="newFolderField" hidden><span>Nombre de la carpeta nueva</span><input class="input" name="newFolder" placeholder="ej. María López"></label>
          <label class="field"><span>Tipo de llamada</span><select class="input" name="category">${opts(CATEGORIES, call?.category)}</select></label>
          <label class="field"><span>Resultado</span><select class="input" name="result">${opts(RESULTS, call?.result)}</select></label>
          <label class="field"><span>${call ? "Reemplazar audio (MP3)" : "Archivo de audio (MP3)"}</span><input class="input" type="file" name="file" accept="audio/*"></label>
        </div>
        <label class="field"><span>…o enlace del audio</span><input class="input" name="srcUrl" placeholder="${call ? "Déjalo vacío para mantener el audio actual" : "https://…"}"></label>
        <label class="field"><span>¿Qué se aprende de esta llamada?</span><textarea class="input" name="desc" rows="3">${esc(call?.desc)}</textarea></label>
        <label class="field"><span>Momentos clave (uno por línea: minuto y nombre)</span><textarea class="input mono" name="moments" rows="5" placeholder="02:15 Objeción de precio&#10;14:30 Presentación del IUL&#10;41:05 Cierre">${esc(momentsText(call?.moments))}</textarea></label>
        <div class="error"></div>
        <div class="modal-foot">
          ${call ? `<button class="btn btn-ghost btn-danger" type="button" id="mcDelete">Eliminar</button><span class="spacer"></span>` : ""}
          <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn" type="submit">${call ? "Guardar cambios" : "Subir llamada"}</button>
        </div>
      </form>`, (dlg) => {
      const form = dlg.querySelector("form");
      const newField = dlg.querySelector("#newFolderField");
      form.folder.onchange = () => {
        newField.hidden = form.folder.value !== NEW_FOLDER;
        if (!newField.hidden) form.newFolder.focus();
      };
      // Al elegir el archivo, toma el nombre como título si está vacío y lee la duración.
      let duration = call?.duration || 0;
      form.file.onchange = () => {
        const f = form.file.files[0];
        if (!f) return;
        if (!form.title.value.trim()) form.title.value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        const a = new Audio(URL.createObjectURL(f));
        a.onloadedmetadata = () => { duration = a.duration; URL.revokeObjectURL(a.src); };
      };
      BS.bindForm(form, async (f) => {
        const file = f.file?.size ? f.file : null;
        let folder = f.folder === NEW_FOLDER ? String(f.newFolder || "").trim().replace(/\s+/g, " ") : f.folder;
        if (!folder) throw new Error(f.folder === NEW_FOLDER ? "Escribe el nombre de la carpeta nueva." : "Elige la carpeta del agente.");
        // Si ya existe con otras mayúsculas, usa la existente para no duplicar carpetas.
        folder = folders.find((x) => x.toLowerCase() === folder.toLowerCase()) || folder;
        await BSData.saveModelCall({
          ...(call || {}), title: f.title.trim(), agent: folder === GENERAL ? "" : folder, category: f.category, result: f.result,
          desc: f.desc.trim(), moments: parseMoments(f.moments), srcUrl: f.srcUrl.trim(), duration,
        }, file);
        BS.closeModal();
        BS.toast(call ? "Llamada actualizada." : "Llamada subida.");
        BS.render();
      }, "Subiendo…");
      const del = dlg.querySelector("#mcDelete");
      if (del) del.onclick = async () => {
        if (!confirm(`¿Eliminar "${call.title}"? Ningún agente podrá volver a escucharla.`)) return;
        await BSData.deleteModelCall(call.id);
        if (openId === call.id) openId = null;
        BS.closeModal();
        BS.toast("Llamada eliminada.");
        BS.render();
      };
    });
  }

  // ---------- Pantalla ----------
  let openId = null, cat = "", query = "", folder = null;   // folder null = vista de carpetas

  async function renderCalls() {
    const { esc, ICON } = BS;
    const isAdmin = BS.me().role === "admin";
    const [calls, prefs] = await Promise.all([BSData.listModelCalls(), getPrefs()]);
    const listened = new Set(prefs.listened || []);
    const current = calls.find((c) => c.id === openId) || null;
    // Carpetas en orden alfabético, con "General" al final.
    const folders = [...new Set(calls.map(folderOf))].sort((a, b) => (a === GENERAL) - (b === GENERAL) || a.localeCompare(b, "es"));
    if (folder && !folders.includes(folder)) folder = null;
    const q = query.trim().toLowerCase();
    const inFolder = folder ? calls.filter((c) => folderOf(c) === folder) : calls;
    const shown = inFolder.filter((c) => (!cat || c.category === cat) &&
      (!q || `${c.title} ${c.agent} ${c.desc} ${(c.moments || []).map((m) => m.label).join(" ")}`.toLowerCase().includes(q)));
    const cats = CATEGORIES.filter((c) => inFolder.some((x) => x.category === c));
    const showFolders = !folder && !q;   // al buscar se muestran las llamadas de todas las carpetas

    const card = (c) => `
      <button class="mc-card ${c.id === openId ? "active" : ""}" data-open="${c.id}">
        <span class="mc-top">
          ${c.category ? `<span class="tag">${esc(c.category)}</span>` : ""}
          ${c.result ? `<span class="tag ${c.result === "Venta" ? "st-active" : c.result === "Cita agendada" ? "admin" : ""}">${esc(c.result)}</span>` : ""}
          ${listened.has(c.id) ? `<span class="mc-done">${ICON.check} Escuchada</span>` : ""}
        </span>
        <b>${esc(c.title)}</b>
        <small>${c.agent ? `${esc(c.agent)} · ` : ""}${c.duration ? fmtT(c.duration) : "Audio"}${c.moments?.length ? ` · ${c.moments.length} momentos clave` : ""}</small>
        ${c.desc ? `<p>${esc(c.desc)}</p>` : ""}
      </button>`;

    const player = current ? `
      <section class="panel mc-player">
        <div class="mc-head">
          <div>
            <p class="eyebrow">${esc(current.category || "Llamada modelo")}${current.agent ? ` · ${esc(current.agent)}` : ""}</p>
            <h2>${esc(current.title)}</h2>
            ${current.desc ? `<p class="muted-p">${esc(current.desc)}</p>` : ""}
          </div>
          <div class="head-actions">
            ${isAdmin ? `<button class="btn btn-ghost btn-sm" id="editCall">${ICON.edit}<span>Editar</span></button>` : ""}
            <button class="icon-btn" id="closePlayer" aria-label="Cerrar">${ICON.x}</button>
          </div>
        </div>
        <audio id="mcAudio" src="${esc(current.url)}" preload="metadata"></audio>
        <div class="mc-controls">
          <button class="ctrl-round" id="mcBack" aria-label="Atrás 15 segundos">−15</button>
          <button class="ctrl-play" id="mcPlay" aria-label="Reproducir">${ICON.play}</button>
          <button class="ctrl-round" id="mcFwd" aria-label="Adelante 15 segundos">+15</button>
          <div class="mc-seek" id="mcSeek"><div class="mc-track"></div><div class="mc-fill" id="mcFill"></div>
            ${(current.moments || []).map((m, i) => `<span class="mc-mark" data-mark="${i}" title="${esc(fmtT(m.t))} ${esc(m.label)}"></span>`).join("")}
          </div>
          <span class="time" id="mcTime">0:00 / ${current.duration ? fmtT(current.duration) : "0:00"}</span>
          <button class="chip" id="mcSpeed" title="Velocidad">1x</button>
        </div>
        ${current.moments?.length ? `<ol class="mc-moments">${current.moments.map((m, i) => `
          <li><button data-jump="${m.t}" data-mi="${i}"><span>${fmtT(m.t)}</span>${esc(m.label)}</button></li>`).join("")}</ol>` : ""}
      </section>` : "";

    const folderCard = (f) => {
      const list = calls.filter((c) => folderOf(c) === f);
      const heard = list.filter((c) => listened.has(c.id)).length;
      return `
      <button class="mc-folder" data-folder="${esc(f)}">
        <span class="mc-folder-icon">${ICON.folder}</span>
        <b>${esc(f)}</b>
        <small>${list.length} ${list.length === 1 ? "llamada" : "llamadas"}${heard ? ` · ${heard} escuchada${heard === 1 ? "" : "s"}` : ""}</small>
      </button>`;
    };

    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head">
        <div>
          <p class="eyebrow">${folder ? `<button class="crumb" id="backFolders">Llamadas modelo</button> / Carpeta` : "Aprender"}</p>
          <h1>${folder ? esc(folder) : "Llamadas modelo"}</h1>
        </div>
        <div class="head-actions">
          <span class="muted">${inFolder.filter((c) => listened.has(c.id)).length} de ${inFolder.length} escuchadas</span>
          ${isAdmin ? `<button class="btn btn-sm" id="newCall">${ICON.plus}<span>Subir llamada</span></button>` : ""}
        </div>
      </div>
      ${player}
      <div class="mc-filters">
        ${showFolders ? `<span class="muted">${folders.length} ${folders.length === 1 ? "carpeta" : "carpetas"}</span>` : `<div class="chips plain">
          ${folder ? `<button class="chip" id="backFolders2">← Carpetas</button>` : ""}
          <button class="chip" data-cat="" aria-pressed="${!cat}">Todas · ${inFolder.length}</button>
          ${cats.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${cat === c}">${esc(c)}</button>`).join("")}
        </div>`}
        <input class="input search" type="search" id="mcSearch" placeholder="${folder ? "Buscar en esta carpeta" : "Buscar en todas las carpetas"}" value="${esc(query)}">
      </div>
      ${showFolders && folders.length ? `<div class="mc-grid">${folders.map(folderCard).join("")}</div>`
        : shown.length ? `<div class="mc-grid">${shown.map(card).join("")}</div>`
        : `<section class="panel empty"><p>${calls.length ? "No hay llamadas con ese filtro." : isAdmin ? "Sube la primera llamada: al subirla eliges o creas la carpeta del agente." : "Tu manager subirá llamadas muy pronto."}</p></section>`}`);
    BS.bindShell();

    if (isAdmin) document.getElementById("newCall").onclick = () => callModal(null, folders, folder);
    const goFolders = () => { folder = null; cat = ""; openId = null; BS.render(); };
    ["backFolders", "backFolders2"].forEach((id) => { const b = document.getElementById(id); if (b) b.onclick = goFolders; });
    document.querySelectorAll("[data-folder]").forEach((b) => (b.onclick = () => { folder = b.dataset.folder; cat = ""; BS.render(); }));
    document.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { openId = b.dataset.open; BS.render(); window.scrollTo({ top: 0, behavior: "smooth" }); }));
    document.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { cat = b.dataset.cat; BS.render(); }));
    const search = document.getElementById("mcSearch");
    search.oninput = () => { query = search.value; clearTimeout(search._t); search._t = setTimeout(async () => { await BS.render(); const s = document.getElementById("mcSearch"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 250); };
    if (current) mountPlayer(current, listened.has(current.id), folders);
  }

  function mountPlayer(call, alreadyListened, folders) {
    const { ICON } = BS;
    const a = document.getElementById("mcAudio");
    const play = document.getElementById("mcPlay");
    const seek = document.getElementById("mcSeek");
    const fill = document.getElementById("mcFill");
    const time = document.getElementById("mcTime");
    const speedBtn = document.getElementById("mcSpeed");
    let marked = alreadyListened, lastSave = 0;

    document.getElementById("closePlayer").onclick = () => { openId = null; BS.render(); };
    const edit = document.getElementById("editCall");
    if (edit) edit.onclick = () => callModal(call, folders);

    const paint = () => {
      const d = a.duration || call.duration || 0;
      fill.style.width = d ? `${(a.currentTime / d) * 100}%` : "0";
      time.textContent = `${fmtT(a.currentTime)} / ${fmtT(d)}`;
      // Resalta el momento clave en el que va la llamada.
      let idx = -1;
      (call.moments || []).forEach((m, i) => { if (a.currentTime >= m.t) idx = i; });
      document.querySelectorAll("[data-mi]").forEach((b) => b.classList.toggle("now", +b.dataset.mi === idx));
    };
    const placeMarks = () => {
      const d = a.duration || call.duration;
      if (!d) return;
      document.querySelectorAll("[data-mark]").forEach((el) => { el.style.left = `${(call.moments[+el.dataset.mark].t / d) * 100}%`; });
    };

    a.addEventListener("loadedmetadata", () => {
      const saved = +localStorage.getItem(POS_KEY(call.id)) || 0;
      if (saved > 5 && saved < a.duration - 5) a.currentTime = saved;   // continúa donde se quedó
      placeMarks(); paint();
    });
    a.addEventListener("timeupdate", () => {
      paint();
      if (Date.now() - lastSave > 3000) { lastSave = Date.now(); try { localStorage.setItem(POS_KEY(call.id), a.currentTime); } catch {} }
      if (!marked && a.duration && a.currentTime / a.duration >= 0.9) {
        marked = true;
        markListened(call.id).then(() => {
          // Actualiza el contador y la tarjeta sin volver a dibujar la página (no corta el audio).
          const counter = document.querySelector(".page-head .muted");
          if (counter) counter.textContent = counter.textContent.replace(/^\d+/, (n) => +n + 1);
          const top = document.querySelector(`[data-open="${call.id}"] .mc-top`);
          if (top && !top.querySelector(".mc-done")) top.insertAdjacentHTML("beforeend", `<span class="mc-done">${ICON.check} Escuchada</span>`);
        });
      }
    });
    a.addEventListener("play", () => { play.innerHTML = ICON.pause; play.setAttribute("aria-label", "Pausar"); });
    a.addEventListener("pause", () => { play.innerHTML = ICON.play; play.setAttribute("aria-label", "Reproducir"); });
    a.addEventListener("ended", () => { try { localStorage.removeItem(POS_KEY(call.id)); } catch {} });
    a.addEventListener("error", () => BS.toast("No se pudo cargar el audio."));

    play.onclick = () => (a.paused ? a.play() : a.pause());
    document.getElementById("mcBack").onclick = () => { a.currentTime = Math.max(0, a.currentTime - 15); };
    document.getElementById("mcFwd").onclick = () => { a.currentTime = Math.min(a.duration || 0, a.currentTime + 15); };
    speedBtn.onclick = () => {
      const next = SPEEDS[(SPEEDS.indexOf(a.playbackRate) + 1) % SPEEDS.length];
      a.playbackRate = next;
      speedBtn.textContent = `${next}x`;
    };
    seek.onclick = (e) => {
      const r = seek.getBoundingClientRect();
      if (a.duration) a.currentTime = ((e.clientX - r.left) / r.width) * a.duration;
    };
    document.querySelectorAll("[data-jump]").forEach((b) => (b.onclick = () => { a.currentTime = +b.dataset.jump; a.play(); }));
  }

  window.BSViews.calls = renderCalls;
})();
