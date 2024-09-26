import {
    replacementRegex,
    extractAttributes,
    removeUrlParameter,
    redirectToSearchPage,
    formatPrice, updateUrlParameter,
} from './utils';
import {
    constructElement,
    updateMeasurerPosition,
    createNumericPagination,
    createPrevNextPagination,
    addPriceFilter,
} from './domElements';
import {
    fetchData,
    fetchMaxPrice
} from './fetchers';
import {logPlugin} from "@babel/preset-env/lib/debug";

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
 * @param {string} inputReplacementString - The replacement string pattern.
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
        context["resultsElement"].innerHTML = '<div class="no-results">Δεν βρέθηκαν αποτελέσματα</div>';
    } else {
        context.data.results.forEach((item) => {
            const element = document.createElement("div");
            element.className = "suggested-item";
            element.addEventListener("click", () => {
                const query = context["inputElement"].value;
                context.clearData(false);
                context.fetchData(query, true).then(() => {
                    context.updateGridPage();
                });
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

// TODO: fix this mess and brake the function into smaller parts
/**
 * Updates the grid results page.
 * @param {object} context - The SearchCore instance.
 */
export function updateGridPage(context) {
    context["gridContainerElement"].innerHTML = "";
    if (!context.data || !context["gridContainerElement"]) {
        context["gridContainerElement"].innerHTML = "<div style='text-align: center; font-weight: bold'>Δεν βρέθηκαν αποτελέσματα</div>";
        return;
    }

    clearSuggestedWord(context);

    const gridContent = document.createElement("div");
    gridContent.className = "grid-content";

    const filters = document.createElement("div");
    filters.className = "filters";
    filters.innerHTML = '<div class="title">Φίλτρα</div>';

    const selectedFiltersContainer = document.createElement("div");
    selectedFiltersContainer.className = "selected-filters";
    const selectedFilters = [
        {
            type: context.urlParams["categories"],
            value: context.selectedCategory
        },
        {
            type: context.urlParams["brand"],
            value: context.selectedBrand
        },
        {
            type: context.urlParams["maxPrice"],
            value: context.priceMaxValue === 0 || context.priceMaxValue === context.maxPrice ? null :`${context.priceMaxValue}${context.currency}`
        },
        {
            type: context.urlParams["minPrice"],
            value: context.priceMinValue === 0 ? null :`${context.priceMinValue}${context.currency}`
        },
        {
            type: context.urlParams["popup-category"],
            value: context.selectedPopupCategory
        }
    ];
    selectedFilters.forEach((filter) => {
        if (filter.value) {
            const filterContainer = document.createElement("div");
            filterContainer.className = "selected-filter-item";
            let label = "";
            if (filter.type === context.urlParams["maxPrice"] ) {
                label = "Max Price: ";
            } else if (filter.type === context.urlParams["minPrice"] ) {
                label = "Min Price: ";
            }
            filterContainer.innerHTML = `${label}${filter.value}`;
            const clearFilter = document.createElement("span");
            clearFilter.className = "clear-filter";
            clearFilter.innerHTML = "×";
            clearFilter.addEventListener("click", () => {
                removeUrlParameter(filter.type);
                redirectToSearchPage();
            });
            filterContainer.appendChild(clearFilter);
            selectedFiltersContainer.appendChild(filterContainer);
        }
    });
    filters.appendChild(selectedFiltersContainer);

    context.data.filters.forEach((filter) => {
        const element = document.createElement("div");
        element.className = `filter ${filter.filter_name}`;
        const title = document.createElement("div");
        title.className = "title";
        title.innerHTML = filter.filter_name;
        element.appendChild(title);
        if (filter.filter_name === "price") {
            const query = context["inputElement"].value.trim();
            fetchMaxPrice(context, query, true).then(() => {
                const price = addPriceFilter(context);
                element.appendChild(price);
            })
        } else {
            const items = document.createElement("div");
            items.className = "items";
            const tree = filter.tree && filter.tree[0] ? filter.tree[0] : [];
            const div = createFilterWithChildren(context, tree, filter);
            items.appendChild(div);
            element.appendChild(items);
        }
        filters.appendChild(element);
    });

    const gridItems = document.createElement("div");
    let hasDr = context.data['dr'] !== undefined && context.data['dr']['hits'] !== undefined && context.data['dr']['hits']['hits'].length > 0;
    if (context.data.results.length === 0) {
        gridItems.style.width = "100%";
        gridItems.innerHTML = "<div style='text-align: center; font-weight: bold'>Δεν βρέθηκαν αποτελέσματα</div>";
    } else {
        gridItems.className = "grid-items";
        context.data.results.forEach((item) => {
            const element = document.createElement("div");
            element.className = "grid-item";

            const name = document.createElement("div");
            name.className = "name";
            name.innerHTML = item.name;

            const sku = document.createElement("div");
            sku.className = "sku";
            sku.innerHTML = `SKU: ${item.sku}`;

            const description = document.createElement("div");
            const words = item.desc.split(" ");
            const wordsCount = 25;
            description.className = "description";
            description.innerHTML = words.length > wordsCount ? `${words.slice(0, wordsCount).join(" ")}...` : item.desc;

            const image = document.createElement("img");
            image.className = "image";
            image.src = item.image;
            image.alt = item.name;

            const link = document.createElement("a");
            link.className = "link";
            link.target = "_blank";
            link.href = item.url;
            link.appendChild(image);
            link.appendChild(name);

            const price = document.createElement("b");
            price.className = "price";
            price.innerHTML = formatPrice(item.price);

            element.appendChild(link);
            element.appendChild(sku);
            element.appendChild(description);
            element.appendChild(price);

            if (context.consoleDebug && hasDr) {
                const hitItem = context.data['dr']['hits']['hits'].find(hit => {
                    return hit['_source']['barcode'] === item.barcode;
                })
                if (hitItem && hitItem.sort && hitItem.sort.length > 1) {
                    const debug = document.createElement('div');
                    debug.className = "debug-product-container";
                    debug.style.marginTop = "10px";
                    debug.style.color = "#a8a8a8";
                    debug.innerHTML = `sort[0]: ${hitItem.sort[0]}, sort[1]: ${hitItem.sort[1]}`;
                    element.appendChild(debug);
                }
            }

            if (context.addToCartCallback !== null && context.addToCartCallback !== undefined && typeof context.addToCartCallback === "function") {
                const addToCart = document.createElement("button");
                addToCart.className = "add-to-cart";
                addToCart.innerHTML = "<span>Προσθήκη στο καλάθι</span>";
                addToCart.addEventListener("click", () => {
                    context.addToCartCallback(item);
                })
                element.appendChild(addToCart);
            }

            if (context.addToWishlistCallback !== null && context.addToWishlistCallback !== undefined && typeof context.addToWishlistCallback === "function") {
                const addToWishlist = document.createElement("button");
                addToWishlist.className = "add-to-wishlist";
                addToWishlist.innerHTML = "<span>Προσθήκη στη λίστα επιθυμιών</span>";
                addToWishlist.addEventListener("click", () => {
                    context.addToWishlistCallback(item);
                })
                element.appendChild(addToWishlist);
            }

            if (context.addToCompareCallback !== null && context.addToCompareCallback !== undefined && typeof context.addToCompareCallback === "function") {
                const addToCompare = document.createElement("button");
                addToCompare.className = "add-to-compare";
                addToCompare.innerHTML = "<span>Προσθήκη στη σύγκριση</span>";
                addToCompare.addEventListener("click", () => {
                    context.addToCompareCallback(item);
                })
                element.appendChild(addToCompare);
            }

            gridItems.appendChild(element);
        });
    }

    gridContent.appendChild(filters);
    gridContent.appendChild(gridItems);

    const totals = document.createElement("div");
    totals.className = "totals";

    if (context.paginationType !== "numeric") {
        const pageNumber = document.createElement("span");
        const totalPges = Math.ceil(context.totalProductCount / context.gridProductsPerPage);
        pageNumber.innerHTML = `Σελίδα ${context.gridPage} / ${totalPges}`;
        totals.appendChild(pageNumber);
    }

    const totalResults = document.createElement("span");
    totalResults.innerHTML = `${context.totalProductCount} ${context.totalProductCount === 1 ? "αποτέλεσμα" : "αποτελέσματα"}`;
    totals.appendChild(totalResults);

    const sortingContainer = document.createElement("div");
    sortingContainer.className = "sorting-container";
    const sorting = document.createElement("select");
    sorting.id = "cb_sorting_select";
    sorting.addEventListener("change", (el) => {
        redirectToSearchPage('sort', el.target.value)
    });
    const currentSort = (new URL(window.location)).searchParams.get('sort');
    Object.entries(context.sortByList).forEach(([key, value]) => {
        const option = document.createElement("option");
        option.innerHTML = value.toString();
        option.value = key;
        option.selected = key === currentSort;
        sorting.appendChild(option);
    });
    sortingContainer.appendChild(sorting);
    const order = document.createElement("select");
    order.id = "cb_order_select";
    order.addEventListener("change", (el) => {
        redirectToSearchPage('order', el.target.value)
    });
    const currentOrder = (new URL(window.location)).searchParams.get('order');
    Object.entries(context.sortOrderList).forEach(([key, value]) => {
        const option = document.createElement("option");
        option.innerHTML = value.toString();
        option.value = key;
        option.selected = key === currentOrder;
        order.appendChild(option);
    });
    sortingContainer.appendChild(order);
    totals.appendChild(sortingContainer);

    let pagination;
    if (context.paginationType === "numeric") {
        pagination = createNumericPagination(context);
    } else {
        pagination = createPrevNextPagination(context);
    }

    context["gridContainerElement"].appendChild(totals);
    context["gridContainerElement"].appendChild(gridContent);
    context["gridContainerElement"].appendChild(pagination);
}

export function createFilterWithChildren(context, tree, filter, rootCategory = false) {
    const filterItemContainer = document.createElement("div");
    if (tree.name && tree.name !== "Root Category"){
        const filterItem = document.createElement("div");
        const rootCategoryClass = rootCategory ? ' root-category' : '';
        filterItem.className = `filter-item${rootCategoryClass}`;
        filterItem.innerHTML = `${tree.name} (${tree.doc_count})`;
        filterItem.addEventListener("click", () => {
            if (filter.filter_name === context.urlParams["categories"]) {
                if (rootCategory) {
                    context.selectedPopupCategory = "";
                    removeUrlParameter(context.urlParams["scoped"]);
                    removeUrlParameter(context.urlParams["popup-category"]);
                    redirectToSearchPage(filter.filter_name, tree.name);
                } else {
                    context.selectedCategory = "";
                    context.selectedPopupCategory = tree.name;
                    removeUrlParameter(context.urlParams["categories"]);
                    redirectToSearchPage('popup-category', tree.name);
                }
            } else {
                redirectToSearchPage(filter.filter_name, tree.name);
            }

        });
        filterItemContainer.appendChild(filterItem);
    }

    if (tree.children && tree.children.length) {
        const childrenContainer = document.createElement("div");
        childrenContainer.className = "children-container";
        tree.children.forEach((item) => {
            childrenContainer.appendChild(createFilterWithChildren(context, item, filter, tree.name === "Root Category"));
        });
        filterItemContainer.appendChild(childrenContainer);
    }
    return filterItemContainer;
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
                context["inputElement"].value = item;
                clearData(context, false);
                fetchData(context, item, true).then(() => {
                    updateGridPage(context);
                });
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
                redirectToSearchPage(context.urlParams["popup-category"], item.name);
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
                redirectToSearchPage(context.urlParams["brand"], item.key);
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
    const ad = context.data.ads;
    if (!ad) return;
    const banner = JSON.parse(ad);
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
        let text = element.getAttribute("datatitle");
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
                redirectToSearchPage(context.urlParams["q"], item.search_term);
            });
            list.appendChild(element);
        });
        context["recentSearchListElement"].appendChild(list);
    }
}
