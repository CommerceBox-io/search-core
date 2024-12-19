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
} from './events'
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
        if (context.platform === "shopify") {
            generateShopifyGrid(context);
        } else {
            generateGrid(context);
        }
        gridLoadedEvent();
    });
}

// TODO: fix this mess and brake the function into smaller parts
/**
 * Updates the grid results page with a default layout.
 * @param {object} context - The SearchCore instance.
 */
export function generateGrid(context) {
    if (!context["gridContainerElement"]) {
        return;
    }
    context["gridContainerElement"].innerHTML = "";
    if (!context.data || !context["gridContainerElement"]) {
        context["gridContainerElement"].innerHTML = `<div style='text-align: center; font-weight: bold'>${context.t["no_results_found"]}</div>`;
        return;
    }

    clearSuggestedWord(context);

    const gridContent = document.createElement("div");
    gridContent.className = "grid-content";

    const filters = document.createElement("div");
    filters.className = "filters";
    filters.innerHTML = `<div class="title">${context.t["filters"]}</div>`;

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
            type: context.urlParams["popupCategory"],
            value: context.selectedPopupCategory
        }
    ];

    forEach(context.availableFilters, (value, key) => {
        if (value) {
            selectedFilters.push({
                type: key,
                value: value,
                label: value
            })
        }
    })

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
                initPagination(context);
                redirectToSearchPage(context);
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
        gridItems.innerHTML = `<div style='text-align: center; font-weight: bold'>${context.t["no_results_found"]}</div>`;
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
                addToCart.innerHTML = `<span>${context.t["add_to_cart"]}</span>`;
                addToCart.addEventListener("click", () => {
                    context.addToCartCallback(item);
                })
                element.appendChild(addToCart);
            }

            if (context.addToWishlistCallback !== null && context.addToWishlistCallback !== undefined && typeof context.addToWishlistCallback === "function") {
                const addToWishlist = document.createElement("button");
                addToWishlist.className = "add-to-wishlist";
                addToWishlist.innerHTML = `<span>${context.t["add_to_wishlist"]}</span>`;
                addToWishlist.addEventListener("click", () => {
                    context.addToWishlistCallback(item);
                })
                element.appendChild(addToWishlist);
            }

            if (context.addToCompareCallback !== null && context.addToCompareCallback !== undefined && typeof context.addToCompareCallback === "function") {
                const addToCompare = document.createElement("button");
                addToCompare.className = "add-to-compare";
                addToCompare.innerHTML = `<span>${context.t["add_to_compare"]}</span>`;
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
        pageNumber.innerHTML = `${context.t["page"]} ${context.gridPage} / ${totalPges}`;
        totals.appendChild(pageNumber);
    }

    const totalResults = document.createElement("span");
    totalResults.innerHTML = `${context.totalProductCount} ${context.totalProductCount === 1 ? context.t["result_singular"] :  context.t["result_plural"]}`;
    totals.appendChild(totalResults);

    const sortingContainer = document.createElement("div");
    sortingContainer.className = "sorting-container";
    const sorting = document.createElement("select");
    sorting.id = "cb_sorting_select";
    sorting.addEventListener("change", (el) => {
        initPagination(context);
        redirectToSearchPage(context, 'sort', el.target.value)
    });
    const currentSort = (new URL(window.location)).searchParams.get('sort');
    Object.entries(context.sortByList).forEach(([key, sort]) => {
        const option = document.createElement("option");
        option.innerHTML = sort.value.toString();
        option.value = sort.key;
        option.selected = sort.key === currentSort;
        sorting.appendChild(option);
    });
    sortingContainer.appendChild(sorting);
    const order = document.createElement("select");
    order.id = "cb_order_select";
    order.addEventListener("change", (el) => {
        initPagination(context);
        redirectToSearchPage(context, 'order', el.target.value)
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

/**
 * Updates the grid results page for Shopify.
 * @param {object} context - The SearchCore instance.
 */
export function generateShopifyGrid(context) {
    context["gridContainerElement"].innerHTML = "";
    const data = context.data ? context.data["results"] : [];
    const productsGrid = renderProductGrid(context, data);
    context["gridContainerElement"].appendChild(productsGrid);
}

function renderProductFilters(filters, context) {
    const filterContainer = document.createElement("facetfiltersformmobile");
    filterContainer.className = "facetfiltersformmobile";
    filterContainer.innerHTML = `
    <div class="side-panel facet-drawer" id="Facet-Drawer">
      <div class="side-panel-inner">
        <div class="side-panel-header">
          <div>
            <h4 class="body-font">${context.t["filters"]} <span class="thb-filter-count mobile-filter-count body-font">
              <span class="facets__label">${context.totalProductCount} ${context.t["result_plural"]} </span>
              <span class="loading-overlay">
                <svg aria-hidden="true" focusable="false" role="presentation" class="spinner" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
                  <circle class="spinner-path" fill="none" stroke-width="6" cx="33" cy="33" r="30" stroke="var(--color-accent)"></circle>
                </svg>
              </span>
            </span></h4>
            <side-panel-close class="side-panel-close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 1L1 13M13 13L1 1" stroke="var(--color-body)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </side-panel-close>
          </div>
        </div>
        <div class="side-panel-content">
          <facet-filters-form class="facets">
            <div id="FacetFiltersFormMobile" class="facets__mobile_form">
              <!-- Price Filter Placeholder -->
              <collapsible-row data-index="1">
                <details class="thb-filter js-filter" data-index="2" open="">
                  <summary class="thb-filter-title"><span></span>${context.t["price"]}</summary>
                  <div class="thb-filter-content collapsible__content">
                    <div id="price-filter-placeholder"></div>
                  </div>
                </details>
              </collapsible-row>
              <!-- Rest of the Filter -->
               <div id="filters-placeholder"></div>
            </div>
          </facet-filters-form>
        </div>
      </div>
    </div>
    `;

    const priceFilterElement = addPriceFilter(context);
    const priceFilterPlaceholder = filterContainer.querySelector("#price-filter-placeholder");
    priceFilterPlaceholder.replaceWith(priceFilterElement);

    const filtersContainer = createDynamicFilters(context, filters)
    const filtersPlaceholder = filterContainer.querySelector("#filters-placeholder");
    filtersPlaceholder.replaceWith(filtersContainer);

    return filterContainer;
}

function createDynamicFilters(context, filters) {
    // Create a container for all filters
    const filtersContainer = document.createElement('div');
    filtersContainer.id = 'filters-container';

    // Iterate through the filters array to create dynamic collapsible rows
    filters.forEach((filter, index) => {
        if (!filter.tree || !filter.tree[0]) {
            return;
        }
        const tree = filter.tree[0];

        // Create the collapsible row
        const collapsibleRow = document.createElement('collapsible-row');
        collapsibleRow.setAttribute('data-index', index);

        // Create the details element for the collapsible filter
        const detailsElement = document.createElement('details');
        detailsElement.classList.add('thb-filter', 'js-filter');
        detailsElement.setAttribute('data-index', index);
        detailsElement.setAttribute('open', '');

        // Create the summary (title) for the collapsible filter
        const summaryElement = document.createElement('summary');
        summaryElement.classList.add('thb-filter-title');
        summaryElement.innerHTML = `<span></span>${context.t[filter.filter_name] || filter.filter_name}`;

        // Create the content area inside the collapsible filter
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('thb-filter-content', 'collapsible__content');

        // Create a placeholder for the filter content
        const placeholderDiv = document.createElement('div');
        placeholderDiv.id = `${filter.filter_name}-filter-placeholder`;

        // Append the placeholder to the content area
        contentDiv.appendChild(placeholderDiv);

        // Append the summary and content to the details element
        detailsElement.appendChild(summaryElement);
        detailsElement.appendChild(contentDiv);

        // Append the details element to the collapsible row
        collapsibleRow.appendChild(detailsElement);

        // Generate filter content dynamically and replace the placeholder
        const filterElement = createCollapsibleCheckboxFilter(context, tree, filter);
        placeholderDiv.replaceWith(filterElement);

        // Append the collapsible row to the filters container
        filtersContainer.appendChild(collapsibleRow);
    });

    // Return the completed filters container
    return filtersContainer;
}


export function createSortAndCount(context) {
    const sortCountContainer = document.createElement("div");
    sortCountContainer.className = "thb-filter-sort-count";

    const sortContainer = document.createElement("div");
    sortContainer.className = "thb-filter-sort";

    const selectWrapper = document.createElement("div");
    selectWrapper.className = "select";

    const sortLabel = document.createElement("label");
    sortLabel.htmlFor = "SortByBar";
    sortLabel.className = "visually-hidden";
    sortLabel.textContent = context.t["sort_by"];

    const sortSelect = document.createElement("select");
    sortSelect.name = "sort_by";
    sortSelect.className = "facet-filters__sort select__select resize-select";
    sortSelect.id = "SortByBar";
    sortSelect.setAttribute("aria-describedby", "a11y-refresh-page-message");
    sortSelect.style.width = "94px";

    const currentSort = new URL(window.location).searchParams.get("sort");
    Object.entries(context.sortByList).forEach(([key, sort]) => {
        const option = document.createElement("option");
        option.value = sort.key;
        option.textContent = sort.value;
        option.selected = sort.key === currentSort;
        sortSelect.appendChild(option);
    });

    sortSelect.addEventListener("change", (event) => {
        initPagination(context);
        redirectToSearchPage(context, "sort", event.target.value);
    });

    const selectArrow = document.createElement("div");
    selectArrow.className = "select-arrow";

    const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrowSvg.setAttribute("width", "8");
    arrowSvg.setAttribute("height", "6");
    arrowSvg.setAttribute("viewBox", "0 0 8 6");
    arrowSvg.setAttribute("fill", "none");

    const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowPath.setAttribute("d", "M6.75 1.5L3.75 4.5L0.75 1.5");
    arrowPath.setAttribute("stroke", "var(--color-body)");
    arrowPath.setAttribute("stroke-width", "1.1");
    arrowPath.setAttribute("stroke-linecap", "round");
    arrowPath.setAttribute("stroke-linejoin", "round");

    arrowSvg.appendChild(arrowPath);
    selectArrow.appendChild(arrowSvg);

    selectWrapper.appendChild(sortLabel);
    selectWrapper.appendChild(sortSelect);
    selectWrapper.appendChild(selectArrow);
    sortContainer.appendChild(selectWrapper);

    const countContainer = document.createElement("div");
    countContainer.className = "thb-filter-count";
    countContainer.id = "ProductCount";

    const countLabel = document.createElement("span");
    countLabel.className = "facets__label";
    countLabel.textContent = `${context.totalProductCount} αποτελέσματα`;

    const loadingOverlay = document.createElement("span");
    loadingOverlay.className = "loading-overlay";

    const spinnerSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    spinnerSvg.setAttribute("aria-hidden", "true");
    spinnerSvg.setAttribute("focusable", "false");
    spinnerSvg.setAttribute("role", "presentation");
    spinnerSvg.setAttribute("viewBox", "0 0 66 66");

    const spinnerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    spinnerCircle.setAttribute("fill", "none");
    spinnerCircle.setAttribute("stroke-width", "6");
    spinnerCircle.setAttribute("cx", "33");
    spinnerCircle.setAttribute("cy", "33");
    spinnerCircle.setAttribute("r", "30");
    spinnerCircle.setAttribute("stroke", "var(--color-accent)");

    spinnerSvg.appendChild(spinnerCircle);
    loadingOverlay.appendChild(spinnerSvg);

    countContainer.appendChild(countLabel);
    countContainer.appendChild(loadingOverlay);

    sortCountContainer.appendChild(sortContainer);
    sortCountContainer.appendChild(countContainer);

    return sortCountContainer;
}


export function createCollapsibleCheckboxFilter(context, tree, filter) {
    const placeholder = document.createElement("div");
    placeholder.id = `${filter.filter_name}-filter-content`;

    function createCheckboxList(treeData) {
        const rootCategory = treeData.name === "Root Category";
        const ul = document.createElement("ul");
        ul.className = `list-${filter.filter_name}`;
        if (!treeData.children) {
            return ul;
        }
        treeData.children.forEach((item) => {
            const li = document.createElement("li");

            const parentContainer = document.createElement("div");
            parentContainer.className = "parent-container";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = `filter.${filter.filter_name}`;
            checkbox.value = item.name;
            checkbox.id = `Filter-Mobile-${filter.filter_name}-${item.name}`;

            const urlParams = new URLSearchParams(window.location.search);
            const filterInUrl = urlParams.get(filter.filter_name);
            const popupCategoryInUrl = urlParams.get(context.urlParams["popupCategory"]);
            if ((filterInUrl && item.name === filterInUrl) || (popupCategoryInUrl && item.name === popupCategoryInUrl)) {
                checkbox.checked = true;
            }
            checkbox.addEventListener("click", (event) => {
                event.stopPropagation();
                if (checkbox.checked) {
                    console.log(filter.filter_name === context.urlParams["categories"])
                    if (filter.filter_name === context.urlParams["categories"]) {
                        if (rootCategory) {
                            context.selectedPopupCategory = "";
                            removeUrlParameter(context.urlParams["scoped"]);
                            removeUrlParameter(context.urlParams["popupCategory"]);
                            initPagination(context);
                            redirectToSearchPage(context, filter.filter_name, item.name);
                        } else {
                            context.selectedCategory = "";
                            context.selectedPopupCategory = item.name;
                            removeUrlParameter(context.urlParams["categories"]);
                            initPagination(context);
                            redirectToSearchPage(context, context.urlParams["popupCategory"], item.name);
                        }
                    } else {
                        console.log(filter.filter_name, item.name);
                        initPagination(context);
                        redirectToSearchPage(context, filter.filter_name, item.name);
                    }
                } else {
                    if (filter.filter_name === context.urlParams["categories"] && !rootCategory) {
                        removeUrlParameter(context.urlParams["popupCategory"]);
                    } else {
                        removeUrlParameter(filter.filter_name);
                    }
                    initPagination(context);
                    redirectToSearchPage(context);
                }
            });

            const label = document.createElement("label");
            label.className = "facet-checkbox";
            label.htmlFor = checkbox.id;
            label.textContent = ` ${item.name} (${item.doc_count || 0}) `;
            label.style = `--bg-color: ${item.color || "#ccc"};`;
            label.dataset.tooltip = `${item.name} (${item.doc_count || 0})`;

            parentContainer.appendChild(checkbox);
            parentContainer.appendChild(label);
            li.appendChild(parentContainer);

            // Add nested categories if present
            if (item.children && item.children.length > 0) {
                const childrenContainer = document.createElement("div");
                childrenContainer.className = "children-container";
                childrenContainer.appendChild(createCheckboxList(item));
                li.appendChild(childrenContainer);
            }

            ul.appendChild(li);
        });

        return ul;
    }

    const scrollShadow = document.createElement("scroll-shadow");
    scrollShadow.appendChild(createCheckboxList(tree));
    placeholder.appendChild(scrollShadow);

    return placeholder;
}

/**
 *  Function to extract the product slug from the URL
 * @param {string} url - The URL to extract the slug from
 * @returns {string|null} - The product slug or null if not found
*/
function getProductSlug(url) {
    try {
        const parsedUrl = new URL(url);
        const parts = parsedUrl.pathname.split('/');
        const productIndex = parts.indexOf('products');
        if (productIndex !== -1 && parts[productIndex + 1]) {
            return parts[productIndex + 1];
        }
        return null; // Return null if the slug is not found
    } catch (error) {
        console.error('Invalid URL:', error);
        return null;
    }
}

function renderProductGrid(context, data) {
    const container = document.createElement("div");
    container.id = "shopify-section-template main-search";
    container.className = "shopify-section";
    container.innerHTML = `
      <div class="collection-banner--description">
         <p>${context.t["results_found"]} ${context.totalProductCount} ${context.t["results_for"]} “${context["inputElement"].value.trim()}”</p>
      </div>  
      <div id="filters-container"></div>
      <div class="row full-width-row">
        <div class="small-12 columns">
          <div class="collection-container section-spacing-bottom">
            <div id="ProductGridContainer">
              <div class="sidebar-container facets--drawer results--">
                <div>
                    <facet-filters-form class="facets--bar">
                        <div id="FacetFiltersForm-bar" class="facets__form">
                    <div>
                      <a href="#SideFilters" class="facets-toggle" id="Facets-Toggle">
                          <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M6.55372 7.58824L1 7.58825M11.1818 7.58825L8.40496 7.58824M2.85124 2.41177L1 2.41173M11.1818 2.41173L4.70248 2.41177M4.70248 1V3.82352M8.40496 9V6.17648" stroke="var(--color-accent)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"></path>
                          </svg>
                          ${context.t["filters"]}
                      </a>
                    </div>
                    <div id="sort-count-container">
                    <!-- Content will be conditionally added here -->
                    </div>
                    </div>
                        <div id="filter-remove-container"></div>
                    </facet-filters-form>
                    <div id="conditional-content">
                        <!-- Content will be conditionally added here -->
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    `;
    const conditionalContent = container.querySelector("#conditional-content");

    if (data.length === 0) {
        conditionalContent.innerHTML = `
           <div class="collection-empty">
            <svg width="171" height="137" viewBox="0 0 171 137" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M77.5235 47.358C77.7471 47.4705 77.9987 47.5268 78.2503 47.5268C79.0052 47.5268 79.6761 47.0766 79.9837 46.4013C81.2417 43.5314 82.975 40.9148 85.1556 38.692C85.8545 37.9323 85.8266 36.7506 85.0718 36.0472C84.3169 35.3438 83.1428 35.3719 82.4438 36.1316C79.9837 38.692 77.9708 41.6744 76.545 44.9382C76.3493 45.3884 76.3493 45.923 76.517 46.3732C76.7127 46.7952 77.0762 47.161 77.5235 47.358Z" fill="var(--color-accent)"></path>
                <path d="M91.5298 32.9522C91.8933 32.9522 92.2288 32.8397 92.5363 32.6708C95.2481 30.9545 98.1276 29.5196 101.119 28.366C102.069 28.0002 102.545 26.9029 102.181 25.9181C101.818 24.9615 100.728 24.4832 99.7491 24.849C96.5341 26.087 93.4589 27.6344 90.5514 29.4914C89.8524 29.9416 89.517 30.7857 89.7406 31.6017C89.9643 32.4176 90.6911 32.9522 91.5298 32.9522Z" fill="var(--color-accent)"></path>
                <path d="M83.2266 71.8927C82.8631 72.2022 82.6115 72.6805 82.5836 73.187C82.5556 73.6935 82.6954 74.1718 83.0309 74.5657C85.2394 77.1823 87.6996 79.6021 90.2996 81.8248C90.6351 82.1343 91.0544 82.275 91.5017 82.275C92.0608 82.275 92.5641 82.0218 92.9554 81.5997C93.6264 80.8119 93.5146 79.6021 92.7318 78.9268C90.2716 76.8447 87.9792 74.5657 85.8824 72.1178C85.1835 71.33 84.0093 71.2175 83.2266 71.8927Z" fill="var(--color-accent)"></path>
                <path d="M73.7214 131.485C70.9258 130.36 68.4097 128.615 66.3409 126.393C65.642 125.633 64.4678 125.549 63.713 126.252C62.9582 126.955 62.8743 128.137 63.5732 128.925C66.0054 131.626 69.0247 133.708 72.3795 135.059C72.6032 135.143 72.8268 135.171 73.0784 135.171C73.973 135.199 74.7558 134.552 74.9515 133.652C75.1193 132.751 74.644 131.879 73.8053 131.542L73.7214 131.485Z" fill="var(--color-accent)"></path>
                <path d="M92.0051 131.851C89.0976 132.751 86.0783 133.23 83.059 133.23H82.7515C81.773 133.314 81.0461 134.13 81.0461 135.115C81.0461 136.1 81.773 136.916 82.7515 137H83.087C86.4977 136.972 89.8804 136.437 93.1234 135.424C94.1018 135.115 94.661 134.074 94.3535 133.089C94.0459 132.104 93.0115 131.542 92.0331 131.851H92.0051Z" fill="var(--color-accent)"></path>
                <path d="M105.704 96.2024C106.095 96.2024 106.486 96.0618 106.822 95.8367C107.213 95.5553 107.493 95.1051 107.577 94.6268C107.661 94.1485 107.521 93.642 107.241 93.22C105.2 90.4345 102.908 87.8178 100.392 85.4544C99.6371 84.751 98.4629 84.7791 97.764 85.5107C97.0651 86.2704 97.0931 87.4521 97.8199 88.1555C100.168 90.3782 102.293 92.7698 104.222 95.3584C104.557 95.8929 105.117 96.2024 105.704 96.2024Z" fill="var(--color-accent)"></path>
                <path d="M78.3343 55.2924C78.2784 54.2513 77.4117 53.4635 76.3774 53.4916C75.343 53.5479 74.5602 54.4201 74.5881 55.4612C74.7838 59.0626 75.7064 62.5796 77.272 65.7872C77.4397 66.2936 77.8311 66.6875 78.3064 66.8845C78.7816 67.0814 79.3407 67.0814 79.816 66.8563C80.2913 66.6313 80.6547 66.2374 80.7945 65.7309C80.9622 65.2244 80.9063 64.6899 80.6267 64.2397C79.3128 61.4261 78.5021 58.3873 78.3343 55.2924Z" fill="var(--color-accent)"></path>
                <path d="M109.841 101.295C109.366 101.464 109.003 101.802 108.779 102.252C108.555 102.702 108.555 103.237 108.723 103.687C109.562 105.994 110.009 108.442 110.009 110.89C110.009 111.509 109.981 112.099 109.925 112.69C109.841 113.731 110.596 114.632 111.603 114.744H111.742C112.721 114.744 113.504 114.013 113.615 113.028C113.699 112.296 113.727 111.593 113.727 110.861C113.699 107.963 113.168 105.094 112.162 102.364C111.798 101.492 110.792 101.014 109.841 101.295Z" fill="var(--color-accent)"></path>
                <path d="M109.478 120.681C109.059 120.4 108.555 120.315 108.08 120.4C107.605 120.512 107.158 120.794 106.906 121.216C105.201 123.804 102.992 126.027 100.448 127.771C100.029 128.053 99.749 128.503 99.6652 128.981C99.5813 129.459 99.6931 129.966 99.9727 130.388C100.252 130.81 100.672 131.091 101.175 131.176C101.678 131.26 102.181 131.148 102.573 130.866C105.536 128.84 108.052 126.252 110.037 123.27C110.568 122.397 110.345 121.244 109.478 120.681Z" fill="var(--color-accent)"></path>
                <path d="M119.878 20.9099C116.439 20.938 113 21.3038 109.646 21.979C108.695 22.1478 108.024 23.0482 108.136 24.0048C108.22 24.9615 109.031 25.7211 110.009 25.693H110.372C113.532 25.074 116.719 24.7364 119.934 24.7082C120.912 24.6238 121.639 23.8079 121.639 22.8231C121.639 21.8383 120.912 21.0224 119.934 20.938L119.878 20.9099Z" fill="var(--color-accent)"></path>
                <path d="M72.8268 120.934C73.2741 120.006 72.9107 118.88 71.9881 118.402C68.2979 116.601 64.3001 115.532 60.1905 115.251V51.7472C60.1905 51.6347 60.1905 51.5221 60.1905 51.4096V15.4514C61.9517 14.8606 63.3216 13.4538 63.8807 11.6531C64.4399 9.88047 64.1323 7.91094 63.0141 6.41972C61.9517 4.90036 60.1905 4 58.3453 4C56.5002 4 54.7389 4.90036 53.6207 6.39158C52.5304 7.91094 52.1949 9.85234 52.754 11.6249C53.3132 13.3975 54.683 14.8325 56.4443 15.4233V17.3366C51.0766 14.2697 39.5026 9.73979 28.5996 19.5312C16.103 30.7857 3.215 25.0178 2.68383 24.7645C1.87309 24.3706 0.922566 24.6239 0.391391 25.3273C-0.139783 26.0588 -0.0838704 27.0436 0.531174 27.7188L7.77192 35.8221L1.23009 42.3497C0.866653 42.7155 0.643 43.2219 0.670957 43.7284C0.670957 44.2348 0.922566 44.7413 1.286 45.0789C1.42578 45.1915 15.8234 57.9653 30.7522 47.2735C36.1478 43.4189 41.3478 42.209 46.2401 43.644C50.4895 45.0508 54.1239 47.9207 56.4723 51.7753V115.645C53.3411 116.376 50.3498 117.614 47.638 119.33C46.8831 119.949 46.6875 121.019 47.2186 121.863C47.7498 122.679 48.8122 122.96 49.6788 122.482C49.6788 122.482 54.9346 119.049 59.7991 119.049C63.4614 119.274 67.0119 120.203 70.3107 121.806C71.2613 122.228 72.3795 121.863 72.8268 120.934ZM56.2486 9.90861C56.2486 9.06452 56.7518 8.27671 57.5346 7.93907C58.3174 7.60144 59.212 7.77026 59.827 8.38925C60.4421 8.98011 60.6098 9.90861 60.3023 10.6964C59.9668 11.4842 59.212 11.9907 58.3733 11.9907C57.1991 12.0188 56.2486 11.0622 56.2486 9.90861ZM51.6637 41.9277C46.6875 39.0015 38.636 37.0319 28.5996 44.2067C18.5632 51.3814 9.05793 46.1199 5.36766 43.5033L11.6299 37.2008C12.3568 36.4974 12.3848 35.3438 11.7138 34.6122L7.49236 29.8853C16.103 31.1515 24.7975 28.3941 31.1157 22.4011C42.0746 12.6097 53.5368 19.7 56.4723 21.8102V45.726C55.0185 44.263 53.425 42.9968 51.6637 41.9277Z" fill="var(--color-accent)"></path>
                <path d="M162.552 8.8313L131.615 8.8313C130.838 8.8313 130.209 9.4609 130.209 10.2375L130.209 35.55C130.209 36.3267 130.838 36.9563 131.615 36.9563L162.552 36.9563C163.329 36.9563 163.959 36.3267 163.959 35.5501L163.959 10.2376C163.959 9.4609 163.329 8.8313 162.552 8.8313Z" stroke="#3B3B3B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M130.209 14.4565L163.959 14.4565" stroke="#3B3B3B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M154.115 20.0815C154.115 21.9463 153.374 23.7347 152.056 25.0533C150.737 26.3719 148.949 27.1127 147.084 27.1127C145.219 27.1127 143.431 26.3719 142.112 25.0533C140.793 23.7347 140.052 21.9463 140.052 20.0815" stroke="#3B3B3B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M149.467 7.01943L152.707 3.11465C153.161 2.55128 153.082 1.73536 152.509 1.28854C151.936 0.841726 151.106 0.919433 150.652 1.48281L147.511 5.30987L144.607 1.57994C144.132 1.1137 143.401 1.05542 142.868 1.46338C142.335 1.85192 142.177 2.57071 142.512 3.13408L145.535 7L142.295 10.8853C141.841 11.4487 141.92 12.2646 142.473 12.7115C143.046 13.1583 143.876 13.0806 144.33 12.5172L147.471 8.74841L150.336 12.4589C150.593 12.7892 150.968 12.964 151.383 12.964C151.679 12.964 151.956 12.8669 152.173 12.692C152.45 12.4783 152.628 12.1675 152.687 11.8373C152.726 11.4876 152.647 11.1573 152.43 10.8853L149.467 7.01943Z" fill="var(--color-accent)"></path>
            </svg>
            <p>
                ${context.t["no_results_for"]} “${context["inputElement"].value.trim()}”. ${context.t["please_check_spelling_or_use_different_word"]}.
            </p>
        </div>
        `;
    } else {
        conditionalContent.innerHTML = `
              <ul id="product-grid" class="products collection row small-up-2 medium-up-4 pagination--paginated">
                ${data.map(product => {
                    const slug = getProductSlug(product.url);
                    let li = `
                      <li class="column">
                        <product-card class="product-card text-left">
                          <figure class="product-featured-image thb-hover">
                            <a href="${product.url}" title="${product.name}" class="product-featured-image-link aspect-ratio aspect-ratio--adapt" style="--padding-bottom: 125.0%;">
                              <img class="product-secondary-image lazyautosizes ls-is-cached lazyloaded" width="1584" height="1980" src="${product.additional_image}" alt="${product.name}" style="object-position: 50.0% 50.0%;" sizes="220px">
                              <img class="product-primary-image lazyautosizes ls-is-cached lazyloaded" width="1584" height="1980" src="${product.image}" alt="${product.name}" style="object-position: 50.0% 50.0%;" sizes="220px">
                            </a>`;
                    if (slug) {
                        li += `
                            <quick-view class="product-card-quickview product-card-quickview--button" href="#Product-Drawer" data-product-handle="${slug}" tabindex="-1">
                              <div class="loading-overlay">
                                <svg aria-hidden="true" focusable="false" role="presentation" class="spinner" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
                                  <circle class="spinner-path-qv" fill="none" stroke-width="6" cx="33" cy="33" r="30" stroke="black"></circle>
                                </svg>
                              </div>
                              <span style="padding-right: 5px;">
                                <img src="https://cdn.shopify.com/s/files/1/0702/0206/5153/files/ns-search.svg?v=1718799016" alt="wishlist-icon" width="16px" height="16px">
                              </span>
                              <span>${context.t["quick_view"]}</span>
                            </quick-view>`;
                    }
                    li += `
                        </figure>
                          <div class="product-card-info">
                            <a href="${product.url}" title="${product.name}" class="product-card-title">${product.name}</a>
                            <span class="price">
                              <ins>
                                <span class="product__price--regular">${product.price.toFixed(2)} €</span>
                              </ins>
                              <small class="unit-price hidden">
                                <span></span>
                                <span class="unit-price-separator">/</span>
                                <span></span>
                              </small>
                            </span>
                          </div>
                        </product-card>
                      </li>`;
                    
                    return li;
        }).join('')}
              </ul>
              <div id="pagination-container"></div>
        `;
    }
    const filters = context.data ? context.data.filters : [];
    const productFilterElement = renderProductFilters(filters, context);
    const productFilterPlaceholder = container.querySelector("#filters-container");
    if (productFilterPlaceholder) productFilterPlaceholder.appendChild(productFilterElement);

    const filterRemoveElement = createActiveFilters(context);
    const filterRemovePlaceholder = container.querySelector("#filter-remove-container");
    if (filterRemovePlaceholder) filterRemovePlaceholder.replaceWith(filterRemoveElement);

    const sortingElement = createSortAndCount(context);
    const sortingPlaceholder = container.querySelector("#sort-count-container");
    sortingPlaceholder.replaceWith(sortingElement);

    const paginationElement = createNumericPaginationForShopify(context);
    const paginationPlaceholder = container.querySelector("#pagination-container");
    if (paginationPlaceholder) paginationPlaceholder.appendChild(paginationElement);

    return container;
}

export function createActiveFilters(context) {
    const facetRemove = document.createElement("facet-remove");
    facetRemove.className = "active-facets";
    const selectedFilters = [
        {
            type: context.urlParams["categories"],
            value: context.selectedCategory,
            label: context.selectedCategory
        },
        {
            type: context.urlParams["brand"],
            value: context.selectedBrand,
            label: context.selectedBrand
        },
        {
            type: context.urlParams["maxPrice"],
            value: context.priceMaxValue === 0 || context.priceMaxValue === context.maxPrice ? null : `${context.priceMaxValue} ${context.currency}`,
            label: `${context.t["max_price"]}: ${context.priceMaxValue} €`
        },
        {
            type: context.urlParams["minPrice"],
            value: context.priceMinValue === 0 ? null : `${context.priceMinValue} ${context.currency}`,
            label: `${context.t["min_price"]}: ${context.priceMinValue} €`
        },
        {
            type: context.urlParams["popupCategory"],
            value: context.selectedPopupCategory,
            label: context.selectedPopupCategory
        }
    ];

    forEach(context.availableFilters,(value, key) => {
        selectedFilters.push({
            type: key,
            value: value,
            label: value
        })
    });

    selectedFilters.forEach((filter) => {
        if (filter.value) {
            const filterLink = document.createElement("span");
            // filterLink.href = `#`;
            filterLink.className = "active-facets__button";
            filterLink.textContent = filter.label;

            const clearIcon = document.createElement("span");
            const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgIcon.setAttribute("width", "7");
            svgIcon.setAttribute("height", "7");
            svgIcon.setAttribute("viewBox", "0 0 7 7");
            svgIcon.setAttribute("fill", "none");

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M6.4731 6.875C6.60027 6.875 6.72968 6.82592 6.82561 6.72775C7.01972 6.53364 7.01972 6.21682 6.82561 6.02049L4.67929 3.87416L6.82561 1.72784C7.01972 1.53373 7.01972 1.21692 6.82561 1.02058C6.63151 0.826473 6.31469 0.826473 6.11835 1.02058L3.97203 3.1669L1.82794 1.02504C1.63383 0.830936 1.31701 0.830936 1.12068 1.02504C0.926571 1.21915 0.926571 1.53596 1.12068 1.7323L3.267 3.87863L1.12291 6.02049C0.928802 6.21459 0.928802 6.53141 1.12291 6.72775C1.22108 6.82592 1.34825 6.875 1.47542 6.875C1.6026 6.875 1.732 6.82592 1.82794 6.72775L3.97426 4.58142L6.12058 6.72775C6.21652 6.82592 6.34593 6.875 6.4731 6.875Z");
            path.setAttribute("fill", "var(--color-accent)");

            svgIcon.appendChild(path);
            clearIcon.appendChild(svgIcon);

            filterLink.addEventListener("click", (event) => {
                event.preventDefault();
                removeUrlParameter(filter.type);
                initPagination(context);
                redirectToSearchPage(context);
            });

            filterLink.appendChild(clearIcon);
            facetRemove.appendChild(filterLink);
        }
    });

    const clearAllLink = document.createElement("span");
    clearAllLink.className = "active-facets__button-remove text-button";
    clearAllLink.textContent = context.t["clear_all"];
    clearAllLink.addEventListener("click", (event) => {
        const allFilters = [
            context.urlParams["categories"],
            context.urlParams["brand"],
            context.urlParams["maxPrice"],
            context.urlParams["minPrice"],
            context.urlParams["popupCategory"]
        ];
        forEach(context.availableFilters, (value, key) => {
            if (value) {
                allFilters.push(key);
            }
        })
        event.preventDefault();
        allFilters.forEach(removeUrlParameter);
        initPagination(context);
        redirectToSearchPage(context);
    });

    facetRemove.appendChild(clearAllLink);

    return facetRemove;
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
                    removeUrlParameter(context.urlParams["popupCategory"]);
                    initPagination(context);
                    redirectToSearchPage(context, filter.filter_name, tree.name);
                } else {
                    context.selectedCategory = "";
                    context.selectedPopupCategory = tree.name;
                    removeUrlParameter(context.urlParams["categories"]);
                    initPagination(context);
                    redirectToSearchPage(context, 'popup-category', tree.name);
                }
            } else {
                initPagination(context);
                redirectToSearchPage(context, filter.filter_name, tree.name);
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
