# Semaine sur téléphone : un jour à la fois, outils repliés, actions secondaires derrière « ⋯ »
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
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    main = page.locator("main")
    assert main.locator(".jour").count() == 1 and main.locator(".jour-puce").count() == 7
    assert main.locator(".jour-puce[aria-selected=true]").count() == 1
    # un autre jour
    main.locator("[data-a=jour-mobile][data-j='0']").click()
    assert "Lundi" in main.locator(".jour").inner_text()
    # actions secondaires
    assert main.locator(".jour [data-a=dehors]").count() == 0
    main.locator("[data-a=repas-plus]").first.click()
    assert main.locator(".jour [data-a=dehors]").count() == 1 and main.locator(".jour [data-a=choix]").count() == 1
    # outils repliés avec résumé
    assert main.locator(".outil-m").count() == 6 and main.locator(".presences").count() == 0
    main.locator("[data-a=outil-mobile][data-k=presences]").click()
    assert main.locator(".presences").count() == 1
    main.locator("[data-a=outil-mobile][data-k=presences]").click()
    assert main.locator(".presences").count() == 0
    # toute la semaine
    clic("Toute la semaine")
    assert main.locator(".jour").count() == 7
    # sur ordinateur, rien ne change
    page.set_viewport_size({"width": 1280, "height": 900}); page.wait_for_timeout(300)
    assert main.locator(".jour").count() == 7 and main.locator(".presences").count() == 1
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("SEMAINE MOBILE OK")
    nav.close()
