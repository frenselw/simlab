"""Plot the recorded textbook/model comparison; no simulator calculation here."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/circuit-textbook-verification"
os.environ.setdefault("MPLCONFIGDIR", str(OUT / ".matplotlib"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

data = json.loads((OUT / "numeric-results.json").read_text())
rows = [r for r in data["results"] if r["group"] == "lamp-curve" and r["comparison"]]
voltage = [float(r["id"].rsplit("-", 1)[1]) for r in rows]
book = [r["comparison"]["reported"] for r in rows]
sim = [r["comparison"]["actual"] for r in rows]
plt.rcParams.update({"font.family": "DejaVu Sans", "mathtext.fontset": "stix", "font.size": 11})
fig, ax = plt.subplots(figsize=(7.2, 4.1), layout="constrained")
ax.errorbar(voltage, book, yerr=.02, fmt="o-", color="#bd6b19", capsize=4,
            label="Textbook curve (approximate, comparison band ±0.02 A)")
ax.plot([0] + voltage, [0] + sim, "s-", color="#176f9f", linewidth=2,
        label="Simulator thermal lamp")
ax.set(xlim=(0, 2.65), ylim=(0, .48), xlabel=r"Voltage $U$ (V)", ylabel=r"Current $I$ (A)")
ax.set_xticks([0, .5, 1, 1.5, 2, 2.5])
ax.set_yticks([0, .1, .2, .3, .4])
ax.grid(color="#dce4ea", linewidth=.7)
ax.set_axisbelow(True)
ax.spines[["top", "right"]].set_visible(False)
ax.legend(loc="upper left", frameon=False, fontsize=9)
ax.annotate("Rated point calibrated to 2.5 V / 0.43 A",
            xy=(2.5, .43), xytext=(1.45, .17), fontsize=9, color="#3e5362",
            arrowprops={"arrowstyle": "->", "color": "#8293a0"})
fig.savefig(OUT / "lamp-curve.png", dpi=220, facecolor="white")
plt.close(fig)
print(OUT / "lamp-curve.png")
