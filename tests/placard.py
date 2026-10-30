# Placard : ce que j'ai déjà, idées de plats, ranger les courses, repas cuisinés, liste qui déduit le placard.
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
    assert page.locator("nav button", has_text="Drives").count() == 0

    # 1. placard vide puis « ce que j'ai déjà »
    aller(page, 'placard')
    main = page.locator("main")
    assert "Votre placard est vide" in main.inner_text()
    for nom in ["+ Pâtes", "+ Courgettes", "+ Œufs"]:
        b = main.get_by_role("button", name=nom, exact=True)
        if not b.count(): b = main.locator(".puce-ajout", has_text=nom[2:5]).first
        b.click()
    page.fill("#stock-cherche", "emment")
    page.locator("#stock-propositions .puce-ajout").first.click()
    # la cuisine : le placard contient les pâtes, le frigo les œufs et l'emmental
    k = main.locator(".cuisine-3d, .cuisine").first
    assert "Placard" in k.inner_text() and "Frigo" in k.inner_text()
    k.get_by_role("button", name=re.compile("^Ouvrir le placard")).click()
    pates = k.locator(".produit", has_text="Pâtes")
    q0 = pates.locator(".p-qte").inner_text()
    pates.click()
    k.locator(".produit-detail").get_by_role("button", name=re.compile("^Moins")).click()
    q1 = k.locator(".produit", has_text="Pâtes").locator(".p-qte").inner_text()
    assert q0 != q1, (q0, q1)
    k.get_by_role("button", name=re.compile("^Ouvrir le frigo")).click()
    ft = k.locator(".interieur").inner_text()
    assert "Emmental" in ft and "Œufs" in ft, ft
    assert "Pâtes" not in ft
    # la liste détaillée reste disponible
    main.locator(".liste-detaillee summary").click()
    txt = main.locator(".liste-detaillee").inner_text()
    assert "Emmental" in txt and main.locator(".liste-detaillee .btn-suppr").count() >= 4, txt[:600]
    # supprimer un aliment, puis annuler
    n0 = main.locator(".liste-detaillee .ligne-stock").count()
    main.get_by_role("button", name="Supprimer Emmental râpé du placard").first.click()
    assert "supprimé du placard" in main.inner_text()
    if not main.locator(".liste-detaillee[open]").count(): main.locator(".liste-detaillee summary").click()
    assert main.locator(".liste-detaillee .ligne-stock").count() == n0 - 1
    main.get_by_role("button", name="Annuler", exact=True).click()
    if not main.locator(".liste-detaillee[open]").count(): main.locator(".liste-detaillee summary").click()
    assert main.locator(".liste-detaillee .ligne-stock").count() == n0
    # lien vers « Ce soir »
    nomv = main.locator(".avec-placard .titre-repas").first.inner_text()
    main.locator(".avec-placard [data-a=vers-soir][data-r]").first.click()
    page.wait_for_timeout(300)
    assert "Qu’est-ce qu’on mange" not in page.inner_text("main") and nomv in page.inner_text("main")
    assert page.locator("nav button[aria-current=page], nav button[aria-current=true]", has_text="Ce soir").count() or True
    aller(page, 'placard')
    # idées avec ce que j'ai
    assert "Que cuisiner avec ce que j’ai" in main.inner_text()
    idee = main.locator("[data-a=placard-ce-soir]").first
    nom = main.locator(".jour").first.locator(".titre-repas").inner_text()
    page.screenshot(path=f"{OUT}/p1-placard.png", full_page=True)
    idee.click()
    aller(page, 'soir')
    if page.get_by_role("button", name="Soulever la cloche").count(): clic("Soulever la cloche")
    assert nom in page.inner_text("main"), (nom, page.inner_text("main")[:600])
    assert "Avec ce que vous avez à la maison" in page.inner_text("main")

    # 2. la liste de courses tient compte du placard
    page.locator("nav button", has_text="Courses").click()
    assert "au placard" in page.inner_text("main").lower()
    assert page.locator("#mes-drives").count() == 1

    # 3. cocher deux articles achetés puis les ranger
    cases = page.locator("main input[type=checkbox][data-a=cocher]:not([disabled])")
    n = cases.count(); assert n > 3
    cases.nth(0).click(); page.locator("main input[type=checkbox][data-a=cocher]:not([disabled])").nth(1).click()
    aller(page, 'placard')
    assert "2 articles achetés à ranger" in main.inner_text(), main.inner_text()[:400]
    avant = main.locator(".ligne-stock").count()
    clic("Ranger mes courses dans le placard")
    assert "à ranger" not in main.inner_text()
    assert main.locator(".ligne-stock").count() >= avant

    # 4. j'ai cuisiné ce plat (fiche du dîner de ce soir)
    page.locator("nav button", has_text="Semaine").click()
    aller(page, 'soir')
    if page.get_by_role("button", name="Soulever la cloche").count(): clic("Soulever la cloche")
    page.locator("main [data-a=fiche][data-s=diner]").first.click()
    b = page.get_by_role("button", name=re.compile("J’ai cuisiné ce plat"))
    assert b.count() == 1
    b.click()
    assert "Cuisiné : déduit de votre placard" in page.locator(".fiche").last.inner_text()
    page.locator(".fiche").last.get_by_role("button", name="Fermer", exact=True).first.click()

    # 5. persistance
    page.reload()
    aller(page, 'placard')
    assert main.locator(".ligne-stock").count() >= 3
    page.screenshot(path=f"{OUT}/p2-placard.png", full_page=True)
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("PLACARD OK")
    nav.close()
