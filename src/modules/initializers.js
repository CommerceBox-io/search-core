import {
    checkVoiceSearch,
    clearSelectedFilters,
    hasVoiceSearch,
    isPopupVisible,
    isValidUrl,
    redirectToExternalSearchPage,
    removeUrlParameter,
    updateUrlParameter,
} from './utils';
import {fetchAutoCompleteData, fetchData, fetchTemplate,} from './fetchers';
import {
    autocompleteWord,
    clearData,
    clearSuggestedWord,
    processElement,
    processElements,
    updateGridPage,
    updatePopupResults,
} from './processors';
import {debugQuery, updateMeasurerPosition,} from './domElements';
import {Html5Qrcode} from "html5-qrcode";

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
    context.layoutTemplate = layoutTemplate;
    context.externalGridSelector = externalGridSelector;
    context.searchPageRedirect = searchPageRedirect;
    context.segment_id = segment_id;
    context.segment_specialty_id = segment_specialty_id;

    const defaultParams = {
        q: "q",
        categories: "categories",
        scoped: "scoped",
        brand: "brand",
        maxPrice: "max-price",
        minPrice: "min-price",
        popupCategory: "popup-category"
    }

    context.urlParams = {...defaultParams, ...urlParams};


    context.data = null;
    context.suggestedWord = null;
    context.suggestedWordSliced = null;
    context.currentProductCount = null;
    context.totalProductCount = null;
    context.html5QrCode = null;

    context.hasDelayOnKeyPress = false;
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
    context.minQueryLength = 2;
    context.gridProductsPerPage = 12;
    context.typeDelay = 200;

    context.selectedCategory = "";
    context.selectedPopupCategory = "";
    context.selectedBrand = "";
    context.currency = "€";
    context.scannerContainerID = "scanner-container";
    context.debugQueryContainerID = "debug-query-container";
    context.paginationType = "numeric";
    context.defautlTemplate = "https://cube.commercebox.io/search/templates/template.html";

    context.placeholders = [];
    context.autocompleteTermsList = [];
    context.autocompleteWordsPerLevel = [];
    context.selectedAutocompleteTermPerWord = [];
    context.originalAutocompleteWordsList = [];
    context.originalAutocompleteWords = [];

    context.sortOrderList = {
        asc: "Αύξουσα",
        desc: "Φθήνουσα"
    };
    context.sortByList = {
        price: "Τιμή",
        "top-sales": "Πωλήσεις",
        date: "Ημερομηνία",
    };

    context.measurer = document.createElement("span");
}

/**
 * Initializes the user by setting the UUID in local storage.
 * @param context - The SearchCore instance.
 * @param uuid - The unique user id.
 */
export function initializeUser(context, uuid) {
    context.uuid = localStorage.getItem('cbscuuid');
    if (!context.uuid || context.uuid !== uuid) {
        context.uuid = uuid;
        localStorage.setItem('cbscuuid', uuid);
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
        const categories = getCategoriesList(context);
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
    const categories = urlParams.get(context.urlParams["categories"]);
    const scoped = urlParams.get(context.urlParams["scoped"]);
    const brand = urlParams.get(context.urlParams["brand"]);
    const maxPrice = urlParams.get(context.urlParams["max-price"]);
    const minPrice = urlParams.get(context.urlParams["min-price"]);
    const popupCategory = urlParams.get(context.urlParams["popup-category"]);

    if (categories) {
        context.selectedCategory = categories;
    }

    if (popupCategory) {
        context.selectedPopupCategory = popupCategory;
    }

    if (scoped) {
        context["scopedSearchDropdown"].value = scoped;
        context.selectedScope = scoped;
    }

    if (brand) {
        context.selectedBrand = brand;
    }

    if (maxPrice) {
        context.priceMaxValue = parseInt(maxPrice);
    }

    if (minPrice) {
        context.priceMinValue = parseInt(minPrice);
    }

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
            fetchAutoCompleteData(context, query).then();
            if (query.length >= context.minQueryLength && e.key !== "Enter") {
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
            clearData(context, false);
            fetchData(context, query, true).then(() => {
                updateGridPage(context);
            });
        }
    });

    context["showAllResultsButtonElement"] && context["showAllResultsButtonElement"].addEventListener("click", () => {
        const query = context["inputElement"].value;
        if (query.length >= context.minQueryLength) {
            clearData(context, false);
            fetchData(context, query, true).then(() => {
                updateGridPage(context);
            });
        }
    });

    context["debugQueryButton"] && context["debugQueryButton"].addEventListener("click", () => {
        debugQuery(context);
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
            context["scannerContainer"].style.display = "none";
            context["scannerButtonElement"].classList.remove("active");
            context.html5QrCode.stop().then(() => {
                context.html5QrCode = null;
                context.loadingCamera = false;
            });
            return;
        }
        context.html5QrCode = new Html5Qrcode(context.scannerContainerID);
        context["scannerContainer"].style.display = "block";

        Html5Qrcode.getCameras()
            .then((devices) => {
                if (devices && devices.length) {
                    const cameraId = devices[0].id;
                    context.html5QrCode
                        .start(
                            cameraId,
                            {
                                fps: 10,
                                qrbox: {width: 350, height: 350},
                            },
                            (decodedText) => {
                                context.html5QrCode.stop().then(() => {
                                    context.html5QrCode = null;
                                    context.loadingCamera = false;
                                });
                                context["scannerContainer"].style.display = "none";
                                context["scannerButtonElement"].classList.remove("active");
                                context["inputElement"].value = decodedText;
                                context.completedSearch = 1;
                                fetchData(context, decodedText).then(() => {
                                    updatePopupResults(context);
                                });
                            }
                        )
                        .then(() => {
                            context["scannerButtonElement"].classList.add("active");
                            context.loadingCamera = false;
                        })
                        .catch((err) => {
                            console.log(err);
                        });
                }
            })
            .catch((err) => {
                console.log(err);
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

/**
 * Get the categories list. TODO: For now is a dummy list. Will get them from settings endpoint
 */
export function getCategoriesList(context) {
    if (context.userParam === "sugar")
        return {
            "NEW": "NEW",
            "ΦΟΡΜΕΣ": "ΦΟΡΜΕΣ",
            "WORK IT OUT": "WORK IT OUT",
            "ΕΝΔΥΜΑΤΑ": "ΕΝΔΥΜΑΤΑ",
            "ΜΑΓΙΟ": "ΜΑΓΙΟ",
            "ΠΑΙΔΙΚΑ": "ΠΑΙΔΙΚΑ",
            "ΑΞΕΣΟΥΑΡ": "ΑΞΕΣΟΥΑΡ",
            "COLLECTIONS": "COLLECTIONS",
            "SALE": "SALE",
            "OUTLET": "OUTLET"
        }

    return {
        "Όλες οι Κατηγορίες": "",
        "ΗΛΕΚΤΡΟΛΟΓΙΚΑ": "ΗΛΕΚΤΡΟΛΟΓΙΚΑ",
        "ΒΙΟΜΗΧΑΝΙΚΟ ΥΛΙΚΟ": "ΒΙΟΜΗΧΑΝΙΚΟ ΥΛΙΚΟ",
        "ΔΙΑΚΟΠΤΕΣ ΚΑΙ ΠΡΙΖΕΣ": "ΔΙΑΚΟΠΤΕΣ ΚΑΙ ΠΡΙΖΕΣ",
        "ΕΡΓΑΛΕΙΑ": "ΕΡΓΑΛΕΙΑ",
        "ΑΥΤΟΜΑΤΙΣΜΟΣ ΚΤΙΡΙΟΥ": "ΑΥΤΟΜΑΤΙΣΜΟΣ ΚΤΙΡΙΟΥ",
        "ΦΩΤΙΣΜΟΣ": "ΦΩΤΙΣΜΟΣ",
        "ΗΛΕΚΤΡΟΝΙΚΑ & ΔΙΚΤΥΑΚΑ": "ΗΛΕΚΤΡΟΝΙΚΑ & ΔΙΚΤΥΑΚΑ",
        "ΛΑΜΠΕΣ": "ΛΑΜΠΕΣ",
        "ΚΤΙΡΙΑΚΟΣ ΕΞΟΠΛΙΣΜΟΣ": "ΚΤΙΡΙΑΚΟΣ ΕΞΟΠΛΙΣΜΟΣ",
        "ΚΑΛΩΔΙΑ": "ΚΑΛΩΔΙΑ",
        "ΨΥΞΗ & ΘΕΡΜΑΝΣΗ": "ΨΥΞΗ & ΘΕΡΜΑΝΣΗ",
        "ΗΛΕΚΤΡΟΚΙΝΗΣΗ": "ΗΛΕΚΤΡΟΚΙΝΗΣΗ",
        "ΕΝΕΡΓΕΙΑΚΕΣ ΛΥΣΕΙΣ": "ΕΝΕΡΓΕΙΑΚΕΣ ΛΥΣΕΙΣ",
        "Landing Pages": "Landing Pages",
        "SMART HOME": "SMART HOME",
    };
}
