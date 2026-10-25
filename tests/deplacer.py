# « Déplacer » un plat : échange avec le plat du jour choisi, jours passés et repas mangés bloqués
import sys, re
from playwright.sync_api import sync_playwright
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
    etat = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours")
    main = page.locator("main")
    j1 = main.locator(".jour").nth(1); a = int(j1.get_attribute("data-j"))
    j3 = main.locator(".jour").nth(3); b = int(j3.get_attribute("data-j"))
    av = etat(); ra, rb = av[a]["diner"]["recette"], av[b]["dejeuner"]["recette"]
    j1.locator("[data-a=deplacer][data-s=diner]").click()
    f = page.locator(".fenetre-deplacer")
    assert f.count() == 1
    f.screenshot(path=f"{OUT}/deplacer.png")
    # le créneau d'origine est désactivé
    assert f.locator(f"[data-a=deplacer-vers][data-j='{a}'][data-s=diner]").is_disabled()
    f.locator(f"[data-a=deplacer-vers][data-j='{b}'][data-s=dejeuner]").click()
    ap = etat()
    assert ap[b]["dejeuner"]["recette"] == ra and ap[a]["diner"]["recette"] == rb, "pas échangé"
    # un repas noté « mangé dehors » ne peut pas recevoir de plat
    main.locator(".jour").nth(2).locator("[data-a=dehors][data-s=diner]").click()
    c = int(main.locator(".jour").nth(2).get_attribute("data-j"))
    main.locator(".jour").nth(4).locator("[data-a=deplacer][data-s=diner]").click()
    assert page.locator(f".fenetre-deplacer [data-a=deplacer-vers][data-j='{c}'][data-s=diner]").is_disabled()
    page.keyboard.press("Escape"); assert page.locator(".fenetre-deplacer").count() == 0
    # téléphone : dans le menu « ⋯ »
    page.set_viewport_size({"width": 390, "height": 844}); page.reload()
    page.locator("main [data-a=repas-plus]").first.click()
    assert page.locator("main [data-a=deplacer]").count() >= 1
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("DEPLACER OK")
    nav.close()
