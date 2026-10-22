# Calcul du repère de calories (Mifflin-St Jeor) et application au carnet.
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 760, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.get_by_role("button", name=re.compile("Mon suivi des apports")).first.click()
    clic("🧮 Calculer mon repère")
    f = page.locator(".fenetre-kcal")
    assert "Remplissez" in f.inner_text()
    f.get_by_role("radio", name="Une femme").click()
    f.locator("[data-k=age]").fill("45"); f.locator("[data-k=taille]").fill("165"); f.locator("[data-k=poids]").fill("70")
    f.get_by_role("radio", name=re.compile("^Un peu actif")).click()
    # 10×70 + 6,25×165 − 5×45 − 161 = 1 345,25 ; × 1,6 = 2 152 → 2 150
    r = f.locator("#kcal-resultat").inner_text().replace(" ", " ")
    assert "1 350" in r and "2 150" in r, r
    f.get_by_role("radio", name="Perdre doucement").click()
    r = f.locator("#kcal-resultat").inner_text().replace(" ", " ")
    assert "1 750" in r, r     # 2 152 − 400 = 1 752 → 1 750
    page.screenshot(path=f"{OUT}/kc1.png")
    f.get_by_role("button", name=re.compile("^Utiliser")).click()
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).objectifKcal") == 1750
    assert "/ 1 750 kcal" in page.locator(".compteur", has_text="Énergie").inner_text().replace(" ", " ")
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("KCAL OK")
    nav.close()
