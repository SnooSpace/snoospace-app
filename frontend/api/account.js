import { apiDelete } from './client';
import { getAuthToken, getActiveAccount, removeAccountAndAutoSwitch } from './auth';

/**
 * Delete account from backend AND remove from local storage
 * Returns: { success, switchedToAccount, navigateToLanding }
 */
export async function deleteAccount() {
  // Get active account before deletion
  const activeAccount = await getActiveAccount();
  const accountId = activeAccount?.id;
  
  // Delete from backend
  const token = await getAuthToken();
  const res = await apiDelete('/account', {}, 20000, token);
  
  // If successful, also remove from local storage
  if (accountId) {
    const { switchedToAccount, navigateToLanding } = await removeAccountAndAutoSwitch(accountId);
    return { 
      success: true, 
      switchedToAccount, 
      navigateToLanding,
      ...res 
    };
  }
  
  return { success: true, navigateToLanding: true, ...res };
}
