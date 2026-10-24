# Favoris en étoile (semaine, fiche, page Recettes, retour dans les menus) et saison dans les propositions
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 1100, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    main = page.locator("main")
    etoile = main.locator(".etoile-fav").first
    rid = etoile.get_attribute("data-r")
    assert etoile.inner_text() == "☆"
    etoile.click()
    assert main.locator(f".etoile-fav[data-r='{rid}']").first.inner_text() == "★"
    fav = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).classiques")
    assert rid in fav
    main.locator(".jour").first.screenshot(path=f"{OUT}/favori.png")
    # page Recettes : section favoris
    page.locator("nav button[data-k=recettes]").click()
    assert "Mes favoris" in main.inner_text() and main.locator(".liste-favoris li").count() == 1
    main.locator(".favoris").screenshot(path=f"{OUT}/favoris.png")
    # retire depuis la page Recettes
    main.locator(".liste-favoris .etoile-fav").click()
    assert main.locator(".liste-favoris li").count() == 0
    # le favori revient dans les nouvelles semaines
    page.locator("nav button[data-k=semaine]").click()
    main.locator(f".etoile-fav[data-r='{rid}']").first.click()
    n = 0
    for _ in range(4):
        clic("Nouvelle semaine")
        ids = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.flatMap(j => [j.dejeuner, j.diner]).filter(Boolean).map(m => m.recette)")
        n += rid in ids
    print("favori présent dans", n, "semaines sur 4"); assert n >= 3
    # saison : en janvier, pas de tomates ni de courgettes fraîches ; en juillet, oui
    r = page.evaluate("""() => { const E = window.Engine, d = JSON.parse(localStorage.getItem('budgetable.v1')); const res = {};
      for (const m of [1, 7]) { E.definirMois(m); let dans = 0, hors = 0; for (let k = 0; k < 3; k++) { const w = E.genererSemaine(d.profil, { seed: 11 + k }); w.jours.forEach((j) => ['dejeuner', 'diner'].forEach((s) => { const x = j[s]; if (!x) return; const z = E.saisonRecette(E.REC[x.recette], m); dans += z.dans.length; hors += z.hors.length; })); } res[m] = [dans, hors]; }
      E.definirMois(null); return res; }""")
    print("saison", r); assert r["1"][1] <= 2 and r["7"][1] <= 2 and r["1"][0] > 0
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("FAVORIS SAISON OK")
    nav.close()
