console.log('XCOPILOT_SEARCH_BUILDER: search_builder.js script started execution.'); // SCRIPT START LOG

/**
 * xCopilot Search Builder UI Logic
 * This script should be initialized after its HTML (search_builder.html) is loaded into the DOM.
 */

function initializeSearchBuilder(containerElement, executeSearchCallback) {
    console.log('Initializing Search Builder within container:', containerElement);

    if (!containerElement) {
        console.error('Search Builder container element not provided!');
        return;
    }

    if (typeof executeSearchCallback !== 'function') {
        console.error('Search Builder: executeSearchCallback not provided or not a function!');
        // We can proceed but the search button inside the builder won't trigger main search
    }

    const performSearchButton = containerElement.querySelector('#perform-search');
    const resetSearchButton = containerElement.querySelector('#reset-search');

    // --- Helper function to get element by ID within the container --- 
    function getElem(id) {
        return containerElement.querySelector(`#${id}`);
    }

    // --- Function to gather data and build the search query --- 
    function buildSearchQuery() {
        let queryParts = [];
        console.log("Search Builder: Building search query...");

        // Content Category
        const keywords = getElem('content-keywords')?.value.trim();
        if (keywords) queryParts.push(keywords);

        const orKeywords = getElem('content-or-keywords')?.value.trim();
        if (orKeywords) queryParts.push(orKeywords); 

        const exactPhrase = getElem('content-exact-phrase')?.value.trim();
        if (exactPhrase) queryParts.push(`"${exactPhrase}"`);

        const wildcardPhrase = getElem('content-wildcard-phrase')?.value.trim();
        if (wildcardPhrase) {
            if (wildcardPhrase.startsWith('"') && wildcardPhrase.endsWith('"')) {
                queryParts.push(wildcardPhrase);
            } else {
                queryParts.push(`"${wildcardPhrase}"`);
            }
        }

        const excludeWord = getElem('content-exclude-word')?.value.trim();
        if (excludeWord) {
            queryParts.push(excludeWord.split(' ').filter(w => w).map(w => `-${w}`).join(' '));
        }
        
        const hashtag = getElem('content-hashtag')?.value.trim();
        if (hashtag) {
            queryParts.push(hashtag.split(' ').filter(h => h).map(h => h.startsWith('#') ? h : `#${h}`).join(' '));
        }

        const forceIncludeWord = getElem('content-force-include-word')?.value.trim();
        if (forceIncludeWord) {
            queryParts.push(forceIncludeWord.split(' ').filter(w => w).map(w => `+${w}`).join(' '));
        }

        const urlContains = getElem('content-url-contains')?.value.trim();
        if (urlContains) queryParts.push(`url:${urlContains}`);
        
        const language = getElem('content-language')?.value;
        if (language) queryParts.push(`lang:${language}`);

        const hasQuestion = getElem('content-has-question')?.checked;
        if (hasQuestion) queryParts.push('?');

        const selectedSentimentElement = containerElement.querySelector('input[name="sentiment"]:checked');
        if (selectedSentimentElement && selectedSentimentElement.value) {
            queryParts.push(selectedSentimentElement.value);
        }
        
        // TODO: Implement logic to collect data from other categories (Account, Filter, etc.)
        // These will also use getElem('input-id').value or .checked

        const finalQuery = queryParts.join(' ').trim();
        console.log("Search Builder: Generated Query:", finalQuery);
        return finalQuery;
    }

    // --- Function to execute the search (placeholder, actual execution is in content.js) --- 
    function executeSearch(query) {
        if (query && query.trim() !== '') {
            console.log('Search Builder: Would execute search with query:', query);
            // In the actual extension, this would typically send a message to content.js or background.js
            // For now, we rely on content.js to call buildSearchQuery and then execute.
            alert(`Search query from Search Builder: ${query}`); 
        } else {
            alert('Search Builder: Search query is empty.');
        }
    }
    
    // --- Function to reset the form --- 
    function resetSearchForm() {
        console.log("Search Builder: Resetting form...");
        const allTextInputs = containerElement.querySelectorAll('input[type="text"]');
        allTextInputs.forEach(input => input.value = '');
        
        const allSelects = containerElement.querySelectorAll('select');
        allSelects.forEach(select => select.selectedIndex = 0); 
        
        const allCheckboxes = containerElement.querySelectorAll('input[type="checkbox"]');
        allCheckboxes.forEach(checkbox => checkbox.checked = false);
        
        const sentimentAnyRadio = containerElement.querySelector('#sentiment-any');
        if (sentimentAnyRadio) sentimentAnyRadio.checked = true;
        
        console.log("Search Builder: Form reset.");
    }

    // --- Attach event listeners --- 
    if (performSearchButton) {
        performSearchButton.addEventListener('click', () => {
            const query = buildSearchQuery();
            if (typeof executeSearchCallback === 'function') {
                executeSearchCallback(query);
            } else {
                // Fallback or testing alert if no callback was provided
                alert("Search Builder's internal button clicked (no callback). Query: " + query);
                console.warn("Search Builder: executeSearchCallback not provided or not a function. Query not sent to content script.");
            }
        });
    } else {
        console.warn('Search Builder: Perform search button (#perform-search) not found in container.');
    }

    if (resetSearchButton) {
        resetSearchButton.addEventListener('click', () => {
            resetSearchForm();
            // Optionally, provide feedback through a callback if needed in the future
            // alert('Search Builder: Form has been reset!'); 
        });
    } else {
        console.warn('Search Builder: Reset search button (#reset-search) not found in container.');
    }

    // Make functions available to content.js if needed, though direct calls are better.
    // This approach is more self-contained.
    // If content.js needs to trigger these, it would be through the event listeners setup here
    // OR by exposing buildSearchQuery and resetSearchForm on the container or a global object if absolutely necessary.
    // For now, content.js will have its OWN buttons that, when clicked, will call these functions 
    // by having a reference to these functions or by re-implementing the call.

    // To allow content.js to get the query, we can attach the buildSearchQuery function to the container element
    // so content.js can call it. This is one way to bridge.
    containerElement.buildSearchQuery = buildSearchQuery;
    containerElement.resetSearchForm = resetSearchForm;

    console.log("Search Builder initialized successfully with callbacks.");
}

console.log('XCOPILOT_SEARCH_BUILDER: initializeSearchBuilder function has been defined.'); // FUNCTION DEFINED LOG

// Explicitly attach to window object for content.js to find (as a fallback, primary signal will be event)
window.XCopilotInitializeSearchBuilder = initializeSearchBuilder;
console.log('XCOPILOT_SEARCH_BUILDER: initializeSearchBuilder has been EXPLICITLY attached to window.XCopilotInitializeSearchBuilder.');

// Dispatch a custom event to signal that the search builder script is ready
const readyEvent = new CustomEvent('xcopilot_search_builder_ready', { detail: { status: 'success' } });
window.dispatchEvent(readyEvent);
console.log('XCOPILOT_SEARCH_BUILDER: Dispatched xcopilot_search_builder_ready event.');

// Remove the old DOMContentLoaded listener as initialization is now explicit
// document.addEventListener('DOMContentLoaded', () => { ... }); 