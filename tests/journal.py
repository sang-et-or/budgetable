# Page « Mon journal » : jours, smileys, filtres, recherche, suppression, export.
import sys, re
from playwright.sync_api import sync_playwright

def aller(page, k):
    """Ouvre un onglet : bouton de la navigation s'il est visible, sinon via « Plus » (téléphone)."""
    b = page.locator(f"nav.nav button[data-k={k}]")
    if b.is_visible(): b.click()
    else: page.locator(".nav-plus").click(); page.locator(f".fenetre-plus [data-k={k}]").click()

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 1280, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    aller(page, 'journal')
    assert "Rien à afficher" in page.inner_text("main")
    page.evaluate("""() => { const a = JSON.parse(localStorage.getItem('budgetable.v1'));
      const recs = a.plan.jours.flatMap(j => [j.dejeuner, j.diner]).filter(Boolean).map(m => m.recette);
      const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      a.journal = []; a.ajouts = [];
      for (let k = 0; k < 10; k++) { const d = new Date(); d.setDate(d.getDate() - k); const di = iso(d);
        a.journal.push({ d: di, s: 'dejeuner', r: recs[k % recs.length] });
        a.ajouts.push({ d: di, a: 'croissant', n: 1, m: 'petitdej' }, { d: di, a: 'cafe_lait', n: 1, m: 'boisson' });
        if (k % 3 === 0) a.ajouts.push({ d: di, a: 'soda', n: 3, m: 'boisson' }); }
      localStorage.setItem('budgetable.v1', JSON.stringify(a)); }""")
    page.reload(); aller(page, 'journal')
    main = page.locator("main")
    assert main.locator(".jour-journal").count() == 10
    t = main.inner_text()
    tl = t.lower(); assert "petit-déjeuner" in tl and "déjeuner" in tl and "boissons" in tl and "😟" in t
    page.screenshot(path=f"{OUT}/jo1.png")
    # filtre et recherche
    main.locator("[data-a=journal-filtre][data-k=boisson]").click()
    assert "10" in main.locator("[data-a=journal-filtre][data-k=petitdej]").inner_text()
    assert main.locator("[data-a=journal-filtre][data-k=dehors]").count() == 0, "filtre sans entrée proposé"
    assert "Croissant" not in main.locator("#journal-jours").inner_text()
    main.locator("[data-a=journal-filtre][data-k=tout]").click()
    # suggestions : un clic filtre sur l'aliment
    main.locator("[data-a=journal-suggestion]", has_text="Soda").click()
    assert main.locator(".jour-journal").count() == 4
    main.locator("[data-a=journal-humeur][data-k=rouge]").click()
    assert main.locator(".jour-journal").count() >= 1
    clic("Effacer les filtres")
    assert main.locator(".jour-journal").count() == 10
    page.fill("#journal-cherche", "soda")
    assert main.locator(".jour-journal").count() == 4, main.locator(".jour-journal").count()
    page.fill("#journal-cherche", "")
    # suppression d'un aliment
    n0 = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).ajouts.length")
    main.locator(".jour-journal").first.get_by_role("button", name=re.compile("Retirer Croissant")).click()
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).ajouts.length") == n0 - 1
    # export
    lien = main.get_by_role("link", name=re.compile("Télécharger"))
    assert lien.get_attribute("download") == "budgetable-journal.csv" and "Croissant" in __import__("urllib.parse").parse.unquote(lien.get_attribute("href"))
    # ajouter un aliment à un jour passé
    main.locator(".jour-journal").nth(2).get_by_role("button", name="+ Ajouter un aliment à ce jour").click()
    assert "Aujourd’hui" not in page.locator(".carnet h2").first.inner_text()
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("JOURNAL OK")
    nav.close()
