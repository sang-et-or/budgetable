# Goûts écrits en message (« trop de poêlées ») : pris en compte pour les menus, même sans IA
from playwright.sync_api import sync_playwright
erreurs = []
etat = lambda page: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
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
    clic("Voir mon profil"); page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(500)
    # le test de goût avait fait aimer les poêlées
    page.evaluate("() => { const s = JSON.parse(localStorage.getItem('budgetable.v1')); s.profil.gouts = { ing: {}, cuisine: {}, modele: { poelee: 4 }, plat: {} }; localStorage.setItem('budgetable.v1', JSON.stringify(s)); }")
    page.reload(); page.wait_for_timeout(400)
    page.locator("nav.nav button[data-k=profil]").click(); page.wait_for_timeout(1500)
    page.fill("#ia-texte", "Il y a trop de poêlées dans mes menus")
    page.locator("[data-a=ia-envoyer]").click(); page.wait_for_timeout(600)
    t = page.inner_text("main")
    assert "Pris en compte pour vos menus" in t and "moins de poêlées" in t, t[-800:]
    assert etat(page)["profil"]["gouts"]["modele"]["poelee"] <= -2
    page.locator("main [data-a=refaire-plats]").first.click(); page.wait_for_timeout(1500)
    familles = page.evaluate("() => { const s = JSON.parse(localStorage.getItem('budgetable.v1')); return s.plan.jours.flatMap((jp) => ['dejeuner', 'diner'].map((sl) => jp[sl] && !jp[sl].deRestes && Engine.REC[jp[sl].recette].modele)).filter(Boolean); }")
    print("familles après « Refaire » :", familles)
    assert familles.count("poelee") <= 1
    assert etat(page)["onglet"] == "semaine"
    # écrit au coach : pris en compte aussi
    page.locator(".fab-coach").click(); page.wait_for_timeout(300)
    page.fill("#coach-chat-texte", "pas de champignons s'il vous plaît"); page.locator(".chat-saisie button[type=submit]").click(); page.wait_for_timeout(1200)
    assert etat(page)["profil"]["gouts"]["ing"].get("champignon", 0) <= -2.4
    nav.close()
assert not erreurs, erreurs
print("OK goûts en message")
