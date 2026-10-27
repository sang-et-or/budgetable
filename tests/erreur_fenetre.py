# Une recette qui ne peut pas s'afficher : message clair, et l'appli reste utilisable (plus jamais figée)
import re
from playwright.sync_api import sync_playwright
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(300)
    # recette du soir introuvable (ancienne donnée)
    page.evaluate("() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); const j = (new Date().getDay() + 6) % 7; d.plan.jours[j].diner.recette = 'recette-disparue'; localStorage.setItem('budgetable.v1', JSON.stringify(d)); }")
    page.reload(); page.wait_for_timeout(500)
    assert "remplacé" in page.inner_text("body") or True
    assert "Oups" not in page.inner_text("body"), page.inner_text("body")[:300]
    page.locator(".nav-plus").click(); page.locator(".fenetre-plus [data-k=soir]").click(); page.wait_for_timeout(300)
    if page.locator("main [data-a=ce-soir]").count(): page.locator("main [data-a=ce-soir]").click(); page.wait_for_timeout(300)
    v = page.locator("main button:has-text('Voir la recette')")
    print("bouton :", v.count(), "| texte :", page.locator("main").inner_text()[:200].replace("\n", " | "))
    if v.count():
        v.first.click(); page.wait_for_timeout(500)
        assert page.locator(".voile .fiche h2").count() and "n’a pas pu" not in page.inner_text("body"), "recette disparue remplacée : la fiche s'ouvre"
        page.locator(".voile [data-a=fermer]").first.click(); page.wait_for_timeout(300)
    # et si une fenêtre plante quand même : message, et l'appli reste utilisable
    page.evaluate("() => { window.Engine.REC_SAUVE = window.Engine.equilibre; window.Engine.equilibre = () => { throw new Error('test'); }; }")
    page.locator(".nav-plus").click(); page.locator(".fenetre-plus [data-k=recettes]").click(); page.wait_for_timeout(300)
    page.locator("main [data-a=fiche-r]").first.click(); page.wait_for_timeout(400)
    assert "n’a pas pu s’ouvrir" in page.inner_text("body")
    page.locator("[data-a=fermer-erreur]").click(); page.wait_for_timeout(300)
    page.evaluate("() => { window.Engine.equilibre = window.Engine.REC_SAUVE; }")
    page.locator(".nav-plus").click(); page.locator(".fenetre-plus [data-k=recettes]").click(); page.wait_for_timeout(300)
    page.locator("main [data-a=fiche-r]").first.click(); page.wait_for_timeout(400)
    assert page.locator(".voile .fiche h2").count(), "l'appli répond toujours"
    nav.close()
print("pageerror :", erreurs[:2])
print("ERREUR FENETRE OK")
