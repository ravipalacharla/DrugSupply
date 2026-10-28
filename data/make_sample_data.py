"""
Generate anonymised sample data for the Drug Supply Kit Flow page.

Output: kit_flow.csv (next to this script)
Columns: Month, Depot, Country, Outcome, Qty
  - One row per month / depot / country / outcome (rows with Qty 0 are skipped)
  - "Expired at Depot" rows have a blank Country (those kits never shipped)

Run once:  python make_sample_data.py
A fixed random seed means the same file is produced every time.
"""

import csv
import random
from pathlib import Path

random.seed(3056)

MONTHS = [f"2025-{m:02d}" for m in range(1, 13)]

# Depot -> {Country: relative size of that country's site network}
# France and Spain are supplied by two depots, so the country column adds information.
DEPOTS = {
    "Depot A - Central EU":    {"Germany": 1.4, "France": 0.8, "Spain": 0.6},
    "Depot B - United Kingdom": {"United Kingdom": 1.2, "France": 0.5, "Spain": 0.5},
    "Depot C - North America": {"United States": 2.0, "Canada": 0.7},
    "Depot D - Latin America": {"Brazil": 1.0, "Mexico": 0.7},
    "Depot E - Asia Pacific":  {"Japan": 1.1, "South Korea": 0.8, "Australia": 0.5},
}

# Countries where kits expire at site more often (slower enrolment), to give the chart a story
HIGH_EXPIRY_COUNTRIES = {"Brazil", "Mexico", "Australia"}

KITS_PER_UNIT = 40  # monthly kits shipped per unit of country size at full enrolment


def enrolment_ramp(month_index):
    """Trial starts slowly and reaches full enrolment around month 7."""
    return min(1.0, 0.3 + 0.1 * month_index)


def split_outcomes(shipped, country, month_index):
    """Split shipped kits into outcomes. Dispensed takes whatever is left."""
    expiry_rate = random.uniform(0.08, 0.14) if country in HIGH_EXPIRY_COUNTRIES else random.uniform(0.03, 0.07)
    expiry_rate += 0.005 * month_index  # older stock expires more later in the trial
    expired = round(shipped * expiry_rate)
    damaged = round(shipped * random.uniform(0.01, 0.03))
    returned = round(shipped * random.uniform(0.04, 0.09))
    dispensed = shipped - expired - damaged - returned
    return {
        "Dispensed": dispensed,
        "Expired at Site": expired,
        "Damaged": damaged,
        "Returned": returned,
    }


def main():
    rows = []
    for m_idx, month in enumerate(MONTHS):
        for depot, countries in DEPOTS.items():
            for country, size in countries.items():
                shipped = round(size * KITS_PER_UNIT * enrolment_ramp(m_idx) * random.uniform(0.8, 1.2))
                for outcome, qty in split_outcomes(shipped, country, m_idx).items():
                    rows.append([month, depot, country, outcome, qty])

            # Kits that expire on the depot shelf. Depot D has a spike in July (a lot expired before shipping).
            depot_expiry = random.randint(0, 8)
            if depot == "Depot D - Latin America" and month == "2025-07":
                depot_expiry = 45
            rows.append([month, depot, "", "Expired at Depot", depot_expiry])

    rows = [r for r in rows if r[4] > 0]

    out_path = Path(__file__).with_name("kit_flow.csv")
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Month", "Depot", "Country", "Outcome", "Qty"])
        writer.writerows(rows)

    # Short summary so the totals can be checked against the page later
    print(f"Wrote {len(rows)} rows to {out_path}")
    totals = {}
    for r in rows:
        totals[r[3]] = totals.get(r[3], 0) + r[4]
    for outcome, qty in totals.items():
        print(f"  {outcome:<17}{qty:>7}")
    print(f"  {'Total kits':<17}{sum(totals.values()):>7}")


if __name__ == "__main__":
    main()
