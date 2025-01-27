import {fetchData} from "./fetchers";
import {formatPrice, updateUrlParameter} from "./utils";

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
                <div @loop="sorting in sortByList" value="{{sorting.key}}">
                        <span @if="sorting.key === sortBy" class="">a</span><span @else>b</span>
                        {{sorting.value}}
                </div>
<!--                <select id="cb_sorting_select">-->
<!--                    <option @loop="sorting in sortByList" value="{{sorting.key}}">-->
<!--                        {{sorting.value}}-->
<!--                    </option>-->
<!--                </select>-->
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
                 <div class="selected-filters" @if="selectedFilters.length">
                    aaaaaa {{selectedFilters}}
                 </div>
                 <div class="filter categories">
                    <div class="title">categories</div>
                    <div class="items">
                       <div>
                          <div class="children-container">
                             <div>
                                <div class="filter-item root-category">Ρούχα (9)</div>
                                <div class="children-container">
                                   <div>
                                      <div class="filter-item">Ανδρικά (6)</div>
                                      <div class="children-container">
                                         <div>
                                            <div class="filter-item">Πλεκτά (6)</div>
                                         </div>
                                      </div>
                                   </div>
                                   <div>
                                      <div class="filter-item">Γυναικεία (3)</div>
                                      <div class="children-container">
                                         <div>
                                            <div class="filter-item">T-Shirts -Tops (3)</div>
                                         </div>
                                      </div>
                                   </div>
                                </div>
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
    let html = generateTemplate();
    html = replaceTemplateVariables(html, context);

    context.gridContainerElement.innerHTML = html;
    processLoops(context.gridContainerElement, context);
    processConditionalBlocks(context.gridContainerElement, context);
    attachListeners(context.gridContainerElement, context);
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

        // Add support for direct value comparison
        if (expression.includes('===')) {
            const [left, right] = expression.split('===').map(part => part.trim());
            const leftValue = left.includes('.') ?
                left.split('.').reduce((obj, key) => obj?.[key], safeCtx) :
                safeCtx[left];
            const rightValue = right.replace(/['"]/g, '');
            return leftValue === rightValue;
        }

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
        // Not an object, return as-is (string, number, etc.)
        return original;
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
 * Naive approach: replace top-level identifiers with `ctx.<identifier>`
 * so that "data.results.length" becomes "ctx.data.results.length".
 * This *will* break if your expression has keywords, strings, or other edge cases.
 */
function rewriteExpression(expr) {
    // A very naive regex: word characters that aren't preceded by '.' or ':'
    // You may need something more sophisticated if your expressions are complex.
    return expr.replace(/(?<![.\w])([a-zA-Z_$][0-9a-zA-Z_$]*)/g, 'ctx.$1');
}

/**
 * Processes @if, @elseif, and @else blocks in the container.
 * Keeps only the first truthy block or the @else if none are truthy.
 * @param {HTMLElement} container
 * @param {object} context - your search context or data object
 */
function processConditionalBlocks(container, context) {
    // Find all elements with @if, @elseif, or @else
    const conditionalElems = Array.from(
        container.querySelectorAll('[\\@if], [\\@elseif], [\\@else]')
    );

    let i = 0;
    while (i < conditionalElems.length) {
        const ifElem = conditionalElems[i];
        const ifExpr = ifElem.getAttribute('@if');
        if (!ifExpr) {
            i++;
            continue;
        }

        // We have an @if, gather subsequent @elseif or @else
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
                const elseifExpr = blockGroup[k].getAttribute('@elseif');
                const isElse = blockGroup[k].hasAttribute('@else');

                if (elseifExpr) {
                    if (evaluateExpression(elseifExpr, context)) {
                        keepIndex = k;
                        break;
                    }
                } else if (isElse) {
                    // Keep the @else if nothing else matched
                    keepIndex = k;
                    break;
                }
            }
        }

        // Keep only the matched element, remove the rest
        blockGroup.forEach((elem, idx) => {
            if (idx === keepIndex) {
                elem.removeAttribute('@if');
                elem.removeAttribute('@elseif');
                elem.removeAttribute('@else');
            } else {
                elem.parentNode?.removeChild(elem);
            }
        });

        // Move on to next
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
    const loopElems = Array.from(container.querySelectorAll('[\\@loop]'));

    loopElems.forEach((originalEl) => {
        const rawExpr = originalEl.getAttribute('@loop')?.trim();
        if (!rawExpr) return;

        // Remove the attribute from the original element
        originalEl.removeAttribute('@loop');

        // Parse the expression
        let arrayMode = false;
        let objectMode = false;

        let itemAlias = '';
        let valueAlias = '';
        let keyAlias = '';
        let dataExpr = '';

        // Handle "item in array" or "(value, key) in object"
        const objectLoopPattern = /^\(\s*([^,]+)\s*,\s*([^)]+)\)\s+in\s+(.+)$/;
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

        // Navigate the data object path (e.g., "context.sortByList")
        const pathParts = dataExpr.split('.');
        let dataRef = data;
        for (const part of pathParts) {
            if (dataRef == null || typeof dataRef !== 'object') break;
            dataRef = dataRef[part.trim()];
        }

        if (dataRef == null) {
            console.warn(`@loop: Could not find dataRef for "${dataExpr}"`);
            return;
        }

        // Determine entries to iterate over (array vs object)
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

        // Iterate over entries and clone/replace
        entries.forEach(([key, value], index) => {
            const clone = originalEl.cloneNode(true);

            // Replace placeholders in attributes and innerHTML
            Array.from(clone.attributes).forEach((attr) => {
                attr.value = attr.value.replace(/{{\s*([\w.$]+)\s*}}/g, (_, keyPath) => {
                    if (keyPath.includes('.')) {
                        const [alias, ...rest] = keyPath.split('.');
                        if (alias === itemAlias && typeof entries[index][1] === 'object') {
                            let nestedValue = entries[index][1];
                            for (const part of rest) {
                                nestedValue = nestedValue?.[part];
                                if (nestedValue === undefined) break;
                            }
                            if (nestedValue !== undefined) return nestedValue;
                        }
                    }
                    if (keyPath === valueAlias) return value;
                    if (keyPath === keyAlias) return key;
                    return `{{${keyPath}}}`; // Keep unresolved placeholders intact
                });
            });

            const loopContext = {
                ...data,
                [arrayMode ? itemAlias : valueAlias]: value,
                [objectMode ? keyAlias : '$index']: key
            };

            clone.innerHTML = clone.innerHTML.replace(/{{\s*([\w.$]+)\s*}}/g, (_, keyPath) => {
                if (keyPath.includes('.')) {
                    const [alias, ...rest] = keyPath.split('.');
                    if (alias === itemAlias && typeof entries[index][1] === 'object') {
                        let nestedValue = entries[index][1];
                        for (const part of rest) {
                            nestedValue = nestedValue?.[part];
                            if (nestedValue === undefined) break;
                        }
                        if (nestedValue !== undefined) return nestedValue;
                    }
                }
                if (keyPath === valueAlias) return value;
                if (keyPath === keyAlias) return key;
                return `{{${keyPath}}}`;
            });

            processConditionalBlocks(clone, loopContext);

            // Process any nested loops
            processLoops(clone, loopContext);

            // Insert the modified clone into the DOM
            originalEl.parentNode.insertBefore(clone, originalEl);
        });

        // Remove the original element
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
