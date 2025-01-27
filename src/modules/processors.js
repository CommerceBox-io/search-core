import {
    replacementRegex,
    extractAttributes,
    removeUrlParameter,
    redirectToSearchPage,
    formatPrice,
    initPagination,
} from './utils';
import {
    constructElement,
    updateMeasurerPosition,
    createNumericPagination,
    createPrevNextPagination,
    addPriceFilter,
    createNumericPaginationForShopify
} from './domElements';
import {
    fetchData,
    fetchMaxPrice,
    fetchSettings
} from './fetchers';
import {
    closePopupEvent,
    gridLoadedEvent
} from './events';
import {
    renderGrid
} from './templates';
import {forEach} from "lodash";

/**
 * Processes a single element by replacing its placeholder with an actual element.
 * @param {object} context - The SearchCore instance.
 * @param {string} selector - The placeholder selector.
 * @param {string} [type="div"] - The type of HTML element to create.
 * @returns {string} - The ID of the processed element.
 */
export function processElement(context, selector, type = "div") {
    const replacementString = replacementRegex(selector);
    let processedTemplate = processTemplate(context, context.container.innerHTML, replacementString, type);
    context.container.innerHTML = processedTemplate.template;
    return processedTemplate.ids[0];
}

/**
 * Processes the elements mapping to set the appropriate properties.
 * @param {object} context - The SearchCore instance.
 */
export function processElements(context) {
    context.elementsMapping.forEach((element) => {
        context.placeholders.push({
            el: element.name,
            id: processElement(context, element.replacement, element.type),
        });
    });

    context.placeholders.forEach((placeholder) => {
        if (placeholder.el) {
            context[placeholder.el] = context.container.querySelector(`[${placeholder.id}]`);
        }
    });
}

/**
 * Processes the template and replaces placeholders with actual elements.
 * @param {object} context - The SearchCore instance.
 * @param {string} template - The HTML template.
 * @param {RegExp} inputReplacementString - The replacement string pattern.
 * @param {string} [elementType="div"] - The type of HTML element to create.
 * @returns {Object} - The processed template and element IDs.
 */
export function processTemplate(context, template, inputReplacementString, elementType = "div") {
    const replacements = extractAttributes(context, template, inputReplacementString);
    let processedTemplate = template;
    const ids = [];
    replacements.forEach((replacement) => {
        if (replacement.matchedString) {
            const element = constructElement(elementType, replacement.attributes);
            ids.push(element.identifier);
            processedTemplate = processedTemplate.replace(replacement.matchedString, element.el.outerHTML);
        }
    });

    return {template: processedTemplate, ids: ids};
}

/**
 * Updates the suggested word based on the query.
 * @param {object} context - The SearchCore instance.
 * @param {string} query - The search query.
 */
export function autocompleteWord(context, query) {
    context.suggestedWord = "";
    const selectedWords = [];
    const wordsCount = query.split(' ').length

    context.autocompleteWordsPerLevel.map((item, i) => {
        if(i < wordsCount) {
            const levelIndex = context.selectedAutocompleteTermPerWord[i];
            const nextLevelIndex = context.selectedAutocompleteTermPerWord[i + 1];
            if (i === 0) {
                selectedWords.push(context.originalAutocompleteWords[i][levelIndex]);
            }
            if (context.autocompleteWordsPerLevel[i + 1]) {
                selectedWords.push(context.originalAutocompleteWords[i + 1][nextLevelIndex]);
            }
        }
    });

    context.suggestedWordSliced = selectedWords.join(" ").slice(query.length);
    if (context["inputElement"].value.slice(-1) !== " ") {
        context.suggestedWordSliced = context.suggestedWordSliced.replace(" ", "&nbsp;");
    }
    context.suggestedWord = query + context.suggestedWordSliced;
    context["suggestionElement"].innerHTML = context.suggestedWordSliced;
    const q = context["inputElement"].value;
    updateMeasurerPosition(context, q);
    const textWidth = context.measurer.offsetLeft + context.measurer.offsetWidth + 1;
    context["suggestionElement"].style.left = `${textWidth}px`;
}

/**
 * Updates the search popup results.
 * @param {object} context - The SearchCore instance.
 */
export function updatePopupResults(context) {
    context["resultsElement"].innerHTML = "";
    context["resultsElement"].classList.remove("show");
    context.container.classList.remove("has-results", "no-results");

    if (!context.data || !context.data.results || context.data.results.length === 0) {
        context.container.classList.add("no-results");
        context["resultsElement"].innerHTML = `<div class="no-results"> ${context.t["no_results_found"]}</div>`;
    } else {
        context.data.results.forEach((item) => {
            const element = document.createElement("div");
            element.className = "suggested-item";
            element.addEventListener("click", () => {
                window.location.href = item.url;
            });

            const leftColumn = document.createElement("div");
            leftColumn.className = "left-column";
            const image = document.createElement("img");
            image.src = item.image;
            image.alt = item.name;
            leftColumn.appendChild(image);

            const rightColumn = document.createElement("div");
            rightColumn.className = "right-column";
            const name = document.createElement("div");
            name.className = "name";
            name.innerHTML = item.name_high && item.name_high !== "non highlighted name" ? item.name_high : item.name;
            rightColumn.appendChild(name);

            const sku = document.createElement("div");
            sku.className = "sku";
            sku.innerHTML = item.sku;
            rightColumn.appendChild(sku);

            const price = document.createElement("div");
            price.className = "price";
            price.innerHTML = item.price;
            rightColumn.appendChild(price);

            element.appendChild(leftColumn);
            element.appendChild(rightColumn);
            context["resultsElement"].appendChild(element);
        });
    }

    if (context["debugQueryButton"]) {
        context["debugQueryButton"].innerHTML = "Debug Query";
        context["debugQueryButton"].className = "debug-query-button";
    }

    context["resultsElement"].classList.add("show");
    context.container.classList.add("has-results");
}

/**
 * Updates the grid results page.
 * @param {object} context - The SearchCore instance.
 */
export function updateGridPage(context) {
    const query = context["inputElement"].value.trim();
    fetchMaxPrice(context, query, true).then(() => {
        renderGrid(context)
        gridLoadedEvent();
    });
}

/**
 * Clears the search data and input field.
 * @param {object} context - The SearchCore instance.
 * @param {boolean} [clearInput=true] - Flag indicating if the input field should be cleared.
 */
export function clearData(context, clearInput = true) {
    if (clearInput) {
        context["inputElement"].value = "";
    }
    context["resultsElement"].innerHTML = "";
    context["resultsElement"].classList.remove("show");
    context.container.classList.remove("has-results");
    context.measurer.textContent = "";
    context.suggestedWord = "";
    context["suggestionElement"].innerHTML = "";
    context["inputElement"].focus();
}

/**
 * Clears the suggested word and resets the measurer.
 * @param {object} context - The SearchCore instance.
 */
export function clearSuggestedWord(context) {
    context.measurer.textContent = "";
    context.suggestedWord = "";
    context["suggestionElement"].innerHTML = "";
}

/**
 * Updates the typeahead list with suggestions.
 * @param {object} context - The SearchCore instance.
 */
export function typeaheadList(context) {
    const list = context.data.saved_searches_related;
    if (context["typeaheadContainerElement"] && list.length > 0) {
        context["typeaheadContainerElement"].innerHTML = "";
        list.forEach((item) => {
            const element = document.createElement("div");
            element.className = "typeahead-item";
            element.innerHTML = item.replace("&", "", 1);
            element.addEventListener("click", () => {
                clearData(context, false);
                initPagination(context);
                redirectToSearchPage(context, context.urlParams["q"], item);
            });
            context["typeaheadContainerElement"].appendChild(element);
        });
    }
}

/**
 * Updates the relative categories container with the fetched categories.
 * @param {object} context - The SearchCore instance.
 */
export function relativeCategories(context) {
    const categories = context.data.relative_cat;
    if (context["categoriesContainerElement"] && categories.length > 0) {
        let list = context["categoriesContainerElement"].querySelector(".category-items");
        if (!list) {
            list = document.createElement("div");
            list.className = "category-items";
        }
        list.innerHTML = "";
        categories.forEach((item) => {
            const element = document.createElement("div");
            element.textContent = `${item.name} (${item.doc_count})`;
            element.addEventListener("click", () => {
                removeUrlParameter(context.urlParams["categories"]);
                initPagination(context);
                redirectToSearchPage(context, context.urlParams["popupCategory"], item.name);
            });
            list.appendChild(element);
        });
        context["categoriesContainerElement"].appendChild(list);
    } else if (context["categoriesContainerElement"] && categories.length === 0) {
        const list = context["categoriesContainerElement"].querySelector(".category-items");
        if (list) {
            list.innerHTML = ''
        }
    }
}

/**
 * Updates the brands container with the fetched brands.
 * @param {object} context - The SearchCore instance.
 */
export function updateBrandContainer(context) {
    const brands = context.data.rel_brands;
    if (context["brandsContainerElement"] && brands.length > 0) {
        let list = context["brandsContainerElement"].querySelector(".brands-items");
        if (!list) {
            list = document.createElement("div");
            list.className = "brands-items";
        }
        list.innerHTML = "";
        brands.forEach((item) => {
            const element = document.createElement("div");
            element.textContent = `${item.key} (${item.doc_count})`;
            element.addEventListener("click", () => {
                initPagination(context);
                redirectToSearchPage(context, context.urlParams["brand"], item.key);
            });
            list.appendChild(element);
        });
        context["brandsContainerElement"].appendChild(list);
    }
}

/**
 * Updates the banner container with the fetched brands.
 * @param {object} context - The SearchCore instance.
 */
export function updateBannerContainer(context) {
    const banner = context.data.ads;
    if (!banner || !Object.keys(banner).length) return;
    if (context["bannerContainerElement"] && banner["image"]) {
        context["bannerContainerElement"].innerHTML = "";
        const a = document.createElement("a");
        a.href = banner.action;
        a.target = "_blank";
        const img = document.createElement("img");
        img.src = banner.image;
        a.appendChild(img);
        context["bannerContainerElement"].appendChild(a);
    }
}

/**
 * Updates the titles with the current and total product count.
 * @param {object} context - The SearchCore instance.
 */
export function updateTitles(context) {
    const elementsWithTitles = context.container.querySelectorAll("[datatitle]");
    const replace = {
        "{currentProductCount}": context.currentProductCount,
        "{totalProductCount}": context.totalProductCount,
    };

    elementsWithTitles.forEach((element) => {
        let text = context.t[element.getAttribute("datatitle")] || element.getAttribute("datatitle");
        for (const [key, value] of Object.entries(replace)) {
            text = text.replace(new RegExp(key, "g"), value);
        }
        let title = element.querySelector(".title");
        if (!title) {
            title = document.createElement("div");
            title.className = "title";
            element.appendChild(title);
        }
        title.textContent = text;
    });
}

/**
 * Updates the recent searches container with the fetched terms.
 * @param {object} context - The SearchCore instance.
 */
export function recentSearches(context) {
    const terms = context.data.saved_searches;
    if (!terms) return;

    if (context["recentSearchListElement"] && terms.length > 0) {
        let list = context["recentSearchListElement"].querySelector(".recent-searches-items");
        if (!list) {
            list = document.createElement("div");
            list.className = "recent-searches-items";
        }
        list.innerHTML = "";
        terms.forEach((item) => {
            const element = document.createElement("div");
            element.textContent = `${item.search_term}`;
            element.addEventListener("click", () => {
                initPagination(context);
                redirectToSearchPage(context, context.urlParams["q"], item.search_term);
            });
            list.appendChild(element);
        });
        context["recentSearchListElement"].appendChild(list);
    }
}

/**
 * Get the external settings.
 * @param {object} context - The SearchCore instance.
 */
export async function getSettings(context) {
    await fetchSettings(context);
}
