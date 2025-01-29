import {fetchData, fetchMaxPrice} from "./fetchers";
import {initPagination, redirectToSearchPage, removeUrlParameter, updateUrlParameter} from "./utils";
import {forEach} from "lodash";
import {addPriceFilter} from "./domElements";

/**
 * Generates a Shopify-style HTML template for grid, filters, and pagination.
 * @param {object} context - The SearchCore instance.
 * @returns {string} - The complete HTML template as a string.
 */
export function generateTemplate() {
    return `
        <div class="collection-banner--description" @if="!data.results.length">
            <p>{{t.no_results_for}} "{{inputElement.value}}"</p>
            <p>{{t.please_check_spelling_or_use_different_word}}</p>
        </div>
        <div class="demo-container" @else>
           <div class="totals">
              <span>{{totalProductCount}} {{t.result_plural}}</span>
              <div class="sorting-container">
                <select id="cb_sorting_select">
                    <option @loop="sorting in sortByList" value="{{sorting.key}}">
                        {{sorting.value}}
                    </option>
                </select>
                <select id="cb_order_select">
                    <option @loop="(order, key) in sortOrderList" value="{{key}}">
                        {{order}}
                    </option>
                </select>
              </div>
            </div>
            <div class="grid-content">
              <div class="filters">
                 <div class="title">{{t.filters}}</div>
                 <div class="selected-filters" @if="selectedFilters.length !== null">
                    <div class="selected-filter-item" 
                         @loop="selectedFilter in selectedFilters" 
                         @if="selectedFilter.value">
                       {{selectedFilter.label}}
                       <span class="clear-filter" >x</span>
                    </div>
                 </div>
                 <div @loop="filter in filters" class="filter {{filter.filter_name}}">
                    <div class="title">{{filter.name}}</div>
                    <div class="items">
                       <div class="children-container" @loop="child in filter.children">
                          <div class="filter-item root-category">{{child.name}} ({{child.doc_count}})</div>
                            <div class="children-container" @loop="subchild in child.children">
                                <div class="filter-item">{{subchild.name}} ({{subchild.doc_count}})</div>
                                <div class="children-container" @loop="subsubchild in subchild.children">
                                   <div class="filter-item">{{subsubchild.name}} ({{subsubchild.doc_count}})</div>
                                </div>
                            </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
    `;
}

/**
 * Initializes and renders the grid with Shopify styling and interactivity.
 * @param {object} context - The SearchCore instance.
 */
export function renderGrid(context) {
    context['selectedFilters'] = selectedFilters(context);
    context['filters'] = createFilter(context);

    context.gridContainerElement.innerHTML = replaceTemplateVariables(generateTemplate(), context);

    console.log(context)

    processLoops(context.gridContainerElement, context);
    processConditionalBlocks(context.gridContainerElement, context);
    attachListeners(context.gridContainerElement, context);
}

function createFilter(context) {
    const filters = [];
    context.data.filters.forEach((filter) => {
        if (filter.filter_name === "price") {
            const query = context["inputElement"].value.trim();
            fetchMaxPrice(context, query, true).then(() => {
                const price = addPriceFilter(context);
                filters.push({
                    name: filter.filter_name,
                    min: context.minPrice,
                    max: context.maxPrice,
                    minValue: context.priceMinValue,
                    maxValue: context.priceMaxValue,
                    step: 1,
                })
            })
        } else {
            const tree = filter.tree && filter.tree[0] ? filter.tree[0] : [];
            filters.push({
                name: filter.filter_name,
                children: findChildrenCategories(context, tree, filter)
            });
        }
    });
    console.log(filters)
    return filters;
}

function findChildrenCategories(context, tree, filter, rootCategory = false) {
    const children = [];

    // Recursively process child categories
    if (tree.children && tree.children.length) {
        tree.children.forEach((item) => {
            const childCategories = findChildrenCategories(context, item, filter, tree.name === "Root Category");
            children.push(...childCategories); // Append all child categories recursively
        });
    }

    // Add the current category if it has a name and isn't the root category
    const result = [];
    if (tree.name && tree.name !== "Root Category") {
        result.push({
            name: tree.name,
            doc_count: tree.doc_count,
            children: children, // Add the processed children
        });
    } else {
        // For root categories, only return children without wrapping
        result.push(...children);
    }

    return result;
}

function selectedFilters(context) {
    const selectedFilters = [
        {
            type: context.urlParams["categories"],
            value: context.selectedCategory,
            label: context.selectedCategory,
        },
        {
            type: context.urlParams["brand"],
            value: context.selectedBrand,
            label: context.selectedBrand,
        },
        {
            type: context.urlParams["maxPrice"],
            value: context.priceMaxValue === 0 || context.priceMaxValue === context.maxPrice
                ? null
                : `${context.priceMaxValue}${context.currency}`,
            label: `${context.t.max_price}: ${context.priceMaxValue}${context.currency}`,
        },
        {
            type: context.urlParams["minPrice"],
            value: context.priceMinValue === 0
                ? null
                : `${context.priceMinValue}${context.currency}`,
            label: `${context.t.min_price}: ${context.priceMinValue}${context.currency}`,
        },
        {
            type: context.urlParams["popupCategory"],
            value: context.selectedPopupCategory,
            label: context.selectedPopupCategory
        }
    ];

    forEach(context.availableFilters, (value, key) => {
        if (value) {
            selectedFilters.push({
                type: key,
                value: value,
                label: value
            });
        }
    });

    return selectedFilters;
}

/**
 * Evaluates a template expression (like "!data.results.length")
 * in a "safe" context to avoid TypeError.
 *
 * Returns `true` or `false`.
 */
function evaluateExpression(expression, context) {
    try {
        const safeCtx = createSafeContext(context);
        const rewritten = rewriteExpression(expression);

        const fn = new Function('ctx', `
            try {
                return !!(${rewritten});
            } catch (err) {
                return false;
            }
        `);

        return fn(safeCtx);
    } catch (err) {
        console.warn("Error evaluating expression:", expression, err);
        return false;
    }
}

/**
 * Creates a recursive Proxy that returns more proxies for
 * undefined properties. Final lookups end up as `undefined`
 * rather than throwing errors.
 */
function createSafeContext(original) {
    if (original !== Object(original) || original === null) {
        return original; // for non-objects (number, string, etc.) just return the value
    }
    return new Proxy(original, {
        get(target, prop) {
            if (!(prop in target)) {
                // Return another safe proxy for missing property
                return createSafeContext({});
            }
            const value = target[prop];
            if (typeof value === 'object' && value !== null) {
                return createSafeContext(value);
            }
            return value;
        }
    });
}

/**
 * Minimal fix: skip rewriting "null", "true", "false", "undefined" as ctx.null, etc.
 * Also skip rewriting identifiers if they're preceded by "."
 * (because that means they're a property, e.g. "selectedFilter.value").
 */
function rewriteExpression(expr) {
    return expr.replace(
        /\b([a-zA-Z_$][0-9a-zA-Z_$]*)\b/g,
        (match, p1, offset, fullString) => {
            // Skip JS keywords that we shouldn't rewrite
            if (["null", "true", "false", "undefined"].includes(p1)) {
                return p1;
            }
            // If preceded by '.', it's already an object property (e.g. obj.foo)
            if (offset > 0 && fullString[offset - 1] === '.') {
                return match;
            }
            return 'ctx.' + match;
        }
    );
}

/**
 * Processes @if, @elseif, and @else blocks in the container.
 * Keeps only the first truthy block or the @else if none are truthy.
 * @param {HTMLElement} container
 * @param {object} context - your search context or data object
 */
function processConditionalBlocks(container, context) {
    // We collect elements that have @if, @elseif, @else in one pass.
    const conditionalElems = [];

    // If `container` itself has @if|@elseif|@else, include it
    if (container.matches?.('[\\@if], [\\@elseif], [\\@else]')) {
        conditionalElems.push(container);
    }

    // Then gather all descendant nodes that match
    // (Works in modern browsers even on DocumentFragments)
    conditionalElems.push(...container.querySelectorAll?.('[\\@if], [\\@elseif], [\\@else]') || []);

    let i = 0;
    while (i < conditionalElems.length) {
        const ifElem = conditionalElems[i];
        // Only proceed if this element has an @if (start of a block group)
        const ifExpr = ifElem.getAttribute('@if');
        if (!ifExpr) {
            i++;
            continue;
        }

        // We have an @if, gather any subsequent @elseif or @else in the chain
        const blockGroup = [ifElem];
        let j = i + 1;
        while (j < conditionalElems.length) {
            const nextEl = conditionalElems[j];
            if (nextEl.hasAttribute('@elseif') || nextEl.hasAttribute('@else')) {
                blockGroup.push(nextEl);
                j++;
            } else {
                break;
            }
        }

        // Evaluate the chain
        let keepIndex = -1;
        // 1) Try the @if
        if (evaluateExpression(ifExpr, context)) {
            keepIndex = 0;
        } else {
            // 2) Check any @elseif or @else
            for (let k = 1; k < blockGroup.length; k++) {
                const el = blockGroup[k];
                const elseifExpr = el.getAttribute('@elseif');
                const isElse = el.hasAttribute('@else');

                if (elseifExpr) {
                    // Evaluate @elseif
                    if (evaluateExpression(elseifExpr, context)) {
                        keepIndex = k;
                        break;
                    }
                } else if (isElse) {
                    // This is the final @else
                    keepIndex = k;
                    break;
                }
            }
        }

        // Now we know which index (if any) to keep
        blockGroup.forEach((elem, idx) => {
            if (idx === keepIndex) {
                // Keep it, remove the attributes
                elem.removeAttribute('@if');
                elem.removeAttribute('@elseif');
                elem.removeAttribute('@else');
            } else {
                // Remove it from the DOM
                if (elem.parentNode) {
                    elem.parentNode.removeChild(elem);
                }
            }
        });

        // jump ahead
        i = j;
    }
}

/**
 * Processes @loop directives in the container to handle both:
 *   - "item in data.arrayName"
 *   - "(valueAlias, keyAlias) in data.objectName"
 *
 * This revised version also replaces {{...}} placeholders
 * inside attributes.
 */
function processLoops(container, data) {
    // Find elements with @loop (including nested ones).
    const loopElems = Array.from(container.querySelectorAll('[\\@loop]'));

    loopElems.forEach((originalEl) => {
        const rawExpr = originalEl.getAttribute('@loop')?.trim();
        if (!rawExpr) return;

        // Remove the @loop attribute so we don't reprocess it infinitely
        originalEl.removeAttribute('@loop');

        // Determine if the loop is array-mode ("item in array")
        // or object-mode ("(value, key) in object").
        let arrayMode = false;
        let objectMode = false;
        let itemAlias = '';
        let valueAlias = '';
        let keyAlias = '';
        let dataExpr = '';

        // Regex for "(value, key) in object"
        const objectLoopPattern = /^\(\s*([^,]+)\s*,\s*([^)]+)\)\s+in\s+(.+)$/;
        // Regex for "item in array"
        const arrayLoopPattern = /^([^()]+)\s+in\s+(.+)$/;

        let match = rawExpr.match(objectLoopPattern);
        if (match) {
            objectMode = true;
            valueAlias = match[1].trim();
            keyAlias = match[2].trim();
            dataExpr = match[3].trim();
        } else {
            match = rawExpr.match(arrayLoopPattern);
            if (match) {
                arrayMode = true;
                itemAlias = match[1].trim();
                dataExpr = match[2].trim();
            }
        }

        if (!objectMode && !arrayMode) {
            console.warn(`@loop expression not recognized: "${rawExpr}"`);
            return;
        }

        // Navigate the data object path (e.g. "context.sortByList") to get the array or object.
        const pathParts = dataExpr.split('.');
        let dataRef = data;
        for (const part of pathParts) {
            if (dataRef == null || typeof dataRef !== 'object') break;
            dataRef = dataRef[part.trim()];
        }

        if (dataRef == null) {
            console.warn(`@loop: Could not find data for "${dataExpr}"`);
            return;
        }

        // Convert dataRef to entries: [key, value]
        // - If arrayMode, index is key, item is value
        // - If objectMode, key/value are from Object.entries
        let entries = [];
        if (arrayMode) {
            if (!Array.isArray(dataRef)) {
                console.warn(`@loop: "${dataExpr}" is not an array. Using empty array.`);
                dataRef = [];
            }
            entries = dataRef.map((item, index) => [index, item]);
        } else {
            if (typeof dataRef !== 'object' || Array.isArray(dataRef)) {
                console.warn(`@loop: "${dataExpr}" is not an object. Using empty object.`);
                dataRef = {};
            }
            entries = Object.entries(dataRef);
        }

        // Iterate over each entry, clone the originalEl, then process placeholders/conditionals
        entries.forEach(([key, value], index) => {
            const clone = originalEl.cloneNode(true);

            // Replace placeholders in *attributes*
            Array.from(clone.attributes).forEach((attr) => {
                attr.value = attr.value.replace(/{{\s*([\w.$]+)\s*}}/g, (_, keyPath) => {
                    // If keyPath includes '.', we might have nested properties
                    if (keyPath.includes('.')) {
                        // E.g., "item.prop" or "valueAlias.nested"
                        const [alias, ...rest] = keyPath.split('.');
                        // Check if alias matches the arrayMode or objectMode variables
                        if (alias === itemAlias && arrayMode) {
                            let nestedValue = value;
                            for (const part of rest) {
                                nestedValue = nestedValue?.[part];
                                if (nestedValue === undefined) break;
                            }
                            if (nestedValue !== undefined) return nestedValue;
                        }
                        if (alias === valueAlias && objectMode) {
                            let nestedValue = value;
                            for (const part of rest) {
                                nestedValue = nestedValue?.[part];
                                if (nestedValue === undefined) break;
                            }
                            if (nestedValue !== undefined) return nestedValue;
                        }
                    }

                    // Direct references to the loop variables
                    if (keyPath === itemAlias && arrayMode) {
                        return value;
                    }
                    if (keyPath === valueAlias && objectMode) {
                        return value;
                    }
                    if (keyPath === keyAlias && objectMode) {
                        return key;
                    }

                    // If it doesn't match, leave it unresolved
                    return `{{${keyPath}}}`;
                });
            });

            // Build a loop context that includes the item/keys for placeholders.
            const loopContext = {
                ...data,
                // array mode => itemAlias
                // object mode => valueAlias/keyAlias
                ...(arrayMode ? { [itemAlias]: value, $index: index } : {}),
                ...(objectMode ? { [valueAlias]: value, [keyAlias]: key } : {}),
            };

            // Replace placeholders in *innerHTML*
            clone.innerHTML = clone.innerHTML.replace(/{{\s*([\w.$]+)\s*}}/g, (_, keyPath) => {
                if (keyPath.includes('.')) {
                    const [alias, ...rest] = keyPath.split('.');
                    // Check if alias is itemAlias or valueAlias
                    if (alias === itemAlias && arrayMode) {
                        let nestedValue = value;
                        for (const part of rest) {
                            nestedValue = nestedValue?.[part];
                            if (nestedValue === undefined) break;
                        }
                        if (nestedValue !== undefined) return nestedValue;
                    }
                    if (alias === valueAlias && objectMode) {
                        let nestedValue = value;
                        for (const part of rest) {
                            nestedValue = nestedValue?.[part];
                            if (nestedValue === undefined) break;
                        }
                        if (nestedValue !== undefined) return nestedValue;
                    }
                }
                // direct references
                if (keyPath === itemAlias && arrayMode) {
                    return value;
                }
                if (keyPath === valueAlias && objectMode) {
                    return value;
                }
                if (keyPath === keyAlias && objectMode) {
                    return key;
                }
                return `{{${keyPath}}}`;
            });

            // ************ IMPORTANT FIX ************
            // Put the clone into a DocumentFragment before processing conditionals & nested loops
            const fragment = document.createDocumentFragment();
            fragment.appendChild(clone);

            // Now run conditionals on the fragment so each clone has a valid parent
            processConditionalBlocks(fragment, loopContext);
            // Then process nested loops within that fragment
            processLoops(fragment, loopContext);

            // Finally, insert the fully-processed fragment back into the DOM
            originalEl.parentNode.insertBefore(fragment, originalEl);
        });

        // Remove the original element after all clones are inserted
        originalEl.parentNode.removeChild(originalEl);
    });
}

/**
 * Generates the range of page numbers to display
 * @param {object} context - The SearchCore instance
 * @returns {Array} Array of page numbers
 */
function generatePageRange(context) {
    const totalPages = Math.ceil(context.totalProductCount / context.gridProductsPerPage);
    const current = context.gridPage;
    const range = [];

    for (let i = Math.max(1, current - 2); i <= Math.min(totalPages, current + 2); i++) {
        range.push(i);
    }
    return range;
}

/**
 * Replaces template variables with actual values
 * @param {string} template - The HTML template
 * @param {object} data - The data object containing values
 * @returns {string} Processed template
 */
function replaceTemplateVariables(template, data) {
    return template.replace(/{{(.*?)}}/g, (match, key) => {
        const trimmedKey = key.trim();
        if (trimmedKey.includes('.')) {
            const [obj, prop] = trimmedKey.split('.');
            return data[obj]?.[prop] ??  `\{\{${trimmedKey}\}\}`;
        }
        return data[trimmedKey] ??  `\{\{${trimmedKey}\}\}`;
    });
}

/**
 * Attaches event listeners for custom attributes
 * @param {HTMLElement} container - The root container
 * @param {object} context - The SearchCore instance
 */
function attachListeners(container, context) {
    // Handle filter changes
    container.querySelectorAll('.facet-checkbox__input').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const filterName = e.target.closest('details').querySelector('.thb-filter-title').textContent.trim();
            const value = e.target.value;
            updateFilter(context, filterName, value, e.target.checked);
        });
    });

    // Handle sort changes
    const sortSelect = container.querySelector('#SortByBar');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            updateUrlParameter('sort', e.target.value);
            fetchData(context, context.inputElement.value.trim(), true).then(() => {
                renderGrid(context);
            });
        });
    }

    // Handle price filter changes
    const priceInputs = container.querySelectorAll('.price-filter input[type="range"]');
    priceInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const isMin = e.target.classList.contains('range-min');
            const value = parseInt(e.target.value);

            if (isMin) {
                context.priceMinValue = value;
                updateUrlParameter('min-price', value.toString());
            } else {
                context.priceMaxValue = value;
                updateUrlParameter('max-price', value.toString());
            }

            fetchData(context, context.inputElement.value.trim(), true).then(() => {
                renderGrid(context);
            });
        });
    });

    // Handle pagination clicks
    container.querySelectorAll('.page-numbers a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(new URL(e.target.href).searchParams.get('page'));
            goToPage(context, page);
        });
    });

    // Dynamic loops for @loop
    container.querySelectorAll('[\\@loop]').forEach((el) => {
        const loopExpression = el.getAttribute('@loop');
        const [itemName, arrayName] = loopExpression.split(' in ');

        // Navigate the data object path to get the array
        const arrayPath = arrayName.trim().split('.');
        let array = context;
        for (const path of arrayPath) {
            array = array[path.trim()];
            if (!array) break;
        }
        array = array || [];

        const parent = el.parentElement;

        array.forEach((item, index) => {
            const clone = el.cloneNode(true);
            clone.removeAttribute('@loop');

            // Replace all template variables in the clone
            clone.innerHTML = clone.innerHTML
                .replaceAll(`{{${itemName}.`, '{{') // Remove the item prefix
                .replace(/{{\s*\$index\s*}}/g, index) // Handle index variable
                .replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
                    // Handle nested properties
                    const props = key.trim().split('.');
                    let value = item;
                    for (const prop of props) {
                        value = value?.[prop];
                        if (value === undefined) break;
                    }
                    return value !== undefined ? value : '';
                });

            parent.insertBefore(clone, el);
        });

        parent.removeChild(el);
    });
}

/**
 * Updates filters and triggers re-rendering
 * @param {object} context - The SearchCore instance
 * @param {string} filterName - The name of the filter
 * @param {string} value - The filter value
 * @param {boolean} checked - Whether the filter is checked
 */
function updateFilter(context, filterName, value, checked) {
    if (checked) {
        context.availableFilters[filterName] = value;
        updateUrlParameter(filterName.toLowerCase(), value);
    } else {
        delete context.availableFilters[filterName];
        removeUrlParameter(filterName.toLowerCase());
    }

    fetchData(context, context.inputElement.value.trim(), true).then(() => {
        renderGrid(context);
    });
}

/**
 * Handles pagination navigation
 * @param {object} context - The SearchCore instance
 * @param {number} page - The target page number
 */
function goToPage(context, page) {
    context.page = (page - 1) * context.gridProductsPerPage;
    context.gridPage = page;
    updateUrlParameter('page', page.toString());

    fetchData(context, context.inputElement.value.trim(), true).then(() => {
        renderGrid(context);
    });
}
