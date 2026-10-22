# Placard : ce que j'ai déjà, idées de plats, ranger les courses, repas cuisinés, liste qui déduit le placard.
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    assert page.locator("nav button", has_text="Drives").count() == 0

    # 1. placard vide puis « ce que j'ai déjà »
    page.locator("nav button", has_text="Placard").click()
    main = page.locator("main")
    assert "Votre placard est vide" in main.inner_text()
    for nom in ["+ Pâtes", "+ Courgettes", "+ Œufs"]:
        b = main.get_by_role("button", name=nom, exact=True)
        if not b.count(): b = main.locator(".puce-ajout", has_text=nom[2:5]).first
        b.click()
    page.fill("#stock-cherche", "emment")
    page.locator("#stock-propositions .puce-ajout").first.click()
    txt = main.inner_text()
    assert "Dans mon placard" in txt and "Emmental" in txt and txt.count("Fini") >= 4, txt[:800]
    # − / +
    lp = main.locator(".ligne-stock", has_text="Pâtes").first
    q0 = lp.locator(".num").inner_text()
    lp.get_by_role("button", name=re.compile("^Moins")).click()
    q1 = main.locator(".ligne-stock", has_text="Pâtes").first.locator(".num").inner_text()
    assert q0 != q1, (q0, q1)
    # idées avec ce que j'ai
    assert "Que cuisiner avec ce que j’ai" in main.inner_text()
    idee = main.locator("[data-a=placard-ce-soir]").first
    nom = main.locator(".jour").first.locator(".titre-repas").inner_text()
    page.screenshot(path=f"{OUT}/p1-placard.png", full_page=True)
    idee.click()
    page.locator("nav button", has_text="Ce soir").click()
    if page.get_by_role("button", name="Soulever la cloche").count(): clic("Soulever la cloche")
    assert nom in page.inner_text("main"), (nom, page.inner_text("main")[:600])
    assert "Avec ce que vous avez à la maison" in page.inner_text("main")

    # 2. la liste de courses tient compte du placard
    page.locator("nav button", has_text="Courses").click()
    assert "Au placard" in page.inner_text("main")
    assert page.locator("#mes-drives").count() == 1

    # 3. cocher deux articles achetés puis les ranger
    cases = page.locator("main input[type=checkbox][data-a=cocher]:not([disabled])")
    n = cases.count(); assert n > 3
    cases.nth(0).click(); page.locator("main input[type=checkbox][data-a=cocher]:not([disabled])").nth(1).click()
    page.locator("nav button", has_text="Placard").click()
    assert "2 articles achetés à ranger" in main.inner_text(), main.inner_text()[:400]
    avant = main.locator(".ligne-stock").count()
    clic("Ranger mes courses dans le placard")
    assert "à ranger" not in main.inner_text()
    assert main.locator(".ligne-stock").count() >= avant

    # 4. j'ai cuisiné ce plat (fiche du dîner de ce soir)
    page.locator("nav button", has_text="Semaine").click()
    page.locator("nav button", has_text="Ce soir").click()
    if page.get_by_role("button", name="Soulever la cloche").count(): clic("Soulever la cloche")
    page.locator("main [data-a=fiche][data-s=diner]").first.click()
    b = page.get_by_role("button", name=re.compile("J’ai cuisiné ce plat"))
    assert b.count() == 1
    b.click()
    assert "Cuisiné : déduit de votre placard" in page.locator(".fiche").last.inner_text()
    clic("Fermer")

    # 5. persistance
    page.reload()
    page.locator("nav button", has_text="Placard").click()
    assert main.locator(".ligne-stock").count() >= 3
    page.screenshot(path=f"{OUT}/p2-placard.png", full_page=True)
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("PLACARD OK")
    nav.close()
