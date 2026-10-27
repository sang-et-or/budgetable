# Grignotages gourmands : catalogue de desserts et goûters, ajout à la semaine et aux courses, recette perso.
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
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    assert page.locator("nav button").count() >= 7
    aller(page, 'gourmand')
    main = page.locator("main")
    assert "Grignotages gourmands" in main.inner_text()
    n = main.locator(".carte-gourmande").count(); assert n >= 25, n
    # filtre goûters
    main.get_by_role("button", name="Goûters", exact=True).click()
    assert "Fondant au chocolat" not in main.inner_text() and "Gâteau au yaourt" in main.inner_text()
    page.screenshot(path=f"{OUT}/g1-liste.png", full_page=False)
    # ajouter le gâteau au yaourt le mercredi et le samedi
    total_avant = None
    page.locator("nav button", has_text="Courses").click()
    total_avant = page.locator(".ticket-total .num").inner_text()
    aller(page, 'gourmand')
    main.locator(".carte-gourmande", has_text="Gâteau au yaourt").get_by_role("button", name=re.compile("Ajouter à ma semaine")).click()
    f = page.locator(".fenetre-gourmand")
    assert f.get_by_role("button", name="Ajouter à ma semaine et à mes courses").is_disabled()
    f.get_by_role("button", name="Mer.").click(); f.get_by_role("button", name="Sam.").click()
    assert "2 fois" in f.inner_text()
    page.screenshot(path=f"{OUT}/g2-ajout.png", full_page=False)
    f.get_by_role("button", name="Ajouter à ma semaine et à mes courses").click()
    sem = main.locator(".liste-gourmande").inner_text()
    assert sem.count("Gâteau au yaourt") == 2 and "Mercredi" in sem and "Samedi" in sem, sem
    # la semaine affiche le goûter, la liste de courses contient sucre et levure
    page.locator("nav button", has_text="Semaine").click()
    assert "Goûter : Gâteau au yaourt" in page.locator(".jour").nth(2).inner_text()
    page.locator("nav button", has_text="Courses").click()
    ct = page.inner_text("main")
    assert "Sucre en poudre" in ct and "Levure chimique" in ct, ct[:400]
    assert page.locator(".ticket-total .num").inner_text() != total_avant
    # fiche de la gourmandise
    aller(page, 'gourmand')
    main.locator(".carte-gourmande", has_text="Crêpes").locator(".titre-repas").click()
    fiche = page.locator(".fiche").last
    assert "Préparation" in fiche.inner_text() and "8 parts" in fiche.inner_text(), fiche.inner_text()[:300]
    clic("Fermer")
    # retirer
    main.locator(".liste-gourmande li").first.get_by_role("button", name=re.compile("^Retirer")).click()
    assert main.locator(".liste-gourmande li").count() == 1
    # recette perso
    clic("+ Ajouter un dessert ou un goûter")
    ed = page.locator(".fenetre-edition")
    assert "Ajouter un dessert ou un goûter" in ed.inner_text()
    page.fill("#ed-nom", "Gâteau au chocolat de mamie")
    clic("Trouver les ingrédients")
    txt = ed.locator(".dans-recette").inner_text()
    assert "Chocolat noir pâtissier" in txt or "Sucre en poudre" in txt, txt
    ed.locator("select[data-k=type]").select_option("dessert")
    clic("Enregistrer dans mes gourmandises")
    assert "Gâteau au chocolat de mamie" in main.inner_text()
    assert main.get_by_role("button", name="Les miennes").count() == 1
    # persistance
    page.reload(); aller(page, 'gourmand')
    assert "Gâteau au chocolat de mamie" in main.inner_text() and main.locator(".liste-gourmande li").count() == 1
    page.screenshot(path=f"{OUT}/g3-perso.png", full_page=True)
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("GOURMAND OK")
    nav.close()
