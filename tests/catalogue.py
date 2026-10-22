# Catalogue élargi : « parmesan » se trouve dans l'édition d'une recette et part dans la liste de courses
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844})
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
    page.locator("nav button", has_text="Recettes").click()
    page.get_by_role("button", name="+ Ajouter une recette").first.click()
    ed = page.locator(".fenetre-edition")
    ed.locator("input").first.fill("Pâtes bolognaise au parmesan")
    for b in ["Trouver les ingrédients", "Continuer", "Suivant"]:
        if ed.get_by_role("button", name=b, exact=True).count() and not page.locator("#ajout-ing").count(): ed.get_by_role("button", name=b, exact=True).first.click()
    page.wait_for_timeout(300)
    t = ed.inner_text()
    assert "Parmesan" in t, t[:900]   # reconnu dans le nom
    page.locator("#ajout-ing").press_sequentially("crev", delay=30)
    props = page.locator("#propositions-ing").inner_text(); print("crev →", props)
    assert "Crevettes" in props
    page.locator("#ajout-ing").fill(""); page.locator("#ajout-ing").press_sequentially("échal", delay=30)
    assert "Échalotes" in page.locator("#propositions-ing").inner_text()
    page.locator("#propositions-ing").get_by_role("button", name=re.compile("Échalotes")).first.click()
    ed.screenshot(path=f"{OUT}/cat1.png")
    assert "Échalotes" in page.locator(".dans-recette").inner_text()
    # le placard trouve aussi les nouveaux produits
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("CATALOGUE OK")
    nav.close()
