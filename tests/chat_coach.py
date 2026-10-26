# Parler à son coach : messagerie (IA du site simulée), suggestions, envoi, réponse de secours sans IA, raccourcis
import json
from playwright.sync_api import sync_playwright
LECT = "https://budgetable-recettes.onrender.com"
erreurs, recu = [], []
def semaine(page):
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(500)
def lancer(p, ia):
    page = p.chromium.launch().new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    def serveur(route):
        u = route.request.url; h = {"Access-Control-Allow-Origin": "*"}
        if u.endswith("/ia/etat"): return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"disponible": ia}))
        if u.endswith("/ia"):
            recu.append(json.loads(route.request.post_data)["messages"])
            return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"reponse": "Bonne idée ! Ajoutez une poêlée de légumes au dîner de mardi 🥕"}))
        route.abort()
    page.route(LECT + "/**", serveur)
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    semaine(page); return page
with sync_playwright() as p:
    # avec l'IA du site
    page = lancer(p, True)
    page.locator(".fab-coach").click(); page.wait_for_timeout(300)
    f = page.locator(".fenetre-chat")
    assert f.count() == 1 and "Votre coach Budgétable" in f.inner_text() and "Bonjour" in f.inner_text()
    assert f.locator("[data-a=chat-question]").count() == 4, "suggestions de questions"
    f.locator("[data-a=chat-question]").first.click(); page.wait_for_timeout(600)
    t = f.inner_text()
    assert "Ma semaine est-elle équilibrée ?" in t and "poêlée de légumes" in t, t
    assert recu and "Bilan nutritionnel de la semaine" in recu[-1][0]["content"], "le coach connaît le bilan de la semaine"
    page.fill("#coach-chat-texte", "Et pour le goûter ?"); page.locator(".chat-saisie button[type=submit]").click(); page.wait_for_timeout(600)
    assert f.locator(".chat-ligne.moi").count() == 2 and f.locator(".chat-ligne.coach").count() == 3
    assert recu[-1][-1]["content"] == "Et pour le goûter ?"
    page.locator("[data-a=chat-bilan]").click(); page.wait_for_timeout(300)
    assert page.locator(".fenetre-chat").count() == 0 and page.locator(".fenetre-bilan").count() == 1, "raccourci vers le bilan"
    page.context.browser.close()
    # sans IA : réponse de secours tirée du bilan
    page = lancer(p, False)
    page.locator(".fab-coach").click(); page.wait_for_timeout(300)
    page.locator("[data-a=chat-question]").first.click(); page.wait_for_timeout(1200)
    t = page.locator(".fenetre-chat").inner_text()
    assert "repères sur" in t, t
    page.locator("[data-a=chat-fermer]").click(); page.wait_for_timeout(200)
    assert page.locator(".fenetre-chat").count() == 0
    page.context.browser.close()
assert not erreurs, erreurs
print("OK parler au coach")
