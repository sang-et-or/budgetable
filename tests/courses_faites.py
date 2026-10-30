# Bouton « Courses faites : tout mettre au placard » et bilan dans le Placard.
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
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    stock = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.stock")
    base = stock()   # provisions de base rangées à la création de la semaine
    page.locator("nav button", has_text="Courses").click()
    a_acheter = page.locator("main input[data-a=cocher]:not([disabled])").count()
    assert a_acheter > 5
    # un seul article coché : on demande ce qui a été rapporté
    page.locator("main input[data-a=cocher]:not([disabled])").first.click()
    clic("✓ Courses faites : tout mettre au placard")
    assert "Qu’avez-vous rapporté ?" in page.inner_text("main")
    page.get_by_role("button", name=re.compile("^Tout a été acheté")).click()
    # on arrive dans le placard avec le bilan
    assert page.locator("nav.nav button[aria-current=page]:visible").inner_text().strip() == "Placard"
    main = page.locator("main")
    bilan = main.locator(".bilan-rangement").inner_text()
    assert "Courses rangées aujourd’hui" in bilan and "produits ajoutés" in bilan, bilan
    n_nouveaux = main.locator(".tag-nouveau").count()
    assert n_nouveaux >= 5, n_nouveaux
    st = stock(); assert len(st) >= 5
    page.screenshot(path=f"{OUT}/cf1-placard.png", full_page=True)
    # la liste n'a plus rien à ranger
    page.locator("nav button", has_text="Courses").click()
    assert "Courses rangées dans le placard" in page.inner_text("main")
    # annuler le rangement
    aller(page, 'placard')
    page.get_by_role("button", name="Annuler ce rangement").click()
    assert stock() == base and main.locator(".bilan-rangement").count() == 0
    # tout est coché maintenant : le bouton range directement
    page.locator("nav button", has_text="Courses").click()
    clic("✓ Courses faites : tout mettre au placard")
    assert len(stock()) == len(st)
    clic("C’est bon")
    assert main.locator(".bilan-rangement").count() == 0 and main.locator(".tag-nouveau").count() == 0
    page.reload(); page.wait_for_timeout(500); aller(page, 'placard'); page.wait_for_timeout(400)
    assert main.locator(".ligne-stock").count() == len(st), (main.locator(".ligne-stock").count(), len(st), page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).onglet"))
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("COURSES FAITES OK")
    nav.close()
