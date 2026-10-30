# Connexion au compte (Supabase simulé) : jamais d'écrasement silencieux des données de l'appareil
import re, json
from playwright.sync_api import sync_playwright
SB = "https://wrcxlvdyegfjawmwtozk.supabase.co"
etat = {"distant": None, "ecrit": []}
def supabase(route):
    u, m = route.request.url, route.request.method
    h = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"}
    if m == "OPTIONS": return route.fulfill(status=204, headers=h)
    if "/auth/v1/token" in u: return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"access_token": "jeton", "refresh_token": "r", "expires_in": 3600, "user": {"id": "u1", "email": "moi@exemple.fr"}}))
    if "/auth/v1/user" in u: return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"id": "u1", "email": "moi@exemple.fr", "user_metadata": {"prenom": "Moi"}}))
    if "/rest/v1/profils" in u and m == "GET":
        d = etat["distant"]; return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps([{"donnees": d, "maj": "2026-10-25T16:00:00Z"}] if d else []))
    if "/rest/v1/profils" in u and m == "POST":
        etat["ecrit"].append(json.loads(route.request.post_data)); return route.fulfill(status=201, headers=h, body="")
    route.fulfill(status=404, headers=h, body="{}")
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    def nouvelle_page():
        ctx = nav.new_context(viewport={"width": 390, "height": 844}); page = ctx.new_page()
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
        page.route(SB + "/**", supabase)
        page.goto("http://localhost:8766/index.html"); return page
    def semaine(page):
        clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
        clic("🍽️ Tester gratuitement sans compte")
        for _ in range(25):
            if page.get_by_role("button", name="Voir mon profil").count(): break
            clic("Continuer")
        clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(300)
    def connexion(page):
        if not page.locator("[data-a=compte-ouvrir][data-k=connexion]:visible").count():
            page.locator("nav button[data-k=profil]:visible").click(); page.wait_for_timeout(300)
        page.locator("[data-a=compte-ouvrir][data-k=connexion]:visible").first.click()
        page.fill("#c-email", "moi@exemple.fr"); page.fill("form[data-form=connexion] input[type=password]", "motdepasse1")
        page.locator("form[data-form=connexion] button[type=submit]").click(); page.wait_for_timeout(1200)
    # 1. téléphone A rempli → connexion : compte vide, les données y sont envoyées
    a = nouvelle_page(); semaine(a)
    a.evaluate("() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); d.tickets = [{ id: 't1', total: 172.17 }]; d.profil.stock.riz = 1000; localStorage.setItem('budgetable.v1', JSON.stringify(d)); }"); a.reload()
    connexion(a)
    assert etat["ecrit"] and etat["ecrit"][-1]["donnees"]["tickets"], "données du téléphone envoyées au compte"
    etat["distant"] = etat["ecrit"][-1]["donnees"]
    plan_a = json.dumps(etat["distant"]["plan"])
    # 2. réinstallation (téléphone vide) → connexion : tout revient
    b = nouvelle_page()
    print("B avant:", b.evaluate("(() => { const d = JSON.parse(localStorage.getItem('budgetable.v1') || 'null'); return d && { plan: !!d.plan, gouts: Object.keys(d.profil.gouts || {}).length, notes: Object.keys(d.notes || {}).length, classiques: (d.classiques || []).length, biblio: (d.bibliotheque||[]).length }; })()"))
    connexion(b)
    d = b.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    print("B:", d and {"plan": bool(d.get("plan")), "tickets": len(d.get("tickets") or [])}, "distant tickets", len(etat["distant"].get("tickets") or []), b.inner_text("body")[:200].replace("\n"," | "))
    assert d and json.dumps(d["plan"]) == plan_a and len(d["tickets"]) == 1, "tout revient après réinstallation"
    # 3. appareil avec une AUTRE semaine → connexion : on demande, rien n'est écrasé
    c = nouvelle_page(); semaine(c)
    plan_c = json.dumps(c.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan"))
    connexion(c)
    assert "n’ont pas les mêmes données" in c.inner_text("body"), "choix proposé"
    assert json.dumps(c.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan")) == plan_c, "rien d'écrasé avant le choix"
    c.screenshot(path="/tmp/claude-0/conflit.png", full_page=False)
    c.locator("[data-a=conflit-compte]").click(); c.wait_for_timeout(500)
    assert json.dumps(c.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan")) == plan_a
    # la semaine de ce téléphone reste récupérable
    assert c.evaluate("!!localStorage.getItem('budgetable.secours')")
    c.locator("nav button[data-k=profil]:visible").click(); c.wait_for_timeout(300)
    c.locator("[data-a=secours-reprendre]").click(); c.wait_for_timeout(300)
    c.locator("[data-a=sauvegarde-restaurer-ok]").click(); c.wait_for_timeout(400)
    assert json.dumps(c.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan")) == plan_c, "copie de secours reprise"
    nav.close()
assert not erreurs, erreurs
print("COMPTE SYNC OK")
