# Calories et Nutri-Score estimés : sur les repas de la semaine, la fiche, les gourmandises.
import sys, re
from playwright.sync_api import sync_playwright

def aller(page, k):
    """Ouvre un onglet : bouton de la navigation s'il est visible, sinon via « Plus » (téléphone)."""
    b = page.locator(f"nav.nav button[data-k={k}]")
    if b.is_visible(): b.click()
    else: page.locator(".nav-plus").click(); page.locator(f".fenetre-plus [data-k={k}]").click()

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
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
    jour = page.locator(".jour").first
    assert jour.locator(".nutri-mini").count() == 2, jour.inner_html()[:400]
    assert re.search(r"\d+ kcal", jour.inner_text())
    assert jour.locator(".ns-lettre").first.inner_text() in "ABCDE"
    jour.locator(".titre-repas").first.click()
    f = page.locator(".fiche").last
    b = f.locator(".bloc-nutri")
    assert b.count() == 1 and "par portion adulte" in b.inner_text() and "Protéines" in b.inner_text()
    assert f.locator(".ns-lettres .actif").count() == 1
    b.scroll_into_view_if_needed(); page.screenshot(path=f"{OUT}/n1-fiche.png")
    clic("Fermer")
    aller(page, 'gourmand')
    c = page.locator(".carte-gourmande", has_text="Fondant au chocolat")
    assert c.locator(".ns-lettre").inner_text() in "DE", c.inner_text()
    c.locator(".titre-repas").click()
    assert "par part" in page.locator(".fiche .bloc-nutri").inner_text()
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("NUTRITION OK")
    nav.close()
