import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { campsApi, campError } from '../../api/camps';
import { Alert, Button, Panel } from '../../components/escalation/shared';
import { CoordinationNotice, FieldError } from '../../components/camps/shared';

const MIN_LEAD_DAYS = 3;

const isoDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const EMPTY = {
  organisation_name: '', organisation_type: 'COLLEGE', title: '', description: '', venue_name: '', address: '',
  locality: 'Adyar', latitude: '', longitude: '', camp_date: '', start_time: '09:00', end_time: '14:00',
  expected_donors: '', facilities: [], facilities_notes: '', contact_name: '', contact_phone: '', contact_email: '',
  registration_info: '',
};

const input = 'mt-1 block w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-hidden bg-white';

const Field = ({ label, required, hint, errors, children }) => (
  <label className="block text-xs font-semibold text-slate-700">
    {label}{required && <span aria-hidden="true"> *</span>}
    {children}
    {hint && <span className="block mt-1 font-normal text-[11px] text-slate-500">{hint}</span>}
    <FieldError errors={errors} />
  </label>
);

const ApplyCampPage = () => {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opts = await campsApi.options();
        if (cancelled) return;
        setOptions(opts);
        if (editing) {
          const app = await campsApi.application(id);
          if (cancelled) return;
          if (!app.can_edit) {
            setError('This application is already under review and can no longer be edited.');
          }
          setForm({
            ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, app[k] ?? EMPTY[k]])),
            latitude: app.location_approximate ? '' : app.latitude ?? '',
            longitude: app.location_approximate ? '' : app.longitude ?? '',
            facilities: (app.facilities || []).map((f) => f.code),
          });
        }
      } catch (err) {
        if (!cancelled) setError(campError(err, 'Could not load the form.').message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, editing]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleFacility = (code) => setForm((f) => ({
    ...f, facilities: f.facilities.includes(code) ? f.facilities.filter((c) => c !== code) : [...f.facilities, code],
  }));

  const minDate = useMemo(() => isoDate(MIN_LEAD_DAYS), []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFieldErrors({});
    const body = {
      ...form,
      expected_donors: form.expected_donors === '' ? '' : Number(form.expected_donors),
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
    };
    try {
      const app = editing ? await campsApi.edit(id, body) : await campsApi.submit(body);
      navigate(`/organiser/applications/${app.id}`);
    } catch (err) {
      const { message, fields } = campError(err);
      setError(message);
      setFieldErrors(fields);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-xs text-slate-500">Loading form...</p>;
  const f = fieldErrors;

  return (
    <div className="space-y-5 max-w-4xl">
      <Link to={editing ? `/organiser/applications/${id}` : '/organiser/dashboard'} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-red-700">
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back
      </Link>
      <header>
        <h1 className="text-xl font-black text-slate-900">{editing ? 'Edit camp application' : 'Apply to hold a blood donation camp'}</h1>
        <p className="text-xs text-slate-600 mt-1">
          Tell us about your camp. BloodConnect reviews every application and coordinates with an authorised blood bank or
          medical team. You can follow each stage after you submit.
        </p>
      </header>

      <CoordinationNotice>{options?.notice}</CoordinationNotice>
      {error && <Alert>{error}</Alert>}

      <form onSubmit={submit} className="space-y-5" noValidate>
        <Panel title="Organisation">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Organisation name" required errors={f.organisation_name}>
              <input className={input} value={form.organisation_name} onChange={set('organisation_name')} required maxLength={150} />
            </Field>
            <Field label="Type of organisation" required errors={f.organisation_type}>
              <select className={input} value={form.organisation_type} onChange={set('organisation_type')}>
                {options?.organisation_types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Camp title" required errors={f.title}>
              <input className={input} value={form.title} onChange={set('title')} required maxLength={150} placeholder="e.g. Annual Campus Blood Drive" />
            </Field>
            <Field label="Expected number of donors" required errors={f.expected_donors} hint="Your best estimate (10 or more).">
              <input className={input} type="number" min="10" value={form.expected_donors} onChange={set('expected_donors')} required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="About the camp (shown publicly)" errors={f.description}>
                <textarea className={input} rows={3} value={form.description} onChange={set('description')} maxLength={2000} />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title="Date, time and venue">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Proposed date" required errors={f.camp_date} hint={`At least ${MIN_LEAD_DAYS} days from today.`}>
              <input className={input} type="date" min={minDate} value={form.camp_date} onChange={set('camp_date')} required />
            </Field>
            <Field label="Start time" required errors={f.start_time}>
              <input className={input} type="time" value={form.start_time} onChange={set('start_time')} required />
            </Field>
            <Field label="End time" required errors={f.end_time}>
              <input className={input} type="time" value={form.end_time} onChange={set('end_time')} required />
            </Field>
            <Field label="Venue name" required errors={f.venue_name}>
              <input className={input} value={form.venue_name} onChange={set('venue_name')} required maxLength={200} />
            </Field>
            <Field label="Locality" required errors={f.locality}>
              <select className={input} value={form.locality} onChange={set('locality')}>
                {options?.localities.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-3">
              <Field label="Full address" required errors={f.address}>
                <textarea className={input} rows={2} value={form.address} onChange={set('address')} required maxLength={500} />
              </Field>
            </div>
            <Field label="Latitude (optional)" errors={f.latitude} hint="For an exact map pin. Leave both blank to use the locality centre.">
              <input className={input} inputMode="decimal" value={form.latitude} onChange={set('latitude')} placeholder="13.0012" />
            </Field>
            <Field label="Longitude (optional)" errors={f.longitude}>
              <input className={input} inputMode="decimal" value={form.longitude} onChange={set('longitude')} placeholder="80.2565" />
            </Field>
          </div>
        </Panel>

        <Panel title="Facilities your venue can offer">
          <fieldset>
            <legend className="sr-only">Venue facilities</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options?.facilities.map((fa) => (
                <label key={fa.value} className="flex items-center gap-2 text-xs text-slate-800">
                  <input type="checkbox" checked={form.facilities.includes(fa.value)} onChange={() => toggleFacility(fa.value)} className="rounded border-slate-300" />
                  {fa.label}
                </label>
              ))}
            </div>
            <FieldError errors={f.facilities} />
          </fieldset>
          <div className="mt-3">
            <Field label="Anything else about the venue?" errors={f.facilities_notes}>
              <input className={input} value={form.facilities_notes} onChange={set('facilities_notes')} maxLength={300} />
            </Field>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Medical personnel, screening and collection equipment are arranged with a qualified partner, not by the venue.</p>
        </Panel>

        <Panel title="Contact and public registration information">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Contact person" required errors={f.contact_name}>
              <input className={input} value={form.contact_name} onChange={set('contact_name')} required maxLength={120} />
            </Field>
            <Field label="Contact phone" required errors={f.contact_phone}>
              <input className={input} type="tel" value={form.contact_phone} onChange={set('contact_phone')} required />
            </Field>
            <Field label="Contact e-mail" errors={f.contact_email}>
              <input className={input} type="email" value={form.contact_email} onChange={set('contact_email')} />
            </Field>
            <div className="sm:col-span-3">
              <Field label="How donors should register (shown publicly)" errors={f.registration_info} hint="Your phone number and e-mail above are kept private and are not shown to the public.">
                <textarea className={input} rows={2} value={form.registration_info} onChange={set('registration_info')} maxLength={2000} placeholder="e.g. Walk in with a photo ID, or ask at the registration desk." />
              </Field>
            </div>
          </div>
        </Panel>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" busy={busy} disabled={editing && Boolean(error) && !options}>
            {editing ? 'Save changes' : 'Submit application'}
          </Button>
          <Link to="/organiser/dashboard" className="text-xs font-semibold text-slate-600 hover:text-red-700">Cancel</Link>
        </div>
      </form>
    </div>
  );
};

export default ApplyCampPage;
