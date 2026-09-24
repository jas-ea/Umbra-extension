# Umbra

Umbra is a Chrome extension that keeps the part of a webpage you are using clear and darkens everything around it.

Pause over a paragraph, message, post, list, or panel. Umbra waits one second, then darkens the surrounding page. Move to another section and it waits again before changing focus.

![Umbra keeping the current permissions explanation clear on Chrome Developers](../assets/screenshots/chrome-developers-permissions.png)

## Why we made it

Web applications often place several useful regions in the same visual field. An inbox has folders, search, message rows, actions, and a composer. A chat application has conversation history, controls, source panels, and an input box. A technical page may combine navigation, filters, reference links, code, and the current explanation.

We built Umbra after repeatedly losing the current item inside pages like these. The surrounding interface still mattered, so hiding it or moving the content elsewhere was the wrong interaction. We wanted to lower its visual weight while keeping the page intact.

Umbra applies that idea directly. The current section remains clear. Everything around it becomes darker. The website keeps working in place.

## How it behaves

Umbra uses the pointer, page structure, scrolling, and interaction state to choose a useful section. It waits before acting because passing over a sidebar or toolbar is different from staying on an article, message, or list.

The extension also changes scale with the task:

- Articles, opened messages, posts, questions, and answers can focus individually.
- Multi-screen conversation turns narrow to the paragraph, list, code block, table, or figure under the pointer.
- Inboxes, calendars, tables, grids, and conversations stay together while the user scans them.
- Menus, dialogs, editing, dragging, and fullscreen temporarily suspend the overlay.
- User-started video can remain the active region when the pointer moves away.
- Choose an area lets the user select a section directly.

The popup contains one main action, page darkness, behavior for the current site, tab pause, and Settings. Timing and geometry remain product defaults so normal use does not require setup.

## Why the name Umbra

The [umbra is the darkest part of a shadow](https://eclipse.gsfc.nasa.gov/SEhelp/SEglossary.html). We chose the name because darkness is the product's interface: the page recedes around the section in use.

## Research behind the design

Ruth Rosenholtz, Yuanzhen Li, and Lisa Nakano studied how visual clutter affects search. Their feature-congestion measure correlated with the time people needed to find a target in a display. The work established a useful design premise: surrounding visual structure can affect how quickly a person finds what they need. Read the [Journal of Vision paper](https://doi.org/10.1167/7.2.17) or [MIT's summary](https://news.mit.edu/2007/mits-clutter-detector-could-cut-confusion).

Aleena Gertrudes Niklaus, Tianyuan Cai, Zoya Bylinskii, and Shaun Wallace later evaluated four digital reading-ruler designs with 91 readers with dyslexia and 86 readers without dyslexia. Their results showed that localized visual treatments can affect reading speed and preference, with the largest gains among readers with dyslexia. Read the [CHI 2023 paper](https://doi.org/10.1145/3544548.3581367) or the [Adobe Research summary](https://research.adobe.com/publication/digital-reading-rulers-evaluating-inclusively-designed-rulers-for-readers-with-dyslexia-and-without/).

These studies informed Umbra's use of local contrast suppression and adjustable darkness. They are design inputs, not evidence that Umbra improves comprehension, productivity, accessibility, or wellbeing. Product-level benefits require product-level evaluation.

## The technical problem

Drawing a dark overlay is straightforward. Choosing the right section is harder.

The element under a pointer may be an icon inside a button inside a toolbar inside a message. An outer wrapper may be named for a composer even though it also contains the conversation. A single answer may span several screens. Modern applications also reuse page elements, create menus outside their visual parent, and change routes without loading a new document. A useful system must identify the task scale, reject controls and application chrome, wait for stable intent, and release the previous section promptly.

Umbra combines site profiles with semantic HTML, geometry, readable-content density, repeated structure, pointer residence, scrolling, and explicit media or editing states. One coordinator handles automatic switching, while direct selection and user-started media remain explicit actions. The page map stays in memory and is rebuilt as the document changes.

## Local processing

Page structure, pointer position, and selection geometry are processed inside the browser. Preferences and per-site modes use Chrome storage. Umbra has no analytics, remote code, cloud model, or product server.

The extension uses broad website access because its function runs on the pages where the user enables it. The [privacy policy](../../umbra-extension/PRIVACY.md) documents every stored value and permission.

## Release

Umbra 2.7.0 is an open-source release candidate from [Cassini Research](https://cassiniresearch.com/). The code is available under the MIT License. The initial release will use the Chrome Web Store, GitHub, and technical communities to collect reproducible examples from difficult websites.

Cassini Research: [Website](https://cassiniresearch.com/) · [GitHub](https://github.com/Cassini-Research) · [X](https://x.com/CassiniRes) · [LinkedIn](https://www.linkedin.com/company/cassini-research/)
