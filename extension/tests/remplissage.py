# « Tout mettre au panier » : l'extension cherche chaque article sur le drive et ajoute le moins cher,
# avec la quantité prévue. Drive simulé (pages servies à la place de carrefour.fr, produits fictifs).
import sys, os, json, urllib.parse
from playwright.sync_api import sync_playwright

ICI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
LISTE = {"date": "2026-11-28", "articles": [
    {"id": "lentilles_corail", "nom": "Lentilles corail", "recherche": "lentilles corail", "besoin": "600 g", "unite": "g", "conditionnements": 2, "condLabel": "paquet 500 g"},
    {"id": "riz", "nom": "Riz long", "recherche": "riz long", "besoin": "380 g", "unite": "g", "conditionnements": 1, "condLabel": "paquet 1 kg"},
    {"id": "truffe", "nom": "Truffe noire", "recherche": "truffe noire", "besoin": "10 g", "unite": "g", "conditionnements": 1, "condLabel": "pot"}]}
PRODUITS = {
    "lentilles corail": [("Lentilles corail bio 500 g", "2,40 €", "4,80 € / kg", "L1"), ("Lentilles corail Simpl 500 g", "1,29 €", "2,58 € / kg", "L2"), ("Velouté lentilles corail 1 L", "2,10 €", "2,10 € / l", "L3")],
    "riz long": [("Riz long grain Carrefour 1 kg", "1,65 €", "1,65 € / kg", "R1"), ("Riz long Taureau Ailé 1 kg", "2,99 €", "2,99 € / kg", "R2")],
    "truffe noire": [],
}
def page_recherche(q):
    cartes = "".join(f'''<article><h3 class="title">{t}</h3><span>{p}</span><small>{u}</small>
      <div class="cta" data-sku="{sku}"><button aria-label="Ajouter au panier {t}">Ajouter</button></div></article>''' for t, p, u, sku in PRODUITS.get(q, []))
    return f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Recherche {q}</title></head><body>
    <h1>Résultats pour « {q} »</h1><div id="res"></div>
    <script>
      // le site affiche ses produits un peu après le chargement, et remplace « Ajouter » par un compteur
      const panier = () => JSON.parse(localStorage.getItem('panier-test') || '{{}}');
      setTimeout(() => {{ document.getElementById('res').innerHTML = {json.dumps(cartes) if cartes else json.dumps('<p>Aucun résultat</p>')}; }}, 400);
      document.addEventListener('click', (e) => {{
        const cta = e.target.closest('.cta'); if (!cta) return;
        const sku = cta.dataset.sku, p = panier();
        if (e.target.matches('[data-plus]') || !p[sku]) p[sku] = (p[sku] || 0) + 1;
        localStorage.setItem('panier-test', JSON.stringify(p));
        cta.innerHTML = '<button aria-label="Retirer un produit">-</button><span>' + p[sku] + '</span><button data-plus aria-label="Augmenter la quantité">+</button>';
      }});
    </script></body></html>'''

scripts = "".join(open(os.path.join(ICI, f)).read() + "\n" for f in ["drives.js", "lecture.js", "stockage.js", "panneau.js"])
INIT = "document.addEventListener('DOMContentLoaded', () => { setTimeout(() => {\n" + scripts + "\n}, 50); });"
erreurs = []
with sync_playwright() as p:
    nav = p.chromium.launch()
    page = nav.new_page(viewport={"width": 1100, "height": 900})
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    def servir(route):
        u = urllib.parse.urlparse(route.request.url)
        q = urllib.parse.parse_qs(u.query).get("q", [""])[0]
        html = page_recherche(q) if u.path == "/s" else '<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Accueil drive (test)</h1></body></html>'
        route.fulfill(status=200, content_type="text/html; charset=utf-8", body=html)
    page.route("https://www.carrefour.fr/**", servir)
    page.add_init_script(INIT)
    page.goto("https://www.carrefour.fr/")
    page.evaluate("(l) => { localStorage.clear(); localStorage.setItem('budgetable-ext:liste', JSON.stringify(l)); }", LISTE)
    page.reload(); page.wait_for_timeout(600)
    ombre = lambda: page.evaluate("document.querySelector('#budgetable-panneau').shadowRoot.textContent")
    assert "Tout mettre au panier (3 articles)" in ombre(), ombre()
    page.screenshot(path=f"{OUT}/ext-auto-depart.png")
    page.evaluate("document.querySelector('#budgetable-panneau').shadowRoot.querySelector('[data-a=auto-go]').click()")
    for _ in range(60):
        page.wait_for_timeout(500)
        try:
            if "Panier rempli" in ombre(): break
        except Exception: pass
    t = ombre()
    page.screenshot(path=f"{OUT}/ext-auto-bilan.png")
    assert "✓ Panier rempli" in t, t
    panier = page.evaluate("JSON.parse(localStorage.getItem('panier-test'))")
    print("Panier :", panier)
    assert panier == {"L2": 2, "R1": 1}, "le moins cher, en 2 paquets pour les lentilles ; pas de velouté"
    assert "2 articles ajoutés" in t and "Truffe noire" in t and "Pas trouvés ici" in t, t
    assert "4,23" in t, "total : 2 × 1,29 + 1,65"
    releves = page.evaluate("JSON.parse(localStorage.getItem('budgetable-ext:releves'))")
    assert releves["carrefour"]["lentilles_corail"]["prix"] == 1.29
    # relancer ne rajoute pas ce qui est déjà dans le panier
    page.evaluate("document.querySelector('#budgetable-panneau').shadowRoot.querySelector('[data-a=auto-fermer]').click()")
    page.wait_for_timeout(300)
    assert "Tout mettre au panier (1 article)" in ombre(), ombre()

    # arrêt en cours de route
    page.evaluate("(l) => { localStorage.setItem('budgetable-ext:liste', JSON.stringify(l)); localStorage.setItem('budgetable-ext:ajoutes', '{}'); localStorage.removeItem('panier-test'); }", LISTE)
    page.goto("https://www.carrefour.fr/"); page.wait_for_timeout(500)
    page.evaluate("document.querySelector('#budgetable-panneau').shadowRoot.querySelector('[data-a=auto-go]').click()")
    page.wait_for_timeout(1500)
    assert "Remplissage du panier" in ombre(), ombre()
    page.evaluate("document.querySelector('#budgetable-panneau').shadowRoot.querySelector('[data-a=auto-stop]').click()")
    page.wait_for_timeout(4000)
    t = ombre()
    assert "Remplissage en pause" in t and "Reprendre" in t, t
    assert "/s?q=riz" not in page.url, "après « Arrêter », on ne passe pas à l'article suivant"
    nav.close()
print("Erreurs JS :", erreurs or "aucune")
assert not erreurs
print("REMPLISSAGE OK")
