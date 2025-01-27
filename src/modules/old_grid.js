import {
    removeUrlParameter,
    redirectToSearchPage,
    formatPrice,
    initPagination,
} from './utils';
import {
    createNumericPagination,
    createPrevNextPagination,
    addPriceFilter,
} from './domElements';
import {
    fetchMaxPrice,
} from './fetchers';
import {
    clearSuggestedWord
} from './processors';
import {forEach} from "lodash";

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
