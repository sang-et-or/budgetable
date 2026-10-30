# Entrée et dessert dans les repas de la semaine, reliés à la page Gourmand et à la liste de courses
import re, json
from playwright.sync_api import sync_playwright
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.route("https://upload.wikimedia.org/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(300)
    page.locator("main [data-a=jour-mobile]").nth(1).click(); page.wait_for_timeout(300)   # demain : ce soir peut déjà être passé
    L = lambda: page.evaluate("(() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); return window.Engine.listeCourses(d.plan, d.profil).articles.map(a => a.id); })()")
    avant = set(L())
    # + Entrée sur le premier repas visible
    page.locator("main [data-a=complement-ouvrir][data-k=entree]").first.click(); page.wait_for_timeout(300)
    f = page.locator(".fenetre-complement")
    assert f.count() and "Ajouter une entrée" in f.inner_text()
    idees = f.locator(".titre-complement").all_inner_texts(); print("entrées proposées :", idees[:6])
    plat = page.evaluate("(() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); const jp = d.plan.jours.find(x => x && (x.dejeuner || x.diner)); const m = jp.dejeuner || jp.diner; return window.Engine.REC[m.recette].nom; })()")
    print("plat :", plat)
    if re.search("soupe|velout", plat, re.I): assert not re.search("soupe|velout", idees[0], re.I), "pas de soupe avant une soupe"
    assert len(idees) >= 4
    # pas d'entrée hors saison (melon en octobre)
    mois = page.evaluate("new Date().getMonth() + 1")
    if mois in (10, 11, 12, 1, 2): assert "Melon" not in idees and "Gaspacho" not in idees
    f.locator("[data-a=complement-filtre][data-k=chaud]").click(); page.wait_for_timeout(200)
    chaudes = page.locator(".fenetre-complement .titre-complement").all_inner_texts(); print("chaudes :", chaudes)
    assert chaudes and all(("Velouté" in x or "Soupe" in x or "quiche" in x.lower()) for x in chaudes)
    page.locator(".fenetre-complement [data-a=complement-choisir]").first.click(); page.wait_for_timeout(300)
    carte = page.locator("main .complements").first.inner_text(); print("carte :", carte.replace("\n", " | "))
    assert "Entrée" in carte
    # + Dessert
    page.locator("main [data-a=complement-ouvrir][data-k=dessert]").first.click(); page.wait_for_timeout(300)
    page.locator(".fenetre-complement [data-a=complement-choisir]").first.click(); page.wait_for_timeout(300)
    carte = page.locator("main .complements").first.inner_text()
    assert "Dessert" in carte and "+ Entrée" not in carte and "+ Dessert" not in carte
    d = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    comp = [g for jp in d["plan"]["jours"] for g in (jp.get("gourmand") or []) if g.get("slot")]
    assert len(comp) == 2 and {g["moment"] for g in comp} == {"entree", "dessert"} and all(g["portions"] >= 1 for g in comp)
    apres = set(L()); print("nouveaux articles de courses :", sorted(apres - avant))
    assert apres - avant, "les ingrédients de l'entrée et du dessert sont dans la liste de courses"
    # la fiche d'une entrée s'ouvre
    page.locator("main .complement [data-a=fiche-g]").first.click(); page.wait_for_timeout(300)
    assert page.locator(".voile .fiche h2").count(); page.locator(".voile [data-a=fermer]").first.click(); page.wait_for_timeout(200)
    page.screenshot(path="/tmp/claude-0/complements.png")
    # menu envoyé et affiche du frigo : l'entrée et le dessert y figurent
    page.locator("main [data-a=envoi-ouvrir][data-k=menu]:visible").first.click(); page.wait_for_timeout(300)
    t = page.inner_text("body"); assert "Oups" not in t
    liens = " ".join(page.locator(".fenetre-envoi a[href]").evaluate_all("l => l.map(a => decodeURIComponent(a.getAttribute('href')))"))
    assert "en dessert" in liens, liens[:300]
    page.keyboard.press("Escape"); page.evaluate("document.querySelector('[data-a=envoi-fermer]') && document.querySelector('[data-a=envoi-fermer]').click()"); page.wait_for_timeout(200)
    page.locator("main [data-a=affiche-ouvrir]:visible").first.click(); page.wait_for_timeout(400)
    assert "Oups" not in page.inner_text("body")
    page.evaluate("document.querySelector('[data-a=affiche-fermer]') && document.querySelector('[data-a=affiche-fermer]').click()"); page.wait_for_timeout(200)
    # retirer l'entrée
    page.locator("main .complement [data-a=complement-suppr]").first.click(); page.wait_for_timeout(200)
    assert "+ Entrée" in page.locator("main .complements").first.inner_text()
    # depuis la page Gourmand : filtre Entrées, ajouter au dîner de 2 jours
    page.locator(".nav-plus").click(); page.locator(".fenetre-plus [data-k=gourmand]").click(); page.wait_for_timeout(300)
    page.locator("[data-a=gourmand-filtre][data-k=entree]").click(); page.wait_for_timeout(200)
    page.locator("main [data-a=gourmand-ajouter]").first.click(); page.wait_for_timeout(200)
    assert page.locator("[data-a=gourmand-moment][data-k=entree-diner][aria-checked=true]").count()
    page.locator("[data-a=gourmand-jour]").nth(1).click(); page.locator("[data-a=gourmand-jour]").nth(2).click()
    page.locator("[data-a=gourmand-valider]").click(); page.wait_for_timeout(300)
    d = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    ent_diner = [g for jp in d["plan"]["jours"] for g in (jp.get("gourmand") or []) if g.get("slot") == "diner" and g["moment"] == "entree"]
    assert len(ent_diner) >= 2, ent_diner
    assert "du soir" in page.locator("main .liste-gourmande").inner_text()
    nav.close()
assert not erreurs, erreurs
print("ENTREES DESSERTS OK")
