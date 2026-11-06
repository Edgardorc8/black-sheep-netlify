/*
 * Seguimiento obligatorio de clientes.
 * Cada venta (que no esté cancelada) genera, desde la fecha de la venta:
 *   · un mensaje de seguimiento a los 3, 6 y 9 meses,
 *   · la revisión de la póliza al cumplir cada año (12, 24, 36… meses),
 * y así se repite cada año mientras la póliza siga activa.
 * No se guardan como citas aparte: se calculan con la fecha de la venta, y lo que el agente
 * ya hizo queda en la propia venta (sale.followups[fecha] = { doneAt, how, note }).
 * Solo cuentan los seguimientos que tocan desde que la venta se registró en el portal,
 * para que una venta vieja no aparezca con todos sus seguimientos "atrasados".
 */
(function () {
  const SOON_DAYS = 7;   // se muestran desde 7 días antes de la fecha
  const HOW = ["Mensaje enviado", "Llamé y hablamos", "Revisamos la póliza", "No respondió (lo intenté)"];
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = () => ymd(new Date());
  const digits = (p) => (p || "").replace(/\D/g, "");
  const waLink = (p) => { const d = digits(p); return `https://wa.me/${d.length === 10 ? "1" + d : d}`; };   // 10 dígitos = EE. UU.
  const fmtDay = (s) => new Date(`${s}T12:00`).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });

  // Suma meses respetando el fin de mes (31 ene + 3 meses = 30 abr).
  function addMonths(dateStr, n) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const t = new Date(y, m - 1 + n, 1);
    t.setDate(Math.min(d, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
    return ymd(t);
  }

  function kindOf(k) {
    const months = k * 3;
    return months % 12 === 0
      ? { kind: "review", label: `Revisión anual de la póliza · ${months / 12} ${months === 12 ? "año" : "años"}` }
      : { kind: "followup", label: `Seguimiento · ${months % 12} meses` };
  }

  // Seguimientos sin hacer de una venta, hasta `until` (incluido).
  function dueOf(sale, until) {
    if (window.BSSales.INACTIVE.includes(sale.status) || !/^\d{4}-\d{2}-\d{2}$/.test(sale.date || "")) return [];
    const from = sale.createdAt ? ymd(new Date(sale.createdAt)) : sale.date;
    const done = sale.followups || {};
    const out = [];
    for (let k = 1; k < 400; k++) {
      const due = addMonths(sale.date, k * 3);
      if (due > until) break;
      if (due < from || done[due]) continue;
      out.push({ sale, due, ...kindOf(k) });
    }
    return out;
  }

  // Todos los pendientes: atrasados + los que tocan en los próximos 7 días.
  function pending(sales) {
    const t = todayStr();
    const until = ymd(new Date(Date.now() + SOON_DAYS * 864e5));
    return sales.flatMap((s) => dueOf(s, until))
      .map((x) => ({ ...x, late: x.due < t, today: x.due === t }))
      .sort((a, b) => a.due.localeCompare(b.due));
  }
  const lateCount = (sales) => pending(sales).filter((x) => x.late).length;

  function nextOf(sale) {
    const [x] = dueOf(sale, "9999-12-31");
    return x || null;
  }

  function message(item) {
    const first = String(item.sale.client || "").trim().split(/\s+/)[0] || "";
    const agent = String(BS.me().name || "").trim().split(/\s+/)[0];
    const carrier = item.sale.carrier && item.sale.carrier !== "Otro" ? ` con ${item.sale.carrier}` : "";
    if (item.kind === "review") {
      const years = item.label.match(/(\d+) año/)?.[1] || "1";
      return `Hola ${first}, soy ${agent}. ¡Ya se cumple${years === "1" ? "" : "n"} ${years} ${years === "1" ? "año" : "años"} de tu póliza${carrier}! Me gustaría agendar 15 minutos para revisarla contigo y asegurarnos de que sigue protegiendo a tu familia como necesitas. ¿Qué día te queda bien?`;
    }
    return `Hola ${first}, soy ${agent}. Solo paso a saludarte y saber cómo estás. Recuerda que estoy pendiente de tu póliza${carrier}: si tienes alguna pregunta o hubo algún cambio en tu familia o tu trabajo, aquí estoy para ayudarte. ¡Un abrazo!`;
  }

  // ---------- Ventana para hacer el seguimiento ----------
  function followModal(item, onDone) {
    const { esc, ICON } = BS;
    const s = item.sale;
    BS.openModal(item.kind === "review" ? "Revisión anual de la póliza" : "Seguimiento al cliente", `
      <form id="fuForm">
        <div class="fu-head">
          <b>${esc(s.client)}</b>
          <small>${esc([s.carrier, s.product].filter(Boolean).join(" · "))} · vendida el ${fmtDay(s.date)}</small>
          <span class="tag ${item.late ? "fu-late" : "fu-soon"}">${esc(item.label)} · ${item.late ? "atrasado desde" : "toca el"} ${fmtDay(item.due)}</span>
        </div>
        <label class="field"><span>Mensaje sugerido (puedes cambiarlo)</span><textarea class="input" name="msg" rows="5">${esc(message(item))}</textarea></label>
        <div class="actions start">
          ${digits(s.phone) ? `<button class="btn btn-sm" type="button" id="fuWa">${ICON.chat}<span>Enviar por WhatsApp</span></button>
          <a class="btn btn-ghost btn-sm" href="tel:${esc(digits(s.phone))}">${ICON.phone}<span>Llamar</span></a>` : `<span class="hint">Esta venta no tiene teléfono: agrégalo en la venta para enviar por WhatsApp.</span>`}
          <button class="btn btn-ghost btn-sm" type="button" id="fuCopy">${ICON.copy}<span>Copiar</span></button>
        </div>
        <div class="form-grid" style="margin-top:18px">
          <label class="field"><span>¿Qué hiciste?</span><select class="input" name="how" required><option value="">Elige…</option>${HOW.map((h) => `<option>${esc(h)}</option>`).join("")}</select></label>
          <label class="field"><span>Nota (opcional)</span><input class="input" name="note" placeholder="ej. Todo bien, quiere agregar a su esposa"></label>
        </div>
        <div class="error"></div>
        <div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Después</button><button class="btn" type="submit">${ICON.check}<span>Marcar como hecho</span></button></div>
      </form>`, (dlg) => {
      const form = dlg.querySelector("form");
      const wa = dlg.querySelector("#fuWa");
      if (wa) wa.onclick = () => window.open(`${waLink(s.phone)}?text=${encodeURIComponent(form.msg.value)}`, "_blank", "noopener");
      dlg.querySelector("#fuCopy").onclick = async () => {
        try { await navigator.clipboard.writeText(form.msg.value); BS.toast("Mensaje copiado."); } catch { form.msg.select(); }
      };
      BS.bindForm(form, async (f) => {
        if (!f.how) throw new Error("Elige qué hiciste con este cliente.");
        const me = BS.me();
        const fresh = (await BSData.items(me.id, "sale")).find((x) => x.id === s.id) || s;
        await BSData.saveItem(me.id, "sale", {
          ...fresh,
          followups: { ...(fresh.followups || {}), [item.due]: { doneAt: new Date().toISOString(), how: f.how, note: String(f.note || "").trim(), kind: item.kind } },
        });
        BS.closeModal();
        BS.toast("Seguimiento registrado ✓");
        if (onDone) await onDone(); else await BS.render();
      }, "Guardando…");
    });
  }

  // ---------- Lista (Inicio y Mis ventas) ----------
  function listHtml(items, { limit = 6 } = {}) {
    const { esc, ICON } = BS;
    return `<ul class="fu-list">${items.slice(0, limit).map((x, i) => `
      <li class="${x.late ? "late" : ""}">
        <span class="fu-date">${x.late ? "Atrasado" : x.today ? "Hoy" : fmtDay(x.due).replace(/ de \d{4}$| \d{4}$/, "")}</span>
        <span class="fu-who"><b>${esc(x.sale.client)}</b><small>${esc(x.label)}${x.late ? ` · desde ${fmtDay(x.due)}` : ""}</small></span>
        <button class="btn btn-sm ${x.late ? "" : "btn-ghost"}" data-fu="${i}">${ICON.chat}<span>Hacer</span></button>
      </li>`).join("")}</ul>${items.length > limit ? `<p class="hint home-more">y ${items.length - limit} más…</p>` : ""}`;
  }
  function bindList(items, onDone) {
    document.querySelectorAll("[data-fu]").forEach((b) => (b.onclick = () => followModal(items[+b.dataset.fu], onDone)));
  }

  // Historial para la ficha de la venta.
  function historyHtml(sale) {
    const { esc } = BS;
    const done = Object.entries(sale.followups || {}).sort((a, b) => b[0].localeCompare(a[0]));
    const next = nextOf(sale);
    if (window.BSSales.INACTIVE.includes(sale.status)) return `<p class="hint">Póliza ${window.BSSales.statusLabel(sale.status).toLowerCase()}: ya no genera seguimientos.</p>`;
    return `
      <p class="hint">${next ? `Próximo: <b>${esc(next.label)}</b> el ${fmtDay(next.due)}.` : "Los seguimientos empiezan 3 meses después de la venta."}</p>
      ${done.length ? `<ul class="fu-history">${done.map(([due, d]) => `<li><span>${fmtDay(due)}</span><b>${esc(d.how)}</b>${d.note ? `<small>${esc(d.note)}</small>` : ""}</li>`).join("")}</ul>` : ""}`;
  }

  window.BSFollow = { pending, lateCount, nextOf, listHtml, bindList, followModal, historyHtml, fmtDay };
})();
