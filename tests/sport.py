# Coach sportif : bilan avec questions de santé, séances, séance guidée (minuteur), ressenti, bilan de semaine, coach
import sys, re
from playwright.sync_api import sync_playwright

def aller(page, k):
    """Ouvre un onglet : bouton de la navigation s'il est visible, sinon via « Plus » (téléphone)."""
    b = page.locator(f"nav.nav button[data-k={k}]")
    if b.is_visible(): b.click()
    else: page.locator(".nav-plus").click(); page.locator(f".fenetre-plus [data-k={k}]").click()

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 1100, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    aller(page, 'sport')
    page.locator("[data-a=sp-champ][data-k=age]").fill("38")
    page.locator("[data-a=sp-choix][data-cle=objectif][data-k=perte]").click()
    page.locator("[data-a=sp-choix][data-cle=niveau][data-k=debutant]").click()
    for j in (0, 2, 4): page.locator(f"[data-a=sp-multi][data-cle=jours][data-k='{j}']").click()
    page.locator("[data-a=sp-multi][data-cle=limites][data-k=genoux]").click()
    for k in ("coeur", "poitrine", "os"): page.locator(f"[data-a=sp-sante][data-k={k}][data-v=non]").click()
    page.locator("[data-a=sp-sante][data-k=traitement][data-v=oui]").click()
    assert "avis médical" in page.inner_text("#sp-etat")
    page.locator("[data-a=sp-consent]").click(); assert page.evaluate("document.querySelector('[data-a=sp-consent]').checked")
    assert page.locator("[data-a=sp-lancer]").is_disabled()
    page.locator("[data-a=sp-accord]").click()
    assert not page.locator("[data-a=sp-lancer]").is_disabled()
    page.locator("[data-a=sp-lancer]").click()
    main = page.inner_text("main")
    assert "Mon coach sportif" in main and "version douce" in main, main[:300]
    assert page.locator(".seance").count() == 3
    # genoux fragiles + accord médical : pas de sauts ni de fentes
    assert not re.search(r"Squats sautés|Burpees|Jumping|Fentes|Corde", main), "exercice à risque proposé"
    page.screenshot(path=f"{OUT}/sport.png", full_page=True)
    # séance guidée : minuteur qui avance tout seul
    page.clock.install()
    page.locator("[data-a=sp-go]").first.click()
    assert page.locator(".fenetre-seance").count() == 1 and "échauffement" in page.inner_text(".fenetre-seance").lower()
    avant = page.inner_text("#seance-chrono")
    page.clock.run_for(3000)
    assert int(page.inner_text("#seance-chrono")) < int(avant)
    page.locator(".fenetre-seance").screenshot(path=f"{OUT}/seance.png")
    page.clock.run_for(46000)  # fin du premier exercice d'échauffement → étape suivante
    assert page.locator(".fenetre-seance").count() == 1
    # on passe tout jusqu'à la fin
    for _ in range(80):
        if page.locator("[data-a=sp-fin]").count(): break
        page.locator("[data-a=sp-suivant]").click()
    assert "Séance terminée" in page.inner_text(".fenetre-seance")
    page.locator("[data-a=sp-fin][data-k=facile]").click()
    assert page.locator(".seance.faite").count() == 1
    h = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).profil.sport.historique")
    assert len(h) == 1 and h[0]["ressenti"] == "facile"
    # bilan de semaine (forcé) → semaine 2
    page.evaluate("""() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); d.profil.sport.semaineDu = '2020-01-06'; localStorage.setItem('budgetable.v1', JSON.stringify(d)); }"""); page.reload()
    aller(page, 'sport')
    page.locator("[data-a=sp-bilan]").click()
    assert "Semaine 2" in page.inner_text("main") and "facile" in page.inner_text(".message-coach")
    # petits-déj sportifs
    page.locator("[data-a=sp-petitdej]").click()
    pds = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.map(j => (j.gourmand||[]).filter(g => g.moment==='petitdej').length)")
    assert pds[0] == 1 and pds[2] == 1 and pds[1] == 0, pds
    # coach sans IA
    page.locator("[data-a=coach-s-q]", has_text="courbatures").click()
    assert "courbatures" in page.inner_text(".chat").lower()
    page.fill("#coach-s-texte", "j'ai mal au genou"); page.keyboard.press("Enter")
    assert "médecin" in page.inner_text(".chat")
    # mobile : accès par Semaine → Sport et minceur
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("nav button[data-k=semaine]").click()
    page.locator("[data-a=outil-mobile][data-k=coachs]").click()
    page.locator(".outil-corps [data-k=sport]").click()
    assert "Mon coach sportif" in page.inner_text("main")
    page.screenshot(path=f"{OUT}/sport-mobile.png")
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("SPORT OK")
    nav.close()
