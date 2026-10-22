# Ce soir : « J'ai ces aliments » propose des recettes avec les aliments choisis.
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
    page.locator("nav button", has_text="Ce soir").click()
    clic("Choisir mes aliments")
    b = page.locator(".jai-ca")
    b.get_by_role("button", name=re.compile(r"^\+ .*Œufs")).click()
    page.locator("#jaica-cherche").press_sequentially("courg", delay=30)
    page.locator("#jaica-propositions").get_by_role("button", name=re.compile("Courgettes")).click()
    t = page.locator(".jai-ca").inner_text()
    assert "recette" in t and "Avec vos" in t, t[:600]
    first = page.locator(".jai-ca .titre-repas").first.inner_text()
    assert "uf" in first.lower() or "omelette" in first.lower() or "courgette" in first.lower(), first
    page.locator(".jai-ca").screenshot(path=f"{OUT}/jc1.png")
    # retirer un aliment, cocher le placard
    page.locator(".jai-ca").get_by_role("button", name=re.compile("Retirer Œufs")).click()
    page.locator(".jai-ca input[data-a=jaica-placard]").check()
    assert "Avec vos courgettes" in page.locator(".jai-ca").inner_text()
    # au menu ce soir
    nom = page.locator(".jai-ca .titre-repas").first.inner_text()
    page.locator(".jai-ca").get_by_role("button", name="Au menu ce soir").first.click()
    rid = page.evaluate("(() => { const a = JSON.parse(localStorage.getItem('budgetable.v1')); const j = (new Date().getDay() + 6) % 7; return a.plan.jours[j].diner.recette; })()")
    print("Ce soir :", nom)
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("JAICA OK")
    nav.close()
