const SEVERITY_ORDER: Record<string, number> = {
  BLOCKING: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

export interface NormalizedFinding {
  id: string;
  severity: 'BLOCKING' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  source?: string;
  summary: string;
  evidence?: unknown[];
  recommendation?: string;
  needs_plan?: boolean;
  [key: string]: unknown;
}

export function normalizeFindings(input: unknown): { findings: NormalizedFinding[]; count: number } {
  const rawFindings = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.findings)
      ? input.findings
      : [];

  const seen = new Set<string>();
  const findings: NormalizedFinding[] = [];

  for (const raw of rawFindings) {
    if (!isRecord(raw)) {
      continue;
    }
    const severity = normalizeSeverity(raw.severity);
    const summary = String(raw.summary ?? raw.problem ?? raw.title ?? '').trim();
    if (!severity || !summary) {
      continue;
    }
    const id = String(raw.id ?? `F-${String(findings.length + 1).padStart(3, '0')}`).trim();
    const dedupeKey = id || `${severity}:${summary}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    findings.push({
      ...raw,
      id,
      severity,
      summary,
      evidence: Array.isArray(raw.evidence) ? raw.evidence : raw.evidence ? [raw.evidence] : [],
      needs_plan: typeof raw.needs_plan === 'boolean' ? raw.needs_plan : undefined,
    } as NormalizedFinding);
  }

  findings.sort((a, b) => {
    const severityDelta = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return severityDelta || a.id.localeCompare(b.id);
  });

  return {
    findings,
    count: findings.length,
  };
}

function normalizeSeverity(value: unknown): NormalizedFinding['severity'] | null {
  const severity = String(value ?? '').toUpperCase();
  return severity in SEVERITY_ORDER ? severity as NormalizedFinding['severity'] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
