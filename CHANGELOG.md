# Changelog

## [0.1.1](https://github.com/pilotworks/dockor/compare/v0.1.0...v0.1.1) (2026-09-30)


### Features

* Add comprehensive documentation for Dockor including agent protocol, API specifications, architecture, deployment, security, roadmap, and template specifications ([09488ea](https://github.com/pilotworks/dockor/commit/09488eaef540a81e93fd47eb3acfd5c7223c6331))
* add Custom Compose Stack Creator & Docker System Prune features ([028c685](https://github.com/pilotworks/dockor/commit/028c685275e36ea1505c21a9c2ccc1c188e79d24))
* add Docker Network list and detail views with full IPAM and endpoint management ([86b4e9c](https://github.com/pilotworks/dockor/commit/86b4e9cd3fee1e6246891a87aed355c3e2006ba4))
* add Dockor logo component and integrate it into the sidebar ([dbebd54](https://github.com/pilotworks/dockor/commit/dbebd54c3235792f59cda328a28438f47df27880))
* add Volumes and Images management with dedicated detail views and global dialogs ([c5287d9](https://github.com/pilotworks/dockor/commit/c5287d9222a5af8ea2ce86baf8fb8226f83e986d))
* batch actions, stack webhooks, node enrollment, template management, and image tagging/commit ([c37ff4b](https://github.com/pilotworks/dockor/commit/c37ff4b9fa215d8aa8a9f2dd18150d32fabb9cee))
* design and implement dedicated Container and Stack detail views ([5de4917](https://github.com/pilotworks/dockor/commit/5de49177bc036d7009428ce2800ee81496e6dcac))
* enhance container management and network detail views ([fa7c080](https://github.com/pilotworks/dockor/commit/fa7c080eec8ace44213ce3fb9cf6e9704225e7db))
* **fe:** migrate frontend package manager and CI/Docker builds from pnpm to bun ([f8b82e2](https://github.com/pilotworks/dockor/commit/f8b82e2080f0e3a9a18843833ad33e95d2107ff0))
* implement container file browser, logs pro, registry manager with encryption, command palette, and event stream ([dcdb163](https://github.com/pilotworks/dockor/commit/dcdb163427e4b1c3e422a69371f65d4227c60493))
* implement Dashboard overview, System Prune, Create Stack modal and Run Container modal ([0e2f666](https://github.com/pilotworks/dockor/commit/0e2f6664fce693de8cfabb28c760f030651a605b))
* implement interactive web terminal and live logs via xterm.js and websockets ([d2a7529](https://github.com/pilotworks/dockor/commit/d2a75290144ee69fa7c9bad1448554327fa687a3))
* implement live docker compose execution engine and stack management ([393de89](https://github.com/pilotworks/dockor/commit/393de89b57bd8ab439a54bd5bbc92ff59f3bba5b))
* implement real-time container telemetry and resource stats streaming (CPU, RAM, Net, Disk) ([e2ab9e0](https://github.com/pilotworks/dockor/commit/e2ab9e07ac255134e1f3e85a3913ad3a271342de))
* integrate monaco compose editor with split-view visualizer and in-place stack editing ([a5f6f1f](https://github.com/pilotworks/dockor/commit/a5f6f1ff7388bc4a5d22cc8e75724b75ad318a10))
* **routing:** sync view tabs and categories with url query parameters ([611ec29](https://github.com/pilotworks/dockor/commit/611ec295a450bbae71038561f7be065b219f96de))
* scaffold Go backend, React frontend, and dynamic template engine ([4d134e0](https://github.com/pilotworks/dockor/commit/4d134e0167f2fedfaddde35d709aff072acfebd8))
* serve web frontend directly from Go with SPA routing on single port ([7b29793](https://github.com/pilotworks/dockor/commit/7b297938e83dc068d4bbe7203b44eed25396e805))
* **ui:** add unified Checkbox component and migrate all native checkboxes ([fb27549](https://github.com/pilotworks/dockor/commit/fb2754924b2a80ac484d08272426c3a1b5aeb5f8))
* upgrade container stats modal with Recharts for responsive telemetry visualizations ([27fce9e](https://github.com/pilotworks/dockor/commit/27fce9ee048563558e7d9097104695b9ac78f489))


### Bug Fixes

* **ci:** remove invalid pnpm workspace file from web directory ([cdddb99](https://github.com/pilotworks/dockor/commit/cdddb99751dbec84af39dd956f1580cb10b78ff3))
* enable convertEol in xterm to properly align log lines to left margin ([0cc9867](https://github.com/pilotworks/dockor/commit/0cc986721737f94dd32bdc78c8aaace7efab4bb4))
* remove dialog gap and override dark background to eliminate blue stripe in modals ([49a6fbe](https://github.com/pilotworks/dockor/commit/49a6fbeb44aef1be6a6e3e8d0a3be998c9cdff30))
* resolve modal mount race condition and reconnect shell bug in terminal and logs ([6eb2d11](https://github.com/pilotworks/dockor/commit/6eb2d112657dc47bafd6a11d2790f40cacdffa30))
* resolve websocket connection stall in container terminal and logs ([2be89d5](https://github.com/pilotworks/dockor/commit/2be89d5184b4d912d66eb6fc6b83398204152f13))
* **web:** allow closing dialogs and modals on backdrop click and escape key ([c9383fb](https://github.com/pilotworks/dockor/commit/c9383fb52ee200768f40d8332f78db6517b296dc))
* **web:** dynamically autoscale telemetry chart Y-axis with headroom ([922d685](https://github.com/pilotworks/dockor/commit/922d685525060c9d8ca749d1f2d43e5b418450a4))
* **web:** standardize light and dark theme across all modals, terminals, and editors ([047f483](https://github.com/pilotworks/dockor/commit/047f483fac0bbd4d6557ad2ee58de3ce5044b7a4))
