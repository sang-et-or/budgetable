# La semaine commence le jour de sa création ; « Démarrer aujourd'hui » décale une semaine existante sans changer les plats
import sys, re, datetime
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
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
    auj = datetime.date.today()
    titres = page.locator("main .jours .jour h3").all_inner_texts()
    print(titres[:3])
    assert titres[0].startswith(JOURS[auj.weekday()]) and str(auj.day) in titres[0], titres
    demain = auj + datetime.timedelta(days=1)
    assert titres[1].startswith(JOURS[demain.weekday()]) and str(demain.day) in titres[1]
    assert page.locator(".bandeau-demarrer").count() == 0
    # moment de la journée : après 13 h, pas de déjeuner aujourd'hui ; après 21 h, pas de dîner
    now = datetime.datetime.now(); h = now.hour + now.minute / 60
    jp = page.evaluate(f"JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours[{auj.weekday()}]")
    premier = page.locator("main .jours .jour").first.inner_text()
    if h >= 13: assert jp["dejeuner"] is None and "Déjà passé" in premier, premier
    else: assert jp["dejeuner"] is not None
    if h >= 21: assert jp["diner"] is None
    else: assert jp["diner"] is not None
    # changer les présences ou les gamelles ne remet pas le repas passé ; la veille du premier jour n'est pas dans la semaine
    r = page.evaluate("""() => { const E = window.Engine, d = JSON.parse(localStorage.getItem('budgetable.v1'));
      const t = (new Date().getDay() + 6) % 7; const plan = d.plan; plan.jours[t].passes = ['dejeuner']; plan.jours[t].dejeuner = null;
      const apres = E.appliquerPresences(plan, { ...d.profil, presences: {} }, {});
      const veille = (t + 6) % 7; const p2 = JSON.parse(JSON.stringify(apres)); p2.debut = t; p2.jours[t].passes = []; p2.jours[t].dejeuner = { recette: p2.jours[veille].diner.recette === p2.jours[t].diner.recette ? p2.jours[t].diner.recette : p2.jours[t].diner.recette, portions: 1 };
      p2.jours[veille].diner.restes = { vers: 'dejeuner' };
      E.organiserRestes(p2, { ...d.profil, gamelles: { n: 1, jours: [t], mode: 'restes' } });
      return { refait: apres.jours[t].dejeuner, restesDuDernierJour: !!p2.jours[t].dejeuner.deRestes, gamelleDepuisVeille: !!(p2.jours[t].gamelles && p2.jours[t].gamelles.mode === 'restes') }; }""")
    print(r); assert r["refait"] is None and not r["restesDuDernierJour"] and not r["gamelleDepuisVeille"]
    # la liste de courses ne compte pas le repas passé
    if h >= 13: assert page.evaluate("(() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); return window.Engine.listeCourses(d.plan, d.profil).articles.length > 0; })()")
    # semaine créée il y a 3 jours → bandeau, puis démarrage aujourd'hui sans changer les plats
    avant = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.map(j => j.diner && j.diner.recette)")
    il_y_a = (auj - datetime.timedelta(days=3)).isoformat()
    page.evaluate(f"() => {{ const d = JSON.parse(localStorage.getItem('budgetable.v1')); d.planDu = '{il_y_a}'; localStorage.setItem('budgetable.v1', JSON.stringify(d)); }}")
    page.reload()
    t2 = page.locator("main .jours .jour h3").all_inner_texts()
    assert t2[0].startswith(JOURS[(auj - datetime.timedelta(days=3)).weekday()]), t2
    assert page.locator(".bandeau-demarrer").count() == 1
    page.locator("[data-a=demarrer-auj]").click()
    t3 = page.locator("main .jours .jour h3").all_inner_texts()
    assert t3[0].startswith(JOURS[auj.weekday()]) and page.locator(".bandeau-demarrer").count() == 0, t3
    apres = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).plan.jours.map(j => j.diner && j.diner.recette)")
    assert avant == apres
    # téléphone : la première puce est aujourd'hui
    page.set_viewport_size({"width": 390, "height": 844}); page.reload()
    assert page.locator(".jour-puce").first.inner_text().lower().startswith(JOURS[auj.weekday()][:3].lower()), page.locator(".jour-puce").first.inner_text()
    page.screenshot(path=f"{OUT}/debut-semaine.png")
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("DEBUT SEMAINE OK")
    nav.close()
