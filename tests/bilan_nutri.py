# Bilan nutritionnel de la semaine : repères, points à améliorer, mise à jour quand on change un plat.
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
    page = nav.new_page(viewport={"width": 760, "height": 900}, is_mobile=True, has_touch=True)
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
    b = page.locator(".bilan-nutri")
    t = b.inner_text()
    assert "Bilan nutritionnel" in t and re.search(r"\d+/11", t) and "kcal" in t, t
    b.locator("details summary").click()
    d = b.locator("details").inner_text()
    for x in ["Protéines", "Fibres", "Légumes", "Sel", "Graisses saturées", "Sucres", "Viande rouge", "Charcuterie", "Poisson", "Légumineuses", "Laitages"]:
        assert x in d, x
    b.scroll_into_view_if_needed(); page.screenshot(path=f"{OUT}/bn1.png")
    # un dessert ajouté fait monter les sucres
    sucres = lambda: int(re.search(r"Sucres (\d+) g", b.locator("details").inner_text()).group(1))
    s0 = sucres()
    aller(page, 'gourmand')
    page.locator(".carte-gourmande", has_text="Fondant au chocolat").get_by_role("button", name=re.compile("Ajouter")).click()
    for jn in ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven."]: page.locator(".fenetre-gourmand").get_by_role("button", name=jn).click()
    clic("Ajouter à ma semaine et à mes courses")
    page.locator("nav button", has_text="Semaine").click()
    page.locator(".bilan-nutri details summary").click()
    assert sucres() > s0, (s0, sucres())
    assert "desserts ou goûters prévus" in page.locator(".bilan-nutri").inner_text()
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("BILAN NUTRI OK")
    nav.close()
