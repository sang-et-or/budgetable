# Page « Mes apports » : suivi réel (repas marqués mangés), graphiques, journal.
import sys, re, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8766/index.html"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    for largeur in [1280, 390]:
        page = nav.new_page(viewport={"width": largeur, "height": 900})
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
        page.goto(URL); page.evaluate("localStorage.clear()"); page.reload()
        clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
        clic("Préparer ma semaine")
        for _ in range(25):
            if page.get_by_role("button", name="Voir mon profil").count(): break
            clic("Continuer")
        clic("Voir mon profil")
        page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
        # un historique de 20 jours, tiré des recettes de la semaine
        page.evaluate("""() => { const a = JSON.parse(localStorage.getItem('budgetable.v1'));
          const recs = a.plan.jours.flatMap(j => [j.dejeuner, j.diner]).filter(Boolean).map(m => m.recette);
          const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          a.journal = []; for (let k = 1; k <= 20; k++) { const d = new Date(); d.setDate(d.getDate() - k); if (k % 6 === 0) continue;
            a.journal.push({ d: iso(d), s: 'dejeuner', r: recs[k % recs.length] }); if (k % 3) a.journal.push({ d: iso(d), s: 'diner', r: recs[(k + 3) % recs.length] }); }
          localStorage.setItem('budgetable.v1', JSON.stringify(a)); }""")
        page.reload()
        if largeur > 900:
            page.locator("nav button", has_text="Apports").click()
        else:
            assert not page.locator("nav button", has_text="Apports").is_visible()
            page.locator("[data-a=outil-mobile][data-k=nutrition]").click()
            page.get_by_role("button", name=re.compile("Mon suivi des apports")).first.click()
        main = page.locator("main")
        assert "Mes apports" in main.inner_text()
        assert main.locator(".tuile-apport").count() == 6
        assert main.locator(".graphe").count() >= 6
        assert re.search(r"\d+ repas notés", main.inner_text())
        # marquer un repas mangé depuis la semaine : il entre dans le journal du jour
        n0 = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).journal.length")
        page.locator("nav button", has_text="Semaine").click()
        page.locator(".jour").first.get_by_role("button", name="✓ C’est mangé").first.click()
        ok = page.evaluate("""() => { const a = JSON.parse(localStorage.getItem('budgetable.v1')); const r = a.plan.jours[0].dejeuner.recette; return a.journal.filter(x => x.s === 'dejeuner' && x.r === r).length >= 1 && a.journal.length >= """ + str(n0) + """; }""")
        assert ok
        page.get_by_role("button", name=re.compile("Mon suivi des apports")).first.click()
        page.get_by_role("radio", name="30 derniers jours").click()
        assert main.locator(".graphe").first.locator(".barre").count() == 30
        # info-bulle
        main.locator(".graphe .barre").nth(25).hover()
        assert page.locator("#bulle-graphe").is_visible() and "kcal" in page.locator("#bulle-graphe").inner_text() or "aucun repas" in page.locator("#bulle-graphe").inner_text()
        main.get_by_role("button", name="Ouvrir le journal").click()
        assert "Mon journal" in main.inner_text() and main.locator(".jour-journal").count() >= 10
        page.screenshot(path=f"{OUT}/ap-{largeur}.png", full_page=True)
        page.close()
    print("Erreurs JS :", erreurs or "aucune")
    assert not erreurs
    print("APPORTS OK")
    nav.close()
