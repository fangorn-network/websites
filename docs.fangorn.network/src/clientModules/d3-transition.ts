// Mermaid calls selection.transition(), which d3-transition adds as a side effect. d3 declares
// sideEffects: false, so a production build drops it and hovering a node throws
// "tooltipElem.transition is not a function". Importing it here keeps it.
import 'd3-transition';
