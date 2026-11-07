# Le coach tient compte des personnes à table et des gamelles (consignes envoyées, placement des plats créés)
import re, json, datetime
from playwright.sync_api import sync_playwright
erreurs, corps_crea, corps_coach = [], [], []
PLATS = {"plats": [{"nom": f"Plat du coach {k}", "jour": None, "repas": None, "temps": 25,
                    "ingredients": [["poulet_filet", 120], ["riz", 70], ["carotte", 100]], "etapes": ["Cuire.", "Servir."]} for k in range(7)]}
def ia(route):
    h = {"Access-Control-Allow-Origin": "*"}
    if route.request.url.endswith("/ia/etat"): return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"disponible": True}))
    if route.request.url.endswith("/ia"):
        c = json.loads(route.request.post_data or "{}"); tout = json.dumps(c, ensure_ascii=False)
        if "Tu écris des recettes" in tout: corps_crea.append(tout); rep = PLATS
        else: corps_coach.append(tout); rep = {"reponse": "Voici mes plats : …", "creer": True}
        return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps(rep))
    return route.abort()
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", ia)
    page.context.clock.install(time=datetime.datetime(2026, 11, 9, 8, 0))   # lundi matin
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(500)
    if page.locator("[data-a=tuto-fin]").count(): page.locator("[data-a=tuto-fin]").first.click()
    # foyer : 2 adultes et un enfant, une gamelle du lundi au vendredi (restes de la veille), et le dîner de mardi sert au déjeuner de mercredi
    page.evaluate("""() => { const st = JSON.parse(localStorage.getItem('budgetable.v1'));
      st.profil.foyer = { adultes: 2, enfants: ['6-10'] }; st.profil.gamelles = { n: 1, jours: [0, 1, 2, 3, 4], mode: 'restes' };
      st.plan.jours[1].diner.restes = { vers: 'dejeuner' };
      localStorage.setItem('budgetable.v1', JSON.stringify(st)); }""")
    page.reload(); page.wait_for_timeout(800)
    page.locator("[data-a=chat-ouvrir]").first.click(); page.wait_for_selector("#coach-chat-texte")
    page.fill("#coach-chat-texte", "Change ma semaine avec tes plats"); page.locator("form[data-form=coach-chat] button[type=submit]").click(); page.wait_for_timeout(2000)
    c = corps_coach[-1]; i = c.find("Repas encore libres"); 
    assert i > 0 and "enfant" in c and "gamelle" in c
    assert corps_crea and "Repas à remplir" in corps_crea[-1] and "gamelle" in corps_crea[-1] and "6-10 ans" in corps_crea[-1]
    st = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    mer = st["plan"]["jours"][2]["dejeuner"]
    assert mer.get("deRestes") and mer["recette"] == st["plan"]["jours"][1]["diner"]["recette"], mer   # le midi « restes » suit le dîner de la veille
    places = [(j, s, st["plan"]["jours"][j][s]) for j in range(7) for s in ("dejeuner", "diner") if st["plan"]["jours"][j].get(s) and str(st["plan"]["jours"][j][s]["recette"]).startswith("p-coach-") and not st["plan"]["jours"][j][s].get("deRestes")]
    assert len(places) == 7 and all(m["portions"] > 0 for _, _, m in places), places
    nav.close()
assert not erreurs, erreurs
print("OK le coach tient compte des personnes et des gamelles")
