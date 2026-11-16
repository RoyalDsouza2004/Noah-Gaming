/**
 * Abstract Base Adapter for External Game Metadata Providers (RAWG, IGDB, etc.)
 */
export class BaseGameMetadataAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * Search for games matching query
   * @param {string} query
   * @returns {Promise<Array<{ id, name, released, backgroundImage, rating, platforms }>>}
   */
  async search(query) {
    throw new Error('search() must be implemented by adapter subclass');
  }

  /**
   * Fetch full game details by external identifier
   * @param {string|number} externalId
   * @returns {Promise<Object>} normalized metadata payload
   */
  async getDetails(externalId) {
    throw new Error('getDetails() must be implemented by adapter subclass');
  }

  /**
   * Check if the adapter credentials are configured and ready
   */
  isConfigured() {
    return false;
  }
}
