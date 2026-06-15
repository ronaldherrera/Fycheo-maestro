import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Megaphone, Plus, X, TrendingUp, MousePointerClick,
  Eye, Target, Pencil, Trash2, AlertCircle,
  FileText, Globe, Upload, ImageIcon,
} from 'lucide-react';

// ─── Tipos campañas ────────────────────────────────────────────────────────────

type Platform = 'google' | 'meta' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'other';
type CampaignStatus = 'active' | 'paused' | 'ended' | 'draft';

interface Campaign {
  id: string;
  name: string;
  platform: Platform;
  status: CampaignStatus;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

type CampaignDraft = Omit<Campaign, 'id' | 'created_at'>;

// ─── Tipos blog ───────────────────────────────────────────────────────────────

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  author: string;
  read_time: string;
  image_filename: string;
  image_path: string;
  image_desc: string;
  image_alt: string;
  content: string;
  faqs: { q: string; a: string }[];
  published: boolean;
  created_at: string;
}

type BlogPostDraft = Omit<BlogPost, 'id' | 'created_at'>;

// ─── Tipos Search Console ─────────────────────────────────────────────────────

interface GscRow  { keys: string[]; clicks: number; impressions: number; ctr: number; position: number; }
interface GscData { clicks: number; impressions: number; ctr: number; position: number; queries: GscRow[]; pages: GscRow[]; }

// ─── Tipos Google Analytics 4 ─────────────────────────────────────────────────

interface GA4Data {
  sessions: number; users: number; pageviews: number; bounceRate: number; avgDuration: number;
  byChannel: { channel: string; sessions: number }[];
  topPages:  { page: string; views: number }[];
  byDate:    { date: string; sessions: number }[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLATFORM_META: Record<Platform, { label: string; bg: string; text: string; short: string }> = {
  google:    { label: 'Google Ads',   bg: '#ea43351a', text: '#ea4335', short: 'G'   },
  meta:      { label: 'Meta Ads',     bg: '#1877f21a', text: '#1877f2', short: 'f'   },
  instagram: { label: 'Instagram',    bg: '#e10f7a1a', text: '#e10f7a', short: 'IG'  },
  tiktok:    { label: 'TikTok',       bg: '#0000001a', text: '#9ca3af', short: 'TT'  },
  linkedin:  { label: 'LinkedIn',     bg: '#0a66c21a', text: '#0a66c2', short: 'in'  },
  youtube:   { label: 'YouTube',      bg: '#ff00001a', text: '#ff0000', short: 'YT'  },
  other:     { label: 'Otro',         bg: '#6b72801a', text: '#6b7280', short: '—'   },
};

const STATUS_META: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  active:  { label: 'Activa',     color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  paused:  { label: 'Pausada',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  ended:   { label: 'Finalizada', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  draft:   { label: 'Borrador',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
};

const BLOG_CATEGORIES = ['Normativa', 'Gestión RRHH', 'Tecnología', 'General'];

const GSC_CLIENT_ID   = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ?? '';
const GSC_SITE        = (import.meta as any).env?.VITE_GSC_SITE ?? 'sc-domain:fycheo.es';
const GA4_PROPERTY_ID = (import.meta as any).env?.VITE_GA4_PROPERTY_ID ?? '';

const BLANK: CampaignDraft = {
  name: '', platform: 'google', status: 'draft',
  budget: 0, spent: 0, impressions: 0, clicks: 0, conversions: 0,
  start_date: new Date().toISOString().split('T')[0],
  end_date: null, notes: null,
};

const BLOG_BLANK: BlogPostDraft = {
  slug: '', title: '', excerpt: '', category: 'General',
  date: new Date().toISOString().split('T')[0],
  author: 'Equipo Fycheo', read_time: '5 min',
  image_filename: '', image_path: '', image_desc: '', image_alt: '',
  content: '', faqs: [], published: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt  = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtN = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);
const ctr  = (c: Campaign) => c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) + '%' : '—';

const toSlug = (title: string) =>
  title.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const formatBlogDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

// ─── Marketing ────────────────────────────────────────────────────────────────

interface MarketingProps {
  section: string;
}

export const Marketing: React.FC<MarketingProps> = ({ section }) => {

  // ── Estado campañas ─────────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignDraft>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ── Estado blog ─────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [blogModal, setBlogModal] = useState(false);
  const [blogEditing, setBlogEditing] = useState<BlogPost | null>(null);
  const [blogForm, setBlogForm] = useState<BlogPostDraft>(BLOG_BLANK);
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogError, setBlogError] = useState<string | null>(null);
  const [blogDeleteConfirm, setBlogDeleteConfirm] = useState<string | null>(null);
  const [slugManual, setSlugManual] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // ── Estado análisis ─────────────────────────────────────────────────────────
  const [analytics, setAnalytics] = useState<{
    totalCompanies: number; payingCompanies: number; totalContacts: number;
    thisMonthCompanies: number; thisMonthContacts: number; mrr: number;
    companiesByMonth: Record<string, number>; contactsByMonth: Record<string, number>;
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Estado Search Console ─────────────────────────────────────────────────
  const [gscToken, setGscToken] = useState<string | null>(() => {
    const tok = localStorage.getItem('gsc_access_token');
    const exp = Number(localStorage.getItem('gsc_token_exp') ?? 0);
    return tok && Date.now() < exp ? tok : null;
  });
  const [gscData,    setGscData]    = useState<GscData | null>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscError,   setGscError]   = useState<string | null>(null);
  const [gscTab,     setGscTab]     = useState<'queries' | 'pages'>('queries');
  // ── Estado Google Analytics 4 ────────────────────────────────────────────────
  const [ga4Token,   setGa4Token]   = useState<string | null>(() => {
    const tok = localStorage.getItem('ga4_access_token');
    const exp = Number(localStorage.getItem('ga4_token_exp') ?? 0);
    return tok && Date.now() < exp ? tok : null;
  });
  const [ga4Data,    setGa4Data]    = useState<GA4Data | null>(null);
  const [ga4Loading, setGa4Loading] = useState(false);
  const [ga4Error,   setGa4Error]   = useState<string | null>(null);

  const [aiInsight,  setAiInsight]  = useState<string | null>(() => localStorage.getItem('gsc_ai_insight'));
  const [aiInsightDate, setAiInsightDate] = useState<string | null>(() => localStorage.getItem('gsc_ai_insight_date'));
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiOpen,     setAiOpen]     = useState(false);

  // ── Carga campañas ──────────────────────────────────────────────────────────
  const loadCampaigns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  };

  // ── Carga posts ─────────────────────────────────────────────────────────────
  const loadPosts = async () => {
    setPostsLoading(true);
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .order('date', { ascending: false });
    setPosts(data ?? []);
    setPostsLoading(false);
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const twelveAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString();
    const PLAN_PRICES: Record<string, number> = { free: 0, basic: 29, pro: 49, ultimate: 99, enterprise: 99 };

    const [
      { count: totalCompanies },
      { data: allCompanies },
      { count: totalContacts },
      { data: recentCompanies },
      { data: recentContacts },
    ] = await Promise.all([
      supabase.from('companies').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('plan'),
      supabase.from('contact_messages').select('*', { count: 'exact', head: true }).is('trashed_at', null),
      supabase.from('companies').select('created_at').gte('created_at', twelveAgo),
      supabase.from('contact_messages').select('created_at').gte('created_at', twelveAgo).is('trashed_at', null),
    ]);

    const groupByMonth = (items: { created_at: string }[] | null) => {
      const r: Record<string, number> = {};
      items?.forEach(i => { const m = i.created_at.substring(0, 7); r[m] = (r[m] ?? 0) + 1; });
      return r;
    };

    const companiesByMonth = groupByMonth(recentCompanies);
    const contactsByMonth  = groupByMonth(recentContacts);

    setAnalytics({
      totalCompanies:     totalCompanies ?? 0,
      payingCompanies:    allCompanies?.filter(c => c.plan !== 'free').length ?? 0,
      totalContacts:      totalContacts ?? 0,
      thisMonthCompanies: companiesByMonth[thisMonth] ?? 0,
      thisMonthContacts:  contactsByMonth[thisMonth] ?? 0,
      mrr:                allCompanies?.reduce((s, c) => s + (PLAN_PRICES[c.plan] ?? 0), 0) ?? 0,
      companiesByMonth,
      contactsByMonth,
    });
    setAnalyticsLoading(false);
  };

  // ── Funciones Google Analytics 4 ─────────────────────────────────────────
  const disconnectGA4 = () => {
    localStorage.removeItem('ga4_access_token');
    localStorage.removeItem('ga4_token_exp');
    setGa4Token(null); setGa4Data(null); setGa4Error(null);
  };

  const fetchGA4Data = async (token: string) => {
    if (!GA4_PROPERTY_ID) return;
    setGa4Loading(true); setGa4Error(null);
    const url  = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`;
    const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const post = (body: object) => fetch(url, { method: 'POST', headers: hdrs, body: JSON.stringify(body) }).then(r => r.json());
    try {
      const [rTotals, rChannels, rPages, rDates] = await Promise.all([
        post({ dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' }] }),
        post({ dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], metrics: [{ name: 'sessions' }], dimensions: [{ name: 'sessionDefaultChannelGroup' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 6 }),
        post({ dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], metrics: [{ name: 'screenPageViews' }], dimensions: [{ name: 'pagePath' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 8 }),
        post({ dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], metrics: [{ name: 'sessions' }], dimensions: [{ name: 'date' }], orderBys: [{ dimension: { dimensionName: 'date' } }] }),
      ]);
      if (rTotals.error) throw new Error(rTotals.error.message);
      const mv = (r: any, i: number) => Number(r.rows?.[0]?.metricValues?.[i]?.value ?? 0);
      setGa4Data({
        sessions:    mv(rTotals, 0),
        users:       mv(rTotals, 1),
        pageviews:   mv(rTotals, 2),
        bounceRate:  mv(rTotals, 3),
        avgDuration: mv(rTotals, 4),
        byChannel:   (rChannels.rows ?? []).map((r: any) => ({ channel: r.dimensionValues[0].value, sessions: Number(r.metricValues[0].value) })),
        topPages:    (rPages.rows ?? []).map((r: any) => ({ page: r.dimensionValues[0].value, views: Number(r.metricValues[0].value) })),
        byDate:      (rDates.rows ?? []).map((r: any) => ({ date: r.dimensionValues[0].value, sessions: Number(r.metricValues[0].value) })),
      });
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('403')) { disconnectGA4(); setGa4Error('Sesión expirada. Vuelve a conectar.'); }
      else setGa4Error(e.message ?? 'Error GA4');
    } finally { setGa4Loading(false); }
  };

  const ga4ClientRef  = useRef<any>(null);
  const ga4TimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onGa4Token = (resp: any, silent = false) => {
    if (resp.error) { if (!silent) setGa4Error(resp.error_description ?? resp.error); return; }
    const exp = Date.now() + resp.expires_in * 1000;
    localStorage.setItem('ga4_access_token', resp.access_token);
    localStorage.setItem('ga4_token_exp', String(exp));
    setGa4Token(resp.access_token);
    if (ga4TimerRef.current) clearTimeout(ga4TimerRef.current);
    ga4TimerRef.current = setTimeout(() => ga4ClientRef.current?.requestAccessToken({ prompt: '' }), Math.max((resp.expires_in - 300) * 1000, 10_000));
    fetchGA4Data(resp.access_token);
  };

  const connectGA4 = () => {
    setGa4Error(null);
    if (!GSC_CLIENT_ID) { setGa4Error('Añade VITE_GOOGLE_CLIENT_ID al .env'); return; }
    const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
      client_id: GSC_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      callback: (resp: any) => onGa4Token(resp, false),
    });
    if (!client) { setGa4Error('Librería de Google aún no cargada. Espera un momento.'); return; }
    ga4ClientRef.current = client;
    client.requestAccessToken({ prompt: 'select_account' });
  };

  // ── Funciones Search Console ──────────────────────────────────────────────
  const disconnectGSC = () => {
    localStorage.removeItem('gsc_access_token');
    localStorage.removeItem('gsc_token_exp');
    setGscToken(null); setGscData(null); setGscError(null);
  };

  const fetchGscData = async (token: string) => {
    setGscLoading(true); setGscError(null);
    const end   = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 90 * 86_400_000).toISOString().split('T')[0];
    const url   = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`;
    const hdrs  = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const post  = (extra: object) =>
      fetch(url, { method: 'POST', headers: hdrs, body: JSON.stringify({ startDate: start, endDate: end, ...extra }) });
    try {
      const [rSum, rQ, rP] = await Promise.all([
        post({}),
        post({ dimensions: ['query'], rowLimit: 15 }),
        post({ dimensions: ['page'],  rowLimit: 10 }),
      ]);
      if (!rSum.ok) {
        if (rSum.status === 401 || rSum.status === 403) { disconnectGSC(); setGscError('Sesión expirada. Vuelve a conectar.'); }
        else { const e = await rSum.json(); setGscError(e?.error?.message ?? 'Error de API.'); }
        setGscLoading(false); return;
      }
      const [sum, qRes, pRes] = await Promise.all([rSum.json(), rQ.json(), rP.json()]);
      setGscData({
        clicks:      sum.rows?.[0]?.clicks      ?? 0,
        impressions: sum.rows?.[0]?.impressions ?? 0,
        ctr:         sum.rows?.[0]?.ctr         ?? 0,
        position:    sum.rows?.[0]?.position    ?? 0,
        queries:     qRes.rows ?? [],
        pages:       pRes.rows ?? [],
      });
    } catch (e: any) { setGscError(e.message ?? 'Error de red.'); }
    setGscLoading(false);
  };

  const fetchAiInsight = async (data: typeof gscData) => {
    if (!data) return;
    const GEMINI_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY ?? '';
    if (!GEMINI_KEY) { setAiInsight('Añade VITE_GEMINI_API_KEY al .env'); return; }
    setAiLoading(true);
    setAiInsight(null);
    const topQueries = data.queries.slice(0, 10).map(r => `  - "${r.keys[0]}": pos. ${r.position.toFixed(1)}, ${r.impressions} imp., ${r.clicks} clics`).join('\n');
    const topPages   = data.pages.slice(0, 5).map(r => `  - ${r.keys[0].replace(/^https?:\/\/[^/]+/, '') || '/'}: pos. ${r.position.toFixed(1)}, ${r.impressions} imp., ${r.clicks} clics, CTR ${(r.ctr*100).toFixed(1)}%`).join('\n');
    const prompt = `Eres un consultor SEO experto. Analiza estos datos de Google Search Console para Fycheo (software de control horario para pymes españolas, dominio fycheo.es) y da entre 3 y 5 recomendaciones muy concretas, priorizadas por impacto. Se directo, sin rodeos. Responde en español.

Metricas globales (ultimos 90 dias):
- Clics: ${data.clicks}
- Impresiones: ${data.impressions}
- CTR medio: ${(data.ctr * 100).toFixed(1)}%
- Posicion media: ${data.position.toFixed(1)}

Consultas principales:
${topQueries}

Paginas principales:
${topPages}

Formato de respuesta: lista numerada, cada punto con un titulo corto y 2-3 lineas de explicacion practica.`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Error Gemini');
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sin respuesta';
      const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      setAiInsight(text); localStorage.setItem('gsc_ai_insight', text);
      setAiInsightDate(date); localStorage.setItem('gsc_ai_insight_date', date);
    } catch (e: any) {
      setAiInsight(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const tokenClientRef   = useRef<any>(null);
  const refreshTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = (expiresIn: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max((expiresIn - 300) * 1000, 10_000); // renovar 5 min antes
    refreshTimerRef.current = setTimeout(() => {
      tokenClientRef.current?.requestAccessToken({ prompt: '' });
    }, delay);
  };

  const onTokenResponse = (resp: any, silent = false) => {
    if (resp.error) {
      if (!silent) setGscError(resp.error_description ?? resp.error);
      return;
    }
    const exp = Date.now() + resp.expires_in * 1000;
    localStorage.setItem('gsc_access_token', resp.access_token);
    localStorage.setItem('gsc_token_exp', String(exp));
    setGscToken(resp.access_token);
    scheduleRefresh(resp.expires_in);
    if (!gscData) fetchGscData(resp.access_token);
  };

  const initTokenClient = (prompt = 'consent') => {
    if (!GSC_CLIENT_ID) return null;
    const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
      client_id: GSC_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      callback: (resp: any) => onTokenResponse(resp, prompt === ''),
    });
    tokenClientRef.current = client;
    return client;
  };

  const connectGSC = () => {
    setGscError(null);
    if (!GSC_CLIENT_ID) { setGscError('Añade VITE_GOOGLE_CLIENT_ID al .env de Fycheo-maestro.'); return; }
    const client = initTokenClient('select_account');
    if (!client) { setGscError('La librería de Google aún no ha cargado. Espera un momento.'); return; }
    client.requestAccessToken({ prompt: 'select_account' });
  };

  useEffect(() => { loadCampaigns(); }, []);
  useEffect(() => { loadPosts(); }, []);
  useEffect(() => { if (section === 'analisis') loadAnalytics(); }, [section]);

  useEffect(() => {
    if (section !== 'analisis') return;
    const setup = () => {
      if (!GSC_CLIENT_ID) return;
      const storedToken = localStorage.getItem('gsc_access_token');
      const storedExp   = Number(localStorage.getItem('gsc_token_exp') ?? 0);
      const client = initTokenClient('');
      if (!client || !storedToken) return;
      if (Date.now() >= storedExp) {
        // token expirado → renovar silenciosamente
        client.requestAccessToken({ prompt: '' });
      } else {
        // token válido → programar renovación antes de que expire
        scheduleRefresh(Math.round((storedExp - Date.now()) / 1000));
      }
    };
    if ((window as any).google?.accounts) { setup(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = setup;
    document.head.appendChild(s);
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      try { document.head.removeChild(s); } catch { /* already removed */ }
    };
  }, [section]);

  useEffect(() => {
    if (section === 'analisis' && gscToken && !gscData && !gscLoading) fetchGscData(gscToken);
  }, [section]);

  useEffect(() => {
    if (section !== 'analisis') return;
    if (ga4Token && !ga4Data && !ga4Loading) fetchGA4Data(ga4Token);
  }, [section, ga4Token]);

  // ── Handlers campañas ───────────────────────────────────────────────────────
  const openNew = () => { setEditing(null); setForm(BLANK); setError(null); setModalOpen(true); };
  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({ name: c.name, platform: c.platform, status: c.status, budget: c.budget, spent: c.spent, impressions: c.impressions, clicks: c.clicks, conversions: c.conversions, start_date: c.start_date, end_date: c.end_date, notes: c.notes });
    setError(null);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true); setError(null);
    if (editing) {
      const { error: e } = await supabase.from('marketing_campaigns').update({ ...form }).eq('id', editing.id);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { error: e } = await supabase.from('marketing_campaigns').insert([{ ...form }]);
      if (e) { setError(e.message); setSaving(false); return; }
    }
    setSaving(false); setModalOpen(false); loadCampaigns();
  };

  const deleteCampaign = async (id: string) => {
    await supabase.from('marketing_campaigns').delete().eq('id', id);
    setDeleteConfirm(null); loadCampaigns();
  };

  const set = (k: keyof CampaignDraft, v: any) => setForm(f => ({ ...f, [k]: v }));

  // ── Handlers blog ───────────────────────────────────────────────────────────
  const openNewPost = () => {
    setBlogEditing(null); setBlogForm(BLOG_BLANK);
    setSlugManual(false); setBlogError(null); setBlogModal(true);
  };

  const openEditPost = (p: BlogPost) => {
    setBlogEditing(p);
    setBlogForm({
      slug: p.slug, title: p.title, excerpt: p.excerpt, category: p.category,
      date: p.date, author: p.author, read_time: p.read_time,
      image_filename: p.image_filename, image_path: p.image_path,
      image_desc: p.image_desc, image_alt: p.image_alt,
      content: p.content, faqs: p.faqs ?? [], published: p.published,
    });
    setSlugManual(true); setBlogError(null); setBlogModal(true);
  };

  const handleTitleChange = (title: string) => {
    setB('title', title);
    if (!slugManual) setB('slug', toSlug(title));
  };

  const savePost = async () => {
    if (!blogForm.title.trim()) { setBlogError('El título es obligatorio.'); return; }
    if (!blogForm.slug.trim())  { setBlogError('El slug es obligatorio.'); return; }
    setBlogSaving(true); setBlogError(null);
    const payload = {
      ...blogForm,
      image_path: blogForm.image_filename
        ? `/public/images/blog/${blogForm.image_filename}`
        : blogForm.image_path,
      updated_at: new Date().toISOString(),
    };
    if (blogEditing) {
      const { error: e } = await supabase.from('blog_posts').update(payload).eq('id', blogEditing.id);
      if (e) { setBlogError(e.message); setBlogSaving(false); return; }
    } else {
      const { error: e } = await supabase.from('blog_posts').insert([payload]);
      if (e) { setBlogError(e.message); setBlogSaving(false); return; }
    }
    setBlogSaving(false); setBlogModal(false); loadPosts();
  };

  const deletePost = async (id: string) => {
    await supabase.from('blog_posts').delete().eq('id', id);
    setBlogDeleteConfirm(null); loadPosts();
  };

  const setB = (k: keyof BlogPostDraft, v: any) => setBlogForm(f => ({ ...f, [k]: v }));

  const uploadImage = async (file: File) => {
    setImgUploading(true);
    const ext      = file.name.split('.').pop() ?? 'webp';
    const filename = `blog-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('blog-images').upload(filename, file, { upsert: true });
    if (error) { setBlogError(`Error al subir imagen: ${error.message}`); setImgUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('blog-images').getPublicUrl(filename);
    setB('image_filename', filename);
    setB('image_path', publicUrl);
    setImgUploading(false);
  };

  const addFaq    = () => setB('faqs', [...blogForm.faqs, { q: '', a: '' }]);
  const removeFaq = (i: number) => setB('faqs', blogForm.faqs.filter((_, idx) => idx !== i));
  const updateFaq = (i: number, field: 'q' | 'a', val: string) =>
    setB('faqs', blogForm.faqs.map((f, idx) => idx === i ? { ...f, [field]: val } : f));

  // ── KPIs campañas ───────────────────────────────────────────────────────────
  const totalBudget = campaigns.filter(c => c.status === 'active').reduce((s, c) => s + c.budget, 0);
  const totalSpent  = campaigns.filter(c => c.status === 'active').reduce((s, c) => s + c.spent, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalConv   = campaigns.reduce((s, c) => s + c.conversions, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 48 }}>
      <style>{`
        .gc { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; }
        .dtr:hover { background: rgba(255,255,255,0.015); }
        .mk-input { width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); border-radius: 8px; color: white; font-size: 0.84rem; outline: none; box-sizing: border-box; font-family: var(--font-sans); }
        .mk-input:focus { border-color: var(--primary); }
        .mk-label { font-size: 0.72rem; font-weight: 700; color: var(--text-darker); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; display: block; }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', fontFamily: 'var(--font-title)', marginBottom: 4 }}>
          {section === 'campañas' ? 'Campañas' : section === 'blog' ? 'Blog' : 'Análisis web'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {section === 'campañas' ? 'Seguimiento de campañas publicitarias en Google y redes sociales.'
            : section === 'blog' ? 'Gestión de artículos y publicaciones del blog de Fycheo.'
            : 'Métricas de tráfico y rendimiento de la web.'}
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ANÁLISIS WEB
      ══════════════════════════════════════════════════════════ */}
      {section === 'analisis' && (() => {
        const last12 = (() => {
          const now = new Date();
          return Array.from({ length: 12 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
            return {
              key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
              label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
            };
          });
        })();

        if (analyticsLoading || !analytics) {
          return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-darker)', fontSize: '0.83rem' }}>Cargando datos...</div>;
        }

        const { totalCompanies, payingCompanies, totalContacts, thisMonthCompanies, thisMonthContacts, mrr, companiesByMonth, contactsByMonth } = analytics;
        const convRate   = totalCompanies > 0 ? ((payingCompanies / totalCompanies) * 100).toFixed(1) : '0';
        const freeComp   = totalCompanies - payingCompanies;
        const maxComp    = Math.max(...last12.map(m => companiesByMonth[m.key] ?? 0), 1);
        const maxContact = Math.max(...last12.map(m => contactsByMonth[m.key] ?? 0), 1);

        return (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
              <MiniKpi icon={TrendingUp}        color="#8b5cf6" label="Registros este mes"  value={String(thisMonthCompanies)} />
              <MiniKpi icon={Target}            color="#06b6d4" label="Leads este mes"       value={String(thisMonthContacts)} />
              <MiniKpi icon={Eye}               color="#10b981" label="MRR estimado"         value={new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(mrr)} />
              <MiniKpi icon={MousePointerClick} color="#f59e0b" label="Conversión a pago"    value={`${convRate}%`} />
            </div>

            {/* Funnel */}
            <div className="gc" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', marginBottom: 18 }}>Embudo de conversión (total acumulado)</p>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                {[
                  { label: 'Contactos', sub: 'Solicitudes recibidas', val: totalContacts, color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)' },
                  { label: 'Registrados', sub: 'Total organizaciones', val: totalCompanies, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
                  { label: 'Plan gratuito', sub: 'Sin conversión aún', val: freeComp, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' },
                  { label: 'Clientes de pago', sub: 'Conversión exitosa', val: payingCompanies, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
                ].map((step, i, arr) => (
                  <React.Fragment key={step.label}>
                    <div style={{ flex: 1, background: step.bg, border: `1px solid ${step.border}`, borderRadius: i === 0 ? '10px 0 0 10px' : i === arr.length - 1 ? '0 10px 10px 0' : 0, padding: '16px 12px', textAlign: 'center', borderLeft: i > 0 ? 'none' : undefined }}>
                      <p style={{ fontSize: '1.6rem', fontWeight: 800, color: step.color, lineHeight: 1 }}>{step.val}</p>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white', marginTop: 4 }}>{step.label}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-darker)', marginTop: 2 }}>{step.sub}</p>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-darker)', fontSize: '1.1rem', padding: '0 2px', background: 'var(--bg-card)', zIndex: 1 }}>›</div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              {totalContacts > 0 && (
                <div style={{ display: 'flex', gap: 24, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>
                    Contacto → Registro: <strong style={{ color: 'var(--text-muted)' }}>{totalCompanies > 0 ? ((totalCompanies / totalContacts) * 100).toFixed(1) : 0}%</strong>
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>
                    Registro → Pago: <strong style={{ color: '#10b981' }}>{convRate}%</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Gráficas mensuales */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Registros por mes */}
              <div className="gc" style={{ padding: '18px 20px' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', marginBottom: 4 }}>Registros por mes</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-darker)', marginBottom: 12 }}>Nuevas organizaciones · últimos 12 meses</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
                  {last12.map(m => {
                    const val = companiesByMonth[m.key] ?? 0;
                    const h   = maxComp > 0 ? Math.max((val / maxComp) * 70, val > 0 ? 4 : 0) : 0;
                    const now = new Date();
                    const isCurrentMonth = m.key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    return (
                      <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        {val > 0 && <span style={{ fontSize: '0.58rem', color: 'var(--primary-light)', fontWeight: 700 }}>{val}</span>}
                        <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                          <div style={{ width: '100%', height: h, background: isCurrentMonth ? 'var(--primary)' : 'rgba(139,92,246,0.4)', borderRadius: '3px 3px 0 0', minHeight: val > 0 ? 3 : 0 }} />
                        </div>
                        <span style={{ fontSize: '0.56rem', color: 'var(--text-darker)', textTransform: 'capitalize' }}>{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leads por mes */}
              <div className="gc" style={{ padding: '18px 20px' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', marginBottom: 4 }}>Leads por mes</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-darker)', marginBottom: 12 }}>Solicitudes de contacto · últimos 12 meses</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
                  {last12.map(m => {
                    const val = contactsByMonth[m.key] ?? 0;
                    const h   = maxContact > 0 ? Math.max((val / maxContact) * 70, val > 0 ? 4 : 0) : 0;
                    const now = new Date();
                    const isCurrentMonth = m.key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    return (
                      <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        {val > 0 && <span style={{ fontSize: '0.58rem', color: '#06b6d4', fontWeight: 700 }}>{val}</span>}
                        <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                          <div style={{ width: '100%', height: h, background: isCurrentMonth ? '#06b6d4' : 'rgba(6,182,212,0.35)', borderRadius: '3px 3px 0 0', minHeight: val > 0 ? 3 : 0 }} />
                        </div>
                        <span style={{ fontSize: '0.56rem', color: 'var(--text-darker)', textTransform: 'capitalize' }}>{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Integraciones externas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* GA4 — desconectado */}
              {!ga4Token && (
                <div className="gc" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(234,67,53,0.1)', border: '1px solid rgba(234,67,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900, color: '#ea4335' }}>G</div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>Google Analytics 4</p>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16, flex: 1 }}>Ver sesiones, usuarios, páginas vistas, tasa de rebote y canales de tráfico.</p>
                  {ga4Error && <p style={{ fontSize: '0.75rem', color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>{ga4Error}</p>}
                  <button onClick={connectGA4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(234,67,53,0.35)', background: 'rgba(234,67,53,0.08)', color: '#ea4335', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 900 }}>G</span> Conectar con Google Analytics
                  </button>
                </div>
              )}

              {/* Search Console — conectar */}
              {!gscToken && (
                <div className="gc" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(52,168,83,0.1)', border: '1px solid rgba(52,168,83,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 900, color: '#34a853' }}>SC</div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>Google Search Console</p>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16, flex: 1 }}>
                    Ver consultas de búsqueda, clics, impresiones, CTR y posición media de cada página en Google.
                  </p>
                  {gscError && (
                    <p style={{ fontSize: '0.75rem', color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>{gscError}</p>
                  )}
                  <button onClick={connectGSC} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(52,168,83,0.35)', background: 'rgba(52,168,83,0.08)', color: '#34a853', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 900 }}>G</span> Conectar con Google
                  </button>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-darker)', marginTop: 8, textAlign: 'center' }}>
                    Necesitas acceso verificado en search.google.com/search-console
                  </p>
                </div>
              )}
            </div>

            {/* GA4 — datos */}
            {ga4Token && (
              <div className="gc" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(234,67,53,0.1)', border: '1px solid rgba(234,67,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900, color: '#ea4335' }}>G</div>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>Google Analytics 4</p>
                      <span style={{ fontSize: '0.67rem', color: '#10b981', fontWeight: 600 }}>● Conectado · últimos 30 días</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`https://analytics.google.com/analytics/web/#/p${GA4_PROPERTY_ID}/reports/intelligenthome`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#ea4335', background: 'rgba(234,67,53,0.08)', border: '1px solid rgba(234,67,53,0.2)', borderRadius: 6, padding: '4px 10px', textDecoration: 'none' }}>Ver en Analytics ↗</a>
                    <button onClick={disconnectGA4} style={{ fontSize: '0.72rem', color: 'var(--text-darker)', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Desconectar</button>
                  </div>
                </div>

                {ga4Loading && <p style={{ color: 'var(--text-darker)', fontSize: '0.83rem', textAlign: 'center', padding: '24px 0' }}>Cargando datos de Analytics...</p>}
                {ga4Error && !ga4Loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#f87171', fontSize: '0.8rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                    <AlertCircle size={14} /> {ga4Error}
                    <button onClick={connectGA4} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Reconectar</button>
                  </div>
                )}

                {ga4Data && !ga4Loading && (() => {
                  const maxCh  = Math.max(...ga4Data.byChannel.map(c => c.sessions), 1);
                  const maxPg  = Math.max(...ga4Data.topPages.map(p => p.views), 1);
                  const fmtDur = (s: number) => s >= 60 ? `${Math.floor(s/60)}m ${Math.round(s%60)}s` : `${Math.round(s)}s`;
                  return (
                    <>
                      {/* KPIs */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                        {[
                          { label: 'Sesiones',       value: fmtN(ga4Data.sessions),                        hint: 'últimos 30 días',                color: '#ea4335' },
                          { label: 'Usuarios',        value: fmtN(ga4Data.users),                           hint: 'usuarios activos',               color: '#fbbc04' },
                          { label: 'Páginas vistas',  value: fmtN(ga4Data.pageviews),                       hint: 'vistas totales',                 color: '#34a853' },
                          { label: 'Tasa de rebote',  value: (ga4Data.bounceRate * 100).toFixed(1) + '%',   hint: ga4Data.bounceRate > 0.6 ? 'alta — mejorar contenido' : 'aceptable', color: ga4Data.bounceRate > 0.6 ? '#f97316' : '#3b82f6' },
                        ].map(k => (
                          <div key={k.label} style={{ background: `${k.color}0d`, border: `1px solid ${k.color}22`, borderRadius: 10, padding: '12px 14px' }}>
                            <p style={{ fontSize: '0.63rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</p>
                            <p style={{ fontSize: '1.3rem', fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: 4 }}>{k.value}</p>
                            <p style={{ fontSize: '0.63rem', color: 'var(--text-darker)' }}>{k.hint}</p>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {/* Canales */}
                        <div>
                          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Canales de tráfico</p>
                          {ga4Data.byChannel.map((c, i) => (
                            <div key={i} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{c.channel}</span>
                                <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 600 }}>{c.sessions}</span>
                              </div>
                              <div style={{ height: 4, borderRadius: 2, background: 'var(--border-color)', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.round(c.sessions / maxCh * 100)}%`, height: '100%', borderRadius: 2, background: '#ea4335' }} />
                              </div>
                            </div>
                          ))}
                          <p style={{ fontSize: '0.67rem', color: 'var(--text-darker)', marginTop: 10 }}>Sesion media: <strong style={{ color: 'var(--text-muted)' }}>{fmtDur(ga4Data.avgDuration)}</strong></p>
                        </div>

                        {/* Top páginas */}
                        <div>
                          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Páginas más vistas</p>
                          {ga4Data.topPages.map((p, i) => (
                            <div key={i} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }} title={p.page}>{p.page}</span>
                                <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 600 }}>{fmtN(p.views)}</span>
                              </div>
                              <div style={{ height: 4, borderRadius: 2, background: 'var(--border-color)', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.round(p.views / maxPg * 100)}%`, height: '100%', borderRadius: 2, background: '#34a853' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Search Console — datos */}
            {gscToken && (
              <div className="gc" style={{ padding: '20px 24px' }}>
                {/* Cabecera */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(52,168,83,0.1)', border: '1px solid rgba(52,168,83,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 900, color: '#34a853' }}>SC</div>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>Google Search Console</p>
                      <span style={{ fontSize: '0.67rem', color: '#10b981', fontWeight: 600 }}>● Conectado · últimos 90 días</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#34a853', background: 'rgba(52,168,83,0.08)', border: '1px solid rgba(52,168,83,0.25)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', textDecoration: 'none' }}>Ver en Search Console</a>
                    <button onClick={disconnectGSC} style={{ fontSize: '0.72rem', color: 'var(--text-darker)', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Desconectar</button>
                  </div>
                </div>

                {gscLoading && <p style={{ color: 'var(--text-darker)', fontSize: '0.83rem', textAlign: 'center', padding: '24px 0' }}>Cargando datos de Search Console...</p>}

                {gscError && !gscLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#f87171', fontSize: '0.8rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                    <AlertCircle size={14} /> {gscError}
                    <button onClick={connectGSC} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Reconectar</button>
                  </div>
                )}

                {gscData && !gscLoading && (() => {
                  const posColor = (p: number) => p <= 10 ? '#10b981' : p <= 20 ? '#f59e0b' : p <= 50 ? '#f97316' : '#ef4444';
                  const posLabel = (p: number) => p <= 10 ? 'Top 10' : p <= 20 ? 'Pág. 2' : p <= 50 ? 'Lejos' : 'Muy lejos';
                  const maxImpQ = Math.max(...gscData.queries.map(r => r.impressions), 1);
                  const maxImpP = Math.max(...gscData.pages.map(r => r.impressions), 1);
                  const rows = gscTab === 'queries' ? gscData.queries : gscData.pages;
                  const maxI  = gscTab === 'queries' ? maxImpQ : maxImpP;
                  return (
                    <>
                      {/* KPIs */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                        {[
                          { label: 'Clics totales',  value: fmtN(gscData.clicks),       hint: 'visitas reales desde Google',          color: '#3b82f6' },
                          { label: 'Impresiones',    value: fmtN(gscData.impressions),   hint: 'veces que apareces en resultados',     color: '#8b5cf6' },
                          { label: 'CTR medio',      value: (gscData.ctr * 100).toFixed(1) + '%', hint: gscData.ctr < 0.03 ? 'bajo — mejora titulos' : 'buen ratio de clics', color: '#10b981' },
                          { label: 'Posicion media', value: gscData.position > 0 ? gscData.position.toFixed(1) : '-', hint: gscData.position <= 10 ? 'primera pagina' : gscData.position <= 20 ? 'cerca de pag. 1' : 'objetivo: bajar de 20', color: posColor(gscData.position) },
                        ].map(k => (
                          <div key={k.label} style={{ background: `${k.color}0d`, border: `1px solid ${k.color}22`, borderRadius: 10, padding: '12px 14px' }}>
                            <p style={{ fontSize: '0.63rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</p>
                            <p style={{ fontSize: '1.4rem', fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: 5 }}>{k.value}</p>
                            <p style={{ fontSize: '0.63rem', color: 'var(--text-darker)', lineHeight: 1.4 }}>{k.hint}</p>
                          </div>
                        ))}
                      </div>

                      {/* Analisis IA */}
                      <div style={{ marginBottom: 22 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: aiOpen && aiInsight ? 12 : 0 }}>
                          <button onClick={() => setAiOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-darker)', transition: 'transform 0.2s', display: 'inline-block', transform: aiOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Analisis con IA</span>
                            {aiInsightDate && <span style={{ fontSize: '0.62rem', color: 'var(--text-darker)' }}>· {aiInsightDate}</span>}
                          </button>
                          <button onClick={() => fetchAiInsight(gscData)} disabled={aiLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(99,102,241,0.35)', background: aiLoading ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.1)', color: '#818cf8', fontWeight: 700, fontSize: '0.75rem', cursor: aiLoading ? 'default' : 'pointer' }}>
                            {aiLoading ? 'Analizando...' : 'Analizar con IA'}
                          </button>
                        </div>
                        {!aiInsight && !aiLoading && (
                          <p style={{ fontSize: '0.73rem', color: 'var(--text-darker)', fontStyle: 'italic' }}>Pulsa el boton para obtener recomendaciones personalizadas basadas en tus datos reales.</p>
                        )}
                        {aiOpen && aiInsight && (() => {
                          const toHtml = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '<strong style="color:white">$1</strong>');
                          const lines  = aiInsight.split('\n').filter(l => l.trim());
                          const intro  = lines.filter(l => !/^\d+\./.test(l.trim()) && lines.indexOf(l) < lines.findIndex(l2 => /^\d+\./.test(l2.trim())));
                          const blocks: { num: string; title: string; body: string }[] = [];
                          let cur: typeof blocks[0] | null = null;
                          for (const line of lines) {
                            const m = line.trim().match(/^(\d+)\.\s+\*\*(.+?)\*\*[:\s]*(.*)/);
                            if (m) { if (cur) blocks.push(cur); cur = { num: m[1], title: m[2], body: m[3] }; }
                            else if (cur) cur.body += ' ' + line.trim();
                          }
                          if (cur) blocks.push(cur);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {intro.length > 0 && <p style={{ fontSize: '0.75rem', color: 'var(--text-darker)', marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: toHtml(intro.join(' ')) }} />}
                              {blocks.length > 0 ? blocks.map((b, i) => (
                                <div key={i} style={{ display: 'flex', gap: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 10, padding: '12px 14px' }}>
                                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#818cf8', flexShrink: 0, marginTop: 2 }}>{b.num}</div>
                                  <div>
                                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white', marginBottom: 5 }}>{b.title}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: toHtml(b.body.trim()) }} />
                                  </div>
                                </div>
                              )) : (
                                <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: toHtml(aiInsight) }} />
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Datos detallados */}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                        <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Datos detallados</p>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                          {(['queries', 'pages'] as const).map(t => (
                            <button key={t} onClick={() => setGscTab(t)} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, background: gscTab === t ? 'rgba(139,92,246,0.12)' : 'transparent', color: gscTab === t ? 'var(--primary-light)' : 'var(--text-darker)' }}>
                              {t === 'queries' ? `Consultas (${gscData.queries.length})` : `Paginas (${gscData.pages.length})`}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: '0.63rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'grid', gridTemplateColumns: '2fr 140px 55px 60px 90px', gap: 8, padding: '6px 10px', marginBottom: 4 }}>
                          {[gscTab === 'queries' ? 'Consulta' : 'Pagina', 'Impresiones', 'Clics', 'CTR', 'Posicion'].map((h, i) => (
                            <span key={h} style={{ textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
                          ))}
                        </div>
                        {rows.map((row, i) => {
                          const key   = row.keys[0];
                          const label = gscTab === 'pages' ? key.replace(/^https?:\/\/[^/]+/, '') || '/' : key;
                          const barW  = Math.round((row.impressions / maxI) * 100);
                          const pc    = posColor(row.position);
                          const pl    = posLabel(row.position);
                          return (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 140px 55px 60px 90px', gap: 8, padding: '8px 10px', borderTop: '1px solid var(--border-color)', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={key}>{label}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border-color)', overflow: 'hidden' }}>
                                  <div style={{ width: `${barW}%`, height: '100%', borderRadius: 2, background: '#8b5cf6' }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 22, textAlign: 'right' }}>{fmtN(row.impressions)}</span>
                              </div>
                              <span style={{ fontSize: '0.78rem', color: row.clicks > 0 ? '#3b82f6' : 'var(--text-darker)', fontWeight: row.clicks > 0 ? 700 : 400, textAlign: 'right' }}>{row.clicks}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>{(row.ctr * 100).toFixed(1)}%</span>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: pc }}>{row.position.toFixed(1)}</span>
                                <span style={{ fontSize: '0.6rem', color: pc, background: `${pc}18`, border: `1px solid ${pc}30`, borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>{pl}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════
          BLOG
      ══════════════════════════════════════════════════════════ */}
      {section === 'blog' && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            <MiniKpi icon={FileText} color="#8b5cf6" label="Publicados" value={String(posts.filter(p => p.published).length)} />
            <MiniKpi icon={Globe}    color="#06b6d4" label="Total posts" value={String(posts.length)} />
          </div>

          {/* Tabla */}
          <div className="gc" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>Artículos del Blog</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>{posts.length} entradas</p>
              </div>
              <button onClick={openNewPost} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--primary)', border: 'none', borderRadius: 8, color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                <Plus size={13} /> Nuevo artículo
              </button>
            </div>

            {postsLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-darker)', fontSize: '0.83rem' }}>Cargando...</div>
            ) : posts.length === 0 ? (
              <div style={{ padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                <FileText size={28} style={{ color: 'var(--text-darker)' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Sin artículos todavía</p>
                <p style={{ color: 'var(--text-darker)', fontSize: '0.78rem' }}>Ejecuta el SQL de migración en Supabase para importar los posts existentes, o crea uno nuevo.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 130px 100px 90px 100px', gap: 8, padding: '8px 20px', borderBottom: '1px solid var(--border-color)' }}>
                  {['Título', 'Categoría', 'Fecha', 'Estado', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
                  ))}
                </div>
                {posts.map(p => (
                  <div key={p.id} className="dtr" style={{ display: 'grid', gridTemplateColumns: '2fr 130px 100px 90px 100px', gap: 8, padding: '11px 20px', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                      <p style={{ fontSize: '0.67rem', color: 'var(--text-darker)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/blog/{p.slug}</p>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.1)', color: 'var(--primary-light)', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{p.category}</span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatBlogDate(p.date)}</p>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', borderRadius: 100, background: p.published ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)', color: p.published ? '#10b981' : '#6b7280', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {p.published ? 'Publicado' : 'Borrador'}
                    </span>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <a href={`https://fycheo.es/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.07)', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Eye size={11} /></a>
                      <button onClick={() => openEditPost(p)} style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-darker)', cursor: 'pointer' }}><Pencil size={11} /></button>
                      <button onClick={() => setBlogDeleteConfirm(p.id)} style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: '#f87171', cursor: 'pointer' }}><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          CAMPAÑAS
      ══════════════════════════════════════════════════════════ */}
      {section === 'campañas' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
            <MiniKpi icon={TrendingUp}        color="#8b5cf6" label="Presupuesto activo" value={fmt(totalBudget)} />
            <MiniKpi icon={Target}            color="#f59e0b" label="Invertido (activas)" value={fmt(totalSpent)} />
            <MiniKpi icon={MousePointerClick} color="#3b82f6" label="Clics totales"       value={fmtN(totalClicks)} />
            <MiniKpi icon={Eye}               color="#10b981" label="Conversiones"        value={fmtN(totalConv)} />
          </div>

          <div className="gc" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>Campañas</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>{campaigns.length} registradas</p>
              </div>
              <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--primary)', border: 'none', borderRadius: 8, color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                <Plus size={13} /> Nueva campaña
              </button>
            </div>

            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-darker)', fontSize: '0.83rem' }}>Cargando...</div>
            ) : campaigns.length === 0 ? (
              <div style={{ padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                <Megaphone size={28} style={{ color: 'var(--text-darker)' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Sin campañas todavía</p>
                <p style={{ color: 'var(--text-darker)', fontSize: '0.78rem' }}>Añade tu primera campaña para empezar a hacer seguimiento.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px 80px 80px 80px 72px', gap: 8, padding: '8px 20px', borderBottom: '1px solid var(--border-color)' }}>
                  {['Campaña', 'Plataforma', 'Estado', 'Presup.', 'Invertido', 'Impr.', 'Clics', 'CTR', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: i > 2 ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>
                {campaigns.map(c => {
                  const p = PLATFORM_META[c.platform];
                  const s = STATUS_META[c.status];
                  return (
                    <div key={c.id} className="dtr" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px 80px 80px 80px 72px', gap: 8, padding: '11px 20px', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                        {c.notes && <p style={{ fontSize: '0.67rem', color: 'var(--text-darker)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes}</p>}
                      </div>
                      <div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 6, background: p.bg, color: p.text, fontSize: '0.72rem', fontWeight: 700 }}>
                          <span style={{ fontWeight: 900, fontSize: '0.78rem' }}>{p.short}</span> {p.label}
                        </span>
                      </div>
                      <div>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 100, background: s.bg, color: s.color, fontSize: '0.7rem', fontWeight: 700 }}>{s.label}</span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>{fmt(c.budget)}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>{fmt(c.spent)}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>{fmtN(c.impressions)}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>{fmtN(c.clicks)}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>{ctr(c)}</p>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => openEdit(c)} style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-darker)', cursor: 'pointer' }}><Pencil size={11} /></button>
                        <button onClick={() => setDeleteConfirm(c.id)} style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: '#f87171', cursor: 'pointer' }}><Trash2 size={11} /></button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL — Blog post
      ══════════════════════════════════════════════════════════ */}
      {blogModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '40px 20px' }}>
          <div style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: 720, padding: 28, alignSelf: 'flex-start', marginBottom: 40 }}>
            {/* Header modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{blogEditing ? 'Editar artículo' : 'Nuevo artículo'}</p>
              <button onClick={() => setBlogModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-darker)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Título */}
              <div>
                <label className="mk-label">Título *</label>
                <input className="mk-input" value={blogForm.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Ej. Control horario obligatorio en España" />
              </div>

              {/* Slug + Categoría */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
                <div>
                  <label className="mk-label">Slug (URL) *</label>
                  <input className="mk-input" value={blogForm.slug}
                    onChange={e => { setSlugManual(true); setB('slug', e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')); }}
                    placeholder="control-horario-espana"
                    style={{ fontFamily: 'monospace', fontSize: '0.79rem' }} />
                </div>
                <div>
                  <label className="mk-label">Categoría</label>
                  <select className="mk-input" value={blogForm.category} onChange={e => setB('category', e.target.value)}>
                    {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Fecha + Autor + Tiempo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
                <div>
                  <label className="mk-label">Fecha publicación</label>
                  <input className="mk-input" type="date" value={blogForm.date} onChange={e => setB('date', e.target.value)} />
                </div>
                <div>
                  <label className="mk-label">Autor</label>
                  <input className="mk-input" value={blogForm.author} onChange={e => setB('author', e.target.value)} />
                </div>
                <div>
                  <label className="mk-label">Lectura</label>
                  <input className="mk-input" value={blogForm.read_time} onChange={e => setB('read_time', e.target.value)} placeholder="5 min" />
                </div>
              </div>

              {/* Publicado */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="blog-pub" checked={blogForm.published} onChange={e => setB('published', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                <label htmlFor="blog-pub" style={{ fontSize: '0.83rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Publicado (visible en Fycheo-Web)
                </label>
              </div>

              <div style={{ height: 1, background: 'var(--border-color)', margin: '2px 0' }} />

              {/* Imagen */}
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Imagen</p>

              {/* Upload */}
              <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Preview / placeholder */}
                <div style={{ width: 80, height: 52, borderRadius: 8, border: '1px dashed var(--border-color)', background: 'rgba(255,255,255,0.03)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {blogForm.image_path
                    ? <img src={blogForm.image_path.startsWith('/public/') ? blogForm.image_path.replace(/^\/public/, '') : blogForm.image_path}
                        alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <ImageIcon size={20} style={{ color: 'var(--text-darker)' }} />
                  }
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {blogForm.image_filename
                    ? <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>{blogForm.image_filename}</p>
                    : <p style={{ fontSize: '0.75rem', color: 'var(--text-darker)', marginBottom: 6 }}>Sin imagen</p>
                  }
                  <button onClick={() => imgInputRef.current?.click()} disabled={imgUploading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', cursor: imgUploading ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontWeight: 600, opacity: imgUploading ? 0.6 : 1 }}>
                    <Upload size={12} /> {imgUploading ? 'Subiendo...' : blogForm.image_filename ? 'Cambiar imagen' : 'Subir imagen'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="mk-label">Alt texto (SEO)</label>
                  <input className="mk-input" value={blogForm.image_alt} onChange={e => setB('image_alt', e.target.value)} placeholder="Descripción breve para buscadores" />
                </div>
                <div>
                  <label className="mk-label">Descripción imagen</label>
                  <input className="mk-input" value={blogForm.image_desc} onChange={e => setB('image_desc', e.target.value)} placeholder="Para generación de imagen IA" />
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-color)', margin: '2px 0' }} />

              {/* Extracto */}
              <div>
                <label className="mk-label">Extracto *</label>
                <textarea className="mk-input" rows={2} value={blogForm.excerpt} onChange={e => setB('excerpt', e.target.value)}
                  placeholder="Resumen breve que aparece en el listado del blog..." style={{ resize: 'vertical' }} />
              </div>

              {/* Contenido HTML */}
              <div>
                <label className="mk-label">Contenido HTML</label>
                <textarea className="mk-input" rows={14} value={blogForm.content} onChange={e => setB('content', e.target.value)}
                  placeholder={'<p class="mb-6">Contenido del artículo...</p>\n<h2 class="text-2xl font-bold text-white mb-4 mt-8">Sección</h2>'}
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.76rem', lineHeight: 1.5 }} />
              </div>

              <div style={{ height: 1, background: 'var(--border-color)', margin: '2px 0' }} />

              {/* FAQs */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Preguntas frecuentes ({blogForm.faqs.length})
                </p>
                <button onClick={addFaq} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                  <Plus size={11} /> Añadir FAQ
                </button>
              </div>

              {blogForm.faqs.map((faq, i) => (
                <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.015)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>FAQ {i + 1}</span>
                    <button onClick={() => removeFaq(i)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}><X size={12} /></button>
                  </div>
                  <input className="mk-input" value={faq.q} onChange={e => updateFaq(i, 'q', e.target.value)} placeholder="Pregunta..." />
                  <textarea className="mk-input" rows={2} value={faq.a} onChange={e => updateFaq(i, 'a', e.target.value)} placeholder="Respuesta..." style={{ resize: 'vertical' }} />
                </div>
              ))}

              {blogError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontSize: '0.8rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <AlertCircle size={13} /> {blogError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setBlogModal(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem' }}>Cancelar</button>
                <button onClick={savePost} disabled={blogSaving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.83rem', opacity: blogSaving ? 0.6 : 1 }}>
                  {blogSaving ? 'Guardando...' : blogEditing ? 'Guardar cambios' : 'Crear artículo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar borrar post ── */}
      {blogDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <Trash2 size={28} style={{ color: '#f87171', marginBottom: 12 }} />
            <p style={{ fontWeight: 700, color: 'white', marginBottom: 8 }}>¿Eliminar artículo?</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 20 }}>El artículo dejará de aparecer en el blog de Fycheo. Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setBlogDeleteConfirm(null)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => deletePost(blogDeleteConfirm)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nuevo/editar campaña ── */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{editing ? 'Editar campaña' : 'Nueva campaña'}</p>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-darker)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="mk-label">Nombre *</label>
                <input className="mk-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Campaña verano Google Search" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="mk-label">Plataforma</label>
                  <select className="mk-input" value={form.platform} onChange={e => set('platform', e.target.value as Platform)}>
                    {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mk-label">Estado</label>
                  <select className="mk-input" value={form.status} onChange={e => set('status', e.target.value as CampaignStatus)}>
                    {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="mk-label">Presupuesto (€/mes)</label>
                  <input className="mk-input" type="number" min={0} value={form.budget} onChange={e => set('budget', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="mk-label">Invertido hasta hoy (€)</label>
                  <input className="mk-input" type="number" min={0} value={form.spent} onChange={e => set('spent', parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="mk-label">Impresiones</label>
                  <input className="mk-input" type="number" min={0} value={form.impressions} onChange={e => set('impressions', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="mk-label">Clics</label>
                  <input className="mk-input" type="number" min={0} value={form.clicks} onChange={e => set('clicks', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="mk-label">Conversiones</label>
                  <input className="mk-input" type="number" min={0} value={form.conversions} onChange={e => set('conversions', parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="mk-label">Fecha inicio</label>
                  <input className="mk-input" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                <div>
                  <label className="mk-label">Fecha fin (opcional)</label>
                  <input className="mk-input" type="date" value={form.end_date ?? ''} onChange={e => set('end_date', e.target.value || null)} />
                </div>
              </div>
              <div>
                <label className="mk-label">Notas</label>
                <textarea className="mk-input" rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)} placeholder="Objetivo, segmentación, observaciones..." style={{ resize: 'vertical' }} />
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontSize: '0.8rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setModalOpen(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem' }}>Cancelar</button>
                <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.83rem', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear campaña'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar borrar campaña ── */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <Trash2 size={28} style={{ color: '#f87171', marginBottom: 12 }} />
            <p style={{ fontWeight: 700, color: 'white', marginBottom: 8 }}>¿Eliminar campaña?</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 20 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => deleteCampaign(deleteConfirm)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Componentes auxiliares ───────────────────────────────────────────────────


const MiniKpi: React.FC<{ icon: React.ElementType; color: string; label: string; value: string }> = ({ icon: Icon, color, label, value }) => (
  <div className="gc" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={15} style={{ color }} />
    </div>
    <div>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: '1.15rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{value}</p>
    </div>
  </div>
);
