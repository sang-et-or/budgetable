# Semaine « que des poêlées » (ancienne version) : bandeau, puis « Varier ma semaine » donne des plats variés
from playwright.sync_api import sync_playwright
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
    clic("Voir mon profil"); page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(500)
    # on remplace la semaine par 14 poêlées, comme sur la capture de l'ami
    page.evaluate("""() => { const s = JSON.parse(localStorage.getItem('budgetable.v1'));
      const vus = new Set(), po = Engine.RECETTES.filter((r) => r.modele === 'poelee' && /poivron|petits pois|maïs/.test(r.nom) && !vus.has(r.sig) && vus.add(r.sig));
      let k = 0; s.plan.jours.forEach((jp) => ['dejeuner', 'diner'].forEach((sl) => { if (jp[sl]) jp[sl] = { ...jp[sl], recette: po[(k += 1) % po.length].id }; }));
      localStorage.setItem('budgetable.v1', JSON.stringify(s)); }""")
    page.reload(); page.wait_for_timeout(500)
    print("avant :", page.evaluate("() => JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.flatMap((jp) => ['dejeuner', 'diner'].map((sl) => jp[sl] && Engine.REC[jp[sl].recette].modele))"))
    b = page.locator("main", has_text="Votre semaine manque de variété")
    assert b.count() == 1, (erreurs, page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).vue"), page.inner_text("body")[:300])
    page.get_by_role("button", name="🔄 Varier ma semaine").click(); page.wait_for_timeout(1500)
    fam = page.evaluate("() => JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.flatMap((jp) => ['dejeuner', 'diner'].map((sl) => jp[sl] && !jp[sl].deRestes && Engine.REC[jp[sl].recette].modele)).filter(Boolean)")
    print("après :", fam)
    assert fam.count("poelee") <= 4, fam   # repas déjà passés gardés
    assert "manque de variété" not in page.inner_text("main")
    page.locator("nav.nav button[data-k=profil]").click(); page.wait_for_timeout(300)
    assert "Version de l’appli" in page.inner_text("main")
    nav.close()
assert not erreurs, erreurs
print("OK semaine monotone")
