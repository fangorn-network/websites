// Shared layout primitive for the page footer landmark.
//
// Renders a <footer> wrapper (with the existing "footer container" classes)
// and accepts arbitrary children, so footer content can be rearranged or
// extended without touching the wrapper.
//
// Props:
//   - className: wrapper class (default "footer container")
//   - children:  footer content
//
// The rendered DOM/classes match the existing markup so styling in styles.css
// continues to apply unchanged.
export default function FooterBar({ className = 'footer container', children }) {
  return <footer className={className}>{children}</footer>
}
