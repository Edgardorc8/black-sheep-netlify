/*
 * Administración → Roleplay: saldo de cada agente (recargas que paga por Zelle/Cash App/efectivo),
 * movimientos, escenarios (brief visible + persona secreta para la IA) y precios.
 * app.js lo usa como una pestaña más: html() arma la pantalla y bind() conecta los botones.
 */
(function () {
  const LEVEL_NAME = { easy: "Fácil", medium: "Medio", hard: "Difícil" };
  const money = (n) => "$" + (Number(n) || 0).toFixed(2);
  let cache = null;

  async function html() {
    const { esc, ICON } = BS;
    const [users, scenarios, settings] = await Promise.all([BSData.listUsers(), BSData.rpScenarios(), BSData.getSettings()]);
    const agents = users.filter((u) => u.approved);
    const balances = await Promise.all(agents.map(async (u) => {
      const ledger = await BSData.rpLedger(u.id);
      return { u, balance: ledger.reduce((s, x) => s + x.amount, 0), last: ledger.find((x) => x.amount > 0), spent: -ledger.filter((x) => x.amount < 0).reduce((s, x) => s + x.amount, 0) };
    }));
    cache = { users: agents, scenarios, settings, balances };
    return `
      <section class="panel">
        <div class="panel-head"><h3>Saldo de los agentes</h3><span>Recargas que te pagan por Zelle, Cash App o efectivo</span></div>
        <div class="table-scroll"><table class="table">
          <thead><tr><th>Agente</th><th class="num">Saldo</th><th class="num hide-sm">Gastado</th><th class="hide-md">Última recarga</th><th></th></tr></thead>
          <tbody>${balances.map(({ u, balance, last, spent }) => `<tr>
            <td><b>${esc(u.name)}</b><br><small class="muted">@${esc(u.username)}</small></td>
            <td class="num"><b class="${balance < 1 ? "neg" : "gold"}">${money(balance)}</b></td>
            <td class="num hide-sm">${money(spent)}</td>
            <td class="hide-md muted">${last ? `${money(last.amount)} · ${new Date(last.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}${last.note ? ` · ${esc(last.note)}` : ""}` : "—"}</td>
            <td><div class="actions">
              <button class="btn btn-ghost btn-sm" data-ledger="${u.id}">Movimientos</button>
              <button class="btn btn-sm" data-credit="${u.id}">${ICON.plus}<span>Agregar saldo</span></button>
            </div></td></tr>`).join("")}</tbody>
        </table></div>
      </section>

      <section class="panel" style="margin-top:20px">
        <div class="panel-head"><h3>Escenarios</h3>
          <button class="btn btn-sm" id="rpNewScen">${ICON.plus}<span>Nuevo escenario</span></button></div>
        <div class="table-scroll"><table class="table">
          <tbody>${scenarios.map((s) => `<tr>
            <td><b>${esc(s.title)}</b><br><small class="muted">${esc(s.brief).slice(0, 120)}</small></td>
            <td><span class="tag">${LEVEL_NAME[s.level]}</span>${s.active === false ? ' <span class="tag st-disabled">Oculto</span>' : ""}</td>
            <td><div class="actions"><button class="btn btn-ghost btn-sm" data-scen="${s.id}">Editar</button></div></td>
          </tr>`).join("") || `<tr><td class="empty">Sin escenarios.</td></tr>`}</tbody>
        </table></div>
      </section>

      <form class="panel card-pad" id="rpPrices" style="margin-top:20px">
        <h3>Precios del roleplay</h3>
        <label class="switch-row" style="border-top:0">
          <span><b>Cobrar las prácticas del saldo</b><small>Apagado: los agentes practican sin saldo y aquí solo se registra cuánto costó cada práctica.</small></span>
          <input type="checkbox" class="switch" name="rpBilling" ${settings.rpBilling ? "checked" : ""}>
        </label>
        <p class="hint">El costo de la IA se cobra exacto según lo que usó cada práctica. La voz se cobra por caracteres. Puedes sumar un margen.</p>
        <div class="quote-grid">
          <label class="field"><span>Voz: USD por 1,000 caracteres</span><input class="input" name="rpVoicePer1k" inputmode="decimal" value="${settings.rpVoicePer1k ?? 0.04}"></label>
          <label class="field"><span>Margen extra (%)</span><input class="input" name="rpMarginPct" inputmode="decimal" value="${settings.rpMarginPct ?? 0}"></label>
          <label class="field"><span>Saldo mínimo para llamar</span><input class="input" name="rpMinBalance" inputmode="decimal" value="${settings.rpMinBalance ?? 1}"></label>
        </div>
        <div class="error"></div>
        <div class="modal-foot"><button class="btn btn-sm" type="submit">Guardar precios</button></div>
      </form>`;
  }

  function creditModal(u) {
    BS.openModal(`Agregar saldo · ${BS.esc(u.name)}`, `
      <form id="creditForm">
        <p class="hint">Registra lo que te pagó. Para quitar saldo, escribe un número negativo (ej. -5).</p>
        <div class="form-grid">
          <label class="field"><span>Monto (USD)</span><input class="input" name="amount" inputmode="decimal" placeholder="ej. 20" required autofocus></label>
          <label class="field"><span>Nota</span><input class="input" name="note" placeholder="ej. Zelle 25 oct"></label>
        </div>
        <div class="error"></div>
        <div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Cancelar</button><button class="btn" type="submit">Agregar</button></div>
      </form>`, (dlg) => {
      BS.bindForm(dlg.querySelector("form"), async (f) => {
        await BSData.rpAddCredit(u.id, parseFloat(String(f.amount).replace(/[$,\s]/g, "")), f.note);
        BS.toast("Saldo actualizado.");
        await BS.render();
      }, "Guardando…");
    });
  }

  async function ledgerModal(u) {
    const list = await BSData.rpLedger(u.id);
    BS.openModal(`Movimientos · ${BS.esc(u.name)}`, list.length ? `
      <div class="table-scroll"><table class="table">${list.slice(0, 200).map((x) => `<tr>
        <td class="muted nowrap">${new Date(x.createdAt).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
        <td>${BS.esc(x.note || x.kind)}</td>
        <td class="num"><b class="${x.amount >= 0 ? "pos" : ""}">${x.amount >= 0 ? "+" : "−"}${money(Math.abs(x.amount))}</b></td></tr>`).join("")}</table></div>`
      : `<p class="hint">Sin movimientos todavía.</p>`);
  }

  function scenarioModal(s) {
    const { esc } = BS;
    BS.openModal(s ? "Editar escenario" : "Nuevo escenario", `
      <form id="scenForm">
        <div class="form-grid">
          <label class="field"><span>Título</span><input class="input" name="title" value="${esc(s?.title)}" required></label>
          <label class="field"><span>Nivel</span><select class="input" name="level">${Object.entries(LEVEL_NAME).map(([k, n]) => `<option value="${k}" ${k === (s?.level || "medium") ? "selected" : ""}>${n}${k === "hard" ? " (Fable 5.1)" : " (Opus 5.5)"}</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>Lo que ve el agente antes de llamar</span><textarea class="input" name="brief" rows="2">${esc(s?.brief)}</textarea></label>
        <label class="field"><span>Persona secreta (quién es el cliente, su situación y sus objeciones) — solo la ve la IA</span><textarea class="input" name="persona" rows="7">${esc(s?.persona)}</textarea></label>
        <div class="form-grid">
          <label class="field"><span>Lo primero que dice al contestar</span><input class="input" name="opening" value="${esc(s?.opening)}" placeholder="¿Bueno? ¿Quién habla?"></label>
          <label class="field"><span>Voz (ID de ElevenLabs, opcional)</span><input class="input" name="voice_id" value="${esc(s?.voice_id)}" placeholder="Vacío = voz por defecto"></label>
        </div>
        <label class="field"><span>Rúbrica de calificación (opcional; vacío = rúbrica estándar de 6 criterios)</span><textarea class="input" name="rubric" rows="4">${esc(s?.rubric)}</textarea></label>
        <label class="check-inline"><input type="checkbox" name="active" ${s?.active === false ? "" : "checked"}> Visible para los agentes</label>
        <div class="error"></div>
        <div class="modal-foot">
          ${s ? `<button class="btn btn-ghost btn-danger" type="button" id="scenDelete">Eliminar</button><span class="spacer"></span>` : ""}
          <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
          <button class="btn" type="submit">${s ? "Guardar" : "Crear escenario"}</button>
        </div>
      </form>`, (dlg) => {
      BS.bindForm(dlg.querySelector("form"), async (f) => {
        await BSData.rpSaveScenario({ ...(s || {}), ...f, active: !!f.active });
        BS.toast("Escenario guardado.");
        await BS.render();
      }, "Guardando…");
      const del = dlg.querySelector("#scenDelete");
      if (del) del.onclick = async () => {
        if (!confirm(`¿Eliminar "${s.title}"?`)) return;
        await BSData.rpDeleteScenario(s.id);
        await BS.render();
      };
    });
  }

  function bind() {
    document.querySelectorAll("[data-credit]").forEach((b) => (b.onclick = () => creditModal(cache.users.find((u) => u.id === b.dataset.credit))));
    document.querySelectorAll("[data-ledger]").forEach((b) => (b.onclick = () => ledgerModal(cache.users.find((u) => u.id === b.dataset.ledger))));
    document.querySelectorAll("[data-scen]").forEach((b) => (b.onclick = () => scenarioModal(cache.scenarios.find((s) => s.id === b.dataset.scen))));
    document.getElementById("rpNewScen").onclick = () => scenarioModal(null);
    BS.bindForm(document.getElementById("rpPrices"), async (f) => {
      const n = (v) => parseFloat(String(v).replace(/[$,%\s]/g, "")) || 0;
      await BSData.saveSettings({ rpBilling: !!f.rpBilling, rpVoicePer1k: n(f.rpVoicePer1k), rpMarginPct: n(f.rpMarginPct), rpMinBalance: n(f.rpMinBalance) });
      BS.toast("Precios guardados.");
    }, "Guardando…");
  }

  window.BSRoleplayAdmin = { html, bind };
})();
