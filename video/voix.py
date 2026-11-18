"""
voix.py : synthèse de la voix off (Piper, voix « Pierre » du modèle fr_FR-upmc-medium), une phrase par fichier.

Entrée  : scenario.json (champ « dit » de chaque phrase)
Sortie  : build/voix/<id>.wav (48 kHz mono, silences de début et de fin rognés)
          build/voix/durees.json ({ id: durée en secondes })
Modèle  : voix/fr_FR-upmc-medium.onnx (+ .onnx.json), téléchargé depuis Hugging Face s'il manque.
Usage   : python voix.py            (toutes les phrases)
          python voix.py m4 n1      (seulement certaines)
"""
import json
import os
import subprocess
import sys
import urllib.request
import wave

import numpy as np
from piper import PiperVoice, SynthesisConfig

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "build", "voix")
MODELES = os.path.join(ICI, "voix")
URL = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/upmc/medium/"


def modele(nom):
    os.makedirs(MODELES, exist_ok=True)
    chemin = os.path.join(MODELES, nom + ".onnx")
    for f in (nom + ".onnx", nom + ".onnx.json"):
        p = os.path.join(MODELES, f)
        if not os.path.exists(p):
            print("Téléchargement de " + f)
            urllib.request.urlretrieve(URL + f, p)
    return chemin


def rogner(x, taux, seuil_db=-46.0, marge=0.05):
    """Retire les silences de début et de fin (enveloppe RMS sur 10 ms)."""
    fen = max(1, int(taux * 0.01))
    n = len(x) // fen
    if n == 0:
        return x
    rms = np.sqrt(np.mean(x[: n * fen].reshape(n, fen) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    actifs = np.where(db > seuil_db)[0]
    if len(actifs) == 0:
        return x
    debut = max(0, actifs[0] * fen - int(marge * taux))
    fin = min(len(x), (actifs[-1] + 1) * fen + int(marge * taux))
    return x[debut:fin]


def main():
    with open(os.path.join(ICI, "scenario.json"), encoding="utf-8") as f:
        sc = json.load(f)
    v = sc["voix"]
    voix = PiperVoice.load(modele(v["modele"]))
    config = SynthesisConfig(speaker_id=v["locuteur"], length_scale=v["debit"])
    os.makedirs(SORTIE, exist_ok=True)
    fichier_durees = os.path.join(SORTIE, "durees.json")
    durees = json.load(open(fichier_durees)) if os.path.exists(fichier_durees) else {}
    voulus = set(sys.argv[1:])
    for scene in sc["scenes"]:
        for b in scene["beats"]:
            if voulus and b["id"] not in voulus:
                continue
            brut = os.path.join(SORTIE, b["id"] + "-brut.wav")
            with wave.open(brut, "wb") as wf:
                voix.synthesize_wav(b["dit"], wf, syn_config=config)
            with wave.open(brut, "rb") as wf:
                taux = wf.getframerate()
                x = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
            x = rogner(x, taux)
            propre = os.path.join(SORTIE, b["id"] + "-22k.wav")
            with wave.open(propre, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(taux)
                wf.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
            final = os.path.join(SORTIE, b["id"] + ".wav")
            # 48 kHz, coupe-bas léger (souffle grave du modèle)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", propre, "-af", "highpass=f=70,aresample=48000:resampler=soxr",
                            "-ar", "48000", "-ac", "1", final], check=True)
            os.remove(brut)
            os.remove(propre)
            with wave.open(final, "rb") as wf:
                durees[b["id"]] = round(wf.getnframes() / wf.getframerate(), 3)
            print("%-3s %5.2f s  %s" % (b["id"], durees[b["id"]], b["texte"]))
    with open(fichier_durees, "w") as f:
        json.dump(durees, f, indent=1)
    print("Total voix : %.1f s" % sum(durees.values()))


if __name__ == "__main__":
    main()
