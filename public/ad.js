/**
 * Moussa Studio — Ad Tag
 * Usage : <div id="ms-ad" data-placement="newsletter"></div>
 *         <script src="https://TON-SITE.netlify.app/ad.js" async></script>
 *
 * Le script se charge de façon asynchrone, ne bloque pas la page,
 * affiche le créatif et envoie les events impression + clic.
 */
(function () {
  "use strict";

  // ── Config ───────────────────────────────────────────────────────────────
  const BASE_URL = "https://TON-SITE.netlify.app"; // ← remplace avec ton URL Netlify

  // ── Helpers ──────────────────────────────────────────────────────────────
  function beacon(path, payload) {
    // navigator.sendBeacon : fire-and-forget, survit aux navigations
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(BASE_URL + path, blob);
    } else {
      // Fallback XHR asynchrone
      const xhr = new XMLHttpRequest();
      xhr.open("POST", BASE_URL + path, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify(payload));
    }
  }

  function trackImpression(ad) {
    beacon("/.netlify/functions/track", {
      campaignId: ad.campaignId,
      creativeId: ad.id,
      eventType:  "impression",
      placement:  ad.placement,
      pageUrl:    window.location.href,
    });
  }

  function buildClickUrl(ad) {
    // On passe par la Function track qui log le clic puis redirige
    const params = new URLSearchParams({
      campaignId: ad.campaignId,
      creativeId: ad.id,
      eventType:  "click",
      placement:  ad.placement,
      pageUrl:    window.location.href,
      clickUrl:   ad.clickUrl,
    });
    // Pour le clic, on utilise une URL GET simple qui redirige
    return BASE_URL + "/.netlify/functions/track?" + params.toString();
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  function render(slot, ad) {
    // Wrapper
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:block;text-align:center;margin:8px 0;";

    // Lien
    const link = document.createElement("a");
    link.href   = buildClickUrl(ad);
    link.target = "_blank";
    link.rel    = "noopener noreferrer sponsored";
    link.title  = ad.altText;

    // Image
    const img = document.createElement("img");
    img.src   = ad.imageUrl;
    img.alt   = ad.altText;
    img.style.cssText = "max-width:100%;height:auto;display:block;border-radius:6px;";

    // Label discret "Sponsorisé"
    const label = document.createElement("div");
    label.textContent = "Sponsorisé";
    label.style.cssText = "font-size:10px;color:#888;text-align:right;margin-top:2px;";

    link.appendChild(img);
    wrapper.appendChild(link);
    wrapper.appendChild(label);

    // Vider le slot et injecter
    slot.innerHTML = "";
    slot.appendChild(wrapper);

    // Intersection Observer : tracker l'impression quand la pub est vraiment visible
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              trackImpression(ad);
              observer.disconnect(); // une seule fois
            }
          });
        },
        { threshold: 0.5 } // 50% de la pub visible
      );
      observer.observe(wrapper);
    } else {
      // Fallback immédiat si pas d'IntersectionObserver
      trackImpression(ad);
    }
  }

  // ── Init : cherche tous les slots sur la page ────────────────────────────
  function init() {
    const slots = document.querySelectorAll("[data-ms-ad]");
    if (!slots.length) return;

    slots.forEach((slot) => {
      const placement = slot.dataset.msAd || "default";

      fetch(BASE_URL + "/.netlify/functions/serve-ad?placement=" + encodeURIComponent(placement))
        .then((r) => r.json())
        .then(({ ad }) => {
          if (ad) render(slot, ad);
        })
        .catch(() => {
          // Silencieux : si la pub échoue, la page continue normalement
        });
    });
  }

  // Lancement après DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();