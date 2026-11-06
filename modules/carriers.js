/*
 * Carriers — directorio de compañías: teléfonos de servicio al cliente / agentes, correos
 * y botones a los portales y herramientas oficiales. Lo ve todo el equipo; el administrador
 * agrega, edita y elimina carriers desde la misma pantalla.
 */
(function () {
  const INTEGRITY_URL = "https://connect.integrity.com/ClientsSSO";
  let query = "";

  const isEmail = (v) => /@/.test(v);
  const telHref = (v) => "tel:" + String(v).replace(/[^\d+]/g, "");
  const initials = (n) => n.replace(/[^A-Za-z& ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  // "Etiqueta | valor" por línea ↔ lista de objetos
  const toLines = (list, key) => (list || []).map((x) => `${x.label} | ${x[key]}`).join("\n");
  const fromLines = (text, key) => String(text || "").split(/\r?\n/).map((l) => {
    const i = l.indexOf("|");
    return i < 0 ? null : { label: l.slice(0, i).trim(), [key]: l.slice(i + 1).trim() };
  }).filter((x) => x && x.label && x[key]);

  function carrierModal(c) {
    const { esc } = BS;
    BS.openModal(c ? `Editar ${esc(c.name)}` : "Agregar carrier", `
      <form id="carrierForm">
        <label class="field"><span>Nombre del carrier</span><input class="input" name="name" value="${esc(c?.name)}" required></label>
        <label class="field"><span>Teléfonos y correos (uno por línea: Etiqueta | número o correo)</span>
          <textarea class="input mono" name="contacts" rows="4" placeholder="Customer Service | (800) 231-0801&#10;New Business | nuevos@carrier.com">${esc(toLines(c?.contacts, "value"))}</textarea></label>
        <label class="field"><span>Botones (uno por línea: Etiqueta | https://enlace)</span>
          <textarea class="input mono" name="links" rows="5" placeholder="Agent Portal | https://...&#10;Underwriting Guide | https://...">${esc(toLines(c?.links, "url"))}</textarea></label>
        <p class="hint">Para una guía en PDF, pega el enlace del PDF (por ejemplo, de Google Drive con acceso para tu equipo).</p>
        <div class="error"></div>
        <div class="modal-foot">
          ${c ? `<button class="btn btn-ghost btn-danger" type="button" id="carrierDelete">Eliminar</button><span class="spacer"></span>` : ""}
          <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn" type="submit">${c ? "Guardar cambios" : "Agregar carrier"}</button>
        </div>
      </form>`, (dlg) => {
      BS.bindForm(dlg.querySelector("form"), async (f) => {
        await BSData.saveCarrier({ ...(c || {}), name: f.name, contacts: fromLines(f.contacts, "value"), links: fromLines(f.links, "url") });
        BS.toast(c ? "Carrier actualizado." : "Carrier agregado.");
        await BS.render();
      }, "Guardando…");
      const del = dlg.querySelector("#carrierDelete");
      if (del) del.onclick = async () => {
        if (!confirm(`¿Eliminar ${c.name} del directorio?`)) return;
        await BSData.deleteCarrier(c.id);
        BS.toast("Carrier eliminado.");
        await BS.render();
      };
    });
  }

  async function renderCarriers() {
    const { esc, ICON } = BS;
    const isAdmin = BS.me().role === "admin";
    const carriers = await BSData.listCarriers();
    const q = query.trim().toLowerCase();
    const shown = carriers.filter((c) => !q || `${c.name} ${c.contacts.map((x) => x.label + " " + x.value).join(" ")} ${c.links.map((l) => l.label).join(" ")}`.toLowerCase().includes(q));

    const card = (c) => `
      <article class="panel carrier-card">
        <header>
          ${c.logo ? `<span class="carrier-logo"><img src="${esc(c.logo)}" alt=""></span>` : `<span class="carrier-mono">${esc(initials(c.name))}</span>`}
          <h3>${esc(c.name)}</h3>
          ${isAdmin && !String(c.id).startsWith("seed-") ? `<button class="icon-btn" data-edit="${c.id}" aria-label="Editar ${esc(c.name)}">${ICON.edit}</button>` : ""}
        </header>
        ${c.contacts.length ? `<ul class="carrier-contacts">${c.contacts.map((x) => `
          <li class="${isEmail(x.value) ? "is-email" : ""}">
            <span>${esc(x.label)}</span>
            <a href="${isEmail(x.value) ? "mailto:" + esc(x.value) : telHref(x.value)}">${esc(x.value)}</a>
            <button class="icon-btn" data-copy="${esc(x.value)}" aria-label="Copiar ${esc(x.value)}" title="Copiar">${ICON.copy}</button>
          </li>`).join("")}</ul>` : ""}
        ${c.links.length ? `<div class="carrier-links">${c.links.map((l) => `
          <a class="btn btn-ghost btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${ICON.external}<span>${esc(l.label)}</span></a>`).join("")}</div>` : ""}
      </article>`;

    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head">
        <div><p class="eyebrow">Vender</p><h1>Carriers</h1></div>
        ${isAdmin ? `<button class="btn btn-sm" id="newCarrier">${ICON.plus}<span>Agregar carrier</span></button>` : ""}
      </div>
      <p class="il-intro">Portales de agente, herramientas y números de soporte de cada compañía, a un clic.</p>
      <section class="panel carrier-banner">
        <div><p class="eyebrow">Cotiza primero</p><b>Integrity Connect te dice con qué carrier califica tu cliente.</b></div>
        <div class="head-actions">
          <button class="btn btn-ghost btn-sm" data-go="quote">${ICON.search}<span>Ficha del cliente</span></button>
          <a class="btn btn-sm" href="${INTEGRITY_URL}" target="_blank" rel="noopener noreferrer">${ICON.external}<span>Abrir Integrity</span></a>
        </div>
      </section>
      <div class="mc-filters"><span class="muted">${carriers.length} carriers</span>
        <input class="input search" type="search" id="carrierSearch" placeholder="Buscar carrier, teléfono o herramienta" value="${esc(query)}"></div>
      ${shown.length ? `<div class="carrier-grid">${shown.map(card).join("")}</div>`
        : `<section class="panel empty"><p>${carriers.length ? "Ningún carrier coincide con la búsqueda." : "Todavía no hay carriers."}</p></section>`}`);
    BS.bindShell();

    if (isAdmin) document.getElementById("newCarrier").onclick = () => carrierModal(null);
    document.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => carrierModal(carriers.find((c) => c.id === b.dataset.edit))));
    document.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); BS.toast(`Copiado: ${b.dataset.copy}`); } catch { BS.toast("No se pudo copiar."); }
    }));
    const search = document.getElementById("carrierSearch");
    search.oninput = () => { query = search.value; clearTimeout(search._t); search._t = setTimeout(async () => { await BS.render(); const s = document.getElementById("carrierSearch"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 200); };
  }

  window.BSViews.carriers = renderCarriers;
})();
