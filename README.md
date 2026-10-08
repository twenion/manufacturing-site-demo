# Kəsim — demo manufacturing site

A static site for a fictional Azerbaijani sheet-metal manufacturer, built as a
portfolio piece and sales demo. The company, address, production records and
prices are fictional; the forms send and store nothing, and the site says so.

**Live:** https://twenion.github.io/manufacturing-site-demo/

13 pages · live quote calculator · sheet-nesting diagram · no framework · no
runtime build · no CDN · no cookies

## The demo set

Four sales demos for Azerbaijani small businesses. They share one technical bar,
but each has a different commercial argument and page shape.

| Demo | Business | Product shape |
| --- | --- | --- |
| [`cargo-site-demo`](https://github.com/twenion/cargo-site-demo) | Courier | Tracking, tariffs and an order form |
| [`ecommerce-site-demo`](https://github.com/twenion/ecommerce-site-demo) | Skincare retail | A 24-product catalogue and cart |
| [`hotel-site-demo`](https://github.com/twenion/hotel-site-demo) | Guesthouse | 365 visible nightly prices and booking |
| `manufacturing-site-demo` **← you are here** | Metal fabrication | A specification bench and measurable quote |

## The commercial argument

Manufacturing sites often list machine names but omit the numbers an engineer
needs before sending a drawing: supported material and thickness, bed size,
tolerance, minimum order, lead time and even an indicative price. The result is a
long email exchange before either side knows whether the part is a fit.

Kəsim starts with the opposite assumption. An interactive metal part moves from
laser cutting to bending and coating. A full-width workshop photograph leads into
the working quote bench. Enter a rectangular part's material, thickness,
dimensions, quantity and follow-up operations; the page immediately publishes:

- the best row-and-column layout on a 1500 × 3000 mm sheet;
- sheet count, material use and offcut percentage;
- finished material weight and estimated lead time; and
- an indicative price range with its limits stated beside it.

The detailed request form then collects the information that actually changes a
production quote: drawing, material, quantity, finish, critical dimensions and
required date. It validates in the browser and clearly states that the demo sends
nothing.

## The signature: the sheet is the interface

The live nesting map is both the site's visual identity and a useful explanation
of its calculation. Change the part dimensions and the SVG redraws the layout,
including rotation when it fits more parts. The same values drive the utilization,
offcut, weight and price results — the diagram cannot disagree with the number
beside it.

This creates a manufacturing-shaped page rather than a generic corporate site
with different copy. Its structure borrows from a job traveller: specification
fields, process abbreviations, dimensional marks and an inspection ledger. The
isometric part, workshop photograph and animated nesting map show the work
at three scales: finished part, factory and sheet.

## What is included

- Four process pages: fiber laser cutting, CNC bending, MIG/TIG welding and powder
  coating, each with actual dimensional and acceptance limits.
- A material table covering S235JR, AISI 304 and EN AW-5754, including stocked
  thicknesses, sheet format, density and the calculation basis.
- A sample first-article inspection report with nominal dimension, tolerance,
  measured result, instrument and disposition in the same row.
- A detailed RFQ form and a separate technical-contact form. Both validate and
  then explicitly confirm that this demo sent no data.
- Useful output with JavaScript disabled: every limit, material, process and
  contact fallback remains ordinary HTML.
- Responsive layouts down to 320 px, keyboard focus, 44 px controls and reduced
  motion support.

## The bar it is held to

`tools/audit.py` checks every generated page against the same faults used in a
client audit:

| Check | Requirement |
| --- | --- |
| Language | `<html lang="az">` on every page |
| Heading | exactly one non-empty, subject-specific `<h1>` |
| Search metadata | sensible, unique title and description |
| Sharing | complete Open Graph text fields and URL |
| Canonical | one exact GitHub Pages URL per page |
| Structured data | valid, filled JSON-LD; Service schema on process pages |
| Links and assets | every local target exists; no runtime third-party request |
| Protocols | valid `mailto:` and `tel:` links |
| Images | meaningful `alt`, or `alt=""` plus `aria-hidden` for decoration |
| Placeholders | no TODO, lorem ipsum or scaffold copy |
| Discovery | `robots.txt` and a sitemap containing exactly the public pages |

The self-test copies the site to a temporary directory, breaks it nine different
ways and proves that each fault is caught. That includes an invalid language,
missing H1, `mail:` typo, broken internal link, remote script, placeholder copy,
invalid JSON-LD, wrong canonical and missing description.

```bash
python tools/build_pages.py
python tools/audit.py
python tools/audit_selftest.py
```

## Technical decisions

- **Static HTML, CSS and vanilla JavaScript.** The site can be handed to a client
  as a folder and hosted without a framework, package install or build service.
- **No CDN.** All authored assets are in the repository, so rendering does not
  depend on a third party. The audit rejects remote runtime assets.
- **Alloy and petrol identity.** Cool pale surfaces, deep petrol work areas, copper
  cutting accents and large system sans headings bring the material into the page.
  There is no font download.
- **Project-owned photography.** Two original industrial images were created for
  this fictional brand and optimized locally; there is no stock-photo hotlink or
  third-party image request at runtime.
- **Motion explains fabrication.** A single arrival sequence shows laser cutting,
  bending and coating; three keyboard-accessible controls replay each state.
  Workshop parallax follows scrolling and nesting reacts to dimensions.
  `prefers-reduced-motion` removes animations, transitions and parallax.
- **Specification handoff.** The calculator pre-fills the RFQ using a URL fragment,
  never a server query. Invalid dimensions clear the estimate. Without JavaScript,
  the calculator and demo submit controls are hidden; the static content remains.
- **Fiction stays labelled.** Zeroed phone numbers, a reserved `.example` email,
  explicit demo notices and no invented clients, certificates or awards.

## Licence

Code is MIT licensed. The fictional brand and demo content are provided as a
portfolio example, not as claims about a real manufacturer.

## Redesign verification (2026-10-08)

Run the existing audit and fault-injection suite before publishing. Browser QA
covers the three fabrication states, 320–1920 px homepage layouts, mobile menu
and Escape, nesting bounds at minimum/maximum dimensions, 500-part rendering,
price changes, invalid input and specification handoff.
