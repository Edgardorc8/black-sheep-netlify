/*
 * Roleplay IA por voz.
 * El agente habla por el micrófono → el navegador lo convierte en texto (reconocimiento de voz de
 * Chrome/Edge) → la función "roleplay" del servidor responde como el cliente (Claude) y le pone voz
 * humana (ElevenLabs) → se escucha y se vuelve a escuchar al agente. Al colgar, la IA califica la
 * llamada. La llamada se graba en el navegador y se puede descargar en MP3.
 * Niveles: Fácil y Medio = Claude Opus 5.5 · Difícil = Claude Fable 5.1.
 */
(function () {
  const LAMEJS = "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js";
  const LEVELS = [
    ["easy", "Fácil", "Cliente abierto, una objeción suave", "~$0.10"],
    ["medium", "Medio", "2 o 3 objeciones reales", "~$0.20"],
    ["hard", "Difícil", "Desconfiado, objeciones fuertes · Claude Fable 5.1", "~$0.75"],
  ];
  const LEVEL_NAME = Object.fromEntries(LEVELS.map(([k, n]) => [k, n]));
  const SILENCE_MS = 1300;   // pausa del agente que se toma como "terminé de hablar"
  const money = (n) => "$" + (Number(n) || 0).toFixed(2);
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  let level = "medium";
  let call = null;      // llamada en curso
  let result = null;    // última calificación mostrada

  // ---------- Guardar archivos (ventana "Guardar como" si existe) ----------
  async function saveBlob(blob, name, type, ext) {
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: type, accept: { [blob.type]: [ext] } }] });
        const w = await h.createWritable(); await w.write(blob); await w.close();
        return BS.toast(`Guardado como "${h.name}".`);
      } catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  const loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar el convertidor de audio."));
    document.head.appendChild(s);
  });

  // Convierte la grabación (webm) en MP3.
  async function toMp3(webmBlob) {
    await loadScript(LAMEJS);
    const ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(await webmBlob.arrayBuffer());
    ctx.close();
    const data = audio.getChannelData(0);
    const pcm = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) pcm[i] = Math.max(-1, Math.min(1, data[i])) * 0x7fff;
    const enc = new window.lamejs.Mp3Encoder(1, audio.sampleRate, 96);
    const parts = [];
    for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(b); }
    const end = enc.flush(); if (end.length) parts.push(end);
    return new Blob(parts, { type: "audio/mpeg" });
  }

  // ---------- Llamada ----------
  async function startCall(scenario) {
    if (!Recognition) return BS.toast("Usa Google Chrome o Microsoft Edge para el roleplay por voz.");
    let mic;
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { return BS.toast("Necesito permiso para usar tu micrófono."); }

    const ctx = new AudioContext();
    const mixDest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(mic).connect(mixDest);   // la voz del agente va a la grabación (no a las bocinas)
    const recorder = new MediaRecorder(mixDest.stream);
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.start(1000);

    call = { scenario, mic, ctx, mixDest, recorder, chunks, transcript: [], status: "connecting", started: Date.now(), cost: 0, interim: "", muted: false, audio: null, ended: false };
    renderCall();
    call.timer = setInterval(() => { const t = document.getElementById("rpTimer"); if (t) t.textContent = fmtTime((Date.now() - call.started) / 1000); }, 500);

    try {
      const r = await BSData.rpStart(BS.me().id, scenario.id);
      call.sessionId = r.sessionId;
      call.demo = !!r.demo;
      await clientSays(r.opening, false);
    } catch (e) { BS.toast(e.message); endCall(true); }
  }

  function setStatus(s) {
    if (!call) return;
    call.status = s;
    const el = document.getElementById("rpStatus");
    const labels = { connecting: "Llamando…", listening: call.muted ? "Micrófono apagado" : "Te escucha… habla cuando quieras", thinking: "El cliente está pensando…", speaking: "El cliente está hablando…", grading: "Calificando tu llamada…" };
    if (el) { el.textContent = labels[s] || ""; el.dataset.state = s; }
    document.getElementById("rpAvatar")?.setAttribute("data-state", s);
    const intr = document.getElementById("rpInterrupt"); if (intr) intr.disabled = s !== "speaking";
  }

  function addLine(role, text) {
    call.transcript.push({ role, text });
    const box = document.getElementById("rpTranscript");
    if (!box) return;
    box.insertAdjacentHTML("beforeend", `<div class="rp-line ${role}"><b>${role === "agent" ? "Tú" : "Cliente"}</b><span>${BS.esc(text)}</span></div>`);
    box.scrollTop = box.scrollHeight;
  }

  // El cliente habla: voz humana (servidor) o voz del navegador (modo de prueba).
  async function clientSays(text, hangupAfter) {
    if (!call || call.ended) return;
    addLine("client", text);
    stopListening();
    setStatus("speaking");
    const done = () => { if (!call || call.ended) return; call.audio = null; hangupAfter ? endCall(false) : listen(); };
    let blob = null;
    try { blob = await BSData.rpTts(call.sessionId, text); } catch (e) { BS.toast(e.message); }
    if (!call || call.ended) return;
    if (blob) {
      const audio = new Audio(URL.createObjectURL(blob));
      const src = call.ctx.createMediaElementSource(audio);
      src.connect(call.ctx.destination);
      src.connect(call.mixDest);              // la voz del cliente también va a la grabación
      call.audio = audio;
      audio.onended = done;
      audio.play().catch(done);
    } else if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-MX";
      const v = speechSynthesis.getVoices().find((x) => /^es(-|_)(MX|US)/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^es/i.test(x.lang));
      if (v) u.voice = v;
      u.onend = done; u.onerror = done;
      call.audio = { pause: () => speechSynthesis.cancel() };
      speechSynthesis.speak(u);
    } else done();
  }

  function interrupt() {
    if (!call?.audio) return;
    call.audio.pause();
    call.audio = null;
    listen();
  }

  // Escucha al agente; tras una pausa, envía lo que dijo.
  function listen() {
    if (!call || call.ended) return;
    setStatus("listening");
    if (call.muted) return;
    const rec = new Recognition();
    rec.lang = "es-US";
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = "", silence;
    const flush = () => {
      const t = (finalText + " " + call.interim).trim();
      if (!t) return;
      call.interim = "";
      stopListening();
      agentSays(t);
    };
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += " " + e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      call.interim = interim;
      const live = document.getElementById("rpLive");
      if (live) live.textContent = (finalText + " " + interim).trim();
      clearTimeout(silence);
      silence = setTimeout(flush, SILENCE_MS);
    };
    rec.onerror = (e) => { if (e.error === "not-allowed") { BS.toast("El navegador bloqueó el micrófono."); } };
    rec.onend = () => { if (call && call.rec === rec && call.status === "listening") { try { rec.start(); } catch {} } };   // Chrome corta tras silencios largos
    call.rec = rec;
    try { rec.start(); } catch {}
  }
  function stopListening() {
    if (!call?.rec) return;
    const r = call.rec; call.rec = null;
    try { r.abort(); } catch {}
    const live = document.getElementById("rpLive"); if (live) live.textContent = "";
  }

  async function agentSays(text) {
    if (!call || call.ended) return;
    addLine("agent", text);
    setStatus("thinking");
    try {
      const r = await BSData.rpTurn(call.sessionId, text);
      call.cost += Number(r.cost) || 0;
      await clientSays(r.reply, r.hangup);
    } catch (e) {
      BS.toast(e.message);
      if (e.hangup) endCall(false); else listen();
    }
  }

  async function endCall(cancelled) {
    if (!call || call.ended) return;
    const c = call;
    c.ended = true;
    clearInterval(c.timer);
    stopListening();
    c.audio?.pause?.();
    try { speechSynthesis.cancel(); } catch {}
    const seconds = Math.round((Date.now() - c.started) / 1000);
    await new Promise((res) => { c.recorder.onstop = res; try { c.recorder.stop(); } catch { res(); } });
    c.mic.getTracks().forEach((t) => t.stop());
    c.ctx.close();
    const recording = new Blob(c.chunks, { type: c.recorder.mimeType || "audio/webm" });
    if (cancelled || !c.sessionId || c.transcript.filter((m) => m.role === "agent").length === 0) {
      call = null;
      BS.toast("La llamada terminó sin conversación, no se calificó.");
      return BS.render();
    }
    setStatus("grading");
    try {
      const g = await BSData.rpGrade(c.sessionId, seconds);
      result = { grade: g.grade, cost: Number(g.cost) || c.cost, seconds, transcript: c.transcript, recording, title: c.scenario.title, level: c.scenario.level, date: new Date() };
    } catch (e) {
      BS.toast(e.message);
      result = { grade: null, cost: c.cost, seconds, transcript: c.transcript, recording, title: c.scenario.title, level: c.scenario.level, date: new Date() };
    }
    call = null;
    BS.render();
  }

  // ---------- Pantallas ----------
  function renderCall() {
    const { esc, ICON } = BS;
    const sc = call.scenario;
    const name = (sc.title.match(/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/) || ["Cliente"])[0];
    document.getElementById("app").innerHTML = BS.shell(`
      <section class="panel rp-call">
        <div class="rp-call-head">
          <span class="tag">${LEVEL_NAME[sc.level]}</span>
          <span class="rp-timer" id="rpTimer">0:00</span>
        </div>
        <div class="rp-avatar" id="rpAvatar" data-state="connecting"><span>${esc(name[0])}</span></div>
        <h2>${esc(name)}</h2>
        <p class="muted">${esc(sc.title)}</p>
        <p class="rp-status" id="rpStatus" data-state="connecting">Llamando…</p>
        <p class="rp-live" id="rpLive"></p>
        <div class="rp-controls">
          <button class="rp-btn" id="rpMute" aria-label="Silenciar micrófono">${ICON.mic}<span>Micrófono</span></button>
          <button class="rp-btn" id="rpInterrupt" disabled aria-label="Interrumpir al cliente">${ICON.hand}<span>Interrumpir</span></button>
          <button class="rp-btn hang" id="rpHang" aria-label="Colgar">${ICON.phoneOff}<span>Colgar</span></button>
        </div>
        <form class="rp-type" id="rpType" autocomplete="off">
          <input class="input" name="t" placeholder="¿Problemas con el micrófono? Escribe aquí y presiona Enter">
        </form>
        <div class="rp-transcript" id="rpTranscript"></div>
      </section>`);
    BS.bindShell();
    // Si el agente navega a otra sección, la llamada se corta.
    document.querySelectorAll(".nav-item[data-view], [data-go]").forEach((b) => b.addEventListener("click", () => endCall(true), { capture: true }));
    document.getElementById("rpHang").onclick = () => endCall(false);
    document.getElementById("rpInterrupt").onclick = interrupt;
    document.getElementById("rpMute").onclick = (e) => {
      call.muted = !call.muted;
      call.mic.getAudioTracks().forEach((t) => (t.enabled = !call.muted));
      e.currentTarget.classList.toggle("off", call.muted);
      if (call.status === "listening") { stopListening(); listen(); }
    };
    document.getElementById("rpType").onsubmit = (e) => {
      e.preventDefault();
      const v = e.target.t.value.trim();
      if (!v || call.status === "thinking" || call.status === "speaking") return;
      e.target.t.value = "";
      stopListening();
      agentSays(v);
    };
  }

  function gradeHtml(r) {
    const { esc } = BS, g = r.grade;
    if (!g) return `<div class="empty"><p>No se pudo calificar esta llamada, pero puedes descargar el audio y la conversación.</p></div>`;
    const color = g.puntaje >= 80 ? "pos" : g.puntaje >= 60 ? "gold" : "neg";
    return `
      <div class="rp-score">
        <div class="rp-score-num ${color}"><b>${g.puntaje}</b><span>/100</span></div>
        <div><span class="tag ${g.resultado === "Venta" || g.resultado === "Cita agendada" ? "st-active" : "st-pending"}">${esc(g.resultado)}</span>
          <p>${esc(g.resumen)}</p></div>
      </div>
      <div class="rp-criteria">${(g.criterios || []).map((c) => `
        <div><span>${esc(c.nombre)}</span><div class="bar"><i style="width:${(c.puntos / 10) * 100}%"></i></div><b>${c.puntos}/10</b><small>${esc(c.comentario)}</small></div>`).join("")}</div>
      <div class="rp-lists">
        <div><h4>Lo que hiciste bien</h4><ul>${(g.fortalezas || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h4>Para mejorar</h4><ul>${(g.mejorar || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      </div>
      ${g.frase_para_practicar ? `<div class="rp-phrase"><span>Practica esta frase</span><p>“${esc(g.frase_para_practicar)}”</p></div>` : ""}`;
  }

  function transcriptText(r) {
    const head = `ROLEPLAY · ${r.title} · Nivel ${LEVEL_NAME[r.level]}\n${r.date.toLocaleString("es-MX")} · Duración ${fmtTime(r.seconds)}\n`;
    const lines = r.transcript.map((m) => `${m.role === "agent" ? "AGENTE" : "CLIENTE"}: ${m.text}`).join("\n");
    const g = r.grade ? `\n\nCALIFICACIÓN: ${r.grade.puntaje}/100 · ${r.grade.resultado}\n${r.grade.resumen}\n\nBien:\n- ${r.grade.fortalezas.join("\n- ")}\n\nMejorar:\n- ${r.grade.mejorar.join("\n- ")}` : "";
    return head + "\n" + lines + g;
  }

  function renderResult() {
    const { ICON } = BS, r = result;
    const stamp = r.date.toISOString().slice(0, 10);
    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head"><div><p class="eyebrow">Roleplay · ${LEVEL_NAME[r.level]} · ${fmtTime(r.seconds)}</p><h1>${BS.esc(r.title)}</h1></div>
        <div class="head-actions">
          <button class="btn btn-ghost btn-sm" id="rpTxt">${ICON.download}<span>Conversación .txt</span></button>
          <button class="btn btn-sm" id="rpMp3">${ICON.download}<span>Audio MP3</span></button>
        </div>
      </div>
      <section class="panel card-pad rp-result">${gradeHtml(r)}</section>
      <div class="rp-foot"><span class="muted">Costo de esta práctica: <b>${money(r.cost)}</b></span>
        <button class="btn btn-ghost btn-sm" id="rpBack">Volver al roleplay</button></div>`);
    BS.bindShell();
    document.getElementById("rpBack").onclick = () => { result = null; BS.render(); };
    document.getElementById("rpTxt").onclick = () => saveBlob(new Blob(["﻿" + transcriptText(r).replace(/\n/g, "\r\n")], { type: "text/plain" }), `Roleplay - ${r.title} - ${stamp}.txt`, "Texto", ".txt");
    document.getElementById("rpMp3").onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { r.mp3 ||= await toMp3(r.recording); await saveBlob(r.mp3, `Roleplay - ${r.title} - ${stamp}.mp3`, "Audio MP3", ".mp3"); }
      catch (err) { BS.toast(err.message || "No se pudo crear el MP3."); }
      finally { b.disabled = false; }
    };
  }

  async function renderLobby() {
    const { esc, ICON } = BS;
    const me = BS.me();
    const [catalog, bal, sessions] = await Promise.all([BSData.rpCatalog(), BSData.rpBalance(me.id), BSData.rpSessions(me.id)]);
    const month = new Date().toISOString().slice(0, 7);
    const monthSessions = sessions.filter((s) => new Date(s.createdAt).toISOString().slice(0, 7) === month);
    const graded = sessions.filter((s) => s.grade?.puntaje != null);
    const avg = graded.length ? Math.round(graded.reduce((t, s) => t + s.grade.puntaje, 0) / graded.length) : null;
    const scenarios = catalog.filter((s) => s.level === level);
    const demo = BSData.mode !== "supabase";
    const localAi = demo && BSData.rpLocalAi ? await BSData.rpLocalAi() : false;

    document.getElementById("app").innerHTML = BS.shell(`
      <div class="page-head"><div><p class="eyebrow">Aprender</p><h1>Roleplay IA</h1></div></div>
      <p class="il-intro">Practica una llamada real <b>hablando</b> con un cliente virtual. Al colgar recibes tu calificación y puedes descargar el audio.</p>
      ${demo ? (localAi
        ? `<div class="il-warn rp-ai-on">● IA real conectada (servidor local en tu computadora). Las prácticas no descuentan saldo; el costo real aparece al terminar.</div>`
        : `<div class="il-warn soft">Modo de prueba: el cliente responde con frases de ejemplo y la voz del navegador. Para conversar con la IA real, enciende el servidor local del roleplay.</div>`) : ""}
      ${!Recognition ? `<div class="il-warn">Tu navegador no reconoce voz. Usa <b>Google Chrome</b> o <b>Microsoft Edge</b>.</div>` : ""}
      <div class="stats four">
        <div class="stat"><span>Tu saldo</span><b class="${bal < 1 && !demo ? "neg" : "gold"}">${money(bal)}</b></div>
        <div class="stat"><span>Prácticas este mes</span><b>${monthSessions.length}</b></div>
        <div class="stat"><span>Promedio</span><b>${avg ?? "—"}${avg != null ? "<small>/100</small>" : ""}</b></div>
        <div class="stat"><span>Recarga</span><b class="rp-recharge">Pídesela a tu manager</b></div>
      </div>
      <div class="seg" role="tablist">${LEVELS.map(([k, n]) => `<button class="seg-btn" data-level="${k}" aria-selected="${k === level}">${n}</button>`).join("")}</div>
      <p class="hint rp-level-hint">${LEVELS.find(([k]) => k === level)[2]} · aprox. ${LEVELS.find(([k]) => k === level)[3]} por práctica</p>
      ${scenarios.length ? `<div class="mc-grid">${scenarios.map((s) => `
        <article class="panel rp-scen">
          <span class="tag">${LEVEL_NAME[s.level]}</span>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.brief)}</p>
          <button class="btn btn-sm" data-call="${s.id}">${ICON.phone}<span>Llamar</span></button>
        </article>`).join("")}</div>`
      : `<section class="panel empty"><p>No hay escenarios en este nivel todavía.</p></section>`}
      <p class="hint rp-tips">${ICON.headphones} Usa audífonos para que el micrófono no capte la voz del cliente. Habla con naturalidad; cuando haces una pausa, el cliente responde.</p>
      <p class="hint">Al llamar, tu micrófono se activa: tu voz se convierte a texto y se envía a la IA para responderte y calificarte. Se guardan la transcripción y la calificación. <a href="legal.html#grabaciones" target="_blank">Aviso sobre grabaciones</a></p>
      ${sessions.length ? `
      <section class="panel" style="margin-top:20px">
        <div class="panel-head"><h3>Tus prácticas</h3><span>${sessions.length}</span></div>
        <div class="table-scroll"><table class="table">
          <thead><tr><th>Fecha</th><th>Escenario</th><th class="hide-sm">Nivel</th><th class="num">Puntaje</th><th class="hide-sm">Resultado</th><th class="num hide-sm">Costo</th></tr></thead>
          <tbody>${sessions.map((s) => `<tr class="row-link" data-hist="${s.id}">
            <td class="nowrap muted">${new Date(s.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
            <td><b>${esc(s.title)}</b></td><td class="hide-sm">${LEVEL_NAME[s.level] || ""}</td>
            <td class="num"><b>${s.grade?.puntaje ?? "—"}</b></td><td class="hide-sm">${esc(s.grade?.resultado || "")}</td>
            <td class="num hide-sm">${money(s.cost)}</td></tr>`).join("")}</tbody>
        </table></div>
      </section>` : ""}`);
    BS.bindShell();
    document.querySelectorAll("[data-level]").forEach((b) => (b.onclick = () => { level = b.dataset.level; BS.render(); }));
    document.querySelectorAll("[data-call]").forEach((b) => (b.onclick = () => startCall(scenarios.find((s) => s.id === b.dataset.call))));
    document.querySelectorAll("[data-hist]").forEach((tr) => (tr.onclick = () => {
      const s = sessions.find((x) => x.id === tr.dataset.hist);
      BS.openModal(BS.esc(s.title), `<div class="rp-result">${gradeHtml({ grade: s.grade })}</div>`);
    }));
  }

  function renderRoleplay() {
    if (call) return renderCall();
    if (result) return renderResult();
    return renderLobby();
  }

  window.BSViews.roleplay = renderRoleplay;
})();
