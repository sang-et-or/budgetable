# Coach nutrition : « Améliorer ma semaine » propose des changements de plats et les applique.
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 1280, "height": 860})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    # une semaine riche en protéines et en viande : il y a des choses à améliorer
    page.locator("[data-a=coach-voir][data-k=sportif]").first.click()
    page.locator(".fenetre-coach").get_by_role("button", name=re.compile("Préparer ma semaine")).click()
    score = lambda: int(re.search(r"(\d+)/11", page.locator(".bandeau-nutri").inner_text()).group(1))
    s0 = score()
    assert s0 < 11, "semaine déjà parfaite : test sans objet"
    page.locator(".bandeau-nutri").get_by_role("button", name="✨ Améliorer ma semaine").click()
    f = page.locator(".fenetre-ameliorer")
    assert "Améliorer ma semaine" in f.inner_text()
    n = f.locator(".proposition-coach").count(); assert n >= 1, f.inner_text()
    page.screenshot(path=f"{OUT}/am1.png")
    avant = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.flatMap(j=>[j.dejeuner&&j.dejeuner.recette,j.diner&&j.diner.recette]).join()")
    # refuser la première, accepter le reste
    f.locator(".proposition-coach").first.get_by_role("button", name="Non merci").click()
    if f.locator(".proposition-coach").count():
        clic("Tout accepter")
        apres = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.flatMap(j=>[j.dejeuner&&j.dejeuner.recette,j.diner&&j.diner.recette]).join()")
        assert apres != avant
        assert "plat" in f.inner_text() and "changé" in f.inner_text()
        clic("Fermer")
        assert score() >= s0, (s0, score())
    print("Repères :", s0, "→", score())
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("AMELIORER OK")
    nav.close()
