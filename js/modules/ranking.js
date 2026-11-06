/*
 * Ranking de ventas — limpio, sin nomenclaturas extrañas y con la misma paleta sobria del portal.
 * Destaca al #1 con el personaje animado en vivo (Canvas 2.5D a 60 fps: respiración, movimiento de brazos/cabeza,
 * destellos dorados en la corona y medalla, más soporte nativo para video .webm/.mp4 si se reemplaza en el futuro).
 */
(function () {
  const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const MASCOT_IMG = "assets/ranking/champion-sheep.png";

  let period = "month";   // "month" (mes actual) | "all" (acumulado total)
  let animStop = null;

  const initials = (n) => String(n || "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "BS";
  const currentMonthKey = () => new Date().toISOString().slice(0, 7);
  const currentMonthLabel = () => {
    const d = new Date();
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  function stopAnim() {
    if (animStop) { animStop(); animStop = null; }
  }

  // ---------- Animación en vivo en Canvas 2.5D (60 fps) ----------
  function mountMascotCanvas(canvas) {
    stopAnim();
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.src = MASCOT_IMG;

    let raf = 0;
    let running = true;
    const sparkles = Array.from({ length: 14 }, (_, i) => ({
      angle: (i / 14) * Math.PI * 2,
      radius: 115 + (i % 3) * 24,
      speed: 0.35 + (i % 4) * 0.12,
      size: 2.2 + (i % 3) * 1.3,
      phase: i * 0.9,
      yOffset: -15 + (i % 5) * 12,
    }));

    function drawSparkle(cx, cy, r, alpha) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = `rgba(235, 200, 132, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.lineTo(Math.cos(a) * r * 2.2, Math.sin(a) * r * 2.2);
        const a2 = a + Math.PI / 4;
        ctx.lineTo(Math.cos(a2) * r * 0.55, Math.sin(a2) * r * 0.55);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function frame(now) {
      if (!running || ! canvas.isConnected) return;
      const t = now * 0.001;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // 1. Halo dorado respirando detrás del campeón
      const glowPulse = 0.5 + 0.5 * Math.sin(t * 2.2);
      const grad = ctx.createRadialGradient(W * 0.5, H * 0.48, 18, W * 0.5, H * 0.48, W * 0.44);
      grad.addColorStop(0, `rgba(176, 141, 87, ${(0.22 + glowPulse * 0.1).toFixed(3)})`);
      grad.addColorStop(0.6, `rgba(176, 141, 87, ${(0.07 + glowPulse * 0.04).toFixed(3)})`);
      grad.addColorStop(1, "rgba(176, 141, 87, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.48, W * 0.44, 0, Math.PI * 2);
      ctx.fill();

      // 2. Sombra dinámica en el piso (se encoge cuando el muñeco salta/respira hacia arriba)
      const lift = Math.sin(t * 2.8);                  // -1..1 ciclo de celebración
      const sway = Math.sin(t * 1.4) * 0.032;          // balanceo lateral alegre en radianes
      const shadowScale = 1 - lift * 0.08;
      ctx.save();
      ctx.translate(W * 0.5, H * 0.91);
      ctx.scale(shadowScale, 0.22);
      const shGrad = ctx.createRadialGradient(0, 0, 6, 0, 0, 105);
      shGrad.addColorStop(0, "rgba(0, 0, 0, 0.55)");
      shGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = shGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 105, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (img.complete && img.naturalWidth) {
        // 3. Deformación orgánica por franjas horizontales (mesh strip warp):
        //    - Pies anclados abajo con squash & stretch suave
        //    - Torso respirando
        //    - Cabeza, orejas, brazos y corona balanceándose con fase desfasada (efecto follow-through real)
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const targetH = H * 0.81;
        const targetW = targetH * (iw / ih);
        const baseX = (W - targetW) * 0.5;
        const baseY = H * 0.08 - lift * 5.5;

        const strips = 42;
        const sh = ih / strips;
        const dh = targetH / strips;

        for (let i = 0; i < strips; i++) {
          const v = i / strips;                        // 0 = punta de la corona, 1 = pezuñas
          const upperWeight = Math.pow(1 - v, 1.35);   // más movimiento arriba (corona/brazos/cabeza), anclado en los pies
          const wave = Math.sin(t * 2.8 - v * 2.1);    // onda que sube por el cuerpo al celebrar
          const capeWave = (v > 0.45 && v < 0.82) ? Math.sin(t * 4.2 + v * 8) * 2.4 : 0;

          const dx = Math.sin(sway) * 14 * upperWeight + capeWave;
          const stretchY = 1 + Math.sin(t * 2.8) * 0.018 * (1 - v * 0.5);
          const breathW = 1 + Math.sin(t * 2.8 + v * 1.5) * 0.022 * Math.sin(v * Math.PI);

          const rowW = targetW * breathW;
          const x = baseX + (targetW - rowW) * 0.5 + dx;
          const y = baseY + i * dh * stretchY + wave * 1.8 * upperWeight;

          ctx.drawImage(
            img,
            0, i * sh, iw, sh + 1.2,
            x, y, rowW, dh * stretchY + 0.9
          );
        }

        // 4. Destellos de luz sobre las puntas de la corona y la medalla #1
        const crownGlint = Math.max(0, Math.sin(t * 2.1));
        if (crownGlint > 0.15) {
          const gx = baseX + targetW * 0.43 + Math.sin(sway) * 11;
          const gy = baseY + targetH * 0.035;
          drawSparkle(gx, gy, 5.5 * crownGlint, crownGlint * 0.9);
        }
        const medalGlint = Math.max(0, Math.sin(t * 2.1 - 1.4));
        if (medalGlint > 0.15) {
          const mx = baseX + targetW * 0.61 + Math.sin(sway) * 5;
          const my = baseY + targetH * 0.62;
          drawSparkle(mx, my, 4.8 * medalGlint, medalGlint * 0.85);
        }
      }

      // 5. Partículas doradas sutiles flotando alrededor
      for (const sp of sparkles) {
        const a = sp.angle + t * sp.speed;
        const px = W * 0.5 + Math.cos(a) * sp.radius;
        const py = H * 0.47 + Math.sin(a * 1.3) * 70 + sp.yOffset;
        const tw = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3.1 + sp.phase));
        drawSparkle(px, py, sp.size, tw * 0.65);
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    animStop = () => { running = false; cancelAnimationFrame(raf); };
  }

  // ---------- Cálculo del ranking a partir de las ventas reales ----------
  async function loadRankingData() {
    const S = window.BSSales;
    const users = (await BSData.listUsers()).filter((u) => u.approved && !u.disabled);
    const mKey = currentMonthKey();

    const rows = await Promise.all(users.map(async (u) => {
      let sales = [];
      try { sales = await BSData.items(u.id, "sale"); } catch { sales = []; }
      const filtered = period === "month"
        ? sales.filter((s) => String(s.date || "").slice(0, 7) === mKey)
        : sales;
      const t = S.totals(filtered);
      return {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        ap: t.ap,
        ip: t.ip,
        count: t.count,
      };
    }));

    // Ordenamos por Prima Anual (AP) de mayor a menor; en empate, por cantidad de pólizas y nombre
    rows.sort((a, b) => (b.ap - a.ap) || (b.count - a.count) || a.name.localeCompare(b.name));
    return rows.map((r, i) => ({ ...r, pos: i + 1 }));
  }

  async function renderRanking() {
    stopAnim();
    const { esc, ICON } = BS;
    const S = window.BSSales;
    const me = BS.me();
    const rows = await loadRankingData();

    const totalAp = rows.reduce((sum, r) => sum + r.ap, 0);
    const totalCount = rows.reduce((sum, r) => sum + r.count, 0);
    const leader = rows[0] || null;
    const maxAp = Math.max(leader?.ap || 0, 1);

    const leaderHero = leader ? `
      <section class="panel rk-hero">
        <div class="rk-mascot-stage">
          <canvas id="rkMascotCanvas" width="360" height="400" aria-label="Oveja campeona animada"></canvas>
        </div>
        <div class="rk-hero-info">
          <div class="rk-badge-top"><span>#1 · Primer lugar</span><small>${period === "month" ? esc(currentMonthLabel()) : "Histórico"}</small></div>
          <h2 class="rk-leader-name">${esc(leader.name)}${leader.id === me.id ? ' <small class="you">Tú</small>' : ""}</h2>
          <p class="rk-leader-sub">@${esc(leader.username)} · Líder en producción de la agencia</p>
          <div class="rk-leader-stats">
            <div>
              <span>Prima anual (AP)</span>
              <b class="gold">${S.money(leader.ap)}</b>
            </div>
            <div>
              <span>Pólizas activas</span>
              <b>${leader.count} ${leader.count === 1 ? "póliza" : "pólizas"}</b>
            </div>
            <div>
              <span>Comisión estimada</span>
              <b>${S.money(leader.ip)}</b>
            </div>
          </div>
        </div>
      </section>` : "";

    const podiumCards = rows.slice(0, 3).map((r) => `
      <article class="panel rk-pod-card rk-pos-${r.pos} ${r.id === me.id ? "is-me" : ""}">
        <div class="rk-pod-head">
          <span class="rk-medal">#${r.pos}</span>
          <span class="muted">${r.count} ${r.count === 1 ? "venta" : "ventas"}</span>
        </div>
        <div class="rk-pod-who">
          <span class="avatar">${esc(initials(r.name))}</span>
          <div>
            <b>${esc(r.name)}${r.id === me.id ? ' <small class="you">Tú</small>' : ""}</b>
            <small class="muted">@${esc(r.username)}</small>
          </div>
        </div>
        <div class="rk-pod-ap">
          <span>Prima anual (AP)</span>
          <b class="${r.pos === 1 ? "gold" : ""}">${S.money(r.ap)}</b>
        </div>
      </article>`).join("");

    const tableRows = rows.map((r) => {
      const barPct = r.ap > 0 ? Math.max(4, Math.round((r.ap / maxAp) * 100)) : 0;
      return `
        <tr class="${r.id === me.id ? "rk-row-me" : ""}">
          <td class="rk-col-pos"><span class="rk-pos-pill pos-${r.pos <= 3 ? r.pos : "n"}">${r.pos}</span></td>
          <td>
            <div class="agent">
              <span class="avatar sm">${esc(initials(r.name))}</span>
              <span>
                <b>${esc(r.name)}</b>${r.id === me.id ? '<small class="you">Tú</small>' : ""}
                <br><small class="muted">@${esc(r.username)}</small>
              </span>
            </div>
          </td>
          <td class="hide-sm rk-col-bar">
            <div class="bar"><i style="width:${barPct}%"></i></div>
          </td>
          <td class="num">${r.count}</td>
          <td class="num"><b class="${r.pos === 1 && r.ap > 0 ? "gold" : ""}">${S.money(r.ap)}</b></td>
        </tr>`;
    }).join("");

    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head">
        <div>
          <p class="eyebrow">Producción del equipo · ${period === "month" ? esc(currentMonthLabel()) : "Acumulado total"}</p>
          <h1>Ranking</h1>
        </div>
        <div class="page-actions">
          <div class="seg" role="tablist">
            <button class="seg-btn" data-period="month" aria-selected="${period === "month"}">Este mes</button>
            <button class="seg-btn" data-period="all" aria-selected="${period === "all"}">Total</button>
          </div>
          <button class="btn btn-sm" id="rkAddSale">${ICON.plus}<span>Registrar venta</span></button>
        </div>
      </div>

      ${leaderHero}

      ${rows.length > 1 ? `<div class="rk-podium-grid">${podiumCards}</div>` : ""}

      <section class="panel" style="margin-top:18px">
        <div class="panel-head">
          <h3>Tabla general</h3>
          <span>${rows.length} ${rows.length === 1 ? "agente" : "agentes"} · ${totalCount} ${totalCount === 1 ? "venta" : "ventas"} · ${S.money(totalAp)} AP</span>
        </div>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th style="width:56px">#</th>
                <th>Agente</th>
                <th class="hide-sm">Avance</th>
                <th class="num">Pólizas</th>
                <th class="num">Prima anual (AP)</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </section>
    `);

    BS.bindShell();
    mountMascotCanvas(document.getElementById("rkMascotCanvas"));

    document.querySelectorAll("[data-period]").forEach((b) => {
      b.onclick = () => {
        period = b.dataset.period;
        renderRanking();
      };
    });
    const addBtn = document.getElementById("rkAddSale");
    if (addBtn) {
      addBtn.onclick = () => window.BSSales.saleModal(null, { onSaved: () => renderRanking() });
    }
  }

  window.BSViews.ranking = renderRanking;
})();
