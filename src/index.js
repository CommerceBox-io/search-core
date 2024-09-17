import {
    initializeUser,
    initializeProperties,
    initializeCallbacks,
    initializeElements,
    init,
    getElementsMapping
} from "./modules/initializers";

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
                    url_params = {},
                    user = ""
                }) {
        const userParam = user ? `?user=${user}` : "";
        this.apiEndpoint = `${apiEndpoint}${userParam}`;
        this.autoCompleteUrl = `${apiEndpoint}/autocomplete${userParam}`;
        this.container = document.querySelector(containerSelector);
        this.elementsMapping = getElementsMapping();

        initializeUser(this, uuid);
        initializeCallbacks(this, addToCartCallback, addToWishlistCallback, addToCompareCallback);
        initializeProperties(this, layoutTemplate, externalGridSelector, searchPageRedirect, segment_id, segment_specialty_id, url_params);
        initializeElements(this);
        init(this);
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
