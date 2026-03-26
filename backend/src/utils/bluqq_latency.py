"""
BluQQ Latency Measurement Module
──────────────────────────────────
Har stage ka latency measure karta hai:
- STT latency  (caller ruka → transcript ready)
- LLM latency  (transcript → AI response start)
- TTS latency  (AI text → audio start)
- E2E latency  (caller ruka → AI bolne laga)
- Per-turn breakdown
"""

import os
import json
import time
import logging
from datetime import datetime
from collections import defaultdict

log = logging.getLogger("bluqq")


# ─────────────────────────────────────────────────────────────────────────────
# LATENCY TRACKER
# ─────────────────────────────────────────────────────────────────────────────

class LatencyTracker:
    """
    Call ke dauran har stage ka time measure karta hai.

    Flow:
    Caller stops speaking
         ↓ [STT latency]
    Transcript ready
         ↓ [LLM latency]
    AI first token
         ↓ [TTS latency]
    Audio starts playing
    ─────────────────────
    E2E = STT + LLM + TTS
    """

    def __init__(self, session_id: str):
        self.session_id = session_id

        # Timestamps — har stage ke liye
        self._marks: dict[str, float] = {}

        # Per-turn data
        self.turns: list[dict] = []
        self._current_turn: dict = {}

        # Aggregated stats
        self.stt_latencies: list[int] = []
        self.llm_latencies: list[int] = []
        self.tts_latencies: list[int] = []
        self.e2e_latencies: list[int] = []

        # Call-level timestamps
        self.call_start = time.perf_counter()
        self.call_end   = None

    # ── Mark helpers ──────────────────────────────────────────────────────────

    def mark(self, label: str):
        """Ek timestamp save karo."""
        self._marks[label] = time.perf_counter()

    def ms_between(self, start_label: str, end_label: str) -> int:
        """Do marks ke beech ka time milliseconds mein."""
        s = self._marks.get(start_label)
        e = self._marks.get(end_label)
        if s is None or e is None:
            return 0
        return max(0, int((e - s) * 1000))

    # ── Turn lifecycle ─────────────────────────────────────────────────────────

    def turn_start(self, turn_num: int):
        """Naya turn shuru — caller bolna shuru kiya."""
        self._current_turn = {
            "turn":             turn_num,
            "timestamp":        datetime.now().isoformat(),
            "speech_start":     time.perf_counter(),
            "speech_end":       None,
            "transcript_ready": None,
            "llm_first_token":  None,
            "tts_first_audio":  None,
            "stt_ms":           0,
            "llm_ms":           0,
            "tts_ms":           0,
            "e2e_ms":           0,
        }
        self.mark(f"turn_{turn_num}_speech_start")

    def speech_ended(self, turn_num: int):
        """Caller ne bolna band kiya — STT processing shuru."""
        if "speech_end" in self._current_turn:
            self._current_turn["speech_end"] = time.perf_counter()
        self.mark(f"turn_{turn_num}_speech_end")

    def transcript_ready(self, turn_num: int, text: str = ""):
        """STT ne transcript diya — LLM processing shuru."""
        now = time.perf_counter()
        self._current_turn["transcript_ready"] = now
        self._current_turn["transcript_text"]  = text[:80]
        self.mark(f"turn_{turn_num}_transcript")

        # STT latency calculate
        speech_end = self._marks.get(f"turn_{turn_num}_speech_end")
        if speech_end:
            stt_ms = int((now - speech_end) * 1000)
            self._current_turn["stt_ms"] = stt_ms
            self.stt_latencies.append(stt_ms)
            log.info(f"⚡ [Latency] STT turn {turn_num}: {stt_ms}ms")

    def llm_first_token(self, turn_num: int):
        """LLM ne pehla token diya — TTS shuru ho sakta hai."""
        now = time.perf_counter()
        self._current_turn["llm_first_token"] = now
        self.mark(f"turn_{turn_num}_llm_token")

        # LLM latency calculate
        transcript_time = self._marks.get(f"turn_{turn_num}_transcript")
        if transcript_time:
            llm_ms = int((now - transcript_time) * 1000)
            self._current_turn["llm_ms"] = llm_ms
            self.llm_latencies.append(llm_ms)
            log.info(f"⚡ [Latency] LLM turn {turn_num}: {llm_ms}ms")

    def tts_first_audio(self, turn_num: int):
        """TTS ne pehla audio chunk diya — caller sun sakta hai."""
        now = time.perf_counter()
        self._current_turn["tts_first_audio"] = now
        self.mark(f"turn_{turn_num}_tts_audio")

        # TTS latency
        llm_time = self._marks.get(f"turn_{turn_num}_llm_token")
        if llm_time:
            tts_ms = int((now - llm_time) * 1000)
            self._current_turn["tts_ms"] = tts_ms
            self.tts_latencies.append(tts_ms)
            log.info(f"⚡ [Latency] TTS turn {turn_num}: {tts_ms}ms")

        # E2E latency — caller ruka se audio start
        speech_end = self._marks.get(f"turn_{turn_num}_speech_end")
        if speech_end:
            e2e_ms = int((now - speech_end) * 1000)
            self._current_turn["e2e_ms"] = e2e_ms
            self.e2e_latencies.append(e2e_ms)

            # Quality check
            quality = self._quality_label(e2e_ms)
            log.info(f"⚡ [Latency] E2E turn {turn_num}: {e2e_ms}ms [{quality}]")

    def turn_end(self, turn_num: int):
        """Turn khatam — data save karo."""
        if self._current_turn:
            self.turns.append(dict(self._current_turn))
            self._current_turn = {}

    def call_ended(self):
        """Call khatam."""
        self.call_end = time.perf_counter()
        # Last turn save karo agar pending hai
        if self._current_turn:
            self.turns.append(dict(self._current_turn))

    # ── Stats helpers ──────────────────────────────────────────────────────────

    def _avg(self, lst: list) -> int:
        return int(sum(lst) / len(lst)) if lst else 0

    def _quality_label(self, e2e_ms: int) -> str:
        if e2e_ms < 500:   return "🟢 Excellent"
        if e2e_ms < 800:   return "🟡 Good"
        if e2e_ms < 1200:  return "🟠 Acceptable"
        return "🔴 Slow"

    def summary(self) -> dict:
        """Poori call ka latency summary."""
        e2e_list = self.e2e_latencies

        return {
            "session_id": self.session_id,
            "total_turns": len(self.turns),

            # Per-stage averages
            "stt_avg_ms":   self._avg(self.stt_latencies),
            "llm_avg_ms":   self._avg(self.llm_latencies),
            "tts_avg_ms":   self._avg(self.tts_latencies),
            "e2e_avg_ms":   self._avg(e2e_list),

            # E2E stats
            "e2e_min_ms":   min(e2e_list) if e2e_list else 0,
            "e2e_max_ms":   max(e2e_list) if e2e_list else 0,
            "e2e_all":      e2e_list,

            # Quality
            "quality":      self._quality_label(self._avg(e2e_list)),

            # Per-turn breakdown
            "turns": [
                {
                    "turn":    t.get("turn", 0),
                    "stt_ms":  t.get("stt_ms", 0),
                    "llm_ms":  t.get("llm_ms", 0),
                    "tts_ms":  t.get("tts_ms", 0),
                    "e2e_ms":  t.get("e2e_ms", 0),
                    "text":    t.get("transcript_text", "")
                }
                for t in self.turns
            ]
        }

    def save_report(self) -> str:
        """Latency report JSON mein save karo."""
        os.makedirs("logs/latency", exist_ok=True)
        fname = f"logs/latency/{self.session_id}_latency.json"
        with open(fname, "w", encoding="utf-8") as f:
            json.dump(self.summary(), f, indent=2)
        log.info(f"[Latency] Report saved → {fname}")
        return fname

    def print_report(self):
        """Terminal mein latency report print karo."""
        s = self.summary()
        log.info("─" * 55)
        log.info("  LATENCY REPORT")
        log.info("─" * 55)
        log.info(f"  STT avg    : {s['stt_avg_ms']}ms  (speech → transcript)")
        log.info(f"  LLM avg    : {s['llm_avg_ms']}ms  (transcript → AI token)")
        log.info(f"  TTS avg    : {s['tts_avg_ms']}ms  (AI token → audio)")
        log.info(f"  E2E avg    : {s['e2e_avg_ms']}ms  (speech end → audio start)")
        log.info(f"  E2E min    : {s['e2e_min_ms']}ms")
        log.info(f"  E2E max    : {s['e2e_max_ms']}ms")
        log.info(f"  Quality    : {s['quality']}")
        log.info("─" * 55)
        if s["turns"]:
            log.info("  PER-TURN BREAKDOWN:")
            for t in s["turns"]:
                if t["e2e_ms"] > 0:
                    log.info(
                        f"  Turn {t['turn']:2d}: "
                        f"STT={t['stt_ms']:4d}ms "
                        f"LLM={t['llm_ms']:4d}ms "
                        f"TTS={t['tts_ms']:4d}ms "
                        f"E2E={t['e2e_ms']:4d}ms"
                    )
        log.info("─" * 55)


# ─────────────────────────────────────────────────────────────────────────────
# GLOBAL ANALYTICS — Saari calls ka aggregate
# ─────────────────────────────────────────────────────────────────────────────

def get_latency_analytics() -> dict:
    """
    Saare saved latency reports padhke
    aggregate analytics return karo.
    """
    folder = "logs/latency"
    if not os.path.exists(folder):
        return {"message": "No latency data yet"}

    all_e2e = []
    all_stt = []
    all_llm = []
    all_tts = []
    sessions = []

    for fname in os.listdir(folder):
        if not fname.endswith("_latency.json"):
            continue
        try:
            with open(f"{folder}/{fname}", encoding="utf-8") as f:
                data = json.load(f)
            all_e2e.extend(data.get("e2e_all", []))
            if data.get("stt_avg_ms"): all_stt.append(data["stt_avg_ms"])
            if data.get("llm_avg_ms"): all_llm.append(data["llm_avg_ms"])
            if data.get("tts_avg_ms"): all_tts.append(data["tts_avg_ms"])
            sessions.append({
                "session_id": data["session_id"],
                "e2e_avg":    data["e2e_avg_ms"],
                "quality":    data["quality"],
                "turns":      data["total_turns"]
            })
        except Exception:
            continue

    def avg(lst):
        return int(sum(lst) / len(lst)) if lst else 0

    # Quality distribution
    quality_counts = defaultdict(int)
    for e in all_e2e:
        if e < 500:   quality_counts["excellent"] += 1
        elif e < 800: quality_counts["good"]      += 1
        elif e < 1200:quality_counts["acceptable"] += 1
        else:         quality_counts["slow"]       += 1

    return {
        "total_sessions":       len(sessions),
        "total_turns_measured": len(all_e2e),
        "global_averages": {
            "stt_ms": avg(all_stt),
            "llm_ms": avg(all_llm),
            "tts_ms": avg(all_tts),
            "e2e_ms": avg(all_e2e),
        },
        "e2e_stats": {
            "min": min(all_e2e) if all_e2e else 0,
            "max": max(all_e2e) if all_e2e else 0,
            "avg": avg(all_e2e),
        },
        "quality_distribution": dict(quality_counts),
        "sessions": sorted(sessions, key=lambda x: x["e2e_avg"])
    }


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s | %(levelname)-8s | %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S")

    print("Latency Tracker Test\n" + "─" * 40)

    lt = LatencyTracker("TEST_20250320")

    # Simulate 3 turns
    for turn in range(1, 4):
        lt.turn_start(turn)
        time.sleep(0.3)     # caller speaks
        lt.speech_ended(turn)
        time.sleep(0.12)    # STT processing
        lt.transcript_ready(turn, f"Test question {turn}")
        time.sleep(0.2)     # LLM thinking
        lt.llm_first_token(turn)
        time.sleep(0.15)    # TTS processing
        lt.tts_first_audio(turn)
        lt.turn_end(turn)
        time.sleep(0.5)

    lt.call_ended()
    lt.print_report()
    lt.save_report()
    print(f"\nAnalytics: {get_latency_analytics()}")