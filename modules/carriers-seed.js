/*
 * Lista inicial de carriers (teléfonos, correos y enlaces oficiales de cada compañía).
 * Solo se usa para llenar la sección la primera vez; después el administrador la edita.
 * Formato: contacts = [[etiqueta, teléfono o correo]], links = [[etiqueta, URL]]
 */
window.BSCarrierSeed = [
  { name: "Americo", logo: "assets/carriers/americo_logo.jpg",
    contacts: [["Customer Service", "(800) 231-0801"]],
    links: [["Agent Portal", "https://account.americoagent.com/Identity/Account/Login/?returnUrl=https%3a%2f%2ftools.americoagent.com%2f"], ["FFL Training Site", "https://ffl.americo.com/"]] },
  { name: "American-Amicable", logo: "assets/carriers/american-amicable.png",
    contacts: [["Agent Hotline (Prompt 1, 1, 3)", "(800) 736-7311"], ["Phone Interview", "(866) 719-2024"]],
    links: [["Agent Portal", "https://www.insuranceapplication.com/cgi/webappmobile/login.aspx?ReturnUrl=%2fcgi%2fwebappmobile%2f"]] },
  { name: "Aetna", logo: "assets/carriers/aetna.png",
    contacts: [["Customer Service", "(866) 272-6630"], ["New Business", "aetssinewbusiness@aetna.com"]],
    links: [["Agent Portal", "https://www.aetnaseniorproducts.com/"]] },
  { name: "Athene", logo: "assets/carriers/athene.svg",
    contacts: [["Customer Service", "(855) 428-4363"], ["Customer Documents", "submitcustomerdocs@athene.com"]],
    links: [["Agent Portal", "https://www.athene.com/producer/login"], ["Performance Elite", "https://www.athene.com/producer/products/performance-elite"], ["MaxRate", "https://www.athene.com/producer/products/maxrate"], ["Ascent Pro Bonus", "https://www.athene.com/producer/products/ascent-pro-bonus"], ["Agility", "https://www.athene.com/producer/products/agility"], ["Activate", "https://www.athene.com/producer/products/activate"], ["AccuMax", "https://www.athene.com/producer/products/accumax7"]] },
  { name: "Corebridge", logo: "assets/carriers/corebridge.svg",
    contacts: [["Contracting", "(800) 247-8837"], ["Sales Support (Prompt 2)", "(800) 677-3311"]],
    links: [["Agent Portal", "https://connext.corebridgefinancial.com/life/connext-portal/public/login"], ["Quick Quote", "https://rapid-rater.live.web.corebridgefinancial.com/Simplinowquoter"]] },
  { name: "Ethos", logo: "assets/carriers/ethos.svg",
    contacts: [["Customer Service", "(415) 915-0665"], ["TruStage Customer Service", "(855) 591-9026"]],
    links: [["Agent Portal", "https://agents.ethoslife.com/login"]] },
  { name: "F&G", logo: "assets/carriers/fg.svg",
    contacts: [["Customer Service", "(800) 445-6758"]],
    links: [["Agent Portal", "https://saleslink.fglife.com/"]] },
  { name: "Mutual of Omaha", logo: "assets/carriers/omaha_logo_184.png",
    contacts: [["Customer Service", "(800) 693-6083"], ["Agent Hotline", "(800) 867-6873"]],
    links: [["Agent Portal", "https://accounts.mutualofomaha.com/"], ["Quote Tool", "https://www3.mutualofomaha.com/mobile-quotes/#/home"]] },
  { name: "National Life Group", logo: "assets/carriers/nationallife.png",
    contacts: [["Customer Service", "(800) 732-8939"], ["Sales Desk (agentes)", "(800) 906-3310"]],
    links: [["Agent Portal", "https://www.nationallife.com/agent/"], ["Underwriting Digital Guide", "https://www.nationallife.com/docs/digital/ob/underwriting/story_html5.html"]] },
  { name: "Transamerica", logo: "assets/carriers/transamerica.png",
    contacts: [["Customer Service", "(877) 234-4848"]],
    links: [["Agent Portal", "https://www.transamerica.com/login/financial-professional"]] },
];
