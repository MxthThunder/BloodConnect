import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { Bell, CheckCheck, AlertCircle, HeartHandshake, Send, Clock } from 'lucide-react';

const RequesterNotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get('/notifications/');
      setNotifications(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id, actionUrl) => {
    try {
      await apiClient.patch(`/notifications/${id}/read/`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  const handleMarkAll = async () => {
    try {
      await apiClient.post('/notifications/mark-all-read/');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            In-App Messaging
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Notifications & Status Alerts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time updates regarding verification decisions, donor acceptances, and system dispatches.
          </p>
        </div>

        <button
          onClick={handleMarkAll}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition self-start sm:self-auto"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Mark All Read</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
          No notifications recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleMarkAsRead(n.id, n.action_url)}
              className={`p-5 rounded-2xl border transition cursor-pointer flex items-start gap-4 ${
                !n.is_read
                  ? 'bg-white border-red-200 shadow-xs ring-1 ring-red-100'
                  : 'bg-white/70 border-slate-200 hover:bg-white'
              }`}
            >
              <div className="p-2 rounded-xl bg-red-50 text-red-600 shrink-0 mt-0.5">
                {n.notification_type === 'DONOR_RESPONSE' ? (
                  <HeartHandshake className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`text-sm ${!n.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {n.title}
                  </h3>
                  {!n.is_read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  {n.request_reference && (
                    <span>&bull; Ref: {n.request_reference}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RequesterNotificationsPage;
