export function gridLoadedEvent(data = null) {
    const gridLoadedEvent = new CustomEvent("cbGridLoaded", {
        detail: data
    });
    document.dispatchEvent(gridLoadedEvent);
}
export function fetchDataEndedEvent(data = null) {
    const fetchDataEndedEvent = new CustomEvent("cbFetchEnded", {
        detail: data
    });
    document.dispatchEvent(fetchDataEndedEvent);
}
export function fetchTemplateEndedEvent(data = null) {
    const fetchTemplateEndedEvent = new CustomEvent("cbFetchTemplateEnded", {
        detail: data
    });
    document.dispatchEvent(fetchTemplateEndedEvent);
}
export function fetchAutocompleteEndedEvent(data = null) {
    const fetchAutocompleteEndedEvent = new CustomEvent("cbFetchAutocompleteEnded", {
        detail: data
    });
    document.dispatchEvent(fetchAutocompleteEndedEvent);
}
export function fetchSettingsEndedEvent(data = null) {
    const fetchSettingsEndedEvent = new CustomEvent("cbFetchSettingsEnded", {
        detail: data
    });
    document.dispatchEvent(fetchSettingsEndedEvent);
}
export function fetchMaxPriceEndedEvent(data = null) {
    const fetchMaxPriceEndedEvent = new CustomEvent("cbFetchMaxPriceEnded", {
        detail: data
    });
    document.dispatchEvent(fetchMaxPriceEndedEvent);
}
