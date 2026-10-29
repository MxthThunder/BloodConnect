import apiClient from './client';

const get = (url, params) => apiClient.get(`/camps${url}`, { params }).then((r) => r.data);
const post = (url, body) => apiClient.post(`/camps${url}`, body ?? {}).then((r) => r.data);
const patch = (url, body) => apiClient.patch(`/camps${url}`, body ?? {}).then((r) => r.data);
const del = (url) => apiClient.delete(`/camps${url}`).then((r) => r.data);

export const campsApi = {
  options: () => get('/options/'),
  list: (params) => get('/', params),
  detail: (id) => get(`/${id}/`),
  setInterest: (id, interested) => (interested ? post(`/${id}/interest/`) : del(`/${id}/interest/`)),
  myInterests: () => get('/my-interests/'),
  applications: (params) => get('/applications/', params),
  application: (id) => get(`/applications/${id}/`),
  submit: (body) => post('/applications/', body),
  edit: (id, body) => patch(`/applications/${id}/`, body),
  cancel: (id, reason) => post(`/applications/${id}/cancel/`, { reason }),
  action: (id, action, body) => post(`/applications/${id}/action/`, { action, ...body }),
};

/** Turns an axios error from the camps API into { message, fields } for forms. */
export const campError = (err, fallback = 'Something went wrong. Please try again.') => {
  const data = err?.response?.data;
  if (data && typeof data === 'object') {
    return { message: data.error || data.detail || fallback, fields: data.fields || {} };
  }
  return { message: fallback, fields: {} };
};
