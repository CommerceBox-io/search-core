import {
    checkVoiceSearch,
    clearSelectedFilters,
    hasVoiceSearch,
    isPopupVisible,
    isValidUrl,
    redirectToExternalSearchPage,
    removeUrlParameter,
    updateUrlParameter,
    initPagination,
    getUUID
} from './utils';
import {
    fetchAutoCompleteData,
    fetchData,
    fetchTemplate
} from './fetchers';
import {
    autocompleteWord,
    clearData,
    clearSuggestedWord,
    processElement,
    processElements,
    updateGridPage,
    updatePopupResults,
    startCamera,
    closePopup
} from './processors';
import {
    debugQuery,
    updateMeasurerPosition,
    setupButtonsContainer,
    closeScanner
} from './domElements';
import {Html5Qrcode} from "html5-qrcode";
import {fetchTemplateEndedEvent} from "./events";

/**
 * Initializes various properties of the SearchCore instance.
 * @param {object} context - The SearchCore instance.
 * @param {string} layoutTemplate - The layout template.
 * @param {string} externalGridSelector - The external grid ID.
 * @param {string} searchPageRedirect - The search page redirect URL.
 * @param {string} segment_id - The segment ID.
 * @param {string} segment_specialty_id - The segment specialty ID.
 * @param {object} urlParams - Url parameters
 */
export function initializeProperties(context, layoutTemplate, externalGridSelector,  searchPageRedirect, segment_id, segment_specialty_id, urlParams) {
    const appearanceSettings = context.settings.appearance || {
        currency: null,
        debug_query_container_id: null,
        grid_products_per_page: null,
        has_delay_on_key_press: null,
        key_press_delay: null,
        layout_template: null,
        min_chars: null,
        pagination_type: null,
        platform: null,
        popup_products_per_page: null,
        scanner_container_id: null,
        search_page_redirect: "",
        show_product_image: true,
        show_product_price: true,
        show_product_sku: true,
        show_product_title: true,
        sorting: null,
        translations: null,
        url_params: null,
    }

    context.layoutTemplate = layoutTemplate;
    context.externalGridSelector = externalGridSelector;
    context.searchPageRedirect = searchPageRedirect || appearanceSettings.search_page_redirect;
    context.segment_id = segment_id;
    context.segment_specialty_id = segment_specialty_id;
    context.platform = context.platform || appearanceSettings.platform;
    context.showProductImage = context.showProductImage || appearanceSettings.show_product_image;
    context.showProductTitle = context.showProductTitle || appearanceSettings.show_product_title;
    context.showProductPrice = context.showProductPrice || appearanceSettings.show_product_price;
    context.showProductSku = context.showProductSku || appearanceSettings.show_product_sku;

    const defaultParams = appearanceSettings.url_params || {
        q: "q",
        categories: "categories",
        scoped: "scoped",
        brand: "brand",
        maxPrice: "max-price",
        minPrice: "min-price",
        popupCategory: "popup-category",
        page: "page"
    }
    context.urlParams = {...defaultParams, ...urlParams};

    context.data = null;
    context.suggestedWord = null;
    context.suggestedWordSliced = null;
    context.currentProductCount = null;
    context.totalProductCount = null;
    context.html5QrCode = null;

    context.hasDelayOnKeyPress = appearanceSettings.has_delay_on_key_press || false;
    context.loadingCamera = false;
    context.consoleDebug = !!(new URL(window.location)).searchParams.get('debug');

    context.selectedAutocompleteTerm = 0
    context.page = 0;
    context.completedSearch = 0;
    context.minPrice = 0;
    context.maxPrice = 0;
    context.priceMaxValue = 0;
    context.priceMinValue = 0;
    context.gridPage = initGridPage();
    context.minQueryLength = appearanceSettings.min_chars || 2;
    context.gridProductsPerPage = appearanceSettings.grid_products_per_page || 12;
    context.popupProductsPerPage = appearanceSettings.popup_products_per_page || 4;
    context.typeDelay = appearanceSettings.key_press_delay || 200;

    context.selectedCategory = "";
    context.selectedPopupCategory = "";
    context.selectedBrand = "";
    context.currency = appearanceSettings.currency || "€";
    context.scannerContainerID = appearanceSettings.scanner_container_id || "scanner-container";
    context.debugQueryContainerID = appearanceSettings.debug_query_container_id || "debug-query-container";
    context.paginationType = appearanceSettings.pagination_type || "numeric";
    context.defautlTemplate = appearanceSettings.layout_template || "https://cdn.commercebox.io/search/templates/template.html";

    context.placeholders = [];
    context.autocompleteTermsList = [];
    context.autocompleteWordsPerLevel = [];
    context.selectedAutocompleteTermPerWord = [];
    context.originalAutocompleteWordsList = [];
    context.originalAutocompleteWords = [];
    context.availableFilters = {};

    context.sortOrderList = {
        desc: context.t["descending"],
        asc: context.t["ascending"],
    };

    context.sortByList = [
        {
            key: "relevance",
            value: context.t["relevance"],
            format: null
        },
        {
            key: "price",
            value: context.t["price"],
            format: null
        },
        {
            key: "top-sales",
            value: context.t["sales"],
            format: null
        },
        {
            key: "date",
            value: context.t["date"],
            format: null
        }
    ];

    if (context.sorting && Object.keys(context.sorting).length > 0 && (context.sorting[context.locale])) {
        context.sortByList = context.sorting[context.locale];
    } else if (appearanceSettings.sorting && Object.keys(appearanceSettings.sorting).length > 0 && (appearanceSettings.sorting[context.locale])) {
        context.sortByList = appearanceSettings.sorting[context.locale];
    }

    context.measurer = document.createElement("span");

    if (context.consoleDebug) {
        console.log("Initialize Properties: ", context);
    }
}

/**
 * Initializes the user by setting the UUID in local storage.
 * @param context - The SearchCore instance.
 * @param uuid - The unique user id.
 */
export function initializeUser(context, uuid) {
    context.uuid = localStorage.getItem('cbscuuid');
    if (!context.uuid || (uuid !== "guest" && context.uuid !== uuid) || (uuid === "guest" && !context.uuid.startsWith("guest-"))) {
        context.uuid = getUUID(uuid);
        localStorage.setItem('cbscuuid', context.uuid);
    }
}

/**
 * Initializes the grid page by checking the URL for a 'page' parameter.
 * If the 'page' parameter is not found, defaults to 1.
 * @returns {number} - The initial grid page number.
 */
export function initGridPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page');
    return page ? parseInt(page, 10) : 1;
}

/**
 * Initializes the callback functions for handling user interactions with search results.
 * This method allows custom logic to be executed when items are added to the cart, wishlist, or comparison list.
 *
 * @param {object} context - The SearchCore instance.
 * @param {function} [addToCartCallback=null] - A callback function to be executed when an item is added to the cart.
 * @param {function} [addToWishlistCallback=null] - A callback function to be executed when an item is added to the wishlist.
 * @param {function} [addToCompareCallback=null] - A callback function to be executed when an item is added to the comparison list.
 */
export function initializeCallbacks(context, addToCartCallback = null, addToWishlistCallback = null, addToCompareCallback = null) {
    context.addToCartCallback = addToCartCallback;
    context.addToWishlistCallback = addToWishlistCallback;
    context.addToCompareCallback = addToCompareCallback;
}

/**
 * Initializes the element mappings by setting them to null.
 * @param {object} context - The SearchCore instance.
 * @return {Array} - The mapping for the elements to create.
 */
export function initializeElements(context) {
    context.elementsMapping.forEach((element) => {
        context[element.name] = null;
    });
}

/**
 * Initializes the search core by loading the template.
 * @param {object} context - The SearchCore instance.
 */
export function init(context) {
    if(context.consoleDebug) {
        console.log("SearchCore initialized: layoutTemplate", context.layoutTemplate)
    }
    if (context.layoutTemplate) {
        if (isValidUrl(context.layoutTemplate)) {
            fetchTemplate(context, context.layoutTemplate);
        } else {
            loadTemplate(context, context.layoutTemplate);
        }
    } else {
        const url = context.layoutTemplate ? context.layoutTemplate : context.defautlTemplate;
        fetchTemplate(context, url);
    }
}

/**
 * Initializes the input measurer and sets IDs for scanner and debug containers.
 * @param {object} context - The SearchCore instance.
 */
export function initializeSecondaryContainers(context) {
    if (context["inputElement"]) {
        context["inputElement"].parentNode.appendChild(context.measurer);
    }

    if (context["scannerContainer"]) {
        context["scannerContainer"].id = context.scannerContainerID;
    }

    if (context["debugQueryContainer"]) {
        context["debugQueryContainer"].id = context.debugQueryContainerID;
    }
}

/**
 * Initializes the dropdown menu with categories.
 * @param {object} context - The SearchCore instance.
 */
export function initializeScopedSearchDropdown(context) {
    if (context["scopedSearchDropdown"]) {
        const categories = context.settings.categories || {};
        const wrapper = document.createElement("div");
        wrapper.className = "select-wrapper";
        context["scopedSearchDropdown"].parentNode.insertBefore(wrapper, context["scopedSearchDropdown"]);
        wrapper.appendChild(context["scopedSearchDropdown"]);

        for (let [key, value] of Object.entries(categories)) {
            const option = document.createElement("option");
            option.innerHTML = key;
            option.value = value;
            context["scopedSearchDropdown"].appendChild(option);
        }
        context["scopedSearchDropdown"].addEventListener("change", () => {
            const query = context["inputElement"].value;
            updateUrlParameter(context.urlParams["scoped"], context["scopedSearchDropdown"].value);
            removeUrlParameter(context.urlParams["categories"]);
            if (!query) return;
            context.selectedCategory = "";
            context.selectedPopupCategory = "";
            const isGrid = !isPopupVisible(context);
            initPagination(context);
            fetchData(context, query, isGrid).then(() => {
                if (isPopupVisible(context)) {
                    updatePopupResults(context);
                } else {
                    updateGridPage(context);
                }
            });
        });
    }
}

/**
 * Initializes search from URL parameters if present.
 * @param {object} context - The SearchCore instance.
 */
export function initializeSearchFromUrl(context) {
    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get(context.urlParams["q"]);

    urlParams.forEach((value, key) => {
        if (context.urlParams["q"] === key) {
            context["inputElement"].value = value;
        } else if (context.urlParams["maxPrice"] === key) {
            context.priceMaxValue = parseInt(value);
        } else if (context.urlParams["minPrice"] === key) {
            context.priceMinValue = parseInt(value);
        } else if (context.urlParams["scoped"] === key) {
            context["scopedSearchDropdown"].value = value;
            context.selectedScope = value;
        } else if (context.urlParams["brand"] === key) {
            context.selectedBrand = value;
        } else if (context.urlParams["popupCategory"] === key) {
            context.selectedPopupCategory = value;
        } else if (context.urlParams["categories"] === key) {
            context.selectedCategory = value;
        } else {
            context.availableFilters[key] = value;
        }
    });

    if (q) {
        context["inputElement"].value = q;
        context.completedSearch = 1;
        fetchData(context, q, true).then(() => {
            updateGridPage(context);
        });
    }


}

/**
 * Check for an external grid ID and prioritize it over a grind in the template
 * @param {object} context - The SearchCore instance.
 */
export function initializeExternalGrid(context) {
    if (context.externalGridSelector) {
        const gridContainer= document.querySelector(context.externalGridSelector);
        context["gridContainerElement"] = gridContainer ? gridContainer : context["gridContainerElement"];
    }
}

/**
 * Creates a span element for measuring text width.
 * @param {object} context - The SearchCore instance.
 */
export function createMeasurer(context) {
    context.measurer.id = "text-measurer";
    context.measurer.style.visibility = "hidden";
    context.measurer.style.position = "absolute";
    context.measurer.style.whiteSpace = "pre";
}

/**
 * Loads the given HTML template into the container and processes the elements.
 * @param {object} context - The SearchCore instance.
 * @param {string} html - The HTML template.
 */
export function loadTemplate(context, html) {
    try {
        context.container.innerHTML = html;
        // Just a generic replace element, no need to assign it to a variable
        processElement(context,'containerElement');
        processElements(context);
        initializeExternalGrid(context);
        createMeasurer(context);
        initializeSecondaryContainers(context);
        initializeScopedSearchDropdown(context);
        initializeSearchFromUrl(context);
        checkVoiceSearch(context);
        addEventListeners(context);
        fetchTemplateEndedEvent();
    } catch (e) {
        console.error(e)
    }
}

/**
 * Adds various event listeners for user interactions.
 * @param {object} context - The SearchCore instance.
 */
export function addEventListeners(context) {
    if(context.consoleDebug) {
        console.log("Adding event listeners");
        console.log("inputElement: ", context["inputElement"]);
        console.log("clearButtonElement: ", context["clearButtonElement"]);
        console.log("voiceSearchElement: ", context["voiceSearchElement"]);
        console.log("scannerButtonElement: ", context["scannerButtonElement"]);
        console.log("searchButtonElement: ", context["searchButtonElement"]);
        console.log("showAllResultsButtonElement: ", context["showAllResultsButtonElement"]);
        console.log("debugQueryButton: ", context["debugQueryButton"]);
    }
    let timeout = null;

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const queryDebugger = document.getElementById(context.debugQueryContainerID);
            if (queryDebugger && queryDebugger.classList.contains("show")) {
                queryDebugger.classList.remove("show");
            } else if (isPopupVisible(context)) {
                clearData(context, false);
            }
        }
    });

    context["inputElement"] && context["inputElement"].addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            e.preventDefault();
            if (context.suggestedWord) {
                context["suggestionElement"].innerHTML = "";
                context["inputElement"].value = context.suggestedWord.replaceAll("&nbsp;", " ");
                context.suggestedWordSliced = "";
                context.suggestedWord = "";
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (!context["inputElement"].value) {
                return;
            }
            if (context.searchPageRedirect) {
                redirectToExternalSearchPage(context);
                return;
            }
            clearData(context, false);
            context.completedSearch = 1;
            initPagination(context);
            fetchData(context, context["inputElement"].value, true).then(() => {
                updateGridPage(context);
            });
        }
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const operation = e.key === "ArrowUp" ? -1 : 1;
            const wordCount = context["inputElement"].value.split(" ").length;

            if (context.autocompleteWordsPerLevel.length) {
                context.selectedAutocompleteTermPerWord = context.selectedAutocompleteTermPerWord.map((item, i) => {
                    const value = item + operation;
                    if(context.autocompleteWordsPerLevel[i][value]) {
                        return value
                    } else {
                        return e.key === "ArrowUp" ? context.autocompleteWordsPerLevel[i].length - 1 : 0;
                    }
                });
                autocompleteWord(context, context["inputElement"].value);
            }
        }
        else {
            context["suggestionElement"].innerHTML = "";
            context.suggestedWord = "";
            context.suggestedWordSliced = "";
        }
    });

    context["inputElement"] && context["inputElement"].addEventListener("keyup", (e) => {
        if (context.hasDelayOnKeyPress) {
            clearTimeout(timeout);
        }

        if (e.key === "Escape" || e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            return;
        }

        const handleKeyup = () => {
            const query = e.target.value.trim();
            if (query.length < context.minQueryLength) {
                return;
            }
            updateUrlParameter(context.urlParams["q"], query);
            fetchAutoCompleteData(context, query).then();
            if (query.length >= context.minQueryLength && e.key !== "Enter") {
                initPagination(context);
                fetchData(context, query).then(() => {
                    clearSelectedFilters(context);
                    updatePopupResults(context);
                });
            } else {
                clearSuggestedWord(context);
            }
        }

        if (context.hasDelayOnKeyPress) {
            timeout = setTimeout(handleKeyup, context.typeDelay);
        } else {
            handleKeyup();
        }
    });

    context["inputElement"] && context["inputElement"].addEventListener("click", (e) => {
        const query = e.target.value.trim();
        if (query.length >= context.minQueryLength) {
            initPagination(context);
            fetchData(context, query).then(() => {
                clearSelectedFilters(context);
                updatePopupResults(context);
            });
        }
    });

    context["clearButtonElement"] && context["clearButtonElement"].addEventListener("click", () => {
        clearData(context);
    });

    context["voiceSearchElement"] && context["voiceSearchElement"].addEventListener("click", () => {
        voiceSearch(context);
    });

    context["scannerButtonElement"] && context["scannerButtonElement"].addEventListener("click", () => {
        initScanner(context);
    });

    context["searchButtonElement"] && context["searchButtonElement"].addEventListener("click", () => {
        const query = context["inputElement"].value;
        if (query.length >= context.minQueryLength) {
            if (!context.searchPageRedirect) {
                clearData(context, false);
                initPagination(context);
                fetchData(context, query, true).then(() => {
                    updateGridPage(context);
                });
            } else {
                redirectToExternalSearchPage(context);
            }
        }
    });

    context["showAllResultsButtonElement"] && context["showAllResultsButtonElement"].addEventListener("click", () => {
        const query = context["inputElement"].value;
        if (!context.searchPageRedirect) {
            clearData(context, false);
            initPagination(context);
            fetchData(context, query, true).then(() => {
                updateGridPage(context);
            });
        } else {
            redirectToExternalSearchPage(context);
        }
    });

    context["debugQueryButton"] && context["debugQueryButton"].addEventListener("click", () => {
        debugQuery(context);
    });

    document.addEventListener("cbClosePopup", (event) => {
        closePopup(context);
    });

    updateMeasurerPosition(context);
}

/**
 * Initializes the QR code scanner.
 * @param {object} context - The SearchCore instance.
 */
export function initScanner(context) {
    try {
        if (context.loadingCamera) {
            return;
        }
        context.loadingCamera = true;

        if (context.html5QrCode) {
            closeScanner(context);
            return;
        }

        context.scannerContainer.style.display = "block";
        context.scannerContainer.style.position = "relative";

        if (!context.cameraFeedElement) {
            context.cameraFeedElement = document.createElement("div");
            context.cameraFeedElement.id = "cameraFeedElement";
            context.scannerContainer.appendChild(context.cameraFeedElement);
        }

        context.html5QrCode = new Html5Qrcode(context.cameraFeedElement.id);

        setupButtonsContainer(context);

        Html5Qrcode.getCameras()
            .then((devices) => {
                if (devices && devices.length) {
                    context.availableCameras = devices;

                    let backIndex = devices.findIndex((d) => d.label.toLowerCase().includes("back"));
                    let frontIndex = devices.findIndex((d) => d.label.toLowerCase().includes("front"));
                    if (backIndex === -1) backIndex = 0;
                    if (frontIndex === -1) frontIndex = devices.length - 1;

                    context.backCameraIndex = backIndex;
                    context.frontCameraIndex = frontIndex;
                    context.currentCameraIndex = backIndex;

                    startCamera(context, context.currentCameraIndex);
                }
            })
            .catch((err) => {
                console.log("Error getting cameras:", err);
            });
    } catch (error) {
        console.error("Error initializing scanner:", error);
    }
}

/**
 * Initiates voice search functionality.
 * @param {object} context - The SearchCore instance.
 */
export function voiceSearch(context) {
    if (!hasVoiceSearch()) {
        return;
    }

    const recognition = new (window.SpeechRecognition ||
        window.webkitSpeechRecognition ||
        window.mozSpeechRecognition ||
        window.msSpeechRecognition)();

    recognition.lang = "el-GR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;
    context["voiceSearchElement"].classList.add("active");
    recognition.start();

    recognition.onstart = () => {
        setTimeout(() => {
            recognition.stop();
        }, 5000);
    };

    recognition.onend = () => {
        context["voiceSearchElement"].classList.remove("active");
    };

    recognition.onresult = (e) => {
        const query = e.results[0][0].transcript;
        context["inputElement"].value = query;
        context.completedSearch = 1;
        initPagination(context);
        updateUrlParameter(context.urlParams["q"], query);
        context["inputElement"].focus();
        fetchData(context, query).then(() => {
            updatePopupResults(context);
            updateMeasurerPosition(context, query);
        });
    };
}

/**
 * Initializes the element mappings by setting them to null.
 */
export function getElementsMapping() {
    return [
        { name: "scopedSearchDropdown", replacement: "scopedSearchDropdown", type: "select" },
        { name: "inputElement", replacement: "input", type: "input" },
        { name: "resultsElement", replacement: "searchResults", type: "span" },
        { name: "clearButtonElement", replacement: "clear", type: "span" },
        { name: "gridContainerElement", replacement: "grid", type: "div" },
        { name: "voiceSearchElement", replacement: "voiceSearch", type: "div" },
        { name: "scannerButtonElement", replacement: "scanSearch", type: "div" },
        { name: "suggestionElement", replacement: "suggestion", type: "div" },
        { name: "searchButtonElement", replacement: "searchButton", type: "div" },
        { name: "typeaheadContainerElement", replacement: "typeahead", type: "div" },
        { name: "showAllResultsButtonElement", replacement: "showAllResultsButton", type: "div" },
        { name: "categoriesContainerElement", replacement: "categories", type: "div" },
        { name: "bannerContainerElement", replacement: "banner", type: "div" },
        { name: "recentSearchListElement", replacement: "recentSearches", type: "div" },
        { name: "brandsContainerElement", replacement: "brands", type: "div" },
        { name: "scannerContainer", replacement: "scannerContainer", type: "div" },
        { name: "debugQueryContainer", replacement: "debugQueryContainer", type: "div" },
        { name: "debugQueryButton", replacement: "debugQueryButton", type: "div" },
    ]
}
