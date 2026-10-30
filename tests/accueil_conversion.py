# Accueil : test gratuit visible dès le premier écran (iPhone), 3 étapes, exemple réel de semaine,
# invitation à créer un compte après la génération sans compte (conditions d'essai exactes).
import sys, re
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
BOUTON = "🍽️ Tester gratuitement sans compte"
with sync_playwright() as p:
    nav = p.chromium.launch()
    for nom, vp in [("iphone", {"width": 390, "height": 844}), ("iphone-se", {"width": 375, "height": 667}), ("ordinateur", {"width": 1366, "height": 900})]:
        ctx = nav.new_context(viewport=vp, is_mobile=nom != "ordinateur", has_touch=nom != "ordinateur")
        page = ctx.new_page(); page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
        page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
        page.wait_for_selector(".accueil-hero")
        h1 = page.locator(".accueil-hero h1")
        assert h1.inner_text().strip() == "Et si vos repas de la semaine étaient déjà organisés ?"
        assert "liste de courses pour mieux maîtriser vos dépenses" in page.locator(".accueil-sous").inner_text()
        b = page.get_by_role("button", name=BOUTON, exact=True).first
        bb = b.bounding_box()
        assert bb["y"] + bb["height"] <= vp["height"], f"{nom} : bouton hors du premier écran ({bb})"
        assert bb["height"] >= 48, "bouton assez grand pour le doigt"
        assert page.evaluate("document.documentElement.scrollWidth") <= vp["width"], f"{nom} : défilement horizontal"
        # un seul bouton d'action dans le premier écran (pas de « Créer mon compte » concurrent)
        assert page.locator(".accueil-hero button").count() == 1
        if nom != "ordinateur": assert not page.locator(".accueil-entete [data-k=inscription]").is_visible()
        r = page.locator(".rassurance").inner_text()
        for t in ["Sans inscription pour tester", "Menus personnalisés", "7 jours d’essai gratuit dès la création du compte"]: assert t in r, t
        assert "2,99 € par mois, sans engagement" in page.locator(".accueil-hero").inner_text()
        e = page.locator(".etapes").inner_text()
        for t in ["Je choisis mes goûts et mon budget.", "Je découvre gratuitement mes menus de la semaine, sans compte.", "Je crée mon compte pour profiter des fonctionnalités complètes et conserver mes menus.", "rien n’est enregistré"]: assert t in e, t
        # exemple réel : des plats du moteur, avec un prix estimé, et un extrait de la liste
        assert page.locator(".ex-jour").count() == 4
        assert all(re.search(r"≈ \d+,\d\d\s€ pour 2", x) for x in page.locator(".ex-jour").all_inner_texts())
        assert page.locator(".ex-liste li").count() == 7
        assert "Prix estimés" in page.locator(".exemple-semaine").inner_text()
        # la sauvegarde reste restaurable (déplacée dans la section compte)
        assert page.locator("input[data-a=sauvegarde-fichier]").count() == 1
        page.screenshot(path=f"{OUT}/accueil_{nom}.png")
        ctx.close()
    # parcours visiteur : le bouton ouvre le questionnaire existant, puis la semaine s'affiche sans compte
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page(); page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()")
    page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => false })")   # un vrai visiteur, sans compte
    page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic(BOUTON)
    assert page.locator(".q-shell, .questionnaire").count(), "le questionnaire s'ouvre"
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil")
    page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.wait_for_selector("main .jour")
    ban = page.locator(".bandeau-abo").first.inner_text()
    assert "Sans compte, votre semaine n’est pas enregistrée" in ban and "7 jours d’essai gratuit dès la création du compte" in ban and "2,99 € par mois" in ban
    assert page.locator(".bandeau-abo [data-k=inscription]").count()
    assert page.locator("main .jour").count() >= 1, "les menus restent consultables sans compte"
    page.screenshot(path=f"{OUT}/accueil_apres_generation.png")
    # retour à l'accueil avec une semaine : on propose de la retrouver
    page.evaluate("window.scrollTo(0,0)")
    if page.locator("[data-a=tuto-fin]").count(): page.locator("[data-a=tuto-fin]").first.click()
    page.locator("[data-a=accueil]:visible").first.click()
    assert page.get_by_role("button", name="Retrouver ma semaine", exact=True).count()
    nav.close()
assert not erreurs, erreurs
print("OK accueil_conversion")

# utilisateur connecté (Supabase simulé, comme dans compte_sync.py) : pas de « sans compte », bouton adapté
import json
SB = "https://wrcxlvdyegfjawmwtozk.supabase.co"
def supabase(route):
    u, m = route.request.url, route.request.method
    h = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"}
    if m == "OPTIONS": return route.fulfill(status=204, headers=h)
    if "/auth/v1/token" in u: return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"access_token": "jeton", "refresh_token": "r", "expires_in": 3600, "user": {"id": "u1", "email": "moi@exemple.fr"}}))
    if "/auth/v1/user" in u: return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"id": "u1", "email": "moi@exemple.fr", "user_metadata": {"prenom": "Moi"}}))
    if "/rest/v1/profils" in u and m == "GET": return route.fulfill(status=200, headers=h, content_type="application/json", body="[]")
    if "/rest/v1/profils" in u and m == "POST": return route.fulfill(status=201, headers=h, body="")
    route.fulfill(status=404, headers=h, body="{}")
with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={"width": 390, "height": 844}); page = ctx.new_page()
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort()); page.route(SB + "/**", supabase)
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    page.locator("[data-a=compte-ouvrir][data-k=connexion]:visible").first.click()
    page.fill("#c-email", "moi@exemple.fr"); page.fill("form[data-form=connexion] input[type=password]", "motdepasse1")
    page.locator("form[data-form=connexion] button[type=submit]").click(); page.wait_for_timeout(1200)
    if not page.locator(".accueil-hero").count(): page.locator("[data-a=accueil]:visible").first.click()
    hero = page.locator(".accueil-hero")
    assert hero.get_by_role("button", name="🍽️ Préparer ma semaine", exact=True).count(), hero.inner_text()
    assert "sans compte" not in hero.inner_text().lower()
    page.screenshot(path=f"{OUT}/accueil_connecte.png")
    nav.close()
assert not erreurs, erreurs
print("OK accueil connecté")
