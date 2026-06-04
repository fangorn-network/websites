// Shared layout primitive for page sections.
//
// Renders a <section> wrapper with an optional heading and arbitrary children,
// so feature components only describe their content — not their layout.
//
// Props:
//   - className: wrapper class (default "section"; use "hero" for the hero block)
//   - title:     heading text (omit to render no heading)
//   - as:        heading tag, e.g. "h1" | "h2" (default "h2")
//   - children:  anything to embed inside the section
//
// The rendered DOM/classes intentionally match the existing markup so styling
// in styles.css continues to apply unchanged.
export default function Section({
  className = 'section',
  title,
  as: Heading = 'h2',
  children,
}) {
  return (
    <section className={className}>
      {title != null && <Heading>{title}</Heading>}
      {children}
    </section>
  )
}
