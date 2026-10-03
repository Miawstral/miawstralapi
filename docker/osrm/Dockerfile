# Prepares the OSRM routing graphs (walking and driving) of the Toulon area.
ARG OSRM_IMAGE=ghcr.io/project-osrm/osrm-backend:v26.10.0-debian
FROM ${OSRM_IMAGE}

RUN apt-get update \
    && apt-get install -y --no-install-recommends osmium-tool curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY prepare.sh /usr/local/bin/prepare-osrm
RUN chmod +x /usr/local/bin/prepare-osrm

ENTRYPOINT ["prepare-osrm"]
