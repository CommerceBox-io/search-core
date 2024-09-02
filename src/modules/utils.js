import {logPlugin} from "@babel/preset-env/lib/debug";

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
            const parsedContent = parseContentToObject(match[2]);
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
    if (context.searchPageRedirect && contextcontext.searchPageRedirect.trim() !== "") {
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

// TODO: This should be temporary until brand is correctly implemented in filters
export function addCustomToFilters(context) {
    context.data.filters.push({
        filter_name: context.urlParams["brand"],
        tree: [
            {
                children: context.data.rel_brands.map(brand => {
                    return {
                        name: brand.key,
                        doc_count: brand.doc_count
                    }
                })
            }
        ]
    });
    context.data.filters.push({
        filter_name: "price",
        tree: []
    });
}

/**
 * Parses a content string to an object.
 * @param {string} content - The content string.
 * @returns {Object|null} - The parsed object or null if parsing failed.
 */
export function parseContentToObject(content) {
    try {
        const jsonLikeString = `{${content.replace(/(\w+)\s*:\s*/g, '"$1":')}}`;
        return JSON.parse(jsonLikeString);
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
 * @param {string} param - The URL parameter to remove.
 */
export function removeUrlParameter(param) {
    const url = new URL(window.location);
    url.searchParams.delete(param);
    window.history.pushState({path: url.href}, "", url.href);
}

/**
 * Redirects to the search page with the given parameter and value.
 * @param {string} param - The URL parameter.
 * @param {string} value - The value to set.
 */
export function redirectToSearchPage(param = '', value= '') {
    const url = new URL(window.location);
    if (param && value) {
        url.searchParams.set(param, value);
    }
    window.location = url.href;
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
    removeUrlParameter(context.urlParams["max-price"]);
    removeUrlParameter(context.urlParams["min-price"]);
    removeUrlParameter(context.urlParams["categories"]);
    removeUrlParameter(context.urlParams["popup-category"]);
    removeUrlParameter(context.urlParams["brand"]);
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
    if (currentSort) {
        return currentSort;
    } else if (el) {
        return el.value;
    } else {
        return Object.keys(context.sortByList)[0];
    }
}

export function selectedSortingOrder(context) {
    const el = document.getElementById("cb_order_select");
    const currentOrder = (new URL(window.location)).searchParams.get('order');
    if (currentOrder) {
        return currentOrder;
    } else if (el) {
        return el.value;
    } else {
        return Object.keys(context.sortOrderList)[0];
    }
}
