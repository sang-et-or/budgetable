# Ticket de caisse : texte collé ou photo (lecteur simulé), rapprochement des produits, prix du magasin, placard, comparaison
import sys, re, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
TICKET = """LIDL
COQUILLETTES 500G           0,59 A
LAIT DEMI-ECREME 1L         1,90 A
  2 x 0,95
BANANES                          A
  1,234 kg x 1,49 EUR/kg    1,84
OEUFS PLEIN AIR X6          1,99 A
FILETS POULET 450G          4,79 A
LESSIVE LIQUIDE             5,99 B
TOTAL                      17,10
CB                         17,10
24/10/2026 18:42"""
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 1100, "height": 1000})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.route("**/tesseract.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body="window.Tesseract={recognize:async()=>({data:{text:" + json.dumps(TICKET.replace("LIDL", "ALDI")) + "}})};"))
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("Préparer ma semaine")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    page.locator("nav button[data-k=courses]").click()
    total0 = page.evaluate("(() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); return window.Engine.listeCourses(d.plan, d.profil).total; })()")
    page.locator(".bloc-tickets [data-a=ticket-ouvrir]").click()
    f = page.locator(".fenetre-ticket")
    f.locator("[data-a=ticket-coller]").click()
    page.fill("#ticket-texte", TICKET)
    f.locator("[data-a=ticket-analyser]").click()
    assert f.locator(".ligne-ticket").count() >= 5
    assert f.locator("[data-a=ticket-enseigne][data-k=lidl][aria-pressed=true]").count() == 1
    produits = f.locator(".produit-ticket").all_inner_texts(); print("rapprochés :", produits)
    assert any("Pâtes" in x for x in produits) and any("Lait" in x for x in produits)
    # la lessive est ignorée d'office
    assert f.locator(".ligne-ticket.ignoree").count() >= 1
    f.screenshot(path=f"{OUT}/ticket-lignes.png")
    # corriger une ligne non reconnue s'il y en a une : choisir le produit
    if f.locator(".produit-ticket.inconnu").count():
        f.locator(".produit-ticket.inconnu").first.click(); page.wait_for_timeout(200)
        page.locator("#ticket-propositions [data-a=ticket-choisir]").first.click()
    f.locator("[data-a=ticket-enregistrer]").click()
    assert "C’est noté" in f.inner_text()
    d = page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1'))")
    mag = d["prixMagasins"]["lidl-magasin"]; print("prix Lidl :", mag["prix"])
    assert mag["prix"]["pates"]["p"] in (0.59, 1.18) or abs(mag["prix"]["pates"]["p"] - 0.59 * 500 / page.evaluate("window.Engine.ING.pates.cond")) < 0.02
    assert d["magasinActif"] == "lidl-magasin" and d["profil"]["stock"].get("pates", 0) > 0
    page.locator("[data-a=ticket-fermer]").last.click()
    total1 = page.evaluate("(() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); return window.Engine.listeCourses(d.plan, d.profil).total; })()")
    print("total liste avant/après :", total0, total1)
    assert "Prix de Lidl" in page.evaluate("(() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); return window.Engine.listeCourses(d.plan, d.profil).source.libelle; })()")
    # photo (lecteur simulé) : ticket Aldi en drive
    page.locator(".bloc-tickets [data-a=ticket-ouvrir]").click()
    f.locator("[data-a=ticket-type][data-k=drive]").click()
    f.locator("[data-a=ticket-photo]").set_input_files({"name": "ticket.png", "mimeType": "image/png", "buffer": open("icons/icon-192.png", "rb").read()})
    page.wait_for_selector(".ligne-ticket", timeout=15000)
    assert f.locator("[data-a=ticket-enseigne][data-k=aldi][aria-pressed=true]").count() == 1
    f.locator("[data-a=ticket-enregistrer]").click()
    page.locator("[data-a=ticket-fermer]").last.click()
    # comparaison des magasins sur la liste
    t = page.locator(".bloc-tickets").inner_text()
    assert "Lidl" in t and "Aldi Drive" in t and "Prix de démonstration" in t, t
    page.locator(".bloc-tickets").screenshot(path=f"{OUT}/tickets-comparaison.png")
    # rechargement : les prix restent appliqués
    page.reload()
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).magasinActif") == "aldi-drive"
    print("Erreurs JS :", erreurs or "aucune"); assert not erreurs
    print("TICKETS OK")
    nav.close()
