# Offline Coverage Rule Simulation

Input: after_coverage_observability_fix.json. Stored artifact and dataset labels only; no API execution.

## Baseline reproduction

PASS: 0 mismatches (none).

## Score distributions

- finalScore: {"count":161,"min":0.0043,"p25":0.2059,"median":0.344,"p75":0.4893,"max":0.8072}
- contentScore: {"count":161,"min":0,"p25":0.2095,"median":0.402,"p75":0.6056,"max":1}

## Candidate metrics

| Rule | FP remain | FP fixed | False-missing | Coverage accuracy | Grounding | Rate | Added Grounding |
|---|---:|---:|---:|---:|---:|---:|---|
| BASELINE | 8 | 0 | 0 | 20.0% | 10/40 | 25.0% | — |
| A1_REJECT_AMBIGUOUS | 4 | 4 | 2 | 40.0% | 14/40 | 35.0% | CASE_006, CASE_008, CASE_034, CASE_040 |
| A2_REQUIRE_NON_AMBIGUOUS_PEER | 4 | 4 | 2 | 40.0% | 14/40 | 35.0% | CASE_006, CASE_008, CASE_034, CASE_040 |
| B_EXPLICIT_TARGET | 6 | 2 | 0 | 40.0% | 11/40 | 27.5% | CASE_019 |
| C_FINAL_0.6000 | 1 | 7 | 2 | 70.0% | 15/40 | 37.5% | CASE_006, CASE_008, CASE_019, CASE_034, CASE_040 |
| C_FINAL_0.6500 | 1 | 7 | 2 | 70.0% | 15/40 | 37.5% | CASE_006, CASE_008, CASE_019, CASE_034, CASE_040 |
| C_FINAL_0.7000 | 1 | 7 | 2 | 70.0% | 15/40 | 37.5% | CASE_006, CASE_008, CASE_019, CASE_034, CASE_040 |
| C_FINAL_0.7200 | 1 | 7 | 2 | 70.0% | 15/40 | 37.5% | CASE_006, CASE_008, CASE_019, CASE_034, CASE_040 |
| C_FINAL_0.7500 | 0 | 8 | 2 | 80.0% | 16/40 | 40.0% | CASE_006, CASE_007, CASE_008, CASE_019, CASE_034, CASE_040 |
| C_FINAL_0.2059 | 8 | 0 | 0 | 20.0% | 10/40 | 25.0% | — |
| C_FINAL_0.3440 | 5 | 3 | 0 | 50.0% | 11/40 | 27.5% | CASE_006 |
| D_CONTENT_0.2095 | 7 | 1 | 0 | 30.0% | 10/40 | 25.0% | — |
| D_CONTENT_0.4020 | 5 | 3 | 0 | 50.0% | 11/40 | 27.5% | CASE_006 |
| D_CONTENT_0.6056 | 4 | 4 | 1 | 50.0% | 12/40 | 30.0% | CASE_006, CASE_040 |
| E1_TARGET_OR_FINAL | 8 | 0 | 0 | 20.0% | 10/40 | 25.0% | — |
| E2_TARGET_NONAMBIG | 5 | 3 | 2 | 30.0% | 13/40 | 32.5% | CASE_019, CASE_034, CASE_040 |
| E3_TARGET_CONTENT_NONAMBIG | 5 | 3 | 2 | 30.0% | 13/40 | 32.5% | CASE_019, CASE_034, CASE_040 |
| F1_ZERO_CALL_STRICT | 3 | 5 | 0 | 70.0% | 12/40 | 30.0% | CASE_008, CASE_019 |
| F2_ZERO_CALL_BALANCED | 6 | 2 | 0 | 40.0% | 11/40 | 27.5% | CASE_019 |

## Rule definitions

- BASELINE: Any final retained evidence carrying the issue ID counts.
- A1_REJECT_AMBIGUOUS: Reject ambiguous/fallback evidence entirely.
- A2_REQUIRE_NON_AMBIGUOUS_PEER: An issue needs at least one non-ambiguous selected chunk.
- B_EXPLICIT_TARGET: For reliably evaluable explicit targets, require compatible evidence; otherwise preserve baseline.
- C_FINAL_0.6000: Require finalScore >= 0.6000.
- C_FINAL_0.6500: Require finalScore >= 0.6500.
- C_FINAL_0.7000: Require finalScore >= 0.7000.
- C_FINAL_0.7200: Require finalScore >= 0.7200.
- C_FINAL_0.7500: Require finalScore >= 0.7500.
- C_FINAL_0.2059: Require finalScore >= 0.2059.
- C_FINAL_0.3440: Require finalScore >= 0.3440.
- D_CONTENT_0.2095: Require contentScore >= 0.2095.
- D_CONTENT_0.4020: Require contentScore >= 0.4020.
- D_CONTENT_0.6056: Require contentScore >= 0.6056.
- E1_TARGET_OR_FINAL: Explicit target: target match OR finalScore >= 0.2059; no target: finalScore floor.
- E2_TARGET_NONAMBIG: Explicit target: target match AND non-ambiguous; no target: finalScore >= 0.2059.
- E3_TARGET_CONTENT_NONAMBIG: Explicit target: target match, contentScore >= 0.2095, and non-ambiguous; no target: finalScore >= 0.2059.
- F1_ZERO_CALL_STRICT: Explicit target compatibility mandatory; no target requires finalScore >= 0.2059 and non-ambiguous selection.
- F2_ZERO_CALL_BALANCED: Explicit target compatibility mandatory; no target requires finalScore >= 0.2059 or a non-ambiguous selection.

## Case-by-case impact for the eight real false-positives

### BASELINE

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes BASELINE.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes BASELINE.
- CASE_009: STILL_FALSE_COVERED — at least one retained item passes BASELINE.
- CASE_019: STILL_FALSE_COVERED — at least one retained item passes BASELINE.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes BASELINE.
- CASE_028: STILL_FALSE_COVERED — at least one retained item passes BASELINE.
- CASE_034: STILL_FALSE_COVERED — at least one retained item passes BASELINE.
- CASE_039: STILL_FALSE_COVERED — at least one retained item passes BASELINE.

### A1_REJECT_AMBIGUOUS

- CASE_005: FIXED — no retained item passes A1_REJECT_AMBIGUOUS.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes A1_REJECT_AMBIGUOUS.
- CASE_009: FIXED — no retained item passes A1_REJECT_AMBIGUOUS.
- CASE_019: STILL_FALSE_COVERED — at least one retained item passes A1_REJECT_AMBIGUOUS.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes A1_REJECT_AMBIGUOUS.
- CASE_028: FIXED — no retained item passes A1_REJECT_AMBIGUOUS.
- CASE_034: FIXED — no retained item passes A1_REJECT_AMBIGUOUS.
- CASE_039: STILL_FALSE_COVERED — at least one retained item passes A1_REJECT_AMBIGUOUS.

### A2_REQUIRE_NON_AMBIGUOUS_PEER

- CASE_005: FIXED — no retained item passes A2_REQUIRE_NON_AMBIGUOUS_PEER.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes A2_REQUIRE_NON_AMBIGUOUS_PEER.
- CASE_009: FIXED — no retained item passes A2_REQUIRE_NON_AMBIGUOUS_PEER.
- CASE_019: STILL_FALSE_COVERED — at least one retained item passes A2_REQUIRE_NON_AMBIGUOUS_PEER.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes A2_REQUIRE_NON_AMBIGUOUS_PEER.
- CASE_028: FIXED — no retained item passes A2_REQUIRE_NON_AMBIGUOUS_PEER.
- CASE_034: FIXED — no retained item passes A2_REQUIRE_NON_AMBIGUOUS_PEER.
- CASE_039: STILL_FALSE_COVERED — at least one retained item passes A2_REQUIRE_NON_AMBIGUOUS_PEER.

### B_EXPLICIT_TARGET

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes B_EXPLICIT_TARGET.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes B_EXPLICIT_TARGET.
- CASE_009: STILL_FALSE_COVERED — at least one retained item passes B_EXPLICIT_TARGET.
- CASE_019: FIXED — no retained item passes B_EXPLICIT_TARGET.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes B_EXPLICIT_TARGET.
- CASE_028: STILL_FALSE_COVERED — at least one retained item passes B_EXPLICIT_TARGET.
- CASE_034: STILL_FALSE_COVERED — at least one retained item passes B_EXPLICIT_TARGET.
- CASE_039: FIXED — no retained item passes B_EXPLICIT_TARGET.

### C_FINAL_0.6000

- CASE_005: FIXED — no retained item passes C_FINAL_0.6000.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.6000.
- CASE_009: FIXED — no retained item passes C_FINAL_0.6000.
- CASE_019: FIXED — no retained item passes C_FINAL_0.6000.
- CASE_027: FIXED — no retained item passes C_FINAL_0.6000.
- CASE_028: FIXED — no retained item passes C_FINAL_0.6000.
- CASE_034: FIXED — no retained item passes C_FINAL_0.6000.
- CASE_039: FIXED — no retained item passes C_FINAL_0.6000.

### C_FINAL_0.6500

- CASE_005: FIXED — no retained item passes C_FINAL_0.6500.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.6500.
- CASE_009: FIXED — no retained item passes C_FINAL_0.6500.
- CASE_019: FIXED — no retained item passes C_FINAL_0.6500.
- CASE_027: FIXED — no retained item passes C_FINAL_0.6500.
- CASE_028: FIXED — no retained item passes C_FINAL_0.6500.
- CASE_034: FIXED — no retained item passes C_FINAL_0.6500.
- CASE_039: FIXED — no retained item passes C_FINAL_0.6500.

### C_FINAL_0.7000

- CASE_005: FIXED — no retained item passes C_FINAL_0.7000.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.7000.
- CASE_009: FIXED — no retained item passes C_FINAL_0.7000.
- CASE_019: FIXED — no retained item passes C_FINAL_0.7000.
- CASE_027: FIXED — no retained item passes C_FINAL_0.7000.
- CASE_028: FIXED — no retained item passes C_FINAL_0.7000.
- CASE_034: FIXED — no retained item passes C_FINAL_0.7000.
- CASE_039: FIXED — no retained item passes C_FINAL_0.7000.

### C_FINAL_0.7200

- CASE_005: FIXED — no retained item passes C_FINAL_0.7200.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.7200.
- CASE_009: FIXED — no retained item passes C_FINAL_0.7200.
- CASE_019: FIXED — no retained item passes C_FINAL_0.7200.
- CASE_027: FIXED — no retained item passes C_FINAL_0.7200.
- CASE_028: FIXED — no retained item passes C_FINAL_0.7200.
- CASE_034: FIXED — no retained item passes C_FINAL_0.7200.
- CASE_039: FIXED — no retained item passes C_FINAL_0.7200.

### C_FINAL_0.7500

- CASE_005: FIXED — no retained item passes C_FINAL_0.7500.
- CASE_007: FIXED — no retained item passes C_FINAL_0.7500.
- CASE_009: FIXED — no retained item passes C_FINAL_0.7500.
- CASE_019: FIXED — no retained item passes C_FINAL_0.7500.
- CASE_027: FIXED — no retained item passes C_FINAL_0.7500.
- CASE_028: FIXED — no retained item passes C_FINAL_0.7500.
- CASE_034: FIXED — no retained item passes C_FINAL_0.7500.
- CASE_039: FIXED — no retained item passes C_FINAL_0.7500.

### C_FINAL_0.2059

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.2059.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.2059.
- CASE_009: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.2059.
- CASE_019: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.2059.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.2059.
- CASE_028: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.2059.
- CASE_034: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.2059.
- CASE_039: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.2059.

### C_FINAL_0.3440

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.3440.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.3440.
- CASE_009: FIXED — no retained item passes C_FINAL_0.3440.
- CASE_019: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.3440.
- CASE_027: FIXED — no retained item passes C_FINAL_0.3440.
- CASE_028: FIXED — no retained item passes C_FINAL_0.3440.
- CASE_034: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.3440.
- CASE_039: STILL_FALSE_COVERED — at least one retained item passes C_FINAL_0.3440.

### D_CONTENT_0.2095

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.2095.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.2095.
- CASE_009: FIXED — no retained item passes D_CONTENT_0.2095.
- CASE_019: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.2095.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.2095.
- CASE_028: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.2095.
- CASE_034: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.2095.
- CASE_039: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.2095.

### D_CONTENT_0.4020

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.4020.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.4020.
- CASE_009: FIXED — no retained item passes D_CONTENT_0.4020.
- CASE_019: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.4020.
- CASE_027: FIXED — no retained item passes D_CONTENT_0.4020.
- CASE_028: FIXED — no retained item passes D_CONTENT_0.4020.
- CASE_034: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.4020.
- CASE_039: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.4020.

### D_CONTENT_0.6056

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.6056.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.6056.
- CASE_009: FIXED — no retained item passes D_CONTENT_0.6056.
- CASE_019: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.6056.
- CASE_027: FIXED — no retained item passes D_CONTENT_0.6056.
- CASE_028: FIXED — no retained item passes D_CONTENT_0.6056.
- CASE_034: STILL_FALSE_COVERED — at least one retained item passes D_CONTENT_0.6056.
- CASE_039: FIXED — no retained item passes D_CONTENT_0.6056.

### E1_TARGET_OR_FINAL

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes E1_TARGET_OR_FINAL.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes E1_TARGET_OR_FINAL.
- CASE_009: STILL_FALSE_COVERED — at least one retained item passes E1_TARGET_OR_FINAL.
- CASE_019: STILL_FALSE_COVERED — at least one retained item passes E1_TARGET_OR_FINAL.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes E1_TARGET_OR_FINAL.
- CASE_028: STILL_FALSE_COVERED — at least one retained item passes E1_TARGET_OR_FINAL.
- CASE_034: STILL_FALSE_COVERED — at least one retained item passes E1_TARGET_OR_FINAL.
- CASE_039: STILL_FALSE_COVERED — at least one retained item passes E1_TARGET_OR_FINAL.

### E2_TARGET_NONAMBIG

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes E2_TARGET_NONAMBIG.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes E2_TARGET_NONAMBIG.
- CASE_009: STILL_FALSE_COVERED — at least one retained item passes E2_TARGET_NONAMBIG.
- CASE_019: FIXED — no retained item passes E2_TARGET_NONAMBIG.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes E2_TARGET_NONAMBIG.
- CASE_028: STILL_FALSE_COVERED — at least one retained item passes E2_TARGET_NONAMBIG.
- CASE_034: FIXED — no retained item passes E2_TARGET_NONAMBIG.
- CASE_039: FIXED — no retained item passes E2_TARGET_NONAMBIG.

### E3_TARGET_CONTENT_NONAMBIG

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes E3_TARGET_CONTENT_NONAMBIG.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes E3_TARGET_CONTENT_NONAMBIG.
- CASE_009: STILL_FALSE_COVERED — at least one retained item passes E3_TARGET_CONTENT_NONAMBIG.
- CASE_019: FIXED — no retained item passes E3_TARGET_CONTENT_NONAMBIG.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes E3_TARGET_CONTENT_NONAMBIG.
- CASE_028: STILL_FALSE_COVERED — at least one retained item passes E3_TARGET_CONTENT_NONAMBIG.
- CASE_034: FIXED — no retained item passes E3_TARGET_CONTENT_NONAMBIG.
- CASE_039: FIXED — no retained item passes E3_TARGET_CONTENT_NONAMBIG.

### F1_ZERO_CALL_STRICT

- CASE_005: FIXED — no retained item passes F1_ZERO_CALL_STRICT.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes F1_ZERO_CALL_STRICT.
- CASE_009: FIXED — no retained item passes F1_ZERO_CALL_STRICT.
- CASE_019: FIXED — no retained item passes F1_ZERO_CALL_STRICT.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes F1_ZERO_CALL_STRICT.
- CASE_028: FIXED — no retained item passes F1_ZERO_CALL_STRICT.
- CASE_034: STILL_FALSE_COVERED — at least one retained item passes F1_ZERO_CALL_STRICT.
- CASE_039: FIXED — no retained item passes F1_ZERO_CALL_STRICT.

### F2_ZERO_CALL_BALANCED

- CASE_005: STILL_FALSE_COVERED — at least one retained item passes F2_ZERO_CALL_BALANCED.
- CASE_007: STILL_FALSE_COVERED — at least one retained item passes F2_ZERO_CALL_BALANCED.
- CASE_009: STILL_FALSE_COVERED — at least one retained item passes F2_ZERO_CALL_BALANCED.
- CASE_019: FIXED — no retained item passes F2_ZERO_CALL_BALANCED.
- CASE_027: STILL_FALSE_COVERED — at least one retained item passes F2_ZERO_CALL_BALANCED.
- CASE_028: STILL_FALSE_COVERED — at least one retained item passes F2_ZERO_CALL_BALANCED.
- CASE_034: STILL_FALSE_COVERED — at least one retained item passes F2_ZERO_CALL_BALANCED.
- CASE_039: FIXED — no retained item passes F2_ZERO_CALL_BALANCED.

## Target-evaluation limitations

- CASE_006/Q1: stored evidence lacks target compatibility
- CASE_006/Q2: stored evidence lacks target compatibility
- CASE_006/Q3: stored evidence lacks target compatibility
- CASE_020/Q1: stored evidence lacks target compatibility
- CASE_035/Q1: stored evidence lacks target compatibility

## Recommendation

B_EXPLICIT_TARGET: Smallest deterministic guard: fixes stored exact-target mismatch cases while adding no confidence floor, no selector change, and no API calls. Multi-target comparisons are resolved per issue when the issue contains one exact document number.

## Rejected candidates

- A1/A2: Ambiguity alone removes substantial evidence and provides no semantic guarantee.
- C/D floors: Universal score floors trade coverage errors for false-missing and/or large routing increases; high requested finalScore floors are outside most observed selected-score values.
- E/F hybrids: Compound confidence guards are less minimal and increase false-missing or Grounding more than the target-only guard.
