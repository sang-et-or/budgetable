# Test de goût : « Pas pour moi » demande pourquoi, un seul non ne condamne pas un ingrédient, goûts corrigeables
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.locator("[data-a=test-go]").first.click()
    gouts = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.gouts")
    # 1er plat : « Pas pour moi » sans raison → plat écarté, aucun ingrédient dans « moins pour vous »
    clic("Pas pour moi")
    assert page.locator(".pourquoi-non").count() == 1
    page.screenshot(path=f"{OUT}/gout-pourquoi.png")
    clic("Rien de précis, juste ce plat")
    g = gouts(); assert g["plat"] and all(v > -0.9 for v in g["ing"].values()), g
    # 2e plat : non, à cause d'un seul ingrédient (le dernier proposé)
    clic("Pas pour moi")
    puces = page.locator(".pourquoi-non button[data-a=test-raison]")
    k = puces.first.get_attribute("data-k")
    autres = [puces.nth(i).get_attribute("data-k") for i in range(1, puces.count())]
    puces.first.click(); clic("Valider")
    g = gouts(); ing = k.split(":")[1]
    assert g["ing"][ing] <= -2.4, g
    for o in autres:
        t, c = o.split(":")
        if t == "ing": assert g["ing"].get(c, 0) > -0.9, (o, g)
    for _ in range(10): clic("J’adore")
    assert "Merci, vos goûts sont notés" in page.inner_text("body")
    # corriger : l'ingrédient refusé → « J'aime »
    page.locator(f".puce-gout.non button[data-c='{ing}'][data-v=aime]").click()
    assert gouts()["ing"][ing] >= 2.4
    # ajouter un goût par recherche
    page.fill("#gout-cherche", "pois chiche"); page.wait_for_timeout(200)
    page.locator("#gout-propositions button[data-c=pois_chiches][data-v=aime]").click()
    assert gouts()["ing"]["pois_chiches"] >= 2.4
    assert "Pois chiches" in page.locator(".puce-gout.oui").all_inner_texts().__str__()
    page.locator(".bloc-gouts").screenshot(path=f"{OUT}/gout-corriger.png")
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("TEST GOUT OK")
    nav.close()
