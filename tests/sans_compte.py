# Sans compte, rien n'est gardé : la semaine s'efface au rechargement, un bandeau invite à créer un compte.
# Une inscription en attente de confirmation garde la semaine sur l'appareil ; un compte connecté aussi.
import json, time
from playwright.sync_api import sync_playwright
erreurs = []
def semaine(page):
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    page.locator(".accueil-hero [data-a=commencer]").click()   # « Tester gratuitement sans compte », ou « Préparer ma semaine » une fois connecté
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.locator("[data-a=valider]").first.click(); page.wait_for_timeout(400)
    if page.locator(".fenetre-tuto").count(): page.locator("[data-a=tuto-fin]").click(); page.wait_for_timeout(200)
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => false })")
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.route("https://wrcxlvdyegfjawmwtozk.supabase.co/**", lambda r: r.fulfill(status=200, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"}, content_type="application/json", body="[]"))
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    semaine(page)
    assert "Sans compte, votre semaine n’est pas enregistrée" in page.inner_text("main"), "bandeau sans compte"
    assert page.evaluate("localStorage.getItem('budgetable.v1')") is None, "rien n'est écrit sans compte"
    page.reload(); page.wait_for_timeout(600)
    assert page.locator("[data-a=commencer]").count() >= 1, "après rechargement, on repart de l'accueil"
    # inscription en attente de confirmation : la semaine est gardée
    semaine(page)
    page.evaluate("localStorage.setItem('budgetable.attente', String(Date.now()))")
    page.locator("nav button[data-k=courses]:visible").click(); page.wait_for_timeout(300)
    assert page.evaluate("localStorage.getItem('budgetable.v1')") is not None, "gardée pendant l'attente de confirmation"
    assert "Sans compte, votre semaine" not in page.inner_text("main")
    # compte connecté : gardée
    page.evaluate("localStorage.clear()")
    page.evaluate("(s) => localStorage.setItem('budgetable.session', s)", json.dumps({"jeton": "j", "renouv": "r", "expire": int(time.time() * 1000) + 3600_000, "user": {"id": "u-1", "email": "moi@exemple.fr"}}))
    page.reload(); page.wait_for_timeout(500)
    semaine(page)
    assert page.evaluate("localStorage.getItem('budgetable.v1')") is not None, "gardée avec un compte"
    page.reload(); page.wait_for_timeout(600)
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan") is not None
    nav.close()
assert not erreurs, erreurs
print("OK sans compte, rien n'est gardé")
