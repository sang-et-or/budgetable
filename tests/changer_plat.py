# « Changer ce plat » : 5 idées + le plat prévu, filtres (de saison, rapide, végétarien…), encore d'autres idées sans répétition
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 1200, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("main [data-a=choix]").first.click()
    f = page.locator(".fenetre-choix")
    assert f.locator(".choix-carte").count() == 6, f.locator(".choix-carte").count()
    vus = set(f.locator(".choix-carte h3").all_inner_texts()[1:])
    f.screenshot(path=f"{OUT}/changer-plat.png")
    f.locator("[data-a=autres-idees]").click()
    nouveaux = set(f.locator(".choix-carte h3").all_inner_texts()[1:])
    assert len(nouveaux) == 5 and not (vus & nouveaux)
    # filtre végétarien
    f.locator("[data-a=choix-filtre][data-k=vege]").click()
    ids = [b.get_attribute("data-r") for b in f.locator(".choix-carte [data-a=choisir]").all()][1:]
    viande = page.evaluate("ids => ids.filter((id) => { const E = window.Engine, r = E.REC[id]; return E.contientViande(r) || r.ing.some(([i]) => (E.ING[i].tags || []).includes('poisson')); })", ids)
    assert len(ids) >= 3 and not viande, (ids, viande)
    # filtre rapide
    f.locator("[data-a=choix-filtre][data-k=rapide]").click()
    t = page.evaluate("ids => ids.map((id) => window.Engine.REC[id].temps)", [b.get_attribute("data-r") for b in f.locator(".choix-carte [data-a=choisir]").all()][1:])
    assert t and max(t) <= 20, t
    # de saison : pas de légume frais hors saison
    f.locator("[data-a=choix-filtre][data-k=saison]").click()
    hors = page.evaluate("ids => ids.filter((id) => window.Engine.saisonRecette(window.Engine.REC[id]).hors.length)", [b.get_attribute("data-r") for b in f.locator(".choix-carte [data-a=choisir]").all()][1:])
    assert not hors, hors
    # choisir une idée
    nom = f.locator(".choix-carte h3").nth(1).inner_text()
    f.locator(".choix-carte [data-a=choisir]").nth(1).click()
    assert nom in page.inner_text("main")
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("CHANGER PLAT OK")
    nav.close()
