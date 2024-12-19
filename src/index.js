import {
    initializeUser,
    initializeProperties,
    initializeCallbacks,
    initializeElements,
    init,
    getElementsMapping
} from "./modules/initializers";
import { loadLocaleTranslations } from "./modules/utils";
import { getSettings } from "./modules/processors";

class SearchCore {
    /**
     * Constructs a new SearchCore instance.
     * @param {Object} options - The options for configuring the search core.
     * @param {string} options.apiEndpoint - The API endpoint for search requests.
     * @param {string} options.containerSelector - The CSS selector for the container element.
     * @param {string} [options.layoutTemplate=""] - The layout template.
     * @param {string} [options.externalGridSelector=""] - The external grid ID.
     * @param {string} [options.searchPageRedirect=""] - The search page redirect URL.
     * @param {Function} [options.addToCartCallback=null] - The callback function for adding to cart.
     * @param {Function} [options.addToWishlistCallback=null] - The callback function for adding to wishlist.
     * @param {Function} [options.addToCompareCallback=null] - The callback function for adding to compare.\
     * @param {string} [options.uuid=""] - The UUID, hash of user id.
     * @param {string} [options.segment_id=""] - The segment ID.
     * @param {string} [options.segment_specialty_id=""] - The segment specialty ID.
     * @param {string} [options.user=""] - The unique user identifier
     * @param {string | null} [options.locale=""] - The locale.
     * @param {string | null} [options.platform=""] - The platform.
     * @param {string | null} [options.sorting=""] - The sorting.
     * @param {Object | null} [options.translations={}] - The translations.
     */
    constructor({
                    apiEndpoint,
                    containerSelector,
                    layoutTemplate = "",
                    externalGridSelector = "",
                    searchPageRedirect = "",
                    addToCartCallback = null,
                    addToWishlistCallback = null,
                    addToCompareCallback = null,
                    uuid = "",
                    segment_id = "",
                    segment_specialty_id = "",
                    urlParams = {},
                    user = "",
                    locale = null,
                    platform = null,
                    sorting = null,
                    translations = null
                }) {
        this.defaultLocale = "el"
        this.t = {};
        this.userParam = user;
        this.apiEndpoint = apiEndpoint;
        this.autoCompleteUrl = `${apiEndpoint}/autocomplete`;
        this.settingsUrl = `${apiEndpoint}/settings`;
        this.container = document.querySelector(containerSelector);
        this.elementsMapping = getElementsMapping();
        this.settings = [];
        this.platform = platform;
        this.locale = locale ? locale : this.defaultLocale;
        this.sorting = sorting;
        this.translations = translations;
        this.searchVersion = 2;
        this.autocompleteVersion = 2;

        getSettings(this).finally(() => {
            loadLocaleTranslations(this, this.locale);
            initializeUser(this, uuid);
            initializeCallbacks(this, addToCartCallback, addToWishlistCallback, addToCompareCallback);
            initializeProperties(this, layoutTemplate, externalGridSelector, searchPageRedirect, segment_id, segment_specialty_id, urlParams);
            initializeElements(this);
            init(this);
        });
    }

    /**
     * Updates the search core options.
     * @param {Object} options - The options to update.
     */
    updateOptions(options) {
        this.apiEndpoint = options.apiEndpoint ? options.apiEndpoint : this.apiEndpoint;
        this.segment_id = options.segment_id ? options.segment_id : this.segment_id;
        this.segment_specialty_id = options.segment_specialty_id ? options.segment_specialty_id : this.segment_specialty_id;
    }
}

export default SearchCore;
