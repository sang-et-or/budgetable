# Aide et contact : assistant (réponses de secours si l'IA est indisponible) et relais vers l'équipe par e-mail
import sys, re, urllib.parse
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html"); page.evaluate("localStorage.clear()"); page.reload()
    # 1. depuis l'accueil (sans compte)
    page.locator("[data-a=aide-ouvrir]:visible").first.click()
    f = page.locator(".fenetre-aide")
    assert "Aide et contact" in f.inner_text() and f.locator("[data-a=aide-question]").count() == 5
    f.locator("[data-a=aide-question]", has_text="Comment résilier ?").click(); page.wait_for_timeout(900)
    assert "Gérer mon abonnement" in f.locator(".chat-bulle").last.inner_text()
    assert "mise-en-avant" not in f.locator(".aide-equipe").get_attribute("class")
    page.fill("#aide-texte", "Je veux un remboursement de ma facture"); page.locator("form[data-form=aide-chat] button").click(); page.wait_for_timeout(900)
    assert "équipe" in f.locator(".chat-bulle").last.inner_text()
    assert "mise-en-avant" in f.locator(".aide-equipe").get_attribute("class"), "question pour l'équipe mise en avant"
    href = f.locator("[data-a=aide-mail]").get_attribute("href")
    assert href.startswith("mailto:contact@budgetable.fr?subject=")
    corps = urllib.parse.unquote(href)
    assert "Je veux un remboursement de ma facture" in corps and "Comment résilier ?" in corps
    page.screenshot(path=f"{OUT}/aide_contact.png")
    page.locator("[data-a=aide-fermer]").click(); assert page.locator(".fenetre-aide").count() == 0
    # 2. depuis l'appli : menu « Plus » et profil
    clic = lambda t: page.get_by_role("button", name=t, exact=True).first.click()
    clic("🍽️ Tester gratuitement sans compte")
    for _ in range(25):
        if page.get_by_role("button", name="Voir mon profil").count(): break
        clic("Continuer")
    clic("Voir mon profil"); page.get_by_role("button", name=re.compile("semaine", re.I)).last.click()
    if page.locator("[data-a=tuto-fin]").count(): page.locator("[data-a=tuto-fin]").first.click()
    page.locator(".nav-plus").click(); page.locator(".fenetre-plus [data-a=aide-ouvrir]").click()
    assert page.locator(".fenetre-aide").count() == 1 and page.locator(".fenetre-plus").count() == 0
    assert page.locator(".fenetre-aide .chat-bulle").count() >= 3, "la conversation est gardée"
    page.locator("[data-a=aide-fermer]").click()
    page.locator("nav button[data-k=profil]:visible").click()
    page.locator(".bloc-aide [data-a=aide-ouvrir]").click()
    assert page.locator(".fenetre-aide").count() == 1
    nav.close()
assert not erreurs, erreurs
print("OK aide et contact")
