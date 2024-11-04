export function gridLoadedEvent() {
    const gridLoadedEvent = new CustomEvent("cbGridLoaded");
    document.dispatchEvent(gridLoadedEvent);
}
export function fetchDataEndedEvent() {
    const fetchDataEndedEvent = new CustomEvent("cbFetchEnded");
    document.dispatchEvent(fetchDataEndedEvent);
}
export function fetchTemplateEndedEvent() {
    const fetchTemplateEndedEvent = new CustomEvent("cbFetchTemplateEnded");
    document.dispatchEvent(fetchTemplateEndedEvent);
}
export function fetchAutocompleteEndedEvent() {
    const fetchAutocompleteEndedEvent = new CustomEvent("cbFetchAutocompleteEnded");
    document.dispatchEvent(fetchAutocompleteEndedEvent);
}
export function fetchSettingsEndedEvent() {
    const fetchSettingsEndedEvent = new CustomEvent("cbFetchSettingsEnded");
    document.dispatchEvent(fetchSettingsEndedEvent);
}
export function fetchMaxPriceEndedEvent() {
    const fetchMaxPriceEndedEvent = new CustomEvent("cbFetchMaxPriceEnded");
    document.dispatchEvent(fetchMaxPriceEndedEvent);
}
