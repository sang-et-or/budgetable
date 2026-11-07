# Coach + IA : l'IA reconnaît une demande de changement même sans mot-clé ; « mardi soir » ne change que ce repas
import re, json
from playwright.sync_api import sync_playwright
erreurs, appels = [], []
def ia(route):
    h = {"Access-Control-Allow-Origin": "*"}
    if route.request.url.endswith("/ia/etat"): return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"disponible": True}))
    if route.request.url.endswith("/ia"):
        corps = route.request.post_data or ""; appels.append(corps)
        dernier = json.loads(corps)["messages"][-1]["content"]
        if "Tu traduis une demande" in corps and "air fryer" in dernier: rep = {"airfryer": True, "leger": True, "ingredients": {"poulet_filet": 2, "boeuf_hache": 2}}
        elif "ces plats" in dernier: rep = {"reponse": "Voici votre nouvelle semaine avec des plats à l’air fryer. Lundi – Nuggets inventés ; Mardi – Brochettes inventées ; Mercredi – Œufs cocotte inventés.", "changer": True, "criteres": "plats à l’air fryer avec de la viande, légers"}
        elif "Tu traduis une demande" in corps and "poisson" in dernier: rep = {"ingredients": {"saumon": 3, "colin": 3, "thon": 3}}
        elif "Tu traduis une demande" in corps: rep = {"ingredients": {"poulet_filet": 3, "cuisses_poulet": 3}}
        elif "assez de ces menus" in dernier: rep = {"reponse": "C’est fait, plus de poulet !", "changer": True, "criteres": "plus de poulet"}
        elif "Mets du poisson" in dernier: rep = {"reponse": "C’est fait.", "changer": True, "criteres": "poisson mardi soir"}
        else: rep = {"reponse": "D’accord.", "changer": False, "criteres": ""}
        return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps(rep))
    return route.abort()
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", ia)
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(500)
    if page.locator("[data-a=tuto-fin]").count(): page.locator("[data-a=tuto-fin]").first.click()
    lire = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan")
    poulet = lambda plan: page.evaluate("(plan) => plan.jours.flatMap((jp) => ['dejeuner', 'diner'].map((s) => jp[s])).filter((m) => m && Engine.REC[m.recette].ing.some(([id]) => ['poulet_filet', 'cuisses_poulet'].includes(id))).length", plan)
    n0 = poulet(lire())
    page.locator("[data-a=chat-ouvrir]").first.click(); page.wait_for_selector("#coach-chat-texte")
    envoyer = lambda t: (page.fill("#coach-chat-texte", t), page.locator("form[data-form=coach-chat] button[type=submit]").click(), page.wait_for_timeout(1500))
    envoyer("J’en ai assez de ces menus, trouve-moi mieux avec ce que j’aime")
    assert page.locator(".chat-action").count() == 1, page.locator(".chat-fil").inner_text()[-400:]
    assert poulet(lire()) > n0, (n0, poulet(lire()), page.locator(".chat-action").inner_text()[:300])
    # « mardi soir » seulement
    page.locator(".chat-action [data-a=refaire-ok], .chat-action [data-a=chat-voir-semaine]").count()
    avant = lire()
    envoyer("Mets du poisson mardi soir")
    apres = lire()
    diff = [(j, s) for j in range(7) for s in ("dejeuner", "diner") if (avant["jours"][j].get(s) or {}).get("recette") != (apres["jours"][j].get(s) or {}).get("recette")]
    assert diff == [(1, "diner")], diff
    assert page.evaluate("(r) => Engine.REC[r].ing.some(([id]) => ['saumon', 'colin', 'thon'].includes(id))", apres["jours"][1]["diner"]["recette"])
    # une question ne change rien
    avant = json.dumps(lire()["jours"], sort_keys=True); nb = page.locator(".chat-action").count()
    envoyer("Est-ce que c’est équilibré ?")
    assert page.locator(".chat-action").count() == nb, (nb, page.locator(".chat-fil").inner_text()[-300:])
    assert json.dumps(lire()["jours"], sort_keys=True) == avant, (avant[:300], json.dumps(lire()["jours"], sort_keys=True)[:300])
    # « Change ma semaine avec ces plats » (plats cités avant par le coach) : vraie semaine, pas de liste inventée
    envoyer("Change ma semaine avec ces plats"); page.wait_for_timeout(500)
    fil = page.locator(".chat-fil").inner_text()
    assert "inventé" not in fil, fil[-500:]
    assert "à l’air fryer" in page.locator(".chat-action").last.inner_text()
    naf = page.evaluate("(plan) => plan.jours.flatMap((jp) => ['dejeuner', 'diner'].map((s) => jp[s])).filter((m) => m && String(m.recette).startsWith('af-')).length", lire())
    assert naf >= 3, naf
    nav.close()
assert not erreurs, erreurs
print("OK coach + IA : changements compris et ciblés")
