# DRUGS.WIKI

A static site for structured harm reduction and pharmacology data.

---

## Overview

| Typical wiki-style resources | drugs.wiki |
|------------------------------|------------|
| Mixed free-text entries | Structured data |
| Anecdotal descriptions | Curated reference fields |
| Inconsistent formatting | Schema-based JSON |
| Varying citation quality | Citation-backed entries |

---

## Features

- **Dosage tables** with threshold, light, common, strong, and heavy ranges
- **Duration charts** based on structured timing data
- **Interaction grids** for dangerous, unsafe, and caution-level combinations
- **Subjective effects** displayed in a visual summary
- **Citations** attached to entries where available
- **Scroll-aware section tracking** to make longer entries easier to navigate

---

## Data

The database lives in [`drugs.json`](https://github.com/Di-lemma/drugs) (or is embedded as `drugs-data.js`), using a consistent JSON schema.

Example:

```json
{
  "drug_name": "MDMA",
  "aliases": ["Molly", "Ecstasy", "E"],
  "categories": ["empathogen", "stimulant"],
  "dosages": {
    "routes_of_administration": [
      {
        "route": "oral",
        "units": "mg",
        "dose_ranges": {
          "threshold": "40",
          "light": "40-75",
          "common": "75-120",
          "strong": "120-180",
          "heavy": "180+"
        }
      }
    ]
  },
  "duration_curves": [ ... ],
  "interactions": { ... },
  "subjective_effects": ["euphoria", "empathy", "teeth grinding"],
  "citations": [ ... ]
}
