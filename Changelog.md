# Change Log

## [1.1.9] - 19-02-2025
### Added
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
