FROM thinxcloud/base:1.20

LABEL maintainer="Matej Sychra <suculent@me.com>"
LABEL name="THiNX API" version="1.6.1423"

ARG DEBIAN_FRONTEND=noninteractive

ARG THINX_HOSTNAME
ENV THINX_HOSTNAME=${THINX_HOSTNAME}

ARG THINX_OWNER_EMAIL
ENV THINX_OWNER_EMAIL=${THINX_OWNER_EMAIL}

ARG COUCHDB_USER
ENV COUCHDB_USER=${COUCHDB_USER}
ARG COUCHDB_PASS
ENV COUCHDB_PASS=${COUCHDB_PASS}
ARG REDIS_PASSWORD
ENV REDIS_PASSWORD=${REDIS_PASSWORD}

ARG CODACY_PROJECT_TOKEN
ENV CODACY_PROJECT_TOKEN=${CODACY_PROJECT_TOKEN}
ARG SONAR_TOKEN
ENV SONAR_TOKEN=${SONAR_TOKEN}
ARG ROLLBAR_ACCESS_TOKEN
ENV ROLLBAR_ACCESS_TOKEN=${ROLLBAR_ACCESS_TOKEN}
ARG ROLLBAR_ENVIRONMENT
ARG ROLLBAR_ENVIRONMENT=${ROLLBAR_ENVIRONMENT}
ARG AQUA_SEC_TOKEN
ENV AQUA_SEC_TOKEN=${AQUA_SEC_TOKEN}
ARG SNYK_TOKEN
ENV SNYK_TOKEN=${SNYK_TOKEN}
ARG SQREEN_TOKEN
ENV SQREEN_TOKEN=${SQREEN_TOKEN}

ARG ENVIRONMENT
ENV ENVIRONMENT=${ENVIRONMENT}

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

ARG SQREEN_APP_NAME
ENV SQREEN_APP_NAME=${SQREEN_APP_NAME}

ARG REVISION
ENV REVISION=${REVISION}

ARG GOOGLE_OAUTH_ID
ENV GOOGLE_OAUTH_ID=${GOOGLE_OAUTH_ID}
ARG GOOGLE_OAUTH_SECRET
ENV GOOGLE_OAUTH_SECRET=${GOOGLE_OAUTH_SECRET}

ARG GITHUB_CLIENT_ID
ENV GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
ARG GITHUB_CLIENT_SECRET
ENV GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}

ARG SLACK_BOT_TOKEN
ENV SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}

ARG ENTERPRISE
ENV ENTERPRISE=${ENTERPRISE}

ARG WORKER_SECRET
ENV WORKER_SECRET=${WORKER_SECRET}

# Create app directory
WORKDIR /opt/thinx/thinx-device-api

# Install app dependencies
COPY package.json ./

RUN npm install --unsafe-perm --only-prod .

# THiNX Web & Device API (HTTP)
EXPOSE 7442

# THiNX Device API (HTTPS)
EXPOSE 7443

# GitLab Webbook (optional, moved to HTTPS)
EXPOSE 9002

# Copy app source code
COPY . .

RUN apt-get remove -y \
    && apt-get autoremove -y \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# TODO: Implement Snyk Container Scanning here in addition to DockerHub manual scans...

COPY ./docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT [ "/docker-entrypoint.sh" ]
