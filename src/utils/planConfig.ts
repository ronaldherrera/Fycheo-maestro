export const PLAN_PRICES: Record<string, number> = {
  gratis: 0, basico: 15, pro15: 29, pro30: 59, pro60: 99, pro100: 149, enterprise: 0,
  // Legacy
  free: 0, basic: 15, estandar: 29, avanzado: 59, expansion: 99, elite: 149,
  pro: 29, business: 59, ultimate: 149, premium: 149,
};

export const PLAN_LIMITS: Record<string, number> = {
  gratis: 3, basico: 10, pro15: 15, pro30: 30, pro60: 60, pro100: 100, enterprise: 9999,
  // Legacy
  free: 3, basic: 10, estandar: 15, avanzado: 30, expansion: 60, elite: 100,
  pro: 15, business: 30, ultimate: 100, premium: 100,
};

export const PLAN_EXTRA_PRICES: Record<string, number> = {
  gratis: 0, basico: 3, pro15: 2, pro30: 2, pro60: 1, pro100: 0, enterprise: 0,
  // Legacy
  free: 0, basic: 3, estandar: 2, avanzado: 2, expansion: 1, elite: 0,
  pro: 2, business: 1, ultimate: 0, premium: 0,
};

export const PLAN_META: Record<string, { label: string; color: string; bg: string }> = {
  gratis:     { label: 'Gratis',     color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  basico:     { label: 'Básico',     color: '#60a5fa', bg: 'rgba(59,130,246,0.12)'  },
  pro15:      { label: 'Pro 15',     color: '#818cf8', bg: 'rgba(99,102,241,0.15)'  },
  pro30:      { label: 'Pro 30',     color: '#a78bfa', bg: 'rgba(139,92,246,0.15)'  },
  pro60:      { label: 'Pro 60',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  pro100:     { label: 'Pro 100',    color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  enterprise: { label: 'Enterprise', color: '#34d399', bg: 'rgba(16,185,129,0.12)'  },
  // Legacy
  free:       { label: 'Gratis',     color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  basic:      { label: 'Básico',     color: '#60a5fa', bg: 'rgba(59,130,246,0.12)'  },
  estandar:   { label: 'Pro 15',     color: '#818cf8', bg: 'rgba(99,102,241,0.15)'  },
  avanzado:   { label: 'Pro 30',     color: '#a78bfa', bg: 'rgba(139,92,246,0.15)'  },
  expansion:  { label: 'Pro 60',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  elite:      { label: 'Pro 100',    color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  pro:        { label: 'Pro 15',     color: '#818cf8', bg: 'rgba(99,102,241,0.15)'  },
  business:   { label: 'Pro 30',     color: '#a78bfa', bg: 'rgba(139,92,246,0.15)'  },
  ultimate:   { label: 'Pro 100',    color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  premium:    { label: 'Pro 100',    color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
};

export function getPlanMeta(plan: string) {
  return PLAN_META[(plan ?? '').toLowerCase()] ?? {
    label: (plan ?? '').toUpperCase() || 'Sin plan',
    color: '#9ca3af',
    bg:    'rgba(156,163,175,0.1)',
  };
}
