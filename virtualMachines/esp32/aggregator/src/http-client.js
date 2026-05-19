export async function readJsonResponse(res, fallbackErrorLabel = 'Request failed') {
  const text = await res.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!res.ok) {
    const detail = payload && typeof payload === 'object' && payload.error ? payload.error : `${fallbackErrorLabel} (${res.status})`;
    throw new Error(detail);
  }

  return payload;
}

export async function requestJson(url, init = {}, fallbackErrorLabel = 'Request failed') {
  const res = await fetch(url, init);
  return readJsonResponse(res, fallbackErrorLabel);
}

export function getActorUserId() {
  return localStorage.getItem('pulse.actorUserId') || 'system-admin';
}

export function actorHeaders(extra = {}) {
  return {
    'x-user-id': getActorUserId(),
    ...extra
  };
}

export async function getJson(url, fallbackErrorLabel = 'Request failed', init = {}) {
  return requestJson(url, init, fallbackErrorLabel);
}

export async function postJson(url, body = {}, fallbackErrorLabel = 'Request failed', init = {}) {
  return requestJson(url, {
    ...init,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {})
    },
    body: JSON.stringify(body)
  }, fallbackErrorLabel);
}

export async function putJson(url, body = {}, fallbackErrorLabel = 'Request failed', init = {}) {
  return requestJson(url, {
    ...init,
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {})
    },
    body: JSON.stringify(body)
  }, fallbackErrorLabel);
}

export async function getJsonAsActor(url, fallbackErrorLabel = 'Request failed', init = {}) {
  return getJson(url, fallbackErrorLabel, {
    ...init,
    headers: actorHeaders(init.headers || {})
  });
}

export async function postJsonAsActor(url, body = {}, fallbackErrorLabel = 'Request failed', init = {}) {
  return postJson(url, body, fallbackErrorLabel, {
    ...init,
    headers: actorHeaders(init.headers || {})
  });
}
