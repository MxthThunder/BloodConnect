import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import { AlertTriangle, Building2, RefreshCw, Send, CheckCircle2 } from 'lucide-react';

const LowStockAlertsPage = () => {
  const [lowStocks, setLowStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLowStocks = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/bloodbank/low-stock/');
      setLowStocks(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStocks();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
            Critical Inventory Warning Radar
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Low-Stock Blood Reserves & Shortage Alerts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Blood groups currently below safety threshold levels requiring voluntary donor intake drives.
          </p>
        </div>

        <button
          onClick={fetchLowStocks}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Scanning inventory thresholds...</div>
      ) : lowStocks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="font-bold text-sm text-slate-700">All blood group reserves are above safety thresholds!</p>
          <p>No critical shortage warnings are currently active.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lowStocks.map((stock) => {
            const deficit = Math.max(0, stock.low_stock_threshold - stock.units_available);
            return (
              <div
                key={stock.id}
                className="p-6 rounded-3xl bg-white border border-amber-300 shadow-xs ring-2 ring-amber-100/50 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <BloodGroupBadge group={stock.blood_group} size="lg" />
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Deficit: -{deficit} units</span>
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-black text-slate-900">
                    {stock.units_available}{' '}
                    <span className="text-xs font-normal text-slate-400">units available</span>
                  </div>
                  <p className="text-xs text-slate-700 font-semibold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{stock.bank_name}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Safety Threshold: &le; {stock.low_stock_threshold} units &bull; {stock.component}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 text-[11px] text-amber-900 bg-amber-50/60 p-3 rounded-xl">
                  <strong>Recommended Clinical Action:</strong> Initiate targeted voluntary donor broadcast for group {stock.blood_group} within {stock.bank_city || 'Bengaluru'}.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LowStockAlertsPage;
