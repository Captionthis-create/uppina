"""
musique.py : musique générée (aucun échantillon externe), calée sur les modules du film.

Ré majeur, 112 BPM, un accord par mesure (I–V–vi–IV : ré, la, si mineur, sol). Rythmique entraînante sur
les modules (grosse caisse à chaque temps, clap sur 2 et 4, charleston et shaker), basse pulsée en croches,
arpèges en doubles croches, nappe « pompée » par la grosse caisse. Chaque module démarre sur un accent
(montée de souffle, cymbale et impact grave) synchronisé avec son carton « Nouveau ». Le générique résout sur
l'accord de ré.
Entrée  : build/timeline.json (minutage en temps du film ; la musique est écrite en temps de sortie, après
          accélération : temps du film / vitesse)
Sortie  : build/musique.wav (48 kHz, stéréo)
"""
import json
import os
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

ICI = os.path.dirname(os.path.abspath(__file__))
SR = 48000
BPM = 112
TEMPS = 60.0 / BPM
MESURE = 4 * TEMPS
rng = np.random.default_rng(21)

tl = json.load(open(os.path.join(ICI, "build", "timeline.json"), encoding="utf-8"))
V = tl.get("vitesse", 1)
DUREE = tl["duree"] / V
N = int(DUREE * SR) + SR * 4
SCENES = {s["id"]: dict(s, debut=s["debut"] / V, fin=s["fin"] / V) for s in tl["scenes"]}
ORDRE = [s["id"] for s in tl["scenes"]]
MODULES = [s for s in ORDRE if SCENES[s].get("num")]
F1 = tl["beats"][[b for b in tl["ordre"] if tl["beats"][b]["scene"] == "fin"][0]]
T_FINAL = (F1["fin"] + 0.5) / V  # accent final, quand le logo apparaît
T_MODULE1 = SCENES[MODULES[0]]["debut"]  # avant : intro, pulsée par le charleston et le shaker seuls


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12.0)


# Accords (notes MIDI) : nappe (médium), arpège (aigu), basse (fondamentale)
ACCORDS = {
    "D": {"nappe": [50, 57, 62, 66], "arpege": [62, 66, 69, 74], "basse": 38},
    "A": {"nappe": [49, 57, 61, 64], "arpege": [61, 64, 69, 73], "basse": 33},
    "Bm": {"nappe": [47, 54, 62, 66], "arpege": [59, 62, 66, 71], "basse": 35},
    "G": {"nappe": [47, 55, 62, 67], "arpege": [59, 62, 67, 71], "basse": 31},
}
GRILLE = ["D", "A", "Bm", "G"]
MOTIF = [0, 1, 2, 3, 1, 2, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]  # arpège en doubles croches

# Niveau de chaque couche selon le module (fondus de 1 s entre modules)
NIVEAUX = {
    "intro": {"nappe": 0.8, "arpege": 0.5, "basse": 0.35, "percu": 0.55},
    "accueil": {"nappe": 0.6, "arpege": 0.6, "basse": 0.75, "percu": 0.8},
    "meteo": {"nappe": 0.62, "arpege": 0.55, "basse": 0.7, "percu": 0.65},
    "stocks": {"nappe": 0.6, "arpege": 0.6, "basse": 0.75, "percu": 0.8},
    "creneaux": {"nappe": 0.62, "arpege": 0.58, "basse": 0.72, "percu": 0.7},
    "resas": {"nappe": 0.6, "arpege": 0.62, "basse": 0.75, "percu": 0.85},
    "bons": {"nappe": 0.62, "arpege": 0.55, "basse": 0.7, "percu": 0.65},
    "objectifs": {"nappe": 0.6, "arpege": 0.6, "basse": 0.75, "percu": 0.8},
    "popia": {"nappe": 0.62, "arpege": 0.58, "basse": 0.72, "percu": 0.7},
    "export": {"nappe": 0.62, "arpege": 0.55, "basse": 0.72, "percu": 0.75},
    "fin": {"nappe": 0.9, "arpege": 0.5, "basse": 0.65, "percu": 0.6},
}


def niveau(couche, t):
    v = NIVEAUX[ORDRE[0]][couche]
    for sid in ORDRE[1:]:
        d = SCENES[sid]["debut"]
        u = np.clip((t - (d - 0.5)) / 1.0, 0, 1)
        u = 0.5 - 0.5 * np.cos(np.pi * u)
        v = v * (1 - u) + NIVEAUX[sid][couche] * u
    if t >= T_FINAL and couche in ("percu", "basse", "arpege"):
        return 0.0  # la rythmique s'arrête sur l'accent final
    return v


def enveloppe(n, attaque, relache, total):
    t = np.arange(n) / SR
    a = np.clip(t / max(attaque, 1e-3), 0, 1)
    a = 0.5 - 0.5 * np.cos(np.pi * a)
    r = np.clip((total - t) / max(relache, 1e-3), 0, 1)
    r = 0.5 - 0.5 * np.cos(np.pi * r)
    return a * r


def ajouter(buf, debut, sig, pan=0.0):
    i = int(debut * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[: len(buf) - i]
    g = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    buf[i: i + len(sig), 0] += sig * g[0]
    buf[i: i + len(sig), 1] += sig * g[1]


def note_nappe(f, duree, relache=1.2):
    total = duree + relache
    n = int(total * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for detune in (-0.002, 0.0, 0.0021):
        ph = rng.uniform(0, 2 * np.pi)
        for h in range(1, 8):
            s += (1.0 / h ** 1.5) * np.sin(2 * np.pi * f * (1 + detune) * h * t + ph * h)
    return s * enveloppe(n, 0.25, relache, total) / 3.0


def note_pincee(f, vel, total=0.45):
    n = int(total * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for h, a in ((1, 1.0), (2, 0.5), (3, 0.22), (4, 0.1)):
        s += a * np.exp(-t * (9 + 5 * h)) * np.sin(2 * np.pi * f * h * t)
    return s * np.clip(t / 0.003, 0, 1) * vel


def note_basse(f, duree=0.22):
    total = duree + 0.06
    n = int(total * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return np.tanh(1.6 * s) / 1.2 * enveloppe(n, 0.006, 0.07, total)


def grosse_caisse():
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    clic = rng.standard_normal(n) * np.exp(-t * 400) * 0.15
    return (np.sin(ph) * np.exp(-t * 11) + clic) * np.clip(t / 0.002, 0, 1)


def bruit_filtre(n, bas, haut):
    b = rng.standard_normal(n)
    if bas:
        b = sosfilt(butter(4, bas, "highpass", fs=SR, output="sos"), b)
    if haut:
        b = sosfilt(butter(4, haut, "lowpass", fs=SR, output="sos"), b)
    return b


def clap():
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    b = bruit_filtre(n, 900, 5000)
    env = np.zeros(n)
    for k, d in enumerate((0.0, 0.011, 0.022)):
        env += (t >= d) * np.exp(-(t - d).clip(0) * (90 if k < 2 else 22))
    return b * env * 0.6


def charleston(ouvert=False):
    n = int((0.3 if ouvert else 0.06) * SR)
    t = np.arange(n) / SR
    return bruit_filtre(n, 7500, None) * np.exp(-t * (9 if ouvert else 70))


def shaker():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return bruit_filtre(n, 5000, 10000) * np.sin(np.pi * np.clip(t / 0.05, 0, 1)) ** 2


def cymbale():
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    return bruit_filtre(n, 3500, None) * np.exp(-t * 1.8) * np.clip(t / 0.002, 0, 1)


def impact():
    n = int(1.3 * SR)
    t = np.arange(n) / SR
    f = 38 + 50 * np.exp(-t * 6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2) * np.clip(t / 0.004, 0, 1)


def montee(duree=0.9):
    """Souffle qui monte vers l'accent (bruit filtré de plus en plus aigu)."""
    n = int(duree * SR)
    u = np.arange(n) / n
    grave, aigu = bruit_filtre(n, 300, 1500), bruit_filtre(n, 3500, 11000)
    return ((1 - u ** 1.5) * grave + u ** 1.5 * aigu) * u ** 2.2


def main():
    nappe = np.zeros((N, 2))
    arp = np.zeros((N, 2))
    basse = np.zeros((N, 2))
    percu = np.zeros((N, 2))
    accents = np.zeros((N, 2))
    pompe = np.ones(N)  # gain de la nappe, « pompé » par la grosse caisse

    t, k = 0.0, 0
    while t < DUREE + MESURE:
        nom = GRILLE[k % len(GRILLE)] if t < T_FINAL else "D"
        if t < T_FINAL:
            for j, m in enumerate(ACCORDS[nom]["nappe"]):
                ajouter(nappe, t, note_nappe(hz(m), MESURE) * 0.2 * niveau("nappe", t), pan=(-0.4, 0.4, -0.15, 0.15)[j])
        for i in range(16):  # doubles croches
            ti = t + i * TEMPS / 4
            if ti >= T_FINAL:
                break
            g = niveau("arpege", ti)
            if g > 0.01:
                vel = (1.0 if i % 4 == 0 else 0.72 if i % 2 == 0 else 0.55) * rng.uniform(0.9, 1.0)
                ajouter(arp, ti, note_pincee(hz(ACCORDS[nom]["arpege"][MOTIF[i]]), vel) * 0.11 * g, pan=0.35 if i % 2 else -0.35)
            if i % 2 == 0:  # basse en croches : fondamentale, puis octave sur le contretemps
                gb = niveau("basse", ti)
                if gb > 0.01:
                    f = hz(ACCORDS[nom]["basse"] + (12 if i % 4 == 2 else 0))
                    ajouter(basse, ti, note_basse(f) * 0.32 * gb)
            gp = niveau("percu", ti)
            intro = ti < T_MODULE1 - 0.05
            if gp > 0.01:
                if i % 4 == 0 and not intro:
                    ajouter(percu, ti, grosse_caisse() * 0.42 * gp)
                    a = int(ti * SR)
                    nn = min(int(0.35 * SR), N - a)
                    if nn > 0:
                        pompe[a: a + nn] = np.minimum(pompe[a: a + nn], 1 - 0.45 * gp * np.exp(-np.arange(nn) / SR * 9))
                if i in (4, 12) and not intro:
                    ajouter(percu, ti, clap() * 0.2 * gp, pan=0.05)
                if i % 4 == 2:
                    ouvert = (k % 4 == 3 and i == 14)
                    ajouter(percu, ti, charleston(ouvert) * (0.07 if ouvert else 0.055) * gp, pan=0.25)
                ajouter(percu, ti, shaker() * (0.022 if i % 2 else 0.012) * gp, pan=-0.3)
        t += MESURE
        k += 1

    # Accents au début de chaque module (carton « Nouveau ») et accent final
    for sid in MODULES:
        d = SCENES[sid]["debut"]
        ajouter(accents, d - 0.9, montee(0.9) * 0.05)
        ajouter(accents, d, cymbale() * 0.06, pan=0.15)
        ajouter(accents, d, impact() * 0.32)
    ajouter(accents, T_FINAL - 1.2, montee(1.2) * 0.05)
    ajouter(accents, T_FINAL, cymbale() * 0.07)
    ajouter(accents, T_FINAL, impact() * 0.36)
    # Générique : ré majeur tenu, avec un dernier arpège qui s'éteint
    tenue = DUREE + 0.2 - T_FINAL
    for j, m in enumerate(ACCORDS["D"]["nappe"] + [69, 74]):
        ajouter(nappe, T_FINAL, note_nappe(hz(m), max(0.5, tenue - 2.5), relache=3.0) * 0.2 * 0.9, pan=(-0.4, 0.4, -0.15, 0.15, 0.0, 0.1)[j])
    ajouter(basse, T_FINAL, note_basse(hz(38), max(0.5, tenue - 2.0)) * 0.3 * 0.6)
    for i, note in enumerate([62, 66, 69, 74, 78, 81, 74, 69]):
        ajouter(arp, T_FINAL + i * TEMPS / 2, note_pincee(hz(note), 0.8 - i * 0.06, total=1.4) * 0.12 * 0.6, pan=-0.35 if i % 2 else 0.35)

    nappe *= pompe[:, None]
    nappe = sosfilt(butter(2, 160, "highpass", fs=SR, output="sos"), nappe, axis=0)  # laisse le bas-médium à la voix et à la basse
    # Réverbération (convolution) sur la nappe, les arpèges et les accents
    lr = int(2.2 * SR)
    tt = np.arange(lr) / SR
    ir = np.zeros((lr, 2))
    for c in range(2):
        b = rng.standard_normal(lr) * np.exp(-tt * 3.6)
        b = sosfilt(butter(2, 6000, "lowpass", fs=SR, output="sos"), b)
        b[: int(0.018 * SR)] = 0
        ir[:, c] = b / np.sqrt(np.sum(b ** 2))
    sec = nappe + arp + accents * 0.6
    hum = np.stack([fftconvolve(sec[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
    mix = 0.8 * (nappe + arp) + accents + 0.32 * hum + basse + percu
    mix = sosfilt(butter(2, 28, "highpass", fs=SR, output="sos"), mix, axis=0)
    mix = sosfilt(butter(2, 14000, "lowpass", fs=SR, output="sos"), mix, axis=0)
    # Fondus d'ouverture et de fermeture
    t = np.arange(N) / SR
    fondu = np.clip(t / 1.5, 0, 1) * np.clip((DUREE - t) / 3.0, 0, 1)
    mix *= (0.5 - 0.5 * np.cos(np.pi * fondu))[:, None]
    mix = mix[: int(DUREE * SR)]
    mix = np.tanh(mix / max(1e-9, np.max(np.abs(mix))) * 1.4) / np.tanh(1.4)  # légère saturation douce : plus de présence
    mix *= 10 ** (-3 / 20)
    sortie = os.path.join(ICI, "build", "musique.wav")
    with wave.open(sortie, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
    print("Musique : %s (%.1f s, %d BPM)" % (sortie, len(mix) / SR, BPM))


if __name__ == "__main__":
    main()
