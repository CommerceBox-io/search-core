# Commercebox Search Core

## Description

This project is a front-end search module for Commercebox. It is built with JavaScript and uses the search-core package from Bitbucket.

## Installation

Install this project:
```bash
npm install git+https://github.com/CommerceBox-io/search-core.git
or
yarn add search-core@git:CommerceBox-io/search-core
```

## Usage

Add the following HTML element to your page:

```html
<div id="search-plugin-container"></div>
```

To initialize the search module, import SearchCore from the search-core package and create a new instance with your options:

Available options:

> **apiEndpoint**: Api endpoint for the search, it is required.
> 
> **containerSelector**: Selector for the container element, it is required.
> 
> **layoutTemplate**: Path to the layout template file, it is not required, default value: `'https://cube.commercebox.io/search/templates/template.html'`
> 
> **segment_id**: Segment id, it is not required, default value: `''`.
> 
> **segment_specialty_id**: Segment specialty id, it is not required, default value: `''`.

Example with required options:

```javascript
import SearchCore from 'search-core'

const options = {
    apiEndpoint: `https://api.commercebox.net/search`,
    containerSelector: '#search-plugin-container',
};

new SearchCore(options);
```
You can update segment options at any time after initialization by calling the `updateOptions` method:

```javascript
import SearchCore from 'search-core'

const netApiSearch = process.env.NET_API_SEARCH;

const options = {
    apiEndpoint: netApiSearch,
    containerSelector: '#search-plugin-container',
    segment_id: '',
    segment_specialty_id: ''
};

const search = new SearchCore(options);

document.addEventListener('DOMContentLoaded', (event) => {
    document.getElementById('segment_id').addEventListener('change', (event) => {
        search.updateOptions({ segment_id: event.target.value });
    });
    document.getElementById('segment_specialty_id').addEventListener('change', (event) => {
        search.updateOptions({ segment_specialty_id: event.target.value });
    });
});
```

## LAYOUT

The `layout.html` file contains several placeholders that are replaced with actual HTML elements during runtime. Here's a brief documentation for these placeholders:

The placeholders are specific strings enclosed in double curly braces, e.g. `{{placeholder}}`. There can be added attributes to the placeholder such as class, id, etc.
The attributes are added after the placeholder name, in braces, and follow the following format `{{placeholder[class="my-class", id="my-id"]}}`.

There are also two variables that can be used anywhere in the template and will be replaced by each value:

`{currentProductCount}`: This variable is replaced with the current number of products in the search results.

`{totalProductCount}`: This variable is replaced with the total number of products in the search results.


If a placeholder needs to have a title then `datatitle:"my title"` can be added to the placeholder as attribute. The title will be added as a div as first child of the element.
e.g. `{{containerElement[class:"suggested-items-list", datatitle:"Σας προτείνουμε τα παρακάτω ( {currentProductCount} από {totalProductCount} )"]}}`


1. `{{containerElement}}`: This placeholder is replaced with a container element if an empty `div` is needed, with attributes or not.

2. `{{input}}`: This placeholder is replaced with an input field for the search term.

3. `{{suggestion}}`: This placeholder is replaced with a list of suggested search terms.

4. `{{clear}}`, `{{voiceSearch}}`, `{{scanSearch}}`, `{{searchButton}}`: These placeholders are replaced with action elements for clearing the search input, initiating voice search, initiating scan search, and submitting the search respectively.

5. `{{searchResults}}`: This placeholder is replaced with a list of search results.

6. `{{showAllResultsButton}}`: This placeholder is replaced with a button for showing all search results.

7. `{{typeahead}}`: This placeholder is replaced with a list of typeahead suggestions.

8. `{{categories}}`: This placeholder is replaced with categories list.

9. `{{brands}}`: This placeholder is replaced with a list of brands.

10. `{{banner}}`: This placeholder is replaced with a banner image.

11. `{{recentSearches}}`: This placeholder is replaced with a list of recent searches.

12. `{{scannerContainer}}`: This placeholder is replaced with a container for the scanner to open the camera and scan a bar/qr code.

13. `{{grid}}`: This placeholder is replaced with a grid container for displaying search results in a grid layout.

14. `{{debugQueryContainer}}`: This placeholder is replaced with a container for displaying the current search query.

15. `{{debugQueryButton}}`: This placeholder is replaced with a button for displaying the current search query.

16. `{{scopedSearchDropdown}}`: This placeholder is replaced with a dropdown for selecting a category to filter the results.

A complete layout example can be found in the `https://cube.commercebox.io/search/templates/template.html` file.
