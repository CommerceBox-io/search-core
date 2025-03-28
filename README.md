# Commercebox Search Core

## Description

CommerceBox Search Core is a front-end search module for integrating with Commercebox APIs. It provides an interactive and customizable search experience, including autocomplete, advanced filtering, and grid-based results.

## Installation

Install this project:
```bash
npm install git+https://github.com/CommerceBox-io/search-core.git
or
yarn add search-core@git:CommerceBox-io/search-core

or add it as a script
<script src="https://cdn.commercebox.io/search-core/bundle.js" />
```

## Usage

Add the following HTML element to your page:

```html
<div id="search-plugin-container"></div>
```

To initialize the search module, import SearchCore from the search-core package and create a new instance with your options:

### Available options:

| **Option**              | **Type**          | **Description**                               | **Default** |
|-------------------------|-------------------|-----------------------------------------------|-------------|
| `apiEndpoint`           | `string`          | The API endpoint for search requests.         | Required    |
| `containerSelector`     | `string`          | The CSS selector for the container element.   | Required    |
| `layoutTemplate`        | `string`          | The layout template.                          | `""`        |
| `externalGridSelector`  | `string`       | The external grid ID.                         | `""`        |
| `searchPageRedirect`    | `string`          | The search page redirect URL.                 | `""`        |
| `addToCartCallback`     | `Function`        | The callback function for adding to cart.     | `null`      |
| `addToWishlistCallback` | `Function`    | The callback function for adding to wishlist. | `null`      |
| `addToCompareCallback`  | `Function`     | The callback function for adding to compare.  | `null`      |
| `uuid`                  | `string`          | The UUID, hash of user ID.                    | `""`        |
| `segment_id`            | `string`          | The segment ID.                               | `""`        |
| `segment_specialty_id`  | `string`       | The segment specialty ID.                     | `""`        |
| `urlParams`             | `Object`          | URL parameters to include in search requests. | `{}`        |
| `user`                  | `string`          | The unique user identifier.                   | `""`        |
| `locale`                | `string \| null`  | The locale.                                   | `"el"`      |
| `platform`              | `string \| null`  | The platform.                                 | `null`      |
| `sorting`               | `string \| null`  | The sorting.                                  | `"relevance"` |
| `translations`          | `Object \| null`  | The translations.                             | `null`      |
| `showProductImage`      | `boolean`         | Show/hide product images in popup results.    | `true`      |
| `showProductTitle`      | `boolean`         | Show/hide product titles in popup results.    | `true`      |
| `showProductPrice`      | `boolean`         | Show/hide product prices in popup results.    | `true`      |
| `showProductSku`        | `boolean`         | Show/hide product SKU in popup results.       | `true`      |

Example with required options:

```javascript
import SearchCore from 'search-core'

const options = {
    apiEndpoint: `https://api.commercebox.net/search`,
    containerSelector: '#search-plugin-container',
};

new SearchCore(options);
```

Example with all available options:

```javascript
import SearchCore from 'search-core';

document.addEventListener("DOMContentLoaded", () => {
    const options = {
        // Required parameters
        apiEndpoint: 'https://api.commercebox.net/search',
        containerSelector: '#search-plugin-container',
        
        layoutTemplate: 'https://cdn.commercebox.io/search/templates/template.html',
        externalGridSelector: '#external-results-grid',
        searchPageRedirect: '/search-page',
        
        showProductImage: true,
        showProductTitle: true,
        showProductPrice: false,
        showProductSku: false,

        uuid: 'guest', // Or unique user id
        segment_id: '5',
        segment_specialty_id: '12',
        urlParams: {
            q: "q",
            categories: "categories",
            scoped: "scoped",
            brand: "brand",
            maxPrice: "max-price",
            minPrice: "min-price",
            popupCategory: "popup-category",
            page: "page"
        },
        locale: 'en', // Default is 'el'
        platform: 'magento',
        sorting: [
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
        ],
        translations: {
            en: {
                searchPlaceholder: 'Search for products...',
                noResults: 'No products found',
                showMore: 'Load more results'
            },
            el: {
                searchPlaceholder: 'Αναζήτηση...',
                noResults: 'Δεν βρέθηκαν αποτελέσματα',
                showMore: 'Δες περισσότερα'
            }
        },
        
        // Callback functions for product actions
        addToCartCallback: (productId, quantity) => {
            console.log(`Adding product ${productId} to cart with quantity ${quantity}`);
            // Your cart logic here
        },
        addToWishlistCallback: (productId) => {
            console.log(`Adding product ${productId} to wishlist`);
            // Your wishlist logic here
        },
        addToCompareCallback: (productId) => {
            console.log(`Adding product ${productId} to compare list`);
            // Your compare logic here
        },
    };

    // Initialize search
    const search = new SearchCore(options);

    // Example of dynamically updating options
    document.getElementById('segment_id').addEventListener('change', (event) => {
        search.updateOptions({ segment_id: event.target.value });
    });
    
    document.getElementById('segment_specialty_id').addEventListener('change', (event) => {
        search.updateOptions({ segment_specialty_id: event.target.value });
    });
    
    // Example of updating the API endpoint
    document.getElementById('change_api').addEventListener('click', () => {
        search.updateOptions({ apiEndpoint: 'https://api-test.commercebox.net/search' });
    });
});
```

## Module Structure

The SearchCore library consists of several modules:

- **initializers**: Sets up core search functionality, initializes properties, user context, callbacks, and elements
- **domElements**: Creates and manages DOM elements for the search interface
- **events**: Defines custom events for search lifecycle phases
- **fetchers**: Handles API communication for search functionality
- **processors**: Processes templates and renders search results
- **utils**: Provides utility functions for URL parameters, translations, and more

## LAYOUT

The `layout.html` file contains several placeholders that are replaced with actual HTML elements during runtime. Here's a brief documentation for these placeholders:

The placeholders are specific strings enclosed in double curly braces, e.g. `{{placeholder}}`. There can be added attributes to the placeholder such as class, id, etc.
The attributes are added after the placeholder name, in braces, and follow the following format `{{placeholder[class="my-class", id="my-id"]}}`.

There are also two variables that can be used anywhere in the template and will be replaced by each value:

`{currentProductCount}`: This variable is replaced with the current number of products in the search results.

`{totalProductCount}`: This variable is replaced with the total number of products in the search results.


If a placeholder needs to have a title then `datatitle:"my title"` can be added to the placeholder as attribute. The title will be added as a div as first child of the element.
e.g. `{{containerElement[class:"suggested-items-list", datatitle:"Σας προτείνουμε τα παρακάτω ( {currentProductCount} από {totalProductCount} )"]}}`

### Search Placeholder Replacements

| **Placeholder**             | **Name**                     | **Type**   | **Description**                                                     |
|------------------------------|------------------------------|------------|---------------------------------------------------------------------|
| `{{containerElement}}`       | `containerElement`           | `div`      | Replaced with an empty container element.                          |
| `{{input}}`                  | `inputElement`              | `input`    | Replaced with an input field for the search term.                  |
| `{{suggestion}}`             | `suggestionElement`         | `div`      | Replaced with a list of suggested search terms.                    |
| `{{clear}}`                  | `clearButtonElement`        | `span`     | Replaced with a button for clearing the search input.              |
| `{{voiceSearch}}`            | `voiceSearchElement`        | `div`      | Replaced with an element for initiating voice search.              |
| `{{scanSearch}}`             | `scannerButtonElement`      | `div`      | Replaced with an element for initiating scan search.               |
| `{{searchButton}}`           | `searchButtonElement`       | `div`      | Replaced with a button for submitting the search.                  |
| `{{searchResults}}`          | `resultsElement`            | `span`     | Replaced with a list of search results.                            |
| `{{showAllResultsButton}}`   | `showAllResultsButtonElement` | `div`      | Replaced with a button for showing all search results.             |
| `{{typeahead}}`              | `typeaheadContainerElement` | `div`      | Replaced with a list of typeahead suggestions.                     |
| `{{categories}}`             | `categoriesContainerElement`| `div`      | Replaced with a container for categories list.                     |
| `{{brands}}`                 | `brandsContainerElement`    | `div`      | Replaced with a container for the list of brands.                  |
| `{{banner}}`                 | `bannerContainerElement`    | `div`      | Replaced with a container for the banner image.                    |
| `{{recentSearches}}`         | `recentSearchListElement`   | `div`      | Replaced with a container for a list of recent searches.           |
| `{{scannerContainer}}`       | `scannerContainer`          | `div`      | Replaced with a container for opening the camera and scanning a bar/QR code. |
| `{{grid}}`                   | `gridContainerElement`      | `div`      | Replaced with a grid container for displaying search results.       |
| `{{debugQueryContainer}}`    | `debugQueryContainer`       | `div`      | Replaced with a container for displaying the current search query. |
| `{{debugQueryButton}}`       | `debugQueryButton`          | `div`      | Replaced with a button for triggering the debug query view.        |
| `{{scopedSearchDropdown}}`   | `scopedSearchDropdown`      | `select`   | Replaced with a dropdown for selecting a category to filter the results. |


A complete layout example can be found in the `"https://cdn.commercebox.io/search/templates/template.html` file.


### Additional instructions

https://commercebox.atlassian.net/wiki/spaces/SD/pages/72679425/Additional+instuctions

### AI CHATBOT ASSISTANT

https://chatgpt.com/g/g-674445142f348191941680aca9e54de1-commercebox-search-core-assistant
