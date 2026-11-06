/*
 * Lector de ilustraciones IUL (Americo y Mutual of Omaha).
 * Recibe el texto de cada página con su posición (como lo entrega pdf.js) y devuelve los
 * números que necesita la presentación: cliente, prima, death benefit, riders, tasas y
 * Non-Guaranteed Illustrated Surrender Value por edad.
 *
 * Entrada: pages = [[{ s, x, y }, ...], ...]   (y crece hacia arriba, como en PDF)
 * No inventa nada: si un dato no aparece, lo deja vacío para que el agente lo llene.
 */
(function (root) {
  const num = (s) => { const n = parseFloat(String(s).replace(/[$,%\s]/g, "")); return Number.isFinite(n) ? n : null; };
  const isInt = (s) => /^\d{1,3}$/.test(String(s).trim());
  const isMoney = (s) => /^\$?\(?[\d,]+(\.\d+)?\)?$/.test(String(s).trim());

  // Agrupa las piezas de texto en renglones (tolerancia de pocos puntos en y).
  function lines(items, tol = 3.5) {
    const sorted = items.filter((i) => i.s && i.s.trim()).map((i) => ({ ...i, s: i.s.trim() })).sort((a, b) => b.y - a.y);
    const out = [];
    for (const it of sorted) {
      const last = out[out.length - 1];
      if (last && last.y - it.y <= tol) { last.items.push(it); last.minY = Math.min(last.minY, it.y); }
      else out.push({ y: it.y, minY: it.y, items: [it] });
    }
    out.forEach((l) => { l.items.sort((a, b) => a.x - b.x); l.text = l.items.map((i) => i.s).join(" "); });
    return out;
  }
  const pageText = (ls) => ls.map((l) => l.text).join("\n");
  const findLine = (ls, re) => ls.find((l) => re.test(l.text));
  const after = (ls, re, k = 1) => { const i = ls.findIndex((l) => re.test(l.text)); return i >= 0 && ls[i + k] ? ls[i + k].text : ""; };
  const firstMatch = (text, re) => { const m = text.match(re); return m ? m[1].trim() : ""; };
  // Riders listados en la página de detalles (columna de valores, a la derecha de las etiquetas).
  const ridersOf = (ls) => ls.flatMap((l) => l.items)
    .filter((i) => i.x > 200 && i.s.length < 90 && /(Illness|Rider|Lapse Guard)/i.test(i.s))
    .map((i) => i.s);
  // Texto que va después de "Etiqueta:" en la misma pieza o en la pieza siguiente del renglón.
  function labelValue(P, re) {
    for (const ls of P) for (const l of ls) {
      const k = l.items.findIndex((i) => re.test(i.s));
      if (k < 0) continue;
      const own = l.items[k].s.replace(/^.*?:\s*/, "").trim();
      if (own && !re.test(own)) return own;
      if (l.items[k + 1]) return l.items[k + 1].s.trim();
    }
    return "";
  }

  // Ledger: Surrender Value del bloque de la tasa ilustrada (el de más a la derecha).
  function ledgerSurrender(pagesLines, isLedgerPage) {
    const byAge = {};
    for (const ls of pagesLines) {
      if (!isLedgerPage(pageText(ls))) continue;
      const headers = ls.flatMap((l) => l.items.filter((i) => /^Surrender( Value)?$/.test(i.s)));
      if (!headers.length) continue;
      const svX = Math.max(...headers.map((h) => h.x));
      const headerY = Math.min(...headers.map((h) => h.y));
      // Renglones del ledger: se agrupan con más tolerancia porque las columnas no comparten la misma y exacta.
      const rows = lines(ls.flatMap((l) => l.items).filter((i) => i.y < headerY - 2), 4.5);
      for (const r of rows) {
        const nums = r.items.filter((i) => isMoney(i.s));
        if (nums.length < 4 || !isInt(nums[0].s) || !isInt(nums[1].s)) continue;
        const year = +nums[0].s, age = +nums[1].s;
        if (year < 1 || year > 121 || age < year) continue;
        const cand = nums.slice(2).filter((i) => Math.abs(i.x - svX) <= 40).sort((a, b) => Math.abs(a.x - svX) - Math.abs(b.x - svX))[0];
        if (cand && byAge[age] === undefined) byAge[age] = num(cand.s);
      }
    }
    return byAge;
  }

  // Edades para las barras: 69/74/79/84, o +5 años desde la edad actual si ya pasó de 64.
  function pickAges(issueAge, byAge) {
    const start = Math.max(69, (issueAge || 0) + 5);
    const ages = [0, 5, 10, 15].map((d) => start + d);
    return ages.map((a) => ({ age: a, value: byAge[a] ?? null }));
  }

  // ---------------- Americo ----------------
  function parseAmerico(P) {
    const all = P.map(pageText).join("\n");
    const p1 = P[0], p2 = P[1] || [];
    // "Prepared For: Emma Paredes" (a veces sin nombre) y abajo "Male Age 33, Non-Nicotine".
    const pf = p2.findIndex((l) => /^Prepared For:/i.test(l.text));
    const client = pf >= 0 ? p2[pf].text.replace(/^Prepared For:\s*/i, "").trim() : "";
    const prepared = (pf >= 0 && p2[pf + 1] ? p2[pf + 1].text : firstMatch(all, /((?:Male|Female)[^\n]*Age[^\n]*)/i))
      .replace(/^(Male|Female)\s+Age/i, "$1, Age");
    const issueAge = num(firstMatch(prepared, /Age\s+(\d+)/i));
    const db = num(firstMatch(all, /Initial Death Benefit:\s*\$?([\d,]+(?:\.\d+)?)/i));
    const premM = all.match(/Planned (Monthly|Annual|Quarterly|Semi-?Annual) Premium:\s*\$?([\d,]+\.\d{2})/i);
    const riders = ridersOf(p2);
    const rateLine = P.flatMap((ls) => ls).find((l) => /Illustrated Interest Rate/.test(l.text) && !/Midpoint|Alternate/.test(l.text));
    let rate = "";
    if (rateLine) {
      const lbl = rateLine.items.find((i) => /Illustrated Interest Rate/.test(i.s));
      for (const ls of P) {
        const i = ls.indexOf(rateLine);
        if (i < 0) continue;
        for (let k = i + 1; k < Math.min(ls.length, i + 4) && !rate; k++) {
          const pct = ls[k].items.find((it) => /^\d+(\.\d+)?%$/.test(it.s) && Math.abs(it.x - lbl.x) < 80);
          if (pct) rate = pct.s;
        }
      }
    }
    const maxRate = firstMatch(all, /Current Maximum[\s\S]{0,140}?(\d+\.\d+%)/i);
    const byAge = ledgerSurrender(P, (t) => /Illustrated Values/.test(t) && /Illustrated Interest Rate/.test(t));
    const product = after(p1, /A Life Insurance Policy Illustration/) || firstMatch(all, /^\s*(Instant Decision IUL|[^\n]*IUL)\s*$/m);
    return {
      carrier: "americo",
      client,
      insured: prepared.replace(/,?\s*$/, ""),
      issueAge,
      product: product.trim(),
      premium: premM ? num(premM[2]) : null,
      mode: premM ? cap(premM[1]) : "Monthly",
      deathBenefit: db,
      riders: livingFromRiders(riders, db, null),
      rate, maxRate,
      agent: after(p1, /^Prepared by:/i),
      agentExtra: "",
      date: after(p1, /^Prepared on:/i) || firstMatch(all, /(\d{2}\/\d{2}\/\d{4})/),
      state: firstMatch(all, /Issue State:\s*([A-Z]{2})/),
      policyForm: labelValue(P, /Policy Form:/),
      formCode: firstMatch(all, /(\d+ILLUS)/),
      byAge,
      cash: pickAges(issueAge, byAge),
    };
  }

  // ---------------- Mutual of Omaha ----------------
  function parseOmaha(P) {
    const all = P.map(pageText).join("\n");
    const p1 = P[0], p2 = P[1] || [];
    const valueOf = (ls, re) => { const l = findLine(ls, re); return l ? l.items.slice(1).map((i) => i.s).join(" ").trim() : ""; };
    const client = valueOf(p2, /^Client Information/);
    const ci = p2.findIndex((l) => /^Client Information/.test(l.text));
    const insured = ci >= 0 && p2[ci + 1] ? p2[ci + 1].text : firstMatch(all, /((?:Male|Female), Age \d+[^\n|]*)/);
    const issueAge = num(firstMatch(insured, /Age\s+(\d+)/i));
    const db = num(valueOf(p2, /^Total Initial Death Benefit/));
    const premium = num(valueOf(p2, /^Initial Premium Outlay/));
    const mode = valueOf(p2, /^Premium Mode/) || "Monthly";
    const riders = ridersOf(p2);
    // Montos máximos de aceleración por tipo (página de riders).
    const accel = {};
    for (const ls of P) for (let k = 0; k < ls.length; k++) {
      const m = ls[k].text.match(/(Chronic|Critical|Terminal) Illness Rider Benefits/);
      if (!m) continue;
      for (let j = k; j < Math.min(ls.length, k + 6); j++) {
        const v = ls[j].text.match(/Initial Maximum (?:Acceleration|Chronic Illness|Critical Illness|Terminal Illness)[^$]*\$([\d,]+)/);
        if (v) { accel[m[1].toLowerCase()] ??= num(v[1]); break; }
      }
    }
    // Tasa(s) ilustrada(s): columna "Illustrated" del encabezado del ledger.
    let rate = "";
    for (const ls of P) {
      if (!/Policy Ledgers/.test(pageText(ls)) || !/Allocations %/.test(pageText(ls))) continue;
      const hdr = ls.find((l) => /Allocations %/.test(l.text));
      const rx = Math.max(...hdr.items.filter((i) => /Interest Rate/.test(i.s)).map((i) => i.x));
      const rates = [];
      for (const l of ls) {
        if (l.y >= hdr.y || hdr.y - l.y > 40) continue;
        const pct = l.items.filter((i) => /^\d+(\.\d+)?%$/.test(i.s));
        const r = pct.find((i) => Math.abs(i.x - rx) < 30);
        const alloc = pct[0];
        if (r) rates.push(alloc && alloc !== r && num(alloc.s) < 100 ? `${r.s} (${alloc.s})` : r.s);
      }
      if (rates.length) { rate = rates.join(" / "); break; }
    }
    const maxRate = firstMatch(all, /Average:\s*(\d+\.\d+%)/);
    const byAge = ledgerSurrender(P, (t) => /Policy Ledgers/.test(t) && /Insured:/.test(t));
    const pb = p1.findIndex((l) => /Prepared By:/.test(l.text));
    const agentLines = pb >= 0 ? p1.slice(pb + 1, pb + 7).map((l) => l.items.filter((i) => i.x < 250).map((i) => i.s).join(" ")).filter(Boolean) : [];
    return {
      carrier: "omaha",
      client,
      insured,
      issueAge,
      product: (p1[0]?.text || "Indexed Universal Life Express").replace(/\s*℠/, "").trim(),
      premium, mode: cap(mode),
      deathBenefit: db,
      riders: livingFromRiders(riders, db, accel),
      rate, maxRate,
      agent: titleCase(agentLines[0] || ""),
      // "San Bruno, Ca, 94080" → "San Bruno, CA, 94080"
      agentExtra: agentLines.slice(1).map(titleCase).join("\n").replace(/\b([A-Z][a-z])(?=,?\s*\d{5})/g, (m) => m.toUpperCase()),
      date: firstMatch(all, /Date:\s*(\d{2}\/\d{2}\/\d{4})/),
      state: firstMatch(all, /State:\s*([A-Z]{2})\b/),
      policyForm: labelValue(P, /^Policy Form:?$/) || firstMatch(all, /Policy Form Number\s+([A-Z0-9-]+)/),
      formCode: firstMatch(all, /\n(\d{6}(?:-ES)?)\s/),
      byAge,
      cash: pickAges(issueAge, byAge),
    };
  }

  const cap = (s) => String(s || "").toLowerCase().replace(/(^|\s|-)\w/g, (c) => c.toUpperCase());
  const titleCase = (s) => /[a-z]/.test(s) ? s : cap(s);

  // Convierte la lista de riders en los renglones de "If I Become Ill".
  const QUALIFIES = {
    terminal: "12 months or less to live",
    chronic: "Unable to perform 2 of 6 ADLs or severe cognitive impairment",
    critical: "Diagnosis of a covered critical illness",
  };
  function livingFromRiders(riders, db, accel) {
    const out = [];
    const txt = riders.join(" | ");
    for (const kind of ["terminal", "chronic", "critical"]) {
      if (!new RegExp(kind, "i").test(txt)) continue;
      const amount = accel?.[kind] ?? (kind === "terminal" && !accel ? db : accel?.chronic ?? accel?.critical ?? null);
      out.push({ kind, label: `${cap(kind)} Illness Benefit:`, amount, qualifies: QUALIFIES[kind] });
    }
    return out;
  }

  function parse(pages) {
    const P = pages.map((items) => lines(items));
    const all = P.slice(0, 3).map(pageText).join("\n");
    if (/Americo/i.test(all)) return parseAmerico(P);
    if (/Omaha/i.test(all)) return parseOmaha(P);
    throw new Error("No reconocí la ilustración. Por ahora solo se leen las de Americo y Mutual of Omaha.");
  }

  const api = { parse, pickAges, QUALIFIES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BSIllustration = api;
})(typeof window !== "undefined" ? window : globalThis);
