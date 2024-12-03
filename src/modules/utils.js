import el from '../locale/el.js';
import en from '../locale/en.js';
import {forEach} from "lodash";

const translations = {
    el,
    en,
};

/**
 * Validates if a string is a valid URL.
 * @param {string} string - The string to validate.
 * @returns {boolean} - True if valid URL, otherwise false.
 */
export function isValidUrl(string) {
    let urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return urlRegex.test(string);
}

/**
 * Checks if voice search is available and enables it if so.
 * @param {object} context - The SearchCore instance.
 */
export function checkVoiceSearch(context) {
    if (!hasVoiceSearch()) {
        context["voiceSearchElement"].classList.add("disabled");
    }
}

/**
 * Checks if the browser supports voice search.
 * @returns {boolean} - True if voice search is supported, otherwise false.
 */
export function hasVoiceSearch() {
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

/**
 * Creates a regex pattern for the replacement string.
 * @param {string} text - The replacement text.
 * @returns {RegExp} - The regex pattern.
 */
export function replacementRegex(text) {
    return new RegExp(`{{${text}(\\[([^\\]]*)\\])?}}`, "g");
}

/**
 * Extracts attributes from the template based on the given pattern.
 * @param {object} context - The SearchCore instance.
 * @param {string} template - The HTML template.
 * @param {RegExp} pattern - The regex pattern.
 * @returns {Array} - The extracted attributes.
 */
export function extractAttributes(context, template, pattern) {
    let match;
    const results = [];

    while ((match = pattern.exec(template)) !== null) {
        if (match[2] !== undefined && match[2] !== "") {
            const parsedContent = parseContentToObject(context, match[2]);
            if (parsedContent) {
                results.push({matchedString: match[0], attributes: parsedContent});
            } else {
                results.push({matchedString: match[0], attributes: false});
            }
        } else {
            results.push({matchedString: match[0], attributes: false});
        }
    }
    return results;
}

/**
 * Checks if the string contains any Greek characters.
 * @param {string} str - The string to check.
 * @returns {boolean} - True if the string contains Greek characters, otherwise false.
 */
export function containsGreekWord(str) {
    const greekRegex = /[Α-Ωα-ωίϊΐόάέύϋΰήώ]+/;
    return greekRegex.test(str);
}

/**
 * Generates the URL specified in this.searchPageRedirect, preserving all query parameters
 * from the current URL.
 * @param {object} context - The SearchCore instance.
 */
export function redirectToExternalSearchPage(context) {
    if (context.searchPageRedirect && context.searchPageRedirect.trim() !== "") {
        try {
            const currentParams = new URLSearchParams(window.location.search);
            const inputValue = context["inputElement"].value;

            if (currentParams.has('q')) {
                currentParams.set('q', inputValue);
            } else {
                currentParams.append('q', inputValue);
            }
            let redirectUrl;
            if (context.searchPageRedirect.startsWith('/')) {
                redirectUrl = new URL(context.searchPageRedirect, window.location.origin);
            } else {
                redirectUrl = new URL(context.searchPageRedirect);
            }
            currentParams.forEach((value, key) => {
                redirectUrl.searchParams.append(key, value);
            });
            window.location.href = redirectUrl.toString();
        } catch (error) {
            console.error("Invalid URL:", error);
        }
    }
}

/**
 * Checks if the popup is visible.
 * @returns {boolean} - True if the popup is visible, otherwise false.
 */
export function isPopupVisible(context) {
    return context.container.classList.contains("has-results");
}

/**
 * Checks if the grid view is visible.
 * @param {object} context - The SearchCore instance.
 * @returns {boolean} - True if the grid view is visible, otherwise false.
 */
export function isGridVisible(context) {
    return context["gridContainerElement"] && context["gridContainerElement"].innerHTML !== "";
}

export function createAvailableFilters(context, filters) {
    const urlParams = new URLSearchParams(window.location.search);
    filters.map(filter => {
        if (filter.tree && filter.tree[0]) {
            context.availableFilters[filter.filter_name] = urlParams.get(filter.filter_name) || "";
        }
    });
}

export function addCustomToFilters(context) {
    context.data.filters.push({
        filter_name: "price",
        tree: []
    });
}

/**
 * Parses a content string to an object.
 * @param {object} context - The SearchCore instance.
 * @param {string} content - The content string.
 * @returns {Object|null} - The parsed object or null if parsing failed.
 */
export function parseContentToObject(context, content) {
    try {
        const jsonLikeString = `{${content.replace(/(\w+)\s*:\s*/g, '"$1":')}}`;
        const json = JSON.parse(jsonLikeString);
        forEach(json, (value, key) => {
            if (key && key === "placeholder") {
                json["placeholder"] = context.t[value] || value;
            }
        })
        return json;
    } catch (error) {
        console.error("Failed to parse content to object:", error, content);
        return null;
    }
}

/**
 * Removes accents and converts the string to lowercase.
 * @param {string} str - The string to process.
 * @returns {string} - The processed string.
 */
export function removeAccentsAndLowerCase(str) {
    const greekWithAccents = /[\u0300-\u036f]/g;
    const normalizedStr = str.normalize("NFD");
    return normalizedStr.replace(greekWithAccents, "").toLowerCase();
}

/**
 * Updates the URL parameter with the given value.
 * @param {string} param - The URL parameter.
 * @param {string} value - The value to set.
 */
export function updateUrlParameter(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.pushState({path: url.href}, "", url.href);
}

/**
 * Removes the specified URL parameter.
 * @param {number | string} param - The URL parameter to remove.
 */
export function removeUrlParameter(param) {
    const url = new URL(window.location);
    url.searchParams.delete(param);
    window.history.pushState({path: url.href}, "", url.href);
}

/**
 * Redirects to the search page with the given parameter and value.
 * @param {object} context - The SearchCore instance.
 * @param {string} param - The URL parameter.
 * @param {string} value - The value to set.
 */
export function redirectToSearchPage(context, param = '', value = '') {
    let url = new URL(window.location);
    if (context["searchPageRedirect"]) {
        const baseRedirectUrl = new URL(context["searchPageRedirect"], window.location.origin);
        baseRedirectUrl.search = url.search;
        url = baseRedirectUrl;
    }
    if (param && value) {
        url.searchParams.set(param, value);
    }
    window.location.href = url.href;
}

/**
 * Creates the correct format for the price.
 * @param value
 * @returns {string}
 */
export function formatPrice(value) {
    return value.toLocaleString('el-GR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
    });
}

/**
 * Clear all selected filters, url and context values.
 * @param context - The SearchCore instance.
 */
export function clearSelectedFilters(context) {
    removeUrlParameter(context.urlParams["page"]);
    removeUrlParameter(context.urlParams["maxPrice"]);
    removeUrlParameter(context.urlParams["minPrice"]);
    removeUrlParameter(context.urlParams["categories"]);
    removeUrlParameter(context.urlParams["popupCategory"]);
    removeUrlParameter(context.urlParams["brand"]);
    forEach(context.availableFilters, (value, key) => {
        removeUrlParameter(key);
    })
    context.selectedCategory = "";
    context.selectedPopupCategory = "";
    context.selectedBrand = "";
    context.priceMaxValue = 0;
    context.priceMinValue = 0;
    context.page = 0;
}

/**
 * Filter the list of autocomplete terms and keep only the ones that can be used
 * @param context
 * @param list
 * @param query
 * @returns {*}
 */
export function usefulAutocompleteTerms(context, list, query) {
    context.originalAutocompleteWordsList = [];
    context.originalAutocompleteWords = [];
    const value = removeAccentsAndLowerCase(query);
    return list
        .filter(term => {
            const w = removeAccentsAndLowerCase(term);
            if (w.startsWith(value)) {
                context.originalAutocompleteWordsList.push(term);
            }
            return w.startsWith(value);
        })
        .map(term => {
            return removeAccentsAndLowerCase(term);
        });
}

/**
 * Loads locale-specific translations if the file exists.
 * @param {Object} context - The SearchCore instance.
 * @param {string} locale - The locale to load.
 */
export function loadLocaleTranslations(context, locale) {
    context.t = translations[locale] || translations[context.defaultLocale];
    if (context.translations && context.translations[locale] && Object.keys(context.translations).length > 0) {
        context.t = {
            ...context.t,
            ...context.translations[locale]
        }
    }
}

export function sliceAutocompleteTermsInLevels(context) {
    context.autocompleteTermsList.map((term, i) => {
        const value = term.split(' ');
        value.map((word, i) => {
            if(!context.autocompleteWordsPerLevel[i]) {
                context.autocompleteWordsPerLevel[i] = [];
            }
            if (!context.autocompleteWordsPerLevel[i].includes(word)) {
                context.autocompleteWordsPerLevel[i].push(word);
            }
            if(context.selectedAutocompleteTermPerWord[i] === undefined) {
                context.selectedAutocompleteTermPerWord[i] = 0;
            }
        });
        const original = context.originalAutocompleteWordsList[i].split(' ');
        original.map((word, i) => {
            if(!context.originalAutocompleteWords[i]) {
                context.originalAutocompleteWords[i] = [];
            }
            if (!context.originalAutocompleteWords[i].includes(word.toLowerCase())) {
                context.originalAutocompleteWords[i].push(word.toLowerCase());
            }
        })
    })
}

export function selectedSortingBy(context) {
    const el = document.getElementById("cb_sorting_select");
    const currentSort = (new URL(window.location)).searchParams.get('sort');

    let sortKey = '';

    if (currentSort) {
        sortKey = currentSort;
    } else if (el) {
        sortKey = el.value;
    } else {
        sortKey = context.sortByList[0].key
    }

    const sortObj = context.sortByList.find(item => item.key === sortKey);

    if (sortObj.format) {
        sortKey = getSortingAttribute(sortObj.format, sortObj.key);
    }

    return sortKey
}

export function selectedSortingOrder(context) {
    const el = document.getElementById("cb_order_select");
    const currentOrder = (new URL(window.location)).searchParams.get('order');

    const sortEl = document.getElementById("cb_sorting_select");
    const currentSort = (new URL(window.location)).searchParams.get('sort');

    let sortKey = '';

    if (currentSort) {
        sortKey = currentSort;
    } else if (sortEl) {
        sortKey = el.value;
    } else {
        sortKey = context.sortByList[0].key
    }

    const sortObj = context.sortByList.find(item => item.key === sortKey);

    if (sortObj.format) {
        return getSortingOrder(sortObj.format, sortObj.key);
    }

    if (currentOrder) {
        return currentOrder;
    } else if (el) {
        return el.value;
    } else {
        return Object.keys(context.sortOrderList)[0];
    }
}

function parseKeyFromFormat(format, key) {
    const regex = new RegExp(
        format
            .replace("{attribute}", "(?<attribute>.+)")
            .replace("{order}", "(?<order>.+)")
    );

    const match = key.match(regex);
    if (!match) {
        return key;
    }

    const { attribute, order } = match.groups;
    return { attribute, order };
}

function getSortingAttribute(format, key) {
    const { attribute } = parseKeyFromFormat(format, key);
    return attribute;
}

function getSortingOrder(format, key) {
    const { order } = parseKeyFromFormat(format, key);
    return order;
}

export function initPagination(context) {
    context.page = 0;
    context.gridPage = 1;
    removeUrlParameter(context.urlParams["page"]);
}
