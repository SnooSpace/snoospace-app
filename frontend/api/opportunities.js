import { apiPost, apiGet, apiPatch, apiDelete } from "./client";

/**
 * Create a new opportunity
 * @param {Object} opportunityData - Opportunity details
 * @returns {Promise<Object>} Created opportunity
 */
export async function createOpportunity(opportunityData) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPost("/opportunities", opportunityData, 15000, token);
}

/**
 * Get opportunities created by the current user
 * @param {string} status - Optional filter: 'active', 'closed', 'draft'
 * @returns {Promise<Object>} List of opportunities
 */
export async function getOpportunities(status = null) {
  const token = await (await import("./auth")).getAuthToken();
  const query = status ? `?status=${status}` : "";
  return apiGet(`/opportunities${query}`, 15000, token);
}

/**
 * Get opportunity details
 * @param {string} opportunityId - Opportunity ID
 * @returns {Promise<Object>} Opportunity details
 */
export async function getOpportunityDetail(opportunityId) {
  const token = await (await import("./auth")).getAuthToken();
  return apiGet(`/opportunities/${opportunityId}`, 15000, token);
}

/**
 * Update an opportunity
 * @param {string} opportunityId - Opportunity ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated opportunity
 */
export async function updateOpportunity(opportunityId, updateData) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPatch(`/opportunities/${opportunityId}`, updateData, 15000, token);
}

/**
 * Close or delete an opportunity
 * @param {string} opportunityId - Opportunity ID
 * @param {string} action - 'close' or 'delete'
 * @returns {Promise<Object>} Result
 */
export async function closeOpportunity(opportunityId, action = "close") {
  const token = await (await import("./auth")).getAuthToken();
  return apiDelete(
    `/opportunities/${opportunityId}?action=${action}`,
    null,
    15000,
    token,
  );
}

/**
 * Discover public opportunities
 * @param {Object} options - Filter options
 * @param {string} options.role - Filter by role type
 * @param {string} options.payment_type - Filter by payment type
 * @param {string} options.work_mode - Filter by work mode
 * @param {number} options.limit - Limit results
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} List of opportunities
 */
export async function discoverOpportunities(options = {}) {
  const token = await (await import("./auth")).getAuthToken();
  const params = new URLSearchParams();
  if (options.role) params.append("role", options.role);
  if (options.payment_type) params.append("payment_type", options.payment_type);
  if (options.work_mode) params.append("work_mode", options.work_mode);
  if (options.limit) params.append("limit", String(options.limit));
  if (options.offset) params.append("offset", String(options.offset));

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiGet(`/discover/opportunities${query}`, 15000, token);
}

/**
 * Apply to an opportunity
 * @param {Object} applicationData - Application details
 * @param {string} applicationData.opportunity_id - Opportunity ID
 * @param {string} applicationData.applied_role - Role being applied for
 * @param {string} applicationData.portfolio_link - Optional portfolio link
 * @param {string} applicationData.portfolio_note - Optional additional note
 * @param {Array} applicationData.responses - Answers to custom questions
 * @returns {Promise<Object>} Created application
 */
export async function applyToOpportunity(applicationData) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPost("/opportunities/apply", applicationData, 15000, token);
}

/**
 * Get applications for an opportunity (creator view)
 * @param {string} opportunityId - Opportunity ID
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} List of applications
 */
export async function getApplications(opportunityId, options = {}) {
  const token = await (await import("./auth")).getAuthToken();
  const params = new URLSearchParams();
  if (options.status) params.append("status", options.status);
  if (options.role) params.append("role", options.role);

  const query = params.toString() ? `?${params.toString()}` : "";
  return apiGet(
    `/opportunities/${opportunityId}/applications${query}`,
    15000,
    token,
  );
}

/**
 * Get single application details
 * @param {string} applicationId - Application ID
 * @returns {Promise<Object>} Application details
 */
export async function getApplicationDetail(applicationId) {
  const token = await (await import("./auth")).getAuthToken();
  return apiGet(`/opportunities/applications/${applicationId}`, 15000, token);
}

/**
 * Update application status (shortlist, reject, etc)
 * @param {string} applicationId - Application ID
 * @param {Object} updateData - Status update
 * @returns {Promise<Object>} Updated application
 */
export async function updateApplicationStatus(applicationId, updateData) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPatch(
    `/opportunities/applications/${applicationId}`,
    updateData,
    15000,
    token,
  );
}
