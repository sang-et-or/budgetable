# Fabrique les images d'épingles (1000×1500 JPEG) dans pinterest/ ; le site doit tourner sur localhost:8766.
import json, sys, pathlib
from playwright.sync_api import sync_playwright
ICI = pathlib.Path(__file__).parent; RACINE = ICI.parent.parent
pins = json.load(open(sys.argv[1])); sortie = RACINE / 'pinterest'; sortie.mkdir(exist_ok=True)
seuls = set(sys.argv[2:])
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1000, 'height': 1500})
    pg.goto('file://' + str(ICI / 'epingle.html')); pg.wait_for_function('window.Engine && window.Visuels'); pg.evaluate('document.fonts.ready')
    manque = []
    for x in pins:
        if seuls and x['slug'] not in seuls: continue
        if not pg.evaluate('(p) => dessiner(p)', x): manque.append(x['nom'])
        pg.evaluate('document.fonts.ready'); pg.screenshot(path=str(sortie / (x['slug'] + '.jpg')), type='jpeg', quality=82)
    b.close()
print('manquent :', manque)
