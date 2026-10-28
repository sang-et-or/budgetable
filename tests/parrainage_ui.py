# Parrainage dans l'appli : lien d'invitation capturé à l'arrivée, validé à la connexion ; lien à partager dans le profil
import re, json
from playwright.sync_api import sync_playwright
SB = "https://wrcxlvdyegfjawmwtozk.supabase.co"; LECT = "https://budgetable-recettes.onrender.com"
recu = []
def supabase(route):
    u, m = route.request.url, route.request.method
    h = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"}
    if m == "OPTIONS": return route.fulfill(status=204, headers=h)
    if "/auth/v1/token" in u: return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"access_token": "jeton", "refresh_token": "r", "expires_in": 3600, "user": {"id": "u1", "email": "amie@exemple.fr"}}))
    if "/auth/v1/user" in u: return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"id": "u1", "email": "amie@exemple.fr", "user_metadata": {}}))
    if "/rest/v1/profils" in u and m == "GET": return route.fulfill(status=200, headers=h, content_type="application/json", body="[]")
    if "/rest/v1/profils" in u: return route.fulfill(status=201, headers=h, body="")
    route.fulfill(status=404, headers=h, body="{}")
def serveur(route):
    u = route.request.url; h = {"Access-Control-Allow-Origin": "*"}
    if u.endswith("/abonnement/etat"): return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"disponible": True, "enEssai": True, "abonne": False, "finEssai": "2026-12-01T00:00:00Z", "prix": 299}))
    if u.endswith("/parrainage/valider"): recu.append(json.loads(route.request.post_data)); return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"ok": True}))
    if u.endswith("/parrainage/moi"): return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"code": "AB12CD34", "lien": "https://budgetable.fr/?parrain=AB12CD34", "filleuls": 2, "moisGagnes": 2, "maxMois": 12}))
    route.abort()
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route(LECT + "/**", serveur); page.route(SB + "/**", supabase)
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()")
    page.goto("http://localhost:8766/index.html?parrain=ab12cd34"); page.wait_for_timeout(500)
    assert "?parrain" not in page.url
    assert "Une amie vous invite" in page.inner_text("body")
    # elle prépare sa semaine puis se connecte : le code est validé
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(400)
    page.locator("nav.nav button[data-k=profil]").click(); page.wait_for_timeout(300)
    page.locator("[data-a=compte-ouvrir][data-k=connexion]:visible").first.click()
    page.fill("#c-email", "amie@exemple.fr"); page.fill("form[data-form=connexion] input[type=password]", "motdepasse1")
    page.locator("form[data-form=connexion] button[type=submit]").click(); page.wait_for_timeout(1500)
    assert recu and recu[0]["code"] == "AB12CD34" and recu[0]["jeton"] == "jeton", recu
    assert page.evaluate("localStorage.getItem('budgetable.parrain')") is None
    # son propre lien à partager
    page.locator("nav.nav button[data-k=profil]").click(); page.wait_for_timeout(800)
    b = page.locator("#parrainage").inner_text()
    assert "Invitez une amie" in b and "un mois offert" in b and "2 amies inscrites" in b, b
    assert page.locator("#parrainage input").input_value() == "https://budgetable.fr/?parrain=AB12CD34"
    assert "wa.me" in page.locator("#parrainage a", has_text="WhatsApp").get_attribute("href")
    page.locator("#parrainage").screenshot(path="/tmp/claude-0/-home-claude/e7ca5389-2d6a-596d-9613-ea14ab557a7b/scratchpad/parrainage.png")
    # entrée depuis « Plus »
    page.locator("nav.nav button[data-k=semaine]").click(); page.locator(".nav-plus").click()
    page.locator("[data-a=parrain-voir]").click(); page.wait_for_timeout(300)
    assert page.locator("#parrainage").count() == 1
    nav.close()
assert not erreurs, erreurs
print("OK parrainage dans l'appli")
