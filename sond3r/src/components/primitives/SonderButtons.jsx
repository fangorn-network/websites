// A row of Sonder-styled buttons.
//
// Each item renders as a link when it has an `href`, or a <button> when it has
// an `onClick`. Pass `external` to open a link in a new tab, and `active` to
// show the filled/selected state.
//
// items: Array<{ label, href?, onClick?, external?, active? }>
export default function SonderButtons({ items }) {
  return (
    <div className="button-row">
      {items.map((item) => {
        const className = `button${item.active ? ' active' : ''}`

        return item.href ? (
          <a
            key={item.label}
            className={className}
            href={item.href}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
          >
            {item.label}
          </a>
        ) : (
          <button
            key={item.label}
            type="button"
            className={className}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
