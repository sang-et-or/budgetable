# Recettes air fryer dans l'appli : chargées au démarrage, proposées avec une friteuse à air, page du site lisible
from playwright.sync_api import sync_playwright
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.wait_for_timeout(800)
    n = page.evaluate("Object.keys(Engine.REC).filter((k) => k.startsWith('af-')).length")
    assert n == 12, n
    r = page.evaluate("""() => { const p = Engine.profilParDefaut(); p.equipement = ['plaque', 'airfryer'];
      const s = Engine.genererSemaine(p, { graine: 3 }); return s.jours.flatMap((j) => [j.dejeuner, j.diner]).filter((x) => x && String(x.recette).startsWith('af-')).length; }""")
    assert r >= 1, r
    page.goto("http://localhost:8766/recettes-air-fryer-pas-cheres.html")
    t = page.inner_text("body")
    assert "Nuggets de poulet maison" in t and "la part" in t, t[:300]
    assert page.evaluate("document.documentElement.scrollWidth") <= 390
    page.screenshot(path="/tmp/claude-0/-home-claude/e7ca5389-2d6a-596d-9613-ea14ab557a7b/scratchpad/airfryer_page.png", full_page=True)
    page.goto("http://localhost:8766/recettes/nuggets-de-poulet-maison-et-frites-a-l-air-fryer.html")
    assert "Nuggets" in page.inner_text("h1")
    nav.close()
assert not erreurs, erreurs
print("OK air fryer appli")
