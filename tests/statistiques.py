# Statistiques du site : visibles seulement pour un compte admin, totaux, sources et pages (Supabase simulé)
import json, time
from playwright.sync_api import sync_playwright
SUPA = "https://wrcxlvdyegfjawmwtozk.supabase.co"
admin = {"v": False}
jour = time.strftime("%Y-%m-%d")
LIGNES = [
    {"jour": jour, "evenement": "ouverture", "source": "facebook", "appareil": "mobile", "nombre": 30},
    {"jour": jour, "evenement": "ouverture", "source": "direct", "appareil": "ordinateur", "nombre": 10},
    {"jour": jour, "evenement": "page", "source": "google", "appareil": "mobile", "nombre": 12},
    {"jour": jour, "evenement": "semaine", "source": "facebook", "appareil": "mobile", "nombre": 8},
    {"jour": jour, "evenement": "compte", "source": "", "appareil": "mobile", "nombre": 2},
]
def supa(route):
    u = route.request.url; h = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"}
    if route.request.method == "OPTIONS": return route.fulfill(status=200, headers=h)
    if u.endswith("/rpc/est_admin"): return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps(admin["v"]))
    if u.endswith("/rpc/stats_visites"): return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps(LIGNES))
    if u.endswith("/rpc/stats_pages"): return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps([{"page": "/recettes/gateau-au-yaourt.html", "nombre": 7}]))
    if "/rest/v1/profils" in u: return route.fulfill(status=200, headers=h, content_type="application/json", body="[]")
    return route.fulfill(status=200, headers=h, content_type="application/json", body="{}")
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route(SUPA + "/**", supa)
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(300)
    session = {"jeton": "j", "renouv": "r", "expire": int(time.time() * 1000) + 3600_000, "user": {"id": "u-1", "email": "moi@exemple.fr"}}
    page.evaluate("(s) => localStorage.setItem('budgetable.session', s)", json.dumps(session))
    # compte ordinaire : pas de bouton
    page.reload(); page.wait_for_timeout(500)
    page.locator("nav button[data-k=profil]:visible").click(); page.wait_for_timeout(600)
    assert page.locator("[data-a=stats-ouvrir]").count() == 0, "pas de statistiques pour un compte ordinaire"
    # compte admin
    admin["v"] = True
    page.reload(); page.wait_for_timeout(500)
    page.locator("nav button[data-k=profil]:visible").click(); page.wait_for_timeout(800)
    assert page.locator("[data-a=stats-ouvrir]").count() == 1, "bouton visible pour l'admin"
    page.locator("[data-a=stats-ouvrir]").click(); page.wait_for_timeout(500)
    f = page.locator(".fenetre-stats").inner_text()
    assert "52" in f and "visites" in f, f          # 40 ouvertures + 12 pages
    assert "Facebook" in f and "Google" in f and "Accès direct" in f, f
    assert "gateau-au-yaourt" in f
    assert "20 %" in f, f                            # 8 semaines sur 40 ouvertures
    page.locator(".fenetre-stats [data-a=stats-jours][data-k='7']").click(); page.wait_for_timeout(300)
    assert page.locator(".fenetre-stats .stat-barres span").count() == 7
    page.screenshot(path="/tmp/claude-0/-home-claude/e7ca5389-2d6a-596d-9613-ea14ab557a7b/scratchpad/stats.png")
    page.locator("[data-a=stats-fermer-btn]").click(); page.wait_for_timeout(200)
    assert page.locator(".fenetre-stats").count() == 0
    nav.close()
assert not erreurs, erreurs
print("OK statistiques")
