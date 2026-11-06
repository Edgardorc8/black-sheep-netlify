/*
 * Ilustraciones IUL — el agente sube la ilustración PDF de Americo o Mutual of Omaha,
 * revisa los números que se leyeron y descarga la presentación (portada + resumen) con
 * el estilo del carrier. Todo pasa en el navegador: el PDF del cliente no se sube a ningún lado.
 */
(function () {
  const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
  const PDFJS_SRI = "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e";
  const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const PDFLIB = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
  const PDFLIB_SRI = "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI";
  const MAX_PDF_BYTES = 20 * 1024 * 1024;

  const scripts = {};
  const loadScript = (src, integrity) => (scripts[src] ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    if (integrity) { s.integrity = integrity; s.crossOrigin = "anonymous"; }
    s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar una herramienta de PDF. Revisa tu conexión a internet."));
    document.head.appendChild(s);
  }));

  let state = { step: "upload", data: null, fileName: "", pdfUrl: null, pdfBytes: null };

  const blank = (carrier) => ({
    carrier, client: "", insured: "", issueAge: null,
    product: carrier === "americo" ? "Instant Decision IUL" : "Indexed Universal Life Express",
    premium: null, mode: "Monthly", deathBenefit: null,
    riders: [{ kind: "terminal", label: "Terminal Illness Benefit:", amount: null, qualifies: BSIllustration.QUALIFIES.terminal }],
    rate: "", maxRate: "", agent: BS.me().name, agentExtra: "", date: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    state: "", policyForm: "", formCode: "", cash: [69, 74, 79, 84].map((age) => ({ age, value: null })),
  });

  // ---------- Leer el PDF ----------
  async function readPdf(file) {
    if (file.size > MAX_PDF_BYTES) throw new Error("El archivo PDF supera el límite permitido (20 MB).");
    await loadScript(PDFJS, PDFJS_SRI);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const doc = await window.pdfjsLib.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
      enableXfa: false,
      disableFontFace: true,
    }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const { items } = await (await doc.getPage(p)).getTextContent();
      pages.push(items.map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5] })));
    }
    return BSIllustration.parse(pages);
  }

  async function handleFile(file) {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return BS.toast("Sube un archivo PDF.");
    const zone = document.getElementById("ilDrop");
    if (zone) zone.classList.add("busy");
    try {
      const data = await readPdf(file);
      if (!data.agent) data.agent = BS.me().name;
      state = { step: "review", data, fileName: file.name, pdfUrl: null, pdfBytes: null };
      BS.render();
      BS.toast("Ilustración leída. Revisa los números antes de generar.");
    } catch (e) {
      if (zone) zone.classList.remove("busy");
      BS.toast(e.message || "No se pudo leer el PDF.");
    }
  }

  // ---------- Guardar archivo (ventana "Guardar como" si el navegador la tiene) ----------
  async function saveFile(bytes, name) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }] });
        const w = await h.createWritable(); await w.write(blob); await w.close();
        return BS.toast(`Guardado como "${h.name}".`);
      } catch (err) { if (err.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    BS.toast("Presentación descargada.");
  }

  const pctNum = (s) => parseFloat(String(s || "").replace(/[^0-9.]/g, "")) || null;
  const numOrNull = (v) => { const n = parseFloat(String(v ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) ? n : null; };
  const fileNameFor = (d) => `${(d.client || d.insured || "Cliente").replace(/[\\/:*?"<>|]+/g, "").trim()} - ${BSIllustrationPdf.THEMES[d.carrier].name}.pdf`;

  // ---------- Pantallas ----------
  function renderIllus() {
    const { esc, ICON } = BS;
    const d = state.data;
    let body = "";

    if (state.step === "upload" || !d) {
      body = `
        <label class="panel il-drop" id="ilDrop">
          <input type="file" accept="application/pdf,.pdf" id="ilFile" hidden>
          <span class="il-drop-icon">${ICON.upload}</span>
          <b>Sube la ilustración en PDF</b>
          <span>Americo o Mutual of Omaha · arrastra el archivo aquí o toca para elegirlo</span>
          <small>${ICON.lock} El PDF se lee en tu computadora. No se sube a ningún lado.</small>
          <span class="il-busy">Leyendo la ilustración…</span>
        </label>
        <div class="il-manual">
          <span class="muted">¿No tienes el PDF a la mano?</span>
          <button class="btn btn-ghost btn-sm" data-manual="americo">Llenar a mano · Americo</button>
          <button class="btn btn-ghost btn-sm" data-manual="omaha">Llenar a mano · Omaha</button>
        </div>`;
    } else {
      const max = pctNum(d.maxRate), used = pctNum(d.rate);
      const warnRate = max && used && used + 0.001 < max;
      const missing = [!d.client && "nombre del cliente", !d.premium && "prima", !d.deathBenefit && "death benefit", d.cash.some((c) => c.value == null) && "algún cash value"].filter(Boolean);
      const T = BSIllustrationPdf.THEMES[d.carrier];
      body = `
        <form class="panel card-pad il-form" id="ilForm" autocomplete="off">
          <div class="content-head">
            <div>
              <h3>${esc(T.name)} · Revisa los números</h3>
              <p class="hint">${state.fileName ? `Leído de <b>${esc(state.fileName)}</b>. ` : ""}Compáralos con la ilustración; puedes corregir cualquier dato.</p>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" id="ilReset">Subir otra</button>
          </div>
          ${warnRate ? `<div class="il-warn">⚠️ La ilustración se corrió al <b>${esc(d.rate)}</b> y la tasa máxima del carrier es <b>${esc(d.maxRate)}</b>. Si quieres mostrar el máximo, vuelve a correr la ilustración en el sistema de ${esc(T.name)}. No recalculamos números.</div>` : ""}
          ${missing.length ? `<div class="il-warn soft">Falta: ${missing.join(", ")}.</div>` : ""}

          <p class="pillar-label quote-section">Cliente y póliza</p>
          <div class="quote-grid">
            <label class="field"><span>Nombre del cliente</span><input class="input" name="client" value="${esc(d.client)}" required></label>
            <label class="field span-2"><span>Sexo, edad y clase</span><input class="input" name="insured" value="${esc(d.insured)}" placeholder="ej. Male, Age 50, Non-Nicotine"></label>
            <label class="field"><span>Producto</span><input class="input" name="product" value="${esc(d.product)}"></label>
            <label class="field"><span>Prima ($)</span><input class="input" name="premium" inputmode="decimal" value="${d.premium ?? ""}"></label>
            <label class="field"><span>Frecuencia</span><select class="input" name="mode">${["Monthly", "Quarterly", "Semi-Annual", "Annual"].map((m) => `<option ${m === d.mode ? "selected" : ""}>${m}</option>`).join("")}</select></label>
            <label class="field"><span>Death benefit ($)</span><input class="input" name="deathBenefit" inputmode="decimal" value="${d.deathBenefit ?? ""}"></label>
            <label class="field"><span>Tasa ilustrada</span><input class="input" name="rate" value="${esc(d.rate)}"></label>
            <label class="field"><span>Tasa máxima del carrier</span><input class="input" name="maxRate" value="${esc(d.maxRate)}"></label>
          </div>

          <p class="pillar-label quote-section">If I Become Ill · Riders</p>
          <div class="il-riders">
            ${d.riders.map((r, i) => `
              <div class="il-rider">
                <b>${esc(r.label.replace(/:$/, ""))}</b>
                <label class="field"><span>Monto máximo ($)</span><input class="input" name="ra${i}" inputmode="decimal" value="${r.amount ?? ""}" placeholder="Vacío = Determined at time of claim"></label>
                <label class="field"><span>Califica si…</span><input class="input" name="rq${i}" value="${esc(r.qualifies)}"></label>
                <button class="icon-btn" type="button" data-rmrider="${i}" aria-label="Quitar">${ICON.x}</button>
              </div>`).join("") || `<p class="hint">Sin riders de beneficios en vida.</p>`}
            <div class="il-add">${["terminal", "chronic", "critical"].filter((k) => !d.riders.some((r) => r.kind === k)).map((k) => `<button class="btn btn-ghost btn-sm" type="button" data-addrider="${k}">${ICON.plus}<span>${k === "terminal" ? "Terminal" : k === "chronic" ? "Chronic" : "Critical"}</span></button>`).join("")}</div>
          </div>

          <p class="pillar-label quote-section">If I Need Cash · Cash value proyectado</p>
          <div class="il-cash">
            ${d.cash.map((c, i) => `
              <div><label class="field"><span>Edad</span><input class="input" name="ca${i}" inputmode="numeric" value="${c.age}"></label>
              <label class="field"><span>Cash value ($)</span><input class="input" name="cv${i}" inputmode="decimal" value="${c.value ?? ""}"></label></div>`).join("")}
          </div>
          ${d.byAge && Object.keys(d.byAge).length ? `<p class="hint">Al cambiar una edad, el valor se toma solo de la ilustración (Non-Guaranteed Illustrated Surrender Value).</p>` : ""}

          <p class="pillar-label quote-section">Agente y pie de página</p>
          <div class="quote-grid">
            <label class="field"><span>Presentado por</span><input class="input" name="agent" value="${esc(d.agent)}"></label>
            <label class="field span-2"><span>Datos del agente (agencia, teléfono, licencia)</span><textarea class="input" name="agentExtra" rows="2">${esc(d.agentExtra)}</textarea></label>
            <label class="field"><span>Fecha de la ilustración</span><input class="input" name="date" value="${esc(d.date)}"></label>
            <label class="field"><span>Estado</span><input class="input" name="state" value="${esc(d.state)}"></label>
            <label class="field"><span>Policy form</span><input class="input" name="policyForm" value="${esc(d.policyForm)}"></label>
          </div>
          <div class="error"></div>
          <div class="modal-foot">
            <button class="btn" type="submit">${ICON.doc}<span>Generar presentación</span></button>
          </div>
        </form>
        ${state.pdfUrl ? `
        <section class="panel il-preview" id="ilPreview">
          <div class="panel-head"><h3>Vista previa</h3>
            <div class="toolbar"><button class="btn btn-sm" id="ilSave">${ICON.download}<span>Guardar PDF</span></button></div>
          </div>
          <iframe src="${state.pdfUrl}#view=FitH" title="Vista previa de la presentación"></iframe>
        </section>` : ""}`;
    }

    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head"><div><p class="eyebrow">Vender</p><h1>Ilustraciones IUL</h1></div></div>
      <p class="il-intro">Convierte la ilustración del carrier en una presentación clara para el cliente: <b>portada + "My Planned Life Insurance Offers"</b> con su prima, death benefit, beneficios en vida y cash value.</p>
      ${body}`);
    BS.bindShell();
    bindIllus();
  }

  // Lee el formulario y lo guarda en el estado (sin perder lo que el agente escribió).
  function readForm() {
    const form = document.getElementById("ilForm");
    if (!form) return;
    const f = Object.fromEntries(new FormData(form));
    const d = state.data;
    Object.assign(d, {
      client: f.client.trim(), insured: f.insured.trim(), product: f.product.trim(), mode: f.mode,
      premium: numOrNull(f.premium), deathBenefit: numOrNull(f.deathBenefit), rate: f.rate.trim(), maxRate: f.maxRate.trim(),
      agent: f.agent.trim(), agentExtra: f.agentExtra.trim(), date: f.date.trim(), state: f.state.trim(), policyForm: f.policyForm.trim(),
    });
    d.riders = d.riders.map((r, i) => ({ ...r, amount: numOrNull(f[`ra${i}`]), qualifies: (f[`rq${i}`] || "").trim() }));
    d.cash = d.cash.map((c, i) => {
      const age = parseInt(f[`ca${i}`], 10) || c.age;
      const typed = numOrNull(f[`cv${i}`]);
      // Si cambió la edad y la ilustración tiene ese año, se toma el valor real del ledger.
      const fromLedger = age !== c.age && d.byAge && d.byAge[age] != null ? d.byAge[age] : null;
      return { age, value: fromLedger ?? typed };
    });
  }

  function bindIllus() {
    const input = document.getElementById("ilFile");
    if (input) {
      const zone = document.getElementById("ilDrop");
      input.onchange = () => handleFile(input.files[0]);
      ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("over"); }));
      ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("over"); }));
      zone.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));
      document.querySelectorAll("[data-manual]").forEach((b) => (b.onclick = () => {
        state = { step: "review", data: blank(b.dataset.manual), fileName: "", pdfUrl: null, pdfBytes: null };
        BS.render();
      }));
      return;
    }
    const form = document.getElementById("ilForm");
    document.getElementById("ilReset").onclick = () => {
      if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
      state = { step: "upload", data: null, fileName: "", pdfUrl: null, pdfBytes: null };
      BS.render();
    };
    // Cambiar una edad del cash value trae el valor de la ilustración.
    form.querySelectorAll("[name^=ca]").forEach((el) => (el.onchange = () => { readForm(); BS.render(); }));
    document.querySelectorAll("[data-rmrider]").forEach((b) => (b.onclick = () => { readForm(); state.data.riders.splice(+b.dataset.rmrider, 1); BS.render(); }));
    document.querySelectorAll("[data-addrider]").forEach((b) => (b.onclick = () => {
      readForm();
      const k = b.dataset.addrider;
      state.data.riders.push({ kind: k, label: `${k[0].toUpperCase() + k.slice(1)} Illness Benefit:`, amount: null, qualifies: BSIllustration.QUALIFIES[k] });
      state.data.riders.sort((a, b) => ["terminal", "chronic", "critical"].indexOf(a.kind) - ["terminal", "chronic", "critical"].indexOf(b.kind));
      BS.render();
    }));
    BS.bindForm(form, async () => {
      readForm();
      const d = state.data;
      if (!d.client) throw new Error("Escribe el nombre del cliente.");
      if (!d.premium || !d.deathBenefit) throw new Error("Faltan la prima o el death benefit.");
      await loadScript(PDFLIB, PDFLIB_SRI);
      const logo = new Uint8Array(await (await fetch(BSIllustrationPdf.THEMES[d.carrier].logo)).arrayBuffer());
      const bytes = await BSIllustrationPdf.build(d, logo);
      if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
      state.pdfBytes = bytes;
      state.pdfUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      await BS.render();
      document.getElementById("ilPreview")?.scrollIntoView({ behavior: "smooth" });
    }, "Generando…");
    const save = document.getElementById("ilSave");
    if (save) save.onclick = () => saveFile(state.pdfBytes, fileNameFor(state.data));
    // Al escribir, la vista previa deja de coincidir: se quita para no confundir.
    form.addEventListener("input", () => {
      const prev = document.getElementById("ilPreview");
      if (prev && !prev.classList.contains("stale")) { prev.classList.add("stale"); prev.querySelector(".panel-head h3").textContent = "Vista previa (vuelve a generar para ver los cambios)"; }
    });
  }

  window.BSViews.illus = renderIllus;
})();
