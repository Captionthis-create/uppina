"""
voix.py : synthèse de la voix off, une phrase par fichier, avec contrôle automatique de chaque phrase
par reconnaissance vocale (Whisper). Deux moteurs de Kyutai, au choix dans scenario.json (« voix ») :
  - « pocket-tts »  : Pocket TTS, modèle français 24 couches (« langue »), voix prédéfinie (« nom », ex. estelle) ;
                      environ le temps réel sur processeur.
  - « kyutai-1.6b » : Kyutai TTS 1.6B (en_fr), voix de la banque kyutai/tts-voices (« nom », ex.
                      cml-tts/fr/928_486_000075-0001_enhanced.wav) ; environ 5 à 6 fois le temps réel sur processeur.

Entrée  : scenario.json (champ « dit » de chaque phrase, voix dans « voix »)
Sortie  : build/voix/<id>.wav (48 kHz mono, silences rognés, niveau homogène)
          build/voix/durees.json ({ id: durée en secondes }) et build/voix/controle.json (transcriptions)
Contrôle: chaque phrase est transcrite ; si l'écart avec le texte est trop grand ou la durée anormale,
          elle est régénérée avec une autre graine (jusqu'à 6 essais) et le meilleur essai est gardé.
Usage   : python voix.py            (toutes les phrases)
          python voix.py m4 n1      (seulement certaines)
          python voix.py --strict a1  (n'accepter qu'une transcription exacte, sinon garder le meilleur des 6 essais)
Licences: modèles Kyutai sous CC-BY 4.0 ; voix CML-TTS sous CC-BY 4.0, voix enregistrées par Kyutai sous CC0 :
          l'attribution figure au générique.
"""
import json
import os
import re
import subprocess
import sys
import unicodedata
import wave
from math import gcd

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")  # téléchargement HTTP classique (derrière certains proxys, Xet est bloqué)

import numpy as np
import soundfile as sf
import torch
from scipy.signal import resample_poly

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "build", "voix")
ESSAIS = 6


def rogner(x, taux, seuil_db=-45.0, marge=0.06):
    """Retire les silences de début et de fin (enveloppe RMS sur 10 ms)."""
    fen = max(1, int(taux * 0.01))
    n = len(x) // fen
    if n == 0:
        return x
    rms = np.sqrt(np.mean(x[: n * fen].reshape(n, fen) ** 2, axis=1) + 1e-12)
    actifs = np.where(20 * np.log10(rms) > seuil_db)[0]
    if len(actifs) == 0:
        return x
    debut = max(0, actifs[0] * fen - int(marge * taux))
    fin = min(len(x), (actifs[-1] + 1) * fen + int(marge * taux))
    return x[debut:fin]


def niveau(x, taux, cible_db=-20.0):
    """Ramène le niveau RMS des passages parlés à cible_db (phrases homogènes entre elles)."""
    fen = max(1, int(taux * 0.02))
    n = len(x) // fen
    rms = np.sqrt(np.mean(x[: n * fen].reshape(n, fen) ** 2, axis=1) + 1e-12)
    parle = rms[rms > 10 ** (-40 / 20)]
    if len(parle) == 0:
        return x
    g = 10 ** (cible_db / 20) / np.sqrt(np.mean(parle ** 2))
    y = x * g
    crete = np.max(np.abs(y))
    return y * (0.95 / crete) if crete > 0.95 else y


def normaliser(s):
    s = unicodedata.normalize("NFC", s.lower()).replace("’", "'")
    s = re.sub(r"[^\w' ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# Mots ignorés dans le contrôle : noms propres, sigles et nombres, que Whisper écrit à sa façon (Up'Pina, 8h05, FEC…)
IGNORES = re.compile(r"^(eupe|pina|pop|i|a|hi|ha|f|e|c|ttc|sms|\d.*|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|"
                     r"quinze|seize|vingt|trente|quarante|cinquante|soixante|cent|mille|et|heures?|h|pour|euros?|€|%)$")


def ecart(ref, hyp):
    """Taux d'erreur sur les mots (Levenshtein), sans les mots ignorés."""
    r = [w for w in normaliser(ref).replace("-", " ").split() if not IGNORES.match(w)]
    h = [w for w in normaliser(hyp).replace("-", " ").split() if not IGNORES.match(w)]
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prec, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            prec, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prec + (r[i - 1] != h[j - 1]))
    return d[len(h)] / max(1, len(r))


def moteur_pocket(v):
    from pocket_tts import TTSModel
    from pocket_tts.utils.utils import get_predefined_voice
    modele = TTSModel.load_model(language=v["langue"])
    etat = modele.get_state_for_audio_prompt(get_predefined_voice(v["langue"], v["nom"]))
    def dire(texte):
        return modele.generate_audio(etat, texte, copy_state=True).squeeze().cpu().numpy().astype(np.float32)
    return modele.sample_rate, dire


def moteur_kyutai(v):
    from moshi.models.loaders import CheckpointInfo
    from moshi.models.tts import TTSModel, DEFAULT_DSM_TTS_REPO
    tts = TTSModel.from_checkpoint_info(CheckpointInfo.from_hf_repo(DEFAULT_DSM_TTS_REPO), n_q=32, temp=0.6, device="cpu", dtype=torch.float32)
    attributs = tts.make_condition_attributes([tts.get_voice_path(v["nom"])], cfg_coef=2.0)
    def dire(texte):
        pcms = []
        def sur_trame(trame):
            if (trame != -1).all():
                pcms.append(np.clip(tts.mimi.decode(trame[:, 1:, :]).cpu().float().numpy()[0, 0], -1, 1))
        with tts.mimi.streaming(1), torch.no_grad():
            tts.generate([tts.prepare_script([texte], padding_between=1)], [attributs], on_frame=sur_trame)
        return np.concatenate(pcms).astype(np.float32)
    return tts.mimi.sample_rate, dire


def main():
    from faster_whisper import WhisperModel

    with open(os.path.join(ICI, "scenario.json"), encoding="utf-8") as f:
        sc = json.load(f)
    v = sc["voix"]
    torch.set_num_threads(os.cpu_count() or 4)
    sr, dire = (moteur_kyutai if v["moteur"] == "kyutai-1.6b" else moteur_pocket)(v)
    asr = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")

    os.makedirs(SORTIE, exist_ok=True)
    f_durees, f_controle = os.path.join(SORTIE, "durees.json"), os.path.join(SORTIE, "controle.json")
    durees = json.load(open(f_durees)) if os.path.exists(f_durees) else {}
    controle = json.load(open(f_controle, encoding="utf-8")) if os.path.exists(f_controle) else {}
    strict = "--strict" in sys.argv
    voulus = set(a for a in sys.argv[1:] if not a.startswith("--"))
    for scene in sc["scenes"]:
        for b in scene["beats"]:
            if voulus and b["id"] not in voulus:
                continue
            mots = len(normaliser(b["dit"]).split())
            meilleur = None
            for essai in range(ESSAIS):
                torch.manual_seed(1000 * essai + sum(map(ord, b["id"])))
                x = dire(b["dit"])
                x = rogner(x, sr)
                duree = len(x) / sr
                g = gcd(sr, 16000)
                transcrit = " ".join(s.text for s in asr.transcribe(resample_poly(x, 16000 // g, sr // g).astype(np.float32), language="fr", beam_size=5)[0]).strip()
                e = ecart(b["dit"], transcrit)
                debit = mots / max(duree, 0.1)
                # Pénalité si le débit sort de la plage naturelle (silences anormaux ou phrase avalée)
                note = e + (0.25 if not (2.0 <= debit <= 4.2) else 0.0)
                if meilleur is None or note < meilleur[0]:
                    meilleur = (note, x, transcrit, e, debit, essai)
                if note <= (0.0 if strict else 0.08):
                    break
            note, x, transcrit, e, debit, essai = meilleur
            x = niveau(x, sr)
            brut = os.path.join(SORTIE, b["id"] + "-24k.wav")
            sf.write(brut, x, sr, subtype="PCM_16")
            final = os.path.join(SORTIE, b["id"] + ".wav")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", brut, "-af", "highpass=f=60,aresample=48000:resampler=soxr", "-ar", "48000", "-ac", "1", final], check=True)
            os.remove(brut)
            with wave.open(final, "rb") as wf:
                durees[b["id"]] = round(wf.getnframes() / wf.getframerate(), 3)
            controle[b["id"]] = {"texte": b["dit"], "entendu": transcrit, "ecart": round(e, 3), "debit": round(debit, 2), "essais": essai + 1}
            alerte = "  ⚠" if e > 0.15 else ""
            print("%-3s %5.2f s  écart %.2f  %d essai(s)%s  « %s »" % (b["id"], durees[b["id"]], e, essai + 1, alerte, transcrit), flush=True)
            with open(f_durees, "w") as f:
                json.dump(durees, f, indent=1)
            with open(f_controle, "w", encoding="utf-8") as f:
                json.dump(controle, f, indent=1, ensure_ascii=False)
    print("Total voix : %.1f s" % sum(durees.values()))


if __name__ == "__main__":
    main()
