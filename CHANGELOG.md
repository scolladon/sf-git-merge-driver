# Changelog

## [1.4.2](https://github.com/scolladon/sf-git-merge-driver/compare/v1.4.1...v1.4.2) (2026-02-03)


### Bug Fixes

* add statuses:write permission for commit status API ([ae39341](https://github.com/scolladon/sf-git-merge-driver/commit/ae39341e100bd5d09e12902ae6edb1da6ef4b5c3))
* configure release as trusted publisher ([#165](https://github.com/scolladon/sf-git-merge-driver/issues/165)) ([9054a82](https://github.com/scolladon/sf-git-merge-driver/commit/9054a82e3dac6ae674ada3b380a1eea19c6fc861))
* consolidate npm publishing into single OIDC workflow ([60e7756](https://github.com/scolladon/sf-git-merge-driver/commit/60e7756081aea62d1d59777989f64d598da86a45))
* remove --provenance flag from npm publish ([2036681](https://github.com/scolladon/sf-git-merge-driver/commit/2036681a4d048a7b530354197594cb2852be3229))
* simplify npm-publish workflow with unified jobs ([c35e4b7](https://github.com/scolladon/sf-git-merge-driver/commit/c35e4b7d2eeabe448be43007df76a0779a4faa09))
* simplify npm-publisher as synchronous reusable workflow ([84c383b](https://github.com/scolladon/sf-git-merge-driver/commit/84c383b6da66a0ae09dd5f65af839faae063907d))
* upgrade npm for trusted publishing support ([218126a](https://github.com/scolladon/sf-git-merge-driver/commit/218126a01cd7287804535e2de521bbb92c2f1d72))
* use bash script for wait with 30s timeout ([cbbe9a5](https://github.com/scolladon/sf-git-merge-driver/commit/cbbe9a5248f868a006a09b5cfb6f8711a937c1be))
* use commit status to sync npm publish with e2e tests ([896989d](https://github.com/scolladon/sf-git-merge-driver/commit/896989d553ad0d0a9e0645fe6a51524d2d298679))
* use github.event_name instead of github.event_type ([9f4aa54](https://github.com/scolladon/sf-git-merge-driver/commit/9f4aa54b88dd62c16c70c531dac00ce88df6776f))
* wait for package availability before e2e tests ([072cb06](https://github.com/scolladon/sf-git-merge-driver/commit/072cb062d690e70fe41b6cb7b224ffe6b3e41609))

## [1.4.1](https://github.com/scolladon/sf-git-merge-driver/compare/v1.4.0...v1.4.1) (2026-01-26)


### Bug Fixes

* explain CI/CD specificities ([#160](https://github.com/scolladon/sf-git-merge-driver/issues/160)) ([17b8ad6](https://github.com/scolladon/sf-git-merge-driver/commit/17b8ad6c01e0d094cdf06602fffa72ee35934402))
* manifest merge ([#159](https://github.com/scolladon/sf-git-merge-driver/issues/159)) ([924eda8](https://github.com/scolladon/sf-git-merge-driver/commit/924eda82ac81991ae75422eeff0a47ddce3b6374))

## [1.4.0](https://github.com/scolladon/sf-git-merge-driver/compare/v1.3.0...v1.4.0) (2026-01-22)


### Features

* support manifest (`package.xml` like) merge ([#155](https://github.com/scolladon/sf-git-merge-driver/issues/155)) ([1b26b65](https://github.com/scolladon/sf-git-merge-driver/commit/1b26b6538bedb3d56d13f10f6271feca2f6b4044))

## [1.3.0](https://github.com/scolladon/sf-git-merge-driver/compare/v1.2.2...v1.3.0) (2025-12-31)


### Features

* add aliases enable (=install) or disable (=uninstall) ([#151](https://github.com/scolladon/sf-git-merge-driver/issues/151)) ([864f3c5](https://github.com/scolladon/sf-git-merge-driver/commit/864f3c5e04abeef61c280a4a47617a3d2cf9621e))

## [1.2.2](https://github.com/scolladon/sf-git-merge-driver/compare/v1.2.1...v1.2.2) (2025-12-29)


### Bug Fixes

* git attributes cleaning when uninstalling ([#148](https://github.com/scolladon/sf-git-merge-driver/issues/148)) ([9c8cbbe](https://github.com/scolladon/sf-git-merge-driver/commit/9c8cbbed96cf67d40a7fb12a9df55424ae24535f))

## [1.2.1](https://github.com/scolladon/sf-git-merge-driver/compare/v1.2.0...v1.2.1) (2025-10-13)


### Bug Fixes

* remove `recursive` driver attribut ([#132](https://github.com/scolladon/sf-git-merge-driver/issues/132)) ([773674b](https://github.com/scolladon/sf-git-merge-driver/commit/773674bb8c9470dd53ece62f54f2ad432590227b))

## [1.2.0](https://github.com/scolladon/sf-git-merge-driver/compare/v1.1.0...v1.2.0) (2025-09-20)


### Features

* better logging ux and performance ([#113](https://github.com/scolladon/sf-git-merge-driver/issues/113)) ([918c812](https://github.com/scolladon/sf-git-merge-driver/commit/918c812a306950175887ef634bc9ce444f641b31))

## [1.1.0](https://github.com/scolladon/sf-git-merge-driver/compare/v1.0.5...v1.1.0) (2025-09-13)


### Features

* change empty ancestor behavior ([#107](https://github.com/scolladon/sf-git-merge-driver/issues/107)) ([a9f18cc](https://github.com/scolladon/sf-git-merge-driver/commit/a9f18cc1f8a20f9e00f19edaf614db8e04efafb7))
* implement basic logger ([#108](https://github.com/scolladon/sf-git-merge-driver/issues/108)) ([9a9f482](https://github.com/scolladon/sf-git-merge-driver/commit/9a9f4822c079813b74d0ae46c5139009d82af3f1))


### Bug Fixes

* windows eol and path seperator in unit tests ([#106](https://github.com/scolladon/sf-git-merge-driver/issues/106)) ([04c0aa7](https://github.com/scolladon/sf-git-merge-driver/commit/04c0aa7f0fa3078a2d1f7335bd1fdbb3b5839cc0))

## [1.0.5](https://github.com/scolladon/sf-git-merge-driver/compare/v1.0.4...v1.0.5) (2025-08-13)


### Bug Fixes

* default behavior on parsing exception ([#91](https://github.com/scolladon/sf-git-merge-driver/issues/91)) ([ab1cc1a](https://github.com/scolladon/sf-git-merge-driver/commit/ab1cc1ac8b7a119644f665430a2dc0001341b293))

## [1.0.4](https://github.com/scolladon/sf-git-merge-driver/compare/v1.0.3...v1.0.4) (2025-08-12)


### Bug Fixes

* make reading `our`|`ancestor`|`their` variable more robust ([#89](https://github.com/scolladon/sf-git-merge-driver/issues/89)) ([d470f49](https://github.com/scolladon/sf-git-merge-driver/commit/d470f496ef4e3a2bf0723583e64c77513fbffe36))

## [1.0.3](https://github.com/scolladon/sf-git-merge-driver/compare/v1.0.2...v1.0.3) (2025-08-12)


### Bug Fixes

* don't process XML entities and deal with defined JSONElements ([#87](https://github.com/scolladon/sf-git-merge-driver/issues/87)) ([8d873ca](https://github.com/scolladon/sf-git-merge-driver/commit/8d873cafc17f7a6df395806293f0a2bdf8cff19e))

## [1.0.2](https://github.com/scolladon/sf-git-merge-driver/compare/v1.0.1...v1.0.2) (2025-08-12)


### Bug Fixes

* git attributes location ([#82](https://github.com/scolladon/sf-git-merge-driver/issues/82)) ([8d0d6d5](https://github.com/scolladon/sf-git-merge-driver/commit/8d0d6d584ea4bfe1e73cb13fc93801a85e4a4c7f))
* windows portability driver issues ([#70](https://github.com/scolladon/sf-git-merge-driver/issues/70)) ([8e25478](https://github.com/scolladon/sf-git-merge-driver/commit/8e25478f3912885521a8e5ac84dac5ac1b0c3e26))

## [1.0.1](https://github.com/scolladon/sf-git-merge-driver/compare/v1.0.0...v1.0.1) (2025-07-09)


### Bug Fixes

* gitattributes mapping ([#66](https://github.com/scolladon/sf-git-merge-driver/issues/66)) ([50923ca](https://github.com/scolladon/sf-git-merge-driver/commit/50923ca04cd5ad7848aef5ff5f19410c8ef04778))

## 1.0.0 (2025-04-04)


### Features

* install, uninstall and run 3-way merge driver for Salesforce ([#3](https://github.com/scolladon/sf-git-merge-driver/issues/3)) ([531b7af](https://github.com/scolladon/sf-git-merge-driver/commit/531b7af61bde0f8dc85536e35a5d14ea2cde7b3a))
