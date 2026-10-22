# « Qui mange cette semaine ? » : raccourcis, réglage repas par repas, portions et courses mises à jour.
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 760, "height": 900}, is_mobile=True, has_touch=True)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
    # foyer : 2 adultes et 2 enfants, posé directement dans le profil enregistré
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.evaluate("""() => { const a = JSON.parse(localStorage.getItem('budgetable.v1')); a.profil.foyer = { adultes: 2, enfants: ['6-10', '3-5'] }; a.profil.prenomsEnfants = ['Léa', 'Tom']; localStorage.setItem('budgetable.v1', JSON.stringify(a)); }""")
    page.reload()
    clic("Nouvelle semaine")
    etat = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    main = page.locator("main")
    pres = main.locator(".presences")
    assert "Qui mange cette semaine ?" in pres.inner_text()
    assert pres.locator(".cellule-presence").count() == 14
    portions_lundi_midi = etat()["plan"]["jours"][0]["dejeuner"]["portions"]
    # raccourci : enfants à la cantine
    pres.get_by_role("button", name="Enfants à la cantine le midi").click()
    j = etat()["plan"]["jours"]
    assert j[0]["dejeuner"]["portions"] < portions_lundi_midi and j[2]["dejeuner"]["portions"] == portions_lundi_midi, (j[0]["dejeuner"], j[2]["dejeuner"])
    # invités ce week-end
    total_avant = page.evaluate("() => 0")
    pres.get_by_role("button", name="+2 invités ce week-end").click()
    assert "+2" in pres.locator("[data-k='5-diner']").inner_text()
    # réglage d'un repas : personne mardi soir
    pres.locator("[data-k='1-diner']").click()
    f = page.locator(".fenetre-presence")
    assert "Léa" in f.inner_text() and "Tom" in f.inner_text()
    f.get_by_role("button", name="Personne : repas dehors").click()
    assert etat()["plan"]["jours"][1]["diner"] is None
    assert "Personne" in page.locator("[data-k='1-diner']").inner_text()
    # le repas revient avec son plat
    page.locator(".fenetre-presence").get_by_role("button", name="Adultes du foyer : un de plus").click()
    d = etat()["plan"]["jours"][1]["diner"]
    assert d and d["portions"] > 0, d
    page.locator(".fenetre-presence").get_by_role("button", name=re.compile("^✓? ?Léa")).click()
    page.screenshot(path=f"{OUT}/pr1-edition.png")
    clic("OK")
    page.screenshot(path=f"{OUT}/pr2-grille.png", full_page=False)
    # garder pour les semaines suivantes
    pres.locator("input[data-a=presences-garder]").check()
    assert etat()["profil"]["presences"]["0-dejeuner"]["e"] == [False, False]
    clic("Nouvelle semaine")
    j = etat()["plan"]["jours"]
    assert j[0]["dejeuner"]["portions"] < j[2]["dejeuner"]["portions"], "habitudes non reprises"
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("PRESENCES OK")
    nav.close()
