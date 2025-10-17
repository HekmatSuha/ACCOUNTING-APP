import axiosInstance from './axiosInstance';

const ADMIN_BASE_URL = '/admin/accounts';
const ADMIN_PLANS_BASE_URL = '/admin/plans';

export function parseAdminError(error, fallbackMessage = 'Unable to complete the admin request.') {
  if (error?.response?.data) {
    const data = error.response.data;

    if (typeof data === 'string') {
      return data;
    }

    if (data.detail) {
      if (Array.isArray(data.detail)) {
        return data.detail.join(' ');
      }
      return data.detail;
    }

    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const value = data[firstKey];
      if (Array.isArray(value)) {
        return value.join(' ');
      }
      if (typeof value === 'string') {
        return value;
      }
    }
  }

  return fallbackMessage;
}

function toAdminError(error, fallbackMessage) {
  const message = parseAdminError(error, fallbackMessage);
  const wrapped = new Error(message);
  wrapped.cause = error;
  return wrapped;
}

export async function listPlans() {
  try {
    const { data } = await axiosInstance.get(`${ADMIN_PLANS_BASE_URL}/`);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to load plans.');
  }
}

export async function fetchPlan(planId) {
  try {
    const { data } = await axiosInstance.get(`${ADMIN_PLANS_BASE_URL}/${planId}/`);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to load the plan.');
  }
}

export async function createPlan(payload) {
  try {
    const { data } = await axiosInstance.post(`${ADMIN_PLANS_BASE_URL}/`, payload);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to create the plan.');
  }
}

export async function updatePlan(planId, payload) {
  try {
    const { data } = await axiosInstance.put(`${ADMIN_PLANS_BASE_URL}/${planId}/`, payload);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to update the plan.');
  }
}

export async function deletePlan(planId) {
  try {
    await axiosInstance.delete(`${ADMIN_PLANS_BASE_URL}/${planId}/`);
  } catch (error) {
    throw toAdminError(error, 'Unable to delete the plan.');
  }
}

export async function listAccounts() {
  try {
    const { data } = await axiosInstance.get(`${ADMIN_BASE_URL}/`);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to load accounts.');
  }
}

export async function createAccount(payload) {
  try {
    const { data } = await axiosInstance.post(`${ADMIN_BASE_URL}/`, payload);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to create the account.');
  }
}

export async function fetchAccount(accountId) {
  try {
    const { data } = await axiosInstance.get(`${ADMIN_BASE_URL}/${accountId}/`);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to load the account.');
  }
}

export async function updateAccount(accountId, payload) {
  try {
    const { data } = await axiosInstance.patch(`${ADMIN_BASE_URL}/${accountId}/`, payload);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to update the account.');
  }
}

export async function updateSubscription(accountId, payload) {
  try {
    const { data } = await axiosInstance.post(`${ADMIN_BASE_URL}/${accountId}/subscription/`, payload);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to update the subscription.');
  }
}

export async function fetchAccountPlan(accountId) {
  try {
    const { data } = await axiosInstance.get(`${ADMIN_BASE_URL}/${accountId}/plan/`);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to load the account plan.');
  }
}

export async function updateAccountPlan(accountId, payload) {
  try {
    const { data } = await axiosInstance.put(`${ADMIN_BASE_URL}/${accountId}/plan/`, payload);
    return data;
  } catch (error) {
    throw toAdminError(error, 'Unable to update the account plan.');
  }
}

export async function withOptimisticUpdate(requestFn, { applyOptimistic, commit, rollback }) {
  const token = applyOptimistic ? applyOptimistic() : undefined;
  try {
    const result = await requestFn();
    if (commit) {
      commit(result, token);
    }
    return result;
  } catch (error) {
    if (rollback) {
      rollback(token);
    }
    throw error;
  }
}
