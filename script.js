(function () {
  const STORAGE_KEY = "bonusblik.bonuses.v1";
  const FEED_STORAGE_KEY = "bonusblik.remote-bonuses.v1";
  const FEED_REFRESH_INTERVAL = 6 * 60 * 60 * 1000;
  const DEMO_BONUSES = [
    { id: "demo-fjord", casinoName: "Fjordlykke", offer: "100 % op til 1.000 kr.", freeSpins: 50, wagering: "10x bonus", url: "", isNew: true, licenseVerified: false, createdAt: "2026-10-25T10:00:00.000Z", isDemo: true },
    { id: "demo-kompas", casinoName: "Guldkompas", offer: "200 % op til 750 kr.", freeSpins: 25, wagering: "15x bonus", url: "", isNew: false, licenseVerified: false, createdAt: "2026-10-20T10:00:00.000Z", isDemo: true },
    { id: "demo-moent", casinoName: "Møntværk", offer: "100 % op til 500 kr.", freeSpins: 0, wagering: "8x bonus", url: "", isNew: false, licenseVerified: false, createdAt: "2026-10-18T10:00:00.000Z", isDemo: true }
  ];

  function readBonuses() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_BONUSES));
        return DEMO_BONUSES.slice();
      }
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Bonusdata kunne ikke indlæses.", error);
      return [];
    }
  }

  function saveBonuses(bonuses) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bonuses));
  }

  function readCachedFeed() {
    try {
      const cached = JSON.parse(localStorage.getItem(FEED_STORAGE_KEY));
      return Array.isArray(cached) ? cached : null;
    } catch {
      return null;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function safeLink(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function renderPublicPage() {
    const grid = document.getElementById("bonus-grid");
    if (!grid) return;

    const search = document.getElementById("bonus-search");
    const count = document.getElementById("result-count");
    const empty = document.getElementById("empty-state");
    const filterButtons = [...document.querySelectorAll("[data-filter]")];
    let publicBonuses = readCachedFeed();
    let activeFilter = "all";

    function render() {
      const term = search.value.trim().toLocaleLowerCase("da");
      const matches = (publicBonuses ?? readBonuses())
        .filter((bonus) => {
          const text = `${bonus.casinoName} ${bonus.offer} ${bonus.wagering}`.toLocaleLowerCase("da");
          const matchesFilter = activeFilter === "all" || (activeFilter === "new" && bonus.isNew) || (activeFilter === "spins" && Number(bonus.freeSpins) > 0);
          return matchesFilter && text.includes(term);
        })
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      count.textContent = String(matches.length);
      empty.hidden = matches.length > 0;
      grid.hidden = matches.length === 0;
      grid.innerHTML = matches.map((bonus, index) => {
        const verified = Boolean(bonus.licenseVerified);
        const licenseClaimed = Boolean(bonus.licenseClaimedBySource);
        const link = verified || licenseClaimed ? safeLink(bonus.url) : "";
        const monogram = escapeHTML((bonus.casinoName || "?").trim().slice(0, 2).toLocaleUpperCase("da"));
        const tag = bonus.isDemo ? "DEMO" : bonus.isSponsored ? "REKLAME" : bonus.isNew ? "NY" : "BONUS";
        const freeSpins = bonus.freeSpins === null || bonus.freeSpins === undefined
          ? "Ikke oplyst"
          : `${Number(bonus.freeSpins) || 0} spins`;
        const licenseClass = verified ? "is-verified" : licenseClaimed ? "is-claimed" : "";
        const licenseText = verified
          ? "Dansk licens kontrolleret"
          : licenseClaimed
            ? "Kilde angiver dansk licens"
            : "Licens ikke verificeret";
        const action = link
          ? `<a class="primary-button card-cta" href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">Spil Nu <span aria-hidden="true">↗</span></a>`
          : `<button class="primary-button card-cta" type="button" disabled title="Kræver verificeret dansk licens og et gyldigt tilbudslink">Spil Nu <span aria-hidden="true">↗</span></button>`;
        return `<article class="bonus-card" style="animation-delay:${Math.min(index, 6) * 45}ms">
          <div class="card-top"><div class="casino-identity"><span class="casino-monogram" aria-hidden="true">${monogram}</span><span class="casino-name">${escapeHTML(bonus.casinoName)}</span></div><span class="card-tag ${bonus.isNew ? "is-new" : ""}">${tag}</span></div>
          <h3 class="card-offer">${escapeHTML(bonus.offer)}</h3>
          <p class="card-subtitle">Velkomstbonus</p>
          <div class="card-details"><div class="detail-item"><span class="detail-label">FREE SPINS</span><span class="detail-value">${escapeHTML(freeSpins)}</span></div><div class="detail-item"><span class="detail-label">OMSÆTNING</span><span class="detail-value">${escapeHTML(bonus.wagering || "Se vilkår")}</span></div></div>
          <div class="license-status ${licenseClass}">${licenseText}</div>
          ${action}
        </article>`;
      }).join("");
    }

    function refreshPublicFeed() {
      fetch("bonuses.json", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((bonuses) => {
          if (!Array.isArray(bonuses)) throw new Error("bonuses.json must contain a JSON array");
          const validBonuses = bonuses.filter((bonus) => bonus && typeof bonus.casinoName === "string" && typeof bonus.offer === "string");
          if (validBonuses.length === 0) throw new Error("bonuses.json contains no valid bonuses");
          publicBonuses = validBonuses;
          try {
            localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(validBonuses));
          } catch (error) {
            console.warn("Bonusfeedet kunne ikke caches lokalt.", error);
          }
          render();
        })
        .catch((error) => {
          console.warn("Bonusfeedet kunne ikke hentes; bruger tilgængelige lokale data.", error);
        });
    }

    filterButtons.forEach((button) => button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      filterButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      render();
    }));
    search.addEventListener("input", render);
    document.getElementById("clear-search").addEventListener("click", () => {
      search.value = "";
      activeFilter = "all";
      filterButtons.forEach((button) => {
        const selected = button.dataset.filter === "all";
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      render();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        search.focus();
      }
    });
    window.addEventListener("storage", (event) => {
      if (event.key === FEED_STORAGE_KEY) publicBonuses = readCachedFeed();
      render();
    });
    render();
    refreshPublicFeed();
    window.setInterval(refreshPublicFeed, FEED_REFRESH_INTERVAL);
  }

  function renderAdminPage() {
    const form = document.getElementById("bonus-form");
    if (!form) return;
    const list = document.getElementById("admin-bonus-list");
    const counter = document.getElementById("admin-count");
    const empty = document.getElementById("admin-empty");
    const message = document.getElementById("save-message");

    function paintTable() {
      const bonuses = readBonuses().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      counter.textContent = String(bonuses.length);
      empty.hidden = bonuses.length > 0;
      list.innerHTML = bonuses.map((bonus) => `<tr>
        <td class="table-casino">${escapeHTML(bonus.casinoName)}</td>
        <td>${escapeHTML(bonus.offer)}</td>
        <td>${bonus.freeSpins === null || bonus.freeSpins === undefined ? "Ikke oplyst" : Number(bonus.freeSpins) || 0}</td>
        <td><span class="table-status ${bonus.licenseVerified ? "is-verified" : ""}">${bonus.licenseVerified ? "Kontrolleret" : bonus.licenseClaimedBySource ? "Kildebadge" : "Afventer"}</span></td>
        <td><div class="table-actions"><button type="button" data-edit="${escapeHTML(bonus.id)}">Redigér</button><button type="button" class="delete-action" data-delete="${escapeHTML(bonus.id)}">Slet</button></div></td>
      </tr>`).join("");
    }

    function clearForm() {
      form.reset();
      document.getElementById("bonus-id").value = "";
      document.getElementById("free-spins").value = "0";
      document.getElementById("form-title").textContent = "Tilføj bonus";
      document.querySelector(".save-button").innerHTML = 'Gem bonus <span aria-hidden="true">→</span>';
      message.textContent = "";
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const bonuses = readBonuses();
      const id = data.get("id") || `bonus-${crypto.randomUUID()}`;
      const previous = bonuses.find((bonus) => bonus.id === id);
      const bonus = {
        id,
        casinoName: String(data.get("casinoName")).trim(),
        offer: String(data.get("offer")).trim(),
        freeSpins: Math.max(0, Number(data.get("freeSpins")) || 0),
        wagering: String(data.get("wagering") || "").trim(),
        url: String(data.get("url") || "").trim(),
        isNew: form.elements.isNew.checked,
        licenseVerified: form.elements.licenseVerified.checked,
        createdAt: previous?.createdAt || new Date().toISOString(),
        isDemo: false
      };

      const updated = previous ? bonuses.map((item) => item.id === id ? bonus : item) : [bonus, ...bonuses];
      try {
        saveBonuses(updated);
        clearForm();
        message.textContent = "Bonus gemt.";
        paintTable();
      } catch (error) {
        message.textContent = "Kunne ikke gemme. Kontrollér browserens lagerplads.";
        console.error("Bonusdata kunne ikke gemmes.", error);
      }
    });

    list.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit]");
      const deleteButton = event.target.closest("[data-delete]");
      const bonuses = readBonuses();

      if (editButton) {
        const bonus = bonuses.find((item) => item.id === editButton.dataset.edit);
        if (!bonus) return;
        document.getElementById("bonus-id").value = bonus.id;
        document.getElementById("casino-name").value = bonus.casinoName || "";
        document.getElementById("bonus-offer").value = bonus.offer || "";
        document.getElementById("free-spins").value = Number(bonus.freeSpins) || 0;
        document.getElementById("wagering").value = bonus.wagering || "";
        document.getElementById("bonus-url").value = bonus.url || "";
        document.getElementById("is-new").checked = Boolean(bonus.isNew);
        document.getElementById("license-verified").checked = Boolean(bonus.licenseVerified);
        document.getElementById("form-title").textContent = "Redigér bonus";
        document.querySelector(".save-button").innerHTML = 'Gem ændringer <span aria-hidden="true">→</span>';
        message.textContent = "";
        document.getElementById("casino-name").focus();
      }

      if (deleteButton) {
        const bonus = bonuses.find((item) => item.id === deleteButton.dataset.delete);
        if (!bonus || !window.confirm(`Slet bonus for ${bonus.casinoName}?`)) return;
        saveBonuses(bonuses.filter((item) => item.id !== bonus.id));
        paintTable();
        if (document.getElementById("bonus-id").value === bonus.id) clearForm();
      }
    });

    document.getElementById("reset-form").addEventListener("click", clearForm);
    window.addEventListener("storage", paintTable);
    paintTable();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderPublicPage();
    if (sessionStorage.getItem("bonusblik.admin") === "true") renderAdminPage();
    document.addEventListener("bonusblik:authenticated", renderAdminPage, { once: true });
  });
})();