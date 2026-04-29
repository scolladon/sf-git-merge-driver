# Changelog

## [1.8.0](https://github.com/scolladon/sf-git-merge-driver/compare/v1.7.0...v1.8.0) (2026-04-29)


### Features

* **pipeline:** streaming XML (parse + write) ([#189](https://github.com/scolladon/sf-git-merge-driver/issues/189)) ([5ddb63f](https://github.com/scolladon/sf-git-merge-driver/commit/5ddb63fed21d0da03bc68dff3e31073837ce7f8d))

## [1.7.0](https://github.com/scolladon/sf-git-merge-driver/compare/v1.6.1...v1.7.0) (2026-04-21)


### Features

* **perf:** standalone binary merge driver (~7.5x faster) ([#184](https://github.com/scolladon/sf-git-merge-driver/issues/184)) ([ba74cfb](https://github.com/scolladon/sf-git-merge-driver/commit/ba74cfbbfa26f3ce597fc7a3453ce64fbeb1cf89))


### Bug Fixes

* **install:** idempotent install, --dry-run, --on-conflict handling ([#186](https://github.com/scolladon/sf-git-merge-driver/issues/186)) ([8749150](https://github.com/scolladon/sf-git-merge-driver/commit/87491505e6cdd9447a02eaacc6dbbf73029a76d9))
* **release:** anchor release-please to existing v-prefixed tags ([#188](https://github.com/scolladon/sf-git-merge-driver/issues/188)) ([a6792f9](https://github.com/scolladon/sf-git-merge-driver/commit/a6792f930412a8ca6ec618a85bceacb74a832108))


### Code Refactoring

* improve code base for performance and maintenance ([#187](https://github.com/scolladon/sf-git-merge-driver/issues/187)) ([e810eac](https://github.com/scolladon/sf-git-merge-driver/commit/e810eace9985c6bee4d0e5c33414741b6acae51e))

## [1.6.1](https://github.com/scolladon/sf-git-merge-driver/compare/v1.6.0...v1.6.1) (2026-04-15)


### Bug Fixes

* **perf:** switch to flexible-xml-parser, introduce ports & adapters architecture ([#181](https://github.com/scolladon/sf-git-merge-driver/issues/181)) ([3dd3e68](https://github.com/scolladon/sf-git-merge-driver/commit/3dd3e6815e4dfc96035f70de5038ae9f774a7371))

## [1.6.0](https://github.com/scolladon/sf-git-merge-driver/compare/v1.5.4...v1.6.0) (2026-04-03)


### Features

* **perf:** add comprehensive performance testing infrastructure ([#179](https://github.com/scolladon/sf-git-merge-driver/issues/179)) ([ae2c3db](https://github.com/scolladon/sf-git-merge-driver/commit/ae2c3dbc5ad455b5118eb3740a80041a7c327d4d))

## [1.5.4](https://github.com/scolladon/sf-git-merge-driver/compare/v1.5.3...v1.5.4) (2026-02-26)


### Bug Fixes

* picklist values corrupted in Deterministic Ordered merge ([#175](https://github.com/scolladon/sf-git-merge-driver/issues/175)) ([365c7f7](https://github.com/scolladon/sf-git-merge-driver/commit/365c7f7dd0c6a6ee600374e1cb4fb8fafc561316))

## [1.5.3](https://github.com/scolladon/sf-git-merge-driver/compare/v1.5.2...v1.5.3) (2026-02-17)


### Bug Fixes

* simplify [@log](https://github.com/log) decorator and defer debug serialization ([#172](https://github.com/scolladon/sf-git-merge-driver/issues/172)) ([07a8ce2](https://github.com/scolladon/sf-git-merge-driver/commit/07a8ce2de714baa6e5ed3ca8f7876caddab7292f))

## [1.5.2](https://github.com/scolladon/sf-git-merge-driver/compare/v1.5.1...v1.5.2) (2026-02-16)


### Bug Fixes

* missing picklist elements ([#170](https://github.com/scolladon/sf-git-merge-driver/issues/170)) ([8cf3667](https://github.com/scolladon/sf-git-merge-driver/commit/8cf3667d0f456f3a9e7417f8ac29e8507b98752d))

## [1.5.1](https://github.com/scolladon/sf-git-merge-driver/compare/v1.5.0...v1.5.1) (2026-02-16)


### Bug Fixes

* improve deterministic ordering and remove dead code ([#168](https://github.com/scolladon/sf-git-merge-driver/issues/168)) ([a9fe834](https://github.com/scolladon/sf-git-merge-driver/commit/a9fe8346d2478dabd49b0ee827429afc1978817f))

## [1.5.0](https://github.com/scolladon/sf-git-merge-driver/compare/v1.4.1...v1.5.0) (2026-02-09)


### Features

* implement deterministic ordering algorithm ([#162](https://github.com/scolladon/sf-git-merge-driver/issues/162)) ([c1d75cb](https://github.com/scolladon/sf-git-merge-driver/commit/c1d75cb3b94170ad46388c67410b17f121b70cc6))

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
