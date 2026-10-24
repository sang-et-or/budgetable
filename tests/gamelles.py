# Semaine : gamelles du midi, restes et quantités des recettes
import sys, re, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
etat = lambda page: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 760, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    # ce test suppose une semaine qui commence le lundi : on la cale sur le lundi de cette semaine
    page.evaluate("() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); const x = new Date(); x.setDate(x.getDate() - (x.getDay() + 6) % 7); d.planDu = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); localStorage.setItem('budgetable.v1', JSON.stringify(d)); }"); page.reload()
    main = page.locator("main")
    total0 = page.evaluate("Engine.listeCourses(JSON.parse(localStorage.getItem('budgetable.v1')).plan, JSON.parse(localStorage.getItem('budgetable.v1')).profil).total")
    clic("Prévoir mes gamelles")
    f = page.locator(".fenetre-gamelles")
    assert "Mes gamelles du midi" in f.inner_text()
    f.get_by_role("button", name="Une gamelle de plus").click()   # 2 gamelles
    s = etat(page)
    assert s["profil"]["gamelles"]["n"] == 2
    J = s["plan"]["jours"]
    # mardi : restes du dîner de lundi, lundi soir cuisiné en plus
    assert J[1]["gamelles"]["mode"] == "restes" and J[1]["gamelles"]["source"] == 0, J[1].get("gamelles")
    assert J[0]["diner"].get("plus", 0) >= 2, J[0]["diner"]
    assert J[0]["gamelles"]["mode"] == "plat"
    assert "J[5]" or True
    assert not J[5].get("gamelles")
    page.screenshot(path=f"{OUT}/g1.png")
    # un jour sans gamelle
    f.locator("[data-a=gamelle-jour-mode][data-j='3'][data-k=non]").click()
    s = etat(page); assert s["plan"]["jours"][3]["gamelles"]["n"] == 0 and not s["plan"]["jours"][2]["diner"].get("plus")
    f.locator("[data-a=gamelle-jour-mode][data-j='3'][data-k=restes]").click()
    # un autre plat pour lundi
    r0 = etat(page)["plan"]["jours"][0]["gamelleRecette"]
    f.get_by_role("button", name="Un autre plat").first.click()
    assert etat(page)["plan"]["jours"][0]["gamelleRecette"] != r0
    clic("C’est réglé")
    assert "Gamelles du midi" in main.inner_text()
    total1 = page.evaluate("Engine.listeCourses(JSON.parse(localStorage.getItem('budgetable.v1')).plan, JSON.parse(localStorage.getItem('budgetable.v1')).profil).total")
    print("Total courses :", total0, "→", total1)
    assert total1 > 0
    # la carte du lundi soir indique les portions en plus
    lundi = main.locator(".jour").first
    assert "+" in lundi.locator(".plus-restes").first.inner_text()
    # fiche du lundi soir : quantités et restes
    lundi.locator("[data-a=fiche][data-s=diner]").click()
    fi = page.locator(".fiche").last
    t = fi.inner_text(); assert "Quantités et restes" in t and "gamelle" in t, t[:800]
    tot = etat(page)["plan"]["jours"][0]["diner"]
    a_cuire = tot["portions"] + tot.get("plus", 0)
    assert re.search(r"pour %s portions" % re.escape(str(a_cuire).rstrip('0').rstrip('.').replace('.', ',')), fi.inner_text()), fi.inner_text()[:900]
    # restes au congélateur
    fi.get_by_role("button", name="Pour le congélateur").click()
    fi.get_by_role("button", name="Portions à congeler : plus").click()
    d = etat(page)["plan"]["jours"][0]["diner"]; assert d["restes"] == {"vers": "congel", "n": 3} and d["extra"]["congel"] == 3, d
    # restes pour demain midi (le déjeuner de mardi devient « restes » s'il y en a un)
    fi.get_by_role("button", name="Portions à table : plus").click()
    d = etat(page)["plan"]["jours"][0]["diner"]; assert d["manuel"] and d["portions"] >= 2
    fi.screenshot(path=f"{OUT}/g2.png")
    fi.get_by_role("button", name="Fermer", exact=True).first.click()
    # samedi soir → restes pour dimanche midi
    sam = main.locator(".jour").nth(5)
    sam.locator("[data-a=fiche][data-s=diner]").click()
    fi = page.locator(".fiche").last
    fi.get_by_role("button", name="Pour le déjeuner de demain").click()
    s = etat(page); dim = s["plan"]["jours"][6]["dejeuner"]
    assert dim["deRestes"] and dim["recette"] == s["plan"]["jours"][5]["diner"]["recette"], dim
    fi.get_by_role("button", name="Fermer", exact=True).first.click()
    assert "restes d’hier soir" in main.locator(".jour").nth(6).inner_text()
    page.screenshot(path=f"{OUT}/g3.png", full_page=False)
    main.locator(".jour").nth(5).scroll_into_view_if_needed(); page.screenshot(path=f"{OUT}/g4.png")
    # annuler : le déjeuner de dimanche revient
    main.locator(".jour").nth(5).locator("[data-a=fiche][data-s=diner]").click()
    page.locator(".fiche").last.get_by_role("button", name="Non", exact=True).click()
    assert not etat(page)["plan"]["jours"][6]["dejeuner"].get("deRestes")
    page.locator(".fiche").last.get_by_role("button", name="Fermer", exact=True).first.click()
    # fiche d'une gamelle « plat » : nombre de portions = gamelles
    main.locator(".jour").first.locator("[data-a=gamelle-fiche]").first.click()
    assert "Nombre de portions" in page.locator(".fiche").last.inner_text()
    page.locator(".fiche").last.get_by_role("button", name="Fermer", exact=True).first.click()
    # l'affiche montre les gamelles
    page.get_by_role("button", name=re.compile("Menu à afficher")).click()
    assert "gamelle" in page.locator(".affiche").inner_text()
    page.keyboard.press("Escape")
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("GAMELLES OK")
    nav.close()
