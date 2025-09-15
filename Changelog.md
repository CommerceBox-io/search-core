# Change Log

## [1.3.4] - 15-09-2025
### Fixed
- Make sure there is always url params available

## [1.3.3] - 10-09-2025
### Added
- Check if popup categories have a specific url and redirect to it if it is valid

## [1.3.2] - 22-08-2025
### Fixed
- Check for type of settings attributes and act accordingly

## [1.3.1] - 25-04-2025
### Added
- Get appearance settings from admin panel to override the default attributes but not the ones from init.
- Make locale required
- Add event listener to close the popup
 ### Fixed
- Fixed constant input focus on popup close

## [1.2.2] - 02-04-2025
### Added
- On search input click show the popup if there is a qualified value

## [1.2.1] - 11-18-2025
### Added
- Added init parameters to show/hide price, title, image and sku in popup

## [1.1.11] - 11-0e3-2025
### Fixed
- Fixed searched redirect from popup link for external search page and search button

## [1.1.10] - 25-02-2025
### Added
- Add relevance as default sorting option
### Fixed
- Fixed copy latest script after build

## [1.1.9] - 19-02-2025
### Fixed
- Make back camera default while scanning and add a switch and close button

## [1.1.8] - 14-01-2025
### Added
- Implemented a unique user ID for guest users.
    - During initialization, the `uuid` will either be the provided ID or "guest"
    - Automatically generates a unique id for guest users and saves it in the browser for future reference.

## [1.1.7] - 10-12-2024
### Added
- Implemented a connected version for the search core to a specific backend endpoint version
    - search core version 1.1.7 >> backend endpoint version 2
    - earlier versions by default connect to backend endpoint version 1

## [1] - 03-12-2024
### Added
- Initial version
