import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import StatusBadge from '../../components/StatusBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import { Heart, Search, Phone, MapPin, CheckCircle2, ShieldCheck, Filter } from 'lucide-react';

const DonorManagementPage = () => {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');

  const fetchDonors = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/donors/directory/');
      setDonors(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, []);

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const filtered = donors.filter((d) => {
    const matchesSearch =
      d.display_name.toLowerCase().includes(search.toLowerCase()) ||
      d.city.toLowerCase().includes(search.toLowerCase()) ||
      d.locality.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = groupFilter ? d.blood_group === groupFilter : true;
    const matchesAvail = availFilter ? String(d.is_available) === availFilter : true;
    return matchesSearch && matchesGroup && matchesAvail;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Network Registry
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Registered Voluntary Donors
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Search, filter, and review verified standby donors across Bengaluru localities.
          </p>
        </div>

        <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold">
          {donors.length} Registered Donors
        </span>
      </div>

      <ClinicalDisclaimer compact={true} />

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search donors by name, locality, or city..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white text-slate-700"
          >
            <option value="">All Blood Groups</option>
            {bloodGroups.map((bg) => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </select>

          <select
            value={availFilter}
            onChange={(e) => setAvailFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white text-slate-700"
          >
            <option value="">All Availability</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Loading donor records...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
          No donors found matching the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Donor Name</th>
                <th className="py-3.5 px-4">Blood Group</th>
                <th className="py-3.5 px-4">Locality & City</th>
                <th className="py-3.5 px-4">Availability</th>
                <th className="py-3.5 px-4">Consent</th>
                <th className="py-3.5 px-4">Donations</th>
                <th className="py-3.5 px-4">Contact (Admin View)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {d.display_name}
                  </td>
                  <td className="py-3 px-4">
                    <BloodGroupBadge group={d.blood_group} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    <div className="font-semibold text-slate-800">{d.locality}</div>
                    <div className="text-[11px] text-slate-400">{d.city}</div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge type="availability" value={d.is_available} size="xs" />
                  </td>
                  <td className="py-3 px-4">
                    {d.notification_consent ? (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Granted</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400">Withheld</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {d.total_donations || 0} times
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700">
                    {d.contact_phone}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DonorManagementPage;
