# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


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
