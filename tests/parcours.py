import re
# Test de bout en bout : questionnaire → profil → semaine → courses → drives → profil.
# Usage : python3 -m http.server 8765 -d dist &  puis  python3 tests/parcours.py [dossier_captures]
import sys, re
from playwright.sync_api import sync_playwright

URL = "http://localhost:8766/index.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
erreurs = []

def cliquer(page, texte):
    page.get_by_role("button", name=texte, exact=True).first.click()

with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 760, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and erreurs.append(m.text))
    page.goto(URL)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.screenshot(path=f"{OUT}/0-accueil.png")
    cliquer(page, "Préparer ma semaine")
    # foyer : 1 adulte + 2 enfants
    page.get_by_role("button", name="Ajouter").nth(1).click()
    page.get_by_role("button", name="Ajouter").nth(1).click()
    cliquer(page, "Continuer")
    assert "âge ont les enfants" in page.inner_text("h1"), "question adaptative des âges absente"
    page.get_by_role("button", name="3–5 ans").nth(1).click()
    page.screenshot(path=f"{OUT}/1-ages.png")
    cliquer(page, "Continuer")
    # premier menu : seulement l'essentiel (régime, allergies, consentement, temps, déjeuners, budget)
    cliquer(page, "Sans porc"); cliquer(page, "Continuer")
    cliquer(page, "Arachide"); cliquer(page, "Lactose"); cliquer(page, "Continuer")
    assert "Garder ces informations" in page.inner_text("h1"), "consentement non demandé"
    page.screenshot(path=f"{OUT}/2-consentement.png")
    cliquer(page, "Continuer")  # pas de consentement
    cliquer(page, "Continuer")  # temps
    cliquer(page, "Continuer")  # matériel
    cliquer(page, "Certains mangent dehors (travail, cantine)")
    page.get_by_role("button", name="Retirer").click()  # l'adulte déjeune au travail
    page.screenshot(path=f"{OUT}/3-dejeuners.png")
    cliquer(page, "Le mercredi"); cliquer(page, "Continuer")
    cliquer(page, "Voir mon profil")  # budget 60, dernière question essentielle
    # puis les questions facultatives (« Affiner »), ici tout de suite depuis la vérification du profil
    page.locator("[data-a=affiner]").first.click()
    assert "Affiner" in page.inner_text(".q-shell")
    cliquer(page, "Ils préfèrent les plats simples"); cliquer(page, "Continuer")
    cliquer(page, "Faire des économies"); cliquer(page, "Continuer")
    cliquer(page, "Continuer")  # niveau
    cliquer(page, "Continuer")  # cuisines
    cliquer(page, "Champignons"); cliquer(page, "Continuer")
    cliquer(page, "Voir mon profil")
    texte = page.inner_text("body")
    assert "Lactose" in texte and "Sans porc" in texte, "profil incomplet"
    page.screenshot(path=f"{OUT}/4-profil.png", full_page=True)
    cliquer(page, "Faire le test de goût")
    page.screenshot(path=f"{OUT}/4b-test.png", full_page=True)
    page.locator("[data-a=gout-tuile][data-k=poulet][data-v=adore]").click()
    page.locator("[data-a=test-etape][data-k=styles]").click()
    page.locator("[data-a=test-etape][data-k=plats]").click()
    for k in range(10):
        assert page.locator(".carte-test-illu img").count() == 1, "plat du test sans vraie photo"
        cliquer(page, ["J’adore", "Pourquoi pas", "Pas pour moi"][k % 3])
        if k % 3 == 2: cliquer(page, "Rien de précis, juste ce plat")
    texte = page.inner_text("body")
    assert "vous aimez" in texte.lower(), "résumé des goûts absent"
    assert "Assistant IA indisponible" in texte, "message IA hors ligne absent"
    page.screenshot(path=f"{OUT}/4c-palais.png", full_page=True)
    cliquer(page, "Créer ma semaine avec ces goûts")
    texte = page.inner_text("body")
    assert "Pris dehors" in texte, "déjeuners dehors non pris en compte"
    assert "prix estimé" in texte.lower(), "étiquette « prix estimé » absente"
    page.screenshot(path=f"{OUT}/5-semaine.png", full_page=True)
    # aucune recette avec lardons/jambon/saucisse/champignons/crème/lait
    for interdit in ["lardons", "jambon", "Saucisses", "champignons", "Crêpes", "Croque"]:
        assert interdit.lower() not in page.inner_text("main").lower(), f"recette interdite : {interdit}"
    # changer un repas
    page.get_by_role("button", name="Changer ce plat").first.click()
    page.locator(".choix-carte").nth(1).get_by_role("button", name="Je choisis ce plat").click()
    # fiche recette + note
    page.locator(".titre-repas").first.click()
    lien = page.get_by_role("link", name=re.compile("Marmiton"))
    href = lien.get_attribute("href"); assert href.startswith("https://www.marmiton.org/recettes/recherche.aspx?aqt="), href
    print("Lien Marmiton :", href)
    lien.scroll_into_view_if_needed(); page.screenshot(path=f"{OUT}/6b-fiche-lien.png")
    page.get_by_role("radio", name="5 sur 5").click()
    page.screenshot(path=f"{OUT}/6-fiche.png")
    cliquer(page, "Fermer")
    # ce soir
    page.locator(".nav-plus").click(); page.get_by_role("button", name="Ce soir").click()
    cliquer(page, "Soulever la cloche")
    page.screenshot(path=f"{OUT}/7-ce-soir.png", full_page=True)
    # courses
    page.locator("nav button", has_text="Courses").click()
    page.screenshot(path=f"{OUT}/8-courses.png", full_page=True)
    assert "Imprimer ou PDF" in page.inner_text("body"), "bouton imprimer absent hors cadre"
    page.get_by_role("radio", name="Carrefour").click()
    lien = page.get_by_role("link", name=re.compile("Chercher .* chez Carrefour")).first
    href = lien.get_attribute("href")
    assert href.startswith("https://www.carrefour.fr/s?q="), href
    assert lien.get_attribute("target") == "_blank"
    print("Exemple de lien :", href)
    page.screenshot(path=f"{OUT}/8b-courses-drive.png", full_page=True)
    # drives
    page.locator("#mes-drives summary").click()
    assert "Mes drives près de chez moi" in page.inner_text("body")
    page.screenshot(path=f"{OUT}/9-drives.png", full_page=True)
    # rechargement : les allergies ne doivent PAS être gardées sans consentement
    page.reload()
    page.locator("nav button[data-k=semaine]").click()
    assert "allergies n’ont pas été gardées" in page.inner_text("body"), "alerte données sensibles absente"
    # bureau
    page.set_viewport_size({"width": 1280, "height": 900})
    page.screenshot(path=f"{OUT}/10-bureau.png")
    page.emulate_media(color_scheme="dark")
    page.screenshot(path=f"{OUT}/11-sombre.png")
    nav.close()

print("Erreurs JS :", erreurs or "aucune")
print("PARCOURS OK" if not erreurs else "PARCOURS AVEC ERREURS")
