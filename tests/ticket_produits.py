# Reconnaissance des produits sur des libellés de caisse typiques (mots-clés, abréviations)
import sys
from playwright.sync_api import sync_playwright
CAS = [("COQUILLETTES 500G", "pates"), ("SPAGH. BARILLA 500G", "pates"), ("RIZ LONG GRAIN 1KG", "riz"), ("LAIT DEMI ECR. 1L", "lait"),
       ("LT 1/2 ECR UHT 6X1L", "lait"), ("YAOURT NATURE X8", "yaourt"), ("FROMAGE BLANC 0% 1KG", "fromage_blanc"), ("EMMENTAL RAPE 200G", "emmental"),
       ("BEURRE DOUX 250G", "beurre"), ("OEUFS PLEIN AIR X6", "oeufs"), ("JAMBON BLANC X4", "jambon"), ("LARDONS FUMES 2X100G", "lardons"),
       ("FILET POULET 500G", "poulet_filet"), ("STEAK HACHE 5% X4", "boeuf_hache"), ("PAVES SAUMON X2", "saumon"), ("THON NATUREL 3X", "thon"),
       ("TOMATES CONCASSEES 400G", "tomates_concassees"), ("PDT 2,5KG", "pomme_de_terre"), ("CAROTTES 1KG", "carotte"), ("OIGNONS JAUNES 1KG", "oignon"),
       ("COURGETTES", "courgette"), ("BANANES", "banane"), ("POMMES GOLDEN 1,5KG", "pomme"), ("CREME FRAICHE EPAISSE 20CL", "creme"),
       ("FARINE T45 1KG", "farine"), ("SUCRE POUDRE 1KG", "sucre"), ("HUILE OLIVE 1L", "huile_olive"), ("LENTILLES VERTES 500G", "lentilles_vertes"),
       ("POIS CHICHES 400G", "pois_chiches"), ("BAGUETTE TRADITION", "pain"), ("MOZZARELLA 125G", "mozzarella"), ("CHAMPIGNONS PARIS 250G", "champignon"),
       ("LAIT DE COCO 400ML", "lait_coco"), ("PATE FEUILLETEE", "pate_feuilletee"), ("CAFE MOULU 250G", "cafe"), ("CHOCOLAT NOIR 200G", "chocolat"),
       ("YAOU AUX FRUITS X12", "yaourt"), ("EMMENT. RAPE", "emmental"), ("POIREAUX BOTTE", "poireau"), ("BROCOLI", "brocoli"), ("SEMOULE MOYENNE 1KG", "semoule")]
with sync_playwright() as p:
    nav = p.chromium.launch(); page = nav.new_page()
    page.route("https://budgetable-recettes.onrender.com/**", lambda r: r.abort())
    page.goto("http://localhost:8766/index.html")
    res = page.evaluate("""(cas) => { const E = window.Engine, T = window.Ticket;
      const idx = T.indexCatalogue(Object.values(E.ING).filter((i) => !i.perso && !i.libre).map((i) => ({ id: i.id, nom: i.nom, synonymes: window.Saisie.synonymes(i.id) })));
      return cas.map(([l, attendu]) => { const r = T.reconnaitreProduit(l, idx); return [l, attendu, r.id, r.score]; }); }""", CAS)
    ok = [r for r in res if r[1] == r[2]]
    for r in res:
        if r[1] != r[2]: print("  ✗", r)
    print(f"{len(ok)}/{len(res)} reconnus")
    assert len(ok) >= len(res) - 2
    bruit = page.evaluate("""(l) => { const E = window.Engine, T = window.Ticket; const idx = T.indexCatalogue(Object.values(E.ING).filter((i) => !i.perso && !i.libre).map((i) => ({ id: i.id, nom: i.nom, synonymes: window.Saisie.synonymes(i.id) }))); return l.map((x) => [x, T.reconnaitreProduit(x, idx).id]); }""", ["WQ KXZ RT", "ZZXQ 4521", "BON ACHAT", "QRT LMNP", "VDF"])
    print("bruit :", bruit)
    assert all(b[1] is None for b in bruit), bruit
    print("TICKET PRODUITS OK")
    nav.close()
