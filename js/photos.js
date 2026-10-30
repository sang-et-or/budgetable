/* Budgétable — photos d'illustration des plats (V0.5)
 *
 * Source : Wikimedia Commons, photos sous licence libre (CC0, domaine public, CC BY, CC BY-SA).
 * Chaque photo est créditée (auteur, licence, lien) dans la fiche recette et dans « Crédits photos ».
 * Ce sont des photos d'illustration : le plat préparé avec la recette peut être un peu différent.
 * Une photo par recette « maison » et une par type de plat généré (clé « g:famille|protéine|… »).
 * Si la photo ne charge pas (hors ligne), l'illustration dessinée s'affiche à la place.
 */
(function (root) {
  const T = 'https://upload.wikimedia.org/wikipedia/commons/thumb/';
  // [clé, chemin de la miniature après /commons/thumb/, fichier Commons, auteur, licence]
  const LISTE = [
    ['bolognaise', '4/4f/Spaghetti_bolognese_at_Antell_Martintalo.jpg/500px-Spaghetti_bolognese_at_Antell_Martintalo.jpg', 'Spaghetti_bolognese_at_Antell_Martintalo.jpg', 'JIP', 'CC BY-SA 4.0'],
    ['curry_poulet', 'e/e1/Friday_dinner_-_Curry_chicken_with_bell_peppers_and_rice_-_01.jpg/500px-Friday_dinner_-_Curry_chicken_with_bell_peppers_and_rice_-_01.jpg', 'Friday_dinner_-_Curry_chicken_with_bell_peppers_and_rice_-_01.jpg', 'Infrogmation of New Orleans', 'CC BY-SA 4.0'],
    ['dahl', '3/39/Daal_after_Tadka_Pulse_Soup_India.jpg/500px-Daal_after_Tadka_Pulse_Soup_India.jpg', 'Daal_after_Tadka_Pulse_Soup_India.jpg', 'aimee rivers', 'CC BY-SA 2.0'],
    ['tortilla_espagnole', 'c/c0/Tortilla_de_Patatas_%28Corte_transversal%29.jpg/500px-Tortilla_de_Patatas_%28Corte_transversal%29.jpg', 'Tortilla_de_Patatas_(Corte_transversal).jpg', 'Tamorlan', 'CC BY-SA 3.0'],
    ['quiche_poireaux', 'b/be/Bywater_Bakery_Quiche_New_Orleans_April_2018.jpg/500px-Bywater_Bakery_Quiche_New_Orleans_April_2018.jpg', 'Bywater_Bakery_Quiche_New_Orleans_April_2018.jpg', 'Infrogmation of New Orleans', 'CC BY-SA 4.0'],
    ['gratin_pates', 'e/e5/Chicken_macaroni_gratin_%288256535271%29.jpg/500px-Chicken_macaroni_gratin_%288256535271%29.jpg', 'Chicken_macaroni_gratin_(8256535271).jpg', 'pelican from Tokyo, Japan', 'CC BY-SA 2.0'],
    ['chili_carne', '5/50/Bowl_of_chili.jpg/500px-Bowl_of_chili.jpg', 'Bowl_of_chili.jpg', 'Carstor', 'CC BY-SA 2.5'],
    ['chili_sin_carne', '8/85/Two-Bean_Vegetarian_Chili.jpg/500px-Two-Bean_Vegetarian_Chili.jpg', 'Two-Bean_Vegetarian_Chili.jpg', 'Thriving Vegetarian', 'CC BY 2.0'],
    ['saumon_riz', 'e/eb/Salmon_with_Lime_%26_Garlic_Butter_%284437041010%29.jpg/500px-Salmon_with_Lime_%26_Garlic_Butter_%284437041010%29.jpg', 'Salmon_with_Lime_%26_Garlic_Butter_(4437041010).jpg', 'Ewan Munro', 'CC BY-SA 2.0'],
    ['colin_papillote', '6/63/Branzino_al_cartoccio.jpg/500px-Branzino_al_cartoccio.jpg', 'Branzino_al_cartoccio.jpg', '10Rosso', 'CC BY 2.0'],
    ['wraps_poulet', 'f/f8/Smoked_chicken_and_avocado_wrap.jpg/500px-Smoked_chicken_and_avocado_wrap.jpg', 'Smoked_chicken_and_avocado_wrap.jpg', 'Takeaway', 'CC BY-SA 3.0'],
    ['salade_lentilles', '2/2b/Lentil_salad_%287668557930%29.jpg/500px-Lentil_salad_%287668557930%29.jpg', 'Lentil_salad_(7668557930).jpg', 'Lablascovegmenu', 'CC BY 2.0'],
    ['taboule', 'b/ba/Flickr_-_cyclonebill_-_Tabbouleh.jpg/500px-Flickr_-_cyclonebill_-_Tabbouleh.jpg', 'Flickr_-_cyclonebill_-_Tabbouleh.jpg', 'cyclonebill', 'CC BY-SA 2.0'],
    ['soupe_legumes', '6/6b/Traditional_Vegetable_Soup_from_Argentina.jpg/500px-Traditional_Vegetable_Soup_from_Argentina.jpg', 'Traditional_Vegetable_Soup_from_Argentina.jpg', 'Horacio Cambeiro', 'CC BY-SA 3.0'],
    ['veloute_butternut', '6/62/Butternut_squash_soup_%285171665819%29.jpg/500px-Butternut_squash_soup_%285171665819%29.jpg', 'Butternut_squash_soup_(5171665819).jpg', 'Karen and Brad Emerson', 'CC BY 2.0'],
    ['riz_cantonais', '3/31/Fried_Rice_1_%28Eggs_%26_Vegetables%29.jpg/500px-Fried_Rice_1_%28Eggs_%26_Vegetables%29.jpg', 'Fried_Rice_1_(Eggs_%26_Vegetables).jpg', 'Gary Dee', 'CC BY-SA 4.0'],
    ['saute_tofu', '6/6f/Homemade_Chinese_stir_fry_noodles.jpg/500px-Homemade_Chinese_stir_fry_noodles.jpg', 'Homemade_Chinese_stir_fry_noodles.jpg', 'Sonny doe', 'CC BY-SA 4.0'],
    ['poulet_roti', '5/57/Chicken_leg_quarter_20260412_145303.jpg/500px-Chicken_leg_quarter_20260412_145303.jpg', 'Chicken_leg_quarter_20260412_145303.jpg', 'Vauia Rex', 'CC0'],
    ['croque', 'e/eb/Cambodian_Croque_Monsieur.jpg/500px-Cambodian_Croque_Monsieur.jpg', 'Cambodian_Croque_Monsieur.jpg', 'Photogoddle', 'CC BY-SA 4.0'],
    ['pizza_tortilla', '8/87/Pizza_Capricciosa_on_a_wooden_rustic_table_%2849255425326%29.jpg/500px-Pizza_Capricciosa_on_a_wooden_rustic_table_%2849255425326%29.jpg', 'Pizza_Capricciosa_on_a_wooden_rustic_table_(49255425326).jpg', 'Nenad Stojkovic', 'CC BY 2.0'],
    ['parmentier', '5/5b/Hachis_parmentier_01.jpg/500px-Hachis_parmentier_01.jpg', 'Hachis_parmentier_01.jpg', 'Bycro', 'CC BY-SA 4.0'],
    ['couscous_legumes', 'c/cc/Couscous_with_vegetables_%D9%83%D8%B3%D9%83%D8%B3_%D8%A8%D8%A7%D9%84%D8%AE%D8%B6%D8%B1%D8%A9_TN.jpg/500px-Couscous_with_vegetables_%D9%83%D8%B3%D9%83%D8%B3_%D8%A8%D8%A7%D9%84%D8%AE%D8%B6%D8%B1%D8%A9_TN.jpg', 'Couscous_with_vegetables_%D9%83%D8%B3%D9%83%D8%B3_%D8%A8%D8%A7%D9%84%D8%AE%D8%B6%D8%B1%D8%A9_TN.jpg', 'Meriem Mach', 'CC BY-SA 4.0'],
    ['shakshuka', 'e/e3/Shakshuka_Dish.jpg/500px-Shakshuka_Dish.jpg', 'Shakshuka_Dish.jpg', 'Junbinhuang', 'CC BY 4.0'],
    ['saucisses_lentilles', '8/8c/Linsen_Spaetzle_2.jpg/500px-Linsen_Spaetzle_2.jpg', 'Linsen_Spaetzle_2.jpg', 'K. Jähne, B. Gross, Merops', 'CC BY-SA 3.0'],
    ['risotto', 'e/ed/Mushroom_and_Leek_Risotto_%2849535206656%29.jpg/500px-Mushroom_and_Leek_Risotto_%2849535206656%29.jpg', 'Mushroom_and_Leek_Risotto_(49535206656).jpg', 'spurekar', 'CC BY 2.0'],
    ['pates_thon', '6/6e/Spaghetti_with_skipjack_tuna_sauce.jpg/500px-Spaghetti_with_skipjack_tuna_sauce.jpg', 'Spaghetti_with_skipjack_tuna_sauce.jpg', 'Miyuki Meinaka', 'CC BY-SA 4.0'],
    ['salade_pates', 'e/e1/Pasta_salad_closeup.JPG/500px-Pasta_salad_closeup.JPG', 'Pasta_salad_closeup.JPG', 'Brynn', 'CC BY-SA 3.0'],
    ['crepes_salees', '0/08/Galette_de_sarrasin_compl%C3%A8te_bretonne.jpg/500px-Galette_de_sarrasin_compl%C3%A8te_bretonne.jpg', 'Galette_de_sarrasin_compl%C3%A8te_bretonne.jpg', 'Arnaud 25', 'CC BY-SA 4.0'],
    ['gratin_aubergines', '8/8b/Melanzane_alla_Parmigiana.jpg/500px-Melanzane_alla_Parmigiana.jpg', 'Melanzane_alla_Parmigiana.jpg', 'Blue Lotus (Flickr)', 'CC BY 2.0'],
    ['boulettes_semoule', 'e/e7/Meatballs_with_tomato_sauce_%28Spain%29.jpg/500px-Meatballs_with_tomato_sauce_%28Spain%29.jpg', 'Meatballs_with_tomato_sauce_(Spain).jpg', 'Juan Emilio Prades Bel', 'CC BY 4.0'],
    // vraies photos des recettes originales (lot 2), vérifiées une à une
    ['curry_patate_douce', 'e/e6/Sweet_potato_curry_%2810362720945%29.jpg/500px-Sweet_potato_curry_%2810362720945%29.jpg', 'Sweet_potato_curry_(10362720945).jpg', 'pelican from Tokyo, Japan', 'CC BY-SA 2.0'],
    ['soupe_pois_casses', '1/11/Split_Pea_Soup_%284027490495%29.jpg/500px-Split_Pea_Soup_%284027490495%29.jpg', 'Split_Pea_Soup_(4027490495).jpg', 'Kari Sullivan', 'CC BY 2.0'],
    ['galettes_pdt', '2/2b/Potato_pancakes.jpg/500px-Potato_pancakes.jpg', 'Potato_pancakes.jpg', 'Daniel Spils', 'CC BY-SA 2.0'],
    ['riz_rouge_pois_chiches', 'f/f0/Paella_vegetariana_a_Font_d%27En_Corts.jpg/500px-Paella_vegetariana_a_Font_d%27En_Corts.jpg', "Paella_vegetariana_a_Font_d'En_Corts.jpg", 'Francesc Fort', 'CC BY-SA 4.0'],
    ['pates_brocoli', 'e/e5/BroccoliPasta.jpg/500px-BroccoliPasta.jpg', 'BroccoliPasta.jpg', 'AnticoMu90', 'CC BY-SA 4.0'],
    ['poulet_poivrons', '9/98/Poulet_basquaise_01.jpg/500px-Poulet_basquaise_01.jpg', 'Poulet_basquaise_01.jpg', 'Arnaud 25', 'CC BY-SA 4.0'],
    ['gratin_courge_pdt', 'f/f0/Gratin_courge_butternut_1.jpg/500px-Gratin_courge_butternut_1.jpg', 'Gratin_courge_butternut_1.jpg', 'DocteurCosmos', 'CC BY 3.0'],
    ['tofu_brouille', '5/5b/Tofu_Scramble_in_New_Orleans.jpg/500px-Tofu_Scramble_in_New_Orleans.jpg', 'Tofu_Scramble_in_New_Orleans.jpg', 'Bart Everson', 'CC BY 2.0'],
    ['lentilles_carottes', '5/5b/Rago%C3%BBt_aux_lentilles.jpg/500px-Rago%C3%BBt_aux_lentilles.jpg', 'Ragoût_aux_lentilles.jpg', 'Zantastik', 'CC BY-SA 3.0'],
    ['veloute_poireaux_pdt', '2/26/Potato_Leek_Soup_%284258747258%29.jpg/500px-Potato_Leek_Soup_%284258747258%29.jpg', 'Potato_Leek_Soup_(4258747258).jpg', 'Vegan Feast Catering', 'CC BY 2.0'],
    ['salade_riz_thon', '4/4d/Rice_salad_%283513765313%29.jpg/500px-Rice_salad_%283513765313%29.jpg', 'Rice_salad_(3513765313).jpg', 'Karen and Brad Emerson', 'CC BY 2.0'],
    ['salade_quinoa_feta', 'd/dc/Quinoa_Salad_%285045982815%29.jpg/500px-Quinoa_Salad_%285045982815%29.jpg', 'Quinoa_Salad_(5045982815).jpg', 'Geoff Peters', 'CC BY 2.0'],
    ['riz_saute_chou', '5/5a/Veg_fried_rice_homemade.jpg/500px-Veg_fried_rice_homemade.jpg', 'Veg_fried_rice_homemade.jpg', 'Shafana jasmine', 'CC BY-SA 4.0'],
    ['tortillas_haricots', '4/45/Vegetables_and_Black_Bean_Tacos_%287212559656%29.jpg/500px-Vegetables_and_Black_Bean_Tacos_%287212559656%29.jpg', 'Vegetables_and_Black_Bean_Tacos_(7212559656).jpg', 'Jennifer from Vancouver, Canada', 'CC BY 2.0'],
    ['pdt_four_yaourt', '4/46/Roasted_Potato_Wedges_with_Shallots_and_Rosemary_%285706897999%29.jpg/500px-Roasted_Potato_Wedges_with_Shallots_and_Rosemary_%285706897999%29.jpg', 'Roasted_Potato_Wedges_with_Shallots_and_Rosemary_(5706897999).jpg', 'Rooey202', 'CC BY 2.0'],
    ['soupe_haricots_pates', '3/32/Minestrone_soup.jpg/500px-Minestrone_soup.jpg', 'Minestrone_soup.jpg', 'Katrin Morenz', 'CC BY-SA 2.0'],
    ['patates_douces_haricots', '7/78/Roasted_sweet_potato.jpg/500px-Roasted_sweet_potato.jpg', 'Roasted_sweet_potato.jpg', 'Silentpilot', 'CC0'],
    ['oeufs_cocotte', '2/24/Oeuf_cocotte.jpg/500px-Oeuf_cocotte.jpg', 'Oeuf_cocotte.jpg', 'Jpbrigand2', 'CC BY-SA 4.0'],
    ['poulet_moutarde', 'a/ac/-2019-03-06_Creamy_mustard_chicken_with_broccoli.JPG/500px--2019-03-06_Creamy_mustard_chicken_with_broccoli.JPG', '-2019-03-06_Creamy_mustard_chicken_with_broccoli.JPG', 'Kolforn', 'CC BY-SA 4.0'],
    ['chou_lardons', '3/3a/Bacon_and_cabbage_side_dish.jpg/500px-Bacon_and_cabbage_side_dish.jpg', 'Bacon_and_cabbage_side_dish.jpg', 'MOs810', 'CC BY-SA 3.0'],
    ['soupe_corail', '6/65/Mercimek_%C3%A7orbasi.jpg/500px-Mercimek_%C3%A7orbasi.jpg', 'Mercimek_çorbasi.jpg', 'E4024', 'CC BY-SA 4.0'],
    ['bowl_tofu', '6/66/Salt_%26_Pepper_Tofu_Rice_Bowl_-_Tiger_Bites_Pig_2025-11-20.jpg/500px-Salt_%26_Pepper_Tofu_Rice_Bowl_-_Tiger_Bites_Pig_2025-11-20.jpg', 'Salt_%26_Pepper_Tofu_Rice_Bowl_-_Tiger_Bites_Pig_2025-11-20.jpg', 'Andy Li', 'CC0'],
    ['poulet_quinoa', 'c/cc/Quinoa_con_salteado_de_pollo_y_calabac%C3%ADn.jpg/500px-Quinoa_con_salteado_de_pollo_y_calabac%C3%ADn.jpg', 'Quinoa_con_salteado_de_pollo_y_calabacín.jpg', 'Crguti03', 'CC BY-SA 4.0'],
    ['salade_haricots_thon', '1/11/Insalata_di_Fagioli_e_Tonno_%E2%80%93_Bohnensalat_mit_Thunfisch_%287327273414%29.jpg/500px-Insalata_di_Fagioli_e_Tonno_%E2%80%93_Bohnensalat_mit_Thunfisch_%287327273414%29.jpg', 'Insalata_di_Fagioli_e_Tonno_–_Bohnensalat_mit_Thunfisch_(7327273414).jpg', 'Katrin Gilger', 'CC BY-SA 2.0'],
    ['m:poelee', '9/98/Sichuan_pepper_chicken_-_air-fried_version_%28%E5%B7%9D%E6%A4%92%E9%9B%9E_-_%E6%B0%A3%E7%82%B8%E7%89%88%29.jpg/500px-Sichuan_pepper_chicken_-_air-fried_version_%28%E5%B7%9D%E6%A4%92%E9%9B%9E_-_%E6%B0%A3%E7%82%B8%E7%89%88%29.jpg', 'Sichuan_pepper_chicken_-_air-fried_version_(%E5%B7%9D%E6%A4%92%E9%9B%9E_-_%E6%B0%A3%E7%82%B8%E7%89%88).jpg', 'NeoBatfreak', 'CC BY-SA 4.0'],
    ['m:curry', 'b/b3/Mixed_vegetable_curry_2.jpg/500px-Mixed_vegetable_curry_2.jpg', 'Mixed_vegetable_curry_2.jpg', 'Dolon Prova', 'CC BY-SA 4.0'],
    ['m:wok', 'd/d2/Stir_Fry_Wok_-_Free_For_Commercial_Use_-_FFCU_%2827159057131%29.jpg/500px-Stir_Fry_Wok_-_Free_For_Commercial_Use_-_FFCU_%2827159057131%29.jpg', 'Stir_Fry_Wok_-_Free_For_Commercial_Use_-_FFCU_(27159057131).jpg', 'Free for Commercial Use', 'CC BY-SA 2.0'],
    ['m:gratin', '5/55/Gratin_dauphinois_p1040854.jpg/500px-Gratin_dauphinois_p1040854.jpg', 'Gratin_dauphinois_p1040854.jpg', 'David Monniaux', 'CC BY-SA 3.0'],
    ['m:pates', '6/65/Pork_tagliatelle_pasta_dish_at_restaurant_in_Rome%2C_Italy.jpg/500px-Pork_tagliatelle_pasta_dish_at_restaurant_in_Rome%2C_Italy.jpg', 'Pork_tagliatelle_pasta_dish_at_restaurant_in_Rome,_Italy.jpg', 'Philip Mallis', 'CC BY-SA 2.0'],
    ['m:salade', '9/97/Salad_bowl_in_Tampere.jpg/500px-Salad_bowl_in_Tampere.jpg', 'Salad_bowl_in_Tampere.jpg', 'JIP', 'CC BY-SA 4.0'],
    ['m:bowl', '5/53/BuddhaBowlLot.jpg/500px-BuddhaBowlLot.jpg', 'BuddhaBowlLot.jpg', 'PizzaMan', 'CC BY-SA 4.0'],
    ['m:mijote', 'a/a3/Irish_stew.jpg/500px-Irish_stew.jpg', 'Irish_stew.jpg', 'charles Haynes', 'CC BY-SA 2.0'],
    ['m:quiche', '7/7b/Quiche_slice%2C_homemade_-_Massachusetts.jpg/500px-Quiche_slice%2C_homemade_-_Massachusetts.jpg', 'Quiche_slice,_homemade_-_Massachusetts.jpg', 'Daderot', 'CC0'],
    ['m:omelette', 'b/b1/FoodOmelete.jpg/500px-FoodOmelete.jpg', 'FoodOmelete.jpg', 'Renee Comet', 'Domaine public'],
    ['m:wraps', '0/00/Falafel_%26Tzatziki_Wrap_-_Lavash.jpg/500px-Falafel_%26Tzatziki_Wrap_-_Lavash.jpg', 'Falafel_%26Tzatziki_Wrap_-_Lavash.jpg', 'Andy Li', 'CC0'],
    ['m:pizza', 'a/a3/Eq_it-na_pizza-margherita_sep2005_sml.jpg/500px-Eq_it-na_pizza-margherita_sep2005_sml.jpg', 'Eq_it-na_pizza-margherita_sep2005_sml.jpg', 'Valerio Capello', 'CC BY-SA 3.0']
  ];
  const LICENCES = {
    'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/deed.fr',
    'Domaine public': 'https://commons.wikimedia.org/wiki/Commons:Licensing/fr',
    'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/deed.fr', 'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/deed.fr', 'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/deed.fr',
    'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/deed.fr', 'CC BY-SA 2.5': 'https://creativecommons.org/licenses/by-sa/2.5/deed.fr',
    'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/deed.fr', 'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr'
  };
  const PHOTOS = Object.fromEntries(LISTE.map(([cle, chemin, fichier, auteur, licence]) => [cle, {
    src: T + chemin, page: 'https://commons.wikimedia.org/wiki/File:' + fichier, auteur, licence, licenceUrl: LICENCES[licence] || ''
  }]));
  // recettes sans photo propre : celle de leur famille
  PHOTOS.omelette_champignons = PHOTOS['m:omelette'];
  PHOTOS['m:veloute'] = PHOTOS.veloute_butternut;
  // recette maison illustrée par la photo d'un plat très proche
  PHOTOS.hachis_lentilles = PHOTOS.parmentier;

  // Une vraie photo par type de plat généré (famille + ingrédient principal, + féculent ou sauce si ça change l'aspect)
  // et pour les dernières recettes maison. Vérifiées une à une. [clé, chemin après /wikipedia/commons/, fichier, auteur, licence]
  const C = 'https://upload.wikimedia.org/wikipedia/commons/';
  const PAR_TYPE = [
    ["g:poelee|poulet_filet", "thumb/8/83/Fried_chicken_with_vegetables_and_rice.jpg/500px-Fried_chicken_with_vegetables_and_rice.jpg", "Fried_chicken_with_vegetables_and_rice.jpg", "Wilfredor", "CC0"],
    ["g:poelee|boeuf_hache", "thumb/5/5b/Chinese_stir-fried_vegetables_with_minced_meat_%285993310313%29.jpg/500px-Chinese_stir-fried_vegetables_with_minced_meat_%285993310313%29.jpg", "Chinese_stir-fried_vegetables_with_minced_meat_(5993310313).jpg", "pelican from Tokyo, Japan", "CC BY-SA 2.0"],
    ["g:poelee|saumon", "thumb/7/7c/Salmon%2C_pan-seared_and_glazed%2C_with_Brussels_sprouts_and_root_vegetables_-_Massachusetts.jpg/500px-Salmon%2C_pan-seared_and_glazed%2C_with_Brussels_sprouts_and_root_vegetables_-_Massachusetts.jpg", "Salmon,_pan-seared_and_glazed,_with_Brussels_sprouts_and_root_vegetables_-_Massachusetts.jpg", "Daderot", "CC0"],
    ["g:poelee|colin", "thumb/3/3e/Pan-fried_white_fish_fillet_with_vegetables.jpg/500px-Pan-fried_white_fish_fillet_with_vegetables.jpg", "Pan-fried_white_fish_fillet_with_vegetables.jpg", "Armineaghayan", "CC BY-SA 4.0"],
    ["g:poelee|tofu", "thumb/3/37/Horka_Litinova_Panev_Tofu_Zlaty_Klas_2025.jpg/500px-Horka_Litinova_Panev_Tofu_Zlaty_Klas_2025.jpg", "Horka_Litinova_Panev_Tofu_Zlaty_Klas_2025.jpg", "Mojmir Churavy", "CC0"],
    ["g:poelee|pois_chiches", "thumb/4/4f/Spinach-Chickpea_Curry_%283117324894%29.jpg/500px-Spinach-Chickpea_Curry_%283117324894%29.jpg", "Spinach-Chickpea_Curry_(3117324894).jpg", "Kari Sullivan", "CC BY 2.0"],
    ["g:poelee|saucisse", "thumb/6/64/Sausage%2C_fried_red_potato%2C_and_frozen_mixed_vegetables_%285010050320%29.jpg/500px-Sausage%2C_fried_red_potato%2C_and_frozen_mixed_vegetables_%285010050320%29.jpg", "Sausage,_fried_red_potato,_and_frozen_mixed_vegetables_(5010050320).jpg", "Gwen", "CC BY 2.0"],
    ["g:poelee|haricots_rouges", "thumb/1/12/Rajma_Chawal_by_Rama_Bhave.jpg/500px-Rajma_Chawal_by_Rama_Bhave.jpg", "Rajma_Chawal_by_Rama_Bhave.jpg", "Shreya151994", "CC BY-SA 4.0"],
    ["g:poelee|lardons", "thumb/c/cd/Bratkartoffeln_1024_768.jpg/500px-Bratkartoffeln_1024_768.jpg", "Bratkartoffeln_1024_768.jpg", "Eckhard Polesny", "Domaine public"],
    ["g:curry|saumon", "thumb/6/63/Salmon_with_masala_paste%2C_butternut_curry%2C_rice_%28382113238%29.jpg/500px-Salmon_with_masala_paste%2C_butternut_curry%2C_rice_%28382113238%29.jpg", "Salmon_with_masala_paste,_butternut_curry,_rice_(382113238).jpg", "Gordon Joly", "CC BY-SA 2.0"],
    ["g:curry|colin", "thumb/5/52/South_Indian_Fish_Curry_with_Steamed_Rice-Chennai-TamilNadu-DSC0001.jpg/500px-South_Indian_Fish_Curry_with_Steamed_Rice-Chennai-TamilNadu-DSC0001.jpg", "South_Indian_Fish_Curry_with_Steamed_Rice-Chennai-TamilNadu-DSC0001.jpg", "Jen 0309", "CC BY-SA 4.0"],
    ["g:curry|tofu", "thumb/2/29/Kaeng_phet_mu.jpg/500px-Kaeng_phet_mu.jpg", "Kaeng_phet_mu.jpg", "Takeaway", "CC BY-SA 3.0"],
    ["g:curry|pois_chiches", "thumb/a/a3/Chana_Masala_in_Paul%C3%ADnia%2C_2023-10-16.jpg/500px-Chana_Masala_in_Paul%C3%ADnia%2C_2023-10-16.jpg", "Chana_Masala_in_Paulínia,_2023-10-16.jpg", "Parzeus", "CC BY-SA 4.0"],
    ["g:curry|lentilles_corail", "thumb/4/42/Red_lentil_curry_soup.jpg/500px-Red_lentil_curry_soup.jpg", "Red_lentil_curry_soup.jpg", "Cookipedia.co.uk", "CC BY 4.0"],
    ["g:wok|poulet_filet", "thumb/3/3c/DSCF1165_Crispy_fried_pork_with_peanuts_fresh_green_chilies_and_kaffir_lime_leaves_-_a_spicy_crunchy_Thai-style_appetizer.jpg/500px-DSCF1165_Crispy_fried_pork_with_peanuts_fresh_green_chilies_and_kaffir_lime_leaves_-_a_spicy_crunchy_Thai-style_appetizer.jpg", "DSCF1165_Crispy_fried_pork_with_peanuts_fresh_green_chilies_and_kaffir_lime_leaves_-_a_spicy_crunchy_Thai-style_appetizer.jpg", "PattayaPatrol", "CC BY-SA 4.0"],
    ["g:wok|tofu", "thumb/f/fb/Salt_and_Pepper_Tofu_-_Little_Beijing_AUD15.80_%284714471644%29.jpg/500px-Salt_and_Pepper_Tofu_-_Little_Beijing_AUD15.80_%284714471644%29.jpg", "Salt_and_Pepper_Tofu_-_Little_Beijing_AUD15.80_(4714471644).jpg", "Alpha", "CC BY-SA 2.0"],
    ["g:wok|saumon", "thumb/6/61/Sesame_Soy_Glazed_Skuna_Bay_Salmon_-_2.jpg/500px-Sesame_Soy_Glazed_Skuna_Bay_Salmon_-_2.jpg", "Sesame_Soy_Glazed_Skuna_Bay_Salmon_-_2.jpg", "HarshLight", "CC BY 2.0"],
    ["g:wok|boeuf_hache", "thumb/5/58/Beef_and_broccoli_stir_fry.jpg/500px-Beef_and_broccoli_stir_fry.jpg", "Beef_and_broccoli_stir_fry.jpg", "Joy", "CC BY 2.0"],
    ["g:gratin|jambon|pates", "thumb/d/d2/A_Baked_Pasta_with_Double_Cheese_and_Ham.jpg/500px-A_Baked_Pasta_with_Double_Cheese_and_Ham.jpg", "A_Baked_Pasta_with_Double_Cheese_and_Ham.jpg", "Peachyeung316", "CC BY-SA 4.0"],
    ["g:gratin|lardons|pates", "thumb/f/fd/Peachyeung_picture_taken_20208112.jpg/500px-Peachyeung_picture_taken_20208112.jpg", "Peachyeung_picture_taken_20208112.jpg", "Peachyeung316", "CC BY-SA 4.0"],
    ["g:gratin|thon|pates", "f/fa/Tuna_Casserole2.jpg", "Tuna_Casserole2.jpg", "B.D.'s world", "CC BY-SA 2.0"],
    ["g:gratin|boeuf_hache|pates", "thumb/1/16/Pastitsio_homemade.jpg/500px-Pastitsio_homemade.jpg", "Pastitsio_homemade.jpg", "Sam Bailey", "CC BY-SA 4.0"],
    ["g:gratin|lardons|pomme_de_terre", "thumb/5/58/Tartiflette_2.jpg/500px-Tartiflette_2.jpg", "Tartiflette_2.jpg", "Arnaud 25", "Domaine public"],
    ["g:pates|jambon|cre", "thumb/3/3a/Made_pasta_for_dinner._Leftover_Christmas_ham_and_Broccoli_in_a_Cream_Sauce._Turned_out_even_better_than_I_hoped._Secret_to_cream_sauces%2C_keep_it_simple_and_use_patience._%2832274116756%29.jpg/500px-thumbnail.jpg", "Made_pasta_for_dinner._Leftover_Christmas_ham_and_Broccoli_in_a_Cream_Sauce._Turned_out_even_better_than_I_hoped._Secret_to_cream_sauces,_keep_it_simple_and_use_patience._(32274116756).jpg", "transcendancing", "CC BY-SA 2.0"],
    ["g:pates|lardons|tom", "thumb/5/58/Spinach_and_bacon_pasta_with_tomato_sauce_%283515113305%29.jpg/500px-Spinach_and_bacon_pasta_with_tomato_sauce_%283515113305%29.jpg", "Spinach_and_bacon_pasta_with_tomato_sauce_(3515113305).jpg", "pelican from Tokyo, Japan", "CC BY-SA 2.0"],
    ["g:pates|lardons|cre", "thumb/0/03/Pasta_with_cream_sauce_bacon_and_mushroom.jpg/500px-Pasta_with_cream_sauce_bacon_and_mushroom.jpg", "Pasta_with_cream_sauce_bacon_and_mushroom.jpg", "Geoffreyrabbit", "CC BY-SA 4.0"],
    ["g:pates|poulet_filet|tom", "thumb/8/84/Fresh_Chicken_in_Tomato_Sauce_Pasta.jpg/500px-Fresh_Chicken_in_Tomato_Sauce_Pasta.jpg", "Fresh_Chicken_in_Tomato_Sauce_Pasta.jpg", "Ralff Nestor Nacor", "CC BY-SA 4.0"],
    ["g:pates|thon|cre", "thumb/4/49/Tuna_Carbonara.webp/500px-Tuna_Carbonara.webp", "Tuna_Carbonara.webp", "RiaSrl", "CC0"],
    ["g:pates|poulet_filet|cre", "thumb/8/84/Pasta_chicken_with_cream_sauce_%282382791628%29.jpg/500px-Pasta_chicken_with_cream_sauce_%282382791628%29.jpg", "Pasta_chicken_with_cream_sauce_(2382791628).jpg", "Glen Edelson", "CC BY 2.0"],
    ["g:pates|boeuf_hache|cre", "thumb/e/e4/Argentine_Tirabuz%C3%B3n_Molto_pasta_stew_with_ground_beef_and_tomato_sauce.jpg/500px-Argentine_Tirabuz%C3%B3n_Molto_pasta_stew_with_ground_beef_and_tomato_sauce.jpg", "Argentine_Tirabuzón_Molto_pasta_stew_with_ground_beef_and_tomato_sauce.jpg", "Horacio Cambeiro", "CC BY-SA 3.0"],
    ["g:pates|saumon|tom", "thumb/d/db/HopMonk_Tavern_Sonoma_-_July_2023_-_Sarah_Stierch.jpg/500px-HopMonk_Tavern_Sonoma_-_July_2023_-_Sarah_Stierch.jpg", "HopMonk_Tavern_Sonoma_-_July_2023_-_Sarah_Stierch.jpg", "Sarah Stierch", "CC BY 4.0"],
    ["g:pates|saumon|cre", "thumb/f/f8/Pasta_with_cold-smoked_salmon_and_peas_in_Loviisa.jpg/500px-Pasta_with_cold-smoked_salmon_and_peas_in_Loviisa.jpg", "Pasta_with_cold-smoked_salmon_and_peas_in_Loviisa.jpg", "JIP", "CC BY-SA 4.0"],
    ["g:pates|pois_chiches|tom", "thumb/f/ff/Pasta_e_ceci_con_maltagliati_di_pasta_all%E2%80%99uovo.jpg/500px-Pasta_e_ceci_con_maltagliati_di_pasta_all%E2%80%99uovo.jpg", "Pasta_e_ceci_con_maltagliati_di_pasta_all’uovo.jpg", "Rollopack", "CC BY-SA 4.0"],
    ["g:pates|feta|tom", "thumb/7/7c/Baked_feta_pasta.jpg/500px-Baked_feta_pasta.jpg", "Baked_feta_pasta.jpg", "Delicious Adventures", "CC BY 3.0"],
    ["g:pates|mozzarella|tom", "thumb/c/c5/Penne_norma_-_Enzo%27s_2026-04-21.jpg/500px-Penne_norma_-_Enzo%27s_2026-04-21.jpg", "Penne_norma_-_Enzo's_2026-04-21.jpg", "Andy Li", "CC0"],
    ["g:pates|mozzarella|cre", "thumb/1/16/Mmm..._elicoidali_pasta_%2813257080663%29.jpg/500px-Mmm..._elicoidali_pasta_%2813257080663%29.jpg", "Mmm..._elicoidali_pasta_(13257080663).jpg", "jeffreyw", "CC BY 2.0"],
    ["g:bowl|saumon", "thumb/8/87/Uwajimaya_Poke_Bowl_with_salmon%2C_tuna%2C_ginger%2C_and_2_scoops_of_rice.jpg/500px-Uwajimaya_Poke_Bowl_with_salmon%2C_tuna%2C_ginger%2C_and_2_scoops_of_rice.jpg", "Uwajimaya_Poke_Bowl_with_salmon,_tuna,_ginger,_and_2_scoops_of_rice.jpg", "TechnoKittyCat", "CC0"],
    ["g:bowl|oeufs", "thumb/1/1f/Rice_bowl_with_sunny_side_egg.jpg/500px-Rice_bowl_with_sunny_side_egg.jpg", "Rice_bowl_with_sunny_side_egg.jpg", "Bibazi", "CC BY 4.0"],
    ["g:salade|*|pomme_de_terre", "thumb/1/18/Potato_salad_3.jpg/500px-Potato_salad_3.jpg", "Potato_salad_3.jpg", "jules", "CC BY 2.0"],
    ["g:bowl|poulet_filet", "thumb/e/ed/Poke_Bowl_Kureci_Maso_Zlaty_Klas_2025.jpg/500px-Poke_Bowl_Kureci_Maso_Zlaty_Klas_2025.jpg", "Poke_Bowl_Kureci_Maso_Zlaty_Klas_2025.jpg", "Mojmir Churavy", "CC0"],
    ["g:mijote|poulet_filet", "thumb/e/e8/African_Chicken_Peanut_Stew_%2837673757141%29.jpg/500px-African_Chicken_Peanut_Stew_%2837673757141%29.jpg", "African_Chicken_Peanut_Stew_(37673757141).jpg", "A Healthier Michigan", "CC BY-SA 2.0"],
    ["g:mijote|saucisse", "thumb/6/6f/Budae_jjigae_being_prepared.jpg/500px-Budae_jjigae_being_prepared.jpg", "Budae_jjigae_being_prepared.jpg", "Xiaolongimnida", "CC BY-SA 2.0"],
    ["g:mijote|pois_chiches", "thumb/d/d0/Nohut_yahni.jpg/500px-Nohut_yahni.jpg", "Nohut_yahni.jpg", "E4024", "CC BY-SA 4.0"],
    ["g:mijote|lentilles_vertes", "thumb/b/bc/20221217_lentil_soup_Katowice_Panewniki.jpg/500px-20221217_lentil_soup_Katowice_Panewniki.jpg", "20221217_lentil_soup_Katowice_Panewniki.jpg", "Abraham", "CC BY-SA 4.0"],
    ["g:mijote|haricots_rouges", "thumb/0/07/Argentine_red_kidney_bean_stew_with_smoked_sausage_and_white_rice.jpg/500px-Argentine_red_kidney_bean_stew_with_smoked_sausage_and_white_rice.jpg", "Argentine_red_kidney_bean_stew_with_smoked_sausage_and_white_rice.jpg", "Horacio Cambeiro", "CC BY-SA 3.0"],
    ["g:quiche|lardons", "thumb/5/5e/Quiche_lorraine_04.jpg/500px-Quiche_lorraine_04.jpg", "Quiche_lorraine_04.jpg", "Arnaud 25", "CC0"],
    ["g:quiche|saumon", "thumb/2/29/Quiche_au_saumon_et_aux_%C3%A9pinards.jpg/500px-Quiche_au_saumon_et_aux_%C3%A9pinards.jpg", "Quiche_au_saumon_et_aux_épinards.jpg", "Benoît Prieur", "CC0"],
    ["g:quiche|feta", "thumb/4/46/Squash_%26_Roasted_Poblano_Quiche_Whole_%288104790878%29.jpg/500px-Squash_%26_Roasted_Poblano_Quiche_Whole_%288104790878%29.jpg", "Squash_&_Roasted_Poblano_Quiche_Whole_(8104790878).jpg", "Michele Frazier", "CC BY 2.0"],
    ["g:quiche|jambon", "thumb/7/78/-Ham_%26_-cheese_-quiche_from_Jolly_Holiday_-Bakery_at_-Disneyland._-Savory_and_-yummy_with_a_-flaky_-crust._Perfect_for_a_-breakfast_on_the_go._A_little_soggy_inside%2C_but_forgivable._I_gobbled_it_up%21_-foodporn_-disneyfood_-eggs.jpg/500px-thumbnail.jpg", "-Ham_&_-cheese_-quiche_from_Jolly_Holiday_-Bakery_at_-Disneyland._-Savory_and_-yummy_with_a_-flaky_-crust._Perfect_for_a_-breakfast_on_the_go._A_little_soggy_inside,_but_forgivable._I_gobbled_it_up!_-foodporn_-disneyfood_-eggs.jpg", "L.A. Foodie", "CC BY 2.0"],
    ["g:quiche|mozzarella", "thumb/c/c8/Quiche-Tomates-Mozzarella-Basilic.jpg/500px-Quiche-Tomates-Mozzarella-Basilic.jpg", "Quiche-Tomates-Mozzarella-Basilic.jpg", "CMoi", "CC BY-SA 3.0"],
    ["g:omelette|jambon", "thumb/4/42/Ham_%26_Cheddar_Omelet_%281%29_%2838273841901%29.jpg/500px-Ham_%26_Cheddar_Omelet_%281%29_%2838273841901%29.jpg", "Ham_&_Cheddar_Omelet_(1)_(38273841901).jpg", "John Freeman", "CC BY 2.0"],
    ["g:omelette|lardons", "thumb/1/15/Bacon_omelette_%281126041315%29.jpg/500px-Bacon_omelette_%281126041315%29.jpg", "Bacon_omelette_(1126041315).jpg", "Father.Jack", "CC BY 2.0"],
    ["g:omelette|feta", "thumb/4/4c/Prawns_%26_Feta_Omelette.jpg/500px-Prawns_%26_Feta_Omelette.jpg", "Prawns_&_Feta_Omelette.jpg", "o.tacke", "CC0"],
    ["g:omelette|emmental", "thumb/c/c7/Four_cheese_omelet_with_EVOO.jpg/500px-Four_cheese_omelet_with_EVOO.jpg", "Four_cheese_omelet_with_EVOO.jpg", "Philipp Michel Reichold", "CC BY-SA 4.0"],
    ["g:omelette|thon", "thumb/7/7e/9942Home_cooking_of_sayote_and_potatoes_with_tuna_omelette_07.jpg/500px-9942Home_cooking_of_sayote_and_potatoes_with_tuna_omelette_07.jpg", "9942Home_cooking_of_sayote_and_potatoes_with_tuna_omelette_07.jpg", "Judgefloro", "CC0"],
    ["g:veloute|lentilles_corail", "thumb/0/01/Lentil_Soup_-_Schnitzel_%26_Co._2026-05-16.jpg/500px-Lentil_Soup_-_Schnitzel_%26_Co._2026-05-16.jpg", "Lentil_Soup_-_Schnitzel_&_Co._2026-05-16.jpg", "Andy Li", "CC0"],
    ["g:veloute|pois_chiches", "thumb/a/ab/Uzbek_and_Tajik_Chickpea_and_Laghman_soup.jpg/500px-Uzbek_and_Tajik_Chickpea_and_Laghman_soup.jpg", "Uzbek_and_Tajik_Chickpea_and_Laghman_soup.jpg", "Akhemen", "CC BY-SA 4.0"],
    ["g:veloute|oeufs", "thumb/1/10/Cheddar_soup_prepared_with_white_cheddar.jpg/500px-Cheddar_soup_prepared_with_white_cheddar.jpg", "Cheddar_soup_prepared_with_white_cheddar.jpg", "goblinbox", "CC BY 2.0"],
    ["g:veloute|emmental", "thumb/6/60/Cream_of_Cauliflower_soup_with_Tiger_Blue_Cheese-_Horizon_Restaurant%2C_CN_Tower_%2813949944279%29.jpg/500px-Cream_of_Cauliflower_soup_with_Tiger_Blue_Cheese-_Horizon_Restaurant%2C_CN_Tower_%2813949944279%29.jpg", "Cream_of_Cauliflower_soup_with_Tiger_Blue_Cheese-_Horizon_Restaurant,_CN_Tower_(13949944279).jpg", "Navjot Singh", "CC BY-SA 2.0"],
    ["g:wraps|thon", "thumb/c/cf/Tuna_wrap%2C_Delft_%282018%29.jpg/500px-Tuna_wrap%2C_Delft_%282018%29.jpg", "Tuna_wrap,_Delft_(2018).jpg", "Donald Trung Quoc Don", "CC BY-SA 4.0"],
    ["g:wraps|jambon", "thumb/1/16/Hawaiian_pizza_style_wrap_%28Toasted%29_-_The_naan_hut_2024-02-06.jpg/500px-Hawaiian_pizza_style_wrap_%28Toasted%29_-_The_naan_hut_2024-02-06.jpg", "Hawaiian_pizza_style_wrap_(Toasted)_-_The_naan_hut_2024-02-06.jpg", "Andy Li", "CC0"],
    ["g:wraps|feta", "thumb/3/37/Wrap_up_and_done_%283250921760%29.jpg/500px-Wrap_up_and_done_%283250921760%29.jpg", "Wrap_up_and_done_(3250921760).jpg", "Miia Ranta", "CC BY-SA 2.0"],
    ["g:pizza|jambon", "thumb/5/52/Hawaiian_pizza_2023.jpg/500px-Hawaiian_pizza_2023.jpg", "Hawaiian_pizza_2023.jpg", "Roderick Suñaz Sumalinog", "CC BY-SA 4.0"],
    ["g:pizza|thon", "thumb/9/93/Tuna_and_Olive_Pizza_%289674876578%29.jpg/500px-Tuna_and_Olive_Pizza_%289674876578%29.jpg", "Tuna_and_Olive_Pizza_(9674876578).jpg", "Rusty Clark", "CC BY 2.0"],
    ["g:pizza|lardons", "thumb/4/4b/Pizza_med_bacon_og_svampe_%286378800823%29.jpg/500px-Pizza_med_bacon_og_svampe_%286378800823%29.jpg", "Pizza_med_bacon_og_svampe_(6378800823).jpg", "cyclonebill", "CC BY-SA 2.0"],
    ["g:pizza|poulet_filet", "thumb/a/a9/Chicken_pizza_01.jpg/500px-Chicken_pizza_01.jpg", "Chicken_pizza_01.jpg", "Agoetee 123", "CC BY-SA 4.0"],
    ["g:pizza|feta", "thumb/b/bc/Eggplant%2C_Red_Onion_and_Veggie_Feta_Pizza_%283751518426%29.jpg/500px-Eggplant%2C_Red_Onion_and_Veggie_Feta_Pizza_%283751518426%29.jpg", "Eggplant,_Red_Onion_and_Veggie_Feta_Pizza_(3751518426).jpg", "Vegan Feast Catering", "CC BY 2.0"],
    ["haricots_saucisse", "thumb/a/a5/Bowl_of_cassoulet.JPG/500px-Bowl_of_cassoulet.JPG", "Bowl_of_cassoulet.JPG", "BrokenSphere", "CC BY-SA 3.0"],
    ["colin_vapeur", "thumb/6/6e/Kuhler_Pannfisch.jpg/500px-Kuhler_Pannfisch.jpg", "Kuhler_Pannfisch.jpg", "Benreis", "CC BY-SA 4.0"],
    ["pain_perdu_sale", "thumb/3/35/French_toast_001.jpg/500px-French_toast_001.jpg", "French_toast_001.jpg", "Ocdp", "CC0"],
    ["tofu_coco_epinards", "thumb/f/fb/Tofu_curry_with_rice.jpg/500px-Tofu_curry_with_rice.jpg", "Tofu_curry_with_rice.jpg", "Anna Korcheva", "CC BY-SA 4.0"],
    ["potee_chou", "thumb/5/50/Boerenkool_stamppot.jpg/500px-Boerenkool_stamppot.jpg", "Boerenkool_stamppot.jpg", "M.Minderhoud", "CC BY-SA 3.0"],
    ["aubergines_cumin", "thumb/7/7d/Liat_Portal_for_Foodie_Disorder_-_Roasted_Eggplant_with_Tahini_and_Balsamic_Glaze.jpg/500px-Liat_Portal_for_Foodie_Disorder_-_Roasted_Eggplant_with_Tahini_and_Balsamic_Glaze.jpg", "Liat_Portal_for_Foodie_Disorder_-_Roasted_Eggplant_with_Tahini_and_Balsamic_Glaze.jpg", "HaJunkiyada", "CC BY-SA 4.0"],
    ["bowl_patate_douce", "thumb/b/b0/Sweet_potato_fries_veggie_bowl_%2831138207547%29.jpg/500px-Sweet_potato_fries_veggie_bowl_%2831138207547%29.jpg", "Sweet_potato_fries_veggie_bowl_(31138207547).jpg", "Ella Olsson", "CC BY 2.0"],
  ];
  PAR_TYPE.forEach(([cle, chemin, fichier, auteur, licence]) => {
    PHOTOS[cle] = { src: C + chemin, page: 'https://commons.wikimedia.org/wiki/File:' + fichier, auteur, licence, licenceUrl: LICENCES[licence] || '' };
  });
  // types de plats illustrés par la photo d'une recette proche (même plat)
  Object.entries({
      "g:curry|poulet_filet": "R:curry_poulet",
      "g:pates|thon|tom": "R:pates_thon",
      "g:gratin|poulet_filet|pates": "R:gratin_pates",
      "g:gratin|jambon|pomme_de_terre": "R:m:gratin",
      "g:gratin|saumon|pates": "R:gratin_pates",
      "g:gratin|thon|pomme_de_terre": "R:m:gratin",
      "g:gratin|poulet_filet|pomme_de_terre": "R:m:gratin",
      "g:gratin|saumon|pomme_de_terre": "R:m:gratin",
      "g:pates|jambon|tom": "R:m:pates",
      "g:pates|boeuf_hache|tom": "R:bolognaise",
      "g:pates|pois_chiches|cre": "=g:pates|pois_chiches|tom",
      "g:pates|feta|cre": "=g:pates|feta|tom",
      "g:bowl|tofu": "R:bowl_tofu",
      "g:bowl|pois_chiches": "R:m:bowl",
      "g:quiche|thon": "R:m:quiche",
      "g:wraps|poulet_filet": "R:wraps_poulet",
      "g:wraps|haricots_rouges": "R:tortillas_haricots",
      "poelee_boeuf_haricots": "=g:poelee|boeuf_hache",
      "g:salade|*|riz": "R:salade_riz_thon",
      "g:salade|*|pates": "R:salade_pates",
      "g:salade|*|quinoa": "R:salade_quinoa_feta",
      "g:salade|*|semoule": "R:taboule",
    "g:gratin|boeuf_hache|pomme_de_terre": "R:parmentier"
  }).forEach(([cle, v]) => { PHOTOS[cle] = PHOTOS[v.replace(/^R:|^=/, '')]; });


  // Ce que chaque photo d'un type de plat montre vraiment : le féculent visible (riz, pommes de terre…),
  // les légumes qu'on reconnaît, ou « faux » si la photo montre autre chose (autre viande, nouilles…).
  // Une photo n'est utilisée que si elle ne contredit pas la recette ; sinon on garde l'illustration
  // dessinée à partir des vrais ingrédients (plus juste qu'une photo trompeuse).
  const MONTRE = {
    'g:poelee|poulet_filet': { fec: 'riz' },
    'g:poelee|pois_chiches': { leg: ['epinards'] },
    'g:poelee|saucisse': { fec: 'pomme_de_terre' },
    'g:poelee|haricots_rouges': { fec: 'riz' },
    'g:poelee|lardons': { fec: 'pomme_de_terre' },
    'g:curry|saumon': { fec: 'riz' },
    'g:curry|colin': { fec: 'riz' },
    'g:curry|poulet_filet': { fec: 'riz', leg: ['poivron'] },
    'g:curry|tofu': { faux: true },            // curry au porc
    'g:wok|poulet_filet': { faux: true },      // porc frit aux cacahuètes
    'g:wok|boeuf_hache': { leg: ['brocoli'] },
    'g:bowl|saumon': { fec: 'riz' },
    'g:bowl|oeufs': { fec: 'riz' },
    'g:bowl|poulet_filet': { fec: 'riz' },
    'g:bowl|tofu': { fec: 'riz' },
    'g:mijote|saucisse': { faux: true },       // ragoût coréen aux nouilles
    'g:mijote|haricots_rouges': { fec: 'riz' },
  };
  const FECULENTS = ['riz', 'pates', 'semoule', 'quinoa', 'pomme_de_terre', 'patate_douce', 'boulgour'];
  function compatible(cle, rec) {
    const m = MONTRE[cle];
    if (!m) return true;
    if (m.faux) return false;
    const ids = new Set((rec.ing || []).map((i) => i[0]));
    if (m.fec) { const fec = FECULENTS.filter((f) => ids.has(f)); if (fec.length && !fec.includes(m.fec)) return false; if (!fec.length) return false; }
    if (m.leg && !m.leg.every((l) => ids.has(l))) return false;
    return true;
  }
  // Photos qui montrent vraiment le plat (et pas seulement un plat de la même famille) :
  // ce sont les seules utilisées pour le test de goût.
  /** Photo du type de plat d'une recette générée (id « g-famille-protéine-légumes-féculent-variante »). */
  function photoType(rec) {
    if (!rec.id.startsWith('g-')) return null;
    const p = rec.id.split('-'), m = rec.modele, pr = rec.prot;
    const fins = [p[p.length - 1], p[p.length - 2]]; // féculent et/ou variante (sauce, épices) en fin d'identifiant
    const essai = (cle) => (PHOTOS[cle] && compatible(cle, rec) ? PHOTOS[cle] : null);
    for (const f of fins) { const ph = essai(`g:${m}|${pr}|${f}`); if (ph) return ph; }
    const ph = essai(`g:${m}|${pr}`); if (ph) return ph;
    for (const f of fins) { const q = essai(`g:${m}|*|${f}`); if (q) return q; }
    return null;
  }
  /** Photo qui montre vraiment ce plat (recette maison ou type de plat), ou null. */
  function photoFidele(rec) { return (rec.id.startsWith('g-') ? photoType(rec) : PHOTOS[rec.id]) || null; }

  /** Photo d'illustration d'un plat, ou null. */
  // Plat généré sans photo fidèle : l'illustration dessinée (la photo générique de la famille montrait souvent
  // une autre viande ou un autre féculent).
  function photoPour(rec) { return photoFidele(rec) || (rec.id && rec.id.startsWith('g-') ? null : PHOTOS['m:' + rec.modele]) || null; }
  /** Liste des crédits (sans doublon) pour la page « Crédits photos ». */
  function credits() {
    const vus = new Set();
    return Object.values(PHOTOS).filter((p) => p && !vus.has(p.page) && vus.add(p.page));
  }
  // Sur le site en ligne, les photos sont copiées avec le site au moment de la publication
  // (scripts/photos-locales.js) : on utilise alors la copie locale plutôt que Wikimedia.
  const LOCALES = root.BUDGETABLE_PHOTOS_LOCALES || {};
  Object.values(PHOTOS).forEach((p) => { if (p && LOCALES[p.src]) { p.distant = p.src; p.src = LOCALES[p.src]; } });

  const api = { PHOTOS, photoPour, photoFidele, credits, compatible };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Photos = api;
})(typeof window !== 'undefined' ? window : globalThis);
