import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { campsApi, campError } from '../../api/camps';
import { Alert, Panel } from '../../components/escalation/shared';
import { CampMap, CoordinationNotice, FacilityChips, MedicalSupportLine, WhenWhere } from '../../components/camps/shared';
import { InterestButton, useInterest } from './CampsPage';

const CampDetailPage = ({ base = '/camps' }) => {
  const { id } = useParams();
  const [camp, setCamp] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    campsApi.detail(id)
      .then((data) => { if (!cancelled) { setCamp(data); setError(''); } })
      .catch((err) => {
        if (cancelled) return;
        setCamp(null);
        setError(err?.response?.status === 404
          ? 'This camp is not open any more, or it has not been approved yet.'
          : campError(err, 'Could not load this camp.').message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const { toggle, busyId, error: interestError, isAuthenticated } = useInterest((_, res) => {
    setCamp((c) => ({ ...c, is_interested: res.is_interested, interest_count: res.interest_count }));
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <Link to={base} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-red-700">
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> All donation camps
      </Link>

      {loading && <div className="flex items-center gap-2 text-xs text-slate-500 py-10"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading camp...</div>}
      {error && <Alert tone="warn">{error}</Alert>}
      {interestError && <Alert>{interestError}</Alert>}

      {camp && (
        <>
          <header className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{camp.title}</h1>
            <p className="text-sm text-slate-600">{camp.organisation_name} <span className="text-slate-400">&bull;</span> {camp.organisation_type_label}</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 space-y-4">
              <Panel title="When and where">
                <div className="space-y-3">
                  <WhenWhere camp={camp} />
                  <p className="text-xs text-slate-600 whitespace-pre-line">{camp.address}</p>
                </div>
              </Panel>
              {camp.description && <Panel title="About this camp"><p className="text-sm text-slate-700 whitespace-pre-line">{camp.description}</p></Panel>}
              <Panel title="Venue facilities">
                {camp.facilities.length ? <FacilityChips facilities={camp.facilities} /> : <p className="text-xs text-slate-500">The organiser has not listed any facilities.</p>}
                {camp.facilities_notes && <p className="text-xs text-slate-600 mt-2">{camp.facilities_notes}</p>}
              </Panel>
              <Panel title="Medical support">
                <MedicalSupportLine support={camp.medical_support} />
              </Panel>
              <Panel title="How to register">
                <p className="text-sm text-slate-700 whitespace-pre-line">{camp.registration_info || 'Walk in on the day, or register your interest below.'}</p>
              </Panel>
            </div>

            <aside className="lg:col-span-2 space-y-4">
              <Panel title="Take part">
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-xs text-slate-700">
                    <Users className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
                    <span><strong>{camp.interest_count}</strong> {camp.interest_count === 1 ? 'person has' : 'people have'} registered interest</span>
                  </p>
                  <InterestButton camp={camp} onToggle={toggle} busy={busyId === camp.id} isAuthenticated={isAuthenticated} />
                  <p className="text-[11px] text-slate-500">This is an expression of interest, not a booking.</p>
                </div>
              </Panel>
              <CampMap camps={[camp]} base={base} height="260px" />
              {camp.location_approximate && <p className="text-[11px] text-slate-500">The pin is approximate (centre of {camp.locality}).</p>}
            </aside>
          </div>
          <CoordinationNotice>{camp.notice}</CoordinationNotice>
        </>
      )}
    </div>
  );
};

export default CampDetailPage;
