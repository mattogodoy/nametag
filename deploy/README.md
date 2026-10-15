# App store listings

Source files for the third-party app stores that list Nametag. The stores do
not read them from here: each one has to be submitted to its own catalog.

## ZimaOS and CasaOS (`zimaos/Nametag/`)

Copy the folder to `Apps/Nametag/` in a fork of
[IceWhaleTech/CasaOS-AppStore](https://github.com/IceWhaleTech/CasaOS-AppStore),
run `./scripts/build_dist.sh` there, and open a pull request. The repository
keeps its old name but is now the ZimaOS App Store, and CasaOS reads from it
too. Its v2 format still uses `x-casaos` keys, so those stay as they are.

The image tag and `version` are pinned, so each Nametag release needs a small
update PR.

## Unraid

The template lives in its own repository,
[mattogodoy/unraid-templates](https://github.com/mattogodoy/unraid-templates),
because Community Applications expects `ca_profile.xml` at the repository root.
It uses the `latest` tag, so it needs no update per release.
