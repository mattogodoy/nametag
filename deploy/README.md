# App store listings

Source files for the third-party app stores that list Nametag. The stores do
not read them from here: each one has to be submitted to its own catalog.

## CasaOS (`casaos/Nametag/`)

Copy the folder to `Apps/Nametag/` in a fork of
[IceWhaleTech/CasaOS-AppStore](https://github.com/IceWhaleTech/CasaOS-AppStore),
run `./scripts/build_dist.sh` there, and open a pull request. The image tag and
`version` are pinned, so each Nametag release needs a small update PR.

## Unraid (`unraid/`)

Community Applications scans public GitHub repositories. Submit this repository
at https://ca.unraid.net/submit/new, run **Validate** and **Scan**, and point it
at `deploy/unraid/`. The template uses the `latest` tag, so it needs no update
per release.
