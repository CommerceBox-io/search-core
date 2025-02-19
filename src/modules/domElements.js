import { fetchData } from "./fetchers";
import { updateGridPage } from "./processors";
import { updateUrlParameter, formatPrice, redirectToSearchPage } from "./utils";
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
                updateUrlParameter(context.urlParams["page"], page.toString())
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

export function createNumericPaginationForShopify(context) {
    const paginationTheme = document.createElement("pagination-theme");
    paginationTheme.className = "pagination pagination-type--paginated";

    const row = document.createElement("div");
    row.className = "row";

    const columns = document.createElement("div");
    columns.className = "small-12 columns";

    const pageNumbers = document.createElement("div");
    pageNumbers.className = "page-numbers nav-links";

    const totalPages = Math.ceil(context.totalProductCount / context.gridProductsPerPage);
    const query = context.query || ""; // Ensure query is defined

    // Function to create page link
    function createPageLink(page) {
        const pageLink = document.createElement("span");
        pageLink.className = page === context.gridPage ? "page current" : "page";

        if (page === context.gridPage) {
            pageLink.textContent = page;
        } else {
            const link = document.createElement("a");
            link.href = `/search?page=${page}&q=${encodeURIComponent(query)}`;
            link.title = "";
            link.textContent = page;
            link.addEventListener("click", (event) => {
                event.preventDefault();
                context.page = (page - 1) * context.gridProductsPerPage;
                fetchData(context, context["inputElement"].value, true).then(() => {
                    context.gridPage = page;
                    updateGridPage(context);
                    updateUrlParameter(context.urlParams["page"], page.toString());
                });
            });
            pageLink.appendChild(link);
        }

        return pageLink;
    }

    // Create previous arrow if not on the first page
    if (context.gridPage > 1) {
        const prev = document.createElement("span");
        prev.className = "prev";

        const prevLink = document.createElement("a");
        prevLink.href = `/search?page=${context.gridPage - 1}&q=${encodeURIComponent(query)}`;
        prevLink.title = "";
        prevLink.addEventListener("click", (event) => {
            event.preventDefault();
            context.page = (context.gridPage - 2) * context.gridProductsPerPage;
            fetchData(context, context["inputElement"].value, true).then(() => {
                context.gridPage -= 1;
                updateGridPage(context);
                updateUrlParameter(context.urlParams["page"], (context.gridPage).toString());
            });
        });

        const svgLeft = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgLeft.setAttribute("width", "12");
        svgLeft.setAttribute("height", "8");
        svgLeft.setAttribute("viewBox", "0 0 12 8");
        svgLeft.setAttribute("fill", "none");

        const pathLeft = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathLeft.setAttribute("d", "M11 4H6H1M1 4L4.28467 1M1 4L4.28467 7");
        pathLeft.setAttribute("stroke", "var(--color-accent)");
        pathLeft.setAttribute("stroke-linecap", "round");
        pathLeft.setAttribute("stroke-linejoin", "round");

        svgLeft.appendChild(pathLeft);
        prevLink.appendChild(svgLeft);
        prev.appendChild(prevLink);
        pageNumbers.appendChild(prev);
    }

    // Show first page and ellipsis if necessary
    if (context.gridPage > 3) {
        pageNumbers.appendChild(createPageLink(1));
        if (context.gridPage > 4) {
            const dots = document.createElement("span");
            dots.className = "deco";
            dots.textContent = "…";
            pageNumbers.appendChild(dots);
        }
    }

    // Show pages around the current page
    for (let i = Math.max(1, context.gridPage - 2); i <= Math.min(totalPages, context.gridPage + 2); i++) {
        pageNumbers.appendChild(createPageLink(i));
    }

    // Show last page and ellipsis if necessary
    if (context.gridPage < totalPages - 2) {
        if (context.gridPage < totalPages - 3) {
            const dots = document.createElement("span");
            dots.className = "deco";
            dots.textContent = "…";
            pageNumbers.appendChild(dots);
        }
        pageNumbers.appendChild(createPageLink(totalPages));
    }

    // Create next arrow if not on the last page
    if (context.gridPage < totalPages) {
        const next = document.createElement("span");
        next.className = "next";

        const nextLink = document.createElement("a");
        nextLink.href = `/search?page=${context.gridPage + 1}&q=${encodeURIComponent(query)}`;
        nextLink.title = "";
        nextLink.addEventListener("click", (event) => {
            event.preventDefault();
            context.page = context.gridPage * context.gridProductsPerPage;
            fetchData(context, context["inputElement"].value, true).then(() => {
                context.gridPage += 1;
                updateGridPage(context);
                updateUrlParameter(context.urlParams["page"], (context.gridPage).toString());
            });
        });

        const svgRight = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgRight.setAttribute("width", "12");
        svgRight.setAttribute("height", "8");
        svgRight.setAttribute("viewBox", "0 0 12 8");
        svgRight.setAttribute("fill", "none");

        const pathRight = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathRight.setAttribute("d", "M1 4H6H11M11 4L7.71533 1M11 4L7.71533 7");
        pathRight.setAttribute("stroke", "var(--color-accent)");
        pathRight.setAttribute("stroke-linecap", "round");
        pathRight.setAttribute("stroke-linejoin", "round");

        svgRight.appendChild(pathRight);
        nextLink.appendChild(svgRight);
        next.appendChild(nextLink);
        pageNumbers.appendChild(next);
    }

    columns.appendChild(pageNumbers);
    row.appendChild(columns);
    paginationTheme.appendChild(row);

    return paginationTheme;
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

    const priceHighestLabel = document.createElement("div");
    priceHighestLabel.className = "price-highest";
    priceHighestLabel.textContent = `${context.t["highest_price_is"]} ${formatPrice(context.maxPrice)}`;
    priceFilter.appendChild(priceHighestLabel);

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

    // Labels for displaying current price range
    const priceLabel = document.createElement("div");
    priceLabel.className = "price-label";

    const minPriceLabel = document.createElement("span");
    minPriceLabel.id = "min_price";
    minPriceLabel.textContent = `${formatPrice(context.priceMinValue)}`;
    priceLabel.appendChild(minPriceLabel);

    const maxPriceLabel = document.createElement("span");
    maxPriceLabel.id = "max_price";
    maxPriceLabel.textContent = `${formatPrice(context.priceMaxValue)}`;
    priceLabel.appendChild(maxPriceLabel);

    const updateLabels = () => {
        minPriceLabel.textContent = `${formatPrice(+minPriceInput.value)}`;
        maxPriceLabel.textContent = `${formatPrice(+maxPriceInput.value)}`;
    };

    const updatePrices = () => {
        context.priceMinValue = +minPriceInput.value;
        context.priceMaxValue = +maxPriceInput.value;
        updateUrlParameter(context.urlParams["minPrice"], context.priceMinValue.toString());
        updateUrlParameter(context.urlParams["maxPrice"], context.priceMaxValue.toString());
        redirectToSearchPage(context);
    };

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

    minPriceInput.addEventListener("change", updatePrices);
    maxPriceInput.addEventListener("change", updatePrices);

    inputsContainer.appendChild(minPriceInput);
    inputsContainer.appendChild(maxPriceInput);
    priceFilter.appendChild(inputsContainer);
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

/**
 * Sets up the buttons container with the switch and close buttons.
 * @param {object} context - The SearchCore instance.
 */
export function setupButtonsContainer(context) {
    if (!context.buttonsContainer) {
        context.buttonsContainer = document.createElement("div");
        context.buttonsContainer.style.position = "absolute";
        context.buttonsContainer.style.top = "10px";
        context.buttonsContainer.style.right = "10px";
        context.buttonsContainer.style.zIndex = 1000;
        context.buttonsContainer.style.display = "flex";
        context.buttonsContainer.style.gap = "10px";
        context.buttonsContainer.style.height = "30px";
        context.buttonsContainer.className = "scanner-actions-container";
    }

    if (!context.scannerContainer.contains(context.buttonsContainer)) {
        context.scannerContainer.appendChild(context.buttonsContainer);
    }

    if (!context.switchCameraButton) {
        context.switchCameraButton = document.createElement("div");
        context.switchCameraButton.style.padding = "5px 10px";
        context.switchCameraButton.style.cursor = "pointer";
        context.switchCameraButton.style.height = "30px";
        context.switchCameraButton.style.borderRadius = "4px";
        context.switchCameraButton.style.boxSizing = "border-box";
        context.switchCameraButton.innerHTML = "<svg style=\"width: 20px; height: 20px;\" width=\"64px\" height=\"64px\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><g id=\"SVGRepo_bgCarrier\" stroke-width=\"0\"></g><g id=\"SVGRepo_tracerCarrier\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></g><g id=\"SVGRepo_iconCarrier\"> <path d=\"M18.7153 1.71609C18.3241 1.32351 18.3241 0.687013 18.7153 0.294434C19.1066 -0.0981448 19.7409 -0.0981448 20.1321 0.294434L22.4038 2.57397L22.417 2.58733C23.1935 3.37241 23.1917 4.64056 22.4116 5.42342L20.1371 7.70575C19.7461 8.09808 19.1122 8.09808 18.7213 7.70575C18.3303 7.31342 18.3303 6.67733 18.7213 6.285L20.0018 5L4.99998 5C4.4477 5 3.99998 5.44772 3.99998 6V13C3.99998 13.5523 3.55227 14 2.99998 14C2.4477 14 1.99998 13.5523 1.99998 13V6C1.99998 4.34315 3.34313 3 4.99998 3H19.9948L18.7153 1.71609Z\" fill=\"#0F0F0F\"></path> <path d=\"M22 11C22 10.4477 21.5523 10 21 10C20.4477 10 20 10.4477 20 11V18C20 18.5523 19.5523 19 19 19L4.00264 19L5.28213 17.7161C5.67335 17.3235 5.67335 16.687 5.28212 16.2944C4.8909 15.9019 4.2566 15.9019 3.86537 16.2944L1.59369 18.574L1.58051 18.5873C0.803938 19.3724 0.805727 20.6406 1.58588 21.4234L3.86035 23.7058C4.25133 24.0981 4.88523 24.0981 5.2762 23.7058C5.66718 23.3134 5.66718 22.6773 5.2762 22.285L3.99563 21L19 21C20.6568 21 22 19.6569 22 18L22 11Z\" fill=\"#0F0F0F\"></path> </g></svg>"; // camera swap icon
        context.switchCameraButton.title = "Switch Camera";
        context.switchCameraButton.style.border = "none";
        context.switchCameraButton.style.backgroundColor = "white";

        context.switchCameraButton.onclick = () => {
            if (!context.html5QrCode) return;
            context.html5QrCode.stop().then(() => {
                context.currentCameraIndex =
                    context.currentCameraIndex === context.backCameraIndex
                        ? context.frontCameraIndex
                        : context.backCameraIndex;
                startCamera(context, context.currentCameraIndex);
            });
        };
    }

    if (!context.buttonsContainer.contains(context.switchCameraButton)) {
        context.buttonsContainer.appendChild(context.switchCameraButton);
    }

    if (!context.closeScannerButton) {
        context.closeScannerButton = document.createElement("div");
        context.closeScannerButton.style.padding = "0 10px";
        context.closeScannerButton.style.cursor = "pointer";
        context.closeScannerButton.style.height = "30px";
        context.closeScannerButton.style.borderRadius = "4px";
        context.closeScannerButton.style.fontSize = "24px";
        context.closeScannerButton.style.lineHeight = "28px";
        context.closeScannerButton.style.border = "none";
        context.closeScannerButton.style.backgroundColor = "white";
        context.closeScannerButton.innerHTML = "×";
        context.closeScannerButton.title = "Close Scanner";

        context.closeScannerButton.onclick = () => closeScanner(context);
    }

    if (!context.buttonsContainer.contains(context.closeScannerButton)) {
        context.buttonsContainer.appendChild(context.closeScannerButton);
    }
}

/**
 * Closes the scanner by stopping the camera and hiding the scanner container.
 * @param {object} context - The SearchCore instance.
 */
export function closeScanner(context) {
    if (!context.scannerButtonElement.classList.contains("active")) {
        return;
    }
    if (context.html5QrCode) {
        context.html5QrCode.stop().then(() => {
            context.html5QrCode = null;
            context.loadingCamera = false;
            context.scannerContainer.style.display = "none";
            context.scannerButtonElement.classList.remove("active");
        });
    }
}
