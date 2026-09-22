"""
Passage d'un `Modele` (numpy, repère glTF) à une scène Blender, puis à un GLB.

C'est le seul module qui touche `bpy`. Il ne décide de rien : il recopie. Les
choix de forme et de couleur sont dans les modules d'essences, les choix de
format ici, en un seul endroit :

- une racine vide `racine`, et un nœud enfant par pièce (`tronc`, `feuillage`,
  `neige`…), comme les GLB livrés du dépôt (`decor_rocher_cotier`) ;
- une couleur **d'albédo** par sommet (`COLOR_0`), branchée sur la couleur de base
  d'un Principled BSDF blanc : l'importateur glTF de Blender la rebranche à
  l'identique, et la cuisson n'a rien à savoir de plus ;
- des matériaux PBR simples, sans texture ni métal : une rugosité par matière ;
- aucune échelle, aucune rotation sur les nœuds : la géométrie est posée en
  place, à l'échelle du jeu (une unité, une case).
"""

import math

import bpy
import numpy as np

from geometrie import lineaire

# Une rugosité par matière : c'est tout ce qu'un matériau de source porte en
# plus de la couleur de ses sommets. La neige et la coulée de basalte sont les
# deux seules surfaces qui doivent accrocher un reflet.
MATERIAUX = {
    'mat_ecorce': 0.9,
    'mat_feuillage': 0.72,
    'mat_fleurs': 0.6,
    'mat_fruits': 0.5,
    'mat_herbe': 0.78,
    'mat_neige': 0.5,
    'mat_roche': 0.86,
    'mat_coulee': 0.42,
}

NOM_COULEUR = 'Couleur'


def vider():
    """Repart d'une scène vide sans relire les préférences : chaque modèle naît dans le même état."""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def materiau(nom):
    """Le matériau d'une matière, créé à la demande : couleur de base = couleur des sommets."""
    existant = bpy.data.materials.get(nom)
    if existant is not None:
        return existant
    if nom not in MATERIAUX:
        raise KeyError(f'matière inconnue : {nom}')
    mat = bpy.data.materials.new(nom)
    mat.use_nodes = True
    arbre = mat.node_tree
    # Les nœuds se cherchent par type : leurs noms sont traduits dans une
    # interface Blender qui ne serait pas en anglais.
    bsdf = next(n for n in arbre.nodes if n.type == 'BSDF_PRINCIPLED')
    attribut = arbre.nodes.new('ShaderNodeVertexColor')
    attribut.layer_name = NOM_COULEUR
    arbre.links.new(attribut.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = MATERIAUX[nom]
    bsdf.inputs['Metallic'].default_value = 0.0
    # Double face : une palme, une lame d'herbe ou un pétale se voient des deux côtés.
    mat.use_backface_culling = False
    return mat


def poser(modele):
    """Crée la racine et une maille par pièce ; rend la racine."""
    scene = bpy.context.scene
    racine = bpy.data.objects.new('racine', None)
    scene.collection.objects.link(racine)
    for piece in modele.pieces_non_vides():
        m = piece.maille
        v = m.sommets()
        # glTF (x, y, z) → Blender (x, −z, y) : une rotation, l'exportateur fait l'inverse.
        vb = np.stack([v[:, 0], -v[:, 2], v[:, 1]], axis=1)
        me = bpy.data.meshes.new(piece.nom)
        me.from_pydata(vb.tolist(), [], [list(f) for f in m.faces])
        if me.validate(verbose=False):
            raise RuntimeError(f'maille « {piece.nom} » corrigée par Blender : géométrie invalide à la source')
        noms = []
        for nom in m.materiaux:
            if nom not in noms:
                noms.append(nom)
        for nom in noms:
            me.materials.append(materiau(nom))
        me.polygons.foreach_set('material_index', [noms.index(nom) for nom in m.materiaux])
        me.shade_smooth()
        if piece.angle_vif is not None:
            me.set_sharp_from_angle(angle=math.radians(piece.angle_vif))
        attribut = me.color_attributes.new(NOM_COULEUR, 'FLOAT_COLOR', 'POINT')
        lin = lineaire(m.couleurs())
        rgba = np.concatenate([lin, np.ones((len(lin), 1))], axis=1).astype(np.float32)
        attribut.data.foreach_set('color', rgba.ravel())
        me.color_attributes.active_color = attribut
        me.color_attributes.render_color_index = me.color_attributes.find(NOM_COULEUR)
        me.update()
        ob = bpy.data.objects.new(piece.nom, me)
        scene.collection.objects.link(ob)
        ob.parent = racine
    return racine


def exporter(chemin):
    """Écrit la scène en GLB. Rien d'autre que la géométrie, les couleurs et les matériaux."""
    bpy.ops.export_scene.gltf(
        filepath=chemin,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials='EXPORT',
        export_vertex_color='MATERIAL',
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
    )
