# Coach minceur fusionné dans la semaine : assiette sous chaque plat, total du jour, repas libre, retrait de la semaine
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
    page.evaluate("""() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); d.profil.foyer = { adultes: 2, enfants: ['6-10'] }; localStorage.setItem('budgetable.v1', JSON.stringify(d)); }"""); page.reload()
    page.locator("nav button[data-k=minceur]").click()
    choix = lambda cle, k: page.locator(f"[data-a=prog-choix][data-cle={cle}][data-k='{k}']").click()
    champ = lambda k, v: page.locator(f"[data-a=prog-champ][data-k={k}]").fill(v)
    choix("sexe", "h"); champ("age", "45"); champ("taille", "178"); champ("poids", "92"); champ("objectif", "82")
    choix("activite", "1.4"); choix("personnes", "1"); choix("rythme", "douce"); choix("tca", "non")
    page.locator("[data-a=prog-consent]").click(); page.locator("[data-a=prog-lancer]").click()
    page.locator("nav button[data-k=semaine]").click()
    main = page.locator("main")
    assert main.locator(".carte-minceur-semaine").count() == 1
    n = main.locator(".ligne-minceur").count(); print("lignes minceur :", n); assert n >= 10
    assert main.locator(".total-minceur").count() == 7
    assert "Vous" in main.locator(".ligne-minceur").first.inner_text() and "enfants" in main.locator(".ligne-minceur").first.inner_text()
    main.locator(".jour").nth(1).screenshot(path=f"{OUT}/minceur-dans-semaine.png")
    fec = lambda: page.evaluate("""() => { const E = window.Engine, d = JSON.parse(localStorage.getItem('budgetable.v1')); return E.listeCourses(d.plan, d.profil).articles.filter((a) => E.ING[a.id].groupe === 'F' && E.ING[a.id].unite === 'g').reduce((t, a) => t + a.quantite, 0); }""")
    f0 = fec()
    # repas libre : part normale, courses remontées
    main.locator("[data-a=m-libre]").first.click()
    assert "repas libre" in main.locator(".ligne-minceur").first.inner_text()
    f1 = fec(); assert f1 >= f0
    main.locator("[data-a=m-libre]").first.click()
    # ne pas appliquer à la semaine
    page.locator(".carte-minceur-semaine [data-a=m-semaine]").click()
    assert main.locator(".ligne-minceur").count() == 0 and main.locator(".total-minceur").count() == 0
    sans = page.evaluate("""() => { const E = window.Engine, d = JSON.parse(localStorage.getItem('budgetable.v1')); const q = (l) => l.articles.filter((a) => E.ING[a.id].groupe === 'F' && E.ING[a.id].unite === 'g').reduce((t, a) => t + a.quantite, 0); return [q(E.listeCourses(d.plan, d.profil)), q(E.listeCourses(d.plan, { ...d.profil, programme: null }))]; }""")
    assert abs(sans[0] - sans[1]) < 1e-6 and sans[0] > f0, sans
    assert "n’est pas appliqué" in main.inner_text()
    page.get_by_role("button", name="L’ajouter à ma semaine").click()
    assert main.locator(".ligne-minceur").count() == n
    # sur téléphone
    page.set_viewport_size({"width": 390, "height": 844}); page.reload()
    assert page.locator("main .ligne-minceur").count() >= 1
    page.screenshot(path=f"{OUT}/minceur-semaine-mobile.png")
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("MINCEUR SEMAINE OK")
    nav.close()
