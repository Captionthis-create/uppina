"""
mixage.py : place chaque phrase de la voix off à son instant, baisse la musique sous la voix, normalise.
Le film étant accéléré (vitesse de scenario.json), chaque phrase est accélérée d'autant sans changer sa hauteur
(ffmpeg, filtre atempo : découpage-recollement adapté à une voix seule) et placée à l'instant temps du film / vitesse.
L'accélération de chaque phrase est calculée par timeline.js (vitesseVoix) : jusqu'à 3,6 mots par seconde au plus, les
titres courts gardent donc leur débit naturel, ce que permet le silence qui les suit.

Entrées : build/timeline.json, build/voix/<id>.wav, build/musique.wav
Sorties : build/mix.wav (avant normalisation), build/audio.wav (−16 LUFS, crête −1,5 dBTP),
          build/placement.json (début, fin et accélération réels de chaque phrase, en temps de sortie)
"""
import json
import os
import subprocess
import wave

import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(ICI, "build")
SR = 48000


def lire(chemin):
    with wave.open(chemin, "rb") as wf:
        assert wf.getframerate() == SR, chemin
        x = np.frombuffer(wf.readframes(wf.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
        return x.reshape(-1, wf.getnchannels())


def ecrire(chemin, x):
    with wave.open(chemin, "wb") as wf:
        wf.setnchannels(x.shape[1])
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def accelerer(chemin, vitesse):
    """Phrase accélérée de « vitesse » sans changer sa hauteur (ffmpeg atempo)."""
    if abs(vitesse - 1) < 1e-6:
        return lire(chemin)[:, 0]
    filtre = "atempo=%.4f" % vitesse
    brut = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", chemin, "-af", filtre, "-ar", str(SR), "-ac", "1", "-f", "s16le", "-"],
                          capture_output=True, check=True).stdout
    return np.frombuffer(brut, dtype="<i2").astype(np.float64) / 32768.0


def main():
    tl = json.load(open(os.path.join(B, "timeline.json"), encoding="utf-8"))
    V = tl.get("vitesse", 1)
    n = int(tl["duree"] / V * SR)
    voix = np.zeros(n)
    placement = {}
    for bid in tl["ordre"]:
        b = tl["beats"][bid]
        v = b.get("vitesseVoix", V)
        x = accelerer(os.path.join(B, "voix", bid + ".wav"), v)
        i = int(round(b["debut"] / V * SR))
        placement[bid] = {"debut": round(i / SR, 3), "fin": round((i + len(x)) / SR, 3), "vitesse": round(v, 3)}
        x = x[: n - i]
        voix[i: i + len(x)] += x
    # Voix : niveau homogène entre les phrases (RMS des passages parlés)
    trame = int(0.01 * SR)
    nb = n // trame
    rms = np.sqrt(np.mean(voix[: nb * trame].reshape(nb, trame) ** 2, axis=1) + 1e-12)
    parle = rms > 10 ** (-38 / 20)
    voix *= 10 ** (-18 / 20) / np.sqrt(np.mean(rms[parle] ** 2))

    musique = lire(os.path.join(B, "musique.wav"))[:n]
    if len(musique) < n:
        musique = np.vstack([musique, np.zeros((n - len(musique), 2))])
    # Musique : environ 9 dB sous la voix, et encore 12 dB plus bas pendant qu'elle parle (attaque 80 ms, maintien 150 ms, relâche 300 ms)
    rms_m = np.sqrt(np.mean(musique ** 2))
    musique *= 10 ** ((-18 - 9) / 20) / max(rms_m, 1e-9)
    # Maintien de 150 ms après chaque passage parlé : la musique ne remonte pas sur la fin des mots
    tenu = parle.copy()
    for k in range(1, 16):
        tenu[k:] |= parle[:-k]
    cible = np.where(tenu, 10 ** (-12 / 20), 1.0)
    g = np.empty(nb)
    v = 1.0
    for k in range(nb):
        coef = 0.12 if cible[k] < v else 0.03
        v += (cible[k] - v) * coef
        g[k] = v
    gain = np.interp(np.arange(n), np.arange(nb) * trame + trame / 2, g)
    mix = musique * gain[:, None] + voix[:, None]
    ecrire(os.path.join(B, "mix.wav"), mix / max(1.0, np.max(np.abs(mix)) / 0.98))
    with open(os.path.join(B, "placement.json"), "w") as f:
        json.dump(placement, f, indent=1)

    # Normalisation EBU R128 en deux passes (ffmpeg loudnorm)
    mesure = subprocess.run(["ffmpeg", "-hide_banner", "-i", os.path.join(B, "mix.wav"), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                            capture_output=True, text=True).stderr
    m = json.loads(mesure[mesure.rindex("{"): mesure.rindex("}") + 1])
    filtre = ("loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=%s:measured_TP=%s:measured_LRA=%s:measured_thresh=%s:offset=%s:linear=true,aresample=48000"
              % (m["input_i"], m["input_tp"], m["input_lra"], m["input_thresh"], m["target_offset"]))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(B, "mix.wav"), "-af", filtre, "-ar", "48000", os.path.join(B, "audio.wav")], check=True)
    print("Audio : build/audio.wav (mesuré avant normalisation : %s LUFS, crête %s dBTP)" % (m["input_i"], m["input_tp"]))


if __name__ == "__main__":
    main()
