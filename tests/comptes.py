# Page d'accueil et comptes (Supabase simulé) : inscription, connexion, synchro entre deux appareils, mot de passe oublié
import sys, re, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
BASE = "https://test.supabase.co"
db = {"users": {}, "profils": {}}
def api(route):
    req = route.request; u = req.url; corps = json.loads(req.post_data or "{}") if req.post_data else {}
    tok = (req.headers.get("authorization") or "").replace("Bearer ", "")
    def ok(o, s=200): route.fulfill(status=s, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(o))
    if req.method == "OPTIONS": return route.fulfill(status=200, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"})
    if "/auth/v1/signup" in u:
        if corps["email"] in db["users"]: return ok({"msg": "User already registered"}, 400)
        db["users"][corps["email"]] = {"id": "u-" + str(len(db["users"]) + 1), "pw": corps["password"], "prenom": corps.get("data", {}).get("prenom", "")}
        return ok({"id": db["users"][corps["email"]]["id"], "email": corps["email"]})  # confirmation par e-mail demandée
    if "grant_type=password" in u:
        x = db["users"].get(corps["email"])
        if not x or x["pw"] != corps["password"]: return ok({"error": "invalid_grant", "error_description": "Invalid login credentials"}, 400)
        return ok({"access_token": "tok-" + x["id"], "refresh_token": "r", "expires_in": 3600, "user": {"id": x["id"], "email": corps["email"]}})
    if "/auth/v1/user" in u and req.method == "GET":
        uid = tok.replace("tok-", ""); em = [e for e, x in db["users"].items() if x["id"] == uid][0]
        return ok({"id": uid, "email": em, "user_metadata": {"prenom": db["users"][em]["prenom"]}})
    if "/auth/v1/recover" in u: return ok({})
    if "/auth/v1/logout" in u: return ok({}, 204) if False else route.fulfill(status=204, headers={"Access-Control-Allow-Origin": "*"})
    if "/rest/v1/profils" in u:
        uid = tok.replace("tok-", "")
        if req.method == "GET": p = db["profils"].get(uid); return ok([p] if p else [])
        db["profils"][uid] = {"donnees": corps["donnees"], "maj": corps["maj"]}; return route.fulfill(status=201, headers={"Access-Control-Allow-Origin": "*"})
    return ok({"msg": "?"}, 404)
with sync_playwright() as p:
    nav = p.chromium.launch()
    def appareil():
        ctx = nav.new_context(viewport={"width": 390, "height": 844})
        ctx.add_init_script(f"window.BUDGETABLE_SUPABASE = {{ url: '{BASE}', cle: 'anon' }};")
        page = ctx.new_page(); page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.route(BASE + "/**", api); page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
        return page
    page = appareil()
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    t = page.inner_text("body"); assert "De l’idée du menu au panier" in t and "Comment ça marche" in t.replace("COMMENT", "Comment").replace("ÇA MARCHE", "ça marche") or "Trois étapes" in t, t[:400]
    page.screenshot(path=f"{OUT}/acc1.png", full_page=True)
    # inscription : e-mail de confirmation
    page.get_by_role("button", name="Créer un compte").first.click()
    f = page.locator(".fenetre-compte")
    f.locator("#c-email").fill("marie@exemple.fr"); f.locator("#c-mdp").fill("court")
    f.get_by_role("button", name="Créer mon compte").click()
    assert "8 caractères" in f.inner_text()
    f.locator("#c-mdp").fill("motdepasse1"); f.locator("#c-prenom").fill("Marie")
    f.get_by_role("button", name="Créer mon compte").click()
    assert "Cochez la case" in f.inner_text()
    f.locator("#c-accord").check(); f.get_by_role("button", name="Créer mon compte").click()
    page.wait_for_timeout(300)
    assert "Regardez vos e-mails" in page.locator(".fenetre-compte").inner_text()
    page.locator(".fenetre-compte").screenshot(path=f"{OUT}/acc2.png")
    page.locator(".fenetre-compte").get_by_role("button", name="Fermer").click()
    # préparer la semaine sans être connecté, puis se connecter : les données partent dans le compte
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.get_by_role("button", name="Créer un compte").first.click()
    page.locator(".fenetre-compte").get_by_role("button", name="Se connecter").click()
    f = page.locator(".fenetre-compte")
    f.locator("#c-email").fill("marie@exemple.fr"); f.locator("#c-mdp").fill("mauvais1")
    f.get_by_role("button", name="Se connecter").click(); page.wait_for_timeout(300)
    assert "incorrect" in f.inner_text()
    f.locator("#c-mdp").fill("motdepasse1"); f.get_by_role("button", name="Se connecter").click()
    page.wait_for_timeout(800)
    assert "u-1" in db["profils"] and db["profils"]["u-1"]["donnees"]["plan"], db["profils"].keys()
    plan1 = db["profils"]["u-1"]["donnees"]["plan"]["jours"][0]["diner"]["recette"]
    page.locator("nav button[data-k=profil]").click()
    assert "marie@exemple.fr" in page.inner_text("main") and "Synchronisé" in page.inner_text("main")
    page.locator(".bloc-compte").screenshot(path=f"{OUT}/acc3.png")
    # un changement est envoyé tout seul
    page.locator("nav button[data-k=semaine]").click()
    page.locator("main .jour").first.locator("[data-a=dehors][data-s=diner]").click()
    page.wait_for_timeout(3500)
    assert db["profils"]["u-1"]["donnees"]["deduits"].get("0-diner") == "dehors"
    # deuxième appareil : on retrouve la semaine
    p2 = appareil(); p2.goto("http://localhost:8766/index.html")
    p2.get_by_role("button", name="Se connecter").first.click()
    g = p2.locator(".fenetre-compte"); g.locator("#c-email").fill("marie@exemple.fr"); g.locator("#c-mdp").fill("motdepasse1")
    g.get_by_role("button", name="Se connecter").click(); p2.wait_for_timeout(1000)
    s2 = p2.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    assert s2 and s2["plan"]["jours"][0]["diner"]["recette"] == plan1, "plan non retrouvé"
    assert p2.locator("main .jour").count() == 7
    # mot de passe oublié
    p2.locator("nav button[data-k=profil]").click()
    p2.get_by_role("button", name="Se déconnecter").click(); p2.wait_for_timeout(300)
    assert "Créer un compte" in p2.inner_text("main")
    p2.locator(".bloc-compte").get_by_role("button", name="Se connecter").click()
    p2.locator(".fenetre-compte").get_by_role("button", name="Mot de passe oublié ?").click()
    p2.locator("#c-email").fill("marie@exemple.fr"); p2.locator(".fenetre-compte").get_by_role("button", name="Envoyer le lien").click(); p2.wait_for_timeout(300)
    assert "Regardez vos e-mails" in p2.locator(".fenetre-compte").inner_text()
    # retour depuis le lien « nouveau mot de passe »
    p2.goto("http://localhost:8766/index.html#access_token=tok-u-1&refresh_token=r&expires_in=3600&type=recovery"); p2.wait_for_timeout(600)
    assert "Nouveau mot de passe" in p2.locator(".fenetre-compte").inner_text()
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("COMPTES OK")
    nav.close()
