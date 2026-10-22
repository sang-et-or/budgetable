# Commis intégré (sans IA) : réponses toutes prêtes pour un ingrédient manquant, la cuisson, les restes.
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.fulfill(status=200, content_type="application/json", body='{"disponible":false}', headers={"Access-Control-Allow-Origin": "*"}))
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator(".titre-repas").first.click()
    commis = page.locator(".commis")
    assert "astuces" in commis.inner_text().lower() and "claude" not in commis.inner_text().lower()
    commis.get_by_role("button", name="Comment savoir si c’est cuit ?").click()
    assert commis.locator(".bulle-chat").count() == 2
    page.fill("#chef-texte", "je n'ai pas d'oignon"); page.press("#chef-texte", "Enter")
    page.wait_for_function("document.querySelectorAll('.commis .bulle-chat').length >= 4")
    t = commis.inner_text()
    assert "Pas d’oignons ?" in t, t
    page.fill("#chef-texte", "pour 6 personnes"); page.press("#chef-texte", "Enter")
    page.wait_for_function("document.querySelector('.commis').innerText.includes('Pour 6 personnes')")
    commis.scroll_into_view_if_needed(); page.screenshot(path=f"{OUT}/cl-commis.png")
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("COMMIS LOCAL OK")
    nav.close()
