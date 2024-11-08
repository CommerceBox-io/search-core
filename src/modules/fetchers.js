import { loadTemplate } from './initializers';
import {
    autocompleteWord,
    relativeCategories,
    updateBrandContainer,
    updateBannerContainer,
    updateTitles,
    typeaheadList,
    recentSearches
} from './processors';
import {
    addCustomToFilters,
    updateUrlParameter,
    removeUrlParameter,
    usefulAutocompleteTerms,
    sliceAutocompleteTermsInLevels,
    selectedSortingBy,
    selectedSortingOrder
} from './utils';
import {
    fetchDataEndedEvent,
    fetchTemplateEndedEvent,
    fetchAutocompleteEndedEvent,
    fetchSettingsEndedEvent,
    fetchMaxPriceEndedEvent
} from './events';

/**
 * Loads the given HTML from a URL
 * @param {object} context - The SearchCore instance.
 * @param {string} url - The URL of the HTML template.
 */
export function fetchTemplate(context, url) {
    try {
        fetch(url)
            .then((response) => response.text())
            .then((html) => {
                if(context.consoleDebug) {
                    console.log("Template fetched:", html)
                }
                loadTemplate(context, html);
                fetchTemplateEndedEvent();
            });
    } catch (error) {
        console.error("Error fetching template:", error);
    }
}

/**
 * Fetches data from the API endpoint based on the given query and returns the autocomplete list.
 * @param {object} context - The SearchCore instance.
 * @param query - The search query.
 * @returns {Promise<void>} - The promise representing the fetch operation.
 */
export function fetchAutoCompleteData(context, query) {
    const props = {
        searchPhrase: query,
        live_calls: 1,
        limit: 30,
        from: 0,
        autosuggest: 1,
        autosuggest_limit: 30,
        debug_query_elastic: 0,
        debug_query_elastic_show: 0,
        user: context.userParam,
        locale: context.locale
    }
    return fetch(context.autoCompleteUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify(props),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.code !== 200) {
                return;
            }
            context.selectedAutocompleteTermPerWord = [];
            context.autocompleteWordsPerLevel = [];
            context.measurer.textContent = query;
            context.autocompleteTermsList =  usefulAutocompleteTerms(context, data.result.typeahead, query);
            sliceAutocompleteTermsInLevels(context);
            autocompleteWord(context, query);
            fetchAutocompleteEndedEvent();
        })
        .catch((error) => {
            console.error("Error fetching data:", error)
        });
}

/**
 * Fetches data from the API endpoint based on the given query.
 * @param {object} context - The SearchCore instance.
 * @param {string} query - The search query.
 * @param {boolean} [isGrid=false] - Flag indicating if the results should be fetched for the grid view.
 * @returns {Promise} - The promise representing the fetch operation.
 */
export function fetchData(context, query, isGrid = false) {
    const limit = isGrid ? context.gridProductsPerPage : 4;
    const page = isGrid ? context.page : 0;
    const scope_search = context["scopedSearchDropdown"] ? context["scopedSearchDropdown"].value : "";
    const maxPrice = Math.ceil(context.maxPrice) === context.priceMaxValue && context.priceMinValue === context.minPrice ? 0 : context.priceMaxValue;
    const minPrice =  context.priceMinValue;
    const props = {
        searchPhrase: query,
        filter_category: context.selectedCategory,
        filter2_category: context.selectedPopupCategory,
        live_calls: 1,
        limit: limit,
        from: page,
        facets: 1,
        autosuggest: 0,
        autosuggest_limit: 5,
        debug_query_elastic: 0,
        debug_query_elastic_show: 0,
        segment_id: context.segment_id,
        segment_specialty_id: context.segment_specialty_id,
        scope_brand: context.selectedBrand,
        scope_search_category: scope_search,
        st_save: context.completedSearch,
        uuid: context.uuid,
        filter_min_price: minPrice,
        filter_max_price: maxPrice,
        sort_attribute: selectedSortingBy(context),
        sort_order: selectedSortingOrder(context),
        user: context.userParam,
        locale: context.locale
    };

    return fetch(context.apiEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify(props),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.code !== 200) {
                return;
            }
            context.data = data.result;
            context.maxPrice = Math.ceil(data.result.max_price);
            context.minPrice = data.result.min_price ? Math.floor(data.result.min_price) : 0;
            // TODO: uncomment this when
            //  fetchMaxPrice is removed
            // if (context.priceMaxValue > context.maxPrice) {
            //     context.priceMaxValue = context.maxPrice;
            //     updateUrlParameter(context.urlParams["maxPrice"], context.maxPrice.toString());
            // }
            // else if (context.priceMaxValue === 0) {
            //     context.priceMaxValue = context.maxPrice;
            // }
            // if (+context.priceMinValue !== +context.minPrice) {
            //     context.priceMinValue = context.minPrice;
            //     updateUrlParameter(context.urlParams["minPrice"], context.priceMinValue.toString());
            // }
            context.totalProductCount = data.result.total_count;
            context.currentProductCount = data.result.results.length;
            addCustomToFilters(context);
            updateTitles(context);
            typeaheadList(context);
            relativeCategories(context);
            updateBrandContainer(context);
            updateBannerContainer(context);
            recentSearches(context);
            updateUrlParameter(context.urlParams["q"], query);
            context.completedSearch = 0;
            fetchDataEndedEvent();
        })
        .catch((error) => {
            console.error("Error fetching data:", error)
        });
}

export function fetchSettings(context) {
    const props = {
        user: context.userParam,
        locale: context.locale
    };

    return fetch(context.settingsUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify(props),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.code === 200) {
                context.settings = data.result;
                fetchSettingsEndedEvent(data.result);
            }
        })
        .catch((error) => {
            console.error("Error fetching settings:", error)
        });
}

// TODO: this is a temporary way to get max price, need to be sent in fetchData
export function fetchMaxPrice(context, query, isGrid = false) {
    const limit = isGrid ? context.gridProductsPerPage : 4;
    const page = isGrid ? context.page : 0;
    const scope_search = context["scopedSearchDropdown"] ? context["scopedSearchDropdown"].value : "";
    const props = {
        searchPhrase: query,
        filter_category: context.selectedCategory,
        filter2_category: context.selectedPopupCategory,
        live_calls: 1,
        limit: limit,
        from: page,
        facets: 1,
        autosuggest: 0,
        autosuggest_limit: 5,
        debug_query_elastic: 0,
        debug_query_elastic_show: 0,
        segment_id: context.segment_id,
        segment_specialty_id: context.segment_specialty_id,
        scope_brand: context.selectedBrand,
        scope_search_category: scope_search,
        st_save: context.completedSearch,
        uuid: context.uuid,
        filter_min_price: 0,
        filter_max_price: 0,
        sort_attribute: selectedSortingBy(context),
        sort_order: selectedSortingOrder(context),
        user: context.userParam,
        locale: context.locale
    };

    return fetch(context.apiEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify(props),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.code === 200) {
                context.maxPrice = Math.ceil(data.result.max_price);
                if (context.priceMaxValue > context.maxPrice) {
                    context.priceMaxValue = context.maxPrice;
                    updateUrlParameter(context.urlParams["maxPrice"], context.maxPrice.toString());
                }
                else if (context.priceMaxValue === 0) {
                    context.priceMaxValue = context.maxPrice;
                }
                fetchMaxPriceEndedEvent();
            }
        })
        .catch((error) => {
            console.error("Error fetching data:", error)
        });
}
