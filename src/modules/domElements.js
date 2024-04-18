import { fetchData } from "./fetchers";
import { updateGridPage } from "./processors";
import { updateUrlParameter, formatPrice } from "./utils";
import {forEach} from "lodash";

/**
 * Constructs an HTML element with the given attributes.
 * @param {string} elementType - The type of HTML element to create.
 * @param {Object} attributes - The attributes to set on the element.
 * @param {string} [innerHTML=null] - The inner HTML content of the element.
 * @returns {Object} - The constructed element and its identifier.
 */
export function constructElement(elementType, attributes, innerHTML = null) {
    const el = document.createElement(elementType);
    const random = Math.floor(Math.random() * 100000000);
    const identifier = `data-${random}`;
    el.setAttribute(identifier, "");
    if (attributes) {
        forEach(attributes, (value, key) => {
            el.setAttribute(key, value);
        });
    }
    if (innerHTML) {
        el.innerHTML = innerHTML;
    }
    return {el, identifier};
}

/**
 * Creates pagination with "Previous" and "Next" buttons.
 * @param {object} context - The context in which this function operates.
 * @returns {HTMLElement} - The pagination container with "Previous" and "Next" buttons.
 */
export function createPrevNextPagination(context) {
    const pagination = document.createElement("div");
    pagination.className = "pagination";

    const previous = document.createElement("button");
    previous.textContent = "Previous";
    previous.className = `previous${context.page === 0 ? " disabled" : ""}`;
    previous.addEventListener("click", () => {
        if (context.page <= 0) return;
        context.page -= context.gridProductsPerPage;
        fetchData(context, context["inputElement"].value, true).then(() => {
            context.gridPage--;
            updateGridPage(context);
        });
    });
    pagination.appendChild(previous);

    const next = document.createElement("button");
    next.textContent = "Next";
    next.className = `next${context.currentProductCount + context.page >= context.totalProductCount ? " disabled" : ""}`;
    next.addEventListener("click", () => {
        if (context.currentProductCount < context.gridProductsPerPage) return;
        context.page += context.gridProductsPerPage;
        if (context.page >= context.totalProductCount) return;
        fetchData(context, context["inputElement"].value, true).then(() => {
            context.gridPage++;
            updateGridPage(context);
        });
    });
    pagination.appendChild(next);

    return pagination;
}

/**
 * Creates numeric pagination with ellipses.
 * @param {object} context - The context in which this function operates.
 * @returns {HTMLElement} - The pagination container with numeric page buttons.
 */
export function createNumericPagination(context) {
    const pagination = document.createElement("div");
    pagination.className = "pagination";

    const totalPages = Math.ceil(context.totalProductCount / context.gridProductsPerPage);

    function createPageButton(page) {
        const button = document.createElement("span");
        button.textContent = page;
        button.className = page === context.gridPage ? "active page" : "page";
        button.addEventListener("click", () => {
            context.page = (page - 1) * context.gridProductsPerPage;
            fetchData(context, context["inputElement"].value, true).then(() => {
                context.gridPage = page;
                updateGridPage(context);
                updateUrlParameter("page", page.toString())
            });
        });
        return button;
    }

    if (context.gridPage > 3) {
        pagination.appendChild(createPageButton(1));
        if (context.gridPage > 4) {
            const dots = document.createElement("span");
            dots.textContent = "...";
            pagination.appendChild(dots);
        }
    }

    for (let i = Math.max(1, context.gridPage - 2); i <= Math.min(totalPages, context.gridPage + 2); i++) {
        pagination.appendChild(createPageButton(i));
    }

    if (context.gridPage < totalPages - 2) {
        if (context.gridPage < totalPages - 3) {
            const dots = document.createElement("span");
            dots.textContent = "...";
            pagination.appendChild(dots);
        }
        pagination.appendChild(createPageButton(totalPages));
    }

    return pagination;
}

/**
 * Updates the position of the text measurer span.
 * @param {object} context - The context in which this function operates.
 * @param {string} [query=null] - The query to set on the measurer.
 */
export function updateMeasurerPosition(context, query = null) {
    const inputStyle = window.getComputedStyle(context["inputElement"]);
    const inputPaddingLeft = parseInt(inputStyle.paddingLeft);
    const inputMarginLeft = parseInt(inputStyle.marginLeft);
    context.measurer.style.left = `${context["inputElement"].offsetLeft + inputPaddingLeft + inputMarginLeft}px`;
    if (query) {
        context.measurer.textContent = query;
    }
}

/**
 * Create the filter for the price range.
 * @param {object} context - The SearchCore instance.
 * @returns {HTMLDivElement} - The price filter container.
 */
export function addPriceFilter(context) {
    const priceFilter = document.createElement("div");
    priceFilter.className = "price-filter";

    const inputsContainer = document.createElement("div");
    inputsContainer.className = "inputs-container";

    const minPriceInput = document.createElement("input");
    minPriceInput.type = "range";
    minPriceInput.min = context.minPrice;
    minPriceInput.max = context.maxPrice;
    minPriceInput.value = context.priceMinValue;
    minPriceInput.step = "1";
    minPriceInput.className = "range-min";

    const maxPriceInput = document.createElement("input");
    maxPriceInput.type = "range";
    maxPriceInput.min = context.minPrice;
    maxPriceInput.max = context.maxPrice;
    maxPriceInput.value = context.priceMaxValue;
    maxPriceInput.step = "1";
    maxPriceInput.className = "range-max";

    // Function to update labels
    const updateLabels = () => {
        const minPriceLabel = document.getElementById("min_price");
        minPriceLabel.innerHTML = `${formatPrice(+minPriceInput.value)}`;
        const maxPriceLabel = document.getElementById("max_price");
        maxPriceLabel.innerHTML = `${formatPrice(+maxPriceInput.value)}`;
    };

    // Function to update price values
    const updatePrices = () => {
        context.priceMinValue = +minPriceInput.value;
        context.priceMaxValue = +maxPriceInput.value;
        fetchData(context, context["inputElement"].value, true).then(() => {
            updateUrlParameter("min-price", context.priceMinValue.toString());
            updateUrlParameter("max-price", context.priceMaxValue.toString());
            updateGridPage(context);
        });
    };

    // Event listeners for input and update
    minPriceInput.addEventListener("input", () => {
        if (+minPriceInput.value > +maxPriceInput.value) {
            minPriceInput.value = maxPriceInput.value;
        }
        updateLabels();
    });

    maxPriceInput.addEventListener("input", () => {
        if (+maxPriceInput.value < +minPriceInput.value) {
            maxPriceInput.value = minPriceInput.value;
        }
        updateLabels();
    });

    minPriceInput.addEventListener("mouseup", updatePrices);
    maxPriceInput.addEventListener("mouseup", updatePrices);

    inputsContainer.appendChild(minPriceInput);
    inputsContainer.appendChild(maxPriceInput);

    priceFilter.appendChild(inputsContainer);

    const priceLabel = document.createElement("div");
    priceLabel.className = "price-label";

    const minPriceLabel = document.createElement("span");
    minPriceLabel.id = "min_price";
    minPriceLabel.innerHTML = `${formatPrice(context.priceMinValue)}`;
    priceLabel.appendChild(minPriceLabel);

    const maxPriceLabel = document.createElement("span");
    maxPriceLabel.id = "max_price";
    maxPriceLabel.innerHTML = `${formatPrice(context.priceMaxValue)}`;
    priceLabel.appendChild(maxPriceLabel);

    priceFilter.appendChild(priceLabel);

    return priceFilter;
}

/**
 * Displays the debug query container with debug information.
 * @param {object} context - The SearchCore instance.
 */
export function debugQuery(context) {
    if (typeof context.data.drrequest === "object" && context.data.drrequest !== null && Object.keys(context.data.drrequest).length > 0) {
        const debugQuery = JSON.stringify(context.data.drrequest, null, 2);
        context["debugQueryContainer"].innerHTML = "";

        const closeButton = document.createElement("button");
        closeButton.textContent = "Close";
        closeButton.className = "close";
        closeButton.addEventListener("click", () => {
            context["debugQueryContainer"].innerHTML = "";
            context["debugQueryContainer"].classList.remove("show");
        });
        context["debugQueryContainer"].appendChild(closeButton);

        const copyButton = document.createElement("button");
        copyButton.textContent = "Copy to clipboard";
        copyButton.className = "copy";
        copyButton.addEventListener("click", () => {
            navigator.clipboard.writeText(debugQuery).then(() => {
                context["debugQueryContainer"].innerHTML = "";
                context["debugQueryContainer"].classList.remove("show");
            });
        });
        context["debugQueryContainer"].appendChild(copyButton);

        const debugQueryElement = document.createElement("pre");
        debugQueryElement.className = "query";
        debugQueryElement.textContent = debugQuery;

        context["debugQueryContainer"].appendChild(debugQueryElement);
        context["debugQueryContainer"].classList.toggle("show");
    }
}
