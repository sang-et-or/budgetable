# La liste de courses suit les plats (y compris ceux créés par le coach) et indique le nombre de repas par ingrédient
import re, json, datetime
from playwright.sync_api import sync_playwright
erreurs = []
PLATS = {"plats": [{"nom": "Frites de patate douce et poulet paprika", "jour": "lundi", "repas": "diner", "temps": 30,
                    "ingredients": [["patate_douce", 250], ["poulet_filet", 120], ["paprika", 1]], "etapes": ["Couper.", "Cuire 18 min à 200 °C."]},
                   {"nom": "Velouté de patate douce coco", "jour": "mardi", "repas": "diner", "temps": 30,
                    "ingredients": [["patate_douce", 200], ["oignon", 40]], "etapes": ["Cuire.", "Mixer."]}]}
def ia(route):
    h = {"Access-Control-Allow-Origin": "*"}
    if route.request.url.endswith("/ia/etat"): return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"disponible": True}))
    if route.request.url.endswith("/ia"):
        tout = route.request.post_data or ""
        rep = PLATS if "Tu écris des recettes" in tout else {"reponse": "C’est fait.", "creer": True}
        return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps(rep))
    return route.abort()
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", ia)
    page.context.clock.install(time=datetime.datetime(2026, 11, 9, 8, 0))
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(500)
    if page.locator("[data-a=tuto-fin]").count(): page.locator("[data-a=tuto-fin]").first.click()
    liste = lambda: page.evaluate("Engine.listeCourses(JSON.parse(localStorage.getItem('budgetable.v1')).plan, JSON.parse(localStorage.getItem('budgetable.v1')).profil)")
    ids_plan = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.flatMap((jp) => ['dejeuner', 'diner'].map((s) => jp[s] && !jp[s].deRestes && !jp[s].dehors ? jp[s].recette : null)).filter(Boolean)")
    avant = {a["id"]: a for a in liste()["articles"]}
    page.locator("[data-a=chat-ouvrir]").first.click(); page.wait_for_selector("#coach-chat-texte")
    page.fill("#coach-chat-texte", "Change ma semaine avec tes plats"); page.locator("form[data-form=coach-chat] button[type=submit]").click(); page.wait_for_timeout(1800)
    page.locator(".chat-action [data-a=chat-voir-semaine]").click()
    apres = {a["id"]: a for a in liste()["articles"]}
    assert "patate_douce" in apres and {"Lun soir", "Mar soir"} <= set(apres["patate_douce"]["repas"]), apres.get("patate_douce")
    # quantités : somme des recettes × portions cuisinées (gamelles et restes compris)
    attendu = page.evaluate("""(i) => { const st = JSON.parse(localStorage.getItem('budgetable.v1')); let t = 0;
      st.plan.jours.forEach((jp) => ['dejeuner', 'diner'].forEach((s) => { const m = jp[s]; if (!m || !Engine.REC[m.recette]) return; const n = Engine.aCuisiner(m); const q = (Engine.REC[m.recette].ing.find(([k]) => k === i) || [0, 0])[1]; t += q * n; }));
      return t; }""", "patate_douce")
    print("patate douce", apres["patate_douce"]["quantite"], attendu)
    assert abs(apres["patate_douce"]["quantite"] - attendu) < 1e-6
    # chaque article : le nombre de repas = les repas de la semaine qui contiennent l'ingrédient
    recs = ids_plan()
    for id_, a in apres.items():
        if a.get("seulManuel"): continue
        n = page.evaluate("([ids, i]) => ids.filter((r) => Engine.REC[r].ing.some(([k]) => k === i)).length", [recs, id_])
        g = page.evaluate("(i) => { const st = JSON.parse(localStorage.getItem('budgetable.v1')); return st.plan.jours.reduce((t, jp) => t + (jp.gamelles && jp.gamelles.mode === 'plat' && Engine.REC[jp.gamelles.recette] && Engine.REC[jp.gamelles.recette].ing.some(([k]) => k === i) ? 1 : 0) + (jp.gourmand || []).filter((x) => Engine.REC[x.recette] && Engine.REC[x.recette].ing.some(([k]) => k === i)).length, 0); }", id_)
        assert len(a.get("repas") or []) == n + g, (id_, a.get("repas"), n, g)
    # les ingrédients des plats remplacés et plus utilisés disparaissent
    for id_ in avant:
        if id_ not in apres:
            assert page.evaluate("([ids, i]) => !ids.some((r) => Engine.REC[r].ing.some(([k]) => k === i))", [recs, id_])
    # affichage dans l'onglet Courses
    page.locator("nav button[data-k=courses]:visible").click(); page.wait_for_timeout(500)
    t = page.locator(".article", has_text="Patates douces").first.inner_text()
    assert f"{len(apres['patate_douce']['repas'])} repas" in t and "Lun soir" in t and "Mar soir" in t, t
    page.locator(".article", has_text="Patates douces").first.screenshot(path="/tmp/claude-0/-home-claude/e7ca5389-2d6a-596d-9613-ea14ab557a7b/scratchpad/courses_repas.png")
    nav.close()
assert not erreurs, erreurs
print("OK la liste de courses suit les plats, avec le nombre de repas")
