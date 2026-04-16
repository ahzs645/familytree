/**
 * AppController — main application controller singleton.
 * Was `Ca` (class) / `ka` (singleton instance) in the minified code.
 *
 * Manages:
 * - CloudKit container configuration and authentication
 * - DatabasesController for database selection
 * - Localizer for string translations
 * - App initialization state
 *
 * The singleton is created at startup and stored as `ka`:
 *   const appController = new AppController();  // ka = new Ca()
 *   const localize = appController.localizer.localize.bind(appController.localizer);  // _a
 */
import { DatabasesController } from './DatabasesController.js';
import { Localizer } from './Localizer.js';

export class AppController {
  constructor() {
    // Initialization state
    this.initialized = false;
    this.onInitializationChange = null;

    // Authentication state
    this.authenticated = undefined;
    this.onAuthenticationChange = null;
    this.userName = null;

    // CloudKit container
    this.cloudKitContainerIdentifierSelectedInLogin = null;
    this.currentCloudKitContainer = null;

    /**
     * CloudKit container configurations.
     * FamilyTree 10: iCloud.com.syniumsoftware.familytree10
     * FamilyTree 11: iCloud.com.syniumsoftware.familytree11
     */
    this.cloudKitContainerConfigurations = [
      {
        containerIdentifier: 'iCloud.com.syniumsoftware.familytree10',
        apiTokenAuth: {
          apiToken: 'ad784d5ee9a296d8d1f7b26eb8f4893c6a767e3872091d3d2b869cac8cc74947',
          persist: true,
          signInButton: { id: 'apple-sign-in-button', theme: 'black' },
          signOutButton: { id: 'apple-sign-out-button', theme: 'black' },
        },
        environment: 'production',
      },
      {
        containerIdentifier: 'iCloud.com.syniumsoftware.familytree11',
        apiTokenAuth: {
          apiToken: '3709369b5f56d53ef2421d9d3a4e5f8a402e0f36c19e0196212e40f03b4051dc',
          persist: true,
          signInButton: { id: 'apple-sign-in-button', theme: 'black' },
          signOutButton: { id: 'apple-sign-out-button', theme: 'black' },
        },
        environment: 'production',
      },
    ];

    // Sub-controllers
    this.databasesController = new DatabasesController(this);
    this.localizer = new Localizer(this);

    // Listen for CloudKit SDK to load
    window.addEventListener('cloudkitloaded', () => {
      this.cloudKitLoaded();
    });
  }

  /**
   * Called when the CloudKit SDK finishes loading.
   * Configures the CloudKit container and sets up authentication.
   */
  cloudKitLoaded() {
    // This method is implemented by the original bundle's class hierarchy.
    // In the reconstructed version, the shim handles this automatically.
  }

  /**
   * Available container identifiers for the login selector.
   */
  availableCloudKitContainerIdentifiers() {
    return this.cloudKitContainerConfigurations.map((c) => c.containerIdentifier);
  }

  /**
   * Display name for a container identifier.
   */
  cloudKitContainerNameToDisplay(identifier) {
    if (identifier.includes('familytree10')) return 'MacFamilyTree 10';
    if (identifier.includes('familytree11')) return 'MacFamilyTree 11';
    return identifier;
  }

  /**
   * Check authentication for the currently selected container.
   * Returns a promise that resolves when auth check is complete.
   */
  checkAuthenticationForCurrentCloudKitContainer() {
    return Promise.resolve();
  }

  /**
   * Check authentication for a specific container identifier.
   */
  checkAuthenticationForCloudKitContainerWithIdentifier(identifier) {
    this.cloudKitContainerIdentifierSelectedInLogin = identifier;
  }

  /**
   * Whether the user is authenticated for a specific container.
   */
  isAuthenticatedForCloudKitContainerWithIdentifier(identifier) {
    return this.authenticated === true;
  }
}

export default AppController;
