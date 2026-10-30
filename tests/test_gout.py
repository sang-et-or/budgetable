# Test de goût en 3 étapes : aliments (j'adore / ça va / non merci), cuisines et types de plats, plats choisis selon les réponses ;
# les aliments refusés ne reviennent plus dans les menus ; « Pas pour moi » demande pourquoi ; goûts corrigeables
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 1000, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.locator("[data-a=test-go]").first.click()
    # étape 1 : les aliments
    assert "Les aliments" in page.inner_text("body")
    tuile = lambda k, v: page.locator(f"[data-a=gout-tuile][data-k={k}][data-v={v}]").click()
    tuile("pois_chiches", "adore"); tuile("poulet", "adore"); tuile("aubergine", "non"); tuile("champignon", "non"); tuile("lentilles", "non")
    page.screenshot(path=f"{OUT}/gout-aliments.png", full_page=True)
    page.locator("[data-a=test-etape][data-k=styles]").click()
    # étape 2 : cuisines, plats, épices
    page.locator("[data-a=gout-style][data-cle=modeles][data-k=curry][data-v=adore]").click()
    page.locator("[data-a=gout-style][data-cle=modeles][data-k=veloute][data-v=non]").click()
    page.locator("[data-a=gout-style][data-cle=cuisines][data-k=asiatique][data-v=adore]").click()
    page.locator("[data-a=gout-epice][data-v='1.5']").click()
    page.screenshot(path=f"{OUT}/gout-styles.png", full_page=True)
    page.locator("[data-a=test-etape][data-k=plats]").click()
    g = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.gouts")
    assert g["ing"]["pois_chiches"] >= 2.4 and g["ing"]["aubergine"] <= -2.4 and g["ing"]["lentilles_corail"] <= -2.4 and g["modele"]["curry"] > 1 and g["epice"] == 1.5, g
    # étape 3 : les plats proposés ne contiennent rien de refusé
    ids = page.evaluate("() => { const s = JSON.parse(localStorage.getItem('budgetable.v1')); return null; }")
    noms = []
    for k in range(10):
        if page.locator("[data-a=test-rep]").count() == 0: break
        noms.append(page.locator(".carte-test h1").inner_text())
        if k == 1:
            clic("Pas pour moi"); assert page.locator(".pourquoi-non").count() == 1; clic("Rien de précis, juste ce plat")
        else: clic("J’adore" if k % 2 == 0 else "Pourquoi pas")
    print("plats jugés :", noms)
    assert len(noms) >= 8 and not any(re.search(r"aubergine|champignon|lentille", n, re.I) for n in noms), noms
    assert "Merci, vos goûts sont notés" in page.inner_text("body")
    # la semaine créée : pas d'aliment refusé, et la correction reste possible
    clic("Créer ma semaine avec ces goûts")
    r = page.evaluate("""() => { const E = window.Engine, d = JSON.parse(localStorage.getItem('budgetable.v1'));
      const recs = d.plan.jours.flatMap((j) => [j.dejeuner, j.diner]).filter(Boolean).map((m) => E.REC[m.recette]);
      return { refuses: recs.filter((r) => r.ing.some(([id]) => ['aubergine', 'champignon', 'lentilles_corail', 'lentilles_vertes'].includes(id))).map((r) => r.nom), pc: recs.filter((r) => r.ing.some(([id]) => id === 'pois_chiches' || id === 'poulet_filet')).length, n: recs.length }; }""")
    print(r); assert not r["refuses"] and r["pc"] >= 3
    page.locator("nav button[data-k=profil]").click()
    page.fill("#gout-cherche", "aubergine"); page.wait_for_timeout(150)
    page.locator("#gout-propositions button[data-c=aubergine][data-v=aime]").click()
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.gouts.ing.aubergine") >= 2.4
    # refaire le test : les réponses sont pré-remplies
    page.locator("[data-a=test-go]").first.click()
    assert page.locator("[data-a=gout-tuile][data-k=pois_chiches][data-v=adore][aria-checked=true]").count() == 1
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("TEST GOUT OK")
    nav.close()
