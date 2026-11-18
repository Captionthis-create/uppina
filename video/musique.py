"""
musique.py : nappe musicale générée (aucun échantillon externe), calée sur les séquences du film.

Ré majeur, 92 BPM : nappe d'accords (I–vi–IV–V), arpèges doux, basse, et une pulsation légère
pendant le « coup de feu » de midi. Réverbération par convolution. Résolution sur l'accord final.
Entrée  : build/timeline.json
Sortie  : build/musique.wav (48 kHz, stéréo, 32 bits flottants)
"""
import json
import os
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

ICI = os.path.dirname(os.path.abspath(__file__))
SR = 48000
BPM = 92
TEMPS = 60.0 / BPM
MESURE = 4 * TEMPS
rng = np.random.default_rng(21)

tl = json.load(open(os.path.join(ICI, "build", "timeline.json"), encoding="utf-8"))
DUREE = tl["duree"]
N = int(DUREE * SR) + SR * 4
SCENES = {s["id"]: s for s in tl["scenes"]}


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12.0)


# Accords (notes MIDI) : nappe (médium), arpège (aigu), basse (fondamentale)
ACCORDS = {
    "D": {"nappe": [50, 57, 61, 64, 66], "arpege": [62, 66, 69, 73, 76], "basse": 38},
    "Bm": {"nappe": [47, 54, 57, 61, 62], "arpege": [59, 62, 66, 69, 73], "basse": 35},
    "G": {"nappe": [43, 50, 54, 57, 59], "arpege": [59, 62, 66, 67, 71], "basse": 31},
    "A": {"nappe": [45, 52, 57, 59, 61], "arpege": [57, 61, 64, 69, 71], "basse": 33},
}
GRILLE = ["D", "Bm", "G", "A"]
DUREE_ACCORD = 2 * MESURE


def enveloppe(n, attaque, relache, total):
    """Attaque / maintien / relâche (en secondes), courbes douces."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attaque, 1e-3), 0, 1)
    a = 0.5 - 0.5 * np.cos(np.pi * a)
    r = np.clip((total - t) / max(relache, 1e-3), 0, 1)
    r = 0.5 - 0.5 * np.cos(np.pi * r)
    return a * r


def ajouter(buf, debut, sig, pan=0.0):
    i = int(debut * SR)
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    g = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    buf[i: i + len(sig), 0] += sig * g[0]
    buf[i: i + len(sig), 1] += sig * g[1]


def note_nappe(f, duree, relache=2.2):
    total = duree + relache
    n = int(total * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for detune in (-0.0016, 0.0, 0.0017):
        ph = rng.uniform(0, 2 * np.pi)
        for h in range(1, 7):
            s += (1.0 / h ** 1.7) * np.sin(2 * np.pi * f * (1 + detune) * h * t + ph * h)
    s *= 1 + 0.08 * np.sin(2 * np.pi * 0.17 * t + rng.uniform(0, 6))
    return s * enveloppe(n, 1.4, relache, total) / 3.0


def note_pincee(f, vel):
    total = 1.6
    n = int(total * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for h, a in ((1, 1.0), (2, 0.42), (3, 0.18), (4, 0.09), (5, 0.04)):
        s += a * np.exp(-t * (3.2 + 2.6 * h)) * np.sin(2 * np.pi * f * h * t)
    attaque = np.clip(t / 0.004, 0, 1)
    return s * attaque * vel


def note_basse(f, duree):
    total = duree + 0.4
    n = int(total * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    return s * enveloppe(n, 0.08, 0.5, total)


def grosse_caisse():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 46 + 70 * np.exp(-t * 26)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9.5)


def charleston():
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    bruit = rng.standard_normal(n)
    bruit = sosfilt(butter(4, 7000, "highpass", fs=SR, output="sos"), bruit)
    return bruit * np.exp(-t * 55)


# Niveau de chaque couche selon la séquence (fondus de 1,5 s entre séquences)
NIVEAUX = {
    "intro": {"nappe": 0.85, "arpege": 0.0, "basse": 0.25, "percu": 0.0},
    "matin": {"nappe": 0.75, "arpege": 0.45, "basse": 0.5, "percu": 0.0},
    "midi": {"nappe": 0.65, "arpege": 0.62, "basse": 0.62, "percu": 0.55},
    "aprem": {"nappe": 0.75, "arpege": 0.42, "basse": 0.5, "percu": 0.0},
    "soir": {"nappe": 0.8, "arpege": 0.34, "basse": 0.52, "percu": 0.0},
    "nuit": {"nappe": 0.75, "arpege": 0.42, "basse": 0.5, "percu": 0.12},
    "fin": {"nappe": 0.95, "arpege": 0.5, "basse": 0.55, "percu": 0.0},
}


def niveau(couche, t):
    ordre = [s["id"] for s in tl["scenes"]]
    v = NIVEAUX[ordre[0]][couche]
    for sid in ordre[1:]:
        d = SCENES[sid]["debut"]
        u = np.clip((t - (d - 0.75)) / 1.5, 0, 1)
        u = 0.5 - 0.5 * np.cos(np.pi * u)
        v = v * (1 - u) + NIVEAUX[sid][couche] * u
    return v


def main():
    nappe = np.zeros((N, 2))
    arp = np.zeros((N, 2))
    basse = np.zeros((N, 2))
    percu = np.zeros((N, 2))
    debut_fin = SCENES["fin"]["debut"]
    fin_musique = DUREE + 0.2
    # Accords
    t, k = 0.0, 0
    while t < debut_fin + 1.0:
        nom = GRILLE[k % len(GRILLE)]
        dur = DUREE_ACCORD
        if t + dur > debut_fin + 1.0:  # dernier accord avant le générique : on enchaîne sur Ré
            dur = debut_fin + 1.0 - t
        for j, m in enumerate(ACCORDS[nom]["nappe"]):
            ajouter(nappe, t, note_nappe(hz(m), dur) * 0.22 * niveau("nappe", t), pan=(-0.35, 0.35, -0.15, 0.2, 0.0)[j])
        ajouter(basse, t, note_basse(hz(ACCORDS[nom]["basse"]), dur) * 0.3 * niveau("basse", t))
        # Arpège en croches : montée et descente dans l'accord
        motif = [0, 1, 2, 3, 4, 3, 2, 1]
        nb = int(round(dur / (TEMPS / 2)))
        for i in range(nb):
            ti = t + i * TEMPS / 2
            g = niveau("arpege", ti)
            if g < 0.01:
                continue
            note = ACCORDS[nom]["arpege"][motif[i % 8]]
            vel = (0.9 if i % 2 == 0 else 0.62) * rng.uniform(0.85, 1.0)
            ajouter(arp, ti, note_pincee(hz(note), vel) * 0.13 * g, pan=-0.4 if i % 2 else 0.4)
        # Pulsation : grosse caisse sur les temps 1 et 3, charleston à contretemps
        for i in range(int(round(dur / TEMPS))):
            ti = t + i * TEMPS
            g = niveau("percu", ti)
            if g < 0.01:
                continue
            if i % 2 == 0:
                ajouter(percu, ti, grosse_caisse() * 0.32 * g)
            ajouter(percu, ti + TEMPS / 2, charleston() * 0.05 * g, pan=0.25)
        t += dur
        k += 1
    # Générique : Ré majeur tenu, avec un dernier arpège qui s'éteint
    tenue = fin_musique - (debut_fin + 1.0)
    for j, m in enumerate(ACCORDS["D"]["nappe"] + [69]):
        ajouter(nappe, debut_fin + 1.0, note_nappe(hz(m), tenue - 2.5, relache=3.0) * 0.22 * niveau("nappe", debut_fin + 1.0), pan=(-0.35, 0.35, -0.15, 0.2, 0.0, 0.1)[j])
    ajouter(basse, debut_fin + 1.0, note_basse(hz(38), tenue - 2.0) * 0.3 * 0.55)
    for i, note in enumerate([62, 66, 69, 73, 76, 78, 81, 74, 69]):
        ajouter(arp, debut_fin + 1.0 + i * TEMPS / 2, note_pincee(hz(note), 0.8 - i * 0.05) * 0.13 * 0.5, pan=-0.4 if i % 2 else 0.4)

    # Réverbération (convolution) sur la nappe et les arpèges
    lr = int(2.8 * SR)
    tt = np.arange(lr) / SR
    ir = np.zeros((lr, 2))
    for c in range(2):
        b = rng.standard_normal(lr) * np.exp(-tt * 3.1)
        b = sosfilt(butter(2, 5200, "lowpass", fs=SR, output="sos"), b)
        b[: int(0.022 * SR)] = 0
        ir[:, c] = b / np.sqrt(np.sum(b ** 2))
    sec = nappe + arp
    hum = np.stack([fftconvolve(sec[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
    mix = 0.78 * sec + 0.42 * hum + basse + percu
    mix = sosfilt(butter(2, 30, "highpass", fs=SR, output="sos"), mix, axis=0)
    mix = sosfilt(butter(2, 11000, "lowpass", fs=SR, output="sos"), mix, axis=0)
    # Fondus d'ouverture et de fermeture
    t = np.arange(N) / SR
    fondu = np.clip(t / 2.5, 0, 1) * np.clip((DUREE - t) / 3.5, 0, 1)
    mix *= (0.5 - 0.5 * np.cos(np.pi * fondu))[:, None]
    mix = mix[: int(DUREE * SR)]
    mix *= 10 ** (-3 / 20) / max(1e-9, np.max(np.abs(mix)))
    sortie = os.path.join(ICI, "build", "musique.wav")
    with wave.open(sortie, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
    print("Musique : %s (%.1f s)" % (sortie, len(mix) / SR))


if __name__ == "__main__":
    main()
