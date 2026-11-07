# Le coach change vraiment les plats quand on le lui demande (« pas de pâtes, 20 min maximum »), avec retour possible
import re, json
from playwright.sync_api import sync_playwright
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(500)
    if page.locator("[data-a=tuto-fin]").count(): page.locator("[data-a=tuto-fin]").first.click()
    lire = lambda: page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan")
    avant = lire()
    page.locator("[data-a=chat-ouvrir]").first.click(); page.wait_for_selector("#coach-chat-texte")
    page.fill("#coach-chat-texte", "Change les plats de ma semaine : pas de pâtes et rien au-dessus de 20 minutes")
    page.locator("form[data-form=coach-chat] button[type=submit]").click()
    page.wait_for_selector(".chat-action", timeout=10000); page.wait_for_timeout(900)
    bulle = page.locator(".chat-action").inner_text()
    assert "J’ai changé" in bulle and "20 min maximum" in bulle and "sans pâtes" in bulle, bulle
    apres = lire()
    info = page.evaluate("""(plan) => plan.jours.flatMap((jp, j) => ['dejeuner', 'diner'].map((s) => { const m = jp[s]; if (!m) return null; const r = Engine.REC[m.recette];
        return { j, s, choisi: !!(m.choisi || m.dehors), pates: r.ing.some(([id]) => id === 'pates'), temps: r.temps, nom: r.nom }; })).filter(Boolean)""", apres)
    nouveaux = [x for x in info if x["nom"] in bulle]
    assert len(nouveaux) >= 3, (bulle, info)
    for x in nouveaux: assert not x["pates"] and x["temps"] <= 20, x
    page.screenshot(path="/tmp/claude-0/-home-claude/e7ca5389-2d6a-596d-9613-ea14ab557a7b/scratchpad/coach_change.png")
    # annuler : les plats d'avant reviennent
    page.locator(".chat-action [data-a=refaire-annuler]").click(); page.wait_for_timeout(400)
    assert json.dumps(lire()["jours"], sort_keys=True) == json.dumps(avant["jours"], sort_keys=True), "annulation"
    # le profil n'a pas été modifié (critères pour cette fois seulement)
    pr = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil")
    assert pr["temps"]["semaine"] > 20 and not pr.get("exclure"), pr["temps"]
    # autre formulation : plus de poisson, plus léger
    poisson = lambda plan: page.evaluate("(plan) => plan.jours.flatMap((jp) => ['dejeuner', 'diner'].map((s) => jp[s])).filter((m) => m && Engine.REC[m.recette].ing.some(([id]) => ['saumon', 'colin', 'thon'].includes(id))).length", plan)
    n0 = poisson(lire())
    page.fill("#coach-chat-texte", "Propose-moi des plats plus légers avec plus de poisson")
    page.locator("form[data-form=coach-chat] button[type=submit]").click(); page.wait_for_timeout(1500)
    b2 = page.locator(".chat-action").last.inner_text()
    assert "plus léger" in b2 and "poisson" in b2.lower() or "saumon" in b2.lower(), b2[:200]
    n1 = poisson(lire())
    assert n1 > n0 and n1 >= 4, (n0, n1)
    # une simple question ne change rien
    avant2 = json.dumps(lire()["jours"], sort_keys=True); nb = page.locator(".chat-action").count()
    page.fill("#coach-chat-texte", "Est-ce que ma semaine est équilibrée ?")
    page.locator("form[data-form=coach-chat] button[type=submit]").click(); page.wait_for_timeout(1200)
    assert page.locator(".chat-action").count() == nb and json.dumps(lire()["jours"], sort_keys=True) == avant2
    nav.close()
assert not erreurs, erreurs
print("OK le coach change la semaine sur demande :", len(nouveaux), "plats")
