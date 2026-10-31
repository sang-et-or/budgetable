# « Nouvelle semaine » alors qu'une semaine existe : on choisit le premier jour, et le ticket de caisse
# de l'ancienne semaine est effacé de l'historique (les tickets plus anciens et les prix appris restent).
import sys, re, json, datetime
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
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
        # un ticket de cette semaine, un ticket plus ancien, et un prix appris
        etat = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
        assert etat["planDu"] == auj.isoformat()
        vieux = (auj - datetime.timedelta(days=12)).isoformat()
        etat["tickets"] = [{"d": auj.isoformat(), "mag": "lidl", "nom": "Lidl", "total": 23.4, "paye": 23.4, "estim": 25, "n": 9, "imprevus": 0, "nImprevus": 0, "detailImprevus": []},
                           {"d": vieux, "mag": "aldi", "nom": "Aldi", "total": 31, "paye": 31, "estim": 30, "n": 12, "imprevus": 0, "nImprevus": 0, "detailImprevus": []}]
        etat["prixMagasins"] = {"lidl": {"pates": 0.89}}
        page.evaluate("(e) => localStorage.setItem('budgetable.v1', JSON.stringify(e))", etat); page.reload(); page.wait_for_timeout(400)
        if nom == "telephone":
            page.locator("[data-a=outil-mobile][data-k=sauvegarde]").count()  # la page s'est bien rechargée
        page.locator("[data-a=nouvelle]:visible").first.click()
        f = page.locator(".fenetre-nouvelle")
        assert "À partir de quel jour voulez-vous créer la semaine ?" in f.inner_text()
        assert f.locator("[data-a=nouvelle-jour]").count() == 7
        assert f.locator("[data-a=nouvelle-jour][aria-checked=true]").inner_text().startswith("Aujourd’hui")
        t = f.inner_text()
        assert "Le ticket de caisse de la semaine actuelle (Lidl, 23,40" in t and "sera effacé" in t and "Aldi" not in t, t
        # on choisit le surlendemain
        cible = auj + datetime.timedelta(days=2)
        f.locator(f".puce-debut[data-d='{cible.isoformat()}']").click()
        assert JOURS[cible.weekday()].lower() in page.locator(".fenetre-nouvelle").inner_text().lower()
        # premier repas : le dîner
        assert "Par quel repas commence-t-elle ?" in page.locator(".fenetre-nouvelle").inner_text()
        page.locator("[data-a=nouvelle-repas][data-k=diner]").click()
        assert page.locator("[data-a=nouvelle-repas][data-k=diner]").get_attribute("aria-checked") == "true"
        assert "du dîner du" in page.locator(".fenetre-nouvelle").inner_text()
        page.screenshot(path=f"{OUT}/nouvelle_semaine_{nom}.png")
        page.locator("[data-a=nouvelle-ok]").click(); page.wait_for_timeout(300)
        assert page.locator(".fenetre-nouvelle").count() == 0
        etat = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
        assert etat["planDu"] == cible.isoformat(), etat["planDu"]
        assert [x["nom"] for x in etat["tickets"]] == ["Aldi"], "seul le ticket de l'ancienne semaine est effacé"
        assert etat["prixMagasins"] == {"lidl": {"pates": 0.89}}, "les prix appris restent"
        # la semaine commence le jour choisi, et aucun repas n'est considéré comme passé
        if nom == "ordinateur":
            titres = page.locator("main .jours .jour h3").all_inner_texts()
            assert titres[0].startswith(JOURS[cible.weekday()]) and str(cible.day) in titres[0], titres
            assert page.locator("main .jour .tag-ok", has_text="Aujourd’hui").count() == 0
        else:
            sel = page.locator(".jour-puce[aria-selected=true]").inner_text()
            assert str(cible.day) in sel, sel
        jours = etat["plan"]["jours"]; premier = jours[cible.weekday()]
        assert premier["dejeuner"] is None and premier["diner"], "la semaine commence au dîner"
        assert premier.get("passes") == ["dejeuner"] and premier.get("debutAuDiner")
        assert all(not j.get("passes") for k, j in enumerate(jours) if k != cible.weekday()), "pas d'autre repas « passé »"
        assert "La semaine commence au dîner" in page.locator("main").inner_text()
        assert sum(1 for j in jours for s in ("dejeuner", "diner") if j.get(s)) >= 11
        assert page.locator(".bandeau-demarrer").count() == 1, "on peut toujours la faire démarrer aujourd'hui"
        # nouvelle semaine encore : plus de ticket à effacer ; « Aujourd'hui » par défaut
        page.locator("[data-a=nouvelle]:visible").first.click()
        assert "ticket de caisse" not in page.locator(".fenetre-nouvelle").inner_text()
        page.locator("[data-a=nouvelle-annuler]").first.click()
        assert page.locator(".fenetre-nouvelle").count() == 0
        assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).planDu") == cible.isoformat(), "annuler ne change rien"
        page.locator("[data-a=nouvelle]:visible").first.click()
        dej = page.locator("[data-a=nouvelle-repas][data-k=dejeuner]")
        if datetime.datetime.now().hour >= 13: assert dej.is_disabled(), "le déjeuner d'aujourd'hui est passé"
        else: assert dej.get_attribute("aria-checked") == "true"
        page.locator("[data-a=nouvelle-ok]").click(); page.wait_for_timeout(300)
        e2 = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
        assert e2["planDu"] == auj.isoformat()
        if datetime.datetime.now().hour < 13: assert e2["plan"]["jours"][auj.weekday()]["dejeuner"], "semaine au déjeuner : le déjeuner est prévu"
        page.close()
    nav.close()
assert not erreurs, erreurs
print("OK nouvelle semaine")
