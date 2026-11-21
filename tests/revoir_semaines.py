# « Nouvelle semaine » : liste des plats des 6 dernières semaines, à cocher pour les refaire dans la nouvelle semaine.
import sys, re, datetime
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    for nom, vp in [("ordinateur", {"width": 1100, "height": 1000}), ("telephone", {"width": 390, "height": 844})]:
        page = nav.new_page(viewport=vp)
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
        page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
        clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
        clic("🍽️ Tester gratuitement sans compte")
        for _ in range(25):
            if page.get_by_role("button", name="Voir mon profil").count(): break
            clic("Continuer")
        clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
        if page.locator("[data-a=tuto-fin]").count(): page.locator("[data-a=tuto-fin]").first.click()
        auj = datetime.date.today()
        etat = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
        en_cours = {m["recette"] for jp in etat["plan"]["jours"] for sl in ("dejeuner", "diner") if (m := jp.get(sl)) and m.get("recette")}
        # semaines anciennes : une dans l'historique (il y a 2 semaines), une dans le journal seulement (il y a 4 semaines)
        def iso(k): return (auj - datetime.timedelta(days=k)).isoformat()
        etat["historiqueSemaines"] = [{"du": iso(14), "plats": [{"r": "x-inconnu", "j": 0, "s": "diner"}]}]
        vieux = sorted(en_cours)[0]
        etat["journal"] = (etat.get("journal") or []) + [{"d": iso(28), "s": "diner", "r": vieux}, {"d": iso(80), "s": "diner", "r": vieux}]
        page.evaluate("(e) => localStorage.setItem('budgetable.v1', JSON.stringify(e))", etat); page.reload(); page.wait_for_timeout(300)
        page.locator("[data-a=nouvelle]:visible").first.click()
        f = page.locator(".fenetre-nouvelle")
        b = f.locator("[data-a=nouvelle-revoir-ouvrir]")
        assert "Reprendre des plats des 6 dernières semaines" in b.inner_text()
        b.click()
        f = page.locator(".fenetre-nouvelle")
        t = f.inner_text()
        assert "Semaine en cours" in t, t
        assert t.count("Semaine du") == 1, "seule la semaine du journal (il y a 4 semaines) est montrée : ni la semaine sans plat connu, ni celle d'il y a 11 semaines"
        en_cours_cases = f.locator(".revoir-semaine").first.locator("[data-a=nouvelle-revoir]")
        n = en_cours_cases.count(); assert n == len(en_cours), (n, len(en_cours))
        cases = en_cours_cases
        choisis = [cases.nth(0).get_attribute("data-r"), cases.nth(2).get_attribute("data-r")]
        cases.nth(0).check(); cases.nth(2).check()
        f = page.locator(".fenetre-nouvelle")
        assert "2 cochés" in f.inner_text()
        assert f.locator("[data-a=nouvelle-revoir]:checked").count() == 2
        # tout cocher / tout décocher pour une semaine
        f.locator("[data-a=nouvelle-revoir-tout]").first.click()
        assert page.locator(".fenetre-nouvelle .revoir-semaine >> nth=0").locator("[data-a=nouvelle-revoir]:checked").count() == n
        page.locator(".fenetre-nouvelle [data-a=nouvelle-revoir-tout]").first.click()
        assert page.locator(".fenetre-nouvelle [data-a=nouvelle-revoir]:checked").count() == 0
        c = page.locator(".fenetre-nouvelle [data-a=nouvelle-revoir]")
        for r in choisis: page.locator(f".fenetre-nouvelle [data-a=nouvelle-revoir][data-r='{r}']").check()
        page.screenshot(path=f"{OUT}/revoir_semaines_{nom}.png")
        page.locator("[data-a=nouvelle-ok]").click(); page.wait_for_timeout(300)
        etat = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
        nouv = [m["recette"] for jp in etat["plan"]["jours"] for sl in ("dejeuner", "diner") if (m := jp.get(sl)) and m.get("recette") and not m.get("deRestes")]
        for r in choisis: assert r in nouv, (r, nouv)
        assert len(etat["historiqueSemaines"]) >= 1 and etat["historiqueSemaines"][0]["plats"], "l'ancienne semaine est archivée"
        # la semaine qui vient d'être remplacée apparaît dans la liste suivante
        page.locator("[data-a=nouvelle]:visible").first.click()
        page.locator(".fenetre-nouvelle [data-a=nouvelle-revoir-ouvrir]").click()
        t = page.locator(".fenetre-nouvelle").inner_text()
        assert "Semaine en cours" in t and "Semaine du" in t, t
        page.screenshot(path=f"{OUT}/revoir_semaines_2_{nom}.png")
        page.close()
    nav.close()
assert not erreurs, erreurs
print("OK revoir semaines")
