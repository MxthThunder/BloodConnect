import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, List, Loader2, Map as MapIcon, Search, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { campsApi, campError } from '../../api/camps';
import { CHENNAI_LOCALITIES } from '../../constants/chennaiData';
import { Alert, Button } from '../../components/escalation/shared';
import {
  CampMap, CoordinationNotice, FacilityChips, MedicalSupportLine, WhenWhere, useMediaQuery,
} from '../../components/camps/shared';

/** Hook shared by the list and detail pages: toggling "I'm interested" needs an account. */
export const useInterest = (onChanged) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const toggle = async (camp) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setBusyId(camp.id);
    setError('');
    try {
      const res = await campsApi.setInterest(camp.id, !camp.is_interested);
      onChanged(camp.id, res);
    } catch (err) {
      setError(campError(err).message);
    } finally {
      setBusyId(null);
    }
  };
  return { toggle, busyId, error, isAuthenticated };
};

export const InterestButton = ({ camp, onToggle, busy, isAuthenticated }) => (
  <Button
    variant={camp.is_interested ? 'secondary' : 'primary'}
    onClick={() => onToggle(camp)}
    busy={busy}
    title={isAuthenticated ? undefined : 'Sign in to register your interest'}
  >
    {camp.is_interested ? 'Interested - withdraw' : isAuthenticated ? "I'm interested" : 'Sign in to register interest'}
  </Button>
);

const CampsPage = ({ base = '/camps' }) => {
  const [filters, setFilters] = useState({ locality: '', q: '', date_from: '' });
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('list');
  const [activeId, setActiveId] = useState(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const load = useCallback(async (f) => {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
      const data = await campsApi.list(params);
      setCamps(data.results);
    } catch (err) {
      setError(campError(err, 'Could not load donation camps.').message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(filters), filters.q ? 250 : 0);
    return () => clearTimeout(id);
  }, [filters, load]);

  const { toggle, busyId, error: interestError, isAuthenticated } = useInterest((id, res) => {
    setCamps((rows) => rows.map((c) => (c.id === id ? { ...c, is_interested: res.is_interested, interest_count: res.interest_count } : c)));
  });

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const filtered = Object.values(filters).some(Boolean);
  const showMap = isDesktop || view === 'map';
  const showList = isDesktop || view === 'list';
  const mapCamps = useMemo(() => camps, [camps]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Blood donation camps in Chennai</h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          Upcoming camps that BloodConnect has reviewed and for which a qualified medical partner has confirmed support.
          Find one near you and register your interest.
        </p>
      </header>

      <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-xl p-3" onSubmit={(e) => e.preventDefault()} role="search">
        <label className="block text-xs font-semibold text-slate-700">
          Locality
          <select value={filters.locality} onChange={set('locality')} className="mt-1 block w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">
            <option value="">All localities</option>
            {CHENNAI_LOCALITIES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-700 lg:col-span-2">
          Search
          <span className="relative block mt-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input type="search" value={filters.q} onChange={set('q')} placeholder="Camp, organisation or venue" className="block w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm" />
          </span>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          On or after
          <input type="date" value={filters.date_from} onChange={set('date_from')} className="mt-1 block w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
        </label>
      </form>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-600" aria-live="polite">
          {loading ? 'Loading camps...' : `${camps.length} upcoming camp${camps.length === 1 ? '' : 's'}${filtered ? ' match your search' : ''}`}
        </p>
        {filtered && <Button variant="quiet" onClick={() => setFilters({ locality: '', q: '', date_from: '' })}>Clear filters</Button>}
        <div className="lg:hidden inline-flex rounded-lg border border-slate-300 overflow-hidden" role="tablist" aria-label="Choose list or map">
          {[['list', 'List', List], ['map', 'Map', MapIcon]].map(([key, label, Icon]) => (
            <button
              key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${view === key ? 'bg-red-700 text-white' : 'bg-white text-slate-700'}`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />{label}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {interestError && <Alert>{interestError}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {showList && (
          <div className="space-y-3" data-testid="camp-list">
            {loading && <div className="flex items-center gap-2 text-xs text-slate-500 py-6"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading...</div>}
            {!loading && camps.length === 0 && !error && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-1">
                <CalendarDays className="w-8 h-8 mx-auto text-slate-300" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-800">{filtered ? 'No camps match your search' : 'No upcoming camps are listed yet'}</p>
                <p className="text-xs text-slate-500">{filtered ? 'Try another locality or clear the filters.' : 'Check back soon. Camps appear here once approved.'}</p>
              </div>
            )}
            {camps.map((c) => (
              <article
                key={c.id}
                onMouseEnter={() => setActiveId(c.id)}
                className={`bg-white border rounded-xl p-4 space-y-3 transition ${activeId === c.id ? 'border-red-300 shadow-sm' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                      <Link to={`${base}/${c.id}`} className="hover:text-red-700">{c.title}</Link>
                    </h2>
                    <p className="text-xs text-slate-600">{c.organisation_name} <span className="text-slate-400">&bull;</span> {c.organisation_type_label}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 shrink-0" title="People who registered interest">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />{c.interest_count} interested
                  </span>
                </div>
                <WhenWhere camp={c} />
                <FacilityChips facilities={c.facilities} limit={4} />
                <MedicalSupportLine support={c.medical_support} />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <InterestButton camp={c} onToggle={toggle} busy={busyId === c.id} isAuthenticated={isAuthenticated} />
                  <Link to={`${base}/${c.id}`} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-100">View details</Link>
                </div>
              </article>
            ))}
          </div>
        )}
        {showMap && (
          <div className="lg:sticky lg:top-4 space-y-2">
            <CampMap camps={mapCamps} base={base} activeId={activeId} onSelect={setActiveId} height={isDesktop ? '560px' : '420px'} />
            <p className="text-[11px] text-slate-500">Pins show each venue. Where an organiser has not given exact coordinates, the pin sits at the centre of the locality.</p>
          </div>
        )}
      </div>

      <CoordinationNotice>
        Registering interest tells the organiser roughly how many people to expect. It is not a booking and does not
        confirm that you are eligible to donate: screening on the day is done by the camp&apos;s qualified medical team.
      </CoordinationNotice>

      <p className="text-xs text-slate-600">
        Running a college, company, NGO or community group?{' '}
        <Link to="/register?role=organiser" className="font-semibold text-red-700 underline">Apply to organise a camp</Link>.
      </p>
    </div>
  );
};

export default CampsPage;
