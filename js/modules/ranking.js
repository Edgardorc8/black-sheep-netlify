/*
 * Ranking de ventas — conectado a la Arena 3D oficial (Three.js Full HD) con los 3 personajes 3D
 * (TOP 1 Dorada, TOP 2 Morada, TOP 3 Cyber) sobre el podio y las tarjetas del resto del equipo.
 * Envía las ventas reales del portal a arena/index.html?portal=1&demo=1 mediante postMessage.
 */
(function () {
  let msgHandler = null;

  async function buildPayload() {
    const S = window.BSSales;
    const me = BS.me();
    const [users, myPrefs] = await Promise.all([
      BSData.listUsers(),
      BSData.items(me.id, "prefs").catch(() => []),
    ]);
    const activeUsers = users.filter((u) => u.approved && !u.disabled);

    // Recolecta las ventas activas de todos los agentes aprobados
    const salesByUser = await Promise.all(activeUsers.map(async (u) => {
      let list = [];
      try { list = await BSData.items(u.id, "sale"); } catch { list = []; }
      return { u, list };
    }));

    const ventas = [];
    for (const { u, list } of salesByUser) {
      for (const s of list) {
        const c = S.calc(s);
        if (!c.active || !(c.ap > 0)) continue;
        ventas.push({
          id: String(s.id),
          fecha: String(s.date || ""),
          creada: s.createdAt || Date.now(),
          agente: u.name,
          clave: u.username || u.id,
          ap: c.ap,
          producto: s.product || "IUL",
          carrier: s.carrier || "",
        });
      }
    }

    const goal = Number(myPrefs?.[0]?.goal) || 100000;
    return { tipo: "bs-ventas", ventas, meta: goal };
  }

  async function sendToArena(iframe) {
    if (!iframe?.contentWindow) return;
    try {
      const payload = await buildPayload();
      iframe.contentWindow.postMessage(payload, location.origin);
    } catch {
      iframe.contentWindow.postMessage({ tipo: "bs-error" }, location.origin);
    }
  }

  function renderRanking() {
    const { ICON } = BS;
    if (msgHandler) {
      window.removeEventListener("message", msgHandler);
      msgHandler = null;
    }

    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head rk-arena-head">
        <div>
          <p class="eyebrow">Podio 3D en vivo · Top 1, 2 y 3</p>
          <h1>Ranking</h1>
        </div>
        <div class="page-actions">
          <a class="btn btn-ghost btn-sm" href="arena/visor.html" target="_blank" rel="noopener">Ver los 3 personajes 3D</a>
          <button class="btn btn-sm" id="rkAddSale">${ICON.plus}<span>Registrar venta</span></button>
        </div>
      </div>
      <section class="panel rk-arena-wrap">
        <iframe
          id="rkArenaFrame"
          class="rk-arena-frame"
          src="arena/index.html?portal=1&demo=1"
          title="Arena 3D de ventas Black Sheep"
          allow="fullscreen"
        ></iframe>
      </section>
    `);

    BS.bindShell();
    const frame = document.getElementById("rkArenaFrame");

    msgHandler = (e) => {
      if (e.origin !== location.origin || e.source !== frame?.contentWindow) return;
      if (e.data?.tipo === "bs-arena-lista") {
        sendToArena(frame);
      }
    };
    window.addEventListener("message", msgHandler);

    const addBtn = document.getElementById("rkAddSale");
    if (addBtn) {
      addBtn.onclick = () => window.BSSales.saleModal(null, {
        onSaved: () => sendToArena(frame),
      });
    }
  }

  window.BSViews.ranking = renderRanking;
})();
