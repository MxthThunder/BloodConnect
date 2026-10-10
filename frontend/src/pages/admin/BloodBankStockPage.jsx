import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import {
  Building2,
  PlusCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Minus,
  Edit3,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const BloodBankStockPage = () => {
  const [stocks, setStocks] = useState([]);
  const [bloodBanks, setBloodBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);

  // Form for stock transaction
  const [txForm, setTxForm] = useState({
    transaction_type: 'ADDITION',
    units: 2,
    reason: 'Voluntary blood donation camp intake batch',
    reference_note: '',
  });
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txError, setTxError] = useState('');
  const [txSuccess, setTxSuccess] = useState('');

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const [sRes, bRes] = await Promise.all([
        apiClient.get('/bloodbank/stock/'),
        apiClient.get('/bloodbank/banks/'),
      ]);
      setStocks(sRes.data || []);
      setBloodBanks(bRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, []);

  const openTransactionModal = (stock) => {
    setSelectedStock(stock);
    setTxError('');
    setTxSuccess('');
    setTxForm({
      transaction_type: 'ADDITION',
      units: 2,
      reason: 'Voluntary blood donation camp intake batch',
      reference_note: '',
    });
    setTransactionModalOpen(true);
  };

  const handleApplyTransaction = async (e) => {
    e.preventDefault();
    setTxSubmitting(true);
    setTxError('');
    setTxSuccess('');

    try {
      const res = await apiClient.post(`/bloodbank/stock/${selectedStock.id}/transaction/`, {
        transaction_type: txForm.transaction_type,
        units: parseInt(txForm.units, 10),
        reason: txForm.reason,
        reference_note: txForm.reference_note,
      });
      setTxSuccess(res.data.message || 'Stock updated successfully');
      fetchStocks();
      setTimeout(() => {
        setTransactionModalOpen(false);
      }, 1500);
    } catch (err) {
      setTxError(err.response?.data?.error || 'Failed to apply transaction');
    } finally {
      setTxSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Inventory & Cold Chain Tracking
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Blood Bank Stock Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time verified inventory with atomic stock transactions and negative inventory barriers.
          </p>
        </div>

        <button
          onClick={fetchStocks}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stock Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Loading blood stock inventory...</div>
      ) : stocks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
          No stock records found in the database.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Blood Bank Facility</th>
                <th className="py-3.5 px-4">Blood Group</th>
                <th className="py-3.5 px-4">Component</th>
                <th className="py-3.5 px-4">Available Units</th>
                <th className="py-3.5 px-4">Low-Stock Threshold</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Stock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stocks.map((stock) => (
                <tr key={stock.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {stock.bank_name}
                  </td>
                  <td className="py-3 px-4">
                    <BloodGroupBadge group={stock.blood_group} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-slate-600">{stock.component}</td>
                  <td className="py-3 px-4 font-black text-sm text-slate-900">
                    {stock.units_available} units
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    &le; {stock.low_stock_threshold} units
                  </td>
                  <td className="py-3 px-4">
                    {stock.is_low_stock ? (
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Low Stock</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md font-medium text-[10px] bg-emerald-100 text-emerald-800 w-fit">
                        Adequate
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openTransactionModal(stock)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                    >
                      Update Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Apply Transaction Modal */}
      {transactionModalOpen && selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setTransactionModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 z-10 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                  Atomic Stock Transaction
                </span>
                <h3 className="font-black text-lg text-slate-900">
                  Update {selectedStock.blood_group} Units
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedStock.bank_name} &bull; Current Available: <strong>{selectedStock.units_available} units</strong>
                </p>
              </div>
              <button onClick={() => setTransactionModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {txSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{txSuccess}</span>
              </div>
            )}

            {txError && (
              <div className="p-3.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{txError}</span>
              </div>
            )}

            <form onSubmit={handleApplyTransaction} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Transaction Action Type *</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { id: 'ADDITION', label: 'Addition', icon: Plus },
                    { id: 'USAGE_ISSUE', label: 'Hospital Issue', icon: Minus },
                    { id: 'CORRECTION', label: 'Audit Adjust', icon: Edit3 },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setTxForm({ ...txForm, transaction_type: t.id })}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 font-bold transition ${
                        txForm.transaction_type === t.id
                          ? 'bg-red-600 text-white border-red-600 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <t.icon className="w-4 h-4" />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Units Quantity *</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={txForm.units}
                  onChange={(e) => setTxForm({ ...txForm, units: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 outline-hidden font-bold text-sm"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Cannot deduct more units than currently available. Database locks protect against negative inventory.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Audit Justification / Clinical Reason *</label>
                <textarea
                  rows={2}
                  required
                  value={txForm.reason}
                  onChange={(e) => setTxForm({ ...txForm, reason: e.target.value })}
                  placeholder="e.g. Voluntary replacement donation camp or ICU transfusion dispatch"
                  className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Reference Note (Optional)</label>
                <input
                  type="text"
                  value={txForm.reference_note}
                  onChange={(e) => setTxForm({ ...txForm, reference_note: e.target.value })}
                  placeholder="e.g. Batch #2026-KA-419"
                  className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTransactionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txSubmitting}
                  className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition"
                >
                  {txSubmitting ? 'Recording...' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BloodBankStockPage;
