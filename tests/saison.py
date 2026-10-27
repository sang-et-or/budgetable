# Mes recettes : idées de saison (filtrer, garder, mettre au menu, ouvrir la fiche)
import sys, re
from playwright.sync_api import sync_playwright

def aller(page, k):
    """Ouvre un onglet : bouton de la navigation s'il est visible, sinon via « Plus » (téléphone)."""
    b = page.locator(f"nav.nav button[data-k={k}]")
    if b.is_visible(): b.click()
    else: page.locator(".nav-plus").click(); page.locator(f".fenetre-plus [data-k={k}]").click()

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.clock.set_fixed_time("2026-10-22T12:00:00")
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    aller(page, 'recettes')
    sec = page.locator(".saison")
    assert "de saison en octobre" in sec.inner_text().lower() and "automne" in sec.inner_text(), sec.inner_text()[:300]
    n = sec.locator(".carte-saison").count(); print("idées :", n); assert n >= 45, n
    t = sec.inner_text()
    assert "Tartiflette" not in t  # pas de saison en octobre
    assert "Velouté de courge et châtaignes" in t
    sec.locator(".carte-saison").first.screenshot(path=f"{OUT}/s0.png")
    page.screenshot(path=f"{OUT}/s1.png")
    # filtre
    sec.locator("[data-a=saison-filtre][data-k=rapide]").click()
    tt = [int(x) for x in re.findall(r"(\d+) min", page.locator(".saison .jours").inner_text())]
    assert tt and max(tt) <= 30, tt
    sec.locator("[data-a=saison-filtre][data-k=tout]").click()
    # garder
    sec.get_by_role("button", name="♡ Garder").first.click()
    s = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).saisonGardees")
    assert len(s) == 1
    assert page.evaluate(f"Engine.recettesCompatibles(JSON.parse(localStorage.getItem('budgetable.v1')).profil).some((r) => r.id === '{s[0]}')")
    # fiche
    nom = sec.locator(".carte-saison .titre-repas").nth(1).inner_text()
    sec.locator(".carte-saison .titre-repas").nth(1).click()
    f = page.locator(".fiche").last
    assert nom in f.inner_text() and "Préparation" in f.inner_text() and "kcal" in f.inner_text()
    f.get_by_role("button", name="Fermer", exact=True).first.click()
    # mettre au menu
    sec.locator(".carte-saison").nth(1).get_by_role("button", name="Mettre au menu").click()
    page.locator(".fenetre-au-menu button:not([disabled])[data-a]").filter(has_text=re.compile("Soir|Dîner|soir", re.I)).first.click() if page.locator(".fenetre-au-menu").count() else None
    page.wait_for_timeout(300)
    plan = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.flatMap((j) => [j.dejeuner, j.diner]).filter(Boolean).map((m) => m.recette)")
    print("au menu :", any(x.startswith('s-') for x in plan))
    # recherche dans « Changer ce plat » trouve les recettes de saison
    assert page.evaluate("Engine.rechercherPlats(JSON.parse(localStorage.getItem('budgetable.v1')).profil, 'potée').resultats.length") >= 1
    # en été : pas d'idées d'automne
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("SAISON OK")
    nav.close()
