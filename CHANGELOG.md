# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.12.0](https://github.com/mattogodoy/nametag/compare/v0.11.0...v0.12.0) (2026-01-13)

### Features

* Added link to disable reminders directly from the emails. Other fixes related to reminders ([b67c4ed](https://github.com/mattogodoy/nametag/commit/b67c4ed5354bce31ffdd79358d6a22959947eaf9))

### Bug Fixes

* Added missing var to the env schema ([e9c442c](https://github.com/mattogodoy/nametag/commit/e9c442c3ad12bf1d5030662ef93a3f1d587eb3eb))

### Changelog

All notable changes to this project will be documented in this file. Dates are displayed in UTC.

#### [v0.12.0](https://github.com/mattogodoy/nametag/compare/v0.11.0...v0.12.0)

- ✨ Feature: Added link to disable reminders directly from the emails. Other fixes related to reminders [`b67c4ed`](https://github.com/mattogodoy/nametag/commit/b67c4ed5354bce31ffdd79358d6a22959947eaf9)
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
