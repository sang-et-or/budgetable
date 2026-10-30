# « Refaire les plats » : nouveaux plats sur les mêmes jours, repas mangés / dehors / choisis gardés, retour possible
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
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    etat = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    d0 = etat()
    plats = lambda d: [[(jp.get(s) or {}).get("recette") for s in ("dejeuner", "diner")] for jp in d["plan"]["jours"]]
    # un repas « mangé dehors » et un plat choisi à la main
    main = page.locator("main")
    j1 = main.locator(".jour").nth(1)
    j1.locator("[data-a=dehors][data-s=diner]").click()
    j2 = main.locator(".jour").nth(2)
    j2.locator("[data-a=choix][data-s=diner]").click()
    choisi = page.locator(".fenetre-choix .choix-carte [data-a=choisir]").nth(1).get_attribute("data-r")
    page.locator(".fenetre-choix .choix-carte [data-a=choisir]").nth(1).click()
    d1 = etat(); avant = plats(d1)
    jd = int(j1.get_attribute("data-j")); jc = int(j2.get_attribute("data-j"))
    clic("🔄 Refaire les plats")
    d2 = etat(); apres = plats(d2)
    change = sum(1 for a, b in zip(sum(avant, []), sum(apres, [])) if a and b and a != b)
    print("plats changés :", change)
    assert change >= 8
    assert apres[jd][1] == avant[jd][1], "le repas pris dehors a changé"
    assert apres[jc][1] == choisi, "le plat choisi à la main a changé"
    assert d2["planDu"] == d1["planDu"], "les jours ont changé"
    ids = [x for x in sum(apres, []) if x]; assert len(ids) == len(set(ids)), "plat en double"
    assert main.locator(".bandeau-refaire").count() == 1
    page.screenshot(path=f"{OUT}/refaire.png")
    # revenir aux plats d'avant
    page.get_by_role("button", name="Revenir aux plats d’avant").click()
    assert plats(etat()) == avant
    # sur téléphone, le bouton est là aussi
    page.set_viewport_size({"width": 390, "height": 844}); page.reload()
    assert page.locator("main [data-a=refaire-plats]").count() >= 1
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("REFAIRE PLATS OK")
    nav.close()
