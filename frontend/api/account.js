import { apiDelete } from './client';
import { getAuthToken, clearAuthSession } from './auth';

export async function deleteAccount() {
  const token = await getAuthToken();
  const res = await apiDelete('/account', {}, 20000, token);
  return res;
}


