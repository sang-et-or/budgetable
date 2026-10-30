# Abonnement dans l'appli (serveur simulé) : accès libre tant que le paiement n'est pas ouvert, essai, essai terminé, abonné
import re, json, time
from playwright.sync_api import sync_playwright
LECT = "https://budgetable-recettes.onrender.com"
etat = {"rep": {"disponible": False, "prix": 299, "essaiJours": 7}, "status": 200, "payer": 0}
def serveur(route):
    u = route.request.url; h = {"Access-Control-Allow-Origin": "*"}
    if u.endswith("/abonnement/etat"): return route.fulfill(status=etat["status"], headers=h, content_type="application/json", body=json.dumps(etat["rep"]))
    if u.endswith("/abonnement/payer"): etat["payer"] += 1; return route.fulfill(status=200, headers=h, content_type="application/json", body=json.dumps({"url": "https://checkout.stripe.com/c/pay/test"}))
    route.abort()
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page(viewport={"width": 390, "height": 844})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route(LECT + "/**", serveur)
    page.route("https://checkout.stripe.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<h1>Stripe Checkout simulé</h1>"))
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(30):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click(); page.wait_for_timeout(500)
    # 1. paiement pas ouvert : rien n'est bloqué, pas d'étiquette d'essai
    assert "Essai" not in page.inner_text("body")
    assert page.evaluate("JSON.parse(localStorage.getItem('budgetable.v1')).essaiDebut")
    # 2. paiement ouvert, sans compte, essai en cours
    etat["status"], etat["rep"] = 401, {"erreur": "Connectez-vous"}
    page.reload(); page.wait_for_timeout(600)
    page.locator("nav button[data-k=profil]:visible").click(); page.wait_for_timeout(300)
    b = page.locator(".bloc-abonnement").inner_text(); print("essai :", b[:160].replace("\n", " | "))
    assert "Essai gratuit" in b and re.search(r"[67] jours", b) and "2,99 €" in b and "Créer mon compte" in b
    # 3. essai terminé (premier jour d'utilisation il y a 8 jours) : bandeau, et les nouvelles fonctions ouvrent l'abonnement
    page.evaluate("() => { const d = JSON.parse(localStorage.getItem('budgetable.v1')); const t = new Date(Date.now() - 8 * 86400000); d.essaiDebut = t.toISOString().slice(0, 10); localStorage.setItem('budgetable.v1', JSON.stringify(d)); }")
    page.reload(); page.wait_for_timeout(600)
    page.locator("nav button[data-k=semaine]:visible").click(); page.wait_for_timeout(300)
    assert "essai est terminée" in page.inner_text("main")
    page.locator("main [data-a=refaire-plats]:visible").first.click(); page.wait_for_timeout(300)
    assert page.locator(".fenetre-abo").count(), "refaire les plats → page d'abonnement"
    page.locator(".fenetre-abo [data-a=abo-fermer-btn]").click(); page.wait_for_timeout(200)
    # la semaine et ses recettes restent consultables
    page.locator("main [data-a=jour-mobile]").nth(1).click(); page.wait_for_timeout(300)   # demain (ce soir peut déjà être passé)
    page.locator("main [data-a=fiche]").first.click(); page.wait_for_timeout(300)
    assert page.locator(".voile .fiche h2").count() and not page.locator(".fenetre-abo").count()
    page.locator(".voile [data-a=fermer]").first.click(); page.wait_for_timeout(200)
    page.locator("nav button[data-k=courses]:visible").click(); page.wait_for_timeout(300)
    assert page.locator("main").inner_text().strip()
    # 4. connecté, essai terminé côté serveur : bouton d'abonnement → page de paiement Stripe
    page.evaluate("() => localStorage.setItem('budgetable.session', JSON.stringify({ jeton: 'j', renouv: 'r', expire: Date.now() + 3600000, user: { id: 'u1', email: 'moi@exemple.fr' } }))")
    etat["status"], etat["rep"] = 200, {"disponible": True, "prix": 299, "essaiJours": 7, "finEssai": "2026-10-01T00:00:00Z", "enEssai": False, "abonne": False}
    page.route("https://wrcxlvdyegfjawmwtozk.supabase.co/**", lambda r: r.fulfill(status=200, headers={"Access-Control-Allow-Origin": "*"}, content_type="application/json", body="[]"))
    page.reload(); page.wait_for_timeout(700)
    page.locator("nav button[data-k=profil]:visible").click(); page.wait_for_timeout(300)
    b = page.locator(".bloc-abonnement").inner_text(); assert "essai gratuit est terminé" in b, b
    page.locator("[data-a=abo-payer]").click(); page.wait_for_url("https://checkout.stripe.com/**", timeout=8000)
    assert etat["payer"] == 1
    page.go_back(); page.wait_for_timeout(500)
    # 5. abonné : étiquette « Abonné », plus rien de bloqué
    etat["rep"] = {"disponible": True, "prix": 299, "essaiJours": 7, "enEssai": False, "abonne": True, "statut": "active", "finPeriode": "2026-11-25T00:00:00Z", "resiliation": False}
    page.goto("http://localhost:8766/index.html?abonnement=merci"); page.wait_for_timeout(1200)
    b = page.locator(".bloc-abonnement").inner_text()
    assert "Vous êtes abonné" in b and "ABONNÉ" in b.upper(), b
    assert "abonnement est activé" in page.inner_text("body")
    page.locator("nav button[data-k=semaine]:visible").click(); page.wait_for_timeout(300)
    page.locator("main [data-a=refaire-plats]:visible").first.click(); page.wait_for_timeout(400)
    assert not page.locator(".fenetre-abo").count()
    page.locator("nav button[data-k=profil]:visible").click(); page.wait_for_timeout(300)
    assert "Gérer mon abonnement" in page.locator(".bloc-abonnement").inner_text()
    nav.close()
assert not erreurs, erreurs
print("ABONNEMENT UI OK")
