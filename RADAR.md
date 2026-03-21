# RADAR — Market Coverage

monopop-intel maps supermarket pricing across Rio de Janeiro.
This document tracks each network's data acquisition strategy,
technical profile, and integration status.

Coverage grows from lowest friction to highest — public APIs first,
structured scraping second, partnerships and proxy sources third.

---

## Data Sources

monopop-intel operates on two complementary data flows:

**Top-down** — price data collected directly from supermarket platforms
(APIs, scraping, delivery proxies). Fast, scalable, but reflects
advertised prices only.

**Bottom-up** — price data contributed by consumers via the
[Monopop](https://github.com/mahjard/monopop) app, captured at
purchase time. Slower to accumulate, but reflects what people
actually paid. Cross-referencing both flows reveals the gap
between market price and real-world price — which is where the
interesting signal lives.

---

## Acquisition Strategies

| Type | Description |
|---|---|
| `api:public` | Public e-commerce API, no auth required |
| `scraping` | Structured HTML/JS scraping via Playwright |
| `ocr:llm` | Flyer image downloaded via Playwright, extracted via multimodal LLM (Gemini Flash) |
| `partnership` | Direct data sharing with store management |
| `proxy:delivery` | Price data via iFood, Rappi or similar |
| `opportunity` | Store lacks digital presence — potential freelance |

---

## Networks

### Prezunic
**URL:** prezunic.com.br  
**Platform:** VTEX (confirmed)  
**Strategy:** `api:public`  
**Status:** 🟢 Live  
**Notes:** VTEX Intelligent Search endpoint. Clean JSON, no auth required.

---

### Zona Sul
**URL:** zonasul.com.br  
**Platform:** VTEX (confirmed — official case study)  
**Strategy:** `api:public`  
**Status:** 🟢 Live  
**Notes:** Premium RJ chain, 44 stores. VTEX since 2020.

---

### Guanabara
**URL:** supermercadosguanabara.com.br  
**Platform:** None — institutional site only  
**Strategy:** `ocr:llm`  
**Status:** 🟡 v0.2  
**Notes:** Largest supermarket chain in RJ (R$10.3B revenue). No e-commerce, no iFood/Rappi presence.
         Daily flyer published on website. Pipeline: Playwright downloads flyer image →
         Gemini Flash API extracts structured JSON. Differentiates between regular price
         and Guanabara Card price. No OpenCV preprocessing needed — LLM handles
         visual noise natively.

---

### Mundial
**URL:** supermercadosmundial.com.br  
**Platform:** Custom PHP  
**Strategy:** `scraping`  
**Status:** 🟡 v0.2  
**Notes:** Search URL suggests structured product pages. Playwright required.

---

### Supermarket
**URL:** TBD  
**Platform:** TBD  
**Strategy:** TBD  
**Status:** 🔵 Researching  
**Notes:** Second largest RJ chain (R$10B revenue, 143 stores). Digital presence TBC.

---

### Extra
**URL:** extramercado.com.br  
**Platform:** TBD (Grupo Pão de Açúcar)  
**Strategy:** TBD  
**Status:** 🔵 Researching  
**Notes:** Large chain, possibly VTEX enterprise or proprietary stack.

---

### Carrefour
**URL:** mercado.carrefour.com.br  
**Platform:** TBD  
**Strategy:** TBD  
**Status:** 🔵 Researching  
**Notes:** Clean category URLs suggest structured catalog. High coverage potential.

---

### SuperPrix
**URL:** superprix.com.br  
**Platform:** TBD  
**Strategy:** TBD  
**Status:** 🔵 Researching  
**Notes:** RJ chain with own e-commerce. Platform TBC.

---

### Rede Economia / Campeão
**URLs:** redeconomia.com.br, supermercadoscampeao.com.br, deliverydaeconomia.com.br  
**Platform:** Multiple — fragmented  
**Strategy:** `proxy:delivery` (iFood integration confirmed)  
**Status:** 🟠 Complex — deferred  
**Notes:** Multiple brands, multiple domains. iFood as proxy is most viable entry point.

---

### Multimarket
**URL:** redemultimarket.com.br  
**Platform:** Flyer-based  
**Strategy:** `ocr:llm`  
**Status:** 🔵 Researching  
**Notes:** No structured product catalog. Same `ocr:llm` pipeline as Guanabara
         applies here — ~90% code reuse expected once Guanabara pipeline is validated.

---

### Pexinchete
**URL:** instagram.com/pexinchete  
**Platform:** Instagram only  
**Strategy:** `opportunity`  
**Status:** 🟣 Out of scope / freelance potential  
**Notes:** No website or e-commerce infrastructure.
         Potential freelance: build them a presence, get the data.

---

## Partnerships

### ASSERJ — Associação dos Supermercados do Estado do RJ
**URL:** asserj.com.br  
**Role:** Industry association representing RJ supermarket networks.  
**Potential:** Directory of member stores, institutional channel for
partnership outreach, credibility for data collection agreements.  
**Status:** 🤝 Long-term — post v1.0

---

## Coverage Roadmap
```
v0.1  ── Prezunic + Zona Sul (VTEX API) ✅
v0.2  ── Guanabara (ocr:llm) + Mundial (Playwright)
v0.3  ── Extra + SuperPrix + Carrefour + Supermarket (pending research)
v0.4  ── Delivery proxies (iFood/Rappi)
v0.5  ── Multimarket + remaining flyer-based chains (ocr:llm pipeline reuse)
v1.0  ── Partnership model + live data collection
v2.0  ── Bottom-up layer: Monopop consumer data + cross-reference engine
```

---

*Small stores, street markets, and neighborhood networks are the
long-term frontier — where price intelligence matters most and
data is hardest to find. The bottom-up layer via Monopop is what
makes that frontier reachable.*