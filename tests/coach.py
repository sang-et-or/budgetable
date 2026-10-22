# Coachs alimentaires : minceur, sportif, femme 40 ans et + (semaine préparée selon l'objectif).
import sys, re
from playwright.sync_api import sync_playwright
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
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    main = page.locator("main")
    assert "Un coach pour vos menus" in main.inner_text()
    plan_avant = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.map(j=>j.diner&&j.diner.recette).join()")
    main.get_by_role("button", name=re.compile("Sportif")).click()
    f = page.locator(".fenetre-coach")
    assert "protéines" in f.inner_text() and "diététicien" in f.inner_text()
    f.locator("[data-k=femme40]").click()
    assert "calcium" in f.inner_text().lower() and "médecin" in f.inner_text()
    f.locator("[data-k=minceur]").click()
    assert "troubles du comportement alimentaire" in f.inner_text()
    page.screenshot(path=f"{OUT}/co1-choix.png")
    f.get_by_role("button", name=re.compile("Préparer ma semaine avec le coach minceur")).click()
    c = main.locator(".coach-actif")
    t = c.inner_text()
    assert "Coach minceur" in t and "kcal en moyenne par repas" in t and "conseils de la semaine" in t.lower(), t
    kcal = int(re.search(r"(\d+) kcal en moyenne", t).group(1)); assert kcal <= 620, kcal
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.coach") == "minceur"
    page.screenshot(path=f"{OUT}/co2-minceur.png")
    # coach sportif : plus de protéines
    c.get_by_role("button", name="Changer").click()
    page.locator(".fenetre-coach [data-k=sportif]").click()
    page.locator(".fenetre-coach").get_by_role("button", name=re.compile("Préparer ma semaine avec le coach sportif")).click()
    t = main.locator(".coach-actif").inner_text()
    prot = int(re.search(r"(\d+) g de protéines par repas", t).group(1)); assert prot >= 30, t
    # coach famille : les plats des enfants
    main.locator(".coach-actif").get_by_role("button", name="Changer").click()
    page.locator(".fenetre-coach [data-k=famille]").click()
    assert "enfants" in page.locator(".fenetre-coach").inner_text()
    page.locator(".fenetre-coach").get_by_role("button", name=re.compile("Préparer ma semaine avec le coach famille")).click()
    t = main.locator(".coach-actif").inner_text()
    nb = int(re.search(r"(\d+) plats préférés des enfants", t).group(1)); assert nb >= 6, t
    page.screenshot(path=f"{OUT}/co3-famille.png")
    # profil : arrêter
    page.locator("nav button", has_text="Profil").click()
    assert "Coach alimentaire" in main.inner_text()
    clic("Changer de coach")
    clic("Arrêter le coach")
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.coach") is None
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("COACH OK")
    nav.close()
