import {
  SCORE_WEIGHTS,
  HOLDER_CONCENTRATION_DANGER,
  HOLDER_CONCENTRATION_WARNING,
  MIN_LP_BURN_PERCENT,
} from "./constants.js";

export function calculateScore(checks) {
  const breakdown = {};

  breakdown.mintAuthority = checks.mintAuthorityRevoked
    ? SCORE_WEIGHTS.mintAuthority : 0;

  breakdown.freezeAuthority = checks.freezeAuthorityRevoked
    ? SCORE_WEIGHTS.freezeAuthority : 0;

  if (checks.topHolderPercent <= HOLDER_CONCENTRATION_WARNING) {
    breakdown.topHolderConc = SCORE_WEIGHTS.topHolderConc;
  } else if (checks.topHolderPercent <= HOLDER_CONCENTRATION_DANGER) {
    const ratio = (checks.topHolderPercent - HOLDER_CONCENTRATION_WARNING) /
      (HOLDER_CONCENTRATION_DANGER - HOLDER_CONCENTRATION_WARNING);
    breakdown.topHolderConc = Math.round(SCORE_WEIGHTS.topHolderConc * (1 - ratio * 0.7));
  } else {
    breakdown.topHolderConc = 0;
  }

  breakdown.bundleDetected = checks.bundleDetected ? 0 : SCORE_WEIGHTS.bundleDetected;

  if (checks.lpBurnPercent >= MIN_LP_BURN_PERCENT) {
    breakdown.lpStatus = SCORE_WEIGHTS.lpStatus;
  } else if (checks.lpBurnPercent > 0.5) {
    breakdown.lpStatus = Math.round(SCORE_WEIGHTS.lpStatus * 0.5);
  } else {
    breakdown.lpStatus = 0;
  }

  const metaPenalty = Math.min((checks.metadataWarnings?.length || 0) * 3, SCORE_WEIGHTS.metadataFlags);
  breakdown.metadataFlags = SCORE_WEIGHTS.metadataFlags - metaPenalty;

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  let verdict;
  if (score >= 80) verdict = "SAFE";
  else if (score >= 60) verdict = "CAUTION";
  else if (score >= 40) verdict = "WARNING";
  else verdict = "DANGER";

  return { score, breakdown, verdict };
}
