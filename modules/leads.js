/*
 * Inversión en leads — la misma lógica de la hoja "Rentabilidad de Leads":
 *   Costo por lead = Inversión ÷ Leads comprados
 *   Rentabilidad   = Adelanto de las ventas de la campaña − Inversión
 *   ROI            = Rentabilidad ÷ Inversión
 * Las ventas viven en "Mis ventas" y se enlazan a la campaña (y al lead) que las generó.
 */
(function () {
  const LEAD_STATUSES = ["Vendido", "Lo está pensando", "Agendado", "Llamar", "Ya contestó", "NHC", "Estaba trabajando"];
  const statusClass = (s) => "ls-" + String(s || "nuevo").toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");

  let openId = null;            // campaña abierta (null = lista de campañas)
  let leadFilter = "";          // filtro de estatus dentro de la campaña

  function metrics(c, sales, leads) {
    const S = window.BSSales;
    const mine = sales.filter((s) => s.campaignId === c.id);
    const t = S.totals(mine);
    const inv = S.num(c.investment);
    const bought = S.num(c.leadsBought);
    const inList = leads.filter((l) => l.campaignId === c.id).length;
    const profit = t.adv - inv;
    return {
      inv, bought, inList, sales: t.count, ap: t.ap, ip: t.ip, adv: t.adv, profit,
      roi: inv > 0 ? profit / inv : null,
      cpl: bought > 0 ? inv / bought : null,
      cps: t.count > 0 ? inv / t.count : null,
      close: (bought || inList) > 0 ? t.count / (bought || inList) : null,
    };
  }

  const roiCell = (roi) => roi === null ? '<span class="muted">—</span>'
    : `<b class="${roi >= 0 ? "pos" : "neg"}">${roi >= 0 ? "+" : ""}${Math.round(roi * 100)}%</b>`;
  const moneySigned = (n) => `<b class="${n >= 0 ? "pos" : "neg"}">${n < 0 ? "−" : ""}${window.BSSales.money(Math.abs(n))}</b>`;

  function campaignModal(c) {
    const { esc } = BS;
    BS.openModal(c ? "Editar campaña" : "Nueva campaña", `
      <form id="campForm">
        <label class="field"><span>Nombre de la campaña</span><input class="input" name="name" value="${esc(c?.name)}" placeholder="ej. Campaña David Mayo" required></label>
        <div class="form-grid">
          <label class="field"><span>Proveedor de leads</span><input class="input" name="vendor" value="${esc(c?.vendor)}" placeholder="ej. David"></label>
          <label class="field"><span>Fecha de compra</span><input class="input" type="date" name="date" value="${esc(c?.date || new Date().toISOString().slice(0, 10))}"></label>
          <label class="field"><span>Inversión ($)</span><input class="input" name="investment" inputmode="decimal" value="${esc(c?.investment)}" placeholder="ej. 500" required></label>
          <label class="field"><span>Leads comprados</span><input class="input" name="leadsBought" inputmode="numeric" value="${esc(c?.leadsBought)}" placeholder="ej. 50"></label>
        </div>
        <div class="error"></div>
        <div class="modal-foot">
          ${c ? `<button class="btn btn-ghost btn-danger" type="button" id="campDelete">Eliminar campaña</button><span class="spacer"></span>` : ""}
          <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn" type="submit">${c ? "Guardar" : "Crear campaña"}</button>
        </div>
      </form>`, (dlg) => {
      const me = BS.me(), S = window.BSSales;
      BS.bindForm(dlg.querySelector("form"), async (f) => {
        const saved = await BSData.saveItem(me.id, "campaign", {
          ...(c || {}), name: f.name.trim(), vendor: f.vendor.trim(), date: f.date,
          investment: S.num(f.investment), leadsBought: S.num(f.leadsBought),
        });
        BS.closeModal();
        BS.toast(c ? "Campaña actualizada." : "Campaña creada. Ahora agrega tus leads.");
        openId = saved.id;
        BS.render();
      }, "Guardando…");
      const del = dlg.querySelector("#campDelete");
      if (del) del.onclick = async () => {
        if (!confirm(`¿Eliminar "${c.name}" y todos sus leads? Las ventas se quedan en Mis ventas, pero sin campaña.`)) return;
        const [leads, sales] = await Promise.all([BSData.items(me.id, "lead"), BSData.items(me.id, "sale")]);
        for (const l of leads.filter((l) => l.campaignId === c.id)) await BSData.deleteItem(me.id, "lead", l.id);
        for (const s of sales.filter((s) => s.campaignId === c.id)) await BSData.saveItem(me.id, "sale", { ...s, campaignId: null, leadId: null });
        await BSData.deleteItem(me.id, "campaign", c.id);
        BS.closeModal();
        openId = null;
        BS.toast("Campaña eliminada.");
        BS.render();
      };
    });
  }

  function leadModal(lead, campaignId) {
    const { esc } = BS;
    BS.openModal(lead ? "Editar lead" : "Agregar lead", `
      <form id="leadForm">
        <div class="form-grid">
          <label class="field"><span>Nombre</span><input class="input" name="name" value="${esc(lead?.name)}" required></label>
          <label class="field"><span>Teléfono</span><input class="input" name="phone" value="${esc(lead?.phone)}"></label>
          <label class="field"><span>Correo</span><input class="input" name="email" value="${esc(lead?.email)}"></label>
          <label class="field"><span>Estado</span><input class="input" name="state" value="${esc(lead?.state)}" placeholder="ej. TX"></label>
          <label class="field"><span>Compañía</span><input class="input" name="company" value="${esc(lead?.company)}"></label>
          <label class="field"><span>Estatus</span><select class="input" name="status"><option value="">Sin llamar</option>${LEAD_STATUSES.map((s) => `<option ${s === lead?.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>Notas</span><textarea class="input" name="notes" rows="2">${esc(lead?.notes)}</textarea></label>
        <div class="error"></div>
        <div class="modal-foot">
          ${lead ? `<button class="btn btn-ghost btn-danger" type="button" id="leadDelete">Eliminar</button><span class="spacer"></span>` : ""}
          <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn" type="submit">${lead ? "Guardar" : "Agregar"}</button>
        </div>
      </form>`, (dlg) => {
      const me = BS.me();
      BS.bindForm(dlg.querySelector("form"), async (f) => {
        const saved = await BSData.saveItem(me.id, "lead", { ...(lead || {}), campaignId, ...trimAll(f) });
        BS.closeModal();
        if (saved.status === "Vendido" && !saved.saleId) return sellLead(saved);
        if (TO_AGENDA.includes(saved.status) && saved.status !== lead?.status) return maybeSchedule(saved);
        BS.render();
      }, "Guardando…");
      const del = dlg.querySelector("#leadDelete");
      if (del) del.onclick = async () => {
        if (!confirm(`¿Eliminar a ${lead.name} de la lista?`)) return;
        await BSData.deleteItem(me.id, "lead", lead.id);
        BS.closeModal();
        BS.render();
      };
    });
  }
  // ---------- Leads → Agenda ----------
  // Al pasar un lead a estos estatus se ofrece agendar la llamada.
  const TO_AGENDA = ["Agendado", "Llamar", "Lo está pensando"];
  const digits = (p) => String(p || "").replace(/\D/g, "");
  const sameContact = (call, lead) => (digits(lead.phone) ? digits(call.phone) === digits(lead.phone) : call.name.trim().toLowerCase() === lead.name.trim().toLowerCase());
  const nextCallOf = (lead, calls) => calls
    .filter((c) => c.status === "pending" && sameContact(c, lead))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const pad = (n) => String(n).padStart(2, "0");
  const fmt12 = (t) => { let [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${h}:${pad(m)}${ap}`; };
  const md = (d) => `${d.slice(5, 7)}/${d.slice(8, 10)}`;

  function scheduleModal(lead) {
    const { esc } = BS;
    // Sugerencia: la siguiente hora en punto; después de las 8 pm, mañana a las 10 am.
    const t = new Date(); t.setMinutes(0, 0, 0); t.setHours(t.getHours() + 1);
    if (t.getHours() >= 21 || t.getHours() < 8) { if (t.getHours() >= 21) t.setDate(t.getDate() + 1); t.setHours(10); }
    const date = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`, time = `${pad(t.getHours())}:00`;
    BS.openModal("Agendar llamada", `
      <form id="schedForm">
        <p class="hint">Se agrega a tu <b>Agenda</b> con su nombre y teléfono. Si no contesta, ahí se reagenda solo.</p>
        <div class="form-grid">
          <label class="field"><span>Fecha</span><input class="input" type="date" name="date" value="${date}" required></label>
          <label class="field"><span>Hora</span><input class="input" type="time" name="time" value="${time}" required></label>
          <label class="field"><span>Nombre</span><input class="input" name="name" value="${esc(lead.name)}" required></label>
          <label class="field"><span>Teléfono</span><input class="input" name="phone" value="${esc(lead.phone)}"></label>
        </div>
        <label class="field"><span>Nota</span><input class="input" name="note" value="${esc([lead.status, lead.notes].filter(Boolean).join(" · "))}"></label>
        <div class="error"></div>
        <div class="modal-foot"><button class="btn btn-ghost" type="button" id="schedLater">Ahora no</button><button class="btn" type="submit">${BS.ICON.calendar}<span>Agendar</span></button></div>
      </form>`, (dlg) => {
      // render() también cierra la ventana y refresca la tabla (estatus y columna Agenda).
      dlg.querySelector("#schedLater").onclick = () => BS.render();
      BS.bindForm(dlg.querySelector("form"), async (f) => {
        await window.BSAgenda.saveCall({ date: f.date, time: f.time, name: f.name.trim(), phone: digits(f.phone), note: f.note.trim(), status: "pending" });
        BS.toast(`Llamada agendada: ${md(f.date)} ${fmt12(f.time)}`);
        await BS.render();
      }, "Agendando…");
    });
  }
  // Ofrece agendar solo si ese contacto no tiene ya una llamada pendiente.
  async function maybeSchedule(lead) {
    const calls = await BSData.items(BS.me().id, "call");
    if (nextCallOf(lead, calls)) return BS.render();
    scheduleModal(lead);
  }

  const trimAll = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v).trim()]));

  // Registrar la venta de un lead: abre el formulario de venta ya lleno y enlaza ambos.
  function sellLead(lead) {
    window.BSSales.saleModal(null, {
      presets: { client: lead.name, phone: lead.phone, campaignId: lead.campaignId, leadId: lead.id },
      onSaved: async (sale) => {
        await BSData.saveItem(BS.me().id, "lead", { ...lead, status: "Vendido", saleId: sale.id });
        BS.render();
      },
    });
  }

  function importModal(campaignId) {
    BS.openModal("Pegar lista de leads", `
      <form id="importForm">
        <p class="hint">Copia las filas desde Excel o Google Sheets y pégalas aquí. Una persona por línea, en este orden:<br><b>Nombre · Teléfono · Correo · Estado · Compañía</b> (solo el nombre es obligatorio).</p>
        <label class="field"><span>Lista</span><textarea class="input mono" name="list" rows="9" placeholder="Juan Pérez	(555) 123-4567	juan@correo.com	TX&#10;María López, 555-987-6543, , FL" required></textarea></label>
        <div class="error"></div>
        <div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn" type="submit">Agregar leads</button></div>
      </form>`, (dlg) => {
      BS.bindForm(dlg.querySelector("form"), async (f) => {
        const rows = f.list.split(/\r?\n/).map((line) => line.split(/\t|,|;/).map((x) => x.trim())).filter((r) => r[0]);
        if (!rows.length) throw new Error("No encontré ningún nombre en la lista.");
        await BSData.saveItems(BS.me().id, "lead", rows.map(([name, phone = "", email = "", state = "", company = ""]) =>
          ({ campaignId, name, phone, email, state, company, status: "" })));
        BS.closeModal();
        BS.toast(`${rows.length} ${rows.length === 1 ? "lead agregado" : "leads agregados"}.`);
        BS.render();
      }, "Agregando…");
    });
  }

  // ---------- Pantallas ----------
  async function renderLeads() {
    const me = BS.me();
    const [campaigns, sales, leads, calls] = await Promise.all([BSData.items(me.id, "campaign"), BSData.items(me.id, "sale"), BSData.items(me.id, "lead"), BSData.items(me.id, "call")]);
    const open = campaigns.find((c) => c.id === openId);
    if (open) return renderCampaign(open, sales, leads, calls);
    openId = null;

    const { esc, ICON } = BS, S = window.BSSales;
    const list = campaigns.map((c) => ({ c, m: metrics(c, sales, leads) })).sort((a, b) => String(b.c.date).localeCompare(String(a.c.date)));
    const tot = list.reduce((t, { m }) => ({ inv: t.inv + m.inv, adv: t.adv + m.adv, sales: t.sales + m.sales, bought: t.bought + m.bought }), { inv: 0, adv: 0, sales: 0, bought: 0 });
    const profit = tot.adv - tot.inv;

    const rows = list.map(({ c, m }) => `
      <tr class="row-link" data-open="${c.id}">
        <td><b>${esc(c.name)}</b><br><small class="muted">${esc(c.vendor || "Sin proveedor")} · ${esc(c.date || "")}</small></td>
        <td class="num">${S.money(m.inv)}</td>
        <td class="num hide-sm">${m.bought || m.inList}</td>
        <td class="num">${m.sales}</td>
        <td class="num hide-md">${m.cpl === null ? "—" : S.money(m.cpl)}</td>
        <td class="num hide-sm">${moneySigned(m.profit)}</td>
        <td class="num">${roiCell(m.roi)}</td>
      </tr>`).join("");

    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head">
        <div><p class="eyebrow">Vender</p><h1>Inversión en leads</h1></div>
        <button class="btn btn-sm" id="newCamp">${ICON.plus}<span>Nueva campaña</span></button>
      </div>
      <div class="stats four">
        <div class="stat"><span>Invertido</span><b>${S.money(tot.inv)}</b></div>
        <div class="stat"><span>Adelanto generado</span><b class="gold">${S.money(tot.adv)}</b></div>
        <div class="stat"><span>Rentabilidad</span>${moneySigned(profit)}</div>
        <div class="stat"><span>ROI</span>${tot.inv > 0 ? roiCell(profit / tot.inv) : "<b>—</b>"}</div>
      </div>
      <section class="panel">
        <div class="panel-head"><h3>Campañas</h3><span>${campaigns.length} ${campaigns.length === 1 ? "campaña" : "campañas"} · ${tot.sales} ventas</span></div>
        ${rows ? `<div class="table-scroll"><table class="table">
          <thead><tr><th>Campaña</th><th class="num">Inversión</th><th class="num hide-sm">Leads</th><th class="num">Ventas</th><th class="num hide-md">Costo/lead</th><th class="num hide-sm">Rentabilidad</th><th class="num">ROI</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
        : `<div class="empty"><p>Crea tu primera campaña: anota cuánto invertiste y cuántos leads compraste.<br>Luego agrega los leads y marca los que vendas.</p></div>`}
      </section>`);
    BS.bindShell();
    document.getElementById("newCamp").onclick = () => campaignModal(null);
    document.querySelectorAll("[data-open]").forEach((tr) => (tr.onclick = () => { openId = tr.dataset.open; leadFilter = ""; BS.render(); window.scrollTo(0, 0); }));
  }

  function renderCampaign(c, sales, allLeads, calls) {
    const { esc, ICON } = BS, S = window.BSSales;
    const m = metrics(c, sales, allLeads);
    const leads = allLeads.filter((l) => l.campaignId === c.id);
    const counts = {};
    leads.forEach((l) => { counts[l.status || ""] = (counts[l.status || ""] || 0) + 1; });
    const shown = leadFilter === null || leadFilter === "" ? leads : leads.filter((l) => (l.status || "-") === leadFilter);
    const saleOf = (l) => l.saleId && sales.find((s) => s.id === l.saleId);

    const chips = [["", `Todos · ${leads.length}`], ...[["-", "Sin llamar"], ...LEAD_STATUSES.map((s) => [s, s])]
      .filter(([k]) => counts[k === "-" ? "" : k])
      .map(([k, label]) => [k, `${label} · ${counts[k === "-" ? "" : k]}`])];

    const rows = shown.map((l) => {
      const sale = saleOf(l);
      const next = nextCallOf(l, calls);
      return `<tr class="${sale ? "is-sold" : ""}">
        <td><button class="link-btn" data-lead="${l.id}">${esc(l.name)}</button>${l.notes ? `<br><small class="muted">${esc(l.notes)}</small>` : ""}</td>
        <td class="nowrap">${l.phone ? `<a class="muted-link" href="tel:${esc(l.phone.replace(/[^0-9+]/g, ""))}">${esc(l.phone)}</a>` : ""}</td>
        <td class="nowrap">${next
          ? `<button class="link-btn gold sched-next" data-go="agenda" title="Ver en la Agenda">${ICON.calendar}<span>${md(next.date)} ${fmt12(next.time)}</span></button>`
          : sale ? "" : `<button class="btn btn-ghost btn-sm" data-sched="${l.id}">${ICON.calendar}<span>Agendar</span></button>`}</td>
        <td class="hide-md">${esc(l.email)}</td>
        <td class="hide-sm">${esc(l.state)}</td>
        <td class="hide-md">${esc(l.company)}</td>
        <td><select class="status-select ${statusClass(l.status)}" data-status="${l.id}">
          <option value="">Sin llamar</option>${LEAD_STATUSES.map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`).join("")}
        </select></td>
        <td class="num">${sale ? `<button class="link-btn gold" data-sale="${sale.id}">${S.money(S.calc(sale).ap)}</button>`
          : l.status === "Vendido" ? `<button class="btn btn-ghost btn-sm" data-sell="${l.id}">Registrar venta</button>` : ""}</td>
      </tr>`;
    }).join("");

    document.getElementById("app").innerHTML = BS.shell(`
      <button class="back-link" id="backCamps">${ICON.back}<span>Todas las campañas</span></button>
      <div class="page-head">
        <div><p class="eyebrow">${esc(c.vendor || "Campaña")} · ${esc(c.date || "")}</p><h1>${esc(c.name)}</h1></div>
        <button class="btn btn-ghost btn-sm" id="editCamp">${ICON.edit}<span>Editar campaña</span></button>
      </div>

      <div class="kpis">
        <div><span>Inversión</span><b>${S.money(m.inv)}</b></div>
        <div><span>Leads comprados</span><b>${m.bought}</b></div>
        <div><span>Leads en la lista</span><b>${m.inList}</b></div>
        <div><span>Ventas</span><b>${m.sales}</b></div>
        <div><span>Cierre</span><b>${m.close === null ? "—" : S.pct(m.close)}</b></div>
        <div><span>Costo por lead</span><b>${m.cpl === null ? "—" : S.money(m.cpl)}</b></div>
        <div><span>Costo por venta</span><b>${m.cps === null ? "—" : S.money(m.cps)}</b></div>
        <div><span>AP submitido</span><b>${S.money(m.ap)}</b></div>
        <div><span>Comisión (IP)</span><b>${S.money(m.ip)}</b></div>
        <div><span>Adelanto</span><b class="gold">${S.money(m.adv)}</b></div>
        <div class="kpi-big"><span>Rentabilidad</span>${moneySigned(m.profit)}</div>
        <div class="kpi-big"><span>ROI</span>${roiCell(m.roi)}</div>
      </div>

      <section class="panel">
        <div class="panel-head">
          <h3>Leads <span class="muted">· ${leads.length}</span></h3>
          <div class="toolbar">
            <button class="btn btn-ghost btn-sm" id="importLeads">Pegar lista</button>
            <button class="btn btn-sm" id="addLead">${ICON.plus}<span>Agregar lead</span></button>
          </div>
        </div>
        ${leads.length ? `<div class="chips">${chips.map(([k, label]) => `<button class="chip" data-filter="${esc(k)}" aria-pressed="${leadFilter === k}">${esc(label)}</button>`).join("")}</div>` : ""}
        ${rows ? `<div class="table-scroll"><table class="table leads-table">
          <thead><tr><th>Nombre</th><th>Teléfono</th><th>Agenda</th><th class="hide-md">Correo</th><th class="hide-sm">Estado</th><th class="hide-md">Compañía</th><th>Estatus</th><th class="num">Venta (AP)</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
        : `<div class="empty"><p>${leads.length ? "No hay leads con ese estatus." : "Agrega los leads de esta campaña uno por uno o pega la lista completa desde Excel."}</p></div>`}
      </section>`);
    BS.bindShell();

    const me = BS.me();
    document.getElementById("backCamps").onclick = () => { openId = null; BS.render(); };
    document.getElementById("editCamp").onclick = () => campaignModal(c);
    document.getElementById("addLead").onclick = () => leadModal(null, c.id);
    document.getElementById("importLeads").onclick = () => importModal(c.id);
    document.querySelectorAll("[data-filter]").forEach((b) => (b.onclick = () => { leadFilter = b.dataset.filter; BS.render(); }));
    document.querySelectorAll("[data-lead]").forEach((b) => (b.onclick = () => leadModal(leads.find((l) => l.id === b.dataset.lead), c.id)));
    document.querySelectorAll("[data-sell]").forEach((b) => (b.onclick = () => sellLead(leads.find((l) => l.id === b.dataset.sell))));
    document.querySelectorAll("[data-sale]").forEach((b) => (b.onclick = () => S.saleModal(sales.find((s) => s.id === b.dataset.sale))));
    document.querySelectorAll("[data-status]").forEach((sel) => (sel.onchange = async () => {
      const lead = leads.find((l) => l.id === sel.dataset.status);
      const saved = await BSData.saveItem(me.id, "lead", { ...lead, status: sel.value });
      if (sel.value === "Vendido" && !saved.saleId) return sellLead(saved);
      if (TO_AGENDA.includes(sel.value)) return maybeSchedule(saved);
      sel.className = `status-select ${statusClass(sel.value)}`;
      BS.render();
    }));
    document.querySelectorAll("[data-sched]").forEach((b) => (b.onclick = () => scheduleModal(leads.find((l) => l.id === b.dataset.sched))));
  }

  window.BSViews.leads = renderLeads;
})();
