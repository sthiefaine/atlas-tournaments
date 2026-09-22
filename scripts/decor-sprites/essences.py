"""
Le plan de production : quelles essences, quelles saisons, combien de variantes,
et dans quel gabarit chacune doit tenir.

L'ordre des essences est celui de `ESSENCES_DECOR` (`src/render2d/contrat.ts`),
l'ordre des saisons celui du calendrier : la liste produite se relit dans l'ordre
où on la pense. Le test `tests/decor-sprites/sources.test.ts` tient la même
table de son côté, **exprès** : c'est la commande, pas une copie du code.
"""

import arbres
import montagnes
import plantes

SAISONS_4 = ('printemps', 'ete', 'automne', 'hiver')

# Gabarits en mètres (une case = un mètre). `largeur` borne la plus grande des
# deux emprises au sol ; pour une montagne, `emprise` borne les deux.
GABARITS = {
    'arbre': dict(largeur=(0.25, 0.45), hauteur=(0.5, 0.9)),
    'buisson': dict(largeur=(0.18, 0.30), hauteur=(0.18, 0.30)),
    'touffe': dict(largeur=(0.12, 0.25), hauteur=(0.12, 0.25)),
    'roseau': dict(largeur=(0.15, 0.30), hauteur=(0.15, 0.30)),
    'montagne': dict(emprise=(0.9, 1.0), hauteur=(0.5, 0.9)),
}

# `reference` : la saison sur laquelle on mesure une variante pour la poser
# (hauteur visée, centrage). Les autres saisons reçoivent **la même**
# transformation — un arbre ne doit pas glisser d'un centimètre en perdant ses
# feuilles.
ESSENCES = [
    dict(nom='feuillu', saisons=SAISONS_4, variantes=3, reference='ete', gabarit='arbre',
         structure=arbres.structure_feuillu, modele=arbres.modele_feuillu, hauteur_visee=True),
    dict(nom='conifere', saisons=SAISONS_4, variantes=3, reference='ete', gabarit='arbre',
         structure=arbres.structure_conifere, modele=arbres.modele_conifere, hauteur_visee=True),
    dict(nom='palmier', saisons=('toutes',), variantes=3, reference='toutes', gabarit='arbre',
         structure=arbres.structure_palmier, modele=arbres.modele_palmier, hauteur_visee=False),
    dict(nom='tropical', saisons=('toutes',), variantes=3, reference='toutes', gabarit='arbre',
         structure=arbres.structure_tropical, modele=arbres.modele_tropical, hauteur_visee=True),
    dict(nom='buisson', saisons=SAISONS_4, variantes=2, reference='ete', gabarit='buisson',
         structure=plantes.structure_buisson, modele=plantes.modele_buisson, hauteur_visee=False),
    dict(nom='touffe', saisons=SAISONS_4, variantes=2, reference='ete', gabarit='touffe',
         structure=plantes.structure_touffe, modele=plantes.modele_touffe, hauteur_visee=False),
    dict(nom='roseau', saisons=('toutes', 'hiver'), variantes=2, reference='toutes', gabarit='roseau',
         structure=plantes.structure_roseau, modele=plantes.modele_roseau, hauteur_visee=False),
    dict(nom='montagne', saisons=('toutes', 'hiver'), variantes=3, reference='toutes', gabarit='montagne',
         structure=montagnes.structure_montagne, modele=montagnes.modele_montagne, hauteur_visee=False),
    dict(nom='montagne_aride', saisons=('toutes',), variantes=2, reference='toutes', gabarit='montagne',
         structure=montagnes.structure_aride, modele=montagnes.modele_aride, hauteur_visee=False),
    dict(nom='montagne_volcan', saisons=('toutes',), variantes=2, reference='toutes', gabarit='montagne',
         structure=montagnes.structure_volcan, modele=montagnes.modele_volcan, hauteur_visee=False),
]

TRIANGLES_MAX = 3000


def identifiant(essence, saison, n):
    """Exactement `idDecor` du contrat : `decor_feuillu_automne_2`."""
    return f'decor_{essence}_{saison}_{n}'
