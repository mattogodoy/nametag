# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.43.0](https://github.com/mattogodoy/nametag/compare/v0.42.2...v0.43.0) (2026-04-22)


### Features

* add API endpoint for name display format preference ([7664808](https://github.com/mattogodoy/nametag/commit/766480825d946e5b35fb2cdd6585772971fd5527))
* add group filtering in network graph ([8df671a](https://github.com/mattogodoy/nametag/commit/8df671ab910e6fa005eaa9aa002b6b701de0a151))
* add i18n translations for name display format setting ([1627fd3](https://github.com/mattogodoy/nametag/commit/1627fd3d1de13d5d329863bdb1b997f12cebe3b1))
* add missing locale strings for pending languages ([87a1117](https://github.com/mattogodoy/nametag/commit/87a1117230aeb581757fa37ef1acbc5df5abdc99))
* add Name Display Format selector to appearance settings ([cbd6dd1](https://github.com/mattogodoy/nametag/commit/cbd6dd1120861f5354820c0f80d1b74192246788))
* add NameDisplayFormat enum and user preference field ([00266c0](https://github.com/mattogodoy/nametag/commit/00266c02f4d5067e94d3b9622e58a3354f716fb8))
* add nameDisplayFormat parameter to name formatting functions ([0f2bd3d](https://github.com/mattogodoy/nametag/commit/0f2bd3dc4a92f47b36afc99d9d370c02d267da4d))
* add random color generation ([04f551a](https://github.com/mattogodoy/nametag/commit/04f551a51e83d6b8b5526a83f06135221abe3f90))
* apply nameDisplayFormat to upcoming events and reminder emails ([43b44fa](https://github.com/mattogodoy/nametag/commit/43b44fadbc05c4dae1f607c75c7ff69a0bb846cb))
* **auth:** emit auth.login.succeeded and auth.login.failed domain events ([e4e8646](https://github.com/mattogodoy/nametag/commit/e4e86466f556697315c3add59ad1ef37c60570df))
* **carddav:** emit autoExport.failed and autoUpdate.failed domain events ([a46d816](https://github.com/mattogodoy/nametag/commit/a46d8161d024b1729c8f45a18d617e4499975d87))
* **carddav:** emit sync.finished, push.failed, conflict.created domain events ([0b5926f](https://github.com/mattogodoy/nametag/commit/0b5926f7c7d4de30ec0442f4f4de08e84b5622b7))
* configurable name display format ([4da4306](https://github.com/mattogodoy/nametag/commit/4da43068b739e74a2744d99ce2c67483f96bb612))
* **cron:** open jobId scope and emit cron.carddav.* events ([5c1960a](https://github.com/mattogodoy/nametag/commit/5c1960afffaa0e3d32fe22eb6b6735534a192375))
* **errors:** add AppError and ExternalServiceError base classes ([d25ef48](https://github.com/mattogodoy/nametag/commit/d25ef48cc97efddf44e4e7361ea933c1d1ec78da))
* **http:** open ALS scope in withLogging, add userId in withAuth ([d128269](https://github.com/mattogodoy/nametag/commit/d1282698cf6ede1c6b756043ec73644b541273b2))
* integrate GraphFilterHelpModal and refactor filter pill rendering in UnifiedNetworkGraph ([a3172be](https://github.com/mattogodoy/nametag/commit/a3172be80c28a22f53eafc176bbaa2e1b175b953))
* **logger:** add ALS mixin and AppError-aware err serializer ([98f2d89](https://github.com/mattogodoy/nametag/commit/98f2d894b8dabaa5515c14171c92e11a809081ea))
* **logging:** add AsyncLocalStorage-backed request context ([a001f9c](https://github.com/mattogodoy/nametag/commit/a001f9c7ac0eb32e1107ed504c0b51f4e0560617))
* **logging:** add readBodySafely for capturing truncated HTTP error bodies ([b2f49e9](https://github.com/mattogodoy/nametag/commit/b2f49e9bfc50d0e8bbe8907ab26e0177bee6016e))
* pass nameDisplayFormat through graph routes ([905b69b](https://github.com/mattogodoy/nametag/commit/905b69b27c8c7ccb912301dfbd70191a78c227d5))
* propagate nameDisplayFormat to all name display call sites ([0a22b9f](https://github.com/mattogodoy/nametag/commit/0a22b9f8f2e6e949527360b585bce89ff130e332))


### Bug Fixes

* add missing translation for generate random color button ([aad0f00](https://github.com/mattogodoy/nametag/commit/aad0f00c32ac040104e91e1194a0212ca234526e))
* add nameDisplayFormat to mock user objects in locale test ([e7f4dce](https://github.com/mattogodoy/nametag/commit/e7f4dce736674ebc2f07fe0bf0204ca7423901ae))
* add nameDisplayFormat to profile endpoint and OpenAPI spec ([0b515e7](https://github.com/mattogodoy/nametag/commit/0b515e7316c6e39bd3ef8bc4c4a7f7e31694cf27))
* apply nameDisplayFormat to pills and timeline, keep dropdowns showing full names ([314e9f4](https://github.com/mattogodoy/nametag/commit/314e9f48fa3806e5f8073c48031d9261d03e6f69))
* **carddav:** capture response body and throw ExternalServiceError on HTTP failures ([309de9d](https://github.com/mattogodoy/nametag/commit/309de9da394d423f69ff8856bc8a28356302d44e))
* change modal backdrop to use new opacity syntax ([79ca8b9](https://github.com/mattogodoy/nametag/commit/79ca8b901a068965c5bc001fcaaf83993093e11e))
* graph group pill and aria labels ([d119c60](https://github.com/mattogodoy/nametag/commit/d119c606b00492ffc5ba45fbeacd306e90d2688e))
* improve visual design of graph filter help button ([5ee98c2](https://github.com/mattogodoy/nametag/commit/5ee98c2f4ada4ec674948d9653b9f99bded0ea89))
* **logger:** bindings and record fields win over ALS mixin; context spread can't overwrite err fields ([86eabd3](https://github.com/mattogodoy/nametag/commit/86eabd3af9b48c131e2e6dce6bb993769f09b1c2))
* modal focus trap logic ([3576fa3](https://github.com/mattogodoy/nametag/commit/3576fa395e6e0aada61eac822e06094b70c16cf2))
* pass nameDisplayFormat from all server pages to client components ([dc9a3f4](https://github.com/mattogodoy/nametag/commit/dc9a3f4df343a4db566a73d9d595dbab18879e43))
* remove unused formatFullName import from RelationshipManager ([9ad4b71](https://github.com/mattogodoy/nametag/commit/9ad4b7181cdb784b301a27032a42249e9e69132a))
* resolve typecheck errors in new test files and normalize personId context in syncToServer ([3ba3c94](https://github.com/mattogodoy/nametag/commit/3ba3c94203d5fcf334f78c8983c7fde1c4c2f4ae))
* specify locale in formatDateWithoutYear function to ensure correct month names regardless of system locale settings ([1d0f8e4](https://github.com/mattogodoy/nametag/commit/1d0f8e4cfa43c5415b63462e579ad6d67c447b0a))
* update OpenAPI spec to reflect new group filtering options for dashboard graph endpoint ([256b50a](https://github.com/mattogodoy/nametag/commit/256b50afc465b0909b95d6054c2d1e8e33e80eac))
* update test to match new button label for generating random color ([7726a0f](https://github.com/mattogodoy/nametag/commit/7726a0f6ac787f9f770077e6eaa8828cfb086ac6))
* use formatGraphName for display-name contexts so nickname-preferred works ([fa16567](https://github.com/mattogodoy/nametag/commit/fa1656756f86cc43e4a7335fa29435c7f1f3d55f))
* use formatGraphName in all display-name contexts so nickname-preferred works everywhere ([2e1fefe](https://github.com/mattogodoy/nametag/commit/2e1fefeafc67a61bb8d1189113f5d334a538d614))
* use new icon in relationship type form ([f9e509f](https://github.com/mattogodoy/nametag/commit/f9e509fb943bba9c75cd6e10d32de907745f016e))

## [0.42.2](https://github.com/mattogodoy/nametag/compare/v0.42.1...v0.42.2) (2026-04-09)


### Bug Fixes

* use native ARM64 runner instead of QEMU emulation ([0a3b224](https://github.com/mattogodoy/nametag/commit/0a3b224062dc640a22d7e04cc74b7e928f57ac19))
* use native ARM64 runner instead of QEMU emulation ([fb1e053](https://github.com/mattogodoy/nametag/commit/fb1e05300ba1128bf875631f11c6c92a7d17b7dd))

## [0.42.1](https://github.com/mattogodoy/nametag/compare/v0.42.0...v0.42.1) (2026-04-09)


### Bug Fixes

* add z-index for navbar to fix search stacking issue ([d213f06](https://github.com/mattogodoy/nametag/commit/d213f0632a865ae84e2320ea48f721f32779e1cf))
* add z-index for navbar to fix search stacking issue ([3db785d](https://github.com/mattogodoy/nametag/commit/3db785d2d950def517fa15f8d5cdeedbb92109c4))
* make orphan warning tooltip readable in light mode ([2571814](https://github.com/mattogodoy/nametag/commit/2571814f2a1055b389a5708218c34e4180248c1b))
* make orphan warning tooltip readable in light mode ([b48876f](https://github.com/mattogodoy/nametag/commit/b48876f2e5a5450d1d8d5cd347e1bd44f182612b)), closes [#209](https://github.com/mattogodoy/nametag/issues/209)

## [0.42.0](https://github.com/mattogodoy/nametag/compare/v0.41.0...v0.42.0) (2026-03-31)


### Features

* redesign release notes to be warmer and less technical ([869b9e6](https://github.com/mattogodoy/nametag/commit/869b9e62b815dcd93cdd885f1803ff0d7c523fcd))


### Bug Fixes

* prevent UniqueConstraintViolation on personId during CardDAV import ([e7c809f](https://github.com/mattogodoy/nametag/commit/e7c809f80c67d76cec5bb02e1bf2d3db5eb62766))
* prevent UniqueConstraintViolation on personId during CardDAV import ([f1841de](https://github.com/mattogodoy/nametag/commit/f1841de340acaa6825d2d24ea1acd44a27c1d307)), closes [#197](https://github.com/mattogodoy/nametag/issues/197)
* suppress already-mapped contacts from CardDAV import UI ([e2a87c5](https://github.com/mattogodoy/nametag/commit/e2a87c51e865c3bffd1ae089c0bdbab308e5bbd2))
* suppress already-mapped contacts from CardDAV import UI ([ef05544](https://github.com/mattogodoy/nametag/commit/ef05544612279124c5ce1998f672de2d58e465d7))

## [0.41.0](https://github.com/mattogodoy/nametag/compare/v0.40.0...v0.41.0) (2026-03-29)


### Features

* add delete button with confirmation dialog to journal entry detail ([0548d47](https://github.com/mattogodoy/nametag/commit/0548d47eed373c5166b92f8ff86d6253dd9d84f4))
* add GET and POST /api/journal endpoints ([c0df406](https://github.com/mattogodoy/nametag/commit/c0df406269ec94926f9e82c696dbe1f86b658f09))
* add GET/PUT/DELETE /api/journal/[id] endpoints ([1dc2e37](https://github.com/mattogodoy/nametag/commit/1dc2e37a54db77a8e7fdf6de451900be61c5a6d2))
* add journal endpoints to OpenAPI spec ([a7cf5e5](https://github.com/mattogodoy/nametag/commit/a7cf5e5455361d0a056cd3eb7fdf60f896544e74))
* add journal pages — timeline, new, detail, edit ([3bad3f5](https://github.com/mattogodoy/nametag/commit/3bad3f5521b362922c273868212a37de0d675206))
* add journal section to person detail page ([92bd26d](https://github.com/mattogodoy/nametag/commit/92bd26d6c1add2071d26d9d96a07b1320a774619))
* add Journal to navigation bar ([0b5d310](https://github.com/mattogodoy/nametag/commit/0b5d310113d426cc47aba020b3d88c079d414243))
* add journal translations for all 6 locales ([1e8896d](https://github.com/mattogodoy/nametag/commit/1e8896d51ad52e049d75ddb116412dac8718137b))
* add journal Zod validation schemas ([7542120](https://github.com/mattogodoy/nametag/commit/754212027127ce7b7ff1fc54cbcb466a8dc25cd7))
* add JournalEntry and JournalEntryPerson models ([ae9c382](https://github.com/mattogodoy/nametag/commit/ae9c382f975d193541460cf4c88f3720222ae926))
* add JournalEntryForm client component ([181517f](https://github.com/mattogodoy/nametag/commit/181517f3c107ec585cfb483a616f9f7c3027446e))
* add JournalTimeline component with month grouping ([ed81335](https://github.com/mattogodoy/nametag/commit/ed813359b5a94f8caa0736a5b5c5f60b43ba9375))
* add success toast on journal entry save ([1e2e239](https://github.com/mattogodoy/nametag/commit/1e2e239d36254a25259289b5806f923251935275))
* center and widen search bar, rename Relationship Types to Relationships in nav ([320a1d3](https://github.com/mattogodoy/nametag/commit/320a1d3bb118c2c803ab369aa0aab403147da671))
* include journal entries in JSON import/export ([db30c0d](https://github.com/mattogodoy/nametag/commit/db30c0dd01012581962ed57671e5786bdaf2e213))
* increase entry preview to text-sm with 3-line clamp and more padding ([27c5ca0](https://github.com/mattogodoy/nametag/commit/27c5ca00a20bc4594c80cf49732e831b92c64743))
* Journal — encounters timeline with person integration ([4ba7c48](https://github.com/mattogodoy/nametag/commit/4ba7c48a9b7022347bbce788313ffa872a5f4bf2))
* remove create buttons from desktop nav tab bar ([b9a4c4c](https://github.com/mattogodoy/nametag/commit/b9a4c4cf16c007745c5cd548ea986d558c50f010))
* restyle nav items as tab bar with underline active indicator ([574af14](https://github.com/mattogodoy/nametag/commit/574af14cffe7bbf1dfc6aeeb76a8511d3a03612b))
* strengthen entry card hover with 60% border opacity and shadow ([09c9848](https://github.com/mattogodoy/nametag/commit/09c98481af98b49269bc8aafd2d6fdfbd8cf3947))
* style Write one as pill button matching Update to today ([bf8259f](https://github.com/mattogodoy/nametag/commit/bf8259fad31e5e9c2161b43ff753dd640aa72b89))
* truly center search bar using absolute positioning ([001cd47](https://github.com/mattogodoy/nametag/commit/001cd47e444081e9bfd62e93a41ceb2923e57447))
* two-row navbar — logo/search/user on top, nav items centered below ([b14f945](https://github.com/mattogodoy/nametag/commit/b14f9454da6077e87a3137a1bfad5341a7f78747))
* use PillSelector for multi-person filtering on journal page ([c428baf](https://github.com/mattogodoy/nametag/commit/c428baf9ff9f8f1d38057ac2902d27e7d38ed3f0))
* use warm accent color for timeline dots and month headers ([d606f55](https://github.com/mattogodoy/nametag/commit/d606f5579d53826051e5c365fbfdcc07e80c6a45))
* warmer empty state copy for first-time journal experience ([6fb786a](https://github.com/mattogodoy/nametag/commit/6fb786aa8e8f48ca14d43ea0d34041c9c2743de1))
* warn on unsaved changes when navigating away from journal form ([00d44af](https://github.com/mattogodoy/nametag/commit/00d44afc751ff51778b04b0d01b2f5d3344fa2d9))


### Bug Fixes

* **a11y:** add aria-current to nav, label to search, fix tooltip aria-describedby ([da9ced7](https://github.com/mattogodoy/nametag/commit/da9ced7392fb9da266db25eee6b4312dc255d627))
* **a11y:** add aria-live to error, aria-busy to submit, article wrapper for body ([09ba183](https://github.com/mattogodoy/nametag/commit/09ba18363d1bca47e2ff70109859321c839ec6b4))
* **a11y:** add dialog role and aria-modal to mobile menu ([3fe1ed5](https://github.com/mattogodoy/nametag/commit/3fe1ed5dbba550480376bcc4e62bd782f2c626f4))
* **a11y:** expand checkbox touch target to 44px with label wrapping ([1a21753](https://github.com/mattogodoy/nametag/commit/1a21753cb77547ca1605f115b55e2cbdf3dd33c5))
* add journalEntry mock to export tests ([1f7c575](https://github.com/mattogodoy/nametag/commit/1f7c575b3d0ab30495a77a4c00e7f297ce79fee7))
* align search bar with nav items by removing mx-auto ([b40f0bd](https://github.com/mattogodoy/nametag/commit/b40f0bdf4e6f48c6f507f62c95ab9af9c815b510))
* bump nav breakpoint to xl to prevent overlap with 5 items ([7637a96](https://github.com/mattogodoy/nametag/commit/7637a96773941f75135c98c26932f9a9ff686d58))
* derive filter state from URL props so nav resets filters ([9a07fc2](https://github.com/mattogodoy/nametag/commit/9a07fc2f60a64ab022a2a8b4d492734dd19854f5))
* destructure locale prop in JournalSection ([f3a860f](https://github.com/mattogodoy/nametag/commit/f3a860f266ab15346dcb29eca1c32d94a804ecf6))
* extract journal filters into client component for interactivity ([35ded7c](https://github.com/mattogodoy/nametag/commit/35ded7c23a9de56f2ce9c474c1e1850dc139a8a9))
* handle ISO date strings in JournalTimeline date parsing ([18b6b1f](https://github.com/mattogodoy/nametag/commit/18b6b1fda191383d38c80831ce9357084baa8cbd))
* make search and person filter interactive on journal page ([8167fc5](https://github.com/mattogodoy/nametag/commit/8167fc55f3ca6678f1e3669149b0368b7a03a7fa))
* narrow nameOrder type in JournalFilters to fix build ([e04a915](https://github.com/mattogodoy/nametag/commit/e04a91565bdb43baa8c116fa0a42aa9d83a6d682))
* normalize person pill sizing between timeline and detail page ([2c72f0e](https://github.com/mattogodoy/nametag/commit/2c72f0eed73c24b685c14438c088ff11769d277c))
* pass locale to JournalSection to prevent hydration mismatch ([2ed98cf](https://github.com/mattogodoy/nametag/commit/2ed98cf4642911f34f1d6aaa3064f31970a133a7))
* **polish:** enlarge tooltip button to 20px, remove redundant title attr ([fd6fb58](https://github.com/mattogodoy/nametag/commit/fd6fb58684eafb57c1a01152d2d9eea38c49ac62))
* **polish:** use Button component, fix 11px badge text to 12px ([ff85d7d](https://github.com/mattogodoy/nametag/commit/ff85d7d174d93558525dd47bd512e851cb4262d8))
* prevent duplicate person pill from React strict mode double-effect ([4c1fa7a](https://github.com/mattogodoy/nametag/commit/4c1fa7a54e325489b68fa6e6db7252dc27749715))
* read entry.id from API response correctly in journal form ([6d50031](https://github.com/mattogodoy/nametag/commit/6d50031e193361904068c5f86a90de819cf96299))
* remove misleading trash recovery message from delete confirmation ([044f870](https://github.com/mattogodoy/nametag/commit/044f8704e1be2de19ebc425102c10ccb34fd3ece))
* remove redundant Filter by person label from journal filters ([dd86a71](https://github.com/mattogodoy/nametag/commit/dd86a71d74c7c436a43a73aa934a5ecb9e6894cb))
* require children for ConfirmationModal, update delete description ([6626e56](https://github.com/mattogodoy/nametag/commit/6626e56d3bcc4b231daea6b41600f03dd467a904))
* resolve lint errors — unused import, const, hook order, unused var ([a754875](https://github.com/mattogodoy/nametag/commit/a75487533424c0d90fa1c6fc39b599ac33c908a4))
* **responsive:** responsive date column, tooltip overflow, nav search padding ([7f2b7a9](https://github.com/mattogodoy/nametag/commit/7f2b7a96616901f46e034cabb3edfd970471515c))
* security/data integrity fixes from PR review ([b94dce2](https://github.com/mattogodoy/nametag/commit/b94dce28507976f422ae8718268c4fb554879664))
* sort journal entries by date desc then createdAt desc ([f4012a6](https://github.com/mattogodoy/nametag/commit/f4012a67643540cef101909cfde99c64d1425553))
* sort journal entry on person detail by date then createdAt desc ([00a98a3](https://github.com/mattogodoy/nametag/commit/00a98a32eed7f3bdbc431e3141e16f93161ca6fe))
* use book icon instead of plus in Write one button ([23eacff](https://github.com/mattogodoy/nametag/commit/23eacff91ea1e8567d6dc91e6c217f4a16601f09))
* use EASTERN enum value for name order in JournalSection ([bfe014e](https://github.com/mattogodoy/nametag/commit/bfe014e1c8c9586e4e426d9f5877595b64fe5b1a))


### Performance

* move navIcons/navItems to module scope, memoize groupByMonth ([ce1cc78](https://github.com/mattogodoy/nametag/commit/ce1cc78b125da5989019a2018d1c4e10b0c85292))

## [0.40.0](https://github.com/mattogodoy/nametag/compare/v0.39.2...v0.40.0) (2026-03-26)


### Features

* UI overhaul — warm palette, accessibility, design tokens, performance ([7b45f74](https://github.com/mattogodoy/nametag/commit/7b45f7454e42de31b1b932f545b44dc1bce193d8))
* UI overhaul — warm palette, accessibility, design tokens, performance ([1374679](https://github.com/mattogodoy/nametag/commit/137467965cf89beae83eec21897f742dc2a00e5f))

## [0.39.2](https://github.com/mattogodoy/nametag/compare/v0.39.1...v0.39.2) (2026-03-23)


### Bug Fixes

* resolve CSRF origin rejection and legacy date validation on self-hosted setups ([da610ab](https://github.com/mattogodoy/nametag/commit/da610ab5200f9b21a5ea8d286ee6346fd7011d4f))
* resolve CSRF origin rejection and legacy date validation on self-hosted setups ([ac3a8ad](https://github.com/mattogodoy/nametag/commit/ac3a8adbc3cbf799878a9d4c8bb9526fe633401c)), closes [#180](https://github.com/mattogodoy/nametag/issues/180)

## [0.39.1](https://github.com/mattogodoy/nametag/compare/v0.39.0...v0.39.1) (2026-03-18)


### Bug Fixes

* downgrade JWTSessionError logging from error to debug level ([8d3abf1](https://github.com/mattogodoy/nametag/commit/8d3abf1f484b99f9cd0889a14e44461f0378d471))
* resolve TS2698 spread error in auth logger debug callback ([f41a18d](https://github.com/mattogodoy/nametag/commit/f41a18dcd12ca5f2ae1f27ec303964ed459e9440))

## [0.39.0](https://github.com/mattogodoy/nametag/compare/v0.38.2...v0.39.0) (2026-03-17)


### Features

* add predefined important date type constants and display helper ([1b160b3](https://github.com/mattogodoy/nametag/commit/1b160b31c2abaf88c4c178f2c6bdae394c871d3e))
* add predefined important date type translations for all 6 locales ([e76f694](https://github.com/mattogodoy/nametag/commit/e76f6940a2b378b15a4575e8d365dd1ff6cfc5bf))
* add reusable ComboboxInput component for editable dropdowns ([64533ed](https://github.com/mattogodoy/nametag/commit/64533edaf44d27cb342f659810ef0c09afb6ece1))
* add type field to important date validation schemas ([ce715dd](https://github.com/mattogodoy/nametag/commit/ce715dd742f06ad393c8fd01a3cc5acce05dfd31))
* add type field to ImportantDate with migration backfill ([95e6eba](https://github.com/mattogodoy/nametag/commit/95e6eba46101ebfddae7d7ebedecd1dca15c05d7))
* add type field to ImportantDateItem interface and PersonForm props ([ba2043d](https://github.com/mattogodoy/nametag/commit/ba2043d9a11c2afd4ee4160fd8bd028a2849f688))
* pass type field through service layer, API routes, and restore endpoint ([36fe3ff](https://github.com/mattogodoy/nametag/commit/36fe3ff6ae7896362847636485a019a42339c2e5))
* predefined important date types with combobox UI ([77bc79b](https://github.com/mattogodoy/nametag/commit/77bc79b33572a125c72f265a7ac0e9040eef8e79))
* replace title text input with combobox in ImportantDatesManager ([30b40f7](https://github.com/mattogodoy/nametag/commit/30b40f74485ccccac1bab0e9b646da60b8a81264))


### Bug Fixes

* CardDAV import sets type field for BDAY/ANNIVERSARY roundtrip ([3ce7bd3](https://github.com/mattogodoy/nametag/commit/3ce7bd3b8c4a0e131e6fdfaea5cf00491f133a08))
* remove partial unique index to avoid Prisma drift, enforce uniqueness in app layer ([f3a1d3c](https://github.com/mattogodoy/nametag/commit/f3a1d3cd0a91d01fc0cbb46175a5451c5d9ead58))
* resolve lint errors in ComboboxInput (effect setState, ARIA attributes) ([5820c31](https://github.com/mattogodoy/nametag/commit/5820c318dbf9f8fed1a292ba145a6a1b04825676))
* use getDateDisplayTitle for localized date title display across all sites ([0ba0bef](https://github.com/mattogodoy/nametag/commit/0ba0bef32ccd6c21ca018314183d99af30405c68))
* use type field for CardDAV BDAY/ANNIVERSARY export (language-proof) ([b494cfa](https://github.com/mattogodoy/nametag/commit/b494cfafb08babed69d5face2d14bd5e6170f3a9))
* widen formatDateForEmail locale type to support all locales ([c5148cb](https://github.com/mattogodoy/nametag/commit/c5148cb30fb8335c0525bc1487b88cdff418a1ff))

## [0.38.2](https://github.com/mattogodoy/nametag/compare/v0.38.1...v0.38.2) (2026-03-15)


### Bug Fixes

* remove duplicate auth key in locale files causing missing translations ([e1a858f](https://github.com/mattogodoy/nametag/commit/e1a858fe28e9c5320bcd5bd256ee1cdd9ed9899f))

## [0.38.1](https://github.com/mattogodoy/nametag/compare/v0.38.0...v0.38.1) (2026-03-15)


### Bug Fixes

* copy locales directory to production Docker image ([c1356a3](https://github.com/mattogodoy/nametag/commit/c1356a35cd4caf053de0bcff31867bf802efc1c8))

## [0.38.0](https://github.com/mattogodoy/nametag/compare/v0.37.1...v0.38.0) (2026-03-15)


### Features

* add account lockout after 10 failed login attempts ([0a765f1](https://github.com/mattogodoy/nametag/commit/0a765f125d62e3c91f2ec4a640e902e7771b908d))
* add account lockout fields to User model ([975669c](https://github.com/mattogodoy/nametag/commit/975669c6f11601d49b30d3d1b7dee8f6488e652b))
* add StripeEvent model for webhook idempotency ([670d7a8](https://github.com/mattogodoy/nametag/commit/670d7a82df9914a8a7cc3239326daf4fc406f5eb))
* send email notification on account lockout with i18n ([16ef3e0](https://github.com/mattogodoy/nametag/commit/16ef3e01532a160263aa065456205db5211f774f))


### Bug Fixes

* add 5-second DNS resolution timeout to SSRF checks ([0a965de](https://github.com/mattogodoy/nametag/commit/0a965de0dfdee2d0c3831cc94105095f11205eb9))
* add CSRF origin validation to state-changing API endpoints ([eab27a9](https://github.com/mattogodoy/nametag/commit/eab27a90f9838c5b0eaa7bd18758803208c2e64a))
* add CSRF validation to unauthenticated auth endpoints ([93bfcdb](https://github.com/mattogodoy/nametag/commit/93bfcdbb08dd98de9ef4346f429ce9381e06c68c))
* add idempotency to Stripe webhook handler using unique constraint ([77329de](https://github.com/mattogodoy/nametag/commit/77329dee4990a1f82d78c59ba5349e472242ac05))
* add missing lockout fields to locale test mock objects ([91b1a23](https://github.com/mattogodoy/nametag/commit/91b1a236c70f9ec67fc36bdf9d86b8c1ebb69ea6))
* add rate limiting to email verification endpoint ([1c92410](https://github.com/mattogodoy/nametag/commit/1c9241013391b127578836f858854b6bc25792f2))
* add SSRF protection to photo URL downloads ([41b2645](https://github.com/mattogodoy/nametag/commit/41b26452a040b06eb424a45033360757ca9e19f8))
* expand Permissions-Policy header to restrict additional browser features ([377ddcc](https://github.com/mattogodoy/nametag/commit/377ddcc252c0111f81fe376eff81a8cfbf403a3c))
* hash email verification tokens before storing in database ([5e5ce3b](https://github.com/mattogodoy/nametag/commit/5e5ce3b4b3646d6ea57e6b94c1167d0637acafa5))
* hash password reset tokens before storing in database ([f115463](https://github.com/mattogodoy/nametag/commit/f1154636ac22febb0cf44dc41e3cd60aff44a450))
* make CSP environment-aware — unsafe-eval only in development ([d237a72](https://github.com/mattogodoy/nametag/commit/d237a720c7c4382eccf4f1a58a30a4d8f3ae3b66))
* remove unsafe-eval from CSP script-src directive ([54c8e3a](https://github.com/mattogodoy/nametag/commit/54c8e3ad8936953d0cb67de999a2678e5217779f))
* remove unsafe-inline from CSP script-src directive ([3c2fd16](https://github.com/mattogodoy/nametag/commit/3c2fd164f3bb297a7f2e8faf384180e09802a293))
* require STRIPE_WEBHOOK_SECRET in SaaS mode env validation ([fb10653](https://github.com/mattogodoy/nametag/commit/fb1065362bc260325abea78f7d1231b66ac1fc7b))
* resolve TypeScript error in csrf.ts missing return statement ([938f6aa](https://github.com/mattogodoy/nametag/commit/938f6aa5ef3ab75f0e0f4b460ae23eb90281fa11))
* restore unsafe-inline in CSP — required for Next.js hydration ([e22d046](https://github.com/mattogodoy/nametag/commit/e22d0463bedd3f8af3483be9b0a8b256fd6a6ee5))
* update lockout email test to use objectContaining for flexibility ([015f9c4](https://github.com/mattogodoy/nametag/commit/015f9c45de366a3c12341e4ec50b8f765fbe04e0))
* validate locale in lockout email, surface account-locked error to user ([68cd6d8](https://github.com/mattogodoy/nametag/commit/68cd6d8c999f0499e28d8ddf1a0edbf215dfd137))
* validate PHOTO_STORAGE_PATH and prevent path traversal ([e2280da](https://github.com/mattogodoy/nametag/commit/e2280da508e1484a1c49f11296886c2335d48090))

## [0.37.1](https://github.com/mattogodoy/nametag/compare/v0.37.0...v0.37.1) (2026-03-13)


### Bug Fixes

* avoid server-only imports in ImportContactsList client component ([7143271](https://github.com/mattogodoy/nametag/commit/714327111d4945abf92f52e5456e44de6e05c5c5))
* resolve 28 TypeScript errors failing CI type check ([0180a85](https://github.com/mattogodoy/nametag/commit/0180a85be8bbe2b9e402d5a752136353cc6790fa))
* resolve eslint warnings for unused imports and console statement ([40bbf2b](https://github.com/mattogodoy/nametag/commit/40bbf2bedc1f6a07eaaa2fba1c0e2278551db52a))
* use CardDavConnection type in merge route deleteSecondaryVCard ([2561d65](https://github.com/mattogodoy/nametag/commit/2561d6578d3bfd9f1402ab8e0b6b63a61ec461fc))

## [0.37.0](https://github.com/mattogodoy/nametag/compare/v0.36.0...v0.37.0) (2026-03-13)


### Features

* add eastern name order support to formatting functions ([1b1c452](https://github.com/mattogodoy/nametag/commit/1b1c4527f1234134a0b6ad8985874883009e006d))
* add name order i18n translations for all 6 locales ([570b674](https://github.com/mattogodoy/nametag/commit/570b6745457a313d8003c6840328e0adffedc841))
* add name order selector to appearance settings ([3d42f64](https://github.com/mattogodoy/nametag/commit/3d42f6404c17ef4b50127350d9082c4fb7713e73))
* add name-order API route and validation schema ([349cad3](https://github.com/mattogodoy/nametag/commit/349cad390344ac721b8067e439259fd0298c9820))
* add NameOrder enum and nameOrder field to User model ([42aef63](https://github.com/mattogodoy/nametag/commit/42aef63230c90eab0cafc59474857182d4f2a010))
* auto-detect CJK characters to omit spaces in eastern name order ([b97aa17](https://github.com/mattogodoy/nametag/commit/b97aa170155112d70161d5ea7c82be338dada62a))
* Eastern name order support ([a48b89a](https://github.com/mattogodoy/nametag/commit/a48b89a5adc8bddfd28d48714ef5a4edd4d46dc2))
* thread nameOrder through all client-side call sites ([4ecc303](https://github.com/mattogodoy/nametag/commit/4ecc3036345d17ffb516ffc2fa62438341e4fac4))
* thread nameOrder through server-side call sites ([a5c791e](https://github.com/mattogodoy/nametag/commit/a5c791e45ee4b008aba17dd88602e71c3d06a19d))
* update test reminder script with nameOrder param ([bd27be2](https://github.com/mattogodoy/nametag/commit/bd27be2fcf5edeb397c3dd818d01051706bacb61))


### Bug Fixes

* use formatFullName for title and full name on person details page ([ef575f3](https://github.com/mattogodoy/nametag/commit/ef575f3138ee02363e595b18dc890f64d9d2ae00))

## [0.36.0](https://github.com/mattogodoy/nametag/compare/v0.35.0...v0.36.0) (2026-03-11)


### Features

* add "Merge with..." option to person actions menu ([61c06c4](https://github.com/mattogodoy/nametag/commit/61c06c48d7684459d8491a4d0fba0e15db419acf))
* add ability to dismiss false positive duplicate pairs ([10aea62](https://github.com/mattogodoy/nametag/commit/10aea625abfe9cbcf1b6b35ab3b993f31fd2a67e))
* contact merge improvements ([6d46987](https://github.com/mattogodoy/nametag/commit/6d46987d92dda324ce6a8f8097021893900289db))


### Bug Fixes

* add navigation bar and back buttons to duplicates and merge pages ([6be4533](https://github.com/mattogodoy/nametag/commit/6be453330f67581a0da5073c4856b46c56122480))
* improve duplicate detection by comparing name and surname separately ([597ab69](https://github.com/mattogodoy/nametag/commit/597ab69eec1dffacd86d6186369c3bd11340837f))
* prevent merge modal from clipping autocomplete dropdown ([2423bbe](https://github.com/mattogodoy/nametag/commit/2423bbefb84c69684e4e09181a87581cbfc9de49))

## [0.35.0](https://github.com/mattogodoy/nametag/compare/v0.34.0...v0.35.0) (2026-03-11)


### Features

* add group filter to people list page ([6d2b823](https://github.com/mattogodoy/nametag/commit/6d2b823b70e658ad94db0f195c0569649946182b))
* add relationship filter to people list page ([1b0c54b](https://github.com/mattogodoy/nametag/commit/1b0c54bff3b3cd6268da8bdea864c1bec5d97dad))


### Bug Fixes

* allow zooming out further in network graphs ([178c5a7](https://github.com/mattogodoy/nametag/commit/178c5a7b7da97766cec66b28261f40b3e1e7d653))
* back-to-people link preserves pagination without history.back ([d1f0e38](https://github.com/mattogodoy/nametag/commit/d1f0e3893f7fc402873d3d0deb5fad4a79d0a541))
* count custom relationship types in JSON import preview ([8a85181](https://github.com/mattogodoy/nametag/commit/8a85181c960125a838eb01e1e0aff74d9b2519b8))
* move select-all-pages prompt into the floating action bar ([a8e3d08](https://github.com/mattogodoy/nametag/commit/a8e3d08c06910c86a5c664ad0b0dc0c426ca71b9))
* scroll search results to keep highlighted item visible ([cf2f0ab](https://github.com/mattogodoy/nametag/commit/cf2f0abd8bdec6377f11ede7d442c0b9ffb80eb8))
* show 0-0 instead of 1-0 when filters return no results ([daa4c98](https://github.com/mattogodoy/nametag/commit/daa4c98b70fa16d88096b95d2a9020f808a8aa23))
* show empty table instead of empty state when filters yield no results ([ace787b](https://github.com/mattogodoy/nametag/commit/ace787be7a1957155cf83c446fdf7008e3820fc4))
* use useSyncExternalStore for BackLink sessionStorage read ([e5e9c3a](https://github.com/mattogodoy/nametag/commit/e5e9c3a2c3f721f816adc9b21b046c1f36145e1b))
* use useSyncExternalStore for BackLink sessionStorage read ([f11a73a](https://github.com/mattogodoy/nametag/commit/f11a73a4650a4fc987fe699619e6a41256668909))

## [0.34.0](https://github.com/mattogodoy/nametag/compare/v0.33.0...v0.34.0) (2026-03-10)


### Features

* accent-insensitive search and multi-word query support ([6ad5794](https://github.com/mattogodoy/nametag/commit/6ad57948855f686f22a487e29ba964eefcf6ddf5))
* add accent-insensitive search utility ([31eefb5](https://github.com/mattogodoy/nametag/commit/31eefb5aa01f9bbc1effa622d5ee23ed5f8277d1))
* normalize accents in duplicate detection ([3bedc48](https://github.com/mattogodoy/nametag/commit/3bedc481cf3bbc3d0e3657c9c4c0213933849230))
* use accent-insensitive search in people search API ([929cfb9](https://github.com/mattogodoy/nametag/commit/929cfb93699308d8d111ec15e9865fa9935300ce))
* use accent-insensitive search in PersonAutocomplete ([77cbf53](https://github.com/mattogodoy/nametag/commit/77cbf53dc1959513d2c6986a34dbea11f700b3d3))
* use accent-insensitive search in PillSelector ([46a3796](https://github.com/mattogodoy/nametag/commit/46a37967e93b5f9ecc52e585d8c313640b59c125))
* use accent-insensitive search in RelationshipTypeAutocomplete ([e8114cc](https://github.com/mattogodoy/nametag/commit/e8114ccda12b37906139e6c96ec03e00e9624e6a))


### Bug Fixes

* resolve TypeScript errors in filterPeople generic constraint ([87db2a8](https://github.com/mattogodoy/nametag/commit/87db2a88c34be46a4aa4766b4824cebe865ccef3))
* sort people list by full name (name + surname) for name and surname columns ([0190ed9](https://github.com/mattogodoy/nametag/commit/0190ed93a24b8f198382dd7fbd63a0f8404c85a9))
* sort people list by full name for name and surname columns ([244d7c2](https://github.com/mattogodoy/nametag/commit/244d7c22ca2283811a62f26f50712374cc9b0f29))
* support multi-word search queries spanning name fields ([4c306b3](https://github.com/mattogodoy/nametag/commit/4c306b36c315dbfb1207dfe6f0aa8599b20f79a2))

## [0.33.0](https://github.com/mattogodoy/nametag/compare/v0.32.1...v0.33.0) (2026-03-10)


### Features

* add i18n keys for PhotoSourceModal component ([29122a7](https://github.com/mattogodoy/nametag/commit/29122a7378908f596b19f5f4c643355fff91afb0))
* add option to remove last contact date from person form ([c6461fe](https://github.com/mattogodoy/nametag/commit/c6461fe85e5aa0ba9eff2395b7e8077a4d81d748))
* add PhotoSourceModal component with file/drag/paste support ([02bce8b](https://github.com/mattogodoy/nametag/commit/02bce8bfe6711a0c65be3d84d8a4a74d7b1228aa))
* integrate PhotoSourceModal into PersonForm ([4cd45be](https://github.com/mattogodoy/nametag/commit/4cd45bebc5ecdf55257e3cd07482242ddf001493))


### Bug Fixes

* disable CardDAV sync by default when creating a new person ([20dcbe3](https://github.com/mattogodoy/nametag/commit/20dcbe359153f15accbef70a01a075d70ed7ac24))
* remove unused variables and imports flagged by linter ([57a222e](https://github.com/mattogodoy/nametag/commit/57a222e6dbeab24057cec364febbc4e456754e7b))
* remove unused waitFor import from PhotoSourceModal tests ([99d56e9](https://github.com/mattogodoy/nametag/commit/99d56e937cd89145e46ae7080948636ac121c2e1))

## [0.32.1](https://github.com/mattogodoy/nametag/compare/v0.32.0...v0.32.1) (2026-03-10)


### Bug Fixes

* **photos:** avoid EXDEV error when saving photos with Docker bind-mounts ([0edac50](https://github.com/mattogodoy/nametag/commit/0edac50354697c7b3112415c0bf9fe8ab0561d17)), closes [#139](https://github.com/mattogodoy/nametag/issues/139)
* **photos:** avoid EXDEV error with Docker bind-mounts ([5cca9ad](https://github.com/mattogodoy/nametag/commit/5cca9adad10a63ec33fe88e5c754292a408618b0))

## [0.32.0](https://github.com/mattogodoy/nametag/compare/v0.31.1...v0.32.0) (2026-03-07)


### Features

* **carddav:** accept addressBookUrl and addressBookName when creating connection ([6f6c9d9](https://github.com/mattogodoy/nametag/commit/6f6c9d92b6d0501d0cc806572fd6582888efa1fa))
* **carddav:** add address book selection wizard step component ([f47e789](https://github.com/mattogodoy/nametag/commit/f47e78910e436a574501ae9f73bb3686f5f6857d))
* **carddav:** add addressBookUrl and addressBookName to CardDavConnection ([d0d4cf9](https://github.com/mattogodoy/nametag/commit/d0d4cf9956f5055c807bc451da817421bca6b98c))
* **carddav:** add i18n keys for address book selection wizard step ([5b94f71](https://github.com/mattogodoy/nametag/commit/5b94f71477adccc9ceda268e7a493553b1dd69a0))
* **carddav:** add shared getAddressBook helper for collection selection ([381092e](https://github.com/mattogodoy/nametag/commit/381092e1214a4d0a542f3ddc303c9bd970a3947d))
* **carddav:** address book collection selection ([68adc7e](https://github.com/mattogodoy/nametag/commit/68adc7ead6e12312c038f1d7ab10589116f2cf35))
* **carddav:** integrate address book selection into connection wizard ([47bf064](https://github.com/mattogodoy/nametag/commit/47bf064b55f91d38c26a5ab293c33fae05021a48))
* **carddav:** return address book list from test connection endpoint ([714c6f3](https://github.com/mattogodoy/nametag/commit/714c6f347ca464b2bae20b987e470d4c52d34691))
* **carddav:** show contact count per address book in wizard ([4b81169](https://github.com/mattogodoy/nametag/commit/4b81169c6e4ba211f106d8abc50b8d3183287033))


### Bug Fixes

* **carddav:** fix step indicator alignment and fetch address book descriptions ([bb180df](https://github.com/mattogodoy/nametag/commit/bb180df6cba7cd1fd9177e1a2573c9e93c74683c))
* **carddav:** move auto-select to useEffect to avoid state update during render ([0079c2c](https://github.com/mattogodoy/nametag/commit/0079c2c6399fa9aa7c4ef5f918718b87a474a223))
* **carddav:** read address book description from raw PROPFIND response ([41b058f](https://github.com/mattogodoy/nametag/commit/41b058f5b1f2cb99284bfe7329d9c32a382bc14c))

## [0.31.1](https://github.com/mattogodoy/nametag/compare/v0.31.0...v0.31.1) (2026-03-05)


### Bug Fixes

* normalize unknown-year dates for non-YEARS reminder intervals ([e32d5f6](https://github.com/mattogodoy/nametag/commit/e32d5f658f84970a1a84d5e5ee068eccc605ed3f))
* normalize unknown-year dates for non-YEARS reminder intervals ([0653f3c](https://github.com/mattogodoy/nametag/commit/0653f3cba570b2f9f0b706912edffe02d79ab7f8))

## [0.31.0](https://github.com/mattogodoy/nametag/compare/v0.30.0...v0.31.0) (2026-03-05)


### Features

* add person photo upload, crop, and display ([0488109](https://github.com/mattogodoy/nametag/commit/0488109e9060fd383e1dab41b381ccc7e4a90380))
* add photo feature translations for all locales ([370beb7](https://github.com/mattogodoy/nametag/commit/370beb77f94f4c69ebebc4332c78893c80e8aa4e))
* add photo upload and delete API endpoints ([8578d6c](https://github.com/mattogodoy/nametag/commit/8578d6cb1ab6fd7ca806e4129ae9d2529c7fa3f0))
* add PhotoCropModal with react-easy-crop integration ([8b90edf](https://github.com/mattogodoy/nametag/commit/8b90edf55ee8b1f95a1dfa9dd4595af081681c53))
* add processPhoto utility with sharp resize/JPEG/EXIF-strip ([ec3bc8f](https://github.com/mattogodoy/nametag/commit/ec3bc8f3c2eacb74d608b5c49f0ee330bf44bdbc))
* add sharp and react-easy-crop dependencies for photo upload ([d6e92ce](https://github.com/mattogodoy/nametag/commit/d6e92cebbfcbbc664b7fcd0bbee232ee5b86e2ce))
* add user photo support (upload, navbar, graph, relationships) ([341b292](https://github.com/mattogodoy/nametag/commit/341b292633be86ad6b9b8c695cdaadbaf7af7776))
* embed person photos in reminder emails as inline CID attachments ([7b5d825](https://github.com/mattogodoy/nametag/commit/7b5d825a7bdd0ecea57795b3f9a5269ba4322c3a))
* increase max crop zoom from 3x to 5x ([6585fb9](https://github.com/mattogodoy/nametag/commit/6585fb91a3fc47344ff37f75cb890b3fd75a92ee))
* integrate photo upload and crop into PersonForm ([f9be2fe](https://github.com/mattogodoy/nametag/commit/f9be2fe5f643d2316be50c717e4a43fa8b2fedd5))
* replace PersonPhoto with flexible PersonAvatar component ([7dfa914](https://github.com/mattogodoy/nametag/commit/7dfa914206bc97584e20f4d159d0320a9bf117fd))
* show person photos in dashboard upcoming events ([1cb9f81](https://github.com/mattogodoy/nametag/commit/1cb9f81132adab2eed62b460470bc0cdb9103002))
* show person photos in group member pills ([11baa8b](https://github.com/mattogodoy/nametag/commit/11baa8b8849294e5296cba6cbc815865269b2f66))
* show person photos in navbar search results ([0bebd71](https://github.com/mattogodoy/nametag/commit/0bebd71122221a0c45a3ef147c0a479a83df4f4f))
* show person photos in network graph nodes with group-colored borders ([80dc1e2](https://github.com/mattogodoy/nametag/commit/80dc1e267e59a76153c79a1d2b748a3356a2a739))
* show person photos in people list table ([7205680](https://github.com/mattogodoy/nametag/commit/7205680145c12ad7999feabc9daa2c61ae6cf24b))
* show person photos in relationship list ([c41d36c](https://github.com/mattogodoy/nametag/commit/c41d36cf48bc7afd216ce43814fa6615f456aaa2))


### Bug Fixes

* add blob: to CSP img-src for photo crop preview ([9922210](https://github.com/mattogodoy/nametag/commit/992221006aea549788721ab33d138da90f8ef989))
* defer photo upload/delete to form save instead of immediate execution ([9a9f81b](https://github.com/mattogodoy/nametag/commit/9a9f81baf3e012724a52ed98731a35248b242eea))
* remove inline photo attachments from reminder emails ([5a8bbd0](https://github.com/mattogodoy/nametag/commit/5a8bbd098968c1f35ee3f8be4e2a4a73d3c988a2))
* set maxZoom=5 on Cropper component to match slider range ([0be7969](https://github.com/mattogodoy/nametag/commit/0be7969b48624eca01984be84678fe1e93dbfcdb))
* strip quoted nicknames from initials in PersonAvatar ([9e32f67](https://github.com/mattogodoy/nametag/commit/9e32f67143a9742fc3eb5aa1d8ef526ec6de7d58))
* update UI immediately when removing a photo via X button ([9f6c2ee](https://github.com/mattogodoy/nametag/commit/9f6c2ee0f84dd442411c7476a6b78a17f9fdf584))
* use 80px avatar on person detail page per design spec ([8600af9](https://github.com/mattogodoy/nametag/commit/8600af96342fbd63687ceac9c27669c30541ced7))
* use ETag + no-cache for photo serving to prevent stale cache on photo change ([39829d3](https://github.com/mattogodoy/nametag/commit/39829d36d7891e8349f410b49f1315cfcbf1776c))
* use no-store for photo serving to guarantee fresh photos after change ([a6a42d3](https://github.com/mattogodoy/nametag/commit/a6a42d36b3d622b9ddd08f320027e12eab188699))

## [0.30.0](https://github.com/mattogodoy/nametag/compare/v0.29.0...v0.30.0) (2026-03-04)


### Features

* add fetchVCard method for single vCard retrieval ([d79e293](https://github.com/mattogodoy/nametag/commit/d79e293146ed9c6da87d5907c7dab0f0c4b86083))
* add preservedProperties field to CardDavMapping ([43202b5](https://github.com/mattogodoy/nametag/commit/43202b5056dc74359fcb7a61cc695095fb1a3c72))
* include preserved properties in sync push ([c6548ff](https://github.com/mattogodoy/nametag/commit/c6548ff6c0442756fb3070d7f331f55ccffb987c))
* store preserved vCard properties during import ([47e71b6](https://github.com/mattogodoy/nametag/commit/47e71b635ccf01cf12bd843f95c36a94046bc616))
* store preserved vCard properties during sync pull ([097c310](https://github.com/mattogodoy/nametag/commit/097c3104e4140dd680fa918d55c70b1a5e8e5952))
* support preserved properties in vCard export ([b48c472](https://github.com/mattogodoy/nametag/commit/b48c472c46e49cc76c6d24dbc3d042232531df9b))


### Bug Fixes

* clean up legacy unknown vCard properties from notes during sync ([5a5dd2f](https://github.com/mattogodoy/nametag/commit/5a5dd2f53caa1f3f7d5820b6cd2ba6d74ecdb658))
* handle 412 on vCard CREATE by adopting existing server vCard ([ca54d99](https://github.com/mattogodoy/nametag/commit/ca54d99cbaa5820929114c75de5937cfb86c4896))
* mark primary contact mapping as pending after merge ([b9088a5](https://github.com/mattogodoy/nametag/commit/b9088a5d298a213a88277e218e31dbee5fd03621))
* recover from 412 Precondition Failed by refreshing ETag ([d01ceb7](https://github.com/mattogodoy/nametag/commit/d01ceb7771f7f801403127aea94890f290d26c68))
* stop appending unknown vCard properties to notes ([c82653e](https://github.com/mattogodoy/nametag/commit/c82653ee2129978050384c552d985b05fbdfd4ab))
* use undefined instead of null for Prisma Json? field ([b722904](https://github.com/mattogodoy/nametag/commit/b722904e95b8bd9e83fab8a2c335c63cfe7a10ba))


### Performance

* defer parseVCard to remoteChanged branch to avoid double-parsing ([bb9aab3](https://github.com/mattogodoy/nametag/commit/bb9aab3c088457902c01c11ee9e09049946a780e))

## [0.29.0](https://github.com/mattogodoy/nametag/compare/v0.28.1...v0.29.0) (2026-03-04)


### Features

* add LastContactQuickUpdate component ([#62](https://github.com/mattogodoy/nametag/issues/62)) ([dde09f8](https://github.com/mattogodoy/nametag/commit/dde09f8d5f0260a68b812188c6a559b104c32cd9))
* add missing translations for de-DE, ja-JP, nb-NO ([#62](https://github.com/mattogodoy/nametag/issues/62)) ([496e693](https://github.com/mattogodoy/nametag/commit/496e6935c22fe7fe837a93f84249998b58ea2f8c))
* add translation keys for quick last contact update ([#62](https://github.com/mattogodoy/nametag/issues/62)) ([6290b08](https://github.com/mattogodoy/nametag/commit/6290b082c54cc466e6b2e95f83b0e30085f70851))
* improve contacted today button with text label and calendar icon ([#62](https://github.com/mattogodoy/nametag/issues/62)) ([dc46a13](https://github.com/mattogodoy/nametag/commit/dc46a13b79876c086ec887efa8bb3509b87a9065))
* integrate LastContactQuickUpdate into person detail page ([#62](https://github.com/mattogodoy/nametag/issues/62)) ([2e12609](https://github.com/mattogodoy/nametag/commit/2e126096ca73e10701124a058f82c98d501492e8))
* refine quick contact button UX ([#62](https://github.com/mattogodoy/nametag/issues/62)) ([ab5e80d](https://github.com/mattogodoy/nametag/commit/ab5e80d67cc0419d55f6d7ea7decb5598ce9eea7))


### Bug Fixes

* use calendar-based month calculation in relative time ([#62](https://github.com/mattogodoy/nametag/issues/62)) ([678e2eb](https://github.com/mattogodoy/nametag/commit/678e2ebbbcb6037803882d3d5bff4f54933c96be))

## [0.28.1](https://github.com/mattogodoy/nametag/compare/v0.28.0...v0.28.1) (2026-03-03)


### Bug Fixes

* address remaining soft-delete filter gaps ([28cf352](https://github.com/mattogodoy/nametag/commit/28cf3526e20f9719adf4b3dc165a5bb82c76285f))
* exclude soft-deleted records from all page server components ([b203909](https://github.com/mattogodoy/nametag/commit/b203909f4d0ab13a2e2b07308858ca4df935bf33))
* exclude soft-deleted records from CardDAV sync and auto-export ([c71b45c](https://github.com/mattogodoy/nametag/commit/c71b45cd77ae45098184c604f88100f4820fa75b))
* exclude soft-deleted records from export and import routes ([ec8658f](https://github.com/mattogodoy/nametag/commit/ec8658ff5a7458a92bd90b22a29ec32458f9024d))
* exclude soft-deleted records from groups API routes ([c97fb4b](https://github.com/mattogodoy/nametag/commit/c97fb4b239ae6aebabbb2a166a92cacdea6ce405))
* exclude soft-deleted records from important dates API routes ([509dc19](https://github.com/mattogodoy/nametag/commit/509dc197dbbd538b9859363bdfde37ed8a89628b))
* exclude soft-deleted records from people API routes ([dfceaef](https://github.com/mattogodoy/nametag/commit/dfceaef627c3a62e987ec5e17852641cc3efaeec))
* exclude soft-deleted records from relationship types API routes ([f99e509](https://github.com/mattogodoy/nametag/commit/f99e509cff6f92ada1a962ba6a058f9a7463cfe9))
* exclude soft-deleted records from relationships API routes ([a3ac41e](https://github.com/mattogodoy/nametag/commit/a3ac41e5f20d6be1a7f0d6051e4acba80654ff1b))
* exclude soft-deleted records from reminders and billing counts ([ff8d200](https://github.com/mattogodoy/nametag/commit/ff8d200d3f8fd4983dcf72d4a8c418f8ab6810e7))
* exclude soft-deleted records from unsubscribe token lookups ([49fb23c](https://github.com/mattogodoy/nametag/commit/49fb23c2eb5881451c60acafd7c923a39ea0e7df))

## [0.28.0](https://github.com/mattogodoy/nametag/compare/v0.27.3...v0.28.0) (2026-03-03)


### Features

* add custom DatePicker component with three inline fields ([8776913](https://github.com/mattogodoy/nametag/commit/8776913b197d03c5a065012e1d30c15ff60c076b))
* add date validation utilities (leap year, days in month, clamp) ([0f6a9fe](https://github.com/mattogodoy/nametag/commit/0f6a9fed1c1c6e32f26fa3254692a6fe41d12113))
* add i18n keys for DatePicker component ([a6318d4](https://github.com/mattogodoy/nametag/commit/a6318d451a15a2a6a42e90456f6148401ee0c08f))
* custom DatePicker with dropdown fields ([27511f6](https://github.com/mattogodoy/nametag/commit/27511f61ab83627c82628be04fe9c8a96c08a42c))
* integrate DatePicker into ImportantDatesManager for add/edit forms ([5867d27](https://github.com/mattogodoy/nametag/commit/5867d27724940198fa5b9cedcc253ef05fddc0bf))
* integrate DatePicker into PersonForm Last Contact field ([189a1e8](https://github.com/mattogodoy/nametag/commit/189a1e8cf2b9a2a32e75f997d3c153e08f904ee9))


### Bug Fixes

* clear year field when unchecking year-unknown instead of showing 1604 ([b1f7e98](https://github.com/mattogodoy/nametag/commit/b1f7e98f1a95e95afb775d1d24dce53cb6bb3ec7))
* re-emit date when yearUnknown toggled and restore CSS hover tooltip ([18536b1](https://github.com/mattogodoy/nametag/commit/18536b1b19f856c8c7a403c08b47e199dd623c85))

## [0.27.3](https://github.com/mattogodoy/nametag/compare/v0.27.2...v0.27.3) (2026-03-02)


### Bug Fixes

* handle symmetric relationship types with null inverseId ([094953f](https://github.com/mattogodoy/nametag/commit/094953f90c7d5bb5ce100f847ceb435b5cd2ae0c))
* handle symmetric relationship types with null inverseId ([6ed69b9](https://github.com/mattogodoy/nametag/commit/6ed69b9491a267d386c50ee9212077e83385509b))
* remove non-null assertions on route context.params ([eff1260](https://github.com/mattogodoy/nametag/commit/eff1260d080e6343b598ede2cf02454874e4d2f0))
* remove non-null assertions on route context.params ([7972025](https://github.com/mattogodoy/nametag/commit/7972025540b9097abc60e143dbd3bdf415b3ddb0)), closes [#78](https://github.com/mattogodoy/nametag/issues/78)

## [0.27.2](https://github.com/mattogodoy/nametag/compare/v0.27.1...v0.27.2) (2026-03-02)


### Bug Fixes

* use modal for editing user relationship instead of navigating to edit page ([bc86e30](https://github.com/mattogodoy/nametag/commit/bc86e3062a5e1c35800bdb0d28c470086241703d))

## [0.27.1](https://github.com/mattogodoy/nametag/compare/v0.27.0...v0.27.1) (2026-03-02)


### Bug Fixes

* add missing afterEach import in email test files ([84bd6c3](https://github.com/mattogodoy/nametag/commit/84bd6c3c7630690a02b1906a865f18da9125c9dc))
* add retry with backoff to Resend emails and batch API for cron reminders ([5b8b1f9](https://github.com/mattogodoy/nametag/commit/5b8b1f96c7bfa8b4ca99a8de72feb120c6b3d0b3))
* simplify AI release summary to run directly on release creation ([1f81b47](https://github.com/mattogodoy/nametag/commit/1f81b4718d283b33d229a87c088adbeeba791501))

## [0.27.0](https://github.com/mattogodoy/nametag/compare/v0.26.1...v0.27.0) (2026-03-01)


### Features

* add dynamic preview sentence to relationship creation form ([3147d23](https://github.com/mattogodoy/nametag/commit/3147d230fa63169879eec6cfe6b60c3646f2eb82))
* add relationship preview to person creation form ([605226f](https://github.com/mattogodoy/nametag/commit/605226fa33fd9a8c78ee889dd4ea3ef79c82c1da))
* add sentence tooltips to graph edge labels ([832b1d1](https://github.com/mattogodoy/nametag/commit/832b1d14f987ed635d4c15098b63d5750bffcde0))
* **i18n:** add relationship direction sentence templates for all locales ([9691104](https://github.com/mattogodoy/nametag/commit/9691104c20f5e7c1757deef338deac45a883267c))
* improve relationship direction clarity ([b1ea64e](https://github.com/mattogodoy/nametag/commit/b1ea64efe59dcd1e97f3fe41c1109289ec8f4192))
* show relationships as sentences in person details page ([0516805](https://github.com/mattogodoy/nametag/commit/05168051d45641f37e15d6efc823bcf9e7c8e707))


### Bug Fixes

* add missing beforeEach import in RelationshipManager test ([1c8b8c3](https://github.com/mattogodoy/nametag/commit/1c8b8c3b2b1b241607f470f0a2c342ce95205157))
* clarify CardDAV import relationship labels in all languages ([ca65f55](https://github.com/mattogodoy/nametag/commit/ca65f55fa6786abac0fb8783fa0d44d51be85f04))
* filter soft-deleted importantDates from API responses ([06c928e](https://github.com/mattogodoy/nametag/commit/06c928e56b42a67f9bd2eef1fe3e393be02c8277))
* filter soft-deleted importantDates from GET and PUT responses ([3b36558](https://github.com/mattogodoy/nametag/commit/3b365589cf03bd2f683fce8a2a08d5036f389d2c)), closes [#56](https://github.com/mattogodoy/nametag/issues/56)
* handle empty PR output in release-please workflow ([3007131](https://github.com/mattogodoy/nametag/commit/3007131e783a477aea22b8b4a92824399f22c93d))
* handle empty PR output in release-please workflow ([1cbab07](https://github.com/mattogodoy/nametag/commit/1cbab074e6740dea4a405101833ac45f7eb3848c))
* lowercase relationship type in graph edge labels ([7c74673](https://github.com/mattogodoy/nametag/commit/7c7467308610a7970a6e942de158fac8db63f640))
* shorten graph edge labels and handle user direction ([aed93a8](https://github.com/mattogodoy/nametag/commit/aed93a836fb558b511ab2ddf70518c865b06ab73))
* show correct relationship direction for user relationships ([2fed34a](https://github.com/mattogodoy/nametag/commit/2fed34a84a00a0e3e4b4bf3007a772c01e6565d0))
* show sentence format for user relationship in person details ([7b69c4a](https://github.com/mattogodoy/nametag/commit/7b69c4abb54b4acc15d68f1d0494a59c8ddb0277))
* use nickname in relationship list names ([26aebfa](https://github.com/mattogodoy/nametag/commit/26aebfa61a8bef3f054f3884ac4e26777552b917))
* use nickname+surname in relationship display on person details page ([d24bc42](https://github.com/mattogodoy/nametag/commit/d24bc42d528334d3ae9649755f34728644ad4400))

## [0.26.1](https://github.com/mattogodoy/nametag/compare/v0.26.0...v0.26.1) (2026-02-28)


### Bug Fixes

* include all person fields in JSON export ([9bd8991](https://github.com/mattogodoy/nametag/commit/9bd89917e9323ae8c88839ca816936f6ff488fc9))
* include all person fields in JSON export ([56cd239](https://github.com/mattogodoy/nametag/commit/56cd2393fb31c379c9a47a04657b33955e5b495c)), closes [#106](https://github.com/mattogodoy/nametag/issues/106) [#107](https://github.com/mattogodoy/nametag/issues/107)
* prepend AI release notes to GitHub releases ([0886c16](https://github.com/mattogodoy/nametag/commit/0886c16a4f795486f38c52743bca12b08f918fb3))
* tighten AI release notes prompt to avoid truncation ([9fddcd3](https://github.com/mattogodoy/nametag/commit/9fddcd3224e53af66ac324083b4538e106c1d260))

## [0.26.0](https://github.com/mattogodoy/nametag/compare/v0.25.1...v0.26.0) (2026-02-28)


### Features

* add DuplicatesList component for displaying duplicate candidates ([a949e4f](https://github.com/mattogodoy/nametag/commit/a949e4f4167f914f97f165bbc38a301f3b1875be))
* add Find Duplicates button to people list toolbar ([6661810](https://github.com/mattogodoy/nametag/commit/66618107931707f17da45d884ec508aef08a1c47))
* add Find Duplicates button to person detail page ([673de88](https://github.com/mattogodoy/nametag/commit/673de88130599804474acdf6b4f66766b1288d40))
* add global duplicate detection API endpoint ([c125b08](https://github.com/mattogodoy/nametag/commit/c125b080f846213636a4318b4b7ef8c07631065c))
* add global duplicates scanner page ([eb2bb9b](https://github.com/mattogodoy/nametag/commit/eb2bb9b8dc9e8040370583d3fdb88c4a68dfff92))
* add Levenshtein-based duplicate detection utility ([bd01fc1](https://github.com/mattogodoy/nametag/commit/bd01fc1ac009bff50142382baba35c8d13195bd1))
* add merge contacts API endpoint with transactional data transfer ([eab5673](https://github.com/mattogodoy/nametag/commit/eab567323c75d1e3f0975ec063d390cfd46cd43e))
* add merge contacts page with side-by-side comparison ([3d7ca86](https://github.com/mattogodoy/nametag/commit/3d7ca86adf9cee78c546da4d7f521432f850ac2f))
* add merge person validation schema ([b27ba19](https://github.com/mattogodoy/nametag/commit/b27ba19f9689dd8714ea9d803ab13e5ddc09ef36))
* add merge/duplicates translations for all five languages ([a8136fb](https://github.com/mattogodoy/nametag/commit/a8136fb939feba6f26484dbb9b98a89f50e007a3))
* add per-person duplicate detection API endpoint ([d9bee34](https://github.com/mattogodoy/nametag/commit/d9bee348c314fd2d9534f7598053d61a784e92aa))
* add PersonCompare component for side-by-side contact comparison ([0ed8437](https://github.com/mattogodoy/nametag/commit/0ed84374e86e7fa827046a39863ea764e103f23a))
* merge duplicate contacts with CardDAV sync ([343f1a6](https://github.com/mattogodoy/nametag/commit/343f1a689abe768f4957d1fb8a3e9e2962676587))


### Bug Fixes

* add lastContact to merge field overrides ([17feda1](https://github.com/mattogodoy/nametag/commit/17feda16d7463a25768482c53296a97acf51ba06))
* add missing merge field translations for DE, JA, NO locales ([13c10fd](https://github.com/mattogodoy/nametag/commit/13c10fdef99a655220c0729b336bef2349724417))
* add missing merge page translations for DE, JA, NO locales ([d875c1c](https://github.com/mattogodoy/nametag/commit/d875c1c919c4127273cde9138a2e8d7dd79f48fe))
* clean up stale pending imports and sort import list locale-aware ([c2a175d](https://github.com/mattogodoy/nametag/commit/c2a175dc5964bb87ebb2751b538c895443c42b4e))
* deduplicate all multi-value fields during contact merge ([4bc8aa5](https://github.com/mattogodoy/nametag/commit/4bc8aa56fe991d8f46d5e3ffdbf545282383537e))
* improve contact merge with CardDAV delete, scalar auto-transfer, and relationship summary ([b9de2db](https://github.com/mattogodoy/nametag/commit/b9de2dba0a47fe8f8d2ca3183eee132bcdbb61f5))
* prevent duplicate relationships, improve merge accuracy and cleanup ([a14889a](https://github.com/mattogodoy/nametag/commit/a14889a2dd2899761a5dce63051b166abc970d36))
* resolve TypeScript errors in merge test mock call assertions ([c2c0c3e](https://github.com/mattogodoy/nametag/commit/c2c0c3e4effc9eef86e07a3949f4a71de3842190))
* use correct key for relationshipToUserId in merge field overrides ([c53afb7](https://github.com/mattogodoy/nametag/commit/c53afb7702e332b5c22923c4cf95c4fa8bdcf747))
* use deleteVCardDirect for race-condition cleanup, harden UI edge cases ([fda3243](https://github.com/mattogodoy/nametag/commit/fda32434b0b470f14b932451034fb8c56fce8275))
* use getPhotoUrl for photo display in PersonCompare component ([9612944](https://github.com/mattogodoy/nametag/commit/9612944be6db890ede392336eec5f33c5aac6954))
* use null instead of undefined for missing vCard fields so Prisma clears them on sync ([0840365](https://github.com/mattogodoy/nametag/commit/0840365854e2f863aa747e41dab9c3d8ac671e02))
* validate date overrides in merge schema to reject invalid strings ([c4290fe](https://github.com/mattogodoy/nametag/commit/c4290fe25b745155668f623e1d03c31818ba7b92))

## [0.25.1](https://github.com/mattogodoy/nametag/compare/v0.25.0...v0.25.1) (2026-02-27)


### Bug Fixes

* escape quotation marks in German locale to fix JSON parsing ([140fc71](https://github.com/mattogodoy/nametag/commit/140fc71791b81930f0b8d42c8f86e0002e45b5a0))
* reset bulk relationship button state after success and add missing translations ([0653416](https://github.com/mattogodoy/nametag/commit/06534169ad1f5b5ba38548855dfb4c5356112cd1))

## [0.25.0](https://github.com/mattogodoy/nametag/compare/v0.24.0...v0.25.0) (2026-02-26)


### Features

* enforce tier contact limits on VCF and CardDAV import flows ([c7aabdd](https://github.com/mattogodoy/nametag/commit/c7aabddd81e4eb21b8ee6dc00877bf458411168e))
* enforce tier contact limits on VCF and CardDAV imports ([aa066ca](https://github.com/mattogodoy/nametag/commit/aa066ca9bf3f93589c85274447bdad6c8559d85d))


### Bug Fixes

* replace Function type with explicit signature in test mocks ([1e3108b](https://github.com/mattogodoy/nametag/commit/1e3108b47d073cc03360427a2c790ff387bffa57))

## [0.24.0](https://github.com/mattogodoy/nametag/compare/v0.23.0...v0.24.0) (2026-02-26)


### Features

* add bulk actions API endpoint (delete, addToGroups, setRelationship) ([1c3d355](https://github.com/mattogodoy/nametag/commit/1c3d355562029fa8a1242ae5d51e961396c77a84))
* add bulk orphans API endpoint for aggregate orphan detection ([4055890](https://github.com/mattogodoy/nametag/commit/40558904606e561ed322ea27b8a89f6bae8ef1ef))
* add BulkDeleteModal component with orphan and CardDAV handling ([da09b2f](https://github.com/mattogodoy/nametag/commit/da09b2fd5aa4b651c299f3b931a8f7563bc03ecd))
* add BulkGroupAssignModal component ([57b233e](https://github.com/mattogodoy/nametag/commit/57b233e8a7f59bf08b2b6d08808dd4b22a837cd6))
* add BulkRelationshipModal component ([246add7](https://github.com/mattogodoy/nametag/commit/246add7155f72e764b1e22c7f2db8eb2e7651cda))
* add i18n keys for bulk actions on people list ([fb41707](https://github.com/mattogodoy/nametag/commit/fb41707db3a2666cba8c945e0597ec1a8587bff6))
* add PeopleListClient with selection state, floating bar, and modals ([e70ff0c](https://github.com/mattogodoy/nametag/commit/e70ff0cd204a6f3ace993886d8720e5742299ab6))
* add skip-docker detection to publish workflow ([5cd7b4c](https://github.com/mattogodoy/nametag/commit/5cd7b4ca48ecf90105fff08c3236ca053b26b971))
* add Zod validation schemas for bulk people actions ([e35c985](https://github.com/mattogodoy/nametag/commit/e35c98558e6c4088e655562a4f16b9de8103dbb8))
* bulk actions for people list ([36b67f2](https://github.com/mattogodoy/nametag/commit/36b67f2e8c7698f29979905b68f9185f5fcdb339))
* wire PeopleListClient into people page with bulk action support ([b1caecf](https://github.com/mattogodoy/nametag/commit/b1caecf963ed097cfd1a40ac31aecc861bd0077c))


### Bug Fixes

* Add brackets for dropdown texts] ([2bb0897](https://github.com/mattogodoy/nametag/commit/2bb08973e15a3bb3bc79b467a685cd1d755a4f32))
* add ownership validation and correct count in bulk actions ([b54f19b](https://github.com/mattogodoy/nametag/commit/b54f19b6f5e47f321ed633dffb67c67319183c75))
* back to people link preserves browser history ([b7370eb](https://github.com/mattogodoy/nametag/commit/b7370ebd4a656fab839c6dcaf356ef739a10a6da))
* import formatDate directly in client component ([49167bd](https://github.com/mattogodoy/nametag/commit/49167bd1f91a97050b2b48af7dc42f69ce4b9169))
* move synchronous state resets out of useEffect in BulkDeleteModal ([f8e2d4d](https://github.com/mattogodoy/nametag/commit/f8e2d4df6159815069a8f3422f6b072b99aa0ea2))
* reset isDeleting state when bulk delete modal reopens ([0dee632](https://github.com/mattogodoy/nametag/commit/0dee632b9936937bd67224a7e227cad9a37a4958))
* show full name in bulk delete confirmation list ([af351f1](https://github.com/mattogodoy/nametag/commit/af351f1dd843253014516ea99eef6f130238b40c))
* split release and Docker build into separate workflows ([036871e](https://github.com/mattogodoy/nametag/commit/036871efedf065ab612f1e3dc5da411a707d5cc2))

## [0.23.0](https://github.com/mattogodoy/nametag/compare/v0.22.0...v0.23.0) (2026-02-26)


### Features

* add relationship-to-user assignment during contact import ([48a836d](https://github.com/mattogodoy/nametag/commit/48a836d597a1b8af24ed534301d0bf597d48c587))

## [0.22.0](https://github.com/mattogodoy/nametag/compare/v0.21.2...v0.22.0) (2026-02-25)


### Features

* add request-level HTTP logging to all API routes ([4b90197](https://github.com/mattogodoy/nametag/commit/4b90197ed0acc20d5593192b6c0fc30df9f10376))
* add withLogging HOF for request-level HTTP logging ([f66806a](https://github.com/mattogodoy/nametag/commit/f66806a09a114db8a8e7915b977c3f795e6e70c9))
* integrate withLogging into withAuth for automatic request logging ([08fdec9](https://github.com/mattogodoy/nametag/commit/08fdec97d4ab4538fa49191e169395a17b89b4ee))
* wrap all non-withAuth routes with withLogging ([d085621](https://github.com/mattogodoy/nametag/commit/d0856211370a9252f956b32264d8970ce86eda66))


### Bug Fixes

* replace Function type with explicit signature in test mocks ([d932b3a](https://github.com/mattogodoy/nametag/commit/d932b3aab9925532a66dbc8f3f6d82ca116ca0d4))
* resolve TypeScript errors in withLogging wrapper ([d896e07](https://github.com/mattogodoy/nametag/commit/d896e07b7b7335be935a1e9fdc8de6b1a43dee63))
* update logger mocks to include createModuleLogger ([e591461](https://github.com/mattogodoy/nametag/commit/e5914616acce14d7e6901e2e3d2e52c747ee4c85))

## [0.21.2](https://github.com/mattogodoy/nametag/compare/v0.21.1...v0.21.2) (2026-02-25)


### Bug Fixes

* add bootstrap-sha to prevent old commits in release notes ([1af3e84](https://github.com/mattogodoy/nametag/commit/1af3e84982b78b14e07e33167375d70757a8761d))
* align @prisma/client version with prisma CLI (7.0.1 → 7.4.1) ([8b2083b](https://github.com/mattogodoy/nametag/commit/8b2083bc68ea24f84a41ad658cf1e8bc41940afd))
* merge Docker publish into release-please workflow ([4e0cc68](https://github.com/mattogodoy/nametag/commit/4e0cc683e89880cff1c5572289c2228bbe6ac6fd))
* patch npm audit vulnerabilities (29 → 8 remaining) ([f6f68a9](https://github.com/mattogodoy/nametag/commit/f6f68a99ac79e6b504a3efe2c46893773796d4c5))

## [0.21.1](https://github.com/mattogodoy/nametag/compare/v0.21.0...v0.21.1) (2026-02-25)


### Bug Fixes

* add bootstrap-sha to prevent old commits in release notes ([1af3e84](https://github.com/mattogodoy/nametag/commit/1af3e84982b78b14e07e33167375d70757a8761d))
* align @prisma/client version with prisma CLI (7.0.1 → 7.4.1) ([8b2083b](https://github.com/mattogodoy/nametag/commit/8b2083bc68ea24f84a41ad658cf1e8bc41940afd))
* patch npm audit vulnerabilities (29 → 8 remaining) ([f6f68a9](https://github.com/mattogodoy/nametag/commit/f6f68a99ac79e6b504a3efe2c46893773796d4c5))

## [0.21.0](https://github.com/mattogodoy/nametag/compare/v0.20.0...v0.21.0) (2026-02-25)


### Features

* build Docker images before publishing releases ([31e63eb](https://github.com/mattogodoy/nametag/commit/31e63ebb802af14ff4590a198a9c4a20de961502))
* replace homegrown logger with Pino ([bf6bf29](https://github.com/mattogodoy/nametag/commit/bf6bf29a0aceed7a88af591cf60cbfd6a1cfabd3))
* structured logging with Pino ([8c66d76](https://github.com/mattogodoy/nametag/commit/8c66d76683184aaa97bd9a9f4cd439337d92b879))


### Bug Fixes

* allow PUT /api/carddav/connection to update sync settings only ([4467e8d](https://github.com/mattogodoy/nametag/commit/4467e8daeeef42eb54d287dd0639728bf6d2a84e))
* externalize Pino from Next.js bundle and fix test types ([543a684](https://github.com/mattogodoy/nametag/commit/543a6847d7751945412358d69436201e1db56491))
* post AI summary as PR comment instead of editing body ([4a3285a](https://github.com/mattogodoy/nametag/commit/4a3285a7efe224c0fc44fca2ab1de954ff920d78))
* sync settings modal returns 'Invalid Input' ([c0bf292](https://github.com/mattogodoy/nametag/commit/c0bf2928ca185f48d83a37d1170eeb692e11665e))

## [0.20.0](https://github.com/mattogodoy/nametag/compare/v0.19.0...v0.20.0) (2026-02-25)


### Features

* add publish workflow triggered by release events ([0ba7f87](https://github.com/mattogodoy/nametag/commit/0ba7f87a5a73bebb0d0d5d9a08a662d074e1c982))
* add release-please workflow with AI release notes ([0fe319f](https://github.com/mattogodoy/nametag/commit/0fe319fb4c89455c7e19d8c0c82fe1763ed6ff7a))


### Bug Fixes

* address code review issues in release-please workflow ([350dbec](https://github.com/mattogodoy/nametag/commit/350dbec49004c3c10dae26ea1e0c7d07ea638cfa))
* set empty component to prevent tag name mismatch ([d7c2601](https://github.com/mattogodoy/nametag/commit/d7c26012405564659776de77f8cee48d97592959))

## [0.19.0](https://github.com/mattogodoy/nametag/compare/v0.18.1...v0.19.0) (2026-02-24)

### Features

* Add loading placeholder for person photo ([0978ac5](https://github.com/mattogodoy/nametag/commit/0978ac5a5ef6aba109288c0d1ce69347361c71bb))
* add per-person CardDAV sync toggle ([b54196e](https://github.com/mattogodoy/nametag/commit/b54196e4de8af3a0b96e9836ee55f8aebe728c80))
* Stage 1 - Add CardDAV database schema and migrations ([9c71af9](https://github.com/mattogodoy/nametag/commit/9c71af956ca44bad2819cd5c3e597b67445ada17))
* Stage 10 - Bulk export ([4408566](https://github.com/mattogodoy/nametag/commit/44085669a4b445bd1cad6df022607b265fec425c))
* Stage 11 - Background sync & cron jobs ([6bfdc67](https://github.com/mattogodoy/nametag/commit/6bfdc67d9cb132a735dd0d35cddf4eae3be19a48))
* Stage 12 - Custom fields & advanced features ([63c5462](https://github.com/mattogodoy/nametag/commit/63c5462ae4fa9ebdd3c225c987b68c7418c76beb))
* Stage 13 - Settings & preferences ([fd33ea1](https://github.com/mattogodoy/nametag/commit/fd33ea1a81ef232169cb56311ce96cdb2c0718eb))
* Stage 14 - Error handling & polish ([e97498c](https://github.com/mattogodoy/nametag/commit/e97498c08b61b7b8c80034a8f9a9fb82c7dabae0))
* Stage 15 - Documentation & final testing ([13fa69b](https://github.com/mattogodoy/nametag/commit/13fa69b9374bb54e4a8248d80fba06951dec21f9))
* Stage 2 - Add vCard transformation library ([0ee9499](https://github.com/mattogodoy/nametag/commit/0ee94996ed781f5018e81fc92452dc60dc8ee32d))
* Stage 3 - Enhance Person API to support vCard fields ([984088f](https://github.com/mattogodoy/nametag/commit/984088f2403dfbeba8c207269a9a4099e447a933))
* Stage 4 - Add multi-value vCard field managers ([4173701](https://github.com/mattogodoy/nametag/commit/4173701339f6e19fdd249cd6887b21c8d3e84d3d))
* Stage 5 - CardDAV connection setup UI and API ([f86c126](https://github.com/mattogodoy/nametag/commit/f86c126a57eab71bed2ccfbf2f3cdb93f68ecc73))
* Stage 6 - CardDAV sync engine with bidirectional sync ([8c7df95](https://github.com/mattogodoy/nametag/commit/8c7df95664babf9575fe05d181e9bae69431231e))
* Stage 7 - Conflict resolution UI ([e2daec9](https://github.com/mattogodoy/nametag/commit/e2daec93580899fc2c893cbca2a7ec5dc6fed001))
* Stage 8 - Import flow UI ([c8f5eee](https://github.com/mattogodoy/nametag/commit/c8f5eee913ee0b41011a746a54aa59b356323ca7))
* Stage 9 - Auto-export & notifications ([657f022](https://github.com/mattogodoy/nametag/commit/657f022e53e81ec42f5e36b8278bf31d9579549b))

### Bug Fixes

* add missing cardDavSyncEnabled to vCard test mocks ([516f974](https://github.com/mattogodoy/nametag/commit/516f9748d54ed19da80b42087e7c1a538a22c60b))
* add retry logic and proper logging to auto-export ([3ac7109](https://github.com/mattogodoy/nametag/commit/3ac7109a36e1cf32d3f3c5131812d389f142342b))
* add SSRF protection and input sanitization for CardDAV imports ([dd6780b](https://github.com/mattogodoy/nametag/commit/dd6780ba3923d7fbee4fbfb639eedf3d6957a582))
* add sync locking to prevent concurrent sync runs ([895688c](https://github.com/mattogodoy/nametag/commit/895688cbba8c82d0162cab9bffd654f357673e19))
* add transactional safety to conflict resolution, connection delete, and import ([6f96ec1](https://github.com/mattogodoy/nametag/commit/6f96ec1bd2e44ea9837200aa264b7903d96ee86f))
* address PR review findings across security, API, UI, i18n, and tests ([a25dfeb](https://github.com/mattogodoy/nametag/commit/a25dfeb5b761e9a1b299edcb703cf3e3a126111e))
* address PR review security and data integrity issues ([7aae953](https://github.com/mattogodoy/nametag/commit/7aae9531beec212f08ecde121138f7f052d8e0a9))
* Allow internal addresses for CardDAV in self-hosted mode ([d46af3b](https://github.com/mattogodoy/nametag/commit/d46af3ba34b69ca7a40875f5245d5d7e399419bd))
* Clear blur timeout on unmount in PillSelector ([d1986b3](https://github.com/mattogodoy/nametag/commit/d1986b3588214576e2792bb3972d9cc2bf6282eb))
* correct TypeScript type errors in upload dedup test ([87ca2e5](https://github.com/mattogodoy/nametag/commit/87ca2e5ceb84a4c216601ee785471e5cecb9db98))
* deduplicate file import UIDs and update import lookup map ([2168631](https://github.com/mattogodoy/nametag/commit/21686314533325a0597d6c66b1208e7a192a1206))
* eliminate shared file-import connection and fix sync timeout lock ([4eb96da](https://github.com/mattogodoy/nametag/commit/4eb96da5ab5ee5b3503cdc0066cbbce6b31574c6))
* Guard against non-object error in handleApiError ([f168698](https://github.com/mattogodoy/nametag/commit/f168698eb35f12d3417d2ce9f6c6570eda12a1c2))
* merge duplicate ImportSuccessToast into single configurable component ([d4ad13f](https://github.com/mattogodoy/nametag/commit/d4ad13f18d1f638caf69eef9e3884d0d4e9d5212))
* Minor fixes for when the DB is down ([9386e09](https://github.com/mattogodoy/nametag/commit/9386e099eec2ddb36a625e1aa6fe5d80609279b2))
* remove dead devOnly check causing TypeScript build failure ([859292c](https://github.com/mattogodoy/nametag/commit/859292c81d496712bba0b114d529003795ad0dfe))
* remove vcard-test nav entry after page deletion ([70fddde](https://github.com/mattogodoy/nametag/commit/70fdddebb98d48572deebc369d2038dd717a56fe))
* replace hardcoded English error strings with i18n translation keys ([3c849cc](https://github.com/mattogodoy/nametag/commit/3c849ccad775152029b64e7e3c3e8f7f0ac8f25b))
* resolve all ESLint errors and warnings ([f4e06c9](https://github.com/mattogodoy/nametag/commit/f4e06c9f3fb3f9881c05461af3bb3fa79ada2b07))
* resolve TypeScript errors and test failures from accessibility changes ([e017d0d](https://github.com/mattogodoy/nametag/commit/e017d0d99c63981bcbead2885aeda7b11d00182c))
* Restore wizard flow for CardDAV backup endpoint ([3d41646](https://github.com/mattogodoy/nametag/commit/3d41646881fd23f8366a51334d40e31a7709a015))
* scope Person.uid unique constraint to per-user ([eab0cf2](https://github.com/mattogodoy/nametag/commit/eab0cf2a5be38b3fbad18684349728e4c83f269c))
* sync importantDates, groups, and missing fields bidirectionally ([673509c](https://github.com/mattogodoy/nametag/commit/673509c7f059453fd62ccd0d094180d3a7b8c4da))
* use shared Modal component for QR code overlay ([7673f65](https://github.com/mattogodoy/nametag/commit/7673f65c7ad76904f2a2541777997f19027b0423))

### Performance Improvements

* add batching, rate limiting, and timeout to sync operations ([0caeda1](https://github.com/mattogodoy/nametag/commit/0caeda1cf77e2aebc16b3697027cced35e7d3ba0))
* memoize vCard parsing and fix export progress indicator ([67dc3c5](https://github.com/mattogodoy/nametag/commit/67dc3c548655907faec7f2f6b5b82572ad0849a6))
* optimize sync and import queries to eliminate N+1 patterns ([c88a8a1](https://github.com/mattogodoy/nametag/commit/c88a8a12b9fcf0a981fd6e19d0986c9a0ec68591))

### Documentation

* add CardDAV, vCard, Photos, and Cron endpoints to OpenAPI spec ([47eb0b6](https://github.com/mattogodoy/nametag/commit/47eb0b6f2f3eb2c389e44554a95b706c09cf67b5))

### Changelog

All notable changes to this project will be documented in this file. Dates are displayed in UTC.

#### [v0.19.0](https://github.com/mattogodoy/nametag/compare/v0.18.1...v0.19.0)

- ✨ Feature: add full CardDAV bidirectional sync support [`#82`](https://github.com/mattogodoy/nametag/pull/82)
- Created vCard parser and test page [`c0fc5d9`](https://github.com/mattogodoy/nametag/commit/c0fc5d983c7d4424c9cbfebdb86c7cb42ff32ae4)
- Added schema improvements to accommodate all necessary fields for vCard compatibility [`66309f9`](https://github.com/mattogodoy/nametag/commit/66309f97fe6169addcdeadaf23e270d68969cdad)
- 🔧 Chore: remove debug artifacts, temp files, and dev-only vCard test page [`642c65a`](https://github.com/mattogodoy/nametag/commit/642c65a2a5a7663f6227101e591cedbc41414935)
- Improved CardDAV Sync page UX and UI [`5a4bce5`](https://github.com/mattogodoy/nametag/commit/5a4bce589e5a04d966c237090345d4d86d855d70)
- Added tests [`79c7095`](https://github.com/mattogodoy/nametag/commit/79c7095659f595e33171e2b3f3abce0fbd7e0d64)
- Added server connection wizard. Fixed many issues with sync and conflicts [`b982be1`](https://github.com/mattogodoy/nametag/commit/b982be14f266a72fafd7d64f34c3c820ce65b706)
- ✨ Feature: Stage 4 - Add multi-value vCard field managers [`4173701`](https://github.com/mattogodoy/nametag/commit/4173701339f6e19fdd249cd6887b21c8d3e84d3d)
- Remove temporary doc files [`68df66b`](https://github.com/mattogodoy/nametag/commit/68df66beeb9d1986c1de7795445b02e5600e8116)
- Updated languages [`c434301`](https://github.com/mattogodoy/nametag/commit/c4343011db4f09dfe1e59f0872ae1103c666dc16)
- ✨ Feature: Stage 2 - Add vCard transformation library [`0ee9499`](https://github.com/mattogodoy/nametag/commit/0ee94996ed781f5018e81fc92452dc60dc8ee32d)
- vCard v3 importer module and import processes created [`618c66f`](https://github.com/mattogodoy/nametag/commit/618c66f1f0b2f60aba9af91f5378f685efca5842)
- Add CardDAV cleanup implementation plan [`e6f862d`](https://github.com/mattogodoy/nametag/commit/e6f862d420f586135d7298a2ff34fc9df9122e41)
- Improvements for the import process. Fixes for soft-deleted and re-imported contacts [`59c4a60`](https://github.com/mattogodoy/nametag/commit/59c4a60d9a623a939882242195627927bc2ba64d)
- Add implementation plan for SSE sync progress [`61252ba`](https://github.com/mattogodoy/nametag/commit/61252ba81b172a980ce48907fc2e9cae5243b917)
- Added tests for new vCard parser [`a5c6302`](https://github.com/mattogodoy/nametag/commit/a5c6302769966de853695718778b204567eca316)
- ✨ Feature: Stage 5 - CardDAV connection setup UI and API [`f86c126`](https://github.com/mattogodoy/nametag/commit/f86c126a57eab71bed2ccfbf2f3cdb93f68ecc73)
- ✅ Test: add tests for auto-export and delete-contact modules [`3ff1205`](https://github.com/mattogodoy/nametag/commit/3ff1205a317fbc804784f29a2264ce717d00a0d5)
- Added tests for UID fix [`6177f6f`](https://github.com/mattogodoy/nametag/commit/6177f6fa39cfdb339075428c1788012ab1248111)
- ♻️ Refactor: extract shared vCard-to-person helpers to eliminate duplication [`57e6c26`](https://github.com/mattogodoy/nametag/commit/57e6c26356d0ff08fd097c256c8f48f97a40a6af)
- ✅ Test: add tests for encryption and retry modules [`ad687a1`](https://github.com/mattogodoy/nametag/commit/ad687a10ed4c66c6f3dd5e3cc34be910f1ab6fde)
- ✨ Feature: Stage 7 - Conflict resolution UI [`e2daec9`](https://github.com/mattogodoy/nametag/commit/e2daec93580899fc2c893cbca2a7ec5dc6fed001)
- ✨ Feature: Stage 6 - CardDAV sync engine with bidirectional sync [`8c7df95`](https://github.com/mattogodoy/nametag/commit/8c7df95664babf9575fe05d181e9bae69431231e)
- ✨ Feature: Stage 10 - Bulk export [`4408566`](https://github.com/mattogodoy/nametag/commit/44085669a4b445bd1cad6df022607b265fec425c)
- ✨ Feature: Stage 8 - Import flow UI [`c8f5eee`](https://github.com/mattogodoy/nametag/commit/c8f5eee913ee0b41011a746a54aa59b356323ca7)
- 📝 Docs: add CardDAV, vCard, Photos, and Cron endpoints to OpenAPI spec [`47eb0b6`](https://github.com/mattogodoy/nametag/commit/47eb0b6f2f3eb2c389e44554a95b706c09cf67b5)
- Store photos as files [`205a6b8`](https://github.com/mattogodoy/nametag/commit/205a6b8e17dbb911ea5f0b57d30a7242664e350b)
- ✨ Feature: Stage 1 - Add CardDAV database schema and migrations [`9c71af9`](https://github.com/mattogodoy/nametag/commit/9c71af956ca44bad2819cd5c3e597b67445ada17)
- Various fixes [`c7774b9`](https://github.com/mattogodoy/nametag/commit/c7774b925352e5cfe882779e8c491ad65dde6cd3)
- Improve contact check efficiency [`dcdad2f`](https://github.com/mattogodoy/nametag/commit/dcdad2fd11f3aa82ecafae8a14f2ffcfb642ef7f)
- 🐛 Fix: address PR review findings across security, API, UI, i18n, and tests [`a25dfeb`](https://github.com/mattogodoy/nametag/commit/a25dfeb5b761e9a1b299edcb703cf3e3a126111e)
- Added ARIA attributes [`f9dd6d5`](https://github.com/mattogodoy/nametag/commit/f9dd6d52ff660cad58ad5ecf33b42dc4cab49733)
- ✨ Feature: Stage 9 - Auto-export & notifications [`657f022`](https://github.com/mattogodoy/nametag/commit/657f022e53e81ec42f5e36b8278bf31d9579549b)
- Removed references to vCard v4 [`62f6a5a`](https://github.com/mattogodoy/nametag/commit/62f6a5a9dc56b832ef4f1fa73c04c035137b9c93)
- ✨ Feature: Stage 3 - Enhance Person API to support vCard fields [`984088f`](https://github.com/mattogodoy/nametag/commit/984088f2403dfbeba8c207269a9a4099e447a933)
- ✨ Feature: add per-person CardDAV sync toggle [`b54196e`](https://github.com/mattogodoy/nametag/commit/b54196e4de8af3a0b96e9836ee55f8aebe728c80)
- ✅ Test: add duplicate-UID tests for upload dedup and import loop [`39fbe67`](https://github.com/mattogodoy/nametag/commit/39fbe671a59676cf99df7adb52254b4256d69db0)
- ✨ Feature: Stage 15 - Documentation & final testing [`13fa69b`](https://github.com/mattogodoy/nametag/commit/13fa69b9374bb54e4a8248d80fba06951dec21f9)
- Updated person details page to show all fields [`9244617`](https://github.com/mattogodoy/nametag/commit/92446178105ffe65d709fcf87096f25a7fcf03e4)
- ✨ Feature: Stage 12 - Custom fields & advanced features [`63c5462`](https://github.com/mattogodoy/nametag/commit/63c5462ae4fa9ebdd3c225c987b68c7418c76beb)
- ✨ Feature: Stage 11 - Background sync & cron jobs [`6bfdc67`](https://github.com/mattogodoy/nametag/commit/6bfdc67d9cb132a735dd0d35cddf4eae3be19a48)
- vCard file import [`c68dc18`](https://github.com/mattogodoy/nametag/commit/c68dc18845dcdb0f7e10f638e9e648b1dac1a181)
- Implement new parser for the CardDAV import process [`3c6204b`](https://github.com/mattogodoy/nametag/commit/3c6204b5724bdc5a0eccf229cfec424eedc96d34)
- ✨ Feature: Stage 14 - Error handling & polish [`e97498c`](https://github.com/mattogodoy/nametag/commit/e97498c08b61b7b8c80034a8f9a9fb82c7dabae0)
- Add CardDAV pre-merge review design document [`950bd47`](https://github.com/mattogodoy/nametag/commit/950bd47c3572e4fdd8d31b68f49b8c9b1857701e)
- 🐛 Fix: add SSRF protection and input sanitization for CardDAV imports [`dd6780b`](https://github.com/mattogodoy/nametag/commit/dd6780ba3923d7fbee4fbfb639eedf3d6957a582)
- 🐛 Fix: eliminate shared file-import connection and fix sync timeout lock [`4eb96da`](https://github.com/mattogodoy/nametag/commit/4eb96da5ab5ee5b3503cdc0066cbbce6b31574c6)
- Some improvements for important dates [`62e5302`](https://github.com/mattogodoy/nametag/commit/62e530276026112e947d5659968d01fadc36cee0)
- Improve group selector in Import Contacts [`5fc94cd`](https://github.com/mattogodoy/nametag/commit/5fc94cd2ce4427c79d2aeb18c44daec2d68d38f3)
- First wave of fixes after the implementation [`03b67f4`](https://github.com/mattogodoy/nametag/commit/03b67f45c728671fd19119a2522311c40bfa659d)
- 🐛 Fix: address PR review security and data integrity issues [`7aae953`](https://github.com/mattogodoy/nametag/commit/7aae9531beec212f08ecde121138f7f052d8e0a9)
- Fix non-standard Instant Messaging fields for Appl [`dde5666`](https://github.com/mattogodoy/nametag/commit/dde566645f2cd2c7cfcdab5f8a7c4e7005cd71db)
- 🐛 Fix: add transactional safety to conflict resolution, connection delete, and import [`6f96ec1`](https://github.com/mattogodoy/nametag/commit/6f96ec1bd2e44ea9837200aa264b7903d96ee86f)
- Added QR code for exporting contacts [`d8177de`](https://github.com/mattogodoy/nametag/commit/d8177de1052395c8d53b90414f1236f7ddccb5dc)
- 🐛 Fix: Allow internal addresses for CardDAV in self-hosted mode [`d46af3b`](https://github.com/mattogodoy/nametag/commit/d46af3ba34b69ca7a40875f5245d5d7e399419bd)
- Update sync modal to show real-time SSE progress [`e681944`](https://github.com/mattogodoy/nametag/commit/e68194428a16ebfa753e4313878316e119521d60)
- 🐛 Fix: merge duplicate ImportSuccessToast into single configurable component [`d4ad13f`](https://github.com/mattogodoy/nametag/commit/d4ad13f18d1f638caf69eef9e3884d0d4e9d5212)
- Unify database migrations into one [`a34fa61`](https://github.com/mattogodoy/nametag/commit/a34fa61ee41a294e2a7e4f777000d05179b4abeb)
- ✨ Feature: Stage 13 - Settings & preferences [`fd33ea1`](https://github.com/mattogodoy/nametag/commit/fd33ea1a81ef232169cb56311ce96cdb2c0718eb)
- ♻️ Refactor: extract shared local data hashing utility for consistent change detection [`561f4db`](https://github.com/mattogodoy/nametag/commit/561f4db50960fefba6b3532966c15b3b6ab022e6)
- 🐛 Fix: add sync locking to prevent concurrent sync runs [`895688c`](https://github.com/mattogodoy/nametag/commit/895688cbba8c82d0162cab9bffd654f357673e19)
- 🐛 Fix: replace hardcoded English error strings with i18n translation keys [`3c849cc`](https://github.com/mattogodoy/nametag/commit/3c849ccad775152029b64e7e3c3e8f7f0ac8f25b)
- ⚡ Performance: optimize sync and import queries to eliminate N+1 patterns [`c88a8a1`](https://github.com/mattogodoy/nametag/commit/c88a8a12b9fcf0a981fd6e19d0986c9a0ec68591)
- ♻️ Refactor: consolidate CardDavConnection type definitions [`95345b1`](https://github.com/mattogodoy/nametag/commit/95345b118567b18b01c82b6999624b4aa35c2a17)
- Convert sync API to SSE streaming for real-time progress [`fa0cefa`](https://github.com/mattogodoy/nametag/commit/fa0cefa932c5e90610527d61705ddf974c1ec866)
- Removed manual config for sync frequency [`40a6a09`](https://github.com/mattogodoy/nametag/commit/40a6a091aa12284802a81217743acf118ffccaa3)
- 🐛 Fix: use shared Modal component for QR code overlay [`7673f65`](https://github.com/mattogodoy/nametag/commit/7673f65c7ad76904f2a2541777997f19027b0423)
- Some improvements for the import process [`6f5b4d7`](https://github.com/mattogodoy/nametag/commit/6f5b4d72e17250ea3ec526108f912c303655f61d)
- ♻️ Refactor: add Zod validation to all CardDAV API routes [`d2d20d3`](https://github.com/mattogodoy/nametag/commit/d2d20d3828b504be19d2498d14e56b8655ac69e9)
- Add design doc for SSE-based sync progress updates [`44fa2bc`](https://github.com/mattogodoy/nametag/commit/44fa2bc46c4c4418a0e501c6794c99e27ebf4be1)
- ✨ Feature: Add loading placeholder for person photo [`0978ac5`](https://github.com/mattogodoy/nametag/commit/0978ac5a5ef6aba109288c0d1ce69347361c71bb)
- Add progress callback to CardDAV sync engine [`e2a88e3`](https://github.com/mattogodoy/nametag/commit/e2a88e34b315da689667808b511a59330d57bc34)
- Fix UIDs for Google Sync [`31d7ec4`](https://github.com/mattogodoy/nametag/commit/31d7ec4c5ecf3809fb5d54b966f71003d5a8e24d)
- 🐛 Fix: Minor fixes for when the DB is down [`9386e09`](https://github.com/mattogodoy/nametag/commit/9386e099eec2ddb36a625e1aa6fe5d80609279b2)
- ⚡ Performance: memoize vCard parsing and fix export progress indicator [`67dc3c5`](https://github.com/mattogodoy/nametag/commit/67dc3c548655907faec7f2f6b5b82572ad0849a6)
- Added help links for app-specific password creation [`01fe470`](https://github.com/mattogodoy/nametag/commit/01fe470077dd417316dff5d5cd607f5bb362411c)
- 🐛 Fix: Restore wizard flow for CardDAV backup endpoint [`3d41646`](https://github.com/mattogodoy/nametag/commit/3d41646881fd23f8366a51334d40e31a7709a015)
- 🐛 Fix: deduplicate file import UIDs and update import lookup map [`2168631`](https://github.com/mattogodoy/nametag/commit/21686314533325a0597d6c66b1208e7a192a1206)
- Fix hot-reloading memory leak [`9776e1a`](https://github.com/mattogodoy/nametag/commit/9776e1a3dec36033cac9b4ab241d9c9f377de3f1)
- Fix indexOf performance and progress skip gap in sync engine [`5b27cba`](https://github.com/mattogodoy/nametag/commit/5b27cba8ccf77dff93ec385b800be5601d44288a)
- ⚡ Performance: add batching, rate limiting, and timeout to sync operations [`0caeda1`](https://github.com/mattogodoy/nametag/commit/0caeda1cf77e2aebc16b3697027cced35e7d3ba0)
- Add beta notice in settings page [`c3fd840`](https://github.com/mattogodoy/nametag/commit/c3fd84078583d9530288c32795d4ca2414e97bb8)
- Some fixes for sync [`76c363d`](https://github.com/mattogodoy/nametag/commit/76c363d1165e836b1841daf50697eaa115e538ef)
- 🐛 Fix: resolve all ESLint errors and warnings [`f4e06c9`](https://github.com/mattogodoy/nametag/commit/f4e06c9f3fb3f9881c05461af3bb3fa79ada2b07)
- Removed DATABASE_URL requirement [`ba40064`](https://github.com/mattogodoy/nametag/commit/ba40064b072da16971d6987a33bc7bcb853d1bd9)
- Added cron task to sync to CardDAV servers [`00b62af`](https://github.com/mattogodoy/nametag/commit/00b62afa858d707b1048acb9f94db550bf6e6727)
- 🐛 Fix: sync importantDates, groups, and missing fields bidirectionally [`673509c`](https://github.com/mattogodoy/nametag/commit/673509c7f059453fd62ccd0d094180d3a7b8c4da)
- Fix Location type error in ImportSuccessToast test [`72000c6`](https://github.com/mattogodoy/nametag/commit/72000c63e94fe0e8aacf7ac5e2fa94cd0f0322db)
- 🐛 Fix: add retry logic and proper logging to auto-export [`3ac7109`](https://github.com/mattogodoy/nametag/commit/3ac7109a36e1cf32d3f3c5131812d389f142342b)
- Fix build errors: add isYearUnknown to UpcomingEvent, fix Decimal/number type mismatch [`3187427`](https://github.com/mattogodoy/nametag/commit/31874274134b62154e423f5d3a0fa1f9783e051a)
- 🐛 Fix: Clear blur timeout on unmount in PillSelector [`d1986b3`](https://github.com/mattogodoy/nametag/commit/d1986b3588214576e2792bb3972d9cc2bf6282eb)
- Fixed failing tests [`8980978`](https://github.com/mattogodoy/nametag/commit/898097849e48cf945acc348e4112f1e68979d6b6)
- Fix photo sync [`2facf2a`](https://github.com/mattogodoy/nametag/commit/2facf2a2dcbeea236fed86bb8b991fc21f780659)
- 🐛 Fix: add missing cardDavSyncEnabled to vCard test mocks [`516f974`](https://github.com/mattogodoy/nametag/commit/516f9748d54ed19da80b42087e7c1a538a22c60b)
- 🐛 Fix: remove vcard-test nav entry after page deletion [`70fddde`](https://github.com/mattogodoy/nametag/commit/70fdddebb98d48572deebc369d2038dd717a56fe)
- 🐛 Fix: resolve TypeScript errors and test failures from accessibility changes [`e017d0d`](https://github.com/mattogodoy/nametag/commit/e017d0d99c63981bcbead2885aeda7b11d00182c)
- Fix round-trip sync issue [`a2f3f46`](https://github.com/mattogodoy/nametag/commit/a2f3f460d0a06e08b788941a3759661ebb80c15a)
- UX improvements for the import process [`785e00f`](https://github.com/mattogodoy/nametag/commit/785e00f668c072c7e9bba5f6fca4e6bf719b895e)
- Add i18n keys for sync progress messages [`810f9c6`](https://github.com/mattogodoy/nametag/commit/810f9c696d0133b0815af2efcde9d07f56b20847)
- 🐛 Fix: correct TypeScript type errors in upload dedup test [`87ca2e5`](https://github.com/mattogodoy/nametag/commit/87ca2e5ceb84a4c216601ee785471e5cecb9db98)
- 🐛 Fix: scope Person.uid unique constraint to per-user [`eab0cf2`](https://github.com/mattogodoy/nametag/commit/eab0cf2a5be38b3fbad18684349728e4c83f269c)
- Handle non-JSON error responses in sync modal gracefully [`fbdfe58`](https://github.com/mattogodoy/nametag/commit/fbdfe58a21c4844b1109c3a9f8538517a98ffc1e)
- Fix for conflicts merge [`dd99356`](https://github.com/mattogodoy/nametag/commit/dd99356fa8453ce8094505fba6080041447fde82)
- 🐛 Fix: remove dead devOnly check causing TypeScript build failure [`859292c`](https://github.com/mattogodoy/nametag/commit/859292c81d496712bba0b114d529003795ad0dfe)
- Removed useless information from import page [`0a98613`](https://github.com/mattogodoy/nametag/commit/0a98613c073a96181013dcc7c09fee848de58f2f)
- 🐛 Fix: Guard against non-object error in handleApiError [`f168698`](https://github.com/mattogodoy/nametag/commit/f168698eb35f12d3417d2ce9f6c6570eda12a1c2)
- Order contacts alphabetically in the import page [`daae5f6`](https://github.com/mattogodoy/nametag/commit/daae5f61907ab58060f2d808183e583c4dd92756)
- Replace double type cast with spread operator in SSE route [`bd38280`](https://github.com/mattogodoy/nametag/commit/bd38280df02ac3a5c5c1e2636044f192e7103679)
- Fix for Google Contacts [`7d0d12e`](https://github.com/mattogodoy/nametag/commit/7d0d12e351a274131aabbed61d50f6f5a991b49f)

#### [v0.18.1](https://github.com/mattogodoy/nametag/compare/v0.18.0...v0.18.1)

> 22 February 2026

- Update database scripts [`#83`](https://github.com/mattogodoy/nametag/pull/83)
- 🐛 Fix: Update database scripts [`655a426`](https://github.com/mattogodoy/nametag/commit/655a426fb9a2e5e8072ec45405b9b330815d26a2)
- 🔧 Chore: release v0.18.1 [`36412a4`](https://github.com/mattogodoy/nametag/commit/36412a43c5f38e8c532c1f925d1698cffadd2a36)

#### [v0.18.0](https://github.com/mattogodoy/nametag/compare/v0.17.1...v0.18.0)

> 14 February 2026

- ✨ Feature: complete API coverage, OpenAPI spec, Swagger UI, and soft-delete consistency fixes [`#70`](https://github.com/mattogodoy/nametag/pull/70)
- ✨ Feature: complete API coverage and add OpenAPI spec endpoint [`b850288`](https://github.com/mattogodoy/nametag/commit/b85028841450aec33ee03f15894e73a0c5b59dda)
- 🐛 Fix: scope CSP to /api/docs, harden relationship endpoint, add tests [`4e5a62b`](https://github.com/mattogodoy/nametag/commit/4e5a62b4fa5bd4a3f2a97e1c69a247f32d047d58)
- ✨ Feature: generate OpenAPI request body schemas from Zod validations [`e08f23d`](https://github.com/mattogodoy/nametag/commit/e08f23df254adfd59710a70021ee02b82f68b912)
- 🐛 Fix(openapi): fix validation errors for MCP/FastMCP compatibility [`3e93b16`](https://github.com/mattogodoy/nametag/commit/3e93b16a500767bd3b467364ca27dc55d588d95a)
- 🐛 Fix: exclude soft-deleted records from stats, align relationship selects [`00a5ec6`](https://github.com/mattogodoy/nametag/commit/00a5ec650250b03e436bf1f69965418bc74a25db)
- 🐛 Fix: pin Swagger UI CDN, filter deleted important dates, type billing schemas [`e3a9b90`](https://github.com/mattogodoy/nametag/commit/e3a9b90a43c72534d94a8183aa30a936e1905b1b)
- 🐛 Fix: allow unpkg.com in CSP for Swagger UI CDN resources [`8f1653c`](https://github.com/mattogodoy/nametag/commit/8f1653c42b1dd9dc35fd8621062f20c1c150f80c)
- ✨ Feature: add Swagger UI docs page at /api/docs [`dde3564`](https://github.com/mattogodoy/nametag/commit/dde3564c38a167765d89728bf46cab2c8744e075)
- 🔧 Chore: release v0.18.0 [`38c47cc`](https://github.com/mattogodoy/nametag/commit/38c47cc95d85f023df24ba89353ee2301fee8b6b)
- 🐛 Fix: filter soft-deleted entities from relationship queries and fix i18n regression [`cff3320`](https://github.com/mattogodoy/nametag/commit/cff3320d61aa3d9c37c0c2db847d0e4af84d00a3)
- 🐛 Fix: remove duplicate CSP, align soft-delete filter, type OpenAPI spec [`406a5de`](https://github.com/mattogodoy/nametag/commit/406a5de84d6e45527427d040c533cf1c8f420108)
- ✨ Feature: add public /api/version endpoint for release monitoring [`1fe066b`](https://github.com/mattogodoy/nametag/commit/1fe066be9579a313befc4fe52353fc8c44737c02)
- 🐛 Fix: replace non-standard `format: cuid` with description in OpenAPI spec [`73ba51b`](https://github.com/mattogodoy/nametag/commit/73ba51b3f1d78415121c9b63562a8da6d0654fc3)
- 🐛 Fix: exclude soft-deleted people from relationship type usage count in UI [`98e3f93`](https://github.com/mattogodoy/nametag/commit/98e3f93ef0c45e8c4302efcc603411e751908b35)
- 🐛 Fix: exclude soft-deleted people from relationship type in-use check [`19e1256`](https://github.com/mattogodoy/nametag/commit/19e125648a648d7feb8a705c2c8d0d664652b54f)
- 🐛 Fix: preprocess empty string to null for lastContact validation [`71bf8f3`](https://github.com/mattogodoy/nametag/commit/71bf8f3bdc17ec26273bf6ca99a18d16fa909b6d)
- 🐛 Fix: exclude soft-deleted people from dashboard upcoming events [`edcadb2`](https://github.com/mattogodoy/nametag/commit/edcadb2308ac5eaad01bfb776de3029d00a62734)

#### [v0.17.1](https://github.com/mattogodoy/nametag/compare/v0.17.0...v0.17.1)

> 7 February 2026

- Make email to be case-insensitive [`#69`](https://github.com/mattogodoy/nametag/pull/69)
- 🐛 Fix: Make email to be case-insensitive [`cf5b65d`](https://github.com/mattogodoy/nametag/commit/cf5b65de312be714fcb4e7b7d0b7b26716f475c1)
- 🔧 Chore: release v0.17.1 [`ed77e36`](https://github.com/mattogodoy/nametag/commit/ed77e36a45aa4e4188602cfce42b3297bc646596)

#### [v0.17.0](https://github.com/mattogodoy/nametag/compare/v0.16.6...v0.17.0)

> 7 February 2026

- 🐛 Fix: person-centric relationship to user [`#34`](https://github.com/mattogodoy/nametag/pull/34)
- ✅ Test: graph edge deduplication [`886f4b4`](https://github.com/mattogodoy/nametag/commit/886f4b4a71c48bdfbc9bd0e72301a7c1aa3e184d)
- ✅ Test: remove unnecessary describe block [`29a916f`](https://github.com/mattogodoy/nametag/commit/29a916f6ae522fa5e2b2ec476a2d6b038f023e13)
- ✨ Feature: both relationship directions for person-centric graph [`a7e2b0b`](https://github.com/mattogodoy/nametag/commit/a7e2b0b08ec833e8206754c5b36c43e1196f0f10)
- ✨ Feature: show both relationship direction in dashboard if available [`23a9853`](https://github.com/mattogodoy/nametag/commit/23a98537fb257ed37ebf1fcab46f1b58017d22e0)
- 🔧 Chore: release v0.17.0 [`3e7d1a8`](https://github.com/mattogodoy/nametag/commit/3e7d1a885021ad8cb4e807f42449110c9c55f003)
- ✨ Feature: show arrows only when highlighting edges [`f36bb85`](https://github.com/mattogodoy/nametag/commit/f36bb85f4fcbd70a71a60d103b36b54ccd015240)
- 🐛 Fix: string keys to track edges instead of objects [`9af9554`](https://github.com/mattogodoy/nametag/commit/9af955436bc85e89c5a66b980c197e67ce53d7d4)
- 🐛 Fix: use map to dedup edges [`ff4bc23`](https://github.com/mattogodoy/nametag/commit/ff4bc23a30da6a9edafbaff0d4c0ee325b6f20f7)
- 📝 Docs: describe utility functions [`45b12f2`](https://github.com/mattogodoy/nametag/commit/45b12f255fcfa7c4ec90bcccf24366130300e2a5)
- 📝 Docs: more meaningful name for function [`c06d138`](https://github.com/mattogodoy/nametag/commit/c06d138ad99fb343dccad977087c66ee13695e85)
- 🐛 Fix: only include edges between existing people in the network [`5629e3a`](https://github.com/mattogodoy/nametag/commit/5629e3ae10a01fd0da3ead97d4245c1966ec2594)
- 🐛 Fix: exclude deleted relationship [`591dc2b`](https://github.com/mattogodoy/nametag/commit/591dc2bfc33d2a493999df1eef2610cd6ebc8044)
- 📝 Docs: explanation for choosing inverse of the relationship to user [`a4ee867`](https://github.com/mattogodoy/nametag/commit/a4ee867b75e4ee4f2c7832652610f65c0554f45c)
- 💄 Style: add semicolon and fix typo [`f59112c`](https://github.com/mattogodoy/nametag/commit/f59112c996b59ebea757986c3f84044cc9d73e93)
- 🐛 Fix: only add edges when both people present [`1bb030d`](https://github.com/mattogodoy/nametag/commit/1bb030dfa7948c7b0f968bbc3d945e2b44398b24)
- 💄 Style: add missing closing bracket [`4fff54e`](https://github.com/mattogodoy/nametag/commit/4fff54e0c1aa5922d7c70fdad61d85a7d7ea9378)
- 🐛 Fix: add back missing opacity [`742389c`](https://github.com/mattogodoy/nametag/commit/742389c72070dde2132b495e8da2f37bfcdd0ab9)
- 💄 Style: add .prettierrc for consistent formatting [`1d2a098`](https://github.com/mattogodoy/nametag/commit/1d2a0981ba67fe61f46ecf47aeab87514d3457f5)

#### [v0.16.6](https://github.com/mattogodoy/nametag/compare/v0.16.5...v0.16.6)

> 24 January 2026

- optimize orphan detection [`#59`](https://github.com/mattogodoy/nametag/pull/59)
- 🔧 Chore: release v0.16.6 [`56f8246`](https://github.com/mattogodoy/nametag/commit/56f82465b19687ca929f659790ad0c522b7abb6a)
- 🐛 Fix: Create release for Optimize Orphan Detection (PR #59) [`51daea5`](https://github.com/mattogodoy/nametag/commit/51daea51f3e96a84cdf7ea59a49f4ebc92a38e2e)
- optimize orphan detection logic to avoid n+1 queries [`0be1799`](https://github.com/mattogodoy/nametag/commit/0be1799f7f7a1f5f715730c94bdc737e720deb34)

#### [v0.16.5](https://github.com/mattogodoy/nametag/compare/v0.16.4...v0.16.5)

> 24 January 2026

- Solve timezone conversion issue [`#61`](https://github.com/mattogodoy/nametag/pull/61)
- 🐛 Fix: Solve timezone conversion issue [`bd1c280`](https://github.com/mattogodoy/nametag/commit/bd1c2801918c858aa4d5e7bd224f9cc7281b51aa)
- 🔧 Chore: release v0.16.5 [`3a76b48`](https://github.com/mattogodoy/nametag/commit/3a76b481d15eff5bb3e227a5b1a5e81a5926a4e0)

#### [v0.16.4](https://github.com/mattogodoy/nametag/compare/v0.16.3...v0.16.4)

> 24 January 2026

- Allow special characters in relationship types [`#60`](https://github.com/mattogodoy/nametag/pull/60)
- 🔧 Chore: release v0.16.4 [`48b93cf`](https://github.com/mattogodoy/nametag/commit/48b93cf1afdb4f3d0451c65beb2ebb27653af9d1)
- 🐛 Fix: Allow special characrters in relationship types [`47abd03`](https://github.com/mattogodoy/nametag/commit/47abd039d766682553c16522e31935a925eb2cbc)

#### [v0.16.3](https://github.com/mattogodoy/nametag/compare/v0.16.2...v0.16.3)

> 22 January 2026

- Added German Translation [`#52`](https://github.com/mattogodoy/nametag/pull/52)
- 🔧 Chore: release v0.16.3 [`11d5db7`](https://github.com/mattogodoy/nametag/commit/11d5db76a5d688e9dea108794d7fbcadc9c773ee)
- 🐛 Fix: Create release for German translations (PR #52) [`dc2ed7f`](https://github.com/mattogodoy/nametag/commit/dc2ed7f3cdba20cbd98a4bb2793b644c6ae4afe2)

#### [v0.16.2](https://github.com/mattogodoy/nametag/compare/v0.16.1...v0.16.2)

> 22 January 2026

- Added Norwegian translation [`#49`](https://github.com/mattogodoy/nametag/pull/49)
- 🔧 Chore: release v0.16.2 [`6b43bdc`](https://github.com/mattogodoy/nametag/commit/6b43bdc947e6e542a59a67a4e37db448a981a720)
- 🐛 Fix: Create release for Norwegian translations (PR #49) [`38d39e1`](https://github.com/mattogodoy/nametag/commit/38d39e1eac710f0aa8cea54ccfa164a761c473de)
- Added Norwegian Bokmål language [`fa459d3`](https://github.com/mattogodoy/nametag/commit/fa459d31c337804dc365bdff5f1beb585f43049d)
- added norwegian to menu list, supported locale allowlist, updated API validation message. [`8f88e9d`](https://github.com/mattogodoy/nametag/commit/8f88e9d5fb3aa9ca8eefaa10857a720568547d7b)
- i18n.ts [`2c16e2c`](https://github.com/mattogodoy/nametag/commit/2c16e2c9982e2c7a25253a9b9090046c32045142)
- Update Roadmap [`bdbacea`](https://github.com/mattogodoy/nametag/commit/bdbacea17bd968db2e63152e77dc41a827eeadc1)

#### [v0.16.1](https://github.com/mattogodoy/nametag/compare/v0.16.0...v0.16.1)

> 21 January 2026

- 🐛 Fix: Add docs and a few fixes for new language [`#47`](https://github.com/mattogodoy/nametag/pull/47)
- 🔧 Chore: Added instructions for adding a new language in the CONTRIBUTING file [`63d9253`](https://github.com/mattogodoy/nametag/commit/63d92538377ae4ceaab48cce7750798a48399fcf)
- 🐛 Fix: Add necessary changes for new language [`c12ee99`](https://github.com/mattogodoy/nametag/commit/c12ee9993142a30e49bec6abe014f48fe862af1a)
- 🔧 Chore: release v0.16.1 [`e4e2890`](https://github.com/mattogodoy/nametag/commit/e4e2890ca2b5fd1d8ca061aef0c9739c863351c6)

#### [v0.16.0](https://github.com/mattogodoy/nametag/compare/v0.15.4...v0.16.0)

> 21 January 2026

- add Japanese translation [`#36`](https://github.com/mattogodoy/nametag/pull/36)
- 🔧 Chore: release v0.16.0 [`886d55b`](https://github.com/mattogodoy/nametag/commit/886d55b6f8dfed451da42c306ca89c8dfe077b17)
- ✨ Feature: Create release for Japanese translations (PR #36) [`c684a74`](https://github.com/mattogodoy/nametag/commit/c684a74ff1bb6465439f5bf229fa2ce39ce1ca3d)
- Add files via upload [`a3cfe0b`](https://github.com/mattogodoy/nametag/commit/a3cfe0b680aba802b55a93a3fa5ec27250fa0078)
- Delete package-lock.json [`2dc875c`](https://github.com/mattogodoy/nametag/commit/2dc875c3e20a43e4064122eec5e585a9e22eafd3)
- Add files via upload [`912c055`](https://github.com/mattogodoy/nametag/commit/912c0558975c57d0da6d916f353835edeb911ea0)
- 🔧 Chore: release v0.16.0 [`767c8a1`](https://github.com/mattogodoy/nametag/commit/767c8a151387bf5e6671bd7db58b58801cd5e4f3)
- Add files via upload [`1a8e284`](https://github.com/mattogodoy/nametag/commit/1a8e284d5905e1e993076f70e73602de9fcd251e)
- Delete CHANGELOG.md [`defcea8`](https://github.com/mattogodoy/nametag/commit/defcea8e51a2f0be33e5a47b1b5a047e5c0f29ee)
- Delete package.json [`1cf3b9f`](https://github.com/mattogodoy/nametag/commit/1cf3b9fa03cba524a172408b2d2f664e9a28366c)
- Update LanguageSelector.tsx [`9695926`](https://github.com/mattogodoy/nametag/commit/96959265f3ba6bfe391460a77571f87e045ed99f)
- Update ja-JP.json [`9f235d7`](https://github.com/mattogodoy/nametag/commit/9f235d79437ed4559fa0ea9976faed930ad5d194)
- Update LanguageSelector.tsx [`e56d47a`](https://github.com/mattogodoy/nametag/commit/e56d47a5a56233c8f455c3c59e195cf57a619a54)
- Update ja-JP.json [`977f306`](https://github.com/mattogodoy/nametag/commit/977f306ab8934d7f6ab8e99fb64ffc5ed7430268)
- Update en.json [`d84b31a`](https://github.com/mattogodoy/nametag/commit/d84b31a6aad35c6566c2589bd5e44fe337b82ee0)
- Update es-ES.json [`13ecb56`](https://github.com/mattogodoy/nametag/commit/13ecb5619371e8894a1d73d2c8bd8f615a0e6bae)

#### [v0.15.4](https://github.com/mattogodoy/nametag/compare/v0.15.3...v0.15.4)

> 20 January 2026

- Allow GitHub Actions bot to create new releases [`#45`](https://github.com/mattogodoy/nametag/pull/45)
- Fix session cookie hijack vulnerability [`#44`](https://github.com/mattogodoy/nametag/pull/44)
- 🔧 Chore: Prevent PRs from automatically bumping the release version [`#43`](https://github.com/mattogodoy/nametag/pull/43)
- Added documentation about PR verification checks [`#42`](https://github.com/mattogodoy/nametag/pull/42)
- 🐛 Fix: Fix for cookie hijacking vulnerability [`e68445b`](https://github.com/mattogodoy/nametag/commit/e68445b14185b028169c1269a340228dd20efe6c)
- 🔧 Chore: Add pre-merge checks for PRs [`f68d061`](https://github.com/mattogodoy/nametag/commit/f68d0611f7992d131b65c8a2b47b664594b79dcc)
- Disable E2E tests verification [`fc93dab`](https://github.com/mattogodoy/nametag/commit/fc93dabd00a4afb0ded59d2493087cff6b1e9070)
- 🔧 Chore: Fix tests so they pass verifications [`64bea35`](https://github.com/mattogodoy/nametag/commit/64bea35e0a6859a52a9a1e5521799acc22e5a086)
- Disable E2E tests verification [`e98d45b`](https://github.com/mattogodoy/nametag/commit/e98d45b4ac2ab9fa277e28d5bff8e6d998924266)
- 🔧 Chore: Tightening the solution to the vulnerability [`6deddd1`](https://github.com/mattogodoy/nametag/commit/6deddd1890772021674af62fae4274fde8d6fd37)
- 🔧 Chore: release v0.15.4 [`d0fc2a6`](https://github.com/mattogodoy/nametag/commit/d0fc2a63af7fe942ddfb285813fb3b6265cce1c2)
- Mock change to trigger the verification [`bf3f5ec`](https://github.com/mattogodoy/nametag/commit/bf3f5ec0a1f5e20c9de792b1e7a7cbeffe80de67)
- 🐛 Fix: Allow GitHub Actions bot to create new releases [`3f98c37`](https://github.com/mattogodoy/nametag/commit/3f98c371004a4e7c1199c463bed4c883e860b807)
- 🔧 Chore: Allow manual PR verification run [`3ad37f6`](https://github.com/mattogodoy/nametag/commit/3ad37f62880b9ba378c807adaf510e37d8f0374d)
- Update roadmap [`e7f9f53`](https://github.com/mattogodoy/nametag/commit/e7f9f534ef52b73748c19b4f70daa747170b04c7)

#### [v0.15.3](https://github.com/mattogodoy/nametag/compare/v0.15.2...v0.15.3)

> 19 January 2026

- 🔧 Chore: release v0.15.3 [`b11c69a`](https://github.com/mattogodoy/nametag/commit/b11c69aa810269d880f9a946f0667c9113050e72)
- 🔧 Chore: Small fixes in documentation [`1762b96`](https://github.com/mattogodoy/nametag/commit/1762b961c49ab9cec170a3ad5ff40ee704af6db6)
- 🐛 Fix: Fix for docker entrypoint with the new env variables for database. [`6a69f97`](https://github.com/mattogodoy/nametag/commit/6a69f97170c38e1341d16f911ee114e0910fef45)

#### [v0.15.2](https://github.com/mattogodoy/nametag/compare/v0.15.1...v0.15.2)

> 19 January 2026

- [refactor] Simplify dev environment [`#39`](https://github.com/mattogodoy/nametag/pull/39)
- ♻️ Refactor: Many quality of life improvements for contributors and self-hosters: [`9db9abd`](https://github.com/mattogodoy/nametag/commit/9db9abd335d4a6cd569bbd2de1a5a39e65028fc0)
- 🔧 Chore: Some improvements for devcontainers [`09d629e`](https://github.com/mattogodoy/nametag/commit/09d629e0149ab50868ac7069314e69ddecb433d6)
- 🔧 Chore: Update roadmap and some linting in README [`6f836d5`](https://github.com/mattogodoy/nametag/commit/6f836d5f560da4a9667cb406556f5f388ab80818)
- 🔧 Chore: Ensure the release is only published after the Docker builds succeed [`b322a63`](https://github.com/mattogodoy/nametag/commit/b322a63d5fe79ff82cb771142722cc55ae3d04a7)
- 🔧 Chore: release v0.15.2 [`cdd2230`](https://github.com/mattogodoy/nametag/commit/cdd22308f6210fa7803e015f4194528ec058ace8)
- 🔧 Chore: Improved documentation about Redis in the README file. [`7afdc49`](https://github.com/mattogodoy/nametag/commit/7afdc4911a85e4303444a58ed45684e0ed9e1e9b)
- 🔧 Chore: Adjusted roadmap priorities [`b714ed9`](https://github.com/mattogodoy/nametag/commit/b714ed9f9a5e63c93875fde1a07b9ed1db1e7621)
- 🐛 Fix: Mock commit to increase version number. Adding breaking changes notice [`5dbcb98`](https://github.com/mattogodoy/nametag/commit/5dbcb981aff934b200407e2e8f5a2a2cbeffb887)

#### [v0.15.1](https://github.com/mattogodoy/nametag/compare/v0.15.0...v0.15.1)

> 17 January 2026

- 🔧 Chore: Added Roadmap section to the README file. [`394ddda`](https://github.com/mattogodoy/nametag/commit/394ddda85640b1b2ac51a4fdeda82cd6a471c034)
- 🔧 Chore: release v0.15.1 [`3790dda`](https://github.com/mattogodoy/nametag/commit/3790ddaa3f22a883e38462241a51d406c8f5e38a)
- 🐛 Fix: Redirect to login when email verification is disabled [`27a7cb2`](https://github.com/mattogodoy/nametag/commit/27a7cb25d4a7875d46674ddeb184c277694be95e)

#### [v0.15.0](https://github.com/mattogodoy/nametag/compare/v0.14.1...v0.15.0)

> 15 January 2026

- Add support for SMTP server [`#21`](https://github.com/mattogodoy/nametag/pull/21)
- 👷 CI: use github actions matrix for parallel builds [`#20`](https://github.com/mattogodoy/nametag/pull/20)
- ✨ Feature: Support SMTP server for custom email sender [`721b654`](https://github.com/mattogodoy/nametag/commit/721b654f42ecedee0d73df266797866380120f27)
- 🔧 Chore: release v0.15.0 [`a108c2a`](https://github.com/mattogodoy/nametag/commit/a108c2a8ba92045e30fa3f9ae58d9d72a6262816)

#### [v0.14.1](https://github.com/mattogodoy/nametag/compare/v0.14.0...v0.14.1)

> 15 January 2026

- ⚡ Performance: parallelize multi-arch Docker builds for faster CI [`b4cd5c5`](https://github.com/mattogodoy/nametag/commit/b4cd5c5f59c314ea81f0ee08f430c73bacb4e8fe)
- 🔧 Chore: release v0.14.1 [`c3ef2e4`](https://github.com/mattogodoy/nametag/commit/c3ef2e4b1f092f5f993a4d22a45f539a0260db1d)

#### [v0.14.0](https://github.com/mattogodoy/nametag/compare/v0.13.0...v0.14.0)

> 15 January 2026

- 👷 CI: build multi-arch docker image [`#18`](https://github.com/mattogodoy/nametag/pull/18)
- 🔧 Chore: release v0.14.0 [`3eda6a3`](https://github.com/mattogodoy/nametag/commit/3eda6a3ab36bec9723284de613695260d1f4169f)
- ✨ Feature: add multi-platform Docker support (AMD64 and ARM64) [`3504ea4`](https://github.com/mattogodoy/nametag/commit/3504ea4822e324f2ea3a6db3584a9fc22037c9c4)
- 👷 CI: add manual workflow trigger [`2dccdef`](https://github.com/mattogodoy/nametag/commit/2dccdef83306fb9c1bf8da9a7daddcc05f239bfc)
- 👷 CI: build to arm64 [`c47c8a7`](https://github.com/mattogodoy/nametag/commit/c47c8a7ef73d31f6c9291406b425084062db1e9a)

#### [v0.13.0](https://github.com/mattogodoy/nametag/compare/v0.12.3...v0.13.0)

> 14 January 2026

- Add option to disable registration [`#17`](https://github.com/mattogodoy/nametag/pull/17)
- ✨ Feature: Added option to disable registration [`eb5c9d2`](https://github.com/mattogodoy/nametag/commit/eb5c9d223f60ffcba3f186453637b2526f088e1f)
- 🔧 Chore: release v0.13.0 [`87f6671`](https://github.com/mattogodoy/nametag/commit/87f6671f0f52fac014f51632f5064074d35ce87e)

#### [v0.12.3](https://github.com/mattogodoy/nametag/compare/v0.12.2...v0.12.3)

> 14 January 2026

- Fix typo [`#5`](https://github.com/mattogodoy/nametag/pull/5)
- 🔧 Chore: release v0.12.3 [`aeaa93a`](https://github.com/mattogodoy/nametag/commit/aeaa93afa75d9c7d7d71c9ceba70ea0a6df58043)
- 🐛 Fix: Some buttons were getting stuck in a disabled state [`6369811`](https://github.com/mattogodoy/nametag/commit/6369811f3d61a6402b45b416630224be709353ac)

#### [v0.12.2](https://github.com/mattogodoy/nametag/compare/v0.12.1...v0.12.2)

> 14 January 2026

- Fix incorrect relationship side showing on the user details page [`#11`](https://github.com/mattogodoy/nametag/pull/11)
- 🐛 Fix: Fixed incorrect relationship side showing on the user details page [`11d72c3`](https://github.com/mattogodoy/nametag/commit/11d72c33bbe06f3d601f4cc8b9087dcb093c4bbc)
- 🔧 Chore: release v0.12.2 [`e8ec37c`](https://github.com/mattogodoy/nametag/commit/e8ec37c00452469b945c8b0db8872e34dd8ecb66)

#### [v0.12.1](https://github.com/mattogodoy/nametag/compare/v0.12.0...v0.12.1)

> 13 January 2026

- 🐛 Fix: Make the self-hosted version work without setting the resend API key [`bab3b6e`](https://github.com/mattogodoy/nametag/commit/bab3b6efa1e5e099e74166204d7caae6f3319a8a)
- 🔧 Chore: release v0.12.1 [`b43b1cf`](https://github.com/mattogodoy/nametag/commit/b43b1cf294629834ffe741d1e28027361c159200)
- 🔧 Chore: Added square logo [`6066222`](https://github.com/mattogodoy/nametag/commit/606622246819177de535ae3892d5368ab2a060e5)

#### [v0.12.0](https://github.com/mattogodoy/nametag/compare/v0.11.0...v0.12.0)

> 13 January 2026

- ✨ Feature: Added link to disable reminders directly from the emails. Other fixes related to reminders [`b67c4ed`](https://github.com/mattogodoy/nametag/commit/b67c4ed5354bce31ffdd79358d6a22959947eaf9)
- 🔧 Chore: release v0.12.0 [`5177b45`](https://github.com/mattogodoy/nametag/commit/5177b451c594c203e46aba8b4b7afe782f6160ee)
- 🐛 Fix: Added missing var to the env schema [`e9c442c`](https://github.com/mattogodoy/nametag/commit/e9c442c3ad12bf1d5030662ef93a3f1d587eb3eb)

#### [v0.11.0](https://github.com/mattogodoy/nametag/compare/v0.10.4...v0.11.0)

> 12 January 2026

- ✨ Feature: Added middle name and second last name fields [`59ae3d0`](https://github.com/mattogodoy/nametag/commit/59ae3d0aff3b2ce5ca06f133047bedbf0b6f4059)
- 🔧 Chore: release v0.11.0 [`e08a29a`](https://github.com/mattogodoy/nametag/commit/e08a29a76c7fd5d79c71c60816d137f10f54ed18)
- 🐛 Fix: Disable 1passowrd for autocomplete fields [`dd0d473`](https://github.com/mattogodoy/nametag/commit/dd0d473a6be567d088f14bf46a9cb946f61cb48b)
- Added missing translation key [`656d8b0`](https://github.com/mattogodoy/nametag/commit/656d8b08c90b2cf7ccc90c3ce8899ce813f26c6b)

#### [v0.10.4](https://github.com/mattogodoy/nametag/compare/v0.10.3...v0.10.4)

> 9 January 2026

- 🔧 Chore: release v0.10.4 [`1bbcc82`](https://github.com/mattogodoy/nametag/commit/1bbcc8288cfbfa5c05fab09ef23fce9d0678ec82)
- 🐛 Fix: Roll back prisma installation removal [`6fdb2d5`](https://github.com/mattogodoy/nametag/commit/6fdb2d59f1398122f35fa232d33ca0749a1ea9a8)

#### [v0.10.3](https://github.com/mattogodoy/nametag/compare/v0.10.2...v0.10.3)

> 9 January 2026

- 🔧 Chore: release v0.10.3 [`8334492`](https://github.com/mattogodoy/nametag/commit/83344920c9b6e7167d0125541049ba2303610b4b)
- 🐛 Fix: Added prisma/engines module to build [`2e27822`](https://github.com/mattogodoy/nametag/commit/2e278226b17b49dc6d32953466db660bd97a0544)

#### [v0.10.2](https://github.com/mattogodoy/nametag/compare/v0.10.1...v0.10.2)

> 9 January 2026

- 🐛 Fix: Trying to reduce docker image size and build times [`12e4491`](https://github.com/mattogodoy/nametag/commit/12e4491f688016d5625d877542fd98a627330ef2)
- 🔧 Chore: release v0.10.2 [`26b5f7b`](https://github.com/mattogodoy/nametag/commit/26b5f7b64d7bd4f6160d8ad036f6ac834284f528)

#### [v0.10.1](https://github.com/mattogodoy/nametag/compare/v0.10.0...v0.10.1)

> 9 January 2026

- 🔧 Chore: release v0.10.1 [`da412fb`](https://github.com/mattogodoy/nametag/commit/da412fbf18a05b5cfb39f080a9288fb4fd02dcda)
- 🐛 Fix: Google OAuth button translations [`b189ca7`](https://github.com/mattogodoy/nametag/commit/b189ca747169dd5311a717f6c7b619148aaa3e31)

#### [v0.10.0](https://github.com/mattogodoy/nametag/compare/v0.9.0...v0.10.0)

> 9 January 2026

- 🔧 Chore: release v0.10.0 [`e365d55`](https://github.com/mattogodoy/nametag/commit/e365d55211c6a0165a20cc968c3a778adcf63ca6)
- 🐛 Fix: Replace any type with explicit cookie options type [`074798d`](https://github.com/mattogodoy/nametag/commit/074798d8dcb108a9151cf3f827e56a5abcb2f918)
- ✨ Feature: Enable cross-subdomain language cookie sharing [`f0399c9`](https://github.com/mattogodoy/nametag/commit/f0399c95734aebfaf1f064ae903828b383f38f26)
- Added cross-site cookies for language [`b705b59`](https://github.com/mattogodoy/nametag/commit/b705b593321b8d5608fe68c7838f9e23985ec237)
- 🐛 Fix: Meaningless change to trigger GitHub build [`a1fcf69`](https://github.com/mattogodoy/nametag/commit/a1fcf69c2d47c561fba57553f3740b45b2d414bc)
- 🔧 Chore: Meaningless change to trigger GitHub build [`0d1d892`](https://github.com/mattogodoy/nametag/commit/0d1d892fc2a71ab01c909a0b367179f45c4d2430)

#### [v0.9.0](https://github.com/mattogodoy/nametag/compare/v0.8.0...v0.9.0)

> 9 January 2026

- Added internationalization to the entire app [`#3`](https://github.com/mattogodoy/nametag/pull/3)
- ✨ Feature: Added localization to the app. English and Spanish now supported [`6c26d80`](https://github.com/mattogodoy/nametag/commit/6c26d80fb970cbddd964dc77fa9638aa8fc29bd3)
- 🐛 Fix: Added many missing translations and small fixes [`34d4952`](https://github.com/mattogodoy/nametag/commit/34d4952a23af4c1b0a315bc2567b1848cf57cf6c)
- Added documentation [`3d376ed`](https://github.com/mattogodoy/nametag/commit/3d376edc281ba4494aab5cd7d56b369792f99d25)
- 🐛 Fix: Fix app loading [`0ea9588`](https://github.com/mattogodoy/nametag/commit/0ea95881843a275681a344aac9aa686eb57224ea)
- 🐛 Fix: Some linting errors and warnings [`0875a64`](https://github.com/mattogodoy/nametag/commit/0875a64321b1f4036d3cab4eab26c87e382d6875)
- 🔧 Chore: release v0.9.0 [`4bda013`](https://github.com/mattogodoy/nametag/commit/4bda013e17d9def45d56c913f94c75546c4ccb93)
- 🐛 Fix: Fixed duplicate ImportData interface [`161d351`](https://github.com/mattogodoy/nametag/commit/161d3516c125c27aad5c2fb131217bb4aeb07fac)
- 🔧 Chore: Change icon [`0f57d76`](https://github.com/mattogodoy/nametag/commit/0f57d7640a428cddfaa0d080bd06c3bd26d6f1fd)

#### [v0.8.0](https://github.com/mattogodoy/nametag/compare/v0.7.1...v0.8.0)

> 9 January 2026

- ✨ Feature: Ability to select which groups to import [`af6a6b0`](https://github.com/mattogodoy/nametag/commit/af6a6b084378afaa9faa19e691fea7b8a83f28be)
- 🐛 Fix: Defined types and removed unused variables [`aecc4ee`](https://github.com/mattogodoy/nametag/commit/aecc4eeee4b5ea1e62084ff9129358a9a12835a9)
- 🔧 Chore: release v0.8.0 [`7fd7b61`](https://github.com/mattogodoy/nametag/commit/7fd7b617b7185e93f106cde23336eacf60b7ee3a)
- 🔧 Chore: Type declaration [`1a5def1`](https://github.com/mattogodoy/nametag/commit/1a5def1c94d534973ad02e0d96abe436832ed1f3)

#### [v0.7.1](https://github.com/mattogodoy/nametag/compare/v0.7.0...v0.7.1)

> 9 January 2026

- 🐛 Fix: Improved colors for warning messages [`59bfccf`](https://github.com/mattogodoy/nametag/commit/59bfccf863588d17fe6173278dca5575bed3c758)
- 🔧 Chore: release v0.7.1 [`3753827`](https://github.com/mattogodoy/nametag/commit/37538277c14b4acbaba34b21df112a8a9b2c7b82)
- 🔧 Chore: Updated README screenshots after redesign [`acf736b`](https://github.com/mattogodoy/nametag/commit/acf736b4fcc3f52b252581c79f6e1c53c48dd856)
- 🐛 Fix: Make dashboard icons consistent [`7978140`](https://github.com/mattogodoy/nametag/commit/79781408fc75ecb12359e35c256e5fad060bef2d)

#### [v0.7.0](https://github.com/mattogodoy/nametag/compare/v0.6.0...v0.7.0)

> 8 January 2026

- Redesign UI color palette [`#2`](https://github.com/mattogodoy/nametag/pull/2)
- ✨ Feature: New design. Dark theme mostly done. Light theme comes next [`f057353`](https://github.com/mattogodoy/nametag/commit/f057353896d3672d093a28c28dae272fdef099be)
- Initial changes. Not finished, but enough to see how it looks [`0cd5c5b`](https://github.com/mattogodoy/nametag/commit/0cd5c5b59ffb410052887ef3c82740f3e6e64376)
- Rebranded from NameTag to Nametag [`a9dc142`](https://github.com/mattogodoy/nametag/commit/a9dc1422651f0552d7059b2d3c3b099ac8df328c)
- Cool Contrast Blue [`0d7681e`](https://github.com/mattogodoy/nametag/commit/0d7681e1e5b7b0133b2b84c58bd13d5845687866)
- Playful Modern [`a5e0802`](https://github.com/mattogodoy/nametag/commit/a5e0802b80e557e97c7eeff0efb4bc62f91c8ee0)
- Testing Modern Minimal Red [`8148210`](https://github.com/mattogodoy/nametag/commit/814821095fdc0021f16d82a8a75fc3b568d4b3e8)
- Monochrome [`df7ab18`](https://github.com/mattogodoy/nametag/commit/df7ab18cb149d92532aa99d04a84419ddd167dd6)
- Warm Professional [`4672659`](https://github.com/mattogodoy/nametag/commit/46726590ba160dadd60b05d3bb0718f1b3c2d233)
- 🔧 Chore: release v0.7.0 [`7ed9a5d`](https://github.com/mattogodoy/nametag/commit/7ed9a5dd9e3664587243daa27d74cd1cc48b2674)
- 🐛 Fix: Fixed tests after redesign [`0d0f899`](https://github.com/mattogodoy/nametag/commit/0d0f89975f3580d4cce25dbdc467e8d358594145)
- 🔧 Chore: Some theme improvements on the network graph [`cd541a2`](https://github.com/mattogodoy/nametag/commit/cd541a281a2c25e10b9d5bf6cbe14758fa7d9f6e)
- 🔧 Chore: Increased the arrow head a bit [`ce480f0`](https://github.com/mattogodoy/nametag/commit/ce480f0018a56b5dc5812f07c99b437cd30abbe5)
- 🔧 Chore: Updated .gitignore [`6e0cb84`](https://github.com/mattogodoy/nametag/commit/6e0cb84ae0fcae7f3c8338361c2e649b68106f7a)
- 🐛 Fix: Fix build [`f45d1b4`](https://github.com/mattogodoy/nametag/commit/f45d1b4ffaf6d69510727736e46b01836042d519)

#### [v0.6.0](https://github.com/mattogodoy/nametag/compare/v0.5.0...v0.6.0)

> 6 January 2026

- ✨ Feature: Allows for adding people during group creation [`ee1be0c`](https://github.com/mattogodoy/nametag/commit/ee1be0c8c725487b27dd84577572588c287620db)
- ✨ Feature: Allow filtering graph by multiple groups [`73fe3e0`](https://github.com/mattogodoy/nametag/commit/73fe3e00f2e4eeadbf8f6b8e28750ddd8917930d)
- 🐛 Fix: Improved navigation by adding creation shortcuts [`c755932`](https://github.com/mattogodoy/nametag/commit/c755932f08a256912a469e0b8bee1065ab7f7cfc)
- 🔧 Chore: Remove stats from dashboard [`0c08576`](https://github.com/mattogodoy/nametag/commit/0c085764c4e7aa1f36747a8ae1a6b0f8a2324a46)
- 🔧 Chore: Move upcoming events to the top [`905f63d`](https://github.com/mattogodoy/nametag/commit/905f63d031fe3057bc259e13ff41905d59d0c966)
- 🔧 Chore: Add visual cues for group creation during person creation [`8c7d603`](https://github.com/mattogodoy/nametag/commit/8c7d6035007822b24318168d402bdd94ed8b244c)
- 🔧 Chore: Added tooltip with information [`69f16ef`](https://github.com/mattogodoy/nametag/commit/69f16ef5981b63c05619084edc017e1c97ef559d)
- 🐛 Fix: Improvements for the pill input component [`bd40a91`](https://github.com/mattogodoy/nametag/commit/bd40a919a990185dd6c3324dca50f5d6cf2f9985)
- 🔧 Chore: release v0.6.0 [`7cabcb1`](https://github.com/mattogodoy/nametag/commit/7cabcb1cb6b8aba4685801e55fad2644468e5d9d)
- 🐛 Fix: Limit GitHub release notes to current version only [`eab6c6f`](https://github.com/mattogodoy/nametag/commit/eab6c6f383785ae58b34c3ebd1a26c1fb5baaac3)
- 🐛 Fix: Fixed failing tests [`190818f`](https://github.com/mattogodoy/nametag/commit/190818f6f07e91d28a86ed9d4371f321f3a3ad56)
- 🐛 Fix: Fix some linting issues [`048f330`](https://github.com/mattogodoy/nametag/commit/048f330b4a24f4e232d032386cb064c2cecbcda8)

#### [v0.5.0](https://github.com/mattogodoy/nametag/compare/v0.4.0...v0.5.0)

> 6 January 2026

- 🐛 Fix: Imprived network graph [`df2859f`](https://github.com/mattogodoy/nametag/commit/df2859fdc4e4da821ddd286508ccbbef012ce574)
- ✨ Feature: Added re-center button for network graphs [`a665ef2`](https://github.com/mattogodoy/nametag/commit/a665ef208a471ae398cceb9e50079f222d5e62bd)
- 🐛 Fix: Fixed relationship inconsistencies in the dashboard graph [`d3cfb47`](https://github.com/mattogodoy/nametag/commit/d3cfb47ef091caf98d88785eccd9621aa9ae445c)
- 🔧 Chore: Improve readability on billing prices [`151446f`](https://github.com/mattogodoy/nametag/commit/151446f6466c3b3f7c73b4f716ce38f0b70ff499)
- 🔧 Chore: release v0.5.0 [`8bb1e12`](https://github.com/mattogodoy/nametag/commit/8bb1e12bc90193dd8d3e0c7a230b63600cfb9d52)

#### [v0.4.0](https://github.com/mattogodoy/nametag/compare/v0.3.0...v0.4.0)

> 6 January 2026

- ✨ Feature: Added an option to delete people too when deleting groups [`0f52a8d`](https://github.com/mattogodoy/nametag/commit/0f52a8d9d792ed9c161c30e77d76e7ead831aa1c)
- 🐛 Fix: Fix orphan detection. It broke after implementing soft-delete [`c6e02e6`](https://github.com/mattogodoy/nametag/commit/c6e02e67703a7ad58d4840f81ea5f1af58973f43)
- 🐛 Fix: Don't allow data export when there's no data [`3734633`](https://github.com/mattogodoy/nametag/commit/3734633c63346fbecb762b865ddd987196be9352)
- 🔧 Chore: release v0.4.0 [`2dd18a9`](https://github.com/mattogodoy/nametag/commit/2dd18a9d4c07fd93587cc427f3693e001f205968)
- 🐛 Fix: Minor visual improvements [`5e7f155`](https://github.com/mattogodoy/nametag/commit/5e7f1550f3f01aee441ecb75b32d530bf5337d32)

#### [v0.3.0](https://github.com/mattogodoy/nametag/compare/v0.2.2...v0.3.0)

> 6 January 2026

- 🔧 Chore: release v0.3.0 [`eea1fc6`](https://github.com/mattogodoy/nametag/commit/eea1fc6d7e331c27a14a196c02b0fcc382c76d01)
- Improved setings navigation menu [`29b7751`](https://github.com/mattogodoy/nametag/commit/29b77515144b5f48255a5fd1cfcfdbfedd057743)
- ✨ Feature: Improved setings navigation menu [`5634396`](https://github.com/mattogodoy/nametag/commit/5634396024426cfa9037fe8ae2acd05c08b1bbdc)
- 🔧 Chore: Merge Github Actions Workflows into one [`7573553`](https://github.com/mattogodoy/nametag/commit/75735535863bf6643b29c89bf2ccf2842a81b6b7)

#### [v0.2.2](https://github.com/mattogodoy/nametag/compare/v0.2.1...v0.2.2)

> 6 January 2026

- 🐛 Fix: Improve menu on mobile [`23603d2`](https://github.com/mattogodoy/nametag/commit/23603d22ba6f3d9bfbdbf7b6f3c0846cd6930995)
- 🔧 Chore: release v0.2.2 [`53550f8`](https://github.com/mattogodoy/nametag/commit/53550f8b4dd6463ac59a58c0de01b79d6b839a23)
- 🐛 Fix: Prevent race condition between release and Docker build workflows [`0aeae76`](https://github.com/mattogodoy/nametag/commit/0aeae764e668020fdc410eeebcad019ce8b1a969)
- 🔧 Chore: trigger Docker rebuild for v0.2.1 [`f45ab5a`](https://github.com/mattogodoy/nametag/commit/f45ab5ac9837bfff26447ab602febc5fd038875d)

#### [v0.2.1](https://github.com/mattogodoy/nametag/compare/v0.2.0...v0.2.1)

> 5 January 2026

- 🐛 Fix: Enforce tier limits on imports [`6429c59`](https://github.com/mattogodoy/nametag/commit/6429c593b6d6550e2279e386e05fda4561e6b56c)
- 🐛 Fix: Fixed error when selecting days for remider periods [`8ec7328`](https://github.com/mattogodoy/nametag/commit/8ec7328e75c5e8f5552e33d883ee54acbc4e3eba)
- 🔧 Chore: release v0.2.1 [`2baaf79`](https://github.com/mattogodoy/nametag/commit/2baaf7914ce6be6606c577c8cee1b5a0c6fd9ed2)

#### [v0.2.0](https://github.com/mattogodoy/nametag/compare/v0.1.4...v0.2.0)

> 4 January 2026

- Add Google OAuth for registration and login [`#1`](https://github.com/mattogodoy/nametag/pull/1)
- ✨ Feature: Added Google OAuth for registration and login [`198871f`](https://github.com/mattogodoy/nametag/commit/198871fe8b8fb510bb0eda44c9f53a97667c1451)
- 🔧 Chore: Remove double colons from changelog format [`3723e78`](https://github.com/mattogodoy/nametag/commit/3723e7851da5371170e99c363efd5c5e72b42be0)
- 🔧 Chore: release v0.2.0 [`635277c`](https://github.com/mattogodoy/nametag/commit/635277cea61a1e4dbc6f23b80adfc1012b5fff11)

#### [v0.1.4](https://github.com/mattogodoy/nametag/compare/v0.1.3...v0.1.4)

> 2 January 2026

- 🐛 Fix: Removed email account verification for self-hosted mode [`18e88b5`](https://github.com/mattogodoy/nametag/commit/18e88b56675b9b6f8ea71d8dfa7105a38944c022)
- 🔧 Chore: release v0.1.4 [`1bf367b`](https://github.com/mattogodoy/nametag/commit/1bf367b593a0ccbd85a2b50deada0f7c93cb39f0)

#### [v0.1.3](https://github.com/mattogodoy/nametag/compare/v0.1.2...v0.1.3)

> 2 January 2026

- 🔧 Chore: Added Support Development link [`7ba4393`](https://github.com/mattogodoy/nametag/commit/7ba43934a9fb3f7142260bf1ad75ec9dc3e32a2d)
- 🔧 Chore: release v0.1.3 [`8614287`](https://github.com/mattogodoy/nametag/commit/86142870aea22053d0357c0788ff1ceb4faa7226)
- 🐛 Fix: Fixed relationship use count [`95419e7`](https://github.com/mattogodoy/nametag/commit/95419e7d7d8a1fc9ffe6e14d7941bcd0ac1a78b4)

#### [v0.1.2](https://github.com/mattogodoy/nametag/compare/v0.1.1...v0.1.2)

> 2 January 2026

- 🐛 Fix: Re-enabled tests un release process. [`85080d6`](https://github.com/mattogodoy/nametag/commit/85080d67cbecfd467761220f6db257004fdf6347)
- 🔧 Chore: release v0.1.2 [`f46937a`](https://github.com/mattogodoy/nametag/commit/f46937a6c6850955c067b1e3ae4af92e105321c8)

#### v0.1.1

> 2 January 2026

- Initial commit [`879e55f`](https://github.com/mattogodoy/nametag/commit/879e55fed445a7ef9acfa580e15421e46f963b72)
- 🔧 Chore: release v0.1.1 [`32b8c63`](https://github.com/mattogodoy/nametag/commit/32b8c63ace42f7a59c26b07ad3d51a20d4839a12)
- 🐛 Fix: Corrections for the release process [`74cadaf`](https://github.com/mattogodoy/nametag/commit/74cadaf8d699f5498380868d75fb7a5cef477127)
- 🐛 Fix: Corrections for the release process [`20baed1`](https://github.com/mattogodoy/nametag/commit/20baed1c5a7c9fe460c81378ba24c39dd9564889)
- 🐛 Fix: Corrections for the release process [`1b9304e`](https://github.com/mattogodoy/nametag/commit/1b9304e0af403ff7dd4468b03c89b07f866f9f00)
- 🐛 Fix: Corrections for the release process [`a9dc9f3`](https://github.com/mattogodoy/nametag/commit/a9dc9f3e0b13f2de4555a160e8d1ae726f92dbd4)
- 🐛 Fix: fixed linting errors [`0a0af6a`](https://github.com/mattogodoy/nametag/commit/0a0af6aec584abf08bfa3a5cfd6de3e29e6caedd)
- 🐛 Fix: disable tests and linting for initial release [`3b4c13c`](https://github.com/mattogodoy/nametag/commit/3b4c13c55fd1a07813b41e1fdd669de34862f0d4)
- 🐛 Fix: add type annotation to fix build error [`cb6ff0a`](https://github.com/mattogodoy/nametag/commit/cb6ff0a9e052b898440312728bc32fecc974ef31)
- 🐛 Fix: add type annotation to fix build error [`c6fada4`](https://github.com/mattogodoy/nametag/commit/c6fada41aac0c133f874f429fedd0ab2a4fabcfe)
