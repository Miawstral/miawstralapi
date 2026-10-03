#!/usr/bin/env bash
# Downloads the OpenStreetMap extract of the region, keeps the Toulon area and
# builds the OSRM graphs (MLD) for the foot and car profiles in /data/<profile>.
# Runs once: later starts exit immediately while the settings are unchanged.
set -euo pipefail

DATA_DIR=${DATA_DIR:-/data}
# Département du Var (OpenStreetMap France, ~80 MB, updated daily): the whole network is inside.
OSM_URL=${OSM_URL:-https://download.openstreetmap.fr/extracts/europe/france/provence_alpes_cote_d_azur/var-latest.osm.pbf}
# lon_min,lat_min,lon_max,lat_max: every stop of the network plus a margin
OSM_BBOX=${OSM_BBOX:-5.75,42.99,6.24,43.22}
PROFILES=(foot car)

stamp="$DATA_DIR/.prepared"
wanted="$OSM_URL|$OSM_BBOX|${PROFILES[*]}"
if [[ -f "$stamp" && "$(cat "$stamp")" == "$wanted" ]]; then
    echo "OSRM data already prepared ($(cat "$stamp"))"
    exit 0
fi

mkdir -p "$DATA_DIR"
region="$DATA_DIR/source.osm.pbf"
area="$DATA_DIR/area.osm.pbf"

# Reuse a previous download of the same URL (e.g. after a failed run).
if [[ ! -f "$region" || "$(cat "$region.url" 2>/dev/null)" != "$OSM_URL" ]]; then
    rm -f "$DATA_DIR"/*.osm.pbf "$DATA_DIR"/*.osm.pbf.*
    echo "==> Downloading $OSM_URL"
    curl -fL --retry 3 --retry-delay 5 -o "$region.part" "$OSM_URL"
    mv "$region.part" "$region"
    echo "$OSM_URL" > "$region.url"
fi

# "simple" needs little memory; the margin of the bbox keeps the roads around the stops whole.
echo "==> Keeping the area $OSM_BBOX"
osmium extract --bbox "$OSM_BBOX" --strategy simple --overwrite -o "$area" "$region"
rm -f "$region" "$region.url"

for profile in "${PROFILES[@]}"; do
    echo "==> Building the $profile graph"
    rm -rf "${DATA_DIR:?}/$profile"
    mkdir -p "$DATA_DIR/$profile"
    cp "$area" "$DATA_DIR/$profile/toulon.osm.pbf"
    osrm-extract -p "/opt/$profile.lua" "$DATA_DIR/$profile/toulon.osm.pbf"
    osrm-partition "$DATA_DIR/$profile/toulon.osrm"
    osrm-customize "$DATA_DIR/$profile/toulon.osrm"
    rm -f "$DATA_DIR/$profile/toulon.osm.pbf"
done
rm -f "$area"

echo "$wanted" > "$stamp"
echo "==> OSRM data ready"
