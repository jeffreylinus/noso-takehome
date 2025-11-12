#!/usr/bin/env python3
"""
Usage:
  pip install -r requirements.txt
  # .env must contain: ASSEMBLY_AI_API_KEY=sk_...
  python make_data_from_assemblyai_sdk.py 39472_N_Darner_Dr_2.m4a -o data.js

Notes:
- The SDK accepts local file paths OR URLs directly.
- Output data.js matches your frontend schema.
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
import assemblyai as aai

def load_api_key() -> str:
    load_dotenv()
    key = os.getenv("ASSEMBLY_AI_API_KEY")
    if not key:
        sys.exit("Missing ASSEMBLY_AI_API_KEY in environment/.env")
    return key

def js_escape(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
         .replace("\n", " ")
         .replace("\r", " ")
         .replace('"', '\\"')
    )

def ms_to_s(ms: int) -> float:
    return round(float(ms) / 1000.0, 3)

def build_segments(transcript) -> List[dict]:
    """
    Prefer transcript.utterances (includes speaker, start, end).
    Fallback to transcript.words by grouping same-speaker words with short gaps.
    Speaker labels are mapped by first appearance -> 'Speaker 1..N'.
    """
    # First-appearance mapping
    order: List[str] = []
    idx: Dict[str, int] = {}
    def display(raw: Optional[str]) -> Optional[str]:
        if raw is None:
            return None
        k = str(raw)
        if k not in idx:
            order.append(k)
            idx[k] = len(order)  # 1-based
        return f"Speaker {idx[k]}"

    out: List[dict] = []

    if getattr(transcript, "utterances", None):
        for u in transcript.utterances:
            # aai SDK: u.start, u.end are milliseconds
            out.append({
                "start": ms_to_s(u.start),
                "end":   ms_to_s(u.end),
                "text":  (u.text or "").strip(),
                "speaker": display(getattr(u, "speaker", None)),
            })
        return out

    # Fallback: words (if utterances not provided)
    words = getattr(transcript, "words", None) or []
    if not words:
        raise RuntimeError("No utterances or words returned; check API config or media content.")

    MAX_GAP = 0.6
    MAX_CHARS = 240
    cur = None
    for w in words:
        s = ms_to_s(w.start)
        e = ms_to_s(w.end)
        t = (w.text or "").strip()
        spk_disp = display(getattr(w, "speaker", None))
        if not t:
            continue
        if cur is None:
            cur = {"start": s, "end": e, "text": t, "speaker": spk_disp}
            continue
        gap = s - cur["end"]
        same_spk = (spk_disp == cur["speaker"])
        if same_spk and gap <= MAX_GAP and (len(cur["text"]) + 1 + len(t) <= MAX_CHARS):
            cur["end"] = e
            cur["text"] += " " + t
        else:
            out.append(cur)
            cur = {"start": s, "end": e, "text": t, "speaker": spk_disp}
    if cur:
        out.append(cur)
    return out

def write_data_js(out_path: Path, audio_src: str, segments: List[dict]) -> None:
    with out_path.open("w", encoding="utf-8") as f:
        f.write("window.APP_DATA = {\n")
        f.write(f'  audioSrc: "{js_escape(audio_src)}",\n')
        f.write("  transcript: [\n")
        for m in segments:
            spk = m.get("speaker")
            spk_js = ("null" if spk is None else f'"{js_escape(spk)}"')
            f.write(f'    {{ start: {m["start"]:.3f}, end: {m["end"]:.3f}, speaker: {spk_js}, text: "{js_escape(m["text"])}" }},\n')
        f.write("  ],\n")
        f.write("  commentary: []\n")
        f.write("};\n")

def main():
    parser = argparse.ArgumentParser(description="Transcribe via AssemblyAI SDK and emit data.js")
    parser.add_argument("audio", help="Local file path or URL")
    parser.add_argument("-o", "--out", default="data.js", help="Output data.js (default: data.js)")
    args = parser.parse_args()

    api_key = load_api_key()
    aai.settings.api_key = api_key

    audio_arg = args.audio
    # If local file, ensure it exists for helpful error messages
    if not (audio_arg.startswith("http://") or audio_arg.startswith("https://")):
        p = Path(audio_arg)
        if not p.exists():
            sys.exit(f"Audio file not found: {p}")

    # Request diarization
    config = aai.TranscriptionConfig(speaker_labels=True, format_text=True)
    transcriber = aai.Transcriber()

    # The SDK handles upload if you pass a local path
    transcript = transcriber.transcribe(audio_arg, config)

    if transcript.status != aai.TranscriptStatus.completed:
        # The SDK will raise on failure, but guard just in case
        sys.exit(f"Transcription not completed: status={transcript.status}, error={transcript.error}")

    segments = build_segments(transcript)
    segments.sort(key=lambda x: x["start"])

    out_path = Path(args.out)
    # Use basename for audioSrc if local path; keep URL as-is if remote
    audio_src_for_js = audio_arg if audio_arg.startswith(("http://", "https://")) else Path(audio_arg).name
    write_data_js(out_path, audio_src_for_js, segments)
    print(f"[ok] wrote {out_path} with {len(segments)} segments")

if __name__ == "__main__":
    main()
