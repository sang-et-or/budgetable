# « Crée les plats que tu proposes » : le coach écrit de vraies recettes (ingrédients, étapes) et les met dans la semaine
import re, json
from playwright.sync_api import sync_playwright
erreurs, longs = [], []
PLATS = {"plats": [
    {"nom": "Nuggets de poulet et brocolis croustillants", "jour": "lundi", "repas": "diner", "temps": 30,
     "ingredients": [["poulet_filet", 120], ["chapelure", 25], ["oeufs", 0.5], ["brocoli", 150], ["pomme_de_terre", 150]], "autres": ["parmesan"],
     "etapes": ["Paner le poulet.", "Cuire 12 min à 200 °C à l’air fryer.", "Rôtir les brocolis 8 min."]},
    {"nom": "Boulettes de bœuf sauce tomate", "jour": "mardi", "repas": None, "temps": 35,
     "ingredients": [["boeuf_hache", 110], ["tomates_concassees", 150], ["pates", 80], ["oignon", 30]], "autres": [],
     "etapes": ["Former les boulettes.", "Cuire 10 min à 190 °C.", "Mijoter dans la sauce."]},
    {"nom": "Plat impossible", "jour": "mercredi", "repas": "diner", "temps": 20, "ingredients": [["licorne", 100]], "etapes": ["…"]}]}
def ia(route):
    h = {"Access-Control-Allow-Origin": "*"}
    if route.request.url.endswith("/ia/etat"): return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"disponible": True}))
    if route.request.url.endswith("/ia"):
        corps = json.loads(route.request.post_data or "{}"); dernier = corps["messages"][-1]["content"]; tout = json.dumps(corps, ensure_ascii=False)
        if "Tu écris des recettes" in tout:
            longs.append(corps.get("long")); assert "Nuggets inventés" in tout, "la conversation est transmise"
            rep = PLATS
        elif "crée" in dernier.lower(): rep = {"reponse": "Très bien, je les ajoute à votre semaine !", "creer": True, "changer": False, "criteres": ""}
        else: rep = {"reponse": "Voici mes idées : Lundi – Nuggets inventés ; Mardi – Boulettes.", "creer": False, "changer": False}
        return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps(rep))
    return route.abort()
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", ia)
    page.context.clock.install(time=__import__("datetime").datetime(2026, 11, 8, 9, 0))   # dimanche matin
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(500)
    if page.locator("[data-a=tuto-fin]").count(): page.locator("[data-a=tuto-fin]").first.click()
    etat = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    page.locator("[data-a=chat-ouvrir]").first.click(); page.wait_for_selector("#coach-chat-texte")
    envoyer = lambda t: (page.fill("#coach-chat-texte", t), page.locator("form[data-form=coach-chat] button[type=submit]").click(), page.wait_for_timeout(1800))
    envoyer("Propose-moi des plats à l’air fryer avec de la viande")
    # elle ferme l'appli puis revient : la discussion est toujours là, et « crée ces plats » reprend les plats proposés
    page.reload(); page.wait_for_timeout(800)
    page.locator("[data-a=chat-ouvrir]").first.click(); page.wait_for_selector("#coach-chat-texte")
    assert "Nuggets inventés" in page.locator(".chat-fil").inner_text(), "discussion gardée"
    envoyer("Crée les plats que tu proposes et mets-les dans ma semaine")
    bulle = page.locator(".chat-action").last.inner_text()
    assert "J’ai créé 2 recettes" in bulle and "Lun soir : Nuggets de poulet et brocolis croustillants" in bulle and "Mar" in bulle, bulle
    assert longs == [True]
    st = etat(); plan = st["plan"]
    assert plan["jours"][0]["diner"]["recette"].startswith("p-coach-")
    assert any(plan["jours"][1][s] and plan["jours"][1][s]["recette"].startswith("p-coach-") for s in ("dejeuner", "diner"))
    crees = [r for r in st["bibliotheque"] if r.get("coach")]
    assert len(crees) == 2 and crees[0]["etapes"] and all(r["ing"] for r in crees), crees
    # la fiche montre les vraies étapes
    page.locator(".chat-action [data-a=chat-voir-semaine]").click(); page.wait_for_timeout(300)
    page.evaluate("(r) => { const b = [...document.querySelectorAll('[data-a=fiche]')].find((x) => x.dataset.j === '0' && x.dataset.s === 'diner'); if (b) b.click(); }", None)
    page.wait_for_timeout(300)
    if page.locator(".fiche").count(): assert "200 °C" in page.locator(".fiche").inner_text()
    # annuler remet la semaine d'avant (les recettes restent dans Mes recettes)
    nav.close()
assert not erreurs, erreurs
print("OK le coach crée ses plats et les met dans la semaine")
