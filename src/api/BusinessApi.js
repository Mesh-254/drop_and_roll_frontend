/**
 * BusinessApi — API client for business profile operations.
 *
 * Methods:
 *   createProfile(data) → POST /api/business/profiles/
 *   updateProfile(data) → PATCH /api/business/profiles/{id}/
 *   getProfile() → GET /api/business/profiles/current/
 *
 * PHASE 3 STEP 7: Supports the BusinessProfileOnboarding workflow by providing
 * methods to create and update business profiles.
 */

import { ApiBase } from './ApiBase';

class BusinessApi extends ApiBase {
  /**
   * Create a new business profile for the current user.
   *
   * @param {Object} data - Profile data
   *   - company_name (string) *
   *   - company_reg_number (string, optional)
   *   - vat_number (string, optional)
   *   - address (string, optional)
   *   - contact_person (string)
   *   - contact_email (string) *
   *   - contact_phone (string, optional)
   *   - net_terms_requested (boolean)
   *   - net_terms_justification (string, optional)
   *
   * @returns {Promise<Object>} Created BusinessProfile
   */
  async createProfile(data) {
    try {
      const response = await this.axiosInstance.post(
        '/api/business/profiles/',
        data,
      );
      return response.data;
    } catch (error) {
      console.error('[BusinessApi] createProfile failed:', error);
      throw error;
    }
  }

  /**
   * Update existing business profile.
   *
   * @param {Object} data - Fields to update (same shape as createProfile)
   * @returns {Promise<Object>} Updated BusinessProfile
   */
  async updateProfile(data) {
    try {
      const response = await this.axiosInstance.patch(
        '/api/business/profiles/current/',
        data,
      );
      return response.data;
    } catch (error) {
      console.error('[BusinessApi] updateProfile failed:', error);
      throw error;
    }
  }

  /**
   * Fetch current user's business profile.
   *
   * @returns {Promise<Object>} Current BusinessProfile or null if not created
   */
  async getProfile() {
    try {
      const response = await this.axiosInstance.get(
        '/api/business/profiles/current/',
      );
      return response.data;
    } catch (error) {
      // 404 is expected if no profile exists
      if (error?.response?.status === 404) {
        return null;
      }
      console.error('[BusinessApi] getProfile failed:', error);
      throw error;
    }
  }
}

export default new BusinessApi();
