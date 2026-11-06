/*
 * Mis ventas y comisiones.
 * Cada venta guarda la prima mensual y los % de comisión y adelanto; con eso se calcula:
 *   AP (prima anual) = prima mensual × 12
 *   Comisión (IP)    = AP × % de comisión
 *   Adelanto         = Comisión × % de adelanto
 * Las ventas canceladas o declinadas no suman.
 * Los % no son fijos (cambian por carrier, producto y contrato): el agente los escribe en cada venta.
 */
(function () {
  const CARRIERS = ["Americo", "Mutual of Omaha", "Transamerica", "National Life Group", "F&G", "Ethos", "Otro"];
  const PRODUCTS = ["IUL", "Vida a término", "Final Expense", "Vida entera", "Anualidad", "Otro"];
  const STATUSES = [
    ["submitted", "Enviada"],
    ["approved", "Aprobada"],
    ["issued", "Emitida"],
    ["paid", "Pagada"],
    ["declined", "Declinada"],
    ["cancelled", "Cancelada"],
  ];
  const INACTIVE = ["cancelled", "declined"];   // no suman ni generan seguimientos
  const DEFAULT_PREFS = { goal: 0 };
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };
  const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
  const pct = (n) => `${Math.round((n || 0) * 100)}%`;
  const statusLabel = (s) => (STATUSES.find(([k]) => k === s) || STATUSES[0])[1];
  const today = () => new Date().toISOString().slice(0, 10);
  const monthKey = (date) => String(date || "").slice(0, 7);

  function calc(sale) {
    const ap = num(sale.monthly) * 12;
    const ip = ap * num(sale.commission) / 100;
    const adv = ip * num(sale.advance) / 100;
    return { ap, ip, adv, active: !INACTIVE.includes(sale.status) };
  }
  function totals(sales) {
    return sales.reduce((t, s) => {
      const c = calc(s);
      if (!c.active) return t;
      return { ap: t.ap + c.ap, ip: t.ip + c.ip, adv: t.adv + c.adv, count: t.count + 1 };
    }, { ap: 0, ip: 0, adv: 0, count: 0 });
  }

  async function getPrefs() {
    const [p] = await BSData.items(BS.me().id, "prefs");
    return { ...DEFAULT_PREFS, ...(p || {}) };
  }
  const savePrefs = (p) => BSData.saveItem(BS.me().id, "prefs", p);

  // ---------- Formulario de venta (también lo usa Inversión en leads) ----------
  async function saleModal(sale, { presets = {}, onSaved } = {}) {
    const { esc } = BS;
    const me = BS.me();
    const campaigns = await BSData.items(me.id, "campaign");
    const s = { date: today(), status: "submitted", carrier: "", product: "IUL", ...presets, ...(sale || {}) };
    const opts = (list, cur) => list.map((x) => `<option ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("");

    BS.openModal(sale ? "Editar venta" : "Registrar venta", `
      <form id="saleForm">
        <div class="form-grid">
          <label class="field"><span>Cliente</span><input class="input" name="client" value="${esc(s.client)}" required></label>
          <label class="field"><span>Teléfono</span><input class="input" name="phone" value="${esc(s.phone)}"></label>
          <label class="field"><span>Fecha de la venta</span><input class="input" type="date" name="date" value="${esc(s.date)}" required></label>
          <label class="field"><span>Estatus</span><select class="input" name="status">${STATUSES.map(([k, l]) => `<option value="${k}" ${k === s.status ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="field"><span>Carrier</span><select class="input" name="carrier" required><option value="">Elige…</option>${opts(CARRIERS, s.carrier)}</select></label>
          <label class="field"><span>Producto</span><select class="input" name="product">${opts(PRODUCTS, s.product)}</select></label>
          <label class="field"><span>Prima mensual ($)</span><input class="input" name="monthly" inputmode="decimal" value="${esc(s.monthly)}" placeholder="ej. 200" required></label>
          <label class="field"><span>Campaña de leads</span><select class="input" name="campaignId">
            <option value="">Ninguna (referido u otro)</option>
            ${campaigns.map((c) => `<option value="${c.id}" ${c.id === s.campaignId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
          </select></label>
          <label class="field"><span>% de comisión de esta venta</span><input class="input" name="commission" inputmode="decimal" value="${esc(s.commission)}" placeholder="ej. 80" required></label>
          <label class="field"><span>% de adelanto de esta venta</span><input class="input" name="advance" inputmode="decimal" value="${esc(s.advance)}" placeholder="ej. 75 (0 si no hay)" required></label>
        </div>
        <label class="field"><span>Notas</span><textarea class="input" name="notes" rows="2">${esc(s.notes)}</textarea></label>
        <div class="calc-preview" id="salePreview"></div>
        ${sale ? `<div class="modal-section"><h4>Seguimiento del cliente</h4>${window.BSFollow.historyHtml(sale)}</div>`
          : `<p class="hint">Al registrar la venta se programa el seguimiento obligatorio: un mensaje cada 3 meses y la revisión de la póliza cada año.</p>`}
        <div class="error"></div>
        <div class="modal-foot">
          ${sale ? `<button class="btn btn-ghost btn-danger" type="button" id="saleDelete">Eliminar</button><span class="spacer"></span>` : ""}
          <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn" type="submit">${sale ? "Guardar cambios" : "Registrar venta"}</button>
        </div>
      </form>`, (dlg) => {
      const form = dlg.querySelector("form");
      const preview = () => {
        const f = Object.fromEntries(new FormData(form));
        const c = calc(f);
        dlg.querySelector("#salePreview").innerHTML = `
          <div><span>AP (anual)</span><b>${money(c.ap)}</b></div>
          <div><span>Comisión</span><b>${money(c.ip)}</b></div>
          <div><span>Adelanto</span><b class="gold">${money(c.adv)}</b></div>`;
      };
      form.addEventListener("input", preview);
      preview();
      BS.bindForm(form, async (f) => {
        if (num(f.monthly) <= 0) throw new Error("Escribe la prima mensual.");
        if (!String(f.commission).trim() || num(f.commission) <= 0) throw new Error("Escribe el % de comisión que te paga esta venta.");
        if (!String(f.advance).trim() || num(f.advance) < 0 || num(f.advance) > 100) throw new Error("Escribe el % de adelanto (de 0 a 100).");
        const saved = await BSData.saveItem(me.id, "sale", {
          ...(sale || {}), ...presets,
          client: f.client.trim(), phone: f.phone.trim(), date: f.date, status: f.status,
          carrier: f.carrier, product: f.product, monthly: num(f.monthly),
          commission: num(f.commission), advance: num(f.advance),
          campaignId: f.campaignId || null, notes: f.notes.trim(),
        });
        BS.closeModal();
        BS.toast(sale ? "Venta actualizada." : "¡Venta registrada! 🎉");
        if (onSaved) await onSaved(saved); else BS.render();
      }, "Guardando…");
      const del = dlg.querySelector("#saleDelete");
      if (del) del.onclick = async () => {
        if (!confirm(`¿Eliminar la venta de ${sale.client}?`)) return;
        await BSData.deleteItem(me.id, "sale", sale.id);
        // Si venía de un lead, el lead deja de tener venta.
        if (sale.leadId) {
          const lead = (await BSData.items(me.id, "lead")).find((l) => l.id === sale.leadId);
          if (lead) await BSData.saveItem(me.id, "lead", { ...lead, saleId: null });
        }
        BS.closeModal();
        BS.toast("Venta eliminada.");
        BS.render();
      };
    });
  }

  function prefsModal(prefs) {
    BS.openModal("Meta del mes", `
      <form id="prefsForm">
        <p class="hint">¿Cuánto AP quieres vender cada mes? Verás tu avance en la barra de la meta.</p>
        <label class="field"><span>Meta mensual de AP ($)</span><input class="input" name="goal" inputmode="decimal" value="${prefs.goal || ""}" placeholder="ej. 10000"></label>
        <div class="error"></div>
        <div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn" type="submit">Guardar</button></div>
      </form>`, (dlg) => {
      BS.bindForm(dlg.querySelector("form"), async (f) => {
        await savePrefs({ ...prefs, goal: num(f.goal) });
        BS.closeModal();
        BS.toast("Guardado.");
        BS.render();
      }, "Guardando…");
    });
  }

  // ---------- Pantalla ----------
  let month = monthKey(today());   // mes que se está viendo (YYYY-MM)
  const shiftMonth = (k, d) => { const [y, m] = k.split("-").map(Number); const t = new Date(y, m - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`; };
  const monthName = (k) => { const [y, m] = k.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };

  async function renderSales() {
    const { esc, ICON } = BS;
    const me = BS.me();
    const [sales, prefs, campaigns] = await Promise.all([BSData.items(me.id, "sale"), getPrefs(), BSData.items(me.id, "campaign")]);
    const inMonth = sales.filter((s) => monthKey(s.date) === month).sort((a, b) => b.date.localeCompare(a.date));
    const t = totals(inMonth);
    const year = totals(sales.filter((s) => String(s.date).startsWith(month.slice(0, 4))));
    const goalPct = prefs.goal ? Math.min(1, t.ap / prefs.goal) : 0;
    const campaignName = (id) => campaigns.find((c) => c.id === id)?.name;

    const byCarrier = {};
    inMonth.forEach((s) => { const c = calc(s); if (c.active) byCarrier[s.carrier || "Otro"] = (byCarrier[s.carrier || "Otro"] || 0) + c.ap; });
    const carrierRows = Object.entries(byCarrier).sort((a, b) => b[1] - a[1]);

    const F = window.BSFollow;
    const follow = F.pending(sales);
    const lateN = follow.filter((x) => x.late).length;

    const rows = inMonth.map((s) => {
      const c = calc(s);
      const nx = F.nextOf(s);
      return `<tr class="row-link ${c.active ? "" : "is-cancelled"}" data-sale="${s.id}">
        <td class="muted nowrap">${esc(s.date.slice(8, 10))}/${esc(s.date.slice(5, 7))}</td>
        <td><b>${esc(s.client)}</b><br><small class="muted">${esc(s.product)}${s.campaignId && campaignName(s.campaignId) ? ` · ${esc(campaignName(s.campaignId))}` : ""}</small></td>
        <td class="hide-sm">${esc(s.carrier)}</td>
        <td class="num hide-sm">${money(s.monthly)}</td>
        <td class="num"><b>${money(c.ap)}</b></td>
        <td class="num hide-md">${money(c.ip)}</td>
        <td class="num hide-md gold">${money(c.adv)}</td>
        <td><span class="tag sale-${s.status}">${statusLabel(s.status)}</span></td>
        <td class="hide-md muted nowrap">${nx ? `${nx.due < today() ? '<b class="neg">Atrasado</b>' : F.fmtDay(nx.due)}` : "—"}</td>
      </tr>`;
    }).join("");

    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head">
        <div><p class="eyebrow">Vender</p><h1>Mis ventas</h1></div>
        <div class="head-actions">
          <button class="btn btn-ghost btn-sm" id="prefsBtn">${ICON.target}<span>Meta del mes</span></button>
          <button class="btn btn-sm" id="newSale">${ICON.plus}<span>Registrar venta</span></button>
        </div>
      </div>

      ${follow.length ? `
      <section class="panel fu-panel ${lateN ? "has-late" : ""}">
        <div class="panel-head"><h3>Seguimiento de clientes</h3>
          <span>${lateN ? `<b class="neg">${lateN} atrasado${lateN === 1 ? "" : "s"}</b> · ` : ""}${follow.length} por hacer</span></div>
        <p class="hint fu-rule">Obligatorio: escríbele a cada cliente cada 3 meses y revisa su póliza cada año.</p>
        ${F.listHtml(follow, { limit: 10 })}
      </section>` : ""}

      <div class="month-nav">
        <button class="icon-btn" id="prevMonth" aria-label="Mes anterior">${ICON.back}</button>
        <b>${monthName(month)}</b>
        <button class="icon-btn flip" id="nextMonth" aria-label="Mes siguiente">${ICON.back}</button>
      </div>

      <div class="stats four">
        <div class="stat"><span>AP del mes</span><b>${money(t.ap)}</b></div>
        <div class="stat"><span>Comisión (IP)</span><b>${money(t.ip)}</b></div>
        <div class="stat"><span>Adelanto</span><b class="gold">${money(t.adv)}</b></div>
        <div class="stat"><span>Pólizas</span><b>${t.count}</b></div>
      </div>

      <div class="sales-grid">
        <section class="panel card-pad goal">
          <h3>Meta del mes</h3>
          ${prefs.goal ? `
            <div class="goal-num"><b>${money(t.ap)}</b><span>de ${money(prefs.goal)} en AP</span></div>
            <div class="bar"><i style="width:${goalPct * 100}%"></i></div>
            <p class="hint">${t.ap >= prefs.goal ? "¡Meta cumplida! 🔥 Vamos por más." : `Te faltan <b>${money(prefs.goal - t.ap)}</b> para llegar.`}</p>`
          : `<p class="hint">Ponte una meta mensual de AP para ver tu avance aquí.</p><button class="btn btn-ghost btn-sm" id="goalBtn">Poner meta</button>`}
          <div class="year-line"><span>Este año</span><b>${money(year.ap)}</b><small>AP · ${money(year.adv)} en adelantos</small></div>
        </section>
        <section class="panel card-pad">
          <h3>Por carrier</h3>
          ${carrierRows.length ? `<ul class="carrier-list">${carrierRows.map(([name, ap]) => `
            <li><span>${esc(name)}</span><div class="bar"><i style="width:${(ap / carrierRows[0][1]) * 100}%"></i></div><b>${money(ap)}</b></li>`).join("")}</ul>`
          : `<p class="hint">Aquí verás cuánto AP llevas con cada carrier.</p>`}
        </section>
      </div>

      <section class="panel">
        <div class="panel-head"><h3>Ventas de ${monthName(month)}</h3><span>${inMonth.length} ${inMonth.length === 1 ? "venta" : "ventas"}</span></div>
        ${rows ? `<div class="table-scroll"><table class="table">
          <thead><tr><th>Fecha</th><th>Cliente</th><th class="hide-sm">Carrier</th><th class="num hide-sm">Prima/mes</th><th class="num">AP</th><th class="num hide-md">Comisión</th><th class="num hide-md">Adelanto</th><th>Estatus</th><th class="hide-md">Próx. seguimiento</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
        : `<div class="empty"><p>No hay ventas registradas en ${monthName(month)}.</p></div>`}
      </section>`);
    BS.bindShell();

    F.bindList(follow);
    document.getElementById("newSale").onclick = () => saleModal(null);
    document.getElementById("prefsBtn").onclick = () => prefsModal(prefs);
    const goalBtn = document.getElementById("goalBtn");
    if (goalBtn) goalBtn.onclick = () => prefsModal(prefs);
    document.getElementById("prevMonth").onclick = () => { month = shiftMonth(month, -1); BS.render(); };
    document.getElementById("nextMonth").onclick = () => { month = shiftMonth(month, 1); BS.render(); };
    document.querySelectorAll("[data-sale]").forEach((tr) => (tr.onclick = () => saleModal(sales.find((s) => s.id === tr.dataset.sale))));
  }

  window.BSViews.sales = renderSales;
  window.BSSales = { CARRIERS, STATUSES, INACTIVE, money, pct, num, calc, totals, saleModal, statusLabel };
})();
