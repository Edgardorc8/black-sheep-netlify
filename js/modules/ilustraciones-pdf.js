/*
 * Generador de la presentación (portada + "My Planned Life Insurance Offers") con el estilo
 * de cada carrier. Recrea las plantillas hechas en Python (plantillas_presentacion/) con pdf-lib,
 * en el navegador. Coordenadas en puntos desde ARRIBA a la izquierda (página carta 612 × 792).
 *
 * build(data, logoBytes) → Uint8Array del PDF.
 */
(function (root) {
  const W = 612, H = 792;
  const money = (n) => (n == null || n === "" ? "—" : "$" + Math.round(+n).toLocaleString("en-US"));
  const money2 = (n) => (n == null || n === "" ? "—" : "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const longDate = (mdy) => {
    const m = String(mdy || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const d = m ? new Date(+m[3], +m[1] - 1, +m[2]) : new Date();
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };
  // Helvetica estándar solo tiene caracteres "WinAnsi": se limpian los que no existen.
  const clean = (s) => String(s ?? "").replace(/[℠]/g, "SM").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");

  // ---------- Estilos por carrier ----------
  const THEMES = {
    americo: {
      name: "Americo",
      issuer: "Americo Financial Life and Annuity Insurance Company",
      logo: "assets/carriers/americo_logo.jpg", logoBox: [22.5, 22.5, 120, 22.5],
      c: { dark: "0A213F", mid: "2B5C8F", accent: "C8102E", teal: "4A7FA8", light: "E8ECF2", l1: "E8ECF5", l2: "E6EFF9", l3: "F0F2F4", row: "D6E3F2", text: "6D7084" },
      subtitle: "FLEXIBLE PREMIUM ADJUSTABLE LIFE  |  INDEXED UNIVERSAL LIFE",
      coverDisclosure: (d) => `${d.product} (Policy Form ${d.policyForm || "ACA336"}) is underwritten by Americo Financial Life and Annuity Insurance Company (Americo), Kansas City, MO, and may vary in accordance with state laws. Some products and benefits may not be available in all states. Certain restrictions and variations apply. Consult policy and riders for all limitations and exclusions.\n\nAny illustrations of future value used in a sales presentation are provided only for illustrative purposes. Any such illustration must not be regarded as guaranteed or as estimated future performance unless it is based solely on the minimum guaranteed interest rates and the maximum Cost of Insurance Rates and maximum expense charges. This product does not directly participate in any stock or equity investments.\n\nA signed illustration must be submitted with the application.\n\nAmerico Financial Life and Annuity Insurance Company  |  300 W 11th St, Kansas City, MO 64105  |  www.Americo.com`,
      box: "THIS IS AN ILLUSTRATION ONLY. IT IS NOT A CONTRACT.\nValid only with all numbered pages.",
      riderNote: { terminal: "Terminal Illness Accelerated Death Benefit Rider (Series 2197): life expectancy of 12 months or less.", chronic: "Chronic Illness Accelerated Death Benefit Rider (Series 2196): unable to perform at least 2 activities of daily living for 90 days, or severe cognitive impairment.", critical: "Critical Illness Accelerated Death Benefit Rider (Series 2195): ALS, end stage renal failure, invasive cancer, major organ failure, heart attack or stroke." },
      notes: (d) => [
        `Benefits and values shown above are not guaranteed. Cash values shown are the Non-Guaranteed Illustrated Surrender Values at a ${d.rate} illustrated interest rate. Future Cost of Insurance charges and monthly deductions can vary at the Company's discretion; actual results may be more or less favorable. This presentation is not valid unless accompanied by the complete Americo illustration. Please see the Illustrated Values ledger for guaranteed values and other important information.`,
        "1 Policy loans and partial surrenders reduce the policy's accumulation value and death benefit and may result in a taxable event. Surrender charges apply during the first 14 policy years.",
        "2 " + d.riders.map((r) => THEMES.americo.riderNote[r.kind]).join(" ") + " May not be available in all states.",
        "3 The requested acceleration will be reduced by an administrative charge and an actuarial discount based on the insured's life expectancy at the time of the request. Calculated benefits may result in no payment. Please review the Riders for details.",
      ],
      footer: (pg, d, label) => {
        pg.line(22, 752, 590, 752, "6D7084", 0.5);
        pg.text(`Issue State: ${d.state || ""}\n${d.formCode || "336ILLUS"} | Policy Form: ${d.policyForm || ""}`, 22, 756, { size: 7, color: "6D7084" });
        pg.text("THIS IS AN ILLUSTRATION ONLY. IT IS NOT A CONTRACT.\nValid only with all numbered pages.", 170, 756, { size: 7, color: "6D7084", width: 272, align: "center" });
        pg.text(`${label}\n${d.date || ""}`, 430, 756, { size: 7, color: "6D7084", width: 160, align: "right" });
      },
      summaryHeader: (pg, d, logo) => {
        pg.image(logo, 22.5, 22.5, 120, 22.5);
        pg.text(d.product, 26, 50, { size: 17, bold: true, color: "0A213F" });
        pg.text(`Prepared For:\n${d.insured}\nInitial Death Benefit: ${money2(d.deathBenefit)}\nPlanned ${d.mode} Premium: ${money2(d.premium)}`, 380, 26, { size: 6.5, color: "6D7084", width: 206, align: "right", lh: 1.25 });
        pg.line(22, 80, 590, 80, "0A213F", 1.2);
        pg.line(22, 82.5, 80, 82.5, "C8102E", 2.5);
        return 92;
      },
    },
    omaha: {
      name: "Mutual of Omaha",
      issuer: "United of Omaha Life Insurance Company",
      logo: "assets/carriers/omaha_logo_184.png", logoBox: [402.75, 21, 167.25, 30],
      c: { dark: "1B3A6B", mid: "4F81BD", accent: "00A0DC", teal: "365F91", light: "E6F0FA", l1: "E6F0FA", l2: "CCE6FF", l3: "EEF3F8", row: "B8D6F5", text: "333333" },
      subtitle: "FLEXIBLE PREMIUM UNIVERSAL LIFE WITH INDEX-LINKED INTEREST",
      coverDisclosure: (d) => `Strong. Stable. Secure. For more than a century, Mutual of Omaha Insurance Company has been there to keep its promises to customers. United of Omaha Life Insurance Company is a Mutual of Omaha affiliate.\n\n${d.product}, Policy Form Number ${d.policyForm || ""}, is underwritten by United of Omaha Life Insurance Company, 3300 Mutual of Omaha Plaza, Omaha, Nebraska 68175. United of Omaha Life Insurance Company is licensed in all states, except New York. Riders and benefits may not be available in all states.\n\nThis is an illustration only. An illustration is not intended to predict actual performance. The illustrated interest rate and the illustrated values set forth in the illustration are not guaranteed, except for those items clearly labeled as guaranteed.\n\nThis illustration is non-binding and is not a contract or offer for insurance coverage. In the event of a discrepancy between this illustration and the policy, the policy will govern.`,
      box: "This illustration is not valid unless all pages are included.",
      riderNote: { terminal: "Accelerated Death Benefit for Terminal Illness: life expectancy of 12 months or less.", chronic: "Accelerated Death Benefit for Chronic Illness: unable to perform two of six Activities of Daily Living for 90 consecutive days, or severe cognitive impairment.", critical: "Accelerated Death Benefit for Critical Illness: diagnosis of a covered critical illness." },
      notes: (d) => [
        `Benefits and values shown above are not guaranteed. Cash values shown are the Non-Guaranteed Illustrated Surrender Values at ${d.rate} illustrated interest rate(s). Future premium charges and monthly deductions can vary at the Company's discretion; actual results may be more or less favorable. This presentation is not valid unless accompanied by the complete United of Omaha Life Insurance Company illustration. Please see the Policy Ledgers for guaranteed values and other important information.`,
        "1 Policy loans and withdrawals reduce the policy's surrender value and death benefit and may result in a taxable event. Withdrawals are subject to a $100 charge. Surrender charges apply during the first 14 policy years.",
        "2 " + d.riders.map((r) => THEMES.omaha.riderNote[r.kind]).join(" ") + " Definitions may vary by state.",
        "3 Maximum cumulative acceleration is 80% of the specified amount. Each acceleration is subject to a $100 charge and is reduced by an actuarial discount (not greater than 6%). See the policy for rider details and restrictions.",
      ],
      footer: (pg, d, label) => {
        pg.line(36, 748, 576, 748, "000000", 0.6);
        pg.text(`${d.formCode || ""}`, 36, 752, { size: 6.5, color: "000000" });
        pg.text("This illustration is not valid unless all pages are included.", 150, 752, { size: 6.5, color: "000000", width: 312, align: "center" });
        pg.text(`Presented by: United of Omaha Life Insurance Company - ${String(d.agent || "").toUpperCase()}`, 36, 762, { size: 6.5, color: "000000" });
        pg.text(`Date: ${d.date || ""}`, 430, 762, { size: 6.5, color: "000000", width: 146, align: "right" });
        pg.text(`Policy Form: ${d.policyForm || ""}    State: ${d.state || ""}`, 150, 772, { size: 6.5, color: "000000", width: 312, align: "center" });
        pg.text(label, 430, 772, { size: 6.5, color: "000000", width: 146, align: "right" });
      },
      summaryHeader: (pg, d, logo) => {
        pg.product(d.product, true, 42, 20, { size: 9.5, bold: true, color: "4F81BD" });
        pg.text("Policy Summary", 42, 33, { size: 15, bold: true, color: "000000" });
        pg.image(logo, 402.75, 21, 167.25, 30);
        pg.line(42, 66, 570, 66, "000000", 0.8);
        return 76;
      },
    },
  };

  // ---------- Mini motor de dibujo sobre pdf-lib ----------
  function painter(lib, page, fonts) {
    const { rgb } = lib;
    const col = (h) => rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
    const wrap = (txt, font, size, width) => {
      const out = [];
      clean(txt).split("\n").forEach((para) => {
        if (!width || !para) { out.push(para); return; }
        let line = "";
        para.split(/\s+/).forEach((w) => {
          const t = line ? line + " " + w : w;
          if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t;
        });
        out.push(line);
      });
      return out;
    };
    return {
      rect(x, y, w, h, fill, stroke, sw = 0, opacity = 1) {
        page.drawRectangle({ x, y: H - y - h, width: w, height: h, color: fill ? col(fill) : undefined, opacity, borderColor: stroke ? col(stroke) : undefined, borderWidth: sw });
      },
      poly(pts, fill, opacity = 1) {
        const [x0, y0] = pts[0];
        const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x - x0},${y - y0}`).join(" ") + " Z";
        page.drawSvgPath(d, { x: x0, y: H - y0, color: col(fill), opacity, borderWidth: 0 });
      },
      line(x1, y1, x2, y2, color, width = 1) {
        page.drawLine({ start: { x: x1, y: H - y1 }, end: { x: x2, y: H - y2 }, color: col(color), thickness: width });
      },
      circle(cx, cy, r, fill, stroke, sw = 0) {
        page.drawCircle({ x: cx, y: H - cy, size: r, color: fill ? col(fill) : undefined, borderColor: stroke ? col(stroke) : undefined, borderWidth: sw });
      },
      image(img, x, y, w, h) { page.drawImage(img, { x, y: H - y - h, width: w, height: h }); },
      // Texto con salto de línea automático. y = parte de arriba del primer renglón.
      text(txt, x, y, o = {}) {
        const size = o.size || 10, font = o.bold ? fonts.bold : fonts.reg, lh = (o.lh || 1.2) * size;
        const rows = wrap(txt, font, size, o.width);
        rows.forEach((r, i) => {
          const tw = font.widthOfTextAtSize(r, size);
          const dx = o.align === "center" ? (o.width - tw) / 2 : o.align === "right" ? o.width - tw : 0;
          page.drawText(r, { x: x + dx, y: H - y - size * 0.82 - i * lh, size, font, color: col(o.color || "000000") });
        });
        return y + rows.length * lh;
      },
      count(txt, o = {}) { return wrap(txt, o.bold ? fonts.bold : fonts.reg, o.size || 10, o.width).length; },
      // Nombre de producto con la marca de servicio "SM" pequeña y elevada (Omaha).
      product(name, sm, x, y, o) {
        this.text(name, x, y, o);
        if (!sm) return;
        const font = o.bold ? fonts.bold : fonts.reg, size = o.size || 10;
        page.drawText("SM", { x: x + font.widthOfTextAtSize(clean(name), size) + 1, y: H - y - size * 0.82 + size * 0.45, size: size * 0.42, font, color: col(o.color || "000000") });
      },
    };
  }

  // ---------- Portada ----------
  function cover(pg, d, t, logo) {
    const C = t.c;
    pg.rect(0, 0, W, 400, C.light);
    pg.poly([[250, 0], [612, 0], [612, 400], [430, 400]], C.mid, 0.35);
    pg.poly([[360, 0], [612, 0], [612, 260]], C.dark, 0.9);
    pg.poly([[470, 400], [612, 180], [612, 400]], C.accent, 0.6);
    pg.poly([[0, 250], [300, 400], [0, 400]], C.mid, 0.18);
    const [lx, ly, lw, lh] = d.carrier === "americo" ? [28, 30, 190, 37] : [28, 26, 246, 44];
    pg.rect(0, 0, lx + lw + 28, ly + lh + 24, "FFFFFF");
    pg.poly([[lx + lw + 28, 0], [lx + lw + 68, 0], [lx + lw + 28, ly + lh + 24]], "FFFFFF");
    pg.image(logo, lx, ly, lw, lh);
    pg.product(d.product, d.carrier === "omaha", 22, 306, { size: 23, bold: true, color: C.dark });
    pg.rect(0, 346, 470, 28, C.dark);
    pg.text(t.subtitle, 22, 355, { size: 10.5, color: "FFFFFF" });
    // Círculo en 3 partes: Die Too Soon / Become Ill / Live Too Long
    const cx = 525, cy = 360, R = 62;
    pg.circle(cx, cy, R + 3, "FFFFFF");
    [C.dark, C.mid, C.accent].forEach((c, i) => {
      const a0 = -150 + 120 * i, pts = [[cx, cy]];
      for (let k = 0; k <= 120; k += 4) { const a = ((a0 + k) * Math.PI) / 180; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
      pg.poly(pts, c);
    });
    ["Die\nToo Soon", "Become\nIll", "Live\nToo Long"].forEach((lab, i) => {
      const a = ((-90 + 120 * i) * Math.PI) / 180;
      pg.text(lab, cx + R * 0.55 * Math.cos(a) - 30, cy + R * 0.55 * Math.sin(a) - 9, { size: 8, bold: true, color: "FFFFFF", width: 60, align: "center", lh: 1.05 });
    });
    [[30, 286], [306, 450]].forEach(([x0, x1]) => { pg.rect(x0, 392, x1 - x0, 78, "FFFFFF"); pg.line(x0, 392, x1, 392, C.dark, 2.5); });
    let y = pg.text("Life Insurance Illustration", 40, 402, { size: 11.5, bold: true, color: C.dark });
    y = pg.text(`Prepared on ${longDate(d.date)}`, 40, y + 3, { size: 9.5, color: "333333" });
    pg.text(`For ${d.client || d.insured}`, 40, y + 2, { size: 9.5, bold: true, color: "333333", width: 236 });
    y = pg.text("Presented By", 316, 402, { size: 11.5, bold: true, color: C.dark });
    y = pg.text(d.agent || "", 316, y + 3, { size: 8.5, bold: true, color: "333333", width: 130 });
    pg.text(d.agentExtra || "", 316, y, { size: 8, color: "333333", width: 130, lh: 1.25 });
    y = pg.text("Product issued by", 30, 502, { size: 10, color: "444444" });
    pg.text(t.issuer, 30, y + 1, { size: 12, bold: true, color: C.dark });
    pg.line(30, 538, 582, 538, C.mid, 1);
    pg.text(t.coverDisclosure(d), 30, 545, { size: 7.4, color: "333333", width: 552, lh: 1.3 });
    pg.rect(30, 692, 552, 36, null, "444444", 0.7);
    pg.text(t.box, 34, t.box.includes("\n") ? 699 : 705, { size: 8, bold: true, color: C.dark, width: 544, align: "center" });
    t.footer(pg, d, "Cover Page");
  }

  // ---------- Resumen "My Planned Life Insurance Offers" ----------
  function summary(pg, d, t, logo) {
    const C = t.c;
    let top = t.summaryHeader(pg, d, logo);
    pg.text("My Planned Life Insurance Offers", 30, top, { size: 21, color: C.dark, width: 552, align: "center" });

    const badge = (cx, cy, c, txt) => {
      pg.circle(cx + 33, cy, 9, c);
      pg.circle(cx, cy, 34, c, "FFFFFF", 3);
      pg.text(txt, cx - 30, cy - 10, { size: 8.5, bold: true, color: "FFFFFF", width: 60, align: "center", lh: 1.1 });
    };

    // Prima
    let y0 = top + 40, y1 = y0 + 50;
    pg.rect(70, y0, 490, 50, C.l3);
    pg.poly([[372, y0], [560, y0], [560, y1], [342, y1]], C.dark);
    pg.text("I will start my policy by paying:", 84, y0 + 17, { size: 14, bold: true, color: C.dark });
    pg.text(`${money2(d.premium)}\n${d.mode}`, 380, y0 + 7, { size: 17, bold: true, color: "FFFFFF", width: 175, align: "center", lh: 1.05 });

    // Death benefit
    y0 = y1 + 26; y1 = y0 + 104;
    pg.rect(70, y0, 490, 104, C.l1);
    pg.poly([[395, y0], [560, y0], [560, y1], [302, y1]], C.dark);
    pg.line(302, y1, 395, y0, C.accent, 2);
    badge(62, y0 + 52, C.dark, "Die\nToo Soon");
    pg.text("If I Die Tomorrow...", 122, y0 + 32, { size: 15, bold: true, color: C.dark });
    pg.text("Those I have chosen\nwill receive:", 122, y0 + 52, { size: 10.5, color: "222222" });
    pg.text(money(d.deathBenefit), 380, y0 + 40, { size: 21, bold: true, color: "FFFFFF", width: 175, align: "center" });

    // Living benefits: una fila por rider
    const riders = d.riders || [];
    y0 = y1 + 8;
    const rowH = 25, tableH = 26 + Math.max(1, riders.length) * (rowH + 2);
    y1 = y0 + Math.max(118, tableH + 14);
    pg.rect(70, y0, 490, y1 - y0, C.l2);
    badge(62, (y0 + y1) / 2, C.mid, "Become\nIll");
    pg.text("If I Become Ill...", 110, (y0 + y1) / 2 - 20, { size: 14, bold: true, color: C.dark });
    pg.text("I can access a portion of my Death Benefit.", 110, (y0 + y1) / 2 + 0, { size: 9.5, color: "222222", width: 125 });
    pg.text(riders.length ? "Accelerated Benefit Riders² included in my policy (no additional premium):" : "No accelerated benefit riders were included in this illustration.", 245, y0 + 8, { size: 8.5, color: "222222", width: 310, align: "center" });
    let ty = y0 + 30;
    riders.forEach((r, i) => {
      pg.rect(245, ty, 105, rowH, i % 2 ? "FFFFFF" : C.row);
      pg.rect(351, ty, 92, rowH, "FFFFFF");
      pg.rect(444, ty, 111, rowH, "FFFFFF");
      pg.text(r.label.replace(/:$/, ""), 248, ty + 8, { size: 8, bold: true, color: C.dark, width: 99, align: "center" });
      pg.text(r.amount ? `Up to ${money(r.amount)}³` : "Determined at\ntime of claim³", 353, ty + (r.amount ? 8 : 3), { size: 8, bold: !!r.amount, color: "111111", width: 88, align: "center", lh: 1.1 });
      const qo = { size: 7, color: "111111", width: 105, align: "center", lh: 1.12 };
      pg.text(r.qualifies, 447, ty + (pg.count(r.qualifies, qo) > 1 ? 4.5 : 9), qo);
      ty += rowH + 2;
    });

    // Cash value
    y0 = y1 + 8; y1 = y0 + 150;
    pg.rect(70, y0, 490, 150, C.l3);
    badge(62, y0 + 75, C.teal, "Live\nToo Long");
    pg.text("If I Need Cash...", 110, y0 + 42, { size: 14, bold: true, color: C.dark });
    pg.text("I can take a loan or withdrawal from my policy's Cash Value¹.", 110, y0 + 60, { size: 9.5, color: "222222", width: 150 });
    pg.text("The projected Cash Value for my policy is:", 290, y0 + 6, { size: 8.5, color: "222222", width: 265, align: "center" });
    const cash = (d.cash || []).slice(0, 4);
    const maxV = Math.max(1, ...cash.map((c) => +c.value || 0));
    const base = y0 + 128, maxh = 98;
    let x = 296;
    cash.forEach((c) => {
      const v = +c.value || 0, h = Math.max(16, (maxh * v) / maxV);
      pg.rect(x, base - h, 57, h, C.dark, "FFFFFF", 1);
      if (d.carrier === "americo") pg.line(x, base - h, x + 57, base - h, C.accent, 2);
      pg.text(c.value == null || c.value === "" ? "N/A" : money(v), x, base - 13, { size: 8.5, bold: true, color: "FFFFFF", width: 57, align: "center" });
      pg.text(String(c.age), x, base + 5, { size: 8.5, color: "111111", width: 57, align: "center" });
      x += 60;
    });
    pg.text("Attained Age:", 222, base + 5, { size: 8, bold: true, color: C.dark, width: 70, align: "right" });
    pg.rect(112, y0 + 96, 120, 46, "FFFFFF", C.dark, 1.2);
    const multi = /\//.test(d.rate);
    pg.text("Values calculated at", 112, y0 + 100, { size: 8, color: C.dark, width: 120, align: "center" });
    pg.text(String(d.rate || "—").replace(/\s*\(\d+%\)/g, ""), 112, y0 + 111, { size: multi ? 10 : 13, bold: true, color: C.dark, width: 120, align: "center" });
    pg.text(multi ? "illustrated interest rates" : "illustrated interest rate", 112, y0 + 128, { size: 8, color: C.dark, width: 120, align: "center" });

    // Notas
    let ny = y1 + 14;
    pg.text("The use of one benefit may reduce or eliminate other policy and rider benefits.", 30, ny, { size: 8, bold: true, color: C.dark, width: 552, align: "center" });
    pg.line(30, ny + 13, 582, ny + 13, "D3D3D3", 0.6);
    ny += 17;
    t.notes(d).forEach((n) => { ny = pg.text(n, 30, ny, { size: 6.3, color: t.c.text, width: 552, lh: 1.22 }) + 1; });
    t.footer(pg, d, "Summary Page");
  }

  async function build(data, logoBytes) {
    const lib = root.PDFLib;
    const t = THEMES[data.carrier];
    if (!t) throw new Error("Carrier no soportado.");
    const doc = await lib.PDFDocument.create();
    doc.setTitle(`${data.client || data.insured} - ${t.name}`);
    doc.setProducer("Black Sheep Agency");
    const fonts = { reg: await doc.embedFont(lib.StandardFonts.Helvetica), bold: await doc.embedFont(lib.StandardFonts.HelveticaBold) };
    const logo = data.carrier === "americo" ? await doc.embedJpg(logoBytes) : await doc.embedPng(logoBytes);
    const d = { ...data, product: clean(data.product), rate: clean(data.rate) };
    cover(painter(lib, doc.addPage([W, H]), fonts), d, t, logo);
    summary(painter(lib, doc.addPage([W, H]), fonts), d, t, logo);
    return doc.save();
  }

  const api = { build, THEMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BSIllustrationPdf = api;
})(typeof window !== "undefined" ? window : globalThis);
