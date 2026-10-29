import apiClient from './client';

const get = (url, params) => apiClient.get(`/escalation${url}`, { params }).then((r) => r.data);
const post = (url, body) => apiClient.post(`/escalation${url}`, body ?? {}).then((r) => r.data);
const put = (url, body) => apiClient.put(`/escalation${url}`, body ?? {}).then((r) => r.data);
const del = (url) => apiClient.delete(`/escalation${url}`).then((r) => r.data);

export const escalationApi = {
  overview: (includeSimulations = false) => get('/overview/', { include_simulations: includeSimulations }),
  evaluateActive: () => post('/evaluate-active/'),
  createEmergency: (payload) => post('/emergencies/', payload),
  startCase: (bloodRequestId) => post('/cases/', { blood_request: bloodRequestId }),
  cases: (params) => get('/cases/', params),
  caseDetail: (id) => get(`/cases/${id}/`),
  candidates: (id, params) => get(`/cases/${id}/candidates/`, params),
  timeline: (id) => get(`/cases/${id}/timeline/`),
  map: (id) => get(`/cases/${id}/map/`),
  evaluate: (id) => post(`/cases/${id}/evaluate/`),
  escalate: (id) => post(`/cases/${id}/escalate/`),
  review: (id, note) => post(`/cases/${id}/review/`, { note }),
  resolve: (id, note) => post(`/cases/${id}/resolve/`, { note }),
  cancel: (id, reason) => post(`/cases/${id}/cancel/`, { reason }),
  ask: (id, body) => post(`/cases/${id}/assistant/`, body),
  questions: () => get('/assistant/questions/'),
  respond: (attemptId, response) => post(`/attempts/${attemptId}/respond/`, { response }),
  fulfilment: (attemptId, stage, note) => post(`/attempts/${attemptId}/fulfilment/`, { stage, note }),
  policy: () => get('/policy/'),
  savePolicy: (config) => put('/policy/', { config }),
  resetPolicy: () => post('/policy/reset/'),
  scenarios: () => get('/simulations/scenarios/'),
  simulations: () => get('/simulations/'),
  createSimulation: (body) => post('/simulations/', body),
  simulation: (id) => get(`/simulations/${id}/`),
  simControl: (id, op, body) => post(`/simulations/${id}/${op}/`, body),
  deleteSimulation: (id) => del(`/simulations/${id}/`),
  purgeSimulations: () => post('/simulations/purge/'),
  experiments: () => get('/experiments/'),
  experiment: (id) => get(`/experiments/${id}/`),
  runExperiment: (body) => post('/experiments/', body),
  rerunExperiment: (id, sameSeeds) => post(`/experiments/${id}/rerun/`, { same_seeds: sameSeeds }),
  experimentRuns: (id) => get(`/experiments/${id}/runs/`),
  askExperiment: (id, question) => post(`/experiments/${id}/assistant/`, { question }),
};

export const errorMessage = (err, fallback = 'Something went wrong.') => {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data === 'string') return fallback;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  const first = Object.entries(data)[0];
  if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(' ') : first[1]}`;
  return fallback;
};
