const SEVERITY_ORDER = ['Critical', 'Important', 'Minor', 'Notes'] as const;
type Severity = typeof SEVERITY_ORDER[number];

function normalizeSeverity(value: unknown): Severity {
  const raw = String(value || '').toLowerCase();
  if (raw === 'critical' || raw === 'blocking' || raw === 'high') return 'Critical';
  if (raw === 'important' || raw === 'medium') return 'Important';
  if (raw === 'minor' || raw === 'low') return 'Minor';
  return 'Notes';
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray((value as { findings?: unknown }).findings)) {
    return (value as { findings: unknown[] }).findings;
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeFindings(input: unknown): { findings: Array<Record<string, unknown>> } {
  const seen = new Set<string>();
  const findings = asArray(input).map((item, index) => {
    const record = asRecord(item);
    const severity = normalizeSeverity(record.severity);
    const id = String(record.id || `MR-${String(index + 1).padStart(3, '0')}`);
    return {
      id,
      severity,
      status: String(record.status || 'open'),
      placement: String(record.placement || 'inline'),
      location: String(record.location || ''),
      summary: String(record.summary || record.problem || ''),
      problem: String(record.problem || record.summary || ''),
      why_it_matters: String(record.why_it_matters || record.impact || ''),
      expected_fix: String(record.expected_fix || record.recommendation || ''),
      source: String(record.source || ''),
    };
  }).filter((finding) => {
    const key = `${finding.severity}:${finding.location}:${finding.problem}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  findings.sort((left, right) => {
    const severityDelta = SEVERITY_ORDER.indexOf(left.severity as Severity) - SEVERITY_ORDER.indexOf(right.severity as Severity);
    return severityDelta || String(left.id).localeCompare(String(right.id));
  });

  return { findings };
}
