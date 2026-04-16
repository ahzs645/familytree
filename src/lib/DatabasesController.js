/**
 * DatabasesController — manages CloudKit database selection and switching.
 * Was `ca` / `la` in the minified code.
 *
 * The app stores this as `appController.databasesController`.
 * It's responsible for:
 * - Fetching available private and shared databases (family trees)
 * - Selecting a database (which triggers openDatabase())
 * - Managing the currently selected database
 */
import { ZONE_SEPARATOR } from '../models/constants.js';

export class DatabasesController {
  constructor(appController) {
    this.appController = appController;
    this.selectedDatabase = null;
    this.onDatabaseChange = null;
  }

  /**
   * Select a database (family tree) and open it.
   * @param {object|null} database - The database wrapper object to select, or null to deselect.
   */
  async selectDatabase(database) {
    if (!database) {
      this.selectedDatabase = null;
      if (this.onDatabaseChange) this.onDatabaseChange();
      return;
    }
    if (this.selectedDatabase !== database) {
      this.selectedDatabase = database;
      await this.selectedDatabase.openDatabase();
      if (this.onDatabaseChange) this.onDatabaseChange();
    }
  }

  /**
   * Select a database by its full zone name (includes ZONE_SEPARATOR + 'Root').
   * Called when navigating to a URL with ?zone= parameter.
   */
  async selectDatabaseWithZoneName(zoneName) {
    if (!zoneName || zoneName.length === 0) {
      await this.selectDatabase(null);
      return true;
    }
    if (this.selectedDatabase && this.selectedDatabase.zoneName() === zoneName) {
      return true;
    }
    // Fetch all zones and find the matching one
    const [privateZones, sharedZones] = await Promise.all([
      this.fetchAllPrivateZones(),
      this.fetchAllSharedZones(),
    ]);
    // ... zone matching logic would go here
    // This is handled by the original bundle code
    return false;
  }

  /** Close the currently selected database. */
  closeDatabase() {
    this.selectedDatabase = null;
    if (this.onDatabaseChange) this.onDatabaseChange();
  }

  /**
   * Get the short zone name of the selected database.
   * Strips the '#####Root' suffix from the full zone name.
   */
  selectedDatabaseZoneShortName() {
    if (!this.selectedDatabase) return '';
    return this.selectedDatabase.zoneName().replace(ZONE_SEPARATOR + 'Root', '');
  }

  /**
   * Convert a short zone name to a full zone name by appending '#####Root'.
   */
  static zoneNameFromShortZoneName(shortName) {
    return shortName ? shortName + ZONE_SEPARATOR + 'Root' : null;
  }

  /**
   * Convert a full zone name to a short zone name by stripping '#####Root'.
   */
  static shortZoneNameFromZoneName(zoneName) {
    return zoneName ? zoneName.replace(ZONE_SEPARATOR + 'Root', '') : null;
  }
}

export default DatabasesController;
