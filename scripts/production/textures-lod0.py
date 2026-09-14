"""Dérive les PNG de jeu du maître HD. Dépendances hors moteur : Pillow, NumPy."""
from pathlib import Path
import json
import sys
import hashlib
import numpy as np
from PIL import Image

identifiant, source, sortie = sys.argv[1:]
source, sortie = Path(source), Path(sortie)
if source.resolve() == sortie.resolve():
    raise ValueError("La source HD doit rester intacte")
sortie.mkdir(parents=True, exist_ok=True)
mesures = []
for fichier in sorted(source.glob(identifiant + "_*.png")):
    canal = fichier.stem.removeprefix(identifiant + "_")
    if canal not in {"albedo", "normale", "rugosite", "metal", "masque_equipe", "emission", "occlusion"}:
        continue
    im = Image.open(fichier)
    cote = min(2048, max(im.size))
    dimensions = tuple(round(n * cote / max(im.size)) for n in im.size)
    original = fichier.read_bytes()
    cible = sortie / fichier.name
    if im.size == dimensions:
        cible.write_bytes(original)
    else:
        rgba = np.asarray(im.convert("RGBA"), dtype=np.float32) / 255
        rgb, alpha = rgba[:, :, :3], rgba[:, :, 3:]
        if canal == "albedo":
            rgb = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
            # Rééchantillonnage en lumière linéaire, alpha prémultiplié seulement pendant le filtre.
            rgb *= alpha
        elif canal == "normale":
            rgb = rgb * 2 - 1
        valeurs = np.concatenate((rgb, alpha), axis=2)
        reduite = np.stack([np.asarray(Image.fromarray(valeurs[:, :, i]).resize(dimensions, Image.Resampling.BOX)) for i in range(4)], axis=2)
        rgb, alpha = reduite[:, :, :3], reduite[:, :, 3:]
        if canal == "normale":
            longueur = np.linalg.norm(rgb, axis=2, keepdims=True)
            rgb = np.where(longueur > .00001, rgb / np.maximum(longueur, .00001), np.array([0, 0, 1]))
            rgb = rgb * .5 + .5  # glTF : vert +Y, aucune inversion.
        elif canal == "albedo":
            rgb = rgb / np.maximum(alpha, .00001)
            rgb = np.where(rgb <= .0031308, rgb * 12.92, 1.055 * np.maximum(rgb, 0) ** (1 / 2.4) - .055)
        out = np.round(np.clip(np.concatenate((rgb, alpha), axis=2), 0, 1) * 255).astype(np.uint8)
        image = Image.fromarray(out, "RGBA")
        if "A" not in im.mode:
            image = image.convert("RGB")
        image.save(cible, optimize=True)
    mesures.append({"nom": fichier.name, "avant": list(im.size), "apres": list(dimensions), "octetsAvant": len(original), "octets": cible.stat().st_size, "sourceSha256": hashlib.sha256(original).hexdigest()})
(sortie / "textures-optimisation.json").write_text(json.dumps(mesures, indent=2) + "\n")
print(json.dumps({"id": identifiant, "octetsAvant": sum(m["octetsAvant"] for m in mesures), "octets": sum(m["octets"] for m in mesures)}))
