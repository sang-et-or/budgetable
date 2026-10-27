# Page Petit-déj (filtres, ajout à la semaine → courses) et produits ajoutés à la main dans la liste
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
    aller(page, 'petitdej')
    assert "Petits-déjeuners" in page.inner_text("main")
    n_tout = page.locator(".grille-gourmande .carte-gourmande").count()
    page.locator("[data-a=pd-filtre][data-k=sportif]").click()
    n_sport = page.locator(".grille-gourmande .carte-gourmande").count()
    print("petits-déj :", n_tout, "dont sportifs :", n_sport); assert n_tout >= 25 and 4 <= n_sport < n_tout
    page.screenshot(path=f"{OUT}/petitdej.png")
    nom = page.locator(".grille-gourmande .carte-gourmande .titre-repas").first.inner_text()
    page.locator(".grille-gourmande [data-a=gourmand-ajouter]").first.click()
    page.locator("[data-a=gourmand-jours][data-k=semaine]").click()
    assert page.locator("[data-a=gourmand-moment]").count() == 0
    page.locator("[data-a=gourmand-valider]").click()
    assert page.locator(".liste-gourmande li").count() == 1 and "Du lundi au vendredi" in page.inner_text(".liste-gourmande")
    # visible dans la semaine, avant le déjeuner, et pas dans Gourmand
    page.locator("nav button[data-k=semaine]").click()
    assert "Petit-déj : " + nom in page.inner_text("main"), nom
    aller(page, 'gourmand')
    assert nom not in page.inner_text("main")
    # courses : ingrédients du petit-déj + ajouts à la main
    page.locator("nav button[data-k=courses]").click()
    total0 = page.locator(".ticket-total").inner_text()
    page.fill("#manuel-cherche", "papier toilette"); page.keyboard.press("Enter")
    page.fill("#manuel-cherche", "parmes"); page.wait_for_timeout(150)
    page.locator("#manuel-propositions [data-a=manuel-ajouter][data-id=parmesan]").click()
    page.locator("#manuel-propositions") if False else None
    txt = page.inner_text(".ticket")
    assert "Papier toilette" in txt and "Parmesan" in txt and "ajouté à la main" in txt, txt[:500]
    assert page.locator(".ticket-total").inner_text() != total0
    # + et retirer
    page.locator("[data-a=manuel-qte][data-id=m-papier-toilette][data-d='1']").click()
    assert "2 × à prendre" in page.inner_text(".ticket").replace("\n", " ")
    page.locator("[data-a=manuel-suppr][data-id=m-papier-toilette]").click()
    assert "Papier toilette" not in page.inner_text(".ticket")
    page.locator(".ajout-courses").screenshot(path=f"{OUT}/ajout-courses.png")
    # gardés après rechargement
    page.reload(); page.locator("nav button[data-k=courses]").click()
    assert "Parmesan" in page.inner_text(".ticket")
    # mobile : accès par la bascule de Gourmand
    page.set_viewport_size({"width": 390, "height": 844})
    aller(page, 'gourmand')
    page.locator(".bascule-g [data-k=petitdej]").click()
    assert "Petits-déjeuners" in page.inner_text("main")
    page.screenshot(path=f"{OUT}/petitdej-mobile.png")
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("PETITDEJ COURSES OK")
    nav.close()
