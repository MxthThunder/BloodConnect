import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Bell, Search, AlertCircle, HeartHandshake, Send, Clock, RefreshCw } from 'lucide-react';

const NotificationManagementPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchAllNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/notifications/all/');
      setNotifications(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllNotifications();
  }, []);

  const filtered = notifications.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.recipient_email?.toLowerCase().includes(search.toLowerCase()) ||
      n.message.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter ? n.notification_type === typeFilter : true;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Broadcast Auditing
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Dispatched Notifications Registry
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Global log of simulated in-app alerts delivered to registered users across Chennai.
          </p>
        </div>

        <button
          onClick={fetchAllNotifications}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications by recipient, subject, case ref..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white text-slate-700"
        >
          <option value="">All Notification Categories</option>
          <option value="EMERGENCY_ALERT">Emergency Donor Alerts</option>
          <option value="STATUS_UPDATE">Request Status Updates</option>
          <option value="DONOR_RESPONSE">Donor Responses</option>
          <option value="LOW_STOCK">Low-Stock Warnings</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Loading broadcast logs...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
          No notifications found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Subject & Message</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Dispatched At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((n) => (
                <tr key={n.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                    <div>{n.recipient_name || n.recipient_email}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{n.recipient_email}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md font-bold uppercase text-[10px] bg-slate-100 text-slate-700">
                      {n.notification_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 max-w-md">
                    <div className="font-bold text-slate-800">{n.title}</div>
                    <p className="text-[11px] text-slate-500 truncate">{n.message}</p>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {n.is_read ? (
                      <span className="text-[11px] text-slate-400 font-medium">Read</span>
                    ) : (
                      <span className="text-[11px] text-red-600 font-bold">Unread</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                    {new Date(n.created_at).toLocaleString()}
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

export default NotificationManagementPage;
